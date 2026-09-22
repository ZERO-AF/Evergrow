/** Darkmoon Faire commands: the durable booth play and prize purchase.
 * Both stage their change on a checkpoint clone, persist, then commit —
 * mirroring badge-vendor.ts's executeBadgeBuy and pvp-vendor.ts's
 * executePvpBuy (which also stages the achievement ledger for unlocks). */
import { cloneData } from './data-clone.ts';
import { refreshCharacter } from './character.ts';
import { addInventoryItem } from './inventory.ts';
import { canPackItem } from './inventory-grid.ts';
import { pushChatMessage } from './chat-log.ts';
import { COMPANION_RULES } from './companion-state.ts';
import { mountFlagKey } from './mount-state.ts';
import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { CharacterSheet } from './character-types.ts';
import {
  DARKMOON_PRIZES, HOLIDAY_RULES, TICKET_NAME, activityOutcome, faireActive, faireActivity,
  faireWindowAt, prizeEntry, prizeItem, type FaireBooth, type FaireNPC, type PrizeEntry,
} from './holiday-content.ts';
import {
  activityDone, activityFlag, canInteractFaireNPC, compactHoliday, creditTickets,
  holidayEnabled, holidayOf, spendTickets, ticketBalance, formatTickets,
  type HolidayState, type HolidayWallet,
} from './holiday-state.ts';

export interface HolidayResult { ok: boolean; message: string }
export type HolidayPersist = (checkpoint: CharacterCheckpoint) => HolidayResult | Promise<HolidayResult>;

/** The checkpoint fields this feature stages; the integrator persists them on save.
 * `character` intersects HolidayWallet so ticket credit/spend type-checks before
 * CharacterSheet gains the field. */
export type CheckpointWithHoliday = Omit<CharacterCheckpoint, 'character'> & { character: CharacterSheet & HolidayWallet; holiday?: HolidayState; achievements?: Record<string, number> };

/** Why a booth cannot be played right now; null means it can. */
export function playProblem(sim: Simulation, booth: FaireBooth, now = Date.now()): string | null {
  if (!holidayEnabled()) return 'The faire is not available.';
  if (!faireActive(now)) return 'The faire has not opened yet.';
  const activity = faireActivity(booth.activityId);
  if (!activity) return 'That booth is closed.';
  const p = sim.player;
  if (p.dead) return 'Not while dead.';
  if (Math.hypot(p.x - booth.x, p.y - booth.y) > HOLIDAY_RULES.boothReach) return 'Move closer to the booth.';
  if (activityDone(holidayOf(sim), activity, now))
    return activity.limit === 'day' ? 'Already played today — come back tomorrow.' : 'Already done this faire.';
  return null;
}

/** Play a booth: the seeded skill check pays Darkmoon Prize Tickets and stamps
 * the activity's flag (UTC day or faire index). Flag and tickets persist
 * together before going live. */
export async function playActivity(sim: Simulation, booth: FaireBooth, persist: HolidayPersist, now = Date.now()): Promise<HolidayResult> {
  const problem = playProblem(sim, booth, now);
  if (problem) return { ok: false, message: problem };
  const activity = faireActivity(booth.activityId)!;
  const p = sim.player;
  const flag = activityFlag(activity, now);
  const outcome = activityOutcome(booth.site.seed, activity, flag, p.character.attributes[activity.attribute]);
  const checkpoint = sim.captureCheckpoint() as CheckpointWithHoliday;
  const staged = checkpoint.holiday = cloneData(checkpoint.holiday ?? holidayOf(sim));
  if (staged.completed[activity.id] === flag) return { ok: false, message: 'Already played.' };
  if (!creditTickets(checkpoint.character, outcome.tickets)) return { ok: false, message: 'Your ticket pouch cannot hold any more.' };
  staged.completed[activity.id] = flag;
  if (staged.lastFaire !== faireWindowAt(now).index) { staged.lastFaire = faireWindowAt(now).index; staged.visits++; }
  compactHoliday(staged, now);
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. No tickets were awarded.' };
  const carrier = sim as unknown as { holiday?: HolidayState };
  carrier.holiday = staged;
  p.character = checkpoint.character;
  refreshCharacter(p);
  const message = outcome.success
    ? `${activity.name}: ${outcome.critical ? 'a perfect run' : 'success'}! Won ${outcome.tickets} ${TICKET_NAME}${outcome.tickets === 1 ? '' : 's'}.`
    : `${activity.name}: missed the mark — the barkers slip you ${outcome.tickets} consolation ${TICKET_NAME}${outcome.tickets === 1 ? '' : 's'}.`;
  pushChatMessage(p, 'loot', message, sim.time);
  return { ok: true, message };
}

// ── Buy a prize ──────────────────────────────────────────────────────────────

/** Why a prize row cannot be bought right now; null means purchasable. */
export function buyPrizeProblem(sheet: HolidayWallet & Pick<CharacterSheet, 'inventory' | 'inventoryLayout' | 'bags'>,
  entry: PrizeEntry, level: number, owned?: Readonly<Record<string, number>>): string | null {
  if (entry.kind === 'companion' && (owned?.[`${COMPANION_RULES.seenPrefix}${entry.companion}`] ?? 0) > 0) return 'Already in your collection.';
  if (entry.kind === 'mount' && (owned?.[mountFlagKey(entry.mount)] ?? 0) > 0) return 'Already in your stable.';
  if (ticketBalance(sheet) < entry.price) return `Not enough ${TICKET_NAME}s.`;
  if (entry.kind === 'gear' && !canPackItem(sheet, prizeItem(entry, level, 0))) return 'No room in your bag.';
  return null;
}

/** Buy a prize row: spends tickets and delivers gear to the bag — or, for
 * companions and mounts, sets the collection/unlock marker on the achievement
 * ledger (the same staging executePvpBuy uses for the arena drake). */
export async function buyPrize(sim: Simulation, vendor: FaireNPC, stockId: string, persist: HolidayPersist, now = Date.now()): Promise<HolidayResult> {
  const p = sim.player;
  if (!holidayEnabled()) return { ok: false, message: 'The faire is not available.' };
  if (!faireActive(now)) return { ok: false, message: 'The faire has left town.' };
  const entry = prizeEntry(stockId);
  if (!entry || !DARKMOON_PRIZES.includes(entry)) return { ok: false, message: 'That prize is not sold here.' };
  if (!canInteractFaireNPC(vendor, p, sim.world)) return { ok: false, message: 'The prize vendor is no longer in reach.' };
  const sheet = p.character as CharacterSheet & HolidayWallet;
  const problem = buyPrizeProblem(sheet, entry, p.level, p.achievements);
  if (problem) return { ok: false, message: problem };
  const checkpoint = sim.captureCheckpoint() as CheckpointWithHoliday;
  if (!spendTickets(checkpoint.character, entry.price))
    return { ok: false, message: `Not enough ${TICKET_NAME}s.` };
  if (entry.kind === 'gear') {
    const item = prizeItem(entry, p.level, ((checkpoint.character.commerce.operations + 1) * 0x9e3779b1 + ticketBalance(checkpoint.character)) >>> 0);
    item.id += `:faire:${entry.id}:${checkpoint.character.commerce.operations}`;
    if (!addInventoryItem(checkpoint.character, item)) return { ok: false, message: 'No room in your bag.' };
  } else {
    const key = entry.kind === 'companion' ? `${COMPANION_RULES.seenPrefix}${entry.companion}` : mountFlagKey(entry.mount);
    checkpoint.achievements = { ...p.achievements, [key]: 1 };
  }
  checkpoint.character.commerce.operations++;
  const staged = checkpoint.holiday = cloneData(checkpoint.holiday ?? holidayOf(sim));
  if (staged.lastFaire !== faireWindowAt(now).index) { staged.lastFaire = faireWindowAt(now).index; staged.visits++; }
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. No tickets were spent.' };
  const carrier = sim as unknown as { holiday?: HolidayState };
  carrier.holiday = staged;
  p.character = checkpoint.character;
  if (checkpoint.achievements) p.achievements = checkpoint.achievements;
  refreshCharacter(p);
  const message = `Bought ${entry.name} for ${formatTickets(entry.price)} ${TICKET_NAME}s.`;
  pushChatMessage(p, 'loot', message, sim.time);
  return { ok: true, message };
}
