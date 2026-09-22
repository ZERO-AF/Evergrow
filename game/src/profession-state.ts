/** Profession progress + material bags (docs/wow-deepening.md §3).
 * Persisted shape: `player.professions[profId]` = { level, xp } plus two extra keys the
 * save validator tolerates: `materials` (id → count) and `gathered` (node id → sim time).
 * Fishing materials live on `player.fishing.materials` under the same convention. */
import type { Player } from './model.ts';
import type { Item } from './character-types.ts';
import { GAME_FEATURES } from './game-features.ts';
import {
  PROFESSIONS, PROFESSION_MATERIALS, PROFESSION_RULES, skillDifficulty,
  type MaterialBag, type MaterialDef, type ProfessionId, type RecipeDef, type SkillDifficulty,
} from './profession-content.ts';

export { skillDifficulty, DIFFICULTY_COLORS, PROFESSION_RULES } from './profession-content.ts';
export type { SkillDifficulty } from './profession-content.ts';

/** Widened progress entry; the contract only requires {level, xp}. */
export interface ProfessionProgress {
  level: number;
  xp: number;
  /** Material id → count owned by this profession's bag. */
  materials?: Record<string, number>;
  /** Gathered node id → sim time of the gather (respawn bookkeeping). */
  gathered?: Record<string, number>;
  /** Monotonic counters seeding deterministic yield/skill-up rolls. */
  gatherSeq?: number;
  crafted?: number;
  disenchanted?: number;
}
export interface FishingProgress { level: number; xp: number; materials?: Record<string, number> }
/** Anything carrying the two bags: the live player or a staged checkpoint. */
export interface ProfessionsCarrier {
  professions?: Partial<Record<ProfessionId, ProfessionProgress>>;
  fishing?: FishingProgress;
}

export function professionsEnabled(): boolean { return GAME_FEATURES.professions; }

/** Professions are learned implicitly: progress materializes on the first gain. */
export function professionProgress(carrier: ProfessionsCarrier, id: ProfessionId): ProfessionProgress | undefined {
  return carrier.professions?.[id];
}
export function professionLevel(carrier: ProfessionsCarrier, id: ProfessionId): number {
  // Implicit learning: an untouched profession still gathers/crafts at skill 1.
  return carrier.professions?.[id]?.level ?? 1;
}
/** Create-or-read the progress entry; call only inside a staged/persisted mutation. */
export function ensureProfession(carrier: ProfessionsCarrier, id: ProfessionId): ProfessionProgress {
  const professions = (carrier.professions ??= {});
  return professions[id] ??= { level: 1, xp: 0 };
}

// ── Materials ────────────────────────────────────────────────────────────────

function bag(carrier: ProfessionsCarrier, owner: MaterialBag): Record<string, number> | undefined {
  return owner === 'fishing' ? carrier.fishing?.materials : carrier.professions?.[owner]?.materials;
}
function ensureBag(carrier: ProfessionsCarrier, owner: MaterialBag): Record<string, number> {
  if (owner === 'fishing') return ((carrier.fishing ??= { level: 1, xp: 0 }).materials ??= {});
  return (ensureProfession(carrier, owner).materials ??= {});
}
export function materialCount(carrier: ProfessionsCarrier, id: string): number {
  const def = PROFESSION_MATERIALS[id];
  return def ? bag(carrier, def.bag)?.[id] ?? 0 : 0;
}
/** Grant into the material's declared bag. Unknown ids are rejected, never silently dropped. */
export function grantMaterial(carrier: ProfessionsCarrier, id: string, count: number): boolean {
  const def = PROFESSION_MATERIALS[id];
  if (!def || !Number.isSafeInteger(count) || count <= 0) return false;
  const store = ensureBag(carrier, def.bag);
  store[id] = (store[id] ?? 0) + count;
  return true;
}
/** Missing counts for a recipe's materials; empty when everything is available. */
export function missingMaterials(carrier: ProfessionsCarrier, materials: Readonly<Record<string, number>>): Record<string, number> {
  const missing: Record<string, number> = {};
  for (const [id, need] of Object.entries(materials)) {
    const short = need - materialCount(carrier, id);
    if (short > 0) missing[id] = short;
  }
  return missing;
}
export function hasMaterials(carrier: ProfessionsCarrier, materials: Readonly<Record<string, number>>): boolean {
  return Object.keys(missingMaterials(carrier, materials)).length === 0;
}
/** Atomic spend: every count is verified before any bag changes. */
export function spendMaterials(carrier: ProfessionsCarrier, materials: Readonly<Record<string, number>>): boolean {
  if (Object.keys(missingMaterials(carrier, materials)).length) return false;
  for (const [id, need] of Object.entries(materials)) {
    const store = bag(carrier, PROFESSION_MATERIALS[id]!.bag)!;
    const left = store[id]! - need;
    if (left > 0) store[id] = left; else delete store[id];
  }
  return true;
}
/** Flattened material totals across every bag, for the panel's materials list. */
export function allMaterials(carrier: ProfessionsCarrier): { def: MaterialDef; count: number }[] {
  const totals = new Map<string, number>();
  const collect = (store?: Record<string, number>) => {
    for (const [id, count] of Object.entries(store ?? {}))
      if (count > 0 && PROFESSION_MATERIALS[id]) totals.set(id, (totals.get(id) ?? 0) + count);
  };
  for (const id of Object.keys(PROFESSIONS) as ProfessionId[]) collect(carrier.professions?.[id]?.materials);
  collect(carrier.fishing?.materials);
  return [...totals.entries()].map(([id, count]) => ({ def: PROFESSION_MATERIALS[id]!, count }))
    .sort((a, b) => a.def.kind.localeCompare(b.def.kind) || a.def.name.localeCompare(b.def.name));
}

// ── Skill progression ────────────────────────────────────────────────────────

/** Award profession XP for one gather/craft. `roll` ∈ [0,1) gates the skill-up chance;
 * `chanceFactor` (Working Overtime guild perk) widens that chance.
 * Returns the gained levels (0 when gray, capped, or the roll fails). */
export function awardSkill(progress: ProfessionProgress, difficulty: SkillDifficulty, roll: number, chanceFactor = 1): number {
  if (progress.level >= PROFESSION_RULES.maxSkill || difficulty === 'gray') return 0;
  if (roll >= Math.min(1, PROFESSION_RULES.chanceByDifficulty[difficulty] * chanceFactor)) return 0;
  progress.xp += PROFESSION_RULES.xpByDifficulty[difficulty];
  let levels = 0;
  while (progress.level < PROFESSION_RULES.maxSkill && progress.xp >= PROFESSION_RULES.xpForLevel(progress.level)) {
    progress.xp -= PROFESSION_RULES.xpForLevel(progress.level);
    progress.level++; levels++;
  }
  if (progress.level >= PROFESSION_RULES.maxSkill) progress.xp = 0;
  return levels;
}
export function recipeDifficulty(recipe: RecipeDef, level: number): SkillDifficulty {
  return skillDifficulty(recipe.skill, level);
}

// ── Gathered-node bookkeeping ────────────────────────────────────────────────

export function gatheredAt(carrier: ProfessionsCarrier, profession: ProfessionId, nodeId: string): number | undefined {
  return carrier.professions?.[profession]?.gathered?.[nodeId];
}
export function markGathered(carrier: ProfessionsCarrier, profession: ProfessionId, nodeId: string, time: number): void {
  (ensureProfession(carrier, profession).gathered ??= {})[nodeId] = time;
}
/** Keep the persisted map bounded: entries past the respawn window are dead weight. */
export function pruneGathered(progress: ProfessionProgress, time: number, respawn: number, cap = 64): void {
  const gathered = progress.gathered;
  if (!gathered) return;
  for (const [id, at] of Object.entries(gathered)) if (time - at > respawn) delete gathered[id];
  const ids = Object.keys(gathered);
  if (ids.length > cap) for (const id of ids.sort((a, b) => gathered[a]! - gathered[b]!).slice(0, ids.length - cap)) delete gathered[id];
}

// ── Disenchanting (enchanting's material source; real WotLK yields by item level) ──

export interface DisenchantYield { readonly id: string; readonly count: number | readonly [number, number] }
/** Approximate WotLK disenchant tables: dust+essence by item level, shards for rare+. */
export function disenchantYield(item: Pick<Item, 'tier' | 'itemLevel'>): readonly DisenchantYield[] {
  const level = item.itemLevel;
  if (item.tier === 'rare') return [{ id: 'smallBrilliantShard', count: 1 }];
  if (item.tier === 'epic' || item.tier === 'legendary' || item.tier === 'unique') return [{ id: 'largeBrilliantShard', count: [1, 2] }];
  if (level <= 20) return [{ id: 'strangeDust', count: [1, 2] }, { id: 'lesserMagicEssence', count: 1 }];
  if (level <= 40) return [{ id: 'strangeDust', count: [2, 4] }, { id: 'greaterMagicEssence', count: 1 }];
  if (level <= 55) return [{ id: 'visionDust', count: [1, 3] }, { id: 'lesserMysticEssence', count: 1 }];
  return [{ id: 'dreamDust', count: [1, 3] }, { id: 'lesserMysticEssence', count: [1, 2] }];
}
export function canDisenchant(item: Pick<Item, 'tier'> | null | undefined): item is Item {
  return !!item && item.tier !== 'common';
}
/** Inventory slots holding disenchantable gear (locked items are protected). */
export function disenchantableItems(player: Player): { index: number; item: Item }[] {
  return player.character.inventory
    .map((item, index) => ({ index, item }))
    .filter((e): e is { index: number; item: Item } => !!e.item && !e.item.locked && canDisenchant(e.item));
}
