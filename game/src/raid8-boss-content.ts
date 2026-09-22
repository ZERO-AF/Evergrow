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
import { raid7Entrances } from './raid7-boss-content.ts';
import type { Enemy } from './model.ts';

/**
 * Eighth raid boss (docs/wow-deepening.md §15, eighth wave): Anub'arak, the
 * Traitor King — the real WotLK Trial of the Crusader finale — inside the
 * Argent Coliseum pit, a dedicated single-arena Nerubian ziggurat (the
 * 'nerubian' dungeon theme: web-shrouded halls, chitin reliefs and cold teal
 * witchfire key off the floor theme).
 *
 * The arena reuses the frozen dungeon plumbing end to end: DungeonRun state,
 * wave-gated member admission (`wave` bits on run.states.warden.bossPhases),
 * boss chest (index 2), exit portal, journey completion and save validation.
 * raid8-boss.ts owns the wave bitmask: bit 1 admits the first Swarm Scarab /
 * Nerubian Burrower pack at the 75% Submerge, bit 2 the second pack at 45%.
 * (The boss kind is 'graveMarshal' — a heavy undead silhouette standing in
 * for the beetle king — so updateDungeon's wilderness-boss auto-bits at
 * 65%/30% can only ever latch a bit the AI already set: the AI's own 75%/45%
 * thresholds always land first on any tick-driven HP drop.)
 */

export const RAID8_ENTRANCE_ID = 'dungeon:raid:trial-of-the-crusader';
export const RAID8_BOSS_NAME = 'Anub\'arak';
export const RAID8_BOSS_MEMBER_ID = 'warden'; // wave gating + boss chest key off this id
export const RAID8_BOSS_KIND: Enemy['kind'] = 'graveMarshal';

export const isRaid8EntranceId = (id: string | undefined): boolean => id === RAID8_ENTRANCE_ID;
export const isRaid8Entrance = (e: Pick<DungeonEntrance, 'id'> | undefined | null): boolean => !!e && isRaid8EntranceId(e.id);
/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of a Trial of the Crusader run. */
export const isRaid8Boss = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  e.campMemberId === RAID8_BOSS_MEMBER_ID && isRaid8EntranceId(e.campId);
export const raid8BossName = (e: Pick<Enemy, 'campId' | 'campMemberId'>): string | undefined =>
  isRaid8Boss(e) ? RAID8_BOSS_NAME : undefined;

/** Swarm Scarab / Nerubian Burrower member ids admitted by the Submerge wave bits. */
export const RAID8_SCARAB_IDS: Readonly<Record<string, true>> = Object.freeze({
  'scarab:w:0': true, 'scarab:w:1': true, 'scarab:w:2': true,
  'scarab:e:0': true, 'scarab:e:1': true, 'scarab:e:2': true,
  'burrower:w': true, 'burrower:e': true,
  'scarab:w:3': true, 'scarab:e:3': true, 'burrower:n': true,
});
export const isRaid8Scarab = (e: Pick<Enemy, 'campId' | 'campMemberId'>): boolean =>
  isRaid8EntranceId(e.campId) && !!e.campMemberId && RAID8_SCARAB_IDS[e.campMemberId] === true;

/** Fight rules. Phase bits 1/2 match the 75% / 45% Submerge thresholds. */
export const ANUBARAK_RULES = Object.freeze({
  /** Boss chest loot table (raid-loot-content.ts): the Crusader's Tribute. */
  lootTable: 'anubarak' as const,
  phaseTwo: .75, phaseThree: .45, swarmPhase: .3,
  leash: 1600, awareness: 720,
  slashReach: 215, slashArc: Math.PI * 1.05,          // Freezing Slash (frontal frost cone)
  impaleLength: 540, impaleWidth: 36,                // Impale (3 staggered spike lanes)
  impaleOffsets: [-0.5, 0, 0.5] as readonly number[],
  spikeRadius: 80, spikeDuration: 9, spikeSpeed: 250, // Pursuit by Anub'arak (chasing ground spikes)
  spikeMax: 6, spikeInterval: 2.2,                   // burrowed spike cadence
  burrowed: 12,                                      // seconds underground per Submerge
  swarmRadius: 620, swarmInterval: 2, swarmDrain: .16, swarmHeal: .5, // Leeching Swarm (fraction of boss damage; heal share)
  enrageAfter: 480,                                  // Swarm Fury timer (seconds from engage)
  enrageDamage: 2.2, enragePulse: 1.5, enrageRadius: 620,
  allyDamageEase: .1, allyDamageEaseMax: .3,         // solo+allies scaling: -10% per ally, cap -30%
});

/**
 * Real Anub'arak spell names for DBM-style warnings; falls back to undefined
 * for non-raid enemies. `attackVariant === 2` on 'summon' marks the second
 * Submerge so it is announced as the Swarm Scarab call.
 */
export function raid8BossWarningSpec(e: Pick<Enemy, 'campId' | 'campMemberId' | 'bossMove' | 'bossPhases' | 'attackVariant'>):
  { ability: string; advice: string } | undefined {
  if (!isRaid8Boss(e) || !e.bossMove) return undefined;
  switch (e.bossMove) {
    case 'sweep': return { ability: 'Freezing Slash', advice: 'move!' };
    case 'fracture': return { ability: 'Impale', advice: 'sidestep!' };
    case 'eruption': return { ability: 'Pursuit by Anub\'arak', advice: 'move!' };
    case 'rush': return { ability: 'Pursuit by Anub\'arak', advice: 'out of the lane!' };
    case 'command': return { ability: 'Leeching Swarm', advice: 'spread out!' };
    case 'summon': return e.attackVariant === 2
      ? { ability: 'Swarm Scarab', advice: 'adds!' }
      : { ability: 'Submerge', advice: 'kite the spikes!' };
    case 'jab': return { ability: 'Freezing Slash', advice: 'move!' };
    case 'bolt': return { ability: 'Impale', advice: 'sidestep!' };
  }
}

// ── Arena floor ──────────────────────────────────────────────────────────
// Room ids: 0 = entry antechamber, 1 = the coliseum pit. One corridor links them.
const ARENA = { x: -1500, y: -1600, width: 3000, height: 2100 } as const;
const ENTRY = { x: -288, y: 1244, width: 576, height: 512 } as const;
const BOSS_AT = { x: 0, y: -1050 } as const; // Anub'arak holds the pit's heart, north-center
export const RAID8_ARENA_CENTER = Object.freeze({ x: ARENA.x + ARENA.width / 2, y: ARENA.y + ARENA.height / 2 });

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on isRaid8Entrance. */
export function raid8ArenaFloor(seed: number, _level = 1): DungeonFloor {
  const rooms: Room[] = [
    { id: 0, kind: 'entry', shape: 'hall', ...ENTRY },
    { id: 1, kind: 'boss', shape: 'octagon', ...ARENA },
  ];
  const corridors: Room[] = [dungeonPassage([{ x: 0, y: 1500 }, { x: 0, y: 420 }], 150, 0)];
  const members: DungeonMember[] = [
    // Anub'arak himself — 'warden' id feeds wave gating, the boss chest and the exit portal.
    { id: RAID8_BOSS_MEMBER_ID, kind: RAID8_BOSS_KIND, rank: 'elite', room: 1, x: BOSS_AT.x, y: BOSS_AT.y, seed: (seed ^ 0x0a0b) >>> 0 },
    // First Submerge (bit 1, 75%) — Swarm Scarabs skitter in from the pit rim
    // (duneScuttler stands in for the scarab) with two Nerubian Burrowers.
    { id: 'scarab:w:0', kind: 'duneScuttler', rank: 'normal', room: 1, x: -1400, y: -1200, seed: (seed ^ 0xa1) >>> 0, wave: 1 },
    { id: 'scarab:w:1', kind: 'duneScuttler', rank: 'normal', room: 1, x: -1400, y: -500, seed: (seed ^ 0xa2) >>> 0, wave: 1 },
    { id: 'scarab:w:2', kind: 'duneScuttler', rank: 'normal', room: 1, x: -1400, y: 150, seed: (seed ^ 0xa3) >>> 0, wave: 1 },
    { id: 'scarab:e:0', kind: 'duneScuttler', rank: 'normal', room: 1, x: 1400, y: -1200, seed: (seed ^ 0xa4) >>> 0, wave: 1 },
    { id: 'scarab:e:1', kind: 'duneScuttler', rank: 'normal', room: 1, x: 1400, y: -500, seed: (seed ^ 0xa5) >>> 0, wave: 1 },
    { id: 'scarab:e:2', kind: 'duneScuttler', rank: 'normal', room: 1, x: 1400, y: 150, seed: (seed ^ 0xa6) >>> 0, wave: 1 },
    { id: 'burrower:w', kind: 'brute', rank: 'veteran', room: 1, x: -450, y: -1500, seed: (seed ^ 0xa7) >>> 0, wave: 1 },
    { id: 'burrower:e', kind: 'brute', rank: 'veteran', room: 1, x: 450, y: -1500, seed: (seed ^ 0xa8) >>> 0, wave: 1 },
    // Second Submerge (bit 2, 45%) — veteran scarabs plus a last Burrower pair.
    { id: 'scarab:w:3', kind: 'duneScuttler', rank: 'veteran', room: 1, x: -1400, y: -850, seed: (seed ^ 0xa9) >>> 0, wave: 2 },
    { id: 'scarab:e:3', kind: 'duneScuttler', rank: 'veteran', room: 1, x: 1400, y: -850, seed: (seed ^ 0xaa) >>> 0, wave: 2 },
    { id: 'burrower:n', kind: 'brute', rank: 'veteran', room: 1, x: 0, y: -1500, seed: (seed ^ 0xab) >>> 0, wave: 2 },
  ];
  const props: DungeonProp[] = [];
  // Ice pillars, pale crystals and tomb-stones ring the coliseum pit; the center stays clear for the fight.
  const dressing: DungeonProp['kind'][] = ['icePillar', 'crystal', 'tomb', 'icePillar', 'crystal', 'tomb', 'icePillar', 'crystal'];
  for (let i = 0; i < 8; i++) {
    const x = ARENA.x + ARENA.width * (i % 2 ? .86 : .14), y = ARENA.y + ARENA.height * (.16 + Math.floor(i / 2) * .22);
    props.push({ id: `raid8-prop:${i}`, x, y, kind: dressing[i], seed: (seed + i * 137) >>> 0 });
  }
  for (let i = 0; i < 3; i++)
    props.push({ id: `raid8-prop:entry:${i}`, x: ENTRY.x + ENTRY.width * (.2 + i * .3), y: ENTRY.y + 90, kind: i === 1 ? 'crystal' : 'icePillar', seed: (seed + 900 + i) >>> 0 });
  const floor: DungeonFloor = {
    theme: 'nerubian', seed, rooms, edges: [[0, 1]], corridors, members,
    entry: { x: 0, y: ENTRY.y + ENTRY.height / 2 },
    exit: { x: 0, y: 420 },
    chests: [
      { x: -190, y: -860, room: 1 }, // the Crusader's tribute, gated by surviving arena members
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
const RAID8_MIN_ZONE_LEVEL = 20;
const gateCache = new Map<number, { x: number; y: number } | null>();
function raid8GatePoint(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>): { x: number; y: number } | null {
  const cached = gateCache.get(world.seed);
  if (cached !== undefined) return cached;
  let point: { x: number; y: number } | null = null;
  // Spiral outward through wilderness cells; the nearest high-tier cell without another raid gate wins.
  for (let ring = 9; ring <= 64 && !point; ring++)
    for (let cy = -ring; cy <= ring && !point; cy++)
      for (let cx = -ring; cx <= ring && !point; cx++) {
        if (Math.max(Math.abs(cx), Math.abs(cy)) !== ring) continue;
        const seed = siteHash(cx, cy, world.seed, 0x0a0b11);
        const x = (cx + .5) * 1400 + ((seed >>> 8) % 900 - 450), y = (cy + .5) * 1400 + ((seed >>> 20) % 900 - 450);
        if (getZoneAt(x, y, world.seed).originalLevel < RAID8_MIN_ZONE_LEVEL) continue;
        // Never share a cell with the seven prior raid gates: probe whether any lands inside this cell's bounds.
        if (raidEntrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid2Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid3Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid4Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid5Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid6Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        if (raid7Entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length) continue;
        point = { x, y };
      }
  gateCache.set(world.seed, point);
  if (gateCache.size > 8) gateCache.delete(gateCache.keys().next().value!);
  return point;
}

/**
 * Trial of the Crusader surface gate, mirroring raidEntrances/…/raid7Entrances:
 * a stable non-solid entrance probed onto open ground near a remote, raid-tier
 * cell distinct from all seven prior raids. Merge into
 * WorldLandscape.getDungeonEntrances behind GAME_FEATURES.raidBoss (or a
 * dedicated raidBoss8 flag if the integrator adds one).
 */
export function raid8Entrances(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>,
  x: number, y: number, w: number, h: number): DungeonEntrance[] {
  if (!GAME_FEATURES.raidBoss || ![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 100000 || h > 100000)
    return [];
  const anchor = raid8GatePoint(world);
  if (!anchor) return [];
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, px = anchor.x + Math.cos(a) * (i < 8 ? 60 : 140), py = anchor.y + Math.sin(a) * (i < 8 ? 60 : 140);
    if (px < x || py < y || px >= x + w || py >= y + h) continue;
    if (world.blocked(px, py, 40) || world.isSanctuary(px, py)) continue;
    const zone = getZoneAt(px, py, world.seed);
    return [{ id: RAID8_ENTRANCE_ID, name: 'Trial of the Crusader', theme: 'nerubian', x: px, y: py,
      seed: (world.seed ^ 0x0a0b11) >>> 0, level: Math.min(1e6, zone.maxLevel), biome: world.sampleBiome(px, py).id }];
  }
  return [];
}
