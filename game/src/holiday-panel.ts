/** Darkmoon Faire window: the carnival's activity booths and prize vendor in
 * one panel. Mirrors badge-vendor-panel.ts — plays and buys route through the
 * durable commands in holiday-command.ts via the actions hooks, and the panel
 * re-renders from the refreshed sheet/state. Shares the pvp-vendor-panel.css
 * row/balance styling plus holiday-panel.css for the booth list. */
import { attachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { itemPackIconSVG } from './item-art.ts';
import { itemFootprint } from './inventory-grid.ts';
import { TIER_COLORS, TIER_NAMES } from './items.ts';
import type { Simulation } from './simulation.ts';
import type { ActionResult, CharacterSheet } from './character-types.ts';
import {
  DARKMOON_PRIZES, FAIRE_NAME, TICKET_NAME, faireActivity,
  faireStatus, prizeItem, type FaireBooth, type FaireSite, type PrizeEntry,
} from './holiday-content.ts';
import { activityDone, formatTickets, holidayOf, ticketBalance, type HolidayWallet } from './holiday-state.ts';
import { buyPrizeProblem } from './holiday-command.ts';
import './pvp-vendor-panel.css';
import './holiday-panel.css';

const esc = escapeUI;

export interface HolidayActions {
  close(): void;
  /** Durable booth play (playActivity); the returned message is shown in the panel. */
  play(booth: FaireBooth): Promise<ActionResult>;
  /** Durable prize purchase (buyPrize); the returned message is shown in the panel. */
  buy(stockId: string): Promise<ActionResult>;
}

/** Carnival tent emblem for the header — the faire has no vendorIdentity entry
 * until the integrator adds the 'darkmoonVendor' role. */
const FAIRE_EMBLEM = `<svg viewBox="-12 -12 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M-9 8 L-9 -2 L0 -9 L9 -2 L9 8 Z"/><path d="M-9 -2 L9 -2 M0 -9 L0 8 M-4 8 L-4 2 L4 2 L4 8"/></svg>`;

export class HolidayPanel {
  readonly element: HTMLElement;
  private readonly abort = new AbortController();
  private readonly actions: HolidayActions;
  private readonly tooltip: ItemTooltip;
  private focus: { dispose(): void } | null = null;
  private sim: Simulation | null = null;
  private site: FaireSite | null = null;
  private booths: readonly FaireBooth[] = [];
  private now = 0;
  private notice = '';
  private busy = false;

  constructor(mount: HTMLElement, actions: HolidayActions) {
    this.actions = actions;
    this.element = document.createElement('section');
    this.element.className = 'holiday-panel pvp-vendor-panel ui-window';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'holiday-title');
    mount.append(this.element);
    attachPanelFrame(this.element, 'holiday');
    this.tooltip = new ItemTooltip(this.element, 'holiday-tooltip');
    const signal = this.abort.signal;
    this.element.addEventListener('click', event => this.click(event), { signal });
    this.element.addEventListener('pointerover', event => this.hover(event.target), { signal });
    this.element.addEventListener('focusin', event => this.hover(event.target), { signal });
    this.element.addEventListener('pointerout', event => {
      const cell = event.target instanceof Element ? event.target.closest('[data-item]') : null;
      if (cell && (!(event.relatedTarget instanceof Node) || !cell.contains(event.relatedTarget))) this.tooltip.defer();
    }, { signal });
    this.element.addEventListener('focusout', () => this.tooltip.defer(), { signal });
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); this.actions.close(); }
    }, { signal });
  }

  get opened() { return !this.element.hidden; }

  open(sim: Simulation, site: FaireSite, booths: readonly FaireBooth[], now = Date.now()): void {
    this.sim = sim;
    this.site = site;
    this.booths = booths;
    this.now = now;
    this.notice = '';
    this.element.hidden = false;
    this.render();
    this.focus?.dispose();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal, initialFocus: this.element, restoreFocus: false });
  }

  close(): void {
    this.tooltip.hide();
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
    this.sim = null;
    this.site = null;
  }

  dispose(): void {
    this.close();
    this.abort.abort();
    this.element.remove();
  }

  private click(event: MouseEvent): void {
    const control = (event.target as HTMLElement).closest<HTMLElement>('[data-close],[data-play],[data-buy]');
    if (!control || this.busy) return;
    if (control.hasAttribute('data-close')) { this.actions.close(); return; }
    if ((control as HTMLButtonElement).disabled) return;
    const playId = control.dataset.play;
    if (playId) {
      const booth = this.booths.find(b => b.activityId === playId);
      if (!booth) return;
      this.busy = true;
      void this.actions.play(booth).then(result => {
        this.notice = result.message ?? '';
        this.busy = false;
        this.render();
      });
      return;
    }
    const stockId = control.dataset.buy;
    if (!stockId) return;
    this.busy = true;
    void this.actions.buy(stockId).then(result => {
      this.notice = result.message ?? '';
      this.busy = false;
      this.render();
    });
  }

  private hover(target: EventTarget | null): void {
    if (this.busy || !this.sim) return;
    if (document.documentElement.classList.contains('touch-mode')) return;
    const cell = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-item]') : null;
    if (!cell) return;
    const entry = DARKMOON_PRIZES.find(row => row.id === cell.dataset.item);
    if (!entry || entry.kind !== 'gear') return;
    const player = this.sim.player;
    const item = prizeItem(entry, player.level, 0);
    this.tooltip.show(item, { sheet: player.character, level: player.level, context: `Buy · ${formatTickets(entry.price)} ${TICKET_NAME}s` }, cell);
  }

  private activityRow(booth: FaireBooth): string {
    const activity = faireActivity(booth.activityId)!;
    const done = this.sim ? activityDone(holidayOf(this.sim), activity, this.now) : false;
    const cadence = activity.limit === 'day' ? 'Daily' : 'Once per faire';
    const pay = `${activity.tickets} ${TICKET_NAME}s · ${activity.consolation} on a miss`;
    return `<article class="holiday-activity${done ? ' is-blocked' : ''}">
      <span class="holiday-booth-icon">${uiIcon('star')}</span>
      <div class="pvp-vendor-copy"><strong>${esc(activity.name)}</strong><small>${esc(activity.blurb)}</small><small>${cadence} · ${pay}</small></div>
      <button type="button" class="ui-button ui-button--primary pvp-vendor-buy" data-play="${activity.id}" ${done ? 'disabled' : ''} title="${esc(done ? 'Already stamped' : `Play ${activity.name}`)}">${done ? 'Done' : 'Play'}</button>
    </article>`;
  }

  private prizeRow(entry: PrizeEntry): string {
    const player = this.sim!.player;
    const problem = buyPrizeProblem(player.character, entry, player.level, player.achievements);
    const icon = entry.kind === 'gear'
      ? (() => { const item = prizeItem(entry, player.level, 0); const fp = itemFootprint(item);
          return `<button type="button" class="pvp-vendor-item" data-item="${entry.id}" aria-label="Inspect ${esc(entry.name)}">${itemPackIconSVG(item, fp.width, fp.height)}</button>`; })()
      : `<span class="pvp-vendor-item holiday-prize-icon">${uiIcon(entry.kind === 'mount' ? 'dodge' : 'star')}</span>`;
    const meta = entry.kind === 'gear'
      ? `<span class="pvp-vendor-tier" style="color:${TIER_COLORS[entry.tier]}">${TIER_NAMES[entry.tier]}</span> · ${entry.slot}`
      : entry.kind === 'companion' ? `<span class="pvp-vendor-tier" style="color:${TIER_COLORS.rare}">Companion</span>` : `<span class="pvp-vendor-tier" style="color:${TIER_COLORS.epic}">Mount</span>`;
    return `<article class="pvp-vendor-row${problem ? ' is-blocked' : ''}">
      ${icon}
      <div class="pvp-vendor-copy"><strong>${esc(entry.name)}</strong><small>${meta} · ${esc(entry.note)}</small></div>
      <span class="pvp-vendor-price">${uiIcon('star')}${formatTickets(entry.price)}<small>Tickets</small></span>
      <button type="button" class="ui-button ui-button--primary pvp-vendor-buy" data-buy="${entry.id}" ${problem ? 'disabled' : ''} title="${esc(problem ?? `Buy ${entry.name}`)}">${problem ? esc(problem) : 'Buy'}</button>
    </article>`;
  }

  private render(): void {
    const sim = this.sim, site = this.site;
    if (!sim || !site) return;
    const sheet = sim.player.character;
    const status = faireStatus(this.now);
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active && this.element.contains(active)
      ? active.hasAttribute('data-buy') ? `[data-buy="${active.getAttribute('data-buy')}"]`
      : active.hasAttribute('data-play') ? `[data-play="${active.getAttribute('data-play')}"]` : null
      : null;
    this.element.innerHTML = `<header class="ui-window-header"><span class="ui-header-emblem holiday-emblem">${FAIRE_EMBLEM}</span><h2 class="ui-title" id="holiday-title">${FAIRE_NAME}</h2><span class="pvp-vendor-name">${esc(site.townName)}</span><button class="ui-button ui-button--icon" data-close aria-label="Close">×</button></header>
      <div class="pvp-vendor-balance" role="status">
        <span>${uiIcon('star')}<b>${formatTickets(ticketBalance(sheet as CharacterSheet & HolidayWallet))}</b> ${TICKET_NAME}s</span>
        <span class="holiday-status">${esc(status.label)}</span>
      </div>
      <h3 class="holiday-section">Activities</h3>
      <div class="holiday-activities">${this.booths.map(booth => this.activityRow(booth)).join('')}</div>
      <h3 class="holiday-section">Prizes</h3>
      <div class="pvp-vendor-stock ui-scroll-area">${DARKMOON_PRIZES.map(entry => this.prizeRow(entry)).join('')}</div>
      ${this.notice ? `<p class="pvp-vendor-notice" role="status">${esc(this.notice)}</p>` : ''}`;
    attachPanelFrame(this.element, 'holiday');
    if (focusKey) this.element.querySelector<HTMLElement>(focusKey)?.focus({ preventScroll: true });
  }
}
