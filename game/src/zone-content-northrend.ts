/** Authored zone content for northrend (wayfinder world-t06-t09). Each zone calls
 * defineZoneContent({...}) to register palette/props/elevation/water/roads/
 * towns/camps/spawns/pois/entrances. Coordinates nx/ny are normalized inside
 * the zone rect; road points are world-space. See zone-content.ts.
 *
 * Northrend layout (world y grows southward): Icecrown/Storm Peaks/Zul'Drak on
 * the top row, Sholazar/Crystalsong/Grizzly Hills mid, Borean/Dragonblight/
 * Howling Fjord bottom, Wintergrasp between Sholazar and Crystalsong. Roads are
 * authored in normalized zone space and projected to world space at load so
 * border crossings line up exactly with the neighboring zone's stub. */
import { zoneRect } from './world-atlas.ts';
import { defineZoneContent, type RoadSpec } from './zone-content.ts';

/** Project a normalized in-zone polyline to world space for RoadSpec. */
const road = (zoneId: string, id: string, points: readonly (readonly [number, number])[],
  opts: { width?: number; main?: boolean } = {}): RoadSpec => {
  const r = zoneRect(zoneId)!;
  return {
    id, width: opts.width ?? 28, main: opts.main ?? false,
    points: points.map(([nx, ny]) => [r.x + nx * r.w, r.y + ny * r.h] as const),
  };
};

// ── Borean Tundra (68-72) — geysers, tundra flats, Coldarra ─────────────────
defineZoneContent({
  id: 'borean-tundra',
  palette: 'frozen tundra',
  props: [
    { kind: 'tussock', weight: 30 }, { kind: 'snowPine', weight: 22 },
    { kind: 'rock', weight: 16 }, { kind: 'iceCrystal', weight: 10 },
    { kind: 'deadTree', weight: 8 }, { kind: 'heather', weight: 8 },
    { kind: 'stump', weight: 6 },
  ],
  elevation: {
    features: [
      // Coldarra — the blue dragonflight island-plateau in the west.
      { shape: 'disc', nx: .28, ny: .28, nr: .16, tier: 1, edge: 44 },
      // Amber Ledge and the geyser mesas.
      { shape: 'disc', nx: .45, ny: .35, nr: .05, tier: 1 },
      { shape: 'disc', nx: .50, ny: .15, nr: .07, tier: 1 },
      // The Flood Plains sink toward the east coast.
      { nx: .55, ny: .40, nw: .30, nh: .20, tier: -1, kind: 'valley' },
    ],
    ramps: [
      { nx: .30, ny: .38, nx2: .29, ny2: .31, width: 60 },   // Transitus → Coldarra
      { nx: .45, ny: .41, nx2: .45, ny2: .37, width: 46 },   // up to Amber Ledge
      { nx: .50, ny: .23, nx2: .50, ny2: .18, width: 44 },   // geyser mesa
    ],
    noise: 10,
  },
  water: [
    { kind: 'lake', nx: .50, ny: .48, nrx: .09, nry: .07, depth: .8 },   // Lake Kum'uya
    { kind: 'lake', nx: .62, ny: .92, nrx: .20, nry: .06, depth: .9 },   // south coast
    { kind: 'river', nx: 0, ny: 0, points: [[.50, .18], [.52, .35], [.50, .48]], width: 40, depth: .5 },
  ],
  roads: [
    // East-west spine: Dragonblight crossing → Warsong Hold → Valiance Keep.
    road('borean-tundra', 'gold-road', [[1.0, .60], [.78, .58], [.55, .66], [.55, .75]], { main: true, width: 34 }),
    road('borean-tundra', 'warsong-spur', [[.55, .66], [.40, .55]]),
    // North road to the Sholazar pass and the Coldarra spur.
    road('borean-tundra', 'north-pass', [[.40, .55], [.44, .35], [.45, .30], [.45, 0]], { main: true }),
    road('borean-tundra', 'coldarra-spur', [[.44, .35], [.30, .35], [.28, .30]]),
    road('borean-tundra', 'unupe-road', [[.78, .58], [.78, .55]]),
  ],
  towns: [
    { name: 'Valiance Keep', nx: .55, ny: .75, faction: 'alliance', tier: 'town' },
    { name: 'Warsong Hold', nx: .40, ny: .55, faction: 'horde', tier: 'town' },
    { name: 'Amber Ledge', nx: .45, ny: .35, faction: 'neutral', tier: 'town' },
    { name: 'Transitus Shield', nx: .30, ny: .35, faction: 'neutral', tier: 'town' },
    { name: 'Unu\'pe', nx: .78, ny: .55, faction: 'neutral', tier: 'town' },
    { name: 'Taunka\'le Village', nx: .72, ny: .42, faction: 'horde', tier: 'village' },
    { name: 'Fizzcrank Airstrip', nx: .58, ny: .18, faction: 'alliance', tier: 'outpost' },
    { name: 'Kaskala', nx: .66, ny: .68, faction: 'neutral', tier: 'village' },
  ],
  camps: [
    { kind: 'camp', name: 'Magmoth', nx: .52, ny: .30, members: ['brute', 'brute', 'caster'] },
    { kind: 'camp', name: 'Riplash Strand', nx: .42, ny: .78, members: ['stalker', 'caster'] },
    { kind: 'quarry', name: 'Coldrock Quarry', nx: .52, ny: .38, members: ['brute', 'stalker'] },
    { kind: 'beastDen', name: 'The Dens of Dying', nx: .78, ny: .28, members: ['stalker', 'hound'] },
    { kind: 'hamlet', name: 'Farshire', nx: .57, ny: .60, members: ['stalker', 'caster'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 3 }, { kind: 'hound', weight: 2 },
    { kind: 'brute', weight: 2 }, { kind: 'caster', weight: 1 },
    { kind: 'archer', weight: 1 }, { kind: 'duneScuttler', weight: 1 },
    { kind: 'frostRevenant', weight: 1 },
  ],
  pois: [
    { name: 'Coldarra', kind: 'landmark', nx: .28, ny: .28, description: 'Home of the blue dragonflight and the Nexus.' },
    { name: 'The Geyser Fields', kind: 'landmark', nx: .50, ny: .15, description: 'Steaming vents and mechagnome workings.' },
    { name: 'The Flood Plains', kind: 'landmark', nx: .62, ny: .45, description: 'Scoured flats east of the geysers.' },
    { name: 'Bor\'gorok Outpost', kind: 'camp', nx: .52, ny: .10, description: 'Horde forward post at the tundra\'s edge.' },
    { name: 'Valiance Keep Dock', kind: 'landmark', nx: .58, ny: .80, description: 'Icebreaker berth to Stormwind.' },
    { name: 'Warsong Hold Zeppelin Tower', kind: 'landmark', nx: .40, ny: .58, description: 'Zeppelin mast to Orgrimmar.' },
    { name: 'Unu\'pe Turtle Dock', kind: 'landmark', nx: .80, ny: .57, description: 'Tuskarr turtle-boat landing.' },
  ],
  entrances: [
    { name: 'The Nexus', nx: .28, ny: .30, levelMin: 69, levelMax: 73, kind: 'dungeon', theme: 'astral' },
    { name: 'The Oculus', nx: .28, ny: .28, levelMin: 77, levelMax: 80, kind: 'dungeon', theme: 'astral' },
    { name: 'Eye of Eternity', nx: .28, ny: .26, levelMin: 80, levelMax: 80, kind: 'raid', theme: 'astral' },
  ],
});

// ── Howling Fjord (68-72) — fjord cliffs, pine forest, vrykul ───────────────
defineZoneContent({
  id: 'howling-fjord',
  palette: 'fjord cliffs and pine forest',
  props: [
    { kind: 'snowPine', weight: 30 }, { kind: 'tree', weight: 18 },
    { kind: 'limestone', weight: 14 }, { kind: 'heather', weight: 12 },
    { kind: 'tussock', weight: 10 }, { kind: 'rock', weight: 8 },
    { kind: 'windTree', weight: 8 },
  ],
  elevation: {
    features: [
      // The northern fjord wall and the flanking ridges above Daggercap Bay.
      { nx: .05, ny: .02, nw: .90, nh: .12, tier: 2, edge: 48 },
      { nx: 0, ny: .20, nw: .12, nh: .55, tier: 1, edge: 40 },
      { nx: .88, ny: .15, nw: .12, nh: .50, tier: 1, edge: 40 },
      // Utgarde's bluff over the bay.
      { shape: 'disc', nx: .55, ny: .49, nr: .07, tier: 1 },
      // The Ember Clutch smolders in a sunken vale.
      { shape: 'disc', nx: .42, ny: .22, nr: .07, tier: -1, kind: 'valley' },
    ],
    ramps: [
      { nx: .50, ny: .20, nx2: .50, ny2: .12, width: 54 },   // up the north wall
      { nx: .14, ny: .50, nx2: .20, ny2: .50, width: 50 },   // west ridge pass
      { nx: .82, ny: .40, nx2: .88, ny2: .40, width: 50 },   // east ridge pass
      { nx: .55, ny: .56, nx2: .55, ny2: .52, width: 46 },   // Utgarde approach
    ],
    noise: 12,
  },
  water: [
    { kind: 'lake', nx: .58, ny: .88, nrx: .25, nry: .10, depth: .9 },   // Daggercap Bay
    { kind: 'lake', nx: .62, ny: .30, nrx: .07, nry: .05, depth: .8 },   // Lake Cauldros
    { kind: 'lake', nx: .40, ny: .68, nrx: .06, nry: .04, depth: .8 },   // Caldemere Lake
    { kind: 'river', nx: 0, ny: 0, points: [[.62, .30], [.60, .45], [.58, .60], [.58, .85]], width: 45, depth: .6 },
  ],
  roads: [
    // Fjord road: Dragonblight crossing → Westguard → Valgarde → Vengeance Landing.
    road('howling-fjord', 'fjord-road', [[0, .50], [.30, .45], [.55, .60], [.78, .35]], { main: true, width: 34 }),
    road('howling-fjord', 'utgarde-spur', [[.55, .60], [.55, .50]]),
    road('howling-fjord', 'north-road', [[.55, .60], [.50, .40], [.60, .20], [.50, .15], [.50, 0]], { main: true }),
    road('howling-fjord', 'agamand-road', [[.55, .60], [.50, .75]]),
    road('howling-fjord', 'kamagua-road', [[.30, .45], [.25, .60]]),
  ],
  towns: [
    { name: 'Valgarde', nx: .55, ny: .60, faction: 'alliance', tier: 'town' },
    { name: 'Vengeance Landing', nx: .78, ny: .35, faction: 'horde', tier: 'town' },
    { name: 'Westguard Keep', nx: .30, ny: .45, faction: 'alliance', tier: 'town' },
    { name: 'New Agamand', nx: .50, ny: .75, faction: 'horde', tier: 'town' },
    { name: 'Kamagua', nx: .25, ny: .60, faction: 'neutral', tier: 'town' },
    { name: 'Fort Wildervar', nx: .60, ny: .20, faction: 'alliance', tier: 'town' },
    { name: 'Camp Winterhoof', nx: .50, ny: .15, faction: 'horde', tier: 'town' },
    { name: 'Apothecary Camp', nx: .45, ny: .28, faction: 'horde', tier: 'outpost' },
    { name: 'Steel Gate', nx: .32, ny: .30, faction: 'alliance', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Skorn', nx: .45, ny: .32, members: ['brute', 'archer', 'caster'] },
    { kind: 'camp', name: 'Nifflevar', nx: .68, ny: .52, members: ['archer', 'brute'] },
    { kind: 'quarry', name: 'Baelgun\'s Excavation', nx: .28, ny: .72, members: ['brute', 'caster'] },
    { kind: 'corruptedGrove', name: 'The Twisted Glade', nx: .55, ny: .30, members: ['stalker', 'wisp'] },
    { kind: 'graveyard', name: 'Shield Hill', nx: .60, ny: .78, members: ['stalker', 'caster'] },
  ],
  spawns: [
    { kind: 'hound', weight: 3 }, { kind: 'stalker', weight: 2 },
    { kind: 'brute', weight: 2 }, { kind: 'archer', weight: 1 },
    { kind: 'caster', weight: 1 }, { kind: 'frostRevenant', weight: 1 },
  ],
  pois: [
    { name: 'The Ember Clutch', kind: 'corruptedGrove', nx: .42, ny: .22, description: 'A burning vale of proto-drake nests.' },
    { name: 'Giants\' Run', kind: 'landmark', nx: .70, ny: .28, description: 'Colossal rune-carved stones of the giants.' },
    { name: 'The Isle of Spears', kind: 'landmark', nx: .22, ny: .72, description: 'Tuskarr hunting grounds off the coast.' },
    { name: 'Whisper Gulch', kind: 'landmark', nx: .36, ny: .32, description: 'A mine where the ore whispers back.' },
    { name: 'Valgarde Dock', kind: 'landmark', nx: .58, ny: .65, description: 'Alliance ship berth on Daggercap Bay.' },
    { name: 'Vengeance Landing Zeppelin Tower', kind: 'landmark', nx: .80, ny: .33, description: 'Horde zeppelin mast to Tirisfal.' },
    { name: 'Kamagua Turtle Dock', kind: 'landmark', nx: .23, ny: .62, description: 'Tuskarr turtle-boat landing.' },
  ],
  entrances: [
    { name: 'Utgarde Keep', nx: .55, ny: .50, levelMin: 68, levelMax: 72, kind: 'dungeon', theme: 'rime' },
    { name: 'Utgarde Pinnacle', nx: .55, ny: .48, levelMin: 77, levelMax: 80, kind: 'dungeon', theme: 'rime' },
  ],
});

// ── Dragonblight (71-74) — dragon graveyard, Wyrmrest, Wrathgate ────────────
defineZoneContent({
  id: 'dragonblight',
  palette: 'dragon graveyard wastes',
  props: [
    { kind: 'deadTree', weight: 26 }, { kind: 'snowPine', weight: 20 },
    { kind: 'rock', weight: 14 }, { kind: 'tussock', weight: 12 },
    { kind: 'iceCrystal', weight: 10 }, { kind: 'mushrooms', weight: 8 },
    { kind: 'stump', weight: 6 }, { kind: 'limestone', weight: 4 },
  ],
  elevation: {
    features: [
      // Naxxramas hangs over a risen necropolis shelf in the east.
      { shape: 'disc', nx: .85, ny: .30, nr: .08, tier: 1, edge: 44 },
      // Angrathar, the Wrathgate, sits on a raised pass at the north edge.
      { shape: 'disc', nx: .38, ny: .08, nr: .06, tier: 1 },
      // The Path of the Titans cuts a sunken scar down the middle.
      { nx: .55, ny: .62, nw: .30, nh: .20, tier: -1, kind: 'valley' },
    ],
    ramps: [
      { nx: .82, ny: .38, nx2: .84, ny2: .33, width: 50 },   // Naxxramas shelf
      { nx: .38, ny: .15, nx2: .38, ny2: .10, width: 46 },   // Wrathgate approach
      { nx: .60, ny: .60, nx2: .62, ny2: .66, width: 52 },   // into the Path
    ],
    noise: 8,
  },
  water: [
    { kind: 'lake', nx: .30, ny: .62, nrx: .07, nry: .06, depth: .8 },   // Lake Indu'le
    { kind: 'lake', nx: .50, ny: .95, nrx: .30, nry: .05, depth: .9 },   // south coast
    { kind: 'river', nx: 0, ny: 0, points: [[.30, .62], [.35, .75], [.45, .82]], width: 35, depth: .5 },
  ],
  roads: [
    // The great east-west road: Borean crossing → Agmar's Hammer → Wyrmrest →
    // Wintergarde → Grizzly Hills crossing.
    road('dragonblight', 'wyrmrest-road', [[0, .80], [.28, .55], [.38, .45], [.58, .50], [.78, .35], [1.0, .50]], { main: true, width: 34 }),
    road('dragonblight', 'naxxramas-spur', [[.78, .35], [.85, .30]]),
    road('dragonblight', 'moaki-road', [[.58, .50], [.48, .78]]),
    // North to the Wrathgate pass (Crystalsong/Wintergrasp crossings).
    road('dragonblight', 'wrathgate-road', [[.38, .45], [.38, .08], [.38, 0]]),
    road('dragonblight', 'wintergrasp-road', [[.48, .78], [.30, .40], [.30, 0]]),
    road('dragonblight', 'venomspite-road', [[.78, .35], [.75, .60]]),
  ],
  towns: [
    { name: 'Wintergarde Keep', nx: .78, ny: .35, faction: 'alliance', tier: 'town' },
    { name: 'Agmar\'s Hammer', nx: .38, ny: .45, faction: 'horde', tier: 'town' },
    { name: 'Wyrmrest Temple', nx: .58, ny: .50, faction: 'neutral', tier: 'town' },
    { name: 'Stars\' Rest', nx: .28, ny: .55, faction: 'alliance', tier: 'town' },
    { name: 'Venomspite', nx: .75, ny: .60, faction: 'horde', tier: 'town' },
    { name: 'Moa\'ki Harbor', nx: .48, ny: .78, faction: 'neutral', tier: 'town' },
    { name: 'Nozzlerust Post', nx: .55, ny: .28, faction: 'neutral', tier: 'outpost' },
  ],
  camps: [
    { kind: 'graveyard', name: 'The Forgotten Shore', nx: .85, ny: .72, members: ['stalker', 'caster'] },
    { kind: 'camp', name: 'The Carrion Fields', nx: .85, ny: .52, members: ['brute', 'caster', 'hound'] },
    { kind: 'hamlet', name: 'Icemist Village', nx: .25, ny: .42, members: ['stalker', 'caster'] },
    { kind: 'bossLair', name: 'The Crystal Vice', nx: .58, ny: .18, members: ['frostRevenant'] },
    { kind: 'crossing', name: 'The Wrathgate', nx: .38, ny: .08, members: ['brute', 'caster'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 3 }, { kind: 'caster', weight: 2 },
    { kind: 'hound', weight: 2 }, { kind: 'brute', weight: 1 },
    { kind: 'wisp', weight: 1 }, { kind: 'frostRevenant', weight: 1 },
    { kind: 'graveMarshal', weight: 1, levelOffset: 2 },
  ],
  pois: [
    { name: 'The Wrathgate', kind: 'landmark', nx: .38, ny: .08, description: 'Angrathar, the sealed gate to Icecrown.' },
    { name: 'Galakrond\'s Rest', kind: 'graveyard', nx: .52, ny: .38, description: 'The first dragon\'s titanic bones.' },
    { name: 'The Path of the Titans', kind: 'landmark', nx: .62, ny: .72, description: 'A sunken road of titan make.' },
    { name: 'The Court of Skulls', kind: 'necropolis', nx: .55, ny: .82, description: 'Scourge mustering ground south of Wyrmrest.' },
    { name: 'The Dragon Wastes', kind: 'landmark', nx: .45, ny: .60, description: 'Snowfields littered with ancient bones.' },
    { name: 'Moa\'ki Harbor Turtle Dock', kind: 'landmark', nx: .48, ny: .82, description: 'Tuskarr turtle-boat landing.' },
  ],
  entrances: [
    { name: 'Azjol-Nerub', nx: .25, ny: .50, levelMin: 72, levelMax: 74, kind: 'dungeon', theme: 'ossuary' },
    { name: 'Ahn\'kahet: The Old Kingdom', nx: .25, ny: .52, levelMin: 73, levelMax: 75, kind: 'dungeon', theme: 'ossuary' },
    { name: 'Naxxramas', nx: .85, ny: .30, levelMin: 80, levelMax: 80, kind: 'raid', theme: 'ossuary' },
    { name: 'Obsidian Sanctum', nx: .58, ny: .55, levelMin: 80, levelMax: 80, kind: 'raid', theme: 'blackrock' },
    { name: 'Ruby Sanctum', nx: .58, ny: .57, levelMin: 80, levelMax: 80, kind: 'raid', theme: 'foundry' },
  ],
});

// ── Grizzly Hills (73-75) — redwood forest, furbolg, trappers ───────────────
defineZoneContent({
  id: 'grizzly-hills',
  palette: 'redwood hills',
  props: [
    { kind: 'tree', weight: 34 }, { kind: 'snowPine', weight: 18 },
    { kind: 'stump', weight: 10 }, { kind: 'fern', weight: 10 },
    { kind: 'mushrooms', weight: 8 }, { kind: 'rock', weight: 8 },
    { kind: 'leafPile', weight: 6 }, { kind: 'flowers', weight: 6 },
  ],
  elevation: {
    features: [
      // Rolling granite hills; the northeast rises toward Zul'Drak's terraces.
      { shape: 'disc', nx: .55, ny: .30, nr: .10, tier: 1 },
      { nx: .70, ny: .02, nw: .30, nh: .18, tier: 1, edge: 40 },
      { nx: .40, ny: .60, nw: .25, nh: .15, tier: -1, kind: 'valley' },
    ],
    ramps: [
      { nx: .50, ny: .52, nx2: .52, ny2: .44, width: 50 },
      { nx: .72, ny: .22, nx2: .74, ny2: .16, width: 46 },
    ],
    noise: 14,
  },
  water: [
    { kind: 'lake', nx: .38, ny: .38, nrx: .06, nry: .05, depth: .7 },   // Blue Sky Logging Grounds
    { kind: 'lake', nx: .55, ny: .18, nrx: .04, nry: .03, depth: .7 },   // Drak'atal runoff
    { kind: 'river', nx: 0, ny: 0, points: [[.80, .20], [.65, .35], [.55, .55], [.50, .80]], width: 40, depth: .5 },
  ],
  roads: [
    // Dragonblight crossing → Amberpine → Oneqwah → Zul'Drak crossing.
    road('grizzly-hills', 'lodge-road', [[0, .50], [.30, .55], [.65, .45], [.60, .30], [.60, 0]], { main: true, width: 34 }),
    road('grizzly-hills', 'conquest-road', [[.30, .55], [.20, .65]]),
    road('grizzly-hills', 'brigade-road', [[.65, .45], [.55, .30]]),
    // South to the Howling Fjord crossing.
    road('grizzly-hills', 'south-road', [[.30, .55], [.40, .80], [.50, 1.0]]),
  ],
  towns: [
    { name: 'Amberpine Lodge', nx: .30, ny: .55, faction: 'alliance', tier: 'town' },
    { name: 'Conquest Hold', nx: .20, ny: .65, faction: 'horde', tier: 'town' },
    { name: 'Westfall Brigade Encampment', nx: .55, ny: .30, faction: 'alliance', tier: 'town' },
    { name: 'Camp Oneqwah', nx: .65, ny: .45, faction: 'horde', tier: 'town' },
  ],
  camps: [
    { kind: 'beastDen', name: 'Grizzlemaw', nx: .50, ny: .42, members: ['stalker', 'brute'] },
    { kind: 'camp', name: 'Voldrune', nx: .30, ny: .78, members: ['brute', 'caster'] },
    { kind: 'quarry', name: 'Dun Argol', nx: .75, ny: .55, members: ['brute', 'caster'] },
    { kind: 'hamlet', name: 'Silverbrook', nx: .28, ny: .32, members: ['stalker', 'hound'] },
    { kind: 'camp', name: 'Drakil\'jin Ruins', nx: .72, ny: .24, members: ['stalker', 'caster'] },
  ],
  spawns: [
    { kind: 'hound', weight: 3 }, { kind: 'stalker', weight: 2 },
    { kind: 'archer', weight: 2 }, { kind: 'brute', weight: 1 },
    { kind: 'caster', weight: 1 }, { kind: 'briarMatriarch', weight: 1, levelOffset: 1 },
  ],
  pois: [
    { name: 'Thor Modan', kind: 'landmark', nx: .62, ny: .15, description: 'Ruined iron dwarf city under the hills.' },
    { name: 'The Blue Sky Logging Grounds', kind: 'landmark', nx: .38, ny: .38, description: 'Contested lumber camps on the lake.' },
    { name: 'Drak\'atal Passage', kind: 'crossing', nx: .55, ny: .18, description: 'Troll-staired pass toward Zul\'Drak.' },
    { name: 'Heartwood Trading Post', kind: 'caravan', nx: .55, ny: .62, description: 'An abandoned trapper caravan.' },
    { name: 'Ursoc\'s Den', kind: 'beastDen', nx: .52, ny: .28, description: 'Shrine of the fallen bear god.' },
  ],
  entrances: [
    { name: 'Drak\'Tharon Keep', nx: .15, ny: .25, levelMin: 74, levelMax: 76, kind: 'dungeon', theme: 'ossuary' },
  ],
});

// ── Zul'Drak (74-77) — troll ziggurat terraces, Scourge incursion ───────────
defineZoneContent({
  id: 'zuldrak',
  palette: 'troll temple ziggurats',
  props: [
    { kind: 'limestone', weight: 24 }, { kind: 'snowPine', weight: 18 },
    { kind: 'iceCrystal', weight: 14 }, { kind: 'deadTree', weight: 12 },
    { kind: 'rock', weight: 10 }, { kind: 'mushrooms', weight: 8 },
    { kind: 'tussock', weight: 8 }, { kind: 'stump', weight: 6 },
  ],
  elevation: {
    features: [
      // The Drakkari empire is built in tiers: a broad upper terrace, then the
      // Gundrak plateau rising highest in the northeast.
      { nx: .15, ny: .05, nw: .70, nh: .30, tier: 1, edge: 44 },
      { nx: .55, ny: .02, nw: .40, nh: .18, tier: 2, edge: 48 },
      // The flooded fields around Drak'Sotra sit low.
      { nx: .42, ny: .60, nw: .30, nh: .18, tier: -1, kind: 'valley' },
    ],
    ramps: [
      { nx: .50, ny: .38, nx2: .50, ny2: .32, width: 60 },   // up the first terrace
      { nx: .62, ny: .22, nx2: .64, ny2: .16, width: 50 },   // toward Gundrak
      { nx: .30, ny: .36, nx2: .28, ny2: .30, width: 46 },   // western stair
    ],
    noise: 8,
  },
  water: [
    { kind: 'lake', nx: .50, ny: .70, nrx: .08, nry: .05, depth: .6 },   // Drak'Sotra pools
    { kind: 'lake', nx: .58, ny: .78, nrx: .06, nry: .04, depth: .6 },   // Pools of Jin'Alai
    { kind: 'river', nx: 0, ny: 0, points: [[.30, .30], [.40, .50], [.50, .70]], width: 35, depth: .5 },
  ],
  roads: [
    // Grizzly Hills crossing → Argent Stand → Zim'Torga → Gundrak stair.
    road('zuldrak', 'argent-road', [[.60, 1.0], [.40, .65], [.60, .55], [.70, .40], [.80, .25]], { main: true, width: 34 }),
    road('zuldrak', 'ebon-road', [[.40, .65], [.30, .75], [.15, .75]]),
    // West to the Storm Peaks crossing.
    road('zuldrak', 'storm-road', [[.40, .65], [.45, .40], [.50, 0]]),
  ],
  towns: [
    { name: 'The Argent Stand', nx: .40, ny: .65, faction: 'neutral', tier: 'town' },
    { name: 'Zim\'Torga', nx: .60, ny: .55, faction: 'neutral', tier: 'town' },
    { name: 'Ebon Watch', nx: .15, ny: .75, faction: 'neutral', tier: 'town' },
    { name: 'Light\'s Breach', nx: .30, ny: .75, faction: 'neutral', tier: 'town' },
  ],
  camps: [
    { kind: 'camp', name: 'Drak\'Sotra', nx: .48, ny: .72, members: ['brute', 'caster'] },
    { kind: 'camp', name: 'Altar of Sseratus', nx: .40, ny: .38, members: ['caster', 'stalker'] },
    { kind: 'graveyard', name: 'Altar of Quetz\'lun', nx: .55, ny: .42, members: ['stalker', 'wisp'] },
    { kind: 'corruptedGrove', name: 'Pools of Zha\'jinn', nx: .62, ny: .70, members: ['mireSpitter', 'stalker'] },
    { kind: 'bossLair', name: 'Amphitheater of Anguish', nx: .48, ny: .58, members: ['brute'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 3 }, { kind: 'caster', weight: 2 },
    { kind: 'brute', weight: 2 }, { kind: 'hound', weight: 1 },
    { kind: 'archer', weight: 1 }, { kind: 'wisp', weight: 1 },
  ],
  pois: [
    { name: 'Amphitheater of Anguish', kind: 'landmark', nx: .48, ny: .58, description: 'The Drakkari\'s blood-sport ring.' },
    { name: 'Kolramas', kind: 'necropolis', nx: .62, ny: .78, description: 'A crashed Scourge necropolis.' },
    { name: 'Voltarus', kind: 'necropolis', nx: .28, ny: .45, description: 'Scourge citadel behind enemy lines.' },
    { name: 'Reliquary of Pain', kind: 'reliquary', nx: .32, ny: .48, description: 'A vault of Drakkari suffering.' },
    { name: 'Thrym\'s End', kind: 'graveyard', nx: .18, ny: .58, description: 'Where the storm giant fell.' },
    { name: 'Zim\'Abwa', kind: 'shrine', nx: .38, ny: .72, description: 'Shrine of the Drakkari god of commerce.' },
  ],
  entrances: [
    { name: 'Gundrak', nx: .80, ny: .25, levelMin: 76, levelMax: 78, kind: 'dungeon', theme: 'rootbound' },
  ],
});

// ── Sholazar Basin (75-78) — jungle crater ringed by titan pillars ──────────
defineZoneContent({
  id: 'sholazar',
  palette: 'tropical jungle basin',
  props: [
    { kind: 'canopy', weight: 34 }, { kind: 'fern', weight: 18 },
    { kind: 'reeds', weight: 12 }, { kind: 'flowers', weight: 10 },
    { kind: 'mushrooms', weight: 8 }, { kind: 'willow', weight: 8 },
    { kind: 'tree', weight: 6 }, { kind: 'stump', weight: 4 },
  ],
  elevation: {
    features: [
      // The basin is a crater: a tier-2 rim walls every side, breached by
      // ramps at the passes. Titan pillars stand as lone mesas inside.
      { nx: 0, ny: 0, nw: 1, nh: .08, tier: 2, edge: 52 },
      { nx: 0, ny: .92, nw: 1, nh: .08, tier: 2, edge: 52 },
      { nx: 0, ny: 0, nw: .08, nh: 1, tier: 2, edge: 52 },
      { nx: .92, ny: 0, nw: .08, nh: 1, tier: 2, edge: 52 },
      { shape: 'disc', nx: .42, ny: .32, nr: .04, tier: 1, kind: 'mesa' },   // Glimmering Pillar
      { shape: 'disc', nx: .30, ny: .48, nr: .035, tier: 1, kind: 'mesa' },  // Suntouched Pillar
      { shape: 'disc', nx: .38, ny: .72, nr: .035, tier: 1, kind: 'mesa' },  // Mosslight Pillar
      { shape: 'disc', nx: .68, ny: .42, nr: .04, tier: 1, kind: 'mesa' },   // Lifeblood Pillar
    ],
    ramps: [
      { nx: .45, ny: .10, nx2: .45, ny2: .04, width: 70 },   // north gate to Storm Peaks
      { nx: .45, ny: .90, nx2: .45, ny2: .96, width: 70 },   // south gate to Borean
      { nx: .90, ny: .55, nx2: .96, ny2: .55, width: 60 },   // east gap to Crystalsong
    ],
    noise: 10,
  },
  water: [
    { kind: 'lake', nx: .58, ny: .62, nrx: .07, nry: .07, depth: .8 },   // River's Heart
    { kind: 'lake', nx: .28, ny: .20, nrx: .07, nry: .05, depth: .8 },   // Bittertide Lake
    { kind: 'lake', nx: .62, ny: .78, nrx: .08, nry: .06, depth: .7 },   // Wildgrowth Mangal
    { kind: 'river', nx: 0, ny: 0, points: [[.58, .62], [.40, .50], [.30, .45]], width: 40, depth: .5 },
    { kind: 'river', nx: 0, ny: 0, points: [[.58, .62], [.66, .55], [.72, .50]], width: 40, depth: .5 },
    { kind: 'river', nx: 0, ny: 0, points: [[.58, .62], [.60, .72], [.62, .80]], width: 40, depth: .5 },
  ],
  roads: [
    // The basin ring road: Storm Peaks gate → Nesingwary → River's Heart →
    // east gap to Crystalsong; a south spur drops to Borean Tundra.
    road('sholazar', 'basin-road', [[.45, 0], [.40, .30], [.25, .55], [.50, .60], [.75, .55], [1.0, .55]], { main: true, width: 34 }),
    road('sholazar', 'south-gate', [[.50, .60], [.45, .80], [.45, 1.0]]),
  ],
  towns: [
    { name: 'Nesingwary Base Camp', nx: .25, ny: .55, faction: 'neutral', tier: 'town' },
    { name: 'River\'s Heart', nx: .50, ny: .60, faction: 'neutral', tier: 'town' },
  ],
  camps: [
    { kind: 'camp', name: 'Frenzyheart Hill', nx: .55, ny: .68, members: ['stalker', 'archer'] },
    { kind: 'camp', name: 'Rainspeaker Canopy', nx: .64, ny: .55, members: ['caster', 'stalker'] },
    { kind: 'beastDen', name: 'The Savage Thicket', nx: .50, ny: .28, members: ['stalker', 'hound'] },
    { kind: 'corruptedGrove', name: 'The Lost Lands', nx: .78, ny: .55, members: ['stalker', 'caster'] },
    { kind: 'camp', name: 'The Avalanche', nx: .72, ny: .35, members: ['brute', 'caster'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 3 }, { kind: 'archer', weight: 2 },
    { kind: 'caster', weight: 2 }, { kind: 'hound', weight: 1 },
    { kind: 'brute', weight: 1 }, { kind: 'wisp', weight: 1 },
  ],
  pois: [
    { name: 'The Glimmering Pillar', kind: 'landmark', nx: .42, ny: .32, description: 'A titan pillar humming with light.' },
    { name: 'The Suntouched Pillar', kind: 'landmark', nx: .30, ny: .48, description: 'Warm stone spire of the Makers.' },
    { name: 'The Mosslight Pillar', kind: 'landmark', nx: .38, ny: .72, description: 'Moss-grown pillar in the mangal.' },
    { name: 'The Lifeblood Pillar', kind: 'landmark', nx: .68, ny: .42, description: 'Fallen pillar that bled the land green.' },
    { name: 'The Makers\' Perch', kind: 'landmark', nx: .32, ny: .35, description: 'Titan overlook above the basin floor.' },
    { name: 'The Makers\' Overlook', kind: 'landmark', nx: .82, ny: .38, description: 'Eastern titan watch station.' },
    { name: 'Kartak\'s Hold', kind: 'camp', nx: .24, ny: .78, description: 'Frenzyheart wolvar war camp.' },
  ],
  entrances: [],
});

// ── Crystalsong Forest (74-80) — crystalline woods beneath Dalaran ──────────
defineZoneContent({
  id: 'crystalsong',
  palette: 'crystalline forest',
  props: [
    { kind: 'iceCrystal', weight: 26 }, { kind: 'tree', weight: 20 },
    { kind: 'snowPine', weight: 14 }, { kind: 'mushrooms', weight: 10 },
    { kind: 'fern', weight: 8 }, { kind: 'flowers', weight: 8 },
    { kind: 'rock', weight: 8 }, { kind: 'shrine', weight: 6 },
  ],
  elevation: {
    features: [
      // Dalaran floats above a scoured crater; the Violet Stand anchors below.
      { shape: 'disc', nx: .30, ny: .45, nr: .08, tier: -1, kind: 'valley', edge: 44 },
      // Crystal outcroppings ring the forest.
      { shape: 'disc', nx: .62, ny: .30, nr: .06, tier: 1, kind: 'mesa' },
      { shape: 'disc', nx: .20, ny: .70, nr: .05, tier: 1, kind: 'mesa' },
    ],
    ramps: [
      { nx: .30, ny: .55, nx2: .30, ny2: .50, width: 50 },   // down into the crater
      { nx: .58, ny: .34, nx2: .60, ny2: .30, width: 44 },
    ],
    noise: 10,
  },
  water: [
    { kind: 'lake', nx: .45, ny: .55, nrx: .08, nry: .06, depth: .7 },   // Mirror of Twilight
    { kind: 'lake', nx: .60, ny: .40, nrx: .04, nry: .03, depth: .6 },   // Twilight Rivulet pool
    { kind: 'river', nx: 0, ny: 0, points: [[.45, .55], [.55, .50], [.68, .48]], width: 35, depth: .5 },
  ],
  roads: [
    // Dalaran approach: Dragonblight crossing → Violet Stand → Sunreaver/
    // Windrunner overlooks → east gap toward Zul'Drak's western pass.
    road('crystalsong', 'dalaran-road', [[.30, 1.0], [.30, .60], [.30, .45], [.55, .50], [.78, .45], [1.0, .50]], { main: true, width: 34 }),
    road('crystalsong', 'overlook-road', [[.55, .50], [.72, .55]]),
    // West to the Wintergrasp crossing.
    road('crystalsong', 'wintergrasp-road', [[.30, .60], [.15, .70], [0, .75]]),
  ],
  towns: [
    { name: 'Dalaran', nx: .30, ny: .45, faction: 'neutral', tier: 'capital' },
    { name: 'Windrunner\'s Overlook', nx: .72, ny: .55, faction: 'alliance', tier: 'town' },
    { name: 'Sunreaver\'s Command', nx: .78, ny: .45, faction: 'horde', tier: 'town' },
    { name: 'The Violet Stand', nx: .18, ny: .58, faction: 'neutral', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'The Azure Front', nx: .28, ny: .62, members: ['caster', 'archer'] },
    { kind: 'corruptedGrove', name: 'The Unbound Thicket', nx: .62, ny: .62, members: ['stalker', 'wisp'] },
    { kind: 'ruinedChapel', name: 'The Decrepit Flow', nx: .18, ny: .45, members: ['stalker', 'caster'] },
    { kind: 'beastDen', name: 'Forlorn Woods', nx: .42, ny: .72, members: ['stalker', 'hound'] },
  ],
  spawns: [
    { kind: 'wisp', weight: 3 }, { kind: 'caster', weight: 2 },
    { kind: 'stalker', weight: 2 }, { kind: 'frostRevenant', weight: 1 },
    { kind: 'hound', weight: 1 },
  ],
  pois: [
    { name: 'The Great Tree', kind: 'landmark', nx: .15, ny: .35, description: 'A colossal crystalline world-tree.' },
    { name: 'The Mirror of Twilight', kind: 'landmark', nx: .45, ny: .55, description: 'A still lake of violet glass.' },
    { name: 'The Forlorn Woods', kind: 'landmark', nx: .42, ny: .70, description: 'The forest\'s silent, shadowed heart.' },
    { name: 'Twilight Rivulet', kind: 'landmark', nx: .55, ny: .40, description: 'A stream of liquid crystal light.' },
    { name: 'The Azure Front', kind: 'camp', nx: .28, ny: .62, description: 'Blue dragonflight siege line.' },
  ],
  entrances: [
    { name: 'The Violet Hold', nx: .30, ny: .48, levelMin: 75, levelMax: 77, kind: 'dungeon', theme: 'astral' },
  ],
});

// ── The Storm Peaks (76-80) — titan mountains, Ulduar ───────────────────────
defineZoneContent({
  id: 'storm-peaks',
  palette: 'titan ice mountains',
  props: [
    { kind: 'rock', weight: 26 }, { kind: 'iceCrystal', weight: 20 },
    { kind: 'snowPine', weight: 18 }, { kind: 'limestone', weight: 12 },
    { kind: 'tussock', weight: 10 }, { kind: 'deadTree', weight: 8 },
    { kind: 'windTree', weight: 6 },
  ],
  elevation: {
    features: [
      // The roof of the world: a tier-3 massif in the north carrying Ulduar,
      // a tier-2 mid-range, and the tier-1 foothills around K3.
      { nx: .10, ny: .02, nw: .80, nh: .30, tier: 3, edge: 56 },
      { nx: .15, ny: .32, nw: .70, nh: .22, tier: 2, edge: 48 },
      { nx: .20, ny: .54, nw: .60, nh: .20, tier: 1, edge: 40 },
      // Thunderfall's frozen falls and the Howling Hollow's sunken cave.
      { shape: 'disc', nx: .72, ny: .42, nr: .06, tier: 1, kind: 'mesa' },
      { shape: 'disc', nx: .55, ny: .45, nr: .05, tier: -1, kind: 'valley' },
    ],
    ramps: [
      { nx: .40, ny: .80, nx2: .38, ny2: .70, width: 60 },   // K3 → foothills
      { nx: .35, ny: .55, nx2: .34, ny2: .48, width: 54 },   // foothills → mid-range
      { nx: .38, ny: .34, nx2: .40, ny2: .28, width: 54 },   // mid-range → Ulduar massif
      { nx: .60, ny: .58, nx2: .58, ny2: .52, width: 50 },   // Dun Niffelem shelf
    ],
    noise: 16,
  },
  water: [
    { kind: 'lake', nx: .62, ny: .68, nrx: .08, nry: .05, depth: .8 },   // frozen lake by Dun Niffelem
    { kind: 'lake', nx: .50, ny: .40, nrx: .04, nry: .03, depth: .7 },   // Thunderfall basin
  ],
  roads: [
    // The mountain road: Sholazar gate → K3 → Grom'arsh → Bouldercrag's → Ulduar.
    road('storm-peaks', 'uldumar-road', [[.45, 1.0], [.40, .85], [.35, .50], [.30, .35], [.40, .25]], { main: true, width: 34 }),
    road('storm-peaks', 'frosthold-spur', [[.35, .50], [.30, .70]]),
    road('storm-peaks', 'niffelem-road', [[.35, .50], [.60, .60]]),
    // East to the Zul'Drak crossing.
    road('storm-peaks', 'zuldrak-road', [[.60, .60], [.55, .80], [.50, 1.0]]),
  ],
  towns: [
    { name: 'K3', nx: .40, ny: .85, faction: 'neutral', tier: 'town' },
    { name: 'Frosthold', nx: .30, ny: .70, faction: 'alliance', tier: 'town' },
    { name: 'Grom\'arsh Crash-Site', nx: .35, ny: .50, faction: 'horde', tier: 'town' },
    { name: 'Bouldercrag\'s Refuge', nx: .30, ny: .35, faction: 'neutral', tier: 'town' },
    { name: 'Ulduar', nx: .40, ny: .25, faction: 'neutral', tier: 'town' },
    { name: 'Dun Niffelem', nx: .60, ny: .60, faction: 'neutral', tier: 'town' },
  ],
  camps: [
    { kind: 'camp', name: 'Nidavelir', nx: .24, ny: .48, members: ['brute', 'caster'] },
    { kind: 'camp', name: 'Valkyrion', nx: .25, ny: .60, members: ['caster', 'archer'] },
    { kind: 'beastDen', name: 'Frostgrip\'s Hollow', nx: .52, ny: .72, members: ['stalker', 'hound'] },
    { kind: 'camp', name: 'Narvir\'s Cradle', nx: .32, ny: .42, members: ['brute', 'archer'] },
    { kind: 'watchtower', name: 'The Inventor\'s Library', nx: .38, ny: .45, members: ['caster', 'stormSentinel'] },
  ],
  spawns: [
    { kind: 'frostRevenant', weight: 3 }, { kind: 'stormSentinel', weight: 2 },
    { kind: 'brute', weight: 2 }, { kind: 'caster', weight: 1 },
    { kind: 'hound', weight: 1 }, { kind: 'stalker', weight: 1 },
  ],
  pois: [
    { name: 'The Temple of Storms', kind: 'landmark', nx: .35, ny: .42, description: 'Thorim\'s storm-wracked seat.' },
    { name: 'The Terrace of the Makers', kind: 'landmark', nx: .52, ny: .38, description: 'Titan work-terrace above the valley.' },
    { name: 'Thunderfall', kind: 'landmark', nx: .72, ny: .42, description: 'A waterfall frozen mid-plunge.' },
    { name: 'Brunnhildar Village', kind: 'hamlet', nx: .50, ny: .68, description: 'Hyldnir war-village of the frost vrykul.' },
    { name: 'The Howling Hollow', kind: 'beastDen', nx: .55, ny: .45, description: 'A wind-scoured cave of ice revenants.' },
    { name: 'Temple of Life', kind: 'shrine', nx: .62, ny: .42, description: 'Ruined titan garden terrace.' },
    { name: 'Temple of Winter', kind: 'shrine', nx: .52, ny: .60, description: 'Hodir\'s frozen shrine.' },
  ],
  entrances: [
    { name: 'Halls of Stone', nx: .42, ny: .28, levelMin: 77, levelMax: 79, kind: 'dungeon', theme: 'foundry' },
    { name: 'Halls of Lightning', nx: .45, ny: .28, levelMin: 79, levelMax: 80, kind: 'dungeon', theme: 'astral' },
    { name: 'Ulduar', nx: .40, ny: .25, levelMin: 80, levelMax: 80, kind: 'raid', theme: 'astral' },
  ],
});

// ── Icecrown (77-80) — the Scourge glacier and the Citadel ──────────────────
defineZoneContent({
  id: 'icecrown',
  palette: 'scourge glacier and citadel',
  props: [
    { kind: 'iceCrystal', weight: 24 }, { kind: 'basalt', weight: 18 },
    { kind: 'rock', weight: 16 }, { kind: 'snowPine', weight: 14 },
    { kind: 'deadTree', weight: 12 }, { kind: 'limestone', weight: 10 },
    { kind: 'tussock', weight: 6 },
  ],
  elevation: {
    features: [
      // The glacier climbs in steps toward the Citadel: a southern shelf, the
      // tier-2 ice field, and the tier-3 citadel massif in the southwest.
      { nx: .05, ny: .55, nw: .90, nh: .20, tier: 1, edge: 48 },
      { nx: .10, ny: .30, nw: .80, nh: .25, tier: 2, edge: 52 },
      { nx: .30, ny: .75, nw: .50, nh: .25, tier: 3, edge: 56 },
      // The Shadow Vault's black shelf and the tournament grounds' rise.
      { shape: 'disc', nx: .45, ny: .25, nr: .07, tier: 3, kind: 'mesa' },
      { shape: 'disc', nx: .72, ny: .20, nr: .08, tier: 2 },
      // The Valley of Echoes and Sindragosa's Fall gouge the ice.
      { shape: 'disc', nx: .82, ny: .78, nr: .07, tier: -1, kind: 'valley' },
      { shape: 'disc', nx: .30, ny: .60, nr: .05, tier: -1, kind: 'valley' },
    ],
    ramps: [
      { nx: .85, ny: .72, nx2: .80, ny2: .62, width: 60 },   // Vanguard → first shelf
      { nx: .70, ny: .55, nx2: .62, ny2: .48, width: 54 },   // shelf → ice field
      { nx: .50, ny: .72, nx2: .52, ny2: .78, width: 54 },   // field → citadel massif
      { nx: .45, ny: .32, nx2: .45, ny2: .27, width: 46 },   // Shadow Vault mesa
      { nx: .70, ny: .24, nx2: .72, ny2: .21, width: 46 },   // tournament rise
    ],
    noise: 12,
  },
  water: [
    { kind: 'lake', nx: .30, ny: .62, nrx: .05, nry: .04, depth: .8 },   // Sindragosa's Fall melt
    { kind: 'lake', nx: .55, ny: .55, nrx: .06, nry: .04, depth: .7 },   // Ymirheim meltwater
  ],
  roads: [
    // The advance: Crystalsong crossing → Argent Vanguard → Crusaders'
    // Pinnacle → tournament grounds → the Citadel gates.
    road('icecrown', 'advance-road', [[.50, 1.0], [.85, .75], [.78, .65], [.72, .20], [.55, .80]], { main: true, width: 36 }),
    road('icecrown', 'shadow-vault-road', [[.78, .65], [.45, .25]]),
    road('icecrown', 'deaths-rise-road', [[.45, .25], [.20, .45]]),
  ],
  towns: [
    { name: 'The Argent Vanguard', nx: .85, ny: .75, faction: 'neutral', tier: 'town' },
    { name: 'Crusaders\' Pinnacle', nx: .78, ny: .65, faction: 'neutral', tier: 'town' },
    { name: 'The Shadow Vault', nx: .45, ny: .25, faction: 'neutral', tier: 'town' },
    { name: 'Death\'s Rise', nx: .20, ny: .45, faction: 'neutral', tier: 'town' },
    { name: 'Argent Tournament Grounds', nx: .74, ny: .22, faction: 'neutral', tier: 'town' },
  ],
  camps: [
    { kind: 'camp', name: 'The Fleshwerks', nx: .32, ny: .68, members: ['brute', 'caster', 'stalker'] },
    { kind: 'camp', name: 'Mord\'rethar', nx: .62, ny: .62, members: ['brute', 'caster'] },
    { kind: 'graveyard', name: 'The Valley of Lost Hope', nx: .52, ny: .72, members: ['stalker', 'wisp'] },
    { kind: 'watchtower', name: 'The Bombardment', nx: .62, ny: .45, members: ['archer', 'caster'] },
    { kind: 'bossLair', name: 'The Court of Bones', nx: .52, ny: .68, members: ['graveMarshal'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 3 }, { kind: 'caster', weight: 2 },
    { kind: 'brute', weight: 2 }, { kind: 'hound', weight: 1 },
    { kind: 'frostRevenant', weight: 1 }, { kind: 'graveMarshal', weight: 1, levelOffset: 2 },
  ],
  pois: [
    { name: 'Malykriss, The Vile Hold', kind: 'necropolis', nx: .60, ny: .80, description: 'The unfinished saronite necropolis.' },
    { name: 'Corp\'rethar: The Horror Gate', kind: 'landmark', nx: .48, ny: .68, description: 'Last gate before the Citadel walls.' },
    { name: 'The Valley of Echoes', kind: 'landmark', nx: .82, ny: .78, description: 'Where the Argent Crusade broke through.' },
    { name: 'Sindragosa\'s Fall', kind: 'graveyard', nx: .30, ny: .60, description: 'Where the Frost Queen fell and rose.' },
    { name: 'The Court of Bones', kind: 'graveyard', nx: .52, ny: .68, description: 'Scourge mustering ground before the gates.' },
    { name: 'Onslaught Harbor', kind: 'landmark', nx: .12, ny: .35, description: 'Scarlet Onslaught\'s last redoubt.' },
    { name: 'Jotunheim', kind: 'landmark', nx: .28, ny: .38, description: 'Vrykul city carved into the glacier.' },
    { name: 'The Underhalls', kind: 'dungeon', nx: .34, ny: .32, description: 'Mustering tunnels beneath the ice.' },
  ],
  entrances: [
    { name: 'Trial of the Champion', nx: .72, ny: .20, levelMin: 80, levelMax: 80, kind: 'dungeon', theme: 'rime' },
    { name: 'Trial of the Crusader', nx: .72, ny: .22, levelMin: 80, levelMax: 80, kind: 'raid', theme: 'rime' },
    { name: 'Forge of Souls', nx: .55, ny: .80, levelMin: 80, levelMax: 80, kind: 'dungeon', theme: 'rime' },
    { name: 'Pit of Saron', nx: .55, ny: .82, levelMin: 80, levelMax: 80, kind: 'dungeon', theme: 'ossuary' },
    { name: 'Halls of Reflection', nx: .55, ny: .84, levelMin: 80, levelMax: 80, kind: 'dungeon', theme: 'rime' },
    { name: 'Icecrown Citadel', nx: .55, ny: .86, levelMin: 80, levelMax: 80, kind: 'raid', theme: 'rime' },
  ],
});

// ── Wintergrasp (77-80) — the frozen battlefield lake ───────────────────────
defineZoneContent({
  id: 'wintergrasp',
  palette: 'frozen battlefield lake',
  props: [
    { kind: 'snowPine', weight: 26 }, { kind: 'rock', weight: 20 },
    { kind: 'iceCrystal', weight: 16 }, { kind: 'tussock', weight: 14 },
    { kind: 'deadTree', weight: 10 }, { kind: 'limestone', weight: 8 },
    { kind: 'heather', weight: 6 },
  ],
  elevation: {
    features: [
      // The fortress plateau overlooks the sunken lake basin; workshops ring
      // the shore on low shelves.
      { shape: 'disc', nx: .50, ny: .25, nr: .10, tier: 1, edge: 44 },
      { nx: .30, ny: .45, nw: .40, nh: .40, tier: -1, kind: 'valley' },
      { shape: 'disc', nx: .15, ny: .30, nr: .05, tier: 1, kind: 'mesa' },   // Westspark
      { shape: 'disc', nx: .85, ny: .30, nr: .05, tier: 1, kind: 'mesa' },   // Eastspark
    ],
    ramps: [
      { nx: .50, ny: .40, nx2: .50, ny2: .32, width: 60 },   // up to the fortress
      { nx: .42, ny: .50, nx2: .38, ny2: .55, width: 50 },   // down to the lake
    ],
    noise: 8,
  },
  water: [
    { kind: 'lake', nx: .47, ny: .62, nrx: .16, nry: .22, depth: .8 },   // Lake Wintergrasp
    { kind: 'lake', nx: .15, ny: .70, nrx: .05, nry: .10, depth: .7 },   // Glacial Falls
  ],
  roads: [
    // Siege road: Dragonblight crossing → fortress → both faction camps.
    road('wintergrasp', 'siege-road', [[.45, 0], [.50, .25], [.72, .60]], { main: true, width: 34 }),
    road('wintergrasp', 'warsong-road', [[.50, .25], [.25, .60]]),
  ],
  towns: [
    { name: 'Wintergrasp Fortress', nx: .50, ny: .25, faction: 'neutral', tier: 'town' },
    { name: 'Valiance Landing Camp', nx: .72, ny: .60, faction: 'alliance', tier: 'outpost' },
    { name: 'Warsong Camp', nx: .25, ny: .60, faction: 'horde', tier: 'outpost' },
  ],
  camps: [
    { kind: 'watchtower', name: 'Westspark Workshop', nx: .15, ny: .30, members: ['brute', 'archer'] },
    { kind: 'watchtower', name: 'Eastspark Workshop', nx: .85, ny: .30, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'The Cauldron of Flames', nx: .82, ny: .72, members: ['emberAcolyte', 'brute'] },
    { kind: 'beastDen', name: 'The Forest of Shadows', nx: .18, ny: .55, members: ['stalker', 'hound'] },
  ],
  spawns: [
    { kind: 'frostRevenant', weight: 3 }, { kind: 'emberAcolyte', weight: 1 },
    { kind: 'stormSentinel', weight: 1 }, { kind: 'mireSpitter', weight: 1 },
    { kind: 'stalker', weight: 1 }, { kind: 'wisp', weight: 1 },
  ],
  pois: [
    { name: 'Wintergrasp Keep Tower', kind: 'watchtower', nx: .50, ny: .18, description: 'The fortress\'s contested crown.' },
    { name: 'The Chilled Quagmire', kind: 'landmark', nx: .30, ny: .75, description: 'Frozen bog of water revenants.' },
    { name: 'Glacial Falls', kind: 'landmark', nx: .15, ny: .70, description: 'Ice-locked falls on the west shore.' },
    { name: 'The Forest of Shadows', kind: 'landmark', nx: .18, ny: .55, description: 'Dark pines hiding shadow revenants.' },
    { name: 'The Steppe of Life', kind: 'landmark', nx: .68, ny: .80, description: 'A green pocket defying the ice.' },
  ],
  entrances: [
    { name: 'Vault of Archavon', nx: .50, ny: .22, levelMin: 80, levelMax: 80, kind: 'raid', theme: 'foundry' },
  ],
});