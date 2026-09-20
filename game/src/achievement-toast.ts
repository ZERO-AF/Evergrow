/** Achievement unlock toasts (docs/wow-deepening.md §11).
 * WoW-style banner that drops from the top center on unlock. Self-timed via
 * rAF; presentation only — the ledger lives on `player.achievements`. */
import type { AchievementDef } from './achievement-content.ts';
import { escapeUI, uiIcon } from './ui-components.ts';
import './achievements.css';

const TOAST_SECONDS = 4.5;
const EXIT_SECONDS = 0.3;
const MAX_VISIBLE = 3;

interface ToastEntry { def: AchievementDef; element: HTMLElement; age: number; }

export class AchievementToasts {
  readonly element: HTMLElement;
  private stack: HTMLElement;
  private live: HTMLElement;
  private queue: AchievementDef[] = [];
  private visible: ToastEntry[] = [];
  private frame = 0;
  private last = 0;
  private disposed = false;

  constructor(mount: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'achievement-toasts';
    this.element.innerHTML = '<div class="achievement-toast-stack"></div><div class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>';
    this.stack = this.element.querySelector('.achievement-toast-stack')!;
    this.live = this.element.querySelector('[role="status"]')!;
    mount.append(this.element);
  }

  /** Queue an unlock banner; call once per def returned by achievementTrack. */
  show(def: AchievementDef): void {
    if (this.disposed) return;
    if (this.visible.some(t => t.def.id === def.id) || this.queue.some(d => d.id === def.id)) return;
    this.queue.push(def);
    this.live.textContent = `Achievement earned: ${def.name}.`;
    this.promote();
    this.schedule();
  }

  clear(): void {
    this.queue = [];
    for (const t of this.visible) t.element.remove();
    this.visible = [];
  }

  private promote(): void {
    while (this.visible.length < MAX_VISIBLE && this.queue.length) {
      const def = this.queue.shift()!;
      const element = document.createElement('div');
      element.className = 'achievement-toast';
      element.setAttribute('aria-hidden', 'true');
      element.innerHTML = `<div class="achievement-toast-kicker">Achievement Earned</div><div class="achievement-toast-name"><span class="achievement-toast-icon">${uiIcon(def.icon)}</span>${escapeUI(def.name)}</div>`;
      this.stack.append(element);
      this.visible.push({ def, element, age: 0 });
    }
  }

  private schedule(): void {
    if (this.frame || this.disposed) return;
    this.last = performance.now();
    const tick = (now: number) => {
      this.frame = 0;
      if (this.disposed) return;
      const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      for (const t of this.visible) {
        t.age += dt;
        t.element.classList.toggle('is-leaving', t.age >= TOAST_SECONDS);
      }
      for (let i = this.visible.length - 1; i >= 0; i--)
        if (this.visible[i].age >= TOAST_SECONDS + EXIT_SECONDS) {
          this.visible[i].element.remove();
          this.visible.splice(i, 1);
        }
      this.promote();
      if (this.visible.length || this.queue.length) {
        this.last = performance.now();
        this.frame = requestAnimationFrame(tick);
      }
    };
    this.frame = requestAnimationFrame(tick);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.clear();
    this.element.remove();
  }
}
