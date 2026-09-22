/** Calendar read models (WoW calendar): pure projections that feed
 * calendar-panel.ts — the raid-ID ledger, the Darkmoon Faire window and the
 * Scourge Invasion schedule, plus a month-grid projection for the header.
 * No live state, no mutations; every function derives from `now` (epoch ms)
 * and `simTime` (simulation seconds) exactly like the HUD read models. */
import {
  RAID_LOCKOUT_RULES, raidLockedOut, raidLockoutLabel,
  type RaidLockoutCarrier,
} from './raid-lockout.ts';
import { RAID_ENTRANCE_ID, RAID_BOSS_NAME } from './raid-boss-content.ts';
import { RAID2_ENTRANCE_ID, RAID2_BOSS_NAME } from './raid2-boss-content.ts';
import { RAID3_ENTRANCE_ID, RAID3_BOSS_NAME } from './raid3-boss-content.ts';
import { RAID4_ENTRANCE_ID, RAID4_BOSS_NAME } from './raid4-boss-content.ts';
import { RAID5_ENTRANCE_ID, RAID5_BOSS_NAME } from './raid5-boss-content.ts';
import { RAID6_ENTRANCE_ID, RAID6_BOSS_NAME } from './raid6-boss-content.ts';
import { RAID7_ENTRANCE_ID, RAID7_BOSS_NAME } from './raid7-boss-content.ts';
import { RAID8_ENTRANCE_ID, RAID8_BOSS_NAME } from './raid8-boss-content.ts';
import { RAID9_ENTRANCE_ID, RAID9_BOSS_NAME } from './raid9-boss-content.ts';
import { FAIRE_NAME, faireWindowAt } from './holiday-content.ts';
import { INVASION_NAME, WORLD_EVENT_RULES } from './world-event-content.ts';
import type { WorldEventState } from './world-event-state.ts';
import { dailyResetCountdown } from './quest-state.ts';

// ── Raids ────────────────────────────────────────────────────────────────────

export interface RaidDef {
  /** Entrance id — the key `character.raidLockouts` is stamped under. */
  readonly id: string;
  /** Instance name as the entrance advertises it. */
  readonly name: string;
  /** Final boss, for the row subtitle. */
  readonly boss: string;
}

/** The WotLK raid catalog, in raid-lockout's canonical entrance order. */
export const RAID_CATALOG: readonly RaidDef[] = Object.freeze([
  { id: RAID_ENTRANCE_ID, name: "Onyxia's Lair", boss: RAID_BOSS_NAME },
  { id: RAID2_ENTRANCE_ID, name: 'Molten Core', boss: RAID2_BOSS_NAME },
  { id: RAID3_ENTRANCE_ID, name: 'Naxxramas', boss: RAID3_BOSS_NAME },
  { id: RAID4_ENTRANCE_ID, name: 'Icecrown Citadel', boss: RAID4_BOSS_NAME },
  { id: RAID5_ENTRANCE_ID, name: 'Eye of Eternity', boss: RAID5_BOSS_NAME },
  { id: RAID6_ENTRANCE_ID, name: 'Obsidian Sanctum', boss: RAID6_BOSS_NAME },
  { id: RAID7_ENTRANCE_ID, name: 'Ulduar', boss: RAID7_BOSS_NAME },
  { id: RAID8_ENTRANCE_ID, name: 'Trial of the Crusader', boss: RAID8_BOSS_NAME },
  { id: RAID9_ENTRANCE_ID, name: 'Ruby Sanctum', boss: RAID9_BOSS_NAME },
]);

export interface RaidLockoutRow {
  readonly id: string;
  readonly name: string;
  readonly boss: string;
  /** True while the receipt is inside its weekly bucket. */
  readonly locked: boolean;
  /** Epoch-ms the lockout expires; 0 when the raid is available. */
  readonly resetAt: number;
  /** "6d 23h" countdown while locked; '' when available. */
  readonly countdown: string;
}

/** Every raid with its lockout receipt projected for the panel. Locked rows
 * sort first (soonest expiry), then available raids by name. */
export function raidLockoutRows(sheet: RaidLockoutCarrier, now: number): RaidLockoutRow[] {
  const rows = RAID_CATALOG.map(raid => {
    const locked = raidLockedOut(sheet, raid.id, now);
    const receipt = sheet.raidLockouts?.[raid.id];
    return {
      id: raid.id, name: raid.name, boss: raid.boss, locked,
      resetAt: locked && receipt !== undefined ? receipt * 1000 : 0,
      countdown: locked ? raidLockoutLabel(sheet, raid.id, now) : '',
    };
  });
  return rows.sort((a, b) =>
    (b.locked ? 1 : 0) - (a.locked ? 1 : 0)
    || (a.locked && b.locked ? a.resetAt - b.resetAt : 0)
    || a.name.localeCompare(b.name));
}

// ── Scheduled events ─────────────────────────────────────────────────────────

export type ScheduledEventKind = 'faire' | 'invasion' | 'reset';

export interface ScheduledEvent {
  readonly id: string;
  readonly kind: ScheduledEventKind;
  readonly name: string;
  /** Zone/level or scope detail ("All raids", "Level 30 · Dustwallow"). */
  readonly detail: string;
  /** True while the event is running (faire open, invasion on the field). */
  readonly active: boolean;
  /** Seconds until the event starts, or until it ends while active; null when
   * no clock applies (a won invasion waiting on its chest claim). */
  readonly countdown: number | null;
  /** "6d 23h" / "9:59" countdown text; '' when `countdown` is null. */
  readonly countdownLabel: string;
  /** One-line status, mirroring faireStatus/worldEventProgress labels. */
  readonly label: string;
}

/** "6d 23h" / "23h 59m" / "9:59" — the lockout label shape for a raw second count. */
export function countdownLabel(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The calendar's Events list: the Darkmoon Faire window (real-time UTC), the
 * Scourge Invasion schedule (sim seconds), and the daily/weekly reset ticks.
 * `worldEvents`/`simTime` may be omitted by hosts that never enabled the
 * invasion schedule — the row then reports the seeded first invasion.
 */
export function scheduledEvents(
  worldEvents: Pick<WorldEventState, 'nextAt' | 'active'> | undefined,
  simTime: number,
  now: number,
): ScheduledEvent[] {
  const events: ScheduledEvent[] = [];

  const faire = faireWindowAt(now);
  const faireOpen = now >= faire.start;
  const faireLeft = Math.max(0, (faireOpen ? faire.end : faire.start) - now);
  events.push({
    id: 'darkmoon-faire', kind: 'faire', name: FAIRE_NAME,
    detail: 'Carnival games & prize tickets',
    active: faireOpen, countdown: faireLeft / 1000, countdownLabel: countdownLabel(faireLeft / 1000),
    label: faireOpen ? `In town — closes in ${countdownLabel(faireLeft / 1000)}` : `Returns in ${countdownLabel(faireLeft / 1000)}`,
  });

  const invasion = worldEvents?.active ?? null;
  if (invasion && invasion.phase === 'active') {
    const left = Math.max(0, invasion.endsAt - simTime);
    events.push({
      id: invasion.id, kind: 'invasion', name: INVASION_NAME,
      detail: `Level ${invasion.level} · ${invasion.zoneName}`,
      active: true, countdown: left, countdownLabel: countdownLabel(left),
      label: `Necropolis over ${invasion.zoneName} — ends in ${countdownLabel(left)}`,
    });
  } else if (invasion && (invasion.phase === 'won' || invasion.phase === 'claimed')) {
    events.push({
      id: invasion.id, kind: 'invasion', name: INVASION_NAME,
      detail: `Level ${invasion.level} · ${invasion.zoneName}`,
      active: true, countdown: null, countdownLabel: '',
      label: invasion.phase === 'won' ? `Repelled — war chest waiting in ${invasion.zoneName}` : `Repelled in ${invasion.zoneName}`,
    });
  } else {
    const nextAt = worldEvents?.nextAt ?? WORLD_EVENT_RULES.firstAt;
    const left = Math.max(0, nextAt - simTime);
    events.push({
      id: 'scourge-invasion', kind: 'invasion', name: INVASION_NAME,
      detail: `Every ${Math.round(WORLD_EVENT_RULES.interval / 60)}m · a necropolis lands in a remote zone`,
      active: false, countdown: left, countdownLabel: countdownLabel(left),
      label: `Next invasion in ${countdownLabel(left)}`,
    });
  }

  const daily = dailyResetCountdown(now);
  events.push({
    id: 'daily-reset', kind: 'reset', name: 'Daily reset',
    detail: 'Daily quests & faire booths',
    active: false, countdown: daily, countdownLabel: countdownLabel(daily),
    label: `Dailies reset in ${countdownLabel(daily)}`,
  });

  const weekly = Math.max(0, Math.ceil(now / WEEK_MS) * WEEK_MS - now) / 1000;
  events.push({
    id: 'weekly-reset', kind: 'reset', name: 'Weekly raid reset',
    detail: 'All raid lockouts',
    active: false, countdown: weekly, countdownLabel: countdownLabel(weekly),
    label: `Raid lockouts reset in ${countdownLabel(weekly)}`,
  });

  return events;
}

const WEEK_MS = RAID_LOCKOUT_RULES.weekMs;

// ── Month grid ───────────────────────────────────────────────────────────────

export interface CalendarDay {
  /** UTC day-of-month; 0 marks a leading padding cell. */
  readonly day: number;
  readonly today: boolean;
  /** Inside the Darkmoon Faire window (the 1st–7th UTC). */
  readonly faire: boolean;
  /** A weekly raid-reset boundary falls on this day. */
  readonly reset: boolean;
}

export interface CalendarMonth {
  /** "September 2026" heading. */
  readonly label: string;
  /** Monday-first weekday initials. */
  readonly weekdays: readonly string[];
  /** Leading padding + month days, row-major seven per row. */
  readonly days: readonly CalendarDay[];
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'] as const;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const DAY_MS = 86400000;

/** Compact UTC month grid for the panel header: today, faire days and the
 * weekly reset boundary (a fixed 7-day epoch bucket) are flagged per cell. */
export function calendarMonth(now: number): CalendarMonth {
  const date = new Date(now);
  const year = date.getUTCFullYear(), month = date.getUTCMonth(), today = date.getUTCDate();
  const first = Date.UTC(year, month, 1);
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const pad = (new Date(first).getUTCDay() + 6) % 7; // Monday-first
  const faire = faireWindowAt(now);
  const days: CalendarDay[] = [];
  for (let i = 0; i < pad; i++) days.push({ day: 0, today: false, faire: false, reset: false });
  for (let d = 1; d <= length; d++) {
    const start = Date.UTC(year, month, d);
    days.push({
      day: d,
      today: d === today,
      faire: start + DAY_MS > faire.start && start < faire.end,
      reset: start % WEEK_MS === 0,
    });
  }
  return { label: `${MONTH_NAMES[month]} ${year}`, weekdays: WEEKDAYS, days };
}
