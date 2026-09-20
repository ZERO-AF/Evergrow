import type { Input, Player } from './model.ts';
import type { ActionResult, CharacterSheet, SkillId } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { unlockedSkills } from './skill-tree.ts';
import { auraReservation } from './aura-content.ts';
import { isMountId, type MountId } from './mount-content.ts';
import { WOW_CLASSES } from './wow-classes.ts';
import { WOW_RACES } from './wow-races.ts';
import { isConsumableId } from './consumable-content.ts';

/** Action bars (docs/wow-deepening.md §5): a 12-slot paged main bar plus two side
 * bars that mirror the inactive pages. Skill assignments persist on the sheet's
 * `skillSlots` (extended to BAR_TOTAL by the integrator); potion/mount/consumable
 * extras are a device-local preference keyed per character, mirroring control
 * bindings — the frozen save contract has no field for them. */
export const BAR_PAGES = 3;
export const BAR_SLOTS = 12;
export const BAR_TOTAL = BAR_PAGES * BAR_SLOTS;
/** Dedicated non-bar slot carrying the racial active (R key), after the bar slots. */
export const RACIAL_SLOT = BAR_TOTAL;
/** Keyboard order for the 12 slots of the active page: 1-9,0,-,= (WoW default). */
export const BAR_KEY_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6',
  'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'] as const;
export const BAR_KEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='] as const;
/** Shift+Digit1..3 pages the main bar (WoW's Shift+1..3 page keys). */
export const BAR_PAGE_KEY_CODES = ['Digit1', 'Digit2', 'Digit3'] as const;

export type BarAction =
  | { readonly kind: 'skill'; readonly id: SkillId }
  | { readonly kind: 'potion' }
  | { readonly kind: 'mount'; readonly id: MountId }
  | { readonly kind: 'consumable'; readonly id: string };
export type BarExtra = Extract<BarAction, { readonly kind: 'potion' } | { readonly kind: 'mount' } | { readonly kind: 'consumable' }>;
/** What one slot press resolves to; the game routes non-skill activations itself. */
export type BarActivation =
  | { readonly kind: 'skill'; readonly index: number }
  | { readonly kind: 'potion' }
  | { readonly kind: 'mount'; readonly id: MountId }
  | { readonly kind: 'consumable'; readonly id: string };

export type BarCommand =
  | { readonly type: 'assign'; readonly index: number; readonly action: BarAction | null }
  | { readonly type: 'swap'; readonly from: number; readonly to: number }
  | { readonly type: 'clear'; readonly index: number };

export function isBarIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < BAR_TOTAL;
}
export function barIndex(page: number, slot: number): number { return page * BAR_SLOTS + slot; }
export function barPageOf(index: number): number { return Math.floor(index / BAR_SLOTS); }
export function barSlotOf(index: number): number { return index % BAR_SLOTS; }

/** Grow a legacy 5-slot sheet to the full bar; existing assignments keep slots 0-4. */
export function ensureBarSlots(sheet: CharacterSheet): Array<SkillId | null> {
  const slots = sheet.skillSlots;
  if (slots.length >= BAR_TOTAL) return slots;
  return (sheet.skillSlots = [...slots, ...Array<SkillId | null>(BAR_TOTAL - slots.length).fill(null)]);
}

export interface BarStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
const STORAGE_KEY = 'evergrow-actionbars-v1';
const MAX_CHARACTERS = 8;


function decodeExtra(value: unknown): BarExtra | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as { t?: unknown; id?: unknown };
  if (v.t === 'potion') return { kind: 'potion' };
  if (v.t === 'mount' && isMountId(v.id)) return { kind: 'mount', id: v.id };
  if (v.t === 'consumable' && isConsumableId(v.id)) return { kind: 'consumable', id: v.id };
  return null;
}

/** Session bar state: active page, side-bar visibility and non-skill extras.
 * Extras persist per character in device storage; skills live on the sheet. */
export class ActionBars {
  /** Active main-bar page (0..BAR_PAGES-1); side bars mirror the other two. */
  page = 0;
  sideBars = true;
  private extras: Array<BarExtra | null> = Array<BarExtra | null>(BAR_TOTAL).fill(null);
  private characterId: string | null = null;
  private readonly storage?: BarStorage;

  constructor(storage?: BarStorage) {
    this.storage = storage;
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : null;
      if (all && typeof all.sideBars === 'boolean') this.sideBars = all.sideBars;
    } catch { /* Defaults apply when storage is blocked or malformed. */ }
  }

  /** Load the extras placed by this character; call when the session character changes. */
  bind(characterId: string | null): void {
    this.characterId = characterId;
    this.extras = Array<BarExtra | null>(BAR_TOTAL).fill(null);
    if (!this.storage || !characterId) return;
    try {
      const all = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? 'null');
      const saved = all?.characters?.[characterId];
      if (Array.isArray(saved)) this.extras = this.extras.map((_, i) => decodeExtra(saved[i]));
    } catch { /* Session-only extras remain usable. */ }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      const all = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? 'null') ?? {};
      const characters = typeof all.characters === 'object' && all.characters !== null ? all.characters : {};
      if (this.characterId) {
        characters[this.characterId] = this.extras.map(e => e === null ? null : e.kind === 'potion' ? { t: 'potion' } : e.kind === 'consumable' ? { t: 'consumable', id: e.id } : { t: 'mount', id: e.id });
        const ids = Object.keys(characters);
        if (ids.length > MAX_CHARACTERS) for (const id of ids.slice(0, ids.length - MAX_CHARACTERS)) delete characters[id];
      }
      this.storage.setItem(STORAGE_KEY, JSON.stringify({ ...all, sideBars: this.sideBars, characters }));
    } catch { /* Session-only extras remain usable. */ }
  }

  /** Shift+1..3 edge from input; returns false for out-of-range or no-op pages. */
  setPage(page: number): boolean {
    if (!Number.isInteger(page) || page < 0 || page >= BAR_PAGES || page === this.page) return false;
    this.page = page;
    return true;
  }

  setSideBars(visible: boolean): void {
    if (this.sideBars === visible) return;
    this.sideBars = visible;
    this.persist();
  }

  /** Pages shown on the two side bars: every page except the active one, in order. */
  sidePages(): readonly number[] {
    const pages: number[] = [];
    for (let page = 0; page < BAR_PAGES; page++) if (page !== this.page) pages.push(page);
    return pages;
  }

  extra(index: number): BarExtra | null {
    return isBarIndex(index) ? this.extras[index] : null;
  }

  /** Resolved action for an absolute slot index (0..BAR_TOTAL-1), extras included. */
  actionAt(player: Player, index: number): BarAction | null {
    if (!isBarIndex(index)) return null;
    const extra = this.extras[index];
    if (extra) return extra;
    const id = player.character.skillSlots[index];
    return id ? { kind: 'skill', id } : null;
  }

  /** Command-facing extra mutation; dedupes identical extras across the bar. */
  setExtra(index: number, extra: BarExtra | null, dedupe = true): void {
    if (!isBarIndex(index)) return;
    if (extra && dedupe) {
      for (const [i, e] of this.extras.entries()) {
        if (i !== index && e && e.kind === extra.kind
          && (e.kind === 'potion' || 'id' in e && 'id' in extra && e.id === extra.id)) this.extras[i] = null;
      }
    }
    this.extras[index] = extra;
    this.persist();
  }
}

function assignBarAction(player: Player, bars: ActionBars, index: number, action: BarAction | null): ActionResult {
  if (!isBarIndex(index)) return { ok: false, message: 'Choose one of the action bar slots.' };
  if (action === null) {
    ensureBarSlots(player.character)[index] = null;
    bars.setExtra(index, null, false);
    return { ok: true };
  }
  if (action.kind === 'skill') {
    const definition = SKILL_DEFINITIONS[action.id];
    if (!definition) return { ok: false, message: 'Unknown skill.' };
    if (definition.classId && definition.classId !== player.character.classId)
      return { ok: false, message: `${definition.name} is a ${WOW_CLASSES[definition.classId].name} skill.` };
    if (definition.raceId && definition.raceId !== player.character.raceId)
      return { ok: false, message: `${definition.name} is a ${WOW_RACES[definition.raceId].name} racial.` };
    if (!unlockedSkills(player.character.allocatedNodes).includes(action.id))
      return { ok: false, message: 'Unlock this skill in the tree first.' };
    const slots = ensureBarSlots(player.character).map(id => id === action.id ? null : id);
    slots[index] = action.id;
    if (auraReservation({ ...player.character, skillSlots: slots }) >= 100)
      return { ok: false, message: 'Not enough unreserved mana. Remove another aura first.' };
    player.character.skillSlots = slots;
    bars.setExtra(index, null, false);
    return { ok: true };
  }
  if (action.kind === 'mount' && !isMountId(action.id)) return { ok: false, message: 'Unknown mount.' };
  if (action.kind === 'consumable' && !isConsumableId(action.id)) return { ok: false, message: 'Unknown consumable.' };
  ensureBarSlots(player.character)[index] = null;
  bars.setExtra(index, action);
  return { ok: true };
}

/** The bar mutation boundary: every assignment, swap and clear validates first.
 * Sheet changes persist through the normal character save; extras persist locally. */
export function executeBarCommand(player: Player, bars: ActionBars, command: BarCommand): ActionResult {
  switch (command.type) {
    case 'assign': return assignBarAction(player, bars, command.index, command.action);
    case 'clear': return assignBarAction(player, bars, command.index, null);
    case 'swap': {
      if (!isBarIndex(command.from) || !isBarIndex(command.to)) return { ok: false, message: 'Choose one of the action bar slots.' };
      if (command.from === command.to) return { ok: true };
      const slots = ensureBarSlots(player.character);
      [slots[command.from], slots[command.to]] = [slots[command.to], slots[command.from]];
      const from = bars.extra(command.from), to = bars.extra(command.to);
      bars.setExtra(command.from, to, false);
      bars.setExtra(command.to, from, false);
      return { ok: true };
    }
  }
}

/** Click or programmatic activation of one absolute slot; the game routes the result. */
export function activateBarSlot(player: Player, bars: ActionBars, index: number): BarActivation | null {
  const action = bars.actionAt(player, index);
  if (!action) return null;
  if (action.kind === 'skill') return { kind: 'skill', index };
  return action.kind === 'potion' ? { kind: 'potion' } : action.kind === 'mount' ? { kind: 'mount', id: action.id } : { kind: 'consumable', id: action.id };
}

/** Translate a consumed Input against the bars. Potion slots fold into `heal`
 * (the sim's heal buffer still gates charges/cooldown); mount slots surface for
 * the game's mount toggle; empty and non-skill slots never reach the sim's
 * skill buffer. Non-bar indices (RACIAL_SLOT) pass through untouched. */
export function applyBarInput(player: Player, bars: ActionBars, input: Input): { input: Input; mounts: MountId[]; consumables: string[] } {
  const mounts: MountId[] = [], consumables: string[] = [];
  let skillSlot = input.skillSlot, heal = input.heal;
  if (skillSlot !== null && isBarIndex(skillSlot)) {
    const action = bars.actionAt(player, skillSlot);
    if (action?.kind === 'potion') { heal = true; skillSlot = null; }
    else if (action?.kind === 'mount') { mounts.push(action.id); skillSlot = null; }
    else if (action?.kind === 'consumable') { consumables.push(action.id); skillSlot = null; }
    else if (!action) skillSlot = null;
  }
  const held = input.heldSkillSlots?.filter(i => !isBarIndex(i) || bars.actionAt(player, i)?.kind === 'skill');
  return {
    input: { ...input, heal, skillSlot, ...(input.heldSkillSlots ? { heldSkillSlots: held ?? [] } : {}) },
    mounts, consumables,
  };
}

import { getHUDLayout } from './hud-layout.ts';

const MAIN = Object.freeze({ slot: 34, gap: 4 });
const SIDE = Object.freeze({ slot: 26, gap: 3 });

export interface BarStrip { x: number; y: number; slot: number; gap: number; page: number; }
export interface ActionBarLayout { main: BarStrip; sides: BarStrip[]; }

export function actionBarLayout(bars: ActionBars, width: number, height: number): ActionBarLayout {
  const hud = getHUDLayout(width, height);
  const mainWidth = BAR_SLOTS * MAIN.slot + (BAR_SLOTS - 1) * MAIN.gap;
  const main: BarStrip = {
    x: (width - mainWidth) / 2,
    // Clears the cast bar (hud.y - 20) with a small gap; falls back off-HUD on tiny screens.
    y: hud.scale > 0 ? hud.y - MAIN.slot - 26 : height - MAIN.slot - 8,
    slot: MAIN.slot, gap: MAIN.gap, page: bars.page,
  };
  const sideHeight = BAR_SLOTS * SIDE.slot + (BAR_SLOTS - 1) * SIDE.gap;
  const sidePages = bars.sideBars ? bars.sidePages() : [];
  const sides = sidePages.map((page, i): BarStrip => ({
    // Rightmost column shows the higher page, matching WoW's stacked right bars.
    x: width - (sidePages.length - i) * (SIDE.slot + SIDE.gap) - 4,
    y: Math.max(8, (height - sideHeight) / 2),
    slot: SIDE.slot, gap: SIDE.gap, page,
  }));
  return { main, sides };
}

