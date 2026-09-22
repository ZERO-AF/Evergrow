/**
 * Recount-style damage meter overlay: a small draggable ui-window that lives
 * over the HUD (not a modal phase — the sim keeps running). Title bar carries
 * the mode toggle ('Damage Done' / 'Healing Done'), a window selector
 * ('Current fight' / 'Overall'), a reset button and a close button; rows show
 * rank, source name, total, per-second rate, share and a % bar, and expand to
 * a per-skill breakdown.
 *
 * The panel owns no combat state: `update(meter)` re-renders from the headless
 * DamageMeter. Renders are throttled (~150ms) so per-frame drains don't churn
 * the DOM; user actions force an immediate render.
 */
import './damage-meter-panel.css';
import { attachPanelFrame, detachPanelFrame } from './panel-frames.ts';
import { escapeUI } from './ui-components.ts';
import type { DamageMeter, MeterMode, MeterRow } from './damage-meter.ts';

type MeterWindow = 'fight' | 'overall';

const RENDER_INTERVAL_MS = 150;

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}
function formatRate(value: number): string {
  return value >= 100 ? Math.round(value).toLocaleString('en-US') : value.toFixed(1);
}

export class DamageMeterPanel {
  readonly element: HTMLElement;
  private meter: DamageMeter | null = null;
  private mode: MeterMode = 'damage';
  private window: MeterWindow = 'fight';
  private readonly expanded = new Set<string>();
  private readonly lifetime = new AbortController();
  private lastRender = 0;

  constructor(mount: HTMLElement, meter?: DamageMeter) {
    this.meter = meter ?? null;
    this.element = document.createElement('section');
    this.element.className = 'ui-window damage-meter-window';
    this.element.setAttribute('role', 'region');
    this.element.setAttribute('aria-label', 'Damage meter');
    this.element.hidden = true;
    mount.append(this.element);
    attachPanelFrame(this.element, 'damageMeter');
    const signal = this.lifetime.signal;
    this.element.addEventListener('click', event => this.click(event), { signal });
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); this.close(); }
    }, { signal });
  }

  get isOpen(): boolean { return !this.element.hidden; }

  open(): void {
    this.element.hidden = false;
    this.render(true);
  }
  close(): void { this.element.hidden = true; }
  toggle(): void { this.isOpen ? this.close() : this.open(); }
  dispose(): void {
    this.close();
    detachPanelFrame(this.element);
    this.lifetime.abort();
    this.element.remove();
  }

  /** Re-render from the meter; pass a new meter to rebind. Throttled per frame. */
  update(meter?: DamageMeter): void {
    if (meter) this.meter = meter;
    this.render(false);
  }

  private click(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-mode],[data-window],[data-reset],[data-close],[data-expand]');
    if (!button) return;
    if (button.dataset.mode) this.mode = button.dataset.mode as MeterMode;
    else if (button.dataset.window) this.window = button.dataset.window as MeterWindow;
    else if (button.dataset.reset !== undefined) this.meter?.reset();
    else if (button.dataset.close !== undefined) { this.close(); return; }
    else if (button.dataset.expand !== undefined) {
      const source = button.dataset.expand;
      if (this.expanded.has(source)) this.expanded.delete(source);
      else this.expanded.add(source);
    }
    this.render(true);
  }

  private rows(): readonly MeterRow[] {
    if (!this.meter) return [];
    if (this.window === 'fight') {
      const start = this.meter.fightStartMs;
      if (start === undefined) return [];
      return this.meter.segment(start, this.meter.lastMs ?? start)[this.mode];
    }
    return this.meter.rows(this.mode);
  }

  private render(force: boolean): void {
    if (!this.isOpen) return;
    const now = Date.now();
    if (!force && now - this.lastRender < RENDER_INTERVAL_MS) return;
    this.lastRender = now;
    const scrollTop = this.element.querySelector('.meter-body')?.scrollTop ?? 0;
    const rows = this.rows();
    const title = this.mode === 'damage' ? 'Damage Done' : 'Healing Done';
    const body = rows.length === 0
      ? '<p class="meter-empty ui-muted">No combat recorded yet.</p>'
      : rows.map((row, index) => this.rowMarkup(row, index)).join('');
    this.element.innerHTML = `
      <header class="ui-window-header meter-header">
        <h2 class="ui-title meter-title">${title}</h2>
        <div class="meter-controls">
          <button class="ui-button ui-button--quiet meter-mode" data-mode="${this.mode === 'damage' ? 'healing' : 'damage'}"
            title="Switch to ${this.mode === 'damage' ? 'Healing Done' : 'Damage Done'}">${this.mode === 'damage' ? 'DMG' : 'HEAL'}</button>
          <button class="ui-button ui-button--quiet meter-window-toggle" data-window="${this.window === 'fight' ? 'overall' : 'fight'}"
            title="Toggle segment">${this.window === 'fight' ? 'Current fight' : 'Overall'}</button>
          <button class="ui-button ui-button--icon" data-reset title="Reset meter" aria-label="Reset meter">↺</button>
          <button class="ui-button ui-button--icon" data-close aria-label="Close">×</button>
        </div>
      </header>
      <div class="ui-window-body meter-body ui-scroll-area">${body}</div>`;
    const scroller = this.element.querySelector('.meter-body');
    if (scroller) scroller.scrollTop = scrollTop;
    attachPanelFrame(this.element, 'damageMeter');
  }

  private rowMarkup(row: MeterRow, index: number): string {
    const expanded = this.expanded.has(row.source);
    const percent = Math.round(row.share * 1000) / 10;
    const bar = Math.min(100, Math.max(0, row.share * 100));
    const detail = expanded
      ? `<ul class="meter-skills">${row.skills.map(skill =>
          `<li class="meter-skill"><span class="meter-skill-name">${escapeUI(skill.label)}</span><span class="meter-skill-stats">${formatAmount(skill.total)} · ${Math.round(skill.share * 100)}%${skill.crits ? ` · ${skill.crits} crit${skill.crits > 1 ? 's' : ''}` : ''}</span></li>`).join('')}</ul>`
      : '';
    return `<div class="meter-row-wrap${expanded ? ' is-expanded' : ''}">
      <button class="meter-row" data-expand="${escapeUI(row.source)}" title="${row.hits} hits · ${row.crits} crits · max ${formatAmount(row.maxHit)}">
        <span class="meter-bar" style="width:${bar}%"></span>
        <span class="meter-rank">${index + 1}.</span>
        <span class="meter-name">${escapeUI(row.name)}</span>
        <span class="meter-numbers">${formatAmount(row.total)} <em>(${formatRate(row.perSecond)}, ${percent}%)</em></span>
      </button>${detail}</div>`;
  }
}
