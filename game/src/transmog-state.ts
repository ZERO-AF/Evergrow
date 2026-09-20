/**
 * Transmogrification (WoW appearance override): an equipped item keeps its stats
 * while the render path draws another owned item's model.
 *
 * The per-character map lives on the sheet — `character.transmog`, slot → owned
 * item id — so it rides the existing character checkpoint clone with no
 * simulation.ts capture/restore changes. The integrator adds the optional field
 * to CharacterSheet and validates it in validSheet via validTransmogMap.
 *
 * Ownership is live, not a collected-appearance ledger: the source item must be
 * in the bag, equipped, or stashed. Selling or dropping the source breaks the
 * entry; every read path re-validates, so stale ids are simply ignored.
 */
import { GAME_FEATURES } from './game-features.ts';
import { COPPER_PER_SILVER } from './currency.ts';
import { itemPrice } from './commerce.ts';
import { itemFitsSlot } from './inventory.ts';
import { EQUIPMENT_SLOTS } from './items.ts';
import { object, text } from './item-validation.ts';
import type { CharacterSheet, EquipmentSlot, Item } from './character-types.ts';
import type { Equipment } from './model.ts';

/** Slot → id of the owned item whose appearance replaces the equipped item's. */
export type TransmogMap = Partial<Record<EquipmentSlot, string>>;
/** CharacterSheet carrying the transmog map until the field lands on the interface. */
export type TransmoggedSheet = CharacterSheet & { transmog?: TransmogMap };

/** Slots with a drawn model. Amulets and rings are invisible; shoulders ride the chest piece. */
export const TRANSMOG_SLOTS: readonly EquipmentSlot[] = Object.freeze([
  'weapon', 'offhand', 'head', 'chest', 'gloves', 'legs', 'boots', 'cloak',
]);

/** Feature flag read through a tolerant lens until GAME_FEATURES.transmog lands. */
export const transmogEnabled = (): boolean =>
  (GAME_FEATURES as Record<string, boolean | undefined>).transmog ?? true;

/** The sheet's transmog map; undefined until the first applied look. */
export const transmogOf = (sheet: CharacterSheet): TransmogMap | undefined =>
  (sheet as TransmoggedSheet).transmog;

/** Every item instance the character owns: worn, packed and stashed. */
export function ownedItems(sheet: CharacterSheet): Item[] {
  return [...Object.values(sheet.equipped), ...sheet.inventory, ...(sheet.stash ?? [])]
    .filter((item): item is Item => item !== null);
}

/** One owned item by instance id, wherever it is carried. */
export function ownedItem(sheet: CharacterSheet, id: string): Item | null {
  return ownedItems(sheet).find(item => item.id === id) ?? null;
}

/**
 * WoW-style compatibility: same slot, and weapons keep hand count plus attack
 * kind — a bow never poses as a sword, a wand never as a staff. Focus off-hands
 * (grimoire/orb) share one visual family, like WoW off-hand frills; armor swaps
 * freely across cloth/leather/plate since the game has no proficiency rule.
 */
export function transmogCompatible(equipped: Item, source: Item, slot: EquipmentSlot): boolean {
  if (source.id === equipped.id || !itemFitsSlot(source, slot)) return false;
  if (slot === 'weapon' || slot === 'offhand' && equipped.kind === 'weapon') {
    const a = equipped.weapon, b = source.weapon;
    return !!a && !!b && a.hands === b.hands && a.attackKind === b.attackKind;
  }
  if (slot === 'offhand') {
    return equipped.kind === 'shield' ? source.kind === 'shield'
      : source.kind === 'grimoire' || source.kind === 'orb';
  }
  return source.kind === equipped.kind;
}

/** The owned item whose look a slot currently wears, or null when the entry is stale. */
export function transmogSource(sheet: CharacterSheet, slot: EquipmentSlot, map: TransmogMap | undefined = transmogOf(sheet)): Item | null {
  const equipped = sheet.equipped[slot];
  const id = map?.[slot];
  if (!equipped || !id) return null;
  const source = ownedItem(sheet, id);
  return source && transmogCompatible(equipped, source, slot) ? source : null;
}

/** Owned items that can supply the look for a slot, in equipment → bag → stash order. */
export function transmogSources(sheet: CharacterSheet, slot: EquipmentSlot): Item[] {
  const equipped = sheet.equipped[slot];
  if (!equipped) return [];
  return ownedItems(sheet).filter(item => transmogCompatible(equipped, item, slot));
}

/** Why `source` cannot be applied to `slot`, or null when it can. */
export function transmogProblem(sheet: CharacterSheet, slot: EquipmentSlot, source: Item | null): string | null {
  if (!transmogEnabled()) return 'Transmogrification is not available.';
  if (!TRANSMOG_SLOTS.includes(slot)) return 'That slot has no visible model.';
  const equipped = sheet.equipped[slot];
  if (!equipped) return 'Nothing is equipped in that slot.';
  if (!source) return 'Choose an item you own.';
  if (source.id === equipped.id) return 'That item is already equipped there.';
  if (transmogCompatible(equipped, source, slot)) return null;
  if (slot === 'weapon' || equipped.kind === 'weapon')
    return 'Weapons keep their handedness and attack style.';
  if (slot === 'offhand')
    return equipped.kind === 'shield' ? 'Only shields can supply a shield look.' : 'Only grimoires and orbs can supply this look.';
  return `Only ${equipped.kind} pieces can supply this look.`;
}

/** WoW charges the equipped item's vendor value; one silver keeps the fee symbolic. */
export function transmogCost(item: Item): number {
  return Math.max(COPPER_PER_SILVER, itemPrice(item, 'sell'));
}

/**
 * Sheet view whose equipped slots resolve to their transmog sources. Visual reads
 * only — stats, tooltips and comparisons must always come from the real sheet.
 * Returns the input unchanged when nothing resolves.
 */
export function transmoggedSheet(sheet: CharacterSheet, map: TransmogMap | undefined = transmogOf(sheet)): CharacterSheet {
  if (!map || !transmogEnabled()) return sheet;
  let equipped: CharacterSheet['equipped'] | null = null;
  for (const slot of TRANSMOG_SLOTS) {
    const real = sheet.equipped[slot];
    const source = map[slot] ? ownedItem(sheet, map[slot]!) : null;
    if (!real || !source || !transmogCompatible(real, source, slot)) continue;
    (equipped ??= { ...sheet.equipped })[slot] = source;
  }
  return equipped ? { ...sheet, equipped } : sheet;
}

/**
 * Equipment projection with transmogged visuals. Stats, reach and cadence stay on
 * the real definitions; only the drawn model changes. Wire into refreshCharacter
 * (character.ts) right after player.equipment is built — attack snapshots, sword
 * trails, dodge ghosts and skill visuals then inherit the look for free.
 * A broken weapon keeps the unarmed projection, matching durabilityFactor.
 */
export function transmoggedEquipment(equipment: Equipment, sheet: CharacterSheet, map?: TransmogMap): Equipment {
  const gear = transmoggedSheet(sheet, map);
  if (gear === sheet) return equipment;
  const main = gear.equipped.weapon?.weapon;
  const mainHand = equipment.mainHand.family === 'unarmed' || !main ? equipment.mainHand
    : { ...equipment.mainHand, visual: main.visual };
  const off = equipment.offHand, item = gear.equipped.offhand;
  const offHand: Equipment['offHand'] =
    off?.kind === 'weapon' && item?.weapon ? { ...off, weapon: { ...off.weapon, visual: item.weapon.visual } }
    : off?.kind === 'shield' && item?.shield ? { ...off, shield: { ...off.shield, visual: item.shield.visual } }
    : off?.kind === 'focus' && item?.focus ? { ...off, focus: { ...off.focus, visual: item.focus.visual } }
    : off;
  return { mainHand, offHand };
}

/** Drop entries whose source is gone or no longer compatible (sold, dropped, re-equipped). */
export function pruneTransmog(sheet: CharacterSheet, map: TransmogMap | undefined = transmogOf(sheet)): TransmogMap | undefined {
  if (!map) return undefined;
  const next: TransmogMap = {};
  for (const [slot, id] of Object.entries(map) as Array<[EquipmentSlot, string]>) {
    const equipped = sheet.equipped[slot];
    const source = id ? ownedItem(sheet, id) : null;
    if (equipped && source && transmogCompatible(equipped, source, slot)) next[slot] = id;
  }
  return Object.keys(next).length ? next : undefined;
}

/** Save validation for `character.transmog`; wired into validSheet by the integrator. */
export function validTransmogMap(v: unknown): v is TransmogMap {
  return object(v) && Object.keys(v).length <= EQUIPMENT_SLOTS.length
    && Object.entries(v).every(([slot, id]) =>
      (EQUIPMENT_SLOTS as readonly string[]).includes(slot) && text(id, 160));
}
