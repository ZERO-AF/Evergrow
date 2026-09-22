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
  RAID9_ENTRANCE_ID, RAID9_BOSS_MEMBER_ID, HALION_RULES,
  isRaid9EntranceId, isRaid9Entrance, isRaid9Boss, raid9BossName,
  raid9ArenaFloor, raid9BossWarningSpec,
} from '../src/raid9-boss-content.ts';
import { updateRaid9Boss, raid9EnrageRemaining, raid9Zones, raid9Marks } from '../src/raid9-boss.ts';

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

const raid9Boss = (sim: Simulation): Enemy =>
  sim.spawnEnemy('warden', 0, -1050, 'elite', { campId: RAID9_ENTRANCE_ID, memberId: RAID9_BOSS_MEMBER_ID, lootSeed: 1 })!;

// ── Content / identity ────────────────────────────────────────────────────

test('raid9 entrance id, predicates and name are wired', () => {
  assert.equal(RAID9_ENTRANCE_ID, 'dungeon:raid:ruby-sanctum');
  assert.ok(isRaid9EntranceId(RAID9_ENTRANCE_ID) && !isRaid9EntranceId('dungeon:raid:obsidian-sanctum'));
  assert.ok(isRaid9Entrance({ id: RAID9_ENTRANCE_ID }) && !isRaid9Entrance({ id: 'dungeon:raid:eye-of-eternity' }) && !isRaid9Entrance(null));
  const sim = make();
  const halion = raid9Boss(sim);
  const other = sim.spawnEnemy('warden', 0, 0, 'elite', { campId: 'dungeon:raid:obsidian-sanctum', memberId: 'warden', lootSeed: 2 })!;
  assert.ok(isRaid9Boss(halion) && !isRaid9Boss(other));
  assert.equal(raid9BossName(halion), 'Halion');
  assert.equal(raid9BossName(other), undefined);
});

test('raid9 arena floor carries the warden, wave-gated twilight adds and the boss chest', () => {
  const floor = raid9ArenaFloor(99);
  assert.ok(Object.isFrozen(floor));
  assert.equal(floor.theme, 'foundry');
  const warden = floor.members.find(m => m.id === 'warden')!;
  assert.equal(warden.kind, 'warden');
  assert.equal(warden.rank, 'elite');
  assert.equal(warden.wave, undefined, 'the boss is never wave-gated');
  assert.equal(floor.members.filter(m => m.wave === 1).length, 6, '75% wave: whelps + embers');
  assert.equal(floor.members.filter(m => m.wave === 2).length, 4, '50% wave: scalebearers + veteran embers');
  assert.equal(floor.chests.length, 3, 'two caches plus the boss chest');
  assert.equal(floor.rooms.length, 2);
  assert.equal(floor.edges.length, 1);
  // Determinism: same seed, same floor.
  assert.deepEqual(raid9ArenaFloor(99).members.map(m => m.id), floor.members.map(m => m.id));
});

test('authored world maps Ruby Sanctum to the raid9 entrance id', () => {
  const world = new AuthoredWorld(7319);
  // Dragonblight is wider than the 100k world-query cap; query the band holding the Sanctum.
  const blight = zoneRect('dragonblight')!;
  const rs = world.getDungeonEntrances(blight.x + blight.w * .4, blight.y + blight.h * .3, blight.w * .4, blight.h * .5)
    .find(e => e.name === 'Ruby Sanctum');
  assert.ok(rs, 'Ruby Sanctum entrance exists in Dragonblight');
  assert.equal(rs!.id, RAID9_ENTRANCE_ID);
  world.dispose();
});

test('warning specs announce real Halion spell names', () => {
  const sim = make();
  const halion = raid9Boss(sim);
  halion.bossMove = 'sweep'; halion.attackVariant = 0;
  assert.equal(raid9BossWarningSpec(halion)?.ability, 'Flame Breath');
  halion.attackVariant = 1;
  assert.equal(raid9BossWarningSpec(halion)?.ability, 'Dark Breath');
  halion.bossMove = 'fracture';
  assert.equal(raid9BossWarningSpec(halion)?.ability, 'Twilight Cutter');
  halion.bossMove = 'eruption';
  assert.equal(raid9BossWarningSpec(halion)?.ability, 'Meteor Strike');
  halion.bossMove = 'command'; halion.attackVariant = 0;
  assert.equal(raid9BossWarningSpec(halion)?.ability, 'Fiery Combustion');
  halion.attackVariant = 1;
  assert.equal(raid9BossWarningSpec(halion)?.ability, 'Soul Consumption');
  halion.bossMove = 'jab';
  assert.equal(raid9BossWarningSpec(halion)?.ability, 'Tail Lash');
  halion.bossMove = 'summon'; halion.bossPhases = 2;
  assert.equal(raid9BossWarningSpec(halion)?.ability, 'Twilight Scalebearers');
  // Non-raid enemies get no spec.
  const brute = sim.spawnEnemy('brute', 0, 0, 'normal')!;
  brute.bossMove = 'sweep';
  assert.equal(raid9BossWarningSpec(brute), undefined);
});

// ── Halion mechanics ──────────────────────────────────────────────────────

test('Halion engages, commits attacks and transitions phases at 75% / 50%', () => {
  const sim = make();
  const boss = raid9Boss(sim);
  sim.player.x = 0; sim.player.y = -600; // inside awareness
  const now = { t: 0 };
  const ctx = aiContext(sim, [], [], [], now);
  tick(boss, ctx, .5, now, updateRaid9Boss);
  // Engaged: alertEnemy lands him in 'chase', and the same tick commits a move.
  assert.ok(boss.bossMove, 'a move is committed on engage');
  assert.equal(boss.state, 'windup');
  // Drive to 75%: the twilight bleed sets wave bit 1.
  boss.hp = boss.maxHp * .6;
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0;
  tick(boss, ctx, FIXED_STEP, now, updateRaid9Boss);
  assert.ok((boss.bossPhases ?? 0) & 1, 'wave bit 1 set at 75%');
  assert.equal(boss.bossMove, 'summon');
  // Drive to 50%: the corporeality split sets wave bit 2.
  boss.hp = boss.maxHp * .4;
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined;
  tick(boss, ctx, FIXED_STEP, now, updateRaid9Boss);
  assert.ok((boss.bossPhases ?? 0) & 2, 'wave bit 2 set at 50%');
});

test('the corporeality split turns his kit shadow in phase 3', () => {
  const sim = make();
  const boss = raid9Boss(sim);
  sim.player.x = 0; sim.player.y = -880; // inside breath reach (d ≈ 170)
  const now = { t: 0 };
  const ctx = aiContext(sim, [], [], [], now);
  tick(boss, ctx, .5, now, updateRaid9Boss); // engage
  boss.hp = boss.maxHp * .4; // phase 3
  boss.bossPhases = 3; // wave bits already latched — the flourish won't preempt the forced move
  // Pin bossTurns so the scripted slot lands on 'sweep' (turns 0 → index 0).
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined; boss.bossTurns = 0;
  tick(boss, ctx, FIXED_STEP, now, updateRaid9Boss);
  assert.equal(boss.bossMove, 'sweep');
  assert.equal(boss.attackVariant, 1, 'Dark Breath rides attackVariant 1');
  assert.equal(raid9BossWarningSpec(boss)?.ability, 'Dark Breath');
  // Same for 'command' → Soul Consumption (turns 2 → index 1).
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined; boss.bossTurns = 2;
  tick(boss, ctx, FIXED_STEP, now, updateRaid9Boss);
  assert.equal(boss.bossMove, 'command');
  assert.equal(boss.attackVariant, 1, 'Soul Consumption rides attackVariant 1');
  assert.equal(raid9BossWarningSpec(boss)?.ability, 'Soul Consumption');
});

test('Fiery Combustion marks the target and expires into a void zone', () => {
  const sim = make();
  const boss = raid9Boss(sim);
  sim.player.x = 0; sim.player.y = -600;
  const now = { t: 0 };
  const hurt: string[] = [];
  const ctx = aiContext(sim, [], [], hurt, now);
  tick(boss, ctx, .5, now, updateRaid9Boss); // engage
  // Force the 'command' commit (turns 2 → index 1) in phase 1 → Fiery Combustion.
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined; boss.bossTurns = 2;
  tick(boss, ctx, FIXED_STEP, now, updateRaid9Boss);
  assert.equal(boss.bossMove, 'command');
  assert.equal(boss.attackVariant, 0, 'phase 1 combustion is fire');
  tick(boss, ctx, 2, now, updateRaid9Boss); // windup + attack: the mark lands
  assert.equal(raid9Marks(boss).length, 1, 'the mark rides its target');
  assert.equal(raid9Marks(boss)[0].shadow, false);
  // Ride out the debuff: expiry drops a fire zone at the target's feet.
  tick(boss, ctx, HALION_RULES.markDuration + 1, now, updateRaid9Boss);
  assert.equal(raid9Marks(boss).length, 0, 'mark consumed');
  assert.equal(raid9Zones(boss).length, 1, 'expiry drops a void zone');
  assert.equal(raid9Zones(boss)[0].shadow, false, 'combustion zone burns fire');
  assert.ok(hurt.includes('fire'), 'the eruption burst hits');
});

test('Soul Consumption drops a shadow zone in phase 3', () => {
  const sim = make();
  const boss = raid9Boss(sim);
  sim.player.x = 0; sim.player.y = -600;
  const now = { t: 0 };
  const ctx = aiContext(sim, [], [], [], now);
  tick(boss, ctx, .5, now, updateRaid9Boss); // engage
  boss.hp = boss.maxHp * .4; // phase 3
  boss.bossPhases = 3; // wave bits already latched — the flourish won't preempt the forced move
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined; boss.bossTurns = 2;
  tick(boss, ctx, FIXED_STEP, now, updateRaid9Boss);
  assert.equal(boss.bossMove, 'command');
  assert.equal(boss.attackVariant, 1);
  tick(boss, ctx, 2, now, updateRaid9Boss);
  assert.equal(raid9Marks(boss)[0]?.shadow, true, 'consumption mark is shadow');
  tick(boss, ctx, HALION_RULES.markDuration + 1, now, updateRaid9Boss);
  assert.equal(raid9Zones(boss)[0]?.shadow, true, 'consumption zone burns shadow');
});

test('Meteor Strike detonates at the target and leaves a blaze', () => {
  const sim = make();
  const boss = raid9Boss(sim);
  sim.player.x = 0; sim.player.y = -600;
  const now = { t: 0 };
  const hurt: string[] = [];
  const ctx = aiContext(sim, [], [], hurt, now);
  tick(boss, ctx, .5, now, updateRaid9Boss); // engage
  // Force 'eruption' (turns 6 → index 3).
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined; boss.bossTurns = 6;
  tick(boss, ctx, FIXED_STEP, now, updateRaid9Boss);
  assert.equal(boss.bossMove, 'eruption');
  tick(boss, ctx, 3, now, updateRaid9Boss); // windup + attack + linger
  assert.ok(raid9Zones(boss).length > 0, 'Meteor Strike leaves a blaze zone');
  assert.ok(hurt.includes('fire'), 'the meteor hits as fire');
});

test('Twilight Cutter sweeps a beam through the arena heart', () => {
  const sim = make();
  const boss = raid9Boss(sim);
  sim.player.x = 0; sim.player.y = -560; // parked on the arena heart — the beam always crosses it
  const now = { t: 0 };
  const hurt: string[] = [];
  const ctx = aiContext(sim, [], [], hurt, now);
  tick(boss, ctx, .5, now, updateRaid9Boss); // engage
  // Force 'fracture' (turns 4 → index 2).
  boss.state = 'chase'; boss.stateTime = 0; boss.stateDuration = 0; boss.bossMove = undefined; boss.bossTurns = 4;
  tick(boss, ctx, FIXED_STEP, now, updateRaid9Boss);
  assert.equal(boss.bossMove, 'fracture');
  tick(boss, ctx, 3, now, updateRaid9Boss); // windup + the sweeping beam
  assert.ok(hurt.includes('shadow'), 'the cutter hits as shadow');
});

test('Halion enrages after the timer', () => {
  const sim = make();
  const boss = raid9Boss(sim);
  sim.player.x = 0; sim.player.y = -600;
  const now = { t: 0 };
  const events: CombatEvent[] = [];
  const hurt: string[] = [];
  const ctx = aiContext(sim, events, [], hurt, now);
  tick(boss, ctx, .5, now, updateRaid9Boss); // engage at t≈0.5
  assert.ok(raid9EnrageRemaining(boss, now.t)! > 0);
  now.t += HALION_RULES.enrageAfter + 1;
  tick(boss, ctx, 2, now, updateRaid9Boss);
  assert.ok(raid9EnrageRemaining(boss, now.t)! < 0, 'enrage timer expired');
  assert.ok(events.some(e => e.type === 'blast'), 'enrage pulse emits');
  assert.ok(hurt.includes('shadow'), 'Twilight Fury burns shadow');
});

// ── Loot ──────────────────────────────────────────────────────────────────

test('Halion maps to his named loot table', () => {
  assert.equal(RAID_BOSS_LOOT[RAID9_ENTRANCE_ID], 'halion');
  assert.equal(raidLootTable(RAID9_ENTRANCE_ID)?.name, 'Hoard of the Twilight Destroyer');
  // Signature drops are on the table.
  assert.ok(RAID_LOOT_TABLES.halion.drops.some(d => d.kind === 'epic' && d.name === 'Charred Twilight Scale'));
  assert.ok(RAID_LOOT_TABLES.halion.drops.some(d => d.kind === 'epic' && d.name === 'Glowing Twilight Scale'));
  assert.equal(RAID_LOOT_TABLES.halion.bonus?.mount, 'drake');
});

test('Halion chest rolls twilight spoils and Tier-10 boots', () => {
  for (let i = 0; i < 12; i++) {
    const loot = raidBossLoot(RAID9_ENTRANCE_ID, dungeonRandom(4000 + i), 80, 'warrior')!;
    assert.equal(loot.items.length, 3);
    for (const item of loot.items) {
      const piece = setPieceOf(item);
      if (piece) assert.equal(piece.kind, 'boots', `Halion set drop ${piece.id} must be boots`);
    }
  }
  // Determinism.
  const a = raidBossLoot(RAID9_ENTRANCE_ID, dungeonRandom(77), 80, 'priest')!;
  const b = raidBossLoot(RAID9_ENTRANCE_ID, dungeonRandom(77), 80, 'priest')!;
  assert.deepEqual(a.items.map(i => i.id), b.items.map(i => i.id));
});
