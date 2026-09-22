import type { StatModifiers } from './character-types.ts';
import type { PetFamily } from './pet-content.ts';

/**
 * Hunter pet talent trees (WotLK): every pet family belongs to one of three
 * trees — Ferocity for damage dealers (cats, wolves, raptors), Tenacity for
 * tanks (bears, boars, turtles), Cunning for utility pets (spiders, wind
 * serpents, carrion birds). Headless content only: frozen tables, no state.
 *
 * Talents are keyed `'<tree>.<name>'` so shared names (Great Stamina, Natural
 * Armor, Boar's Speed, Owl's Focus, Dash/Dive) stay unique across trees.
 * `tier` is the row order; a tier unlocks after PET_TALENT_RULES.tierStep
 * points are spent anywhere in the tree (WotLK pet trees gate on total spent
 * points, not on a column). `requires` is the rare direct prerequisite —
 * a prior talent at a minimum rank.
 */

export type PetTalentTree = 'ferocity' | 'tenacity' | 'cunning';

export const PET_TALENT_RULES = Object.freeze({
  /** One talent point per this many pet levels (WotLK-style). */
  levelsPerPoint: 4,
  /** Points spent in the tree needed to unlock each successive tier. */
  tierStep: 3,
  /** Highest rank any pet talent can reach. */
  maxRank: 3,
});

/** WotLK family → tree assignment. */
export const PET_FAMILY_TREE: Readonly<Record<PetFamily, PetTalentTree>> = Object.freeze({
  wolf: 'ferocity',
  cat: 'ferocity',
  raptor: 'ferocity',
  bird: 'ferocity',
  bear: 'tenacity',
  boar: 'tenacity',
  turtle: 'tenacity',
  scorpid: 'tenacity',
  spider: 'cunning',
  windSerpent: 'cunning',
});

export const PET_TALENT_TREES: Readonly<Record<PetTalentTree, { readonly name: string; readonly flavor: string }>> = Object.freeze({
  ferocity: Object.freeze({ name: 'Ferocity', flavor: 'Damage dealers — cats, wolves, raptors, carrion birds.' }),
  tenacity: Object.freeze({ name: 'Tenacity', flavor: 'Sturdy tanks — bears, boars, turtles, scorpids.' }),
  cunning: Object.freeze({ name: 'Cunning', flavor: 'Canny utility pets — spiders, wind serpents.' }),
});

/** A pet-specific effect that is not a plain stat line: granted abilities and
 * named passives. `perRank` is the magnitude each rank adds (percent chance,
 * percent damage…) — omitted for binary grants, which aggregate as ranks. */
export interface PetTalentEffect {
  readonly id: string;
  readonly description: string;
  readonly perRank?: number;
}

/** What one rank of a talent buys: flat StatModifiers and/or a named effect. */
export interface PetTalentBonus {
  readonly stats?: StatModifiers;
  readonly effect?: PetTalentEffect;
}

export interface PetTalent {
  readonly id: string;
  readonly tree: PetTalentTree;
  readonly name: string;
  readonly description: string;
  readonly maxRanks: number;
  /** Row order inside the tree; tier N needs (N-1) * tierStep points spent. */
  readonly tier: number;
  /** Direct prerequisite: another talent at `points` ranks or more. */
  readonly requires?: { readonly id: string; readonly points: number };
  readonly bonus: PetTalentBonus;
}

const bonus = (b: PetTalentBonus): Readonly<PetTalentBonus> =>
  Object.freeze({ ...(b.stats ? { stats: Object.freeze(b.stats) } : {}), ...(b.effect ? { effect: Object.freeze(b.effect) } : {}) });

const talent = (tree: PetTalentTree, key: string, name: string, description: string,
  maxRanks: number, tier: number, b: PetTalentBonus, requires?: PetTalent['requires']): Readonly<PetTalent> =>
  Object.freeze<PetTalent>({ id: `${tree}.${key}`, tree, name, description, maxRanks, tier, ...(requires ? { requires: Object.freeze(requires) } : {}), bonus: bonus(b) });

/** Every pet talent, keyed by id. ~9 per tree, WotLK names and effects. */
export const PET_TALENTS: Readonly<Record<string, PetTalent>> = Object.freeze(Object.fromEntries([
  // ── Ferocity — dps pets ────────────────────────────────────────────────
  talent('ferocity', 'cobraReflexes', 'Cobra Reflexes',
    'Increases your pet\'s attack speed by 15% per rank, but each strike hits a little softer.', 2, 1,
    { stats: { attackSpeedPercent: 15 } }),
  talent('ferocity', 'dive', 'Dive',
    'Teaches Dive: the pet surges forward, gaining 80% movement speed for a short rush.', 1, 1,
    { effect: { id: 'dive', description: 'Grants the Dive ability: a burst of movement speed.' } }),
  talent('ferocity', 'greatStamina', 'Great Stamina',
    'Increases your pet\'s total health by 4% per rank.', 3, 1,
    { stats: { maxHpPercent: 4 } }),
  talent('ferocity', 'naturalArmor', 'Natural Armor',
    'Increases your pet\'s armor by 5% per rank.', 2, 1,
    { stats: { armorPercent: 5 } }),
  talent('ferocity', 'boarsSpeed', 'Boar\'s Speed',
    'Increases your pet\'s movement speed by 30%.', 1, 2,
    { stats: { moveSpeedPercent: 30 } }),
  talent('ferocity', 'owlsFocus', 'Owl\'s Focus',
    'Your pet has a 15% chance per rank after using an ability to make its next ability cost no focus.', 2, 2,
    { effect: { id: 'owlsFocus', description: 'Chance the next ability is focus-free.', perRank: 15 } }),
  talent('ferocity', 'spikedCollar', 'Spiked Collar',
    'Your pet\'s attacks deal 3% additional damage per rank.', 3, 2,
    { stats: { damagePercent: 3 } }),
  talent('ferocity', 'cullingTheHerd', 'Culling the Herd',
    'When your pet critically strikes, its damage is increased by 3% per rank for a short time.',
    3, 3, { effect: { id: 'cullingTheHerd', description: 'Critical strikes raise pet damage briefly.', perRank: 3 } },
    { id: 'ferocity.spikedCollar', points: 3 }),
  talent('ferocity', 'heartOfThePhoenix', 'Heart of the Phoenix',
    'When your pet dies, it has a chance to return to life with a portion of its health.',
    1, 4, { effect: { id: 'heartOfThePhoenix', description: 'The pet may resurrect itself once.' } },
    { id: 'ferocity.cullingTheHerd', points: 1 }),

  // ── Tenacity — tank pets ───────────────────────────────────────────────
  talent('tenacity', 'bloodOfTheRhino', 'Blood of the Rhino',
    'Increases your pet\'s total health by 2% per rank and the healing it receives by 20% per rank.', 2, 1,
    { stats: { maxHpPercent: 2 }, effect: { id: 'healingReceived', description: 'Healing received is increased.', perRank: 20 } }),
  talent('tenacity', 'greatStamina', 'Great Stamina',
    'Increases your pet\'s total health by 4% per rank.', 3, 1,
    { stats: { maxHpPercent: 4 } }),
  talent('tenacity', 'naturalArmor', 'Natural Armor',
    'Increases your pet\'s armor by 5% per rank.', 2, 1,
    { stats: { armorPercent: 5 } }),
  talent('tenacity', 'petBarding', 'Pet Barding',
    'Increases your pet\'s armor by 5% per rank and chance to dodge attacks by 1% per rank.', 2, 2,
    { stats: { armorPercent: 5 }, effect: { id: 'dodgeChance', description: 'Chance to dodge attacks.', perRank: 1 } }),
  talent('tenacity', 'guardDog', 'Guard Dog',
    'Your pet\'s Growl generates 20% additional threat per rank.', 2, 2,
    { effect: { id: 'guardDog', description: 'Growl generates additional threat.', perRank: 20 } }),
  talent('tenacity', 'taunt', 'Taunt',
    'Teaches Taunt: the pet taunts the target to attack it for a short time.', 1, 2,
    { effect: { id: 'taunt', description: 'Grants the Taunt ability.' } }),
  talent('tenacity', 'lastStand', 'Last Stand',
    'Teaches Last Stand: the pet temporarily gains 30% of its maximum health.', 1, 3,
    { effect: { id: 'lastStand', description: 'Grants the Last Stand ability.' } },
    { id: 'tenacity.bloodOfTheRhino', points: 2 }),
  talent('tenacity', 'roarOfSacrifice', 'Roar of Sacrifice',
    'Teaches Roar of Sacrifice: the pet absorbs half the damage dealt to a friendly target.', 1, 3,
    { effect: { id: 'roarOfSacrifice', description: 'Grants the Roar of Sacrifice ability.' } },
    { id: 'tenacity.guardDog', points: 2 }),

  // ── Cunning — utility pets ─────────────────────────────────────────────
  talent('cunning', 'dash', 'Dash',
    'Teaches Dash: the pet surges forward, gaining 80% movement speed for a short rush.', 1, 1,
    { effect: { id: 'dash', description: 'Grants the Dash ability: a burst of movement speed.' } }),
  talent('cunning', 'greatStamina', 'Great Stamina',
    'Increases your pet\'s total health by 4% per rank.', 3, 1,
    { stats: { maxHpPercent: 4 } }),
  talent('cunning', 'naturalArmor', 'Natural Armor',
    'Increases your pet\'s armor by 5% per rank.', 2, 1,
    { stats: { armorPercent: 5 } }),
  talent('cunning', 'boarsSpeed', 'Boar\'s Speed',
    'Increases your pet\'s movement speed by 30%.', 1, 2,
    { stats: { moveSpeedPercent: 30 } }),
  talent('cunning', 'owlsFocus', 'Owl\'s Focus',
    'Your pet has a 15% chance per rank after using an ability to make its next ability cost no focus.', 2, 2,
    { effect: { id: 'owlsFocus', description: 'Chance the next ability is focus-free.', perRank: 15 } }),
  talent('cunning', 'cornered', 'Cornered',
    'When your pet falls below 35% health, it deals 25% more damage per rank and is harder to critically hit.', 2, 3,
    { effect: { id: 'cornered', description: 'Low-health damage surge.', perRank: 25 } }),
  talent('cunning', 'feedingFrenzy', 'Feeding Frenzy',
    'Your pet deals 10% additional damage per rank to targets below 35% health.', 2, 3,
    { effect: { id: 'feedingFrenzy', description: 'Bonus damage to wounded targets.', perRank: 10 } },
    { id: 'cunning.cornered', points: 1 }),
  talent('cunning', 'wolverineBite', 'Wolverine Bite',
    'Teaches Wolverine Bite: a fierce counterattack usable after the pet dodges.', 1, 3,
    { effect: { id: 'wolverineBite', description: 'Grants the Wolverine Bite ability.' } },
    { id: 'cunning.cornered', points: 2 }),
  talent('cunning', 'roarOfRecovery', 'Roar of Recovery',
    'Teaches Roar of Recovery: the pet\'s roar restores focus to its master over time.', 1, 4,
    { effect: { id: 'roarOfRecovery', description: 'Grants the Roar of Recovery ability.' } },
    { id: 'cunning.owlsFocus', points: 2 }),
].map(t => [t.id, t])));

/** The talents of one tree, in tier order. */
export function petTalentTreeTalents(tree: PetTalentTree): readonly PetTalent[] {
  return Object.values(PET_TALENTS).filter(t => t.tree === tree).sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
}
