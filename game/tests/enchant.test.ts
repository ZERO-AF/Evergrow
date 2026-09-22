/** Permanent gear enchants + jewelcrafting/engineering (docs/wow-deepening.md §3):
 * enchant apply → stats via deriveItem → tooltip line → save round-trip,
 * prospect → cut gem items, and engineering gadgets (bomb blast, repair bot, goggles). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import type { WorldQuery } from '../src/model.ts';
import { executeCraft, executeUse, craftProblem, useProblem } from '../src/profession-command.ts';
import { enchantProblem, executeEnchant, enchantTargets } from '../src/enchant-command.ts';
import { ENCHANTS, enchantDefinition, isEnchantId } from '../src/enchant-content.ts';
import { grantMaterial, materialCount, ensureProfession, professionLevel } from '../src/profession-state.ts';
import { PROFESSION_MATERIALS, PROFESSIONS, findRecipe } from '../src/profession-content.ts';
import { deriveItem, generateItem, itemModifiers } from '../src/items.ts';
import { addInventoryItem } from '../src/inventory.ts';
import { itemTooltipMarkup } from '../src/item-ui.ts';
import { gemItemId } from '../src/gem-content.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';
import { DURABLE_SLOTS } from '../src/durability-state.ts';

const world: WorldQuery = {
  seed: 7319,
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
  isSanctuary: () => false,
  sampleBiome: (x) => ({ id: x < 0 ? 'verdant' : 'highlands', name: 'Test', weights: {} as never }),
};
const persist = async () => ({ ok: true, message: '' });

const tooltipView = (sim: Simulation) => ({
  sheet: sim.player.character, level: sim.player.level, compare: false as const,
});

test('enchant: permanent enchant applies, derives stats, shows on tooltip, persists', async () => {
  const sim = new Simulation(world, { spawn: false, startX: 0, startY: 0 });
  const p = sim.player;
  ensureProfession(p, 'enchanting').level = 400;

  const weapon = generateItem(777, 40, 'weapon', 'longsword', 'rare');
  addInventoryItem(p.character, weapon);
  const bag = p.character.inventory.findIndex(i => i === weapon);
  const base = itemModifiers(weapon);

  // Gates: wrong kind, missing materials, then success.
  const chest = generateItem(778, 40, 'chest', undefined, 'rare');
  addInventoryItem(p.character, chest);
  const chestBag = p.character.inventory.findIndex(i => i === chest);
  assert.equal(enchantProblem(p, 'enchantWeaponCrusader', { bag: chestBag }), 'Enchant Weapon - Crusader does not fit that item.');
  assert.ok((enchantProblem(p, 'enchantWeaponCrusader', { bag }) ?? '').startsWith('Missing '));
  grantMaterial(p, 'largeBrilliantShard', 4);
  grantMaterial(p, 'dreamDust', 6);
  assert.equal(enchantProblem(p, 'enchantWeaponCrusader', { bag }), null);

  const result = await executeEnchant(sim, 'enchantWeaponCrusader', { bag }, persist);
  assert.ok(result.ok, result.message);
  const enchanted = p.character.inventory[bag]!;
  assert.equal(enchanted.enchant, 'enchantWeaponCrusader');
  // Stats fold into implicit through deriveItem.
  const mods = itemModifiers(enchanted);
  assert.equal(mods.strength, (base.strength ?? 0) + 10);
  assert.equal(mods.damagePercent, (base.damagePercent ?? 0) + 4);
  assert.ok(enchanted.power > weapon.power || enchanted.recipe.revision === weapon.recipe.revision + 1);
  // Materials were consumed.
  assert.equal(materialCount(p, 'largeBrilliantShard'), 0);
  assert.equal(materialCount(p, 'dreamDust'), 0);
  // Re-enchanting is refused.
  assert.equal(enchantProblem(p, 'enchantWeaponMongoose', { bag }), `${enchanted.name} is already enchanted.`);

  // deriveItem is idempotent: re-deriving keeps the enchant stats.
  const rederived = deriveItem(enchanted);
  assert.equal(itemModifiers(rederived).strength, mods.strength);

  // Tooltip carries the green enchant line.
  const html = itemTooltipMarkup(enchanted, tooltipView(sim));
  assert.ok(html.includes('Enchanted: Enchant Weapon - Crusader'), html.slice(0, 400));

  // Save round-trip: the enchant field survives validation and normalization.
  const checkpoint = sim.captureCheckpoint() as unknown as Record<string, unknown>;
  checkpoint.professions = p.professions;
  const save = { version: CHARACTER_SAVE_VERSION, id: 'test-ench', name: 'T', createdAt: 1, updatedAt: 2, worldSeed: 7319, worldVersion: 1, checkpoint };
  const decoded = decodeCharacterSave(JSON.stringify(save));
  assert.ok(decoded, 'save rejected');
  const restored = decoded.checkpoint.character.inventory[bag]!;
  assert.equal(restored.enchant, 'enchantWeaponCrusader');
  assert.equal(itemModifiers(restored).strength, mods.strength);

  // A bogus enchant id fails validation.
  const corrupt = JSON.parse(JSON.stringify(save));
  corrupt.checkpoint.character.inventory[bag].enchant = 'not-a-real-enchant';
  assert.equal(decodeCharacterSave(JSON.stringify(corrupt)), null);
  // A weapon enchant on armor fails validation too.
  const misplaced = JSON.parse(JSON.stringify(save));
  misplaced.checkpoint.character.inventory[chestBag].enchant = 'enchantWeaponCrusader';
  assert.equal(decodeCharacterSave(JSON.stringify(misplaced)), null);
});

test('enchant: equipped target and enchantTargets listing', async () => {
  const sim = new Simulation(world, { spawn: false, startX: 0, startY: 0 });
  const p = sim.player;
  ensureProfession(p, 'enchanting').level = 450;
  const boots = generateItem(555, 30, 'boots', undefined, 'magic');
  p.character.equipped.boots = boots;
  const targets = enchantTargets(p.character, 'enchantBootsGreaterFortitude');
  assert.ok(targets.some(t => 'equipped' in t.target && t.target.equipped === 'boots'));
  grantMaterial(p, 'dreamDust', 4);
  grantMaterial(p, 'visionDust', 4);
  const result = await executeEnchant(sim, 'enchantBootsGreaterFortitude', { equipped: 'boots' }, persist);
  assert.ok(result.ok, result.message);
  assert.equal(p.character.equipped.boots!.enchant, 'enchantBootsGreaterFortitude');
  assert.ok((itemModifiers(p.character.equipped.boots!).maxHp ?? 0) >= 100);
});

test('jewelcrafting: prospect ore → cut gem → socketable item', async () => {
  const sim = new Simulation(world, { spawn: false, startX: 0, startY: 0 });
  const p = sim.player;
  ensureProfession(p, 'jewelcrafting').level = 200;

  assert.equal(findRecipe('prospectIronRuby')?.profession, 'jewelcrafting');
  assert.equal(findRecipe('cutScarletRuby')?.profession, 'jewelcrafting');
  assert.equal(PROFESSIONS.jewelcrafting.name, 'Jewelcrafting');

  // Prospect: 5 ore → 1 raw gem material.
  grantMaterial(p, 'ironOre', 5);
  assert.equal(craftProblem(p, 'prospectIronRuby'), null);
  assert.ok((await executeCraft(sim, 'prospectIronRuby', persist)).ok);
  assert.equal(materialCount(p, 'ironOre'), 0);
  assert.equal(materialCount(p, 'rawScarletRuby'), 1);

  // Cut: raw gem → a real socketable gem item in the pack.
  assert.equal(craftProblem(p, 'cutScarletRuby'), null);
  assert.ok((await executeCraft(sim, 'cutScarletRuby', persist)).ok);
  const gem = p.character.inventory.find(i => i && gemItemId(i));
  assert.ok(gem, 'no gem item crafted');
  assert.equal(gemItemId(gem), 'bold-scarlet-ruby');
  assert.equal(materialCount(p, 'rawScarletRuby'), 0);
  assert.ok(professionLevel(p, 'jewelcrafting') >= 1);
});

test('engineering: parts → bomb blast, repair bot, goggles', async () => {
  const sim = new Simulation(world, { spawn: false, startX: 0, startY: 0 });
  const p = sim.player;
  ensureProfession(p, 'engineering').level = 300;
  assert.equal(PROFESSIONS.engineering.name, 'Engineering');

  // Parts chain: bars → bolts → bombs.
  grantMaterial(p, 'copperBar', 4);
  grantMaterial(p, 'roughStone', 4);
  assert.ok((await executeCraft(sim, 'copperBolts', persist)).ok);
  assert.equal(materialCount(p, 'copperBolts'), 2);
  assert.ok((await executeCraft(sim, 'roughCopperBomb', persist)).ok);
  assert.equal(materialCount(p, 'roughCopperBomb'), 2);

  // Bomb: thrown AoE — enemies in radius take the blast dot and a stun.
  const near = sim.spawnEnemy('brute', p.x + 1, p.y)!;
  const far = sim.spawnEnemy('brute', p.x + 500, p.y)!;
  assert.ok(near && far);
  assert.equal(useProblem(p, 'roughCopperBomb'), null);
  assert.ok((await executeUse(sim, 'roughCopperBomb', persist)).ok);
  assert.ok(near.dots?.some(d => d.dps === 30), 'near enemy missing blast dot');
  assert.ok(!far.dots?.length, 'far enemy should be untouched');
  assert.equal(materialCount(p, 'roughCopperBomb'), 1);

  // Repair bot restores worn durability.
  p.durability = { weapon: 40, chest: 10 };
  grantMaterial(p, 'fieldRepairBot', 1);
  assert.equal(useProblem(p, 'fieldRepairBot'), null);
  assert.ok((await executeUse(sim, 'fieldRepairBot', persist)).ok);
  for (const slot of DURABLE_SLOTS) assert.equal(p.durability![slot], 100);
  assert.equal(materialCount(p, 'fieldRepairBot'), 0);
  assert.equal(useProblem(p, 'fieldRepairBot'), 'No Field Repair Bot 74A left.');

  // Goggles craft into a real head item.
  grantMaterial(p, 'copperTube', 2);
  grantMaterial(p, 'lightLeather', 2);
  assert.equal(craftProblem(p, 'flyingTigerGoggles'), null);
  assert.ok((await executeCraft(sim, 'flyingTigerGoggles', persist)).ok);
  const goggles = p.character.inventory.find(i => i?.name === 'Flying Tiger Goggles');
  assert.ok(goggles && goggles.kind === 'head');
});

test('enchant content integrity', () => {
  assert.ok(ENCHANTS.length >= 15);
  for (const def of ENCHANTS) {
    assert.ok(isEnchantId(def.id));
    assert.ok(def.kinds.length > 0);
    assert.ok(Object.keys(def.stats).length > 0);
    for (const id of Object.keys(def.materials)) assert.ok(PROFESSION_MATERIALS[id], `${def.id} needs undeclared ${id}`);
  }
  assert.equal(enchantDefinition('enchantWeaponMongoose')?.stats.dexterity, 12);
});
