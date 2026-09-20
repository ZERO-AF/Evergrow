import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { activeBuffs } from '../src/active-buffs.ts';
import { addInventoryItem } from '../src/inventory-grid.ts';
import { useInventoryItem } from '../src/inventory.ts';
import { useConsumable, useConsumableId } from '../src/consumable-command.ts';
import { createConsumableItem, consumableCount, ownedConsumables, consumableBuffCategory } from '../src/consumable-content.ts';
import { generateItem } from '../src/items.ts';
const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const make = () => { const p = new Simulation(world, { spawn: false }).player; p.level = 80; return p; };
test('flask applies a persistent buff; same-category replaces, cross-category stacks', () => {
  const p = make();
  assert.ok(addInventoryItem(p.character, createConsumableItem('flaskEndlessRage', 7, 3)));
  assert.ok(addInventoryItem(p.character, createConsumableItem('flaskFrostWyrm', 8, 1)));
  assert.ok(addInventoryItem(p.character, createConsumableItem('elixirWrath', 9, 2)));
  assert.equal(consumableCount(p.character, 'flaskEndlessRage'), 3);
  const flaskIdx = p.character.inventory.findIndex(i => i?.id.startsWith('consumable:flaskEndlessRage'));
  assert.ok(useConsumable(p, flaskIdx).ok);
  assert.equal(p.buffs?.length, 1);
  assert.equal(p.buffs![0]!.exclusiveGroup, 'consumable:flask');
  assert.equal(p.buffs![0]!.duration, 3600);
  assert.equal(consumableCount(p.character, 'flaskEndlessRage'), 2);
  // Same-category flask replaces the active flask buff.
  assert.ok(useConsumableId(p, 'flaskFrostWyrm').ok);
  assert.equal(p.buffs!.length, 1);
  assert.equal(p.buffs![0]!.id, 'consumable:flaskFrostWyrm');
  // Cross-category elixir stacks alongside the flask.
  assert.ok(useConsumableId(p, 'elixirWrath').ok);
  assert.equal(p.buffs!.length, 2);
  assert.equal(consumableBuffCategory(p.buffs![1]!), 'battleElixir');
  // Buff bar projection shows the consumable with its category icon.
  const shown = activeBuffs(p).filter(b => b.icon.startsWith('consumable:'));
  assert.equal(shown.length, 2);
  assert.ok(shown.every(b => b.persistent));
});

test('potions heal instantly, share a cooldown, and stacks merge in the pack', () => {
  const p = make();
  p.hp = p.maxHp * .4;
  assert.ok(addInventoryItem(p.character, createConsumableItem('runicHealingPotion', 11, 5)));
  assert.ok(addInventoryItem(p.character, createConsumableItem('runicHealingPotion', 12, 5)));
  // Same definition merges into one stack of 10.
  assert.equal(consumableCount(p.character, 'runicHealingPotion'), 10);
  assert.equal(p.character.inventory.filter(i => i?.id.startsWith('consumable:runicHealingPotion')).length, 1);
  assert.ok(useConsumableId(p, 'runicHealingPotion').ok);
  assert.ok(p.hp > p.maxHp * .7);
  assert.equal(consumableCount(p.character, 'runicHealingPotion'), 9);
  // Shared cooldown blocks the next sip.
  assert.equal(useConsumableId(p, 'runicHealingPotion').ok, false);
});

test('useInventoryItem routes consumables to use and gear to equip', () => {
  const p = make();
  assert.ok(addInventoryItem(p.character, createConsumableItem('fishFeast', 21, 1)));
  const idx = p.character.inventory.findIndex(i => i?.kind === 'consumable');
  const result = useInventoryItem(p, idx);
  assert.ok(result.ok);
  assert.equal(p.buffs![0]!.name, 'Well Fed');
  assert.equal(consumableCount(p.character, 'fishFeast'), 0);
  // Gear still equips through the same entry point.
  const sword = generateItem(99, 10, 'weapon', 'longsword', 'common');
  assert.ok(addInventoryItem(p.character, sword));
  const swordIdx = p.character.inventory.findIndex(i => i?.id === sword.id);
  assert.ok(useInventoryItem(p, swordIdx).ok);
  assert.equal(p.character.equipped.weapon?.id, sword.id);
});

test('generateItem and deriveItem round-trip consumables; ownedConsumables lists distinct defs', () => {
  const p = make();
  const item = generateItem(55, 80, 'consumable', 'potionOfSpeed', 'common');
  assert.equal(item.kind, 'consumable');
  assert.equal(item.stack, 1);
  assert.ok(addInventoryItem(p.character, item));
  assert.ok(addInventoryItem(p.character, createConsumableItem('elixirProtection', 56, 4)));
  const owned = ownedConsumables(p.character).map(o => o.def.id).sort();
  assert.deepEqual(owned, ['elixirProtection', 'potionOfSpeed']);
});
