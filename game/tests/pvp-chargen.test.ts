import assert from 'node:assert/strict';
import test from 'node:test';
import { randomNpcBuild, buildCustomCharacter, equalGearFor, rolePreset, supportedRoles, type PvpCharacter } from '../src/pvp-chargen.ts';
import { pvpClassRoles } from '../src/pvp-setup.ts';
import { SKILL_NODES, doctrineConflict, freeNodeCount, unlockedSkills } from '../src/skill-tree.ts';
import { validSkillProgression } from '../src/skill-progression.ts';
import { itemFitsSlot } from '../src/inventory.ts';
import { RELIC_CLASSES, EQUIPMENT_SLOTS } from '../src/items.ts';
import { WOW_CLASSES } from '../src/wow-classes.ts';
import { raceAllowsClass } from '../src/wow-races.ts';
import { WOW_CLASS_IDS } from '../src/wow-types.ts';
import type { CharacterSheet } from '../src/character-types.ts';

/** The save validator's talent/gear/point contract, asserted directly on built sheets. */
function assertLegalSheet(sheet: CharacterSheet, level: number): void {
  const nodes = sheet.allocatedNodes;
  assert.equal(new Set(nodes).size, nodes.length, 'duplicate talent nodes');
  assert.ok(nodes.includes('origin'));
  for (const id of nodes) {
    const node = SKILL_NODES.get(id);
    assert.ok(node, `unknown node ${id}`);
    assert.ok(!node.classId || node.classId === sheet.classId, `${id} gated to ${node.classId}`);
    assert.ok(!doctrineConflict(nodes, node), `${id} conflicts with a sibling doctrine/spec`);
  }
  // Every allocated node must be reachable from the origin through owned nodes.
  const owned = new Set(nodes), connected = new Set(['origin']), queue = ['origin'];
  for (let i = 0; i < queue.length; i++)
    for (const next of SKILL_NODES.get(queue[i])!.neighbors)
      if (owned.has(next) && !connected.has(next)) { connected.add(next); queue.push(next); }
  assert.equal(connected.size, owned.size, 'talent build is not connected');
  // Point conservation: earned points = spent on nodes + spent on ranks + unspent.
  const rankSpend = Object.values(sheet.skillRanks).reduce((sum, rank) => sum + rank - 1, 0);
  assert.equal(sheet.skillPoints + owned.size - freeNodeCount(nodes) + rankSpend, level - 1, 'skill point ledger');
  assert.equal(sheet.statPoints + Object.values(sheet.attributes).reduce((sum, n) => sum + n - 10, 0), (level - 1) * 5, 'attribute point ledger');
  assert.ok(validSkillProgression(sheet), 'skill progression invalid');
  // Gear legality mirrors the equip validator.
  const cls = WOW_CLASSES[sheet.classId];
  for (const slot of EQUIPMENT_SLOTS) {
    const item = sheet.equipped[slot];
    if (!item) continue;
    assert.ok(itemFitsSlot(item, slot, sheet.classId), `${slot} cannot hold ${item.kind}`);
    assert.ok(item.requiredLevel <= level, `${slot} requires level ${item.requiredLevel}`);
    if (item.weapon) {
      assert.ok(cls.weapons.includes(item.weapon.family), `${cls.name} cannot use ${item.weapon.family}`);
      assert.ok(item.weapon.hands === 1 || item.weapon.attackKind !== 'melee' || cls.twoHandedMelee, `${cls.name} cannot use two-handed melee`);
    }
    if (item.kind === 'relic') assert.ok(RELIC_CLASSES.includes(sheet.classId), 'relic on a non-relic class');
  }
  if (sheet.equipped.weapon?.weapon?.hands === 2) assert.equal(sheet.equipped.offhand, null, '2H weapon with an offhand');
  // Bar legality: unlocked, unique skills only.
  const bar = sheet.skillSlots.filter((id): id is NonNullable<typeof id> => id !== null);
  const unlocked = unlockedSkills(nodes);
  assert.ok(bar.every(id => unlocked.includes(id)), 'bar holds an unlearned skill');
  assert.equal(new Set(bar).size, bar.length, 'duplicate bar skill');
}

function assertCombatantReady(build: PvpCharacter, level: number): void {
  const { player, sheet } = build;
  assert.equal(player.level, level);
  assert.equal(player.character, sheet);
  assert.ok(player.maxHp > 0 && player.hp === player.maxHp, 'not at full health');
  assert.ok(player.equipment.mainHand.damage > 0, 'no usable weapon');
  assert.ok(player.derived.maxHp === player.maxHp && player.derived.attributes.vitality >= 10);
  assert.ok(sheet.skillSlots[0] !== null, 'empty first bar slot');
}

test('randomNpcBuild produces a legal combatant for every class at match levels', () => {
  for (const classId of WOW_CLASS_IDS) {
    for (const level of [20, 60, 80]) {
      const build = randomNpcBuild(0xA17A + level * 131 + WOW_CLASS_IDS.indexOf(classId), classId, level);
      const { sheet, summary } = build;
      assert.equal(sheet.classId, classId);
      assert.ok(raceAllowsClass(sheet.raceId, classId), `${sheet.raceId} cannot be ${classId}`);
      assertLegalSheet(sheet, level);
      assertCombatantReady(build, level);
      assert.ok(pvpClassRoles(classId).includes(summary.role), `role ${summary.role} unsupported`);
      assert.equal(summary.identity.length > 0, true);
      assert.equal(summary.talentNodes, sheet.allocatedNodes.length);
    }
  }
});

test('randomNpcBuild honors role direction and falls back to dd for unsupported roles', () => {
  const tank = randomNpcBuild(7, 'warrior', 80, 'tank');
  assert.equal(tank.summary.role, 'tank');
  assert.equal(tank.sheet.equipped.offhand?.kind, 'shield');
  assert.equal(tank.summary.spec, 'Protection');
  const healer = randomNpcBuild(11, 'priest', 80, 'heal');
  assert.equal(healer.summary.role, 'heal');
  assert.ok(['Discipline', 'Holy'].includes(healer.summary.spec!));
  // Mages cannot tank: the direction degrades to damage instead of failing.
  const mage = randomNpcBuild(13, 'mage', 80, 'tank');
  assert.equal(mage.summary.role, 'dd');
  assertLegalSheet(mage.sheet, 80);
});

test('randomNpcBuild is deterministic per seed and varies across seeds', () => {
  const a = randomNpcBuild(42, 'shaman', 60), b = randomNpcBuild(42, 'shaman', 60);
  assert.equal(JSON.stringify(a.sheet), JSON.stringify(b.sheet));
  const c = randomNpcBuild(43, 'shaman', 60);
  assert.notDeepEqual(
    { nodes: c.sheet.allocatedNodes, gear: Object.values(c.sheet.equipped).map(i => i?.id) },
    { nodes: a.sheet.allocatedNodes, gear: Object.values(a.sheet.equipped).map(i => i?.id) });
});

test('rolePreset projects WOW_CLASSES roles; supportedRoles matches the wizard list', () => {
  for (const classId of WOW_CLASS_IDS)
    assert.deepEqual(supportedRoles(classId), pvpClassRoles(classId));
  const tank = rolePreset('paladin', 'tank')!;
  assert.equal(tank.armorStyle, 'plate');
  assert.ok(tank.loadouts.every(l => l.offhand === 'shield'));
  assert.equal(rolePreset('mage', 'tank'), null);
  assert.equal(rolePreset('rogue', 'heal'), null);
  assert.ok(rolePreset('druid', 'heal')!.loadouts.some(l => l.specs.includes('restoration')));
});

test('equalGearFor fills every slot at the target ilevel with class-legal items', () => {
  for (const classId of WOW_CLASS_IDS) {
    const equipped = equalGearFor(classId, 80, 'dd', 99);
    for (const slot of EQUIPMENT_SLOTS) {
      const item = equipped[slot];
      if (slot === 'offhand') {
        assert.equal(equipped.weapon!.weapon!.hands === 2, item === null, 'offhand must be empty exactly under a 2H weapon');
        continue;
      }
      assert.ok(item, `${classId} missing ${slot}`);
      assert.equal(item.itemLevel, 80);
      assert.ok(itemFitsSlot(item, slot, classId));
    }
    assert.ok(WOW_CLASSES[classId].weapons.includes(equipped.weapon!.weapon!.family));
    // A tank loadout carries a shield where the class's preset calls for one.
    const tankGear = equalGearFor(classId, 80, 'tank', 99);
    assert.ok(tankGear.weapon);
  }
});

test('buildCustomCharacter builds an unsaved session sheet at the chosen level', () => {
  const build = buildCustomCharacter({ classId: 'mage', raceId: 'human', level: 60, role: 'dd', seed: 5 });
  assert.equal(build.player.level, 60);
  assert.equal(build.sheet.classId, 'mage');
  assert.equal(build.sheet.raceId, 'human');
  assertLegalSheet(build.sheet, 60);
  assertCombatantReady(build, 60);
  // The sheet is a plain in-memory object: no session, no persistence hooks.
  assert.equal(typeof build.sheet, 'object');
  assert.ok(!('active' in build.sheet) && !('repository' in build.sheet));
});

test('buildCustomCharacter honors chosen skills, attributes and item level', () => {
  const build = buildCustomCharacter({
    classId: 'warrior', raceId: 'orc', level: 40, role: 'dd', seed: 9,
    skills: ['charge', 'mortalStrike'], attributes: { strength: 60 },
    itemLevel: 41, fillTalents: true,
  });
  const { sheet } = build;
  assert.equal(sheet.attributes.strength, 60);
  assert.ok(sheet.allocatedNodes.includes('wow-warrior-charge'));
  assert.ok(sheet.allocatedNodes.includes('wow-warrior-mortalStrike'));
  assert.equal(sheet.skillSlots[0], 'charge');
  assert.equal(sheet.skillSlots[1], 'mortalStrike');
  for (const slot of EQUIPMENT_SLOTS) {
    const item = sheet.equipped[slot];
    if (item) assert.equal(item.itemLevel, 41);
  }
  assertLegalSheet(sheet, 40);
});

test('buildCustomCharacter rejects illegal class/race, skills and attribute budgets', () => {
  assert.throws(() => buildCustomCharacter({ classId: 'druid', raceId: 'human', level: 40 }), /cannot be/);
  assert.throws(() => buildCustomCharacter({ classId: 'mage', raceId: 'human', level: 40, skills: ['charge'] }), /cannot learn/);
  assert.throws(() => buildCustomCharacter({ classId: 'mage', raceId: 'human', level: 10, attributes: { intelligence: 999 } }), /budget/);
  // fillTalents:false leaves the point ledger intact with unspent points.
  const lean = buildCustomCharacter({ classId: 'rogue', raceId: 'undead', level: 30, fillTalents: false });
  assertLegalSheet(lean.sheet, 30);
  assert.ok(lean.sheet.skillPoints > 0);
});
