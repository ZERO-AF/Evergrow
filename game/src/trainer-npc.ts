/** Class trainer NPCs (WotLK): a standalone service NPC beside the chapel —
 * the enchanter stands inside at the altar, the trainer waits just outside the
 * door — selling class skills and rank upgrades for gold (trainer-command.ts).
 * Follows the battlemaster/stable-master pattern: deterministic id, seeded
 * name, zone level and faction from the anchor building. */
import type { Building } from './settlements.ts';
import type { WorldQuery } from './model.ts';
import { getZoneAt } from './zone-progression.ts';
import { canInteractNPC, hashService, memoFixture, type TownNPC } from './npcs.ts';
import { factionAt } from './factions.ts';

/** Trainers stand beside the chapel door — a standalone service NPC like the
 * stable master, not a building kind. Every settlement raises a chapel. */
export type Trainer = TownNPC & { role: 'trainer' };
const TRAINER_NAMES = ['Aelthas', 'Brynna', 'Corvin', 'Daria', 'Emeric', 'Faelan', 'Gretta', 'Haldor'] as const;
export const trainerFor = memoFixture((building: Building): Trainer | null => {
  if (building.kind !== 'chapel') return null;
  const x = building.door.x + 52, y = building.door.y + 24, id = `${building.id}:trainer`;
  const seed = hashService(id);
  const zone = getZoneAt(x, y, Number(building.id.split(':')[1]));
  return { settlementTier: building.settlementTier, id, buildingId: building.id, role: 'trainer', x, y, seed,
    name: TRAINER_NAMES[seed % TRAINER_NAMES.length],
    level: zone.level, maxLevel: zone.maxLevel, faction: factionAt(x, y) };
});
export function trainersNear(world: WorldQuery, x: number, y: number, width: number, height: number): Trainer[] {
  return (world.getBuildings?.(x, y, width, height) ?? [])
    .map(trainerFor).filter((trainer): trainer is Trainer => trainer !== null);
}
export function focusedTrainer(trainers: readonly Trainer[], player: { x: number; y: number; dead?: boolean }, world: WorldQuery,
  pointer?: { x: number; y: number }): Trainer | null {
  return trainers.filter(trainer => canInteractNPC(trainer, player, world) && (!pointer || Math.hypot(pointer.x - trainer.x, pointer.y - (trainer.y - 17)) <= 28))
    .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0] ?? null;
}
