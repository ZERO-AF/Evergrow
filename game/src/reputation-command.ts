/** Reputation commands (docs/wow-deepening.md — second wave): the live gain
 * hooks (repOnKill / repOnQuestTurnIn / repOnDungeonClear) and the durable
 * quartermaster-style reward claim. Gains mutate the live ledger and ride the
 * next checkpoint like quest progress; the claim stages on a checkpoint clone,
 * persists, then commits — mirroring glyph-command/quest-command. */
import { cloneData } from './data-clone.ts';
import { addInventoryItem } from './inventory.ts';
import { canPackItem } from './inventory-grid.ts';
import { generateRewardItem } from './items.ts';
import { creditGold } from './wallet.ts';
import { refreshCharacter } from './character.ts';
import { pushChatMessage } from './chat-log.ts';
import { formatWalletCompact } from './currency.ts';
import { hashService } from './npcs.ts';
import { grantMaterial, type ProfessionsCarrier } from './profession-state.ts';
import { PROFESSION_MATERIALS } from './profession-content.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { ActionResult } from './character-types.ts';
import type { Enemy } from './model.ts';
import type { Simulation } from './simulation.ts';
import type { DungeonThemeId } from './dungeon-content.ts';
import type { QuestDef } from './quest-content.ts';
import {
  FACTION_BY_ID, isFactionId, type FactionDef, type FactionId, type FactionReward,
} from './reputation-content.ts';
import {
  applyKillReputation, applyReputation, factionForDungeon, factionForQuest,
  reputationEnabled, rewardProblem, stageClaim,
  type RepGain, type ReputationCarrier,
} from './reputation-state.ts';

export type ReputationResult = ActionResult;
export type ReputationPersist = (checkpoint: CharacterCheckpoint) => ActionResult | Promise<ActionResult>;

/** The checkpoint fields this feature stages; the integrator persists them on save. */
export type CheckpointWithReputation = CharacterCheckpoint & ReputationCarrier & ProfessionsCarrier;

// ── Live gain hooks (call sites: kill path, quest turn-in, dungeon clear) ────

/** Report a gain through the combat log; standing changes get a discovery line. */
function reportGain(sim: Simulation, gain: RepGain): void {
  if (gain.applied <= 0) return;
  pushChatMessage(sim.player, 'system',
    `Reputation with ${gain.faction.name} increased by ${gain.applied}.`, sim.time);
  if (gain.changed)
    pushChatMessage(sim.player, 'discovery',
      `You are now ${gain.changed.label} with ${gain.faction.name}.`, sim.time);
}

/** Kill path: feed the slain enemy (kind, biome, rank, dungeonTheme). Returns
 * the applied gain so the caller can surface it; undefined when no faction
 * claims the kill or its kill cap is reached. */
export function repOnKill(sim: Simulation, enemy: Pick<Enemy, 'kind' | 'biome' | 'rank'> & { dungeonTheme?: DungeonThemeId }): RepGain | undefined {
  if (!reputationEnabled()) return undefined;
  // `reputation` joins Player with the integrator's checkpoint field; widen here.
  const gain = applyKillReputation(sim.player as Simulation['player'] & ReputationCarrier, enemy);
  if (gain) reportGain(sim, gain);
  return gain;
}

/** Quest turn-in: credit the quest's faction (explicit map → zone → giver
 * biome). Call inside questCommand's turn-in branch after questTurnIn succeeds. */
export function repOnQuestTurnIn(sim: Simulation, def: QuestDef): RepGain | undefined {
  if (!reputationEnabled()) return undefined;
  const faction = factionForQuest(def);
  if (!faction) return undefined;
  const gain = applyReputation(sim.player as Simulation['player'] & ReputationCarrier, faction.id, faction.questRep);
  reportGain(sim, gain);
  return gain;
}

/** Dungeon/raid clear: credit the entrance's faction (raid id → theme). Call
 * once per clear — when the boss falls or the entrance joins
 * `expeditions.cleared`. */
export function repOnDungeonClear(sim: Simulation, entrance: { id: string; theme?: DungeonThemeId }): RepGain | undefined {
  if (!reputationEnabled()) return undefined;
  const faction = factionForDungeon(entrance);
  if (!faction) return undefined;
  const gain = applyReputation(sim.player as Simulation['player'] & ReputationCarrier, faction.id, faction.clearRep);
  reportGain(sim, gain);
  return gain;
}

// ── Reward claim (durable) ───────────────────────────────────────────────────

export function findReward(factionId: string, rewardId: string): { faction: FactionDef; reward: FactionReward } | undefined {
  const faction = isFactionId(factionId) ? FACTION_BY_ID[factionId] : undefined;
  const reward = faction?.rewards.find(r => r.id === rewardId);
  return faction && reward ? { faction, reward } : undefined;
}

/** Claim a standing-gated reward: gear is generated at the player's level,
 * gold credits the wallet, materials ride the profession bags. */
export async function repClaimReward(sim: Simulation, factionId: FactionId, rewardId: string, persist: ReputationPersist): Promise<ReputationResult> {
  // `reputation` joins Player with the integrator's checkpoint field; widen here.
  const p = sim.player as Simulation['player'] & ReputationCarrier;
  const found = findReward(factionId, rewardId);
  if (!found) return { ok: false, message: 'Unknown reward.' };
  if (p.dead) return { ok: false, message: 'You are dead.' };
  const { faction, reward } = found;
  const problem = rewardProblem(p, faction, reward);
  if (problem) return { ok: false, message: problem };
  const checkpoint = sim.captureCheckpoint() as CheckpointWithReputation;
  checkpoint.reputation = cloneData(p.reputation) as CheckpointWithReputation['reputation'];
  if (reward.kind === 'material') checkpoint.professions = cloneData(p.professions) as CheckpointWithReputation['professions'];
  const item = reward.kind === 'gear'
    ? generateRewardItem(hashService(`rep:${faction.id}:${reward.id}`), p.level, reward.slot, undefined, reward.tier)
    : null;
  if (item) {
    item.name = reward.name;
    item.baseName = reward.name;
    item.id += `:rep:${reward.id}`;
    if (!canPackItem(checkpoint.character, item)) return { ok: false, message: 'Your bags are full.' };
  }
  if (reward.kind === 'gold' && !creditGold(checkpoint.character, reward.copper))
    return { ok: false, message: 'Your purse cannot hold the reward.' };
  if (reward.kind === 'material' && !grantMaterial(checkpoint, reward.material, reward.count))
    return { ok: false, message: `Unknown material: ${reward.material}.` };
  if (item) addInventoryItem(checkpoint.character, item);
  stageClaim(checkpoint, faction.id, reward);
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. The reward was not claimed.' };
  p.reputation = checkpoint.reputation;
  if (reward.kind === 'material') p.professions = checkpoint.professions;
  p.character = checkpoint.character;
  refreshCharacter(p);
  const received = item ? `[${item.name}]`
    : reward.kind === 'gold' ? formatWalletCompact(reward.copper)
    : reward.kind === 'material' ? `${reward.count}× [${PROFESSION_MATERIALS[reward.material]?.name ?? reward.material}]`
    : reward.name;
  const message = `Received ${received} from ${faction.name}.`;
  pushChatMessage(p, 'loot', message, sim.time);
  return { ok: true, message };
}

