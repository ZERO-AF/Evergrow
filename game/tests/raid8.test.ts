import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import type { EnemyAIContext } from '../src/enemy-ai.ts';
import type { CombatEvent, Enemy, WorldQuery } from '../src/model.ts';
import { lcgRandom } from '../src/random-source.ts';
import { raidBossLoot, raidLootTable, RAID_BOSS_LOOT, RAID_LOOT_TABLES } from '../src/raid-loot-content.ts';
import { AuthoredWorld } from '../src/authored-world.ts';
import { zoneRect } from '../src/world-atlas.ts';
import {
  RAID8_ENTRANCE_ID, RAID8_BOSS_MEMBER_ID, RAID8_BOSS_KIND, ANUBARAK_RULES, RAID8_SCARAB_IDS,
  isRaid8EntranceId, isRaid8Entrance, isRaid8Boss, isRaid8Scarab, raid8BossName,
  raid8ArenaFloor, raid8BossWarningSpec, raid8Entrances,
} from '../src/raid8-boss-content.ts';
import { updateRaid8Boss, raid8EnrageRemaining, raid8Spikes } from '../src/raid8-boss.ts';

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

const raid8Boss = (sim: Simulation): Enemy =>
  sim.spawnEnemy(RAID8_BOSS_KIND, 0, -1050, 'elite', { campId: RAID8_ENTRANCE_ID, memberId: RAID8_BOSS_MEMBER_ID, lootSeed: 1 })!;

// ── Content / identity ────────────────────────────────────────────────────

test('raid8 entrance id, predicates and names are wired', () => {
  assert.equal(RAID8_ENTRANCE_ID, 'dungeon:raid:trial-of-the-crusader');
  assert.ok(isRaid8EntranceId(RAID8_ENTRANCE_ID));
  assert.ok(!isRaid8EntranceId('dungeon:raid:obsidian-sanctum') && !isRaid8EntranceId(undefined));
  assert.ok(isRaid8Entrance({ id: RAID8_ENTRANCE_ID }) && !isRaid8Entrance({ id: 'x' }) && !isRaid8Entrance(null));
  const sim = make();
  const anub = raid8Boss(sim);
  assert.ok(isRaid8Boss(anub));
  assert.equal(raid8BossName(anub), 'Anub\'arak');
  assert.equal(raid8BossName(sim.spawnEnemy('warden', 0, 0, 'elite', { campId: 'dungeon:raid:obsidian-sanctum', memberId: 'warden', lootSeed: 2 })!), undefined);
  // Scarab membership.
  const scarab = sim.spawnEnemy('duneScuttler', 0, 0, 'normal', { campId: RAID8_ENTRANCE_ID, memberId: 'scarab:w:0', lootSeed: 3 })!;
  assert.ok(isRaid8Scarab(scarab) && !isRaid8Scarab(anub));
  assert.ok(Object.isFrozen(ANUBARAK_RULES) && Object.isFrozen(RAID8_SCARAB_IDS));
});

test('raid8 arena floor carries the boss, wave-gated scarabs and the boss chest', () => {
  const floor = raid8ArenaFloor(99);
  assert.ok(Object.isFrozen(floor));
  assert.equal(floor.theme, 'nerubian');
  const warden = floor.members.find(m => m.id === 'warden')!;
  assert.equal(warden.kind, RAID8_BOSS_KIND);
  assert.equal(warden.rank, 'elite');
  assert.equal(floor.members.filter(m => m.wave === 1).length, 8, 'first Submerge pack');
  assert.equal(floor.members.filter(m => m.wave === 2).length, 3, 'second Submerge pack');
  assert.equal(floor.chests.length, 3, 'two caches plus the boss chest');
  assert.equal(floor.rooms.length, 2);
  assert.equal(floor.edges.length, 1);
  for (const id of Object.keys(RAID8_SCARAB_IDS)) {
    const m = floor.members.find(mm => mm.id === id)!;
    assert.ok(m.wave === 1 || m.wave === 2, `${id} is wave-gated`);
  }
  // Deterministic: same seed, same roster.
  assert.deepEqual(raid8ArenaFloor(7).members.map(m => m.id), raid8ArenaFloor(7).members.map(m => m.id));
});

test('raid8 entrance query rejects malformed rects', () => {
  const world = { seed: 7319, getWildernessSites: () => [], blocked: () => false, isSanctuary: () => false, sampleBiome: () => ({ id: 'frostpine' }) };
  assert.deepEqual(raid8Entrances(world as never, NaN, 0, 10, 10), []);
  assert.deepEqual(raid8Entrances(world as never, 0, 0, -5, 10), []);
  assert.deepEqual(raid8Entrances(world as never, 0, 0, 200000, 10), []);
});

test('warning spec announces real Anub\'arak spell names', () => {
  const sim = make();
  const anub = raid8Boss(sim);
  anub.bossMove = 'sweep';
  assert.equal(raid8BossWarningSpec(anub)?.ability, 'Freezing Slash');
  anub.bossMove = 'fracture';
  assert.equal(raid8BossWarningSpec(anub)?.ability, 'Impale');
  anub.bossMove = 'rush';
  assert.equal(raid8BossWarningSpec(anub)?.ability, 'Pursuit by Anub\'arak');
  anub.bossMove = 'command';
  assert.equal(raid8BossWarningSpec(anub)?.ability, 'Leeching Swarm');
  anub.bossMove = 'summon'; anub.attackVariant = 0;
  assert.equal(raid8BossWarningSpec(anub)?.ability, 'Submerge');
  anub.attackVariant = 2;
  assert.equal(raid8BossWarningSpec(anub)?.ability, 'Swarm Scarab');
  // Non-raid enemies get no spec.
  const brute = sim.spawnEnemy('brute', 0, 0, 'normal')!;
  brute.bossMove = 'sweep';
  assert.equal(raid8BossWarningSpec(brute), undefined);
  anub.bossMove = undefined;
  assert.equal(raid8BossWarningSpec(anub), undefined);
});

test('authored world maps Trial of the Crusader to the raid8 entrance id', () => {
  const world = new AuthoredWorld(7319);
  // Icecrown is wider than the 100k world-query cap; query the band holding the Coliseum.
  const crown = zoneRect('icecrown')!;
  const toc = world.getDungeonEntrances(crown.x + crown.w * .6, crown.y, crown.w * .4, crown.h * .5)
    .find(e => e.name === 'Trial of the Crusader');
  assert.ok(toc, 'Trial of the Crusader entrance exists in Icecrown');
  assert.equal(toc!.id, RAID8_ENTRANCE_ID);
  world.dispose();
});


// ── Anub'arak mechanics ───────────────────────────────────────────────────

test('Anub\'arak engages, commits attacks and Submerges at 75% / 45%', () => {
  const sim = make();
  const boss = raid8Boss(sim);
  sim.player.x = 0; sim.player.y = -600; // inside awareness
  sim.player.maxHp = 1e6; sim.player.hp = 1e6; // survive the spike field
  const now = { t: 0 };
  const ctx = aiContext(sim, [], [], [], now);
  tick(boss, ctx, .5, now, updateRaid8Boss);
  // Engaged: alertEnemy lands him in 'chase', and the same tick commits a move.
  assert.ok(boss.bossMove, 'a move is committed on engage');
  assert.equal(boss.state, 'windup');
  // Drive to 75%: the first Submerge flourish sets wave bit 1.
  boss.hp = boss.maxHp * .6;
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0;
  tick(boss, ctx, FIXED_STEP, now, updateRaid8Boss);
  assert.ok((boss.bossPhases ?? 0) & 1, 'wave bit 1 set at 75%');
  assert.equal(boss.bossMove, 'summon');
  // Drive to 45%: the second Submerge sets wave bit 2 and is announced as Swarm Scarab.
  boss.hp = boss.maxHp * .4;
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined;
  tick(boss, ctx, FIXED_STEP, now, updateRaid8Boss);
  assert.ok((boss.bossPhases ?? 0) & 2, 'wave bit 2 set at 45%');
  assert.equal(boss.attackVariant, 2, 'second submerge marked for the warning spec');
});

test('Submerge burrows Anub\'arak while pursuit spikes erupt and chase', () => {
  const sim = make();
  const boss = raid8Boss(sim);
  sim.player.x = 0; sim.player.y = -600;
  sim.player.maxHp = 1e6; sim.player.hp = 1e6;
  const now = { t: 0 };
  const hurt: string[] = [];
  const ctx = aiContext(sim, [], [], hurt, now);
  tick(boss, ctx, .5, now, updateRaid8Boss); // engage
  boss.hp = boss.maxHp * .6;
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0;
  tick(boss, ctx, FIXED_STEP, now, updateRaid8Boss); // commit Submerge
  assert.equal(boss.bossMove, 'summon');
  // Run until the flourish lands and he burrows (windup duration scales with threat).
  let burrowed = false;
  for (let i = 0; i < 60 && !burrowed; i++) { tick(boss, ctx, .1, now, updateRaid8Boss); burrowed = (boss.state as Enemy['state']) === 'recover'; }
  assert.ok(burrowed, 'the Submerge flourish lands');
  // Underground: he holds 'recover' while spikes spawn on cadence and hunt.
  let sawSpike = false, steps = 0;
  while (steps++ < 200 && (boss.state as Enemy['state']) === 'recover') {
    tick(boss, ctx, .1, now, updateRaid8Boss);
    sawSpike ||= raid8Spikes(boss).length > 0;
  }
  assert.ok(sawSpike, 'pursuit spikes erupt while burrowed');
  assert.ok(hurt.includes('physical'), 'a spike reached the raid and erupted');
  assert.notEqual(boss.state, 'recover', 'resurfaces after the burrow window');
});

test('Leeching Swarm drains the raid and heals Anub\'arak below 30%', () => {
  const sim = make();
  const boss = raid8Boss(sim);
  sim.player.x = 0; sim.player.y = -600;
  sim.player.maxHp = 1e6; sim.player.hp = 1e6;
  const now = { t: 0 };
  const hurt: string[] = [];
  const ctx = aiContext(sim, [], [], hurt, now);
  tick(boss, ctx, .5, now, updateRaid8Boss); // engage
  boss.bossPhases = 3; // both Submerges already latched — no flourish interrupts the drain
  boss.hp = boss.maxHp * .25;
  const before = boss.hp;
  tick(boss, ctx, 3, now, updateRaid8Boss);
  assert.ok(hurt.includes('nature'), 'Leeching Swarm drains as nature damage');
  assert.ok(boss.hp > before, `the swarm heals him: ${before} → ${boss.hp}`);
});

test('Anub\'arak enrages after the timer', () => {
  const sim = make();
  const boss = raid8Boss(sim);
  sim.player.x = 0; sim.player.y = -600;
  sim.player.maxHp = 1e6; sim.player.hp = 1e6;
  const now = { t: 0 };
  const events: CombatEvent[] = [];
  const hurt: string[] = [];
  const ctx = aiContext(sim, events, [], hurt, now);
  tick(boss, ctx, .5, now, updateRaid8Boss); // engage at t≈0.5
  assert.ok(raid8EnrageRemaining(boss, now.t)! > 0);
  now.t += ANUBARAK_RULES.enrageAfter + 1;
  tick(boss, ctx, 2, now, updateRaid8Boss);
  assert.ok(raid8EnrageRemaining(boss, now.t)! < 0, 'enrage timer expired');
  assert.ok(events.some(e => e.type === 'blast'), 'enrage pulse emits');
  assert.ok(hurt.includes('frost'), 'Swarm Fury burns as frost');
});

// ── Loot ──────────────────────────────────────────────────────────────────

test('Anub\'arak maps to his named loot table', () => {
  assert.equal(RAID_BOSS_LOOT[RAID8_ENTRANCE_ID], 'anubarak');
  assert.equal(raidLootTable(RAID8_ENTRANCE_ID)?.name, 'The Crusader\'s Tribute');
  assert.ok(RAID_LOOT_TABLES.anubarak.drops.some(d => d.kind === 'epic' && d.name === 'Signet of the Traitor King'));
  assert.ok(RAID_LOOT_TABLES.anubarak.drops.some(d => d.kind === 'setPiece'), 'Tier-9 set pieces on the table');
  assert.equal(RAID_LOOT_TABLES.anubarak.bonus?.mount, 'spectralSteed');
});

test('the Crusader\'s Tribute rolls Tier-9 flavored loot deterministically', () => {
  for (let i = 0; i < 12; i++) {
    const loot = raidBossLoot(RAID8_ENTRANCE_ID, lcgRandom(4000 + i), 80, 'warrior')!;
    assert.equal(loot.items.length, 3);
  }
  // Determinism: same entrance seed, same haul.
  const a = raidBossLoot(RAID8_ENTRANCE_ID, lcgRandom(77), 80, 'paladin')!;
  const b = raidBossLoot(RAID8_ENTRANCE_ID, lcgRandom(77), 80, 'paladin')!;
  assert.deepEqual(a.items.map(i => i.id), b.items.map(i => i.id));
});
