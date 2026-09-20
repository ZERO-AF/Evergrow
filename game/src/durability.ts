import { GAME_FEATURES } from './game-features.ts';
import { itemPrice } from './commerce.ts';
import { spendGold } from './wallet.ts';
import { refreshCharacter } from './character.ts';
import { itemDisplayName } from './items.ts';
import { pushChatMessage } from './chat-log.ts';
import { ARMOR_SLOTS, DURABLE_SLOTS, DURABILITY_RULES, STRIKE_SLOTS, durabilityOf } from './durability-state.ts';
import type { DurabilityMap } from './durability-state.ts';
import type { CharacterSheet, EquipmentSlot, Item } from './character-types.ts';
import type { Player } from './model.ts';
import type { TownNPC } from './npcs.ts';

export { DURABILITY_RULES, DURABLE_SLOTS, ARMOR_SLOTS, STRIKE_SLOTS, durabilityOf, durabilityFactor } from './durability-state.ts';
export type { DurabilityMap } from './durability-state.ts';

export type DurabilityCause = 'death' | 'hit-taken' | 'strike';
export interface BrokenItem { slot: EquipmentSlot; item: Item }

export const DURABILITY_SLOT_NAMES: Record<EquipmentSlot, string> = {
  weapon: 'Main hand', offhand: 'Off hand', head: 'Head', chest: 'Chest', gloves: 'Gloves',
  legs: 'Legs', boots: 'Boots', cloak: 'Cloak', amulet: 'Amulet', ring1: 'Ring I', ring2: 'Ring II',
};

/** Apply wear to the live player; returns the items that broke with this loss.
 * Pass sim time as `now` to also log WoW-style warnings to the chat frame. */
export function durabilityLoss(player: Player, cause: DurabilityCause, now?: number): BrokenItem[] {
  if (!GAME_FEATURES.durability) return [];
  const amount = cause === 'death' ? DURABILITY_RULES.deathLoss
    : cause === 'hit-taken' ? DURABILITY_RULES.hitTakenLoss : DURABILITY_RULES.strikeLoss;
  const slots = cause === 'strike' ? STRIKE_SLOTS : cause === 'hit-taken' ? ARMOR_SLOTS : DURABLE_SLOTS;
  const broken: BrokenItem[] = [];
  for (const slot of slots) {
    const item = player.character.equipped[slot];
    if (!item) continue;
    const before = durabilityOf(player, slot)!;
    if (before <= 0) continue;
    const after = Math.max(0, before - amount);
    if (after === before) continue;
    (player.durability ??= {})[slot] = after;
    if (after === 0) broken.push({ slot, item });
  }
  // A freshly broken piece changes derived stats and the equipped weapon projection.
  if (broken.length) refreshCharacter(player);
  if (now !== undefined) {
    if (cause === 'death') pushChatMessage(player, 'death', 'Your equipped items suffer 10% durability loss.', now);
    for (const { item } of broken) pushChatMessage(player, 'system', `${itemDisplayName(item)} has broken!`, now);
  }
  return broken;
}

/** Gold to restore one item to full: twice vendor value at 0, scaled by missing durability. */
export function repairCost(item: Item, current: number): number {
  const missing = Math.max(0, Math.min(DURABILITY_RULES.max, DURABILITY_RULES.max - current));
  return Math.max(1, Math.ceil(itemPrice(item, 'sell') * 2 * missing / DURABILITY_RULES.max));
}

export type RepairQuote = { ok: true; slots: EquipmentSlot[]; cost: number } | { ok: false; message: string };

/** Damaged equipped pieces and their total repair price; one slot when `slot` is given. */
export function repairQuote(player: Player, slot?: EquipmentSlot): RepairQuote {
  const candidates = slot === undefined ? DURABLE_SLOTS : [slot];
  const slots = candidates.filter(s => {
    if (!player.character.equipped[s]) return false;
    const value = durabilityOf(player, s);
    return value !== undefined && value < DURABILITY_RULES.max;
  });
  if (!slots.length)
    return { ok: false, message: slot === undefined ? 'Nothing needs repair.' : 'That item does not need repair.' };
  const cost = slots.reduce((sum, s) => sum + repairCost(player.character.equipped[s]!, durabilityOf(player, s)!), 0);
  return { ok: true, slots, cost };
}

export type RepairPlan = { ok: true; character: CharacterSheet; durability: DurabilityMap; cost: number; message: string }
  | { ok: false; message: string };

/** Staged repair: gold spent on a cloned sheet, durability restored on a cloned map. */
export function planRepair(player: Player, slot?: EquipmentSlot): RepairPlan {
  const quote = repairQuote(player, slot);
  if (!quote.ok) return quote;
  const character: CharacterSheet = { ...player.character };
  if (!spendGold(character, quote.cost)) return { ok: false, message: 'Not enough gold.' };
  const durability: DurabilityMap = { ...player.durability };
  for (const s of quote.slots) durability[s] = DURABILITY_RULES.max;
  const message = quote.slots.length === 1
    ? `Repaired ${itemDisplayName(player.character.equipped[quote.slots[0]]!)} · ${quote.cost} gold`
    : `Repaired ${quote.slots.length} items · ${quote.cost} gold`;
  return { ok: true, character, durability, cost: quote.cost, message };
}

/** Blacksmith gate shared by the service button and the command. */
export function repairProblem(npc: Pick<TownNPC, 'role'> | null | undefined): string | null {
  if (!GAME_FEATURES.durability) return 'Repairs are not available.';
  return npc?.role === 'blacksmith' ? null : 'Visit a blacksmith to repair equipment.';
}

/** Paper-doll warning state: broken pieces first, then anything under the warn threshold. */
export function durabilityStatus(player: Player): { broken: BrokenItem[]; worn: BrokenItem[] } {
  const broken: BrokenItem[] = [], worn: BrokenItem[] = [];
  for (const slot of DURABLE_SLOTS) {
    const item = player.character.equipped[slot];
    if (!item) continue;
    const value = durabilityOf(player, slot)!;
    if (value <= 0) broken.push({ slot, item });
    else if (value < DURABILITY_RULES.warnBelow) worn.push({ slot, item });
  }
  return { broken, worn };
}

/** Tooltip meta row: "Durability 73 / 100", amber when worn, red "broken" at 0. */
export function durabilityMetaMarkup(value: number): string {
  const v = Math.max(0, Math.min(DURABILITY_RULES.max, value));
  const color = v <= 0 ? '#da9294' : v < DURABILITY_RULES.warnBelow ? '#e0b56a' : '#9fb4ba';
  const label = v <= 0
    ? `Durability 0 / ${DURABILITY_RULES.max} · broken — stats suppressed`
    : `Durability ${Math.ceil(v)} / ${DURABILITY_RULES.max}`;
  return `<span style="color:${color}">${label}</span>`;
}

/** Corner badge for an equipment cell: red ✕ when broken, amber percent when worn. */
export function durabilityBadgeMarkup(value: number | undefined): string {
  if (value === undefined || value >= DURABILITY_RULES.warnBelow) return '';
  const broken = value <= 0;
  const title = broken ? 'Broken — repair at a blacksmith' : `Durability ${Math.ceil(value)} / ${DURABILITY_RULES.max}`;
  return `<span class="ui-durability-badge" title="${title}" style="position:absolute;top:2px;left:2px;padding:0 3px;border-radius:2px;background:#081119d9;font:600 10px 'Evergrow Numerals',system-ui,sans-serif;color:${broken ? '#da9294' : '#e0b56a'}">${broken ? '✕' : Math.ceil(value)}</span>`;
}
