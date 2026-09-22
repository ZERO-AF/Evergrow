import type { CharacterSheet, EquipmentSlot, Item, StatKey } from './character-types.ts';
import type { Player } from './model.ts';
import type { SocketTarget } from './gem-command.ts';
import { EQUIPMENT_SLOTS, deriveItem } from './items.ts';
import { gemDefinition, gemItemId, socketBonusActive, socketBonusStats, type GemDefinition } from './gem-content.ts';

/**
 * Read-only projections for the Socketing panel (socket-panel.ts). Pure
 * helpers over the character sheet — nothing here mutates items, inventory or
 * sockets. gem-command.ts owns the validated mutations; this module answers
 * the panel's questions: which items can be socketed, which gems are usable,
 * and what an insertion would do (derived stats + socket bonus).
 */

/** One socketable item: equipped gear or a bag item that rolled sockets. */
export interface SocketTargetEntry {
  /** Command-ready target for the socketGem/unsocketGem character commands. */
  target: SocketTarget;
  item: Item;
}

/** One loose gem in the bag, ready to be socketed. */
export interface GemEntry {
  /** Bag index — the gemIndex the socketGem command consumes. */
  index: number;
  item: Item;
  gem: GemDefinition;
}

/** The simulated result of inserting a gem into one socket. Never committed. */
export interface SocketPreview {
  ok: boolean;
  message?: string;
  /** The socket the preview applies to (-1 when the preview failed early). */
  socketIndex: number;
  /** The item as it would look after socketing, derived stats included. */
  item: Item | null;
  /** True when the insertion replaces — destroys — an already socketed gem. */
  replaces: boolean;
  /** True when the previewed item's socket bonus would be active. */
  bonusActive: boolean;
  /** The item's authored socket bonus, when its kind has one. */
  bonus: { stat: StatKey; value: number } | null;
}

/** Equipped socketed gear first, then bag items in pack order. */
export function socketTargets(player: Player): SocketTargetEntry[] {
  const sheet = player.character;
  const targets: SocketTargetEntry[] = [];
  for (const slot of EQUIPMENT_SLOTS) {
    const item = sheet.equipped[slot];
    if (item?.sockets?.length) targets.push({ target: { equipped: slot }, item });
  }
  sheet.inventory.forEach((item, bag) => {
    if (item?.sockets?.length) targets.push({ target: { bag }, item });
  });
  return targets;
}

/** Every bag item that is a gem token (gem-content.ts GEM_ITEM_KIND convention). */
export function gemsAvailable(player: Player): GemEntry[] {
  const gems: GemEntry[] = [];
  player.character.inventory.forEach((item, index) => {
    const gem = gemDefinition(gemItemId(item));
    if (item && gem) gems.push({ index, item, gem });
  });
  return gems;
}

/**
 * Simulate inserting `gemItem` into one of the item's sockets. When
 * `socketIndex` is omitted the first empty socket is previewed (socket 0 when
 * all are filled — i.e. a replacement preview). Mirrors gem-command's socket
 * write and deriveItem re-derivation without touching the sheet.
 */
export function socketPreview(item: Item, gemItem: Item, socketIndex?: number): SocketPreview {
  const bonus = socketBonusStats(item);
  const fail = (message: string, at = -1): SocketPreview =>
    ({ ok: false, message, socketIndex: at, item: null, replaces: false, bonusActive: socketBonusActive(item), bonus });
  const gem = gemDefinition(gemItemId(gemItem));
  if (!gem) return fail('That item is not a gem.');
  if (!item.sockets?.length) return fail('This item has no sockets.');
  const index = socketIndex ?? Math.max(0, item.sockets.findIndex(socket => socket.gem === undefined));
  if (!Number.isInteger(index) || index < 0 || index >= item.sockets.length) return fail('Choose a socket.');
  const sockets = item.sockets.map((socket, i) =>
    i === index ? { color: socket.color, gem: gem.id, gemLevel: gemItem.itemLevel } : socket);
  const next = deriveItem({ ...item, sockets, recipe: { ...item.recipe, revision: item.recipe.revision + 1 } });
  return {
    ok: true, socketIndex: index, item: next,
    replaces: item.sockets[index].gem !== undefined,
    bonusActive: socketBonusActive(next), bonus,
  };
}

/** The item a target points at right now, or null when it moved or was removed. */
export function socketTargetItem(sheet: CharacterSheet, target: SocketTarget): Item | null {
  if ('bag' in target)
    return Number.isInteger(target.bag) && target.bag >= 0 && target.bag < sheet.inventory.length
      ? sheet.inventory[target.bag] : null;
  return EQUIPMENT_SLOTS.includes(target.equipped) ? sheet.equipped[target.equipped] : null;
}

/** Stable DOM key for a target ('bag:3' / 'equipped:chest'); parse with parseSocketTargetKey. */
export function socketTargetKey(target: SocketTarget): string {
  return 'bag' in target ? `bag:${target.bag}` : `equipped:${target.equipped}`;
}

/** Inverse of socketTargetKey; returns null for malformed or out-of-schema keys. */
export function parseSocketTargetKey(key: string): SocketTarget | null {
  const bag = /^bag:(\d+)$/.exec(key);
  if (bag) return { bag: Number(bag[1]) };
  const equipped = /^equipped:([a-z0-9]+)$/.exec(key);
  return equipped && (EQUIPMENT_SLOTS as readonly string[]).includes(equipped[1])
    ? { equipped: equipped[1] as EquipmentSlot } : null;
}
