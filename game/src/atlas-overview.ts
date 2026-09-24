import { CONTINENT_BOUNDS, CONTINENTS, ZONES, zoneAt, zoneRect, type AtlasRect, type ContinentId } from './world-atlas.ts';
import { BIOMES, zoneBiome } from './biomes.ts';
import { hash2, noise2 } from './random-source.ts';
import type { Exploration } from './exploration.ts';
import { text, textWidth } from './font.ts';
import { projectMapPoint, type MapView } from './map-view.ts';
import { clamp } from './art-primitives.ts';

/** Below this zoom the chart swaps terrain tiles for the authored atlas silhouette. */
export const MAP_OVERVIEW_ZOOM = .02;

// ── Authored outline geometry ────────────────────────────────────────────────
// The atlas pins zones to exact rectangles; the chart derives the real
// coastline/border course from that union. Every zone edge is split at the
// corners of adjoining zones (T-junctions become shared nodes), each node and
// edge point is displaced by a seeded noise field, and shared segments carry
// identical points — so displaced zone fills still tile seamlessly and the
// continent silhouette is the true union boundary, not a generic blob.
const OVERVIEW_SEED = 0x5eed;
const COAST_REACH = 26000;   // max coastal displacement, world units
const BORDER_REACH = 2400;   // max interior border wobble
const SEGMENT_STEP = 8000;   // subdivisions along a shared edge
const PROBE = 420;           // outward probe deciding coast vs border

type Pt = readonly [number, number];
interface Segment {
  ka: string; kb: string;             // canonical node keys (ka < kb)
  ax: number; ay: number; bx: number; by: number; // base points, ka→kb order
  coast: boolean;
  continent: ContinentId;             // land side's continent (emitter)
  pts: Pt[];                          // displaced polyline, ka→kb order
}
interface OverviewZone {
  readonly id: string; readonly name: string; readonly rect: AtlasRect; readonly color: string;
  readonly levelMin: number; readonly levelMax: number; readonly hazardous: boolean;
  readonly path: Path2D;
}
interface OverviewContinent { readonly bounds: AtlasRect; readonly zones: OverviewZone[]; readonly coast: Path2D; readonly borders: Path2D }

const nodeKey = (x: number, y: number) => `${Math.round(x)}:${Math.round(y)}`;
const segKey = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;

/** Seeded 2D displacement field; identical for a point regardless of which zone samples it. */
function displaced(x: number, y: number, amp: number): Pt {
  const dx = (noise2(x / 46000, y / 46000, OVERVIEW_SEED + 11) - .5) * 1.7
    + (noise2(x / 13000, y / 13000, OVERVIEW_SEED + 23) - .5) * 1.1;
  const dy = (noise2(x / 46000, y / 46000, OVERVIEW_SEED + 37) - .5) * 1.7
    + (noise2(x / 13000, y / 13000, OVERVIEW_SEED + 51) - .5) * 1.1;
  return [x + dx * amp, y + dy * amp];
}

/** Quadratic midpoint smoothing: passes through every displaced point tangentially. */
function smoothClosed(path: Path2D, pts: readonly Pt[]): void {
  if (pts.length < 3) return;
  const n = pts.length;
  path.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    path.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  path.closePath();
}
function smoothOpen(path: Path2D, pts: readonly Pt[]): void {
  if (pts.length < 2) return;
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    path.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  path.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
}


let geometry: ReadonlyMap<ContinentId, OverviewContinent> | null = null;
function overviewGeometry(): ReadonlyMap<ContinentId, OverviewContinent> {
  if (geometry) return geometry;
  const segments = new Map<string, Segment>();
  const coastalNode = new Set<string>();
  const nodeMinEdge = new Map<string, number>();
  const zoneEdges = new Map<string, { seg: Segment; forward: boolean }[][]>();
  const zones = Object.values(ZONES);

  // Pass 1: split each zone edge at adjoining zone corners, classify segments.
  for (const zone of zones) {
    const r = zoneRect(zone.id)!;
    const edges: { seg: Segment; forward: boolean }[][] = [];
    const sides: readonly (readonly [number, number, number, number])[] = [
      [r.x, r.y, r.x + r.w, r.y],           // top, west→east
      [r.x + r.w, r.y, r.x + r.w, r.y + r.h], // right, north→south
      [r.x + r.w, r.y + r.h, r.x, r.y + r.h], // bottom, east→west
      [r.x, r.y + r.h, r.x, r.y],           // left, south→north
    ];
    for (const [sx, sy, ex, ey] of sides) {
      const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy);
      const ts = new Set<number>([0, 1]);
      for (const other of zones) {
        if (other === zone) continue;
        const o = zoneRect(other.id)!;
        for (const [cx, cy] of [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]]) {
          const t = dx ? (cx - sx) / dx : (cy - sy) / dy;
          if (t > 1e-9 && t < 1 - 1e-9 && Math.abs(dx ? cy - sy : cx - sx) < 1e-6) ts.add(t);
        }
      }
      const sorted = [...ts].sort((a, b) => a - b), list: { seg: Segment; forward: boolean }[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const ax = sx + dx * sorted[i], ay = sy + dy * sorted[i];
        const bx = sx + dx * sorted[i + 1], by = sy + dy * sorted[i + 1];
        let ka = nodeKey(ax, ay), kb = nodeKey(bx, by), forward = true;
        if (kb < ka) { [ka, kb] = [kb, ka]; forward = false; }
        const key = segKey(ka, kb);
        let seg = segments.get(key);
        if (!seg) {
          // Outward is ambiguous under canonical order: probe both sides of the
          // midpoint; exactly one must be open water for a coastline.
          const mx = (ax + bx) / 2, my = (ay + by) / 2, nx = dy / len, ny = -dx / len;
          const coast = (zoneAt(mx + nx * PROBE, my + ny * PROBE) === null)
            !== (zoneAt(mx - nx * PROBE, my - ny * PROBE) === null);
          seg = { ka, kb, ax: forward ? ax : bx, ay: forward ? ay : by, bx: forward ? bx : ax, by: forward ? by : ay, coast, continent: zone.continent, pts: [] };
          segments.set(key, seg);
          if (coast) { coastalNode.add(ka); coastalNode.add(kb); }
          for (const k of [ka, kb]) {
            const e = Math.hypot(bx - ax, by - ay);
            nodeMinEdge.set(k, Math.min(nodeMinEdge.get(k) ?? Infinity, e));
          }
        }
        list.push({ seg, forward });
      }
      edges.push(list);
    }
    zoneEdges.set(zone.id, edges);
  }

  // Pass 2: displace segment points. Coastal nodes swing wide; border nodes
  // stay near the authored line. Interior amplitude lerps between endpoints.
  const nodeAmp = (k: string) =>
    coastalNode.has(k) ? Math.min(COAST_REACH, (nodeMinEdge.get(k) ?? COAST_REACH) * .3) : BORDER_REACH;
  for (const seg of segments.values()) {
    const ampA = nodeAmp(seg.ka), ampB = nodeAmp(seg.kb);
    const len = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
    const n = Math.max(1, Math.min(14, Math.round(len / SEGMENT_STEP)));
    const pts: Pt[] = [displaced(seg.ax, seg.ay, ampA)];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push(displaced(seg.ax + (seg.bx - seg.ax) * t, seg.ay + (seg.by - seg.ay) * t, ampA + (ampB - ampA) * t));
    }
    pts.push(displaced(seg.bx, seg.by, ampB));
    seg.pts = pts;
  }

  // Pass 3: chain coast segments into continuous shorelines, dedupe borders,
  // and build each zone's closed fill path from its own oriented segments.
  const byNode = new Map<string, Segment[]>();
  for (const seg of segments.values()) {
    if (!seg.coast) continue;
    for (const k of [seg.ka, seg.kb]) {
      const list = byNode.get(k); if (list) list.push(seg); else byNode.set(k, [seg]);
    }
  }
  const used = new Set<Segment>(), chains: { continent: ContinentId; pts: Pt[] }[] = [];
  for (const start of segments.values()) {
    if (!start.coast || used.has(start)) continue;
    used.add(start);
    const chain = [start];
    // Extend both ends node-by-node; each added segment's free end becomes the cursor.
    let endKey = start.kb, startKey = start.ka;
    for (;;) {
      const next = byNode.get(endKey)?.find(s => !used.has(s));
      if (!next) break;
      used.add(next); chain.push(next);
      endKey = next.ka === endKey ? next.kb : next.ka;
    }
    for (;;) {
      const next = byNode.get(startKey)?.find(s => !used.has(s));
      if (!next) break;
      used.add(next); chain.unshift(next);
      startKey = next.ka === startKey ? next.kb : next.ka;
    }
    // Flatten in traversal order from the chain's free start node.
    const pts: Pt[] = [];
    let cursor = startKey;
    for (const seg of chain) {
      const forward = seg.ka === cursor;
      const pts2 = forward ? seg.pts : [...seg.pts].reverse();
      for (let i = pts.length ? 1 : 0; i < pts2.length; i++) pts.push(pts2[i]);
      cursor = forward ? seg.kb : seg.ka;
    }
    chains.push({ continent: chain[0].continent, pts });
  }

  const result = new Map<ContinentId, OverviewContinent>();
  for (const cid of Object.keys(CONTINENTS) as ContinentId[]) {
    const coast = new Path2D(), borders = new Path2D(), zoneList: OverviewZone[] = [];
    for (const zone of zones) {
      if (zone.continent !== cid) continue;
      const outline: Pt[] = [];
      for (const edge of zoneEdges.get(zone.id)!)
        for (const { seg, forward } of edge) {
          const pts = forward ? seg.pts : [...seg.pts].reverse();
          for (let i = outline.length ? 1 : 0; i < pts.length; i++) outline.push(pts[i]);
        }
      if (outline.length > 1 && outline[0][0] === outline[outline.length - 1][0]
        && outline[0][1] === outline[outline.length - 1][1]) outline.pop();
      const path = new Path2D();
      smoothClosed(path, outline);
      const rect = zoneRect(zone.id)!;
      const jitter = (hash2(Math.round(rect.x / 5000), Math.round(rect.y / 5000), OVERVIEW_SEED, 7) % 13) - 6;
      const rgb = [1, 3, 5].map(i => parseInt(BIOMES[zoneBiome(zone.terrain)].color.slice(i, i + 2), 16));
      // Saturate the biome hue, then lift toward parchment: WoW atlas zones keep
      // their identity color under the aged-paper wash.
      const mean = (rgb[0] + rgb[1] + rgb[2]) / 3;
      const rich = rgb.map(v => v + (v - mean) * .7);
      const lift = .14 + jitter / 130;
      const color = `rgb(${rich.map(v => Math.round(Math.max(0, Math.min(255, v + (198 - v) * lift)))).join(',')})`;
      zoneList.push(Object.freeze({ id: zone.id, name: zone.name, rect, color,
        levelMin: zone.levelMin, levelMax: zone.levelMax, hazardous: zone.faction === 'hostile', path }));
    }
    for (const seg of segments.values()) {
      if (seg.continent !== cid || seg.coast) continue; // coastlines come from the chained loops below
      smoothOpen(borders, seg.pts);
    }
    for (const chain of chains) {
      if (chain.continent !== cid) continue;
      const pts = chain.pts;
      const closed = pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
      if (closed) smoothClosed(coast, pts.slice(0, -1)); else smoothOpen(coast, pts);
    }
    result.set(cid, { bounds: CONTINENT_BOUNDS[cid], zones: zoneList, coast, borders });
  }
  geometry = result;
  return result;
}

/** World-space rectangle covered by the chart viewport. */
interface OverviewRegion { left: number; top: number; right: number; bottom: number }
const viewBounds = (view: MapView): OverviewRegion => ({
  left: view.centerX - view.width / view.zoom / 2, top: view.centerY - view.height / view.zoom / 2,
  right: view.centerX + view.width / view.zoom / 2, bottom: view.centerY + view.height / view.zoom / 2,
});
const intersects = (r: AtlasRect, region: OverviewRegion) =>
  r.x < region.right && r.x + r.w > region.left && r.y < region.bottom && r.y + r.h > region.top;

export function drawMapOverview(c: CanvasRenderingContext2D, view: MapView): void {
  const region = viewBounds(view);
  c.save();
  // Deep parchment sea: a cool slate with a soft vignette so the chart edges
  c.fillStyle = '#2b3d46'; c.fillRect(view.x, view.y, view.width, view.height);
  const cx = view.x + view.width / 2, cy = view.y + view.height / 2;
  const vignette = c.createRadialGradient(cx, cy, Math.min(view.width, view.height) * .3,
    cx, cy, Math.max(view.width, view.height) * .75);
  vignette.addColorStop(0, 'rgba(255,244,214,.05)'); vignette.addColorStop(1, 'rgba(8,14,18,.34)');
  c.fillStyle = vignette; c.fillRect(view.x, view.y, view.width, view.height);

  // Draw the authored outlines in world space: one transform, stroke widths
  // expressed in world units to land at fixed screen widths.
  const t = c.getTransform();
  const scale = Math.max(.0001, Math.hypot(t.a, t.b));
  const px = 1 / (scale * view.zoom); // world units per device pixel
  c.transform(view.zoom, 0, 0, view.zoom,
    view.x + view.width / 2 - view.centerX * view.zoom,
    view.y + view.height / 2 - view.centerY * view.zoom);
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (const continent of overviewGeometry().values()) {
    // Shallow shelf: a pale halo hugging the coastline, half hidden under land.
    c.strokeStyle = 'rgba(222,204,158,.4)'; c.lineWidth = 11 * px; c.stroke(continent.coast);
    c.globalAlpha = .94;
    for (const zone of continent.zones) {
      // Cull on the rect inflated by the max coastal displacement — a zone whose
      // rect sits just off-view can still bulge a coastline into the viewport.
      const zr = zone.rect, pad = COAST_REACH;
      if (!(zr.x - pad < region.right && zr.x + zr.w + pad > region.left
        && zr.y - pad < region.bottom && zr.y + zr.h + pad > region.top)) continue;
      // Stroke the outline in the fill color first: smoothClosed rounds shared
      // corner nodes, so adjacent zones' arcs diverge and leave sea-colored
      // wedges at multi-zone junctions — the matching stroke covers the gap.
      c.strokeStyle = zone.color; c.lineWidth = 3 * px; c.stroke(zone.path);
      c.fillStyle = zone.color; c.fill(zone.path);
    }
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(20,28,26,.7)'; c.lineWidth = 1.1 * px; c.stroke(continent.borders);
    c.strokeStyle = '#0a1418'; c.lineWidth = 2.6 * px; c.stroke(continent.coast);
    c.strokeStyle = 'rgba(234,217,168,.55)'; c.lineWidth = 1.05 * px; c.stroke(continent.coast);
  }
  c.restore();
}

/** Exploration fog lifted chunk-by-chunk into a low-res buffer; the silhouette stays readable below it. */
export function drawMapOverviewFog(c: CanvasRenderingContext2D, view: MapView,
  exploration: Pick<Exploration, 'forEachExploredChunk'>, fog: HTMLCanvasElement): void {
  const scale = Math.min(1, 340 / Math.max(1, view.width));
  const fw = Math.max(1, Math.round(view.width * scale)), fh = Math.max(1, Math.round(view.height * scale));
  if (fog.width !== fw) fog.width = fw;
  if (fog.height !== fh) fog.height = fh;
  const f = fog.getContext('2d')!;
  f.globalCompositeOperation = 'source-over';
  f.clearRect(0, 0, fw, fh);
  f.fillStyle = '#060a0e59'; f.fillRect(0, 0, fw, fh);
  f.globalCompositeOperation = 'destination-out';
  const region = viewBounds(view);
  exploration.forEachExploredChunk((x, y, size) => {
    if (x + size <= region.left || x >= region.right || y + size <= region.top || y >= region.bottom) return;
    const p = projectMapPoint(x, y, view), side = size * view.zoom;
    f.fillRect((p.x - view.x) * scale - .5, (p.y - view.y) * scale - .5, side * scale + 1, side * scale + 1);
  });
  f.globalCompositeOperation = 'source-over';
  c.imageSmoothingEnabled = true;
  c.drawImage(fog, view.x, view.y, view.width, view.height);
  c.imageSmoothingEnabled = false;
}

interface LabelBox { x: number; y: number; w: number; h: number }
/** Continent and zone names decluttered in screen space, shown with or without fog. */
export function drawMapOverviewLabels(c: CanvasRenderingContext2D, view: MapView,
  zoneKey?: (x: number, y: number) => string | null): void {
  const region = viewBounds(view), placed: LabelBox[] = [];
  const free = (box: LabelBox) => !placed.some(b => box.x < b.x + b.w + 10 && box.x + box.w + 10 > b.x
    && box.y < b.y + b.h + 8 && box.y + box.h + 8 > b.y);
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
  const zones = [...overviewGeometry().values()].flatMap(continent => continent.zones)
    .filter(z => intersects(z.rect, region))
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
