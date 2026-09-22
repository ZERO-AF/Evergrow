/** Per-boss raid loot tables (docs/wow-deepening.md §15): each raid boss chest
 * rolls its own named WotLK drop table instead of the generic rank table.
 *
 * Entry kinds map onto the existing item factories:
 * - `setPiece` — a class-set armor piece (item-set-content.ts). `slot` pins the
 *   piece ('head' = Tier-2 helms, 'legs' = Tier-2 legs); absent = any armor
 *   slot (Kel'Thuzad's Tier-3 / the Lich King's Tier-10 equivalents — the
 *   engine's Naxxramas "Heroes'" sets stand in for both).
 * - `legendary` — an authored WOW_LEGENDARIES id (item-naming.ts), proc included.
 * - `epic` — a named epic: generateItem on a fixed profile, then the authored
 *   name/flavor is stamped on (the pvp-vendor stock pattern).
 * - `unique` — an authored UNIQUES id (unique-content.ts).
 * `bonus` is an independent per-chest roll (the Lich King's mount chance).
 * `hardmode` is Sartharion's '3D' payout: when the caller reports drakes alive
 *   at the kill, the chest adds `rolls` extra draws from `drops` and the
 *   guaranteed Twilight Drake (the 'drake' mount stands in). */
import type { Item, ItemKind } from './character-types.ts';
import type { MountId } from './mount-content.ts';
import type { WowClassId } from './wow-types.ts';
import { generateItem, generateLegendary, generateSetPiece, generateUnique } from './items.ts';
import { ITEM_SETS, CLASS_ARMOR, type SetPieceDef } from './item-set-content.ts';
import { RAID_ENTRANCE_ID, ONYXIA_RULES } from './raid-boss-content.ts';
import { RAID2_ENTRANCE_ID, RAGNAROS_RULES } from './raid2-boss-content.ts';
import { RAID3_ENTRANCE_ID, KELTHUZAD_RULES } from './raid3-boss-content.ts';
import { RAID4_ENTRANCE_ID, LICHKING_RULES } from './raid4-boss-content.ts';
import { RAID5_ENTRANCE_ID, MALYGOS_RULES } from './raid5-boss-content.ts';
import { RAID6_ENTRANCE_ID, SARTH_RULES } from './raid6-boss-content.ts';
import { RAID7_ENTRANCE_ID, YOGG_RULES } from './raid7-boss-content.ts';
import { RAID9_ENTRANCE_ID, HALION_RULES } from './raid9-boss-content.ts';
import { RAID8_ENTRANCE_ID, ANUBARAK_RULES } from './raid8-boss-content.ts';

export type RaidLootTableId = 'onyxia' | 'ragnaros' | 'kelthuzad' | 'lichking' | 'malygos' | 'sartharion' | 'yoggsaron' | 'halion' | 'anubarak';

type ArmorSlot = 'head' | 'chest' | 'gloves' | 'legs' | 'boots';
const ARMOR_SLOTS: readonly ArmorSlot[] = Object.freeze(['head', 'chest', 'gloves', 'legs', 'boots']);

export type RaidLootDrop =
  | { readonly kind: 'setPiece'; readonly slot?: ArmorSlot; readonly weight: number }
  | { readonly kind: 'legendary'; readonly legendaryId: string; readonly weight: number }
  | { readonly kind: 'epic'; readonly itemKind: ItemKind; readonly profile?: string; readonly name: string; readonly flavor: string; readonly weight: number }
  | { readonly kind: 'unique'; readonly uniqueId: string; readonly weight: number };

export interface RaidLootTable {
  readonly id: RaidLootTableId;
  readonly name: string;
  /** Chest item rolls per clear (the boss chest mask fits three). */
  readonly rolls: number;
  readonly drops: readonly RaidLootDrop[];
  /** Independent bonus roll — the mount chance. */
  readonly bonus?: { readonly mount: MountId; readonly chance: number };
  /** Hardmode payout (Sartharion '3D'): when the caller reports at least
   * `minDrakes` drakes alive at the kill, the chest adds `rolls` extra draws
   * from `drops` and the guaranteed `mount`. */
  readonly hardmode?: { readonly minDrakes: number; readonly rolls: number; readonly drops: readonly RaidLootDrop[]; readonly mount?: MountId };
}

const drop = (d: RaidLootDrop): RaidLootDrop => Object.freeze(d);

/** Onyxia's hoard: Tier-2 helms plus her signature epics (Vis'kag, the Cornerstone Grimoire). */
const ONYXIA_LOOT: RaidLootTable = Object.freeze({
  id: 'onyxia', name: "Onyxia's Hoard", rolls: 3,
  drops: Object.freeze([
    drop({ kind: 'setPiece', slot: 'head', weight: 55 }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'longsword', weight: 12,
      name: 'Vis\'kag the Bloodletter', flavor: 'The blade still weeps dragon blood.' }),
    drop({ kind: 'epic', itemKind: 'grimoire', profile: 'astral-grimoire', weight: 10,
      name: 'Ancient Cornerstone Grimoire', flavor: 'A broodmother\'s hoard of secrets, bound in scale.' }),
    drop({ kind: 'epic', itemKind: 'cloak', weight: 12,
      name: 'Cloak of the Broodmother', flavor: 'Woven from the webbing of a thousand whelps.' }),
    drop({ kind: 'epic', itemKind: 'amulet', profile: 'warden-amulet', weight: 11,
      name: 'Onyxia Tooth Pendant', flavor: 'A fang of the broodmother, strung on a dragonhide cord.' }),
  ]),
});

/** Ragnaros's cache: Tier-2 legs, Sulfuras, and the Firelord's jewelry. */
const RAGNAROS_LOOT: RaidLootTable = Object.freeze({
  id: 'ragnaros', name: 'Cache of the Firelord', rolls: 3,
  drops: Object.freeze([
    drop({ kind: 'setPiece', slot: 'legs', weight: 55 }),
    drop({ kind: 'legendary', legendaryId: 'sulfuras', weight: 4 }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'rondel-dagger', weight: 12,
      name: 'Perdition\'s Blade', flavor: 'Quenched in the blood of a thousand heroes.' }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'greataxe', weight: 10,
      name: 'Spinal Reaper', flavor: 'Forged from the spine of a Core Hound.' }),
    drop({ kind: 'epic', itemKind: 'ring', profile: 'garnet-band', weight: 10,
      name: 'Band of Accuria', flavor: 'The Firelord\'s favor, set in living flame.' }),
    drop({ kind: 'epic', itemKind: 'amulet', profile: 'warden-amulet', weight: 9,
      name: 'Choker of the Fire Lord', flavor: 'It burns, but never consumes.' }),
  ]),
});

/** Kel'Thuzad's vault: Tier-3 armor (the engine's Naxxramas sets), Atiesh, and his phylactery. */
const KELTHUZAD_LOOT: RaidLootTable = Object.freeze({
  id: 'kelthuzad', name: 'Kel\'Thuzad\'s Vault', rolls: 3,
  drops: Object.freeze([
    drop({ kind: 'setPiece', weight: 55 }),
    drop({ kind: 'legendary', legendaryId: 'atiesh', weight: 4 }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'longsword', weight: 12,
      name: 'The Hungering Cold', flavor: 'The runeblade thirsts for warmth it will never feel.' }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'rondel-dagger', weight: 10,
      name: 'Kingsfall', flavor: 'A dagger that has ended dynasties.' }),
    drop({ kind: 'legendary', legendaryId: 'phylactery-nameless-lich', weight: 10 }),
    drop({ kind: 'epic', itemKind: 'ring', profile: 'garnet-band', weight: 9,
      name: 'Band of Unnatural Forces', flavor: 'The Scourge\'s will, bound in cold iron.' }),
  ]),
});

/** The Frozen Throne's spoils: Tier-10 armor, Frostmourne/Shadowmourne, and Invincible's chance. */
const LICHKING_LOOT: RaidLootTable = Object.freeze({
  id: 'lichking', name: 'Spoils of the Frozen Throne', rolls: 3,
  drops: Object.freeze([
    drop({ kind: 'setPiece', weight: 55 }),
    drop({ kind: 'legendary', legendaryId: 'frostmourne', weight: 3 }),
    drop({ kind: 'legendary', legendaryId: 'shadowmourne', weight: 4 }),
    drop({ kind: 'legendary', legendaryId: 'deathbringers-will', weight: 10 }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'greatblade', weight: 12,
      name: 'Glorenzelg, High-Blade of the Silver Hand', flavor: 'The last blade of a broken order.' }),
    drop({ kind: 'epic', itemKind: 'cloak', weight: 16,
      name: 'Shroud of the Fallen King', flavor: 'It remembers a crown, and the weight of it.' }),
  ]),
  // Invincible's Reins — the Nether Drake stands in as the achievement-gated mount.
  bonus: Object.freeze({ mount: 'drake' as MountId, chance: .02 }),
});

/** Malygos's cache: Tier-7 chests plus the Spell-Weaver's signature spell weapons and trinkets. */
const MALYGOS_LOOT: RaidLootTable = Object.freeze({
  id: 'malygos', name: 'Cache of the Spell-Weaver', rolls: 3,
  drops: Object.freeze([
    drop({ kind: 'setPiece', slot: 'chest', weight: 55 }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'star-wand', weight: 12,
      name: 'Azure Spellblade', flavor: 'A blade of pure ley energy, drawn from the Nexus itself.' }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'ember-staff', weight: 10,
      name: 'Staff of Restraint', flavor: 'The Spell-Weaver\'s leash, turned against him.' }),
    drop({ kind: 'epic', itemKind: 'orb', profile: 'astral-orb', weight: 10,
      name: 'Illustration of the Dragon Soul', flavor: 'Every dragon\'s death, catalogued in arcane ink.' }),
    drop({ kind: 'epic', itemKind: 'amulet', profile: 'sage-pendant', weight: 9,
      name: 'Favor of the Dragon Queen', flavor: 'Alexstrasza\'s gratitude, bound in living gold.' }),
    drop({ kind: 'epic', itemKind: 'ring', profile: 'sapphire-ring', weight: 9,
      name: 'Signet of the Malevolent', flavor: 'It hums with the ley lines\' stolen power.' }),
  ]),
  // Reins of the Blue Drake — the Nether Drake stands in as the achievement-gated mount.
  bonus: Object.freeze({ mount: 'drake' as MountId, chance: .03 }),
});

/** Sartharion's satchel: Tier-7 gloves plus the Onyx Guardian's hoard. The '3D'
 * hardmode (three drakes alive at the kill) adds a bonus roll and the
 * guaranteed Twilight Drake. */
const SARTH_LOOT: RaidLootTable = Object.freeze({
  id: 'sartharion', name: 'Satchel of Spoils', rolls: 3,
  drops: Object.freeze([
    drop({ kind: 'setPiece', slot: 'gloves', weight: 55 }),
    drop({ kind: 'epic', itemKind: 'charm', weight: 12,
      name: 'Satchel of Spoils', flavor: 'The Onyx Guardian\'s tribute, still warm from the lava.' }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'vanguard-halberd', weight: 12,
      name: 'Black Ice', flavor: 'A polearm of frozen twilight, sharp enough to cut a shadow.' }),
    drop({ kind: 'epic', itemKind: 'cloak', weight: 11,
      name: 'Gale-Proof Cloak', flavor: 'Woven to weather a dragon\'s wingbeat.' }),
    drop({ kind: 'epic', itemKind: 'ring', profile: 'garnet-band', weight: 10,
      name: 'Circle of Arcane Streams', flavor: 'The sanctum\'s lava, bound in a band of gold.' }),
  ]),
  hardmode: Object.freeze({
    minDrakes: 3, rolls: 1,
    drops: Object.freeze([
      drop({ kind: 'epic', itemKind: 'amulet', profile: 'sage-pendant', weight: 10,
        name: 'Twilight Drake\'s Favor', flavor: 'The twilight flight\'s blessing, earned the hard way.' }),
      drop({ kind: 'epic', itemKind: 'orb', profile: 'cinder-orb', weight: 10,
        name: 'Essence of the Obsidian Sanctum', flavor: 'A coal that never cools.' }),
    ]),
    // Reins of the Twilight Drake — guaranteed on a three-drake kill.
    mount: 'drake' as MountId,
  }),
});

/** Yogg-Saron's cache: Tier-8 helms and chests plus the God of Death's hoard.
 * Mimiron's Head stands in via the Mekgineer's Chopper mount art. */
const YOGG_LOOT: RaidLootTable = Object.freeze({
  id: 'yoggsaron', name: 'Cache of the Old God', rolls: 3,
  drops: Object.freeze([
    drop({ kind: 'setPiece', slot: 'head', weight: 30 }),
    drop({ kind: 'setPiece', slot: 'chest', weight: 25 }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'rondel-dagger', weight: 12,
      name: 'Kingsbane', flavor: 'The blade that unmade a kingdom\'s sanity.' }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'greataxe', weight: 11,
      name: 'Dark Edge of Depravity', flavor: 'It whispers to the hand that holds it.' }),
    drop({ kind: 'epic', itemKind: 'amulet', profile: 'sage-pendant', weight: 11,
      name: 'Pendant of a Thousand Maws', flavor: 'Every maw speaks a different truth.' }),
    drop({ kind: 'epic', itemKind: 'cloak', weight: 11,
      name: 'Shawl of Haunted Memories', flavor: 'Woven from dreams the Old God has eaten.' }),
  ]),
  // Mimiron's Head — the Mekgineer's Chopper stands in as the mount drop.
  bonus: Object.freeze({ mount: 'chopper' as MountId, chance: .02 }),
});

/** Halion's hoard: Tier-10 boots plus the Twilight Destroyer's signature
 * scale trinkets and jewelry — the Ruby Sanctum's twilight spoils. */
const HALION_LOOT: RaidLootTable = Object.freeze({
  id: 'halion', name: 'Hoard of the Twilight Destroyer', rolls: 3,
  drops: Object.freeze([
    drop({ kind: 'setPiece', slot: 'boots', weight: 55 }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'rondel-dagger', weight: 12,
      name: 'Surgeon\'s Needle', flavor: 'Fine enough to stitch a soul back into its body.' }),
    drop({ kind: 'epic', itemKind: 'charm', weight: 12,
      name: 'Charred Twilight Scale', flavor: 'A scale of the Destroyer, still smoldering between worlds.' }),
    drop({ kind: 'epic', itemKind: 'charm', weight: 10,
      name: 'Glowing Twilight Scale', flavor: 'It hums with light that is not quite light.' }),
    drop({ kind: 'epic', itemKind: 'ring', profile: 'garnet-band', weight: 10,
      name: 'Signet of Twilight', flavor: 'Half in this world, half in the next.' }),
    drop({ kind: 'epic', itemKind: 'amulet', profile: 'sage-pendant', weight: 9,
      name: 'Penumbra Pendant', flavor: 'A shadow cast by a fire that never dies.' }),
    drop({ kind: 'epic', itemKind: 'cloak', weight: 9,
      name: 'Abduction\'s Cover', flavor: 'It remembers the moment the sanctum fell.' }),
  ]),
  // Reins of the Twilight Drake — the Nether Drake stands in as the achievement-gated mount.
  bonus: Object.freeze({ mount: 'drake' as MountId, chance: .02 }),
});

/** The Crusader's Tribute: Tier-9 armor plus the Traitor King's hoard — the
 * Argent Coliseum's spoils. The Crusader's Warhorse stands in via the
 * Spectral Steed mount art. */
const ANUBARAK_LOOT: RaidLootTable = Object.freeze({
  id: 'anubarak', name: 'The Crusader\'s Tribute', rolls: 3,
  drops: Object.freeze([
    drop({ kind: 'setPiece', weight: 55 }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'greataxe', weight: 12,
      name: 'The Lion\'s Maw', flavor: 'An Argent Crusade greatblade, blooded in the pit.' }),
    drop({ kind: 'epic', itemKind: 'weapon', profile: 'longsword', weight: 11,
      name: 'Fordragon Blades', flavor: 'Forged for the march on Icecrown.' }),
    drop({ kind: 'epic', itemKind: 'cloak', weight: 11,
      name: 'Drape of the Untamed Predator', flavor: 'A carapace cloak, cold as the pit floor.' }),
    drop({ kind: 'epic', itemKind: 'amulet', profile: 'sage-pendant', weight: 10,
      name: 'Mystifying Charm', flavor: 'A Nerubian ward, still whispering.' }),
    drop({ kind: 'epic', itemKind: 'ring', profile: 'garnet-band', weight: 10,
      name: 'Signet of the Traitor King', flavor: 'Azjol-Nerub\'s crown, pressed into a band.' }),
  ]),
  // Crusader's White/Black Warhorse — the Spectral Steed stands in as the mount drop.
  bonus: Object.freeze({ mount: 'spectralSteed' as MountId, chance: .04 }),
});

export const RAID_LOOT_TABLES: Readonly<Record<RaidLootTableId, RaidLootTable>> = Object.freeze({
  onyxia: ONYXIA_LOOT, ragnaros: RAGNAROS_LOOT, kelthuzad: KELTHUZAD_LOOT, lichking: LICHKING_LOOT,
  malygos: MALYGOS_LOOT, sartharion: SARTH_LOOT, yoggsaron: YOGG_LOOT, halion: HALION_LOOT, anubarak: ANUBARAK_LOOT,
});

/** Entrance id → the boss's named table, keyed off each content file's `lootTable` field. */
export const RAID_BOSS_LOOT: Readonly<Record<string, RaidLootTableId>> = Object.freeze(Object.fromEntries([
  [RAID_ENTRANCE_ID, ONYXIA_RULES.lootTable],
  [RAID2_ENTRANCE_ID, RAGNAROS_RULES.lootTable],
  [RAID3_ENTRANCE_ID, KELTHUZAD_RULES.lootTable],
  [RAID4_ENTRANCE_ID, LICHKING_RULES.lootTable],
  [RAID5_ENTRANCE_ID, MALYGOS_RULES.lootTable],
  [RAID6_ENTRANCE_ID, SARTH_RULES.lootTable],
  [RAID7_ENTRANCE_ID, YOGG_RULES.lootTable],
  [RAID9_ENTRANCE_ID, HALION_RULES.lootTable],
  [RAID8_ENTRANCE_ID, ANUBARAK_RULES.lootTable],
]));

export const raidLootTable = (entranceId: string | undefined | null): RaidLootTable | undefined =>
  entranceId ? RAID_LOOT_TABLES[RAID_BOSS_LOOT[entranceId]] : undefined;

export interface RaidBossLoot { readonly items: Item[]; readonly mount?: MountId }

/** Set-piece selection mirrors setPiecesFor's class weighting (6x own class,
 * 1.5x matching armor class) minus its drop-chance gate — the table already won. */
function pickSetPiece(slot: ArmorSlot | undefined, random: () => number, classId?: WowClassId): SetPieceDef {
  const slots = slot ? [slot] : ARMOR_SLOTS;
  const candidates = ITEM_SETS.flatMap(set => set.pieces.filter(p => slots.includes(p.kind as ArmorSlot)).map(p => ({ piece: p, set })));
  if (!candidates.length) throw new RangeError(`No set piece for slot: ${slot ?? 'any'}`);
  const weight = (set: (typeof candidates)[number]['set']): number => !classId ? 1
    : set.classes.includes(classId) ? 6
    : set.armor === CLASS_ARMOR[classId] ? 1.5 : .4;
  let roll = random() * candidates.reduce((sum, c) => sum + weight(c.set), 0);
  return (candidates.find(c => (roll -= weight(c.set)) < 0) ?? candidates[0]).piece;
}

function rollDrop(drop: RaidLootDrop, seed: number, itemLevel: number, random: () => number, classId?: WowClassId): Item {
  switch (drop.kind) {
    case 'setPiece': return generateSetPiece(pickSetPiece(drop.slot, random, classId), seed, itemLevel);
    case 'legendary': return generateLegendary(seed, itemLevel, drop.legendaryId);
    case 'unique': return generateUnique(seed, itemLevel, drop.uniqueId);
    case 'epic': {
      const item = generateItem(seed, itemLevel, drop.itemKind, drop.profile, 'epic');
      item.name = drop.name; item.baseName = drop.name; item.flavor = drop.flavor;
      if (item.weapon) item.weapon = { ...item.weapon, name: drop.name };
      if (item.shield) item.shield = { ...item.shield, name: drop.name };
      if (item.focus) item.focus = { ...item.focus, name: drop.name };
      return item;
    }
  }
}

/**
 * Roll a raid boss's chest: `rolls` weighted draws from the boss's named table
 * plus the independent bonus (mount) roll. `random` is the caller's seeded
 * stream — same entrance seed, same haul. `bossId` is the entrance id.
 * `context.drakesAlive` is Sartharion's kill-time drake count (the caller reads
 * `sartharionDrakesAlive(run)`); at `hardmode.minDrakes` the chest adds the
 * hardmode rolls and the guaranteed mount.
 */
export function raidBossLoot(bossId: string, random: () => number, itemLevel: number, classId?: WowClassId,
  context?: { drakesAlive?: number }): RaidBossLoot | undefined {
  const table = raidLootTable(bossId);
  if (!table) return undefined;
  const items: Item[] = [];
  const rollFrom = (drops: readonly RaidLootDrop[]) => {
    const total = drops.reduce((sum, d) => sum + d.weight, 0);
    let roll = random() * total;
    const picked = drops.find(d => (roll -= d.weight) < 0) ?? drops[drops.length - 1];
    const seed = Math.floor(random() * 4294967296);
    items.push(rollDrop(picked, seed, itemLevel, random, classId));
  };
  for (let i = 0; i < table.rolls; i++) rollFrom(table.drops);
  const hardmode = table.hardmode && (context?.drakesAlive ?? 0) >= table.hardmode.minDrakes ? table.hardmode : undefined;
  if (hardmode) for (let i = 0; i < hardmode.rolls; i++) rollFrom(hardmode.drops);
  const mount = hardmode?.mount ?? (table.bonus && random() < table.bonus.chance ? table.bonus.mount : undefined);
  return { items, ...(mount ? { mount } : {}) };
}
