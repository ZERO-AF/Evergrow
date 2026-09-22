import { vendorIdentity } from './vendor-identity.ts';
import type { SettlementTier } from './settlement-services.ts';
import type { Building, Settlement } from './settlements.ts';
import { getZoneAt } from './zone-progression.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import type { WorldQuery } from './model.ts';
import { factionAt, factionHostility, raceFaction, type FactionTag } from './factions.ts';
import type { WowRaceId } from './wow-types.ts';
import { WORLD_TIME } from './world-time.ts';
import { GAME_FEATURES } from './game-features.ts';

export type NPCRole = 'blacksmith' | 'jeweler' | 'enchanter' | 'gambler' | 'stash' | 'stable' | 'battlemaster' | 'pvpVendor' | 'badgeVendor' | 'darkmoonVendor' | 'trainer' | 'quartermaster';
export interface TownNPC { settlementTier?:SettlementTier; id: string; name: string; role: NPCRole; x: number; y: number; level: number; maxLevel?: number; seed: number; buildingId: string;
  /** Faction the NPC serves (factions.ts); opposing-faction players can't use its services. */
  faction?: FactionTag;
  /** Daily-routine pose (npcs.ts routines): facing angle and gait while strolling.
   * Undefined means the NPC stands at its building anchor facing south. */
  angle?: number; moving?: number; }
export const NPC_NAMES: Record<NPCRole, string> = { blacksmith: 'Blacksmith', jeweler: 'Jeweler', enchanter: 'Enchanter', gambler: 'Gambler', stash: 'Storage', stable: 'Stable Master', battlemaster: 'Battlemaster', pvpVendor: 'PvP Quartermaster', badgeVendor: 'Badge Vendor', darkmoonVendor: 'Darkmoon Faire Vendor', trainer: 'Class Trainer', quartermaster: 'Quartermaster' };
export const NPC_COLORS=Object.fromEntries(Object.keys(NPC_NAMES).map(role=>[role,vendorIdentity(role)!.color])) as Record<NPCRole,string>;
export function hashService(value: string): number {
  let n = 2166136261;
  for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619);
  return n >>> 0;
}
export function buildingNPC(building: Building): TownNPC | null {
  const role = building.kind === 'blacksmith' ? 'blacksmith' : building.kind === 'merchant' ? 'jeweler'
    : building.kind === 'chapel' ? 'enchanter' : building.kind === 'gambler' ? 'gambler' : building.kind === 'stash' ? 'stash' : null;
  if (!role) return null;
  const x = building.door.x, y = building.kind==='stash' ? building.door.y+12 : building.door.y + (building.form==='stall'?22:-57), id = `${building.id}:${role}`;
  const seed = hashService(id), names = ['Mara', 'Oswin', 'Vesper', 'Iona', 'Alden', 'Sable', 'Corvin', 'Edda'];
  return { settlementTier:building.settlementTier, id, buildingId: building.id, role, x, y, seed, name: names[seed % names.length], level: getZoneAt(x, y, Number(building.id.split(':')[1])).level, maxLevel: getZoneAt(x, y, Number(building.id.split(':')[1])).maxLevel, faction: factionAt(x, y) };
}
export function canInteractNPC(npc: TownNPC, player: { x: number; y: number; dead?: boolean; character?: { raceId: WowRaceId } }, world: WorldQuery): boolean {
  // Opposing-faction NPCs refuse service (world-t05); callers without a
  // character (ambient residents) skip the check. Untagged NPCs are neutral.
  if (GAME_FEATURES.factions && player.character && factionHostility(npc.faction ?? 'neutral', raceFaction(player.character.raceId)) === 'hostile') return false;
  return !player.dead && !world.blocked(npc.x, npc.y, 0) && !world.blocked(player.x, player.y, 0) && Math.hypot(player.x - npc.x, player.y - npc.y) <= 70
    && hasLineOfSight(world, player.x, player.y, npc.x, npc.y);
}
export function focusNPC(npcs: readonly TownNPC[], player: { x: number; y: number; dead?: boolean }, world: WorldQuery,
  pointer?: { x: number; y: number }): TownNPC | null {
  return npcs.filter(npc => canInteractNPC(npc, player, world) && (!pointer || Math.hypot(pointer.x - npc.x, pointer.y - (npc.y - 17)) <= 28))
    .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0] ?? null;
}

export function vendorLevel(npc: TownNPC, playerLevel: number): number { return Math.max(npc.level, Math.min(npc.maxLevel ?? npc.level, playerLevel)); }

/** Stable masters (WotLK pet stables) stand beside the settlement stash fixture — a standalone
 * service NPC like the innkeeper, not a building kind. Every settlement has a stash fixture. */
export type StableMaster = TownNPC & { role: 'stable' };
const STABLE_MASTER_NAMES = ['Shellei', 'Balfour', 'Kelsuwa', 'Penny', 'Durik', 'Aesha', 'Grif', 'Lina'] as const;
export function stableMasterFor(building: Building): StableMaster | null {
  if (building.kind !== 'stash') return null;
  const x = building.door.x - 52, y = building.door.y - 2, id = `${building.id}:stable`;
  const seed = hashService(id);
  return { settlementTier: building.settlementTier, id, buildingId: building.id, role: 'stable', x, y, seed,
    name: STABLE_MASTER_NAMES[seed % STABLE_MASTER_NAMES.length],
    level: getZoneAt(x, y, Number(building.id.split(':')[1])).level, maxLevel: getZoneAt(x, y, Number(building.id.split(':')[1])).maxLevel, faction: factionAt(x, y) };
}
export function stableMastersNear(world: WorldQuery, x: number, y: number, width: number, height: number): StableMaster[] {
  return (world.getBuildings?.(x, y, width, height) ?? [])
    .map(stableMasterFor).filter((master): master is StableMaster => master !== null);
}
export function canStableAt(master: StableMaster, player: { x: number; y: number; dead?: boolean }, world: WorldQuery): boolean {
  return canInteractNPC(master, player, world);
}
export function focusedStableMaster(masters: readonly StableMaster[], player: { x: number; y: number; dead?: boolean }, world: WorldQuery,
  pointer?: { x: number; y: number }): StableMaster | null {
  return masters.filter(master => canStableAt(master, player, world) && (!pointer || Math.hypot(pointer.x - master.x, pointer.y - (master.y - 17)) <= 28))
    .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0] ?? null;
}

/** Battlemasters (WotLK arena/battleground queue NPCs) stand beside the Count's Hall in
 * cities — a standalone service NPC like the stable master, not a building kind. Only
 * city settlements raise a noble hall, so battlemasters are a city fixture. */
export type Battlemaster = TownNPC & { role: 'battlemaster' };
const BATTLEMASTER_NAMES = ['Korrak', 'Beka', 'Deze', 'Grikka', 'Andrissa', 'Fizim', 'Rex', 'Mosha'] as const;
export function battlemasterFor(building: Building): Battlemaster | null {
  if (building.kind !== 'noble') return null;
  const x = building.door.x + 70, y = building.door.y + 24, id = `${building.id}:battlemaster`;
  const seed = hashService(id);
  return { settlementTier: building.settlementTier, id, buildingId: building.id, role: 'battlemaster', x, y, seed,
    name: BATTLEMASTER_NAMES[seed % BATTLEMASTER_NAMES.length],
    level: getZoneAt(x, y, Number(building.id.split(':')[1])).level, maxLevel: getZoneAt(x, y, Number(building.id.split(':')[1])).maxLevel, faction: factionAt(x, y) };
}
export function battlemastersNear(world: WorldQuery, x: number, y: number, width: number, height: number): Battlemaster[] {
  return (world.getBuildings?.(x, y, width, height) ?? [])
    .map(battlemasterFor).filter((master): master is Battlemaster => master !== null);
}
export function focusedBattlemaster(masters: readonly Battlemaster[], player: { x: number; y: number; dead?: boolean }, world: WorldQuery,
  pointer?: { x: number; y: number }): Battlemaster | null {
  return masters.filter(master => canInteractNPC(master, player, world) && (!pointer || Math.hypot(pointer.x - master.x, pointer.y - (master.y - 17)) <= 28))
    .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0] ?? null;
}

// ── Daily routines (wayfinder world-t10) ─────────────────────────────────────
// Presentation-only strolling: a pure function of (npc id, town, world time).
// No combat, save, or collision state is touched — the same inputs always give
// the same pose, so routines are deterministic per NPC id and bounded to the
// town's own fixtures.

/** Routine waypoints derived from the NPC's settlement: home is the service
 * anchor, work/wander/hearth are seeded picks among the town's fixtures. */
export interface NPCRoutine {
  readonly home: { readonly x: number; readonly y: number };
  readonly stops: readonly { readonly x: number; readonly y: number }[];
}

/** Daily schedule as fractions of the world day (WORLD_TIME.daySeconds):
 * work → midday wander → evening at the hearth → home for the night. */
const ROUTINE_SLOTS = Object.freeze([
  { start: 0 / 24, stop: 0 },   // 00:00–07:00 home
  { start: 7 / 24, stop: 1 },   // 07:00–12:00 work spot
  { start: 12 / 24, stop: 2 },  // 12:00–17:00 wander
  { start: 17 / 24, stop: 3 },  // 17:00–21:00 hearth
  { start: 21 / 24, stop: 0 },  // 21:00–24:00 home
] as const);
const ROUTINE_SPEED = 12; // world units per second — a visible stroll, not a sprint

const routineSpot = (town: Settlement, kinds: readonly string[], seed: number, salt: number) => {
  const spots = town.buildings.filter(b => kinds.includes(b.kind)).map(b => b.door);
  return spots.length ? spots[(seed + salt * 7) % spots.length] : null;
};

/** Deterministic waypoints for one NPC inside its settlement. */
export function npcRoutine(npc: TownNPC, town: Settlement): NPCRoutine {
  const home = { x: npc.x, y: npc.y };
  const seed = npc.seed;
  const work = routineSpot(town, ['supplies', 'cart', 'rack', 'well'], seed, 1) ?? home;
  const wander = routineSpot(town, ['well', 'cart', 'supplies', 'rack'], seed, 2) ?? home;
  const hearth = routineSpot(town, ['firepit', 'notice', 'lantern'], seed, 3) ?? home;
  // Small seeded jitter keeps neighbours from stacking on the same fixture door;
  // biased outward (+y) so waypoints stay clear of building faces.
  const jitter = (p: { x: number; y: number }, salt: number) => ({
    x: p.x + ((seed >>> (salt * 3)) % 13) - 6,
    y: p.y + 2 + ((seed >>> (salt * 3 + 2)) % 9),
  });
  return { home, stops: [home, jitter(work, 1), jitter(wander, 2), jitter(hearth, 3)] };
}

/** Position/pose of `npc` at `time` (sim seconds) following its daily routine.
 * Travel between stops is linear at ROUTINE_SPEED; leftover slot time is dwell. */
export function npcRoutinePosition(npc: TownNPC, town: Settlement, time: number): { x: number; y: number; angle: number; moving: number } {
  const { stops } = npcRoutine(npc, town);
  const day = WORLD_TIME.daySeconds;
  // Per-NPC phase (±45 min) staggers schedules inside one town.
  const phase = ((npc.seed % 91) - 45) * 60;
  const t = ((time + phase) % day + day) % day;
  const frac = t / day;
  let slot = ROUTINE_SLOTS.length - 1;
  for (let i = 0; i < ROUTINE_SLOTS.length; i++)
    if (frac >= ROUTINE_SLOTS[i].start) slot = i;
  const here = stops[ROUTINE_SLOTS[slot].stop];
  const nextStart = slot === ROUTINE_SLOTS.length - 1 ? 1 : ROUTINE_SLOTS[slot + 1].start;
  const slotLen = (nextStart - ROUTINE_SLOTS[slot].start) * day;
  const dest = stops[ROUTINE_SLOTS[(slot + 1) % ROUTINE_SLOTS.length].stop];
  const travel = Math.hypot(dest.x - here.x, dest.y - here.y) / ROUTINE_SPEED;
  const dwell = Math.max(0, slotLen - travel);
  const into = frac * day - ROUTINE_SLOTS[slot].start * day;
  if (into < dwell || travel <= 0)
    return { x: here.x, y: here.y, angle: Math.atan2(town.y - here.y, town.x - here.x), moving: 0 };
  const u = Math.min(1, (into - dwell) / travel);
  return { x: here.x + (dest.x - here.x) * u, y: here.y + (dest.y - here.y) * u,
    angle: Math.atan2(dest.y - here.y, dest.x - here.x), moving: .3 };
}

/** The NPC's settlement: the town whose building list contains its anchor. */
export function npcTown(world: WorldQuery & { getSettlements?(x: number, y: number, w: number, h: number): readonly Settlement[] }, npc: TownNPC): Settlement | undefined {
  return (world.getSettlements?.(npc.x - 1400, npc.y - 1400, 2800, 2800) ?? [])
    .find(town => town.buildings.some(b => b.id === npc.buildingId));
}

/** `npc` moved to its routine position at `time`; unchanged when the town is
 * unknown or `time` is undefined (map views, tests, static contexts). */
export function positionedNPC<T extends TownNPC>(npc: T, town: Settlement | undefined, time: number | undefined): T {
  if (town === undefined || time === undefined || npc.role === 'stash') return npc;
  const pose = npcRoutinePosition(npc, town, time);
  return { ...npc, x: pose.x, y: pose.y, angle: pose.angle, moving: pose.moving };
}
