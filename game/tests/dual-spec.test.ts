import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import type { WorldQuery } from '../src/model.ts';
import { createCharacterSheet } from '../src/items.ts';
import { SKILL_NODES, SKILL_TREE_ORIGIN } from '../src/skill-tree.ts';
import { BAR_TOTAL } from '../src/action-bar.ts';
import {
  DUAL_SPEC_COUNT, DUAL_SPEC_NAMES, SPEC_NAME_MAX, activeSpecIndex, applySpec, captureSpec,
  dualSpecProblem, dualSpecUnlocked, dualSpecView, emptySpec, inactiveSpecIndex, resetSpecs,
  specSpentPoints, specUnspentPoints, syncActiveSpec, validSpec, validSpecs, type DualSpecSheet,
} from '../src/dual-spec-state.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const sheet = (): DualSpecSheet => createCharacterSheet('warrior', 'human');
/** First non-class-gated neighbor of the origin — a real paid node. */
const paidNode = () => SKILL_NODES.get(SKILL_TREE_ORIGIN)!.neighbors
  .map(id => SKILL_NODES.get(id)!).find(node => !node.classId && !node.free)!.id;

test('emptySpec is a fresh origin-only build with a full empty bar', () => {
  const spec = emptySpec('Alt');
  assert.equal(spec.name, 'Alt');
  assert.deepEqual(spec.allocatedNodes, [SKILL_TREE_ORIGIN]);
  assert.equal(spec.skillSlots.length, BAR_TOTAL);
  assert.ok(spec.skillSlots.every(slot => slot === null));
  assert.equal(specSpentPoints(spec), 0);
});

test('specSpentPoints counts paid nodes and purchased ranks, never free nodes', () => {
  const s = sheet();
  // Fresh sheet: origin + free class starter — nothing spent.
  assert.equal(specSpentPoints({ allocatedNodes: s.allocatedNodes, skillRanks: s.skillRanks }), 0);
  const node = paidNode();
  assert.equal(specSpentPoints({ allocatedNodes: [...s.allocatedNodes, node], skillRanks: {} }), 1);
  assert.equal(specSpentPoints({ allocatedNodes: s.allocatedNodes, skillRanks: { cleave: 3 } }), 2);
  assert.equal(specUnspentPoints({ allocatedNodes: [...s.allocatedNodes, node], skillRanks: {} }, 5), 3);
  assert.equal(specUnspentPoints({ allocatedNodes: [...s.allocatedNodes, node], skillRanks: {} }, 1), 0);
});

test('captureSpec snapshots the live build and applySpec restores it', () => {
  const s = sheet();
  const node = paidNode();
  s.allocatedNodes.push(node);
  s.skillPoints = 4;
  s.skillRanks = { heroicStrike: 3 };
  s.activeSkillRanks = { heroicStrike: 2 };
  const spec = captureSpec(s, 'Raid');
  assert.equal(spec.name, 'Raid');
  assert.ok(spec.allocatedNodes.includes(node));
  assert.equal(spec.skillRanks.heroicStrike, 3);
  // Apply onto a wiped sheet restores the build and recomputes unspent points.
  const target = sheet();
  target.allocatedNodes = [SKILL_TREE_ORIGIN, `wow-warrior-${'heroicStrike'}`];
  applySpec(target, spec, 10);
  assert.ok(target.allocatedNodes.includes(node));
  assert.equal(target.skillRanks.heroicStrike, 3);
  assert.equal(target.activeSkillRanks.heroicStrike, 2);
  assert.equal(target.skillPoints, 10 - 1 - specSpentPoints(spec));
});

test('spec indices resolve the active and inactive builds', () => {
  const s = sheet();
  assert.equal(activeSpecIndex(s), 0);
  assert.equal(inactiveSpecIndex(s), 1);
  s.specs = [emptySpec('A'), emptySpec('B')];
  s.activeSpec = 1;
  assert.equal(activeSpecIndex(s), 1);
  assert.equal(inactiveSpecIndex(s), 0);
  s.activeSpec = 9;
  assert.equal(activeSpecIndex(s), 0, 'out-of-range falls back to the primary');
});

test('syncActiveSpec re-mirrors the live build into its slot', () => {
  const s = sheet();
  s.specs = [emptySpec('A'), emptySpec('B')];
  const node = paidNode();
  s.allocatedNodes.push(node);
  syncActiveSpec(s);
  assert.ok(s.specs[0].allocatedNodes.includes(node));
  assert.equal(s.specs[1].allocatedNodes.length, 1, 'the inactive spec is untouched');
});

test('resetSpecs wipes builds back to origin while keeping the unlock', () => {
  const s = sheet();
  s.specs = [captureSpec(s, 'A'), emptySpec('B')];
  s.specs[0].allocatedNodes.push(paidNode());
  s.activeSpec = 1;
  resetSpecs(s);
  assert.ok(dualSpecUnlocked(s));
  assert.equal(s.activeSpec, 0);
  assert.ok(s.specs.every(spec => spec.allocatedNodes.length === 1 && spec.allocatedNodes[0] === SKILL_TREE_ORIGIN));
});

test('validSpec enforces known connected nodes, uniqueness and the point budget', () => {
  const node = paidNode();
  const base = { name: 'A', allocatedNodes: [SKILL_TREE_ORIGIN, node], skillSlots: Array(BAR_TOTAL).fill(null),
    skillRanks: {}, activeSkillRanks: {}, skillSpecializations: {}, arcaneOverload: false };
  assert.ok(validSpec(base, 'warrior', 'human', 5));
  assert.equal(validSpec({ ...base, allocatedNodes: [node] }, 'warrior', 'human', 5), false, 'missing origin');
  assert.equal(validSpec({ ...base, allocatedNodes: [SKILL_TREE_ORIGIN, node, node] }, 'warrior', 'human', 5), false, 'duplicate');
  assert.equal(validSpec({ ...base, allocatedNodes: [SKILL_TREE_ORIGIN, 'nonsense:node'] }, 'warrior', 'human', 5), false, 'unknown node');
  assert.equal(validSpec(base, 'warrior', 'human', 1), false, 'a paid node exceeds the level-1 budget');
  assert.equal(validSpec({ ...base, name: 'x'.repeat(SPEC_NAME_MAX + 1) }, 'warrior', 'human', 5), false, 'name too long');
  assert.equal(validSpec(null, 'warrior', 'human', 5), false);
});

test('validSpec rejects foreign class sanctum nodes', () => {
  const mageNode = [...SKILL_NODES.values()].find(node => node.classId === 'mage')!;
  const spec = { name: 'A', allocatedNodes: [SKILL_TREE_ORIGIN, mageNode.id], skillSlots: Array(BAR_TOTAL).fill(null),
    skillRanks: {}, activeSkillRanks: {}, skillSpecializations: {}, arcaneOverload: false };
  // Seed the node's neighbors as trained so connectivity passes — class gating is
  // then the only thing separating a valid mage build from a foreign warrior one.
  const trained = mageNode.neighbors;
  assert.equal(validSpec(spec, 'warrior', 'human', 80, trained), false);
  assert.ok(validSpec(spec, 'mage', 'human', 80, trained));
});

test('validSpecs requires a full legal pair with a consistent active index', () => {
  const a = emptySpec('A'), b = emptySpec('B');
  assert.ok(validSpecs(undefined, undefined, 'warrior', 'human', 10));
  assert.ok(validSpecs([a, b], 0, 'warrior', 'human', 10));
  assert.ok(validSpecs([a, b], 1, 'warrior', 'human', 10));
  assert.equal(validSpecs([a], 0, 'warrior', 'human', 10), false, 'one spec is not a pair');
  assert.equal(validSpecs([a, b], 2, 'warrior', 'human', 10), false, 'active index out of range');
  assert.equal(validSpecs([a, b], undefined, 'warrior', 'human', 10), false);
  assert.equal(validSpecs(undefined, 0, 'warrior', 'human', 10), false, 'index without specs');
  assert.equal(validSpecs([a, { ...b, allocatedNodes: [] }], 0, 'warrior', 'human', 10), false);
});

test('dualSpecProblem blocks swaps while dead, in dungeons or in combat', () => {
  const sim = new Simulation(world, { spawn: false });
  assert.equal(dualSpecProblem(sim), null);
  sim.player.dead = true;
  assert.match(dualSpecProblem(sim)!, /defeated/);
  sim.player.dead = false;
  const enemy = sim.spawnEnemy('stalker', 40, 0)!;
  enemy.state = 'chase';
  assert.match(dualSpecProblem(sim)!, /in combat/);
  enemy.state = 'dead';
  assert.equal(dualSpecProblem(sim), null);
});

test('dualSpecView reports live values for the active spec and stored for the rest', () => {
  const sim = new Simulation(world, { spawn: false });
  const p = sim.player;
  const s = p.character as DualSpecSheet;
  p.level = 10;
  s.skillPoints = 6;
  s.specs = [emptySpec(DUAL_SPEC_NAMES[0]), emptySpec(DUAL_SPEC_NAMES[1])];
  const view = dualSpecView(p);
  assert.equal(view.unlocked, true);
  assert.equal(view.active, 0);
  assert.equal(view.specs.length, DUAL_SPEC_COUNT);
  assert.equal(view.specs[0].spent, 10 - 1 - 6, 'active spec derives spent from the live pool');
  assert.equal(view.specs[0].unspent, 6);
  assert.equal(view.specs[1].spent, 0);
  assert.equal(view.specs[1].unspent, 9);
});
