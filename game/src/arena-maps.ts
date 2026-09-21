/** WotLK arena floors (wayfinder T06): five authored layouts registered on the
 * pvp-floor chassis. Each map is a polygonal room union (rooms + swept
 * corridors) with `solid` DungeonProps as pillar/LOS blockers — the same
 * additive-obstacle model as the reference 'arena-ring'.
 *
 * Faithful within the engine: floors are flat, so elevation (Blade's Edge
 * bridge, Sewer ledges, Lordaeron crypt mound) reads as overlapping side rooms
 * and prop clusters rather than real height. Spawn pads line the two gate
 * walls; `center` is the aim anchor combatants face at the gates. */
import { registerPvpMap, type PvpMapLayout } from './pvp-floor.ts';
import type { DungeonProp, Room } from './dungeon.ts';

/** Spawn pads along a vertical gate line; slot i takes combatant i. */
const gatePads = (x: number, count = 6): { x: number; y: number }[] =>
  Array.from({ length: count }, (_, i) => ({ x, y: (i - (count - 1) / 2) * 64 }));

const pillar = (id: string, x: number, y: number, seed: number, kind: DungeonProp['kind'] = 'icePillar', solid = 46): DungeonProp =>
  ({ id, x, y, kind, solid, seed: seed >>> 0 });
const dressing = (id: string, x: number, y: number, kind: DungeonProp['kind'], seed: number): DungeonProp =>
  ({ id, x, y, kind, seed: seed >>> 0 });

// ── Nagrand Arena ────────────────────────────────────────────────────────────
// Open field, four pillars in a square around the central platform.
const NAGRAND = { x: -800, y: -640, width: 1600, height: 1280 } as const;
function nagrandArena(seed: number): PvpMapLayout {
  const rooms: Room[] = [{ id: 0, kind: 'boss', shape: 'hall', ...NAGRAND }];
  const props: DungeonProp[] = [
    pillar('pvp:pillar:0', -260, -260, seed + 11),
    pillar('pvp:pillar:1', 260, -260, seed + 12),
    pillar('pvp:pillar:2', -260, 260, seed + 13),
    pillar('pvp:pillar:3', 260, 260, seed + 14),
    // Central platform edge + wall dressing.
    dressing('pvp:platform:n', 0, -120, 'crystal', seed + 21),
    dressing('pvp:platform:s', 0, 120, 'crystal', seed + 22),
    dressing('pvp:dress:0', -700, -480, 'tomb', seed + 31),
    dressing('pvp:dress:1', 700, -480, 'tomb', seed + 32),
    dressing('pvp:dress:2', -700, 480, 'crate', seed + 33),
    dressing('pvp:dress:3', 700, 480, 'crate', seed + 34),
    dressing('pvp:dress:4', 0, -560, 'barrel', seed + 35),
    dressing('pvp:dress:5', 0, 560, 'barrel', seed + 36),
  ];
  return {
    rooms, corridors: [], props,
    spawns: { A: gatePads(-700), B: gatePads(700) },
    center: { x: 0, y: 0 }, entry: { x: -700, y: 0 }, exit: { x: 0, y: 0 },
  };
}

// ── Blade's Edge Arena ───────────────────────────────────────────────────────
// The bridge deck reads as a raised central band: two side ledge rooms overlap
// the main hall's north/south edges (the ramps), and bridge-support pillars
// break line of sight across the low ground.
const BLADES_LOW = { x: -760, y: -480, width: 1520, height: 960 } as const;
const BLADES_N_LEDGE = { x: -460, y: -640, width: 920, height: 220 } as const;
const BLADES_S_LEDGE = { x: -460, y: 420, width: 920, height: 220 } as const;
function bladesEdgeArena(seed: number): PvpMapLayout {
  const rooms: Room[] = [
    { id: 0, kind: 'boss', shape: 'hall', ...BLADES_LOW },
    { id: 1, kind: 'combat', shape: 'hall', ...BLADES_N_LEDGE },
    { id: 2, kind: 'combat', shape: 'hall', ...BLADES_S_LEDGE },
  ];
  const props: DungeonProp[] = [
    // Bridge supports — the LOS blockers on the low ground.
    pillar('pvp:pillar:0', -300, -200, seed + 11),
    pillar('pvp:pillar:1', 300, -200, seed + 12),
    pillar('pvp:pillar:2', -300, 200, seed + 13),
    pillar('pvp:pillar:3', 300, 200, seed + 14),
    // Rope-post dressing along the deck edges.
    dressing('pvp:rail:0', -300, -400, 'roots', seed + 21),
    dressing('pvp:rail:1', 300, -400, 'roots', seed + 22),
    dressing('pvp:rail:2', -300, 400, 'roots', seed + 23),
    dressing('pvp:rail:3', 300, 400, 'roots', seed + 24),
    dressing('pvp:dress:0', -660, -380, 'crate', seed + 31),
    dressing('pvp:dress:1', 660, -380, 'barrel', seed + 32),
    dressing('pvp:dress:2', -660, 380, 'barrel', seed + 33),
    dressing('pvp:dress:3', 660, 380, 'crate', seed + 34),
  ];
  return {
    rooms, corridors: [], props,
    spawns: { A: gatePads(-660), B: gatePads(660) },
    center: { x: 0, y: 0 }, entry: { x: -660, y: 0 }, exit: { x: 0, y: 0 },
  };
}

// ── Dalaran Sewers ───────────────────────────────────────────────────────────
// Tight rectangle with the central outflow pipe; raised ledges overlap the
// north/south walls and pool props mark the water channel down the middle.
const SEWERS = { x: -560, y: -420, width: 1120, height: 840 } as const;
const SEWER_N_LEDGE = { x: -420, y: -560, width: 840, height: 200 } as const;
const SEWER_S_LEDGE = { x: -420, y: 360, width: 840, height: 200 } as const;
function dalaranSewers(seed: number): PvpMapLayout {
  const rooms: Room[] = [
    { id: 0, kind: 'boss', shape: 'hall', ...SEWERS },
    { id: 1, kind: 'combat', shape: 'hall', ...SEWER_N_LEDGE },
    { id: 2, kind: 'combat', shape: 'hall', ...SEWER_S_LEDGE },
  ];
  const props: DungeonProp[] = [
    // The central outflow pipe — the arena's signature LOS blocker.
    pillar('pvp:pipe', 0, 0, seed + 11, 'furnace', 64),
    // The water channel down the middle.
    dressing('pvp:pool:n', 0, -300, 'pool', seed + 21),
    dressing('pvp:pool:s', 0, 300, 'pool', seed + 22),
    dressing('pvp:dress:0', -480, -340, 'crate', seed + 31),
    dressing('pvp:dress:1', 480, -340, 'barrel', seed + 32),
    dressing('pvp:dress:2', -480, 340, 'barrel', seed + 33),
    dressing('pvp:dress:3', 480, 340, 'crate', seed + 34),
    dressing('pvp:dress:4', -360, -480, 'crystal', seed + 35),
    dressing('pvp:dress:5', 360, 480, 'crystal', seed + 36),
  ];
  return {
    rooms, corridors: [], props,
    spawns: { A: gatePads(-480), B: gatePads(480) },
    center: { x: 0, y: -200 }, entry: { x: -480, y: 0 }, exit: { x: 0, y: -360 },
  };
}

// ── Ruins of Lordaeron ───────────────────────────────────────────────────────
// Open courtyard with the central crypt mound (a solid sarcophagus cluster)
// and side alcoves overlapping the east/west walls.
const RUINS = { x: -780, y: -600, width: 1560, height: 1200 } as const;
const RUINS_W_ALCOVE = { x: -1020, y: -180, width: 300, height: 360 } as const;
const RUINS_E_ALCOVE = { x: 720, y: -180, width: 300, height: 360 } as const;
function ruinsOfLordaeron(seed: number): PvpMapLayout {
  const rooms: Room[] = [
    { id: 0, kind: 'boss', shape: 'hall', ...RUINS },
    { id: 1, kind: 'combat', shape: 'hall', ...RUINS_W_ALCOVE },
    { id: 2, kind: 'combat', shape: 'hall', ...RUINS_E_ALCOVE },
  ];
  const props: DungeonProp[] = [
    // The crypt mound: a tight sarcophagus cluster at center.
    pillar('pvp:crypt:0', -52, 0, seed + 11, 'sarcophagus', 56),
    pillar('pvp:crypt:1', 52, 0, seed + 12, 'sarcophagus', 56),
    pillar('pvp:crypt:2', 0, -60, seed + 13, 'tomb', 48),
    pillar('pvp:crypt:3', 0, 60, seed + 14, 'tomb', 48),
    // Courtyard tombs along the walls.
    dressing('pvp:dress:0', -640, -480, 'tomb', seed + 31),
    dressing('pvp:dress:1', 640, -480, 'tomb', seed + 32),
    dressing('pvp:dress:2', -640, 480, 'sarcophagus', seed + 33),
    dressing('pvp:dress:3', 640, 480, 'sarcophagus', seed + 34),
    dressing('pvp:dress:4', -360, -520, 'roots', seed + 35),
    dressing('pvp:dress:5', 360, 520, 'roots', seed + 36),
    dressing('pvp:dress:6', -900, 0, 'crystal', seed + 37),
    dressing('pvp:dress:7', 900, 0, 'crystal', seed + 38),
  ];
  return {
    rooms, corridors: [], props,
    spawns: { A: gatePads(-680), B: gatePads(680) },
    center: { x: 0, y: 240 }, entry: { x: -680, y: 0 }, exit: { x: 0, y: 240 },
  };
}

// ── Ring of Trials / Ring of Valor ───────────────────────────────────────────
// Circular pit (octagon room), four pillars on the diagonals. Registered under
// both ids — the ticket names the map both ways; the builder is shared.
const RING_PIT = { x: -640, y: -640, width: 1280, height: 1280 } as const;
function ringOfTrials(seed: number): PvpMapLayout {
  const rooms: Room[] = [{ id: 0, kind: 'boss', shape: 'octagon', ...RING_PIT }];
  const props: DungeonProp[] = [
    pillar('pvp:pillar:0', -300, -300, seed + 11),
    pillar('pvp:pillar:1', 300, -300, seed + 12),
    pillar('pvp:pillar:2', -300, 300, seed + 13),
    pillar('pvp:pillar:3', 300, 300, seed + 14),
    dressing('pvp:dress:0', 0, -540, 'anvil', seed + 31),
    dressing('pvp:dress:1', 0, 540, 'anvil', seed + 32),
    dressing('pvp:dress:2', -540, 0, 'furnace', seed + 33),
    dressing('pvp:dress:3', 540, 0, 'furnace', seed + 34),
    dressing('pvp:dress:4', -480, -480, 'barrel', seed + 35),
    dressing('pvp:dress:5', 480, 480, 'barrel', seed + 36),
  ];
  return {
    rooms, corridors: [], props,
    spawns: { A: gatePads(-540), B: gatePads(540) },
    center: { x: 0, y: 0 }, entry: { x: -540, y: 0 }, exit: { x: 0, y: 0 },
  };
}

// Registration runs at module load; pvpMapIdFor seeded-picks among `arena-*`.
registerPvpMap({ id: 'arena-nagrand', name: 'Nagrand Arena', build: nagrandArena });
registerPvpMap({ id: 'arena-blades-edge', name: "Blade's Edge Arena", build: bladesEdgeArena });
registerPvpMap({ id: 'arena-dalaran-sewers', name: 'Dalaran Sewers', build: dalaranSewers });
registerPvpMap({ id: 'arena-ruins-lordaeron', name: 'Ruins of Lordaeron', build: ruinsOfLordaeron });
registerPvpMap({ id: 'arena-ring-of-trials', name: 'Ring of Trials', build: ringOfTrials });
registerPvpMap({ id: 'arena-ring-of-valor', name: 'Ring of Valor', build: ringOfTrials });
