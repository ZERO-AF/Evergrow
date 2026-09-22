import type { Player, WorldQuery } from './model.ts';
import { MAX_PLAYER_LEVEL } from './progression-content.ts';
import { xpForNextLevel } from './progression.ts';

/** WoW rested XP: time in a settlement banks a pool worth up to 1.5 levels (30 bubbles); kills spend it for double XP. */
export const RESTED_RULES = Object.freeze({
  /** One level of rested pool per ~8 hours inside a sanctuary (accelerated WoW pacing: 5% of a level per 8h offline/resting). */
  levelsPerSecond: 1 / 30000,
  capLevels: 1.5,
});
/** Suggested rail color for the rested overlay — the WoW blue that trails the violet fill. */
export const RESTED_RAIL_COLOR = '#7fb0e8';

/** Rested pool ceiling in XP units: 1.5 times the current level's threshold. */
export function restedCap(player: Pick<Player, 'level'>): number {
  return xpForNextLevel(player.level) * RESTED_RULES.capLevels;
}

/**
 * Settlement tick: bank rested XP while the player stands in a sanctuary.
 * Returns the amount added this tick (0 outside towns, while dead, or at the level cap).
 */
export function restedAccrual(player: Player, world: WorldQuery, dt: number): number {
  if (player.dead || dt <= 0 || player.level >= MAX_PLAYER_LEVEL || !world.isSanctuary?.(player.x, player.y)) return 0;
  const cap = restedCap(player);
  const before = Math.min(cap, Math.max(0, player.restedXp ?? 0));
  const after = Math.min(cap, before + xpForNextLevel(player.level) * RESTED_RULES.levelsPerSecond * dt);
  player.restedXp = after;
  return after - before;
}

/**
 * Kill-XP hook: consume the rested pool for a matching bonus (2x total).
 * Returns the extra XP to add to the base reward; the pool shrinks by the same amount.
 */
export function restedBonus(player: Player, baseReward: number): number {
  if (player.dead || player.level >= MAX_PLAYER_LEVEL || !Number.isFinite(baseReward) || baseReward <= 0) return 0;
  const pool = Math.max(0, player.restedXp ?? 0);
  const bonus = Math.floor(Math.min(pool, baseReward));
  if (bonus < 1) return 0;
  player.restedXp = pool - bonus;
  return bonus;
}

/**
 * XP rail overlay: how far the rested pool reaches past the current fill, in rail fractions.
 * `fill` is the absolute end of the rested span (current xp + pool, clamped to the level);
 * `xp` is the raw pool for readouts. Draw the span [xp/needed, fill] in RESTED_RAIL_COLOR.
 */
export function restedDisplay(player: Pick<Player, 'level' | 'xp' | 'restedXp'>): { fill: number; xp: number } {
  const needed = xpForNextLevel(player.level);
  const pool = Math.max(0, player.restedXp ?? 0);
  return { fill: Math.min(1, (Math.max(0, player.xp) + pool) / needed), xp: pool };
}
