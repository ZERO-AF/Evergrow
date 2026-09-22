/** Pet talent commands (WotLK hunter pet trees): learn a rank, reset the
 * build. Every mutation flows through the durable checkpoint path —
 * capture → mutate the parsed copy → persist → commit — mirroring
 * glyph-command.ts. Presentation code never mutates pet state. */
import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { ActionResult } from './character-types.ts';
import { petStatsFor } from './pet-content.ts';
import { allocatePetTalent, resetPetTalents } from './pet-talent-state.ts';
import { PET_TALENTS } from './pet-talent-content.ts';
import { pushChatMessage } from './chat-log.ts';

type Persist = (checkpoint: CharacterCheckpoint) => Promise<ActionResult>;

/** Re-derive the live pet ally's stats after a talent change (petStatsFor). */
function refreshPetAlly(sim: Simulation): void {
  const ally = sim.petAlly();
  const pet = sim.player.character.pets?.active;
  if (!ally || !pet) return;
  const stats = petStatsFor(pet);
  ally.hp = Math.min(stats.maxHp, ally.hp + Math.max(0, stats.maxHp - ally.maxHp));
  ally.maxHp = stats.maxHp;
  ally.damage = stats.damage;
}

/** Spend one point on `talentId` for the active pet. */
export async function executePetTalentLearn(sim: Simulation, talentId: string, persist: Persist): Promise<ActionResult> {
  const p = sim.player;
  const checkpoint = sim.captureCheckpoint();
  const stable = checkpoint.character.pets;
  const pet = stable?.active;
  if (!stable || !pet) return { ok: false, message: 'No active pet.' };
  const result = allocatePetTalent(pet, talentId);
  if (!result.ok) return result;
  stable.active = result.pet;
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. The talent was not learned.' };
  p.character = checkpoint.character;
  refreshPetAlly(sim);
  const talent = PET_TALENTS[talentId]!;
  const message = `${pet.name} learned ${talent.name} (rank ${result.pet.talents![talentId]}).`;
  pushChatMessage(p, 'system', message, sim.time);
  return { ok: true, message };
}

/** Refund every pet talent point on the active pet. */
export async function executePetTalentReset(sim: Simulation, persist: Persist): Promise<ActionResult> {
  const p = sim.player;
  const checkpoint = sim.captureCheckpoint();
  const stable = checkpoint.character.pets;
  const pet = stable?.active;
  if (!stable || !pet) return { ok: false, message: 'No active pet.' };
  if (!pet.talents || !Object.keys(pet.talents).length) return { ok: false, message: `${pet.name} has no talents to reset.` };
  stable.active = resetPetTalents(pet);
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. The talents were not reset.' };
  p.character = checkpoint.character;
  refreshPetAlly(sim);
  const message = `${pet.name}'s talents were reset.`;
  pushChatMessage(p, 'system', message, sim.time);
  return { ok: true, message };
}
