import type { DungeonEntrance, DungeonFloor, DungeonMember, DungeonProp, Room } from './dungeon.ts';
import { dungeonPassage } from './dungeon-passage.ts';
import type { WorldLandscape } from './world-landscape.ts';
import { getZoneAt } from './zone-progression.ts';
import { siteHash } from './wilderness-sites.ts';
import { GAME_FEATURES } from './game-features.ts';
import type { Enemy } from './model.ts';

/**
 * Raid boss (docs/wow-deepening.md §15): Onyxia — the real WotLK three-phase
 * raid fight — inside Onyxia's Lair, a dedicated single-arena dungeon floor.
 *
 * The arena reuses the frozen dungeon plumbing end to end: DungeonRun state,
 * wave-gated member admission (`wave` bits on run.states.warden.bossPhases),
 * boss chest (index 2), exit portal, journey completion and save validation.
 * The integrator routes `generateDungeon` to `raidArenaFloor` for raid
 * entrances; every downstream consumer (run creation, floor restore, chest
 * gating, save validation) then works unchanged.
 */

export const RAID_ENTRANCE_ID = 'dungeon:raid:onyxias-lair';
export const RAID_BOSS_NAME = 'Onyxia';
export const RAID_BOSS_MEMBER_ID = 'warden'; // wave gating + boss chest key off this id
export const RAID_BOSS_KIND: Enemy['kind'] = 'ashColossus';

export const isRaidEntranceId = (id: string | undefined): boolean => id === RAID_ENTRANCE_ID;
export const isRaidEntrance = (e: Pick<DungeonEntrance, 'id'> | undefined | null): boolean => !!e && isRaidEntranceId(e.id);
/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of a raid run. */
export const isRaidBoss = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  e.campMemberId === RAID_BOSS_MEMBER_ID && isRaidEntranceId(e.campId);
export const raidBossName = (e: Pick<Enemy, 'campId' | 'campMemberId'>): string | undefined =>
  isRaidBoss(e) ? RAID_BOSS_NAME : undefined;

/** Fight rules. Phase bits match updateDungeon's warden auto-bits (65% / 30%). */
export const ONYXIA_RULES = Object.freeze({
  /** Boss chest loot table (raid-loot-content.ts): Tier-2 helms + Onyxia epics. */
  lootTable: 'onyxia' as const,
  phaseTwo: .65, phaseThree: .3,
  leash: 1500, awareness: 640,
  sweepReach: 165, sweepArc: Math.PI * 1.25,          // Tail Sweep
  breathLength: 560, breathWidth: 30,                // Flame Breath (3-lane cone)
  breathOffsets: [-0.5, 0, 0.5] as readonly number[],
  fireballRadius: 120,                               // Fireball blast (air phase)
  deepBreathLength: 620, deepBreathWidth: 46,        // Deep Breath strafe lane
  roarRadius: 430,                                   // Bellowing Roar
  scorchRadius: 95, scorchDuration: 22, scorchInterval: .5, scorchDps: .22, // Lava scorch zones (fraction of boss damage per tick)
  scorchMax: 9,
  airHoverMin: 240, airHoverMax: 430,                // phase-2 hover band
  enrageAfter: 480,                                  // Broodmother's Fury timer (seconds from engage)
  enrageDamage: 2.2, enragePulse: 1.6, enrageRadius: 560,
  allyDamageEase: .1, allyDamageEaseMax: .3,         // solo+allies scaling: -10% per ally, cap -30%
});

/** Real Onyxia spell names for DBM-style warnings; falls back to undefined for non-raid enemies. */
export function raidBossWarningSpec(e: Pick<Enemy, 'campId' | 'campMemberId' | 'bossMove' | 'bossPhases'>):
  { ability: string; advice: string } | undefined {
  if (!isRaidBoss(e) || !e.bossMove) return undefined;
  switch (e.bossMove) {
    case 'sweep': return { ability: 'Tail Sweep', advice: 'move!' };
    case 'fracture': return { ability: 'Flame Breath', advice: 'sidestep!' };
    case 'eruption': return { ability: 'Fireball', advice: 'move!' };
    case 'rush': return { ability: 'Deep Breath', advice: 'out of the lane!' };
    case 'command': return { ability: 'Bellowing Roar', advice: 'spread out!' };
    case 'summon': return (e.bossPhases ?? 0) & 2
      ? { ability: 'Bellowing Roar', advice: 'Onyxia lands!' }
      : { ability: 'Onyxian Whelps', advice: 'adds!' };
    case 'jab': return { ability: 'Thrash', advice: 'move!' };
    case 'bolt': return { ability: 'Fireball', advice: 'sidestep!' };
  }
}

// ── Arena floor ──────────────────────────────────────────────────────────
// Room ids: 0 = entry antechamber, 1 = the lair arena. One corridor links them.
const ARENA = { x: -1400, y: -1400, width: 2800, height: 1800 } as const;
const ENTRY = { x: -288, y: 1244, width: 576, height: 512 } as const;
const BOSS_AT = { x: 0, y: -950 } as const;
export const RAID_ARENA_CENTER = Object.freeze({ x: ARENA.x + ARENA.width / 2, y: ARENA.y + ARENA.height / 2 });

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaidEntrance. */
export function raidArenaFloor(seed: number, _level = 1): DungeonFloor {
  const rooms: Room[] = [
    { id: 0, kind: 'entry', shape: 'hall', ...ENTRY },
    { id: 1, kind: 'boss', shape: 'octagon', ...ARENA },
  ];
  const corridors: Room[] = [dungeonPassage([{ x: 0, y: 1300 }, { x: 0, y: 350 }], 150, 0)];
  const members: DungeonMember[] = [
    // Onyxia herself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID_BOSS_MEMBER_ID, kind: RAID_BOSS_KIND, rank: 'elite', room: 1, x: BOSS_AT.x, y: BOSS_AT.y, seed: (seed ^ 0x0e7a) >>> 0 },
    { id: 'whelp:w:0', kind: 'stalker', rank: 'normal', room: 1, x: -1240, y: -980, seed: (seed ^ 0x11) >>> 0, wave: 1 },
    { id: 'whelp:w:1', kind: 'stalker', rank: 'normal', room: 1, x: -1240, y: -1080, seed: (seed ^ 0x12) >>> 0, wave: 1 },
    { id: 'whelp:e:0', kind: 'stalker', rank: 'normal', room: 1, x: 1240, y: -980, seed: (seed ^ 0x13) >>> 0, wave: 1 },
    { id: 'whelp:e:1', kind: 'stalker', rank: 'normal', room: 1, x: 1240, y: -1080, seed: (seed ^ 0x14) >>> 0, wave: 1 },
    // Phase 3 — a second whelp wave plus Onyxian Warders at the back ledges (bit 2).
    { id: 'whelp:w:2', kind: 'stalker', rank: 'veteran', room: 1, x: -1240, y: -1180, seed: (seed ^ 0x15) >>> 0, wave: 2 },
    { id: 'whelp:e:2', kind: 'stalker', rank: 'veteran', room: 1, x: 1240, y: -1180, seed: (seed ^ 0x16) >>> 0, wave: 2 },
    { id: 'warder:w', kind: 'wisp', rank: 'veteran', room: 1, x: -720, y: -1290, seed: (seed ^ 0x17) >>> 0, wave: 2 },
    { id: 'warder:e', kind: 'wisp', rank: 'veteran', room: 1, x: 720, y: -1290, seed: (seed ^ 0x18) >>> 0, wave: 2 },
  ];
  const props: DungeonProp[] = [];
  // Lava vents and hoard dressing around the arena walls; the center stays clear for the fight.
  const dressing: DungeonProp['kind'][] = ['furnace', 'crystal', 'anvil', 'furnace', 'crate', 'crystal', 'barrel', 'furnace'];
  for (let i = 0; i < 8; i++) {
    const x = ARENA.x + ARENA.width * (i % 2 ? .86 : .14), y = ARENA.y + ARENA.height * (.16 + Math.floor(i / 2) * .22);
    props.push({ id: `raid-prop:${i}`, x, y, kind: dressing[i], seed: (seed + i * 137) >>> 0 });
  }
  for (let i = 0; i < 3; i++)
    props.push({ id: `raid-prop:entry:${i}`, x: ENTRY.x + ENTRY.width * (.2 + i * .3), y: ENTRY.y + 90, kind: i === 1 ? 'crystal' : 'crate', seed: (seed + 900 + i) >>> 0 });
  const floor: DungeonFloor = {
    theme: 'foundry', seed, rooms, edges: [[0, 1]], corridors, members,
    entry: { x: 0, y: ENTRY.y + ENTRY.height / 2 },
    exit: { x: 0, y: 300 },
    chests: [
      { x: -170, y: -760, room: 1 }, // hoard caches, gated by surviving arena members
      { x: 170, y: -760, room: 1 },
      { x: 0, y: -700, room: 1 },    // boss chest — requires run.states.warden.hp <= 0
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
/** One deterministic remote gate per world seed: the first far cell whose zone is raid-tier. */
const RAID_MIN_ZONE_LEVEL = 12;
const gateCache = new Map<number, { x: number; y: number } | null>();
function raidGatePoint(worldSeed: number): { x: number; y: number } | null {
  const cached = gateCache.get(worldSeed);
  if (cached !== undefined) return cached;
  let point: { x: number; y: number } | null = null;
  // Spiral outward through wilderness cells; the nearest raid-tier cell wins.
  for (let ring = 9; ring <= 64 && !point; ring++)
    for (let cy = -ring; cy <= ring && !point; cy++)
      for (let cx = -ring; cx <= ring && !point; cx++) {
        if (Math.max(Math.abs(cx), Math.abs(cy)) !== ring) continue;
        const seed = siteHash(cx, cy, worldSeed, 0x0e7c1a);
        const x = (cx + .5) * 1400 + ((seed >>> 8) % 900 - 450), y = (cy + .5) * 1400 + ((seed >>> 20) % 900 - 450);
        if (getZoneAt(x, y, worldSeed).originalLevel >= RAID_MIN_ZONE_LEVEL) point = { x, y };
      }
  gateCache.set(worldSeed, point);
  if (gateCache.size > 8) gateCache.delete(gateCache.keys().next().value!);
  return point;
}

/**
 * Onyxia's Lair surface gate, mirroring dungeonEntrances: a stable non-solid
 * entrance probed onto open ground near a remote, raid-tier cell. Merge into
 * WorldLandscape.getDungeonEntrances behind GAME_FEATURES.raidBoss.
 */
export function raidEntrances(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>,
  x: number, y: number, w: number, h: number): DungeonEntrance[] {
  if (!GAME_FEATURES.raidBoss || ![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 100000 || h > 100000)
    return [];
  const anchor = raidGatePoint(world.seed);
  if (!anchor) return [];
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, px = anchor.x + Math.cos(a) * (i < 8 ? 60 : 140), py = anchor.y + Math.sin(a) * (i < 8 ? 60 : 140);
    if (px < x || py < y || px >= x + w || py >= y + h) continue;
    if (world.blocked(px, py, 40) || world.isSanctuary(px, py)) continue;
    const zone = getZoneAt(px, py, world.seed);
    return [{ id: RAID_ENTRANCE_ID, name: "Onyxia's Lair", theme: 'foundry', x: px, y: py,
      seed: (world.seed ^ 0x0e7c1a) >>> 0, level: Math.min(1e6, zone.maxLevel), biome: world.sampleBiome(px, py).id }];
  }
  return [];
}
