/**
 * Auction House window (WotLK-style): Browse the seeded market, manage the
 * player's own auctions, and post items from the pack. Read-only projection —
 * every mutation goes through the injected durable command hooks.
 */
import './auction-panel.css';
import { attachPanelFrame, detachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { itemIconSVG } from './item-art.ts';
import { itemSlotMarkup } from './item-ui.ts';
import { itemDisplayName, TIER_COLORS } from './items.ts';
import { formatWallet, formatWalletCompact } from './currency.ts';
import { goldBalance } from './wallet.ts';
import type { Player } from './model.ts';
import type { Item } from './character-types.ts';
import {
  AUCTION_CATEGORIES, AUCTION_CATEGORY_NAMES, AUCTION_CUT_RATE, AUCTION_DURATIONS, AUCTION_EPOCH_MS,
  auctionCategory, auctionDeposit, auctionEpoch, suggestedBuyout,
  type AuctionCategory, type AuctionDuration,
} from './auction-content.ts';
import { auctionBrowse } from './auction-command.ts';

type Action = Promise<{ ok: boolean; message: string }>;
export interface AuctionActions {
  post(itemRef: number, buyout: number, hours: number): Action;
  buyout(listingId: string): Action;
  cancel(listingId: string): Action;
  collect(): Action;
}

const timeLeft = (expiresAt: number, now: number): string => {
  const ms = Math.max(0, expiresAt - now);
  const hours = Math.floor(ms / 3_600_000), minutes = Math.floor(ms / 60_000) % 60;
  return hours >= 48 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : hours >= 1 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
};
/** WoW's coarse browse-tab time bands. */
const wowTimeLeft = (expiresAt: number, now: number): string => {
  const ms = expiresAt - now;
  return ms > 12 * 3_600_000 ? 'Very Long' : ms > 2 * 3_600_000 ? 'Long' : ms > 30 * 60_000 ? 'Medium' : 'Short';
};

export class AuctionHousePanel {
  readonly element: HTMLElement;
  private player!: Player;
  private tab: 'browse' | 'auctions' | 'sell' = 'browse';
  private search = '';
  private category: AuctionCategory | 'all' = 'all';
  private selected: string | null = null;
  private sellIndex: number | null = null;
  private sellPrice = '';
  private sellHours: AuctionDuration = 24;
  private notice = '';
  private busy = false;
  private readonly tooltip: ItemTooltip;
  private readonly abort = new AbortController();
  private focus: { dispose(): void } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly actions: AuctionActions;
  private readonly now: () => number;

  constructor(mount: HTMLElement, actions: AuctionActions, now: () => number = Date.now) {
    this.actions = actions;
    this.now = now;
    this.element = document.createElement('section');
    this.element.className = 'auction-panel ui-window';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'auction-title');
    mount.append(this.element);
    attachPanelFrame(this.element, 'auction');
    this.tooltip = new ItemTooltip(this.element, 'auction-tooltip');
    this.element.addEventListener('click', e => this.click(e), { signal: this.abort.signal });
    this.element.addEventListener('input', e => this.input(e), { signal: this.abort.signal });
    this.element.addEventListener('change', e => this.change(e), { signal: this.abort.signal });
    this.element.addEventListener('pointerover', e => this.hover(e.target), { signal: this.abort.signal });
    this.element.addEventListener('focusin', e => this.hover(e.target), { signal: this.abort.signal });
    this.element.addEventListener('pointerout', e => {
      const cell = e.target instanceof Element ? e.target.closest('[data-item]') : null;
      if (cell && (!(e.relatedTarget instanceof Node) || !cell.contains(e.relatedTarget))) this.tooltip.defer();
    }, { signal: this.abort.signal });
    this.element.addEventListener('focusout', () => this.tooltip.defer(), { signal: this.abort.signal });
    this.element.addEventListener('scroll', event => {
      if (!(event.target instanceof Element) || !event.target.closest('.ui-tooltip')) this.tooltip.hide();
    }, { signal: this.abort.signal, capture: true });
  }

  open(player: Player): void {
    this.player = player;
    this.tab = 'browse';
    this.selected = null;
    this.sellIndex = null;
    this.sellPrice = '';
    this.notice = '';
    this.element.hidden = false;
    this.render();
    this.focus?.dispose();
    this.focus = trapDialogFocus(this.element, { initialFocus: this.element, restoreFocus: false });
    this.timer = setInterval(() => this.tick(), 30_000);
  }

  close(): void {
    this.focus?.dispose();
    this.focus = null;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.tooltip.hide();
    this.element.hidden = true;
  }

  dispose(): void {
    this.close();
    this.abort.abort();
    this.tooltip.dispose();
    detachPanelFrame(this.element);
    this.element.remove();
  }

  /** Live-player refresh while the window is open (bag/gold changed elsewhere). */
  update(player: Player): void {
    this.player = player;
    if (!this.element.hidden) this.render();
  }

  /** Lightweight countdown refresh that does not rebuild the DOM. */
  private tick(): void {
    if (this.element.hidden || !this.player) return;
    const now = this.now();
    for (const el of this.element.querySelectorAll<HTMLElement>('[data-expires]')) {
      const at = Number(el.dataset.expires);
      if (Number.isFinite(at)) el.textContent = el.dataset.band !== undefined ? wowTimeLeft(at, now) : timeLeft(at, now);
    }
  }

  private resolve(key: string): { item: Item; context?: string } | null {
    const now = this.now();
    const { npc, mine } = auctionBrowse(this.player, now);
    if (key.startsWith('npc:')) {
      const listing = npc.find(l => l.id === key.slice(4));
      return listing ? { item: listing.item, context: `Buyout · ${formatWalletCompact(listing.buyout)}` } : null;
    }
    if (key.startsWith('mine:')) {
      const listing = mine.find(l => l.id === key.slice(5));
      return listing ? { item: listing.item, context: `Buyout · ${formatWalletCompact(listing.buyout)}` } : null;
    }
    if (key.startsWith('bag:')) {
      const item = this.player.character.inventory[Number(key.slice(4))];
      return item ? { item, context: `Suggested buyout · ${formatWalletCompact(suggestedBuyout(item))}` } : null;
    }
    return null;
  }

  private hover(target: EventTarget | null): void {
    if (this.busy) return;
    if (document.documentElement.classList.contains('touch-mode')) return;
    const cell = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-item]') : null;
    if (!cell) return;
    const value = this.resolve(cell.dataset.item!);
    if (!value) return;
    this.tooltip.show(value.item, { sheet: this.player.character, level: this.player.level, context: value.context }, cell);
  }

  private async run(work: () => Action): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const result = await work();
      this.notice = result.message;
      if (result.ok) this.selected = null;
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private click(e: MouseEvent): void {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-close],[data-tab],[data-cat],[data-row],[data-buy],[data-cancel-auction],[data-claim],[data-collect],[data-sell-cell],[data-hours],[data-post]');
    if (!b || !this.player) return;
    if (b.dataset.close !== undefined) { this.close(); return; }
    if (b.dataset.tab !== undefined) { this.tab = b.dataset.tab as typeof this.tab; this.selected = null; this.notice = ''; this.render(); return; }
    if (b.dataset.cat !== undefined) { this.category = b.dataset.cat as typeof this.category; this.render(); return; }
    if (b.dataset.row !== undefined) { this.selected = this.selected === b.dataset.row ? null : b.dataset.row; this.render(); return; }
    if (b.dataset.sellCell !== undefined) {
      this.sellIndex = Number(b.dataset.sellCell);
      const item = this.player.character.inventory[this.sellIndex];
      this.sellPrice = item ? String(suggestedBuyout(item)) : '';
      this.render();
      return;
    }
    if (this.busy) return;
    if (b.dataset.buy !== undefined && this.selected) void this.run(() => this.actions.buyout(this.selected!));
    else if (b.dataset.cancelAuction !== undefined) void this.run(() => this.actions.cancel(b.dataset.cancelAuction!));
    else if (b.dataset.claim !== undefined) void this.run(() => this.actions.cancel(b.dataset.claim!));
    else if (b.dataset.collect !== undefined) void this.run(() => this.actions.collect());
    else if (b.dataset.post !== undefined && this.sellIndex !== null) {
      const price = Math.floor(Number(this.sellPrice));
      const index = this.sellIndex;
      void this.run(async () => {
        const result = await this.actions.post(index, price, this.sellHours);
        if (result.ok) { this.sellIndex = null; this.sellPrice = ''; }
        return result;
      });
    }
  }

  private input(e: Event): void {
    const el = e.target as HTMLInputElement;
    if (el.dataset.search !== undefined) { this.search = el.value; this.filterRows(); }
    else if (el.dataset.price !== undefined) { this.sellPrice = el.value; this.updateSellQuote(); }
  }

  private change(e: Event): void {
    const el = e.target as HTMLInputElement;
    if (el.dataset.hours !== undefined) { this.sellHours = Number(el.dataset.hours) as AuctionDuration; this.updateSellQuote(); }
  }

  /** Search narrows the rendered rows in place so the input keeps focus. */
  private filterRows(): void {
    const query = this.search.trim().toLowerCase();
    for (const row of this.element.querySelectorAll<HTMLElement>('.auction-row[data-name]'))
      row.hidden = Boolean(query) && !row.dataset.name!.includes(query);
    const empty = this.element.querySelector<HTMLElement>('.auction-browse-empty');
    if (empty) empty.hidden = this.element.querySelector('.auction-row[data-name]:not([hidden])') !== null;
  }

  private updateSellQuote(): void {
    const item = this.sellIndex === null ? null : this.player.character.inventory[this.sellIndex];
    const price = Math.floor(Number(this.sellPrice));
    const quote = this.element.querySelector<HTMLElement>('[data-sell-quote]');
    const post = this.element.querySelector<HTMLButtonElement>('[data-post]');
    if (!quote || !post) return;
    if (!item || !Number.isSafeInteger(price) || price < 1) {
      quote.textContent = item ? 'Enter a buyout price.' : '';
      post.disabled = true;
      return;
    }
    const deposit = auctionDeposit(price, this.sellHours);
    const payout = price - Math.floor(price * AUCTION_CUT_RATE) + deposit;
    quote.textContent = `Deposit ${formatWalletCompact(deposit)} · payout on sale ${formatWalletCompact(payout)}`;
    post.disabled = this.busy || goldBalance(this.player.character) < deposit;
    post.textContent = `Post auction · ${formatWalletCompact(deposit)} deposit`;
  }

  render(): void {
    if (!this.player) return;
    const now = this.now();
    const { npc, mine, pendingGold, sales } = auctionBrowse(this.player, now);
    const query = this.search.trim().toLowerCase();
    const rows = npc
      .filter(l => this.category === 'all' || auctionCategory(l.item) === this.category)
      .sort((a, b) => a.buyout - b.buyout);
    const active = mine.filter(l => !l.expired);
    const expired = mine.filter(l => l.expired);
    const selected = rows.find(l => l.id === this.selected) ?? null;
    const gold = goldBalance(this.player.character);
    const sellItem = this.sellIndex === null ? null : this.player.character.inventory[this.sellIndex] ?? null;

    this.element.innerHTML = `
<header class="ui-window-header"><span class="ui-header-emblem">${uiIcon('gold')}</span><h2 class="ui-title" id="auction-title">Auction House</h2><span class="auction-wallet"><b>${formatWallet(gold)}</b>${pendingGold > 0 ? `<small>+${formatWalletCompact(pendingGold)} pending</small>` : ''}</span><button class="ui-button ui-button--icon" data-close aria-label="Close auction house">×</button></header>
<nav class="auction-tabs" role="tablist">
  <button class="ui-button ui-button--quiet" role="tab" data-tab="browse" aria-pressed="${this.tab === 'browse'}">Browse</button>
  <button class="ui-button ui-button--quiet" role="tab" data-tab="auctions" aria-pressed="${this.tab === 'auctions'}">Auctions${mine.length ? ` <small>${mine.length}</small>` : ''}</button>
  <button class="ui-button ui-button--quiet" role="tab" data-tab="sell" aria-pressed="${this.tab === 'sell'}">Sell</button>
  <span>${npc.length} listings · rotates ${timeLeft((auctionEpoch(now) + 1) * AUCTION_EPOCH_MS, now)}</span>
</nav>
${this.tab === 'browse' ? `
<div class="auction-filters">
  <input class="ui-input auction-search" data-search type="search" placeholder="Search auctions…" value="${escapeUI(this.search)}" aria-label="Search auctions">
  <div class="auction-cats">${(['all', ...AUCTION_CATEGORIES] as const).map(cat =>
    `<button class="ui-button ui-button--quiet" data-cat="${cat}" aria-pressed="${this.category === cat}">${cat === 'all' ? 'All' : AUCTION_CATEGORY_NAMES[cat]}</button>`).join('')}</div>
</div>
<div class="auction-list" role="listbox" aria-label="Auctions for sale">
  ${rows.map(l => `<button class="auction-row${this.selected === l.id ? ' is-selected' : ''}" role="option" aria-selected="${this.selected === l.id}" data-row="${l.id}" data-item="npc:${l.id}" data-name="${escapeUI(itemDisplayName(l.item).toLowerCase())}" ${query && !itemDisplayName(l.item).toLowerCase().includes(query) ? 'hidden' : ''}>
    <span class="auction-row-icon">${itemIconSVG(l.item, 36)}</span>
    <span class="auction-row-name" style="color:${TIER_COLORS[l.item.tier]}">${escapeUI(itemDisplayName(l.item))}<small>${escapeUI(l.sellerName ?? 'Unknown')} · ilvl ${l.item.itemLevel}</small></span>
    <span class="auction-row-time" data-expires="${l.expiresAt}" data-band>${wowTimeLeft(l.expiresAt, now)}</span>
    <span class="auction-row-price">${formatWalletCompact(l.buyout)}</span>
  </button>`).join('') || ''}
  <p class="auction-empty auction-browse-empty" ${rows.some(l => !query || itemDisplayName(l.item).toLowerCase().includes(query)) ? 'hidden' : ''}>No auctions match.</p>
</div>
<footer class="ui-window-footer"><span class="auction-message" role="status">${escapeUI(this.notice)}</span><button class="ui-button ui-button--primary" data-buy ${!selected || this.busy || gold < selected.buyout ? 'disabled' : ''}>${selected ? `Buyout · ${formatWalletCompact(selected.buyout)}` : 'Select an auction'}</button></footer>` : ''}
${this.tab === 'auctions' ? `
<div class="auction-mine">
  ${pendingGold > 0 ? `<div class="auction-proceeds"><span>${uiIcon('gold')} ${sales} sale${sales === 1 ? '' : 's'} completed</span><button class="ui-button ui-button--primary" data-collect ${this.busy ? 'disabled' : ''}>Collect ${formatWalletCompact(pendingGold)}</button></div>` : ''}
  <h3>Your auctions</h3>
  ${active.map(l => `<div class="auction-row is-mine" data-item="mine:${l.id}">
    <span class="auction-row-icon">${itemIconSVG(l.item, 36)}</span>
    <span class="auction-row-name" style="color:${TIER_COLORS[l.item.tier]}">${escapeUI(itemDisplayName(l.item))}<small>buyout ${formatWalletCompact(l.buyout)}</small></span>
    <span class="auction-row-time" data-expires="${l.expiresAt}">${timeLeft(l.expiresAt, now)}</span>
    <button class="ui-button ui-button--quiet" data-cancel-auction="${l.id}" ${this.busy ? 'disabled' : ''}>Cancel</button>
  </div>`).join('') || '<p class="auction-empty">No auctions posted.</p>'}
  ${expired.length ? `<h3>Expired — awaiting pack room</h3>${expired.map(l => `<div class="auction-row is-mine" data-item="mine:${l.id}">
    <span class="auction-row-icon">${itemIconSVG(l.item, 36)}</span>
    <span class="auction-row-name" style="color:${TIER_COLORS[l.item.tier]}">${escapeUI(itemDisplayName(l.item))}<small>expired</small></span>
    <span class="auction-row-time">Done</span>
    <button class="ui-button ui-button--quiet" data-claim="${l.id}" ${this.busy ? 'disabled' : ''}>Claim</button>
  </div>`).join('')}` : ''}
</div>
<footer class="ui-window-footer"><span class="auction-message" role="status">${escapeUI(this.notice)}</span></footer>` : ''}
${this.tab === 'sell' ? `
<div class="auction-sell">
  <div class="auction-bag" role="listbox" aria-label="Pack items">
    ${this.player.character.inventory.map((item, i) => item && !item.locked
      ? `<button class="auction-cell ui-item-slot${this.sellIndex === i ? ' is-selected' : ''}" role="option" aria-selected="${this.sellIndex === i}" data-sell-cell="${i}" data-item="bag:${i}" aria-label="Auction ${escapeUI(itemDisplayName(item))}" style="--item-color:${TIER_COLORS[item.tier]}">${itemSlotMarkup(item, 40)}</button>`
      : '').join('') || '<p class="auction-empty">Your pack is empty.</p>'}
  </div>
  <div class="auction-sell-form">
    ${sellItem ? `<div class="auction-sell-item" data-item="bag:${this.sellIndex}"><span class="auction-row-icon">${itemIconSVG(sellItem, 44)}</span><span class="auction-row-name" style="color:${TIER_COLORS[sellItem.tier]}">${escapeUI(itemDisplayName(sellItem))}<small>suggested ${formatWalletCompact(suggestedBuyout(sellItem))}</small></span></div>
    <label class="auction-field">Buyout price (copper)<input class="ui-input" data-price type="number" min="1" step="1" value="${escapeUI(this.sellPrice)}"></label>
    <div class="auction-field">Duration <span class="auction-hours">${AUCTION_DURATIONS.map(h => `<label><input type="radio" name="auction-hours" data-hours="${h}" value="${h}" ${this.sellHours === h ? 'checked' : ''}> ${h}h</label>`).join('')}</span></div>
    <p class="auction-quote" data-sell-quote></p>` : '<p class="auction-empty">Pick an item from your pack to auction it.</p>'}
  </div>
</div>
<footer class="ui-window-footer"><span class="auction-message" role="status">${escapeUI(this.notice)}</span><button class="ui-button ui-button--primary" data-post ${!sellItem || this.busy ? 'disabled' : ''}>Post auction</button></footer>` : ''}`;
    attachPanelFrame(this.element, 'auction');
    if (this.tab === 'sell') this.updateSellQuote();
  }
}
