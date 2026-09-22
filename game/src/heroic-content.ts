/**
 * WotLK Heroic dungeon mode (game-features.ts `heroicDungeons`): the Dungeon
 * Finder offers a Heroic queue for Northrend dungeons at level 80. A heroic
 * entrance pins `scaling.heroic` — the flag rides the persisted EncounterScale
 * so the floor's member levels, spawn ranks, boss health and emblem awards all
 * read the same marker without touching dungeon.ts/dungeon-state.ts.
 *
 * Scaling contract (encounter-scaling.ts): non-boss members spawn one rank tier
 * higher (heroicMemberRank) and their level offset follows the promoted rank;
 * bosses keep their +3 level and carry HEROIC_BOSS_HEALTH × maxHp, applied in
 * applyEnemyModifiers so spawn and save-restore agree.
 */
import { GAME_FEATURES } from './game-features.ts';
import { ZONES } from './world-atlas.ts';
import { heroicMemberRank, isBossKind } from './encounter-scaling.ts';
import type { EnemyRank } from './progression-content.ts';
import type { Enemy, Player } from './model.ts';
import type { DungeonEntrance } from './dungeon.ts';
import type { Expeditions } from './dungeon-state.ts';
import { creditEmblems, type EmblemWallet } from './wallet.ts';

export const HEROIC_RULES = Object.freeze({
  /** Heroic queues are a max-level feature; the floor pins its band at 80. */
  level: 80,
  /** Each heroic boss drops this many Emblems of Heroism (seeded 2–3). */
  bossEmblemsMin: 2,
  /** The boss chest (dungeon completion) pays this bonus on top of the kill. */
  completionEmblems: 3,
});

/** The feature switch (game-features.ts); absent means enabled. */
export const heroicDungeonsEnabled = (): boolean =>
  (GAME_FEATURES as Record<string, boolean | undefined>).heroicDungeons ?? true;

/** Heroic mode exists for Northrend dungeons only (WotLK endgame). */
export const heroicEligible = (entry: { zoneId: string }): boolean =>
  ZONES[entry.zoneId]?.continent === 'northrend';

/** Why this player cannot queue heroic for the entry, or null when eligible. */
export function heroicProblem(entry: { zoneId: string }, player: Pick<Player, 'level' | 'dead'>): string | null {
  if (!heroicDungeonsEnabled()) return 'Heroic dungeons are not available.';
  if (player.dead) return 'Recover in town first.';
  if (!heroicEligible(entry)) return 'This dungeon has no heroic mode.';
  if (player.level < HEROIC_RULES.level) return `Heroic mode requires level ${HEROIC_RULES.level}.`;
  return null;
}

/** The rank a member of this entrance's floor spawns at: heroic floors promote
 * non-boss members one tier; normal floors and bosses keep their authored rank. */
export function dungeonMemberRank(entrance: Pick<DungeonEntrance, 'scaling'>, member: { kind: Enemy['kind']; rank: EnemyRank }): EnemyRank {
  return entrance.scaling?.heroic && !isBossKind(member.kind) ? heroicMemberRank(member.rank) : member.rank;
}

/** The dungeon run an enemy belongs to is heroic when its entrance scale says so. */
export function heroicRunFor(expeditions: Expeditions, campId: string | undefined): boolean {
  return !!campId && expeditions.runs.some(run => run.entrance.id === campId && run.entrance.scaling?.heroic === true);
}

/**
 * Kill award: heroic dungeon bosses drop Emblems of Heroism, credited to the
 * live sheet (the same non-durable path as kill XP/gold — the next checkpoint
 * persists it). Deterministic per enemy seed: 2–3 emblems. Returns the amount
 * credited; 0 when the kill was not a heroic boss or the wallet overflowed.
 */
export function awardHeroicBossEmblems(expeditions: Expeditions, enemy: Pick<Enemy, 'kind' | 'campId' | 'lootSeed'>, sheet: EmblemWallet): number {
  if (!heroicDungeonsEnabled() || !isBossKind(enemy.kind) || !heroicRunFor(expeditions, enemy.campId)) return 0;
  const amount = HEROIC_RULES.bossEmblemsMin + ((enemy.lootSeed >>> 0) % 2);
  return creditEmblems(sheet, amount) ? amount : 0;
}
