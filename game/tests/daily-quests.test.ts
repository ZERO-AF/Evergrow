import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS, QUEST_BY_ID, giverSpec } from '../src/quest-content.ts';
import {
  applyExplore, applyKill, availableDailies, dailyResetKey, dailyResettable,
  questState, resetDailies, stageAccept, stageTurnIn,
} from '../src/quest-state.ts';
import { questAccept, questOnKill, questsAtGiver, questTurnIn } from '../src/quest-command.ts';
import { factionForQuest } from '../src/reputation-state.ts';
import { GAME_FEATURES } from '../src/game-features.ts';
import { createWowSim } from './fixtures/wow-sim.ts';

const DAY = 86400000;
/** A fixed instant mid-day UTC so day arithmetic never straddles a boundary. */
const NOW = Date.UTC(2026, 8, 22, 15);
const persist = async () => ({ ok: true, message: '' });

function simAt80() {
  const sim = createWowSim();
  sim.player.level = 80;
  return sim;
}

test('twelve WotLK dailies are authored with xp, gold and a reputation faction', () => {
  const dailies = QUESTS.filter(def => def.daily);
  assert.ok(dailies.length >= 12, `expected ~12 dailies, found ${dailies.length}`);
  for (const def of dailies) {
    assert.ok(def.rewards.xp > 0, `${def.id}: xp`);
    assert.ok(def.rewards.gold > 0, `${def.id}: gold`);
    assert.ok(factionForQuest(def), `${def.id}: no faction claims the turn-in`);
    assert.ok(def.zone, `${def.id}: zone`);
  }
});

test('dailyResetKey counts UTC days', () => {
  assert.equal(dailyResetKey(0), 0);
  assert.equal(dailyResetKey(DAY - 1), 0);
  assert.equal(dailyResetKey(DAY), 1);
  assert.equal(dailyResetKey(NOW), dailyResetKey(NOW + 8 * 3600000));
  assert.equal(dailyResetKey(NOW + DAY), dailyResetKey(NOW) + 1);
});

test('a daily completes, turns in, and re-offers the next UTC day with cleared progress', () => {
  const sim = simAt80();
  const player = sim.player;
  const def = QUEST_BY_ID['planning-for-the-future'];
  assert.ok(def.daily);

  stageAccept(player, def);
  for (let i = 0; i < 12; i++) applyKill(player, 'stalker', () => 0);
  assert.equal(questState(player, def.id)!.status, 'complete');

  stageTurnIn(player, def.id, NOW);
  const receipt = questState(player, def.id)!;
  assert.equal(receipt.status, 'turnedIn');
  assert.equal(receipt.lastCompletedAt, Math.floor(NOW / 1000));

  // Same UTC day: still turned in, not offerable.
  assert.equal(dailyResettable(receipt, NOW + 3600000), false);
  assert.ok(!availableDailies(player, NOW).some(d => d.id === def.id));

  // Next UTC day: the receipt is stale, the sweep clears it, the quest re-offers.
  assert.equal(dailyResettable(receipt, NOW + DAY), true);
  assert.deepEqual(resetDailies(player, NOW + DAY).map(d => d.id), [def.id]);
  assert.equal(questState(player, def.id), undefined);
  assert.ok(availableDailies(player, NOW + DAY).some(d => d.id === def.id));

  // Re-accepting starts a fresh ledger entry.
  stageAccept(player, def);
  assert.deepEqual(questState(player, def.id)!.progress, def.objectives.map(() => 0));
});

test('explore dailies clear the visited dedupe list on reset', () => {
  const sim = simAt80();
  const player = sim.player;
  const def = QUEST_BY_ID['a-cleansing-song'];
  stageAccept(player, def);
  for (const id of ['grove-a', 'grove-b', 'grove-c']) applyExplore(player, { id, kind: 'corruptedGrove' });
  const state = questState(player, def.id)!;
  assert.equal(state.status, 'complete');
  assert.equal(state.visited!.length, 3);

  stageTurnIn(player, def.id, NOW);
  resetDailies(player, NOW + DAY);
  stageAccept(player, def);
  const fresh = questState(player, def.id)!;
  assert.equal(fresh.status, 'active');
  assert.equal(fresh.visited, undefined);
  assert.deepEqual(fresh.progress, [0]);
});

test('non-daily quests are untouched by the daily sweep', () => {
  const sim = simAt80();
  const player = sim.player;
  const def = QUEST_BY_ID['the-warsong-farms'];
  assert.ok(!def.daily);
  stageAccept(player, def);
  stageTurnIn(player, def.id, NOW);
  assert.deepEqual(resetDailies(player, NOW + DAY), []);
  const state = questState(player, def.id)!;
  assert.equal(state.status, 'turnedIn');
  assert.equal(state.lastCompletedAt, undefined);
  assert.ok(!availableDailies(player, NOW + DAY).some(d => d.id === def.id));
});

test('the reset sweep is idempotent within a day', () => {
  const sim = simAt80();
  const player = sim.player;
  const def = QUEST_BY_ID['hot-and-cold'];
  stageAccept(player, def);
  stageTurnIn(player, def.id, NOW);
  assert.equal(resetDailies(player, NOW + DAY).length, 1);
  assert.deepEqual(resetDailies(player, NOW + DAY), []);
  assert.deepEqual(resetDailies(player, NOW + DAY + 3600000), []);
});

test('turn-in stamps the day and the giver re-offers the daily the next UTC day', async () => {
  const sim = simAt80();
  const def = QUEST_BY_ID['troll-patrol'];
  const yesterday = Date.now() - DAY;

  assert.ok((await questAccept(sim, def.id, persist)).ok);
  for (let i = 0; i < 8; i++) questOnKill(sim, 'stalker', () => 0);
  for (let i = 0; i < 4; i++) questOnKill(sim, 'brute', () => 0);
  assert.equal(questState(sim.player, def.id)!.status, 'complete');

  const ti = await questTurnIn(sim, def.id, persist, yesterday);
  assert.ok(ti.ok);
  assert.equal(questState(sim.player, def.id)!.status, 'turnedIn');
  assert.equal(questState(sim.player, def.id)!.lastCompletedAt, Math.floor(yesterday / 1000));

  // Today the giver dialog sweeps the stale receipt and offers the daily again.
  const buckets = questsAtGiver(sim.player, giverSpec(def));
  assert.ok(buckets.offers.some(d => d.id === def.id));
  assert.equal(questState(sim.player, def.id), undefined);

  // The durable accept path re-accepts with cleared progress.
  assert.ok((await questAccept(sim, def.id, persist)).ok);
  assert.deepEqual(questState(sim.player, def.id)!.progress, [0, 0]);
});

test('a daily turned in today is not re-offered until the reset', async () => {
  const sim = simAt80();
  const def = QUEST_BY_ID['break-the-blockade'];
  assert.ok((await questAccept(sim, def.id, persist)).ok);
  for (let i = 0; i < 10; i++) questOnKill(sim, 'stalker', () => 0);
  assert.ok((await questTurnIn(sim, def.id, persist)).ok);
  const buckets = questsAtGiver(sim.player, giverSpec(def));
  assert.ok(!buckets.offers.some(d => d.id === def.id));
  const again = await questAccept(sim, def.id, persist);
  assert.equal(again.ok, false);
});

test('dailyQuests flag off leaves turned-in dailies permanent', () => {
  const sim = simAt80();
  const player = sim.player;
  const def = QUEST_BY_ID['pushed-too-far'];
  stageAccept(player, def);
  stageTurnIn(player, def.id, NOW);
  GAME_FEATURES.dailyQuests = false;
  try {
    assert.deepEqual(resetDailies(player, NOW + DAY), []);
    assert.equal(questState(player, def.id)!.status, 'turnedIn');
    assert.deepEqual(availableDailies(player, NOW + DAY), []);
  } finally {
    GAME_FEATURES.dailyQuests = true;
  }
});
