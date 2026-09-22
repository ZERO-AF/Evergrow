/** Calendar panel (WoW calendar): a read-only projection of the raid-ID
 * lockout ledger, the Darkmoon Faire window and the Scourge Invasion schedule,
 * under a compact month-grid header. Pure presentation — the panel never
 * mutates state; rows derive from calendar-state.ts on each `update(now)`. */
import { attachPanelFrame, detachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import type { RaidLockoutCarrier } from './raid-lockout.ts';
import type { WorldEventState } from './world-event-state.ts';
import {
  calendarMonth, raidLockoutRows, scheduledEvents,
  type RaidLockoutRow, type ScheduledEvent,
} from './calendar-state.ts';
import './calendar-panel.css';

const esc = escapeUI;

/** Everything the calendar reads; the host supplies it once at construction. */
export interface CalendarSources {
  /** `sim.player.character` — carries the `raidLockouts` ledger. */
  readonly sheet: RaidLockoutCarrier;
  /** `sim.worldEvents` — the invasion schedule (optional until wired). */
  readonly worldEvents?: Pick<WorldEventState, 'nextAt' | 'active'>;
  /** `sim.time` — simulation seconds; invasion countdowns tick on this clock. */
  readonly simTime: number;
}

/** Calendar emblem — a month grid with a marked day. */
const CALENDAR_EMBLEM = `<svg viewBox="-12 -12 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="-9" y="-8" width="18" height="17" rx="1.5"/><path d="M-9 -3.5h18M-4.5 -10v4M4.5 -10v4"/><path d="M-4.5 1h4M.5 5h4" stroke-width="1.2"/><rect x="-4.5" y="1" width="4" height="4" fill="currentColor" stroke="none"/></svg>`;

const EVENT_ICONS = { faire: 'star', invasion: 'skull', reset: 'options' } as const;

export class CalendarPanel {
  readonly element: HTMLElement;
  private readonly abort = new AbortController();
  private readonly sources: () => CalendarSources;
  private readonly onClose: () => void;
  private focus: { dispose(): void } | null = null;
  private signature = '';

  constructor(mount: HTMLElement, sources: () => CalendarSources, onClose: () => void) {
    this.sources = sources;
    this.onClose = onClose;
    this.element = document.createElement('section');
    this.element.className = 'calendar-panel';
    this.element.hidden = true;
    mount.append(this.element);
    attachPanelFrame(this.element, 'calendar');
    const signal = this.abort.signal;
    this.element.addEventListener('click', event => {
      if ((event.target as HTMLElement).closest('[data-close]')) this.onClose();
    }, { signal });
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); this.onClose(); }
    }, { signal });
  }

  get isOpen(): boolean { return !this.element.hidden; }

  open(): void {
    this.signature = '';
    this.element.hidden = false;
    this.render();
    this.focus?.dispose();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal, initialFocus: this.element, restoreFocus: false });
  }

  close(): void {
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
  }

  /** Refresh the projection; re-renders only while open and a second ticked. */
  update(now = Date.now()): void {
    if (this.element.hidden) return;
    const src = this.sources();
    const signature = JSON.stringify([
      src.sheet.raidLockouts ?? {},
      src.worldEvents?.nextAt ?? 0,
      src.worldEvents?.active?.id ?? '',
      src.worldEvents?.active?.phase ?? '',
      src.worldEvents?.active?.endsAt ?? 0,
      Math.floor(src.simTime),
      Math.floor(now / 1000),
    ]);
    if (signature !== this.signature) { this.signature = signature; this.render(now); }
  }

  private raidRow(row: RaidLockoutRow): string {
    const status = row.locked
      ? `<span class="calendar-raid-status is-locked">Locked · resets in ${esc(row.countdown)}</span>`
      : '<span class="calendar-raid-status is-open">Available</span>';
    return `<article class="calendar-raid ${row.locked ? 'is-locked' : 'is-open'}">
      <span class="calendar-raid-icon">${uiIcon('skull')}</span>
      <div class="calendar-raid-copy"><strong>${esc(row.name)}</strong><small>${esc(row.boss)}</small></div>
      ${status}</article>`;
  }

  private eventRow(event: ScheduledEvent): string {
    const when = event.countdown === null ? '—' : esc(event.countdownLabel);
    const hint = event.countdown === null ? 'status' : event.active ? 'remaining' : 'until start';
    return `<article class="calendar-event ${event.active ? 'is-active' : ''}" title="${esc(event.label)}">
      <span class="calendar-event-icon">${uiIcon(EVENT_ICONS[event.kind])}</span>
      <div class="calendar-event-copy"><strong>${esc(event.name)}</strong><small>${esc(event.detail)}</small></div>
      <div class="calendar-event-when"><b>${when}</b><small>${hint}</small></div>
    </article>`;
  }

  private monthGrid(now: number): string {
    const month = calendarMonth(now);
    const cells = month.days.map(d => d.day === 0
      ? '<span class="calendar-day is-pad" aria-hidden="true"></span>'
      : `<span class="calendar-day${d.today ? ' is-today' : ''}${d.faire ? ' is-faire' : ''}${d.reset ? ' is-reset' : ''}"${d.faire ? ' title="Darkmoon Faire"' : d.reset ? ' title="Weekly raid reset"' : ''}>${d.day}</span>`).join('');
    return `<div class="calendar-month" aria-label="${esc(month.label)}">
      <div class="calendar-month-head"><strong>${esc(month.label)}</strong><span class="calendar-legend"><i class="is-faire"></i>Faire <i class="is-reset"></i>Reset <i class="is-today"></i>Today</span></div>
      <div class="calendar-weekdays">${month.weekdays.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="calendar-days">${cells}</div></div>`;
  }

  private render(now = Date.now()): void {
    const src = this.sources();
    const raids = raidLockoutRows(src.sheet, now);
    const events = scheduledEvents(src.worldEvents, src.simTime, now);
    const locked = raids.filter(r => r.locked).length;
    const refocus = this.element.contains(document.activeElement);
    this.element.innerHTML = `<section class="ui-window calendar-window" role="dialog" aria-modal="true" aria-labelledby="calendar-title">
      <header class="ui-window-header"><span class="ui-header-emblem calendar-emblem">${CALENDAR_EMBLEM}</span><h2 class="ui-title" id="calendar-title">Calendar</h2><button class="ui-button ui-button--icon" data-close aria-label="Close calendar">×</button></header>
      <div class="calendar-body ui-scroll-area">
        ${this.monthGrid(now)}
        <h3 class="calendar-section">This Week <span class="calendar-section-meta">${locked} / ${raids.length} raids locked</span></h3>
        <div class="calendar-raids">${raids.map(row => this.raidRow(row)).join('')}</div>
        <h3 class="calendar-section">Events</h3>
        <div class="calendar-events">${events.map(event => this.eventRow(event)).join('')}</div>
      </div>
      <footer class="ui-window-footer"><span class="ui-muted">Read-only schedule · resets tick in real time</span><span>Esc <span class="ui-muted">Close</span></span></footer></section>`;
    attachPanelFrame(this.element, 'calendar');
    if (refocus) this.element.querySelector<HTMLElement>('[data-close]')?.focus({ preventScroll: true });
  }

  dispose(): void {
    this.close();
    detachPanelFrame(this.element);
    this.abort.abort();
    this.element.remove();
  }
}
