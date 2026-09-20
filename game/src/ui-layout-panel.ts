/**
 * WoW-style edit-mode panel + DOM panel frame registration.
 *
 * Two exports:
 *  - `registerPanelFrames()` — registers every popup window's frame id with the
 *    shared ui-layout store so panels appear in the edit list and resolve
 *    persisted layouts. Call once during game construction.
 *  - `UiLayoutPanel` — the floating "Edit Layout" window: every registered
 *    frame grouped by `group`, with per-frame Lock / Hide / Scale / Reset
 *    controls plus global 'Reset all' and 'Done'. Opening it enters edit mode;
 *    closing (or an external `setUiEditMode(false)`) leaves it.
 *
 * `attachPanelFrame(el, id)` is the idempotent attach helper panels should call
 * instead of raw `attachUiFrame`: panels that rebuild `innerHTML` on render
 * recreate their `.ui-window` node, and this re-attaches to the new node while
 * disposing the stale handle (no listener/subscription leaks).
 *
 * Render-side module — not part of tsconfig.core.json's headless set.
 */
import {
  onUiLayoutChange, resetUiLayout,
  setUiEditMode, setUiLayout, uiEditMode, uiFrames, uiLayout,
  type UiFrameSpec,
} from './ui-layout.ts';
export { attachPanelFrame, detachPanelFrame, registerPanelFrames } from './panel-frames.ts';
import { escapeUI } from './ui-components.ts';
import './ui-layout.css';
import './ui-layout-panel.css';

const e = escapeUI;

const GROUP_ORDER = ['Panels', 'HUD', 'Combat'] as const;

/** Floating edit-mode window. Not a coordinator phase — it floats beside
 * whatever is open so frames can be dragged while it stays visible. */
export class UiLayoutPanel {
  readonly element: HTMLElement;
  private readonly abort = new AbortController();
  private readonly hooks: { close(): void };
  private readonly unsub: () => void;

  constructor(mount: HTMLElement, hooks: { close(): void }) {
    this.hooks = hooks;
    this.element = document.createElement('section');
    this.element.className = 'ui-layout-panel';
    this.element.hidden = true;
    mount.append(this.element);
    const signal = this.abort.signal;
    this.element.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      const id = b.dataset.frame;
      if (b.dataset.done !== undefined || b.dataset.close !== undefined) this.close();
      else if (b.dataset.resetAll !== undefined) resetUiLayout();
      else if (id && b.dataset.lock !== undefined) setUiLayout(id, { locked: !uiLayout(id).locked });
      else if (id && b.dataset.hide !== undefined) setUiLayout(id, { visible: !uiLayout(id).visible });
      else if (id && b.dataset.reset !== undefined) resetUiLayout(id);
    }, { signal });
    this.element.addEventListener('input', event => {
      const input = event.target as HTMLInputElement;
      if (input.dataset.scale === undefined || !input.dataset.frame) return;
      setUiLayout(input.dataset.frame, { scale: Number(input.value) / 100 });
    }, { signal });
    this.element.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }, { signal });
    // External edit-mode exit (Escape handled by the game, another toggle)
    // closes the panel; the hooks call is skipped because close() already ran.
    this.unsub = onUiLayoutChange(() => {
      if (!uiEditMode() && !this.element.hidden) {
        this.element.hidden = true;
        this.hooks.close();
      }
      this.sync();
    });
  }

  get opened(): boolean { return !this.element.hidden; }

  open(): void {
    this.render();
    this.element.hidden = false;
    setUiEditMode(true);
  }

  close(): void {
    if (this.element.hidden) return;
    this.element.hidden = true;
    setUiEditMode(false);
    this.hooks.close();
  }

  toggle(): void { if (this.opened) this.close(); else this.open(); }

  private row(spec: UiFrameSpec): string {
    const l = uiLayout(spec.id);
    const min = Math.round((spec.minScale ?? 0.6) * 100);
    const max = Math.round((spec.maxScale ?? 1.6) * 100);
    const movable = spec.movable !== false;
    const scalable = spec.scalable !== false;
    const hidable = spec.hidable === true;
    return `<div class="ui-layout-row" data-row="${e(spec.id)}">
      <span class="ui-layout-name" title="${e(spec.label)}">${e(spec.label)}</span>
      <button type="button" class="ui-button ui-button--quiet ui-layout-toggle" data-frame="${e(spec.id)}" data-lock
        aria-pressed="${l.locked}" ${movable ? '' : 'disabled'}
        aria-label="${l.locked ? 'Unlock' : 'Lock'} ${e(spec.label)}"
        title="${l.locked ? 'Unlock: allow dragging' : 'Lock: prevent dragging'}">${l.locked ? 'Locked' : 'Lock'}</button>
      <button type="button" class="ui-button ui-button--quiet ui-layout-toggle" data-frame="${e(spec.id)}" data-hide
        aria-pressed="${!l.visible}" ${hidable ? '' : 'disabled'}
        aria-label="${l.visible ? 'Hide' : 'Show'} ${e(spec.label)}"
        title="${l.visible ? 'Hide this frame' : 'Show this frame'}">${l.visible ? 'Hide' : 'Hidden'}</button>
      <button type="button" class="ui-button ui-button--quiet ui-layout-toggle" data-frame="${e(spec.id)}" data-reset
        aria-label="Reset ${e(spec.label)} position and scale" title="Reset position and scale">Reset</button>
      <label class="ui-layout-scale ${scalable ? '' : 'is-disabled'}">
        <input type="range" data-frame="${e(spec.id)}" data-scale min="${min}" max="${max}" step="1"
          value="${Math.round(l.scale * 100)}" ${scalable ? '' : 'disabled'} aria-label="${e(spec.label)} scale">
        <output data-scale-value>${Math.round(l.scale * 100)}%</output>
      </label>
    </div>`;
  }

  private render(): void {
    const frames = uiFrames();
    const groups = GROUP_ORDER
      .map(name => ({ name, frames: frames.filter(f => (f.group ?? 'Panels') === name) }))
      .filter(g => g.frames.length);
    this.element.innerHTML = `<section class="ui-window ui-layout-window" role="dialog" aria-modal="false" aria-labelledby="ui-layout-title">
      <header class="ui-window-header"><h2 class="ui-title" id="ui-layout-title">Edit Layout</h2>
        <button type="button" class="ui-button ui-button--icon" data-done aria-label="Done editing layout">×</button></header>
      <p class="ui-layout-hint">Drag any open window by its header; resize from the corner grip. Open a panel first to move it.</p>
      <div class="ui-layout-list ui-scroll-area">${groups.map(g =>
        `<div class="ui-layout-group" role="heading" aria-level="3">${e(g.name)}</div>${g.frames.map(f => this.row(f)).join('')}`).join('')}</div>
      <footer class="ui-window-footer ui-layout-footer">
        <button type="button" class="ui-button ui-button--quiet" data-reset-all>Reset all</button>
        <button type="button" class="ui-button ui-button--primary" data-done>Done</button>
      </footer></section>`;
  }

  /** Push store state into existing controls without rebuilding the DOM —
   * re-rendering mid-input would break slider drags and steal focus. */
  private syncRow(spec: UiFrameSpec): void {
    const row = this.element.querySelector<HTMLElement>(`[data-row="${CSS.escape(spec.id)}"]`);
    if (!row) return;
    const l = uiLayout(spec.id);
    const lock = row.querySelector<HTMLButtonElement>('[data-lock]');
    if (lock) {
      lock.setAttribute('aria-pressed', String(l.locked));
      lock.textContent = l.locked ? 'Locked' : 'Lock';
      lock.setAttribute('aria-label', `${l.locked ? 'Unlock' : 'Lock'} ${spec.label}`);
      lock.title = l.locked ? 'Unlock: allow dragging' : 'Lock: prevent dragging';
    }
    const hide = row.querySelector<HTMLButtonElement>('[data-hide]');
    if (hide) {
      hide.setAttribute('aria-pressed', String(!l.visible));
      hide.textContent = l.visible ? 'Hide' : 'Hidden';
      hide.setAttribute('aria-label', `${l.visible ? 'Hide' : 'Show'} ${spec.label}`);
      hide.title = l.visible ? 'Hide this frame' : 'Show this frame';
    }
    const scale = row.querySelector<HTMLInputElement>('[data-scale]');
    const pct = Math.round(l.scale * 100);
    if (scale && document.activeElement !== scale) scale.value = String(pct);
    const out = row.querySelector<HTMLOutputElement>('[data-scale-value]');
    if (out) out.value = `${pct}%`;
  }

  private sync(): void {
    if (this.element.hidden) return;
    if (this.element.querySelectorAll('[data-row]').length !== uiFrames().length) { this.render(); return; }
    for (const spec of uiFrames()) this.syncRow(spec);
  }

  dispose(): void {
    this.unsub();
    this.element.hidden = true;
    if (uiEditMode()) setUiEditMode(false);
    this.abort.abort();
    this.element.remove();
  }
}
