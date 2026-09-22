/** Emblem of Heroism rewards catalog (WotLK badge vendor stock): the frozen
 * tier-7 offset pieces and a few authored uniques the badge vendor sells.
 * Gear rows roll per purchase at the buyer's level (generateItem), like the
 * PvP quartermaster; unique rows mint their authored item (generateUnique). */
import { generateItem, generateUnique } from './items.ts';
import type { Item, ItemKind, ItemTier } from './character-types.ts';

/** One catalog row: a generated gear piece or an authored unique. */
export type BadgeStockEntry =
  | { readonly id: string; readonly name: string; readonly kind: 'gear'; readonly slot: ItemKind; readonly tier: ItemTier; readonly price: number }
  | { readonly id: string; readonly name: string; readonly kind: 'unique'; readonly uniqueId: string; readonly price: number };

const gear = (id: string, name: string, slot: ItemKind, tier: ItemTier, price: number): BadgeStockEntry =>
  Object.freeze({ id, name, kind: 'gear', slot, tier, price });
const unique = (id: string, name: string, uniqueId: string, price: number): BadgeStockEntry =>
  Object.freeze({ id, name, kind: 'unique', uniqueId, price });

/** WotLK emblem-vendor shape: tier-7 offset epics plus signature uniques. */
export const BADGE_VENDOR_STOCK: readonly BadgeStockEntry[] = Object.freeze([
  gear('valor-cloak', 'Cloak of the Valorous', 'cloak', 'epic', 25),
  gear('valor-ring', 'Band of the Valorous', 'ring', 'epic', 25),
  gear('valor-amulet', 'Pendant of the Valorous', 'amulet', 'epic', 25),
  gear('valor-treads', 'Treads of the Valorous', 'boots', 'epic', 30),
  gear('valor-grips', 'Grips of the Valorous', 'gloves', 'epic', 30),
  gear('valor-relic', 'Sigil of the Valorous', 'relic', 'epic', 30),
  gear('valor-orb', 'Focus of the Valorous', 'orb', 'epic', 30),
  gear('valor-shield', 'Bulwark of the Valorous', 'shield', 'epic', 35),
  unique('signet-of-the-pale-huntsman', 'Pale Huntsman’s Signet', 'pale-huntsman', 40),
  unique('vessel-of-borrowed-life', 'Vessel of Borrowed Life', 'borrowed-life', 40),
  unique('the-patient-bastion', 'The Patient Bastion', 'patient-bastion', 45),
]);

export const badgeStockEntry = (stockId: string): BadgeStockEntry | undefined =>
  BADGE_VENDOR_STOCK.find(entry => entry.id === stockId);

/** Roll the row's item at the buyer's level; deterministic per seed. */
export function badgeStockItem(entry: BadgeStockEntry, level: number, seed: number): Item {
  if (entry.kind === 'unique') return generateUnique(seed, level, entry.uniqueId);
  const item = generateItem(seed, level, entry.slot, undefined, entry.tier);
  item.name = entry.name;
  item.baseName = entry.name;
  return item;
}
