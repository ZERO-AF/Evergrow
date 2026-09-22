import type { DamageType, Player, ProjectileStyle } from './model.ts';
import type { SkillId } from './character-types.ts';
import type { WowClassId } from './wow-types.ts';
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
 * Per-class visual signature layered over the school VFX (docs/wow-deepening.md
 * §4 lineage): `accent` tints glows and the rune ring, `hot`/`deep` shade the
 * class glyph, and `motif` picks the glyph silhouette drawn under the caster
 * and at the burst edge. Palettes are authored distinct so a mage frostbolt
 * reads differently from a death knight's frost.
 */
export type ClassMotif = 'blades' | 'sigil' | 'fang' | 'shroud' | 'halo'
  | 'rune' | 'totem' | 'star' | 'fel' | 'leaf';
export interface ClassStyle { readonly accent: string; readonly hot: string; readonly deep: string; readonly motif: ClassMotif; }

export const CLASS_STYLES: Readonly<Record<WowClassId, ClassStyle>> = Object.freeze({
  warrior:     { accent: '#d8483c', hot: '#ffd9c2', deep: '#5a1f1a', motif: 'blades' },
  paladin:     { accent: '#f0c14e', hot: '#fff3c8', deep: '#7a5a1e', motif: 'sigil' },
  hunter:      { accent: '#8fbf4a', hot: '#e4f2b8', deep: '#33481e', motif: 'fang' },
  rogue:       { accent: '#9aa4b4', hot: '#eef2f8', deep: '#23262e', motif: 'shroud' },
  priest:      { accent: '#d8c8f0', hot: '#ffffff', deep: '#5a4a80', motif: 'halo' },
  deathKnight: { accent: '#5fd4f0', hot: '#e2fbff', deep: '#173a4e', motif: 'rune' },
  shaman:      { accent: '#3f9df2', hot: '#d0e8ff', deep: '#16345e', motif: 'totem' },
  mage:        { accent: '#9d7bf0', hot: '#efe6ff', deep: '#35246a', motif: 'star' },
  warlock:     { accent: '#a06ad8', hot: '#eedcff', deep: '#3a1e4e', motif: 'fel' },
  druid:       { accent: '#3ec97e', hot: '#d8ffe4', deep: '#1e4a30', motif: 'leaf' },
});

/**
 * Resolves a caster's class signature. Null-safe: unknown or absent class ids
 * (shared/enemy skills, legacy sheets) return null so callers keep school art.
 */
export function classStyle(classId: WowClassId | string | null | undefined): ClassStyle | null {
  return CLASS_STYLES[classId as WowClassId] ?? null;
}

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

/**
 * Class-aware sibling of `castSchoolStyle`: resolves the school signature plus
 * the caster's class accent in one pass. `cls` is null for classless casts so
 * shared/enemy art stays untouched.
 */
export function castSignature(p: Player, skill: SkillId): { style: SchoolStyle; cls: ClassStyle | null } | null {
  const style = castSchoolStyle(p, skill);
  return style ? { style, cls: classStyle(p.character?.classId) } : null;
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
