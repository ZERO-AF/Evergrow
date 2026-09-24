/** Reputation quartermaster NPCs (docs/wow-deepening.md — second wave): a
 * standalone service NPC at the noble hall — across the door from the badge
 * vendor — selling the settlement faction's standing-gated gear for gold.
 * Battlemaster pattern: `quartermasterFor(building)` anchors to 'noble'
 * buildings, `quartermastersNear` scans a world rect, `focusedQuartermaster`
 * picks the interactable NPC nearest the player. */
import type { Building } from './settlements.ts';
import type { WorldQuery } from './model.ts';
import { focusNPC, memoFixture, npcsNear, serviceFixture, type TownNPC } from './npcs.ts';

/** Quartermasters stand beside the Count's Hall in cities — a standalone
 * service NPC like the battlemaster, not a building kind. */
export type Quartermaster = TownNPC & { role: 'quartermaster' };
const QUARTERMASTER_NAMES = ['Aliocha', 'Mendora', 'Corik', 'Fedryen', 'Grella', 'Mera', 'Nakodu', 'Sloane'] as const;
export const quartermasterFor = memoFixture((building: Building): Quartermaster | null =>
  serviceFixture(building, 'noble', 'quartermaster', -70, 78, QUARTERMASTER_NAMES));
export function quartermastersNear(world: WorldQuery, x: number, y: number, width: number, height: number): Quartermaster[] {
  return npcsNear(world, x, y, width, height, quartermasterFor);
}
export function focusedQuartermaster(masters: readonly Quartermaster[], player: { x: number; y: number; dead?: boolean }, world: WorldQuery,
  pointer?: { x: number; y: number }): Quartermaster | null {
  return focusNPC(masters, player, world, pointer);
}
