import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import type { Input, WorldQuery } from '../src/model.ts';
import { mountSpeedFactor, summonProgress, summonCast, preferredMount, mountUnlocked } from '../src/mount-state.ts';
import { mountToggle, advanceMount, mountOnOffense, mountOnDamage } from '../src/mount-command.ts';
import { MOUNTS, MOUNT_IDS } from '../src/mount-content.ts';
import { drawMount, mountPose } from '../src/mount-art.ts';
import { ActionBars } from '../src/action-bar.ts';
import { mountHintVisible } from '../src/hud-action-bars.ts';
const idle: Input = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const indoorWorld: WorldQuery = { ...world, sampleGroundContact: () => ({ indoors: true }) } as WorldQuery;

function sim(w: WorldQuery = world) { return new Simulation(w, { spawn: false }); }

test('toggle starts a 1.5s cast that completes into mounted state', () => {
  const s = sim();
  assert.equal(mountToggle(s).ok, true);
  assert.equal(s.player.mounted ?? null, null);
  for (let i = 0; i < 90; i++) advanceMount(s, 1 / 60, idle);
  assert.ok(s.player.mounted); assert.equal(s.player.mounted.id, 'horse');
  assert.equal(mountSpeedFactor(s.player), MOUNTS.horse.speed);
});

test('movement input interrupts the summon cast', () => {
  const s = sim();
  mountToggle(s);
  for (let i = 0; i < 30; i++) advanceMount(s, 1 / 60, idle);
  advanceMount(s, 1 / 60, { ...idle, moveX: 1 });
  assert.equal(s.player.mounted ?? null, null);
  assert.equal(summonProgress(s), 0);
});

test('damage interrupts cast and dismounts; offense dismounts', () => {
  const s = sim();
  mountToggle(s);
  mountOnDamage(s);
  assert.equal(summonProgress(s), 0);
  for (let i = 0; i < 90; i++) advanceMount(s, 1 / 60, idle);
  assert.equal(s.player.mounted ?? null, null);
  mountToggle(s);
  for (let i = 0; i < 90; i++) advanceMount(s, 1 / 60, idle);
  assert.ok(s.player.mounted); assert.equal(s.player.mounted.id, 'horse');
  mountOnOffense(s);
  assert.equal(s.player.mounted ?? null, null);
  assert.equal(mountSpeedFactor(s.player), 1);
});

test('indoor summon rejected; mounted player entering indoors dismounts', () => {
  const s = sim(indoorWorld);
  const r = mountToggle(s);
  assert.equal(r.ok, false);
  const s2 = sim();
  mountToggle(s2);
  for (let i = 0; i < 90; i++) advanceMount(s2, 1 / 60, idle);
  s2.world = indoorWorld;
  advanceMount(s2, 1 / 60, idle);
  assert.equal(s2.player.mounted, null);
});

test('X while mounted dismounts instantly; drake gated by achievement', () => {
  const s = sim();
  assert.equal(preferredMount(s.player), 'horse');
  assert.equal(mountUnlocked(s.player, 'drake'), false);
  assert.equal(mountToggle(s, 'drake').ok, false);
  s.player.achievements = { 'mount:drake': 1 };
  assert.equal(preferredMount(s.player), 'drake');
  mountToggle(s);
  for (let i = 0; i < 90; i++) advanceMount(s, 1 / 60, idle);
  assert.equal(s.player.mounted?.id, 'drake');
  assert.equal(mountSpeedFactor(s.player), 2.0);
  const r = mountToggle(s);
  assert.equal(r.ok, true);
  assert.equal(s.player.mounted, null);
});

test('mount art draws all four mounts without throwing and stays finite', () => {
  const calls: string[] = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: '', lineCap: '',
    beginPath: () => calls.push('begin'), moveTo: () => calls.push('move'),
    lineTo: () => calls.push('line'), closePath: () => calls.push('close'),
    fill: () => calls.push('fill'), stroke: () => calls.push('stroke'),
  } as unknown as CanvasRenderingContext2D;
  const s = sim();
  s.player.vx = 100; s.player.vy = 0;
  const pose = mountPose(s.player, 1.5);
  assert.ok(Number.isFinite(pose.moveAngle) && Number.isFinite(pose.gaitPhase));
  for (const id of MOUNT_IDS) {
    calls.length = 0;
    drawMount(ctx, MOUNTS[id], pose);
    assert.ok(calls.length > 50, `${id} drew ${calls.length} ops`);
  }
});

test('moving player cannot start the cast', () => {
  const s = sim();
  s.player.vx = 50;
  assert.equal(mountToggle(s).ok, false);
});

test('stable-master pick drives the X toggle; locked picks fall back', () => {
  const s = sim();
  s.player.character.mount = 'wolf';
  assert.equal(preferredMount(s.player), 'wolf');
  mountToggle(s);
  for (let i = 0; i < 90; i++) advanceMount(s, 1 / 60, idle);
  assert.equal(s.player.mounted?.id, 'wolf');
  // A locked pick (drake without the achievement) falls back to the default.
  s.player.character.mount = 'drake';
  assert.equal(preferredMount(s.player), 'horse');
  s.player.achievements = { 'mount:drake': 1 };
  assert.equal(preferredMount(s.player), 'drake');
});

test('ghosts cannot summon a mount', () => {
  const s = sim();
  s.ghost = { corpse: { x: 0, y: 0 }, healer: { x: 10, y: 10, name: 'Spirit Healer' } };
  const r = mountToggle(s);
  assert.equal(r.ok, false);
  assert.equal(summonCast(s), null);
});

test('summon hint shows until first mount or a bar slot carries a mount', () => {
  const s = sim();
  const bars = new ActionBars();
  assert.equal(mountHintVisible(s.player, bars), true);
  bars.setExtra(11, { kind: 'mount', id: 'horse' });
  assert.equal(mountHintVisible(s.player, bars), false);
  const s2 = sim(), bars2 = new ActionBars();
  s2.player.mounted = { id: 'horse', since: 0 };
  assert.equal(mountHintVisible(s2.player, bars2), false);
  s2.player.mounted = null;
  assert.equal(mountHintVisible(s2.player, bars2), false);
  s2.player.dead = true;
  assert.equal(mountHintVisible(s2.player, bars2), false);
});
