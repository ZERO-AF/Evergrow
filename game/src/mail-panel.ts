/**
 * Mailbox window (WotLK-style): read the inbox, collect item/gold attachments,
 * and compose letters to the player's other characters. Read-only projection —
 * every mutation goes through the injected durable command hooks.
 */
import './mail-panel.css';
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
import { MAIL_RULES, type MailDraft, type MailMessage, type MailRecipient } from './mail-content.ts';
import { mailHasAttachment, mailOf, unreadMailCount } from './mail-state.ts';

type Action = Promise<{ ok: boolean; message: string }>;
export interface MailActions {
  close(): void;
  /** Saved characters in the other local slots (compose recipients). */
  recipients(): Promise<MailRecipient[]>;
  send(draft: MailDraft): Action;
  collect(id: string): Action;
  read(id: string): Action;
  remove(id: string): Action;
}

const timeLeft = (expiresAt: number, now: number): string => {
  const ms = Math.max(0, expiresAt - now);
  const days = Math.floor(ms / 86_400_000), hours = Math.floor(ms / 3_600_000) % 24;
  return days >= 1 ? `${days}d ${hours}h` : hours >= 1 ? `${hours}h` : `${Math.max(1, Math.floor(ms / 60_000))}m`;
};
const sentAgo = (sentAt: number, now: number): string => {
  const ms = Math.max(0, now - sentAt);
  const days = Math.floor(ms / 86_400_000), hours = Math.floor(ms / 3_600_000);
  return days >= 1 ? `${days}d ago` : hours >= 1 ? `${hours}h ago` : 'just now';
};

export class MailPanel {
  readonly element: HTMLElement;
  private player!: Player;
  private tab: 'inbox' | 'compose' = 'inbox';
  private selected: string | null = null;
  private recipients: MailRecipient[] | null = null;
  private composeTo = -1;
  private composeSubject = '';
  private composeBody = '';
  private composeItem: number | null = null;
  private composeGold = '';
  private notice = '';
  private busy = false;
  private readonly tooltip: ItemTooltip;
  private readonly abort = new AbortController();
  private focus: { dispose(): void } | null = null;
  private timer: ReturnType<typeof globalThis.setInterval> | null = null;
  private readonly actions: MailActions;
  private readonly now: () => number;

  constructor(mount: HTMLElement, actions: MailActions, now: () => number = Date.now) {
    this.actions = actions;
    this.now = now;
    this.element = document.createElement('section');
    this.element.className = 'mail-panel ui-window';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'mail-title');
    mount.append(this.element);
    attachPanelFrame(this.element, 'mail');
    this.tooltip = new ItemTooltip(this.element, 'mail-tooltip');
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
    this.tab = 'inbox';
    this.selected = null;
    this.notice = '';
    this.element.hidden = false;
    this.render();
    this.focus?.dispose();
    this.focus = trapDialogFocus(this.element, { initialFocus: this.element, restoreFocus: false });
    this.timer = setInterval(() => this.tick(), 30_000);
    void this.loadRecipients();
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

  private async loadRecipients(): Promise<void> {
    try {
      this.recipients = await this.actions.recipients();
      if (this.composeTo < 0 && this.recipients.length) this.composeTo = this.recipients[0].slot;
    } catch { this.recipients = []; }
    if (!this.element.hidden && this.tab === 'compose') this.render();
  }

  /** Lightweight countdown refresh that does not rebuild the DOM. */
  private tick(): void {
    if (this.element.hidden || !this.player) return;
    const now = this.now();
    for (const el of this.element.querySelectorAll<HTMLElement>('[data-expires]')) {
      const at = Number(el.dataset.expires);
      if (Number.isFinite(at)) el.textContent = timeLeft(at, now);
    }
  }

  private resolve(key: string): { item: Item; context?: string } | null {
    if (key.startsWith('mail:')) {
      const message = mailOf(this.player.character)?.messages.find(m => m.id === key.slice(5));
      return message?.item ? { item: message.item, context: 'Attached — collect to claim' } : null;
    }
    if (key.startsWith('bag:')) {
      const item = this.player.character.inventory[Number(key.slice(4))];
      return item ? { item, context: 'Attach to this letter' } : null;
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
      if (result.message) this.notice = result.message;
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private click(e: MouseEvent): void {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-close],[data-tab],[data-row],[data-collect],[data-delete],[data-attach],[data-send]');
    if (!b || !this.player) return;
    if (b.dataset.close !== undefined) { this.actions.close(); return; }
    if (b.dataset.tab !== undefined) {
      this.tab = b.dataset.tab as typeof this.tab;
      this.notice = '';
      if (this.tab === 'compose' && !this.recipients) void this.loadRecipients();
      this.render();
      return;
    }
    if (b.dataset.row !== undefined) {
      const id = b.dataset.row;
      this.selected = this.selected === id ? null : id;
      this.render();
      const message = mailOf(this.player.character)?.messages.find(m => m.id === id);
      if (this.selected && message && !message.read) void this.run(() => this.actions.read(id));
      return;
    }
    if (b.dataset.attach !== undefined) {
      this.composeItem = this.composeItem === Number(b.dataset.attach) ? null : Number(b.dataset.attach);
      this.render();
      return;
    }
    if (this.busy) return;
    if (b.dataset.collect !== undefined) void this.run(() => this.actions.collect(b.dataset.collect!));
    else if (b.dataset.delete !== undefined) void this.run(async () => {
      const result = await this.actions.remove(b.dataset.delete!);
      if (result.ok && this.selected === b.dataset.delete) this.selected = null;
      return result;
    });
    else if (b.dataset.send !== undefined) {
      const draft: MailDraft = {
        to: this.composeTo, subject: this.composeSubject, body: this.composeBody,
        itemRef: this.composeItem ?? undefined,
        gold: Math.floor(Number(this.composeGold)) || 0,
      };
      void this.run(async () => {
        const result = await this.actions.send(draft);
        if (result.ok) {
          this.composeSubject = ''; this.composeBody = ''; this.composeItem = null; this.composeGold = '';
          this.tab = 'inbox';
        }
        return result;
      });
    }
  }

  private input(e: Event): void {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (el.dataset.subject !== undefined) this.composeSubject = el.value;
    else if (el.dataset.body !== undefined) this.composeBody = el.value;
    else if (el.dataset.gold !== undefined) this.composeGold = el.value;
  }

  private change(e: Event): void {
    const el = e.target as HTMLSelectElement;
    if (el.dataset.to !== undefined) this.composeTo = Number(el.value);
  }

  private inboxRow(m: MailMessage, now: number): string {
    const attached = mailHasAttachment(m);
    return `<button class="mail-row${this.selected === m.id ? ' is-selected' : ''}${m.read ? '' : ' is-unread'}" data-row="${escapeUI(m.id)}" ${m.item ? `data-item="mail:${escapeUI(m.id)}"` : ''}>
    <span class="mail-row-icon">${m.item ? itemIconSVG(m.item, 34) : `<span class="mail-letter">${uiIcon('journal')}</span>`}</span>
    <span class="mail-row-name">${escapeUI(m.subject)}<small>${escapeUI(m.from)}${m.system ? ' · system' : ''}${attached ? ` · ${m.item ? escapeUI(itemDisplayName(m.item)) : ''}${m.item && m.gold ? ' + ' : ''}${m.gold ? formatWalletCompact(m.gold) : ''}` : ''}</small></span>
    <span class="mail-row-time" data-expires="${m.expiresAt}" title="Expires">${timeLeft(m.expiresAt, now)}</span>
  </button>`;
  }

  render(): void {
    if (!this.player) return;
    const now = this.now();
    const messages = [...(mailOf(this.player.character)?.messages ?? [])].reverse(); // newest first
    const unread = unreadMailCount(this.player.character);
    const selected = messages.find(m => m.id === this.selected) ?? null;
    const gold = goldBalance(this.player.character);
    const attachItem = this.composeItem === null ? null : this.player.character.inventory[this.composeItem] ?? null;

    this.element.innerHTML = `
<header class="ui-window-header"><span class="ui-header-emblem">${uiIcon('journal')}</span><h2 class="ui-title" id="mail-title">Mailbox</h2><span class="mail-wallet"><b>${formatWallet(gold)}</b>${unread ? `<small>${unread} unread</small>` : ''}</span><button class="ui-button ui-button--icon" data-close aria-label="Close mailbox">×</button></header>
<nav class="mail-tabs" role="tablist">
  <button class="ui-button ui-button--quiet" role="tab" data-tab="inbox" aria-pressed="${this.tab === 'inbox'}">Inbox${messages.length ? ` <small>${messages.length}</small>` : ''}</button>
  <button class="ui-button ui-button--quiet" role="tab" data-tab="compose" aria-pressed="${this.tab === 'compose'}">Compose</button>
  <span>letters expire after ${MAIL_RULES.expiryDays} days</span>
</nav>
${this.tab === 'inbox' ? `
<div class="mail-body">
  <div class="mail-list" role="listbox" aria-label="Inbox">
    ${messages.map(m => this.inboxRow(m, now)).join('') || '<p class="mail-empty">No mail. Letters from your other characters and the auction house arrive here.</p>'}
  </div>
  <div class="mail-read">
    ${selected ? `
    <header class="mail-read-head"><h3>${escapeUI(selected.subject)}</h3><small>From ${escapeUI(selected.from)} · ${sentAgo(selected.sentAt, now)} · expires in ${timeLeft(selected.expiresAt, now)}</small></header>
    <p class="mail-read-body">${escapeUI(selected.body) || '<i>No message.</i>'}</p>
    ${mailHasAttachment(selected) ? `<div class="mail-attachments">
      ${selected.item ? `<span class="mail-cell ui-item-slot" data-item="mail:${escapeUI(selected.id)}" style="--item-color:${TIER_COLORS[selected.item.tier]}">${itemSlotMarkup(selected.item, 40)}</span>` : ''}
      ${selected.gold ? `<span class="mail-gold">${uiIcon('gold')} ${formatWallet(selected.gold)}</span>` : ''}
    </div>` : ''}
    <div class="mail-read-actions">
      ${mailHasAttachment(selected) ? `<button class="ui-button ui-button--primary" data-collect="${escapeUI(selected.id)}" ${this.busy ? 'disabled' : ''}>Collect attachments</button>` : ''}
      <button class="ui-button ui-button--quiet" data-delete="${escapeUI(selected.id)}" ${this.busy || mailHasAttachment(selected) ? 'disabled' : ''}>Delete</button>
    </div>` : '<p class="mail-empty">Select a letter to read it.</p>'}
  </div>
</div>
<footer class="ui-window-footer"><span class="mail-message" role="status">${escapeUI(this.notice)}</span></footer>` : ''}
${this.tab === 'compose' ? `
<div class="mail-body">
  <div class="mail-bag" role="listbox" aria-label="Pack items">
    ${this.player.character.inventory.map((item, i) => item && !item.locked
      ? `<button class="mail-cell ui-item-slot${this.composeItem === i ? ' is-selected' : ''}" role="option" aria-selected="${this.composeItem === i}" data-attach="${i}" data-item="bag:${i}" aria-label="Attach ${escapeUI(itemDisplayName(item))}" style="--item-color:${TIER_COLORS[item.tier]}">${itemSlotMarkup(item, 40)}</button>`
      : '').join('') || '<p class="mail-empty">Your pack is empty.</p>'}
  </div>
  <div class="mail-compose">
    ${this.recipients === null ? '<p class="mail-empty">Loading characters…</p>'
      : this.recipients.length === 0 ? '<p class="mail-empty">No other characters on this account. Create another hero in the character hall to send mail.</p>'
      : `
    <label class="mail-field">To
      <select class="ui-input" data-to>${this.recipients.map(r =>
        `<option value="${r.slot}" ${this.composeTo === r.slot ? 'selected' : ''}>${escapeUI(r.name)} · level ${r.level}</option>`).join('')}</select></label>
    <label class="mail-field">Subject<input class="ui-input" data-subject maxlength="${MAIL_RULES.maxSubject}" value="${escapeUI(this.composeSubject)}" placeholder="(no subject)"></label>
    <label class="mail-field">Message<textarea class="ui-input" data-body rows="5" maxlength="${MAIL_RULES.maxBody}" placeholder="Write a letter…">${escapeUI(this.composeBody)}</textarea></label>
    <div class="mail-field">Attachment
      <div class="mail-attach-row">
        ${attachItem ? `<span class="mail-cell ui-item-slot is-selected" data-item="bag:${this.composeItem}" style="--item-color:${TIER_COLORS[attachItem.tier]}">${itemSlotMarkup(attachItem, 40)}</span><small style="color:${TIER_COLORS[attachItem.tier]}">${escapeUI(itemDisplayName(attachItem))}</small>` : '<small>Pick an item from your pack (optional).</small>'}
      </div></div>
    <label class="mail-field">Gold (copper)<input class="ui-input" data-gold type="number" min="0" max="${MAIL_RULES.maxGold}" step="1" value="${escapeUI(this.composeGold)}" placeholder="0"></label>
    <p class="mail-quote">Postage ${formatWalletCompact(MAIL_RULES.postage)}${attachItem || Number(this.composeGold) > 0 ? ' · attachments delivered instantly' : ''}</p>`}
  </div>
</div>
<footer class="ui-window-footer"><span class="mail-message" role="status">${escapeUI(this.notice)}</span><button class="ui-button ui-button--primary" data-send ${this.busy || !this.recipients?.length || this.composeTo < 0 ? 'disabled' : ''}>Send mail · ${formatWalletCompact(MAIL_RULES.postage)}</button></footer>` : ''}`;
    attachPanelFrame(this.element, 'mail');
  }
}
