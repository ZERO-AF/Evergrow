/** Current numeric prototype bounds; these are not an infinite-number representation. */
export const MAX_CONTENT_LEVEL = 1_000_000;
/** WotLK character cap: normal XP stops advancing the player at level 80.
 * Monsters, items and rifts still scale on the wider content ceiling. */
export const MAX_PLAYER_LEVEL = 80;
export const normalizeLevel = (level: number): number => Math.max(1, Math.min(MAX_CONTENT_LEVEL,
  Math.floor(Number.isFinite(level) ? level : 1)));

export type EnemyRank = 'normal' | 'veteran' | 'elite' | 'rare';
export const ENEMY_RANKS = Object.freeze({
  normal: Object.freeze({ name: 'Normal', color: '#c5ccc8', healthMultiplier: 1, damageMultiplier: 1, xpMultiplier: 1 }),
  veteran: Object.freeze({ name: 'Champion', color: '#76b9ee', healthMultiplier: 1.8, damageMultiplier: 1.2, xpMultiplier: 2 }),
  elite: Object.freeze({ name: 'Elite', color: '#e0c17a', healthMultiplier: 4, damageMultiplier: 1.5, xpMultiplier: 5 }),
  /** Named rares sit between elites and bosses: silver heraldry, ~1.5x elite durability. */
  rare: Object.freeze({ name: 'Rare', color: '#b9d2e2', healthMultiplier: 6, damageMultiplier: 1.65, xpMultiplier: 8 }),
});

/** Heroic bosses carry twice the health of their normal-mode counterparts. */
export const HEROIC_BOSS_HEALTH = 2;

export const itemPowerScale = (level: number): number => 1 + .13 * (normalizeLevel(level) - 1);
/** Percentage budgets approach a ceiling rather than growing like raw damage and armor. */
export const itemAffixGrowthLevel = (level: number): number => {
  const n = normalizeLevel(level) - 1;
  return 25 * n / (25 + n);
};
export const itemPercentageScale = (level: number): number => 1 + .65 * itemAffixGrowthLevel(level) / 25;
export const monsterHealthScale = (level: number): number => itemPowerScale(level) * (1 + .055 * (normalizeLevel(level) - 1));
export const monsterDamageScale = (level: number): number => 1.2 * (1 + .11 * (normalizeLevel(level) - 1));
export const monsterExperienceScale = (level: number): number => 1 + .18 * (normalizeLevel(level) - 1);

/** Armor is relative to the attacking monster's level, including projectiles already in flight. */
export function armorReduction(armor: number, sourceLevel: number): number {
  const value = Number.isFinite(armor) ? Math.max(0, armor) : 0;
  return Math.min(.8, value / (value + 120 * itemPowerScale(sourceLevel)));
}


/** Home elites (including their +2 rank levels) retain their original durability. */
export const ELITE_DURABILITY = Object.freeze({ startLevel: 14, fullLevel: 37, maximumBonus: .5 });
export function eliteDurabilityMultiplier(level: number): number {
  const r = ELITE_DURABILITY;
  return 1 + r.maximumBonus * Math.max(0, Math.min(1, (normalizeLevel(level) - r.startLevel) / (r.fullLevel - r.startLevel)));
}
