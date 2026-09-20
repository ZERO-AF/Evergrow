import { GAME_FEATURES } from './game-features.ts';
import { GLYPHS, GLYPH_SLOTS, GLYPH_SLOT_LEVEL, glyphClassId, glyphDefinition, glyphSlotKind, type GlyphDef, type GlyphSkillEffect, type GlyphSlot } from './glyph-content.ts';
import { resolveSkill } from './skill-progression.ts';
import type { CharacterSheet, SkillId, StatModifiers } from './character-types.ts';
import type { Player } from './model.ts';

/** Socketed glyphs whose slot is unlocked at the player's level, in slot order. */
export function socketedGlyphs(player: Pick<Player, 'glyphs' | 'level'>): GlyphDef[] {
  if (!GAME_FEATURES.glyphs || !player.glyphs) return [];
  return GLYPH_SLOTS.flatMap(slot => {
    const id = player.glyphs![slot];
    const def = id ? glyphDefinition(id) : undefined;
    return def && player.level >= GLYPH_SLOT_LEVEL[slot] ? [def] : [];
  });
}

/** Passive StatModifiers contributed by socketed glyphs (GlyphDef.stats).
 * Wired into characterModifierSources by the integrator; no shipped glyph uses it yet. */
export function glyphStats(player: Pick<Player, 'glyphs' | 'level'>): StatModifiers {
  const modifiers: StatModifiers = {};
  for (const def of socketedGlyphs(player)) {
    for (const [key, value] of Object.entries(def.stats ?? {})) {
      modifiers[key as keyof StatModifiers] = (modifiers[key as keyof StatModifiers] ?? 0) + value!;
    }
  }
  return modifiers;
}

/** The merged skill effect of the socketed glyph targeting this skill, if any. */
export function glyphSkillEffect(player: Pick<Player, 'glyphs' | 'level'>, skill: SkillId): GlyphSkillEffect | undefined {
  return socketedGlyphs(player).find(def => def.skill === skill && def.effect)?.effect;
}

/** Structural view of resolveSkill's result — only the fields glyphs can touch. */
export interface GlyphSkillResolution {
  mana: number;
  cooldown: number;
  damageMultiplier: number;
  range?: number;
  castTime?: number;
  recipe: object;
}

const scale = (value: unknown, factor: number | undefined): unknown =>
  typeof value === 'number' && factor !== undefined ? value * factor : value;
const bump = (value: unknown, extra: number | undefined): unknown =>
  typeof value === 'number' && extra ? value + extra : value;
const mergeStats = (base: unknown, extra: GlyphSkillEffect['buffStats']): unknown => {
  if (!extra) return base;
  const out: Record<string, number> = { ...(base as Record<string, number> | undefined) };
  for (const [key, value] of Object.entries(extra)) out[key] = (out[key] ?? 0) + value!;
  return out;
};

/** Clone a resolved recipe and apply one glyph effect. Nested spec objects are
 * shallow-cloned before mutation so the frozen SKILL_EXECUTION bases stay intact. */
function patchRecipe(recipe: GlyphSkillResolution['recipe'], e: GlyphSkillEffect): GlyphSkillResolution['recipe'] {
  const r: Record<string, unknown> = { ...recipe };
  r.radius = scale(r.radius, e.radius);
  r.reachMultiplier = scale(r.reachMultiplier, e.radius);
  r.minRange = scale(r.minRange, e.radius);
  r.range = scale(r.range, e.radius);
  r.duration = scale(r.duration, e.duration);
  r.stun = scale(r.stun, e.duration);
  r.silence = scale(r.silence, e.duration);
  r.amount = scale(r.amount, e.heal);
  r.maxHpFrac = scale(r.maxHpFrac, e.heal);
  r.healFrac = scale(r.healFrac, e.heal);
  r.jumps = bump(r.jumps, e.extraJumps);
  r.maxTargets = bump(r.maxTargets, e.extraTargets);
  r.targets = bump(r.targets, e.extraTargets);
  if (typeof r.heal === 'number' || e.healOnCast) r.heal = (typeof r.heal === 'number' ? r.heal * (e.heal ?? 1) : 0) + (e.healOnCast ?? 0);
  if (r.dot && typeof r.dot === 'object') r.dot = { ...(r.dot as Record<string, unknown>),
    dpsMultiplier: scale((r.dot as Record<string, unknown>).dpsMultiplier, e.dotDps),
    flatDps: scale((r.dot as Record<string, unknown>).flatDps, e.dotDps),
    duration: scale((r.dot as Record<string, unknown>).duration, e.dotDuration) };
  if (r.hot && typeof r.hot === 'object') r.hot = { ...(r.hot as Record<string, unknown>),
    perTick: scale((r.hot as Record<string, unknown>).perTick, e.hotTick),
    flatTick: scale((r.hot as Record<string, unknown>).flatTick, e.hotTick),
    duration: scale((r.hot as Record<string, unknown>).duration, e.hotDuration) };
  if (r.buff && typeof r.buff === 'object') r.buff = { ...(r.buff as Record<string, unknown>),
    duration: scale((r.buff as Record<string, unknown>).duration, e.buffDuration),
    absorb: scale((r.buff as Record<string, unknown>).absorb, e.absorb),
    stats: mergeStats((r.buff as Record<string, unknown>).stats, e.buffStats) };
  if (r.buffPerCombo && typeof r.buffPerCombo === 'object') r.buffPerCombo = { ...(r.buffPerCombo as Record<string, unknown>),
    duration: scale((r.buffPerCombo as Record<string, unknown>).duration, e.buffDuration),
    stats: mergeStats((r.buffPerCombo as Record<string, unknown>).stats, e.buffStats) };
  if (r.cc && typeof r.cc === 'object' && typeof (r.cc as Record<string, unknown>).kind === 'string')
    r.cc = { ...(r.cc as Record<string, unknown>), duration: scale((r.cc as Record<string, unknown>).duration, e.duration) };
  if (r.effects && typeof r.effects === 'object') r.effects = { ...(r.effects as Record<string, unknown>),
    pierce: bump((r.effects as Record<string, unknown>).pierce, e.extraPierce) };
  if (r.slow && typeof r.slow === 'object') r.slow = { ...(r.slow as Record<string, unknown>),
    duration: scale((r.slow as Record<string, unknown>).duration, e.duration) };
  return r;
}

/** Apply the socketed glyph for `skill` to an already-resolved cast configuration.
 * Returns the input unchanged when no glyph targets the skill. */
export function applyGlyphSkillModifiers<T extends GlyphSkillResolution>(resolved: T, skill: SkillId, player: Pick<Player, 'glyphs' | 'level'>): T {
  const effect = glyphSkillEffect(player, skill);
  if (!effect) return resolved;
  return { ...resolved,
    mana: resolved.mana > 0 && effect.mana !== undefined ? Math.max(1, Math.round(resolved.mana * effect.mana * 10) / 10) : resolved.mana,
    cooldown: effect.cooldown !== undefined ? Math.max(0, resolved.cooldown * effect.cooldown) : resolved.cooldown,
    damageMultiplier: effect.damage !== undefined ? resolved.damageMultiplier * effect.damage : resolved.damageMultiplier,
    ...(resolved.range !== undefined && effect.range !== undefined ? { range: resolved.range * effect.range } : {}),
    ...(resolved.castTime !== undefined && effect.castTime !== undefined ? { castTime: resolved.castTime * effect.castTime } : {}),
    recipe: patchRecipe(resolved.recipe, effect) } as T;
}
/** resolveSkill plus socketed-glyph modification — the player-context replacement for
 * bare resolveSkill at gameplay call sites (combat activation, HUD costs, tooltips). */
export function resolvePlayerSkill(id: SkillId, player: Pick<Player, 'derived' | 'character' | 'glyphs' | 'level'>, rankOverride?: number) {
  return applyGlyphSkillModifiers(resolveSkill(id, player.derived, player.character, rankOverride), id, player);
}

/** First unlocked slot of the glyph's kind, preferring an empty one. */
export function glyphSocketTarget(player: Pick<Player, 'glyphs' | 'level'>, def: GlyphDef): GlyphSlot | null {
  const slots = GLYPH_SLOTS.filter(slot => glyphSlotKind(slot) === def.slot && player.level >= GLYPH_SLOT_LEVEL[slot]);
  return slots.find(slot => !player.glyphs?.[slot]) ?? slots[0] ?? null;
}

/** Validation for the socket command: why a glyph item cannot be inscribed. */
export function glyphSocketProblem(player: Pick<Player, 'glyphs' | 'level'> & { character: Pick<CharacterSheet, 'classId'> }, def: GlyphDef): string | null {
  if (player.level < def.unlockLevel) return `Requires level ${def.unlockLevel}.`;
  const owner = glyphClassId(def);
  if (owner && owner !== player.character.classId) return `${def.name} is for ${owner}s.`;
  if (!glyphSocketTarget(player, def)) return `No ${def.slot} glyph slot unlocked yet (levels 15 / 30 / 50).`;
  if (Object.values(player.glyphs ?? {}).includes(def.id)) return `${def.name} is already inscribed.`;
  return null;
}

/** All GLYPHS entries for the panel, grouped for display. */
export const majorGlyphs = (): readonly GlyphDef[] => GLYPHS.filter(g => g.slot === 'major');
export const minorGlyphs = (): readonly GlyphDef[] => GLYPHS.filter(g => g.slot === 'minor');
