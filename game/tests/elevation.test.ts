import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ElevationField, ElevationSite, elevationAt, elevationBlocked, elevationBlockedAt,
  elevationMove, elevationTier, ELEVATION_TIER_HEIGHT,
  type ElevationSpec,
} from '../src/elevation.ts';
import { occluderBlocks, propOccluder, OcclusionField } from '../src/occlusion.ts';
import { ZONES, zoneRect, type AtlasZone } from '../src/world-atlas.ts';
import type { Prop } from '../src/world-landscape.ts';

/** Synthetic atlas zone: continent-local rect 1000×1000 at the kalimdor origin. */
const testZone: AtlasZone = Object.freeze({
  id: 'test-zone', name: 'Test Zone', continent: 'kalimdor',
  rect: Object.freeze({ x: 0, y: 0, w: 1000, h: 1000 }),
  levelMin: 1, levelMax: 10, faction: 'contested', terrain: 'test',
  borders: Object.freeze({ north: null, south: null, east: null, west: null }),
  cities: Object.freeze([]), dungeons: Object.freeze([]),
  docks: Object.freeze([]), flightpaths: Object.freeze([]),
});

const plateauSpec: ElevationSpec = {
  features: [{ nx: .4, ny: .4, nw: .2, nh: .2, tier: 1 }],
};
const rampedSpec: ElevationSpec = {
  features: [{ nx: .4, ny: .4, nw: .2, nh: .2, tier: 1 }],
  // The top end overlaps the plateau so the ramp connects tier 0 to tier 1.
  ramps: [{ nx: .5, ny: .62, nx2: .5, ny2: .45, width: 40 }],
};

test('height sampling: plateau interior is one tier up, outside is base, valley sinks', () => {
  const site = new ElevationSite(testZone, plateauSpec);
  const inside = elevationAt(site, 500, 500);
  const outside = elevationAt(site, 200, 500);
  assert.ok(inside > ELEVATION_TIER_HEIGHT * .75, `plateau top ${inside}`);
  assert.ok(Math.abs(outside) < ELEVATION_TIER_HEIGHT * .35, `base ${outside}`);
  assert.equal(elevationTier(site, 500, 500), 1);
  assert.equal(elevationTier(site, 200, 500), 0);
  const valley = new ElevationSite(testZone, { features: [{ nx: .4, ny: .4, nw: .2, nh: .2, tier: -1 }] });
  assert.ok(elevationAt(valley, 500, 500) < -ELEVATION_TIER_HEIGHT * .75);
  assert.equal(elevationTier(valley, 500, 500), -1);
});

test('elevation is deterministic per zone and varies with seed', () => {
  const a = new ElevationSite(testZone, plateauSpec);
  const b = new ElevationSite(testZone, plateauSpec);
  const c = new ElevationSite(testZone, { ...plateauSpec, seed: 7 });
  for (const [x, y] of [[123, 456], [500, 500], [399, 500]] as const) {
    assert.equal(elevationAt(a, x, y), elevationAt(b, x, y));
  }
  assert.notEqual(elevationAt(a, 123, 456), elevationAt(c, 123, 456));
});

test('cliff edges block segments and straddling bodies; ramps pass', () => {
  const site = new ElevationSite(testZone, plateauSpec);
  // Crossing the plateau edge east-west is a cliff crossing.
  assert.equal(elevationBlocked(site, 300, 500, 700, 500), true);
  // Moving parallel to the edge on flat ground is clear.
  assert.equal(elevationBlocked(site, 300, 300, 700, 300), false);
  // A body next to the edge straddles it; a body well clear does not.
  assert.equal(elevationBlockedAt(site, 390, 500, 18), true);
  assert.equal(elevationBlockedAt(site, 300, 500, 18), false);
  assert.equal(elevationBlockedAt(site, 500, 500, 18), false);
  // Radius-0 probes never straddle.
  assert.equal(elevationBlockedAt(site, 400, 500, 0), false);

  const ramped = new ElevationSite(testZone, rampedSpec);
  // The ramp corridor climbs the south edge; beside it the cliff still blocks.
  assert.equal(elevationBlocked(ramped, 500, 700, 500, 500), false);
  assert.equal(elevationBlocked(ramped, 430, 700, 430, 500), true);
  // The plateau's other edges remain cliffs — the ramp does not leak.
  assert.equal(elevationBlocked(ramped, 500, 500, 500, 300), true);
  // Mid-ramp the tier interpolates between base and plateau.
  const mid = elevationTier(ramped, 500, 535);
  assert.ok(mid > .4 && mid < .6, `mid-ramp tier ${mid}`);
});

test('elevationMove climbs ramps but stops at cliff edges, preserving the free axis', () => {
  const ramped = new ElevationSite(testZone, rampedSpec);
  const clear = () => false;
  // Up the ramp onto the plateau top: full travel.
  const climbed = elevationMove(ramped, 500, 700, 0, -250, 18, clear);
  assert.ok(climbed.y < 500, `climbed to ${climbed.y}`);
  // Into the cliff face: blocked, stays below the edge.
  const stopped = elevationMove(ramped, 430, 700, 0, -400, 18, clear);
  assert.ok(stopped.y > 590, `stopped at ${stopped.y}`);
  // Diagonal into a tall cliff face slides along it: y advances up the face,
  // x stops a body-radius short of the edge.
  const tall = new ElevationSite(testZone, {
    features: [{ nx: .4, ny: .1, nw: .2, nh: .5, tier: 1 }],
  });
  const slid = elevationMove(tall, 300, 700, 200, -400, 18, clear);
  assert.ok(slid.x < 395 && slid.y < 310, `slid to ${slid.x},${slid.y}`);
  // The caller's non-elevation blocked still applies.
  const walled = elevationMove(ramped, 500, 700, 0, -400, 18, (_x, y) => y < 650);
  assert.ok(walled.y >= 645, `caller blocked at ${walled.y}`);
});

test('region query returns faces and ramps overlapping the rect only', () => {
  const site = new ElevationSite(testZone, rampedSpec);
  const hit = site.region(350, 350, 300, 300);
  assert.equal(hit.faces.length, 1);
  assert.equal(hit.faces[0].tier, 1);
  assert.equal(hit.ramps.length, 1);
  const miss = site.region(0, 0, 100, 100);
  assert.equal(miss.faces.length, 0);
  assert.equal(miss.ramps.length, 0);
  // Face bounds are world-space: the plateau occupies [400,600]².
  assert.equal(hit.faces[0].x, 400);
  assert.equal(hit.faces[0].w, 200);
});

test('overhang faces carry an occluder volume on the low side', () => {
  const site = new ElevationSite(testZone, {
    features: [{ nx: .4, ny: .4, nw: .2, nh: .2, tier: 1, kind: 'overhang' }],
  });
  const face = site.region(0, 0, 1000, 1000).faces[0];
  assert.ok(face.occluder, 'overhang exposes an occluder');
  // The lip covers the shelf south of the rim, not the plateau top.
  assert.ok(occluderBlocks(face.occluder!, 500, 500, 500, 640));
  assert.ok(!occluderBlocks(face.occluder!, 500, 500, 500, 300));
});

test('occluderBlocks covers the focus→player segment, not just the player point', () => {
  const volume = { x: 0, y: 0, width: 100, height: 100 };
  assert.ok(occluderBlocks(volume, 50, 50, 300, 50), 'segment through the volume');
  assert.ok(occluderBlocks(volume, 50, 50, 50, 50), 'degenerate segment inside');
  assert.ok(!occluderBlocks(volume, 150, 150, 300, 150), 'segment misses');
  assert.ok(!occluderBlocks(volume, 300, 300, 400, 400), 'segment outside');
});

test('propOccluder prefers authored metadata, falls back to the canopy definition', () => {
  const base: Prop = { id: 'p', x: 100, y: 200, radius: 10, kind: 'stump', seed: 1, scale: 1 };
  assert.equal(propOccluder(base), null, 'plain stump is not tall');
  const authored = propOccluder({ ...base, occluder: { height: 120, radius: 40, offsetX: 10 } })!;
  assert.deepEqual(authored, { x: 70, y: 40, width: 80, height: 168 });
  const tree = propOccluder({ ...base, kind: 'tree' })!;
  assert.ok(tree.height > 80 && tree.width > 100, 'canopy kinds occlude through their crown');
  const disabled = propOccluder({ ...base, kind: 'tree', occluder: null });
  assert.equal(disabled, null, 'explicit null disables the canopy fade');
});

test('OcclusionField smooths toward the fade target and releases at full opacity', () => {
  const field = new OcclusionField();
  assert.equal(field.update('a', true, 1 / 60, true), .24, 'reduced motion snaps');
  assert.equal(field.alpha('a'), .24);
  assert.equal(field.update('a', false, 1 / 60, true), 1);
  assert.equal(field.alpha('a'), 1);
  // Smooth mode eases in and out.
  const eased = field.update('b', true, .1, false);
  assert.ok(eased < 1 && eased > .24, `easing ${eased}`);
  for (let i = 0; i < 60; i++) field.update('b', false, .05, false);
  assert.equal(field.alpha('b'), 1, 'settles back to opaque');
});

test('ElevationField resolves real atlas zones and recompiles on spec identity change', () => {
  const rect = zoneRect('mulgore')!;
  let spec: ElevationSpec | undefined = { features: [{ nx: .4, ny: .4, nw: .2, nh: .2, tier: 2 }] };
  const field = new ElevationField(() => spec);
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  assert.equal(field.elevationTier(cx, cy), 2);
  assert.equal(field.elevationTier(rect.x + 4, cy), 0);
  // Ocean contributes nothing.
  assert.equal(field.elevationAt(-50000, -50000), 0);
  assert.equal(field.blockedAt(-50000, -50000, 18), false);
  // A new spec object recompiles the site.
  spec = { features: [{ nx: .4, ny: .4, nw: .2, nh: .2, tier: 3 }] };
  assert.equal(field.elevationTier(cx, cy), 3);
  // Region query spans the zone's world rect.
  const region = field.region(cx - 10, cy - 10, 20, 20);
  assert.equal(region.faces.length, 1);
  assert.equal(region.faces[0].tier, 3);
  // Zones without a spec contribute nothing.
  const empty = new ElevationField(() => undefined);
  assert.equal(empty.region(rect.x, rect.y, rect.w, rect.h).faces.length, 0);
  assert.ok(ZONES['mulgore'], 'atlas fixture');
});
