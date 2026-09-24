import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import type { WorldQuery, Player } from '../src/model.ts';
import { generateItem } from '../src/items.ts';
import type { Item } from '../src/character-types.ts';
import {
  ARMOR_SLOTS, DURABLE_SLOTS, DURABILITY_RULES, STRIKE_SLOTS,
  durabilityBadgeMarkup, durabilityFactor, durabilityLoss, durabilityMetaMarkup, durabilityOf,
  durabilityStatus, planRepair, repairCost, repairProblem, repairQuote,
} from '../src/durability.ts';
import { GAME_FEATURES } from '../src/game-features.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const sim = () => new Simulation(world, { spawn: false });

test('durabilityOf reports max for untracked durable slots and undefined for jewelry', () => {
  const p = sim().player;
  for (const slot of DURABLE_SLOTS) assert.equal(durabilityOf(p, slot), DURABILITY_RULES.max);
  for (const slot of ['ring1', 'cloak', 'amulet'] as const) assert.equal(durabilityOf(p, slot), undefined);
  p.durability = { weapon: 47, chest: -5, head: 999 };
  assert.equal(durabilityOf(p, 'weapon'), 47);
  assert.equal(durabilityOf(p, 'chest'), 0, 'stored values clamp into 0..max');
  assert.equal(durabilityOf(p, 'head'), DURABILITY_RULES.max);
});

test('durabilityFactor suppresses stats only at zero on durable slots', () => {
  assert.equal(durabilityFactor(undefined, 'weapon'), 1);
  assert.equal(durabilityFactor({ weapon: 0 }, 'weapon'), 0);
  assert.equal(durabilityFactor({ weapon: .5 }, 'weapon'), 1);
  assert.equal(durabilityFactor({ ring1: 0 }, 'ring1'), 1, 'rings never break');
});

// durabilityLoss only writes slots that hold an item — fill every durable slot
// with a real generated item (stubs miss fields refreshCharacter reads).
const equipAll = (p: Player, slots: readonly string[]) => {
  for (const slot of slots) (p.character.equipped as Record<string, Item>)[slot] ??=
    generateItem(1000 + slots.indexOf(slot), 10, slot === 'offhand' ? 'shield' : slot as Item['kind'], undefined, 'common');
};

test('death wears every durable slot by 10% and reports freshly broken items', () => {
  const p = sim().player;
  equipAll(p, DURABLE_SLOTS);
  const broken = durabilityLoss(p, 'death');
  assert.deepEqual(broken, []);
  for (const slot of DURABLE_SLOTS) assert.equal(p.durability![slot], DURABILITY_RULES.max - DURABILITY_RULES.deathLoss);
  // Drive the weapon to zero: the loss reports it broken exactly once.
  p.durability = { weapon: 5 };
  const broke = durabilityLoss(p, 'death');
  assert.equal(broke.length, 1);
  assert.equal(broke[0].slot, 'weapon');
  assert.equal(broke[0].item, p.character.equipped.weapon);
  assert.equal(p.durability.weapon, 0);
  assert.deepEqual(durabilityLoss(p, 'death').filter(b => b.slot === 'weapon'), [], 'already-broken items do not re-break');
});

test('hit-taken wears armor slots and strike wears only the hands', () => {
  const p = sim().player;
  equipAll(p, DURABLE_SLOTS);
  durabilityLoss(p, 'hit-taken');
  for (const slot of ARMOR_SLOTS) assert.equal(p.durability![slot], DURABILITY_RULES.max - DURABILITY_RULES.hitTakenLoss);
  assert.equal(p.durability!.weapon, undefined, 'the main hand does not wear on defense');
  const q = sim().player;
  equipAll(q, STRIKE_SLOTS);
  durabilityLoss(q, 'strike');
  for (const slot of STRIKE_SLOTS) assert.equal(q.durability![slot], DURABILITY_RULES.max - DURABILITY_RULES.strikeLoss);
  assert.equal(q.durability!.chest, undefined, 'armor does not wear on offense');
});

test('durabilityLoss respects the feature flag and empty slots', () => {
  const p = sim().player;
  p.character.equipped.head = null;
  durabilityLoss(p, 'death');
  assert.equal(p.durability!.head, undefined, 'empty slots are skipped');
  GAME_FEATURES.durability = false;
  try {
    const q = sim().player;
    assert.deepEqual(durabilityLoss(q, 'death'), []);
    assert.equal(q.durability, undefined);
  } finally { GAME_FEATURES.durability = true; }
});

test('repairCost scales with missing durability and item level', () => {
  const p = sim().player;
  const item = p.character.equipped.chest!;
  assert.equal(repairCost(item, DURABILITY_RULES.max), 1, 'no damage still costs the minimum');
  const half = repairCost(item, 50), full = repairCost(item, 0);
  assert.ok(full > half && half >= 1, 'more missing durability costs more');
  assert.equal(repairCost(item, -50), full, 'out-of-range input clamps');
});

test('repairQuote lists damaged equipped slots and fails when nothing is worn', () => {
  const p = sim().player;
  assert.equal(repairQuote(p).ok, false);
  p.durability = { weapon: 80, chest: 30 };
  const quote = repairQuote(p);
  assert.ok(quote.ok);
  assert.deepEqual(quote.slots.sort(), ['chest', 'weapon']);
  assert.ok(quote.cost >= 1);
  const single = repairQuote(p, 'chest');
  assert.ok(single.ok && single.slots.length === 1 && single.slots[0] === 'chest');
  assert.equal(repairQuote(p, 'legs').ok, false, 'an undamaged slot needs no repair');
  assert.equal(repairQuote(p, 'ring1').ok, false, 'rings carry no durability');
});

test('planRepair spends gold on a clone and restores only the quoted slots', () => {
  const p = sim().player;
  p.character.gold = 100_000;
  p.durability = { weapon: 10, chest: 60 };
  const plan = planRepair(p);
  assert.ok(plan.ok);
  assert.equal(plan.durability.weapon, DURABILITY_RULES.max);
  assert.equal(plan.durability.chest, DURABILITY_RULES.max);
  assert.equal(plan.character.gold, 100_000 - plan.cost);
  assert.equal(p.character.gold, 100_000, 'the live sheet is untouched until commit');
  assert.equal(p.durability.weapon, 10);
  // Broke: the plan fails without spending.
  p.character.gold = 0;
  const denied = planRepair(p);
  assert.equal(denied.ok, false);
  assert.equal(p.character.gold, 0);
});

test('repairProblem gates on the blacksmith role', () => {
  assert.equal(repairProblem({ role: 'blacksmith' }), null);
  assert.ok(repairProblem({ role: 'jeweler' }));
  assert.ok(repairProblem(null));
  GAME_FEATURES.durability = false;
  try { assert.ok(repairProblem({ role: 'blacksmith' })); }
  finally { GAME_FEATURES.durability = true; }
});

test('durabilityStatus separates broken pieces from the warn band', () => {
  const p = sim().player;
  p.durability = { weapon: 0, chest: DURABILITY_RULES.warnBelow - 1, head: DURABILITY_RULES.warnBelow, legs: 90 };
  const { broken, worn } = durabilityStatus(p);
  assert.deepEqual(broken.map(b => b.slot), ['weapon']);
  assert.deepEqual(worn.map(b => b.slot), ['chest'], 'at-threshold is not a warning');
});

test('durability markup flags broken red, worn amber and hides healthy gear', () => {
  assert.match(durabilityMetaMarkup(0), /broken — stats suppressed/);
  assert.match(durabilityMetaMarkup(73), /Durability 73 \/ 100/);
  assert.match(durabilityMetaMarkup(24), /#e0b56a/, 'under the warn threshold renders amber');
  assert.equal(durabilityBadgeMarkup(undefined), '');
  assert.equal(durabilityBadgeMarkup(DURABILITY_RULES.warnBelow), '');
  assert.match(durabilityBadgeMarkup(0)!, /✕/);
  assert.match(durabilityBadgeMarkup(12)!, />12</);
});
