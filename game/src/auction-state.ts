/**
 * Auction House ledger (WotLK-style local market): the player's posted
 * auctions, completed-sale receipts and uncollected proceeds. Lives on
 * `character.auctionHouse` so it serializes with the sheet — no checkpoint
 * extension needed. NPC stock is derived content (auction-content.ts); the
 * sheet only remembers which epoch listings were already claimed.
 */
import { GAME_FEATURES } from './game-features.ts';
import type { CharacterSheet } from './character-types.ts';
import { integer, object, text, validItem, type ObjectValue } from './item-validation.ts';
import { addInventoryItem } from './inventory-grid.ts';
import {
  AUCTION_DURATIONS, MAX_AUCTION_LISTINGS, MAX_AUCTION_SALES,
  auctionCut, auctionEpoch, auctionDeposit, marketValue, npcAuctionStock,
  type AuctionListing, type AuctionSale,
} from './auction-content.ts';
import { hashService } from './npcs.ts';

export interface AuctionHouseState {
  /** The player's own auctions; `expired` ones still hold their item. */
  listings: AuctionListing[];
  /** Completed-sale receipts, oldest first; proceeds already sit in `gold`. */
  sold: AuctionSale[];
  /** Uncollected proceeds plus refunded deposits, in copper. */
  gold: number;
  /** NPC listing ids bought in the current epoch; resets on rotation. */
  claimed: string[];
  /** Stock epoch `claimed` belongs to. */
  epoch: number;
  /** Listing id counter; survives reloads so ids never repeat. */
  seq: number;
}

/** CharacterSheet carrying the auction ledger until the field lands on the interface. */
export type AuctionSheet = CharacterSheet & { auctionHouse?: AuctionHouseState };

/** Feature flag read through a tolerant lens until GAME_FEATURES.auctionHouse lands. */
export const auctionEnabled = (): boolean =>
  (GAME_FEATURES as Record<string, boolean | undefined>).auctionHouse ?? true;

/** The sheet's auction ledger; undefined until the first visit. */
export const auctionHouseOf = (sheet: CharacterSheet): AuctionHouseState | undefined =>
  (sheet as AuctionSheet).auctionHouse;
/** The sheet's auction ledger, created on first use. */
export function ensureAuctionHouse(sheet: CharacterSheet): AuctionHouseState {
  const carrier = sheet as AuctionSheet;
  return carrier.auctionHouse ??= { listings: [], sold: [], gold: 0, claimed: [], epoch: -1, seq: 0 };
}
/** Live NPC listings for the current epoch, minus ones the player bought. */
export function npcListings(sheet: CharacterSheet, level: number, now: number): AuctionListing[] {
  const state = auctionHouseOf(sheet);
  const epoch = auctionEpoch(now);
  const claimed = state && state.epoch === epoch ? new Set(state.claimed) : undefined;
  return npcAuctionStock(epoch, level).filter(l => l.expiresAt > now && !claimed?.has(l.id));
}

/**
 * Deterministic simulated demand: the wall-clock moment a player listing sells,
 * or undefined when it never does. Underpriced auctions move fast; anything
 * above ~3x vendor retail sits until it expires.
 */
export function auctionSaleTime(listing: AuctionListing): number | undefined {
  const ratio = listing.buyout / marketValue(listing.item);
  if (ratio > 3) return undefined;
  const duration = listing.expiresAt - listing.postedAt;
  const roll = (hashService(`sale:${listing.id}`) % 1000) / 1000;
  const delay = duration * Math.min(0.98, (0.15 + 0.8 * roll) * Math.max(0.5, ratio));
  return listing.postedAt + delay;
}

export interface AuctionAdvance {
  /** Listings that sold since the last advance. */
  sales: AuctionListing[];
  /** Expired listings whose item returned to the pack. */
  returned: AuctionListing[];
  /** Expired listings still holding their item (pack full). */
  held: number;
  /** Whether the ledger changed; false means a persist would be a no-op. */
  changed: boolean;
}

/**
 * Market tick: settle sales, return expired items to the pack (or hold them on
 * the listing when the pack is full), and roll the claimed-id set into a new
 * stock epoch. Mutates `sheet`; the caller stages and persists it.
 */
export function advanceAuctionHouse(sheet: CharacterSheet, now: number): AuctionAdvance {
  const state = ensureAuctionHouse(sheet);
  const epoch = auctionEpoch(now);
  const result: AuctionAdvance = { sales: [], returned: [], held: 0, changed: false };
  if (state.epoch !== epoch) { state.epoch = epoch; state.claimed = []; result.changed = true; }
  const keep: AuctionListing[] = [];
  for (const listing of state.listings) {
    if (listing.expired) {
      if (addInventoryItem(sheet, listing.item)) { result.returned.push(listing); result.changed = true; }
      else { keep.push(listing); result.held++; }
      continue;
    }
    const soldAt = auctionSaleTime(listing);
    if (soldAt !== undefined && soldAt <= now && soldAt <= listing.expiresAt) {
      const deposit = auctionDeposit(listing.buyout, listing.durationHours);
      const proceeds = listing.buyout - auctionCut(listing.buyout) + deposit;
      state.gold = Math.min(Number.MAX_SAFE_INTEGER, state.gold + proceeds);
      state.sold.push({ id: listing.id, item: listing.item, price: listing.buyout, deposit, soldAt });
      result.sales.push(listing); result.changed = true;
      continue;
    }
    if (listing.expiresAt <= now) {
      if (addInventoryItem(sheet, listing.item)) { result.returned.push(listing); result.changed = true; }
      else { keep.push({ ...listing, expired: true }); result.held++; result.changed = true; }
      continue;
    }
    keep.push(listing);
  }
  if (result.changed) {
    state.listings = keep;
    if (state.sold.length > MAX_AUCTION_SALES) state.sold.splice(0, state.sold.length - MAX_AUCTION_SALES);
  }
  return result;
}

/** Save validation for `character.auctionHouse`; wired into validSheet. */
export function validAuctionHouse(v: unknown): v is AuctionHouseState {
  if (!object(v)) return false;
  const s = v as ObjectValue;
  if (!Array.isArray(s.listings) || s.listings.length > MAX_AUCTION_LISTINGS || !s.listings.every(validAuctionListing)) return false;
  if (!Array.isArray(s.sold) || s.sold.length > MAX_AUCTION_SALES || !s.sold.every(validAuctionSale)) return false;
  if (!integer(s.gold) || !integer(s.seq) || !integer(s.epoch, -1)) return false;
  return Array.isArray(s.claimed) && s.claimed.length <= NPC_STOCK_COUNT_MAX && s.claimed.every(id => text(id, 96));
}
const NPC_STOCK_COUNT_MAX = 64;

function validAuctionListing(v: unknown): v is AuctionListing {
  if (!object(v)) return false;
  const l = v as ObjectValue;
  if (!text(l.id, 96) || !validItem(l.item) || !integer(l.buyout, 1) || !integer(l.postedAt) || !integer(l.expiresAt)
    || (l.seller !== 'player' && l.seller !== 'npc') || (l.expired !== undefined && l.expired !== true)
    || !AUCTION_DURATIONS.includes(l.durationHours as never)) return false;
  if (l.sellerName !== undefined && !text(l.sellerName, 60)) return false;
  if (l.bids !== undefined && (!Array.isArray(l.bids) || !l.bids.every(b =>
    object(b) && text((b as ObjectValue).bidder, 60) && integer((b as ObjectValue).amount, 1) && integer((b as ObjectValue).at)))) return false;
  return true;
}

function validAuctionSale(v: unknown): v is AuctionSale {
  if (!object(v)) return false;
  const s = v as ObjectValue;
  return text(s.id, 96) && validItem(s.item) && integer(s.price, 1) && integer(s.deposit) && integer(s.soldAt);
}

