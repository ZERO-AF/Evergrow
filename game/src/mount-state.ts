/** Mount state queries and the transient summon cast (docs/wow-deepening.md §2).
 * `player.mounted` is the persisted field; the in-progress summon cast is
 * session-only and keyed by Simulation so shared files stay untouched. */
import type { Player, WorldQuery } from './model.ts';
import type { Simulation } from './simulation.ts';
import { MOUNTS, MOUNT_IDS, type MountId } from './mount-content.ts';
import { GAME_FEATURES } from './game-features.ts';
import { guildMountSpeedFactor } from './guild-state.ts';
import { achievementComplete, achievementTrack } from './achievement-state.ts';
import { standingIndex, standingOf } from './reputation-state.ts';
import type { AchievementDef } from './achievement-content.ts';

export const MOUNT_RULES = Object.freeze({
  /** Summon cast time in seconds; movement, offense or damage interrupts it. */
  cast: 1.5,
  /** Achievement id that unlocks the Nether Drake. */
  drakeAchievement: 'mount:drake',
});

/** WorldQuery plus the optional ground sampler every concrete world implements. */
export interface MountWorld extends WorldQuery {
  sampleGroundContact?(x: number, y: number): { indoors: boolean };
}

/** Movement-speed multiplier applied while mounted; 1 otherwise.
 * The Mount Up guild perk multiplies the mount's listed speed. */
export function mountSpeedFactor(player: Pick<Player, 'mounted' | 'character'>): number {
  return GAME_FEATURES.mounts && player.mounted ? MOUNTS[player.mounted.id].speed * guildMountSpeedFactor(player) : 1;
}

/** Mounts are outdoor-only: dungeons and building interiors reject them. */
export function mountIndoors(sim: Simulation): boolean {
  if (sim.dungeonFloor) return true;
  const world = sim.world as MountWorld;
  return world.sampleGroundContact?.(sim.player.x, sim.player.y)?.indoors === true;
}

/** The ledger key a `flag`-unlocked mount checks; `grantMount` sets it. */
export const mountFlagKey = (id: MountId): string => `mount:${id}`;

/** Whether the mount's unlock condition is met. `always` mounts are free;
 * `flag` mounts wait on a `mount:<id>` ledger marker (vendor/drop grants);
 * the rest evaluate live player state. */
export function mountUnlocked(
  player: Pick<Player, 'achievements' | 'professions' | 'reputation' | 'fishing'>,
  id: MountId,
): boolean {
  const unlock = MOUNTS[id].unlock;
  switch (unlock.kind) {
    case 'always': return true;
    case 'flag': return (player.achievements?.[mountFlagKey(id)] ?? 0) > 0;
    case 'achievement': return achievementComplete(player.achievements, unlock.achievement);
    case 'profession': return (player.professions?.[unlock.profession]?.level ?? 0) >= unlock.level;
    case 'reputation': return standingIndex(standingOf(player, unlock.faction).tier) >= standingIndex(unlock.standing);
    case 'fishing': return (player.fishing?.level ?? 0) >= unlock.level;
  }
}

/** Set a flag mount's unlock marker on the achievement ledger (vendor
 * purchases, rare drops). Returns the defs this grant completes so callers
 * can toast them. */
export function grantMount(player: Player, id: MountId, now?: number): AchievementDef[] {
  if (MOUNTS[id].unlock.kind !== 'flag') return [];
  const record = player.achievements ??= {};
  if (record[mountFlagKey(id)]) return [];
  record[mountFlagKey(id)] = 1;
  return achievementTrack(player, { type: 'snapshot' }, [], now);
}

/** The mount the X toggle summons: the stable-master pick when it's still
 * unlocked, else the fastest unlocked mount. */
export function preferredMount(player: Pick<Player, 'achievements' | 'professions' | 'reputation' | 'fishing' | 'character'>): MountId {
  const picked = player.character.mount;
  if (picked && mountUnlocked(player, picked)) return picked;
  let best: MountId = 'horse';
  for (const id of MOUNT_IDS) if (mountUnlocked(player, id) && MOUNTS[id].speed > MOUNTS[best].speed) best = id;
  return best;
}

// ── Summon cast (transient; never serialized) ────────────────────────────────

export interface SummonCast { readonly id: MountId; elapsed: number }
/** Keyed by the acting player (sim.player resolves per-actor in co-op), so each
 * player's summon cast is independent — a partner's input never cancels it. */
const summonCasts = new WeakMap<Player, SummonCast>();

export function summonCast(sim: Simulation): SummonCast | null {
  return summonCasts.get(sim.player) ?? null;
}

/** 0..1 cast progress for the casting pose / cast bar; 0 when not summoning. */
export function summonProgress(sim: Simulation): number {
  const cast = summonCasts.get(sim.player);
  return cast ? Math.min(1, cast.elapsed / MOUNT_RULES.cast) : 0;
}

export function startSummonCast(sim: Simulation, id: MountId): void {
  summonCasts.set(sim.player, { id, elapsed: 0 });
}

export function cancelSummonCast(sim: Simulation): void {
  summonCasts.delete(sim.player);
}

/** Advance the cast clock; returns the finished cast (and clears it) or null. */
export function advanceSummonCast(sim: Simulation, dt: number): SummonCast | null {
  const cast = summonCasts.get(sim.player);
  if (!cast) return null;
  cast.elapsed += dt;
  if (cast.elapsed + 1e-9 < MOUNT_RULES.cast) return null;
  summonCasts.delete(sim.player);
  return cast;
}
