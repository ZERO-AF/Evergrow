import { CONTINENT_BOUNDS, CONTINENTS, ZONES, zoneRect, type AtlasRect, type ContinentId } from './world-atlas.ts';
import { BIOMES, zoneBiome } from './biomes.ts';
import type { Exploration } from './exploration.ts';
import { text, textWidth } from './font.ts';
import { projectMapPoint, type MapView } from './map-view.ts';

/** Below this zoom the chart swaps terrain tiles for the authored atlas silhouette. */
export const MAP_OVERVIEW_ZOOM = .02;

interface OverviewZone {
  readonly id: string; readonly name: string; readonly rect: AtlasRect; readonly color: string;
  readonly levelMin: number; readonly levelMax: number; readonly hazardous: boolean;
}
/** Zone fills blend toward parchment so the silhouette reads as a hand-drawn atlas. */
const parchmentMix = (hex: string, lift: number): string => {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${rgb.map(v => Math.round(v + (196 - v) * lift)).join(',')})`;
};
const OVERVIEW_ZONES: readonly OverviewZone[] = Object.freeze(Object.values(ZONES).map(zone => Object.freeze({
  id: zone.id, name: zone.name, rect: zoneRect(zone.id)!, color: parchmentMix(BIOMES[zoneBiome(zone.terrain)].color, .34),
  levelMin: zone.levelMin, levelMax: zone.levelMax, hazardous: zone.faction === 'hostile',
})));

/** World-space rectangle covered by the chart viewport. */
interface OverviewRegion { left: number; top: number; right: number; bottom: number }
const viewBounds = (view: MapView): OverviewRegion => ({
  left: view.centerX - view.width / view.zoom / 2, top: view.centerY - view.height / view.zoom / 2,
  right: view.centerX + view.width / view.zoom / 2, bottom: view.centerY + view.height / view.zoom / 2,
});
const intersects = (r: AtlasRect, region: OverviewRegion) =>
  r.x < region.right && r.x + r.w > region.left && r.y < region.bottom && r.y + r.h > region.top;

export function drawMapOverview(c: CanvasRenderingContext2D, view: MapView,
  zoneKey: (x: number, y: number) => string | null): void {
  const region = viewBounds(view), step = Math.max(1500, Math.min(6000, 12 / view.zoom));
  const coast = new Path2D(), border = new Path2D();
  c.save();
  c.fillStyle = '#22333a'; c.fillRect(view.x, view.y, view.width, view.height);
  for (const zone of OVERVIEW_ZONES) {
    const r = zone.rect;
    if (!intersects(r, region)) continue;
    const p = projectMapPoint(r.x, r.y, view);
    c.globalAlpha = .88; c.fillStyle = zone.color;
    c.fillRect(p.x, p.y, r.w * view.zoom + .5, r.h * view.zoom + .5);
    // Sample just outside each edge: open water yields coastline, land a border.
    const edges: readonly (readonly [number, number, number, number, number, number])[] = [
      [r.x, r.y, r.w, 0, 0, -900], [r.x, r.y + r.h, r.w, 0, 0, 900],
      [r.x, r.y, 0, r.h, -900, 0], [r.x + r.w, r.y, 0, r.h, 900, 0]];
    for (const [ex, ey, dx, dy, ox, oy] of edges) {
      const n = Math.max(1, Math.ceil((dx || dy) / step));
      let start = 0, coastal = zoneKey(ex + ox, ey + oy) === null;
      for (let i = 1; i <= n; i++) {
        const next = i < n && zoneKey(ex + dx * i / n + ox, ey + dy * i / n + oy) === null;
        if (i < n && next === coastal) continue;
        const a = projectMapPoint(ex + dx * start / n, ey + dy * start / n, view);
        const b = projectMapPoint(ex + dx * i / n, ey + dy * i / n, view);
        const path = coastal ? coast : border;
        path.moveTo(a.x, a.y); path.lineTo(b.x, b.y);
        if (i < n) { start = i; coastal = next; }
      }
    }
  }
  c.globalAlpha = 1; c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = '#101b20b8'; c.lineWidth = .9; c.stroke(border);
  c.strokeStyle = '#0a1418'; c.lineWidth = 2.6; c.stroke(coast);
  c.strokeStyle = '#ead9a8b0'; c.lineWidth = 1.1; c.stroke(coast);
  c.restore();
}

/** Exploration fog lifted chunk-by-chunk; the silhouette stays readable below it. */
export function drawMapOverviewFog(c: CanvasRenderingContext2D, view: MapView,
  exploration: Pick<Exploration, 'forEachExploredChunk'>, fog: HTMLCanvasElement): void {
  const f = fog.getContext('2d')!;
  f.globalCompositeOperation = 'source-over';
  f.clearRect(0, 0, fog.width, fog.height);
  f.fillStyle = '#060a0e59'; f.fillRect(0, 0, fog.width, fog.height);
  f.globalCompositeOperation = 'destination-out';
  const region = viewBounds(view);
  exploration.forEachExploredChunk((x, y, size) => {
    if (x + size <= region.left || x >= region.right || y + size <= region.top || y >= region.bottom) return;
    const p = projectMapPoint(x, y, view), side = size * view.zoom;
    f.fillRect(p.x - view.x - .5, p.y - view.y - .5, side + 1, side + 1);
  });
  f.globalCompositeOperation = 'source-over';
  c.drawImage(fog, view.x, view.y, view.width, view.height);
}

interface LabelBox { x: number; y: number; w: number; h: number }
/** Continent and zone names decluttered in screen space, shown with or without fog. */
export function drawMapOverviewLabels(c: CanvasRenderingContext2D, view: MapView,
  zoneKey?: (x: number, y: number) => string | null): void {
  const region = viewBounds(view), placed: LabelBox[] = [];
  const free = (box: LabelBox) => !placed.some(b => box.x < b.x + b.w + 10 && box.x + box.w + 10 > b.x
    && box.y < b.y + b.h + 8 && box.y + box.h + 8 > b.y);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  c.save();
  c.shadowColor = '#030b10'; c.shadowBlur = 5;
  if (view.zoom <= .002) for (const id of Object.keys(CONTINENT_BOUNDS) as ContinentId[]) {
    const b = CONTINENT_BOUNDS[id];
    if (!intersects(b, region)) continue;
    const name = CONTINENTS[id].name, w = textWidth(name, 2.2);
    const p = projectMapPoint(b.x + b.w / 2, b.y + b.h / 2, view);
    p.x = clamp(p.x, view.x + w / 2 + 12, view.x + view.width - w / 2 - 12);
    p.y = clamp(p.y, view.y + 34, view.y + view.height - 44);
    const box = { x: p.x - w / 2, y: p.y - 20, w, h: 30 };
    if (!free(box)) continue;
    c.globalAlpha = .5; text(c, name, p.x, p.y, 2.2, '#e9dcbd', 'center');
    placed.push(box);
  }
  const zones = OVERVIEW_ZONES.filter(z => intersects(z.rect, region))
    .sort((a, b) => b.rect.w * b.rect.h - a.rect.w * a.rect.h);
  c.globalAlpha = 1;
  for (const zone of zones) {
    const w = zone.rect.w * view.zoom, h = zone.rect.h * view.zoom;
    if (w < 42 || h < 24) continue;
    const nameW = textWidth(zone.name, 1.05);
    if (nameW > w + 56) continue;
    const p = projectMapPoint(zone.rect.x + zone.rect.w / 2, zone.rect.y + zone.rect.h / 2, view);
    p.x = clamp(p.x, view.x + nameW / 2 + 10, view.x + view.width - nameW / 2 - 10);
    p.y = clamp(p.y, view.y + 22, view.y + view.height - 34);
    const level = h >= 48 ? `Lv ${zone.levelMin}–${zone.levelMax}` : '';
    const box = { x: p.x - nameW / 2, y: p.y - 13, w: nameW, h: level ? 30 : 17 };
    if (!free(box)) continue;
    text(c, zone.name, p.x, p.y, 1.05, '#ecdfbe', 'center');
    if (level) text(c, level, p.x, p.y + 14, .8, zone.hazardous ? '#ffb28b' : '#cdbd90', 'center');
    placed.push(box);
  }
  if (zoneKey && zoneKey(view.centerX, view.centerY) === null) {
    const name = 'The Great Sea', w = textWidth(name, 1.5);
    const sx = view.x + view.width / 2, sy = view.y + view.height / 2;
    if (free({ x: sx - w / 2, y: sy - 14, w, h: 22 })) {
      c.globalAlpha = .38; text(c, name, sx, sy, 1.5, '#a8c4c8', 'center');
    }
  }
  c.restore();
}
