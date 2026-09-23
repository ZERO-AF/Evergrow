import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { mountToggle } from '../src/mount-command.ts';
import { mountSpeedFactor, summonCast } from '../src/mount-state.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }), isSanctuary: () => false, indoors: () => false };
const idle = { moveX: 0, moveY: 0, attack: false, dodge: false, skillSlot: null, heal: false, interact: false, cycleTarget: false, targetId: undefined } as any;

test('mount summons, mounts, and grants speed', () => {
  const sim = new Simulation(world as any, { spawn: false });
  const p = sim.player;
  const r = mountToggle(sim);
  assert.equal(r.ok, true, r.message);
  assert.ok(summonCast(sim), 'summon cast started');
  for (let i = 0; i < 600 && !p.mounted; i++) sim.update(1 / 120, idle);
  assert.ok(p.mounted, 'mounted after cast');
  assert.ok(mountSpeedFactor(p) > 1, 'speed boost active');
});
