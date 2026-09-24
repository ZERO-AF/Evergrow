import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEM_SETS, SET_PIECE_MIN_LEVEL, SET_PIECE_PREFIX, itemSet, setPiece, setPieceOf, setPiecesFor,
} from '../src/item-set-content.ts';
import {
  activeSetBonuses, equippedSetPieces, setPieceCount, setStatusLines, setTooltipModel,
} from '../src/item-set-state.ts';
import { setBonusSources, setBonusStats } from '../src/item-set-bonus.ts';
import type { Item } from '../src/character-types.ts';

const dreadnaught = itemSet('dreadnaught')!;
const pieceItem = (pieceId: string, seed = 7): Item =>
  ({ id: `${SET_PIECE_PREFIX}${pieceId}:${seed.toString(36)}`, name: setPiece(pieceId)!.name, kind: setPiece(pieceId)!.kind }) as Item;
const namedPiece = (pieceId: string): Item =>
  ({ id: `stamped-${pieceId}`, name: setPiece(pieceId)!.name, kind: setPiece(pieceId)!.kind }) as Item;
const plainItem = (kind: Item['kind'] = 'chest'): Item => ({ id: 'plain-1', name: 'Plain Mail', kind }) as Item;

test('setPieceOf resolves encoded ids and authored names, rejecting lookalikes', () => {
  const piece = dreadnaught.pieces[0];
  assert.equal(setPieceOf(pieceItem(piece.id)), piece);
  assert.equal(setPieceOf(namedPiece(piece.id)), piece, 'stamped ids still resolve by name+kind');
  assert.equal(setPieceOf({ id: 'x', name: piece.name, kind: 'boots' } as Item), undefined, 'name alone is not enough');
  assert.equal(setPieceOf({ id: `${SET_PIECE_PREFIX}bogus:1`, name: 'x', kind: 'head' } as Item), undefined);
  assert.equal(setPieceOf(plainItem()), undefined);
  assert.equal(setPieceOf(null), undefined);
});

test('equippedSetPieces groups worn pieces per set in authored order', () => {
  const equipped = {
    head: pieceItem('dreadnaught-head'), chest: pieceItem('dreadnaught-chest'),
    gloves: pieceItem('frostfire-gloves'), ring1: plainItem('ring'), weapon: null,
  };
  const groups = equippedSetPieces(equipped);
  assert.equal(groups.size, 2);
  assert.deepEqual(groups.get(dreadnaught)!.map(p => p.id), ['dreadnaught-head', 'dreadnaught-chest']);
  assert.equal(groups.get(itemSet('frostfire')!)!.length, 1);
  // Authored order wins over slot iteration order.
  const reversed = { chest: pieceItem('dreadnaught-chest'), head: pieceItem('dreadnaught-head') };
  assert.deepEqual(equippedSetPieces(reversed).get(dreadnaught)!.map(p => p.id), ['dreadnaught-head', 'dreadnaught-chest']);
});

test('bonus tiers activate at their piece thresholds and broken pieces stop counting', () => {
  const wear = (...ids: string[]) => Object.fromEntries(ids.map(id => [setPiece(id)!.kind, pieceItem(id)]));
  assert.equal(setPieceCount(wear('dreadnaught-head'), dreadnaught), 1);
  assert.equal(activeSetBonuses(wear('dreadnaught-head'), dreadnaught).length, 0);
  const two = wear('dreadnaught-head', 'dreadnaught-chest');
  assert.deepEqual(activeSetBonuses(two, dreadnaught).map(b => b.pieces), [2]);
  const four = wear('dreadnaught-head', 'dreadnaught-chest', 'dreadnaught-gloves', 'dreadnaught-legs');
  assert.deepEqual(activeSetBonuses(four, dreadnaught).map(b => b.pieces), [2, 3, 4]);
  // A broken (0 durability) piece drops the set back below its thresholds.
  const durability = { legs: 0 };
  assert.equal(setPieceCount(four, dreadnaught, durability), 3);
  assert.deepEqual(activeSetBonuses(four, dreadnaught, durability).map(b => b.pieces), [2, 3]);
  // Non-durable slots (rings) never wear, so a 0 there is ignored.
  assert.equal(setPieceCount({ ...two, ring1: plainItem('ring') }, dreadnaught, { ring1: 0 }), 2);
});

test('setBonusStats merges every active tier and labels each source', () => {
  const equipped = {
    head: pieceItem('dreadnaught-head'), chest: pieceItem('dreadnaught-chest'),
    gloves: pieceItem('dreadnaught-gloves'), legs: pieceItem('dreadnaught-legs'),
  };
  const stats = setBonusStats(equipped);
  assert.equal(stats.damagePercent, 6);
  assert.equal(stats.strength, 15);
  assert.equal(stats.critDamage, 12);
  assert.equal(stats['skill:mortalStrike'], 2);
  const sources = setBonusSources(equipped);
  assert.deepEqual(sources.map(s => s.label),
    ["Heroes' Dreadnaught Battlegear (2) Set", "Heroes' Dreadnaught Battlegear (3) Set", "Heroes' Dreadnaught Battlegear (4) Set"]);
  assert.deepEqual(setBonusStats({}), {});
  assert.deepEqual(setBonusSources({}), []);
});

test('setTooltipModel lists the full checklist with worn and active flags', () => {
  const equipped = { head: pieceItem('dreadnaught-head'), chest: pieceItem('dreadnaught-chest') };
  const model = setTooltipModel(pieceItem('dreadnaught-head'), equipped)!;
  assert.equal(model.set, dreadnaught);
  assert.equal(model.count, 2);
  assert.equal(model.pieces.length, dreadnaught.pieces.length);
  assert.deepEqual(model.pieces.map(p => p.have), [true, true, false, false, false]);
  assert.deepEqual(model.bonuses.map(b => b.active), [true, false, false]);
  assert.equal(setTooltipModel(plainItem(), equipped), null);
  const lines = setStatusLines(equipped);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Heroes' Dreadnaught Battlegear \(2\/5\) — \(2\) Set active/);
});

test('setPiecesFor is deterministic, level-gated and kind-matched', () => {
  assert.equal(setPiecesFor('head', 12345, { level: SET_PIECE_MIN_LEVEL - 1 }), null, 'below the endgame floor nothing drops');
  for (const seed of [1, 42, 987654])
    assert.equal(setPiecesFor('head', seed, { level: 80, encounter: 'bossChest' }),
      setPiecesFor('head', seed, { level: 80, encounter: 'bossChest' }), 'same seed same piece');
  // Boss chests roll a piece probabilistically (SET_PIECE_DROP.bossChest); when one
  // drops it is always the requested kind and belongs to a real set.
  let dropped = 0;
  for (let seed = 0; seed < 40; seed++) {
    const piece = setPiecesFor('head', seed * 7919, { level: 80, encounter: 'bossChest' });
    if (!piece) continue;
    dropped++;
    assert.equal(piece.kind, 'head');
    assert.ok(ITEM_SETS.some(set => set.pieces.includes(piece)));
  }
  assert.ok(dropped > 0, 'boss chests drop at least one piece across 40 seeds');
  assert.ok(dropped < 40, 'boss chest drop is probabilistic, not guaranteed');
});

test('every set piece id is unique and its set lookup round-trips', () => {
  const ids = ITEM_SETS.flatMap(set => set.pieces.map(p => p.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const set of ITEM_SETS) {
    assert.ok(set.pieces.length >= 4);
    for (const tier of set.bonuses) assert.ok(tier.pieces >= 2 && tier.pieces <= set.pieces.length);
    for (const piece of set.pieces) assert.equal(itemSet(set.id)!.pieces.includes(piece), true);
  }
});
