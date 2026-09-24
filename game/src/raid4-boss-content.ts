import type { DungeonEntrance, DungeonFloor } from './dungeon.ts';
import type { WorldLandscape } from './world-landscape.ts';
import { raidEntrances } from './raid-boss-content.ts';
import { raid2Entrances } from './raid2-boss-content.ts';
import { raid3Entrances } from './raid3-boss-content.ts';
import type { Enemy } from './model.ts';
import { isRaidBossMember, raidArenaFloor as buildArenaFloor, raidArenaCenter, raidEntrancesAt, type RaidSpec } from './raid-kit.ts';

/**
 * Fourth raid boss (docs/wow-deepening.md §15, fourth wave): the Lich King —
 * the real WotLK Icecrown Citadel finale — inside Icecrown Citadel, a
 * dedicated single-arena Frozen Throne.
 *
 * The arena reuses the frozen dungeon plumbing end to end: DungeonRun state,
 * wave-gated member admission (`wave` bits on run.states.warden.bossPhases,
 * auto-set by updateDungeon at 70% / 40% for wilderness-boss kinds, plus bits
 * 4/8/16 for the Summon Vile Spirits packs), boss chest (index 2), exit
 * portal, journey completion and save validation. The integrator routes
 * `generateDungeon` to `raid4ArenaFloor` for Icecrown entrances; every
 * downstream consumer then works unchanged.
 */

export const RAID4_ENTRANCE_ID = 'dungeon:raid:icecrown-citadel';
export const RAID4_BOSS_NAME = 'The Lich King';
export const RAID4_BOSS_MEMBER_ID = 'warden'; // wave gating + boss chest key off this id
export const RAID4_BOSS_KIND: Enemy['kind'] = 'warden';

export const isRaid4EntranceId = (id: string | undefined): boolean => id === RAID4_ENTRANCE_ID;
export const isRaid4Entrance = (e: Pick<DungeonEntrance, 'id'> | undefined | null): boolean => !!e && isRaid4EntranceId(e.id);
/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of an Icecrown run. */
export const isRaid4Boss = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  isRaidBossMember(e, RAID4_ENTRANCE_ID, RAID4_BOSS_MEMBER_ID);
export const raid4BossName = (e: Pick<Enemy, 'campId' | 'campMemberId'>): string | undefined =>
  isRaid4Boss(e) ? RAID4_BOSS_NAME : undefined;

/** Fight rules. Phase bits 1/2 match the 70% / 40% transition thresholds; bits 4/8/16 are the Vile Spirit packs. */
export const LICHKING_RULES = Object.freeze({
  /** Boss chest loot table (raid-loot-content.ts): Tier-10 armor + mount chance. */
  lootTable: 'lichking' as const,
  phaseTwo: .7, phaseThree: .4,
  leash: 1600, awareness: 720,
  reaperReach: 215, reaperArc: Math.PI * 1.05,         // Soul Reaper (frontal Frostmourne cleave)
  defileRadius: 140,                                  // Defile (void detonation at the target)
  sufferingLength: 540, sufferingWidth: 36,           // Pain and Suffering (3 staggered shadow lanes)
  sufferingOffsets: [-0.5, 0, 0.5] as readonly number[],
  sphereLength: 720, sphereWidth: 50,                 // Ice Sphere (projected frost lane, phase 3)
  winterRadius: 480,                                  // Remorseless Winter (arena-wide nova)
  defileZoneRadius: 105, defileZoneDuration: 26, defileZoneInterval: .5, defileZoneDps: .22, // Defile void zones (fraction of boss damage per tick)
  defileZoneMax: 10,
  vileAfter: 40, vileEvery: 55,                       // Summon Vile Spirits cadence (seconds from engage)
  vileBits: [4, 8, 16] as readonly number[],          // wave bits consumed by successive Vile Spirits casts
  enrageAfter: 420,                                   // Fury of Frostmourne timer (seconds from engage)
  enrageDamage: 2.2, enragePulse: 1.5, enrageRadius: 620,
  allyDamageEase: .1, allyDamageEaseMax: .3,          // solo+allies scaling: -10% per ally, cap -30%
});

/**
 * Real Lich King spell names for DBM-style warnings; falls back to undefined
 * for non-raid enemies. `attackVariant === 2` on 'summon' marks a Summon Vile
 * Spirits cast so it is not announced as a phase-transition add wave.
 */
export function raid4BossWarningSpec(e: Pick<Enemy, 'campId' | 'campMemberId' | 'bossMove' | 'bossPhases' | 'attackVariant'>):
  { ability: string; advice: string } | undefined {
  if (!isRaid4Boss(e) || !e.bossMove) return undefined;
  switch (e.bossMove) {
    case 'sweep': return { ability: 'Soul Reaper', advice: 'move!' };
    case 'fracture': return { ability: 'Pain and Suffering', advice: 'sidestep!' };
    case 'eruption': return { ability: 'Defile', advice: 'move!' };
    case 'rush': return { ability: 'Ice Sphere', advice: 'out of the lane!' };
    case 'command': return { ability: 'Remorseless Winter', advice: 'spread out!' };
    case 'summon': return e.attackVariant === 2
      ? { ability: 'Summon Vile Spirits', advice: 'adds!' }
      : (e.bossPhases ?? 0) & 2
        ? { ability: 'Summon Val\'kyr', advice: 'adds!' }
        : { ability: 'Summon Drudge Ghouls', advice: 'adds!' };
    case 'jab': return { ability: 'Infest', advice: 'move!' };
    case 'bolt': return { ability: 'Necrotic Plague', advice: 'sidestep!' };
  }
}

// ── Arena floor ──────────────────────────────────────────────────────────
// Room ids: 0 = entry antechamber, 1 = the Frozen Throne arena. One corridor links them.
const SPEC: RaidSpec = {
  salt: 0x1cec04,
  entranceId: RAID4_ENTRANCE_ID,
  name: 'Icecrown Citadel',
  theme: 'rime',
  minZoneLevel: 18,
  arena: { x: -1500, y: -1600, width: 3000, height: 2100 },
  bossAt: { x: 0, y: -1050 }, // the Frozen Throne, north-center
  corridor: [{ x: 0, y: 1500 }, { x: 0, y: 420 }],
  exitY: 420,
  members: [
    // The Lich King himself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID4_BOSS_MEMBER_ID, kind: RAID4_BOSS_KIND, rank: 'elite', room: 1, x: 0, y: -1050, salt: 0x1cec },
    // Drudge Ghouls — wave bit 1 (70%), shambling in from the throne rim.
    { id: 'ghoul:w:0', kind: 'stalker', rank: 'normal', room: 1, x: -1400, y: -1200, salt: 0x51, wave: 1 },
    { id: 'ghoul:w:1', kind: 'stalker', rank: 'normal', room: 1, x: -1400, y: -500, salt: 0x52, wave: 1 },
    { id: 'ghoul:w:2', kind: 'stalker', rank: 'normal', room: 1, x: -1400, y: 150, salt: 0x53, wave: 1 },
    { id: 'ghoul:e:0', kind: 'stalker', rank: 'normal', room: 1, x: 1400, y: -1200, salt: 0x54, wave: 1 },
    { id: 'ghoul:e:1', kind: 'stalker', rank: 'normal', room: 1, x: 1400, y: -500, salt: 0x55, wave: 1 },
    { id: 'ghoul:e:2', kind: 'stalker', rank: 'normal', room: 1, x: 1400, y: 150, salt: 0x56, wave: 1 },
    { id: 'ghoul:n:0', kind: 'stalker', rank: 'normal', room: 1, x: -700, y: -1500, salt: 0x57, wave: 1 },
    { id: 'ghoul:n:1', kind: 'stalker', rank: 'normal', room: 1, x: 700, y: -1500, salt: 0x58, wave: 1 },
    // Wave bit 2 (40%) — Val'kyr Shadowguards plus Shambling Horrors at the ledges.
    { id: 'valkyr:w:0', kind: 'wisp', rank: 'veteran', room: 1, x: -1400, y: -850, salt: 0x59, wave: 2 },
    { id: 'valkyr:e:0', kind: 'wisp', rank: 'veteran', room: 1, x: 1400, y: -850, salt: 0x5a, wave: 2 },
    { id: 'valkyr:w:1', kind: 'wisp', rank: 'veteran', room: 1, x: -1400, y: -150, salt: 0x5b, wave: 2 },
    { id: 'valkyr:e:1', kind: 'wisp', rank: 'veteran', room: 1, x: 1400, y: -150, salt: 0x5c, wave: 2 },
    { id: 'horror:w', kind: 'brute', rank: 'veteran', room: 1, x: -450, y: -1500, salt: 0x5d, wave: 2 },
    { id: 'horror:e', kind: 'brute', rank: 'veteran', room: 1, x: 450, y: -1500, salt: 0x5e, wave: 2 },
    // Summon Vile Spirits — bound souls rising around the throne, one pack per cast (bits 4 / 8 / 16).
    { id: 'vile:w:0', kind: 'wisp', rank: 'normal', room: 1, x: -1150, y: -1450, salt: 0x61, wave: 4 },
    { id: 'vile:e:0', kind: 'wisp', rank: 'normal', room: 1, x: 1150, y: -1450, salt: 0x62, wave: 4 },
    { id: 'vile:w:1', kind: 'wisp', rank: 'normal', room: 1, x: -1150, y: 300, salt: 0x63, wave: 8 },
    { id: 'vile:e:1', kind: 'wisp', rank: 'normal', room: 1, x: 1150, y: 300, salt: 0x64, wave: 8 },
    { id: 'vile:n:0', kind: 'wisp', rank: 'veteran', room: 1, x: -350, y: -1500, salt: 0x65, wave: 16 },
    { id: 'vile:n:1', kind: 'wisp', rank: 'veteran', room: 1, x: 350, y: -1500, salt: 0x66, wave: 16 },
  ],
  // Ice pillars, tombs and reliquary crystals around the throne walls.
  dressing: ['icePillar', 'tomb', 'crystal', 'icePillar', 'sarcophagus', 'crystal', 'tomb', 'icePillar'],
  entryProps: ['icePillar', 'crystal', 'icePillar'],
  propPrefix: 'raid4-prop',
  chests: [
    { x: -190, y: -860 }, // cache of the Frozen Throne, gated by surviving arena members
    { x: 190, y: -860 },
    { x: 0, y: -800 },    // boss chest — requires run.states.warden.hp <= 0
  ],
  prior: [raidEntrances, raid2Entrances, raid3Entrances],
};

export const RAID4_ARENA_CENTER = raidArenaCenter(SPEC);

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaid4Entrance. */
export function raid4ArenaFloor(seed: number, _level = 1): DungeonFloor {
  return buildArenaFloor(SPEC, seed);
}

/**
 * Icecrown Citadel surface gate, mirroring raidEntrances/raid2Entrances/
 * raid3Entrances: a stable non-solid entrance probed onto open ground near a
 * remote, raid-tier cell distinct from all three prior raids. Merge into
 * WorldLandscape.getDungeonEntrances behind GAME_FEATURES.raidBoss (or a
 * dedicated raidBoss4 flag if the integrator adds one).
 */
export function raid4Entrances(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>,
  x: number, y: number, w: number, h: number): DungeonEntrance[] {
  return raidEntrancesAt(SPEC, world, x, y, w, h);
}
