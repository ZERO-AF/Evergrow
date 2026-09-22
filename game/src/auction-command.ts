/**
 * Auction House commands: every mutation stages a checkpoint of the character
 * sheet, persists it, then commits to the live player (docs/wow-deepening.md
 * conventions) — a failed save leaves gold, bag and ledger untouched. `now` is
 * wall-clock ms; it is injectable so tests can move market time.
 */
import type { Player } from './model.ts';
import type { CharacterSheet } from './character-types.ts';
import { cloneData } from './data-clone.ts';
import { refreshCharacter } from './character.ts';
import { spendGold, creditGold } from './wallet.ts';
import { addInventoryItem, canPackItem, packSpaceProblem, normalizePackLayout } from './inventory-grid.ts';
import { itemDisplayName } from './items.ts';
import { formatWalletCompact } from './currency.ts';
import {
  AUCTION_DURATIONS, MAX_BUYOUT, MAX_PLAYER_LISTINGS,
  auctionDeposit, auctionEpoch, npcAuctionStock,
  type AuctionDuration, type AuctionListing,
} from './auction-content.ts';
import { advanceAuctionHouse, auctionEnabled, ensureAuctionHouse, npcListings, type AuctionSheet } from './auction-state.ts';
type Persist = (character: CharacterSheet, hp: number, mana: number) => { ok: boolean; message?: string } | Promise<{ ok: boolean; message?: string }>;
type Result = { ok: boolean; message: string };
const fail = (message: string): Result => ({ ok: false, message });

/** Persist the staged sheet, then commit it to the live player. */
async function commit(player: Player, character: CharacterSheet, persist: Persist, message: string): Promise<Result> {
  const candidate = { ...player, character };
  refreshCharacter(candidate);
  const saved = await persist(character, candidate.hp, candidate.mana);
  if (!saved.ok) return fail(saved.message ?? 'Could not save. No gold or items changed.');
  player.character = character;
  refreshCharacter(player);
  return { ok: true, message };
}

/**
 * Post a bag item for sale: the item moves into escrow and the deposit leaves
 * the wallet up front. `itemRef` is the bag (inventory) index.
 */
export async function postAuction(player: Player, itemRef: number, buyout: number, hours: number, persist: Persist, now = Date.now()): Promise<Result> {
  if (!auctionEnabled()) return fail('The auction house is closed.');
  if (!Number.isInteger(itemRef) || itemRef < 0 || itemRef >= player.character.inventory.length) return fail('Choose an item in your pack.');
  const item = player.character.inventory[itemRef];
  if (!item) return fail('Choose an item in your pack.');
  if (item.locked) return fail('Unlock the item before auctioning it.');
  if (!Number.isSafeInteger(buyout) || buyout < 1 || buyout > MAX_BUYOUT) return fail('Enter a valid buyout price.');
  if (!AUCTION_DURATIONS.includes(hours as AuctionDuration)) return fail('Choose a listing duration.');
  const character = cloneData(player.character);
  const advance = advanceAuctionHouse(character, now);
  const state = ensureAuctionHouse(character);
  if (state.listings.filter(l => !l.expired).length >= MAX_PLAYER_LISTINGS) return fail('You have too many auctions posted.');
  const deposit = auctionDeposit(buyout, hours);
  if (!spendGold(character, deposit)) return fail(`The deposit is ${formatWalletCompact(deposit)}.`);
  const staged = character.inventory[itemRef]!;
  character.inventory[itemRef] = null;
  const listing: AuctionListing = {
    id: `p-${(state.seq++).toString(36)}-${staged.id.slice(0, 40)}`,
    item: staged, buyout, durationHours: hours as AuctionDuration,
    postedAt: now, expiresAt: now + hours * 3_600_000, seller: 'player',
  };
  state.listings.push(listing);
  normalizePackLayout(character);
  const extra = advance.sales.length || advance.returned.length ? ' Older auctions settled.' : '';
  return commit(player, character, persist, `Auction created for ${itemDisplayName(staged)} · deposit ${formatWalletCompact(deposit)}.${extra}`);
}

/**
 * Buy out a listing. NPC stock is derived per epoch, so the id is resolved
 * against the current rotation and remembered in `claimed`.
 */
export async function buyoutAuction(player: Player, listingId: string, persist: Persist, now = Date.now()): Promise<Result> {
  if (!auctionEnabled()) return fail('The auction house is closed.');
  const character = cloneData(player.character);
  const advance = advanceAuctionHouse(character, now);
  const state = ensureAuctionHouse(character);
  const own = state.listings.find(l => l.id === listingId);
  if (own) return fail(own.expired ? 'That auction already ended — claim the item instead.' : 'You cannot buy your own auction. Cancel it instead.');
  const listing = npcAuctionStock(auctionEpoch(now), player.level).find(l => l.id === listingId && l.expiresAt > now);
  if (!listing || state.claimed.includes(listing.id)) return fail('That auction is no longer available.');
  if (!canPackItem(character, listing.item)) return fail(packSpaceProblem(character, listing.item) || 'Make room in your pack first.');
  if (!spendGold(character, listing.buyout)) return fail(`You need ${formatWalletCompact(listing.buyout)}.`);
  if (!addInventoryItem(character, listing.item)) return fail('Make room in your pack first.');
  state.claimed.push(listing.id);
  normalizePackLayout(character);
  const extra = advance.sales.length || advance.returned.length ? ' Older auctions settled.' : '';
  return commit(player, character, persist, `You won ${itemDisplayName(listing.item)} for ${formatWalletCompact(listing.buyout)}.${extra}`);
}

/**
 * Cancel a player auction: the item returns to the pack and the deposit is
 * forfeited. Expired listings are claimed the same way; when the pack is full
 * the item stays held on the finished listing until there is room.
 */
export async function cancelAuction(player: Player, listingId: string, persist: Persist, now = Date.now()): Promise<Result> {
  if (!auctionEnabled()) return fail('The auction house is closed.');
  const character = cloneData(player.character);
  const advance = advanceAuctionHouse(character, now);
  const state = ensureAuctionHouse(character);
  const index = state.listings.findIndex(l => l.id === listingId);
  if (index < 0) {
    const delivered = advance.returned.find(l => l.id === listingId);
    if (delivered) return commit(player, character, persist, `Claimed ${itemDisplayName(delivered.item)}.`);
    return fail('That auction is no longer listed.');
  }
  const listing = state.listings[index];
  if (!canPackItem(character, listing.item)) {
    if (listing.expired) {
      if (!advance.changed) return fail(packSpaceProblem(character, listing.item) || 'Make room in your pack first.');
      return commit(player, character, persist, 'Older auctions settled. Make room in your pack to claim this item.');
    }
    state.listings[index] = { ...listing, expired: true };
    return commit(player, character, persist, `Auction cancelled. ${itemDisplayName(listing.item)} is held in expired auctions until you have pack room.`);
  }
  state.listings.splice(index, 1);
  addInventoryItem(character, listing.item);
  normalizePackLayout(character);
  const extra = advance.sales.length || advance.returned.length ? ' Older auctions settled.' : '';
  return commit(player, character, persist, `${listing.expired ? 'Claimed' : 'Cancelled auction for'} ${itemDisplayName(listing.item)}.${extra}`);
}

/** Collect every pending sale proceed (price minus the house cut, plus deposits). */
export async function collectAuctionProceeds(player: Player, persist: Persist, now = Date.now()): Promise<Result> {
  if (!auctionEnabled()) return fail('The auction house is closed.');
  const character = cloneData(player.character);
  advanceAuctionHouse(character, now);
  const state = ensureAuctionHouse(character);
  if (state.gold <= 0) return fail('No auction proceeds to collect.');
  const amount = state.gold, count = state.sold.length;
  if (!creditGold(character, amount)) return fail('Your purse cannot hold that much gold.');
  state.gold = 0;
  state.sold = [];
  return commit(player, character, persist, `Collected ${formatWalletCompact(amount)} from ${count} auction sale${count === 1 ? '' : 's'}.`);
}

/**
 * Market tick for the game loop: settles sales and returns without touching
 * the player when nothing changed, so a persist only happens on real churn.
 */
export async function tickAuctions(player: Player, persist: Persist, now = Date.now()): Promise<Result> {
  if (!auctionEnabled()) return fail('The auction house is closed.');
  const character = cloneData(player.character);
  const advance = advanceAuctionHouse(character, now);
  if (!advance.changed) return { ok: true, message: '' };
  const parts: string[] = [];
  for (const sale of advance.sales) parts.push(`${itemDisplayName(sale.item)} sold for ${formatWalletCompact(sale.buyout)}`);
  for (const listing of advance.returned) parts.push(`${itemDisplayName(listing.item)} returned`);
  return commit(player, character, persist, parts.length ? `Auction House: ${parts.join(', ')}.` : 'Auctions settled.');
}

/** Read model for the panel: live NPC stock plus the player's ledger. */
export function auctionBrowse(player: Player, now = Date.now()): { npc: AuctionListing[]; mine: AuctionListing[]; pendingGold: number; sales: number } {
  const state = (player.character as AuctionSheet).auctionHouse;
  return {
    npc: npcListings(player.character, player.level, now),
    mine: state?.listings ?? [],
    pendingGold: state?.gold ?? 0,
    sales: state?.sold.length ?? 0,
  };
}
