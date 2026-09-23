import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { NetClientSession } from '../src/net-client.ts';
import { createMemoryChannels } from '../src/net-transport.ts';
import { NET_PROTOCOL_VERSION, decodeClient, encodeHost } from '../src/net-protocol.ts';
import type { NetChannel, MsgWelcome, MsgSnapshot } from '../src/net-protocol.ts';
import type { Input, CombatEvent } from '../src/model.ts';
import type { WorldCheckpoint } from '../src/character-save.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
/** MemoryChannel delivers on microtasks — a few yields flush a round trip. */
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const idleInput = (): Input => ({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null, targetId: null });

const worldCheckpoint = (time: number, kills: number): WorldCheckpoint =>
  ({ time, kills, randomState: 1, spawnOrdinal: 0, killRecharge: 0, clearedCamps: [], defeatedCampMembers: {}, groundItems: [] });

const helloFor = (sim: Simulation) => ({ type: 'hello' as const, version: NET_PROTOCOL_VERSION, name: 'Guest', player: sim.netPlayerFields(sim.player) });

/** Minimal scripted host on the b-end of a memory pair. */
function fakeHost(channel: NetChannel, clientSim: Simulation, hostSim: Simulation) {
  const received: { inputs: number; byes: number; lastInput: Input | null } = { inputs: 0, byes: 0, lastInput: null };
  const hostNetPlayer = () => hostSim.captureNetSnapshot(0, hostSim.player, []).players[0];
  channel.onMessage = data => {
    const msg = decodeClient(data);
    if (!msg) return;
    if (msg.type === 'hello') {
      const self = clientSim.netPlayerFields(clientSim.player);
      self.x = 1234; self.y = -567;
      const welcome: MsgWelcome = {
        type: 'welcome', version: NET_PROTOCOL_VERSION, playerId: 1,
        worldSeed: 42, worldVersion: 7, world: worldCheckpoint(5, 2), self,
        roster: [hostNetPlayer()], time: 5, kills: 2,
      };
      channel.send(encodeHost(welcome));
    } else if (msg.type === 'input') { received.inputs++; received.lastInput = msg.input; }
    else if (msg.type === 'ping') channel.send(encodeHost({ type: 'pong', t: msg.t }));
    else if (msg.type === 'bye') received.byes++;
  };
  const sendSnapshot = (over: Partial<MsgSnapshot> = {}) => {
    const snap: MsgSnapshot = {
      type: 'snapshot', tick: 1, time: 99, kills: 3,
      players: [hostNetPlayer()], enemies: [], projectiles: [], groundEffects: [],
      groundItems: [], groundGold: [], pickups: [], events: [],
      self: clientSim.netPlayerFields(clientSim.player), ...over,
    };
    channel.send(encodeHost(snap));
  };
  return { received, sendSnapshot, hostNetPlayer };
}

async function connectedSession() {
  const clientSim = new Simulation(world, { spawn: false });
  const hostSim = new Simulation(world, { spawn: false });
  const session = new NetClientSession(clientSim);
  const { a, b } = createMemoryChannels();
  const host = fakeHost(b, clientSim, hostSim);
  await session.connect(a, helloFor(clientSim));
  return { clientSim, hostSim, session, a, b, host };
}

test('connect resolves welcome, applies self, seeds remote puppets', async () => {
  const { clientSim, session } = await connectedSession();
  assert.equal(clientSim.netMode, 'client');
  assert.equal(clientSim.netPeerId, 1);
  assert.equal(clientSim.player.x, 1234);
  assert.equal(clientSim.player.y, -567);
  assert.equal(clientSim.netPeers.length, 1);
  assert.equal(clientSim.netPeers[0].id, 0);
  assert.equal(session.worldSeed, 42);
  assert.equal(session.worldVersion, 7);
  assert.equal(session.connected, true);
  session.applyWorld();
  assert.equal(clientSim.time, 5);
  assert.equal(clientSim.kills, 2);
  session.leave();
});

test('snapshot applies world state and queues events for drain', async () => {
  const { clientSim, hostSim, session, host } = await connectedSession();
  const event: CombatEvent = { type: 'notice', x: 1, y: 2, message: 'hi' };
  hostSim.player.x = 777;
  host.sendSnapshot({ events: [event] });
  await flush();
  assert.equal(clientSim.time, 99);
  assert.equal(clientSim.kills, 3);
  assert.equal(clientSim.netPeers[0].x, 777);
  assert.deepEqual(session.drainEvents(), [event]);
  assert.deepEqual(session.drainEvents(), []);
  session.leave();
});

test('sendInput throttles to NET_INPUT_HZ and latches edge presses', async () => {
  const { session, host } = await connectedSession();
  // Deterministic clock: the throttle reads Date.now(), so drive it directly.
  const realNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    session.sendInput(idleInput()); // first send goes out immediately
    session.sendInput({ ...idleInput(), attack: true }); // inside throttle window — merged, not dropped
    session.tick(1 / 120);
    await flush();
    assert.equal(host.received.inputs, 1);
    assert.equal(host.received.lastInput!.attack, false);
    now += 40; // past the 30 Hz window — the latched press flushes
    session.tick(1 / 120);
    await flush();
    assert.equal(host.received.inputs, 2);
    assert.equal(host.received.lastInput!.attack, true);
    now += 40;
    session.sendInput(idleInput());
    await flush();
    assert.equal(host.received.inputs, 3);
    assert.equal(host.received.lastInput!.attack, false);
  } finally {
    Date.now = realNow;
    session.leave();
  }
});

test('ping resolves RTT; peerLeft drops the puppet; kick surfaces reason', async () => {
  const { clientSim, session, b } = await connectedSession();
  const rtt = await session.ping();
  assert.equal(typeof rtt, 'number');
  assert.ok(rtt >= 0);
  b.send(encodeHost({ type: 'peerLeft', playerId: 0 }));
  await flush();
  assert.equal(clientSim.netPeers.length, 0);
  let kicked: string | null = null;
  session.onKick = reason => { kicked = reason; };
  b.send(encodeHost({ type: 'kick', reason: 'host-left' }));
  await flush();
  assert.equal(kicked, 'host-left');
  assert.equal(clientSim.netMode, null);
});

test('leave sends bye and releases the sim', async () => {
  const { clientSim, session, host } = await connectedSession();
  session.leave();
  await flush();
  assert.equal(host.received.byes, 1);
  assert.equal(clientSim.netMode, null);
  assert.equal(session.connected, false);
});
