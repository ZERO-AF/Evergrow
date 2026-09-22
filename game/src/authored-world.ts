/** Authored WoW world provider (wayfinder world-t02). Serves the fixed atlas map
 * from world-atlas.ts + ZONE_CONTENT instead of the seeded climate field, while
 * satisfying the same World/WorldQuery contract so every consumer compiles
 * unchanged. Ocean (no zone) is impassable deep water with no spawns. */

import { World } from './world.ts';
import { AUTHORED_GENERATION_VERSION, hash, MAX_PROP_RADIUS, random, type Prop } from './world-landscape.ts';
import { CONTINENTS, ZONES, zoneAt, type AtlasZone } from './world-atlas.ts';
import { authoredRoadDistance, zoneContent, zonesIn, zoneWorldRect, type TownSpec, type WaterSpec, type ZonePropWeight } from './zone-content.ts';
import { authoredBiomeSample, zoneBiome, type BiomeId, type BiomeSample, type BiomeWeights } from './biomes.ts';
import { terrainTint } from './zone-palettes.ts';
import { propDefinition } from './biome-props.ts';
import { landscapePropProbability } from './natural-landscape.ts';
import { circleHitsRect, freezeSettlement, generateSettlement, intersects, settlementPOIs, type POI, type Settlement } from './settlements.ts';
import { authoredSite, wildernessPOI, type WildernessSite } from './wilderness-sites.ts';
import { DUNGEON_THEME_IDS, dungeonTheme } from './dungeon-content.ts';
import type { DungeonEntrance } from './dungeon.ts';
import { RAID_ENTRANCE_ID } from './raid-boss-content.ts';
import { RAID2_ENTRANCE_ID } from './raid2-boss-content.ts';
import { RAID3_ENTRANCE_ID } from './raid3-boss-content.ts';
import { RAID4_ENTRANCE_ID } from './raid4-boss-content.ts';
import { RAID5_ENTRANCE_ID } from './raid5-boss-content.ts';
import { RAID6_ENTRANCE_ID } from './raid6-boss-content.ts';
import { ElevationField, type ElevationRegion } from './elevation.ts';
import { DRY_WATER, type WaterSample } from './hydrology.ts';
import { isWorldCoordinate, validWorldRectangle, WORLD_QUERY_LIMITS } from './world-query.ts';
import { townPortalAnchor, type PortalAnchor } from './travel.ts';
import type { Place } from './world-geography.ts';
import { GAME_FEATURES } from './game-features.ts';
import type { MaterialId } from './material-content.ts';
import type { PlayerFaction } from './wow-types.ts';
import './zone-content-kalimdor.ts';
import './zone-content-eastern-kingdoms.ts';
import './zone-content-northrend.ts';
import './zone-content-outland.ts';
const OCEAN_WATER: Readonly<WaterSample> = Object.freeze({ coverage: 1, depth: 1, flowX: 0, flowY: 0, bank: 0, kind: 'lake' });
const OCEAN_BIOME: BiomeId = 'swamp';
const PROP_CELL = 80;
const PROP_CACHE_LIMIT = 8192;
const TOWN_BANDS_PER_ZONE = 16;
const ZONE_IDS = Object.freeze(Object.keys(ZONES));
const ZONE_INDEX: Record<string, number> = Object.freeze(Object.fromEntries(ZONE_IDS.map((id, i) => [id, i])));

const emptyWeights = (): BiomeWeights => ({ deadwood: 0, verdant: 0, swamp: 0, frostpine: 0, emberfall: 0, autumn: 0, highlands: 0, steppe: 0, sunscar: 0 });
const oceanSample = (): BiomeSample => ({ id: OCEAN_BIOME, name: 'The Great Sea', weights: { ...emptyWeights(), swamp: 1 } });

/** Pick a prop entry from a zone weight table; null when the table is empty. */
function pickFromTable(table: readonly ZonePropWeight[], roll: number): ZonePropWeight | null {
  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return null;
  let choice = Math.max(0, Math.min(1 - Number.EPSILON, roll)) * total;
  for (const entry of table) { if (choice < entry.weight) return entry; choice -= entry.weight; }
  return table[table.length - 1];
}

/** Authored raid names that map onto the dedicated arena floors the raid gates
 * recognize (dungeon.ts routes by entrance id). Other authored raids keep a
 * `dungeon:atlas:` id plus kind:'raid' and generate a themed floor. */
const AUTHORED_RAID_IDS: Readonly<Record<string, string>> = Object.freeze({
  "onyxia's lair": RAID_ENTRANCE_ID,
  'molten core': RAID2_ENTRANCE_ID,
  'naxxramas': RAID3_ENTRANCE_ID,
  'icecrown citadel': RAID4_ENTRANCE_ID,
  'eye of eternity': RAID5_ENTRANCE_ID,
  'obsidian sanctum': RAID6_ENTRANCE_ID,
});

/** Authored water mask for a point inside a zone: lakes (normalized ellipses)
 * and rivers (normalized polylines). Deep water blocks movement. */
function authoredWater(zone: AtlasZone, spec: readonly WaterSpec[] | undefined, x: number, y: number): WaterSample {
  if (!spec?.length) return DRY_WATER;
  const rect = zoneWorldRect(zone.id)!;
  let coverage = 0, depth = 0, bank = 0, kind: WaterSample['kind'] = 'dry';
  for (const w of spec) {
    let edge = Infinity, wdepth = w.depth ?? .8;
    if (w.kind === 'lake') {
      const cx = rect.x + w.nx * rect.w, cy = rect.y + w.ny * rect.h;
      const rx = Math.max(40, (w.nrx ?? .05) * rect.w), ry = Math.max(40, (w.nry ?? .05) * rect.h);
      edge = (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
    } else if (w.points && w.points.length > 1) {
      const half = Math.max(24, w.width ?? 90);
      for (let i = 1; i < w.points.length; i++) {
        const ax = rect.x + w.points[i - 1][0] * rect.w, ay = rect.y + w.points[i - 1][1] * rect.h;
        const bx = rect.x + w.points[i][0] * rect.w, by = rect.y + w.points[i][1] * rect.h;
        const dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        edge = Math.min(edge, Math.hypot(x - ax - dx * t, y - ay - dy * t) - half);
      }
      wdepth = w.depth ?? .45;
    } else continue;
    const c = Math.max(0, Math.min(1, -edge / 60));
    if (c > coverage) { coverage = c; depth = wdepth * c; bank = Math.max(0, 1 - Math.abs(edge + 20) / 60); kind = w.kind; }
  }
  return coverage <= 0 ? DRY_WATER : { coverage, depth, flowX: 0, flowY: 0, bank, kind };
}

/** The overworld backed by the authored atlas. Constructible from a seed alone —
 * the atlas and zone registry are importable modules. */
export class AuthoredWorld extends World {
  /** Authored geography replaces the procedural layout; old saves stay preserved. */
  override readonly generationVersion = AUTHORED_GENERATION_VERSION;
  private readonly elevation = new ElevationField(id => zoneContent(id).elevation);
  private authoredProps = new Map<string, Prop | null>();
  private authoredSites = new Map<string, readonly WildernessSite[]>();
  private authoredTowns = new Map<number, Settlement>();
  private townBands = new Map<number, { zone: AtlasZone; spec: TownSpec }>();
  /** Last zone hit: ground tiles sample thousands of points inside one zone. */
  private lastZone: { zone: AtlasZone; x: number; y: number; w: number; h: number } | null = null;
  private spawn: { x: number; y: number } | null = null;

  constructor(seed = 7319) {
    super(seed);
    // Pre-warm the spawn zones' towns so the first settlement query never
    // hitches on synchronous generateSettlement inside a frame.
    for (const id of ['elwynn', 'durotar']) {
      const zone = ZONES[id]; if (!zone) continue;
      const towns = zoneContent(id).towns;
      for (let i = 0; i < towns.length && i < TOWN_BANDS_PER_ZONE - 1; i++) this.authoredSettlement(zone, towns[i], i);
    }
  }

  override get cacheStats() {
    return { ...super.cacheStats, authoredProps: this.authoredProps.size, authoredSites: this.authoredSites.size, authoredTowns: this.authoredTowns.size };
  }
  override dispose() {
    this.authoredProps.clear(); this.authoredSites.clear(); this.authoredTowns.clear(); this.townBands.clear();
    super.dispose();
  }
  /** zoneAt with a one-zone memo: consecutive samples inside the same zone rect
   * skip the continent/grid lookup entirely. */
  private zoneAtFast(x: number, y: number): AtlasZone | null {
    const last = this.lastZone;
    if (last && x >= last.x && x < last.x + last.w && y >= last.y && y < last.y + last.h) return last.zone;
    const zone = zoneAt(x, y);
    if (zone) {
      const rect = zoneWorldRect(zone.id)!;
      this.lastZone = { zone, x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    }
    return zone;
  }

  // ── Identity / spawn ───────────────────────────────────────────────────────
  /** Zone identity for map contours/labels; null marks ocean cells. */
  readonly zoneKey = (x: number, y: number): string | null => zoneAt(x, y)?.id ?? null;

  /** First walkable land: the first authored town, else the Elwynn rect center. */
  override get spawnPoint(): { x: number; y: number } {
    if (this.spawn) return this.spawn;
    const rect = zoneWorldRect('elwynn')!;
    const towns = zoneContent('elwynn').towns;
    const anchor = towns.length
      ? { x: rect.x + towns[0].nx * rect.w, y: rect.y + towns[0].ny * rect.h }
      : { x: rect.x + rect.w * .5, y: rect.y + rect.h * .5 };
    for (let ring = 0; ring <= 4096 && !this.spawn; ring += 64)
      for (let i = 0; i < 24; i++) {
        const a = i * Math.PI / 12, x = anchor.x + Math.cos(a) * ring, y = anchor.y + Math.sin(a) * ring;
        if (!this.blocked(x, y, 18)) { this.spawn = { x, y }; break; }
      }
    return this.spawn ?? { x: anchor.x, y: anchor.y };
  }

  // ── Biome / terrain ────────────────────────────────────────────────────────
  override sampleBiome(x: number, y: number): BiomeSample {
    const zone = this.zoneAtFast(x, y);
    if (zone) {
      const rect = zoneWorldRect(zone.id)!;
      const d = Math.min(x - rect.x, rect.x + rect.w - x, y - rect.y, rect.y + rect.h - y);
      if (d >= 480) {
        const id = zoneBiome(zone.terrain);
        return { id, name: zone.name, weights: { ...emptyWeights(), [id]: 1 }, tint: terrainTint(zone.terrain) };
      }
    }
    return authoredBiomeSample(x, y) ?? oceanSample();
  }

  protected override terrainWater(x: number, y: number): WaterSample {
    const zone = this.zoneAtFast(x, y);
    if (!zone) return OCEAN_WATER;
    return authoredWater(zone, zoneContent(zone.id).water, x, y);
  }

  // ── Content queries ────────────────────────────────────────────────────────
  private siteList(zone: AtlasZone): readonly WildernessSite[] {
    let sites = this.authoredSites.get(zone.id);
    if (sites === undefined) {
      const rect = zoneWorldRect(zone.id)!;
      const biome = zoneBiome(zone.terrain);
      sites = Object.freeze(zoneContent(zone.id).camps.map((camp, i) =>
        authoredSite(this.seed, `atlas:${zone.id}:site:${i}`, camp.kind ?? 'camp',
          rect.x + camp.nx * rect.w, rect.y + camp.ny * rect.h, biome, camp.name, camp.members, camp.faction)));
    }
    return sites;
  }

  override getWildernessSites(x: number, y: number, width: number, height: number): WildernessSite[] {
    if (!validWorldRectangle(x, y, width, height)) return [];
    const query = { x, y, width, height }, result: WildernessSite[] = [];
    for (const zone of zonesIn(x, y, width, height, 400))
      for (const site of this.siteList(zone))
        if (intersects(query, { x: site.x - site.radius, y: site.y - site.radius, width: site.radius * 2, height: site.radius * 2 }))
          result.push(site);
    return result.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  }

  /** Stable numeric band per authored town: zoneIndex * 16 + townIndex + 1.
   * Band 0 stays reserved for the procedural home town; a zone may author at
   * most 15 towns. */
  private authoredSettlement(zone: AtlasZone, spec: TownSpec, index: number): Settlement {
    const band = ZONE_INDEX[zone.id] * TOWN_BANDS_PER_ZONE + index + 1;
    let town = this.authoredTowns.get(band);
    if (town) return town;
    const rect = zoneWorldRect(zone.id)!;
    const x = rect.x + spec.nx * rect.w, y = rect.y + spec.ny * rect.h;
    const tier = spec.tier ?? 'town';
    let townSeed = hash(ZONE_INDEX[zone.id], index, this.seed, 7331);
    // generateSettlement derives kind from the place: id 0 or seed%3===0 is a
    // settlement, city needs the flag, everything else is a village. Authored
    // towns are never the seed%3 camp, so 'outpost' stamps the settlement kind
    // after generation instead of relying on the procedural roll.
    if (tier === 'village' || tier === 'outpost') townSeed = townSeed % 3 === 0 ? townSeed + 1 : townSeed;
    const place: Place = { id: band, cx: 0, cy: 0, x, y, seed: townSeed >>> 0, city: tier === 'capital' };
    const generated = generateSettlement(this.seed, place);
    if (tier === 'outpost') generated.kind = 'settlement';
    // Authored towns keep their spec faction so factionAt() can tag the area.
    town = freezeSettlement(Object.assign(generated, { id: `town:atlas:${band}`, name: spec.name, faction: spec.faction }));
    this.authoredTowns.set(band, town);
    this.townBands.set(band, { zone, spec });
    return town;
  }

  /** Authored town nearest a world point (spec positions, no materialization). */
  private nearestTown(x: number, y: number): { zone: AtlasZone; spec: TownSpec; index: number } | null {
    let best: { zone: AtlasZone; spec: TownSpec; index: number } | null = null, distance = Infinity;
    for (const id of ZONE_IDS) {
      const zone = ZONES[id], rect = zoneWorldRect(id)!, towns = zoneContent(id).towns;
      for (let i = 0; i < towns.length && i < TOWN_BANDS_PER_ZONE - 1; i++) {
        const d = Math.hypot(rect.x + towns[i].nx * rect.w - x, rect.y + towns[i].ny * rect.h - y);
        if (d < distance) { distance = d; best = { zone, spec: towns[i], index: i }; }
      }
    }
    return best;
  }
  override getSettlements(x: number, y: number, width: number, height: number): Settlement[] {
    if (!validWorldRectangle(x, y, width, height)) return [];
    const query = { x, y, width, height }, result: Settlement[] = [];
    for (const zone of zonesIn(x, y, width, height, 1100)) {
      const rect = zoneWorldRect(zone.id)!, towns = zoneContent(zone.id).towns;
      for (let i = 0; i < towns.length && i < TOWN_BANDS_PER_ZONE - 1; i++) {
        const spec = towns[i];
        // Cheap spec-position reject before the heavy generateSettlement: a town
        // can only intersect the query when its center is within the query plus
        // the largest possible settlement radius.
        const sx = rect.x + spec.nx * rect.w, sy = rect.y + spec.ny * rect.h;
        if (sx + 1000 < x || sx - 1000 > x + width || sy + 1000 < y || sy - 1000 > y + height) continue;
        const town = this.authoredSettlement(zone, spec, i);
        if (intersects(query, { x: town.x - town.radius, y: town.y - town.radius, width: town.radius * 2, height: town.radius * 2 }))
          result.push(town);
      }
    }
    return result.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  }

  override getNearestSettlement(x: number, y: number): Settlement {
    // Resolve by spec position first so distant towns never materialize.
    const best = this.nearestTown(x, y);
    return best ? this.authoredSettlement(best.zone, best.spec, best.index) : super.getNearestSettlement(x, y);
  }

  override getPortalAnchor(band: number, faction?: PlayerFaction): PortalAnchor {
    // Band 0 is the home anchor: the player's faction capital (Horde → Orgrimmar
    // in Durotar, Alliance/default → Goldshire in Elwynn), not the procedural
    // origin town (which sits in ocean under the authored atlas). Keep band:0
    // so freshTravel().homeTown=0 round-trips instead of failing the lookup.
    if (band === 0) {
      const homeId = faction === 'horde' ? 'durotar' : 'elwynn';
      const home = ZONES[homeId], towns = home ? zoneContent(homeId).towns : [];
      if (towns.length) return { ...townPortalAnchor(this.authoredSettlement(home, towns[0], 0)), band: 0 };
    }
    const known = this.townBands.get(band);
    if (known) return townPortalAnchor(this.authoredSettlement(known.zone, known.spec, (band - 1) % TOWN_BANDS_PER_ZONE));
    // The band may not have been materialized yet; resolve it from the table.
    const zoneIndex = Math.floor((band - 1) / TOWN_BANDS_PER_ZONE), index = (band - 1) % TOWN_BANDS_PER_ZONE;
    const zone = ZONES[ZONE_IDS[zoneIndex]], towns = zone ? zoneContent(zone.id).towns : [];
    if (zone && index >= 0 && index < towns.length)
      return townPortalAnchor(this.authoredSettlement(zone, towns[index], index));
    return super.getPortalAnchor(band);
  }



  override getDungeonEntrances(x: number, y: number, w: number, h: number): DungeonEntrance[] {
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 100000 || h > 100000) return [];
    const out: DungeonEntrance[] = [];
    for (const zone of zonesIn(x, y, w, h, 80)) {
      const rect = zoneWorldRect(zone.id)!, biome = zoneBiome(zone.terrain);
      for (const [i, spec] of zoneContent(zone.id).entrances.entries()) {
        const px = rect.x + spec.nx * rect.w, py = rect.y + spec.ny * rect.h;
        if (px < x || py < y || px >= x + w || py >= y + h) continue;
        const seed = hash(ZONE_INDEX[zone.id], i, this.seed, 0xd0e7) >>> 0;
        const theme = spec.theme ?? DUNGEON_THEME_IDS[seed % DUNGEON_THEME_IDS.length];
        const name = spec.name ?? dungeonTheme(seed, theme).name;
        // Dedicated raid arenas are routed by entrance id; other authored raids
        // keep kind:'raid' so the gate opens a themed raid floor, not a dungeon.
        const raidId = spec.kind === 'raid' ? AUTHORED_RAID_IDS[name.toLowerCase()] : undefined;
        const id = raidId ?? (spec.kind === 'raid' ? `dungeon:atlas:${zone.id}:${i}` : `atlas:${zone.id}:entrance:${i}`);
        out.push({ id, theme, name, x: px, y: py, seed, level: spec.levelMin ?? zone.levelMin, biome });
      }
    }
    return out;
  }

  override getPOIs(x: number, y: number, width: number, height: number): POI[] {
    if (!validWorldRectangle(x, y, width, height)) return [];
    const result: POI[] = [
      ...this.getDungeonEntrances(x, y, width, height).map(e => ({ ...e, kind: 'dungeon' as const, description: `Level ${e.level} · ${e.name}` })),
      ...this.getSettlements(x, y, width, height).flatMap(settlementPOIs),
      ...this.getWildernessSites(x, y, width, height).map(wildernessPOI),
      ...this.getEventSites(x, y, width, height).filter(s => s.kind === 'reliquary').map(s => ({ ...s, kind: 'reliquary' as const, description: 'Open the roadside cache.' })),
    ];
    for (const zone of zonesIn(x, y, width, height)) {
      const rect = zoneWorldRect(zone.id)!;
      for (const [i, poi] of zoneContent(zone.id).pois.entries()) {
        const px = rect.x + poi.nx * rect.w, py = rect.y + poi.ny * rect.h;
        if (px >= x && px < x + width && py >= y && py < y + height)
          result.push({ id: `atlas:${zone.id}:poi:${i}`, name: poi.name, kind: poi.kind, x: px, y: py, description: poi.description ?? poi.name });
      }
    }
    return result.filter(poi => poi.x >= x && poi.x < x + width && poi.y >= y && poi.y < y + height)
      .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  }

  // ── Props ──────────────────────────────────────────────────────────────────
  override getProps(x: number, y: number, width: number, height: number): Prop[] {
    if (!validWorldRectangle(x, y, width, height)) return [];
    const minCellX = Math.floor(x / PROP_CELL), minCellY = Math.floor(y / PROP_CELL);
    const maxCellX = Math.floor((x + width) / PROP_CELL), maxCellY = Math.floor((y + height) / PROP_CELL);
    if ((maxCellX - minCellX + 1) * (maxCellY - minCellY + 1) > WORLD_QUERY_LIMITS.propCells) return [];
    const result: Prop[] = [];
    for (let cy = minCellY; cy <= maxCellY; cy++) for (let cx = minCellX; cx <= maxCellX; cx++) {
      const prop = this.authoredCellProp(cx, cy);
      if (prop && prop.x >= x && prop.x < x + width && prop.y >= y && prop.y < y + height) result.push(prop);
    }
    return result.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  }

  private authoredCellProp(cx: number, cy: number): Prop | null {
    const key = `${cx}:${cy}`, cached = this.authoredProps.get(key);
    if (cached !== undefined) return cached;
    const generated = this.generateAuthoredCellProp(cx, cy), prop = generated ? Object.freeze(generated) : null;
    if (this.authoredProps.size >= PROP_CACHE_LIMIT) this.authoredProps.delete(this.authoredProps.keys().next().value!);
    this.authoredProps.set(key, prop);
    return prop;
  }

  private generateAuthoredCellProp(cx: number, cy: number): Prop | null {
    const x = (cx + .18 + random(cx, cy, this.seed, 1) * .64) * PROP_CELL;
    const y = (cy + .18 + random(cx, cy, this.seed, 2) * .64) * PROP_CELL;
    const zone = this.zoneAtFast(x, y);
    if (!zone) return null; // ocean carries no props
    const biome = this.sampleBiome(x, y);
    const content = zoneContent(zone.id);
    if (authoredRoadDistance(x, y) < 76) return null;
    if (this.terrainWater(x, y).coverage > .12) return null;
    if (this.getWildernessSites(x - 18, y - 18, 36, 36).some(site => Math.hypot(x - site.x, y - site.y) < site.radius + 18)) return null;
    const entry = pickFromTable(content.props, random(cx, cy, this.seed, 4));
    if (entry === null) return null;
    const kind = entry.kind;
    // Same density gate as the procedural field so authored zones don't flood.
    if (random(cx, cy, this.seed, 3) > landscapePropProbability(x, y, this.seed, kind, biome.id)) return null;
    const definition = propDefinition(kind);
    const scale = definition.scale[0] + random(cx, cy, this.seed, 5) * (definition.scale[1] - definition.scale[0]);
    const towns = this.getSettlements(x - 180, y - 180, 360, 360), clearance = definition.radius[1] + 22;
    for (const town of towns) {
      if (Math.hypot(x - town.x, y - town.y) < 155) return null;
      if (town.buildings.some(b => circleHitsRect(x, y, clearance + (definition.canopy ? 32 : 0), b))) return null;
      if (town.paths.some(path => path.points.slice(1).some((b, j) => {
        const a = path.points[j], vx = b[0] - a[0], vy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy || 1)));
        return Math.hypot(x - a[0] - t * vx, y - a[1] - t * vy) < path.width / 2 + clearance;
      }))) return null;
      if (definition.canopy && town.buildings.some(b => circleHitsRect(x + definition.canopy!.offsetX * scale, y - definition.canopy!.height * scale, definition.canopy!.radius * scale + 16, b))) return null;
    }
    const radius = definition.radius[0] + random(cx, cy, this.seed, 6) * (definition.radius[1] - definition.radius[0]);
    const siteClearance = radius + 18;
    if (this.getWildernessSites(x - siteClearance, y - siteClearance, siteClearance * 2, siteClearance * 2)
      .some(site => Math.hypot(x - site.x, y - site.y) < site.radius + siteClearance)) return null;
    if (definition.canopy) {
      const crownX = x + definition.canopy.offsetX * scale, crownY = y - definition.canopy.height * scale;
      const margin = definition.canopy.radius * scale;
      if (this.getWildernessSites(crownX - margin, crownY - margin, margin * 2, margin * 2)
        .some(site => Math.hypot(crownX - site.x, crownY - site.y) < site.radius + margin)) return null;
    }
    return { id: `prop:${cx}:${cy}`, x, y, radius, kind, biome: biome.id, seed: hash(cx, cy, this.seed, 7), scale, occluder: entry.occluder };
  }
  // ── Collision / movement ───────────────────────────────────────────────────
  /** Non-elevation collision: ocean, deep authored water, props, sites, buildings. */
  private groundBlocked(x: number, y: number, radius: number): boolean {
    if (![x, y].every(isWorldCoordinate) || !Number.isFinite(radius) || radius < 0 || radius > WORLD_QUERY_LIMITS.collisionRadius) return true;
    const zone = zoneAt(x, y);
    if (!zone) return true; // ocean is impassable
    const water = this.terrainWater(x, y);
    if (water.coverage > .5 && water.depth >= .75) return true;
    return super.blocked(x, y, radius);
  }

  override blocked(x: number, y: number, radius: number): boolean {
    return this.groundBlocked(x, y, radius) || this.elevation.blockedAt(x, y, radius);
  }

  override move(x: number, y: number, dx: number, dy: number, radius: number): { x: number; y: number } {
    if (![x, y, x + dx, y + dy].every(isWorldCoordinate) || ![dx, dy, radius].every(Number.isFinite)
      || radius < 0 || radius > WORLD_QUERY_LIMITS.collisionRadius || Math.hypot(dx, dy) > WORLD_QUERY_LIMITS.movement) return { x, y };
    return this.elevation.move(x, y, dx, dy, radius, (px, py, r) => this.groundBlocked(px, py, r));
  }

  /** Elevation cliffs also block walking segments; other checks fall back to sampled blocked(). */
  override walkableSegment(ax: number, ay: number, bx: number, by: number, radius: number): boolean | undefined {
    if (this.elevation.blocked(ax, ay, bx, by)) return false;
    const fast = super.walkableSegment(ax, ay, bx, by, radius);
    if (fast !== undefined) return fast;
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 8));
    for (let i = 0; i <= steps; i++) {
      const px = ax + (bx - ax) * i / steps, py = ay + (by - ay) * i / steps;
      if (this.blocked(px, py, radius + (i > 0 && i < steps ? 4 : 0)) || this.isSanctuary(px, py)) return false;
    }
    return true;
  }

  /** Prop-only fast path: authored sites/buildings still take the sampled path,
   * but open terrain answers from one broad-phase query instead of ~100. */
  protected override segmentPropClear(ax: number, ay: number, bx: number, by: number, radius: number, steps: number, first: number, last: number): boolean | undefined {
    if (first > last) return true;
    if (![ax, ay, bx, by].every(isWorldCoordinate) || radius < 0 || radius > WORLD_QUERY_LIMITS.collisionRadius || Math.hypot(bx - ax, by - ay) > 4000) return undefined;
    const extent = radius + MAX_PROP_RADIUS;
    const left = Math.min(ax, bx) - extent, top = Math.min(ay, by) - extent, width = Math.abs(bx - ax) + extent * 2, height = Math.abs(by - ay) + extent * 2;
    if (!validWorldRectangle(left, top, width, height)) return undefined;
    const region = this.collisionRegion(left, top, width, height);
    if (region.buildings.length || region.sites.length) return undefined;
    const dx = bx - ax, dy = by - ay, lengthSquared = dx * dx + dy * dy;
    const hit = (p: { x: number; y: number; radius: number }) => {
      const nearest = lengthSquared ? Math.round(((p.x - ax) * dx + (p.y - ay) * dy) / lengthSquared * steps) : first;
      const index = Math.max(first, Math.min(last, nearest)), x = ax + dx * index / steps, y = ay + dy * index / steps;
      return (x - p.x) ** 2 + (y - p.y) ** 2 < (radius + p.radius) ** 2 - 1e-7;
    };
    if (region.props.some(hit)) return false;
    // Ocean/deep water still blocks; sample the water mask at the same steps.
    for (let i = first; i <= last; i++) {
      const px = ax + dx * i / steps, py = ay + dy * i / steps;
      if (!this.zoneAtFast(px, py)) return false;
      const water = this.terrainWater(px, py);
      if (water.coverage > .5 && water.depth >= .75) return false;
    }
    return true;
  }

  // ── Elevation queries (renderer seam, T03) ─────────────────────────────────
  elevationAt(x: number, y: number): number { return this.elevation.elevationAt(x, y); }
  elevationTier(x: number, y: number): number { return this.elevation.elevationTier(x, y); }
  elevationRegion(x: number, y: number, width: number, height: number): ElevationRegion {
    return this.elevation.region(x, y, width, height);
  }

  override impactMaterial(x: number, y: number, radius: number): MaterialId {
    if (!zoneAt(x, y)) return 'stone';
    return super.impactMaterial(x, y, radius);
  }
}

/** Continent name for a zone's authored district label. */
export function authoredContinentName(zone: AtlasZone): string {
  return CONTINENTS[zone.continent].name;
}

/** Overworld factory: the authored atlas when the feature flag is on, else the
 * procedural climate world. RiftWorld/dungeon worlds are constructed directly. */
export function createWorld(seed: number): World {
  return GAME_FEATURES.authored ? new AuthoredWorld(seed) : new World(seed);
}
