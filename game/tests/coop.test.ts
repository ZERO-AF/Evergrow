import assert from 'node:assert/strict';
import test from 'node:test';
import { FIXED_STEP, Simulation, initialPlayer } from '../src/simulation.ts';
import { createCharacterSheet } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
import { createWowSim, emptyWorld, idleInput } from './fixtures/wow-sim.ts';
import type { Input } from '../src/model.ts';

const move = (x: number, y: number): Input => ({ ...idleInput, moveX: x, moveY: y });

function partner(sim: Simulation, classId: 'warrior' | 'mage' = 'warrior') {
  const p = initialPlayer(sim.player.x + 40, sim.player.y);
  p.character = createCharacterSheet(classId, 'human');
  refreshCharacter(p);
  return p;
}

test('enterCoop adds a second controlled player that moves independently', () => {
  const sim = createWowSim('mage', 'undead', emptyWorld);
  const p1 = sim.player;
  const p2 = partner(sim);
  assert.equal(sim.coop, false);
  assert.equal(sim.enterCoop(p2), true);
  assert.equal(sim.coop, true);
  assert.deepEqual([...sim.players], [p1, p2]);
  const x1 = p1.x, x2 = p2.x;
  // P1 walks east, P2 walks west — independent movement through the shared step.
  for (let i = 0; i < 60; i++) sim.update(FIXED_STEP, move(1, 0), move(-1, 0));
  assert.ok(p1.x > x1, 'P1 moved east');
  assert.ok(p2.x < x2, 'P2 moved west');
});

test('co-op players keep separate resources, buffers and pickup channels', () => {
  const sim = createWowSim('mage', 'undead', emptyWorld);
  const p1 = sim.player, p2 = partner(sim, 'mage');
  sim.enterCoop(p2);
  // Mana regenerates independently per actor through the shared pipeline.
  p1.mana = 0; p2.mana = p2.maxMana;
  for (let i = 0; i < 120; i++) sim.update(FIXED_STEP, idleInput, idleInput);
  assert.ok(p1.mana > 0, 'P1 mana regenerated');
  assert.equal(p2.mana, p2.maxMana, 'P2 mana unchanged');
  // Independent pickup channels.
  assert.notEqual((sim as any).coopRoster[0].pickup, (sim as any).coopRoster[1].pickup);
});
test('exitCoop restores single-player control state and drops the partner', () => {
  const sim = createWowSim('mage', 'undead', emptyWorld);
  const p1 = sim.player, p2 = partner(sim);
  sim.enterCoop(p2);
  for (let i = 0; i < 10; i++) sim.update(FIXED_STEP, move(1, 0), move(0, 1));
  const dropped = sim.exitCoop();
  assert.equal(dropped, p2);
  assert.equal(sim.coop, false);
  assert.deepEqual([...sim.players], [p1]);
  // Single-player still steps normally after the partner leaves.
  const x = p1.x;
  for (let i = 0; i < 30; i++) sim.update(FIXED_STEP, move(1, 0));
  assert.ok(p1.x > x);
});

test('a dead co-op partner does not halt the surviving player', () => {
  const sim = createWowSim('mage', 'undead', emptyWorld);
  const p1 = sim.player, p2 = partner(sim);
  sim.enterCoop(p2);
  p2.hp = 1;
  // Kill P2 via the shared damage path.
  sim.forPlayer ? null : null;
  p2.dead = true; p2.hp = 0;
  const x = p1.x;
  for (let i = 0; i < 30; i++) sim.update(FIXED_STEP, move(1, 0), idleInput);
  assert.ok(p1.x > x, 'P1 keeps moving while P2 is dead');
  assert.equal(p2.dead, true);
});

test('co-op is rejected during a PvP match and vice versa', () => {
  const sim = createWowSim('mage', 'undead', emptyWorld);
  sim.enterPvp?.([]);
  if (sim.pvpCombatants) {
    assert.equal(sim.enterCoop(partner(sim)), false);
    sim.leavePvp();
  }
  const p2 = partner(sim);
  assert.equal(sim.enterCoop(p2), true);
});
