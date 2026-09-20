import type { Item, ItemKind, ItemTier, StatKey } from './character-types.ts';
import type { ItemMaterialId, MaterialSource } from './item-materials.ts';
import type { WowClassId } from './wow-types.ts';
import { GAME_FEATURES } from './game-features.ts';
import { randomSource } from './random-source.ts';

/**
 * WoW (WotLK) item sets — pure data + pure functions (docs/wow-deepening.md, second wave).
 *
 * Eight real WotLK-era sets: seven Naxxramas tier-7 "Heroes'" class sets plus the
 * Hateful Gladiator's entry set as the rare dungeon/PvP chase. Every set is armor
 * (head/chest/gloves/legs/boots) because the engine has no shoulder slot; the fifth
 * piece is the real WotLK offset piece name (Sabatons/Boots/Slippers).
 *
 * Set identity rides the item id (`setpiece:<pieceId>:<seed36>`), the same trick
 * glyph items use — ItemRecipe is a frozen shared contract, so no recipe field is
 * added. `setPieceOf` additionally accepts an exact authored-name match so pieces
 * survive id-rewriting call sites (vendor stock, POI rewards stamp item.id).
 *
 * Integration hooks (wired by the integrator, see the feature note):
 *   - `setPiecesFor(itemKind, seed, source?, classId?)` inside items.ts generateItem.
 *   - `setBonusSources(equipped, durability?)` inside character-stats.ts
 *     characterModifierSources (re-exported from item-set-bonus.ts).
 */

export type ItemSetId = 'dreadnaught' | 'redemption' | 'scourgeborne' | 'bonescythe'
  | 'cryptstalker' | 'frostfire' | 'faith' | 'hateful-gladiator';
export type SetPieceId = string;
export type SetArmor = 'plate' | 'leather' | 'cloth';

/** One named piece of a set. `affixes` are authored stats; values derive from the
 * fixed SET_PIECE_ROLL quantile through the normal equipment pipeline. */
export interface SetPieceDef {
  readonly id: SetPieceId;
  readonly name: string;
  readonly kind: ItemKind;
  readonly material: ItemMaterialId;
  readonly affixes: readonly StatKey[];
}

/** A tiered bonus that switches on at `pieces` equipped. `stats` are flat
 * StatModifiers merged into character stats; `description` is the tooltip line. */
export interface SetBonusTier {
  readonly pieces: number;
  readonly stats: Readonly<Partial<Record<StatKey, number>>>;
  readonly description: string;
}

export interface ItemSetDef {
  readonly id: ItemSetId;
  readonly name: string;
  readonly tier: ItemTier;
  readonly armor: SetArmor;
  /** Classes the set is itemized for (drives drop weighting and the tooltip line). */
  readonly classes: readonly WowClassId[];
  readonly pieces: readonly SetPieceDef[];
  readonly bonuses: readonly SetBonusTier[];
  readonly flavor: string;
}

const piece = (set: ItemSetId, slot: string, name: string, kind: ItemKind, material: ItemMaterialId, affixes: readonly StatKey[]): SetPieceDef =>
  Object.freeze({ id: `${set}-${slot}`, name, kind, material, affixes: Object.freeze(affixes) });
const bonus = (pieces: number, stats: Partial<Record<StatKey, number>>, description: string): SetBonusTier =>
  Object.freeze({ pieces, stats: Object.freeze(stats), description });

/** Real WotLK set names and piece names (wowhead.com/wotlk tier 7 + season 5).
 * Bonuses are mapped onto engine stats honestly: WotLK proc/skill-specific bonuses
 * become the equivalent passive stat or `skill:<id>` bonus ranks, and each
 * description states what the bonus does here. */
export const ITEM_SETS: readonly ItemSetDef[] = Object.freeze([
  Object.freeze({
    id: 'dreadnaught', name: "Heroes' Dreadnaught Battlegear", tier: 'epic', armor: 'plate',
    classes: Object.freeze(['warrior']),
    flavor: 'Plate forged for the siege of Naxxramas, scarred by the Scourge.',
    pieces: Object.freeze([
      piece('dreadnaught', 'head', "Heroes' Dreadnaught Greathelm", 'head', 'steel', ['strength', 'critChance', 'maxHp']),
      piece('dreadnaught', 'chest', "Heroes' Dreadnaught Battleplate", 'chest', 'steel', ['strength', 'vitality', 'armor']),
      piece('dreadnaught', 'gloves', "Heroes' Dreadnaught Gauntlets", 'gloves', 'steel', ['strength', 'attackSpeedPercent', 'damagePercent']),
      piece('dreadnaught', 'legs', "Heroes' Dreadnaught Legplates", 'legs', 'steel', ['strength', 'vitality', 'armor']),
      piece('dreadnaught', 'boots', "Heroes' Dreadnaught Sabatons", 'boots', 'steel', ['strength', 'moveSpeedPercent', 'maxHp']),
    ]),
    bonuses: Object.freeze([
      bonus(2, { damagePercent: 6 }, 'Increases attack damage by 6% — your Heroic Strike and Slam hit harder.'),
      bonus(3, { strength: 15 }, '+15 Strength.'),
      bonus(4, { critDamage: 12, 'skill:mortalStrike': 2 }, '+12% critical damage and +2 Mortal Strike ranks.'),
    ]),
  }),
  Object.freeze({
    id: 'redemption', name: "Heroes' Redemption Battlegear", tier: 'epic', armor: 'plate',
    classes: Object.freeze(['paladin']),
    flavor: 'The Light\'s favor, hammered into plate by the Argent Crusade.',
    pieces: Object.freeze([
      piece('redemption', 'head', "Heroes' Redemption Helm", 'head', 'steel', ['intelligence', 'maxMana', 'armor']),
      piece('redemption', 'chest', "Heroes' Redemption Chestpiece", 'chest', 'steel', ['intelligence', 'vitality', 'armor']),
      piece('redemption', 'gloves', "Heroes' Redemption Gauntlets", 'gloves', 'steel', ['intelligence', 'castSpeedPercent', 'spellDamagePercent']),
      piece('redemption', 'legs', "Heroes' Redemption Greaves", 'legs', 'steel', ['intelligence', 'vitality', 'armor']),
      piece('redemption', 'boots', "Heroes' Redemption Sabatons", 'boots', 'steel', ['intelligence', 'manaRegen', 'moveSpeedPercent']),
    ]),
    bonuses: Object.freeze([
      bonus(2, { spellDamagePercent: 8 }, 'Increases spell damage by 8% — your Judgement burns brighter.'),
      bonus(3, { manaRegen: 6 }, 'Restores 6 mana per 5 sec.'),
      bonus(4, { critChance: 3, 'skill:holyLight': 2 }, '+3% critical chance and +2 Holy Light ranks.'),
    ]),
  }),
  Object.freeze({
    id: 'scourgeborne', name: "Heroes' Scourgeborne Battlegear", tier: 'epic', armor: 'plate',
    classes: Object.freeze(['deathKnight']),
    flavor: 'Runed plate of the Ebon Blade, quenched in the blood of the Scourge.',
    pieces: Object.freeze([
      piece('scourgeborne', 'head', "Heroes' Scourgeborne Helmet", 'head', 'steel', ['strength', 'critChance', 'armor']),
      piece('scourgeborne', 'chest', "Heroes' Scourgeborne Chestguard", 'chest', 'steel', ['strength', 'vitality', 'armor']),
      piece('scourgeborne', 'gloves', "Heroes' Scourgeborne Gauntlets", 'gloves', 'steel', ['strength', 'attackSpeedPercent', 'critDamage']),
      piece('scourgeborne', 'legs', "Heroes' Scourgeborne Legplates", 'legs', 'steel', ['strength', 'vitality', 'maxHp']),
      piece('scourgeborne', 'boots', "Heroes' Scourgeborne Sabatons", 'boots', 'steel', ['strength', 'moveSpeedPercent', 'armor']),
    ]),
    bonuses: Object.freeze([
      bonus(2, { critChance: 3 }, '+3% critical chance — your Obliterate finds the seam.'),
      bonus(3, { strength: 15 }, '+15 Strength.'),
      bonus(4, { lifeOnHit: 8, 'skill:deathStrike': 2 }, '+8 life on hit and +2 Death Strike ranks.'),
    ]),
  }),
  Object.freeze({
    id: 'bonescythe', name: "Heroes' Bonescythe Battlegear", tier: 'epic', armor: 'leather',
    classes: Object.freeze(['rogue']),
    flavor: 'Leathers stitched from the bones of Naxxramas\'s fallen.',
    pieces: Object.freeze([
      piece('bonescythe', 'head', "Heroes' Bonescythe Helmet", 'head', 'leather', ['dexterity', 'critChance', 'maxHp']),
      piece('bonescythe', 'chest', "Heroes' Bonescythe Chestguard", 'chest', 'leather', ['dexterity', 'vitality', 'armor']),
      piece('bonescythe', 'gloves', "Heroes' Bonescythe Gauntlets", 'gloves', 'leather', ['dexterity', 'attackSpeedPercent', 'critDamage']),
      piece('bonescythe', 'legs', "Heroes' Bonescythe Legplates", 'legs', 'leather', ['dexterity', 'vitality', 'armor']),
      piece('bonescythe', 'boots', "Heroes' Bonescythe Treads", 'boots', 'leather', ['dexterity', 'moveSpeedPercent', 'lifeOnHit']),
    ]),
    bonuses: Object.freeze([
      bonus(2, { attackSpeedPercent: 6 }, '+6% attack speed — your Sinister Strike flows faster.'),
      bonus(3, { dexterity: 15 }, '+15 Dexterity.'),
      bonus(4, { critDamage: 12, 'skill:eviscerate': 2 }, '+12% critical damage and +2 Eviscerate ranks.'),
    ]),
  }),
  Object.freeze({
    id: 'cryptstalker', name: "Heroes' Cryptstalker Battlegear", tier: 'epic', armor: 'leather',
    classes: Object.freeze(['hunter']),
    flavor: 'Crypt fiend chitin worked into supple hunting leathers.',
    pieces: Object.freeze([
      piece('cryptstalker', 'head', "Heroes' Cryptstalker Headpiece", 'head', 'leather', ['dexterity', 'critChance', 'maxMana']),
      piece('cryptstalker', 'chest', "Heroes' Cryptstalker Tunic", 'chest', 'leather', ['dexterity', 'vitality', 'armor']),
      piece('cryptstalker', 'gloves', "Heroes' Cryptstalker Gloves", 'gloves', 'leather', ['dexterity', 'attackSpeedPercent', 'damagePercent']),
      piece('cryptstalker', 'legs', "Heroes' Cryptstalker Leggings", 'legs', 'leather', ['dexterity', 'vitality', 'armor']),
      piece('cryptstalker', 'boots', "Heroes' Cryptstalker Boots", 'boots', 'leather', ['dexterity', 'moveSpeedPercent', 'maxHp']),
    ]),
    bonuses: Object.freeze([
      bonus(2, { damagePercent: 6 }, 'Increases attack damage by 6% — your pet fights as one with you.'),
      bonus(3, { dexterity: 15 }, '+15 Dexterity.'),
      bonus(4, { critChance: 4, 'skill:aimedShot': 2 }, '+4% critical chance and +2 Aimed Shot ranks.'),
    ]),
  }),
  Object.freeze({
    id: 'frostfire', name: "Heroes' Frostfire Garb", tier: 'epic', armor: 'cloth',
    classes: Object.freeze(['mage']),
    flavor: 'Robes woven from frozen flame, warm to the touch, deadly to the foe.',
    pieces: Object.freeze([
      piece('frostfire', 'head', "Heroes' Frostfire Circlet", 'head', 'silk', ['intelligence', 'maxMana', 'critChance']),
      piece('frostfire', 'chest', "Heroes' Frostfire Robe", 'chest', 'silk', ['intelligence', 'vitality', 'maxHp']),
      piece('frostfire', 'gloves', "Heroes' Frostfire Gloves", 'gloves', 'silk', ['intelligence', 'castSpeedPercent', 'spellDamagePercent']),
      piece('frostfire', 'legs', "Heroes' Frostfire Leggings", 'legs', 'silk', ['intelligence', 'maxMana', 'spellDamagePercent']),
      piece('frostfire', 'boots', "Heroes' Frostfire Slippers", 'boots', 'silk', ['intelligence', 'moveSpeedPercent', 'manaRegen']),
    ]),
    bonuses: Object.freeze([
      bonus(2, { spellDamagePercent: 8 }, 'Increases spell damage by 8% — your Frostbolt bites deeper.'),
      bonus(3, { intelligence: 15 }, '+15 Intelligence.'),
      bonus(4, { critDamage: 12, 'skill:pyroblast': 2 }, '+12% critical damage and +2 Pyroblast ranks.'),
    ]),
  }),
  Object.freeze({
    id: 'faith', name: "Heroes' Regalia of Faith", tier: 'epic', armor: 'cloth',
    classes: Object.freeze(['priest']),
    flavor: 'Vestments blessed at the Cathedral of Light and carried into Naxxramas.',
    pieces: Object.freeze([
      piece('faith', 'head', "Heroes' Circlet of Faith", 'head', 'silk', ['intelligence', 'maxMana', 'manaRegen']),
      piece('faith', 'chest', "Heroes' Robe of Faith", 'chest', 'silk', ['intelligence', 'vitality', 'maxHp']),
      piece('faith', 'gloves', "Heroes' Gloves of Faith", 'gloves', 'silk', ['intelligence', 'castSpeedPercent', 'manaRegen']),
      piece('faith', 'legs', "Heroes' Leggings of Faith", 'legs', 'silk', ['intelligence', 'vitality', 'maxMana']),
      piece('faith', 'boots', "Heroes' Slippers of Faith", 'boots', 'silk', ['intelligence', 'moveSpeedPercent', 'lifeRegen']),
    ]),
    bonuses: Object.freeze([
      bonus(2, { manaRegen: 8 }, 'Restores 8 mana per 5 sec — your Renew lingers.'),
      bonus(3, { intelligence: 15 }, '+15 Intelligence.'),
      bonus(4, { spellDamagePercent: 10, 'skill:prayerOfHealing': 2 }, '+10% spell damage and +2 Prayer of Healing ranks.'),
    ]),
  }),
  Object.freeze({
    id: 'hateful-gladiator', name: "Hateful Gladiator's Battlegear", tier: 'rare', armor: 'plate',
    classes: Object.freeze(['warrior', 'paladin', 'deathKnight']),
    flavor: 'Season 5 arena plate, earned in the underbelly of Dalaran\'s sewers.',
    pieces: Object.freeze([
      piece('hateful-gladiator', 'head', "Hateful Gladiator's Plate Helm", 'head', 'iron', ['strength', 'maxHp']),
      piece('hateful-gladiator', 'chest', "Hateful Gladiator's Plate Chestpiece", 'chest', 'iron', ['strength', 'vitality']),
      piece('hateful-gladiator', 'gloves', "Hateful Gladiator's Plate Gauntlets", 'gloves', 'iron', ['strength', 'critChance']),
      piece('hateful-gladiator', 'legs', "Hateful Gladiator's Plate Legguards", 'legs', 'iron', ['strength', 'armor']),
    ]),
    bonuses: Object.freeze([
      bonus(2, { strength: 10 }, '+10 Strength.'),
      bonus(3, { vitality: 12 }, '+12 Vitality.'),
      bonus(4, { damagePercent: 5 }, 'Increases attack damage by 5%.'),
    ]),
  }),
] as ItemSetDef[]);

export const itemSet = (id: ItemSetId | undefined): ItemSetDef | undefined => ITEM_SETS.find(s => s.id === id);
export const setPiece = (id: SetPieceId | undefined): SetPieceDef | undefined =>
  ITEM_SETS.flatMap(s => s.pieces).find(p => p.id === id);
export const setPieceSet = (pieceDef: SetPieceDef): ItemSetDef =>
  ITEM_SETS.find(s => s.pieces.includes(pieceDef))!;

// ── Set piece items ──
// ItemRecipe is a frozen shared contract, so set membership is encoded in the item
// id as `setpiece:<pieceId>:<seed36>` (the glyph-item pattern). `setPieceOf` also
// accepts an exact authored-name match so identity survives id-stamping call sites
// (vendor stock and POI rewards overwrite item.id).
export const SET_PIECE_PREFIX = 'setpiece:';
/** Fixed roll quantile for authored affixes — same convention as uniques (.75). */
export const SET_PIECE_ROLL = .75;

export function setPieceId(item: Pick<Item, 'id'> | null | undefined): SetPieceId | null {
  const id = item?.id;
  if (!id?.startsWith(SET_PIECE_PREFIX)) return null;
  const pieceId = id.slice(SET_PIECE_PREFIX.length, id.lastIndexOf(':'));
  return setPiece(pieceId) ? pieceId : null;
}

/** Resolve an item to its set piece definition, by encoded id or authored name. */
export function setPieceOf(item: Pick<Item, 'id' | 'name' | 'kind'> | null | undefined): SetPieceDef | undefined {
  if (!item) return undefined;
  const byId = setPieceId(item);
  if (byId) return setPiece(byId);
  return ITEM_SETS.flatMap(s => s.pieces).find(p => p.name === item.name && p.kind === item.kind);
}
export const isSetPiece = (item: Pick<Item, 'id' | 'name' | 'kind'> | null | undefined): boolean => setPieceOf(item) !== undefined;

/** Armor weight class each class wears in WotLK (mail collapses to leather here —
 * the engine has no mail material; hunters and enhancement shaman wear leather). */
export const CLASS_ARMOR: Readonly<Record<WowClassId, SetArmor>> = Object.freeze({
  warrior: 'plate', paladin: 'plate', deathKnight: 'plate',
  rogue: 'leather', hunter: 'leather', druid: 'leather', shaman: 'leather',
  mage: 'cloth', priest: 'cloth', warlock: 'cloth',
});

/** Drop chances by encounter/rank — set pieces are chase loot, rarer than glyphs. */
export const SET_PIECE_DROP = Object.freeze({
  base: .004, veteran: .012, elite: .03,
  event: .05, chest: .06, boss: .15, bossChest: .22,
});
/** Below this enemy/site level set pieces never drop (Naxxramas is endgame gear). */
export const SET_PIECE_MIN_LEVEL = 8;
const SET_PIECE_SEED_SALT = 0x5e7a9c41;

/**
 * Drop-table hook for items.ts generateItem — mirrors legendaryFor. Returns the
 * set piece definition this drop becomes, or null. Consumes a dedicated RNG stream
 * so the caller's draw sequence is untouched. `source` is the MaterialSource the
 * caller already threads through (rank/encounter/level); `classId` optionally
 * biases selection toward the looter's class sets (6x) and armor class (1.5x).
 */
export function setPiecesFor(itemKind: ItemKind, seed: number, source: MaterialSource = {}, classId?: WowClassId): SetPieceDef | null {
  // GAME_FEATURES.itemSets is added by the integrator; absent means enabled.
  if ('itemSets' in GAME_FEATURES && !GAME_FEATURES.itemSets) return null;
  if (source.level !== undefined && source.level < SET_PIECE_MIN_LEVEL) return null;
  const chance = source.encounter ? SET_PIECE_DROP[source.encounter]
    : source.rank === 'elite' ? SET_PIECE_DROP.elite
    : source.rank === 'veteran' ? SET_PIECE_DROP.veteran : SET_PIECE_DROP.base;
  const random = randomSource((seed ^ SET_PIECE_SEED_SALT) >>> 0);
  if (random() >= chance) return null;
  const candidates = ITEM_SETS.flatMap(set => set.pieces.filter(p => p.kind === itemKind).map(p => ({ piece: p, set })));
  if (!candidates.length) return null;
  const weight = (set: ItemSetDef): number => !classId ? 1
    : set.classes.includes(classId) ? 6
    : set.armor === CLASS_ARMOR[classId] ? 1.5 : .4;
  let roll = random() * candidates.reduce((sum, c) => sum + weight(c.set), 0);
  return (candidates.find(c => (roll -= weight(c.set)) < 0) ?? candidates[0]).piece;
}


