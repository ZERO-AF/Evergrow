import type { StatKey, StatModifiers } from './character-types.ts';
import type { DurabilityMap } from './durability-state.ts';
import { activeItemSets, type EquippedView } from './item-set-state.ts';

/**
 * Set-bonus aggregation (docs/wow-deepening.md, second wave). Pure functions the
 * integrator wires into character-stats.ts characterModifierSources so tiered set
 * bonuses flow through deriveCharacterStats like every other modifier source.
 */

/** Merged StatModifiers from every active set bonus tier across equipped sets.
 * Pass the player's durability map to exclude broken (0-durability) pieces —
 * consistent with durabilityFactor suppressing a broken item's own stats. */
export function setBonusStats(equipped: EquippedView, durability?: DurabilityMap): StatModifiers {
  const modifiers: StatModifiers = {};
  for (const { active } of activeItemSets(equipped, durability))
    for (const tier of active) {
      // Object.entries erases the key type; StatKey is the declared key domain.
      const stats = Object.entries(tier.stats) as Array<[StatKey, number]>;
      for (const [stat, value] of stats) modifiers[stat] = (modifiers[stat] ?? 0) + value;
    }
  return modifiers;
}

/** characterModifierSources-shaped entries — one labeled source per active tier,
 * so the character-sheet stat explanation shows "Heroes' Dreadnaught (2) Set". */
export function setBonusSources(equipped: EquippedView, durability?: DurabilityMap): Array<{ label: string; modifiers: StatModifiers }> {
  return activeItemSets(equipped, durability).flatMap(({ set, active }) =>
    active.map(tier => ({ label: `${set.name} (${tier.pieces}) Set`, modifiers: { ...tier.stats } })));
}
