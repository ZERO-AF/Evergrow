import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../src/audio.ts';
import { CombatEffects } from '../src/effects.ts';
import { Simulation } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { lootMapMarkers, drawLootMapMarkers } from '../src/minimap-zone.ts';
import { NotificationQueue } from '../src/notification-queue.ts';
import { GAME_FEATURES } from '../src/game-features.ts';
import type { WorldQuery } from '../src/model.ts';
import type { ItemTier } from '../src/character-types.ts';

const emptyWorld: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const item = (seed: number, tier: ItemTier) => generateItem(seed, 8, 'ring', undefined, tier);

const stubAudio = () => {
  const audio = new GameAudio();
  const tones: number[][] = [], noises: unknown[] = [];
  const internals = audio as unknown as { ctx: { currentTime: number; state: string }; bus: object; tone(...args: number[]): void; hiss(...args: unknown[]): void };
  internals.ctx = { currentTime: 1, state: 'running' }; internals.bus = {};
  internals.tone = (...args) => { tones.push(args); }; internals.hiss = (...args) => { noises.push(args); };
  return { audio, tones, noises, internals };
};

test('legendary and epic loot events play a distinct high-priority stinger; common keeps the blip', () => {
  const { audio, tones, noises, internals } = stubAudio();
  audio.play({ type: 'loot', item: item(11, 'legendary'), x: 0, y: 0 });
  assert.ok(tones.length >= 5, 'legendary stinger is a layered phrase');
  assert.ok(tones.every(t => t[4] >= 3), 'stinger voices outrank routine pickups');
  assert.ok(tones.some(t => t[0] === 196 && t[1] === 98), 'deep chime opens the legendary stinger');
  assert.ok(noises.length >= 1, 'rising shimmer layer present');
  const legendaryVoices = tones.length;

  tones.length = 0; noises.length = 0; internals.ctx.currentTime += 1;
  audio.play({ type: 'loot', item: item(12, 'epic'), x: 0, y: 0 });
  assert.ok(tones.length >= 2 && tones.length < legendaryVoices, 'epic gets a lighter phrase');
  assert.ok(tones.every(t => t[4] === 3));

  tones.length = 0; noises.length = 0; internals.ctx.currentTime += 1;
  audio.play({ type: 'loot', item: item(13, 'common'), x: 0, y: 0 });
  assert.equal(tones.length, 2);
  assert.ok(tones.every(t => t[4] === 0), 'common loot keeps the generic low-priority blip');
  assert.equal(noises.length, 0);
});

test('the drop stinger is rate-limited so a vacuumed drop does not sound twice', () => {
  const { audio, tones, internals } = stubAudio();
  audio.lootMoment('legendary');
  const first = tones.length;
  assert.ok(first > 0);
  audio.lootMoment('legendary');
  assert.equal(tones.length, first, 'second stinger inside the cooldown is suppressed');
  internals.ctx.currentTime += .6;
  audio.lootMoment('legendary');
  assert.ok(tones.length > first, 'stinger returns after the cooldown');
  tones.length = 0;
  audio.lootMoment('rare');
  assert.equal(tones.length, 0, 'rare and below never trigger the stinger');
});

test('the legendaryMoment flag silences the stinger entirely', () => {
  const { audio, tones } = stubAudio();
  GAME_FEATURES.legendaryMoment = false;
  try {
    audio.lootMoment('legendary');
    audio.play({ type: 'loot', item: item(14, 'legendary'), x: 0, y: 0 });
    assert.equal(tones.length, 2, 'flag off falls back to the generic loot blip');
  } finally {
    GAME_FEATURES.legendaryMoment = true;
  }
});

test('a fresh epic+ landing surfaces one loot moment; common drops and restored loot do not', () => {
  const effects = new CombatEffects();
  const sim = new Simulation(emptyWorld, { spawn: false });
  // Restored ground loot present on the first update is primed as scenery.
  sim.groundItems.push({ id: 1, x: 0, y: 0, item: item(21, 'legendary') });
  effects.update(sim, .016);
  assert.equal(effects.drainLootMoments().length, 0, 'pre-existing drops are not moments');
  assert.equal(effects.lootPulse, 0);

  sim.groundItems.push({ id: 2, x: 10, y: 20, item: item(22, 'legendary') });
  sim.groundItems.push({ id: 3, x: 12, y: 20, item: item(23, 'epic') });
  sim.groundItems.push({ id: 4, x: 14, y: 20, item: item(24, 'common') });
  effects.update(sim, .016);
  const moments = effects.drainLootMoments();
  assert.deepEqual(moments.map(m => m.id), [2, 3], 'epic+ drops surface exactly once, in order');
  assert.equal(moments[0].tier, 'legendary');
  assert.equal(effects.drainLootMoments().length, 0, 'drain consumes the queue');
  assert.ok(effects.lootPulse > 0, 'legendary landing kicks the screen-edge pulse');
  const pulse = effects.lootPulse;
  effects.update(sim, .016);
  assert.ok(effects.lootPulse < pulse, 'the pulse decays');
  effects.update(sim, .016);
  assert.equal(effects.drainLootMoments().length, 0, 'seen drops never re-fire');
});

test('epic drops surface a moment without the legendary screen pulse', () => {
  const effects = new CombatEffects();
  const sim = new Simulation(emptyWorld, { spawn: false });
  effects.update(sim, .016);
  sim.groundItems.push({ id: 5, x: 0, y: 0, item: item(25, 'epic') });
  effects.update(sim, .016);
  assert.equal(effects.drainLootMoments().length, 1);
  assert.equal(effects.lootPulse, 0);
});

test('only epic-and-up ground drops earn a map star, drawn inside the viewport', () => {
  const drops = [
    { id: 1, x: 0, y: 0, item: item(31, 'legendary') },
    { id: 2, x: 40, y: 0, item: item(32, 'epic') },
    { id: 3, x: 80, y: 0, item: item(33, 'rare') },
    { id: 4, x: 120, y: 0, item: item(34, 'common') },
  ];
  const marked = lootMapMarkers(drops);
  assert.deepEqual(marked.map(d => d.id), [1, 2]);

  let fills = 0;
  const ctx = {
    save() {}, restore() {}, translate() {}, beginPath() {}, arc() {},
    moveTo() {}, lineTo() {}, closePath() {}, clip() {},
    fill() { fills++; }, stroke() {},
    fillStyle: '', strokeStyle: '', lineWidth: 0, lineJoin: '',
  } as unknown as CanvasRenderingContext2D;
  const view = { x: 0, y: 0, width: 100, height: 100, centerX: 0, centerY: 0, zoom: 1 };
  drawLootMapMarkers(ctx, view, marked);
  assert.ok(fills >= 2, 'each in-view marker fills a star');
  const before = fills;
  drawLootMapMarkers(ctx, view, [{ id: 9, x: 99999, y: 99999, item: item(35, 'legendary') }]);
  assert.equal(fills, before, 'off-viewport drops are skipped');
});

test('a dropped loot notice keeps its flag through the feed queue', () => {
  const queue = new NotificationQueue(2);
  const legendary = item(41, 'legendary');
  queue.push({ kind: 'loot', item: legendary, dropped: true });
  const entry = queue.visible[0];
  assert.equal(entry.notice.kind, 'loot');
  assert.equal(entry.notice.dropped, true);
  assert.equal(entry.notice.item.name, legendary.name);
});
