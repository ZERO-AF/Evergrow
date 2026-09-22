import type { DungeonEntrance, DungeonFloor, DungeonMember, DungeonProp, Room } from './dungeon.ts';
import { dungeonPassage } from './dungeon-passage.ts';
import type { WorldLandscape } from './world-landscape.ts';
import { getZoneAt } from './zone-progression.ts';
import { siteHash } from './wilderness-sites.ts';
import { GAME_FEATURES } from './game-features.ts';
import { raidEntrances } from './raid-boss-content.ts';
import type { Enemy } from './model.ts';

/**
 * Second raid boss (docs/wow-deepening.md §15, second wave): Ragnaros the
 * Firelord — the real vanilla/WotLK Molten Core finale — inside the Molten
 * Core, a dedicated single-arena lava basin.
 *
 * The arena reuses the frozen dungeon plumbing end to end: DungeonRun state,
 * wave-gated member admission (`wave` bits on run.states.warden.bossPhases,
 * auto-set by updateDungeon at 65% / 30% for wilderness-boss kinds), boss
 * chest (index 2), exit portal, journey completion and save validation. The
 * integrator routes `generateDungeon` to `raid2ArenaFloor` for Molten Core
 * entrances; every downstream consumer then works unchanged.
 */

export const RAID2_ENTRANCE_ID = 'dungeon:raid:molten-core';
export const RAID2_BOSS_NAME = 'Ragnaros';
export const RAID2_BOSS_MEMBER_ID = 'warden'; // wave gating + boss chest key off this id
export const RAID2_BOSS_KIND: Enemy['kind'] = 'ashColossus';

export const isRaid2EntranceId = (id: string | undefined): boolean => id === RAID2_ENTRANCE_ID;
export const isRaid2Entrance = (e: Pick<DungeonEntrance, 'id'> | undefined | null): boolean => !!e && isRaid2EntranceId(e.id);
/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of a Molten Core run. */
export const isRaid2Boss = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  e.campMemberId === RAID2_BOSS_MEMBER_ID && isRaid2EntranceId(e.campId);
export const raid2BossName = (e: Pick<Enemy, 'campId' | 'campMemberId'>): string | undefined =>
  isRaid2Boss(e) ? RAID2_BOSS_NAME : undefined;

/** Fight rules. Phase bits match updateDungeon's warden auto-bits (65% / 30%). */
export const RAGNAROS_RULES = Object.freeze({
  /** Boss chest loot table (raid-loot-content.ts): Tier-2 legs + weapons. */
  lootTable: 'ragnaros' as const,
  phaseTwo: .65, phaseThree: .3,
  leash: 1600, awareness: 700,
  smashReach: 200, smashArc: Math.PI * 1.1,           // Sulfuras Smash (frontal melee arc)
  splashLength: 520, splashWidth: 34,                // Lava Splash (3 staggered radial lanes)
  splashOffsets: [-0.55, 0, 0.55] as readonly number[],
  blastRadius: 130,                                  // Eruption (ranged magma blast at the target)
  waveLength: 700, waveWidth: 52,                    // Lava Wave (projected radial wave lane)
  novaRadius: 470,                                   // Lava Wave nova / Emerge knockback burst
  submergeSeconds: 14,                               // Sons of Flame intermission
  scorchRadius: 100, scorchDuration: 24, scorchInterval: .5, scorchDps: .22, // Molten ground (fraction of boss damage per tick)
  scorchMax: 10,
  enrageAfter: 420,                                  // Firelord's Fury timer (seconds from engage)
  enrageDamage: 2.2, enragePulse: 1.5, enrageRadius: 620,
  allyDamageEase: .1, allyDamageEaseMax: .3,         // solo+allies scaling: -10% per ally, cap -30%
});

/**
 * Real Ragnaros spell names for DBM-style warnings; falls back to undefined
 * for non-raid enemies. `attackVariant === 2` marks the emerge burst so the
 * radial 'command' telegraph can be named Emerge instead of Lava Wave.
 */
export function raid2BossWarningSpec(e: Pick<Enemy, 'campId' | 'campMemberId' | 'bossMove' | 'bossPhases' | 'attackVariant'>):
  { ability: string; advice: string } | undefined {
  if (!isRaid2Boss(e) || !e.bossMove) return undefined;
  switch (e.bossMove) {
    case 'sweep': return { ability: 'Sulfuras Smash', advice: 'move!' };
    case 'fracture': return { ability: 'Lava Splash', advice: 'sidestep!' };
    case 'eruption': return { ability: 'Eruption', advice: 'move!' };
    case 'rush': return { ability: 'Lava Wave', advice: 'out of the lane!' };
    case 'command': return e.attackVariant === 2
      ? { ability: 'Emerge', advice: 'away from the lava!' }
      : { ability: 'Lava Wave', advice: 'spread out!' };
    case 'summon': return (e.bossPhases ?? 0) & 2
      ? { ability: 'Submerge', advice: 'Sons of Flame!' }
      : { ability: 'Submerge', advice: 'adds!' };
    case 'jab': return { ability: 'Wrath of Ragnaros', advice: 'move!' };
    case 'bolt': return { ability: 'Magma Blast', advice: 'sidestep!' };
  }
}

// ── Arena floor ──────────────────────────────────────────────────────────
// Room ids: 0 = entry antechamber, 1 = the lava basin arena. One corridor links them.
const ARENA = { x: -1500, y: -1650, width: 3000, height: 2200 } as const;
const ENTRY = { x: -288, y: 1244, width: 576, height: 512 } as const;
const BOSS_AT = { x: 0, y: -1050 } as const; // Ragnaros's lava pool, north-center
export const RAID2_ARENA_CENTER = Object.freeze({ x: ARENA.x + ARENA.width / 2, y: ARENA.y + ARENA.height / 2 });

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaid2Entrance. */
export function raid2ArenaFloor(seed: number, _level = 1): DungeonFloor {
  const rooms: Room[] = [
    { id: 0, kind: 'entry', shape: 'hall', ...ENTRY },
    { id: 1, kind: 'boss', shape: 'octagon', ...ARENA },
  ];
  const corridors: Room[] = [dungeonPassage([{ x: 0, y: 1500 }, { x: 0, y: 420 }], 150, 0)];
  const members: DungeonMember[] = [
    // Ragnaros himself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID2_BOSS_MEMBER_ID, kind: RAID2_BOSS_KIND, rank: 'elite', room: 1, x: BOSS_AT.x, y: BOSS_AT.y, seed: (seed ^ 0x0a65) >>> 0 },
    // Sons of Flame — wave bit 1 (65%), rising from the lava around the arena rim.
    { id: 'son:w:0', kind: 'emberAcolyte', rank: 'normal', room: 1, x: -1400, y: -1250, seed: (seed ^ 0x21) >>> 0, wave: 1 },
    { id: 'son:w:1', kind: 'emberAcolyte', rank: 'normal', room: 1, x: -1400, y: -550, seed: (seed ^ 0x22) >>> 0, wave: 1 },
    { id: 'son:w:2', kind: 'emberAcolyte', rank: 'normal', room: 1, x: -1400, y: 150, seed: (seed ^ 0x23) >>> 0, wave: 1 },
    { id: 'son:e:0', kind: 'emberAcolyte', rank: 'normal', room: 1, x: 1400, y: -1250, seed: (seed ^ 0x24) >>> 0, wave: 1 },
    { id: 'son:e:1', kind: 'emberAcolyte', rank: 'normal', room: 1, x: 1400, y: -550, seed: (seed ^ 0x25) >>> 0, wave: 1 },
    { id: 'son:e:2', kind: 'emberAcolyte', rank: 'normal', room: 1, x: 1400, y: 150, seed: (seed ^ 0x26) >>> 0, wave: 1 },
    { id: 'son:n:0', kind: 'emberAcolyte', rank: 'normal', room: 1, x: -700, y: -1550, seed: (seed ^ 0x27) >>> 0, wave: 1 },
    { id: 'son:n:1', kind: 'emberAcolyte', rank: 'normal', room: 1, x: 700, y: -1550, seed: (seed ^ 0x28) >>> 0, wave: 1 },
    // Wave bit 2 (30%) — veteran Sons of Flame plus Flamewaker healers at the ledges.
    { id: 'son:w:3', kind: 'emberAcolyte', rank: 'veteran', room: 1, x: -1400, y: -900, seed: (seed ^ 0x29) >>> 0, wave: 2 },
    { id: 'son:e:3', kind: 'emberAcolyte', rank: 'veteran', room: 1, x: 1400, y: -900, seed: (seed ^ 0x2a) >>> 0, wave: 2 },
    { id: 'son:w:4', kind: 'emberAcolyte', rank: 'veteran', room: 1, x: -1400, y: -200, seed: (seed ^ 0x2b) >>> 0, wave: 2 },
    { id: 'son:e:4', kind: 'emberAcolyte', rank: 'veteran', room: 1, x: 1400, y: -200, seed: (seed ^ 0x2c) >>> 0, wave: 2 },
    { id: 'flamewaker:w', kind: 'wisp', rank: 'veteran', room: 1, x: -450, y: -1550, seed: (seed ^ 0x2d) >>> 0, wave: 2 },
    { id: 'flamewaker:e', kind: 'wisp', rank: 'veteran', room: 1, x: 450, y: -1550, seed: (seed ^ 0x2e) >>> 0, wave: 2 },
  ];
  const props: DungeonProp[] = [];
  // Slag furnaces, lava pools and black iron dressing around the basin walls; the center stays clear for the fight.
  const dressing: DungeonProp['kind'][] = ['furnace', 'pool', 'anvil', 'furnace', 'crystal', 'pool', 'anvil', 'furnace'];
  for (let i = 0; i < 8; i++) {
    const x = ARENA.x + ARENA.width * (i % 2 ? .86 : .14), y = ARENA.y + ARENA.height * (.16 + Math.floor(i / 2) * .22);
    props.push({ id: `raid2-prop:${i}`, x, y, kind: dressing[i], seed: (seed + i * 137) >>> 0 });
  }
  for (let i = 0; i < 3; i++)
    props.push({ id: `raid2-prop:entry:${i}`, x: ENTRY.x + ENTRY.width * (.2 + i * .3), y: ENTRY.y + 90, kind: i === 1 ? 'crystal' : 'furnace', seed: (seed + 900 + i) >>> 0 });
  const floor: DungeonFloor = {
    theme: 'blackrock', seed, rooms, edges: [[0, 1]], corridors, members,
    entry: { x: 0, y: ENTRY.y + ENTRY.height / 2 },
    exit: { x: 0, y: 420 },
    chests: [
      { x: -190, y: -860, room: 1 }, // cache of the Firelord, gated by surviving arena members
      { x: 190, y: -860, room: 1 },
      { x: 0, y: -800, room: 1 },    // boss chest — requires run.states.warden.hp <= 0
    ],
    props,
  };
  for (const r of corridors) { r.outline?.forEach(Object.freeze); r.path?.forEach(Object.freeze); if (r.outline) Object.freeze(r.outline); if (r.path) Object.freeze(r.path); }
  for (const v of [...rooms, ...corridors, ...members, ...floor.edges, ...floor.chests, ...props]) Object.freeze(v);
  Object.freeze(rooms); Object.freeze(corridors); Object.freeze(members); Object.freeze(floor.edges);
  Object.freeze(floor.chests); Object.freeze(floor.entry); Object.freeze(floor.exit); Object.freeze(props);
  return Object.freeze(floor);
}

// ── Entrance placement ───────────────────────────────────────────────────
/** One deterministic remote gate per world seed: the first far raid-tier cell that does not already hold Onyxia's gate. */
const RAID2_MIN_ZONE_LEVEL = 14;
const gateCache = new Map<number, { x: number; y: number } | null>();
function raid2GatePoint(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>): { x: number; y: number } | null {
  const cached = gateCache.get(world.seed);
  if (cached !== undefined) return cached;
  let point: { x: number; y: number } | null = null;
  // Spiral outward through wilderness cells; the nearest high-tier cell without Onyxia's gate wins.
  for (let ring = 9; ring <= 64 && !point; ring++)
    for (let cy = -ring; cy <= ring && !point; cy++)
      for (let cx = -ring; cx <= ring && !point; cx++) {
        if (Math.max(Math.abs(cx), Math.abs(cy)) !== ring) continue;
        const seed = siteHash(cx, cy, world.seed, 0x0c0e11);
        const x = (cx + .5) * 1400 + ((seed >>> 8) % 900 - 450), y = (cy + .5) * 1400 + ((seed >>> 20) % 900 - 450);
        if (getZoneAt(x, y, world.seed).originalLevel < RAID2_MIN_ZONE_LEVEL) continue;
        // Never share a cell with Onyxia's Lair: probe whether her gate lands inside this cell's bounds.
        if (raidEntrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        point = { x, y };
      }
  gateCache.set(world.seed, point);
  if (gateCache.size > 8) gateCache.delete(gateCache.keys().next().value!);
  return point;
}

/**
 * Molten Core surface gate, mirroring raidEntrances: a stable non-solid
 * entrance probed onto open ground near a remote, raid-tier cell distinct from
 * Onyxia's. Merge into WorldLandscape.getDungeonEntrances behind
 * GAME_FEATURES.raidBoss (or a dedicated raidBoss2 flag if the integrator adds one).
 */
export function raid2Entrances(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>,
  x: number, y: number, w: number, h: number): DungeonEntrance[] {
  if (!GAME_FEATURES.raidBoss || ![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 100000 || h > 100000)
    return [];
  const anchor = raid2GatePoint(world);
  if (!anchor) return [];
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, px = anchor.x + Math.cos(a) * (i < 8 ? 60 : 140), py = anchor.y + Math.sin(a) * (i < 8 ? 60 : 140);
    if (px < x || py < y || px >= x + w || py >= y + h) continue;
    if (world.blocked(px, py, 40) || world.isSanctuary(px, py)) continue;
    const zone = getZoneAt(px, py, world.seed);
    return [{ id: RAID2_ENTRANCE_ID, name: 'Molten Core', theme: 'blackrock', x: px, y: py,
      seed: (world.seed ^ 0x0c0e11) >>> 0, level: Math.min(1e6, zone.maxLevel), biome: world.sampleBiome(px, py).id }];
  }
  return [];
}
