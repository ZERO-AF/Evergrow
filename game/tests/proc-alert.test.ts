import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { ProcAlertTracker, isProcBuff, PROC_ALERT_SECONDS, PROC_ALERT_MAX } from '../src/proc-alert.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { PROJECTILE_COLORS } from '../src/projectile-colors.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const make = () => new Simulation(world, { spawn: false });

test('a legendary proc buff opens a mirrored side-arc alert in its school color', () => {
  const sim = make(), p = sim.player, tracker = new ProcAlertTracker();
  assert.equal(tracker.update(p, 100).length, 0);
  sim.addBuff('Fury of the Betrayer', '#f0a16b', { duration: 8, stats: { attackSpeedPercent: 15 } }, 'proc:warglaive-azzinoth');
  const alerts = tracker.update(p, 100);
  assert.equal(alerts.length, 1);
  const alert = alerts[0]!;
  assert.equal(alert.key, 'proc:warglaive-azzinoth');
  assert.equal(alert.name, 'Fury of the Betrayer');
  assert.equal(alert.school, 'fire');
  assert.equal(alert.color, PROJECTILE_COLORS.fire);
  assert.deepEqual(alert.edges, ['left', 'right']);
  assert.equal(alert.duration, PROC_ALERT_SECONDS);
  assert.ok(alert.remaining > 1.4 && alert.remaining <= PROC_ALERT_SECONDS);
});

test('an instant-cast proc buff (Presence of Mind) arcs over the top edge', () => {
  const sim = make(), p = sim.player, tracker = new ProcAlertTracker();
  sim.addBuff('Presence of Mind', '#9d7bf0', { duration: 3, stats: { castSpeedPercent: 300 } }, 'presenceOfMind');
  const alerts = tracker.update(p, 50);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.key, 'presenceOfMind');
  assert.deepEqual(alerts[0]!.edges, ['top']);
  assert.equal(alerts[0]!.color, SKILL_DEFINITIONS.presenceOfMind.color);
});

test('ordinary buffs and modest haste never alert', () => {
  const sim = make(), p = sim.player, tracker = new ProcAlertTracker();
  sim.addBuff('Bulwark', '#a8c68a', { duration: 12, reduction: .3 }, 'bulwark');
  sim.addBuff('Speed', '#f0e68c', { duration: 15, stats: { castSpeedPercent: 20, attackSpeedPercent: 20 } }, 'potion:speed');
  assert.equal(tracker.update(p, 10).length, 0);
  assert.equal(isProcBuff(p.buffs![0]!), false);
  assert.equal(isProcBuff(p.buffs![1]!), false);
});

test('a held proc dedupes to one alert that ticks down with the clock', () => {
  const sim = make(), p = sim.player, tracker = new ProcAlertTracker();
  sim.addBuff('Guardian', '#f0a16b', { duration: 10, stats: { spellDamagePercent: 20 } }, 'proc:atiesh');
  tracker.update(p, 0);
  const alerts = tracker.update(p, .5);
  assert.equal(alerts.length, 1, 'same buff never stacks a second alert');
  assert.ok(alerts[0]!.remaining <= PROC_ALERT_SECONDS - .5 + 1e-9);
});

test('a re-proc refreshes the alert window instead of stacking', () => {
  const sim = make(), p = sim.player, tracker = new ProcAlertTracker();
  sim.addBuff('Guardian', '#f0a16b', { duration: 10, stats: { spellDamagePercent: 20 } }, 'proc:atiesh');
  tracker.update(p, 0);
  p.buffs![0]!.remaining = 4; // buff ticks down
  tracker.update(p, 1);
  p.buffs![0]!.remaining = 10; // re-proc refreshes the same buff
  const alerts = tracker.update(p, 1.2);
  assert.equal(alerts.length, 1);
  assert.ok(alerts[0]!.remaining > PROC_ALERT_SECONDS - .25, 'refresh restarts the flash window');
});

test('alerts expire with their window and die when the buff is consumed', () => {
  const sim = make(), p = sim.player, tracker = new ProcAlertTracker();
  sim.addBuff('Guardian', '#f0a16b', { duration: 10 }, 'proc:atiesh');
  assert.equal(tracker.update(p, 0).length, 1);
  assert.equal(tracker.update(p, PROC_ALERT_SECONDS + .01).length, 0, 'flash window elapsed');
  p.buffs![0]!.remaining = 10;
  assert.equal(tracker.update(p, 5).length, 1, 're-proc after expiry alerts again');
  p.buffs = []; // consumed early (e.g. instant cast spent)
  assert.equal(tracker.update(p, 5.2).length, 0, 'buff gone ends the overlay');
});

test('dead players show no overlays and the alert list stays bounded', () => {
  const sim = make(), p = sim.player, tracker = new ProcAlertTracker();
  for (let i = 0; i < PROC_ALERT_MAX + 3; i++)
    sim.addBuff(`Proc ${i}`, '#f0a16b', { duration: 8 }, `proc:atiesh:${i}`);
  const alerts = tracker.update(p, 0);
  assert.equal(alerts.length, PROC_ALERT_MAX);
  p.dead = true;
  assert.equal(tracker.update(p, .1).length, 0);
});
