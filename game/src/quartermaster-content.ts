/** Reputation quartermaster stock (docs/wow-deepening.md — second wave):
 * each faction's standing-gated FactionReward list re-priced in gold for its
 * in-world quartermaster NPC. Standing still gates eligibility — the shop
 * lists locked rows with their required standing; the durable buy lives in
 * quartermaster-command.ts. Gold-bounty rewards are claim-only (selling gold
 * for gold is meaningless) and never appear in stock. */
import { toCopper } from './currency.ts';
import { generateRewardItem } from './items.ts';
import { hashService } from './npcs.ts';
import { PROFESSION_MATERIALS } from './profession-content.ts';
import { tabardForFaction, tabardItem } from './tabard-content.ts';
import type { Item, ItemTier } from './character-types.ts';
import {
  FACTION_BY_ID, STANDING_BY_TIER, isFactionId,
  type FactionDef, type FactionId, type FactionReward, type StandingTier,
} from './reputation-content.ts';
import {
  repDiscount, standingIndex, standingOf, type ReputationCarrier,
} from './reputation-state.ts';

/** One purchasable stock row derived from a faction reward. */
export interface QuartermasterStockEntry {
  /** The underlying FactionReward id — the buy command takes this. */
  readonly rewardId: string;
  readonly name: string;
  readonly kind: 'gear' | 'tabard' | 'material';
  readonly requiredStanding: StandingTier;
  /** Price after the player's standing discount (copper). */
  readonly goldCost: number;
  /** Undiscounted price (copper) — shown struck-through when discounted. */
  readonly listPrice: number;
  /** Rolled preview for gear/tabard rows; null for material rows. */
  readonly item: Item | null;
  /** Material rows: id + count granted per purchase. */
  readonly material?: { readonly id: string; readonly name: string; readonly count: number };
  /** Standing gate only — gold affordability is checked at buy time. */
  readonly eligible: boolean;
  /** Why the row is locked; undefined when the standing gate is met. */
  readonly reason?: string;
}

/** List prices in copper. Tabards match WotLK's 1g city-tabard price; gear
 * scales by tier; materials price per unit. */
const GEAR_PRICE: Readonly<Record<ItemTier, number>> = Object.freeze({
  common: toCopper(5), magic: toCopper(15), rare: toCopper(45),
  epic: toCopper(120), legendary: toCopper(250), unique: toCopper(150),
});
const TABARD_PRICE = toCopper(1);
const MATERIAL_UNIT_PRICE = toCopper(0, 75); // 75s per unit

/** Undiscounted copper price for a reward; 0 for kinds the quartermaster
 * does not sell (gold bounties are claim-only). */
export function quartermasterBasePrice(reward: FactionReward): number {
  switch (reward.kind) {
    case 'gear': return GEAR_PRICE[reward.tier];
    case 'tabard': return TABARD_PRICE;
    case 'material': return MATERIAL_UNIT_PRICE * reward.count;
    default: return 0;
  }
}

/** Standing-discounted price for `player` (copper, minimum 1). */
export function quartermasterPrice(player: ReputationCarrier, faction: FactionDef, reward: FactionReward): number {
  return Math.max(1, Math.round(quartermasterBasePrice(reward) * (1 - repDiscount(player, faction.id))));
}

/** Roll the reward's item the same way repClaimReward does: gear at the
 * buyer's level and tier, tabards minted from their definition. Returns null
 * for material/gold rows and for tabards with no definition. */
export function quartermasterRewardItem(reward: FactionReward, level: number, seed: number): Item | null {
  let item: Item | null = null;
  if (reward.kind === 'gear') item = generateRewardItem(seed, level, reward.slot, undefined, reward.tier);
  else if (reward.kind === 'tabard') {
    const def = tabardForFaction(reward.tabardFaction);
    if (def) item = tabardItem(def.id, seed);
  }
  if (item) { item.name = reward.name; item.baseName = reward.name; }
  return item;
}


/** A faction's quartermaster stock priced for `player`: every sellable reward
 * with its standing gate and discounted gold cost. Unknown factions and
 * gold-bounty rewards yield no rows. */
export function quartermasterStock(factionId: FactionId | string, player: ReputationCarrier & { level: number }): readonly QuartermasterStockEntry[] {
  const faction = isFactionId(factionId) ? FACTION_BY_ID[factionId] : undefined;
  if (!faction) return [];
  const standing = standingOf(player, faction.id);
  return faction.rewards.flatMap(reward => {
    if (reward.kind === 'gold') return [];
    const listPrice = quartermasterBasePrice(reward);
    const goldCost = quartermasterPrice(player, faction, reward);
    const locked = standingIndex(standing.tier) < standingIndex(reward.standing);
    const material = reward.kind === 'material'
      ? { id: reward.material, name: PROFESSION_MATERIALS[reward.material]?.name ?? reward.material, count: reward.count }
      : undefined;
    return [{
      rewardId: reward.id, name: reward.name, kind: reward.kind,
      requiredStanding: reward.standing, goldCost, listPrice,
      item: quartermasterRewardItem(reward, player.level, hashService(`qm:${faction.id}:${reward.id}`)),
      material, eligible: !locked,
      reason: locked ? `Requires ${STANDING_BY_TIER[reward.standing].label} with ${faction.name}.` : undefined,
    }];
  });
}
