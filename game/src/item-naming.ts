import type { EquipmentSlot, ItemKind, ItemTier } from './character-types.ts';
import type { WeaponFamily } from './model.ts';
import type { WowClassId } from './wow-types.ts';

/**
 * WoW (WotLK) flavored gear naming — pure data + pure functions.
 *
 * `WOW_ITEM_NAMES` materializes per-slot per-rarity name pools at module init
 * from base nouns × rarity modifiers, so every bucket holds 64 hand-authored
 * combinations ('Sturdy Cobalt Claymore', 'Signet of the Frozen Throne').
 * `generateWowName` draws deterministically from a caller-supplied rng.
 * `legendaryFor` is the rare fixed-name roll over `WOW_LEGENDARIES`.
 *
 * Weapon families match the model `WeaponFamily` union (design contract §7).
 */

/** Weapon families name pools exist for — the model `WeaponFamily` union. */
export type WowWeaponFamily = WeaponFamily;

/** Every gear bucket key: weapon families plus non-weapon item kinds. */
export type WowGearKey = WowWeaponFamily
  | 'shield' | 'grimoire' | 'orb' | 'relic'
  | 'head' | 'chest' | 'gloves' | 'legs' | 'boots' | 'cloak'
  | 'amulet' | 'ring' | 'charm';

/** A fixed legendary/artifact entry (design contract §7 unique-content). */
export interface WowLegendary {
  id: string;
  name: string;
  /** Item kind the legendary occupies ('weapon' uses `family`). */
  slot: ItemKind;
  /** Weapon family when slot is 'weapon'. */
  family?: WowWeaponFamily;
  /** Weapon handedness; absent on non-weapon legendaries. */
  hands?: 1 | 2;
  /** Iconic class association, when one exists. */
  classId?: WowClassId;
  flavor: string;
}

/** Chance that legendaryFor returns a legendary instead of null. */
export const LEGENDARY_DROP_CHANCE = 0.005;

const ITEM_TIERS: readonly ItemTier[] = Object.freeze(['common', 'magic', 'rare', 'epic', 'legendary', 'unique']);

/** Base nouns per gear bucket — shared across rarities, WoW-style. */
const NAME_BASES: Readonly<Record<WowGearKey, readonly string[]>> = Object.freeze({
  sword: Object.freeze(['Longsword', 'Claymore', 'Broadsword', 'Greatsword', 'Sabre', 'Blade', 'Falchion', 'Warblade']),
  axe: Object.freeze(['Handaxe', 'Greataxe', 'War Axe', 'Cleaver', 'Hewer', 'Battle Axe', 'Headsman\'s Axe', 'Splitter']),
  mace: Object.freeze(['Mace', 'Maul', 'Warhammer', 'Morningstar', 'Crusher', 'Gavel', 'Scepter', 'Pounder']),
  dagger: Object.freeze(['Dagger', 'Shiv', 'Stiletto', 'Kris', 'Fang', 'Dirk', 'Rondel', 'Gutripper']),
  bow: Object.freeze(['Shortbow', 'Longbow', 'Recurve Bow', 'War Bow', 'Composite Bow', 'Flatbow', 'Hunting Bow', 'Crossbow']),
  staff: Object.freeze(['Staff', 'Greatstaff', 'Spire', 'Crozier', 'Quarterstaff', 'Rod', 'Stave', 'Battle Staff']),
  wand: Object.freeze(['Wand', 'Rod', 'Baton', 'Scepter', 'Spellwand', 'Channeler', 'Star Rod', 'Hex Wand']),
  fist: Object.freeze(['Knuckles', 'Claws', 'Fist Weapon', 'Handwraps', 'Talons', 'Cestus', 'Katar', 'Punchblade']),
  polearm: Object.freeze(['Polearm', 'Halberd', 'Glaive', 'Spear', 'Pike', 'Lance', 'Scythe', 'Voulge']),
  gun: Object.freeze(['Rifle', 'Musket', 'Blunderbuss', 'Longrifle', 'Carbine', 'Boomstick', 'Flintlock', 'Hand Cannon']),
  unarmed: Object.freeze(['Handwraps', 'Knuckles', 'Wraps', 'Mitts', 'Fistwraps', 'Brawler Gloves', 'Tape', 'Clinchers']),
  shield: Object.freeze(['Shield', 'Bulwark', 'Aegis', 'Kite Shield', 'Tower Shield', 'Buckler', 'Targe', 'Ward']),
  grimoire: Object.freeze(['Grimoire', 'Tome', 'Codex', 'Lexicon', 'Spellbook', 'Folio', 'Manual', 'Compendium']),
  orb: Object.freeze(['Orb', 'Sphere', 'Globe', 'Focus', 'Crystal', 'Eye', 'Shard', 'Beacon']),
  relic: Object.freeze(['Totem', 'Libram', 'Idol', 'Sigil', 'Relic', 'Fetish', 'Emblem', 'Icon', 'Runestone', 'Effigy', 'Talisman', 'Wardstone']),
  head: Object.freeze(['Helm', 'Greathelm', 'Circlet', 'Hood', 'Cowl', 'Crown', 'Visage', 'Coif']),
  chest: Object.freeze(['Breastplate', 'Chestguard', 'Hauberk', 'Robe', 'Vestments', 'Tunic', 'Cuirass', 'Harness']),
  gloves: Object.freeze(['Gauntlets', 'Gloves', 'Grips', 'Handguards', 'Mitts', 'Crushers', 'Grasps', 'Wraps']),
  legs: Object.freeze(['Greaves', 'Legplates', 'Leggings', 'Chausses', 'Kilt', 'Tassets', 'Breeches', 'Legguards']),
  boots: Object.freeze(['Sabatons', 'Boots', 'Treads', 'Footguards', 'Striders', 'Stompers', 'Warboots', 'Slippers']),
  cloak: Object.freeze(['Cloak', 'Mantle', 'Cape', 'Shroud', 'Drape', 'Pelt', 'Wrap', 'Greatcloak']),
  amulet: Object.freeze(['Amulet', 'Pendant', 'Talisman', 'Choker', 'Medallion', 'Locket', 'Necklace', 'Torc']),
  ring: Object.freeze(['Ring', 'Band', 'Signet', 'Loop', 'Seal', 'Circle', 'Hoop', 'Solitaire']),
  charm: Object.freeze(['Charm', 'Idol', 'Fetish', 'Totem', 'Trinket', 'Relic', 'Figurine', 'Effigy']),
});

/** Rarity modifiers — applied as prefixes (common/magic/rare) or suffixes. */
const RARITY_MODIFIERS: Readonly<Record<ItemTier, readonly string[]>> = Object.freeze({
  common: Object.freeze(['Worn', 'Sturdy', 'Battered', 'Rugged', 'Militia', 'Weathered', 'Crude', 'Trusty']),
  magic: Object.freeze(['Gleaming', 'Runed', 'Charged', 'Icy', 'Emblazoned', 'Spellwoven', 'Glowing', 'Enchanted']),
  rare: Object.freeze(['Sturdy Cobalt', 'Runed Saronite', 'Polished Titansteel', 'Wyrmrest', 'Argent Crusade', 'Kirin Tor', 'Ebon Blade', 'Frostforged']),
  epic: Object.freeze(['of the Frozen Throne', 'of the Lich King', 'of the Borean Gale', 'of the Argent Vanguard', 'of the Ebon Blade', 'of the Nexus', 'of the Dragonflights', 'of the Fallen King']),
  legendary: Object.freeze(['of the Ashen Verdict', 'of the Scourge\'s End', 'of the Light\'s Wrath', 'of the Frozen Wastes', 'of the Titans', 'of the Old Gods', 'of the Dragon Soul', 'of the Sundered Throne']),
  unique: Object.freeze(['of the Windseeker', 'of the Firelord', 'of Azzinoth', 'of the Betrayer', 'of the Guardian', 'of the Void', 'of the Dawn', 'of Eternal Winter']),
});

const PREFIX_TIERS: Readonly<Record<ItemTier, boolean>> = Object.freeze({
  common: true, magic: true, rare: true, epic: false, legendary: false, unique: false,
});

function buildPool(bases: readonly string[], modifiers: readonly string[], prefix: boolean): readonly string[] {
  const out: string[] = [];
  for (const mod of modifiers) {
    for (const base of bases) out.push(prefix ? `${mod} ${base}` : `${base} ${mod}`);
  }
  return Object.freeze(out);
}

/**
 * Per-slot per-rarity name pools. Weapons are keyed by family
 * (`WOW_ITEM_NAMES.sword.rare`), armor and jewelry by item kind
 * (`WOW_ITEM_NAMES.head.epic`). Buckets hold bases × rarity-modifier names.
 */
export const WOW_ITEM_NAMES: Readonly<Record<WowGearKey, Readonly<Record<ItemTier, readonly string[]>>>> = Object.freeze(
  Object.fromEntries((Object.keys(NAME_BASES) as WowGearKey[]).map(key => [key, Object.freeze(
    Object.fromEntries(ITEM_TIERS.map(tier => [tier, buildPool(NAME_BASES[key], RARITY_MODIFIERS[tier], PREFIX_TIERS[tier])])),
  )])) as Record<WowGearKey, Readonly<Record<ItemTier, readonly string[]>>>,
);

/** Fixed legendary/artifact table — WotLK-era icons plus class artifacts. */
export const WOW_LEGENDARIES: readonly WowLegendary[] = Object.freeze([
  { id: 'thunderfury', name: 'Thunderfury, Blessed Blade of the Windseeker', slot: 'weapon', family: 'sword', hands: 1,
    flavor: 'The wind itself obeys its wielder.' },
  { id: 'sulfuras', name: 'Sulfuras, Hand of Ragnaros', slot: 'weapon', family: 'mace', hands: 2,
    flavor: 'Forged in the heart of the Firelands to serve the Firelord.' },
  { id: 'warglaive-azzinoth', name: 'Warglaive of Azzinoth', slot: 'weapon', family: 'sword', hands: 1,
    flavor: 'One half of the Betrayer\'s twin arsenal.' },
  { id: 'atiesh', name: 'Atiesh, Greatstaff of the Guardian', slot: 'weapon', family: 'staff', hands: 2, classId: 'mage',
    flavor: 'Last wielded by Medivh, the final Guardian of Tirisfal.' },
  { id: 'shadowmourne', name: 'Shadowmourne', slot: 'weapon', family: 'axe', hands: 2, classId: 'deathKnight',
    flavor: 'A weapon fed on a thousand souls, forged to rival Frostmourne.' },
  { id: 'valanyr', name: 'Val\'anyr, Hammer of Ancient Kings', slot: 'weapon', family: 'mace', hands: 1, classId: 'priest',
    flavor: 'Reforged from the fragments of a titan keeper\'s gift.' },
  { id: 'dragonwrath', name: 'Dragonwrath, Tarecgosa\'s Rest', slot: 'weapon', family: 'staff', hands: 2, classId: 'mage',
    flavor: 'The essence of the blue dragon Tarecgosa endures within.' },
  { id: 'fangs-of-the-father', name: 'Fangs of the Father', slot: 'weapon', family: 'dagger', hands: 1, classId: 'rogue',
    flavor: 'A paired set of daggers steeped in the blood of Deathwing.' },
  { id: 'frostmourne', name: 'Frostmourne', slot: 'weapon', family: 'sword', hands: 2, classId: 'deathKnight',
    flavor: 'The cursed runeblade of the Lich King. It hungers.' },
  { id: 'ashbringer', name: 'Ashbringer', slot: 'weapon', family: 'sword', hands: 2, classId: 'paladin',
    flavor: 'Forged from a crystal of pure Light — bane of the undead.' },
  { id: 'thoridal', name: 'Thori\'dal, the Stars\' Fury', slot: 'weapon', family: 'bow', hands: 2, classId: 'hunter',
    flavor: 'Its arrows are drawn from the very fabric of the stars.' },
  { id: 'quel-delar', name: 'Quel\'Delar, Might of the Faithful', slot: 'weapon', family: 'sword', hands: 1,
    flavor: 'Sister blade of Quel\'Serrar, restored in the Sunwell\'s light.' },
  { id: 'shadows-edge', name: 'Shadow\'s Edge', slot: 'weapon', family: 'axe', hands: 2,
    flavor: 'The unfinished precursor to Shadowmourne, already fed on souls.' },
  { id: 'doomhammer', name: 'Doomhammer', slot: 'weapon', family: 'mace', hands: 1, classId: 'shaman',
    flavor: 'The hammer of Orgrim Doomhammer, forged on Draenor long ago.' },
  { id: 'oathbinder', name: 'Oathbinder, Charge of the Ranger-General', slot: 'weapon', family: 'polearm', hands: 2,
    flavor: 'The blade of Sylvanas Windrunner, broken and reforged.' },
  { id: 'titanstrike', name: 'Titanstrike', slot: 'weapon', family: 'gun', hands: 2, classId: 'hunter',
    flavor: 'A titan-forged rifle that channels the storm itself.' },
  { id: 'fangs-of-ashamane', name: 'Fangs of Ashamane', slot: 'weapon', family: 'fist', hands: 1, classId: 'druid',
    flavor: 'The great cat\'s claws still tear at anything that threatens the wilds.' },
  // Relic artifacts: one per relic class (totem/libram/idol/sigil).
  { id: 'libram-of-radiance', name: 'Libram of Radiance', slot: 'relic', classId: 'paladin',
    flavor: 'Its pages turn themselves toward the Light.' },
  { id: 'totem-of-the-earthen-ring', name: 'Totem of the Earthen Ring', slot: 'relic', classId: 'shaman',
    flavor: 'The elements answer before it is even planted.' },
  { id: 'idol-of-the-emerald-dream', name: 'Idol of the Emerald Dream', slot: 'relic', classId: 'druid',
    flavor: 'It dreams of a forest that never ends.' },
  { id: 'sigil-of-the-ebon-blade', name: 'Sigil of the Ebon Blade', slot: 'relic', classId: 'deathKnight',
    flavor: 'A knight\'s oath, etched in runes that never warm.' },
  // Trinkets ride the jewelry slots; armor legendaries carry defensive procs.
  { id: 'deaths-verdict', name: 'Death\'s Verdict', slot: 'amulet',
    flavor: 'The verdict is rendered. The sentence is death.' },
  { id: 'comets-trail', name: 'Comet\'s Trail', slot: 'amulet',
    flavor: 'A shard of the comet that streaks across the night sky.' },
  { id: 'darkmoon-greatness', name: 'Darkmoon Card: Greatness', slot: 'amulet',
    flavor: 'The greatest card in the Darkmoon deck.' },
  { id: 'deathbringers-will', name: 'Deathbringer\'s Will', slot: 'amulet',
    flavor: 'Saurfang\'s fury endures beyond the grave.' },
  { id: 'phylactery-nameless-lich', name: 'Phylactery of the Nameless Lich', slot: 'amulet',
    flavor: 'The soul of a nameless lich festers within.' },
  { id: 'reign-of-the-dead', name: 'Reign of the Dead', slot: 'ring',
    flavor: 'The dead do not rest; they reign.' },
  { id: 'tiny-abomination', name: 'Tiny Abomination in a Jar', slot: 'ring',
    flavor: 'It rattles against the glass, hungry.' },
  { id: 'solace-of-the-defeated', name: 'Solace of the Defeated', slot: 'amulet',
    flavor: 'Even in defeat, there is solace.' },
  { id: 'pandoras-plea', name: 'Pandora\'s Plea', slot: 'amulet',
    flavor: 'Open the box. You know you want to.' },
  { id: 'ephemeral-snowflake', name: 'Ephemeral Snowflake', slot: 'ring',
    flavor: 'A snowflake that never melts, stolen from winter\'s heart.' },
  { id: 'corpse-tongue-coin', name: 'Corpse Tongue Coin', slot: 'ring',
    flavor: 'A coin clenched in a dead man\'s teeth.' },
  { id: 'essence-of-gossamer', name: 'Essence of Gossamer', slot: 'cloak',
    flavor: 'Spun from threads too fine for mortal eyes.' },
  { id: 'satrinas-impeding-scarab', name: 'Satrina\'s Impeding Scarab', slot: 'chest',
    flavor: 'The scarab\'s shell turns aside the killing blow.' },
  { id: 'the-black-heart', name: 'The Black Heart', slot: 'boots',
    flavor: 'It beats still, cold and heavy as iron.' },
  { id: 'juggernauts-vitality', name: 'Juggernaut\'s Vitality', slot: 'head',
    flavor: 'The juggernaut does not fall; it endures.' },
]);

function nameKeyFor(slot: ItemKind | EquipmentSlot, family: WowWeaponFamily | undefined): WowGearKey {
  if (slot === 'ring1' || slot === 'ring2') return 'ring';
  if (slot === 'offhand') return 'shield';
  if (slot === 'riftKey') return 'charm';
  if (slot === 'weapon') return family !== undefined && family in NAME_BASES ? family : 'sword';
  return slot in NAME_BASES ? slot as WowGearKey : 'charm';
}

/**
 * Deterministic WoW-flavored name for a gear slot.
 * `slot` accepts item kinds and equipment slots ('ring1'/'offhand' normalize);
 * `family` selects the weapon pool and is ignored for non-weapons.
 */
export function generateWowName(
  slot: ItemKind | EquipmentSlot,
  family: WowWeaponFamily | undefined,
  rarity: ItemTier,
  rng: () => number,
): string {
  const pool = WOW_ITEM_NAMES[nameKeyFor(slot, family)][rarity];
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/**
 * Rare legendary roll (<0.5%). `slot` may be an item kind ('weapon' rolls the
 * whole weapon table), an equipment slot, or a weapon family ('bow' rolls only
 * bow legendaries). Returns null when the roll fails or no legendary exists.
 */
export function legendaryFor(slot: ItemKind | EquipmentSlot | WowWeaponFamily, rng: () => number): WowLegendary | null {
  if (rng() >= LEGENDARY_DROP_CHANCE) return null;
  const key = slot === 'ring1' || slot === 'ring2' ? 'ring' : slot === 'offhand' ? 'shield' : slot;
  const pool = WOW_LEGENDARIES.filter(l => l.slot === key || l.family === key);
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] : null;
}
