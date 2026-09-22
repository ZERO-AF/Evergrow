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
import type { Enemy } from './model.ts';

/**
 * Fifth raid boss (docs/wow-deepening.md §15, fifth wave): Malygos, the
 * Spell-Weaver — the real WotLK Eye of Eternity fight — inside the Eye of
 * Eternity, a dedicated single-arena astral disc (the 'astral' dungeon theme:
 * orrery/bookshelf dressing and arcane lighting key off the floor theme).
 *
 * The arena reuses the frozen dungeon plumbing end to end: DungeonRun state,
 * wave-gated member admission (`wave` bits on run.states.warden.bossPhases),
 * boss chest (index 2), exit portal, journey completion and save validation.
 * 'warden' gets no auto phase bits from updateDungeon — raid5-boss.ts owns the
 * whole bitmask: bit 1 gates the Nexus Lord / Scion of Eternity / Power Spark
 * wave at 50% (phase 2), bit 2 gates the final Power Spark pair at 25% (the
 * platform-shattering drake phase). The integrator routes `generateDungeon` to
 * `raid5ArenaFloor` for Eye of Eternity entrances; every downstream consumer
 * then works unchanged.
 */

export const RAID5_ENTRANCE_ID = 'dungeon:raid:eye-of-eternity';
export const RAID5_BOSS_NAME = 'Malygos';
export const RAID5_BOSS_MEMBER_ID = 'warden'; // wave gating + boss chest key off this id
export const RAID5_BOSS_KIND: Enemy['kind'] = 'warden';

export const isRaid5EntranceId = (id: string | undefined): boolean => id === RAID5_ENTRANCE_ID;
export const isRaid5Entrance = (e: Pick<DungeonEntrance, 'id'> | undefined | null): boolean => !!e && isRaid5EntranceId(e.id);
/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of an Eye of Eternity run. */
export const isRaid5Boss = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  e.campMemberId === RAID5_BOSS_MEMBER_ID && isRaid5EntranceId(e.campId);
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
const ARENA = { x: -1500, y: -1600, width: 3000, height: 2100 } as const;
const ENTRY = { x: -288, y: 1244, width: 576, height: 512 } as const;
const BOSS_AT = { x: 0, y: -1050 } as const; // Malygos hovers over the disc's heart, north-center
export const RAID5_ARENA_CENTER = Object.freeze({ x: ARENA.x + ARENA.width / 2, y: ARENA.y + ARENA.height / 2 });

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaid5Entrance. */
export function raid5ArenaFloor(seed: number, _level = 1): DungeonFloor {
  const rooms: Room[] = [
    { id: 0, kind: 'entry', shape: 'hall', ...ENTRY },
    { id: 1, kind: 'boss', shape: 'octagon', ...ARENA },
  ];
  const corridors: Room[] = [dungeonPassage([{ x: 0, y: 1500 }, { x: 0, y: 420 }], 150, 0)];
  const members: DungeonMember[] = [
    // Malygos himself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID5_BOSS_MEMBER_ID, kind: RAID5_BOSS_KIND, rank: 'elite', room: 1, x: BOSS_AT.x, y: BOSS_AT.y, seed: (seed ^ 0x0e0e) >>> 0 },
    // Phase 2 (bit 1, 50%) — Nexus Lords on discs and Scions of Eternity, plus
    // the four Power Sparks that drift in from the disc's edge.
    { id: 'lord:w:0', kind: 'brute', rank: 'normal', room: 1, x: -1400, y: -1200, seed: (seed ^ 0x71) >>> 0, wave: 1 },
    { id: 'lord:w:1', kind: 'brute', rank: 'normal', room: 1, x: -1400, y: -500, seed: (seed ^ 0x72) >>> 0, wave: 1 },
    { id: 'lord:e:0', kind: 'brute', rank: 'normal', room: 1, x: 1400, y: -1200, seed: (seed ^ 0x73) >>> 0, wave: 1 },
    { id: 'lord:e:1', kind: 'brute', rank: 'normal', room: 1, x: 1400, y: -500, seed: (seed ^ 0x74) >>> 0, wave: 1 },
    { id: 'scion:w:0', kind: 'caster', rank: 'normal', room: 1, x: -1400, y: 150, seed: (seed ^ 0x75) >>> 0, wave: 1 },
    { id: 'scion:e:0', kind: 'caster', rank: 'normal', room: 1, x: 1400, y: 150, seed: (seed ^ 0x76) >>> 0, wave: 1 },
    { id: 'scion:n:0', kind: 'caster', rank: 'normal', room: 1, x: -700, y: -1500, seed: (seed ^ 0x77) >>> 0, wave: 1 },
    { id: 'scion:n:1', kind: 'caster', rank: 'normal', room: 1, x: 700, y: -1500, seed: (seed ^ 0x78) >>> 0, wave: 1 },
    { id: 'spark:w', kind: 'wisp', rank: 'normal', room: 1, x: -1450, y: -850, seed: (seed ^ 0x79) >>> 0, wave: 1 },
    { id: 'spark:e', kind: 'wisp', rank: 'normal', room: 1, x: 1450, y: -850, seed: (seed ^ 0x7a) >>> 0, wave: 1 },
    { id: 'spark:n', kind: 'wisp', rank: 'normal', room: 1, x: 0, y: -1550, seed: (seed ^ 0x7b) >>> 0, wave: 1 },
    { id: 'spark:s', kind: 'wisp', rank: 'normal', room: 1, x: 0, y: 350, seed: (seed ^ 0x7c) >>> 0, wave: 1 },
    // Phase 3 (bit 2, 25%) — the last of the Nexus guard: a final Power Spark pair.
    { id: 'spark:p3:w', kind: 'wisp', rank: 'veteran', room: 1, x: -1150, y: -1450, seed: (seed ^ 0x7d) >>> 0, wave: 2 },
    { id: 'spark:p3:e', kind: 'wisp', rank: 'veteran', room: 1, x: 1150, y: -1450, seed: (seed ^ 0x7e) >>> 0, wave: 2 },
  ];
  const props: DungeonProp[] = [];
  // Orreries, librams and focus crystals around the disc's rim; the center stays clear for the fight.
  const dressing: DungeonProp['kind'][] = ['orrery', 'bookshelf', 'crystal', 'orrery', 'bookshelf', 'crystal', 'orrery', 'bookshelf'];
  for (let i = 0; i < 8; i++) {
    const x = ARENA.x + ARENA.width * (i % 2 ? .86 : .14), y = ARENA.y + ARENA.height * (.16 + Math.floor(i / 2) * .22);
    props.push({ id: `raid5-prop:${i}`, x, y, kind: dressing[i], seed: (seed + i * 137) >>> 0 });
  }
  for (let i = 0; i < 3; i++)
    props.push({ id: `raid5-prop:entry:${i}`, x: ENTRY.x + ENTRY.width * (.2 + i * .3), y: ENTRY.y + 90, kind: i === 1 ? 'crystal' : 'orrery', seed: (seed + 900 + i) >>> 0 });
  const floor: DungeonFloor = {
    theme: 'astral', seed, rooms, edges: [[0, 1]], corridors, members,
    entry: { x: 0, y: ENTRY.y + ENTRY.height / 2 },
    exit: { x: 0, y: 420 },
    chests: [
      { x: -190, y: -860, room: 1 }, // cache of the Spell-Weaver, gated by surviving arena members
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
const RAID5_MIN_ZONE_LEVEL = 20;
const gateCache = new Map<number, { x: number; y: number } | null>();
function raid5GatePoint(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>): { x: number; y: number } | null {
  const cached = gateCache.get(world.seed);
  if (cached !== undefined) return cached;
  let point: { x: number; y: number } | null = null;
  // Spiral outward through wilderness cells; the nearest high-tier cell without another raid gate wins.
  for (let ring = 9; ring <= 64 && !point; ring++)
    for (let cy = -ring; cy <= ring && !point; cy++)
      for (let cx = -ring; cx <= ring && !point; cx++) {
        if (Math.max(Math.abs(cx), Math.abs(cy)) !== ring) continue;
        const seed = siteHash(cx, cy, world.seed, 0x0e0e11);
        const x = (cx + .5) * 1400 + ((seed >>> 8) % 900 - 450), y = (cy + .5) * 1400 + ((seed >>> 20) % 900 - 450);
        if (getZoneAt(x, y, world.seed).originalLevel < RAID5_MIN_ZONE_LEVEL) continue;
        // Never share a cell with the four prior raid gates: probe whether any lands inside this cell's bounds.
        if (raidEntrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid2Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid3Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid4Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        point = { x, y };
      }
  gateCache.set(world.seed, point);
  if (gateCache.size > 8) gateCache.delete(gateCache.keys().next().value!);
  return point;
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
  if (!GAME_FEATURES.raidBoss || ![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 100000 || h > 100000)
    return [];
  const anchor = raid5GatePoint(world);
  if (!anchor) return [];
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, px = anchor.x + Math.cos(a) * (i < 8 ? 60 : 140), py = anchor.y + Math.sin(a) * (i < 8 ? 60 : 140);
    if (px < x || py < y || px >= x + w || py >= y + h) continue;
    if (world.blocked(px, py, 40) || world.isSanctuary(px, py)) continue;
    const zone = getZoneAt(px, py, world.seed);
    return [{ id: RAID5_ENTRANCE_ID, name: 'Eye of Eternity', theme: 'astral', x: px, y: py,
      seed: (world.seed ^ 0x0e0e11) >>> 0, level: Math.min(1e6, zone.maxLevel), biome: world.sampleBiome(px, py).id }];
  }
  return [];
}
