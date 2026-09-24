import type { DungeonEntrance, DungeonFloor } from './dungeon.ts';
import type { WorldLandscape } from './world-landscape.ts';
import { raidEntrances } from './raid-boss-content.ts';
import type { Enemy } from './model.ts';
import { isRaidBossMember, raidArenaFloor as buildArenaFloor, raidArenaCenter, raidEntrancesAt, type RaidSpec } from './raid-kit.ts';

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
  isRaidBossMember(e, RAID2_ENTRANCE_ID, RAID2_BOSS_MEMBER_ID);
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
const SPEC: RaidSpec = {
  salt: 0x0c0e11,
  entranceId: RAID2_ENTRANCE_ID,
  name: 'Molten Core',
  theme: 'blackrock',
  minZoneLevel: 14,
  arena: { x: -1500, y: -1650, width: 3000, height: 2200 },
  bossAt: { x: 0, y: -1050 }, // Ragnaros's lava pool, north-center
  corridor: [{ x: 0, y: 1500 }, { x: 0, y: 420 }],
  exitY: 420,
  members: [
    // Ragnaros himself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID2_BOSS_MEMBER_ID, kind: RAID2_BOSS_KIND, rank: 'elite', room: 1, x: 0, y: -1050, salt: 0x0a65 },
    // Sons of Flame — wave bit 1 (65%), rising from the lava around the arena rim.
    { id: 'son:w:0', kind: 'emberAcolyte', rank: 'normal', room: 1, x: -1400, y: -1250, salt: 0x21, wave: 1 },
    { id: 'son:w:1', kind: 'emberAcolyte', rank: 'normal', room: 1, x: -1400, y: -550, salt: 0x22, wave: 1 },
    { id: 'son:w:2', kind: 'emberAcolyte', rank: 'normal', room: 1, x: -1400, y: 150, salt: 0x23, wave: 1 },
    { id: 'son:e:0', kind: 'emberAcolyte', rank: 'normal', room: 1, x: 1400, y: -1250, salt: 0x24, wave: 1 },
    { id: 'son:e:1', kind: 'emberAcolyte', rank: 'normal', room: 1, x: 1400, y: -550, salt: 0x25, wave: 1 },
    { id: 'son:e:2', kind: 'emberAcolyte', rank: 'normal', room: 1, x: 1400, y: 150, salt: 0x26, wave: 1 },
    { id: 'son:n:0', kind: 'emberAcolyte', rank: 'normal', room: 1, x: -700, y: -1550, salt: 0x27, wave: 1 },
    { id: 'son:n:1', kind: 'emberAcolyte', rank: 'normal', room: 1, x: 700, y: -1550, salt: 0x28, wave: 1 },
    // Wave bit 2 (30%) — veteran Sons of Flame plus Flamewaker healers at the ledges.
    { id: 'son:w:3', kind: 'emberAcolyte', rank: 'veteran', room: 1, x: -1400, y: -900, salt: 0x29, wave: 2 },
    { id: 'son:e:3', kind: 'emberAcolyte', rank: 'veteran', room: 1, x: 1400, y: -900, salt: 0x2a, wave: 2 },
    { id: 'son:w:4', kind: 'emberAcolyte', rank: 'veteran', room: 1, x: -1400, y: -200, salt: 0x2b, wave: 2 },
    { id: 'son:e:4', kind: 'emberAcolyte', rank: 'veteran', room: 1, x: 1400, y: -200, salt: 0x2c, wave: 2 },
    { id: 'flamewaker:w', kind: 'wisp', rank: 'veteran', room: 1, x: -450, y: -1550, salt: 0x2d, wave: 2 },
    { id: 'flamewaker:e', kind: 'wisp', rank: 'veteran', room: 1, x: 450, y: -1550, salt: 0x2e, wave: 2 },
  ],
  // Slag furnaces, lava pools and black iron dressing around the basin walls.
  dressing: ['furnace', 'pool', 'anvil', 'furnace', 'crystal', 'pool', 'anvil', 'furnace'],
  entryProps: ['furnace', 'crystal', 'furnace'],
  propPrefix: 'raid2-prop',
  chests: [
    { x: -190, y: -860 }, // cache of the Firelord, gated by surviving arena members
    { x: 190, y: -860 },
    { x: 0, y: -800 },    // boss chest — requires run.states.warden.hp <= 0
  ],
  prior: [raidEntrances],
};

export const RAID2_ARENA_CENTER = raidArenaCenter(SPEC);

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaid2Entrance. */
export function raid2ArenaFloor(seed: number, _level = 1): DungeonFloor {
  return buildArenaFloor(SPEC, seed);
}

/**
 * Molten Core surface gate, mirroring raidEntrances: a stable non-solid
 * entrance probed onto open ground near a remote, raid-tier cell distinct from
 * Onyxia's. Merge into WorldLandscape.getDungeonEntrances behind
 * GAME_FEATURES.raidBoss (or a dedicated raidBoss2 flag if the integrator adds one).
 */
export function raid2Entrances(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>,
  x: number, y: number, w: number, h: number): DungeonEntrance[] {
  return raidEntrancesAt(SPEC, world, x, y, w, h);
}
