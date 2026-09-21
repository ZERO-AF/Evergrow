import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZONES, TRANSPORTS, CONTINENTS, CONTINENT_BOUNDS, ATLAS_SCALE,
  zoneAt, zoneRect, zoneLevel, continentAt, zonePoint,
  type ContinentId,
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
  assert.equal(ids.length, 61);
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
    assert.ok(['ship', 'zeppelin', 'portal', 'flightpath'].includes(t.kind));
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
  const r = rect('barrens');
  const seconds = r.w / 165;
  assert.ok(seconds > 120 && seconds < 3600, `barrens crossing ${seconds.toFixed(0)}s`);
  assert.ok(ATLAS_SCALE >= 20 && ATLAS_SCALE <= 30);
});
