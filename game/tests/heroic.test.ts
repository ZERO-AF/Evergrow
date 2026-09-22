import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { generateDungeon } from '../src/dungeon.ts';
import { currentDungeon } from '../src/dungeon-state.ts';
import { decodeCharacterSave, type CharacterCheckpoint } from '../src/character-save.ts';
import { queueForDungeon } from '../src/dungeon-finder-command.ts';
import { dungeonFinderDungeon, dungeonFinderProblem } from '../src/dungeon-finder-content.ts';
import type { DungeonFinderSheet } from '../src/dungeon-finder-state.ts';
import { encounterMemberLevel, heroicMemberRank } from '../src/encounter-scaling.ts';
import { HEROIC_BOSS_HEALTH } from '../src/progression-content.ts';
import { applyEnemyModifiers } from '../src/enemy-modifiers.ts';
import { scaledEnemyStats } from '../src/zone-progression.ts';
import { isBossKind } from '../src/wilderness-boss-content.ts';
import {
  HEROIC_RULES, dungeonMemberRank, heroicEligible, heroicProblem,
} from '../src/heroic-content.ts';
import { emblemBalance, validEmblems } from '../src/emblem-state.ts';
import { badgeVendorFor, badgeVendorStock, executeBadgeBuy } from '../src/badge-vendor.ts';
import { createWowSim } from './fixtures/wow-sim.ts';
import type { Enemy, WorldQuery } from '../src/model.ts';
import type { Building } from '../src/settlements.ts';

const surface: WorldQuery = { seed: 7319, blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }), sampleBiome: () => ({ id: 'deadwood' }) };
const ok = () => ({ ok: true, message: '' });
const UTGARDE = 'rdf:howling-fjord:0'; // Northrend — heroic eligible
const DEADMINES = 'rdf:westfall:0';    // old world — no heroic mode

function decoded(c: CharacterCheckpoint) {
  return decodeCharacterSave(JSON.stringify({ version: 4, id: 'test', name: 'Test', worldSeed: 7319, worldVersion: 5, createdAt: 1, updatedAt: 2, checkpoint: c }));
}
function commit(sim: Simulation, checkpoint: CharacterCheckpoint) {
  const run = currentDungeon(checkpoint.expeditions!);
  sim.world = run ? new DungeonWorld(generateDungeon(run.entrance.seed, run.entrance.level, run.entrance), run.entrance) : surface;
  sim.restoreCheckpoint(checkpoint);
  sim.relocate(sim.player.x, sim.player.y);
}
function levelTo(sim: Simulation, level: number) {
  sim.player.level = level;
  sim.player.character.skillPoints = level - 1;
  sim.player.character.statPoints = (level - 1) * 5;
}
/** Drive the private damage path like a real hit; periodic bypasses the attack table. */
function kill(sim: Simulation, enemy: Enemy) {
  enemy.hp = 1;
  (sim as unknown as { damageEnemy(e: Enemy, d: number, a: number, m: boolean, p?: boolean): void })
    .damageEnemy(enemy, 1, 0, false, true);
}

test('heroic queues are gated to level-80 Northrend dungeons', async () => {
  const utgarde = dungeonFinderDungeon(UTGARDE)!;
  const deadmines = dungeonFinderDungeon(DEADMINES)!;
  assert.ok(heroicEligible(utgarde));
  assert.ok(!heroicEligible(deadmines));
  assert.match(heroicProblem(utgarde, { level: 79, dead: false })!, /level 80/);
  assert.match(heroicProblem(deadmines, { level: 80, dead: false })!, /no heroic mode/);
  assert.equal(heroicProblem(utgarde, { level: 80, dead: false }), null);
  // The shared problem gate routes heroic checks before the normal band.
  assert.equal(dungeonFinderProblem(utgarde, { level: 80, dead: false }, true), null);
  assert.match(dungeonFinderProblem(deadmines, { level: 80, dead: false }, true)!, /no heroic mode/);
  assert.match(dungeonFinderProblem(utgarde, { level: 79, dead: false }, true)!, /level 80/);

  const sim = createWowSim('warrior');
  levelTo(sim, 79);
  let writes = 0;
  const persist = async () => { writes++; return ok(); };
  const refused = await queueForDungeon(sim, UTGARDE, surface, persist, true);
  assert.equal(refused.ok, false);
  assert.match(refused.message, /level 80/);
  assert.equal(writes, 0);
});

test('a heroic queue pins the level-80 scale and promotes member ranks', async () => {
  const sim = createWowSim('paladin');
  levelTo(sim, 80);
  const result = await queueForDungeon(sim, UTGARDE, surface, async () => ok(), true);
  assert.ok(result.ok, result.ok ? '' : result.message);
  commit(sim, result.checkpoint);
  const run = currentDungeon(sim.expeditions)!;
  assert.equal(run.entrance.scaling?.heroic, true);
  assert.equal(run.entrance.scaling?.base, HEROIC_RULES.level);
  assert.equal(run.entrance.level, HEROIC_RULES.level);
  assert.match(run.entrance.name, /Heroic/);

  const floor = sim.dungeonFloor!;
  const trash = floor.members.filter(m => !isBossKind(m.kind));
  const boss = floor.members.find(m => isBossKind(m.kind))!;
  assert.ok(trash.length > 0);
  // Rank promotion: authored normal -> veteran, veteran -> elite; bosses unchanged.
  for (const m of trash) assert.equal(dungeonMemberRank(run.entrance, m), heroicMemberRank(m.rank));
  assert.equal(dungeonMemberRank(run.entrance, boss), boss.rank);

  // Spawned enemies carry the promoted rank and the level offset that goes with it.
  const m = trash[0];
  const enemy = sim.spawnEnemy(m.kind, m.x, m.y, dungeonMemberRank(run.entrance, m),
    { campId: run.entrance.id, memberId: m.id, lootSeed: m.seed, level: encounterMemberLevel(run.entrance.scaling!, dungeonMemberRank(run.entrance, m), m.seed, false) })!;
  assert.equal(enemy.rank, heroicMemberRank(m.rank));
  assert.ok(enemy.level >= HEROIC_RULES.level);

  // The boss keeps its authored rank but doubles health through applyEnemyModifiers.
  const bossLevel = encounterMemberLevel(run.entrance.scaling!, boss.rank, boss.seed, true);
  const base = scaledEnemyStats(boss.kind, bossLevel, boss.rank);
  const heroic = applyEnemyModifiers(base, { kind: boss.kind, rank: boss.rank, lootSeed: boss.seed, heroic: true });
  assert.equal(heroic.maxHp, Math.round(base.maxHp * HEROIC_BOSS_HEALTH));
  const normal = applyEnemyModifiers(base, { kind: boss.kind, rank: boss.rank, lootSeed: boss.seed, heroic: false });
  assert.equal(normal.maxHp, base.maxHp);
  const spawned = sim.spawnEnemy(boss.kind, boss.x, boss.y, dungeonMemberRank(run.entrance, boss),
    { campId: run.entrance.id, memberId: boss.id, lootSeed: boss.seed, level: bossLevel })!;
  assert.equal(spawned.maxHp, heroic.maxHp);
});

test('killing a heroic boss credits emblems; normal bosses pay nothing', async () => {
  const sim = createWowSim('warrior');
  levelTo(sim, 80);
  const result = await queueForDungeon(sim, UTGARDE, surface, async () => ok(), true);
  assert.ok(result.ok);
  commit(sim, result.checkpoint);
  const run = currentDungeon(sim.expeditions)!;
  const boss = sim.dungeonFloor!.members.find(m => isBossKind(m.kind))!;
  const enemy = sim.spawnEnemy(boss.kind, boss.x, boss.y, dungeonMemberRank(run.entrance, boss),
    { campId: run.entrance.id, memberId: boss.id, lootSeed: boss.seed, level: bossLevelOf(run, boss) })!;
  const before = emblemBalance(sim.player.character);
  kill(sim, enemy);
  const gained = emblemBalance(sim.player.character) - before;
  assert.equal(gained, HEROIC_RULES.bossEmblemsMin + (boss.seed % 2));
  assert.ok(gained === 2 || gained === 3, `expected 2-3 emblems, got ${gained}`);

  // A normal (non-heroic) run's boss pays no emblems.
  const sim2 = createWowSim('warrior');
  levelTo(sim2, 70);
  const normal = await queueForDungeon(sim2, UTGARDE, surface, async () => ok());
  assert.ok(normal.ok);
  commit(sim2, normal.checkpoint);
  const run2 = currentDungeon(sim2.expeditions)!;
  const boss2 = sim2.dungeonFloor!.members.find(m => isBossKind(m.kind))!;
  const enemy2 = sim2.spawnEnemy(boss2.kind, boss2.x, boss2.y, boss2.rank,
    { campId: run2.entrance.id, memberId: boss2.id, lootSeed: boss2.seed, level: bossLevelOf(run2, boss2) })!;
  kill(sim2, enemy2);
  assert.equal(emblemBalance(sim2.player.character), 0);
});

test('the heroic queue marker and emblem balance survive save validation', async () => {
  const sim = createWowSim('mage');
  levelTo(sim, 80);
  const result = await queueForDungeon(sim, UTGARDE, surface, async () => ok(), true);
  assert.ok(result.ok);
  commit(sim, result.checkpoint);
  sim.player.character.emblems = 7;
  const checkpoint = sim.captureCheckpoint();
  const save = decoded(checkpoint);
  assert.ok(save, 'heroic run checkpoint must decode');
  assert.equal(save!.checkpoint.character.emblems, 7);
  assert.equal(save!.checkpoint.expeditions?.location, 'atlas:howling-fjord:entrance:0');
  assert.ok(validEmblems(0) && validEmblems(40) && !validEmblems(-1) && !validEmblems(1.5));

  // The persisted marker carries the heroic flag for a resumable queue.
  const c2 = sim.captureCheckpoint();
  (c2.character as DungeonFinderSheet).dungeonFinder = { queued: UTGARDE, queuedAt: 1, heroic: true };
  const save2 = decoded(c2);
  assert.ok(save2, 'heroic queue marker must decode');
  assert.equal(save2!.checkpoint.character.dungeonFinder?.heroic, true);
});

test('the badge vendor sells stock for emblems through the durable command', async () => {
  const sim = createWowSim('priest');
  levelTo(sim, 80);
  const building = {
    id: 'town:atlas:0:building:0', kind: 'noble', settlementTier: 'city',
    door: { x: 100, y: 100 }, x: 100, y: 100, width: 80, height: 80, seed: 5,
  } as unknown as Building;
  const vendor = badgeVendorFor(building)!;
  assert.ok(vendor);
  assert.equal(vendor.role, 'badgeVendor');
  const stock = badgeVendorStock(vendor);
  assert.ok(stock.length >= 8);
  assert.ok(stock.some(e => e.kind === 'unique'));

  // No emblems: refused before any write.
  sim.player.x = vendor.x; sim.player.y = vendor.y;
  let writes = 0;
  const persist = async () => { writes++; return ok(); };
  let result = await executeBadgeBuy(sim, vendor, stock[0]!.id, persist);
  assert.equal(result.ok, false);
  assert.match(result.message ?? '', /emblems/);
  assert.equal(writes, 0);

  // Funded: the buy deducts emblems and packs the item.
  sim.player.character.emblems = 100;
  const entry = stock[0];
  const price = entry.price;
  result = await executeBadgeBuy(sim, vendor, entry.id, persist);
  assert.ok(result.ok, result.message);
  assert.equal(writes, 1);
  assert.equal(emblemBalance(sim.player.character), 100 - price);
  const bought = sim.player.character.inventory.find(i => i?.id.includes(`:badge:${entry.id}:`));
  assert.ok(bought, 'the purchased item lands in the bag');
  assert.equal(bought!.name, entry.name);

  // A unique row mints its authored item.
  const unique = stock.find(e => e.kind === 'unique')!;
  result = await executeBadgeBuy(sim, vendor, unique.id, persist);
  assert.ok(result.ok, result.message);
  assert.ok(sim.player.character.inventory.some(i => i?.id.includes(`:badge:${unique.id}:`)));

  // Unknown stock and wrong-role NPCs are refused.
  assert.equal((await executeBadgeBuy(sim, vendor, 'nope', persist)).ok, false);
  assert.equal(badgeVendorStock({ role: 'blacksmith' }).length, 0);
});

function bossLevelOf(run: { entrance: { scaling?: import('../src/encounter-scaling.ts').EncounterScale } }, member: { kind: Enemy['kind']; rank: Enemy['rank']; seed: number }): number {
  return encounterMemberLevel(run.entrance.scaling!, member.rank, member.seed, true);
}
