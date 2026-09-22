/** Durable profession commands (docs/wow-deepening.md §3): gather completion, crafting,
 * disenchanting and consumable use. Every mutation stages on a checkpoint clone, persists,
 * then commits to the live player — mirroring commerce-command/poi-command. */
import { cloneData } from './data-clone.ts';
import { refreshCharacter } from './character.ts';
import { refreshBuffStats } from './player-skill-effects.ts';
import { addInventoryItem } from './inventory.ts';
import { canPackItem } from './inventory-grid.ts';
import { generateItem, randomSource } from './items.ts';
import { createGem, isGemId } from './gem-content.ts';
import { pushChatMessage } from './chat-log.ts';
import { GAME_FEATURES } from './game-features.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { Player, WowBuff } from './model.ts';
import type { Item } from './character-types.ts';
import type { Simulation } from './simulation.ts';
import {
  PROFESSIONS, PROFESSION_MATERIALS, PROFESSION_RULES, findRecipe, skillDifficulty,
  type RecipeDef,
} from './profession-content.ts';
import {
  awardSkill, canDisenchant, disenchantYield, ensureProfession, grantMaterial, markGathered,
  materialCount, missingMaterials, professionLevel, pruneGathered, spendMaterials,
  type ProfessionsCarrier,
} from './profession-state.ts';
import {
  GATHER_RULES, cancelGatherChannel, focusGatherNode, gatherChannelOf, gatherProblem, rollNodeYields, startGather, type GatherNode,
} from './gather-node.ts';
import { guildProfessionChanceFactor } from './guild-state.ts';
import { DURABLE_SLOTS, DURABILITY_RULES, type DurabilityMap } from './durability-state.ts';

export interface ProfessionResult { ok: boolean; message: string }
export type ProfessionPersist = (checkpoint: CharacterCheckpoint) => ProfessionResult | Promise<ProfessionResult>;

/** The checkpoint fields this feature stages; the integrator also persists them on save. */
export type CheckpointWithProfessions = CharacterCheckpoint & ProfessionsCarrier & { buffs?: WowBuff[]; durability?: DurabilityMap };

const fail = (message: string): ProfessionResult => ({ ok: false, message });
const ok = (message: string): ProfessionResult => ({ ok: true, message });

/** Stage the two bags onto a fresh checkpoint clone (absent until the integrator wires them). */
export function stageBags(sim: Simulation, checkpoint: CheckpointWithProfessions): ProfessionsCarrier {
  checkpoint.professions = cloneData(sim.player.professions) as CheckpointWithProfessions['professions'];
  checkpoint.fishing = cloneData(sim.player.fishing) as CheckpointWithProfessions['fishing'];
  return checkpoint;
}
/** Publish staged bags (+ optional character/buff/hp changes) after a successful persist. */
export function commitBags(sim: Simulation, checkpoint: CheckpointWithProfessions): void {
  const p = sim.player;
  p.professions = checkpoint.professions as Player['professions'];
  p.fishing = checkpoint.fishing as Player['fishing'];
}
export function commitCharacter(sim: Simulation, checkpoint: CheckpointWithProfessions): void {
  sim.player.character = checkpoint.character;
  refreshCharacter(sim.player);
}

const hashText = (value: string): number => {
  let n = 2166136261;
  for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619);
  return n >>> 0;
};
/** Deterministic skill-up roll: stable per (recipe/node, attempt) across save/load. */
export const attemptRoll = (seedText: string, attempt: number): number =>
  randomSource((hashText(seedText) ^ Math.imul(attempt + 1, 0x9E3779B9)) >>> 0)();

/** Build a recipe's gear result. Jewelcrafting cuts carry a gem id as
 * item.profileId — those are gem tokens (gem-content.ts), not generateItem gear. */
function craftResultItem(recipe: RecipeDef, seed: number): Item {
  const spec = recipe.item!;
  if (isGemId(spec.profileId)) return createGem(spec.profileId, seed, spec.itemLevel);
  const item = generateItem(seed, spec.itemLevel, spec.kind, spec.profileId, spec.tier);
  item.name = recipe.name; item.baseName = recipe.name;
  return item;
}

// ── Gathering ────────────────────────────────────────────────────────────────

/** E-interact entry: focus the nearest live node and start the channel.
 * Returns { handled } so the caller can fall through to NPC/site interacts. */
export function gatherInteract(sim: Simulation, pointer?: { x: number; y: number }): { handled: boolean; problem?: string } {
  if (!GAME_FEATURES.professions || sim.dungeonFloor) return { handled: false };
  const node = focusGatherNode(sim.world, sim.player, sim.time, sim.player, pointer);
  if (!node) return { handled: false };
  const problem = startGather(sim, node);
  return { handled: true, problem: problem ?? undefined };
}

/** Channel complete: roll yields, mark the node, award skill — all inside one checkpoint. */
export async function executeGather(sim: Simulation, node: GatherNode, persist: ProfessionPersist): Promise<ProfessionResult> {
  const p = sim.player;
  const channel = gatherChannelOf(sim);
  if (!channel || channel.node.id !== node.id) return fail('The gather was interrupted.');
  cancelGatherChannel(sim);
  const problem = gatherProblem(p, node)
    ?? (Math.hypot(node.x - p.x, node.y - p.y) > GATHER_RULES.reach ? 'Move closer.' : null);
  if (problem) return fail(problem);
  const profession = node.def.profession;
  const checkpoint = sim.captureCheckpoint() as CheckpointWithProfessions;
  const staged = stageBags(sim, checkpoint);
  const progress = ensureProfession(staged, profession);
  const attempt = progress.gatherSeq ?? 0;
  const yields = rollNodeYields(node, attempt);
  if (!yields.length) return fail('Nothing to gather.');
  for (const yield_ of yields) grantMaterial(staged, yield_.id, yield_.count);
  markGathered(staged, profession, node.id, sim.time);
  progress.gatherSeq = attempt + 1;
  pruneGathered(progress, sim.time, GATHER_RULES.respawn);
  const levels = awardSkill(progress, skillDifficulty(node.def.skill, progress.level), attemptRoll(node.id, attempt), guildProfessionChanceFactor(p));
  const result = await persist(checkpoint);
  if (!result.ok) return result;
  commitBags(sim, checkpoint);
  const names = yields.map(y => `${PROFESSION_MATERIALS[y.id]?.name ?? y.id} ×${y.count}`).join(', ');
  pushChatMessage(p, 'loot', `You receive loot: [${names}]`, sim.time);
  if (levels) pushChatMessage(p, 'level', `${PROFESSIONS[profession].name} increases to ${progress.level}.`, sim.time);
  return ok(levels ? `${names} · ${PROFESSIONS[profession].name} ${progress.level}` : names);
}


export function craftProblem(player: Player, recipeId: string): string | null {
  if (!GAME_FEATURES.professions) return 'Professions are disabled.';
  if (player.dead) return 'You are dead.';
  const found = findRecipe(recipeId);
  if (!found) return 'Unknown recipe.';
  const level = professionLevel(player, found.profession);
  if (level < found.recipe.skill[0]) return `Requires ${PROFESSIONS[found.profession].name} (${found.recipe.skill[0]}).`;
  const missing = missingMaterials(player, found.recipe.materials);
  const first = Object.keys(missing)[0];
  if (first) return `Missing ${PROFESSION_MATERIALS[first]?.name ?? first} ×${missing[first]}.`;
  if (found.recipe.item) {
    const preview = craftResultItem(found.recipe, 1);
    if (!canPackItem(player.character, preview)) return 'Your bags are full.';
  }
  return null;
}

/** Craft one recipe: spend materials, grant the product (material or generated gear), award skill. */
export async function executeCraft(sim: Simulation, recipeId: string, persist: ProfessionPersist): Promise<ProfessionResult> {
  const problem = craftProblem(sim.player, recipeId);
  if (problem) return fail(problem);
  const { profession, recipe } = findRecipe(recipeId)!;
  const checkpoint = sim.captureCheckpoint() as CheckpointWithProfessions;
  const staged = stageBags(sim, checkpoint);
  const progress = ensureProfession(staged, profession);
  if (!spendMaterials(staged, recipe.materials)) return fail('Missing materials.');
  let crafted = '';
  if (recipe.item) {
    const seed = (hashText(recipe.id) ^ Math.imul((progress.crafted ?? 0) + 1, 0x9E3779B9)) >>> 0;
    const item = craftResultItem(recipe, seed);
    if (item.kind === 'consumable') item.stack = Math.max(1, recipe.resultCount);
    if (!addInventoryItem(checkpoint.character, item)) return fail('Your bags are full.');
    crafted = item.kind === 'consumable' && (item.stack ?? 1) > 1 ? `${item.name} ×${item.stack}` : item.name;
  } else {
    grantMaterial(staged, recipe.result, recipe.resultCount);
    crafted = `${PROFESSION_MATERIALS[recipe.result]?.name ?? recipe.name}${recipe.resultCount > 1 ? ` ×${recipe.resultCount}` : ''}`;
  }
  progress.crafted = (progress.crafted ?? 0) + 1;
  const levels = awardSkill(progress, skillDifficulty(recipe.skill, progress.level), attemptRoll(recipe.id, progress.crafted), guildProfessionChanceFactor(sim.player));
  const result = await persist(checkpoint);
  if (!result.ok) return result;
  commitBags(sim, checkpoint);
  if (recipe.item) commitCharacter(sim, checkpoint);
  pushChatMessage(sim.player, 'loot', `You create: [${crafted}]`, sim.time);
  if (levels) pushChatMessage(sim.player, 'level', `${PROFESSIONS[profession].name} increases to ${progress.level}.`, sim.time);
  return ok(levels ? `${recipe.name} · ${PROFESSIONS[profession].name} ${progress.level}` : `Created ${crafted}.`);
}

// ── Disenchanting ────────────────────────────────────────────────────────────

/** WotLK-style requirement: ilvl ≤20 needs skill 1, then +25 per 5 item levels. */
const disenchantSkillRequired = (item: { itemLevel: number }): number =>
  Math.min(PROFESSION_RULES.maxSkill, item.itemLevel <= 20 ? 1 : 25 * Math.ceil((item.itemLevel - 20) / 5));

export function disenchantProblem(player: Player, inventoryIndex: number): string | null {
  if (!GAME_FEATURES.professions) return 'Professions are disabled.';
  if (player.dead) return 'You are dead.';
  const item = player.character.inventory[inventoryIndex];
  if (!item) return 'No item in that slot.';
  if (item.locked) return 'Unlock the item first.';
  if (!canDisenchant(item)) return 'Only magic or better equipment can be disenchanted.';
  const required = disenchantSkillRequired(item);
  const level = professionLevel(player, 'enchanting');
  if (level < required) return `Requires Enchanting (${required}).`;
  return null;
}

/** Destroy an inventory item into enchanting materials (real WotLK disenchant loop). */
export async function executeDisenchant(sim: Simulation, inventoryIndex: number, persist: ProfessionPersist): Promise<ProfessionResult> {
  const problem = disenchantProblem(sim.player, inventoryIndex);
  if (problem) return fail(problem);
  const item = sim.player.character.inventory[inventoryIndex]!;
  const checkpoint = sim.captureCheckpoint() as CheckpointWithProfessions;
  const staged = stageBags(sim, checkpoint);
  const progress = ensureProfession(staged, 'enchanting');
  const attempt = progress.disenchanted ?? 0;
  const random = randomSource((item.seed ^ Math.imul(attempt + 1, 0x85EBCA6B)) >>> 0);
  const count = (c: number | readonly [number, number]) => Array.isArray(c) ? c[0] + Math.floor(random() * (c[1] - c[0] + 1)) : c;
  const yields = disenchantYield(item).map(y => ({ id: y.id, count: count(y.count) }));
  checkpoint.character.inventory[inventoryIndex] = null;
  for (const yield_ of yields) grantMaterial(staged, yield_.id, yield_.count);
  progress.disenchanted = attempt + 1;
  const required = disenchantSkillRequired(item);
  const levels = awardSkill(progress, skillDifficulty([required, required + 20, required + 40, required + 60], progress.level), attemptRoll(item.id, attempt), guildProfessionChanceFactor(sim.player));
  const result = await persist(checkpoint);
  if (!result.ok) return result;
  commitBags(sim, checkpoint);
  commitCharacter(sim, checkpoint);
  const names = yields.map(y => `${PROFESSION_MATERIALS[y.id]?.name ?? y.id} ×${y.count}`).join(', ');
  pushChatMessage(sim.player, 'loot', `${item.name} disenchants into: [${names}]`, sim.time);
  if (levels) pushChatMessage(sim.player, 'level', `Enchanting increases to ${progress.level}.`, sim.time);
  return ok(`Disenchanted ${item.name}: ${names}.`);
}

// ── Consumables / enchant scrolls ────────────────────────────────────────────

export function useProblem(player: Player, materialId: string): string | null {
  if (!GAME_FEATURES.professions) return 'Professions are disabled.';
  if (player.dead) return 'You are dead.';
  const def = PROFESSION_MATERIALS[materialId];
  if (!def?.use) return 'That cannot be used.';
  if (materialCount(player, materialId) < 1) return `No ${def.name} left.`;
  if (def.use.repair !== undefined && DURABLE_SLOTS.every(slot => (player.durability?.[slot] ?? DURABILITY_RULES.max) >= DURABILITY_RULES.max))
    return 'Your gear is already fully repaired.';
  return null;
}

/** Use one stack unit: flat heal or a timed buff (Well Fed / elixir / enchant scroll / weapon imbue). */
export async function executeUse(sim: Simulation, materialId: string, persist: ProfessionPersist): Promise<ProfessionResult> {
  const problem = useProblem(sim.player, materialId);
  if (problem) return fail(problem);
  const def = PROFESSION_MATERIALS[materialId]!, use = def.use!;
  const checkpoint = sim.captureCheckpoint() as CheckpointWithProfessions;
  const staged = stageBags(sim, checkpoint);
  if (!spendMaterials(staged, { [materialId]: 1 })) return fail(`No ${def.name} left.`);
  let buffed = false, healed = 0, blasted = 0, repaired = false;
  if (use.heal || use.healFraction) {
    healed = Math.min(sim.player.maxHp, checkpoint.hp + (use.heal ?? 0) + sim.player.maxHp * (use.healFraction ?? 0)) - checkpoint.hp;
    checkpoint.hp += healed;
  }
  if (use.buff) {
    const spec = use.buff, buffs = (checkpoint.buffs ??= []);
    if (spec.exclusiveGroup) for (let i = buffs.length - 1; i >= 0; i--) if (buffs[i]!.exclusiveGroup === spec.exclusiveGroup) buffs.splice(i, 1);
    const existing = buffs.find(b => b.id === spec.name);
    if (existing) existing.remaining = Math.max(existing.remaining, spec.duration);
    else buffs.push({ id: spec.name, name: spec.name, color: spec.color, remaining: spec.duration, duration: spec.duration,
      stats: spec.stats, absorb: spec.absorb, absorbRemaining: spec.absorb ? sim.player.maxHp * spec.absorb : undefined,
      manaPerSecond: spec.manaPerSecond, healPerSecond: spec.healPerSecond, exclusiveGroup: spec.exclusiveGroup });
    buffed = true;
  }
  if (use.repair !== undefined) {
    const durability = (checkpoint.durability = { ...sim.player.durability });
    for (const slot of DURABLE_SLOTS) durability[slot] = Math.min(DURABILITY_RULES.max, (durability[slot] ?? DURABILITY_RULES.max) + use.repair);
    repaired = true;
  }
  const result = await persist(checkpoint);
  if (!result.ok) return result;
  commitBags(sim, checkpoint);
  const p = sim.player;
  if (healed) p.hp = checkpoint.hp;
  if (buffed) { p.buffs = checkpoint.buffs; refreshBuffStats(p); }
  if (repaired) { p.durability = checkpoint.durability; refreshCharacter(p); }
  // The blast lands on live enemies after the spend commits — combat state is
  // not transactional, so the bomb always detonates once the charge is gone.
  if (use.blast) {
    const blast = use.blast;
    for (const enemy of sim.enemies) {
      if (enemy.state === 'dead' || Math.hypot(enemy.x - p.x, enemy.y - p.y) > blast.radius) continue;
      sim.applyDot(enemy, { school: blast.school ?? 'fire', flatDps: blast.damage, duration: 1 }, blast.damage);
      if (blast.stun) sim.applyCc(enemy, 'stun', blast.stun);
      blasted++;
    }
  }
  pushChatMessage(p, 'system', use.blast ? `${def.name} detonates${blasted ? `, hitting ${blasted} ${blasted === 1 ? 'enemy' : 'enemies'}` : ' harmlessly'}.` : `You use ${def.name}.`, sim.time);
  return ok(healed ? `${def.name} restores ${Math.round(healed)} health.`
    : blasted ? `${def.name} hits ${blasted} ${blasted === 1 ? 'enemy' : 'enemies'}.`
    : use.blast ? `${def.name} detonates harmlessly.`
    : repaired ? `${def.name} restores your gear's durability.`
    : `${def.name} applied.`);
}
