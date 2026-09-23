/**
 * Network protocol for host-authoritative online co-op (wayfinder/T03).
 *
 * Model: the host runs the authoritative Simulation with remote players seated
 * in the same co-op roster couch co-op uses. Clients send their per-frame Input
 * upstream and render host snapshots downstream. World geography, NPCs, props
 * and settlements are deterministic from the world seed, so only dynamic
 * entities travel the wire.
 *
 * Transport-agnostic: a NetChannel carries UTF-8 JSON text. The WebSocket relay
 * (server/net-relay.mjs) and the in-process memory pair (net-transport.ts) both
 * satisfy it.
 */

import type { Input, Player, EnemyKind, EnemyState, CombatEvent, ProjectileStyle, Pickup } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import type { BiomeId } from './biomes.ts';
import type { PlayerCheckpointFields, WorldCheckpoint } from './character-save.ts';
import type { SkillId, GroundItem } from './character-types.ts';
import type { GroundGold } from './gold.ts';

/** Protocol version; mismatched peers refuse to join rather than desync. */
export const NET_PROTOCOL_VERSION = 1;

/** Snapshot send rate (Hz). 10 Hz + client interpolation is the prototype target. */
export const NET_SNAPSHOT_HZ = 10;
/** Client input send rate (Hz). */
export const NET_INPUT_HZ = 30;
export const NET_ENEMY_RADIUS = 2400;
/** Ground loot farther than this from a client is omitted. */
export const NET_LOOT_RADIUS = 2400;

// ── Wire entity shapes ──────────────────────────────────────────────────────

/** Remote player puppet state — everything the renderer/HUD needs per frame.
 * Own-player authoritative state rides in `NetSnapshot.self` separately. */
export interface NetPlayer {
  /** Roster index assigned by the host (0 = host's own player). */
  id: number;
  name: string;
  x: number; y: number; prevX: number; prevY: number;
  vx: number; vy: number; locomotionVX: number; locomotionVY: number;
  angle: number;
  hp: number; maxHp: number; mana: number; maxMana: number;
  level: number; dead: boolean;
  mounted: { id: string; since: number } | null;
  /** Ghost (corpse-run) state: corpse + spirit-healer anchors, or null when
   * alive. Carries the real coordinates so the client can drive the prompt. */
  ghost: { corpse: { x: number; y: number }; healer: { x: number; y: number; name: string } } | null;
  stealthed: boolean;
  /** Cast/attack animation state for remote presentation. */
  castTime: number; castDuration: number;
  activeSkill: SkillId | null;
  attack: { angle: number; elapsed: number; duration: number; kind: string } | null;
  dash: { angle: number; remaining: number; speed: number } | null;
  dodgeTime: number;
  hitFlash: number;
  /** Visual identity: class/race/look/equipment travel once via roster, but the
   * sheet rides here so late-joining renderers can rebuild the puppet. */
  character: PlayerCheckpointFields['character'];
  /** Derived stats for nameplate/healthbar scaling. */
  derived: Player['derived'];
  buffs: unknown[];
}

/** Remote enemy puppet — render + contact-relevant subset of Enemy. */
export interface NetEnemy {
  id: number;
  kind: EnemyKind; rank: EnemyRank; level: number; biome: BiomeId;
  x: number; y: number; prevX: number; prevY: number;
  vx: number; vy: number; angle: number;
  hp: number; maxHp: number;
  state: EnemyState; stateTime: number; stateDuration: number;
  radius: number;
  attackAngle: number; attackTargetX: number; attackTargetY: number;
  hitFlash: number; hitAngle: number;
  faction?: string;
  /** Status visuals (burn/freeze/stun/chill/slow) for remote presentation. */
  burnTime: number; freezeTime?: number; stunTime?: number; chillTime?: number;
  slowTime: number; slowFactor: number; stagger: number;
  sundered?: { fraction: number; remaining: number };
  bossPhases?: number;
  affix?: string;
  campId?: string;
}

/** Remote projectile puppet. */
export interface NetProjectile {
  id: number; x: number; y: number; prevX: number; prevY: number;
  angle: number; style?: ProjectileStyle; skill?: SkillId;
  owner: 'player' | 'enemy'; sourceId?: number;
}

/** Remote ground-effect puppet (consecration, blizzard, etc.). */
export interface NetGroundEffect {
  id: number; kind: string; x: number; y: number; radius: number;
  delay: number; duration: number; interval: number; tick: number;
  sourceId?: number; style?: string; skill?: SkillId;
}

/** Client → Host: join request carrying the client's full character. */
export interface MsgHello {
  type: 'hello'; version: number;
  name: string;
  /** The joining character's player fields (from its checkpoint). */
  player: PlayerCheckpointFields;
}

/** Client → Host: one frame of input. */
export interface MsgInput {
  type: 'input'; seq: number; input: Input;
}

/** Client → Host: latency probe. */
export interface MsgPing { type: 'ping'; t: number; }
/** Client → Host: clean leave. */
export interface MsgBye { type: 'bye'; }

/** Client → Host: resurrect this client's ghost ('corpse' at the body,
 * 'healer' at the spirit healer). The host applies the real resurrection. */
export interface MsgResurrect { type: 'resurrect'; mode: 'corpse' | 'healer'; }

export type ClientMessage = MsgHello | MsgInput | MsgPing | MsgBye | MsgResurrect;



/** World-state deltas since the previous snapshot (small sets, additive). */
export interface NetWorldDelta {
  brokenContainers?: string[];
  clearedCamps?: string[];
  defeatedCampMembers?: { campId: string; memberId: string }[];
}

/** Host → Client: join accepted. Carries everything needed to build the world. */
export interface MsgWelcome {
  type: 'welcome'; version: number;
  /** This client's roster id (>= 1; host is 0). */
  playerId: number;
  worldSeed: number; worldVersion: number;
  /** Full shared-world checkpoint fields (camps, journeys, expeditions…). */
  world: WorldCheckpoint;
  /** This client's own authoritative player state. */
  self: PlayerCheckpointFields;
  /** Every roster member's puppet state, including the host. */
  roster: NetPlayer[];
  time: number; kills: number;
}

/** Host → Client: per-tick world snapshot. */
export interface MsgSnapshot {
  type: 'snapshot'; tick: number; time: number; kills: number;
  players: NetPlayer[];
  enemies: NetEnemy[];
  projectiles: NetProjectile[];
  groundEffects: NetGroundEffect[];
  groundItems: GroundItem[];
  groundGold: GroundGold[];
  pickups: Pickup[];
  /** Combat events emitted since the last snapshot (damage numbers, deaths…). */
  events: CombatEvent[];
  /** This client's authoritative own-player state (HUD, sheet, cooldowns). */
  self: PlayerCheckpointFields;
  delta?: NetWorldDelta;
}

/** Host → Client: latency probe answer. */
export interface MsgPong { type: 'pong'; t: number; }

/** Host → Client: refused/dropped. */
export interface MsgKick { type: 'kick'; reason: string; }

/** Host → Client: a roster member left. */
export interface MsgPeerLeft { type: 'peerLeft'; playerId: number; }

export type HostMessage = MsgWelcome | MsgSnapshot | MsgPong | MsgKick | MsgPeerLeft;

// ── Encode/decode ───────────────────────────────────────────────────────────

export function encodeClient(msg: ClientMessage): string { return JSON.stringify(msg); }
export function encodeHost(msg: HostMessage): string { return JSON.stringify(msg); }

export function decodeClient(data: string): ClientMessage | null {
  try { const m = JSON.parse(data) as ClientMessage; return typeof m?.type === 'string' ? m : null; }
  catch { return null; }
}
export function decodeHost(data: string): HostMessage | null {
  try { const m = JSON.parse(data) as HostMessage; return typeof m?.type === 'string' ? m : null; }
  catch { return null; }
}

// ── Transport ───────────────────────────────────────────────────────────────

/** One ordered text channel to a peer. Implementations: WebSocket, memory pair. */
export interface NetChannel {
  /** Queue a JSON-encoded message; drops silently when closed. */
  send(data: string): void;
  onMessage: ((data: string) => void) | null;
  onClose: (() => void) | null;
  readonly ready: boolean;
  close(): void;
}
