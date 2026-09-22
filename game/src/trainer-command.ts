/** Class trainer purchases (WotLK): learn a class skill or buy its next rank
 * for gold. Mirrors executeBadgeBuy's durable shape — validate on the live
 * player, stage on a captured checkpoint, persist, then commit the staged
 * sheet and refresh projections.
 *
 * Grant mechanism: learning pushes the skill's class-sanctum node
 * (`wow-<classId>-<skillId>`) onto `allocatedNodes` — the same node the atlas
 * allocates — so knowsSkill, unlockedSkills, skill slots and the spellbook all
 * see it. Because no skill point was spent, the purchase is recorded on the
 * sheet's `trained` ledger (trainer-state.ts) so the save's point-conservation
 * and connectivity checks can exempt it. Rank buys bump `skillRanks`/
 * `activeSkillRanks` exactly like upgradeSkill, minus the skill point, and
 * count themselves in `trained.ranks`.
 *
 * Integrator seams (Main): CharacterSheet gains `trained?: TrainedSkills`;
 * validSheet validates it via validTrainerLedger, seeds connectivity with
 * trainedNodeIds, and subtracts trained nodes/ranks from the point ledger;
 * respec (commerce.ts + skill-tree-upgrade.ts) and dual-spec
 * (dual-spec-state.ts) preserve trained nodes/ranks. */
import type { Simulation } from './simulation.ts';
import type { ActionResult, SkillId } from './character-types.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import { spendGold } from './wallet.ts';
import { refreshCharacter } from './character.ts';
import { pushChatMessage } from './chat-log.ts';
import { formatWalletCompact } from './currency.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { learnedSkillRank } from './skill-progression.ts';
import { canLearnSkill, canUpgradeRank, ensureTrained, learnPrice, rankPrice, type TrainedSheet } from './trainer-state.ts';

type TrainerPersist = (checkpoint: CharacterCheckpoint) => Promise<ActionResult>;

/** Learn a class skill for gold: validates level/kit/gold, debits the wallet,
 * allocates the sanctum node and records it in the trained ledger. */
export async function executeLearnSkill(sim: Simulation, skillId: SkillId, persist: TrainerPersist): Promise<ActionResult> {
  const p = sim.player;
  const problem = canLearnSkill(p, skillId);
  if (problem) return { ok: false, message: problem };
  const checkpoint = sim.captureCheckpoint();
  const sheet = checkpoint.character as TrainedSheet;
  const price = learnPrice(skillId)!;
  if (!spendGold(sheet, price)) return { ok: false, message: 'Not enough gold.' };
  const nodeId = `wow-${sheet.classId}-${skillId}`;
  if (!sheet.allocatedNodes.includes(nodeId)) sheet.allocatedNodes.push(nodeId);
  ensureTrained(sheet).skills.push(skillId);
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. No gold was spent.' };
  p.character = checkpoint.character;
  refreshCharacter(p);
  const message = `Learned ${SKILL_DEFINITIONS[skillId].name} for ${formatWalletCompact(price)}.`;
  pushChatMessage(p, 'loot', message, sim.time);
  return { ok: true, message };
}

/** Buy the next rank of a known class skill for gold: same rank bump as
 * upgradeSkill, paid in gold and ledgered in trained.ranks. */
export async function executeUpgradeRank(sim: Simulation, skillId: SkillId, persist: TrainerPersist): Promise<ActionResult> {
  const p = sim.player;
  const problem = canUpgradeRank(p, skillId);
  if (problem) return { ok: false, message: problem };
  const checkpoint = sim.captureCheckpoint();
  const sheet = checkpoint.character as TrainedSheet;
  const price = rankPrice(sheet, skillId)!;
  if (!spendGold(sheet, price)) return { ok: false, message: 'Not enough gold.' };
  const rank = learnedSkillRank(sheet, skillId) + 1;
  sheet.skillRanks[skillId] = rank;
  sheet.activeSkillRanks[skillId] = rank;
  const ledger = ensureTrained(sheet);
  ledger.ranks[skillId] = (ledger.ranks[skillId] ?? 0) + 1;
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. No gold was spent.' };
  p.character = checkpoint.character;
  refreshCharacter(p);
  const message = `Trained ${SKILL_DEFINITIONS[skillId].name} rank ${rank} for ${formatWalletCompact(price)}.`;
  pushChatMessage(p, 'loot', message, sim.time);
  return { ok: true, message };
}
