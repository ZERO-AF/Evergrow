import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { updateEnemyAI, type EnemyAIContext } from '../src/enemy-ai.ts';
import { KILL_STREAK, TREASURE_GOBLIN, affixDamageMultiplier, eliteAffix, streakBonusFraction, treasureGoblinSeed } from '../src/combat-content.ts';
import { isGlyphItem } from '../src/glyph-content.ts';
import { isBagItem } from '../src/bag-content.ts';
import type { CombatEvent, Enemy, Input, WorldQuery } from '../src/model.ts';

const emptyWorld: WorldQuery = {
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
};
const idle: Input = { moveX: 0, moveY: 0, aimX: 200, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const make = (world = emptyWorld) => new Simulation(world, { spawn: false, seed: 42 });

function advance(sim: Simulation, duration: number, input: Partial<Input> = {}, step = FIXED_STEP): void {
  for (let i = 0; i < Math.round(duration / step); i++) sim.update(step, { ...idle, ...input });
}

/** lootSeed values picked so the affix roll lands on the requested affix. */
const AFFIX_SEED = { molten: 16, arcane: 4, frozen: 3, swift: 13, shielding: 1, avenger: 5 } as const;
const TREASURE_SEED = 42;

function elite(sim: Simulation, affix: keyof typeof AFFIX_SEED, x = 60, y = 0, kind: Parameters<Simulation['spawnEnemy']>[0] = 'brute'): Enemy {
  const enemy = sim.spawnEnemy(kind, x, y, 'elite', { campId: `t-${affix}-${x}`, memberId: `m-${affix}-${x}`, lootSeed: AFFIX_SEED[affix] })!;
  assert.equal(enemy.affix, affix, `seed ${AFFIX_SEED[affix]} should roll ${affix}`);
  return enemy;
}

function killWithBolt(sim: Simulation, enemy: Enemy, damage = 99999): void {
  // Vertical approach: no corpse or packmate ever sits in the bolt's path.
  sim.projectiles.push({ id: 9000 + enemy.id, sourceLevel: 1, x: enemy.x, y: enemy.y - 12, prevX: enemy.x, prevY: enemy.y - 12,
    vx: 0, vy: 4000, angle: Math.PI / 2, radius: 6, damage, life: 1, maxLife: 1, owner: 'player', hitIds: new Set() });
  advance(sim, .2);
}

/** Minimal AI context: player parked at (0,0), world open, events captured. */
function aiContext(sim: Simulation, events: CombatEvent[] = [], buffs: string[] = [], hurtTypes: string[] = []): EnemyAIContext {
  return {
    player: sim.player, players: [sim.player], enemies: sim.enemies, world: emptyWorld, time: sim.time, trial: null,
    visible: () => true,
    move: (enemy, vx, vy, dt) => { enemy.x += vx * dt; enemy.y += vy * dt; },
    hurt: (amount, _angle, _actor, type) => { hurtTypes.push(type); sim.player.hp -= amount; },
    shoot: () => {},
    emit: event => events.push(event),
    dropGold: enemy => { enemy.treasure!.drops++; },
    addBuff: name => buffs.push(name),
  };
}

/** Mirrors the sim loop: stateTime advances before each AI tick. */
function tick(enemy: Enemy, context: EnemyAIContext, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) {
    enemy.stateTime += FIXED_STEP;
    updateEnemyAI(enemy, FIXED_STEP, context);
  }
}

test('elites roll a deterministic affix from their loot seed', () => {
  const sim = make();
  for (const [affix, seed] of Object.entries(AFFIX_SEED)) {
    const enemy = sim.spawnEnemy('brute', 60, 0, 'elite', { campId: 'c', memberId: `m${seed}`, lootSeed: seed })!;
    assert.equal(enemy.affix, affix);
    assert.equal(eliteAffix(enemy), affix);
  }
  const normal = sim.spawnEnemy('brute', 60, 0, 'normal', { campId: 'c', memberId: 'n', lootSeed: 16 })!;
  assert.equal(normal.affix, undefined, 'non-elites never roll affixes');
  const boss = sim.spawnEnemy('warden', 60, 0, 'elite', { campId: 'c', memberId: 'b', lootSeed: 16 })!;
  assert.equal(boss.affix, undefined, 'bosses never roll affixes');
});

test('molten elites leave burning patches that hurt the player', () => {
  const sim = make();
  const enemy = elite(sim, 'molten', 30, 0);
  enemy.awareness = 1; enemy.state = 'chase';
  const events: CombatEvent[] = [], hurtTypes: string[] = [];
  const context = aiContext(sim, events, [], hurtTypes);
  tick(enemy, context, 2);
  const patches = enemy.affixState?.patches ?? [];
  assert.ok(patches.length > 0, 'molten drops burning ground');
  assert.ok(hurtTypes.includes('fire'), 'the burning trail deals fire damage');
});

test('arcane elites sweep a rotating beam that damages the player', () => {
  const sim = make();
  const enemy = elite(sim, 'arcane', 120, 0);
  enemy.awareness = 1; enemy.state = 'chase';
  const hurtTypes: string[] = [];
  const context = aiContext(sim, [], [], hurtTypes);
  tick(enemy, context, 8);
  assert.ok(hurtTypes.includes('arcane'), 'the rotating beam connects during its active window');
});

test('frozen elites detonate a chilling nova on a timer', () => {
  const sim = make();
  const enemy = elite(sim, 'frozen', 60, 0);
  enemy.awareness = 1; enemy.state = 'chase';
  const events: CombatEvent[] = [], buffs: string[] = [], hurtTypes: string[] = [];
  const context = aiContext(sim, events, buffs, hurtTypes);
  tick(enemy, context, 6);
  assert.ok(events.some(e => e.type === 'blast' && e.style === 'frost'), 'nova telegraphs with a frost blast');
  assert.ok(hurtTypes.includes('frost'), 'the nova damages the player');
  assert.ok(buffs.includes('Chilled'), 'the nova applies a chill');
});

test('swift elites commit to shorter windups', () => {
  // Separate sims keep separation steering from pushing the pair apart.
  const windup = (seed: number) => {
    const sim = make();
    const enemy = sim.spawnEnemy('brute', 60, 0, 'elite', { campId: 'c', memberId: 'm', lootSeed: seed })!;
    enemy.awareness = 1; enemy.state = 'chase' as Enemy['state'];
    const context = aiContext(sim);
    for (let i = 0; i < 1200 && enemy.state !== 'windup'; i++) {
      enemy.stateTime += FIXED_STEP;
      updateEnemyAI(enemy, FIXED_STEP, context);
    }
    assert.equal(enemy.state, 'windup');
    return enemy.stateDuration;
  };
  const swift = windup(AFFIX_SEED.swift);
  const slow = windup(62); // Same trait set, frozen affix: isolates swift's speedup.
  assert.ok(swift < slow * .9, `swift windup ${swift} beats ${slow}`);
});

test('shielding elites ignore all damage during the window', () => {
  const sim = make();
  const enemy = elite(sim, 'shielding', 60, 0);
  enemy.awareness = 1; enemy.state = 'chase';
  const events: CombatEvent[] = [];
  const context = aiContext(sim, events);
  for (let i = 0; i < Math.round(7.5 / FIXED_STEP) && !(enemy.affixState?.shielded); i++) {
    enemy.stateTime += FIXED_STEP;
    updateEnemyAI(enemy, FIXED_STEP, context);
  }
  assert.ok((enemy.affixState?.shielded ?? 0) > 0, 'shielding window opens on the period');
  const hp = enemy.hp;
  killWithBolt(sim, enemy);
  assert.equal(enemy.hp, hp, 'a shielded elite takes zero damage');
  assert.ok(sim.drainEvents().some(e => e.type === 'block'), 'the block is announced');
});

test('avenger elites grow when a packmate dies nearby', () => {
  const sim = make();
  const a = elite(sim, 'avenger', 30, 0);
  const b = sim.spawnEnemy('brute', 90, 0, 'elite', { campId: 'c', memberId: 'm27', lootSeed: 27 })!;
  assert.equal(b.affix, 'avenger');
  const before = affixDamageMultiplier(a);
  killWithBolt(sim, b);
  assert.equal((a.affixState?.stacks ?? 0), 1, 'a nearby death adds a stack');
  assert.ok(affixDamageMultiplier(a) > before, 'stacks multiply damage');
  const far = sim.spawnEnemy('brute', 2000, 0, 'elite', { campId: 'c', memberId: 'm8', lootSeed: 8 })!;
  assert.equal(far.affix, 'avenger');
  killWithBolt(sim, far);
  assert.equal(a.affixState?.stacks, 1, 'distant deaths do not feed the avenger');
});

test('kill streaks chain inside the window, announce thresholds and boost XP', () => {
  const sim = make();
  sim.drainEvents();
  const kills: Enemy[] = [];
  for (let i = 0; i < 10; i++) kills.push(sim.spawnEnemy('goblin', 40 + i * 30, 0)!);
  for (const enemy of kills) killWithBolt(sim, enemy);
  assert.equal(sim.player.killStreak?.count, 10, 'ten chained kills build the streak');
  const events = sim.drainEvents();
  const banner = events.find(e => e.type === 'streak');
  assert.ok(banner && banner.type === 'streak' && banner.count === 10, 'the 10-kill threshold announces');
  const xp = events.filter(e => e.type === 'experience').map(e => e.amount);
  assert.ok(xp[xp.length - 1] > xp[0], 'streak kills award bonus XP');
  assert.equal(streakBonusFraction(10), .1);
  // A gap longer than the window resets the chain.
  advance(sim, KILL_STREAK.window + 1);
  killWithBolt(sim, sim.spawnEnemy('goblin', 40, 0)!);
  assert.equal(sim.player.killStreak?.count, 1, 'the streak resets after the window');
});

test('treasure goblins flee, shed gold, fountain loot on death and portal out', () => {
  const sim = make();
  const goblin = sim.spawnEnemy('goblin', 200, 0, 'normal', { campId: 'c', memberId: 'tg', lootSeed: TREASURE_SEED })!;
  assert.ok(goblin.treasure, 'seed 42 rolls a treasure goblin');
  assert.ok(treasureGoblinSeed(goblin));
  const ordinary = sim.spawnEnemy('goblin', 260, 0, 'normal', { campId: 'c', memberId: 'g1', lootSeed: 7 })!;
  assert.equal(ordinary.treasure, undefined, 'ordinary goblins stay ordinary');
  // Awareness builds, then the goblin routs away from the player.
  advance(sim, 1);
  assert.ok(goblin.treasure.fleeing > 0, 'the goblin bolts once aware');
  const startX = goblin.x;
  advance(sim, 2);
  assert.ok(goblin.x > startX + 60, 'it flees away from the player');
  assert.ok(sim.groundGold.length >= 2, 'it sheds a gold trail');
  assert.ok(goblin.state !== 'windup' && goblin.state !== 'attack', 'it never attacks');
  // Killing it erupts in a guaranteed rare+ fountain.
  const itemsBefore = sim.groundItems.length, goldBefore = sim.groundGold.length;
  killWithBolt(sim, goblin);
  const drops = sim.groundItems.slice(itemsBefore).filter(d => !isGlyphItem(d.item) && !isBagItem(d.item));
  assert.ok(drops.length >= 2, 'the fountain drops multiple items');
  assert.ok(drops.every(d => ['rare', 'epic', 'legendary', 'unique'].includes(d.item.tier)),
    'every fountain item is rare or better');
  assert.ok(sim.groundGold.length - goldBefore >= TREASURE_GOBLIN.fountainGold, 'the fountain bursts gold');
  // A goblin that survives the escape window portals out instead of dying.
  const escapee = sim.spawnEnemy('goblin', 200, 0, 'normal', { campId: 'c', memberId: 'tg2', lootSeed: TREASURE_SEED })!;
  advance(sim, TREASURE_GOBLIN.escapeSeconds + 2);
  assert.equal(escapee.state, 'dead', 'the goblin despawns through its portal');
  assert.ok(sim.drainEvents().some(e => e.type === 'notice' && /portal/i.test(e.message)), 'the escape is announced');
});

test('kill loot arcs out of the corpse along a treasure flight', () => {
  const sim = make();
  const enemy = sim.spawnEnemy('brute', 60, 0)!;
  killWithBolt(sim, enemy);
  const drops = sim.groundItems.filter(item => item.flight);
  assert.ok(drops.length >= 1, 'first-kill loot flies out of the corpse');
  for (const drop of drops) {
    assert.equal(drop.flight!.x, 60, 'the arc starts at the corpse');
    assert.ok(Math.hypot(drop.x - 60, drop.y) > 10, 'the landing spot scatters');
  }
});
