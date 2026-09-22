/** Badge vendor shop (WotLK emblem quartermaster): a small dedicated panel
 * listing the static Emblem of Heroism catalog beside the city battlemaster.
 * Mirrors the PvP quartermaster panel — buys route through `executeBadgeBuy`
 * in game.ts and the panel re-renders from the refreshed sheet. Shares the
 * pvp-vendor-panel.css row/balance styling. */
import { attachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { npcEmblem } from './npc-art.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { itemPackIconSVG } from './item-art.ts';
import { itemFootprint } from './inventory-grid.ts';
import { TIER_COLORS, TIER_NAMES } from './items.ts';
import { emblemBalance, formatEmblems } from './emblem-state.ts';
import { badgeBuyProblem, badgeVendorStock, type BadgeVendor } from './badge-vendor.ts';
import { badgeStockItem, type BadgeStockEntry } from './emblem-content.ts';
import type { ActionResult } from './character-types.ts';
import type { Player } from './model.ts';
import './pvp-vendor-panel.css';

const esc = escapeUI;

export interface BadgeVendorActions {
  close(): void;
  /** Durable buy (executeBadgeBuy); the returned message is shown in the panel. */
  buy(stockId: string): Promise<ActionResult>;
}

export class BadgeVendorPanel {
  readonly element: HTMLElement;
  private readonly abort = new AbortController();
  private readonly actions: BadgeVendorActions;
  private readonly tooltip: ItemTooltip;
  private focus: { dispose(): void } | null = null;
  private player: Player | null = null;
  private vendor: BadgeVendor | null = null;
  private notice = '';
  private busy = false;

  constructor(mount: HTMLElement, actions: BadgeVendorActions) {
    this.actions = actions;
    this.element = document.createElement('section');
    this.element.className = 'pvp-vendor-panel ui-window';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'badge-vendor-title');
    mount.append(this.element);
    attachPanelFrame(this.element, 'badgeVendor');
    this.tooltip = new ItemTooltip(this.element, 'badge-vendor-tooltip');
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

  open(player: Player, vendor: BadgeVendor): void {
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
    const control = (event.target as HTMLElement).closest<HTMLElement>('[data-close],[data-badge-buy]');
    if (!control || this.busy) return;
    if (control.hasAttribute('data-close')) { this.actions.close(); return; }
    const stockId = control.dataset.badgeBuy;
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
    const entry = badgeVendorStock(this.vendor).find(row => row.id === cell.dataset.item);
    if (!entry) return;
    const item = badgeStockItem(entry, this.player.level, 0);
    this.tooltip.show(item, { sheet: this.player.character, level: this.player.level, context: `Buy · ${formatEmblems(entry.price)} Emblems` }, cell);
  }

  private stockRow(entry: BadgeStockEntry): string {
    const player = this.player!;
    const problem = badgeBuyProblem(player.character, entry, player.level);
    const item = badgeStockItem(entry, player.level, 0);
    const fp = itemFootprint(item);
    const meta = entry.kind === 'gear'
      ? `<span class="pvp-vendor-tier" style="color:${TIER_COLORS[entry.tier]}">${TIER_NAMES[entry.tier]}</span> · ${entry.slot}`
      : `<span class="pvp-vendor-tier" style="color:${TIER_COLORS[item.tier]}">${TIER_NAMES[item.tier]}</span> · Unique`;
    return `<article class="pvp-vendor-row${problem ? ' is-blocked' : ''}">
      <button type="button" class="pvp-vendor-item" data-item="${entry.id}" aria-label="Inspect ${esc(entry.name)}">${itemPackIconSVG(item, fp.width, fp.height)}</button>
      <div class="pvp-vendor-copy"><strong>${esc(entry.name)}</strong><small>${meta}</small></div>
      <span class="pvp-vendor-price">${uiIcon('star')}${formatEmblems(entry.price)}<small>Emblems</small></span>
      <button type="button" class="ui-button ui-button--primary pvp-vendor-buy" data-badge-buy="${entry.id}" ${problem ? 'disabled' : ''} title="${esc(problem ?? `Buy ${entry.name}`)}">${problem ? esc(problem) : 'Buy'}</button>
    </article>`;
  }

  private render(): void {
    const player = this.player, vendor = this.vendor;
    if (!player || !vendor) return;
    const sheet = player.character;
    const stock = badgeVendorStock(vendor);
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active && this.element.contains(active) && active.hasAttribute('data-badge-buy')
      ? `[data-badge-buy="${active.getAttribute('data-badge-buy')}"]` : null;
    this.element.innerHTML = `<header class="ui-window-header"><span class="ui-header-emblem">${npcEmblem('badgeVendor')}</span><h2 class="ui-title" id="badge-vendor-title">Badge Vendor</h2><span class="pvp-vendor-name">${esc(vendor.name)}</span><button class="ui-button ui-button--icon" data-close aria-label="Close">×</button></header>
      <div class="pvp-vendor-balance" role="status">
        <span>${uiIcon('star')}<b>${formatEmblems(emblemBalance(sheet))}</b> Emblems of Heroism</span>
      </div>
      <div class="pvp-vendor-stock ui-scroll-area">${stock.length
        ? stock.map(entry => this.stockRow(entry)).join('')
        : '<p class="pvp-vendor-empty">The badge vendor has nothing to sell right now.</p>'}</div>
      ${this.notice ? `<p class="pvp-vendor-notice" role="status">${esc(this.notice)}</p>` : ''}`;
    attachPanelFrame(this.element, 'badgeVendor');
    if (focusKey) this.element.querySelector<HTMLElement>(focusKey)?.focus({ preventScroll: true });
  }
}
