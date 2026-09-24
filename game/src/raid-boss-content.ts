import type { DungeonEntrance, DungeonFloor } from './dungeon.ts';
import type { WorldLandscape } from './world-landscape.ts';
import type { Enemy } from './model.ts';
import { isRaidBossMember, raidArenaFloor as buildArenaFloor, raidArenaCenter, raidEntrancesAt, type RaidSpec } from './raid-kit.ts';

/**
 * Raid boss (docs/wow-deepening.md §15): Onyxia — the real WotLK three-phase
 * fight (ground → air whelps → ground + fear) on a deterministic single-arena
 * floor, reached through a remote surface gate. The arena skeleton lives in
 * raid-kit.ts; this file keeps only Onyxia's roster, rules and warning names.
 */

export const RAID_ENTRANCE_ID = 'dungeon:raid:onyxias-lair';
export const RAID_BOSS_NAME = 'Onyxia';
export const RAID_BOSS_MEMBER_ID = 'warden'; // wave gating + boss chest key off this id
export const RAID_BOSS_KIND: Enemy['kind'] = 'ashColossus';

export const isRaidEntranceId = (id: string | undefined): boolean => id === RAID_ENTRANCE_ID;
export const isRaidEntrance = (e: Pick<DungeonEntrance, 'id'> | undefined | null): boolean => !!e && isRaidEntranceId(e.id);
/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of a raid run. */
export const isRaidBoss = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  isRaidBossMember(e, RAID_ENTRANCE_ID, RAID_BOSS_MEMBER_ID);
export const raidBossName = (e: Pick<Enemy, 'campId' | 'campMemberId'>): string | undefined =>
  isRaidBoss(e) ? RAID_BOSS_NAME : undefined;

/** Fight rules. Phase bits match updateDungeon's warden auto-bits (65% / 30%). */
export const ONYXIA_RULES = Object.freeze({
  /** Boss chest loot table (raid-loot-content.ts): Tier-2 helms + Onyxia epics. */
  lootTable: 'onyxia' as const,
  phaseTwo: .65, phaseThree: .3,
  leash: 1500, awareness: 640,
  sweepReach: 165, sweepArc: Math.PI * 1.25,          // Tail Sweep
  breathLength: 560, breathWidth: 30,                // Flame Breath (3-lane cone)
  breathOffsets: [-0.5, 0, 0.5] as readonly number[],
  fireballRadius: 120,                               // Fireball blast (air phase)
  deepBreathLength: 620, deepBreathWidth: 46,        // Deep Breath strafe lane
  roarRadius: 430,                                   // Bellowing Roar
  scorchRadius: 95, scorchDuration: 22, scorchInterval: .5, scorchDps: .22, // Lava scorch zones (fraction of boss damage per tick)
  scorchMax: 9,
  airHoverMin: 240, airHoverMax: 430,                // phase-2 hover band
  enrageAfter: 480,                                  // Broodmother's Fury timer (seconds from engage)
  enrageDamage: 2.2, enragePulse: 1.6, enrageRadius: 560,
  allyDamageEase: .1, allyDamageEaseMax: .3,         // solo+allies scaling: -10% per ally, cap -30%
});

/** Real Onyxia spell names for DBM-style warnings; falls back to undefined for non-raid enemies. */
export function raidBossWarningSpec(e: Pick<Enemy, 'campId' | 'campMemberId' | 'bossMove' | 'bossPhases'>):
  { ability: string; advice: string } | undefined {
  if (!isRaidBoss(e) || !e.bossMove) return undefined;
  switch (e.bossMove) {
    case 'sweep': return { ability: 'Tail Sweep', advice: 'move!' };
    case 'fracture': return { ability: 'Flame Breath', advice: 'sidestep!' };
    case 'eruption': return { ability: 'Fireball', advice: 'move!' };
    case 'rush': return { ability: 'Deep Breath', advice: 'out of the lane!' };
    case 'command': return { ability: 'Bellowing Roar', advice: 'spread out!' };
    case 'summon': return (e.bossPhases ?? 0) & 2
      ? { ability: 'Bellowing Roar', advice: 'Onyxia lands!' }
      : { ability: 'Onyxian Whelps', advice: 'adds!' };
    case 'jab': return { ability: 'Thrash', advice: 'move!' };
    case 'bolt': return { ability: 'Fireball', advice: 'sidestep!' };
  }
}

// ── Arena floor ──────────────────────────────────────────────────────────
// Room ids: 0 = entry antechamber, 1 = the lair arena. One corridor links them.
const SPEC: RaidSpec = {
  salt: 0x0e7c1a,
  entranceId: RAID_ENTRANCE_ID,
  name: "Onyxia's Lair",
  theme: 'foundry',
  minZoneLevel: 12,
  arena: { x: -1400, y: -1400, width: 2800, height: 1800 },
  bossAt: { x: 0, y: -950 },
  corridor: [{ x: 0, y: 1300 }, { x: 0, y: 350 }],
  exitY: 300,
  members: [
    // Onyxia herself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID_BOSS_MEMBER_ID, kind: RAID_BOSS_KIND, rank: 'elite', room: 1, x: 0, y: -950, salt: 0x0e7a },
    { id: 'whelp:w:0', kind: 'stalker', rank: 'normal', room: 1, x: -1240, y: -980, salt: 0x11, wave: 1 },
    { id: 'whelp:w:1', kind: 'stalker', rank: 'normal', room: 1, x: -1240, y: -1080, salt: 0x12, wave: 1 },
    { id: 'whelp:e:0', kind: 'stalker', rank: 'normal', room: 1, x: 1240, y: -980, salt: 0x13, wave: 1 },
    { id: 'whelp:e:1', kind: 'stalker', rank: 'normal', room: 1, x: 1240, y: -1080, salt: 0x14, wave: 1 },
    // Phase 3 — a second whelp wave plus Onyxian Warders at the back ledges (bit 2).
    { id: 'whelp:w:2', kind: 'stalker', rank: 'veteran', room: 1, x: -1240, y: -1180, salt: 0x15, wave: 2 },
    { id: 'whelp:e:2', kind: 'stalker', rank: 'veteran', room: 1, x: 1240, y: -1180, salt: 0x16, wave: 2 },
    { id: 'warder:w', kind: 'wisp', rank: 'veteran', room: 1, x: -720, y: -1290, salt: 0x17, wave: 2 },
    { id: 'warder:e', kind: 'wisp', rank: 'veteran', room: 1, x: 720, y: -1290, salt: 0x18, wave: 2 },
  ],
  // Lava vents and hoard dressing around the arena walls.
  dressing: ['furnace', 'crystal', 'anvil', 'furnace', 'crate', 'crystal', 'barrel', 'furnace'],
  entryProps: ['crate', 'crystal', 'crate'],
  propPrefix: 'raid-prop',
  chests: [
    { x: -170, y: -760 }, // hoard caches, gated by surviving arena members
    { x: 170, y: -760 },
    { x: 0, y: -700 },    // boss chest — requires run.states.warden.hp <= 0
  ],
  prior: [],
};

export const RAID_ARENA_CENTER = raidArenaCenter(SPEC);

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaidEntrance. */
export function raidArenaFloor(seed: number, _level = 1): DungeonFloor {
  return buildArenaFloor(SPEC, seed);
}

/**
 * Onyxia's Lair surface gate, mirroring dungeonEntrances: a stable non-solid
 * entrance probed onto open ground near a remote, raid-tier cell. Merge into
 * WorldLandscape.getDungeonEntrances behind GAME_FEATURES.raidBoss.
 */
export function raidEntrances(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>,
  x: number, y: number, w: number, h: number): DungeonEntrance[] {
  return raidEntrancesAt(SPEC, world, x, y, w, h);
}
