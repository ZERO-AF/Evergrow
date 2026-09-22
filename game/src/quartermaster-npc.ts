/** Reputation quartermaster NPCs (docs/wow-deepening.md — second wave): a
 * standalone service NPC at the noble hall — across the door from the badge
 * vendor — selling the settlement faction's standing-gated gear for gold.
 * Battlemaster pattern: `quartermasterFor(building)` anchors to 'noble'
 * buildings, `quartermastersNear` scans a world rect, `focusedQuartermaster`
 * picks the interactable NPC nearest the player. */
import type { Building } from './settlements.ts';
import type { WorldQuery } from './model.ts';
import { getZoneAt } from './zone-progression.ts';
import { canInteractNPC, hashService, type TownNPC } from './npcs.ts';
import { factionAt } from './factions.ts';

/** Quartermasters stand beside the Count's Hall in cities — a standalone
 * service NPC like the battlemaster, not a building kind. */
export type Quartermaster = TownNPC & { role: 'quartermaster' };
const QUARTERMASTER_NAMES = ['Aliocha', 'Mendora', 'Corik', 'Fedryen', 'Grella', 'Mera', 'Nakodu', 'Sloane'] as const;
export function quartermasterFor(building: Building): Quartermaster | null {
  if (building.kind !== 'noble') return null;
  const x = building.door.x - 70, y = building.door.y + 78, id = `${building.id}:quartermaster`;
  const seed = hashService(id);
  return { settlementTier: building.settlementTier, id, buildingId: building.id, role: 'quartermaster', x, y, seed,
    name: QUARTERMASTER_NAMES[seed % QUARTERMASTER_NAMES.length],
    level: getZoneAt(x, y, Number(building.id.split(':')[1])).level, maxLevel: getZoneAt(x, y, Number(building.id.split(':')[1])).maxLevel, faction: factionAt(x, y) };
}
export function quartermastersNear(world: WorldQuery, x: number, y: number, width: number, height: number): Quartermaster[] {
  return (world.getBuildings?.(x, y, width, height) ?? [])
    .map(quartermasterFor).filter((master): master is Quartermaster => master !== null);
}
export function focusedQuartermaster(masters: readonly Quartermaster[], player: { x: number; y: number; dead?: boolean }, world: WorldQuery,
  pointer?: { x: number; y: number }): Quartermaster | null {
  return masters.filter(master => canInteractNPC(master, player, world) && (!pointer || Math.hypot(pointer.x - master.x, pointer.y - (master.y - 17)) <= 28))
    .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0] ?? null;
}
