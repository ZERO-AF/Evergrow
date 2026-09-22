import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, zoneRect } from '../src/world-atlas.ts';
import { AuthoredWorld } from '../src/authored-world.ts';
import { QUESTS, giverSpec, turnInSpec } from '../src/quest-content.ts';
import { questGiverAnchors } from '../src/quest-command.ts';
import { buildingNPC, npcRoutine, npcRoutinePosition, npcTown, positionedNPC } from '../src/npcs.ts';
import { WORLD_TIME } from '../src/world-time.ts';

const world = new AuthoredWorld(7319);
const zoneByName = new Map(Object.values(ZONES).map(z => [z.name, z.id]));

/** Anchors for `spec` that land inside the zone's world rect. */
function anchorsInZone(spec: Parameters<typeof questGiverAnchors>[1], zoneId: string) {
  const r = zoneRect(zoneId)!;
  return questGiverAnchors(world, spec, r.x, r.y, r.w, r.h)
    .filter(a => a.x >= r.x && a.x < r.x + r.w && a.y >= r.y && a.y < r.y + r.h);
}

test('every atlas zone has at least one quest whose giver resolves inside it', () => {
  const uncovered: string[] = [];
  for (const [id, zone] of Object.entries(ZONES)) {
    const zoneQuests = QUESTS.filter(def => def.zone === zone.name);
    if (!zoneQuests.some(def => anchorsInZone(giverSpec(def), id).length > 0)) uncovered.push(id);
  }
  assert.deepEqual(uncovered, []);
});

test('every quest giver and turn-in spec resolves to an anchor in its zone', () => {
  const failures: string[] = [];
  for (const def of QUESTS) {
    const zoneId = def.zone ? zoneByName.get(def.zone) : undefined;
    if (!zoneId) { failures.push(`${def.id}: unknown zone ${def.zone}`); continue; }
    if (!anchorsInZone(giverSpec(def), zoneId).length) failures.push(`${def.id}: giver`);
    if (!anchorsInZone(turnInSpec(def), zoneId).length) failures.push(`${def.id}: turnIn`);
  }
  assert.deepEqual(failures, []);
});

test('NPC daily routine is deterministic, moves, and returns near its anchor', () => {
  const r = zoneRect('elwynn')!;
  const town = world.getSettlements(r.x, r.y, r.w, r.h)[0];
  assert.ok(town, 'expected a settlement in Elwynn');
  const npc = town.buildings.map(buildingNPC).find(n => n && n.role === 'blacksmith')!;
  assert.ok(npc, 'expected a blacksmith NPC');

  // Deterministic: same inputs → same pose, and identical across a fresh world.
  const a = npcRoutinePosition(npc, town, 1000);
  const b = npcRoutinePosition(npc, town, 1000);
  assert.deepEqual(a, b);
  const world2 = new AuthoredWorld(7319);
  const town2 = world2.getSettlements(r.x, r.y, r.w, r.h)[0];
  const npc2 = town2.buildings.map(buildingNPC).find(n => n && n.role === 'blacksmith')!;
  assert.deepEqual(npcRoutinePosition(npc2, town2, 1000), a);

  // Position changes over simulated time: sample the day, expect real movement.
  // Position changes over simulated time: sample the day densely, expect real
  // movement and at least one walking phase between stops.
  const positions = Array.from({ length: 288 }, (_, i) => npcRoutinePosition(npc, town, i * WORLD_TIME.daySeconds / 288));
  const spread = Math.max(...positions.map(p => Math.hypot(p.x - positions[0].x, p.y - positions[0].y)));
  assert.ok(spread > 20, `NPC should stroll (spread ${spread})`);
  assert.ok(positions.some(p => p.moving > 0), 'expected a walking phase');
  // Bounded: every sampled pose stays inside the town.
  for (const p of positions)
    assert.ok(Math.hypot(p.x - town.x, p.y - town.y) <= town.radius + 40, 'routine stays in town');
  // Periodic: a full day later the NPC is back at the same spot — near its anchor.
  const day = WORLD_TIME.daySeconds;
  assert.deepEqual(npcRoutinePosition(npc, town, 1000), npcRoutinePosition(npc, town, 1000 + day));
  const home = npcRoutine(npc, town).home;
  const closest = Math.min(...positions.map(p => Math.hypot(p.x - home.x, p.y - home.y)));
  assert.ok(closest < 1, `NPC returns to its anchor (closest ${closest})`);
  assert.equal(home.x, npc.x);
  assert.equal(home.y, npc.y);
});

test('positionedNPC moves the NPC and leaves stash fixtures standing', () => {
  const r = zoneRect('elwynn')!;
  const town = world.getSettlements(r.x, r.y, r.w, r.h)[0];
  const npc = town.buildings.map(buildingNPC).find(n => n && n.role === 'blacksmith')!;
  const moved = positionedNPC(npc, town, WORLD_TIME.daySeconds * 0.5);
  assert.notEqual(moved, npc);
  assert.ok(Math.hypot(moved.x - npc.x, moved.y - npc.y) > 0 || moved.moving !== undefined);
  // No town or no time → unchanged anchor (map views, static contexts).
  assert.equal(positionedNPC(npc, undefined, 100), npc);
  assert.equal(positionedNPC(npc, town, undefined), npc);
  // The stash fixture never wanders.
  const stash = town.buildings.map(buildingNPC).find(n => n && n.role === 'stash')!;
  assert.equal(positionedNPC(stash, town, 500), stash);
  // npcTown resolves the owning settlement for a building NPC.
  assert.equal(npcTown(world, npc)?.id, town.id);
});
