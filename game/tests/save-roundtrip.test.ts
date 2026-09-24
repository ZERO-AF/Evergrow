import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import {
  CHARACTER_SAVE_VERSION, CHECKPOINT_PLAYER_KEYS, CHECKPOINT_WORLD_KEYS,
  decodeCharacterSave, mergeCheckpoint, playerFieldsOf, worldFieldsOf,
} from '../src/character-save.ts';
import { bundleChart, chartKey, decodeSaveBundle, makeSaveBundle } from '../src/save-bundle.ts';
import { generateItem } from '../src/items.ts';
import type { CharacterSave } from '../src/character-save.ts';
import type { DecodedExploration } from '../src/exploration-save.ts';
import type { WorldQuery } from '../src/model.ts';

const world: WorldQuery = {
  seed: 7319, generationVersion: 4,
  blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
};
const sim = () => new Simulation(world, { seed: 7319, spawn: false });
const record = (checkpoint: unknown): CharacterSave => ({
  version: CHARACTER_SAVE_VERSION, id: 'roundtrip', name: 'Rowan', createdAt: 1, updatedAt: 2,
  worldSeed: 7319, worldVersion: 4, checkpoint: checkpoint as CharacterSave['checkpoint'],
});

/** A checkpoint carrying the fields a real mid-game save holds. */
function playedCheckpoint() {
  const s = sim();
  s.player.x = 8120; s.player.y = -1660; s.player.angle = 1.2;
  s.player.level = 12; s.player.xp = 340; s.player.hp = 61; s.player.mana = 22;
  // Level-12 validation requires the sheet's unspent points to match level-1.
  s.player.character.skillPoints = 11; s.player.character.statPoints = 55;
  s.player.restedXp = 500; s.player.durability = { weapon: 42, chest: 77 };
  s.player.combatLog = [{ kind: 'system', text: 'You feel rested.', time: 3 }];
  s.player.character.gold = 1234;
  s.time = 126; s.kills = 15;
  s.travel = { homeTown: 2, returnTo: { x: 100, y: 200, town: 2 }, flightPaths: ['fp:briarwatch'] };
  s.groundItems.push({ id: 39, x: 8100, y: -1650, item: generateItem(881, 7, 'ring', undefined, 'legendary') });
  return s.captureCheckpoint();
}

test('checkpoint → JSON → decode → restore reproduces the identical checkpoint', () => {
  const checkpoint = playedCheckpoint();
  const decoded = decodeCharacterSave(JSON.stringify(record(checkpoint)));
  assert.ok(decoded, 'a live checkpoint must survive save validation');
  assert.deepEqual(decoded.checkpoint, JSON.parse(JSON.stringify(checkpoint)),
    'decode must not rewrite a valid checkpoint');

  const restored = sim();
  restored.restoreCheckpoint(decoded.checkpoint);
  assert.deepEqual(restored.captureCheckpoint(), decoded.checkpoint,
    'restore → capture must be a fixed point');
  // Restoring over dirty state is a full overwrite, not a merge.
  restored.player.x = -999; restored.player.hp = 1; restored.time = 9999; restored.kills = 0;
  restored.groundItems.length = 0;
  restored.restoreCheckpoint(decoded.checkpoint);
  assert.deepEqual(restored.captureCheckpoint(), decoded.checkpoint);
});

test('durability and the combat log survive a save round trip', () => {
  const checkpoint = playedCheckpoint();
  assert.equal(checkpoint.durability!.weapon, 42, 'capture must include durability');
  assert.equal(checkpoint.combatLog![0].text, 'You feel rested.', 'capture must include the combat log');
  const restored = sim();
  restored.restoreCheckpoint(checkpoint);
  assert.equal(restored.player.durability!.weapon, 42);
  assert.equal(restored.player.durability!.chest, 77);
  assert.deepEqual(restored.player.combatLog, [{ kind: 'system', text: 'You feel rested.', time: 3 }]);
});

test('travel state and ground loot survive a save round trip', () => {
  const checkpoint = playedCheckpoint();
  const restored = sim();
  restored.restoreCheckpoint(checkpoint);
  assert.deepEqual(restored.travel, checkpoint.travel, 'home town, return link and flight paths persist');
  assert.equal(restored.groundItems.length, 1);
  assert.equal(restored.groundItems[0].item.id, checkpoint.groundItems[0].item.id);
  assert.equal(restored.player.x, 8120);
  assert.equal(restored.player.restedXp, 500);
});

test('a dead checkpoint restores with the return link cleared', () => {
  const checkpoint = playedCheckpoint();
  checkpoint.dead = true;
  const restored = sim();
  restored.restoreCheckpoint(checkpoint);
  assert.equal(restored.player.dead, true);
  assert.equal(restored.travel.returnTo, null, 'death must clear the expedition return link');
  assert.equal(restored.travel.homeTown, 2, 'the home town survives death');
});

test('world/player field split is disjoint, exhaustive and reassembles the checkpoint', () => {
  const overlap = CHECKPOINT_WORLD_KEYS.filter(key => (CHECKPOINT_PLAYER_KEYS as readonly string[]).includes(key));
  assert.deepEqual(overlap, [], 'a field cannot live in both halves');
  const checkpoint = playedCheckpoint();
  const world = worldFieldsOf(checkpoint), player = playerFieldsOf(checkpoint);
  assert.deepEqual(mergeCheckpoint(world, player), checkpoint);
  // Every captured key lands in exactly one half.
  for (const key of Object.keys(checkpoint))
    assert.ok(key in world || key in player, `${key} escaped the checkpoint split`);
});

test('save bundles round-trip the character and the exact exploration chart', () => {
  const checkpoint = playedCheckpoint();
  const save = record(checkpoint);
  const chart: DecodedExploration = {
    chunks: [{ x: 3, y: -2, words: Uint32Array.from({ length: 32 }, (_, i) => i * 7), revision: 0 }],
    pois: [{ id: 'poi:test', kind: 'portal', x: 10, y: 20, name: 'Test', description: 'marker' }],
  };
  const bundle = makeSaveBundle(save, chart);
  assert.equal(chartKey(save), 'evergrow:exploration:1:4:7319:roundtrip');
  const decoded = decodeSaveBundle(JSON.stringify(bundle));
  assert.ok(decoded);
  assert.deepEqual(decoded.character.checkpoint, save.checkpoint);
  const decodedChart = bundleChart(decoded);
  assert.deepEqual(decodedChart.pois, chart.pois);
  assert.deepEqual([...decodedChart.chunks[0].words], [...chart.chunks[0].words]);
  assert.equal(decodedChart.chunks[0].x, 3);
  assert.equal(decodedChart.chunks[0].y, -2);

  // Corruption and identity mismatches are rejected wholesale.
  assert.equal(decodeSaveBundle('not json'), null);
  assert.equal(decodeSaveBundle(JSON.stringify({ format: 'evergrow', version: 2, character: save, chart: '' })), null);
  // Tamper with the character's seed AFTER the chart was encoded for 7319 —
  // the chart's embedded seed no longer matches the character's worldSeed.
  const tampered = JSON.parse(JSON.stringify(bundle));
  tampered.character.worldSeed = 999;
  assert.equal(decodeSaveBundle(JSON.stringify(tampered)), null,
    'a chart keyed to another world seed must not load');
});
