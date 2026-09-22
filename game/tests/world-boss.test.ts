import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import type { EnemyAIContext } from '../src/enemy-ai.ts';
import type { Enemy } from '../src/model.ts';
import {
  WORLD_BOSSES, WORLD_BOSS_IDS, WORLD_BOSS_MEMBER_ID, WORLD_BOSS_RULES,
  worldBossAnchor, worldBossByCampId, worldBossCampId, worldBossGuardId,
  worldBossLootSeed, worldBossName, worldBossRareRoll, worldBossRespawnMs,
} from '../src/world-boss-content.ts';
import {
  freshWorldBossLedger, recordWorldBossKill, validWorldBossLedger,
  worldBossAlive, worldBossRespawnIn, type WorldBossLedger,
} from '../src/world-boss-state.ts';
import {
  isWorldBossActor, updateWorldBoss, updateWorldBosses, worldBossLair,
  worldBossOnKill, worldBossPOI, type WorldBossContext, type WorldBossKillContext,
} from '../src/world-boss.ts';
import { achievementComplete } from '../src/achievement-state.ts';
import { mountUnlocked } from '../src/mount-state.ts';
import { companionOwned } from '../src/companion-state.ts';
import { getZoneAt } from '../src/zone-progression.ts';
import type { GroundItem } from '../src/character-types.ts';
import type { GroundGold } from '../src/gold.ts';
import type { CombatEvent } from '../src/model.ts';

const flat = { seed: 7319, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const SEED = 7319;

function setup() {
  const sim = new Simulation(flat, { spawn: false, startX: 0, startY: 155 });
  return { sim };
}

function bossCtx(sim: Simulation, ledger: WorldBossLedger, time: number, emitted: CombatEvent[] = []): WorldBossContext {
  return {
    state: ledger, player: sim.player, enemies: sim.enemies, world: flat, view: null,
    time, worldSeed: SEED,
    spawn: (kind, x, y, rank, source) => sim.spawnEnemy(kind, x, y, rank, source),
    emit: e => emitted.push(e),
  };
}

function killCtx(sim: Simulation, ledger: WorldBossLedger, time: number, groundItems: GroundItem[], groundGold: GroundGold[], emitted: CombatEvent[] = []): WorldBossKillContext {
  let id = 900000;
  return {
    ledger, player: sim.player, enemies: sim.enemies, world: flat, time,
    groundItems, groundGold, nextId: () => id++, emit: e => emitted.push(e), now: 1_800_000_000_000,
  };
}

function spawnBoss(sim: Simulation, id: keyof typeof WORLD_BOSSES): Enemy {
  const def = WORLD_BOSSES[id];
  const lair = worldBossLair(def, flat, SEED)!;
  const boss = sim.spawnEnemy(def.kind, lair.x, lair.y, 'elite',
    { campId: worldBossCampId(id), memberId: WORLD_BOSS_MEMBER_ID, lootSeed: worldBossLootSeed(SEED, id), level: def.level })!;
  boss.bossPhases = 0;
  return boss;
}

function aiCtx(sim: Simulation, hits: { amount: number; type: string }[]): EnemyAIContext {
  return {
    world: flat, player: sim.player, enemies: sim.enemies, time: 0, trial: null,
    visible: () => true,
    move: (e, vx, vy, dt) => { e.x += vx * dt; e.y += vy * dt; },
    hurt: (amount, _angle, _actor, damageType) => hits.push({ amount, type: damageType ?? 'physical' }),
    shoot: () => {}, emit: () => {},
  } as EnemyAIContext;
}

const step = (boss: Enemy, c: EnemyAIContext, dt = 1 / 60) => { boss.stateTime += dt; updateWorldBoss(boss, dt, c); };

// ── Lair resolution ──────────────────────────────────────────────────────────

test('every world boss seats a deterministic lair inside its authored zone', () => {
  for (const id of WORLD_BOSS_IDS) {
    const def = WORLD_BOSSES[id];
    const anchor = worldBossAnchor(def)!;
    assert.ok(anchor, `${id} anchor`);
    const lair = worldBossLair(def, flat, SEED);
    assert.ok(lair, `${id} lair`);
    assert.equal(getZoneAt(lair.x, lair.y, SEED).id, `atlas:${def.zoneId}`, `${id} zone`);
    assert.deepEqual(worldBossLair(def, flat, SEED), lair, `${id} deterministic`);
    const poi = worldBossPOI(def, flat, SEED)!;
    assert.equal(poi.id, `world-boss:${id}`);
    assert.equal(poi.kind, 'bossLair');
    assert.equal(poi.name, def.name);
    assert.equal(poi.x, lair.x);
  }
});

// ── Spawn gating ─────────────────────────────────────────────────────────────

test('a boss materializes with its escort only when the player is near and off cooldown', () => {
  const { sim } = setup();
  const ledger = freshWorldBossLedger();
  const def = WORLD_BOSSES.kazzak;
  const lair = worldBossLair(def, flat, SEED)!;
  const emitted: CombatEvent[] = [];

  // Far away: nothing spawns.
  updateWorldBosses(bossCtx(sim, ledger, 0, emitted));
  assert.equal(sim.enemies.length, 0);

  // Near the lair: boss plus every guard, one spawn notice.
  sim.player.x = lair.x + 100; sim.player.y = lair.y;
  updateWorldBosses(bossCtx(sim, ledger, 0, emitted));
  const boss = sim.enemies.find(e => e.campMemberId === WORLD_BOSS_MEMBER_ID)!;
  assert.ok(boss);
  assert.equal(boss.kind, def.kind);
  assert.equal(boss.rank, 'elite');
  assert.equal(boss.level, def.level);
  assert.equal(boss.campId, worldBossCampId('kazzak'));
  assert.equal(boss.homeX, lair.x);
  assert.equal(boss.bossPhases, 0);
  assert.equal(sim.enemies.length, 1 + def.guards.length);
  assert.ok(emitted.some(e => e.type === 'notice' && e.message.includes(def.name)));

  // Re-ticking never duplicates the encounter.
  updateWorldBosses(bossCtx(sim, ledger, 1, emitted));
  assert.equal(sim.enemies.length, 1 + def.guards.length);
});

test('a dead boss stays down until its respawn window passes, then returns with the escort', () => {
  const { sim } = setup();
  const ledger = freshWorldBossLedger();
  const def = WORLD_BOSSES.emeriss;
  const lair = worldBossLair(def, flat, SEED)!;
  sim.player.x = lair.x; sim.player.y = lair.y;

  updateWorldBosses(bossCtx(sim, ledger, 100));
  assert.equal(sim.enemies.length, 1 + def.guards.length);
  const boss = sim.enemies.find(e => e.campMemberId === WORLD_BOSS_MEMBER_ID)!;
  boss.state = 'dead'; boss.hp = 0;
  recordWorldBossKill(ledger, 'emeriss', 100);
  // The corpse lingers; a dead guard stays dead while the boss is down.
  sim.enemies.find(e => e.campMemberId === worldBossGuardId(0))!.state = 'dead';

  updateWorldBosses(bossCtx(sim, ledger, 100 + worldBossRespawnMs(def) - 1));
  assert.equal(sim.enemies.filter(e => e.state !== 'dead').length, def.guards.length - 1);
  assert.ok(!sim.enemies.some(e => e.campMemberId === WORLD_BOSS_MEMBER_ID && e.state !== 'dead'));

  updateWorldBosses(bossCtx(sim, ledger, 100 + worldBossRespawnMs(def)));
  const respawned = sim.enemies.filter(e => e.campMemberId === WORLD_BOSS_MEMBER_ID && e.state !== 'dead');
  assert.equal(respawned.length, 1);
  assert.notEqual(respawned[0], boss);
  assert.ok(sim.enemies.some(e => e.campMemberId === worldBossGuardId(0) && e.state !== 'dead'));
});

// ── Ledger persistence ───────────────────────────────────────────────────────

test('the kill ledger survives a JSON round-trip and validates strictly', () => {
  const ledger = freshWorldBossLedger();
  assert.ok(worldBossAlive(ledger, 'kazzak', 0));
  assert.equal(worldBossRespawnIn(ledger, 'kazzak', 0), 0);

  assert.ok(recordWorldBossKill(ledger, 'kazzak', 500));
  assert.ok(!worldBossAlive(ledger, 'kazzak', 500 + worldBossRespawnMs(WORLD_BOSSES.kazzak) - 1));
  assert.ok(worldBossAlive(ledger, 'kazzak', 500 + worldBossRespawnMs(WORLD_BOSSES.kazzak)));
  assert.equal(worldBossRespawnIn(ledger, 'kazzak', 600),
    500 + worldBossRespawnMs(WORLD_BOSSES.kazzak) - 600);

  const restored = JSON.parse(JSON.stringify(ledger));
  assert.ok(validWorldBossLedger(restored));
  assert.ok(!worldBossAlive(restored, 'kazzak', 500));
  assert.ok(worldBossAlive(restored, 'azuregos', 500));

  assert.ok(!validWorldBossLedger(null));
  assert.ok(!validWorldBossLedger({}));
  assert.ok(!validWorldBossLedger({ killedAt: { nope: 1 } }));
  assert.ok(!validWorldBossLedger({ killedAt: { kazzak: 'x' } }));
  assert.ok(!validWorldBossLedger({ killedAt: { kazzak: -5 } }));
  assert.ok(!recordWorldBossKill(ledger, 'nope' as never, 0));
  assert.ok(!recordWorldBossKill(ledger, 'kazzak', NaN));
});

// ── Loot ─────────────────────────────────────────────────────────────────────

test('world boss kills drop a deterministic epic-biased hoard plus gold', () => {
  const { sim } = setup();
  const ledger = freshWorldBossLedger();
  const boss = spawnBoss(sim, 'azuregos');
  const items: GroundItem[] = [], gold: GroundGold[] = [];

  const unlocked = worldBossOnKill(boss, killCtx(sim, ledger, 1000, items, gold));
  assert.equal(ledger.killedAt.azuregos, 1000);
  assert.ok(items.length >= WORLD_BOSSES.azuregos.loot.rolls, 'one item per roll minimum');
  assert.ok(items.every(g => g.item.tier === 'epic' || g.item.tier === 'legendary' || g.item.tier === 'unique' || g.item.tier === 'rare'));
  assert.equal(gold.length, 1);
  assert.ok(gold[0]!.amount > 0);
  assert.ok(unlocked.some(a => a.id === 'azuregos'));

  // Same boss, same kill time: identical drops.
  const items2: GroundItem[] = [], gold2: GroundGold[] = [];
  worldBossOnKill(boss, killCtx(sim, freshWorldBossLedger(), 1000, items2, gold2));
  assert.deepEqual(items2.map(g => g.item.id), items.map(g => g.item.id));
  assert.equal(gold2[0]!.amount, gold[0]!.amount);
});

test('the rare vanity drop is deterministic per kill and grants the collection entry', () => {
  const { sim } = setup();
  const def = WORLD_BOSSES.ysondre;
  const boss = spawnBoss(sim, 'ysondre');

  // Find a kill timestamp where the seeded rare roll hits.
  let hitAt = -1;
  for (let t = 0; t < 4000 && hitAt < 0; t += 37) if (worldBossRareRoll(def, t)) hitAt = t;
  assert.ok(hitAt >= 0, 'rare roll reachable');

  const items: GroundItem[] = [], gold: GroundGold[] = [], emitted: CombatEvent[] = [];
  worldBossOnKill(boss, killCtx(sim, freshWorldBossLedger(), hitAt, items, gold, emitted));
  assert.ok(mountUnlocked(sim.player, 'raptor'), 'raptor flag granted');
  assert.ok(emitted.some(e => e.type === 'notice' && e.message.includes('Swift Raptor')));

  // A miss timestamp grants nothing.
  let missAt = -1;
  for (let t = 0; t < 4000 && missAt < 0; t += 37) if (!worldBossRareRoll(def, t)) missAt = t;
  const boss2 = spawnBoss(sim, 'ysondre');
  worldBossOnKill(boss2, killCtx(sim, freshWorldBossLedger(), missAt, [], []));
  assert.ok(!mountUnlocked(sim.player, 'drake'));

  // Companion drop: Emeriss grants the sprite darter on a hit.
  const emeriss = WORLD_BOSSES.emeriss;
  let petAt = -1;
  for (let t = 0; t < 4000 && petAt < 0; t += 41) if (worldBossRareRoll(emeriss, t)) petAt = t;
  assert.ok(petAt >= 0);
  worldBossOnKill(spawnBoss(sim, 'emeriss'), killCtx(sim, freshWorldBossLedger(), petAt, [], []));
  assert.ok(companionOwned(sim.player, 'sprite-darter'));
});

// ── Achievements ─────────────────────────────────────────────────────────────

test('world boss kills credit their own achievement and the distinct meta', () => {
  const { sim } = setup();
  const ledger = freshWorldBossLedger();
  const items: GroundItem[] = [], gold: GroundGold[] = [];

  worldBossOnKill(spawnBoss(sim, 'kazzak'), killCtx(sim, ledger, 10, items, gold));
  assert.ok(achievementComplete(sim.player.achievements, 'lord-kazzak'));
  assert.ok(sim.player.achievements!['seen:worldboss:kazzak']);
  assert.ok(!achievementComplete(sim.player.achievements, 'azuregos'));
  assert.ok(!achievementComplete(sim.player.achievements, 'outdoor-raider'));

  for (const id of ['azuregos', 'emeriss', 'ysondre'] as const)
    worldBossOnKill(spawnBoss(sim, id), killCtx(sim, ledger, 20, items, gold));
  assert.ok(achievementComplete(sim.player.achievements, 'outdoor-raider'));

  // Guards and non-boss actors never stamp the ledger or credit achievements.
  const guard = sim.enemies.find(e => e.campMemberId === worldBossGuardId(0))
    ?? sim.spawnEnemy('stalker', 0, 0, 'normal', { campId: worldBossCampId('kazzak'), memberId: worldBossGuardId(0), lootSeed: 1 })!;
  const before = { ...ledger.killedAt };
  assert.deepEqual(worldBossOnKill(guard, killCtx(sim, ledger, 30, [], [])), []);
  assert.deepEqual(ledger.killedAt, before);
  const plain = sim.spawnEnemy('stalker', 0, 0, 'normal')!;
  assert.deepEqual(worldBossOnKill(plain, killCtx(sim, ledger, 30, [], [])), []);
});

// ── Fight AI ─────────────────────────────────────────────────────────────────

test('the boss engages inside its awareness ring and cycles its authored abilities', () => {
  const { sim } = setup();
  const boss = spawnBoss(sim, 'kazzak');
  const lair = { x: boss.homeX, y: boss.homeY };
  const hits: { amount: number; type: string }[] = [];
  const c = aiCtx(sim, hits);

  // Player outside awareness: the boss stays idle.
  sim.player.x = lair.x + WORLD_BOSS_RULES.awareness + 200; sim.player.y = lair.y;
  step(boss, c);
  assert.equal(boss.state, 'idle');

  // Inside awareness: alertEnemy lands in chase, then the chase branch commits
  // the first authored ability (sweep at melee range) on the same tick.
  sim.player.x = lair.x + 120; sim.player.y = lair.y;
  step(boss, c);
  assert.equal(boss.state, 'windup');
  assert.equal(boss.bossMove, 'sweep');
  boss.stateTime = boss.stateDuration;
  step(boss, c);
  assert.equal(boss.state, 'attack');
  boss.stateTime = boss.stateDuration;
  step(boss, c);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0]!.type, 'shadow');
  assert.equal(boss.state, 'recover');
});

test('the boss leashes home, resets, and rallies only its own escort', () => {
  const { sim } = setup();
  const boss: Enemy = spawnBoss(sim, 'emeriss');
  const lair = { x: boss.homeX, y: boss.homeY };
  const hits: { amount: number; type: string }[] = [];
  const c = aiCtx(sim, hits);
  const guard = sim.spawnEnemy('stalker', lair.x + 60, lair.y, 'veteran',
    { campId: worldBossCampId('emeriss'), memberId: worldBossGuardId(2), lootSeed: 7, level: 58 })!;
  const outsider = sim.spawnEnemy('stalker', lair.x + 60, lair.y, 'veteran',
    { campId: 'site:other', memberId: 'm0', lootSeed: 8, level: 58 })!;

  // Engage, then drag the player past the leash: the boss returns and heals at home.
  sim.player.x = lair.x + 100; sim.player.y = lair.y;
  step(boss, c);
  assert.equal(boss.awareness, 1);
  boss.hp = boss.maxHp / 2;
  sim.player.x = lair.x + WORLD_BOSS_RULES.leash + 50;
  step(boss, c);
  // The boss never left its anchor, so the return resolves to a full reset
  // the same tick.
  assert.equal(boss.state, 'idle');
  assert.equal(boss.hp, boss.maxHp);

  // Re-engage; the escort alerts with the boss, outsiders do not.
  sim.player.x = lair.x + 100;
  step(boss, c);
  assert.equal(boss.awareness, 1);
  assert.equal(guard.awareness, 1);
  assert.equal(outsider.awareness, 0);

  // Drive turns until the command move completes its windup and rallies the escort.
  let turns = 0;
  while (!(boss.bossMove === 'command' && (boss.state as Enemy['state']) === 'attack') && turns++ < 60) {
    if ((boss.state as Enemy['state']) === 'recover' || (boss.state as Enemy['state']) === 'windup' || (boss.state as Enemy['state']) === 'attack') {
      boss.stateTime = boss.stateDuration;
    }
    step(boss, c);
  }
  assert.equal(boss.bossMove, 'command');
  assert.ok(guard.rallyTime! > 0);
  assert.equal(outsider.rallyTime ?? 0, 0);
});

test('world boss identity helpers only match the boss actor', () => {
  const { sim } = setup();
  const boss = spawnBoss(sim, 'ysondre');
  assert.ok(isWorldBossActor(boss));
  assert.equal(worldBossName(boss), 'Ysondre');
  const guard = sim.spawnEnemy('hound', boss.x + 40, boss.y, 'elite',
    { campId: worldBossCampId('ysondre'), memberId: worldBossGuardId(0), lootSeed: 3 })!;
  assert.ok(!isWorldBossActor(guard));
  assert.equal(worldBossName(guard), undefined);
  const lair = sim.spawnEnemy('briarMatriarch', 0, 0, 'normal',
    { campId: 'site:7319:lair:1:1', memberId: 'm0', lootSeed: 4 })!;
  assert.ok(!isWorldBossActor(lair));
  assert.equal(worldBossByCampId('site:7319:lair:1:1'), null);
  assert.equal(worldBossByCampId(undefined), null);
});
