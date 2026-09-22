/** Companion collection state (docs/wow-deepening.md §2 lineage).
 *
 * The collection persists on `player.achievements` — the same validated
 * `Record<string, number>` ledger the achievement system already saves:
 * - `seen:companion:<id>` — 1 once collected (feeds 'Lil' Game Hunter').
 * - `companion:active` — the summoned companion's `companionToken`, 0/absent
 *   when nothing is out.
 *
 * The follower's position is presentation-only: `CompanionFollower` state is
 * advanced by the renderer (or tests) via `advanceCompanionFollower` and never
 * touches the deterministic sim. */
import type { Player } from './model.ts';
import {
  COMPANIONS, COMPANION_IDS, companionFromToken, companionToken,
  type CompanionDef, type CompanionId,
} from './companion-content.ts';
import { ACHIEVEMENTS, type AchievementDef } from './achievement-content.ts';
import { achievementComplete, achievementTrack } from './achievement-state.ts';
import { standingIndex, standingOf } from './reputation-state.ts';

export const COMPANION_RULES = Object.freeze({
  /** Ledger key holding the summoned companion's token. */
  activeKey: 'companion:active',
  /** Marker prefix for collected companions. */
  seenPrefix: 'seen:companion:',
  /** Follow tuning: spring rate, catch-up teleport distance, anchor offset. */
  followRate: 7,
  teleportRange: 240,
  anchorBack: 16,
  anchorSide: 13,
});

type Ledger = Pick<Player, 'achievements' | 'professions' | 'reputation' | 'fishing'>;

export function companionOwned(player: Pick<Player, 'achievements'>, id: CompanionId): boolean {
  return (player.achievements?.[`${COMPANION_RULES.seenPrefix}${id}`] ?? 0) > 0;
}

export function companionCount(player: Pick<Player, 'achievements'>): number {
  let n = 0;
  for (const id of COMPANION_IDS) if (companionOwned(player, id)) n++;
  return n;
}

export function ownedCompanions(player: Pick<Player, 'achievements'>): CompanionId[] {
  return COMPANION_IDS.filter(id => companionOwned(player, id));
}

/** The summoned companion, or null. A stored pick whose marker was lost is
 * treated as dismissed. */
export function activeCompanion(player: Pick<Player, 'achievements'>): CompanionId | null {
  const id = companionFromToken(player.achievements?.[COMPANION_RULES.activeKey] ?? 0);
  return id && companionOwned(player, id) ? id : null;
}

/** Whether the companion's source condition is currently met. Vendor and drop
 * companions are never auto-earned — their hosts call `grantCompanion`. */
export function companionEarned(player: Ledger, def: CompanionDef): boolean {
  const s = def.source;
  switch (s.kind) {
    case 'achievement': return achievementComplete(player.achievements, s.achievement);
    case 'profession': return (player.professions?.[s.profession]?.level ?? 0) >= s.level;
    case 'reputation': return standingIndex(standingOf(player, s.faction).tier) >= standingIndex(s.standing);
    case 'fishing': return (player.fishing?.level ?? 0) >= s.level;
    default: return false;
  }
}

/** Rewrite the progress counters of every companion-collection achievement
 * from the live marker set, then return the defs this call completes. */
function syncCollectionAchievements(player: Player, now?: number): AchievementDef[] {
  const record = player.achievements ??= {};
  const count = companionCount(player);
  for (const a of ACHIEVEMENTS)
    if (a.criterion.kind === 'companions' && !achievementComplete(record, a.id))
      record[a.id] = Math.min(a.count, count);
  return achievementTrack(player, { type: 'snapshot' }, [], now);
}

/** Add a companion to the collection. Returns whether it was newly collected
 * plus any achievements the grant completed (callers toast them). */
export function grantCompanion(player: Player, id: CompanionId, now?: number): { added: boolean; unlocked: AchievementDef[] } {
  const record = player.achievements ??= {};
  const key = `${COMPANION_RULES.seenPrefix}${id}`;
  if (record[key]) return { added: false, unlocked: [] };
  record[key] = 1;
  return { added: true, unlocked: syncCollectionAchievements(player, now) };
}

/** Grant every companion whose source condition the player already meets
 * (achievement/profession/reputation/fishing sources). Call after those
 * systems change state; returns newly collected ids plus unlocked defs. */
export function syncCompanions(player: Player, now?: number): { added: CompanionId[]; unlocked: AchievementDef[] } {
  const added: CompanionId[] = [];
  for (const id of COMPANION_IDS)
    if (!companionOwned(player, id) && companionEarned(player, COMPANIONS[id])) {
      (player.achievements ??= {})[`${COMPANION_RULES.seenPrefix}${id}`] = 1;
      added.push(id);
    }
  return { added, unlocked: added.length ? syncCollectionAchievements(player, now) : [] };
}

/** Summon a collected companion, or dismiss it when `id` is null. Returns a
 * user-facing failure message, or null on success. */
export function summonCompanion(player: Pick<Player, 'achievements'>, id: CompanionId | null): string | null {
  const record = player.achievements ??= {};
  if (id === null) { delete record[COMPANION_RULES.activeKey]; return null; }
  if (!companionOwned(player, id)) return `${COMPANIONS[id].name} is not in your collection yet.`;
  record[COMPANION_RULES.activeKey] = companionToken(id);
  return null;
}

// ── Follower (presentation-only; never serialized) ──────────────────────────

export interface CompanionFollower {
  x: number; y: number;
  /** Facing for the sprite; eases toward the travel direction. */
  angle: number;
  /** Gait/bob phase accumulator; frozen under reduced motion. */
  phase: number;
  /** 0..1 stride strength while catching up. */
  moving: number;
}

export function freshCompanionFollower(x: number, y: number): CompanionFollower {
  return { x, y, angle: 0, phase: 0, moving: 0 };
}

/** Ground point the companion hovers near: behind and beside the player. */
export function companionAnchor(player: Pick<Player, 'x' | 'y' | 'angle'>): { x: number; y: number } {
  const back = player.angle + Math.PI;
  return {
    x: player.x + Math.cos(back) * COMPANION_RULES.anchorBack + Math.cos(player.angle + Math.PI / 2) * COMPANION_RULES.anchorSide,
    y: player.y + Math.sin(back) * COMPANION_RULES.anchorBack * .55 + Math.sin(player.angle + Math.PI / 2) * COMPANION_RULES.anchorSide * .55,
  };
}

/** Advance the follower toward its anchor. `frozen` (reduced motion) snaps to
 * the anchor and stills the bob. Mutates and returns `f`. */
export function advanceCompanionFollower(
  f: CompanionFollower,
  player: Pick<Player, 'x' | 'y' | 'angle'>,
  dt: number,
  frozen = false,
): CompanionFollower {
  const anchor = companionAnchor(player);
  const dx = anchor.x - f.x, dy = anchor.y - f.y;
  const dist = Math.hypot(dx, dy);
  if (frozen || dist > COMPANION_RULES.teleportRange) {
    f.x = anchor.x; f.y = anchor.y; f.moving = 0;
  } else {
    const k = 1 - Math.exp(-COMPANION_RULES.followRate * dt);
    f.x += dx * k; f.y += dy * k;
    f.moving = Math.min(1, dist / 40);
    if (dist > 2) f.angle = Math.atan2(dy, dx);
    f.phase += dt * (4 + f.moving * 6);
  }
  return f;
}
