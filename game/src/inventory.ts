import { resolvePackLayout, normalizePackLayout, packOccupancy, findPackSpace, footprintCells, packGrid, type PackLayout } from './inventory-grid.ts';
export { addInventoryItem } from './inventory-grid.ts';
import type { ActionResult, Attribute, CharacterSheet, EquipmentSlot, Item } from './character-types.ts';
import type { Player } from './model.ts';
import { EQUIPMENT_SLOTS, RELIC_CLASSES, SHIELD_CLASSES } from './items.ts';
import { WOW_CLASSES, wowClassOf } from './wow-classes.ts';
import type { WowClassId } from './wow-types.ts';
import { isGlyphItem } from './glyph-content.ts';
import { isGemItem } from './gem-content.ts';
import { isBagItem } from './bag-content.ts';
import { equipBag } from './bag-state.ts';
import { useConsumable } from './consumable-command.ts';
import { isConsumableItem } from './consumable-content.ts';

const success = (): ActionResult => ({ ok: true });
const fail = (message: string): ActionResult => ({ ok: false, message });
const validIndex = (sheet: CharacterSheet, index: number) => Number.isInteger(index) && index >= 0 && index < sheet.inventory.length;
/** WoW armor proficiency: cloth < leather < plate; a class wears its own style or lighter. */
const ARMOR_RANK: Readonly<Record<'cloth' | 'leather' | 'plate', number>> = Object.freeze({ cloth: 0, leather: 1, plate: 2 });
const ARMOR_SLOTS: readonly EquipmentSlot[] = ['head', 'chest', 'gloves', 'legs', 'boots'];
export function itemFitsSlot(item: Item, slot: EquipmentSlot, classId?: WowClassId): boolean {
  if (isGlyphItem(item) || isBagItem(item) || isGemItem(item)) return false;
  if (isConsumableItem(item)) return false;
  if (item.kind === 'ring') return slot === 'ring1' || slot === 'ring2';
  if (item.kind === 'relic') return slot === 'offhand' && (classId === undefined || RELIC_CLASSES.includes(classId));
  if (item.kind === 'shield') return slot === 'offhand' && (classId === undefined || SHIELD_CLASSES.includes(classId));
  if (item.kind === 'grimoire' || item.kind === 'orb') return slot === 'offhand';
  if (item.kind === 'weapon') return slot === 'weapon' || slot === 'offhand' && item.weapon?.hands === 1 && (item.weapon.attackKind === 'melee' || item.weapon.family === 'wand');
  if (item.kind !== slot) return false;
  // Armor proficiency: a mage cannot wear plate, a plate class can still wear lighter pieces.
  if (classId !== undefined && ARMOR_SLOTS.includes(slot)) {
    const style = item.appearance?.style;
    if (style && ARMOR_RANK[style] > ARMOR_RANK[WOW_CLASSES[classId].armorStyle]) return false;
  }
  return true;
}

export type EquipmentPlan = { ok: false; message: string } | {
  ok: true; slot: EquipmentSlot; inventory: CharacterSheet['inventory']; equipped: CharacterSheet['equipped'];
  inventoryLayout: PackLayout;
  displaced: Array<{ slot: EquipmentSlot; item: Item }>;
};
export interface EquipmentTarget { sourceIndex?: number; slot?: EquipmentSlot; }

export function defaultEquipmentSlot(sheet: CharacterSheet, item: Item): EquipmentSlot | undefined {
  if (item.kind === 'charm' || item.kind === 'riftKey' || item.kind === 'consumable' || isBagItem(item) || isGemItem(item)) return undefined;
  return (item.kind === 'ring'
    ? !sheet.equipped.ring1 ? 'ring1' : !sheet.equipped.ring2 ? 'ring2' : 'ring1'
    : (item.kind === 'shield' || item.kind === 'grimoire' || item.kind === 'orb' || item.kind === 'relic') ? 'offhand' : item.kind);
}

export function planEquipmentChange(sheet: CharacterSheet, item: Item, level: number, target: EquipmentTarget = {}): EquipmentPlan {
  return resolveEquipmentChange(sheet, item, level, target, false);
}

/** External inspection changes the projected equipment only; it never commits containers. */
export function planEquipmentPreview(sheet: CharacterSheet, item: Item, level: number, target: EquipmentTarget = {}): EquipmentPlan {
  return resolveEquipmentChange(sheet, item, level, target, true);
}

/** Pure swap plan shared by commits, drag eligibility and external-item previews. */
function resolveEquipmentChange(sheet: CharacterSheet, item: Item, level: number, target: EquipmentTarget, previewOnly: boolean): EquipmentPlan {
  const reject = (message: string): EquipmentPlan => ({ ok: false, message });
  const source = target.sourceIndex;
  if (source !== undefined && (!validIndex(sheet, source) || sheet.inventory[source]?.id !== item.id))
    return reject('That inventory item has changed.');
  if (source === undefined && [...sheet.inventory, ...Object.values(sheet.equipped)].some(owned => owned?.id === item.id))
    return reject('This item is already owned.');
  if (item.kind === 'charm') return reject('Place charms in the charm grid.');
  const cls = wowClassOf(sheet);
  if (item.classId && item.classId !== sheet.classId)
    return reject(`Only a ${WOW_CLASSES[item.classId].name} can equip this.`);
  if (item.kind === 'relic' && (!cls || !RELIC_CLASSES.includes(cls.id)))
    return reject(`Only a ${RELIC_CLASSES.map(id => WOW_CLASSES[id].name).join(', ')} can equip this.`);
  const slot = target.slot ?? defaultEquipmentSlot(sheet, item);
  if (!slot || !EQUIPMENT_SLOTS.includes(slot) || !itemFitsSlot(item, slot, sheet.classId)) return reject('This item does not fit that equipment slot.');
  if (!Number.isSafeInteger(level) || !Number.isSafeInteger(item.requiredLevel) || item.requiredLevel < 1 || level < item.requiredLevel)
    return reject(`Requires level ${item.requiredLevel}.`);
  if (item.kind === 'weapon' && !item.weapon) return reject('This weapon has no attack profile.');
  if ((item.kind === 'grimoire' || item.kind === 'orb') && !item.focus) return reject('This focus has no equipment profile.');
  if (item.kind === 'shield' && !item.shield) return reject('This shield has no defense profile.');
  if (cls && item.weapon && !cls.weapons.includes(item.weapon.family))
    return reject(`${cls.name}s cannot use ${item.weapon.family} weapons.`);
  if (cls && item.weapon?.hands === 2 && item.weapon.attackKind === 'melee' && !cls.twoHandedMelee)
    return reject(`${cls.name}s cannot use two-handed melee weapons.`);
  const grid = packGrid(sheet);
  const inventory = [...sheet.inventory, ...Array(Math.max(0, grid.totalCells - sheet.inventory.length)).fill(null)], equipped = { ...sheet.equipped };
  const inventoryLayout = resolvePackLayout(sheet), preferredCell = inventoryLayout[item.id];
  const displaced: Array<{ slot: EquipmentSlot; item: Item }> = [];
  if (source !== undefined) inventory[source] = null;
  if (equipped[slot]) displaced.push({ slot, item: equipped[slot]! });
  equipped[slot] = item;
  const conflict = slot === 'weapon' && item.weapon?.hands === 2 && equipped.offhand ? 'offhand'
    : slot === 'offhand' && equipped.weapon?.weapon?.hands === 2 ? 'weapon' : null;
  if (conflict) { displaced.push({ slot: conflict, item: equipped[conflict]! }); equipped[conflict] = null; }
  for (let i = 0; i < displaced.length && !(previewOnly && source === undefined); i++) {
    const index = i === 0 && source !== undefined ? source : inventory.findIndex(existing => existing === null);
    const cell = findPackSpace(displaced[i].item, packOccupancy(inventory, inventoryLayout, grid), i === 0 ? preferredCell : undefined, 'bag', grid);
    if (index < 0 || cell === null) return reject('Make room in your pack for the displaced equipment.');
    inventory[index] = displaced[i].item;
    inventoryLayout[displaced[i].item.id] = cell;
  }
  return { ok: true, slot, inventory, equipped, displaced, inventoryLayout: resolvePackLayout({ inventory, inventoryLayout, bags: sheet.bags }) };
}

/** Commit only a fully validated plan; failures preserve every container. */
export function equipItem(sheet: CharacterSheet, inventoryIndex: number, level: number, targetSlot?: EquipmentSlot): ActionResult {
  if (!validIndex(sheet, inventoryIndex)) return fail('Choose an item in your pack.');
  const item = sheet.inventory[inventoryIndex];
  if (!item) return fail('That inventory cell is empty.');
  if (isBagItem(item)) return equipBag(sheet, inventoryIndex, level);
  const plan = planEquipmentChange(sheet, item, level, { sourceIndex: inventoryIndex, slot: targetSlot });
  if (!plan.ok) return plan;
  sheet.inventory = plan.inventory; sheet.equipped = plan.equipped; sheet.inventoryLayout = plan.inventoryLayout;
  return success();
}

/** Bag activation: consumables are used (one charge, buff applied); everything else equips. */
export function useInventoryItem(player: Player, inventoryIndex: number, targetSlot?: EquipmentSlot): ActionResult {
  const item = Number.isInteger(inventoryIndex) ? player.character.inventory[inventoryIndex] : null;
  if (isConsumableItem(item) && targetSlot === undefined) return useConsumable(player, inventoryIndex);
  return equipItem(player.character, inventoryIndex, player.level, targetSlot);
}

export function unequipItem(sheet: CharacterSheet, slot: EquipmentSlot, targetCell?: number): ActionResult {
  if (!slot || !EQUIPMENT_SLOTS.includes(slot) || !sheet.equipped[slot]) return fail('That equipment slot is empty.');
  const item = sheet.equipped[slot]!, grid = packGrid(sheet), layout = resolvePackLayout(sheet);
  const occupied = packOccupancy(sheet.inventory, layout, grid);
  const cell = targetCell === undefined ? findPackSpace(item, occupied, undefined, 'bag', grid) :
    footprintCells(item, targetCell, grid)?.every(n => !occupied.has(n)) ? targetCell : null;
  const empty = sheet.inventory.findIndex(item => item === null);
  const index = empty >= 0 ? empty : sheet.inventory.length < grid.totalCells ? sheet.inventory.length : -1;
  if (index < 0 || cell === null) return fail('Make room in your pack for this item.');
  while (sheet.inventory.length < grid.totalCells) sheet.inventory.push(null);
  sheet.inventory[index] = item; sheet.equipped[slot] = null;
  sheet.inventoryLayout = { ...layout, [item.id]: cell }; normalizePackLayout(sheet);
  return success();
}

/** Move to a physical cell, or swap a single overlapping item when both footprints fit. */
export function planInventoryMove(sheet: CharacterSheet, from: number, to: number): PackLayout | null {
  if (!validIndex(sheet, from)) return null;
  const item = sheet.inventory[from]; if (!item) return null;
  const grid = packGrid(sheet);
  const cells = footprintCells(item, to, grid); if (!cells) return null;
  const layout = resolvePackLayout(sheet), sourceCell = layout[item.id];
  const hits = sheet.inventory.filter((other): other is Item => !!other && other.id !== item.id && layout[other.id] !== undefined
    && footprintCells(other, layout[other.id], grid)!.some(n => cells.includes(n)));
  if (hits.length > 1 || hits.length && sourceCell === undefined) return null;
  const next = { ...layout, [item.id]: to };
  if (hits.length) next[hits[0].id] = sourceCell;
  const occupied = new Set<number>();
  for (const other of sheet.inventory) if (other && next[other.id] !== undefined) {
    const area = footprintCells(other, next[other.id], grid);
    if (!area || area.some(n => occupied.has(n))) return null;
    area.forEach(n => occupied.add(n));
  }
  return next;
}
export function moveInventoryItem(sheet: CharacterSheet, from: number, to: number): ActionResult {
  const layout = planInventoryMove(sheet, from, to);
  if (!layout) return fail('This item does not fit here.');
  sheet.inventoryLayout = layout; return success();
}

export function allocateAttribute(sheet: CharacterSheet, attribute: Attribute): ActionResult {
  if (!['strength', 'dexterity', 'intelligence', 'vitality'].includes(attribute)) return fail('Unknown attribute.');
  if (!Number.isSafeInteger(sheet.statPoints) || sheet.statPoints < 1) return fail('No attribute points available.');
  if (!Number.isSafeInteger(sheet.attributes[attribute]) || sheet.attributes[attribute] >= Number.MAX_SAFE_INTEGER) return fail('This attribute cannot increase further.');
  sheet.attributes[attribute]++;
  sheet.statPoints--;
  return success();
}
