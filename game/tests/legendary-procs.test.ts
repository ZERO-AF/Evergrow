import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { refreshCharacter } from '../src/character.ts';
import { damageEnemy, type EnemyDamageContext } from '../src/combat-damage.ts';
import { advanceSkillEffects } from '../src/player-skill-effects.ts';
import { generateItem, generateLegendary } from '../src/items.ts';
import { LEGENDARY_PROCS } from '../src/legendary-content.ts';
import { tryProc } from '../src/legendary-combat.ts';
import { itemTooltipMarkup, legendaryProcMarkup } from '../src/item-ui.ts';
import { WOW_LEGENDARIES } from '../src/item-naming.ts';
import { createWowSim, idleInput } from './fixtures/wow-sim.ts';
import type { Enemy } from '../src/model.ts';

function equip(sim: Simulation, legendaryId: string, level = 80) {
  const p = sim.player;
  p.character.equipped.weapon = generateLegendary(11, level, legendaryId);
  p.character.equipped.offhand = null;
  refreshCharacter(p);
  p.derived.critChance = 0;
  return p.character.equipped.weapon!;
}

function context(sim: Simulation, random: () => number, extra: Partial<EnemyDamageContext> = {}): EnemyDamageContext {
  return { player: sim.player, enemies: sim.enemies, random, visible: () => true, emit: () => {}, killed: () => {}, proc: tryProc, ...extra };
}

function target(sim: Simulation, x = 40, y = 0): Enemy {
  const enemy = sim.spawnEnemy('brute', x, y)!;
  enemy.state = 'recover'; enemy.stateDuration = 999;
  sim.drainEvents();
  return enemy;
}

test('every authored legendary generates with its fixed name, flavor and proc', () => {
  for (const legendary of WOW_LEGENDARIES) {
    const item = generateLegendary(31, 80, legendary.id);
    assert.equal(item.name, legendary.name, legendary.id);
    assert.equal(item.tier, 'legendary');
    assert.equal(item.flavor, legendary.flavor);
    if (legendary.slot === 'weapon' && LEGENDARY_PROCS[legendary.id]) assert.equal(item.recipe.procId, legendary.id);
  }
  assert.throws(() => generateLegendary(1, 80, 'not-a-legendary'), RangeError);
});

test('generic legendary weapons roll a proc matching their silhouette', () => {
  for (let seed = 0; seed < 40; seed++) {
    const item = generateItem(seed, 60, 'weapon', undefined, 'legendary');
    const proc = LEGENDARY_PROCS[item.recipe.procId ?? ''];
    assert.ok(proc, `seed ${seed} legendary weapon ${item.weapon!.family} has a proc`);
    assert.ok(proc.families === undefined || proc.families.includes(item.weapon!.family), `${proc.id} on ${item.weapon!.family}`);
    assert.ok(proc.hands === undefined || proc.hands === item.weapon!.hands, `${proc.id} on ${item.weapon!.hands}h`);
  }
  // Non-legendary weapons never roll procs.
  for (let seed = 0; seed < 20; seed++)
    assert.equal(generateItem(seed, 60, 'weapon', undefined, 'epic').recipe.procId, undefined);
});

test('Thunderfury procs chain nature damage, slow and exposure on direct hits', () => {
  const sim = createWowSim('warrior');
  equip(sim, 'thunderfury');
  const enemy = target(sim), near = target(sim, 90, 0), far = target(sim, 400, 0);
  // The attack table now covers proc hits; pin equal levels so the roll can't miss.
  for (const e of [enemy, near, far]) Object.assign(e, { level: 1 });
  enemy.hp = enemy.maxHp = near.hp = near.maxHp = far.hp = far.maxHp = 100000;
  damageEnemy(enemy, 100, 0, true, context(sim, () => 0));
  assert.ok(enemy.hp < 100000 - 100, 'proc dealt extra damage to the target');
  assert.ok(near.hp < 100000, 'chain hit a nearby enemy');
  assert.equal(far.hp, 100000, 'out-of-range enemy untouched');
  assert.ok(enemy.slowTime > 0 && enemy.slowFactor < 1, 'proc slowed the target');
  assert.ok(enemy.auraExposure?.nature && enemy.auraExposure.nature.power > 0, 'nature exposure applied');
});

test('proc chance and internal cooldown gate repeated hits', () => {
  const sim = createWowSim('warrior'), p = sim.player;
  const item = equip(sim, 'shadows-edge');
  const enemy = target(sim);
  enemy.hp = enemy.maxHp = 1000000;
  // random() >= chance: no proc, no dot.
  damageEnemy(enemy, 100, 0, true, context(sim, () => .99));
  assert.ok(!enemy.dots?.length, 'failed roll does not proc');
  // Successful roll applies the dot and starts the icd.
  damageEnemy(enemy, 100, 0, true, context(sim, () => 0));
  assert.ok(enemy.dots?.some(dot => dot.id === 'proc:shadows-edge'), 'dot applied');
  assert.ok(p.skillEffects!.procs![item.id].cooldown > 0, 'icd started');
  // Inside the icd even a perfect roll cannot re-proc.
  const dps = enemy.dots!.find(dot => dot.id === 'proc:shadows-edge')!.dps;
  enemy.dots = [];
  damageEnemy(enemy, 100, 0, true, context(sim, () => 0));
  assert.ok(!enemy.dots?.length, 'icd blocks the proc');
  // After the icd ticks down the next hit procs again.
  advanceSkillEffects(p, LEGENDARY_PROCS['shadows-edge'].internalCooldown + .1);
  damageEnemy(enemy, 100, 0, true, context(sim, () => 0));
  assert.ok(enemy.dots?.some(dot => dot.id === 'proc:shadows-edge' && dot.dps === dps), 'proc returns after icd');
});

test('periodic, ally and proc-sourced hits never roll procs', () => {
  const sim = createWowSim('warrior');
  equip(sim, 'frostmourne');
  const enemy = target(sim);
  enemy.hp = enemy.maxHp = 100000;
  const ctx = context(sim, () => 0);
  damageEnemy(enemy, 100, 0, false, ctx, true);
  assert.equal(enemy.hp, 99900, 'periodic hit: no proc damage');
  damageEnemy(enemy, 100, 0, true, ctx, false, undefined, undefined, { critChance: 0, critMultiplier: 1, lifeOnHit: 0, ally: true });
  assert.equal(enemy.hp, 99800, 'ally hit: no proc damage');
  damageEnemy(enemy, 100, 0, true, ctx, false, undefined, undefined, { critChance: 0, critMultiplier: 1, lifeOnHit: 0, proc: true });
  assert.equal(enemy.hp, 99700, 'proc-sourced hit: no re-proc');
  damageEnemy(enemy, 100, 0, true, ctx);
  assert.ok(enemy.hp < 99600, 'direct hit procs');
});

test('a proc that kills its target commits exactly one death', () => {
  const sim = createWowSim('warrior');
  equip(sim, 'frostmourne');
  const enemy = target(sim);
  enemy.hp = 1;
  let kills = 0, killEvents = 0;
  const ctx = context(sim, () => 0, { killed: () => kills++,
    emit: event => { if (event.type === 'kill') killEvents++; } });
  damageEnemy(enemy, 100, 0, true, ctx);
  assert.equal(kills, 1, 'killed callback ran once');
  assert.equal(killEvents, 1, 'one kill event emitted');
  assert.equal(enemy.state, 'dead');
});

test('Shadowmourne gathers souls and erupts at ten stacks', () => {
  const sim = createWowSim('warrior'), p = sim.player;
  const item = equip(sim, 'shadowmourne');
  const enemy = target(sim), near = target(sim, 80, 0);
  for (const e of [enemy, near]) Object.assign(e, { level: 1 });
  enemy.hp = enemy.maxHp = near.hp = near.maxHp = 1000000;
  const ctx = context(sim, () => 0);
  const procs = () => p.skillEffects!.procs![item.id];
  for (let i = 0; i < 9; i++) {
    damageEnemy(enemy, 100, 0, true, ctx);
    assert.equal(procs().stacks, i + 1);
    procs().cooldown = 0; // isolate the stacking rule from the icd
    assert.equal(near.hp, 1000000, 'no burst before the cap');
  }
  damageEnemy(enemy, 100, 0, true, ctx);
  assert.equal(procs().stacks, 0, 'stacks reset on eruption');
  assert.ok(near.hp < 1000000, 'soul eruption splashes nearby enemies');
});

test('Val\'anyr heals and raises an absorb shield', () => {
  const sim = createWowSim('priest'), p = sim.player;
  equip(sim, 'valanyr');
  p.hp = p.maxHp / 2;
  const enemy = target(sim);
  damageEnemy(enemy, 100, 0, true, context(sim, () => 0));
  assert.ok(p.hp > p.maxHp / 2, 'proc healed the wielder');
  const shield = p.buffs?.find(buff => buff.id === 'proc:valanyr');
  assert.ok(shield && shield.absorbRemaining! > 0, 'absorb shield raised');
});

test('projectile procs launch through the sim and fall back to direct damage headless', () => {
  const sim = createWowSim('hunter'), p = sim.player;
  equip(sim, 'thoridal');
  const enemy = target(sim, 300, 0);
  Object.assign(enemy, { level: 1 });
  enemy.hp = enemy.maxHp = 100000;
  // Headless context without a projectile owner: direct arcane hit.
  damageEnemy(enemy, 100, 0, false, context(sim, () => 0));
  assert.ok(enemy.hp < 100000 - 100, 'fallback direct hit landed');
  // With a projectile owner the proc launches a real projectile instead.
  let launched = 0;
  const ctx = context(sim, () => 0, { projectile: () => { launched++; return {} as never; } });
  p.skillEffects!.procs = {};
  const hp = enemy.hp;
  damageEnemy(enemy, 100, 0, false, ctx);
  assert.equal(launched, 1, 'projectile launched');
  assert.equal(enemy.hp, hp - 100, 'no double damage when the launch succeeds');
  // End-to-end: a real bow attack through the sim spawns the starfall bolt.
  const sim2 = createWowSim('hunter');
  equip(sim2, 'thoridal');
  (sim2 as unknown as { random: () => number }).random = () => 0;
  const enemy2 = target(sim2, 300, 0);
  Object.assign(enemy2, { level: 1 });
  enemy2.hp = enemy2.maxHp = 100000;
  let arcaneHits = 0, arrowHits = 0;
  for (let i = 0; i < 240; i++) {
    sim2.update(FIXED_STEP, { ...idleInput, attack: true, aimX: enemy2.x, aimY: enemy2.y });
    for (const event of sim2.drainEvents()) {
      if (event.type !== 'hit' || event.targetId !== enemy2.id) continue;
      if (event.style === 'arcane') arcaneHits++; else arrowHits++;
    }
  }
  assert.ok(arrowHits > 0, 'bow basics landed');
  assert.ok(arcaneHits > 0, 'starfall bolt landed as arcane damage');
});

test('tooltip renders the proc line in legendary orange', () => {
  const item = generateLegendary(5, 80, 'sulfuras');
  const markup = legendaryProcMarkup(item);
  assert.ok(markup.includes('Chance on hit:'), 'proc line present');
  assert.ok(markup.includes('#f0a16b'), 'legendary orange');
  const sim = createWowSim('warrior');
  const card = itemTooltipMarkup(item, { sheet: sim.player.character, level: 80, compare: false });
  assert.ok(card.includes('Chance on hit:'), 'card shows the proc');
  assert.ok(card.includes(LEGENDARY_PROCS['sulfuras'].text.slice(0, 30)), 'card shows the proc text');
  assert.equal(legendaryProcMarkup(generateItem(3, 60, 'weapon', 'longsword', 'common')), '', 'no proc line on ordinary items');
});
