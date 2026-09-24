import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGearPicks, pvpGearOptions, resolveGearPick, rolePreset,
} from '../src/pvp-chargen.ts';
import { EQUIPMENT_SLOTS, RELIC_CLASSES, SHIELD_CLASSES, generateItem } from '../src/items.ts';
import { itemFitsSlot } from '../src/inventory.ts';
import { itemMaterialPool } from '../src/item-materials.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { FOCUS_PROFILES } from '../src/focus-content.ts';
import { jewelryProfiles } from '../src/jewelry-content.ts';
import { WOW_CLASSES } from '../src/wow-classes.ts';
import { WOW_CLASS_IDS } from '../src/wow-types.ts';
import { randomSource } from '../src/random-source.ts';
import type { CharacterSheet } from '../src/character-types.ts';
import type { WowClassId } from '../src/wow-types.ts';

const loadout = (classId: WowClassId, role: 'dd' | 'tank' | 'heal' = 'dd') => rolePreset(classId, role)!.loadouts[0];
const emptyEquipped = (): CharacterSheet['equipped'] =>
  Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, null])) as CharacterSheet['equipped'];

test('weapon offers are exactly the class-legal profiles and seeds regenerate the same item', () => {
  for (const classId of WOW_CLASS_IDS) {
    const cls = WOW_CLASSES[classId];
    const options = pvpGearOptions(classId, 'weapon', 60);
    const expected = WEAPON_PROFILES.filter(profile => cls.weapons.includes(profile.family)
      && (profile.hands === 1 || profile.attackKind !== 'melee' || cls.twoHandedMelee));
    assert.equal(options.length, expected.length, `${cls.name} weapon offer count`);
    assert.equal(new Set(options.map(o => o.seed)).size, options.length, 'duplicate candidate seeds');
    for (const option of options) {
      const weapon = option.item.weapon!;
      assert.ok(cls.weapons.includes(weapon.family), `${cls.name} offered ${weapon.family}`);
      assert.ok(weapon.hands === 1 || weapon.attackKind !== 'melee' || cls.twoHandedMelee,
        `${cls.name} offered a two-handed melee weapon it cannot wield`);
      assert.ok(itemFitsSlot(option.item, 'weapon', classId));
      assert.ok(option.item.requiredLevel <= 60);
      // The stored seed is the whole pick: it must regenerate the identical item.
      assert.deepEqual(resolveGearPick(classId, 'weapon', option.seed, 60), option.item);
      const atCap = resolveGearPick(classId, 'weapon', option.seed, 80)!;
      assert.equal(atCap.weapon!.family, weapon.family, 'seed must keep its profile across levels');
      assert.equal(atCap.itemLevel, 80);
    }
  }
});

test('offhand offers match class proficiencies and vanish behind a two-handed main hand', () => {
  const warrior = pvpGearOptions('warrior', 'offhand', 60, null);
  assert.ok(warrior.some(o => o.item.kind === 'shield'), 'warrior shield offers');
  assert.ok(warrior.some(o => o.item.kind === 'weapon'), 'warrior dual-wield offers');
  assert.ok(warrior.every(o => o.item.kind !== 'relic'), 'warrior cannot hold relics');
  assert.equal(warrior.filter(o => o.item.kind === 'shield').length, SHIELD_PROFILES.length);
  assert.equal(warrior.filter(o => o.item.kind === 'grimoire' || o.item.kind === 'orb').length, FOCUS_PROFILES.length);

  const mage = pvpGearOptions('mage', 'offhand', 60, null);
  assert.ok(mage.length > 0 && mage.every(o => o.item.kind === 'grimoire' || o.item.kind === 'orb'),
    'mage offhands are focuses only');
  assert.equal(pvpGearOptions('rogue', 'offhand', 60, null).filter(o => o.item.kind === 'shield').length, 0);
  assert.ok(pvpGearOptions('rogue', 'offhand', 60, null).some(o => o.item.kind === 'weapon'), 'rogue dual-wield');
  assert.ok(pvpGearOptions('shaman', 'offhand', 60, null).some(o => o.item.kind === 'relic'), 'shaman relics');
  assert.equal(pvpGearOptions('priest', 'offhand', 60, null).filter(o => o.item.kind === 'relic').length, 0);

  // A two-handed main hand empties the offhand list for every class.
  for (const classId of WOW_CLASS_IDS) {
    const twoHanded = pvpGearOptions(classId, 'weapon', 60).find(o => o.item.weapon!.hands === 2);
    if (!twoHanded) continue;
    assert.equal(pvpGearOptions(classId, 'offhand', 60, twoHanded.item).length, 0,
      `${classId} must not be offered offhands behind a 2H weapon`);
    const oneHanded = pvpGearOptions(classId, 'weapon', 60).find(o => o.item.weapon!.hands === 1);
    if (oneHanded)
      assert.ok(pvpGearOptions(classId, 'offhand', 60, oneHanded.item).length > 0,
        `${classId} lost every offhand behind a 1H weapon`);
  }
});

test('cloak offers cover the cloak material pool; armor offers stay inside the class armor style', () => {
  const pool = itemMaterialPool('cloak');
  for (const classId of WOW_CLASS_IDS) {
    const cloaks = pvpGearOptions(classId, 'cloak', 60);
    assert.equal(cloaks.length, pool.length);
    assert.deepEqual(cloaks.map(o => o.item.recipe.materialId), pool.map(entry => entry.id));
    const style = WOW_CLASSES[classId].armorStyle;
    for (const slot of ['head', 'chest', 'gloves', 'legs', 'boots'] as const) {
      const options = pvpGearOptions(classId, slot, 60);
      assert.equal(options.length, 6, `${classId} ${slot} offer count`);
      for (const option of options) {
        assert.equal(option.item.kind, slot);
        assert.equal(option.item.appearance?.style, style, `${classId} ${slot} material style`);
        assert.ok(itemFitsSlot(option.item, slot, classId));
      }
    }
    for (const slot of ['amulet', 'ring1', 'ring2'] as const) {
      const kind = slot === 'amulet' ? 'amulet' : 'ring';
      assert.equal(pvpGearOptions(classId, slot, 60).length, jewelryProfiles(kind).length + 2);
    }
  }
});

test('applyGearPicks resolves hand conflicts exactly like the picker contract', () => {
  const random = randomSource(7);
  const warriorLoadout = loadout('warrior');
  const twoHanded = pvpGearOptions('warrior', 'weapon', 60).find(o => o.item.weapon!.hands === 2)!;
  const oneHanded = pvpGearOptions('warrior', 'weapon', 60).find(o => o.item.weapon!.hands === 1)!;
  const shield = pvpGearOptions('warrior', 'offhand', 60, oneHanded.item).find(o => o.item.kind === 'shield')!;

  // A chosen 2H weapon clears the offhand and makes a stale offhand pick a no-op.
  const equipped = emptyEquipped();
  applyGearPicks(equipped, { weapon: twoHanded.seed, offhand: shield.seed }, random, 'warrior', warriorLoadout, 60);
  assert.equal(equipped.weapon!.id, twoHanded.item.id);
  assert.equal(equipped.offhand, null, 'chosen 2H must clear the offhand');

  // A chosen offhand forces the auto-rolled 2H main hand to re-roll one-handed.
  const equipped2 = emptyEquipped();
  equipped2.weapon = generateItem(1, 60, 'weapon', 'greatblade');
  assert.equal(equipped2.weapon.weapon!.hands, 2);
  applyGearPicks(equipped2, { offhand: shield.seed }, random, 'warrior', warriorLoadout, 60);
  assert.equal(equipped2.offhand!.id, shield.item.id);
  assert.equal(equipped2.weapon!.weapon!.hands, 1, 'chosen offhand must yield a 1H main hand');

  // A chosen 1H weapon plus a chosen offhand land together.
  const equipped3 = emptyEquipped();
  applyGearPicks(equipped3, { weapon: oneHanded.seed, offhand: shield.seed }, random, 'warrior', warriorLoadout, 60);
  assert.equal(equipped3.weapon!.id, oneHanded.item.id);
  assert.equal(equipped3.offhand!.id, shield.item.id);
});

test('applyGearPicks leaves unpicked slots untouched and honors armor picks', () => {
  const equipped = emptyEquipped();
  const untouched = generateItem(55, 60, 'chest');
  equipped.chest = untouched;
  const head = pvpGearOptions('paladin', 'head', 60)[0];
  applyGearPicks(equipped, { head: head.seed }, randomSource(3), 'paladin', loadout('paladin', 'tank'), 60);
  assert.equal(equipped.head!.id, head.item.id);
  assert.equal(equipped.chest, untouched, 'unpicked slots keep the rolled loadout item');
  assert.equal(equipped.weapon, null);
});

test('applyGearPicks throws on unknown or stale seeds', () => {
  const equipped = emptyEquipped();
  const loadoutRef = loadout('warrior');
  const foreignSeed = pvpGearOptions('mage', 'weapon', 60)[0].seed;
  assert.equal(resolveGearPick('warrior', 'weapon', foreignSeed, 60), null, 'foreign class seed must not resolve');
  assert.throws(() => applyGearPicks(equipped, { weapon: foreignSeed }, randomSource(1), 'warrior', loadoutRef, 60), RangeError);
  assert.throws(() => applyGearPicks(emptyEquipped(), { head: 0x7fffffff }, randomSource(1), 'warrior', loadoutRef, 60), RangeError);
  // A seed minted for one slot is stale in another.
  const cloakSeed = pvpGearOptions('warrior', 'cloak', 60)[0].seed;
  assert.equal(resolveGearPick('warrior', 'chest', cloakSeed, 60), null);
});

test('every offered candidate survives the equip validator for its own slot', () => {
  for (const classId of WOW_CLASS_IDS) {
    const mainHand = pvpGearOptions(classId, 'weapon', 40).find(o => o.item.weapon!.hands === 1)?.item ?? null;
    for (const slot of EQUIPMENT_SLOTS) {
      for (const option of pvpGearOptions(classId, slot, 40, mainHand)) {
        assert.ok(itemFitsSlot(option.item, slot, classId), `${classId} ${slot} offered an illegal ${option.item.kind}`);
        if (slot === 'offhand' && option.item.kind === 'shield')
          assert.ok(SHIELD_CLASSES.includes(classId), 'shield offered to a non-shield class');
        if (slot === 'offhand' && option.item.kind === 'relic')
          assert.ok(RELIC_CLASSES.includes(classId), 'relic offered to a non-relic class');
      }
    }
  }
});
