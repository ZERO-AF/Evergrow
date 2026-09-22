import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { createCharacterSheet } from '../src/items.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { buffFrameModel, cancelBuff, buffCancelable, formatAuraTime } from '../src/buff-frame.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const make = () => new Simulation(world, { spawn: false });

test('a live player buff projects into the frame with its skill icon and duration', () => {
  const sim = make(), p = sim.player;
  sim.addBuff('Bulwark', '#a8c68a', { duration: 12, reduction: .3 }, 'bulwark');
  const model = buffFrameModel(p);
  assert.equal(model.debuffs.length, 0);
  const entry = model.buffs.find(b => b.key === 'bulwark')!;
  assert.equal(entry.name, 'Bulwark');
  assert.equal(entry.icon, 'bulwark', 'authored skill id keeps its glass icon');
  assert.equal(entry.duration, 12);
  assert.equal(entry.remaining, 12);
  assert.equal(entry.harmful, false);
  assert.equal(entry.cancelable, true);
  assert.match(entry.summary, /30%/);
  assert.equal(formatAuraTime(entry), '12');
});

test('expired buffs drop from the model and the projection never mutates the player', () => {
  const sim = make(), p = sim.player;
  sim.addBuff('Bulwark', '#a8c68a', { duration: 4 }, 'bulwark');
  sim.addBuff('Ward', '#9db8c7', { duration: 4, absorb: .2 }, 'runicWard');
  const before = p.buffs!.length;
  buffFrameModel(p);
  assert.equal(p.buffs!.length, before, 'projection is read-only');
  p.buffs![0]!.remaining = 0;
  const model = buffFrameModel(p);
  assert.deepEqual(model.buffs.map(b => b.key), ['runicWard']);
});

test('player crowd control and dots land in the harmful debuff row, never cancelable', () => {
  const sim = make(), p = sim.player;
  sim.addBuff('Bulwark', '#a8c68a', { duration: 12 }, 'bulwark');
  p.cc = [{ kind: 'slow', remaining: 3, breakOnDamage: false, factor: .5 }];
  p.dots = [{ id: 'ignite', school: 'fire', dps: 12.5, remaining: 6, tick: 1, interval: 1, source: 'player' }];
  const model = buffFrameModel(p);
  assert.deepEqual(model.buffs.map(b => b.key), ['bulwark']);
  assert.deepEqual(model.debuffs.map(d => d.key).sort(), ['cc:slow', 'dot:ignite']);
  const slow = model.debuffs.find(d => d.key === 'cc:slow')!;
  assert.equal(slow.name, 'Slowed');
  assert.equal(slow.harmful, true);
  assert.equal(slow.cancelable, false);
  const dot = model.debuffs.find(d => d.key === 'dot:ignite')!;
  assert.equal(dot.icon, 'fireball', 'fire school falls back to the fireball glyph');
  assert.match(dot.summary, /12\.5 fire damage/);
  p.cc![0]!.remaining = 0;
  assert.deepEqual(buffFrameModel(p).debuffs.map(d => d.key), ['dot:ignite'], 'expired cc drops');
});

test('reserved auras and the active mount join the buff row as persistent icons', () => {
  const sim = make(), p = sim.player;
  p.character = createCharacterSheet('mage', 'undead');
  p.level = 500; p.character.skillPoints = 499; p.character.statPoints = 2495;
  assert.ok(executeCharacterCommand(p, { type: 'allocateNode', id: 'skill:ironroot' }).ok);
  assert.ok(executeCharacterCommand(p, { type: 'assignSkill', slot: 0, skill: 'ironroot' }).ok);
  p.mounted = { id: 'wolf', since: 0 };
  const model = buffFrameModel(p);
  const aura = model.buffs.find(b => b.key === 'aura:ironroot')!;
  assert.equal(aura.name, 'Ironroot');
  assert.equal(aura.icon, 'ironroot');
  assert.equal(aura.persistent, true);
  assert.equal(aura.cancelable, false, 'auras dismiss through the skill bar, not right-click');
  assert.match(aura.summary, /Reserves \d+(\.\d+)?% mana/);
  const mount = model.buffs.find(b => b.key === 'mount')!;
  assert.equal(mount.name, 'Dire Wolf');
  assert.equal(mount.icon, 'mount:wolf');
  assert.equal(mount.cancelable, true);
  assert.equal(formatAuraTime(mount), '', 'persistent effects show no countdown');
});

test('cancelBuff removes a cancelable buff and refreshes stealth and stats', () => {
  const sim = make(), p = sim.player;
  sim.addBuff('Stealth', '#8a6fb8', { duration: 30, stealth: true }, 'prowl');
  assert.equal(p.stealthed, true);
  const result = cancelBuff(p, 'prowl');
  assert.equal(result.ok, true);
  assert.equal(p.buffs!.length, 0);
  assert.equal(p.stealthed, false, 'stealth flag re-syncs on removal');
  assert.equal(cancelBuff(p, 'prowl').ok, false, 'already-gone buff refuses');
});

test('cancelBuff refuses procs, resurrection sickness, auras and debuffs', () => {
  const sim = make(), p = sim.player;
  sim.addBuff('Relic Surge', '#f0a16b', { duration: 6 }, 'proc:ember-relic');
  sim.addBuff('Resurrection Sickness', '#9fb4d8', { duration: 60 }, 'rez-sickness');
  assert.equal(buffCancelable(p.buffs![0]!), false);
  assert.equal(buffCancelable(p.buffs![1]!), false);
  assert.equal(cancelBuff(p, 'proc:ember-relic').ok, false);
  assert.equal(cancelBuff(p, 'rez-sickness').ok, false);
  assert.equal(cancelBuff(p, 'aura:ironroot').ok, false);
  assert.equal(cancelBuff(p, 'cc:slow').ok, false);
  assert.equal(cancelBuff(p, 'mount').ok, false, 'not mounted');
  assert.equal(p.buffs!.length, 2, 'refusals never mutate the buff list');
});

test('cancelBuff dismounts and hands a bear form resource pool back', () => {
  const sim = make(), p = sim.player;
  p.mounted = { id: 'horse', since: 0 };
  assert.equal(cancelBuff(p, 'mount').ok, true);
  assert.equal(p.mounted, null);
  // Bear form swaps the mana pool for rage; cancel restores the stashed pool.
  p.character = createCharacterSheet('druid');
  p.mana = 80;
  sim.addBuff('Bear Form', '#b8c49a', { duration: 3600, form: 'bear', exclusiveGroup: 'form' }, 'bearForm');
  assert.equal(p.mana, 0, 'form swaps to an empty rage pool');
  assert.equal(cancelBuff(p, 'bearForm').ok, true);
  assert.equal(p.mana, 80, 'stashed mana returns on cancel');
  assert.equal(p.buffs!.length, 0);
});
