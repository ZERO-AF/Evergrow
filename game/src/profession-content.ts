/** Profession definitions (docs/wow-deepening.md §3). Real WotLK names/data (wowhead.com/wotlk);
 * recipes are adapted only where a reagent has no source in this world (vials, coal, spices). */
import type { BiomeId } from './biomes.ts';
import type { ItemKind, ItemTier, StatModifiers } from './character-types.ts';
import type { DotSchool } from './wow-types.ts';

export type ProfessionId = 'herbalism' | 'mining' | 'skinning' | 'alchemy' | 'blacksmithing' | 'enchanting' | 'jewelcrafting' | 'engineering' | 'cooking';
export type ProfessionKind = 'gather' | 'craft';

/** Where a count-based material lives on the player: the owning profession's progress bag,
 * or the fishing bag. Bags are `progress.materials` — extra keys beside {level, xp}. */
export type MaterialBag = ProfessionId | 'fishing';
export type MaterialKind = 'herb' | 'ore' | 'stone' | 'bar' | 'leather' | 'meat' | 'fish' | 'essence' | 'gem' | 'part' | 'product';

/** Consumable/enchant use effect. `buff` rides the WowBuff pipeline (stats feed derived stats). */
export interface MaterialUse {
  /** Flat heal on use. */
  readonly heal?: number;
  /** Fraction of maxHp restored on use. */
  readonly healFraction?: number;
  readonly buff?: {
    readonly name: string;
    readonly color: string;
    readonly duration: number;
    readonly stats?: StatModifiers;
    /** Per-second resource ticks (mana potions). */
    readonly manaPerSecond?: number;
    readonly healPerSecond?: number;
    /** Absorb pool as a fraction of maxHp (WowBuff.absorb semantics). */
    readonly absorb?: number;
    /** 'wellFed' / 'elixir' / 'enchantScroll' / 'weaponImbue' groups replace same-group buffs. */
    readonly exclusiveGroup?: string;
  };
  /** Engineering bombs: a thrown AoE — flat damage per second for one second
   * (a single blast tick) plus an optional stun, applied to enemies in radius. */
  readonly blast?: { readonly damage: number; readonly radius: number; readonly stun?: number; readonly school?: DotSchool };
  /** Engineering repair bots: restore this much durability to every equipped slot. */
  readonly repair?: number;
}

export interface MaterialDef {
  readonly id: string;
  readonly name: string;
  readonly bag: MaterialBag;
  readonly kind: MaterialKind;
  readonly use?: MaterialUse;
}

export interface RecipeDef {
  readonly id: string;
  readonly name: string;
  /** Materials: material id → count. */
  readonly materials: Readonly<Record<string, number>>;
  /** Result material id, or a unique recipe id when `item` is set. */
  readonly result: string;
  readonly resultCount: number;
  /** Skill at which the recipe is learnable, then turns yellow → green → gray. */
  readonly skill: readonly [number, number, number, number];
  /** Gear recipes produce a real Item through generateItem; name/tier come from the recipe. */
  readonly item?: { readonly kind: ItemKind; readonly profileId?: string; readonly tier: ItemTier; readonly itemLevel: number };
}

export interface GatherNodeDef {
  readonly id: string;
  readonly name: string;
  readonly profession: ProfessionId;
  /** Skill to gather, then yellow → green → gray. */
  readonly skill: readonly [number, number, number, number];
  /** Biome affinity weights; absent = anywhere. */
  readonly biomes?: Partial<Record<BiomeId, number>>;
  /** Guaranteed yields (count may be a [min,max] range rolled per gather). */
  readonly yields: readonly { readonly id: string; readonly count: number | readonly [number, number] }[];
  /** Chance yields rolled independently (e.g. Swiftthistle off Mageroyal). */
  readonly bonus?: readonly { readonly id: string; readonly chance: number; readonly count: number }[];
  /** Zone-skill banded yields (skinning: leather/meat scale with beast level). */
  readonly bands?: readonly { readonly minZoneSkill: number; readonly yields: readonly { readonly id: string; readonly count: number | readonly [number, number] }[] }[];
}

export interface ProfessionDef {
  readonly id: ProfessionId;
  readonly name: string;
  readonly kind: ProfessionKind;
  /** Gather node ids this profession can harvest (gather only). */
  readonly nodes?: readonly string[];
  readonly recipes?: readonly RecipeDef[];
}

export const PROFESSION_RULES = Object.freeze({
  maxSkill: 450,
  /** XP needed for skill level → level+1. */
  xpForLevel: (level: number) => 20 + level,
  /** Skill-up XP by recipe/node difficulty. Gray never skill-ups. */
  xpByDifficulty: Object.freeze({ orange: 10, yellow: 7, green: 3, gray: 0 } as const),
  /** Skill-up chance by difficulty (WoW: orange always, green rarely, gray never). */
  chanceByDifficulty: Object.freeze({ orange: 1, yellow: .75, green: .3, gray: 0 } as const),
  /** Zone level → profession skill band (level 60 zone ≈ 450 skill). */
  zoneSkillFactor: 7.5,
});

export type SkillDifficulty = keyof typeof PROFESSION_RULES.xpByDifficulty;
/** WoW difficulty color: orange while below the yellow threshold, gray at/after the last. */
export function skillDifficulty(skill: readonly [number, number, number, number], level: number): SkillDifficulty {
  return level < skill[0] ? 'gray' : level < skill[1] ? 'orange' : level < skill[2] ? 'yellow' : level < skill[3] ? 'green' : 'gray';
}
export const DIFFICULTY_COLORS: Readonly<Record<SkillDifficulty, string>> = Object.freeze({
  orange: '#f09a4b', yellow: '#e8d44d', green: '#4da34d', gray: '#8a8a8a',
});

const mat = (id: string, name: string, bag: MaterialBag, kind: MaterialKind, use?: MaterialUse): Readonly<MaterialDef> =>
  Object.freeze(use ? { id, name, bag, kind, use } : { id, name, bag, kind });
const wellFed = (stats: StatModifiers, duration = 900): MaterialUse =>
  ({ buff: { name: 'Well Fed', color: '#e0b45a', duration, stats, exclusiveGroup: 'wellFed' } });
const elixir = (name: string, stats: StatModifiers, duration = 3600): MaterialUse =>
  ({ buff: { name, color: '#8ecbe0', duration, stats, exclusiveGroup: 'elixir' } });
const enchantScroll = (name: string, stats: StatModifiers, duration = 1800): MaterialUse =>
  ({ buff: { name, color: '#c9a0e8', duration, stats, exclusiveGroup: 'enchantScroll' } });

/** Every count-based material. `bag` is the profession progress that stores the count. */
export const PROFESSION_MATERIALS: Readonly<Record<string, Readonly<MaterialDef>>> = Object.freeze({
  // ── Herbalism ────────────────────────────────────────────────────────────
  peacebloom: mat('peacebloom', 'Peacebloom', 'herbalism', 'herb'),
  silverleaf: mat('silverleaf', 'Silverleaf', 'herbalism', 'herb'),
  earthroot: mat('earthroot', 'Earthroot', 'herbalism', 'herb'),
  mageroyal: mat('mageroyal', 'Mageroyal', 'herbalism', 'herb'),
  briarthorn: mat('briarthorn', 'Briarthorn', 'herbalism', 'herb'),
  swiftthistle: mat('swiftthistle', 'Swiftthistle', 'herbalism', 'herb'),
  kingsblood: mat('kingsblood', 'Kingsblood', 'herbalism', 'herb'),
  wildSteelbloom: mat('wildSteelbloom', 'Wild Steelbloom', 'herbalism', 'herb'),
  goldthorn: mat('goldthorn', 'Goldthorn', 'herbalism', 'herb'),
  sungrass: mat('sungrass', 'Sungrass', 'herbalism', 'herb'),
  // ── Mining ───────────────────────────────────────────────────────────────
  copperOre: mat('copperOre', 'Copper Ore', 'mining', 'ore'),
  roughStone: mat('roughStone', 'Rough Stone', 'mining', 'stone'),
  tinOre: mat('tinOre', 'Tin Ore', 'mining', 'ore'),
  coarseStone: mat('coarseStone', 'Coarse Stone', 'mining', 'stone'),
  silverOre: mat('silverOre', 'Silver Ore', 'mining', 'ore'),
  ironOre: mat('ironOre', 'Iron Ore', 'mining', 'ore'),
  heavyStone: mat('heavyStone', 'Heavy Stone', 'mining', 'stone'),
  goldOre: mat('goldOre', 'Gold Ore', 'mining', 'ore'),
  mithrilOre: mat('mithrilOre', 'Mithril Ore', 'mining', 'ore'),
  solidStone: mat('solidStone', 'Solid Stone', 'mining', 'stone'),
  thoriumOre: mat('thoriumOre', 'Thorium Ore', 'mining', 'ore'),
  denseStone: mat('denseStone', 'Dense Stone', 'mining', 'stone'),
  copperBar: mat('copperBar', 'Copper Bar', 'mining', 'bar'),
  bronzeBar: mat('bronzeBar', 'Bronze Bar', 'mining', 'bar'),
  silverBar: mat('silverBar', 'Silver Bar', 'mining', 'bar'),
  ironBar: mat('ironBar', 'Iron Bar', 'mining', 'bar'),
  steelBar: mat('steelBar', 'Steel Bar', 'mining', 'bar'),
  goldBar: mat('goldBar', 'Gold Bar', 'mining', 'bar'),
  mithrilBar: mat('mithrilBar', 'Mithril Bar', 'mining', 'bar'),
  thoriumBar: mat('thoriumBar', 'Thorium Bar', 'mining', 'bar'),
  // ── Skinning ─────────────────────────────────────────────────────────────
  lightLeather: mat('lightLeather', 'Light Leather', 'skinning', 'leather'),
  mediumLeather: mat('mediumLeather', 'Medium Leather', 'skinning', 'leather'),
  heavyLeather: mat('heavyLeather', 'Heavy Leather', 'skinning', 'leather'),
  thickLeather: mat('thickLeather', 'Thick Leather', 'skinning', 'leather'),
  ruggedLeather: mat('ruggedLeather', 'Rugged Leather', 'skinning', 'leather'),
  lightHide: mat('lightHide', 'Light Hide', 'skinning', 'leather'),
  mediumHide: mat('mediumHide', 'Medium Hide', 'skinning', 'leather'),
  heavyHide: mat('heavyHide', 'Heavy Hide', 'skinning', 'leather'),
  stringyWolfMeat: mat('stringyWolfMeat', 'Stringy Wolf Meat', 'skinning', 'meat'),
  boarMeat: mat('boarMeat', 'Boar Meat', 'skinning', 'meat'),
  crawlerMeat: mat('crawlerMeat', 'Crawler Meat', 'skinning', 'meat'),
  bearMeat: mat('bearMeat', 'Bear Meat', 'skinning', 'meat'),
  turtleMeat: mat('turtleMeat', 'Turtle Meat', 'skinning', 'meat'),
  tenderWolfMeat: mat('tenderWolfMeat', 'Tender Wolf Meat', 'skinning', 'meat'),
  // ── Fishing (bag owned by the fishing feature; ids shared with AgentFishing) ──
  slitherskinMackerel: mat('slitherskinMackerel', 'Raw Slitherskin Mackerel', 'fishing', 'fish'),
  longjawMudSnapper: mat('longjawMudSnapper', 'Raw Longjaw Mud Snapper', 'fishing', 'fish'),
  bristleWhiskerCatfish: mat('bristleWhiskerCatfish', 'Raw Bristle Whisker Catfish', 'fishing', 'fish'),
  deviateFish: mat('deviateFish', 'Deviate Fish', 'fishing', 'fish'),
  mightfish: mat('mightfish', 'Raw Mightfish', 'fishing', 'fish'),
  summerSquid: mat('summerSquid', 'Raw Summer Squid', 'fishing', 'fish'),
  // ── Enchanting (disenchant yields) ───────────────────────────────────────
  strangeDust: mat('strangeDust', 'Strange Dust', 'enchanting', 'essence'),
  lesserMagicEssence: mat('lesserMagicEssence', 'Lesser Magic Essence', 'enchanting', 'essence'),
  greaterMagicEssence: mat('greaterMagicEssence', 'Greater Magic Essence', 'enchanting', 'essence'),
  visionDust: mat('visionDust', 'Vision Dust', 'enchanting', 'essence'),
  lesserMysticEssence: mat('lesserMysticEssence', 'Lesser Mystic Essence', 'enchanting', 'essence'),
  dreamDust: mat('dreamDust', 'Dream Dust', 'enchanting', 'essence'),
  smallBrilliantShard: mat('smallBrilliantShard', 'Small Brilliant Shard', 'enchanting', 'essence'),
  largeBrilliantShard: mat('largeBrilliantShard', 'Large Brilliant Shard', 'enchanting', 'essence'),
  // ── Jewelcrafting (prospected raw gems; cut gems are real gem items) ──────
  rawScarletRuby: mat('rawScarletRuby', 'Raw Scarlet Ruby', 'jewelcrafting', 'gem'),
  rawCardinalRuby: mat('rawCardinalRuby', 'Raw Cardinal Ruby', 'jewelcrafting', 'gem'),
  rawAzureMoonstone: mat('rawAzureMoonstone', 'Raw Azure Moonstone', 'jewelcrafting', 'gem'),
  rawSkySapphire: mat('rawSkySapphire', 'Raw Sky Sapphire', 'jewelcrafting', 'gem'),
  rawKingsAmber: mat('rawKingsAmber', "Raw King's Amber", 'jewelcrafting', 'gem'),
  rawSunCrystal: mat('rawSunCrystal', 'Raw Sun Crystal', 'jewelcrafting', 'gem'),
  rawAutumnGlow: mat('rawAutumnGlow', "Raw Autumn's Glow", 'jewelcrafting', 'gem'),
  rawMonarchTopaz: mat('rawMonarchTopaz', 'Raw Monarch Topaz', 'jewelcrafting', 'gem'),
  rawTwilightOpal: mat('rawTwilightOpal', 'Raw Twilight Opal', 'jewelcrafting', 'gem'),
  rawForestEmerald: mat('rawForestEmerald', 'Raw Forest Emerald', 'jewelcrafting', 'gem'),
  rawNightmareTear: mat('rawNightmareTear', 'Raw Nightmare Tear', 'jewelcrafting', 'gem'),
  // ── Engineering (parts and gadgets; bombs blast, the repair bot mends gear) ──
  copperBolts: mat('copperBolts', 'Handful of Copper Bolts', 'engineering', 'part'),
  copperTube: mat('copperTube', 'Copper Tube', 'engineering', 'part'),
  whirringBronzeGizmo: mat('whirringBronzeGizmo', 'Whirring Bronze Gizmo', 'engineering', 'part'),
  bronzeTube: mat('bronzeTube', 'Bronze Tube', 'engineering', 'part'),
  unstableTrigger: mat('unstableTrigger', 'Unstable Trigger', 'engineering', 'part'),
  gyrochronatom: mat('gyrochronatom', 'Gyrochronatom', 'engineering', 'part'),
  fusedWiring: mat('fusedWiring', 'Fused Wiring', 'engineering', 'part'),
  roughCopperBomb: mat('roughCopperBomb', 'Rough Copper Bomb', 'engineering', 'product',
    { blast: { damage: 30, radius: 3, school: 'fire' } }),
  largeCopperBomb: mat('largeCopperBomb', 'Large Copper Bomb', 'engineering', 'product',
    { blast: { damage: 60, radius: 3.5, stun: 1, school: 'fire' } }),
  ironGrenade: mat('ironGrenade', 'Iron Grenade', 'engineering', 'product',
    { blast: { damage: 150, radius: 4, stun: 1.5, school: 'fire' } }),
  thoriumGrenade: mat('thoriumGrenade', 'Thorium Grenade', 'engineering', 'product',
    { blast: { damage: 400, radius: 4.5, stun: 2, school: 'fire' } }),
  fieldRepairBot: mat('fieldRepairBot', 'Field Repair Bot 74A', 'engineering', 'product', { repair: 100 }),
  // ── Alchemy products ─────────────────────────────────────────────────────
  minorHealingPotion: mat('minorHealingPotion', 'Minor Healing Potion', 'alchemy', 'product', { heal: 80 }),
  lesserHealingPotion: mat('lesserHealingPotion', 'Lesser Healing Potion', 'alchemy', 'product', { heal: 220 }),
  healingPotion: mat('healingPotion', 'Healing Potion', 'alchemy', 'product', { heal: 400 }),
  greaterHealingPotion: mat('greaterHealingPotion', 'Greater Healing Potion', 'alchemy', 'product', { heal: 650 }),
  superiorHealingPotion: mat('superiorHealingPotion', 'Superior Healing Potion', 'alchemy', 'product', { heal: 900 }),
  minorManaPotion: mat('minorManaPotion', 'Minor Mana Potion', 'alchemy', 'product', { buff: { name: 'Mana Surge', color: '#7ab8f0', duration: 10, manaPerSecond: .05 } }),
  lesserManaPotion: mat('lesserManaPotion', 'Lesser Mana Potion', 'alchemy', 'product', { buff: { name: 'Mana Surge', color: '#7ab8f0', duration: 10, manaPerSecond: .1 } }),
  manaPotion: mat('manaPotion', 'Mana Potion', 'alchemy', 'product', { buff: { name: 'Mana Surge', color: '#7ab8f0', duration: 10, manaPerSecond: .18 } }),
  elixirOfLionsStrength: mat('elixirOfLionsStrength', "Elixir of Lion's Strength", 'alchemy', 'product', elixir("Lion's Strength", { strength: 4 })),
  elixirOfMinorDefense: mat('elixirOfMinorDefense', 'Elixir of Minor Defense', 'alchemy', 'product', elixir('Minor Defense', { armor: 50 })),
  elixirOfMinorFortitude: mat('elixirOfMinorFortitude', 'Elixir of Minor Fortitude', 'alchemy', 'product', elixir('Minor Fortitude', { maxHp: 27 })),
  elixirOfWisdom: mat('elixirOfWisdom', 'Elixir of Wisdom', 'alchemy', 'product', elixir('Wisdom', { manaRegen: 6 })),
  elixirOfGiantGrowth: mat('elixirOfGiantGrowth', 'Elixir of Giant Growth', 'alchemy', 'product', elixir('Giant Growth', { strength: 8, damagePercent: 4 }, 1200)),
  elixirOfGreaterAgility: mat('elixirOfGreaterAgility', 'Elixir of Greater Agility', 'alchemy', 'product', elixir('Greater Agility', { dexterity: 15 })),
  elixirOfFortitude: mat('elixirOfFortitude', 'Elixir of Fortitude', 'alchemy', 'product', elixir('Fortitude', { maxHp: 120 })),
  swiftnessPotion: mat('swiftnessPotion', 'Swiftness Potion', 'alchemy', 'product', { buff: { name: 'Swiftness', color: '#f0e68c', duration: 15, stats: { moveSpeedPercent: 50 } } }),
  ragePotion: mat('ragePotion', 'Rage Potion', 'alchemy', 'product', { buff: { name: 'Rage', color: '#e06a4b', duration: 20, stats: { damagePercent: 15 } } }),
  // ── Blacksmithing products ───────────────────────────────────────────────
  roughSharpeningStone: mat('roughSharpeningStone', 'Rough Sharpening Stone', 'blacksmithing', 'product', { buff: { name: 'Sharpened', color: '#c8c8c8', duration: 1800, stats: { damagePercent: 3 }, exclusiveGroup: 'weaponStone' } }),
  coarseSharpeningStone: mat('coarseSharpeningStone', 'Coarse Sharpening Stone', 'blacksmithing', 'product', { buff: { name: 'Sharpened', color: '#c8c8c8', duration: 1800, stats: { damagePercent: 5 }, exclusiveGroup: 'weaponStone' } }),
  heavySharpeningStone: mat('heavySharpeningStone', 'Heavy Sharpening Stone', 'blacksmithing', 'product', { buff: { name: 'Sharpened', color: '#c8c8c8', duration: 1800, stats: { damagePercent: 8 }, exclusiveGroup: 'weaponStone' } }),
  roughGrindingStone: mat('roughGrindingStone', 'Rough Grinding Stone', 'blacksmithing', 'product'),
  coarseGrindingStone: mat('coarseGrindingStone', 'Coarse Grinding Stone', 'blacksmithing', 'product'),
  heavyGrindingStone: mat('heavyGrindingStone', 'Heavy Grinding Stone', 'blacksmithing', 'product'),
  solidGrindingStone: mat('solidGrindingStone', 'Solid Grinding Stone', 'blacksmithing', 'product'),
  denseGrindingStone: mat('denseGrindingStone', 'Dense Grinding Stone', 'blacksmithing', 'product'),
  // ── Enchanting products (armor enchants are timed scrolls; weapon enchants persist) ──
  enchantChestMinorHealth: mat('enchantChestMinorHealth', 'Enchant Chest - Minor Health', 'enchanting', 'product', enchantScroll('Minor Health', { maxHp: 25 })),
  enchantChestMinorAbsorb: mat('enchantChestMinorAbsorb', 'Enchant Chest - Minor Absorb', 'enchanting', 'product', { buff: { name: 'Minor Absorb', color: '#c9a0e8', duration: 1800, absorb: .02, exclusiveGroup: 'enchantScroll' } }),
  enchantCloakMinorResistance: mat('enchantCloakMinorResistance', 'Enchant Cloak - Minor Resistance', 'enchanting', 'product', enchantScroll('Minor Resistance', { allResistance: 3 })),
  enchantBracerMinorStamina: mat('enchantBracerMinorStamina', 'Enchant Bracer - Minor Stamina', 'enchanting', 'product', enchantScroll('Minor Stamina', { vitality: 3 })),
  enchantChestLesserHealth: mat('enchantChestLesserHealth', 'Enchant Chest - Lesser Health', 'enchanting', 'product', enchantScroll('Lesser Health', { maxHp: 50 })),
  enchantChestLesserAbsorb: mat('enchantChestLesserAbsorb', 'Enchant Chest - Lesser Absorb', 'enchanting', 'product', { buff: { name: 'Lesser Absorb', color: '#c9a0e8', duration: 1800, absorb: .05, exclusiveGroup: 'enchantScroll' } }),
  enchantBracerLesserStrength: mat('enchantBracerLesserStrength', 'Enchant Bracer - Lesser Strength', 'enchanting', 'product', enchantScroll('Lesser Strength', { strength: 5 })),
  enchantChestMajorHealth: mat('enchantChestMajorHealth', 'Enchant Chest - Major Health', 'enchanting', 'product', enchantScroll('Major Health', { maxHp: 100 })),
  enchantWeaponFiery: mat('enchantWeaponFiery', 'Enchant Weapon - Fiery', 'enchanting', 'product', { buff: { name: 'Fiery Weapon', color: '#f7995c', duration: 1800, stats: { damagePercent: 8 }, exclusiveGroup: 'weaponImbue' } }),
  enchantWeaponIcyChill: mat('enchantWeaponIcyChill', 'Enchant Weapon - Icy Chill', 'enchanting', 'product', { buff: { name: 'Icy Weapon', color: '#91d4ee', duration: 1800, stats: { damagePercent: 10 }, exclusiveGroup: 'weaponImbue' } }),
  // ── Cooking products ─────────────────────────────────────────────────────
  roastedBoarMeat: mat('roastedBoarMeat', 'Roasted Boar Meat', 'cooking', 'product', { heal: 60 }),
  charredWolfMeat: mat('charredWolfMeat', 'Charred Wolf Meat', 'cooking', 'product', { heal: 140 }),
  spicedWolfMeat: mat('spicedWolfMeat', 'Spiced Wolf Meat', 'cooking', 'product', wellFed({ vitality: 2 })),
  crabCake: mat('crabCake', 'Crab Cake', 'cooking', 'product', { heal: 240 }),
  cookedCrabClaw: mat('cookedCrabClaw', 'Cooked Crab Claw', 'cooking', 'product', { heal: 300 }),
  savoryDeviateDelight: mat('savoryDeviateDelight', 'Savory Deviate Delight', 'cooking', 'product', { buff: { name: 'Deviate Delight', color: '#d8a0e8', duration: 600, stats: { moveSpeedPercent: 10 }, exclusiveGroup: 'wellFed' } }),
  bearSteak: mat('bearSteak', 'Bear Steak', 'cooking', 'product', wellFed({ vitality: 4 })),
  turtleSoup: mat('turtleSoup', 'Turtle Soup', 'cooking', 'product', wellFed({ vitality: 6 })),
  soothingTurtleBisque: mat('soothingTurtleBisque', 'Soothing Turtle Bisque', 'cooking', 'product', wellFed({ vitality: 8, maxHp: 60 }, 1800)),
  tenderWolfSteak: mat('tenderWolfSteak', 'Tender Wolf Steak', 'cooking', 'product', wellFed({ vitality: 12, maxHp: 120 }, 1800)),
  mightfishSteak: mat('mightfishSteak', 'Mightfish Steak', 'cooking', 'product', wellFed({ vitality: 10 }, 1800)),
  grilledSquid: mat('grilledSquid', 'Grilled Squid', 'cooking', 'product', wellFed({ dexterity: 10 }, 1800)),
});
export function isMaterialId(v: unknown): v is string { return typeof v === 'string' && v in PROFESSION_MATERIALS; }

const node = (def: GatherNodeDef): Readonly<GatherNodeDef> => Object.freeze(def);
const y = (id: string, count: number | readonly [number, number]) => Object.freeze({ id, count });
const HERB_BIOMES: Partial<Record<BiomeId, number>> = { verdant: 3, autumn: 3, steppe: 2, swamp: 2, sunscar: 1, highlands: 1, deadwood: .5 };
const ORE_BIOMES: Partial<Record<BiomeId, number>> = { highlands: 3, frostpine: 2, emberfall: 2, sunscar: 2, steppe: 1.5, deadwood: 1, autumn: .5 };
const BEAST_BIOMES: Partial<Record<BiomeId, number>> = { steppe: 3, verdant: 2, autumn: 2, frostpine: 2, sunscar: 1.5, highlands: 1.5, deadwood: 1, swamp: 1 };

/** World gather nodes. Skill thresholds are the real WotLK gather requirements. */
export const GATHER_NODES: Readonly<Record<string, Readonly<GatherNodeDef>>> = Object.freeze({
  peacebloom: node({ id: 'peacebloom', name: 'Peacebloom', profession: 'herbalism', skill: [1, 25, 75, 115], biomes: HERB_BIOMES, yields: [y('peacebloom', [1, 3])] }),
  silverleaf: node({ id: 'silverleaf', name: 'Silverleaf', profession: 'herbalism', skill: [1, 25, 75, 115], biomes: HERB_BIOMES, yields: [y('silverleaf', [1, 3])] }),
  earthroot: node({ id: 'earthroot', name: 'Earthroot', profession: 'herbalism', skill: [15, 40, 90, 130], biomes: HERB_BIOMES, yields: [y('earthroot', [1, 3])] }),
  mageroyal: node({ id: 'mageroyal', name: 'Mageroyal', profession: 'herbalism', skill: [50, 75, 125, 165], biomes: HERB_BIOMES, yields: [y('mageroyal', [1, 3])], bonus: [Object.freeze({ id: 'swiftthistle', chance: .35, count: 1 }), Object.freeze({ id: 'briarthorn', chance: .25, count: 1 })] }),
  briarthorn: node({ id: 'briarthorn', name: 'Briarthorn', profession: 'herbalism', skill: [70, 95, 145, 185], biomes: HERB_BIOMES, yields: [y('briarthorn', [1, 3])], bonus: [Object.freeze({ id: 'swiftthistle', chance: .35, count: 1 })] }),
  kingsblood: node({ id: 'kingsblood', name: 'Kingsblood', profession: 'herbalism', skill: [125, 150, 200, 240], biomes: HERB_BIOMES, yields: [y('kingsblood', [1, 3])] }),
  wildSteelbloom: node({ id: 'wildSteelbloom', name: 'Wild Steelbloom', profession: 'herbalism', skill: [115, 140, 190, 230], biomes: { ...HERB_BIOMES, highlands: 3 }, yields: [y('wildSteelbloom', [1, 2])] }),
  goldthorn: node({ id: 'goldthorn', name: 'Goldthorn', profession: 'herbalism', skill: [150, 175, 225, 265], biomes: HERB_BIOMES, yields: [y('goldthorn', [1, 3])] }),
  sungrass: node({ id: 'sungrass', name: 'Sungrass', profession: 'herbalism', skill: [210, 235, 285, 325], biomes: { ...HERB_BIOMES, sunscar: 3 }, yields: [y('sungrass', [1, 3])] }),
  copperVein: node({ id: 'copperVein', name: 'Copper Vein', profession: 'mining', skill: [1, 25, 75, 115], biomes: ORE_BIOMES, yields: [y('copperOre', [2, 4]), y('roughStone', [1, 2])] }),
  tinVein: node({ id: 'tinVein', name: 'Tin Vein', profession: 'mining', skill: [65, 90, 140, 180], biomes: ORE_BIOMES, yields: [y('tinOre', [2, 4]), y('coarseStone', [1, 2])] }),
  silverVein: node({ id: 'silverVein', name: 'Silver Vein', profession: 'mining', skill: [75, 100, 150, 190], biomes: ORE_BIOMES, yields: [y('silverOre', [1, 3])] }),
  ironVein: node({ id: 'ironVein', name: 'Iron Vein', profession: 'mining', skill: [125, 150, 200, 240], biomes: ORE_BIOMES, yields: [y('ironOre', [2, 4]), y('heavyStone', [1, 2])] }),
  goldVein: node({ id: 'goldVein', name: 'Gold Vein', profession: 'mining', skill: [155, 180, 230, 270], biomes: ORE_BIOMES, yields: [y('goldOre', [1, 3])] }),
  mithrilVein: node({ id: 'mithrilVein', name: 'Mithril Deposit', profession: 'mining', skill: [175, 200, 250, 290], biomes: ORE_BIOMES, yields: [y('mithrilOre', [2, 4]), y('solidStone', [1, 2])] }),
  thoriumVein: node({ id: 'thoriumVein', name: 'Thorium Vein', profession: 'mining', skill: [250, 275, 325, 365], biomes: ORE_BIOMES, yields: [y('thoriumOre', [2, 4]), y('denseStone', [1, 2])] }),
  beastCorpse: node({
    id: 'beastCorpse', name: 'Beast Carcass', profession: 'skinning', skill: [1, 25, 75, 115], biomes: BEAST_BIOMES,
    yields: [],
    bands: [
      Object.freeze({ minZoneSkill: 0, yields: [y('lightLeather', [1, 3]), y('boarMeat', 1), y('stringyWolfMeat', 1)] }),
      Object.freeze({ minZoneSkill: 60, yields: [y('lightLeather', [1, 2]), y('mediumLeather', [1, 2]), y('crawlerMeat', 1), y('bearMeat', 1)] }),
      Object.freeze({ minZoneSkill: 140, yields: [y('mediumLeather', [1, 3]), y('heavyLeather', [1, 2]), y('bearMeat', 1), y('turtleMeat', 1)] }),
      Object.freeze({ minZoneSkill: 230, yields: [y('heavyLeather', [1, 3]), y('thickLeather', [1, 2]), y('turtleMeat', 1), y('tenderWolfMeat', 1)] }),
      Object.freeze({ minZoneSkill: 320, yields: [y('thickLeather', [1, 3]), y('ruggedLeather', [1, 2]), y('tenderWolfMeat', [1, 2])] }),
    ],
    bonus: [
      Object.freeze({ id: 'lightHide', chance: .3, count: 1 }),
      Object.freeze({ id: 'mediumHide', chance: .15, count: 1 }),
      Object.freeze({ id: 'heavyHide', chance: .08, count: 1 }),
    ],
  }),
});
export function isGatherNodeId(v: unknown): v is string { return typeof v === 'string' && v in GATHER_NODES; }

const recipe = (def: RecipeDef): Readonly<RecipeDef> => Object.freeze({ ...def, materials: Object.freeze({ ...def.materials }), item: def.item && Object.freeze({ ...def.item }) });
const gear = (kind: ItemKind, itemLevel: number, tier: ItemTier = 'common', profileId?: string): RecipeDef['item'] =>
  Object.freeze(profileId ? { kind, profileId, tier, itemLevel } : { kind, tier, itemLevel });

const ALCHEMY_RECIPES: readonly RecipeDef[] = Object.freeze([
  recipe({ id: 'minorHealingPotion', name: 'Minor Healing Potion', materials: { peacebloom: 1, silverleaf: 1 }, result: 'minorHealingPotion', resultCount: 1, skill: [1, 55, 85, 115] }),
  recipe({ id: 'elixirOfLionsStrength', name: "Elixir of Lion's Strength", materials: { earthroot: 1, silverleaf: 1 }, result: 'elixirOfLionsStrength', resultCount: 1, skill: [1, 55, 85, 115] }),
  recipe({ id: 'elixirOfMinorDefense', name: 'Elixir of Minor Defense', materials: { silverleaf: 2 }, result: 'elixirOfMinorDefense', resultCount: 1, skill: [1, 55, 85, 115] }),
  recipe({ id: 'lesserHealingPotion', name: 'Lesser Healing Potion', materials: { minorHealingPotion: 1, briarthorn: 1 }, result: 'lesserHealingPotion', resultCount: 1, skill: [55, 85, 115, 145] }),
  recipe({ id: 'elixirOfMinorFortitude', name: 'Elixir of Minor Fortitude', materials: { earthroot: 2, peacebloom: 1 }, result: 'elixirOfMinorFortitude', resultCount: 1, skill: [50, 80, 110, 140] }),
  recipe({ id: 'swiftnessPotion', name: 'Swiftness Potion', materials: { swiftthistle: 1, briarthorn: 1 }, result: 'swiftnessPotion', resultCount: 1, skill: [60, 90, 120, 150] }),
  recipe({ id: 'ragePotion', name: 'Rage Potion', materials: { briarthorn: 2 }, result: 'ragePotion', resultCount: 1, skill: [60, 90, 120, 150] }),
  recipe({ id: 'elixirOfWisdom', name: 'Elixir of Wisdom', materials: { mageroyal: 1, briarthorn: 2 }, result: 'elixirOfWisdom', resultCount: 1, skill: [90, 120, 150, 180] }),
  recipe({ id: 'minorManaPotion', name: 'Minor Mana Potion', materials: { mageroyal: 1, silverleaf: 1 }, result: 'minorManaPotion', resultCount: 1, skill: [65, 95, 125, 155] }),
  recipe({ id: 'healingPotion', name: 'Healing Potion', materials: { lesserHealingPotion: 1, briarthorn: 1 }, result: 'healingPotion', resultCount: 1, skill: [110, 140, 170, 200] }),
  recipe({ id: 'lesserManaPotion', name: 'Lesser Mana Potion', materials: { mageroyal: 1, briarthorn: 1 }, result: 'lesserManaPotion', resultCount: 1, skill: [120, 150, 180, 210] }),
  recipe({ id: 'elixirOfGiantGrowth', name: 'Elixir of Giant Growth', materials: { earthroot: 1, goldthorn: 1 }, result: 'elixirOfGiantGrowth', resultCount: 1, skill: [90, 120, 150, 180] }),
  recipe({ id: 'greaterHealingPotion', name: 'Greater Healing Potion', materials: { kingsblood: 1, wildSteelbloom: 1 }, result: 'greaterHealingPotion', resultCount: 1, skill: [155, 185, 215, 245] }),
  recipe({ id: 'manaPotion', name: 'Mana Potion', materials: { kingsblood: 1, briarthorn: 1 }, result: 'manaPotion', resultCount: 1, skill: [160, 190, 220, 250] }),
  recipe({ id: 'elixirOfGreaterAgility', name: 'Elixir of Greater Agility', materials: { goldthorn: 1, wildSteelbloom: 1 }, result: 'elixirOfGreaterAgility', resultCount: 1, skill: [185, 215, 245, 275] }),
  recipe({ id: 'elixirOfFortitude', name: 'Elixir of Fortitude', materials: { wildSteelbloom: 1, goldthorn: 1 }, result: 'elixirOfFortitude', resultCount: 1, skill: [175, 205, 235, 265] }),
  recipe({ id: 'superiorHealingPotion', name: 'Superior Healing Potion', materials: { sungrass: 2, kingsblood: 1 }, result: 'superiorHealingPotion', resultCount: 1, skill: [215, 245, 275, 305] }),
  // ── WotLK consumables: real pack items (consumable-content.ts), stackable to 20 ──
  recipe({ id: 'flaskEndlessRage', name: 'Flask of Endless Rage', materials: { goldthorn: 3, sungrass: 2 }, result: 'flaskEndlessRage', resultCount: 1, skill: [300, 330, 350, 370], item: gear('consumable', 80, 'common', 'flaskEndlessRage') }),
  recipe({ id: 'flaskFrostWyrm', name: 'Flask of the Frost Wyrm', materials: { sungrass: 3, goldthorn: 2 }, result: 'flaskFrostWyrm', resultCount: 1, skill: [300, 330, 350, 370], item: gear('consumable', 80, 'common', 'flaskFrostWyrm') }),
  recipe({ id: 'flaskStoneblood', name: 'Flask of Stoneblood', materials: { kingsblood: 3, sungrass: 2 }, result: 'flaskStoneblood', resultCount: 1, skill: [300, 330, 350, 370], item: gear('consumable', 80, 'common', 'flaskStoneblood') }),
  recipe({ id: 'flaskPureMojo', name: 'Flask of Pure Mojo', materials: { mageroyal: 3, sungrass: 2 }, result: 'flaskPureMojo', resultCount: 1, skill: [300, 330, 350, 370], item: gear('consumable', 80, 'common', 'flaskPureMojo') }),
  recipe({ id: 'elixirWrath', name: 'Elixir of Wrath', materials: { goldthorn: 2, kingsblood: 1 }, result: 'elixirWrath', resultCount: 2, skill: [250, 275, 295, 315], item: gear('consumable', 60, 'common', 'elixirWrath') }),
  recipe({ id: 'elixirDeadlyStrikes', name: 'Elixir of Deadly Strikes', materials: { goldthorn: 2, briarthorn: 1 }, result: 'elixirDeadlyStrikes', resultCount: 2, skill: [250, 275, 295, 315], item: gear('consumable', 60, 'common', 'elixirDeadlyStrikes') }),
  recipe({ id: 'elixirAccuracy', name: 'Elixir of Accuracy', materials: { sungrass: 2, wildSteelbloom: 1 }, result: 'elixirAccuracy', resultCount: 2, skill: [230, 255, 275, 295], item: gear('consumable', 55, 'common', 'elixirAccuracy') }),
  recipe({ id: 'elixirSpellpower', name: 'Elixir of Spellpower', materials: { sungrass: 2, goldthorn: 1 }, result: 'elixirSpellpower', resultCount: 2, skill: [250, 275, 295, 315], item: gear('consumable', 60, 'common', 'elixirSpellpower') }),
  recipe({ id: 'elixirMightyFortitude', name: 'Elixir of Mighty Fortitude', materials: { kingsblood: 2, earthroot: 1 }, result: 'elixirMightyFortitude', resultCount: 2, skill: [250, 275, 295, 315], item: gear('consumable', 60, 'common', 'elixirMightyFortitude') }),
  recipe({ id: 'elixirProtection', name: 'Elixir of Protection', materials: { wildSteelbloom: 2, kingsblood: 1 }, result: 'elixirProtection', resultCount: 2, skill: [250, 275, 295, 315], item: gear('consumable', 60, 'common', 'elixirProtection') }),
  recipe({ id: 'elixirMageblood', name: 'Elixir of Mighty Mageblood', materials: { mageroyal: 2, sungrass: 1 }, result: 'elixirMageblood', resultCount: 2, skill: [250, 275, 295, 315], item: gear('consumable', 60, 'common', 'elixirMageblood') }),
  recipe({ id: 'runicHealingPotion', name: 'Runic Healing Potion', materials: { goldthorn: 2, sungrass: 1 }, result: 'runicHealingPotion', resultCount: 2, skill: [300, 325, 345, 365], item: gear('consumable', 80, 'common', 'runicHealingPotion') }),
  recipe({ id: 'runicManaPotion', name: 'Runic Mana Potion', materials: { sungrass: 2, mageroyal: 1 }, result: 'runicManaPotion', resultCount: 2, skill: [300, 325, 345, 365], item: gear('consumable', 80, 'common', 'runicManaPotion') }),
  recipe({ id: 'potionOfSpeed', name: 'Potion of Speed', materials: { swiftthistle: 2, sungrass: 1 }, result: 'potionOfSpeed', resultCount: 2, skill: [300, 325, 345, 365], item: gear('consumable', 80, 'common', 'potionOfSpeed') }),
  recipe({ id: 'potionOfWildMagic', name: 'Potion of Wild Magic', materials: { sungrass: 2, goldthorn: 1 }, result: 'potionOfWildMagic', resultCount: 2, skill: [300, 325, 345, 365], item: gear('consumable', 80, 'common', 'potionOfWildMagic') }),
  recipe({ id: 'indestructiblePotion', name: 'Indestructible Potion', materials: { kingsblood: 2, wildSteelbloom: 1 }, result: 'indestructiblePotion', resultCount: 2, skill: [300, 325, 345, 365], item: gear('consumable', 80, 'common', 'indestructiblePotion') }),
]);

const BLACKSMITHING_RECIPES: readonly RecipeDef[] = Object.freeze([
  recipe({ id: 'roughSharpeningStone', name: 'Rough Sharpening Stone', materials: { roughStone: 1 }, result: 'roughSharpeningStone', resultCount: 1, skill: [1, 15, 35, 55] }),
  recipe({ id: 'roughGrindingStone', name: 'Rough Grinding Stone', materials: { roughStone: 2 }, result: 'roughGrindingStone', resultCount: 1, skill: [25, 45, 65, 85] }),
  recipe({ id: 'copperBracers', name: 'Copper Bracers', materials: { copperBar: 2 }, result: 'copperBracers', resultCount: 1, skill: [1, 20, 60, 80], item: gear('gloves', 4) }),
  recipe({ id: 'copperMace', name: 'Copper Mace', materials: { copperBar: 6 }, result: 'copperMace', resultCount: 1, skill: [15, 55, 75, 95], item: gear('weapon', 6, 'common', 'flanged-mace') }),
  recipe({ id: 'copperAxe', name: 'Copper Axe', materials: { copperBar: 6, roughStone: 1 }, result: 'copperAxe', resultCount: 1, skill: [20, 60, 80, 100], item: gear('weapon', 8, 'common', 'hand-axe') }),
  recipe({ id: 'copperChainBoots', name: 'Copper Chain Boots', materials: { copperBar: 4 }, result: 'copperChainBoots', resultCount: 1, skill: [20, 60, 80, 100], item: gear('boots', 7) }),
  recipe({ id: 'copperChainVest', name: 'Copper Chain Vest', materials: { copperBar: 8, roughGrindingStone: 2 }, result: 'copperChainVest', resultCount: 1, skill: [35, 75, 95, 115], item: gear('chest', 10) }),
  recipe({ id: 'copperShortsword', name: 'Copper Shortsword', materials: { copperBar: 6, roughGrindingStone: 1 }, result: 'copperShortsword', resultCount: 1, skill: [25, 65, 85, 105], item: gear('weapon', 9, 'common', 'longsword') }),
  recipe({ id: 'copperClaymore', name: 'Copper Claymore', materials: { copperBar: 10, roughGrindingStone: 2 }, result: 'copperClaymore', resultCount: 1, skill: [30, 70, 90, 110], item: gear('weapon', 11, 'common', 'greatblade') }),
  recipe({ id: 'runedCopperBelt', name: 'Runed Copper Belt', materials: { copperBar: 10 }, result: 'runedCopperBelt', resultCount: 1, skill: [40, 80, 100, 120], item: gear('legs', 12) }),
  recipe({ id: 'runedCopperBreastplate', name: 'Runed Copper Breastplate', materials: { copperBar: 12 }, result: 'runedCopperBreastplate', resultCount: 1, skill: [80, 120, 140, 160], item: gear('chest', 18, 'magic') }),
  recipe({ id: 'coarseSharpeningStone', name: 'Coarse Sharpening Stone', materials: { coarseStone: 1 }, result: 'coarseSharpeningStone', resultCount: 1, skill: [65, 85, 105, 125] }),
  recipe({ id: 'coarseGrindingStone', name: 'Coarse Grinding Stone', materials: { coarseStone: 2 }, result: 'coarseGrindingStone', resultCount: 1, skill: [75, 95, 115, 135] }),
  recipe({ id: 'roughBronzeBoots', name: 'Rough Bronze Boots', materials: { bronzeBar: 6, coarseGrindingStone: 1 }, result: 'roughBronzeBoots', resultCount: 1, skill: [95, 125, 145, 165], item: gear('boots', 17) }),
  recipe({ id: 'heavyCopperMaul', name: 'Heavy Copper Maul', materials: { copperBar: 12, lightLeather: 2 }, result: 'heavyCopperMaul', resultCount: 1, skill: [65, 105, 125, 145], item: gear('weapon', 16, 'common', 'grave-maul') }),
  recipe({ id: 'bronzeWarhammer', name: 'Bronze Warhammer', materials: { bronzeBar: 8, mediumLeather: 1 }, result: 'bronzeWarhammer', resultCount: 1, skill: [105, 135, 155, 175], item: gear('weapon', 22, 'common', 'grave-maul') }),
  recipe({ id: 'bronzeGreatsword', name: 'Bronze Greatsword', materials: { bronzeBar: 12, mediumLeather: 2 }, result: 'bronzeGreatsword', resultCount: 1, skill: [115, 145, 165, 185], item: gear('weapon', 24, 'common', 'greatblade') }),
  recipe({ id: 'heavySharpeningStone', name: 'Heavy Sharpening Stone', materials: { heavyStone: 1 }, result: 'heavySharpeningStone', resultCount: 1, skill: [125, 145, 165, 185] }),
  recipe({ id: 'heavyGrindingStone', name: 'Heavy Grinding Stone', materials: { heavyStone: 3 }, result: 'heavyGrindingStone', resultCount: 1, skill: [125, 145, 165, 185] }),
  recipe({ id: 'ironShortsword', name: 'Iron Shortsword', materials: { ironBar: 6, coarseGrindingStone: 2 }, result: 'ironShortsword', resultCount: 1, skill: [125, 155, 175, 195], item: gear('weapon', 26, 'common', 'longsword') }),
  recipe({ id: 'ironPlateBoots', name: 'Iron Plate Boots', materials: { ironBar: 8, heavyGrindingStone: 1 }, result: 'ironPlateBoots', resultCount: 1, skill: [145, 175, 195, 215], item: gear('boots', 30) }),
  recipe({ id: 'steelPlateHelm', name: 'Steel Plate Helm', materials: { steelBar: 8, solidGrindingStone: 1 }, result: 'steelPlateHelm', resultCount: 1, skill: [190, 220, 240, 260], item: gear('head', 40, 'magic') }),
  recipe({ id: 'solidGrindingStone', name: 'Solid Grinding Stone', materials: { solidStone: 4 }, result: 'solidGrindingStone', resultCount: 1, skill: [200, 220, 240, 260] }),
  recipe({ id: 'goldenScaleCuirass', name: 'Golden Scale Cuirass', materials: { goldBar: 8, heavyLeather: 2 }, result: 'goldenScaleCuirass', resultCount: 1, skill: [195, 225, 245, 265], item: gear('chest', 42, 'rare') }),
  recipe({ id: 'mithrilScaleBracers', name: 'Mithril Scale Bracers', materials: { mithrilBar: 8 }, result: 'mithrilScaleBracers', resultCount: 1, skill: [215, 245, 265, 285], item: gear('gloves', 44, 'magic') }),
  recipe({ id: 'mithrilCoif', name: 'Mithril Coif', materials: { mithrilBar: 10, solidGrindingStone: 2 }, result: 'mithrilCoif', resultCount: 1, skill: [230, 260, 280, 300], item: gear('head', 48, 'magic') }),
  recipe({ id: 'denseGrindingStone', name: 'Dense Grinding Stone', materials: { denseStone: 4 }, result: 'denseGrindingStone', resultCount: 1, skill: [250, 270, 290, 310] }),
  recipe({ id: 'thoriumBoots', name: 'Thorium Boots', materials: { thoriumBar: 12, ruggedLeather: 2 }, result: 'thoriumBoots', resultCount: 1, skill: [255, 285, 305, 325], item: gear('boots', 52, 'magic') }),
  recipe({ id: 'thoriumHelm', name: 'Thorium Helm', materials: { thoriumBar: 16 }, result: 'thoriumHelm', resultCount: 1, skill: [280, 310, 330, 350], item: gear('head', 56, 'rare') }),
  recipe({ id: 'imperialPlateChest', name: 'Imperial Plate Chest', materials: { thoriumBar: 20, ruggedLeather: 4 }, result: 'imperialPlateChest', resultCount: 1, skill: [300, 330, 350, 370], item: gear('chest', 60, 'rare') }),
]);

const ENCHANTING_RECIPES: readonly RecipeDef[] = Object.freeze([
  recipe({ id: 'enchantChestMinorHealth', name: 'Enchant Chest - Minor Health', materials: { strangeDust: 1 }, result: 'enchantChestMinorHealth', resultCount: 1, skill: [1, 20, 40, 60] }),
  recipe({ id: 'enchantChestMinorAbsorb', name: 'Enchant Chest - Minor Absorb', materials: { strangeDust: 2, lesserMagicEssence: 1 }, result: 'enchantChestMinorAbsorb', resultCount: 1, skill: [20, 40, 60, 80] }),
  recipe({ id: 'enchantCloakMinorResistance', name: 'Enchant Cloak - Minor Resistance', materials: { strangeDust: 1, lesserMagicEssence: 2 }, result: 'enchantCloakMinorResistance', resultCount: 1, skill: [45, 65, 85, 105] }),
  recipe({ id: 'lesserMagicWand', name: 'Lesser Magic Wand', materials: { lesserMagicEssence: 2, strangeDust: 1 }, result: 'lesserMagicWand', resultCount: 1, skill: [15, 45, 65, 85], item: gear('weapon', 8, 'magic', 'spark-wand') }),
  recipe({ id: 'enchantBracerMinorStamina', name: 'Enchant Bracer - Minor Stamina', materials: { strangeDust: 3 }, result: 'enchantBracerMinorStamina', resultCount: 1, skill: [50, 70, 90, 110] }),
  recipe({ id: 'enchantChestLesserHealth', name: 'Enchant Chest - Lesser Health', materials: { strangeDust: 2, lesserMagicEssence: 2 }, result: 'enchantChestLesserHealth', resultCount: 1, skill: [60, 80, 100, 120] }),
  recipe({ id: 'greaterMagicWand', name: 'Greater Magic Wand', materials: { greaterMagicEssence: 1, strangeDust: 3 }, result: 'greaterMagicWand', resultCount: 1, skill: [70, 100, 120, 140], item: gear('weapon', 18, 'magic', 'star-wand') }),
  recipe({ id: 'enchantChestLesserAbsorb', name: 'Enchant Chest - Lesser Absorb', materials: { strangeDust: 2, greaterMagicEssence: 1 }, result: 'enchantChestLesserAbsorb', resultCount: 1, skill: [80, 100, 120, 140] }),
  recipe({ id: 'enchantBracerLesserStrength', name: 'Enchant Bracer - Lesser Strength', materials: { visionDust: 2 }, result: 'enchantBracerLesserStrength', resultCount: 1, skill: [140, 165, 185, 205] }),
  recipe({ id: 'enchantChestMajorHealth', name: 'Enchant Chest - Major Health', materials: { visionDust: 3, lesserMysticEssence: 1 }, result: 'enchantChestMajorHealth', resultCount: 1, skill: [160, 185, 205, 225] }),
  recipe({ id: 'enchantWeaponFiery', name: 'Enchant Weapon - Fiery', materials: { smallBrilliantShard: 2, dreamDust: 4 }, result: 'enchantWeaponFiery', resultCount: 1, skill: [265, 285, 305, 325] }),
  recipe({ id: 'enchantWeaponIcyChill', name: 'Enchant Weapon - Icy Chill', materials: { smallBrilliantShard: 2, lesserMysticEssence: 2, dreamDust: 2 }, result: 'enchantWeaponIcyChill', resultCount: 1, skill: [285, 305, 325, 345] }),
]);

const COOKING_RECIPES: readonly RecipeDef[] = Object.freeze([
  recipe({ id: 'roastedBoarMeat', name: 'Roasted Boar Meat', materials: { boarMeat: 1 }, result: 'roastedBoarMeat', resultCount: 1, skill: [1, 45, 65, 85] }),
  recipe({ id: 'charredWolfMeat', name: 'Charred Wolf Meat', materials: { stringyWolfMeat: 1 }, result: 'charredWolfMeat', resultCount: 1, skill: [1, 45, 65, 85] }),
  recipe({ id: 'spicedWolfMeat', name: 'Spiced Wolf Meat', materials: { stringyWolfMeat: 2 }, result: 'spicedWolfMeat', resultCount: 1, skill: [10, 50, 70, 90] }),
  recipe({ id: 'crabCake', name: 'Crab Cake', materials: { crawlerMeat: 1 }, result: 'crabCake', resultCount: 1, skill: [75, 115, 135, 155] }),
  recipe({ id: 'cookedCrabClaw', name: 'Cooked Crab Claw', materials: { crawlerMeat: 2 }, result: 'cookedCrabClaw', resultCount: 1, skill: [85, 125, 145, 165] }),
  recipe({ id: 'savoryDeviateDelight', name: 'Savory Deviate Delight', materials: { deviateFish: 1 }, result: 'savoryDeviateDelight', resultCount: 1, skill: [85, 125, 145, 165] }),
  recipe({ id: 'bearSteak', name: 'Bear Steak', materials: { bearMeat: 1 }, result: 'bearSteak', resultCount: 1, skill: [110, 150, 170, 190] }),
  recipe({ id: 'turtleSoup', name: 'Turtle Soup', materials: { turtleMeat: 1 }, result: 'turtleSoup', resultCount: 1, skill: [175, 215, 235, 255] }),
  recipe({ id: 'soothingTurtleBisque', name: 'Soothing Turtle Bisque', materials: { turtleMeat: 2 }, result: 'soothingTurtleBisque', resultCount: 1, skill: [175, 215, 235, 255] }),
  recipe({ id: 'tenderWolfSteak', name: 'Tender Wolf Steak', materials: { tenderWolfMeat: 1 }, result: 'tenderWolfSteak', resultCount: 1, skill: [225, 265, 285, 305] }),
  recipe({ id: 'mightfishSteak', name: 'Mightfish Steak', materials: { mightfish: 1 }, result: 'mightfishSteak', resultCount: 1, skill: [275, 315, 335, 355] }),
  recipe({ id: 'grilledSquid', name: 'Grilled Squid', materials: { summerSquid: 1 }, result: 'grilledSquid', resultCount: 1, skill: [250, 290, 310, 330] }),
  // ── WotLK consumables: real pack items (consumable-content.ts), stackable to 20 ──
  recipe({ id: 'fishFeast', name: 'Fish Feast', materials: { mightfish: 2, summerSquid: 2, bristleWhiskerCatfish: 1 }, result: 'fishFeast', resultCount: 2, skill: [300, 330, 350, 370], item: gear('consumable', 80, 'common', 'fishFeast') }),
  recipe({ id: 'dragonfinFilet', name: 'Dragonfin Filet', materials: { mightfish: 1, boarMeat: 1 }, result: 'dragonfinFilet', resultCount: 2, skill: [280, 310, 330, 350], item: gear('consumable', 75, 'common', 'dragonfinFilet') }),
  recipe({ id: 'spicedWyrmBurger', name: 'Spiced Wyrm Burger', materials: { tenderWolfMeat: 2, bearMeat: 1 }, result: 'spicedWyrmBurger', resultCount: 2, skill: [280, 310, 330, 350], item: gear('consumable', 75, 'common', 'spicedWyrmBurger') }),
  recipe({ id: 'tenderShoveltuskSteak', name: 'Tender Shoveltusk Steak', materials: { tenderWolfMeat: 2 }, result: 'tenderShoveltuskSteak', resultCount: 2, skill: [260, 290, 310, 330], item: gear('consumable', 70, 'common', 'tenderShoveltuskSteak') }),
  recipe({ id: 'firecrackerSalmon', name: 'Firecracker Salmon', materials: { summerSquid: 2, mightfish: 1 }, result: 'firecrackerSalmon', resultCount: 2, skill: [260, 290, 310, 330], item: gear('consumable', 70, 'common', 'firecrackerSalmon') }),
]);

/** Mining keeps its real WotLK smelting recipes alongside its gather nodes. */
const MINING_RECIPES: readonly RecipeDef[] = Object.freeze([
  recipe({ id: 'smeltCopper', name: 'Smelt Copper', materials: { copperOre: 1 }, result: 'copperBar', resultCount: 1, skill: [1, 25, 47, 70] }),
  recipe({ id: 'smeltBronze', name: 'Smelt Bronze', materials: { copperOre: 1, tinOre: 1 }, result: 'bronzeBar', resultCount: 2, skill: [65, 90, 115, 140] }),
  recipe({ id: 'smeltSilver', name: 'Smelt Silver', materials: { silverOre: 1 }, result: 'silverBar', resultCount: 1, skill: [75, 100, 125, 150] }),
  recipe({ id: 'smeltIron', name: 'Smelt Iron', materials: { ironOre: 1 }, result: 'ironBar', resultCount: 1, skill: [125, 150, 175, 200] }),
  recipe({ id: 'smeltGold', name: 'Smelt Gold', materials: { goldOre: 1 }, result: 'goldBar', resultCount: 1, skill: [155, 180, 205, 230] }),
  recipe({ id: 'smeltSteel', name: 'Smelt Steel', materials: { ironBar: 1, heavyStone: 1 }, result: 'steelBar', resultCount: 1, skill: [165, 190, 215, 240] }),
  recipe({ id: 'smeltMithril', name: 'Smelt Mithril', materials: { mithrilOre: 1 }, result: 'mithrilBar', resultCount: 1, skill: [175, 200, 225, 250] }),
  recipe({ id: 'smeltThorium', name: 'Smelt Thorium', materials: { thoriumOre: 1 }, result: 'thoriumBar', resultCount: 1, skill: [250, 275, 300, 325] }),
]);

/** Jewelcrafting: prospect ore into raw gems, then cut them into socketable gem
 * items (gem-content.ts). Cut recipes carry the gem id as item.profileId — the
 * craft command builds them with createGem, not generateItem. */
const JEWELCRAFTING_RECIPES: readonly RecipeDef[] = Object.freeze([
  // ── Prospecting (5 ore → 1 raw gem; WoW prospecting yields) ──
  recipe({ id: 'prospectCopperMalachite', name: 'Prospect Copper (Sun Crystal)', materials: { copperOre: 5 }, result: 'rawSunCrystal', resultCount: 1, skill: [20, 50, 70, 90] }),
  recipe({ id: 'prospectCopperMoonstone', name: 'Prospect Copper (Moonstone)', materials: { copperOre: 5 }, result: 'rawAzureMoonstone', resultCount: 1, skill: [20, 50, 70, 90] }),
  recipe({ id: 'prospectTinTopaz', name: 'Prospect Tin (Monarch Topaz)', materials: { tinOre: 5 }, result: 'rawMonarchTopaz', resultCount: 1, skill: [50, 80, 100, 120] }),
  recipe({ id: 'prospectTinOpal', name: 'Prospect Tin (Twilight Opal)', materials: { tinOre: 5 }, result: 'rawTwilightOpal', resultCount: 1, skill: [50, 80, 100, 120] }),
  recipe({ id: 'prospectIronRuby', name: 'Prospect Iron (Scarlet Ruby)', materials: { ironOre: 5 }, result: 'rawScarletRuby', resultCount: 1, skill: [125, 155, 175, 195] }),
  recipe({ id: 'prospectIronAmber', name: "Prospect Iron (King's Amber)", materials: { ironOre: 5 }, result: 'rawKingsAmber', resultCount: 1, skill: [125, 155, 175, 195] }),
  recipe({ id: 'prospectMithrilSapphire', name: 'Prospect Mithril (Sky Sapphire)', materials: { mithrilOre: 5 }, result: 'rawSkySapphire', resultCount: 1, skill: [175, 205, 225, 245] }),
  recipe({ id: 'prospectMithrilGlow', name: "Prospect Mithril (Autumn's Glow)", materials: { mithrilOre: 5 }, result: 'rawAutumnGlow', resultCount: 1, skill: [175, 205, 225, 245] }),
  recipe({ id: 'prospectThoriumRuby', name: 'Prospect Thorium (Cardinal Ruby)', materials: { thoriumOre: 5 }, result: 'rawCardinalRuby', resultCount: 1, skill: [250, 280, 300, 320] }),
  recipe({ id: 'prospectThoriumEmerald', name: 'Prospect Thorium (Forest Emerald)', materials: { thoriumOre: 5 }, result: 'rawForestEmerald', resultCount: 1, skill: [250, 280, 300, 320] }),
  recipe({ id: 'prospectThoriumTear', name: 'Prospect Thorium (Nightmare Tear)', materials: { thoriumOre: 5, denseStone: 2 }, result: 'rawNightmareTear', resultCount: 1, skill: [300, 330, 350, 370] }),
  // ── Cuts (raw gem → socketable gem item; itemLevel scales the stats) ──
  recipe({ id: 'cutSunCrystal', name: 'Smooth Sun Crystal', materials: { rawSunCrystal: 1 }, result: 'cutSunCrystal', resultCount: 1, skill: [30, 60, 80, 100], item: gear('amulet', 20, 'rare', 'smooth-sun-crystal') }),
  recipe({ id: 'cutAzureMoonstone', name: 'Solid Azure Moonstone', materials: { rawAzureMoonstone: 1 }, result: 'cutAzureMoonstone', resultCount: 1, skill: [30, 60, 80, 100], item: gear('amulet', 20, 'rare', 'solid-azure-moonstone') }),
  recipe({ id: 'cutMonarchTopaz', name: 'Etched Monarch Topaz', materials: { rawMonarchTopaz: 1 }, result: 'cutMonarchTopaz', resultCount: 1, skill: [60, 90, 110, 130], item: gear('amulet', 30, 'rare', 'etched-monarch-topaz') }),
  recipe({ id: 'cutTwilightOpal', name: 'Purified Twilight Opal', materials: { rawTwilightOpal: 1 }, result: 'cutTwilightOpal', resultCount: 1, skill: [60, 90, 110, 130], item: gear('amulet', 30, 'rare', 'purified-twilight-opal') }),
  recipe({ id: 'cutScarletRuby', name: 'Bold Scarlet Ruby', materials: { rawScarletRuby: 1 }, result: 'cutScarletRuby', resultCount: 1, skill: [135, 165, 185, 205], item: gear('amulet', 40, 'rare', 'bold-scarlet-ruby') }),
  recipe({ id: 'cutKingsAmber', name: "Brilliant King's Amber", materials: { rawKingsAmber: 1 }, result: 'cutKingsAmber', resultCount: 1, skill: [135, 165, 185, 205], item: gear('amulet', 40, 'rare', 'brilliant-kings-amber') }),
  recipe({ id: 'cutSkySapphire', name: 'Lustrous Sky Sapphire', materials: { rawSkySapphire: 1 }, result: 'cutSkySapphire', resultCount: 1, skill: [185, 215, 235, 255], item: gear('amulet', 50, 'rare', 'lustrous-skysapphire') }),
  recipe({ id: 'cutAutumnGlow', name: "Quick Autumn's Glow", materials: { rawAutumnGlow: 1 }, result: 'cutAutumnGlow', resultCount: 1, skill: [185, 215, 235, 255], item: gear('amulet', 50, 'rare', 'quick-autumn-glow') }),
  recipe({ id: 'cutCardinalRuby', name: 'Bright Cardinal Ruby', materials: { rawCardinalRuby: 1 }, result: 'cutCardinalRuby', resultCount: 1, skill: [260, 290, 310, 330], item: gear('amulet', 60, 'rare', 'bright-cardinal-ruby') }),
  recipe({ id: 'cutForestEmerald', name: 'Jagged Forest Emerald', materials: { rawForestEmerald: 1 }, result: 'cutForestEmerald', resultCount: 1, skill: [260, 290, 310, 330], item: gear('amulet', 60, 'rare', 'jagged-forest-emerald') }),
  recipe({ id: 'cutNightmareTear', name: 'Nightmare Tear', materials: { rawNightmareTear: 1 }, result: 'cutNightmareTear', resultCount: 1, skill: [310, 340, 360, 380], item: gear('amulet', 70, 'rare', 'nightmare-tear') }),
]);

/** Engineering: machined parts from mining materials, then gadgets — thrown
 * bombs (MaterialUse.blast), a field repair bot (MaterialUse.repair) and
 * stat-bearing goggles (real head items through generateItem). */
const ENGINEERING_RECIPES: readonly RecipeDef[] = Object.freeze([
  recipe({ id: 'copperBolts', name: 'Handful of Copper Bolts', materials: { copperBar: 1 }, result: 'copperBolts', resultCount: 2, skill: [30, 60, 80, 100] }),
  recipe({ id: 'copperTube', name: 'Copper Tube', materials: { copperBar: 2 }, result: 'copperTube', resultCount: 1, skill: [50, 80, 100, 120] }),
  recipe({ id: 'roughCopperBomb', name: 'Rough Copper Bomb', materials: { copperBolts: 2, roughStone: 2 }, result: 'roughCopperBomb', resultCount: 2, skill: [30, 60, 80, 100] }),
  recipe({ id: 'flyingTigerGoggles', name: 'Flying Tiger Goggles', materials: { copperTube: 2, lightLeather: 2 }, result: 'flyingTigerGoggles', resultCount: 1, skill: [100, 130, 150, 170], item: gear('head', 20, 'magic') }),
  recipe({ id: 'whirringBronzeGizmo', name: 'Whirring Bronze Gizmo', materials: { bronzeBar: 2, coarseStone: 1 }, result: 'whirringBronzeGizmo', resultCount: 1, skill: [115, 145, 165, 185] }),
  recipe({ id: 'bronzeTube', name: 'Bronze Tube', materials: { bronzeBar: 2 }, result: 'bronzeTube', resultCount: 1, skill: [105, 135, 155, 175] }),
  recipe({ id: 'largeCopperBomb', name: 'Large Copper Bomb', materials: { copperBolts: 4, coarseStone: 2, copperBar: 1 }, result: 'largeCopperBomb', resultCount: 2, skill: [105, 135, 155, 175] }),
  recipe({ id: 'unstableTrigger', name: 'Unstable Trigger', materials: { bronzeBar: 1, coarseStone: 1 }, result: 'unstableTrigger', resultCount: 1, skill: [125, 155, 175, 195] }),
  recipe({ id: 'greenTintedGoggles', name: 'Green Tinted Goggles', materials: { bronzeTube: 2, whirringBronzeGizmo: 2, mediumLeather: 2 }, result: 'greenTintedGoggles', resultCount: 1, skill: [150, 180, 200, 220], item: gear('head', 32, 'magic') }),
  recipe({ id: 'ironGrenade', name: 'Iron Grenade', materials: { ironBar: 2, heavyStone: 2, unstableTrigger: 1 }, result: 'ironGrenade', resultCount: 2, skill: [175, 205, 225, 245] }),
  recipe({ id: 'gyrochronatom', name: 'Gyrochronatom', materials: { ironBar: 1, goldBar: 1 }, result: 'gyrochronatom', resultCount: 1, skill: [170, 200, 220, 240] }),
  recipe({ id: 'spellpowerGogglesXtreme', name: 'Spellpower Goggles Xtreme', materials: { gyrochronatom: 2, bronzeTube: 2, heavyLeather: 2 }, result: 'spellpowerGogglesXtreme', resultCount: 1, skill: [215, 245, 265, 285], item: gear('head', 46, 'rare') }),
  recipe({ id: 'fusedWiring', name: 'Fused Wiring', materials: { copperBar: 3, mithrilBar: 1 }, result: 'fusedWiring', resultCount: 1, skill: [275, 295, 315, 335] }),
  recipe({ id: 'thoriumGrenade', name: 'Thorium Grenade', materials: { thoriumBar: 3, denseStone: 3, unstableTrigger: 1 }, result: 'thoriumGrenade', resultCount: 2, skill: [260, 290, 310, 330] }),
  recipe({ id: 'fieldRepairBot', name: 'Field Repair Bot 74A', materials: { thoriumBar: 8, fusedWiring: 2, gyrochronatom: 1, ruggedLeather: 2 }, result: 'fieldRepairBot', resultCount: 1, skill: [300, 330, 350, 370] }),
  recipe({ id: 'ultraSpectropicGoggles', name: 'Ultra-Spectropic Detection Goggles', materials: { thoriumBar: 8, fusedWiring: 2, gyrochronatom: 2 }, result: 'ultraSpectropicGoggles', resultCount: 1, skill: [300, 330, 350, 370], item: gear('head', 58, 'rare') }),
]);

export const PROFESSIONS: Readonly<Record<ProfessionId, ProfessionDef>> = Object.freeze({
  herbalism: Object.freeze({ id: 'herbalism', name: 'Herbalism', kind: 'gather', nodes: Object.freeze(['peacebloom', 'silverleaf', 'earthroot', 'mageroyal', 'briarthorn', 'kingsblood', 'wildSteelbloom', 'goldthorn', 'sungrass']) }),
  mining: Object.freeze({ id: 'mining', name: 'Mining', kind: 'gather', nodes: Object.freeze(['copperVein', 'tinVein', 'silverVein', 'ironVein', 'goldVein', 'mithrilVein', 'thoriumVein']), recipes: MINING_RECIPES }),
  skinning: Object.freeze({ id: 'skinning', name: 'Skinning', kind: 'gather', nodes: Object.freeze(['beastCorpse']) }),
  alchemy: Object.freeze({ id: 'alchemy', name: 'Alchemy', kind: 'craft', recipes: ALCHEMY_RECIPES }),
  blacksmithing: Object.freeze({ id: 'blacksmithing', name: 'Blacksmithing', kind: 'craft', recipes: BLACKSMITHING_RECIPES }),
  enchanting: Object.freeze({ id: 'enchanting', name: 'Enchanting', kind: 'craft', recipes: ENCHANTING_RECIPES }),
  jewelcrafting: Object.freeze({ id: 'jewelcrafting', name: 'Jewelcrafting', kind: 'craft', recipes: JEWELCRAFTING_RECIPES }),
  engineering: Object.freeze({ id: 'engineering', name: 'Engineering', kind: 'craft', recipes: ENGINEERING_RECIPES }),
  cooking: Object.freeze({ id: 'cooking', name: 'Cooking', kind: 'craft', recipes: COOKING_RECIPES }),
});
export const PROFESSION_IDS: readonly ProfessionId[] = Object.freeze(Object.keys(PROFESSIONS) as ProfessionId[]);
export function isProfessionId(v: unknown): v is ProfessionId { return typeof v === 'string' && v in PROFESSIONS; }

/** Recipe lookup across every profession (panel + command share it). */
export function findRecipe(id: string): { profession: ProfessionId; recipe: RecipeDef } | null {
  for (const profession of PROFESSION_IDS)
    for (const recipe of PROFESSIONS[profession].recipes ?? [])
      if (recipe.id === id) return { profession, recipe };
  return null;
}
