/** WoW WotLK world atlas — the single authoritative contract pinning every zone to an
 * exact rectangle in world space (wayfinder world-t01). Continent teams build content
 * INSIDE these fixed rects; nothing here moves once merged.
 *
 * Coordinates are world pixels. `SCALE` maps WoW yards → game units so travel times match
 * WoW: the player runs ~165 u/s and WoW runs ~7 yd/s, so 1 yard ≈ 23.6 units (24 rounded).
 * A ~1.1 km WoW zone is ~26,000 units across; a continent spans ~300,000+ units, so a
 * long cross-continent journey stays a real journey.
 *
 * Each continent owns a disjoint coordinate region separated by ocean. Zone rects are
 * authored in continent-local coordinates and offset by the continent origin. */

// ── Scale ────────────────────────────────────────────────────────────────────
/** Game units per WoW yard. Chosen so on-foot and mounted travel times match WotLK. */
export const ATLAS_SCALE = 24;
/** WoW yards per game unit (inverse). */
export const YARDS_PER_UNIT = 1 / ATLAS_SCALE;

// ── Factions / continents ────────────────────────────────────────────────────
export type FactionId = 'alliance' | 'horde' | 'neutral' | 'contested' | 'hostile';
export type ContinentId = 'kalimdor' | 'eastern-kingdoms' | 'northrend' | 'outland';

export interface AtlasPoint { readonly x: number; readonly y: number }
export interface AtlasRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

export interface AtlasCity {
  readonly name: string;
  readonly faction: FactionId;
  /** Normalized 0..1 position inside the zone rect. */
  readonly nx: number; readonly ny: number;
  /** City tier: capital has full services; town/village smaller. */
  readonly tier: 'capital' | 'town' | 'village' | 'outpost';
}

export interface AtlasDungeon {
  readonly name: string;
  /** Normalized 0..1 position inside the zone rect. */
  readonly nx: number; readonly ny: number;
  readonly levelMin: number; readonly levelMax: number;
  readonly kind: 'dungeon' | 'raid';
}

export interface AtlasDock {
  readonly name: string;
  readonly faction: FactionId;
  readonly nx: number; readonly ny: number;
  /** Transport route ids serving this dock. */
  readonly routes: readonly string[];
}

export interface AtlasFlightPath {
  readonly name: string;
  readonly faction: FactionId;
  readonly nx: number; readonly ny: number;
}

export interface AtlasZone {
  readonly id: string;
  readonly name: string;
  readonly continent: ContinentId;
  /** Continent-local rect (units). World rect = rect + continent origin. */
  readonly rect: AtlasRect;
  readonly levelMin: number; readonly levelMax: number;
  readonly faction: FactionId;
  /** Visual/terrain recipe key the zone builder consumes. */
  readonly terrain: string;
  /** Adjacent zone ids per side (null = ocean/edge). */
  readonly borders: { readonly north: string | null; readonly south: string | null; readonly east: string | null; readonly west: string | null };
  readonly cities: readonly AtlasCity[];
  readonly dungeons: readonly AtlasDungeon[];
  readonly docks: readonly AtlasDock[];
  readonly flightpaths: readonly AtlasFlightPath[];
}

export interface AtlasContinent {
  readonly id: ContinentId;
  readonly name: string;
  /** World-space origin (top-left) of this continent's local frame. */
  readonly origin: AtlasPoint;
  /** Local bounds containing all zone rects. */
  readonly bounds: AtlasRect;
}

// ── Transport routes ─────────────────────────────────────────────────────────
export type TransportKind = 'ship' | 'zeppelin' | 'portal' | 'flightpath';
export interface AtlasTransport {
  readonly id: string;
  readonly kind: TransportKind;
  /** Endpoint docks: { continent, zone, dock name }. */
  readonly from: { readonly continent: ContinentId; readonly zone: string; readonly dock: string };
  readonly to: { readonly continent: ContinentId; readonly zone: string; readonly dock: string };
  /** One-way ride time in seconds (WoW-scale). */
  readonly durationSec: number;
  readonly faction: FactionId;
}

// ── Continent origins (world space) ──────────────────────────────────────────
// Continents are laid out on a loose world grid, separated by wide ocean so no
// continent's landmass touches another's. Origins are far apart; each continent's
const CONTINENT_GAP = 1_000_000;

export const CONTINENTS: Readonly<Record<ContinentId, AtlasContinent>> = Object.freeze({
  'kalimdor':          Object.freeze({ id: 'kalimdor',          name: 'Kalimdor',          origin: { x: 0,               y: 0 },               bounds: { x: 0, y: 0, w: 0, h: 0 } }),
  'eastern-kingdoms':  Object.freeze({ id: 'eastern-kingdoms',  name: 'Eastern Kingdoms',  origin: { x: CONTINENT_GAP,   y: 0 },               bounds: { x: 0, y: 0, w: 0, h: 0 } }),
  'northrend':         Object.freeze({ id: 'northrend',         name: 'Northrend',         origin: { x: 0,               y: CONTINENT_GAP },   bounds: { x: 0, y: 0, w: 0, h: 0 } }),
  'outland':           Object.freeze({ id: 'outland',           name: 'Outland',           origin: { x: CONTINENT_GAP,   y: CONTINENT_GAP },   bounds: { x: 0, y: 0, w: 0, h: 0 } }),
});
// ── Zone table ───────────────────────────────────────────────────────────────
// Authored continent-local rects (units), validated non-overlapping + adjacency-
// consistent by wayfinder/build-atlas.mjs. Positions are FIXED — continent teams
// build content inside these rects and never move them.
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
  // ── KALIMDOR ──
  'teldrassil': zone('teldrassil','Teldrassil','kalimdor', 0,20000,60000,40000, 1,10, 'alliance','forest-purple'),
  'bloodmyst': zone('bloodmyst','Bloodmyst Isle','kalimdor', 0,100000,60000,40000, 10,20, 'alliance','fel-isle'),
  'azuremyst': zone('azuremyst','Azuremyst Isle','kalimdor', 0,140000,60000,60000, 1,10, 'alliance','forest-azure'),
  'moonglade': zone('moonglade','Moonglade','kalimdor', 140000,0,60000,40000, 1,80, 'neutral','forest-moon'),
  'winterspring': zone('winterspring','Winterspring','kalimdor', 200000,0,120000,60000, 55,60, 'contested','snow'),
  'darkshore': zone('darkshore','Darkshore','kalimdor', 80000,0,60000,120000, 10,20, 'alliance','coast-dark'),
  'felwood': zone('felwood','Felwood','kalimdor', 140000,60000,80000,60000, 48,55, 'contested','forest-fel'),
  'azshara': zone('azshara','Azshara','kalimdor', 220000,60000,100000,80000, 45,55, 'contested','coast-autumn'),
  'ashenvale': zone('ashenvale','Ashenvale','kalimdor', 80000,120000,140000,80000, 18,30, 'contested','forest-ashen'),
  'durotar': zone('durotar','Durotar','kalimdor', 240000,140000,80000,100000, 1,10, 'horde','desert-red'),
  'stonetalon': zone('stonetalon','Stonetalon Mountains','kalimdor', 80000,200000,60000,60000, 15,27, 'contested','mountain'),
  'barrens': zone('barrens','The Barrens','kalimdor', 140000,200000,100000,100000, 10,25, 'horde','savanna'),
  'dustwallow': zone('dustwallow','Dustwallow Marsh','kalimdor', 240000,240000,80000,60000, 35,45, 'contested','swamp'),
  'desolace': zone('desolace','Desolace','kalimdor', 80000,260000,60000,60000, 30,40, 'contested','waste'),
  'mulgore': zone('mulgore','Mulgore','kalimdor', 140000,300000,60000,60000, 1,10, 'horde','plains'),
  'thousand-needles': zone('thousand-needles','Thousand Needles','kalimdor', 200000,300000,40000,60000, 25,35, 'contested','canyon'),
  'feralas': zone('feralas','Feralas','kalimdor', 80000,320000,60000,40000, 40,50, 'contested','forest-lush'),
  'tanaris': zone('tanaris','Tanaris','kalimdor', 240000,300000,80000,100000, 40,50, 'contested','desert'),
  'ungoro': zone('ungoro','Un\'Goro Crater','kalimdor', 200000,360000,40000,40000, 48,55, 'contested','jungle-crater'),
  'silithus': zone('silithus','Silithus','kalimdor', 80000,360000,120000,40000, 55,60, 'contested','desert-silithid'),
  // ── EASTERN KINGDOMS ──
  'eversong': zone('eversong','Eversong Woods','eastern-kingdoms', 160000,0,120000,40000, 1,10, 'horde','forest-gold'),
  'ghostlands': zone('ghostlands','Ghostlands','eastern-kingdoms', 160000,40000,120000,20000, 10,20, 'horde','forest-dead'),
  'tirisfal': zone('tirisfal','Tirisfal Glades','eastern-kingdoms', 0,60000,80000,60000, 1,10, 'horde','forest-gloom'),
  'wpl': zone('wpl','Western Plaguelands','eastern-kingdoms', 80000,60000,80000,60000, 51,58, 'contested','plague'),
  'epl': zone('epl','Eastern Plaguelands','eastern-kingdoms', 160000,60000,120000,60000, 53,60, 'contested','plague'),
  'silverpine': zone('silverpine','Silverpine Forest','eastern-kingdoms', 0,120000,60000,60000, 10,20, 'horde','forest-silver'),
  'hillsbrad': zone('hillsbrad','Hillsbrad Foothills','eastern-kingdoms', 60000,120000,80000,60000, 20,30, 'contested','hills'),
  'hinterlands': zone('hinterlands','The Hinterlands','eastern-kingdoms', 160000,120000,120000,60000, 30,45, 'contested','forest-high'),
  'alterac': zone('alterac','Alterac Mountains','eastern-kingdoms', 60000,180000,80000,40000, 30,40, 'contested','mountain-snow'),
  'arathi': zone('arathi','Arathi Highlands','eastern-kingdoms', 140000,180000,80000,40000, 30,40, 'contested','highland'),
  'wetlands': zone('wetlands','Wetlands','eastern-kingdoms', 100000,220000,60000,40000, 20,30, 'contested','marsh'),
  'dun-morogh': zone('dun-morogh','Dun Morogh','eastern-kingdoms', 40000,220000,60000,60000, 1,10, 'alliance','snow'),
  'loch-modan': zone('loch-modan','Loch Modan','eastern-kingdoms', 100000,260000,60000,40000, 10,20, 'alliance','lake'),
  'searing-gorge': zone('searing-gorge','Searing Gorge','eastern-kingdoms', 60000,280000,40000,40000, 43,50, 'contested','volcanic'),
  'badlands': zone('badlands','Badlands','eastern-kingdoms', 120000,300000,60000,40000, 35,45, 'contested','badlands'),
  'burning-steppes': zone('burning-steppes','Burning Steppes','eastern-kingdoms', 60000,320000,60000,40000, 50,58, 'contested','volcanic'),
  'elwynn': zone('elwynn','Elwynn Forest','eastern-kingdoms', 0,280000,60000,60000, 1,10, 'alliance','forest'),
  'westfall': zone('westfall','Westfall','eastern-kingdoms', 0,340000,60000,60000, 10,20, 'alliance','plains-dry'),
  'redridge': zone('redridge','Redridge Mountains','eastern-kingdoms', 60000,360000,60000,40000, 15,25, 'contested','mountain-red'),
  'swamp-of-sorrows': zone('swamp-of-sorrows','Swamp of Sorrows','eastern-kingdoms', 120000,360000,60000,40000, 35,45, 'contested','swamp'),
  'duskwood': zone('duskwood','Duskwood','eastern-kingdoms', 0,400000,60000,60000, 18,30, 'contested','forest-dark'),
  'deadwind': zone('deadwind','Deadwind Pass','eastern-kingdoms', 60000,400000,60000,40000, 55,60, 'contested','dead'),
  'blasted-lands': zone('blasted-lands','Blasted Lands','eastern-kingdoms', 120000,400000,100000,60000, 45,55, 'contested','fel-waste'),
  'stranglethorn': zone('stranglethorn','Stranglethorn Vale','eastern-kingdoms', 0,460000,100000,40000, 30,45, 'contested','jungle'),
  // ── NORTHREND ──
  'icecrown': zone('icecrown','Icecrown','northrend', 60000,0,80000,60000, 77,80, 'hostile','ice'),
  'storm-peaks': zone('storm-peaks','The Storm Peaks','northrend', 140000,0,60000,60000, 77,80, 'contested','mountain-ice'),
  'zuldrak': zone('zuldrak','Zul\'Drak','northrend', 200000,0,80000,60000, 74,77, 'contested','troll-snow'),
  'sholazar': zone('sholazar','Sholazar Basin','northrend', 0,60000,80000,60000, 75,78, 'contested','jungle'),
  'crystalsong': zone('crystalsong','Crystalsong Forest','northrend', 80000,60000,80000,60000, 77,80, 'neutral','crystal'),
  'grizzly-hills': zone('grizzly-hills','Grizzly Hills','northrend', 200000,60000,80000,60000, 73,75, 'contested','forest-pine'),
  'borean-tundra': zone('borean-tundra','Borean Tundra','northrend', 0,120000,80000,80000, 68,72, 'contested','tundra'),
  'dragonblight': zone('dragonblight','Dragonblight','northrend', 80000,120000,120000,60000, 71,74, 'contested','snow-dragon'),
  'howling-fjord': zone('howling-fjord','Howling Fjord','northrend', 200000,120000,80000,80000, 68,72, 'contested','fjord'),
  'wintergrasp': zone('wintergrasp','Wintergrasp','northrend', 80000,180000,80000,20000, 80,80, 'contested','snow-pvp'),
  // ── OUTLAND ──
  'hellfire': zone('hellfire','Hellfire Peninsula','outland', 80000,0,80000,60000, 58,63, 'contested','fel-red'),
  'netherstorm': zone('netherstorm','Netherstorm','outland', 160000,0,80000,60000, 67,70, 'contested','arcane'),
  'zangarmarsh': zone('zangarmarsh','Zangarmarsh','outland', 0,60000,80000,60000, 60,64, 'contested','swamp-shroom'),
  'terokkar': zone('terokkar','Terokkar Forest','outland', 80000,60000,80000,60000, 62,65, 'contested','forest-terok'),
  'shadowmoon': zone('shadowmoon','Shadowmoon Valley','outland', 160000,60000,80000,100000, 67,70, 'contested','fel-green'),
  'nagrand': zone('nagrand','Nagrand','outland', 0,120000,80000,40000, 64,67, 'contested','plains-float'),
  'blades-edge': zone('blades-edge','Blade\'s Edge Mountains','outland', 80000,120000,80000,40000, 65,68, 'contested','mountain-spike'),
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
  transport('zep-org-uc','zeppelin','durotar','Orgrimmar','tirisfal','Undercity',120,'horde'),
  transport('zep-org-grom','zeppelin','durotar','Orgrimmar','stranglethorn','Grom\'gol',100,'horde'),
  transport('zep-uc-grom','zeppelin','tirisfal','Undercity','stranglethorn','Grom\'gol',110,'horde'),
  transport('zep-uc-vengeance','zeppelin','tirisfal','Undercity','howling-fjord','Vengeance Landing',150,'horde'),
  transport('zep-org-warsong','zeppelin','durotar','Orgrimmar','borean-tundra','Warsong Hold',150,'horde'),
  transport('ship-menethil-theramore','ship','wetlands','Menethil Harbor','dustwallow','Theramore Isle',120,'neutral'),
  transport('ship-menethil-auberdine','ship','wetlands','Menethil Harbor','darkshore','Auberdine',110,'alliance'),
  transport('ship-auberdine-ruttheran','ship','darkshore','Auberdine','teldrassil','Rut\'theran Village',60,'alliance'),
  transport('ship-auberdine-azuremyst','ship','darkshore','Auberdine','azuremyst','Valaar\'s Berth',80,'alliance'),
  transport('ship-ratchet-booty','ship','barrens','Ratchet','stranglethorn','Booty Bay',130,'neutral'),
  transport('ship-menethil-valgarde','ship','wetlands','Menethil Harbor','howling-fjord','Valgarde',160,'alliance'),
  transport('ship-stormwind-valiance','ship','elwynn','Stormwind Harbor','borean-tundra','Valiance Keep',160,'alliance'),
  transport('ship-stormwind-auberdine','ship','elwynn','Stormwind Harbor','darkshore','Auberdine',140,'alliance'),
  transport('portal-shattrath-stormwind','portal','terokkar','Shattrath','elwynn','Stormwind',5,'alliance'),
  transport('portal-shattrath-ironforge','portal','terokkar','Shattrath','dun-morogh','Ironforge',5,'alliance'),
  transport('portal-shattrath-darnassus','portal','terokkar','Shattrath','teldrassil','Darnassus',5,'alliance'),
  transport('portal-shattrath-exodar','portal','terokkar','Shattrath','azuremyst','Exodar',5,'alliance'),
  transport('portal-shattrath-orgrimmar','portal','terokkar','Shattrath','durotar','Orgrimmar',5,'horde'),
  transport('portal-shattrath-thunderbluff','portal','terokkar','Shattrath','mulgore','Thunder Bluff',5,'horde'),
  transport('portal-shattrath-undercity','portal','terokkar','Shattrath','tirisfal','Undercity',5,'horde'),
  transport('portal-shattrath-silvermoon','portal','terokkar','Shattrath','eversong','Silvermoon',5,'horde'),
  transport('portal-blasted-hellfire','portal','blasted-lands','Dark Portal','hellfire','Stair of Destiny',5,'neutral'),
  transport('portal-dalaran-crystalsong','portal','crystalsong','Dalaran','crystalsong','Dalaran',5,'neutral'),
]);

// ── Lookups ──────────────────────────────────────────────────────────────────
/** World-space rect of a zone (continent origin applied). */
export function zoneRect(id: string): AtlasRect | null {
  const z = ZONES[id]; if (!z) return null;
  const o = CONTINENTS[z.continent].origin;
  return { x: z.rect.x + o.x, y: z.rect.y + o.y, w: z.rect.w, h: z.rect.h };
}

/** Zone containing a world point, or null (ocean/unmapped). */
export function zoneAt(x: number, y: number): AtlasZone | null {
  for (const id in ZONES) {
    const r = zoneRect(id);
    if (r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return ZONES[id];
  }
  return null;
}

/** Continent containing a world point (by derived bounds), or null. */
export function continentAt(x: number, y: number): AtlasContinent | null {
  for (const id in CONTINENT_BOUNDS) {
    const b = CONTINENT_BOUNDS[id as ContinentId];
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return CONTINENTS[id as ContinentId];
  }
  return null;
}

/** Zone level range at a world point (drives encounter scaling). */
export function zoneLevel(x: number, y: number): { min: number; max: number } | null {
  const z = zoneAt(x, y);
  return z ? { min: z.levelMin, max: z.levelMax } : null;
}

/** World-space position of a normalized point inside a zone. */
export function zonePoint(id: string, nx: number, ny: number): AtlasPoint | null {
  const r = zoneRect(id); if (!r) return null;
  return { x: r.x + nx * r.w, y: r.y + ny * r.h };
}

/** Derived continent bounds (world space) = union of its zone rects. */
export const CONTINENT_BOUNDS: Readonly<Record<ContinentId, AtlasRect>> = Object.freeze(
  (Object.keys(CONTINENTS) as ContinentId[]).reduce((acc, cid) => {
    let x = Infinity, y = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const id in ZONES) {
      const z = ZONES[id]; if (z.continent !== cid) continue;
      const r = zoneRect(id)!;
      x = Math.min(x, r.x); y = Math.min(y, r.y);
      x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h);
    }
    acc[cid] = Object.freeze({ x, y, w: x2 - x, h: y2 - y });
    return acc;
  }, {} as Record<ContinentId, AtlasRect>));


