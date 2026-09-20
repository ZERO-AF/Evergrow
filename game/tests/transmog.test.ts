import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
import { executeTransmogApply, executeTransmogClear } from '../src/transmog-command.ts';
import {
  ownedItem, pruneTransmog, transmogCompatible, transmogCost, transmogOf, transmogProblem,
  transmogSource, transmogSources, transmoggedEquipment, transmoggedSheet, validTransmogMap,
  type TransmoggedSheet,
} from '../src/transmog-state.ts';

const make = () => {
  const sim = new Simulation({ blocked: () => false, move: (x, y) => ({ x, y }) }, { spawn: false });
  sim.player.character = createCharacterSheet('warrior', 'human');
  refreshCharacter(sim.player);
  return sim;
};
const persist = async () => ({ ok: true as const });
const sheet = (sim: Simulation) => sim.player.character as TransmoggedSheet;

test('weapon looks keep handedness and attack kind; armor keeps its slot', () => {
  const sword2h = generateItem(11, 10, 'weapon', 'greatblade');
  const maul2h = generateItem(12, 10, 'weapon', 'grave-maul');
  const dagger1h = generateItem(13, 10, 'weapon', 'rondel-dagger');
  const bow = generateItem(14, 10, 'weapon', 'warden-longbow');
  const chest = generateItem(15, 10, 'chest');
  const helm = generateItem(16, 10, 'head');
  assert.equal(transmogCompatible(sword2h, maul2h, 'weapon'), true);
  assert.equal(transmogCompatible(sword2h, dagger1h, 'weapon'), false, '2H cannot wear a 1H look');
  assert.equal(transmogCompatible(sword2h, bow, 'weapon'), false, 'melee cannot wear a bow look');
  assert.equal(transmogCompatible(chest, helm, 'chest'), false);
  assert.equal(transmogCompatible(chest, chest, 'chest'), false, 'an item is never its own source');
  const shield = generateItem(17, 10, 'shield', 'vigil-kite');
  const orb = generateItem(18, 10, 'orb', 'rime-orb');
  const grimoire = generateItem(19, 10, 'grimoire', 'astral-grimoire');
  assert.equal(transmogCompatible(orb, grimoire, 'offhand'), true, 'focus off-hands share one family');
  assert.equal(transmogCompatible(orb, shield, 'offhand'), false);
  assert.equal(transmogCompatible(shield, orb, 'offhand'), false);
});

test('transmoggedSheet swaps only the look; stats stay on the real item', () => {
  const sim = make();
  const real = generateItem(21, 10, 'weapon', 'greatblade');
  const look = generateItem(22, 10, 'weapon', 'grave-maul');
  real.implicit = { strength: 40 };
  look.implicit = { strength: 1 };
  sim.player.character.equipped.weapon = real;
  sim.player.character.inventory[0] = look;
  refreshCharacter(sim.player);
  sheet(sim).transmog = { weapon: look.id };
  const view = transmoggedSheet(sim.player.character);
  assert.equal(view.equipped.weapon, look, 'visual read resolves the source item');
  assert.equal(sim.player.character.equipped.weapon, real, 'real equipment untouched');
  const equipment = transmoggedEquipment(sim.player.equipment, sim.player.character);
  assert.equal(equipment.mainHand.visual, look.weapon!.visual, 'drawn model is the source');
  assert.equal(equipment.mainHand.damage, real.weapon!.damage, 'damage stays on the real weapon');
  assert.equal(equipment.mainHand.reach, real.weapon!.reach);
});

test('apply spends gold, persists on the character, and clear restores for free', async () => {
  const sim = make();
  const real = generateItem(31, 10, 'weapon', 'greatblade');
  const look = generateItem(32, 10, 'weapon', 'grave-maul');
  sim.player.character.equipped.weapon = real;
  sim.player.character.inventory[3] = look;
  sim.player.character.gold = 1_000_000;
  refreshCharacter(sim.player);
  const cost = transmogCost(real);
  const applied = await executeTransmogApply(sim, 'weapon', look.id, persist);
  assert.equal(applied.ok, true, applied.message);
  assert.equal(transmogOf(sim.player.character)?.weapon, look.id);
  assert.equal(sim.player.character.gold, 1_000_000 - cost);
  const cleared = await executeTransmogClear(sim, 'weapon', persist);
  assert.equal(cleared.ok, true, cleared.message);
  assert.equal(transmogOf(sim.player.character), undefined);
  assert.equal(sim.player.character.gold, 1_000_000 - cost, 'restore is free');
});

test('apply rejects unaffordable, incompatible and unowned sources atomically', async () => {
  const sim = make();
  const real = generateItem(41, 10, 'weapon', 'greatblade');
  const look = generateItem(42, 10, 'weapon', 'grave-maul');
  const dagger = generateItem(43, 10, 'weapon', 'rondel-dagger');
  sim.player.character.equipped.weapon = real;
  sim.player.character.inventory[0] = look;
  sim.player.character.inventory[1] = dagger;
  sim.player.character.gold = 0;
  refreshCharacter(sim.player);
  const poor = await executeTransmogApply(sim, 'weapon', look.id, persist);
  assert.equal(poor.ok, false);
  assert.equal(transmogOf(sim.player.character), undefined);
  sim.player.character.gold = 1_000_000;
  const wrong = await executeTransmogApply(sim, 'weapon', dagger.id, persist);
  assert.equal(wrong.ok, false);
  assert.match(wrong.message ?? '', /handedness|attack style/i);
  const missing = await executeTransmogApply(sim, 'weapon', 'item-not-owned', persist);
  assert.equal(missing.ok, false);
  assert.equal(transmogOf(sim.player.character), undefined);
  assert.equal(sim.player.character.gold, 1_000_000, 'failed applies never spend gold');
});

test('a sold or dropped source silently reverts the slot to its true appearance', () => {
  const sim = make();
  const real = generateItem(51, 10, 'weapon', 'greatblade');
  const look = generateItem(52, 10, 'weapon', 'grave-maul');
  sim.player.character.equipped.weapon = real;
  sim.player.character.inventory[0] = look;
  sheet(sim).transmog = { weapon: look.id };
  assert.equal(transmogSource(sim.player.character, 'weapon'), look);
  sim.player.character.inventory[0] = null;
  assert.equal(transmogSource(sim.player.character, 'weapon'), null);
  assert.equal(transmoggedSheet(sim.player.character).equipped.weapon, real);
  assert.equal(pruneTransmog(sim.player.character), undefined, 'stale entries prune to nothing');
});

test('picker lists only compatible owned items; validation bounds the save field', () => {
  const sim = make();
  const real = generateItem(61, 10, 'weapon', 'greatblade');
  const maul = generateItem(62, 10, 'weapon', 'grave-maul');
  const dagger = generateItem(63, 10, 'weapon', 'rondel-dagger');
  const helm = generateItem(64, 10, 'head');
  sim.player.character.equipped.weapon = real;
  sim.player.character.inventory[0] = maul;
  sim.player.character.inventory[1] = dagger;
  sim.player.character.inventory[2] = helm;
  const sources = transmogSources(sim.player.character, 'weapon');
  assert.deepEqual(sources.map(i => i.id), [maul.id]);
  assert.equal(ownedItem(sim.player.character, maul.id), maul);
  assert.equal(transmogProblem(sim.player.character, 'amulet', maul), 'That slot has no visible model.');
  assert.equal(validTransmogMap({ weapon: maul.id }), true);
  assert.equal(validTransmogMap({ weapon: 5 }), false);
  assert.equal(validTransmogMap({ bogus: maul.id }), false);
  assert.equal(validTransmogMap('weapon'), false);
});
