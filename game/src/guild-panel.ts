/** Guild panel (G) — projection of `player.character.guild` (docs/wow-deepening.md,
 * guild wave). Shows the guild banner and level bar, the perk track with unlock
 * thresholds, and the shared vault tab once Mobile Banking is unlocked.
 * Presentation only — founding and vault moves route through the hooks
 * (guild-command.ts). */
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { attachPanelFrame } from './panel-frames.ts';
import { itemSlotMarkup } from './item-ui.ts';
import { TIER_COLORS, itemDisplayName } from './items.ts';
import type { Player } from './model.ts';
import type { Item } from './character-types.ts';
import { GUILD_PERKS, GUILD_RULES, GUILD_VAULT_CAPACITY, type GuildPerkDef } from './guild-content.ts';
import {
  guildLevelProgress, guildOf, guildVaultUnlocked, unlockedGuildPerks, type GuildCarrier,
} from './guild-state.ts';
const e = escapeUI;

export interface GuildPanelHooks {
  close(): void;
  /** Durable founding; the host wraps it in its durable() + notify path. */
  found(name: string): void;
  /** Durable vault moves; the host wraps them in durable() + notify. */
  deposit(inventoryIndex: number): void;
  withdraw(vaultIndex: number): void;
}

export class GuildPanel {
  readonly element: HTMLElement;
  private abort = new AbortController();
  private focus: ReturnType<typeof trapDialogFocus> | null = null;
  private player: (Player & GuildCarrier) | null = null;
  private signature = '';
  private readonly hooks: GuildPanelHooks;

  constructor(mount: HTMLElement, hooks: GuildPanelHooks) {
    this.hooks = hooks;
    this.element = document.createElement('section');
    this.element.className = 'guild-panel';
    this.element.hidden = true;
    mount.append(this.element);
    attachPanelFrame(this.element, 'guild');
    this.element.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      if (b.dataset.close !== undefined) this.hooks.close();
      else if (b.dataset.found !== undefined) {
        const input = this.element.querySelector<HTMLInputElement>('[data-guild-name]');
        if (input) this.hooks.found(input.value);
      } else if (b.dataset.deposit !== undefined) this.hooks.deposit(Number(b.dataset.deposit));
      else if (b.dataset.withdraw !== undefined) this.hooks.withdraw(Number(b.dataset.withdraw));
    }, { signal: this.abort.signal });
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Enter' && (event.target as HTMLElement).dataset?.guildName !== undefined) {
        const input = event.target as HTMLInputElement;
        this.hooks.found(input.value);
      }
    }, { signal: this.abort.signal });
  }

  /** Refresh the projection; re-renders only when open and the ledger moved. */
  update(player: Player): void {
    this.player = player as Player & GuildCarrier;
    if (this.element.hidden) return;
    const signature = JSON.stringify([this.player.character.guild ?? null, this.player.character.guildVault ?? null,
      this.player.character.inventory]);
    if (signature !== this.signature) { this.signature = signature; this.render(); }
  }

  open(): void {
    this.signature = '';
    this.element.hidden = false;
    this.render();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal });
  }

  toggle(): void { if (this.element.hidden) this.open(); else this.hooks.close(); }
  get isOpen(): boolean { return !this.element.hidden; }

  close(): void {
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
  }

  private levelBar(player: Player & GuildCarrier): string {
    const { level, into, span, capped } = guildLevelProgress(player);
    const width = capped ? 100 : span > 0 ? Math.min(100, into / span * 100) : 0;
    const meta = capped ? 'Max level' : `${into.toLocaleString()} / ${span.toLocaleString()} guild XP`;
    return `<div class="guild-level-bar" role="meter" aria-label="Guild level progress"
        aria-valuemin="0" aria-valuemax="${span}" aria-valuenow="${into}"
        aria-valuetext="Level ${level}">
      <i style="width:${width}%"></i>
      <span class="guild-level-label">Level ${level}</span>
      <span class="guild-level-meta">${meta}</span></div>`;
  }

  private perkRow(player: Player & GuildCarrier, perk: GuildPerkDef): string {
    const unlocked = perk.level <= (guildOf(player)?.level ?? 0);
    const rank = GUILD_PERKS.filter(p => p.name === perk.name && p.level <= perk.level).length;
    const ranks = GUILD_PERKS.filter(p => p.name === perk.name).length;
    return `<article class="guild-perk ${unlocked ? 'is-unlocked' : ''}">
      <span class="guild-perk-icon">${uiIcon(perk.icon)}</span>
      <div class="guild-perk-body">
        <div class="guild-perk-name">${e(perk.name)}${ranks > 1 ? ` <span class="guild-perk-rank">Rank ${rank}</span>` : ''}
          <span class="guild-perk-level">${unlocked ? 'Unlocked' : `Guild level ${perk.level}`}</span></div>
        <div class="guild-perk-desc">${e(perk.description)}</div>
      </div></article>`;
  }

  private vaultCell(item: Item | null, index: number): string {
    const label = item ? `Withdraw ${itemDisplayName(item)}` : 'Empty vault slot';
    return `<button type="button" class="ui-slot ui-item-slot guild-vault-slot" ${item ? `data-withdraw="${index}"` : 'disabled'}
      style="--item-color:${item ? TIER_COLORS[item.tier] : 'var(--ui-silver-dim)'}"
      aria-label="${e(label)}"${item ? ` data-tooltip="${e(itemDisplayName(item))}" data-tooltip-placement="below"` : ''}>
      ${item ? itemSlotMarkup(item) : ''}</button>`;
  }

  private bagCell(item: Item | null, index: number): string {
    if (!item) return '';
    return `<button type="button" class="ui-slot ui-item-slot guild-bag-slot" data-deposit="${index}"
      style="--item-color:${TIER_COLORS[item.tier]}"
      aria-label="Deposit ${e(itemDisplayName(item))}" data-tooltip="Deposit ${e(itemDisplayName(item))}" data-tooltip-placement="below">
      ${itemSlotMarkup(item)}</button>`;
  }

  private vaultSection(player: Player & GuildCarrier): string {
    if (!guildVaultUnlocked(player))
      return `<div class="guild-vault-locked">${uiIcon('inventory')} The guild vault unlocks with <strong>Mobile Banking</strong> at guild level 12.</div>`;
    const vault = player.character.guildVault ?? [];
    const bag = player.character.inventory;
    const deposits = bag.map((item, index) => this.bagCell(item, index)).join('');
    return `<div class="guild-vault">
      <div class="guild-vault-grid" role="group" aria-label="Guild vault, ${GUILD_VAULT_CAPACITY} slots">
        ${Array.from({ length: GUILD_VAULT_CAPACITY }, (_, i) => this.vaultCell(vault[i] ?? null, i)).join('')}
      </div>
      <div class="guild-vault-bags">
        <div class="guild-vault-hint">Click a bag item to deposit it; click a vault item to withdraw.</div>
        <div class="guild-bag-strip ui-scroll-area" role="group" aria-label="Bag items">${deposits || '<span class="guild-vault-empty">Your bags are empty.</span>'}</div>
      </div></div>`;
  }

  private foundForm(): string {
    return `<div class="guild-found ui-well">
      <p class="guild-found-text">You are not in a guild. Found one to earn guild experience — ${Math.round(GUILD_RULES.xpShare * 100)}% of your experience feeds the guild level — and unlock perks.</p>
      <div class="guild-found-row">
        <input class="guild-name-input" data-guild-name type="text" maxlength="${GUILD_RULES.nameMax}"
          placeholder="Guild name" aria-label="Guild name" />
        <button type="button" class="ui-button ui-button--primary" data-found>Found guild</button>
      </div></div>`;
  }

  render(): void {
    const player = this.player;
    if (!player) return;
    const guild = guildOf(player);
    const focus = (document.activeElement as HTMLElement | null)?.dataset;
    const body = guild
      ? `<div class="guild-banner">
          <span class="guild-crest">${uiIcon('shield')}</span>
          <div class="guild-banner-body">
            <div class="guild-name">&lt;${e(guild.name)}&gt;</div>
            <div class="guild-since">Member since ${new Date(guild.memberSince * 1000).toLocaleDateString()}</div>
          </div></div>
        ${this.levelBar(player)}
        <h3 class="guild-section">Perks <span class="guild-section-meta">${unlockedGuildPerks(player).length} / ${GUILD_PERKS.length}</span></h3>
        <div class="guild-perk-list ui-scroll-area">${GUILD_PERKS.map(perk => this.perkRow(player, perk)).join('')}</div>
        <h3 class="guild-section">Guild vault</h3>
        ${this.vaultSection(player)}`
      : this.foundForm();
    this.element.innerHTML = `<section class="ui-window guild-window" role="dialog" aria-modal="true" aria-labelledby="guild-title">
      <header class="ui-window-header"><span class="guild-heading-icon">${uiIcon('shield')}</span><h2 class="ui-title" id="guild-title">Guild</h2><button class="ui-button ui-button--icon" data-close aria-label="Close guild">×</button></header>
      <div class="guild-body ui-scroll-area">${body}</div>
      <footer class="ui-window-footer"><span></span><span>G / Esc <span>Close</span></span></footer></section>`;
    if (focus?.guildName !== undefined) this.element.querySelector<HTMLElement>('[data-guild-name]')?.focus({ preventScroll: true });
  }

  dispose(): void {
    this.close();
    this.abort.abort();
    this.element.remove();
  }
}
