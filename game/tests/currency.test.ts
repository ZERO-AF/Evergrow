import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COPPER_PER_GOLD, COPPER_PER_SILVER, formatCopper, formatCopperCompact, formatWallet,
  formatWalletCompact, splitCopper, toCopper, validCopper,
} from '../src/currency.ts';
import { GAME_FEATURES } from '../src/game-features.ts';

test('denominations convert at 1g = 100s = 10_000c', () => {
  assert.equal(COPPER_PER_GOLD, 10_000); assert.equal(COPPER_PER_SILVER, 100);
  assert.equal(toCopper(12, 34, 56), 123_456);
  assert.equal(toCopper(1), 10_000); assert.equal(toCopper(0, 1), 100); assert.equal(toCopper(0, 0, 7), 7);
  assert.equal(toCopper(), 0);
  for (const bad of [[-1, 0, 0], [0, .5, 0], [0, 0, NaN], [Number.MAX_SAFE_INTEGER, 0, 0]] as const)
    assert.equal(toCopper(...bad), 0);
});

test('splitCopper decomposes a copper total and normalizes display input', () => {
  assert.deepEqual(splitCopper(123_456), { gold: 12, silver: 34, copper: 56 });
  assert.deepEqual(splitCopper(0), { gold: 0, silver: 0, copper: 0 });
  assert.deepEqual(splitCopper(99), { gold: 0, silver: 0, copper: 99 });
  assert.deepEqual(splitCopper(10_000), { gold: 1, silver: 0, copper: 0 });
  assert.deepEqual(splitCopper(12.7), { gold: 0, silver: 0, copper: 13 });
  assert.deepEqual(splitCopper(-50), { gold: 0, silver: 0, copper: 0 });
  assert.deepEqual(splitCopper(NaN), { gold: 0, silver: 0, copper: 0 });
});

test('formatCopper always shows every denomination', () => {
  assert.equal(formatCopper(123_456), '12g 34s 56c');
  assert.equal(formatCopper(0), '0g 0s 0c');
  assert.equal(formatCopper(56), '0g 0s 56c');
  assert.equal(formatCopper(10_000), '1g 0s 0c');
});

test('formatCopperCompact drops zero denominations but keeps copper', () => {
  assert.equal(formatCopperCompact(123_456), '12g 34s 56c');
  assert.equal(formatCopperCompact(120_056), '12g 56c');
  assert.equal(formatCopperCompact(3_400), '34s');
  assert.equal(formatCopperCompact(56), '56c');
  assert.equal(formatCopperCompact(0), '0c');
  assert.equal(formatCopperCompact(10_000), '1g');
});

test('wallet formatters follow the currency feature flag', () => {
  assert.equal(GAME_FEATURES.currency, true);
  assert.equal(formatWallet(123_456), '12g 34s 56c');
  assert.equal(formatWalletCompact(123_456), '12g 34s 56c');
  GAME_FEATURES.currency = false;
  try {
    assert.equal(formatWallet(123_456), '123,456');
    assert.equal(formatWalletCompact(123_456), '123,456');
  } finally { GAME_FEATURES.currency = true; }
});

test('validCopper accepts only whole non-negative safe integers', () => {
  for (const good of [0, 1, 123_456, Number.MAX_SAFE_INTEGER]) assert.ok(validCopper(good));
  for (const bad of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '12', undefined, null])
    assert.equal(validCopper(bad), false);
});
