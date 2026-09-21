import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, zoneRect } from '../src/world-atlas.ts';
import { ZONE_CONTENT, zoneContent } from '../src/zone-content.ts';
import { PROP_KINDS } from '../src/biome-props.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { POI_DEFINITIONS } from '../src/world-pois.ts';
import { DUNGEON_THEME_IDS } from '../src/dungeon-content.ts';
import '../src/zone-content-northrend.ts';

const NORTHREND_IDS = Object.keys(ZONES).filter(id => ZONES[id].continent === 'northrend');
const ENEMY_KINDS = Object.keys(ENEMY_DEFINITIONS);
const POI_KINDS = Object.keys(POI_DEFINITIONS);
const inUnit = (v: number) => v >= 0 && v <= 1;

test('all 10 northrend zones register authored content', () => {
  assert.equal(NORTHREND_IDS.length, 10);
  for (const id of NORTHREND_IDS) {
    const content = ZONE_CONTENT[id];
    assert.ok(content, `${id} has a ZONE_CONTENT entry`);
    assert.equal(content.id, id);
    assert.equal(zoneContent(id), content, `${id} resolves to the authored entry`);
  }
});

test('every northrend zone has non-empty props and spawns with valid kinds', () => {
  for (const id of NORTHREND_IDS) {
    const content = ZONE_CONTENT[id];
    assert.ok(content.props.length > 0, `${id} props`);
    assert.ok(content.spawns.length > 0, `${id} spawns`);
    for (const p of content.props) {
      assert.ok(PROP_KINDS.includes(p.kind), `${id} prop kind ${p.kind}`);
      assert.ok(p.weight > 0, `${id} prop weight ${p.kind}`);
    }
    for (const s of content.spawns) {
      assert.ok(ENEMY_KINDS.includes(s.kind), `${id} spawn kind ${s.kind}`);
      assert.ok(s.weight > 0, `${id} spawn weight ${s.kind}`);
    }
  }
});

test('atlas cities appear as towns at their normalized positions', () => {
  for (const id of NORTHREND_IDS) {
    const zone = ZONES[id], content = ZONE_CONTENT[id];
    for (const city of zone.cities) {
      const town = content.towns.find(t => t.name === city.name);
      assert.ok(town, `${id} town ${city.name}`);
      assert.ok(Math.abs(town.nx - city.nx) < 1e-9 && Math.abs(town.ny - city.ny) < 1e-9,
        `${id} town ${city.name} at atlas position`);
    }
  }
});

test('atlas dungeons appear as entrances at their normalized positions', () => {
  for (const id of NORTHREND_IDS) {
    const zone = ZONES[id], content = ZONE_CONTENT[id];
    for (const dungeon of zone.dungeons) {
      const entrance = content.entrances.find(e => e.name === dungeon.name);
      assert.ok(entrance, `${id} entrance ${dungeon.name}`);
      assert.ok(Math.abs(entrance.nx - dungeon.nx) < 1e-9 && Math.abs(entrance.ny - dungeon.ny) < 1e-9,
        `${id} entrance ${dungeon.name} at atlas position`);
      assert.equal(entrance.kind, dungeon.kind, `${id} entrance ${dungeon.name} kind`);
      if (entrance.theme) assert.ok(DUNGEON_THEME_IDS.includes(entrance.theme), `${id} theme ${entrance.theme}`);
    }
  }
});

test('normalized coordinates stay inside [0,1] across all spec fields', () => {
  for (const id of NORTHREND_IDS) {
    const content = ZONE_CONTENT[id];
    const check = (nx: number, ny: number, what: string) =>
      assert.ok(inUnit(nx) && inUnit(ny), `${id} ${what} (${nx},${ny})`);
    for (const t of content.towns) check(t.nx, t.ny, `town ${t.name}`);
    for (const c of content.camps) check(c.nx, c.ny, `camp ${c.name ?? c.kind}`);
    for (const p of content.pois) {
      check(p.nx, p.ny, `poi ${p.name}`);
      assert.ok(POI_KINDS.includes(p.kind), `${id} poi kind ${p.kind}`);
    }
    for (const e of content.entrances) check(e.nx, e.ny, `entrance ${e.name}`);
    for (const w of content.water ?? []) {
      check(w.nx, w.ny, `water ${w.kind}`);
      for (const [px, py] of w.points ?? []) check(px, py, `water ${w.kind} point`);
    }
    for (const f of content.elevation?.features ?? []) check(f.nx, f.ny, `elevation feature`);
    for (const r of content.elevation?.ramps ?? []) {
      check(r.nx, r.ny, `ramp start`);
      check(r.nx2, r.ny2, `ramp end`);
    }
  }
});

test('roads are world-space polylines inside or beside their zone rect', () => {
  for (const id of NORTHREND_IDS) {
    const content = ZONE_CONTENT[id], rect = zoneRect(id)!;
    assert.ok(content.roads.length > 0, `${id} has roads`);
    for (const road of content.roads) {
      assert.ok(road.points.length >= 2, `${id} road ${road.id} has a polyline`);
      for (const [x, y] of road.points) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y), `${id} road ${road.id} finite point`);
        // Roads may cross a border to meet a neighbor's stub; allow one zone
        // of slack beyond the rect but never off the continent.
        assert.ok(x >= rect.x - rect.w && x <= rect.x + rect.w * 2
          && y >= rect.y - rect.h && y <= rect.y + rect.h * 2,
          `${id} road ${road.id} point (${x},${y}) near zone`);
      }
    }
  }
});
