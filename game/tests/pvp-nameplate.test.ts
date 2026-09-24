import test from 'node:test';
import assert from 'node:assert/strict';
import { collectNameplates } from '../src/nameplate.ts';
import { cameraView } from '../src/camera.ts';
import { initialPlayer } from '../src/simulation.ts';
import { createCharacterSheet } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
import { createWowSim, raceForClass } from './fixtures/wow-sim.ts';
import type { Player } from '../src/model.ts';
import type { WowClassId } from '../src/wow-types.ts';

function npcPlayer(classId: WowClassId, x: number, y: number): Player {
  const p = initialPlayer(x, y);
  p.character = createCharacterSheet(classId, raceForClass(classId));
  refreshCharacter(p);
  p.mana = p.maxMana;
  return p;
}

test('pvp combatants get nameplates with team coloring and live casts', () => {
  const sim = createWowSim('warrior');
  const ally = npcPlayer('priest', 60, 0);
  const foe = npcPlayer('mage', 400, 0);
  foe.name = 'Enemy Mage';
  const roster = sim.enterPvp([ally, foe], ['A', 'B']);
  // Camera centered on the player so both combatants are on screen.
  const view = cameraView(1600, 900, sim.player.x, sim.player.y, 1);
  const plates = collectNameplates(sim, view, 'always');
  const allyPlate = plates.find(n => n.id === roster[1]!.id);
  const foePlate = plates.find(n => n.id === roster[2]!.id);
  assert.ok(allyPlate, 'ally combatant should have a nameplate');
  assert.ok(foePlate, 'enemy combatant should have a nameplate');
  assert.equal(allyPlate!.team, 'A');
  assert.equal(foePlate!.team, 'B');
  assert.equal(foePlate!.name, 'Enemy Mage');
  assert.equal(foePlate!.hp, foe.hp);
  assert.equal(foePlate!.maxHp, foe.maxHp);
  // The real player (combatant[0]) must not get a duplicate plate.
  assert.ok(!plates.some(n => n.id === roster[0]!.id), 'real player should not have a self nameplate');
  sim.leavePvp();
});

test('combatant cast surfaces on the nameplate', () => {
  const sim = createWowSim('warrior');
  const foe = npcPlayer('mage', 400, 0);
  const roster = sim.enterPvp([foe], ['B']);
  const npc = roster[1]!;
  npc.cast = { skill: 'fireball' as never, remaining: 1.2, duration: 2 };
  const view = cameraView(1600, 900, sim.player.x, sim.player.y, 1);
  const plate = collectNameplates(sim, view, 'always').find(n => n.id === npc.id);
  assert.ok(plate?.casting, 'casting combatant should expose a cast bar');
  assert.equal(plate!.casting!.spell, 'Fireball');
  assert.ok(plate!.casting!.progress > 0 && plate!.casting!.progress < 1);
  sim.leavePvp();
});
