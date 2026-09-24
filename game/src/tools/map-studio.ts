/** Map & world studio (wayfinder world-t03): a memory-only authoring surface over
 * the real world generator. The procedural world is retuned in place — climate
 * bias, water, props, settlements, wilderness sites, dungeon entrances and road
 * weight — while the authored atlas stays available for zone/faction review.
 * Nothing touches playable saves: the survey chart is disposable and every
 * placed POI lives only in this page. */
import '../ui-kit.css';
import '../typography.css';
import '../world-map.css';
import './map-studio.css';
import { installUITheme } from '../ui-theme.ts';
import { loadGameFont, text } from '../font.ts';
import { uiIcon } from '../ui-components.ts';
import { downloadJSON, reportRoute } from './common.ts';
import { World } from '../world.ts';
import { AuthoredWorld } from '../authored-world.ts';
import { noise2, random2 } from '../random-source.ts';
import { smoothstep } from '../art-primitives.ts';
import { WorldMap, projectMapPoint, type MapPlayer, type MapView, type MapWorld } from '../world-map.ts';
import { drawMapZoneLevels, mapZoneLabels } from '../map-zone-art.ts';
import { MAP_OVERVIEW_ZOOM } from '../atlas-overview.ts';
import { Exploration, EXPLORATION_CHUNK_CELLS, EXPLORATION_CHUNK_SIZE, type ExplorationWorld, type MapPOI, type MapRect } from '../exploration.ts';
import { ATLAS_SURVEYS, atlasSurveyBounds } from './atlas-survey.ts';
import { formatWorldDistance } from '../world-distance.ts';
import { parseWorldSeed } from '../world-seed.ts';
import { getZoneAt } from '../zone-progression.ts';
import { regionLevelLabel } from '../encounter-scaling.ts';
import { factionAt } from '../factions.ts';
import { zoneAt, zoneRect, ZONES, CONTINENTS } from '../world-atlas.ts';
import { BIOMES, BIOME_IDS, biomeGround, biomeMapColor, proceduralBiomeSample, type BiomeId, type BiomeSample, type BiomeWeights } from '../biomes.ts';
import { roadSurface } from '../road-shape.ts';
import type { Settlement } from '../settlements.ts';
import { surfaceWaterWeight } from '../ground-material.ts';
import { landscapeRelief } from '../natural-landscape.ts';
import type { WaterSample } from '../hydrology.ts';
import type { ZoneTint } from '../zone-palettes.ts';
import { POI_DEFINITIONS, type POIKind } from '../world-pois.ts';

if (!import.meta.env.DEV) throw new Error('The map studio is available only on the local development server.');
installUITheme();

// ── Tunable generation ───────────────────────────────────────────────────────
/** In-memory tuning; the world reads this object live so sliders never rebuild it. */
interface StudioTuning {
  /** Per-climate weight multiplier applied after the procedural biome sample. */
  biomeBias: BiomeWeights;
  /** River/lake coverage multiplier (0–2). */
  waterDensity: number;
  /** Keep probability for ground props (0–1). */
  propDensity: number;
  /** Keep probability for generated settlements (0–1). */
  settlementDensity: number;
  /** Keep probability for wilderness sites and roadside event sites (0–1). */
  siteDensity: number;
  /** Keep probability for dungeon entrances (0–1). */
  dungeonDensity: number;
  /** Road surface weight multiplier (0–1). */
  roadDensity: number;
}
const defaultTuning = (): StudioTuning => ({
  biomeBias: { deadwood: 1, verdant: 1, swamp: 1, frostpine: 1, emberfall: 1, autumn: 1, highlands: 1, steppe: 1, sunscar: 1 },
  waterDensity: 1, propDensity: 1, settlementDensity: 1, siteDensity: 1, dungeonDensity: 1, roadDensity: 1,
});
const tuning = defaultTuning();

/** Deterministic keep/drop keyed on the feature's own position, so density
 * changes are stable across queries and never query-order dependent. */
function keep(seed: number, salt: number, x: number, y: number, density: number): boolean {
  return random2(Math.round(x), Math.round(y), seed, salt) < density;
}

/** Blend a biome ground color toward an authored zone tint (mirrors world-landscape). */
function tintGround(base: readonly number[], tint?: ZoneTint | null): [number, number, number] {
  if (!tint) return [base[0], base[1], base[2]];
  const k = .62, g = tint.ground;
  return [base[0] * (1 - k) + g[0] * k, base[1] * (1 - k) + g[1] * k, base[2] * (1 - k) + g[2] * k];
}

/** Procedural world with the studio tuning applied on top of the real generator. */
class StudioWorld extends World {
  readonly tuning: StudioTuning;
  constructor(seed: number, tuning: StudioTuning) { super(seed); this.tuning = tuning; }

  /** Climate bias re-weights the blended biome field, then re-picks the dominant id. */
  override sampleBiome(x: number, y: number): BiomeSample {
    const sample = proceduralBiomeSample(x, y, this.seed), bias = this.tuning.biomeBias;
    const weights = { ...sample.weights };
    let sum = 0;
    for (const id of BIOME_IDS) { weights[id] *= bias[id]; sum += weights[id]; }
    if (sum <= 0) return sample;
    let id: BiomeId = 'deadwood';
    for (const candidate of BIOME_IDS) { weights[candidate] /= sum; if (weights[candidate] > weights[id]) id = candidate; }
    return { id, name: BIOMES[id].name, weights, ...(sample.tint ? { tint: sample.tint } : {}) };
  }

  /** Water density scales river/lake coverage, depth and bank shading. */
  protected override terrainWater(x: number, y: number): WaterSample {
    const water = super.terrainWater(x, y), d = this.tuning.waterDensity;
    if (d === 1 || water.coverage <= 0) return water;
    const coverage = Math.min(1, water.coverage * d);
    return { ...water, coverage, depth: water.depth * d, bank: water.bank * d, kind: coverage <= 0 ? 'dry' : water.kind };
  }

  protected override roadWeight(x: number, y: number): number {
    return super.roadWeight(x, y) * this.tuning.roadDensity;
  }

  override getSettlements(x: number, y: number, width: number, height: number): Settlement[] {
    const towns = super.getSettlements(x, y, width, height), d = this.tuning.settlementDensity;
    return d >= 1 ? towns : towns.filter(t => keep(this.seed, 11, t.x, t.y, d));
  }
  override getWildernessSites(x: number, y: number, width: number, height: number) {
    const sites = super.getWildernessSites(x, y, width, height), d = this.tuning.siteDensity;
    return d >= 1 ? sites : sites.filter(s => s.id.endsWith(':first-camp') || keep(this.seed, 13, s.x, s.y, d));
  }
  override getDungeonEntrances(x: number, y: number, w: number, h: number) {
    const entrances = super.getDungeonEntrances(x, y, w, h), d = this.tuning.dungeonDensity;
    return d >= 1 ? entrances : entrances.filter(e => keep(this.seed, 17, e.x, e.y, d));
  }
  override getEventSites(x: number, y: number, width: number, height: number) {
    const sites = super.getEventSites(x, y, width, height), d = this.tuning.siteDensity;
    return d >= 1 ? sites : sites.filter(s => keep(this.seed, 19, s.x, s.y, d));
  }
  override getProps(x: number, y: number, width: number, height: number) {
    const props = super.getProps(x, y, width, height), d = this.tuning.propDensity;
    return d >= 1 ? props : props.filter(p => keep(this.seed, 23, p.x, p.y, d));
  }
  override getPOIs(x: number, y: number, width: number, height: number) {
    const pois = super.getPOIs(x, y, width, height), d = this.tuning.propDensity;
    return d >= 1 ? pois : pois.filter(p => p.kind !== 'shrine' || keep(this.seed, 29, p.x, p.y, d));
  }

  /** Same composition as WorldLandscape.surfaceColor with the road weight tuned. */
  protected override surfaceColor(x: number, y: number, towns: Settlement[], detail: boolean): number[] {
    const damp = noise2(x / 180, y / 180, this.seed + 201);
    const sample = this.sampleBiome(x, y), weights = sample.weights;
    const profile = roadSurface(x, y, this.seed);
    const road = profile.weight * this.tuning.roadDensity * (towns.some(t => Math.hypot(x - t.x, y - t.y) < t.radius - 100) ? 0 : 1);
    const paved = this.pavingWeight(towns, x, y, road);
    const base = tintGround(detail ? biomeGround(weights, smoothstep(.50, .85, damp) * .65) : biomeMapColor(weights), sample.tint);
    const hydro = this.terrainWater(x, y);
    const water = Math.max(surfaceWaterWeight(weights, damp, road), hydro.coverage * (1 - paved));
    const wet = smoothstep(.35, .85, damp) * (.35 + weights.swamp * .65);
    const shallows = Math.max(0, 1 - hydro.depth / .65);
    const pool = [17 + shallows * 22, 51 + shallows * 25, 60 + shallows * 16];
    const dirt = [58 - wet * 9, 51 - wet * 5, 39 - wet * 2];
    const town = towns.find(t => Math.hypot(x - t.x, y - t.y) < t.radius);
    const strength = town?.kind === 'city' ? .5 : town?.kind === 'village' ? .34 : .25;
    const earth = [58 + weights.sunscar * 40, 51 + weights.sunscar * 33, 39 + weights.sunscar * 22];
    const stone = base.map((v, i) => v * (1 - strength) + earth[i] * strength + (town?.kind === 'city' ? 3 : 0));
    const weather = detail ? (noise2(x / 93, y / 93, this.seed + 203) - .5) * 18 : (noise2(x / 320, y / 320, this.seed + 203) - .5) * 10;
    const relief = (detail ? landscapeRelief(x, y, this.seed, weights) : (noise2(x / 700, y / 700, this.seed + 205) - .5) * 22);
    const grain = detail ? (noise2(x / 18, y / 18, this.seed + 202) - .5) * 5 : 0;
    const track = profile.tracks * road * (1 - paved) * 3;
    const bank = hydro.bank * .7 + (detail ? weights.swamp * (smoothstep(.40, .50, damp) - smoothstep(.50, .64, damp)) * (1 - road) : 0);
    const dryRoad = road * (1 - hydro.coverage * .88);
    const shore = smoothstep(.02, .3, hydro.coverage) * (1 - smoothstep(.3, .6, hydro.coverage));
    return base.map((value, i) => (((value + relief + weather * .65 + [22, 23, 15][i] * bank - shore * 14) * (1 - water) + pool[i] * water) * (1 - dryRoad)
      + (dirt[i] + weather - track) * dryRoad) * (1 - paved)
      + (stone[i] + weather * .7 - (detail ? wet * 4 : 0)) * paved + grain);
  }
}

// ── Disposable survey with authored POI placement ────────────────────────────
/** Same bounded survey as the atlas review, plus studio-placed landmarks. */
class StudioSurvey extends Exploration {
  private landmarks = new Map<string, MapPOI>();
  private placed = new Map<string, MapPOI>();
  override get discoveredPOICount() { return this.landmarks.size + this.placed.size; }
  override getDiscoveredPOIs(bounds?: MapRect): MapPOI[] {
    const inside = (p: MapPOI) => !bounds || (p.x >= bounds.x && p.x <= bounds.x + bounds.width && p.y >= bounds.y && p.y <= bounds.y + bounds.height);
    return [...this.landmarks.values(), ...this.placed.values()].filter(inside);
  }
  constructor(world: ExplorationWorld, region: MapRect) {
    super(world, { storage: null });
    const chunks = [];
    for (let y = region.y / EXPLORATION_CHUNK_SIZE; y < (region.y + region.height) / EXPLORATION_CHUNK_SIZE; y++)
      for (let x = region.x / EXPLORATION_CHUNK_SIZE; x < (region.x + region.width) / EXPLORATION_CHUNK_SIZE; x++)
        chunks.push({ x, y, revision: 0, words: new Uint32Array(EXPLORATION_CHUNK_CELLS).fill(0xffffffff) });
    if (!this.importSnapshot({ chunks, pois: [] })) throw new Error('Survey exceeds chart capacity');
  }
  /** Studio POI: charted like a discovered landmark and revealed around its cell. */
  place(poi: MapPOI) {
    this.placed.set(poi.id, poi);
    this.reveal(poi.x, poi.y, 320);
    this.revision++;
  }
  removePlaced(id: string) { if (this.placed.delete(id)) this.revision++; }
  /** Small spatial batches yield between frames; closing or rebuilding cancels discovery. */
  async survey(region: MapRect, signal: AbortSignal, progress: (fraction: number) => void,
    yieldFrame = () => new Promise<void>(resolve => setTimeout(resolve, 0))) {
    const step = EXPLORATION_CHUNK_SIZE * 4, total = Math.ceil(region.width / step) * Math.ceil(region.height / step);
    let done = 0, started = performance.now();
    for (let y = region.y; y < region.y + region.height; y += step)
      for (let x = region.x; x < region.x + region.width; x += step) {
        if (signal.aborted) return;
        for (const poi of this.world.getPOIs(x, y, Math.min(step, region.x + region.width - x), Math.min(step, region.y + region.height - y)))
          if (this.isRevealed(poi.x, poi.y)) this.landmarks.set(poi.id, poi);
        this.revision++; done++;
        if (performance.now() - started >= 12 || done === total) {
          progress(done / total); await yieldFrame(); started = performance.now();
        }
      }
  }
}

// ── Page state ───────────────────────────────────────────────────────────────
type WorldMode = 'procedural' | 'atlas';
const params = new URLSearchParams(location.search);
const requestedSeed = Number(params.get('seed'));
let seed = params.has('seed') && Number.isSafeInteger(requestedSeed) ? requestedSeed >>> 0 : 7319;
let mode: WorldMode = params.get('mode') === 'atlas' ? 'atlas' : 'procedural';
let zoneId: string = ZONES[params.get('zone') ?? ''] != null ? params.get('zone')! : 'elwynn';
let surveyId = ATLAS_SURVEYS.find(s => s.id === params.get('size'))?.id ?? 'wide';
let showBoundaries = params.get('boundaries') !== '0';
let showLevels = params.get('levels') !== '0';
let placing: POIKind | null = null;
let inspected: { x: number; y: number } | null = null;
const placed: MapPOI[] = [];
let placeCounter = 0;

let world: World | null = null;
let chart: StudioSurvey | null = null;
let map: WorldMap | null = null;
let surveyAbort: AbortController | null = null;
let rebuildTimer: number | null = null;
let overlay: HTMLCanvasElement | null = null;
let overlayKey = '';
let disposed = false;
const pageAbort = new AbortController();
const player: MapPlayer = { x: 0, y: 0, angle: -Math.PI / 2 };

const root = document.querySelector<HTMLElement>('#map-studio')!;

/** Surveyed square: centered on the origin for the procedural world, on the
 * selected atlas zone's rect in atlas mode. The origin snaps down to the
 * exploration-chunk grid — imported chunk keys are integer cell coords, so a
 * fractional origin would reveal nothing. */
function surveyRegion(): MapRect {
  const base = atlasSurveyBounds(surveyId);
  if (mode === 'procedural') return base;
  const rect = zoneRect(zoneId);
  if (rect == null) return base;
  const x = Math.floor((rect.x + rect.w / 2 - base.width / 2) / EXPLORATION_CHUNK_SIZE) * EXPLORATION_CHUNK_SIZE;
  const y = Math.floor((rect.y + rect.h / 2 - base.height / 2) / EXPLORATION_CHUNK_SIZE) * EXPLORATION_CHUNK_SIZE;
  return { x: x, y: y, width: base.width, height: base.height };
}

function syncURL() {
  const url = new URL(location.href);
  url.searchParams.set('seed', String(seed));
  url.searchParams.set('mode', mode);
  url.searchParams.set('size', surveyId);
  url.searchParams.set('boundaries', showBoundaries ? '1' : '0');
  url.searchParams.set('levels', showLevels ? '1' : '0');
  if (mode === 'atlas') url.searchParams.set('zone', zoneId); else url.searchParams.delete('zone');
  history.replaceState(null, '', url); reportRoute();
}

function setStatus(value: string) {
  const el = root.querySelector<HTMLElement>('.ms-status');
  if (el && el.textContent !== value) el.textContent = value;
}

/** Rebuild world + chart + map. The tuning object is shared, so slider edits
 * only need a rebuild; the world itself is recreated for a clean cache. */
function rebuild(keepView: boolean) {
  surveyAbort?.abort();
  const previous = keepView && map ? map.viewBounds : null;
  map?.dispose(); map = null;
  chart?.dispose(); chart = null;
  world?.dispose(); world = null;
  overlay = null; overlayKey = '';

  world = mode === 'atlas' ? new AuthoredWorld(seed) : new StudioWorld(seed, tuning);
  const region = surveyRegion();
  chart = new StudioSurvey(world, region);
  for (const poi of placed) chart.place(poi);

  const mount = root.querySelector<HTMLElement>('.ms-map-mount')!;
  map = new WorldMap(world as MapWorld, chart, mount, () => {});
  map.setZoneLevels(false); // The studio overlay draws boundaries/labels itself.
  map.open(player);
  if (previous) map.fitBounds(previous, 0); else map.fitBounds(region, 24);
  drawOverlay();
  bindMapInput();
  (window as unknown as { __studio?: unknown }).__studio = { map, chart, world, tuning };

  surveyAbort = new AbortController();
  const signal = surveyAbort.signal;
  let lastRefresh = 0;
  void chart.survey(region, signal, progress => {
    if (disposed || signal.aborted) return;
    setStatus(progress < 1 ? `Surveying landmarks · ${Math.round(progress * 100)}%`
      : `${formatWorldDistance(region.width)} × ${formatWorldDistance(region.height)} · ${chart!.discoveredPOICount.toLocaleString()} landmarks`);
    if (progress === 1 || performance.now() - lastRefresh > 500) { map?.update(player, 0); drawOverlay(); lastRefresh = performance.now(); }
  });
}

function scheduleRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = window.setTimeout(() => { rebuildTimer = null; if (!disposed) rebuild(true); }, 380);
}

// ── Map input: click inspects a point or drops a staged POI ─────────────────
function bindMapInput() {
  if (!map) return;
  const canvas = map.getCanvas();
  const signal = pageAbort.signal;
  let down: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', event => {
    if (event.button === 0) down = { x: event.clientX, y: event.clientY };
  }, { signal });
  canvas.addEventListener('pointercancel', () => { down = null; }, { signal });
  canvas.addEventListener('pointerup', event => {
    if (!down || event.button !== 0) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    down = null;
    if (moved > 6 || !map) return;
    const rect = canvas.getBoundingClientRect(), b = map.viewBounds;
    const wx = b.x + (event.clientX - rect.left) / Math.max(1, rect.width) * b.width;
    const wy = b.y + (event.clientY - rect.top) / Math.max(1, rect.height) * b.height;
    if (placing) placePOI(wx, wy); else inspect(wx, wy);
  }, { signal });
}

function placePOI(x: number, y: number) {
  if (!placing || !chart || !map) return;
  const kind = placing;
  const nameInput = root.querySelector<HTMLInputElement>('.ms-poi-name');
  const name = nameInput?.value.trim() || `${POI_DEFINITIONS[kind].label} ${++placeCounter}`;
  const poi: MapPOI = { id: `studio:${kind}:${++placeCounter}:${Math.round(x)}:${Math.round(y)}`, name, kind, x, y, description: 'Studio-placed marker.' };
  placed.push(poi);
  chart.place(poi);
  map.update(player, 0);
  renderPlacedList();
  inspect(x, y); // inspect() also refreshes the overlay marker
  setStatus(`Placed ${name} at X ${Math.round(x)} · Y ${Math.round(y)}`);
}

function removePlaced(id: string) {
  const index = placed.findIndex(p => p.id === id);
  if (index < 0) return;
  placed.splice(index, 1);
  chart?.removePlaced(id);
  map?.update(player, 0);
  drawOverlay();
  renderPlacedList();
}

// ── Inspector ────────────────────────────────────────────────────────────────
function inspect(x: number, y: number) {
  inspected = { x, y };
  drawOverlay();
  const panel = root.querySelector<HTMLElement>('.ms-inspect')!;
  panel.replaceChildren();
  if (!world || !chart) return;
  const zone = getZoneAt(x, y, seed), atlas = zoneAt(x, y), biome = world.sampleBiome(x, y);
  const water = world.sampleWater(x, y), faction = factionAt(x, y);
  const stat = (label: string, value: string) => {
    const row = document.createElement('div');
    row.className = 'ms-stat';
    row.innerHTML = `<span class="ms-stat-label"></span><span class="ms-stat-value"></span>`;
    row.querySelector('.ms-stat-label')!.textContent = label;
    row.querySelector('.ms-stat-value')!.textContent = value;
    panel.append(row);
  };
  const head = document.createElement('h3');
  head.textContent = zone.districtName;
  panel.append(head);
  const sub = document.createElement('p');
  sub.className = 'ms-inspect-sub';
  sub.textContent = `${zone.name} · X ${Math.round(x)} · Y ${Math.round(y)}`;
  panel.append(sub);
  stat('Level range', `${regionLevelLabel(zone)}${zone.hazardous ? ' · hazardous' : ''}`);
  stat('Biome', biome.name);
  stat('Faction', atlas ? `${faction} (${atlas.faction} territory)` : `${faction} · uncharted territory`);
  stat('Water', water.coverage > 0 ? `${water.kind} · ${(water.coverage * 100).toFixed(0)}% cover · depth ${water.depth.toFixed(2)}` : 'dry');
  const towns = world.getSettlements(x - 900, y - 900, 1800, 1800);
  stat('Settlement', towns.length ? `${towns[0].name} · ${towns[0].kind}` : `nearest: ${world.getNearestSettlement(x, y).name}`);
  const sites = world.getWildernessSites(x - 1200, y - 1200, 2400, 2400);
  if (sites.length) stat('Wilderness site', `${sites[0].name} · ${sites[0].kind}`);
  stat('Props nearby', String(world.getProps(x - 400, y - 400, 800, 800).length));
  const pois = chart.getDiscoveredPOIs({ x: x - 3000, y: y - 3000, width: 6000, height: 6000 })
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, 6);
  if (pois.length) {
    const list = document.createElement('ul');
    list.className = 'ms-nearby';
    for (const poi of pois) {
      const item = document.createElement('li');
      item.innerHTML = `<i style="background:${POI_DEFINITIONS[poi.kind].color}"></i><span class="ms-nearby-name"></span><span class="ms-nearby-dist"></span>`;
      item.querySelector('.ms-nearby-name')!.textContent = `${poi.name} · ${POI_DEFINITIONS[poi.kind].label}`;
      item.querySelector('.ms-nearby-dist')!.textContent = formatWorldDistance(Math.hypot(poi.x - x, poi.y - y));
      list.append(item);
    }
    const label = document.createElement('p');
    label.className = 'ms-inspect-sub';
    label.textContent = 'Charted landmarks nearby';
    panel.append(label, list);
  }
  const center = document.createElement('button');
  center.type = 'button';
  center.className = 'ui-button ui-button--quiet ms-center';
  center.textContent = 'Center map here';
  center.addEventListener('click', () => map?.fitBounds({ x: x - 400, y: y - 400, width: 800, height: 800 }, 40));
  panel.append(center);
}

// ── Overlay: zone boundaries, region labels, inspected marker ────────────────
function ensureOverlay(): HTMLCanvasElement | null {
  if (!map) return null;
  if (overlay?.isConnected) return overlay;
  const canvas = map.getCanvas();
  overlay = document.createElement('canvas');
  overlay.className = 'ms-overlay';
  canvas.after(overlay);
  return overlay;
}

function drawOverlay() {
  const o = ensureOverlay();
  if (!o || !map || !chart || !world) return;
  const b = map.viewBounds;
  const cssW = Math.max(1, Math.round(o.clientWidth || map.getCanvas().clientWidth));
  const cssH = Math.max(1, Math.round(o.clientHeight || map.getCanvas().clientHeight));
  const ratio = Math.max(1, Math.min(4, window.devicePixelRatio || 1));
  const key = [b.x.toFixed(1), b.y.toFixed(1), b.width.toFixed(1), b.height.toFixed(1), cssW, cssH, ratio,
    chart.revision, showBoundaries, showLevels, inspected?.x ?? '', inspected?.y ?? ''].join('|');
  if (key === overlayKey) return;
  overlayKey = key;
  if (o.width !== Math.round(cssW * ratio)) o.width = Math.round(cssW * ratio);
  if (o.height !== Math.round(cssH * ratio)) o.height = Math.round(cssH * ratio);
  const c = o.getContext('2d')!;
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  c.clearRect(0, 0, cssW, cssH);
  const view: MapView = { x: 0, y: 0, width: cssW, height: cssH, centerX: b.x + b.width / 2, centerY: b.y + b.height / 2, zoom: cssW / b.width };
  const zoneKey = (world as MapWorld).zoneKey;
  if (showBoundaries) drawMapZoneLevels(c, view, chart, seed, [], zoneKey);
  // The authored overview silhouette already names zones below MAP_OVERVIEW_ZOOM;
  // studio labels only add district names the chart doesn't print itself.
  if (showLevels && !(zoneKey && view.zoom < MAP_OVERVIEW_ZOOM)) {
    const towns = chart.getDiscoveredPOIs(b).filter(p => p.kind === 'town');
    for (const zone of mapZoneLabels(view, chart, seed, towns, zoneKey)) {
      const p = projectMapPoint(zone.x, zone.y, view);
      c.save();
      c.shadowColor = '#030b10'; c.shadowBlur = 5;
      text(c, zone.name.split(' · ')[0], p.x, p.y - 11, 1.15, '#d6ded5', 'center');
      text(c, `${zone.hazardous ? '! ' : ''}${regionLevelLabel(zone)}`, p.x, p.y + 5, 1.25, zone.hazardous ? '#ffb28b' : '#f0dba6', 'center');
      c.restore();
    }
  }
  if (inspected) {
    const p = projectMapPoint(inspected.x, inspected.y, view);
    c.save();
    c.strokeStyle = '#f4e3b2'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(p.x, p.y, 9, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#f4e3b280';
    c.beginPath();
    c.moveTo(p.x - 15, p.y); c.lineTo(p.x - 5, p.y); c.moveTo(p.x + 5, p.y); c.lineTo(p.x + 15, p.y);
    c.moveTo(p.x, p.y - 15); c.lineTo(p.x, p.y - 5); c.moveTo(p.x, p.y + 5); c.lineTo(p.x, p.y + 15);
    c.stroke();
    c.restore();
  }
}

function overlayLoop() {
  if (disposed) return;
  drawOverlay();
  requestAnimationFrame(overlayLoop);
}

// ── Placed POI list ──────────────────────────────────────────────────────────
function renderPlacedList() {
  const list = root.querySelector<HTMLElement>('.ms-placed-list')!;
  list.replaceChildren();
  if (!placed.length) {
    const empty = document.createElement('li');
    empty.className = 'ms-placed-empty';
    empty.textContent = 'No studio markers yet.';
    list.append(empty);
    return;
  }
  for (const poi of placed) {
    const item = document.createElement('li');
    item.className = 'ms-placed-item';
    item.innerHTML = `<i style="background:${POI_DEFINITIONS[poi.kind].color}"></i><span class="ms-placed-name"></span><span class="ms-placed-coords"></span>
      <button type="button" class="ui-button ui-button--quiet ui-button--icon" data-locate aria-label="Center on marker">${uiIcon('center')}</button>
      <button type="button" class="ui-button ui-button--quiet ui-button--icon" data-remove aria-label="Remove marker">${uiIcon('trash')}</button>`;
    item.querySelector('.ms-placed-name')!.textContent = poi.name;
    item.querySelector('.ms-placed-coords')!.textContent = `X ${Math.round(poi.x)} · Y ${Math.round(poi.y)}`;
    item.querySelector('[data-locate]')!.addEventListener('click', () =>
      map?.fitBounds({ x: poi.x - 400, y: poi.y - 400, width: 800, height: 800 }, 40));
    item.querySelector('[data-remove]')!.addEventListener('click', () => removePlaced(poi.id));
    list.append(item);
  }
}

// ── Export ───────────────────────────────────────────────────────────────────
function exportPayload() {
  return {
    tool: 'map-studio', seed, mode,
    zone: mode === 'atlas' ? zoneId : null,
    survey: surveyId,
    generationVersion: world?.generationVersion ?? null,
    tuning: mode === 'procedural' ? {
      biomeBias: { ...tuning.biomeBias },
      waterDensity: tuning.waterDensity,
      propDensity: tuning.propDensity,
      settlementDensity: tuning.settlementDensity,
      siteDensity: tuning.siteDensity,
      dungeonDensity: tuning.dungeonDensity,
      roadDensity: tuning.roadDensity,
    } : null,
    placedPOIs: placed.map(p => ({ id: p.id, kind: p.kind, name: p.name, x: Math.round(p.x), y: Math.round(p.y) })),
  };
}

// ── Page assembly ────────────────────────────────────────────────────────────
const PLACEABLE: readonly POIKind[] = ['camp', 'landmark', 'dungeon', 'town', 'watchtower', 'graveyard', 'standingStones', 'caravan', 'beastDen', 'quarry', 'hamlet', 'crossing', 'corruptedGrove', 'cursedChest', 'ruinedChapel', 'bossLair', 'reliquary', 'shrine', 'portal', 'rift'];

interface SliderSpec { key: keyof Omit<StudioTuning, 'biomeBias'>; label: string; max: number; step: number; }
const DENSITY_SLIDERS: readonly SliderSpec[] = [
  { key: 'waterDensity', label: 'Water & rivers', max: 2, step: .05 },
  { key: 'propDensity', label: 'Props', max: 1, step: .05 },
  { key: 'settlementDensity', label: 'Settlements', max: 1, step: .05 },
  { key: 'siteDensity', label: 'Wilderness sites', max: 1, step: .05 },
  { key: 'dungeonDensity', label: 'Dungeons', max: 1, step: .05 },
  { key: 'roadDensity', label: 'Roads', max: 1, step: .05 },
];

function sliderRow(label: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void): HTMLElement {
  const row = document.createElement('label');
  row.className = 'ms-slider';
  row.innerHTML = `<span class="ms-slider-label"></span><input type="range"><output></output>`;
  row.querySelector('.ms-slider-label')!.textContent = label;
  const input = row.querySelector('input')!;
  input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
  const output = row.querySelector('output')!;
  const show = () => { output.textContent = `${Math.round(Number(input.value) * 100)}%`; };
  show();
  input.addEventListener('input', () => { show(); onInput(Number(input.value)); });
  return row;
}

async function start() {
  await loadGameFont();
  if (disposed) return;
  document.title = 'Evergrow · Map & world studio';
  root.innerHTML = `<header class="ms-header"><div class="ms-heading">${uiIcon('map')}<div><p class="ui-kicker">World</p><h1>Map &amp; world studio</h1></div></div>
    <form class="ms-seeds">
      <label>Seed <input name="seed" aria-label="World seed" type="number" min="0" max="4294967295" step="1" required value="${seed}"></label>
      <label>World <select name="mode" aria-label="World mode">
        <option value="procedural"${mode === 'procedural' ? ' selected' : ''}>Procedural (tunable)</option>
        <option value="atlas"${mode === 'atlas' ? ' selected' : ''}>Authored atlas</option></select></label>
      <label class="ms-zone"${mode === 'atlas' ? '' : ' hidden'}>Zone <select name="zone" aria-label="Atlas zone">
        ${Object.values(ZONES).map(z => `<option value="${z.id}"${z.id === zoneId ? ' selected' : ''}>${CONTINENTS[z.continent].name} · ${z.name}</option>`).join('')}</select></label>
      <label>Survey <select name="size" aria-label="Survey size">${ATLAS_SURVEYS.map(s => `<option value="${s.id}"${s.id === surveyId ? ' selected' : ''}>${s.label} · ${formatWorldDistance(atlasSurveyBounds(s.id).width)}</option>`).join('')}</select></label>
      <button class="ui-button" type="submit">Generate</button><button class="ui-button" type="button" data-random>New seed</button>
    </form></header>
    <div class="ms-body">
      <aside class="ms-panel ms-panel--left" aria-label="Generation tuning"></aside>
      <div class="ms-map-mount"><div class="ms-placing-banner" hidden></div></div>
      <aside class="ms-panel ms-panel--right" aria-label="Inspector and markers"></aside>
    </div>
    <footer class="ms-footer"><span class="ms-status" role="status">Surveying landmarks…</span>
      <span class="ms-footer-actions"><button type="button" class="ms-toggle" data-toggle="boundaries" aria-pressed="${showBoundaries}">Zone boundaries</button> ·
      <button type="button" class="ms-toggle" data-toggle="levels" aria-pressed="${showLevels}">Region levels</button> ·
      <button type="button" class="ms-fit">Fit survey</button> ·
      <a href="#" class="ms-export-png">Export PNG</a> ·
      <a href="#" class="ms-export-json">Export JSON</a> ·
      <a href="#" class="ms-copy-json">Copy JSON</a></span></footer>`;

  const signal = pageAbort.signal;
  const left = root.querySelector<HTMLElement>('.ms-panel--left')!;
  const right = root.querySelector<HTMLElement>('.ms-panel--right')!;

  // Generation tuning (procedural world only).
  const tuneSection = document.createElement('section');
  tuneSection.className = 'ms-section';
  tuneSection.innerHTML = `<h2>Generation</h2><p class="ms-hint">Sliders retune the procedural world in memory and regenerate the survey.</p>`;
  const tuneField = document.createElement('fieldset');
  tuneField.className = 'ms-field';
  tuneField.disabled = mode !== 'procedural';
  for (const spec of DENSITY_SLIDERS)
    tuneField.append(sliderRow(spec.label, tuning[spec.key], 0, spec.max, spec.step, v => { tuning[spec.key] = v; scheduleRebuild(); }));
  const biomeDetails = document.createElement('details');
  biomeDetails.className = 'ms-biomes';
  biomeDetails.innerHTML = '<summary>Climate weights</summary>';
  for (const id of BIOME_IDS)
    biomeDetails.append(sliderRow(BIOMES[id].name, tuning.biomeBias[id], 0, 3, .1, v => { tuning.biomeBias[id] = v; scheduleRebuild(); }));
  tuneField.append(biomeDetails);
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'ui-button ui-button--quiet ms-reset';
  reset.textContent = 'Reset tuning';
  reset.addEventListener('click', () => {
    Object.assign(tuning, defaultTuning());
    for (const input of tuneField.querySelectorAll<HTMLInputElement>('input[type="range"]')) input.dispatchEvent(new Event('input'));
  });
  tuneSection.append(tuneField, reset);
  if (mode !== 'procedural') {
    const note = document.createElement('p');
    note.className = 'ms-hint';
    note.textContent = 'Tuning applies to the procedural world; the authored atlas is fixed.';
    tuneSection.append(note);
  }
  left.append(tuneSection);

  // POI placement.
  const poiSection = document.createElement('section');
  poiSection.className = 'ms-section';
  poiSection.innerHTML = `<h2>Place POI</h2><p class="ms-hint">Pick a marker type, arm placement, then click the map. Markers render through the real chart.</p>`;
  const poiForm = document.createElement('div');
  poiForm.className = 'ms-poi-form';
  poiForm.innerHTML = `<select class="ms-poi-kind" aria-label="POI kind">${PLACEABLE.map(k => `<option value="${k}">${POI_DEFINITIONS[k].label}</option>`).join('')}</select>
    <input class="ms-poi-name" type="text" maxlength="48" placeholder="Name (optional)" aria-label="POI name">
    <button type="button" class="ui-button ms-arm" aria-pressed="false">${uiIcon('pin')} Arm placement</button>`;
  poiSection.append(poiForm);
  left.append(poiSection);

  const banner = root.querySelector<HTMLElement>('.ms-placing-banner')!;
  const armButton = poiForm.querySelector<HTMLButtonElement>('.ms-arm')!;
  const kindSelect = poiForm.querySelector<HTMLSelectElement>('.ms-poi-kind')!;
  const setPlacing = (kind: POIKind | null) => {
    placing = kind;
    armButton.setAttribute('aria-pressed', String(!!kind));
    armButton.innerHTML = kind ? `${uiIcon('pin')} Placing… click map` : `${uiIcon('pin')} Arm placement`;
    banner.hidden = !kind;
    if (kind) banner.textContent = `Placing ${POI_DEFINITIONS[kind].label} — click the map to drop markers, or press Esc / disarm to stop.`;
    map?.getCanvas().classList.toggle('ms-placing', !!kind);
  };
  armButton.addEventListener('click', () => setPlacing(placing ? null : kindSelect.value as POIKind));
  kindSelect.addEventListener('change', () => { if (placing) setPlacing(kindSelect.value as POIKind); });
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && placing) setPlacing(null); }, { signal });

  // Inspector + placed list.
  const inspectSection = document.createElement('section');
  inspectSection.className = 'ms-section';
  inspectSection.innerHTML = '<h2>Inspect</h2>';
  const inspectBody = document.createElement('div');
  inspectBody.className = 'ms-inspect';
  inspectBody.innerHTML = '<p class="ms-hint">Click the map to inspect its zone, level range, biome, faction and nearby landmarks.</p>';
  inspectSection.append(inspectBody);
  const placedSection = document.createElement('section');
  placedSection.className = 'ms-section';
  placedSection.innerHTML = '<h2>Studio markers</h2><ul class="ms-placed-list"></ul>';
  right.append(inspectSection, placedSection);
  renderPlacedList();

  // Header form.
  const form = root.querySelector<HTMLFormElement>('form')!;
  const zoneLabel = root.querySelector<HTMLElement>('.ms-zone')!;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const parsed = parseWorldSeed(String(data.get('seed') ?? ''));
    if (parsed === null) { setStatus('Seed must be a decimal integer from 0 to 4294967295.'); return; }
    seed = parsed;
    mode = String(data.get('mode')) === 'atlas' ? 'atlas' : 'procedural';
    zoneId = ZONES[String(data.get('zone'))] != null ? String(data.get('zone')) : 'elwynn';
    surveyId = ATLAS_SURVEYS.find(s => s.id === String(data.get('size')))?.id ?? 'wide';
    tuneField.disabled = mode !== 'procedural';
    zoneLabel.hidden = mode !== 'atlas';
    syncURL();
    rebuild(false);
  }, { signal });
  form.querySelector<HTMLSelectElement>('select[name="mode"]')!.addEventListener('change', () => {
    zoneLabel.hidden = form.querySelector<HTMLSelectElement>('select[name="mode"]')!.value !== 'atlas';
  }, { signal });
  root.querySelector('[data-random]')!.addEventListener('click', () => {
    form.querySelector<HTMLInputElement>('input[name="seed"]')!.value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
    form.requestSubmit();
  }, { signal });

  // Footer controls.
  for (const button of root.querySelectorAll<HTMLButtonElement>('.ms-toggle'))
    button.addEventListener('click', () => {
      if (button.dataset.toggle === 'boundaries') showBoundaries = !showBoundaries; else showLevels = !showLevels;
      button.setAttribute('aria-pressed', button.dataset.toggle === 'boundaries' ? String(showBoundaries) : String(showLevels));
      overlayKey = '';
      drawOverlay();
      syncURL();
    }, { signal });
  root.querySelector('.ms-fit')!.addEventListener('click', () => { map?.fitBounds(surveyRegion(), 24); drawOverlay(); }, { signal });
  root.querySelector('.ms-export-png')!.addEventListener('click', event => {
    event.preventDefault();
    if (!map) return;
    const base = map.getCanvas(), shot = document.createElement('canvas');
    shot.width = base.width; shot.height = base.height;
    const c = shot.getContext('2d')!;
    c.drawImage(base, 0, 0);
    if (overlay) c.drawImage(overlay, 0, 0, shot.width, shot.height);
    const link = document.createElement('a');
    link.download = `evergrow-map-studio-${seed}-${mode}.png`;
    link.href = shot.toDataURL('image/png');
    link.click();
  }, { signal });
  root.querySelector('.ms-export-json')!.addEventListener('click', event => {
    event.preventDefault();
    downloadJSON(`evergrow-map-studio-${seed}-${mode}.json`, exportPayload());
  }, { signal });
  root.querySelector('.ms-copy-json')!.addEventListener('click', async event => {
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportPayload(), null, 2));
      setStatus('Generation JSON copied to the clipboard.');
    } catch { setStatus('Clipboard is unavailable; use Export JSON instead.'); }
  }, { signal });
  window.addEventListener('resize', () => { map?.resize(); overlayKey = ''; drawOverlay(); }, { signal });

  syncURL();
  rebuild(false);
  requestAnimationFrame(overlayLoop);
  root.setAttribute('aria-busy', 'false');
}

function dispose() {
  if (disposed) return;
  disposed = true;
  if (rebuildTimer) clearTimeout(rebuildTimer);
  surveyAbort?.abort();
  pageAbort.abort();
  map?.dispose(); map = null;
  chart?.dispose(); chart = null;
  world?.dispose(); world = null;
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
void start().catch(error => {
  if (disposed) return;
  root.textContent = `Map studio could not load: ${String(error)}`;
  root.setAttribute('aria-busy', 'false');
});
