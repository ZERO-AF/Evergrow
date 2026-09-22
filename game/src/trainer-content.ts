/** Class trainer stock (WotLK): every class skill in WOW_CLASS_SKILLS is sold
 * for gold at a level gate, and already-known class skills take gold-bought
 * rank upgrades. Content is derived, not authored twice: requiredLevel spreads
 * each kit across the 1-80 curve in authored order with a tier floor, and
 * learnCost follows the WotLK curve (cheap early, costly capstone).
 *
 * A trained skill is granted through the real unlock mechanism — its class
 * sanctum node (`wow-<classId>-<skillId>`) enters `allocatedNodes`, so
 * knowsSkill/unlockedSkills/skillSlots keep working — and the purchase is
 * recorded on the sheet's `trained` ledger (trainer-state.ts) so the save's
 * point-conservation ledger stays balanced (character-save.ts seam). */
import { SKILL_RANK_RULES, knowsSkill, learnedSkillRank } from './skill-progression.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { WOW_CLASS_SKILLS } from './wow-skills.ts';
import { WOW_CLASS_IDS, type WowClassId } from './wow-types.ts';
import { MAX_PLAYER_LEVEL } from './progression-content.ts';
import { canAfford } from './wallet.ts';
import type { CharacterSheet, SkillId } from './character-types.ts';
import type { WowSkill } from './skill-execution-content.ts';

/** One purchasable class skill: the kit entry plus its trainer level gate and learn price (copper). */
export interface TrainerLearnable {
  readonly skillId: SkillId;
  readonly name: string;
  readonly tier: WowSkill['tier'];
  readonly requiredLevel: number;
  readonly cost: number;
}

/** A stock row shown at the trainer: either a new skill to learn or the next rank of a known one. */
export interface TrainerStockEntry {
  readonly skillId: SkillId;
  readonly name: string;
  readonly kind: 'learn' | 'rank';
  readonly tier: WowSkill['tier'];
  /** Level required for this purchase (rank rows gate on the target rank). */
  readonly requiredLevel: number;
  /** Copper price. */
  readonly cost: number;
  /** Rank this row trains to; 1 for learn rows. */
  readonly rank: number;
  /** True when the row cannot be bought right now; `reason` says why. */
  readonly locked: boolean;
  readonly reason: string | null;
}

/** WotLK trainer pacing: basics from level 1, advanced from 20, ultimates from 40. */
const TIER_FLOOR: Readonly<Record<WowSkill['tier'], number>> = Object.freeze({ basic: 1, advanced: 20, ultimate: 40, aura: 1 });
/** Capstone pricing: ultimates cost roughly double a basic at the same level. */
const TIER_PRICE: Readonly<Record<WowSkill['tier'], number>> = Object.freeze({ basic: 1, advanced: 1.35, ultimate: 2, aura: 1 });
/** Rank rows ask for a few more levels each step, capped at the WotLK level cap. */
const RANK_LEVEL_STEP = 4;

/** Level a class skill becomes trainable: authored kit order spread over 1-80, floored by tier. */
export function trainerLearnLevel(skill: WowSkill, index: number, kitSize: number): number {
  const spread = 1 + Math.round(index * (MAX_PLAYER_LEVEL - 2) / Math.max(1, kitSize - 1));
  return Math.min(MAX_PLAYER_LEVEL, Math.max(TIER_FLOOR[skill.tier] ?? 1, spread));
}

/** Copper price to learn a class skill at `level`: WotLK curve — trivial early, ~30g capstones. */
export function trainerLearnCost(level: number, tier: WowSkill['tier']): number {
  const price = 10 * Math.pow(Math.max(1, level), 2.1) * (TIER_PRICE[tier] ?? 1);
  return Math.max(1, Math.round(price / 5) * 5);
}

/** Copper price for the next rank of a known skill: a growing share of its learn price. */
export function trainerRankCost(learnCost: number, targetRank: number): number {
  return Math.max(1, Math.round(learnCost * (0.35 + 0.25 * targetRank) / 5) * 5);
}

/** Level required to buy `targetRank` of a skill whose learn gate is `learnLevel`. */
export function trainerRankLevel(learnLevel: number, targetRank: number): number {
  return Math.min(MAX_PLAYER_LEVEL, learnLevel + RANK_LEVEL_STEP * (targetRank - 1));
}

/** Frozen per-class trainer catalogs: every kit skill with its gate and price, in authored order. */
export const TRAINER_CATALOG: Readonly<Record<WowClassId, readonly TrainerLearnable[]>> = Object.freeze(
  Object.fromEntries(WOW_CLASS_IDS.map(classId => [classId, Object.freeze(WOW_CLASS_SKILLS[classId].map((skill, index, kit) => {
    const requiredLevel = trainerLearnLevel(skill, index, kit.length);
    return Object.freeze({ skillId: skill.id as SkillId, name: skill.name, tier: skill.tier,
      requiredLevel, cost: trainerLearnCost(requiredLevel, skill.tier) });
  }))])) as Record<WowClassId, readonly TrainerLearnable[]>,
);

/** The trainer's learnable for a class skill id; undefined for non-class or foreign-class skills. */
export function trainerLearnable(classId: WowClassId, skillId: SkillId): TrainerLearnable | undefined {
  return TRAINER_CATALOG[classId]?.find(entry => entry.skillId === skillId);
}

/** The class a skill belongs to, when it is a trainable class skill. */
export function trainerSkillClass(skillId: SkillId): WowClassId | undefined {
  const classId = SKILL_DEFINITIONS[skillId]?.classId;
  return classId && TRAINER_CATALOG[classId]?.some(entry => entry.skillId === skillId) ? classId : undefined;
}

/** What the trainer sells this player: learn rows for unknown class skills, rank rows for known
 * ones (rank 20 shows as a locked max-rank row). `sheet` may be omitted for a level-only preview —
 * every entry then reads as a learn row gated purely on level. */
export function trainerStock(classId: WowClassId, level: number, sheet?: CharacterSheet): readonly TrainerStockEntry[] {
  const kit = TRAINER_CATALOG[classId] ?? [];
  return kit.map(entry => {
    const known = sheet ? knowsSkill(sheet, entry.skillId) : false;
    if (!known) {
      const reason = level < entry.requiredLevel ? `Requires level ${entry.requiredLevel}`
        : sheet && !canAfford(sheet, entry.cost) ? 'Not enough gold' : null;
      return { skillId: entry.skillId, name: entry.name, kind: 'learn' as const, tier: entry.tier,
        requiredLevel: entry.requiredLevel, cost: entry.cost, rank: 1, locked: reason !== null, reason };
    }
    const learned = learnedSkillRank(sheet!, entry.skillId);
    if (learned >= SKILL_RANK_RULES.maximum)
      return { skillId: entry.skillId, name: entry.name, kind: 'rank' as const, tier: entry.tier,
        requiredLevel: MAX_PLAYER_LEVEL, cost: 0, rank: learned, locked: true, reason: 'Max rank' };
    const targetRank = learned + 1;
    const requiredLevel = trainerRankLevel(entry.requiredLevel, targetRank);
    const cost = trainerRankCost(entry.cost, targetRank);
    const reason = level < requiredLevel ? `Requires level ${requiredLevel}`
      : !canAfford(sheet!, cost) ? 'Not enough gold' : null;
    return { skillId: entry.skillId, name: entry.name, kind: 'rank' as const, tier: entry.tier,
      requiredLevel, cost, rank: targetRank, locked: reason !== null, reason };
  });
}
