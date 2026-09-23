/** World events (WoW Scourge Invasion): persistent schedule + per-tick runtime.
 * A seeded clock (`nextAt`) fires invasions on the world, not the player: each
 * event owns a zone, a probed necropolis anchor, a bounded guardian roster and a
 * boss. Progress survives save/load exactly — guardians mirror live actors by
 * campMemberId, the same convention as poi-content's trials.
 *
 * Integration: Simulation.step calls `advanceWorldEvents(this, dt, this.spawnExclusion, e => this.emit(e))`
 * once per fixed step (overworld only), and the kill path calls `worldEventOnKill`
 * (world-event-command.ts), which wraps `recordWorldEventKill` with rep + chat.
 * `worldEvents` rides the checkpoint as `worldEvents` (see world-event-command.ts). */
import { GAME_FEATURES } from './game-features.ts';
import type { CombatEvent, Enemy, EnemyKind, Player, WorldQuery } from './model.ts';
import type { CampSpawnSource } from './camp-population.ts';
import type { Simulation } from './simulation.ts';
import type { SpawnExclusion } from './spawn-visibility.ts';
import { isSpawnHidden } from './spawn-visibility.ts';
import { encounterApproaches } from './encounter-approaches.ts';
import { encounterMemberLevel, encounterRewardLevel, encounterScaleAt, validEncounterScale, type EncounterScale } from './encounter-scaling.ts';
import { scaledEnemyStats } from './zone-progression.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { alertEnemy } from './enemy-state.ts';
import { advanceWaves, freshWaves, type WaveProgress } from './wave-system.ts';
import { object, number, integer, text } from './item-validation.ts';
import type { WorldPOI } from './world-pois.ts';
import type { Settlement } from './settlements.ts';
import type { WildernessSite } from './wilderness-sites.ts';
import {
  INVASION_BOSS, INVASION_NAME, WORLD_EVENT_RULES, invasionAnchorHint, invasionBossHp,
  invasionBossLevel, invasionGuardians, invasionSeed, invasionZone, worldEventCampId,
  type InvasionGuardian,
} from './world-event-content.ts';

export type InvasionPhase = 'active' | 'won' | 'claimed' | 'expired';

export interface InvasionEvent {
  readonly id: string;
  readonly index: number;
  readonly seed: number;
  /** Owning district identity for markers and notices. */
  readonly zoneId: string;
  readonly zoneName: string;
  readonly level: number;
  readonly scaling: EncounterScale;
  /** Probed necropolis position; null until the world answers (retried per tick). */
  anchor: { x: number; y: number } | null;
  /** Pre-probe marker position so the map can point before the anchor resolves. */
  readonly hint: { x: number; y: number };
  readonly startedAt: number;
  readonly endsAt: number;
  phase: InvasionPhase;
  waves: WaveProgress;
  guardians: InvasionGuardian[];
  boss: { hp: number; x: number; y: number; admitted: boolean; dead: boolean };
  /** One-shot notice flags; keep chat quiet across reloads. */
  announced: boolean;
  bossAnnounced: boolean;
  wonAnnounced: boolean;
}

export interface WorldEventState {
  /** Sim time of the next invasion start. */
  nextAt: number;
  /** Monotonic schedule counter; seeds zone pick and rosters. */
  index: number;
  active: InvasionEvent | null;
  /** Bounded receipts; 'won' entries stay claimable, newest WON_HISTORY_LIMIT kept. */
  history: InvasionEvent[];
}

export const freshWorldEvents = (): WorldEventState => ({ nextAt: WORLD_EVENT_RULES.firstAt, index: 0, active: null, history: [] });

/** Reads the integrator-added flag; defaults to on until it lands. */
export function worldEventsEnabled(): boolean {
  return 'worldEvents' in GAME_FEATURES ? (GAME_FEATURES as Record<string, unknown>).worldEvents === true : true;
}

/** Simulation carrier: the integrator adds `worldEvents`; lazily installed so
 * headless harnesses work before the field lands. */
export type WorldEventCarrier = { worldEvents?: WorldEventState };
export function worldEventsOf(sim: Simulation): WorldEventState {
  const carrier = sim as unknown as WorldEventCarrier;
  return carrier.worldEvents ??= freshWorldEvents();
}

/** World surface needed to probe anchors and spawn points. */
export interface WorldEventWorld extends WorldQuery {
  sampleWater?(x: number, y: number): { coverage: number };
  getSettlements?(x: number, y: number, width: number, height: number): readonly Settlement[];
  getWildernessSites?(x: number, y: number, width: number, height: number): readonly WildernessSite[];
}

// ── Anchor probing ───────────────────────────────────────────────────────────

/** Open ground: no collision, no deep water, no settlement, no existing site. */
function anchorClear(world: WorldEventWorld, x: number, y: number): boolean {
  if (world.blocked(x, y, 40) || world.isSanctuary?.(x, y)) return false;
  if ((world.sampleWater?.(x, y)?.coverage ?? 0) > .12) return false;
  if (world.getSettlements?.(x - 320, y - 320, 640, 640).some(t => Math.hypot(t.x - x, t.y - y) < t.radius + 220)) return false;
  if (world.getWildernessSites?.(x - 320, y - 320, 640, 640).some(s => Math.hypot(s.x - x, s.y - y) < s.radius + 200)) return false;
  return true;
}

/** Spiral out from the seeded hint; deterministic order, bounded work per call. */
function probeAnchor(world: WorldEventWorld, hint: { x: number; y: number }): { x: number; y: number } | null {
  for (let ring = 0; ring <= 12; ring++) {
    const radius = ring * 160;
    const steps = ring === 0 ? 1 : Math.min(24, ring * 6);
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2 + ring * .7;
      const x = hint.x + Math.cos(angle) * radius, y = hint.y + Math.sin(angle) * radius;
      if (anchorClear(world, x, y)) return { x, y };
    }
  }
  return null;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

function startInvasion(state: WorldEventState, ctx: WorldEventContext): InvasionEvent {
  const index = state.index++;
  const seed = invasionSeed(ctx.worldSeed, index);
  const zone = invasionZone(ctx.worldSeed, index);
  const scaling = encounterScaleAt(zone.x, zone.y, ctx.worldSeed, ctx.playerLevel);
  const event: InvasionEvent = {
    id: `invasion:${index}`, index, seed, zoneId: zone.id, zoneName: zone.name,
    level: encounterRewardLevel(scaling), scaling,
    anchor: null, hint: invasionAnchorHint(ctx.worldSeed, index, zone),
    startedAt: ctx.time, endsAt: ctx.time + WORLD_EVENT_RULES.duration,
    phase: 'active', waves: freshWaves(), guardians: invasionGuardians(seed, scaling),
    boss: { hp: invasionBossHp(scaling), x: 0, y: 0, admitted: false, dead: false },
    announced: false, bossAnnounced: false, wonAnnounced: false,
  };
  return event;
}

/** Retire the active slot; 'won' and 'claimed' records keep their chest claim. */
function archiveEvent(state: WorldEventState, event: InvasionEvent): void {
  state.history.push(event);
  state.active = null;
  // Evict settled receipts first; unclaimed war chests outlive them.
  const settled = state.history.filter(e => e.phase !== 'won');
  while (settled.length > WORLD_EVENT_RULES.historyLimit) {
    const drop = settled.shift()!;
    state.history.splice(state.history.indexOf(drop), 1);
  }
  // 'won' history is still bounded: validWorldEvents rejects oversized history,
  // and an unbounded ledger would let decodeCharacterSave wipe every chest.
  // Beyond the cap the oldest unclaimed chest is forfeited, newest first kept.
  const unclaimed = state.history.filter(e => e.phase === 'won');
  while (unclaimed.length > WON_HISTORY_LIMIT) {
    const drop = unclaimed.shift()!;
    state.history.splice(state.history.indexOf(drop), 1);
  }
}

/** Unclaimed 'won' receipts retained; matches the slack in validWorldEvents. */
const WON_HISTORY_LIMIT = 4;

/** Detach live actors so the normal roamer retirement rules reclaim them. */
function releaseEventActors(event: InvasionEvent, enemies: readonly Enemy[]): void {
  const campId = worldEventCampId(event.id);
  for (const actor of enemies) if (actor.campId === campId) {
    delete actor.campId;
    delete actor.campMemberId;
  }
}

// ── Live-actor sync ──────────────────────────────────────────────────────────

/** Mirror live actors into the durable roster; call before reading progress. */
export function syncWorldEvent(state: WorldEventState, enemies: readonly Enemy[]): void {
  const event = state.active;
  if (!event) return;
  const campId = worldEventCampId(event.id);
  for (const actor of enemies) {
    if (actor.campId !== campId) continue;
    if (actor.campMemberId === 'boss') {
      event.boss.hp = actor.hp; event.boss.x = actor.x; event.boss.y = actor.y;
      if (actor.state === 'dead') event.boss.dead = true;
      continue;
    }
    const guardian = event.guardians[Number(actor.campMemberId)];
    if (guardian) {
      guardian.hp = actor.hp; guardian.x = actor.x; guardian.y = actor.y;
      if (actor.state === 'dead') guardian.dead = true;
    }
  }
}

// ── Spawning ─────────────────────────────────────────────────────────────────

/** Ring posts around the necropolis when they are hidden; viewport-edge approaches otherwise. */
function guardianPlacements(event: InvasionEvent, count: number, world: WorldEventWorld, view: SpawnExclusion, player: Player): { x: number; y: number }[] {
  const anchor = event.anchor!;
  const points: { x: number; y: number }[] = [];
  const clearance = 16;
  for (let i = 0; i < 40 && points.length < count; i++) {
    const angle = (i / 40) * Math.PI * 2 + (event.seed % 97) * .11;
    const ring = WORLD_EVENT_RULES.spawnRingMin + (i % 5) * ((WORLD_EVENT_RULES.spawnRingMax - WORLD_EVENT_RULES.spawnRingMin) / 4);
    const x = anchor.x + Math.cos(angle) * ring, y = anchor.y + Math.sin(angle) * ring * .8;
    if (world.blocked(x, y, clearance) || world.isSanctuary?.(x, y)) continue;
    if (!isSpawnHidden(x, y, view, clearance)) continue;
    if (points.some(p => Math.hypot(p.x - x, p.y - y) < 45)) continue;
    points.push({ x, y });
  }
  if (points.length < count) {
    const approaches = encounterApproaches(world, view, player, anchor, clearance, WORLD_EVENT_RULES.engageRadius);
    for (const p of approaches) {
      if (points.length >= count) break;
      if (points.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 45)) continue;
      points.push({ x: p.x, y: p.y });
    }
  }
  return points;
}

function admitGuardians(event: InvasionEvent, ctx: WorldEventContext): void {
  // Admit up to the live cap: guardians already fighting count against it.
  const live = ctx.enemies.filter(e => e.campId === worldEventCampId(event.id) && e.state !== 'dead').length;
  const missing = event.guardians.map((g, i) => ({ g, i }))
    .filter(({ g }) => g.wave === event.waves.wave && !g.dead && !g.admitted)
    .slice(0, Math.max(0, WORLD_EVENT_RULES.maxConcurrent - live));
  const placements = guardianPlacements(event, missing.length, ctx.world, ctx.view!, ctx.player);
  for (let n = 0; n < missing.length && n < placements.length; n++) {
    const { g, i } = missing[n]!, point = placements[n]!;
    const level = encounterMemberLevel(event.scaling, g.rank, g.seed);
    const enemy = ctx.spawn(g.kind, point.x, point.y, g.rank,
      { campId: worldEventCampId(event.id), memberId: String(i), lootSeed: g.seed, level });
    if (!enemy) continue;
    g.admitted = true; g.x = point.x; g.y = point.y;
    enemy.homeX = point.x; enemy.homeY = point.y;
  }
}

function admitBoss(event: InvasionEvent, ctx: WorldEventContext): void {
  const anchor = event.anchor!;
  const clearance = ENEMY_DEFINITIONS[INVASION_BOSS.kind].radius + 2;
  // Prefer the crystal itself when it is offscreen; otherwise walk in from an edge.
  const candidates = [
    ...[0, 1, 2, 3].map(i => ({ x: anchor.x + Math.cos(i * Math.PI / 2 + .8) * 60, y: anchor.y + Math.sin(i * Math.PI / 2 + .8) * 48 })),
    ...encounterApproaches(ctx.world, ctx.view!, ctx.player, anchor, clearance, WORLD_EVENT_RULES.engageRadius),
  ];
  for (const point of candidates) {
    if (ctx.world.blocked(point.x, point.y, clearance) || ctx.world.isSanctuary?.(point.x, point.y)) continue;
    if (!isSpawnHidden(point.x, point.y, ctx.view!, clearance)) continue;
    const enemy = ctx.spawn(INVASION_BOSS.kind, point.x, point.y, INVASION_BOSS.rank,
      { campId: worldEventCampId(event.id), memberId: 'boss', lootSeed: (event.seed ^ 0xb055) >>> 0, level: invasionBossLevel(event.scaling) });
    if (!enemy) continue;
    enemy.bossPhases = 0;
    enemy.homeX = anchor.x; enemy.homeY = anchor.y;
    event.boss.admitted = true; event.boss.x = point.x; event.boss.y = point.y;
    return;
  }
}



// ── Per-tick driver ──────────────────────────────────────────────────────────

/** Tick context, mirroring TrialContext: the caller owns admission and events. */
export interface WorldEventContext {
  dt: number;
  state: WorldEventState;
  player: Player;
  enemies: Enemy[];
  world: WorldEventWorld;
  view: SpawnExclusion | null;
  time: number;
  worldSeed: number;
  playerLevel: number;
  spawn(kind: Enemy['kind'], x: number, y: number, rank: Enemy['rank'], source: CampSpawnSource): Enemy | null;
  emit(event: CombatEvent): void;
}

/** Fixed-step tick: schedule, anchor probing, wave admission, boss, expiry.
 * `view` is the renderer's spawn exclusion; without it the schedule still runs
 * but nothing materializes (same contract as advanceTrial). */
export function advanceWorldEvents(ctx: WorldEventContext): void {
  if (!worldEventsEnabled()) return;
  const { state, player, enemies, world, view, time } = ctx;
  syncWorldEvent(state, enemies);

  // Schedule: one active slot; a finished or expired event archives on rollover.
  if (!state.active && time >= state.nextAt) {
    const event = startInvasion(state, ctx);
    state.active = event;
    state.nextAt = event.startedAt + WORLD_EVENT_RULES.interval;
  }
  const event = state.active;
  if (!event) return;

  if (!event.anchor) event.anchor = probeAnchor(world, event.hint);
  if (!event.announced) {
    event.announced = true;
    ctx.emit({ type: 'notice', x: player.x, y: player.y,
      message: `${INVASION_NAME} — a necropolis has appeared in ${event.zoneName}!` });
  }

  // Expiry is absolute: the Scourge withdraws on schedule, mid-fight or not.
  if (event.phase === 'active' && time >= event.endsAt) {
    event.phase = 'expired';
    releaseEventActors(event, enemies);
    ctx.emit({ type: 'notice', x: player.x, y: player.y,
      message: `The necropolis over ${event.zoneName} withdraws into the Plaguelands.` });
    archiveEvent(state, event);
    return;
  }

  if (event.phase !== 'active' || !event.anchor) return;
  const engaged = !player.dead && Math.hypot(player.x - event.anchor.x, player.y - event.anchor.y) <= WORLD_EVENT_RULES.engageRadius
    && !world.isSanctuary?.(player.x, player.y);
  if (!engaged || !view) return;

  // The risen dead know where the living are inside the invasion zone.
  const campId = worldEventCampId(event.id);
  for (const enemy of enemies) {
    if (enemy.campId !== campId || enemy.state === 'dead') continue;
    if (enemy.state === 'idle' || enemy.state === 'patrol' || enemy.state === 'return') alertEnemy(enemy, player);
  }

  const current = event.guardians.filter(g => g.wave === event.waves.wave);
  const defeated = current.length > 0 && current.every(g => g.dead);
  advanceWaves(event.waves, { count: WORLD_EVENT_RULES.waveCount, duration: 0, interval: WORLD_EVENT_RULES.waveInterval, hold: 0 },
    ctx.dt, { admitted: current.some(g => g.admitted), defeated, inObjective: true });

  if (!event.waves.finished) {
    if (event.waves.rest <= 0) admitGuardians(event, ctx);
    return;
  }

  if (!event.boss.admitted) {
    admitBoss(event, ctx);
    if (event.boss.admitted && !event.bossAnnounced) {
      event.bossAnnounced = true;
      ctx.emit({ type: 'notice', x: player.x, y: player.y,
        message: `${INVASION_BOSS.name} emerges from the necropolis!` });
      ctx.emit({ type: 'blast', x: event.anchor.x, y: event.anchor.y, radius: 130, duration: .8, color: '#b4a3eb' });
    }
    return;
  }

  if (event.boss.dead) {
    event.phase = 'won';
    if (!event.wonAnnounced) {
      event.wonAnnounced = true;
      ctx.emit({ type: 'notice', x: player.x, y: player.y,
        message: `The ${INVASION_NAME} in ${event.zoneName} has been repelled! A war chest remains.` });
    }
  }
}

// ── Kill hook ────────────────────────────────────────────────────────────────
export function recordWorldEventKill(state: WorldEventState, actor: Pick<Enemy, 'campId' | 'campMemberId'>): boolean {
  const event = state.active;
  if (!event || actor.campId !== worldEventCampId(event.id)) return false;
  if (actor.campMemberId === 'boss') event.boss.dead = true;
  else {
    const guardian = event.guardians[Number(actor.campMemberId)];
    if (guardian) guardian.dead = true;
  }
  return true;
}

/** Trial-style AI context so invasion mobs pursue across the whole zone instead
 * of the ordinary 650-unit tether. Merge into EnemyAIContext.trial when no POI
 * trial is active. */
export function worldEventTrialContext(state: WorldEventState): { campId: string; x: number; y: number; radius: number } | null {
  const event = state.active;
  if (!event || event.phase !== 'active' || !event.anchor) return null;
  return { campId: worldEventCampId(event.id), x: event.anchor.x, y: event.anchor.y, radius: WORLD_EVENT_RULES.tetherRadius };
}

// ── Read models ──────────────────────────────────────────────────────────────

/** HUD/map projection of an invasion; never advances state. */
export interface WorldEventProgress {
  event: InvasionEvent; timer: string; label: string; fraction: number;
  bossPhase: boolean; kills: number; total: number;
}

export function worldEventProgress(state: WorldEventState, time: number): WorldEventProgress | null {
  const event = state.active;
  if (!event) return null;
  const kills = event.guardians.filter(g => g.dead).length;
  const total = event.guardians.length;
  const remaining = Math.max(0, event.endsAt - time);
  const timer = `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, '0')}`;
  const bossPhase = event.waves.finished;
  const label = event.phase === 'won' ? 'War chest secured — claim your reward'
    : event.phase === 'claimed' ? 'Invasion repelled'
    : bossPhase ? (event.boss.dead ? 'Commander defeated' : `Defeat ${INVASION_BOSS.name}`)
    : `Wave ${Math.min(event.waves.wave + 1, WORLD_EVENT_RULES.waveCount)}/${WORLD_EVENT_RULES.waveCount} · Scourge slain: ${kills}/${total}`;
  const fraction = event.phase === 'won' || event.phase === 'claimed' ? 1
    : bossPhase ? (event.boss.admitted ? 1 - event.boss.hp / Math.max(1, invasionBossHp(event.scaling)) : 1)
    : total ? kills / total : 0;
  return { event, timer, label, fraction: Math.max(0, Math.min(1, fraction)), bossPhase, kills, total };
}

/** Map marker for a necropolis or its war chest; `kind` is 'necropolis', which
 * the integrator adds to POI_DEFINITIONS so world-map/minimap render it. */
export interface WorldEventMarker extends Omit<WorldPOI, 'kind'> { kind: 'necropolis' }

/** Map/minimap markers: the active necropolis plus any unclaimed war chests. */
export function worldEventMapMarkers(state: WorldEventState, time: number): WorldEventMarker[] {
  const markers: WorldEventMarker[] = [];
  const event = state.active;
  if (event && event.phase === 'active') {
    const at = event.anchor ?? event.hint;
    const remaining = Math.max(0, event.endsAt - time);
    markers.push({ id: event.id, name: `${INVASION_NAME}: ${event.zoneName}`, kind: 'necropolis', x: at.x, y: at.y,
      description: `Level ${event.level} · ${Math.ceil(remaining / 60)}m remaining` });
  }
  for (const past of [event, ...state.history]) {
    if (past && past.phase === 'won' && past.anchor)
      markers.push({ id: `${past.id}:chest`, name: 'Scourge War Chest', kind: 'necropolis', x: past.anchor.x, y: past.anchor.y,
        description: `Level ${past.level} · Reward waiting` });
  }
  return markers;
}

/** The claimable war chest under the player's feet, if any. */
export function worldEventChestAt(state: WorldEventState, player: Pick<Player, 'x' | 'y' | 'dead'>): InvasionEvent | null {
  if (player.dead) return null;
  for (const event of [state.active, ...state.history]) {
    if (event?.phase === 'won' && event.anchor
      && Math.hypot(player.x - event.anchor.x, player.y - event.anchor.y) <= WORLD_EVENT_RULES.reach) return event;
  }
  return null;
}

// ── Checkpoint validation ────────────────────────────────────────────────────

const RANKS = ['normal', 'veteran', 'elite', 'rare'];
const PHASES: readonly InvasionPhase[] = ['active', 'won', 'claimed', 'expired'];

function validGuardian(v: unknown, event: InvasionEvent): boolean {
  if (!object(v) || !integer(v.wave, 0, WORLD_EVENT_RULES.waveCount - 1)) return false;
  const kind = String(v.kind) as EnemyKind;
  if (!Object.hasOwn(ENEMY_DEFINITIONS, kind) || !RANKS.includes(String(v.rank))) return false;
  const level = encounterMemberLevel(event.scaling, v.rank as InvasionGuardian['rank'], Number(v.seed));
  return integer(v.seed, 0, 4294967295)
    && number(v.hp, 0, scaledEnemyStats(kind, level, v.rank as InvasionGuardian['rank']).maxHp)
    && number(v.x, -4e7, 4e7) && number(v.y, -4e7, 4e7)
    && typeof v.admitted === 'boolean' && typeof v.dead === 'boolean'
    && (v.dead ? v.admitted && v.hp === 0 : true);
}

function validInvasion(v: unknown, active: boolean): v is InvasionEvent {
  if (!object(v) || !text(v.id, 60) || !String(v.id).startsWith('invasion:')) return false;
  if (!integer(v.index, 0, 1e6) || !integer(v.seed, 0, 4294967295) || !text(v.zoneId, 120) || !text(v.zoneName, 120)) return false;
  if (!integer(v.level, 1, 1e6) || !validEncounterScale(v.scaling)) return false;
  if (v.anchor !== null && !(object(v.anchor) && number(v.anchor.x, -4e7, 4e7) && number(v.anchor.y, -4e7, 4e7))) return false;
  if (!object(v.hint) || !number(v.hint.x, -4e7, 4e7) || !number(v.hint.y, -4e7, 4e7)) return false;
  if (!number(v.startedAt, 0, 1e9) || !number(v.endsAt, 0, 1e9) || Number(v.endsAt) <= Number(v.startedAt)) return false;
  if (!PHASES.includes(v.phase as InvasionPhase)) return false;
  if (active && v.phase !== 'active' && v.phase !== 'won') return false;
  const w = v.waves;
  if (!object(w) || !integer(w.wave, 0, WORLD_EVENT_RULES.waveCount) || !integer(w.cleared, 0, WORLD_EVENT_RULES.waveCount)
    || !number(w.elapsed, 0, 1e9) || !number(w.rest, 0, WORLD_EVENT_RULES.waveInterval)
    || !number(w.held, 0, 1) || typeof w.started !== 'boolean' || typeof w.finished !== 'boolean') return false;
  if (!Array.isArray(v.guardians) || !v.guardians.length || v.guardians.length > 64) return false;
  const event = v as unknown as InvasionEvent;
  if (!v.guardians.every(g => validGuardian(g, event))) return false;
  const b = v.boss;
  if (!object(b) || !number(b.hp, 0, invasionBossHp(event.scaling)) || !number(b.x, -4e7, 4e7) || !number(b.y, -4e7, 4e7)
    || typeof b.admitted !== 'boolean' || typeof b.dead !== 'boolean') return false;
  if (b.dead && !b.admitted) return false;
  if (v.phase === 'won' && !b.dead) return false;
  return typeof v.announced === 'boolean' && typeof v.bossAnnounced === 'boolean' && typeof v.wonAnnounced === 'boolean';
}

/** Host console is optional in the headless core build; the reset notice degrades to silence there. */
const hostConsole = globalThis as { console?: { warn(...args: unknown[]): void } };

/** Checkpoint validator for `checkpoint.worldEvents`; wire into decodeCharacterSave. */
export function validWorldEvents(v: unknown): v is WorldEventState {
  if (!checkWorldEvents(v)) {
    // decodeCharacterSave resets to freshWorldEvents on rejection — never silent.
    if (v !== undefined) hostConsole.console?.warn('Stored world-event state failed validation; the invasion schedule resets and unclaimed war chests are lost.');
    return false;
  }
  return true;
}

function checkWorldEvents(v: unknown): v is WorldEventState {
  if (!object(v) || !number(v.nextAt, 0, 1e9) || !integer(v.index, 0, 1e6)) return false;
  if (v.active !== null && !validInvasion(v.active, true)) return false;
  if (!Array.isArray(v.history) || v.history.length > WORLD_EVENT_RULES.historyLimit + WON_HISTORY_LIMIT) return false;
  if (!v.history.every(e => validInvasion(e, false))) return false;
  const ids = new Set<string>();
  for (const e of [v.active, ...v.history] as (InvasionEvent | null)[]) {
    if (!e) continue; // no active invasion — nothing to dedupe
    if (ids.has(e.id)) return false;
    ids.add(e.id);
  }
  return true;
}
