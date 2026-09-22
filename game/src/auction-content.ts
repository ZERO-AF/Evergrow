/**
 * Auction House content (WotLK-style local market): immutable rules, the
 * listing/sale shapes, and the seeded NPC seller stock that rotates on a fixed
 * six-hour epoch. NPC listings are pure functions of the epoch — they are never
 * persisted; the sheet only records which ids the player already claimed.
 */
import type { Item, ItemKind, ItemTier } from './character-types.ts';
import { generateItem } from './items.ts';
import { itemPrice } from './commerce.ts';
import { isGemItem, createGemForSeed } from './gem-content.ts';
import { CONSUMABLES, createConsumableItem } from './consumable-content.ts';
import { stockCategory } from './service-presentation.ts';
import { randomSource } from './random-source.ts';
import { hashService } from './npcs.ts';
import { normalizeLevel } from './progression-content.ts';

export type AuctionSeller = 'player' | 'npc';

/** One posted auction. `item` is a snapshot: the listing owns it until sold,
 * expired, cancelled or bought out. `expired` marks a finished auction whose
 * item is still held because the owner's pack had no room (WoW's mail crate). */
export interface AuctionListing {
  id: string;
  item: Item;
  /** Whole-copper buyout price. */
  buyout: number;
  durationHours: number;
  /** Wall-clock ms when the auction was posted. */
  postedAt: number;
  /** Wall-clock ms when the auction ends. */
  expiresAt: number;
  seller: AuctionSeller;
  /** Flavor name for NPC sellers; undefined for the player's own auctions. */
  sellerName?: string;
  /** Finished auction holding its item until the owner has pack room. */
  expired?: true;
  /** Reserved for open bidding; buyout-only market leaves it empty. */
  bids?: { bidder: string; amount: number; at: number }[];
}

/** Receipt of a completed player sale; proceeds ride `auctionHouse.gold`. */
export interface AuctionSale {
  id: string;
  item: Item;
  price: number;
  deposit: number;
  soldAt: number;
}

export const AUCTION_DURATIONS = Object.freeze([12, 24, 48] as const);
export type AuctionDuration = (typeof AUCTION_DURATIONS)[number];
/** WotLK deposit: 5% of buyout per 24h of listing time (2.5%/5%/10%). */
export const AUCTION_DEPOSIT_RATE = 0.05;
/** WotLK faction-house cut taken from the winning price. */
export const AUCTION_CUT_RATE = 0.05;
/** NPC stock rotates as one block every six hours of wall-clock time. */
export const AUCTION_EPOCH_MS = 6 * 3_600_000;
export const NPC_STOCK_COUNT = 14;
/** Caps keep the persisted ledger bounded. */
export const MAX_PLAYER_LISTINGS = 40;
export const MAX_AUCTION_SALES = 50;
export const MAX_AUCTION_LISTINGS = 200;
export const MAX_BUYOUT = 1_000_000_000;

/** The rotating stock epoch a wall-clock instant belongs to. */
export const auctionEpoch = (now: number): number => Math.floor(now / AUCTION_EPOCH_MS);

/** Deposit charged at posting; refunded on a sale, forfeited otherwise. */
export const auctionDeposit = (buyout: number, durationHours: number): number =>
  Math.max(1, Math.ceil(buyout * AUCTION_DEPOSIT_RATE * (durationHours / 24)));

/** House cut taken out of the buyout when the auction sells. */
export const auctionCut = (buyout: number): number => Math.floor(buyout * AUCTION_CUT_RATE);

/** What the market thinks an item is worth: the vendor's retail price. */
export const marketValue = (item: Item): number => Math.max(1, itemPrice(item, 'buy'));

/** Suggested player buyout: a discount under vendor retail so it can sell. */
export const suggestedBuyout = (item: Item): number => Math.max(1, Math.round(marketValue(item) * 0.8));

export const AUCTION_CATEGORIES = ['weapons', 'armor', 'accessories', 'gems', 'consumables'] as const;
export type AuctionCategory = (typeof AUCTION_CATEGORIES)[number];
export const AUCTION_CATEGORY_NAMES: Record<AuctionCategory, string> = {
  weapons: 'Weapons', armor: 'Armor', accessories: 'Accessories', gems: 'Gems', consumables: 'Consumables',
};
export function auctionCategory(item: Item): AuctionCategory {
  if (item.kind === 'consumable') return 'consumables';
  if (isGemItem(item)) return 'gems';
  return stockCategory(item);
}

const NPC_KINDS: readonly ItemKind[] = Object.freeze([
  'weapon', 'shield', 'grimoire', 'orb', 'relic',
  'head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'amulet', 'ring',
]);
const NPC_TIERS: readonly ItemTier[] = Object.freeze(['common', 'common', 'magic', 'magic', 'magic', 'rare', 'rare', 'epic']);
const NPC_SELLERS = Object.freeze([
  'Auctioneer Beardo', 'Auctioneer Grizzlin', 'Auctioneer Wabang', 'Auctioneer Fenk',
  'Auctioneer Naxxremis', 'Auctioneer Rhyker', 'Auctioneer Drezmit', 'Auctioneer Lyhanna',
]);
const CONSUMABLE_IDS: readonly string[] = Object.freeze(Object.keys(CONSUMABLES));

/**
 * The NPC half of the market for one epoch: a deterministic spread of gear,
 * gems and consumables priced around vendor retail. Ids embed the epoch so a
 * claimed listing can never reappear under the same id.
 */
export function npcAuctionStock(epoch: number, playerLevel: number): AuctionListing[] {
  const random = randomSource(hashService(`auction:${epoch}`));
  const base = Math.max(1, Math.min(normalizeLevel(playerLevel), 80));
  const epochStart = epoch * AUCTION_EPOCH_MS;
  const listings: AuctionListing[] = [];
  for (let i = 0; i < NPC_STOCK_COUNT; i++) {
    const seed = (hashService(`auction:${epoch}:${i}`) ^ (i * 0x9e3779b9)) >>> 0;
    const roll = random();
    let item: Item;
    if (roll < 0.12) {
      item = createGemForSeed(seed, Math.max(1, base + Math.floor(random() * 8) - 2));
    } else if (roll < 0.3) {
      const id = CONSUMABLE_IDS[Math.floor(random() * CONSUMABLE_IDS.length)];
      item = createConsumableItem(id, seed, 1 + Math.floor(random() * 5));
    } else {
      const kind = NPC_KINDS[Math.floor(random() * NPC_KINDS.length)];
      const tier = NPC_TIERS[Math.floor(random() * NPC_TIERS.length)];
      const itemLevel = Math.max(1, Math.min(80, base + Math.floor(random() * 11) - 4));
      item = generateItem(seed, itemLevel, kind, undefined, tier);
    }
    const durationHours = AUCTION_DURATIONS[Math.floor(random() * AUCTION_DURATIONS.length)];
    // Staggered expiry inside the epoch simulates churn between rotations.
    const expiresAt = Math.min(epochStart + durationHours * 3_600_000, epochStart + AUCTION_EPOCH_MS - Math.floor(random() * 3_600_000));
    listings.push({
      id: `ah-${epoch.toString(36)}-${i}`,
      item,
      buyout: Math.max(1, Math.round(marketValue(item) * (0.9 + random() * 0.9))),
      durationHours,
      postedAt: epochStart,
      expiresAt,
      seller: 'npc',
      sellerName: NPC_SELLERS[Math.floor(random() * NPC_SELLERS.length)],
    });
  }
  return listings;
}
