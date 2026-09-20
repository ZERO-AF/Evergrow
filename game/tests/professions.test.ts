/** Professions feature smoke test (docs/wow-deepening.md §3): gather → craft → disenchant → use → save. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import type { WorldQuery } from '../src/model.ts';
import { gatherNodesIn, gatherChannelOf, startGather, gatherChannelReady, advanceGatherChannel, focusGatherNode } from '../src/gather-node.ts';
import { executeGather, executeCraft, executeDisenchant, executeUse, craftProblem, disenchantProblem, useProblem } from '../src/profession-command.ts';
import { materialCount, grantMaterial, professionLevel } from '../src/profession-state.ts';
import { PROFESSION_MATERIALS, PROFESSIONS, findRecipe } from '../src/profession-content.ts';
import { generateItem } from '../src/items.ts';
import { addInventoryItem } from '../src/inventory.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';

const world: WorldQuery = {
  seed: 7319,
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
  isSanctuary: () => false,
  sampleBiome: (x) => ({ id: x < 0 ? 'verdant' : 'highlands', name: 'Test', weights: {} as never }),
};
const idle = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const persist = async () => ({ ok: true, message: '' });

test('professions: gather, craft, disenchant, use, save round-trip', async () => {
  const sim = new Simulation(world, { spawn: false, startX: 0, startY: 0 });
  const p = sim.player;

  // Node generation
  const nodes = gatherNodesIn(world, p, 0, -6000, -6000, 12000, 12000);
  assert.ok(nodes.length > 30, `got ${nodes.length}`);
  assert.ok(new Set(nodes.map(n => n.def.profession)).size >= 2);
  const herb = nodes.find(n => n.def.profession === 'herbalism')!;
  assert.ok(herb && nodes.some(n => n.def.profession === 'skinning'));

  // Gather flow: focus → channel → complete
  p.x = herb.x; p.y = herb.y; p.prevX = p.x; p.prevY = p.y;
  assert.equal(focusGatherNode(world, p, sim.time, p)?.id, herb.id);
  assert.equal(startGather(sim, herb), null);
  assert.equal(gatherChannelOf(sim)?.node.id, herb.id);
  for (let i = 0; i < 60; i++) advanceGatherChannel(sim, .05, idle);
  assert.ok(gatherChannelReady(sim));
  const g = await executeGather(sim, herb, persist);
  assert.ok(g.ok, g.message);
  assert.ok(materialCount(p, 'peacebloom') + materialCount(p, 'silverleaf') + materialCount(p, 'earthroot') > 0);
  assert.ok(professionLevel(p, 'herbalism') >= 1);
  assert.ok(!gatherNodesIn(world, p, sim.time, herb.x - 10, herb.y - 10, 20, 20).some(n => n.id === herb.id));
  assert.ok(gatherNodesIn(world, p, sim.time + 400, herb.x - 10, herb.y - 10, 20, 20).some(n => n.id === herb.id));

  // Crafting: smelt consumes ore, gear recipe produces a real item
  grantMaterial(p, 'copperOre', 4);
  assert.equal(craftProblem(p, 'smeltCopper'), null);
  assert.ok((await executeCraft(sim, 'smeltCopper', persist)).ok);
  assert.ok(materialCount(p, 'copperBar') >= 1);
  assert.equal(materialCount(p, 'copperOre'), 3);
  assert.ok((craftProblem(p, 'minorHealingPotion') ?? '').startsWith('Missing '));
  grantMaterial(p, 'copperBar', 10);
  assert.ok((await executeCraft(sim, 'copperBracers', persist)).ok);
  const crafted = p.character.inventory.find(i => i?.name === 'Copper Bracers');
  assert.ok(crafted && crafted.kind === 'gloves');

  // Disenchant destroys the item and yields essences
  const magic = generateItem(12345, 10, 'boots', undefined, 'magic');
  addInventoryItem(p.character, magic);
  const idx = p.character.inventory.findIndex(i => i === magic);
  assert.equal(disenchantProblem(p, idx), null);
  assert.ok((await executeDisenchant(sim, idx, persist)).ok);
  assert.equal(p.character.inventory[idx], null);
  assert.ok(materialCount(p, 'strangeDust') + materialCount(p, 'lesserMagicEssence') > 0);
  const locked = generateItem(999, 10, 'boots', undefined, 'magic');
  locked.locked = true;
  addInventoryItem(p.character, locked);
  assert.equal(disenchantProblem(p, p.character.inventory.findIndex(i => i === locked)), 'Unlock the item first.');

  // Use: heal potion, Well Fed buff, weapon imbue scroll
  grantMaterial(p, 'minorHealingPotion', 2);
  p.hp = 10;
  assert.ok((await executeUse(sim, 'minorHealingPotion', persist)).ok);
  assert.equal(p.hp, 90);
  assert.equal(materialCount(p, 'minorHealingPotion'), 1);
  grantMaterial(p, 'bearSteak', 1);
  assert.ok((await executeUse(sim, 'bearSteak', persist)).ok);
  assert.ok(p.buffs?.some(b => b.id === 'Well Fed' && b.stats?.vitality === 4));
  grantMaterial(p, 'enchantWeaponFiery', 1);
  assert.equal(useProblem(p, 'enchantWeaponFiery'), null);
  assert.ok((await executeUse(sim, 'enchantWeaponFiery', persist)).ok);
  assert.ok(p.buffs?.some(b => b.id === 'Fiery Weapon' && b.stats?.damagePercent === 8));

  // Save round-trip: bags, respawn bookkeeping, and staged buffs survive validation
const checkpoint = sim.captureCheckpoint() as unknown as Record<string, unknown>;
  checkpoint.professions = p.professions; checkpoint.fishing = p.fishing;
  const save = { version: CHARACTER_SAVE_VERSION, id: 'test-1', name: 'T', createdAt: 1, updatedAt: 2, worldSeed: 7319, worldVersion: 1, checkpoint };
  const decoded = decodeCharacterSave(JSON.stringify(save));
  assert.ok(decoded);
  const profs = (decoded.checkpoint as Record<string, any>).professions;
  assert.ok(Object.keys(profs?.herbalism?.materials ?? {}).length > 0);
  assert.notEqual(profs?.herbalism?.gathered?.[herb.id], undefined);
  assert.ok((decoded.checkpoint as Record<string, any>).buffs?.some((b: { id: string }) => b.id === 'Fiery Weapon'));
});

test('professions: recipe data integrity', () => {
  assert.equal(findRecipe('smeltCopper')?.profession, 'mining');
  assert.equal(findRecipe('roastedBoarMeat')?.profession, 'cooking');
  for (const prof of Object.values(PROFESSIONS))
    for (const r of prof.recipes ?? []) {
      for (const id of Object.keys(r.materials)) assert.ok(PROFESSION_MATERIALS[id], `${r.id} needs undeclared ${id}`);
      if (!r.item) assert.ok(PROFESSION_MATERIALS[r.result], `${r.id} yields undeclared ${r.result}`);
    }
});
