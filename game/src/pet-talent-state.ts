import type { StatModifiers } from './character-types.ts';
import type { PetRecord } from './pet-content.ts';
import { PET_FAMILY_TREE, PET_TALENTS, PET_TALENT_RULES, type PetTalent } from './pet-talent-content.ts';

/**
 * Pet talent state (WotLK): pure transitions on the PetRecord carrier.
 * Allocations live on `pet.talents` as talent id → rank; everything else —
 * points, gating, bonuses — derives from that map plus the frozen
 * PET_TALENTS table. No DOM, no simulation state, no RNG.
 */

/** Talent points a pet has earned: one per PET_TALENT_RULES.levelsPerPoint levels. */
export function petTalentPoints(pet: Pick<PetRecord, 'level'>): number {
  return Math.floor(Math.max(0, pet.level) / PET_TALENT_RULES.levelsPerPoint);
}

/** Points already committed to the tree. Unknown ids still count — a forged
 * record errs toward blocking further allocation, never toward free points. */
export function petTalentSpent(pet: Pick<PetRecord, 'talents'>): number {
  let spent = 0;
  for (const rank of Object.values(pet.talents ?? {})) spent += Math.max(0, Math.floor(rank));
  return spent;
}

/** Unspent points the pet can still allocate. */
export function petTalentPointsRemaining(pet: Pick<PetRecord, 'level' | 'talents'>): number {
  return Math.max(0, petTalentPoints(pet) - petTalentSpent(pet));
}

/** Why a rank cannot be allocated, or null when it can. */
export function petTalentProblem(pet: PetRecord, talentId: string): string | null {
  const talent = PET_TALENTS[talentId];
  if (!talent) return 'Unknown pet talent.';
  const tree = PET_FAMILY_TREE[pet.family];
  if (talent.tree !== tree) return `${talent.name} is a ${talent.tree} talent; ${pet.name} is a ${tree} pet.`;
  const rank = pet.talents?.[talentId] ?? 0;
  if (rank >= talent.maxRanks) return `${talent.name} is already at rank ${talent.maxRanks}.`;
  // Tier gating: tier N unlocks after (N-1) * tierStep points spent in earlier tiers.
  const needed = (talent.tier - 1) * PET_TALENT_RULES.tierStep;
  if (needed > 0) {
    let spent = 0;
    for (const [id, r] of Object.entries(pet.talents ?? {})) {
      const t = PET_TALENTS[id];
      if (t && t.tier < talent.tier) spent += Math.max(0, Math.floor(r));
    }
    if (spent < needed) return `${talent.name} requires ${needed} points spent in earlier tiers.`;
  }
  if (talent.requires && (pet.talents?.[talent.requires.id] ?? 0) < talent.requires.points) {
    const prereq = PET_TALENTS[talent.requires.id];
    return `${talent.name} requires ${prereq?.name ?? talent.requires.id} (rank ${talent.requires.points}).`;
  }
  if (petTalentPointsRemaining(pet) <= 0) return 'No unspent pet talent points.';
  return null;
}

/** Allocate one rank of `talentId`; returns the updated record or an error message. */
export function allocatePetTalent(pet: PetRecord, talentId: string): { ok: true; pet: PetRecord } | { ok: false; message: string } {
  const problem = petTalentProblem(pet, talentId);
  if (problem) return { ok: false, message: problem };
  const rank = (pet.talents?.[talentId] ?? 0) + 1;
  return { ok: true, pet: { ...pet, talents: { ...pet.talents, [talentId]: rank } } };
}

/** Refund every allocated rank; the talents field drops back to absent. */
export function resetPetTalents(pet: PetRecord): PetRecord {
  if (!pet.talents) return pet;
  const next = { ...pet };
  delete next.talents;
  return next;
}

export interface PetTalentBonuses {
  /** Stat lines aggregated across allocated ranks (per-rank values × rank). */
  readonly stats: StatModifiers;
  /** Named pet effects: effect id → total magnitude (perRank × rank, or rank count for binary grants). */
  readonly effects: Record<string, number>;
}

/** Aggregate every allocated talent into stats plus named effects. */
export function petTalentBonuses(pet: Pick<PetRecord, 'talents'>): PetTalentBonuses {
  const stats: StatModifiers = {};
  const effects: Record<string, number> = {};
  for (const [id, rank] of Object.entries(pet.talents ?? {})) {
    const talent: PetTalent | undefined = PET_TALENTS[id];
    const r = Math.max(0, Math.floor(rank));
    if (!talent || r <= 0) continue;
    for (const [key, value] of Object.entries(talent.bonus.stats ?? {}) as [keyof StatModifiers, number][])
      stats[key] = (stats[key] ?? 0) + value * r;
    const effect = talent.bonus.effect;
    if (effect) effects[effect.id] = (effects[effect.id] ?? 0) + (effect.perRank ?? 1) * r;
  }
  return { stats, effects };
}
