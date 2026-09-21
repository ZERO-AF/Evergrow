import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation, initialPlayer } from '../src/simulation.ts';
import { createCharacterSheet } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
import { isCombatant, combatants, hostiles, allies, aliveCombatants } from '../src/pvp-combatant.ts';
import { decideCombatantInput } from '../src/pvp-ai.ts';
import { combatantControl } from '../src/pvp-status.ts';
import type { Player } from '../src/model.ts';
import type { WowClassId } from '../src/wow-types.ts';
import { createWowSim, idleInput, raceForClass } from './fixtures/wow-sim.ts';

/** A Player-shaped NPC: real character sheet, derived stats, one granted skill. */
function npcPlayer(classId: WowClassId, x: number, y: number, skill?: string): Player {
  const p = initialPlayer(x, y);
  p.character = createCharacterSheet(classId, raceForClass(classId));
  if (skill) { p.character.allocatedNodes = ['origin', `skill:${skill}`]; p.character.skillSlots[0] = skill as never; }
  refreshCharacter(p);
  p.mana = p.maxMana;
  return p;
}

function advance(sim: Simulation, seconds: number): void {
  const steps = Math.round(seconds / FIXED_STEP);
  for (let i = 0; i < steps; i++) sim.update(FIXED_STEP, idleInput);
}

test('enterPvp wraps the player and NPCs as team combatants', () => {
  const sim = createWowSim('warrior');
  const ally = npcPlayer('priest', 60, 0);
  const foe = npcPlayer('mage', 400, 0);
  const roster = sim.enterPvp([ally, foe], ['A', 'B']);
  assert.equal(roster.length, 3);
  assert.equal(roster[0], sim.player);
  assert.equal(roster[0]!.team, 'A');
  assert.equal(roster[1]!.team, 'A');
  assert.equal(roster[2]!.team, 'B');
  assert.ok(isCombatant(sim.player));
  assert.deepEqual(hostiles(roster[2]!, sim).map(c => c.id).sort(), [roster[0]!.id, roster[1]!.id].sort());
  assert.deepEqual(allies(roster[0]!, sim).map(c => c.id), [roster[1]!.id]);
  assert.equal(aliveCombatants(combatants(sim)).length, 3);
  sim.leavePvp();
  assert.ok(!isCombatant(sim.player));
  assert.equal(combatants(sim).length, 0);
});

test('the class AI synthesizes a real Input: target, approach, skill', () => {
  const sim = createWowSim('warrior');
  const foe = npcPlayer('mage', 400, 0);
  const roster = sim.enterPvp([foe], ['B']);
  const npc = roster[1]!;
  const input = decideCombatantInput({ self: npc, allies: [npc], hostiles: [roster[0]!], time: sim.time });
  assert.equal(input.targetId, roster[0]!.id);
  assert.equal(input.aimX, roster[0]!.x);
  // A mage kites toward preferred range: far away means move toward the target.
  assert.ok(input.moveX! < 0, `expected moveX<0 toward player, got ${input.moveX}`);
  sim.leavePvp();
});

test('two NPC combatants fight with real skills until one is a corpse', () => {
  const sim = createWowSim('warrior');
  const ally = npcPlayer('priest', 60, 0, 'smite');
  const foe = npcPlayer('mage', 300, 0, 'fireball');
  const roster = sim.enterPvp([ally, foe], ['A', 'B']);
  const npc = roster[2]!;
  // Up to 90s of sim: someone must die. The idle player is a valid target too.
  for (let i = 0; i < Math.round(90 / FIXED_STEP) && !roster.some(c => c.dead); i++)
    sim.update(FIXED_STEP, idleInput);
  assert.ok(roster.some(c => c.dead), 'expected a combatant death within 90s');
  const corpse = roster.find(c => c.dead)!;
  assert.equal(corpse.state, 'dead');
  assert.equal(corpse.hp, 0);
  // The mage fought for real: mana spent on casts, or it died trying.
  assert.ok(npc.mana < npc.maxMana || npc.dead, 'mage should have spent mana casting');
  sim.leavePvp();
});

test('a dead player becomes a corpse, not a defeat: the sim keeps stepping', () => {
  const sim = createWowSim('warrior');
  const foe = npcPlayer('mage', 120, 0);
  const roster = sim.enterPvp([foe], ['B']);
  sim.player.hp = 1;
  advance(sim, 30);
  assert.ok(sim.player.dead, 'mage should have killed the idle player');
  assert.equal((sim.player as typeof roster[0]).state, 'dead');
  // The match continues: further updates neither throw nor resurrect.
  advance(sim, 2);
  assert.ok(sim.player.dead);
  sim.leavePvp();
});

test('combatant CC suppresses actions and ticks dots on the player surface', () => {
  const sim = createWowSim('mage');
  const foe = npcPlayer('warrior', 40, 0);
  const roster = sim.enterPvp([foe], ['B']);
  const npc = roster[1]!;
  // Stun the NPC: its next decisions are suppressed by combatantControl.
  npc.stunTime = 1;
  const control = combatantControl(npc);
  assert.ok(control.cantAct);
  const input = decideCombatantInput({ self: npc, allies: [npc], hostiles: [roster[0]!], time: sim.time });
  assert.equal(input.skillSlot, null);
  assert.equal(input.attack, false);
  // A dot on the player ticks through the combatant damage path.
  sim.player.dots = [{ id: 'dot:fire', source: 'ally', school: 'fire', dps: 50, remaining: 2, interval: 0.5, tick: 0 }];
  const hp = sim.player.hp;
  advance(sim, 1);
  assert.ok(sim.player.hp < hp, 'player dot should have ticked');
  sim.leavePvp();
});
