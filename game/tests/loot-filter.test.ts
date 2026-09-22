import test from 'node:test';
import assert from 'node:assert/strict';
import { lootFilterHides, LOOT_FILTER_MODES } from '../src/loot.ts';
import { lootBeamAnchors } from '../src/loot-beam.ts';
import { groundLootVisibility, hoveredGroundLoot } from '../src/ground-loot-hover.ts';
import { drawGroundLoot, drawLootLabels } from '../src/loot-art.ts';
import { generateItem } from '../src/items.ts';
import type { GroundItem } from '../src/character-types.ts';
import type { ItemTier } from '../src/character-types.ts';

const drop = (id: number, tier: ItemTier, x = 0, y = 0): GroundItem =>
  ({ id, x, y, item: generateItem(9000 + id, 10, 'ring', undefined, tier) });

const canvasContext = () => {
  const calls: string[] = [];
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    measureText: (value: string) => ({ width: value.length * 6, actualBoundingBoxAscent: 8 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  }, {
    get: (target, key) => key in target
      ? (target as Record<PropertyKey, unknown>)[key]
      : (...args: unknown[]) => { calls.push(String(key)); return args.length; },
  }) as unknown as CanvasRenderingContext2D;
  return { context, calls };
};

const withDocument = (t: test.TestContext) => {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => ({ getContext: () => canvasContext().context }) },
  });
  t.after(() => { if (old) Object.defineProperty(globalThis, 'document', old); else Reflect.deleteProperty(globalThis, 'document'); });
};

test('filter thresholds hide exactly the tiers below their cutoff', () => {
  assert.deepEqual(LOOT_FILTER_MODES, ['off', 'hideCommon', 'hideBelowRare', 'hideBelowEpic']);
  for (const tier of ['common', 'magic', 'rare', 'epic', 'legendary', 'unique'] as const)
    assert.equal(lootFilterHides(tier, 'off'), false, `${tier} survives off`);
  assert.equal(lootFilterHides('common', 'hideCommon'), true);
  assert.equal(lootFilterHides('magic', 'hideCommon'), false);
  assert.equal(lootFilterHides('common', 'hideBelowRare'), true);
  assert.equal(lootFilterHides('magic', 'hideBelowRare'), true);
  assert.equal(lootFilterHides('rare', 'hideBelowRare'), false);
  assert.equal(lootFilterHides('epic', 'hideBelowEpic'), false);
  assert.equal(lootFilterHides('rare', 'hideBelowEpic'), true);
  assert.equal(lootFilterHides('legendary', 'hideBelowEpic'), false);
  assert.equal(lootFilterHides('unique', 'hideBelowEpic'), false);
});

test('beams skip filtered drops while keeping their spread slot for survivors', () => {
  const drops = [drop(1, 'common'), drop(2, 'rare'), drop(3, 'magic')];
  const all = lootBeamAnchors(drops, 10);
  assert.deepEqual(all.map(a => a.drop.id), [1, 2, 3]);
  const filtered = lootBeamAnchors(drops, 10, false, 'hideBelowRare');
  assert.deepEqual(filtered.map(a => a.drop.id), [2], 'only the rare beam survives');
  assert.equal(filtered[0]!.x, all[1]!.x, 'rare beam keeps its multi-drop offset');
  assert.equal(filtered[0]!.y, all[1]!.y);
  assert.deepEqual(lootBeamAnchors(drops, 10, false, 'hideBelowEpic').map(a => a.drop.id), []);
  // Unlanded drops never beam regardless of filter.
  const flying = [{ ...drop(4, 'legendary'), flight: { at: 5, delay: 0, x: -40, y: -40 } }];
  assert.equal(lootBeamAnchors(flying, 5.5).length, 0);
});

test('filtered labels stay hidden but hoverable so pickup still resolves', () => {
  const labels = [
    { id: 1, x: 0, y: 0, width: 0, height: 0, anchorX: 0, anchorY: 0, filtered: true },
    { id: 2, x: 50, y: 0, width: 80, height: 19, anchorX: 60, anchorY: 0 },
  ];
  const shown = groundLootVisibility(labels, { showAll: true, filter: 'hideBelowRare' });
  assert.equal(shown.find(l => l.id === 1)!.visible, false, 'common plate never draws under the filter');
  assert.equal(shown.find(l => l.id === 2)!.visible, true);
  assert.equal(hoveredGroundLoot(shown, 0, 0)?.id, 1, 'filtered item still resolves for pickup');
  assert.equal(hoveredGroundLoot(shown, 0, 0)?.filtered, true);
});

test('drawGroundLoot collapses filtered drops to a faint dot and keeps silhouettes above the cutoff', () => {
  const { context, calls } = canvasContext();
  drawGroundLoot(context, [drop(1, 'common'), drop(2, 'rare', 60, 0)], 10, true, 10, 'hideBelowRare');
  assert.equal(calls.filter(name => name === 'arc').length, 1, 'filtered drop draws only the marker dot');
  assert.ok(calls.includes('ellipse'), 'unfiltered drop keeps its ground shadow');
  calls.length = 0;
  drawGroundLoot(context, [drop(3, 'common')], 10, true, 10, 'off');
  assert.equal(calls.filter(name => name === 'arc').length, 0, 'off draws the full silhouette');
});

test('drawLootLabels hides the filtered plate, keeps a pickup target, and reveal restores it', t => {
  withDocument(t);
  const { context } = canvasContext();
  const drops = [drop(1, 'common'), drop(2, 'rare', 60, 0)];
  const identity = (x: number, y: number) => ({ x, y });
  const filtered = drawLootLabels(context, drops, identity, 1000, 600, { showAll: true, filter: 'hideBelowRare' });
  const commonLabel = filtered.find(l => l.id === 1)!;
  assert.equal(commonLabel.visible, false, 'common label hidden at hideBelowRare');
  assert.equal(commonLabel.filtered, true);
  assert.equal(filtered.find(l => l.id === 2)!.visible, true, 'rare label still draws');
  assert.equal(hoveredGroundLoot(filtered, commonLabel.anchorX, commonLabel.anchorY)?.id, 1, 'filtered drop still pickups');
  const revealed = drawLootLabels(context, drops, identity, 1000, 600, { showAll: true, filter: 'off' });
  assert.equal(revealed.find(l => l.id === 1)!.visible, true, 'reveal shows the common label');
});
