import type { EquipmentSlot, Item } from './character-types.ts';
import { durabilityFactor, type DurabilityMap } from './durability-state.ts';
import { itemSet, setPieceOf, setPieceSet, type ItemSetDef, type SetBonusTier, type SetPieceDef } from './item-set-content.ts';

/**
 * Item-set runtime state (docs/wow-deepening.md, second wave). Sets carry no
 * persisted player state — membership is derived from equipped items, so all
 * queries here are pure reads over `equipped` (a CharacterSheet['equipped']
 * record or any partial view of it).
 */

export type EquippedView = Readonly<Partial<Record<EquipmentSlot, Item | null>>>;

/** Set pieces currently equipped, grouped by set, in authored piece order. */
export function equippedSetPieces(equipped: EquippedView, durability?: DurabilityMap): Map<ItemSetDef, SetPieceDef[]> {
  const found = new Map<ItemSetDef, SetPieceDef[]>();
  for (const [slot, item] of Object.entries(equipped)) {
    if (!item || durability && !durabilityFactor(durability, slot as EquipmentSlot)) continue;
    const piece = setPieceOf(item);
    if (!piece) continue;
    const set = setPieceSet(piece);
    const list = found.get(set) ?? [];
    if (!list.includes(piece)) list.push(piece);
    found.set(set, list);
  }
  for (const [set, list] of found) found.set(set, set.pieces.filter(p => list.includes(p)));
  return found;
}

/** How many pieces of `set` are equipped (broken pieces excluded when durability is passed). */
export function setPieceCount(equipped: EquippedView, set: ItemSetDef, durability?: DurabilityMap): number {
  return equippedSetPieces(equipped, durability).get(set)?.length ?? 0;
}

/** Bonus tiers currently active for `set`, ascending by piece threshold. */
export function activeSetBonuses(equipped: EquippedView, set: ItemSetDef, durability?: DurabilityMap): readonly SetBonusTier[] {
  const count = setPieceCount(equipped, set, durability);
  return set.bonuses.filter(b => count >= b.pieces);
}

/** Every set with at least one equipped piece, with its active tiers. */
export function activeItemSets(equipped: EquippedView, durability?: DurabilityMap): Array<{ set: ItemSetDef; count: number; active: readonly SetBonusTier[] }> {
  return [...equippedSetPieces(equipped, durability)].map(([set, pieces]) => ({
    set, count: pieces.length, active: set.bonuses.filter(b => pieces.length >= b.pieces),
  }));
}

/** WoW-style set block for an item tooltip: piece checklist plus per-tier bonus
 * lines with active flags. `have` marks equipped pieces (inventory ownership is
 * not tracked, so the checklist reflects what is worn). */
export interface SetTooltipModel {
  readonly set: ItemSetDef;
  readonly count: number;
  readonly pieces: ReadonlyArray<{ def: SetPieceDef; have: boolean }>;
  readonly bonuses: ReadonlyArray<{ tier: SetBonusTier; active: boolean }>;
}

export function setTooltipModel(item: Pick<Item, 'id' | 'name' | 'kind'>, equipped?: EquippedView, durability?: DurabilityMap): SetTooltipModel | null {
  const piece = setPieceOf(item);
  if (!piece) return null;
  const set = itemSet(setPieceSet(piece).id)!;
  const worn = equipped ? equippedSetPieces(equipped, durability).get(set) ?? [] : [];
  const count = worn.length;
  return {
    set, count,
    pieces: set.pieces.map(def => ({ def, have: worn.includes(def) })),
    bonuses: set.bonuses.map(tier => ({ tier, active: count >= tier.pieces })),
  };
}

/** Compact status lines for a character sheet or chat readout, e.g.
 * "Heroes' Dreadnaught Battlegear (3/5) — (2) Set, (3) Set active". */
export function setStatusLines(equipped: EquippedView, durability?: DurabilityMap): string[] {
  return activeItemSets(equipped, durability).map(({ set, count, active }) =>
    `${set.name} (${count}/${set.pieces.length})${active.length ? ` — ${active.map(b => `(${b.pieces}) Set`).join(', ')} active` : ''}`);
}
