/** Achievements panel (Y) — read-only projection of `player.achievements`.
 * Follows the JourneyPanel lifecycle: `update(player)` per frame, `open()` /
 * `close()` driven by the panel coordinator. Never mutates state. */
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, type AchievementCategory, type AchievementDef } from './achievement-content.ts';
import { attachPanelFrame } from './panel-frames.ts';
import { achievementComplete, achievementEarnedCount, achievementProgress } from './achievement-state.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import type { Player } from './model.ts';
import './achievements.css';

const e = escapeUI;
type Filter = 'All' | 'Earned' | AchievementCategory;
const FILTERS: readonly Filter[] = ['All', 'Earned', ...ACHIEVEMENT_CATEGORIES];

export class AchievementPanel {
  readonly element: HTMLElement;
  private abort = new AbortController();
  private focus: ReturnType<typeof trapDialogFocus> | null = null;
  private filter: Filter = 'All';
  private player: Player | null = null;
  private signature = '';
  private hooks: { close(): void };

  constructor(mount: HTMLElement, hooks: { close(): void }) {
    this.hooks = hooks;
    this.element = document.createElement('section');
    this.element.className = 'achievement-panel';
    this.element.hidden = true;
    mount.append(this.element);
    attachPanelFrame(this.element, 'achievements');
    this.element.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      if (b.dataset.close !== undefined) this.hooks.close();
      else if (b.dataset.filter) { this.filter = b.dataset.filter as Filter; this.render(); }
    }, { signal: this.abort.signal });
  }

  /** Refresh the projection; re-renders only when the ledger changed. */
  update(player: Player): void {
    this.player = player;
    if (this.element.hidden) return;
    const signature = JSON.stringify(player.achievements ?? {});
    if (signature !== this.signature) { this.signature = signature; this.render(); }
  }

  open(): void {
    this.signature = '';
    this.element.hidden = false;
    this.render();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal });
  }

  close(): void {
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
  }

  private card(a: AchievementDef, player: Player): string {
    const earned = achievementComplete(player.achievements, a.id);
    const { value, target } = achievementProgress(a, player);
    const stamp = player.achievements?.[a.id] ?? 0;
    const meta = earned
      ? `Earned ${new Date(stamp * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
      : `${Math.min(value, target).toLocaleString()} / ${target.toLocaleString()}`;
    const bar = earned ? '' : `<div class="achievement-card-progress" role="meter" aria-label="${e(a.name)} progress" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(value, target)}"><i style="width:${Math.min(100, target > 0 ? value / target * 100 : 0)}%"></i></div>`;
    return `<article class="achievement-card ${earned ? 'is-earned' : ''}">
      <span class="achievement-card-icon">${uiIcon(a.icon)}</span>
      <div class="achievement-card-body">
        <div class="achievement-card-name">${earned ? '<span class="achievement-check">✓</span>' : ''}${e(a.name)}</div>
        <div class="achievement-card-desc">${e(a.description)}</div>
        ${bar}
        <div class="achievement-card-meta">${meta}</div>
      </div></article>`;
  }

  private render(): void {
    const player = this.player;
    if (!player) return;
    const earned = achievementEarnedCount(player.achievements);
    const list = ACHIEVEMENTS.filter(a =>
      this.filter === 'All' ? true : this.filter === 'Earned' ? achievementComplete(player.achievements, a.id) : a.category === this.filter);
    const focus = (document.activeElement as HTMLElement | null)?.dataset;
    this.element.innerHTML = `<section class="ui-window achievement-window" role="dialog" aria-modal="true" aria-labelledby="achievement-title">
      <header class="ui-window-header"><span class="achievement-heading-icon">${uiIcon('star')}</span><h2 class="ui-title" id="achievement-title">Achievements</h2><button class="ui-button ui-button--icon" data-close aria-label="Close achievements">×</button></header>
      <div class="achievement-summary"><strong>${earned} / ${ACHIEVEMENTS.length}</strong><span>achievements earned</span></div>
      <nav class="achievement-filters" aria-label="Achievement filters">${FILTERS.map(f => `<button data-filter="${e(f)}" aria-pressed="${this.filter === f}">${e(f)}</button>`).join('')}</nav>
      <div class="achievement-grid ui-scroll-area">${list.length ? list.map(a => this.card(a, player)).join('') : '<div class="achievement-empty">No achievements in this view yet.</div>'}</div>
      <footer class="ui-window-footer"><span></span><span>Y / Esc <span>Close</span></span></footer></section>`;
    if (focus?.filter) this.element.querySelector<HTMLElement>(`[data-filter="${CSS.escape(focus.filter)}"]`)?.focus({ preventScroll: true });
  }

  dispose(): void {
    this.close();
    this.abort.abort();
    this.element.remove();
  }
}
