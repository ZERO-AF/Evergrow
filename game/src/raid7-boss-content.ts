import type { DungeonEntrance, DungeonFloor, DungeonMember, DungeonProp, Room } from './dungeon.ts';
import { dungeonPassage } from './dungeon-passage.ts';
import type { WorldLandscape } from './world-landscape.ts';
import { getZoneAt } from './zone-progression.ts';
import { siteHash } from './wilderness-sites.ts';
import { GAME_FEATURES } from './game-features.ts';
import { raidEntrances } from './raid-boss-content.ts';
import { raid2Entrances } from './raid2-boss-content.ts';
import { raid3Entrances } from './raid3-boss-content.ts';
import { raid4Entrances } from './raid4-boss-content.ts';
import { raid5Entrances } from './raid5-boss-content.ts';
import { raid6Entrances } from './raid6-boss-content.ts';
import type { Enemy } from './model.ts';

/**
 * Seventh raid boss (docs/wow-deepening.md §15, seventh wave): Yogg-Saron, the
 * God of Death — the real WotLK Ulduar finale — inside Ulduar's final chamber,
 * a dedicated single-arena titan vault (the 'astral' dungeon theme:
 * orrery/bookshelf dressing and arcane lighting key off the floor theme).
 *
 * The arena reuses the frozen dungeon plumbing end to end: DungeonRun state,
 * wave-gated member admission (`wave` bits on run.states.warden.bossPhases),
 * boss chest (index 2), exit portal, journey completion and save validation.
 * 'warden' gets no auto phase bits from updateDungeon — raid7-boss.ts owns the
 * whole bitmask: bit 1 gates the Guardians of Yogg-Saron / Corruptor Tentacle
 * wave at 60% (the Sara phase breaking), bit 2 gates the Immortal Guardians /
 * Crusher Tentacles at 30% (the descent into madness). The integrator routes
 * `generateDungeon` to `raid7ArenaFloor` for Ulduar entrances; every
 * downstream consumer then works unchanged.
 */

export const RAID7_ENTRANCE_ID = 'dungeon:raid:ulduar';
export const RAID7_BOSS_NAME = 'Yogg-Saron';
export const RAID7_BOSS_MEMBER_ID = 'warden'; // wave gating + boss chest key off this id
export const RAID7_BOSS_KIND: Enemy['kind'] = 'warden';

export const isRaid7EntranceId = (id: string | undefined): boolean => id === RAID7_ENTRANCE_ID;
export const isRaid7Entrance = (e: Pick<DungeonEntrance, 'id'> | undefined | null): boolean => !!e && isRaid7EntranceId(e.id);
/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of an Ulduar run. */
export const isRaid7Boss = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  e.campMemberId === RAID7_BOSS_MEMBER_ID && isRaid7EntranceId(e.campId);
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
const ARENA = { x: -1500, y: -1600, width: 3000, height: 2100 } as const;
const ENTRY = { x: -288, y: 1244, width: 576, height: 512 } as const;
const BOSS_AT = { x: 0, y: -1050 } as const; // Yogg-Saron waits in the prison's heart, north-center
export const RAID7_ARENA_CENTER = Object.freeze({ x: ARENA.x + ARENA.width / 2, y: ARENA.y + ARENA.height / 2 });

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaid7Entrance. */
export function raid7ArenaFloor(seed: number, _level = 1): DungeonFloor {
  const rooms: Room[] = [
    { id: 0, kind: 'entry', shape: 'hall', ...ENTRY },
    { id: 1, kind: 'boss', shape: 'octagon', ...ARENA },
  ];
  const corridors: Room[] = [dungeonPassage([{ x: 0, y: 1500 }, { x: 0, y: 420 }], 150, 0)];
  const members: DungeonMember[] = [
    // Yogg-Saron himself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID7_BOSS_MEMBER_ID, kind: RAID7_BOSS_KIND, rank: 'elite', room: 1, x: BOSS_AT.x, y: BOSS_AT.y, seed: (seed ^ 0x0d0a) >>> 0 },
    // Phase 2 (bit 1, 60%) — Guardians of Yogg-Saron rise from the prison rim
    // alongside Corruptor Tentacles (casters standing in for the appendages).
    { id: 'guardian:w:0', kind: 'brute', rank: 'normal', room: 1, x: -1400, y: -1200, seed: (seed ^ 0x91) >>> 0, wave: 1 },
    { id: 'guardian:w:1', kind: 'brute', rank: 'normal', room: 1, x: -1400, y: -500, seed: (seed ^ 0x92) >>> 0, wave: 1 },
    { id: 'guardian:e:0', kind: 'brute', rank: 'normal', room: 1, x: 1400, y: -1200, seed: (seed ^ 0x93) >>> 0, wave: 1 },
    { id: 'guardian:e:1', kind: 'brute', rank: 'normal', room: 1, x: 1400, y: -500, seed: (seed ^ 0x94) >>> 0, wave: 1 },
    { id: 'tentacle:w:0', kind: 'caster', rank: 'normal', room: 1, x: -1400, y: 150, seed: (seed ^ 0x95) >>> 0, wave: 1 },
    { id: 'tentacle:e:0', kind: 'caster', rank: 'normal', room: 1, x: 1400, y: 150, seed: (seed ^ 0x96) >>> 0, wave: 1 },
    { id: 'tentacle:n:0', kind: 'caster', rank: 'normal', room: 1, x: -700, y: -1500, seed: (seed ^ 0x97) >>> 0, wave: 1 },
    { id: 'tentacle:n:1', kind: 'caster', rank: 'normal', room: 1, x: 700, y: -1500, seed: (seed ^ 0x98) >>> 0, wave: 1 },
    // Phase 3 (bit 2, 30%) — Immortal Guardians at the ledges plus Crusher
    // Tentacles: the descent into madness.
    { id: 'immortal:w', kind: 'brute', rank: 'veteran', room: 1, x: -450, y: -1500, seed: (seed ^ 0x99) >>> 0, wave: 2 },
    { id: 'immortal:e', kind: 'brute', rank: 'veteran', room: 1, x: 450, y: -1500, seed: (seed ^ 0x9a) >>> 0, wave: 2 },
    { id: 'crusher:w', kind: 'stalker', rank: 'veteran', room: 1, x: -1400, y: -850, seed: (seed ^ 0x9b) >>> 0, wave: 2 },
    { id: 'crusher:e', kind: 'stalker', rank: 'veteran', room: 1, x: 1400, y: -850, seed: (seed ^ 0x9c) >>> 0, wave: 2 },
  ];
  const props: DungeonProp[] = [];
  // Titan orreries, librams and focus crystals around the prison walls; the center stays clear for the fight.
  const dressing: DungeonProp['kind'][] = ['orrery', 'bookshelf', 'crystal', 'orrery', 'bookshelf', 'crystal', 'orrery', 'bookshelf'];
  for (let i = 0; i < 8; i++) {
    const x = ARENA.x + ARENA.width * (i % 2 ? .86 : .14), y = ARENA.y + ARENA.height * (.16 + Math.floor(i / 2) * .22);
    props.push({ id: `raid7-prop:${i}`, x, y, kind: dressing[i], seed: (seed + i * 137) >>> 0 });
  }
  for (let i = 0; i < 3; i++)
    props.push({ id: `raid7-prop:entry:${i}`, x: ENTRY.x + ENTRY.width * (.2 + i * .3), y: ENTRY.y + 90, kind: i === 1 ? 'crystal' : 'orrery', seed: (seed + 900 + i) >>> 0 });
  const floor: DungeonFloor = {
    theme: 'astral', seed, rooms, edges: [[0, 1]], corridors, members,
    entry: { x: 0, y: ENTRY.y + ENTRY.height / 2 },
    exit: { x: 0, y: 420 },
    chests: [
      { x: -190, y: -860, room: 1 }, // cache of the God of Death, gated by surviving arena members
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
/** One deterministic remote gate per world seed: the first far raid-tier cell that holds no other raid gate. */
const RAID7_MIN_ZONE_LEVEL = 22;
const gateCache = new Map<number, { x: number; y: number } | null>();
function raid7GatePoint(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>): { x: number; y: number } | null {
  const cached = gateCache.get(world.seed);
  if (cached !== undefined) return cached;
  let point: { x: number; y: number } | null = null;
  // Spiral outward through wilderness cells; the nearest high-tier cell without another raid gate wins.
  for (let ring = 9; ring <= 64 && !point; ring++)
    for (let cy = -ring; cy <= ring && !point; cy++)
      for (let cx = -ring; cx <= ring && !point; cx++) {
        if (Math.max(Math.abs(cx), Math.abs(cy)) !== ring) continue;
        const seed = siteHash(cx, cy, world.seed, 0x0d0a17);
        const x = (cx + .5) * 1400 + ((seed >>> 8) % 900 - 450), y = (cy + .5) * 1400 + ((seed >>> 20) % 900 - 450);
        if (getZoneAt(x, y, world.seed).originalLevel < RAID7_MIN_ZONE_LEVEL) continue;
        // Never share a cell with the six prior raid gates: probe whether any lands inside this cell's bounds.
        if (raidEntrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid2Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid3Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid4Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid5Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid6Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        point = { x, y };
      }
  gateCache.set(world.seed, point);
  if (gateCache.size > 8) gateCache.delete(gateCache.keys().next().value!);
  return point;
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
  if (!GAME_FEATURES.raidBoss || ![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 100000 || h > 100000)
    return [];
  const anchor = raid7GatePoint(world);
  if (!anchor) return [];
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, px = anchor.x + Math.cos(a) * (i < 8 ? 60 : 140), py = anchor.y + Math.sin(a) * (i < 8 ? 60 : 140);
    if (px < x || py < y || px >= x + w || py >= y + h) continue;
    if (world.blocked(px, py, 40) || world.isSanctuary(px, py)) continue;
    const zone = getZoneAt(px, py, world.seed);
    return [{ id: RAID7_ENTRANCE_ID, name: 'Ulduar', theme: 'astral', x: px, y: py,
      seed: (world.seed ^ 0x0d0a17) >>> 0, level: Math.min(1e6, zone.maxLevel), biome: world.sampleBiome(px, py).id }];
  }
  return [];
}
