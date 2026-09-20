import type { DungeonEntrance, DungeonFloor, DungeonMember, DungeonProp, Room } from './dungeon.ts';
import { dungeonPassage } from './dungeon-passage.ts';
import type { WorldLandscape } from './world-landscape.ts';
import { getZoneAt } from './zone-progression.ts';
import { siteHash } from './wilderness-sites.ts';
import { GAME_FEATURES } from './game-features.ts';
import { raidEntrances } from './raid-boss-content.ts';
import { raid2Entrances } from './raid2-boss-content.ts';
import { raid3Entrances } from './raid3-boss-content.ts';
import type { Enemy } from './model.ts';

/**
 * Fourth raid boss (docs/wow-deepening.md §15, fourth wave): the Lich King —
 * the real WotLK Icecrown Citadel finale — inside Icecrown Citadel, a
 * dedicated single-arena frost throne (the 'rime' dungeon theme: ice-crowned
 * warden art, frost bolt projectiles and rime lighting all key off the floor
 * theme).
 *
 * The arena reuses the frozen dungeon plumbing end to end: DungeonRun state,
 * wave-gated member admission (`wave` bits on run.states.warden.bossPhases),
 * boss chest (index 2), exit portal, journey completion and save validation.
 * Unlike the wilderness-boss kinds, 'warden' gets no auto phase bits from
 * updateDungeon — raid4-boss.ts owns the whole bitmask: bits 1/2 gate the
 * Drudge Ghoul / Val'kyr waves at 70% / 40% (the real phase thresholds), bits
 * 4/8/16 gate the three Summon Vile Spirits packs. The integrator routes
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
  e.campMemberId === RAID4_BOSS_MEMBER_ID && isRaid4EntranceId(e.campId);
export const raid4BossName = (e: Pick<Enemy, 'campId' | 'campMemberId'>): string | undefined =>
  isRaid4Boss(e) ? RAID4_BOSS_NAME : undefined;

/** Fight rules. Phase bits 1/2 match the 70% / 40% transition thresholds; bits 4/8/16 are the Vile Spirit packs. */
export const LICHKING_RULES = Object.freeze({
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
const ARENA = { x: -1500, y: -1600, width: 3000, height: 2100 } as const;
const ENTRY = { x: -288, y: 1244, width: 576, height: 512 } as const;
const BOSS_AT = { x: 0, y: -1050 } as const; // the Frozen Throne, north-center
export const RAID4_ARENA_CENTER = Object.freeze({ x: ARENA.x + ARENA.width / 2, y: ARENA.y + ARENA.height / 2 });

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaid4Entrance. */
export function raid4ArenaFloor(seed: number, _level = 1): DungeonFloor {
  const rooms: Room[] = [
    { id: 0, kind: 'entry', shape: 'hall', ...ENTRY },
    { id: 1, kind: 'boss', shape: 'octagon', ...ARENA },
  ];
  const corridors: Room[] = [dungeonPassage([{ x: 0, y: 1500 }, { x: 0, y: 420 }], 150, 0)];
  const members: DungeonMember[] = [
    // The Lich King himself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID4_BOSS_MEMBER_ID, kind: RAID4_BOSS_KIND, rank: 'elite', room: 1, x: BOSS_AT.x, y: BOSS_AT.y, seed: (seed ^ 0x1cec) >>> 0 },
    // Drudge Ghouls — wave bit 1 (70%), shambling in from the throne rim.
    { id: 'ghoul:w:0', kind: 'stalker', rank: 'normal', room: 1, x: -1400, y: -1200, seed: (seed ^ 0x51) >>> 0, wave: 1 },
    { id: 'ghoul:w:1', kind: 'stalker', rank: 'normal', room: 1, x: -1400, y: -500, seed: (seed ^ 0x52) >>> 0, wave: 1 },
    { id: 'ghoul:w:2', kind: 'stalker', rank: 'normal', room: 1, x: -1400, y: 150, seed: (seed ^ 0x53) >>> 0, wave: 1 },
    { id: 'ghoul:e:0', kind: 'stalker', rank: 'normal', room: 1, x: 1400, y: -1200, seed: (seed ^ 0x54) >>> 0, wave: 1 },
    { id: 'ghoul:e:1', kind: 'stalker', rank: 'normal', room: 1, x: 1400, y: -500, seed: (seed ^ 0x55) >>> 0, wave: 1 },
    { id: 'ghoul:e:2', kind: 'stalker', rank: 'normal', room: 1, x: 1400, y: 150, seed: (seed ^ 0x56) >>> 0, wave: 1 },
    { id: 'ghoul:n:0', kind: 'stalker', rank: 'normal', room: 1, x: -700, y: -1500, seed: (seed ^ 0x57) >>> 0, wave: 1 },
    { id: 'ghoul:n:1', kind: 'stalker', rank: 'normal', room: 1, x: 700, y: -1500, seed: (seed ^ 0x58) >>> 0, wave: 1 },
    // Wave bit 2 (40%) — Val'kyr Shadowguards plus Shambling Horrors at the ledges.
    { id: 'valkyr:w:0', kind: 'wisp', rank: 'veteran', room: 1, x: -1400, y: -850, seed: (seed ^ 0x59) >>> 0, wave: 2 },
    { id: 'valkyr:e:0', kind: 'wisp', rank: 'veteran', room: 1, x: 1400, y: -850, seed: (seed ^ 0x5a) >>> 0, wave: 2 },
    { id: 'valkyr:w:1', kind: 'wisp', rank: 'veteran', room: 1, x: -1400, y: -150, seed: (seed ^ 0x5b) >>> 0, wave: 2 },
    { id: 'valkyr:e:1', kind: 'wisp', rank: 'veteran', room: 1, x: 1400, y: -150, seed: (seed ^ 0x5c) >>> 0, wave: 2 },
    { id: 'horror:w', kind: 'brute', rank: 'veteran', room: 1, x: -450, y: -1500, seed: (seed ^ 0x5d) >>> 0, wave: 2 },
    { id: 'horror:e', kind: 'brute', rank: 'veteran', room: 1, x: 450, y: -1500, seed: (seed ^ 0x5e) >>> 0, wave: 2 },
    // Summon Vile Spirits — bound souls rising around the throne, one pack per cast (bits 4 / 8 / 16).
    { id: 'vile:w:0', kind: 'wisp', rank: 'normal', room: 1, x: -1150, y: -1450, seed: (seed ^ 0x61) >>> 0, wave: 4 },
    { id: 'vile:e:0', kind: 'wisp', rank: 'normal', room: 1, x: 1150, y: -1450, seed: (seed ^ 0x62) >>> 0, wave: 4 },
    { id: 'vile:w:1', kind: 'wisp', rank: 'normal', room: 1, x: -1150, y: 300, seed: (seed ^ 0x63) >>> 0, wave: 8 },
    { id: 'vile:e:1', kind: 'wisp', rank: 'normal', room: 1, x: 1150, y: 300, seed: (seed ^ 0x64) >>> 0, wave: 8 },
    { id: 'vile:n:0', kind: 'wisp', rank: 'veteran', room: 1, x: -350, y: -1500, seed: (seed ^ 0x65) >>> 0, wave: 16 },
    { id: 'vile:n:1', kind: 'wisp', rank: 'veteran', room: 1, x: 350, y: -1500, seed: (seed ^ 0x66) >>> 0, wave: 16 },
  ];
  const props: DungeonProp[] = [];
  // Ice pillars, tombs and reliquary crystals around the throne walls; the center stays clear for the fight.
  const dressing: DungeonProp['kind'][] = ['icePillar', 'tomb', 'crystal', 'icePillar', 'sarcophagus', 'crystal', 'tomb', 'icePillar'];
  for (let i = 0; i < 8; i++) {
    const x = ARENA.x + ARENA.width * (i % 2 ? .86 : .14), y = ARENA.y + ARENA.height * (.16 + Math.floor(i / 2) * .22);
    props.push({ id: `raid4-prop:${i}`, x, y, kind: dressing[i], seed: (seed + i * 137) >>> 0 });
  }
  for (let i = 0; i < 3; i++)
    props.push({ id: `raid4-prop:entry:${i}`, x: ENTRY.x + ENTRY.width * (.2 + i * .3), y: ENTRY.y + 90, kind: i === 1 ? 'crystal' : 'icePillar', seed: (seed + 900 + i) >>> 0 });
  const floor: DungeonFloor = {
    theme: 'rime', seed, rooms, edges: [[0, 1]], corridors, members,
    entry: { x: 0, y: ENTRY.y + ENTRY.height / 2 },
    exit: { x: 0, y: 420 },
    chests: [
      { x: -190, y: -860, room: 1 }, // cache of the Frozen Throne, gated by surviving arena members
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
const RAID4_MIN_ZONE_LEVEL = 18;
const gateCache = new Map<number, { x: number; y: number } | null>();
function raid4GatePoint(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>): { x: number; y: number } | null {
  const cached = gateCache.get(world.seed);
  if (cached !== undefined) return cached;
  let point: { x: number; y: number } | null = null;
  // Spiral outward through wilderness cells; the nearest high-tier cell without another raid gate wins.
  for (let ring = 9; ring <= 64 && !point; ring++)
    for (let cy = -ring; cy <= ring && !point; cy++)
      for (let cx = -ring; cx <= ring && !point; cx++) {
        if (Math.max(Math.abs(cx), Math.abs(cy)) !== ring) continue;
        const seed = siteHash(cx, cy, world.seed, 0x1cec04);
        const x = (cx + .5) * 1400 + ((seed >>> 8) % 900 - 450), y = (cy + .5) * 1400 + ((seed >>> 20) % 900 - 450);
        if (getZoneAt(x, y, world.seed).originalLevel < RAID4_MIN_ZONE_LEVEL) continue;
        // Never share a cell with Onyxia's Lair, the Molten Core or Naxxramas: probe whether any gate lands inside this cell's bounds.
        if (raidEntrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid2Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid3Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        point = { x, y };
      }
  gateCache.set(world.seed, point);
  if (gateCache.size > 8) gateCache.delete(gateCache.keys().next().value!);
  return point;
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
  if (!GAME_FEATURES.raidBoss || ![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 100000 || h > 100000)
    return [];
  const anchor = raid4GatePoint(world);
  if (!anchor) return [];
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, px = anchor.x + Math.cos(a) * (i < 8 ? 60 : 140), py = anchor.y + Math.sin(a) * (i < 8 ? 60 : 140);
    if (px < x || py < y || px >= x + w || py >= y + h) continue;
    if (world.blocked(px, py, 40) || world.isSanctuary(px, py)) continue;
    const zone = getZoneAt(px, py, world.seed);
    return [{ id: RAID4_ENTRANCE_ID, name: 'Icecrown Citadel', theme: 'rime', x: px, y: py,
      seed: (world.seed ^ 0x1cec04) >>> 0, level: Math.min(1e6, zone.maxLevel), biome: world.sampleBiome(px, py).id }];
  }
  return [];
}
