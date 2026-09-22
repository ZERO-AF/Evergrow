/** Wave 9 professions (docs/wow-deepening.md §3): Inscription, Tailoring,
 * Leatherworking and First Aid — registration, material flow and one real craft each. */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Player, WorldQuery } from '../src/model.ts';
import { Simulation } from '../src/simulation.ts';
import { executeCraft, executeUse, craftProblem, useProblem } from '../src/profession-command.ts';
import { materialCount, grantMaterial } from '../src/profession-state.ts';
import { PROFESSION_MATERIALS, PROFESSIONS, PROFESSION_IDS, findRecipe, rollClothDrop, isProfessionId, type ProfessionId } from '../src/profession-content.ts';
import { glyphItemId, isGlyphItem } from '../src/glyph-content.ts';
import { bagItemId, isBagItem } from '../src/bag-content.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';

const world: WorldQuery = {
  seed: 7319,
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
  isSanctuary: () => false,
  sampleBiome: (x) => ({ id: x < 0 ? 'verdant' : 'highlands', name: 'Test', weights: {} as never }),
};
const persist = async () => ({ ok: true, message: '' });
const sim = () => new Simulation(world, { spawn: false, startX: 0, startY: 0 });
const learn = (p: Player, id: ProfessionId, level: number) => {
  (p.professions ??= {})[id] = { level, xp: 0 };
};

test('professions-extended: all four professions registered as craft', () => {
  for (const id of ['inscription', 'tailoring', 'leatherworking', 'firstAid'] as const) {
    assert.ok(isProfessionId(id), `${id} not a profession id`);
    assert.equal(PROFESSIONS[id].kind, 'craft');
    assert.ok((PROFESSIONS[id].recipes?.length ?? 0) > 0, `${id} has no recipes`);
    assert.ok(PROFESSION_IDS.includes(id));
  }
  // Every recipe's materials and material results resolve to declared materials.
  for (const prof of Object.values(PROFESSIONS))
    for (const r of prof.recipes ?? []) {
      for (const id of Object.keys(r.materials)) assert.ok(PROFESSION_MATERIALS[id], `${r.id} needs undeclared ${id}`);
      if (!r.item) assert.ok(PROFESSION_MATERIALS[r.result], `${r.id} yields undeclared ${r.result}`);
    }
  assert.equal(findRecipe('millPeacebloom')?.profession, 'inscription');
  assert.equal(findRecipe('boltOfLinenCloth')?.profession, 'tailoring');
  assert.equal(findRecipe('cureLightHide')?.profession, 'leatherworking');
  assert.equal(findRecipe('linenBandage')?.profession, 'firstAid');
});

test('professions-extended: inscription mills herbs, presses ink, scribes a real glyph item', async () => {
  const s = sim(), p = s.player;
  learn(p, 'inscription', 300);
  grantMaterial(p, 'peacebloom', 5);
  assert.equal(craftProblem(p, 'millPeacebloom'), null);
  assert.ok((await executeCraft(s, 'millPeacebloom', persist)).ok);
  assert.equal(materialCount(p, 'peacebloom'), 0);
  assert.equal(materialCount(p, 'alabasterPigment'), 2);
  assert.ok((await executeCraft(s, 'moonglowInk', persist)).ok);
  assert.equal(materialCount(p, 'moonglowInk'), 1);
  grantMaterial(p, 'moonglowInk', 1); // glyph needs 2
  assert.ok((await executeCraft(s, 'scribeGlyphHeroicStrike', persist)).ok);
  const glyph = p.character.inventory.find(i => isGlyphItem(i));
  assert.ok(glyph, 'no glyph item in inventory');
  assert.equal(glyphItemId(glyph), 'glyph-of-heroic-strike');
  assert.equal(glyph!.name, 'Glyph of Heroic Strike');
});

test('professions-extended: tailoring weaves bolts, cloth armor and a real bag item', async () => {
  const s = sim(), p = s.player;
  learn(p, 'tailoring', 300);
  grantMaterial(p, 'linenCloth', 8);
  for (let i = 0; i < 3; i++) assert.ok((await executeCraft(s, 'boltOfLinenCloth', persist)).ok);
  assert.equal(materialCount(p, 'boltOfLinenCloth'), 3);
  assert.equal(materialCount(p, 'linenCloth'), 2);
  assert.ok((await executeCraft(s, 'linenRobe', persist)).ok);
  const robe = p.character.inventory.find(i => i?.name === 'Linen Robe');
  assert.ok(robe && robe.kind === 'chest');
  assert.equal(robe!.recipe.materialId, 'cloth');
  // Bag recipe produces a real bag item (bag-content.ts), not generic gear.
  grantMaterial(p, 'boltOfLinenCloth', 3);
  grantMaterial(p, 'linenCloth', 3);
  assert.ok((await executeCraft(s, 'linenBag', persist)).ok);
  const bag = p.character.inventory.find(i => isBagItem(i));
  assert.ok(bag, 'no bag item in inventory');
  assert.equal(bagItemId(bag), 'linen-bag');
});

test('professions-extended: leatherworking cures hides and stitches leather armor', async () => {
  const s = sim(), p = s.player;
  learn(p, 'leatherworking', 60);
  grantMaterial(p, 'lightHide', 1);
  assert.ok((await executeCraft(s, 'cureLightHide', persist)).ok);
  assert.equal(materialCount(p, 'curedLightHide'), 1);
  grantMaterial(p, 'lightLeather', 2);
  assert.ok((await executeCraft(s, 'handstitchedLeatherBoots', persist)).ok);
  const boots = p.character.inventory.find(i => i?.name === 'Handstitched Leather Boots');
  assert.ok(boots && boots.kind === 'boots');
  assert.equal(boots!.recipe.materialId, 'leather');
});

test('professions-extended: first aid bandages are usable heal-over-time consumables', async () => {
  const s = sim(), p = s.player;
  learn(p, 'firstAid', 60);
  grantMaterial(p, 'linenCloth', 3);
  assert.equal(craftProblem(p, 'linenBandage'), null);
  assert.ok((await executeCraft(s, 'linenBandage', persist)).ok);
  assert.equal(materialCount(p, 'linenBandage'), 1);
  assert.equal(materialCount(p, 'linenCloth'), 2);
  // Bandage applies a heal-over-time buff that ticks maxHp fractions.
  p.hp = Math.floor(p.maxHp / 2);
  assert.equal(useProblem(p, 'linenBandage'), null);
  assert.ok((await executeUse(s, 'linenBandage', persist)).ok);
  const bandage = p.buffs?.find(b => b.id === 'Linen Bandage');
  assert.ok(bandage, 'no bandage buff');
  assert.ok((bandage!.healPerSecond ?? 0) > 0);
  assert.equal(materialCount(p, 'linenBandage'), 0);
});

test('professions-extended: humanoid cloth drop is deterministic and level-banded', () => {
  assert.equal(rollClothDrop(42, 5)?.id ?? 'linenCloth', 'linenCloth');
  const high = rollClothDrop(42, 60);
  if (high) assert.equal(high.id, 'frostweaveCloth');
  // Same seed → same result; counts stay inside the declared range.
  for (const seed of [1, 7, 99, 123456]) {
    const a = rollClothDrop(seed, 25), b = rollClothDrop(seed, 25);
    assert.deepEqual(a, b);
    if (a) { assert.equal(a.id, 'silkCloth'); assert.ok(a.count >= 1 && a.count <= 2); }
  }
});

test('professions-extended: save accepts the new profession ids and their bags', () => {
  const s = sim(), p = s.player;
  learn(p, 'inscription', 120);
  learn(p, 'firstAid', 45);
  grantMaterial(p, 'alabasterPigment', 3);
  grantMaterial(p, 'linenBandage', 2);
  const checkpoint = s.captureCheckpoint() as unknown as Record<string, unknown>;
  checkpoint.professions = p.professions;
  const save = { version: CHARACTER_SAVE_VERSION, id: 'test-ext', name: 'T', createdAt: 1, updatedAt: 2, worldSeed: 7319, worldVersion: 1, checkpoint };
  const decoded = decodeCharacterSave(JSON.stringify(save));
  assert.ok(decoded, 'save with new profession ids rejected');
  const profs = (decoded.checkpoint as Record<string, any>).professions;
  assert.equal(profs.inscription.level, 120);
  assert.equal(profs.inscription.materials.alabasterPigment, 3);
  assert.equal(profs.firstAid.materials.linenBandage, 2);
});
