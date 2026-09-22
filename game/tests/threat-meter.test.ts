import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { damageEnemy } from '../src/combat-damage.ts';
import { ThreatMeter, pullThreshold, threatColor, drawThreatRows, drawThreatList, THREAT_RULES } from '../src/threat-meter.ts';
import { combatTextForEvent } from '../src/combat-text.ts';
import { PROJECTILE_COLORS } from '../src/projectile-colors.ts';
import type { Ally, CombatEvent, Enemy } from '../src/model.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const sim = () => new Simulation(world, { spawn: false });

function target(s: Simulation): Enemy {
  const enemy = s.spawnEnemy('stalker', 45, 0)!;
  enemy.hp = enemy.maxHp = 10000;
  return enemy;
}

function ghoul(s: Simulation, id = 900): Ally {
  const ally: Ally = { id, kind: 'ghoul', x: 10, y: 0, prevX: 10, prevY: 0, angle: 0,
    hp: 50, maxHp: 50, damage: 5, stationary: false, targetId: null, attackCooldown: 0, radius: 11 };
  s.player.allies = [...(s.player.allies ?? []), ally];
  return ally;
}

const hit = (enemy: Enemy, value: number, extra: Partial<Extract<CombatEvent, { type: 'hit' }>> = {}): CombatEvent =>
  ({ type: 'hit', x: enemy.x, y: enemy.y, angle: 0, value, targetId: enemy.id,
    remainingHp: Math.max(0, enemy.hp - value), enemyKind: enemy.kind, heavy: false, ...extra });

test('threat accumulates on damage and the player holds aggro', () => {
  const s = sim(), enemy = target(s), meter = new ThreatMeter();
  meter.handleEvents([hit(enemy, 40), hit(enemy, 60)]);
  meter.update(s.enemies);
  const rows = meter.rows(enemy, s.player);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'player');
  assert.equal(rows[0].threat, 100);
  assert.equal(rows[0].percent, 1);
  assert.equal(rows[0].tanking, true);
  assert.equal(meter.playerPercent(enemy), 1);
});

test('overkill counts only the damage actually dealt', () => {
  const s = sim(), enemy = target(s), meter = new ThreatMeter();
  meter.handleEvents([hit(enemy, 500, { actualValue: 120 })]);
  meter.update(s.enemies);
  assert.equal(meter.rows(enemy, s.player)[0].threat, 120);
});

test('taunt spikes the taunter to the top of the table', () => {
  const s = sim(), enemy = target(s), meter = new ThreatMeter();
  const pet = ghoul(s);
  meter.handleEvents([hit(enemy, 100)]);
  meter.update(s.enemies);
  // Pet growl: taunted with allyId pins the enemy to the pet.
  enemy.taunted = { remaining: 4, allyId: pet.id };
  meter.update(s.enemies);
  const rows = meter.rows(enemy, s.player);
  assert.equal(rows.length, 2);
  // Taunt pegs the pet at the holder's threat and marks it tanking.
  const tank = rows.find(r => r.tanking)!;
  assert.equal(tank.source, `ally:${pet.id}`);
  assert.equal(tank.threat, 100);
  assert.equal(tank.label, 'Ghoul');
  assert.equal(rows.find(r => r.you)!.percent, 1, 'player is tied at 100% after the taunt');
  // Pet keeps attacking: it pulls ahead and the player's share drops.
  meter.handleEvents([hit(enemy, 50, { allyId: pet.id })]);
  meter.update(s.enemies);
  assert.equal(meter.rows(enemy, s.player)[0].threat, 150);
  assert.ok(Math.abs(meter.playerPercent(enemy) - 100 / 150) < 1e-9);
});

test('player taunt pegs the player above a tanking pet', () => {
  const s = sim(), enemy = target(s), meter = new ThreatMeter();
  const pet = ghoul(s);
  meter.handleEvents([hit(enemy, 80, { allyId: pet.id }), hit(enemy, 20)]);
  meter.update(s.enemies);
  assert.equal(meter.rows(enemy, s.player)[0].source, `ally:${pet.id}`);
  enemy.taunted = { remaining: 3 };
  meter.update(s.enemies);
  const rows = meter.rows(enemy, s.player);
  const tank = rows.find(r => r.tanking)!;
  assert.equal(tank.source, 'player');
  assert.equal(tank.threat, 80);
  assert.equal(tank.tanking, true);
});

test('pet damage splits threat into its own bucket through the real damage path', () => {
  const s = sim(), enemy = target(s), meter = new ThreatMeter();
  const pet = ghoul(s);
  const events: CombatEvent[] = [];
  const context = { player: s.player, enemies: s.enemies, random: () => .9,
    visible: () => true, emit: (e: CombatEvent) => events.push(e), killed: () => {} };
  damageEnemy(enemy, 30, 0, true, context, false, undefined, undefined,
    { critChance: 0, critMultiplier: 1, lifeOnHit: 0, ally: true, allyId: pet.id });
  damageEnemy(enemy, 70, 0, true, context);
  meter.handleEvents(events);
  meter.update(s.enemies);
  const rows = meter.rows(enemy, s.player);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].source, 'player');
  assert.equal(rows[0].threat, 70);
  assert.equal(rows[1].source, `ally:${pet.id}`);
  assert.equal(rows[1].threat, 30);
});

test('periodic ticks split across live dots by ownership', () => {
  const s = sim(), enemy = target(s), meter = new ThreatMeter();
  const pet = ghoul(s);
  enemy.dots = [
    { id: 'shadow', school: 'shadow', dps: 10, remaining: 5, tick: 0, interval: 1, source: 'player' },
    { id: 'bite', school: 'physical' as never, dps: 30, remaining: 5, tick: 0, interval: 1, source: 'ally', allyId: pet.id },
  ];
  meter.handleEvents([hit(enemy, 40, { periodic: true })]);
  meter.update(s.enemies);
  const rows = meter.rows(enemy, s.player);
  assert.equal(rows.find(r => r.source === 'player')!.threat, 10);
  assert.equal(rows.find(r => r.source === `ally:${pet.id}`)!.threat, 30);
});

test('kills and leash resets drop the table', () => {
  const s = sim(), enemy = target(s), meter = new ThreatMeter();
  meter.handleEvents([hit(enemy, 50)]);
  meter.update(s.enemies);
  assert.equal(meter.rows(enemy, s.player).length, 1);
  meter.handleEvents([{ type: 'kill', x: enemy.x, y: enemy.y, angle: 0, facing: 0,
    targetId: enemy.id, remainingHp: 0, enemyKind: enemy.kind }]);
  assert.equal(meter.rows(enemy, s.player).length, 0);
  // A returning, unaware enemy evades: its table resets like WoW leashing.
  meter.handleEvents([hit(enemy, 25)]);
  meter.update(s.enemies);
  enemy.state = 'return'; enemy.awareness = 0;
  meter.update(s.enemies);
  assert.equal(meter.rows(enemy, s.player).length, 0);
});

test('the side list ranks engaged enemies by player share', () => {
  const s = sim(), meter = new ThreatMeter();
  const a = target(s), b = s.spawnEnemy('hound', 60, 0)!;
  b.hp = b.maxHp = 10000;
  const pet = ghoul(s);
  meter.handleEvents([hit(a, 100), hit(b, 40), hit(b, 60, { allyId: pet.id })]);
  meter.update(s.enemies);
  const list = meter.list(s.enemies);
  assert.equal(list.length, 2);
  assert.equal(list[0].enemy.id, a.id);
  assert.equal(list[0].percent, 1);
  assert.equal(list[0].tanking, true);
  assert.equal(list[1].enemy.id, b.id);
  assert.ok(Math.abs(list[1].percent - 40 / 60) < 1e-9);
  assert.equal(list[1].tanking, false);
});

test('pull thresholds and colors follow the WoW melee/ranged rule', () => {
  const s = sim();
  assert.equal(pullThreshold(s.player), THREAT_RULES.meleePull);
  assert.equal(threatColor(1, true), '#e2574c');
  assert.equal(threatColor(1.2, false), '#e8913d');
  assert.equal(threatColor(.8, false), '#e8c93a');
  assert.equal(threatColor(.3, false), '#7fb069');
});

test('combat text maps attack-table outcomes to WoW labels', () => {
  const at = (e: CombatEvent) => combatTextForEvent(e, () => .5).map(p => p.value);
  assert.deepEqual(at({ type: 'avoid', outcome: 'miss', x: 0, y: 0, angle: 0, enemyKind: 'stalker' }), ['MISS']);
  assert.deepEqual(at({ type: 'avoid', outcome: 'dodge', x: 0, y: 0, angle: 0, incoming: true }), ['DODGE']);
  assert.deepEqual(at({ type: 'avoid', outcome: 'parry', x: 0, y: 0, angle: 0, enemyKind: 'stalker' }), ['PARRY']);
  assert.deepEqual(at({ type: 'hit', x: 0, y: 0, angle: 0, value: 65, targetId: 1,
    remainingHp: 35, enemyKind: 'stalker', heavy: false, glancing: true }), ['65', 'GLANCING']);
  assert.deepEqual(at({ type: 'block', x: 0, y: 0, angle: 0, value: 30 }), ['BLOCK']);
  assert.deepEqual(at({ type: 'block', x: 0, y: 0, angle: 0, value: 0, blocked: 'immune' }), ['IMMUNE']);
  assert.deepEqual(at({ type: 'block', x: 0, y: 0, angle: 0, value: 40, blocked: 'absorb' }), ['40 ABSORBED']);
  assert.deepEqual(at({ type: 'block', x: 0, y: 0, angle: 0, value: 22, blocked: 'resist' }), ['22 RESISTED']);
  assert.deepEqual(at({ type: 'heal', x: 0, y: 0, value: 55 }), ['+55']);
  assert.deepEqual(at({ type: 'hurt', x: 0, y: 0, angle: 0, value: 33, remainingHp: 10, heavy: false }), ['-33']);
});

test('combat text colors melee, skills and spell schools the WoW way', () => {
  const one = (e: CombatEvent) => combatTextForEvent(e, () => .5)[0];
  // Auto-attack white, special melee yellow, spells in school colors.
  assert.equal(one({ type: 'hit', x: 0, y: 0, angle: 0, value: 10, targetId: 1,
    remainingHp: 90, enemyKind: 'stalker', heavy: false, melee: true }).color, '#f4f1e6');
  assert.equal(one({ type: 'hit', x: 0, y: 0, angle: 0, value: 10, targetId: 1,
    remainingHp: 90, enemyKind: 'stalker', heavy: false, melee: true, skill: 'crusaderStrike' }).color, '#ffd100');
  assert.equal(one({ type: 'hit', x: 0, y: 0, angle: 0, value: 10, targetId: 1,
    remainingHp: 90, enemyKind: 'stalker', heavy: false, style: 'fire' }).color, PROJECTILE_COLORS.fire);
  // Crits pop bigger and carry the '!' flourish flag.
  const crit = one({ type: 'hit', x: 0, y: 0, angle: 0, value: 10, targetId: 1,
    remainingHp: 90, enemyKind: 'stalker', heavy: true });
  assert.equal(crit.crit, true);
  assert.ok(crit.size > 2);
  // Periodic ticks stay small and school-colored.
  const tick = one({ type: 'hit', x: 0, y: 0, angle: 0, value: 6, targetId: 1,
    remainingHp: 84, enemyKind: 'stalker', heavy: false, periodic: true, style: 'shadow' });
  assert.equal(tick.color, PROJECTILE_COLORS.shadow);
  assert.ok(tick.size < 2);
});
test('threat rows and the side list draw without a DOM', () => {
  const s = sim(), meter = new ThreatMeter();
  const a = target(s), b = s.spawnEnemy('hound', 60, 0)!;
  const pet = ghoul(s);
  meter.handleEvents([hit(a, 100), hit(b, 40), hit(b, 60, { allyId: pet.id })]);
  meter.update(s.enemies);
  const drawn: string[] = [];
  const ctx = {
    globalAlpha: 1, fillStyle: '', font: '', textAlign: 'left', textBaseline: 'alphabetic',
    direction: 'ltr', fontKerning: 'normal',
    save() {}, restore() {}, setTransform() {}, fillRect() {},
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    measureText: (v: string) => ({ width: v.length * 6, actualBoundingBoxAscent: 8 }),
    fillText(v: string) { drawn.push(v); },
  } as unknown as CanvasRenderingContext2D;
  const plate = { x: 100, y: 20, width: 240, height: 70 };
  const rowsHeight = drawThreatRows(ctx, meter, a, s.player, plate);
  assert.ok(rowsHeight > 0);
  assert.ok(drawn.some(v => v.includes('YOU')) && drawn.includes('100%'), `rows drew: ${drawn}`);
  const listHeight = drawThreatList(ctx, meter, s.enemies, s.player, 960, 600, 220);
  assert.ok(listHeight > 0);
  assert.ok(drawn.some(v => v.includes('STALKER')) && drawn.some(v => v.includes('HOUND')), `list drew: ${drawn}`);
  // No table, no draw.
  meter.reset();
  drawn.length = 0;
  assert.equal(drawThreatRows(ctx, meter, a, s.player, plate), 0);
  assert.equal(drawThreatList(ctx, meter, s.enemies, s.player, 960, 600, 220), 0);
});
