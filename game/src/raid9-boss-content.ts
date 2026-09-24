import type { DungeonEntrance, DungeonFloor } from './dungeon.ts';
import type { WorldLandscape } from './world-landscape.ts';
import { raidEntrances } from './raid-boss-content.ts';
import { raid2Entrances } from './raid2-boss-content.ts';
import { raid3Entrances } from './raid3-boss-content.ts';
import { raid4Entrances } from './raid4-boss-content.ts';
import { raid5Entrances } from './raid5-boss-content.ts';
import { raid6Entrances } from './raid6-boss-content.ts';
import { raid7Entrances } from './raid7-boss-content.ts';
import { raid8Entrances } from './raid8-boss-content.ts';
import { isRaidBossMember, raidArenaFloor as buildArenaFloor, raidArenaCenter, raidEntrancesAt, type RaidSpec } from './raid-kit.ts';
import type { Enemy } from './model.ts';

/**
 * Ninth raid boss (docs/wow-deepening.md §15, ninth wave): Halion the Twilight
 * Destroyer — the real WotLK Ruby Sanctum fight — inside the Ruby Sanctum, a
 * dedicated single-arena twilight forge beneath Wyrmrest (the 'foundry'
 * dungeon theme: basalt galleries, cold anvils and still-burning furnaces key
 * off the floor theme).
 *
 * The arena reuses the frozen dungeon plumbing end to end: DungeonRun state,
 * wave-gated member admission (`wave` bits on run.states.warden.bossPhases),
 * boss chest (index 2), exit portal, journey completion and save validation.
 * 'warden' gets no auto phase bits from updateDungeon — raid9-boss.ts owns the
 * whole bitmask: bit 1 gates the Twilight Whelp / Living Ember wave at 75%
 * (the twilight realm bleeding through), bit 2 gates the Twilight Scalebearer
 * wave at 50% (the corporeality split).
 *
 * The dual-realm fight is approximated inside one arena: below 50% Halion's
 * corporeality splits — Flame Breath becomes Dark Breath and Fiery Combustion
 * becomes Soul Consumption (shadow instead of fire), while the Twilight
 * Cutter beam keeps sweeping the platform.
 */

export const RAID9_ENTRANCE_ID = 'dungeon:raid:ruby-sanctum';
export const RAID9_BOSS_NAME = 'Halion';
export const RAID9_BOSS_MEMBER_ID = 'warden'; // wave gating + boss chest key off this id
export const RAID9_BOSS_KIND: Enemy['kind'] = 'warden';

export const isRaid9EntranceId = (id: string | undefined): boolean => id === RAID9_ENTRANCE_ID;
export const isRaid9Entrance = (e: Pick<DungeonEntrance, 'id'> | undefined | null): boolean => !!e && isRaid9EntranceId(e.id);
/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of a Ruby Sanctum run. */
export const isRaid9Boss = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  isRaidBossMember(e, RAID9_ENTRANCE_ID, RAID9_BOSS_MEMBER_ID);
export const raid9BossName = (e: Pick<Enemy, 'campId' | 'campMemberId'>): string | undefined =>
  isRaid9Boss(e) ? RAID9_BOSS_NAME : undefined;
/** Fight rules. Phase bits 1/2 match the 75% / 50% add-wave thresholds. */
export const HALION_RULES = Object.freeze({
  /** Boss chest loot table (raid-loot-content.ts): the Twilight Destroyer's scales + jewelry. */
  lootTable: 'halion' as const,
  phaseTwo: .75, phaseThree: .5,
  leash: 1600, awareness: 720,
  breathReach: 215, breathArc: Math.PI * 1.05,        // Flame Breath / Dark Breath (frontal cone)
  meteorRadius: 150,                                 // Meteor Strike (delayed detonation at the target)
  cutterLength: 780, cutterWidth: 46,                // Twilight Cutter (beam sweeping through the arena heart)
  cutterSpeed: 1.15,                                 // beam rotation, radians per second
  zoneRadius: 115, zoneDuration: 24, zoneInterval: .5, zoneDps: .22, // combustion/consumption void zones (fraction of boss damage per tick)
  zoneMax: 10,
  markDuration: 5,                                   // Fiery Combustion / Soul Consumption: debuff expiry drops the zone
  enrageAfter: 480,                                  // Twilight Fury timer (seconds from engage)
  enrageDamage: 2.2, enragePulse: 1.5, enrageRadius: 620,
  allyDamageEase: .1, allyDamageEaseMax: .3,         // solo+allies scaling: -10% per ally, cap -30%
});

/**
 * Real Halion spell names for DBM-style warnings; falls back to undefined for
 * non-raid enemies. `attackVariant === 1` marks the twilight-realm shadow
 * versions — Dark Breath and Soul Consumption — committed once his
 * corporeality splits at 50%.
 */
export function raid9BossWarningSpec(e: Pick<Enemy, 'campId' | 'campMemberId' | 'bossMove' | 'bossPhases' | 'attackVariant'>):
  { ability: string; advice: string } | undefined {
  if (!isRaid9Boss(e) || !e.bossMove) return undefined;
  switch (e.bossMove) {
    case 'sweep': return e.attackVariant === 1
      ? { ability: 'Dark Breath', advice: 'move!' }
      : { ability: 'Flame Breath', advice: 'move!' };
    case 'fracture': return { ability: 'Twilight Cutter', advice: 'off the beam!' };
    case 'eruption': return { ability: 'Meteor Strike', advice: 'move!' };
    case 'rush': return { ability: 'Meteor Strike', advice: 'out of the lane!' };
    case 'command': return e.attackVariant === 1
      ? { ability: 'Soul Consumption', advice: 'get out — you drop a void zone!' }
      : { ability: 'Fiery Combustion', advice: 'get out — you drop a void zone!' };
    case 'summon': return (e.bossPhases ?? 0) & 2
      ? { ability: 'Twilight Scalebearers', advice: 'adds!' }
      : { ability: 'Twilight Whelps', advice: 'adds!' };
    case 'jab': return { ability: 'Tail Lash', advice: 'move!' };
    case 'bolt': return { ability: 'Twilight Bolt', advice: 'sidestep!' };
  }
}

// ── Arena floor ──────────────────────────────────────────────────────────
// Room ids: 0 = entry antechamber, 1 = the twilight forge arena. One corridor links them.
const SPEC: RaidSpec = {
  salt: 0x0b9d11,
  entranceId: RAID9_ENTRANCE_ID,
  name: 'Ruby Sanctum',
  theme: 'foundry',
  minZoneLevel: 20,
  arena: { x: -1500, y: -1600, width: 3000, height: 2100 },
  bossAt: { x: 0, y: -1050 }, // Halion holds the forge heart, north-center
  corridor: [{ x: 0, y: 1500 }, { x: 0, y: 420 }],
  exitY: 420,
  members: [
    // Halion himself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID9_BOSS_MEMBER_ID, kind: RAID9_BOSS_KIND, rank: 'elite', room: 1, x: 0, y: -1050, salt: 0x0b9d },
    // Phase 2 (bit 1, 75%) — the twilight realm bleeds through: Twilight
    // Whelps swarm the rim while Living Embers rise from the forge floor.
    { id: 'twhelp:w:0', kind: 'stalker', rank: 'normal', room: 1, x: -1400, y: -1200, salt: 0x91, wave: 1 },
    { id: 'twhelp:w:1', kind: 'stalker', rank: 'normal', room: 1, x: -1400, y: -500, salt: 0x92, wave: 1 },
    { id: 'twhelp:e:0', kind: 'stalker', rank: 'normal', room: 1, x: 1400, y: -1200, salt: 0x93, wave: 1 },
    { id: 'twhelp:e:1', kind: 'stalker', rank: 'normal', room: 1, x: 1400, y: -500, salt: 0x94, wave: 1 },
    { id: 'ember:w', kind: 'emberAcolyte', rank: 'normal', room: 1, x: -700, y: -1500, salt: 0x95, wave: 1 },
    { id: 'ember:e', kind: 'emberAcolyte', rank: 'normal', room: 1, x: 700, y: -1500, salt: 0x96, wave: 1 },
    // Phase 3 (bit 2, 50%) — the corporeality split: Twilight Scalebearers
    // land at the ledges with a veteran ember pair.
    { id: 'scale:w', kind: 'brute', rank: 'veteran', room: 1, x: -450, y: -1500, salt: 0x97, wave: 2 },
    { id: 'scale:e', kind: 'brute', rank: 'veteran', room: 1, x: 450, y: -1500, salt: 0x98, wave: 2 },
    { id: 'ember:w:2', kind: 'emberAcolyte', rank: 'veteran', room: 1, x: -1400, y: -850, salt: 0x99, wave: 2 },
    { id: 'ember:e:2', kind: 'emberAcolyte', rank: 'veteran', room: 1, x: 1400, y: -850, salt: 0x9a, wave: 2 },
  ],
  // Furnaces, anvils and twilight crystals around the sanctum walls; the center stays clear for the fight.
  dressing: ['furnace', 'anvil', 'crystal', 'furnace', 'pool', 'anvil', 'crystal', 'furnace'],
  entryProps: ['furnace', 'crystal', 'furnace'],
  propPrefix: 'raid9-prop',
  chests: [
    { x: -190, y: -860 }, // cache of the Twilight Destroyer, gated by surviving arena members
    { x: 190, y: -860 },
    { x: 0, y: -800 },    // boss chest — requires run.states.warden.hp <= 0
  ],
  prior: [raidEntrances, raid2Entrances, raid3Entrances, raid4Entrances, raid5Entrances, raid6Entrances, raid7Entrances, raid8Entrances],
};

export const RAID9_ARENA_CENTER = raidArenaCenter(SPEC);

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaid9Entrance. */
export function raid9ArenaFloor(seed: number, _level = 1): DungeonFloor {
  return buildArenaFloor(SPEC, seed);
}

/**
 * Ruby Sanctum surface gate, mirroring raidEntrances/…/raid8Entrances: a
 * stable non-solid entrance probed onto open ground near a remote, raid-tier
 * cell distinct from all eight prior raids. Merge into
 * WorldLandscape.getDungeonEntrances behind GAME_FEATURES.raidBoss (or a
 * dedicated raidBoss9 flag if the integrator adds one).
 */
export function raid9Entrances(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>,
  x: number, y: number, w: number, h: number): DungeonEntrance[] {
  return raidEntrancesAt(SPEC, world, x, y, w, h);
}
