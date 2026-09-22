/** DOM surface for the WoW aura frame: two rows of square icons under the player
 * frame — buffs first, harmful effects second with a red border. Icons reuse the
 * shared skill-glass SVGs, consumable category glyphs and the mount glyph; a
 * conic drain sweep and seconds label carry the countdown. Hover/focus/tap opens
 * the shared explanation stack; right-click cancels a cancelable buff through the
 * injected onCancel hook (the validated cancelBuff command). */
import type { Player } from './model.ts';
import type { MountId } from './mount-content.ts';
import { MOUNTS } from './mount-content.ts';
import { buffFrameModel, formatAuraTime, type BuffFrameEntry, type BuffFrameModel } from './buff-frame.ts';
import { skillIconSVG } from './skill-icon.ts';
import type { SkillId } from './character-types.ts';
import { consumableCategoryIcon, type ConsumableCategory } from './consumable-content.ts';
import { escapeUI } from './ui-components.ts';
import { effectExplanation, effectTerm } from './effect-terms.ts';
import { UITooltipStack } from './ui-tooltip-stack.ts';
import './buff-frame.css';

/** Icon markup for one entry: skill glass, consumable category glyph, mount glyph
 * or a tinted letter tile for effects without authored art (procs, totem wards). */
export function auraIcon(entry: Pick<BuffFrameEntry, 'icon' | 'name' | 'color'>, size = 36): string {
  const icon = entry.icon;
  if (icon.startsWith('consumable:')) return consumableCategoryIcon(icon.slice(11) as ConsumableCategory, size);
  if (icon.startsWith('mount:')) {
    const def = MOUNTS[icon.slice(6) as MountId];
    if (def) return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke-linecap="round" aria-hidden="true"><path d="M6.5 20a8.5 8.5 0 1 1 11 0" stroke="${def.tint}" stroke-width="3.4"/><path d="M4.5 16.5 2.6 19.4M12 3.2V.8M19.5 16.5l1.9 2.9" stroke="${def.accent}" stroke-width="1.8"/></svg>`;
  }
  if (icon) return skillIconSVG(icon as SkillId, size);
  const letter = escapeUI(entry.name[0] ?? '?');
  return `<svg viewBox="0 0 36 36" width="${size}" height="${size}" aria-hidden="true"><rect x="2" y="2" width="32" height="32" fill="${escapeUI(entry.color)}33"/><text x="18" y="24" text-anchor="middle" font-size="18" fill="${escapeUI(entry.color)}">${letter}</text></svg>`;
}

/** WoW aura bar mounted under the player unit frame. The parent owns the mount
 * point, per-frame render(player) calls and the onCancel command route. */
export class BuffFrame {
  readonly element = document.createElement('div');
  /** Right-click cancel hook; wire to the validated cancelBuff command. */
  onCancel?: (key: string) => void;
  private readonly life = new AbortController();
  private readonly buffRow = document.createElement('div');
  private readonly debuffRow = document.createElement('div');
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private entries: readonly BuffFrameEntry[] = [];
  private tips: UITooltipStack | undefined;
  private shown = true;
  constructor() {
    this.element.className = 'buff-frame';
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', 'Player auras');
    this.buffRow.className = 'buff-frame-row';
    this.debuffRow.className = 'buff-frame-row buff-frame-debuffs';
    this.element.append(this.buffRow, this.debuffRow);
    const opts = { signal: this.life.signal };
    const show = (event: Event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-buff]');
      const entry = this.entries.find(e => e.key === button?.dataset.buff);
      if (!button || !entry || !this.tips) return;
      const time = formatAuraTime(entry);
      this.tips.show(`<h3>${escapeUI(entry.name)}</h3><p data-buff-summary>${escapeUI(entry.summary)}</p>${time ? `<p>${escapeUI(time)} remaining.</p>` : ''}${entry.cancelable ? '<p><small>Right-click to cancel.</small></p>' : ''}${entry.term ? `<p>${effectTerm(entry.term, 'How it works')}</p>` : ''}`, button);
    };
    this.element.addEventListener('pointerover', show, opts);
    this.element.addEventListener('focusin', show, opts);
    this.element.addEventListener('click', show, opts);
    this.element.addEventListener('contextmenu', event => {
      // WoW parity: right-click cancels a cancelable buff; never a world gesture.
      event.preventDefault();
      event.stopPropagation();
      const key = (event.target as Element).closest<HTMLButtonElement>('[data-buff]')?.dataset.buff;
      const entry = this.entries.find(e => e.key === key);
      if (entry?.cancelable) this.onCancel?.(entry.key);
    }, opts);
    this.element.addEventListener('keydown', event => { if (event.key !== 'Escape') event.stopPropagation(); }, opts);
    this.element.addEventListener('pointerleave', () => this.tips?.defer(), opts);
    for (const type of ['pointerdown', 'dblclick']) this.element.addEventListener(type, event => event.stopPropagation(), opts);
  }
  /** Attach to the HUD controls layer; creates the shared tooltip stack. */
  mount(parent: HTMLElement): void {
    parent.append(this.element);
    this.tips ??= new UITooltipStack(parent, effectExplanation, this.element);
  }
  open(): void { this.shown = true; this.syncVisibility(); }
  close(): void { this.shown = false; this.tips?.hide(); this.syncVisibility(); }
  /** Rebuild the icon rows from the live player; read-only, keyed DOM reuse. */
  render(player: Player): void { this.update(buffFrameModel(player)); }
  update(model: BuffFrameModel): void {
    this.entries = [...model.buffs, ...model.debuffs];
    const ids = new Set(this.entries.map(e => e.key));
    for (const [key, button] of this.buttons) if (!ids.has(key)) { this.tips?.hideBuff(key); button.remove(); this.buttons.delete(key); }
    for (const entry of this.entries) {
      this.tips?.refreshSummary(entry.key, entry.summary);
      const row = entry.harmful ? this.debuffRow : this.buffRow;
      let button = this.buttons.get(entry.key);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.dataset.buff = entry.key;
        button.innerHTML = `${auraIcon(entry)}<i class="buff-sweep" aria-hidden="true"></i><b class="buff-time" aria-hidden="true"></b>`;
        this.buttons.set(entry.key, button);
      }
      if (button.parentElement !== row) row.append(button);
      button.style.setProperty('--buff-color', entry.color);
      button.classList.toggle('debuff', entry.harmful);
      button.classList.toggle('cancelable', entry.cancelable);
      const spent = entry.duration > 0 && !entry.persistent ? Math.min(1, Math.max(0, 1 - entry.remaining / Math.max(.001, entry.duration))) : 0;
      button.style.setProperty('--buff-spent', `${spent * 100}%`);
      const label = `${entry.name}. ${entry.summary} ${entry.persistent ? 'Active.' : `${Math.ceil(entry.remaining)} seconds remaining.`}${entry.cancelable ? ' Right-click to cancel.' : ''}`;
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      const readout = button.querySelector('.buff-time')!, time = formatAuraTime(entry);
      if (readout.textContent !== time) readout.textContent = time;
    }
    this.buffRow.hidden = !model.buffs.length;
    this.debuffRow.hidden = !model.debuffs.length;
    this.syncVisibility();
  }
  private syncVisibility(): void { this.element.hidden = !this.shown || !this.entries.length; }
  hide(): void { this.update({ buffs: [], debuffs: [] }); this.tips?.hide(); }
  dispose(): void { this.life.abort(); this.tips?.dispose(); this.element.remove(); }
}
