/** Weekly raid lockouts (docs/wow-deepening.md §15): the WotLK raid-ID model.
 * Claiming a raid boss chest stamps `character.raidLockouts[entranceId]` with
 * the epoch-second of the next weekly reset; the entrance refuses re-entry
 * until that instant, then the stale run retires and the raid reopens.
 *
 * Reset boundary: a fixed 7-day epoch bucket — the dailyResetKey pattern
 * (quest-state.ts) scaled to a week. `now` is epoch milliseconds everywhere;
 * stored values are epoch seconds so the ledger stays small.
 */
import type { Expeditions } from './dungeon-state.ts';
import { object, integer, text } from './item-validation.ts';
import { RAID_ENTRANCE_ID } from './raid-boss-content.ts';
import { RAID2_ENTRANCE_ID } from './raid2-boss-content.ts';
import { RAID3_ENTRANCE_ID } from './raid3-boss-content.ts';
import { RAID4_ENTRANCE_ID } from './raid4-boss-content.ts';
import { RAID5_ENTRANCE_ID } from './raid5-boss-content.ts';
import { RAID6_ENTRANCE_ID } from './raid6-boss-content.ts';
import { RAID7_ENTRANCE_ID } from './raid7-boss-content.ts';
import { RAID8_ENTRANCE_ID } from './raid8-boss-content.ts';
import { RAID9_ENTRANCE_ID } from './raid9-boss-content.ts';

export const RAID_LOCKOUT_RULES = Object.freeze({
  /** 7-day reset bucket in milliseconds. */
  weekMs: 7 * 86400000,
  /** Ledger bound: more ids than this means a forged save. */
  maxEntries: 32,
});

export const RAID_ENTRANCE_IDS: readonly string[] = Object.freeze([
  RAID_ENTRANCE_ID, RAID2_ENTRANCE_ID, RAID3_ENTRANCE_ID, RAID4_ENTRANCE_ID, RAID5_ENTRANCE_ID, RAID6_ENTRANCE_ID, RAID7_ENTRANCE_ID, RAID8_ENTRANCE_ID, RAID9_ENTRANCE_ID,
]);
export const isRaidEntranceAny = (id: string | undefined | null): boolean =>
  !!id && (RAID_ENTRANCE_IDS as readonly string[]).includes(id);

export interface RaidLockoutCarrier { raidLockouts?: Record<string, number> }

/** Epoch-second at which the current weekly bucket ends — the value stamped on a clear. */
export function raidResetAt(now: number): number {
  return Math.ceil(now / RAID_LOCKOUT_RULES.weekMs) * (RAID_LOCKOUT_RULES.weekMs / 1000);
}

/** True while the raid's lockout receipt is still inside its weekly bucket. */
export function raidLockedOut(sheet: RaidLockoutCarrier, raidId: string, now = Date.now()): boolean {
  const reset = sheet.raidLockouts?.[raidId];
  return reset !== undefined && now < reset * 1000;
}

/** Seconds until the raid's lockout expires (0 when not locked). */
export function raidLockoutCountdown(sheet: RaidLockoutCarrier, raidId: string, now = Date.now()): number {
  const reset = sheet.raidLockouts?.[raidId];
  return reset === undefined ? 0 : Math.max(0, reset - Math.floor(now / 1000));
}

/** "6d 23h" countdown label, mirroring dailyResetLabel. */
export function raidLockoutLabel(sheet: RaidLockoutCarrier, raidId: string, now = Date.now()): string {
  const s = raidLockoutCountdown(sheet, raidId, now);
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

/** Entrance refusal shown when a locked raid gate is used. */
export function raidLockoutMessage(sheet: RaidLockoutCarrier, raidId: string, name: string, now = Date.now()): string {
  return `${name} is locked until the weekly reset (${raidLockoutLabel(sheet, raidId, now)}).`;
}

/** Stamp the clear receipt: this raid stays locked until the next weekly boundary. */
export function recordRaidLockout(sheet: RaidLockoutCarrier, raidId: string, now = Date.now()): void {
  (sheet.raidLockouts ??= {})[raidId] = raidResetAt(now);
}

/**
 * Weekly reset sweep for the dungeon ledger, called on raid entry after the
 * lockout check passes: an expired receipt retires the stale run (dead boss,
 * claimed chest) and its `cleared` tombstone so a fresh arena generates.
 * In-progress runs (boss alive, or no receipt was ever written) are untouched.
 */
export function resetRaidRun(state: Expeditions, sheet: RaidLockoutCarrier, raidId: string, now = Date.now()): void {
  if (!isRaidEntranceAny(raidId) || raidLockedOut(sheet, raidId, now)) return;
  const receipt = sheet.raidLockouts?.[raidId];
  if (receipt === undefined) return;
  state.runs = state.runs.filter(r => r.entrance.id !== raidId);
  if (state.cleared) state.cleared = state.cleared.filter(id => id !== raidId);
}

/** Save validation for the optional ledger: raid-id keys, epoch-second values. */
export function validRaidLockouts(v: unknown): v is Record<string, number> {
  return object(v) && Object.keys(v).length <= RAID_LOCKOUT_RULES.maxEntries
    && Object.entries(v).every(([id, reset]) => text(id, 180) && isRaidEntranceAny(id) && integer(reset, 1, 1e12));
}
