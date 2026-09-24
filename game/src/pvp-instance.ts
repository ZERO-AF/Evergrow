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
import { PLAYER_ABILITIES } from './combat-content.ts';
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
import { pvpEnabled } from './pvp-currency.ts';

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
    /** Sim time the match was entered; saved buffs/cooldowns decay by the elapsed span. */
    enteredAt: number;
    phase: PvpMatchPhase;
    score: { A: number; B: number };
    roster: PvpRosterEntry[];
    savedCharacter?: { character: CharacterSheet; level: number; name?: string };
    /** Pre-match player state, snapshotted for every entry mode. Anything the
     * match can mutate must ride this record — a field left out leaks arena
     * state into the overworld (or loses pre-match state) on exit. */
    savedState?: {
        hp: number; mana: number;
        flasks: number; healCooldown: number;
        soulShards?: number; runes?: number[];
        buffs?: WowBuff[];
        mounted?: Player['mounted'];
        /** Remaining skill cooldowns (seconds), decayed by match duration on exit. */
        skillCooldowns?: Player['skillCooldowns'];
        comboPoints?: number;
        /** Pets/minions/totems live at entry; arena summons never leave the match. */
        allies?: Player['allies'];
        stealthed?: boolean;
        autoAttack?: boolean;
        dodgeCharges?: number; dodgeRecharge?: number;
        invulnerable?: number; guardTime?: number; guardReduction?: number;
        gcdReady?: number;
        /** Timed proc/stance state (spellweave charges, wards, echoes). */
        affixBuffs?: Player['affixBuffs'];
        skillEffects?: Player['skillEffects'];
        /** PvE kill-streak chain; arena kills must not extend it. */
        killStreak?: Player['killStreak'];
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
    /** Headline score label for HUD/scoreboard chrome ('Flags', 'Resources');
     * the arena default reports 'Alive'. */
    readonly scoreLabel?: string;
    /** Objective markers for the match minimap (flag stands, carried flags,
     * nodes). Recomputed per call; undefined on controllers without a map. */
    markers?(): readonly PvpObjectiveMarker[];
}
/** One objective marker for the match minimap. `owner` is the controlling side
 * (null while neutral or dropped); `contested` marks a hot point — a dropped
 * flag or a node under assault. */
export interface PvpObjectiveMarker {
    readonly kind: 'flag' | 'node';
    readonly id: string;
    readonly label: string;
    readonly x: number;
    readonly y: number;
    readonly owner: PvpTeam | null;
    /** Flag state ('home' | 'carried' | 'dropped'); undefined on nodes. */
    readonly state?: string;
    /** Capture progress 0..1 toward `progressTeam` (nodes only). */
    readonly progress?: number;
    readonly progressTeam?: PvpTeam | null;
    readonly contested?: boolean;
}
/** One objective beat, emitted by battleground controllers. `team` is the
 * acting team; `flagTeam`/`owner` name the flag's/node's owning side. */
export interface PvpObjectiveEvent {
    readonly kind: 'flag-pickup' | 'flag-drop' | 'flag-return' | 'flag-capture' | 'flag-assault' | 'node-assault' | 'node-capture';
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
        // Universal pre-match snapshot: resources, consumables, buffs and every
        // transient combat field the match can touch return on exit; the
        // saved-character path also banks gear+pack so mid-match swaps and
        // flask use never touch the real inventory.
        savedState: {
            hp: p.hp, mana: p.mana,
            flasks: p.flasks, healCooldown: p.healCooldown,
            soulShards: p.soulShards, runes: p.runes ? [...p.runes] : undefined,
            buffs: p.buffs?.length ? cloneData(p.buffs) : undefined,
            mounted: p.mounted ?? null,
            skillCooldowns: cloneData(p.skillCooldowns ?? {}),
            comboPoints: p.comboPoints ?? 0,
            allies: p.allies?.length ? cloneData(p.allies) : undefined,
            stealthed: p.stealthed ?? false,
            autoAttack: p.autoAttack ?? false,
            dodgeCharges: p.dodgeCharges, dodgeRecharge: p.dodgeRecharge,
            invulnerable: p.invulnerable, guardTime: p.guardTime, guardReduction: p.guardReduction,
            gcdReady: p.gcdReady ?? 0,
            affixBuffs: p.affixBuffs ? cloneData(p.affixBuffs) : undefined,
            skillEffects: p.skillEffects ? cloneData(p.skillEffects) : undefined,
            killStreak: p.killStreak ? cloneData(p.killStreak) : undefined,
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
    player.flasks = built.player.flasks;
    player.soulShards = built.player.soulShards;
    player.runes = built.player.runes ? [...built.player.runes] : undefined;
}

/** WoW arena entry: everyone steps through the gates fresh — topped off,
 * cooldowns reset, no lingering combat state. The pre-match values are already
 * banked in match.savedState; exit restores them (buffs/cooldowns decayed by
 * the match's duration). */
function prepareMatchEntry(player: Player): void {
    seedResource(player); // full hp; rage/runic empty, mana/energy full — like createCharacter
    player.skillCooldowns = {};
    player.healCooldown = 0;
    player.comboPoints = 0;
    player.buffs = undefined;
    player.dots = undefined;
    player.cc = undefined;
    player.stealthed = undefined;
    player.mounted = null;
    player.allies = [];
    player.attack = null;
    player.dash = null;
    player.cast = null;
    player.castTime = 0;
    player.dodgeTime = 0;
    player.dodgeCharges = PLAYER_ABILITIES.dodge.charges;
    player.dodgeRecharge = 0;
    player.guardTime = 0;
    player.invulnerable = 0;
    player.gcdReady = 0;
    player.targetId = null;
    player.autoAttack = false;
    player.hitFlash = 0;
    player.healFlash = 0;
    player.affixBuffs = undefined;
    player.skillEffects = undefined;
    player.killStreak = undefined;
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
        const elapsed = Math.max(0, sim.time - match.enteredAt);
        p.hp = Math.max(1, Math.min(p.maxHp, saved.hp));
        p.mana = Math.max(0, Math.min(p.maxMana, saved.mana));
        p.flasks = saved.flasks;
        p.healCooldown = Math.max(0, saved.healCooldown - elapsed);
        p.soulShards = saved.soulShards;
        p.runes = saved.runes ? [...saved.runes] : undefined;
        p.mounted = saved.mounted ?? null;
        // Cooldowns kept ticking while the match ran — same decay rule as buffs.
        p.skillCooldowns = Object.fromEntries(Object.entries(saved.skillCooldowns ?? {})
            .map(([id, left]) => [id, (left ?? 0) - elapsed] as const).filter(([, left]) => (left ?? 0) > 0)) as Player['skillCooldowns'];
        p.comboPoints = saved.comboPoints ?? 0;
        // Ally timers (despawn, regen, guard, speed, stealth) decayed by elapsed too.
        const decay = (n: number | undefined) => n == null ? undefined : Math.max(0, n - elapsed);
        p.allies = saved.allies ? cloneData(saved.allies).map(ally => ({
            ...ally, targetId: null,
            remaining: decay(ally.remaining),
            regen: ally.regen ? { ...ally.regen, remaining: decay(ally.regen.remaining)! } : undefined,
            guard: ally.guard ? { ...ally.guard, remaining: decay(ally.guard.remaining)! } : undefined,
            speedBoost: ally.speedBoost ? { ...ally.speedBoost, remaining: decay(ally.speedBoost.remaining)! } : undefined,
            stealth: ally.stealth ? { ...ally.stealth, remaining: decay(ally.stealth.remaining)! } : undefined,
        })).filter(ally => ally.remaining == null || ally.remaining > 0) : [];
        p.stealthed = saved.stealthed || undefined;
        p.autoAttack = saved.autoAttack ?? false;
        p.dodgeCharges = saved.dodgeCharges ?? PLAYER_ABILITIES.dodge.charges;
        p.dodgeRecharge = Math.max(0, (saved.dodgeRecharge ?? 0) - elapsed);
        p.invulnerable = Math.max(0, (saved.invulnerable ?? 0) - elapsed);
        p.guardTime = Math.max(0, (saved.guardTime ?? 0) - elapsed);
        p.guardReduction = saved.guardReduction ?? 0;
        p.gcdReady = Math.max(0, (saved.gcdReady ?? 0) - elapsed);
        p.affixBuffs = saved.affixBuffs ? cloneData(saved.affixBuffs) : undefined;
        p.skillEffects = saved.skillEffects ? cloneData(saved.skillEffects) : undefined;
        p.killStreak = saved.killStreak ? cloneData(saved.killStreak) : undefined;
    } else {
        seedResource(p);
    }
    // Match-only state never survives the exit: CC, dots, casts, swings and
    // channels die with the instance.
    p.cc = undefined;
    p.dots = undefined;
    p.attack = null;
    p.dash = null;
    p.cast = null;
    p.castTime = 0;
    p.dodgeTime = 0;
    p.hitFlash = 0;
    p.healFlash = 0;
    p.targetId = null;
    if (!saved) { p.stealthed = undefined; p.autoAttack = false; }
}

/**
 * Enter a match: freeze the surface, create the pvp run, swap in the arena
 * world, then place every combatant on its team pad. Returns the travel result
 * plus the live roster (combatants(sim)[0] is always the real player).
 */
export async function enterPvpMatch(sim: Simulation, setup: PvpSetup, host: PvpMatchHost): Promise<DungeonResult & { combatants?: readonly Combatant[] }> {
    if (!pvpEnabled()) return { ok: false, message: 'PvP is not available.' };
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
        // Pre-validate the custom build here — applySessionCharacter re-runs the
        // same deterministic buildCustomCharacter after the world swap, where a
        // throw would strand the player on the arena floor.
        if (setup.custom) buildCustomCharacter(setup.custom);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'Invalid match setup.' };
    }
    const result = await planDungeonTravel(sim, { kind: 'pvp', entrance, match: built.match }, surface, host.persist);
    if (!result.ok) return result;
    host.restoreWorld(result.checkpoint);
    sim.restoreCheckpoint(result.checkpoint);
    applySessionCharacter(sim.player, setup);
    prepareMatchEntry(sim.player);
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
