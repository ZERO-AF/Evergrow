/** Battleground objective controllers (wayfinder T07): the `match.objectives`
 * seam that turns a PvP match from a team wipe into Warsong Gulch capture-the-
 * flag or Arathi Basin node control.
 *
 * Two halves:
 *  - Controllers (`WarsongGulchObjectives`, `ArathiBasinObjectives`) implement
 *    the PvpObjectives interface — `update(sim, match, dt)` advances flag/node
 *    state, `score()` mirrors the headline score onto `match.score`, and
 *    `winner()` reports an objective victory (the match loop keeps its
 *    team-wipe fallback for the other case).
 *  - NPC objective AI: controllers publish a per-combatant `ObjectiveDirective`
 *    each update; `decideCombatantInput` (pvp-ai.ts) reads it and steers toward
 *    the point, yielding only to hostiles inside the directive's engage radius.
 *
 * Attachment is clone-safe: `attachPvpObjectives` defines `match.objectives` as
 * a NON-enumerable property, so `captureCheckpoint`'s structuredClone skips it
 * (a function-valued enumerable field would throw DataCloneError on autosave).
 * A reloaded match record simply has no controller; `attachBattlegroundObjectives`
 * re-creates one, restoring the headline score from `match.score`. */
import { applySlow } from './combat-status.ts';
import { pushChatMessage } from './chat-log.ts';
import { currentDungeon } from './dungeon-state.ts';
import type { DungeonFloor } from './dungeon.ts';
import { BG_FLAG_PROP_IDS, BG_NODE_NAMES, BG_NODE_PROP_PREFIX } from './bg-maps.ts';
import type { Combatant, PvpTeam } from './pvp-combatant.ts';
import { attachPvpObjectives, type PvpMatch, type PvpObjectives } from './pvp-instance.ts';
import type { Simulation } from './simulation.ts';

// ── NPC objective directives ─────────────────────────────────────────────────

/** Where an objective controller wants this combatant to be. Consumed by
 * `decideCombatantInput`: the combatant moves to `x,y` and holds inside
 * `within`, unless a hostile is closer than `engage` (0 = never divert — the
 * flag carrier keeps running). */
export type { ObjectiveDirective } from './pvp-directives.ts';
export { objectiveDirective, setObjectiveDirective } from './pvp-directives.ts';
import { setObjectiveDirective } from './pvp-directives.ts';

// ── Shared helpers ───────────────────────────────────────────────────────────

const teamName = (team: PvpTeam): string => team === 'A' ? 'Your team' : 'The enemy';
const other = (team: PvpTeam): PvpTeam => team === 'A' ? 'B' : 'A';
const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

// ── Warsong Gulch: capture the flag ──────────────────────────────────────────

export interface FlagState {
    /** The combatant carrying the flag, if any. */
    carrier: Combatant | null;
    /** 'home' on its stand, 'carried' by `carrier`, 'dropped' where a carrier died. */
    state: 'home' | 'carried' | 'dropped';
    /** Live flag position (the carrier's position while carried). */
    x: number;
    y: number;
    /** The stand this flag returns to. */
    readonly stand: { x: number; y: number };
}

export class WarsongGulchObjectives implements PvpObjectives {
    readonly flags: Record<PvpTeam, FlagState>;
    /** Captures per team — the WSG score. */
    readonly captures = { A: 0, B: 0 };
    /** First to this many captures wins. */
    target = 3;
    /** Touch distance for pickup/return; capture distance to the own stand. */
    touchRadius = 40;
    captureRadius = 80;
    /** Carrier movement penalty, refreshed each update. */
    carrierSlow = 0.7;
    constructor(standA: { x: number; y: number }, standB: { x: number; y: number }) {
        this.flags = {
            A: { carrier: null, state: 'home', x: standA.x, y: standA.y, stand: standA },
            B: { carrier: null, state: 'home', x: standB.x, y: standB.y, stand: standB },
        };
    }
    score(): { A: number; B: number } { return { ...this.captures }; }
    winner(): PvpTeam | null {
        return this.captures.A >= this.target ? 'A' : this.captures.B >= this.target ? 'B' : null;
    }
    update(sim: Simulation, match: PvpMatch, _dt: number): void {
        const roster = sim.pvpCombatants ?? [];
        if (match.phase !== 'live') {
            for (const c of roster) setObjectiveDirective(c, undefined);
            return;
        }
        for (const team of ['A', 'B'] as const) {
            const flag = this.flags[team];
            if (flag.carrier && (flag.carrier.dead || !roster.includes(flag.carrier))) {
                // Dropped on death: the flag lies where the carrier fell.
                flag.state = 'dropped';
                flag.x = flag.carrier.x; flag.y = flag.carrier.y;
                flag.carrier = null;
                pushChatMessage(sim.player, 'system', `${teamName(team)} flag was dropped.`, sim.time);
            }
        }
        for (const c of roster) {
            if (c.dead) continue;
            const own = this.flags[c.team], theirs = this.flags[other(c.team)];
            // Capture: carrying the enemy flag onto your own stand while your flag is home.
            if (theirs.carrier === c && own.state === 'home' && dist(c, own.stand) <= this.captureRadius) {
                theirs.state = 'home'; theirs.x = theirs.stand.x; theirs.y = theirs.stand.y; theirs.carrier = null;
                this.captures[c.team] += 1;
                pushChatMessage(sim.player, 'system', `${teamName(c.team)} captured the flag! (${this.captures[c.team]}/${this.target})`, sim.time);
                continue;
            }
            // Return: touching your own dropped flag sends it home.
            if (own.state === 'dropped' && dist(c, own) <= this.touchRadius) {
                own.state = 'home'; own.x = own.stand.x; own.y = own.stand.y;
                pushChatMessage(sim.player, 'system', `${teamName(c.team)} flag was returned.`, sim.time);
                continue;
            }
            // Pickup: touching a free enemy flag (on its stand or dropped) carries it.
            if (theirs.state !== 'carried' && dist(c, theirs) <= this.touchRadius) {
                theirs.state = 'carried'; theirs.carrier = c;
                pushChatMessage(sim.player, 'system', `${teamName(c.team)} picked up the enemy flag!`, sim.time);
            }
        }
        for (const team of ['A', 'B'] as const) {
            const flag = this.flags[team];
            if (flag.state === 'carried' && flag.carrier) {
                flag.x = flag.carrier.x; flag.y = flag.carrier.y;
                applySlow(flag.carrier, { duration: 0.35, factor: this.carrierSlow });
            }
        }
        match.score.A = this.captures.A; match.score.B = this.captures.B;
        this.assign(sim, 'A');
        this.assign(sim, 'B');
    }
    /** Flag-runners, escorts, returners and defenders for one team. */
    private assign(sim: Simulation, team: PvpTeam): void {
        const own = this.flags[team], theirs = this.flags[other(team)];
        const members = (sim.pvpCombatants ?? []).filter(c => c.team === team && !c.dead && c !== sim.player);
        for (const c of members) { setObjectiveDirective(c, undefined); delete c.ai.focusId; }
        const take = (count: number, near: { x: number; y: number }): Combatant[] =>
            members.sort((a, b) => dist(a, near) - dist(b, near)).splice(0, count);
        // The carrier runs it home — engage 0 keeps it moving through fights.
        const carrier = theirs.carrier;
        if (carrier && members.includes(carrier)) {
            members.splice(members.indexOf(carrier), 1);
            setObjectiveDirective(carrier, { x: own.stand.x, y: own.stand.y, within: this.captureRadius - 10, engage: 0 });
        }
        // Flag-returners hunt the enemy carrier holding our flag.
        if (own.state === 'carried' && own.carrier) {
            const focus = own.carrier;
            for (const c of take(2, focus)) {
                setObjectiveDirective(c, { x: focus.x, y: focus.y, within: 50, engage: 140 });
                c.ai.focusId = focus.id;
            }
        }
        // Flag-runners go for a free enemy flag; escorts screen our carrier.
        if (theirs.state !== 'carried')
            for (const c of take(2, theirs)) setObjectiveDirective(c, { x: theirs.x, y: theirs.y, within: 24, engage: 90 });
        if (carrier)
            for (const c of take(2, carrier)) setObjectiveDirective(c, { x: carrier.x, y: carrier.y, within: 90, engage: 280 });
        // Everyone left defends our flag stand.
        for (const c of take(members.length, own.stand))
            setObjectiveDirective(c, { x: own.stand.x, y: own.stand.y, within: 70, engage: 240 });
    }
}

// ── Arathi Basin: node control ───────────────────────────────────────────────

export interface NodeState {
    readonly id: string;
    readonly name: string;
    readonly x: number;
    readonly y: number;
    owner: PvpTeam | null;
    /** Capture progress 0..1 toward `progressTeam`. */
    progress: number;
    progressTeam: PvpTeam | null;
}

export class ArathiBasinObjectives implements PvpObjectives {
    readonly nodes: NodeState[];
    /** Accumulated resources per team — the AB score. */
    readonly resources = { A: 0, B: 0 };
    /** First to this many resources wins. */
    target = 1600;
    /** Seconds of uncontested presence to capture a node. */
    captureTime = 4;
    /** Resources per second per owned node. */
    resourceRate = 1;
    /** Presence radius around a node prop. */
    captureRadius = 110;
    /** Partial capture progress decays at this fraction of the capture rate. */
    decayRate = 0.5;
    private readonly home: Record<PvpTeam, { x: number; y: number }>;
    constructor(nodes: readonly NodeState[], spawns: Record<PvpTeam, { x: number; y: number }>) {
        this.nodes = nodes.map(node => ({ ...node }));
        this.home = spawns;
    }
    score(): { A: number; B: number } { return { A: Math.floor(this.resources.A), B: Math.floor(this.resources.B) }; }
    winner(): PvpTeam | null {
        return this.resources.A >= this.target ? 'A' : this.resources.B >= this.target ? 'B' : null;
    }
    update(sim: Simulation, match: PvpMatch, dt: number): void {
        const roster = sim.pvpCombatants ?? [];
        if (match.phase !== 'live') {
            for (const c of roster) setObjectiveDirective(c, undefined);
            return;
        }
        const alive = roster.filter(c => !c.dead);
        for (const node of this.nodes) {
            const present = alive.filter(c => dist(c, node) <= this.captureRadius);
            const teams = new Set(present.map(c => c.team));
            if (teams.size > 1) continue; // contested: capture progress pauses
            const side = present[0]?.team ?? null;
            if (!side) {
                node.progress = Math.max(0, node.progress - dt * this.decayRate);
                if (node.progress === 0) node.progressTeam = null;
                continue;
            }
            if (node.owner === side) { node.progress = 0; node.progressTeam = null; continue; }
            if (node.progressTeam !== side) { node.progressTeam = side; node.progress = 0; }
            node.progress += dt / this.captureTime;
            if (node.progress >= 1) {
                node.owner = side; node.progress = 0; node.progressTeam = null;
                pushChatMessage(sim.player, 'system', `${teamName(side)} captured ${node.name}.`, sim.time);
            }
        }
        const owned = (team: PvpTeam) => this.nodes.filter(node => node.owner === team).length;
        this.resources.A += owned('A') * this.resourceRate * dt;
        this.resources.B += owned('B') * this.resourceRate * dt;
        match.score.A = Math.floor(this.resources.A); match.score.B = Math.floor(this.resources.B);
        this.assign(sim, 'A');
        this.assign(sim, 'B');
    }
    /** Capture groups, node defense and reinforcement for one team. */
    private assign(sim: Simulation, team: PvpTeam): void {
        const members = (sim.pvpCombatants ?? []).filter(c => c.team === team && !c.dead && c !== sim.player);
        for (const c of members) setObjectiveDirective(c, undefined);
        const enemies = (sim.pvpCombatants ?? []).filter(c => c.team !== team && !c.dead);
        const contested = (node: NodeState) => enemies.some(e => dist(e, node) <= this.captureRadius);
        const take = (count: number, near: { x: number; y: number }): Combatant[] =>
            members.sort((a, b) => dist(a, near) - dist(b, near)).splice(0, count);
        // Defense first: one guard per owned node, two when enemies contest it.
        for (const node of this.nodes.filter(node => node.owner === team))
            for (const c of take(contested(node) ? 2 : 1, node))
                setObjectiveDirective(c, { x: node.x, y: node.y, within: 80, engage: 260 });
        // Capture groups spread over the nodes we don't hold, nearest to home first.
        const needy = this.nodes.filter(node => node.owner !== team)
            .sort((a, b) => dist(a, this.home[team]) - dist(b, this.home[team]));
        for (const node of needy)
            for (const c of take(2, node))
                setObjectiveDirective(c, { x: node.x, y: node.y, within: 70, engage: 220 });
        // Leftovers reinforce the nearest owned node (or midfield when we hold none).
        const fallback = this.nodes.find(node => node.owner === team) ?? null;
        for (const c of take(members.length, fallback ?? { x: 0, y: 0 }))
            setObjectiveDirective(c, { x: (fallback ?? { x: 0, y: 0 }).x, y: (fallback ?? { x: 0, y: 0 }).y, within: 90, engage: 260 });
    }
}

// ── Attachment ───────────────────────────────────────────────────────────────

/** Builds the objective controller for a battleground floor, or undefined when
 * the floor carries no recognized objective props (arena maps). */
export function createBattlegroundObjectives(floor: DungeonFloor): PvpObjectives | undefined {
    const props = floor.props ?? [];
    const at = (id: string) => props.find(prop => prop.id === id);
    const flagA = at(BG_FLAG_PROP_IDS.A), flagB = at(BG_FLAG_PROP_IDS.B);
    if (flagA && flagB) return new WarsongGulchObjectives(flagA, flagB);
    const nodes: NodeState[] = BG_NODE_NAMES.flatMap(([id, name]) => {
        const prop = at(`${BG_NODE_PROP_PREFIX}${id}`);
        return prop ? [{ id, name, x: prop.x, y: prop.y, owner: null, progress: 0, progressTeam: null }] : [];
    });
    if (nodes.length && floor.pvp)
        return new ArathiBasinObjectives(nodes, { A: floor.pvp.spawns.A[0]!, B: floor.pvp.spawns.B[0]! });
    return undefined;
}

/** Attaches the right objective controller to the live battleground match.
 * Idempotent and reload-safe: call it after `enterPvpMatch`/`enterBattleground`
 * and again at the top of the per-tick match loop — a checkpoint-restored match
 * record has no controller, so this re-creates one (restoring the headline
 * score from `match.score`). No-op for arena matches or missing maps. */
export function attachBattlegroundObjectives(sim: Simulation): PvpObjectives | undefined {
    const match = currentDungeon(sim.expeditions)?.pvp;
    if (!match || match.mode !== 'battleground') return undefined;
    const existing = match.objectives;
    // Already a live BG controller — keep it. Anything else (a data-only clone,
    // or the arena wipe default attached before this ran) is replaced.
    if (existing instanceof WarsongGulchObjectives || existing instanceof ArathiBasinObjectives) return existing;
    const floor = sim.dungeonFloor;
    if (!floor?.pvp) return undefined;
    const controller = createBattlegroundObjectives(floor);
    if (!controller) return undefined;
    // A re-attached controller resumes from the persisted headline score.
    if (controller instanceof WarsongGulchObjectives) {
        controller.captures.A = Math.max(0, Math.floor(match.score.A));
        controller.captures.B = Math.max(0, Math.floor(match.score.B));
    } else if (controller instanceof ArathiBasinObjectives) {
        controller.resources.A = Math.max(0, match.score.A);
        controller.resources.B = Math.max(0, match.score.B);
    }
    attachPvpObjectives(match, controller);
    return controller;
}
