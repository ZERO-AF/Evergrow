import { getZoneAt, type ZoneProgression } from './zone-progression.ts';
import { normalizeLevel, type EnemyRank } from './progression-content.ts';
export { isBossKind } from './wilderness-boss-content.ts';

/** One immutable activation snapshot for an entire encounter and all its future waves. */
export interface EncounterScale { base: number; min: number; max: number; fixed?: boolean;
  /** WotLK Heroic dungeon mode (heroic-content.ts): trash members spawn one rank
   * tier higher and bosses carry doubled health. Persisted on the run's entrance. */
  heroic?: boolean }
export type EncounterScales = Record<string, EncounterScale>;
export function captureEncounterScale(zone: ZoneProgression, playerLevel: number): EncounterScale {
  return { base: Math.max(zone.level, Math.min(zone.maxLevel, normalizeLevel(playerLevel))), min: zone.level, max: zone.maxLevel };
}
export function encounterScaleAt(x: number, y: number, seed: number | undefined, playerLevel: number): EncounterScale {
  return captureEncounterScale(getZoneAt(x, y, seed), playerLevel);
}
export function encounterMemberLevel(scale: EncounterScale, rank: EnemyRank, seed: number, boss = false): number {
  if (scale.fixed) return scale.base;
  // Heroic floors promote every non-boss member one rank tier (normal→veteran→elite);
  // bosses keep their +3 level offset and gain health through HEROIC_BOSS_HEALTH.
  const effective = scale.heroic && !boss ? heroicMemberRank(rank) : rank;
  const offset = boss ? 3 : effective === 'elite' || effective === 'rare' ? 2 : effective === 'veteran' ? 1 : 0;
  const variation = offset ? 0 : (seed >>> 0) % 3 - 1;
  return normalizeLevel(Math.max(scale.min, Math.min(scale.max, scale.base + variation)) + offset);
}
/** Heroic bosses carry twice the health of their normal-mode counterparts.
 * Declared in progression-content.ts (a leaf) so enemy-modifiers.ts can read it
 * without closing an encounter-scaling → … → enemy-modifiers import cycle. */
/** The rank a heroic dungeon member spawns at: one tier up, capped at elite
 * (rare is a named-spawn tier, not a promotion step). Bosses are never promoted —
 * their heroic budget is the doubled health pool. */
export const heroicMemberRank = (rank: EnemyRank): EnemyRank =>
  rank === 'normal' ? 'veteran' : rank === 'veteran' ? 'elite' : rank;
export function encounterRewardLevel(scale: EncounterScale, challenge = 0): number {
  return normalizeLevel(scale.base + (scale.fixed ? 0 : challenge));
}
export function validEncounterScale(v: unknown): v is EncounterScale {
  if (!v || typeof v !== 'object') return false;
  const s = v as EncounterScale;
  return [s.base, s.min, s.max].every(n => Number.isInteger(n) && n >= 1 && n <= 1e6)
    && s.min <= s.base && s.base <= s.max && (s.fixed === undefined || s.fixed === true)
    && (s.heroic === undefined || s.heroic === true);
}
export function validEncounterScales(v: unknown): v is EncounterScales {
  return !!v && typeof v === 'object' && !Array.isArray(v)
    && Object.entries(v).every(([id,s]) => id.length > 0 && id.length <= 180 && validEncounterScale(s));
}
export const regionLevelLabel = (zone: Pick<ZoneProgression, 'level' | 'maxLevel'>): string => `Lv ${zone.level}–${zone.maxLevel}`;
