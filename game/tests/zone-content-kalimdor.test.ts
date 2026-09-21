import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/zone-content-kalimdor.ts';
import { ZONE_CONTENT } from '../src/zone-content.ts';
import { ZONES } from '../src/world-atlas.ts';
import { PROP_KINDS } from '../src/biome-props.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { DUNGEON_THEME_IDS } from '../src/dungeon-content.ts';
import { isPOIKind } from '../src/world-pois.ts';

const KALIMDOR_IDS = Object.keys(ZONES).filter(id => ZONES[id].continent === 'kalimdor');
const ENEMY_KINDS = new Set(Object.keys(ENEMY_DEFINITIONS));
const WILDERNESS_KINDS = new Set(['bossLair', 'camp', 'watchtower', 'graveyard', 'standingStones',
  'caravan', 'cursedChest', 'ruinedChapel', 'beastDen', 'quarry', 'hamlet', 'crossing', 'corruptedGrove']);
const inUnit = (v: number) => v >= 0 && v <= 1;

test('all 21 Kalimdor atlas zones register authored content', () => {
  assert.equal(KALIMDOR_IDS.length, 21);
  for (const id of KALIMDOR_IDS) {
    const content = ZONE_CONTENT[id];
    assert.ok(content, `${id} has a defineZoneContent entry`);
    assert.equal(content.id, id);
  }
});

test('every Kalimdor entry has a palette, props, and a spawn table', () => {
  for (const id of KALIMDOR_IDS) {
    const content = ZONE_CONTENT[id];
    assert.equal(content.palette, ZONES[id].terrain, `${id} palette matches atlas terrain`);
    assert.ok(content.props.length > 0, `${id} props`);
    assert.ok(content.spawns.length > 0, `${id} spawns`);
    for (const p of content.props) {
      assert.ok(PROP_KINDS.includes(p.kind), `${id} prop kind ${p.kind}`);
      assert.ok(p.weight > 0, `${id} prop weight`);
    }
    for (const s of content.spawns) {
      assert.ok(ENEMY_KINDS.has(s.kind), `${id} spawn kind ${s.kind}`);
      assert.ok(s.weight > 0, `${id} spawn weight`);
    }
  }
});

test('atlas cities appear as towns and atlas dungeons as entrances', () => {
  for (const id of KALIMDOR_IDS) {
    const zone = ZONES[id], content = ZONE_CONTENT[id];
    for (const city of zone.cities) {
      const town = content.towns.find(t => t.name === city.name);
      assert.ok(town, `${id} town ${city.name}`);
      assert.ok(Math.abs(town.nx - city.nx) < 1e-9 && Math.abs(town.ny - city.ny) < 1e-9,
        `${id} town ${city.name} at atlas position`);
    }
    for (const dungeon of zone.dungeons) {
      const entrance = content.entrances.find(e => e.name === dungeon.name);
      assert.ok(entrance, `${id} entrance ${dungeon.name}`);
      assert.ok(Math.abs(entrance.nx - dungeon.nx) < 1e-9 && Math.abs(entrance.ny - dungeon.ny) < 1e-9,
        `${id} entrance ${dungeon.name} at atlas position`);
      assert.equal(entrance.kind, dungeon.kind, `${id} entrance ${dungeon.name} kind`);
      assert.equal(entrance.levelMin, dungeon.levelMin, `${id} entrance ${dungeon.name} levelMin`);
      assert.equal(entrance.levelMax, dungeon.levelMax, `${id} entrance ${dungeon.name} levelMax`);
    }
  }
});

test('normalized coordinates stay inside [0,1] and vocabularies are valid', () => {
  for (const id of KALIMDOR_IDS) {
    const content = ZONE_CONTENT[id];
    for (const t of content.towns) assert.ok(inUnit(t.nx) && inUnit(t.ny), `${id} town ${t.name}`);
    for (const c of content.camps) {
      assert.ok(inUnit(c.nx) && inUnit(c.ny), `${id} camp ${c.name ?? c.nx}`);
      if (c.kind) assert.ok(WILDERNESS_KINDS.has(c.kind), `${id} camp kind ${c.kind}`);
      for (const m of c.members ?? []) assert.ok(ENEMY_KINDS.has(m), `${id} camp member ${m}`);
    }
    for (const p of content.pois) {
      assert.ok(inUnit(p.nx) && inUnit(p.ny), `${id} poi ${p.name}`);
      assert.ok(isPOIKind(p.kind), `${id} poi kind ${p.kind}`);
    }
    for (const e of content.entrances) {
      assert.ok(inUnit(e.nx) && inUnit(e.ny), `${id} entrance ${e.name}`);
      if (e.theme) assert.ok(DUNGEON_THEME_IDS.includes(e.theme), `${id} entrance theme ${e.theme}`);
    }
    for (const w of content.water ?? []) {
      assert.ok(inUnit(w.nx) && inUnit(w.ny), `${id} water ${w.kind}`);
      for (const [px, py] of w.points ?? []) assert.ok(inUnit(px) && inUnit(py), `${id} river point`);
    }
    for (const f of content.elevation?.features ?? []) {
      assert.ok(inUnit(f.nx) && inUnit(f.ny), `${id} elevation feature`);
    }
    for (const r of content.elevation?.ramps ?? []) {
      assert.ok(inUnit(r.nx) && inUnit(r.ny) && inUnit(r.nx2) && inUnit(r.ny2), `${id} ramp`);
    }
    for (const road of content.roads) {
      assert.ok(road.points.length >= 2, `${id} road ${road.id} has a polyline`);
      for (const [px, py] of road.points) {
        assert.ok(Number.isFinite(px) && Number.isFinite(py), `${id} road ${road.id} point`);
      }
    }
  }
});

test('Kalimdor content is deterministic static data (no duplicate ids)', () => {
  const ids = KALIMDOR_IDS.map(id => ZONE_CONTENT[id].id);
  assert.equal(new Set(ids).size, 21);
});
