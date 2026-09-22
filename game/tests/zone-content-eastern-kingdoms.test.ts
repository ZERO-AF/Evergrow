import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, zoneRect } from '../src/world-atlas.ts';
import { ZONE_CONTENT, zoneContent } from '../src/zone-content.ts';
import '../src/zone-content-eastern-kingdoms.ts';

const EK_IDS = Object.keys(ZONES).filter(id => ZONES[id].continent === 'eastern-kingdoms');

const inUnit = (v: number) => v >= 0 && v <= 1;
const checkNormalized = (zoneId: string, label: string, nx: number, ny: number) =>
  assert.ok(inUnit(nx) && inUnit(ny), `${zoneId} ${label} (${nx},${ny}) in [0,1]`);

test('all 25 Eastern Kingdoms zones register authored content', () => {
  assert.equal(EK_IDS.length, 25);
  for (const id of EK_IDS) {
    const content = ZONE_CONTENT[id];
    assert.ok(content, `${id} has a defineZoneContent entry`);
    assert.equal(content.id, id);
    assert.equal(zoneContent(id), content, `${id} resolves to authored entry`);
  }
});

test('every zone has non-empty props and spawns', () => {
  for (const id of EK_IDS) {
    const content = ZONE_CONTENT[id];
    assert.ok(content.props.length > 0, `${id} props`);
    assert.ok(content.props.every(p => p.weight > 0), `${id} prop weights positive`);
    assert.ok(content.spawns.length > 0, `${id} spawns`);
    assert.ok(content.spawns.every(s => s.weight > 0), `${id} spawn weights positive`);
  }
});

test('atlas cities become towns at their normalized positions', () => {
  for (const id of EK_IDS) {
    const zone = ZONES[id], content = ZONE_CONTENT[id];
    for (const city of zone.cities) {
      const town = content.towns.find(t => t.name === city.name);
      assert.ok(town, `${id} town ${city.name}`);
      assert.equal(town.nx, city.nx, `${id} ${city.name} nx`);
      assert.equal(town.ny, city.ny, `${id} ${city.name} ny`);
      assert.equal(town.faction, city.faction, `${id} ${city.name} faction`);
    }
  }
});

test('atlas dungeons become entrances at their normalized positions', () => {
  for (const id of EK_IDS) {
    const zone = ZONES[id], content = ZONE_CONTENT[id];
    assert.equal(content.entrances.length, zone.dungeons.length, `${id} entrance count`);
    for (const dungeon of zone.dungeons) {
      const entrance = content.entrances.find(e => e.name === dungeon.name);
      assert.ok(entrance, `${id} entrance ${dungeon.name}`);
      assert.equal(entrance.nx, dungeon.nx, `${id} ${dungeon.name} nx`);
      assert.equal(entrance.ny, dungeon.ny, `${id} ${dungeon.name} ny`);
      assert.equal(entrance.levelMin, dungeon.levelMin, `${id} ${dungeon.name} levelMin`);
      assert.equal(entrance.levelMax, dungeon.levelMax, `${id} ${dungeon.name} levelMax`);
      assert.equal(entrance.kind, dungeon.kind, `${id} ${dungeon.name} kind`);
    }
  }
});

test('atlas docks surface as POIs at their normalized positions', () => {
  for (const id of EK_IDS) {
    const zone = ZONES[id], content = ZONE_CONTENT[id];
    for (const dock of zone.docks) {
      const poi = content.pois.find(p => p.name === dock.name);
      assert.ok(poi, `${id} dock POI ${dock.name}`);
      assert.equal(poi.nx, dock.nx, `${id} ${dock.name} nx`);
      assert.equal(poi.ny, dock.ny, `${id} ${dock.name} ny`);
    }
  }
});

test('all normalized coordinates stay inside [0,1]', () => {
  for (const id of EK_IDS) {
    const c = ZONE_CONTENT[id];
    for (const t of c.towns) checkNormalized(id, `town ${t.name}`, t.nx, t.ny);
    for (const camp of c.camps) checkNormalized(id, `camp ${camp.name ?? camp.kind ?? '?'}`, camp.nx, camp.ny);
    for (const p of c.pois) checkNormalized(id, `poi ${p.name}`, p.nx, p.ny);
    for (const e of c.entrances) checkNormalized(id, `entrance ${e.name}`, e.nx, e.ny);
    for (const w of c.water ?? []) {
      checkNormalized(id, `water ${w.kind}`, w.nx, w.ny);
      for (const [px, py] of w.points ?? []) checkNormalized(id, `water point`, px, py);
    }
    for (const f of c.elevation?.features ?? []) checkNormalized(id, 'elevation feature', f.nx, f.ny);
    for (const r of c.elevation?.ramps ?? []) {
      checkNormalized(id, 'ramp start', r.nx, r.ny);
      checkNormalized(id, 'ramp end', r.nx2, r.ny2);
    }
  }
});

test('every zone authors at least one road with world-space points', () => {
  for (const id of EK_IDS) {
    const content = ZONE_CONTENT[id];
    assert.ok(content.roads.length > 0, `${id} roads`);
    const rect = zoneRect(id)!;
    for (const road of content.roads) {
      assert.ok(road.points.length >= 2, `${id} ${road.id} has a polyline`);
      for (const [x, y] of road.points) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y), `${id} ${road.id} finite point`);
        // Road points are world-space; they must lie within/near the continent.
        assert.ok(Math.abs(x - (rect.x + rect.w / 2)) < rect.w * 2, `${id} ${road.id} x near zone`);
        assert.ok(Math.abs(y - (rect.y + rect.h / 2)) < rect.h * 2, `${id} ${road.id} y near zone`);
      }
    }
  }
});

test('palette matches the atlas terrain string', () => {
  for (const id of EK_IDS)
    assert.equal(ZONE_CONTENT[id].palette, ZONES[id].terrain, `${id} palette`);
});
