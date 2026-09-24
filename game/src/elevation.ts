/** Authored elevation for atlas zones (wayfinder world-t03). A zone's ElevationSpec
 * describes discrete height features — plateaus, mesas, valleys — plus ramps, the only
 * walkable connectors between tiers. The field is deterministic: authored features plus
 * bounded seeded noise, compiled once per zone into an ElevationSite.
 *
 * Collision model: tiers are step functions. A cliff edge is a tier discontinuity —
 * crossing it without a ramp is blocked, and a body straddling the edge is blocked.
 * Ramps interpolate their tier smoothly, so movement along a ramp is legal while its
 * side edges read as ledges. Rendering consumes the same compiled geometry through
 * ElevationRegion (faces + ramps) so the drawn cliff band matches the blocked band.
 *
 * Authored coordinates: feature geometry is normalized to the zone rect (nx/ny/nw/nh,
 * nr), matching AtlasCity/AtlasDungeon convention. `edge` and ramp `width` are world
 * units — they describe collision/art thickness, not zone fraction. */

import { CONTINENTS, ZONES, zoneAt, type AtlasZone } from './world-atlas.ts';
import type { OccluderVolume } from './occlusion.ts';
import { smoothstep } from './random-source.ts';
import { noise2 } from './random-source.ts';

// ── Authored spec ────────────────────────────────────────────────────────────
export type ElevationKind = 'plateau' | 'mesa' | 'valley' | 'overhang';

export interface ElevationFeature {
  /** 'rect' (default) or 'disc'. */
  readonly shape?: 'rect' | 'disc';
  /** Normalized zone-space geometry: rect → nx/ny/nw/nh; disc → nx/ny/nr. */
  readonly nx: number;
  readonly ny: number;
  readonly nw?: number;
  readonly nh?: number;
  readonly nr?: number;
  /** Height tiers relative to the zone base (positive = raised, negative = sunken). */
  readonly tier: number;
  /** Cliff-face width in world units on the low side of the edge. */
  readonly edge?: number;
  /** 'overhang' additionally registers an occluder so the lip fades over the player. */
  readonly kind?: ElevationKind;
}

export interface ElevationRamp {
  /** Normalized endpoints; the ramp is a capsule from (nx,ny) to (nx2,ny2). */
  readonly nx: number;
  readonly ny: number;
  readonly nx2: number;
  readonly ny2: number;
  /** Corridor width in world units. */
  readonly width: number;
  /** Endpoint tiers; omitted ends sample the tier under that endpoint at compile time. */
  readonly fromTier?: number;
  readonly toTier?: number;
}

export interface ElevationSpec {
  readonly features?: readonly ElevationFeature[];
  readonly ramps?: readonly ElevationRamp[];
  /** Bounded noise amplitude in height units (visual only; never affects tiers). */
  readonly noise?: number;
  /** Per-zone noise seed; defaults to a hash of the zone id. */
  readonly seed?: number;
}

// ── Compiled geometry (world space) ──────────────────────────────────────────
export interface ElevationFace {
  readonly shape: 'rect' | 'disc';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly r: number;
  readonly tier: number;
  /** Cliff-face width on the low side of the edge. */
  readonly edge: number;
  readonly kind: ElevationKind;
  /** Present for 'overhang' faces: the silhouette that fades when it covers the player. */
  readonly occluder?: OccluderVolume;
}

export interface ElevationRampView {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly width: number;
  readonly fromTier: number;
  readonly toTier: number;
}

/** Renderer/provider query result for a world-space rect. */
export interface ElevationRegion {
  readonly faces: readonly ElevationFace[];
  readonly ramps: readonly ElevationRampView[];
}

/** Optional world seam: AuthoredWorld implements this so the renderer shades terrain. */
export interface ElevationQueries {
  elevationAt?(x: number, y: number): number;
  elevationTier?(x: number, y: number): number;
  elevationRegion?(x: number, y: number, width: number, height: number): ElevationRegion;
}

// ── Constants ────────────────────────────────────────────────────────────────
/** World units of height per tier; drives shading strength, not collision. */
export const ELEVATION_TIER_HEIGHT = 26;
/** Half a tier is the smallest authored step; anything larger is a cliff edge. */
export const ELEVATION_TIER_THRESHOLD = .49;
const DEFAULT_EDGE = 30;
const OVERHANG_EDGE = 40;
const SEGMENT_STEP = 3;
const PROBE = 1.5;

// ── Deterministic noise (self-contained copy of the landscape hash) ──────────
/** FNV-1a so a zone id becomes a stable seed without a string table. */
function seedFor(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// ── Compiled internals ───────────────────────────────────────────────────────
interface CompiledFeature extends ElevationFace {
  /** Signed distance: negative inside. */
  readonly sd: (x: number, y: number) => number;
}
interface CompiledRamp extends ElevationRampView {
  readonly sd: (x: number, y: number) => number;
  readonly t: (x: number, y: number) => number;
}

function rectSD(cx: number, cy: number, hw: number, hh: number) {
  return (x: number, y: number) => {
    const dx = Math.abs(x - cx) - hw, dy = Math.abs(y - cy) - hh;
    const ox = Math.max(dx, 0), oy = Math.max(dy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0);
  };
}
function discSD(cx: number, cy: number, r: number) {
  return (x: number, y: number) => Math.hypot(x - cx, y - cy) - r;
}
function capsule(x1: number, y1: number, x2: number, y2: number, halfWidth: number) {
  const dx = x2 - x1, dy = y2 - y1, lengthSquared = dx * dx + dy * dy;
  const t = (x: number, y: number) => lengthSquared === 0 ? 0
    : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  const sd = (x: number, y: number) => {
    const k = t(x, y);
    return Math.hypot(x - (x1 + dx * k), y - (y1 + dy * k)) - halfWidth;
  };
  return { sd, t };
}
/** Outward normal via central differences; exact for rect/disc/capsule SDFs. */
function normalOf(sd: (x: number, y: number) => number, x: number, y: number) {
  const e = .5;
  const nx = sd(x + e, y) - sd(x - e, y), ny = sd(x, y + e) - sd(x, y - e);
  const length = Math.hypot(nx, ny);
  return length < 1e-9 ? { x: 0, y: 1 } : { x: nx / length, y: ny / length };
}
function kindOf(feature: ElevationFeature): ElevationKind {
  if (feature.kind) return feature.kind;
  return feature.tier < 0 ? 'valley' : 'plateau';
}
function edgeOf(feature: ElevationFeature): number {
  return Math.max(4, feature.edge ?? (feature.kind === 'overhang' ? OVERHANG_EDGE : DEFAULT_EDGE));
}
/** The south rim of an overhang occludes the shelf below it. */
function overhangOccluder(face: Omit<ElevationFace, 'occluder'>): OccluderVolume | undefined {
  if (face.kind !== 'overhang') return undefined;
  if (face.shape === 'rect') {
    return { x: face.x - 4, y: face.y + face.h - 4, width: face.w + 8, height: face.edge + 34 };
  }
  return { x: face.x - face.r, y: face.y, width: face.r * 2, height: face.r + face.edge + 30 };
}

/** A zone's compiled elevation field. Construct via `elevationSite(zone, spec)`. */
export class ElevationSite {
  readonly zoneId: string;
  readonly rect: { x: number; y: number; w: number; h: number };
  readonly seed: number;
  readonly noise: number;
  private readonly features: CompiledFeature[];
  private readonly ramps: CompiledRamp[];
  readonly faces: readonly ElevationFace[];
  readonly rampViews: readonly ElevationRampView[];

  constructor(zone: AtlasZone, spec: ElevationSpec | undefined) {
    const origin = CONTINENTS[zone.continent].origin;
    this.zoneId = zone.id;
    this.rect = { x: zone.rect.x + origin.x, y: zone.rect.y + origin.y, w: zone.rect.w, h: zone.rect.h };
    this.seed = spec?.seed ?? seedFor(zone.id);
    this.noise = spec?.noise ?? 9;
    const { x, y, w, h } = this.rect;
    this.features = (spec?.features ?? []).map(feature => {
      const shape = feature.shape ?? 'rect';
      const face: Omit<ElevationFace, 'occluder'> = shape === 'disc'
        ? { shape, x: x + feature.nx * w, y: y + feature.ny * h, w: 0, h: 0,
            r: (feature.nr ?? 0) * Math.min(w, h), tier: feature.tier, edge: edgeOf(feature), kind: kindOf(feature) }
        : { shape, x: x + feature.nx * w, y: y + feature.ny * h, w: (feature.nw ?? 0) * w,
            h: (feature.nh ?? 0) * h, r: 0, tier: feature.tier, edge: edgeOf(feature), kind: kindOf(feature) };
      const sd = shape === 'disc' ? discSD(face.x, face.y, face.r)
        : rectSD(face.x + face.w / 2, face.y + face.h / 2, face.w / 2, face.h / 2);
      return Object.freeze({ ...face, occluder: overhangOccluder(face), sd });
    });
    this.faces = Object.freeze(this.features.map(({ sd: _sd, ...face }) => Object.freeze(face)));
    const tierAtFeatures = (wx: number, wy: number) => {
      let tier = 0;
      for (const f of this.features) if (f.sd(wx, wy) < 0) tier = f.tier;
      return tier;
    };
    this.ramps = (spec?.ramps ?? []).map(ramp => {
      const x1 = x + ramp.nx * w, y1 = y + ramp.ny * h;
      const x2 = x + ramp.nx2 * w, y2 = y + ramp.ny2 * h;
      const { sd, t } = capsule(x1, y1, x2, y2, Math.max(6, ramp.width) / 2);
      return Object.freeze({
        x1, y1, x2, y2, width: Math.max(6, ramp.width),
        fromTier: ramp.fromTier ?? tierAtFeatures(x1, y1),
        toTier: ramp.toTier ?? tierAtFeatures(x2, y2),
        sd, t,
      });
    });
    this.rampViews = Object.freeze(this.ramps.map(({ sd: _sd, t: _t, ...view }) => Object.freeze(view)));
  }

  /** Discrete tier at a point. Ramps interpolate smoothly; features are steps. */
  tierAt(x: number, y: number): number {
    for (const ramp of this.ramps) {
      if (ramp.sd(x, y) < 0) return ramp.fromTier + (ramp.toTier - ramp.fromTier) * ramp.t(x, y);
    }
    let tier = 0;
    for (const f of this.features) if (f.sd(x, y) < 0) tier = f.tier;
    return tier;
  }

  /** Continuous height: tier steps on the low side of each edge plus bounded noise. */
  heightAt(x: number, y: number): number {
    for (const ramp of this.ramps) {
      if (ramp.sd(x, y) < 0) {
        const t = smoothstep(0, 1, ramp.t(x, y));
        return (ramp.fromTier + (ramp.toTier - ramp.fromTier) * t) * ELEVATION_TIER_HEIGHT
          + this.noiseAt(x, y) * .4;
      }
    }
    let height = 0;
    for (const f of this.features) {
      const sd = f.sd(x, y);
      // The face slope sits on the low side of the edge: outside the footprint
      // for raised features, inside the rim for valleys.
      const w = f.tier > 0 ? 1 - smoothstep(0, f.edge, sd) : 1 - smoothstep(-f.edge, 0, sd);
      height += f.tier * w;
    }
    return height * ELEVATION_TIER_HEIGHT + this.noiseAt(x, y);
  }

  private noiseAt(x: number, y: number): number {
    if (this.noise <= 0) return 0;
    return (noise2(x / 260, y / 260, this.seed) - .5) * this.noise
      + (noise2(x / 57, y / 57, this.seed ^ 0x9e3779b9) - .5) * this.noise * .35;
  }

  /** True when a circle at (x,y) straddles a tier discontinuity (a cliff edge or
   * a ramp side ledge). The provider ORs this into `blocked`. */
  blockedAt(x: number, y: number, radius: number): boolean {
    if (radius <= 0) return false;
    return this.straddles(this.features, x, y, radius) || this.straddles(this.ramps, x, y, radius);
  }

  /** A circle straddling a shape's edge probes across it along the outward normal;
   * a tier jump means the edge is a cliff face, not a walkable contour. */
  private straddles(shapes: readonly { sd: (x: number, y: number) => number }[],
    x: number, y: number, radius: number): boolean {
    for (const shape of shapes) {
      const sd = shape.sd(x, y);
      if (Math.abs(sd) >= radius) continue;
      const n = normalOf(shape.sd, x, y);
      const reach = Math.abs(sd) + PROBE;
      const inTier = this.tierAt(x - n.x * reach, y - n.y * reach);
      const outTier = this.tierAt(x + n.x * reach, y + n.y * reach);
      if (Math.abs(inTier - outTier) > ELEVATION_TIER_THRESHOLD) return true;
    }
    return false;
  }

  /** Compiled content overlapping a world rect (renderer + provider broad phase). */
  region(x: number, y: number, width: number, height: number): ElevationRegion {
    const faces = this.faces.filter(face => {
      const reach = face.edge + 8;
      const left = face.shape === 'disc' ? face.x - face.r : face.x;
      const top = face.shape === 'disc' ? face.y - face.r : face.y;
      const fw = face.shape === 'disc' ? face.r * 2 : face.w;
      const fh = face.shape === 'disc' ? face.r * 2 : face.h;
      return left - reach < x + width && left + fw + reach > x
        && top - reach < y + height && top + fh + reach > y;
    });
    const ramps = this.rampViews.filter(ramp => {
      const half = ramp.width / 2 + 4;
      const left = Math.min(ramp.x1, ramp.x2) - half, right = Math.max(ramp.x1, ramp.x2) + half;
      const top = Math.min(ramp.y1, ramp.y2) - half, bottom = Math.max(ramp.y1, ramp.y2) + half;
      return left < x + width && right > x && top < y + height && bottom > y;
    });
    return { faces, ramps };
  }
}

/** Compile a zone's spec. Cheap; callers that sample per frame should keep the site. */
export function elevationSite(zone: AtlasZone, spec: ElevationSpec | undefined): ElevationSite {
  return new ElevationSite(zone, spec);
}

// ── Free functions (single-site queries) ─────────────────────────────────────
/** Continuous height at a world point; 0 when the site is null. */
export function elevationAt(site: ElevationSite | null, x: number, y: number): number {
  return site ? site.heightAt(x, y) : 0;
}
/** Discrete tier at a world point; 0 when the site is null. */
export function elevationTier(site: ElevationSite | null, x: number, y: number): number {
  return site ? site.tierAt(x, y) : 0;
}
/** Point collision contribution: true when the circle straddles a cliff edge. */
export function elevationBlockedAt(site: ElevationSite | null, x: number, y: number, radius: number): boolean {
  return site ? site.blockedAt(x, y, radius) : false;
}

type SiteResolver = (x: number, y: number) => ElevationSite | null;
const resolverOf = (site: ElevationSite | SiteResolver | null): SiteResolver =>
  typeof site === 'function' ? site : () => site;

/** Segment collision contribution: true when the path crosses a cliff edge.
 * Samples tiers along the segment; ramps read as continuous slopes, so crossing
 * a cliff through a ramp corridor is legal. Null sites contribute tier 0 — ocean
 * blocking stays the provider's own rule. */
export function elevationBlocked(site: ElevationSite | SiteResolver | null,
  ax: number, ay: number, bx: number, by: number): boolean {
  const resolve = resolverOf(site);
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / SEGMENT_STEP));
  let previous = elevationTier(resolve(ax, ay), ax, ay);
  for (let i = 1; i <= steps; i++) {
    const x = ax + (bx - ax) * i / steps, y = ay + (by - ay) * i / steps;
    const tier = elevationTier(resolve(x, y), x, y);
    if (Math.abs(tier - previous) > ELEVATION_TIER_THRESHOLD) return true;
    previous = tier;
  }
  return false;
}

/** Move with elevation collision: sub-stepped like WorldLandscape.move, preserving
 * the unblocked axis so movers slide along cliff faces. `blocked` is the caller's
 * non-elevation point query (props, buildings, ocean); elevation adds its own
 * segment and straddle checks. */
export function elevationMove(site: ElevationSite | SiteResolver | null,
  x: number, y: number, dx: number, dy: number, radius: number,
  blocked: (x: number, y: number, radius: number) => boolean): { x: number; y: number } {
  const resolve = resolverOf(site);
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
  const sx = dx / steps, sy = dy / steps;
  const clear = (ax: number, ay: number, bx: number, by: number): boolean =>
    !elevationBlocked(resolve, ax, ay, bx, by)
    && !elevationBlockedAt(resolve(bx, by), bx, by, radius)
    && !elevationBlockedAt(resolve((ax + bx) / 2, (ay + by) / 2), (ax + bx) / 2, (ay + by) / 2, radius)
    && !blocked(bx, by, radius);
  for (let i = 0; i < steps; i++) {
    if (clear(x, y, x + sx, y + sy)) { x += sx; y += sy; }
    else if (Math.abs(sx) >= Math.abs(sy)) {
      if (clear(x, y, x + sx, y)) x += sx;
      if (clear(x, y, x, y + sy)) y += sy;
    } else {
      if (clear(x, y, x, y + sy)) y += sy;
      if (clear(x, y, x + sx, y)) x += sx;
    }
  }
  return { x, y };
}

// ── Whole-world field (the provider's entry point) ───────────────────────────
/** Resolves atlas zones to compiled sites and answers elevation queries across
 * zone borders. `specOf` maps a zone id to its authored spec — typically
 * `id => ZONE_CONTENT[id]?.elevation`. Sites recompile when the spec object
 * identity changes, so a mutated registry never serves stale geometry. */
export class ElevationField {
  private readonly sites = new Map<string, { spec: ElevationSpec | undefined; site: ElevationSite }>();
  private readonly specOf: (zoneId: string) => ElevationSpec | undefined;
  /** One-zone memo: movement/LOS queries sample thousands of points inside the
   * same zone rect, so the last hit answers without a zoneAt + map lookup. */
  private last: { zone: AtlasZone; rect: { x: number; y: number; w: number; h: number }; spec: ElevationSpec | undefined; site: ElevationSite } | null = null;
  constructor(specOf: (zoneId: string) => ElevationSpec | undefined) { this.specOf = specOf; }

  siteAt(x: number, y: number): ElevationSite | null {
    const last = this.last;
    if (last && x >= last.rect.x && x < last.rect.x + last.rect.w && y >= last.rect.y && y < last.rect.y + last.rect.h) {
      // Spec identity can change under test overrides; verify before serving.
      if (this.specOf(last.zone.id) === last.spec) return last.site;
    }
    const zone = zoneAt(x, y);
    if (!zone) return null;
    const spec = this.specOf(zone.id);
    const cached = this.sites.get(zone.id);
    if (cached && cached.spec === spec) {
      const origin = CONTINENTS[zone.continent].origin;
      this.last = { zone, rect: { x: zone.rect.x + origin.x, y: zone.rect.y + origin.y, w: zone.rect.w, h: zone.rect.h }, spec, site: cached.site };
      return cached.site;
    }
    const site = new ElevationSite(zone, spec);
    this.sites.set(zone.id, { spec, site });
    const origin = CONTINENTS[zone.continent].origin;
    this.last = { zone, rect: { x: zone.rect.x + origin.x, y: zone.rect.y + origin.y, w: zone.rect.w, h: zone.rect.h }, spec, site };
    return site;
  }

  elevationAt(x: number, y: number): number { return elevationAt(this.siteAt(x, y), x, y); }
  elevationTier(x: number, y: number): number { return elevationTier(this.siteAt(x, y), x, y); }
  blockedAt(x: number, y: number, radius: number): boolean {
    return elevationBlockedAt(this.siteAt(x, y), x, y, radius);
  }
  blocked(ax: number, ay: number, bx: number, by: number): boolean {
    return elevationBlocked((x, y) => this.siteAt(x, y), ax, ay, bx, by);
  }
  move(x: number, y: number, dx: number, dy: number, radius: number,
    blocked: (x: number, y: number, radius: number) => boolean): { x: number; y: number } {
    return elevationMove((x, y) => this.siteAt(x, y), x, y, dx, dy, radius, blocked);
  }
  region(x: number, y: number, width: number, height: number): ElevationRegion {
    const faces: ElevationFace[] = [], ramps: ElevationRampView[] = [];
    for (const zone of Object.values(ZONES)) {
      const origin = CONTINENTS[zone.continent].origin;
      const rect = { x: zone.rect.x + origin.x, y: zone.rect.y + origin.y, w: zone.rect.w, h: zone.rect.h };
      if (rect.x >= x + width || rect.x + rect.w <= x || rect.y >= y + height || rect.y + rect.h <= y) continue;
      const spec = this.specOf(zone.id);
      if (!spec) continue;
      const cached = this.sites.get(zone.id);
      const site = cached && cached.spec === spec ? cached.site : new ElevationSite(zone, spec);
      if (!cached || cached.spec !== spec) this.sites.set(zone.id, { spec, site });
      const part = site.region(x, y, width, height);
      faces.push(...part.faces); ramps.push(...part.ramps);
    }
    return { faces, ramps };
  }
}
