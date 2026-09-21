import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { generateDungeon, dungeonBlocked } from '../src/dungeon.ts';
import { currentDungeon } from '../src/dungeon-state.ts';
import { currentPvpMatch, type PvpMatch, type PvpMatchHost } from '../src/pvp-instance.ts';
import { enterBattleground } from '../src/pvp-bg.ts';
import { buildPvpFloor, pvpMap, pvpMapIdFor } from '../src/pvp-floor.ts';
import { enterPvpMatch } from '../src/pvp-instance.ts';
import { updatePvpMatch, PVP_PREP_SECONDS } from '../src/pvp-match.ts';
import { combatants, type Combatant } from '../src/pvp-combatant.ts';
import { decideCombatantInput } from '../src/pvp-ai.ts';
import { randomNpcBuild } from '../src/pvp-chargen.ts';
import {
    ArathiBasinObjectives, WarsongGulchObjectives, objectiveDirective, setObjectiveDirective,
} from '../src/pvp-objectives.ts';
import { BG_FLAG_PROP_IDS, BG_NODE_PROP_PREFIX } from '../src/bg-maps.ts';
import { createWowSim, idleInput } from './fixtures/wow-sim.ts';
import type { PvpSetup, PvpTeammate } from '../src/pvp-setup.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';
import type { WorldQuery } from '../src/model.ts';

const surface: WorldQuery = { seed: 7319, blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }), sampleBiome: () => ({ id: 'deadwood' }) };
const ok = () => ({ ok: true, message: '' });
const WSG_SETUP: PvpSetup = {
    mode: 'battleground', bracket: 'warsong', custom: null,
    teammates: [{ classId: 'priest', role: 'heal' }, { classId: 'paladin', role: 'tank' }, { classId: 'mage', role: 'dd' }, { classId: 'warrior', role: 'dd' }],
};
const AB_TEAM: PvpTeammate[] = [
    { classId: 'priest', role: 'heal' }, { classId: 'paladin', role: 'tank' }, { classId: 'mage', role: 'dd' }, { classId: 'warrior', role: 'dd' },
    { classId: 'druid', role: 'heal' }, { classId: 'rogue', role: 'dd' }, { classId: 'hunter', role: 'dd' },
];
const AB_SETUP: PvpSetup = { mode: 'battleground', bracket: 'arathi', teammates: AB_TEAM, custom: null };

/** Mirrors pvp-instance.test.ts: the host owns world objects and arrival. */
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
async function enterBg(sim: Simulation, setup: PvpSetup): Promise<PvpMatch> {
    const result = await enterBattleground(sim, setup, hostFor(sim));
    assert.ok(result.ok, result.ok ? '' : result.message);
    const match = currentPvpMatch(sim)!;
    match.phase = 'live'; // T06's loop owns the transition; tests drive it directly.
    return match;
}
/** One frame of the match loop: objective update, then the fixed-step sim. */
function tick(sim: Simulation, match: PvpMatch, seconds: number): void {
    for (let i = 0, steps = Math.round(seconds / FIXED_STEP); i < steps; i++) {
        match.objectives?.update(sim, match, FIXED_STEP);
        sim.update(FIXED_STEP, idleInput);
    }
}
function killTeam(sim: Simulation, team: 'A' | 'B'): void {
    for (const c of combatants(sim)) if (c.team === team) { c.dead = true; c.hp = 0; c.state = 'dead'; }
}
function place(c: Combatant, x: number, y: number): void { c.x = c.prevX = x; c.y = c.prevY = y; }
const npcs = (sim: Simulation, team: 'A' | 'B') => combatants(sim).filter(c => c.team === team && !c.dead && c !== sim.player);

test('battleground floors are deterministic, frozen and carry objective props', () => {
    for (const id of ['warsong', 'arathi'] as const) {
        assert.equal(pvpMapIdFor({ mode: 'battleground', bracket: id }), id);
        assert.ok(pvpMap(id), `${id} registered`);
        assert.deepEqual(buildPvpFloor(id, 7, 1), buildPvpFloor(id, 7, 1));
        const floor = buildPvpFloor(id, 99, 80);
        assert.ok(Object.isFrozen(floor));
        assert.equal(floor.pvp?.mapId, id);
        assert.equal(floor.members.length, 1); // dormant warden placeholder only
    }
    const wsg = buildPvpFloor('warsong', 5, 1);
    assert.ok(wsg.props!.some(p => p.id === BG_FLAG_PROP_IDS.A));
    assert.ok(wsg.props!.some(p => p.id === BG_FLAG_PROP_IDS.B));
    assert.ok(wsg.pvp!.spawns.A.length >= 5 && wsg.pvp!.spawns.B.length >= 5);
    assert.ok(!dungeonBlocked(wsg, -1960, 0, 24));  // A flag stand walkable
    assert.ok(!dungeonBlocked(wsg, 0, 0, 24));      // midfield open
    assert.ok(dungeonBlocked(wsg, -360, -200, 0));  // pillar blocks
    assert.ok(dungeonBlocked(wsg, 0, -2000, 24));   // outside the room union
    const ab = buildPvpFloor('arathi', 5, 1);
    const nodes = ab.props!.filter(p => p.id.startsWith(BG_NODE_PROP_PREFIX));
    assert.equal(nodes.length, 5);
    assert.ok(ab.pvp!.spawns.A.length >= 8 && ab.pvp!.spawns.B.length >= 8);
    for (const node of nodes) assert.ok(!dungeonBlocked(ab, node.x, node.y, 24), `node ${node.id} walkable`);
});

test('objective directives steer NPCs: seek, hold, and yield to close hostiles', () => {
    const sim = createWowSim('warrior');
    const roster = sim.enterPvp([randomNpcBuild(7, 'mage', 1).player], ['B']);
    const npc = roster[1]!;
    npc.x = 0; npc.y = 0;
    setObjectiveDirective(npc, { x: 500, y: 0, within: 30, engage: 0 });
    let input = decideCombatantInput({ self: npc, allies: [npc], hostiles: [], time: sim.time });
    assert.ok(input.moveX > 0.9 && Math.abs(input.moveY) < 0.1, `expected +x seek, got ${input.moveX},${input.moveY}`);
    npc.x = 480; // inside `within`
    input = decideCombatantInput({ self: npc, allies: [npc], hostiles: [], time: sim.time });
    assert.equal(input.moveX, 0);
    assert.equal(input.moveY, 0);
    // A hostile inside the engage radius hands movement back to combat AI —
    // the mage kites away from the close foe instead of seeking the point.
    setObjectiveDirective(npc, { x: 500, y: 0, within: 30, engage: 300 });
    const foe = roster[0]!;
    foe.x = npc.x + 100; foe.y = npc.y;
    input = decideCombatantInput({ self: npc, allies: [npc], hostiles: [foe], time: sim.time });
    assert.ok(input.moveX < 0, `expected kite away from foe, got ${input.moveX}`);
    setObjectiveDirective(npc, undefined);
    input = decideCombatantInput({ self: npc, allies: [npc], hostiles: [], time: sim.time });
    assert.equal(input.moveX, 0); // no directive, no target: stands still
    sim.leavePvp();
});

test('warsong gulch: NPCs run the flag, carriers slow and drop, first to three wins', async () => {
    const sim = createWowSim('warrior');
    const match = await enterBg(sim, WSG_SETUP);
    assert.equal(match.mapId, 'warsong');
    const obj = match.objectives;
    assert.ok(obj instanceof WarsongGulchObjectives);
    assert.equal(combatants(sim).length, 10); // 5v5
    // The attached controller is non-enumerable: checkpoints still clone.
    assert.doesNotThrow(() => sim.captureCheckpoint());
    killTeam(sim, 'B');

    // Flag-runner directives send NPCs at the enemy stand.
    obj.update(sim, match, FIXED_STEP);
    assert.ok(npcs(sim, 'A').some(c => objectiveDirective(c)?.x === 1960), 'expected a flag-runner directive');

    // A runner reaches the enemy flag and picks it up under its own power.
    tick(sim, match, 30);
    assert.equal(obj.flags.B.state, 'carried');
    const carrier = obj.flags.B.carrier!;
    assert.equal(carrier.team, 'A');
    assert.ok(carrier.slowFactor <= 0.7 + 1e-9, 'carrier is slowed');

    // Death drops the flag at the corpse; a teammate can pick it up again.
    carrier.dead = true; carrier.hp = 0; carrier.state = 'dead';
    obj.update(sim, match, FIXED_STEP);
    assert.equal(obj.flags.B.state, 'dropped');
    const next = npcs(sim, 'A')[0]!;
    place(next, obj.flags.B.x + 10, obj.flags.B.y);
    obj.update(sim, match, FIXED_STEP);
    assert.equal(obj.flags.B.state, 'carried');
    assert.equal(obj.flags.B.carrier, next);

    // A dropped friendly flag returns home on a teammate's touch.
    obj.flags.A.state = 'dropped'; obj.flags.A.x = 0; obj.flags.A.y = 0;
    place(next, 10, 0);
    obj.update(sim, match, FIXED_STEP);
    assert.equal(obj.flags.A.state, 'home');

    // Captures: carrier on its own stand while the friendly flag is home.
    for (let guard = 0; obj.captures.A < 3 && guard < 8; guard++) {
        obj.update(sim, match, FIXED_STEP); // housekeeping settles carriers
        const flag = obj.flags.B;
        const runner = flag.carrier && !flag.carrier.dead ? flag.carrier : npcs(sim, 'A')[0]!;
        if (flag.state !== 'carried') {
            place(runner, flag.x + 20, flag.y); // touch the flag to pick it up
            obj.update(sim, match, FIXED_STEP);
        }
        if (flag.carrier === runner) {
            place(runner, obj.flags.A.stand.x + 30, obj.flags.A.stand.y); // on the A stand
            obj.update(sim, match, FIXED_STEP);
        }
    }
    assert.equal(obj.captures.A, 3);
    assert.equal(match.score.A, 3);
    assert.deepEqual(obj.score(), { A: 3, B: 0 });
    assert.equal(obj.winner(), 'A');
});

test('arathi basin: NPCs capture nodes, resources tick, first to 1600 wins', async () => {
    const sim = createWowSim('warrior');
    const match = await enterBg(sim, AB_SETUP);
    assert.equal(match.mapId, 'arathi');
    const obj = match.objectives;
    assert.ok(obj instanceof ArathiBasinObjectives);
    assert.equal(combatants(sim).length, 16); // 8v8
    assert.equal(obj.nodes.length, 5);
    obj.captureTime = 0.5; obj.resourceRate = 40; // test speed
    killTeam(sim, 'B');

    // Capture-group directives send NPCs at the nodes.
    obj.update(sim, match, FIXED_STEP);
    assert.ok(npcs(sim, 'A').some(c => objectiveDirective(c)), 'expected node directives');

    // NPCs walk to nodes and capture them; owned nodes tick resources.
    tick(sim, match, 25);
    const owned = obj.nodes.filter(n => n.owner === 'A');
    assert.ok(owned.length >= 2, `expected A to hold nodes, got ${obj.nodes.map(n => `${n.id}:${n.owner}`).join(',')}`);
    const before = obj.resources.A;
    tick(sim, match, 1);
    assert.ok(obj.resources.A > before, 'owned nodes tick resources');
    assert.equal(match.score.A, Math.floor(obj.resources.A));

    // A contested node pauses capture; once clear, presence alone captures.
    const node = obj.nodes.find(n => n.id === 'blacksmith')!;
    node.owner = null; node.progress = 0; node.progressTeam = null;
    const foe = combatants(sim).find(c => c.team === 'B')!;
    foe.dead = false; foe.hp = foe.maxHp; foe.state = 'chase'; foe.stunTime = 60;
    const friend = npcs(sim, 'A')[0]!;
    friend.stunTime = 60; // held in place so presence is deterministic
    place(foe, node.x + 30, node.y); place(friend, node.x - 30, node.y);
    tick(sim, match, 1);
    assert.equal(node.owner, null);
    assert.equal(node.progress, 0);
    foe.dead = true; foe.hp = 0; foe.state = 'dead';
    tick(sim, match, 1);
    assert.equal(node.owner, 'A');

    // First to 1600 resources wins.
    obj.resources.A = 1599.9;
    tick(sim, match, 0.5);
    assert.equal(obj.winner(), 'A');
    assert.ok(match.score.A >= 1600);
});

test('a warsong match ends through updatePvpMatch on the third capture', async () => {
    const sim = createWowSim('warrior');
    const result = await enterBattleground(sim, WSG_SETUP, hostFor(sim));
    assert.ok(result.ok, result.ok ? '' : result.message);
    const match = currentPvpMatch(sim)!;
    const obj = match.objectives;
    assert.ok(obj instanceof WarsongGulchObjectives);
    // The real frame order: match loop first, then the sim step.
    const frame = () => { const end = updatePvpMatch(sim, FIXED_STEP); sim.update(FIXED_STEP, idleInput); return end; };
    for (let i = 0; i < (PVP_PREP_SECONDS + 1) / FIXED_STEP && match.phase === 'prep'; i++) frame();
    assert.equal(match.phase, 'live');
    // Freeze team B once the gates open so the objective race is deterministic.
    for (const c of combatants(sim)) if (c.team === 'B') c.stunTime = 1e9;

    // An NPC flag-runner crosses the map and takes the enemy flag unassisted.
    for (let i = 0; i < 40 / FIXED_STEP && obj.flags.B.state !== 'carried'; i++) frame();
    assert.equal(obj.flags.B.state, 'carried');
    assert.equal(obj.flags.B.carrier!.team, 'A');

    // Teleport-assisted captures: the real loop scores each one and ends at 3.
    let end;
    for (let guard = 0; !end && guard < 600; guard++) {
        const flag = obj.flags.B;
        const runner = flag.carrier && !flag.carrier.dead ? flag.carrier : npcs(sim, 'A')[0]!;
        if (flag.state !== 'carried') place(runner, flag.x + 20, flag.y);
        else place(runner, obj.flags.A.stand.x + 30, obj.flags.A.stand.y);
        end = frame();
    }
    assert.ok(end, 'match ended');
    assert.equal(end.winner, 'A');
    assert.equal(obj.captures.A, 3);
    assert.equal(end.result.objectives, 3);
    assert.equal(end.result.mode, 'battleground');
    assert.equal(match.phase, 'finished');
});

test('the game.ts path attaches BG objectives: enterPvpMatch + updatePvpMatch', async () => {
    const sim = createWowSim('warrior');
    const result = await enterPvpMatch(sim, WSG_SETUP, hostFor(sim));
    assert.ok(result.ok, result.ok ? '' : result.message);
    const match = currentPvpMatch(sim)!;
    const unattached = match.objectives === undefined;
    assert.ok(unattached); // nothing attached yet
    for (let i = 0; i < (PVP_PREP_SECONDS + 1) / FIXED_STEP && match.phase === 'prep'; i++) {
        updatePvpMatch(sim, FIXED_STEP); sim.update(FIXED_STEP, idleInput);
    }
    assert.equal(match.phase, 'live');
    updatePvpMatch(sim, FIXED_STEP);
    const attached = match.objectives;
    assert.ok(attached instanceof WarsongGulchObjectives, 'match loop attached the WSG controller');
});
