import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { generateItem, deriveItem, itemModifiers, createCharacterSheet } from '../src/items.ts';
import { createGem, createGemForSeed, gemItemId, rollSockets, socketBonusActive, socketBonusStats, SOCKETABLE_KINDS, MAX_SOCKETS, GEMS } from '../src/gem-content.ts';
import { validItem } from '../src/item-validation.ts';
import { vendorStock, quoteService, planService, itemPrice } from '../src/commerce.ts';
import { improvementProblem } from '../src/item-improvement.ts';
import { addInventoryItem } from '../src/inventory.ts';
import type { TownNPC } from '../src/npcs.ts';
import type { Item, ItemTier } from '../src/character-types.ts';
import { socketGem } from '../src/gem-command.ts';
const make = () => new Simulation({ blocked: () => false, move: (x, y) => ({ x, y }) }, { spawn: false }).player;
const jeweler: TownNPC = { id: 'town:7319:0:building:1:jeweler', buildingId: 'town:7319:0:building:1', role: 'jeweler', name: 'Edda', seed: 7, x: 0, y: 0, level: 10 };

/** First socketed drop of the given kind/tier from a small seed scan. */
function socketedItem(kind: Item['kind'], tier: ItemTier, level = 10): Item {
  for (let seed = 1; seed < 400; seed++) {
    const item = generateItem(seed, level, kind, undefined, tier);
    if (item.sockets?.length) return item;
  }
  throw new Error(`No socketed ${kind}/${tier} in seed range`);
}

test('socket rolls are rarity-weighted, bounded and kind-gated', () => {
  assert.equal(rollSockets('amulet', 'legendary', 1), undefined, 'jewelry never rolls sockets');
  assert.equal(rollSockets('chest', 'common', 1), undefined, 'commons never roll sockets');
  const counts = { magic: 0, epic: 0 };
  for (let seed = 1; seed <= 200; seed++) {
    for (const tier of ['magic', 'epic'] as const) {
      const sockets = rollSockets('chest', tier, seed) ?? [];
      assert.ok(sockets.length <= MAX_SOCKETS);
      assert.ok(sockets.every(s => ['red', 'blue', 'yellow'].includes(s.color) && s.gem === undefined));
      counts[tier] += sockets.length;
    }
  }
  assert.ok(counts.epic > counts.magic * 2, `epic sockets (${counts.epic}) should far outnumber magic (${counts.magic})`);
  for (const kind of SOCKETABLE_KINDS) {
    const item = socketedItem(kind, 'epic');
    assert.ok(item.sockets!.length >= 1 && item.sockets!.length <= MAX_SOCKETS);
    assert.ok(validItem(item), `${kind} with sockets validates`);
  }
});

test('socketing a gem applies its stats through deriveItem and refreshes the character', () => {
  const player = make(), sheet = player.character;
  const armor = socketedItem('chest', 'epic', 3);
  const gem = createGem('bold-scarlet-ruby', 99, armor.itemLevel);
  assert.ok(addInventoryItem(sheet, armor) && addInventoryItem(sheet, gem));
  const gemIndex = sheet.inventory.findIndex(i => i?.id === gem.id);
  const bagIndex = sheet.inventory.findIndex(i => i?.id === armor.id);
  const before = itemModifiers(armor).strength ?? 0;
  const result = executeCharacterCommand(player, { type: 'socketGem', gemIndex, target: { bag: bagIndex }, socketIndex: 0 });
  assert.ok(result.ok, result.message);
  const socketed = sheet.inventory[bagIndex]!;
  assert.equal(socketed.sockets![0].gem, 'bold-scarlet-ruby');
  assert.equal(socketed.sockets![0].gemLevel, gem.itemLevel);
  assert.ok((itemModifiers(socketed).strength ?? 0) > before, 'gem strength applies');
  assert.equal(sheet.inventory[gemIndex], null, 'the gem item is consumed');
  // Equipped socketed gear feeds character stats through the normal derivation.
  assert.ok(executeCharacterCommand(player, { type: 'equip', index: bagIndex }).ok);
  const equipped = sheet.equipped.chest!;
  assert.equal(player.derived.attributes.strength, sheet.attributes.strength + (itemModifiers(equipped).strength ?? 0));
});

test('socket bonus triggers only on a full color match', () => {
  const armor = socketedItem('chest', 'epic');
  armor.sockets = [{ color: 'red' }, { color: 'red' }];
  const bonus = socketBonusStats(armor)!;
  assert.ok(bonus && bonus.value > 0, 'socketable kinds always have an authored bonus');
  const ruby = { gem: 'bold-scarlet-ruby', gemLevel: armor.itemLevel };
  const mismatched = deriveItem({ ...armor, sockets: [{ color: 'red', ...ruby }, { color: 'red', gem: 'lustrous-skysapphire', gemLevel: armor.itemLevel }] });
  assert.equal(socketBonusActive(mismatched), false);
  assert.equal(mismatched.implicit[bonus.stat] ?? 0, 0, 'no bonus without a full match');
  const matched = deriveItem({ ...armor, sockets: [{ color: 'red', ...ruby }, { color: 'red', ...ruby }] });
  assert.equal(socketBonusActive(matched), true);
  assert.ok((matched.implicit[bonus.stat] ?? 0) >= bonus.value, 'matched sockets grant the bonus');
  // Hybrids match either parent color; prismatic matches all.
  const hybrid = deriveItem({ ...armor, sockets: [{ color: 'red', gem: 'etched-monarch-topaz', gemLevel: 1 }, { color: 'red', gem: 'nightmare-tear', gemLevel: 1 }] });
  assert.equal(socketBonusActive(hybrid), true, 'orange and prismatic both satisfy red sockets');
});

test('unsocketing and replacing destroy gems; invalid commands fail atomically', () => {
  const player = make(), sheet = player.character;
  const armor = socketedItem('chest', 'epic');
  const gem = createGem('solid-azure-moonstone', 7, 5);
  assert.ok(addInventoryItem(sheet, armor) && addInventoryItem(sheet, gem));
  const gemIndex = sheet.inventory.findIndex(i => i?.id === gem.id);
  const bagIndex = sheet.inventory.findIndex(i => i?.id === armor.id);
  // Invalid targets and indices leave state untouched.
  const snapshot = JSON.stringify(sheet.inventory);
  assert.equal(executeCharacterCommand(player, { type: 'socketGem', gemIndex: bagIndex, target: { bag: bagIndex }, socketIndex: 0 }).ok, false);
  assert.equal(executeCharacterCommand(player, { type: 'socketGem', gemIndex, target: { bag: bagIndex }, socketIndex: 9 }).ok, false);
  assert.equal(executeCharacterCommand(player, { type: 'socketGem', gemIndex, target: { equipped: 'amulet' }, socketIndex: 0 }).ok, false);
  assert.equal(executeCharacterCommand(player, { type: 'unsocketGem', target: { bag: bagIndex }, socketIndex: 0 }).ok, false, 'empty socket');
  assert.equal(JSON.stringify(sheet.inventory), snapshot);
  // Socket, then replace: the first gem is destroyed, not returned.
  assert.ok(executeCharacterCommand(player, { type: 'socketGem', gemIndex, target: { bag: bagIndex }, socketIndex: 0 }).ok);
  const second = createGem('quick-autumn-glow', 8, 5);
  assert.ok(addInventoryItem(sheet, second));
  const secondIndex = sheet.inventory.findIndex(i => i?.id === second.id);
  const replaced = executeCharacterCommand(player, { type: 'socketGem', gemIndex: secondIndex, target: { bag: bagIndex }, socketIndex: 0 });
  assert.ok(replaced.ok && replaced.message!.includes('shatters'));
  assert.equal(sheet.inventory[bagIndex]!.sockets![0].gem, 'quick-autumn-glow');
  assert.ok(!sheet.inventory.some(i => i && gemItemId(i) === 'solid-azure-moonstone'), 'the replaced gem is destroyed');
  // Unsocketing destroys the gem and removes its stats.
  const withGem = itemModifiers(sheet.inventory[bagIndex]!).attackSpeedPercent ?? 0;
  assert.ok(withGem > 0);
  assert.ok(executeCharacterCommand(player, { type: 'unsocketGem', target: { bag: bagIndex }, socketIndex: 0 }).ok);
  assert.equal(sheet.inventory[bagIndex]!.sockets![0].gem, undefined);
  assert.equal(itemModifiers(sheet.inventory[bagIndex]!).attackSpeedPercent ?? 0, 0);
});

test('save/load round-trips sockets, socketed gems and gem items', async () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const repo = new CharacterRepository(storage), session = new CharacterSession(repo, 4);
  const world = { seed: 7319, generationVersion: 4, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }), getPOIs: () => [] };
  const sim = new Simulation(world, { seed: 7319, spawn: false });
  assert.ok(await session.create(0, 'Rowan', 7319, sim.captureCheckpoint(), 'character-a', 100), session.error);
  const save = structuredClone(repo.read(0).record!), sheet = save.checkpoint.character;
  const armor = socketedItem('chest', 'epic', 3);
  const gem = createGem('bold-scarlet-ruby', 42, armor.itemLevel);
  assert.ok(addInventoryItem(sheet, armor) && addInventoryItem(sheet, gem));
  const bagIndex = sheet.inventory.findIndex(i => i?.id === armor.id);
  const gemIndex = sheet.inventory.findIndex(i => i?.id === gem.id);
  // Socket through the same validated path the command uses.
  assert.ok(socketGem(sheet, gemIndex, { bag: bagIndex }, 0).ok);
  const socketed = sheet.inventory[bagIndex]!;
  const spare = createGem('smooth-sun-crystal', 43, 3);
  assert.ok(addInventoryItem(sheet, spare));
  const decoded = decodeCharacterSave(JSON.stringify(save));
  assert.ok(decoded, 'socketed save must validate');
  const loaded = decoded.checkpoint.character.inventory.find(i => i?.id === armor.id)!;
  assert.deepEqual(loaded.sockets, socketed.sockets);
  assert.deepEqual(loaded.implicit, socketed.implicit, 'derived gem stats persist');
  const loadedGem = decoded.checkpoint.character.inventory.find(i => i?.id === spare.id)!;
  assert.equal(gemItemId(loadedGem), 'smooth-sun-crystal');
});

test('jeweler stock sells gems and the buy path delivers a socketable token', () => {
  const character = createCharacterSheet();
  character.gold = 1e9;
  const stock = vendorStock(character, jeweler, 10);
  const gems = stock.filter(i => i && gemItemId(i));
  assert.ok(gems.length >= 1, 'jeweler stock includes gems');
  assert.ok(gems.every(g => validItem(g!)));
  const slot = stock.findIndex(i => i && gemItemId(i));
  const quote = quoteService(character, jeweler, 10, { type: 'buy', slot });
  assert.ok(quote.ok, quote.ok ? '' : quote.message);
  const result = planService(character, jeweler, 10, quote.ok ? quote.quote : (undefined as never));
  assert.ok(result.ok, result.ok ? '' : result.message);
  assert.ok(result.item && gemItemId(result.item), 'buying yields a gem item');
  assert.ok(itemPrice(result.item!, 'buy') > 0);
  assert.equal(improvementProblem(result.item!, 'enhance', 10), 'Gems cannot be modified.');
});

test('gem catalog stays coherent: colors, stats and deterministic creation', () => {
  assert.ok(GEMS.length >= 8);
  for (const def of GEMS) {
    assert.ok(def.stats.length >= 1);
    const gem = createGem(def.id, 5, 10);
    assert.equal(gemItemId(gem), def.id);
    assert.ok(validItem(gem), `${def.id} validates`);
    assert.deepEqual(createGem(def.id, 5, 10), gem, 'creation is deterministic');
  }
  assert.notEqual(createGemForSeed(1, 10).id, createGemForSeed(2, 10).id, 'seeded picks vary');
});
