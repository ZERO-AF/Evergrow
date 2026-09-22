import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, zonePoint } from '../src/world-atlas.ts';
import { zoneBiome } from '../src/biomes.ts';
import { ZONE_CONTENT } from '../src/zone-content.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { enemyDisplayName, enemyRosterSkin, ZONE_ROSTERS, BIOME_ROSTERS } from '../src/zone-roster.ts';
import { nameplateName } from '../src/nameplate.ts';
import { Simulation } from '../src/simulation.ts';
import type { Enemy, WorldQuery } from '../src/model.ts';
import '../src/zone-content-kalimdor.ts';
import '../src/zone-content-eastern-kingdoms.ts';
import '../src/zone-content-northrend.ts';
import '../src/zone-content-outland.ts';

const open: WorldQuery = { blocked: () => false, move: (x, y) => ({ x, y }), sampleBiome: () => ({ id: 'deadwood' }) };

/** Minimal enemy shape at a zone's center; homeX/homeY anchor the roster lookup. */
const enemyAt = (zoneId: string, kind: Enemy['kind'], lootSeed = 7): Pick<Enemy, 'kind' | 'biome' | 'lootSeed' | 'homeX' | 'homeY'> => {
  const zone = ZONES[zoneId];
  const p = zonePoint(zoneId, .5, .5)!;
  return { kind, biome: zoneBiome(zone.terrain), lootSeed, homeX: p.x, homeY: p.y };
};

test('Elwynn and Icecrown spawn differently-named enemies', () => {
  assert.equal(enemyDisplayName(enemyAt('elwynn', 'stalker')), 'Defias Cutpurse');
  assert.equal(enemyDisplayName(enemyAt('elwynn', 'hound')), 'Riverpaw Gnoll');
  assert.equal(enemyDisplayName(enemyAt('icecrown', 'stalker', 0)), 'Scourge Ghoul');
  assert.equal(enemyDisplayName(enemyAt('icecrown', 'stalker', 1)), 'Cultist Acolyte');
  assert.notEqual(enemyDisplayName(enemyAt('elwynn', 'stalker')), enemyDisplayName(enemyAt('icecrown', 'stalker')));
});

test('name is deterministic per spawn seed and rotates family members', () => {
  const a = enemyAt('icecrown', 'stalker', 0), b = enemyAt('icecrown', 'stalker', 1);
  assert.equal(enemyDisplayName(a), enemyDisplayName({ ...a }), 'same seed, same name');
  assert.notEqual(enemyDisplayName(a), enemyDisplayName(b), 'seed rotates the family');
  // Every seed lands inside the authored family — never an empty or foreign name.
  for (let seed = 0; seed < 8; seed++)
    assert.ok(['Scourge Ghoul', 'Cultist Acolyte'].includes(enemyDisplayName(enemyAt('icecrown', 'stalker', seed))));
});

test('spawned enemies carry the zone roster name through nameplates', () => {
  const elwynn = zonePoint('elwynn', .5, .5)!, icecrown = zonePoint('icecrown', .5, .5)!;
  const sim = new Simulation(open, { seed: 42 });
  const a = sim.spawnEnemy('stalker', elwynn.x, elwynn.y)!;
  const b = sim.spawnEnemy('stalker', icecrown.x, icecrown.y)!;
  assert.equal(nameplateName(a), 'Defias Cutpurse');
  assert.notEqual(nameplateName(a), nameplateName(b));
  // A second sim with the same seed reproduces the same names (save-safe derivation).
  const sim2 = new Simulation(open, { seed: 42 });
  assert.equal(nameplateName(sim2.spawnEnemy('stalker', elwynn.x, elwynn.y)!), nameplateName(a));
});

test('dungeon actors and unlisted kinds keep their authored names', () => {
  const dungeon = { ...enemyAt('elwynn', 'stalker'), dungeonTheme: 'rootbound' as const };
  assert.equal(enemyDisplayName(dungeon), ENEMY_DEFINITIONS.stalker.name);
  // No roster for warden anywhere: the archetype name stands.
  assert.equal(enemyDisplayName(enemyAt('elwynn', 'warden')), ENEMY_DEFINITIONS.warden.name);
});

test('every authored zone spawn and camp member has a roster or biome family', () => {
  for (const [id, zone] of Object.entries(ZONES)) {
    const content = ZONE_CONTENT[id];
    if (!content) continue;
    const biome = zoneBiome(zone.terrain);
    const kinds = new Set([...content.spawns.map(s => s.kind), ...content.camps.flatMap(c => c.members ?? [])]);
    for (const kind of kinds)
      assert.ok(ZONE_ROSTERS[id]?.[kind] || BIOME_ROSTERS[biome]?.[kind],
        `${id} ${kind} needs a zone roster entry or a ${biome} biome family`);
  }
});

test('roster tints stay inside the readable wash range', () => {
  for (const table of [ZONE_ROSTERS, BIOME_ROSTERS])
    for (const roster of Object.values(table))
      for (const skin of Object.values(roster)) {
        assert.ok(skin.names.length > 0 && skin.names.every(n => n.length > 0));
        if (skin.tint !== undefined) {
          assert.match(skin.tint, /^#[0-9a-f]{6}$/i);
          assert.ok((skin.tintAmount ?? .3) > 0 && (skin.tintAmount ?? .3) <= .5, 'tint is a wash, not a repaint');
        }
      }
  assert.ok(enemyRosterSkin(enemyAt('icecrown', 'stalker'))?.tint, 'Scourge skin carries a tint');
});
