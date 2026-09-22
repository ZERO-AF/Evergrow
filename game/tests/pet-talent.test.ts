import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';
import { createPetRecord, petStatsFor, type PetRecord } from '../src/pet-content.ts';
import { PET_FAMILY_TREE, PET_TALENTS, petTalentTreeTalents } from '../src/pet-talent-content.ts';
import {
  allocatePetTalent, petTalentBonuses, petTalentPoints, petTalentPointsRemaining,
  petTalentSpent, resetPetTalents,
} from '../src/pet-talent-state.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }), isSanctuary: () => false };

/** Allocate `id` `times` ranks, asserting each step succeeds. */
const learn = (pet: PetRecord, id: string, times = 1): PetRecord => {
  for (let i = 0; i < times; i++) {
    const result = allocatePetTalent(pet, id);
    assert.ok(result.ok, `expected ${id} rank ${i + 1} to allocate: ${result.ok ? '' : result.message}`);
    pet = result.pet;
  }
  return pet;
};

test('petTalentPoints grants one point per four levels', () => {
  assert.equal(petTalentPoints({ level: 3 }), 0);
  assert.equal(petTalentPoints({ level: 4 }), 1);
  assert.equal(petTalentPoints({ level: 20 }), 5);
  assert.equal(petTalentPoints({ level: 80 }), 20);
});

test('every pet family maps to a tree with real talents', () => {
  for (const [family, tree] of Object.entries(PET_FAMILY_TREE)) {
    assert.ok(['ferocity', 'tenacity', 'cunning'].includes(tree), `${family} tree`);
    assert.ok(petTalentTreeTalents(tree).length >= 8, `${tree} has talents`);
  }
  for (const talent of Object.values(PET_TALENTS)) {
    assert.ok(talent.tier >= 1 && talent.maxRanks >= 1 && talent.maxRanks <= 3, `${talent.id} shape`);
    if (talent.requires) assert.ok(PET_TALENTS[talent.requires.id], `${talent.id} prerequisite exists`);
  }
});

test('allocatePetTalent enforces the family tree', () => {
  const cat = createPetRecord(1, 'stalker', 40); // ferocity
  assert.equal(allocatePetTalent(cat, 'tenacity.taunt').ok, false, 'tenacity talent on a ferocity pet');
  assert.equal(allocatePetTalent(cat, 'cunning.dash').ok, false, 'cunning talent on a ferocity pet');
  assert.equal(allocatePetTalent(cat, 'pet.nope').ok, false, 'unknown talent id');
  const bear = createPetRecord(2, 'brute', 40); // tenacity
  assert.ok(allocatePetTalent(bear, 'tenacity.greatStamina').ok, 'tenacity pet learns tenacity talent');
  assert.equal(allocatePetTalent(bear, 'ferocity.dive').ok, false, 'ferocity talent on a tenacity pet');
});

test('allocation spends points, respects the rank cap, and never mutates the record', () => {
  const pet = createPetRecord(1, 'stalker', 20); // 5 points
  const grown = learn(pet, 'ferocity.greatStamina', 3);
  assert.equal(pet.talents, undefined, 'original record untouched');
  assert.equal(grown.talents?.['ferocity.greatStamina'], 3);
  assert.equal(petTalentSpent(grown), 3);
  assert.equal(petTalentPointsRemaining(grown), 2);
  const capped = allocatePetTalent(grown, 'ferocity.greatStamina');
  assert.equal(capped.ok, false, 'rank cap blocks a fourth rank');
  assert.match(capped.ok ? '' : capped.message, /rank 3/);
});

test('tier gating requires points spent in earlier tiers', () => {
  const pet = createPetRecord(1, 'stalker', 40); // 10 points
  assert.equal(allocatePetTalent(pet, 'ferocity.spikedCollar').ok, false, 'tier 2 locked at 0 spent');
  const t1 = learn(pet, 'ferocity.greatStamina', 3); // 3 spent below tier 2
  const t2 = learn(t1, 'ferocity.spikedCollar', 3); // tier 2 unlocked; 6 spent below tier 3
  const gated = allocatePetTalent(t2, 'ferocity.heartOfThePhoenix');
  assert.equal(gated.ok, false, 'tier 4 needs 9 points below it');
  assert.match(gated.ok ? '' : gated.message, /earlier tiers/);
  const t3 = learn(t2, 'ferocity.cullingTheHerd', 1); // 7 spent
  const t4 = learn(t3, 'ferocity.dive', 1);          // 8 spent
  const t5 = learn(t4, 'ferocity.cobraReflexes', 1); // 9 spent below tier 4
  assert.ok(allocatePetTalent(t5, 'ferocity.heartOfThePhoenix').ok, 'tier 4 opens at 9 spent');
});

test('direct prerequisites require the named talent at its rank', () => {
  const pet = createPetRecord(1, 'stalker', 40);
  const t1 = learn(pet, 'ferocity.greatStamina', 3);
  const t2 = learn(t1, 'ferocity.spikedCollar', 2);   // 5 spent
  const t3 = learn(t2, 'ferocity.cobraReflexes', 1);  // 6 spent: tier 3 open, but spikedCollar < 3
  const blocked = allocatePetTalent(t3, 'ferocity.cullingTheHerd');
  assert.equal(blocked.ok, false, 'cullingTheHerd needs Spiked Collar 3');
  assert.match(blocked.ok ? '' : blocked.message, /Spiked Collar/);
  const t4 = learn(t3, 'ferocity.spikedCollar', 1);
  assert.ok(allocatePetTalent(t4, 'ferocity.cullingTheHerd').ok, 'prerequisite met');
});

test('the point budget blocks allocation when spent out', () => {
  const pet = createPetRecord(1, 'stalker', 8); // 2 points
  const spent = learn(learn(pet, 'ferocity.dive'), 'ferocity.cobraReflexes');
  assert.equal(petTalentPointsRemaining(spent), 0);
  const blocked = allocatePetTalent(spent, 'ferocity.cobraReflexes');
  assert.equal(blocked.ok, false);
  assert.match(blocked.ok ? '' : blocked.message, /unspent/);
});

test('resetPetTalents refunds every rank', () => {
  const pet = learn(createPetRecord(1, 'stalker', 20), 'ferocity.greatStamina', 2);
  const reset = resetPetTalents(pet);
  assert.equal(reset.talents, undefined);
  assert.equal(petTalentSpent(reset), 0);
  assert.equal(petTalentPointsRemaining(reset), 5);
  assert.equal(resetPetTalents(reset), reset, 'resetting an unspent pet is a no-op');
});

test('petTalentBonuses aggregates stats and named effects across ranks', () => {
  let pet = createPetRecord(1, 'stalker', 40);
  pet = learn(pet, 'ferocity.greatStamina', 3);   // +4% hp per rank
  pet = learn(pet, 'ferocity.spikedCollar', 3);   // +3% damage per rank
  pet = learn(pet, 'ferocity.dive', 1);           // granted ability
  pet = learn(pet, 'ferocity.cobraReflexes', 2);  // +15% attack speed per rank
  const bonuses = petTalentBonuses(pet);
  assert.equal(bonuses.stats.maxHpPercent, 12);
  assert.equal(bonuses.stats.damagePercent, 9);
  assert.equal(bonuses.stats.attackSpeedPercent, 30);
  assert.equal(bonuses.effects.dive, 1, 'binary grants aggregate as rank count');
  assert.deepEqual(petTalentBonuses(createPetRecord(2, 'brute', 40)), { stats: {}, effects: {} });
});

test('petStatsFor folds allocated talents into maxHp and damage', () => {
  const base = createPetRecord(1, 'stalker', 40);
  const plain = petStatsFor(base);
  const talented = learn(learn(base, 'ferocity.greatStamina', 3), 'ferocity.spikedCollar', 3);
  const boosted = petStatsFor(talented);
  assert.ok(Math.abs(boosted.maxHp - plain.maxHp * 1.12) <= 1, `Great Stamina 3 = +12% health (${plain.maxHp} → ${boosted.maxHp})`);
  assert.ok(Math.abs(boosted.damage - plain.damage * 1.09) <= 1, `Spiked Collar 3 = +9% damage (${plain.damage} → ${boosted.damage})`);
});

test('save validation accepts pet talents and rejects malformed ranks', () => {
  const sim = new Simulation(world, { spawn: false });
  const record = { version: CHARACTER_SAVE_VERSION, id: 'pet-talents', name: 'Rowan', createdAt: 1, updatedAt: 1, worldSeed: 7319, worldVersion: 5, checkpoint: sim.captureCheckpoint() };
  const pet = learn(createPetRecord(7, 'stalker', 40), 'ferocity.greatStamina', 2);
  record.checkpoint.character.pets = { active: pet, stabled: [] };
  assert.ok(decodeCharacterSave(JSON.stringify(record)), 'honest talents decode');

  const forged = (mutate: (talents: Record<string, unknown>) => void) => {
    const copy = JSON.parse(JSON.stringify(record));
    mutate(copy.checkpoint.character.pets.active.talents);
    return copy;
  };
  assert.equal(decodeCharacterSave(JSON.stringify(forged(t => { t['ferocity.greatStamina'] = 4; }))), null, 'rank above the cap rejected');
  assert.equal(decodeCharacterSave(JSON.stringify(forged(t => { t['ferocity.greatStamina'] = 0; }))), null, 'rank zero rejected');
  assert.equal(decodeCharacterSave(JSON.stringify(forged(t => { t['ferocity.greatStamina'] = 1.5; }))), null, 'fractional rank rejected');
  assert.equal(decodeCharacterSave(JSON.stringify(forged(t => { t['ferocity.fake'] = 1; }))), null, 'unknown talent id rejected');
  assert.equal(decodeCharacterSave(JSON.stringify(forged(t => { t['tenacity.taunt'] = 1; }))), null, 'foreign tree talent rejected');
});
