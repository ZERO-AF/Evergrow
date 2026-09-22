import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import type { WorldQuery } from '../src/model.ts';
import { TITLES, TITLE_BY_ID, isTitleId } from '../src/title-content.ts';
import { earnedTitles, equippedTitle, equipTitle, displayName } from '../src/title-state.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { WORLD_GENERATION_VERSION } from '../src/world.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const sim = () => new Simulation(world, { spawn: false });
/** Achievement completion sentinel (achievement-state.ts): any stamp >= 1e9. */
const DONE = 1_700_000_000;

test('registry: every title has a %s placeholder matching its format', () => {
  assert.ok(TITLES.length >= 25);
  for (const t of TITLES) {
    assert.ok(t.name.includes('%s'), t.id);
    assert.equal(t.format, t.name.startsWith('%s') || t.name.startsWith('%s,') ? 'suffix' : 'prefix', t.id);
    assert.equal(TITLE_BY_ID[t.id], t);
  }
  assert.ok(isTitleId('the-explorer'));
  assert.ok(!isTitleId('the-missing'));
});

test('earnedTitles derives from achievements, reputation, quests, level and rating', () => {
  const p = sim().player;
  assert.equal(earnedTitles(p).length, 0);
  p.achievements = { 'universal-explorer': DONE, 'pest-control': DONE };
  assert.deepEqual(earnedTitles(p).map(t => t.id), ['the-explorer', 'jenkins']);
  // Reputation: revered Timbermaw alone is not enough for the Diplomat.
  p.reputation = { timbermawHold: 21000 };
  assert.ok(!earnedTitles(p).some(t => t.id === 'the-diplomat'));
  p.reputation = { timbermawHold: 21000, cenarionCircle: 21000, thoriumBrotherhood: 21000 };
  assert.ok(earnedTitles(p).some(t => t.id === 'the-diplomat'));
  // Quest turn-in receipt.
  p.quests = { 'keepers-of-the-glade': { status: 'turnedIn', progress: [] } };
  assert.ok(earnedTitles(p).some(t => t.id === 'the-noble'));
  // Arena rating rides the sheet.
  p.character.arenaRating = 2000;
  assert.ok(earnedTitles(p).some(t => t.id === 'arena-master'));
});

test('faction-gated titles only qualify for their own faction', () => {
  const alliance = sim().player; // human → alliance
  alliance.achievements = { 'honorable-kills': DONE };
  alliance.reputation = { stormwind: 42999, warsong: 42999 };
  const ids = earnedTitles(alliance).map(t => t.id);
  assert.ok(ids.includes('of-the-alliance') && ids.includes('the-stormpike'));
  assert.ok(!ids.includes('of-the-horde') && !ids.includes('the-frostwolf'));
  const horde = sim().player;
  horde.character.raceId = 'orc';
  horde.achievements = { 'honorable-kills': DONE };
  horde.reputation = { stormwind: 42999, warsong: 42999 };
  const hordeIds = earnedTitles(horde).map(t => t.id);
  assert.ok(hordeIds.includes('of-the-horde') && hordeIds.includes('the-frostwolf'));
  assert.ok(!hordeIds.includes('of-the-alliance') && !hordeIds.includes('the-stormpike'));
});

test('equipTitle rejects unearned and unknown titles, equips earned, clears on null', () => {
  const p = sim().player;
  assert.equal(equipTitle(p, 'the-explorer').ok, false);
  assert.equal(equipTitle(p, 'not-a-title').ok, false);
  assert.equal(p.character.title, undefined);
  p.achievements = { 'universal-explorer': DONE };
  const result = equipTitle(p, 'the-explorer');
  assert.ok(result.ok);
  assert.equal(p.character.title, 'the-explorer');
  assert.equal(equippedTitle(p)!.id, 'the-explorer');
  assert.ok(equipTitle(p, null).ok);
  assert.equal(p.character.title, undefined);
  assert.equal(equippedTitle(p), undefined);
});

test('equipTitle flows through the durable character command path', () => {
  const p = sim().player;
  p.achievements = { 'pest-control': DONE };
  assert.equal(executeCharacterCommand(p, { type: 'equipTitle', id: 'jenkins' }).ok, true);
  assert.equal(p.character.title, 'jenkins');
  assert.equal(executeCharacterCommand(p, { type: 'equipTitle', id: 'the-exalted' }).ok, false);
  assert.equal(p.character.title, 'jenkins');
  assert.equal(executeCharacterCommand(p, { type: 'equipTitle', id: null }).ok, true);
  assert.equal(p.character.title, undefined);
});

test('displayName formats prefix and suffix titles around the name', () => {
  const p = sim().player;
  p.name = 'Rowan';
  assert.equal(displayName(p), 'Rowan');
  p.character.title = 'the-explorer';
  assert.equal(displayName(p), 'Rowan the Explorer');
  p.character.title = 'jenkins';
  assert.equal(displayName(p), 'Jenkins Rowan');
  p.character.title = 'champion-of-the-frozen-wastes';
  assert.equal(displayName(p), 'Rowan, Champion of the Frozen Wastes');
  p.character.title = 'gone';
  assert.equal(displayName(p), 'Rowan'); // unknown ids fall back to the bare name
  p.character.title = undefined;
  p.name = undefined;
  assert.equal(displayName(p), 'Wayfarer');
});

test('character save accepts a known title and rejects an unknown one', () => {
  const p = sim().player;
  const save = () => decodeCharacterSave(JSON.stringify({
    version: 4, id: 'titles', name: 'Rowan', worldSeed: 7319, worldVersion: WORLD_GENERATION_VERSION,
    createdAt: 1, updatedAt: 2, checkpoint: { ...sim().captureCheckpoint(), character: p.character },
  }));
  assert.ok(save());
  p.character.title = 'the-explorer';
  const record = save();
  assert.ok(record);
  assert.equal(record!.checkpoint.character.title, 'the-explorer');
  p.character.title = 'the-missing';
  assert.equal(save(), null);
  p.character.title = 42 as unknown as string;
  assert.equal(save(), null);
});
