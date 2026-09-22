/** Trainer state helpers (WotLK class trainers): pure reads over the sheet.
 *
 * The `trained` ledger records which allocated nodes and skill ranks were
 * bought with gold instead of skill points, so the save's point-conservation
 * ledger (character-save.ts) can exempt them. `skills` holds skill ids whose
 * sanctum node (`wow-<classId>-<skillId>`) sits in `allocatedNodes` without a
 * point spent; `ranks` counts gold-bought ranks inside `skillRanks`.
 * The field rides CharacterSheet as an optional member — the integrator adds
 * `trained?: TrainedSkills` to the interface and `validTrainerLedger` to
 * validSheet (see trainer-command.ts header). */
import { knowsSkill, learnedSkillRank, maximumSkillRank, sheetClassId, SKILL_RANK_RULES } from './skill-progression.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { canAfford } from './wallet.ts';
import { trainerLearnable, trainerRankCost, trainerRankLevel, trainerSkillClass, type TrainerLearnable } from './trainer-content.ts';
import type { CharacterSheet, SkillId } from './character-types.ts';
import type { WowClassId } from './wow-types.ts';

/** Gold-bought training ledger on CharacterSheet (optional until the integrator adds it). */
export interface TrainedSkills {
  /** Class skills learned for gold; each has its `wow-<classId>-<skillId>` node in allocatedNodes. */
  skills: SkillId[];
  /** Gold-bought rank count per skill (the share of skillRanks[id] - 1 not paid in points). */
  ranks: Partial<Record<SkillId, number>>;
}

/** Sheet view carrying the trainer ledger. */
export type TrainedSheet = CharacterSheet & { trained?: TrainedSkills };

/** The sheet's trainer ledger, installed on first purchase. */
export function ensureTrained(sheet: TrainedSheet): TrainedSkills {
  return sheet.trained ??= { skills: [], ranks: {} };
}

/** The ledger as read-only data; empty when the character never trained. */
export function trainedOf(sheet: TrainedSheet): TrainedSkills {
  return sheet.trained ?? { skills: [], ranks: {} };
}

/** Allocated-node ids that were bought with gold, for the save's connectivity/conservation seams. */
export function trainedNodeIds(sheet: TrainedSheet): string[] {
  const classId = sheetClassId(sheet);
  return classId ? trainedOf(sheet).skills.map(id => `wow-${classId}-${id}`) : [];
}

/** Gold-bought rank count for one skill (0 when never trained). */
export function trainedRankCount(sheet: TrainedSheet, skillId: SkillId): number {
  return trainedOf(sheet).ranks[skillId] ?? 0;
}

/** Save validation for `character.trained`; wired into validSheet by the integrator.
 * Skills must be class-kit members; rank counts stay inside the purchasable range. */
export function validTrainerLedger(v: unknown, classId: WowClassId): boolean {
  if (v === undefined) return true;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const ledger = v as TrainedSkills;
  if (!Array.isArray(ledger.skills) || ledger.skills.some(id => typeof id !== 'string' || trainerSkillClass(id as SkillId) !== classId)
    || new Set(ledger.skills).size !== ledger.skills.length) return false;
  if (!ledger.ranks || typeof ledger.ranks !== 'object' || Array.isArray(ledger.ranks)) return false;
  return Object.entries(ledger.ranks).every(([id, count]) =>
    trainerSkillClass(id as SkillId) === classId && Number.isInteger(count) && (count as number) >= 1 && (count as number) < SKILL_RANK_RULES.maximum);
}

/** The learnable row for a skill this player could train; undefined when the
 * skill is not in the player's class kit. */
function learnableFor(sheet: CharacterSheet, skillId: SkillId): TrainerLearnable | undefined {
  const classId = sheetClassId(sheet);
  return classId ? trainerLearnable(classId, skillId) : undefined;
}

/** Why the player cannot learn `skillId` at the trainer; null means purchasable. */
export function canLearnSkill(player: { level: number; character: CharacterSheet }, skillId: SkillId): string | null {
  const sheet = player.character;
  if (!SKILL_DEFINITIONS[skillId]) return 'Unknown skill.';
  const entry = learnableFor(sheet, skillId);
  if (!entry) return 'Your class cannot learn that.';
  if (knowsSkill(sheet, skillId)) return 'Already learned.';
  if (player.level < entry.requiredLevel) return `Requires level ${entry.requiredLevel}.`;
  if (!canAfford(sheet, entry.cost)) return 'Not enough gold.';
  return null;
}

/** Why the player cannot buy the next rank of `skillId`; null means purchasable. */
export function canUpgradeRank(player: { level: number; character: CharacterSheet }, skillId: SkillId): string | null {
  const sheet = player.character;
  const entry = learnableFor(sheet, skillId);
  if (!entry) return 'Your class cannot train that.';
  const rank = learnedSkillRank(sheet, skillId);
  if (!rank) return 'Learn this skill first.';
  if (rank >= maximumSkillRank(sheet, skillId)) return 'Already at max rank.';
  const requiredLevel = trainerRankLevel(entry.requiredLevel, rank + 1);
  if (player.level < requiredLevel) return `Requires level ${requiredLevel}.`;
  if (!canAfford(sheet, rankPrice(sheet, skillId) ?? 0)) return 'Not enough gold.';
  return null;
}

/** Copper price to learn `skillId` for its owning class; null when untrainable. */
export function learnPrice(skillId: SkillId): number | null {
  const classId = trainerSkillClass(skillId);
  return classId ? trainerLearnable(classId, skillId)!.cost : null;
}

/** Copper price for the player's next rank of `skillId`; null when untrainable or maxed. */
export function rankPrice(sheet: CharacterSheet, skillId: SkillId): number | null {
  const classId = sheetClassId(sheet);
  const entry = classId ? trainerLearnable(classId, skillId) : undefined;
  const rank = learnedSkillRank(sheet, skillId);
  if (!entry || !rank || rank >= maximumSkillRank(sheet, skillId)) return null;
  return trainerRankCost(entry.cost, rank + 1);
}
