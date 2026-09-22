import { createRiftKey } from './rift-content.ts';
import { UNIQUES, uniqueDefinition, UNIQUE_SYMBOL, UNIQUE_COLOR } from './unique-content.ts';
import { itemRollMultiplier, hasGreaterAffix, GREATER_AFFIX_SYMBOL } from './item-roll-content.ts';
import { isOffensiveAttribute, offensiveAttributeImplicitScale } from './attribute-content.ts';
import { manaImplicitScale } from './mana-content.ts';
import { CHARM_DROP_CHANCE, CHARM_PROFILES, CHARM_SIZES, CHARM_FLAVORS, CHARM_UTILITY_AFFIXES, CHARM_WEIGHTS, charmProfile, charmAffixCount, charmThematicStat } from './charm-content.ts';
import { RESISTANCE_AFFIXES, RESISTANCE_LABELS, RESISTANCE_STATS, isResistanceStat, boundResistanceRoll } from './resistance-content.ts';
import { JEWELRY_PROFILES, jewelryProfiles } from './jewelry-content.ts';
import { ITEM_MATERIALS, isClothMaterial, sourceMaterialPool, type MaterialSource, itemMaterialPool, rollItemMaterial, itemMaterialScale, materialBaseName, type ItemMaterialId } from './item-materials.ts';
import { SPECIAL_AFFIXES, SPECIAL_AFFIX_LABELS, SKILL_AFFIXES, SKILL_STATS, isSkillStat, skillAffixPool, discreteAffixValue, type AffixDefinition } from './equipment-affix-content.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { ELEMENTAL_AFFIXES, ELEMENT_COLORS, isElementalAffix, meleeEnchantment } from './elemental-weapon.ts';
import { createRaceLook, type CharacterLook } from './character-look.ts';
import { cloneData } from './data-clone.ts';
import { WOW_CLASSES } from './wow-classes.ts';
import { isWowClassId, isWowRaceId, type WowClassId, type WowRaceId } from './wow-types.ts';
import { FOCUS_PROFILES } from './focus-content.ts';
import { STARTING_SWORD } from './equipment.ts';
import { SHIELD_PROFILES, WEAPON_PROFILES } from './weapon-content.ts';
import { itemAffixGrowthLevel, itemPercentageScale, itemPowerScale, normalizeLevel } from './progression-content.ts';
import { generateWowName, legendaryFor, WOW_LEGENDARIES } from './item-naming.ts';
import { LEGENDARY_PROCS, legendaryProcsFor } from './legendary-content.ts';
import { createConsumableItem, isConsumableId } from './consumable-content.ts';
import { BAR_TOTAL } from './action-bar.ts';
import type { CharacterSheet, EquipmentSlot, Item, ItemAffix, ItemKind, ItemTier, SkillId, StatKey, StatModifiers } from './character-types.ts';
import { isGemId, rollSockets, socketedModifiers } from './gem-content.ts';
import { enchantDefinition } from './enchant-content.ts';
import { GAME_FEATURES } from './game-features.ts';
import { setPiecesFor, setPiece, setPieceSet, SET_PIECE_PREFIX, SET_PIECE_ROLL, type SetPieceDef, type SetPieceId } from './item-set-content.ts';

export const INVENTORY_CAPACITY = 120;

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = Object.freeze([
  'weapon', 'offhand', 'head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'amulet', 'ring1', 'ring2',
]);
export const ITEM_KINDS: readonly ItemKind[] = Object.freeze(['weapon', 'shield', 'grimoire', 'orb', 'relic', 'head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'amulet', 'ring', 'charm', 'consumable']);
/** Classes that may equip a relic (totem/libram/idol/sigil) in the offhand slot. */
export const RELIC_CLASSES: readonly WowClassId[] = Object.freeze(['shaman', 'paladin', 'druid', 'deathKnight']);
/** Classes trained to equip shields in the offhand (WoW proficiency). */
export const SHIELD_CLASSES: readonly WowClassId[] = Object.freeze(['warrior', 'paladin', 'shaman']);
export const TIER_COLORS: Readonly<Record<ItemTier, string>> = Object.freeze({
  common: '#c5ccc8', magic: '#4fd35c', rare: '#5e9de0', epic: '#b895ef', legendary: '#f0a16b', unique: UNIQUE_COLOR,
});
/** Display labels only: the 'magic' enum key renders as WoW's Uncommon tier. */
export const TIER_NAMES: Readonly<Record<ItemTier, string>> = Object.freeze({
  common: 'Common', magic: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', unique: 'Unique',
});
export const STAT_LABELS: Readonly<Record<StatKey, string>> = Object.freeze({
  ...SPECIAL_AFFIX_LABELS, ...SKILL_STATS, ...RESISTANCE_LABELS, goldFindPercent: 'Gold found', xpGainPercent: 'Experience gained',
  fireDamage: 'Added fire damage', frostDamage: 'Added frost damage', lightningDamage: 'Added lightning damage',
  strength: 'Strength', dexterity: 'Dexterity', intelligence: 'Intelligence', vitality: 'Vitality',
  maxHp: 'Maximum life', maxHpPercent: 'Maximum life %', maxMana: 'Maximum mana', armor: 'Armor', armorPercent: 'Armor %', damagePercent: 'Attack damage',
  attackSpeedPercent: 'Attack speed', castSpeedPercent: 'Cast speed', critChance: 'Critical chance', critDamage: 'Critical damage',
  moveSpeedPercent: 'Movement speed', spellDamagePercent: 'Spell damage', manaRegen: 'Mana / 5 sec',
  lifeRegen: 'Life / sec', manaCostPercent: 'Mana cost reduction', cooldownPercent: 'Cooldown reduction', lifeOnHit: 'Life on hit',
  blockChance: 'Block chance', blockReduction: 'Blocked damage reduction',
  hitRating: 'Hit rating', expertise: 'Expertise',
});
export const PERCENT_STATS = new Set<StatKey>(['goldFindPercent', 'xpGainPercent', ...RESISTANCE_STATS, 'areaPercent', 'potionPercent', 'spellweavePercent', 'afterguardPercent', 'damagePercent', 'attackSpeedPercent', 'castSpeedPercent', 'critChance', 'critDamage', 'moveSpeedPercent', 'spellDamagePercent', 'cooldownPercent', 'manaCostPercent', 'blockChance', 'blockReduction', 'armorPercent']);
export function formatStatValue(stat: StatKey, value: number): string {
  return `${value > 0 ? '+' : ''}${Number(value.toFixed(1))}${PERCENT_STATS.has(stat) ? '%' : ''}`;
}

export function itemModifiers(item: Item): StatModifiers {
  const modifiers: StatModifiers = { ...item.implicit };
  for (const affix of item.affixes) modifiers[affix.stat] = (modifiers[affix.stat] ?? 0) + affix.value;
  return modifiers;
}

export { randomSource } from './random-source.ts';
import { randomSource } from './random-source.ts';
const BASE_NAMES: Readonly<Record<Exclude<ItemKind, 'weapon' | 'shield' | 'grimoire' | 'orb'>, readonly string[]>> = {
  consumable: ['Consumable'],
  riftKey: ['Crimson Rift Key'],
  head: ['Crown Helm', 'Watcher Hood', 'Visored Helm'],
  chest: ['Brigandine', 'Warden Plate', 'Scale Vest'], gloves: ['Gauntlets', 'Grips', 'Vambraces'],
  legs: ['Greaves', 'Cuisses', 'Chausses'], boots: ['Sabatons', 'Treads', 'Longboots'],
  cloak: ['Mantle', 'Shroud', 'Halfcape'], amulet: ['Reliquary', 'Talisman', 'Moon Pendant'],
  ring: ['Signet', 'Band', 'Loop'], charm: ['Stone', 'Stone', 'Stone'],
  relic: ['Totem', 'Libram', 'Idol'],
};
export const AFFIXES: readonly AffixDefinition[] = [
  ...SPECIAL_AFFIXES, ...RESISTANCE_AFFIXES,
  { name: 'Might', stat: 'strength', base: 1, growth: .3 },
  { name: 'Grace', stat: 'dexterity', base: 2, growth: .25 },
  { name: 'Insight', stat: 'intelligence', base: 1, growth: .3 },
  { name: 'Vigor', stat: 'vitality', base: 2, growth: .25 },
  { name: 'The Hart', stat: 'maxHp', base: 8, growth: 1.8 },
  { name: 'The Wellspring', stat: 'maxMana', base: 8, growth: .8 },
  { name: 'Shelter', stat: 'armor', base: 6, growth: 1.4 },
  { name: 'Ruin', stat: 'damagePercent', base: 4, growth: .35 },
  { name: 'Invocation', stat: 'castSpeedPercent', base: 3, growth: .18 },
  { name: 'Haste', stat: 'attackSpeedPercent', base: 3, growth: .18 },
  { name: 'Precision', stat: 'critChance', base: 1, growth: .08 },
  { name: 'Severity', stat: 'critDamage', base: 6, growth: .35 },
  { name: 'The Wanderer', stat: 'moveSpeedPercent', base: 2, growth: .12 },
  { name: 'Sorcery', stat: 'spellDamagePercent', base: 5, growth: .45 },
  { name: 'Clarity', stat: 'manaRegen', base: 2, growth: .12 },
  { name: 'Renewal', stat: 'lifeRegen', base: .3, growth: .05 },
  { name: 'Efficiency', stat: 'manaCostPercent', base: 4, growth: .15 },
  { name: 'Readiness', stat: 'cooldownPercent', base: 2, growth: .1 },
  { name: 'Sustenance', stat: 'lifeOnHit', base: 1, growth: .12 },
  { name: 'Accuracy', stat: 'hitRating', base: 4, growth: .8 },
  { name: 'Deftness', stat: 'expertise', base: 4, growth: .8 },
];
export const SHIELD_AFFIXES: typeof AFFIXES = [
  { name: 'Deflection', stat: 'blockChance', base: 2, growth: .08 },
  { name: 'The Bulwark', stat: 'blockReduction', base: 4, growth: .12 },
];
/** Explicit slot identity. Amulets share general stats, never weapon-local enchantments. */
const SLOT_AFFIXES: Partial<Record<ItemKind, readonly StatKey[]>> = {
  head: ['maxMana', 'intelligence', 'manaCostPercent', 'cooldownPercent', 'maxHp', 'armor'],
  chest: ['maxHp', 'armor', 'vitality', 'lifeRegen', 'strength'],
  gloves: ['attackSpeedPercent', 'castSpeedPercent', 'critChance', 'damagePercent', 'spellDamagePercent', 'dexterity', 'armor', 'hitRating', 'expertise'],
  legs: ['maxHp', 'armor', 'vitality', 'lifeRegen', 'strength', 'dexterity'],
  boots: ['moveSpeedPercent', 'maxHp', 'armor', 'vitality', 'dexterity'],
  cloak: ['potionPercent', 'lifeRegen', 'manaRegen', 'cooldownPercent', 'maxHp', 'maxMana', 'intelligence'],
  ring: [...RESISTANCE_STATS, 'maxHp', 'vitality', 'lifeRegen', 'manaOnKill', 'critChance', 'critDamage', 'damagePercent', 'spellDamagePercent', 'strength', 'dexterity', 'intelligence', 'maxMana', 'manaRegen', 'hitRating', 'expertise'],
  shield: [...RESISTANCE_STATS, 'afterguardPercent', 'blockChance', 'blockReduction', 'armor', 'maxHp', 'vitality', 'lifeRegen', 'strength', 'hitRating', 'expertise'],
  grimoire: ['manaOnKill', 'spellweavePercent', 'maxMana', 'manaRegen', 'manaCostPercent', 'cooldownPercent', 'intelligence', 'spellDamagePercent'],
  orb: ['spellDamagePercent', 'critChance', 'critDamage', 'intelligence', 'maxMana', 'manaCostPercent'],
};
export function itemAffixPool(item: { kind: ItemKind; weapon?: { family: string; damageType?: string }; focus?: { visual: { motif: string } }; recipe?: {materialId?: ItemMaterialId; profileId?:string} }): typeof AFFIXES {
  if (item.kind === 'charm') {
    const flavor = CHARM_PROFILES.find(p=>p.id===item.recipe?.profileId)?.flavor;
    return [...AFFIXES, ...CHARM_UTILITY_AFFIXES].filter(a=>CHARM_WEIGHTS[a.stat]).map(a=>({...a,
      weight: CHARM_WEIGHTS[a.stat]! * (flavor?.stats.includes(a.stat) ? 2 : 1) }));
  }
  if (item.kind === 'relic') {
    // Relics are class trinkets: a skill-rank affix drawn from the relic classes'
    // kits plus a modest generic support pool (skill affixes conflict, so higher
    // tiers still need ordinary stats to fill their rolls).
    const skills = SKILL_AFFIXES.filter(a => {
      const def = SKILL_DEFINITIONS[a.stat.slice(6) as SkillId];
      return def?.classId !== undefined && RELIC_CLASSES.includes(def.classId);
    }).map(a => ({ ...a, weight: 6 }));
    const stats: StatKey[] = ['strength', 'dexterity', 'intelligence', 'vitality', 'maxHp', 'maxMana', 'armor',
      'critChance', 'critDamage', 'damagePercent', 'spellDamagePercent', 'manaRegen', 'lifeRegen', 'cooldownPercent', 'manaCostPercent', 'hitRating', 'expertise'];
    return [...AFFIXES.filter(a => stats.includes(a.stat)).map(a => ({ ...a, weight: a.weight ?? 1 })), ...skills];
  }
  const melee = item.kind === 'weapon' && ['sword', 'axe', 'mace', 'dagger', 'fist', 'polearm'].includes(item.weapon?.family ?? '');
  const armor=['head','chest','gloves','legs','boots'].includes(item.kind), construction=item.recipe?.materialId;
  const leather=armor&&construction==='leather', cloth=armor&&isClothMaterial(construction);
  const specialty:StatKey[]=leather?['dexterity','damagePercent','critChance','critDamage','lifeOnHit','hitRating','expertise']:cloth?['intelligence','maxMana','manaRegen','spellDamagePercent','manaCostPercent']:[];
  const jewelry=JEWELRY_PROFILES.find(p=>p.id===item.recipe?.profileId);
  const preferred=jewelry?.affinity??specialty;
  const stats = leather||cloth ? [...specialty,'maxHp','armor',...(item.kind==='gloves'?[cloth?'castSpeedPercent':'attackSpeedPercent']:item.kind==='boots'?['moveSpeedPercent']:item.kind==='head'&&cloth?['cooldownPercent']:[])] : item.kind === 'amulet' ? [...AFFIXES, ...SHIELD_AFFIXES].map(a => a.stat)
    : item.kind === 'weapon' ? melee
      ? ['areaPercent', 'damagePercent', 'critChance', 'critDamage', 'lifeOnHit', 'strength', 'dexterity', 'hitRating', 'expertise']
      : ['bow', 'gun'].includes(item.weapon?.family ?? '') ? ['projectilePierce', 'damagePercent', 'critChance', 'critDamage', 'dexterity', 'lifeOnHit', 'strength']
      : [item.weapon?.family === 'staff' ? 'areaPercent' : 'projectilePierce', 'spellDamagePercent', 'intelligence', 'maxMana', 'critChance', 'critDamage', 'manaCostPercent', 'manaRegen']
    : SLOT_AFFIXES[item.kind] ?? [];
  return [...AFFIXES, ...SHIELD_AFFIXES].filter(a => stats.includes(a.stat)).map(a => ({ ...a,
    weight: (['cooldownPercent', 'manaCostPercent', 'critChance', 'lifeOnHit'].includes(a.stat) ? .55 : a.weight ?? 1) * (preferred.includes(a.stat)?2.2:preferred.length?.75:1),
  })).concat(melee ? ELEMENTAL_AFFIXES.map(a => ({ ...a, weight: .12 })) : [], skillAffixPool(item));
}
/** Shared weighted selection for drops and every enchanter operation. */
export function rollAffix(pool: typeof AFFIXES, random: () => number): (typeof AFFIXES)[number] {
  if (!pool.length) throw new RangeError('No eligible affix');
  let value = random() * pool.reduce((sum, a) => sum + (a.weight ?? 1), 0);
  return pool.find(a => (value -= a.weight ?? 1) < 0) ?? pool[pool.length - 1];
}
export function affixConflicts(stat: StatKey, occupied: readonly StatKey[]): boolean {
  return occupied.includes(stat) || isResistanceStat(stat) && occupied.some(isResistanceStat) || isSkillStat(stat) && occupied.some(isSkillStat) || isElementalAffix(stat) && occupied.some(isElementalAffix)
    || ['attackSpeedPercent', 'castSpeedPercent'].includes(stat) && occupied.some(s => ['attackSpeedPercent', 'castSpeedPercent'].includes(s));
}
/** Concentrated slots need meaningful rolls; percentage growth remains bounded. */
export function affixPotency(kind: ItemKind, stat: StatKey, authored = false): number {
  if (stat === 'moveSpeedPercent') return kind === 'boots' ? 5 : 2.5;
  if (stat === 'attackSpeedPercent' || stat === 'castSpeedPercent') return kind === 'gloves' ? (authored ? 4 : 3) : 2;
  if (kind === 'chest' && ['maxHp', 'armor', 'lifeRegen'].includes(stat)) return 1.75;
  if (kind === 'head' && ['maxMana', 'manaCostPercent'].includes(stat)) return 1.5;
  if (kind === 'cloak' && ['lifeRegen', 'manaRegen', 'cooldownPercent'].includes(stat)) return 1.5;
  if (kind === 'grimoire' && ['maxMana', 'manaRegen', 'manaCostPercent'].includes(stat)) return 1.5;
  if (kind === 'orb' && ['spellDamagePercent', 'critChance', 'critDamage'].includes(stat)) return 1.5;
  if (kind === 'shield' && ['blockChance', 'blockReduction'].includes(stat)) return 2;
  if (kind === 'weapon' && ['damagePercent', 'spellDamagePercent'].includes(stat)) return authored ? 2 : 4;
  return 1;
}
/** Random weapons trade some guaranteed base damage for stronger rolled damage.
 * Uniques keep their authored stat budgets; their skill power is a separate chase. */
function weaponBaseBudget(materialScale: number, authored = false): number {
  return authored ? materialScale : 1 + (materialScale - 1) * .35;
}

function focusImplicit(profileId: string, level: number, quality: number): StatModifiers {
  const profile = FOCUS_PROFILES.find(p => p.id === profileId)!;
  return Object.fromEntries(Object.entries(profile.implicit).map(([stat, value]) => [stat,
    value! * quality * (isOffensiveAttribute(stat) ? offensiveAttributeImplicitScale(level) : isManaBudgetStat(stat) ? manaImplicitScale(level) : PERCENT_STATS.has(stat as StatKey) ? itemPercentageScale(level) : itemPowerScale(level))]));
}
function jewelryImplicit(profileId:string,level:number,quality:number):StatModifiers {
  const profile=JEWELRY_PROFILES.find(p=>p.id===profileId)!;
  return Object.fromEntries(Object.entries(profile.implicit).map(([stat,value])=>[stat,value!*quality*(isOffensiveAttribute(stat)?offensiveAttributeImplicitScale(level):isManaBudgetStat(stat)?manaImplicitScale(level):PERCENT_STATS.has(stat as StatKey)?itemPercentageScale(level):itemPowerScale(level))]));
}
export const TIER_AFFIXES: Readonly<Record<ItemTier, number>> = { common: 0, magic: 1, rare: 2, epic: 3, legendary: 4, unique: 4 };
export const TIER_POWER: Readonly<Record<ItemTier, number>> = { common: 1, magic: 1.09, rare: 1.2, epic: 1.34, legendary: 1.5, unique: 1.5 };

/** Reward-only charm selection also covers authored equipment themes, with one roll per item. */
export function generateRewardItem(seed: number, itemLevel: number, kind?: ItemKind, profileId?: string, tier?: ItemTier, material?: ItemMaterialId, source: MaterialSource = {}): Item {
  if(tier==='unique')return generateUnique(seed,itemLevel);
  const charm = randomSource(seed ^ 0x4c19ac)() < CHARM_DROP_CHANCE;
  const item=generateItem(seed, itemLevel, charm ? 'charm' : kind, charm ? undefined : profileId, tier, charm ? undefined : material, source);
  // Default reward rarity has 1% Legendary. Add an equal Unique chance from the other 99%.
  return tier===undefined&&item.tier!=='legendary'&&randomSource(seed^0x73c1a91)()<1/99?generateUnique(seed,itemLevel):item;
}

/** Item-local generation; reward sources may supply an explicitly rolled tier. Callers own seed uniqueness. */
export function generateItem(seed: number, itemLevel: number, kind?: ItemKind, profileId?: string, tierOverride?: ItemTier, materialOverride?: ItemMaterialId, source:MaterialSource={}): Item {
  if (tierOverride === 'unique') return generateUnique(seed, itemLevel);
  if (tierOverride !== undefined && !Object.hasOwn(TIER_POWER, tierOverride)) throw new RangeError(`Unknown item tier: ${tierOverride}`);
  if (kind === 'charm' || profileId && CHARM_PROFILES.some(p=>p.id===profileId)) {
    if (kind && kind !== 'charm' || materialOverride !== undefined) throw new RangeError('Charms use stone profiles, not equipment materials.');
    return generateCharm(seed, itemLevel, profileId, tierOverride);
  }
  seed = seed >>> 0;
  const level = normalizeLevel(itemLevel);
  const random = randomSource(seed), choose = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)];
  const selectedJewelry = profileId ? JEWELRY_PROFILES.find(p=>p.id===profileId) : undefined;
  const selectedWeapon = profileId ? WEAPON_PROFILES.find(profile => profile.id === profileId) : undefined;
  const selectedShield = profileId ? SHIELD_PROFILES.find(profile => profile.id === profileId) : undefined;
  const selectedFocus = profileId ? FOCUS_PROFILES.find(profile => profile.id === profileId) : undefined;
  if (kind === 'consumable') {
    if (!isConsumableId(profileId)) throw new RangeError(`Unknown consumable: ${profileId}`);
    return createConsumableItem(profileId, seed);
  }
  if (profileId && !selectedWeapon && !selectedShield && !selectedFocus && !selectedJewelry) throw new RangeError(`Unknown equipment profile: ${profileId}`);
  if(kind==='riftKey') return createRiftKey(seed,itemLevel);
  const itemKind = kind ?? (selectedWeapon ? 'weapon' : selectedShield ? 'shield' : selectedFocus ? selectedFocus.visual.kind : selectedJewelry ? selectedJewelry.kind : choose(ITEM_KINDS.filter(k => k !== 'charm' && k !== 'consumable')));
  if (profileId && (itemKind === 'weapon' ? !selectedWeapon : itemKind === 'shield' ? !selectedShield : itemKind==='ring'||itemKind==='amulet' ? selectedJewelry?.kind!==itemKind : selectedFocus?.visual.kind !== itemKind)) {
    throw new RangeError(`Profile ${profileId} does not describe an item of kind ${itemKind}.`);
  }
  // Named set pieces (Dreadnaught, Cryptstalker…) surface only from real drops,
  // mirroring the legendary roll below: a dedicated stream keeps the roll
  // independent of the item's own draw sequence.
  const setPieceDef = (source.rank !== undefined || source.encounter !== undefined) ? setPiecesFor(itemKind, seed, source, source.classId) : null;
  if (setPieceDef) return generateSetPiece(setPieceDef, seed, level);

  const roll = random();
  // This default is for general content tools and starting gear. Enemy loot supplies its own table result.
  // Consume the same draw with an override so the underlying silhouette/material roll stays stable.
  let tier: ItemTier = tierOverride ?? (roll < .45 ? 'common' : roll < .77 ? 'magic' : roll < .94 ? 'rare' : roll < .99 ? 'epic' : 'legendary');
  const variant = random();
  let weaponProfile = itemKind === 'weapon' ? selectedWeapon ?? WEAPON_PROFILES[Math.floor(variant * WEAPON_PROFILES.length)] : undefined;
  const shieldProfile = itemKind === 'shield' ? selectedShield ?? SHIELD_PROFILES[Math.floor(variant * SHIELD_PROFILES.length)] : undefined;
  const focusProfiles = FOCUS_PROFILES.filter(p => p.visual.kind === itemKind);
  const focusProfile = selectedFocus ?? focusProfiles[Math.floor(variant * focusProfiles.length)];
  const jewelryOptions=jewelryProfiles(itemKind), jewelryProfile=selectedJewelry??jewelryOptions[Math.floor(variant*jewelryOptions.length)];
  // Named legendaries (Thunderfury, Sulfuras…) surface only from real drops: enemy
  // loot and site rewards pass rank/encounter in `source`. A dedicated stream keeps
  // the roll independent of the item's own draw sequence.
  const legendary = (source.rank !== undefined || source.encounter !== undefined) && WOW_LEGENDARIES.some(l => l.slot === itemKind)
    ? legendaryFor(itemKind, randomSource(seed ^ 0x2f6e8b1d)) : null;
  if (legendary) {
    tier = 'legendary';
    if (legendary.slot === 'weapon')
      weaponProfile = WEAPON_PROFILES.find(p => p.family === legendary.family && p.hands === legendary.hands)
        ?? WEAPON_PROFILES.find(p => p.family === legendary.family) ?? WEAPON_PROFILES.find(p => p.hands === legendary.hands) ?? weaponProfile;
  }
  const profileName = weaponProfile?.name ?? shieldProfile?.name ?? focusProfile?.name ?? jewelryProfile?.name ?? BASE_NAMES[itemKind as Exclude<ItemKind, 'weapon' | 'shield' | 'grimoire' | 'orb'>][Math.floor(variant * 3)];
  random(); // Preserve the affix/name draw sequence; construction uses its own RNG.
  const materials = sourceMaterialPool(itemKind, weaponProfile?.family, {level,...source});
  const materialId = materialOverride ?? rollItemMaterial(materials, randomSource(seed ^ 0x73a45d91)());
  if (!materials.some(m => m.id === materialId)) throw new RangeError(`Invalid ${itemKind} material: ${materialId}`);
  const material = ITEM_MATERIALS[materialId], baseScale = materials.find(m => m.id === materialId)!.baseScale;
  const { base, shadow, edge, trim, surface } = material;
  const appearance: Item['appearance'] = { base, shadow, edge, trim, surface, style: isClothMaterial(materialId) ? 'cloth' : ['leather','wood'].includes(surface) ? 'leather' : 'plate' };
  const baseName = materialBaseName(itemKind, profileName, materialId), quality = TIER_POWER[tier];
  const growth = itemPowerScale(level) * quality * baseScale;
  const rolls: number[] = [];
  const affixes: ItemAffix[] = [], remaining = [...itemAffixPool({ kind: itemKind, weapon: weaponProfile, focus: focusProfile, recipe:{materialId,profileId:jewelryProfile?.id} })];
  for (let index = 0; index < TIER_AFFIXES[tier]; index++) {
    const definition = rollAffix(remaining, random);
    const growthLevel = (PERCENT_STATS.has(definition.stat) || isManaBudgetStat(definition.stat) || isOffensiveAttribute(definition.stat)) ? itemAffixGrowthLevel(level) : level - 1;
    const rollQuality = random(); rolls.push(rollQuality);
    const value = discreteAffixValue(definition.stat, rollQuality, level) ?? (definition.base + growthLevel * definition.growth) * itemRollMultiplier(rollQuality) * quality * affixPotency(itemKind, definition.stat);
    affixes.push({ name: definition.name, stat: definition.stat, value: boundResistanceRoll(definition.stat, value) });
    for (let i = remaining.length - 1; i >= 0; i--) if (affixConflicts(remaining[i].stat, affixes.map(a => a.stat))) remaining.splice(i, 1);
  }
  const implicit: StatModifiers = focusProfile ? focusImplicit(focusProfile.id, level, quality * baseScale) : {};
  const armorBase: Partial<Record<ItemKind, number>> = { head: 5, chest: 11, gloves: 3, legs: 7, boots: 4 };
  if (armorBase[itemKind]) implicit.armor = Math.max(1, Math.round(armorBase[itemKind]! * growth));
  if (shieldProfile) implicit.armor = Math.max(1, Math.round(({ buckler: 7, kite: 15, tower: 22 }[shieldProfile.visual.kind]) * growth));
  if (itemKind === 'cloak') implicit.maxHp = Math.round(6 * growth);
  if (jewelryProfile) Object.assign(implicit,jewelryImplicit(jewelryProfile.id,level,quality*baseScale));
  const name = generateWowName(itemKind, weaponProfile?.family, tier, random);
  const item: Item = {
    recipe: { manaVersion: 1, offenseVersion: 1, rollVersion: 1, materialId, ...((weaponProfile ?? shieldProfile ?? focusProfile ?? jewelryProfile) ? { profileId: (weaponProfile ?? shieldProfile ?? focusProfile ?? jewelryProfile)!.id } : {}), starter: false, enhancement: 0, revision: 0, targetedRolls: 0, fullRolls: 0, rolls },
    id: `item-${seed.toString(36)}-${level}-${weaponProfile?.id ?? shieldProfile?.id ?? focusProfile?.id ?? jewelryProfile?.id ?? itemKind}-${materialId}-${tier}`, seed, name, baseName, kind: itemKind, tier,
    itemLevel: level, requiredLevel: Math.max(1, level - 2),
    power: 0, implicit, affixes, appearance,
  };
  if (weaponProfile) {
    item.weapon = { ...weaponProfile, id: item.id, name, damage: Math.round(weaponProfile.damage * growth * weaponBaseBudget(baseScale) / baseScale),
      visual: { ...weaponProfile.visual, material: surface, metal: appearance.base, edge: appearance.edge, grip: appearance.shadow, guard: appearance.trim } };
  }
  if (shieldProfile) {
    item.shield = { ...shieldProfile, id: item.id, name,
      visual: { ...shieldProfile.visual, material: surface, base: appearance.base, edge: appearance.edge, trim: appearance.trim, shadow: appearance.shadow } };
  }
  if (focusProfile) item.focus = { id: item.id, name, visual: { ...focusProfile.visual, material: surface, base: appearance.base, edge: appearance.edge, trim: appearance.trim, shadow: appearance.shadow } };
  if (legendary) {
    item.name = legendary.name; item.baseName = legendary.name; item.id += `-${legendary.id}`;
    item.flavor = legendary.flavor;
    if (legendary.classId) item.classId = legendary.classId;
    if (item.weapon) item.weapon = { ...item.weapon, id: item.id, name: legendary.name };
    if (item.shield) item.shield = { ...item.shield, id: item.id, name: legendary.name };
    // Named legendaries carry their authored proc (legendary-content.ts).
    if (LEGENDARY_PROCS[legendary.id]) item.recipe = { ...item.recipe, procId: legendary.id };
  }
  // Generic legendary weapons roll a proc that fits their silhouette.
  if (item.tier === 'legendary' && item.weapon && item.recipe.procId === undefined) {
    const procs = legendaryProcsFor(item.weapon.family, item.weapon.hands);
    if (procs.length) item.recipe = { ...item.recipe, procId: procs[Math.floor(randomSource(seed ^ 0x5d4e2b1f)() * procs.length)].id };
  }
  // Sockets roll on a dedicated stream (gem-content.ts); the flag gates generation,
  // while saved sockets keep deriving regardless so loaded gear never loses stats.
  const sockets = GAME_FEATURES.gems ? rollSockets(itemKind, item.tier, seed) : undefined;
  if (sockets) item.sockets = sockets;
  return roundItemStats(item);
}

/** Authored level-one common gear: no random rarity, affixes or starter-only powers. */
export function createStarterLoadout(weaponProfileId: string, offhandProfileId?: string): { weapon: Item; offhand: Item | null } {
  const profile = weaponProfileId === STARTING_SWORD.id ? STARTING_SWORD : WEAPON_PROFILES.find(profile => profile.id === weaponProfileId);
  if (!profile) throw new RangeError(`Unknown starter weapon profile: ${weaponProfileId}`);
  const item = generateItem(1, 1, 'weapon', profile === STARTING_SWORD ? 'longsword' : profile.id, 'common', itemMaterialPool('weapon', profile.family)[0].id);
  item.id = 'starter-weapon'; item.baseName = profile.name;
  item.name = profile === STARTING_SWORD ? profile.name : `Worn ${profile.name}`;
  item.implicit = {}; item.affixes = []; item.power = 1;
  item.recipe = { ...item.recipe, profileId: profile.id, starter: true, rolls: [] };
  item.weapon = { ...profile, visual: { ...profile.visual } };
  item.appearance = { base: profile.visual.metal, shadow: profile.visual.grip,
    edge: profile.visual.edge, trim: profile.visual.guard, style: 'plate' };
  let offhand: Item | null = null;
  if (offhandProfileId) {
    const offhandKind: ItemKind | undefined = SHIELD_PROFILES.some(p => p.id === offhandProfileId) ? 'shield'
      : FOCUS_PROFILES.find(p => p.id === offhandProfileId)?.visual.kind;
    if (!offhandKind) throw new RangeError(`Unknown starter offhand profile: ${offhandProfileId}`);
    offhand = generateItem(2, 1, offhandKind, offhandProfileId, 'common', itemMaterialPool(offhandKind)[0].id);
    offhand.id = 'starter-offhand'; offhand.name = `Worn ${offhand.baseName}`;
    offhand.recipe = { ...offhand.recipe, starter: true };
    if (offhand.shield) offhand.shield = { ...offhand.shield, id: offhand.id, name: offhand.name };
    if (offhand.focus) offhand.focus = { ...offhand.focus, id: offhand.id, name: offhand.name };
  }
  item.power = estimateItemPower(item);
  return { weapon: item, offhand };
}

/** The class's starter weapon, the same modest leather outfit, and an empty bag. */
export function createCharacterSheet(classId: WowClassId = 'warrior', raceId: WowRaceId = 'human', look?: CharacterLook): CharacterSheet {
  if (!isWowClassId(classId)) throw new RangeError(`Unknown class: ${classId}`);
  if (!isWowRaceId(raceId)) throw new RangeError(`Unknown race: ${raceId}`);
  const equipped = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, null])) as CharacterSheet['equipped'];
  const starterPieces: readonly [EquipmentSlot, number][] = [['head', 31], ['chest', 17], ['gloves', 23], ['legs', 59], ['boots', 11], ['cloak', 71]];
  // Armor proficiency: cloth classes wear cloth starters so they can re-equip them.
  const armorStyle = WOW_CLASSES[classId].armorStyle;
  for (const [slot, seed] of starterPieces) {
    const material: ItemMaterialId = slot === 'cloak' ? 'cloth' : armorStyle === 'plate' ? 'iron' : armorStyle;
    const item = generateItem(seed, 1, slot as ItemKind, undefined, 'common', material);
    // Starter armor is an ordinary unspecified base (scale 1); the class palette/style below carries the look.
    delete item.recipe.materialId;
    const wornNames: Partial<Record<EquipmentSlot, string>> = { head: 'Leather Hood', chest: 'Leather Jerkin',
      gloves: 'Leather Gloves', legs: 'Leather Trousers', boots: 'Leather Boots', cloak: 'Travel Cloak' };
    const clothNames: Partial<Record<EquipmentSlot, string>> = { head: 'Cloth Hood', chest: 'Cloth Robe',
      gloves: 'Cloth Gloves', legs: 'Cloth Pants', boots: 'Cloth Shoes', cloak: 'Travel Cloak' };
    const plateNames: Partial<Record<EquipmentSlot, string>> = { head: 'Plate Helm', chest: 'Plate Cuirass',
      gloves: 'Plate Gauntlets', legs: 'Plate Greaves', boots: 'Plate Sabatons', cloak: 'Travel Cloak' };
    const names = armorStyle === 'cloth' ? clothNames : armorStyle === 'plate' ? plateNames : wornNames;
    item.baseName = names[slot]!;
    item.id = `starter-${slot}`; item.name = `Worn ${item.baseName}`;
    item.tier = 'common'; item.implicit = {}; item.affixes = []; item.power = 1;
    item.recipe = { ...item.recipe, starter: true, rolls: [] };
    const palettes = { cloth: { base: '#4a4a5e', shadow: '#23232e', edge: '#8a8aa0', trim: '#7a7a92' },
      leather: { base: '#655345', shadow: '#2c2826', edge: '#ac9470', trim: '#9e8156' },
      plate: { base: '#5a5f6b', shadow: '#26282e', edge: '#9aa0ae', trim: '#8a8f9c' } } as const;
    item.appearance = { ...palettes[armorStyle], style: armorStyle };
    if (slot === 'boots') item.appearance = { ...item.appearance, base: armorStyle === 'cloth' ? '#45455a' : armorStyle === 'plate' ? '#525762' : '#5c4c41' };
    if (slot === 'cloak') item.appearance = { base: '#555e50', shadow: '#292f2d', edge: '#89937c', trim: '#a28c64', style: 'cloth' };
    equipped[slot] = item;
  }
  const starter = WOW_CLASSES[classId].starter;
  const loadout = createStarterLoadout(starter.weapon, starter.offhand);
  equipped.weapon = loadout.weapon; equipped.offhand = loadout.offhand;
  const inventory: CharacterSheet['inventory'] = Array.from({ length: INVENTORY_CAPACITY }, () => null);
  // The class's level-1 skill is a free sanctum node, pre-allocated and on the bar.
  const starterNodeId = `wow-${classId}-${WOW_CLASSES[classId].starterSkill}`;
  const skillSlots: CharacterSheet['skillSlots'] = Array.from({ length: BAR_TOTAL }, () => null);
  skillSlots[0] = WOW_CLASSES[classId].starterSkill;
  return { classId, raceId, treeVersion: 3, look: look ? cloneData(look) : createRaceLook(raceId), skillRanks: {}, activeSkillRanks: {}, skillSpecializations: {}, arcaneOverload: false, gold: 0, commerce: { epoch: 0, revision: 0, operations: 0, sold: {}, buyback: [] }, attributes: { strength: 10, dexterity: 10, intelligence: 10, vitality: 10 },
    statPoints: 0, skillPoints: 0, allocatedNodes: ['origin', starterNodeId], inventory, equipped, skillSlots };
}


/** Rebuild from authored bases and exact roll quality; never scale rounded existing stats. */
export function deriveItem(item: Item): Item {
  if(item.kind==='riftKey')return {...createRiftKey(item.seed,item.itemLevel,item.recipe.riftKeyTier),...(item.locked!==undefined?{locked:item.locked}:{})};
  if (item.kind === 'consumable') return item;
  if (item.tier === 'unique') return deriveUnique(item);
  if (item.kind === 'charm') return deriveCharm(item);
  return deriveEquipment(item);
}

function deriveEquipment(item: Item): Item {
  const next: Item = { ...item, implicit: {}, affixes: [], recipe: { ...item.recipe, manaVersion: 1, offenseVersion: 1, rollVersion: 1, rolls: [...item.recipe.rolls] } };
  const r = item.recipe, quality = TIER_POWER[item.tier], enhance = 1 + .05 * r.enhancement;
  const baseScale = itemMaterialScale(item);
  const growth = itemPowerScale(item.itemLevel) * quality * enhance * baseScale;
  const weapon = r.profileId === STARTING_SWORD.id ? STARTING_SWORD : WEAPON_PROFILES.find(p => p.id === r.profileId);
  const shield = SHIELD_PROFILES.find(p => p.id === r.profileId);
  const armor: Partial<Record<ItemKind, number>> = { head: 5, chest: 11, gloves: 3, legs: 7, boots: 4 };
  if (item.focus) next.implicit = focusImplicit(r.profileId!, item.itemLevel, quality * enhance * baseScale);
  if (shield) next.implicit.armor = Math.round(({ buckler: 7, kite: 15, tower: 22 }[shield.visual.kind]) * growth);
  if (!r.starter) {
    if (armor[item.kind]) next.implicit.armor = Math.round(armor[item.kind]! * growth);
    if (item.kind === 'cloak') next.implicit.maxHp = Math.round(6 * growth);
    if (item.kind === 'amulet') next.implicit.maxMana = Math.round(7 * manaImplicitScale(item.itemLevel) * quality * enhance * baseScale);
    if (item.kind === 'ring') next.implicit.damagePercent = 2 * itemPercentageScale(item.itemLevel) * quality * enhance * baseScale;
  }
  if (JEWELRY_PROFILES.some(p=>p.id===r.profileId)) next.implicit=jewelryImplicit(r.profileId!,item.itemLevel,quality*enhance*baseScale);
  // Socketed gems and the matched socket bonus derive into implicit (gem-content.ts).
  if (item.sockets?.length) for (const [stat, value] of Object.entries(socketedModifiers(item))) {
    next.implicit[stat as StatKey] = (next.implicit[stat as StatKey] ?? 0) + value!;
  }
  // Permanent enchants (enchant-content.ts) fold into implicit like socketed gems;
  // the kinds guard keeps a corrupted save from applying a weapon enchant to boots.
  const enchant = enchantDefinition(item.enchant);
  if (enchant?.kinds.includes(item.kind)) for (const [stat, value] of Object.entries(enchant.stats)) {
    next.implicit[stat as StatKey] = (next.implicit[stat as StatKey] ?? 0) + value!;
  }
  if (weapon && item.weapon) next.weapon = { ...item.weapon, damage: Math.round(weapon.damage * growth * (r.starter ? 1 : weaponBaseBudget(baseScale, item.tier === 'unique') / baseScale)) };
  if (shield && item.shield) next.shield = { ...item.shield,
    blockChance: shield.blockChance * enhance,
    blockReduction: shield.blockReduction * enhance };
  next.affixes = item.affixes.map((affix, index) => {
    const definition = [...AFFIXES, ...SHIELD_AFFIXES, ...ELEMENTAL_AFFIXES, ...SKILL_AFFIXES].find(a => a.stat === affix.stat)!;
    const level = (PERCENT_STATS.has(affix.stat) || isManaBudgetStat(affix.stat) || isOffensiveAttribute(affix.stat)) ? itemAffixGrowthLevel(item.itemLevel) : item.itemLevel - 1;
    return { name: definition.name, stat: definition.stat,
      value: boundResistanceRoll(definition.stat, discreteAffixValue(definition.stat, r.rolls[index], item.itemLevel) ?? (definition.base + level * definition.growth) * itemRollMultiplier(r.rolls[index]) * quality * enhance * affixPotency(item.kind, definition.stat, item.tier === 'unique')) };
  });
  next.requiredLevel = Math.max(1, item.itemLevel - 2);
  return roundItemStats(next);
}

/** Round actual item bonuses once after all multipliers. Small rolls remain useful. */
const wholeItemStat = (value: number): number => value === 0 ? 0 : Math.sign(value) * Math.max(1, Math.round(Math.abs(value)));
/** Also canonicalizes validated saved items without rerolling their recipes or changing ownership. */
export function roundItemStats(item: Item): Item {
  const next: Item = { ...item,
    implicit: Object.fromEntries(Object.entries(item.implicit).map(([key, value]) => [key, wholeItemStat(value!)])),
    affixes: item.affixes.map(affix => ({ ...affix, value: wholeItemStat(affix.value) })),
    ...(item.shield ? { shield: { ...item.shield, blockChance: wholeItemStat(item.shield.blockChance), blockReduction: wholeItemStat(item.shield.blockReduction) } } : {}),
  };
  next.power = estimateItemPower(next);
  return next.weapon?.enchantment || next.affixes.some(affix => isElementalAffix(affix.stat)) ? applyWeaponEnchantment(next) : next;
}

/** Build-neutral gear quality, using actual values rather than the saved score.
 * Normalize stat units against their ordinary same-level slot budget. This is
 * neither build DPS nor a valuation of a Unique's skill-changing power. */
export function estimateItemPower(item: Item): number {
  if (item.kind === 'riftKey') return 0;
  if (item.kind === 'consumable') return 0;
  if (item.recipe.starter && !item.weapon && !item.focus && !item.shield && !item.affixes.length) return 1;
  const quality = TIER_POWER[item.tier], enhance = 1 + .05 * item.recipe.enhancement;
  let base = quality * enhance * (item.kind === 'charm' ? charmProfile(item)!.size.potency : itemMaterialScale(item));
  const profile = item.recipe.profileId === STARTING_SWORD.id ? STARTING_SWORD : WEAPON_PROFILES.find(p => p.id === item.recipe.profileId);
  if (item.weapon && profile) base = item.weapon.damage / (profile.damage * itemPowerScale(item.itemLevel));
  const definitions = [...AFFIXES, ...SHIELD_AFFIXES, ...ELEMENTAL_AFFIXES, ...SKILL_AFFIXES, ...CHARM_UTILITY_AFFIXES];
  const physical = item.weapon && item.weapon.attackKind !== 'bolt';
  const rolled = item.affixes.reduce((total, affix) => {
    const definition = definitions.find(a => a.stat === affix.stat);
    if (!definition) return total;
    const level = PERCENT_STATS.has(affix.stat) || isManaBudgetStat(affix.stat) || isOffensiveAttribute(affix.stat)
      ? itemAffixGrowthLevel(item.itemLevel) : item.itemLevel - 1;
    const reference = isSkillStat(affix.stat) || affix.stat === 'projectilePierce' ? 1
      : Math.max(1, (definition.base + level * definition.growth) * affixPotency(item.kind, affix.stat, item.tier === 'unique'));
    // Support stats still matter; a spell-only bonus on a physical weapon does not.
    const relevance = physical && ['intelligence', 'spellDamagePercent', 'castSpeedPercent'].includes(affix.stat) ? 0
      : item.weapon && ['damagePercent', 'spellDamagePercent', 'critChance', 'critDamage'].includes(affix.stat) ? 1.25
      : item.weapon && ['maxMana', 'manaRegen', 'manaCostPercent'].includes(affix.stat) ? .7 : 1;
    return total + Math.max(0, affix.value) / reference * relevance;
  }, 0);
  // Socketed gem stats and the matched socket bonus count like rolled affixes.
  const socketed = Object.entries(socketedModifiers(item)).reduce((total, [stat, value]) => {
    const definition = definitions.find(a => a.stat === stat);
    if (!definition) return total;
    const level = PERCENT_STATS.has(stat as StatKey) || isManaBudgetStat(stat) || isOffensiveAttribute(stat)
      ? itemAffixGrowthLevel(item.itemLevel) : item.itemLevel - 1;
    return total + Math.max(0, value!) / Math.max(1, (definition.base + level * definition.growth) * affixPotency(item.kind, stat as StatKey, item.tier === 'unique'));
  }, 0);
  // Permanent enchant stats count like rolled affixes too.
  const enchantDef = enchantDefinition(item.enchant);
  const enchanted = Object.entries(enchantDef?.kinds.includes(item.kind) ? enchantDef.stats : {}).reduce((total, [stat, value]) => {
    const definition = definitions.find(a => a.stat === stat);
    if (!definition) return total;
    const level = PERCENT_STATS.has(stat as StatKey) || isManaBudgetStat(stat) || isOffensiveAttribute(stat)
      ? itemAffixGrowthLevel(item.itemLevel) : item.itemLevel - 1;
    return total + Math.max(0, value!) / Math.max(1, (definition.base + level * definition.growth) * affixPotency(item.kind, stat as StatKey, item.tier === 'unique'));
  }, 0);
  return Math.max(1, Math.round((item.itemLevel + 5) * 10 * (.65 * base + .12 * (rolled + socketed + enchanted))));
}

/** Apply current random weapon/glove budgets on a validated save copy. Keep
 * identities, enhancements and quantiles; replace only obsolete caster affixes. */
export function refreshEquipmentBudgets(item: Item): Item {
  if (item.tier === 'unique' || item.recipe.starter || !['weapon', 'gloves'].includes(item.kind)) return item;
  let next = item;
  if (item.weapon && item.weapon.attackKind !== 'bolt') {
    const affixes = item.affixes.map(a => ({...a})), pool = itemAffixPool(item);
    for (let i = 0; i < affixes.length; i++) {
      if (!['intelligence', 'spellDamagePercent', 'castSpeedPercent'].includes(affixes[i].stat)) continue;
      const occupied = affixes.filter((_, index) => i !== index).map(a => a.stat);
      const preferred: StatKey[] = affixes[i].stat === 'intelligence'
        ? ['strength', 'dexterity', 'critDamage', 'lifeOnHit'] : ['damagePercent', 'critDamage', 'lifeOnHit', 'dexterity'];
      const definition = preferred.map(stat => pool.find(a => a.stat === stat)).find(a => a && !affixConflicts(a.stat, occupied))
        ?? pool.find(a => !affixConflicts(a.stat, occupied));
      if (!definition) throw new Error('No replacement weapon affix');
      affixes[i] = {name: definition.name, stat: definition.stat, value: 0};
    }
    next = {...item, affixes};
  }
  const current = deriveItem(next);
  return {...item, ...(item.weapon ? {weapon: {...item.weapon, damage: current.weapon!.damage}} : {}),
    affixes: item.affixes.map((affix, i) => affix.stat !== current.affixes[i].stat
      || ['damagePercent', 'spellDamagePercent', 'attackSpeedPercent', 'castSpeedPercent'].includes(affix.stat) ? current.affixes[i] : affix)};
}

/** Rebuild elemental projection after generation or services, clearing removed affixes. */
function applyWeaponEnchantment(item: Item): Item {
  if (!item.weapon || item.weapon.attackKind !== 'melee') return item;
  const enchantment = meleeEnchantment(item.affixes);
  const { enchantment: _old, ...weapon } = item.weapon;
  const { glow: _glow, element: _element, ...visual } = weapon.visual;
  item.weapon = { ...weapon, ...(enchantment ? { enchantment } : {}), visual: { ...visual, element: enchantment?.element ?? 'physical',
    ...(enchantment ? { glow: ELEMENT_COLORS[enchantment.element] } : {}) } };
  return item;
}
export const itemDisplayName = (item: Item): string => `${item.name}${item.recipe.enhancement ? ` +${item.recipe.enhancement}` : ''}${item.tier === 'unique' ? ` ${UNIQUE_SYMBOL}` : hasGreaterAffix(item) ? ` ${GREATER_AFFIX_SYMBOL}` : ''}`;

/** Charms share item recipes, rarity and affix definitions; size owns their budget. */
function generateCharm(seed: number, itemLevel: number, profileId?: string, tierOverride?: ItemTier): Item {
  seed >>>= 0; const random = randomSource(seed), level=normalizeLevel(itemLevel);
  let sizeRoll=random()*100;
  const size=CHARM_SIZES.find(s=>(sizeRoll-=s.weight)<0) ?? CHARM_SIZES[0];
  const flavor=CHARM_FLAVORS[Math.floor(random()*CHARM_FLAVORS.length)];
  const selected=profileId ? CHARM_PROFILES.find(p=>p.id===profileId) : CHARM_PROFILES.find(p=>p.size.id===size.id && p.flavor===flavor);
  if(!selected) throw new RangeError(`Unknown charm profile: ${profileId}`);
  const roll=random(), tier=tierOverride??(roll<.45?'common':roll<.77?'magic':roll<.94?'rare':roll<.99?'epic':'legendary');
  const item:Item={id:`charm-${seed.toString(36)}-${level}-${selected.id}-${tier}`,seed,kind:'charm',tier,name:selected.name,baseName:selected.name,
    itemLevel:level,requiredLevel:Math.max(1,level-2),power:0,implicit:{},affixes:[],
    recipe:{charmVersion:1,manaVersion:1,offenseVersion:1,rollVersion:1,profileId:selected.id,starter:false,enhancement:0,revision:0,targetedRolls:0,fullRolls:0,rolls:[]},
    appearance:{base:selected.flavor.base,edge:selected.flavor.edge,shadow:'#19252b',trim:selected.flavor.glow,style:'plate'}};
  const pool=itemAffixPool(item);
  for(let i=0;i<charmAffixCount(item);i++){
    const definition=rollAffix(pool.filter(a=>(i>0||charmThematicStat(item,a.stat))&&!affixConflicts(a.stat,item.affixes.map(a=>a.stat))),random);
    item.affixes.push({name:definition.name,stat:definition.stat,value:0});item.recipe.rolls.push(random());
  }
  return deriveCharm(item);
}
function deriveCharm(item:Item):Item {
  if (item.recipe.charmVersion !== 1) item = rebalanceCharm(item);
  const profile=charmProfile(item);if(!profile)throw new RangeError('Unknown charm profile');
  const quality=TIER_POWER[item.tier]*(1+.05*item.recipe.enhancement);
  const definitions=itemAffixPool(item);
  const affixes=item.affixes.map((a,i)=>{
    const definition=definitions.find(d=>d.stat===a.stat);if(!definition)throw new RangeError('Invalid charm affix');
    const growth=(PERCENT_STATS.has(a.stat)||isManaBudgetStat(a.stat)||isOffensiveAttribute(a.stat))?itemAffixGrowthLevel(item.itemLevel):item.itemLevel-1;
    return {name:definition.name,stat:a.stat,value:boundResistanceRoll(a.stat,(definition.base+growth*definition.growth)*quality*(a.stat==='manaRegen'?profile.size.width*profile.size.height*.35:profile.size.potency)*itemRollMultiplier(item.recipe.rolls[i]))};
  });
  return roundItemStats({...item,affixes,implicit:{},requiredLevel:Math.max(1,item.itemLevel-2),power:0,recipe:{...item.recipe,manaVersion:1,offenseVersion:1,rollVersion:1,rolls:[...item.recipe.rolls]}});
}
export const itemAffixCount = (item:Pick<Item,'kind'|'tier'|'recipe'>) => item.kind==='riftKey'?0: isGemId(item.recipe?.profileId)?0: item.kind==='charm'?charmAffixCount(item):TIER_AFFIXES[item.tier];
/** Upgrade validated pre-budget stones in place, retaining identity, roll quality and progress. */
export function rebalanceCharm(item: Item): Item {
  if (item.kind !== 'charm' || item.recipe.charmVersion === 1) return item;
  const next = {...item, recipe:{...item.recipe,charmVersion:1 as const,rolls:[] as number[]}, affixes:[] as ItemAffix[]};
  const random = randomSource(item.seed ^ 0x53ac914f), pool = itemAffixPool(item);
  const theme = item.affixes.findIndex(a=>charmThematicStat(item,a.stat));
  const indices = [theme, ...item.affixes.map((_,i)=>i).filter(i=>i!==theme)];
  for (let i=0;i<charmAffixCount(next);i++) {
    const index=indices[i], old=index>=0?item.affixes[index]:undefined;
    const choices=pool.filter(a=>(i>0||charmThematicStat(next,a.stat))&&!affixConflicts(a.stat,next.affixes.map(a=>a.stat)));
    const definition=old&&choices.find(a=>a.stat===old.stat)||rollAffix(choices,random);
    next.affixes.push({name:definition.name,stat:definition.stat,value:0});
    next.recipe.rolls.push(index>=0?item.recipe.rolls[index]:random());
  }
  return deriveCharm(next);
}

/** Reprice existing resource recipes once; preserve non-resource stats and every identity. */
export function rebalanceItemMana(item:Item):Item {
  if(item.kind==='riftKey')return item;
  if(item.recipe.manaVersion===1)return item;
  const current=deriveItem(item);
  const implicit={...item.implicit};
  for(const key of ['maxMana','manaRegen','manaOnKill'] as const) {
    if(current.implicit[key]!==undefined)implicit[key]=current.implicit[key];
    else delete implicit[key];
  }
  return {...item,implicit,recipe:{...item.recipe,manaVersion:1},affixes:item.affixes.map((a,i)=>isManaBudgetStat(a.stat)?current.affixes[i]:a)};
}
function isManaBudgetStat(stat:string):boolean { return stat==='maxMana'||stat==='manaRegen'||stat==='manaOnKill'; }

/** Reprice offensive attributes once, preserving unrelated affixes and rolled identities. */
export function rebalanceItemOffense(item: Item): Item {
  if(item.kind==='riftKey')return item;
  if (item.recipe.offenseVersion === 1) return item;
  const current = deriveItem(item), implicit = {...item.implicit};
  for (const key of ['strength', 'intelligence'] as const) {
    if (current.implicit[key] !== undefined) implicit[key] = current.implicit[key];
    else delete implicit[key];
  }
  return {...item, implicit, recipe: {...item.recipe, offenseVersion: 1},
    affixes: item.affixes.map((affix, i) => isOffensiveAttribute(affix.stat) ? current.affixes[i] : affix)};
}


/** Keep a saved roll's percentile and identity while applying the wider current range. */
export function rebalanceItemRolls(item: Item): Item {
  if(item.kind==='riftKey')return item;
  if (item.recipe.rollVersion === 1) return item;
  return roundItemStats({...item, affixes: deriveItem(item).affixes, recipe: {...item.recipe, rollVersion: 1}});
}

/** Fixed identities and fixed roll quality; level is captured by the reward owner at drop. */
export function generateUnique(seed:number, level:number, uniqueId?:string):Item {
  const definition=uniqueId ? UNIQUES.find(u=>u.id===uniqueId) : UNIQUES[Math.floor(randomSource(seed^0x51c3a97)()*UNIQUES.length)];
  if(!definition)throw new RangeError('Unknown unique item');
  const item=generateItem(seed,level,definition.kind,definition.profile,'legendary',definition.material);
  item.tier='unique';item.name=definition.name;item.id+=`-${definition.id}`;
  item.recipe={...item.recipe,uniqueId:definition.id,rolls:[.75,.75,.75,.75]};
  // Uniques carry authored powers, never a random legendary proc.
  delete item.recipe.procId;
  item.affixes=definition.affixes.map(stat=>({name:STAT_LABELS[stat],stat,value:0}));
  return deriveUnique(item);
}
function deriveUnique(item:Item):Item {
  const definition=uniqueDefinition(item);if(!definition)throw new RangeError('Unknown unique item');
  const next=deriveEquipment(item);
  const name=definition.name;
  next.tier='unique';next.name=name;
  next.appearance={...next.appearance,trim:UNIQUE_COLOR,edge:'#d7b6ee'};
  if(next.weapon)next.weapon={...next.weapon,name,visual:{...next.weapon.visual,guard:UNIQUE_COLOR,edge:'#d7b6ee'}};
  if(next.shield)next.shield={...next.shield,name,visual:{...next.shield.visual,trim:UNIQUE_COLOR,edge:'#d7b6ee'}};
  if(next.focus)next.focus={...next.focus,name,visual:{...next.focus.visual,trim:UNIQUE_COLOR,edge:'#d7b6ee',glow:'#ba8bf1'}};
  return next;
}

/**
 * Deterministic set piece item. Built on the normal equipment pipeline (material,
 * implicit armor, affix growth, rounding all derive), then stamped with the
 * authored name, affix stats and fixed roll quality — the generateUnique pattern.
 * Calls generateItem WITHOUT a `source`, so the integrator's setPiecesFor hook
 * (gated on source.rank/encounter) cannot recurse.
 */
export function generateSetPiece(pieceDef: SetPieceDef | SetPieceId, seed: number, itemLevel: number): Item {
  const def = typeof pieceDef === 'string' ? setPiece(pieceDef) : pieceDef;
  if (!def) throw new RangeError(`Unknown set piece: ${pieceDef}`);
  const set = setPieceSet(def);
  const item = generateItem(seed, itemLevel, def.kind, undefined, set.tier, def.material);
  item.id = `${SET_PIECE_PREFIX}${def.id}:${(seed >>> 0).toString(36)}`;
  item.name = def.name;
  item.baseName = def.name;
  item.flavor = `${set.flavor} Classes: ${set.classes.map(c => WOW_CLASSES[c].name).join(', ')}.`;
  if (set.classes.length === 1) item.classId = set.classes[0];
  item.affixes = def.affixes.map(stat => ({ name: STAT_LABELS[stat], stat, value: 0 }));
  item.recipe = { ...item.recipe, rolls: def.affixes.map(() => SET_PIECE_ROLL) };
  return deriveItem(item);
}

/**
 * Authored named legendary (Thunderfury, Shadowmourne…): fixed identity, flavor
 * and procId on the normal equipment pipeline — the generateUnique pattern.
 * Calls generateItem WITHOUT a `source`, so the drop-only legendaryFor hook
 * (gated on source.rank/encounter) cannot recurse.
 */
export function generateLegendary(seed: number, itemLevel: number, legendaryId?: string): Item {
  const legendary = legendaryId ? WOW_LEGENDARIES.find(l => l.id === legendaryId) : WOW_LEGENDARIES[Math.floor(randomSource(seed ^ 0x3f9c27d1)() * WOW_LEGENDARIES.length)];
  if (!legendary) throw new RangeError(`Unknown legendary: ${legendaryId}`);
  const profile = legendary.slot === 'weapon'
    ? WEAPON_PROFILES.find(p => p.family === legendary.family && p.hands === legendary.hands)
      ?? WEAPON_PROFILES.find(p => p.family === legendary.family) ?? WEAPON_PROFILES.find(p => p.hands === legendary.hands)
    : legendary.slot === 'shield' ? SHIELD_PROFILES[0] : undefined;
  const item = generateItem(seed, itemLevel, legendary.slot, profile?.id, 'legendary');
  item.name = legendary.name; item.baseName = legendary.name; item.id += `-${legendary.id}`;
  item.flavor = legendary.flavor;
  if (legendary.classId) item.classId = legendary.classId;
  if (item.weapon) item.weapon = { ...item.weapon, id: item.id, name: legendary.name };
  if (item.shield) item.shield = { ...item.shield, id: item.id, name: legendary.name };
  if (LEGENDARY_PROCS[legendary.id]) item.recipe = { ...item.recipe, procId: legendary.id };
  return item;
}
