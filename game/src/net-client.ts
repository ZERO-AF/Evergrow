/**
 * Client-side online co-op session (wayfinder/T03).
 *
 * The client owns a puppet `Simulation`: `netMode` is 'client', so
 * `sim.update()` only interpolates and every entity array is authoritative
 * host state. This session owns the wire half:
 *
 *   const channel = await connectWebSocket(url);          // net-transport.ts
 *   const session = new NetClientSession(sim);
 *   const welcome = await session.connect(channel, hello);
 *   // welcome.worldSeed → build the world, then session.applyWorld()
 *   // per frame: session.sendInput(input); session.tick(dt);
 *   // per frame: for (const e of session.drainEvents()) …
 *
 * `connect()` requires an already-open channel (`send()` on a not-ready
 * channel drops silently — use `connectWebSocket`/`whenOpen` first).
 * The world checkpoint is NOT applied by connect(): the client cannot build
 * the world until the welcome reveals `worldSeed`, so `applyWorld()` is a
 * separate call once `sim.world` points at the real geography.
 */

import type { Simulation } from './simulation.ts';
import type { Input, CombatEvent } from './model.ts';
import { mergeCheckpoint } from './character-save.ts';
import type { WorldCheckpoint, PlayerCheckpointFields } from './character-save.ts';
import {
  NET_PROTOCOL_VERSION, NET_INPUT_HZ,
  encodeClient, decodeHost,
} from './net-protocol.ts';
import type { NetChannel, MsgHello, MsgWelcome, MsgSnapshot } from './net-protocol.ts';

/** Milliseconds the join handshake waits for MsgWelcome before rejecting. */
const CONNECT_TIMEOUT_MS = 10_000;
/** Milliseconds a ping waits for its pong before rejecting. */
const PING_TIMEOUT_MS = 5_000;

interface PendingPing {
  sentAt: number;
  resolve: (rtt: number) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class NetClientSession {
  /** World identity from MsgWelcome — build the world from these before
   * calling `applyWorld()`. -1 until connected. */
  worldSeed = -1;
  worldVersion = -1;
  /** The shared-world checkpoint from MsgWelcome; consumed by applyWorld(). */
  world: WorldCheckpoint | null = null;
  /** Fired when the host kicks this client (reason from MsgKick). */
  onKick: ((reason: string) => void) | null = null;
  /** Fired when the channel closes after a successful handshake. */
  onDisconnect: (() => void) | null = null;

  private readonly sim: Simulation;
  private channel: NetChannel | null = null;
  private selfFields: PlayerCheckpointFields | null = null;
  private welcomeWait: { resolve: (msg: MsgWelcome) => void; reject: (err: Error) => void; timer: NodeJS.Timeout } | null = null;
  private inputSeq = 0;
  private lastInputSentAt = -Infinity;
  private pendingInput: Input | null = null;
  private eventQueue: CombatEvent[] = [];
  private pingNonce = 0;
  private readonly pings = new Map<number, PendingPing>();

  constructor(sim: Simulation) {
    this.sim = sim;
    sim.netMode = 'client';
  }

  /** True between a resolved connect() and leave()/kick/disconnect. */
  get connected(): boolean { return this.channel !== null && this.welcomeWait === null; }

  /** Join a host: send MsgHello, resolve with MsgWelcome. Rejects on timeout,
   * kick, close, or protocol-version mismatch. Applies the roster id, the
   * client's own authoritative fields, and seeds remote puppets from the
   * roster. The world checkpoint is stored, not applied — see applyWorld(). */
  connect(channel: NetChannel, hello: MsgHello): Promise<MsgWelcome> {
    const prev = this.welcomeWait;
    if (prev) { clearTimeout(prev.timer); prev.reject(new Error('Superseded by a new connect()')); }
    this.detachChannel();
    this.channel = channel;
    channel.onMessage = data => this.onHostMessage(data);
    channel.onClose = () => this.handleClose();
    return new Promise<MsgWelcome>((resolve, reject) => {
      const wait = {
        resolve, reject,
        timer: setTimeout(() => {
          // Guard: a superseded wait's timer must not tear down a newer join.
          if (this.welcomeWait !== wait) return;
          wait.reject(new Error(`Join timed out after ${CONNECT_TIMEOUT_MS}ms`));
          this.teardown();
        }, CONNECT_TIMEOUT_MS),
      };
      this.welcomeWait = wait;
      channel.send(encodeClient(hello));
    });
  }

  /** Apply the welcome's world checkpoint (journeys, camps, ground loot…) plus
   * the client's own fields via the sim's checkpoint-restore path. Call once
   * after `sim.world` has been pointed at a world built from `worldSeed`.
   * No-op before connect() resolves. */
  applyWorld(): void {
    if (!this.world || !this.selfFields) return;
    this.sim.restoreCheckpoint(mergeCheckpoint(this.world, this.selfFields));
  }

  /** Offer one frame of local input. Edge-triggered fields (attack, dodge,
   * heal, skill presses, target changes) are merged into a pending frame so a
   * press is never dropped by the throttle; the merged frame goes out at
   * NET_INPUT_HZ. */
  sendInput(input: Input): void {
    this.pendingInput = this.pendingInput ? mergeInput(this.pendingInput, input) : { ...input };
    this.flushInput();
  }

  /** Per-frame pump: flushes any throttled input and advances puppet
   * interpolation. Use this INSTEAD of sim.update() — in client mode
   * sim.update() already delegates to netTick, so calling both double-ticks. */
  tick(dt: number): void {
    this.flushInput();
    this.sim.netTick(dt);
  }

  /** Combat events accumulated from snapshots since the last drain (damage
   * numbers, deaths, loot). The game feeds these to its event presentation. */
  drainEvents(): CombatEvent[] {
    if (!this.eventQueue.length) return [];
    const out = this.eventQueue;
    this.eventQueue = [];
    return out;
  }

  /** Latency probe: resolves with the round-trip time in ms. Rejects if the
   * pong never arrives or the session drops first. */
  ping(): Promise<number> {
    const channel = this.channel;
    if (!channel || !channel.ready) return Promise.reject(new Error('Not connected'));
    const t = ++this.pingNonce;
    return new Promise<number>((resolve, reject) => {
      const pending: PendingPing = {
        sentAt: Date.now(), resolve, reject,
        timer: setTimeout(() => {
          this.pings.delete(t);
          reject(new Error(`Ping timed out after ${PING_TIMEOUT_MS}ms`));
        }, PING_TIMEOUT_MS),
      };
      this.pings.set(t, pending);
      channel.send(encodeClient({ type: 'ping', t }));
    });
  }

  /** Clean leave: MsgBye, close the channel, release the sim. The close is
   * deferred a microtask so queued transports (memory pair) deliver the bye
   * before the channel opens its drop gate. */
  leave(): void {
    const channel = this.channel;
    if (channel?.ready) channel.send(encodeClient({ type: 'bye' }));
    // Defer teardown+close a microtask so the queued bye delivers first on
    // transports (memory pair) that drop pending frames when closed.
    queueMicrotask(() => this.teardown());
  }

  /** Ask the host to resurrect this client's ghost ('corpse' at the body,
   * 'healer' at the spirit healer). No-op while connected=false. */
  requestResurrect(mode: 'corpse' | 'healer'): void {
    const channel = this.channel;
    if (channel?.ready) channel.send(encodeClient({ type: 'resurrect', mode }));
  }

  // ── Host message handling ────────────────────────────────────────────────

  private onHostMessage(data: string): void {
    const msg = decodeHost(data);
    if (!msg) return;
    switch (msg.type) {
      case 'welcome': {
        const wait = this.welcomeWait;
        if (!wait) return; // duplicate welcome — ignore
        this.welcomeWait = null;
        clearTimeout(wait.timer);
        if (msg.version !== NET_PROTOCOL_VERSION) {
          this.teardown();
          wait.reject(new Error(`Protocol version mismatch: host ${msg.version}, client ${NET_PROTOCOL_VERSION}`));
          return;
        }
        this.sim.netPeerId = msg.playerId;
        this.sim.applyNetSelf(msg.self);
        this.selfFields = msg.self;
        this.world = msg.world;
        this.worldSeed = msg.worldSeed;
        this.worldVersion = msg.worldVersion;
        // Seed remote puppets by routing the roster through the snapshot path.
        this.sim.applyNetSnapshot({
          type: 'snapshot', tick: 0, time: msg.time, kills: msg.kills,
          players: msg.roster, enemies: [], projectiles: [], groundEffects: [],
          groundItems: [], groundGold: [], pickups: [], events: [], self: msg.self,
        });
        wait.resolve(msg);
        return;
      }
      case 'snapshot':
        this.handleSnapshot(msg);
        return;
      case 'pong': {
        const pending = this.pings.get(msg.t);
        if (!pending) return;
        this.pings.delete(msg.t);
        clearTimeout(pending.timer);
        pending.resolve(Date.now() - pending.sentAt);
        return;
      }
      case 'kick': {
        const wait = this.welcomeWait;
        if (wait) wait.reject(new Error(`Kicked: ${msg.reason}`));
        this.teardown();
        if (!wait) this.onKick?.(msg.reason);
        return;
      }
      case 'peerLeft':
        this.sim.netPeers = this.sim.netPeers.filter(p => p.id !== msg.playerId);
        return;
    }
  }

  private handleSnapshot(msg: MsgSnapshot): void {
    this.sim.applyNetSnapshot(msg);
    if (msg.events?.length) this.eventQueue.push(...msg.events);
    // World deltas (broken containers, cleared camps, defeated members) merge
    // into the client's world state so the renderer reflects host changes.
    if (msg.delta) this.sim.applyNetDelta(msg.delta);
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private flushInput(): void {
    const channel = this.channel, input = this.pendingInput;
    if (!channel || !input) return;
    const now = Date.now();
    if (now - this.lastInputSentAt < 1000 / NET_INPUT_HZ) return;
    this.lastInputSentAt = now;
    this.pendingInput = null;
    channel.send(encodeClient({ type: 'input', seq: ++this.inputSeq, input }));
  }

  private handleClose(): void {
    const wait = this.welcomeWait;
    if (wait) wait.reject(new Error('Connection closed during join'));
    this.teardown();
    if (!wait) this.onDisconnect?.();
  }

  /** Drop channel handlers without touching sim/session state (used when
   * swapping in a new channel for connect()). */
  private detachChannel(): void {
    const channel = this.channel;
    if (!channel) return;
    channel.onMessage = null;
    channel.onClose = null;
    this.channel = null;
  }

  /** Full teardown: detach the channel, reject pending join/pings, drop queued
   * input/events, and release the sim from client mode. */
  private teardown(): void {
    const channel = this.channel;
    this.detachChannel();
    // Close the socket so the relay frees this member's slot immediately —
    // kicked clients and timed-out joins otherwise linger until TCP timeout.
    if (channel) try { channel.close(); } catch { /* already gone */ }
    const wait = this.welcomeWait;
    if (wait) { this.welcomeWait = null; clearTimeout(wait.timer); wait.reject(new Error('Session ended')); }
    for (const pending of this.pings.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Disconnected'));
    }
    this.pings.clear();
    this.pendingInput = null;
    this.eventQueue = [];
    this.sim.netMode = null;
    this.sim.netPeers = [];
  }
}

/** Merge a newer input frame into a held one: continuous axes take the latest
 * value, edge-triggered fields latch so a press inside a throttle window is
 * never lost. */
function mergeInput(pending: Input, input: Input): Input {
  const merged: Input = { ...pending, ...input };
  merged.attack = pending.attack || input.attack;
  merged.dodge = pending.dodge || input.dodge;
  merged.heal = pending.heal || input.heal;
  if (input.skillSlot === null) merged.skillSlot = pending.skillSlot;
  merged.skillPressed = pending.skillPressed || input.skillPressed;
  if (input.targetId === undefined) merged.targetId = pending.targetId;
  if (input.cycleTarget === undefined) merged.cycleTarget = pending.cycleTarget;
  return merged;
}
