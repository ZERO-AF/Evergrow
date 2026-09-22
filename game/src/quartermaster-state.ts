/** Quartermaster state (docs/wow-deepening.md — second wave): which faction a
 * quartermaster NPC serves, and the standing + gold gate on each stock row.
 * Pure helpers only — the durable purchase lives in quartermaster-command.ts. */
import { canAfford, type GoldWallet } from './wallet.ts';
import type { TownNPC } from './npcs.ts';
import {
  FACTION_BY_ID, STANDING_BY_TIER,
  type FactionDef, type FactionReward,
} from './reputation-content.ts';
import {
  factionForNpc, standingIndex, standingOf, type ReputationCarrier,
} from './reputation-state.ts';
import { quartermasterPrice } from './quartermaster-content.ts';

/** The faction a quartermaster serves: the settlement's zone faction via
 * factionForNpc (home settlement → Stormwind, else the sampled biome's
 * faction), falling back to the NPC's faction tag axis when the zone maps to
 * no reputation faction. */
export function quartermasterFaction(npc: Pick<TownNPC, 'buildingId' | 'x' | 'y' | 'faction'>, worldSeed = 7319): FactionDef | undefined {
  const zoned = factionForNpc(npc, worldSeed);
  if (zoned) return zoned;
  return npc.faction === 'alliance' ? FACTION_BY_ID.stormwind
    : npc.faction === 'horde' ? FACTION_BY_ID.warsong
    : undefined;
}
/** Why `player` cannot buy `reward` from `faction`'s quartermaster, or null
 * when the purchase is allowed: the standing gate first, then the discounted
 * gold price. The reputation ledger rides on the player; the gold wallet on
 * `player.character`. Pack space is validated by the buy command. */
export function quartermasterBuyProblem(player: ReputationCarrier & { character: GoldWallet }, faction: FactionDef, reward: FactionReward): string | null {
  if (reward.kind === 'gold') return 'That item is not sold here.';
  const standing = standingOf(player, faction.id);
  if (standingIndex(standing.tier) < standingIndex(reward.standing))
    return `Requires ${STANDING_BY_TIER[reward.standing].label} with ${faction.name}.`;
  if (!canAfford(player.character, quartermasterPrice(player, faction, reward))) return 'Not enough gold.';
  return null;
}

/** Standing + gold gate as a boolean (quartermasterBuyProblem carries the reason). */
export function canBuy(player: ReputationCarrier & { character: GoldWallet }, faction: FactionDef, reward: FactionReward): boolean {
  return quartermasterBuyProblem(player, faction, reward) === null;
}

