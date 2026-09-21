import { vendorIdentity } from './vendor-identity.ts';
import type { SettlementTier } from './settlement-services.ts';
import type { Building } from './settlements.ts';
import { getZoneAt } from './zone-progression.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import type { WorldQuery } from './model.ts';
import { factionAt, factionHostility, raceFaction, type FactionTag } from './factions.ts';
import type { WowRaceId } from './wow-types.ts';
import { GAME_FEATURES } from './game-features.ts';

export type NPCRole = 'blacksmith' | 'jeweler' | 'enchanter' | 'gambler' | 'stash' | 'stable' | 'battlemaster' | 'pvpVendor';
export interface TownNPC { settlementTier?:SettlementTier; id: string; name: string; role: NPCRole; x: number; y: number; level: number; maxLevel?: number; seed: number; buildingId: string;
  /** Faction the NPC serves (factions.ts); opposing-faction players can't use its services. */
  faction?: FactionTag; }
export const NPC_NAMES: Record<NPCRole, string> = { blacksmith: 'Blacksmith', jeweler: 'Jeweler', enchanter: 'Enchanter', gambler: 'Gambler', stash: 'Storage', stable: 'Stable Master', battlemaster: 'Battlemaster', pvpVendor: 'PvP Quartermaster' };
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
