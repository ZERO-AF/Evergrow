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
import type { Enemy } from './model.ts';

/**
 * Sixth raid boss (docs/wow-deepening.md §15, sixth wave): Sartharion the
 * Onyx Guardian — the real WotLK Obsidian Sanctum fight — inside the Obsidian
 * Sanctum, a dedicated single-arena lava sanctum (the 'blackrock' dungeon
 * theme: furnaces, pools and black iron key off the floor theme).
 *
 * The arena reuses the frozen dungeon plumbing end to end: DungeonRun state,
 * wave-gated member admission (`wave` bits on run.states.warden.bossPhases),
 * boss chest (index 2), exit portal, journey completion and save validation.
 * 'warden' gets no auto phase bits from updateDungeon — raid6-boss.ts owns the
 * whole bitmask: bits 1/2 gate the Twilight Whelp / Onyx Guardian packs at
 * 65% / 30%.
 *
 * The drake lieutenants are the real '3D' hardmode choice: Tenebron, Shadron
 * and Vesperon stand on the sanctum rim as ordinary members (never wave-gated).
 * Pull Sartharion with drakes alive and they answer his call-downs while his
 * Will of Sartharion empowers him +25% damage per living drake; kill them
 * first and the fight eases. Each drake's death is latched on the boss's own
 * `bossPhases` high bits (4/8/16) — persisted by syncDungeon on
 * run.states.warden — so `sartharionDrakesAlive(run)` reads the kill-time
 * count for the chest's hardmode bonus.
 */

export const RAID6_ENTRANCE_ID = 'dungeon:raid:obsidian-sanctum';
export const RAID6_BOSS_NAME = 'Sartharion';
export const RAID6_BOSS_MEMBER_ID = 'warden'; // wave gating + boss chest key off this id
export const RAID6_BOSS_KIND: Enemy['kind'] = 'warden';

export const isRaid6EntranceId = (id: string | undefined): boolean => id === RAID6_ENTRANCE_ID;
export const isRaid6Entrance = (e: Pick<DungeonEntrance, 'id'> | undefined | null): boolean => !!e && isRaid6EntranceId(e.id);
/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of an Obsidian Sanctum run. */
export const isRaid6Boss = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  e.campMemberId === RAID6_BOSS_MEMBER_ID && isRaid6EntranceId(e.campId);
export const raid6BossName = (e: Pick<Enemy, 'campId' | 'campMemberId'>): string | undefined =>
  isRaid6Boss(e) ? RAID6_BOSS_NAME : undefined;
/** The three drake lieutenants: member id → drake name (call-down announcements). */
export const SARTH_DRAKES: Readonly<Record<string, string>> = Object.freeze({
  'drake:tenebron': 'Tenebron',
  'drake:shadron': 'Shadron',
  'drake:vesperon': 'Vesperon',
});
export const isSarthDrake = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  isRaid6EntranceId(e.campId) && !!e.campMemberId && SARTH_DRAKES[e.campMemberId] !== undefined;

/** bossPhases bit for drake i's confirmed death (bits 4/8/16; bits 1/2 stay wave gates). */
export const SARTH_DRAKE_DEAD_BIT = (i: number): number => 4 << i;

/**
 * Drakes alive at Sartharion's death — the '3D' hardmode count the boss chest
 * pays on. The boss latches each drake's death on his own bossPhases high bits
 * (4/8/16), which syncDungeon persists on run.states.warden — the count survives
 * corpse culling, leash resets and save/load. Unlatched drakes count as alive.
 */
export function sartharionDrakesAlive(run: { states: Record<string, { hp: number; bossPhases?: number }> }): number {
  const dead = (run.states[RAID6_BOSS_MEMBER_ID]?.bossPhases ?? 0) >> 2 & 7;
  return 3 - ((dead & 1) + (dead >> 1 & 1) + (dead >> 2 & 1));
}


/** Fight rules. Phase bits 1/2 match the 65% / 30% add-wave thresholds. */
export const SARTH_RULES = Object.freeze({
  /** Boss chest loot table (raid-loot-content.ts): Satchel of Spoils + hardmode bonus. */
  lootTable: 'sartharion' as const,
  phaseTwo: .65, phaseThree: .3,
  leash: 1600, awareness: 720,
  cleaveReach: 215, cleaveArc: Math.PI * 1.05,        // Cleave (frontal melee arc)
  breathLength: 540, breathWidth: 36,                // Flame Breath (3 staggered fire lanes)
  breathOffsets: [-0.5, 0, 0.5] as readonly number[],
  fissureRadius: 135,                                // Lava Fissure (detonation at the target)
  waveLength: 700, waveWidth: 52,                    // Lava Wave (projected radial wave lane)
  novaRadius: 480,                                   // Twilight Revenge (arena-wide nova)
  scorchRadius: 105, scorchDuration: 26, scorchInterval: .5, scorchDps: .22, // Lava scorch zones (fraction of boss damage per tick)
  scorchMax: 10,
  drakeDamage: .25,                                  // Will of Sartharion: +25% damage per living drake
  drakeCalls: [12, 30, 48] as readonly number[],     // call-down cadence (seconds from engage): Tenebron, Shadron, Vesperon
  enrageAfter: 420,                                  // Twilight Fury timer (seconds from engage)
  enrageDamage: 2.2, enragePulse: 1.5, enrageRadius: 620,
  allyDamageEase: .1, allyDamageEaseMax: .3,         // solo+allies scaling: -10% per ally, cap -30%
});

/**
 * Real Sartharion spell names for DBM-style warnings; falls back to undefined
 * for non-raid enemies. 'summon' announces the Twilight Whelp / Guardian packs.
 */
export function raid6BossWarningSpec(e: Pick<Enemy, 'campId' | 'campMemberId' | 'bossMove' | 'bossPhases' | 'attackVariant'>):
  { ability: string; advice: string } | undefined {
  if (!isRaid6Boss(e) || !e.bossMove) return undefined;
  switch (e.bossMove) {
    case 'sweep': return { ability: 'Cleave', advice: 'move!' };
    case 'fracture': return { ability: 'Flame Breath', advice: 'sidestep!' };
    case 'eruption': return { ability: 'Lava Fissure', advice: 'move!' };
    case 'rush': return { ability: 'Lava Wave', advice: 'out of the lane!' };
    case 'command': return { ability: 'Twilight Revenge', advice: 'spread out!' };
    case 'summon': return (e.bossPhases ?? 0) & 2
      ? { ability: 'Onyx Guardians', advice: 'adds!' }
      : { ability: 'Twilight Whelps', advice: 'adds!' };
    case 'jab': return { ability: 'Tail Lash', advice: 'move!' };
    case 'bolt': return { ability: 'Fireball', advice: 'sidestep!' };
  }
}

// ── Arena floor ──────────────────────────────────────────────────────────
// Room ids: 0 = entry antechamber, 1 = the lava sanctum arena. One corridor links them.
const ARENA = { x: -1500, y: -1600, width: 3000, height: 2100 } as const;
const ENTRY = { x: -288, y: 1244, width: 576, height: 512 } as const;
const BOSS_AT = { x: 0, y: -1050 } as const; // Sartharion holds the lava platform, north-center
export const RAID6_ARENA_CENTER = Object.freeze({ x: ARENA.x + ARENA.width / 2, y: ARENA.y + ARENA.height / 2 });

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaid6Entrance. */
export function raid6ArenaFloor(seed: number, _level = 1): DungeonFloor {
  const rooms: Room[] = [
    { id: 0, kind: 'entry', shape: 'hall', ...ENTRY },
    { id: 1, kind: 'boss', shape: 'octagon', ...ARENA },
  ];
  const corridors: Room[] = [dungeonPassage([{ x: 0, y: 1500 }, { x: 0, y: 420 }], 150, 0)];
  const members: DungeonMember[] = [
    // Sartharion himself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID6_BOSS_MEMBER_ID, kind: RAID6_BOSS_KIND, rank: 'elite', room: 1, x: BOSS_AT.x, y: BOSS_AT.y, seed: (seed ^ 0x0b51) >>> 0 },
    // The drake lieutenants — ordinary members on the sanctum rim, never
    // wave-gated: the '3D' choice is leaving them alive for the pull.
    { id: 'drake:tenebron', kind: 'stalker', rank: 'veteran', room: 1, x: -1150, y: -1250, seed: (seed ^ 0x81) >>> 0 },
    { id: 'drake:shadron', kind: 'wisp', rank: 'veteran', room: 1, x: 1150, y: -1250, seed: (seed ^ 0x82) >>> 0 },
    { id: 'drake:vesperon', kind: 'brute', rank: 'veteran', room: 1, x: 0, y: -1500, seed: (seed ^ 0x83) >>> 0 },
    // Twilight Whelps — wave bit 1 (65%), swarming in from the lava rim.
    { id: 'whelp:w:0', kind: 'stalker', rank: 'normal', room: 1, x: -1400, y: -1200, seed: (seed ^ 0x84) >>> 0, wave: 1 },
    { id: 'whelp:w:1', kind: 'stalker', rank: 'normal', room: 1, x: -1400, y: -500, seed: (seed ^ 0x85) >>> 0, wave: 1 },
    { id: 'whelp:w:2', kind: 'stalker', rank: 'normal', room: 1, x: -1400, y: 150, seed: (seed ^ 0x86) >>> 0, wave: 1 },
    { id: 'whelp:e:0', kind: 'stalker', rank: 'normal', room: 1, x: 1400, y: -1200, seed: (seed ^ 0x87) >>> 0, wave: 1 },
    { id: 'whelp:e:1', kind: 'stalker', rank: 'normal', room: 1, x: 1400, y: -500, seed: (seed ^ 0x88) >>> 0, wave: 1 },
    { id: 'whelp:e:2', kind: 'stalker', rank: 'normal', room: 1, x: 1400, y: 150, seed: (seed ^ 0x89) >>> 0, wave: 1 },
    // Wave bit 2 (30%) — veteran whelps plus Onyx Guardians at the ledges.
    { id: 'whelp:w:3', kind: 'stalker', rank: 'veteran', room: 1, x: -1400, y: -850, seed: (seed ^ 0x8a) >>> 0, wave: 2 },
    { id: 'whelp:e:3', kind: 'stalker', rank: 'veteran', room: 1, x: 1400, y: -850, seed: (seed ^ 0x8b) >>> 0, wave: 2 },
    { id: 'guardian:w', kind: 'brute', rank: 'veteran', room: 1, x: -450, y: -1500, seed: (seed ^ 0x8c) >>> 0, wave: 2 },
    { id: 'guardian:e', kind: 'brute', rank: 'veteran', room: 1, x: 450, y: -1500, seed: (seed ^ 0x8d) >>> 0, wave: 2 },
  ];
  const props: DungeonProp[] = [];
  // Slag furnaces, lava pools and black iron dressing around the sanctum walls; the center stays clear for the fight.
  const dressing: DungeonProp['kind'][] = ['furnace', 'pool', 'anvil', 'furnace', 'crystal', 'pool', 'anvil', 'furnace'];
  for (let i = 0; i < 8; i++) {
    const x = ARENA.x + ARENA.width * (i % 2 ? .86 : .14), y = ARENA.y + ARENA.height * (.16 + Math.floor(i / 2) * .22);
    props.push({ id: `raid6-prop:${i}`, x, y, kind: dressing[i], seed: (seed + i * 137) >>> 0 });
  }
  for (let i = 0; i < 3; i++)
    props.push({ id: `raid6-prop:entry:${i}`, x: ENTRY.x + ENTRY.width * (.2 + i * .3), y: ENTRY.y + 90, kind: i === 1 ? 'crystal' : 'furnace', seed: (seed + 900 + i) >>> 0 });
  const floor: DungeonFloor = {
    theme: 'blackrock', seed, rooms, edges: [[0, 1]], corridors, members,
    entry: { x: 0, y: ENTRY.y + ENTRY.height / 2 },
    exit: { x: 0, y: 420 },
    chests: [
      { x: -190, y: -860, room: 1 }, // cache of the Onyx Guardian, gated by surviving arena members
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
const RAID6_MIN_ZONE_LEVEL = 20;
const gateCache = new Map<number, { x: number; y: number } | null>();
function raid6GatePoint(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>): { x: number; y: number } | null {
  const cached = gateCache.get(world.seed);
  if (cached !== undefined) return cached;
  let point: { x: number; y: number } | null = null;
  // Spiral outward through wilderness cells; the nearest high-tier cell without another raid gate wins.
  for (let ring = 9; ring <= 64 && !point; ring++)
    for (let cy = -ring; cy <= ring && !point; cy++)
      for (let cx = -ring; cx <= ring && !point; cx++) {
        if (Math.max(Math.abs(cx), Math.abs(cy)) !== ring) continue;
        const seed = siteHash(cx, cy, world.seed, 0x0b51a7);
        const x = (cx + .5) * 1400 + ((seed >>> 8) % 900 - 450), y = (cy + .5) * 1400 + ((seed >>> 20) % 900 - 450);
        if (getZoneAt(x, y, world.seed).originalLevel < RAID6_MIN_ZONE_LEVEL) continue;
        // Never share a cell with the five prior raid gates: probe whether any lands inside this cell's bounds.
        if (raidEntrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid2Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid3Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid4Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid5Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        point = { x, y };
      }
  gateCache.set(world.seed, point);
  if (gateCache.size > 8) gateCache.delete(gateCache.keys().next().value!);
  return point;
}

/**
 * Obsidian Sanctum surface gate, mirroring raidEntrances/…/raid5Entrances: a
 * stable non-solid entrance probed onto open ground near a remote, raid-tier
 * cell distinct from all five prior raids. Merge into
 * WorldLandscape.getDungeonEntrances behind GAME_FEATURES.raidBoss (or a
 * dedicated raidBoss6 flag if the integrator adds one).
 */
export function raid6Entrances(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>,
  x: number, y: number, w: number, h: number): DungeonEntrance[] {
  if (!GAME_FEATURES.raidBoss || ![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 100000 || h > 100000)
    return [];
  const anchor = raid6GatePoint(world);
  if (!anchor) return [];
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, px = anchor.x + Math.cos(a) * (i < 8 ? 60 : 140), py = anchor.y + Math.sin(a) * (i < 8 ? 60 : 140);
    if (px < x || py < y || px >= x + w || py >= y + h) continue;
    if (world.blocked(px, py, 40) || world.isSanctuary(px, py)) continue;
    const zone = getZoneAt(px, py, world.seed);
    return [{ id: RAID6_ENTRANCE_ID, name: 'Obsidian Sanctum', theme: 'blackrock', x: px, y: py,
      seed: (world.seed ^ 0x0b51a7) >>> 0, level: Math.min(1e6, zone.maxLevel), biome: world.sampleBiome(px, py).id }];
  }
  return [];
}
