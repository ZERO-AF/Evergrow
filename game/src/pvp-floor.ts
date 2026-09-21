/** PvP map registry + floor builder (wayfinder T02): self-contained arena and
 * battleground floors on the instanced-dungeon chassis. `generateDungeon`
 * branches here on `dungeon:pvp:` entrances, so a PvP floor is a frozen
 * DungeonFloor like any other — DungeonWorld, collision, minimap and travel
 * staging all work unchanged.
 *
 * Maps are authored layouts, not generated: rooms/corridors/props/spawn points
 * come from a registered builder. In-room line-of-sight blockers (arena
 * pillars) are `DungeonProp`s with a `solid` radius — additive obstacles on top
 * of the open room union, never subtractive rooms.
 *
 * Every PvP floor carries one dormant 'warden' member (hp zeroed at run
 * creation in createDungeonRun): dungeon plumbing keys exit portals, wave
 * gating and boss markers off `run.states.warden`, and a dead placeholder keeps
 * those derefs safe without spawning a mob. T07 may author a real captain/flag
 * carrier under the same id on battleground maps. */
import type { DungeonEntrance, DungeonFloor, DungeonMember, DungeonProp, PvpFloorTag, Room } from './dungeon.ts';
import type { PvpSetup } from './pvp-setup.ts';
import type { BiomeId } from './biomes.ts';

/** PvP entrances live under the dungeon scheme so save validation accepts them:
 * `dungeon:pvp:<mapId>:<matchSeed36>`. */
export const PVP_ENTRANCE_PREFIX = 'dungeon:pvp:';
export const isPvpEntranceId = (id: string | undefined): boolean => !!id && id.startsWith(PVP_ENTRANCE_PREFIX);
/** The registered map an entrance id points at, or undefined for non-PvP ids. */
export function pvpMapIdFromEntranceId(id: string | undefined): string | undefined {
    return isPvpEntranceId(id) ? id!.slice(PVP_ENTRANCE_PREFIX.length).split(':')[0] : undefined;
}

/** Which registered map a setup plays on. Arena brackets pick a seeded map from the
 * registered arena set; battleground brackets carry their own map id. */
export function pvpMapIdFor(setup: Pick<PvpSetup, 'mode' | 'bracket'>, seed = 0): string {
    if (setup.mode !== 'arena') return setup.bracket;
    const arenas = PVP_MAPS.filter(def => def.id.startsWith('arena-'));
    return (arenas.length ? arenas : [{ id: 'arena-ring' }])[Math.abs(seed) % (arenas.length || 1)].id;
}

export interface PvpMapLayout {
    readonly rooms: readonly Room[];
    readonly corridors: readonly Room[];
    readonly props: readonly DungeonProp[];
    readonly members?: readonly DungeonMember[];
    /** Team spawn pads; slot i of each team list takes combatant i of that team. */
    readonly spawns: PvpFloorTag['spawns'];
    /** Aim/facing anchor for combatants at match start (usually arena center). */
    readonly center: { x: number; y: number };
    readonly entry: { x: number; y: number };
    readonly exit: { x: number; y: number };
}
export interface PvpMapDef {
    readonly id: string;
    readonly name: string;
    build(seed: number, level: number): PvpMapLayout;
}

// ── Reference map: arena ring ────────────────────────────────────────────────
// One octagon room (kind 'boss' so the dungeon map's boss-room branch stays
// safe), four solid pillar props as LOS blockers, team pads on the west/east
// ends. Deliberately simple — it exists to exercise the chassis end to end.
const RING = { x: -750, y: -600, width: 1500, height: 1200 } as const;
const PILLARS: readonly (readonly [number, number])[] = [[-240, -160], [240, -160], [-240, 160], [240, 160]];
const DRESSING: readonly (readonly [number, number, DungeonProp['kind']])[] = [
    [-640, -420, 'tomb'], [640, -420, 'crystal'], [-640, 420, 'crate'], [640, 420, 'tomb'],
    [0, -500, 'crystal'], [0, 500, 'crystal'], [-640, 0, 'barrel'], [640, 0, 'barrel'],
];
function arenaRing(seed: number): PvpMapLayout {
    const pad = (x: number) => Array.from({ length: 8 }, (_, i) => ({ x, y: (i - 3.5) * 64 }));
    return {
        rooms: [{ id: 0, kind: 'boss', shape: 'octagon', ...RING }],
        corridors: [],
        props: [
            ...PILLARS.map(([x, y], i) => ({ id: `pvp:pillar:${i}`, x, y, kind: 'icePillar' as const, solid: 46, seed: (seed + i * 131) >>> 0 })),
            ...DRESSING.map(([x, y, kind], i) => ({ id: `pvp:dressing:${i}`, x, y, kind, seed: (seed + 900 + i * 37) >>> 0 })),
        ],
        spawns: { A: pad(-460), B: pad(460) },
        center: { x: 0, y: 0 },
        entry: { x: -460, y: 0 },
        exit: { x: 0, y: 0 },
    };
}
/** Registered PvP maps. Arena maps use `arena-*` ids; battlegrounds use their bracket id.
 * T06 (arenas) and T07 (battlegrounds) register real maps via registerPvpMap. */
const PVP_MAP_LIST: PvpMapDef[] = [{ id: 'arena-ring', name: 'Arena Ring', build: arenaRing }];
export const PVP_MAPS: readonly PvpMapDef[] = PVP_MAP_LIST;
/** Register an additional PvP map (called by the arena/battleground map modules). */
export function registerPvpMap(def: PvpMapDef): void {
    if (!PVP_MAP_LIST.some(existing => existing.id === def.id)) PVP_MAP_LIST.push(def);
}
export const pvpMap = (mapId: string): PvpMapDef | undefined => PVP_MAP_LIST.find(def => def.id === mapId);


/** Deterministic authored floor for a registered PvP map; mirrors raidArenaFloor. */
export function buildPvpFloor(mapId: string, seed: number, level = 1): DungeonFloor {
    const def = pvpMap(mapId);
    if (!def) throw new RangeError(`Unknown PvP map: ${mapId}`);
    const layout = def.build(seed, level);
    const members: DungeonMember[] = [...layout.members ?? []];
    if (!members.some(m => m.id === 'warden'))
        members.push({ id: 'warden', kind: 'warden', rank: 'normal', room: layout.rooms[0]?.id ?? 0, x: layout.center.x, y: layout.center.y, seed: (seed ^ 0x9e37) >>> 0 });
    const pvp: PvpFloorTag = { mapId, spawns: layout.spawns, center: layout.center };
    const floor: DungeonFloor = {
        pvp, seed, rooms: layout.rooms, edges: [], corridors: layout.corridors, members,
        entry: layout.entry, exit: layout.exit, chests: [], props: layout.props,
    };
    for (const r of layout.corridors) { r.outline?.forEach(Object.freeze); r.path?.forEach(Object.freeze); if (r.outline) Object.freeze(r.outline); if (r.path) Object.freeze(r.path); }
    for (const v of [...layout.rooms, ...layout.corridors, ...members, ...floor.edges, ...floor.chests, ...layout.props]) Object.freeze(v);
    for (const side of [pvp.spawns.A, pvp.spawns.B]) { side.forEach(Object.freeze); Object.freeze(side); }
    Object.freeze(pvp.spawns); Object.freeze(pvp.center); Object.freeze(pvp);
    Object.freeze(layout.rooms); Object.freeze(layout.corridors); Object.freeze(members);
    Object.freeze(floor.edges); Object.freeze(floor.chests); Object.freeze(floor.entry); Object.freeze(floor.exit); Object.freeze(layout.props);
    return Object.freeze(floor);
}

/** The entrance handed to planDungeonTravel's 'pvp' action. `at` is the exact
 * surface point the player returns to — the chassis stores it verbatim and the
 * exit landing uses it unchanged. */
export function pvpEntrance(mapId: string, seed: number, level: number, biome: BiomeId, at: { x: number; y: number }): DungeonEntrance {
    const def = pvpMap(mapId);
    if (!def) throw new RangeError(`Unknown PvP map: ${mapId}`);
    return {
        id: `${PVP_ENTRANCE_PREFIX}${mapId}:${seed.toString(36)}`,
        name: def.name, seed, level, biome, x: at.x, y: at.y,
        pvp: { mapId },
    };
}
