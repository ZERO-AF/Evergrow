/** Class trainer shop (WotLK): a dedicated panel listing the player's class
 * stock — new skills to learn and rank upgrades for known ones — priced in
 * gold and gated by level. Buys route through executeLearnSkill /
 * executeUpgradeRank in game.ts; the panel re-renders from the refreshed
 * sheet. Mirrors the badge vendor's row/balance layout. */
import { attachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { npcEmblem } from './npc-art.ts';
import { skillIconSVG } from './skill-icon.ts';
import { goldBalance } from './wallet.ts';
import { formatWallet, formatWalletCompact } from './currency.ts';
import { sheetClassId } from './skill-progression.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { WOW_CLASSES } from './wow-classes.ts';
import { trainerStock, type TrainerStockEntry } from './trainer-content.ts';
import type { Trainer } from './trainer-npc.ts';
import type { ActionResult, SkillId } from './character-types.ts';
import type { Player } from './model.ts';
import './trainer-panel.css';

const esc = escapeUI;

export interface TrainerPanelActions {
  close(): void;
  /** Durable learn (executeLearnSkill); the returned message is shown in the panel. */
  learn(skillId: SkillId): Promise<ActionResult>;
  /** Durable rank upgrade (executeUpgradeRank). */
  upgrade(skillId: SkillId): Promise<ActionResult>;
}
export class TrainerPanel {
  readonly element: HTMLElement;
  private readonly abort = new AbortController();
  private readonly actions: TrainerPanelActions;
  private focus: { dispose(): void } | null = null;
  private player: Player | null = null;
  private trainer: Trainer | null = null;
  private notice = '';
  private busy = false;

  constructor(mount: HTMLElement, actions: TrainerPanelActions) {
    this.actions = actions;
    this.element = document.createElement('section');
    this.element.className = 'trainer-panel ui-window';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'trainer-title');
    mount.append(this.element);
    attachPanelFrame(this.element, 'trainer');
    const signal = this.abort.signal;
    this.element.addEventListener('click', event => this.click(event), { signal });
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); this.actions.close(); }
    }, { signal });
  }

  get opened() { return !this.element.hidden; }

  open(player: Player, trainer: Trainer): void {
    this.player = player;
    this.trainer = trainer;
    this.notice = '';
    this.element.hidden = false;
    this.render();
    this.focus?.dispose();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal, initialFocus: this.element, restoreFocus: false });
  }

  close(): void {
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
    this.trainer = null;
  }

  dispose(): void {
    this.close();
    this.abort.abort();
    this.element.remove();
  }

  private click(event: MouseEvent): void {
    const control = (event.target as HTMLElement).closest<HTMLElement>('[data-close],[data-learn],[data-upgrade]');
    if (!control || this.busy) return;
    if (control.hasAttribute('data-close')) { this.actions.close(); return; }
    if ((control as HTMLButtonElement).disabled) return;
    const learnId = control.dataset.learn, upgradeId = control.dataset.upgrade;
    const action = learnId ? this.actions.learn(learnId as SkillId) : upgradeId ? this.actions.upgrade(upgradeId as SkillId) : null;
    if (!action) return;
    this.busy = true;
    void action.then(result => {
      this.notice = result.message ?? '';
      this.busy = false;
      this.render();
    });
  }

  private stockRow(entry: TrainerStockEntry): string {
    const definition = SKILL_DEFINITIONS[entry.skillId];
    const meta = entry.kind === 'learn'
      ? `Requires level ${entry.requiredLevel} · ${entry.tier}`
      : `Rank ${entry.rank - 1} → ${entry.rank} · Requires level ${entry.requiredLevel}`;
    const action = entry.kind === 'learn' ? `data-learn="${entry.skillId}"` : `data-upgrade="${entry.skillId}"`;
    const label = entry.kind === 'learn' ? 'Learn' : 'Train';
    return `<article class="trainer-row${entry.locked ? ' is-blocked' : ''}">
      <span class="trainer-icon" style="color:${esc(definition?.color ?? '#e3ddc4')}">${skillIconSVG(entry.skillId, 30)}</span>
      <div class="trainer-copy"><strong>${esc(entry.name)}</strong><small>${esc(meta)}</small></div>
      <span class="trainer-price">${uiIcon('gold')}${formatWalletCompact(entry.cost)}</span>
      <button type="button" class="ui-button ui-button--primary trainer-buy" ${action} ${entry.locked ? 'disabled' : ''} title="${esc(entry.reason ?? `${label} ${entry.name}`)}">${entry.locked ? esc(entry.reason ?? 'Locked') : label}</button>
    </article>`;
  }

  private render(): void {
    const player = this.player, trainer = this.trainer;
    if (!player || !trainer) return;
    const sheet = player.character;
    const classId = sheetClassId(sheet);
    const stock = classId ? trainerStock(classId, player.level, sheet) : [];
    const learn = stock.filter(entry => entry.kind === 'learn');
    const ranks = stock.filter(entry => entry.kind === 'rank');
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active && this.element.contains(active)
      ? active.dataset.learn ? `[data-learn="${active.dataset.learn}"]`
        : active.dataset.upgrade ? `[data-upgrade="${active.dataset.upgrade}"]` : null
      : null;
    const group = (title: string, rows: readonly TrainerStockEntry[]) => rows.length
      ? `<section class="trainer-group"><h3 class="trainer-group-title">${title}<span>${rows.filter(r => !r.locked).length}/${rows.length}</span></h3>${rows.map(entry => this.stockRow(entry)).join('')}</section>`
      : '';
    this.element.innerHTML = `<header class="ui-window-header"><span class="ui-header-emblem">${npcEmblem('trainer')}</span><h2 class="ui-title" id="trainer-title">Class Trainer</h2><span class="trainer-name">${esc(trainer.name)}</span><button class="ui-button ui-button--icon" data-close aria-label="Close">×</button></header>
      <div class="trainer-balance" role="status">
        <span>${uiIcon('gold')}<b>${formatWallet(goldBalance(sheet))}</b></span>
        <span class="trainer-class">${esc(classId ? WOW_CLASSES[classId].name : 'Adventurer')}</span>
      </div>
      <div class="trainer-stock ui-scroll-area">${stock.length
        ? `${group('Learn new skills', learn)}${group('Train ranks', ranks)}`
        : '<p class="trainer-empty">The trainer has nothing to teach you.</p>'}</div>
      ${this.notice ? `<p class="trainer-notice" role="status">${esc(this.notice)}</p>` : ''}`;
    attachPanelFrame(this.element, 'trainer');
    if (focusKey) this.element.querySelector<HTMLElement>(focusKey)?.focus({ preventScroll: true });
  }
}
