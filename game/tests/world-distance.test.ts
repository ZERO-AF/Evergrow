import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_UNITS_PER_METRE, formatWorldDistance } from '../src/world-distance.ts';

test('world units convert at 32 units per metre', () => {
  assert.equal(WORLD_UNITS_PER_METRE, 32);
  assert.equal(formatWorldDistance(32), '1 m');
  assert.equal(formatWorldDistance(0), '0 m');
  assert.equal(formatWorldDistance(160), '5 m');
  assert.equal(formatWorldDistance(31_999), '1,000 m', 'metres display until the kilometre boundary');
});

test('distances of a kilometre or more switch to km with one decimal', () => {
  assert.equal(formatWorldDistance(32_000), '1 km');
  assert.equal(formatWorldDistance(48_000), '1.5 km');
  assert.equal(formatWorldDistance(32_001), '1 km');
  assert.equal(formatWorldDistance(3_200_000), '100 km');
});

test('metre values round to whole metres and negatives clamp to zero', () => {
  assert.equal(formatWorldDistance(16), '1 m', 'half a metre rounds up');
  assert.equal(formatWorldDistance(15), '0 m');
  assert.equal(formatWorldDistance(-320), '0 m');
  assert.equal(formatWorldDistance(33.6), '1 m');
});
