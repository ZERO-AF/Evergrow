import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { generateDungeon, dungeonBlocked } from '../src/dungeon.ts';
import { currentDungeon } from '../src/dungeon-state.ts';
import { enterPvpMatch, exitPvpMatch, currentPvpMatch, type PvpMatchHost } from '../src/pvp-instance.ts';
import { combatants } from '../src/pvp-combatant.ts';
import { buildPvpFloor, PVP_MAPS } from '../src/pvp-floor.ts';
import { updatePvpMatch, attachPvpObjectives, arenaObjectives, PVP_PREP_SECONDS } from '../src/pvp-match.ts';
import { awardMatchRewards } from '../src/pvp-rewards.ts';
import { honorBalance } from '../src/wallet.ts';
import { createWowSim, idleInput } from './fixtures/wow-sim.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';
import type { WorldQuery } from '../src/model.ts';
import type { PvpSetup } from '../src/pvp-setup.ts';

const surface: WorldQuery = { seed: 7319, blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }), sampleBiome: () => ({ id: 'deadwood' }) };
const ok = () => ({ ok: true, message: '' });
const SETUP_2V2: PvpSetup = { mode: 'arena', bracket: '2v2', teammates: [{ classId: 'warrior', role: 'dd' }], custom: null };

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
    const result = await enterPvpMatch(sim, setup, hostFor(sim));
    assert.ok(result.ok, result.ok ? '' : result.message);
    return result;
}
/** One frame: match loop first (prep hold precedes the step), then the sim. */
function tick(sim: Simulation, seconds = FIXED_STEP) {
    const end = updatePvpMatch(sim, seconds);
    sim.update(seconds, idleInput);
    return end;
}

test('all five WotLK arenas build deterministic frozen floors with open pads and LOS blockers', () => {
    const ids = PVP_MAPS.filter(def => def.id.startsWith('arena-')).map(def => def.id);
    for (const id of ['arena-nagrand', 'arena-blades-edge', 'arena-dalaran-sewers', 'arena-ruins-lordaeron', 'arena-ring-of-trials', 'arena-ring-of-valor'])
        assert.ok(ids.includes(id), `${id} registered`);
    for (const id of ids) {
        assert.deepEqual(buildPvpFloor(id, 7, 1), buildPvpFloor(id, 7, 1), `${id} deterministic`);
        const floor = buildPvpFloor(id, 1234, 80);
        assert.ok(Object.isFrozen(floor));
        assert.equal(floor.pvp?.mapId, id);
        assert.ok(floor.pvp!.spawns.A.length >= 4 && floor.pvp!.spawns.B.length >= 4, `${id} pads`);
        for (const pad of [...floor.pvp!.spawns.A, ...floor.pvp!.spawns.B])
            assert.ok(!dungeonBlocked(floor, pad.x, pad.y, 12), `${id} pad ${pad.x},${pad.y} open`);
        assert.ok(!dungeonBlocked(floor, floor.pvp!.center.x, floor.pvp!.center.y, 0), `${id} center open`);
        assert.ok(!dungeonBlocked(floor, floor.entry.x, floor.entry.y, 0), `${id} entry open`);
        assert.ok(!dungeonBlocked(floor, floor.exit.x, floor.exit.y, 0), `${id} exit open`);
        assert.ok(floor.props!.some(p => p.solid), `${id} has LOS blockers`);
        assert.equal(floor.members.length, 1); // dormant warden placeholder only
    }
});

test('prep holds combatants, then a 2v2 fight runs to a team wipe and ends the match', async () => {
    const sim = createWowSim('warrior');
    sim.player.x = 600; sim.player.y = 0;
    await enter(sim);
    const match = currentPvpMatch(sim)!;
    const roster = combatants(sim);
    assert.equal(roster.length, 4);

    // Prep: nobody moves or acts while the gates are closed.
    const at = roster.map(c => ({ x: c.x, y: c.y }));
    for (let i = 0; i < 30; i++) assert.equal(tick(sim), undefined);
    assert.equal(match.phase, 'prep');
    for (const [i, c] of roster.entries()) { assert.equal(c.x, at[i]!.x); assert.equal(c.y, at[i]!.y); }

    // Gates open after the countdown.
    for (let i = 0; i < (PVP_PREP_SECONDS + 1) / FIXED_STEP && match.phase === 'prep'; i++) tick(sim);
    assert.equal(match.phase, 'live');
    assert.ok(match.objectives); // arena team-wipe controller attached
    // Live: NPCs fight with real skills; weaken team A so the fight resolves fast.
    for (const c of roster) if (c.team === 'A' && c !== sim.player) c.hp = 1;
    sim.player.hp = 1;
    let end;
    for (let i = 0; i < 90 / FIXED_STEP && !end; i++) end = tick(sim);
    assert.ok(end, 'match ends on team wipe');
    assert.equal(end.winner, 'B');
    assert.equal(match.phase, 'finished');
    assert.equal(match.score.A, 0); // arena score = living members
    const board = end.scoreboard;
    assert.equal(board.rows.length, 4);
    assert.equal(board.kills.B, 2); // team B scored both kills
    assert.ok(board.rows.some(r => r.isPlayer));
    assert.ok(board.rows.filter(r => r.team === 'A').every(r => r.deaths === 1 && !r.alive));
    assert.ok(board.rows.reduce((s, r) => s + r.damageDone, 0) > 0);
    assert.ok(!end.result.won && end.result.honorFromKills && end.result.mode === 'arena');

    // Teardown: exit restores the start point, then the award lands on the real sheet.
    const exit = await exitPvpMatch(sim, hostFor(sim));
    assert.ok(exit.ok, exit.ok ? '' : exit.message);
    assert.equal(sim.player.x, 600);
    assert.equal(sim.player.y, 0);
    const award = await awardMatchRewards(sim, end.result, async () => ok());
    assert.ok(award.ok, award.message);
    assert.ok(honorBalance(sim.player.character) > 0);
});

test('a mutual wipe ends the match immediately as a draw, not at the timer', async () => {
    const sim = createWowSim('warrior');
    await enter(sim);
    const match = currentPvpMatch(sim)!;
    const roster = combatants(sim);
    // Reach the live phase.
    for (let i = 0; i < (PVP_PREP_SECONDS + 1) / FIXED_STEP && match.phase === 'prep'; i++) tick(sim);
    assert.equal(match.phase, 'live');
    // Both teams fall on the same tick (shared DoT / AoE trade).
    for (const c of roster) { c.hp = 0; c.dead = true; }
    const end = tick(sim);
    assert.ok(end, 'mutual wipe ends the match on the spot');
    assert.equal(end.winner, null, 'mutual wipe is a draw');
    assert.equal(match.phase, 'finished');
    assert.equal(end.result.won, false);
    await exitPvpMatch(sim, hostFor(sim));
});

test('a mid-match checkpoint survives the non-enumerable objectives controller', async () => {
    const sim = createWowSim('mage');
    await enter(sim);
    const match = currentPvpMatch(sim)!;
    tick(sim); // runtime init attaches the arena controller
    assert.ok(match.objectives);
    const clone = structuredClone(sim.captureCheckpoint());
    assert.ok(clone.expeditions); // no DataCloneError
    // Plain assignment is repaired too: the loop re-hides enumerable controllers.
    attachPvpObjectives(match, arenaObjectives());
    assert.ok(!Object.prototype.propertyIsEnumerable.call(match, 'objectives'));
});
