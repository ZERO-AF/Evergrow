import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION, type CharacterCheckpoint } from '../src/character-save.ts';
import { damageCombatant } from '../src/combat-damage.ts';
import { WOW_COMBAT } from '../src/wow-types.ts';
import { WOW_CLASSES } from '../src/wow-classes.ts';
import { createPetRecord } from '../src/pet-content.ts';
import { createCharacterSheet } from '../src/items.ts';
import type { Ally } from '../src/model.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }), isSanctuary: () => false };
const input = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const ally = (kind: Ally['kind'], extra: Partial<Ally> = {}): Ally => ({
  id: 9000 + Math.floor(Math.random() * 999), kind, x: 0, y: 0, prevX: 0, prevY: 0, angle: 0,
  hp: 100, maxHp: 100, damage: 5, stationary: false, targetId: null, attackCooldown: 0, radius: 8, ...extra });

test('tameBeast despawns the previous pet ally when a new pet is adopted', () => {
  const sim = new Simulation(world, { spawn: false });
  const wolf = sim.spawnEnemy('stalker', 40, 0)!;
  assert.equal(sim.tameBeast(wolf), 'tamed');
  const first = sim.player.character.pets!.active!;
  assert.equal(sim.player.allies!.length, 1);
  assert.equal(sim.player.allies![0]!.petId, first.id);
  const bear = sim.spawnEnemy('brute', 60, 0)!;
  assert.equal(sim.tameBeast(bear), 'tamed');
  const active = sim.player.character.pets!.active!;
  assert.notEqual(active.id, first.id);
  const petAllies = sim.player.allies!.filter(a => a.petId !== undefined);
  assert.equal(petAllies.length, 1, 'old pet ally must be despawned');
  assert.equal(petAllies[0]!.petId, active.id);
});

test('permanent demon summons replace each other; duration summons do not displace them', () => {
  const sim = new Simulation(world, { spawn: false });
  sim.summonAlly('imp', 1);
  sim.summonAlly('voidwalker', 1);
  sim.summonAlly('felguard', 1);
  const demons = sim.player.allies!.filter(a => ['imp', 'voidwalker', 'felguard', 'succubus', 'felhunter'].includes(a.kind));
  assert.equal(demons.length, 1);
  assert.equal(demons[0]!.kind, 'felguard');
  sim.summonAlly('infernal', 1, 60);
  assert.equal(sim.player.allies!.length, 2, 'temporary infernal coexists with the permanent demon');
});

test('pet-family summon with no active pet spawns nothing, and never respawns a live pet', () => {
  const sim = new Simulation(world, { spawn: false });
  sim.summonAlly('wolf', 1);
  assert.equal(sim.player.allies!.length, 0, 'Call Pet with no pet must not spawn a ghost wolf');
  const wolf = sim.spawnEnemy('stalker', 40, 0)!;
  sim.tameBeast(wolf);
  const pet = sim.player.allies![0]!;
  pet.hp = 10;
  sim.summonAlly('wolf', 1);
  assert.equal(sim.player.allies!.length, 1);
  assert.equal(sim.player.allies![0]!.hp, 10, 'live pet must not be respawned at full health');
});

test('restoreCheckpoint reserves pet and ally ids so post-load spawns never collide', () => {
  const sim = new Simulation(world, { spawn: false });
  const checkpoint = sim.captureCheckpoint() as CharacterCheckpoint & { allies?: Ally[] };
  checkpoint.character.pets = { active: createPetRecord(500, 'stalker', 5), stabled: [createPetRecord(501, 'brute', 3)] };
  checkpoint.allies = [ally('imp', { id: 502 })];
  const restored = new Simulation(world, { spawn: false });
  restored.restoreCheckpoint(checkpoint);
  const petAlly = restored.player.allies!.find(a => a.petId === 500)!;
  assert.ok(petAlly, 'active pet is summoned on load');
  assert.ok(petAlly.id > 502, `summoned pet id ${petAlly.id} must clear persisted ids`);
  const ids = restored.player.allies!.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
  const enemy = restored.spawnEnemy('stalker', 100, 0)!;
  assert.ok(enemy.id > 502, `next spawn id ${enemy.id} must clear persisted ids`);
});

test('save validation rejects a pet record whose allyKind is not the family template', () => {
  const sim = new Simulation(world, { spawn: false });
  const record = { version: CHARACTER_SAVE_VERSION, id: 'pet-forge', name: 'Rowan', createdAt: 1, updatedAt: 1, worldSeed: 7319, worldVersion: 5, checkpoint: sim.captureCheckpoint() };

  record.checkpoint.character.pets = { active: createPetRecord(7, 'stalker', 5), stabled: [] };
  assert.ok(decodeCharacterSave(JSON.stringify(record)), 'honest pet record decodes');
  const forged = JSON.parse(JSON.stringify(record));
  forged.checkpoint.character.pets.active.allyKind = 'infernal';
  assert.equal(decodeCharacterSave(JSON.stringify(forged)), null, 'crafted allyKind must be rejected');
});

test('restoreCheckpoint clears ally targets and taunts that dangle across fresh enemy ids', () => {
  const sim = new Simulation(world, { spawn: false });
  sim.spawnEnemy('stalker', 40, 0);
  const checkpoint = sim.captureCheckpoint() as CharacterCheckpoint & { allies?: Ally[]; actors?: Array<{ taunted?: { remaining: number; allyId?: number } }> };
  checkpoint.allies = [ally('imp', { id: 60, targetId: 999 }), ally('searingTotem', { id: 61, stationary: true })];
  checkpoint.actors![0]!.taunted = { remaining: 5, allyId: 999 };
  const restored = new Simulation(world, { spawn: false });
  restored.restoreCheckpoint(checkpoint);
  assert.ok(restored.player.allies!.every(a => a.targetId === null), 'stale enemy ids cannot rebind');
  assert.equal(restored.enemies[0]!.taunted!.allyId, undefined, 'taunt on a dead ally reverts to the player');
  assert.equal(restored.enemies[0]!.taunted!.remaining, 5, 'the taunt itself survives');
  const kept = sim.captureCheckpoint() as CharacterCheckpoint & { allies?: Ally[]; actors?: Array<{ taunted?: { remaining: number; allyId?: number } }> };
  kept.allies = [ally('imp', { id: 60 })];
  kept.actors![0]!.taunted = { remaining: 5, allyId: 60 };
  const second = new Simulation(world, { spawn: false });
  second.restoreCheckpoint(kept);
  assert.equal(second.enemies[0]!.taunted!.allyId, 60, 'taunt on a live ally is preserved');
});

test('save validation rejects allocated nodes belonging to another class sanctum', () => {
  const sim = new Simulation(world, { spawn: false });
  const record = { version: CHARACTER_SAVE_VERSION, id: 'node-forge', name: 'Rowan', createdAt: 1, updatedAt: 1, worldSeed: 7319, worldVersion: 5, checkpoint: sim.captureCheckpoint() };
  const foreign = `wow-mage-${WOW_CLASSES.mage.starterSkill}`;
  assert.notEqual(sim.player.character.classId, 'mage');
  const forged = JSON.parse(JSON.stringify(record));
  forged.checkpoint.character.allocatedNodes.push(foreign);
  assert.equal(decodeCharacterSave(JSON.stringify(forged)), null, 'foreign sanctum node must be rejected');
  assert.ok(decodeCharacterSave(JSON.stringify(record)), 'unmodified save still decodes');
});

test('petShare redirects into the pet or demon before totems', () => {
  const sim = new Simulation(world, { spawn: false });
  const p = sim.player;
  p.buffs = [{ name: 'Soul Link', color: '#fff', remaining: 10, duration: 10, petShare: 0.5 } as never];
  const totem = ally('searingTotem', { stationary: true });
  const pet = ally('wolf', { petId: 1 });
  p.allies = [totem, pet];
  damageCombatant(40, 0, 1, 'physical', { player: p, world, random: () => 1, emit: () => {} });
  assert.ok(pet.hp < 100, 'pet absorbs the shared hit');
  assert.equal(totem.hp, 100, 'totem is not the redirect target while a pet lives');
});

test('allyLeash covers ranged standoff: a staying pet inside the leash is not recalled', () => {
  assert.equal(WOW_COMBAT.allyLeash, 700, 'combat-radius leash (wow-transformation §5)');
  const sim = new Simulation(world, { spawn: false });
  const p = sim.player;
  p.character.pets = { active: createPetRecord(3, 'stalker', 5), stabled: [] };
  p.petCommand = 'stay';

  p.allies = [ally('wolf', { petId: 3, x: 50, y: 0 })];
  sim.update(0.05, input);
  const pet = p.allies[0]!;
  assert.equal(Math.hypot(pet.x - 50, pet.y), 0, 'pet inside the leash holds its stay position');
  p.allies = [ally('wolf', { petId: 3, x: 200, y: 0 })];
  sim.update(0.05, input);
  assert.equal(p.allies[0]!.x, 200, 'a staying pet inside the combat leash is not recalled');
  p.allies = [ally('wolf', { petId: 3, x: 900, y: 0 })];
  sim.update(0.05, input);
  assert.ok(p.allies[0]!.x < 900, 'pet beyond the leash is recalled');
});

test('totem auras tick mana, wards, stat buffs, cc-break and cleanse on the player in radius', () => {
  const sim = new Simulation(world, { spawn: false });
  const p = sim.player;
  p.character = createCharacterSheet('mage', 'undead');
  p.mana = 10; p.maxMana = 100;
  p.cc = [{ kind: 'stun', remaining: 5, breakOnDamage: false }, { kind: 'slow', remaining: 5, breakOnDamage: false, factor: .5 }];
  p.allies = [
    ally('manaSpringTotem', { stationary: true, aura: { kind: 'mana', amount: .015, radius: 140 } }),
    ally('tremorTotem', { stationary: true, aura: { kind: 'ccBreak', amount: 1.5, radius: 140 } }),
  ];
  for (let i = 0; i < 22; i++) sim.update(0.05, input);
  assert.ok(p.mana > 10, 'mana spring restores mana');
  assert.equal(p.cc, undefined, 'tremor breaks player crowd control');
  assert.ok((p.ccImmunity ?? 0) > 0, 'tremor grants immunity seconds');
  p.cc = [{ kind: 'stun', remaining: 5, breakOnDamage: false }, { kind: 'root', remaining: 5, breakOnDamage: false }];
  p.allies = [ally('cleansingTotem', { stationary: true, aura: { kind: 'cleanse', amount: 0, radius: 140 } })];
  for (let i = 0; i < 22; i++) sim.update(0.05, input);
  assert.equal(p.cc!.length, 1, 'cleanse strips one movement-impairing cc per tick');
  assert.equal(p.cc![0]!.kind, 'stun');
  p.allies = [ally('totemOfWrath', { stationary: true, aura: { kind: 'buff', amount: 0, radius: 140, stats: { spellDamagePercent: 6 } } })];
  for (let i = 0; i < 22; i++) sim.update(0.05, input);
  assert.ok(p.buffs!.some(b => b.id === 'totem:totemOfWrath'), 'stat ward refreshes as a player buff');
});

test('save validation accepts the extended aura kinds and rejects unknown ones', () => {
  const sim = new Simulation(world, { spawn: false });
  const record = { version: CHARACTER_SAVE_VERSION, id: 'aura-check', name: 'Rowan', createdAt: 1, updatedAt: 1, worldSeed: 7319, worldVersion: 5, checkpoint: sim.captureCheckpoint() };
  const checkpoint = record.checkpoint as CharacterCheckpoint & { allies?: Ally[] };
  checkpoint.allies = [ally('manaSpringTotem', { stationary: true, aura: { kind: 'mana', amount: .015, radius: 140 } })];
  assert.ok(decodeCharacterSave(JSON.stringify(record)), 'mana aura decodes');
  const forged = JSON.parse(JSON.stringify(record));
  forged.checkpoint.allies[0].aura = { kind: 'laser', amount: 1, radius: 10 };
  assert.equal(decodeCharacterSave(JSON.stringify(forged)), null, 'unknown aura kind rejected');
});

test('shadowfiend hits return mana to the priest', () => {
  const sim = new Simulation(world, { spawn: false });
  const p = sim.player;
  p.character = createCharacterSheet('mage', 'undead');
  p.mana = 10; p.maxMana = 100;
  const enemy = sim.spawnEnemy('stalker', 20, 0)!;
  enemy.awareness = 1;
  p.allies = [ally('shadowfiend', { x: 15, y: 0, remaining: 12 })];
  for (let i = 0; i < 32; i++) sim.update(0.05, input);
  assert.ok(p.mana > 10, 'shadowfiend attacks restore mana');
});
