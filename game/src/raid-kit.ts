/** Shared raid-boss skeleton (docs/wow-deepening.md §15): every raid is a
 * deterministic single-arena floor — entry antechamber, one corridor, boss
 * arena — plus a remote surface gate probed onto open ground in a raid-tier
 * wilderness cell that no earlier raid gate occupies. Each raidN-boss-content
 * module supplies only its spec: geometry, roster, dressing and salts. */
import type { DungeonEntrance, DungeonFloor, DungeonMember, DungeonProp, Room } from './dungeon.ts';
import { dungeonPassage } from './dungeon-passage.ts';
import type { WorldLandscape } from './world-landscape.ts';
import { getZoneAt } from './zone-progression.ts';
import { GAME_FEATURES } from './game-features.ts';
import { hash2 } from './random-source.ts';
import type { Enemy } from './model.ts';

export type RaidWorld = Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>;
export type RaidEntrances = (world: RaidWorld, x: number, y: number, w: number, h: number) => DungeonEntrance[];

/** One roster row; `salt` mixes the floor seed into the member's loot seed. */
export type RaidMember = Omit<DungeonMember, 'seed'> & { salt: number };

export interface RaidSpec {
  /** Gate + entrance seed salt (e.g. 0x0e7c1a). */
  salt: number;
  entranceId: string;
  name: string;
  theme: DungeonFloor['theme'];
  minZoneLevel: number;
  /** Boss arena rect; the entry hall is always the shared 576×512 antechamber. */
  arena: { x: number; y: number; width: number; height: number };
  bossAt: { x: number; y: number };
  /** Corridor polyline from the entry hall into the arena. */
  corridor: readonly { x: number; y: number }[];
  exitY: number;
  /** Boss first, then adds; ids feed wave gating and the boss chest. */
  members: readonly RaidMember[];
  /** Eight rim props (i%2 ? .86 : .14 columns) plus three entry props. */
  dressing: readonly DungeonProp['kind'][];
  entryProps: readonly [DungeonProp['kind'], DungeonProp['kind'], DungeonProp['kind']];
  propPrefix: string;
  chests: readonly { x: number; y: number }[];
  /** Prior raids' entrance probes — a gate never shares a cell with them. */
  prior: readonly RaidEntrances[];
}

const ENTRY = { x: -288, y: 1244, width: 576, height: 512 } as const;

export const raidArenaCenter = (spec: RaidSpec): { x: number; y: number } =>
  Object.freeze({ x: spec.arena.x + spec.arena.width / 2, y: spec.arena.y + spec.arena.height / 2 });

/** Live actor check for the AI/warning dispatch: the raid boss is the 'warden' member of this raid's run. */
export const isRaidBossMember = (e: Pick<Enemy, 'campId' | 'campMemberId'>, entranceId: string, memberId: string): boolean =>
  e.campMemberId === memberId && e.campId === entranceId;

/** Deterministic single-arena floor; signature mirrors generateDungeon so the integrator can branch on the entrance id. */
export function raidArenaFloor(spec: RaidSpec, seed: number): DungeonFloor {
  const { arena: ARENA } = spec;
  const rooms: Room[] = [
    { id: 0, kind: 'entry', shape: 'hall', ...ENTRY },
    { id: 1, kind: 'boss', shape: 'octagon', ...ARENA },
  ];
  const corridors: Room[] = [dungeonPassage(spec.corridor, 150, 0)];
  const members: DungeonMember[] = spec.members.map(m => {
    const { salt, ...rest } = m;
    return { ...rest, seed: (seed ^ salt) >>> 0 };
  });
  const props: DungeonProp[] = [];
  // Rim dressing rings the arena walls; the center stays clear for the fight.
  for (let i = 0; i < 8; i++) {
    const x = ARENA.x + ARENA.width * (i % 2 ? .86 : .14), y = ARENA.y + ARENA.height * (.16 + Math.floor(i / 2) * .22);
    props.push({ id: `${spec.propPrefix}:${i}`, x, y, kind: spec.dressing[i], seed: (seed + i * 137) >>> 0 });
  }
  for (let i = 0; i < 3; i++)
    props.push({ id: `${spec.propPrefix}:entry:${i}`, x: ENTRY.x + ENTRY.width * (.2 + i * .3), y: ENTRY.y + 90, kind: spec.entryProps[i], seed: (seed + 900 + i) >>> 0 });
  const floor: DungeonFloor = {
    theme: spec.theme, seed, rooms, edges: [[0, 1]], corridors, members,
    entry: { x: 0, y: ENTRY.y + ENTRY.height / 2 },
    exit: { x: 0, y: spec.exitY },
    chests: spec.chests.map(chest => ({ ...chest, room: 1 })),
    props,
  };
  for (const r of corridors) { r.outline?.forEach(Object.freeze); r.path?.forEach(Object.freeze); if (r.outline) Object.freeze(r.outline); if (r.path) Object.freeze(r.path); }
  for (const v of [...rooms, ...corridors, ...members, ...floor.edges, ...floor.chests, ...props]) Object.freeze(v);
  Object.freeze(rooms); Object.freeze(corridors); Object.freeze(members); Object.freeze(floor.edges);
  Object.freeze(floor.chests); Object.freeze(floor.entry); Object.freeze(floor.exit); Object.freeze(props);
  return Object.freeze(floor);
}

/** One deterministic remote gate per world seed: the first far raid-tier cell
 * that holds no earlier raid gate. Spiral outward through wilderness cells. */
const gateCache = new Map<string, { x: number; y: number } | null>();
function raidGatePoint(world: RaidWorld, spec: RaidSpec): { x: number; y: number } | null {
  const key = `${world.seed}:${spec.salt}`;
  const cached = gateCache.get(key);
  if (cached !== undefined) return cached;
  let point: { x: number; y: number } | null = null;
  for (let ring = 9; ring <= 64 && !point; ring++)
    for (let cy = -ring; cy <= ring && !point; cy++)
      for (let cx = -ring; cx <= ring && !point; cx++) {
        if (Math.max(Math.abs(cx), Math.abs(cy)) !== ring) continue;
        const seed = hash2(cx, cy, world.seed, spec.salt);
        const x = (cx + .5) * 1400 + ((seed >>> 8) % 900 - 450), y = (cy + .5) * 1400 + ((seed >>> 20) % 900 - 450);
        if (getZoneAt(x, y, world.seed).originalLevel < spec.minZoneLevel) continue;
        // Never share a cell with a prior raid gate: probe whether any lands inside this cell's bounds.
        if (spec.prior.some(entrances => entrances(world, cx * 1400 - 160, cy * 1400 - 160, 1720, 1720).length)) continue;
        point = { x, y };
      }
  gateCache.set(key, point);
  if (gateCache.size > 64) gateCache.delete(gateCache.keys().next().value!);
  return point;
}

/** Surface gate: a stable non-solid entrance probed onto open ground near the
 * remote, raid-tier cell. Gated behind GAME_FEATURES.raidBoss. */
export function raidEntrancesAt(spec: RaidSpec, world: RaidWorld,
  x: number, y: number, w: number, h: number): DungeonEntrance[] {
  if (!GAME_FEATURES.raidBoss || ![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 100000 || h > 100000)
    return [];
  const anchor = raidGatePoint(world, spec);
  if (!anchor) return [];
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, px = anchor.x + Math.cos(a) * (i < 8 ? 60 : 140), py = anchor.y + Math.sin(a) * (i < 8 ? 60 : 140);
    if (px < x || py < y || px >= x + w || py >= y + h) continue;
    if (world.blocked(px, py, 40) || world.isSanctuary(px, py)) continue;
    const zone = getZoneAt(px, py, world.seed);
    return [{ id: spec.entranceId, name: spec.name, theme: spec.theme, x: px, y: py,
      seed: (world.seed ^ spec.salt) >>> 0, level: Math.min(1e6, zone.maxLevel), biome: world.sampleBiome(px, py).id }];
  }
  return [];
}
