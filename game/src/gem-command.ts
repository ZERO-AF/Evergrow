import type { ActionResult, CharacterSheet, EquipmentSlot, Item } from './character-types.ts';
import { EQUIPMENT_SLOTS, deriveItem, itemDisplayName } from './items.ts';
import { gemDefinition, gemItemId, socketBonusActive } from './gem-content.ts';
import { normalizePackLayout } from './inventory-grid.ts';
import { GAME_FEATURES } from './game-features.ts';

/**
 * Validated gem socketing (gem-content.ts owns the catalog and matching rules).
 * WoW jewelcrafting rule: inserting a gem into an occupied socket destroys the
 * old gem, and prying a gem out destroys it too — gems never return to the bag.
 * Both operations re-derive the item so stats, socket bonus and item power stay
 * consistent, and bump recipe.revision so stale service quotes cannot replay.
 */

export type SocketTarget = { bag: number } | { equipped: EquipmentSlot };
const fail = (message: string): ActionResult => ({ ok: false, message });

function resolveTarget(sheet: CharacterSheet, target: SocketTarget): Item | null {
  if ('bag' in target) {
    return Number.isInteger(target.bag) && target.bag >= 0 && target.bag < sheet.inventory.length
      ? sheet.inventory[target.bag] : null;
  }
  return EQUIPMENT_SLOTS.includes(target.equipped) ? sheet.equipped[target.equipped] : null;
}
function commitTarget(sheet: CharacterSheet, target: SocketTarget, item: Item): void {
  if ('bag' in target) sheet.inventory[target.bag] = item;
  else sheet.equipped[target.equipped] = item;
}

/** Insert a gem item into one of the target's sockets; consumes the gem item. */
export function socketGem(sheet: CharacterSheet, gemIndex: number, target: SocketTarget, socketIndex: number): ActionResult {
  if (!GAME_FEATURES.gems) return fail('Socketing is not available.');
  if (!Number.isInteger(gemIndex) || gemIndex < 0 || gemIndex >= sheet.inventory.length) return fail('Choose a gem in your pack.');
  const gemItem = sheet.inventory[gemIndex];
  const gem = gemDefinition(gemItemId(gemItem));
  if (!gemItem || !gem) return fail('That item is not a gem.');
  const item = resolveTarget(sheet, target);
  if (!item) return fail('Choose an item to socket.');
  if (!item.sockets?.length) return fail('This item has no sockets.');
  if (!Number.isInteger(socketIndex) || socketIndex < 0 || socketIndex >= item.sockets.length) return fail('Choose a socket.');
  if (item.recipe.revision >= Number.MAX_SAFE_INTEGER) return fail('This item cannot be modified further.');
  const sockets = item.sockets.map((socket, index) =>
    index === socketIndex ? { color: socket.color, gem: gem.id, gemLevel: gemItem.itemLevel } : socket);
  const replaced = item.sockets[socketIndex].gem !== undefined;
  const next = deriveItem({ ...item, sockets, recipe: { ...item.recipe, revision: item.recipe.revision + 1 } });
  commitTarget(sheet, target, next);
  sheet.inventory[gemIndex] = null;
  normalizePackLayout(sheet);
  return { ok: true, message: `${gem.name} socketed into ${itemDisplayName(item)}${replaced ? ' — the old gem shatters' : ''}${socketBonusActive(next) ? ' · socket bonus' : ''}.` };
}

/** Pry a gem out of a socket; the gem is destroyed (WoW jewelcrafting rule). */
export function unsocketGem(sheet: CharacterSheet, target: SocketTarget, socketIndex: number): ActionResult {
  if (!GAME_FEATURES.gems) return fail('Socketing is not available.');
  const item = resolveTarget(sheet, target);
  if (!item) return fail('Choose an item to unsocket.');
  if (!item.sockets?.length) return fail('This item has no sockets.');
  if (!Number.isInteger(socketIndex) || socketIndex < 0 || socketIndex >= item.sockets.length) return fail('Choose a socket.');
  const socket = item.sockets[socketIndex], gem = gemDefinition(socket.gem);
  if (!socket.gem || !gem) return fail('That socket is empty.');
  if (item.recipe.revision >= Number.MAX_SAFE_INTEGER) return fail('This item cannot be modified further.');
  const sockets = item.sockets.map((entry, index) => index === socketIndex ? { color: entry.color } : entry);
  const next = deriveItem({ ...item, sockets, recipe: { ...item.recipe, revision: item.recipe.revision + 1 } });
  commitTarget(sheet, target, next);
  return { ok: true, message: `${gem.name} removed from ${itemDisplayName(item)} — the gem shatters.` };
}
