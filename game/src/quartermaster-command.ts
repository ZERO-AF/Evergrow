/** Quartermaster purchase command (docs/wow-deepening.md — second wave): the
 * durable gold buy for a faction quartermaster's standing-gated stock.
 * Mirrors repClaimReward's item production (gear rolls at the buyer's level,
 * tabards mint from their definition, materials ride the profession bags) on
 * the badge-vendor checkpoint pattern: validate → stage → persist → commit.
 * Unlike repClaimReward, purchases are repeatable — no claim marker. */
import { addInventoryItem } from './inventory.ts';
import { canPackItem } from './inventory-grid.ts';
import { spendGold } from './wallet.ts';
import { refreshCharacter } from './character.ts';
import { pushChatMessage } from './chat-log.ts';
import { formatWalletCompact } from './currency.ts';
import { hashService, canInteractNPC, type TownNPC } from './npcs.ts';
import { grantMaterial, type ProfessionsCarrier } from './profession-state.ts';
import { PROFESSION_MATERIALS } from './profession-content.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { ActionResult } from './character-types.ts';
import type { Simulation } from './simulation.ts';
import { findReward, type ReputationPersist } from './reputation-command.ts';
import type { ReputationCarrier } from './reputation-state.ts';
import { quartermasterRewardItem, quartermasterPrice } from './quartermaster-content.ts';
import { quartermasterBuyProblem, quartermasterFaction } from './quartermaster-state.ts';

export type QuartermasterResult = ActionResult;
export type QuartermasterPersist = ReputationPersist;

/** The checkpoint fields this feature stages; the integrator persists them on save. */
export type CheckpointWithQuartermaster = CharacterCheckpoint & ProfessionsCarrier;

/** Buy a stock row from a quartermaster: validates standing + gold on the
 * live player, debits the wallet and grants the item on a checkpoint clone,
 * persists, then commits. */
export async function executeQuartermasterBuy(sim: Simulation, npc: TownNPC, rewardId: string, persist: QuartermasterPersist): Promise<QuartermasterResult> {
  const p = sim.player as Simulation['player'] & ReputationCarrier;
  const faction = quartermasterFaction(npc);
  if (!faction) return { ok: false, message: 'This quartermaster serves no faction.' };
  const found = findReward(faction.id, rewardId);
  if (!found) return { ok: false, message: 'That item is not sold here.' };
  const { reward } = found;
  if (p.dead) return { ok: false, message: 'You are dead.' };
  if (!canInteractNPC(npc, p, sim.world)) return { ok: false, message: 'The quartermaster is no longer in reach.' };
  const problem = quartermasterBuyProblem(p, faction, reward);
  if (problem) return { ok: false, message: problem };
  const price = quartermasterPrice(p, faction, reward);
  const checkpoint = sim.captureCheckpoint() as CheckpointWithQuartermaster;
  const item = quartermasterRewardItem(reward, p.level,
    ((checkpoint.character.commerce.operations + 1) * 0x9e3779b1 + hashService(`qm:${faction.id}:${reward.id}`)) >>> 0);
  if (item) {
    item.id += `:qm:${reward.id}:${checkpoint.character.commerce.operations}`;
    if (!canPackItem(checkpoint.character, item)) return { ok: false, message: 'Your bags are full.' };
  }
  if (!spendGold(checkpoint.character, price)) return { ok: false, message: 'Not enough gold.' };
  if (reward.kind === 'material' && !grantMaterial(checkpoint, reward.material, reward.count))
    return { ok: false, message: `Unknown material: ${reward.material}.` };
  if (item) addInventoryItem(checkpoint.character, item);
  checkpoint.character.commerce.operations++;
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. No gold was spent.' };
  if (reward.kind === 'material') p.professions = checkpoint.professions;
  p.character = checkpoint.character;
  refreshCharacter(p);
  const received = item ? `[${item.name}]`
    : reward.kind === 'material' ? `${reward.count}× [${PROFESSION_MATERIALS[reward.material]?.name ?? reward.material}]`
    : reward.name;
  const message = `Bought ${received} from ${faction.name} for ${formatWalletCompact(price)}.`;
  pushChatMessage(p, 'loot', message, sim.time);
  return { ok: true, message };
}
