import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, zoneRect } from '../src/world-atlas.ts';
import { AuthoredWorld } from '../src/authored-world.ts';
import { zoneContent } from '../src/zone-content.ts';
import { generateSettlement } from '../src/settlements.ts';
import { settlementPlace } from '../src/world-geography.ts';
import { TRANSPORT_RULES, dockEtaSec, flightPoints, transportRoute, vehicleAt, type VehicleState } from '../src/transport-content.ts';
import { TRANSPORTS } from '../src/world-atlas.ts';
import { drawTransport } from '../src/transport-art.ts';
import { propDefinition } from '../src/biome-props.ts';
import { BIOME_PROP_BOUNDS, drawBiomeProp } from '../src/biome-prop-art.ts';

// ── Named towns never render as tent camps ──────────────────────────────────
test('authored named towns always generate houses, never a tent camp', () => {
  const world = new AuthoredWorld(7319);
  let checked = 0;
  for (const zone of Object.values(ZONES)) {
    const towns = zoneContent(zone.id).towns;
    for (let i = 0; i < towns.length; i++) {
      const spec = towns[i];
      if (spec.tier === 'village' || spec.tier === 'outpost') continue;
      const rect = zoneRect(zone.id)!;
      const town = world.getSettlements(
        rect.x + spec.nx * rect.w - 10, rect.y + spec.ny * rect.h - 10, 20, 20)
        .find(t => t.name === spec.name);
      assert.ok(town, `${zone.id}:${spec.name} materializes`);
      assert.notEqual(town.kind, 'settlement', `${spec.name} must not be a tent camp`);
      assert.ok(town.buildings.some(b => b.form === 'house'), `${spec.name} generates houses`);
      checked++;
    }
  }
  assert.ok(checked > 20, `expected many authored towns, checked ${checked}`);
  world.dispose();
});

test('procedural places still roll the tent camp tier', () => {
  let camps = 0, villages = 0;
  for (const seed of [7319, 9, 18427, 90210]) for (let cell = 0; cell < 8; cell++) {
    const town = generateSettlement(seed, settlementPlace(seed, cell, 0));
    if (town.kind === 'settlement') camps++; else if (town.kind === 'village') villages++;
  }
  assert.ok(camps > 0 && villages > 0, `camps ${camps} villages ${villages}`);
});

// ── Rift portals stay out of the town commons ───────────────────────────────
test('rift portals anchor near the settlement rim, not the commons', () => {
  let found = 0;
  for (const seed of [7319, 9, 18427, 90210, 79, 80]) for (let cell = 0; cell < 8; cell++) {
    const town = generateSettlement(seed, settlementPlace(seed, cell, 0));
    const rift = town.buildings.find(b => b.kind === 'rift');
    if (!rift) continue;
    found++;
    const cx = rift.x + rift.width / 2, cy = rift.y + rift.height / 2;
    const dist = Math.hypot(cx - town.x, cy - town.y);
    assert.ok(dist > 95, `rift at ${dist.toFixed(0)}u sits inside the commons`);
    assert.ok(dist < town.radius, `rift at ${dist.toFixed(0)}u escapes the wall`);
  }
  assert.ok(found > 0, 'no settlement generated a rift');
});

// ── flightPoints memoized ───────────────────────────────────────────────────
test('flightPoints returns the same memoized list across calls', () => {
  const a = flightPoints(), b = flightPoints();
  assert.equal(a, b);
  assert.ok(a.length > 40);
  assert.ok(Object.isFrozen(a));
});

// ── dockEtaSec targets the start of the docking window ──────────────────────
test('dockEtaSec counts down to the start of the docking window', () => {
  const route = transportRoute(TRANSPORTS.find(t => t.kind === 'ship')!.id)!;
  const dwell = TRANSPORT_RULES.dwellSec, duration = route.spec.transport.durationSec;
  const at = (t: number) => dockEtaSec(route, 'from', t - route.offsetSec);
  // Docked at 'from' for [0, dwell): ETA is 0 the whole window.
  assert.equal(at(0), 0);
  assert.equal(at(dwell - 1), 0);
  // Mid-sail outbound: ETA to 'from' is remaining sail + far dwell + return leg.
  assert.equal(at(dwell + duration / 2), duration / 2 + dwell + duration);
  // Docked at 'to': the 'from' window opens after the return leg.
  assert.equal(at(dwell + duration + 1), dwell + duration - 1);
  const toAt = (t: number) => dockEtaSec(route, 'to', t - route.offsetSec);
  assert.equal(toAt(dwell + duration), 0);
  assert.equal(toAt(dwell + duration + dwell - 1), 0);
  assert.equal(toAt(dwell + duration / 2), duration / 2);
});

// ── vehicleAt scratch reuse ─────────────────────────────────────────────────
test('vehicleAt fills a caller scratch object instead of allocating', () => {
  const route = transportRoute(TRANSPORTS.find(t => t.kind === 'ship')!.id)!;
  const scratch = {} as VehicleState;
  const a = vehicleAt(route, 100, scratch);
  assert.equal(a, scratch);
  const b = vehicleAt(route, 200, scratch);
  assert.equal(b, scratch);
  assert.equal(b.x, scratch.x);
  // Fresh calls still work and do not alias the scratch.
  const fresh = vehicleAt(route, 100);
  assert.notEqual(fresh, scratch);
});

// ── Tram dock has station context ───────────────────────────────────────────
test('docked trams draw a station depot behind the car', () => {
  const calls: string[] = [];
  const ctx = new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'canvas') return { width: 0, height: 0 };
      return () => { calls.push(String(prop)); };
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  const tram = { kind: 'tram', x: 0, y: 0, angle: 0, label: 'tram', docked: true } as const;
  drawTransport(ctx, { ...tram }, 0);
  // The depot draws a tunnel arch (arc) plus the car body (roundRect).
  assert.ok(calls.includes('arc'), 'tram depot draws the tunnel arch');
  assert.ok(calls.includes('roundRect'), 'tram depot draws the platform/car');
  const moving = { ...tram, docked: false };
  calls.length = 0;
  drawTransport(ctx, moving, 0);
  assert.ok(calls.includes('roundRect'), 'moving tram still draws the car');
});

// ── Zangarmarsh giant mushrooms ─────────────────────────────────────────────
test('giantMushroom is a registered prop kind with art and Zangarmarsh weight', () => {
  const def = propDefinition('giantMushroom');
  assert.ok(def.canopy, 'giantMushroom carries a canopy occluder');
  assert.ok(BIOME_PROP_BOUNDS['giantMushroom'] !== undefined, 'bounds registered');
  const zangar = zoneContent('zangarmarsh');
  assert.ok(zangar.props.some(p => p.kind === 'giantMushroom' && p.weight > 0));
  const calls: string[] = [];
  const ctx = new Proxy({}, {
    get: (_t, prop) => prop === 'canvas' ? { width: 0, height: 0 }
      : () => { calls.push(String(prop)); },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  drawBiomeProp(ctx, 'giantMushroom', 42);
  assert.ok(calls.length > 10, 'giantMushroom draws geometry');
});
