import type { ActionResult, CharacterSheet, Item } from './character-types.ts';
import { GAME_FEATURES } from './game-features.ts';
import { spendGold } from './wallet.ts';
import { itemPrice } from './commerce.ts';
import type { TownNPC } from './npcs.ts';
import {
  BAG_ITEMS, BAG_SLOT_COUNT, bagDefinition, bagGridLayout, bagPackOccupancy,
  createBagItem, findBagSpace, isBagItem, resolveBagPackLayout, type BagDefinition, type BagGridLayout,
} from './bag-content.ts';

/**
 * Equipped-bag state on `character.bags` (up to BAG_SLOT_COUNT slots).
 * Mutations follow the inventory.ts plan/commit convention: validate fully,
 * then write. All capacity math flows through bagGridLayout so the module
 * works before and after the integrator widens inventory-grid.ts.
 */
/** The integrator adds `bags: true` to GAME_FEATURES; absent means enabled. */
export const bagsEnabled = (): boolean => !('bags' in GAME_FEATURES) || GAME_FEATURES.bags !== false;
const success = (): ActionResult => ({ ok: true });
const fail = (message: string): ActionResult => ({ ok: false, message });



/** Normalized four-slot view of the equipped bags (never mutates the sheet). */
export function bagSlotsArray(sheet: Pick<CharacterSheet, 'bags'>): Array<Item | null> {
  const slots = Array<Item | null>(BAG_SLOT_COUNT).fill(null);
  (sheet.bags ?? []).slice(0, BAG_SLOT_COUNT).forEach((item, index) => { if (isBagItem(item)) slots[index] = item; });
  return slots;
}
export const bagSlotItem = (sheet: Pick<CharacterSheet, 'bags'>, slot: number): Item | null =>
  Number.isInteger(slot) && slot >= 0 && slot < BAG_SLOT_COUNT ? bagSlotsArray(sheet)[slot] : null;

/** Save-validation helper for character-save.ts: array of ≤4 real bag items, unique ids. */
export function validBagSlots(v: unknown): v is Array<Item | null> {
  if (v === undefined) return true;
  if (!Array.isArray(v) || v.length > BAG_SLOT_COUNT) return false;
  const ids = new Set<string>();
  return v.every(item => item === null || isBagItem(item) && !ids.has(item.id) && (ids.add(item.id), true));
}

type BagSheet = Pick<CharacterSheet, 'inventory' | 'inventoryLayout' | 'bags'>;

/**
 * Try to place every inventory item under `grid`. Returns the resolved layout,
 * or null when at least one item would be left in overflow — the WoW rule that
 * a bag can only come off when its contents fit elsewhere.
 */
function packedOrNull(sheet: BagSheet, inventory: readonly (Item | null)[], grid: BagGridLayout): Record<string, number> | null {
  const layout = resolveBagPackLayout({ inventory, inventoryLayout: sheet.inventoryLayout, bags: sheet.bags }, grid);
  return inventory.every(item => !item || layout[item.id] !== undefined) ? layout : null;
}

/**
 * Equip a bag item from the pack into a dedicated bag slot. `slot` targets a
 * specific slot (swap allowed); omitted picks the first empty slot. Equipping
 * only grows capacity, so it fails only on a downsize swap that strands items.
 */
export function equipBag(sheet: CharacterSheet, inventoryIndex: number, level = Infinity, slot?: number): ActionResult {
  if (!bagsEnabled()) return fail('Bags are not available.');
  if (!Number.isInteger(inventoryIndex) || inventoryIndex < 0 || inventoryIndex >= sheet.inventory.length) return fail('Choose an item in your pack.');
  const item = sheet.inventory[inventoryIndex];
  if (!item) return fail('That inventory cell is empty.');
  if (!isBagItem(item)) return fail('That item is not a bag.');
  if (level < item.requiredLevel) return fail(`Requires level ${item.requiredLevel}.`);
  const slots = bagSlotsArray(sheet);
  const target = slot !== undefined ? slot : slots.findIndex(entry => entry === null);
  if (slot === undefined && target < 0) return fail('All four bag slots are occupied.');
  if (!Number.isInteger(target) || target < 0 || target >= BAG_SLOT_COUNT) return fail('That bag slot does not exist.');
  const displaced = slots[target];
  const bags = slots.slice();
  bags[target] = item;
  const inventory = sheet.inventory.slice();
  inventory[inventoryIndex] = displaced;
  const grid = bagGridLayout({ bags });
  const layout = packedOrNull({ inventory, inventoryLayout: sheet.inventoryLayout, bags }, inventory, grid);
  if (!layout) return fail(`Removing ${displaced!.name} leaves no room for its contents. Free up pack space first.`);
  while (inventory.length < grid.totalCells) inventory.push(null);
  sheet.bags = bags;
  sheet.inventory = inventory;
  sheet.inventoryLayout = layout;
  return success();
}

/** Unequip a bag slot back into the pack; fails when its cells still hold items that fit nowhere else. */
export function unequipBag(sheet: CharacterSheet, slot: number): ActionResult {
  if (!bagsEnabled()) return fail('Bags are not available.');
  if (!Number.isInteger(slot) || slot < 0 || slot >= BAG_SLOT_COUNT) return fail('That bag slot does not exist.');
  const slots = bagSlotsArray(sheet), item = slots[slot];
  if (!item) return fail('That bag slot is empty.');
  const bags = slots.slice();
  bags[slot] = null;
  const grid = bagGridLayout({ bags });
  const inventory = sheet.inventory.slice();
  let index = inventory.findIndex(entry => entry === null);
  if (index < 0) {
    if (inventory.length >= grid.totalCells) return fail('Make room in your pack for this bag.');
    index = inventory.length;
    inventory.push(null);
  }
  inventory[index] = item;
  const layout = packedOrNull({ inventory, inventoryLayout: sheet.inventoryLayout, bags }, inventory, grid);
  if (!layout) return fail('That bag is not empty. Free up pack space first.');
  while (inventory.length > grid.totalCells && inventory[inventory.length - 1] === null) inventory.pop();
  sheet.bags = bags;
  sheet.inventory = inventory;
  sheet.inventoryLayout = layout;
  return success();
}

/** Non-committing probe for UI affordances (grey out the unequip drag target). */
export function bagUnequipProblem(sheet: CharacterSheet, slot: number): string | null {
  const probe: CharacterSheet = { ...sheet, inventory: sheet.inventory.slice(), bags: (sheet.bags ?? []).slice() };
  const result = unequipBag(probe, slot);
  return result.ok ? null : result.message ?? 'That bag cannot be removed.';
}

// ── Vendor stock ────────────────────────────────────────────────────────────

/** Jewelers double as the general-goods vendor (WotLK bag merchant role). */
export const BAG_VENDOR_ROLE: TownNPC['role'] = 'jeweler';

/** Bag definitions a vendor sells; empty when the feature is off or the role is wrong. */
export function bagVendorStock(npc: Pick<TownNPC, 'role'>): readonly BagDefinition[] {
  return bagsEnabled() && npc.role === BAG_VENDOR_ROLE ? BAG_ITEMS : [];
}
export const bagPrice = (def: BagDefinition): number => itemPrice(createBagItem(def.id, 0), 'buy');

/**
 * Buy a bag into the pack. Mirrors executeGlyphBuy's checkpoint flow: the
 * caller passes the sheet from a captured checkpoint and persists on success.
 * The item id keeps its `bag:` prefix — never route bags through vendorStock.
 */
export function buyBag(sheet: CharacterSheet, npc: Pick<TownNPC, 'role'>, bagId: string): ActionResult & { item?: Item } {
  if (!bagsEnabled()) return fail('Bags are not available.');
  const def = bagDefinition(bagId);
  if (!def || !bagVendorStock(npc).includes(def)) return fail('That bag is not sold here.');
  const item = createBagItem(def.id, ((sheet.commerce.operations + 1) * 0x9e3779b1 + (sheet.gold ?? 0)) >>> 0);
  const grid = bagGridLayout(sheet);
  const layout = resolveBagPackLayout(sheet, grid);
  if (sheet.inventory.some(owned => owned && layout[owned.id] === undefined)) return fail('No room in your bag.');
  const index = sheet.inventory.findIndex(entry => entry === null);
  const target = index >= 0 ? index : sheet.inventory.length < grid.totalCells ? sheet.inventory.length : -1;
  const cell = findBagSpace(item, bagPackOccupancy(sheet.inventory, layout, grid), undefined, 'bag', grid);
  if (target < 0 || cell === null) return fail('No room in your bag.');
  if (!spendGold(sheet, bagPrice(def))) return fail('Not enough gold.');
  while (sheet.inventory.length < grid.totalCells) sheet.inventory.push(null);
  sheet.inventory[target] = item;
  sheet.inventoryLayout = { ...layout, [item.id]: cell };
  sheet.commerce.operations++;
  return { ok: true, item };
}
