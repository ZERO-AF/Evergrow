import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { updateEnemyAI, type EnemyAIContext } from '../src/enemy-ai.ts';
import {
  recordHealThreat, recordThreat, resetThreatTables, resolveThreatHolder, threatTable, tickThreat,
} from '../src/enemy-threat.ts';
import type { Ally, Enemy, EnemyKind } from '../src/model.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const sim = () => new Simulation(world, { spawn: false });

/** A live enemy already committed to the fight. */
function engaged(s: Simulation, kind: EnemyKind = 'stalker', x = 0, y = 0): Enemy {
  const enemy = s.spawnEnemy(kind, x, y)!;
  enemy.hp = enemy.maxHp = 10000;
  enemy.state = 'chase';
  enemy.awareness = 1;
  enemy.seesPlayer = true;
  enemy.senseTime = 1;
  enemy.homeX = x; enemy.homeY = y;
  return enemy;
}

function ally(s: Simulation, kind: Ally['kind'], x: number, y: number, id = 900): Ally {
  const a: Ally = { id, kind, x, y, prevX: x, prevY: y, angle: 0, hp: 50, maxHp: 50,
    damage: 5, stationary: false, targetId: null, attackCooldown: 0, radius: 11 };
  s.player.allies = [...(s.player.allies ?? []), a];
  return a;
}

function aiContext(s: Simulation, moves: { vx: number; vy: number }[] = []): EnemyAIContext {
  return {
    player: s.player,
    players: [s.player],
    allies: s.player.allies ?? [],
    hurtAlly: () => {},
    enemies: s.enemies,
    world: s.world,
    time: 0,
    trial: null,
    visible: () => true,
    move: (enemy, vx, vy, dt) => { moves.push({ vx, vy }); enemy.x += vx * dt; enemy.y += vy * dt; },
    hurt: () => {},
    shoot: () => {},
    emit: () => {},
  };
}

test('damage threat accrues and the pull threshold gates aggro', () => {
  resetThreatTables();
  const s = sim(), enemy = engaged(s);
  s.player.x = 60; s.player.y = 0;
  const pet = ally(s, 'ghoul', -140, 0);
  const ctx = aiContext(s);
  recordThreat(enemy, 'player', 100);
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.equal(resolveThreatHolder(enemy, [s.player], [pet]), 'player');
  // Below the 110% melee pull line the pet does not pull.
  recordThreat(enemy, `ally:${pet.id}`, 109);
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.equal(resolveThreatHolder(enemy, [s.player], [pet]), 'player');
  // Crossing it pulls aggro to the pet.
  recordThreat(enemy, `ally:${pet.id}`, 2);
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.equal(resolveThreatHolder(enemy, [s.player], [pet]), `ally:${pet.id}`);
});

test('the enemy chases the threat holder instead of the nearest hostile', () => {
  resetThreatTables();
  const s = sim(), enemy = engaged(s);
  s.player.x = 60; s.player.y = 0;          // nearest
  const pet = ally(s, 'ghoul', -140, 0);    // farther
  const moves: { vx: number; vy: number }[] = [];
  const ctx = aiContext(s, moves);
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.ok(moves.length > 0 && moves.at(-1)!.vx > 0, 'nearest fallback chases the player');
  // Pet out-threats the empty table: any positive threat takes the mob.
  recordThreat(enemy, `ally:${pet.id}`, 50);
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.ok(moves.at(-1)!.vx < 0, 'threat holder pulls the enemy toward the pet');
});

test('ranged attackers pull at 130% instead of 110%', () => {
  resetThreatTables();
  const s = sim(), enemy = engaged(s);
  s.player.x = 60; s.player.y = 0;
  const imp = ally(s, 'imp', -200, 0); // imp template attacks at range
  const ctx = aiContext(s);
  recordThreat(enemy, 'player', 100);
  updateEnemyAI(enemy, 1 / 120, ctx);
  recordThreat(enemy, `ally:${imp.id}`, 125); // past 110%, short of 130%
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.equal(resolveThreatHolder(enemy, [s.player], [imp]), 'player');
  recordThreat(enemy, `ally:${imp.id}`, 6);   // 131 > 130%
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.equal(resolveThreatHolder(enemy, [s.player], [imp]), `ally:${imp.id}`);
});

test('taunt pins the target and snapshots threat to the top', () => {
  resetThreatTables();
  const s = sim(), enemy = engaged(s);
  s.player.x = 60; s.player.y = 0;
  const pet = ally(s, 'ghoul', -140, 0);
  const moves: { vx: number; vy: number }[] = [];
  const ctx = aiContext(s, moves);
  recordThreat(enemy, `ally:${pet.id}`, 200);
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.equal(resolveThreatHolder(enemy, [s.player], [pet]), `ally:${pet.id}`);
  // Player taunt: pins the player and pegs player threat to the top.
  enemy.taunted = { remaining: 3 };
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.equal(threatTable(enemy)!.entries.get('player:0'), 200);
  assert.ok(moves.at(-1)!.vx > 0, 'taunted enemy turns to the player');
  // Taunt expires: the snapshot keeps the player on top.
  delete enemy.taunted;
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.equal(resolveThreatHolder(enemy, [s.player], [pet]), 'player:0');
});

test('a pet growl pins the enemy on the pet', () => {
  resetThreatTables();
  const s = sim(), enemy = engaged(s);
  s.player.x = 60; s.player.y = 0;
  const pet = ally(s, 'ghoul', -140, 0);
  const moves: { vx: number; vy: number }[] = [];
  const ctx = aiContext(s, moves);
  recordThreat(enemy, 'player', 100);
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.ok(moves.at(-1)!.vx > 0);
  enemy.taunted = { remaining: 4, allyId: pet.id };
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.equal(threatTable(enemy)!.entries.get(`ally:${pet.id}`), 100);
  assert.ok(moves.at(-1)!.vx < 0, 'growl turns the enemy to the pet');
});

test('threat decays out of combat and dead combatants drop off', () => {
  resetThreatTables();
  const s = sim(), enemy = engaged(s);
  const pet = ally(s, 'ghoul', -140, 0);
  recordThreat(enemy, 'player', 100);
  recordThreat(enemy, `ally:${pet.id}`, 50);
  enemy.state = 'idle'; enemy.awareness = 0;
  tickThreat(enemy, 1, [s.player], [pet]);
  assert.equal(threatTable(enemy)!.entries.get('player'), 75);
  tickThreat(enemy, 4, [s.player], [pet]);
  assert.equal(threatTable(enemy), undefined, 'fully decayed tables drop');
  // A dead ally leaves the table entirely.
  recordThreat(enemy, 'player', 100);
  recordThreat(enemy, `ally:${pet.id}`, 50);
  pet.hp = 0;
  tickThreat(enemy, 0, [s.player], [pet]);
  assert.equal(threatTable(enemy)!.entries.has(`ally:${pet.id}`), false);
  // Leashing home unaware wipes the table like a WoW evade.
  enemy.state = 'return'; enemy.awareness = 0;
  tickThreat(enemy, 0, [s.player], [pet]);
  assert.equal(threatTable(enemy), undefined);
});

test('a dead player cannot hold aggro', () => {
  resetThreatTables();
  const s = sim(), enemy = engaged(s);
  s.player.x = 60; s.player.y = 0;
  const pet = ally(s, 'ghoul', -140, 0);
  const ctx = aiContext(s);
  recordThreat(enemy, 'player', 100);
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.equal(resolveThreatHolder(enemy, [s.player], [pet]), 'player');
  s.player.dead = true;
  recordThreat(enemy, `ally:${pet.id}`, 10);
  updateEnemyAI(enemy, 1 / 120, ctx);
  assert.equal(resolveThreatHolder(enemy, [s.player], [pet]), `ally:${pet.id}`);
});

test('healing adds threat at half rate across engaged enemies', () => {
  resetThreatTables();
  const s = sim();
  const a = engaged(s), b = engaged(s, 'hound', 200, 0);
  recordHealThreat(s.enemies, 80, s.player);
  assert.equal(threatTable(a)!.entries.get('player:0'), 20);
  assert.equal(threatTable(b)!.entries.get('player:0'), 20);
  // Idle, unaware enemies are not in combat and get nothing.
  const c = s.spawnEnemy('wisp', 400, 0)!;
  recordHealThreat(s.enemies, 80, s.player);
  assert.equal(threatTable(c), undefined);
});
