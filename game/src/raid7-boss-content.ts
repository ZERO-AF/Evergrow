import type { DungeonEntrance, DungeonFloor } from './dungeon.ts';
import type { WorldLandscape } from './world-landscape.ts';
import { raidEntrances } from './raid-boss-content.ts';
import { raid2Entrances } from './raid2-boss-content.ts';
import { raid3Entrances } from './raid3-boss-content.ts';
import { raid4Entrances } from './raid4-boss-content.ts';
import { raid5Entrances } from './raid5-boss-content.ts';
import { raid6Entrances } from './raid6-boss-content.ts';
import type { Enemy } from './model.ts';
import { isRaidBossMember, raidArenaFloor as buildArenaFloor, raidArenaCenter, raidEntrancesAt, type RaidSpec } from './raid-kit.ts';

/**
 * Seventh raid boss (docs/wow-deepening.md §15, seventh wave): Yogg-Saron, the
 * God of Death — the real WotLK Ulduar finale — inside Ulduar, a dedicated
 * single-arena titan prison.
 *
 * The arena reuses the frozen dungeon plumbing end to end: DungeonRun state,
 * wave-gated member admission (`wave` bits on run.states.warden.bossPhases,
 * auto-set by updateDungeon at 60% / 30% for wilderness-boss kinds), boss
 * chest (index 2), exit portal, journey completion and save validation. The
 * integrator routes `generateDungeon` to `raid7ArenaFloor` for Ulduar
 * entrances; every downstream consumer then works unchanged.
 */

export const RAID7_ENTRANCE_ID = 'dungeon:raid:ulduar';
export const RAID7_BOSS_NAME = 'Yogg-Saron';
export const RAID7_BOSS_MEMBER_ID = 'warden'; // wave gating + boss chest key off this id
export const RAID7_BOSS_KIND: Enemy['kind'] = 'warden';

export const isRaid7EntranceId = (id: string | undefined): boolean => id === RAID7_ENTRANCE_ID;
export const isRaid7Entrance = (e: Pick<DungeonEntrance, 'id'> | undefined | null): boolean => !!e && isRaid7EntranceId(e.id);
/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of an Ulduar run. */
export const isRaid7Boss = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  isRaidBossMember(e, RAID7_ENTRANCE_ID, RAID7_BOSS_MEMBER_ID);
export const raid7BossName = (e: Pick<Enemy, 'campId' | 'campMemberId'>): string | undefined =>
  isRaid7Boss(e) ? RAID7_BOSS_NAME : undefined;

/** Fight rules. Phase bits 1/2 match the 60% / 30% add-wave thresholds. */
export const YOGG_RULES = Object.freeze({
  /** Boss chest loot table (raid-loot-content.ts): Tier-8 armor + Mimiron's Head stand-in. */
  lootTable: 'yoggsaron' as const,
  phaseTwo: .6, phaseThree: .3,
  leash: 1600, awareness: 720,
  gazeReach: 260, gazeArc: Math.PI * 1.3,             // Lunatic Gaze (wide frontal cone — look away!)
  linkLength: 540, linkWidth: 36,                    // Brain Link (3 staggered shadow beams)
  linkOffsets: [-0.5, 0, 0.5] as readonly number[],
  fervorRadius: 135,                                 // Sara's Fervor (shadow detonation at the target)
  barrierLength: 700, barrierWidth: 52,              // Shadowy Barrier (projected shadow wall lane)
  roarRadius: 480,                                   // Deafening Roar (arena-wide nova)
  madnessRadius: 560, madnessDamage: 1.3,            // Induce Madness (phase-3 nova, hits harder)
  voidRadius: 105, voidDuration: 26, voidInterval: .5, voidDps: .22, // shadow void zones (fraction of boss damage per tick)
  voidMax: 10,
  enrageAfter: 480,                                  // the Old God's patience runs out (seconds from engage)
  enrageDamage: 2.2, enragePulse: 1.5, enrageRadius: 620,
  allyDamageEase: .1, allyDamageEaseMax: .3,         // solo+allies scaling: -10% per ally, cap -30%
});

/**
 * Real Yogg-Saron spell names for DBM-style warnings; falls back to undefined
 * for non-raid enemies. `attackVariant === 2` on 'command' marks Induce
 * Madness (the phase-3 cast) so it is not announced as a Deafening Roar.
 */
export function raid7BossWarningSpec(e: Pick<Enemy, 'campId' | 'campMemberId' | 'bossMove' | 'bossPhases' | 'attackVariant'>):
  { ability: string; advice: string } | undefined {
  if (!isRaid7Boss(e) || !e.bossMove) return undefined;
  switch (e.bossMove) {
    case 'sweep': return { ability: 'Lunatic Gaze', advice: 'look away!' };
    case 'fracture': return { ability: 'Brain Link', advice: 'break the link!' };
    case 'eruption': return { ability: 'Sara\'s Fervor', advice: 'move!' };
    case 'rush': return { ability: 'Shadowy Barrier', advice: 'out of the lane!' };
    case 'command': return e.attackVariant === 2
      ? { ability: 'Induce Madness', advice: 'spread out!' }
      : { ability: 'Deafening Roar', advice: 'spread out!' };
    case 'summon': return (e.bossPhases ?? 0) & 2
      ? { ability: 'Immortal Guardians', advice: 'adds!' }
      : { ability: 'Guardians of Yogg-Saron', advice: 'adds!' };
    case 'jab': return { ability: 'Psychosis', advice: 'move!' };
    case 'bolt': return { ability: 'Shadow Bolt', advice: 'sidestep!' };
  }
}

// ── Arena floor ──────────────────────────────────────────────────────────
// Room ids: 0 = entry antechamber, 1 = the final chamber arena. One corridor links them.
const SPEC: RaidSpec = {
  salt: 0x0d0a11,
  entranceId: RAID7_ENTRANCE_ID,
  name: 'Ulduar',
  theme: 'astral',
  minZoneLevel: 22,
  arena: { x: -1500, y: -1600, width: 3000, height: 2100 },
  bossAt: { x: 0, y: -1050 }, // Yogg-Saron waits in the prison's heart, north-center
  corridor: [{ x: 0, y: 1500 }, { x: 0, y: 420 }],
  exitY: 420,
  members: [
    // Yogg-Saron himself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID7_BOSS_MEMBER_ID, kind: RAID7_BOSS_KIND, rank: 'elite', room: 1, x: 0, y: -1050, salt: 0x0d0a },
    // Phase 2 (bit 1, 60%) — Guardians of Yogg-Saron rise from the prison rim
    // alongside Corruptor Tentacles (casters standing in for the appendages).
    { id: 'guardian:w:0', kind: 'brute', rank: 'normal', room: 1, x: -1400, y: -1200, salt: 0x91, wave: 1 },
    { id: 'guardian:w:1', kind: 'brute', rank: 'normal', room: 1, x: -1400, y: -500, salt: 0x92, wave: 1 },
    { id: 'guardian:e:0', kind: 'brute', rank: 'normal', room: 1, x: 1400, y: -1200, salt: 0x93, wave: 1 },
    { id: 'guardian:e:1', kind: 'brute', rank: 'normal', room: 1, x: 1400, y: -500, salt: 0x94, wave: 1 },
    { id: 'tentacle:w:0', kind: 'caster', rank: 'normal', room: 1, x: -1400, y: 150, salt: 0x95, wave: 1 },
    { id: 'tentacle:e:0', kind: 'caster', rank: 'normal', room: 1, x: 1400, y: 150, salt: 0x96, wave: 1 },
    { id: 'tentacle:n:0', kind: 'caster', rank: 'normal', room: 1, x: -700, y: -1500, salt: 0x97, wave: 1 },
    { id: 'tentacle:n:1', kind: 'caster', rank: 'normal', room: 1, x: 700, y: -1500, salt: 0x98, wave: 1 },
    // Phase 3 (bit 2, 30%) — Immortal Guardians at the ledges plus Crusher
    // Tentacles: the descent into madness.
    { id: 'immortal:w', kind: 'brute', rank: 'veteran', room: 1, x: -450, y: -1500, salt: 0x99, wave: 2 },
    { id: 'immortal:e', kind: 'brute', rank: 'veteran', room: 1, x: 450, y: -1500, salt: 0x9a, wave: 2 },
    { id: 'crusher:w', kind: 'stalker', rank: 'veteran', room: 1, x: -1400, y: -850, salt: 0x9b, wave: 2 },
    { id: 'crusher:e', kind: 'stalker', rank: 'veteran', room: 1, x: 1400, y: -850, salt: 0x9c, wave: 2 },
  ],
  // Titan orreries, librams and focus crystals around the prison walls.
  dressing: ['orrery', 'bookshelf', 'crystal', 'orrery', 'bookshelf', 'crystal', 'orrery', 'bookshelf'],
  entryProps: ['orrery', 'crystal', 'orrery'],
  propPrefix: 'raid7-prop',
  chests: [
    { x: -190, y: -860 }, // cache of the God of Death, gated by surviving arena members
    { x: 190, y: -860 },
    { x: 0, y: -800 },    // boss chest — requires run.states.warden.hp <= 0
  ],
  prior: [raidEntrances, raid2Entrances, raid3Entrances, raid4Entrances, raid5Entrances, raid6Entrances],
};

export const RAID7_ARENA_CENTER = raidArenaCenter(SPEC);

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaid7Entrance. */
export function raid7ArenaFloor(seed: number, _level = 1): DungeonFloor {
  return buildArenaFloor(SPEC, seed);
}

/**
 * Ulduar surface gate, mirroring raidEntrances/…/raid6Entrances: a stable
 * non-solid entrance probed onto open ground near a remote, raid-tier cell
 * distinct from all six prior raids. Merge into
 * WorldLandscape.getDungeonEntrances behind GAME_FEATURES.raidBoss (or a
 * dedicated raidBoss7 flag if the integrator adds one).
 */
export function raid7Entrances(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>,
  x: number, y: number, w: number, h: number): DungeonEntrance[] {
  return raidEntrancesAt(SPEC, world, x, y, w, h);
}
