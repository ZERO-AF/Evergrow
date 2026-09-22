import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { damageCombatant } from '../src/combat-damage.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import { WEAPON_PROFILES } from '../src/weapon-content.ts';
import type { Attack, CombatEvent, Enemy, DamageType } from '../src/model.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const idle = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const sim = () => new Simulation(world, { spawn: false });
const weapon = (id: string) => WEAPON_PROFILES.find(w => w.id === id)!;

/** A level-1 stalker at (45,0) facing west — toward a player at the origin. */
function target(sim: Simulation): Enemy {
  const enemy = sim.spawnEnemy('stalker', 45, 0)!;
  enemy.angle = Math.PI;
  enemy.hp = enemy.maxHp = 10000;
  return enemy;
}

/** Starts one basic attack, runs it to completion, returns the swing and events. */
function swing(sim: Simulation): { attack: Attack; events: CombatEvent[] } {
  sim.update(FIXED_STEP, { ...idle, attack: true });
  const attack = sim.player.attack;
  assert.ok(attack, 'the attack input started a swing');
  for (let i = 0; i < Math.ceil(attack.duration / FIXED_STEP) + 40; i++) sim.update(FIXED_STEP, idle);
  return { attack, events: sim.drainEvents() };
}

test('an imbue buff adds elemental damage to melee basics and styles the hit', () => {
  const s = sim(), p = s.player, enemy = target(s);
  const stats = deriveAttackStats(p.stats, p.equipment.mainHand);
  s.addBuff('Deadly Poison', '#7a9e4a', { duration: 120, imbue: { element: 'nature', fraction: 0.2 } });
  const { attack, events } = swing(s);
  assert.ok(Math.abs(attack.elementalDamage! - stats.damage * 0.2) < 1e-9);
  assert.ok(Math.abs(attack.damage - stats.damage * 1.2) < 1e-9);
  assert.equal(attack.style, 'nature');
  const hit = events.filter(e => e.type === 'hit').find(e => e.targetId === enemy.id);
  assert.ok(hit, 'the swing landed');
  assert.equal(hit!.style, 'nature');
  assert.ok((hit!.elementalValue ?? 0) > 0);
  assert.equal(enemy.hp, 10000 - Math.round(stats.damage * 1.2));
});

test('an imbue buff adds elemental damage to bolt basics; arrows carry none', () => {
  const s = sim(), p = s.player;
  p.equipment = { mainHand: weapon('cinder-wand'), offHand: null };
  const stats = deriveAttackStats(p.stats, p.equipment.mainHand);
  s.addBuff('Flametongue Weapon', '#e08a4a', { duration: 1800, imbue: { element: 'fire', fraction: 0.25 } });
  const enemy = target(s);
  const { attack, events } = swing(s);
  assert.equal(attack.projectile!.style, 'fire');
  assert.ok(Math.abs(attack.projectile!.elementalDamage! - stats.damage * 0.25) < 1e-9);
  const hit = events.filter(e => e.type === 'hit').find(e => e.targetId === enemy.id);
  assert.ok(hit, 'the bolt landed');
  assert.equal(hit!.style, 'fire');
  assert.ok((hit!.elementalValue ?? 0) > 0);

  const bow = sim(), bp = bow.player;
  bp.equipment = { mainHand: weapon('thorn-shortbow'), offHand: null };
  bow.addBuff('Deadly Poison', '#7a9e4a', { duration: 120, imbue: { element: 'nature', fraction: 0.2 } });
  const bowEnemy = target(bow);
  const bowSwing = swing(bow);
  assert.equal(bowSwing.attack.projectile!.style, 'arrow');
  assert.equal(bowSwing.attack.projectile!.elementalDamage, undefined);
  const arrowHit = bowSwing.events.filter(e => e.type === 'hit').find(e => e.targetId === bowEnemy.id);
  assert.ok(arrowHit, 'the arrow landed');
  assert.equal(arrowHit!.style, 'arrow');
  assert.equal(arrowHit!.elementalValue ?? 0, 0);
});

test('dual wield applies the imbue to both hands', () => {
  const s = sim(), p = s.player;
  p.equipment = { mainHand: weapon('longsword'), offHand: { kind: 'weapon', weapon: weapon('rondel-dagger') } };
  s.addBuff('Instant Poison', '#7a9e4a', { duration: 120, imbue: { element: 'nature', fraction: 0.2 } });
  const enemy = target(s);
  const main = swing(s), off = swing(s);
  assert.equal(main.attack.hand, 'main');
  assert.equal(off.attack.hand, 'off');
  for (const { attack, events } of [main, off]) {
    const stats = deriveAttackStats(p.stats, attack.weapon);
    assert.ok(Math.abs(attack.elementalDamage! - stats.damage * 0.2) < 1e-9);
    assert.ok(events.some(e => e.type === 'hit' && e.targetId === enemy.id && e.style === 'nature'));
  }
});

test('reflect buffs return post-mitigation damage to a live attacker only', () => {
  const s = sim(), p = s.player, enemy = target(s);
  p.buffs = [{ id: 'naturesGrasp', name: "Nature's Grasp", color: '#7a9e4a', remaining: 45, duration: 45, reflect: 0.5 }];
  const events: CombatEvent[] = [];
  const calls: Array<[Enemy, number, DamageType]> = [];
  const context = {
    player: p, world: { isSanctuary: () => false }, random: () => 0.5,
    emit: (e: CombatEvent) => events.push(e),
    attacker: enemy,
    strikeBack: (foe: Enemy, amount: number, type: DamageType) => { calls.push([foe, amount, type]); },
  };
  assert.equal(damageCombatant(40, 0, 1, 'physical', context, 'stalker', false, undefined, 'Stalker'), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]![0], enemy);
  assert.equal(calls[0]![1], (100 - p.hp) * 0.5, 'reflect is half the post-mitigation damage');
  assert.equal(calls[0]![2], 'physical');

  // Periodic ticks, dead or missing attackers, reflected strikes and expired buffs never reflect.
  p.invulnerable = 0; p.hp = 100;
  calls.length = 0;
  damageCombatant(40, 0, 1, 'physical', context, 'stalker', true);
  damageCombatant(40, 0, 1, 'physical', { ...context, attacker: { ...enemy, state: 'dead' as const } }, 'stalker');
  damageCombatant(40, 0, 1, 'physical', { ...context, reflected: true }, 'stalker');
  damageCombatant(40, 0, 1, 'physical', { ...context, attacker: undefined }, 'stalker');
  p.buffs[0]!.remaining = 0;
  damageCombatant(40, 0, 1, 'physical', context, 'stalker');
  assert.equal(calls.length, 0);
});

test('an enemy hit through the sim damages the attacker via the enemy-damage path', () => {
  const s = sim(), p = s.player, enemy = target(s);
  s.addBuff('Lightning Shield', '#8fd8f2', { duration: 300, reflect: 0.3 });
  s.takeDamage(40, Math.PI, 1, 'physical', 'stalker', 'Stalker', true, enemy);
  const taken = 100 - p.hp;
  assert.ok(taken > 0, 'the hit landed');
  assert.equal(enemy.hp, 10000 - Math.max(1, Math.round(taken * 0.3)));
  const events = s.drainEvents();
  assert.ok(events.some(e => e.type === 'hit' && e.targetId === enemy.id), 'the reflect emitted a hit event');
});
