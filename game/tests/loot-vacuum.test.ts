import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { LOOT_RULES } from '../src/combat-content.ts';
import { TREASURE_FLIGHT_DURATION } from '../src/treasure-flight.ts';
import type { Input, WorldQuery } from '../src/model.ts';

const open: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const idle: Input = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };

function setup() {
  const sim = new Simulation(open, { spawn: false, seed: 984319 });
  sim.player.x = sim.player.y = 0;
  return sim;
}
function advance(sim: Simulation, seconds: number) {
  for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) sim.update(FIXED_STEP, idle);
}
const lootEvents = (sim: Simulation) => sim.drainEvents().filter(e => e.type === 'loot');

test('loot inside the magnet radius glides to the player and collects exactly once', () => {
  const sim = setup();
  const item = generateItem(901, 1, 'ring');
  sim.groundItems.push({ id: 901, x: LOOT_RULES.equipmentMagnetDistance - 30, y: 0, item });
  sim.update(FIXED_STEP, idle);
  const drop = sim.groundItems[0];
  assert.ok(drop, 'one tick cannot collect from outside the collect radius');
  assert.ok(drop.x < LOOT_RULES.equipmentMagnetDistance - 30, 'the drop glides toward the player');
  assert.equal(lootEvents(sim).length, 0, 'gliding never awards early');
  advance(sim, 2);
  assert.equal(sim.groundItems.length, 0);
  assert.deepEqual(sim.player.character.inventory.find(i => i?.id === item.id), item);
  assert.equal(lootEvents(sim).length, 1, 'the award path fires exactly once');
  advance(sim, .5);
  assert.equal(lootEvents(sim).length, 0, 'collected loot never re-awards');
});

test('loot outside the magnet radius stays put', () => {
  const sim = setup();
  sim.groundItems.push({ id: 901, x: LOOT_RULES.equipmentMagnetDistance + 110, y: 0, item: generateItem(901, 1, 'ring') });
  advance(sim, 1);
  assert.equal(sim.groundItems.length, 1);
  assert.equal(sim.groundItems[0].x, LOOT_RULES.equipmentMagnetDistance + 110);
  assert.equal(lootEvents(sim).length, 0);
});

test('an airborne treasure flight is not vacuumed until it lands', () => {
  const sim = setup();
  const item = generateItem(902, 1, 'ring');
  sim.groundItems.push({ id: 902, x: 60, y: 0, item, flight: { x: 0, y: 0, at: sim.time, delay: 0 } });
  advance(sim, TREASURE_FLIGHT_DURATION * .5);
  assert.equal(sim.groundItems.length, 1, 'flight loot waits for landing');
  assert.equal(sim.groundItems[0].x, 60, 'the landing target never moves mid-flight');
  assert.equal(lootEvents(sim).length, 0);
  advance(sim, TREASURE_FLIGHT_DURATION + 1);
  assert.equal(sim.groundItems.length, 0);
  assert.deepEqual(sim.player.character.inventory.find(i => i?.id === item.id), item);
});

test('a full pack leaves ground loot untouched and silent', () => {
  const sim = setup();
  sim.player.character.inventory = Array.from({ length: 120 }, (_, i) => i < 72 ? generateItem(900 + i, 1, 'ring') : null);
  sim.groundItems.push({ id: 901, x: 10, y: 0, item: generateItem(901, 1, 'ring') });
  advance(sim, .5);
  assert.equal(sim.groundItems.length, 1);
  assert.equal(sim.groundItems[0].x, 10, 'unpackable loot never glides');
  assert.equal(sim.drainEvents().filter(e => e.type === 'loot' || e.type === 'notice').length, 0);
});
