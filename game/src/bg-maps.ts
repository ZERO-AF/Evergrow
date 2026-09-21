/** Battleground floor builders (wayfinder T07): Warsong Gulch and Arathi Basin
 * as authored PvpMapLayouts on the instanced-dungeon chassis. Both maps are
 * axis-symmetric so neither team has a terrain edge; objective props carry
 * well-known ids (`pvp:flag:<team>` / `pvp:node:<name>`) that the controllers
 * in pvp-objectives.ts resolve against the live floor.
 *
 * Rooms are rectangles whose shared edges tile into one walkable union —
 * corridors are unnecessary when rooms already overlap. Solid props are the
 * only line-of-sight blockers; flag stands and node banners are non-solid so
 * combatants can stand on the objective itself. */
import { registerPvpMap, type PvpMapLayout } from './pvp-floor.ts';
import type { DungeonProp, Room } from './dungeon.ts';
import type { PvpTeam } from './pvp-combatant.ts';

/** Prop ids the objective controllers look up on the live floor. */
export const BG_FLAG_PROP_IDS: Record<PvpTeam, string> = { A: 'pvp:flag:A', B: 'pvp:flag:B' };
export const BG_NODE_PROP_PREFIX = 'pvp:node:';
/** Arathi Basin node order: prop id suffix → display name. */
export const BG_NODE_NAMES: readonly (readonly [string, string])[] = [
    ['stables', 'Stables'], ['lumbermill', 'Lumber Mill'], ['blacksmith', 'Blacksmith'],
    ['goldmine', 'Gold Mine'], ['farm', 'Farm'],
];

const prop = (id: string, x: number, y: number, kind: DungeonProp['kind'], seed: number, solid?: number): DungeonProp =>
    ({ id, x, y, kind, seed, ...(solid !== undefined ? { solid } : {}) });
/** Team spawn pads: a column of eight slots inside the team's base. */
const pads = (x: number, y = 0): readonly { x: number; y: number }[] =>
    Array.from({ length: 8 }, (_, i) => ({ x, y: y + (i - 3.5) * 64 }));

// ── Warsong Gulch ────────────────────────────────────────────────────────────
// Two flag rooms behind two base rooms, joined by a wide midfield. Flag stands
// sit at each base's center; pillars in the midfield are the only LOS blockers.
const WSG_ROOMS: readonly Room[] = [
    { id: 0, kind: 'boss', x: -2080, y: -140, width: 240, height: 280 },   // A flag room
    { id: 1, kind: 'combat', x: -1840, y: -340, width: 640, height: 680 }, // A base
    { id: 2, kind: 'combat', x: -1200, y: -420, width: 2400, height: 840 },// midfield
    { id: 3, kind: 'combat', x: 1200, y: -340, width: 640, height: 680 },  // B base
    { id: 4, kind: 'boss', x: 1840, y: -140, width: 240, height: 280 },    // B flag room
];
const WSG_PILLARS: readonly (readonly [number, number])[] = [[-360, -200], [360, -200], [-360, 200], [360, 200]];
const WSG_DRESSING: readonly (readonly [number, number, DungeonProp['kind']])[] = [
    [-1560, -280, 'crate'], [-1560, 280, 'barrel'], [1560, -280, 'crate'], [1560, 280, 'barrel'],
    [-700, -380, 'tomb'], [700, -380, 'tomb'], [-700, 380, 'tomb'], [700, 380, 'tomb'],
    [0, -380, 'crystal'], [0, 380, 'crystal'],
];
function warsongGulch(seed: number): PvpMapLayout {
    return {
        rooms: WSG_ROOMS,
        corridors: [],
        props: [
            prop(BG_FLAG_PROP_IDS.A, -1960, 0, 'crystal', seed + 11),
            prop(BG_FLAG_PROP_IDS.B, 1960, 0, 'crystal', seed + 12),
            ...WSG_PILLARS.map(([x, y], i) => prop(`pvp:pillar:${i}`, x, y, 'icePillar', seed + 100 + i * 37, 46)),
            ...WSG_DRESSING.map(([x, y, kind], i) => prop(`pvp:dressing:${i}`, x, y, kind, seed + 300 + i * 53)),
        ],
        spawns: { A: pads(-1720), B: pads(1720) },
        center: { x: 0, y: 0 },
        entry: { x: -1720, y: 300 },
        exit: { x: -1720, y: -300 },
    };
}

// ── Arathi Basin ─────────────────────────────────────────────────────────────
// One broad basin: each team's base holds its home node (Stables/Farm), the
// Blacksmith sits at the center, and Lumber Mill / Gold Mine flank north/south.
const AB_ROOMS: readonly Room[] = [
    { id: 0, kind: 'boss', x: -2100, y: -300, width: 800, height: 600 },   // A base (Stables)
    { id: 1, kind: 'combat', x: -1300, y: -800, width: 2600, height: 1600 },// basin
    { id: 2, kind: 'boss', x: 1300, y: -300, width: 800, height: 600 },    // B base (Farm)
];
const AB_NODES: readonly (readonly [string, number, number, DungeonProp['kind']])[] = [
    ['stables', -1700, 0, 'crate'],
    ['lumbermill', -500, -560, 'roots'],
    ['blacksmith', 0, 0, 'anvil'],
    ['goldmine', 500, 560, 'crystal'],
    ['farm', 1700, 0, 'barrel'],
];
const AB_PILLARS: readonly (readonly [number, number])[] = [[-800, -300], [-800, 300], [800, -300], [800, 300], [0, -620], [0, 620]];
const AB_DRESSING: readonly (readonly [number, number, DungeonProp['kind']])[] = [
    [-1700, -220, 'barrel'], [-1700, 220, 'crate'], [1700, -220, 'crate'], [1700, 220, 'barrel'],
    [-500, -460, 'tomb'], [500, 460, 'tomb'], [-120, -120, 'furnace'], [120, 120, 'furnace'],
    [-1100, 0, 'roots'], [1100, 0, 'roots'], [0, -320, 'tomb'], [0, 320, 'tomb'],
];
function arathiBasin(seed: number): PvpMapLayout {
    return {
        rooms: AB_ROOMS,
        corridors: [],
        props: [
            ...AB_NODES.map(([id, x, y, kind], i) => prop(`${BG_NODE_PROP_PREFIX}${id}`, x, y, kind, seed + 40 + i * 17)),
            ...AB_PILLARS.map(([x, y], i) => prop(`pvp:pillar:${i}`, x, y, 'icePillar', seed + 500 + i * 37, 46)),
            ...AB_DRESSING.map(([x, y, kind], i) => prop(`pvp:dressing:${i}`, x, y, kind, seed + 700 + i * 53)),
        ],
        spawns: { A: pads(-1960), B: pads(1960) },
        center: { x: 0, y: 0 },
        entry: { x: -1960, y: 260 },
        exit: { x: -1960, y: -260 },
    };
}

// Registration is a module side effect: importing this module (pvp-objectives.ts
// does) makes both battlegrounds resolvable for `pvpMapIdFor`/`buildPvpFloor`.
registerPvpMap({ id: 'warsong', name: 'Warsong Gulch', build: warsongGulch });
registerPvpMap({ id: 'arathi', name: 'Arathi Basin', build: arathiBasin });
