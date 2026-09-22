import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import type { EnemyAIContext } from '../src/enemy-ai.ts';
import type { CombatEvent, Enemy, WorldQuery } from '../src/model.ts';
import { dungeonRandom } from '../src/dungeon.ts';
import { raidBossLoot, raidLootTable, RAID_BOSS_LOOT, RAID_LOOT_TABLES } from '../src/raid-loot-content.ts';
import { setPieceOf } from '../src/item-set-content.ts';
import {
  RAID7_ENTRANCE_ID, RAID7_BOSS_MEMBER_ID, YOGG_RULES,
  isRaid7EntranceId, isRaid7Entrance, isRaid7Boss, raid7BossName,
  raid7ArenaFloor, raid7BossWarningSpec,
} from '../src/raid7-boss-content.ts';
import { updateRaid7Boss, raid7EnrageRemaining, raid7Voids } from '../src/raid7-boss.ts';

const emptyWorld: WorldQuery = {
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
};
const make = () => new Simulation(emptyWorld, { spawn: false, seed: 42 });

/** Minimal AI context: player parked near the boss, world open, events captured. */
function aiContext(sim: Simulation, events: CombatEvent[] = [], buffs: string[] = [], hurtTypes: string[] = [], now = { t: 0 }): EnemyAIContext {
  return {
    player: sim.player, enemies: sim.enemies, world: emptyWorld, time: now.t, trial: null,
    visible: () => true,
    move: (enemy, vx, vy, dt) => { enemy.x += vx * dt; enemy.y += vy * dt; },
    hurt: (amount, _angle, _actor, type) => { hurtTypes.push(type); sim.player.hp -= amount; },
    shoot: () => {},
    emit: event => events.push(event),
    addBuff: name => buffs.push(name),
  };
}

/** Mirrors the sim loop: stateTime advances before each AI tick; `now` advances with it. */
function tick(enemy: Enemy, context: EnemyAIContext, seconds: number, now: { t: number }, updater: (e: Enemy, dt: number, c: EnemyAIContext) => void): void {
  for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) {
    now.t += FIXED_STEP;
    context.time = now.t;
    enemy.stateTime += FIXED_STEP;
    updater(enemy, FIXED_STEP, context);
  }
}

const raid7Boss = (sim: Simulation): Enemy =>
  sim.spawnEnemy('warden', 0, -1050, 'elite', { campId: RAID7_ENTRANCE_ID, memberId: RAID7_BOSS_MEMBER_ID, lootSeed: 1 })!;

// ── Content / identity ────────────────────────────────────────────────────

test('raid7 entrance id, predicates and name are wired', () => {
  assert.equal(RAID7_ENTRANCE_ID, 'dungeon:raid:ulduar');
  assert.ok(isRaid7EntranceId(RAID7_ENTRANCE_ID));
  assert.ok(!isRaid7EntranceId('dungeon:raid:eye-of-eternity'));
  assert.ok(!isRaid7EntranceId('dungeon:raid:obsidian-sanctum'));
  assert.ok(isRaid7Entrance({ id: RAID7_ENTRANCE_ID }));
  assert.ok(!isRaid7Entrance({ id: 'dungeon:raid:icecrown-citadel' }));
  assert.ok(!isRaid7Entrance(null) && !isRaid7Entrance(undefined));
  const sim = make();
  const yogg = raid7Boss(sim);
  assert.ok(isRaid7Boss(yogg));
  assert.equal(raid7BossName(yogg), 'Yogg-Saron');
  // Wrong member id or wrong camp → not the raid boss.
  const other = sim.spawnEnemy('warden', 0, 0, 'elite', { campId: 'dungeon:raid:onyxia', memberId: 'warden', lootSeed: 2 })!;
  const add = sim.spawnEnemy('brute', 0, 0, 'normal', { campId: RAID7_ENTRANCE_ID, memberId: 'guardian:w:0', lootSeed: 3 })!;
  assert.ok(!isRaid7Boss(other) && !isRaid7Boss(add));
  assert.equal(raid7BossName(other), undefined);
});

test('raid7 arena floor carries the warden, wave-gated adds and the boss chest', () => {
  const floor = raid7ArenaFloor(99);
  assert.ok(Object.isFrozen(floor));
  assert.ok(Object.isFrozen(floor.members) && Object.isFrozen(floor.rooms) && Object.isFrozen(floor.chests));
  const warden = floor.members.find(m => m.id === 'warden')!;
  assert.equal(warden.kind, 'warden');
  assert.equal(warden.rank, 'elite');
  assert.equal(warden.room, 1);
  assert.equal(floor.members.filter(m => m.wave === 1).length, 8, 'Guardians + Corruptor Tentacles at 60%');
  assert.equal(floor.members.filter(m => m.wave === 2).length, 4, 'Immortal Guardians + Crushers at 30%');
  assert.equal(floor.chests.length, 3, 'two caches plus the boss chest');
  assert.equal(floor.rooms.length, 2);
  assert.equal(floor.edges.length, 1);
  assert.equal(floor.theme, 'astral');
  // Determinism: same seed, same floor.
  assert.deepEqual(raid7ArenaFloor(99).members.map(m => m.id), floor.members.map(m => m.id));
});

test('warning spec announces real Yogg-Saron spell names', () => {
  const sim = make();
  const yogg = raid7Boss(sim);
  yogg.bossMove = 'sweep';
  assert.equal(raid7BossWarningSpec(yogg)?.ability, 'Lunatic Gaze');
  yogg.bossMove = 'fracture';
  assert.equal(raid7BossWarningSpec(yogg)?.ability, 'Brain Link');
  yogg.bossMove = 'eruption';
  assert.equal(raid7BossWarningSpec(yogg)?.ability, 'Sara\'s Fervor');
  yogg.bossMove = 'rush';
  assert.equal(raid7BossWarningSpec(yogg)?.ability, 'Shadowy Barrier');
  yogg.bossMove = 'command'; yogg.attackVariant = 0;
  assert.equal(raid7BossWarningSpec(yogg)?.ability, 'Deafening Roar');
  yogg.attackVariant = 2;
  assert.equal(raid7BossWarningSpec(yogg)?.ability, 'Induce Madness');
  yogg.bossMove = 'summon'; yogg.attackVariant = 0; yogg.bossPhases = 1;
  assert.equal(raid7BossWarningSpec(yogg)?.ability, 'Guardians of Yogg-Saron');
  yogg.bossPhases = 2;
  assert.equal(raid7BossWarningSpec(yogg)?.ability, 'Immortal Guardians');
  yogg.bossMove = 'jab';
  assert.equal(raid7BossWarningSpec(yogg)?.ability, 'Psychosis');
  yogg.bossMove = 'bolt';
  assert.equal(raid7BossWarningSpec(yogg)?.ability, 'Shadow Bolt');
  // Non-raid enemies get no spec.
  const brute = sim.spawnEnemy('brute', 0, 0, 'normal')!;
  brute.bossMove = 'sweep';
  assert.equal(raid7BossWarningSpec(brute), undefined);
});

// ── Yogg-Saron mechanics ──────────────────────────────────────────────────

test('Yogg-Saron engages, commits attacks and transitions phases at 60% / 30%', () => {
  const sim = make();
  const boss = raid7Boss(sim);
  sim.player.x = 0; sim.player.y = -600; // inside awareness
  const now = { t: 0 };
  const ctx = aiContext(sim, [], [], [], now);
  tick(boss, ctx, .5, now, updateRaid7Boss);
  // Engaged: alertEnemy lands him in 'chase', and the same tick commits a move.
  assert.ok(boss.bossMove, 'a move is committed on engage');
  assert.equal(boss.state, 'windup');
  // Drive to 60%: the phase-1 summon flourish sets wave bit 1.
  boss.hp = boss.maxHp * .5;
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0;
  tick(boss, ctx, FIXED_STEP, now, updateRaid7Boss);
  assert.ok((boss.bossPhases ?? 0) & 1, 'wave bit 1 set at 60%');
  assert.equal(boss.bossMove, 'summon');
  // Drive to 30%: the descent into madness sets wave bit 2.
  boss.hp = boss.maxHp * .2;
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined;
  tick(boss, ctx, FIXED_STEP, now, updateRaid7Boss);
  assert.ok((boss.bossPhases ?? 0) & 2, 'wave bit 2 set at 30%');
});

test('phase-3 command casts become Induce Madness and whip the adds', () => {
  const sim = make();
  const boss = raid7Boss(sim);
  const guardian = sim.spawnEnemy('brute', -1400, -1200, 'normal', { campId: RAID7_ENTRANCE_ID, memberId: 'guardian:w:0', lootSeed: 5 })!;
  sim.player.x = 0; sim.player.y = -600;
  const now = { t: 0 };
  const ctx = aiContext(sim, [], [], [], now);
  tick(boss, ctx, .5, now, updateRaid7Boss); // engage
  boss.hp = boss.maxHp * .2; // phase 3
  // Commit until a 'command' lands — phase 3 marks it attackVariant 2.
  for (let i = 0; i < 20 && !(boss.bossMove === 'command' && boss.attackVariant === 2); i++) {
    boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined; boss.attackVariant = 0;
    tick(boss, ctx, FIXED_STEP, now, updateRaid7Boss);
  }
  assert.equal(boss.bossMove, 'command');
  assert.equal(boss.attackVariant, 2, 'Induce Madness marked');
  assert.equal(raid7BossWarningSpec(boss)?.ability, 'Induce Madness');
  // Run the cast: the madness whips the living guardian into the fight.
  tick(boss, ctx, 3, now, updateRaid7Boss);
  assert.equal(guardian.state, 'chase', 'Induce Madness alerts the adds');
});

test('Yogg-Saron enrages after the timer and leaves shadow voids', () => {
  const sim = make();
  const boss = raid7Boss(sim);
  sim.player.x = 0; sim.player.y = -600;
  const now = { t: 0 };
  const events: CombatEvent[] = [];
  const hurt: string[] = [];
  const ctx = aiContext(sim, events, [], hurt, now);
  tick(boss, ctx, .5, now, updateRaid7Boss); // engage at t≈0.5
  assert.ok(raid7EnrageRemaining(boss, now.t)! > 0);
  now.t += YOGG_RULES.enrageAfter + 1;
  tick(boss, ctx, 2, now, updateRaid7Boss);
  assert.ok(raid7EnrageRemaining(boss, now.t)! < 0, 'enrage timer expired');
  assert.ok(events.some(e => e.type === 'blast'), 'enrage pulse emits');
  assert.ok(hurt.length > 0, 'enrage pulse hurts');
  // Sara's Fervor leaves a void: force the move and run the attack.
  boss.hp = boss.maxHp * .5; // phase 1 — 'eruption' is in the rotation
  for (let i = 0; i < 20 && boss.bossMove !== 'eruption'; i++) {
    boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined;
    tick(boss, ctx, FIXED_STEP, now, updateRaid7Boss);
  }
  if (boss.bossMove === 'eruption') {
    tick(boss, ctx, 3, now, updateRaid7Boss); // windup + attack + linger
    assert.ok(raid7Voids(boss).length > 0, 'Sara\'s Fervor leaves a shadow void');
  }
});

// ── Loot ──────────────────────────────────────────────────────────────────

test('Yogg-Saron maps to his named loot table', () => {
  assert.equal(RAID_BOSS_LOOT[RAID7_ENTRANCE_ID], 'yoggsaron');
  assert.equal(raidLootTable(RAID7_ENTRANCE_ID)?.name, 'Cache of the Old God');
  assert.ok(RAID_LOOT_TABLES.yoggsaron.drops.some(d => d.kind === 'epic' && d.name === 'Kingsbane'));
  assert.ok(RAID_LOOT_TABLES.yoggsaron.drops.some(d => d.kind === 'epic' && d.name === 'Dark Edge of Depravity'));
  assert.equal(RAID_LOOT_TABLES.yoggsaron.bonus?.mount, 'chopper');
});

test('Yogg-Saron chest rolls Tier-8 head/chest pieces deterministically', () => {
  for (let i = 0; i < 12; i++) {
    const loot = raidBossLoot(RAID7_ENTRANCE_ID, dungeonRandom(4000 + i), 80, 'priest')!;
    assert.equal(loot.items.length, 3);
    for (const item of loot.items) {
      const piece = setPieceOf(item);
      if (piece) assert.ok(piece.kind === 'head' || piece.kind === 'chest',
        `Yogg-Saron set drop ${piece.id} must be a head or chest`);
    }
  }
  // Determinism: same seed, same haul.
  const a = raidBossLoot(RAID7_ENTRANCE_ID, dungeonRandom(77), 80, 'warlock')!;
  const b = raidBossLoot(RAID7_ENTRANCE_ID, dungeonRandom(77), 80, 'warlock')!;
  assert.deepEqual(a.items.map(i => i.id), b.items.map(i => i.id));
});
