import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { ActionResult, EquipmentSlot } from './character-types.ts';
import { canInteractNPC, type TownNPC } from './npcs.ts';
import { refreshCharacter } from './character.ts';
import { pushChatMessage } from './chat-log.ts';
import { planRepair, repairProblem, type DurabilityMap } from './durability.ts';

/** Checkpoint extension carrying the durability map (kept local so older saves stay valid). */
export type DurabilityCheckpoint = CharacterCheckpoint & { durability?: DurabilityMap };

/** Repair equipped gear at a blacksmith. All damaged slots, or one slot when given.
 * The caller holds simulation and other commands until this durable write completes. */
export async function repairInteract(sim: Simulation, npc: TownNPC,
  persist: (checkpoint: CharacterCheckpoint) => Promise<ActionResult>, slot?: EquipmentSlot): Promise<ActionResult> {
  const problem = repairProblem(npc);
  if (problem) return { ok: false, message: problem };
  if (!canInteractNPC(npc, sim.player, sim.world)) return { ok: false, message: 'This service is no longer in reach.' };
  const plan = planRepair(sim.player, slot);
  if (!plan.ok) return plan;
  const checkpoint = sim.captureCheckpoint() as DurabilityCheckpoint;
  checkpoint.character = plan.character;
  checkpoint.durability = plan.durability;
  // Repaired gear can raise maxHp/maxMana; persist the clamped pools like executeService.
  const candidate = { ...sim.player, character: plan.character, durability: plan.durability };
  refreshCharacter(candidate);
  checkpoint.hp = candidate.hp; checkpoint.mana = candidate.mana;
  let saved: ActionResult;
  try { saved = await persist(checkpoint); }
  catch { return { ok: false, message: 'Could not save. No gold changed.' }; }
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. No gold changed.' };
  sim.player.character = plan.character;
  sim.player.durability = plan.durability;
  refreshCharacter(sim.player);
  pushChatMessage(sim.player, 'system', plan.message, sim.time);
  return { ok: true, message: plan.message };
}
