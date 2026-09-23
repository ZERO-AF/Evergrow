import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import type { EnemyAIContext } from '../src/enemy-ai.ts';
import type { CombatEvent, Enemy, WorldQuery } from '../src/model.ts';
import { dungeonRandom } from '../src/dungeon.ts';
import { raidBossLoot, raidLootTable, RAID_BOSS_LOOT, RAID_LOOT_TABLES } from '../src/raid-loot-content.ts';
import { setPieceOf } from '../src/item-set-content.ts';
import { AuthoredWorld } from '../src/authored-world.ts';
import { zoneRect } from '../src/world-atlas.ts';
import {
  RAID5_ENTRANCE_ID, RAID5_BOSS_MEMBER_ID, MALYGOS_RULES,
  isRaid5EntranceId, isRaid5Entrance, isRaid5Boss, isRaid5Spark, raid5BossName,
  raid5ArenaFloor, raid5BossWarningSpec, RAID5_SPARK_IDS,
} from '../src/raid5-boss-content.ts';
import { updateRaid5Boss, raid5EnrageRemaining, raid5Rifts } from '../src/raid5-boss.ts';
import {
  RAID6_ENTRANCE_ID, RAID6_BOSS_MEMBER_ID, SARTH_RULES, SARTH_DRAKES,
  isRaid6EntranceId, isRaid6Entrance, isRaid6Boss, isSarthDrake, raid6BossName,
  raid6ArenaFloor, raid6BossWarningSpec, sartharionDrakesAlive,
} from '../src/raid6-boss-content.ts';
import { updateRaid6Boss, raid6EnrageRemaining } from '../src/raid6-boss.ts';

const emptyWorld: WorldQuery = {
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
};
const make = () => new Simulation(emptyWorld, { spawn: false, seed: 42 });


/** Minimal AI context: player parked near the boss, world open, events captured. */
function aiContext(sim: Simulation, events: CombatEvent[] = [], buffs: string[] = [], hurtTypes: string[] = [], now = { t: 0 }): EnemyAIContext {
  return {
    player: sim.player, players: [sim.player], enemies: sim.enemies, world: emptyWorld, time: now.t, trial: null,
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

const raid5Boss = (sim: Simulation): Enemy =>
  sim.spawnEnemy('warden', 0, -1050, 'elite', { campId: RAID5_ENTRANCE_ID, memberId: RAID5_BOSS_MEMBER_ID, lootSeed: 1 })!;
const raid6Boss = (sim: Simulation): Enemy =>
  sim.spawnEnemy('warden', 0, -1050, 'elite', { campId: RAID6_ENTRANCE_ID, memberId: RAID6_BOSS_MEMBER_ID, lootSeed: 1 })!;
const drake = (sim: Simulation, memberId: string, x: number, y: number): Enemy =>
  sim.spawnEnemy('stalker', x, y, 'veteran', { campId: RAID6_ENTRANCE_ID, memberId, lootSeed: 7 })!;

// ── Content / identity ────────────────────────────────────────────────────

test('raid5/6 entrance ids, predicates and names are wired', () => {
  assert.equal(RAID5_ENTRANCE_ID, 'dungeon:raid:eye-of-eternity');
  assert.equal(RAID6_ENTRANCE_ID, 'dungeon:raid:obsidian-sanctum');
  assert.ok(isRaid5EntranceId(RAID5_ENTRANCE_ID) && !isRaid5EntranceId(RAID6_ENTRANCE_ID));
  assert.ok(isRaid6EntranceId(RAID6_ENTRANCE_ID) && !isRaid6EntranceId(RAID5_ENTRANCE_ID));
  assert.ok(isRaid5Entrance({ id: RAID5_ENTRANCE_ID }) && isRaid6Entrance({ id: RAID6_ENTRANCE_ID }));
  const sim = make();
  const malygos = raid5Boss(sim), sarth = raid6Boss(sim);
  assert.ok(isRaid5Boss(malygos) && !isRaid5Boss(sarth));
  assert.ok(isRaid6Boss(sarth) && !isRaid6Boss(malygos));
  assert.equal(raid5BossName(malygos), 'Malygos');
  assert.equal(raid6BossName(sarth), 'Sartharion');
  // Spark and drake membership.
  const spark = sim.spawnEnemy('wisp', 0, 0, 'normal', { campId: RAID5_ENTRANCE_ID, memberId: 'spark:w', lootSeed: 2 })!;
  assert.ok(isRaid5Spark(spark) && !isRaid5Spark(malygos));
  const tenebron = drake(sim, 'drake:tenebron', -1150, -1250);
  assert.ok(isSarthDrake(tenebron) && !isSarthDrake(sarth));
  assert.equal(SARTH_DRAKES['drake:tenebron'], 'Tenebron');
});

test('raid5/6 arena floors carry the warden, wave-gated adds and the boss chest', () => {
  for (const [floor, entranceId, waveAdds] of [
    [raid5ArenaFloor(99), RAID5_ENTRANCE_ID, 14],
    [raid6ArenaFloor(99), RAID6_ENTRANCE_ID, 10],
  ] as const) {
    assert.ok(Object.isFrozen(floor));
    const warden = floor.members.find(m => m.id === 'warden')!;
    assert.equal(warden.kind, 'warden');
    assert.equal(warden.rank, 'elite');
    assert.equal(floor.members.filter(m => m.wave === 1 || m.wave === 2).length, waveAdds, `${entranceId} wave-gated adds`);
    assert.equal(floor.chests.length, 3, 'two caches plus the boss chest');
    assert.equal(floor.rooms.length, 2);
    assert.equal(floor.edges.length, 1);
  }
  // Sartharion's drakes are ordinary members — never wave-gated.
  const sarthFloor = raid6ArenaFloor(99);
  for (const id of Object.keys(SARTH_DRAKES)) {
    const d = sarthFloor.members.find(m => m.id === id)!;
    assert.ok(d, `${id} on the floor`);
    assert.equal(d.wave, undefined, 'drakes are not wave-gated');
    assert.equal(d.rank, 'veteran');
  }
  // Malygos's sparks ride wave bit 1 (phase 2) and bit 2 (phase 3).
  const malyFloor = raid5ArenaFloor(99);
  for (const id of Object.keys(RAID5_SPARK_IDS)) {
    const s = malyFloor.members.find(m => m.id === id)!;
    assert.ok(s.wave === 1 || s.wave === 2, `${id} is wave-gated`);
  }
});

test('authored world maps Eye of Eternity and Obsidian Sanctum to the new raid ids', () => {
  const world = new AuthoredWorld(7319);
  const borean = zoneRect('borean-tundra')!;
  const eoe = world.getDungeonEntrances(borean.x, borean.y, borean.w, borean.h).find(e => e.name === 'Eye of Eternity');
  assert.ok(eoe, 'Eye of Eternity entrance exists in Borean Tundra');
  assert.equal(eoe!.id, RAID5_ENTRANCE_ID);
  // Dragonblight is wider than the 100k world-query cap; query the band holding the Sanctum.
  const blight = zoneRect('dragonblight')!;
  const os = world.getDungeonEntrances(blight.x + blight.w * .4, blight.y + blight.h * .3, blight.w * .4, blight.h * .5)
    .find(e => e.name === 'Obsidian Sanctum');
  assert.ok(os, 'Obsidian Sanctum entrance exists in Dragonblight');
  assert.equal(os!.id, RAID6_ENTRANCE_ID);
  world.dispose();
});

test('warning specs announce real spell names', () => {
  const sim = make();
  const malygos = raid5Boss(sim), sarth = raid6Boss(sim);
  malygos.bossMove = 'command';
  assert.equal(raid5BossWarningSpec(malygos)?.ability, 'Vortex');
  malygos.bossMove = 'summon'; malygos.attackVariant = 2;
  assert.equal(raid5BossWarningSpec(malygos)?.ability, 'Shatter');
  malygos.attackVariant = 0;
  assert.equal(raid5BossWarningSpec(malygos)?.ability, 'Nexus Lords');
  sarth.bossMove = 'sweep';
  assert.equal(raid6BossWarningSpec(sarth)?.ability, 'Cleave');
  sarth.bossMove = 'command';
  assert.equal(raid6BossWarningSpec(sarth)?.ability, 'Twilight Revenge');
  sarth.bossMove = 'summon'; sarth.bossPhases = 2;
  assert.equal(raid6BossWarningSpec(sarth)?.ability, 'Onyx Guardians');
  // Non-raid enemies get no spec.
  const brute = sim.spawnEnemy('brute', 0, 0, 'normal')!;
  brute.bossMove = 'sweep';
  assert.equal(raid5BossWarningSpec(brute), undefined);
  assert.equal(raid6BossWarningSpec(brute), undefined);
});

// ── Malygos mechanics ─────────────────────────────────────────────────────

test('Malygos engages, commits attacks and transitions phases at 50% / 25%', () => {
  const sim = make();
  const boss = raid5Boss(sim);
  sim.player.x = 0; sim.player.y = -600; // inside awareness
  const now = { t: 0 };
  const ctx = aiContext(sim, [], [], [], now);
  tick(boss, ctx, .5, now, updateRaid5Boss);
  // Engaged: alertEnemy lands him in 'chase', and the same tick commits a move.
  assert.ok(boss.bossMove, 'a move is committed on engage');
  assert.equal(boss.state, 'windup');
  // Drive to 50%: the phase-1 summon flourish sets wave bit 1.
  boss.hp = boss.maxHp * .4;
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0;
  tick(boss, ctx, FIXED_STEP, now, updateRaid5Boss);
  assert.ok((boss.bossPhases ?? 0) & 1, 'wave bit 1 set at 50%');
  assert.equal(boss.bossMove, 'summon');
  // Drive to 25%: the platform shatter sets wave bit 2.
  boss.hp = boss.maxHp * .2;
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined;
  tick(boss, ctx, FIXED_STEP, now, updateRaid5Boss);
  assert.ok((boss.bossPhases ?? 0) & 2, 'wave bit 2 set at 25%');
  assert.equal(boss.attackVariant, 2, 'shatter flourish marked');
});

test('killing a Power Spark grants the stacking damage buff', () => {
  const sim = make();
  const boss = raid5Boss(sim);
  sim.player.x = 0; sim.player.y = -600;
  const now = { t: 0 };
  const buffs: string[] = [];
  const ctx = aiContext(sim, [], buffs, [], now);
  tick(boss, ctx, .5, now, updateRaid5Boss); // engage
  const spark = sim.spawnEnemy('wisp', 100, -600, 'normal', { campId: RAID5_ENTRANCE_ID, memberId: 'spark:w', lootSeed: 3 })!;
  spark.hp = 0;
  tick(boss, ctx, FIXED_STEP, now, updateRaid5Boss);
  assert.ok(buffs.includes('Power Spark'), 'spark harvest grants the buff');
  // A second dead spark grants again; the same spark never double-counts.
  const spark2 = sim.spawnEnemy('wisp', -100, -600, 'normal', { campId: RAID5_ENTRANCE_ID, memberId: 'spark:e', lootSeed: 4 })!;
  spark2.hp = 0;
  tick(boss, ctx, FIXED_STEP, now, updateRaid5Boss);
  assert.equal(buffs.filter(b => b === 'Power Spark').length, 2);
});

test('phase 3 grants the Wyrmrest Skytalon drake buff and keeps Malygos airborne', () => {
  const sim = make();
  const boss = raid5Boss(sim);
  sim.player.x = 0; sim.player.y = -600;
  const now = { t: 0 };
  const buffs: string[] = [];
  const ctx = aiContext(sim, [], buffs, [], now);
  tick(boss, ctx, .5, now, updateRaid5Boss); // engage
  boss.hp = boss.maxHp * .2; // phase 3
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0;
  tick(boss, ctx, FIXED_STEP, now, updateRaid5Boss);
  assert.ok(buffs.includes('Wyrmrest Skytalon'), 'the drake ride buff lands in phase 3');
  // Airborne: only ranged moves — never the melee 'sweep'.
  for (let i = 0; i < 30; i++) {
    boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined;
    tick(boss, ctx, FIXED_STEP, now, updateRaid5Boss);
    assert.notEqual(boss.bossMove, 'sweep', 'no melee while airborne');
  }
});

test('Malygos enrages after the timer and leaves Power Rifts', () => {
  const sim = make();
  const boss = raid5Boss(sim);
  sim.player.x = 0; sim.player.y = -600;
  const now = { t: 0 };
  const events: CombatEvent[] = [];
  const hurt: string[] = [];
  const ctx = aiContext(sim, events, [], hurt, now);
  tick(boss, ctx, .5, now, updateRaid5Boss); // engage at t≈0.5
  assert.ok(raid5EnrageRemaining(boss, now.t)! > 0);
  now.t += MALYGOS_RULES.enrageAfter + 1;
  tick(boss, ctx, 2, now, updateRaid5Boss);
  assert.ok(raid5EnrageRemaining(boss, now.t)! < 0, 'enrage timer expired');
  assert.ok(events.some(e => e.type === 'blast'), 'enrage pulse emits');
  assert.ok(hurt.length > 0, 'enrage pulse hurts');
  // Surge of Power leaves a rift: force the move and run the attack.
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined;
  boss.bossTurns = 0; // even turn → scripted move; force eruption via hp phase 1
  boss.hp = boss.maxHp * .4;
  // Commit until an 'eruption' lands.
  for (let i = 0; i < 20 && boss.bossMove !== 'eruption'; i++) {
    boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined;
    tick(boss, ctx, FIXED_STEP, now, updateRaid5Boss);
  }
  if (boss.bossMove === 'eruption') {
    tick(boss, ctx, 3, now, updateRaid5Boss); // windup + attack + linger
    assert.ok(raid5Rifts(boss).length > 0, 'Surge of Power leaves a Power Rift');
  }
});

// ── Sartharion mechanics ──────────────────────────────────────────────────

test('Sartharion engages and Will of Sartharion scales with living drakes', () => {
  const sim = make();
  const boss = raid6Boss(sim);
  sim.player.x = 0; sim.player.y = -600;
  const now = { t: 0 };
  const ctx = aiContext(sim, [], [], [], now);
  tick(boss, ctx, .5, now, updateRaid6Boss); // engage
  // No drakes admitted → all three alive by definition → +75% damage. Pin
  // bossTurns so both measurements land on the same scripted move slot.
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined; boss.bossTurns = 0;
  tick(boss, ctx, FIXED_STEP, now, updateRaid6Boss);
  const buffed = boss.attackDamage!;
  // Kill all three drakes (admitted + dead) → no empowerment.
  for (const id of Object.keys(SARTH_DRAKES)) {
    const d = drake(sim, id, 0, -1200);
    d.hp = 0;
  }
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined; boss.attackDamage = undefined; boss.bossTurns = 0;
  tick(boss, ctx, FIXED_STEP, now, updateRaid6Boss);
  const unbuffed = boss.attackDamage!;
  assert.ok(buffed > unbuffed * 1.5, `3 drakes empower: ${buffed} vs ${unbuffed}`);
});

test('Sartharion calls drakes down on cadence and latches their deaths', () => {
  const sim = make();
  const boss = raid6Boss(sim);
  const tenebron = drake(sim, 'drake:tenebron', -1150, -1250);
  sim.player.x = 0; sim.player.y = -600;
  const now = { t: 0 };
  const ctx = aiContext(sim, [], [], [], now);
  tick(boss, ctx, .5, now, updateRaid6Boss); // engage
  assert.equal(tenebron.state, 'idle', 'drake waits on the rim');
  // Jump past the first call-down (12s): Tenebron answers.
  now.t += 13;
  tick(boss, ctx, FIXED_STEP, now, updateRaid6Boss);
  assert.equal(tenebron.state, 'chase', 'Tenebron answers the call-down');
  // Kill him: the death latches on the boss's bossPhases bit 4.
  tenebron.hp = 0;
  tick(boss, ctx, FIXED_STEP, now, updateRaid6Boss);
  assert.ok((boss.bossPhases ?? 0) & 4, 'Tenebron\'s death latched on the warden');
});

test('sartharionDrakesAlive reads the kill-time count off the warden bits', () => {
  // Deaths latch on the boss's own bossPhases high bits (4/8/16); wave bits 1/2
  // stay clear of them.
  const run = { states: { warden: { hp: 0, bossPhases: 0 } } as Record<string, { hp: number; bossPhases?: number }> };
  assert.equal(sartharionDrakesAlive(run), 3, 'no deaths latched — all three alive');
  run.states.warden.bossPhases = 4; // Tenebron dead
  assert.equal(sartharionDrakesAlive(run), 2);
  run.states.warden.bossPhases = 4 | 16; // Tenebron + Vesperon dead
  assert.equal(sartharionDrakesAlive(run), 1);
  run.states.warden.bossPhases = 4 | 8 | 16; // all three dead — clean kill
  assert.equal(sartharionDrakesAlive(run), 0);
  // Wave bits don't pollute the count.
  run.states.warden.bossPhases = 1 | 2 | 8;
  assert.equal(sartharionDrakesAlive(run), 2);
});

test('Sartharion transitions phases at 65% / 30% and enrages', () => {
  const sim = make();
  const boss = raid6Boss(sim);
  sim.player.x = 0; sim.player.y = -600;
  const now = { t: 0 };
  const ctx = aiContext(sim, [], [], [], now);
  tick(boss, ctx, .5, now, updateRaid6Boss); // engage
  boss.hp = boss.maxHp * .5;
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0;
  tick(boss, ctx, FIXED_STEP, now, updateRaid6Boss);
  assert.ok((boss.bossPhases ?? 0) & 1, 'wave bit 1 at 65%');
  boss.hp = boss.maxHp * .2;
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined;
  tick(boss, ctx, FIXED_STEP, now, updateRaid6Boss);
  assert.ok((boss.bossPhases ?? 0) & 2, 'wave bit 2 at 30%');
  // Enrage.
  now.t += SARTH_RULES.enrageAfter + 1;
  const hurt: string[] = [];
  const ctx2 = aiContext(sim, [], [], hurt, now);
  tick(boss, ctx2, 2, now, updateRaid6Boss);
  assert.ok(raid6EnrageRemaining(boss, now.t)! < 0);
  assert.ok(hurt.length > 0, 'Twilight Fury burns the arena');
});

// ── Loot ──────────────────────────────────────────────────────────────────

test('Malygos and Sartharion map to their named loot tables', () => {
  assert.equal(RAID_BOSS_LOOT[RAID5_ENTRANCE_ID], 'malygos');
  assert.equal(RAID_BOSS_LOOT[RAID6_ENTRANCE_ID], 'sartharion');
  assert.equal(raidLootTable(RAID5_ENTRANCE_ID)?.name, 'Cache of the Spell-Weaver');
  assert.equal(raidLootTable(RAID6_ENTRANCE_ID)?.name, 'Satchel of Spoils');
  // Signature drops are on the tables.
  assert.ok(RAID_LOOT_TABLES.malygos.drops.some(d => d.kind === 'epic' && d.name === 'Azure Spellblade'));
  assert.ok(RAID_LOOT_TABLES.sartharion.drops.some(d => d.kind === 'epic' && d.name === 'Satchel of Spoils'));
  assert.equal(RAID_LOOT_TABLES.malygos.bonus?.mount, 'drake');
  assert.equal(RAID_LOOT_TABLES.sartharion.hardmode?.mount, 'drake');
});

test('Malygos chest rolls spell weapons and Tier-7 chests', () => {
  for (let i = 0; i < 12; i++) {
    const loot = raidBossLoot(RAID5_ENTRANCE_ID, dungeonRandom(2000 + i), 80, 'mage')!;
    assert.equal(loot.items.length, 3);
    for (const item of loot.items) {
      const piece = setPieceOf(item);
      if (piece) assert.equal(piece.kind, 'chest', `Malygos set drop ${piece.id} must be a chest`);
    }
  }
  // Determinism.
  const a = raidBossLoot(RAID5_ENTRANCE_ID, dungeonRandom(77), 80, 'priest')!;
  const b = raidBossLoot(RAID5_ENTRANCE_ID, dungeonRandom(77), 80, 'priest')!;
  assert.deepEqual(a.items.map(i => i.id), b.items.map(i => i.id));
});

test('Sartharion hardmode pays a bonus roll and the guaranteed Twilight Drake', () => {
  // Normal kill (0 drakes): three rolls, no mount.
  const normal = raidBossLoot(RAID6_ENTRANCE_ID, dungeonRandom(500), 80, 'warrior', { drakesAlive: 0 })!;
  assert.equal(normal.items.length, 3);
  assert.equal(normal.mount, undefined);
  // 3-drake hardmode: four rolls (3 + 1 bonus) and the guaranteed drake.
  const hard = raidBossLoot(RAID6_ENTRANCE_ID, dungeonRandom(500), 80, 'warrior', { drakesAlive: 3 })!;
  assert.equal(hard.items.length, 4, 'hardmode adds a bonus roll');
  assert.equal(hard.mount, 'drake', 'Twilight Drake guaranteed on 3D');
  // 2 drakes is not enough for the hardmode payout.
  const two = raidBossLoot(RAID6_ENTRANCE_ID, dungeonRandom(500), 80, 'warrior', { drakesAlive: 2 })!;
  assert.equal(two.items.length, 3);
  assert.equal(two.mount, undefined);
  // Set drops are gloves.
  for (let i = 0; i < 12; i++) {
    const loot = raidBossLoot(RAID6_ENTRANCE_ID, dungeonRandom(3000 + i), 80, 'paladin')!;
    for (const item of loot.items) {
      const piece = setPieceOf(item);
      if (piece) assert.equal(piece.kind, 'gloves', `Sartharion set drop ${piece.id} must be gloves`);
    }
  }
});
