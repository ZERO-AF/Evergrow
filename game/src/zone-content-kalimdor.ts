/** Authored zone content for kalimdor (wayfinder world-t06-t09). Each zone calls
 * defineZoneContent({...}) to register palette/props/elevation/water/roads/
 * towns/camps/spawns/pois/entrances. Coordinates nx/ny are normalized inside
 * the zone rect; road points are world-space. See zone-content.ts. */
import { defineZoneContent } from './zone-content.ts';

// ── Teldrassil (0,20000 60000×40000, alliance 1-10) ───────────────────────────
// World-tree canopy: purple boughs, moonwells, lakes. Island — no land borders.
defineZoneContent({
  id: 'teldrassil',
  palette: 'purple world-tree forest',
  props: [
    { kind: 'canopy', weight: 46 }, { kind: 'tree', weight: 12 }, { kind: 'fern', weight: 14 },
    { kind: 'flowers', weight: 10 }, { kind: 'mushrooms', weight: 8 }, { kind: 'stump', weight: 5 },
    { kind: 'rock', weight: 5 },
  ],
  water: [
    { kind: 'lake', nx: .42, ny: .18, nrx: .08, nry: .06, depth: .8 },   // Wellspring Lake
    { kind: 'lake', nx: .30, ny: .62, nrx: .05, nry: .045, depth: .7 },  // Pools of Arlithrien
    { kind: 'lake', nx: .68, ny: .42, nrx: .045, nry: .04, depth: .7 },  // Lake Al'Ameth
    { kind: 'river', nx: 0.488, ny: 0.435, points: [[.42, .24], [.46, .38], [.52, .5], [.55, .62]], width: 90, depth: .5 },
  ],
  roads: [
    // Darnassus → Dolanaar → Rut'theran Village + dock.
    { id: 'teldrassil-road', main: true, width: 90, points: [
      [21000,31200], [27000,34000], [33000,42000], [33000,50000], [33000,56800], [33000,58400]] },
  ],
  towns: [
    { name: 'Darnassus', nx: .35, ny: .28, faction: 'alliance', tier: 'capital' },
    { name: 'Dolanaar', nx: .55, ny: .55, faction: 'alliance', tier: 'town' },
    { name: "Rut'theran Village", nx: .55, ny: .92, faction: 'alliance', tier: 'village' },
    { name: 'Starbreeze Village', nx: .66, ny: .52, faction: 'alliance', tier: 'village' },
    { name: 'Shadowglen', nx: .58, ny: .38, faction: 'alliance', tier: 'outpost' },
  ],
  camps: [
    { kind: 'beastDen', name: 'Ban\'ethil Barrow Den', nx: .44, ny: .5, members: ['stalker', 'hound'] },
    { kind: 'camp', name: 'Gnarlpine Hold', nx: .44, ny: .72, members: ['brute', 'stalker'] },
    { kind: 'camp', name: 'Fel Rock', nx: .54, ny: .3, members: ['caster', 'stalker'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 4 }, { kind: 'hound', weight: 3 }, { kind: 'wisp', weight: 2 },
    { kind: 'brute', weight: 1 },
  ],
  pois: [
    { name: "Rut'theran Village Dock", kind: 'crossing', nx: .55, ny: .96, description: 'Ships to Auberdine and beyond.' },
    { name: 'The Oracle Tree', kind: 'landmark', nx: .3, ny: .22, description: 'A wise ancient watches over the boughs.' },
    { name: 'Wellspring Lake', kind: 'landmark', nx: .42, ny: .18 },
    { name: 'Ban\'ethil Barrow Den', kind: 'beastDen', nx: .44, ny: .5 },
    { name: 'Pools of Arlithrien', kind: 'landmark', nx: .3, ny: .62 },
    { name: 'Moonwell of Dolanaar', kind: 'shrine', nx: .56, ny: .57 },
  ],
  entrances: [],
});

// ── Bloodmyst Isle (0,100000 60000×40000, alliance 10-20) ─────────────────────
// Corrupted red-crystal isle: fel taint, mutated wildlife, blood elf invaders.
defineZoneContent({
  id: 'bloodmyst',
  palette: 'corrupted red-crystal isle',
  props: [
    { kind: 'iceCrystal', weight: 22 }, { kind: 'emberRock', weight: 16 }, { kind: 'deadTree', weight: 20 },
    { kind: 'mushrooms', weight: 18 }, { kind: 'basalt', weight: 10 }, { kind: 'stump', weight: 8 },
    { kind: 'tussock', weight: 6 },
  ],
  water: [
    { kind: 'lake', nx: .62, ny: .7, nrx: .07, nry: .06, depth: .8 },   // Bloodcurse-tainted shore pool
    { kind: 'lake', nx: .2, ny: .3, nrx: .05, nry: .05, depth: .7 },
  ],
  roads: [
    // Vindicator's Rest → Blood Watch → south border into Azuremyst (y=140000).
    { id: 'bloodmyst-road', main: true, width: 80, points: [
      [18000,122000], [24000,118000], [30000,120000], [30000,128000], [30000,140000]] },
  ],
  towns: [
    { name: 'Blood Watch', nx: .5, ny: .5, faction: 'alliance', tier: 'town' },
    { name: "Vindicator's Rest", nx: .3, ny: .55, faction: 'alliance', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'The Vector Coil', nx: .18, ny: .5, members: ['caster', 'stalker'] },
    { kind: 'camp', name: 'Axxarien', nx: .38, ny: .3, members: ['caster', 'brute'] },
    { kind: 'corruptedGrove', name: 'The Cryo-Core', nx: .38, ny: .62, members: ['wisp', 'stalker'] },
    { kind: 'camp', name: 'Blacksilt Shore', nx: .3, ny: .85, members: ['stalker', 'archer'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 4 }, { kind: 'caster', weight: 3 }, { kind: 'wisp', weight: 2 },
    { kind: 'hound', weight: 2 }, { kind: 'brute', weight: 1 },
  ],
  pois: [
    { name: 'The Cryo-Core', kind: 'landmark', nx: .38, ny: .62, description: 'A fallen piece of the Exodar, crawling with void-tainted creatures.' },
    { name: 'The Vector Coil', kind: 'corruptedGrove', nx: .18, ny: .5, description: 'Blood elf power siphon.' },
    { name: 'Axxarien', kind: 'camp', nx: .38, ny: .3 },
    { name: 'The Warp Piston', kind: 'landmark', nx: .53, ny: .18 },
    { name: 'Blacksilt Shore', kind: 'landmark', nx: .3, ny: .85 },
  ],
  entrances: [],
});

// ── Azuremyst Isle (0,140000 60000×60000, alliance 1-10) ──────────────────────
// Crystalline pine isle: draenei crash site, silverline lake, stillpine furbolgs.
defineZoneContent({
  id: 'azuremyst',
  palette: 'crystalline pine isle',
  props: [
    { kind: 'tree', weight: 30 }, { kind: 'iceCrystal', weight: 18 }, { kind: 'fern', weight: 14 },
    { kind: 'mushrooms', weight: 12 }, { kind: 'flowers', weight: 10 }, { kind: 'rock', weight: 8 },
    { kind: 'stump', weight: 8 },
  ],
  water: [
    { kind: 'lake', nx: .62, ny: .68, nrx: .09, nry: .07, depth: .8 },  // Silverline Lake
    { kind: 'river', nx: 0.568, ny: 0.438, points: [[.5, .2], [.55, .38], [.6, .55], [.62, .62]], width: 80, depth: .5 },
  ],
  roads: [
    // The Exodar → Azure Watch → north border into Bloodmyst (y=140000).
    { id: 'azuremyst-road', main: true, width: 80, points: [
      [18000,164000], [24000,168000], [30000,173000], [30000,156000], [30000,140000]] },
    // Azure Watch → Valaar's Berth dock.
    { id: 'azuremyst-dock-spur', width: 60, points: [[30000,173000], [22000,176000], [13200,173000]] },
  ],
  towns: [
    { name: 'The Exodar', nx: .3, ny: .4, faction: 'alliance', tier: 'capital' },
    { name: 'Azure Watch', nx: .5, ny: .55, faction: 'alliance', tier: 'town' },
    { name: "Odesyus' Landing", nx: .46, ny: .72, faction: 'alliance', tier: 'outpost' },
    { name: 'Stillpine Hold', nx: .45, ny: .22, faction: 'alliance', tier: 'village' },
  ],
  camps: [
    { kind: 'camp', name: 'Wrathscale Point', nx: .72, ny: .78, members: ['stalker', 'archer'] },
    { kind: 'beastDen', name: 'Stillpine Den', nx: .52, ny: .16, members: ['stalker', 'brute'] },
    { kind: 'camp', name: 'Moonwing Den', nx: .5, ny: .45, members: ['stalker', 'hound'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 4 }, { kind: 'hound', weight: 3 }, { kind: 'wisp', weight: 2 },
    { kind: 'archer', weight: 1 },
  ],
  pois: [
    { name: "Valaar's Berth", kind: 'crossing', nx: .22, ny: .55, description: 'Dock to Rut\'theran Village.' },
    { name: 'Ammen Vale', kind: 'landmark', nx: .78, ny: .6, description: 'The crash site where the draenei fell to Azeroth.' },
    { name: 'Silverline Lake', kind: 'landmark', nx: .62, ny: .68 },
    { name: 'Stillpine Hold', kind: 'town', nx: .45, ny: .22 },
    { name: 'Wrathscale Point', kind: 'camp', nx: .72, ny: .78 },
  ],
  entrances: [],
});

// ── Moonglade (140000,0 60000×40000, neutral 50-60) ───────────────────────────
// Sacred druid forest around Lake Elune'ara; Nighthaven is the Cenarion seat.
defineZoneContent({
  id: 'moonglade',
  palette: 'sacred druid forest',
  props: [
    { kind: 'tree', weight: 34 }, { kind: 'canopy', weight: 20 }, { kind: 'shrine', weight: 4 },
    { kind: 'flowers', weight: 16 }, { kind: 'fern', weight: 14 }, { kind: 'mushrooms', weight: 8 },
    { kind: 'stump', weight: 4 },
  ],
  water: [
    { kind: 'lake', nx: .62, ny: .55, nrx: .2, nry: .22, depth: .85 },  // Lake Elune'ara
  ],
  roads: [
    // Nighthaven → east border into Winterspring (x=220000).
    { id: 'moonglade-east', main: true, width: 80, points: [
      [190000,16000], [202000,18000], [220000,14667]] },
    // Nighthaven → south edge toward the Timbermaw tunnel to Felwood.
    { id: 'moonglade-south', width: 70, points: [
      [190000,16000], [192000,28000], [194000,40000]] },
  ],
  towns: [
    { name: 'Nighthaven', nx: .5, ny: .4, faction: 'neutral', tier: 'town' },
  ],
  camps: [
    { kind: 'standingStones', name: 'Stormrage Barrow Dens', nx: .68, ny: .28, members: ['wisp'] },
  ],
  spawns: [
    { kind: 'wisp', weight: 4 }, { kind: 'stalker', weight: 2 }, { kind: 'hound', weight: 2 },
  ],
  pois: [
    { name: 'Lake Elune\'ara', kind: 'landmark', nx: .62, ny: .55, description: 'Sacred lake of the Cenarion Circle.' },
    { name: 'Shrine of Remulos', kind: 'shrine', nx: .36, ny: .42, description: 'Keeper Remulos watches over the glade.' },
    { name: 'Stormrage Barrow Dens', kind: 'standingStones', nx: .68, ny: .28 },
    { name: 'Timbermaw Hold', kind: 'crossing', nx: .57, ny: .98, description: 'Furbolg tunnel to Felwood and Winterspring.' },
  ],
  entrances: [],
});

// ── Winterspring (200000,0 120000×60000, contested 55-60) ─────────────────────
// Snowy peaks: frostsaber cats, yeti, blue dragonkin of Mazthoril, Darkwhisper Gorge.
defineZoneContent({
  id: 'winterspring',
  palette: 'snowy mountains',
  props: [
    { kind: 'snowPine', weight: 48 }, { kind: 'iceCrystal', weight: 18 }, { kind: 'rock', weight: 10 },
    { kind: 'deadTree', weight: 6 }, { kind: 'tussock', weight: 10 }, { kind: 'stump', weight: 8 },
  ],
  elevation: {
    features: [
      { nx: .62, ny: .55, nw: .18, nh: .3, tier: 1 },                    // Frostwhisper rim
      { shape: 'disc', nx: .52, ny: .62, nr: .1, tier: 1 },              // Mazthoril spire base
      { nx: .05, ny: .05, nw: .2, nh: .18, tier: 1 },                    // northwest ridge
    ],
    ramps: [
      { nx: .6, ny: .55, nx2: .6, ny2: .45, width: 90 },                 // up to Everlook plateau edge
      { nx: .52, ny: .72, nx2: .52, ny2: .62, width: 80 },               // Mazthoril approach
    ],
    noise: 14,
  },
  water: [
    { kind: 'lake', nx: .38, ny: .55, nrx: .08, nry: .07, depth: .8 },  // Lake Kel'Theril (frozen)
  ],
  roads: [
    // West border (Moonglade x=220000) → Starfall Village → Everlook →
    // south-west corner (Timbermaw tunnel exit into Felwood at 212000,60000).
    { id: 'winterspring-road', main: true, width: 90, points: [
      [220000,14667], [230000,10667], [245000,12000], [265000,12000], [280000,16000],
      [270000,26667], [253333,34667], [230000,40000]] },
  ],
  towns: [
    { name: 'Everlook', nx: .6, ny: .4, faction: 'neutral', tier: 'town' },
    { name: 'Starfall Village', nx: .45, ny: .3, faction: 'alliance', tier: 'village' },
  ],
  camps: [
    { kind: 'beastDen', name: 'Ice Thistle Hills', nx: .68, ny: .5, members: ['brute', 'stalker'] },
    { kind: 'camp', name: 'Winterfall Village', nx: .68, ny: .38, members: ['brute', 'caster'] },
    { kind: 'camp', name: 'Mazthoril', nx: .52, ny: .62, members: ['caster', 'frostRevenant'] },
    { kind: 'corruptedGrove', name: 'Darkwhisper Gorge', nx: .55, ny: .88, members: ['brute', 'caster'] },
    { kind: 'beastDen', name: 'Frostsaber Rock', nx: .45, ny: .15, members: ['stalker', 'hound'] },
  ],
  spawns: [
    { kind: 'frostRevenant', weight: 3 }, { kind: 'stalker', weight: 3 }, { kind: 'brute', weight: 3 },
    { kind: 'hound', weight: 2 }, { kind: 'caster', weight: 1 },
  ],
  pois: [
    { name: 'Lake Kel\'Theril', kind: 'landmark', nx: .38, ny: .55, description: 'Frozen ruins of a highborne city.' },
    { name: 'Mazthoril', kind: 'landmark', nx: .52, ny: .62, description: 'Blue dragonflight caverns.' },
    { name: 'Frostwhisper Gorge', kind: 'landmark', nx: .62, ny: .8 },
    { name: 'Timbermaw Hold', kind: 'crossing', nx: .1, ny: .98, description: 'Furbolg tunnel to Felwood and Moonglade.' },
    { name: 'Darkwhisper Gorge', kind: 'corruptedGrove', nx: .55, ny: .88 },
  ],
  entrances: [],
});

// ── Darkshore (80000,0 60000×120000, alliance 10-20) ──────────────────────────
// Gloomy coastal forest: long north–south road, ruins of Mathystra, furbolg dens.
defineZoneContent({
  id: 'darkshore',
  palette: 'gloomy coastal forest',
  props: [
    { kind: 'tree', weight: 30 }, { kind: 'willow', weight: 16 }, { kind: 'deadTree', weight: 14 },
    { kind: 'fern', weight: 14 }, { kind: 'mushrooms', weight: 10 }, { kind: 'reeds', weight: 8 },
    { kind: 'stump', weight: 8 },
  ],
  water: [
    { kind: 'river', nx: 0.488, ny: 0.325, points: [[.55, .1], [.5, .25], [.46, .4], [.44, .55]], width: 90, depth: .5 }, // Cliffspring River
    { kind: 'lake', nx: .6, ny: .62, nrx: .05, nry: .04, depth: .7 },
  ],
  roads: [
    // North coast → Auberdine → Grove of the Ancients → south border into Ashenvale.
    { id: 'darkshore-road', main: true, width: 90, points: [
      [104000, 6000], [104000,30000], [104000,42000], [108000,60000],
      [110000,90000], [110000,114000], [114286,120000]] },
    // Auberdine → docks.
    { id: 'darkshore-dock-spur', width: 60, points: [[104000,42000], [100400,43200]] },
  ],
  towns: [
    { name: 'Auberdine', nx: .4, ny: .35, faction: 'alliance', tier: 'town' },
    { name: 'Grove of the Ancients', nx: .5, ny: .75, faction: 'alliance', tier: 'village' },
  ],
  camps: [
    { kind: 'camp', name: 'Bashal\'Aran', nx: .45, ny: .28, members: ['caster', 'wisp'] },
    { kind: 'beastDen', name: 'Cliffspring Falls', nx: .52, ny: .3, members: ['stalker', 'brute'] },
    { kind: 'camp', name: 'Twilight Encampment', nx: .42, ny: .6, members: ['caster', 'stalker'] },
    { kind: 'beastDen', name: 'Blackwood Den', nx: .52, ny: .85, members: ['brute', 'stalker'] },
  ],
  spawns: [
    { kind: 'hound', weight: 4 }, { kind: 'stalker', weight: 3 }, { kind: 'wisp', weight: 2 },
    { kind: 'brute', weight: 1 },
  ],
  pois: [
    { name: 'Auberdine Docks', kind: 'crossing', nx: .34, ny: .36, description: 'Ships to Rut\'theran and Stormwind.' },
    { name: 'Ruins of Mathystra', kind: 'landmark', nx: .58, ny: .18, description: 'Naga-infested highborne ruins.' },
    { name: 'Bashal\'Aran', kind: 'ruinedChapel', nx: .45, ny: .28 },
    { name: 'Ameth\'Aran', kind: 'ruinedChapel', nx: .43, ny: .58 },
    { name: 'The Master\'s Glaive', kind: 'landmark', nx: .38, ny: .85, description: 'A titanic sword buried in a dead old-god minion.' },
    { name: 'Cliffspring Falls', kind: 'landmark', nx: .52, ny: .3 },
  ],
  entrances: [],
});

// ── Felwood (140000,60000 80000×60000, contested 48-55) ───────────────────────
// Corrupted forest: satyr, deadwood furbolgs, Jaedenar cultists, slime pools.
defineZoneContent({
  id: 'felwood',
  palette: 'corrupted forest',
  props: [
    { kind: 'deadTree', weight: 44 }, { kind: 'mushrooms', weight: 16 }, { kind: 'stump', weight: 12 },
    { kind: 'rock', weight: 10 }, { kind: 'charredTree', weight: 8 }, { kind: 'tussock', weight: 6 },
    { kind: 'tree', weight: 4 },
  ],
  water: [
    { kind: 'river', nx: 0.463, ny: 0.4, points: [[.42, .1], [.45, .3], [.48, .5], [.5, .7]], width: 80, depth: .5 }, // Bloodvenom River
    { kind: 'lake', nx: .5, ny: .42, nrx: .04, nry: .04, depth: .8 },   // Bloodvenom Falls pool
  ],
  roads: [
    // North edge (Timbermaw tunnel from Moonglade/Winterspring) → Talonbranch →
    // Bloodvenom → Emerald Sanctuary → south border into Ashenvale (y=120000).
    { id: 'felwood-road', main: true, width: 90, points: [
      [182500,40000], [190000,56000], [195000,64000], [185000,80000],
      [180000,84000], [190000,100000], [194286,120000]] },
  ],
  towns: [
    { name: 'Bloodvenom Post', nx: .4, ny: .55, faction: 'horde', tier: 'outpost' },
    { name: 'Talonbranch Glade', nx: .55, ny: .3, faction: 'alliance', tier: 'village' },
    { name: 'Emerald Sanctuary', nx: .5, ny: .75, faction: 'neutral', tier: 'outpost' },
  ],
  camps: [
    { kind: 'corruptedGrove', name: 'Jaedenar', nx: .38, ny: .6, members: ['caster', 'stalker'] },
    { kind: 'camp', name: 'Deadwood Village', nx: .62, ny: .88, members: ['brute', 'caster'] },
    { kind: 'corruptedGrove', name: 'Jadefire Run', nx: .42, ny: .18, members: ['caster', 'stalker'] },
    { kind: 'corruptedGrove', name: 'Shatter Scar Vale', nx: .42, ny: .42, members: ['brute', 'caster'] },
    { kind: 'beastDen', name: 'Irontree Woods', nx: .52, ny: .22, members: ['brute', 'stalker'] },
  ],
  spawns: [
    { kind: 'caster', weight: 3 }, { kind: 'stalker', weight: 3 }, { kind: 'brute', weight: 2 },
    { kind: 'hound', weight: 2 }, { kind: 'wisp', weight: 1 },
  ],
  pois: [
    { name: 'Jaedenar', kind: 'corruptedGrove', nx: .38, ny: .6, description: 'Shadow Council stronghold beneath the corrupted barrow.' },
    { name: 'Ruins of Constellas', kind: 'ruinedChapel', nx: .38, ny: .68 },
    { name: 'Timbermaw Hold', kind: 'crossing', nx: .9, ny: .02, description: 'Furbolg tunnel to Moonglade and Winterspring.' },
    { name: 'Irontree Woods', kind: 'landmark', nx: .52, ny: .22 },
    { name: 'Bloodvenom Falls', kind: 'landmark', nx: .5, ny: .42 },
    { name: 'Shatter Scar Vale', kind: 'corruptedGrove', nx: .42, ny: .42 },
  ],
  entrances: [],
});

// ── Azshara (220000,60000 100000×80000, contested 45-55) ──────────────────────
// Autumnal cliffs: highborne ruins, naga coast, blue dragonkin, timbermaw holds.
defineZoneContent({
  id: 'azshara',
  palette: 'autumnal cliffs and naga ruins',
  props: [
    { kind: 'autumnTree', weight: 42 }, { kind: 'leafPile', weight: 18 }, { kind: 'fern', weight: 10 },
    { kind: 'mushrooms', weight: 10 }, { kind: 'rock', weight: 10 }, { kind: 'stump', weight: 6 },
    { kind: 'flowers', weight: 4 },
  ],
  elevation: {
    features: [
      { nx: .35, ny: .62, nw: .3, nh: .3, tier: 1 },                    // southern cliff shelf
      { shape: 'disc', nx: .62, ny: .3, nr: .09, tier: 1 },             // inland bluff
      { shape: 'disc', nx: .78, ny: .55, nr: .08, tier: 1 },
    ],
    ramps: [
      { nx: .42, ny: .62, nx2: .42, ny2: .72, width: 90 },              // cliff ramp on the road south
    ],
    noise: 12,
  },
  water: [
    { kind: 'river', nx: 0.537, ny: 0.375, points: [[.3, .2], [.45, .35], [.6, .45], [.8, .5]], width: 90, depth: .5 },
    { kind: 'lake', nx: .5, ny: .55, nrx: .05, nry: .04, depth: .7 },   // Lake Mennar basin
  ],
  roads: [
    // West border (Ashenvale x=240000) → Talrendis Point → Valormok →
    // south edge into Durotar (y=140000 at x=284000).
    { id: 'azshara-road', main: true, width: 90, points: [
      [240000,85000], [255000,100000], [270000,90000], [282000,100000],
      [292000,117500], [344000,140000]] },
    // Valormok → east coast ruins.
    { id: 'azshara-coast-spur', width: 60, points: [[270000,90000], [300000,80000], [320000,85000]] },
  ],
  towns: [
    { name: 'Valormok', nx: .3, ny: .5, faction: 'horde', tier: 'outpost' },
    { name: 'Talrendis Point', nx: .15, ny: .6, faction: 'alliance', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Legash Encampment', nx: .55, ny: .2, members: ['caster', 'brute'] },
    { kind: 'camp', name: 'Ursolan', nx: .42, ny: .3, members: ['brute', 'stalker'] },
    { kind: 'ruinedChapel', name: 'Ruins of Eldarath', nx: .6, ny: .55, members: ['stalker', 'caster'] },
    { kind: 'beastDen', name: 'Temple of Zin-Malor', nx: .62, ny: .32, members: ['caster', 'wisp'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 3 }, { kind: 'caster', weight: 3 }, { kind: 'brute', weight: 2 },
    { kind: 'hound', weight: 2 }, { kind: 'wisp', weight: 1 },
  ],
  pois: [
    { name: 'Ruins of Eldarath', kind: 'ruinedChapel', nx: .6, ny: .55, description: 'Naga-overrun highborne city.' },
    { name: 'Temple of Zin-Malor', kind: 'landmark', nx: .62, ny: .32 },
    { name: 'Lake Mennar', kind: 'landmark', nx: .5, ny: .55 },
    { name: 'The Shattered Strand', kind: 'landmark', nx: .45, ny: .78 },
    { name: 'Haldarr Encampment', kind: 'camp', nx: .2, ny: .32 },
  ],
  entrances: [],
});

// ── Ashenvale (80000,120000 160000×80000, contested 18-30) ────────────────────
// Dark ancient forest: the great east–west road, Warsong Gulch frontier, satyr ruins.
defineZoneContent({
  id: 'ashenvale',
  palette: 'dark ancient forest',
  props: [
    { kind: 'tree', weight: 40 }, { kind: 'canopy', weight: 18 }, { kind: 'fern', weight: 16 },
    { kind: 'mushrooms', weight: 10 }, { kind: 'stump', weight: 8 }, { kind: 'flowers', weight: 4 },
    { kind: 'rock', weight: 4 },
  ],
  water: [
    { kind: 'river', nx: 0.407, ny: 0.425, points: [[.3, .05], [.38, .3], [.45, .55], [.5, .8]], width: 100, depth: .55 }, // Falfarren River
    { kind: 'lake', nx: .45, ny: .45, nrx: .05, nry: .05, depth: .75 },  // Mystral Lake
    { kind: 'lake', nx: .62, ny: .7, nrx: .04, nry: .04, depth: .7 },    // Fallen Sky Lake
  ],
  roads: [
    // North border (Darkshore y=120000) → Astranaar.
    { id: 'ashenvale-north', width: 80, points: [
      [114286,120000], [123429,140000], [144000,164000]] },
    // Zoram'gar → Astranaar → Splintertree → Forest Song → east border (Azshara x=240000).
    { id: 'ashenvale-road', main: true, width: 100, points: [
      [92800,156000], [114286,160000], [144000,164000], [171429,160000],
      [195200,160000], [216000,152000], [240000,130000]] },
    // Splintertree → south border into the Barrens (y=200000 at Mor'shan).
    { id: 'ashenvale-south', width: 80, points: [
      [195200,160000], [205714,180000], [229600,200000]] },
  ],
  towns: [
    { name: 'Astranaar', nx: .4, ny: .55, faction: 'alliance', tier: 'town' },
    { name: 'Splintertree Post', nx: .72, ny: .5, faction: 'horde', tier: 'outpost' },
    { name: "Zoram'gar Outpost", nx: .08, ny: .45, faction: 'horde', tier: 'outpost' },
    { name: 'Forest Song', nx: .85, ny: .4, faction: 'alliance', tier: 'outpost' },
    { name: 'Maestra\'s Post', nx: .28, ny: .5, faction: 'alliance', tier: 'village' },
    { name: 'Silverwind Refuge', nx: .5, ny: .65, faction: 'alliance', tier: 'village' },
  ],
  camps: [
    { kind: 'camp', name: 'Satyrnaar', nx: .82, ny: .52, members: ['caster', 'stalker'] },
    { kind: 'camp', name: 'Warsong Lumber Camp', nx: .88, ny: .62, members: ['brute', 'archer'] },
    { kind: 'corruptedGrove', name: 'Xavian', nx: .78, ny: .45, members: ['caster', 'stalker'] },
    { kind: 'beastDen', name: 'Thistlefur Village', nx: .36, ny: .38, members: ['brute', 'stalker'] },
    { kind: 'camp', name: 'Felfire Hill', nx: .84, ny: .68, members: ['caster', 'brute'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 4 }, { kind: 'hound', weight: 3 }, { kind: 'archer', weight: 2 },
    { kind: 'caster', weight: 2 }, { kind: 'wisp', weight: 1 },
  ],
  pois: [
    { name: 'Blackfathom Deeps', kind: 'dungeon', nx: .12, ny: .2, description: 'Sunken night elf temple devoted to the Old Gods.' },
    { name: 'Mystral Lake', kind: 'landmark', nx: .45, ny: .45 },
    { name: 'The Dor\'Danil Barrow Den', kind: 'beastDen', nx: .76, ny: .75 },
    { name: 'Fire Scar Shrine', kind: 'corruptedGrove', nx: .26, ny: .62 },
    { name: 'Raynewood Retreat', kind: 'shrine', nx: .6, ny: .5 },
    { name: 'Bough Shadow', kind: 'landmark', nx: .93, ny: .38, description: 'One of the Great Trees guarding the Emerald Dream portals.' },
  ],
  entrances: [
    { name: 'Blackfathom Deeps', nx: .12, ny: .2, levelMin: 20, levelMax: 28, kind: 'dungeon', theme: 'drowned' },
  ],
});

// ── Durotar (300000,140000 80000×100000, horde 1-10) ──────────────────────────
// Arid red canyon: Orgrimmar on the north mesa, Southfury river on the west edge.
defineZoneContent({
  id: 'durotar',
  palette: 'arid red canyon',
  props: [
    { kind: 'basalt', weight: 26 }, { kind: 'rock', weight: 24 }, { kind: 'desertScrub', weight: 20 },
    { kind: 'dryGrass', weight: 14 }, { kind: 'thornBrush', weight: 10 }, { kind: 'sandstoneShard', weight: 6 },
  ],
  elevation: {
    features: [
      { nx: .05, ny: .05, nw: .25, nh: .3, tier: 1 },                   // western mesa wall
      { nx: .7, ny: .05, nw: .25, nh: .35, tier: 1 },                   // eastern mesa wall
      { shape: 'disc', nx: .3, ny: .55, nr: .08, tier: 1 },             // central butte
      { nx: .05, ny: .6, nw: .18, nh: .3, tier: 1 },                    // south-west rim
    ],
    ramps: [
      { nx: .3, ny: .35, nx2: .3, ny2: .45, width: 90 },                // mesa pass on the north road
      { nx: .52, ny: .45, nx2: .52, ny2: .55, width: 90 },              // Razor Hill approach
    ],
    noise: 10,
  },
  water: [
    // Southfury River along the west border with the Barrens.
    { kind: 'river', nx: 0.035, ny: 0.77, points: [[.02, .55], [.04, .7], [.03, .85], [.05, .98]], width: 140, depth: .8 },
  ],
  roads: [
    // Orgrimmar (+zeppelin tower) → Razor Hill → Sen'jin Village on the south coast.
    { id: 'durotar-road', main: true, width: 100, points: [
      [336000,150000], [334000,154000], [340000,170000], [341600,195000],
      [344000,222000], [344000,260000]] },
    // Razor Hill → west border into the Barrens (x=300000).
    { id: 'durotar-west', width: 80, points: [
      [341600,195000], [320000,198000], [300000,200000]] },
  ],
  towns: [
    { name: 'Orgrimmar', nx: .45, ny: .1, faction: 'horde', tier: 'capital' },
    { name: 'Razor Hill', nx: .52, ny: .55, faction: 'horde', tier: 'town' },
    { name: "Sen'jin Village", nx: .55, ny: .82, faction: 'horde', tier: 'village' },
    { name: 'Valley of Trials', nx: .42, ny: .68, faction: 'horde', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Kolkar Crag', nx: .48, ny: .78, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'Burning Blade Coven', nx: .52, ny: .28, members: ['caster', 'stalker'] },
    { kind: 'beastDen', name: 'Skull Rock', nx: .55, ny: .12, members: ['caster', 'brute'] },
    { kind: 'camp', name: 'Thunder Ridge', nx: .4, ny: .28, members: ['brute', 'stalker'] },
  ],
  spawns: [
    { kind: 'duneScuttler', weight: 4 }, { kind: 'hound', weight: 3 }, { kind: 'stalker', weight: 2 },
    { kind: 'archer', weight: 1 },
  ],
  pois: [
    { name: 'Orgrimmar Zeppelin Tower', kind: 'crossing', nx: .35, ny: .14, description: 'Zeppelins to the Eastern Kingdoms and Northrend.' },
    { name: 'Ragefire Chasm', kind: 'dungeon', nx: .45, ny: .12, description: 'Burning Blade cult beneath Orgrimmar.' },
    { name: 'Valley of Trials', kind: 'landmark', nx: .42, ny: .68 },
    { name: 'Echo Isles', kind: 'landmark', nx: .68, ny: .85, description: 'Darkspear troll isles off the coast.' },
    { name: 'Thunder Ridge', kind: 'landmark', nx: .4, ny: .28 },
    { name: 'Tiragarde Keep', kind: 'ruinedChapel', nx: .58, ny: .58 },
  ],
  entrances: [
    { name: 'Ragefire Chasm', nx: .45, ny: .12, levelMin: 13, levelMax: 18, kind: 'dungeon', theme: 'foundry' },
  ],
});

// ── Stonetalon Mountains (80000,200000 60000×60000, contested 15-27) ──────────
// Rocky peaks and the charred vale: harpies, Venture Co., wyverns on the peak.
defineZoneContent({
  id: 'stonetalon',
  palette: 'rocky peaks and charred vale',
  props: [
    { kind: 'limestone', weight: 26 }, { kind: 'rock', weight: 24 }, { kind: 'windTree', weight: 14 },
    { kind: 'heather', weight: 12 }, { kind: 'tussock', weight: 14 }, { kind: 'charredTree', weight: 6 },
    { kind: 'stump', weight: 4 },
  ],
  elevation: {
    features: [
      { nx: .1, ny: .02, nw: .4, nh: .2, tier: 1 },                     // Stonetalon Peak massif
      { nx: .6, ny: .1, nw: .3, nh: .25, tier: 1 },                     // north-east ridge
      { nx: .3, ny: .35, nw: .25, nh: .2, tier: -1, kind: 'valley' },   // the Charred Vale
      { nx: .05, ny: .55, nw: .2, nh: .35, tier: 1 },                   // western wall
    ],
    ramps: [
      { nx: .3, ny: .22, nx2: .3, ny2: .15, width: 80 },                // up to Stonetalon Peak
      { nx: .55, ny: .45, nx2: .55, ny2: .6, width: 90 },               // down to Sun Rock Retreat
      { nx: .45, ny: .55, nx2: .42, ny2: .45, width: 80 },              // Charred Vale descent
    ],
    noise: 12,
  },
  water: [
    { kind: 'lake', nx: .48, ny: .18, nrx: .06, nry: .05, depth: .75 }, // Mirkfallon Lake
  ],
  roads: [
    // North border (Ashenvale y=200000) → Stonetalon Peak → Sun Rock Retreat →
    // south border into Desolace (y=260000).
    { id: 'stonetalon-road', main: true, width: 80, points: [
      [110000,200000], [104000,212000], [98000,209000], [104000,228000],
      [113000,236000], [110000,252000], [110000,260000]] },
    // Sun Rock Retreat → east border into the Barrens (x=140000).
    { id: 'stonetalon-east', width: 70, points: [
      [113000,236000], [126000,234000], [140000,230000]] },
  ],
  towns: [
    { name: 'Stonetalon Peak', nx: .3, ny: .15, faction: 'alliance', tier: 'outpost' },
    { name: 'Sun Rock Retreat', nx: .55, ny: .6, faction: 'horde', tier: 'village' },
  ],
  camps: [
    { kind: 'camp', name: 'Windshear Crag', nx: .72, ny: .5, members: ['goblin', 'goblinChief'] },
    { kind: 'beastDen', name: 'The Charred Vale', nx: .42, ny: .45, members: ['stalker', 'caster'] },
    { kind: 'camp', name: 'Boulderslide Ravine', nx: .62, ny: .88, members: ['brute', 'stalker'] },
    { kind: 'beastDen', name: 'Sishir Canyon', nx: .55, ny: .75, members: ['stalker', 'hound'] },
  ],
  spawns: [
    { kind: 'stormSentinel', weight: 3 }, { kind: 'stalker', weight: 3 }, { kind: 'brute', weight: 2 },
    { kind: 'goblin', weight: 2 }, { kind: 'hound', weight: 1 },
  ],
  pois: [
    { name: 'Mirkfallon Lake', kind: 'landmark', nx: .48, ny: .18 },
    { name: 'The Charred Vale', kind: 'landmark', nx: .42, ny: .45, description: 'A vale burned black by an ancient fire.' },
    { name: 'Windshear Crag', kind: 'quarry', nx: .72, ny: .5, description: 'Venture Co. strip-mining operation.' },
    { name: 'Boulderslide Ravine', kind: 'landmark', nx: .62, ny: .88 },
    { name: 'Webwinder Path', kind: 'landmark', nx: .55, ny: .68 },
  ],
  entrances: [],
});

// ── The Barrens, North (140000,200000 100000×60000, horde 10-20) ──────────────
// Savanna crossroads of Kalimdor: oases, quilboar dens, centaur, the Wailing Caverns.
defineZoneContent({
  id: 'barrens-north',
  palette: 'savanna',
  props: [
    { kind: 'dryGrass', weight: 60 }, { kind: 'thornBrush', weight: 14 }, { kind: 'steppeStone', weight: 10 },
    { kind: 'tussock', weight: 8 }, { kind: 'flowers', weight: 4 }, { kind: 'desertScrub', weight: 4 },
  ],
  water: [
    { kind: 'lake', nx: .45, ny: .35, nrx: .05, nry: .06, depth: .75 },  // Lushwater Oasis
    { kind: 'lake', nx: .55, ny: .78, nrx: .045, nry: .05, depth: .7 },  // Stagnant Oasis
    { kind: 'lake', nx: .45, ny: .12, nrx: .04, nry: .04, depth: .7 },   // Forgotten Pools
    // Southfury River along the east border with Durotar.
    { kind: 'river', nx: 0.98, ny: 0.475, points: [[.98, .05], [.97, .3], [.98, .6], [.99, .95]], width: 140, depth: .8 },
  ],
  roads: [
    // West border (Stonetalon x=140000) → The Crossroads → Ratchet + dock.
    { id: 'barrens-gold-road', main: true, width: 100, points: [
      [140000,230000], [172000,232000], [220000,233000], [252000,233000],
      [276000,233000], [280800,233600]] },
    // The Crossroads → north border into Ashenvale (y=200000 at Mor'shan Rampart).
    { id: 'barrens-north-spur', width: 80, points: [
      [220000,233000], [226400,218000], [229600,200000]] },
    // The Crossroads → south border into the Southern Barrens (y=260000).
    { id: 'barrens-south-spur', width: 80, points: [
      [220000,233000], [223200,246000], [271800,260000]] },
    // The Crossroads → east border into Durotar (x=300000).
    { id: 'barrens-east-spur', width: 80, points: [
      [252000,233000], [280800,216000], [300000,200000]] },
    // The Crossroads → Wailing Caverns.
    { id: 'barrens-wailing-spur', width: 60, points: [
      [220000,233000], [207200,230000], [196000,227000]] },
  ],
  towns: [
    { name: 'The Crossroads', nx: .5, ny: .55, faction: 'horde', tier: 'town' },
    { name: 'Ratchet', nx: .85, ny: .55, faction: 'neutral', tier: 'town' },
    { name: 'Mor\'shan Rampart', nx: .56, ny: .05, faction: 'horde', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Bramblescar', nx: .5, ny: .82, members: ['brute', 'caster'] },
    { kind: 'camp', name: 'Dreadmist Peak', nx: .48, ny: .18, members: ['caster', 'stalker'] },
    { kind: 'camp', name: 'Grol\'dom Farm', nx: .56, ny: .4, members: ['brute', 'archer'] },
    { kind: 'beastDen', name: 'Raptor Grounds', nx: .6, ny: .52, members: ['stalker', 'hound'] },
    { kind: 'camp', name: 'The Dry Hills', nx: .38, ny: .28, members: ['brute', 'caster'] },
  ],
  spawns: [
    { kind: 'duneScuttler', weight: 4 }, { kind: 'hound', weight: 3 }, { kind: 'stalker', weight: 3 },
    { kind: 'archer', weight: 2 }, { kind: 'brute', weight: 1 },
  ],
  pois: [
    { name: 'Ratchet Dock', kind: 'crossing', nx: .88, ny: .56, description: 'Ship to Booty Bay.' },
    { name: 'Wailing Caverns', kind: 'dungeon', nx: .35, ny: .45, description: 'Druids of the Fang twist the caverns\' dreams.' },
    { name: 'Lushwater Oasis', kind: 'landmark', nx: .45, ny: .35 },
    { name: 'Dreadmist Peak', kind: 'landmark', nx: .48, ny: .18 },
    { name: 'The Mor\'shan Rampart', kind: 'watchtower', nx: .56, ny: .05 },
    { name: 'Thorn Hill', kind: 'camp', nx: .6, ny: .3 },
  ],
  entrances: [
    { name: 'Wailing Caverns', nx: .35, ny: .45, levelMin: 15, levelMax: 25, kind: 'dungeon', theme: 'rootbound' },
  ],
});

// ── The Barrens, South (240000,260000 60000×80000, horde 20-35) ──────────────
// Dry savanna and razorfen brambles: quilboar territory, Bael Modan, the Great Lift.
defineZoneContent({
  id: 'barrens-south',
  palette: 'dry savanna and razorfen brambles',
  props: [
    { kind: 'dryGrass', weight: 55 }, { kind: 'thornBrush', weight: 18 }, { kind: 'steppeStone', weight: 10 },
    { kind: 'desertScrub', weight: 8 }, { kind: 'tussock', weight: 6 }, { kind: 'rock', weight: 3 },
  ],
  water: [
    { kind: 'lake', nx: .65, ny: .4, nrx: .04, nry: .08, depth: .7 },    // small oasis
  ],
  roads: [
    // North border (y=260000) → Camp Taurajo → south border toward the Great Lift
    // into Thousand Needles (y=340000).
    { id: 'barrens-south-road', main: true, width: 90, points: [
      [271800,260000], [267600,284000], [264000,308000], [267600,324000],
      [270000,336000], [270000,340000]] },
    // Camp Taurajo → west border into Mulgore (x=240000).
    { id: 'barrens-mulgore-spur', width: 80, points: [
      [264000,308000], [252000,304000], [240000,300000]] },
    // Camp Taurajo → east border into Dustwallow (x=300000).
    { id: 'barrens-dustwallow-spur', width: 80, points: [
      [264000,308000], [282000,304000], [300000,313333]] },
    // Razorfen Kraul spur off the south road.
    { id: 'barrens-kraul-spur', width: 60, points: [[267600,324000], [260400,324000], [256800,328000]] },
  ],
  towns: [
    { name: 'Camp Taurajo', nx: .4, ny: .6, faction: 'horde', tier: 'town' },
  ],
  camps: [
    { kind: 'camp', name: 'Blackthorn Ridge', nx: .42, ny: .82, members: ['brute', 'caster'] },
    { kind: 'quarry', name: 'Bael Modan', nx: .5, ny: .82, members: ['goblin', 'brute'] },
    { kind: 'camp', name: 'Field of Giants', nx: .48, ny: .7, members: ['duneScuttler', 'stalker'] },
    { kind: 'camp', name: 'Agama\'gor', nx: .45, ny: .5, members: ['brute', 'caster'] },
  ],
  spawns: [
    { kind: 'duneScuttler', weight: 4 }, { kind: 'brute', weight: 3 }, { kind: 'hound', weight: 2 },
    { kind: 'stalker', weight: 2 }, { kind: 'caster', weight: 1 },
  ],
  pois: [
    { name: 'Razorfen Kraul', kind: 'dungeon', nx: .28, ny: .85, description: 'Quilboar capital beneath the brambles.' },
    { name: 'Razorfen Downs', kind: 'dungeon', nx: .5, ny: .95, description: 'Scourge-infested quilboar burial downs.' },
    { name: 'Bael Modan', kind: 'quarry', nx: .5, ny: .82, description: 'Dwarven excavation dug into tauren land.' },
    { name: 'The Great Lift', kind: 'crossing', nx: .6, ny: .98, description: 'Elevator down into Thousand Needles.' },
    { name: 'Field of Giants', kind: 'landmark', nx: .48, ny: .7 },
  ],
  entrances: [
    { name: 'Razorfen Kraul', nx: .28, ny: .85, levelMin: 24, levelMax: 32, kind: 'dungeon', theme: 'rootbound' },
    { name: 'Razorfen Downs', nx: .5, ny: .95, levelMin: 34, levelMax: 42, kind: 'dungeon', theme: 'ossuary' },
  ],
});

// ── Dustwallow Marsh (240000,240000 80000×60000, contested 35-45) ─────────────
// Swamp: Theramore Isle, Brackenwall ogres, black dragonflight, Onyxia's brood.
defineZoneContent({
  id: 'dustwallow',
  palette: 'swamp',
  props: [
    { kind: 'willow', weight: 34 }, { kind: 'reeds', weight: 22 }, { kind: 'lilies', weight: 14 },
    { kind: 'deadTree', weight: 12 }, { kind: 'mushrooms', weight: 8 }, { kind: 'stump', weight: 6 },
    { kind: 'rock', weight: 4 },
  ],
  water: [
    { kind: 'lake', nx: .55, ny: .4, nrx: .08, nry: .07, depth: .8 },    // Witch Hill bog
    { kind: 'lake', nx: .3, ny: .6, nrx: .07, nry: .06, depth: .75 },
    { kind: 'lake', nx: .6, ny: .85, nrx: .06, nry: .05, depth: .8 },    // Dragonmurk pools
    { kind: 'river', nx: 0.275, ny: 0.443, points: [[.05, .3], [.2, .42], [.35, .5], [.5, .55]], width: 110, depth: .6 },
  ],
  roads: [
    // West border (Barrens x=300000) → Brackenwall → Mudsprocket →
    // Theramore Isle + dock.
    { id: 'dustwallow-road', main: true, width: 90, points: [
      [300000,313333], [312000,300000], [328000,284000], [340000,300000],
      [350000,313333], [360000,304000], [362400,304800]] },
    // Mudsprocket → south border into Thousand Needles (y=340000).
    { id: 'dustwallow-south', width: 70, points: [
      [340000,300000], [340000,324000], [290000,400000]] },
  ],
  towns: [
    { name: 'Theramore Isle', nx: .75, ny: .55, faction: 'alliance', tier: 'town' },
    { name: 'Brackenwall Village', nx: .35, ny: .3, faction: 'horde', tier: 'town' },
    { name: 'Mudsprocket', nx: .4, ny: .75, faction: 'neutral', tier: 'outpost' },
    { name: 'North Point Tower', nx: .48, ny: .22, faction: 'alliance', tier: 'outpost' },
  ],
  camps: [
    { kind: 'bossLair', name: 'Onyxia\'s Lair Approach', nx: .52, ny: .72, members: ['brute', 'stalker'] },
    { kind: 'camp', name: 'Witch Hill', nx: .55, ny: .38, members: ['caster', 'wisp'] },
    { kind: 'beastDen', name: 'The Dragonmurk', nx: .62, ny: .75, members: ['stalker', 'brute'] },
    { kind: 'camp', name: 'Darkmist Cavern', nx: .32, ny: .22, members: ['stalker', 'caster'] },
    { kind: 'camp', name: 'Murloc Shoals', nx: .58, ny: .15, members: ['mireSpitter', 'stalker'] },
  ],
  spawns: [
    { kind: 'mireSpitter', weight: 4 }, { kind: 'stalker', weight: 3 }, { kind: 'brute', weight: 2 },
    { kind: 'caster', weight: 2 }, { kind: 'hound', weight: 1 },
  ],
  pois: [
    { name: 'Theramore Dock', kind: 'crossing', nx: .78, ny: .56, description: 'Ship to Menethil Harbor.' },
    { name: 'Onyxia\'s Lair', kind: 'dungeon', nx: .5, ny: .7, description: 'Broodmother of the black dragonflight.' },
    { name: 'Witch Hill', kind: 'landmark', nx: .55, ny: .38 },
    { name: 'The Dragonmurk', kind: 'beastDen', nx: .62, ny: .75 },
    { name: 'Shady Rest Inn', kind: 'ruinedChapel', nx: .3, ny: .48, description: 'A burned-out roadside inn with a mystery.' },
    { name: 'Alcaz Island', kind: 'landmark', nx: .78, ny: .18 },
  ],
  entrances: [
    { name: 'Onyxia\'s Lair', nx: .5, ny: .7, levelMin: 80, levelMax: 80, kind: 'raid', theme: 'ossuary' },
  ],
});

// ── Desolace (80000,260000 60000×60000, contested 30-40) ──────────────────────
// Grey barren wastes: centaur clans, thunder lizards, Maraudon burial grounds.
defineZoneContent({
  id: 'desolace',
  palette: 'grey barren wastes',
  props: [
    { kind: 'steppeStone', weight: 28 }, { kind: 'deadTree', weight: 22 }, { kind: 'rock', weight: 18 },
    { kind: 'dryGrass', weight: 14 }, { kind: 'desertScrub', weight: 10 }, { kind: 'stump', weight: 8 },
  ],
  roads: [
    // North border (Stonetalon y=260000) → Nijel's Point → Shadowprey →
    // south border into Feralas (y=320000).
    { id: 'desolace-road', main: true, width: 90, points: [
      [110000,260000], [114000,264000], [116000,266000], [104000,280000],
      [95000,302000], [100000,314000], [112000,320000]] },
    // Shadowprey → Maraudon spur.
    { id: 'desolace-maraudon-spur', width: 60, points: [[95000,302000], [100000,296000], [101000,293000]] },
  ],
  towns: [
    { name: 'Nijel\'s Point', nx: .6, ny: .1, faction: 'alliance', tier: 'outpost' },
    { name: 'Shadowprey Village', nx: .25, ny: .7, faction: 'horde', tier: 'village' },
    { name: 'Ghost Walker Post', nx: .55, ny: .55, faction: 'horde', tier: 'outpost' },
  ],
  camps: [
    { kind: 'graveyard', name: 'Valley of Bones', nx: .62, ny: .85, members: ['graveMarshal', 'stalker'] },
    { kind: 'camp', name: 'Magram Village', nx: .72, ny: .68, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'Gelkis Village', nx: .38, ny: .82, members: ['brute', 'caster'] },
    { kind: 'beastDen', name: 'Thunder Axe Fortress', nx: .55, ny: .28, members: ['brute', 'caster'] },
    { kind: 'camp', name: 'Kolkar Village', nx: .72, ny: .45, members: ['brute', 'archer'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 3 }, { kind: 'brute', weight: 3 }, { kind: 'caster', weight: 2 },
    { kind: 'hound', weight: 2 }, { kind: 'duneScuttler', weight: 1 },
  ],
  pois: [
    { name: 'Maraudon', kind: 'dungeon', nx: .35, ny: .55, description: 'Burial caves of Zaetar, corrupted by Theradras.' },
    { name: 'Valley of Bones', kind: 'graveyard', nx: .62, ny: .85 },
    { name: 'Thunder Axe Fortress', kind: 'watchtower', nx: .55, ny: .28 },
    { name: 'Mannoroc Coven', kind: 'corruptedGrove', nx: .52, ny: .78 },
    { name: 'Sargeron', kind: 'ruinedChapel', nx: .75, ny: .2 },
    { name: 'Ethel Rethor', kind: 'ruinedChapel', nx: .38, ny: .28 },
  ],
  entrances: [
    { name: 'Maraudon', nx: .35, ny: .55, levelMin: 40, levelMax: 52, kind: 'dungeon', theme: 'rootbound' },
  ],
});

// ── Mulgore (140000,300000 60000×60000, horde 1-10) ───────────────────────────
// Green plains and mesas: Thunder Bluff on its mesa, Bael'dun digsite, quilboar.
defineZoneContent({
  id: 'mulgore',
  palette: 'green plains and mesas',
  props: [
    { kind: 'tussock', weight: 34 }, { kind: 'dryGrass', weight: 26 }, { kind: 'heather', weight: 14 },
    { kind: 'flowers', weight: 10 }, { kind: 'steppeStone', weight: 8 }, { kind: 'tree', weight: 8 },
  ],
  elevation: {
    features: [
      { nx: .35, ny: .22, nw: .2, nh: .22, tier: 1 },                   // Thunder Bluff mesa
      { shape: 'disc', nx: .7, ny: .5, nr: .08, tier: 1 },              // eastern butte
      { nx: .05, ny: .7, nw: .2, nh: .25, tier: 1 },                    // south-west mesa
    ],
    ramps: [
      { nx: .45, ny: .44, nx2: .45, ny2: .35, width: 100 },             // Thunder Bluff rise (lifts)
      { nx: .5, ny: .5, nx2: .5, ny2: .62, width: 90 },                 // down to Bloodhoof
    ],
    noise: 8,
  },
  water: [
    { kind: 'lake', nx: .45, ny: .62, nrx: .07, nry: .05, depth: .75 }, // Stonebull Lake
    { kind: 'river', nx: 0.52, ny: 0.777, points: [[.45, .58], [.5, .7], [.55, .85], [.58, .98]], width: 80, depth: .5 },
  ],
  roads: [
    // Thunder Bluff → Bloodhoof Village → east border into the Barrens (x=240000).
    { id: 'mulgore-road', main: true, width: 90, points: [
      [196000,287500], [200000,295000], [200000,301000], [216000,286667], [276000,300000]] },
    // Bloodhoof → Camp Narache (south).
    { id: 'mulgore-narache-spur', width: 60, points: [[200000,301000], [194667,310000], [190933,315000]] },
  ],
  towns: [
    { name: 'Thunder Bluff', nx: .45, ny: .35, faction: 'horde', tier: 'capital' },
    { name: 'Bloodhoof Village', nx: .5, ny: .62, faction: 'horde', tier: 'village' },
    { name: 'Camp Narache', nx: .44, ny: .78, faction: 'horde', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Bael\'dun Digsite', nx: .32, ny: .48, members: ['goblin', 'brute'] },
    { kind: 'camp', name: 'Brambleblade Ravine', nx: .62, ny: .82, members: ['brute', 'caster'] },
    { kind: 'beastDen', name: 'The Venture Co. Mine', nx: .62, ny: .3, members: ['goblin', 'goblinChief'] },
    { kind: 'camp', name: 'Palemane Rock', nx: .35, ny: .62, members: ['brute', 'stalker'] },
  ],
  spawns: [
    { kind: 'duneScuttler', weight: 3 }, { kind: 'hound', weight: 3 }, { kind: 'stalker', weight: 2 },
    { kind: 'brute', weight: 2 }, { kind: 'archer', weight: 1 },
  ],
  pois: [
    { name: 'Stonebull Lake', kind: 'landmark', nx: .45, ny: .62 },
    { name: 'Bael\'dun Digsite', kind: 'quarry', nx: .32, ny: .48 },
    { name: 'The Venture Co. Mine', kind: 'quarry', nx: .62, ny: .3 },
    { name: 'Red Rocks', kind: 'landmark', nx: .6, ny: .2, description: 'Sacred tauren burial grounds.' },
    { name: 'Windfury Ridge', kind: 'landmark', nx: .52, ny: .12 },
  ],
  entrances: [],
});

// ── Thousand Needles (200000,300000 40000×60000, contested 25-35) ─────────────
// Canyon needles and salt flats: mesa tops linked by bridges, wyverns, centaur.
defineZoneContent({
  id: 'thousand-needles',
  palette: 'canyon needles and salt flats',
  props: [
    { kind: 'sandstone', weight: 30 }, { kind: 'sandstoneShard', weight: 22 }, { kind: 'desertScrub', weight: 20 },
    { kind: 'dryGrass', weight: 12 }, { kind: 'rock', weight: 10 }, { kind: 'thornBrush', weight: 6 },
  ],
  elevation: {
    features: [
      { shape: 'disc', nx: .45, ny: .45, nr: .1, tier: 1, kind: 'mesa' },   // Freewind Post mesa
      { shape: 'disc', nx: .3, ny: .3, nr: .07, tier: 1, kind: 'mesa' },    // Darkcloud Pinnacle
      { shape: 'disc', nx: .62, ny: .25, nr: .06, tier: 1, kind: 'mesa' },
      { shape: 'disc', nx: .25, ny: .6, nr: .06, tier: 1, kind: 'mesa' },
      { nx: .55, ny: .75, nw: .4, nh: .2, tier: -1, kind: 'valley' },       // Shimmering Flats basin
    ],
    ramps: [
      { nx: .45, ny: .55, nx2: .45, ny2: .45, width: 90 },                  // Freewind lift ramp
      { nx: .3, ny: .37, nx2: .3, ny2: .3, width: 70 },                     // Darkcloud Pinnacle bridge
      { nx: .7, ny: .75, nx2: .75, ny2: .6, width: 90 },                    // down to Mirage Raceway
    ],
    noise: 10,
  },
  water: [],
  roads: [
    // North border (the Great Lift from Barrens y=340000) → Freewind Post →
    // Mirage Raceway → south border toward Un'Goro (y=400000).
    { id: 'needles-road', main: true, width: 80, points: [
      [270000,340000], [250000,352000], [241000,367000], [277000,376000],
      [295000,376000], [268000,388000], [200000,400000]] },
    // Freewind → south border toward Tanaris (y=400000).
    { id: 'needles-east', width: 70, points: [[295000,376000], [322000,372000], [240000,418000]] },
  ],
  towns: [
    { name: 'Freewind Post', nx: .45, ny: .45, faction: 'horde', tier: 'outpost' },
    { name: 'Mirage Raceway', nx: .75, ny: .6, faction: 'neutral', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Darkcloud Pinnacle', nx: .3, ny: .3, members: ['brute', 'caster'] },
    { kind: 'beastDen', name: 'Highperch', nx: .28, ny: .55, members: ['stalker', 'archer'] },
    { kind: 'camp', name: 'Splithoof Crag', nx: .42, ny: .32, members: ['brute', 'archer'] },
    { kind: 'beastDen', name: 'The Screeching Canyon', nx: .28, ny: .48, members: ['stalker', 'duneScuttler'] },
  ],
  spawns: [
    { kind: 'duneScuttler', weight: 4 }, { kind: 'stalker', weight: 3 }, { kind: 'brute', weight: 2 },
    { kind: 'archer', weight: 2 }, { kind: 'stormSentinel', weight: 1 },
  ],
  pois: [
    { name: 'The Great Lift', kind: 'crossing', nx: .12, ny: .02, description: 'Elevator up to the Southern Barrens.' },
    { name: 'The Shimmering Flats', kind: 'landmark', nx: .75, ny: .8, description: 'Salt flat raceway of the goblins and gnomes.' },
    { name: 'Darkcloud Pinnacle', kind: 'landmark', nx: .3, ny: .3 },
    { name: 'Highperch', kind: 'beastDen', nx: .28, ny: .55, description: 'Wyvern nesting grounds.' },
    { name: 'Roguefeather Den', kind: 'beastDen', nx: .52, ny: .55 },
  ],
  entrances: [],
});

// ── Feralas (80000,320000 60000×40000, contested 40-50) ───────────────────────
// Lush jungle forest: Dire Maul ogre city, Twin Colossals, green dragonkin.
defineZoneContent({
  id: 'feralas',
  palette: 'lush jungle forest',
  props: [
    { kind: 'canopy', weight: 40 }, { kind: 'tree', weight: 16 }, { kind: 'fern', weight: 18 },
    { kind: 'mushrooms', weight: 10 }, { kind: 'flowers', weight: 8 }, { kind: 'stump', weight: 4 },
    { kind: 'rock', weight: 4 },
  ],
  elevation: {
    features: [
      { shape: 'disc', nx: .2, ny: .25, nr: .06, tier: 1, kind: 'mesa' },   // Twin Colossal (west)
      { shape: 'disc', nx: .3, ny: .22, nr: .06, tier: 1, kind: 'mesa' },   // Twin Colossal (east)
    ],
    noise: 8,
  },
  water: [
    { kind: 'river', nx: 0.537, ny: 0.438, points: [[.5, .05], [.52, .3], [.55, .55], [.58, .85]], width: 100, depth: .55 }, // Wildwind River
    { kind: 'lake', nx: .5, ny: .6, nrx: .05, nry: .06, depth: .75 },      // Jademir Lake
  ],
  roads: [
    // North border (Desolace y=320000) → Camp Mojache → Thalanaar →
    // east border into Thousand Needles (x=160000).
    { id: 'feralas-road', main: true, width: 90, points: [
      [112000,320000], [122667,335000], [140000,347000], [152000,341000], [160000,360000]] },
    // Camp Mojache → Feathermoon Stronghold spur (west).
    { id: 'feralas-west', width: 70, points: [[140000,347000], [113333,350000], [92000,353000]] },
    // Dire Maul spur.
    { id: 'feralas-diremaul-spur', width: 60, points: [[140000,347000], [130667,344000], [124000,344000]] },
  ],
  towns: [
    { name: 'Feathermoon Stronghold', nx: .15, ny: .55, faction: 'alliance', tier: 'town' },
    { name: 'Camp Mojache', nx: .75, ny: .45, faction: 'horde', tier: 'village' },
    { name: 'Thalanaar', nx: .9, ny: .35, faction: 'alliance', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Gordunni Outpost', nx: .75, ny: .3, members: ['brute', 'caster'] },
    { kind: 'beastDen', name: 'Feral Scar Vale', nx: .55, ny: .58, members: ['brute', 'stalker'] },
    { kind: 'corruptedGrove', name: 'The Writhing Deep', nx: .72, ny: .62, members: ['duneScuttler', 'stalker'] },
    { kind: 'camp', name: 'Ruins of Isildien', nx: .6, ny: .7, members: ['brute', 'caster'] },
    { kind: 'beastDen', name: 'Jademir Lake', nx: .5, ny: .6, members: ['wisp', 'stalker'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 4 }, { kind: 'brute', weight: 3 }, { kind: 'hound', weight: 2 },
    { kind: 'caster', weight: 2 }, { kind: 'wisp', weight: 1 },
  ],
  pois: [
    { name: 'Dire Maul', kind: 'dungeon', nx: .55, ny: .4, description: 'Ogre-held ruin of the night elf city Eldre\'Thalas.' },
    { name: 'The Twin Colossals', kind: 'landmark', nx: .25, ny: .24 },
    { name: 'Dream Bough', kind: 'landmark', nx: .52, ny: .1, description: 'Great Tree portal to the Emerald Dream.' },
    { name: 'Ruins of Ravenwind', kind: 'ruinedChapel', nx: .4, ny: .15 },
    { name: 'The Forgotten Coast', kind: 'landmark', nx: .45, ny: .92 },
  ],
  entrances: [
    { name: 'Dire Maul', nx: .55, ny: .4, levelMin: 55, levelMax: 60, kind: 'dungeon', theme: 'rootbound' },
  ],
});

// ── Tanaris (240000,300000 80000×100000, contested 40-50) ─────────────────────
// Desert: Gadgetzan, Zul'Farrak troll city, dunemaul ogres, the Caverns of Time.
defineZoneContent({
  id: 'tanaris',
  palette: 'desert',
  props: [
    { kind: 'desertScrub', weight: 40 }, { kind: 'sandstoneShard', weight: 24 }, { kind: 'sandstone', weight: 16 },
    { kind: 'dryGrass', weight: 10 }, { kind: 'rock', weight: 6 }, { kind: 'thornBrush', weight: 4 },
  ],
  elevation: { noise: 14 },                                              // rolling dunes
  water: [],
  roads: [
    // North border (Thousand Needles y=400000) → Gadgetzan → Steamwheedle Port.
    { id: 'tanaris-road', main: true, width: 90, points: [
      [290000,400000], [290000,410800], [295000,418000], [305000,410800], [310000,407200]] },
    // Gadgetzan → Zul'Farrak spur (west).
    { id: 'tanaris-zulfarrak-spur', width: 70, points: [[295000,418000], [275000,420400], [260000,421000]] },
    // Gadgetzan → Caverns of Time (south-east).
    { id: 'tanaris-caverns-spur', width: 70, points: [[295000,418000], [300000,433600], [305000,445000]] },
    // Gadgetzan → west border into Un'Goro (x=240000).
    { id: 'tanaris-ungoro-spur', width: 70, points: [[295000,418000], [267500,433600], [240000,448000]] },
  ],
  towns: [
    { name: 'Gadgetzan', nx: .55, ny: .3, faction: 'neutral', tier: 'town' },
    { name: 'Steamwheedle Port', nx: .7, ny: .12, faction: 'neutral', tier: 'village' },
  ],
  camps: [
    { kind: 'camp', name: 'Dunemaul Compound', nx: .42, ny: .55, members: ['brute', 'caster'] },
    { kind: 'camp', name: 'Lost Rigger Cove', nx: .72, ny: .45, members: ['goblin', 'archer'] },
    { kind: 'beastDen', name: 'The Noxious Lair', nx: .35, ny: .45, members: ['duneScuttler', 'stalker'] },
    { kind: 'beastDen', name: 'The Gaping Chasm', nx: .55, ny: .68, members: ['duneScuttler', 'stalker'] },
    { kind: 'camp', name: 'Wastewander Camp', nx: .6, ny: .35, members: ['archer', 'brute'] },
  ],
  spawns: [
    { kind: 'duneScuttler', weight: 4 }, { kind: 'brute', weight: 3 }, { kind: 'stalker', weight: 2 },
    { kind: 'caster', weight: 2 }, { kind: 'goblin', weight: 1 },
  ],
  pois: [
    { name: 'Zul\'Farrak', kind: 'dungeon', nx: .2, ny: .35, description: 'Sandfury troll city of the desert.' },
    { name: 'Caverns of Time', kind: 'dungeon', nx: .65, ny: .75, description: 'Bronze dragonflight sanctum in the rock.' },
    { name: 'The Noxious Lair', kind: 'beastDen', nx: .35, ny: .45 },
    { name: 'Lost Rigger Cove', kind: 'camp', nx: .72, ny: .45 },
    { name: 'Sandsorrow Watch', kind: 'watchtower', nx: .42, ny: .28 },
    { name: 'Valley of the Watchers', kind: 'standingStones', nx: .38, ny: .78 },
  ],
  entrances: [
    { name: 'Zul\'Farrak', nx: .2, ny: .35, levelMin: 42, levelMax: 50, kind: 'dungeon', theme: 'ossuary' },
    { name: 'Caverns of Time', nx: .65, ny: .75, levelMin: 66, levelMax: 70, kind: 'dungeon', theme: 'astral' },
  ],
});

// ── Un'Goro Crater (200000,360000 40000×40000, contested 48-55) ───────────────
// Prehistoric jungle crater: rim walls, tar pits, devilsaurs, Fire Plume Ridge.
defineZoneContent({
  id: 'ungoro',
  palette: 'prehistoric jungle crater',
  props: [
    { kind: 'fern', weight: 30 }, { kind: 'canopy', weight: 26 }, { kind: 'reeds', weight: 14 },
    { kind: 'tree', weight: 12 }, { kind: 'mushrooms', weight: 10 }, { kind: 'flowers', weight: 8 },
  ],
  elevation: {
    features: [
      { nx: 0, ny: 0, nw: 1, nh: .08, tier: 1 },                        // north rim wall
      { nx: 0, ny: .92, nw: 1, nh: .08, tier: 1 },                      // south rim wall
      { nx: 0, ny: .08, nw: .08, nh: .84, tier: 1 },                    // west rim wall
      { nx: .92, ny: .08, nw: .08, nh: .84, tier: 1 },                  // east rim wall
      { shape: 'disc', nx: .5, ny: .5, nr: .12, tier: 1, kind: 'mesa' }, // Fire Plume Ridge
    ],
    ramps: [
      { nx: .92, ny: .5, nx2: .8, ny2: .5, width: 90 },                 // east pass from Tanaris
      { nx: .08, ny: .5, nx2: .2, ny2: .5, width: 90 },                 // west pass from Silithus
      { nx: .5, ny: .62, nx2: .5, ny2: .5, width: 80 },                 // Fire Plume Ridge climb
    ],
    noise: 10,
  },
  water: [
    { kind: 'lake', nx: .35, ny: .4, nrx: .06, nry: .05, depth: .7 },   // Lakkari Tar Pits
    { kind: 'lake', nx: .68, ny: .62, nrx: .05, nry: .05, depth: .7 },  // eastern tar pit
    { kind: 'river', nx: 0.432, ny: 0.5, points: [[.5, .2], [.45, .4], [.4, .6], [.38, .8]], width: 80, depth: .5 },
  ],
  roads: [
    // Marshal's Refuge → east pass into Tanaris (x=240000).
    { id: 'ungoro-east', main: true, width: 80, points: [
      [200000,409000], [212000,421000], [224000,430000], [240000,448000]] },
    // Marshal's Refuge → west pass into Silithus (x=160000).
    { id: 'ungoro-west', width: 80, points: [
      [200000,409000], [184000,421000], [172000,430000], [160000,430000]] },
  ],
  towns: [
    { name: 'Marshal\'s Refuge', nx: .5, ny: .15, faction: 'neutral', tier: 'outpost' },
  ],
  camps: [
    { kind: 'beastDen', name: 'The Slithering Scar', nx: .5, ny: .78, members: ['duneScuttler', 'stalker'] },
    { kind: 'beastDen', name: 'Terror Run', nx: .32, ny: .55, members: ['stalker', 'brute'] },
    { kind: 'camp', name: 'Lakkari Tar Pits', nx: .35, ny: .4, members: ['mireSpitter', 'brute'] },
    { kind: 'bossLair', name: 'Devilsaur Lair', nx: .6, ny: .6, members: ['brute', 'stalker'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 4 }, { kind: 'brute', weight: 3 }, { kind: 'duneScuttler', weight: 2 },
    { kind: 'mireSpitter', weight: 2 }, { kind: 'wisp', weight: 1 },
  ],
  pois: [
    { name: 'Fire Plume Ridge', kind: 'landmark', nx: .5, ny: .5, description: 'Volcanic heart of the crater.' },
    { name: 'Lakkari Tar Pits', kind: 'landmark', nx: .35, ny: .4 },
    { name: 'The Slithering Scar', kind: 'beastDen', nx: .5, ny: .78, description: 'Silithid incursion hive.' },
    { name: 'Terror Run', kind: 'beastDen', nx: .32, ny: .55 },
    { name: 'The Marshlands', kind: 'landmark', nx: .65, ny: .55 },
  ],
  entrances: [],
});

// ── Silithus (80000,360000 120000×40000, contested 55-60) ─────────────────────
// Silithid desert: three hives, Twilight's Hammer cult, the gates of Ahn'Qiraj.
defineZoneContent({
  id: 'silithus',
  palette: 'silithid desert',
  props: [
    { kind: 'sandstone', weight: 30 }, { kind: 'sandstoneShard', weight: 24 }, { kind: 'desertScrub', weight: 22 },
    { kind: 'rock', weight: 12 }, { kind: 'dryGrass', weight: 8 }, { kind: 'basalt', weight: 4 },
  ],
  elevation: { noise: 12 },                                              // dune field
  water: [
    { kind: 'lake', nx: .5, ny: .42, nrx: .03, nry: .05, depth: .6 },   // Cenarion Hold oasis pool
  ],
  roads: [
    // East border (Un'Goro x=160000) → Cenarion Hold →
    // south to the Scarab Wall / Ahn'Qiraj gates.
    { id: 'silithus-road', main: true, width: 90, points: [
      [160000,430000], [140000,424000], [120000,421000], [121333,436000],
      [124000,448000], [128000,455800]] },
  ],
  towns: [
    { name: 'Cenarion Hold', nx: .5, ny: .35, faction: 'neutral', tier: 'town' },
  ],
  camps: [
    { kind: 'beastDen', name: 'Hive\'Zora', nx: .3, ny: .55, members: ['duneScuttler', 'stalker'] },
    { kind: 'beastDen', name: 'Hive\'Ashi', nx: .48, ny: .28, members: ['duneScuttler', 'stalker'] },
    { kind: 'beastDen', name: 'Hive\'Regal', nx: .62, ny: .7, members: ['duneScuttler', 'brute'] },
    { kind: 'camp', name: 'Twilight Base Camp', nx: .42, ny: .42, members: ['caster', 'brute'] },
    { kind: 'camp', name: 'Twilight Post', nx: .68, ny: .3, members: ['caster', 'archer'] },
  ],
  spawns: [
    { kind: 'duneScuttler', weight: 4 }, { kind: 'stalker', weight: 3 }, { kind: 'caster', weight: 2 },
    { kind: 'brute', weight: 2 }, { kind: 'stormSentinel', weight: 1 },
  ],
  pois: [
    { name: 'The Scarab Wall', kind: 'landmark', nx: .58, ny: .88, description: 'Bronze-sealed gates of Ahn\'Qiraj.' },
    { name: 'Ruins of Ahn\'Qiraj', kind: 'dungeon', nx: .55, ny: .9 },
    { name: 'Temple of Ahn\'Qiraj', kind: 'dungeon', nx: .6, ny: .93 },
    { name: 'Hive\'Zora', kind: 'beastDen', nx: .3, ny: .55 },
    { name: 'Twilight Base Camp', kind: 'camp', nx: .42, ny: .42 },
    { name: 'The Crystal Vale', kind: 'landmark', nx: .28, ny: .2 },
  ],
  entrances: [
    { name: 'Ruins of Ahn\'Qiraj', nx: .55, ny: .9, levelMin: 60, levelMax: 60, kind: 'raid', theme: 'ossuary' },
    { name: 'Temple of Ahn\'Qiraj', nx: .6, ny: .93, levelMin: 60, levelMax: 60, kind: 'raid', theme: 'ossuary' },
  ],
});
