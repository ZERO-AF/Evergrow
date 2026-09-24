/** PvP match instance (wayfinder T02): a match record riding on a DungeonRun,
 * plus the enter/exit travel that hosts it. `enterPvpMatch` stages the whole
 * transition through planDungeonTravel's checkpoint path — surface contents
 * frozen, run created, world swapped, combatants placed at team spawns — and
 * `exitPvpMatch` returns the player to the exact pre-match point (the pvp
 * entrance stores it verbatim; the exit landing uses it unchanged).
 *
 * The record (`DungeonRun.pvp`) is serializable: it persists inside the run
 * through every checkpoint, so a mid-match save/reload still knows the roster,
 * phase, score and — for Custom mode — the real character sheet to restore.
 * T06/T07 own phase transitions, win checks and rewards; this file owns the
 * chassis: get in, place teams, get out. */
import { planDungeonTravel, type DungeonResult } from './dungeon-command.ts';
import { currentDungeon } from './dungeon-state.ts';
import { generateDungeon, type DungeonFloor } from './dungeon.ts';
import { pvpEntrance, pvpMap, pvpMapIdFor } from './pvp-floor.ts';
import { randomNpcBuild, buildCustomCharacter, seedResource, type PvpBuildSummary } from './pvp-chargen.ts';
import { pvpTeamSize, pvpBracketLabel, type PvpBracket, type PvpMode, type PvpRole, type PvpSetup } from './pvp-setup.ts';
import { WOW_CLASS_IDS, type WowClassId } from './wow-types.ts';
import { cloneData } from './data-clone.ts';
import { randomSource } from './random-source.ts';
import { refreshCharacter } from './character.ts';
import type { CharacterSheet } from './character-types.ts';
import type { Player, WorldQuery, WowBuff } from './model.ts';
import type { Combatant, PvpTeam } from './pvp-combatant.ts';
import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';

export type PvpMatchPhase = 'prep' | 'live' | 'finished';
/** One roster slot. `spawn` is the pad this combatant was placed at; roster
 * order equals `combatants(sim)` order (index 0 is always the real player). */
export interface PvpRosterEntry {
    readonly name: string;
    readonly team: PvpTeam;
    readonly classId?: WowClassId;
    readonly role?: PvpRole;
    readonly spawn: { x: number; y: number };
    readonly summary?: PvpBuildSummary;
}
/** The persisted half of a match: everything a reload or a scoreboard needs.
 * `savedCharacter` is the real sheet/level/name a Custom build replaced;
 * `savedState` is the universal pre-match player snapshot (resources, buffs,
 * consumables — and gear for the saved-character path) restored on exit. */
export interface PvpMatch {
    mode: PvpMode;
    bracket: PvpBracket;
    mapId: string;
    seed: number;
    /** Sim time the match was entered; saved buffs decay by the elapsed span. */
    enteredAt: number;
    phase: PvpMatchPhase;
    score: { A: number; B: number };
    roster: PvpRosterEntry[];
    savedCharacter?: { character: CharacterSheet; level: number; name?: string };
    /** Pre-match player state, snapshotted for every entry mode. */
    savedState?: {
        hp: number; mana: number;
        flasks: number; healCooldown: number;
        soulShards?: number; runes?: number[];
        buffs?: WowBuff[];
        mounted?: Player['mounted'];
        /** Saved-character path only: gear+pack snapshot (the live sheet stays
         * mutable so honor drip and mid-match progress still land). */
        gear?: { equipped: CharacterSheet['equipped']; inventory: CharacterSheet['inventory']; inventoryLayout?: CharacterSheet['inventoryLayout']; bags?: CharacterSheet['bags'] };
    };
    /** Optional objective controller (battlegrounds). The match loop calls
     * `update` each tick and `winner` to decide a non-wipe victory. */
    objectives?: PvpObjectives;
}
/** An objective-driven win condition layered on the team-wipe default. */
export interface PvpObjectives {
    update(sim: Simulation, match: PvpMatch, dt: number): void;
    score(): { A: number; B: number };
    /** Objective win threshold (flag captures, resource target); the match loop
     * normalizes `score.A` against it for the honor award. */
    readonly target?: number;
    winner(): 'A' | 'B' | null;
    /** Transient per-tick objective events (flag pickups, node captures) the
     * match loop drains for scoreboard credit and announcements. Lives on the
     * controller — never on the checkpointed match record. */
    events?: PvpObjectiveEvent[];
    /** Peak simultaneous node count per team plus the node total (Arathi);
     * feeds the "hold every node" achievement. */
    peakOwned?: { A: number; B: number; total: number };
}
/** One objective beat, emitted by battleground controllers. `team` is the
 * acting team; `flagTeam`/`owner` name the flag's/node's owning side. */
export interface PvpObjectiveEvent {
    readonly kind: 'flag-pickup' | 'flag-drop' | 'flag-return' | 'flag-capture' | 'node-assault' | 'node-capture';
    readonly team: PvpTeam;
    /** The acting combatant (carrier, returner); absent for node events. */
    readonly combatant?: Combatant;
    /** Combatants credited for a node capture (present on the node). */
    readonly captors?: readonly Combatant[];
    /** Flag's owning team for drops; node's previous owner for assaults. */
    readonly owner?: PvpTeam | null;
    readonly node?: string;
    /** Score after a capture ("2/3"). */
    readonly score?: { A: number; B: number };
    readonly target?: number;
}
/**
 * Attaches an objective controller so it survives checkpoints: defined
 * non-enumerable, structuredClone skips it, and the match loop re-attaches the
 * arena default (or a battleground controller) lazily after a reload. Lives here
 * (not pvp-match.ts) so objective controllers can attach without a pvp-match ↔
 * pvp-objectives import cycle.
 */
export function attachPvpObjectives(match: PvpMatch, objectives: PvpObjectives): void {
    Object.defineProperty(match, 'objectives', { value: objectives, writable: true, enumerable: false, configurable: true });
}
/** The live match on the current run, or undefined outside a PvP instance. */
export function currentPvpMatch(sim: Pick<Simulation, 'expeditions'>): PvpMatch | undefined {
    return currentDungeon(sim.expeditions)?.pvp;
}

/** Same seam LocationController uses: the caller owns world objects and the
 * post-travel camera/spawn-exclusion reset. */
export interface PvpMatchHost {
    surface(): WorldQuery;
    persist(checkpoint: CharacterCheckpoint): { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>;
    restoreWorld(checkpoint: CharacterCheckpoint): void;
    arrived(): void;
}

interface BuiltMatch {
    match: PvpMatch;
    npcs: Player[];
    teams: PvpTeam[];
}

/** Builds the roster record and the NPC actors for a setup. Team A is the
 * player plus their chosen teammates; team B is a seeded equal-size enemy team. */
function buildMatch(sim: Simulation, setup: PvpSetup, seed: number, floor: DungeonFloor): BuiltMatch {
    const tag = floor.pvp!;
    const size = pvpTeamSize(setup.bracket);
    const level = Math.max(1, Math.min(80, Math.round(setup.custom?.level ?? sim.player.level)));
    const random = randomSource(seed);
    const npcs: Player[] = [], teams: PvpTeam[] = [], roster: PvpRosterEntry[] = [];
    const slot = (team: PvpTeam) => tag.spawns[team][roster.filter(r => r.team === team).length] ?? tag.center;
    roster.push({
        name: setup.custom ? 'Custom' : (sim.player.name ?? 'You'),
        team: 'A', classId: setup.custom?.classId ?? sim.player.character.classId, role: setup.custom?.role,
        spawn: slot('A'),
    });
    for (const mate of setup.teammates) {
        const built = randomNpcBuild(Math.floor(random() * 4294967296), mate.classId, level, mate.role);
        npcs.push(built.player); teams.push('A');
        roster.push({ name: built.player.name ?? built.summary.identity, team: 'A', classId: mate.classId, role: mate.role, spawn: slot('A'), summary: built.summary });
    }
    while (roster.filter(r => r.team === 'B').length < size) {
        const classId = WOW_CLASS_IDS[Math.floor(random() * WOW_CLASS_IDS.length)]!;
        const built = randomNpcBuild(Math.floor(random() * 4294967296), classId, level);
        npcs.push(built.player); teams.push('B');
        roster.push({ name: built.player.name ?? built.summary.identity, team: 'B', classId, role: built.summary.role, spawn: slot('B'), summary: built.summary });
    }
    const p = sim.player;
    const match: PvpMatch = {
        mode: setup.mode, bracket: setup.bracket, mapId: tag.mapId, seed,
        enteredAt: sim.time,
        phase: 'prep', score: { A: 0, B: 0 }, roster,
        ...(setup.custom ? { savedCharacter: { character: p.character, level: p.level, name: p.name } } : {}),
        // Universal pre-match snapshot: resources, consumables and buffs return
        // on exit; the saved-character path also banks gear+pack so mid-match
        // swaps and flask use never touch the real inventory.
        savedState: {
            hp: p.hp, mana: p.mana,
            flasks: p.flasks, healCooldown: p.healCooldown,
            soulShards: p.soulShards, runes: p.runes ? [...p.runes] : undefined,
            buffs: p.buffs?.length ? cloneData(p.buffs) : undefined,
            mounted: p.mounted ?? null,
            ...(setup.custom ? {} : {
                gear: cloneData({
                    equipped: p.character.equipped, inventory: p.character.inventory,
                    inventoryLayout: p.character.inventoryLayout, bags: p.character.bags,
                }),
            }),
        },
    };
    return { match, npcs, teams };
}

/** Swaps the session character in for the match (Custom mode). The real sheet
 * is already snapshotted into match.savedCharacter before this runs. */
function applySessionCharacter(player: Player, setup: PvpSetup): void {
    if (!setup.custom) return;
    const built = buildCustomCharacter(setup.custom);
    player.character = built.player.character;
    player.level = built.player.level;
    player.name = built.player.name;
    refreshCharacter(player);
    seedResource(player); // rage/runic start empty, mana/energy full — like createCharacter
    player.skillCooldowns = {};
    player.flasks = built.player.flasks;
    player.healCooldown = 0;
    player.soulShards = built.player.soulShards;
    player.runes = built.player.runes ? [...built.player.runes] : undefined;
    player.comboPoints = 0;
    player.buffs = undefined;
    player.dots = undefined;
    player.cc = undefined;
    player.stealthed = undefined;
    player.mounted = null;
    player.allies = [];
}

/** Restores the pre-match character and player state: the Custom build's sheet
 * swap is undone, gear+pack return for the saved-character path, and resources,
 * consumables and buffs come back (buffs decayed by the match's duration, so a
 * long fight can't freeze a short buff). Leaving an arena never kills you. */
function restoreSessionCharacter(sim: Simulation, match: PvpMatch): void {
    const p = sim.player;
    if (match.savedCharacter) {
        p.character = match.savedCharacter.character;
        p.level = match.savedCharacter.level;
        p.name = match.savedCharacter.name;
    }
    const saved = match.savedState;
    if (saved?.gear) {
        p.character.equipped = cloneData(saved.gear.equipped);
        p.character.inventory = cloneData(saved.gear.inventory);
        p.character.inventoryLayout = saved.gear.inventoryLayout ? cloneData(saved.gear.inventoryLayout) : undefined;
        p.character.bags = saved.gear.bags ? cloneData(saved.gear.bags) : undefined;
    }
    // Restore buffs before refreshCharacter so their stats re-derive into the
    // sheet; decay them by the match's elapsed span.
    if (saved) {
        const elapsed = Math.max(0, sim.time - match.enteredAt);
        p.buffs = saved.buffs
            ?.map(buff => ({ ...buff, remaining: buff.remaining - elapsed }))
            .filter(buff => buff.remaining > 0);
        if (!p.buffs?.length) p.buffs = undefined;
    }
    refreshCharacter(p);
    p.dead = false;
    sim.ghost = null;
    if (saved) {
        p.hp = Math.max(1, Math.min(p.maxHp, saved.hp));
        p.mana = Math.max(0, Math.min(p.maxMana, saved.mana));
        p.flasks = saved.flasks;
        p.healCooldown = saved.healCooldown;
        p.soulShards = saved.soulShards;
        p.runes = saved.runes ? [...saved.runes] : undefined;
        p.mounted = saved.mounted ?? null;
    } else {
        seedResource(p);
    }
    p.cc = undefined;
    p.dots = undefined;
    p.stealthed = undefined;
    p.targetId = null;
    p.autoAttack = false;
}

/**
 * Enter a match: freeze the surface, create the pvp run, swap in the arena
 * world, then place every combatant on its team pad. Returns the travel result
 * plus the live roster (combatants(sim)[0] is always the real player).
 */
export async function enterPvpMatch(sim: Simulation, setup: PvpSetup, host: PvpMatchHost): Promise<DungeonResult & { combatants?: readonly Combatant[] }> {
    const surface = host.surface();
    const seed = ((surface.seed ?? 1) ^ Math.imul(Math.floor(sim.time * 120) + 1, 0x9e3779b9)) >>> 0;
    const mapId = pvpMapIdFor(setup, seed);
    if (!pvpMap(mapId)) return { ok: false, message: `${pvpBracketLabel(setup.bracket)} is not available yet.` };
    const biome = surface.sampleBiome?.(sim.player.x, sim.player.y)?.id ?? 'deadwood';
    const entrance = pvpEntrance(mapId, seed, Math.max(1, Math.round(setup.custom?.level ?? sim.player.level)), biome, { x: sim.player.x, y: sim.player.y });
    // The floor is deterministic from the entrance, so the roster's spawn pads
    // are known before the run exists — the record travels inside the checkpoint.
    const floor = generateDungeon(entrance.seed, entrance.level, entrance);
    let built: BuiltMatch;
    try {
        built = buildMatch(sim, setup, seed, floor);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'Invalid match setup.' };
    }
    const result = await planDungeonTravel(sim, { kind: 'pvp', entrance, match: built.match }, surface, host.persist);
    if (!result.ok) return result;
    host.restoreWorld(result.checkpoint);
    sim.restoreCheckpoint(result.checkpoint);
    applySessionCharacter(sim.player, setup);
    const roster = sim.enterPvp(built.npcs, built.teams);
    const match = currentPvpMatch(sim)!;
    roster.forEach((combatant, i) => {
        const spawn = match.roster[i]!.spawn;
        combatant.x = combatant.prevX = combatant.homeX = spawn.x;
        combatant.y = combatant.prevY = combatant.homeY = spawn.y;
        combatant.angle = Math.atan2(floor.pvp!.center.y - spawn.y, floor.pvp!.center.x - spawn.x);
        if (match.roster[i]!.role === 'heal') combatant.ai.role = 'healer';
        else if (match.roster[i]!.role === 'tank') combatant.ai.role = 'tank';
    });
    sim.relocate(sim.player.x, sim.player.y);
    host.arrived();
    return { ...result, combatants: roster };
}

/**
 * Leave the match: release the combatant surface, restore the real character,
 * revive, then travel back to the exact pre-match point. The pvp run is dropped
 * by compactExpeditions — instances are single-use.
 */
export async function exitPvpMatch(sim: Simulation, host: PvpMatchHost): Promise<DungeonResult> {
    const run = currentDungeon(sim.expeditions);
    if (!run?.entrance.pvp || !run.pvp) return { ok: false, message: 'No active match.' };
    run.pvp.phase = 'finished';
    sim.leavePvp();
    restoreSessionCharacter(sim, run.pvp);
    const result = await planDungeonTravel(sim, { kind: 'exit' }, host.surface(), host.persist);
    if (!result.ok) return result;
    host.restoreWorld(result.checkpoint);
    sim.restoreCheckpoint(result.checkpoint);
    sim.relocate(sim.player.x, sim.player.y);
    host.arrived();
    return result;
}
