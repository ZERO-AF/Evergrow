import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { damageEnemy, damageCombatant } from '../src/combat-damage.ts';
import { advanceEnemyStatuses, applyEnemyBuff, dispelEnemyBuffs, absorbEnemyHit,
  enemyBuffDamageMultiplier, enemyHasteFactor, stolenBuffSpec, ENEMY_BUFFS } from '../src/combat-status.ts';
import { enemyWindupDuration, enemyRecoveryDuration } from '../src/enemy-threat.ts';
import { enemyTraitBuffs } from '../src/enemy-debuffs.ts';
import { createWowSim, equipForSkill, idleInput } from './fixtures/wow-sim.ts';
import type { Enemy, Input } from '../src/model.ts';
import type { SkillId } from '../src/character-types.ts';

const idle: Input = idleInput;
function advance(sim: Simulation, seconds: number, input: Partial<Input> = {}): void {
  for (let tick = 0; tick < Math.round(seconds / FIXED_STEP); tick++) sim.update(FIXED_STEP, { ...idle, ...input });
}
function target(sim: Simulation, kind: Enemy['kind'] = 'brute', x = 60, rank: Enemy['rank'] = 'normal'): Enemy {
  const enemy = sim.spawnEnemy(kind, x, 0, rank)!;
  enemy.state = 'recover'; enemy.stateDuration = 999;
  return enemy;
}
function learn(sim: Simulation, id: SkillId, slot = 0): void {
  equipForSkill(sim, id);
  sim.player.character.allocatedNodes.push(`wow-${sim.player.character.classId}-${id}`);
  sim.player.character.skillSlots[slot] = id;
}
const damageContext = (sim: Simulation, events: unknown[] = []) => ({
  player: sim.player, enemies: sim.enemies, random: () => 1, visible: () => true,
  emit: (event: never) => events.push(event), killed: () => {},
});

test('applyEnemyBuff adds catalog buffs, refreshes instead of stacking, and ignores the dead', () => {
  const sim = createWowSim();
  const enemy = target(sim);
  applyEnemyBuff(enemy, 'enrage');
  applyEnemyBuff(enemy, 'haste');
  assert.deepEqual(enemy.buffs!.map(b => 'kind' in b && b.kind), ['enrage', 'haste']);
  applyEnemyBuff(enemy, 'enrage', .8, 3);
  assert.equal(enemy.buffs!.length, 2);
  const enrage = enemy.buffs![0]!;
  assert.equal('kind' in enrage && enrage.power, .8, 'refresh keeps the strongest power');
  assert.equal(enrage.remaining, 12, 'refresh keeps the longest remaining duration');
  enemy.state = 'dead';
  applyEnemyBuff(enemy, 'shield');
  assert.equal(enemy.buffs!.length, 2, 'dead enemies gain no buffs');
});

test('spawn and engagement rules seed haste on skirmishers and shields on casters', () => {
  const sim = createWowSim();
  const hound = target(sim, 'hound'), stalker = target(sim, 'stalker');
  assert.equal(hound.buffs!.length, 1);
  assert.equal('kind' in hound.buffs![0]! && hound.buffs![0]!.kind, 'haste');
  assert.equal(stalker.buffs, undefined);
  const caster = target(sim, 'caster');
  assert.equal(caster.buffs, undefined, 'the ward is a reactive cast, not a spawn trait');
  damageEnemy(caster, 1, 0, false, damageContext(sim));
  const ward = caster.buffs![0]!;
  assert.equal('kind' in ward && ward.kind, 'shield');
  assert.ok('kind' in ward && ward.absorbRemaining! > 0);
  assert.equal(caster.buffCast, true);
});

test('buffs tick down in advanceEnemyStatuses and expire cleanly', () => {
  const sim = createWowSim();
  const enemy = target(sim);
  applyEnemyBuff(enemy, 'enrage', .5, .3);
  advanceEnemyStatuses(enemy, .2, () => {});
  assert.ok(Math.abs(enemy.buffs![0]!.remaining - .1) < 1e-9);
  advanceEnemyStatuses(enemy, .2, () => {});
  assert.equal(enemy.buffs, undefined);
});

test('enrage multiplies damage dealt to the player through the combatant path', () => {
  const sim = createWowSim();
  const enemy = target(sim);
  const ctx = { player: sim.player, world: { isSanctuary: () => false }, random: () => 1, emit: () => {}, attacker: enemy };
  sim.player.hp = sim.player.maxHp;
  damageCombatant(10, 0, enemy.level, 'physical', ctx, enemy.kind, true);
  const base = sim.player.maxHp - sim.player.hp;
  applyEnemyBuff(enemy, 'enrage');
  sim.player.hp = sim.player.maxHp; sim.player.dead = false;
  damageCombatant(10, 0, enemy.level, 'physical', ctx, enemy.kind, true);
  const enraged = sim.player.maxHp - sim.player.hp;
  assert.ok(base > 0 && Math.abs(enraged - base * (1 + ENEMY_BUFFS.enrage.power)) <= 1, `${enraged} vs ${base * 1.5}`);
  assert.equal(enemyBuffDamageMultiplier(enemy), 1.5);
});

test('haste shortens windup and recovery through the shared duration helpers', () => {
  const sim = createWowSim();
  const enemy = target(sim);
  const windup = enemyWindupDuration(enemy, 1), recovery = enemyRecoveryDuration(enemy, 1);
  applyEnemyBuff(enemy, 'haste');
  assert.equal(enemyHasteFactor(enemy), 1.3);
  assert.ok(Math.abs(enemyWindupDuration(enemy, 1) - windup / 1.3) < 1e-9);
  assert.ok(Math.abs(enemyRecoveryDuration(enemy, 1) - recovery / 1.3) < 1e-9);
});

test('shield buffs absorb post-mitigation damage before health and report the soak', () => {
  const sim = createWowSim();
  const enemy = target(sim);
  enemy.hp = enemy.maxHp = 400;
  applyEnemyBuff(enemy, 'shield'); // 25% of maxHp = 100 absorb
  const events: { type: string; value?: number; blocked?: string }[] = [];
  damageEnemy(enemy, 60, 0, false, damageContext(sim, events));
  assert.equal(enemy.hp, 400, 'the ward ate the whole hit');
  assert.equal(absorbEnemyHit(enemy, 0), 0);
  assert.ok(events.some(e => e.type === 'block' && e.blocked === 'absorb' && e.value === 60));
  damageEnemy(enemy, 60, 0, false, damageContext(sim, events));
  assert.equal(enemy.hp, 380, 'only the drained remainder reaches health');
  assert.equal(enemy.buffs![0]!.remaining > 0, true, 'the buff persists until its duration ends');
});

test('wounded elites enrage once; purging it never lets it re-fire', () => {
  const sim = createWowSim();
  const elite = target(sim, 'brute', 60, 'elite');
  elite.hp = elite.maxHp * .3;
  advanceEnemyStatuses(elite, FIXED_STEP, () => {});
  assert.equal('kind' in elite.buffs![0]! && elite.buffs![0]!.kind, 'enrage');
  assert.equal(elite.enrageUsed, true);
  dispelEnemyBuffs(elite, 1);
  assert.equal(elite.buffs, undefined);
  advanceEnemyStatuses(elite, FIXED_STEP, () => {});
  assert.equal(elite.buffs, undefined, 'a purged enrage stays purged');
  const normal = target(sim);
  normal.hp = 1;
  advanceEnemyStatuses(normal, FIXED_STEP, () => {});
  assert.equal(normal.buffs, undefined, 'ordinary ranks never enrage');
});

test('purge strips up to two buffs and silences the target', () => {
  const sim = createWowSim('shaman');
  learn(sim, 'purge');
  const enemy = target(sim);
  applyEnemyBuff(enemy, 'enrage'); applyEnemyBuff(enemy, 'haste'); applyEnemyBuff(enemy, 'shield');
  sim.player.targetId = enemy.id;
  advance(sim, FIXED_STEP, { skillSlot: 0, skillPressed: true });
  assert.equal(enemy.buffs!.length, 1, 'purge removed exactly two buffs');
  assert.equal('kind' in enemy.buffs![0]! && enemy.buffs![0]!.kind, 'shield');
  assert.ok(enemy.cc?.some(c => c.kind === 'silence'), 'purge still silences');
  assert.ok(sim.drainEvents().some(e => e.type === 'notice' && e.message.includes('Dispelled')));
});

test('dispel magic strips one enemy buff while keeping its self-cleanse heal', () => {
  const sim = createWowSim('priest');
  learn(sim, 'dispelMagic');
  const enemy = target(sim);
  applyEnemyBuff(enemy, 'enrage'); applyEnemyBuff(enemy, 'haste');
  sim.player.targetId = enemy.id;
  sim.player.hp = sim.player.maxHp - 100;
  advance(sim, FIXED_STEP, { skillSlot: 0, skillPressed: true });
  assert.deepEqual(enemy.buffs!.map(b => 'kind' in b && b.kind), ['haste']);
  assert.ok(sim.player.hp > sim.player.maxHp - 100, 'the self-heal still lands');
});

test('spellsteal transfers the first buff to the caster for its remaining duration', () => {
  const sim = createWowSim('mage');
  learn(sim, 'spellSteal');
  const enemy = target(sim);
  applyEnemyBuff(enemy, 'enrage'); applyEnemyBuff(enemy, 'shield');
  sim.player.targetId = enemy.id;
  advance(sim, FIXED_STEP, { skillSlot: 0, skillPressed: true });
  assert.deepEqual(enemy.buffs!.map(b => 'kind' in b && b.kind), ['shield'], 'only the stolen buff left the enemy');
  const stolen = sim.player.buffs?.find(b => b.id === 'spellSteal:steal');
  assert.ok(stolen, 'the caster carries the stolen buff');
  assert.equal(stolen!.name, 'Enrage');
  assert.equal(stolen!.stats?.damagePercent, 50);
  assert.ok(stolen!.remaining > 11 && stolen!.remaining <= 12);
  assert.ok(sim.drainEvents().some(e => e.type === 'notice' && e.message === 'Stole Enrage'));
});

test('spellsteal on a buffless target grants nothing and says so', () => {
  const sim = createWowSim('mage');
  learn(sim, 'spellSteal');
  const enemy = target(sim);
  sim.player.targetId = enemy.id;
  advance(sim, FIXED_STEP, { skillSlot: 0, skillPressed: true });
  assert.equal(sim.player.buffs?.some(b => b.id === 'spellSteal:steal') ?? false, false);
  assert.ok(sim.drainEvents().some(e => e.type === 'notice' && e.message === 'Nothing to steal.'));
});

test('mass dispel strips one buff from every enemy in the area', () => {
  const sim = createWowSim('priest');
  learn(sim, 'massDispel');
  const a = target(sim, 'brute', 60), b = target(sim, 'stalker', 90);
  applyEnemyBuff(a, 'enrage'); applyEnemyBuff(a, 'haste'); applyEnemyBuff(b, 'enrage');
  sim.player.targetId = a.id;
  advance(sim, FIXED_STEP, { skillSlot: 0, skillPressed: true });
  assert.ok(sim.player.cast, 'mass dispel is a cast-time cleanse');
  advance(sim, .7);
  assert.deepEqual(a.buffs!.map(x => 'kind' in x && x.kind), ['haste']);
  assert.equal(b.buffs, undefined);
});

test('stolen shields become absorb pools scaled to the caster', () => {
  const sim = createWowSim('mage');
  const enemy = target(sim);
  enemy.maxHp = 1000;
  applyEnemyBuff(enemy, 'shield');
  const buff = enemy.buffs![0]!;
  assert.equal('kind' in buff && buff.absorbRemaining, 250);
  const spec = stolenBuffSpec(buff as never, sim.player.maxHp);
  assert.ok(spec.absorb! > 0 && spec.absorb! <= .5);
  assert.equal(spec.duration, buff.remaining);
});

test('enemy buffs surface on the target effect strip', () => {
  const sim = createWowSim();
  const enemy = target(sim);
  applyEnemyBuff(enemy, 'enrage');
  const strip = enemyTraitBuffs(enemy);
  const badge = strip.find(b => b.id === 'buff:enrage');
  assert.ok(badge, 'enrage shows on the target plate strip');
  assert.equal(badge!.name, 'Enrage');
  assert.ok(badge!.remaining > 0);
});
