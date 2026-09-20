import assert from 'node:assert/strict';
import test from 'node:test';
import { ActionBars, BAR_SLOTS } from '../src/action-bar.ts';
import { ControlBindings } from '../src/control-bindings.ts';
import { actionBarLayout } from '../src/action-bar.ts';
import {
  drawHotbarEditOverlay, hotbarBounds, hotbarFrameAt, hotbarGripAt, hotbarKeyLabels,
  hotbarPointerDown, hotbarPointerMove, hotbarPointerUp, hotbarSlotAction, hotbarSlotAt,
  isHotbarPoint, registerHotbarFrames, resolveBarLayout,
} from '../src/hotbar-layout.ts';
import { resetUiLayout, setUiEditMode, setUiLayout, uiFrames, uiLayout, canvasFrameDragging } from '../src/ui-layout.ts';

const W = 1280, H = 720;
const bars = () => new ActionBars();

function reset() {
  resetUiLayout();
  setUiEditMode(false);
  hotbarPointerUp();
}

test('registers the three bar frames once, in the HUD group', () => {
  reset();
  registerHotbarFrames(); registerHotbarFrames();
  const frames = uiFrames().filter(f => f.id.startsWith('actionBar'));
  assert.deepEqual(frames.map(f => f.id), ['actionBar1', 'actionBar2', 'actionBar3']);
  assert.ok(frames.every(f => f.group === 'HUD' && f.hidable === true));
});

test('resolved layout matches the natural anchors until customized', () => {
  reset();
  const b = bars();
  const natural = actionBarLayout(b, W, H);
  const resolved = resolveBarLayout(b, W, H);
  assert.equal(resolved.main.x, natural.main.x);
  assert.equal(resolved.main.y, natural.main.y);
  assert.equal(resolved.main.slot, natural.main.slot);
  assert.equal(resolved.main.frame, 'actionBar1');
  assert.equal(resolved.main.vertical, false);
  assert.equal(resolved.sides.length, 2);
  assert.deepEqual(resolved.sides.map(s => s.frame), ['actionBar2', 'actionBar3']);
  assert.ok(resolved.sides.every(s => s.vertical && s.visible));
});

test('offsets translate the strip; hit-testing follows it', () => {
  reset();
  const b = bars();
  const before = resolveBarLayout(b, W, H).main;
  // Slot 0 hits before the move.
  assert.equal(hotbarSlotAt(b, before.x + 2, before.y + 2, W, H), 0);
  setUiLayout('actionBar1', { x: 40, y: -30 });
  const after = resolveBarLayout(b, W, H).main;
  assert.equal(after.x, before.x + 40);
  assert.equal(after.y, before.y - 30);
  assert.equal(hotbarSlotAt(b, after.x + 2, after.y + 2, W, H), 0);
  assert.equal(hotbarSlotAt(b, before.x + 2, before.y + 2, W, H), null);
});

test('scale grows the strip around its center', () => {
  reset();
  const b = bars();
  const before = resolveBarLayout(b, W, H).main;
  const beforeW = BAR_SLOTS * before.slot + (BAR_SLOTS - 1) * before.gap;
  setUiLayout('actionBar1', { scale: 1.5 });
  const after = resolveBarLayout(b, W, H).main;
  const afterW = BAR_SLOTS * after.slot + (BAR_SLOTS - 1) * after.gap;
  assert.ok(Math.abs(afterW - beforeW * 1.5) < 1e-9);
  assert.ok(Math.abs(after.x + afterW / 2 - (before.x + beforeW / 2)) < 1e-9);
});

test('hidden frames keep bounds for edit mode but drop out of slot hit-testing', () => {
  reset();
  const b = bars();
  const main = resolveBarLayout(b, W, H).main;
  setUiLayout('actionBar1', { visible: false });
  assert.equal(hotbarSlotAt(b, main.x + 2, main.y + 2, W, H), null);
  assert.equal(isHotbarPoint(b, main.x + 2, main.y + 2, W, H), false);
  const bounds = hotbarBounds(b, W, H);
  assert.equal(bounds.find(f => f.id === 'actionBar1')?.visible, false);
  assert.equal(hotbarFrameAt(b, main.x + 2, main.y + 2, W, H), 'actionBar1');
});

test('bounds cover the strip plus its page tag', () => {
  reset();
  const b = bars();
  const main = resolveBarLayout(b, W, H).main;
  const b1 = hotbarBounds(b, W, H).find(f => f.id === 'actionBar1')!;
  assert.ok(b1.x <= main.x - 18, 'page tag left of the strip is inside bounds');
  assert.ok(b1.y <= main.y && b1.y + b1.h >= main.y + main.slot);
});

test('edit mode gates dragging; locked frames swallow but do not move', () => {
  reset();
  const b = bars();
  const main = resolveBarLayout(b, W, H).main;
  const px = main.x + 10, py = main.y + 10;
  // Outside edit mode: no drag, click passes through to slot activation.
  assert.equal(hotbarPointerDown(b, px, py, W, H), false);
  setUiEditMode(true);
  assert.equal(hotbarPointerDown(b, px, py, W, H), true);
  assert.equal(canvasFrameDragging(), 'actionBar1');
  hotbarPointerMove(px + 25, py + 15);
  assert.equal(uiLayout('actionBar1').x, 25);
  assert.equal(uiLayout('actionBar1').y, 15);
  hotbarPointerUp();
  assert.equal(canvasFrameDragging(), null);
  // Locked: consumed, no drag starts.
  setUiLayout('actionBar1', { locked: true });
  assert.equal(hotbarPointerDown(b, px + 25, py + 15, W, H), true);
  assert.equal(canvasFrameDragging(), null);
  hotbarPointerUp();
});

test('corner grip scales the frame in edit mode', () => {
  reset();
  const b = bars();
  setUiEditMode(true);
  const b1 = hotbarBounds(b, W, H).find(f => f.id === 'actionBar1')!;
  const gx = b1.x + b1.w - 4, gy = b1.y + b1.h - 4;
  assert.equal(hotbarGripAt(b, gx, gy, W, H), 'actionBar1');
  assert.equal(hotbarPointerDown(b, gx, gy, W, H), true);
  hotbarPointerMove(gx + 48, gy);
  assert.ok(Math.abs(uiLayout('actionBar1').scale - 1.2) < 1e-9);
  hotbarPointerUp();
});

test('side bars resolve independently and hit-test vertically', () => {
  reset();
  const b = bars();
  const outer = resolveBarLayout(b, W, H).sides[1];
  // Slot 3 of the outer side bar's page sits at y + 3*(slot+gap).
  const sx = outer.x + 2, sy = outer.y + 3 * (outer.slot + outer.gap) + 2;
  assert.equal(hotbarSlotAt(b, sx, sy, W, H), outer.page * BAR_SLOTS + 3);
  setUiLayout('actionBar3', { y: 60 });
  const moved = resolveBarLayout(b, W, H).sides[1];
  assert.equal(hotbarSlotAt(b, moved.x + 2, moved.y + 2, W, H), moved.page * BAR_SLOTS);
});

test('key labels reflect real bindings; slot actions map only the active page', () => {
  reset();
  const bindings = new ControlBindings();
  assert.deepEqual(hotbarKeyLabels(bindings).slice(0, 3), ['1', '2', '3']);
  bindings.bind('skill0', 0, 'F1');
  assert.equal(hotbarKeyLabels(bindings)[0], 'F1');
  bindings.bind('skill1', 0, 'Mouse4');
  assert.equal(hotbarKeyLabels(bindings)[1], 'M5');
  assert.equal(hotbarSlotAction(0), 'skill0');
  assert.equal(hotbarSlotAction(11), 'skill11');
  assert.equal(hotbarSlotAction(12), null);
  assert.equal(hotbarSlotAction(-1), null);
});

test('edit overlay is a no-op outside edit mode', () => {
  reset();
  const b = bars();
  const calls: string[] = [];
  const fake = {
    save: () => calls.push('save'), restore: () => calls.push('restore'),
    fillRect: () => calls.push('fillRect'), strokeRect: () => calls.push('strokeRect'),
    setLineDash: () => calls.push('dash'), beginPath: () => calls.push('begin'),
    moveTo: () => calls.push('move'), lineTo: () => calls.push('line'),
    closePath: () => calls.push('close'), fill: () => calls.push('fill'),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    setTransform: () => calls.push('setTransform'),
    measureText: (v: string) => ({ width: v.length * 6, actualBoundingBoxAscent: 8 }),
    fillText: () => calls.push('fillText'),
    fillStyle: '', strokeStyle: '', lineWidth: 0,
    font: '', textAlign: '', textBaseline: '', direction: '', fontKerning: '',
  };
  drawHotbarEditOverlay(fake as unknown as CanvasRenderingContext2D, b, W, H);
  assert.equal(calls.length, 0);
  setUiEditMode(true);
  drawHotbarEditOverlay(fake as unknown as CanvasRenderingContext2D, b, W, H);
  assert.ok(calls.includes('strokeRect') && calls.includes('fill'));
});
