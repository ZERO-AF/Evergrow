import type { DungeonEntrance, DungeonFloor } from './dungeon.ts';
import type { WorldLandscape } from './world-landscape.ts';
import { raidEntrances } from './raid-boss-content.ts';
import { raid2Entrances } from './raid2-boss-content.ts';
import { raid3Entrances } from './raid3-boss-content.ts';
import { raid4Entrances } from './raid4-boss-content.ts';
import type { Enemy } from './model.ts';
import { isRaidBossMember, raidArenaFloor as buildArenaFloor, raidArenaCenter, raidEntrancesAt, type RaidSpec } from './raid-kit.ts';

/**
 * Fifth raid boss (docs/wow-deepening.md §15, fifth wave): Malygos, the
 * Spell-Weaver — the real WotLK Eye of Eternity fight — inside the Eye of
 * Eternity, a dedicated single-arena astral disc.
 *
 * The arena reuses the frozen dungeon plumbing end to end: DungeonRun state,
 * wave-gated member admission (`wave` bits on run.states.warden.bossPhases,
 * auto-set by updateDungeon at 50% / 25% for wilderness-boss kinds), boss
 * chest (index 2), exit portal, journey completion and save validation. The
 * integrator routes `generateDungeon` to `raid5ArenaFloor` for Eye of Eternity
 * entrances; every downstream consumer then works unchanged.
 */

export const RAID5_ENTRANCE_ID = 'dungeon:raid:eye-of-eternity';
export const RAID5_BOSS_NAME = 'Malygos';
export const RAID5_BOSS_MEMBER_ID = 'warden'; // wave gating + boss chest key off this id
export const RAID5_BOSS_KIND: Enemy['kind'] = 'warden';

export const isRaid5EntranceId = (id: string | undefined): boolean => id === RAID5_ENTRANCE_ID;
export const isRaid5Entrance = (e: Pick<DungeonEntrance, 'id'> | undefined | null): boolean => !!e && isRaid5EntranceId(e.id);
/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of an Eye of Eternity run. */
export const isRaid5Boss = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  isRaidBossMember(e, RAID5_ENTRANCE_ID, RAID5_BOSS_MEMBER_ID);
export const raid5BossName = (e: Pick<Enemy, 'campId' | 'campMemberId'>): string | undefined =>
  isRaid5Boss(e) ? RAID5_BOSS_NAME : undefined;

/** Power Spark member ids — killing one grants the stacking Power Spark damage buff. */
export const RAID5_SPARK_IDS: Readonly<Record<string, true>> = Object.freeze({
  'spark:w': true, 'spark:e': true, 'spark:n': true, 'spark:s': true, 'spark:p3:w': true, 'spark:p3:e': true,
});
export const isRaid5Spark = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  isRaid5EntranceId(e.campId) && !!e.campMemberId && RAID5_SPARK_IDS[e.campMemberId] === true;
export const MALYGOS_RULES = Object.freeze({
  /** Boss chest loot table (raid-loot-content.ts): spell weapons + trinkets. */
  lootTable: 'malygos' as const,
  phaseTwo: .5, phaseThree: .25,
  leash: 1600, awareness: 720,
  breathReach: 215, breathArc: Math.PI * 1.05,        // Arcane Breath (frontal cone)
  stormLength: 540, stormWidth: 36,                  // Arcane Storm (3 staggered arcane lanes)
  stormOffsets: [-0.5, 0, 0.5] as readonly number[],
  surgeRadius: 135,                                  // Surge of Power (detonation at the target)
  vortexRadius: 480,                                 // Vortex (arena-wide nova)
  riftRadius: 105, riftDuration: 26, riftInterval: .5, riftDps: .22, // Power Rift zones (fraction of boss damage per tick)
  riftMax: 10,
  sparkBuffDuration: 20, sparkBuffDamage: 50,        // Power Spark kill: +50% damage, stacking per spark
  drakeBuffDuration: 20, drakeBuffDamage: 75, drakeBuffSpeed: 40, // Wyrmrest Skytalon (phase 3)
  orbitRadius: 620, orbitSpeed: 300,                 // phase-3 flight: he circles the shattered disc
  enrageAfter: 420,                                  // Arcane Fury timer (seconds from engage)
  enrageDamage: 2.2, enragePulse: 1.5, enrageRadius: 620,
  allyDamageEase: .1, allyDamageEaseMax: .3,         // solo+allies scaling: -10% per ally, cap -30%
});

/**
 * Real Malygos spell names for DBM-style warnings; falls back to undefined for
 * non-raid enemies. `attackVariant === 2` on 'summon' marks the phase-3
 * platform shatter so it is not announced as a Nexus Lord wave.
 */
export function raid5BossWarningSpec(e: Pick<Enemy, 'campId' | 'campMemberId' | 'bossMove' | 'bossPhases' | 'attackVariant'>):
  { ability: string; advice: string } | undefined {
  if (!isRaid5Boss(e) || !e.bossMove) return undefined;
  switch (e.bossMove) {
    case 'sweep': return { ability: 'Arcane Breath', advice: 'move!' };
    case 'fracture': return { ability: 'Arcane Storm', advice: 'sidestep!' };
    case 'eruption': return { ability: 'Surge of Power', advice: 'move!' };
    case 'rush': return { ability: 'Surge of Power', advice: 'out of the lane!' };
    case 'command': return { ability: 'Vortex', advice: 'spread out!' };
    case 'summon': return e.attackVariant === 2
      ? { ability: 'Shatter', advice: 'the platform breaks!' }
      : { ability: 'Nexus Lords', advice: 'adds!' };
    case 'jab': return { ability: 'Arcane Burst', advice: 'move!' };
    case 'bolt': return { ability: 'Arcane Barrage', advice: 'sidestep!' };
  }
}

// ── Arena floor ──────────────────────────────────────────────────────────
// Room ids: 0 = entry antechamber, 1 = the astral disc arena. One corridor links them.
const SPEC: RaidSpec = {
  salt: 0x0e0e11,
  entranceId: RAID5_ENTRANCE_ID,
  name: 'Eye of Eternity',
  theme: 'astral',
  minZoneLevel: 20,
  arena: { x: -1500, y: -1600, width: 3000, height: 2100 },
  bossAt: { x: 0, y: -1050 }, // Malygos hovers over the disc's heart, north-center
  corridor: [{ x: 0, y: 1500 }, { x: 0, y: 420 }],
  exitY: 420,
  members: [
    // Malygos himself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID5_BOSS_MEMBER_ID, kind: RAID5_BOSS_KIND, rank: 'elite', room: 1, x: 0, y: -1050, salt: 0x0e0e },
    // Phase 2 (bit 1, 50%) — Nexus Lords on discs and Scions of Eternity, plus
    // the four Power Sparks that drift in from the disc's edge.
    { id: 'lord:w:0', kind: 'brute', rank: 'normal', room: 1, x: -1400, y: -1200, salt: 0x71, wave: 1 },
    { id: 'lord:w:1', kind: 'brute', rank: 'normal', room: 1, x: -1400, y: -500, salt: 0x72, wave: 1 },
    { id: 'lord:e:0', kind: 'brute', rank: 'normal', room: 1, x: 1400, y: -1200, salt: 0x73, wave: 1 },
    { id: 'lord:e:1', kind: 'brute', rank: 'normal', room: 1, x: 1400, y: -500, salt: 0x74, wave: 1 },
    { id: 'scion:w:0', kind: 'caster', rank: 'normal', room: 1, x: -1400, y: 150, salt: 0x75, wave: 1 },
    { id: 'scion:e:0', kind: 'caster', rank: 'normal', room: 1, x: 1400, y: 150, salt: 0x76, wave: 1 },
    { id: 'scion:n:0', kind: 'caster', rank: 'normal', room: 1, x: -700, y: -1500, salt: 0x77, wave: 1 },
    { id: 'scion:n:1', kind: 'caster', rank: 'normal', room: 1, x: 700, y: -1500, salt: 0x78, wave: 1 },
    { id: 'spark:w', kind: 'wisp', rank: 'normal', room: 1, x: -1450, y: -850, salt: 0x79, wave: 1 },
    { id: 'spark:e', kind: 'wisp', rank: 'normal', room: 1, x: 1450, y: -850, salt: 0x7a, wave: 1 },
    { id: 'spark:n', kind: 'wisp', rank: 'normal', room: 1, x: 0, y: -1550, salt: 0x7b, wave: 1 },
    { id: 'spark:s', kind: 'wisp', rank: 'normal', room: 1, x: 0, y: 350, salt: 0x7c, wave: 1 },
    // Phase 3 (bit 2, 25%) — the last of the Nexus guard: a final Power Spark pair.
    { id: 'spark:p3:w', kind: 'wisp', rank: 'veteran', room: 1, x: -1150, y: -1450, salt: 0x7d, wave: 2 },
    { id: 'spark:p3:e', kind: 'wisp', rank: 'veteran', room: 1, x: 1150, y: -1450, salt: 0x7e, wave: 2 },
  ],
  // Orreries, librams and focus crystals around the disc's rim.
  dressing: ['orrery', 'bookshelf', 'crystal', 'orrery', 'bookshelf', 'crystal', 'orrery', 'bookshelf'],
  entryProps: ['orrery', 'crystal', 'orrery'],
  propPrefix: 'raid5-prop',
  chests: [
    { x: -190, y: -860 }, // cache of the Spell-Weaver, gated by surviving arena members
    { x: 190, y: -860 },
    { x: 0, y: -800 },    // boss chest — requires run.states.warden.hp <= 0
  ],
  prior: [raidEntrances, raid2Entrances, raid3Entrances, raid4Entrances],
};

export const RAID5_ARENA_CENTER = raidArenaCenter(SPEC);

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaid5Entrance. */
export function raid5ArenaFloor(seed: number, _level = 1): DungeonFloor {
  return buildArenaFloor(SPEC, seed);
}

/**
 * Eye of Eternity surface gate, mirroring raidEntrances/…/raid4Entrances: a
 * stable non-solid entrance probed onto open ground near a remote, raid-tier
 * cell distinct from all four prior raids. Merge into
 * WorldLandscape.getDungeonEntrances behind GAME_FEATURES.raidBoss (or a
 * dedicated raidBoss5 flag if the integrator adds one).
 */
export function raid5Entrances(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>,
  x: number, y: number, w: number, h: number): DungeonEntrance[] {
  return raidEntrancesAt(SPEC, world, x, y, w, h);
}
