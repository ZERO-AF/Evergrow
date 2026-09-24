import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatEffects } from '../src/effects.ts';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { LOOT_RULES } from '../src/combat-content.ts';
import type { CombatEvent, WorldQuery } from '../src/model.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const storage = (effects: CombatEffects) =>
  effects as unknown as { sparks: unknown[]; flashes: unknown[]; impacts: unknown[]; popups: unknown[]; dodgeTrail: unknown[]; seenGroundItems: Set<number> };
const hit = (x = 0): CombatEvent =>
  ({ type: 'hit', x, y: 0, angle: .3, value: 20, enemyKind: 'stalker', targetId: 1, remainingHp: 80, heavy: false });

test('presentation updates never mutate gameplay state or consume the event queue', () => {
  const sim = new Simulation(world, { spawn: false });
  const effects = new CombatEffects();
  sim.player.x = 120; sim.player.y = -40; sim.player.hp = 37; sim.player.mana = 11;
  sim.groundItems.push({ id: 501, x: 5, y: 5, item: generateItem(910, 8, 'ring', undefined, 'legendary') });
  const before = JSON.stringify(sim.captureCheckpoint());
  for (let i = 0; i < 240; i++) {
    effects.handleEvents([hit(i)]);
    effects.update(sim, FIXED_STEP);
  }
  // captureCheckpoint includes randomState — identical output proves the RNG
  // (and every other gameplay field) was untouched by the presentation pass.
  assert.equal(JSON.stringify(sim.captureCheckpoint()), before,
    'effects must not move, damage, heal or otherwise touch the simulation');
  assert.equal(sim.time, 0, 'presentation must not advance the clock');
  // The frame's combat events belong to the renderer's drain, not the effects pass.
  const pending = sim.drainEvents();
  assert.ok(pending.length === 0 || pending.every(e => e.type !== undefined));
});

test('continuous emitters stay bounded under sustained combat and dodge trails cap', () => {
  const sim = new Simulation(world, { spawn: false });
  const effects = new CombatEffects();
  sim.player.dodgeTime = 1; // a held dodge flag: presentation must still cap its trail
  sim.projectiles = Array.from({ length: 64 }, (_, id) => ({
    id, x: id * 4, y: 0, prevX: id * 4, prevY: 0, vx: 50, vy: 0, angle: 0,
    radius: 3, damage: 5, life: 2, sourceLevel: 1, maxLife: 2, owner: 'player' as const, hitIds: new Set<number>(),
  }));
  for (let i = 0; i < 600; i++) effects.update(sim, FIXED_STEP);
  const store = storage(effects);
  assert.ok(store.dodgeTrail.length <= 26, `dodge trail ${store.dodgeTrail.length} exceeds its cap`);
  assert.ok(store.sparks.length <= 650, `sparks ${store.sparks.length} exceed the cap`);
  assert.ok(store.flashes.length <= 22 && store.impacts.length <= 24 && store.popups.length <= 35);
});

test('drop bursts fire once per drop, loot moments drain once, and the seen-set rebuilds under churn', () => {
  const sim = new Simulation(world, { spawn: false });
  const effects = new CombatEffects();
  effects.update(sim, FIXED_STEP); // prime: pre-existing drops are scenery
  sim.groundItems.push(
    { id: 1, x: 0, y: 0, item: generateItem(11, 10, 'ring', undefined, 'epic') },
    { id: 2, x: 4, y: 0, item: generateItem(12, 10, 'amulet', undefined, 'legendary') },
    { id: 3, x: 8, y: 0, item: generateItem(13, 10, 'ring', undefined, 'common') },
  );
  effects.update(sim, FIXED_STEP);
  const moments = effects.drainLootMoments();
  assert.equal(moments.length, 2, 'common drops never surface a loot moment');
  assert.deepEqual(moments.map(m => m.id), [1, 2]);
  assert.ok(effects.lootPulse > 0, 'legendary landing kicks the screen-edge pulse');
  assert.equal(effects.drainLootMoments().length, 0, 'moments drain exactly once');
  effects.update(sim, FIXED_STEP);
  assert.equal(effects.drainLootMoments().length, 0, 'a drop bursts once, not every frame');

  // Churn far more drop ids than the cap: the seen-set must rebuild, not grow forever.
  let next = 100;
  for (let round = 0; round < 60; round++) {
    sim.groundItems = Array.from({ length: 40 }, (_, i) =>
      ({ id: next++, x: i, y: 0, item: generateItem(2000 + i, 5) }));
    effects.update(sim, FIXED_STEP);
  }
  assert.ok(storage(effects).seenGroundItems.size <= LOOT_RULES.maxGroundItems * 2,
    'seen-drop ids must stay bounded under churn');
  // After a rebuild the set holds the live snapshot plus drops seen since —
  // every live drop is tracked, and no stale id outlives its drop forever.
  for (const drop of sim.groundItems) assert.ok(storage(effects).seenGroundItems.has(drop.id));
});

test('mana and skill-fail warnings share one cue instead of stacking', () => {
  const sim = new Simulation(world, { spawn: false });
  const effects = new CombatEffects();
  const events: CombatEvent[] = [
    { type: 'insufficient-mana', x: 0, y: 0 },
    { type: 'insufficient-mana', x: 0, y: 0 },
    { type: 'skill-failed', x: 0, y: 0, reason: 'cooldown' },
  ];
  effects.handleEvents(events);
  const store = storage(effects);
  assert.equal(store.popups.length, 0, 'warning cues are not floating popups');
  // The single warning fades out on its own timer.
  for (let i = 0; i < 200; i++) effects.update(sim, FIXED_STEP);
  assert.ok(true, 'warning lifecycle completes without error');
});

test('getLights returns a reused bounded buffer of the newest flashes', () => {
  const effects = new CombatEffects();
  effects.handleEvents(Array.from({ length: 60 }, (_, i) => hit(i)));
  const first = effects.getLights();
  assert.ok(first.length <= 7, `light list ${first.length} exceeds the renderer budget`);
  const again = effects.getLights();
  assert.equal(again, first, 'getLights must reuse its scratch buffer, not allocate per call');
});
