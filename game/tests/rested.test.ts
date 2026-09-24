import test from 'node:test';
import assert from 'node:assert/strict';
import { RESTED_RULES, restedAccrual, restedBonus, restedCap, restedDisplay } from '../src/rested.ts';
import { xpForNextLevel } from '../src/progression.ts';
import { MAX_PLAYER_LEVEL } from '../src/progression-content.ts';
import type { Player, WorldQuery } from '../src/model.ts';

const sanctuary: WorldQuery = {
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
  isSanctuary: () => true,
};
const wilderness: WorldQuery = { ...sanctuary, isSanctuary: () => false };
const player = (level = 10, restedXp = 0): Player =>
  ({ level, xp: 0, restedXp, dead: false, x: 0, y: 0 }) as unknown as Player;

test('restedCap is 1.5 times the current level threshold', () => {
  for (const level of [1, 10, 40, MAX_PLAYER_LEVEL - 1])
    assert.equal(restedCap(player(level)), xpForNextLevel(level) * RESTED_RULES.capLevels);
});

test('restedAccrual banks XP only inside a sanctuary and only while alive below the cap', () => {
  const p = player(10);
  assert.equal(restedAccrual(p, wilderness, 60), 0, 'no accrual outside a settlement');
  assert.equal(p.restedXp, 0);
  const gained = restedAccrual(p, sanctuary, 60);
  assert.ok(gained > 0);
  assert.equal(p.restedXp, gained);
  p.dead = true;
  assert.equal(restedAccrual(p, sanctuary, 60), 0, 'the dead do not rest');
  p.dead = false;
  assert.equal(restedAccrual(p, sanctuary, 0), 0);
  assert.equal(restedAccrual(p, sanctuary, -5), 0);
  assert.equal(restedAccrual(player(MAX_PLAYER_LEVEL), sanctuary, 60), 0, 'max level banks nothing');
});

test('restedAccrual stops at the 1.5-level cap', () => {
  const p = player(10);
  const cap = restedCap(p);
  restedAccrual(p, sanctuary, 1e9);
  assert.equal(p.restedXp, cap);
  assert.equal(restedAccrual(p, sanctuary, 60), 0, 'a full pool gains nothing');
  // One level of pool accrues in ~8 hours of settlement time.
  const fresh = player(10);
  restedAccrual(fresh, sanctuary, 1 / RESTED_RULES.levelsPerSecond);
  assert.ok(Math.abs(fresh.restedXp! - xpForNextLevel(10)) < 1e-6);
});

test('restedBonus doubles kill XP up to the pool and drains it', () => {
  const p = player(10, 100);
  assert.equal(restedBonus(p, 60), 60);
  assert.equal(p.restedXp, 40);
  assert.equal(restedBonus(p, 80), 40, 'bonus is capped by the remaining pool');
  assert.equal(p.restedXp, 0);
  assert.equal(restedBonus(p, 80), 0, 'an empty pool pays nothing');
});

test('restedBonus rejects invalid rewards and ineligible players', () => {
  const p = player(10, 100);
  for (const bad of [0, -10, NaN, Infinity]) {
    assert.equal(restedBonus(p, bad), 0);
    assert.equal(p.restedXp, 100);
  }
  p.dead = true;
  assert.equal(restedBonus(p, 50), 0);
  p.dead = false;
  assert.equal(restedBonus(player(MAX_PLAYER_LEVEL, 100), 50), 0);
});

test('restedDisplay reports the pool and the rail reach clamped to the level', () => {
  const needed = xpForNextLevel(10);
  assert.deepEqual(restedDisplay({ level: 10, xp: 0, restedXp: needed / 2 }), { fill: .5, xp: needed / 2 });
  assert.deepEqual(restedDisplay({ level: 10, xp: needed * .75, restedXp: needed }), { fill: 1, xp: needed });
  assert.deepEqual(restedDisplay({ level: 10, xp: 0, restedXp: 0 }), { fill: 0, xp: 0 });
  assert.deepEqual(restedDisplay({ level: 10, xp: -5, restedXp: -20 }), { fill: 0, xp: 0 }, 'negative values clamp to zero');
});
