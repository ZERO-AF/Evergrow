/** Authored zone content for outland (wayfinder world-t06-t09). Each zone calls
 * defineZoneContent({...}) to register palette/props/elevation/water/roads/
 * towns/camps/spawns/pois/entrances. Coordinates nx/ny are normalized inside
 * the zone rect; road points are world-space. See zone-content.ts.
 *
 * Outland is the shattered Draenor: heavy elevation (mesas, shelves, floating
 * shards, fel-scarred valleys) carries the broken-world feel. Every atlas city
 * becomes a town at its normalized position; every atlas dungeon/raid becomes
 * an entrance with a WoW-faithful theme. */
import { zonePoint } from './world-atlas.ts';
import { defineZoneContent } from './zone-content.ts';

/** Normalized in-rect point → world-space road vertex. */
const pt = (id: string, nx: number, ny: number): readonly [number, number] => {
  const p = zonePoint(id, nx, ny)!;
  return [p.x, p.y];
};

// ── Hellfire Peninsula (58-63) ───────────────────────────────────────────────
// Shattered red waste: the Path of Glory runs east-west through Hellfire
// Citadel; fel orc camps, demon portals and the Dark Portal anchor the east.
defineZoneContent({
  id: 'hellfire',
  palette: 'fel-red shattered wastes',
  props: [
    { kind: 'basalt', weight: 30 }, { kind: 'emberRock', weight: 22 },
    { kind: 'sandstoneShard', weight: 16 }, { kind: 'desertScrub', weight: 14 },
    { kind: 'dryGrass', weight: 10 }, { kind: 'charredTree', weight: 6 },
    { kind: 'thornBrush', weight: 2 },
  ],
  elevation: {
    features: [
      // Hellfire Citadel mesa — the dungeon cluster sits on the raised shelf.
      { nx: .47, ny: .51, nw: .14, nh: .10, tier: 1, kind: 'mesa', edge: 46 },
      // Northern ridge wall (the shattered edge of the peninsula).
      { nx: .50, ny: .10, nw: 1.0, nh: .14, tier: 2, kind: 'plateau', edge: 60 },
      // Honor Hold / Thrallmar shelf south of the Path of Glory.
      { nx: .55, ny: .62, nw: .30, nh: .20, tier: 1, kind: 'plateau', edge: 40 },
      // The Great Fissure — a sunken crack running down the west flank.
      { nx: .12, ny: .55, nw: .10, nh: .60, tier: -1, kind: 'valley', edge: 44 },
      // Dark Portal crater rim, far east.
      { nx: .90, ny: .55, nw: .14, nh: .30, tier: 1, kind: 'mesa', edge: 50 },
    ],
    ramps: [
      // Path of Glory climbs onto the citadel mesa from both sides.
      { nx: .38, ny: .51, nx2: .42, ny2: .51, width: 90 },
      { nx: .56, ny: .51, nx2: .52, ny2: .51, width: 90 },
      // Ramp down into the Great Fissure.
      { nx: .20, ny: .55, nx2: .16, ny2: .55, width: 70 },
      // Approach to the Dark Portal crater.
      { nx: .80, ny: .55, nx2: .84, ny2: .55, width: 80 },
    ],
    noise: 10,
  },
  water: [
    // Pools of Aggonar — fel-tainted pools north of the citadel.
    { kind: 'lake', nx: .40, ny: .30, nrx: .05, nry: .06, depth: .5 },
  ],
  roads: [
    { id: 'path-of-glory', main: true, width: 110, points: [
      pt('hellfire', 0, .50), pt('hellfire', .25, .50), pt('hellfire', .47, .51),
      pt('hellfire', .55, .50), pt('hellfire', .78, .42), pt('hellfire', .90, .55), pt('hellfire', 1, .58),
    ] },
    { id: 'hold-spur', width: 60, points: [pt('hellfire', .55, .50), pt('hellfire', .55, .60)] },
    { id: 'thrallmar-spur', width: 60, points: [pt('hellfire', .55, .50), pt('hellfire', .55, .40)] },
    { id: 'falcon-watch-road', width: 55, points: [pt('hellfire', .28, .50), pt('hellfire', .28, .60)] },
    { id: 'terokkar-road', width: 70, points: [pt('hellfire', .45, .60), pt('hellfire', .45, 1)] },
  ],
  towns: [
    { name: 'Honor Hold', nx: .55, ny: .60, faction: 'alliance', tier: 'town' },
    { name: 'Thrallmar', nx: .55, ny: .40, faction: 'horde', tier: 'town' },
    { name: 'Temple of Telhamat', nx: .25, ny: .50, faction: 'alliance', tier: 'town' },
    { name: 'Falcon Watch', nx: .28, ny: .60, faction: 'horde', tier: 'town' },
    { name: 'Shatter Point', nx: .78, ny: .35, faction: 'neutral', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Zeth\'Gor', nx: .68, ny: .72, members: ['brute', 'caster', 'hound', 'stalker'] },
    { kind: 'camp', name: 'Forge Camp: Mageddon', nx: .62, ny: .28, members: ['emberAcolyte', 'brute', 'caster'] },
    { kind: 'camp', name: 'Forge Camp: Rage', nx: .58, ny: .20, members: ['emberAcolyte', 'brute'] },
    { kind: 'beastDen', name: 'Ravager Den', nx: .30, ny: .80, members: ['stalker', 'hound'] },
    { kind: 'watchtower', name: 'Broken Hill Watch', nx: .45, ny: .72 },
    { kind: 'corruptedGrove', name: 'Thornfang Hill', nx: .12, ny: .42, members: ['thornReaver', 'stalker'] },
  ],
  spawns: [
    { kind: 'brute', weight: 24 },        // fel orcs
    { kind: 'emberAcolyte', weight: 20 }, // demons of the Forge Camps
    { kind: 'hound', weight: 18 },        // helboars / fel hounds
    { kind: 'stalker', weight: 16 },      // ravagers
    { kind: 'caster', weight: 12 },       // fel orc warlocks
    { kind: 'duneScuttler', weight: 10 }, // carrion burrowers
  ],
  pois: [
    { name: 'The Dark Portal', kind: 'portal', nx: .90, ny: .55, description: 'The shattered gateway to Azeroth.' },
    { name: 'Hellfire Citadel', kind: 'landmark', nx: .47, ny: .51, description: 'Seat of the fel horde.' },
    { name: 'Pools of Aggonar', kind: 'corruptedGrove', nx: .40, ny: .30, description: 'Fel-tainted waters where a pit lord fell.' },
    { name: 'The Great Fissure', kind: 'landmark', nx: .12, ny: .55, description: 'A wound in the world left by the shattering.' },
    { name: 'Expedition Armory', kind: 'graveyard', nx: .50, ny: .78, description: 'Ruined field camp of the Sons of Lothar.' },
    { name: 'Zeppelin Crash', kind: 'caravan', nx: .48, ny: .85, description: 'A goblin zeppelin downed in the wastes.' },
    { name: 'Den of Haal\'esh', kind: 'beastDen', nx: .26, ny: .72, description: 'Arakkoa nesting grounds.' },
  ],
  entrances: [
    { name: 'Hellfire Ramparts', nx: .48, ny: .52, levelMin: 58, levelMax: 63, kind: 'dungeon', theme: 'foundry' },
    { name: 'Blood Furnace', nx: .46, ny: .52, levelMin: 58, levelMax: 63, kind: 'dungeon', theme: 'foundry' },
    { name: 'Shattered Halls', nx: .48, ny: .50, levelMin: 58, levelMax: 63, kind: 'dungeon', theme: 'blackrock' },
    { name: 'Magtheridon\'s Lair', nx: .46, ny: .50, levelMin: 58, levelMax: 63, kind: 'raid', theme: 'blackrock' },
  ],
});

// ── Zangarmarsh (60-64) ──────────────────────────────────────────────────────
// Giant mushroom swamp: water everywhere, Coilfang Reservoir in the center
// north, naga pumping stations draining the marsh.
defineZoneContent({
  id: 'zangarmarsh',
  palette: 'giant mushroom swamp',
  props: [
    { kind: 'mushrooms', weight: 34 }, { kind: 'reeds', weight: 22 },
    { kind: 'willow', weight: 14 }, { kind: 'lilies', weight: 12 },
    { kind: 'fern', weight: 8 }, { kind: 'stump', weight: 6 },
    { kind: 'deadTree', weight: 4 },
  ],
  elevation: {
    features: [
      // Telredor — the great mushroom the draenei built upon.
      { shape: 'disc', nx: .68, ny: .50, nr: .05, tier: 1, kind: 'mesa', edge: 36 },
      // Serpent Lake basin — the sunken reservoir holding Coilfang.
      { shape: 'disc', nx: .50, ny: .38, nr: .16, tier: -1, kind: 'valley', edge: 60 },
      // Dead Mire — drained, cracked basin in the northeast.
      { shape: 'disc', nx: .82, ny: .30, nr: .10, tier: -1, kind: 'valley', edge: 40 },
    ],
    ramps: [
      { nx: .64, ny: .50, nx2: .66, ny2: .50, width: 60 }, // Telredor lift approach
    ],
    noise: 6,
  },
  water: [
    // Serpent Lake — deep reservoir around the Coilfang dungeons.
    { kind: 'lake', nx: .50, ny: .38, nrx: .15, nry: .14, depth: .95 },
    // Marshlight Lake, southeast.
    { kind: 'lake', nx: .78, ny: .72, nrx: .09, nry: .10, depth: .7 },
    // Umbrafen Lake, southwest.
    { kind: 'lake', nx: .20, ny: .72, nrx: .10, nry: .09, depth: .7 },
    // The Lagoon, west-center.
    { kind: 'lake', nx: .28, ny: .55, nrx: .07, nry: .08, depth: .6 },
    // Serpent Lake outflow draining south toward Terokkar.
    { kind: 'river', nx: .50, ny: .50, width: 110, depth: .5, points: [[.50, .46], [.52, .62], [.50, .80], [.48, 1]] },
  ],
  roads: [
    { id: 'marsh-causeway', main: true, width: 80, points: [
      pt('zangarmarsh', 0, .55), pt('zangarmarsh', .30, .50), pt('zangarmarsh', .50, .52),
      pt('zangarmarsh', .68, .50), pt('zangarmarsh', .85, .55), pt('zangarmarsh', 1, .52),
    ] },
    { id: 'orebor-road', width: 55, points: [pt('zangarmarsh', .30, .50), pt('zangarmarsh', .42, .30)] },
    { id: 'refuge-spur', width: 55, points: [pt('zangarmarsh', .68, .50), pt('zangarmarsh', .80, .65)] },
    { id: 'terokkar-causeway', width: 70, points: [pt('zangarmarsh', .55, .52), pt('zangarmarsh', .55, 1)] },
    { id: 'blades-edge-pass', width: 60, points: [pt('zangarmarsh', .55, .30), pt('zangarmarsh', .55, 0)] },
  ],
  towns: [
    { name: 'Telredor', nx: .68, ny: .50, faction: 'alliance', tier: 'town' },
    { name: 'Zabra\'jin', nx: .30, ny: .50, faction: 'horde', tier: 'town' },
    { name: 'Cenarion Refuge', nx: .80, ny: .65, faction: 'neutral', tier: 'town' },
    { name: 'Orebor Harborage', nx: .42, ny: .30, faction: 'alliance', tier: 'town' },
    { name: 'Swamprat Post', nx: .85, ny: .55, faction: 'horde', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Ango\'rosh Grounds', nx: .35, ny: .20, members: ['brute', 'caster', 'archer'] },
    { kind: 'camp', name: 'Umbrafen Village', nx: .22, ny: .78, members: ['mireSpitter', 'stalker', 'caster'] },
    { kind: 'camp', name: 'Bloodscale Enclave', nx: .62, ny: .18, members: ['mireSpitter', 'archer', 'stalker'] },
    { kind: 'beastDen', name: 'Fen Strider Nest', nx: .55, ny: .75, members: ['stalker', 'mireSpitter'] },
    { kind: 'corruptedGrove', name: 'The Dead Mire', nx: .82, ny: .30, members: ['wisp', 'stalker'] },
    { kind: 'watchtower', name: 'Sporeggar Watch', nx: .15, ny: .45 },
  ],
  spawns: [
    { kind: 'mireSpitter', weight: 26 }, // naga / spore beasts
    { kind: 'stalker', weight: 20 },     // fen striders, marshfang slicers
    { kind: 'wisp', weight: 16 },        // marsh wisps / spore bats
    { kind: 'brute', weight: 14 },       // ogres of Ango'rosh
    { kind: 'caster', weight: 12 },      // naga sirens
    { kind: 'hound', weight: 12 },       // marshfang spiders
  ],
  pois: [
    { name: 'Coilfang Reservoir', kind: 'dungeon', nx: .50, ny: .38, description: 'Naga pumping works beneath Serpent Lake.' },
    { name: 'Sporeggar', kind: 'town', nx: .15, ny: .45, description: 'Sporeling refuge in the western bogs.' },
    { name: 'The Dead Mire', kind: 'corruptedGrove', nx: .82, ny: .30, description: 'A basin drained dry by naga pumps.' },
    { name: 'Ango\'rosh Stronghold', kind: 'camp', nx: .35, ny: .15, description: 'Ogre fortress on the northwestern shelf.' },
    { name: 'Marshlight Lake', kind: 'landmark', nx: .78, ny: .72, description: 'Still water ringed by giant mushrooms.' },
    { name: 'Twin Spire Ruins', kind: 'standingStones', nx: .50, ny: .55, description: 'Contested beacons on the causeway.' },
  ],
  entrances: [
    { name: 'The Slave Pens', nx: .50, ny: .40, levelMin: 60, levelMax: 64, kind: 'dungeon', theme: 'drowned' },
    { name: 'The Underbog', nx: .50, ny: .38, levelMin: 60, levelMax: 64, kind: 'dungeon', theme: 'rootbound' },
    { name: 'The Steamvault', nx: .50, ny: .36, levelMin: 60, levelMax: 64, kind: 'dungeon', theme: 'drowned' },
    { name: 'Serpentshrine Cavern', nx: .50, ny: .34, levelMin: 60, levelMax: 64, kind: 'raid', theme: 'drowned' },
  ],
});

// ── Terokkar Forest (62-65) ──────────────────────────────────────────────────
// Misty forest and the Bone Wastes: Shattrath in the northwest, Auchindoun's
// shattered necropolis in the center-south, arakkoa holds in the canopy.
defineZoneContent({
  id: 'terokkar',
  palette: 'misty forest and bone wastes',
  props: [
    { kind: 'tree', weight: 30 }, { kind: 'canopy', weight: 18 },
    { kind: 'mushrooms', weight: 14 }, { kind: 'fern', weight: 12 },
    { kind: 'deadTree', weight: 10 }, { kind: 'stump', weight: 8 },
    { kind: 'flowers', weight: 5 }, { kind: 'rock', weight: 3 },
  ],
  elevation: {
    features: [
      // Shattrath sits in a sheltered bowl below the forest floor.
      { shape: 'disc', nx: .35, ny: .25, nr: .10, tier: -1, kind: 'valley', edge: 55 },
      // The Bone Wastes — a sunken crater of ash around Auchindoun.
      { nx: .38, ny: .62, nw: .30, nh: .22, tier: -1, kind: 'valley', edge: 60 },
      // Skettis — arakkoa spires on a raised shelf in the southeast.
      { nx: .72, ny: .78, nw: .18, nh: .16, tier: 1, kind: 'plateau', edge: 45 },
      // Bonechewer / Bleeding Hollow rise in the northeast.
      { nx: .65, ny: .30, nw: .20, nh: .18, tier: 1, kind: 'plateau', edge: 40 },
    ],
    ramps: [
      { nx: .35, ny: .35, nx2: .35, ny2: .30, width: 80 },  // road down into Shattrath
      { nx: .42, ny: .55, nx2: .40, ny2: .58, width: 90 },  // descent into the Bone Wastes
      { nx: .66, ny: .74, nx2: .70, ny2: .76, width: 60 },  // climb to Skettis
    ],
    noise: 8,
  },
  water: [
    // Blackwind Lake, southeast — the skettis lake.
    { kind: 'lake', nx: .72, ny: .80, nrx: .08, nry: .07, depth: .8 },
    // Lake Jorune / Lake Ere'Noru, west hills.
    { kind: 'lake', nx: .22, ny: .60, nrx: .05, nry: .06, depth: .7 },
    // Silmyr Lake, northwest of Shattrath.
    { kind: 'lake', nx: .18, ny: .15, nrx: .05, nry: .05, depth: .6 },
  ],
  roads: [
    { id: 'shattrath-road', main: true, width: 90, points: [
      pt('terokkar', .45, 0), pt('terokkar', .40, .15), pt('terokkar', .35, .25),
      pt('terokkar', .42, .40), pt('terokkar', .50, .45), pt('terokkar', .55, .55), pt('terokkar', .55, 1),
    ] },
    { id: 'nagrand-road', width: 65, points: [pt('terokkar', .35, .25), pt('terokkar', .20, .40), pt('terokkar', 0, .50)] },
    { id: 'bone-wastes-loop', width: 60, points: [
      pt('terokkar', .50, .45), pt('terokkar', .40, .55), pt('terokkar', .38, .62), pt('terokkar', .45, .68),
    ] },
  ],
  towns: [
    { name: 'Shattrath City', nx: .35, ny: .25, faction: 'neutral', tier: 'capital' },
    { name: 'Allerian Stronghold', nx: .55, ny: .55, faction: 'alliance', tier: 'town' },
    { name: 'Stonebreaker Hold', nx: .50, ny: .45, faction: 'horde', tier: 'town' },
  ],
  camps: [
    { kind: 'camp', name: 'Veil Shienor', nx: .60, ny: .25, members: ['stalker', 'caster', 'archer'] },
    { kind: 'camp', name: 'Bonechewer Ruins', nx: .68, ny: .32, members: ['brute', 'caster', 'hound'] },
    { kind: 'camp', name: 'Firewing Point', nx: .72, ny: .38, members: ['caster', 'archer', 'stalker'] },
    { kind: 'graveyard', name: 'Auchenai Grounds', nx: .38, ny: .62, members: ['graveMarshal', 'stalker', 'caster'] },
    { kind: 'beastDen', name: 'Warpstalker Hollow', nx: .25, ny: .70, members: ['stalker', 'hound'] },
    { kind: 'ruinedChapel', name: 'Carrion Hill', nx: .45, ny: .70, members: ['graveMarshal', 'caster'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 24 },      // warp stalkers, arakkoa
    { kind: 'caster', weight: 18 },       // arakkoa shaman, cultists
    { kind: 'graveMarshal', weight: 14 }, // undead of the Bone Wastes
    { kind: 'hound', weight: 16 },        // timber worgs, warp hunters
    { kind: 'brute', weight: 14 },        // Bonechewer orcs
    { kind: 'wisp', weight: 14 },         // volatile motes
  ],
  pois: [
    { name: 'Auchindoun', kind: 'necropolis', nx: .38, ny: .62, description: 'The shattered draenei necropolis.' },
    { name: 'Skettis', kind: 'camp', nx: .72, ny: .78, description: 'Arakkoa capital above Blackwind Lake.' },
    { name: 'Grangol\'var Village', kind: 'hamlet', nx: .40, ny: .35, description: 'Shadow Council infiltrators.' },
    { name: 'Cenarion Thicket', kind: 'corruptedGrove', nx: .42, ny: .18, description: 'A druid grove slain by arcane fallout.' },
    { name: 'Ring of Observance', kind: 'standingStones', nx: .42, ny: .58, description: 'Processional ring around Auchindoun.' },
    { name: 'Tuurem', kind: 'hamlet', nx: .52, ny: .30, description: 'Lost draenei city overrun by scavengers.' },
  ],
  entrances: [
    { name: 'Mana-Tombs', nx: .40, ny: .60, levelMin: 62, levelMax: 65, kind: 'dungeon', theme: 'astral' },
    { name: 'Auchenai Crypts', nx: .38, ny: .62, levelMin: 62, levelMax: 65, kind: 'dungeon', theme: 'ossuary' },
    { name: 'Sethekk Halls', nx: .36, ny: .62, levelMin: 62, levelMax: 65, kind: 'dungeon', theme: 'ossuary' },
    { name: 'Shadow Labyrinth', nx: .38, ny: .65, levelMin: 62, levelMax: 65, kind: 'dungeon', theme: 'ossuary' },
  ],
});

// ── Nagrand (64-67) ──────────────────────────────────────────────────────────
// Green plains under floating islands: the last unbroken land in Outland.
// Ancestral Grounds, Warmaul ogre hills, elemental plateau on the shelf edge.
defineZoneContent({
  id: 'nagrand',
  palette: 'green floating-island plains',
  props: [
    { kind: 'tussock', weight: 30 }, { kind: 'heather', weight: 18 },
    { kind: 'steppeStone', weight: 16 }, { kind: 'dryGrass', weight: 14 },
    { kind: 'flowers', weight: 10 }, { kind: 'tree', weight: 8 },
    { kind: 'rock', weight: 4 },
  ],
  elevation: {
    features: [
      // Floating shards overhead read as overhangs shading the plains.
      { shape: 'disc', nx: .30, ny: .30, nr: .06, tier: 3, kind: 'overhang' },
      { shape: 'disc', nx: .55, ny: .55, nr: .05, tier: 3, kind: 'overhang' },
      { shape: 'disc', nx: .72, ny: .35, nr: .05, tier: 3, kind: 'overhang' },
      // Elemental Plateau — raised shelf in the northwest.
      { nx: .15, ny: .18, nw: .16, nh: .14, tier: 2, kind: 'plateau', edge: 50 },
      // Warmaul Hill — ogre mound in the northwest-center.
      { shape: 'disc', nx: .28, ny: .28, nr: .07, tier: 1, kind: 'mesa', edge: 40 },
      // Spirit Fields — sunken ancestral ground around Oshu'gun.
      { shape: 'disc', nx: .35, ny: .62, nr: .09, tier: -1, kind: 'valley', edge: 45 },
      // Southern rim — the world-edge cliffs above the void.
      { nx: .50, ny: .95, nw: 1.0, nh: .10, tier: -1, kind: 'valley', edge: 55 },
    ],
    ramps: [
      { nx: .22, ny: .22, nx2: .18, ny2: .20, width: 70 },  // climb to Elemental Plateau
      { nx: .32, ny: .30, nx2: .29, ny2: .29, width: 60 },  // Warmaul Hill path
      { nx: .38, ny: .58, nx2: .36, ny2: .60, width: 70 },  // descent to Oshu'gun
    ],
    noise: 7,
  },
  water: [
    // Lake Sunspring, southwest of Garadar.
    { kind: 'lake', nx: .30, ny: .45, nrx: .07, nry: .10, depth: .7 },
    // Skysong Lake, between Garadar and Telaar.
    { kind: 'lake', nx: .52, ny: .52, nrx: .06, nry: .08, depth: .6 },
  ],
  roads: [
    { id: 'nagrand-ring', main: true, width: 80, points: [
      pt('nagrand', 0, .50), pt('nagrand', .30, .55), pt('nagrand', .40, .45),
      pt('nagrand', .55, .35), pt('nagrand', .55, .55), pt('nagrand', .55, .70),
      pt('nagrand', .70, .60), pt('nagrand', 1, .55),
    ] },
    { id: 'zangarmarsh-road', width: 65, points: [pt('nagrand', .55, .35), pt('nagrand', .55, 0)] },
  ],
  towns: [
    { name: 'Telaar', nx: .55, ny: .70, faction: 'alliance', tier: 'town' },
    { name: 'Garadar', nx: .55, ny: .35, faction: 'horde', tier: 'town' },
    { name: 'Halaa', nx: .40, ny: .45, faction: 'neutral', tier: 'town' },
    { name: 'Aeris Landing', nx: .30, ny: .55, faction: 'neutral', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Warmaul Hill', nx: .28, ny: .28, members: ['brute', 'brute', 'caster'] },
    { kind: 'camp', name: 'Kil\'sorrow Fortress', nx: .72, ny: .78, members: ['caster', 'stalker', 'brute'] },
    { kind: 'camp', name: 'Burning Blade Ruins', nx: .75, ny: .65, members: ['emberAcolyte', 'caster'] },
    { kind: 'beastDen', name: 'Windroc Roost', nx: .62, ny: .30, members: ['stalker', 'stalker'] },
    { kind: 'beastDen', name: 'Clefthoof Grounds', nx: .45, ny: .75, members: ['brute', 'hound'] },
    { kind: 'standingStones', name: 'Ancestral Grounds', nx: .38, ny: .60, members: ['wisp', 'graveMarshal'] },
  ],
  spawns: [
    { kind: 'brute', weight: 22 },     // clefthooves, ogres
    { kind: 'stalker', weight: 20 },   // windrocs, talbuks
    { kind: 'hound', weight: 18 },     // tuskarr... no — wild elekk/worg packs
    { kind: 'archer', weight: 14 },    // ogre hunters
    { kind: 'caster', weight: 14 },    // Kil'sorrow cultists
    { kind: 'wisp', weight: 12 },      // elemental motes
  ],
  pois: [
    { name: 'Oshu\'gun', kind: 'landmark', nx: .35, ny: .62, description: 'The diamond mountain — a crashed naaru vessel.' },
    { name: 'Elemental Plateau', kind: 'shrine', nx: .15, ny: .18, description: 'Throne of the elements above the plains.' },
    { name: 'Throne of the Elements', kind: 'shrine', nx: .60, ny: .22, description: 'Elemental furies gather here.' },
    { name: 'The Ring of Blood', kind: 'landmark', nx: .42, ny: .20, description: 'Ogre arena in the Laughing Skull ruins.' },
    { name: 'Spirit Fields', kind: 'graveyard', nx: .38, ny: .62, description: 'Ancestral orc burial ground around Oshu\'gun.' },
    { name: 'Forge Camp: Fear', kind: 'camp', nx: .25, ny: .75, description: 'Legion invasion works.' },
  ],
  entrances: [],
});

// ── Blade's Edge Mountains (65-68) ───────────────────────────────────────────
// Spiky ogre mountains: knife-edge ridges, gronn lairs, ogre thrones and the
// arakkoa/rustbolt pockets in the valleys.
defineZoneContent({
  id: 'blades-edge',
  palette: 'spiky ogre mountains',
  props: [
    { kind: 'rock', weight: 26 }, { kind: 'basalt', weight: 22 },
    { kind: 'limestone', weight: 16 }, { kind: 'windTree', weight: 12 },
    { kind: 'heather', weight: 10 }, { kind: 'tussock', weight: 8 },
    { kind: 'deadTree', weight: 6 },
  ],
  elevation: {
    features: [
      // The blade ridges — a spine of high mesas across the zone.
      { nx: .30, ny: .30, nw: .40, nh: .16, tier: 2, kind: 'mesa', edge: 55 },
      { nx: .70, ny: .25, nw: .30, nh: .18, tier: 2, kind: 'mesa', edge: 55 },
      // Gruul's Lair shelf, northeast.
      { shape: 'disc', nx: .68, ny: .25, nr: .08, tier: 3, kind: 'mesa', edge: 60 },
      // Sylvanaar / Living Grove valley, southwest.
      { nx: .32, ny: .68, nw: .24, nh: .20, tier: -1, kind: 'valley', edge: 45 },
      // Crystal Spine — jagged rise on the east edge.
      { nx: .88, ny: .50, nw: .16, nh: .50, tier: 2, kind: 'plateau', edge: 50 },
      // Vortex Pinnacle wind scar, northwest.
      { shape: 'disc', nx: .18, ny: .45, nr: .08, tier: -1, kind: 'valley', edge: 40 },
    ],
    ramps: [
      { nx: .50, ny: .40, nx2: .55, ny2: .32, width: 70 },  // climb to the spine
      { nx: .62, ny: .30, nx2: .66, ny2: .27, width: 60 },  // Gruul's approach
      { nx: .40, ny: .60, nx2: .36, ny2: .64, width: 70 },  // down to Sylvanaar vale
    ],
    noise: 12,
  },
  water: [
    // Blackwind... no — small mountain tarns.
    { kind: 'lake', nx: .30, ny: .70, nrx: .05, nry: .08, depth: .6 },
  ],
  roads: [
    { id: 'ridge-road', main: true, width: 75, points: [
      pt('blades-edge', .55, 1), pt('blades-edge', .50, .70), pt('blades-edge', .50, .55),
      pt('blades-edge', .60, .40), pt('blades-edge', .60, .20), pt('blades-edge', .60, 0),
    ] },
    { id: 'sylvanaar-road', width: 55, points: [pt('blades-edge', .50, .55), pt('blades-edge', .35, .65)] },
    { id: 'toshley-spur', width: 50, points: [pt('blades-edge', .55, .62), pt('blades-edge', .60, .70)] },
  ],
  towns: [
    { name: 'Sylvanaar', nx: .35, ny: .65, faction: 'alliance', tier: 'town' },
    { name: 'Thunderlord Stronghold', nx: .50, ny: .55, faction: 'horde', tier: 'town' },
    { name: 'Evergrove', nx: .60, ny: .40, faction: 'neutral', tier: 'town' },
    { name: 'Toshley\'s Station', nx: .60, ny: .70, faction: 'alliance', tier: 'town' },
  ],
  camps: [
    { kind: 'camp', name: 'Bladespire Hold', nx: .40, ny: .30, members: ['brute', 'brute', 'caster', 'archer'] },
    { kind: 'camp', name: 'Bloodmaul Outpost', nx: .50, ny: .75, members: ['brute', 'archer', 'hound'] },
    { kind: 'camp', name: 'Grishnath', nx: .38, ny: .20, members: ['stalker', 'caster'] },
    { kind: 'beastDen', name: 'Gronn Den', nx: .62, ny: .28, members: ['brute', 'ashColossus'] },
    { kind: 'beastDen', name: 'Raptor Ridge', nx: .72, ny: .65, members: ['stalker', 'hound'] },
    { kind: 'watchtower', name: 'Vekhaar Stand', nx: .75, ny: .72 },
  ],
  spawns: [
    { kind: 'brute', weight: 26 },        // ogres, gronn
    { kind: 'stalker', weight: 20 },      // raptors, ravagers
    { kind: 'archer', weight: 16 },       // ogre hunters
    { kind: 'stormSentinel', weight: 14 },// ethereal storm elementals
    { kind: 'caster', weight: 12 },       // ogre magi, arakkoa
    { kind: 'hound', weight: 12 },        // warp hounds
  ],
  pois: [
    { name: 'Gruul\'s Lair', kind: 'dungeon', nx: .68, ny: .25, description: 'Lair of the Dragonkiller.' },
    { name: 'Bladespire Citadel', kind: 'watchtower', nx: .40, ny: .28, description: 'Ogre throne of the Bladespire clan.' },
    { name: 'The Crystal Spine', kind: 'landmark', nx: .88, ny: .50, description: 'Knife-edge crystal ridge.' },
    { name: 'Circle of Blood', kind: 'landmark', nx: .52, ny: .42, description: 'Arena cut into the ridge.' },
    { name: 'Raven\'s Wood', kind: 'corruptedGrove', nx: .30, ny: .25, description: 'Dark arakkoa wood.' },
    { name: 'Bash\'ir Landing', kind: 'camp', nx: .52, ny: .15, description: 'Ethereal smuggler dock on the north rim.' },
  ],
  entrances: [
    { name: 'Gruul\'s Lair', nx: .68, ny: .25, levelMin: 65, levelMax: 68, kind: 'raid', theme: 'blackrock' },
  ],
});

// ── Netherstorm (67-70) ──────────────────────────────────────────────────────
// Arcane shattered islands: land torn into floating shelves over the twisting
// nether, manaforges burning on the eastern rim, Tempest Keep above.
defineZoneContent({
  id: 'netherstorm',
  palette: 'arcane shattered islands',
  props: [
    { kind: 'iceCrystal', weight: 26 }, { kind: 'basalt', weight: 24 },
    { kind: 'emberRock', weight: 18 }, { kind: 'rock', weight: 14 },
    { kind: 'sandstoneShard', weight: 10 }, { kind: 'desertScrub', weight: 8 },
  ],
  elevation: {
    features: [
      // The island shelves — raised plates separated by void gaps (valleys).
      { nx: .30, ny: .60, nw: .34, nh: .30, tier: 1, kind: 'plateau', edge: 60 },
      { nx: .50, ny: .30, nw: .36, nh: .26, tier: 1, kind: 'plateau', edge: 60 },
      { nx: .75, ny: .55, nw: .26, nh: .24, tier: 2, kind: 'mesa', edge: 65 },   // Tempest Keep shelf
      // Void scars between the shelves.
      { nx: .42, ny: .48, nw: .10, nh: .40, tier: -2, kind: 'valley', edge: 55 },
      { nx: .62, ny: .30, nw: .08, nh: .30, tier: -2, kind: 'valley', edge: 55 },
      // Floating shards overhead.
      { shape: 'disc', nx: .35, ny: .45, nr: .05, tier: 3, kind: 'overhang' },
      { shape: 'disc', nx: .60, ny: .60, nr: .04, tier: 3, kind: 'overhang' },
    ],
    ramps: [
      { nx: .38, ny: .55, nx2: .44, ny2: .52, width: 70 },  // Area 52 shelf → mid shelf
      { nx: .55, ny: .42, nx2: .60, ny2: .45, width: 70 },  // mid shelf → Stormspire
      { nx: .68, ny: .50, nx2: .71, ny2: .53, width: 80 },  // climb to Tempest Keep shelf
    ],
    noise: 11,
  },
  water: [],
  roads: [
    { id: 'stormspire-road', main: true, width: 75, points: [
      pt('netherstorm', .60, 1), pt('netherstorm', .50, .80), pt('netherstorm', .33, .65),
      pt('netherstorm', .45, .45), pt('netherstorm', .45, .35),
    ] },
    { id: 'cosmowrench-road', width: 55, points: [pt('netherstorm', .45, .45), pt('netherstorm', .65, .65)] },
    { id: 'tempest-keep-road', width: 65, points: [pt('netherstorm', .65, .65), pt('netherstorm', .74, .55)] },
  ],
  towns: [
    { name: 'Area 52', nx: .33, ny: .65, faction: 'neutral', tier: 'town' },
    { name: 'The Stormspire', nx: .45, ny: .35, faction: 'neutral', tier: 'town' },
    { name: 'Cosmowrench', nx: .65, ny: .65, faction: 'neutral', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Manaforge B\'naar', nx: .25, ny: .68, members: ['caster', 'archer', 'stalker'] },
    { kind: 'camp', name: 'Manaforge Coruu', nx: .48, ny: .82, members: ['caster', 'archer'] },
    { kind: 'camp', name: 'Manaforge Duro', nx: .58, ny: .62, members: ['caster', 'brute'] },
    { kind: 'camp', name: 'Manaforge Ara', nx: .28, ny: .40, members: ['caster', 'stalker', 'brute'] },
    { kind: 'beastDen', name: 'Netherock Shelf', nx: .55, ny: .20, members: ['stormSentinel', 'brute'] },
    { kind: 'watchtower', name: 'Sunfury Hold', nx: .55, ny: .75, members: ['archer', 'caster'] },
  ],
  spawns: [
    { kind: 'caster', weight: 24 },        // Sunfury blood elves
    { kind: 'stormSentinel', weight: 20 }, // arcane elementals / nether rays
    { kind: 'stalker', weight: 18 },       // warp stalkers, nether drakes
    { kind: 'archer', weight: 14 },        // Sunfury archers
    { kind: 'wisp', weight: 12 },          // mana wisps
    { kind: 'brute', weight: 12 },         // colossi of shattered rock
  ],
  pois: [
    { name: 'Tempest Keep', kind: 'dungeon', nx: .74, ny: .54, description: 'Naaru fortress seized by Kael\'thas.' },
    { name: 'The Heap', kind: 'quarry', nx: .30, ny: .78, description: 'Scrap fields of the ethereal smugglers.' },
    { name: 'Kirin\'Var Village', kind: 'hamlet', nx: .58, ny: .85, description: 'Ruined wizard village haunted by its dead.' },
    { name: 'The Vortex Fields', kind: 'landmark', nx: .50, ny: .15, description: 'Arcane storms over the northern rim.' },
    { name: 'Eco-Dome Sutheron', kind: 'corruptedGrove', nx: .45, ny: .20, description: 'A failing arcane biodome.' },
    { name: 'Celestial Ridge', kind: 'landmark', nx: .72, ny: .40, description: 'Nether dragon roost.' },
  ],
  entrances: [
    { name: 'The Mechanar', nx: .72, ny: .55, levelMin: 67, levelMax: 70, kind: 'dungeon', theme: 'astral' },
    { name: 'The Botanica', nx: .74, ny: .55, levelMin: 67, levelMax: 70, kind: 'dungeon', theme: 'rootbound' },
    { name: 'The Arcatraz', nx: .76, ny: .55, levelMin: 67, levelMax: 70, kind: 'dungeon', theme: 'astral' },
    { name: 'The Eye', nx: .74, ny: .52, levelMin: 67, levelMax: 70, kind: 'raid', theme: 'astral' },
  ],
});

// ── Shadowmoon Valley (67-70) ────────────────────────────────────────────────
// Fel volcanic valley: green lava, the Hand of Gul'dan volcano, Illidan's
// Black Temple on the eastern rise, wildhammer and shadowmoon holds west.
defineZoneContent({
  id: 'shadowmoon',
  palette: 'fel-green volcanic valley',
  props: [
    { kind: 'basalt', weight: 30 }, { kind: 'emberRock', weight: 24 },
    { kind: 'charredTree', weight: 18 }, { kind: 'rock', weight: 12 },
    { kind: 'desertScrub', weight: 8 }, { kind: 'stump', weight: 5 },
    { kind: 'thornBrush', weight: 3 },
  ],
  elevation: {
    features: [
      // The Hand of Gul'dan — the great volcano dominating the center.
      { shape: 'disc', nx: .50, ny: .45, nr: .12, tier: 3, kind: 'mesa', edge: 70 },
      { shape: 'disc', nx: .50, ny: .45, nr: .05, tier: -1, kind: 'valley', edge: 30 }, // crater
      // Black Temple rise, east.
      { nx: .72, ny: .45, nw: .22, nh: .26, tier: 2, kind: 'mesa', edge: 60 },
      // Wildhammer shelf, southwest.
      { nx: .35, ny: .58, nw: .20, nh: .18, tier: 1, kind: 'plateau', edge: 45 },
      // Netherwing Fields — sunken fel flats, southeast.
      { nx: .62, ny: .78, nw: .30, nh: .20, tier: -1, kind: 'valley', edge: 50 },
      // The world-edge drop along the south rim.
      { nx: .50, ny: .96, nw: 1.0, nh: .08, tier: -2, kind: 'valley', edge: 60 },
    ],
    ramps: [
      { nx: .44, ny: .50, nx2: .47, ny2: .47, width: 70 },  // volcano west approach
      { nx: .56, ny: .42, nx2: .60, ny2: .44, width: 70 },  // volcano east approach
      { nx: .62, ny: .45, nx2: .66, ny2: .45, width: 80 },  // climb to Black Temple
      { nx: .40, ny: .55, nx2: .37, ny2: .57, width: 60 },  // Wildhammer shelf
    ],
    noise: 12,
  },
  water: [
    // Fel lava pools — shallow, glowing.
    { kind: 'lake', nx: .50, ny: .58, nrx: .06, nry: .05, depth: .4 },
    { kind: 'lake', nx: .68, ny: .70, nrx: .07, nry: .06, depth: .4 },
    // Lava channel from the Hand of Gul'dan south.
    { kind: 'river', nx: .50, ny: .60, width: 80, depth: .4, points: [[.50, .50], [.52, .62], [.50, .75], [.52, .90]] },
  ],
  roads: [
    { id: 'shadowmoon-road', main: true, width: 80, points: [
      pt('shadowmoon', .45, 0), pt('shadowmoon', .40, .20), pt('shadowmoon', .30, .30),
      pt('shadowmoon', .40, .45), pt('shadowmoon', .35, .55), pt('shadowmoon', .55, .60),
      pt('shadowmoon', .60, .45), pt('shadowmoon', .70, .45),
    ] },
    { id: 'altar-road', width: 55, points: [pt('shadowmoon', .40, .45), pt('shadowmoon', .60, .30)] },
  ],
  towns: [
    { name: 'Wildhammer Stronghold', nx: .35, ny: .55, faction: 'alliance', tier: 'town' },
    { name: 'Shadowmoon Village', nx: .30, ny: .30, faction: 'horde', tier: 'town' },
    { name: 'Sanctum of the Stars', nx: .55, ny: .60, faction: 'neutral', tier: 'town' },
    { name: 'Altar of Sha\'tar', nx: .60, ny: .30, faction: 'neutral', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Legion Hold', nx: .22, ny: .38, members: ['emberAcolyte', 'brute', 'caster', 'hound'] },
    { kind: 'camp', name: 'Illidari Point', nx: .30, ny: .50, members: ['caster', 'stalker'] },
    { kind: 'camp', name: 'Dragonmaw Fortress', nx: .68, ny: .62, members: ['brute', 'archer', 'caster'] },
    { kind: 'beastDen', name: 'Netherwing Ledge', nx: .70, ny: .82, members: ['stalker', 'stormSentinel'] },
    { kind: 'corruptedGrove', name: 'The Fel Pits', nx: .48, ny: .72, members: ['emberAcolyte', 'wisp'] },
    { kind: 'ruinedChapel', name: 'Ruins of Karabor', nx: .72, ny: .42, members: ['graveMarshal', 'caster'] },
  ],
  spawns: [
    { kind: 'emberAcolyte', weight: 24 }, // demons of Legion Hold
    { kind: 'brute', weight: 20 },        // fel orcs, Dragonmaw
    { kind: 'caster', weight: 18 },       // warlocks, Illidari
    { kind: 'stalker', weight: 14 },      // nether drakes, ravagers
    { kind: 'hound', weight: 12 },        // fel hounds
    { kind: 'graveMarshal', weight: 12 }, // restless dead of Karabor
  ],
  pois: [
    { name: 'The Black Temple', kind: 'dungeon', nx: .70, ny: .45, description: 'Illidan Stormrage\'s fortress.' },
    { name: 'The Hand of Gul\'dan', kind: 'landmark', nx: .50, ny: .45, description: 'The volcano born of Gul\'dan\'s spell.' },
    { name: 'Legion Hold', kind: 'camp', nx: .22, ny: .38, description: 'Burning Legion staging ground.' },
    { name: 'Netherwing Fields', kind: 'landmark', nx: .62, ny: .78, description: 'Fel flats where nether drakes gather.' },
    { name: 'Warden\'s Cage', kind: 'watchtower', nx: .58, ny: .50, description: 'Maiev\'s prison.' },
    { name: 'The Deathforge', kind: 'quarry', nx: .40, ny: .40, description: 'Infernal manufactory beneath the volcano.' },
  ],
  entrances: [
    { name: 'Black Temple', nx: .70, ny: .45, levelMin: 67, levelMax: 70, kind: 'raid', theme: 'blackrock' },
  ],
});
