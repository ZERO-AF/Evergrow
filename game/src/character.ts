import { auraReservation } from './aura-content.ts';
import { manaCapacity, syncAuras } from './auras.ts';
import { advanceSkillEffects } from './player-skill-effects.ts';
import { advanceAffixBuffs } from './affix-combat.ts';
import type { Player } from './model.ts';
import type { ActionResult, CharacterSheet, SkillId } from './character-types.ts';
import type { CharacterLook } from './character-look.ts';
import { deriveCharacterStats } from './character-stats.ts';
import { getTreeBonuses, unlockedSkills } from './skill-tree.ts';
import { UNARMED_WEAPON } from './equipment.ts';
import { awardExperience } from './progression.ts';
import { createCharacterSheet } from './items.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { WOW_CLASSES } from './wow-classes.ts';
import { raceAllowsClass, WOW_RACES } from './wow-races.ts';
import type { WowClassId, WowRaceId } from './wow-types.ts';
import { BAR_TOTAL } from './action-bar.ts';
import { durabilityFactor } from './durability-state.ts';
import { transmoggedEquipment } from './transmog-state.ts';
import { startingZone, deathKnightStart } from './factions.ts';
import { GAME_FEATURES } from './game-features.ts';
import { addGuildXp, guildXpShare } from './guild-state.ts';

/** Rebuild combat projections from the character's single source of truth. */
export function refreshCharacter(player: Player): void {
  const derived = deriveCharacterStats(player.character, getTreeBonuses(player.character.allocatedNodes), player.level, undefined, player);
  player.derived = derived;
  player.stats = { castSpeedMultiplier: derived.castSpeedMultiplier, attackDamageMultiplier: derived.attackDamageMultiplier, attackSpeedMultiplier: derived.attackSpeedMultiplier, spellDamageMultiplier: derived.spellDamageMultiplier };
  const offhand = player.character.equipped.offhand;
  const mainWeapon = player.character.equipped.weapon;
  player.equipment = { mainHand: (mainWeapon && durabilityFactor(player.durability, 'weapon') > 0 ? mainWeapon.weapon : undefined) ?? UNARMED_WEAPON,
    offHand: durabilityFactor(player.durability, 'offhand') <= 0 ? null
      : offhand?.kind === 'shield' && offhand.shield ? { kind: 'shield', shield: offhand.shield }
      : offhand?.focus ? { kind: 'focus', focus: offhand.focus }
      : offhand?.kind === 'weapon' && offhand.weapon ? { kind: 'weapon', weapon: offhand.weapon } : null };
  player.equipment = transmoggedEquipment(player.equipment, player.character);
  player.maxHp = derived.maxHp;
  // Non-mana resource pools (rage/energy/runic) keep their class cap; only mana
  // classes take the derived maxMana. Mirrors refreshBuffStats.
  const resourceModel = WOW_CLASSES[player.character.classId];
  player.maxMana = resourceModel && resourceModel.resource !== 'mana' ? resourceModel.resourceCap : derived.maxMana;
  advanceAffixBuffs(player, 0);
  advanceSkillEffects(player,0);
  syncAuras(player);
  player.hp = Math.min(player.hp, player.maxHp); player.mana = Math.min(player.mana, manaCapacity(player));
}

export function awardCharacterExperience(player: Player, amount: number): number {
  const before = player.level;
  awardExperience(player, amount);
  // Guilds earn a share of every awarded XP (kills, quests, events); silent —
  // level-ups surface in the guild panel and the next checkpoint persists them.
  if (GAME_FEATURES.guilds) addGuildXp(player.character, guildXpShare(amount));
  const levels = player.level - before;
  player.character.skillPoints += levels;
  player.character.statPoints += levels * 5;
  if (levels > 0) refreshCharacter(player);
  return levels;
}

export function assignSkill(player: Player, slot: number, skill: SkillId | null): ActionResult {
  if (!Number.isInteger(slot) || slot < 0 || slot >= BAR_TOTAL) return { ok: false, message: 'Choose one of the action bar slots.' };
  const definition = skill !== null ? SKILL_DEFINITIONS[skill] : undefined;
  if (definition?.classId && definition.classId !== player.character.classId)
    return { ok: false, message: `${definition.name} is a ${WOW_CLASSES[definition.classId].name} skill.` };
  if (definition?.raceId && definition.raceId !== player.character.raceId)
    return { ok: false, message: `${definition.name} is a ${WOW_RACES[definition.raceId].name} racial.` };
  if (skill !== null && !unlockedSkills(player.character.allocatedNodes).includes(skill)) return { ok: false, message: 'Unlock this skill in the tree first.' };
  const slots=player.character.skillSlots.map(id=>id===skill?null:id);slots[slot]=skill;
  if(auraReservation({...player.character,skillSlots:slots})>=100)return {ok:false,message:'Not enough unreserved mana. Remove another aura first.'};
  if (skill) player.character.skillSlots = player.character.skillSlots.map(id => id === skill ? null : id);
  player.character.skillSlots[slot] = skill;
  return { ok: true };
}

/** The racial active granted by the sheet's race; auto-known on the dedicated R slot, never tree-gated. */
export function racialSkillId(sheet: Pick<CharacterSheet, 'raceId'>): SkillId {
  return WOW_RACES[sheet.raceId].racial as SkillId;
}

/** WoW creation entry point: validate the race/class pair, build the sheet with class starter
 * gear and appearance, then refresh projections and fill resources. The racial active is
 * auto-known via `racialSkillId` — it never occupies one of the action bar slots. */
export function createCharacter(player: Player, name: string, classId: WowClassId, raceId: WowRaceId, look?: CharacterLook): ActionResult {
  if (!raceAllowsClass(raceId, classId)) return { ok: false, message: `${WOW_RACES[raceId].name} cannot be a ${WOW_CLASSES[classId].name}.` };
  player.character = createCharacterSheet(classId, raceId, look);
  player.name = name;
  // World-t05: new heroes wake at their race's authored starting area. Death
  // knights are the WotLK hero class: they begin at level 55 in Acherus, the
  // Ebon Hold necropolis above the Eastern Plaguelands, with the points a
  // level-55 hero would have earned.
  if (GAME_FEATURES.factions) {
    const dk = classId === 'deathKnight';
    const start = dk ? deathKnightStart(raceId) : startingZone(raceId);
    player.x = player.prevX = start.spawn.x;
    player.y = player.prevY = start.spawn.y;
    if (dk) {
      player.level = 55;
      player.character.skillPoints += 54;
      player.character.statPoints += 54 * 5;
    }
  }
  refreshCharacter(player);
  player.hp = player.maxHp;
  const resource = WOW_CLASSES[classId].resource;
  player.mana = resource === 'rage' || resource === 'runicPower' ? 0 : Math.min(player.maxMana, WOW_CLASSES[classId].resourceCap || player.maxMana);
  return { ok: true };
}
