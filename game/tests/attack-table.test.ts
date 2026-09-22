import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { damageEnemy, damageCombatant, attackTableRoll, ATTACK_TABLE } from '../src/combat-damage.ts';
import { itemFitsSlot, equipItem } from '../src/inventory.ts';
import { generateItem, createCharacterSheet } from '../src/items.ts';
import { deriveCharacterStats } from '../src/character-stats.ts';
import { refreshCharacter } from '../src/character.ts';
import { CombatEffects } from '../src/effects.ts';
import type { CombatEvent, Enemy } from '../src/model.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const sim = () => new Simulation(world, { spawn: false });
// Private particle storage; the same unchecked boundary the other effects tests use.
const storage = (effects: CombatEffects) => effects as unknown as { popups: Array<{ value: string }> };
const outcomes = (events: readonly CombatEvent[]) => events.flatMap(e => e.type === 'avoid' ? [e.outcome] : []);

/** A level-`level` stalker at (45,0) facing west — toward a player at the origin. */
function target(sim: Simulation, level: number, facing = Math.PI): Enemy {
  const enemy = sim.spawnEnemy('stalker', 45, 0)!;
  Object.assign(enemy, { level });
  enemy.angle = facing;
  enemy.hp = enemy.maxHp = 10000;
  return enemy;
}
const enemyContext = (sim: Simulation, roll: number, events: CombatEvent[]) =>
  ({ player: sim.player, enemies: sim.enemies, random: () => roll, visible: () => true, emit: (e: CombatEvent) => events.push(e), killed: () => {} });
const playerContext = (sim: Simulation, roll: number, events: CombatEvent[]) =>
  ({ player: sim.player, world: { isSanctuary: () => false }, random: () => roll, emit: (e: CombatEvent) => events.push(e) });

test('the attack table rolls miss, dodge, parry and glancing only against higher-level facing targets', () => {
  // Level 1 attacker vs level 3 target: miss .10, dodge .03, parry .03, glance .30.
  const roll = (r: number, facing = Math.PI) => attackTableRoll(() => r, 1, 3, facing, 0).outcome;
  assert.equal(roll(0.05), 'miss');
  assert.equal(roll(0.12), 'dodge');
  assert.equal(roll(0.14), 'parry');
  assert.equal(roll(0.3), 'glancing');
  assert.equal(roll(0.9), 'hit');
  // Attacks from behind cannot be dodged or parried; the same rolls land or glance.
  assert.equal(attackTableRoll(() => 0.12, 1, 3, 0, 0).outcome, 'glancing');
  assert.equal(attackTableRoll(() => 0.17, 1, 3, 0, 0).outcome, 'glancing');
  // Equal levels and no ratings: nothing can fail and no randomness is consumed.
  let draws = 0;
  assert.equal(attackTableRoll(() => { draws++; return 0; }, 3, 3, Math.PI, 0).outcome, 'hit');
  assert.equal(draws, 0);
  // Hit rating and expertise erase the corresponding slices.
  const rating = ATTACK_TABLE.ratingPerPercent;
  assert.equal(attackTableRoll(() => 0.02, 1, 3, Math.PI, 0, 10 * rating).outcome, 'dodge');
  assert.equal(attackTableRoll(() => 0.12, 1, 3, Math.PI, 0, 0, 3 * rating).outcome, 'glancing');
  assert.equal(attackTableRoll(() => 0.05, 1, 3, Math.PI, 0, 10 * rating, 6 * rating).outcome, 'glancing');
});

test('player melee misses, dodges and glances against higher-level enemies with seeded events', () => {
  const s = sim(), events: CombatEvent[] = [];
  const enemy = target(s, 3);
  // Miss: no damage, no hit event, one 'avoid' — but the target still alerts.
  damageEnemy(enemy, 100, 0, true, enemyContext(s, 0.05, events));
  assert.equal(enemy.hp, 10000);
  assert.deepEqual(events.map(e => e.type), ['avoid']);
  assert.deepEqual(outcomes(events), ['miss']);
  assert.notEqual(enemy.state, 'idle');
  // Dodge while facing the attacker.
  events.length = 0;
  damageEnemy(enemy, 100, 0, true, enemyContext(s, 0.12, events));
  assert.equal(enemy.hp, 10000);
  assert.deepEqual(outcomes(events), ['dodge']);
  // Behind the target the same roll glances for reduced damage instead.
  enemy.angle = 0;
  events.length = 0;
  damageEnemy(enemy, 100, 0, true, enemyContext(s, 0.12, events));
  assert.equal(enemy.hp, 10000 - Math.round(100 * ATTACK_TABLE.glanceDamage));
  const hit = events.find(e => e.type === 'hit');
  assert.ok(hit && hit.glancing === true);
  // Hit rating removes the miss slice entirely: the same roll glances instead.
  events.length = 0; enemy.hp = 10000;
  damageEnemy(enemy, 100, 0, true, enemyContext(s, 0.05, events), false, undefined, undefined,
    { critChance: 0, critMultiplier: 1, lifeOnHit: 0, hitRating: 10 * ATTACK_TABLE.ratingPerPercent });
  assert.equal(enemy.hp, 10000 - Math.round(100 * ATTACK_TABLE.glanceDamage));
  assert.deepEqual(outcomes(events), []);
});

test('equal-level melee always connects and consumes no extra randomness', () => {
  const s = sim(), events: CombatEvent[] = [];
  const enemy = target(s, 1);
  damageEnemy(enemy, 100, 0, true, enemyContext(s, 0, events));
  assert.equal(enemy.hp, 9900);
  assert.deepEqual(events.map(e => e.type), ['hit']);
  // Bolts and periodic ticks bypass the table even against higher-level targets.
  Object.assign(enemy, { level: 9 }); enemy.hp = 10000; events.length = 0;
  damageEnemy(enemy, 100, 0, false, enemyContext(s, 0, events));
  damageEnemy(enemy, 50, 0, true, enemyContext(s, 0, events), true);
  assert.equal(enemy.hp, 9850);
});

test('enemy melee can miss, glance or be dodged by a facing player', () => {
  const s = sim(), p = s.player, events: CombatEvent[] = [];
  p.level = 5; p.hp = p.maxHp = 10000; p.derived = { ...p.derived, armor: 0 };
  p.angle = Math.PI; // facing away from the attacker at angle π → no dodge/parry
  // Level 1 attacker vs level 5 player: miss .20, glance .40.
  assert.equal(damageCombatant(100, Math.PI, 1, 'physical', playerContext(s, 0.1, events), 'stalker', false, undefined, undefined, true), false);
  assert.equal(p.hp, 10000);
  assert.deepEqual(outcomes(events), ['miss']);
  const avoid = events.find(e => e.type === 'avoid');
  assert.ok(avoid && avoid.incoming === true);
  p.invulnerable = 0; events.length = 0;
  assert.equal(damageCombatant(100, Math.PI, 1, 'physical', playerContext(s, 0.5, events), 'stalker', false, undefined, undefined, true), true);
  assert.equal(p.hp, 10000 - Math.round(100 * ATTACK_TABLE.glanceDamage));
  // Facing the attacker unlocks dodge and parry.
  p.hp = 10000; p.invulnerable = 0; p.angle = 0; events.length = 0;
  assert.equal(damageCombatant(100, Math.PI, 1, 'physical', playerContext(s, 0.25, events), 'stalker', false, undefined, undefined, true), false);
  assert.deepEqual(outcomes(events), ['dodge']);
  // Non-melee physical damage (arrows, traps) never rolls the table.
  p.invulnerable = 0; events.length = 0;
  assert.equal(damageCombatant(100, Math.PI, 1, 'physical', playerContext(s, 0.1, events), 'stalker'), true);
  assert.equal(p.hp, 9900);
});

test('avoid and glancing events render as floating text', () => {
  const effects = new CombatEffects();
  effects.handleEvents([
    { type: 'avoid', outcome: 'miss', x: 10, y: 10, angle: 0, enemyKind: 'stalker' },
    { type: 'avoid', outcome: 'dodge', x: 10, y: 10, angle: 0, incoming: true, enemyKind: 'stalker' },
    { type: 'hit', x: 10, y: 10, angle: 0, value: 65, targetId: 1, remainingHp: 35, enemyKind: 'stalker', heavy: false, glancing: true },
  ]);
  const values = storage(effects).popups.map(p => p.value);
  assert.ok(values.includes('MISS'));
  assert.ok(values.includes('DODGE'));
  assert.ok(values.includes('GLANCING'));
  assert.ok(values.includes('65'));
});

test('hit rating and expertise derive from gear affixes', () => {
  const sheet = createCharacterSheet('warrior');
  const stats = deriveCharacterStats(sheet, { hitRating: 24, expertise: 16 });
  assert.equal(stats.hitRating, 24);
  assert.equal(stats.expertise, 16);
  const p = sim().player;
  p.character.equipped.ring1 = generateItem(11, 1, 'ring');
  p.character.equipped.ring1!.affixes = [{ name: 'Accuracy', stat: 'hitRating', value: 12 }];
  refreshCharacter(p);
  assert.equal(p.derived.hitRating, 12);
});

test('armor proficiency gates plate to plate classes and shields to shield classes', () => {
  const plate = generateItem(77, 10, 'chest', undefined, 'common', 'steel');
  assert.equal(plate.appearance.style, 'plate');
  assert.equal(itemFitsSlot(plate, 'chest', 'warrior'), true);
  assert.equal(itemFitsSlot(plate, 'chest', 'paladin'), true);
  assert.equal(itemFitsSlot(plate, 'chest', 'mage'), false);
  assert.equal(itemFitsSlot(plate, 'chest', 'rogue'), false);
  // Lighter armor still fits heavier classes; cloth fits everyone.
  const cloth = generateItem(78, 10, 'chest', undefined, 'common', 'silk');
  assert.equal(itemFitsSlot(cloth, 'chest', 'mage'), true);
  assert.equal(itemFitsSlot(cloth, 'chest', 'warrior'), true);
  const leather = generateItem(79, 10, 'chest', undefined, 'common', 'leather');
  assert.equal(itemFitsSlot(leather, 'chest', 'mage'), false);
  assert.equal(itemFitsSlot(leather, 'chest', 'druid'), true);
  // Cloaks are not proficiency-gated.
  const cloak = generateItem(80, 10, 'cloak');
  assert.equal(itemFitsSlot(cloak, 'cloak', 'mage'), true);
  // Shields: warrior/paladin/shaman only, beside the relic gate.
  const shield = generateItem(81, 10, 'shield', 'iron-buckler');
  for (const cls of ['warrior', 'paladin', 'shaman'] as const) assert.equal(itemFitsSlot(shield, 'offhand', cls), true, cls);
  for (const cls of ['mage', 'rogue', 'priest', 'hunter', 'warlock', 'druid', 'deathKnight'] as const)
    assert.equal(itemFitsSlot(shield, 'offhand', cls), false, cls);
  // End-to-end: a mage cannot equip plate or a shield; a warrior can.
  const mage = createCharacterSheet('mage');
  mage.inventory[0] = plate; mage.inventory[1] = shield;
  assert.equal(equipItem(mage, 0, 10).ok, false);
  assert.equal(equipItem(mage, 1, 10, 'offhand').ok, false);
  const warrior = createCharacterSheet('warrior');
  warrior.inventory[0] = plate; warrior.inventory[1] = shield;
  assert.equal(equipItem(warrior, 0, 10).ok, true);
  assert.equal(equipItem(warrior, 1, 10, 'offhand').ok, true);
});
