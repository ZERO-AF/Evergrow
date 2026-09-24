import type { DungeonEntrance, DungeonFloor } from './dungeon.ts';
import type { WorldLandscape } from './world-landscape.ts';
import { raidEntrances } from './raid-boss-content.ts';
import { raid2Entrances } from './raid2-boss-content.ts';
import type { Enemy } from './model.ts';
import { isRaidBossMember, raidArenaFloor as buildArenaFloor, raidArenaCenter, raidEntrancesAt, type RaidSpec } from './raid-kit.ts';

/**
 * Third raid boss (docs/wow-deepening.md §15, third wave): Kel'Thuzad — the
 * real WotLK Naxxramas finale — inside Naxxramas, a dedicated single-arena
 * frost crypt.
 *
 * The arena reuses the frozen dungeon plumbing end to end: DungeonRun state,
 * wave-gated member admission (`wave` bits on run.states.warden.bossPhases,
 * auto-set by updateDungeon at 65% / 30% for wilderness-boss kinds, plus bits
 * 4/8/16 for the Chains of Kel'Thuzad packs), boss chest (index 2), exit
 * portal, journey completion and save validation. The integrator routes
 * `generateDungeon` to `raid3ArenaFloor` for Naxxramas entrances; every
 * downstream consumer then works unchanged.
 */

export const RAID3_ENTRANCE_ID = 'dungeon:raid:naxxramas';
export const RAID3_BOSS_NAME = 'Kel\'Thuzad';
export const RAID3_BOSS_MEMBER_ID = 'warden'; // wave gating + boss chest key off this id
export const RAID3_BOSS_KIND: Enemy['kind'] = 'warden';

export const isRaid3EntranceId = (id: string | undefined): boolean => id === RAID3_ENTRANCE_ID;
export const isRaid3Entrance = (e: Pick<DungeonEntrance, 'id'> | undefined | null): boolean => !!e && isRaid3EntranceId(e.id);
/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of a Naxxramas run. */
export const isRaid3Boss = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  isRaidBossMember(e, RAID3_ENTRANCE_ID, RAID3_BOSS_MEMBER_ID);
export const raid3BossName = (e: Pick<Enemy, 'campId' | 'campMemberId'>): string | undefined =>
  isRaid3Boss(e) ? RAID3_BOSS_NAME : undefined;

/** Fight rules. Phase bits 1/2 match the 65% / 30% Guardian thresholds; bits 4/8/16 are the Chains packs. */
export const KELTHUZAD_RULES = Object.freeze({
  /** Boss chest loot table (raid-loot-content.ts): Tier-3 armor + weapon. */
  lootTable: 'kelthuzad' as const,
  phaseTwo: .65, phaseThree: .3,
  leash: 1600, awareness: 720,
  blastReach: 210, blastArc: Math.PI * 1.05,           // Frost Blast (frontal freeze cone)
  fissureRadius: 135,                                 // Shadow Fissure (void zone detonation at the target)
  detonateLength: 540, detonateWidth: 36,             // Mana Detonation (3 staggered arcane lanes)
  detonateOffsets: [-0.5, 0, 0.5] as readonly number[],
  creepLength: 720, creepWidth: 50,                   // Shadow Fissure creep (projected void lane, phase 3)
  volleyRadius: 480,                                  // Frost Bolt Volley (arena-wide nova)
  voidRadius: 105, voidDuration: 26, voidInterval: .5, voidDps: .22, // Shadow Fissure void zones (fraction of boss damage per tick)
  voidMax: 10,
  chainsAfter: 40, chainsEvery: 55,                   // Chains of Kel'Thuzad cadence (seconds from engage)
  chainsBits: [4, 8, 16] as readonly number[],        // wave bits consumed by successive Chains casts
  enrageAfter: 420,                                   // Fury of the Lich King timer (seconds from engage)
  enrageDamage: 2.2, enragePulse: 1.5, enrageRadius: 620,
  allyDamageEase: .1, allyDamageEaseMax: .3,          // solo+allies scaling: -10% per ally, cap -30%
});

/**
 * Real Kel'Thuzad spell names for DBM-style warnings; falls back to undefined
 * for non-raid enemies. `attackVariant === 2` on 'summon' marks a Chains of
 * Kel'Thuzad cast so it is not announced as a Guardian wave.
 */
export function raid3BossWarningSpec(e: Pick<Enemy, 'campId' | 'campMemberId' | 'bossMove' | 'bossPhases' | 'attackVariant'>):
  { ability: string; advice: string } | undefined {
  if (!isRaid3Boss(e) || !e.bossMove) return undefined;
  switch (e.bossMove) {
    case 'sweep': return { ability: 'Frost Blast', advice: 'move!' };
    case 'fracture': return { ability: 'Mana Detonation', advice: 'sidestep!' };
    case 'eruption': return { ability: 'Shadow Fissure', advice: 'move!' };
    case 'rush': return { ability: 'Shadow Fissure', advice: 'out of the lane!' };
    case 'command': return { ability: 'Frost Bolt Volley', advice: 'spread out!' };
    case 'summon': return e.attackVariant === 2
      ? { ability: 'Chains of Kel\'Thuzad', advice: 'adds!' }
      : { ability: 'Guardians of Icecrown', advice: 'adds!' };
    case 'jab': return { ability: 'Frost Bolt', advice: 'move!' };
    case 'bolt': return { ability: 'Frost Bolt', advice: 'sidestep!' };
  }
}

// ── Arena floor ──────────────────────────────────────────────────────────
// Room ids: 0 = entry antechamber, 1 = the frost crypt arena. One corridor links them.
const SPEC: RaidSpec = {
  salt: 0x0f4057,
  entranceId: RAID3_ENTRANCE_ID,
  name: 'Naxxramas',
  theme: 'rime',
  minZoneLevel: 16,
  arena: { x: -1500, y: -1600, width: 3000, height: 2100 },
  bossAt: { x: 0, y: -1050 }, // Kel'Thuzad's dais, north-center
  corridor: [{ x: 0, y: 1500 }, { x: 0, y: 420 }],
  exitY: 420,
  members: [
    // Kel'Thuzad himself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID3_BOSS_MEMBER_ID, kind: RAID3_BOSS_KIND, rank: 'elite', room: 1, x: 0, y: -1050, salt: 0x0f40 },
    // Guardians of Icecrown — wave bit 1 (65%), stalking in from the crypt rim.
    { id: 'guardian:w:0', kind: 'frostRevenant', rank: 'normal', room: 1, x: -1400, y: -1200, salt: 0x31, wave: 1 },
    { id: 'guardian:w:1', kind: 'frostRevenant', rank: 'normal', room: 1, x: -1400, y: -500, salt: 0x32, wave: 1 },
    { id: 'guardian:w:2', kind: 'frostRevenant', rank: 'normal', room: 1, x: -1400, y: 150, salt: 0x33, wave: 1 },
    { id: 'guardian:e:0', kind: 'frostRevenant', rank: 'normal', room: 1, x: 1400, y: -1200, salt: 0x34, wave: 1 },
    { id: 'guardian:e:1', kind: 'frostRevenant', rank: 'normal', room: 1, x: 1400, y: -500, salt: 0x35, wave: 1 },
    { id: 'guardian:e:2', kind: 'frostRevenant', rank: 'normal', room: 1, x: 1400, y: 150, salt: 0x36, wave: 1 },
    { id: 'guardian:n:0', kind: 'frostRevenant', rank: 'normal', room: 1, x: -700, y: -1500, salt: 0x37, wave: 1 },
    { id: 'guardian:n:1', kind: 'frostRevenant', rank: 'normal', room: 1, x: 700, y: -1500, salt: 0x38, wave: 1 },
    // Wave bit 2 (30%) — veteran Guardians plus Unstoppable Abominations at the ledges.
    { id: 'guardian:w:3', kind: 'frostRevenant', rank: 'veteran', room: 1, x: -1400, y: -850, salt: 0x39, wave: 2 },
    { id: 'guardian:e:3', kind: 'frostRevenant', rank: 'veteran', room: 1, x: 1400, y: -850, salt: 0x3a, wave: 2 },
    { id: 'guardian:w:4', kind: 'frostRevenant', rank: 'veteran', room: 1, x: -1400, y: -150, salt: 0x3b, wave: 2 },
    { id: 'guardian:e:4', kind: 'frostRevenant', rank: 'veteran', room: 1, x: 1400, y: -150, salt: 0x3c, wave: 2 },
    { id: 'abomination:w', kind: 'brute', rank: 'veteran', room: 1, x: -450, y: -1500, salt: 0x3d, wave: 2 },
    { id: 'abomination:e', kind: 'brute', rank: 'veteran', room: 1, x: 450, y: -1500, salt: 0x3e, wave: 2 },
    // Chains of Kel'Thuzad — enthralled souls bound to the ledges, one pack per cast (bits 4 / 8 / 16).
    { id: 'chained:w:0', kind: 'wisp', rank: 'normal', room: 1, x: -1150, y: -1450, salt: 0x41, wave: 4 },
    { id: 'chained:e:0', kind: 'wisp', rank: 'normal', room: 1, x: 1150, y: -1450, salt: 0x42, wave: 4 },
    { id: 'chained:w:1', kind: 'wisp', rank: 'normal', room: 1, x: -1150, y: 300, salt: 0x43, wave: 8 },
    { id: 'chained:e:1', kind: 'wisp', rank: 'normal', room: 1, x: 1150, y: 300, salt: 0x44, wave: 8 },
    { id: 'chained:n:0', kind: 'wisp', rank: 'veteran', room: 1, x: -350, y: -1500, salt: 0x45, wave: 16 },
    { id: 'chained:n:1', kind: 'wisp', rank: 'veteran', room: 1, x: 350, y: -1500, salt: 0x46, wave: 16 },
  ],
  // Ice pillars, tombs and reliquary crystals around the crypt walls.
  dressing: ['icePillar', 'tomb', 'crystal', 'icePillar', 'sarcophagus', 'crystal', 'tomb', 'icePillar'],
  entryProps: ['icePillar', 'crystal', 'icePillar'],
  propPrefix: 'raid3-prop',
  chests: [
    { x: -190, y: -860 }, // cache of the lich, gated by surviving arena members
    { x: 190, y: -860 },
    { x: 0, y: -800 },    // boss chest — requires run.states.warden.hp <= 0
  ],
  prior: [raidEntrances, raid2Entrances],
};

export const RAID3_ARENA_CENTER = raidArenaCenter(SPEC);

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaid3Entrance. */
export function raid3ArenaFloor(seed: number, _level = 1): DungeonFloor {
  return buildArenaFloor(SPEC, seed);
}

/**
 * Naxxramas surface gate, mirroring raidEntrances/raid2Entrances: a stable
 * non-solid entrance probed onto open ground near a remote, raid-tier cell
 * distinct from both prior raids. Merge into WorldLandscape.getDungeonEntrances
 * behind GAME_FEATURES.raidBoss (or a dedicated raidBoss3 flag if the
 * integrator adds one).
 */
export function raid3Entrances(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>,
  x: number, y: number, w: number, h: number): DungeonEntrance[] {
  return raidEntrancesAt(SPEC, world, x, y, w, h);
}
