import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { CombatEffects } from '../src/effects.ts';
import { GAME_FEATURES } from '../src/game-features.ts';
import { Renderer } from '../src/renderer.ts';
import { CameraShake } from '../src/camera.ts';
import type { CombatEvent } from '../src/model.ts';

const hit = (value: number, heavy: boolean): CombatEvent =>
  ({ type: 'hit', x: 0, y: 0, angle: .4, value, targetId: 7, remainingHp: 50, enemyKind: 'stalker', heavy });
const kill: CombatEvent = { type: 'kill', x: 0, y: 0, angle: .4, facing: 0, targetId: 7, remainingHp: 0, enemyKind: 'stalker' };
const hurt = (value: number): CombatEvent =>
  ({ type: 'hurt', x: 0, y: 0, angle: 1.2, value, remainingHp: 40, heavy: value >= 20 });

type Popup = { size: number; color: string; life: number; value: string };
const popups = (effects: CombatEffects) => {
  // Test seam for private storage, same pattern as effects.test.ts.
  const storage = effects as unknown as { popups: Popup[] };
  return storage.popups;
};

/** Renderer construction needs only a canvas factory; no drawing happens here. */
function rendererFixture(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ width: 0, height: 0,
      getContext: () => ({ imageSmoothingEnabled: true }),
      addEventListener() {}, removeEventListener() {} }),
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  return new Renderer();
}

test('combatJuice off produces no shake or hit-stop state from any combat event', t => {
  const original = GAME_FEATURES.combatJuice;
  GAME_FEATURES.combatJuice = false;
  try {
    const renderer = rendererFixture(t);
    renderer.handleEvents([hit(30, true), hit(12, false), kill, hurt(45), hurt(8)], false);
    assert.equal(renderer.shake, 0);
    assert.equal(renderer.hitStop, 0);
  } finally { GAME_FEATURES.combatJuice = original; }
});

test('reduced motion suppresses shake and hit-stop even with juice enabled', t => {
  const renderer = rendererFixture(t);
  renderer.handleEvents([hit(30, true), kill, hurt(45)], true);
  assert.equal(renderer.shake, 0);
  assert.equal(renderer.hitStop, 0);
});

test('crits and kills trigger bounded hit-stop while normal hits do not', t => {
  const renderer = rendererFixture(t);
  renderer.handleEvents([hit(12, false)], false);
  assert.equal(renderer.hitStop, 0);
  assert.ok(renderer.shake > 0, 'normal hits still nudge the camera');
  renderer.reset();
  renderer.handleEvents([hit(30, true)], false);
  assert.ok(renderer.hitStop > 0 && renderer.hitStop <= .06, `hit-stop stays under 60 ms: ${renderer.hitStop}`);
  renderer.reset();
  renderer.handleEvents([kill], false);
  assert.ok(renderer.hitStop > 0 && renderer.hitStop <= .06);
});

test('shake amplitude scales with hit magnitude', t => {
  const renderer = rendererFixture(t);
  renderer.handleEvents([hit(10, false)], false);
  const small = renderer.shake;
  renderer.reset();
  renderer.handleEvents([hit(90, false)], false);
  assert.ok(renderer.shake > small, `${renderer.shake} should exceed ${small}`);
});

test('camera shake offset decays to zero and respects reduced motion', () => {
  const shake = new CameraShake();
  shake.impact(0, 5, 1.6);
  const offset = shake.offset(1, false);
  assert.ok(Math.abs(offset.x) > 0 || Math.abs(offset.y) > 0);
  assert.deepEqual(shake.offset(1, true), { x: 0, y: 0 });
  for (let i = 0; i < 120; i++) shake.update(1 / 60);
  const settled = shake.offset(3, false);
  assert.ok(Math.abs(settled.x) < .01 && Math.abs(settled.y) < .01);
});

test('crit damage numbers are larger and hotter than normal hits', () => {
  const effects = new CombatEffects();
  effects.handleEvents([hit(20, false)]);
  const normal = popups(effects).find(p => p.value === '20')!;
  assert.ok(normal);
  effects.reset();
  effects.handleEvents([hit(20, true)]);
  const crit = popups(effects).find(p => p.value === '20')!;
  assert.ok(crit);
  assert.ok(crit.size > normal.size, `crit size ${crit.size} should exceed normal ${normal.size}`);
  assert.notEqual(crit.color, normal.color);
  assert.ok(crit.life > normal.life);
});

test('combatJuice off leaves crit popups at the plain heavy size', () => {
  const original = GAME_FEATURES.combatJuice;
  GAME_FEATURES.combatJuice = false;
  try {
    const effects = new CombatEffects();
    effects.handleEvents([hit(20, true)]);
    // Heavy hits are suppressed in favor of loot beams without juice; any
    // surviving popup must not carry the crit styling.
    const popup = popups(effects).find(p => p.value === '20');
    assert.ok(!popup || popup.size <= 2.6);
  } finally { GAME_FEATURES.combatJuice = original; }
});
