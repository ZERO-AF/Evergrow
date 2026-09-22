import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DARKMOON_ACTIVITIES, DARKMOON_PRIZES, HOLIDAY_RULES, activityOutcome, faireActivity,
  faireActive, faireBooths, faireSite, faireStatus, faireVendor,
  faireWindowAt, prizeEntry,
} from '../src/holiday-content.ts';
import {
  activityFlag, compactHoliday, faireDayKey, freshHoliday, holidayOf, spendTickets,
  ticketBalance, creditTickets, validHoliday, type HolidayWallet,
} from '../src/holiday-state.ts';
import { buyPrize, buyPrizeProblem, playActivity, playProblem } from '../src/holiday-command.ts';
import { COMPANION_RULES } from '../src/companion-state.ts';
import { mountFlagKey } from '../src/mount-state.ts';
import { createWowSim } from './fixtures/wow-sim.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';
import type { CharacterSheet } from '../src/character-types.ts';

/** The sheet gains `darkmoonTickets` when the integrator extends CharacterSheet
 * with HolidayWallet; until then the wallet view needs the intersection. */
const walletOf = (sim: ReturnType<typeof createWowSim>) => sim.player.character as CharacterSheet & HolidayWallet;

/** Mid-window and off-season instants (UTC). */
const OPEN = Date.UTC(2026, 8, 3, 15);       // Sep 3 — inside the first week
const OPEN_NEXT_DAY = Date.UTC(2026, 8, 4, 15);
const CLOSED = Date.UTC(2026, 8, 20, 15);    // Sep 20 — faire away
const NEXT_OPEN = Date.UTC(2026, 9, 2, 15);  // Oct 2 — next window

const persist = async (checkpoint: CharacterCheckpoint) => ({ ok: true, message: '', checkpoint });

function simAtBooth() {
  const sim = createWowSim();
  const site = faireSite(sim.world);
  const booths = faireBooths(site);
  const booth = booths[0];
  sim.player.x = booth.x; sim.player.y = booth.y;
  return { sim, site, booths, booth };
}

test('the faire window opens on the 1st and closes after the 7th UTC day', () => {
  assert.equal(faireActive(OPEN), true);
  assert.equal(faireActive(Date.UTC(2026, 8, 1, 0)), true);
  assert.equal(faireActive(Date.UTC(2026, 8, 7, 23)), true);
  assert.equal(faireActive(Date.UTC(2026, 8, 8, 0)), false);
  assert.equal(faireActive(CLOSED), false);
  const window = faireWindowAt(OPEN);
  assert.equal(window.start, Date.UTC(2026, 8, 1));
  assert.equal(window.end, Date.UTC(2026, 8, 8));
  // Mid-month reads the next month's window.
  const next = faireWindowAt(CLOSED);
  assert.equal(next.start, Date.UTC(2026, 9, 1));
  assert.equal(next.index - window.index, 1);
  assert.match(faireStatus(CLOSED).label, /returns in/);
  assert.match(faireStatus(OPEN).label, /in town/);
});

test('the faire site, booths and vendor are deterministic per world seed', () => {
  const sim = createWowSim();
  const a = faireSite(sim.world), b = faireSite(sim.world);
  assert.deepEqual(a, b);
  const booths = faireBooths(a);
  assert.equal(booths.length, DARKMOON_ACTIVITIES.length);
  assert.deepEqual(booths.map(b => b.activityId), DARKMOON_ACTIVITIES.map(d => d.id));
  for (const booth of booths)
    assert.ok(Math.abs(Math.hypot(booth.x - a.x, booth.y - a.y) - HOLIDAY_RULES.boothRing) < 1e-6);
  const vendor = faireVendor(a);
  assert.equal(vendor.role, 'darkmoonVendor');
  assert.equal(vendor.faction, 'neutral');
  assert.ok(Math.abs(vendor.y - (a.y + HOLIDAY_RULES.vendorOffset)) < 1e-6);
});

test('playing a booth awards the seeded ticket outcome and stamps the flag', async () => {
  const { sim, site, booth } = simAtBooth();
  const activity = DARKMOON_ACTIVITIES[0];
  const flag = activityFlag(activity, OPEN);
  const expected = activityOutcome(site.seed, activity, flag, sim.player.character.attributes[activity.attribute]);
  const result = await playActivity(sim, booth, persist, OPEN);
  assert.equal(result.ok, true);
  assert.equal(ticketBalance(walletOf(sim)), expected.tickets);
  assert.equal(holidayOf(sim).completed[activity.id], flag);
  assert.equal(holidayOf(sim).visits, 1);
  // Same window, same flag → blocked.
  assert.match(playProblem(sim, booth, OPEN) ?? '', /Already played today/);
  const again = await playActivity(sim, booth, persist, OPEN);
  assert.equal(again.ok, false);
  assert.equal(ticketBalance(walletOf(sim)), expected.tickets);
});

test('daily booths re-arm the next UTC day; once-per-faire booths wait a month', async () => {
  const { sim, booths } = simAtBooth();
  const daily = booths.find(b => faireActivity(b.activityId)?.id === 'whack-a-gnoll')!;
  const once = booths.find(b => faireActivity(b.activityId)?.id === 'sayges-fortunes')!;
  for (const booth of [daily, once]) { sim.player.x = booth.x; sim.player.y = booth.y; assert.equal((await playActivity(sim, booth, persist, OPEN)).ok, true); }
  // Next UTC day inside the same window: the daily re-arms, the faire flag holds.
  sim.player.x = daily.x; sim.player.y = daily.y;
  assert.equal(playProblem(sim, daily, OPEN_NEXT_DAY), null);
  assert.equal((await playActivity(sim, daily, persist, OPEN_NEXT_DAY)).ok, true);
  sim.player.x = once.x; sim.player.y = once.y;
  assert.match(playProblem(sim, once, OPEN_NEXT_DAY) ?? '', /Already done this faire/);
  // Next month's window: both re-arm.
  sim.player.x = daily.x; sim.player.y = daily.y;
  assert.equal(playProblem(sim, daily, NEXT_OPEN), null);
  sim.player.x = once.x; sim.player.y = once.y;
  assert.equal(playProblem(sim, once, NEXT_OPEN), null);
});

test('the window gates play and purchases', async () => {
  const { sim, site, booth } = simAtBooth();
  assert.match(playProblem(sim, booth, CLOSED) ?? '', /not opened/);
  assert.equal((await playActivity(sim, booth, persist, CLOSED)).ok, false);
  const vendor = faireVendor(site);
  sim.player.x = vendor.x; sim.player.y = vendor.y;
  creditTickets(walletOf(sim), 500);
  const result = await buyPrize(sim, vendor, 'faire-beret', persist, CLOSED);
  assert.equal(result.ok, false);
  assert.match(result.message, /left town/);
});

test('buying prizes spends tickets and delivers gear, companions and mounts', async () => {
  const { sim, site } = simAtBooth();
  const vendor = faireVendor(site);
  sim.player.x = vendor.x; sim.player.y = vendor.y;
  creditTickets(walletOf(sim), 215);

  // Gear lands in the bag.
  const beret = prizeEntry('faire-beret')!;
  const before = ticketBalance(walletOf(sim));
  const bought = await buyPrize(sim, vendor, beret.id, persist, OPEN);
  assert.equal(bought.ok, true);
  assert.equal(ticketBalance(walletOf(sim)), before - beret.price);
  assert.ok(sim.player.character.inventory.some(i => i?.name === 'Darkmoon Beret'));

  // Companion sets the collection marker and refuses a second copy.
  const cub = prizeEntry('darkmoon-cub')!;
  assert.equal(buyPrizeProblem(walletOf(sim), cub, sim.player.level, sim.player.achievements), null);
  assert.equal((await buyPrize(sim, vendor, cub.id, persist, OPEN)).ok, true);
  assert.equal(sim.player.achievements?.[`${COMPANION_RULES.seenPrefix}worg-pup`], 1);
  assert.match(buyPrizeProblem(walletOf(sim), cub, sim.player.level, sim.player.achievements) ?? '', /Already in your collection/);

  // Mount sets the unlock flag.
  const bear = prizeEntry('dancing-bear')!;
  assert.equal((await buyPrize(sim, vendor, bear.id, persist, OPEN)).ok, true);
  assert.equal(sim.player.achievements?.[mountFlagKey('polarBear')], 1);
  assert.match(buyPrizeProblem(walletOf(sim), bear, sim.player.level, sim.player.achievements) ?? '', /Already in your stable/);

  // Insufficient tickets refuse the sale without touching the wallet.
  const balance = ticketBalance(walletOf(sim));
  const pricey = DARKMOON_PRIZES.find(e => e.price > balance)!;
  assert.ok(pricey, 'expected a prize above the remaining balance');
  const refused = await buyPrize(sim, vendor, pricey.id, persist, OPEN);
  assert.equal(refused.ok, false);
  assert.equal(ticketBalance(walletOf(sim)), balance);
});

test('a failed persist leaves tickets and flags untouched', async () => {
  const { sim, booth } = simAtBooth();
  const fail = async () => ({ ok: false, message: 'disk full' });
  const result = await playActivity(sim, booth, fail, OPEN);
  assert.equal(result.ok, false);
  assert.equal(ticketBalance(walletOf(sim)), 0);
  assert.equal(holidayOf(sim).completed[DARKMOON_ACTIVITIES[0].id], undefined);
});

test('holiday state validates and compacts stale flags', () => {
  const state = freshHoliday();
  assert.equal(validHoliday(state), true);
  state.completed['whack-a-gnoll'] = faireDayKey(OPEN) - 3;   // stale day stamp
  state.completed['sayges-fortunes'] = faireWindowAt(OPEN).index - 1; // prior faire
  state.completed['ring-toss'] = faireDayKey(OPEN);           // today — kept
  const pruned = compactHoliday(state, OPEN);
  assert.deepEqual(pruned.sort(), ['sayges-fortunes', 'whack-a-gnoll']);
  assert.equal(state.completed['ring-toss'], faireDayKey(OPEN));
  assert.equal(validHoliday(state), true);
  // Garbage fails validation.
  assert.equal(validHoliday({ visits: -1, lastFaire: 0, completed: {} }), false);
  assert.equal(validHoliday({ visits: 0, lastFaire: 0, completed: { bogus: 1 } }), false);
  assert.equal(validHoliday({ visits: 0, lastFaire: 0, completed: { 'ring-toss': 1.5 } }), false);
});

test('ticket wallet helpers are atomic', () => {
  const wallet: { darkmoonTickets?: number } = {};
  assert.equal(creditTickets(wallet, 10), true);
  assert.equal(ticketBalance(wallet), 10);
  assert.equal(spendTickets(wallet, 4), true);
  assert.equal(ticketBalance(wallet), 6);
  assert.equal(spendTickets(wallet, 7), false);
  assert.equal(ticketBalance(wallet), 6);
  assert.equal(creditTickets(wallet, -5), false);
  assert.equal(creditTickets(wallet, 1.5), false);
});
