import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, initialPlayer } from '../src/simulation.ts';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
import { createWowSim, emptyWorld } from './fixtures/wow-sim.ts';
import type { DungeonEntrance } from '../src/dungeon.ts';
import { createDungeonRun, emptyContents, freshExpeditions, type StoredActor } from '../src/dungeon-state.ts';
import { validActors, validExpeditions } from '../src/dungeon-validation.ts';
import { scaledEnemyStats } from '../src/zone-progression.ts';
import { applyEnemyModifiers } from '../src/enemy-modifiers.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { specSpentPoints, validSpec, validSpecs, applySpec, emptySpec, dualSpecView, captureSpec } from '../src/dual-spec-state.ts';
import { trainedNodeIds, type TrainedSheet } from '../src/trainer-state.ts';
import { hearthstoneCast } from '../src/hearthstone.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';
import type { Player } from '../src/model.ts';

const roundTrip = <T>(v: T): T => JSON.parse(JSON.stringify(v));

// --- VALIDATION-RESET: heroic dungeon actors ---------------------------------
// A mid-dungeon save stores live dungeon enemies in the checkpoint's top-level
// `actors`; on Heroic the boss carries doubled maxHp. The validator used to cap
// hp at the non-heroic max and reject the whole save (silent reset on load).
const bossActor = (heroic: boolean): StoredActor => {
  const stats = applyEnemyModifiers(scaledEnemyStats('warden', 4, 'elite'), { kind: 'warden', rank: 'elite', heroic });
  return { kind: 'warden', rank: 'elite', level: 4, biome: 'deadwood', seed: 7319,
    x: 10, y: 10, homeX: 10, homeY: 10, hp: stats.maxHp };
};

test('validActors accepts a heroic boss at doubled maxHp only when heroic', () => {
  const heroicBoss = bossActor(true);
  assert.equal(validActors(roundTrip([heroicBoss]), true), true, 'heroic boss must validate in a heroic run');
  assert.equal(validActors(roundTrip([heroicBoss]), false), false, 'same hp must still fail for a normal run');
  const normalBoss = bossActor(false);
  assert.equal(validActors(roundTrip([normalBoss])), true);
});

test('validExpeditions accepts heroic run contents and bossPhases bits up to 31', () => {
  const entrance: DungeonEntrance = { id: 'dungeon:test', name: 'Rootbound Crypt', seed: 7319, level: 4, biome: 'deadwood', x: 600, y: 0 };
  const heroicEntrance: DungeonEntrance = { ...entrance, scaling: { base: 4, min: 4, max: 4, heroic: true } };

  // Raid bosses latch phase bits 4/8/16 (max 31); the old cap of 3 rejected saves.
  const state = freshExpeditions();
  const run = createDungeonRun(entrance);
  run.states.warden!.bossPhases = 16;
  state.runs.push(run);
  assert.equal(validExpeditions(roundTrip(state)), true, 'bossPhases bit 16 must validate');

  // A heroic run's contents may hold the doubled-hp boss.
  const heroic = freshExpeditions();
  const heroicRun = createDungeonRun(heroicEntrance);
  heroicRun.contents.actors.push(bossActor(true));
  heroic.runs.push(heroicRun);
  assert.equal(validExpeditions(roundTrip(heroic)), true, 'heroic run contents must validate');

  // The same actor in a non-heroic run is still corrupt data.
  const normal = freshExpeditions();
  const normalRun = createDungeonRun(entrance);
  normalRun.contents.actors.push(bossActor(true));
  normal.runs.push(normalRun);
  assert.equal(validExpeditions(roundTrip(normal)), false, 'heroic hp in a normal run must still fail');
});

// --- VALIDATION-RESET: dual-spec + trained nodes ------------------------------
// Gold-trained class skills keep their `wow-<class>-<skill>` node in
// allocatedNodes but cost no talent points. specSpentPoints counted them, so a
// stored spec containing a trained node failed the point budget on load.
test('specSpentPoints excludes gold-trained nodes', () => {
  const spec = { allocatedNodes: ['origin', 'wow-warrior-heroicStrike', 'wow-warrior-slam'], skillRanks: {} };
  assert.equal(specSpentPoints(spec), 1, 'without the ledger, slam counts as spent');
  assert.equal(specSpentPoints(spec, ['wow-warrior-slam']), 0, 'trained slam is free of points');
});

test('validSpec accepts a build whose only route runs through a trained node', () => {
  // sweepingStrikes neighbours slam; with slam trained (gold), the stored spec
  // omits slam yet must still validate — connectivity runs over spec ∪ trained.
  const spec = { ...emptySpec('Arms'), allocatedNodes: ['origin', 'wow-warrior-heroicStrike', 'wow-warrior-sweepingStrikes'] };
  assert.equal(validSpec(roundTrip(spec), 'warrior', 'human', 20), false, 'unreachable without the trained node');
  assert.equal(validSpec(roundTrip(spec), 'warrior', 'human', 20, ['wow-warrior-slam']), true, 'reachable through trained slam');
});

test('validSpecs round-trips a stored build containing a trained node', () => {
  const trained = ['wow-warrior-slam'];
  const spec = { ...emptySpec('Arms'), allocatedNodes: ['origin', 'wow-warrior-heroicStrike', 'wow-warrior-slam', 'wow-warrior-sweepingStrikes'] };
  const specs = [spec, emptySpec('Fury')];
  // At level 2 the budget is a single point; counting the gold-trained slam as
  // spent (2 total) overflows it and the save would reset on load.
  assert.equal(validSpecs(roundTrip(specs), 0, 'warrior', 'human', 2, trained), true);
  assert.equal(validSpecs(roundTrip(specs), 0, 'warrior', 'human', 2), false, 'trained node must not eat the point budget');
});
test('applySpec keeps the conservation invariant with trained nodes', () => {
  const sim = createWowSim('warrior', 'human', emptyWorld);
  const sheet = sim.player.character as TrainedSheet;
  sheet.trained = { skills: ['slam'], ranks: {} };
  sheet.allocatedNodes = ['origin', 'wow-warrior-heroicStrike', 'wow-warrior-slam'];
  const spec = { ...emptySpec('Arms'), allocatedNodes: ['origin', 'wow-warrior-heroicStrike', 'wow-warrior-slam', 'wow-warrior-sweepingStrikes'] };
  applySpec(sheet, spec, 20);
  // sweepingStrikes is the only point-bought node (origin + heroicStrike are
  // free, slam is gold-trained): level 20 leaves 19 - 1 = 18 unspent.
  assert.equal(sheet.skillPoints, 20 - 1 - specSpentPoints(spec, trainedNodeIds(sheet)));
  assert.equal(sheet.skillPoints, 18);
});

test('dualSpecView reports the live spec spent as level-1-skillPoints', () => {
  const sim = createWowSim('warrior', 'human', emptyWorld);
  const p = sim.player, sheet = p.character as TrainedSheet;
  p.level = 20;
  sheet.trained = { skills: ['slam'], ranks: {} };
  sheet.allocatedNodes = ['origin', 'wow-warrior-heroicStrike', 'wow-warrior-slam'];
  sheet.skillPoints = 19;
  sheet.specs = [captureSpec(sheet, 'Arms'), emptySpec('Fury')];
  sheet.activeSpec = 0;
  const view = dualSpecView(p);
  assert.equal(view.specs[0]!.spent, 0, 'live spent = level-1-skillPoints, not node count');
  assert.equal(view.specs[0]!.unspent, 19);
});

// --- STATE-MUTATION: co-op channel scoping ------------------------------------
const partner = (sim: Simulation): Player => {
  const p = initialPlayer(sim.player.x + 40, sim.player.y);
  p.character = createCharacterSheet('mage', 'human');
  refreshCharacter(p);
  return p;
};

test('a partner ground pickup does not cancel the primary portal/hearthstone/event channels', () => {
  const sim = createWowSim('mage', 'undead', emptyWorld);
  const p1 = sim.player, p2 = partner(sim);
  sim.enterCoop(p2);
  // Primary owns all three channels.
  assert.equal(sim.portal.start(p1, sim.world), null);
  assert.equal(sim.hearthstone.start(p1, sim.world), null);
  sim.eventChannel.start({ id: 'ev:1', kind: 'watchtower', name: 'Beacon', x: p1.x, y: p1.y, seed: 1, biome: 'verdant', level: 1 }, null, p1);
  assert.ok(sim.portal.active && sim.hearthstone.active && sim.eventChannel.site);
  // The partner picks up loot: only their own (empty) channels may cancel.
  sim.groundItems.push({ id: 1, x: p2.x, y: p2.y, item: generateItem(90000, 6) });
  sim.requestGroundItem(1, p2);
  assert.equal(sim.portal.active, true, 'partner pickup must not cancel the portal');
  assert.equal(sim.hearthstone.active, true, 'partner pickup must not cancel the hearthstone');
  assert.ok(sim.eventChannel.site, 'partner pickup must not cancel the event channel');
});

test('a partner hearthstone cast does not cancel the primary channels', () => {
  const sim = createWowSim('mage', 'undead', emptyWorld);
  const p1 = sim.player, p2 = partner(sim);
  sim.enterCoop(p2);
  assert.equal(sim.portal.start(p1, sim.world), null);
  sim.eventChannel.start({ id: 'ev:1', kind: 'watchtower', name: 'Beacon', x: p1.x, y: p1.y, seed: 1, biome: 'verdant', level: 1 }, null, p1);
  sim.asPlayer(p2, () => hearthstoneCast(sim));
  assert.equal(sim.portal.active, true, 'partner hearth must not cancel the portal');
  assert.ok(sim.eventChannel.site, 'partner hearth must not cancel the event channel');
  assert.equal(sim.hearthstone.active, true, 'the partner hearthstone cast started');
});

test('channel start cannot steal another player\'s in-progress channel', () => {
  const sim = createWowSim('mage', 'undead', emptyWorld);
  const p1 = sim.player, p2 = partner(sim);
  sim.enterCoop(p2);
  assert.equal(sim.portal.start(p1, sim.world), null);
  assert.equal(sim.portal.start(p2, sim.world), 'A portal is already being channeled.');
  assert.equal(sim.portal.active, true);
  assert.equal(sim.hearthstone.start(p1, sim.world), null);
  assert.equal(sim.hearthstone.start(p2, sim.world), 'A hearthstone is already being channeled.');
  assert.equal(sim.hearthstone.active, true);
  const site = { id: 'ev:1', kind: 'watchtower' as const, name: 'Beacon', x: p1.x, y: p1.y, seed: 1, biome: 'verdant' as const, level: 1 };
  sim.eventChannel.start(site, null, p1);
  sim.eventChannel.start({ ...site, id: 'ev:2' }, null, p2);
  assert.equal(sim.eventChannel.site?.id, 'ev:1', 'partner start must not overwrite the channel');
});

test('the owner can still restart their own channel', () => {
  const sim = createWowSim('mage', 'undead', emptyWorld);
  const p1 = sim.player;
  assert.equal(sim.portal.start(p1, sim.world), null);
  assert.equal(sim.portal.start(p1, sim.world), null, 'same-owner restart stays a no-op toggle');
  assert.equal(sim.portal.active, false);
});

// --- Full checkpoint round-trip through decodeCharacterSave -------------------
test('a checkpoint with a heroic dungeon actor survives decodeCharacterSave', () => {
  const sim = createWowSim('warrior', 'human', emptyWorld);
  const checkpoint = sim.captureCheckpoint() as CharacterCheckpoint;
  checkpoint.actors = [bossActor(true)];
  const entrance: DungeonEntrance = { id: 'dungeon:test', name: 'Rootbound Crypt', seed: 7319, level: 4, biome: 'deadwood', x: 600, y: 0,
    scaling: { base: 4, min: 4, max: 4, heroic: true } };
  const exp = freshExpeditions();
  exp.runs.push(createDungeonRun(entrance));
  exp.location = entrance.id;
  // Mid-dungeon saves keep the surface contents snapshot (validator requires it
  // whenever location names a run).
  exp.surface = emptyContents();
  checkpoint.expeditions = exp;
  const save = { version: 4, id: 'test', name: 'Test', worldSeed: 7319, worldVersion: 5, createdAt: 1, updatedAt: 2, checkpoint };
  const decoded = decodeCharacterSave(JSON.stringify(roundTrip(save)));
  assert.ok(decoded, 'mid-heroic-dungeon save must decode instead of resetting');
});
