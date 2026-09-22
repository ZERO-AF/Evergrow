import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItem } from '../src/items.ts';
import { Simulation } from '../src/simulation.ts';
import { addInventoryItem, canPackItem, normalizePackLayout } from '../src/inventory-grid.ts';
import { CharacterSession } from '../src/character-session.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { auctionDeposit, auctionCut, npcAuctionStock, auctionEpoch, AUCTION_EPOCH_MS, marketValue } from '../src/auction-content.ts';
import { auctionHouseOf, npcListings, auctionSaleTime } from '../src/auction-state.ts';
import { postAuction, buyoutAuction, cancelAuction, collectAuctionProceeds, tickAuctions } from '../src/auction-command.ts';
import type { CharacterSheet } from '../src/character-types.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const NOW = 1_800_000_000_000; // fixed wall-clock so epochs are deterministic

function rig(gold = 100_000) {
  const sim = new Simulation(world, { spawn: false });
  const p = sim.player;
  p.x = 0; p.y = 0; p.character.gold = gold;
  const persist = async (character: CharacterSheet, hp: number, mana: number) => ({ ok: true, character, hp, mana });
  return { sim, p, persist };
}
function bagItem(p: ReturnType<typeof rig>['p'], seed = 42, level = 10) {
  const item = generateItem(seed, level, 'weapon', undefined, 'rare');
  assert.ok(addInventoryItem(p.character, item));
  return item;
}

test('postAuction escrows the item, charges the WotLK deposit and survives a save round-trip', async () => {
  const { sim, p, persist } = rig();
  const item = bagItem(p);
  const index = p.character.inventory.indexOf(item);
  const buyout = 5000, deposit = auctionDeposit(buyout, 24);
  const before = p.character.gold!;
  const result = await postAuction(p, index, buyout, 24, persist, NOW);
  assert.ok(result.ok, result.message);
  assert.equal(p.character.inventory[index], null);
  assert.equal(p.character.gold, before - deposit);
  const ah = auctionHouseOf(p.character)!;
  assert.equal(ah.listings.length, 1);
  assert.equal(ah.listings[0].item.id, item.id);
  assert.equal(ah.listings[0].buyout, buyout);
  assert.equal(ah.listings[0].seller, 'player');
  assert.equal(ah.listings[0].expiresAt, NOW + 24 * 3_600_000);
  // The ledger serializes through the real checkpoint validation.
  const data = new Map<string, string>();
  const session = new CharacterSession(new CharacterRepository({ getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } }), 4);
  assert.ok(await session.create(0, 'Auc', 7319, sim.captureCheckpoint(), 'auction-test', 1), session.error);
  const record = (await session.repository.read(0)).record!;
  assert.equal(record.checkpoint.character.auctionHouse!.listings[0].item.id, item.id);
  const tampered = JSON.parse(JSON.stringify(record));
  tampered.checkpoint.character.auctionHouse.gold = -5;
  assert.equal(decodeCharacterSave(JSON.stringify(tampered)), null);
});

test('buyoutAuction debits the wallet, delivers the item and remembers the claim', async () => {
  const { p, persist } = rig();
  const listing = npcListings(p.character, p.level, NOW).find(l => l.item.kind !== 'consumable')!;
  assert.ok(listing, 'expected NPC stock');
  const before = p.character.gold!;
  const result = await buyoutAuction(p, listing.id, persist, NOW);
  assert.ok(result.ok, result.message);
  assert.equal(p.character.gold, before - listing.buyout);
  assert.ok(p.character.inventory.some(i => i?.id === listing.item.id));
  assert.ok(auctionHouseOf(p.character)!.claimed.includes(listing.id));
  // The same listing cannot be bought twice, and it is gone from the browse list.
  assert.equal((await buyoutAuction(p, listing.id, persist, NOW)).ok, false);
  assert.ok(!npcListings(p.character, p.level, NOW).some(l => l.id === listing.id));
});

test('expired auctions return their item; underpriced auctions sell and proceeds collect', async () => {
  const { p, persist } = rig();
  const unsellable = bagItem(p, 7);
  const cheap = bagItem(p, 8);
  const unsellableIndex = p.character.inventory.indexOf(unsellable);
  const cheapIndex = p.character.inventory.indexOf(cheap);
  // 4x vendor retail never sells (auctionSaleTime undefined); it expires.
  assert.ok((await postAuction(p, unsellableIndex, marketValue(unsellable) * 4, 24, persist, NOW)).ok);
  // Half of vendor retail sells well inside the listing window.
  const cheapBuyout = Math.max(1, Math.floor(marketValue(cheap) / 2));
  assert.ok((await postAuction(p, cheapIndex, cheapBuyout, 24, persist, NOW)).ok);
  const ah = auctionHouseOf(p.character)!;
  assert.equal(ah.listings.length, 2);
  const cheapListing = ah.listings.find(l => l.item.id === cheap.id)!;
  assert.ok(auctionSaleTime(cheapListing)! < cheapListing.expiresAt);
  const tick = await tickAuctions(p, persist, NOW + 24 * 3_600_000);
  assert.ok(tick.ok, tick.message);
  const after = auctionHouseOf(p.character)!;
  assert.equal(after.listings.length, 0);
  // Expired item came back to the pack; the sold one did not.
  assert.ok(p.character.inventory.some(i => i?.id === unsellable.id));
  assert.ok(!p.character.inventory.some(i => i?.id === cheap.id));
  assert.equal(after.sold.length, 1);
  const expected = cheapBuyout - auctionCut(cheapBuyout) + auctionDeposit(cheapBuyout, 24);
  assert.equal(after.gold, expected);
  const goldBeforeCollect = p.character.gold!;
  const collect = await collectAuctionProceeds(p, persist, NOW + 24 * 3_600_000);
  assert.ok(collect.ok, collect.message);
  assert.equal(p.character.gold, goldBeforeCollect + expected);
  assert.equal(auctionHouseOf(p.character)!.gold, 0);
  assert.equal(auctionHouseOf(p.character)!.sold.length, 0);
  assert.equal((await collectAuctionProceeds(p, persist, NOW + 24 * 3_600_000)).ok, false);
});

test('expired auctions hold the item until the pack has room, then claim', async () => {
  const { p, persist } = rig();
  const item = bagItem(p, 13);
  const index = p.character.inventory.indexOf(item);
  assert.ok((await postAuction(p, index, marketValue(item) * 4, 12, persist, NOW)).ok);
  // Fill the pack grid with 1x1 rings until nothing else fits.
  for (let i = 0; addInventoryItem(p.character, generateItem(50_000 + i, 10, 'ring', undefined, 'common')) && i < 300; i++);
  assert.equal(canPackItem(p.character, item), false);
  const tick = await tickAuctions(p, persist, NOW + 13 * 3_600_000);
  assert.ok(tick.ok, tick.message);
  const held = auctionHouseOf(p.character)!.listings[0];
  assert.equal(held.expired, true);
  assert.equal(held.item.id, item.id);
  // Claiming with a full pack keeps the item held.
  assert.equal((await cancelAuction(p, held.id, persist, NOW + 13 * 3_600_000 + 1000)).ok, false);
  // Free space by clearing the filler rings, repack, then claim through the cancel path.
  p.character.inventory = p.character.inventory.map(slot => slot?.kind === 'ring' ? null : slot);
  normalizePackLayout(p.character);
  const claim = await cancelAuction(p, held.id, persist, NOW + 13 * 3_600_000 + 2000);
  assert.ok(claim.ok, claim.message);
  assert.ok(p.character.inventory.some(i => i?.id === item.id));
  assert.equal(auctionHouseOf(p.character)!.listings.length, 0);
});

test('failed persist leaves gold, bag and ledger untouched', async () => {
  const { p } = rig();
  const item = bagItem(p, 17);
  const index = p.character.inventory.indexOf(item);
  const before = JSON.stringify(p);
  const result = await postAuction(p, index, 1000, 24, () => ({ ok: false, message: 'Changed in another tab' }), NOW);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(p), before);
  const listing = npcListings(p.character, p.level, NOW)[0];
  const buy = await buyoutAuction(p, listing.id, () => ({ ok: false }), NOW);
  assert.equal(buy.ok, false);
  assert.equal(JSON.stringify(p), before);
});

test('NPC stock is deterministic per epoch, rotates, and prices track item value', () => {
  const epoch = auctionEpoch(NOW);
  const a = npcAuctionStock(epoch, 20), b = npcAuctionStock(epoch, 20);
  assert.deepEqual(a.map(l => l.id), b.map(l => l.id));
  assert.deepEqual(a.map(l => l.buyout), b.map(l => l.buyout));
  assert.ok(a.every(l => l.seller === 'npc' && l.sellerName && l.buyout >= 1));
  assert.ok(a.every(l => l.expiresAt > epoch * AUCTION_EPOCH_MS && l.expiresAt <= (epoch + 1) * AUCTION_EPOCH_MS));
  const next = npcAuctionStock(epoch + 1, 20);
  assert.ok(next.every(l => !a.some(prev => prev.id === l.id)));
  for (const listing of a) assert.ok(listing.buyout >= marketValue(listing.item) * 0.8);
});

test('postAuction rejects bad input before any mutation or persist', async () => {
  const { p } = rig();
  const item = bagItem(p, 23);
  const index = p.character.inventory.indexOf(item);
  const before = JSON.stringify(p);
  let calls = 0;
  const persist = () => { calls++; return { ok: true }; };
  assert.equal((await postAuction(p, -1, 100, 24, persist, NOW)).ok, false);
  assert.equal((await postAuction(p, index, 0, 24, persist, NOW)).ok, false);
  assert.equal((await postAuction(p, index, 100, 7, persist, NOW)).ok, false);
  assert.equal(calls, 0);
  assert.equal(JSON.stringify(p), before);
  assert.equal((await postAuction(p, index, 100, 24, persist, NOW)).ok, true);
  assert.equal(calls, 1);
});
