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
import type { POIKind } from './world-pois.ts';
import type { WildernessKind } from './wilderness-sites.ts';
import type { DungeonThemeId } from './dungeon-content.ts';

// ── Spec types ───────────────────────────────────────────────────────────────
/** Ground color recipe key — the zone's atlas `terrain` string. */
export type PaletteId = string;
/** Relative prop abundance; same shape as BIOME_PROP_TABLES rows. */
export type PropWeightTable = readonly PropWeight[];

export interface WaterSpec {
  readonly kind: 'lake' | 'river';
  /** Normalized center inside the zone rect. */
  readonly nx: number; readonly ny: number;
  /** Lake: normalized radii (fraction of rect w/h). */
  readonly nrx?: number; readonly nry?: number;
  /** River: normalized polyline through the zone. */
  readonly points?: readonly (readonly [number, number])[];
  /** River half-width in world units. */
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
/** Zones whose world rect intersects the query rect (margin expands it). */
export function zonesIn(x: number, y: number, width: number, height: number, margin = 0): AtlasZone[] {
  const result: AtlasZone[] = [];
  for (const zone of ZONE_LIST) {
    const r = zoneWorldRect(zone.id)!;
    if (r.x - margin < x + width && r.x + r.w + margin > x && r.y - margin < y + height && r.y + r.h + margin > y)
      result.push(zone);
  }
  return result;
}

/** Distance to the nearest authored road polyline near a world point. */
export function authoredRoadDistance(x: number, y: number): number {
  let best = Infinity;
  for (const zone of zonesIn(x, y, 0, 0, 4000)) {
    for (const road of zoneContent(zone.id).roads) {
      const pts = road.points;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
        const px = x - a[0] - dx * t, py = y - a[1] - dy * t;
        const d = Math.sqrt(px * px + py * py) - (road.width ?? 28);
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
