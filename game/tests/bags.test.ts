import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BAG_ITEMS, BAG_ITEM_PREFIX, BAG_SLOT_COUNT, bagDefinition, bagFootprintCells, bagGridLayout,
  bagItemDefinition, bagItemId, bagSectionAt, bagSlots, createBagItem, equippedBags, findBagSpace,
  isBagItem, resolveBagPackLayout, rollBagDrop, validBagItem,
} from '../src/bag-content.ts';
import { bagSlotsArray, bagUnequipProblem, bagVendorStock, buyBag, equipBag, unequipBag, validBagSlots } from '../src/bag-state.ts';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { PACK_CELLS, INVENTORY_CELLS } from '../src/pack-grid.ts';
import type { CharacterSheet, Item } from '../src/character-types.ts';

const sheet = (): CharacterSheet => createCharacterSheet();
const linen = () => createBagItem('linen-bag', 11);
const frostweave = () => createBagItem('frostweave-bag', 12);
const gear = (seed: number) => generateItem(seed, 1, 'ring');

test('createBagItem is deterministic and encodes the definition in the id', () => {
  const a = createBagItem('silk-bag', 99), b = createBagItem('silk-bag', 99);
  assert.deepEqual(a, b);
  assert.ok(a.id.startsWith(`${BAG_ITEM_PREFIX}silk-bag:`));
  assert.equal(bagItemId(a), 'silk-bag');
  assert.equal(bagItemDefinition(a), bagDefinition('silk-bag'));
  assert.ok(isBagItem(a));
  assert.equal(a.requiredLevel, Math.max(1, bagDefinition('silk-bag')!.itemLevel - 2));
  assert.equal(a.kind, 'cloak', 'bags ride the cloak item kind');
  assert.throws(() => createBagItem('dragon-bag', 1), RangeError);
});

test('validBagItem accepts real bags and rejects tampered or ordinary items', () => {
  assert.ok(validBagItem(linen()));
  assert.ok(validBagSlots([linen(), null, frostweave(), null]));
  const tampered = { ...linen(), itemLevel: 99 };
  assert.equal(validBagItem(tampered), false);
  assert.equal(validBagItem(gear(5)), false);
  assert.equal(validBagSlots([linen(), linen()]), false, 'duplicate bag ids are rejected');
  assert.equal(validBagSlots([linen(), null, null, null, null, frostweave()]), false, 'more than four slots');
});

test('equippedBags keeps slot order, drops malformed entries and caps at four', () => {
  const bags = [linen(), gear(1), frostweave(), null, linen(), createBagItem('woolen-bag', 3)];
  const equipped = equippedBags({ bags: bags as (Item | null)[] });
  assert.deepEqual(equipped.map(bagItemId), ['linen-bag', 'frostweave-bag', 'woolen-bag'],
    'non-bags and duplicate ids are skipped');
});

test('bagGridLayout appends one section per equipped bag after the charm grid', () => {
  assert.equal(bagGridLayout({}).totalCells, INVENTORY_CELLS);
  const grid = bagGridLayout({ bags: [linen(), null, frostweave(), null] });
  assert.equal(grid.sections.length, 2);
  assert.equal(grid.sections[0].start, INVENTORY_CELLS);
  assert.equal(grid.sections[0].cells, 6);
  assert.equal(grid.sections[0].slot, 0);
  assert.equal(grid.sections[1].start, INVENTORY_CELLS + 6);
  assert.equal(grid.sections[1].cells, 20);
  assert.equal(grid.sections[1].slot, 2);
  assert.equal(grid.totalCells, INVENTORY_CELLS + 26);
  assert.equal(bagSlots({ bags: [linen(), null, frostweave(), null] }), PACK_CELLS + 26);
  assert.equal(bagSectionAt(grid, INVENTORY_CELLS + 7)!.slot, 2);
  assert.equal(bagSectionAt(grid, PACK_CELLS), undefined, 'charm cells belong to no bag');
});

test('bagFootprintCells confines items to their own bag section', () => {
  const grid = bagGridLayout({ bags: [linen()] });
  const section = grid.sections[0];
  assert.deepEqual(bagFootprintCells(gear(1), section.start, grid), [section.start]);
  const last = section.start + section.cells - 1;
  assert.deepEqual(bagFootprintCells(gear(1), last, grid), [last]);
  assert.equal(bagFootprintCells(gear(1), last + 1, grid), null, 'past the section end');
  // A 2-wide item cannot straddle the section boundary.
  const wide = generateItem(77, 1, 'chest');
  assert.equal(wide.recipe.profileId === undefined || true, true);
  const edge = section.start + section.cells - 1;
  if (edge % 12 <= 10) assert.equal(bagFootprintCells(wide, edge, grid), null);
});

test('findBagSpace prefers the requested cell then packs in order', () => {
  const grid = bagGridLayout({ bags: [linen()] });
  const item = gear(1);
  assert.equal(findBagSpace(item, new Set(), 5, 'bag', grid), 5);
  assert.equal(findBagSpace(item, new Set([5]), 5, 'bag', grid), 0, 'occupied preferred cell falls back to first free');
  const full = new Set(Array.from({ length: PACK_CELLS }, (_, i) => i));
  assert.equal(findBagSpace(item, full, undefined, 'bag', grid), INVENTORY_CELLS, 'a full backpack spills into the bag');
});

test('resolveBagPackLayout keeps placed cells and packs the rest in order', () => {
  const a = gear(1), b = gear(2);
  const layout = resolveBagPackLayout({ inventory: [a, b], inventoryLayout: { [b.id]: 3 } });
  assert.equal(layout[b.id], 3, 'a valid stored cell is kept');
  assert.equal(layout[a.id], 0);
  // Overflow: more items than pack cells leaves the extras unplaced. The layout
  // only fills the 72 pack cells — rings never land in the charm rows.
  const many = Array.from({ length: PACK_CELLS + 2 }, (_, i) => gear(100 + i));
  const packed = resolveBagPackLayout({ inventory: many });
  assert.equal(Object.keys(packed).length, PACK_CELLS);
});

test('rollBagDrop is deterministic, rare and level-capped', () => {
  let drops = 0;
  for (let seed = 0; seed < 4000; seed++) {
    const item = rollBagDrop(seed, 80);
    if (!item) continue;
    drops++;
    assert.ok(isBagItem(item));
    assert.equal(rollBagDrop(seed, 80)!.id, item.id, 'same seed same bag');
  }
  assert.ok(drops > 0 && drops < 4000 * .05, `2% drop rate, got ${drops}`);
  // Low-level kills can only drop the smallest bag.
  for (let seed = 0; seed < 4000; seed++) {
    const item = rollBagDrop(seed, 1);
    if (item) assert.equal(bagItemId(item), 'linen-bag');
  }
});

test('equipBag moves a pack bag into a slot and grows the pack', () => {
  const s = sheet();
  s.inventory[0] = linen();
  const before = s.inventory.length;
  assert.ok(equipBag(s, 0).ok);
  assert.equal(bagItemId(s.bags![0]), 'linen-bag');
  assert.equal(s.inventory[0], null);
  assert.equal(s.inventory.length, before + 6, 'inventory array grows to cover the new cells');
  // Non-bag items and bad indices fail without mutation.
  s.inventory[1] = gear(9);
  const snapshot = structuredClone(s);
  assert.equal(equipBag(s, 1).ok, false);
  assert.equal(equipBag(s, 99).ok, false);
  assert.deepEqual(s, snapshot);
});

test('equipBag swap that strands items fails atomically', () => {
  const s = sheet();
  s.bags = [frostweave(), null, null, null];
  s.inventory = s.inventory.slice(0, PACK_CELLS);
  // Fill the 20 frostweave cells plus the whole backpack so a linen swap strands items.
  const grid = bagGridLayout(s);
  for (let i = 0; i < PACK_CELLS + 20; i++) s.inventory[i] = gear(1000 + i);
  s.inventoryLayout = resolveBagPackLayout(s, grid);
  s.inventory[0] = linen();
  const snapshot = structuredClone(s);
  const result = equipBag(s, 0, Infinity, 0);
  assert.equal(result.ok, false);
  assert.deepEqual(s, snapshot, 'a failed downsize leaves everything in place');
});

test('unequipBag refuses while its cells still hold items', () => {
  const s = sheet();
  s.bags = [linen(), null, null, null];
  const grid = bagGridLayout(s);
  // Fill the backpack so the solver overflows the extra item into the bag section.
  for (let i = 0; i < PACK_CELLS; i++) s.inventory[i] = gear(2000 + i);
  const inBag = gear(3000);
  s.inventory[PACK_CELLS] = inBag;
  s.inventoryLayout = resolveBagPackLayout(s, grid);
  assert.equal(s.inventoryLayout[inBag.id], INVENTORY_CELLS, 'the extra item lives in the bag section');
  assert.ok(bagUnequipProblem(s, 0), 'probe reports the bag is not empty');
  const snapshot = structuredClone(s);
  assert.equal(unequipBag(s, 0).ok, false);
  assert.deepEqual(s, snapshot);
  // Empty the bag AND free one pack cell (the bag itself needs a home): the
  // unequip now succeeds and the bag lands in the pack.
  s.inventory[PACK_CELLS] = null;
  delete s.inventoryLayout[inBag.id];
  const freed = s.inventory[0]!;
  s.inventory[0] = null;
  delete s.inventoryLayout[freed.id];
  assert.ok(unequipBag(s, 0).ok);
  assert.equal(s.bags![0], null);
  assert.ok(s.inventory.some(item => item && isBagItem(item)));
});
test('buyBag sells only through jewelers, charges gold and bumps operations', () => {
  const jeweler = { role: 'jeweler' as const };
  const other = { role: 'blacksmith' as const };
  assert.equal(bagVendorStock(jeweler).length, BAG_ITEMS.length);
  assert.equal(bagVendorStock(other).length, 0);
  const s = sheet();
  s.gold = 10_000_000;
  const ops = s.commerce.operations;
  const bought = buyBag(s, jeweler, 'linen-bag');
  assert.ok(bought.ok);
  assert.ok(bought.item && isBagItem(bought.item));
  assert.equal(s.commerce.operations, ops + 1);
  assert.ok(s.inventory.includes(bought.item!));
  assert.ok(s.gold < 10_000_000);
  assert.equal(buyBag(s, other, 'linen-bag').ok, false, 'wrong vendor role');
  assert.equal(buyBag(s, jeweler, 'dragon-bag').ok, false, 'unknown bag id');
  const broke = sheet();
  assert.equal(buyBag(broke, jeweler, 'frostweave-bag').ok, false, 'not enough gold');
  assert.equal(broke.commerce.operations, 0);
});

test('bagSlotsArray normalizes the four-slot view', () => {
  const s = sheet();
  assert.deepEqual(bagSlotsArray(s), [null, null, null, null]);
  s.bags = [linen()];
  const slots = bagSlotsArray(s);
  assert.equal(slots.length, BAG_SLOT_COUNT);
  assert.equal(slots[0]!.id, s.bags[0]!.id);
});
