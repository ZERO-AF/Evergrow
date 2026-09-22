/** Darkmoon Faire state: the ticket wallet on the character sheet plus the
 * per-faire completion ledger on the checkpoint.
 *
 * `darkmoonTickets` is a plain integer balance beside gold/honor/emblems; the
 * integrator adds `HolidayWallet` to CharacterSheet and `validDarkmoonTickets`
 * to validSheet. `HolidayState` rides the checkpoint as `holiday` (see
 * holiday-command.ts) and is lazily installed on the sim via `holidayOf` so
 * headless harnesses work before the field lands. */
import { GAME_FEATURES } from './game-features.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { factionHostility, raceFaction } from './factions.ts';
import { object, integer } from './item-validation.ts';
import type { Player, WorldQuery } from './model.ts';
import type { Simulation } from './simulation.ts';
import type { WowRaceId } from './wow-types.ts';
import {
  DARKMOON_ACTIVITIES, HOLIDAY_RULES, faireWindowAt,
  type FaireActivity, type FaireBooth, type FaireNPC,
} from './holiday-content.ts';

// ── Ticket wallet ────────────────────────────────────────────────────────────

/** Darkmoon Prize Tickets: a plain integer balance on the character sheet,
 * parallel to emblems, spent at the prize vendor. */
export interface HolidayWallet { darkmoonTickets?: number; }
export const validDarkmoonTickets = (amount: unknown): amount is number =>
  typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0;
export const ticketBalance = (wallet: HolidayWallet): number => wallet.darkmoonTickets ?? 0;
export function canAffordTickets(wallet: HolidayWallet, amount: number): boolean {
  return validDarkmoonTickets(amount) && validDarkmoonTickets(ticketBalance(wallet)) && ticketBalance(wallet) >= amount;
}
/** Atomic operations shared by activity awards and the prize vendor. Failure never changes the wallet. */
export function creditTickets(wallet: HolidayWallet, amount: number): boolean {
  const balance = ticketBalance(wallet);
  if (!validDarkmoonTickets(amount) || !validDarkmoonTickets(balance) || !validDarkmoonTickets(balance + amount)) return false;
  wallet.darkmoonTickets = balance + amount;
  return true;
}
export function spendTickets(wallet: HolidayWallet, amount: number): boolean {
  if (!canAffordTickets(wallet, amount)) return false;
  wallet.darkmoonTickets = ticketBalance(wallet) - amount;
  return true;
}

/** Comma-grouped point display ("1,250") — tickets have no denominations. */
const pointFormat = new Intl.NumberFormat('en-US');
export const formatTickets = (amount: number): string =>
  pointFormat.format(Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0);

// ── Holiday state ────────────────────────────────────────────────────────────

export interface HolidayState {
  /** Faire windows the player has visited (a play or purchase inside one). */
  visits: number;
  /** The window index the completion ledger belongs to; -1 before the first. */
  lastFaire: number;
  /** Activity id → completion stamp: the UTC day key for 'day' activities,
   * the faire index for 'faire' activities. */
  completed: Record<string, number>;
}

export const freshHoliday = (): HolidayState => ({ visits: 0, lastFaire: -1, completed: {} });

/** Reads the integrator-added flag; defaults to on until it lands. */
export function holidayEnabled(): boolean {
  return 'holiday' in GAME_FEATURES ? (GAME_FEATURES as Record<string, unknown>).holiday === true : true;
}

/** Simulation carrier: the integrator adds `holiday`; lazily installed so
 * headless harnesses work before the field lands. */
export type HolidayCarrier = { holiday?: HolidayState };
export function holidayOf(sim: Simulation): HolidayState {
  const carrier = sim as unknown as HolidayCarrier;
  return carrier.holiday ??= freshHoliday();
}

/** UTC day number for an epoch-ms instant — the daily flag boundary. */
export const faireDayKey = (now: number): number => Math.floor(now / 86400000);

/** The stamp an activity completion records in the current window. */
export function activityFlag(activity: FaireActivity, now: number): number {
  return activity.limit === 'day' ? faireDayKey(now) : faireWindowAt(now).index;
}

/** Whether the activity's flag is already spent for this window/day. */
export function activityDone(state: HolidayState, activity: FaireActivity, now: number): boolean {
  return state.completed[activity.id] === activityFlag(activity, now);
}

/** Drop flags that can never matter again: day stamps older than today and
 * faire stamps from earlier windows. Idempotent; returns the pruned ids. */
export function compactHoliday(state: HolidayState, now: number): string[] {
  const day = faireDayKey(now), faire = faireWindowAt(now).index, pruned: string[] = [];
  for (const [id, stamp] of Object.entries(state.completed)) {
    const activity = DARKMOON_ACTIVITIES.find(a => a.id === id);
    const stale = !activity || (activity.limit === 'day' ? stamp < day : stamp < faire);
    if (stale) { delete state.completed[id]; pruned.push(id); }
  }
  return pruned;
}

// ── Interaction checks ───────────────────────────────────────────────────────

/** canInteractNPC for the site-anchored faire vendor: same reach, line-of-sight
 * and faction rules, without requiring the role in the NPCRole union yet. */
export function canInteractFaireNPC(npc: FaireNPC, player: { x: number; y: number; dead?: boolean; character?: { raceId: WowRaceId } }, world: WorldQuery): boolean {
  if (GAME_FEATURES.factions && player.character && factionHostility(npc.faction ?? 'neutral', raceFaction(player.character.raceId)) === 'hostile') return false;
  return !player.dead && !world.blocked(npc.x, npc.y, 0) && !world.blocked(player.x, player.y, 0)
    && Math.hypot(player.x - npc.x, player.y - npc.y) <= HOLIDAY_RULES.vendorReach
    && hasLineOfSight(world, player.x, player.y, npc.x, npc.y);
}

export function focusedFaireVendor(vendor: FaireNPC | null, player: { x: number; y: number; dead?: boolean; character?: { raceId: WowRaceId } }, world: WorldQuery,
  pointer?: { x: number; y: number }): FaireNPC | null {
  if (!vendor || !canInteractFaireNPC(vendor, player, world)) return null;
  if (pointer && Math.hypot(pointer.x - vendor.x, pointer.y - (vendor.y - 17)) > 28) return null;
  return vendor;
}

/** The booth under the player's feet (or pointer), if any. */
export function focusedBooth(booths: readonly FaireBooth[], player: Pick<Player, 'x' | 'y' | 'dead'>, world: WorldQuery,
  pointer?: { x: number; y: number }): FaireBooth | null {
  if (player.dead) return null;
  return booths.filter(booth => Math.hypot(player.x - booth.x, player.y - booth.y) <= HOLIDAY_RULES.boothReach
      && !world.blocked(booth.x, booth.y, 0)
      && (!pointer || Math.hypot(pointer.x - booth.x, pointer.y - booth.y) <= 40))
    .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0] ?? null;
}

// ── Checkpoint validation ────────────────────────────────────────────────────

/** Checkpoint validator for `checkpoint.holiday`; wire into decodeCharacterSave. */
export function validHoliday(v: unknown): v is HolidayState {
  if (!object(v) || !integer(v.visits, 0, 1e6) || !integer(v.lastFaire, -1, 1e6)) return false;
  if (!object(v.completed) || Object.keys(v.completed).length > DARKMOON_ACTIVITIES.length) return false;
  return Object.entries(v.completed).every(([id, stamp]) =>
    DARKMOON_ACTIVITIES.some(a => a.id === id) && integer(stamp, -1, 1e9));
}
