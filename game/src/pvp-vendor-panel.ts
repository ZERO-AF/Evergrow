/** PvP quartermaster shop (T05 stock, T04 surface): a small dedicated panel listing the
 * static Honor / Arena Point catalog beside the city battlemaster. Mirrors the glyph
 * panel's read-only projection — buys route through `executePvpBuy` in game.ts and the
 * panel re-renders from the refreshed sheet. */
import { attachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { npcEmblem } from './npc-art.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { itemPackIconSVG } from './item-art.ts';
import { itemFootprint } from './inventory-grid.ts';
import { TIER_COLORS, TIER_NAMES } from './items.ts';
import { arenaPointsBalance, formatPvpPoints, honorBalance, PVP_CURRENCY_LABELS } from './pvp-currency.ts';
import { pvpBuyProblem, pvpStockItem, pvpVendorStock, type PvpStockEntry, type PvpVendor } from './pvp-vendor.ts';
import type { ActionResult } from './character-types.ts';
import type { Player } from './model.ts';
import './pvp-vendor-panel.css';

const esc = escapeUI;
const CURRENCY_ICONS = { honor: 'shield', arenaPoints: 'star' } as const;

export interface PvpVendorActions {
  close(): void;
  /** Durable buy (executePvpBuy); the returned message is shown in the panel. */
  buy(stockId: string): Promise<ActionResult>;
}

export class PvpVendorPanel {
  readonly element: HTMLElement;
  private readonly abort = new AbortController();
  private readonly actions: PvpVendorActions;
  private readonly tooltip: ItemTooltip;
  private focus: { dispose(): void } | null = null;
  private player: Player | null = null;
  private vendor: PvpVendor | null = null;
  private notice = '';
  private busy = false;

  constructor(mount: HTMLElement, actions: PvpVendorActions) {
    this.actions = actions;
    this.element = document.createElement('section');
    this.element.className = 'pvp-vendor-panel ui-window';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'pvp-vendor-title');
    mount.append(this.element);
    attachPanelFrame(this.element, 'pvpVendor');
    this.tooltip = new ItemTooltip(this.element, 'pvp-vendor-tooltip');
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

  open(player: Player, vendor: PvpVendor): void {
    this.player = player;
    this.vendor = vendor;
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
    this.vendor = null;
  }

  dispose(): void {
    this.close();
    this.abort.abort();
    this.element.remove();
  }

  private click(event: MouseEvent): void {
    const control = (event.target as HTMLElement).closest<HTMLElement>('[data-close],[data-pvp-buy]');
    if (!control || this.busy) return;
    if (control.hasAttribute('data-close')) { this.actions.close(); return; }
    const stockId = control.dataset.pvpBuy;
    if (!stockId || (control as HTMLButtonElement).disabled) return;
    this.busy = true;
    void this.actions.buy(stockId).then(result => {
      this.notice = result.message ?? '';
      this.busy = false;
      this.render();
    });
  }

  private hover(target: EventTarget | null): void {
    if (this.busy || !this.player) return;
    if (document.documentElement.classList.contains('touch-mode')) return;
    const cell = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-item]') : null;
    if (!cell || !this.vendor) return;
    const entry = pvpVendorStock(this.vendor).find(row => row.id === cell.dataset.item);
    if (!entry || entry.kind !== 'gear') return;
    const item = pvpStockItem(entry, this.player.level, 0);
    const price = `${formatPvpPoints(entry.price)} ${PVP_CURRENCY_LABELS[entry.currency]}`;
    this.tooltip.show(item, { sheet: this.player.character, level: this.player.level, context: `Buy · ${price}` }, cell);
  }

  private stockRow(entry: PvpStockEntry): string {
    const player = this.player!;
    const problem = pvpBuyProblem(player.character, entry, player.level, player.achievements);
    const currency = PVP_CURRENCY_LABELS[entry.currency];
    const icon = entry.kind === 'gear'
      ? (() => { const item = pvpStockItem(entry, player.level, 0); const fp = itemFootprint(item); return itemPackIconSVG(item, fp.width, fp.height); })()
      : `<span class="pvp-vendor-mount-icon">${uiIcon('star')}</span>`;
    const meta = entry.kind === 'gear'
      ? `<span class="pvp-vendor-tier" style="color:${TIER_COLORS[entry.tier]}">${TIER_NAMES[entry.tier]}</span> · ${entry.slot}`
      : 'Mount';
    return `<article class="pvp-vendor-row${problem ? ' is-blocked' : ''}">
      <button type="button" class="pvp-vendor-item" data-item="${entry.id}" aria-label="Inspect ${esc(entry.name)}">${icon}</button>
      <div class="pvp-vendor-copy"><strong>${esc(entry.name)}</strong><small>${meta}</small></div>
      <span class="pvp-vendor-price">${uiIcon(CURRENCY_ICONS[entry.currency])}${formatPvpPoints(entry.price)}<small>${currency}</small></span>
      <button type="button" class="ui-button ui-button--primary pvp-vendor-buy" data-pvp-buy="${entry.id}" ${problem ? 'disabled' : ''} title="${esc(problem ?? `Buy ${entry.name}`)}">${problem ? esc(problem) : 'Buy'}</button>
    </article>`;
  }

  private render(): void {
    const player = this.player, vendor = this.vendor;
    if (!player || !vendor) return;
    const sheet = player.character;
    const stock = pvpVendorStock(vendor);
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active && this.element.contains(active) && active.hasAttribute('data-pvp-buy')
      ? `[data-pvp-buy="${active.getAttribute('data-pvp-buy')}"]` : null;
    this.element.innerHTML = `<header class="ui-window-header"><span class="ui-header-emblem">${npcEmblem('pvpVendor')}</span><h2 class="ui-title" id="pvp-vendor-title">PvP Quartermaster</h2><span class="pvp-vendor-name">${esc(vendor.name)}</span><button class="ui-button ui-button--icon" data-close aria-label="Close">×</button></header>
      <div class="pvp-vendor-balance" role="status">
        <span>${uiIcon('shield')}<b>${formatPvpPoints(honorBalance(sheet))}</b> Honor</span>
        <span>${uiIcon('star')}<b>${formatPvpPoints(arenaPointsBalance(sheet))}</b> Arena Points</span>
      </div>
      <div class="pvp-vendor-stock ui-scroll-area">${stock.length
        ? stock.map(entry => this.stockRow(entry)).join('')
        : '<p class="pvp-vendor-empty">The quartermaster has nothing to sell right now.</p>'}</div>
      ${this.notice ? `<p class="pvp-vendor-notice" role="status">${esc(this.notice)}</p>` : ''}`;
    attachPanelFrame(this.element, 'pvpVendor');
    if (focusKey) this.element.querySelector<HTMLElement>(focusKey)?.focus({ preventScroll: true });
  }
}
