import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { GHOST_RULES } from '../src/death-content.ts';
import type { Input, WorldQuery } from '../src/model.ts';

const emptyWorld: WorldQuery = {
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
};
const idle: Input = { moveX: 0, moveY: 0, aimX: 200, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const make = () => new Simulation(emptyWorld, { spawn: false, seed: 42 });
const advance = (sim: Simulation, duration: number, input: Partial<Input> = {}) => {
  for (let i = 0; i < Math.round(duration / FIXED_STEP); i++) sim.update(FIXED_STEP, { ...idle, ...input });
};
const kill = (sim: Simulation) => { sim.player.invulnerable = 0; sim.takeDamage(1e9, 0, 1, 'physical'); };

test('release spirit: ghost at graveyard, corpse marked, no combat', () => {
  const sim = make();
  kill(sim);
  assert.equal(sim.player.dead, true);
  assert.equal(sim.releaseSpirit({ x: 400, y: 0, name: 'Haven' }), true);
  const ghost = sim.ghost!;
  assert.ok(ghost);
  assert.equal(sim.player.dead, false);
  assert.equal(sim.player.x, 400);
  assert.equal(ghost.corpse.x, 0);
  // Ghost moves (faster than base speed) but cannot attack or target.
  const before = sim.player.x;
  advance(sim, 1, { moveX: -1, attack: true, skillSlot: 0, heal: true, dodge: true });
  assert.ok(sim.player.x < before);
  assert.equal(sim.player.attack, null);
  assert.equal(sim.player.targetId, null);
  assert.equal(sim.player.cast, null);
  // Ghost is untouchable.
  sim.takeDamage(1e9, 0, 1, 'physical');
  assert.equal(sim.player.dead, false);
  assert.ok(sim.player.hp > 0);
  // Checkpoint still records the run as dead (classic reload semantics).
  assert.equal(sim.captureCheckpoint().dead, true);
});

test('corpse resurrection restores play with a light sickness', () => {
  const sim = make();
  kill(sim);
  sim.releaseSpirit({ x: 400, y: 0, name: 'Haven' });
  // Run back to the corpse.
  for (let i = 0; i < 4000 && sim.ghostPrompt() !== 'corpse'; i++)
    sim.update(FIXED_STEP, { ...idle, moveX: -1 });
  assert.equal(sim.ghostPrompt(), 'corpse');
  assert.equal(sim.resurrectAtCorpse(), true);
  assert.equal(sim.ghost, null);
  assert.equal(sim.player.dead, false);
  assert.equal(sim.player.hp, Math.round(sim.player.maxHp * GHOST_RULES.corpseHealth));
  const sickness = sim.player.buffs?.find(b => b.id === 'rez-sickness');
  assert.ok(sickness);
  assert.equal(sickness.remaining, 20);
});

test('spirit healer resurrection costs durability and a long sickness', () => {
  const sim = make();
  kill(sim);
  sim.releaseSpirit({ x: 400, y: 0, name: 'Haven' });
  assert.equal(sim.ghostPrompt(), 'healer');
  assert.equal(sim.resurrectAtHealer(), true);
  assert.equal(sim.ghost, null);
  assert.equal(sim.player.hp, Math.round(sim.player.maxHp * GHOST_RULES.healerHealth));
  const sickness = sim.player.buffs?.find(b => b.id === 'rez-sickness');
  assert.ok(sickness);
  assert.equal(sickness.remaining, 120);
});

test('release is refused while alive, in a dungeon, or twice', () => {
  const sim = make();
  assert.equal(sim.releaseSpirit({ x: 0, y: 0, name: 'Haven' }), false);
  kill(sim);
  sim.dungeonFloor = {} as never;
  assert.equal(sim.releaseSpirit({ x: 0, y: 0, name: 'Haven' }), false);
  sim.dungeonFloor = null;
  assert.equal(sim.releaseSpirit({ x: 0, y: 0, name: 'Haven' }), true);
  assert.equal(sim.releaseSpirit({ x: 0, y: 0, name: 'Haven' }), false);
});

test('classic revive still works and clears ghost state', () => {
  const sim = make();
  kill(sim);
  sim.revive();
  assert.equal(sim.player.dead, false);
  assert.equal(sim.ghost, null);
  assert.equal(sim.player.hp, sim.player.maxHp);
});
