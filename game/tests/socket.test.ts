import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { generateItem, deriveItem, itemModifiers } from '../src/items.ts';
import { createGem, gemDefinition, socketBonusStats } from '../src/gem-content.ts';
import { addInventoryItem } from '../src/inventory.ts';
import { socketGem } from '../src/gem-command.ts';
import {
  gemsAvailable, parseSocketTargetKey, socketPreview, socketTargetItem, socketTargetKey, socketTargets,
} from '../src/socket-state.ts';
import type { Item, ItemTier } from '../src/character-types.ts';

const make = () => new Simulation({ blocked: () => false, move: (x, y) => ({ x, y }) }, { spawn: false }).player;

/** First socketed drop of the given kind/tier from a small seed scan. */
function socketedItem(kind: Item['kind'], tier: ItemTier, level = 10): Item {
  for (let seed = 1; seed < 400; seed++) {
    const item = generateItem(seed, level, kind, undefined, tier);
    if (item.sockets?.length) return item;
  }
  throw new Error(`No socketed ${kind}/${tier} in seed range`);
}

test('socketTargets lists equipped socketed gear first, then bag items', () => {
  const player = make(), sheet = player.character;
  const equipped = socketedItem('chest', 'epic');
  const bagged = socketedItem('weapon', 'rare');
  const plain = generateItem(5, 10, 'boots', undefined, 'common');
  assert.equal(plain.sockets, undefined, 'fixture: common boots have no sockets');
  sheet.equipped.chest = equipped;
  assert.ok(addInventoryItem(sheet, bagged) && addInventoryItem(sheet, plain));
  const targets = socketTargets(player);
  assert.equal(targets.length, 2);
  assert.deepEqual(targets[0].target, { equipped: 'chest' });
  assert.equal(targets[0].item, equipped);
  const bagIndex = sheet.inventory.findIndex(i => i?.id === bagged.id);
  assert.deepEqual(targets[1].target, { bag: bagIndex });
  assert.equal(targets[1].item, bagged);
});

test('gemsAvailable returns only bag gem tokens with their indices', () => {
  const player = make(), sheet = player.character;
  const gem = createGem('bold-scarlet-ruby', 42, 8);
  const gear = socketedItem('gloves', 'epic');
  assert.ok(addInventoryItem(sheet, gear) && addInventoryItem(sheet, gem));
  const gems = gemsAvailable(player);
  assert.equal(gems.length, 1);
  assert.equal(gems[0].item, gem);
  assert.equal(gems[0].gem.id, 'bold-scarlet-ruby');
  assert.equal(gems[0].index, sheet.inventory.findIndex(i => i?.id === gem.id));
});

test('socketPreview derives stats and bonus without mutating the item', () => {
  const base = socketedItem('chest', 'epic');
  const item = deriveItem({ ...base, sockets: [{ color: 'red' }, { color: 'red' }] });
  const gem = createGem('bold-scarlet-ruby', 9, item.itemLevel);
  const before = JSON.stringify(item);
  const preview = socketPreview(item, gem, 0);
  assert.ok(preview.ok, preview.message);
  assert.equal(preview.socketIndex, 0);
  assert.equal(preview.replaces, false);
  assert.equal(preview.bonusActive, false, 'one filled socket is not a full match');
  assert.equal(preview.item!.sockets![0].gem, 'bold-scarlet-ruby');
  assert.equal(preview.item!.sockets![0].gemLevel, gem.itemLevel);
  assert.ok((itemModifiers(preview.item!).strength ?? 0) > (itemModifiers(item).strength ?? 0), 'gem stats fold into the derived item');
  // Filling the second socket with a matching color completes the bonus.
  const second = socketPreview(preview.item!, gem, 1);
  assert.ok(second.ok && second.bonusActive, 'full color match activates the bonus');
  const bonus = socketBonusStats(item)!;
  assert.ok((second.item!.implicit[bonus.stat] ?? 0) >= bonus.value, 'bonus stat lands in implicit');
  assert.equal(JSON.stringify(item), before, 'preview leaves the source item untouched');
  assert.equal(item.recipe.revision, base.recipe.revision, 'preview does not bump revision');
});

test('socketPreview defaults to the first empty socket and flags replacements', () => {
  const base = socketedItem('chest', 'epic');
  const item = deriveItem({ ...base, sockets: [{ color: 'red', gem: 'solid-azure-moonstone', gemLevel: 5 }, { color: 'blue' }] });
  const gem = createGem('quick-autumn-glow', 3, item.itemLevel);
  const empty = socketPreview(item, gem);
  assert.ok(empty.ok && empty.socketIndex === 1, 'first empty socket is previewed');
  const filled = socketPreview(item, gem, 0);
  assert.ok(filled.ok && filled.replaces, 'socketing over a gem is a replacement');
  // All sockets filled: the default preview falls back to socket 0 (replace).
  const full = deriveItem({ ...item, sockets: item.sockets!.map(s => ({ ...s, gem: 'solid-azure-moonstone', gemLevel: 5 })) });
  const fallback = socketPreview(full, gem);
  assert.ok(fallback.ok && fallback.socketIndex === 0 && fallback.replaces);
});

test('socketPreview rejects non-gems, unsocketed items and bad indices', () => {
  const item = socketedItem('chest', 'epic');
  const gem = createGem('bold-scarlet-ruby', 9, item.itemLevel);
  const notGem = socketedItem('weapon', 'rare');
  assert.equal(socketPreview(item, notGem, 0).ok, false, 'a weapon is not a gem');
  const unsocketed = generateItem(5, 10, 'boots', undefined, 'common');
  assert.equal(socketPreview(unsocketed, gem, 0).ok, false, 'no sockets');
  assert.equal(socketPreview(item, gem, -1).ok, false);
  assert.equal(socketPreview(item, gem, item.sockets!.length).ok, false);
  assert.equal(socketPreview(item, gem, 1.5).ok, false);
});

test('socketTargetItem resolves bag and equipped targets', () => {
  const player = make(), sheet = player.character;
  const equipped = socketedItem('head', 'epic');
  const bagged = socketedItem('legs', 'rare');
  sheet.equipped.head = equipped;
  assert.ok(addInventoryItem(sheet, bagged));
  const bagIndex = sheet.inventory.findIndex(i => i?.id === bagged.id);
  assert.equal(socketTargetItem(sheet, { equipped: 'head' }), equipped);
  assert.equal(socketTargetItem(sheet, { bag: bagIndex }), bagged);
  assert.equal(socketTargetItem(sheet, { bag: bagIndex + 50 }), null, 'out of range');
  assert.equal(socketTargetItem(sheet, { equipped: 'amulet' }), null, 'empty slot');
});

test('socketTargetKey round-trips through parseSocketTargetKey', () => {
  assert.equal(socketTargetKey({ bag: 7 }), 'bag:7');
  assert.equal(socketTargetKey({ equipped: 'weapon' }), 'equipped:weapon');
  assert.deepEqual(parseSocketTargetKey('bag:7'), { bag: 7 });
  assert.deepEqual(parseSocketTargetKey('equipped:ring2'), { equipped: 'ring2' });
  assert.equal(parseSocketTargetKey('bag:-1'), null);
  assert.equal(parseSocketTargetKey('bag:x'), null);
  assert.equal(parseSocketTargetKey('equipped:wallet'), null, 'not an equipment slot');
  assert.equal(parseSocketTargetKey(''), null);
  assert.equal(parseSocketTargetKey('bag:1:extra'), null);
});

test('panel projections stay consistent with gem-command results', () => {
  // The preview's derived item must match what socketGem actually commits.
  const player = make(), sheet = player.character;
  const armor = socketedItem('chest', 'epic');
  const gem = createGem('bold-scarlet-ruby', 11, armor.itemLevel);
  assert.ok(addInventoryItem(sheet, armor) && addInventoryItem(sheet, gem));
  const bagIndex = sheet.inventory.findIndex(i => i?.id === armor.id);
  const gemIndex = sheet.inventory.findIndex(i => i?.id === gem.id);
  const preview = socketPreview(armor, gem, 0);
  assert.ok(preview.ok);
  const result = socketGem(sheet, gemIndex, { bag: bagIndex }, 0);
  assert.ok(result.ok, result.message);
  const committed = sheet.inventory[bagIndex]!;
  assert.deepEqual(committed.sockets, preview.item!.sockets);
  assert.deepEqual(itemModifiers(committed), itemModifiers(preview.item!));
  assert.equal(gemDefinition(committed.sockets![0].gem)!.id, 'bold-scarlet-ruby');
});
