import { FIXED_STEP, Simulation } from '../../src/simulation.ts';
import { createCharacterSheet } from '../../src/items.ts';
import { refreshCharacter } from '../../src/character.ts';
import { WOW_CLASSES } from '../../src/wow-classes.ts';
import { raceAllowsClass } from '../../src/wow-races.ts';
import { SKILL_DEFINITIONS } from '../../src/skill-content.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../../src/weapon-content.ts';
import type { Input, WorldQuery } from '../../src/model.ts';
import type { SkillId } from '../../src/character-types.ts';
import type { WowClassId, WowRaceId } from '../../src/wow-types.ts';

export const emptyWorld: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
export const idleInput: Input = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const RACE_PICK: readonly WowRaceId[] = ['undead', 'human', 'dwarf', 'nightElf', 'gnome', 'draenei', 'orc', 'tauren', 'troll', 'bloodElf'];
export function raceForClass(classId: WowClassId, prefer?: WowRaceId): WowRaceId {
  if (prefer && raceAllowsClass(prefer, classId)) return prefer;
  for (const race of RACE_PICK) if (raceAllowsClass(race, classId)) return race;
  return 'human';
}
/** First mana-resource class a race can play; racial skills cost no class resource,
 * so a mana class keeps `player.mana` assertions exact. */
export function manaClassForRace(raceId: WowRaceId): WowClassId {
  const order: readonly WowClassId[] = ['mage', 'priest', 'paladin', 'hunter', 'shaman', 'warlock', 'druid'];
  for (const classId of order) if (raceAllowsClass(raceId, classId)) return classId;
  return 'mage';
}

/** Weapon profile per skill requirement so requirement-gated casts are legal. */
const REQUIREMENT_GEAR: Record<string, { main: string; off?: string }> = {
  any: { main: 'longsword' },
  melee: { main: 'longsword' },
  blade: { main: 'longsword' },
  dagger: { main: 'rondel-dagger' },
  heavy: { main: 'hand-axe' },
  bow: { main: 'thorn-shortbow' },
  magic: { main: 'ember-staff' },
  shield: { main: 'longsword', off: 'iron-buckler' },
};

/** Build a sim whose character is a real WoW class/race with the class resource
 * seeded to full (mana=maxMana, rage/energy=cap, runic=0 with runes ready,
 * soulShards=4). Defaults to mage/undead — the old harness's neutral caster. */
export function createWowSim(classId: WowClassId = 'mage', raceId?: WowRaceId, world: WorldQuery = emptyWorld): Simulation {
  const sim = new Simulation(world, { spawn: false, seed: 984319 });
  const race = raceForClass(classId, raceId);
  sim.player.character = createCharacterSheet(classId, race);
  refreshCharacter(sim.player);
  // One warm-up tick runs the WoW resource seeding (energy=cap, rage/runic=0),
  // then we top off so every class starts tests at full resource.
  sim.update(FIXED_STEP, idleInput);
  sim.drainEvents();
  const wowClass = WOW_CLASSES[classId];
  // Mana classes keep their derived maxMana; fixed-pool classes use the class cap.
  sim.player.mana = wowClass.resource === 'runicPower' ? 0 : sim.player.maxMana;

  sim.player.soulShards = 4;
  sim.player.runes = [0, 0, 0, 0, 0, 0];
  return sim;
}
/** Equip a legal weapon for the skill's requirement. Player.equipment is a live
 * projection read by skillWeapon/deriveAttackStats each tick, so set it directly. */
export function equipForSkill(sim: Simulation, id: SkillId): void {
  const gear = REQUIREMENT_GEAR[SKILL_DEFINITIONS[id].requirement] ?? REQUIREMENT_GEAR.any;
  sim.player.equipment = {
    mainHand: WEAPON_PROFILES.find(w => w.id === gear.main)!,
    offHand: gear.off ? { kind: 'shield', shield: SHIELD_PROFILES.find(s => s.id === gear.off)! } : null,
  };
}
