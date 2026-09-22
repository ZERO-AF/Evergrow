import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RAID_CATALOG, calendarMonth, countdownLabel, raidLockoutRows, scheduledEvents,
} from '../src/calendar-state.ts';
import { RAID_ENTRANCE_IDS, raidLockoutLabel, raidResetAt, recordRaidLockout } from '../src/raid-lockout.ts';
import { RAID_ENTRANCE_ID } from '../src/raid-boss-content.ts';
import { RAID4_ENTRANCE_ID } from '../src/raid4-boss-content.ts';
import { faireWindowAt } from '../src/holiday-content.ts';
import { WORLD_EVENT_RULES } from '../src/world-event-content.ts';
import { freshWorldEvents, type InvasionEvent } from '../src/world-event-state.ts';
import { createCharacterSheet } from '../src/items.ts';

const NOW = Date.UTC(2026, 8, 20, 15); // Sep 20 2026 — faire away, next opens Oct 1
const OPEN = Date.UTC(2026, 8, 3, 15); // Sep 3 — inside the faire window

test('the raid catalog covers every lockout entrance id in order', () => {
  assert.deepEqual(RAID_CATALOG.map(r => r.id), [...RAID_ENTRANCE_IDS]);
  assert.equal(RAID_CATALOG.length, 9);
  for (const raid of RAID_CATALOG) assert.ok(raid.name && raid.boss, `${raid.id} has a name and boss`);
});

test('raidLockoutRows lists every raid available when the ledger is empty', () => {
  const rows = raidLockoutRows(createCharacterSheet(), NOW);
  assert.equal(rows.length, RAID_CATALOG.length);
  for (const row of rows) {
    assert.equal(row.locked, false);
    assert.equal(row.resetAt, 0);
    assert.equal(row.countdown, '');
  }
});

test('a recorded lockout surfaces as a locked row with the reset countdown', () => {
  const sheet = createCharacterSheet();
  recordRaidLockout(sheet, RAID4_ENTRANCE_ID, NOW);
  const rows = raidLockoutRows(sheet, NOW);
  const row = rows.find(r => r.id === RAID4_ENTRANCE_ID)!;
  assert.equal(row.locked, true);
  assert.equal(row.resetAt, raidResetAt(NOW) * 1000);
  assert.equal(row.countdown, raidLockoutLabel(sheet, RAID4_ENTRANCE_ID, NOW));
  assert.equal(rows[0].id, RAID4_ENTRANCE_ID, 'the locked raid sorts first');
  assert.equal(rows.filter(r => r.locked).length, 1);
});

test('locked rows sort by soonest expiry ahead of available raids', () => {
  const sheet = createCharacterSheet();
  // Two raids locked in the same weekly bucket share the boundary; a second
  // lockout stamped a week later expires later and sorts behind.
  recordRaidLockout(sheet, RAID_ENTRANCE_ID, NOW);
  recordRaidLockout(sheet, RAID4_ENTRANCE_ID, NOW + 7 * 86400000);
  const rows = raidLockoutRows(sheet, NOW);
  assert.deepEqual(rows.slice(0, 2).map(r => r.id), [RAID_ENTRANCE_ID, RAID4_ENTRANCE_ID]);
});

test('scheduledEvents reports the faire window and the invasion schedule', () => {
  const events = scheduledEvents(freshWorldEvents(), 0, NOW);
  const faire = events.find(e => e.kind === 'faire')!;
  assert.equal(faire.active, false);
  assert.equal(faire.countdown, (faireWindowAt(NOW).start - NOW) / 1000);
  const invasion = events.find(e => e.kind === 'invasion')!;
  assert.equal(invasion.active, false);
  assert.equal(invasion.countdown, WORLD_EVENT_RULES.firstAt);
  assert.ok(events.some(e => e.id === 'daily-reset'));
  assert.ok(events.some(e => e.id === 'weekly-reset'));
});

test('an active invasion reports its zone and remaining sim time', () => {
  const state = freshWorldEvents();
  state.active = {
    id: 'invasion:0', phase: 'active', zoneName: 'Dustwallow', level: 30, endsAt: 300,
  } as unknown as InvasionEvent;
  const events = scheduledEvents(state, 120, NOW);
  const invasion = events.find(e => e.kind === 'invasion')!;
  assert.equal(invasion.active, true);
  assert.equal(invasion.countdown, 180);
  assert.match(invasion.detail, /Dustwallow/);
  assert.match(invasion.label, /ends in/);
});

test('the faire row flips to active inside its window', () => {
  const events = scheduledEvents(undefined, 0, OPEN);
  const faire = events.find(e => e.kind === 'faire')!;
  assert.equal(faire.active, true);
  assert.equal(faire.countdown, (faireWindowAt(OPEN).end - OPEN) / 1000);
  assert.match(faire.label, /In town/);
});

test('a repelled invasion reports its waiting war chest, not a countdown', () => {
  const state = freshWorldEvents();
  state.active = {
    id: 'invasion:0', phase: 'won', zoneName: 'Dustwallow', level: 30, endsAt: 300,
  } as unknown as InvasionEvent;
  const invasion = scheduledEvents(state, 120, NOW).find(e => e.kind === 'invasion')!;
  assert.equal(invasion.active, true);
  assert.equal(invasion.countdown, null);
  assert.equal(invasion.countdownLabel, '');
  assert.match(invasion.label, /war chest/);
});

test('countdownLabel mirrors the lockout label shape', () => {
  assert.equal(countdownLabel(6 * 86400 + 23 * 3600), '6d 23h');
  assert.equal(countdownLabel(23 * 3600 + 59 * 60), '23h 59m');
  assert.equal(countdownLabel(599), '9:59');
  assert.equal(countdownLabel(0), '0:00');
});

test('calendarMonth flags today, faire days and the weekly reset boundary', () => {
  const month = calendarMonth(NOW); // September 2026
  assert.equal(month.label, 'September 2026');
  assert.equal(month.weekdays.length, 7);
  const days = month.days.filter(d => d.day > 0);
  assert.equal(days.length, 30);
  assert.equal(days[19].today, true, 'Sep 20 is today');
  assert.equal(days.filter(d => d.faire).length, 0, 'the faire left on the 8th');
  const open = calendarMonth(OPEN);
  assert.deepEqual(open.days.filter(d => d.faire).map(d => d.day), [1, 2, 3, 4, 5, 6, 7]);
  const resets = days.filter(d => d.reset).map(d => d.day);
  assert.ok(resets.length >= 4, 'a weekly boundary lands most weeks');
  for (const d of resets) assert.equal(Date.UTC(2026, 8, d) % (7 * 86400000), 0);
});
