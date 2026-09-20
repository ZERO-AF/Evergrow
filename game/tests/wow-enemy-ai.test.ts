import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { updateEnemyAI, type EnemyAIContext } from '../src/enemy-ai.ts';
import { applyCc } from '../src/combat-status.ts';
import { alertEnemy } from '../src/enemy-state.ts';
import type { Ally, Enemy } from '../src/model.ts';

const world = { seed: 1, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
function ally(id: number, x: number, y: number): Ally {
  return { id, kind: 'wolf', x, y, prevX: x, prevY: y, angle: 0, hp: 40, maxHp: 40, damage: 5, stationary: false, targetId: null, attackCooldown: 0, radius: 8 };
}
function fixture() {
  const sim = new Simulation(world, { spawn: false });
  sim.player.x = 0; sim.player.y = 0;
  const hits: { amount: number; ally?: number }[] = [];
  const context: EnemyAIContext = {
    world, player: sim.player, enemies: sim.enemies, time: 0, trial: null, visible: () => true,
    move: (e, vx, vy, dt) => { e.x += vx * dt; e.y += vy * dt; },
    hurt: amount => hits.push({ amount }),
    hurtAlly: (a, amount) => hits.push({ amount, ally: a.id }),
    shoot: () => {}, emit: () => {},
  };
  // Mirrors Simulation.updateEnemies: the clock advances stateTime before AI runs.
  const tick = (e: Enemy) => { context.time += 1 / 120; e.stateTime += 1 / 120; updateEnemyAI(e, 1 / 120, context); };
  return { sim, context, hits, tick };
}
function aggro(e: Enemy) {
  e.state = 'chase'; e.stateTime = 0; e.awareness = 1; e.seesPlayer = true; e.senseTime = 1;
}

test('enemies chase and hit a closer living ally instead of the player', () => {
  const { sim, context, hits, tick } = fixture();
  const pet = ally(7, 30, 0);
  sim.player.allies = [pet]; context.allies = sim.player.allies;
  const e = sim.spawnEnemy('stalker', 60, 0)!; aggro(e);
  for (let i = 0; i < 600 && hits.length === 0; i++) tick(e);
  assert.ok(hits.length > 0, 'ally in reach is attacked');
  assert.equal(hits[0].ally, 7, 'damage routes to the ally, not the player');
});

test('a dead ally never draws the enemy off the player', () => {
  const { sim, context, hits, tick } = fixture();
  const pet = ally(7, 20, 0); pet.hp = 0;
  sim.player.allies = [pet]; context.allies = sim.player.allies;
  const e = sim.spawnEnemy('stalker', 40, 0)!; aggro(e);
  for (let i = 0; i < 600 && hits.length === 0; i++) tick(e);
  assert.ok(hits.length > 0);
  assert.equal(hits[0].ally, undefined, 'player took the hit');
});

test('stealth shrinks the sense radius to the WoW bubble', () => {
  const { sim, tick } = fixture();
  sim.player.stealthed = true; sim.player.x = 100;
  const e = sim.spawnEnemy('stalker', 0, 0)!;
  for (let i = 0; i < 240; i++) tick(e);
  assert.equal(e.seesPlayer, false, 'stealthed player unseen at 100u');
  assert.equal(e.state === 'chase', false);
  sim.player.x = 20;
  for (let i = 0; i < 240; i++) tick(e);
  assert.equal(e.seesPlayer, true, 'seen inside stealthSenseRadius');
});

test('root holds position but still permits a committed melee swing', () => {
  const { sim, hits, tick } = fixture();
  const e = sim.spawnEnemy('stalker', 30, 0)!; aggro(e);
  applyCc(e, 'root', 5);
  const x0 = e.x;
  for (let i = 0; i < 600 && hits.length === 0; i++) tick(e);
  assert.ok(hits.length > 0, 'rooted enemy still attacks in reach');
  assert.equal(e.x, x0, 'rooted enemy never moved');
});

test('fear wanders away and suppresses attacks', () => {
  const { sim, hits, tick } = fixture();
  const e = sim.spawnEnemy('stalker', 30, 0)!; aggro(e);
  applyCc(e, 'fear', 2);
  for (let i = 0; i < 240; i++) tick(e);
  assert.equal(hits.length, 0, 'feared enemy never attacks');
  assert.ok(e.x > 30, 'feared enemy fled from the player');
});

test('incapacitate suspends movement and attacks', () => {
  const { sim, hits, tick } = fixture();
  const e = sim.spawnEnemy('stalker', 30, 0)!; aggro(e);
  applyCc(e, 'incapacitate', 2, true);
  const x0 = e.x;
  for (let i = 0; i < 240; i++) tick(e);
  assert.equal(hits.length, 0);
  assert.equal(e.x, x0);
});

test('silence locks out ranged attacks but not basic melee', () => {
  const { sim, hits, tick } = fixture();
  const ranged = sim.spawnEnemy('archer', 200, 0)!; aggro(ranged);
  applyCc(ranged, 'silence', 5);
  for (let i = 0; i < 600; i++) tick(ranged);
  assert.equal(hits.length, 0, 'silenced archer never shoots');
  const melee = sim.spawnEnemy('stalker', 30, 0)!; aggro(melee);
  applyCc(melee, 'silence', 5);
  for (let i = 0; i < 600 && hits.length === 0; i++) tick(melee);
  assert.ok(hits.length > 0, 'silenced melee enemy still swings');
});

test('taunt pins the target to the player over a closer ally', () => {
  const { sim, context, hits, tick } = fixture();
  const pet = ally(7, 20, 0);
  sim.player.allies = [pet]; context.allies = sim.player.allies;
  const e = sim.spawnEnemy('stalker', 40, 0)!; aggro(e);
  e.taunted = { remaining: 3 }; alertEnemy(e, sim.player);
  for (let i = 0; i < 600 && hits.length === 0; i++) tick(e);
  assert.ok(hits.length > 0);
  assert.equal(hits[0].ally, undefined, 'taunted enemy hits the player');
});
