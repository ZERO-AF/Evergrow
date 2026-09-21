import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, zoneAt, zoneRect, zonePoint } from '../src/world-atlas.ts';
import { AuthoredWorld, createWorld } from '../src/authored-world.ts';
import { zoneContent, defaultZoneContent, ZONE_CONTENT } from '../src/zone-content.ts';
import { sampleBiome } from '../src/biomes.ts';
import { getZoneAt } from '../src/zone-progression.ts';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { generateDungeon, type DungeonEntrance } from '../src/dungeon.ts';

const center = (id: string) => {
  const r = zoneRect(id)!;
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
};
const OCEAN = { x: 500000, y: 100000 }; // between Kalimdor and Eastern Kingdoms

test('zoneContent resolves every atlas zone to a usable default or authored entry', () => {
  for (const id of Object.keys(ZONES)) {
    const content = zoneContent(id);
    assert.equal(content.id, id);
    assert.ok(content.palette.length > 0);
    assert.ok(content.props.length > 0, `${id} has a prop table`);
    assert.ok(content.spawns.length > 0, `${id} has a spawn table`);
  }
  assert.equal(zoneContent('elwynn'), ZONE_CONTENT['elwynn'] ?? defaultZoneContent(ZONES['elwynn']));
});

test('sampleBiome answers the zone biome inside zones and stays procedural outside', () => {
  const world = new AuthoredWorld(7319);
  const durotar = center('durotar');
  const sample = world.sampleBiome(durotar.x, durotar.y);
  assert.equal(sample.id, 'sunscar'); // 'arid red canyon' maps to sunscar
  assert.equal(sample.name, 'Durotar');
  const winterspring = center('winterspring');
  assert.equal(world.sampleBiome(winterspring.x, winterspring.y).id, 'frostpine');
  // Ocean falls back to the water biome, not a procedural climate answer.
  assert.equal(world.sampleBiome(OCEAN.x, OCEAN.y).id, 'swamp');
  assert.equal(world.sampleBiome(OCEAN.x, OCEAN.y).name, 'The Great Sea');
  // Free function reroute: authored inside zones, procedural outside.
  assert.equal(sampleBiome(durotar.x, durotar.y, 7319).id, 'sunscar');
  assert.equal(sampleBiome(OCEAN.x, OCEAN.y, 7319).id, sampleBiome(OCEAN.x, OCEAN.y, 7319).id);
  world.dispose();
});

test('zone borders blend biomes instead of snapping', () => {
  const world = new AuthoredWorld(7319);
  // Durotar (sunscar) borders Barrens North (steppe) at x=240000.
  const border = { x: 240000, y: 220000 };
  const west = world.sampleBiome(border.x - 200, border.y);
  const east = world.sampleBiome(border.x + 200, border.y);
  assert.ok(west.weights.steppe > 0 && west.weights.sunscar > 0, 'west side blends toward sunscar');
  assert.ok(east.weights.sunscar > 0 && east.weights.steppe > 0, 'east side blends toward steppe');
  world.dispose();
});

test('ocean blocks movement and carries no props, camps, or towns', () => {
  const world = new AuthoredWorld(7319);
  assert.equal(world.blocked(OCEAN.x, OCEAN.y, 18), true);
  const moved = world.move(OCEAN.x, OCEAN.y, 40, 0, 18);
  assert.deepEqual(moved, { x: OCEAN.x, y: OCEAN.y });
  assert.equal(world.getProps(OCEAN.x - 200, OCEAN.y - 200, 400, 400).length, 0);
  assert.equal(world.getSettlements(OCEAN.x - 2000, OCEAN.y - 2000, 4000, 4000).length, 0);
  assert.equal(world.getWildernessSites(OCEAN.x - 2000, OCEAN.y - 2000, 4000, 4000).length, 0);
  assert.equal(world.sampleWater(OCEAN.x, OCEAN.y).coverage, 1);
  world.dispose();
});

test('authored towns become settlements with stable numeric portal bands', () => {
  const world = new AuthoredWorld(7319);
  const elwynn = zoneRect('elwynn')!;
  const towns = world.getSettlements(elwynn.x, elwynn.y, elwynn.w, elwynn.h);
  assert.ok(towns.length >= 2, 'Elwynn has Stormwind and Goldshire');
  assert.ok(towns.some(t => t.name === 'Stormwind City'));
  const nearest = world.getNearestSettlement(zonePoint('elwynn', .45, .6)!.x, zonePoint('elwynn', .45, .6)!.y);
  assert.equal(nearest.name, 'Goldshire');
  // Portal anchors resolve by band even before the town was materialized.
  const anchor = world.getPortalAnchor(1);
  assert.ok(Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
  assert.ok(zoneAt(anchor.x, anchor.y), 'anchor lands inside a zone');
  // Sanctuary and buildings come from the authored towns.
  assert.equal(world.isSanctuary(nearest.x, nearest.y), true);
  assert.ok(world.getBuildings(nearest.x - 400, nearest.y - 400, 800, 800).length > 0);
  world.dispose();
});

test('authored camps and dungeon entrances come from zone content', () => {
  const world = new AuthoredWorld(7319);
  const barrens = zoneRect('barrens-north')!;
  const camps = world.getEnemyCamps(barrens.x, barrens.y, barrens.w, barrens.h);
  assert.ok(camps.length >= 3, 'default content seeds camps');
  const entrances = world.getDungeonEntrances(barrens.x, barrens.y, barrens.w, barrens.h);
  assert.ok(entrances.some(e => e.name === 'Wailing Caverns'));
  const pois = world.getPOIs(barrens.x, barrens.y, barrens.w, barrens.h);
  assert.ok(pois.some(p => p.name === 'The Crossroads'));
  world.dispose();
});

test('getZoneAt returns the authored zone inside the atlas and procedural outside', () => {
  const durotar = center('durotar');
  const zone = getZoneAt(durotar.x, durotar.y, 7319);
  assert.equal(zone.id, 'atlas:durotar');
  assert.equal(zone.name, 'Durotar');
  assert.equal(zone.level, 1);
  assert.equal(zone.maxLevel, 10);
  // Ocean has no authored zone; the procedural district field still answers.
  const ocean = getZoneAt(OCEAN.x, OCEAN.y, 7319);
  assert.ok(!ocean.id.startsWith('atlas:'));
});

test('map colors differ between zones and ocean reads as water', () => {
  const world = new AuthoredWorld(7319);
  const durotar = center('durotar'), winterspring = center('winterspring');
  assert.notEqual(world.mapColor(durotar.x, durotar.y), world.mapColor(winterspring.x, winterspring.y));
  assert.match(world.mapColor(OCEAN.x, OCEAN.y), /^rgb\(/);
  assert.match(world.atlasColor(durotar.x, durotar.y), /^rgb\(/);
  world.dispose();
});

test('spawnPoint lands on walkable ground inside a zone', () => {
  const world = new AuthoredWorld(7319);
  const spawn = world.spawnPoint;
  assert.ok(spawn, 'spawnPoint is defined');
  assert.ok(zoneAt(spawn.x, spawn.y), 'spawn is inside a zone');
  assert.equal(world.blocked(spawn.x, spawn.y, 18), false);
  world.dispose();
});

test('createWorld honors the authored feature flag', () => {
  const world = createWorld(7319);
  assert.ok(world instanceof AuthoredWorld);
  world.dispose();
});
test('dungeon worlds still work beside the authored overworld', () => {
  const entrance: DungeonEntrance = { id: 'test', name: 'Test', x: 0, y: 0, seed: 1, level: 1, biome: 'verdant' };
  const dungeon = new DungeonWorld(generateDungeon(entrance.seed, entrance.level), entrance);
  assert.equal(dungeon.getSettlements().length, 0);
  assert.equal(typeof dungeon.blocked(0, 0, 10), 'boolean');
  dungeon.dispose();
});
