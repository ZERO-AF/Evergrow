import type { Player } from './model.ts';
import type { Item, SkillId } from './character-types.ts';
import { SKILL_DEFINITIONS, canUseSkill, skillRequirementLabel } from './skill-content.ts';
import { resolveSkill } from './skill-progression.ts';
import { unlockedSkills } from './skill-tree.ts';
import { skillIconSVG } from './skill-icon.ts';
import { MOUNT_IDS, MOUNTS, isMountId, type MountId } from './mount-content.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { BAR_KEY_LABELS, BAR_PAGES, BAR_SLOTS, barIndex, barPageOf, type ActionBars, type BarAction, type BarCommand } from './action-bar.ts';
import { ownedConsumables, createConsumableItem, isConsumableId, CONSUMABLE_CATEGORY_LABELS } from './consumable-content.ts';
import { itemIconSVG } from './item-art.ts';

/** Stable icon items for consumable bar art; one allocation per definition. */
const consumableIcons = new Map<string, Item>();
function consumableIconItem(id: string): Item {
  let item = consumableIcons.get(id);
  if (!item) { item = createConsumableItem(id, 0); consumableIcons.set(id, item); }
  return item;
}

/** Action bar assignment dialog (docs/wow-deepening.md §5): all three pages of
 * slots beside the draggable sources — unlocked skills, the shared potion and
 * mounts. Drag onto a slot, or click to pick up then click a slot; dragging a
 * slot off the bar clears it, right-click clears, slot-to-slot swaps. Every
 * mutation routes through `hooks.command` → `executeBarCommand`. */

interface ActionBarHooks {
  command(command: BarCommand): void;
  close(): void;
}

type Picked = { action: BarAction; from: number | null };

const STYLE_ID = 'action-bar-panel-style';
const CSS = `
.action-bar-panel { position:fixed; inset:0; z-index:95; display:grid; place-items:center; padding:clamp(10px,3vw,32px); background:#03090dbc; }
.action-bar-panel[hidden] { display:none; }
.action-bar-window { width:min(880px,100%); max-height:100%; display:flex; flex-direction:column; }
.action-bar-columns { display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:18px; padding:14px 18px 18px; min-height:0; }
.action-bar-pages h3, .action-bar-sources h3 { margin:10px 0 6px; font-size:.82rem; letter-spacing:.08em; text-transform:uppercase; color:var(--ui-muted,#8ba0a8); }
.action-bar-pages h3:first-child, .action-bar-sources h3:first-child { margin-top:0; }
.action-bar-grid { display:grid; grid-template-columns:repeat(12,38px); gap:5px; }
.action-bar-slot { position:relative; width:38px; height:38px; padding:0; border:1px solid #41576a; background:linear-gradient(#1b2830,#0a141c); color:#d8e4ea; cursor:pointer; }
.action-bar-slot.is-filled { border-color:#6a8090; }
.action-bar-slot.is-picked { outline:2px solid #c4ad7a; }
.action-bar-slot.is-target { outline:2px solid #7fb8e8; }
.action-bar-slot .action-bar-key { position:absolute; right:2px; bottom:1px; font-size:.62rem; color:#9db2ba; }
.action-bar-slot svg { display:block; margin:auto; }
.action-bar-source { display:flex; align-items:center; gap:8px; width:100%; padding:4px 6px; border:1px solid transparent; background:none; color:inherit; text-align:left; cursor:pointer; }
.action-bar-source:hover, .action-bar-source.is-picked { border-color:#4a6573; background:#14222b; }
.action-bar-source small { display:block; color:var(--ui-muted,#8ba0a8); }
.action-bar-source .action-bar-source-icon { width:26px; height:26px; flex:none; display:grid; place-items:center; }
.action-bar-source .action-bar-source-icon svg { display:block; }

.action-bar-ghost { position:fixed; z-index:200; width:38px; height:38px; pointer-events:none; opacity:.85; transform:translate(-50%,-50%); }
.action-bar-side-toggle { display:flex; align-items:center; gap:6px; margin-left:auto; margin-right:10px; font-size:.82rem; color:var(--ui-muted,#8ba0a8); cursor:pointer; }
`;

function mountIconSVG(id: MountId, size: number): string {
  const def = MOUNTS[id];
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke-linecap="round" aria-hidden="true"><path d="M6.5 20a8.5 8.5 0 1 1 11 0" stroke="${def.tint}" stroke-width="3.4"/><path d="M4.5 16.5 2.6 19.4M12 3.2V.8M19.5 16.5l1.9 2.9" stroke="${def.accent}" stroke-width="1.8"/></svg>`;
}

function actionIcon(action: BarAction, size: number): string {
  if (action.kind === 'skill') return skillIconSVG(action.id, size);
  if (action.kind === 'potion') return uiIcon('potion');
  if (action.kind === 'consumable') return itemIconSVG(consumableIconItem(action.id), size);
  return mountIconSVG(action.id, size);
}

function actionName(action: BarAction): string {
  if (action.kind === 'skill') return SKILL_DEFINITIONS[action.id]?.name ?? String(action.id);
  if (action.kind === 'potion') return 'Potion';
  if (action.kind === 'consumable') return consumableIconItem(action.id).name;
  return MOUNTS[action.id].name;
}

export class ActionBarPanel {
  readonly element: HTMLElement;
  private readonly abort = new AbortController();
  private focus: ReturnType<typeof trapDialogFocus> | null = null;
  private player: Player | null = null;
  private bars: ActionBars | null = null;
  private picked: Picked | null = null;
  private dragMoved = false;
  private ghost: HTMLElement | null = null;
  private pickX = 0;
  private pickY = 0;
  private readonly hooks: ActionBarHooks;

  constructor(mount: HTMLElement, hooks: ActionBarHooks) {
    this.hooks = hooks;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID; style.textContent = CSS;
      document.head.append(style);
    }
    this.element = document.createElement('section');
    this.element.className = 'action-bar-panel';
    this.element.hidden = true;
    mount.append(this.element);
    const signal = this.abort.signal;
    this.element.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLElement>('button');
      if (!button) return;
      if (button.hasAttribute('data-close')) { this.hooks.close(); return; }
      const slot = button.closest<HTMLElement>('[data-index]');
      if (slot && this.picked) {
        const index = Number(slot.dataset.index);
        this.dropOn(index);
      }
    }, { signal });
    this.element.addEventListener('contextmenu', event => {
      const slot = (event.target as Element).closest<HTMLElement>('[data-index]');
      if (!slot) return;
      event.preventDefault();
      this.cancelPick();
      this.hooks.command({ type: 'clear', index: Number(slot.dataset.index) });
      this.render();
    }, { signal });
    this.element.addEventListener('change', event => {
      const toggle = (event.target as Element).closest<HTMLInputElement>('[data-side-bars]');
      if (toggle && this.bars) { this.bars.setSideBars(toggle.checked); this.render(); }
    }, { signal });
    this.element.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (this.picked) this.cancelPick();
      else this.hooks.close();
    }, { signal });
    this.element.addEventListener('pointerdown', event => this.onPointerDown(event), { signal });
    window.addEventListener('pointermove', event => this.onPointerMove(event), { signal });
    window.addEventListener('pointerup', event => this.onPointerUp(event), { signal });
    window.addEventListener('pointercancel', () => this.cancelPick(), { signal });
  }

  get isOpen(): boolean { return !this.element.hidden; }

  open(player: Player, bars: ActionBars): void {
    this.player = player; this.bars = bars;
    this.element.hidden = false;
    this.render();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal });
  }

  refresh(player: Player): void {
    this.player = player;
    if (this.isOpen) this.render();
  }

  close(): void {
    this.cancelPick();
    this.focus?.dispose(); this.focus = null;
    this.element.hidden = true;
  }

  dispose(): void {
    this.close();
    this.abort.abort();
    this.element.remove();
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const target = event.target as Element;
    const source = target.closest<HTMLElement>('[data-source-kind]');
    if (source) {
      const action = this.sourceAction(source);
      if (action) { this.pick({ action, from: null }, event); event.preventDefault(); }
      return;
    }
    const slot = target.closest<HTMLElement>('[data-index]');
    if (slot && this.player && this.bars) {
      const index = Number(slot.dataset.index);
      if (this.picked) return; // Click path handles the drop.
      const action = this.bars.actionAt(this.player, index);
      if (action) { this.pick({ action, from: index }, event); event.preventDefault(); }
    }
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.picked || !this.ghost) return;
    if (event.buttons & 1 && Math.hypot(event.clientX - this.pickX, event.clientY - this.pickY) > 6) this.dragMoved = true;
    this.ghost.style.left = `${event.clientX}px`;
    this.ghost.style.top = `${event.clientY}px`;
    const slot = this.slotAt(event.clientX, event.clientY);
    this.element.querySelectorAll('.action-bar-slot.is-target').forEach(el => el.classList.remove('is-target'));
    slot?.classList.add('is-target');
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.picked) return;
    const picked = this.picked;
    const slot = this.slotAt(event.clientX, event.clientY);
    if (!this.dragMoved) return; // Click, not a drag: keep the pick for the click handler.
    if (slot) this.dropOn(Number(slot.dataset.index));
    else if (picked.from !== null) { this.cancelPick(); this.hooks.command({ type: 'clear', index: picked.from }); this.render(); }
    else this.cancelPick();
  }

  private slotAt(x: number, y: number): HTMLElement | null {
    const el = document.elementFromPoint(x, y);
    const slot = el?.closest<HTMLElement>('.action-bar-slot[data-index]') ?? null;
    return slot && this.element.contains(slot) ? slot : null;
  }

  private sourceAction(source: HTMLElement): BarAction | null {
    const kind = source.dataset.sourceKind, id = source.dataset.sourceId;
    if (kind === 'potion') return { kind: 'potion' };
    if (kind === 'mount' && isMountId(id)) return { kind: 'mount', id };
    if (kind === 'consumable' && id && isConsumableId(id)) return { kind: 'consumable', id };
    if (kind === 'skill' && id && SKILL_DEFINITIONS[id as SkillId]) return { kind: 'skill', id: id as SkillId };
    return null;
  }

  private pick(picked: Picked, event: PointerEvent): void {
    this.cancelPick();
    this.picked = picked;
    this.dragMoved = false;
    this.pickX = event.clientX; this.pickY = event.clientY;
    this.ghost = document.createElement('div');
    this.ghost.className = 'action-bar-ghost';
    this.ghost.innerHTML = actionIcon(picked.action, 34);
    this.ghost.style.left = `${event.clientX}px`;
    this.ghost.style.top = `${event.clientY}px`;
    document.body.append(this.ghost);
    this.markPicked();
  }

  private cancelPick(): void {
    this.picked = null;
    this.ghost?.remove(); this.ghost = null;
    this.element.querySelectorAll('.is-picked, .is-target').forEach(el => el.classList.remove('is-picked', 'is-target'));
  }

  private markPicked(): void {
    if (!this.picked) return;
    const selector = this.picked.from !== null
      ? `.action-bar-slot[data-index="${this.picked.from}"]`
      : `[data-source-kind="${this.picked.action.kind}"]${'id' in this.picked.action ? `[data-source-id="${this.picked.action.id}"]` : ''}`;
    this.element.querySelector(selector)?.classList.add('is-picked');
  }

  private dropOn(index: number): void {
    const picked = this.picked;
    if (!picked || !Number.isInteger(index)) return;
    this.cancelPick();
    if (picked.from === null) this.hooks.command({ type: 'assign', index, action: picked.action });
    else if (picked.from !== index) this.hooks.command({ type: 'swap', from: picked.from, to: index });
    this.render();
  }

  private slotMarkup(index: number): string {
    const action = this.player && this.bars ? this.bars.actionAt(this.player, index) : null;
    const key = BAR_KEY_LABELS[index % BAR_SLOTS];
    const label = action ? `${actionName(action)} — page ${barPageOf(index) + 1} slot ${key}` : `Empty slot — page ${barPageOf(index) + 1} slot ${key}`;
    return `<button type="button" class="action-bar-slot ${action ? 'is-filled' : ''}" data-index="${index}"
      aria-label="${escapeUI(label)}. Drag to move, right-click to clear." title="${escapeUI(label)}">${action ? actionIcon(action, 30) : ''}<span class="action-bar-key">${key}</span></button>`;
  }

  private sourceMarkup(): string {
    const player = this.player;
    if (!player) return '';
    const skills = unlockedSkills(player.character.allocatedNodes).map(id => SKILL_DEFINITIONS[id])
      .sort((a, b) => Number(canUseSkill(b.id, player.equipment)) - Number(canUseSkill(a.id, player.equipment)) || a.name.localeCompare(b.name));
    const skillRows = skills.length ? skills.map(skill => {
      const resolved = resolveSkill(skill.id, player.derived, player.character);
      const compatible = canUseSkill(skill.id, player.equipment);
      const detail = `${resolved.reservation ? `${resolved.reservation}% reserved` : `${resolved.mana} mana`}${compatible ? '' : ` · Requires ${skillRequirementLabel(skill.requirement)}`}`;
      return `<button type="button" class="action-bar-source" data-source-kind="skill" data-source-id="${skill.id}" title="${escapeUI(detail)}">
        <span class="action-bar-source-icon">${skillIconSVG(skill.id, 24)}</span><span><strong>${escapeUI(resolved.variant?.name ?? skill.name)}</strong><small>${escapeUI(detail)}</small></span></button>`;
    }).join('') : '<p class="action-bar-hint">No unlocked skills yet. Learn one in the skill atlas.</p>';
    const consumables = `<button type="button" class="action-bar-source" data-source-kind="potion" title="Shared flask — restores life and mana">
      <span class="action-bar-source-icon">${uiIcon('potion')}</span><span><strong>Potion</strong><small>Shared flask · restores life and mana</small></span></button>`
      + ownedConsumables(player.character).map(({ def, count }) => `<button type="button" class="action-bar-source" data-source-kind="consumable" data-source-id="${def.id}" title="${escapeUI(def.useText)}">
      <span class="action-bar-source-icon">${itemIconSVG(consumableIconItem(def.id), 24)}</span><span><strong>${escapeUI(def.name)}</strong><small>${escapeUI(CONSUMABLE_CATEGORY_LABELS[def.buffCategory])} · ${count} in pack</small></span></button>`).join('');
    const mounts = MOUNT_IDS.map(id => `<button type="button" class="action-bar-source" data-source-kind="mount" data-source-id="${id}" title="${escapeUI(MOUNTS[id].name)} — summon or dismiss">
      <span class="action-bar-source-icon">${mountIconSVG(id, 24)}</span><span><strong>${escapeUI(MOUNTS[id].name)}</strong><small>Mount · summon or dismiss</small></span></button>`).join('');
    return `<h3>Skills</h3>${skillRows}<h3>Consumables</h3>${consumables}<h3>Mounts</h3>${mounts}`;
  }

  private render(): void {
    if (!this.player || !this.bars) return;
    const focused = (document.activeElement as HTMLElement | null)?.dataset?.index;
    const pages = Array.from({ length: BAR_PAGES }, (_, page) =>
      `<h3>Page ${page + 1}${page === 0 ? ' · keys 1–=' : ''}</h3><div class="action-bar-grid" data-page="${page}">${Array.from({ length: BAR_SLOTS }, (_, i) => this.slotMarkup(barIndex(page, i))).join('')}</div>`).join('');
    this.element.innerHTML = `<section class="ui-window action-bar-window" role="dialog" aria-modal="true" aria-labelledby="action-bar-title">
      <header class="ui-window-header"><h2 class="ui-title" id="action-bar-title">Action Bars</h2>
        <label class="action-bar-side-toggle"><input type="checkbox" data-side-bars ${this.bars.sideBars ? 'checked' : ''}> Side bars</label>
        <button type="button" class="ui-button ui-button--icon" data-close aria-label="Close action bars">×</button></header>
      <div class="action-bar-columns"><div class="action-bar-pages ui-scroll-area">${pages}</div>
      <div class="action-bar-sources ui-scroll-area">${this.sourceMarkup()}<p class="action-bar-hint">Drag onto a slot, or click to pick up then click a slot. Drag a slot off the bar or right-click it to clear. Shift+1–3 pages the main bar in game.</p></div></div></section>`;
    this.markPicked();
    if (focused !== undefined) this.element.querySelector<HTMLElement>(`[data-index="${focused}"]`)?.focus({ preventScroll: true });
  }
}
