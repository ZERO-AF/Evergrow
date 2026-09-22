/** Permanent gear enchants (docs/wow-deepening.md §3): the Enchanting profession's
 * high-skill family. Unlike the timed enchant scrolls (profession-content.ts
 * MaterialUse buffs), these bind to the item itself — `Item.enchant` persists on
 * the character sheet and deriveItem folds the stats into the item's implicit
 * modifiers, so they survive save/load, trading and re-derivation.
 * Names and slot targets follow real WotLK enchants (wowhead.com/wotlk);
 * reagents are adapted to this world's disenchant yields. */
import type { ItemKind, StatModifiers } from './character-types.ts';

export interface EnchantDef {
  readonly id: string;
  /** Display name; the tooltip line renders `Enchanted: <name>`. */
  readonly name: string;
  /** Item kinds the enchant can be applied to (weapon enchants never fit armor). */
  readonly kinds: readonly ItemKind[];
  /** Flat stat bonuses folded into the item's implicit modifiers. */
  readonly stats: StatModifiers;
  /** Enchanting materials consumed on application. */
  readonly materials: Readonly<Record<string, number>>;
  /** Skill at which the enchant is learnable, then yellow → green → gray. */
  readonly skill: readonly [number, number, number, number];
}

const enchant = (def: EnchantDef): Readonly<EnchantDef> =>
  Object.freeze({ ...def, kinds: Object.freeze([...def.kinds]), stats: Object.freeze({ ...def.stats }), materials: Object.freeze({ ...def.materials }) });

const ARMOR: readonly ItemKind[] = ['head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'shield'];

const ENCHANT_DEFINITIONS: EnchantDef[] = [
  // ── Weapon enchants (the iconic melee/caster procs, expressed as stats) ──
  enchant({ id: 'enchantWeaponCrusader', name: 'Enchant Weapon - Crusader', kinds: ['weapon'],
    stats: { strength: 10, damagePercent: 4 },
    materials: { largeBrilliantShard: 4, dreamDust: 6 }, skill: [300, 320, 340, 360] }),
  enchant({ id: 'enchantWeaponMongoose', name: 'Enchant Weapon - Mongoose', kinds: ['weapon'],
    stats: { dexterity: 12, attackSpeedPercent: 2 },
    materials: { largeBrilliantShard: 6, dreamDust: 8, lesserMysticEssence: 4 }, skill: [330, 350, 370, 390] }),
  enchant({ id: 'enchantWeaponLifestealing', name: 'Enchant Weapon - Lifestealing', kinds: ['weapon'],
    stats: { lifeOnHit: 6 },
    materials: { largeBrilliantShard: 4, lesserMysticEssence: 4, dreamDust: 4 }, skill: [315, 335, 355, 375] }),
  enchant({ id: 'enchantWeaponSpellpower', name: 'Enchant Weapon - Spellpower', kinds: ['weapon'],
    stats: { spellDamagePercent: 12 },
    materials: { largeBrilliantShard: 4, greaterMagicEssence: 6, dreamDust: 6 }, skill: [300, 320, 340, 360] }),
  enchant({ id: 'enchantWeaponGreaterStriking', name: 'Enchant Weapon - Greater Striking', kinds: ['weapon'],
    stats: { damagePercent: 7 },
    materials: { smallBrilliantShard: 4, dreamDust: 6 }, skill: [245, 265, 285, 305] }),
  // ── Armor enchants ──
  enchant({ id: 'enchantChestGreaterHealth', name: 'Enchant Chest - Greater Health', kinds: ['chest'],
    stats: { maxHp: 150 },
    materials: { dreamDust: 4, smallBrilliantShard: 2 }, skill: [250, 270, 290, 310] }),
  enchant({ id: 'enchantChestExceptionalStats', name: 'Enchant Chest - Exceptional Stats', kinds: ['chest'],
    stats: { strength: 4, dexterity: 4, intelligence: 4, vitality: 4 },
    materials: { largeBrilliantShard: 2, dreamDust: 6, lesserMysticEssence: 2 }, skill: [300, 320, 340, 360] }),
  enchant({ id: 'enchantCloakGreaterResistance', name: 'Enchant Cloak - Greater Resistance', kinds: ['cloak'],
    stats: { allResistance: 5 },
    materials: { dreamDust: 4, lesserMysticEssence: 2 }, skill: [265, 285, 305, 325] }),
  enchant({ id: 'enchantCloakSuperiorDefense', name: 'Enchant Cloak - Superior Defense', kinds: ['cloak'],
    stats: { armor: 70 },
    materials: { visionDust: 4, dreamDust: 2 }, skill: [285, 305, 325, 345] }),
  enchant({ id: 'enchantGlovesGreaterStamina', name: 'Enchant Gloves - Greater Stamina', kinds: ['gloves'],
    stats: { vitality: 9 },
    materials: { dreamDust: 5 }, skill: [245, 265, 285, 305] }),
  enchant({ id: 'enchantGlovesSuperiorStrength', name: 'Enchant Gloves - Superior Strength', kinds: ['gloves'],
    stats: { strength: 9 },
    materials: { dreamDust: 6, lesserMysticEssence: 2 }, skill: [295, 315, 335, 355] }),
  enchant({ id: 'enchantGlovesGreaterAgility', name: 'Enchant Gloves - Greater Agility', kinds: ['gloves'],
    stats: { dexterity: 9 },
    materials: { dreamDust: 4, lesserMysticEssence: 2 }, skill: [270, 290, 310, 330] }),
  enchant({ id: 'enchantGlovesMajorSpellpower', name: 'Enchant Gloves - Major Spellpower', kinds: ['gloves'],
    stats: { spellDamagePercent: 8 },
    materials: { dreamDust: 6, smallBrilliantShard: 2 }, skill: [310, 330, 350, 370] }),
  enchant({ id: 'enchantBootsGreaterFortitude', name: 'Enchant Boots - Greater Fortitude', kinds: ['boots'],
    stats: { maxHp: 100, vitality: 4 },
    materials: { dreamDust: 4, visionDust: 4 }, skill: [280, 300, 320, 340] }),
  enchant({ id: 'enchantBootsSurefooted', name: 'Enchant Boots - Surefooted', kinds: ['boots'],
    stats: { hitRating: 10, moveSpeedPercent: 4 },
    materials: { dreamDust: 4, smallBrilliantShard: 2 }, skill: [305, 325, 345, 365] }),
  enchant({ id: 'enchantShieldGreaterStamina', name: 'Enchant Shield - Greater Stamina', kinds: ['shield'],
    stats: { vitality: 10 },
    materials: { dreamDust: 6, smallBrilliantShard: 2 }, skill: [290, 310, 330, 350] }),
  enchant({ id: 'enchantHeadArcanum', name: 'Enchant Head - Arcanum of Focus', kinds: ['head'],
    stats: { intelligence: 8, manaRegen: 4 },
    materials: { largeBrilliantShard: 2, dreamDust: 6 }, skill: [320, 340, 360, 380] }),
];

export const ENCHANTS: readonly Readonly<EnchantDef>[] = Object.freeze(ENCHANT_DEFINITIONS);
export type EnchantId = (typeof ENCHANTS)[number]['id'];
export const enchantDefinition = (id: string | null | undefined): Readonly<EnchantDef> | undefined =>
  ENCHANTS.find(e => e.id === id);
export const isEnchantId = (v: unknown): v is EnchantId => typeof v === 'string' && enchantDefinition(v) !== undefined;

/** Structural check for save validation: a real enchant on a kind it can legally bind to. */
export function validItemEnchant(enchant: unknown, kind: ItemKind): boolean {
  if (enchant === undefined) return true;
  const def = enchantDefinition(enchant as string);
  return def !== undefined && def.kinds.includes(kind);
}

/** Every kind that can carry a permanent enchant (panel target filtering). */
export const ENCHANTABLE_KINDS: readonly ItemKind[] = Object.freeze(['weapon', ...ARMOR]);
