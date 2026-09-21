/** Transport runtime (wayfinder world-t04): rideable ships/zeppelins/turtle
 * boats/the tram on the atlas TRANSPORTS schedule, point-to-point portals, and
 * the flight-master taxi network. Vehicles are pure functions of sim time — no
 * per-vehicle state — so the 120 Hz sim stays deterministic.
 *
 * Durable boundary: boarding, disembarking, portal hops and flight unlocks all
 * stage a checkpoint → persist → commit, matching travel-command.ts. The sim
 * pins the player to the vehicle each tick; arrival raises `transportArrival`
 * for the host to disembark through LocationController. */
import type { CharacterCheckpoint } from './character-save.ts';
import type { WorldQuery } from './model.ts';
import type { Simulation } from './simulation.ts';
import type { AtlasPoint } from './world-atlas.ts';
import {
  TRANSPORT_RULES, VEHICLE_DEFS, dockEtaSec, factionAllowed, flightPoint, flightPoints,
  isVehicleKind, planFlight, playerFaction, polylineAt, transportRoute, transportRoutes, vehicleAt,
  type FlightPlan, type FlightPoint, type ResolvedRoute, type VehicleDef,
} from './transport-content.ts';

export type TransportRide =
  | { readonly kind: 'route'; readonly routeId: string; readonly boardedAt: 'from' | 'to' }
  | { readonly kind: 'flight'; readonly path: readonly AtlasPoint[]; readonly distance: number; readonly durationSec: number; elapsed: number };

export interface TransportArrival {
  /** Display name of the dock the vehicle is parked at. */
  readonly dock: string;
  readonly x: number;
  readonly y: number;
}

/** The slice of Simulation the transport runtime touches. */
export type TransportHost = Pick<Simulation, 'player' | 'world' | 'time' | 'travel' | 'relocate' | 'captureCheckpoint'>
  & { transportRide: TransportRide | null; transportArrival: TransportArrival | null };

type Result = { ok: boolean; message: string };
type Persist = (checkpoint: CharacterCheckpoint) => Result | Promise<Result>;

// ── Per-tick ride advance ────────────────────────────────────────────────────
/** Fixed-step hook called from Simulation.step: the vehicle is a moving
 * platform, so the player's position follows it exactly. Arrival (docked at the
 * far dock / flight complete) raises `transportArrival` and holds the player on
 * the dock until the host persists the disembark. */
export function advanceTransport(sim: TransportHost, dt: number): void {
  const ride = sim.transportRide;
  if (!ride) return;
  const p = sim.player;
  if (p.dead) { sim.transportRide = null; sim.transportArrival = null; return; }
  if (ride.kind === 'flight') {
    ride.elapsed = Math.min(ride.durationSec, ride.elapsed + dt);
    const point = polylineAt(ride.path, ride.distance * (ride.durationSec > 0 ? ride.elapsed / ride.durationSec : 1));
    p.x = point.x; p.y = point.y; p.vx = p.vy = 0;
    sim.transportArrival = ride.elapsed + 1e-9 >= ride.durationSec ? { dock: 'Flight destination', x: point.x, y: point.y } : null;
    return;
  }
  const route = transportRoute(ride.routeId);
  if (!route) { sim.transportRide = null; sim.transportArrival = null; return; }
  const state = vehicleAt(route, sim.time);
  p.x = state.x; p.y = state.y; p.vx = p.vy = 0;
  const destination = ride.boardedAt === 'from' ? 'to' : 'from';
  sim.transportArrival = state.dockedAt === destination
    ? { dock: route.spec.transport[destination].dock, x: state.x, y: state.y }
    : null;
}

// ── Landing ──────────────────────────────────────────────────────────────────
/** Bounded spiral search for a walkable landing beside a dock. Unlike
 * portalLanding there is no level constraint: docks are fixed authored points. */
export function dockLanding(world: WorldQuery, point: AtlasPoint, radius: number): AtlasPoint | null {
  const valid = (x: number, y: number) => Number.isFinite(x) && Number.isFinite(y)
    && Math.abs(x) <= 4e7 && Math.abs(y) <= 4e7 && !world.blocked(x, y, radius);
  if (valid(point.x, point.y)) return { x: point.x, y: point.y };
  for (let r = 16; r <= TRANSPORT_RULES.landingSearch; r += 16) for (let i = 0; i < 16; i++) {
    const x = point.x + Math.cos(i * Math.PI / 8) * r, y = point.y + Math.sin(i * Math.PI / 8) * r;
    if (valid(x, y)) return { x, y };
  }
  return null;
}

function departureProblem(sim: TransportHost): string | null {
  const p = sim.player;
  if (p.dead) return 'You cannot travel while defeated.';
  if (p.attack || p.castTime > 0 || p.dash || p.dodgeTime > 0) return 'Stand still to board.';
  return null;
}

// ── Boarding / disembarking ──────────────────────────────────────────────────
/** The docked vehicle the player can board right now, if any. */
export function boardableVehicle(sim: TransportHost): { route: ResolvedRoute; end: 'from' | 'to'; vehicle: VehicleDef } | null {
  const p = sim.player;
  for (const route of transportRoutes()) {
    const kind = route.spec.transport.kind;
    if (!isVehicleKind(kind)) continue;
    const state = vehicleAt(route, sim.time);
    if (!state.dockedAt) continue;
    if (Math.hypot(p.x - state.x, p.y - state.y) <= TRANSPORT_RULES.reach)
      return { route, end: state.dockedAt, vehicle: VEHICLE_DEFS[kind] };
  }
  return null;
}

/** Board a docked ship/zeppelin/turtle/tram: checkpoint at the dock, persist,
 * then mount the platform. The ride itself is live state — a reload lands at
 * the dock. */
export async function boardTransport(sim: TransportHost, routeId: string, persist: Persist): Promise<Result> {
  const route = transportRoute(routeId);
  if (!route || !isVehicleKind(route.spec.transport.kind)) return { ok: false, message: 'That route is not a vehicle.' };
  if (sim.transportRide) return { ok: false, message: 'You are already aboard.' };
  const problem = departureProblem(sim);
  if (problem) return { ok: false, message: problem };
  if (!factionAllowed(route.spec.transport.faction, playerFaction(sim.player.character)))
    return { ok: false, message: 'The crew does not take your faction.' };
  const state = vehicleAt(route, sim.time);
  if (!state.dockedAt) return { ok: false, message: 'It has already departed.' };
  if (Math.hypot(sim.player.x - state.x, sim.player.y - state.y) > TRANSPORT_RULES.reach)
    return { ok: false, message: 'Move to the dock to board.' };
  const checkpoint = sim.captureCheckpoint();
  const result = await persist(checkpoint);
  if (!result.ok) return result;
  const boardedAt = state.dockedAt;
  // relocate clears the ride field, so land on the deck first, then mount.
  sim.relocate(state.x, state.y);
  sim.transportRide = { kind: 'route', routeId, boardedAt };
  sim.transportArrival = null;
  const destination = route.spec.transport[boardedAt === 'from' ? 'to' : 'from'];
  return { ok: true, message: `Aboard — bound for ${destination.dock}.` };
}

/** Leave the vehicle while it is docked at either endpoint. Arrival at the far
 * dock raises `transportArrival`; the host calls this through the durable
 * barrier. On persist failure the ride is dropped — the player stays on the
 * dock rather than being carried back out. */
export async function disembarkTransport(sim: TransportHost, persist: Persist): Promise<Result> {
  const ride = sim.transportRide;
  if (!ride) return { ok: false, message: 'You are not aboard a transport.' };
  let dock: string, point: AtlasPoint;
  if (ride.kind === 'flight') {
    if (!sim.transportArrival) return { ok: false, message: 'Still airborne.' };
    dock = sim.transportArrival.dock;
    point = ride.path[ride.path.length - 1];
  } else {
    const route = transportRoute(ride.routeId)!;
    const state = vehicleAt(route, sim.time);
    if (!state.dockedAt) return { ok: false, message: 'You can only disembark at a dock.' };
    dock = route.spec.transport[state.dockedAt].dock;
    point = { x: state.x, y: state.y };
  }
  const landing = dockLanding(sim.world, point, sim.player.radius);
  if (!landing) return { ok: false, message: 'No room to disembark.' };
  const checkpoint = sim.captureCheckpoint();
  checkpoint.x = landing.x; checkpoint.y = landing.y;
  const result = await persist(checkpoint);
  if (!result.ok) { sim.transportRide = null; sim.transportArrival = null; return result; }
  sim.transportRide = null; sim.transportArrival = null;
  sim.relocate(landing.x, landing.y);
  return { ok: true, message: dock };
}

// ── Portals ──────────────────────────────────────────────────────────────────
/** The portal pad the player can use right now, if any. Portals are
 * bidirectional: either endpoint teleports to the other. */
export function portalAt(sim: TransportHost): { route: ResolvedRoute; end: 'from' | 'to' } | null {
  const p = sim.player;
  for (const route of transportRoutes('portal')) {
    const [a, b] = route.points;
    if (Math.hypot(p.x - a.x, p.y - a.y) <= TRANSPORT_RULES.reach) return { route, end: 'from' };
    if (Math.hypot(p.x - b.x, p.y - b.y) <= TRANSPORT_RULES.reach) return { route, end: 'to' };
  }
  return null;
}

/** Instant point-to-point portal hop through the durable checkpoint path. */
export async function executeTransportPortal(sim: TransportHost, routeId: string, persist: Persist): Promise<Result> {
  const route = transportRoute(routeId);
  if (!route || route.spec.transport.kind !== 'portal') return { ok: false, message: 'That route is not a portal.' };
  if (sim.transportRide) return { ok: false, message: 'Disembark first.' };
  const problem = departureProblem(sim);
  if (problem) return { ok: false, message: problem };
  if (!factionAllowed(route.spec.transport.faction, playerFaction(sim.player.character)))
    return { ok: false, message: 'The portal is not attuned to your faction.' };
  const near = portalAt(sim);
  if (!near || near.route.spec.transport.id !== routeId) return { ok: false, message: 'The portal is out of reach.' };
  const target = route.points[near.end === 'from' ? 1 : 0];
  const landing = dockLanding(sim.world, target, sim.player.radius);
  if (!landing) return { ok: false, message: 'The far side is blocked.' };
  const checkpoint = sim.captureCheckpoint();
  checkpoint.x = landing.x; checkpoint.y = landing.y;
  const result = await persist(checkpoint);
  if (!result.ok) return result;
  sim.relocate(landing.x, landing.y);
  return { ok: true, message: route.spec.transport[near.end === 'from' ? 'to' : 'from'].dock };
}

// ── Flight paths ─────────────────────────────────────────────────────────────
/** The flight master the player can talk to right now, if any. */
export function flightMasterAt(sim: TransportHost): FlightPoint | null {
  const p = sim.player, faction = playerFaction(p.character);
  let best: FlightPoint | null = null, bestDistance: number = TRANSPORT_RULES.reach;
  for (const point of flightPoints()) {
    if (!factionAllowed(point.faction, faction)) continue;
    const distance = Math.hypot(p.x - point.x, p.y - point.y);
    if (distance <= bestDistance) { best = point; bestDistance = distance; }
  }
  return best;
}

export function unlockedFlightPoints(travel: { flightPaths?: readonly string[] }): readonly string[] {
  return travel.flightPaths ?? [];
}

/** Discover a flight master: the unlock is a durable travel-state mutation. */
export async function unlockFlight(sim: TransportHost, masterId: string, persist: Persist): Promise<Result> {
  const master = flightPoint(masterId);
  if (!master) return { ok: false, message: 'No such flight master.' };
  const known = unlockedFlightPoints(sim.travel);
  if (known.includes(masterId)) return { ok: true, message: `${master.name} is already known.` };
  const near = flightMasterAt(sim);
  if (!near || near.id !== masterId) return { ok: false, message: 'The flight master is out of reach.' };
  const checkpoint = sim.captureCheckpoint();
  checkpoint.travel = { ...sim.travel, flightPaths: [...known, masterId] };
  const result = await persist(checkpoint);
  if (!result.ok) return result;
  sim.travel = checkpoint.travel;
  return { ok: true, message: `Flight path learned — ${master.name}.` };
}

/** Destinations reachable from a master through the faction-filtered taxi graph. */
export function flightDestinations(sim: TransportHost, masterId: string): { point: FlightPoint; plan: FlightPlan }[] {
  const faction = playerFaction(sim.player.character), known = unlockedFlightPoints(sim.travel);
  const out: { point: FlightPoint; plan: FlightPlan }[] = [];
  for (const id of known) {
    if (id === masterId) continue;
    const point = flightPoint(id)!;
    const plan = planFlight(masterId, id, faction);
    if (plan) out.push({ point, plan });
  }
  return out.sort((a, b) => a.plan.durationSec - b.plan.durationSec);
}

/** Start a taxi ride: both endpoints must be unlocked, then the player rides a
 * computed polyline in real time (bounded by the atlas hop durations). */
export async function startFlight(sim: TransportHost, fromId: string, toId: string, persist: Persist): Promise<Result> {
  if (sim.transportRide) return { ok: false, message: 'You are already aboard.' };
  const problem = departureProblem(sim);
  if (problem) return { ok: false, message: problem };
  const known = unlockedFlightPoints(sim.travel);
  if (!known.includes(fromId)) return { ok: false, message: 'You do not know this flight point.' };
  if (!known.includes(toId)) return { ok: false, message: 'You have not discovered that flight point.' };
  const near = flightMasterAt(sim);
  if (!near || near.id !== fromId) return { ok: false, message: 'Talk to the flight master first.' };
  const plan = planFlight(fromId, toId, playerFaction(sim.player.character));
  if (!plan) return { ok: false, message: 'No route connects those points.' };
  const checkpoint = sim.captureCheckpoint();
  const result = await persist(checkpoint);
  if (!result.ok) return result;
  sim.relocate(near.x, near.y);
  sim.transportRide = { kind: 'flight', path: plan.points, distance: plan.distance, durationSec: plan.durationSec, elapsed: 0 };
  sim.transportArrival = null;
  return { ok: true, message: `Flying to ${flightPoint(toId)!.name}.` };
}

// ── Presentation queries ─────────────────────────────────────────────────────
export interface VehicleMarker {
  readonly kind: 'ship' | 'zeppelin' | 'turtle' | 'tram' | 'flight';
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly label: string;
  readonly docked: boolean;
}
/** Vehicles inside a world rect — the renderer's draw list and map markers. */
export function vehiclesNear(sim: TransportHost, x: number, y: number, width: number, height: number): VehicleMarker[] {
  const out: VehicleMarker[] = [];
  for (const route of transportRoutes()) {
    const kind = route.spec.transport.kind;
    if (!isVehicleKind(kind)) continue;
    const state = vehicleAt(route, sim.time);
    if (state.x < x || state.x > x + width || state.y < y || state.y > y + height) continue;
    const spec = route.spec.transport;
    out.push({
      kind, x: state.x, y: state.y, angle: state.angle,
      label: `${VEHICLE_DEFS[kind].name} · ${spec.from.dock} ↔ ${spec.to.dock}`,
      docked: state.dockedAt !== null,
    });
  }
  const ride = sim.transportRide;
  if (ride?.kind === 'flight') {
    const p = sim.player;
    if (p.x >= x && p.x <= x + width && p.y >= y && p.y <= y + height) {
      const ahead = polylineAt(ride.path, ride.distance * Math.min(1, ride.elapsed / ride.durationSec) + 10);
      out.push({ kind: 'flight', x: p.x, y: p.y, angle: Math.atan2(ahead.y - p.y, ahead.x - p.x), label: 'Flight', docked: false });
    }
  }
  return out;
}

export interface TransportPrompt {
  readonly kind: 'board' | 'disembark' | 'portal' | 'flight' | 'wait';
  readonly label: string;
  readonly x: number;
  readonly y: number;
  /** Route or flight point id the prompt acts on. */
  readonly id: string;
}
/** The single transport interaction in reach of the player — docked vehicle,
 * portal pad or flight master — for the E-interact prompt and handler. */
export function transportPrompt(sim: TransportHost): TransportPrompt | null {
  const p = sim.player;
  const ride = sim.transportRide;
  if (ride) {
    if (ride.kind === 'flight')
      return sim.transportArrival ? { kind: 'disembark', label: 'Land', x: p.x, y: p.y, id: 'flight' } : null;
    const route = transportRoute(ride.routeId)!;
    const state = vehicleAt(route, sim.time);
    if (state.dockedAt) {
      const dock = route.spec.transport[state.dockedAt];
      return { kind: 'disembark', label: `Disembark at ${dock.dock}`, x: state.x, y: state.y, id: ride.routeId };
    }
    return null;
  }
  const board = boardableVehicle(sim);
  if (board) {
    const destination = board.route.spec.transport[board.end === 'from' ? 'to' : 'from'];
    const state = vehicleAt(board.route, sim.time);
    return { kind: 'board', label: `Board ${board.vehicle.name} — ${destination.dock}`, x: state.x, y: state.y, id: board.route.spec.transport.id };
  }
  const portal = portalAt(sim);
  if (portal) {
    const destination = portal.route.spec.transport[portal.end === 'from' ? 'to' : 'from'];
    const point = portal.route.points[portal.end === 'from' ? 0 : 1];
    return { kind: 'portal', label: `Portal to ${destination.dock}`, x: point.x, y: point.y, id: portal.route.spec.transport.id };
  }
  const master = flightMasterAt(sim);
  if (master) {
    const known = unlockedFlightPoints(sim.travel).includes(master.id);
    return { kind: 'flight', label: known ? `${master.name} — Flight Master` : `Discover flight path — ${master.name}`, x: master.x, y: master.y, id: master.id };
  }
  // A dock with no vehicle parked still advertises the next departure.
  for (const route of transportRoutes()) {
    if (!isVehicleKind(route.spec.transport.kind)) continue;
    for (const end of ['from', 'to'] as const) {
      const point = route.points[end === 'from' ? 0 : 1];
      if (Math.hypot(p.x - point.x, p.y - point.y) > TRANSPORT_RULES.reach) continue;
      const eta = Math.ceil(dockEtaSec(route, end, sim.time));
      const vehicle = VEHICLE_DEFS[route.spec.transport.kind as VehicleDef['kind']];
      return { kind: 'wait', label: `${vehicle.name} to ${route.spec.transport[end === 'from' ? 'to' : 'from'].dock} arrives in ${eta}s`, x: point.x, y: point.y, id: route.spec.transport.id };
    }
  }
  return null;
}
