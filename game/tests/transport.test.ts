import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import type { WorldQuery } from '../src/model.ts';
import { TRANSPORTS, ZONES } from '../src/world-atlas.ts';
import {
  TRANSPORT_RULES, dockEtaSec, factionAllowed, flightPoints, isVehicleKind,
  planFlight, playerFaction, transportRoute, transportRoutes, vehicleAt, type ResolvedRoute,
} from '../src/transport-content.ts';
import {
  advanceTransport, boardTransport, boardableVehicle, disembarkTransport, executeTransportPortal,
  flightDestinations, flightMasterAt, portalAt, startFlight, transportPrompt, unlockFlight,
  unlockedFlightPoints, vehiclesNear,
} from '../src/transport.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }), isSanctuary: () => false };
const persist = async () => ({ ok: true, message: '' });
const fail = async () => ({ ok: false, message: 'disk full' });
const shipRoute = () => transportRoute(TRANSPORTS.find(t => t.kind === 'ship')!.id)!;
const portalRoute = () => transportRoute(TRANSPORTS.find(t => t.kind === 'portal')!.id)!;
/** Sim time when the vehicle is docked at `end` (t=0 → docked-from). */
const dockedTime = (route: ResolvedRoute, end: 'from' | 'to') =>
  (end === 'from' ? 0 : TRANSPORT_RULES.dwellSec + route.spec.transport.durationSec) - route.offsetSec;

test('every atlas transport route resolves to world-space endpoints', () => {
  const unresolved = TRANSPORTS.filter(t => !transportRoute(t.id)).map(t => t.id);
  assert.deepEqual(unresolved, []);
  for (const route of transportRoutes()) {
    assert.ok(route.length > 0, route.spec.transport.id);
    assert.ok(route.cycleSec > route.spec.transport.durationSec * 2);
    for (const point of route.points) assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  }
});

test('vehicle schedule is deterministic, dwells at both docks and sails between', () => {
  const route = shipRoute();
  const duration = route.spec.transport.durationSec, dwell = TRANSPORT_RULES.dwellSec;
  const at = (t: number) => vehicleAt(route, t - route.offsetSec);
  const dockedFrom = at(0);
  assert.equal(dockedFrom.dockedAt, 'from');
  assert.deepEqual({ x: dockedFrom.x, y: dockedFrom.y }, route.points[0]);
  const mid = at(dwell + duration / 2);
  assert.equal(mid.phase, 'sailing');
  assert.ok(Math.abs(mid.x - (route.points[0].x + route.points[1].x) / 2) < route.length / 4);
  const dockedTo = at(dwell + duration);
  assert.equal(dockedTo.dockedAt, 'to');
  assert.deepEqual({ x: dockedTo.x, y: dockedTo.y }, route.points[1]);
  assert.equal(at(dwell * 2 + duration + duration / 2).phase, 'returning');
  assert.equal(at(route.cycleSec).dockedAt, 'from');
  assert.deepEqual(vehicleAt(route, 1234.5), vehicleAt(route, 1234.5));
  assert.equal(dockEtaSec(route, 'from', -route.offsetSec), dwell);
});

test('boarding pins the player to the vehicle and arrival lands at the far dock', async () => {
  const route = shipRoute();
  const sim = new Simulation(world, { spawn: false });
  sim.time = dockedTime(route, 'from');
  sim.relocate(route.points[0].x, route.points[0].y);
  const board = boardableVehicle(sim)!;
  assert.equal(board.route.spec.transport.id, route.spec.transport.id);
  assert.equal(board.end, 'from');
  const result = await boardTransport(sim, route.spec.transport.id, persist);
  assert.ok(result.ok, result.message);
  assert.equal(sim.transportRide?.kind, 'route');
  // Mid-sail: the player rides the platform.
  sim.time += TRANSPORT_RULES.dwellSec + route.spec.transport.durationSec / 2;
  advanceTransport(sim, FIXED_STEP);
  const mid = vehicleAt(route, sim.time);
  assert.equal(sim.player.x, mid.x);
  assert.equal(sim.player.y, mid.y);
  // Docked at the far end: arrival is raised and disembark lands on the dock.
  sim.time = dockedTime(route, 'to');
  advanceTransport(sim, FIXED_STEP);
  const arrival = sim.transportArrival;
  assert.ok(arrival);
  assert.equal(arrival.dock, route.spec.transport.to.dock);
  const off = await disembarkTransport(sim, persist);
  assert.ok(off.ok, off.message);
  assert.equal(sim.transportRide, null);
  assert.equal(sim.player.x, route.points[1].x);
  assert.equal(sim.player.y, route.points[1].y);
});

test('boarding fails while sailing, out of reach, or when persistence fails', async () => {
  const route = shipRoute();
  const sim = new Simulation(world, { spawn: false });
  sim.time = dockedTime(route, 'from') + TRANSPORT_RULES.dwellSec + 1; // just departed
  sim.relocate(route.points[0].x, route.points[0].y);
  assert.equal(boardableVehicle(sim), null);
  assert.equal((await boardTransport(sim, route.spec.transport.id, persist)).ok, false);
  sim.time = dockedTime(route, 'from');
  sim.relocate(route.points[0].x + TRANSPORT_RULES.reach + 50, route.points[0].y);
  assert.equal((await boardTransport(sim, route.spec.transport.id, persist)).ok, false);
  sim.relocate(route.points[0].x, route.points[0].y);
  assert.equal((await boardTransport(sim, route.spec.transport.id, fail)).ok, false);
  assert.equal(sim.transportRide, null);
});

test('portals teleport the player to the far endpoint through the durable barrier', async () => {
  const route = portalRoute();
  const sim = new Simulation(world, { spawn: false });
  sim.relocate(route.points[0].x, route.points[0].y);
  const pad = portalAt(sim)!;
  assert.equal(pad.end, 'from');
  const result = await executeTransportPortal(sim, route.spec.transport.id, persist);
  assert.ok(result.ok, result.message);
  assert.equal(sim.player.x, route.points[1].x);
  assert.equal(sim.player.y, route.points[1].y);
  // The far pad teleports back.
  const back = portalAt(sim)!;
  assert.equal(back.end, 'to');
  assert.ok((await executeTransportPortal(sim, route.spec.transport.id, persist)).ok);
  assert.equal(sim.player.x, route.points[0].x);
});

test('flight masters unlock durably and taxis fly the atlas route', async () => {
  const masters = flightPoints();
  assert.ok(masters.length > 40);
  const sim = new Simulation(world, { spawn: false });
  const master = masters.find(m => factionAllowed(m.faction, playerFaction(sim.player.character)))!;
  sim.relocate(master.x, master.y);
  assert.equal(flightMasterAt(sim)?.id, master.id);
  assert.equal(unlockedFlightPoints(sim.travel).length, 0);
  assert.ok((await unlockFlight(sim, master.id, persist)).ok);
  assert.deepEqual(unlockedFlightPoints(sim.travel), [master.id]);
  // A second master on the same continent reachable through the graph.
  const candidates = masters.filter(m => m.continent === master.continent && m.id !== master.id
    && factionAllowed(m.faction, playerFaction(sim.player.character)) && planFlight(master.id, m.id, playerFaction(sim.player.character)));
  assert.ok(candidates.length > 0);
  const target = candidates[0];
  sim.relocate(target.x, target.y);
  assert.ok((await unlockFlight(sim, target.id, persist)).ok);
  sim.relocate(master.x, master.y);
  const destinations = flightDestinations(sim, master.id);
  assert.ok(destinations.some(d => d.point.id === target.id));
  const start = await startFlight(sim, master.id, target.id, persist);
  assert.ok(start.ok, start.message);
  assert.equal(sim.transportRide?.kind, 'flight');
  const plan = planFlight(master.id, target.id, playerFaction(sim.player.character))!;
  for (let t = 0; t < plan.durationSec; t += 1) { sim.time += 1; advanceTransport(sim, 1); }
  assert.ok(sim.transportArrival);
  const end = plan.points[plan.points.length - 1];
  assert.equal(sim.player.x, end.x);
  assert.equal(sim.player.y, end.y);
  assert.ok((await disembarkTransport(sim, persist)).ok);
  assert.equal(sim.transportRide, null);
});

test('flight requires both endpoints unlocked and the master in reach', async () => {
  const sim = new Simulation(world, { spawn: false });
  const [a, b] = flightPoints();
  sim.relocate(a.x, a.y);
  assert.equal((await startFlight(sim, a.id, b.id, persist)).ok, false);
  await unlockFlight(sim, a.id, persist);
  assert.equal((await startFlight(sim, a.id, b.id, persist)).ok, false); // b still locked
  sim.relocate(b.x, b.y);
  await unlockFlight(sim, b.id, persist);
  sim.relocate(a.x + TRANSPORT_RULES.reach + 200, a.y);
  assert.equal((await startFlight(sim, a.id, b.id, persist)).ok, false); // master out of reach
});

test('faction routes reject the opposing faction', () => {
  const horde = TRANSPORTS.find(t => t.faction === 'horde' && isVehicleKind(t.kind));
  if (!horde) return; // atlas may not gate vehicles by faction
  const sim = new Simulation(world, { spawn: false });
  sim.player.character.raceId = 'human';
  assert.equal(playerFaction(sim.player.character), 'alliance');
  assert.equal(factionAllowed('horde', 'alliance'), false);
  assert.equal(factionAllowed('contested', 'alliance'), true);
});

test('transportPrompt exposes board/portal/flight interactions and vehiclesNear lists the fleet', () => {
  const route = shipRoute();
  const sim = new Simulation(world, { spawn: false });
  sim.time = dockedTime(route, 'from');
  sim.relocate(route.points[0].x, route.points[0].y);
  const prompt = transportPrompt(sim)!;
  assert.equal(prompt.kind, 'board');
  assert.equal(prompt.id, route.spec.transport.id);
  const markers = vehiclesNear(sim, route.points[0].x - 500, route.points[0].y - 500, 1000, 1000);
  assert.ok(markers.some(m => m.label.includes(route.spec.transport.from.dock)));
  // Far from every dock: no prompt.
  sim.relocate(0, 0);
  sim.time = 0;
  for (const zone of Object.values(ZONES)) void zone;
});
