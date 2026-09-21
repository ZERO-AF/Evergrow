import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, zoneRect } from '../src/world-atlas.ts';
import { ZONE_CONTENT, zoneContent } from '../src/zone-content.ts';
import { PROP_KINDS } from '../src/biome-props.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { isPOIKind } from '../src/world-pois.ts';
import { DUNGEON_THEME_IDS } from '../src/dungeon-content.ts';
import '../src/zone-content-outland.ts';

const OUTLAND_IDS = Object.keys(ZONES).filter(id => ZONES[id].continent === 'outland');
const ENEMY_KINDS = Object.keys(ENEMY_DEFINITIONS);
const inUnit = (v: number) => v >= 0 && v <= 1;

test('all 7 Outland zones register authored content', () => {
  assert.equal(OUTLAND_IDS.length, 7);
  for (const id of OUTLAND_IDS) {
    const content = ZONE_CONTENT[id];
    assert.ok(content, `${id} has a defineZoneContent entry`);
    assert.equal(content.id, id);
    assert.equal(zoneContent(id), content, `${id} resolves to the authored entry`);
  }
});

test('every Outland zone has non-empty props and spawns with valid kinds', () => {
  for (const id of OUTLAND_IDS) {
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

test('atlas cities become towns at their normalized positions', () => {
  for (const id of OUTLAND_IDS) {
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
  for (const id of OUTLAND_IDS) {
    const zone = ZONES[id], content = ZONE_CONTENT[id];
    assert.equal(content.entrances.length, zone.dungeons.length, `${id} entrance count`);
    for (const dungeon of zone.dungeons) {
      const entrance = content.entrances.find(e => e.name === dungeon.name);
      assert.ok(entrance, `${id} entrance ${dungeon.name}`);
      assert.equal(entrance.nx, dungeon.nx, `${id} ${dungeon.name} nx`);
      assert.equal(entrance.ny, dungeon.ny, `${id} ${dungeon.name} ny`);
      assert.equal(entrance.kind, dungeon.kind, `${id} ${dungeon.name} kind`);
      assert.equal(entrance.levelMin, dungeon.levelMin, `${id} ${dungeon.name} levelMin`);
      assert.equal(entrance.levelMax, dungeon.levelMax, `${id} ${dungeon.name} levelMax`);
      assert.ok(DUNGEON_THEME_IDS.includes(entrance.theme!), `${id} ${dungeon.name} theme`);
    }
  }
});

test('all normalized coordinates stay inside [0,1]', () => {
  for (const id of OUTLAND_IDS) {
    const content = ZONE_CONTENT[id];
    const check = (label: string, nx: number, ny: number) => {
      assert.ok(inUnit(nx) && inUnit(ny), `${id} ${label} (${nx},${ny}) in [0,1]`);
    };
    for (const t of content.towns) check(`town ${t.name}`, t.nx, t.ny);
    for (const c of content.camps) check(`camp ${c.name ?? c.kind}`, c.nx, c.ny);
    for (const p of content.pois) check(`poi ${p.name}`, p.nx, p.ny);
    for (const e of content.entrances) check(`entrance ${e.name}`, e.nx, e.ny);
    for (const w of content.water ?? []) {
      check(`water ${w.kind}`, w.nx, w.ny);
      for (const [px, py] of w.points ?? []) check(`water ${w.kind} point`, px, py);
    }
    for (const f of content.elevation?.features ?? []) {
      check(`elevation feature`, f.nx, f.ny);
      if (f.nw !== undefined) assert.ok(f.nw > 0 && f.nw <= 1, `${id} feature nw`);
      if (f.nh !== undefined) assert.ok(f.nh > 0 && f.nh <= 1, `${id} feature nh`);
      if (f.nr !== undefined) assert.ok(f.nr > 0 && f.nr <= .5, `${id} feature nr`);
    }
    for (const r of content.elevation?.ramps ?? []) {
      check('ramp start', r.nx, r.ny);
      check('ramp end', r.nx2, r.ny2);
    }
  }
});

test('roads are world-space polylines that touch their own zone', () => {
  for (const id of OUTLAND_IDS) {
    const content = ZONE_CONTENT[id], rect = zoneRect(id)!;
    assert.ok(content.roads.length > 0, `${id} has roads`);
    for (const road of content.roads) {
      assert.ok(road.points.length >= 2, `${id} road ${road.id} has a path`);
      const touches = road.points.some(([x, y]) =>
        x >= rect.x - 1 && x <= rect.x + rect.w + 1 && y >= rect.y - 1 && y <= rect.y + rect.h + 1);
      assert.ok(touches, `${id} road ${road.id} passes through the zone`);
      for (const [x, y] of road.points) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y), `${id} road ${road.id} finite point`);
      }
    }
  }
});

test('pois use valid kinds and camps use valid members', () => {
  for (const id of OUTLAND_IDS) {
    const content = ZONE_CONTENT[id];
    assert.ok(content.pois.length > 0, `${id} pois`);
    for (const poi of content.pois) assert.ok(isPOIKind(poi.kind), `${id} poi kind ${poi.kind}`);
    assert.ok(content.camps.length > 0, `${id} camps`);
    for (const camp of content.camps) {
      for (const member of camp.members ?? [])
        assert.ok(ENEMY_KINDS.includes(member), `${id} camp member ${member}`);
    }
  }
});
