import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.ts';
import {
  PVP_ARENA_BRACKETS, PVP_BATTLEGROUNDS, PVP_LEVEL_MAX, PVP_LEVEL_MIN,
  createCustomBuild, createPvpDraft, pvpClassRoles, pvpTeamSize,
  setCustomClass, setCustomRace, setPvpBracket, setPvpMode, setTeammateClass, setTeammateRole, validPvpSetup,
} from '../src/pvp-setup.ts';
import { battlemasterFor, canInteractNPC } from '../src/npcs.ts';
import { queryPlaces } from '../src/world-geography.ts';
import { WOW_CLASS_IDS } from '../src/wow-types.ts';
import { raceAllowsClass } from '../src/wow-races.ts';

test('a fresh draft is a complete arena setup: 3v3 with two suggested teammates', () => {
  const draft = createPvpDraft();
  assert.equal(draft.step, 'mode');
  assert.equal(draft.mode, 'arena');
  assert.equal(draft.bracket, '3v3');
  assert.equal(draft.teammates.length, 2);
  assert.ok(draft.teammates.every(t => pvpClassRoles(t.classId).includes(t.role)));
  const setup = validPvpSetup(draft, true)!;
  assert.equal(setup.mode, 'arena');
  assert.equal(setup.bracket, '3v3');
  assert.equal(setup.teammates.length, 2);
  assert.equal(setup.custom, null);
});

test('bracket changes resize the roster and keep surviving picks', () => {
  const draft = createPvpDraft();
  draft.teammates[0] = { classId: 'mage', role: 'dd' };
  setPvpBracket(draft, '4v4');
  assert.equal(draft.teammates.length, 3);
  assert.deepEqual(draft.teammates[0], { classId: 'mage', role: 'dd' });
  setPvpBracket(draft, '2v2');
  assert.equal(draft.teammates.length, 1);
  assert.deepEqual(draft.teammates[0], { classId: 'mage', role: 'dd' });
});

test('switching to battleground resets the bracket and grows the roster', () => {
  const draft = createPvpDraft();
  setPvpMode(draft, 'battleground');
  assert.equal(draft.mode, 'battleground');
  assert.equal(draft.bracket, PVP_BATTLEGROUNDS[0].id);
  assert.equal(draft.teammates.length, pvpTeamSize(PVP_BATTLEGROUNDS[0].id) - 1);
  setPvpMode(draft, 'arena');
  assert.equal(draft.bracket, '3v3');
  assert.equal(draft.teammates.length, 2);
});

test('teammate roles stay legal for the picked class', () => {
  const draft = createPvpDraft();
  setTeammateClass(draft, 0, 'mage');
  assert.deepEqual(pvpClassRoles('mage'), ['dd']);
  assert.equal(draft.teammates[0].role, 'dd');
  setTeammateRole(draft, 0, 'heal');
  assert.equal(draft.teammates[0].role, 'dd', 'mage cannot heal');
  setTeammateClass(draft, 0, 'paladin');
  setTeammateRole(draft, 0, 'tank');
  assert.equal(draft.teammates[0].role, 'tank');
  setTeammateClass(draft, 0, 'hunter');
  assert.equal(draft.teammates[0].role, 'dd', 'illegal role snaps to the class default');
});

test('custom builds keep race/class legal and validate level bounds', () => {
  const draft = createPvpDraft();
  draft.custom = createCustomBuild('warrior', 'human');
  setCustomRace(draft.custom, 'nightElf');
  assert.equal(draft.custom.raceId, 'nightElf');
  // Night elf cannot be a mage in WotLK, so picking mage auto-corrects the race.
  setCustomClass(draft.custom, 'mage');
  assert.ok(raceAllowsClass(draft.custom.raceId, 'mage'));
  assert.equal(draft.custom.classId, 'mage');
  setCustomRace(draft.custom, 'tauren');
  assert.notEqual(draft.custom.raceId, 'tauren', 'tauren cannot be a mage');
  draft.custom.level = PVP_LEVEL_MIN - 1;
  assert.equal(validPvpSetup(draft, false), null);
  draft.custom.level = PVP_LEVEL_MAX;
  const setup = validPvpSetup(draft, false)!;
  assert.equal(setup.custom!.level, PVP_LEVEL_MAX);
  assert.equal(setup.custom!.role, 'dd');
});

test('a draft without a character needs a custom build to enter', () => {
  const draft = createPvpDraft();
  assert.equal(validPvpSetup(draft, false), null);
  draft.custom = createCustomBuild();
  assert.ok(validPvpSetup(draft, false));
});

test('every arena bracket and battleground produces a legal roster', () => {
  for (const bracket of [...PVP_ARENA_BRACKETS, ...PVP_BATTLEGROUNDS.map(b => b.id)]) {
    const draft = createPvpDraft();
    setPvpBracket(draft, bracket);
    assert.equal(draft.teammates.length, pvpTeamSize(bracket) - 1, bracket);
    assert.ok(validPvpSetup(draft, true), bracket);
  }
});

test('cities field a reachable battlemaster beside the Count’s Hall', () => {
  let found = 0;
  for (const seed of [7319, 9, 18427, 90210]) {
    const world = new World(seed);
    const city = queryPlaces(seed, -35000, -35000, 70000, 70000).filter(p => p.id !== 0 && p.city)[0];
    assert.ok(city, `seed ${seed} has no city in range`);
    for (const building of world.getBuildings(city.x - 1200, city.y - 1200, 2400, 2400)) {
      const master = battlemasterFor(building);
      if (!master) continue;
      found++;
      assert.equal(master.role, 'battlemaster');
      assert.ok(canInteractNPC(master, { x: master.x, y: master.y + 30 }, world), `${seed} ${master.id}`);
    }
  }
  assert.ok(found > 0, 'no city battlemaster found');
});

test('teammate suggestions cover every class role direction', () => {
  const roles = new Set(WOW_CLASS_IDS.flatMap(id => pvpClassRoles(id)));
  assert.deepEqual([...roles].sort(), ['dd', 'heal', 'tank']);
});
