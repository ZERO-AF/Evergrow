/**
 * Host side of online co-op (wayfinder/T03): owns the authoritative Simulation
 * while remote players are seated in the same roster couch co-op uses.
 *
 * Lifecycle: `new NetHostSession(sim)` flips `sim.netMode` to 'host';
 * `attach(channel)` wires a transport; `tick(dt, hostInput)` replaces the
 * game loop's `sim.update` + `sim.drainEvents` (it returns the drained events
 * so host-side presentation still consumes them); `leave()` kicks every
 * client and restores solo play.
 *
 * Channels: `attach` accepts either a dedicated per-client channel (memory
 * pair, direct socket — messages arrive unstamped) or the shared relay uplink
 * (server/net-relay.mjs), which stamps `from` on every member→host frame and
 * routes host→member frames by a `to` peer id. The session demultiplexes the
 * uplink by `from` and unicasts replies with `to`; on a dedicated channel the
 * channel object itself is the client key and frames go out bare.
 */

import type { CombatEvent, Input, Player } from './model.ts';
import type { Simulation } from './simulation.ts';
import { WORLD_GENERATION_VERSION } from './world-landscape.ts';
import { worldFieldsOf } from './character-save.ts';
import {
  NET_PROTOCOL_VERSION, NET_SNAPSHOT_HZ,
  decodeClient,
  type HostMessage, type MsgHello, type MsgInput, type NetChannel,
} from './net-protocol.ts';

/** One connected remote player: its transport key, roster seat and the latest
 * input frame it sent (consumed by the next `tick`). */
export interface NetHostClient {
  /** The channel this client arrived on — the shared uplink for relay peers. */
  channel: NetChannel;
  /** Roster index assigned at hello (>= 1; the host's own player is 0). */
  playerId: number;
  /** The roster member this client drives. */
  player: Player;
  /** Most recent MsgInput.input; undefined until the first frame arrives. */
  latestInput: Input | undefined;
  /** Relay peer id when the client rides a shared uplink, else null. */
  peer: number | null;
  /** Last accepted input sequence; stale frames are dropped. */
  lastSeq: number;
}

export class NetHostSession {
  private readonly sim: Simulation;
  /** Seated clients in join order; v1 seats exactly one remote partner. */
  readonly clients: NetHostClient[] = [];
  /** Every attached channel, including uplinks with no seated client yet. */
  private readonly channels = new Set<NetChannel>();
  private snapshotTimer = 0;
  private tickCount = 0;
  /** Events drained since the last snapshot emission; flushed to all clients. */
  private pendingEvents: CombatEvent[] = [];
  /** Fired when a seated client leaves or drops (name for the host notice). */
  onPeerLeft: ((name: string) => void) | null = null;
  /** Fired when the last transport drops — the session is unreachable and the
   * sim is already back to solo; the game should clear its net reference. */
  onClosed: (() => void) | null = null;
  /** True while leave() tears down — suppresses per-client leave notices. */
  private closing = false;

  constructor(sim: Simulation) {
    this.sim = sim;
    sim.netMode = 'host';
  }

  /** Wire a channel's handlers. Safe to call once per channel; re-attaching an
   * already-attached channel is a no-op. */
  attach(channel: NetChannel): void {
    if (this.channels.has(channel)) return;
    this.channels.add(channel);
    channel.onMessage = data => this.onRawMessage(channel, data);
    channel.onClose = () => this.onChannelClose(channel);
  }

  /** Advance the authoritative sim and broadcast snapshots at NET_SNAPSHOT_HZ.
   * Returns the events drained this frame so the host's own presentation
   * (renderer, combat log, damage meter) consumes them exactly as it would
   * from `sim.drainEvents()` — call this INSTEAD of sim.update + drainEvents. */
  tick(dt: number, hostInput: Input): CombatEvent[] {
    if (this.sim.netMode !== 'host') return this.pendingEvents.splice(0);
    // v1 seats one remote partner; its latest input drives roster slot 1.
    const remote = this.clients[0];
    this.sim.update(dt, hostInput, remote?.latestInput);
    // Edge-triggered fields must fire once per input frame, not once per host
    // tick — clear them after consumption so a held frame doesn't re-fire.
    if (remote?.latestInput) {
      remote.latestInput.attack = false;
      remote.latestInput.dodge = false;
      remote.latestInput.heal = false;
      remote.latestInput.skillSlot = null;
      remote.latestInput.cycleTarget = undefined;
      remote.latestInput.targetId = undefined;
      remote.latestInput.skillPressed = undefined;
    }
    const drained = this.sim.drainEvents();
    // Only buffer events while a client is seated — a solo host has nobody to
    // flush them to, and a late joiner must not receive a stale backlog.
    if (this.clients.length) for (const event of drained) this.pendingEvents.push(event);
    this.snapshotTimer += dt;
    if (this.clients.length && this.snapshotTimer >= 1 / NET_SNAPSHOT_HZ) {
      this.snapshotTimer -= 1 / NET_SNAPSHOT_HZ;
      const events = this.pendingEvents;
      this.pendingEvents = [];
      const tick = this.tickCount++;
      for (const client of this.clients)
        this.sendTo(client.channel, client.peer, this.sim.captureNetSnapshot(tick, client.player, events));
    }
    return drained;
  }

  /** Kick every client, drop the co-op roster and return the sim to solo. */
  leave(): void {
    this.closing = true;
    for (const client of [...this.clients]) this.dropClient(client, 'session-closed');
    this.sim.exitCoop();
    if (this.sim.netMode === 'host') this.sim.netMode = null;
    this.pendingEvents.length = 0;
    for (const channel of this.channels) {
      channel.onMessage = null; channel.onClose = null;
      // Defer the close a microtask so the kick frames queued by dropClient
      // deliver first on transports that drop pending sends when closed.
      try { void Promise.resolve().then(() => channel.close()); } catch { /* already gone */ }
    }
    this.channels.clear();
  }

  // ── Inbound ────────────────────────────────────────────────────────────────

  private onRawMessage(channel: NetChannel, data: string): void {
    const msg = decodeClient(data);
    if (!msg) return;
    // The relay shares this wire: `from` stamps the sender's peer id on uplink
    // frames, and `relayPeerLeft` (a relay control frame, not a ClientMessage)
    // reports a dropped member socket. Widening, not a cast — every added
    // field is optional and read defensively.
    const wire: { type: string; from?: unknown; peer?: unknown } = msg;
    if (wire.type === 'relayPeerLeft') {
      const client = typeof wire.peer === 'number' ? this.clients.find(c => c.peer === wire.peer) : undefined;
      if (client) this.dropClient(client);
      return;
    }
    // A dedicated channel carries no `from` stamp; the channel object itself
    // is the client key there.
    const peer = typeof wire.from === 'number' ? wire.from : null;
    switch (msg.type) {
      case 'hello': this.onHello(channel, peer, msg); break;
      case 'input': this.onInput(channel, peer, msg); break;
      case 'ping': this.sendTo(channel, peer, { type: 'pong', t: msg.t }); break;
      case 'resurrect': this.onResurrect(channel, peer, msg.mode); break;
      case 'bye': { const client = this.findClient(channel, peer); if (client) this.dropClient(client); break; }
    }
  }

  private onHello(channel: NetChannel, peer: number | null, msg: MsgHello): void {
    const reply = (m: HostMessage) => this.sendTo(channel, peer, m);
    if (msg.version !== NET_PROTOCOL_VERSION) { reply({ type: 'kick', reason: 'protocol-mismatch' }); return; }
    if (this.findClient(channel, peer)) return; // duplicate hello on a live seat
    if (this.sim.netMode !== 'host' || this.clients.length > 0) { reply({ type: 'kick', reason: 'session-full' }); return; }
    const partner = this.sim.netPartnerFrom(msg.player, msg.name);
    if (!this.sim.enterCoop(partner)) { reply({ type: 'kick', reason: 'unavailable' }); return; }
    // Seat the remote beside the host on open ground, like couch co-op does.
    this.placePartner(partner);
    const playerId = Math.max(1, this.sim.players.indexOf(partner));
    const client: NetHostClient = { channel, playerId, player: partner, latestInput: undefined, peer, lastSeq: -1 };
    this.clients.push(client);
    const checkpoint = this.sim.captureCheckpoint();
    this.sendTo(channel, peer, {
      type: 'welcome', version: NET_PROTOCOL_VERSION, playerId,
      worldSeed: this.sim.world.seed ?? 0,
      worldVersion: this.sim.world.generationVersion ?? WORLD_GENERATION_VERSION,
      world: worldFieldsOf(checkpoint),
      self: this.sim.netPlayerFields(partner),
      roster: this.sim.captureNetSnapshot(this.tickCount, partner, []).players,
      time: this.sim.time, kills: this.sim.kills,
    });
  }

  private onInput(channel: NetChannel, peer: number | null, msg: MsgInput): void {
    const client = this.findClient(channel, peer);
    // Reject malformed frames: a non-finite seq would NaN the ordering guard,
    // and absurd axes teleport the partner. Clamp movement to the unit stick.
    if (!client || typeof msg.seq !== 'number' || !Number.isFinite(msg.seq) || msg.seq <= client.lastSeq) return;
    const input = msg.input;
    if (!input || typeof input !== 'object') return;
    client.lastSeq = msg.seq;
    const clamp = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
    const next = { ...input, moveX: clamp(input.moveX), moveY: clamp(input.moveY) };
    // Merge edge-triggered fields into an unconsumed held frame so a press that
    // arrives between host ticks isn't discarded before the sim consumes it.
    const held = client.latestInput;
    client.latestInput = held ? {
      ...next,
      attack: held.attack || next.attack,
      dodge: held.dodge || next.dodge,
      heal: held.heal || next.heal,
      skillPressed: held.skillPressed || next.skillPressed,
      skillSlot: next.skillSlot ?? held.skillSlot,
      // targetId null is a real clear, not "absent" — only undefined defers to
      // the held frame (same contract as the client's mergeInput).
      targetId: next.targetId === undefined ? held.targetId : next.targetId,
      cycleTarget: next.cycleTarget ?? held.cycleTarget,
    } : next;
  }

  /** A client ghost asked to resurrect; the host applies the real resurrection
   * on that roster member (corpse = light penalty, healer = heavy). */
  private onResurrect(channel: NetChannel, peer: number | null, mode: 'corpse' | 'healer'): void {
    const client = this.findClient(channel, peer);
    if (!client || (mode !== 'corpse' && mode !== 'healer')) return;
    this.sim.resurrectFor(client.player, mode);
  }

  private onChannelClose(channel: NetChannel): void {
    this.channels.delete(channel);
    for (const client of [...this.clients]) if (client.channel === channel) this.dropClient(client);
    // The last transport is gone: nobody can reach this session anymore.
    if (!this.channels.size) {
      this.sim.exitCoop();
      if (this.sim.netMode === 'host') this.sim.netMode = null;
      this.onClosed?.();
    }
  }

  // ── Client bookkeeping ─────────────────────────────────────────────────────

  private findClient(channel: NetChannel, peer: number | null): NetHostClient | undefined {
    return peer === null
      ? this.clients.find(c => c.channel === channel)
      : this.clients.find(c => c.peer === peer);
  }

  private dropClient(client: NetHostClient, kickReason?: string): void {
    const index = this.clients.indexOf(client);
    if (index < 0) return;
    this.clients.splice(index, 1);
    if (kickReason) this.sendTo(client.channel, client.peer, { type: 'kick', reason: kickReason });
    // Notify the host UI that the partner left (the puppet just vanishes
    // otherwise, with no indication the session is back to solo).
    if (!this.closing) this.onPeerLeft?.(client.player.name ?? 'Your partner');
    // v1 seats exactly one remote partner; its departure ends co-op.
    this.sim.exitCoop();
  }

  /** Relay peers are reached by `to` on the shared uplink; dedicated channels
   * carry the bare frame. */
  private sendTo(channel: NetChannel, peer: number | null, msg: HostMessage): void {
    if (!channel.ready) return;
    channel.send(JSON.stringify(peer === null ? msg : { ...msg, to: peer }));
  }

  /** Ring-search open ground beside the host, mirroring beginCoop's placement. */
  private placePartner(partner: Player): void {
    const host = this.sim.player;
    for (let r = 40; r <= 200; r += 40) for (let i = 0; i < 12; i++) {
      const x = host.x + Math.cos(i * Math.PI / 6) * r, y = host.y + Math.sin(i * Math.PI / 6) * r;
      if (!this.sim.world.blocked(x, y, partner.radius)) {
        partner.x = partner.prevX = x; partner.y = partner.prevY = y;
        return;
      }
    }
    partner.x = partner.prevX = host.x + 40; partner.y = partner.prevY = host.y;
  }
}
