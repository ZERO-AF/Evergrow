import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { generateDungeon } from '../src/dungeon.ts';
import { currentDungeon } from '../src/dungeon-state.ts';
import { enterPvpMatch, currentPvpMatch, type PvpMatchHost } from '../src/pvp-instance.ts';
import { enterBattleground } from '../src/pvp-bg.ts';
import { combatants } from '../src/pvp-combatant.ts';
import { drainPvpAnnouncements, pvpScoreboard, updatePvpMatch, PVP_PREP_SECONDS } from '../src/pvp-match.ts';
import { WarsongGulchObjectives } from '../src/pvp-objectives.ts';
import { awardMatchRewards, nextArenaRating, PVP_RATING_START } from '../src/pvp-rewards.ts';
import { achievementComplete } from '../src/achievement-state.ts';
import { decideCombatantInput } from '../src/pvp-ai.ts';
import { createCustomBuild, type PvpSetup } from '../src/pvp-setup.ts';
import { createWowSim, idleInput } from './fixtures/wow-sim.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';
import type { WorldQuery } from '../src/model.ts';

const ok = () => ({ ok: true, message: '' });
const SETUP_2V2: PvpSetup = { mode: 'arena', bracket: '2v2', teammates: [{ classId: 'priest', role: 'heal' }], custom: null };

function hostFor(sim: Simulation, seed = 7319): PvpMatchHost {
    const surface: WorldQuery = { seed, blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }), sampleBiome: () => ({ id: 'deadwood' }) };
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
async function enter(sim: Simulation, setup: PvpSetup = SETUP_2V2, seed = 7319) {
    const result = await enterPvpMatch(sim, setup, hostFor(sim, seed));
    assert.ok(result.ok, result.ok ? '' : result.message);
    return result;
}
function tick(sim: Simulation, seconds = FIXED_STEP) {
    const end = updatePvpMatch(sim, seconds);
    sim.update(seconds, idleInput);
    return end;
}
/** Drive the player combatant with the same class AI the NPCs use. */
function aiInput(sim: Simulation) {
    const roster = combatants(sim);
    const me = roster[0]!;
    return decideCombatantInput({ self: me, allies: roster.filter(c => c.team === 'A' && !c.dead), hostiles: roster.filter(c => c.team === 'B' && !c.dead), time: sim.time });
}

test('announcements fire on match start, kills and the result banner', async () => {
    const sim = createWowSim('warrior');
    await enter(sim, { ...SETUP_2V2, custom: { ...createCustomBuild('warrior', 'human'), level: 40, seed: 7932 } }, 7932);
    const drained: string[] = [];
    const pump = () => { for (const a of drainPvpAnnouncements(sim)) drained.push(a.text); };
    tick(sim); pump();
    assert.ok(drained.some(t => t.includes('gates are closed')), 'prep horn callout');
    const match = currentPvpMatch(sim)!;
    for (let i = 0; i < (PVP_PREP_SECONDS + 1) / FIXED_STEP && match.phase === 'prep'; i++) { tick(sim); pump(); }
    assert.equal(match.phase, 'live');
    assert.ok(drained.some(t => t === 'Fight!'), 'fight callout');
    // Let the fight resolve; first blood + a result banner must appear.
    let end;
    for (let i = 0; i < 120 / FIXED_STEP && !end; i++) { end = updatePvpMatch(sim, FIXED_STEP); pump(); sim.update(FIXED_STEP, aiInput(sim)); }
    assert.ok(end, 'match resolves');
    assert.ok(drained.some(t => t.includes('First Blood')), 'first blood callout');
    assert.ok(drained.some(t => /^(Victory|Defeat|Draw)/.test(t)), 'result banner');
    // The finished match holds survivors stunned until exit.
    for (const c of combatants(sim)) if (!c.dead) assert.ok((c.stunTime ?? 0) > 0);
});

test('live scoreboard exposes per-combatant stats and objective credit', async () => {
    const sim = createWowSim('warrior');
    await enter(sim, { ...SETUP_2V2, custom: { ...createCustomBuild('warrior', 'human'), level: 40, seed: 7932 } }, 7932);
    // Before the first tick the board is roster-shaped with zeroed stats.
    const early = pvpScoreboard(sim)!;
    assert.equal(early.rows.length, 4);
    assert.ok(early.rows[0]!.isPlayer && early.rows.every(r => r.kills === 0 && r.objectives === 0));
    const match = currentPvpMatch(sim)!;
    for (let i = 0; i < (PVP_PREP_SECONDS + 1) / FIXED_STEP && match.phase === 'prep'; i++) tick(sim);
    for (let i = 0; i < 30 / FIXED_STEP; i++) { const e = updatePvpMatch(sim, FIXED_STEP); sim.update(FIXED_STEP, aiInput(sim)); if (e) break; }
    const board = pvpScoreboard(sim)!;
    assert.equal(board.rows.length, 4);
    assert.ok(board.rows.reduce((s, r) => s + r.damageDone + r.damageTaken, 0) > 0, 'combat stats accumulate');
    assert.ok(board.rows.every(r => typeof r.objectives === 'number'));
});

test('warsong flag events announce and credit the carrier', async () => {
    const sim = createWowSim('warrior');
    const result = await enterBattleground(sim,
        { mode: 'battleground', bracket: 'warsong', teammates: [], custom: { ...createCustomBuild('warrior', 'human'), role: 'tank', level: 40, seed: 4242 } },
        hostFor(sim, 4242));
    assert.ok(result.ok, result.ok ? '' : result.message);
    const match = currentPvpMatch(sim)!;
    let end;
    for (let i = 0; i < 10 / FIXED_STEP && match.phase !== 'live' && !end; i++) end = tick(sim);
    assert.equal(match.phase, 'live');
    const objectives = match.objectives;
    assert.ok(objectives instanceof WarsongGulchObjectives);
    const me = combatants(sim)[0]!;
    me.x = objectives.flags.B.stand.x; me.y = objectives.flags.B.stand.y;
    tick(sim);
    const heard = drainPvpAnnouncements(sim).map(a => a.text).join('|');
    assert.match(heard, /picked up the enemy flag/);
    assert.equal(objectives.flags.B.carrier, me);
    me.x = objectives.flags.A.stand.x; me.y = objectives.flags.A.stand.y;
    tick(sim);
    assert.match(drainPvpAnnouncements(sim).map(a => a.text).join('|'), /captured the flag/);
    assert.equal(match.score.A, 1);
    assert.equal(pvpScoreboard(sim)!.rows.find(r => r.isPlayer)!.objectives, 1);
});

test('pvp achievements unlock from match results: wins, maps, rating, flags, streak', async () => {
    const sim = createWowSim('mage');
    const award = (result: Parameters<typeof awardMatchRewards>[1]) => awardMatchRewards(sim, result, async () => ok());
    const arenaWin = (map: string) => ({ mode: 'arena' as const, bracket: '2v2' as const, map, won: true, kills: 2 });
    // First win: First Blood + map veteran progress + rating climbs off 1500.
    let r = await award(arenaWin('arena-nagrand'));
    assert.ok(r.ok);
    assert.ok(achievementComplete(sim.player.achievements, 'first-blood-arena'));
    assert.equal(sim.player.character.arenaRating, PVP_RATING_START + 16);
    // Rating ladder: enough wins reach Arena Contender (1600) then Rival (2000).
    for (let i = 0; i < 63; i++) await award(arenaWin('arena-nagrand'));
    assert.ok(achievementComplete(sim.player.achievements, 'arena-contender'));
    assert.equal(sim.player.character.arenaRating, PVP_RATING_START + 64 * 16);
    // Flag captures and the five-node hold feed their own criteria.
    r = await award({ mode: 'battleground', bracket: 'warsong', map: 'warsong', won: true, flagCaptures: 1, kills: 1 });
    assert.ok(achievementComplete(sim.player.achievements, 'warsong-gulch-victory'));
    assert.ok(achievementComplete(sim.player.achievements, 'warsong-flag-runner'));
    r = await award({ mode: 'battleground', bracket: 'arathi', map: 'arathi', won: true, heldAllNodes: true });
    assert.ok(achievementComplete(sim.player.achievements, 'arathi-basin-victory'));
    assert.ok(achievementComplete(sim.player.achievements, 'arathi-perfection'));
    // Streak: a loss resets the counter, three straight wins earn Hot Streak.
    await award({ mode: 'arena', bracket: '2v2', map: 'arena-nagrand', won: false });
    assert.equal(sim.player.achievements?.['pvp:streak'], 0);
    for (let i = 0; i < 3; i++) await award(arenaWin('arena-blades-edge'));
    assert.ok(achievementComplete(sim.player.achievements, 'hot-streak'));
    assert.equal(nextArenaRating(undefined, { mode: 'battleground', bracket: 'warsong', won: true }), PVP_RATING_START);
});

test('a mid-level AI-driven player team wins contested matches; an idle player loses', async () => {
    // Deterministic seeds: the AI-driven warrior wins on 7932, loses on 31689 —
    // contested, not a stomp either way. The idle player never carries a win.
    const play = async (seed: number, drive: boolean) => {
        const sim = createWowSim('warrior');
        await enter(sim, { ...SETUP_2V2, custom: { ...createCustomBuild('warrior', 'human'), level: 40, seed } }, seed);
        let end, ticks = 0;
        while (!end && ticks < 60 / FIXED_STEP) {
            end = updatePvpMatch(sim, FIXED_STEP);
            sim.update(FIXED_STEP, drive ? aiInput(sim) : idleInput);
            ticks++;
        }
        return { winner: end?.winner ?? null, secs: ticks * FIXED_STEP };
    };
    const win = await play(7932, true);
    assert.equal(win.winner, 'A');
    const loss = await play(31689, true);
    assert.equal(loss.winner, 'B');
    const idle = await play(15851, false);
    assert.equal(idle.winner, 'B');
});
