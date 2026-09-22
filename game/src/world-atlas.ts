/** WoW WotLK world atlas — the single authoritative contract pinning every zone to an
 * exact rectangle in world space (wayfinder world-t01). Continent teams build content
 * INSIDE these fixed rects; nothing here moves once merged.
 *
 * Coordinates are world pixels. ATLAS_SCALE maps WoW yards → game units so travel times
 * match WoW: the player runs ~165 u/s and WoW runs ~7 yd/s, so 1 yard ≈ 23.6 units (24).
 * A ~1.1 km WoW zone is ~26,000 units across; a continent spans ~300,000+ units, so a
 * long cross-continent journey stays a real journey.
 *
 * Each continent owns a disjoint coordinate region separated by ocean. Zone rects are
 * authored in continent-local coordinates and offset by the continent origin. Zone
 * content (cities/dungeons/docks/flightpaths) is normalized 0..1 inside the rect. */

// ── Scale ────────────────────────────────────────────────────────────────────
export const ATLAS_SCALE = 24;
export const YARDS_PER_UNIT = 1 / ATLAS_SCALE;

// ── Factions / continents ────────────────────────────────────────────────────
export type FactionId = 'alliance' | 'horde' | 'neutral' | 'contested' | 'hostile';
export type ContinentId = 'kalimdor' | 'eastern-kingdoms' | 'northrend' | 'outland';

export interface AtlasPoint { readonly x: number; readonly y: number }
export interface AtlasRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

export interface AtlasCity { readonly name: string; readonly faction: FactionId; readonly nx: number; readonly ny: number; readonly tier: 'capital' | 'town' | 'village' | 'outpost' }
export interface AtlasDungeon { readonly name: string; readonly nx: number; readonly ny: number; readonly levelMin: number; readonly levelMax: number; readonly kind: 'dungeon' | 'raid' }
export interface AtlasDock { readonly name: string; readonly faction: FactionId; readonly nx: number; readonly ny: number; readonly routes: readonly string[] }
export interface AtlasFlightPath { readonly name: string; readonly faction: FactionId; readonly nx: number; readonly ny: number }

export interface AtlasZone {
  readonly id: string; readonly name: string; readonly continent: ContinentId;
  readonly rect: AtlasRect; readonly levelMin: number; readonly levelMax: number;
  readonly faction: FactionId; readonly terrain: string;
  readonly borders: { readonly north: string | null; readonly south: string | null; readonly east: string | null; readonly west: string | null };
  readonly cities: readonly AtlasCity[]; readonly dungeons: readonly AtlasDungeon[];
  readonly docks: readonly AtlasDock[]; readonly flightpaths: readonly AtlasFlightPath[];
}
export interface AtlasContinent { readonly id: ContinentId; readonly name: string; readonly origin: AtlasPoint; readonly bounds: AtlasRect }

export type TransportKind = 'ship' | 'zeppelin' | 'portal' | 'flightpath' | 'turtle' | 'tram';
export interface AtlasTransport {
  readonly id: string; readonly kind: TransportKind;
  readonly from: { readonly continent: ContinentId; readonly zone: string; readonly dock: string };
  readonly to: { readonly continent: ContinentId; readonly zone: string; readonly dock: string };
  readonly durationSec: number; readonly faction: FactionId;
}

const CONTINENT_GAP = 1_000_000;
export const CONTINENTS: Readonly<Record<ContinentId, AtlasContinent>> = Object.freeze({
  'kalimdor':         Object.freeze({ id: 'kalimdor',         name: 'Kalimdor',         origin: { x: 0,             y: 0 },             bounds: { x: 0, y: 0, w: 0, h: 0 } }),
  'eastern-kingdoms': Object.freeze({ id: 'eastern-kingdoms', name: 'Eastern Kingdoms', origin: { x: CONTINENT_GAP, y: 0 },             bounds: { x: 0, y: 0, w: 0, h: 0 } }),
  'northrend':        Object.freeze({ id: 'northrend',        name: 'Northrend',        origin: { x: 0,             y: CONTINENT_GAP }, bounds: { x: 0, y: 0, w: 0, h: 0 } }),
  'outland':          Object.freeze({ id: 'outland',          name: 'Outland',          origin: { x: CONTINENT_GAP, y: CONTINENT_GAP }, bounds: { x: 0, y: 0, w: 0, h: 0 } }),
});

// ── Zone table ───────────────────────────────────────────────────────────────
// Authored continent-local rects (units), validated non-overlapping by
// wayfinder/merge-atlas.mjs. Positions are FIXED — continent teams build content
// inside these rects and never move them.
function zone(id: string, name: string, continent: ContinentId, x: number, y: number, w: number, h: number,
  levelMin: number, levelMax: number, faction: FactionId, terrain: string,
  extra?: Partial<Pick<AtlasZone, 'borders' | 'cities' | 'dungeons' | 'docks' | 'flightpaths'>>): AtlasZone {
  return Object.freeze({
    id, name, continent, rect: Object.freeze({ x, y, w, h }), levelMin, levelMax, faction, terrain,
    borders: Object.freeze({ north: null, south: null, east: null, west: null, ...(extra?.borders ?? {}) }),
    cities: Object.freeze(extra?.cities ?? []), dungeons: Object.freeze(extra?.dungeons ?? []),
    docks: Object.freeze(extra?.docks ?? []), flightpaths: Object.freeze(extra?.flightpaths ?? []),
  });
}

export const ZONES: Readonly<Record<string, AtlasZone>> = Object.freeze({
// [GENERATED:ZONES]
  'teldrassil': zone('teldrassil','Teldrassil','kalimdor', 0,20000,60000,40000, 1,10, 'alliance','purple world-tree forest', {borders:{north:null,south:null,east:null,west:null},cities:[{name:'Darnassus',faction:'alliance',nx:0.35,ny:0.28,tier:'capital'},{name:'Dolanaar',faction:'alliance',nx:0.55,ny:0.55,tier:'town'},{name:'Rut\'theran Village',faction:'alliance',nx:0.55,ny:0.92,tier:'town'}],dungeons:[],docks:[{name:'Rut\'theran Village Dock',faction:'alliance',nx:0.55,ny:0.96,routes:[]}],flightpaths:[{name:'Darnassus',faction:'alliance',nx:0.35,ny:0.28},{name:'Rut\'theran Village',faction:'alliance',nx:0.55,ny:0.92}]}),
  'bloodmyst': zone('bloodmyst','Bloodmyst Isle','kalimdor', 0,100000,60000,40000, 10,20, 'alliance','corrupted red-crystal isle', {borders:{north:null,south:'azuremyst',east:null,west:null},cities:[{name:'Blood Watch',faction:'alliance',nx:0.5,ny:0.5,tier:'town'},{name:'Vindicator\'s Rest',faction:'alliance',nx:0.3,ny:0.55,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Blood Watch',faction:'alliance',nx:0.5,ny:0.5}]}),
  'azuremyst': zone('azuremyst','Azuremyst Isle','kalimdor', 0,140000,60000,60000, 1,10, 'alliance','crystalline pine isle', {borders:{north:'bloodmyst',south:null,east:null,west:null},cities:[{name:'The Exodar',faction:'alliance',nx:0.3,ny:0.4,tier:'capital'},{name:'Azure Watch',faction:'alliance',nx:0.5,ny:0.55,tier:'town'}],dungeons:[],docks:[{name:'Valaar\'s Berth',faction:'alliance',nx:0.22,ny:0.55,routes:[]}],flightpaths:[{name:'The Exodar',faction:'alliance',nx:0.3,ny:0.4},{name:'Azure Watch',faction:'alliance',nx:0.5,ny:0.55}]}),
  'darkshore': zone('darkshore','Darkshore','kalimdor', 80000,0,60000,120000, 10,20, 'alliance','gloomy coastal forest', {borders:{north:null,south:'ashenvale',east:'felwood',west:null},cities:[{name:'Auberdine',faction:'alliance',nx:0.4,ny:0.35,tier:'town'},{name:'Grove of the Ancients',faction:'alliance',nx:0.5,ny:0.75,tier:'town'}],dungeons:[],docks:[{name:'Auberdine Docks',faction:'alliance',nx:0.34,ny:0.36,routes:[]}],flightpaths:[{name:'Auberdine',faction:'alliance',nx:0.4,ny:0.35},{name:'Grove of the Ancients',faction:'alliance',nx:0.5,ny:0.75}]}),
  'moonglade': zone('moonglade','Moonglade','kalimdor', 160000,0,60000,40000, 50,60, 'neutral','sacred druid forest', {borders:{north:null,south:'felwood',east:'winterspring',west:null},cities:[{name:'Nighthaven',faction:'neutral',nx:0.5,ny:0.4,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Nighthaven',faction:'neutral',nx:0.5,ny:0.4}]}),
  'winterspring': zone('winterspring','Winterspring','kalimdor', 220000,0,100000,40000, 55,60, 'contested','snowy mountains', {borders:{north:null,south:'felwood',east:null,west:'moonglade'},cities:[{name:'Everlook',faction:'neutral',nx:0.6,ny:0.4,tier:'town'},{name:'Starfall Village',faction:'alliance',nx:0.45,ny:0.3,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Everlook',faction:'neutral',nx:0.6,ny:0.4}]}),
  'felwood': zone('felwood','Felwood','kalimdor', 140000,40000,100000,80000, 48,55, 'contested','corrupted forest', {borders:{north:'moonglade',south:'ashenvale',east:'azshara',west:'darkshore'},cities:[{name:'Bloodvenom Post',faction:'horde',nx:0.4,ny:0.55,tier:'town'},{name:'Talonbranch Glade',faction:'alliance',nx:0.55,ny:0.3,tier:'town'},{name:'Emerald Sanctuary',faction:'neutral',nx:0.5,ny:0.75,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Bloodvenom Post',faction:'horde',nx:0.4,ny:0.55},{name:'Talonbranch Glade',faction:'alliance',nx:0.55,ny:0.3},{name:'Emerald Sanctuary',faction:'neutral',nx:0.5,ny:0.75}]}),
  'azshara': zone('azshara','Azshara','kalimdor', 240000,40000,100000,100000, 45,55, 'contested','autumnal cliffs and naga ruins', {borders:{north:'winterspring',south:'durotar',east:null,west:'ashenvale'},cities:[{name:'Valormok',faction:'horde',nx:0.3,ny:0.5,tier:'town'},{name:'Talrendis Point',faction:'alliance',nx:0.15,ny:0.6,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Valormok',faction:'horde',nx:0.3,ny:0.5},{name:'Talrendis Point',faction:'alliance',nx:0.15,ny:0.6}]}),
  'ashenvale': zone('ashenvale','Ashenvale','kalimdor', 80000,120000,160000,80000, 18,30, 'contested','dark ancient forest', {borders:{north:'darkshore',south:'barrens-north',east:'azshara',west:null},cities:[{name:'Astranaar',faction:'alliance',nx:0.4,ny:0.55,tier:'town'},{name:'Splintertree Post',faction:'horde',nx:0.72,ny:0.5,tier:'town'},{name:'Zoram\'gar Outpost',faction:'horde',nx:0.08,ny:0.45,tier:'town'},{name:'Forest Song',faction:'alliance',nx:0.85,ny:0.4,tier:'town'}],dungeons:[{name:'Blackfathom Deeps',nx:0.12,ny:0.2,levelMin:20,levelMax:28,kind:'dungeon'}],docks:[],flightpaths:[{name:'Astranaar',faction:'alliance',nx:0.4,ny:0.55},{name:'Splintertree Post',faction:'horde',nx:0.72,ny:0.5},{name:'Zoram\'gar Outpost',faction:'horde',nx:0.08,ny:0.45},{name:'Forest Song',faction:'alliance',nx:0.85,ny:0.4}]}),
  'durotar': zone('durotar','Durotar','kalimdor', 300000,140000,80000,100000, 1,10, 'horde','arid red canyon', {borders:{north:'azshara',south:null,east:null,west:'barrens-north'},cities:[{name:'Orgrimmar',faction:'horde',nx:0.45,ny:0.1,tier:'capital'},{name:'Razor Hill',faction:'horde',nx:0.52,ny:0.55,tier:'town'},{name:'Sen\'jin Village',faction:'horde',nx:0.55,ny:0.82,tier:'town'}],dungeons:[{name:'Ragefire Chasm',nx:0.45,ny:0.12,levelMin:13,levelMax:18,kind:'dungeon'}],docks:[{name:'Orgrimmar Zeppelin Tower',faction:'horde',nx:0.35,ny:0.14,routes:[]}],flightpaths:[{name:'Orgrimmar',faction:'horde',nx:0.45,ny:0.1}]}),
  'stonetalon': zone('stonetalon','Stonetalon Mountains','kalimdor', 80000,200000,60000,60000, 15,27, 'contested','rocky peaks and charred vale', {borders:{north:'ashenvale',south:'desolace',east:'barrens-north',west:null},cities:[{name:'Stonetalon Peak',faction:'alliance',nx:0.3,ny:0.15,tier:'town'},{name:'Sun Rock Retreat',faction:'horde',nx:0.55,ny:0.6,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Stonetalon Peak',faction:'alliance',nx:0.3,ny:0.15},{name:'Sun Rock Retreat',faction:'horde',nx:0.55,ny:0.6}]}),
  'barrens-north': zone('barrens-north','The Barrens (North)','kalimdor', 140000,200000,160000,60000, 10,20, 'horde','savanna', {borders:{north:'ashenvale',south:'barrens-south',east:'durotar',west:'stonetalon'},cities:[{name:'The Crossroads',faction:'horde',nx:0.5,ny:0.55,tier:'town'},{name:'Ratchet',faction:'neutral',nx:0.85,ny:0.55,tier:'town'}],dungeons:[{name:'Wailing Caverns',nx:0.35,ny:0.45,levelMin:15,levelMax:25,kind:'dungeon'}],docks:[{name:'Ratchet Dock',faction:'horde',nx:0.88,ny:0.56,routes:[]}],flightpaths:[{name:'The Crossroads',faction:'horde',nx:0.5,ny:0.55},{name:'Ratchet',faction:'neutral',nx:0.85,ny:0.55}]}),
  'desolace': zone('desolace','Desolace','kalimdor', 80000,260000,60000,60000, 30,40, 'contested','grey barren wastes', {borders:{north:'stonetalon',south:'feralas',east:null,west:null},cities:[{name:'Nijel\'s Point',faction:'alliance',nx:0.6,ny:0.1,tier:'town'},{name:'Shadowprey Village',faction:'horde',nx:0.25,ny:0.7,tier:'town'}],dungeons:[{name:'Maraudon',nx:0.35,ny:0.55,levelMin:40,levelMax:52,kind:'dungeon'}],docks:[],flightpaths:[{name:'Nijel\'s Point',faction:'alliance',nx:0.6,ny:0.1},{name:'Shadowprey Village',faction:'horde',nx:0.25,ny:0.7}]}),
  'mulgore': zone('mulgore','Mulgore','kalimdor', 160000,270000,80000,50000, 1,10, 'horde','green plains and mesas', {borders:{north:null,south:null,east:'barrens-south',west:null},cities:[{name:'Thunder Bluff',faction:'horde',nx:0.45,ny:0.35,tier:'capital'},{name:'Bloodhoof Village',faction:'horde',nx:0.5,ny:0.62,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Thunder Bluff',faction:'horde',nx:0.45,ny:0.35}]}),
  'barrens-south': zone('barrens-south','The Barrens (South)','kalimdor', 240000,260000,60000,80000, 20,35, 'horde','dry savanna and razorfen brambles', {borders:{north:'barrens-north',south:'thousand-needles',east:'dustwallow',west:'mulgore'},cities:[{name:'Camp Taurajo',faction:'horde',nx:0.4,ny:0.6,tier:'town'}],dungeons:[{name:'Razorfen Kraul',nx:0.28,ny:0.85,levelMin:24,levelMax:32,kind:'dungeon'},{name:'Razorfen Downs',nx:0.5,ny:0.95,levelMin:34,levelMax:42,kind:'dungeon'}],docks:[],flightpaths:[{name:'Camp Taurajo',faction:'horde',nx:0.4,ny:0.6}]}),
  'dustwallow': zone('dustwallow','Dustwallow Marsh','kalimdor', 300000,260000,80000,80000, 35,45, 'contested','swamp', {borders:{north:null,south:'thousand-needles',east:null,west:'barrens-south'},cities:[{name:'Theramore Isle',faction:'alliance',nx:0.75,ny:0.55,tier:'town'},{name:'Brackenwall Village',faction:'horde',nx:0.35,ny:0.3,tier:'town'},{name:'Mudsprocket',faction:'neutral',nx:0.4,ny:0.75,tier:'town'}],dungeons:[{name:'Onyxia\'s Lair',nx:0.5,ny:0.7,levelMin:80,levelMax:80,kind:'raid'}],docks:[{name:'Theramore Dock',faction:'contested',nx:0.78,ny:0.56,routes:[]}],flightpaths:[{name:'Theramore Isle',faction:'alliance',nx:0.75,ny:0.55},{name:'Brackenwall Village',faction:'horde',nx:0.35,ny:0.3},{name:'Mudsprocket',faction:'neutral',nx:0.4,ny:0.75}]}),
  'feralas': zone('feralas','Feralas','kalimdor', 80000,320000,80000,60000, 40,50, 'contested','lush jungle forest', {borders:{north:'desolace',south:null,east:'thousand-needles',west:null},cities:[{name:'Feathermoon Stronghold',faction:'alliance',nx:0.15,ny:0.55,tier:'town'},{name:'Camp Mojache',faction:'horde',nx:0.75,ny:0.45,tier:'town'},{name:'Thalanaar',faction:'alliance',nx:0.9,ny:0.35,tier:'town'}],dungeons:[{name:'Dire Maul',nx:0.55,ny:0.4,levelMin:55,levelMax:60,kind:'dungeon'}],docks:[],flightpaths:[{name:'Feathermoon Stronghold',faction:'alliance',nx:0.15,ny:0.55},{name:'Camp Mojache',faction:'horde',nx:0.75,ny:0.45},{name:'Thalanaar',faction:'alliance',nx:0.9,ny:0.35}]}),
  'thousand-needles': zone('thousand-needles','Thousand Needles','kalimdor', 160000,340000,180000,60000, 25,35, 'contested','canyon needles and salt flats', {borders:{north:'barrens-south',south:'tanaris',east:null,west:'feralas'},cities:[{name:'Freewind Post',faction:'horde',nx:0.45,ny:0.45,tier:'town'},{name:'Mirage Raceway',faction:'neutral',nx:0.75,ny:0.6,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Freewind Post',faction:'horde',nx:0.45,ny:0.45}]}),
  'tanaris': zone('tanaris','Tanaris','kalimdor', 240000,400000,100000,60000, 40,50, 'contested','desert', {borders:{north:'thousand-needles',south:null,east:null,west:'ungoro'},cities:[{name:'Gadgetzan',faction:'neutral',nx:0.55,ny:0.3,tier:'town'},{name:'Steamwheedle Port',faction:'neutral',nx:0.7,ny:0.12,tier:'town'}],dungeons:[{name:'Zul\'Farrak',nx:0.2,ny:0.35,levelMin:42,levelMax:50,kind:'dungeon'},{name:'Caverns of Time',nx:0.65,ny:0.75,levelMin:66,levelMax:70,kind:'dungeon'}],docks:[],flightpaths:[{name:'Gadgetzan',faction:'neutral',nx:0.55,ny:0.3}]}),
  'ungoro': zone('ungoro','Un\'Goro Crater','kalimdor', 160000,400000,80000,60000, 48,55, 'contested','prehistoric jungle crater', {borders:{north:'thousand-needles',south:null,east:'tanaris',west:'silithus'},cities:[{name:'Marshal\'s Refuge',faction:'neutral',nx:0.5,ny:0.15,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Marshal\'s Refuge',faction:'neutral',nx:0.5,ny:0.15}]}),
  'silithus': zone('silithus','Silithus','kalimdor', 80000,400000,80000,60000, 55,60, 'contested','silithid desert', {borders:{north:null,south:null,east:'ungoro',west:null},cities:[{name:'Cenarion Hold',faction:'neutral',nx:0.5,ny:0.35,tier:'town'}],dungeons:[{name:'Ruins of Ahn\'Qiraj',nx:0.55,ny:0.9,levelMin:60,levelMax:60,kind:'raid'},{name:'Temple of Ahn\'Qiraj',nx:0.6,ny:0.93,levelMin:60,levelMax:60,kind:'raid'}],docks:[],flightpaths:[{name:'Cenarion Hold',faction:'neutral',nx:0.5,ny:0.35}]}),
  'eversong': zone('eversong','Eversong Woods','eastern-kingdoms', 220000,40000,120000,60000, 1,10, 'horde','golden autumn forest', {borders:{north:'quel-danas',south:'ghostlands',east:null,west:null},cities:[{name:'Silvermoon City',faction:'horde',nx:0.55,ny:0.25,tier:'capital'},{name:'Falconwing Square',faction:'horde',nx:0.45,ny:0.55,tier:'town'},{name:'Fairbreeze Village',faction:'horde',nx:0.42,ny:0.72,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Silvermoon City',faction:'horde',nx:0.55,ny:0.25},{name:'Fairbreeze Village',faction:'horde',nx:0.42,ny:0.72}]}),
  'ghostlands': zone('ghostlands','Ghostlands','eastern-kingdoms', 220000,100000,120000,60000, 10,20, 'horde','dead haunted forest', {borders:{north:'eversong',south:'eastern-plaguelands',east:null,west:null},cities:[{name:'Tranquillien',faction:'horde',nx:0.45,ny:0.35,tier:'town'}],dungeons:[{name:'Zul\'Aman',nx:0.65,ny:0.75,levelMin:70,levelMax:70,kind:'raid'}],docks:[],flightpaths:[{name:'Tranquillien',faction:'horde',nx:0.45,ny:0.35},{name:'Zul\'Aman',faction:'neutral',nx:0.65,ny:0.75}]}),
  'tirisfal': zone('tirisfal','Tirisfal Glades','eastern-kingdoms', 0,160000,80000,60000, 1,10, 'horde','forsaken woodland', {borders:{north:null,south:'silverpine',east:'western-plaguelands',west:null},cities:[{name:'Undercity',faction:'horde',nx:0.55,ny:0.35,tier:'capital'},{name:'Brill',faction:'horde',nx:0.55,ny:0.55,tier:'town'},{name:'The Bulwark',faction:'horde',nx:0.85,ny:0.6,tier:'town'}],dungeons:[{name:'Scarlet Monastery',nx:0.8,ny:0.25,levelMin:26,levelMax:45,kind:'dungeon'}],docks:[{name:'Undercity Zeppelin Tower',faction:'horde',nx:0.6,ny:0.3,routes:[]}],flightpaths:[{name:'Undercity',faction:'horde',nx:0.55,ny:0.35},{name:'The Bulwark',faction:'horde',nx:0.85,ny:0.6}]}),
  'western-plaguelands': zone('western-plaguelands','Western Plaguelands','eastern-kingdoms', 80000,160000,120000,60000, 51,58, 'contested','plagued farmland', {borders:{north:null,south:'alterac',east:'eastern-plaguelands',west:'tirisfal'},cities:[{name:'Chillwind Camp',faction:'alliance',nx:0.45,ny:0.85,tier:'town'},{name:'The Bulwark',faction:'horde',nx:0.15,ny:0.6,tier:'town'}],dungeons:[{name:'Scholomance',nx:0.7,ny:0.75,levelMin:55,levelMax:60,kind:'dungeon'}],docks:[],flightpaths:[{name:'Chillwind Camp',faction:'alliance',nx:0.45,ny:0.85},{name:'The Bulwark',faction:'horde',nx:0.15,ny:0.6}]}),
  'eastern-plaguelands': zone('eastern-plaguelands','Eastern Plaguelands','eastern-kingdoms', 200000,160000,140000,60000, 53,60, 'contested','blighted deadlands', {borders:{north:'ghostlands',south:'hinterlands',east:null,west:'western-plaguelands'},cities:[{name:'Light\'s Hope Chapel',faction:'neutral',nx:0.75,ny:0.55,tier:'town'}],dungeons:[{name:'Stratholme',nx:0.3,ny:0.2,levelMin:55,levelMax:60,kind:'dungeon'}],docks:[],flightpaths:[{name:'Light\'s Hope Chapel',faction:'neutral',nx:0.75,ny:0.55}]}),
  'silverpine': zone('silverpine','Silverpine Forest','eastern-kingdoms', 0,220000,80000,80000, 10,20, 'horde','dark pine forest', {borders:{north:'tirisfal',south:'hillsbrad',east:'alterac',west:null},cities:[{name:'The Sepulcher',faction:'horde',nx:0.45,ny:0.45,tier:'town'}],dungeons:[{name:'Shadowfang Keep',nx:0.35,ny:0.75,levelMin:18,levelMax:25,kind:'dungeon'}],docks:[],flightpaths:[{name:'The Sepulcher',faction:'horde',nx:0.45,ny:0.45}]}),
  'alterac': zone('alterac','Alterac Mountains','eastern-kingdoms', 80000,220000,60000,80000, 30,40, 'contested','snowy ogre highlands', {borders:{north:'western-plaguelands',south:'hillsbrad',east:null,west:'silverpine'},cities:[{name:'Alterac Ruins',faction:'neutral',nx:0.4,ny:0.45,tier:'town'}],dungeons:[],docks:[],flightpaths:[]}),
  'hinterlands': zone('hinterlands','The Hinterlands','eastern-kingdoms', 160000,220000,60000,80000, 40,50, 'contested','forested troll highlands', {borders:{north:'eastern-plaguelands',south:'hillsbrad',east:null,west:null},cities:[{name:'Aerie Peak',faction:'alliance',nx:0.15,ny:0.5,tier:'town'},{name:'Revantusk Village',faction:'horde',nx:0.8,ny:0.8,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Aerie Peak',faction:'alliance',nx:0.15,ny:0.5},{name:'Revantusk Village',faction:'horde',nx:0.8,ny:0.8}]}),
  'hillsbrad': zone('hillsbrad','Hillsbrad Foothills','eastern-kingdoms', 0,300000,200000,40000, 20,30, 'contested','green foothills', {borders:{north:'alterac',south:null,east:'arathi',west:null},cities:[{name:'Southshore',faction:'alliance',nx:0.5,ny:0.8,tier:'town'},{name:'Tarren Mill',faction:'horde',nx:0.6,ny:0.35,tier:'town'}],dungeons:[],docks:[{name:'Southshore Dock',faction:'contested',nx:0.5,ny:0.88,routes:[]}],flightpaths:[{name:'Southshore',faction:'alliance',nx:0.5,ny:0.8},{name:'Tarren Mill',faction:'horde',nx:0.6,ny:0.35}]}),
  'arathi': zone('arathi','Arathi Highlands','eastern-kingdoms', 200000,300000,80000,60000, 30,40, 'contested','grassy highlands', {borders:{north:'hinterlands',south:'wetlands',east:null,west:'hillsbrad'},cities:[{name:'Refuge Pointe',faction:'alliance',nx:0.45,ny:0.4,tier:'town'},{name:'Hammerfall',faction:'horde',nx:0.72,ny:0.35,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Refuge Pointe',faction:'alliance',nx:0.45,ny:0.4},{name:'Hammerfall',faction:'horde',nx:0.72,ny:0.35}]}),
  'wetlands': zone('wetlands','Wetlands','eastern-kingdoms', 220000,360000,80000,60000, 20,30, 'alliance','marsh', {borders:{north:'arathi',south:'loch-modan',east:null,west:null},cities:[{name:'Menethil Harbor',faction:'alliance',nx:0.15,ny:0.55,tier:'town'}],dungeons:[],docks:[{name:'Menethil Harbor',faction:'alliance',nx:0.1,ny:0.55,routes:[]}],flightpaths:[{name:'Menethil Harbor',faction:'alliance',nx:0.15,ny:0.55}]}),
  'dun-morogh': zone('dun-morogh','Dun Morogh','eastern-kingdoms', 80000,400000,120000,60000, 1,10, 'alliance','snowy dwarf highlands', {borders:{north:null,south:'searing-gorge',east:'loch-modan',west:null},cities:[{name:'Ironforge',faction:'alliance',nx:0.55,ny:0.3,tier:'capital'},{name:'Kharanos',faction:'alliance',nx:0.45,ny:0.55,tier:'town'}],dungeons:[{name:'Gnomeregan',nx:0.25,ny:0.4,levelMin:24,levelMax:35,kind:'dungeon'}],docks:[{name:'Deeprun Tram (Ironforge)',faction:'alliance',nx:0.6,ny:0.32,routes:[]}],flightpaths:[{name:'Ironforge',faction:'alliance',nx:0.55,ny:0.3}]}),
  'loch-modan': zone('loch-modan','Loch Modan','eastern-kingdoms', 200000,420000,100000,40000, 10,20, 'alliance','highland lake', {borders:{north:'wetlands',south:'badlands',east:null,west:'dun-morogh'},cities:[{name:'Thelsamar',faction:'alliance',nx:0.35,ny:0.5,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Thelsamar',faction:'alliance',nx:0.35,ny:0.5}]}),
  'searing-gorge': zone('searing-gorge','Searing Gorge','eastern-kingdoms', 140000,460000,60000,60000, 43,50, 'contested','volcanic gorge', {borders:{north:'dun-morogh',south:'burning-steppes',east:'badlands',west:null},cities:[{name:'Thorium Point',faction:'neutral',nx:0.35,ny:0.3,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Thorium Point',faction:'neutral',nx:0.35,ny:0.3}]}),
  'badlands': zone('badlands','Badlands','eastern-kingdoms', 200000,460000,80000,60000, 35,45, 'contested','scorched badlands', {borders:{north:'loch-modan',south:null,east:null,west:null},cities:[{name:'Kargath',faction:'horde',nx:0.1,ny:0.45,tier:'town'}],dungeons:[{name:'Uldaman',nx:0.45,ny:0.25,levelMin:36,levelMax:44,kind:'dungeon'}],docks:[],flightpaths:[{name:'Kargath',faction:'horde',nx:0.1,ny:0.45}]}),
  'burning-steppes': zone('burning-steppes','Burning Steppes','eastern-kingdoms', 140000,520000,60000,40000, 50,58, 'contested','ashen volcanic steppes', {borders:{north:'searing-gorge',south:'redridge',east:null,west:null},cities:[{name:'Morgan\'s Vigil',faction:'alliance',nx:0.8,ny:0.7,tier:'town'},{name:'Flame Crest',faction:'horde',nx:0.6,ny:0.3,tier:'town'}],dungeons:[{name:'Blackrock Depths',nx:0.3,ny:0.4,levelMin:48,levelMax:60,kind:'dungeon'},{name:'Lower Blackrock Spire',nx:0.3,ny:0.42,levelMin:55,levelMax:60,kind:'dungeon'},{name:'Upper Blackrock Spire',nx:0.3,ny:0.44,levelMin:58,levelMax:60,kind:'raid'},{name:'Molten Core',nx:0.28,ny:0.4,levelMin:60,levelMax:60,kind:'raid'},{name:'Blackwing Lair',nx:0.32,ny:0.42,levelMin:60,levelMax:60,kind:'raid'}],docks:[],flightpaths:[{name:'Morgan\'s Vigil',faction:'alliance',nx:0.8,ny:0.7},{name:'Flame Crest',faction:'horde',nx:0.6,ny:0.3}]}),
  'elwynn': zone('elwynn','Elwynn Forest','eastern-kingdoms', 40000,560000,100000,60000, 1,10, 'alliance','green forest', {borders:{north:null,south:'duskwood',east:'redridge',west:'westfall'},cities:[{name:'Stormwind City',faction:'alliance',nx:0.35,ny:0.15,tier:'capital'},{name:'Goldshire',faction:'alliance',nx:0.45,ny:0.6,tier:'town'}],dungeons:[{name:'The Stockade',nx:0.38,ny:0.18,levelMin:22,levelMax:30,kind:'dungeon'}],docks:[{name:'Stormwind Harbor',faction:'alliance',nx:0.28,ny:0.1,routes:[]},{name:'Deeprun Tram (Stormwind)',faction:'alliance',nx:0.4,ny:0.16,routes:[]}],flightpaths:[{name:'Stormwind City',faction:'alliance',nx:0.35,ny:0.15}]}),
  'westfall': zone('westfall','Westfall','eastern-kingdoms', 0,560000,40000,60000, 10,20, 'alliance','dry farmland', {borders:{north:null,south:'duskwood',east:'elwynn',west:null},cities:[{name:'Sentinel Hill',faction:'alliance',nx:0.55,ny:0.45,tier:'town'}],dungeons:[{name:'The Deadmines',nx:0.4,ny:0.75,levelMin:15,levelMax:21,kind:'dungeon'}],docks:[],flightpaths:[{name:'Sentinel Hill',faction:'alliance',nx:0.55,ny:0.45}]}),
  'redridge': zone('redridge','Redridge Mountains','eastern-kingdoms', 140000,560000,80000,60000, 15,25, 'alliance','red mountain ridges', {borders:{north:'burning-steppes',south:'duskwood',east:null,west:'elwynn'},cities:[{name:'Lakeshire',faction:'alliance',nx:0.3,ny:0.55,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Lakeshire',faction:'alliance',nx:0.3,ny:0.55}]}),
  'duskwood': zone('duskwood','Duskwood','eastern-kingdoms', 0,620000,160000,60000, 18,30, 'alliance','haunted dark forest', {borders:{north:'elwynn',south:'stranglethorn',east:'deadwind',west:null},cities:[{name:'Darkshire',faction:'alliance',nx:0.75,ny:0.45,tier:'town'},{name:'Raven Hill',faction:'alliance',nx:0.2,ny:0.55,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Darkshire',faction:'alliance',nx:0.75,ny:0.45},{name:'Raven Hill',faction:'alliance',nx:0.2,ny:0.55}]}),
  'deadwind': zone('deadwind','Deadwind Pass','eastern-kingdoms', 160000,620000,80000,60000, 55,60, 'contested','dead canyon pass', {borders:{north:'redridge',south:null,east:'swamp-of-sorrows',west:'duskwood'},cities:[],dungeons:[{name:'Karazhan',nx:0.45,ny:0.75,levelMin:70,levelMax:70,kind:'raid'}],docks:[],flightpaths:[]}),
  'swamp-of-sorrows': zone('swamp-of-sorrows','Swamp of Sorrows','eastern-kingdoms', 240000,620000,100000,60000, 35,45, 'contested','murky swamp', {borders:{north:null,south:'blasted-lands',east:null,west:'deadwind'},cities:[{name:'Stonard',faction:'horde',nx:0.45,ny:0.55,tier:'town'}],dungeons:[{name:'Temple of Atal\'Hakkar',nx:0.7,ny:0.55,levelMin:50,levelMax:60,kind:'dungeon'}],docks:[],flightpaths:[{name:'Stonard',faction:'horde',nx:0.45,ny:0.55}]}),
  'blasted-lands': zone('blasted-lands','Blasted Lands','eastern-kingdoms', 240000,680000,100000,60000, 45,55, 'contested','fel-scorched wastes', {borders:{north:'swamp-of-sorrows',south:null,east:null,west:null},cities:[{name:'Nethergarde Keep',faction:'alliance',nx:0.6,ny:0.2,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Nethergarde Keep',faction:'alliance',nx:0.6,ny:0.2}]}),
  'stranglethorn': zone('stranglethorn','Stranglethorn Vale','eastern-kingdoms', 0,680000,140000,100000, 30,45, 'contested','dense jungle', {borders:{north:'duskwood',south:null,east:null,west:null},cities:[{name:'Booty Bay',faction:'neutral',nx:0.3,ny:0.85,tier:'town'},{name:'Grom\'gol Base Camp',faction:'horde',nx:0.35,ny:0.3,tier:'town'},{name:'Rebel Camp',faction:'alliance',nx:0.4,ny:0.1,tier:'town'}],dungeons:[{name:'Zul\'Gurub',nx:0.65,ny:0.35,levelMin:60,levelMax:60,kind:'raid'}],docks:[{name:'Booty Bay Dock',faction:'contested',nx:0.28,ny:0.88,routes:[]},{name:'Grom\'gol Zeppelin Tower',faction:'contested',nx:0.33,ny:0.28,routes:[]}],flightpaths:[{name:'Booty Bay',faction:'neutral',nx:0.3,ny:0.85},{name:'Grom\'gol Base Camp',faction:'horde',nx:0.35,ny:0.3},{name:'Rebel Camp',faction:'alliance',nx:0.4,ny:0.1}]}),
  'icecrown': zone('icecrown','Icecrown','northrend', 0,60000,240000,60000, 77,80, 'contested','scourge glacier and citadel', {borders:{north:null,south:'crystalsong',east:'storm-peaks',west:null},cities:[{name:'The Argent Vanguard',faction:'neutral',nx:0.85,ny:0.75,tier:'town'},{name:'Crusaders\' Pinnacle',faction:'neutral',nx:0.78,ny:0.65,tier:'town'},{name:'The Shadow Vault',faction:'neutral',nx:0.45,ny:0.25,tier:'town'},{name:'Death\'s Rise',faction:'neutral',nx:0.2,ny:0.45,tier:'town'}],dungeons:[{name:'Trial of the Champion',nx:0.72,ny:0.2,levelMin:80,levelMax:80,kind:'dungeon'},{name:'Trial of the Crusader',nx:0.72,ny:0.22,levelMin:80,levelMax:80,kind:'raid'},{name:'Forge of Souls',nx:0.55,ny:0.8,levelMin:80,levelMax:80,kind:'dungeon'},{name:'Pit of Saron',nx:0.55,ny:0.82,levelMin:80,levelMax:80,kind:'dungeon'},{name:'Halls of Reflection',nx:0.55,ny:0.84,levelMin:80,levelMax:80,kind:'dungeon'},{name:'Icecrown Citadel',nx:0.55,ny:0.86,levelMin:80,levelMax:80,kind:'raid'}],docks:[],flightpaths:[{name:'The Argent Vanguard',faction:'neutral',nx:0.85,ny:0.75},{name:'Crusaders\' Pinnacle',faction:'neutral',nx:0.78,ny:0.65},{name:'The Shadow Vault',faction:'neutral',nx:0.45,ny:0.25},{name:'Death\'s Rise',faction:'neutral',nx:0.2,ny:0.45}]}),
  'storm-peaks': zone('storm-peaks','The Storm Peaks','northrend', 240000,60000,80000,60000, 76,80, 'contested','titan ice mountains', {borders:{north:null,south:'zuldrak',east:null,west:'icecrown'},cities:[{name:'K3',faction:'neutral',nx:0.4,ny:0.85,tier:'town'},{name:'Frosthold',faction:'alliance',nx:0.3,ny:0.7,tier:'town'},{name:'Grom\'arsh Crash-Site',faction:'horde',nx:0.35,ny:0.5,tier:'town'},{name:'Bouldercrag\'s Refuge',faction:'neutral',nx:0.3,ny:0.35,tier:'town'},{name:'Ulduar',faction:'neutral',nx:0.4,ny:0.25,tier:'town'},{name:'Dun Niffelem',faction:'neutral',nx:0.6,ny:0.6,tier:'town'}],dungeons:[{name:'Halls of Stone',nx:0.42,ny:0.28,levelMin:77,levelMax:79,kind:'dungeon'},{name:'Halls of Lightning',nx:0.45,ny:0.28,levelMin:79,levelMax:80,kind:'dungeon'},{name:'Ulduar',nx:0.4,ny:0.25,levelMin:80,levelMax:80,kind:'raid'}],docks:[],flightpaths:[{name:'K3',faction:'neutral',nx:0.4,ny:0.85},{name:'Frosthold',faction:'alliance',nx:0.3,ny:0.7},{name:'Grom\'arsh Crash-Site',faction:'horde',nx:0.35,ny:0.5},{name:'Bouldercrag\'s Refuge',faction:'neutral',nx:0.3,ny:0.35},{name:'Ulduar',faction:'neutral',nx:0.4,ny:0.25},{name:'Dun Niffelem',faction:'neutral',nx:0.6,ny:0.6}]}),
  'sholazar': zone('sholazar','Sholazar Basin','northrend', 0,120000,80000,60000, 75,78, 'contested','tropical jungle basin', {borders:{north:'icecrown',south:'borean-tundra',east:'wintergrasp',west:null},cities:[{name:'Nesingwary Base Camp',faction:'neutral',nx:0.25,ny:0.55,tier:'town'},{name:'River\'s Heart',faction:'neutral',nx:0.5,ny:0.6,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Nesingwary Base Camp',faction:'neutral',nx:0.25,ny:0.55},{name:'River\'s Heart',faction:'neutral',nx:0.5,ny:0.6}]}),
  'wintergrasp': zone('wintergrasp','Wintergrasp','northrend', 80000,120000,80000,60000, 77,80, 'contested','frozen battlefield lake', {borders:{north:'icecrown',south:'dragonblight',east:'crystalsong',west:'sholazar'},cities:[{name:'Wintergrasp Fortress',faction:'neutral',nx:0.5,ny:0.25,tier:'town'},{name:'Valiance Landing Camp',faction:'alliance',nx:0.72,ny:0.6,tier:'town'},{name:'Warsong Camp',faction:'horde',nx:0.25,ny:0.6,tier:'town'}],dungeons:[{name:'Vault of Archavon',nx:0.5,ny:0.22,levelMin:80,levelMax:80,kind:'raid'}],docks:[],flightpaths:[]}),
  'crystalsong': zone('crystalsong','Crystalsong Forest','northrend', 160000,120000,80000,60000, 74,80, 'neutral','crystalline forest', {borders:{north:'icecrown',south:'dragonblight',east:'zuldrak',west:'wintergrasp'},cities:[{name:'Dalaran',faction:'neutral',nx:0.3,ny:0.45,tier:'capital'},{name:'Windrunner\'s Overlook',faction:'alliance',nx:0.72,ny:0.55,tier:'town'},{name:'Sunreaver\'s Command',faction:'horde',nx:0.78,ny:0.45,tier:'town'}],dungeons:[{name:'The Violet Hold',nx:0.3,ny:0.48,levelMin:75,levelMax:77,kind:'dungeon'}],docks:[],flightpaths:[{name:'Dalaran',faction:'neutral',nx:0.3,ny:0.45},{name:'Windrunner\'s Overlook',faction:'alliance',nx:0.72,ny:0.55},{name:'Sunreaver\'s Command',faction:'horde',nx:0.78,ny:0.45}]}),
  'zuldrak': zone('zuldrak','Zul\'Drak','northrend', 240000,120000,80000,60000, 74,77, 'contested','troll temple ziggurats', {borders:{north:'storm-peaks',south:'grizzly-hills',east:null,west:'crystalsong'},cities:[{name:'The Argent Stand',faction:'neutral',nx:0.4,ny:0.65,tier:'town'},{name:'Zim\'Torga',faction:'neutral',nx:0.6,ny:0.55,tier:'town'},{name:'Ebon Watch',faction:'neutral',nx:0.15,ny:0.75,tier:'town'},{name:'Light\'s Breach',faction:'neutral',nx:0.3,ny:0.75,tier:'town'}],dungeons:[{name:'Gundrak',nx:0.8,ny:0.25,levelMin:76,levelMax:78,kind:'dungeon'}],docks:[],flightpaths:[{name:'The Argent Stand',faction:'neutral',nx:0.4,ny:0.65},{name:'Zim\'Torga',faction:'neutral',nx:0.6,ny:0.55},{name:'Ebon Watch',faction:'neutral',nx:0.15,ny:0.75},{name:'Light\'s Breach',faction:'neutral',nx:0.3,ny:0.75}]}),
  'borean-tundra': zone('borean-tundra','Borean Tundra','northrend', 0,180000,80000,60000, 68,72, 'contested','frozen tundra', {borders:{north:'sholazar',south:null,east:'dragonblight',west:null},cities:[{name:'Valiance Keep',faction:'alliance',nx:0.55,ny:0.75,tier:'town'},{name:'Warsong Hold',faction:'horde',nx:0.4,ny:0.55,tier:'town'},{name:'Amber Ledge',faction:'neutral',nx:0.45,ny:0.35,tier:'town'},{name:'Transitus Shield',faction:'neutral',nx:0.3,ny:0.35,tier:'town'},{name:'Unu\'pe',faction:'neutral',nx:0.78,ny:0.55,tier:'town'}],dungeons:[{name:'The Nexus',nx:0.28,ny:0.3,levelMin:69,levelMax:73,kind:'dungeon'},{name:'The Oculus',nx:0.28,ny:0.28,levelMin:77,levelMax:80,kind:'dungeon'},{name:'Eye of Eternity',nx:0.28,ny:0.26,levelMin:80,levelMax:80,kind:'raid'}],docks:[{name:'Valiance Keep Dock',faction:'contested',nx:0.58,ny:0.8,routes:[]},{name:'Warsong Hold Zeppelin Tower',faction:'contested',nx:0.4,ny:0.58,routes:[]},{name:'Unu\'pe Turtle Dock',faction:'contested',nx:0.8,ny:0.57,routes:[]}],flightpaths:[{name:'Valiance Keep',faction:'alliance',nx:0.55,ny:0.75},{name:'Warsong Hold',faction:'horde',nx:0.4,ny:0.55},{name:'Amber Ledge',faction:'neutral',nx:0.45,ny:0.35},{name:'Transitus Shield',faction:'neutral',nx:0.3,ny:0.35},{name:'Unu\'pe',faction:'neutral',nx:0.78,ny:0.55}]}),
  'dragonblight': zone('dragonblight','Dragonblight','northrend', 80000,180000,160000,120000, 71,74, 'contested','dragon graveyard wastes', {borders:{north:'crystalsong',south:null,east:'grizzly-hills',west:'borean-tundra'},cities:[{name:'Wintergarde Keep',faction:'alliance',nx:0.78,ny:0.35,tier:'town'},{name:'Agmar\'s Hammer',faction:'horde',nx:0.38,ny:0.45,tier:'town'},{name:'Wyrmrest Temple',faction:'neutral',nx:0.58,ny:0.5,tier:'town'},{name:'Stars\' Rest',faction:'alliance',nx:0.28,ny:0.55,tier:'town'},{name:'Venomspite',faction:'horde',nx:0.75,ny:0.6,tier:'town'},{name:'Moa\'ki Harbor',faction:'neutral',nx:0.48,ny:0.78,tier:'town'}],dungeons:[{name:'Azjol-Nerub',nx:0.25,ny:0.5,levelMin:72,levelMax:74,kind:'dungeon'},{name:'Ahn\'kahet: The Old Kingdom',nx:0.25,ny:0.52,levelMin:73,levelMax:75,kind:'dungeon'},{name:'Naxxramas',nx:0.85,ny:0.3,levelMin:80,levelMax:80,kind:'raid'},{name:'Obsidian Sanctum',nx:0.58,ny:0.55,levelMin:80,levelMax:80,kind:'raid'},{name:'Ruby Sanctum',nx:0.58,ny:0.57,levelMin:80,levelMax:80,kind:'raid'}],docks:[{name:'Moa\'ki Harbor Turtle Dock',faction:'contested',nx:0.48,ny:0.82,routes:[]}],flightpaths:[{name:'Wintergarde Keep',faction:'alliance',nx:0.78,ny:0.35},{name:'Agmar\'s Hammer',faction:'horde',nx:0.38,ny:0.45},{name:'Wyrmrest Temple',faction:'neutral',nx:0.58,ny:0.5},{name:'Stars\' Rest',faction:'alliance',nx:0.28,ny:0.55},{name:'Venomspite',faction:'horde',nx:0.75,ny:0.6},{name:'Moa\'ki Harbor',faction:'neutral',nx:0.48,ny:0.78}]}),
  'grizzly-hills': zone('grizzly-hills','Grizzly Hills','northrend', 240000,180000,80000,60000, 73,75, 'contested','redwood hills', {borders:{north:'zuldrak',south:'howling-fjord',east:null,west:'dragonblight'},cities:[{name:'Amberpine Lodge',faction:'alliance',nx:0.3,ny:0.55,tier:'town'},{name:'Conquest Hold',faction:'horde',nx:0.2,ny:0.65,tier:'town'},{name:'Westfall Brigade Encampment',faction:'alliance',nx:0.55,ny:0.3,tier:'town'},{name:'Camp Oneqwah',faction:'horde',nx:0.65,ny:0.45,tier:'town'}],dungeons:[{name:'Drak\'Tharon Keep',nx:0.15,ny:0.25,levelMin:74,levelMax:76,kind:'dungeon'}],docks:[],flightpaths:[{name:'Amberpine Lodge',faction:'alliance',nx:0.3,ny:0.55},{name:'Conquest Hold',faction:'horde',nx:0.2,ny:0.65},{name:'Westfall Brigade Encampment',faction:'alliance',nx:0.55,ny:0.3},{name:'Camp Oneqwah',faction:'horde',nx:0.65,ny:0.45}]}),
  'howling-fjord': zone('howling-fjord','Howling Fjord','northrend', 240000,240000,80000,60000, 68,72, 'contested','fjord cliffs and pine forest', {borders:{north:'grizzly-hills',south:null,east:null,west:'dragonblight'},cities:[{name:'Valgarde',faction:'alliance',nx:0.55,ny:0.6,tier:'town'},{name:'Vengeance Landing',faction:'horde',nx:0.78,ny:0.35,tier:'town'},{name:'Westguard Keep',faction:'alliance',nx:0.3,ny:0.45,tier:'town'},{name:'New Agamand',faction:'horde',nx:0.5,ny:0.75,tier:'town'},{name:'Kamagua',faction:'neutral',nx:0.25,ny:0.6,tier:'town'},{name:'Fort Wildervar',faction:'alliance',nx:0.6,ny:0.2,tier:'town'},{name:'Camp Winterhoof',faction:'horde',nx:0.5,ny:0.15,tier:'town'}],dungeons:[{name:'Utgarde Keep',nx:0.55,ny:0.5,levelMin:68,levelMax:72,kind:'dungeon'},{name:'Utgarde Pinnacle',nx:0.55,ny:0.48,levelMin:77,levelMax:80,kind:'dungeon'}],docks:[{name:'Valgarde Dock',faction:'contested',nx:0.58,ny:0.65,routes:[]},{name:'Vengeance Landing Zeppelin Tower',faction:'contested',nx:0.8,ny:0.33,routes:[]},{name:'Kamagua Turtle Dock',faction:'contested',nx:0.23,ny:0.62,routes:[]}],flightpaths:[{name:'Valgarde',faction:'alliance',nx:0.55,ny:0.6},{name:'Vengeance Landing',faction:'horde',nx:0.78,ny:0.35},{name:'Westguard Keep',faction:'alliance',nx:0.3,ny:0.45},{name:'New Agamand',faction:'horde',nx:0.5,ny:0.75},{name:'Kamagua',faction:'neutral',nx:0.25,ny:0.6},{name:'Fort Wildervar',faction:'alliance',nx:0.6,ny:0.2},{name:'Camp Winterhoof',faction:'horde',nx:0.5,ny:0.15}]}),
  'netherstorm': zone('netherstorm','Netherstorm','outland', 120000,0,80000,60000, 67,70, 'contested','arcane shattered islands', {borders:{north:null,south:'blades-edge',east:null,west:null},cities:[{name:'Area 52',faction:'neutral',nx:0.33,ny:0.65,tier:'town'},{name:'The Stormspire',faction:'neutral',nx:0.45,ny:0.35,tier:'town'},{name:'Cosmowrench',faction:'neutral',nx:0.65,ny:0.65,tier:'town'}],dungeons:[{name:'The Mechanar',nx:0.72,ny:0.55,levelMin:69,levelMax:70,kind:'dungeon'},{name:'The Botanica',nx:0.74,ny:0.55,levelMin:69,levelMax:70,kind:'dungeon'},{name:'The Arcatraz',nx:0.76,ny:0.55,levelMin:69,levelMax:70,kind:'dungeon'},{name:'The Eye',nx:0.74,ny:0.52,levelMin:70,levelMax:70,kind:'raid'}],docks:[],flightpaths:[{name:'Area 52',faction:'neutral',nx:0.33,ny:0.65},{name:'The Stormspire',faction:'neutral',nx:0.45,ny:0.35},{name:'Cosmowrench',faction:'neutral',nx:0.65,ny:0.65}]}),
  'blades-edge': zone('blades-edge','Blade\'s Edge Mountains','outland', 80000,60000,80000,60000, 65,68, 'contested','spiky ogre mountains', {borders:{north:'netherstorm',south:'zangarmarsh',east:null,west:null},cities:[{name:'Sylvanaar',faction:'alliance',nx:0.35,ny:0.65,tier:'town'},{name:'Thunderlord Stronghold',faction:'horde',nx:0.5,ny:0.55,tier:'town'},{name:'Evergrove',faction:'neutral',nx:0.6,ny:0.4,tier:'town'},{name:'Toshley\'s Station',faction:'alliance',nx:0.6,ny:0.7,tier:'town'}],dungeons:[{name:'Gruul\'s Lair',nx:0.68,ny:0.25,levelMin:70,levelMax:70,kind:'raid'}],docks:[],flightpaths:[{name:'Sylvanaar',faction:'alliance',nx:0.35,ny:0.65},{name:'Thunderlord Stronghold',faction:'horde',nx:0.5,ny:0.55},{name:'Evergrove',faction:'neutral',nx:0.6,ny:0.4},{name:'Toshley\'s Station',faction:'alliance',nx:0.6,ny:0.7}]}),
  'zangarmarsh': zone('zangarmarsh','Zangarmarsh','outland', 80000,120000,80000,60000, 60,64, 'contested','giant mushroom swamp', {borders:{north:'blades-edge',south:'terokkar',east:'hellfire',west:null},cities:[{name:'Telredor',faction:'alliance',nx:0.68,ny:0.5,tier:'town'},{name:'Zabra\'jin',faction:'horde',nx:0.3,ny:0.5,tier:'town'},{name:'Cenarion Refuge',faction:'neutral',nx:0.8,ny:0.65,tier:'town'},{name:'Orebor Harborage',faction:'alliance',nx:0.42,ny:0.3,tier:'town'},{name:'Swamprat Post',faction:'horde',nx:0.85,ny:0.55,tier:'town'}],dungeons:[{name:'The Slave Pens',nx:0.5,ny:0.4,levelMin:61,levelMax:64,kind:'dungeon'},{name:'The Underbog',nx:0.5,ny:0.38,levelMin:62,levelMax:65,kind:'dungeon'},{name:'The Steamvault',nx:0.5,ny:0.36,levelMin:68,levelMax:70,kind:'dungeon'},{name:'Serpentshrine Cavern',nx:0.5,ny:0.34,levelMin:70,levelMax:70,kind:'raid'}],docks:[],flightpaths:[{name:'Telredor',faction:'alliance',nx:0.68,ny:0.5},{name:'Zabra\'jin',faction:'horde',nx:0.3,ny:0.5},{name:'Cenarion Refuge',faction:'neutral',nx:0.8,ny:0.65},{name:'Orebor Harborage',faction:'alliance',nx:0.42,ny:0.3},{name:'Swamprat Post',faction:'horde',nx:0.85,ny:0.55}]}),
  'hellfire': zone('hellfire','Hellfire Peninsula','outland', 160000,120000,80000,60000, 58,63, 'contested','fel-red shattered wastes', {borders:{north:null,south:'terokkar',east:null,west:'zangarmarsh'},cities:[{name:'Honor Hold',faction:'alliance',nx:0.55,ny:0.6,tier:'town'},{name:'Thrallmar',faction:'horde',nx:0.55,ny:0.4,tier:'town'},{name:'Temple of Telhamat',faction:'alliance',nx:0.25,ny:0.5,tier:'town'},{name:'Falcon Watch',faction:'horde',nx:0.28,ny:0.6,tier:'town'},{name:'Shatter Point',faction:'neutral',nx:0.78,ny:0.35,tier:'town'}],dungeons:[{name:'Hellfire Ramparts',nx:0.48,ny:0.52,levelMin:59,levelMax:62,kind:'dungeon'},{name:'Blood Furnace',nx:0.46,ny:0.52,levelMin:60,levelMax:63,kind:'dungeon'},{name:'Shattered Halls',nx:0.48,ny:0.5,levelMin:69,levelMax:70,kind:'dungeon'},{name:'Magtheridon\'s Lair',nx:0.46,ny:0.5,levelMin:70,levelMax:70,kind:'raid'}],docks:[],flightpaths:[{name:'Honor Hold',faction:'alliance',nx:0.55,ny:0.6},{name:'Thrallmar',faction:'horde',nx:0.55,ny:0.4},{name:'Temple of Telhamat',faction:'alliance',nx:0.25,ny:0.5},{name:'Falcon Watch',faction:'horde',nx:0.28,ny:0.6},{name:'Shatter Point',faction:'neutral',nx:0.78,ny:0.35}]}),
  'nagrand': zone('nagrand','Nagrand','outland', 40000,180000,80000,60000, 64,67, 'contested','green floating-island plains', {borders:{north:'zangarmarsh',south:null,east:'terokkar',west:null},cities:[{name:'Telaar',faction:'alliance',nx:0.55,ny:0.7,tier:'town'},{name:'Garadar',faction:'horde',nx:0.55,ny:0.35,tier:'town'},{name:'Halaa',faction:'neutral',nx:0.4,ny:0.45,tier:'town'},{name:'Aeris Landing',faction:'neutral',nx:0.3,ny:0.55,tier:'town'}],dungeons:[],docks:[],flightpaths:[{name:'Telaar',faction:'alliance',nx:0.55,ny:0.7},{name:'Garadar',faction:'horde',nx:0.55,ny:0.35}]}),
  'terokkar': zone('terokkar','Terokkar Forest','outland', 120000,180000,80000,60000, 62,65, 'contested','misty forest and bone wastes', {borders:{north:'hellfire',south:'shadowmoon',east:null,west:'nagrand'},cities:[{name:'Shattrath City',faction:'neutral',nx:0.35,ny:0.25,tier:'capital'},{name:'Allerian Stronghold',faction:'alliance',nx:0.55,ny:0.55,tier:'town'},{name:'Stonebreaker Hold',faction:'horde',nx:0.5,ny:0.45,tier:'town'}],dungeons:[{name:'Mana-Tombs',nx:0.4,ny:0.6,levelMin:62,levelMax:66,kind:'dungeon'},{name:'Auchenai Crypts',nx:0.38,ny:0.62,levelMin:64,levelMax:67,kind:'dungeon'},{name:'Sethekk Halls',nx:0.36,ny:0.62,levelMin:66,levelMax:69,kind:'dungeon'},{name:'Shadow Labyrinth',nx:0.38,ny:0.65,levelMin:69,levelMax:70,kind:'dungeon'}],docks:[],flightpaths:[{name:'Shattrath City',faction:'neutral',nx:0.35,ny:0.25},{name:'Allerian Stronghold',faction:'alliance',nx:0.55,ny:0.55},{name:'Stonebreaker Hold',faction:'horde',nx:0.5,ny:0.45}]}),
  'shadowmoon': zone('shadowmoon','Shadowmoon Valley','outland', 160000,240000,120000,60000, 67,70, 'contested','fel-green volcanic valley', {borders:{north:'terokkar',south:null,east:null,west:null},cities:[{name:'Wildhammer Stronghold',faction:'alliance',nx:0.35,ny:0.55,tier:'town'},{name:'Shadowmoon Village',faction:'horde',nx:0.3,ny:0.3,tier:'town'},{name:'Sanctum of the Stars',faction:'neutral',nx:0.55,ny:0.6,tier:'town'},{name:'Altar of Sha\'tar',faction:'neutral',nx:0.6,ny:0.3,tier:'town'}],dungeons:[{name:'Black Temple',nx:0.7,ny:0.45,levelMin:70,levelMax:70,kind:'raid'}],docks:[],flightpaths:[{name:'Wildhammer Stronghold',faction:'alliance',nx:0.35,ny:0.55},{name:'Shadowmoon Village',faction:'horde',nx:0.3,ny:0.3},{name:'Sanctum of the Stars',faction:'neutral',nx:0.55,ny:0.6},{name:'Altar of Sha\'tar',faction:'neutral',nx:0.6,ny:0.3}]}),
  'quel-danas': zone('quel-danas','Isle of Quel\'Danas','eastern-kingdoms', 260000,0,40000,40000, 70,70, 'contested','sunlit elven isle', {borders:{north:null,south:'eversong',east:null,west:null},cities:[{name:'Sun\'s Reach',faction:'neutral',nx:0.5,ny:0.45,tier:'town'}],dungeons:[{name:'Magisters\' Terrace',nx:0.55,ny:0.3,levelMin:70,levelMax:70,kind:'dungeon'},{name:'Sunwell Plateau',nx:0.62,ny:0.18,levelMin:70,levelMax:70,kind:'raid'}],docks:[],flightpaths:[{name:'Sun\'s Reach',faction:'neutral',nx:0.5,ny:0.45}]}),
// [/GENERATED:ZONES]
});

// ── Transport route table ────────────────────────────────────────────────────
function transport(id: string, kind: TransportKind, fromZone: string, fromDock: string,
  toZone: string, toDock: string, durationSec: number, faction: FactionId): AtlasTransport {
  const fz = ZONES[fromZone], tz = ZONES[toZone];
  return Object.freeze({ id, kind, durationSec, faction,
    from: Object.freeze({ continent: fz.continent, zone: fromZone, dock: fromDock }),
    to: Object.freeze({ continent: tz.continent, zone: toZone, dock: toDock }) });
}
export const TRANSPORTS: readonly AtlasTransport[] = Object.freeze([
// [GENERATED:TRANSPORTS]
  transport('ship-teldrassil-darkshore-ruttheranvillage-auberdine','ship','teldrassil','Rut\'theran Village','darkshore','Auberdine',60,'contested'),
  transport('ship-darkshore-azuremyst-auberdine-valaarsberth','ship','darkshore','Auberdine','azuremyst','Valaar\'s Berth',90,'contested'),
  transport('ship-darkshore-elwynn-auberdine-stormwindharbor','ship','darkshore','Auberdine','elwynn','Stormwind Harbor',120,'contested'),
  transport('ship-wetlands-dustwallow-menethilharbor-theramoreisle','ship','wetlands','Menethil Harbor','dustwallow','Theramore Isle',180,'contested'),
  transport('ship-wetlands-borean-tundra-menethilharbor-valiancekeep','ship','wetlands','Menethil Harbor','borean-tundra','Valiance Keep',300,'contested'),
  transport('ship-elwynn-borean-tundra-stormwindharbor-valiancekeep','ship','elwynn','Stormwind Harbor','borean-tundra','Valiance Keep',300,'contested'),
  transport('ship-stranglethorn-barrens-north-bootybay-ratchet','ship','stranglethorn','Booty Bay','barrens-north','Ratchet',240,'contested'),
  transport('ship-wetlands-howling-fjord-menethilharbor-valgarde','ship','wetlands','Menethil Harbor','howling-fjord','Valgarde',300,'contested'),
  transport('turtle-borean-tundra-dragonblight-unupe-moakiharbor','turtle','borean-tundra','Unu\'pe','dragonblight','Moa\'ki Harbor',180,'contested'),
  transport('turtle-dragonblight-howling-fjord-moakiharbor-kamagua','turtle','dragonblight','Moa\'ki Harbor','howling-fjord','Kamagua',180,'contested'),
  transport('zeppelin-durotar-tirisfal-orgrimmarzeppelintower-undercityzeppelintower','zeppelin','durotar','Orgrimmar Zeppelin Tower','tirisfal','Undercity Zeppelin Tower',120,'contested'),
  transport('zeppelin-durotar-borean-tundra-orgrimmarzeppelintower-warsongholdzeppelintower','zeppelin','durotar','Orgrimmar Zeppelin Tower','borean-tundra','Warsong Hold Zeppelin Tower',300,'contested'),
  transport('zeppelin-tirisfal-stranglethorn-undercityzeppelintower-gromgolzeppelintower','zeppelin','tirisfal','Undercity Zeppelin Tower','stranglethorn','Grom\'gol Zeppelin Tower',180,'contested'),
  transport('zeppelin-tirisfal-howling-fjord-undercityzeppelintower-vengeancelandingzeppelint','zeppelin','tirisfal','Undercity Zeppelin Tower','howling-fjord','Vengeance Landing Zeppelin Tower',300,'contested'),
  transport('tram-dun-morogh-elwynn-deepruntramironforge-deepruntramstormwind','tram','dun-morogh','Deeprun Tram (Ironforge)','elwynn','Deeprun Tram (Stormwind)',60,'contested'),
  transport('portal-teldrassil-teldrassil-ruttheranvillage-darnassus','portal','teldrassil','Rut\'theran Village','teldrassil','Darnassus',5,'contested'),
  transport('portal-azuremyst-teldrassil-theexodar-darnassus','portal','azuremyst','The Exodar','teldrassil','Darnassus',5,'contested'),
  transport('portal-eversong-tirisfal-silvermooncity-undercity','portal','eversong','Silvermoon City','tirisfal','Undercity',5,'contested'),
  transport('portal-tirisfal-eversong-undercity-silvermooncity','portal','tirisfal','Undercity','eversong','Silvermoon City',5,'contested'),
  transport('portal-blasted-lands-hellfire-thedarkportal-thedarkportal','portal','blasted-lands','The Dark Portal','hellfire','The Dark Portal',10,'contested'),
  transport('portal-terokkar-durotar-shattrathcity-orgrimmar','portal','terokkar','Shattrath City','durotar','Orgrimmar',5,'contested'),
  transport('portal-terokkar-mulgore-shattrathcity-thunderbluff','portal','terokkar','Shattrath City','mulgore','Thunder Bluff',5,'contested'),
  transport('portal-terokkar-tirisfal-shattrathcity-undercity','portal','terokkar','Shattrath City','tirisfal','Undercity',5,'contested'),
  transport('portal-terokkar-eversong-shattrathcity-silvermooncity','portal','terokkar','Shattrath City','eversong','Silvermoon City',5,'contested'),
  transport('portal-terokkar-elwynn-shattrathcity-stormwindcity','portal','terokkar','Shattrath City','elwynn','Stormwind City',5,'contested'),
  transport('portal-terokkar-dun-morogh-shattrathcity-ironforge','portal','terokkar','Shattrath City','dun-morogh','Ironforge',5,'contested'),
  transport('portal-terokkar-teldrassil-shattrathcity-darnassus','portal','terokkar','Shattrath City','teldrassil','Darnassus',5,'contested'),
  transport('portal-terokkar-azuremyst-shattrathcity-theexodar','portal','terokkar','Shattrath City','azuremyst','The Exodar',5,'contested'),
  transport('portal-crystalsong-wintergrasp-dalaran-wintergraspfortress','portal','crystalsong','Dalaran','wintergrasp','Wintergrasp Fortress',5,'contested'),
  transport('portal-crystalsong-tanaris-dalaran-cavernsoftime','portal','crystalsong','Dalaran','tanaris','Caverns of Time',5,'contested'),
  transport('portal-crystalsong-durotar-dalaran-orgrimmar','portal','crystalsong','Dalaran','durotar','Orgrimmar',5,'contested'),
  transport('portal-crystalsong-eversong-dalaran-silvermooncity','portal','crystalsong','Dalaran','eversong','Silvermoon City',5,'contested'),
  transport('portal-crystalsong-tirisfal-dalaran-undercity','portal','crystalsong','Dalaran','tirisfal','Undercity',5,'contested'),
  transport('portal-crystalsong-mulgore-dalaran-thunderbluff','portal','crystalsong','Dalaran','mulgore','Thunder Bluff',5,'contested'),
  transport('portal-crystalsong-elwynn-dalaran-stormwindcity','portal','crystalsong','Dalaran','elwynn','Stormwind City',5,'contested'),
  transport('portal-crystalsong-dun-morogh-dalaran-ironforge','portal','crystalsong','Dalaran','dun-morogh','Ironforge',5,'contested'),
  transport('portal-crystalsong-teldrassil-dalaran-darnassus','portal','crystalsong','Dalaran','teldrassil','Darnassus',5,'contested'),
  transport('portal-crystalsong-azuremyst-dalaran-theexodar','portal','crystalsong','Dalaran','azuremyst','The Exodar',5,'contested'),
  transport('flightpath-durotar-barrens-north-orgrimmar-thecrossroads','flightpath','durotar','Orgrimmar','barrens-north','The Crossroads',90,'contested'),
  transport('flightpath-durotar-azshara-orgrimmar-valormok','flightpath','durotar','Orgrimmar','azshara','Valormok',120,'contested'),
  transport('flightpath-durotar-mulgore-orgrimmar-thunderbluff','flightpath','durotar','Orgrimmar','mulgore','Thunder Bluff',150,'contested'),
  transport('flightpath-durotar-barrens-north-orgrimmar-ratchet','flightpath','durotar','Orgrimmar','barrens-north','Ratchet',100,'contested'),
  transport('flightpath-barrens-north-mulgore-thecrossroads-thunderbluff','flightpath','barrens-north','The Crossroads','mulgore','Thunder Bluff',120,'contested'),
  transport('flightpath-barrens-north-stonetalon-thecrossroads-sunrockretreat','flightpath','barrens-north','The Crossroads','stonetalon','Sun Rock Retreat',90,'contested'),
  transport('flightpath-barrens-north-ashenvale-thecrossroads-splintertreepost','flightpath','barrens-north','The Crossroads','ashenvale','Splintertree Post',90,'contested'),
  transport('flightpath-barrens-north-barrens-south-thecrossroads-camptaurajo','flightpath','barrens-north','The Crossroads','barrens-south','Camp Taurajo',80,'contested'),
  transport('flightpath-barrens-north-dustwallow-ratchet-theramoreisle','flightpath','barrens-north','Ratchet','dustwallow','Theramore Isle',120,'contested'),
  transport('flightpath-barrens-south-dustwallow-camptaurajo-brackenwallvillage','flightpath','barrens-south','Camp Taurajo','dustwallow','Brackenwall Village',80,'contested'),
  transport('flightpath-barrens-south-thousand-needles-camptaurajo-freewindpost','flightpath','barrens-south','Camp Taurajo','thousand-needles','Freewind Post',80,'contested'),
  transport('flightpath-barrens-south-mulgore-camptaurajo-thunderbluff','flightpath','barrens-south','Camp Taurajo','mulgore','Thunder Bluff',100,'contested'),
  transport('flightpath-stonetalon-ashenvale-sunrockretreat-splintertreepost','flightpath','stonetalon','Sun Rock Retreat','ashenvale','Splintertree Post',80,'contested'),
  transport('flightpath-stonetalon-desolace-sunrockretreat-shadowpreyvillage','flightpath','stonetalon','Sun Rock Retreat','desolace','Shadowprey Village',100,'contested'),
  transport('flightpath-stonetalon-desolace-stonetalonpeak-nijelspoint','flightpath','stonetalon','Stonetalon Peak','desolace','Nijel\'s Point',90,'contested'),
  transport('flightpath-ashenvale-darkshore-astranaar-auberdine','flightpath','ashenvale','Astranaar','darkshore','Auberdine',100,'contested'),
  transport('flightpath-ashenvale-darkshore-astranaar-groveoftheancients','flightpath','ashenvale','Astranaar','darkshore','Grove of the Ancients',70,'contested'),
  transport('flightpath-ashenvale-azshara-splintertreepost-valormok','flightpath','ashenvale','Splintertree Post','azshara','Valormok',80,'contested'),
  transport('flightpath-ashenvale-azshara-forestsong-valormok','flightpath','ashenvale','Forest Song','azshara','Valormok',70,'contested'),
  transport('flightpath-ashenvale-darkshore-zoramgaroutpost-auberdine','flightpath','ashenvale','Zoram\'gar Outpost','darkshore','Auberdine',110,'contested'),
  transport('flightpath-ashenvale-felwood-astranaar-emeraldsanctuary','flightpath','ashenvale','Astranaar','felwood','Emerald Sanctuary',100,'contested'),
  transport('flightpath-desolace-feralas-nijelspoint-feathermoonstronghold','flightpath','desolace','Nijel\'s Point','feralas','Feathermoon Stronghold',150,'contested'),
  transport('flightpath-desolace-feralas-shadowpreyvillage-campmojache','flightpath','desolace','Shadowprey Village','feralas','Camp Mojache',120,'contested'),
  transport('flightpath-feralas-thousand-needles-campmojache-freewindpost','flightpath','feralas','Camp Mojache','thousand-needles','Freewind Post',100,'contested'),
  transport('flightpath-feralas-thousand-needles-thalanaar-freewindpost','flightpath','feralas','Thalanaar','thousand-needles','Freewind Post',80,'contested'),
  transport('flightpath-feralas-thousand-needles-feathermoonstronghold-freewindpost','flightpath','feralas','Feathermoon Stronghold','thousand-needles','Freewind Post',140,'contested'),
  transport('flightpath-thousand-needles-tanaris-freewindpost-gadgetzan','flightpath','thousand-needles','Freewind Post','tanaris','Gadgetzan',120,'contested'),
  transport('flightpath-tanaris-ungoro-gadgetzan-marshalsrefuge','flightpath','tanaris','Gadgetzan','ungoro','Marshal\'s Refuge',100,'contested'),
  transport('flightpath-ungoro-silithus-marshalsrefuge-cenarionhold','flightpath','ungoro','Marshal\'s Refuge','silithus','Cenarion Hold',110,'contested'),
  transport('flightpath-dustwallow-dustwallow-theramoreisle-mudsprocket','flightpath','dustwallow','Theramore Isle','dustwallow','Mudsprocket',60,'contested'),
  transport('flightpath-dustwallow-dustwallow-brackenwallvillage-mudsprocket','flightpath','dustwallow','Brackenwall Village','dustwallow','Mudsprocket',60,'contested'),
  transport('flightpath-dustwallow-tanaris-mudsprocket-gadgetzan','flightpath','dustwallow','Mudsprocket','tanaris','Gadgetzan',90,'contested'),
  transport('flightpath-felwood-felwood-emeraldsanctuary-bloodvenompost','flightpath','felwood','Emerald Sanctuary','felwood','Bloodvenom Post',60,'contested'),
  transport('flightpath-felwood-felwood-bloodvenompost-talonbranchglade','flightpath','felwood','Bloodvenom Post','felwood','Talonbranch Glade',60,'contested'),
  transport('flightpath-felwood-winterspring-talonbranchglade-everlook','flightpath','felwood','Talonbranch Glade','winterspring','Everlook',90,'contested'),
  transport('flightpath-felwood-moonglade-emeraldsanctuary-nighthaven','flightpath','felwood','Emerald Sanctuary','moonglade','Nighthaven',70,'contested'),
  transport('flightpath-moonglade-winterspring-nighthaven-everlook','flightpath','moonglade','Nighthaven','winterspring','Everlook',80,'contested'),
  transport('flightpath-moonglade-teldrassil-nighthaven-darnassus','flightpath','moonglade','Nighthaven','teldrassil','Darnassus',150,'contested'),
  transport('flightpath-moonglade-mulgore-nighthaven-thunderbluff','flightpath','moonglade','Nighthaven','mulgore','Thunder Bluff',160,'contested'),
  transport('flightpath-darkshore-teldrassil-auberdine-ruttheranvillage','flightpath','darkshore','Auberdine','teldrassil','Rut\'theran Village',60,'contested'),
  transport('flightpath-darkshore-teldrassil-auberdine-darnassus','flightpath','darkshore','Auberdine','teldrassil','Darnassus',80,'contested'),
  transport('flightpath-azuremyst-azuremyst-theexodar-azurewatch','flightpath','azuremyst','The Exodar','azuremyst','Azure Watch',40,'contested'),
  transport('flightpath-azuremyst-bloodmyst-theexodar-bloodwatch','flightpath','azuremyst','The Exodar','bloodmyst','Blood Watch',60,'contested'),
  transport('flightpath-azshara-ashenvale-talrendispoint-forestsong','flightpath','azshara','Talrendis Point','ashenvale','Forest Song',70,'contested'),
  transport('flightpath-elwynn-dun-morogh-stormwindcity-ironforge','flightpath','elwynn','Stormwind City','dun-morogh','Ironforge',150,'contested'),
  transport('flightpath-elwynn-elwynn-stormwindcity-goldshire','flightpath','elwynn','Stormwind City','elwynn','Goldshire',30,'contested'),
  transport('flightpath-elwynn-westfall-stormwindcity-sentinelhill','flightpath','elwynn','Stormwind City','westfall','Sentinel Hill',80,'contested'),
  transport('flightpath-elwynn-redridge-stormwindcity-lakeshire','flightpath','elwynn','Stormwind City','redridge','Lakeshire',80,'contested'),
  transport('flightpath-elwynn-duskwood-stormwindcity-darkshire','flightpath','elwynn','Stormwind City','duskwood','Darkshire',100,'contested'),
  transport('flightpath-westfall-duskwood-sentinelhill-ravenhill','flightpath','westfall','Sentinel Hill','duskwood','Raven Hill',80,'contested'),
  transport('flightpath-duskwood-duskwood-ravenhill-darkshire','flightpath','duskwood','Raven Hill','duskwood','Darkshire',60,'contested'),
  transport('flightpath-duskwood-stranglethorn-darkshire-rebelcamp','flightpath','duskwood','Darkshire','stranglethorn','Rebel Camp',70,'contested'),
  transport('flightpath-stranglethorn-stranglethorn-rebelcamp-bootybay','flightpath','stranglethorn','Rebel Camp','stranglethorn','Booty Bay',120,'contested'),
  transport('flightpath-stranglethorn-stranglethorn-gromgolbasecamp-bootybay','flightpath','stranglethorn','Grom\'gol Base Camp','stranglethorn','Booty Bay',90,'contested'),
  transport('flightpath-duskwood-deadwind-darkshire-karazhan','flightpath','duskwood','Darkshire','deadwind','Karazhan',60,'contested'),
  transport('flightpath-redridge-burning-steppes-lakeshire-morgansvigil','flightpath','redridge','Lakeshire','burning-steppes','Morgan\'s Vigil',90,'contested'),
  transport('flightpath-burning-steppes-burning-steppes-morgansvigil-flamecrest','flightpath','burning-steppes','Morgan\'s Vigil','burning-steppes','Flame Crest',60,'contested'),
  transport('flightpath-burning-steppes-searing-gorge-flamecrest-thoriumpoint','flightpath','burning-steppes','Flame Crest','searing-gorge','Thorium Point',60,'contested'),
  transport('flightpath-searing-gorge-badlands-thoriumpoint-kargath','flightpath','searing-gorge','Thorium Point','badlands','Kargath',80,'contested'),
  transport('flightpath-badlands-loch-modan-kargath-thelsamar','flightpath','badlands','Kargath','loch-modan','Thelsamar',90,'contested'),
  transport('flightpath-loch-modan-dun-morogh-thelsamar-ironforge','flightpath','loch-modan','Thelsamar','dun-morogh','Ironforge',80,'contested'),
  transport('flightpath-loch-modan-wetlands-thelsamar-menethilharbor','flightpath','loch-modan','Thelsamar','wetlands','Menethil Harbor',90,'contested'),
  transport('flightpath-wetlands-arathi-menethilharbor-refugepointe','flightpath','wetlands','Menethil Harbor','arathi','Refuge Pointe',80,'contested'),
  transport('flightpath-arathi-hillsbrad-refugepointe-southshore','flightpath','arathi','Refuge Pointe','hillsbrad','Southshore',80,'contested'),
  transport('flightpath-arathi-hillsbrad-hammerfall-tarrenmill','flightpath','arathi','Hammerfall','hillsbrad','Tarren Mill',80,'contested'),
  transport('flightpath-hillsbrad-hinterlands-southshore-aeriepeak','flightpath','hillsbrad','Southshore','hinterlands','Aerie Peak',100,'contested'),
  transport('flightpath-hillsbrad-hinterlands-tarrenmill-revantuskvillage','flightpath','hillsbrad','Tarren Mill','hinterlands','Revantusk Village',110,'contested'),
  transport('flightpath-hillsbrad-silverpine-tarrenmill-thesepulcher','flightpath','hillsbrad','Tarren Mill','silverpine','The Sepulcher',80,'contested'),
  transport('flightpath-silverpine-tirisfal-thesepulcher-undercity','flightpath','silverpine','The Sepulcher','tirisfal','Undercity',80,'contested'),
  transport('flightpath-tirisfal-tirisfal-undercity-thebulwark','flightpath','tirisfal','Undercity','tirisfal','The Bulwark',60,'contested'),
  transport('flightpath-tirisfal-western-plaguelands-thebulwark-chillwindcamp','flightpath','tirisfal','The Bulwark','western-plaguelands','Chillwind Camp',60,'contested'),
  transport('flightpath-western-plaguelands-eastern-plaguelands-chillwindcamp-lightshopechape','flightpath','western-plaguelands','Chillwind Camp','eastern-plaguelands','Light\'s Hope Chapel',100,'contested'),
  transport('flightpath-hinterlands-eastern-plaguelands-aeriepeak-lightshopechapel','flightpath','hinterlands','Aerie Peak','eastern-plaguelands','Light\'s Hope Chapel',120,'contested'),
  transport('flightpath-eastern-plaguelands-ghostlands-lightshopechapel-zulaman','flightpath','eastern-plaguelands','Light\'s Hope Chapel','ghostlands','Zul\'Aman',80,'contested'),
  transport('flightpath-ghostlands-ghostlands-zulaman-tranquillien','flightpath','ghostlands','Zul\'Aman','ghostlands','Tranquillien',50,'contested'),
  transport('flightpath-ghostlands-eversong-tranquillien-silvermooncity','flightpath','ghostlands','Tranquillien','eversong','Silvermoon City',80,'contested'),
  transport('flightpath-eversong-eversong-silvermooncity-fairbreezevillage','flightpath','eversong','Silvermoon City','eversong','Fairbreeze Village',40,'contested'),
  transport('flightpath-swamp-of-sorrows-blasted-lands-stonard-nethergardekeep','flightpath','swamp-of-sorrows','Stonard','blasted-lands','Nethergarde Keep',90,'contested'),
  transport('flightpath-swamp-of-sorrows-stranglethorn-stonard-gromgolbasecamp','flightpath','swamp-of-sorrows','Stonard','stranglethorn','Grom\'gol Base Camp',120,'contested'),
  transport('flightpath-dun-morogh-searing-gorge-ironforge-thoriumpoint','flightpath','dun-morogh','Ironforge','searing-gorge','Thorium Point',90,'contested'),
  transport('flightpath-dun-morogh-wetlands-ironforge-menethilharbor','flightpath','dun-morogh','Ironforge','wetlands','Menethil Harbor',100,'contested'),
  transport('flightpath-borean-tundra-borean-tundra-valiancekeep-amberledge','flightpath','borean-tundra','Valiance Keep','borean-tundra','Amber Ledge',80,'contested'),
  transport('flightpath-borean-tundra-borean-tundra-warsonghold-amberledge','flightpath','borean-tundra','Warsong Hold','borean-tundra','Amber Ledge',80,'contested'),
  transport('flightpath-borean-tundra-borean-tundra-amberledge-transitusshield','flightpath','borean-tundra','Amber Ledge','borean-tundra','Transitus Shield',40,'contested'),
  transport('flightpath-borean-tundra-borean-tundra-valiancekeep-unupe','flightpath','borean-tundra','Valiance Keep','borean-tundra','Unu\'pe',70,'contested'),
  transport('flightpath-borean-tundra-dragonblight-unupe-moakiharbor','flightpath','borean-tundra','Unu\'pe','dragonblight','Moa\'ki Harbor',80,'contested'),
  transport('flightpath-borean-tundra-sholazar-amberledge-nesingwarybasecamp','flightpath','borean-tundra','Amber Ledge','sholazar','Nesingwary Base Camp',90,'contested'),
  transport('flightpath-sholazar-sholazar-nesingwarybasecamp-riversheart','flightpath','sholazar','Nesingwary Base Camp','sholazar','River\'s Heart',50,'contested'),
  transport('flightpath-sholazar-wintergrasp-riversheart-valiancelandingcamp','flightpath','sholazar','River\'s Heart','wintergrasp','Valiance Landing Camp',70,'contested'),
  transport('flightpath-dragonblight-dragonblight-moakiharbor-wyrmresttemple','flightpath','dragonblight','Moa\'ki Harbor','dragonblight','Wyrmrest Temple',60,'contested'),
  transport('flightpath-dragonblight-dragonblight-wyrmresttemple-agmarshammer','flightpath','dragonblight','Wyrmrest Temple','dragonblight','Agmar\'s Hammer',50,'contested'),
  transport('flightpath-dragonblight-dragonblight-wyrmresttemple-wintergardekeep','flightpath','dragonblight','Wyrmrest Temple','dragonblight','Wintergarde Keep',60,'contested'),
  transport('flightpath-dragonblight-dragonblight-wyrmresttemple-starsrest','flightpath','dragonblight','Wyrmrest Temple','dragonblight','Stars\' Rest',50,'contested'),
  transport('flightpath-dragonblight-dragonblight-wyrmresttemple-venomspite','flightpath','dragonblight','Wyrmrest Temple','dragonblight','Venomspite',50,'contested'),
  transport('flightpath-dragonblight-grizzly-hills-wintergardekeep-amberpinelodge','flightpath','dragonblight','Wintergarde Keep','grizzly-hills','Amberpine Lodge',70,'contested'),
  transport('flightpath-dragonblight-grizzly-hills-venomspite-conquesthold','flightpath','dragonblight','Venomspite','grizzly-hills','Conquest Hold',70,'contested'),
  transport('flightpath-dragonblight-crystalsong-wyrmresttemple-dalaran','flightpath','dragonblight','Wyrmrest Temple','crystalsong','Dalaran',80,'contested'),
  transport('flightpath-grizzly-hills-grizzly-hills-amberpinelodge-westfallbrigadeencampment','flightpath','grizzly-hills','Amberpine Lodge','grizzly-hills','Westfall Brigade Encampment',60,'contested'),
  transport('flightpath-grizzly-hills-grizzly-hills-conquesthold-camponeqwah','flightpath','grizzly-hills','Conquest Hold','grizzly-hills','Camp Oneqwah',60,'contested'),
  transport('flightpath-grizzly-hills-zuldrak-westfallbrigadeencampment-theargentstand','flightpath','grizzly-hills','Westfall Brigade Encampment','zuldrak','The Argent Stand',80,'contested'),
  transport('flightpath-grizzly-hills-zuldrak-camponeqwah-theargentstand','flightpath','grizzly-hills','Camp Oneqwah','zuldrak','The Argent Stand',80,'contested'),
  transport('flightpath-grizzly-hills-howling-fjord-amberpinelodge-fortwildervar','flightpath','grizzly-hills','Amberpine Lodge','howling-fjord','Fort Wildervar',80,'contested'),
  transport('flightpath-grizzly-hills-howling-fjord-conquesthold-campwinterhoof','flightpath','grizzly-hills','Conquest Hold','howling-fjord','Camp Winterhoof',80,'contested'),
  transport('flightpath-howling-fjord-howling-fjord-valgarde-westguardkeep','flightpath','howling-fjord','Valgarde','howling-fjord','Westguard Keep',70,'contested'),
  transport('flightpath-howling-fjord-howling-fjord-valgarde-fortwildervar','flightpath','howling-fjord','Valgarde','howling-fjord','Fort Wildervar',80,'contested'),
  transport('flightpath-howling-fjord-howling-fjord-vengeancelanding-newagamand','flightpath','howling-fjord','Vengeance Landing','howling-fjord','New Agamand',60,'contested'),
  transport('flightpath-howling-fjord-howling-fjord-vengeancelanding-campwinterhoof','flightpath','howling-fjord','Vengeance Landing','howling-fjord','Camp Winterhoof',70,'contested'),
  transport('flightpath-howling-fjord-howling-fjord-kamagua-westguardkeep','flightpath','howling-fjord','Kamagua','howling-fjord','Westguard Keep',50,'contested'),
  transport('flightpath-zuldrak-zuldrak-theargentstand-zimtorga','flightpath','zuldrak','The Argent Stand','zuldrak','Zim\'Torga',50,'contested'),
  transport('flightpath-zuldrak-zuldrak-theargentstand-lightsbreach','flightpath','zuldrak','The Argent Stand','zuldrak','Light\'s Breach',40,'contested'),
  transport('flightpath-zuldrak-zuldrak-lightsbreach-ebonwatch','flightpath','zuldrak','Light\'s Breach','zuldrak','Ebon Watch',40,'contested'),
  transport('flightpath-zuldrak-storm-peaks-zimtorga-k3','flightpath','zuldrak','Zim\'Torga','storm-peaks','K3',90,'contested'),
  transport('flightpath-zuldrak-crystalsong-theargentstand-dalaran','flightpath','zuldrak','The Argent Stand','crystalsong','Dalaran',90,'contested'),
  transport('flightpath-storm-peaks-storm-peaks-k3-frosthold','flightpath','storm-peaks','K3','storm-peaks','Frosthold',60,'contested'),
  transport('flightpath-storm-peaks-storm-peaks-k3-gromarshcrashsite','flightpath','storm-peaks','K3','storm-peaks','Grom\'arsh Crash-Site',60,'contested'),
  transport('flightpath-storm-peaks-storm-peaks-frosthold-bouldercragsrefuge','flightpath','storm-peaks','Frosthold','storm-peaks','Bouldercrag\'s Refuge',60,'contested'),
  transport('flightpath-storm-peaks-storm-peaks-gromarshcrashsite-dunniffelem','flightpath','storm-peaks','Grom\'arsh Crash-Site','storm-peaks','Dun Niffelem',60,'contested'),
  transport('flightpath-storm-peaks-storm-peaks-bouldercragsrefuge-ulduar','flightpath','storm-peaks','Bouldercrag\'s Refuge','storm-peaks','Ulduar',50,'contested'),
  transport('flightpath-storm-peaks-icecrown-ulduar-theargentvanguard','flightpath','storm-peaks','Ulduar','icecrown','The Argent Vanguard',90,'contested'),
  transport('flightpath-crystalsong-icecrown-dalaran-theargentvanguard','flightpath','crystalsong','Dalaran','icecrown','The Argent Vanguard',90,'contested'),
  transport('flightpath-crystalsong-crystalsong-dalaran-windrunnersoverlook','flightpath','crystalsong','Dalaran','crystalsong','Windrunner\'s Overlook',50,'contested'),
  transport('flightpath-crystalsong-crystalsong-dalaran-sunreaverscommand','flightpath','crystalsong','Dalaran','crystalsong','Sunreaver\'s Command',50,'contested'),
  transport('flightpath-icecrown-icecrown-theargentvanguard-crusaderspinnacle','flightpath','icecrown','The Argent Vanguard','icecrown','Crusaders\' Pinnacle',40,'contested'),
  transport('flightpath-icecrown-icecrown-crusaderspinnacle-theshadowvault','flightpath','icecrown','Crusaders\' Pinnacle','icecrown','The Shadow Vault',70,'contested'),
  transport('flightpath-icecrown-icecrown-theshadowvault-deathsrise','flightpath','icecrown','The Shadow Vault','icecrown','Death\'s Rise',60,'contested'),
  transport('flightpath-hellfire-hellfire-honorhold-templeoftelhamat','flightpath','hellfire','Honor Hold','hellfire','Temple of Telhamat',70,'contested'),
  transport('flightpath-hellfire-hellfire-thrallmar-falconwatch','flightpath','hellfire','Thrallmar','hellfire','Falcon Watch',60,'contested'),
  transport('flightpath-hellfire-hellfire-honorhold-shatterpoint','flightpath','hellfire','Honor Hold','hellfire','Shatter Point',60,'contested'),
  transport('flightpath-hellfire-hellfire-thrallmar-shatterpoint','flightpath','hellfire','Thrallmar','hellfire','Shatter Point',60,'contested'),
  transport('flightpath-hellfire-zangarmarsh-templeoftelhamat-telredor','flightpath','hellfire','Temple of Telhamat','zangarmarsh','Telredor',70,'contested'),
  transport('flightpath-hellfire-zangarmarsh-falconwatch-zabrajin','flightpath','hellfire','Falcon Watch','zangarmarsh','Zabra\'jin',80,'contested'),
  transport('flightpath-hellfire-zangarmarsh-falconwatch-swampratpost','flightpath','hellfire','Falcon Watch','zangarmarsh','Swamprat Post',50,'contested'),
  transport('flightpath-zangarmarsh-zangarmarsh-telredor-oreborharborage','flightpath','zangarmarsh','Telredor','zangarmarsh','Orebor Harborage',60,'contested'),
  transport('flightpath-zangarmarsh-zangarmarsh-telredor-cenarionrefuge','flightpath','zangarmarsh','Telredor','zangarmarsh','Cenarion Refuge',50,'contested'),
  transport('flightpath-zangarmarsh-zangarmarsh-zabrajin-cenarionrefuge','flightpath','zangarmarsh','Zabra\'jin','zangarmarsh','Cenarion Refuge',60,'contested'),
  transport('flightpath-zangarmarsh-blades-edge-oreborharborage-sylvanaar','flightpath','zangarmarsh','Orebor Harborage','blades-edge','Sylvanaar',70,'contested'),
  transport('flightpath-zangarmarsh-blades-edge-zabrajin-thunderlordstronghold','flightpath','zangarmarsh','Zabra\'jin','blades-edge','Thunderlord Stronghold',80,'contested'),
  transport('flightpath-zangarmarsh-terokkar-cenarionrefuge-shattrathcity','flightpath','zangarmarsh','Cenarion Refuge','terokkar','Shattrath City',80,'contested'),
  transport('flightpath-terokkar-terokkar-shattrathcity-allerianstronghold','flightpath','terokkar','Shattrath City','terokkar','Allerian Stronghold',50,'contested'),
  transport('flightpath-terokkar-terokkar-shattrathcity-stonebreakerhold','flightpath','terokkar','Shattrath City','terokkar','Stonebreaker Hold',50,'contested'),
  transport('flightpath-terokkar-nagrand-shattrathcity-telaar','flightpath','terokkar','Shattrath City','nagrand','Telaar',80,'contested'),
  transport('flightpath-terokkar-nagrand-shattrathcity-garadar','flightpath','terokkar','Shattrath City','nagrand','Garadar',80,'contested'),
  transport('flightpath-terokkar-shadowmoon-allerianstronghold-wildhammerstronghold','flightpath','terokkar','Allerian Stronghold','shadowmoon','Wildhammer Stronghold',90,'contested'),
  transport('flightpath-terokkar-shadowmoon-stonebreakerhold-shadowmoonvillage','flightpath','terokkar','Stonebreaker Hold','shadowmoon','Shadowmoon Village',90,'contested'),
  transport('flightpath-nagrand-zangarmarsh-telaar-telredor','flightpath','nagrand','Telaar','zangarmarsh','Telredor',90,'contested'),
  transport('flightpath-nagrand-zangarmarsh-garadar-zabrajin','flightpath','nagrand','Garadar','zangarmarsh','Zabra\'jin',90,'contested'),
  transport('flightpath-blades-edge-blades-edge-sylvanaar-toshleysstation','flightpath','blades-edge','Sylvanaar','blades-edge','Toshley\'s Station',50,'contested'),
  transport('flightpath-blades-edge-blades-edge-sylvanaar-evergrove','flightpath','blades-edge','Sylvanaar','blades-edge','Evergrove',50,'contested'),
  transport('flightpath-blades-edge-blades-edge-thunderlordstronghold-evergrove','flightpath','blades-edge','Thunderlord Stronghold','blades-edge','Evergrove',50,'contested'),
  transport('flightpath-blades-edge-netherstorm-evergrove-area52','flightpath','blades-edge','Evergrove','netherstorm','Area 52',80,'contested'),
  transport('flightpath-netherstorm-netherstorm-area52-thestormspire','flightpath','netherstorm','Area 52','netherstorm','The Stormspire',50,'contested'),
  transport('flightpath-netherstorm-netherstorm-area52-cosmowrench','flightpath','netherstorm','Area 52','netherstorm','Cosmowrench',60,'contested'),
  transport('flightpath-shadowmoon-shadowmoon-wildhammerstronghold-sanctumofthestars','flightpath','shadowmoon','Wildhammer Stronghold','shadowmoon','Sanctum of the Stars',60,'contested'),
  transport('flightpath-shadowmoon-shadowmoon-shadowmoonvillage-altarofshatar','flightpath','shadowmoon','Shadowmoon Village','shadowmoon','Altar of Sha\'tar',60,'contested'),
  transport('flightpath-shadowmoon-shadowmoon-sanctumofthestars-altarofshatar','flightpath','shadowmoon','Sanctum of the Stars','shadowmoon','Altar of Sha\'tar',50,'contested'),
  transport('zeppelin-durotar-stranglethorn-orgrimmarzeppelintower-gromgolzeppelintower','zeppelin','durotar','Orgrimmar Zeppelin Tower','stranglethorn','Grom\'gol Zeppelin Tower',180,'contested'),
  transport('portal-crystalsong-terokkar-dalaran-shattrathcity','portal','crystalsong','Dalaran','terokkar','Shattrath City',5,'contested'),
  transport('flightpath-eversong-quel-danas-silvermooncity-sunsreach','flightpath','eversong','Silvermoon City','quel-danas','Sun\'s Reach',50,'contested'),
  transport('portal-terokkar-quel-danas-shattrathcity-sunsreach','portal','terokkar','Shattrath City','quel-danas','Sun\'s Reach',5,'contested'),
// [/GENERATED:TRANSPORTS]
]);

// ── Lookups ──────────────────────────────────────────────────────────────────
// World-space rects are precomputed once at module init; zoneRect hands out a
// shared frozen object (never mutated by callers) so lookups stay alloc-free.
const WORLD_RECTS: Readonly<Record<string, AtlasRect>> = Object.freeze(
  Object.fromEntries(Object.values(ZONES).map(z => {
    const o = CONTINENTS[z.continent].origin;
    return [z.id, Object.freeze({ x: z.rect.x + o.x, y: z.rect.y + o.y, w: z.rect.w, h: z.rect.h })];
  })));

export const CONTINENT_BOUNDS: Readonly<Record<ContinentId, AtlasRect>> = Object.freeze(
  (Object.keys(CONTINENTS) as ContinentId[]).reduce((acc, cid) => {
    let x = Infinity, y = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const id in ZONES) {
      const z = ZONES[id]; if (z.continent !== cid) continue;
      const r = WORLD_RECTS[id];
      x = Math.min(x, r.x); y = Math.min(y, r.y);
      x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h);
    }
    acc[cid] = Object.freeze({ x, y, w: x2 - x, h: y2 - y });
    return acc;
  }, {} as Record<ContinentId, AtlasRect>));

// Coarse spatial hash: continent-local cell → zones covering it. zoneAt is O(1):
// continent check + one cell lookup + a handful of rect tests, no allocation.
const ZONE_CELL = 20000;
const CONTINENT_INDEX: Readonly<Record<ContinentId, number>> = Object.freeze(
  { 'kalimdor': 0, 'eastern-kingdoms': 1, 'northrend': 2, 'outland': 3 });
const ZONE_GRID = new Map<number, readonly AtlasZone[]>();
{
  const cells = new Map<number, AtlasZone[]>();
  for (const z of Object.values(ZONES)) {
    const x0 = Math.floor(z.rect.x / ZONE_CELL), x1 = Math.floor((z.rect.x + z.rect.w - 1) / ZONE_CELL);
    const y0 = Math.floor(z.rect.y / ZONE_CELL), y1 = Math.floor((z.rect.y + z.rect.h - 1) / ZONE_CELL);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const key = CONTINENT_INDEX[z.continent] * 65536 + cy * 256 + cx;
      let list = cells.get(key); if (!list) cells.set(key, list = []);
      list.push(z);
    }
  }
  for (const [k, v] of cells) ZONE_GRID.set(k, Object.freeze(v));
}

export function zoneRect(id: string): AtlasRect | null {
  return WORLD_RECTS[id] ?? null;
}
export function zoneAt(x: number, y: number): AtlasZone | null {
  const c = continentAt(x, y); if (!c) return null;
  const lx = x - c.origin.x, ly = y - c.origin.y;
  const key = CONTINENT_INDEX[c.id] * 65536 + Math.floor(ly / ZONE_CELL) * 256 + Math.floor(lx / ZONE_CELL);
  const cell = ZONE_GRID.get(key); if (!cell) return null;
  for (let i = 0; i < cell.length; i++) {
    const z = cell[i], r = z.rect;
    if (lx >= r.x && lx < r.x + r.w && ly >= r.y && ly < r.y + r.h) return z;
  }
  return null;
}
export function continentAt(x: number, y: number): AtlasContinent | null {
  for (const id in CONTINENT_BOUNDS) {
    const b = CONTINENT_BOUNDS[id as ContinentId];
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return CONTINENTS[id as ContinentId];
  }
  return null;
}
const ZONE_LEVELS: Readonly<Record<string, { min: number; max: number }>> = Object.freeze(
  Object.fromEntries(Object.values(ZONES).map(z => [z.id, Object.freeze({ min: z.levelMin, max: z.levelMax })])));
export function zoneLevel(x: number, y: number): { min: number; max: number } | null {
  const z = zoneAt(x, y);
  return z ? ZONE_LEVELS[z.id] : null;
}
export function zonePoint(id: string, nx: number, ny: number): AtlasPoint | null {
  const r = zoneRect(id); if (!r) return null;
  return { x: r.x + nx * r.w, y: r.y + ny * r.h };
}
