/** Per-zone authored content contract (wayfinder world-t02). Continent teams
 * (T06–T09) fill ZONE_CONTENT; AuthoredWorld renders terrain/props/collision/
 * spawns from it. Zones without an entry get a deterministic default so every
 * zone is playable before its continent team lands.
 *
 * Coordinates: `nx`/`ny` are normalized 0..1 inside the zone's world rect;
 * road `points` are world coordinates so a road may cross a zone border. */

import { ZONES, zoneRect, type AtlasZone, type FactionId } from './world-atlas.ts';
import { zoneBiome } from './biomes.ts';
import { BIOME_PROP_TABLES, type PropWeight } from './biome-props.ts';
import type { BiomeId } from './biomes.ts';
import type { ElevationSpec } from './elevation.ts';
import type { EnemyKind } from './model.ts';
import { ENEMY_DEFINITIONS, type EnemyDefinition } from './combat-content.ts';
import type { POIKind } from './world-pois.ts';
import type { WildernessKind } from './wilderness-sites.ts';
import type { DungeonThemeId } from './dungeon-content.ts';

// ── Spec types ───────────────────────────────────────────────────────────────
/** Ground color recipe key — the zone's atlas `terrain` string. */
export type PaletteId = string;
/** Relative prop abundance; same shape as BIOME_PROP_TABLES rows, plus the
 * authored-only occluder override carried through to the emitted Prop. */
export interface ZonePropWeight extends PropWeight {
  readonly occluder?: { height: number; radius: number; offsetX?: number } | null;
}
export type PropWeightTable = readonly ZonePropWeight[];

export interface WaterSpec {
  readonly kind: 'lake' | 'river';
  /** Normalized center inside the zone rect. */
  readonly nx: number; readonly ny: number;
  /** Lake: normalized radii (fraction of rect w/h). */
  readonly nrx?: number; readonly nry?: number;
  /** River: normalized polyline through the zone. */
  readonly points?: readonly (readonly [number, number])[];
  /** River half-width in world units (the bank-to-centerline distance). */
  readonly width?: number;
  /** 0..1; >= .75 reads as deep water and blocks movement. */
  readonly depth?: number;
}

export interface RoadSpec {
  readonly id: string;
  /** World-space polyline; may cross zone borders to reach a crossing. */
  readonly points: readonly (readonly [number, number])[];
  /** Centerline half-width in world units. */
  readonly width?: number;
  readonly main?: boolean;
}

export interface TownSpec {
  readonly name: string;
  readonly nx: number; readonly ny: number;
  readonly faction?: FactionId;
  readonly tier?: 'capital' | 'town' | 'village' | 'outpost';
}

export interface CampSpec {
  readonly kind?: WildernessKind;
  readonly name?: string;
  readonly nx: number; readonly ny: number;
  /** Optional roster override; defaults to the zone biome's camp roster. */
  readonly members?: readonly EnemyKind[];
  /** Faction tag stamped on the site and its spawned members (guard posts,
   * faction camps). 'contested' resolves to 'neutral' at consumption. */
  readonly faction?: FactionId;
}

export interface SpawnEntry {
  readonly kind: EnemyKind;
  readonly weight: number;
  /** Added to the zone's level range when this entry spawns. */
  readonly levelOffset?: number;
}

export interface POISpec {
  readonly name: string;
  readonly kind: POIKind;
  readonly nx: number; readonly ny: number;
  readonly description?: string;
}

export interface EntranceSpec {
  readonly name: string;
  readonly nx: number; readonly ny: number;
  readonly levelMin?: number; readonly levelMax?: number;
  readonly kind?: 'dungeon' | 'raid';
  readonly theme?: DungeonThemeId;
}

export interface ZoneContent {
  readonly id: string;                    // atlas zone id
  readonly palette: PaletteId;            // ground color recipe key
  readonly props: PropWeightTable;        // biome-prop weights for this zone
  readonly elevation?: ElevationSpec;     // cliffs/ramps/valleys (T03)
  readonly water?: readonly WaterSpec[];  // lakes/rivers/coastline
  readonly roads: readonly RoadSpec[];    // polylines to border crossings
  readonly towns: readonly TownSpec[];    // cities/villages (buildings+NPC anchors)
  readonly camps: readonly CampSpec[];    // mob camps
  readonly spawns: readonly SpawnEntry[]; // zone mob table {kind,weight,levelOffset}
  readonly pois: readonly POISpec[];      // named locations
  readonly entrances: readonly EntranceSpec[]; // dungeon/raid doors
}

// ── Registry ─────────────────────────────────────────────────────────────────
/** Continent teams assign entries: `ZONE_CONTENT['elwynn'] = {...}`.
 * Missing zones resolve to a memoized default via `zoneContent`. */
export const ZONE_CONTENT: Record<string, ZoneContent> = {};

/** Register authored content for a zone; returns it for chaining in content files. */
export function defineZoneContent(content: ZoneContent): ZoneContent {
  if (!ZONES[content.id]) throw new Error(`Unknown atlas zone: ${content.id}`);
  ZONE_CONTENT[content.id] = content;
  return content;
}

// ── Geometry helpers ─────────────────────────────────────────────────────────
const rectCache = new Map<string, { x: number; y: number; w: number; h: number } | null>();
/** World-space zone rect, cached (zoneRect allocates per call). */
export function zoneWorldRect(id: string): { x: number; y: number; w: number; h: number } | null {
  let rect = rectCache.get(id);
  if (rect === undefined) {
    const r = zoneRect(id);
    rect = r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
    rectCache.set(id, rect);
  }
  return rect;
}

const ZONE_LIST = Object.freeze(Object.values(ZONES));
/** Coarse world-space index: zonesIn answers from the cells a query touches
 * instead of scanning every zone each call. */
const ZONE_CELL = 16384;
const zoneGrid = new Map<number, AtlasZone[]>();
for (const zone of ZONE_LIST) {
  const r = zoneWorldRect(zone.id)!;
  const x0 = Math.floor(r.x / ZONE_CELL), x1 = Math.floor((r.x + r.w - 1) / ZONE_CELL);
  const y0 = Math.floor(r.y / ZONE_CELL), y1 = Math.floor((r.y + r.h - 1) / ZONE_CELL);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const key = (cx + 8192) + (cy + 8192) * 16384;
    let list = zoneGrid.get(key); if (!list) zoneGrid.set(key, list = []);
    list.push(zone);
  }
}
/** Zones whose world rect intersects the query rect (margin expands it). */
export function zonesIn(x: number, y: number, width: number, height: number, margin = 0): AtlasZone[] {
  const seen = new Set<AtlasZone>(), result: AtlasZone[] = [];
  const x0 = Math.floor((x - margin) / ZONE_CELL), x1 = Math.floor((x + width + margin) / ZONE_CELL);
  const y0 = Math.floor((y - margin) / ZONE_CELL), y1 = Math.floor((y + height + margin) / ZONE_CELL);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const cell = zoneGrid.get((cx + 8192) + (cy + 8192) * 16384);
    if (!cell) continue;
    for (const zone of cell) {
      if (seen.has(zone)) continue;
      seen.add(zone);
      const r = zoneWorldRect(zone.id)!;
      if (r.x - margin < x + width && r.x + r.w + margin > x && r.y - margin < y + height && r.y + r.h + margin > y)
        result.push(zone);
    }
  }
  return result;
}

/** Distance to the nearest authored road polyline near a world point. */

// Per-zone road segments bucketed into 1024px cells so a point query only tests
// the handful of segments near it instead of every polyline within 4000u.
const ROAD_BUCKET = 1024;
const roadIndex = new Map<string, Map<string, { ax: number; ay: number; bx: number; by: number; half: number }[]>>();
function zoneRoadIndex(zoneId: string): Map<string, { ax: number; ay: number; bx: number; by: number; half: number }[]> {
  let index = roadIndex.get(zoneId);
  if (index) return index;
  index = new Map();
  const rect = zoneWorldRect(zoneId);
  if (rect) for (const road of zoneContent(zoneId).roads) {
    const pts = road.points, half = (road.width ?? 28);
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1][0], ay = pts[i - 1][1], bx = pts[i][0], by = pts[i][1];
      const seg = { ax, ay, bx, by, half };
      const x0 = Math.floor((Math.min(ax, bx) - half) / ROAD_BUCKET), x1 = Math.floor((Math.max(ax, bx) + half) / ROAD_BUCKET);
      const y0 = Math.floor((Math.min(ay, by) - half) / ROAD_BUCKET), y1 = Math.floor((Math.max(ay, by) + half) / ROAD_BUCKET);
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const key = `${cx}:${cy}`, cell = index.get(key);
        if (cell) cell.push(seg); else index.set(key, [seg]);
      }
    }
  }
  roadIndex.set(zoneId, index);
  return index;
}

export function authoredRoadDistance(x: number, y: number): number {
  let best = Infinity;
  for (const zone of zonesIn(x, y, 0, 0, 4000)) {
    const index = zoneRoadIndex(zone.id);
    // Probe the 3×3 neighborhood of buckets around the point; a segment can only
    // be nearer than ~1024+half if it was bucketed into an adjacent cell.
    const cx = Math.floor(x / ROAD_BUCKET), cy = Math.floor(y / ROAD_BUCKET);
    for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
      const cell = index.get(`${gx}:${gy}`);
      if (!cell) continue;
      for (const s of cell) {
        const dx = s.bx - s.ax, dy = s.by - s.ay;
        const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / (dx * dx + dy * dy || 1)));
        const px = x - s.ax - dx * t, py = y - s.ay - dy * t;
        const d = Math.sqrt(px * px + py * py) - s.half;
        if (d < best) best = d;
      }
    }
  }
  return Math.max(0, best);
}

// ── Defaults ─────────────────────────────────────────────────────────────────
function textHash(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/** Generic zone mob table per mapped biome; continent teams replace with real rosters. */
const DEFAULT_SPAWNS: Readonly<Record<BiomeId, readonly EnemyKind[]>> = Object.freeze({
  deadwood: ['stalker', 'caster', 'hound'],
  verdant: ['stalker', 'hound', 'archer'],
  swamp: ['mireSpitter', 'stalker', 'wisp'],
  frostpine: ['frostRevenant', 'stalker', 'wisp'],
  emberfall: ['emberAcolyte', 'brute', 'stalker'],
  autumn: ['stalker', 'archer', 'caster'],
  highlands: ['stormSentinel', 'brute', 'archer'],
  steppe: ['duneScuttler', 'hound', 'archer'],
  sunscar: ['duneScuttler', 'brute', 'caster'],
});

const defaults = new Map<string, ZoneContent>();

/** Deterministic generic content: terrain palette, biome prop table, a few
 * seeded camps, water for marshy terrain keys, atlas cities/dungeons bridged
 * in. No towns beyond atlas cities — continent teams author the rest. */
export function defaultZoneContent(zone: AtlasZone): ZoneContent {
  const cached = defaults.get(zone.id);
  if (cached) return cached;
  const biome = zoneBiome(zone.terrain);
  const seed = textHash(zone.id);
  const rand = (salt: number) => {
    let h = seed ^ Math.imul(salt + 1, 0x9e3779b1);
    h = Math.imul(h ^ h >>> 16, 0x7feb352d); h = Math.imul(h ^ h >>> 15, 0x846ca68b);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  };
  const water: WaterSpec[] = [];
  if (/swamp|marsh|lake|coast/.test(zone.terrain)) {
    const count = 1 + Math.floor(rand(1) * 2);
    for (let i = 0; i < count; i++) {
      const nx = .2 + rand(10 + i * 7) * .6, ny = .2 + rand(11 + i * 7) * .6;
      // Keep the zone center dry so spawn/quest areas stay walkable.
      if (Math.abs(nx - .5) < .18 && Math.abs(ny - .5) < .18) continue;
      water.push({ kind: 'lake', nx, ny, nrx: .04 + rand(20 + i) * .05, nry: .04 + rand(30 + i) * .05, depth: .9 });
    }
  }
  const towns: TownSpec[] = zone.cities.map(city => ({ name: city.name, nx: city.nx, ny: city.ny, faction: city.faction, tier: city.tier }));
  const camps: CampSpec[] = [];
  const target = Math.max(3, Math.min(12, Math.round(zone.rect.w * zone.rect.h / (24000 * 24000))));
  for (let i = 0; camps.length < target && i < target * 24; i++) {
    const nx = .08 + rand(40 + i * 3) * .84, ny = .08 + rand(41 + i * 3) * .84;
    if (towns.some(t => Math.hypot(nx - t.nx, ny - t.ny) < .1)) continue;
    if (water.some(w => w.kind === 'lake' && Math.hypot((nx - w.nx) / (w.nrx ?? .05), (ny - w.ny) / (w.nry ?? .05)) < 1.4)) continue;
    camps.push({ nx, ny });
  }
  const entrances: EntranceSpec[] = zone.dungeons.map(d => ({
    name: d.name, nx: d.nx, ny: d.ny, levelMin: d.levelMin, levelMax: d.levelMax, kind: d.kind,
  }));
  const content: ZoneContent = Object.freeze({
    id: zone.id, palette: zone.terrain, props: BIOME_PROP_TABLES[biome],
    water: Object.freeze(water), roads: Object.freeze([]), towns: Object.freeze(towns),
    camps: Object.freeze(camps),
    spawns: Object.freeze(DEFAULT_SPAWNS[biome].map(kind => Object.freeze({ kind, weight: 1 }))),
    pois: Object.freeze([]), entrances: Object.freeze(entrances),
  });
  defaults.set(zone.id, content);
  return content;
}

/** Zone content: the authored registry entry, else the memoized default. */
export function zoneContent(id: string): ZoneContent {
  const authored = ZONE_CONTENT[id];
  if (authored) return authored;
  const zone = ZONES[id];
  if (!zone) throw new Error(`Unknown atlas zone: ${id}`);
  return defaultZoneContent(zone);
}

// ── Spawn tables ─────────────────────────────────────────────────────────────
/** Weighted pick from a zone's authored `spawns` table. `preferred` wins when
 * the table lists it (roaming pack recipes); `role` narrows the pool like
 * chooseEncounterEnemy. Returns null for an empty/zero-weight table so callers
 * can fall back to the biome mix. */
export function chooseZoneSpawn(spawns: readonly SpawnEntry[], random: () => number,
  preferred?: EnemyKind, role?: EnemyDefinition['role']): SpawnEntry | null {
  const eligible = spawns.filter(entry => entry.weight > 0);
  if (!eligible.length) return null;
  const matching = role ? eligible.filter(entry => ENEMY_DEFINITIONS[entry.kind].role === role) : eligible;
  const entries = matching.length ? matching : eligible;
  if (preferred) {
    const hit = entries.find(entry => entry.kind === preferred);
    if (hit) return hit;
  }
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.max(0, Math.min(1 - Number.EPSILON, random())) * total;
  for (const entry of entries) { if (roll < entry.weight) return entry; roll -= entry.weight; }
  return entries[entries.length - 1];
}
