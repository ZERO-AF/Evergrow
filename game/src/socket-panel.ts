/**
 * Socketing panel — WoW jewelcrafting UI. Left column lists every equipped or
 * bagged item that rolled sockets; the center column shows the selected item's
 * sockets (filled gems, empty slots, the socket bonus line); the right column
 * lists loose gems in the bag. Click a gem to pick it up, then click a socket
 * to set it — or drag the gem onto the socket. Shift-click a filled socket (or
 * its × button) to pry the gem out; both operations destroy gems per the WoW
 * rule in gem-command.ts. All mutations route through the onSocket/onUnsocket
 * hooks (character commands); this panel only projects socket-state.ts.
 */
import './socket-panel.css';
import { attachPanelFrame, detachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { itemSlotMarkup, EQUIPPED_LABELS } from './item-ui.ts';
import { TIER_COLORS, TIER_NAMES, STAT_LABELS, formatStatValue, itemDisplayName } from './items.ts';
import {
  GEM_COLOR_HEX, createGem, gemDefinition, gemMatchesSocket, gemStatValue,
  socketBonusActive, socketBonusStats,
} from './gem-content.ts';
import type { SocketTarget } from './gem-command.ts';
import {
  gemsAvailable, parseSocketTargetKey, socketPreview, socketTargetItem, socketTargetKey, socketTargets,
  type GemEntry, type SocketTargetEntry,
} from './socket-state.ts';
import type { ActionResult, CharacterSheet } from './character-types.ts';
import type { Player } from './model.ts';

const esc = escapeUI;

export interface SocketingHooks {
  /** Durable socketGem command; the returned message is shown in the panel. */
  onSocket(target: SocketTarget, gemIndex: number, socketIndex: number): Promise<ActionResult> | void;
  /** Durable unsocketGem command; the gem is destroyed (WoW rule). */
  onUnsocket(target: SocketTarget, socketIndex: number): Promise<ActionResult> | void;
  /** Coordinator resume — invoked only on user-initiated close (×, Esc). */
  onClose(): void;
}

export class SocketingPanel {
  readonly element: HTMLElement;
  private readonly abort = new AbortController();
  private readonly hooks: SocketingHooks;
  private readonly tooltip: ItemTooltip;
  private focus: { dispose(): void } | null = null;
  private player: Player | null = null;
  private selected: SocketTarget | null = null;
  private armedGem = -1;
  private notice = '';
  private busy = false;
  private signature = '';

  constructor(mount: HTMLElement, hooks: SocketingHooks) {
    this.hooks = hooks;
    this.element = document.createElement('section');
    this.element.className = 'socketing-panel';
    this.element.hidden = true;
    mount.append(this.element);
    attachPanelFrame(this.element, 'socketing');
    this.tooltip = new ItemTooltip(this.element, 'socketing-tooltip');
    const signal = this.abort.signal;
    this.element.addEventListener('click', event => this.click(event), { signal });
    this.element.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (this.armedGem >= 0) { this.armedGem = -1; this.render(); }
      else this.hooks.onClose();
    }, { signal });
    this.element.addEventListener('pointerover', event => this.hover(event.target), { signal });
    this.element.addEventListener('focusin', event => this.hover(event.target), { signal });
    this.element.addEventListener('pointerout', event => {
      const cell = event.target instanceof Element ? event.target.closest('[data-item],[data-gem],[data-socket]') : null;
      if (cell && (!(event.relatedTarget instanceof Node) || !cell.contains(event.relatedTarget))) this.tooltip.defer();
    }, { signal });
    this.element.addEventListener('focusout', () => this.tooltip.defer(), { signal });
    this.element.addEventListener('scroll', event => {
      if (!(event.target instanceof Element) || !event.target.closest('.ui-tooltip')) this.tooltip.hide();
    }, { signal, capture: true });
    // Drag a gem row onto a socket slot — same command path as click-to-socket.
    this.element.addEventListener('dragstart', event => {
      const gem = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-gem]') : null;
      if (!gem || !event.dataTransfer) return;
      event.dataTransfer.setData('text/plain', gem.dataset.gem!);
      event.dataTransfer.effectAllowed = 'link';
      gem.classList.add('is-dragging');
    }, { signal });
    this.element.addEventListener('dragend', () => {
      this.element.querySelectorAll('.is-dragging,.is-drop-target').forEach(el => el.classList.remove('is-dragging', 'is-drop-target'));
    }, { signal });
    this.element.addEventListener('dragover', event => {
      const socket = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-socket]') : null;
      if (!socket || !event.dataTransfer) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'link';
      socket.classList.add('is-drop-target');
    }, { signal });
    this.element.addEventListener('dragleave', event => {
      const socket = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-socket]') : null;
      if (socket && (!(event.relatedTarget instanceof Node) || !socket.contains(event.relatedTarget))) socket.classList.remove('is-drop-target');
    }, { signal });
    this.element.addEventListener('drop', event => {
      const socket = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-socket]') : null;
      if (!socket || !event.dataTransfer || !this.selected) return;
      event.preventDefault();
      const gemIndex = Number(event.dataTransfer.getData('text/plain'));
      if (Number.isInteger(gemIndex) && gemIndex >= 0) void this.run(this.hooks.onSocket(this.selected, gemIndex, Number(socket.dataset.socket)));
    }, { signal });
  }

  get isOpen() { return !this.element.hidden; }

  open(player: Player): void {
    this.player = player;
    this.notice = '';
    this.armedGem = -1;
    this.selected = null;
    this.signature = '';
    this.element.hidden = false;
    this.render();
    this.focus?.dispose();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal, initialFocus: this.element, restoreFocus: false });
  }

  close(): void {
    if (this.element.hidden) return;
    this.tooltip.hide();
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
    this.player = null;
    this.selected = null;
    this.armedGem = -1;
  }

  dispose(): void {
    this.close();
    this.abort.abort();
    this.tooltip.dispose();
    detachPanelFrame(this.element);
    this.element.remove();
  }

  /** Refresh the projection; call whenever the player or inventory may have changed. */
  update(player: Player): void {
    this.player = player;
    if (this.element.hidden) return;
    const signature = this.dataSignature(player.character);
    if (signature !== this.signature) { this.signature = signature; this.render(); }
  }

  /** Item ids + recipe revisions: socket writes bump revision, so this catches every change. */
  private dataSignature(sheet: CharacterSheet): string {
    return JSON.stringify([
      sheet.inventory.map(item => item ? `${item.id}:${item.recipe.revision}` : 0),
      Object.values(sheet.equipped).map(item => item ? `${item.id}:${item.recipe.revision}` : 0),
    ]);
  }

  private async run(result: Promise<ActionResult> | void): Promise<void> {
    this.busy = true;
    const resolved = await result;
    this.busy = false;
    if (resolved?.message) this.notice = resolved.message;
    this.render();
  }

  private click(event: MouseEvent): void {
    const control = (event.target as HTMLElement).closest<HTMLElement>('[data-close],[data-target],[data-gem],[data-socket],[data-unsocket]');
    if (!control || this.busy || !this.player) return;
    if (control.hasAttribute('data-close')) { this.hooks.onClose(); return; }
    if (control.dataset.target !== undefined) {
      const target = parseSocketTargetKey(control.dataset.target);
      if (target) { this.selected = target; this.render(); }
      return;
    }
    if (control.dataset.gem !== undefined) {
      const index = Number(control.dataset.gem);
      this.armedGem = this.armedGem === index ? -1 : index;
      this.render();
      return;
    }
    if (control.dataset.unsocket !== undefined) {
      if (this.selected) void this.run(this.hooks.onUnsocket(this.selected, Number(control.dataset.unsocket)));
      return;
    }
    if (control.dataset.socket !== undefined && this.selected) {
      const socketIndex = Number(control.dataset.socket);
      const item = socketTargetItem(this.player.character, this.selected);
      const filled = Boolean(item?.sockets?.[socketIndex]?.gem);
      if (event.shiftKey && filled) void this.run(this.hooks.onUnsocket(this.selected, socketIndex));
      else if (this.armedGem >= 0) void this.run(this.hooks.onSocket(this.selected, this.armedGem, socketIndex));
      else {
        this.notice = filled ? 'Shift-click to pry the gem out — it shatters.' : 'Pick a gem from the right column first.';
        this.render();
      }
    }
  }

  private hover(target: EventTarget | null): void {
    const player = this.player;
    if (this.busy || !player || document.documentElement.classList.contains('touch-mode')) return;
    const cell = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-item],[data-gem],[data-socket]') : null;
    if (!cell) return;
    const sheet = player.character;
    const view = { sheet, level: player.level, compare: false as const };
    if (cell.dataset.item !== undefined) {
      const target = parseSocketTargetKey(cell.dataset.item);
      const item = target ? socketTargetItem(sheet, target) : null;
      if (item) this.tooltip.show(item, { ...view, equipped: Boolean(target && 'equipped' in target) }, cell);
      return;
    }
    if (cell.dataset.gem !== undefined) {
      const item = sheet.inventory[Number(cell.dataset.gem)];
      if (item) this.tooltip.show(item, view, cell);
      return;
    }
    if (cell.dataset.socket !== undefined && this.selected) {
      const item = socketTargetItem(sheet, this.selected);
      const socket = item?.sockets?.[Number(cell.dataset.socket)];
      const gem = socket?.gem ? gemDefinition(socket.gem) : undefined;
      if (item && socket && gem) this.tooltip.show(createGem(gem.id, 0, socket.gemLevel ?? item.itemLevel), view, cell);
    }
  }

  private targetRow(entry: SocketTargetEntry): string {
    const { target, item } = entry;
    const key = socketTargetKey(target);
    const isSelected = this.selected !== null && socketTargetKey(this.selected) === key;
    const filled = item.sockets!.filter(socket => socket.gem !== undefined).length;
    const active = socketBonusActive(item);
    const where = 'equipped' in target ? EQUIPPED_LABELS[target.equipped] : 'Bag';
    return `<button type="button" class="socket-target${isSelected ? ' is-selected' : ''}" data-target="${key}" data-item="${key}" aria-pressed="${isSelected}">
      <span class="ui-slot ui-item-slot socket-target-icon" style="--item-color:${TIER_COLORS[item.tier]}" data-filled="true" data-tier="${item.tier}">${itemSlotMarkup(item)}</span>
      <span class="socket-target-copy"><strong>${esc(itemDisplayName(item))}</strong><small>${where} · ${filled}/${item.sockets!.length} socketed${active ? ' · ◆ bonus' : ''}</small></span>
    </button>`;
  }

  private gemRow(entry: GemEntry): string {
    const { index, item, gem } = entry;
    const armed = this.armedGem === index;
    return `<button type="button" class="socket-gem${armed ? ' is-armed' : ''}" data-gem="${index}" draggable="true" aria-pressed="${armed}" aria-label="${armed ? 'Put down' : 'Pick up'} ${esc(gem.name)}">
      <span class="ui-slot ui-item-slot socket-gem-icon" style="--item-color:${TIER_COLORS[item.tier]}" data-filled="true" data-tier="${item.tier}">${itemSlotMarkup(item)}</span>
      <span class="socket-gem-copy"><strong style="color:${GEM_COLOR_HEX[gem.color]}">${esc(gem.name)}</strong><small>${gem.stats.map(stat => `${esc(STAT_LABELS[stat.stat])} ${esc(formatStatValue(stat.stat, gemStatValue(stat, item.itemLevel)))}`).join(' · ')}</small><small class="socket-gem-fits">${gem.color === 'prismatic' ? 'Matches any socket' : `Matches ${gem.color} sockets`}</small></span>
      ${armed ? '<span class="socket-gem-armed">Placing…</span>' : ''}
    </button>`;
  }

  private detailMarkup(): string {
    const player = this.player!;
    const item = this.selected ? socketTargetItem(player.character, this.selected) : null;
    if (!this.selected || !item?.sockets?.length)
      return `<div class="socketing-empty"><span class="socketing-empty-gem">${uiIcon('diamond')}</span><p>Select an item with sockets.</p><small>Socketed gear rolls from enemies and vendors; gems come from the jeweler.</small></div>`;
    const armed = this.armedGem >= 0 ? gemsAvailable(player).find(entry => entry.index === this.armedGem) : undefined;
    const bonus = socketBonusStats(item), active = socketBonusActive(item);
    // With a gem picked up, preview each socket: the first insertion that
    // completes the bonus lights the bonus line and flags the socket.
    const previews = armed ? item.sockets.map((_, i) => socketPreview(item, armed.item, i)) : [];
    const previewIndex = !active ? previews.findIndex(preview => preview.ok && preview.bonusActive) : -1;
    const slots = item.sockets.map((socket, i) => {
      const gem = gemDefinition(socket.gem);
      const color = GEM_COLOR_HEX[gem?.color ?? socket.color];
      const preview = previews[i];
      const completes = i === previewIndex;
      const matches = armed ? gemMatchesSocket(armed.gem, socket.color) : false;
      const hint = preview?.ok
        ? preview.replaces ? `Replaces ${gem?.name ?? 'the gem'} — it shatters`
          : completes ? 'Completes the socket bonus' : matches ? 'Matches this socket' : 'Off-color — no bonus match'
        : '';
      const label = gem ? `${gem.name} in ${socket.color} socket` : `Empty ${socket.color} socket`;
      return `<div class="socket-slot-row${completes ? ' is-completing' : ''}">
        <button type="button" class="ui-slot ui-item-slot socket-slot${gem ? ' is-filled' : ''}${armed && matches ? ' is-match' : ''}" data-socket="${i}" style="--socket-color:${color}" aria-label="${esc(label)}${gem ? ' — shift-click to remove' : ''}">
          <span class="socket-slot-gem" aria-hidden="true">◆</span>
        </button>
        <span class="socket-slot-copy"><strong style="color:${color}">${esc(gem?.name ?? `${socket.color} socket`)}</strong>
          <small>${gem ? gem.stats.map(stat => `${esc(STAT_LABELS[stat.stat])} ${esc(formatStatValue(stat.stat, gemStatValue(stat, socket.gemLevel ?? item.itemLevel)))}`).join(' · ') : 'Empty'}</small>
          ${hint ? `<small class="socket-slot-hint">${esc(hint)}</small>` : ''}</span>
        ${gem ? `<button type="button" class="ui-button ui-button--icon socket-remove" data-unsocket="${i}" aria-label="Remove ${esc(gem.name)} — the gem shatters" title="Remove — the gem shatters">×</button>` : ''}
      </div>`;
    }).join('');
    const bonusLine = bonus
      ? `<p class="socket-bonus${active ? ' is-active' : ''}${previewIndex >= 0 ? ' is-preview' : ''}">Socket bonus: ${esc(STAT_LABELS[bonus.stat])} ${esc(formatStatValue(bonus.stat, bonus.value))}${active ? '' : previewIndex >= 0 ? ' — placing the gem here completes it' : ' — match every socket color'}</p>`
      : '';
    return `<div class="socketing-detail-head">
        <span class="ui-slot ui-item-slot socket-detail-icon" style="--item-color:${TIER_COLORS[item.tier]}" data-filled="true" data-tier="${item.tier}">${itemSlotMarkup(item)}</span>
        <div class="socketing-detail-title"><strong>${esc(itemDisplayName(item))}</strong><small>${TIER_NAMES[item.tier]} · Item level ${item.itemLevel}</small></div>
        ${armed ? `<span class="socket-armed-chip" style="color:${GEM_COLOR_HEX[armed.gem.color]}">◆ ${esc(armed.gem.name)}<button type="button" class="ui-button ui-button--icon" data-gem="${armed.index}" aria-label="Put down ${esc(armed.gem.name)}">×</button></span>` : ''}
      </div>
      <div class="socketing-slots">${slots}</div>
      ${bonusLine}`;
  }

  private render(): void {
    const player = this.player;
    if (!player || this.element.hidden) return;
    const sheet = player.character;
    this.signature = this.dataSignature(sheet);
    const targets = socketTargets(player);
    if (this.selected && !socketTargetItem(sheet, this.selected)?.sockets?.length) this.selected = null;
    if (!this.selected && targets.length) this.selected = targets[0].target;
    const gems = gemsAvailable(player);
    if (this.armedGem >= 0 && !gems.some(entry => entry.index === this.armedGem)) this.armedGem = -1;
    const equipped = targets.filter(entry => 'equipped' in entry.target);
    const bagged = targets.filter(entry => 'bag' in entry.target);
    const focused = this.element.querySelector<HTMLElement>(':focus');
    const refocus = focused?.dataset.target ? `[data-target="${focused.dataset.target}"]`
      : focused?.dataset.gem !== undefined ? `[data-gem="${focused.dataset.gem}"]`
      : focused?.dataset.socket !== undefined ? `[data-socket="${focused.dataset.socket}"]`
      : focused?.dataset.unsocket !== undefined ? `[data-unsocket="${focused.dataset.unsocket}"]`
      : focused?.hasAttribute('data-close') ? '[data-close]' : null;
    this.element.innerHTML = `<section class="ui-window socketing-window" role="dialog" aria-modal="true" aria-labelledby="socketing-title" aria-busy="${this.busy}">
<header class="ui-window-header"><span class="ui-header-emblem socketing-emblem">${uiIcon('diamond')}</span><h2 class="ui-title" id="socketing-title">Socketing</h2><button class="ui-button ui-button--icon" data-close aria-label="Close socketing">×</button></header>
${this.notice ? `<p class="socketing-notice" role="status">${esc(this.notice)}</p>` : ''}
<div class="socketing-body">
  <section class="socketing-column ui-scroll-area" aria-label="Socketable items">
    <h3 class="socketing-heading">Equipment</h3>
    ${equipped.length ? equipped.map(entry => this.targetRow(entry)).join('') : '<p class="socketing-none">No socketed gear equipped.</p>'}
    <h3 class="socketing-heading">Bag</h3>
    ${bagged.length ? bagged.map(entry => this.targetRow(entry)).join('') : '<p class="socketing-none">No socketable items in your bag.</p>'}
  </section>
  <section class="socketing-column socketing-detail ui-scroll-area" aria-label="Item sockets">${this.detailMarkup()}</section>
  <section class="socketing-column ui-scroll-area" aria-label="Gems in your bag">
    <h3 class="socketing-heading">Gems</h3>
    ${gems.length ? gems.map(entry => this.gemRow(entry)).join('') : '<p class="socketing-none">No gems in your bag. The jeweler cuts and sells them.</p>'}
  </section>
</div>
<footer class="ui-window-footer"><span class="ui-muted">Click a gem, then a socket — or drag the gem onto it. Shift-click a set gem to remove it; removed gems shatter.</span><span>Esc <span class="ui-muted">Close</span></span></footer></section>`;
    attachPanelFrame(this.element, 'socketing');
    if (refocus) this.element.querySelector<HTMLElement>(refocus)?.focus({ preventScroll: true });
  }
}
