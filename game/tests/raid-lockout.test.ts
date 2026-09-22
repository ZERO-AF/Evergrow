import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { createDungeonRun, freshExpeditions, emptyContents } from '../src/dungeon-state.ts';
import { generateDungeon, dungeonRandom } from '../src/dungeon.ts';
import { planDungeonTravel, claimDungeonChest } from '../src/dungeon-command.ts';
import { dungeonRunChest } from '../src/dungeon-locations.ts';
import {
  RAID_ENTRANCE_IDS, isRaidEntranceAny, raidLockedOut, raidLockoutCountdown,
  raidLockoutMessage, recordRaidLockout, resetRaidRun, validRaidLockouts, raidResetAt,
} from '../src/raid-lockout.ts';
import { raidBossLoot, raidLootTable, RAID_BOSS_LOOT, RAID_LOOT_TABLES } from '../src/raid-loot-content.ts';
import { RAID_ENTRANCE_ID, ONYXIA_RULES } from '../src/raid-boss-content.ts';
import { RAID2_ENTRANCE_ID, RAGNAROS_RULES } from '../src/raid2-boss-content.ts';
import { RAID3_ENTRANCE_ID, KELTHUZAD_RULES } from '../src/raid3-boss-content.ts';
import { RAID4_ENTRANCE_ID, LICHKING_RULES } from '../src/raid4-boss-content.ts';
import { RAID5_ENTRANCE_ID, MALYGOS_RULES } from '../src/raid5-boss-content.ts';
import { RAID6_ENTRANCE_ID, SARTH_RULES } from '../src/raid6-boss-content.ts';
import { setPieceOf } from '../src/item-set-content.ts';
import { MOUNT_RULES } from '../src/mount-state.ts';
import { createCharacterSheet } from '../src/items.ts';
import type { DungeonEntrance } from '../src/dungeon.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';

const world = { seed: 7319, generationVersion: 4, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }), getPOIs: () => [] };
const persist = async (checkpoint: CharacterCheckpoint) => ({ ok: true, message: '', checkpoint });
const NOW = Date.now();
const WEEK_MS = 7 * 86400000;

const raidEntrance = (id: string, seed = 4242): DungeonEntrance =>
  ({ id, name: 'Test Raid', seed, level: 30, biome: 'emberfall', x: 500, y: 500 });
test('every raid entrance maps to a named loot table via its content lootTable field', () => {
  assert.deepEqual([...RAID_ENTRANCE_IDS], [RAID_ENTRANCE_ID, RAID2_ENTRANCE_ID, RAID3_ENTRANCE_ID, RAID4_ENTRANCE_ID, RAID5_ENTRANCE_ID, RAID6_ENTRANCE_ID]);
  assert.equal(RAID_BOSS_LOOT[RAID_ENTRANCE_ID], ONYXIA_RULES.lootTable);
  assert.equal(RAID_BOSS_LOOT[RAID2_ENTRANCE_ID], RAGNAROS_RULES.lootTable);
  assert.equal(RAID_BOSS_LOOT[RAID3_ENTRANCE_ID], KELTHUZAD_RULES.lootTable);
  assert.equal(RAID_BOSS_LOOT[RAID4_ENTRANCE_ID], LICHKING_RULES.lootTable);
  assert.equal(RAID_BOSS_LOOT[RAID5_ENTRANCE_ID], MALYGOS_RULES.lootTable);
  assert.equal(RAID_BOSS_LOOT[RAID6_ENTRANCE_ID], SARTH_RULES.lootTable);
  for (const id of RAID_ENTRANCE_IDS) assert.ok(raidLootTable(id), `table for ${id}`);
  assert.equal(raidLootTable('dungeon:ordinary'), undefined);
  assert.ok(isRaidEntranceAny(RAID4_ENTRANCE_ID) && !isRaidEntranceAny('dungeon:expedition:1:0:0'));
});

test('a clear writes a lockout receipt that blocks until the weekly boundary', () => {
  const sheet = createCharacterSheet();
  assert.equal(raidLockedOut(sheet, RAID_ENTRANCE_ID, NOW), false);
  recordRaidLockout(sheet, RAID_ENTRANCE_ID, NOW);
  const reset = sheet.raidLockouts![RAID_ENTRANCE_ID];
  assert.equal(reset, raidResetAt(NOW));
  assert.equal(reset % (WEEK_MS / 1000), 0, 'receipt stores the epoch-second of the reset boundary');
  assert.ok(raidLockedOut(sheet, RAID_ENTRANCE_ID, NOW));
  assert.ok(raidLockedOut(sheet, RAID_ENTRANCE_ID, reset * 1000 - 1), 'locked until the boundary');
  assert.equal(raidLockedOut(sheet, RAID_ENTRANCE_ID, reset * 1000), false, 'open at the boundary');
  assert.equal(raidLockedOut(sheet, RAID_ENTRANCE_ID, reset * 1000 + WEEK_MS), false);
  assert.ok(raidLockoutCountdown(sheet, RAID_ENTRANCE_ID, NOW) > 0);
  assert.match(raidLockoutMessage(sheet, RAID_ENTRANCE_ID, "Onyxia's Lair", NOW), /locked until the weekly reset/);
  // Other raids stay open; non-raid ids never lock.
  assert.equal(raidLockedOut(sheet, RAID2_ENTRANCE_ID, NOW), false);
  assert.equal(raidLockedOut(sheet, 'dungeon:other', NOW), false);
});

test('resetRaidRun retires a stale raid run and tombstone only after the reset', () => {
  const sheet = createCharacterSheet();
  const state = freshExpeditions();
  const run = createDungeonRun(raidEntrance(RAID_ENTRANCE_ID));
  run.states.warden.hp = 0;
  state.runs.push(run);
  state.cleared = [RAID_ENTRANCE_ID];
  recordRaidLockout(sheet, RAID_ENTRANCE_ID, NOW);
  resetRaidRun(state, sheet, RAID_ENTRANCE_ID, NOW);
  assert.equal(state.runs.length, 1, 'still locked: run stays resumable');
  assert.deepEqual(state.cleared, [RAID_ENTRANCE_ID]);
  resetRaidRun(state, sheet, RAID_ENTRANCE_ID, sheet.raidLockouts![RAID_ENTRANCE_ID] * 1000);
  assert.equal(state.runs.length, 0, 'expired lockout retires the cleared run');
  assert.deepEqual(state.cleared, [], 'tombstone lifts with the reset');
  // A run with a live boss and no receipt is never touched.
  const live = createDungeonRun(raidEntrance(RAID2_ENTRANCE_ID));
  state.runs.push(live);
  resetRaidRun(state, sheet, RAID2_ENTRANCE_ID, NOW + WEEK_MS * 4);
  assert.equal(state.runs.length, 1);
  // Non-raid ids are ignored outright.
  state.cleared = ['dungeon:other'];
  resetRaidRun(state, sheet, 'dungeon:other', NOW + WEEK_MS * 4);
  assert.deepEqual(state.cleared, ['dungeon:other']);
});

test('raid entrance refuses re-entry while locked and reopens after the reset', async () => {
  const sim = new Simulation(world, { seed: 7319, spawn: false });
  const entrance = raidEntrance(RAID_ENTRANCE_ID);
  sim.player.x = entrance.x; sim.player.y = entrance.y;
  const first = await planDungeonTravel(sim, { kind: 'enter', entrance }, world, persist);
  assert.ok(first.ok, first.message);
  // Leave the raid (surface state restored), then try to walk back in.
  sim.expeditions.location = null;
  recordRaidLockout(sim.player.character, RAID_ENTRANCE_ID, NOW);
  const denied = await planDungeonTravel(sim, { kind: 'enter', entrance }, world, persist);
  assert.equal(denied.ok, false);
  assert.match(denied.message, /locked until the weekly reset/);
  // After the boundary the stale run retires and a fresh arena generates.
  sim.player.character.raidLockouts![RAID_ENTRANCE_ID] = raidResetAt(NOW - WEEK_MS);
  const reopened = await planDungeonTravel(sim, { kind: 'enter', entrance }, world, persist);
  assert.ok(reopened.ok, reopened.message);
  const run = reopened.checkpoint.expeditions!.runs.find(r => r.entrance.id === RAID_ENTRANCE_ID)!;
  assert.ok(run.states.warden.hp > 0, 'the boss is alive again');
  assert.deepEqual(run.chestMasks, [0, 0, 0]);
});

test('a non-raid dungeon ignores the lockout ledger entirely', async () => {
  const sim = new Simulation(world, { seed: 7319, spawn: false });
  const entrance = raidEntrance('dungeon:ordinary', 777);
  sim.player.x = entrance.x; sim.player.y = entrance.y;
  recordRaidLockout(sim.player.character, RAID_ENTRANCE_ID, NOW);
  const result = await planDungeonTravel(sim, { kind: 'enter', entrance }, world, persist);
  assert.ok(result.ok, result.message);
});

test('the raid boss chest rolls the named table and stamps the lockout', async () => {
  const sim = new Simulation(world, { seed: 7319, spawn: false });
  const entrance = raidEntrance(RAID2_ENTRANCE_ID, 98765);
  const run = createDungeonRun(entrance);
  run.states.warden.hp = 0;
  sim.expeditions = { ...freshExpeditions(), location: entrance.id, runs: [run], surface: emptyContents() };
  sim.dungeonFloor = generateDungeon(entrance.seed, entrance.level, entrance);
  const chest = dungeonRunChest(sim.dungeonFloor, run, 2);
  sim.player.x = chest.x; sim.player.y = chest.y;
  const result = await claimDungeonChest(sim, 2, persist);
  assert.ok(result.ok, result.message);
  const items = sim.groundItems.map(g => g.item);
  assert.equal(items.length, 3, 'three rolls off the Firelord table');
  const expected = raidBossLoot(RAID2_ENTRANCE_ID, dungeonRandom(entrance.seed), run.entrance.level, sim.player.character.classId)!.items;
  assert.deepEqual(items.map(i => i.name), expected.map(i => i.name), 'chest loot matches the named table roll');
  assert.ok(items.every(i => i.tier === 'epic' || i.tier === 'legendary' || i.tier === 'unique' || setPieceOf(i)), 'no generic-rank commons');
  assert.ok(sim.player.character.raidLockouts![RAID2_ENTRANCE_ID] > 0, 'lockout receipt written');
});

test('per-boss tables produce their signature drops', () => {
  const random = dungeonRandom(123456);
  // Onyxia: every set-piece roll is a head-slot piece (Tier-2 helms).
  for (let i = 0; i < 12; i++) {
    const loot = raidBossLoot(RAID_ENTRANCE_ID, dungeonRandom(1000 + i), 60, 'warrior')!;
    for (const item of loot.items) {
      const piece = setPieceOf(item);
      if (piece) assert.equal(piece.kind, 'head', `Onyxia set drop ${piece.id} must be a helm`);
    }
  }
  // Ragnaros: set drops are legs; Sulfuras is on the table.
  assert.ok(RAID_LOOT_TABLES.ragnaros.drops.some(d => d.kind === 'legendary' && d.legendaryId === 'sulfuras'));
  const rag = raidBossLoot(RAID2_ENTRANCE_ID, dungeonRandom(77), 60, 'paladin')!;
  for (const item of rag.items) {
    const piece = setPieceOf(item);
    if (piece) assert.equal(piece.kind, 'legs', `Ragnaros set drop ${piece.id} must be legs`);
  }
  // Kel'Thuzad: Atiesh and the phylactery are reachable.
  assert.ok(RAID_LOOT_TABLES.kelthuzad.drops.some(d => d.kind === 'legendary' && d.legendaryId === 'atiesh'));
  // Lich King: Frostmourne/Shadowmourne plus the mount bonus roll.
  assert.ok(RAID_LOOT_TABLES.lichking.drops.some(d => d.kind === 'legendary' && d.legendaryId === 'frostmourne'));
  assert.equal(RAID_LOOT_TABLES.lichking.bonus?.mount, 'drake');
  const forced = raidBossLoot(RAID4_ENTRANCE_ID, () => 0, 80)!;
  assert.equal(forced.mount, 'drake', 'a zero roll lands the mount');
  const denied = raidBossLoot(RAID4_ENTRANCE_ID, () => 0.999, 80)!;
  assert.equal(denied.mount, undefined);
  // Determinism: same seed, same haul.
  const a = raidBossLoot(RAID3_ENTRANCE_ID, dungeonRandom(55), 60, 'priest')!;
  const b = raidBossLoot(RAID3_ENTRANCE_ID, dungeonRandom(55), 60, 'priest')!;
  assert.deepEqual(a.items.map(i => i.id), b.items.map(i => i.id));
  // Unknown bosses get no table.
  assert.equal(raidBossLoot('dungeon:other', random, 60), undefined);
});

test('the Lich King mount drop lands on the achievement ledger', async () => {
  // Find a deterministic entrance seed whose bonus roll lands the drake.
  let seed = 1;
  for (; seed < 200000; seed++)
    if (raidBossLoot(RAID4_ENTRANCE_ID, dungeonRandom(seed), 30)!.mount === 'drake') break;
  assert.ok(seed < 200000, 'a mount-dropping seed exists');
  const sim = new Simulation(world, { seed: 7319, spawn: false });
  const entrance = raidEntrance(RAID4_ENTRANCE_ID, seed);
  const run = createDungeonRun(entrance);
  run.states.warden.hp = 0;
  sim.expeditions = { ...freshExpeditions(), location: entrance.id, runs: [run], surface: emptyContents() };
  sim.dungeonFloor = generateDungeon(entrance.seed, entrance.level, entrance);
  const chest = dungeonRunChest(sim.dungeonFloor, run, 2);
  sim.player.x = chest.x; sim.player.y = chest.y;
  const result = await claimDungeonChest(sim, 2, persist);
  assert.ok(result.ok, result.message);
  assert.match(result.message, /Nether Drake/);
  assert.equal(sim.player.achievements?.[MOUNT_RULES.drakeAchievement], 1, 'mount unlock persisted to the ledger');
});

test('raidLockouts survive save validation; malformed ledgers are rejected', async () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const repo = new CharacterRepository(storage), session = new CharacterSession(repo, 4), sim = new Simulation(world, { seed: 7319, spawn: false });
  assert.ok(await session.create(0, 'Rowan', 7319, sim.captureCheckpoint(), 'character-a', 100), session.error);
  const save = structuredClone(repo.read(0).record!);
  save.checkpoint.character.raidLockouts = { [RAID_ENTRANCE_ID]: raidResetAt(NOW), [RAID4_ENTRANCE_ID]: raidResetAt(NOW) };
  const decoded = decodeCharacterSave(JSON.stringify(save));
  assert.ok(decoded, 'a valid lockout ledger decodes');
  assert.deepEqual(decoded.checkpoint.character.raidLockouts, save.checkpoint.character.raidLockouts);
  for (const bad of [
    { 'dungeon:other': raidResetAt(NOW) },           // non-raid key
    { [RAID_ENTRANCE_ID]: -5 },                      // non-positive reset
    { [RAID_ENTRANCE_ID]: 'soon' },                  // non-numeric reset
    { [RAID_ENTRANCE_ID]: 1.5 },                     // non-integer reset
  ]) {
    const forged = structuredClone(repo.read(0).record!);
    forged.checkpoint.character.raidLockouts = bad as unknown as Record<string, number>;
    assert.equal(decodeCharacterSave(JSON.stringify(forged)), null, `rejected: ${JSON.stringify(bad)}`);
  }
  assert.ok(validRaidLockouts({ [RAID3_ENTRANCE_ID]: raidResetAt(NOW) }));
  assert.equal(validRaidLockouts({ 'dungeon:x': 1 }), false);
  assert.equal(validRaidLockouts({ [RAID3_ENTRANCE_ID]: 1.5 }), false);
  assert.equal(validRaidLockouts('locked'), false);
});
