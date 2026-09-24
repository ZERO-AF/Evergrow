import test from 'node:test';
import assert from 'node:assert/strict';
import { WEATHER_RECIPES, weatherMix } from '../src/weather-content.ts';
import { BIOME_IDS, type BiomeWeights } from '../src/biomes.ts';

const weights = (over: Partial<BiomeWeights> = {}): BiomeWeights =>
  Object.fromEntries(BIOME_IDS.map(id => [id, over[id] ?? 0])) as BiomeWeights;

test('every biome has a frozen recipe and clear biomes carry no particles', () => {
  for (const id of BIOME_IDS) {
    const recipe = WEATHER_RECIPES[id];
    assert.ok(recipe, id);
    assert.ok(Object.isFrozen(recipe) && Object.isFrozen(recipe.colors));
    if (recipe.kind === 'none') assert.equal(recipe.density, 0);
    else assert.ok(recipe.density > 0 && recipe.colors.length > 0, id);
  }
});

test('a single full-weight biome yields its own recipe at its authored intensity', () => {
  const mix = weatherMix(weights({ frostpine: 1 }));
  const recipe = WEATHER_RECIPES.frostpine;
  assert.equal(mix.kind, 'snow');
  assert.deepEqual(mix.colors, recipe.colors);
  assert.equal(mix.fall, recipe.fall);
  assert.equal(mix.intensity, recipe.density);
  // Every climate now carries some weather; a sub-threshold weight still clears.
  const faint = weatherMix(weights({ steppe: .0005 }));
  assert.equal(faint.kind, 'none');
  assert.equal(faint.intensity, 0);
});

test('blended weights pick the dominant kind and share-average the numbers', () => {
  const mix = weatherMix(weights({ swamp: .6, frostpine: .4 }));
  const swampShare = .6 * WEATHER_RECIPES.swamp.density, frostShare = .4 * WEATHER_RECIPES.frostpine.density;
  assert.equal(mix.kind, 'rain', 'swamp dominates');
  const intensity = swampShare + frostShare;
  assert.ok(Math.abs(mix.intensity - intensity) < 1e-9);
  const expectedFall = (WEATHER_RECIPES.swamp.fall * swampShare + WEATHER_RECIPES.frostpine.fall * frostShare) / intensity;
  assert.ok(Math.abs(mix.fall - expectedFall) < 1e-9);
});

test('empty or negligible weights produce the no-weather mix', () => {
  const none = weatherMix(weights());
  assert.equal(none.kind, 'none');
  assert.equal(none.intensity, 0);
  const faint = weatherMix(weights({ deadwood: .001 }));
  assert.equal(faint.kind, 'none', 'intensity below .001 is treated as clear');
});

test('intensity is capped at 1 for over-saturated weights', () => {
  const mix = weatherMix(weights({ swamp: 2 }));
  assert.equal(mix.intensity, 1);
  assert.equal(mix.kind, 'rain');
});
