import type { DamageType, Player, ProjectileStyle } from './model.ts';
import type { SkillId } from './character-types.ts';
import { resolveSkill } from './skill-progression.ts';
/**
 * Headless WoW school→style resolution. Maps a skill's execution recipe to its
 * elemental school signature so combat events, impacts and auras share one
 * source of truth. No DOM — safe for the headless core compiler boundary.
 * Drawing lives in spell-school-art.ts.
 */

/** Accepted style inputs: projectile styles, damage types, and DoT schools. */
export type SchoolStyle = ProjectileStyle | DamageType | 'bleed' | 'poison';
export type School = 'holy' | 'shadow' | 'fire' | 'frost' | 'lightning' | 'nature' | 'arcane' | 'physical';

/**
 * Resolves the school signature of a skill being cast: projectile recipes carry
 * `effects.style`, ground/chain/radial carry `style`, strike/channel/
 * comboStrike/runeStrike carry a WoW `school`, and pure DoTs fall back to their
 * dot school. Returns null when the skill has no school signature.
 */
export function castSchoolStyle(p: Player, skill: SkillId): SchoolStyle | null {
  const recipe = resolveSkill(skill, p.derived, p.character).recipe;
  if (recipe.kind === 'projectile') return recipe.effects.style;
  if ('style' in recipe && recipe.style) return recipe.style;
  if ('school' in recipe && recipe.school) return recipe.school;
  if (recipe.kind === 'dot') return recipe.dot.school;
  return null;
}

/** Maps any spell style payload to its school signature, or null = keep existing art. */
export function schoolOf(style: SchoolStyle): School | null {
  switch (style) {
    case 'holy': return 'holy';
    case 'shadow': return 'shadow';
    case 'fire': return 'fire';
    case 'frost': return 'frost';
    case 'lightning': return 'lightning';
    case 'nature': case 'poison': return 'nature';
    case 'arcane': return 'arcane';
    case 'physical': case 'bleed': return 'physical';
    default: return null; // arrow, spirit, radiant
  }
}

/** Narrows a school/style payload to a ProjectileStyle for event `style` fields. */
export function schoolProjectileStyle(school: SchoolStyle | null | undefined): ProjectileStyle | undefined {
  if (!school) return undefined;
  if (school === 'poison') return 'nature';
  if (school === 'bleed' || school === 'physical') return undefined;
  return school as ProjectileStyle;
}
