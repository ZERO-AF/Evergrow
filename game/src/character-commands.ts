import { chooseDoctrine } from './skill-tree.ts';
import { setItemLock } from './item-protection.ts';
export { executeAppearanceChange, executeSavedAppearanceChange } from './appearance-command.ts';
import { upgradeSkill, configureSkill, OVERLOAD_NODE } from './skill-progression.ts';
import type { Player } from './model.ts';
import type { ActionResult, Attribute, EquipmentSlot, SkillId } from './character-types.ts';
import { unequipItem, moveInventoryItem, allocateAttribute, useInventoryItem } from './inventory.ts';
import { allocateSkillRoute } from './skill-tree-routes.ts';
import { assignSkill, refreshCharacter } from './character.ts';
import { refreshBuffStats } from './player-skill-effects.ts';
import { equipBest, sortInventory, sortStorage, type InventorySort, type EquipBestChoice } from './inventory-tools.ts';
import { socketGem, unsocketGem, type SocketTarget } from './gem-command.ts';

export type CharacterCommand =
  | { type: 'chooseDoctrine'; id: string }
  | { type: 'lockItem'; id: string; locked: boolean }
  | { type: 'equipBest'; choice?: EquipBestChoice }
  | { type: 'sortInventory'; mode: InventorySort }
  | { type: 'sortStorage'; tab?: number }
  | { type: 'upgradeSkill'; skill: SkillId }
  | { type: 'configureSkill'; skill: SkillId; rank: number; specialization: string | null }
  | { type: 'overload'; enabled: boolean }
  | { type: 'equip'; index: number; slot?: EquipmentSlot }
  | { type: 'unequip'; slot: EquipmentSlot; index?: number }
  | { type: 'moveItem'; from: number; to: number }
  | { type: 'allocateAttribute'; attribute: Attribute }
  | { type: 'allocateNode'; id: string }
  | { type: 'socketGem'; gemIndex: number; target: SocketTarget; socketIndex: number }
  | { type: 'unsocketGem'; target: SocketTarget; socketIndex: number }
  | { type: 'assignSkill'; slot: number; skill: SkillId | null };

/** The runtime mutation boundary owns validation, commit and projection refresh.
 * Underlying sheet operations plan failures before changing state. Failed commands
 * leave combat projections and resources untouched; successful ones never heal. */
export function executeCharacterCommand(player: Player, command: CharacterCommand): ActionResult {
  let result: ActionResult;
  switch (command.type) {
    case 'chooseDoctrine': result=chooseDoctrine(player.character,command.id);if(result.ok){player.affixBuffs=undefined;player.skillEffects=undefined;}break;
    case 'lockItem': result = setItemLock(player.character, command.id, command.locked); break;
    case 'equipBest': result = equipBest(player.character, player.level, command.choice); break;
    case 'sortInventory': result = sortInventory(player.character, command.mode); break;
    case 'sortStorage': result = sortStorage(player.character, command.tab); break;
    case 'upgradeSkill': result = upgradeSkill(player.character, command.skill); break;
    case 'configureSkill': result = configureSkill(player.character, command.skill, command.rank, command.specialization); break;
    case 'overload':
      if (!player.character.allocatedNodes.includes(OVERLOAD_NODE)) return { ok: false, message: 'Unlock Arcane Overload first.' };
      player.character.arcaneOverload = command.enabled; result = { ok: true }; break;
    case 'equip': result = useInventoryItem(player, command.index, command.slot); break;
    case 'unequip': result = unequipItem(player.character, command.slot, command.index); break;
    case 'moveItem': result = moveInventoryItem(player.character, command.from, command.to); break;
    case 'allocateAttribute': result = allocateAttribute(player.character, command.attribute); break;
    case 'allocateNode': result = allocateSkillRoute(player.character, command.id); break;
    case 'socketGem': result = socketGem(player.character, command.gemIndex, command.target, command.socketIndex); break;
    case 'unsocketGem': result = unsocketGem(player.character, command.target, command.socketIndex); break;
    case 'assignSkill': result = assignSkill(player, command.slot, command.skill); break;
    default: {
      const unhandled: never = command;
      throw new Error(`Unknown character command: ${unhandled}`);
    }
  }
  if (result.ok) { refreshCharacter(player); if (command.type === 'equip' && player.buffs?.length) refreshBuffStats(player); }
  return result;
}
