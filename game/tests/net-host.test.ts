import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { NetHostSession } from '../src/net-host.ts';
import { NetClientSession } from '../src/net-client.ts';
import { createMemoryChannels } from '../src/net-transport.ts';
import { NET_PROTOCOL_VERSION } from '../src/net-protocol.ts';
import type { Input } from '../src/model.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
/** MemoryChannel delivers on microtasks — a few yields flush a round trip. */
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const idle = (): Input => ({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null });

/** Wire a real host session to a real client session over a memory pair. */
async function linked() {
  const hostSim = new Simulation(world, { spawn: false });
  const clientSim = new Simulation(world, { spawn: false });
  const host = new NetHostSession(hostSim);
  const client = new NetClientSession(clientSim);
  const { a, b } = createMemoryChannels();
  host.attach(b); // host listens on b; client uses a
  const hello = { type: 'hello' as const, version: NET_PROTOCOL_VERSION, name: 'Guest', player: clientSim.netPlayerFields(clientSim.player) };
  const welcome = await client.connect(a, hello);
  return { hostSim, clientSim, host, client, welcome };
}

test('host seats the client and the welcome carries the roster + world', async () => {
  const { hostSim, clientSim, host, welcome } = await linked();
  assert.equal(hostSim.netMode, 'host');
  assert.equal(clientSim.netMode, 'client');
  assert.equal(hostSim.coop, true); // remote partner seated in the shared roster
  assert.equal(host.clients.length, 1);
  assert.equal(welcome.playerId, 1);
  assert.equal(welcome.roster.length, 2); // host + client puppets
  assert.equal(clientSim.netPeerId, 1);
  assert.equal(clientSim.player.id, 1); // client adopts its roster id
});

test('client input drives the remote partner on the host sim', async () => {
  const { hostSim, host, client, clientSim } = await linked();
  const partner = hostSim.players[1];
  const startX = partner.x;
  // Client pushes right; the host consumes the input frame on the next tick.
  client.sendInput({ ...idle(), moveX: 1 });
  await flush();
  // Pump a few host ticks so the movement integrates.
  for (let i = 0; i < 10; i++) host.tick(1 / 60, idle());
  assert.ok(partner.x > startX, `partner should move right (was ${startX}, now ${partner.x})`);
  assert.ok(clientSim.netMode === 'client');
});

test('host snapshot reaches the client and rebuilds remote puppet + self', async () => {
  const { hostSim, clientSim, host } = await linked();
  hostSim.player.x += 500;
  for (let i = 0; i < 8; i++) host.tick(1 / 10, idle()); // >= 1/NET_SNAPSHOT_HZ
  await flush();
  const hostPuppet = clientSim.netPeers.find(p => p.id === 0);
  assert.ok(hostPuppet, 'client should have a puppet for the host player');
  assert.equal(hostPuppet.x, hostSim.player.x);
  // The client's own player is host-authoritative too.
  assert.equal(clientSim.player.x, hostSim.players[1].x);
});

test('client leave drops the partner and returns the host to solo', async () => {
  const { hostSim, host, client } = await linked();
  assert.equal(hostSim.coop, true);
  client.leave();
  await flush();
  assert.equal(host.clients.length, 0);
  assert.equal(hostSim.coop, false);
});

test('host leave kicks the client and frees both sims', async () => {
  const { hostSim, clientSim, host, client } = await linked();
  let kicked = '';
  client.onKick = reason => { kicked = reason; };
  host.leave();
  await flush();
  assert.equal(hostSim.netMode, null);
  assert.equal(clientSim.netMode, null);
  assert.equal(kicked, 'session-closed');
});

test('edge-triggered input fires once per client frame, not once per host tick', async () => {
  const { hostSim, host, client } = await linked();
  const partner = hostSim.players[1];
  // One dodge press from the client.
  client.sendInput({ ...idle(), dodge: true });
  await flush();
  // Several host ticks consume the same held frame — dodge must not re-fire.
  for (let i = 0; i < 6; i++) host.tick(1 / 60, idle());
  const dodges = partner.dodgeTime;
  // dodgeTime decays each tick; a single press yields a bounded value, not a
  // re-triggered full duration on every tick.
  assert.ok(dodges <= 0.5, `dodge should fire once (dodgeTime=${dodges})`);
});
