import type { ActivityStatus } from './activity-status.ts';
import { MapLegend } from './map-legend.ts';
import { MapIconVisibility, mapIconVisible, enemyMapIconId, MAP_SERVICES, nearestMapService, type MapServiceKind } from './map-legend-content.ts';
import { drawMapPOIIcon, drawMapPlayerIcon, drawMapEnemyIcon, MAP_ICON_SIZES } from './map-icon-art.ts';
import { attachPanelFrame } from './panel-frames.ts';
import { drawMinimapFrame } from './minimap-art.ts';
import { regionLevelLabel } from './encounter-scaling.ts';
import { bindTouchCanvas } from './touch-canvas.ts';
import { formatWorldDistance } from './world-distance.ts';
import { drawJourneyMapMarker, type JourneyMarker } from './journey-marker.ts';
import { drawMapZoneLevels, mapZoneLabels } from './map-zone-art.ts';
import { drawMapOverview, drawMapOverviewFog, drawMapOverviewLabels, MAP_OVERVIEW_ZOOM } from './atlas-overview.ts';
import { drawMapProps, drawMapBuilding } from './map-terrain-art.ts';
import { drawMapCompass } from './map-compass-art.ts';
import type { Prop } from './world.ts';
import { Exploration, EXPLORATION_REVEAL_RADIUS, EXPLORATION_CELL_SIZE, EXPLORATION_CHUNK_SIZE } from './exploration.ts';
import { BIOMES, type BiomeId } from './biomes.ts';
import { roadPaths } from './road-shape.ts';
import { clampMapCoordinate, fitMapBounds, getMinimapRect, getMinimapChartRect, projectMapPoint, unprojectMapPoint, zoomMapAt, type MapView, type MapZoomLimits, MAP_ZOOM } from './map-view.ts';
import { POI_DEFINITIONS } from './world-pois.ts';
import { drawWorldEventMinimapMarkers } from './world-event-art.ts';
import { worldEventMapMarkers, type WorldEventState } from './world-event-state.ts';
import { lootMapMarkers, drawLootMapMarkers, type LootMapDrop } from './minimap-zone.ts';
export { getMinimapRect, projectMapPoint, unprojectMapPoint, zoomMapAt, type MapView, type MapZoomLimits, MAP_ZOOM } from './map-view.ts';
import type { ExplorationWorld, MapPOI, MapRect } from './exploration.ts';
import { text } from './font.ts';
import { uiIcon } from './ui-components.ts';
import { UI_THEME } from './ui-theme.ts';
import { getZoneAt, type ZoneProgression } from './zone-progression.ts';

export interface MapPlayer { x: number; y: number; angle: number; }
export interface MinimapEnemy { x: number; y: number; kind?: string; rank?:'normal'|'veteran'|'elite'|'rare'; }
export interface MapWorld extends ExplorationWorld {
  mapColor(x: number, y: number, sampleSize?: number): string;
  atlasColor?(x: number, y: number): string;
  getProps?(x: number, y: number, width: number, height: number): Prop[];
  sampleBiome(x: number, y: number): { id: string; name: string };
  getBuildings(x: number, y: number, width: number, height: number): Array<MapRect & { name?: string; kind?: string }>;
  getBuildingAt?(x: number, y: number): { name?: string } | null;
  isSanctuary?(x: number, y: number): boolean;
  /** Optional zone identity for map contours/labels; null marks unzoned ocean. */
  zoneKey?(x: number, y: number): string | null;
}
const TILE_PIXELS = 64;
export const MAP_TERRAIN_RULES = Object.freeze({ cacheLimit: 384, maximumVisibleTiles: 256, baseWorldSize: 768 });
/** Increase world coverage per tile at overview scales while retaining a bounded sample budget. */
export function mapTerrainSize(zoom: number, width: number, height: number): number {
  if (![zoom, width, height].every(Number.isFinite) || zoom <= 0 || width <= 0 || height <= 0) return MAP_TERRAIN_RULES.baseWorldSize;
  zoom = Math.max(.00025, zoom); width = Math.min(16384, width); height = Math.min(16384, height);
  let size = Math.max(width, height) <= 256 ? 768 : zoom < .06 ? 3072 : zoom < .13 ? 1536 : 768;
  while ((Math.ceil(width / zoom / size) + 2) * (Math.ceil(height / zoom / size) + 2) > MAP_TERRAIN_RULES.maximumVisibleTiles) size *= 2;
  return size;
}

/** Coarse pixels are visible only when every covered exploration cell is known. */
export function isMapSampleRevealed(exploration: Pick<Exploration, 'isCellRevealed'>, x: number, y: number, sampleSize: number): boolean {
  if (![x, y, sampleSize].every(Number.isFinite) || sampleSize <= 0 || sampleSize > 4096) return false;
  const minX = Math.floor(x / EXPLORATION_CELL_SIZE), minY = Math.floor(y / EXPLORATION_CELL_SIZE);
  const maxX = Math.ceil((x + sampleSize) / EXPLORATION_CELL_SIZE), maxY = Math.ceil((y + sampleSize) / EXPLORATION_CELL_SIZE);
  for (let cy = minY; cy < maxY; cy++) for (let cx = minX; cx < maxX; cx++) if (!exploration.isCellRevealed(cx, cy)) return false;
  return true;
}
const TERRAIN_CACHE_LIMIT = MAP_TERRAIN_RULES.cacheLimit;
interface TerrainTile { base: HTMLCanvasElement; charted: HTMLCanvasElement; roads: HTMLCanvasElement | null; chartedRoads: HTMLCanvasElement | null; revision: number; nextRow: number; colorsDone: boolean; propsDone: boolean; roadsDone: boolean; decorated: boolean; maskDirty: boolean; readyAt?: number; }
interface PreviewTile { base: HTMLCanvasElement; charted: HTMLCanvasElement; revision: number; }
export function mapTileBlend(readyAt: number, now: number, reducedMotion = false): number {
  if (reducedMotion) return 1;
  const t = Math.max(0, Math.min(1, (now - readyAt) / 240));
  return t * t * (3 - 2 * t);
}

function maskMapTile(c: CanvasRenderingContext2D, source: HTMLCanvasElement, exploration: Exploration,
  ox: number, oy: number, size: number, pixels: number): void {
  const sampleSize = size / pixels, cell = EXPLORATION_CELL_SIZE;
  c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, pixels, pixels);
  const minCX = Math.floor(ox / cell), cols = Math.ceil((ox + size) / cell) - minCX;
  // Revealed bits are fetched once per cell row-group instead of once per
  // sample; rows whose cells are all known copy in a single draw.
  const ok = new Uint8Array(cols);
  let okY0 = -1, okY1 = -1, okAll = false, rowRun = -1;
  for (let y = 0; y < pixels; y++) {
    const top = oy + y * sampleSize;
    const cy0 = Math.floor(top / cell), cy1 = Math.ceil((top + sampleSize) / cell) - 1;
    if (cy0 !== okY0 || cy1 !== okY1) {
      okY0 = cy0; okY1 = cy1; okAll = true;
      for (let cx = 0; cx < cols; cx++) {
        let bit = 1;
        for (let cy = cy0; cy <= cy1; cy++) if (!exploration.isCellRevealed(minCX + cx, cy)) { bit = 0; break; }
        ok[cx] = bit; if (!bit) okAll = false;
      }
    }
    if (okAll) { if (rowRun < 0) rowRun = y; continue; }
    if (rowRun >= 0) { c.drawImage(source, 0, rowRun, pixels, y - rowRun, 0, rowRun, pixels, y - rowRun); rowRun = -1; }
    let run = -1;
    for (let x = 0; x <= pixels; x++) {
      let revealed = false;
      if (x < pixels) {
        const left = ox + x * sampleSize;
        const a = Math.floor(left / cell) - minCX, b = Math.ceil((left + sampleSize) / cell) - 1 - minCX;
        revealed = true;
        for (let cx = a; cx <= b; cx++) if (!ok[cx]) { revealed = false; break; }
      }
      if (revealed && run < 0) run = x;
      if (!revealed && run >= 0) { c.drawImage(source, run, y, x - run, 1, run, y, x - run, 1); run = -1; }
    }
  }
  if (rowRun >= 0) c.drawImage(source, 0, rowRun, pixels, pixels - rowRun, 0, rowRun, pixels, pixels - rowRun);
}
export interface MapRoadPath { main: boolean; points: readonly (readonly [number, number])[] }
/** Exact existing centerlines sampled at a fixed, bounded world interval; tile canvases clip the ends. */
export function mapRoadPaths(x: number, y: number, size: number, seed = 7319): MapRoadPath[] {
  if (![x,y,size].every(Number.isFinite) || size <= 0 || size > 12288 || Math.abs(x)>48000000 || Math.abs(y)>48000000) return [];
  return roadPaths(x,y,size,size,seed);
}

function createMapRoadLayer(x: number, y: number, size: number, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d')!;
  c.setTransform(128 / size, 0, 0, 128 / size, -x * 128 / size, -y * 128 / size);
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (const road of mapRoadPaths(x, y, size, seed)) {
    c.beginPath(); c.moveTo(...road.points[0]);
    for (const point of road.points.slice(1)) c.lineTo(...point);
    c.strokeStyle = '#15232180'; c.lineWidth = road.main ? 37 : 29; c.stroke();
    c.strokeStyle = road.main ? '#c8b88dba' : '#b4a88091'; c.lineWidth = road.main ? 22 : 16; c.stroke();
  }
  return canvas;
}

interface PresentationState {
  x: number; y: number; angle: number; revision: number; status: string; message: string;
  /** Count + id checksum of epic+ ground drops so the open map redraws when they change. */
  loot: string;
}
const bounds = (view: MapView): MapRect => ({ x: view.centerX - view.width / view.zoom / 2,
  y: view.centerY - view.height / view.zoom / 2, width: view.width / view.zoom, height: view.height / view.zoom });
const setText = (element: HTMLElement, value: string) => { if (element.textContent !== value) element.textContent = value; };
const palette = UI_THEME.palette;

/** Revealed cells are the boundary for inspecting terrain and danger on the chart. */
export function chartedMapArea(world: Pick<MapWorld, 'sampleBiome' | 'isSanctuary'> & Partial<Pick<MapWorld, 'seed' | 'zoneKey'>>,
  exploration: Pick<Exploration, 'isRevealed'>, x: number, y: number) {
  if (![x, y].every(Number.isFinite) || !exploration.isRevealed(x, y)) return null;
  const ocean = world.zoneKey?.(x, y) === null;
  return { name: ocean ? 'The Great Sea' : getZoneAt(x, y, world.seed).districtName, biome: world.sampleBiome(x, y).name,
    label: ocean ? 'Ocean' : mapAreaLabel(world, x, y), x, y };
}

function mapAreaLabel(world: Pick<MapWorld, 'isSanctuary'> & Partial<Pick<MapWorld, 'seed'>>, x: number, y: number) {
  return world.isSanctuary?.(x, y) ? 'Sanctuary' : regionLevelLabel(getZoneAt(x, y, world.seed));
}
/** At overview zoom the chart names authored zones and the sea before they're charted. */
function overviewMapArea(world: Pick<MapWorld, 'sampleBiome' | 'isSanctuary'> & Partial<Pick<MapWorld, 'seed' | 'zoneKey'>>, x: number, y: number) {
  if (![x, y].every(Number.isFinite) || !world.zoneKey) return null;
  const key = world.zoneKey(x, y);
  if (key === undefined) return null;
  const zone = getZoneAt(x, y, world.seed);
  return { name: key === null ? 'The Great Sea' : zone.name, biome: key === null ? 'Ocean' : zone.districtName,
    label: key === null ? 'Ocean' : regionLevelLabel(zone), x, y };
}

/** Keep hover selection inside the chart and prefer the closest visible marker. */
export function pickMapPOI(pois: readonly MapPOI[], view: MapView, pointer: { x: number; y: number }, radius: number): MapPOI | null {
  if (pointer.x < view.x || pointer.y < view.y || pointer.x >= view.x + view.width || pointer.y >= view.y + view.height) return null;
  let nearest: MapPOI | null = null, distance = radius;
  for (const poi of pois) {
    const p = projectMapPoint(poi.x, poi.y, view);
    if (p.x < view.x || p.y < view.y || p.x > view.x + view.width || p.y > view.y + view.height) continue;
    const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
    if (d < distance || (!nearest && d === radius)) { distance = d; nearest = poi; }
  }
  return nearest;
}

const SERVICE_KINDS = new Set(['blacksmith', 'merchant', 'inn', 'chapel', 'jeweler', 'enchanter', 'gambler', 'stash']);
/** The same stable visible list serves painting and hover; hidden overlapping services never steal focus. */
export function selectMapPOIs(pois: readonly MapPOI[], view: MapView, mini = false, focusedId?: string): MapPOI[] {
  const priority = (poi: MapPOI) => poi.id === focusedId ? -2 : poi.kind === 'portal' ? -1 : poi.kind === 'town' ? 0 : poi.kind === 'camp' ? 1 : SERVICE_KINDS.has(poi.kind) ? 3 : 2;
  const candidates = pois.filter(poi => (poi.id === focusedId || view.zoom >= .10 || !SERVICE_KINDS.has(poi.kind)))
    .map(poi => ({ poi, screen: projectMapPoint(poi.x, poi.y, view) }))
    .filter(({ screen }) => screen.x >= view.x + 6 && screen.y >= view.y + 6 && screen.x <= view.x + view.width - 6 && screen.y <= view.y + view.height - 6)
    .sort((a, b) => priority(a.poi) - priority(b.poi) || a.poi.id.localeCompare(b.poi.id));
  const selected: typeof candidates = [], separation = mini ? 11 : view.zoom < .006 ? 110 : view.zoom < MAP_OVERVIEW_ZOOM ? 64 : view.zoom < .07 ? 40 : 19;
  for (const candidate of candidates) if (selected.every(other => Math.hypot(candidate.screen.x - other.screen.x,
    candidate.screen.y - other.screen.y) >= separation)) selected.push(candidate);
  return selected.map(candidate => candidate.poi);
}

export interface MapRegionLabel { id: string; name: string; x: number; y: number }
/** A label needs a revealed, homogeneous patch; the chart never names unknown terrain. */
export function mapRegionLabels(world: Pick<MapWorld, 'sampleBiome'>, exploration: Pick<Exploration, 'isRevealed'>,
  view: MapView, pois: readonly Pick<MapPOI, 'x' | 'y'>[]): MapRegionLabel[] {
  if (view.zoom > .11) return [];
  const region = bounds(view), stride = Math.max(960, 52 / view.zoom);
  const candidates: Array<MapRegionLabel & { score: number }> = [];
  for (let y = Math.ceil(region.y / stride) * stride; y < region.y + region.height; y += stride)
    for (let x = Math.ceil(region.x / stride) * stride; x < region.x + region.width; x += stride) {
      const screen = projectMapPoint(x, y, view);
      if (screen.x < view.x + 82 || screen.y < view.y + 46 || screen.x > view.x + view.width - 82 || screen.y > view.y + view.height - 65) continue;
      const offsets = [[0, 0], [-420, 0], [420, 0], [0, -420], [0, 420], [-280, -280], [280, -280], [-280, 280], [280, 280]];
      if (!offsets.every(([dx, dy]) => exploration.isRevealed(x + dx, y + dy))) continue;
      const biome = world.sampleBiome(x, y);
      const matching = offsets.filter(([dx, dy]) => world.sampleBiome(x + dx, y + dy).id === biome.id).length;
      if (matching < 8 || pois.some(poi => { const p = projectMapPoint(poi.x, poi.y, view); return Math.abs(p.x - screen.x) < 76 && Math.abs(p.y - screen.y) < 21; })) continue;
      candidates.push({ id: biome.id, name: biome.name, x, y, score: matching * 1000 - Math.hypot(screen.x - view.x - view.width / 2, screen.y - view.y - view.height / 2) });
    }
  candidates.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
  const selected: MapRegionLabel[] = [];
  for (const candidate of candidates) {
    if (selected.length >= 12) break;
    if (selected.some(other => Math.hypot((other.x - candidate.x) * view.zoom, (other.y - candidate.y) * view.zoom) < (other.id === candidate.id ? 250 : 145))) continue;
    selected.push(candidate);
  }
  return selected;
}

/** A continuously translated chart built from cached world-space terrain and discovery tiles. */
export class WorldMap {
  readonly iconVisibility: MapIconVisibility;
  private legend: MapLegend;
  private unsubscribeIcons: () => void;
  private focusPOI: MapPOI | null = null;
  private focusLabel: HTMLDivElement;
  private legendRevision = -1;
  private journeyMarker: JourneyMarker|null = null;
  setJourneyMarker(marker:JourneyMarker|null) { if(JSON.stringify(marker)===JSON.stringify(this.journeyMarker))return; this.journeyMarker=marker; this.invalidate(); }
  readonly element: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private viewport: HTMLDivElement;
  private status: HTMLElement;
  private discoveries: HTMLElement;
  private coordinates: HTMLElement;
  private tooltip: HTMLDivElement;
  private tooltipName: HTMLElement;
  private tooltipKind: HTMLElement;
  private tooltipDescription: HTMLElement;
  private areaInfo: HTMLDivElement;
  private areaName: HTMLElement;
  private areaBiome: HTMLElement;
  private areaLevel: HTMLElement;
  private areaCoordinates: HTMLElement;
  private tiles = new Map<string, TerrainTile>();
  private previewTiles = new Map<string, PreviewTile>();
  private frame = 0;
  private recenter: { x: number; y: number; started: number; duration: number } | null = null;
  private focusTarget: { x: number; y: number } | null = null;
  private focusPing: HTMLDivElement;
  private pingAnimations: Animation[] = [];
  private chartDirty = false;
  private buildBudget?: number;
  /** Per-render millisecond cap on coarse preview builds; detail tiles keep their own budget. */
  private previewBudget?: number;
  private pendingTerrain = false;
  private overviewFog?: HTMLCanvasElement;
  private chartLayer?: HTMLCanvasElement;
  private chartLayerValid = false;
  /** Zoom gestures draw the last chart scaled; detail tiles rebuild after input settles. */
  private zoomQuietAt = 0;
  private zoomAnchor: { centerX: number; centerY: number; zoom: number } | null = null;
  private visiblePOIs: MapPOI[] = [];
  private zoneLevels = true;
  setZoneLevels(visible: boolean) { this.zoneLevels = visible; this.render(); }
  private abort = new AbortController();
  private opened = false;
  private explorationMode = false;
  private player: MapPlayer = { x: 0, y: 0, angle: 0 };
  private view: MapView = { x: 0, y: 0, width: 800, height: 500, centerX: 0, centerY: 0, zoom: .17 };
  private pointer: { x: number; y: number } | null = null;
  private portalMarkers: () => MapPOI[] = () => [];
  setPortalMarkers(reader: () => MapPOI[]) { this.portalMarkers = reader; this.render(); }
  private worldEvents: () => { state: WorldEventState; time: number } | null = () => null;
  setWorldEventReader(reader: () => { state: WorldEventState; time: number } | null) { this.worldEvents = reader; }
  private lootMarkers: () => readonly LootMapDrop[] = () => [];
  /** Uncollected epic+ ground drops; the reader is polled each update so the open map stays fresh. */
  setLootMarkerReader(reader: () => readonly LootMapDrop[]) { this.lootMarkers = reader; }
  private minimapPointer: { x: number; y: number } | null = null;
  private drag: { id: number; x: number; y: number; centerX: number; centerY: number } | null = null;
  private hovered: MapPOI | null = null;
  private returnFocus: HTMLElement | null = null;
  private ratio = 1;
  private presentation: PresentationState | null = null;
  private disposed = false;
  private world: MapWorld;
  private exploration: Exploration;
  private onClose: () => void;
  private encounterLevelReader: (poi: MapPOI) => number | null = () => null;
  setEncounterLevelReader(reader: (poi: MapPOI) => number | null) { this.encounterLevelReader = reader; }
  private activityStateReader: (poi: MapPOI) => ActivityStatus | null = () => null;
  setActivityStateReader(reader: (poi: MapPOI) => ActivityStatus | null) { this.activityStateReader = reader; }

  private zoomLimits: MapZoomLimits = MAP_ZOOM;

  constructor(world: MapWorld, exploration: Exploration, mount: HTMLElement, onClose: () => void, zoomLimits: MapZoomLimits = MAP_ZOOM, iconVisibility = new MapIconVisibility()) {
    this.iconVisibility = iconVisibility;
    this.zoomLimits = zoomLimits;
    this.world = world; this.exploration = exploration; this.onClose = onClose;
    this.element = document.createElement('div');
    this.element.className = 'world-map-root'; this.element.hidden = true;
    this.element.innerHTML = `<section class="world-map-panel ui-window" role="dialog" aria-modal="true" aria-labelledby="world-map-title">
      <header class="world-map-header ui-window__header">
        <div class="world-map-heading"><span class="world-map-emblem" aria-hidden="true">${uiIcon('map')}</span>
          <h2 class="ui-title" id="world-map-title">World map</h2></div>
        <button type="button" class="world-map-close ui-button ui-button--quiet ui-button--icon" aria-label="Close world map" data-tooltip="Close map" data-tooltip-placement="below" data-tooltip-align="end">${uiIcon('close')}</button>
      </header>
      <div class="map-legend-layout"><div class="world-map-viewport ui-window__body"><canvas class="world-map-canvas" tabindex="0" aria-label="Explored world map"></canvas>
        <div class="world-map-focus-label" role="status" aria-live="polite" hidden></div>
        <div class="world-map-focus-ping" aria-hidden="true" hidden><span></span><span></span></div>
        <div class="world-map-toolbar" role="toolbar" aria-label="Map controls">
          <button type="button" class="ui-button ui-button--quiet ui-button--icon" data-map="out" aria-label="Zoom out" data-tooltip="Zoom out">${uiIcon('minus')}</button>
          <button type="button" class="ui-button ui-button--quiet ui-button--icon" data-map="in" aria-label="Zoom in" data-tooltip="Zoom in">${uiIcon('plus')}</button>
          <span class="world-map-control-divider" aria-hidden="true"></span>
          <button type="button" class="ui-button ui-button--quiet ui-button--icon" data-map="center" aria-label="Center on character" data-tooltip="Center on character" data-tooltip-align="end">${uiIcon('center')}</button>
        </div>
        <div class="world-map-area ui-tooltip" role="region" aria-label="Hovered area" hidden>
          <p class="world-map-poi-kind ui-kicker">Area</p>
          <h3 class="world-map-area-name ui-title"></h3><p class="world-map-area-biome ui-body"></p>
          <div class="world-map-area-details"><span class="world-map-area-level"></span><span class="world-map-area-coordinates"></span></div>
        </div>
        <div class="world-map-tooltip ui-tooltip" role="status" aria-live="polite" aria-atomic="true" hidden>
          <p class="world-map-poi-kind ui-kicker"></p><h3 class="ui-title"></h3><p class="world-map-poi-description ui-body"></p></div>
      </div></div>
      <footer class="world-map-footer ui-window__footer">
        <div class="world-map-progress"><span class="world-map-discoveries"></span><span class="world-map-status ui-muted" role="status"></span></div>
        <div class="world-map-position"><span class="ui-kicker">Position</span><span class="world-map-coordinates"></span></div>
      </footer></section>`;
    mount.append(this.element);
    attachPanelFrame(this.element, 'map');
    this.canvas = this.element.querySelector<HTMLCanvasElement>('.world-map-canvas')!;
    this.context = this.canvas.getContext('2d')!;
    this.viewport = this.element.querySelector<HTMLDivElement>('.world-map-viewport')!;
    this.focusPing = this.element.querySelector<HTMLDivElement>('.world-map-focus-ping')!;
    this.status = this.element.querySelector('.world-map-status')!;
    this.discoveries = this.element.querySelector('.world-map-discoveries')!;
    this.coordinates = this.element.querySelector('.world-map-coordinates')!;
    this.tooltip = this.element.querySelector<HTMLDivElement>('.world-map-tooltip')!;
    this.tooltipName = this.tooltip.querySelector('h3')!;
    this.tooltipKind = this.tooltip.querySelector('.world-map-poi-kind')!;
    this.tooltipDescription = this.tooltip.querySelector('.world-map-poi-description')!;
    this.areaInfo = this.element.querySelector<HTMLDivElement>('.world-map-area')!;
    this.areaName = this.areaInfo.querySelector('.world-map-area-name')!;
    this.areaBiome = this.areaInfo.querySelector('.world-map-area-biome')!;
    this.areaLevel = this.areaInfo.querySelector('.world-map-area-level')!;
    this.areaCoordinates = this.areaInfo.querySelector('.world-map-area-coordinates')!;
    this.focusLabel = this.element.querySelector<HTMLDivElement>('.world-map-focus-label')!;
    this.legend = new MapLegend(this.iconVisibility, this.element.querySelector('.map-legend-layout')!, this.element.querySelector('.world-map-header')!, 'world', () => { this.pointer = null; this.hideTooltip(); this.resize(); }, kind => this.pingNearest(kind));
    this.unsubscribeIcons = this.iconVisibility.subscribe(() => { this.pointer = null; this.hideTooltip(); this.invalidate(); });
    this.bind();
  }

  private poiLabel(poi: MapPOI): string { const state = this.activityStateReader(poi); if (poi.sighted) return `${POI_DEFINITIONS[poi.kind].label} · Sighted`; if (state) return `${POI_DEFINITIONS[poi.kind].label} · ${state.label}`; return POI_DEFINITIONS[poi.kind].label; }

  get isOpen() { return this.opened; }
  open(player: MapPlayer, explorationMode = false) {
    if (this.disposed || this.opened) return;
    this.player = { ...player }; this.exploration.reveal(player.x, player.y);
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.opened = true; this.element.hidden = false;
    this.explorationMode = explorationMode;
    this.element.classList.toggle('world-map-root--exploration', explorationMode);
    this.element.querySelector('[role="dialog"]')!.setAttribute('aria-modal', String(!explorationMode));
    this.view.centerX = clampMapCoordinate(player.x); this.view.centerY = clampMapCoordinate(player.y);
    this.resize(); if (!explorationMode) this.canvas.focus({ preventScroll: true });
  }
  close() {
    if (!this.opened) return;
    this.cancelRecenter();
    if (this.drag && this.canvas.hasPointerCapture(this.drag.id)) this.canvas.releasePointerCapture(this.drag.id);
    if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0;
    this.chartLayer = undefined; this.visiblePOIs = []; this.zoomAnchor = null; this.zoomQuietAt = 0;
    this.clearTouch?.(); this.opened = false; this.element.hidden = true; this.drag = null; this.pointer = null;
    this.canvas.classList.remove('world-map-dragging'); this.hideTooltip(); this.exploration.save();
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
  }
  update(player: MapPlayer, _dt: number) {
    if (this.disposed || ![player.x, player.y].every(Number.isFinite)) return;
    this.player = { ...player };
    if (this.opened && this.explorationMode) {
      this.view.centerX = clampMapCoordinate(player.x); this.view.centerY = clampMapCoordinate(player.y);
    }
    this.exploration.reveal(player.x, player.y);
    const previous = this.presentation;
    if (this.opened) {
      const drops = lootMapMarkers(this.lootMarkers?.() ?? []);
      let checksum = 0; for (const drop of drops) checksum = (checksum + drop.id) | 0;
      const loot = `${drops.length}:${checksum}`;
      if (!previous || previous.x !== player.x || previous.y !== player.y
        || previous.angle !== player.angle || previous.revision !== this.exploration.revision
        || previous.loot !== loot
        || previous.status !== this.exploration.storageStatus || previous.message !== this.exploration.persistenceMessage) this.render();
    }
  }
  resize() {
    this.render();
  }
  /** Footer text participates in flex layout, so populate it before measuring the chart. */
  private prepareLayout(): boolean {
    if (this.legendRevision !== this.exploration.revision) {
      const discovered = this.exploration.getDiscoveredPOIs().filter(p => !p.sighted && this.exploration.isRevealed(p.x, p.y));
      this.legend.setAvailable(new Set(MAP_SERVICES.filter(kind => discovered.some(p => p.kind === kind))));
      this.legendRevision = this.exploration.revision;
    }
    const count = this.exploration.discoveredPOICount;
    setText(this.discoveries, `${count} ${count === 1 ? 'place' : 'places'} charted`);
    const area = mapAreaLabel(this.world, this.player.x, this.player.y);
    setText(this.status, `${area} · ${this.exploration.persistenceMessage || (this.exploration.storageStatus === 'pending' ? 'Charting…' : 'Chart saved')}`);
    this.status.dataset.state = this.exploration.storageStatus;
    setText(this.coordinates, `X ${Math.round(this.player.x)} · Y ${Math.round(this.player.y)}`);
    const rect = this.viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    this.view.width = rect.width; this.view.height = rect.height;
    this.ratio = Math.max(1, Math.min(4, window.devicePixelRatio || 1));
    const width = Math.round(rect.width * this.ratio), height = Math.round(rect.height * this.ratio);
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    return true;
  }
  /** Frame any charted region without changing discoveries, player state or saved data. */
  fitBounds(region: MapRect, padding = 40) {
    this.cancelRecenter();
    this.view = fitMapBounds(this.view, region, padding, this.zoomLimits); this.render();
  }
  /** Wheel/button/pinch zoom: snapshot the chart once, then stretch it while input flows. */
  private zoomTo(x: number, y: number, zoom: number) {
    if (!this.zoomAnchor) {
      // Settle any pending frame first so the snapshot isn't one frame stale.
      if (this.chartDirty) this.render();
      this.zoomAnchor = { centerX: this.view.centerX, centerY: this.view.centerY, zoom: this.view.zoom };
      if (typeof document !== 'undefined') {
        const layer = this.chartLayer ??= document.createElement('canvas');
        if (layer.width !== this.canvas.width || layer.height !== this.canvas.height) {
          layer.width = this.canvas.width; layer.height = this.canvas.height;
        }
        const saved = layer.getContext('2d')!;
        saved.setTransform(1, 0, 0, 1, 0, 0);
        saved.clearRect(0, 0, layer.width, layer.height);
        saved.drawImage(this.canvas, 0, 0);
        // The layer now holds the pre-zoom frame, not a hover base.
        this.chartLayerValid = false;
      }
    }
    this.zoomQuietAt = performance.now() + 140;
    this.view = zoomMapAt(this.view, x, y, zoom, this.zoomLimits);
    this.view.centerX = clampMapCoordinate(this.view.centerX);
    this.view.centerY = clampMapCoordinate(this.view.centerY);
    this.invalidate();
  }
  private zoomActive() { return performance.now() < this.zoomQuietAt; }
  zoomExplorationByWheel(deltaY: number, deltaMode: number) {
    if (!this.opened || !this.explorationMode || !Number.isFinite(deltaY)) return;
    const delta = Math.max(-240, Math.min(240, deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? this.view.height : 1)));
    this.zoomTo(this.view.width / 2, this.view.height / 2, this.view.zoom * Math.exp(-delta * .0016));
  }
  get viewBounds(): MapRect { return bounds(this.view); }
  get terrainCacheSize(): number { return this.tiles.size; }
  getCanvas(): HTMLCanvasElement { return this.canvas; }
  /** Read-only hover forwarded from gameplay; the overlay never captures the mouse. */
  setExplorationPointer(point: { x: number; y: number } | null) {
    if (!this.opened || !this.explorationMode) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = point && point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom
      ? { x: (point.x - rect.left) * this.view.width / rect.width,
          y: (point.y - rect.top) * this.view.height / rect.height } : null;
    this.drawHover();
  }
  setMinimapPointer(point: { x: number; y: number } | null) { this.minimapPointer = point; }

  private clearTouch: (() => void) | null = null;

  private pingNearest(kind: MapServiceKind) {
    const poi = nearestMapService(this.exploration.getDiscoveredPOIs().filter(p => this.exploration.isRevealed(p.x, p.y)), kind, this.player);
    if (!poi) { this.legend.announce('No discovered location of this type.'); return; }
    this.legend.closeCompact();
    this.focusLocation(poi);
    this.focusPOI = poi;
    const message = `${POI_DEFINITIONS[kind].label} · ${formatWorldDistance(Math.hypot(poi.x - this.player.x, poi.y - this.player.y))} from you`;
    this.focusLabel.textContent = message; this.focusLabel.hidden = false; this.legend.announce(message);
  }

  private cancelRecenter() {
    const hadPOI = !!this.focusPOI || (!!this.focusPing && !this.focusPing.hidden && !mapIconVisible(this.iconVisibility, 'player'));
    this.focusPOI = null;
    if (this.focusLabel) this.focusLabel.hidden = true;
    this.recenter = null;
    this.focusTarget = null;
    for (const animation of this.pingAnimations) animation.cancel();
    this.pingAnimations = [];
    this.focusPing.hidden = true;
    if (hadPOI) this.invalidate();
  }

  private centerOnPlayer() {
    this.focusLocation(null);
  }

  /** Called after opening on the player; the brief hold makes the journey's origin readable. */
  focusJourney(marker: JourneyMarker) {
    if (!this.opened || this.disposed) return;
    this.setJourneyMarker(marker);
    this.focusLocation(marker, 450, 1.6);
  }

  private focusLocation(target: { x: number; y: number } | null, delay = 0, durationScale = 1) {
    this.cancelRecenter(); this.pointer = null; this.hideTooltip();
    this.focusTarget = target ? { x: clampMapCoordinate(target.x), y: clampMapCoordinate(target.y) } : null;
    const destination = this.focusTarget ?? this.player;
    const distance = Math.hypot(destination.x - this.view.centerX, destination.y - this.view.centerY) * this.view.zoom;
    this.recenter = { x: this.view.centerX, y: this.view.centerY, started: performance.now() + delay,
      duration: distance < 1 ? 0 : Math.min(850, 380 + distance * .3) * durationScale };
    this.invalidate();
  }

  private advanceRecenter(now: number) {
    const motion = this.recenter;
    if (!motion) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = reduced || now >= motion.started + motion.duration || motion.duration === 0
      ? 1 : Math.max(0, (now - motion.started) / motion.duration);
    const ease = t * t * t * (t * (t * 6 - 15) + 10);
    const destination = this.focusTarget ?? this.player;
    this.view.centerX = motion.x + (clampMapCoordinate(destination.x) - motion.x) * ease;
    this.view.centerY = motion.y + (clampMapCoordinate(destination.y) - motion.y) * ease;
    if (t < 1) return;
    this.recenter = null;
    this.focusPing.hidden = false;
    // Screen-space rings stay readable at every zoom; their fade never repaints terrain.
    this.pingAnimations = [...this.focusPing.children].map((ring, index) => ring.animate(reduced ? [
      { opacity: 0 }, { opacity: .85, offset: .12 }, { opacity: .85, offset: .65 }, { opacity: 0 },
    ] : [
      { transform: 'scale(.45)', opacity: 0 },
      { opacity: .95, offset: .15 },
      { transform: 'scale(1.65)', opacity: 0 },
    ], { duration: reduced ? 1100 : 950, delay: reduced ? 0 : index * 200, fill: 'both', easing: 'ease-out' }));
    const animations = this.pingAnimations;
    void Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (this.pingAnimations === animations) this.cancelRecenter();
    }).catch(() => { /* Direct input and closing cancel the transient highlight. */ });
  }

  private bind() {
    const signal = this.abort.signal;
    this.clearTouch = bindTouchCanvas(this.canvas,signal,{
      start:()=>{this.cancelRecenter();this.pointer=null;this.hideTooltip();},
      pan:(dx,dy)=>{this.pointer=null;this.view.centerX=clampMapCoordinate(this.view.centerX-dx/this.view.zoom);this.view.centerY=clampMapCoordinate(this.view.centerY-dy/this.view.zoom);this.invalidate();},
      zoom:(factor,p)=>{this.zoomTo(p.x,p.y,this.view.zoom*factor);},
      tap:p=>{this.pointer=p;this.invalidate(false);},
    });
    this.element.querySelector('.world-map-close')!.addEventListener('click', () => { this.close(); this.onClose(); }, { signal });
    for (const button of this.element.querySelectorAll<HTMLButtonElement>('[data-map]')) {
      button.addEventListener('click', () => {
        if (button.dataset.map === 'center') {
          this.centerOnPlayer(); return;
        }
        this.cancelRecenter();
        this.zoomTo(this.view.width / 2, this.view.height / 2,
          this.view.zoom * (button.dataset.map === 'in' ? 1.3 : 1 / 1.3));
      }, { signal });
    }
    const local = (event: PointerEvent | WheelEvent) => { const r = this.canvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };
    this.canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      this.cancelRecenter();
      event.preventDefault(); const p = local(event); this.canvas.focus(); this.canvas.setPointerCapture(event.pointerId);
      this.drag = { id: event.pointerId, ...p, centerX: this.view.centerX, centerY: this.view.centerY };
      this.canvas.classList.add('world-map-dragging'); this.hideTooltip();
    }, { signal });
    this.canvas.addEventListener('pointermove', event => {
      const p = local(event); this.pointer = p;
      if (this.drag && event.pointerId === this.drag.id) {
        this.view.centerX = clampMapCoordinate(this.drag.centerX - (p.x - this.drag.x) / this.view.zoom);
        this.view.centerY = clampMapCoordinate(this.drag.centerY - (p.y - this.drag.y) / this.view.zoom);
      }
      this.invalidate(!!this.drag);
    }, { signal });
    const release = () => { this.drag = null; this.canvas.classList.remove('world-map-dragging'); this.invalidate(false); };
    this.canvas.addEventListener('pointerup', release, { signal });
    this.canvas.addEventListener('pointercancel', release, { signal });
    this.canvas.addEventListener('lostpointercapture', release, { signal });
    this.canvas.addEventListener('pointerleave', () => { if (!this.drag) { this.pointer = null; this.hideTooltip(); this.invalidate(false); } }, { signal });
    this.canvas.addEventListener('wheel', event => {
      this.cancelRecenter();
      event.preventDefault(); const p = local(event);
      if (this.explorationMode) { p.x = this.view.width / 2; p.y = this.view.height / 2; }
      const delta = Math.max(-240, Math.min(240, event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.view.height : 1)));
      this.zoomTo(p.x, p.y, this.view.zoom * Math.exp(-delta * .0016));
    }, { signal, passive: false });
    this.element.addEventListener('keydown', event => {
      if (this.explorationMode) return;
      // Escape/M remain owned by the game's phase/input coordinator.
      if (event.key === 'Tab') {
        const controls = [...this.element.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), canvas[tabindex]')].filter(el => !el.closest('[hidden]') && el.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        return;
      }
      if (event.target !== this.canvas) return;
      if (event.key === 'Home') {
        event.preventDefault(); event.stopPropagation(); this.centerOnPlayer(); return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) this.cancelRecenter();
      const pan = 70 / this.view.zoom;
      if (event.key === 'ArrowLeft') this.view.centerX -= pan;
      else if (event.key === 'ArrowRight') this.view.centerX += pan;
      else if (event.key === 'ArrowUp') this.view.centerY -= pan;
      else if (event.key === 'ArrowDown') this.view.centerY += pan;
      else if (event.key === '+' || event.key === '=' || event.key === '-') { this.zoomTo(
        this.view.width / 2, this.view.height / 2, this.view.zoom * (event.key === '-' ? 1 / 1.3 : 1.3)); event.preventDefault(); event.stopPropagation(); return; }
      else return;
      this.view.centerX = clampMapCoordinate(this.view.centerX);
      this.view.centerY = clampMapCoordinate(this.view.centerY);
      event.preventDefault(); event.stopPropagation(); this.invalidate();
    }, { signal });
  }

  /** Apply (or re-apply) the exploration mask; the first mask is when a tile becomes presentable. */
  private maskTile(tile: TerrainTile, ox: number, oy: number, size: number, pixels: number, revision: number, timed: boolean) {
    const c = tile.charted.getContext('2d')!;
    // One copy per contiguous revealed row run, retaining the exact fine-cell mask.
    maskMapTile(c, tile.base, this.exploration, ox, oy, size, pixels);
    if (tile.roads && tile.chartedRoads) {
      const roads = tile.chartedRoads.getContext('2d')!;
      roads.globalCompositeOperation = 'source-over'; roads.clearRect(0, 0, 128, 128);
      roads.drawImage(tile.roads, 0, 0); roads.imageSmoothingEnabled = false;
      // The same conservative exploration mask clips terrain and fine road strokes.
      roads.globalCompositeOperation = 'destination-in'; roads.drawImage(tile.charted, 0, 0, 128, 128);
      roads.globalCompositeOperation = 'source-over';
    }
    if (tile.revision === -1 && timed) tile.readyAt = performance.now();
    tile.revision = revision; tile.maskDirty = false;
  }

  private tile(tx: number, ty: number, size: number, detailed = false): TerrainTile | null {
    const ox = tx * size, oy = ty * size, pixels = detailed ? 160 : TILE_PIXELS;
    let revision = 0;
    for (let cy = Math.floor(oy / EXPLORATION_CHUNK_SIZE); cy < Math.ceil((oy + size) / EXPLORATION_CHUNK_SIZE); cy++)
      for (let cx = Math.floor(ox / EXPLORATION_CHUNK_SIZE); cx < Math.ceil((ox + size) / EXPLORATION_CHUNK_SIZE); cx++)
        revision += this.exploration.getChunkRevision(cx * EXPLORATION_CHUNK_SIZE, cy * EXPLORATION_CHUNK_SIZE);
    if (!revision) return null;
    const id = `${detailed ? 'atlas' : 'mini'}:${size}:${tx}:${ty}`;
    let tile = this.tiles.get(id);
    // Mid-gesture frames never start new terrain: the stretched chart snapshot
    // covers the view and tiles build once input settles.
    if (!tile && this.zoomActive()) { this.pendingTerrain = true; return null; }
    const building = !tile?.decorated, started = performance.now();
    // Charge generation only: cached painting/label work must not starve unfinished edge tiles.
    const deadline = detailed && this.buildBudget !== undefined ? started + this.buildBudget : Infinity;
    if (!tile) {
      if (performance.now() >= deadline) { this.pendingTerrain = true; return null; }
      const base = document.createElement('canvas'), charted = document.createElement('canvas');
      base.width = base.height = charted.width = charted.height = pixels;
      tile = { base, charted, roads: null, chartedRoads: null, revision: -1, nextRow: 0,
        colorsDone: false, propsDone: false, roadsDone: false, decorated: false, maskDirty: false };
      this.tiles.set(id, tile);
    } else { this.tiles.delete(id); this.tiles.set(id, tile); }
    if (!tile.colorsDone) {
      const c = tile.base.getContext('2d')!;
      // Sample density tracks the tile's canvas, not its world span: far-zoom
      // tiles display at or below canvas size, so extra samples only cost time.
      const samples = detailed ? (size <= 768 ? 96 : size <= 1536 ? 48 : 32) : TILE_PIXELS,
        step = size / samples, pixelStep = pixels / samples;
      while (tile.nextRow < samples && performance.now() < deadline) {
        const y = tile.nextRow++;
        for (let x = 0; x < samples; x++) {
          const wx = ox + (x + .5) * step, wy = oy + (y + .5) * step;
          c.fillStyle = detailed && this.world.atlasColor ? this.world.atlasColor(wx, wy) : this.world.mapColor(wx, wy, step);
          c.fillRect(x * pixelStep, y * pixelStep, pixelStep, pixelStep);
        }
      }
      if (tile.nextRow === samples) tile.colorsDone = true;
      else this.pendingTerrain = true;
    }
    // Props and road ink are separate stages so a tight frame presents the
    // sampled terrain first and fills silhouettes in on the next pass.
    if (tile.colorsDone && !tile.propsDone && performance.now() < deadline) {
      if (detailed && size <= 3072 && this.world.getProps)
        drawMapProps(tile.base.getContext('2d')!, this.world.getProps(ox - 160, oy - 160, size + 320, size + 320), ox, oy, size, pixels);
      tile.propsDone = true; tile.maskDirty ||= tile.revision !== -1;
    }
    if (tile.colorsDone && !tile.roadsDone && performance.now() < deadline) {
      if (detailed) tile.base.getContext('2d')!.drawImage(createMapRoadLayer(ox, oy, size, this.world.seed), 0, 0);
      else {
        tile.roads = createMapRoadLayer(ox, oy, size, this.world.seed);
        tile.chartedRoads = document.createElement('canvas');
        tile.chartedRoads.width = tile.chartedRoads.height = 128;
      }
      tile.roadsDone = true; tile.maskDirty ||= tile.revision !== -1;
    }
    tile.decorated = tile.colorsDone && tile.propsDone && tile.roadsDone;
    if (!tile.decorated) this.pendingTerrain = true;
    const needsMask = tile.colorsDone && (tile.revision !== revision || tile.maskDirty);
    // The fine-cell mask is charged against the same frame budget; over budget
    // or mid-zoom the previous mask stays until the next pass. A tile that has
    // never been presented masks anyway so fresh terrain is never withheld.
    if (needsMask && !this.zoomActive() && (performance.now() < deadline || tile.revision === -1))
      this.maskTile(tile, ox, oy, size, pixels, revision, Number.isFinite(deadline));
    else if (needsMask) this.pendingTerrain = true;
    if (building && detailed && this.buildBudget !== undefined)
      this.buildBudget = Math.max(0, this.buildBudget - (performance.now() - started));
    if (this.tiles.size > TERRAIN_CACHE_LIMIT) this.tiles.delete(this.tiles.keys().next().value!);
    return tile;
  }

  /** Cheap, complete overview under unfinished detail; its own fog mask never exposes unknown cells. */
  private previewTile(tx: number, ty: number, size: number): PreviewTile | null {
    const ox = tx * size, oy = ty * size;
    let revision = 0;
    for (let cy = Math.floor(oy / EXPLORATION_CHUNK_SIZE); cy < Math.ceil((oy + size) / EXPLORATION_CHUNK_SIZE); cy++)
      for (let cx = Math.floor(ox / EXPLORATION_CHUNK_SIZE); cx < Math.ceil((ox + size) / EXPLORATION_CHUNK_SIZE); cx++)
        revision += this.exploration.getChunkRevision(cx * EXPLORATION_CHUNK_SIZE, cy * EXPLORATION_CHUNK_SIZE);
    if (!revision) return null;
    const cache = this.previewTiles ??= new Map<string, PreviewTile>(), key = `${size}:${tx}:${ty}`;
    let tile = cache.get(key);
    if (!tile) {
      // Preview builds share the frame's terrain budget so a zoom into a fresh
      // band can't spend the whole first frame on coarse stand-ins.
      if (this.previewBudget !== undefined && this.previewBudget <= 0) { this.pendingTerrain = true; return null; }
      const started = this.previewBudget === undefined ? 0 : performance.now();
      // Padded samples interpolate continuously through tile edges.
      const coarse = document.createElement('canvas'); coarse.width = coarse.height = 10;
      const samples = coarse.getContext('2d')!, step = size / 8;
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
        samples.fillStyle = this.world.mapColor(ox + (x - .5) * step, oy + (y - .5) * step, Math.max(96, step));
        samples.fillRect(x, y, 1, 1);
      }
      const base = document.createElement('canvas'), charted = document.createElement('canvas');
      base.width = base.height = charted.width = charted.height = 32;
      const c = base.getContext('2d')!; c.imageSmoothingEnabled = true;
      c.drawImage(coarse, 1, 1, 8, 8, 0, 0, 32, 32);
      tile = { base, charted, revision: -1 };
      if (this.previewBudget !== undefined) this.previewBudget -= performance.now() - started;
    } else cache.delete(key);
    cache.set(key, tile);
    if (tile.revision !== revision) {
      if (this.previewBudget !== undefined && this.previewBudget <= 0) { this.pendingTerrain = true; return tile; }
      const started = this.previewBudget === undefined ? 0 : performance.now();
      maskMapTile(tile.charted.getContext('2d')!, tile.base, this.exploration, ox, oy, size, 32);
      tile.revision = revision;
      if (this.previewBudget !== undefined) this.previewBudget -= performance.now() - started;
    }
    if (cache.size > TERRAIN_CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    return tile;
  }
  private features(view: MapView, mini: boolean): { pois: MapPOI[]; labels: MapRegionLabel[]; zones: ZoneProgression[] } {
    const pois = selectMapPOIs([...this.exploration.getDiscoveredPOIs(bounds(view))
      .filter(poi => poi.sighted || this.exploration.isRevealed(poi.x, poi.y)), ...this.portalMarkers(),
      ...worldEventMapMarkers(this.worldEvents?.()?.state ?? { nextAt: 0, index: 0, active: null, history: [] }, this.worldEvents?.()?.time ?? 0)
        .map(marker => ({ ...marker, sighted: true }))]
      .filter(poi => mapIconVisible(this.iconVisibility, poi.kind) || (!mini && poi.id === this.focusPOI?.id)), view, mini, mini ? undefined : this.focusPOI?.id);
    const overview = !mini && view.zoom < MAP_OVERVIEW_ZOOM;
    const labels = mini || this.zoneLevels || overview ? [] : mapRegionLabels(this.world, this.exploration, view, [...pois.filter(poi => poi.kind === 'town'), this.player]);
    const zones = mini || !this.zoneLevels || overview ? [] : mapZoneLabels(view, this.exploration, this.world.seed, pois.filter(p => p.kind === 'town'));
    return { labels, zones, pois: pois.filter(poi => (!mini && poi.id === this.focusPOI?.id) || !zones.some(z => Math.abs((z.x-poi.x)*view.zoom)<82 && Math.abs((z.y-poi.y)*view.zoom)<28)).filter(poi => (!mini && poi.id === this.focusPOI?.id) || poi.kind === 'portal' || poi.kind === 'town' || !labels.some(label => {
      const dx = Math.abs((poi.x - label.x) * view.zoom), dy = (poi.y - label.y) * view.zoom;
      return dx < label.name.length * 3.4 + 8 && dy > -9 && dy < 27;
    })) };
  }

  private chart(c: CanvasRenderingContext2D, view: MapView, mini: boolean,
    features = this.features(view, mini), simple = false) {
    const region = bounds(view), overview = !mini && view.zoom < MAP_OVERVIEW_ZOOM;
    c.save(); c.beginPath(); c.rect(view.x, view.y, view.width, view.height); c.clip();
    const opacity = simple ? .58 : 1;
    c.globalAlpha = opacity;
    if (!simple) { c.fillStyle = palette.ink; c.fillRect(view.x, view.y, view.width, view.height); }
    c.imageSmoothingEnabled = false;
    if (overview) {
      // Far zoom: the authored continent/zone silhouette replaces detail tiles,
      // so the chart never pays the per-cell fog mask at world scale. Authored
      // silhouettes draw after the parchment grade to keep their own palette.
      if (!this.world.zoneKey) {
        const tileSize = 49152, bleed = 1 / Math.max(.1, Math.hypot(c.getTransform().a, c.getTransform().b));
        for (let ty = Math.floor(region.y / tileSize); ty <= Math.floor((region.y + region.height) / tileSize); ty++)
          for (let tx = Math.floor(region.x / tileSize); tx <= Math.floor((region.x + region.width) / tileSize); tx++) {
            const base = this.previewTile(tx, ty, tileSize)?.base; if (!base) continue;
            const p = projectMapPoint(tx * tileSize, ty * tileSize, view);
            c.drawImage(base, p.x, p.y, tileSize * view.zoom + bleed, tileSize * view.zoom + bleed);
          }
      }
    } else {
    const tileSize = mini ? MAP_TERRAIN_RULES.baseWorldSize : mapTerrainSize(view.zoom, view.width, view.height);
    const transform = c.getTransform();
    const bleed = 1 / Math.max(.1, Math.hypot(transform.a, transform.b));
    const roadTiles: Array<{ tile: TerrainTile; x: number; y: number }> = [];
    const visibleTiles: Array<{ tx: number; ty: number }> = [];
    for (let ty = Math.floor(region.y / tileSize); ty <= Math.floor((region.y + region.height) / tileSize); ty++)
      for (let tx = Math.floor(region.x / tileSize); tx <= Math.floor((region.x + region.width) / tileSize); tx++) visibleTiles.push({ tx, ty });
    if (!mini) visibleTiles.sort((a, b) =>
      Math.hypot((a.tx + .5) * tileSize - view.centerX, (a.ty + .5) * tileSize - view.centerY)
      - Math.hypot((b.tx + .5) * tileSize - view.centerX, (b.ty + .5) * tileSize - view.centerY));
    const now = performance.now(), reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const layers = visibleTiles.map(({ tx, ty }) => {
      const tile = this.tile(tx, ty, tileSize, !mini);
      // A tile is drawable once its colors are masked; props/roads may still be pending.
      const presented = !!tile && tile.revision !== -1;
      const blend = !presented ? 0 : mini || tile!.readyAt === undefined || this.buildBudget === undefined ? 1 : mapTileBlend(tile!.readyAt!, now, reducedMotion);
      if (presented && blend < 1) this.pendingTerrain = true;
      return { tx, ty, tile, blend };
    });
    // Populate every revealed low-resolution tile in this frame, before refining the center outward.
    if (!mini && this.pendingTerrain) for (const { tx, ty } of visibleTiles) {
      const preview = this.previewTile(tx, ty, tileSize)?.charted; if (!preview) continue;
      const p = projectMapPoint(tx * tileSize, ty * tileSize, view);
      c.drawImage(preview, p.x, p.y, tileSize * view.zoom + bleed, tileSize * view.zoom + bleed);
    }
    // Tiles cached at a neighboring zoom band stretch under unbuilt spots, so
    // crossing a sampling band reuses detail instead of dropping to previews.
    if (!mini && this.pendingTerrain) {
      const covered = new Set<string>();
      for (const { tx, ty, tile, blend } of layers) {
        if (tile && tile.revision !== -1 && blend >= 1) continue;
        for (const foreign of [tileSize * 2, tileSize / 2, tileSize * 4, tileSize / 4]) {
          if (foreign < MAP_TERRAIN_RULES.baseWorldSize || foreign > 49152) continue;
          if (foreign > tileSize) {
            const ftx = Math.floor(tx * tileSize / foreign), fty = Math.floor(ty * tileSize / foreign), key = `${foreign}:${ftx}:${fty}`;
            if (covered.has(key)) continue;
            const other = this.tiles.get(`atlas:${key}`);
            if (!other || other.revision === -1) continue;
            covered.add(key);
            const p = projectMapPoint(ftx * foreign, fty * foreign, view);
            c.drawImage(other.charted, p.x, p.y, foreign * view.zoom + bleed, foreign * view.zoom + bleed);
          } else {
            const x0 = Math.floor(tx * tileSize / foreign), x1 = Math.ceil((tx + 1) * tileSize / foreign);
            const y0 = Math.floor(ty * tileSize / foreign), y1 = Math.ceil((ty + 1) * tileSize / foreign);
            for (let fy = y0; fy < y1; fy++) for (let fx = x0; fx < x1; fx++) {
              const other = this.tiles.get(`atlas:${foreign}:${fx}:${fy}`);
              if (!other || other.revision === -1) continue;
              const p = projectMapPoint(fx * foreign, fy * foreign, view);
              c.drawImage(other.charted, p.x, p.y, foreign * view.zoom + bleed, foreign * view.zoom + bleed);
            }
          }
        }
      }
    }
    for (const { tx, ty, tile, blend } of layers) {
      if (!tile || !blend) continue;
      const p = projectMapPoint(tx * tileSize, ty * tileSize, view);
      c.globalAlpha = blend * opacity;
      c.drawImage(tile.charted, p.x, p.y, tileSize * view.zoom + bleed, tileSize * view.zoom + bleed);
      if (tile.chartedRoads) roadTiles.push({ tile, x: p.x, y: p.y });
    }
    c.globalAlpha = opacity;
    c.imageSmoothingEnabled = true;
    for (const road of roadTiles) c.drawImage(road.tile.chartedRoads!, road.x, road.y, tileSize * view.zoom, tileSize * view.zoom);
    }
    if (!mini) {
      // Parchment grade: warm sepia multiply, a faint paper lift and a soft
      // vignette pull the chart toward a hand-drawn WoW atlas.
      const cx = view.x + view.width / 2, cy = view.y + view.height / 2;
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = '#d9c9a8'; c.fillRect(view.x, view.y, view.width, view.height);
      c.globalCompositeOperation = 'screen';
      c.fillStyle = '#2a2412'; c.fillRect(view.x, view.y, view.width, view.height);
      c.globalCompositeOperation = 'multiply';
      const vignette = c.createRadialGradient(cx, cy, Math.min(view.width, view.height) * .38, cx, cy, Math.max(view.width, view.height) * .78);
      vignette.addColorStop(0, '#ffffff'); vignette.addColorStop(1, '#b8a67e');
      c.fillStyle = vignette; c.fillRect(view.x, view.y, view.width, view.height);
      c.globalCompositeOperation = 'source-over';
    }
    if (overview && this.world.zoneKey) drawMapOverview(c, view);
    if (overview) drawMapOverviewFog(c, view, this.exploration, this.overviewFog ??= document.createElement('canvas'));
    c.imageSmoothingEnabled = false;
    for (const building of simple || view.zoom < .065 ? [] : this.world.getBuildings(region.x, region.y, region.width, region.height)) {
      const { x, y, width, height } = building;
      if (!this.exploration.isRevealed(x, y) || !this.exploration.isRevealed(x + width, y)
        || !this.exploration.isRevealed(x, y + height) || !this.exploration.isRevealed(x + width, y + height)) continue;
      const p = projectMapPoint(x, y, view), w = width * view.zoom, h = height * view.zoom;
      if (!mini && !isMapSampleRevealed(this.exploration, x, y, Math.max(width, height))) continue;
      if (!mini) { drawMapBuilding(c, p.x, p.y, Math.max(1, w), Math.max(1, h), building.kind); continue; }
      c.fillStyle = '#111a1d'; c.fillRect(p.x + 1, p.y + 1, w, h);
      c.fillStyle = '#897951'; c.fillRect(p.x, p.y, Math.max(1, w), Math.max(1, h));
      if (w > 6 && h > 6) { c.strokeStyle = '#c4ae78'; c.lineWidth = .8; c.strokeRect(p.x + .5, p.y + .5, w - 1, h - 1);
        c.strokeStyle = '#454a37'; c.beginPath(); c.moveTo(p.x + w / 2, p.y + 2); c.lineTo(p.x + w / 2, p.y + h - 2); c.stroke(); }
    }
    const { pois, labels } = features;
    if (!mini && !simple && this.zoneLevels) drawMapZoneLevels(c, view, this.exploration, this.world.seed, features.zones, this.world.zoneKey);
    if (overview) drawMapOverviewLabels(c, view, this.world.zoneKey);
    for (const label of labels) {
      const p = projectMapPoint(label.x, label.y, view), biome = BIOMES[label.id as BiomeId];
      const labelColor = biome?.color ?? palette.jade;
      c.save(); c.globalAlpha = .84;
      c.strokeStyle = `${labelColor}99`; c.lineWidth = .8;
      c.beginPath(); c.moveTo(p.x - 25, p.y + 19); c.lineTo(p.x - 5, p.y + 19); c.moveTo(p.x + 5, p.y + 19); c.lineTo(p.x + 25, p.y + 19); c.stroke();
      c.fillStyle = labelColor; c.fillRect(p.x - 1, p.y + 18, 2, 2);
      text(c, label.name, p.x + 1, p.y + 1, 1.14, palette.ink, 'center');
      text(c, label.name, p.x, p.y, 1.14, palette.ivory, 'center'); c.restore();
    }
    for (const poi of pois) {
      if (poi.kind !== 'portal' && !poi.sighted && !this.exploration.isRevealed(poi.x, poi.y)) continue;
      const p = projectMapPoint(poi.x, poi.y, view);
      this.poiIcon(c, poi, p.x, p.y, mini ? MAP_ICON_SIZES.minimap : view.zoom < .07 ? MAP_ICON_SIZES.overview : MAP_ICON_SIZES.map, this.hovered?.id === poi.id && !mini);
      if (!mini && poi.kind === 'town' && (view.zoom >= .045 || (this.zoneLevels && view.zoom >= .025))) {
        text(c, poi.name, p.x + 1, p.y + 13, 1.15, palette.ink, 'center');
        text(c, poi.name, p.x, p.y + 12, 1.15, palette.ivory, 'center');
      }
    }
    // Epic+ ground drops get a star on both the minimap and the open map; the
    // legend 'loot' toggle hides them, and the exploration chart skips them.
    if (!simple && mapIconVisible(this.iconVisibility, 'loot'))
      drawLootMapMarkers(c, view, lootMapMarkers(this.lootMarkers?.() ?? []), mini ? 3.4 : 5);
    drawJourneyMapMarker(c,view,this.journeyMarker,mini,this.iconVisibility);
    c.restore();
    return pois;
  }

  private poiIcon(c: CanvasRenderingContext2D, poi: MapPOI, x: number, y: number, size: number, selected: boolean) {
    const cleared = this.activityStateReader(poi)?.rewardsClaimed ?? false;
    drawMapPOIIcon(c, poi.kind, x, y, size, selected, cleared);
  }

  private playerArrow(c: CanvasRenderingContext2D, player: MapPlayer, view: MapView, mini: boolean) {
    if (!mapIconVisible(this.iconVisibility, 'player') && !(!mini && this.focusPing && !this.focusPing.hidden && !this.focusTarget)) return;
    const p = projectMapPoint(player.x, player.y, view);
    if (p.x < view.x || p.y < view.y || p.x > view.x + view.width || p.y > view.y + view.height) return;
    drawMapPlayerIcon(c, p.x, p.y, player.angle, mini);
  }

  private location(player: MapPlayer) {
    const building = this.world.getBuildingAt?.(player.x, player.y);
    if (building?.name) return building.name;
    if (this.world.isSanctuary?.(player.x, player.y)) {
      const towns = this.exploration.getDiscoveredPOIs({ x: player.x - 900, y: player.y - 900, width: 1800, height: 1800 }).filter(p => p.kind === 'town');
      towns.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
      if (towns[0]) return towns[0].name;
    }
    return this.world.sampleBiome(player.x, player.y).name;
  }

  /** Secondary display projection: the same fog, terrain and POIs as the main chart. */
  drawCompanion(c: CanvasRenderingContext2D, player: MapPlayer, width: number, height: number, zoom: number) {
    const view = { x: 0, y: 0, width, height, centerX: player.x, centerY: player.y, zoom };
    this.chart(c, view, true);
    this.playerArrow(c, player, view, true);
  }

  drawMinimap(c: CanvasRenderingContext2D, player: MapPlayer, width: number, height: number, time: number,
    enemies: readonly MinimapEnemy[] = []) {
    const r = getMinimapRect(width, height);
    const view: MapView = { ...getMinimapChartRect(r),
      centerX: player.x, centerY: player.y, zoom: .0625 };
    const active = this.minimapPointer && this.minimapPointer.x >= r.x && this.minimapPointer.y >= r.y
      && this.minimapPointer.x < r.x + r.width && this.minimapPointer.y < r.y + r.height;
    c.save();
    drawMinimapFrame(c, r, this.location(player), mapAreaLabel(this.world, player.x, player.y), time, !!active);
    const pois = this.chart(c, view, true);
    const center = projectMapPoint(player.x, player.y, view);
    c.save(); c.beginPath(); c.rect(view.x, view.y, view.width, view.height); c.clip();
    c.setLineDash([2, 4]); c.strokeStyle = '#c5d5b127'; c.lineWidth = .8;
    c.beginPath(); c.arc(center.x, center.y, EXPLORATION_REVEAL_RADIUS * view.zoom, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    for (const enemy of enemies) {
      if (!mapIconVisible(this.iconVisibility, enemyMapIconId(enemy)) || !this.exploration.isRevealed(enemy.x, enemy.y)) continue;
      const p = projectMapPoint(enemy.x, enemy.y, view);
      if (p.x < view.x || p.y < view.y || p.x > view.x + view.width || p.y > view.y + view.height) continue;
      drawMapEnemyIcon(c, p.x, p.y, enemy.kind, enemy.rank);
    }
    { const we = this.worldEvents(); if (we) drawWorldEventMinimapMarkers(c, view, we.state, we.time); }
    this.playerArrow(c, player, view, true); c.restore();
    text(c, 'N', view.x + view.width / 2, view.y + 3, .8, palette.jade, 'center');
    if (this.minimapPointer) {
      const poi = pickMapPOI(pois.filter(p => p.kind === 'portal' || p.sighted || this.exploration.isRevealed(p.x, p.y)), view, this.minimapPointer, 8);
      if (poi) {
        const boxWidth = Math.min(190, width - 24), bx = Math.max(12, r.x - boxWidth - 9), by = r.y + 30;
        c.fillStyle = `${palette.panel}fa`; c.fillRect(bx, by, boxWidth, 48);
        c.strokeStyle = palette.lineStrong; c.strokeRect(bx + .5, by + .5, boxWidth - 1, 47);
        c.fillStyle = POI_DEFINITIONS[poi.kind].color; c.fillRect(bx + 1, by + 9, 2, 29);
        c.save(); c.beginPath(); c.rect(bx + 10, by + 6, boxWidth - 20, 36); c.clip();
        text(c, `${this.poiLabel(poi)} · ${this.encounterLevelReader(poi) !== null ? `Lv ${this.encounterLevelReader(poi)}` : mapAreaLabel(this.world, poi.x, poi.y)}`, bx + 11, by + 9, .75, palette.jade);
        text(c, poi.name, bx + 11, by + 26, 1.1, palette.ivory); c.restore();
      }
    }
    c.restore();
  }

  /** Pointer bursts commit once per display frame; hover never regenerates the chart. */
  private invalidate(chart = true) {
    this.chartDirty ||= chart;
    if (!this.opened || this.disposed || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.chartDirty) this.render(); else this.drawHover();
    });
  }

  private render() {
    if (!this.opened || this.disposed) return;
    if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0;
    this.chartDirty = false; this.pendingTerrain = false;
    if (!this.prepareLayout()) return;
    this.advanceRecenter(performance.now());
    this.buildBudget = 5; this.previewBudget = 3;
    try { this.drawChart(); } finally { this.buildBudget = undefined; this.previewBudget = undefined; }
    const destination = this.focusTarget ?? this.player;
    const focusPoint = projectMapPoint(destination.x, destination.y, this.view);
    this.focusPing.style.left = `${focusPoint.x}px`;
    this.focusPing.style.top = `${focusPoint.y}px`;
    if (this.pendingTerrain || this.recenter || this.zoomActive()) this.invalidate();
    const drops = lootMapMarkers(this.lootMarkers?.() ?? []);
    let checksum = 0; for (const drop of drops) checksum = (checksum + drop.id) | 0;
    this.presentation = { x: this.player.x, y: this.player.y, angle: this.player.angle,
      revision: this.exploration.revision, status: this.exploration.storageStatus,
      message: this.exploration.persistenceMessage, loot: `${drops.length}:${checksum}` };
  }

  private drawChart() {
    const c = this.context;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0); c.clearRect(0, 0, this.view.width, this.view.height);
    this.hovered = null;
    // Mid-gesture: stretch the pre-zoom chart instead of rebuilding terrain,
    // fog and labels every frame. The settled render restores full detail.
    if (this.zoomActive() && this.zoomAnchor && this.chartLayer) {
      const a = this.zoomAnchor, k = this.view.zoom / a.zoom;
      const dx = this.view.width / 2 + (a.centerX - this.view.centerX) * this.view.zoom - k * this.view.width / 2;
      const dy = this.view.height / 2 + (a.centerY - this.view.centerY) * this.view.zoom - k * this.view.height / 2;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      c.imageSmoothingEnabled = true;
      c.setTransform(k, 0, 0, k, dx * this.ratio, dy * this.ratio);
      c.drawImage(this.chartLayer, 0, 0);
      c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      c.imageSmoothingEnabled = false;
      this.playerArrow(c, this.player, this.view, false);
      return;
    }
    this.chartLayerValid = false; this.zoomAnchor = null;
    if (this.explorationMode) {
      const features = this.features(this.view, true);
      this.chart(c, this.view, false, features, true);
      this.playerArrow(c, this.player, this.view, false);
      this.visiblePOIs = features.pois; this.hideTooltip();
      return;
    }
    const features = this.features(this.view, false);
    this.visiblePOIs = features.pois;
    this.chart(c, this.view, false, features);
    const grid = this.view.zoom < .002 ? 200000 : this.view.zoom < .01 ? 12800 : this.view.zoom < .065 ? 3200 : 1536, first = unprojectMapPoint(0, 0, this.view);
    c.save(); c.strokeStyle = '#bfbe9710'; c.lineWidth = .65;
    for (let wx = Math.ceil(first.x / grid) * grid; wx < first.x + this.view.width / this.view.zoom; wx += grid) {
      const p = projectMapPoint(wx, 0, this.view); c.beginPath(); c.moveTo(p.x, 0); c.lineTo(p.x, this.view.height); c.stroke();
    }
    for (let wy = Math.ceil(first.y / grid) * grid; wy < first.y + this.view.height / this.view.zoom; wy += grid) {
      const p = projectMapPoint(0, wy, this.view); c.beginPath(); c.moveTo(0, p.y); c.lineTo(this.view.width, p.y); c.stroke();
    }
    c.restore();
    this.playerArrow(c, this.player, this.view, false);
    const scale = this.view.zoom < .0006 ? 400000 : this.view.zoom < .0015 ? 150000 : this.view.zoom < .003 ? 60000
      : this.view.zoom < .006 ? 40000 : this.view.zoom < .012 ? 25000 : this.view.zoom < .025 ? 10000
      : this.view.zoom < .06 ? 2000 : this.view.zoom < .16 ? 1000 : 250;
    const scaleWidth = scale * this.view.zoom;
    c.strokeStyle = `${palette.ivory}75`; c.lineWidth = 1;
    c.beginPath(); c.moveTo(24, this.view.height - 25); c.lineTo(24, this.view.height - 21);
    c.lineTo(24 + scaleWidth, this.view.height - 21); c.lineTo(24 + scaleWidth, this.view.height - 25); c.stroke();
    text(c, formatWorldDistance(scale), 24, this.view.height - 39, .9, palette.muted);

    drawMapCompass(c, this.view.width - 60, 60);
    this.drawHover();
  }

  private drawHover() {
    // Mid-gesture the canvas shows a stretched snapshot; hover chrome waits for the settled render.
    if (this.zoomActive()) { this.tooltip.hidden = true; this.areaInfo.hidden = true; return; }
    const previous = this.hovered;
    this.hovered = this.pointer && !this.drag ? pickMapPOI(this.visiblePOIs, this.view, this.pointer, 14) : null;
    if (previous?.id !== this.hovered?.id) {
      const c = this.context;
      if (!this.chartLayerValid) {
        const layer = this.chartLayer ??= document.createElement('canvas');
        if (layer.width !== this.canvas.width || layer.height !== this.canvas.height) {
          layer.width = this.canvas.width; layer.height = this.canvas.height;
        }
        const saved = layer.getContext('2d')!;
        saved.clearRect(0, 0, layer.width, layer.height); saved.drawImage(this.canvas, 0, 0);
        this.chartLayerValid = true;
      } else {
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height);
        c.drawImage(this.chartLayer!, 0, 0);
      }
      c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      if (this.hovered) {
        const p = projectMapPoint(this.hovered.x, this.hovered.y, this.view);
        this.poiIcon(c, this.hovered, p.x, p.y, this.view.zoom < .07 ? MAP_ICON_SIZES.overview : MAP_ICON_SIZES.map, true);
      }
    }
    this.updateAreaInfo();
    const marker=this.journeyMarker, markerPoint=marker?projectMapPoint(marker.x,marker.y,this.view):null;
    if(marker&&mapIconVisible(this.iconVisibility,marker.known?'journey:destination':'journey:search')&&markerPoint&&this.pointer&&!this.drag&&Math.hypot(markerPoint.x-this.pointer.x,markerPoint.y-this.pointer.y)<15){
      this.tooltip.hidden=false;setText(this.tooltipName,marker.name);
      setText(this.tooltipKind,'Journey');setText(this.tooltipDescription,marker.known?'Tracked activity':'Explore this area to find the activity');
      this.tooltip.style.setProperty('--poi-color',palette.brass);this.positionTooltip(this.pointer);
    }
    else if (this.hovered && this.pointer) this.showTooltip(this.hovered, this.pointer);
    else this.tooltip.hidden = true;
  }

  private updateAreaInfo() {
    const pointer = this.pointer;
    if (!pointer || this.drag || this.explorationMode || pointer.x < this.view.x || pointer.y < this.view.y
      || pointer.x >= this.view.x + this.view.width || pointer.y >= this.view.y + this.view.height) {
      this.areaInfo.hidden = true; return;
    }
    const point = unprojectMapPoint(pointer.x, pointer.y, this.view);
    const inspected = chartedMapArea(this.world, this.exploration, point.x, point.y)
      ?? (this.view.zoom < MAP_OVERVIEW_ZOOM ? overviewMapArea(this.world, point.x, point.y) : null);
    this.areaInfo.hidden = !inspected;
    if (!inspected) return;
    setText(this.areaName, inspected.name); setText(this.areaBiome, inspected.biome);
    setText(this.areaLevel, inspected.label);
    setText(this.areaCoordinates, `X ${Math.round(inspected.x)} · Y ${Math.round(inspected.y)}`);
  }

  private showTooltip(poi: MapPOI, point: { x: number; y: number }) {
    this.tooltip.hidden = false; setText(this.tooltipName, poi.name);
    setText(this.tooltipKind, `${this.poiLabel(poi)} · ${this.encounterLevelReader(poi) !== null ? `Lv ${this.encounterLevelReader(poi)}` : mapAreaLabel(this.world, poi.x, poi.y)}`); setText(this.tooltipDescription, this.activityStateReader(poi)?.label ?? poi.description);
    this.tooltip.style.setProperty('--poi-color', POI_DEFINITIONS[poi.kind].color);
    this.positionTooltip(point);
  }
  private positionTooltip(point: { x: number; y: number }) {
    this.tooltip.style.left = `${Math.max(10, Math.min(this.view.width - this.tooltip.offsetWidth - 12, point.x + 18))}px`;
    this.tooltip.style.top = `${Math.max(10, Math.min(this.view.height - this.tooltip.offsetHeight - 12, point.y + 15))}px`;
  }
  private hideTooltip() { this.tooltip.hidden = true; this.areaInfo.hidden = true; }
  dispose() {
    if (this.disposed) return;
    this.legend.dispose(); this.unsubscribeIcons();
    this.close(); this.disposed = true; this.abort.abort(); this.tiles.clear(); this.previewTiles.clear(); this.element.remove(); this.exploration.save();
  }
}
