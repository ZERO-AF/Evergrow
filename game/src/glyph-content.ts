import type { Item, SkillId, StatModifiers } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { randomSource } from './items.ts';
import type { WowClassId } from './wow-types.ts';

/** Glyph definitions (docs/wow-deepening.md §14). Real WotLK glyph names/effects. */
export type GlyphSlot = 'major1' | 'major2' | 'major3' | 'minor1' | 'minor2' | 'minor3';
export type GlyphId = string;

/** Multiplicative/additive patches a major glyph applies to its skill's resolved cast
 * configuration. Every field is optional; absent fields leave the skill untouched.
 * Numbers mirror the real WotLK glyph where the engine exposes the same mechanic. */
export interface GlyphSkillEffect {
  /** Mana/resource cost multiplier (Glyph of Wrath 0.8, Glyph of Crusader Strike 0.8). */
  readonly mana?: number;
  /** Cooldown multiplier (Glyph of Death Grip 0.6, Glyph of Consecration 1.333). */
  readonly cooldown?: number;
  /** Damage multiplier (Glyph of Eviscerate 1.1, Glyph of Frostbolt 1.05). */
  readonly damage?: number;
  /** Targeting range multiplier (Glyph of Mind Flay 1.25). */
  readonly range?: number;
  /** Cast time multiplier (Glyph of Healing Touch 0.5). */
  readonly castTime?: number;
  /** Area radius multiplier (Glyph of Thunder Clap 1.25). */
  readonly radius?: number;
  /** Duration multiplier: dots, hots, CC, stealth, ground effects (Glyph of Rupture 1.5). */
  readonly duration?: number;
  /** Direct heal amount multiplier (Glyph of Healing Touch 0.75). */
  readonly heal?: number;
  /** Absorb pool multiplier (Glyph of Power Word: Shield 1.2). */
  readonly absorb?: number;
  /** Damage-over-time rate multiplier (Glyph of Immolate 1.1). */
  readonly dotDps?: number;
  /** Damage-over-time duration multiplier (Glyph of Serpent Sting 1.4). */
  readonly dotDuration?: number;
  /** Heal-over-time per-tick multiplier (Glyph of Renew 1.25). */
  readonly hotTick?: number;
  /** Heal-over-time duration multiplier (Glyph of Renew 0.75). */
  readonly hotDuration?: number;
  /** Self/ally buff duration multiplier (Glyph of Battle 2). */
  readonly buffDuration?: number;
  /** Stats merged into the granted buff (Glyph of Sprint +30% move speed). */
  readonly buffStats?: StatModifiers;
  /** Extra chain jumps (Glyph of Chain Lightning +1). */
  readonly extraJumps?: number;
  /** Extra CC targets. */
  readonly extraTargets?: number;
  /** Extra projectile pierce. */
  readonly extraPierce?: number;
  /** Self-heal on cast as a fraction of max life (Glyph of Divine Storm 0.1). */
  readonly healOnCast?: number;
}
export interface GlyphDef {
  readonly id: GlyphId;
  readonly name: string;
  readonly slot: 'major' | 'minor';
  /** Skill id this glyph modifies (major) or 'none' for cosmetic/convenience. */
  readonly skill?: string;
  /** Stat modifiers applied while socketed. */
  readonly stats?: Readonly<Record<string, number>>;
  /** Resolved-skill patch applied while socketed (major glyphs). */
  readonly effect?: GlyphSkillEffect;
  readonly description: string;
  /** Level at which the slot unlocks. */
  readonly unlockLevel: number;
}
const glyph = (id: GlyphId, name: string, slot: 'major' | 'minor', unlockLevel: number, description: string, skill?: string, effect?: GlyphSkillEffect): GlyphDef =>
  Object.freeze({ id, name, slot, unlockLevel, description, ...(skill ? { skill } : {}), ...(effect ? { effect } : {}) });

/** Real WotLK glyphs (wowhead.com/wotlk), mapped onto the skills this engine ships.
 * Where WotLK used a mechanic we do not model (crit-per-skill, reagents), the effect
 * is mapped to the closest honest number and the description says what it does here. */
export const GLYPHS: readonly GlyphDef[] = Object.freeze([
  // ── Major glyphs: modify a skill's numbers/behavior ──
  glyph('glyph-of-heroic-strike', 'Glyph of Heroic Strike', 'major', 15,
    'Your Heroic Strike deals 10% more damage.', 'heroicStrike', { damage: 1.1 }),
  glyph('glyph-of-thunder-clap', 'Glyph of Thunder Clap', 'major', 15,
    'Increases the radius of your Thunder Clap by 25%.', 'thunderClap', { radius: 1.25 }),
  glyph('glyph-of-crusader-strike', 'Glyph of Crusader Strike', 'major', 15,
    'Reduces the mana cost of your Crusader Strike by 20%.', 'crusaderStrike', { mana: 0.8 }),
  glyph('glyph-of-consecration', 'Glyph of Consecration', 'major', 30,
    'Increases the duration and cooldown of Consecration by 33%.', 'consecration', { duration: 4 / 3, cooldown: 4 / 3 }),
  glyph('glyph-of-divine-storm', 'Glyph of Divine Storm', 'major', 50,
    'Your Divine Storm now heals you for 10% of your maximum health.', 'divineStorm', { healOnCast: 0.1 }),
  glyph('glyph-of-serpent-sting', 'Glyph of Serpent Sting', 'major', 15,
    'Increases the duration of your Serpent Sting by 40%.', 'serpentSting', { dotDuration: 1.4 }),
  glyph('glyph-of-eviscerate', 'Glyph of Eviscerate', 'major', 15,
    'Your Eviscerate deals 10% more damage.', 'eviscerate', { damage: 1.1 }),
  glyph('glyph-of-power-word-shield', 'Glyph of Power Word: Shield', 'major', 15,
    'Your Power Word: Shield absorbs 20% more damage.', 'powerWordShield', { absorb: 1.2 }),
  glyph('glyph-of-death-grip', 'Glyph of Death Grip', 'major', 30,
    'Reduces the cooldown of Death Grip by 40%.', 'deathGrip', { cooldown: 0.6 }),
  glyph('glyph-of-chain-lightning', 'Glyph of Chain Lightning', 'major', 30,
    'Your Chain Lightning strikes 1 additional target.', 'chainLightning', { extraJumps: 1 }),
  glyph('glyph-of-frostbolt', 'Glyph of Frostbolt', 'major', 15,
    'Increases the damage dealt by Frostbolt by 5%.', 'frostbolt', { damage: 1.05 }),
  glyph('glyph-of-corruption', 'Glyph of Corruption', 'major', 15,
    'Your Corruption deals 10% more periodic damage.', 'corruption', { dotDps: 1.1 }),
  glyph('glyph-of-immolate', 'Glyph of Immolate', 'major', 30,
    'Increases the periodic damage of your Immolate by 10%.', 'immolate', { dotDps: 1.1 }),
  glyph('glyph-of-wrath', 'Glyph of Wrath', 'major', 15,
    'Reduces the mana cost of your Wrath spell by 20%.', 'wrath', { mana: 0.8 }),
  glyph('glyph-of-healing-touch', 'Glyph of Healing Touch', 'major', 30,
    'Decreases the cast time of Healing Touch by 50%, the healing done by 25% and the mana cost by 25%.', 'healingTouch', { castTime: 0.5, heal: 0.75, mana: 0.75 }),
  // ── Minor glyphs: cosmetic/convenience ──
  glyph('glyph-of-battle', 'Glyph of Battle', 'minor', 15,
    'Doubles the duration of your Battle Shout.', 'battleShout', { buffDuration: 2 }),
  glyph('glyph-of-feign-death', 'Glyph of Feign Death', 'minor', 15,
    'Reduces the cooldown of your Feign Death by 5 seconds.', 'feignDeath', { cooldown: 0.83 }),
  glyph('glyph-of-sprint', 'Glyph of Sprint', 'minor', 15,
    'Your Sprint moves you an additional 30% faster.', 'sprint', { buffStats: { moveSpeedPercent: 30 } }),
  glyph('glyph-of-vanish', 'Glyph of Vanish', 'minor', 30,
    'Increases the duration of your Vanish by 2 seconds.', 'vanish', { duration: 1.2 }),
  glyph('glyph-of-ghost-wolf', 'Glyph of Ghost Wolf', 'minor', 15,
    'Your Ghost Wolf form grants an additional 5% movement speed.', 'ghostWolf', { buffStats: { moveSpeedPercent: 5 } }),
  glyph('glyph-of-the-penguin', 'Glyph of the Penguin', 'minor', 15,
    'Your Polymorph turns the target into a penguin instead of a sheep.', 'polymorph'),
  glyph('glyph-of-raise-dead', 'Glyph of Raise Dead', 'minor', 30,
    'Your Raise Dead spell no longer requires a reagent.', 'raiseDead'),
  glyph('glyph-of-the-cheetah', 'Glyph of the Cheetah', 'minor', 15,
    'Your Travel Form appears as a cheetah.', 'travelForm'),
]);
export const GLYPH_SLOTS: readonly GlyphSlot[] = Object.freeze(['major1', 'major2', 'major3', 'minor1', 'minor2', 'minor3']);
export const GLYPH_SLOT_LEVEL: Readonly<Record<GlyphSlot, number>> = Object.freeze({ major1: 15, major2: 30, major3: 50, minor1: 15, minor2: 30, minor3: 50 });
export function isGlyphId(v: unknown): v is GlyphId { return typeof v === 'string' && GLYPHS.some(g => g.id === v); }
export const glyphDefinition = (id: GlyphId | undefined): GlyphDef | undefined => GLYPHS.find(g => g.id === id);
export const glyphSlotKind = (slot: GlyphSlot): 'major' | 'minor' => slot.startsWith('major') ? 'major' : 'minor';

// ── Glyph items ──
// ItemKind is frozen, so a glyph item rides the 'amulet' kind with a starter recipe:
// that is the only shape that passes validItem with zero affixes/implicit and survives
// deriveItem unchanged (starter skips implicit derivation; all recipe versions are 1).
// The glyph id is encoded in the item id as `glyph:<glyphId>:<seed36>`.
export const GLYPH_ITEM_PREFIX = 'glyph:';
export function glyphItemId(item: Item | null | undefined): GlyphId | null {
  const id = item?.id;
  if (!id?.startsWith(GLYPH_ITEM_PREFIX)) return null;
  const glyphId = id.slice(GLYPH_ITEM_PREFIX.length, id.lastIndexOf(':'));
  return isGlyphId(glyphId) ? glyphId : null;
}
export function isGlyphItem(item: Item | null | undefined): boolean { return glyphItemId(item) !== null; }

/** Deterministic glyph item for drops, vendor stock and unsocket returns. */
export function createGlyphItem(glyphId: GlyphId, seed: number): Item {
  const def = glyphDefinition(glyphId);
  if (!def) throw new RangeError(`Unknown glyph: ${glyphId}`);
  const s = (seed >>> 0).toString(36);
  const major = def.slot === 'major';
  return {
    id: `${GLYPH_ITEM_PREFIX}${def.id}:${s}`, seed: seed >>> 0,
    name: def.name, baseName: def.name, kind: 'amulet', tier: 'common',
    // itemLevel = unlockLevel + 2 so deriveItem's requiredLevel = itemLevel - 2 lands on unlockLevel.
    itemLevel: def.unlockLevel + 2, requiredLevel: def.unlockLevel, power: 1,
    implicit: {}, affixes: [],
    recipe: { manaVersion: 1, offenseVersion: 1, rollVersion: 1, starter: true, enhancement: 0, revision: 0, targetedRolls: 0, fullRolls: 0, rolls: [] },
    flavor: `${def.description} ${major ? 'Major' : 'Minor'} glyph — open the glyph panel to inscribe it.`,
    appearance: major
      ? { base: '#8a6d3b', shadow: '#2e2416', edge: '#e8c56a', trim: '#f4e2a0', style: 'leather' }
      : { base: '#5d6b7a', shadow: '#20262e', edge: '#a8bdd4', trim: '#d4e2f4', style: 'leather' },
  };
}

/** Enemy drop table: class-appropriate majors are common, minors rarer. */
export const GLYPH_DROP = Object.freeze({ chance: 0.04, minorWeight: 0.3 });
/** Owning class of a glyph, derived from its skill's classId (undefined = universal). */
export function glyphClassId(def: GlyphDef): WowClassId | undefined {
  return def.skill ? SKILL_DEFINITIONS[def.skill as SkillId]?.classId : undefined;
}
/** Glyph ids a class can meaningfully use (its own skill glyphs plus cosmetic minors). */
export function glyphsForClass(classId: WowClassId | undefined): readonly GlyphDef[] {
  if (!classId) return GLYPHS;
  return GLYPHS.filter(g => !g.skill || glyphClassId(g) === classId || glyphClassId(g) === undefined);
}

/** Deterministic enemy-drop roll: ~4% of kills yield a class-usable glyph item.
 * The integrator calls this from the loot path (combat-rewards/rollEnemyLoot site). */
export function rollGlyphDrop(seed: number, classId: WowClassId | undefined): Item | null {
  const random = randomSource(seed >>> 0);
  if (random() >= GLYPH_DROP.chance) return null;
  const pool = glyphsForClass(classId);
  if (!pool.length) return null;
  // Integer weights: majors 7, minors 3 (≈ GLYPH_DROP.minorWeight share of the pool).
  const weighted = pool.flatMap(def => Array(def.slot === 'minor' ? 3 : 7).fill(def));
  const def = weighted[Math.floor(random() * weighted.length)] ?? pool[0];
  return createGlyphItem(def.id, seed ^ 0x47a9c1);
}
