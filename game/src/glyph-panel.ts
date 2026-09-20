import { GLYPH_SLOTS, GLYPH_SLOT_LEVEL, glyphDefinition, glyphItemId, glyphSlotKind, type GlyphSlot } from './glyph-content.ts';
import { attachPanelFrame } from './panel-frames.ts';
import { glyphSocketProblem } from './glyph-state.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import type { ActionResult } from './character-types.ts';
import type { Player } from './model.ts';

const esc = escapeUI;
interface FocusTrap { dispose(): void }
interface GlyphHooks {
  /** Durable commands; the panel shows the returned message. */
  socket(inventoryIndex: number): Promise<ActionResult> | void;
  unsocket(slot: GlyphSlot): Promise<ActionResult> | void;
  close(): void;
}

/** Read-only projection of player.glyphs + bag glyph items. No state ownership. */
export class GlyphPanel {
  readonly element: HTMLElement;
  private abort = new AbortController();
  private focus: FocusTrap | null = null;
  private player: Player | null = null;
  private notice = '';
  private signature = '';
  private hooks: GlyphHooks;
  constructor(mount: HTMLElement, hooks: GlyphHooks) {
    this.hooks = hooks;
    this.element = document.createElement('section');
    this.element.className = 'glyph-panel';
    this.element.hidden = true;
    mount.append(this.element);
    attachPanelFrame(this.element, 'glyphs');
    this.element.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || !this.player) return;
      if (b.dataset.close !== undefined) this.close();
      else if (b.dataset.socket !== undefined) void this.run(this.hooks.socket(Number(b.dataset.socket)));
      else if (b.dataset.unsocket !== undefined) void this.run(this.hooks.unsocket(b.dataset.unsocket as GlyphSlot));
    }, { signal: this.abort.signal });
  }
  get opened() { return !this.element.hidden; }
  private async run(result: Promise<ActionResult> | void) {
    const resolved = await result;
    if (resolved?.message) this.notice = resolved.message;
    this.render();
  }
  /** Refresh the projection; call whenever the player or inventory may have changed. */
  update(player: Player) {
    this.player = player;
    if (this.element.hidden) return;
    const signature = JSON.stringify([player.level, player.glyphs, player.character.inventory.map(i => i?.id)]);
    if (signature !== this.signature) { this.signature = signature; this.render(); }
  }
  open() {
    this.element.hidden = false;
    this.notice = '';
    this.signature = '';
    this.render();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal });
  }
  close() {
    if (this.element.hidden) return;
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
    this.hooks.close();
  }
  private slotRow(slot: GlyphSlot): string {
    const p = this.player!, unlock = GLYPH_SLOT_LEVEL[slot], id = p.glyphs?.[slot], def = id ? glyphDefinition(id) : undefined;
    const kind = glyphSlotKind(slot);
    const label = `${kind === 'major' ? 'Major' : 'Minor'} ${slot.slice(-1)}`;
    if (p.level < unlock)
      return `<div class="ui-well glyph-slot is-locked"><span class="ui-badge">${label}</span><span class="glyph-slot-name">Locked</span><small>Unlocks at level ${unlock}</small></div>`;
    if (!def)
      return `<div class="ui-well glyph-slot"><span class="ui-badge">${label}</span><span class="glyph-slot-name">Empty</span><small>Inscribe a ${kind} glyph</small></div>`;
    return `<div class="ui-well glyph-slot is-filled"><span class="ui-badge">${label}</span><span class="glyph-slot-name">${esc(def.name)}</span><small>${esc(def.description)}</small><button class="ui-button" data-unsocket="${slot}">Remove</button></div>`;
  }
  private render() {
    const p = this.player;
    if (!p || this.element.hidden) return;
    this.signature = JSON.stringify([p.level, p.glyphs, p.character.inventory.map(i => i?.id)]);
    const bagGlyphs = p.character.inventory.flatMap((item, index) => {
      const id = glyphItemId(item), def = id ? glyphDefinition(id) : undefined;
      return item && def ? [{ index, def, problem: glyphSocketProblem(p, def) }] : [];
    });
    const majors = GLYPH_SLOTS.filter(s => glyphSlotKind(s) === 'major').map(s => this.slotRow(s)).join('');
    const minors = GLYPH_SLOTS.filter(s => glyphSlotKind(s) === 'minor').map(s => this.slotRow(s)).join('');
    this.element.innerHTML = `<section class="ui-window glyph-window" role="dialog" aria-modal="true" aria-labelledby="glyph-title">
<header class="ui-window-header"><span class="journey-heading-icon">${uiIcon('diamond')}</span><h2 class="ui-title" id="glyph-title">Glyphs</h2><button class="ui-button ui-button--icon" data-close aria-label="Close glyphs">×</button></header>
<div class="ui-scroll-area glyph-content">
${this.notice ? `<p class="glyph-notice" role="status">${esc(this.notice)}</p>` : ''}
<h3>Major glyphs</h3>${majors}
<h3>Minor glyphs</h3>${minors}
<h3>Bag</h3>
${bagGlyphs.length ? bagGlyphs.map(({ index, def, problem }) =>
  `<div class="ui-well glyph-bag-row"><span class="glyph-slot-name">${esc(def.name)}</span><small>${esc(def.description)}</small><button class="ui-button ui-button--primary" data-socket="${index}" ${problem ? `disabled data-tooltip="${esc(problem)}"` : ''}>Inscribe</button></div>`).join('')
  : '<p><small>No glyph items in your bag. Glyphs drop from enemies and are sold by enchanters.</small></p>'}
</div></section>`;
  }
  dispose() { this.close(); this.abort.abort(); this.element.remove(); }
}

/** Panel toggle for the integrator's input/panel wiring (no dedicated keybind exists). */
export function glyphPanelToggle(panel: GlyphPanel): void {
  if (panel.opened) panel.close(); else panel.open();
}
