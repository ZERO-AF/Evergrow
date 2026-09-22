/** World boss runtime (world-boss-content.ts owns the defs, world-boss-state.ts
 * the respawn ledger).
 *
 * Admission: each def owns a seeded lair inside its authored atlas zone. When
 * the ledger says the boss is alive and the player closes within
 * `activationDistance`, the boss and its escort materialize at the lair —
 * hidden-spawn gated like every other admission path. Live actors carry
 * `campId: 'event:world-boss:<id>'` so CampPopulation never adopts them into a
 * cleared-once camp record; the ledger owns their lifecycle instead.
 *
 * Death: `worldBossOnKill` stamps `killedAt`, bursts the epic-biased loot
 * table onto the ground, rolls the rare mount/companion drop, and feeds the
 * 'worldBoss' achievement event. */
import { enemyMovementMultiplier } from './enemy-modifiers.ts';
import { BOSS_PRESSURE, bossQuickMove, updateBossPressure } from './boss-pressure.ts';
import { enemyRecoveryDuration, enemyWindupDuration } from './enemy-threat.ts';
import type { CombatEvent, Enemy, Player, WorldQuery } from './model.ts';
import type { EnemyAIContext } from './enemy-ai.ts';
import type { CampSpawnSource } from './camp-population.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { alertEnemy, transitionEnemy } from './enemy-state.ts';
import { circleIntersectsSector, segmentDistanceSquared } from './combat-geometry.ts';
import { LAIR_RULES as R } from './wilderness-boss-content.ts';
import { isSpawnHidden, type SpawnExclusion } from './spawn-visibility.ts';
import { getZoneAt } from './zone-progression.ts';
import { pathDistance } from './road-shape.ts';
import { type WildernessSite } from './wilderness-sites.ts';
import type { Settlement } from './settlements.ts';
import type { WorldPOI } from './world-pois.ts';
import type { GroundItem } from './character-types.ts';
import type { GroundGold } from './gold.ts';
import { dropGold, rollEnemyGold } from './gold.ts';
import { rollEnemyLoot } from './loot.ts';
import { addGroundItem } from './ground-loot.ts';
import { treasureLanding } from './treasure-flight.ts';
import { grantMount } from './mount-state.ts';
import { MOUNTS } from './mount-content.ts';
import { grantCompanion } from './companion-state.ts';
import { COMPANIONS } from './companion-content.ts';
import { achievementTrack } from './achievement-state.ts';
import type { AchievementDef } from './achievement-content.ts';
import {
  WORLD_BOSSES, WORLD_BOSS_IDS, WORLD_BOSS_MEMBER_ID, WORLD_BOSS_RULES,
  worldBossAnchor, worldBossByCampId, worldBossCampId, worldBossGuardId,
  worldBossLootSeed, worldBossRareRoll,
  type WorldBossAbility, type WorldBossDef,
} from './world-boss-content.ts';
import { recordWorldBossKill, worldBossAlive, type WorldBossLedger } from './world-boss-state.ts';

/** World surface needed to seat a lair: collision plus optional water,
 * settlement and site queries (the same shape world events probe with). */
export interface WorldBossWorld extends WorldQuery {
  sampleWater?(x: number, y: number): { coverage: number };
  getSettlements?(x: number, y: number, width: number, height: number): readonly Settlement[];
  getWildernessSites?(x: number, y: number, width: number, height: number): readonly WildernessSite[];
}

// ── Lair resolution ──────────────────────────────────────────────────────────

/** Open ground inside the def's authored zone: no collision, no deep water,
 * no road, no settlement, no existing site. */
function lairClear(world: WorldBossWorld, worldSeed: number, def: WorldBossDef, x: number, y: number): boolean {
  if (getZoneAt(x, y, worldSeed).id !== `atlas:${def.zoneId}`) return false;
  if (world.blocked(x, y, 60) || world.isSanctuary?.(x, y)) return false;
  if ((world.sampleWater?.(x, y)?.coverage ?? 0) > .12) return false;
  if (pathDistance(x, y, worldSeed) < 300) return false;
  if (world.getSettlements?.(x - 480, y - 480, 960, 960).some(t => Math.hypot(t.x - x, t.y - y) < t.radius + 420)) return false;
  if (world.getWildernessSites?.(x - 480, y - 480, 960, 960).some(s => Math.hypot(s.x - x, s.y - y) < s.radius + 380)) return false;
  return true;
}

/** Spiral out from the authored anchor; deterministic order, bounded work.
 * Returns null only when the zone cannot seat the boss (bad def or a world
 * without the atlas). */
function resolveWorldBossLair(def: WorldBossDef, world: WorldBossWorld, worldSeed: number): { x: number; y: number } | null {
  const anchor = worldBossAnchor(def);
  if (!anchor) return null;
  for (let ring = 0; ring <= 14; ring++) {
    const radius = ring * 220;
    const steps = ring === 0 ? 1 : Math.min(24, ring * 6);
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2 + ring * .7;
      const x = anchor.x + Math.cos(angle) * radius, y = anchor.y + Math.sin(angle) * radius;
      if (lairClear(world, worldSeed, def, x, y)) return { x, y };
    }
  }
  return null;
}

export function worldBossLair(def: WorldBossDef, world: WorldBossWorld, worldSeed: number): { x: number; y: number } | null {
  let memo = lairMemo.get(world);
  if (!memo) lairMemo.set(world, memo = new Map());
  const key = `${worldSeed}:${def.id}`;
  if (!memo.has(key)) memo.set(key, resolveWorldBossLair(def, world, worldSeed));
  return memo.get(key)!;
}

/** Map marker for a resolved lair; null while the world cannot seat it. */
export function worldBossPOI(def: WorldBossDef, world: WorldBossWorld, worldSeed: number): WorldPOI | null {
  const lair = worldBossLair(def, world, worldSeed);
  return lair && { id: `world-boss:${def.id}`, name: def.name, kind: 'bossLair', x: lair.x, y: lair.y, description: def.description };
}

// ── Admission ────────────────────────────────────────────────────────────────

/** Tick context, mirroring WorldEventContext: the caller owns the ledger,
 * spawn callback and event sink. */
export interface WorldBossContext {
  state: WorldBossLedger;
  player: Pick<Player, 'x' | 'y' | 'dead'>;
  enemies: Enemy[];
  world: WorldBossWorld;
  view: SpawnExclusion | null;
  time: number;
  worldSeed: number;
  spawn(kind: Enemy['kind'], x: number, y: number, rank: Enemy['rank'], source: CampSpawnSource): Enemy | null;
  emit(event: CombatEvent): void;
}
/** Lair seats are pure functions of (world, seed, def); the spiral probe is
 * memoized per world instance so the per-tick admission pass stays cheap. */
const lairMemo = new WeakMap<WorldBossWorld, Map<string, { x: number; y: number } | null>>();


function admitMember(ctx: WorldBossContext, def: WorldBossDef, memberId: string, kind: Enemy['kind'],
  rank: Enemy['rank'], level: number, x: number, y: number, home: { x: number; y: number }): Enemy | null {
  const clearance = ENEMY_DEFINITIONS[kind].radius + 2;
  if (ctx.world.blocked(x, y, clearance) || ctx.world.isSanctuary?.(x, y)) return null;
  if (!isSpawnHidden(x, y, ctx.view, clearance)) return null;
  const enemy = ctx.spawn(kind, x, y, rank,
    { campId: worldBossCampId(def.id), memberId, lootSeed: worldBossLootSeed(ctx.worldSeed, def.id), level });
  if (!enemy) return null;
  enemy.homeX = home.x; enemy.homeY = home.y;
  return enemy;
}

/** Fixed-step admission: off-cooldown bosses stand at their lairs while the
 * player is near. The escort materializes with its boss; dead guards stay
 * down until the boss's own respawn brings the whole encounter back. */
export function updateWorldBosses(ctx: WorldBossContext): void {
  const { state, player, enemies, world, time } = ctx;
  if (player.dead || world.isSanctuary?.(player.x, player.y)) return;
  for (const id of WORLD_BOSS_IDS) {
    const def = WORLD_BOSSES[id];
    if (!worldBossAlive(state, id, time)) continue;
    const campId = worldBossCampId(id);
    if (enemies.some(e => e.campId === campId && e.campMemberId === WORLD_BOSS_MEMBER_ID && e.state !== 'dead')) continue;
    // Cheap authored-anchor gate before the memoized lair probe: a boss far
    // from the player never touches collision, so idle ticks stay free.
    const anchor = worldBossAnchor(def);
    if (!anchor || Math.hypot(player.x - anchor.x, player.y - anchor.y) > WORLD_BOSS_RULES.activationDistance + 3200) continue;
    const lair = worldBossLair(def, world, ctx.worldSeed);
    if (!lair || Math.hypot(player.x - lair.x, player.y - lair.y) > WORLD_BOSS_RULES.activationDistance) continue;
    const boss = admitMember(ctx, def, WORLD_BOSS_MEMBER_ID, def.kind, 'elite', def.level, lair.x, lair.y, lair);
    if (!boss) continue;
    boss.bossPhases = 0;
    ctx.emit({ type: 'notice', x: lair.x, y: lair.y, message: `${def.name}, ${def.title}, stirs at its lair!` });
    ctx.emit({ type: 'blast', x: lair.x, y: lair.y, radius: 120, duration: .8, color: def.palette });
    for (let i = 0; i < def.guards.length; i++) {
      const guard = def.guards[i]!;
      admitMember(ctx, def, worldBossGuardId(i), guard.kind, guard.rank, Math.max(1, def.level - 2),
        lair.x + guard.dx, lair.y + guard.dy, lair);
    }
  }
}

// ── Boss AI ──────────────────────────────────────────────────────────────────

/** True for the boss actor itself; guards keep their ordinary AI. */
export const isWorldBossActor = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  !!worldBossByCampId(e.campId) && e.campMemberId === WORLD_BOSS_MEMBER_ID;

const abilityFor = (def: WorldBossDef, move: Enemy['bossMove']): WorldBossAbility =>
  def.abilities.find(a => a.move === move) ?? def.abilities[0]!;

/** A ranged fallback when the committed melee move cannot reach or a rally
 * has no living escort left. */
const rangedAbility = (def: WorldBossDef): WorldBossAbility =>
  def.abilities.find(a => a.move === 'eruption' || a.move === 'fracture') ?? def.abilities[0]!;

/** Same commitment contract as updateWildernessBoss — warning geometry is
 * fixed before release; the def's ability cycle supplies order and school. */
export function updateWorldBoss(e: Enemy, dt: number, c: EnemyAIContext): void {
  const def = worldBossByCampId(e.campId);
  if (!def || e.campMemberId !== WORLD_BOSS_MEMBER_ID) return;
  const p = c.player, d = Math.hypot(p.x - e.x, p.y - e.y), angle = Math.atan2(p.y - e.y, p.x - e.x), stats = ENEMY_DEFINITIONS[e.kind];
  const walk = (x: number, y: number, speed: number) => {
    speed *= enemyMovementMultiplier(e);
    const target = c.world.navigationTarget?.(e.x, e.y, x, y, e.radius + 1) ?? { x, y };
    const length = Math.hypot(target.x - e.x, target.y - e.y);
    if (length > .5) { e.angle = Math.atan2(target.y - e.y, target.x - e.x); c.move(e, (target.x - e.x) / length * speed, (target.y - e.y) / length * speed, dt); }
  };
  if (p.dead || c.world.isSanctuary?.(p.x, p.y) || Math.hypot(p.x - e.homeX, p.y - e.homeY) > WORLD_BOSS_RULES.leash || Math.hypot(e.x - e.homeX, e.y - e.homeY) > WORLD_BOSS_RULES.leash) {
    if (e.state !== 'return') { transitionEnemy(e, 'return'); e.bossMove = undefined; e.awareness = 0; e.burnTime = 0; e.slowTime = 0; }
  }
  if (e.state === 'return') {
    if (Math.hypot(e.x - e.homeX, e.y - e.homeY) < 12) { e.hp = e.maxHp; e.bossPhases = 0; e.bossTurns = 0; transitionEnemy(e, 'idle', 1); }
    else walk(e.homeX, e.homeY, stats.speed * 1.5);
    return;
  }
  if (e.state === 'idle' || e.state === 'patrol') {
    if (d < WORLD_BOSS_RULES.awareness && c.visible(e.x, e.y, p.x, p.y) || e.awareness >= 1) alertEnemy(e, p); else return;
  }
  if (e.awareness >= 1) for (const guard of c.enemies) if (guard !== e && guard.hp > 0 && guard.campId === e.campId) alertEnemy(guard, p);
  if (e.interrupted) { e.interrupted = false; }
  if (e.state === 'recover') { if (e.stateTime >= e.stateDuration) transitionEnemy(e, 'chase'); return; }
  if (updateBossPressure(e, c)) return;
  if (e.state === 'chase') {
    e.angle = angle; e.seesPlayer = c.visible(e.x, e.y, p.x, p.y);
    if (!e.seesPlayer || d > 360) { walk(p.x, p.y, stats.speed * (e.slowTime > 0 ? e.slowFactor : 1)); return; }
    const phase = e.hp / e.maxHp <= .5;
    const turns = e.bossTurns ?? 0;
    let ability = turns % 2 ? null : def.abilities[Math.floor(turns / 2) % def.abilities.length]!;
    let move: Enemy['bossMove'] = ability ? ability.move : bossQuickMove(d, p.radius);
    if (move === 'sweep' && d > R.sweepReach + 10) ability = rangedAbility(def), move = ability.move;
    if (move === 'command' && !c.enemies.some(guard => guard !== e && guard.hp > 0 && guard.campId === e.campId
      && Math.hypot(guard.x - e.x, guard.y - e.y) < R.rallyRadius)) ability = rangedAbility(def), move = ability.move;
    if (phase && !e.bossPhases) c.emit({ type: 'blast', x: e.x, y: e.y - 35, radius: 110, duration: .7, color: def.palette });
    e.bossPhases = Number(phase); e.bossTurns = turns + 1; e.bossMove = move; e.bossHits = 0;
    e.bossOriginX = e.x; e.bossOriginY = e.y; e.attackAngle = angle;
    e.attackTargetX = p.x; e.attackTargetY = p.y;
    const quick = move === 'jab' || move === 'bolt' ? BOSS_PRESSURE[move] : null;
    e.attackDamage = e.damage * (quick?.damage ?? ability!.damage);
    transitionEnemy(e, 'windup', enemyWindupDuration(e, quick?.windup ?? (move === 'sweep' ? .85 : move === 'rush' ? 1 : 1.15)));
    return;
  }
  if (e.state === 'windup') {
    if (e.stateTime < e.stateDuration) return;
    transitionEnemy(e, 'attack', e.bossMove === 'rush' ? .55 : e.bossMove === 'fracture' ? .7 : e.bossMove === 'eruption' ? 1.4 : .28);
    c.emit({ type: 'blast', x: e.bossMove === 'eruption' ? e.attackTargetX : e.x, y: e.bossMove === 'eruption' ? e.attackTargetY : e.y,
      radius: e.bossMove === 'eruption' ? R.eruptionRadius : 70, duration: .45, color: def.palette });
    if (e.bossMove === 'command') for (const guard of c.enemies) if (guard !== e && guard.hp > 0 && guard.campId === e.campId && Math.hypot(guard.x - e.x, guard.y - e.y) < R.rallyRadius) { guard.rallyTime = R.rallyDuration; alertEnemy(guard, p); }
  }
  if (e.state !== 'attack') return;
  const ability = abilityFor(def, e.bossMove);
  let hit = false;
  if (e.bossMove === 'sweep') hit = circleIntersectsSector(p.x, p.y, p.radius, e.x, e.y, e.attackAngle, R.sweepReach, R.sweepArc);
  if (e.bossMove === 'rush') {
    const x = e.x, y = e.y; c.move(e, Math.cos(e.attackAngle) * R.rushLength / .55, Math.sin(e.attackAngle) * R.rushLength / .55, dt);
    hit = segmentDistanceSquared(p.x, p.y, x, y, e.x, e.y) < (R.rushWidth + p.radius) ** 2;
  }
  if (e.bossMove === 'eruption') hit = Math.hypot(p.x - e.attackTargetX, p.y - e.attackTargetY) < R.eruptionRadius + p.radius;
  if (e.bossMove === 'fracture') for (let i = 0; i < 3; i++) {
    if (e.stateTime < i * .2 || ((e.bossHits ?? 0) & 1 << i)) continue;
    e.bossHits = (e.bossHits ?? 0) | 1 << i;
    const a = e.attackAngle + (i - 1) * .55, ox = e.bossOriginX!, oy = e.bossOriginY!;
    c.emit({ type: 'blast', x: ox + Math.cos(a) * 180, y: oy + Math.sin(a) * 180, radius: 48, duration: .4, color: def.palette });
    hit ||= segmentDistanceSquared(p.x, p.y, ox, oy, ox + Math.cos(a) * R.fractureLength, oy + Math.sin(a) * R.fractureLength) < (R.fractureWidth + p.radius) ** 2;
  }
  if (hit && !e.attackHit && c.visible(e.x, e.y, p.x, p.y)) { e.attackHit = true; c.hurt(e.attackDamage ?? e.damage * ability.damage, e.attackAngle, e, ability.damageType); }
  if (e.stateTime >= e.stateDuration) transitionEnemy(e, 'recover', enemyRecoveryDuration(e, e.bossMove === 'command' ? 1.5 : e.bossPhases ? .75 : 1.2));
}

// ── Kill hook ────────────────────────────────────────────────────────────────

export interface WorldBossKillContext {
  ledger: WorldBossLedger;
  player: Player;
  enemies: readonly Enemy[];
  /** Kill-loot flight needs the world for landing spots and the clock for arcs. */
  world?: WorldQuery;
  /** Sim time — stamps the respawn cooldown and the deterministic rare roll. */
  time: number;
  groundItems: GroundItem[];
  groundGold: GroundGold[];
  nextId(): number;
  emit(event: CombatEvent): void;
  /** Wall-clock ms for achievement stamps; defaults to Date.now(). */
  now?: number;
}

/** Called once when a world boss actor dies: stamps the respawn ledger,
 * drops the epic loot table, rolls the rare mount/companion, and feeds the
 * achievement event. Returns the defs unlocked so the caller can toast them. */
export function worldBossOnKill(actor: Pick<Enemy, 'campId' | 'campMemberId' | 'kind' | 'rank' | 'level' | 'biome' | 'lootSeed' | 'x' | 'y'>,
  ctx: WorldBossKillContext): AchievementDef[] {
  const def = worldBossByCampId(actor.campId);
  if (!def || actor.campMemberId !== WORLD_BOSS_MEMBER_ID) return [];
  if (!recordWorldBossKill(ctx.ledger, def.id, ctx.time)) return [];
  const unlocked: AchievementDef[] = [];
  let index = 0;
  const flight = (i: number) => {
    if (!ctx.world) return undefined;
    const landing = treasureLanding(ctx.world, actor.x, actor.y, i, actor.lootSeed);
    return { landing, flight: { x: actor.x, y: actor.y, at: ctx.time, delay: i * .07 } };
  };
  for (let roll = 0; roll < def.loot.rolls; roll++)
    for (const item of rollEnemyLoot({ playerLevel: ctx.player.level, seed: (actor.lootSeed ^ Math.imul(roll + 1, 0x9e3779b9)) >>> 0,
      level: actor.level, rank: actor.rank, tierWeights: WORLD_BOSS_RULES.tierWeights,
      biome: actor.biome, kind: actor.kind, encounter: 'boss', classId: ctx.player.character.classId })) {
      const arc = flight(index++);
      addGroundItem(ctx.groundItems, { id: ctx.nextId(), x: arc?.landing.x ?? actor.x, y: arc?.landing.y ?? actor.y,
        item, ...(arc ? { flight: arc.flight } : {}) });
    }
  const gold = Math.round(rollEnemyGold(actor.lootSeed ^ 0x51ed, actor.level, actor.rank) * 8);
  if (gold) {
    const arc = flight(index++);
    dropGold(ctx.groundGold, { id: ctx.nextId(), x: arc?.landing.x ?? actor.x, y: arc?.landing.y ?? actor.y,
      amount: gold, age: 0, ...(arc ? { flight: arc.flight } : {}) });
  }
  if (worldBossRareRoll(def, ctx.time)) {
    const rare = def.loot.rare;
    const label = rare.kind === 'mount' ? MOUNTS[rare.id].name : COMPANIONS[rare.id].name;
    const granted = rare.kind === 'mount' ? grantMount(ctx.player, rare.id, ctx.now) : grantCompanion(ctx.player, rare.id, ctx.now).unlocked;
    unlocked.push(...granted);
    ctx.emit({ type: 'notice', x: actor.x, y: actor.y, message: `${def.name} drops ${label}!` });
  }
  unlocked.push(...achievementTrack(ctx.player, { type: 'worldBoss', id: def.id }, ctx.enemies, ctx.now));
  return unlocked;
}
