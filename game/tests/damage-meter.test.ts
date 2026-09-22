import test from 'node:test';
import assert from 'node:assert/strict';
import { DamageMeter } from '../src/damage-meter.ts';
import type { CombatEvent } from '../src/model.ts';
import type { SkillId } from '../src/character-types.ts';

const hit = (over: Partial<Extract<CombatEvent, { type: 'hit' }>> = {}): CombatEvent => ({
  type: 'hit', x: 0, y: 0, angle: 0, value: 100, targetId: 1,
  remainingHp: 50, enemyKind: 'hound', heavy: false, ...over,
});
const heal = (value: number, skill?: SkillId): CombatEvent =>
  ({ type: 'heal', x: 0, y: 0, value, ...(skill ? { skill } : {}) });

test('aggregates damage per source with hits, crits, max hit and share', () => {
  const meter = new DamageMeter();
  meter.push(hit({ value: 100 }), 1000);
  meter.push(hit({ value: 300, heavy: true }), 2000);
  meter.push(hit({ value: 200, allyId: 7 }), 3000);
  const rows = meter.rows('damage');
  assert.equal(rows.length, 2);
  const [player, pet] = rows;
  assert.equal(player.source, 'player');
  assert.equal(player.name, 'You');
  assert.equal(player.total, 400);
  assert.equal(player.hits, 2);
  assert.equal(player.crits, 1);
  assert.equal(player.maxHit, 300);
  assert.equal(pet.source, 'ally:7');
  assert.equal(pet.total, 200);
  assert.ok(Math.abs(player.share - 2 / 3) < 1e-9);
  assert.ok(Math.abs(pet.share - 1 / 3) < 1e-9);
  // 400 damage over a 2s activity span (t=1000..3000) = 200 dps.
  assert.equal(player.perSecond, 200);
});

test('resolves ally names through the sourceName hook', () => {
  const meter = new DamageMeter({ sourceName: s => s === 'ally:7' ? 'Felguard' : undefined });
  meter.push(hit({ allyId: 7 }), 1000);
  meter.push(hit({ allyId: 9 }), 1000);
  const names = meter.rows('damage').map(r => r.name).sort();
  assert.deepEqual(names, ['Ally 9', 'Felguard']);
});

test('per-skill breakdown splits skills, melee fallback and periodic dots', () => {
  const meter = new DamageMeter();
  meter.push(hit({ value: 100, skill: 'frostbolt' }), 1000);
  meter.push(hit({ value: 50, skill: 'frostbolt', periodic: true }), 1500);
  meter.push(hit({ value: 80, melee: true }), 2000);
  meter.push(hit({ value: 30, periodic: true }), 2500);
  const [row] = meter.rows('damage');
  assert.equal(row.skills.length, 3);
  const [top] = row.skills;
  assert.equal(top.key, 'frostbolt');
  assert.equal(top.label, 'Frostbolt');
  assert.equal(top.total, 150);
  assert.equal(top.hits, 2);
  assert.equal(row.skills[1].key, 'melee');
  assert.equal(row.skills[1].label, 'Melee');
  assert.equal(row.skills[2].key, 'dot');
  assert.equal(row.skills[2].label, 'Periodic damage');
  assert.ok(Math.abs(top.share - 150 / 260) < 1e-9);
});

test('healing mode aggregates heals and potion life separately from damage', () => {
  const meter = new DamageMeter();
  meter.push(hit({ value: 500 }), 1000);
  meter.push(heal(120), 1500);
  meter.push({ type: 'potion', x: 0, y: 0, life: 80, mana: 40 }, 2000);
  const healing = meter.rows('healing');
  assert.equal(healing.length, 1);
  assert.equal(healing[0].total, 200);
  assert.deepEqual(healing[0].skills.map(s => s.key).sort(), ['heal', 'potion']);
  assert.equal(meter.rows('damage')[0].total, 500);
});

test('segment(start, end) bounds aggregation to the explicit range', () => {
  const meter = new DamageMeter();
  meter.push(hit({ value: 100 }), 1000);
  meter.push(hit({ value: 200 }), 5000);
  meter.push(hit({ value: 400 }), 9000);
  const seg = meter.segment(4000, 8000);
  assert.equal(seg.damage.length, 1);
  assert.equal(seg.damage[0].total, 200);
  assert.equal(seg.durationMs, 1000); // single event -> 1s floor
  assert.equal(meter.segment(0, 20000).damage[0].total, 700);
});

test('rows(mode, windowMs) is a rolling window back from the latest event', () => {
  const meter = new DamageMeter();
  meter.push(hit({ value: 100 }), 1000);
  meter.push(hit({ value: 200 }), 9000);
  const rows = meter.rows('damage', 4000);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].total, 200);
  assert.equal(meter.rows('damage').length, 1);
  assert.equal(meter.rows('damage')[0].total, 300);
});

test('fight boundary resets after the inactivity gap', () => {
  const meter = new DamageMeter({ fightGapMs: 5000 });
  meter.push(hit(), 1000);
  assert.equal(meter.fightStartMs, 1000);
  meter.push(hit(), 3000);
  assert.equal(meter.fightStartMs, 1000); // still the same fight
  meter.push(hit(), 9000); // 6s gap -> new fight
  assert.equal(meter.fightStartMs, 9000);
  assert.equal(meter.fightActive, true);
  // Non-stored activity (a hurt event) still extends the fight.
  meter.push({ type: 'hurt', x: 0, y: 0, angle: 0, value: 10, remainingHp: 90, heavy: false }, 13000);
  assert.equal(meter.fightStartMs, 9000);
  meter.push(hit(), 19000); // 6s after the hurt -> new fight again
  assert.equal(meter.fightStartMs, 19000);
});

test('buffer is bounded: oldest events drop past capacity', () => {
  const meter = new DamageMeter({ capacity: 10 });
  for (let i = 0; i < 25; i++) meter.push(hit({ value: i + 1 }), i * 100);
  assert.equal(meter.size, 10);
  const [row] = meter.rows('damage');
  // Only the last 10 hits (values 16..25) survive.
  assert.equal(row.total, 205);
  assert.equal(row.hits, 10);
});

test('reset clears events, fight state and rows', () => {
  const meter = new DamageMeter();
  meter.push(hit(), 1000);
  meter.reset();
  assert.equal(meter.size, 0);
  assert.equal(meter.fightStartMs, undefined);
  assert.equal(meter.lastMs, undefined);
  assert.deepEqual(meter.rows('damage'), []);
});

test('non-meter events are ignored but engagement keeps the fight alive', () => {
  const meter = new DamageMeter();
  meter.push({ type: 'gold', x: 0, y: 0, amount: 5, balance: 5 }, 1000);
  assert.equal(meter.size, 0);
  meter.push({ type: 'engagement', x: 0, y: 0, targetId: 1, enemyKind: 'hound', engaged: true, time: 2 }, 2000);
  assert.equal(meter.fightStartMs, 2000);
  assert.equal(meter.size, 0);
  assert.deepEqual(meter.rows('damage'), []);
});

test('zero-damage hits are not stored', () => {
  const meter = new DamageMeter();
  meter.push(hit({ value: 0, actualValue: 0 }), 1000);
  assert.equal(meter.size, 0);
  assert.deepEqual(meter.rows('damage'), []);
});
