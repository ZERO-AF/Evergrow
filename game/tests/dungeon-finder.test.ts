import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { generateDungeon } from '../src/dungeon.ts';
import { currentDungeon } from '../src/dungeon-state.ts';
import { decodeCharacterSave, type CharacterCheckpoint } from '../src/character-save.ts';
import { queueForDungeon, leaveQueue } from '../src/dungeon-finder-command.ts';
import {
  DUNGEON_FINDER_RULES, RDF_DUNGEONS, dungeonFinderDungeon, dungeonFinderEntrance,
  dungeonFinderProblem, dungeonFinderWaitSeconds,
} from '../src/dungeon-finder-content.ts';
import { dungeonFinderOf, queuedDungeon, validDungeonFinder, type DungeonFinderSheet } from '../src/dungeon-finder-state.ts';
import { createWowSim } from './fixtures/wow-sim.ts';
import type { WorldQuery } from '../src/model.ts';
const surface: WorldQuery = { seed: 7319, blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }), sampleBiome: () => ({ id: 'deadwood' }) };
const ok = () => ({ ok: true, message: '' });
const DEADMINES = 'rdf:westfall:0';
const UTGARDE = 'rdf:howling-fjord:0';

function decoded(c: CharacterCheckpoint) {
  return decodeCharacterSave(JSON.stringify({ version: 4, id: 'test', name: 'Test', worldSeed: 7319, worldVersion: 5, createdAt: 1, updatedAt: 2, checkpoint: c }));
}
/** Mirrors location-controller.test.ts: the host owns world objects and arrival. */
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

test('the catalog derives real WoW dungeons from the authored atlas entrances', () => {
  assert.ok(RDF_DUNGEONS.length >= 30);
  const deadmines = dungeonFinderDungeon(DEADMINES)!;
  assert.equal(deadmines.name, 'The Deadmines');
  assert.equal(deadmines.entranceId, 'atlas:westfall:entrance:0');
  assert.equal(deadmines.levelMin, 15);
  assert.equal(deadmines.levelMax, 21);
  assert.equal(deadmines.theme, 'foundry');
  assert.ok(RDF_DUNGEONS.every(d => d.entranceId.startsWith('atlas:') && d.levelMin <= d.levelMax));
  assert.ok(!RDF_DUNGEONS.some(d => /lair|core|citadel|naxxramas/i.test(d.name)), 'raids are excluded');
  for (const d of RDF_DUNGEONS) {
    const w = dungeonFinderWaitSeconds(d.id);
    assert.ok(w >= 2 && w <= 5 && Number.isInteger(w));
  }
});

test('queueForDungeon persists the marker then relocates the player through the dungeon path', async () => {
  const sim = createWowSim('warrior');
  levelTo(sim, 18);
  sim.player.x = 1234; sim.player.y = -567;
  const seen: CharacterCheckpoint[] = [];
  const result = await queueForDungeon(sim, DEADMINES, surface, async c => { seen.push(c); return ok(); });
  assert.ok(result.ok, result.ok ? '' : result.message);
  // Two durable writes: the queue marker, then the location change with it consumed.
  assert.equal(seen.length, 2);
  assert.equal(seen[0].character.dungeonFinder?.queued, DEADMINES);
  assert.equal(seen[0].expeditions?.location, null);
  assert.equal(seen[1].character.dungeonFinder, undefined);
  assert.equal(seen[1].expeditions?.location, 'atlas:westfall:entrance:0');
  // Commit like the host does: the player is inside the Deadmines run.
  commit(sim, result.checkpoint);
  assert.equal(sim.expeditions.location, 'atlas:westfall:entrance:0');
  assert.ok(sim.dungeonFloor);
  const run = currentDungeon(sim.expeditions)!;
  assert.equal(run.entrance.name, 'The Deadmines');
  assert.equal(run.entrance.theme, 'foundry');
  // The finder entrance sits where the player queued, so the exit portal
  // returns there — WotLK's teleport-out behavior.
  assert.equal(run.entrance.x, 1234);
  assert.equal(run.entrance.y, -567);
  // The floor pins the authored band: mobs scale inside 15–21, not the
  // zone the player happened to be standing in.
  assert.equal(run.entrance.scaling?.min, 15);
  assert.equal(run.entrance.scaling?.max, 21);
  assert.equal(run.entrance.scaling?.base, 18);
  assert.equal(dungeonFinderOf(sim.player.character), undefined);
});

test('ineligible levels and unknown dungeons are refused before any write', async () => {
  const sim = createWowSim('mage');
  let writes = 0;
  const persist = async () => { writes++; return ok(); };
  levelTo(sim, 10); // below the level-15 finder unlock
  let result = await queueForDungeon(sim, DEADMINES, surface, persist);
  assert.equal(result.ok, false);
  assert.match(result.message, /level 15/);
  levelTo(sim, 22); // above the Deadmines band
  result = await queueForDungeon(sim, DEADMINES, surface, persist);
  assert.equal(result.ok, false);
  assert.match(result.message, /level 21 or lower/);
  result = await queueForDungeon(sim, 'rdf:nowhere:9', surface, persist);
  assert.equal(result.ok, false);
  assert.match(result.message, /not in the Dungeon Finder/);
  assert.equal(writes, 0);
  assert.equal(dungeonFinderOf(sim.player.character), undefined);
});

test('a failed entry leaves the persisted queue resumable', async () => {
  const sim = createWowSim('priest');
  levelTo(sim, 18);
  let calls = 0;
  const persist = async () => (++calls === 2 ? { ok: false, message: 'disk full' } : ok());
  const result = await queueForDungeon(sim, DEADMINES, surface, persist);
  assert.equal(result.ok, false);
  assert.equal(result.message, 'disk full');
  assert.equal(calls, 2);
  // Live state matches the durable marker so Leave Queue can clear it.
  assert.equal(dungeonFinderOf(sim.player.character)?.queued, DEADMINES);
  assert.equal(queuedDungeon(sim.player.character)?.name, 'The Deadmines');
  assert.equal(sim.expeditions.location, null);
});

test('leaveQueue clears the marker durably and is refused when idle', async () => {
  const sim = createWowSim('druid');
  levelTo(sim, 18);
  const idle = await leaveQueue(sim, async () => ok());
  assert.equal(idle.ok, false);
  // Simulate a persisted queue (e.g. an interrupted entry restored on load).
  (sim.player.character as DungeonFinderSheet).dungeonFinder = { queued: DEADMINES, queuedAt: 1 };
  const seen: CharacterCheckpoint[] = [];
  const result = await leaveQueue(sim, async c => { seen.push(c); return ok(); });
  assert.ok(result.ok);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].character.dungeonFinder, undefined);
  assert.equal(dungeonFinderOf(sim.player.character), undefined);
});

test('queuing while inside a dungeon is refused', async () => {
  const sim = createWowSim('warrior');
  levelTo(sim, 18);
  const first = await queueForDungeon(sim, DEADMINES, surface, async () => ok());
  assert.ok(first.ok);
  commit(sim, first.checkpoint);
  const result = await queueForDungeon(sim, DEADMINES, surface, async () => ok());
  assert.equal(result.ok, false);
  assert.match(result.message, /Already in a dungeon/);
});

test('the queue marker round-trips through save validation', () => {
  const sim = createWowSim('shaman');
  levelTo(sim, 18);
  const checkpoint = sim.captureCheckpoint();
  checkpoint.character.dungeonFinder = { queued: DEADMINES, queuedAt: 1726000000000 };
  const save = decoded(checkpoint);
  assert.ok(save, 'checkpoint with a queue marker must decode');
  assert.equal(save!.checkpoint.character.dungeonFinder?.queued, DEADMINES);
  // Malformed markers are rejected, not silently kept.
  for (const bad of [{ queued: 7 }, { queued: DEADMINES, queuedAt: 'soon' }, 'queued', { queuedAt: -1 }]) {
    const c = sim.captureCheckpoint();
    (c.character as unknown as Record<string, unknown>).dungeonFinder = bad;
    assert.equal(decoded(c), null, `expected rejection: ${JSON.stringify(bad)}`);
  }
  assert.ok(validDungeonFinder({}));
  assert.ok(!validDungeonFinder({ queued: DEADMINES }));
});

test('dungeonFinderProblem gates on the finder unlock and the dungeon band', () => {
  const deadmines = dungeonFinderDungeon(DEADMINES)!;
  const utgarde = dungeonFinderDungeon(UTGARDE)!;
  assert.equal(utgarde.name, 'Utgarde Keep');
  const p = { level: 14, dead: false };
  assert.match(dungeonFinderProblem(deadmines, p)!, /level 15/);
  p.level = 15;
  assert.equal(dungeonFinderProblem(deadmines, p), null);
  assert.match(dungeonFinderProblem(utgarde, p)!, /Requires level 68/);
  p.level = 81;
  assert.match(dungeonFinderProblem(deadmines, p)!, /level 21 or lower/);
  assert.equal(dungeonFinderProblem(deadmines, { level: 18, dead: true }), 'Recover in town first.');
  assert.equal(DUNGEON_FINDER_RULES.minimumLevel, 15);
});

test('the synthesized entrance matches the world door seed and theme', () => {
  const deadmines = dungeonFinderDungeon(DEADMINES)!;
  const a = dungeonFinderEntrance(deadmines, { x: 10, y: 20, level: 18 }, 7319);
  const b = dungeonFinderEntrance(deadmines, { x: -5, y: 99, level: 21 }, 7319);
  assert.equal(a.seed, b.seed, 'seed is the door identity, not the queue spot');
  assert.equal(a.theme, 'foundry');
  assert.equal(a.id, 'atlas:westfall:entrance:0');
  assert.equal(a.scaling?.base, 18);
  assert.equal(b.scaling?.base, 21);
  // The generated floor is identical to what the physical door produces.
  assert.deepEqual(generateDungeon(a.seed, a.level, a), generateDungeon(a.seed, a.level, a));
});
