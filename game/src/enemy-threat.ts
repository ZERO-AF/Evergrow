import { enemyModifiers } from './enemy-modifiers.ts';
import { enemyHasteFactor } from './enemy-buffs.ts';
import { basicAttackWeapon } from './equipment.ts';
import { ALLY_TEMPLATES } from './wow-allies.ts';
import type { Ally, Enemy, EnemyKind, Player } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import { isBossKind } from './wilderness-boss-content.ts';

/** Rank pressure and control recovery; individual attack recipes own warnings and damage ratios. */
export const ENEMY_THREAT = Object.freeze({
  normal: Object.freeze({ damage: 1, recovery: 1, controlFactor: 1, controlMaximum: Infinity, controlRest: 0, knockback: 1 }),
  veteran: Object.freeze({ damage: 1, recovery: 1, controlFactor: .8, controlMaximum: 1, controlRest: 3.5, knockback: .65 }),
  elite: Object.freeze({ damage: 1.25, recovery: .65, controlFactor: .5, controlMaximum: .6, controlRest: 4, knockback: .35 }),
  rare: Object.freeze({ damage: 1.25, recovery: .6, controlFactor: .4, controlMaximum: .5, controlRest: 3.5, knockback: .25 }),
  boss: Object.freeze({ damage: 1.25, recovery: .65, controlFactor: .25, controlMaximum: .35, controlRest: 2.5, knockback: .15 }),
});
export function enemyThreat(enemy: { kind: EnemyKind; rank: EnemyRank; lootSeed?:number }) {
  const base=ENEMY_THREAT[isBossKind(enemy.kind) ? 'boss' : enemy.rank],mods=enemyModifiers(enemy);
  return mods.length ? {...base,controlFactor:base.controlFactor*mods.reduce((n,m)=>n*m.control,1)} : base;
}
export function enemyRecoveryDuration(enemy: Pick<Enemy, 'kind' | 'rank'> & Partial<Pick<Enemy,'lootSeed'|'buffs'>>, authored: number): number {
  return authored * enemyThreat(enemy).recovery * enemyModifiers(enemy).reduce((n,m)=>n*m.recovery,1) / enemyHasteFactor(enemy);
}

/** Small additive delays vary each actor's rhythm without shortening any warning.
 * No shared attack slots, simulation RNG consumption or level-based speed scaling. */
export function enemyRhythmDelay(enemy: Pick<Enemy,'lootSeed'|'attackTurns'|'bossTurns'>): number {
  let n = Math.imul(enemy.lootSeed ^ Math.imul((enemy.bossTurns ?? enemy.attackTurns ?? 0) + 1, 0x9E3779B9), 0x45d9f3b);
  n = Math.imul(n ^ n >>> 16, 0x45d9f3b);
  return ((n ^ n >>> 16) >>> 0) / 4294967296 * .12;
}
export function enemyWindupDuration(enemy: Pick<Enemy,'lootSeed'|'attackTurns'|'bossTurns'|'buffs'>, authored: number): number {
  return (authored + enemyRhythmDelay(enemy)) / enemyHasteFactor(enemy);
}

// ── Threat tables ────────────────────────────────────────────────────────────
/** One bucket per combatant on an enemy's table: `player:<id>` per co-op player
 * (legacy bare 'player' reads as player id 0) or one `ally:<id>` per pet/summon. */
export type ThreatSource = 'player' | `player:${number}` | `ally:${number}`;

/** The bucket a player's damage accrues to; unidentified players share id 0. */
export function playerThreatSource(player: Player): ThreatSource {
  return `player:${player.id ?? 0}`;
}

/** The player a `player:<id>` source names; bare 'player' resolves to id 0.
 * Falls back to the first roster entry so a missing id never orphans aggro. */
export function threatPlayer(players: readonly Player[], source: ThreatSource): Player | undefined {
  if (source === 'player') return players.find(p => (p.id ?? 0) === 0) ?? players[0];
  if (!source.startsWith('player:')) return undefined;
  const id = Number(source.slice(7));
  return players.find(p => (p.id ?? 0) === id);
}

export const THREAT_RULES = Object.freeze({
  /** WoW pull thresholds: melee pulls aggro at 110%, ranged at 130%. */
  meleePull: 1.1,
  rangedPull: 1.3,
  /** Taunt on an empty table still puts the taunter on it. */
  tauntFloor: 1,
  /** Healing generates threat at half rate, split across engaged enemies. */
  healFactor: .5,
  /** Out-of-combat decay: fraction of remaining threat lost per second. */
  decayPerSecond: .25,
});

/** Live threat state for one enemy. `holder` is the aggro target — it persists
 * until a challenger beats it by the pull threshold, so enemies don't ping-pong
 * on every point of damage. */
export interface ThreatTable {
  entries: Map<ThreatSource, number>;
  holder?: ThreatSource;
  /** Last observed taunt, for application/refresh detection. */
  taunt?: { allyId?: number; playerId?: number; remaining: number };
}

/** Tables are transient combat state: keyed on the live enemy object so dead or
 * despawned enemies release theirs, and never serialized (a restored enemy
 * starts idle with an empty table, matching its reset awareness). */
let tables = new WeakMap<Enemy, ThreatTable>();

/** Drop every table (new game / zone reset). */
export function resetThreatTables(): void {
  tables = new WeakMap();
}

function tableFor(enemy: Enemy): ThreatTable {
  let table = tables.get(enemy);
  if (!table) { table = { entries: new Map() }; tables.set(enemy, table); }
  return table;
}

/** The enemy's live table; dead enemies report none and release it on access. */
export function threatTable(enemy: Enemy): ThreatTable | undefined {
  const table = tables.get(enemy);
  if (table && (enemy.state === 'dead' || enemy.hp <= 0)) { tables.delete(enemy); return undefined; }
  return table;
}

/** Record threat from a confirmed hit. Damage accrues 1:1 to its source.
 * Periodic ticks carry no attacker, so they split across the enemy's live DoTs
 * by ownership — the same attribution the meter used. */
export function recordThreat(enemy: Enemy, source: ThreatSource, amount: number, periodic = false): void {
  if (!(amount > 0) || enemy.state === 'dead') return;
  if (periodic) {
    const dots = enemy.dots?.filter(d => d.dps > 0) ?? [];
    const total = dots.reduce((n, d) => n + d.dps, 0);
    if (total <= 0) { recordThreat(enemy, 'player', amount); return; }
    for (const dot of dots)
      recordThreat(enemy, dot.source === 'ally' ? `ally:${dot.allyId ?? 0}` : `player:${dot.playerId ?? 0}`, amount * dot.dps / total);
    return;
  }
  const table = tableFor(enemy);
  table.entries.set(source, (table.entries.get(source) ?? 0) + amount);
}

/** Healing threat: half rate, split evenly across every engaged enemy. The
 * healing player owns the aggro (their `player:<id>` bucket). */
export function recordHealThreat(enemies: readonly Enemy[], amount: number, healer: Player): void {
  const engaged = enemies.filter(e => e.state !== 'dead' && e.hp > 0
    && (e.awareness > 0 || (e.taunted?.remaining ?? 0) > 0
      || e.state === 'chase' || e.state === 'windup' || e.state === 'attack' || e.state === 'recover'));
  if (!engaged.length) return;
  const share = amount * THREAT_RULES.healFactor / engaged.length;
  const source = playerThreatSource(healer);
  for (const enemy of engaged) recordThreat(enemy, source, share);
}

/** WoW taunt: the taunter's threat rises to the current holder's level and it
 * takes the table, so the mob stays on the taunter when the compel expires. */
export function tauntThreat(enemy: Enemy, source: ThreatSource): void {
  const table = tableFor(enemy);
  let top = 0;
  for (const value of table.entries.values()) top = Math.max(top, value);
  table.entries.set(source, Math.max(table.entries.get(source) ?? 0, top, THREAT_RULES.tauntFloor));
  table.holder = source;
}

/** Drop one source's threat (vanish-style aggro dumps) or the whole table. */
export function clearThreat(enemy: Enemy, source?: ThreatSource): void {
  if (source === undefined) { tables.delete(enemy); return; }
  const table = tables.get(enemy);
  if (!table) return;
  table.entries.delete(source);
  if (table.holder === source) table.holder = undefined;
}

/** WoW pull threshold for a challenger: 110% in melee, 130% at range. The
 * challenger's own basic weapon decides; allies follow their template's
 * attackRange. */
export function threatPullThreshold(source: ThreatSource, players: readonly Player[], allies: readonly Ally[]): number {
  const challenger = threatPlayer(players, source);
  if (challenger)
    return basicAttackWeapon(challenger).attackKind === 'melee' ? THREAT_RULES.meleePull : THREAT_RULES.rangedPull;
  const ally = allies.find(a => `ally:${a.id}` === source);
  return ally && ALLY_TEMPLATES[ally.kind].attackRange > 0 ? THREAT_RULES.rangedPull : THREAT_RULES.meleePull;
}

/** The source the enemy should attack: the standing holder while no challenger
 * beats it by the pull threshold, else the highest-threat valid combatant.
 * Dead players and dead/despawned/stealthed allies can never hold aggro. */
export function resolveThreatHolder(enemy: Enemy, players: readonly Player[], allies: readonly Ally[]): ThreatSource | undefined {
  const table = threatTable(enemy);
  if (!table) return undefined;
  const valid = (source: ThreatSource): boolean => {
    const player = threatPlayer(players, source);
    if (player) return !player.dead;
    if (source === 'player' || source.startsWith('player:')) return false;
    const ally = allies.find(a => `ally:${a.id}` === source);
    return !!ally && ally.hp > 0 && (ally.stealth?.remaining ?? 0) <= 0;
  };
  const current = table.holder;
  if (current !== undefined && !valid(current)) table.holder = undefined;
  let best: ThreatSource | undefined, bestValue = 0;
  for (const [source, value] of table.entries)
    if (value > bestValue && valid(source)) { best = source; bestValue = value; }
  const holder = table.holder;
  if (best === undefined || best === holder) return holder;
  const holderValue = holder !== undefined ? table.entries.get(holder) ?? 0 : 0;
  if (holder !== undefined && valid(holder) && holderValue > 0
    && bestValue < holderValue * threatPullThreshold(best!, players, allies)) return holder;
  table.holder = best;
  return best;
}

/** Per-tick table maintenance, driven by the AI tick: taunt snapshots (a new
 * application or a longer refresh re-pegs the taunter), out-of-combat decay,
 * leash wipes and dead-combatant pruning. */
export function tickThreat(enemy: Enemy, dt: number, players: readonly Player[], allies: readonly Ally[]): void {
  if (enemy.state === 'dead' || enemy.hp <= 0) { tables.delete(enemy); return; }
  let table = tables.get(enemy);
  const taunt = enemy.taunted;
  if (taunt && taunt.remaining > 0) {
    const previous = table?.taunt;
    if (!previous || previous.allyId !== taunt.allyId || previous.playerId !== taunt.playerId
      || taunt.remaining > previous.remaining + .05)
      tauntThreat(enemy, taunt.allyId !== undefined ? `ally:${taunt.allyId}` : `player:${taunt.playerId ?? 0}`);
    (table ??= tables.get(enemy)!).taunt = { allyId: taunt.allyId, playerId: taunt.playerId, remaining: taunt.remaining };
  } else if (table?.taunt) delete table.taunt;
  if (!table) return;
  // Leashing home unaware wipes the table like a WoW evade.
  if (enemy.state === 'return' && enemy.awareness <= 0) { tables.delete(enemy); return; }
  // Dead combatants drop off: a dead player's threat dies with them, and dead
  // or despawned allies leave the table entirely.
  for (const source of [...table.entries.keys()]) {
    const player = threatPlayer(players, source);
    if (player) { if (player.dead) table.entries.delete(source); continue; }
    if (source === 'player' || source.startsWith('player:')) continue;
    if (!allies.some(a => `ally:${a.id}` === source && a.hp > 0)) table.entries.delete(source);
  }
  if (enemy.state === 'idle' || enemy.state === 'patrol') {
    const decay = Math.max(0, 1 - dt * THREAT_RULES.decayPerSecond);
    for (const [source, value] of table.entries) {
      const next = value * decay;
      if (next > 0) table.entries.set(source, next); else table.entries.delete(source);
    }
  }
  if (!table.entries.size && table.holder === undefined) tables.delete(enemy);
}
