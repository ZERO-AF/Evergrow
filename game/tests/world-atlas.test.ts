import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZONES, TRANSPORTS, CONTINENTS, CONTINENT_BOUNDS, ATLAS_SCALE,
  zoneAt, zoneRect, zoneLevel, continentAt, zonePoint,
  type ContinentId, type AtlasRect,
} from '../src/world-atlas.ts';

const ids = Object.keys(ZONES);
const rect = (id: string) => zoneRect(id)!;

test('every WotLK continent has zones and derived bounds', () => {
  for (const cid of Object.keys(CONTINENTS) as ContinentId[]) {
    const zs = ids.filter(id => ZONES[id].continent === cid);
    assert.ok(zs.length >= 7, `${cid} has zones`);
    const b = CONTINENT_BOUNDS[cid];
    assert.ok(b.w > 0 && b.h > 0, `${cid} bounds`);
  }
  assert.equal(ids.length, 63);
});

test('no two zones on a continent overlap', () => {
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ZONES[ids[i]], b = ZONES[ids[j]];
    if (a.continent !== b.continent) continue;
    const A = rect(a.id), B = rect(b.id);
    const overlap = A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;
    assert.ok(!overlap, `${a.id} overlaps ${b.id}`);
  }
});

test('every declared border is geometrically adjacent on the correct side', () => {
  const EPS = 0.5;
  const abuts = (a: AtlasRect, b: AtlasRect, side: string) => {
    const hOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS;
    const vOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS;
    switch (side) {
      case 'north': return Math.abs(a.y - (b.y + b.h)) < EPS && hOverlap;
      case 'south': return Math.abs(a.y + a.h - b.y) < EPS && hOverlap;
      case 'east': return Math.abs(a.x + a.w - b.x) < EPS && vOverlap;
      case 'west': return Math.abs(a.x - (b.x + b.w)) < EPS && vOverlap;
    }
    return false;
  };
  for (const id of ids) {
    const z = ZONES[id], A = rect(id);
    for (const side of ['north', 'south', 'east', 'west'] as const) {
      const n = z.borders[side];
      if (!n) continue;
      const nz = ZONES[n];
      assert.ok(nz, `${id}.${side} → ${n} exists`);
      assert.equal(nz.continent, z.continent, `${id}.${side} → ${n} same continent`);
      assert.ok(abuts(A, rect(n), side), `${id}.${side}=${n} must share an edge on the ${side} side`);
    }
  }
});

test('declared borders are a subset of true adjacencies (soundness)', () => {
  // `borders` is a primary-neighbor map (one id per side) naming the *walkable*
  // crossing used for blending and road hints — not a complete adjacency graph.
  // WoW zones are not walkable-adjacent everywhere they touch (mountain walls),
  // and one rect edge can border two zones, so completeness is not required.
  // The real invariant is soundness: every declared neighbor is genuinely
  // adjacent on that side (covered by the geometric test above) and resolves.
  const EPS = 0.5;
  for (const id of ids) {
    const A = rect(id);
    for (const side of ['north', 'south', 'east', 'west'] as const) {
      const n = ZONES[id].borders[side];
      if (!n) continue;
      const B = rect(n);
      const hOverlap = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
      const vOverlap = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
      const adjacent =
        (Math.abs(A.y - (B.y + B.h)) < EPS || Math.abs(A.y + A.h - B.y) < EPS) && hOverlap > EPS ||
        (Math.abs(A.x - (B.x + B.w)) < EPS || Math.abs(A.x + A.w - B.x) < EPS) && vOverlap > EPS;
      assert.ok(adjacent, `${id}.${side}=${n} declared but not adjacent`);
    }
  }
});

test('declared border crossings are walkable (zoneAt non-null along the shared edge)', () => {
  for (const id of ids) {
    const z = ZONES[id], A = rect(id);
    for (const side of ['north', 'south', 'east', 'west'] as const) {
      const n = z.borders[side];
      if (!n) continue;
      const B = rect(n);
      // Sample the shared edge segment at 9 points, stepping just across the seam.
      if (side === 'north' || side === 'south') {
        const y = side === 'north' ? A.y : A.y + A.h;
        const lo = Math.max(A.x, B.x), hi = Math.min(A.x + A.w, B.x + B.w);
        for (let k = 0; k < 9; k++) {
          const x = lo + (hi - lo) * (k + 0.5) / 9;
          const inA = zoneAt(x, side === 'north' ? y + 1 : y - 1);
          const inB = zoneAt(x, side === 'north' ? y - 1 : y + 1);
          assert.equal(inA?.id, id, `${id}.${side}=${n}: inside ${id} at x=${x}`);
          assert.equal(inB?.id, n, `${id}.${side}=${n}: inside ${n} at x=${x}`);
        }
      } else {
        const x = side === 'west' ? A.x : A.x + A.w;
        const lo = Math.max(A.y, B.y), hi = Math.min(A.y + A.h, B.y + B.h);
        for (let k = 0; k < 9; k++) {
          const y = lo + (hi - lo) * (k + 0.5) / 9;
          const inA = zoneAt(side === 'west' ? x + 1 : x - 1, y);
          const inB = zoneAt(side === 'west' ? x - 1 : x + 1, y);
          assert.equal(inA?.id, id, `${id}.${side}=${n}: inside ${id} at y=${y}`);
          assert.equal(inB?.id, n, `${id}.${side}=${n}: inside ${n} at y=${y}`);
        }
      }
    }
  }
});

test('every zone rect stays inside its continent bounds', () => {
  for (const id of ids) {
    const z = ZONES[id], r = rect(id), b = CONTINENT_BOUNDS[z.continent];
    assert.ok(r.x >= b.x && r.y >= b.y && r.x + r.w <= b.x + b.w && r.y + r.h <= b.y + b.h,
      `${id} inside ${z.continent} bounds`);
  }
});

test('zoneAt returns the zone for a point inside its rect and null in ocean', () => {
  for (const id of ids) {
    const r = rect(id);
    const z = zoneAt(r.x + r.w / 2, r.y + r.h / 2);
    assert.equal(z?.id, id, `center of ${id}`);
  }
  // Far ocean between continents resolves to no zone.
  assert.equal(zoneAt(-50000, -50000), null);
});

test('zoneLevel returns the authored range and null off-map', () => {
  const durotar = rect('durotar');
  assert.deepEqual(zoneLevel(durotar.x + 1, durotar.y + 1), { min: 1, max: 10 });
  assert.equal(zoneLevel(-99999, -99999), null);
});

test('every transport endpoint resolves to a real zone', () => {
  for (const t of TRANSPORTS) {
    assert.ok(ZONES[t.from.zone], `from ${t.from.zone}`);
    assert.ok(ZONES[t.to.zone], `to ${t.to.zone}`);
    assert.ok(t.durationSec > 0);
    assert.ok(['ship', 'zeppelin', 'portal', 'flightpath', 'turtle', 'tram'].includes(t.kind));
  }
});

test('zonePoint maps normalized coords into the world rect', () => {
  const p = zonePoint('durotar', 0.5, 0.5)!;
  const r = rect('durotar');
  assert.equal(p.x, r.x + r.w / 2);
  assert.equal(p.y, r.y + r.h / 2);
});

test('continentAt resolves a zone center to its continent', () => {
  const r = rect('icecrown');
  assert.equal(continentAt(r.x + 1, r.y + 1)?.id, 'northrend');
});

test('scale keeps WoW travel times (a zone crossing is minutes, not seconds)', () => {
  // A mid zone ~60000 units at 165 u/s ≈ 6 minutes on foot — WoW-scale.

  const r = rect('barrens-north');
  const seconds = r.w / 165;
  assert.ok(seconds > 120 && seconds < 3600, `barrens crossing ${seconds.toFixed(0)}s`);
  assert.ok(ATLAS_SCALE >= 20 && ATLAS_SCALE <= 30);
});
