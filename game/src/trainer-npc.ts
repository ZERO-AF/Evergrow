/** Class trainer NPCs (WotLK): a standalone service NPC beside the chapel —
 * the enchanter stands inside at the altar, the trainer waits just outside the
 * door — selling class skills and rank upgrades for gold (trainer-command.ts).
 * Follows the battlemaster/stable-master pattern: deterministic id, seeded
 * name, zone level and faction from the anchor building. */
import type { Building } from './settlements.ts';
import type { WorldQuery } from './model.ts';
import { focusNPC, memoFixture, npcsNear, serviceFixture, type TownNPC } from './npcs.ts';

/** Trainers stand beside the chapel door — a standalone service NPC like the
 * stable master, not a building kind. Every settlement raises a chapel. */
export type Trainer = TownNPC & { role: 'trainer' };
const TRAINER_NAMES = ['Aelthas', 'Brynna', 'Corvin', 'Daria', 'Emeric', 'Faelan', 'Gretta', 'Haldor'] as const;
export const trainerFor = memoFixture((building: Building): Trainer | null =>
  serviceFixture(building, 'chapel', 'trainer', 52, 24, TRAINER_NAMES));
export function trainersNear(world: WorldQuery, x: number, y: number, width: number, height: number): Trainer[] {
  return npcsNear(world, x, y, width, height, trainerFor);
}
export function focusedTrainer(trainers: readonly Trainer[], player: { x: number; y: number; dead?: boolean }, world: WorldQuery,
  pointer?: { x: number; y: number }): Trainer | null {
  return focusNPC(trainers, player, world, pointer);
}
