import type { DungeonEntrance, DungeonFloor, DungeonMember, DungeonProp, Room } from './dungeon.ts';
import { dungeonPassage } from './dungeon-passage.ts';
import type { WorldLandscape } from './world-landscape.ts';
import { getZoneAt } from './zone-progression.ts';
import { siteHash } from './wilderness-sites.ts';
import { GAME_FEATURES } from './game-features.ts';
import { raidEntrances } from './raid-boss-content.ts';
import { raid2Entrances } from './raid2-boss-content.ts';
import type { Enemy } from './model.ts';

/**
 * Third raid boss (docs/wow-deepening.md §15, third wave): Kel'Thuzad — the
 * real WotLK Naxxramas finale — inside Naxxramas, a dedicated single-arena
 * frost crypt (the 'rime' dungeon theme: ice-crowned warden art, frost bolt
 * projectiles and rime lighting all key off the floor theme).
 *
 * The arena reuses the frozen dungeon plumbing end to end: DungeonRun state,
 * wave-gated member admission (`wave` bits on run.states.warden.bossPhases),
 * boss chest (index 2), exit portal, journey completion and save validation.
 * Unlike the wilderness-boss kinds, 'warden' gets no auto phase bits from
 * updateDungeon — raid3-boss.ts owns the whole bitmask: bits 1/2 gate the
 * Guardian of Icecrown waves at 65% / 30%, bits 4/8/16 gate the three Chains
 * of Kel'Thuzad soul packs. The integrator routes `generateDungeon` to
 * `raid3ArenaFloor` for Naxxramas entrances; every downstream consumer then
 * works unchanged.
 */

export const RAID3_ENTRANCE_ID = 'dungeon:raid:naxxramas';
export const RAID3_BOSS_NAME = 'Kel\'Thuzad';
export const RAID3_BOSS_MEMBER_ID = 'warden'; // wave gating + boss chest key off this id
export const RAID3_BOSS_KIND: Enemy['kind'] = 'warden';

export const isRaid3EntranceId = (id: string | undefined): boolean => id === RAID3_ENTRANCE_ID;
export const isRaid3Entrance = (e: Pick<DungeonEntrance, 'id'> | undefined | null): boolean => !!e && isRaid3EntranceId(e.id);
/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of a Naxxramas run. */
export const isRaid3Boss = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  e.campMemberId === RAID3_BOSS_MEMBER_ID && isRaid3EntranceId(e.campId);
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
const ARENA = { x: -1500, y: -1600, width: 3000, height: 2100 } as const;
const ENTRY = { x: -288, y: 1244, width: 576, height: 512 } as const;
const BOSS_AT = { x: 0, y: -1050 } as const; // Kel'Thuzad's dais, north-center
export const RAID3_ARENA_CENTER = Object.freeze({ x: ARENA.x + ARENA.width / 2, y: ARENA.y + ARENA.height / 2 });

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaid3Entrance. */
export function raid3ArenaFloor(seed: number, _level = 1): DungeonFloor {
  const rooms: Room[] = [
    { id: 0, kind: 'entry', shape: 'hall', ...ENTRY },
    { id: 1, kind: 'boss', shape: 'octagon', ...ARENA },
  ];
  const corridors: Room[] = [dungeonPassage([{ x: 0, y: 1500 }, { x: 0, y: 420 }], 150, 0)];
  const members: DungeonMember[] = [
    // Kel'Thuzad himself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID3_BOSS_MEMBER_ID, kind: RAID3_BOSS_KIND, rank: 'elite', room: 1, x: BOSS_AT.x, y: BOSS_AT.y, seed: (seed ^ 0x0f40) >>> 0 },
    // Guardians of Icecrown — wave bit 1 (65%), stalking in from the crypt rim.
    { id: 'guardian:w:0', kind: 'frostRevenant', rank: 'normal', room: 1, x: -1400, y: -1200, seed: (seed ^ 0x31) >>> 0, wave: 1 },
    { id: 'guardian:w:1', kind: 'frostRevenant', rank: 'normal', room: 1, x: -1400, y: -500, seed: (seed ^ 0x32) >>> 0, wave: 1 },
    { id: 'guardian:w:2', kind: 'frostRevenant', rank: 'normal', room: 1, x: -1400, y: 150, seed: (seed ^ 0x33) >>> 0, wave: 1 },
    { id: 'guardian:e:0', kind: 'frostRevenant', rank: 'normal', room: 1, x: 1400, y: -1200, seed: (seed ^ 0x34) >>> 0, wave: 1 },
    { id: 'guardian:e:1', kind: 'frostRevenant', rank: 'normal', room: 1, x: 1400, y: -500, seed: (seed ^ 0x35) >>> 0, wave: 1 },
    { id: 'guardian:e:2', kind: 'frostRevenant', rank: 'normal', room: 1, x: 1400, y: 150, seed: (seed ^ 0x36) >>> 0, wave: 1 },
    { id: 'guardian:n:0', kind: 'frostRevenant', rank: 'normal', room: 1, x: -700, y: -1500, seed: (seed ^ 0x37) >>> 0, wave: 1 },
    { id: 'guardian:n:1', kind: 'frostRevenant', rank: 'normal', room: 1, x: 700, y: -1500, seed: (seed ^ 0x38) >>> 0, wave: 1 },
    // Wave bit 2 (30%) — veteran Guardians plus Unstoppable Abominations at the ledges.
    { id: 'guardian:w:3', kind: 'frostRevenant', rank: 'veteran', room: 1, x: -1400, y: -850, seed: (seed ^ 0x39) >>> 0, wave: 2 },
    { id: 'guardian:e:3', kind: 'frostRevenant', rank: 'veteran', room: 1, x: 1400, y: -850, seed: (seed ^ 0x3a) >>> 0, wave: 2 },
    { id: 'guardian:w:4', kind: 'frostRevenant', rank: 'veteran', room: 1, x: -1400, y: -150, seed: (seed ^ 0x3b) >>> 0, wave: 2 },
    { id: 'guardian:e:4', kind: 'frostRevenant', rank: 'veteran', room: 1, x: 1400, y: -150, seed: (seed ^ 0x3c) >>> 0, wave: 2 },
    { id: 'abomination:w', kind: 'brute', rank: 'veteran', room: 1, x: -450, y: -1500, seed: (seed ^ 0x3d) >>> 0, wave: 2 },
    { id: 'abomination:e', kind: 'brute', rank: 'veteran', room: 1, x: 450, y: -1500, seed: (seed ^ 0x3e) >>> 0, wave: 2 },
    // Chains of Kel'Thuzad — enthralled souls bound to the ledges, one pack per cast (bits 4 / 8 / 16).
    { id: 'chained:w:0', kind: 'wisp', rank: 'normal', room: 1, x: -1150, y: -1450, seed: (seed ^ 0x41) >>> 0, wave: 4 },
    { id: 'chained:e:0', kind: 'wisp', rank: 'normal', room: 1, x: 1150, y: -1450, seed: (seed ^ 0x42) >>> 0, wave: 4 },
    { id: 'chained:w:1', kind: 'wisp', rank: 'normal', room: 1, x: -1150, y: 300, seed: (seed ^ 0x43) >>> 0, wave: 8 },
    { id: 'chained:e:1', kind: 'wisp', rank: 'normal', room: 1, x: 1150, y: 300, seed: (seed ^ 0x44) >>> 0, wave: 8 },
    { id: 'chained:n:0', kind: 'wisp', rank: 'veteran', room: 1, x: -350, y: -1500, seed: (seed ^ 0x45) >>> 0, wave: 16 },
    { id: 'chained:n:1', kind: 'wisp', rank: 'veteran', room: 1, x: 350, y: -1500, seed: (seed ^ 0x46) >>> 0, wave: 16 },
  ];
  const props: DungeonProp[] = [];
  // Ice pillars, tombs and reliquary crystals around the crypt walls; the center stays clear for the fight.
  const dressing: DungeonProp['kind'][] = ['icePillar', 'tomb', 'crystal', 'icePillar', 'sarcophagus', 'crystal', 'tomb', 'icePillar'];
  for (let i = 0; i < 8; i++) {
    const x = ARENA.x + ARENA.width * (i % 2 ? .86 : .14), y = ARENA.y + ARENA.height * (.16 + Math.floor(i / 2) * .22);
    props.push({ id: `raid3-prop:${i}`, x, y, kind: dressing[i], seed: (seed + i * 137) >>> 0 });
  }
  for (let i = 0; i < 3; i++)
    props.push({ id: `raid3-prop:entry:${i}`, x: ENTRY.x + ENTRY.width * (.2 + i * .3), y: ENTRY.y + 90, kind: i === 1 ? 'crystal' : 'icePillar', seed: (seed + 900 + i) >>> 0 });
  const floor: DungeonFloor = {
    theme: 'rime', seed, rooms, edges: [[0, 1]], corridors, members,
    entry: { x: 0, y: ENTRY.y + ENTRY.height / 2 },
    exit: { x: 0, y: 420 },
    chests: [
      { x: -190, y: -860, room: 1 }, // cache of the lich, gated by surviving arena members
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
/** One deterministic remote gate per world seed: the first far raid-tier cell that holds neither Onyxia's nor Ragnaros's gate. */
const RAID3_MIN_ZONE_LEVEL = 16;
const gateCache = new Map<number, { x: number; y: number } | null>();
function raid3GatePoint(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>): { x: number; y: number } | null {
  const cached = gateCache.get(world.seed);
  if (cached !== undefined) return cached;
  let point: { x: number; y: number } | null = null;
  // Spiral outward through wilderness cells; the nearest high-tier cell without another raid gate wins.
  for (let ring = 9; ring <= 64 && !point; ring++)
    for (let cy = -ring; cy <= ring && !point; cy++)
      for (let cx = -ring; cx <= ring && !point; cx++) {
        if (Math.max(Math.abs(cx), Math.abs(cy)) !== ring) continue;
        const seed = siteHash(cx, cy, world.seed, 0x0f4057);
        const x = (cx + .5) * 1400 + ((seed >>> 8) % 900 - 450), y = (cy + .5) * 1400 + ((seed >>> 20) % 900 - 450);
        if (getZoneAt(x, y, world.seed).originalLevel < RAID3_MIN_ZONE_LEVEL) continue;
        // Never share a cell with Onyxia's Lair or the Molten Core: probe whether either gate lands inside this cell's bounds.
        if (raidEntrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid2Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        point = { x, y };
      }
  gateCache.set(world.seed, point);
  if (gateCache.size > 8) gateCache.delete(gateCache.keys().next().value!);
  return point;
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
  if (!GAME_FEATURES.raidBoss || ![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 100000 || h > 100000)
    return [];
  const anchor = raid3GatePoint(world);
  if (!anchor) return [];
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, px = anchor.x + Math.cos(a) * (i < 8 ? 60 : 140), py = anchor.y + Math.sin(a) * (i < 8 ? 60 : 140);
    if (px < x || py < y || px >= x + w || py >= y + h) continue;
    if (world.blocked(px, py, 40) || world.isSanctuary(px, py)) continue;
    const zone = getZoneAt(px, py, world.seed);
    return [{ id: RAID3_ENTRANCE_ID, name: 'Naxxramas', theme: 'rime', x: px, y: py,
      seed: (world.seed ^ 0x0f4057) >>> 0, level: Math.min(1e6, zone.maxLevel), biome: world.sampleBiome(px, py).id }];
  }
  return [];
}
