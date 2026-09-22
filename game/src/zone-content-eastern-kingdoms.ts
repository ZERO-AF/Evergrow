/** Authored zone content for eastern-kingdoms (wayfinder world-t07). Each zone calls
 * defineZoneContent({...}) to register palette/props/elevation/water/roads/
 * towns/camps/spawns/pois/entrances. Coordinates nx/ny are normalized inside
 * the zone rect; road points are world-space. See zone-content.ts.
 *
 * WoW fidelity notes: atlas cities/dungeons are honored verbatim; docks surface
 * as 'landmark'/'portal' POIs (transport.ts owns the actual routes). Prop and
 * spawn tables map WoW creature families onto the shared EnemyKind vocabulary —
 * wolves/boars/cats → hound/stalker, undead → graveMarshal/caster/wisp,
 * kobolds/trogg-adjacent smallfolk → goblin, ogres/yetis/gnolls → brute,
 * humanoid camps → archer/caster/brute, elementals → stormSentinel/emberAcolyte/
 * frostRevenant/mireSpitter, golems → ashColossus, treants → thornReaver/
 * briarMatriarch, scorpids → duneScuttler. */
import { defineZoneContent } from './zone-content.ts';

// ── Northern Lordaeron / Quel'Thalas ─────────────────────────────────────────

defineZoneContent({
  id: 'eversong',
  palette: 'golden autumn forest',
  props: [
    { kind: 'autumnTree', weight: 46 }, { kind: 'flowers', weight: 16 },
    { kind: 'leafPile', weight: 12 }, { kind: 'fern', weight: 10 },
    { kind: 'tree', weight: 8 }, { kind: 'mushrooms', weight: 5 }, { kind: 'stump', weight: 3 },
  ],
  water: [
    // Elrendar River marks the Ghostlands border; Lake Elrendar pools at the south edge.
    { kind: 'river', nx: 0, ny: 0, points: [[0, .96], [.3, .9], [.6, .97], [1, .93]], width: 260, depth: .8 },
    { kind: 'lake', nx: .78, ny: .9, nrx: .1, nry: .12, depth: .85 },
    { kind: 'lake', nx: .2, ny: .35, nrx: .05, nry: .08, depth: .6 },
  ],
  roads: [
    // Thalassian Way: Silvermoon → Falconwing → Fairbreeze → Ghostlands gate.
    { id: 'thalassian-way', main: true, width: 40, points: [
      [1286000,55000], [1274000,73000], [1270400,83200], [1268000,100000]] },
    // Sunsail Anchorage spur west.
    { id: 'sunsail-spur', width: 26, points: [[1274000,73000], [1244000,76000]] },
  ],
  towns: [
    { name: 'Silvermoon City', nx: .55, ny: .25, faction: 'horde', tier: 'capital' },
    { name: 'Falconwing Square', nx: .45, ny: .55, faction: 'horde', tier: 'town' },
    { name: 'Fairbreeze Village', nx: .42, ny: .72, faction: 'horde', tier: 'village' },
    { name: 'Sunsail Anchorage', nx: .2, ny: .6, faction: 'horde', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Thistlefur Hold', nx: .3, ny: .8, members: ['thornReaver', 'briarMatriarch'] },
    { kind: 'beastDen', name: 'Springpaw Den', nx: .6, ny: .6, members: ['stalker', 'hound'] },
    { kind: 'corruptedGrove', name: 'The Scorched Grove', nx: .35, ny: .3, members: ['emberAcolyte', 'wisp'] },
    { kind: 'camp', name: 'Tor\'Watha', nx: .75, ny: .55, members: ['archer', 'brute', 'caster'] },
    { kind: 'watchtower', name: 'Silvermoon City Guard Post', nx: .548, ny: .27, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Falconwing Square Guard Post', nx: .456, ny: .538, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Fairbreeze Village Guard Post', nx: .423, ny: .704, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Sunsail Anchorage Guard Post', nx: .206, ny: .596, faction: 'horde', members: ['brute', 'archer', 'brute'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 30 }, { kind: 'wisp', weight: 22 }, { kind: 'hound', weight: 18 },
    { kind: 'caster', weight: 14 }, { kind: 'thornReaver', weight: 10 }, { kind: 'archer', weight: 6 },
  ],
  pois: [
    { name: 'Sunstrider Isle', kind: 'landmark', nx: .3, ny: .12, description: 'Blood elf starting isle off the northern coast.' },
    { name: 'The Dead Scar', kind: 'corruptedGrove', nx: .5, ny: .45, description: 'The festering wound Arthas tore through Quel\'Thalas.' },
    { name: 'East Sanctum', kind: 'shrine', nx: .52, ny: .62, description: 'Arcane sanctum on the Elrendar banks.' },
    { name: 'West Sanctum', kind: 'shrine', nx: .35, ny: .58, description: 'Arcane sanctum west of the Dead Scar.' },
    { name: 'North Sanctum', kind: 'shrine', nx: .44, ny: .5, description: 'Arcane sanctum feeding Silvermoon.' },
    { name: 'Duskwither Spire', kind: 'watchtower', nx: .68, ny: .5, description: 'A magister\'s tower gone dark.' },
    { name: 'Ruins of Silvermoon', kind: 'ruinedChapel', nx: .42, ny: .42, description: 'The western half of the city, still scarred by the Scourge.' },
    { name: 'Zeb\'Watha', kind: 'hamlet', nx: .78, ny: .78, description: 'Forest troll holding on the Elrendar.' },
    { name: 'Lake Elrendar', kind: 'landmark', nx: .78, ny: .9, description: 'Southern lake feeding the Elrendar River.' },
    { name: 'Goldenbough Pass', kind: 'crossing', nx: .5, ny: .97, description: 'Southern pass into the Ghostlands.' },
  ],
  entrances: [],
});

defineZoneContent({
  id: 'quel-danas',
  palette: 'sunlit elven isle',
  props: [
    { kind: 'autumnTree', weight: 30 }, { kind: 'flowers', weight: 20 },
    { kind: 'fern', weight: 14 }, { kind: 'rock', weight: 12 },
    { kind: 'mushrooms', weight: 10 }, { kind: 'leafPile', weight: 8 }, { kind: 'stump', weight: 6 },
  ],
  water: [
    // The isle is ringed by the North Sea.
    { kind: 'lake', nx: .5, ny: .02, nrx: .6, nry: .06, depth: .9 },
    { kind: 'lake', nx: .5, ny: .98, nrx: .6, nry: .06, depth: .9 },
  ],
  roads: [
    // Sun's Reach → Magisters' Terrace → Sunwell Plateau approach.
    { id: 'dawnstar-road', main: true, width: 40, points: [
      [1280000, 18000], [1282000, 12000], [1284800, 7200]] },
    // South shore road down to the Eversong crossing.
    { id: 'quel-danas-south', width: 30, points: [[1280000, 18000], [1280000, 40000]] },
  ],
  towns: [
    { name: 'Sun\'s Reach', nx: .5, ny: .45, faction: 'neutral', tier: 'town' },
  ],
  camps: [
    { kind: 'camp', name: 'Dawnblade Encampment', nx: .3, ny: .55, members: ['caster', 'archer', 'brute'] },
    { kind: 'corruptedGrove', name: 'The Dead Scar (north)', nx: .42, ny: .7, members: ['emberAcolyte', 'wisp'] },
  ],
  spawns: [
    { kind: 'caster', weight: 28 }, { kind: 'archer', weight: 24 }, { kind: 'wisp', weight: 18 },
    { kind: 'brute', weight: 16 }, { kind: 'emberAcolyte', weight: 14 },
  ],
  pois: [
    { name: 'Sun\'s Reach Harbor', kind: 'landmark', nx: .5, ny: .8, description: 'Shattered Sun staging harbor on the south shore.' },
    { name: 'Magisters\' Terrace', kind: 'watchtower', nx: .55, ny: .3, description: 'Kael\'thas\'s reclaimed sanctum.' },
    { name: 'Sunwell Plateau', kind: 'landmark', nx: .62, ny: .18, description: 'The restored Sunwell, heart of Quel\'Danas.' },
    { name: 'Dawning Square', kind: 'crossing', nx: .45, ny: .6, description: 'Contested square south of Sun\'s Reach.' },
  ],
  entrances: [
    { name: 'Magisters\' Terrace', nx: .55, ny: .3, levelMin: 70, levelMax: 70, kind: 'dungeon', theme: 'astral' },
    { name: 'Sunwell Plateau', nx: .62, ny: .18, levelMin: 70, levelMax: 70, kind: 'raid', theme: 'astral' },
  ],
});

defineZoneContent({
  id: 'ghostlands',
  palette: 'dead haunted forest',
  props: [
    { kind: 'deadTree', weight: 40 }, { kind: 'charredTree', weight: 14 }, { kind: 'mushrooms', weight: 14 },
    { kind: 'stump', weight: 12 }, { kind: 'tussock', weight: 8 }, { kind: 'rock', weight: 7 }, { kind: 'tree', weight: 5 },
  ],
  water: [
    { kind: 'lake', nx: .85, ny: .3, nrx: .08, nry: .18, depth: .8 }, // Lake Elrendar east shore
    { kind: 'river', nx: 0, ny: 0, points: [[.1, .02], [.4, .08], [.8, .05]], width: 220, depth: .7 },
  ],
  roads: [
    { id: 'ghostlands-road', main: true, width: 36, points: [
      [1268000,100000], [1274000,121000], [1278000,142000], [1267667,160000]] },
    { id: 'zulaman-spur', width: 26, points: [[1278000,142000], [1298000,145000]] },
  ],
  towns: [
    { name: 'Tranquillien', nx: .45, ny: .35, faction: 'horde', tier: 'town' },
  ],
  camps: [
    { kind: 'camp', name: 'Zeb\'Sora', nx: .78, ny: .2, members: ['archer', 'brute', 'caster'] },
    { kind: 'camp', name: 'Zeb\'Nowa', nx: .62, ny: .6, members: ['archer', 'brute', 'caster'] },
    { kind: 'camp', name: 'Zeb\'Tela', nx: .4, ny: .55, members: ['archer', 'brute'] },
    { kind: 'graveyard', name: 'Deatholme Approach', nx: .35, ny: .8, members: ['graveMarshal', 'caster', 'wisp'] },
    { kind: 'beastDen', name: 'Ghostclaw Den', nx: .2, ny: .45, members: ['stalker', 'hound'] },
    { kind: 'watchtower', name: 'Tranquillien Guard Post', nx: .453, ny: .366, faction: 'horde', members: ['brute', 'archer', 'brute'] },
  ],
  spawns: [
    { kind: 'graveMarshal', weight: 28 }, { kind: 'stalker', weight: 22 }, { kind: 'caster', weight: 18 },
    { kind: 'hound', weight: 14 }, { kind: 'archer', weight: 12 }, { kind: 'wisp', weight: 6 },
  ],
  pois: [
    { name: 'Deatholme', kind: 'necropolis', nx: .3, ny: .85, description: 'Scourge stronghold at the southern reach.' },
    { name: 'Windrunner Village', kind: 'ruinedChapel', nx: .2, ny: .3, description: 'Ruined home of the Windrunner sisters.' },
    { name: 'Windrunner Spire', kind: 'watchtower', nx: .14, ny: .32, description: 'Broken tower above the village.' },
    { name: 'Sanctum of the Sun', kind: 'shrine', nx: .55, ny: .5, description: 'Defiled elven sanctum.' },
    { name: 'Sanctum of the Moon', kind: 'shrine', nx: .35, ny: .35, description: 'Moonlit sanctum west of the Dead Scar.' },
    { name: 'Amani Pass', kind: 'crossing', nx: .68, ny: .72, description: 'Approach to Zul\'Aman.' },
    { name: 'Suncrown Village', kind: 'hamlet', nx: .58, ny: .18, description: 'Scourge-overrun elven village.' },
    { name: 'Goldenmist Village', kind: 'hamlet', nx: .28, ny: .18, description: 'Haunted village on the west shore.' },
    { name: 'Howling Ziggurat', kind: 'necropolis', nx: .42, ny: .62, description: 'Scourge ziggurat in the central woods.' },
    { name: 'Bleeding Ziggurat', kind: 'necropolis', nx: .34, ny: .48, description: 'Scourge ziggurat near the Dead Scar.' },
  ],
  entrances: [
    { name: 'Zul\'Aman', nx: .65, ny: .75, levelMin: 70, levelMax: 70, kind: 'raid', theme: 'rootbound' },
  ],
});

defineZoneContent({
  id: 'tirisfal',
  palette: 'forsaken woodland',
  props: [
    { kind: 'deadTree', weight: 34 }, { kind: 'mushrooms', weight: 18 }, { kind: 'tree', weight: 14 },
    { kind: 'stump', weight: 12 }, { kind: 'tussock', weight: 10 }, { kind: 'fern', weight: 7 }, { kind: 'rock', weight: 5 },
  ],
  water: [
    { kind: 'lake', nx: .5, ny: .02, nrx: .5, nry: .1, depth: .9 }, // northern coast
    { kind: 'lake', nx: .72, ny: .32, nrx: .07, nry: .09, depth: .8 }, // Brightwater Lake
    { kind: 'lake', nx: .2, ny: .5, nrx: .05, nry: .06, depth: .6 }, // Gunther's Retreat isle
  ],
  roads: [
    { id: 'tirisfal-road', main: true, width: 38, points: [
      [1000000,193000], [1020000,194000], [1044000,193000], [1068000,196000], [1080000,196000]] },
    { id: 'undercity-spur', width: 30, points: [[1044000,193000], [1044000,181000]] },
    { id: 'monastery-road', width: 26, points: [[1044000,181000], [1056000,179000], [1064000,175000]] },
  ],
  towns: [
    { name: 'Undercity', nx: .55, ny: .35, faction: 'horde', tier: 'capital' },
    { name: 'Brill', nx: .55, ny: .55, faction: 'horde', tier: 'town' },
    { name: 'The Bulwark', nx: .85, ny: .6, faction: 'horde', tier: 'outpost' },
    { name: 'Deathknell', nx: .3, ny: .62, faction: 'horde', tier: 'village' },
  ],
  camps: [
    { kind: 'camp', name: 'Scarlet Watch Post', nx: .78, ny: .32, members: ['archer', 'caster', 'brute'] },
    { kind: 'camp', name: 'Solliden Farmstead', nx: .38, ny: .5, members: ['graveMarshal', 'brute'] },
    { kind: 'camp', name: 'Agamand Mills', nx: .45, ny: .3, members: ['graveMarshal', 'caster'] },
    { kind: 'beastDen', name: 'Night Web Hollow', nx: .28, ny: .55, members: ['stalker'] },
    { kind: 'graveyard', name: 'Balnir Farmstead', nx: .75, ny: .6, members: ['graveMarshal', 'wisp'] },
    { kind: 'watchtower', name: 'Undercity Guard Post', nx: .545, ny: .369, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Brill Guard Post', nx: .541, ny: .538, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'The Bulwark Guard Post', nx: .841, ny: .597, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Deathknell Guard Post', nx: .311, ny: .611, faction: 'horde', members: ['brute', 'archer', 'brute'] },
  ],
  spawns: [
    { kind: 'graveMarshal', weight: 30 }, { kind: 'hound', weight: 20 }, { kind: 'caster', weight: 16 },
    { kind: 'stalker', weight: 14 }, { kind: 'archer', weight: 12 }, { kind: 'brute', weight: 8 },
  ],
  pois: [
    { name: 'Undercity Zeppelin Tower', kind: 'landmark', nx: .6, ny: .3, description: 'Zeppelin tower east of the ruins of Lordaeron.' },
    { name: 'Ruins of Lordaeron', kind: 'ruinedChapel', nx: .55, ny: .32, description: 'Capital ruins above the Undercity.' },
    { name: 'Scarlet Monastery', kind: 'landmark', nx: .8, ny: .25, description: 'Crusade bastion in the northeast hills.' },
    { name: 'Brightwater Lake', kind: 'landmark', nx: .72, ny: .32, description: 'Still lake east of Brill.' },
    { name: 'Gunther\'s Retreat', kind: 'landmark', nx: .2, ny: .5, description: 'Isle in the western lake.' },
    { name: 'Whispering Shore', kind: 'landmark', nx: .35, ny: .08, description: 'Northern coastline.' },
    { name: 'Cold Hearth Manor', kind: 'hamlet', nx: .52, ny: .58, description: 'Forsaken manor southeast of Brill.' },
    { name: 'Garren\'s Haunt', kind: 'hamlet', nx: .58, ny: .32, description: 'Plagued farmstead north of Brill.' },
    { name: 'Crusader Outpost', kind: 'watchtower', nx: .78, ny: .55, description: 'Scarlet forward post.' },
    { name: 'The Bulwark Crossing', kind: 'crossing', nx: .88, ny: .6, description: 'Fortified pass into the Western Plaguelands.' },
  ],
  entrances: [
    { name: 'Scarlet Monastery', nx: .8, ny: .25, levelMin: 26, levelMax: 45, kind: 'dungeon', theme: 'ossuary' },
  ],
});

defineZoneContent({
  id: 'western-plaguelands',
  palette: 'plagued farmland',
  props: [
    { kind: 'deadTree', weight: 30 }, { kind: 'mushrooms', weight: 20 }, { kind: 'tussock', weight: 14 },
    { kind: 'stump', weight: 12 }, { kind: 'rock', weight: 10 }, { kind: 'thornBrush', weight: 6 }, { kind: 'dryGrass', weight: 4 },
  ],
  water: [
    { kind: 'lake', nx: .72, ny: .78, nrx: .2, nry: .18, depth: .9 }, // Darrowmere Lake
    { kind: 'river', nx: 0, ny: 0, points: [[.05, .55], [.3, .6], [.55, .68], [.8, .8]], width: 200, depth: .7 },
  ],
  roads: [
    { id: 'plaguelands-road', main: true, width: 36, points: [
      [1080000,196000], [1098000,196000], [1134000,190000], [1170000,190000], [1200000,190000]] },
    { id: 'chillwind-spur', width: 26, points: [[1134000,190000], [1134000,211000], [1140000,300000]] },
    { id: 'caer-darrow-causeway', width: 22, points: [[1155000,196000], [1164000,205000]] },
  ],
  towns: [
    { name: 'Chillwind Camp', nx: .45, ny: .85, faction: 'alliance', tier: 'outpost' },
    { name: 'The Bulwark', nx: .15, ny: .6, faction: 'horde', tier: 'outpost' },
    { name: 'Hearthglen', nx: .45, ny: .18, faction: 'neutral', tier: 'town' },
  ],
  camps: [
    { kind: 'camp', name: 'Felstone Field', nx: .38, ny: .55, members: ['graveMarshal', 'caster'] },
    { kind: 'camp', name: 'Dalson\'s Tears', nx: .45, ny: .5, members: ['graveMarshal', 'brute'] },
    { kind: 'camp', name: 'Writhing Haunt', nx: .52, ny: .62, members: ['graveMarshal', 'wisp'] },
    { kind: 'camp', name: 'Gahrron\'s Withering', nx: .6, ny: .55, members: ['graveMarshal', 'caster'] },
    { kind: 'camp', name: 'Northridge Lumber Camp', nx: .5, ny: .32, members: ['archer', 'brute'] },
    { kind: 'beastDen', name: 'Plaguehound Den', nx: .3, ny: .4, members: ['hound', 'stalker'] },
    { kind: 'watchtower', name: 'Chillwind Camp Guard Post', nx: .451, ny: .837, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'The Bulwark Guard Post', nx: .156, ny: .597, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'camp', name: 'Chillwind Patrol', nx: .5, ny: .78, faction: 'alliance', members: ['brute', 'archer', 'caster', 'stalker'] },
    { kind: 'camp', name: 'Bulwark Warband', nx: .22, ny: .55, faction: 'horde', members: ['brute', 'archer', 'caster', 'stalker'] },
  ],
  spawns: [
    { kind: 'graveMarshal', weight: 32 }, { kind: 'caster', weight: 20 }, { kind: 'stalker', weight: 16 },
    { kind: 'hound', weight: 14 }, { kind: 'wisp', weight: 10 }, { kind: 'brute', weight: 8 },
  ],
  pois: [
    { name: 'Caer Darrow', kind: 'ruinedChapel', nx: .7, ny: .75, description: 'Ruined island keep holding Scholomance.' },
    { name: 'Darrowmere Lake', kind: 'landmark', nx: .72, ny: .78, description: 'Great lake of the Western Plaguelands.' },
    { name: 'Andorhal', kind: 'necropolis', nx: .42, ny: .68, description: 'Ruined city contested by the Scourge.' },
    { name: 'Sorrow Hill', kind: 'graveyard', nx: .5, ny: .8, description: 'Mass graves south of Andorhal.' },
    { name: 'Weeping Cave', kind: 'beastDen', nx: .62, ny: .38, description: 'Cave of plagued beasts.' },
    { name: 'Thondroril River', kind: 'crossing', nx: .95, ny: .5, description: 'River crossing into the Eastern Plaguelands.' },
    { name: 'Hearthglen Pass', kind: 'crossing', nx: .45, ny: .28, description: 'Pass up to the Crusader hold.' },
    { name: 'Ruins of Andorhal', kind: 'landmark', nx: .42, ny: .7, description: 'Broken clock tower and scorched streets.' },
  ],
  entrances: [
    { name: 'Scholomance', nx: .7, ny: .75, levelMin: 55, levelMax: 60, kind: 'dungeon', theme: 'ossuary' },
  ],
});

defineZoneContent({
  id: 'eastern-plaguelands',
  palette: 'blighted deadlands',
  props: [
    { kind: 'deadTree', weight: 34 }, { kind: 'mushrooms', weight: 22 }, { kind: 'tussock', weight: 14 },
    { kind: 'stump', weight: 10 }, { kind: 'rock', weight: 10 }, { kind: 'charredTree', weight: 6 }, { kind: 'deadTree', weight: 4 },
  ],
  water: [
    { kind: 'lake', nx: .55, ny: .85, nrx: .12, nry: .12, depth: .8 }, // Lake Mereldar
    { kind: 'lake', nx: .95, ny: .4, nrx: .08, nry: .3, depth: .9 }, // eastern coast
    { kind: 'river', nx: 0, ny: 0, points: [[0, .5], [.25, .55], [.5, .6], [.75, .72]], width: 200, depth: .7 },
  ],
  roads: [
    { id: 'plague-road', main: true, width: 36, points: [
      [1200000,190000], [1223333,188000], [1242000,172000], [1258333,185000], [1305000,193000]] },
    { id: 'northpass-spur', width: 26, points: [[1258333,185000], [1270000,160000]] },
  ],
  towns: [
    { name: 'Light\'s Hope Chapel', nx: .75, ny: .55, faction: 'neutral', tier: 'town' },
  ],
  camps: [
    { kind: 'graveyard', name: 'Corin\'s Crossing', nx: .55, ny: .62, members: ['graveMarshal', 'caster'] },
    { kind: 'camp', name: 'Plaguewood', nx: .32, ny: .35, members: ['graveMarshal', 'brute', 'wisp'] },
    { kind: 'camp', name: 'Terrordale', nx: .15, ny: .3, members: ['graveMarshal', 'caster'] },
    { kind: 'camp', name: 'Mazra\'Alor', nx: .62, ny: .3, members: ['archer', 'brute', 'caster'] },
    { kind: 'beastDen', name: 'Pestilent Scar', nx: .7, ny: .75, members: ['stalker', 'mireSpitter'] },
    { kind: 'camp', name: 'Zul\'Mashar', nx: .65, ny: .15, members: ['archer', 'brute', 'caster'] },
  ],
  spawns: [
    { kind: 'graveMarshal', weight: 34 }, { kind: 'caster', weight: 18 }, { kind: 'brute', weight: 14 },
    { kind: 'hound', weight: 14 }, { kind: 'stalker', weight: 12 }, { kind: 'wisp', weight: 8 },
  ],
  pois: [
    { name: 'Stratholme Gates', kind: 'landmark', nx: .3, ny: .2, description: 'Burning city of the Scourge.' },
    { name: 'Tyr\'s Hand', kind: 'watchtower', nx: .78, ny: .78, description: 'Scarlet Crusade fortified abbey.' },
    { name: 'Northdale', kind: 'ruinedChapel', nx: .68, ny: .45, description: 'Drowned, haunted township.' },
    { name: 'Darrowshire', kind: 'ruinedChapel', nx: .4, ny: .82, description: 'Silent ruined village by Lake Mereldar.' },
    { name: 'Crown Guard Tower', kind: 'watchtower', nx: .38, ny: .68, description: 'Restored watchtower on the plague road.' },
    { name: 'Eastwall Tower', kind: 'watchtower', nx: .62, ny: .42, description: 'Restored watchtower east of the road.' },
    { name: 'Northpass Tower', kind: 'watchtower', nx: .52, ny: .28, description: 'Restored watchtower below the pass.' },
    { name: 'Plaguewood Tower', kind: 'watchtower', nx: .3, ny: .3, description: 'Tower at the edge of the Plaguewood.' },
    { name: 'The Undercroft', kind: 'necropolis', nx: .28, ny: .28, description: 'Crypt network beneath the Plaguewood.' },
    { name: 'Acherus Approach', kind: 'necropolis', nx: .85, ny: .35, description: 'Scourge necropolis above the eastern cliffs.' },
    { name: 'Thondroril Crossing', kind: 'crossing', nx: .05, ny: .5, description: 'Western river crossing.' },
  ],
  entrances: [
    { name: 'Stratholme', nx: .3, ny: .2, levelMin: 55, levelMax: 60, kind: 'dungeon', theme: 'ossuary' },
  ],
});

// ── Silverpine / Hillsbrad / Hinterlands / Alterac / Arathi ──────────────────

defineZoneContent({
  id: 'silverpine',
  palette: 'dark pine forest',
  props: [
    { kind: 'tree', weight: 30 }, { kind: 'deadTree', weight: 26 }, { kind: 'fern', weight: 12 },
    { kind: 'mushrooms', weight: 12 }, { kind: 'stump', weight: 10 }, { kind: 'tussock', weight: 6 }, { kind: 'rock', weight: 4 },
  ],
  water: [
    { kind: 'lake', nx: .02, ny: .5, nrx: .06, nry: .5, depth: .9 }, // western coast
    { kind: 'lake', nx: .92, ny: .3, nrx: .12, nry: .25, depth: .85 }, // Lordamere Lake shore
    { kind: 'lake', nx: .55, ny: .2, nrx: .06, nry: .05, depth: .6 }, // Skittering Dark pond
  ],
  roads: [
    { id: 'silverpine-road', main: true, width: 34, points: [
      [1040000,220000], [1036000,256000], [1028000,280000], [1046667,300000]] },
    { id: 'pyrewood-spur', width: 24, points: [[1028000,280000], [1018667,289333]] },
  ],
  towns: [
    { name: 'The Sepulcher', nx: .45, ny: .45, faction: 'horde', tier: 'town' },
    { name: 'Pyrewood Village', nx: .45, ny: .72, faction: 'alliance', tier: 'village' },
    { name: 'Ambermill', nx: .62, ny: .6, faction: 'alliance', tier: 'village' },
  ],
  camps: [
    { kind: 'camp', name: 'Fenris Isle', nx: .68, ny: .28, members: ['graveMarshal', 'caster'] },
    { kind: 'camp', name: 'The Dead Field', nx: .45, ny: .22, members: ['graveMarshal', 'brute'] },
    { kind: 'beastDen', name: 'The Skittering Dark', nx: .35, ny: .18, members: ['stalker'] },
    { kind: 'camp', name: 'Olsen\'s Farthing', nx: .45, ny: .52, members: ['graveMarshal'] },
    { kind: 'camp', name: 'Deep Elem Mine', nx: .58, ny: .48, members: ['goblin', 'brute'] },
    { kind: 'watchtower', name: 'The Sepulcher Guard Post', nx: .459, ny: .459, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Pyrewood Village Guard Post', nx: .453, ny: .707, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Ambermill Guard Post', nx: .61, ny: .592, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 26 }, { kind: 'hound', weight: 22 }, { kind: 'graveMarshal', weight: 20 },
    { kind: 'brute', weight: 14 }, { kind: 'mireSpitter', weight: 10 }, { kind: 'caster', weight: 8 },
  ],
  pois: [
    { name: 'Shadowfang Keep', kind: 'landmark', nx: .35, ny: .75, description: 'Worgen-haunted keep above Pyrewood.' },
    { name: 'Lordamere Lake', kind: 'landmark', nx: .92, ny: .3, description: 'Great lake on the Alterac border.' },
    { name: 'The Greymane Wall', kind: 'landmark', nx: .5, ny: .88, description: 'Gilneas\' sealed southern wall.' },
    { name: 'The Ivar Patch', kind: 'hamlet', nx: .48, ny: .15, description: 'Plagued farm in the north woods.' },
    { name: 'Malden\'s Orchard', kind: 'hamlet', nx: .55, ny: .12, description: 'Abandoned orchard.' },
    { name: 'North Tide\'s Run', kind: 'landmark', nx: .38, ny: .3, description: 'Western shoreline.' },
    { name: 'Valgan\'s Field', kind: 'hamlet', nx: .52, ny: .3, description: 'Farmstead on the north road.' },
    { name: 'The Decrepit Ferry', kind: 'crossing', nx: .58, ny: .35, description: 'Old ferry landing on Lordamere.' },
    { name: 'Beren\'s Peril', kind: 'beastDen', nx: .6, ny: .72, description: 'Worgen cave in the southern hills.' },
  ],
  entrances: [
    { name: 'Shadowfang Keep', nx: .35, ny: .75, levelMin: 18, levelMax: 25, kind: 'dungeon', theme: 'ossuary' },
  ],
});

defineZoneContent({
  id: 'hillsbrad',
  palette: 'green foothills',
  props: [
    { kind: 'heather', weight: 24 }, { kind: 'tussock', weight: 22 }, { kind: 'tree', weight: 18 },
    { kind: 'flowers', weight: 12 }, { kind: 'limestone', weight: 10 }, { kind: 'windTree', weight: 8 }, { kind: 'stump', weight: 6 },
  ],
  elevation: {
    features: [
      { nx: .5, ny: .1, nw: .9, nh: .18, tier: 1 }, // northern foothill shelf
      { nx: .15, ny: .3, nw: .2, nh: .3, tier: 1 },
    ],
    ramps: [{ nx: .5, ny: .2, nx2: .55, ny2: .35, width: 60 }],
    noise: 6,
  },
  water: [
    { kind: 'lake', nx: .5, ny: .95, nrx: .5, nry: .08, depth: .9 }, // southern coast
    { kind: 'lake', nx: .12, ny: .12, nrx: .1, nry: .12, depth: .8 }, // Lordamere shore NW
    { kind: 'river', nx: 0, ny: 0, points: [[.2, .1], [.35, .3], [.5, .55], [.55, .8]], width: 180, depth: .6 },
  ],
  roads: [
    { id: 'hillsbrad-road', main: true, width: 36, points: [
      [1000000,320000], [1050000,316667], [1120000,314000], [1150000,318667], [1200000,320000]] },
    { id: 'southshore-road', width: 28, points: [[1120000,314000], [1100000,332000], [1100000,335200]] },
    { id: 'alterac-pass', width: 26, points: [[1087500,314000], [1104000,300000]] },
  ],
  towns: [
    { name: 'Southshore', nx: .5, ny: .8, faction: 'alliance', tier: 'town' },
    { name: 'Tarren Mill', nx: .6, ny: .35, faction: 'horde', tier: 'town' },
    { name: 'Hillsbrad Fields', nx: .32, ny: .5, faction: 'alliance', tier: 'village' },
  ],
  camps: [
    { kind: 'camp', name: 'Azurelode Mine', nx: .3, ny: .62, members: ['goblin', 'brute'] },
    { kind: 'camp', name: 'Durnholde Keep', nx: .75, ny: .45, members: ['archer', 'brute', 'caster'] },
    { kind: 'camp', name: 'Dun Garok', nx: .72, ny: .78, members: ['brute', 'archer'] },
    { kind: 'beastDen', name: 'Hillsbrad Yeti Cave', nx: .45, ny: .28, members: ['brute', 'stalker'] },
    { kind: 'camp', name: 'Syndicate Camp', nx: .55, ny: .2, members: ['archer', 'caster'] },
    { kind: 'watchtower', name: 'Southshore Guard Post', nx: .5, ny: .774, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Tarren Mill Guard Post', nx: .597, ny: .371, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Hillsbrad Fields Guard Post', nx: .325, ny: .5, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'camp', name: 'Southshore Patrol', nx: .45, ny: .72, faction: 'alliance', members: ['brute', 'archer', 'caster', 'stalker'] },
    { kind: 'camp', name: 'Tarren Mill Warband', nx: .55, ny: .42, faction: 'horde', members: ['brute', 'archer', 'caster', 'stalker'] },
  ],
  spawns: [
    { kind: 'brute', weight: 24 }, { kind: 'stalker', weight: 20 }, { kind: 'archer', weight: 18 },
    { kind: 'mireSpitter', weight: 14 }, { kind: 'caster', weight: 12 }, { kind: 'hound', weight: 12 },
  ],
  pois: [
    { name: 'Southshore Dock', kind: 'landmark', nx: .5, ny: .88, description: 'Alliance harbor on Baradin Bay.' },
    { name: 'Dalaran Crater', kind: 'landmark', nx: .22, ny: .18, description: 'Where the Violet Citadel once stood.' },
    { name: 'Durnholde Keep', kind: 'landmark', nx: .75, ny: .45, description: 'Internment camp fortress.' },
    { name: 'Nethander Stead', kind: 'hamlet', nx: .6, ny: .62, description: 'Farmstead east of Southshore.' },
    { name: 'Purgation Isle', kind: 'corruptedGrove', nx: .18, ny: .85, description: 'Haunted isle off the southwest coast.' },
    { name: 'The Headland', kind: 'landmark', nx: .45, ny: .9, description: 'Cliffs west of Southshore.' },
    { name: 'Corrahn\'s Dagger', kind: 'camp', nx: .48, ny: .42, description: 'Syndicate camp in the foothills.' },
    { name: 'Sofera\'s Naze', kind: 'watchtower', nx: .55, ny: .38, description: 'Syndicate lookout above Tarren Mill.' },
    { name: 'Gallows\' Corner', kind: 'crossing', nx: .5, ny: .4, description: 'Crossroads on the Alterac road.' },
    { name: 'Eastern Strand', kind: 'landmark', nx: .65, ny: .85, description: 'Murloc-infested shoreline.' },
    { name: 'Western Strand', kind: 'landmark', nx: .3, ny: .85, description: 'Coastline west of Southshore.' },
  ],
  entrances: [],
});

defineZoneContent({
  id: 'hinterlands',
  palette: 'forested troll highlands',
  props: [
    { kind: 'tree', weight: 40 }, { kind: 'fern', weight: 16 }, { kind: 'heather', weight: 12 },
    { kind: 'tussock', weight: 12 }, { kind: 'stump', weight: 8 }, { kind: 'rock', weight: 7 }, { kind: 'mushrooms', weight: 5 },
  ],
  elevation: {
    features: [
      { nx: .5, ny: .3, nw: .7, nh: .3, tier: 1 },
      { nx: .2, ny: .55, nw: .25, nh: .3, tier: 2, kind: 'plateau' }, // Aerie Peak rise
      { nx: .8, ny: .6, nw: .3, nh: .3, tier: 1 },
    ],
    ramps: [
      { nx: .25, ny: .5, nx2: .35, ny2: .55, width: 70 },
      { nx: .6, ny: .45, nx2: .7, ny2: .6, width: 70 },
    ],
    noise: 8,
  },
  water: [
    { kind: 'lake', nx: .97, ny: .7, nrx: .06, nry: .3, depth: .9 }, // eastern coast
    { kind: 'lake', nx: .4, ny: .6, nrx: .06, nry: .07, depth: .7 }, // Skulk Rock pool
    { kind: 'river', nx: 0, ny: 0, points: [[.3, .2], [.45, .4], [.55, .65], [.6, .9]], width: 180, depth: .6 },
  ],
  roads: [
    { id: 'hinterlands-road', main: true, width: 34, points: [
      [1169000,260000], [1180000,262667], [1190000,266667], [1200000,276000], [1208000,284000]] },
    { id: 'hinterlands-south', width: 26, points: [[1180000,262667], [1250000,300000]] },
  ],
  towns: [
    { name: 'Aerie Peak', nx: .15, ny: .5, faction: 'alliance', tier: 'town' },
    { name: 'Revantusk Village', nx: .8, ny: .8, faction: 'horde', tier: 'village' },
    { name: 'Quel\'Danil Lodge', nx: .32, ny: .42, faction: 'alliance', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Jintha\'Alor', nx: .62, ny: .68, members: ['archer', 'brute', 'caster'] },
    { kind: 'camp', name: 'Shadra\'Alor', nx: .35, ny: .72, members: ['archer', 'brute', 'caster'] },
    { kind: 'camp', name: 'Zun\'watha', nx: .25, ny: .58, members: ['archer', 'brute'] },
    { kind: 'camp', name: 'Hiri\'watha', nx: .32, ny: .6, members: ['archer', 'caster'] },
    { kind: 'beastDen', name: 'Skulk Rock', nx: .55, ny: .42, members: ['mireSpitter', 'stalker'] },
    { kind: 'beastDen', name: 'The Creeping Ruin', nx: .5, ny: .55, members: ['stalker'] },
    { kind: 'watchtower', name: 'Aerie Peak Guard Post', nx: .167, ny: .5, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Revantusk Village Guard Post', nx: .788, ny: .791, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Quel\'Danil Lodge Guard Post', nx: .332, ny: .424, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'camp', name: 'Aerie Peak Patrol', nx: .22, ny: .55, faction: 'alliance', members: ['brute', 'archer', 'caster', 'stalker'] },
    { kind: 'camp', name: 'Revantusk Warband', nx: .72, ny: .72, faction: 'horde', members: ['brute', 'archer', 'caster', 'stalker'] },
  ],
  spawns: [
    { kind: 'hound', weight: 24 }, { kind: 'archer', weight: 20 }, { kind: 'stalker', weight: 18 },
    { kind: 'brute', weight: 16 }, { kind: 'stormSentinel', weight: 12 }, { kind: 'mireSpitter', weight: 10 },
  ],
  pois: [
    { name: 'Seradane', kind: 'corruptedGrove', nx: .62, ny: .28, description: 'Emerald Dream portal ruin guarded by green dragonkin.' },
    { name: 'The Altar of Zul', kind: 'shrine', nx: .48, ny: .66, description: 'Vilebranch ritual altar.' },
    { name: 'Agol\'watha', kind: 'ruinedChapel', nx: .45, ny: .4, description: 'Troll ruin in the central forest.' },
    { name: 'Shaol\'watha', kind: 'ruinedChapel', nx: .72, ny: .55, description: 'Troll ruin east of the road.' },
    { name: 'The Overlook Cliffs', kind: 'landmark', nx: .8, ny: .5, description: 'Cliffs above the eastern sea.' },
    { name: 'Valorwind Lake', kind: 'landmark', nx: .4, ny: .6, description: 'Still lake below Aerie Peak.' },
    { name: 'Wildhammer Keep', kind: 'landmark', nx: .15, ny: .48, description: 'Gryphon riders\' hold at Aerie Peak.' },
    { name: 'Plaguemist Ravine', kind: 'corruptedGrove', nx: .25, ny: .35, description: 'Fel-tainted ravine.' },
    { name: 'The Forlorn Ridge', kind: 'landmark', nx: .3, ny: .15, description: 'Northern ridgeline.' },
  ],
  entrances: [],
});

defineZoneContent({
  id: 'alterac',
  palette: 'snowy ogre highlands',
  props: [
    { kind: 'snowPine', weight: 30 }, { kind: 'rock', weight: 22 }, { kind: 'limestone', weight: 16 },
    { kind: 'tussock', weight: 12 }, { kind: 'iceCrystal', weight: 10 }, { kind: 'windTree', weight: 6 }, { kind: 'stump', weight: 4 },
  ],
  elevation: {
    features: [
      { nx: .5, ny: .3, nw: .8, nh: .35, tier: 2 },
      { nx: .3, ny: .7, nw: .4, nh: .3, tier: 3, kind: 'mesa' }, // Alterac high peaks
      { nx: .75, ny: .6, nw: .3, nh: .35, tier: 1 },
    ],
    ramps: [
      { nx: .4, ny: .45, nx2: .4, ny2: .6, width: 80 },
      { nx: .6, ny: .5, nx2: .7, ny2: .65, width: 70 },
    ],
    noise: 10,
  },
  water: [
    { kind: 'lake', nx: .05, ny: .3, nrx: .08, nry: .3, depth: .85 }, // Lordamere Lake west shore
    { kind: 'lake', nx: .55, ny: .75, nrx: .06, nry: .08, depth: .6 }, // frozen tarn
  ],
  roads: [
    { id: 'alterac-road', main: true, width: 32, points: [
      [1104000,220000], [1104000,256000], [1110000,280000], [1226667,360000]] },
    { id: 'strahnbrad-spur', width: 24, points: [[1104000,256000], [1121250,240000]] },
  ],
  towns: [
    { name: 'Alterac Ruins', nx: .4, ny: .45, faction: 'neutral', tier: 'village' },
    { name: 'Strahnbrad', nx: .62, ny: .28, faction: 'neutral', tier: 'village' },
  ],
  camps: [
    { kind: 'camp', name: 'Crushridge Hold', nx: .45, ny: .5, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'Slaughter Hollow', nx: .5, ny: .65, members: ['brute'] },
    { kind: 'beastDen', name: 'Growless Cave', nx: .38, ny: .68, members: ['brute', 'stalker'] },
    { kind: 'camp', name: 'Syndicate Hold', nx: .6, ny: .35, members: ['archer', 'caster', 'brute'] },
    { kind: 'camp', name: 'Dandred\'s Fold', nx: .42, ny: .18, members: ['archer', 'caster'] },
  ],
  spawns: [
    { kind: 'brute', weight: 30 }, { kind: 'frostRevenant', weight: 18 }, { kind: 'stalker', weight: 16 },
    { kind: 'archer', weight: 14 }, { kind: 'caster', weight: 12 }, { kind: 'hound', weight: 10 },
  ],
  pois: [
    { name: 'Dalaran Crater', kind: 'landmark', nx: .2, ny: .8, description: 'Crater where the mage city stood.' },
    { name: 'Lordamere Lake', kind: 'landmark', nx: .05, ny: .3, description: 'Western shore of the great lake.' },
    { name: 'The Uplands', kind: 'landmark', nx: .55, ny: .15, description: 'Northern high meadows.' },
    { name: 'Gallows\' Corner', kind: 'crossing', nx: .5, ny: .55, description: 'Crossroads below the ruins.' },
    { name: 'Misty Shore', kind: 'landmark', nx: .35, ny: .2, description: 'Lordamere lakeshore.' },
    { name: 'Chillwind Point', kind: 'crossing', nx: .8, ny: .15, description: 'Northeast pass toward the Plaguelands.' },
    { name: 'Ruins of Alterac', kind: 'ruinedChapel', nx: .4, ny: .45, description: 'Ogre-held ruins of the traitor kingdom.' },
  ],
  entrances: [],
});

defineZoneContent({
  id: 'arathi',
  palette: 'grassy highlands',
  props: [
    { kind: 'tussock', weight: 26 }, { kind: 'heather', weight: 22 }, { kind: 'steppeStone', weight: 16 },
    { kind: 'limestone', weight: 14 }, { kind: 'windTree', weight: 12 }, { kind: 'flowers', weight: 6 }, { kind: 'rock', weight: 4 },
  ],
  elevation: {
    features: [
      { nx: .5, ny: .5, nw: .9, nh: .8, tier: 1 },
      { nx: .2, ny: .6, nw: .25, nh: .3, tier: 2, kind: 'mesa' }, // Stromgarde rise
    ],
    ramps: [{ nx: .45, ny: .4, nx2: .5, ny2: .55, width: 80 }],
    noise: 7,
  },
  water: [
    { kind: 'lake', nx: .3, ny: .85, nrx: .08, nry: .1, depth: .7 }, // Circle of West Binding pool
    { kind: 'lake', nx: .95, ny: .5, nrx: .06, nry: .4, depth: .9 }, // eastern coast
  ],
  roads: [
    { id: 'arathi-road', main: true, width: 34, points: [
      [1200000,324000], [1236000,324000], [1257600,321000], [1280000,324000]] },
    { id: 'thandol-approach', width: 28, points: [[1236000,324000], [1230000,360000]] },
  ],
  towns: [
    { name: 'Refuge Pointe', nx: .45, ny: .4, faction: 'alliance', tier: 'outpost' },
    { name: 'Hammerfall', nx: .72, ny: .35, faction: 'horde', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Boulderfist Hall', nx: .55, ny: .75, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'Boulderfist Outpost', nx: .35, ny: .72, members: ['brute'] },
    { kind: 'camp', name: 'Witherbark Village', nx: .65, ny: .65, members: ['archer', 'brute', 'caster'] },
    { kind: 'camp', name: 'Go\'Shek Farm', nx: .6, ny: .55, members: ['archer', 'caster'] },
    { kind: 'camp', name: 'Dabyrie\'s Farmstead', nx: .5, ny: .4, members: ['archer', 'brute'] },
    { kind: 'beastDen', name: 'Boulder\'gor', nx: .32, ny: .3, members: ['brute', 'stalker'] },
    { kind: 'watchtower', name: 'Refuge Pointe Guard Post', nx: .454, ny: .411, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Hammerfall Guard Post', nx: .712, ny: .357, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'camp', name: 'Refuge Pointe Patrol', nx: .5, ny: .45, faction: 'alliance', members: ['brute', 'archer', 'caster', 'stalker'] },
    { kind: 'camp', name: 'Hammerfall Warband', nx: .65, ny: .42, faction: 'horde', members: ['brute', 'archer', 'caster', 'stalker'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 26 }, { kind: 'brute', weight: 22 }, { kind: 'archer', weight: 18 },
    { kind: 'stormSentinel', weight: 14 }, { kind: 'caster', weight: 12 }, { kind: 'goblin', weight: 8 },
  ],
  pois: [
    { name: 'Stromgarde Keep', kind: 'ruinedChapel', nx: .22, ny: .6, description: 'Ruined capital of the Arathi kingdom.' },
    { name: 'Thoradin\'s Wall', kind: 'landmark', nx: .15, ny: .35, description: 'Ancient northern rampart.' },
    { name: 'Circle of East Binding', kind: 'standingStones', nx: .65, ny: .3, description: 'Elemental stone circle.' },
    { name: 'Circle of West Binding', kind: 'standingStones', nx: .25, ny: .8, description: 'Elemental stone circle.' },
    { name: 'Circle of Inner Binding', kind: 'standingStones', nx: .35, ny: .58, description: 'Elemental stone circle.' },
    { name: 'Circle of Outer Binding', kind: 'standingStones', nx: .48, ny: .52, description: 'Elemental stone circle.' },
    { name: 'Thandol Span', kind: 'crossing', nx: .45, ny: .95, description: 'Great bridge south into the Wetlands.' },
    { name: 'Faldir\'s Cove', kind: 'landmark', nx: .25, ny: .85, description: 'Hidden southern cove.' },
    { name: 'The Drowned Reef', kind: 'landmark', nx: .8, ny: .9, description: 'Shipwreck reef off the southern coast.' },
    { name: 'Northfold Manor', kind: 'hamlet', nx: .3, ny: .3, description: 'Syndicate-held manor.' },
  ],
  entrances: [],
});

// ── Khaz Modan ───────────────────────────────────────────────────────────────

defineZoneContent({
  id: 'wetlands',
  palette: 'marsh',
  props: [
    { kind: 'reeds', weight: 26 }, { kind: 'willow', weight: 24 }, { kind: 'lilies', weight: 14 },
    { kind: 'mushrooms', weight: 12 }, { kind: 'deadTree', weight: 10 }, { kind: 'stump', weight: 8 }, { kind: 'rock', weight: 6 },
  ],
  water: [
    { kind: 'lake', nx: .05, ny: .5, nrx: .1, nry: .5, depth: .9 }, // western coast / Menethil Bay
    { kind: 'lake', nx: .5, ny: .4, nrx: .15, nry: .15, depth: .7 }, // central mire
    { kind: 'lake', nx: .7, ny: .65, nrx: .1, nry: .12, depth: .7 },
    { kind: 'river', nx: 0, ny: 0, points: [[.5, 0], [.45, .3], [.4, .6], [.35, 1]], width: 220, depth: .7 },
  ],
  roads: [
    { id: 'wetlands-road', main: true, width: 32, points: [
      [1260000,360000], [1246667,390000], [1232000,393000], [1228000,393000]] },
    { id: 'loch-road', width: 28, points: [[1246667,390000], [1233333,420000]] },
  ],
  towns: [
    { name: 'Menethil Harbor', nx: .15, ny: .55, faction: 'alliance', tier: 'town' },
    { name: 'Dun Modr', nx: .45, ny: .18, faction: 'alliance', tier: 'outpost' },
    { name: 'Greenwarden\'s Grove', nx: .58, ny: .5, faction: 'alliance', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Angerfang Encampment', nx: .5, ny: .45, members: ['brute', 'archer', 'caster'] },
    { kind: 'camp', name: 'Dun Algaz', nx: .5, ny: .75, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'Ironbeard\'s Tomb', nx: .45, ny: .28, members: ['graveMarshal', 'wisp'] },
    { kind: 'beastDen', name: 'The Green Belt', nx: .55, ny: .4, members: ['stalker', 'mireSpitter'] },
    { kind: 'camp', name: 'Mosshide Fen', nx: .62, ny: .6, members: ['brute', 'archer'] },
    { kind: 'watchtower', name: 'Menethil Harbor Guard Post', nx: .163, ny: .548, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Dun Modr Guard Post', nx: .451, ny: .193, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Greenwarden\'s Grove Guard Post', nx: .571, ny: .5, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
  ],
  spawns: [
    { kind: 'mireSpitter', weight: 30 }, { kind: 'stalker', weight: 24 }, { kind: 'brute', weight: 18 },
    { kind: 'archer', weight: 12 }, { kind: 'hound', weight: 10 }, { kind: 'wisp', weight: 6 },
  ],
  pois: [
    { name: 'Menethil Harbor', kind: 'landmark', nx: .1, ny: .55, description: 'Alliance port on Baradin Bay.' },
    { name: 'Thandol Span', kind: 'crossing', nx: .5, ny: .12, description: 'Twin bridges into Arathi.' },
    { name: 'Sundown Marsh', kind: 'landmark', nx: .35, ny: .3, description: 'Western marsh flats.' },
    { name: 'Bluegill Marsh', kind: 'landmark', nx: .2, ny: .35, description: 'Murloc shallows.' },
    { name: 'Saltspray Glen', kind: 'landmark', nx: .35, ny: .2, description: 'Raptor hunting grounds.' },
    { name: 'Whelgar\'s Excavation', kind: 'quarry', nx: .35, ny: .45, description: 'Dwarven digsite.' },
    { name: 'The Lost Fleet', kind: 'landmark', nx: .75, ny: .35, description: 'Sunken Third Fleet wrecks.' },
    { name: 'Dragonmaw Gates', kind: 'crossing', nx: .55, ny: .85, description: 'Southern pass toward the Badlands.' },
    { name: 'Raptor Ridge', kind: 'beastDen', nx: .7, ny: .4, description: 'Raptor hunting ridge.' },
  ],
  entrances: [],
});

defineZoneContent({
  id: 'dun-morogh',
  palette: 'snowy dwarf highlands',
  props: [
    { kind: 'snowPine', weight: 44 }, { kind: 'iceCrystal', weight: 14 }, { kind: 'rock', weight: 14 },
    { kind: 'tussock', weight: 12 }, { kind: 'stump', weight: 8 }, { kind: 'deadTree', weight: 5 }, { kind: 'limestone', weight: 3 },
  ],
  elevation: {
    features: [
      { nx: .55, ny: .25, nw: .5, nh: .3, tier: 2 }, // Ironforge massif
      { nx: .3, ny: .6, nw: .4, nh: .4, tier: 1 },
      { nx: .8, ny: .6, nw: .3, nh: .4, tier: 1 },
    ],
    ramps: [
      { nx: .55, ny: .3, nx2: .5, ny2: .5, width: 90 },
      { nx: .45, ny: .55, nx2: .55, ny2: .7, width: 70 },
    ],
    noise: 9,
  },
  water: [
    { kind: 'lake', nx: .35, ny: .45, nrx: .08, nry: .08, depth: .7 }, // Iceflow Lake
    { kind: 'lake', nx: .7, ny: .55, nrx: .06, nry: .07, depth: .6 }, // Helm's Bed Lake
    { kind: 'river', nx: 0, ny: 0, points: [[.35, .45], [.4, .6], [.45, .8]], width: 160, depth: .5 },
  ],
  roads: [
    { id: 'dun-morogh-road', main: true, width: 36, points: [
      [1146000,418000], [1134000,433000], [1160000,438000], [1220000,414000]] },
    { id: 'gnomeregan-spur', width: 24, points: [[1134000,433000], [1110000,424000]] },
    { id: 'searing-pass', width: 26, points: [[1150000,440000], [1155000,460000]] },
  ],
  towns: [
    { name: 'Ironforge', nx: .55, ny: .3, faction: 'alliance', tier: 'capital' },
    { name: 'Kharanos', nx: .45, ny: .55, faction: 'alliance', tier: 'town' },
    { name: 'Anvilmar', nx: .3, ny: .72, faction: 'alliance', tier: 'village' },
    { name: 'Brewnall Village', nx: .32, ny: .45, faction: 'alliance', tier: 'village' },
    { name: 'Steelgrill\'s Depot', nx: .5, ny: .55, faction: 'alliance', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Frostmane Hold', nx: .25, ny: .55, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'Frostmane Front', nx: .4, ny: .62, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'Grik\'nir\'s Camp', nx: .75, ny: .55, members: ['brute', 'caster'] },
    { kind: 'beastDen', name: 'Grizzled Den', nx: .48, ny: .58, members: ['hound', 'stalker'] },
    { kind: 'camp', name: 'Leper Gnome Camp', nx: .28, ny: .42, members: ['goblin', 'caster'] },
    { kind: 'watchtower', name: 'Ironforge Guard Post', nx: .548, ny: .32, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Kharanos Guard Post', nx: .456, ny: .538, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Anvilmar Guard Post', nx: .306, ny: .707, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Brewnall Village Guard Post', nx: .328, ny: .455, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Steelgrill\'s Depot Guard Post', nx: .5, ny: .537, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
  ],
  spawns: [
    { kind: 'hound', weight: 26 }, { kind: 'brute', weight: 22 }, { kind: 'goblin', weight: 16 },
    { kind: 'stalker', weight: 14 }, { kind: 'archer', weight: 12 }, { kind: 'frostRevenant', weight: 10 },
  ],
  pois: [
    { name: 'Deeprun Tram (Ironforge)', kind: 'landmark', nx: .6, ny: .32, description: 'Tram station beneath Tinker Town.' },
    { name: 'Gates of Ironforge', kind: 'landmark', nx: .55, ny: .38, description: 'Grand gate of the dwarf capital.' },
    { name: 'Iceflow Lake', kind: 'landmark', nx: .35, ny: .45, description: 'Frozen lake west of Kharanos.' },
    { name: 'Helm\'s Bed Lake', kind: 'landmark', nx: .7, ny: .55, description: 'Frozen lake in the southeast.' },
    { name: 'Shimmer Ridge', kind: 'landmark', nx: .42, ny: .4, description: 'Frost-covered ridge.' },
    { name: 'North Gate Pass', kind: 'crossing', nx: .85, ny: .35, description: 'Pass toward Loch Modan.' },
    { name: 'South Gate Pass', kind: 'crossing', nx: .85, ny: .55, description: 'Southern pass to Loch Modan.' },
    { name: 'Coldridge Pass', kind: 'crossing', nx: .35, ny: .65, description: 'Pass into Coldridge Valley.' },
    { name: 'Misty Pine Refuge', kind: 'hamlet', nx: .58, ny: .45, description: 'Trapper refuge in the pines.' },
    { name: 'The Tundrid Hills', kind: 'landmark', nx: .65, ny: .6, description: 'Snowy hills east of Kharanos.' },
  ],
  entrances: [
    { name: 'Gnomeregan', nx: .25, ny: .4, levelMin: 24, levelMax: 35, kind: 'dungeon', theme: 'foundry' },
  ],
});

defineZoneContent({
  id: 'loch-modan',
  palette: 'highland lake',
  props: [
    { kind: 'tree', weight: 26 }, { kind: 'rock', weight: 20 }, { kind: 'limestone', weight: 16 },
    { kind: 'tussock', weight: 16 }, { kind: 'heather', weight: 10 }, { kind: 'stump', weight: 7 }, { kind: 'reeds', weight: 5 },
  ],
  elevation: {
    features: [
      { nx: .5, ny: .2, nw: .9, nh: .25, tier: 1 },
      { nx: .15, ny: .6, nw: .2, nh: .4, tier: 1 },
    ],
    ramps: [{ nx: .35, ny: .5, nx2: .45, ny2: .6, width: 70 }],
    noise: 7,
  },
  water: [
    { kind: 'lake', nx: .6, ny: .45, nrx: .3, nry: .35, depth: .9 }, // The Loch itself
    { kind: 'river', nx: 0, ny: 0, points: [[.6, .1], [.55, .3], [.5, .5]], width: 180, depth: .6 },
  ],
  roads: [
    { id: 'loch-road', main: true, width: 32, points: [
      [1200000,436000], [1235000,440000], [1250000,450000], [1213333,460000]] },
    { id: 'wetlands-pass', width: 26, points: [[1235000,440000], [1233333,420000]] },
  ],
  towns: [
    { name: 'Thelsamar', nx: .35, ny: .5, faction: 'alliance', tier: 'town' },
  ],
  camps: [
    { kind: 'camp', name: 'Mo\'grosh Stronghold', nx: .72, ny: .25, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'Stonesplinter Valley', nx: .35, ny: .8, members: ['brute', 'goblin'] },
    { kind: 'camp', name: 'Ironband\'s Excavation', nx: .65, ny: .65, members: ['goblin', 'brute'] },
    { kind: 'beastDen', name: 'Grizzlepaw Ridge', nx: .4, ny: .65, members: ['brute', 'hound'] },
    { kind: 'camp', name: 'South Gate Camp', nx: .2, ny: .2, members: ['brute', 'archer'] },
    { kind: 'watchtower', name: 'Thelsamar Guard Post', nx: .36, ny: .5, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
  ],
  spawns: [
    { kind: 'brute', weight: 28 }, { kind: 'goblin', weight: 20 }, { kind: 'stalker', weight: 20 },
    { kind: 'mireSpitter', weight: 14 }, { kind: 'hound', weight: 12 }, { kind: 'archer', weight: 6 },
  ],
  pois: [
    { name: 'Stonewrought Dam', kind: 'landmark', nx: .48, ny: .15, description: 'Dwarven dam holding back the Loch.' },
    { name: 'The Loch', kind: 'landmark', nx: .6, ny: .45, description: 'Great lake of Khaz Modan.' },
    { name: 'The Farstrider Lodge', kind: 'hamlet', nx: .82, ny: .62, description: 'Hunter lodge on the east shore.' },
    { name: 'Silver Stream Mine', kind: 'quarry', nx: .35, ny: .18, description: 'Kobold-overrun mine.' },
    { name: 'Valley of Kings', kind: 'landmark', nx: .25, ny: .75, description: 'Ancient dwarven monuments.' },
    { name: 'Algaz Station', kind: 'crossing', nx: .25, ny: .15, description: 'Station at the Dun Algaz pass.' },
    { name: 'Thelsamar Shore', kind: 'landmark', nx: .4, ny: .5, description: 'Lakeshore below the town.' },
  ],
  entrances: [],
});

defineZoneContent({
  id: 'searing-gorge',
  palette: 'volcanic gorge',
  props: [
    { kind: 'basalt', weight: 34 }, { kind: 'emberRock', weight: 24 }, { kind: 'charredTree', weight: 18 },
    { kind: 'rock', weight: 12 }, { kind: 'stump', weight: 7 }, { kind: 'tussock', weight: 5 },
  ],
  elevation: {
    features: [
      { nx: .5, ny: .5, nw: .8, nh: .7, tier: -1, kind: 'valley' }, // the gorge floor
      { nx: .2, ny: .2, nw: .3, nh: .3, tier: 1 },
      { nx: .8, ny: .7, nw: .3, nh: .4, tier: 1 },
    ],
    ramps: [
      { nx: .35, ny: .3, nx2: .45, ny2: .45, width: 60 },
      { nx: .6, ny: .6, nx2: .7, ny2: .75, width: 60 },
    ],
    noise: 8,
  },
  roads: [
    { id: 'gorge-road', main: true, width: 30, points: [
      [1155000,460000], [1161000,478000], [1167000,497500], [1160000,520000]] },
    { id: 'badlands-cut', width: 24, points: [[1167000,497500], [1200000,460000]] },
  ],
  towns: [
    { name: 'Thorium Point', nx: .35, ny: .3, faction: 'neutral', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Grimesilt Dig Site', nx: .62, ny: .6, members: ['archer', 'brute', 'caster'] },
    { kind: 'camp', name: 'The Cauldron', nx: .5, ny: .45, members: ['archer', 'brute'] },
    { kind: 'camp', name: 'Firewatch Ridge', nx: .25, ny: .3, members: ['emberAcolyte', 'caster'] },
    { kind: 'beastDen', name: 'The Slag Pit', nx: .45, ny: .55, members: ['brute', 'stalker'] },
    { kind: 'camp', name: 'Dustfire Valley', nx: .7, ny: .3, members: ['archer', 'caster'] },
  ],
  spawns: [
    { kind: 'emberAcolyte', weight: 26 }, { kind: 'archer', weight: 20 }, { kind: 'brute', weight: 20 },
    { kind: 'caster', weight: 14 }, { kind: 'stalker', weight: 12 }, { kind: 'ashColossus', weight: 8 },
  ],
  pois: [
    { name: 'The Cauldron', kind: 'landmark', nx: .5, ny: .45, description: 'Vast excavation pit of the Dark Irons.' },
    { name: 'Grimesilt Dig Site', kind: 'quarry', nx: .62, ny: .6, description: 'Dark Iron dig in the gorge floor.' },
    { name: 'The Sea of Cinders', kind: 'landmark', nx: .55, ny: .75, description: 'Ash flats in the south.' },
    { name: 'Firewatch Ridge', kind: 'landmark', nx: .25, ny: .3, description: 'Twilight\'s Hammer ridge.' },
    { name: 'Stonewrought Pass', kind: 'crossing', nx: .35, ny: .05, description: 'Locked pass to Loch Modan.' },
    { name: 'Tanner Camp', kind: 'camp', nx: .65, ny: .75, description: 'Thorium Brotherhood camp.' },
    { name: 'Blackchar Cave', kind: 'beastDen', nx: .25, ny: .75, description: 'Cave in the southwest wall.' },
  ],
  entrances: [],
});

defineZoneContent({
  id: 'badlands',
  palette: 'scorched badlands',
  props: [
    { kind: 'steppeStone', weight: 26 }, { kind: 'rock', weight: 24 }, { kind: 'dryGrass', weight: 18 },
    { kind: 'desertScrub', weight: 12 }, { kind: 'sandstone', weight: 10 }, { kind: 'thornBrush', weight: 6 }, { kind: 'sandstoneShard', weight: 4 },
  ],
  elevation: {
    features: [
      { nx: .3, ny: .3, nw: .4, nh: .3, tier: 1, kind: 'mesa' },
      { nx: .7, ny: .6, nw: .35, nh: .35, tier: 1, kind: 'mesa' },
      { nx: .5, ny: .8, nw: .5, nh: .2, tier: -1, kind: 'valley' },
    ],
    ramps: [{ nx: .45, ny: .3, nx2: .5, ny2: .45, width: 70 }],
    noise: 8,
  },
  roads: [
    { id: 'badlands-road', main: true, width: 30, points: [
      [1208000,487000], [1226667,490000], [1240000,482500], [1253333,475000]] },
    { id: 'uldaman-spur', width: 24, points: [[1226667,490000], [1236000,475000]] },
    { id: 'loch-pass', width: 26, points: [[1226667,490000], [1213333,460000]] },
    { id: 'gorge-cut', width: 24, points: [[1208000,487000], [1200000,467500]] },
  ],
  towns: [
    { name: 'Kargath', nx: .1, ny: .45, faction: 'horde', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Dustbelch Grotto', nx: .15, ny: .75, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'Camp Cagg', nx: .15, ny: .6, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'Camp Kosh', nx: .6, ny: .25, members: ['brute'] },
    { kind: 'camp', name: 'Camp Boff', nx: .6, ny: .7, members: ['brute'] },
    { kind: 'camp', name: 'Camp Wurg', nx: .15, ny: .3, members: ['brute'] },
    { kind: 'beastDen', name: 'Lethlor Ravine', nx: .75, ny: .5, members: ['stalker', 'emberAcolyte'] },
    { kind: 'watchtower', name: 'Kargath Guard Post', nx: .109, ny: .452, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'camp', name: 'Angor Rampart', nx: .45, ny: .4, faction: 'alliance', members: ['brute', 'archer', 'caster', 'stalker'] },
  ],
  spawns: [
    { kind: 'hound', weight: 26 }, { kind: 'brute', weight: 24 }, { kind: 'stalker', weight: 18 },
    { kind: 'archer', weight: 14 }, { kind: 'stormSentinel', weight: 10 }, { kind: 'duneScuttler', weight: 8 },
  ],
  pois: [
    { name: 'Uldaman', kind: 'landmark', nx: .45, ny: .25, description: 'Buried titan vault.' },
    { name: 'Hammertoe\'s Digsite', kind: 'quarry', nx: .52, ny: .3, description: 'Dwarven excavation near Uldaman.' },
    { name: 'Agmond\'s End', kind: 'quarry', nx: .5, ny: .6, description: 'Ruined digsite.' },
    { name: 'The Maker\'s Terrace', kind: 'landmark', nx: .48, ny: .3, description: 'Titan terrace outside Uldaman.' },
    { name: 'Angor Fortress', kind: 'watchtower', nx: .42, ny: .28, description: 'Dark Iron holdfast.' },
    { name: 'Mirage Flats', kind: 'landmark', nx: .35, ny: .7, description: 'Shimmering salt flats.' },
    { name: 'The Dustbowl', kind: 'landmark', nx: .3, ny: .45, description: 'Wind-scoured basin.' },
    { name: 'Valley of Fangs', kind: 'beastDen', nx: .45, ny: .55, description: 'Coyote and buzzard hunting ground.' },
    { name: 'Crypt of the Ancients', kind: 'graveyard', nx: .55, ny: .5, description: 'Trogg-infested barrow.' },
  ],
  entrances: [
    { name: 'Uldaman', nx: .45, ny: .25, levelMin: 36, levelMax: 44, kind: 'dungeon', theme: 'astral' },
  ],
});

defineZoneContent({
  id: 'burning-steppes',
  palette: 'ashen volcanic steppes',
  props: [
    { kind: 'charredTree', weight: 30 }, { kind: 'basalt', weight: 28 }, { kind: 'emberRock', weight: 20 },
    { kind: 'rock', weight: 12 }, { kind: 'stump', weight: 6 }, { kind: 'tussock', weight: 4 },
  ],
  elevation: {
    features: [
      { nx: .3, ny: .4, nw: .25, nh: .3, tier: 3, kind: 'mesa' }, // Blackrock Mountain
      { nx: .7, ny: .3, nw: .3, nh: .3, tier: 1 },
      { nx: .6, ny: .75, nw: .4, nh: .3, tier: 1 },
    ],
    ramps: [
      { nx: .3, ny: .55, nx2: .3, ny2: .45, width: 70 },
      { nx: .45, ny: .4, nx2: .55, ny2: .4, width: 70 },
    ],
    noise: 9,
  },
  roads: [
    { id: 'steppes-road', main: true, width: 32, points: [
      [1160000,520000], [1176000,532000], [1170000,540000], [1188000,548000], [1180000,560000]] },
    { id: 'blackrock-approach', width: 26, points: [[1170000,540000], [1158000,536000]] },
  ],
  towns: [
    { name: 'Morgan\'s Vigil', nx: .8, ny: .7, faction: 'alliance', tier: 'outpost' },
    { name: 'Flame Crest', nx: .6, ny: .3, faction: 'horde', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Dreadmaul Rock', nx: .78, ny: .42, members: ['brute', 'archer', 'caster'] },
    { kind: 'camp', name: 'Blackrock Stronghold', nx: .42, ny: .35, members: ['archer', 'brute', 'caster'] },
    { kind: 'camp', name: 'Pillar of Ash', nx: .45, ny: .55, members: ['archer', 'brute'] },
    { kind: 'beastDen', name: 'Terror Wing Path', nx: .82, ny: .3, members: ['emberAcolyte', 'stalker'] },
    { kind: 'camp', name: 'Ruins of Thaurissan', nx: .55, ny: .4, members: ['graveMarshal', 'caster'] },
    { kind: 'watchtower', name: 'Morgan\'s Vigil Guard Post', nx: .789, ny: .689, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Flame Crest Guard Post', nx: .594, ny: .317, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'camp', name: 'Morgan\'s Vigil Patrol', nx: .72, ny: .62, faction: 'alliance', members: ['brute', 'archer', 'caster', 'stalker'] },
    { kind: 'camp', name: 'Flame Crest Warband', nx: .52, ny: .38, faction: 'horde', members: ['brute', 'archer', 'caster', 'stalker'] },
  ],
  spawns: [
    { kind: 'archer', weight: 24 }, { kind: 'brute', weight: 22 }, { kind: 'emberAcolyte', weight: 18 },
    { kind: 'hound', weight: 14 }, { kind: 'caster', weight: 12 }, { kind: 'ashColossus', weight: 10 },
  ],
  pois: [
    { name: 'Blackrock Mountain', kind: 'landmark', nx: .3, ny: .4, description: 'Volcanic fortress mountain of the Dark Irons.' },
    { name: 'Altar of Storms', kind: 'shrine', nx: .12, ny: .3, description: 'Fel altar on the western edge.' },
    { name: 'Draco\'dar', kind: 'corruptedGrove', nx: .15, ny: .55, description: 'Scorched dragon grounds.' },
    { name: 'Slither Rock', kind: 'beastDen', nx: .88, ny: .55, description: 'Dragonkin cave in the east.' },
    { name: 'The Whelping Downs', kind: 'beastDen', nx: .85, ny: .6, description: 'Black whelp breeding grounds.' },
    { name: 'Ruins of Thaurissan', kind: 'ruinedChapel', nx: .55, ny: .4, description: 'Buried Dark Iron city.' },
    { name: 'Blackrock Pass', kind: 'crossing', nx: .65, ny: .85, description: 'Southern pass toward Redridge.' },
  ],
  entrances: [
    { name: 'Blackrock Depths', nx: .3, ny: .4, levelMin: 48, levelMax: 60, kind: 'dungeon', theme: 'blackrock' },
    { name: 'Lower Blackrock Spire', nx: .3, ny: .42, levelMin: 55, levelMax: 60, kind: 'dungeon', theme: 'blackrock' },
    { name: 'Upper Blackrock Spire', nx: .3, ny: .44, levelMin: 58, levelMax: 60, kind: 'raid', theme: 'blackrock' },
    { name: 'Molten Core', nx: .28, ny: .4, levelMin: 60, levelMax: 60, kind: 'raid', theme: 'blackrock' },
    { name: 'Blackwing Lair', nx: .32, ny: .42, levelMin: 60, levelMax: 60, kind: 'raid', theme: 'blackrock' },
  ],
});

// ── Azeroth (Stormwind lands) ────────────────────────────────────────────────

defineZoneContent({
  id: 'elwynn',
  palette: 'green forest',
  props: [
    { kind: 'tree', weight: 44 }, { kind: 'flowers', weight: 16 }, { kind: 'fern', weight: 12 },
    { kind: 'tussock', weight: 10 }, { kind: 'stump', weight: 8 }, { kind: 'mushrooms', weight: 6 }, { kind: 'rock', weight: 4 },
  ],
  water: [
    { kind: 'lake', nx: .3, ny: .65, nrx: .07, nry: .08, depth: .7 }, // Mirror Lake
    { kind: 'lake', nx: .58, ny: .68, nrx: .07, nry: .07, depth: .7 }, // Crystal Lake
    { kind: 'lake', nx: .62, ny: .32, nrx: .08, nry: .09, depth: .8 }, // Stone Cairn Lake
    { kind: 'lake', nx: .4, ny: .02, nrx: .4, nry: .06, depth: .9 }, // northern coast
    { kind: 'river', nx: 0, ny: 0, points: [[.1, .95], [.35, .9], [.6, .95], [.9, .92]], width: 220, depth: .7 }, // Nazferiti
  ],
  roads: [
    { id: 'elwynn-road', main: true, width: 40, points: [
      [1075000,569000], [1080000,580000], [1085000,596000], [1106667,598000], [1140000,590000]] },
    { id: 'westfall-road', width: 28, points: [[1085000,596000], [1056667,605000], [1040000,610000]] },
    { id: 'duskwood-road', width: 28, points: [[1085000,596000], [1016667,560000]] },
    { id: 'northshire-spur', width: 24, points: [[1080000,580000], [1098333,575000]] },
  ],
  towns: [
    { name: 'Stormwind City', nx: .35, ny: .15, faction: 'alliance', tier: 'capital' },
    { name: 'Goldshire', nx: .45, ny: .6, faction: 'alliance', tier: 'town' },
    { name: 'Northshire Abbey', nx: .55, ny: .4, faction: 'alliance', tier: 'village' },
    { name: 'Eastvale Logging Camp', nx: .8, ny: .65, faction: 'alliance', tier: 'village' },
    { name: 'Westbrook Garrison', nx: .25, ny: .72, faction: 'alliance', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Fargodeep Mine', nx: .4, ny: .78, members: ['goblin', 'brute'] },
    { kind: 'camp', name: 'Jasperlode Mine', nx: .6, ny: .5, members: ['goblin', 'brute'] },
    { kind: 'camp', name: 'Stone Cairn Camp', nx: .68, ny: .28, members: ['mireSpitter', 'archer'] },
    { kind: 'camp', name: 'Hogger Hill', nx: .28, ny: .82, members: ['brute', 'archer'] },
    { kind: 'beastDen', name: 'Forest\'s Edge', nx: .3, ny: .75, members: ['hound', 'stalker'] },
    { kind: 'camp', name: 'Brackwell Pumpkin Patch', nx: .7, ny: .78, members: ['archer', 'caster'] },
    { kind: 'watchtower', name: 'Stormwind City Guard Post', nx: .355, ny: .169, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Goldshire Guard Post', nx: .455, ny: .585, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Northshire Abbey Guard Post', nx: .545, ny: .415, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Eastvale Logging Camp Guard Post', nx: .791, ny: .642, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Westbrook Garrison Guard Post', nx: .256, ny: .712, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
  ],
  spawns: [
    { kind: 'hound', weight: 28 }, { kind: 'goblin', weight: 20 }, { kind: 'stalker', weight: 18 },
    { kind: 'archer', weight: 14 }, { kind: 'mireSpitter', weight: 12 }, { kind: 'brute', weight: 8 },
  ],
  pois: [
    { name: 'Stormwind Harbor', kind: 'landmark', nx: .28, ny: .1, description: 'Alliance fleet anchorage.' },
    { name: 'Deeprun Tram (Stormwind)', kind: 'landmark', nx: .4, ny: .16, description: 'Tram station in the Dwarven District.' },
    { name: 'Northshire Abbey', kind: 'chapel', nx: .55, ny: .4, description: 'Clerics\' abbey in the northern valley.' },
    { name: 'Mirror Lake Orchard', kind: 'landmark', nx: .3, ny: .65, description: 'Orchard on Mirror Lake\'s shore.' },
    { name: 'Crystal Lake', kind: 'landmark', nx: .58, ny: .68, description: 'Lake east of Goldshire.' },
    { name: 'Stone Cairn Lake', kind: 'landmark', nx: .62, ny: .32, description: 'Murloc-held lake in the northeast.' },
    { name: 'Heroes\' Vigil', kind: 'landmark', nx: .62, ny: .35, description: 'Island monument in Stone Cairn Lake.' },
    { name: 'Thunder Falls', kind: 'landmark', nx: .28, ny: .55, description: 'Waterfall on the western river.' },
    { name: 'Ridgepoint Tower', kind: 'watchtower', nx: .82, ny: .78, description: 'Watchtower on the Redridge border.' },
    { name: 'Tower of Azora', kind: 'watchtower', nx: .65, ny: .68, description: 'Mage tower east of Goldshire.' },
    { name: 'Maclure Vineyards', kind: 'hamlet', nx: .42, ny: .75, description: 'Vineyard south of Goldshire.' },
    { name: 'Stonefield Farm', kind: 'hamlet', nx: .35, ny: .78, description: 'Farm on the western river.' },
  ],
  entrances: [
    { name: 'The Stockade', nx: .38, ny: .18, levelMin: 22, levelMax: 30, kind: 'dungeon', theme: 'ossuary' },
  ],
});

defineZoneContent({
  id: 'westfall',
  palette: 'dry farmland',
  props: [
    { kind: 'dryGrass', weight: 40 }, { kind: 'tussock', weight: 20 }, { kind: 'thornBrush', weight: 12 },
    { kind: 'steppeStone', weight: 10 }, { kind: 'stump', weight: 8 }, { kind: 'deadTree', weight: 6 }, { kind: 'flowers', weight: 4 },
  ],
  water: [
    { kind: 'lake', nx: .02, ny: .5, nrx: .06, nry: .5, depth: .9 }, // western coast
    { kind: 'lake', nx: .5, ny: .97, nrx: .5, nry: .06, depth: .9 }, // southern coast
    { kind: 'river', nx: 0, ny: 0, points: [[.85, 0], [.8, .3], [.75, .6], [.7, .9]], width: 180, depth: .6 },
  ],
  roads: [
    { id: 'westfall-road', main: true, width: 34, points: [
      [1040000,610000], [1010000,570000], [1022000,587000], [1020000,605000], [1080000,620000]] },
    { id: 'moonbrook-spur', width: 26, points: [[1022000,587000], [1016000,605000]] },
    { id: 'redridge-road', width: 26, points: [[1022000,587000], [1040000,590000]] },
  ],
  towns: [
    { name: 'Sentinel Hill', nx: .55, ny: .45, faction: 'alliance', tier: 'outpost' },
    { name: 'Moonbrook', nx: .42, ny: .68, faction: 'hostile', tier: 'village' },
  ],
  camps: [
    { kind: 'camp', name: 'Jangolode Mine', nx: .45, ny: .2, members: ['goblin', 'brute'] },
    { kind: 'camp', name: 'Gold Coast Quarry', nx: .32, ny: .35, members: ['goblin', 'brute'] },
    { kind: 'camp', name: 'The Dagger Hills', nx: .45, ny: .8, members: ['archer', 'caster', 'brute'] },
    { kind: 'camp', name: 'Dead Acre', nx: .62, ny: .6, members: ['ashColossus'] },
    { kind: 'beastDen', name: 'The Dust Plains', nx: .6, ny: .75, members: ['brute', 'hound'] },
    { kind: 'camp', name: 'The Molsen Farm', nx: .45, ny: .38, members: ['archer', 'brute'] },
    { kind: 'watchtower', name: 'Sentinel Hill Guard Post', nx: .537, ny: .459, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
  ],
  spawns: [
    { kind: 'archer', weight: 26 }, { kind: 'brute', weight: 22 }, { kind: 'hound', weight: 18 },
    { kind: 'mireSpitter', weight: 12 }, { kind: 'ashColossus', weight: 12 }, { kind: 'goblin', weight: 10 },
  ],
  pois: [
    { name: 'Saldean\'s Farm', kind: 'hamlet', nx: .55, ny: .32, description: 'Working farm on the main road.' },
    { name: 'Furlbrow\'s Pumpkin Patch', kind: 'hamlet', nx: .5, ny: .2, description: 'Farm overrun by Defias.' },
    { name: 'Alexston Farmstead', kind: 'hamlet', nx: .38, ny: .52, description: 'Farmstead west of Sentinel Hill.' },
    { name: 'The Jansen Stead', kind: 'hamlet', nx: .58, ny: .15, description: 'Northern farmstead.' },
    { name: 'Demont\'s Place', kind: 'hamlet', nx: .35, ny: .65, description: 'Abandoned homestead.' },
    { name: 'Westfall Lighthouse', kind: 'landmark', nx: .3, ny: .85, description: 'Lighthouse on the southern shore.' },
    { name: 'The Raging Chasm', kind: 'landmark', nx: .4, ny: .45, description: 'Torn earth west of Sentinel Hill.' },
    { name: 'Mortwake\'s Tower', kind: 'watchtower', nx: .7, ny: .72, description: 'Tower above the southeast cliffs.' },
    { name: 'The Dead Acre', kind: 'corruptedGrove', nx: .62, ny: .6, description: 'Scorched field of rogue harvest golems.' },
    { name: 'Longshore', kind: 'landmark', nx: .28, ny: .6, description: 'Murloc-infested coastline.' },
  ],
  entrances: [
    { name: 'The Deadmines', nx: .4, ny: .75, levelMin: 15, levelMax: 21, kind: 'dungeon', theme: 'foundry' },
  ],
});

defineZoneContent({
  id: 'redridge',
  palette: 'red mountain ridges',
  props: [
    { kind: 'autumnTree', weight: 30 }, { kind: 'steppeStone', weight: 20 }, { kind: 'rock', weight: 18 },
    { kind: 'tussock', weight: 14 }, { kind: 'leafPile', weight: 8 }, { kind: 'stump', weight: 6 }, { kind: 'heather', weight: 4 },
  ],
  elevation: {
    features: [
      { nx: .5, ny: .2, nw: .9, nh: .25, tier: 1 },
      { nx: .8, ny: .5, nw: .3, nh: .5, tier: 2, kind: 'mesa' }, // Stonewatch rise
      { nx: .2, ny: .8, nw: .3, nh: .25, tier: 1 },
    ],
    ramps: [{ nx: .3, ny: .55, nx2: .45, ny2: .5, width: 70 }],
    noise: 8,
  },
  water: [
    { kind: 'lake', nx: .62, ny: .55, nrx: .3, nry: .3, depth: .85 }, // Lake Everstill
    { kind: 'river', nx: 0, ny: 0, points: [[.6, .55], [.5, .7], [.4, .9]], width: 180, depth: .6 },
  ],
  roads: [
    { id: 'redridge-road', main: true, width: 34, points: [
      [1140000,582500], [1164000,593000], [1193333,596000], [1240000,657500]] },
    { id: 'lakeshire-crossing', width: 26, points: [[1164000,593000], [1186667,620000]] },
    { id: 'burning-pass', width: 26, points: [[1180000,582500], [1180000,560000]] },
  ],
  towns: [
    { name: 'Lakeshire', nx: .3, ny: .55, faction: 'alliance', tier: 'town' },
  ],
  camps: [
    { kind: 'camp', name: 'Stonewatch Keep', nx: .62, ny: .5, members: ['archer', 'brute', 'caster'] },
    { kind: 'camp', name: 'Render\'s Valley', nx: .68, ny: .7, members: ['archer', 'brute'] },
    { kind: 'camp', name: 'Render\'s Camp', nx: .35, ny: .2, members: ['archer', 'brute'] },
    { kind: 'camp', name: 'Redridge Canyons', nx: .3, ny: .3, members: ['brute', 'archer'] },
    { kind: 'beastDen', name: 'Rethban Caverns', nx: .2, ny: .25, members: ['goblin', 'stalker'] },
    { kind: 'camp', name: 'Galardell Valley', nx: .75, ny: .45, members: ['archer', 'caster'] },
    { kind: 'watchtower', name: 'Lakeshire Guard Post', nx: .312, ny: .546, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
  ],
  spawns: [
    { kind: 'brute', weight: 26 }, { kind: 'archer', weight: 22 }, { kind: 'mireSpitter', weight: 16 },
    { kind: 'stalker', weight: 16 }, { kind: 'hound', weight: 12 }, { kind: 'caster', weight: 8 },
  ],
  pois: [
    { name: 'Lake Everstill', kind: 'landmark', nx: .62, ny: .55, description: 'Great lake east of Lakeshire.' },
    { name: 'Everstill Bridge', kind: 'crossing', nx: .4, ny: .55, description: 'Bridge into Lakeshire.' },
    { name: 'Tower of Ilgalar', kind: 'watchtower', nx: .78, ny: .38, description: 'Mage tower in the eastern hills.' },
    { name: 'Alther\'s Mill', kind: 'hamlet', nx: .48, ny: .42, description: 'Mill east of town.' },
    { name: 'Three Corners', kind: 'crossing', nx: .15, ny: .55, description: 'Junction toward Duskwood and Elwynn.' },
    { name: 'Stonewatch Falls', kind: 'landmark', nx: .7, ny: .55, description: 'Falls below Stonewatch Keep.' },
    { name: 'Lakeridge Highway', kind: 'landmark', nx: .45, ny: .7, description: 'Old highway along the lake.' },
    { name: 'Shalewind Canyon', kind: 'landmark', nx: .78, ny: .62, description: 'Wind-cut canyon in the east.' },
    { name: 'Stonewatch', kind: 'watchtower', nx: .6, ny: .5, description: 'Orc-held keep and tower.' },
  ],
  entrances: [],
});

defineZoneContent({
  id: 'swamp-of-sorrows',
  palette: 'murky swamp',
  props: [
    { kind: 'willow', weight: 30 }, { kind: 'reeds', weight: 24 }, { kind: 'mushrooms', weight: 16 },
    { kind: 'lilies', weight: 12 }, { kind: 'deadTree', weight: 10 }, { kind: 'stump', weight: 5 }, { kind: 'fern', weight: 3 },
  ],
  water: [
    { kind: 'lake', nx: .7, ny: .55, nrx: .14, nry: .18, depth: .85 }, // Pool of Tears
    { kind: 'lake', nx: .3, ny: .3, nrx: .12, nry: .12, depth: .7 },
    { kind: 'river', nx: 0, ny: 0, points: [[0, .4], [.3, .45], [.6, .5], [1, .55]], width: 240, depth: .7 },
  ],
  roads: [
    { id: 'sorrows-road', main: true, width: 32, points: [
      [1240000,657500], [1285000,653000], [1290000,672500], [1270000,680000]] },
    { id: 'temple-causeway', width: 24, points: [[1285000,653000], [1310000,653000]] },
  ],
  towns: [
    { name: 'Stonard', nx: .45, ny: .55, faction: 'horde', tier: 'town' },
    { name: 'The Harborage', nx: .28, ny: .35, faction: 'alliance', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Fallow Sanctuary', nx: .6, ny: .25, members: ['brute', 'caster'] },
    { kind: 'camp', name: 'Misty Valley', nx: .2, ny: .6, members: ['stalker', 'wisp'] },
    { kind: 'camp', name: 'Sorrowmurk', nx: .82, ny: .4, members: ['brute', 'archer'] },
    { kind: 'beastDen', name: 'The Shifting Mire', nx: .4, ny: .4, members: ['stalker', 'mireSpitter'] },
    { kind: 'camp', name: 'Lost One Camp', nx: .65, ny: .65, members: ['brute', 'caster'] },
    { kind: 'watchtower', name: 'Stonard Guard Post', nx: .457, ny: .538, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'The Harborage Guard Post', nx: .286, ny: .357, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'camp', name: 'Stonard Warband', nx: .5, ny: .62, faction: 'horde', members: ['brute', 'archer', 'caster', 'stalker'] },
    { kind: 'camp', name: 'Harborage Patrol', nx: .34, ny: .42, faction: 'alliance', members: ['brute', 'archer', 'caster', 'stalker'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 28 }, { kind: 'mireSpitter', weight: 26 }, { kind: 'brute', weight: 18 },
    { kind: 'caster', weight: 14 }, { kind: 'hound', weight: 8 }, { kind: 'wisp', weight: 6 },
  ],
  pois: [
    { name: 'Pool of Tears', kind: 'landmark', nx: .7, ny: .55, description: 'Sunken lake holding the Temple of Atal\'Hakkar.' },
    { name: 'Misty Reed Strand', kind: 'landmark', nx: .85, ny: .85, description: 'Foggy eastern shore.' },
    { name: 'Itharius\'s Cave', kind: 'beastDen', nx: .15, ny: .5, description: 'Green dragonkin refuge.' },
    { name: 'Splinterspear Junction', kind: 'crossing', nx: .35, ny: .5, description: 'Crossroads west of Stonard.' },
    { name: 'Stagalbog', kind: 'landmark', nx: .68, ny: .75, description: 'Deep mire in the southeast.' },
    { name: 'Purespring Cavern', kind: 'beastDen', nx: .2, ny: .7, description: 'Cave of clear water.' },
    { name: 'Marshtide Watch', kind: 'watchtower', nx: .55, ny: .75, description: 'Alliance watch over the swamp.' },
    { name: 'The Bloodmire', kind: 'corruptedGrove', nx: .5, ny: .3, description: 'Fel-tainted bog.' },
  ],
  entrances: [
    { name: 'Temple of Atal\'Hakkar', nx: .7, ny: .55, levelMin: 50, levelMax: 60, kind: 'dungeon', theme: 'drowned' },
  ],
});

defineZoneContent({
  id: 'duskwood',
  palette: 'haunted dark forest',
  props: [
    { kind: 'deadTree', weight: 42 }, { kind: 'tree', weight: 14 }, { kind: 'mushrooms', weight: 14 },
    { kind: 'stump', weight: 12 }, { kind: 'tussock', weight: 8 }, { kind: 'fern', weight: 6 }, { kind: 'rock', weight: 4 },
  ],
  water: [
    { kind: 'river', nx: 0, ny: 0, points: [[.1, .02], [.4, .05], [.7, .03], [1, .06]], width: 220, depth: .7 }, // Nazferiti
    { kind: 'lake', nx: .5, ny: .6, nrx: .06, nry: .07, depth: .6 }, // Forlorn Rowe pond
  ],
  roads: [
    { id: 'duskwood-road', main: true, width: 34, points: [
      [1066667,620000], [1093333,635000], [1120000,647000], [1146667,650000], [1160000,665000]] },
    { id: 'raven-hill-road', width: 28, points: [[1120000,647000], [1080000,652000], [1032000,653000], [1000000,655000]] },
    { id: 'stranglethorn-road', width: 28, points: [[1080000,652000], [1042000,680000]] },
  ],
  towns: [
    { name: 'Darkshire', nx: .75, ny: .45, faction: 'alliance', tier: 'town' },
    { name: 'Raven Hill', nx: .2, ny: .55, faction: 'alliance', tier: 'village' },
  ],
  camps: [
    { kind: 'camp', name: 'Vul\'Gol Ogre Mound', nx: .35, ny: .7, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'The Rotting Orchard', nx: .62, ny: .72, members: ['stalker', 'brute'] },
    { kind: 'camp', name: 'Nightbane Camp', nx: .6, ny: .5, members: ['stalker', 'brute'] },
    { kind: 'graveyard', name: 'Raven Hill Cemetery', nx: .22, ny: .42, members: ['graveMarshal', 'caster', 'wisp'] },
    { kind: 'graveyard', name: 'Tranquil Gardens', nx: .78, ny: .7, members: ['graveMarshal', 'wisp'] },
    { kind: 'beastDen', name: 'The Darkened Bank', nx: .55, ny: .25, members: ['stalker', 'hound'] },
    { kind: 'watchtower', name: 'Darkshire Guard Post', nx: .744, ny: .453, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Raven Hill Guard Post', nx: .206, ny: .547, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 28 }, { kind: 'graveMarshal', weight: 24 }, { kind: 'hound', weight: 18 },
    { kind: 'brute', weight: 14 }, { kind: 'caster', weight: 10 }, { kind: 'wisp', weight: 6 },
  ],
  pois: [
    { name: 'Twilight Grove', kind: 'portal', nx: .48, ny: .35, description: 'Emerald Dream portal in the central grove.' },
    { name: 'Raven Hill Cemetery', kind: 'graveyard', nx: .22, ny: .42, description: 'Sprawling haunted graveyard.' },
    { name: 'Beggar\'s Haunt', kind: 'ruinedChapel', nx: .85, ny: .3, description: 'Ruined tower east of Darkshire.' },
    { name: 'Manor Mistmantle', kind: 'ruinedChapel', nx: .78, ny: .35, description: 'Worgen-infested manor.' },
    { name: 'Yorgen Farmstead', kind: 'hamlet', nx: .5, ny: .75, description: 'Abandoned farm in the south woods.' },
    { name: 'Addle\'s Stead', kind: 'hamlet', nx: .25, ny: .7, description: 'Defias-held farmstead.' },
    { name: 'The Hushed Bank', kind: 'landmark', nx: .1, ny: .45, description: 'Spider-infested western bank.' },
    { name: 'Forlorn Rowe', kind: 'landmark', nx: .5, ny: .6, description: 'Still pond in the deep woods.' },
    { name: 'The Yorgen Farm', kind: 'corruptedGrove', nx: .52, ny: .72, description: 'Cursed fields.' },
    { name: 'Darkshire Town Hall', kind: 'landmark', nx: .75, ny: .47, description: 'Seat of the Night Watch.' },
    { name: 'Deadwind Crossing', kind: 'crossing', nx: .95, ny: .45, description: 'Eastern pass into Deadwind.' },
  ],
  entrances: [],
});

defineZoneContent({
  id: 'deadwind',
  palette: 'dead canyon pass',
  props: [
    { kind: 'deadTree', weight: 44 }, { kind: 'rock', weight: 20 }, { kind: 'stump', weight: 12 },
    { kind: 'mushrooms', weight: 10 }, { kind: 'tussock', weight: 8 }, { kind: 'charredTree', weight: 6 },
  ],
  elevation: {
    features: [
      { nx: .5, ny: .5, nw: .7, nh: .6, tier: -1, kind: 'valley' }, // the pass floor
      { nx: .15, ny: .3, nw: .25, nh: .5, tier: 2 },
      { nx: .85, ny: .4, nw: .25, nh: .5, tier: 2 },
      { nx: .45, ny: .75, nw: .2, nh: .2, tier: 1, kind: 'mesa' }, // Karazhan rise
    ],
    ramps: [
      { nx: .3, ny: .4, nx2: .45, ny2: .6, width: 60 },
      { nx: .45, ny: .65, nx2: .45, ny2: .75, width: 60 },
    ],
    noise: 9,
  },
  roads: [
    { id: 'deadwind-pass', main: true, width: 30, points: [
      [1160000,665000], [1186667,657500], [1196000,665000], [1240000,660000]] },
  ],
  towns: [],
  camps: [
    { kind: 'camp', name: 'Ariden\'s Camp', nx: .52, ny: .35, members: ['archer', 'caster', 'brute'] },
    { kind: 'camp', name: 'Deadwind Ogre Mound', nx: .35, ny: .55, members: ['brute'] },
    { kind: 'graveyard', name: 'Morgan\'s Plot', nx: .42, ny: .68, members: ['graveMarshal', 'wisp'] },
    { kind: 'beastDen', name: 'The Vice', nx: .55, ny: .6, members: ['stalker', 'hound'] },
  ],
  spawns: [
    { kind: 'wisp', weight: 24 }, { kind: 'caster', weight: 20 }, { kind: 'stalker', weight: 20 },
    { kind: 'hound', weight: 14 }, { kind: 'brute', weight: 12 }, { kind: 'graveMarshal', weight: 10 },
  ],
  pois: [
    { name: 'Karazhan', kind: 'landmark', nx: .45, ny: .75, description: 'Medivh\'s haunted tower at the pass\'s end.' },
    { name: 'Deadman\'s Crossing', kind: 'crossing', nx: .45, ny: .4, description: 'Fork in the dead road.' },
    { name: 'The Vice', kind: 'beastDen', nx: .55, ny: .6, description: 'Narrow cleft of carrion birds.' },
    { name: 'Morgan\'s Plot', kind: 'graveyard', nx: .42, ny: .68, description: 'Forgotten graveyard below Karazhan.' },
    { name: 'The Master\'s Cellar', kind: 'necropolis', nx: .4, ny: .78, description: 'Cellar complex beneath the tower.' },
    { name: 'Abandoned Kirin Tor Camp', kind: 'camp', nx: .48, ny: .7, description: 'Empty mage camp at the tower gate.' },
    { name: 'Sleeping Gorge', kind: 'landmark', nx: .6, ny: .45, description: 'Narrow eastern gorge.' },
  ],
  entrances: [
    { name: 'Karazhan', nx: .45, ny: .75, levelMin: 70, levelMax: 70, kind: 'raid', theme: 'astral' },
  ],
});

defineZoneContent({
  id: 'blasted-lands',
  palette: 'fel-scorched wastes',
  props: [
    { kind: 'basalt', weight: 30 }, { kind: 'charredTree', weight: 22 }, { kind: 'emberRock', weight: 18 },
    { kind: 'deadTree', weight: 12 }, { kind: 'rock', weight: 10 }, { kind: 'desertScrub', weight: 8 },
  ],
  elevation: {
    features: [
      { nx: .55, ny: .85, nw: .3, nh: .2, tier: 1, kind: 'mesa' }, // Dark Portal rise
      { nx: .2, ny: .5, nw: .3, nh: .4, tier: 1 },
    ],
    ramps: [{ nx: .55, ny: .7, nx2: .55, ny2: .85, width: 80 }],
    noise: 8,
  },
  water: [
    { kind: 'lake', nx: .5, ny: .98, nrx: .5, nry: .05, depth: .9 }, // southern coast
    { kind: 'lake', nx: .15, ny: .6, nrx: .06, nry: .08, depth: .6 }, // Tainted Scar pool
  ],
  roads: [
    { id: 'blasted-road', main: true, width: 34, points: [
      [1270000,680000], [1285000,688000], [1300000,692000], [1295000,715000], [1295000,731000]] },
  ],
  towns: [
    { name: 'Nethergarde Keep', nx: .6, ny: .2, faction: 'alliance', tier: 'town' },
  ],
  camps: [
    { kind: 'camp', name: 'Dreadmaul Hold', nx: .42, ny: .15, members: ['brute', 'archer', 'caster'] },
    { kind: 'camp', name: 'Dreadmaul Post', nx: .45, ny: .5, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'Rise of the Defiler', nx: .48, ny: .45, members: ['emberAcolyte', 'caster'] },
    { kind: 'beastDen', name: 'The Tainted Scar', nx: .35, ny: .55, members: ['emberAcolyte', 'brute'] },
    { kind: 'camp', name: 'Serpent\'s Coil', nx: .58, ny: .35, members: ['caster', 'archer'] },
    { kind: 'watchtower', name: 'Nethergarde Keep Guard Post', nx: .597, ny: .216, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'camp', name: 'Dreadmaul Warband', nx: .45, ny: .55, faction: 'horde', members: ['brute', 'archer', 'caster', 'stalker'] },
  ],
  spawns: [
    { kind: 'emberAcolyte', weight: 26 }, { kind: 'brute', weight: 22 }, { kind: 'duneScuttler', weight: 16 },
    { kind: 'hound', weight: 14 }, { kind: 'caster', weight: 12 }, { kind: 'archer', weight: 10 },
  ],
  pois: [
    { name: 'The Dark Portal', kind: 'portal', nx: .55, ny: .85, description: 'Gateway to Outland.' },
    { name: 'The Tainted Scar', kind: 'corruptedGrove', nx: .35, ny: .55, description: 'Fel-corrupted western scar.' },
    { name: 'Altar of Storms', kind: 'shrine', nx: .4, ny: .3, description: 'Fel altar of the old Horde.' },
    { name: 'The Red Reaches', kind: 'landmark', nx: .65, ny: .75, description: 'Blood-cursed shoreline.' },
    { name: 'Nethergarde Mines', kind: 'quarry', nx: .62, ny: .15, description: 'Mines below the keep.' },
    { name: 'Shattered Landing', kind: 'landmark', nx: .72, ny: .5, description: 'Broken eastern shore.' },
    { name: 'Sunveil Excursion', kind: 'camp', nx: .5, ny: .7, description: 'Reliquary dig camp.' },
    { name: 'Surwich', kind: 'hamlet', nx: .45, ny: .85, description: 'Gilnean fishing village on the south coast.' },
  ],
  entrances: [],
});

defineZoneContent({
  id: 'stranglethorn',
  palette: 'dense jungle',
  props: [
    { kind: 'canopy', weight: 38 }, { kind: 'fern', weight: 20 }, { kind: 'tree', weight: 14 },
    { kind: 'reeds', weight: 10 }, { kind: 'mushrooms', weight: 8 }, { kind: 'lilies', weight: 6 }, { kind: 'stump', weight: 4 },
  ],
  water: [
    { kind: 'lake', nx: .5, ny: .98, nrx: .5, nry: .05, depth: .9 }, // southern coast
    { kind: 'lake', nx: .02, ny: .5, nrx: .05, nry: .5, depth: .9 }, // western coast / Vile Reef
    { kind: 'lake', nx: .5, ny: .2, nrx: .08, nry: .1, depth: .7 }, // Lake Nazferiti
    { kind: 'river', nx: 0, ny: 0, points: [[.5, .05], [.5, .2], [.45, .4], [.4, .6]], width: 200, depth: .6 },
  ],
  roads: [
    { id: 'stranglethorn-road', main: true, width: 34, points: [
      [1042000,680000], [1056000,690000], [1049000,710000], [1044800,742500], [1042000,765000]] },
    { id: 'zulgurub-spur', width: 26, points: [[1049000,710000], [1070000,712500], [1091000,715000]] },
  ],
  towns: [
    { name: 'Booty Bay', nx: .3, ny: .85, faction: 'neutral', tier: 'town' },
    { name: 'Grom\'gol Base Camp', nx: .35, ny: .3, faction: 'horde', tier: 'outpost' },
    { name: 'Rebel Camp', nx: .4, ny: .1, faction: 'alliance', tier: 'outpost' },
    { name: 'Nesingwary\'s Expedition', nx: .35, ny: .15, faction: 'neutral', tier: 'outpost' },
  ],
  camps: [
    { kind: 'camp', name: 'Kurzen\'s Compound', nx: .48, ny: .12, members: ['archer', 'brute', 'caster'] },
    { kind: 'camp', name: 'Venture Co. Base Camp', nx: .55, ny: .12, members: ['goblin', 'goblinChief', 'brute'] },
    { kind: 'camp', name: 'Zul\'Kunda', nx: .52, ny: .28, members: ['archer', 'brute', 'caster'] },
    { kind: 'camp', name: 'Zul\'Mamwe', nx: .6, ny: .6, members: ['archer', 'brute', 'caster'] },
    { kind: 'camp', name: 'Mosh\'Ogg Ogre Mound', nx: .62, ny: .5, members: ['brute', 'archer'] },
    { kind: 'camp', name: 'Bloodsail Compound', nx: .28, ny: .75, members: ['archer', 'brute', 'caster'] },
    { kind: 'beastDen', name: 'The Crystalvein Mine', nx: .42, ny: .5, members: ['stalker', 'mireSpitter'] },
    { kind: 'camp', name: 'Ziata\'jai Ruins', nx: .45, ny: .4, members: ['archer', 'caster'] },
    { kind: 'watchtower', name: 'Grom\'gol Base Camp Guard Post', nx: .353, ny: .306, faction: 'horde', members: ['brute', 'archer', 'brute'] },
    { kind: 'watchtower', name: 'Rebel Camp Guard Post', nx: .401, ny: .107, faction: 'alliance', members: ['brute', 'archer', 'brute'] },
    { kind: 'camp', name: 'Grom\'gol Warband', nx: .4, ny: .36, faction: 'horde', members: ['brute', 'archer', 'caster', 'stalker'] },
    { kind: 'camp', name: 'Rebel Patrol', nx: .44, ny: .18, faction: 'alliance', members: ['brute', 'archer', 'caster', 'stalker'] },
  ],
  spawns: [
    { kind: 'stalker', weight: 30 }, { kind: 'brute', weight: 20 }, { kind: 'archer', weight: 18 },
    { kind: 'caster', weight: 12 }, { kind: 'mireSpitter', weight: 10 }, { kind: 'goblin', weight: 6 }, { kind: 'hound', weight: 4 },
  ],
  pois: [
    { name: 'Booty Bay Dock', kind: 'landmark', nx: .28, ny: .88, description: 'Steamwheedle harbor on the southern cape.' },
    { name: 'Grom\'gol Zeppelin Tower', kind: 'landmark', nx: .33, ny: .28, description: 'Horde zeppelin tower.' },
    { name: 'Gurubashi Arena', kind: 'bossLair', nx: .32, ny: .5, description: 'Free-for-all fighting pit.' },
    { name: 'The Vile Reef', kind: 'landmark', nx: .25, ny: .3, description: 'Murloc reef off the west coast.' },
    { name: 'Lake Nazferiti', kind: 'landmark', nx: .5, ny: .2, description: 'Jungle lake in the north.' },
    { name: 'Bal\'lal Ruins', kind: 'ruinedChapel', nx: .32, ny: .4, description: 'Troll ruins on the west shore.' },
    { name: 'Kal\'ai Ruins', kind: 'ruinedChapel', nx: .42, ny: .42, description: 'Troll ruins east of the road.' },
    { name: 'Mizjah Ruins', kind: 'ruinedChapel', nx: .47, ny: .35, description: 'Troll ruins southeast of Grom\'gol.' },
    { name: 'Tkashi Ruins', kind: 'ruinedChapel', nx: .35, ny: .38, description: 'Troll ruins west of the road.' },
    { name: 'Balia\'mah Ruins', kind: 'ruinedChapel', nx: .5, ny: .55, description: 'Troll ruins in the central jungle.' },
    { name: 'Ruins of Jubuwal', kind: 'ruinedChapel', nx: .55, ny: .5, description: 'Troll ruins east of the road.' },
    { name: 'Ruins of Aboraz', kind: 'ruinedChapel', nx: .4, ny: .6, description: 'Troll ruins on the southern shore.' },
    { name: 'Jaguero Isle', kind: 'beastDen', nx: .5, ny: .85, description: 'Panther isle off the south coast.' },
    { name: 'The Wild Shore', kind: 'landmark', nx: .45, ny: .8, description: 'Southern shoreline.' },
    { name: 'Janeiro\'s Point', kind: 'landmark', nx: .35, ny: .62, description: 'Cape west of Booty Bay.' },
    { name: 'The Cape of Stranglethorn', kind: 'landmark', nx: .3, ny: .9, description: 'Southern tip of the vale.' },
    { name: 'Spirit Den', kind: 'corruptedGrove', nx: .52, ny: .7, description: 'Haunted troll shrine.' },
  ],
  entrances: [
    { name: 'Zul\'Gurub', nx: .65, ny: .35, levelMin: 60, levelMax: 60, kind: 'raid', theme: 'rootbound' },
  ],
});
