import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { generateDungeon, dungeonBlocked } from '../src/dungeon.ts';
import { currentDungeon } from '../src/dungeon-state.ts';
import { validExpeditions } from '../src/dungeon-validation.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { planDungeonTravel } from '../src/dungeon-command.ts';
import { enterPvpMatch, exitPvpMatch, currentPvpMatch, type PvpMatchHost } from '../src/pvp-instance.ts';
import { buildPvpFloor, pvpMap, pvpMapIdFor } from '../src/pvp-floor.ts';
import { combatants } from '../src/pvp-combatant.ts';
import { hasLineOfSight } from '../src/combat-geometry.ts';
import { hearthstoneCast } from '../src/hearthstone.ts';
import { createCustomBuild, type PvpBracket, type PvpSetup } from '../src/pvp-setup.ts';
import { createWowSim, idleInput } from './fixtures/wow-sim.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';
import type { WorldQuery } from '../src/model.ts';

const surface: WorldQuery = { seed: 7319, blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }), sampleBiome: () => ({ id: 'deadwood' }) };
const ok = () => ({ ok: true, message: '' });
const SETUP_2V2: PvpSetup = { mode: 'arena', bracket: '2v2', teammates: [{ classId: 'priest', role: 'heal' }], custom: null };

/** Mirrors location-controller.test.ts: the host owns world objects and arrival. */
function hostFor(sim: Simulation): PvpMatchHost {
    return {
        surface: () => surface,
        persist: ok,
        restoreWorld: (checkpoint: CharacterCheckpoint) => {
            const run = currentDungeon(checkpoint.expeditions!);
            sim.world = run ? new DungeonWorld(generateDungeon(run.entrance.seed, run.entrance.level, run.entrance), run.entrance) : surface;
        },
        arrived: () => {},
    };
}
async function enter(sim: Simulation, setup: PvpSetup = SETUP_2V2) {
    const host = hostFor(sim);
    const result = await enterPvpMatch(sim, setup, host);
    assert.ok(result.ok, result.ok ? '' : result.message);
    return result;
}
function decoded(c: CharacterCheckpoint) { return decodeCharacterSave(JSON.stringify({ version: 4, id: 'test', name: 'Test', worldSeed: 7319, worldVersion: 5, createdAt: 1, updatedAt: 2, checkpoint: c })); }

test('the arena ring is a deterministic frozen floor with solid pillar LOS blockers', () => {
    assert.deepEqual(buildPvpFloor('arena-ring', 7, 1), buildPvpFloor('arena-ring', 7, 1));
    const floor = buildPvpFloor('arena-ring', 1234, 80);
    assert.ok(Object.isFrozen(floor));
    assert.equal(floor.pvp?.mapId, 'arena-ring');
    assert.equal(floor.pvp!.spawns.A.length, 8);
    assert.equal(floor.pvp!.spawns.B.length, 8);
    assert.equal(floor.members.length, 1); // dormant warden placeholder only
    const pillar = floor.props!.find(p => p.solid)!;
    assert.ok(dungeonBlocked(floor, pillar.x, pillar.y, 0));
    assert.ok(!dungeonBlocked(floor, 0, 0, 24));
    const world = { blocked: (x: number, y: number, r: number) => dungeonBlocked(floor, x, y, r) };
    assert.ok(!hasLineOfSight(world, -400, -160, 400, -160)); // through two pillars
    assert.ok(hasLineOfSight(world, -460, 0, 460, 0));        // midline stays open
});

test('enterPvpMatch places the player and NPC combatants at team spawn pads', async () => {
    const sim = createWowSim('warrior');
    sim.player.x = 600; sim.player.y = 0;
    const result = await enter(sim);
    assert.ok(decoded(result.checkpoint));
    assert.ok(validExpeditions(result.checkpoint.expeditions));
    const match = currentPvpMatch(sim)!;
    assert.ok(match);
    assert.equal(match.phase, 'prep');
    assert.match(match.mapId, /^arena-/);
    assert.ok(pvpMap(match.mapId));
    const roster = combatants(sim);
    assert.equal(roster.length, 4); // 2v2: player + priest vs two NPCs
    assert.equal(roster[0], sim.player);
    assert.deepEqual(roster.map(c => c.team), ['A', 'A', 'B', 'B']);
    for (const [i, c] of roster.entries()) {
        assert.equal(c.x, match.roster[i]!.spawn.x);
        assert.equal(c.y, match.roster[i]!.spawn.y);
    }
    assert.equal(roster[1]!.ai.role, 'healer');
    assert.ok(sim.dungeonFloor?.pvp);
    assert.ok(sim.world instanceof DungeonWorld);
    assert.equal(sim.expeditions.location, currentDungeon(sim.expeditions)!.entrance.id);
    assert.equal(sim.expeditions.runs[0]!.states.warden!.hp, 0); // dormant placeholder
});

test('exitPvpMatch returns the player to the exact pre-match position', async () => {
    const sim = createWowSim('warrior');
    sim.player.x = 600; sim.player.y = -120;
    await enter(sim);
    sim.player.x += 50; // moved during the match
    const exit = await exitPvpMatch(sim, hostFor(sim));
    assert.ok(exit.ok, exit.ok ? '' : exit.message);
    assert.equal(sim.player.x, 600);
    assert.equal(sim.player.y, -120);
    assert.equal(combatants(sim).length, 0);
    assert.equal(sim.expeditions.location, null);
    assert.equal(sim.expeditions.runs.length, 0); // single-use instance retired
    assert.equal(sim.world, surface);
});

test('hearthstone and town portal are sealed inside a match', async () => {
    const sim = createWowSim('mage');
    await enter(sim);
    assert.equal(hearthstoneCast(sim), null);      // the cast may start…
    sim.update(FIXED_STEP, idleInput);              // …but the instance cancels it
    assert.equal(sim.hearthstone.active, false);
    const town = await planDungeonTravel(sim, { kind: 'town', anchor: { band: 0, name: 'Home', x: 0, y: 0 } }, surface, ok);
    assert.equal(town.ok, false);
    assert.match(town.message, /portaling out/);
});

test('custom mode swaps the session character in and restores the real one on exit', async () => {
    const sim = createWowSim('mage');
    const realClass = sim.player.character.classId;
    const setup: PvpSetup = { mode: 'arena', bracket: '2v2', teammates: [{ classId: 'warrior', role: 'dd' }],
        custom: { ...createCustomBuild('priest', 'undead'), level: 60, role: 'heal' } };
    await enter(sim, setup);
    assert.equal(sim.player.character.classId, 'priest');
    assert.equal(sim.player.level, 60);
    assert.ok(currentPvpMatch(sim)!.savedCharacter);
    const exit = await exitPvpMatch(sim, hostFor(sim));
    assert.ok(exit.ok);
    assert.equal(sim.player.character.classId, realClass);
    assert.equal(sim.player.level, 1);
    assert.equal(exit.checkpoint.character.classId, realClass); // the save keeps the real sheet
});

test('unregistered maps and dead players are refused before any mutation', async () => {
    const sim = createWowSim('mage');
    // Battleground brackets resolve to their map id; an unregistered id is refused.
    const unknown = 'eyeofthestorm' as string as PvpBracket;
    const missing = await enterPvpMatch(sim, { mode: 'battleground', bracket: unknown, teammates: [], custom: null }, hostFor(sim));
    assert.equal(missing.ok, false);
    assert.match(missing.message, /not available/);
    assert.equal(pvpMapIdFor({ mode: 'battleground', bracket: 'warsong' }), 'warsong');
    assert.equal(pvpMap(unknown), undefined);
    sim.player.dead = true;
    const dead = await enterPvpMatch(sim, SETUP_2V2, hostFor(sim));
    assert.equal(dead.ok, false);
    assert.equal(sim.expeditions.location, null);
});
