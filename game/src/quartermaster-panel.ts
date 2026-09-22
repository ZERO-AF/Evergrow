/** Reputation quartermaster shop (docs/wow-deepening.md — second wave): the
 * faction gear vendor at the noble hall. Header shows the served faction and
 * the player's standing; stock rows are standing-gated (locked rows show the
 * required standing) and priced in gold with the standing discount applied.
 * Buys route through `executeQuartermasterBuy` in game.ts and the panel
 * re-renders from the refreshed sheet. */
import { attachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { npcEmblem } from './npc-art.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { itemPackIconSVG } from './item-art.ts';
import { itemFootprint } from './inventory-grid.ts';
import { TIER_COLORS, TIER_NAMES } from './items.ts';
import { formatWalletCompact } from './currency.ts';
import { goldBalance } from './wallet.ts';
import { STANDING_BY_TIER, type FactionDef } from './reputation-content.ts';
import { standingOf } from './reputation-state.ts';
import { quartermasterStock, type QuartermasterStockEntry } from './quartermaster-content.ts';
import { quartermasterBuyProblem, quartermasterFaction } from './quartermaster-state.ts';
import { findReward } from './reputation-command.ts';
import type { Quartermaster } from './quartermaster-npc.ts';
import type { ActionResult } from './character-types.ts';
import type { Player } from './model.ts';
import './quartermaster-panel.css';

const esc = escapeUI;

export interface QuartermasterActions {
  close(): void;
  /** Durable buy (executeQuartermasterBuy); the returned message is shown in the panel. */
  buy(rewardId: string): Promise<ActionResult>;
}

export class QuartermasterPanel {
  readonly element: HTMLElement;
  private readonly abort = new AbortController();
  private readonly actions: QuartermasterActions;
  private readonly tooltip: ItemTooltip;
  private focus: { dispose(): void } | null = null;
  private player: Player | null = null;
  private vendor: Quartermaster | null = null;
  private notice = '';
  private busy = false;

  constructor(mount: HTMLElement, actions: QuartermasterActions) {
    this.actions = actions;
    this.element = document.createElement('section');
    this.element.className = 'quartermaster-panel ui-window';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'quartermaster-title');
    mount.append(this.element);
    attachPanelFrame(this.element, 'quartermaster');
    this.tooltip = new ItemTooltip(this.element, 'quartermaster-tooltip');
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

  open(player: Player, vendor: Quartermaster): void {
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

  private faction(): FactionDef | undefined {
    return this.vendor ? quartermasterFaction(this.vendor) : undefined;
  }

  private click(event: MouseEvent): void {
    const control = (event.target as HTMLElement).closest<HTMLElement>('[data-close],[data-qm-buy]');
    if (!control || this.busy) return;
    if (control.hasAttribute('data-close')) { this.actions.close(); return; }
    const rewardId = control.dataset.qmBuy;
    if (!rewardId || (control as HTMLButtonElement).disabled) return;
    this.busy = true;
    void this.actions.buy(rewardId).then(result => {
      this.notice = result.message ?? '';
      this.busy = false;
      this.render();
    });
  }

  private hover(target: EventTarget | null): void {
    if (this.busy || !this.player) return;
    if (document.documentElement.classList.contains('touch-mode')) return;
    const cell = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-item]') : null;
    if (!cell) return;
    const faction = this.faction();
    if (!faction) return;
    const entry = quartermasterStock(faction.id, this.player).find(row => row.rewardId === cell.dataset.item);
    if (!entry?.item) return;
    this.tooltip.show(entry.item, { sheet: this.player.character, level: this.player.level, context: `Buy · ${formatWalletCompact(entry.goldCost)}` }, cell);
  }

  private stockRow(entry: QuartermasterStockEntry, faction: FactionDef): string {
    const player = this.player!;
    const reward = findReward(faction.id, entry.rewardId)!.reward;
    const problem = quartermasterBuyProblem(player, faction, reward);
    const icon = entry.item
      ? itemPackIconSVG(entry.item, itemFootprint(entry.item).width, itemFootprint(entry.item).height)
      : `<span class="quartermaster-material-icon">${uiIcon(faction.icon)}</span>`;
    const meta = entry.item
      ? `<span class="quartermaster-tier" style="color:${TIER_COLORS[entry.item.tier]}">${TIER_NAMES[entry.item.tier]}</span> · ${entry.item.kind}`
      : entry.material ? `<span class="quartermaster-tier">${esc(entry.material.name)} ×${entry.material.count}</span>` : '';
    const standing = STANDING_BY_TIER[entry.requiredStanding];
    const gate = `<small class="quartermaster-gate" style="color:${standing.color}">${esc(standing.label)}</small>`;
    const price = entry.goldCost < entry.listPrice
      ? `<span class="quartermaster-price">${uiIcon('gold')}${formatWalletCompact(entry.goldCost)}<s>${formatWalletCompact(entry.listPrice)}</s></span>`
      : `<span class="quartermaster-price">${uiIcon('gold')}${formatWalletCompact(entry.goldCost)}</span>`;
    const label = problem ? (problem.startsWith('Requires') ? `Requires ${standing.label}` : problem) : 'Buy';
    return `<article class="quartermaster-row${problem ? ' is-blocked' : ''}">
      <button type="button" class="quartermaster-item" ${entry.item ? `data-item="${entry.rewardId}"` : 'disabled'} aria-label="Inspect ${esc(entry.name)}">${icon}</button>
      <div class="quartermaster-copy"><strong>${esc(entry.name)}</strong><small>${meta}</small>${gate}</div>
      ${price}
      <button type="button" class="ui-button ui-button--primary quartermaster-buy" data-qm-buy="${entry.rewardId}" ${problem ? 'disabled' : ''} title="${esc(problem ?? `Buy ${entry.name}`)}">${esc(label)}</button>
    </article>`;
  }

  private render(): void {
    const player = this.player, vendor = this.vendor;
    if (!player || !vendor) return;
    const faction = this.faction();
    const stock = faction ? quartermasterStock(faction.id, player) : [];
    const standing = faction ? standingOf(player, faction.id) : undefined;
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active && this.element.contains(active) && active.hasAttribute('data-qm-buy')
      ? `[data-qm-buy="${active.getAttribute('data-qm-buy')}"]` : null;
    this.element.innerHTML = `<header class="ui-window-header"><span class="ui-header-emblem">${npcEmblem('quartermaster')}</span><h2 class="ui-title" id="quartermaster-title">Quartermaster</h2><span class="quartermaster-name">${esc(vendor.name)}</span><button class="ui-button ui-button--icon" data-close aria-label="Close">×</button></header>
      <div class="quartermaster-balance" role="status">
        ${faction ? `<span class="quartermaster-faction">${uiIcon(faction.icon)}<b style="color:${faction.color}">${esc(faction.name)}</b>${standing ? `<i style="color:${standing.color}">${esc(standing.label)}</i>` : ''}</span>` : ''}
        <span>${uiIcon('gold')}<b>${formatWalletCompact(goldBalance(player.character))}</b></span>
      </div>
      <div class="quartermaster-stock ui-scroll-area">${faction && stock.length
        ? stock.map(entry => this.stockRow(entry, faction)).join('')
        : `<p class="quartermaster-empty">${faction ? 'The quartermaster has nothing to sell right now.' : 'This quartermaster serves no faction.'}</p>`}</div>
      ${this.notice ? `<p class="quartermaster-notice" role="status">${esc(this.notice)}</p>` : ''}`;
    attachPanelFrame(this.element, 'quartermaster');
    if (focusKey) this.element.querySelector<HTMLElement>(focusKey)?.focus({ preventScroll: true });
  }
}
