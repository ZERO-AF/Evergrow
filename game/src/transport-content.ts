/** Authored transport content (wayfinder world-t04): resolves the atlas
 * TRANSPORTS table into rideable routes — dock positions come from each zone's
 * authored docks/flightpaths/cities — plus vehicle silhouettes, schedules and
 * the flight-master taxi network. Positions are zone-local normalized
 * coordinates resolved to world space through the atlas (zonePoint). */
import {
  TRANSPORTS, ZONES, zonePoint, type AtlasPoint, type AtlasTransport,
  type AtlasZone, type ContinentId, type FactionId,
} from './world-atlas.ts';
import type { WowRaceId } from './wow-types.ts';

export const TRANSPORT_RULES = Object.freeze({
  /** Seconds a ship/zeppelin/turtle/tram waits at each dock (WoW ~45–60s). */
  dwellSec: 45,
  /** Player must be this close to a docked vehicle or portal pad to use it. */
  reach: 120,
  /** Bounded spiral search radius for a walkable landing beside a dock. */
  landingSearch: 96,
});

// ── Endpoint resolution ──────────────────────────────────────────────────────
/** Endpoint positions for route endpoints the atlas does not author as a
 * dock/flightpath/city/dungeon — keyed `zone:name` in zone-local normalized
 * coordinates. The Dark Portal is a world landmark, not a settlement. */
const ENDPOINT_OVERRIDES: Readonly<Record<string, { nx: number; ny: number }>> = Object.freeze({
  'blasted-lands:The Dark Portal': Object.freeze({ nx: 0.5, ny: 0.85 }),
  'hellfire:The Dark Portal': Object.freeze({ nx: 0.85, ny: 0.5 }),
});
/** A route endpoint names a dock, flight master, city or dungeon inside its
 * zone; the atlas carries normalized positions for all of them. */
function endpointPoint(zone: AtlasZone, name: string): { nx: number; ny: number; faction: FactionId } | null {
  const found = zone.docks.find(d => d.name === name)
    ?? zone.flightpaths.find(f => f.name === name)
    ?? zone.cities.find(c => c.name === name)
    ?? zone.dungeons.find(d => d.name === name);
  if (found) return { nx: found.nx, ny: found.ny, faction: 'faction' in found ? found.faction : zone.faction };
  const override = ENDPOINT_OVERRIDES[`${zone.id}:${name}`];
  return override ? { ...override, faction: zone.faction } : null;
}

export interface RouteSpec {
  readonly transport: AtlasTransport;
  readonly from: AtlasPoint;
  readonly to: AtlasPoint;
  readonly fromFaction: FactionId;
  readonly toFaction: FactionId;
}
export interface ResolvedRoute {
  readonly spec: RouteSpec;
  /** World-space polyline endpoints (from dock → to dock). */
  readonly points: readonly AtlasPoint[];
  readonly length: number;
  /** Full out-and-back cycle: dwell + sail + dwell + return. */
  readonly cycleSec: number;
  /** Deterministic per-route phase so the fleet is not synchronized. */
  readonly offsetSec: number;
}
const routeCache = new Map<string, ResolvedRoute | null>();
function routeOffset(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (Math.imul(hash, 31) + id.charCodeAt(i)) >>> 0;
  return hash % 997;
}
/** Resolve a TRANSPORTS id to world-space endpoints, length and schedule.
 * Returns null when an endpoint name has no authored position in its zone. */
export function transportRoute(id: string): ResolvedRoute | null {
  if (routeCache.has(id)) return routeCache.get(id)!;
  const t = TRANSPORTS.find(candidate => candidate.id === id);
  let resolved: ResolvedRoute | null = null;
  if (t) {
    const fromZone = ZONES[t.from.zone], toZone = ZONES[t.to.zone];
    const from = fromZone && endpointPoint(fromZone, t.from.dock);
    const to = toZone && endpointPoint(toZone, t.to.dock);
    const a = from && zonePoint(t.from.zone, from.nx, from.ny);
    const b = to && zonePoint(t.to.zone, to.nx, to.ny);
    if (a && b) {
      const spec: RouteSpec = Object.freeze({ transport: t, from: a, to: b, fromFaction: from!.faction, toFaction: to!.faction });
      resolved = Object.freeze({
        spec, points: Object.freeze([a, b]), length: Math.hypot(b.x - a.x, b.y - a.y),
        cycleSec: TRANSPORT_RULES.dwellSec * 2 + t.durationSec * 2, offsetSec: routeOffset(id),
      });
    }
  }
  routeCache.set(id, resolved);
  return resolved;
}
/** Iterate resolved routes, optionally filtered by transport kind. */
export function* transportRoutes(kind?: AtlasTransport['kind']): Generator<ResolvedRoute> {
  for (const t of TRANSPORTS) {
    const route = transportRoute(t.id);
    if (route && (!kind || t.kind === kind)) yield route;
  }
}

// ── Vehicles ─────────────────────────────────────────────────────────────────
export type VehicleKind = 'ship' | 'zeppelin' | 'turtle' | 'tram';
export interface VehicleDef {
  readonly kind: VehicleKind;
  readonly name: string;
  /** Deck half-extent; the boarding zone around the docked vehicle. */
  readonly radius: number;
  /** Silhouette palette consumed by transport-art. */
  readonly hull: string;
  readonly accent: string;
}
export const VEHICLE_DEFS: Readonly<Record<VehicleKind, VehicleDef>> = Object.freeze({
  ship: Object.freeze({ kind: 'ship', name: 'Ship', radius: 90, hull: '#5d4a33', accent: '#8fa3b8' }),
  zeppelin: Object.freeze({ kind: 'zeppelin', name: 'Zeppelin', radius: 80, hull: '#4a3b52', accent: '#c9a86a' }),
  turtle: Object.freeze({ kind: 'turtle', name: 'Turtle Boat', radius: 100, hull: '#4d5d43', accent: '#a8b88a' }),
  tram: Object.freeze({ kind: 'tram', name: 'Deeprun Tram', radius: 60, hull: '#3f3a33', accent: '#c9b06a' }),
});
export function isVehicleKind(kind: AtlasTransport['kind']): kind is VehicleKind {
  return kind === 'ship' || kind === 'zeppelin' || kind === 'turtle' || kind === 'tram';
}

// ── Schedule ─────────────────────────────────────────────────────────────────
export type VehiclePhase = 'docked-from' | 'sailing' | 'docked-to' | 'returning';
export interface VehicleState {
  readonly route: ResolvedRoute;
  readonly phase: VehiclePhase;
  /** Endpoint the vehicle is docked at; null while sailing. */
  readonly dockedAt: 'from' | 'to' | null;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  /** 0..1 progress along the current leg. */
  readonly progress: number;
  /** Seconds until the next phase change. */
  readonly nextInSec: number;
}
/** Pure schedule lookup: where the vehicle on a route is at sim time `time`. */
export function vehicleAt(route: ResolvedRoute, time: number): VehicleState {
  const dwell = TRANSPORT_RULES.dwellSec, duration = route.spec.transport.durationSec;
  const t = ((time + route.offsetSec) % route.cycleSec + route.cycleSec) % route.cycleSec;
  const [a, b] = route.points;
  const state = (phase: VehiclePhase, dockedAt: VehicleState['dockedAt'], x: number, y: number,
    progress: number, nextInSec: number): VehicleState => ({
    route, phase, dockedAt, x, y, progress, nextInSec,
    angle: phase === 'returning' ? Math.atan2(a.y - b.y, a.x - b.x) : Math.atan2(b.y - a.y, b.x - a.x),
  });
  if (t < dwell) return state('docked-from', 'from', a.x, a.y, 0, dwell - t);
  if (t < dwell + duration) {
    const k = (t - dwell) / duration;
    return state('sailing', null, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, k, dwell + duration - t);
  }
  if (t < dwell * 2 + duration) return state('docked-to', 'to', b.x, b.y, 1, dwell * 2 + duration - t);
  const k = (t - dwell * 2 - duration) / duration;
  return state('returning', null, b.x + (a.x - b.x) * k, b.y + (a.y - b.y) * k, k, route.cycleSec - t);
}
/** Seconds until the vehicle next docks at the given endpoint (for UI labels). */
export function dockEtaSec(route: ResolvedRoute, end: 'from' | 'to', time: number): number {
  const dwell = TRANSPORT_RULES.dwellSec, duration = route.spec.transport.durationSec;
  const t = ((time + route.offsetSec) % route.cycleSec + route.cycleSec) % route.cycleSec;
  const target = end === 'from' ? dwell : dwell * 2 + duration;
  return t <= target ? target - t : route.cycleSec - t + target;
}

/** Position at `distance` units along a polyline. */
export function polylineAt(points: readonly AtlasPoint[], distance: number): AtlasPoint {
  let remaining = Math.max(0, distance);
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1], seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg || i + 2 === points.length) {
      const k = seg > 0 ? Math.min(1, remaining / seg) : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    remaining -= seg;
  }
  return points[points.length - 1];
}
export function polylineLength(points: readonly AtlasPoint[]): number {
  let length = 0;
  for (let i = 0; i + 1 < points.length; i++) length += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  return length;
}

// ── Factions ─────────────────────────────────────────────────────────────────
/** Race → faction fallback until T05 lands `character.faction`. */
const RACE_FACTION: Readonly<Record<WowRaceId, 'alliance' | 'horde'>> = Object.freeze({
  human: 'alliance', dwarf: 'alliance', nightElf: 'alliance', gnome: 'alliance', draenei: 'alliance',
  orc: 'horde', undead: 'horde', tauren: 'horde', troll: 'horde', bloodElf: 'horde',
});
export function playerFaction(character: { raceId: WowRaceId; faction?: string }): 'alliance' | 'horde' | 'neutral' {
  const faction = character.faction;
  return faction === 'alliance' || faction === 'horde' ? faction : RACE_FACTION[character.raceId] ?? 'neutral';
}
/** 'neutral'/'contested'/'hostile' routes serve everyone; faction routes serve their own. */
export function factionAllowed(routeFaction: FactionId, faction: 'alliance' | 'horde' | 'neutral'): boolean {
  return routeFaction !== 'alliance' && routeFaction !== 'horde' || routeFaction === faction;
}

// ── Flight network ───────────────────────────────────────────────────────────
/** A taxi node: an atlas flightpath entry (or a named endpoint the flightpath
 * routes reference, e.g. Karazhan's dungeon master). */
export interface FlightPoint {
  readonly id: string;
  readonly name: string;
  readonly zone: string;
  readonly continent: ContinentId;
  readonly faction: FactionId;
  readonly x: number;
  readonly y: number;
}
const flightCache = new Map<string, FlightPoint | null>();
/** Resolve `zone:name` to a world-space flight point. */
export function flightPoint(id: string): FlightPoint | null {
  if (flightCache.has(id)) return flightCache.get(id)!;
  const split = id.indexOf(':');
  const zone = split > 0 ? ZONES[id.slice(0, split)] : undefined;
  const name = split > 0 ? id.slice(split + 1) : '';
  let resolved: FlightPoint | null = null;
  if (zone && name) {
    const found = endpointPoint(zone, name);
    const point = found && zonePoint(zone.id, found.nx, found.ny);
    if (point) resolved = Object.freeze({ id, name, zone: zone.id, continent: zone.continent, faction: found!.faction, x: point.x, y: point.y });
  }
  flightCache.set(id, resolved);
  return resolved;
}
/** Every flight master in the atlas: zone flightpaths plus any endpoint the
 * flightpath routes reference (a few masters live at dungeons/cities). */
export function flightPoints(): readonly FlightPoint[] {
  const ids = new Set<string>();
  for (const zone of Object.values(ZONES)) for (const f of zone.flightpaths) ids.add(`${zone.id}:${f.name}`);
  for (const t of TRANSPORTS) if (t.kind === 'flightpath') {
    ids.add(`${t.from.zone}:${t.from.dock}`);
    ids.add(`${t.to.zone}:${t.to.dock}`);
  }
  return [...ids].map(id => flightPoint(id)).filter((p): p is FlightPoint => p !== null);
}
export function isFlightPointId(id: unknown): id is string {
  return typeof id === 'string' && id.indexOf(':') > 0 && flightPoint(id) !== null;
}

export interface FlightEdge { readonly to: string; readonly durationSec: number }
/** Directed taxi graph from the atlas flightpath routes; WoW taxis run both
 * ways, so each row contributes both directions. */
let edgeCache: ReadonlyMap<string, readonly FlightEdge[]> | null = null;
export function flightEdges(): ReadonlyMap<string, readonly FlightEdge[]> {
  if (edgeCache) return edgeCache;
  const edges = new Map<string, FlightEdge[]>();
  const link = (from: string, to: string, durationSec: number) => {
    if (!flightPoint(from) || !flightPoint(to)) return;
    (edges.get(from) ?? edges.set(from, []).get(from)!).push({ to, durationSec });
  };
  for (const t of TRANSPORTS) if (t.kind === 'flightpath') {
    const from = `${t.from.zone}:${t.from.dock}`, to = `${t.to.zone}:${t.to.dock}`;
    link(from, to, t.durationSec);
    link(to, from, t.durationSec);
  }
  edgeCache = new Map([...edges].map(([id, list]) => [id, Object.freeze(list)] as const));
  return edgeCache;
}

export interface FlightPlan {
  /** Ordered flight points, origin first, destination last. */
  readonly path: readonly FlightPoint[];
  /** World-space polyline the taxi follows. */
  readonly points: readonly AtlasPoint[];
  readonly distance: number;
  /** Sum of the atlas hop durations along the path. */
  readonly durationSec: number;
}
/** BFS over the taxi graph through nodes the faction may use. Endpoints must be
 * unlocked; intermediate waypoints only need to be faction-compatible. */
export function planFlight(fromId: string, toId: string, faction: 'alliance' | 'horde' | 'neutral'): FlightPlan | null {
  const from = flightPoint(fromId), to = flightPoint(toId);
  if (!from || !to || from === to || from.continent !== to.continent) return null;
  if (!factionAllowed(from.faction, faction) || !factionAllowed(to.faction, faction)) return null;
  const edges = flightEdges(), prev = new Map<string, string>(), queue = [from.id], seen = new Set([from.id]);
  while (queue.length) {
    const id = queue.shift()!;
    if (id === to.id) break;
    for (const edge of edges.get(id) ?? []) {
      if (seen.has(edge.to)) continue;
      const point = flightPoint(edge.to)!;
      if (!factionAllowed(point.faction, faction)) continue;
      seen.add(edge.to);
      prev.set(edge.to, id);
      queue.push(edge.to);
    }
  }
  if (!seen.has(to.id)) return null;
  const ids = [to.id];
  while (ids[0] !== from.id) ids.unshift(prev.get(ids[0])!);
  const path = ids.map(id => flightPoint(id)!);
  const points = Object.freeze(path.map(({ x, y }) => Object.freeze({ x, y })));
  let durationSec = 0;
  for (let i = 0; i + 1 < ids.length; i++)
    durationSec += edges.get(ids[i])!.find(edge => edge.to === ids[i + 1])!.durationSec;
  return Object.freeze({ path: Object.freeze(path), points, distance: polylineLength(points), durationSec });
}
