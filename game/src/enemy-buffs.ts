import type { Enemy, EnemyBuff, EnemyBuffKind } from './model.ts';
import type { SkillId } from './character-types.ts';
import type { BuffSpec } from './wow-types.ts';

/** Dispellable enemy buff catalog. `power` is the effect strength: the damage
 * bonus fraction (enrage), the speed bonus fraction (haste), or the maxHp
 * fraction converted into an absorb pool at application (shield). */
export const ENEMY_BUFFS: Readonly<Record<EnemyBuffKind, {
  readonly name: string; readonly color: string; readonly icon: SkillId;
  readonly duration: number; readonly power: number; readonly summary: string;
}>> = Object.freeze({
  enrage: Object.freeze({ name: 'Enrage', color: '#f2793a', icon: 'whirlwind', duration: 12, power: .5,
    summary: 'Deals 50% increased damage. Dispellable.' }),
  shield: Object.freeze({ name: 'Shield', color: '#9ed6d5', icon: 'runicWard', duration: 20, power: .25,
    summary: 'Absorbs 25% of maximum life in damage. Dispellable.' }),
  haste: Object.freeze({ name: 'Haste', color: '#a9e87c', icon: 'lunge', duration: 15, power: .3,
    summary: 'Attacks and casts 30% faster. Dispellable.' }),
});

/** Spawn-time buffs by enemy kind: quick skirmishers hasten. */
export const ENEMY_SPAWN_BUFFS: Readonly<Partial<Record<Enemy['kind'], readonly EnemyBuffKind[]>>> = Object.freeze({
  hound: ['haste'], archer: ['haste'], stormSentinel: ['haste'], duneScuttler: ['haste'],
});

/** Engagement casts: caster kinds ward themselves the first tick they are aware
 * of a hostile (combat-status.ts). The first hit that alerts them still lands
 * unshielded; the ward covers the rest of the fight. */
export const ENEMY_COMBAT_BUFFS: Readonly<Partial<Record<Enemy['kind'], readonly EnemyBuffKind[]>>> = Object.freeze({
  caster: ['shield'], emberAcolyte: ['shield'], wisp: ['shield'], mireSpitter: ['shield'], frostRevenant: ['shield'],
});

/** Applies a buff; reapplication refreshes to the strongest power and longest
 * remaining duration without stacking. Dead targets ignore buffs. */
export function applyEnemyBuff(enemy: Enemy, kind: EnemyBuffKind, power?: number, duration?: number): void {
  if (enemy.state === 'dead') return;
  const spec = ENEMY_BUFFS[kind];
  const strength = power ?? spec.power, length = duration ?? spec.duration;
  const buffs = enemy.buffs ??= [];
  const existing = buffs.find((buff): buff is EnemyBuff => 'kind' in buff && buff.kind === kind);
  if (existing) {
    existing.power = Math.max(existing.power, strength);
    existing.remaining = Math.max(existing.remaining, length);
    if (kind === 'shield') existing.absorbRemaining = Math.max(existing.absorbRemaining ?? 0, enemy.maxHp * strength);
    return;
  }
  buffs.push({ kind, power: strength, remaining: length, duration: length,
    ...(kind === 'shield' ? { absorbRemaining: enemy.maxHp * strength } : {}) });
}

/** Deterministic spawn roll shared by fresh spawns and restores. */
export function enemySpawnBuffs(enemy: Enemy): void {
  for (const kind of ENEMY_SPAWN_BUFFS[enemy.kind] ?? []) applyEnemyBuff(enemy, kind);
}

/** Enrage multiplies everything the enemy deals to the player. */
export function enemyBuffDamageMultiplier(enemy: Pick<Enemy, 'buffs'>): number {
  let multiplier = 1;
  for (const buff of enemy.buffs ?? []) if ('kind' in buff && buff.kind === 'enrage' && buff.remaining > 0) multiplier *= 1 + buff.power;
  return multiplier;
}

/** Haste divides windup and recovery durations (enemy-threat.ts). */
export function enemyHasteFactor(enemy: Pick<Enemy, 'buffs'>): number {
  let factor = 1;
  for (const buff of enemy.buffs ?? []) if ('kind' in buff && buff.kind === 'haste' && buff.remaining > 0) factor *= 1 + buff.power;
  return factor;
}

/** Shield buffs soak incoming damage before health; returns the unabsorbed rest. */
export function absorbEnemyHit(enemy: Enemy, damage: number): number {
  for (const buff of enemy.buffs ?? []) {
    if (!('kind' in buff) || buff.kind !== 'shield' || buff.remaining <= 0 || !(buff.absorbRemaining! > 0) || damage <= 0) continue;
    const absorbed = Math.min(damage, buff.absorbRemaining!);
    buff.absorbRemaining! -= absorbed;
    damage -= absorbed;
  }
  return damage;
}

/** Offensive dispel: removes up to `count` enemy buffs in application order and
 * returns the stripped instances (Spellsteal grants the first to the caster).
 * Player-shaped PvP combatants share the field but carry WowBuffs, which are
 * never stripped here. */
export function dispelEnemyBuffs(enemy: Enemy, count: number): EnemyBuff[] {
  const buffs = enemy.buffs;
  if (!buffs?.length || count <= 0) return [];
  const stripped: EnemyBuff[] = [];
  for (let i = 0; i < buffs.length && stripped.length < count;) {
    const buff = buffs[i]!;
    if ('kind' in buff) { stripped.push(buff); buffs.splice(i, 1); }
    else i++;
  }
  if (!buffs.length) delete enemy.buffs;
  return stripped;
}

/** Spellsteal payload: the enemy buff becomes a player buff for its remaining
 * duration. A stolen shield converts its leftover pool into a maxHp fraction. */
export function stolenBuffSpec(buff: EnemyBuff, playerMaxHp: number): BuffSpec {
  const duration = Math.max(.1, buff.remaining);
  if (buff.kind === 'enrage') return { duration, stats: { damagePercent: buff.power * 100, spellDamagePercent: buff.power * 100 } };
  if (buff.kind === 'haste') return { duration, stats: { attackSpeedPercent: buff.power * 100, castSpeedPercent: buff.power * 100 } };
  return { duration, absorb: Math.min(.5, Math.max(0, (buff.absorbRemaining ?? 0) / Math.max(1, playerMaxHp))) };
}
