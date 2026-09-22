/** Permanent gear enchanting (docs/wow-deepening.md §3): the Enchanting profession's
 * high-skill family applies an EnchantDef (enchant-content.ts) directly onto an
 * equipped or packed item — no scroll intermediary. The enchant persists as
 * `Item.enchant` on the character sheet; deriveItem folds the stats into the
 * item's implicit modifiers. Mirrors the checkpoint → persist → commit dance of
 * profession-command.ts (whose staging helpers are reused). */
import { deriveItem, EQUIPMENT_SLOTS, itemDisplayName } from './items.ts';
import { pushChatMessage } from './chat-log.ts';
import { GAME_FEATURES } from './game-features.ts';
import type { CharacterSheet, EquipmentSlot, Item } from './character-types.ts';
import type { Player } from './model.ts';
import type { Simulation } from './simulation.ts';
import { enchantDefinition } from './enchant-content.ts';
import { PROFESSION_MATERIALS } from './profession-content.ts';
import {
  attemptRoll, commitBags, commitCharacter, stageBags,
  type CheckpointWithProfessions, type ProfessionPersist, type ProfessionResult,
} from './profession-command.ts';
import {
  awardSkill, ensureProfession, missingMaterials, professionLevel, skillDifficulty, spendMaterials,
} from './profession-state.ts';
import { guildProfessionChanceFactor } from './guild-state.ts';

export type EnchantTarget = { bag: number } | { equipped: EquipmentSlot };

const fail = (message: string): ProfessionResult => ({ ok: false, message });
const ok = (message: string): ProfessionResult => ({ ok: true, message });

/** The item at a target, or null when the slot is empty / out of range. */
export function enchantTargetItem(sheet: CharacterSheet, target: EnchantTarget): Item | null {
  if ('bag' in target) {
    return Number.isInteger(target.bag) && target.bag >= 0 && target.bag < sheet.inventory.length
      ? sheet.inventory[target.bag] : null;
  }
  return EQUIPMENT_SLOTS.includes(target.equipped) ? sheet.equipped[target.equipped] : null;
}

/** Every enchantable item the player holds, for the panel's target picker. */
export function enchantTargets(sheet: CharacterSheet, enchantId: string): { target: EnchantTarget; item: Item }[] {
  const def = enchantDefinition(enchantId);
  if (!def) return [];
  const out: { target: EnchantTarget; item: Item }[] = [];
  for (const slot of EQUIPMENT_SLOTS) {
    const item = sheet.equipped[slot];
    if (item && def.kinds.includes(item.kind)) out.push({ target: { equipped: slot }, item });
  }
  sheet.inventory.forEach((item, index) => {
    if (item && def.kinds.includes(item.kind)) out.push({ target: { bag: index }, item });
  });
  return out;
}

export function enchantProblem(player: Player, enchantId: string, target: EnchantTarget): string | null {
  if (!GAME_FEATURES.professions) return 'Professions are disabled.';
  if (player.dead) return 'You are dead.';
  const def = enchantDefinition(enchantId);
  if (!def) return 'Unknown enchant.';
  const level = professionLevel(player, 'enchanting');
  if (level < def.skill[0]) return `Requires Enchanting (${def.skill[0]}).`;
  const item = enchantTargetItem(player.character, target);
  if (!item) return 'Choose an item to enchant.';
  if (!def.kinds.includes(item.kind)) return `${def.name} does not fit ${item.kind === 'weapon' ? 'a weapon' : 'that item'}.`;
  if (item.enchant) return `${itemDisplayName(item)} is already enchanted.`;
  if (item.recipe.revision >= Number.MAX_SAFE_INTEGER) return 'This item cannot be modified further.';
  const missing = missingMaterials(player, def.materials);
  const first = Object.keys(missing)[0];
  if (first) return `Missing ${PROFESSION_MATERIALS[first]?.name ?? first} ×${missing[first]}.`;
  return null;
}

/** Apply a permanent enchant: spend materials, stamp `item.enchant`, re-derive
 * the item (stats + power) and award Enchanting skill — all inside one checkpoint. */
export async function executeEnchant(sim: Simulation, enchantId: string, target: EnchantTarget, persist: ProfessionPersist): Promise<ProfessionResult> {
  const problem = enchantProblem(sim.player, enchantId, target);
  if (problem) return fail(problem);
  const def = enchantDefinition(enchantId)!;
  const checkpoint = sim.captureCheckpoint() as CheckpointWithProfessions;
  const staged = stageBags(sim, checkpoint);
  const progress = ensureProfession(staged, 'enchanting');
  if (!spendMaterials(staged, def.materials)) return fail('Missing materials.');
  const item = enchantTargetItem(checkpoint.character, target)!;
  const next = deriveItem({ ...item, enchant: def.id, recipe: { ...item.recipe, revision: item.recipe.revision + 1 } });
  if ('bag' in target) checkpoint.character.inventory[target.bag] = next;
  else checkpoint.character.equipped[target.equipped] = next;
  const attempt = progress.enchanted ?? 0;
  progress.enchanted = attempt + 1;
  const levels = awardSkill(progress, skillDifficulty(def.skill, progress.level), attemptRoll(def.id, attempt), guildProfessionChanceFactor(sim.player));
  const result = await persist(checkpoint);
  if (!result.ok) return result;
  commitBags(sim, checkpoint);
  commitCharacter(sim, checkpoint);
  pushChatMessage(sim.player, 'loot', `${itemDisplayName(next)} gains ${def.name}.`, sim.time);
  if (levels) pushChatMessage(sim.player, 'level', `Enchanting increases to ${progress.level}.`, sim.time);
  return ok(levels ? `${def.name} · Enchanting ${progress.level}` : `${def.name} applied to ${itemDisplayName(next)}.`);
}
