/** Zone-appropriate enemy roster (critic wave): every zone renames the shared
 * EnemyKind archetypes into the mob families WoW players expect there —
 * Elwynn's stalkers are Defias Cutpurses, its hounds Riverpaw Gnolls; the same
 * kinds in Icecrown read as Scourge Ghouls and Frostbrood Whelps. The 18
 * archetypes keep their AI, stats and art; this layer only swaps the display
 * name and an optional body tint.
 *
 * Resolution is derived, never stored: zone comes from the enemy's spawn anchor
 * (homeX/homeY — stable across save/load and border crossings), the name index
 * comes from `lootSeed` (persisted), and `biome` supplies the fallback family
 * for unlisted zones. Dungeon actors (`dungeonTheme`) keep their theme names.
 * Headless: no DOM, no sim imports — safe for combat-damage/chat-log. */

import type { BiomeId } from './biomes.ts';
import type { Enemy, EnemyKind } from './model.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { zoneAt } from './world-atlas.ts';

/** One local mob family mapped onto an archetype. `names` rotates by lootSeed
 * so a camp reads as a tribe, not a clone stamp. `tint` recolors the whole rig
 * (mixed under the hit-flash) for families whose skin must sell the zone —
 * Scourge pallor, fel green, frostbite blue. */
export interface RosterSkin {
  readonly names: readonly string[];
  readonly tint?: string;
  /** Mix strength toward `tint`; defaults to 0.3 — a wash, not a repaint. */
  readonly tintAmount?: number;
}

/** Table shorthand: 'Name' | ['A','B'] | {names,tint?}. */
export type RosterEntry = string | readonly string[] | RosterSkin;
export type ZoneRoster = Readonly<Partial<Record<EnemyKind, RosterEntry>>>;

const skin = (entry: RosterEntry): RosterSkin =>
  typeof entry === 'string' ? Object.freeze({ names: Object.freeze([entry]) })
    : 'names' in entry ? Object.freeze({ ...entry, names: Object.freeze(entry.names) })
    : Object.freeze({ names: Object.freeze(entry) });
const normalize = (table: Readonly<Record<string, ZoneRoster>>): Readonly<Record<string, Readonly<Partial<Record<EnemyKind, RosterSkin>>>>> =>
  Object.freeze(Object.fromEntries(Object.entries(table).map(([id, roster]) => [id,
    Object.freeze(Object.fromEntries(Object.entries(roster).map(([kind, entry]) => [kind, skin(entry)])))])));

// ── Kalimdor ─────────────────────────────────────────────────────────────────
const KALIMDOR_ROSTERS: Readonly<Record<string, ZoneRoster>> = Object.freeze({
  'teldrassil': {
    stalker: 'Gnarlpine Ambusher', hound: ['Nightsaber', 'Mangy Nightsaber'],
    wisp: 'Forest Wisp', brute: 'Gnarlpine Ursa', caster: 'Gnarlpine Shaman',
  },
  'bloodmyst': {
    stalker: 'Sunhawk Spy', caster: ['Sunhawk Saboteur', 'Vector Coil Cultist'],
    wisp: 'Corrupted Wisp', hound: 'Mutated Lasher', brute: 'Axxarien Hellcaller', archer: 'Sunhawk Marksman',
  },
  'azuremyst': {
    stalker: 'Bristlelimb Pathfinder', hound: 'Infected Nightstalker',
    wisp: 'Ammen Vale Wisp', archer: 'Bristlelimb Hunter', brute: 'Bristlelimb Ursa',
  },
  'moonglade': { wisp: 'Moonglade Wisp', stalker: 'Corrupted Keeper', hound: 'Tainted Nightsaber' },
  'winterspring': {
    frostRevenant: { names: ['Frostmaul Preserver', 'Ice Thistle Patriarch'], tint: '#9fd4f0', tintAmount: .3 },
    stalker: 'Winterfall Pathfinder', brute: 'Winterfall Den Watcher',
    hound: 'Frostsaber Huntress', caster: 'Winterfall Totemic',
  },
  'darkshore': {
    hound: 'Moonstalker', stalker: 'Greymist Raider', wisp: 'Darkshore Wisp',
    brute: 'Rabid Thistle Bear', caster: 'Twilight Cultist',
  },
  'felwood': {
    caster: 'Jadefire Satyr', stalker: 'Jadefire Trickster', brute: 'Deadwood Warrior',
    hound: { names: ['Felhound', 'Tainted Ooze'], tint: '#7dd069', tintAmount: .3 },
    wisp: 'Entropic Horror',
  },
  'azshara': {
    stalker: 'Haldarr Trickster', caster: 'Haldarr Satyr', brute: 'Cliff Giant',
    hound: 'Mistwing Ravager', wisp: 'Highborne Apparition',
  },
  'ashenvale': {
    stalker: 'Foulweald Pathfinder', hound: 'Ghostpaw Runner', archer: 'Warsong Scout',
    caster: 'Foulweald Shaman', wisp: 'Ashenvale Wisp', brute: 'Foulweald Ursa',
  },
  'durotar': {
    duneScuttler: 'Bloodtalon Raptor', hound: 'Dire Mottled Boar', stalker: 'Razormane Scout',
    archer: 'Razormane Hunter', brute: 'Razormane Battleguard', caster: 'Razormane Geomancer',
  },
  'stonetalon': {
    stormSentinel: 'Thundering Boulderheart', stalker: 'Grimtotem Ruffian', brute: 'Grimtotem Mercenary',
    goblin: 'Venture Co. Logger', hound: 'Deepmoss Creeper', goblinChief: 'Venture Co. Foreman',
    caster: 'Grimtotem Sorcerer',
  },
  'barrens-north': {
    duneScuttler: 'Sunscale Lasher', hound: 'Savannah Raptor', stalker: 'Razormane Quilboar',
    archer: 'Razormane Hunter', brute: 'Razormane Thornweaver', caster: 'Razormane Geomancer',
  },
  'barrens-south': {
    duneScuttler: 'Savannah Patriarch', brute: 'Bristleback Bludgeoner', hound: 'Bristleback Hound',
    stalker: 'Bristleback Quilboar', caster: 'Bristleback Thornweaver', goblin: 'Razorfen Servitor',
  },
  'dustwallow': {
    mireSpitter: 'Mirefin Oracle', stalker: 'Mirefin Muckdweller', brute: 'Darkmist Recluse',
    caster: 'Grimtotem Earthbinder', hound: 'Murkscale Crocolisk', wisp: 'Marsh Wisp',
  },
  'desolace': {
    stalker: 'Kolkar Marauder', brute: 'Kolkar Battle Lord', caster: 'Kolkar Stormer',
    hound: 'Dread Ripper', duneScuttler: 'Scorpashi Snapper', graveMarshal: 'Undead Ravager',
    archer: 'Kolkar Scout',
  },
  'mulgore': {
    duneScuttler: 'Flatland Cougar', hound: 'Prairie Wolf', stalker: 'Bael\'dun Rifleman',
    brute: 'Palemane Gnoll', archer: 'Bael\'dun Soldier', goblin: 'Venture Co. Worker',
    caster: 'Palemane Earthbinder', goblinChief: 'Venture Co. Overseer',
  },
  'thousand-needles': {
    duneScuttler: 'Scorpid Reaver', stalker: 'Galak Marauder', brute: 'Grimtotem Destroyer',
    archer: 'Galak Scout', stormSentinel: 'Cloud Serpent', caster: 'Grimtotem Geomancer',
  },
  'feralas': {
    stalker: 'Woodpaw Mongrel', brute: 'Gordunni Ogre', hound: 'Ironfur Bear',
    caster: 'Gordunni Warlock', wisp: 'Feralas Wisp', duneScuttler: 'Stinglasher',
  },
  'tanaris': {
    duneScuttler: 'Sand Scorpid', brute: 'Dunemaul Brute', stalker: 'Sandfury Shadowhunter',
    caster: 'Sandfury Witch Doctor', goblin: 'Wastewander Bandit', archer: 'Sandfury Axe Thrower',
  },
  'ungoro': {
    stalker: 'Bloodpetal Flayer', brute: 'Tyrant Devilsaur', duneScuttler: 'Ravasaur Runner',
    mireSpitter: 'Bloodpetal Thresher', wisp: 'Living Tar',
  },
  'silithus': {
    duneScuttler: 'Hive\'Zora Worker', stalker: 'Twilight Avenger', caster: 'Twilight Geolord',
    brute: 'Hive\'Ashi Stinger', stormSentinel: 'Twilight Stormcaller', archer: 'Twilight Marauder',
  },
});

// ── Eastern Kingdoms ─────────────────────────────────────────────────────────
const EASTERN_KINGDOMS_ROSTERS: Readonly<Record<string, ZoneRoster>> = Object.freeze({
  'eversong': {
    stalker: 'Springpaw Lynx', wisp: 'Mana Wyrm', hound: 'Springpaw Cub',
    caster: 'Wretched Hooligan', thornReaver: 'Feral Tender', archer: 'Amani Berserker',
    briarMatriarch: 'Old Rootbark', emberAcolyte: 'Arcane Wraith', brute: 'Grimscale Murloc',
  },
  'quel-danas': {
    caster: 'Sunblade Magister', archer: 'Dawnblade Marksman', wisp: 'Erratic Sentry',
    brute: 'Sunblade Sentinel', emberAcolyte: 'Sunblade Fire Mage',
  },
  'ghostlands': {
    graveMarshal: 'Deatholme Abomination', stalker: 'Nerubis Guard', caster: 'Deatholme Necromancer',
    hound: 'Ghostclaw Ravager', archer: 'Shadowpine Headhunter', wisp: 'Arcane Devourer',
    brute: 'Shadowpine Ripper',
  },
  'tirisfal': {
    graveMarshal: 'Risen Dead', hound: 'Darkhound', caster: 'Rot Hide Mystic',
    stalker: 'Rot Hide Mongrel', archer: 'Scarlet Hunter', brute: 'Rot Hide Brute',
    wisp: 'Wailing Spirit',
  },
  'western-plaguelands': {
    graveMarshal: { names: ['Skeletal Flayer', 'Scourge Champion'], tint: '#a8c8a0', tintAmount: .3 },
    caster: 'Scourge Necromancer', stalker: 'Scourge Ghoul', hound: 'Plaguehound',
    wisp: 'Plague Wisp', brute: 'Blighted Abomination', archer: 'Scourge Archer',
  },
  'eastern-plaguelands': {
    graveMarshal: { names: ['Scourge Champion', 'Crypt Horror'], tint: '#a8c8a0', tintAmount: .3 },
    caster: 'Cultist Necromancer', brute: 'Stitched Abomination', hound: 'Plaguehound',
    stalker: 'Scourge Ghoul', wisp: 'Plaguebat', archer: 'Scourge Archer', mireSpitter: 'Carrion Spitter',
  },
  'silverpine': {
    stalker: 'Rot Hide Gladerunner', hound: 'Worg', graveMarshal: 'Son of Arugal',
    brute: 'Moonrage Worgen', mireSpitter: 'Murloc Tidehunter', caster: 'Rot Hide Mystic',
    goblin: 'Forsaken Scavenger',
  },
  'hillsbrad': {
    brute: 'Crushridge Ogre', stalker: 'Syndicate Footpad', archer: 'Syndicate Highwayman',
    mireSpitter: 'Torn Fin Murloc', caster: 'Syndicate Shadow Mage', hound: 'Hillsbrad Wolf',
    goblin: 'Syndicate Prowler',
  },
  'hinterlands': {
    hound: 'Mangy Silvermane', archer: 'Vilebranch Headhunter', stalker: 'Vilebranch Scalper',
    brute: 'Vilebranch Berserker', stormSentinel: 'Vilebranch Stormcaller', mireSpitter: 'Green Sludge',
    caster: 'Vilebranch Witch Doctor',
  },
  'alterac': {
    brute: 'Crushridge Enforcer', frostRevenant: { names: ['Ice Elemental', 'Snowblind Yeti'], tint: '#9fd4f0', tintAmount: .3 },
    stalker: 'Syndicate Agent', archer: 'Syndicate Marksman', caster: 'Crushridge Warmonger',
    hound: 'Frost Wolf',
  },
  'arathi': {
    stalker: 'Syndicate Highwayman', brute: 'Boulderfist Ogre', archer: 'Witherbark Headhunter',
    stormSentinel: 'Thundering Exile', caster: 'Boulderfist Shaman', goblin: 'Drywhisker Digger',
  },
  'wetlands': {
    mireSpitter: 'Bluegill Murloc', stalker: 'Mosshide Mongrel', brute: 'Mosshide Brute',
    archer: 'Dragonmaw Scout', hound: 'Wetlands Crocolisk', wisp: 'Marsh Wisp',
    caster: 'Dark Iron Saboteur', graveMarshal: 'Cursed Sailor',
  },
  'dun-morogh': {
    hound: 'Snow Leopard', brute: 'Ice Claw Bear', goblin: 'Rockjaw Trogg',
    stalker: 'Rockjaw Skullthumper', archer: 'Frostmane Headhunter',
    frostRevenant: { names: ['Frost Elemental', 'Ice Yeti'], tint: '#9fd4f0', tintAmount: .3 },
    caster: 'Frostmane Seer',
  },
  'loch-modan': {
    brute: 'Stonesplinter Brute', goblin: 'Stonesplinter Trogg', stalker: 'Stonesplinter Scout',
    mireSpitter: 'Bluegill Murloc', hound: 'Mangy Mountain Boar', archer: 'Dark Iron Spy',
  },
  'searing-gorge': {
    emberAcolyte: { names: ['Dark Iron Taskmaster', 'Incendosaur'], tint: '#e08a4a', tintAmount: .3 },
    archer: 'Dark Iron Marksman', brute: 'Dark Iron Steamsmith', caster: 'Dark Iron Geologist',
    stalker: 'Dark Iron Lookout', ashColossus: 'Magma Elemental',
  },
  'badlands': {
    hound: 'Crag Coyote', brute: 'Dustbelcher Ogre', stalker: 'Dustbelcher Wyrmcultist',
    archer: 'Dustbelcher Hunter', stormSentinel: 'Rumbling Exile', duneScuttler: 'Scorpid Dunestalker',
    emberAcolyte: 'Shadowforge Chanter',
  },
  'burning-steppes': {
    archer: 'Blackrock Hunter', brute: 'Blackrock Soldier', emberAcolyte: 'Blackrock Sorcerer',
    hound: 'Blackrock Worg', caster: 'Blackrock Warlock', ashColossus: 'Obsidian Elemental',
    stalker: 'Blackrock Slayer', graveMarshal: 'Smolderthorn Shadow Priest',
  },
  'elwynn': {
    hound: 'Riverpaw Gnoll', goblin: 'Kobold Miner', stalker: 'Defias Cutpurse',
    archer: 'Defias Highwayman', mireSpitter: 'Murloc Forager', brute: 'Riverpaw Brute',
    caster: 'Kobold Geomancer',
  },
  'westfall': {
    archer: 'Defias Highwayman', brute: 'Defias Knuckleduster', hound: 'Riverpaw Scout',
    mireSpitter: 'Murloc Coastrunner', ashColossus: 'Harvest Golem', goblin: 'Defias Smuggler',
    caster: 'Defias Renegade Mage',
  },
  'redridge': {
    brute: 'Blackrock Grunt', archer: 'Blackrock Outrunner', mireSpitter: 'Murloc Tidecaller',
    stalker: 'Shadowhide Gnoll', hound: 'Shadowhide Darkweaver', caster: 'Shadowhide Warlock',
    goblin: 'Blackrock Renegade',
  },
  'swamp-of-sorrows': {
    stalker: 'Lost One Muckdweller', mireSpitter: 'Swamp Jaguar', brute: 'Lost One Riftseeker',
    caster: 'Atal\'ai Witch Doctor', hound: 'Sorrow Crocolisk', wisp: 'Swamp Wisp',
    archer: 'Lost One Hunter',
  },
  'duskwood': {
    stalker: 'Nightbane Shadow Weaver', graveMarshal: 'Skeletal Horror', hound: 'Starving Dire Wolf',
    brute: 'Rotting Abomination', caster: 'Nightbane Dark Runner', wisp: 'Forlorn Spirit',
    archer: 'Nightbane Worgen',
  },
  'deadwind': {
    wisp: 'Restless Shade', caster: 'Deadwind Warlock', stalker: 'Deadwind Scavenger',
    hound: 'Dread Raven', brute: 'Unliving Monstrosity', graveMarshal: 'Skeletal Usher',
    archer: 'Deadwind Poacher',
  },
  'blasted-lands': {
    emberAcolyte: { names: ['Shadowsworn Adept', 'Felhound'], tint: '#7dd069', tintAmount: .3 },
    brute: 'Dreadmaul Ogre', duneScuttler: 'Scorpok Stinger', hound: 'Felhound',
    caster: 'Shadowsworn Cultist', archer: 'Dreadmaul Mauler',
  },
  'stranglethorn': {
    stalker: 'Bloodscalp Scavenger', brute: 'Mosh\'Ogg Brute', archer: 'Bloodscalp Headhunter',
    caster: 'Bloodscalp Witch Doctor', mireSpitter: 'Snapjaw Crocolisk', goblin: 'Venture Co. Strip Miner',
    hound: 'Jungle Panther', goblinChief: 'Venture Co. Foreman',
  },
});

// ── Northrend ────────────────────────────────────────────────────────────────
const NORTHREND_ROSTERS: Readonly<Record<string, ZoneRoster>> = Object.freeze({
  'borean-tundra': {
    stalker: 'Nerub\'ar Skitterer', hound: 'Tundra Wolf', brute: 'Magnataur Alpha',
    caster: 'Nerub\'ar Webweaver', archer: 'Snobold Hunter', duneScuttler: 'Borean Marmot',
    frostRevenant: { names: ['Ice Revenant', 'Frozen Elemental'], tint: '#9fd4f0', tintAmount: .3 },
  },
  'howling-fjord': {
    hound: 'Fjord Wolf', stalker: 'Dragonflayer Raider', brute: 'Dragonflayer Thane',
    archer: 'Dragonflayer Hunter', caster: 'Dragonflayer Seer',
    frostRevenant: { names: ['Ice Revenant', 'Shoveltusk'], tint: '#9fd4f0', tintAmount: .3 },
    wisp: 'Fjord Wisp',
  },
  'dragonblight': {
    stalker: 'Anub\'ar Skitterer', caster: 'Anub\'ar Necromancer', hound: 'Plaguehound',
    brute: 'Scourge Behemoth', wisp: 'Restless Spirit',
    frostRevenant: { names: ['Ice Revenant', 'Frost Wyrm'], tint: '#9fd4f0', tintAmount: .3 },
    graveMarshal: { names: ['Scourge Champion', 'Crypt Lord'], tint: '#a8c8a0', tintAmount: .3 },
  },
  'grizzly-hills': {
    hound: 'Grizzly Bear', stalker: 'Drakkari Hunter', archer: 'Drakkari Scout',
    brute: 'Ironhide Bear', caster: 'Drakkari Shaman', briarMatriarch: 'Ursoc\'s Corrupted Child',
  },
  'zuldrak': {
    stalker: 'Drakkari Skullcrusher', caster: 'Drakkari Witch Doctor', brute: 'Drakkari Golem',
    hound: 'Drakkari Raptor', archer: 'Drakkari Spearman', wisp: 'Frozen Spirit',
    mireSpitter: 'Plague Spitter',
  },
  'sholazar': {
    stalker: 'Frenzyheart Hunter', archer: 'Frenzyheart Tracker', caster: 'Sparktouched Oracle',
    hound: 'Hardknuckle Charger', brute: 'Shardhorn Rhino', wisp: 'Sholazar Wisp',
  },
  'crystalsong': {
    wisp: 'Shandaral Spirit', caster: 'Azure Spellweaver', stalker: 'Crystal Stalker',
    frostRevenant: { names: ['Ice Revenant', 'Crystal Golem'], tint: '#9fd4f0', tintAmount: .3 },
    hound: 'Crystal Wolf', archer: 'Shandaral Hunter',
  },
  'storm-peaks': {
    frostRevenant: { names: ['Icebound Revenant', 'Frost Giant'], tint: '#9fd4f0', tintAmount: .3 },
    stormSentinel: 'Stormforged Artificer', brute: 'Stormforged Champion',
    caster: 'Stormforged Loreseeker', hound: 'Frosthound', stalker: 'Hyldnir Raider',
    archer: 'Hyldnir Huntress',
  },
  'icecrown': {
    stalker: { names: ['Scourge Ghoul', 'Cultist Acolyte'], tint: '#a8c8a0', tintAmount: .3 },
    caster: 'Scourge Necromancer', brute: 'Scourge Behemoth', hound: 'Plaguehound',
    frostRevenant: { names: ['Frostbrood Whelp', 'Ice Revenant'], tint: '#9fd4f0', tintAmount: .3 },
    graveMarshal: { names: ['Scourge Champion', 'Crypt Lord'], tint: '#a8c8a0', tintAmount: .3 },
    wisp: 'Restless Spirit', archer: 'Scourge Archer',
  },
  'wintergrasp': {
    frostRevenant: { names: ['Ice Revenant', 'Glacial Spirit'], tint: '#9fd4f0', tintAmount: .3 },
    emberAcolyte: 'Flame Revenant', stormSentinel: 'Storm Revenant', mireSpitter: 'Water Revenant',
    stalker: 'Shadow Revenant', wisp: 'Whispering Wisp', brute: 'Earth Revenant',
    archer: 'Wintergrasp Archer', hound: 'Glacial Wolf',
  },
});

// ── Outland ──────────────────────────────────────────────────────────────────
const OUTLAND_ROSTERS: Readonly<Record<string, ZoneRoster>> = Object.freeze({
  'hellfire': {
    brute: 'Bleeding Hollow Grunt', emberAcolyte: { names: ['Bleeding Hollow Warlock', 'Fel Spark'], tint: '#7dd069', tintAmount: .3 },
    hound: 'Ravager', stalker: 'Shattered Hand Scout', caster: 'Bleeding Hollow Necrolyte',
    duneScuttler: 'Quillfang Ravager', thornReaver: 'Thornfang Ravager',
  },
  'zangarmarsh': {
    mireSpitter: 'Sporebat', stalker: 'Darkcrest Slaver', wisp: 'Bogflare Needler',
    brute: 'Fen Strider', caster: 'Umbrafen Witchdoctor', hound: 'Marshfang Ripper',
    archer: 'Darkcrest Sentry',
  },
  'terokkar': {
    stalker: 'Skithian Windripper', caster: 'Skithian Shadowcaster', graveMarshal: 'Auchenai Deathguard',
    hound: 'Dreadfang Lurker', brute: 'Bonechewer Remnant', wisp: 'Terokkar Wisp',
    archer: 'Skithian Dreadhawk',
  },
  'nagrand': {
    brute: 'Boulderfist Crusher', stalker: 'Warmaul Raider', hound: 'Talbuk Stag',
    archer: 'Warmaul Hunter', caster: 'Kil\'sorrow Cultist', wisp: 'Nagrand Wisp',
    emberAcolyte: 'Felguard Legionnaire', graveMarshal: 'Kil\'sorrow Deathsworn',
  },
  'blades-edge': {
    brute: 'Bladespire Ogre', stalker: 'Bloodmaul Skirmisher', archer: 'Bladespire Hunter',
    stormSentinel: 'Thunderlord Stormcaller', caster: 'Bloodmaul Warlock', hound: 'Felsworn Daggermaw',
    ashColossus: 'Gruul\'s Son',
  },
  'netherstorm': {
    caster: 'Sunfury Magister', stormSentinel: 'Manaforge Sentinel', stalker: 'Sunfury Agent',
    archer: 'Sunfury Archer', wisp: 'Mana Wraith', brute: 'Sunfury Protector',
  },
  'shadowmoon': {
    emberAcolyte: { names: ['Shadow Council Warlock', 'Fel Incinerate'], tint: '#7dd069', tintAmount: .3 },
    brute: 'Dragonmaw Enforcer', caster: 'Illidari Dreadbringer', stalker: 'Dragonmaw Scout',
    hound: 'Felhound', graveMarshal: 'Illidari Deathsworn', archer: 'Dragonmaw Archer',
    stormSentinel: 'Stormforged Sentinel', wisp: 'Shadowmoon Wisp',
  },
});

/** Authored zone rosters, normalized once at load. Keyed by atlas zone id. */
export const ZONE_ROSTERS: Readonly<Record<string, Readonly<Partial<Record<EnemyKind, RosterSkin>>>>> =
  normalize({ ...KALIMDOR_ROSTERS, ...EASTERN_KINGDOMS_ROSTERS, ...NORTHREND_ROSTERS, ...OUTLAND_ROSTERS });

/** Named rares: a unique name per spawn, drawn from the zone's pool (then the
 * biome's). Rare rank only — ordinary members keep the family name. Pools are
 * small on purpose: a rare is a sighting, and the same name recurring in one
 * zone reads as the same named mob. */
export const ZONE_RARE_NAMES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  // Kalimdor
  'teldrassil': Object.freeze(['Grimmaw', 'Uruson', 'Threggil']),
  'durotar': Object.freeze(['Death Flayer', 'Sarkoth', 'Geolord Mottle']),
  'mulgore': Object.freeze(['Mazzranache', 'The Rake', 'Sister Hatelash']),
  'barrens-north': Object.freeze(['Humar the Pridelord', 'Echeyakee', 'Snort the Heckler']),
  'barrens-south': Object.freeze(['Silithid Harvester', 'Heggin Stonewhisker', 'Aean Swiftriver']),
  'ashenvale': Object.freeze(['Ursol\'lok', 'Lady Vespia', 'Eck\'alom']),
  'stonetalon': Object.freeze(['Sister Riven', 'Nal\'taszar', 'Vengeful Ancient']),
  'darkshore': Object.freeze(['Shadowclaw', 'Strider Clutchmother', 'Lady Moongazer']),
  'felwood': Object.freeze(['Death Howl', 'Alshirr Banebreath', 'Dessecus']),
  'winterspring': Object.freeze(['Rak\'shiri', 'General Colbatann', 'Mezzir the Howler']),
  'azshara': Object.freeze(['Antilos', 'General Fangferror', 'Lady Sesspira']),
  'dustwallow': Object.freeze(['Brimgore', 'Dart', 'Ripscale']),
  'desolace': Object.freeze(['Accursed Slitherblade', 'Crusty', 'Prince Kellen']),
  'thousand-needles': Object.freeze(['Harb Foulmountain', 'Achellios the Banished', 'Gibblesnik']),
  'feralas': Object.freeze(['Old Grizzlegut', 'Lady Szallah', 'Diamond Head']),
  'tanaris': Object.freeze(['Warleader Krazzilak', 'Jin\'Zallah the Sandbringer', 'Omgorn the Lost']),
  'ungoro': Object.freeze(['Uhk\'loc', 'King Mosh', 'Ravasaur Matriarch']),
  'silithus': Object.freeze(['Rex Ashil', 'Zora Captain', 'Setis']),
  'moonglade': Object.freeze(['Lyragar Moonshadow', 'Old Whitebark']),
  'bloodmyst': Object.freeze(['Fenissa the Assassin', 'Morgroron']),
  'azuremyst': Object.freeze(['Deathclaw', 'The Duke of Fathoms']),
  // Eastern Kingdoms
  'eversong': Object.freeze(['Eldinarcus', 'Tregla', 'Skitterflame']),
  'quel-danas': Object.freeze(['Kregga', 'Sunblade Dawnhawk']),
  'ghostlands': Object.freeze(['Dr. Whitherlimb', 'Krethis Shadowspinner']),
  'tirisfal': Object.freeze(['Ressan the Needler', 'Farmer Solliden', 'Lost Soul']),
  'western-plaguelands': Object.freeze(['Foreman Jerris', 'The Husk', 'Scarlet Interrogator']),
  'eastern-plaguelands': Object.freeze(['Duggan Wildhammer', 'Hed\'mush the Rotting', 'Gish the Unmoving']),
  'silverpine': Object.freeze(['Old Vicejaw', 'Gorefang', 'Berard the Moon-Crazed']),
  'hillsbrad': Object.freeze(['Big Samras', 'Creepthess', 'Lady Zephris']),
  'hinterlands': Object.freeze(['Old Cliff Jumper', 'The Reak', 'Ironback']),
  'alterac': Object.freeze(['Narillasanz', 'Stone Fury', 'Lo\'Grosh']),
  'arathi': Object.freeze(['Nimar the Slayer', 'Foulbelly', 'Kovork']),
  'wetlands': Object.freeze(['Ma\'ruk Wyrmscale', 'Garneg Charskull', 'Razormaw Matriarch']),
  'dun-morogh': Object.freeze(['Bjarn', 'Timber', 'Edan the Howler']),
  'loch-modan': Object.freeze(['Boss Galgosh', 'Emogg the Crusher', 'Lord Condar']),
  'searing-gorge': Object.freeze(['Faulty War Golem', 'Shleipnarr', 'Slave Master Blackheart']),
  'badlands': Object.freeze(['Anathemus', 'Zaricotl', '7:XT']),
  'burning-steppes': Object.freeze(['Hematos', 'Deathmaw', 'Terrorspark']),
  'elwynn': Object.freeze(['Hogger', 'Grizzled Ben', 'Thuros Lightfingers']),
  'westfall': Object.freeze(['Vultros', 'Brack', 'Slark']),
  'redridge': Object.freeze(['Boulderheart', 'Kazon', 'Ribchaser']),
  'swamp-of-sorrows': Object.freeze(['Fingat', 'Gilmorian', 'Lost One Chieftain']),
  'duskwood': Object.freeze(['Nefaru', 'Lupos', 'The Unknown Soldier']),
  'deadwind': Object.freeze(['Arachna', 'The Darkstalker']),
  'blasted-lands': Object.freeze(['Clack the Reaver', 'Deatheye', 'Grunter']),
  'stranglethorn': Object.freeze(['King Bangalash', 'Sin\'Dall', 'Rippa']),
  // Northrend
  'borean-tundra': Object.freeze(['Fumblub Gearwind', 'Icehorn', 'Old Crystalbark']),
  'howling-fjord': Object.freeze(['King Ping', 'Perobas the Bloodthirster', 'Vigdis the War Maiden']),
  'dragonblight': Object.freeze(['Scarlet Highlord Daion', 'Tukemuth', 'Crazed Indu\'le Survivor']),
  'grizzly-hills': Object.freeze(['Arcturis', 'Grocklar', 'Seething Hate']),
  'zuldrak': Object.freeze(['Gondria', 'Terror Spinner', 'Zul\'drak Sentinel']),
  'sholazar': Object.freeze(['Loque\'nahak', 'Aotona', 'King Krush']),
  'crystalsong': Object.freeze(['Time-Lost Crystal Drake', 'Shandaral Elder']),
  'storm-peaks': Object.freeze(['Skoll', 'Time-Lost Proto-Drake', 'Dirkee']),
  'icecrown': Object.freeze(['Hildana Deathstealer', 'High Thane Jorfus', 'Putridus the Ancient']),
  'wintergrasp': Object.freeze(['Glacier Lord', 'Wintergrasp Sentinel']),
  // Outland
  'hellfire': Object.freeze(['Fulgorge', 'Mekthorg the Wild', 'Vorakem Doomspeaker']),
  'zangarmarsh': Object.freeze(['Bog Lurker', 'Coilfang Emissary', 'Marticar']),
  'terokkar': Object.freeze(['Crippler', 'Dooby', 'Okrek']),
  'nagrand': Object.freeze(['Bro\'Gaz the Clanless', 'Goretooth', 'Voidhunter Yar']),
  'blades-edge': Object.freeze(['Hemathion', 'Morcrush', 'Speaker Mar\'grom']),
  'netherstorm': Object.freeze(['Chief Engineer Lorthander', 'Ever-Core the Punisher', 'Nuramoc']),
  'shadowmoon': Object.freeze(['Ambassador Jerrikar', 'Collidus the Warp-Watcher', 'Kraator']),
});

/** Biome fallback names for zones without an authored rare pool. */
export const BIOME_RARE_NAMES: Readonly<Record<BiomeId, readonly string[]>> = Object.freeze({
  deadwood: Object.freeze(['Morgrimm the Pale', 'Widow of the Hollow', 'Ashfang']),
  verdant: Object.freeze(['Thornmantle', 'The Verdant Stalker', 'Old Mosshide']),
  swamp: Object.freeze(['Bogmother', 'Mirelurk the Patient', 'Fenstalker']),
  frostpine: Object.freeze(['Rimejaw', 'The White Stalker', 'Frostmaw']),
  emberfall: Object.freeze(['Cindermaw', 'The Ash Reaver', 'Pyreclaw']),
  autumn: Object.freeze(['The Amber Warden', 'Rustfang', 'Gilded Matriarch']),
  highlands: Object.freeze(['Stormcrest', 'Craglord the Unmoved', 'Windhowl']),
  steppe: Object.freeze(['The Long Strider', 'Dustmane', 'Palehoof the Wanderer']),
  sunscar: Object.freeze(['Sunbleached Terror', 'The Dune King', 'Sandskipper']),
});

/** The unique name for a rare spawn, or null when the enemy is not a rare. */
export function rareEnemyName(
  enemy: Pick<Enemy, 'kind'> & Partial<Pick<Enemy, 'rank' | 'biome' | 'lootSeed' | 'homeX' | 'homeY' | 'dungeonTheme'>>,
): string | null {
  if (enemy.rank !== 'rare' || enemy.dungeonTheme) return null;
  const zone = enemy.homeX !== undefined && enemy.homeY !== undefined ? zoneAt(enemy.homeX, enemy.homeY) : null;
  const pool = (zone ? ZONE_RARE_NAMES[zone.id] : undefined) ?? (enemy.biome ? BIOME_RARE_NAMES[enemy.biome] : undefined);
  if (!pool?.length) return null;
  return pool[(enemy.lootSeed ?? 0) % pool.length];
}

/** Biome fallback families for unlisted zones and kinds the zone table skips.
 * Generic-but-local names; zone rosters always win. */
export const BIOME_ROSTERS: Readonly<Record<BiomeId, Readonly<Partial<Record<EnemyKind, RosterSkin>>>>> =
  normalize({
    deadwood: {
      stalker: 'Blighted Stalker', hound: 'Rabid Worg', caster: 'Cultist Hexer',
      brute: 'Rotting Brute', wisp: 'Gloom Wisp', archer: 'Blighted Archer',
      mireSpitter: 'Bile Spitter', frostRevenant: 'Frozen Revenant', thornReaver: 'Thorn Horror',
      graveMarshal: 'Skeletal Marshal',
    },
    verdant: {
      stalker: 'Forest Prowler', hound: 'Grey Wolf', archer: 'Woodland Archer',
      caster: 'Thicket Shaman', brute: 'Elder Bear', wisp: 'Forest Wisp',
      goblin: 'Kobold Digger', thornReaver: 'Thorn Lasher', mireSpitter: 'Marsh Murloc',
    },
    swamp: {
      mireSpitter: 'Murloc Muckdweller', stalker: 'Swamp Stalker', wisp: 'Will-o-Wisp',
      brute: 'Bog Beast', caster: 'Swamp Witch Doctor', hound: 'Mire Crocolisk',
      archer: 'Marsh Hunter',
    },
    frostpine: {
      frostRevenant: 'Ice Revenant', stalker: 'Snow Stalker', wisp: 'Frost Wisp',
      hound: 'Frost Wolf', brute: 'Ice Yeti', caster: 'Frost Shaman', archer: 'Winter Hunter',
    },
    emberfall: {
      emberAcolyte: 'Ember Cultist', brute: 'Charred Brute', stalker: 'Ash Stalker',
      caster: 'Flame Hexer', hound: 'Cinder Hound', archer: 'Ashen Bowman',
      ashColossus: 'Magma Colossus', wisp: 'Firefly Swarm',
    },
    autumn: {
      stalker: 'Autumn Prowler', archer: 'Highvale Archer', caster: 'Hedge Wizard',
      hound: 'Rustfur Wolf', brute: 'Old Bear', wisp: 'Lantern Wisp',
    },
    highlands: {
      stormSentinel: 'Storm Elemental', brute: 'Highland Ogre', archer: 'Highland Marksman',
      stalker: 'Highland Bandit', caster: 'Highland Shaman', hound: 'Highland Wolf',
      goblin: 'Kobold Miner',
    },
    steppe: {
      duneScuttler: 'Plains Raptor', hound: 'Prairie Wolf', archer: 'Plains Hunter',
      stalker: 'Steppe Prowler', brute: 'Steppe Bull', caster: 'Dust Shaman',
      stormSentinel: 'Dust Devil',
    },
    sunscar: {
      duneScuttler: 'Desert Scorpid', brute: 'Dune Ogre', caster: 'Sand Witch Doctor',
      stalker: 'Sand Stalker', archer: 'Dune Archer', hound: 'Desert Coyote',
      emberAcolyte: 'Sunfire Acolyte', wisp: 'Mirage Wisp',
    },
  });

/** The local skin for one enemy, or null when the archetype name stands.
 * Zone table first (anchored at homeX/homeY), then the biome family. */
export function enemyRosterSkin(
  enemy: Pick<Enemy, 'kind'> & Partial<Pick<Enemy, 'biome' | 'lootSeed' | 'homeX' | 'homeY' | 'dungeonTheme'>>,
): RosterSkin | null {
  if (enemy.dungeonTheme) return null;
  const zone = enemy.homeX !== undefined && enemy.homeY !== undefined ? zoneAt(enemy.homeX, enemy.homeY) : null;
  return (zone ? ZONE_ROSTERS[zone.id]?.[enemy.kind] : undefined)
    ?? (enemy.biome ? BIOME_ROSTERS[enemy.biome]?.[enemy.kind] : undefined)
    ?? null;
}

/** Display name: rares take their unique name, else the zone family name
 * rotated by lootSeed, else the archetype. */
export function enemyDisplayName(
  enemy: Pick<Enemy, 'kind'> & Partial<Pick<Enemy, 'rank' | 'biome' | 'lootSeed' | 'homeX' | 'homeY' | 'dungeonTheme'>>,
): string {
  const rare = rareEnemyName(enemy);
  if (rare) return rare;
  const skin = enemyRosterSkin(enemy);
  if (!skin || !skin.names.length) return ENEMY_DEFINITIONS[enemy.kind].name;
  return skin.names[(enemy.lootSeed ?? 0) % skin.names.length];
}
