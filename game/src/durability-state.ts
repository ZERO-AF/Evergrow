import type { EquipmentSlot } from './character-types.ts';
import type { Player } from './model.ts';

/** WoW durability (docs/wow-deepening.md §12): equipped gear wears down in combat and on
 * death; at 0 the item is kept but its stats stop applying until repaired at a blacksmith.
 * Values follow real WoW rules: death costs 10% of maximum on every durable piece, armor
 * loses durability as it absorbs hits, weapons as they land them. */
export const DURABILITY_RULES = Object.freeze({
  /** Maximum durability per slot (WoW uses a per-item max; one shared 0-100 scale here). */
  max: 100,
  /** Real WoW death penalty: 10% of maximum durability on all equipped gear. */
  deathLoss: 10,
  /** Armor wear per enemy hit taken. */
  hitTakenLoss: .1,
  /** Weapon wear per player hit landed. */
  strikeLoss: .1,
  /** Paper-doll warning threshold (WoW shows the yellow armored man below ~25%). */
  warnBelow: 25,
});

/** Slots that carry durability. Real WoW gives none to cloaks, amulets and rings. */
export const DURABLE_SLOTS: readonly EquipmentSlot[] = Object.freeze([
  'weapon', 'offhand', 'head', 'chest', 'gloves', 'legs', 'boots',
]);
/** Slots that wear when the player is hit (armor plus a held off-hand). */
export const ARMOR_SLOTS: readonly EquipmentSlot[] = Object.freeze([
  'offhand', 'head', 'chest', 'gloves', 'legs', 'boots',
]);
/** Slots that wear when the player lands a hit (both hands, like WoW dual wield). */
export const STRIKE_SLOTS: readonly EquipmentSlot[] = Object.freeze(['weapon', 'offhand']);

export type DurabilityMap = Partial<Record<EquipmentSlot, number>>;

/** Current durability for a slot: undefined for slots that never wear, max when untracked. */
export function durabilityOf(player: Pick<Player, 'durability'>, slot: EquipmentSlot): number | undefined {
  if (!DURABLE_SLOTS.includes(slot)) return undefined;
  const value = player.durability?.[slot];
  return value === undefined ? DURABILITY_RULES.max : Math.max(0, Math.min(DURABILITY_RULES.max, value));
}

/** Stat-derivation hook: 1 while the item functions, 0 once broken (stats suppressed). */
export function durabilityFactor(durability: DurabilityMap | undefined, slot: EquipmentSlot): 0 | 1 {
  if (!DURABLE_SLOTS.includes(slot)) return 1;
  return (durability?.[slot] ?? DURABILITY_RULES.max) > 0 ? 1 : 0;
}
