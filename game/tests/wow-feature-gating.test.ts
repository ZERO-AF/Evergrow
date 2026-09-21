import test from 'node:test';
import assert from 'node:assert/strict';
import { achievementTrack } from '../src/achievement-state.ts';
import { awardKillRewards } from '../src/combat-rewards.ts';
import { Simulation } from '../src/simulation.ts';
import { GAME_FEATURES } from '../src/game-features.ts';
import type { Player } from '../src/model.ts';

const world = { seed: 7319, generationVersion: 4, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }), getPOIs: () => [] };

test('blackrock-depths unlocks when a blackrock-theme dungeon is cleared', () => {
  const player = { level: 1, achievements: {} } as unknown as Player;
  const unlocked = achievementTrack(player, { type: 'dungeon', id: 'dungeon:blackrock:site-1', theme: 'blackrock' });
  assert.ok(unlocked.some(a => a.id === 'blackrock-depths'), 'theme match must earn Blackrock Depths');
});

test('rested kill bonus only applies while the hearthstone feature is on', () => {
  const run = () => {
    const sim = new Simulation(world, { spawn: false });
    const p = sim.player;
    p.restedXp = 1000;
    const enemy = { ...sim.spawnEnemy('stalker', 40, 0)!, level: 1, rank: 'normal' as const, lootSeed: 741, xpReward: 20 };
    awardKillRewards(enemy, 0, 0, { player: p, groundGold: sim.groundGold, groundItems: sim.groundItems, pickups: sim.pickups, suppressDrops: true, nextId: (() => { let id = 200; return () => id++; })(), emit: () => {} });
    return { xp: p.xp, rested: p.restedXp };
  };
  const on = run();
  GAME_FEATURES.hearthstone = false;
  try {
    const off = run();
    assert.ok(on.xp > off.xp, 'rested pool must double kill XP while enabled');
    assert.equal(off.rested, 1000, 'disabled feature must not consume the rested pool');
  } finally {
    GAME_FEATURES.hearthstone = true;
  }
});
