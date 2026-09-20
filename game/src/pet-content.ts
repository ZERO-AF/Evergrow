import type { EnemyKind } from './model.ts';
import type { AllyKind, BuffSpec, CcKind, DotSchool, DotSpec } from './wow-types.ts';
import type { WowSkillId } from './character-types.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { scaledEnemyStats } from './zone-progression.ts';
import { xpForNextLevel } from './progression.ts';
import { MAX_CONTENT_LEVEL, normalizeLevel } from './progression-content.ts';

/**
 * Hunter pets and warlock demons (docs/wow-transformation.md lineage).
 * Headless content only: pure tables and pure record helpers — no DOM, no
 * simulation state, no RNG. The simulation owns the live Ally actors; this
 * module owns the persistent pet record stored on the character sheet.
 *
 * Hunter pets keep the enemy kind they were tamed from: stats scale off
 * scaledEnemyStats(sourceKind, level, 'normal') with a per-family bias, and
 * experience follows the player curve at a reduced share. Warlock demons are
 * not tamed and hold no PetRecord — DEMON_FAMILIES maps each summon skill to
 * its ally template and signature abilities, and summonAlly already scales
 * demons off the caster.
 */

/** Beast families a hunter can tame; combat-content flags each tameable EnemyKind with one. */
export type PetFamily = 'wolf' | 'cat' | 'bear' | 'boar' | 'raptor'
  | 'spider' | 'bird' | 'windSerpent' | 'scorpid' | 'turtle';

/** Persistent warlock summons; each maps to a summon skill and an ally template. */
export type DemonKind = 'imp' | 'voidwalker' | 'felhunter' | 'felguard' | 'succubus';

/** One tamed beast on the character sheet. Level/xp follow the pet curve; loyalty is 0–100. */
export interface PetRecord {
  readonly id: number;
  /** Enemy kind the pet was tamed from; drives stat scaling. */
  readonly sourceKind: EnemyKind;
  /** Ally template used when the pet is summoned. */
  readonly allyKind: AllyKind;
  readonly family: PetFamily;
  name: string;
  level: number;
  /** XP inside the current level (same convention as the player sheet). */
  xp: number;
  /** Learned PetSkillId list, in learn order. */
  skills: string[];
  /** 0–100; feeding and kills raise it, death and neglect lower it. */
  loyalty: number;
}

/** The hunter's stable: one active companion plus up to PET_RULES.stableSlots stabled. */
export interface PetStable {
  active: PetRecord | null;
  stabled: PetRecord[];
}

export const PET_RULES = Object.freeze({
  /** Stabled pets a stable master will hold. */
  stableSlots: 4,
  /** Loyalty bounds and the value a freshly tamed beast starts at. */
  maxLoyalty: 100,
  freshLoyalty: 60,
  /** Pets gain levels off a share of the player's kill XP. */
  xpShare: 0.6,
  /** Loyalty lost when the pet falls in battle. */
  deathLoyaltyLoss: 10,
  /** Pet XP curve is the player curve at this fraction. */
  xpCurveFraction: 0.6,
});

/** What a pet ability does when the simulation fires it. Mirrors the player skill payload vocabulary. */
export type PetSkillEffect =
  | { readonly kind: 'strike'; readonly damageMultiplier: number; readonly school?: DotSchool;
      readonly arc?: number; readonly stun?: number; readonly sunder?: number;
      readonly slow?: { readonly duration: number; readonly factor: number } }
  | { readonly kind: 'dot'; readonly dot: DotSpec }
  | { readonly kind: 'taunt'; readonly duration: number }
  | { readonly kind: 'cc'; readonly cc: CcKind; readonly duration: number; readonly factor?: number }
  | { readonly kind: 'projectile'; readonly damageMultiplier: number; readonly school: DotSchool }
  | { readonly kind: 'guard'; readonly duration: number; readonly reduction: number }
  | { readonly kind: 'buff'; readonly target: 'pet' | 'player'; readonly buff: BuffSpec }
  | { readonly kind: 'stealth'; readonly duration: number };

export interface PetSkill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Seconds between uses. */
  readonly cooldown: number;
  /** Pet level at which the skill is learned. */
  readonly learnLevel: number;
  /** Preferred range; 0 = melee. */
  readonly range: number;
  readonly effect: PetSkillEffect;
}

export interface PetFamilyDef {
  readonly family: PetFamily;
  readonly name: string;
  /** Ally template summoned for this family. */
  readonly allyKind: AllyKind;
  /** PetSkillId list in learn order. */
  readonly skills: readonly string[];
  readonly color: string;
  /** Family flavor on top of the scaled enemy stats. */
  readonly statBias: { readonly hp: number; readonly damage: number };
}

export interface DemonFamilyDef {
  readonly demon: DemonKind;
  readonly name: string;
  readonly allyKind: AllyKind;
  /** WowSkillId that summons this demon. */
  readonly summonSkill: WowSkillId;
  /** Signature abilities, usable from the moment the demon is summoned. */
  readonly skills: readonly string[];
}

/** Pet and demon abilities share one registry; ids never collide with player SkillIds. */
export const PET_SKILLS: Readonly<Record<string, PetSkill>> = Object.freeze({
  // Shared beast skills
  growl: Object.freeze<PetSkill>({ id: 'growl', name: 'Growl', cooldown: 8, learnLevel: 1, range: 0,
    description: 'Taunt the target, forcing it to attack the pet.',
    effect: { kind: 'taunt', duration: 4 } }),
  bite: Object.freeze<PetSkill>({ id: 'bite', name: 'Bite', cooldown: 6, learnLevel: 1, range: 0,
    description: 'Bite the target for 125% weapon damage.',
    effect: { kind: 'strike', damageMultiplier: 1.25 } }),
  claw: Object.freeze<PetSkill>({ id: 'claw', name: 'Claw', cooldown: 5, learnLevel: 1, range: 0,
    description: 'Rake the target for 115% weapon damage.',
    effect: { kind: 'strike', damageMultiplier: 1.15 } }),
  dash: Object.freeze<PetSkill>({ id: 'dash', name: 'Dash', cooldown: 30, learnLevel: 10, range: 0,
    description: 'Increase the pet\'s movement speed by 60% for 10 seconds.',
    effect: { kind: 'buff', target: 'pet', buff: { duration: 10, stats: { moveSpeedPercent: 60 } } } }),
  // Family signatures
  furiousHowl: Object.freeze<PetSkill>({ id: 'furiousHowl', name: 'Furious Howl', cooldown: 40, learnLevel: 20, range: 0,
    description: 'The wolf\'s howl emboldens the hunter, increasing damage by 10% for 15 seconds.',
    effect: { kind: 'buff', target: 'player', buff: { duration: 15, stats: { damagePercent: 10 } } } }),
  prowl: Object.freeze<PetSkill>({ id: 'prowl', name: 'Prowl', cooldown: 20, learnLevel: 10, range: 0,
    description: 'The cat slips into stealth for 20 seconds.',
    effect: { kind: 'stealth', duration: 20 } }),
  swipe: Object.freeze<PetSkill>({ id: 'swipe', name: 'Swipe', cooldown: 6, learnLevel: 10, range: 0,
    description: 'A wide swipe that strikes nearby enemies for 100% weapon damage.',
    effect: { kind: 'strike', damageMultiplier: 1.0, arc: Math.PI * 1.2 } }),
  demoralizingRoar: Object.freeze<PetSkill>({ id: 'demoralizingRoar', name: 'Demoralizing Roar', cooldown: 20, learnLevel: 20, range: 0,
    description: 'The bear\'s roar exposes the target, increasing damage it takes by 10%.',
    effect: { kind: 'strike', damageMultiplier: 0.5, sunder: 0.1 } }),
  gore: Object.freeze<PetSkill>({ id: 'gore', name: 'Gore', cooldown: 8, learnLevel: 1, range: 0,
    description: 'Gore the target for 110% weapon damage and cause it to bleed.',
    effect: { kind: 'strike', damageMultiplier: 1.1, school: 'bleed' } }),
  charge: Object.freeze<PetSkill>({ id: 'charge', name: 'Charge', cooldown: 25, learnLevel: 10, range: 240,
    description: 'Charge the target, stunning it for 1.5 seconds.',
    effect: { kind: 'strike', damageMultiplier: 0.5, stun: 1.5 } }),
  rend: Object.freeze<PetSkill>({ id: 'rend', name: 'Rend', cooldown: 8, learnLevel: 10, range: 0,
    description: 'Tear the target for 100% weapon damage plus a bleeding wound.',
    effect: { kind: 'dot', dot: { school: 'bleed', dpsMultiplier: 0.15, duration: 9 } } }),
  web: Object.freeze<PetSkill>({ id: 'web', name: 'Web', cooldown: 30, learnLevel: 10, range: 220,
    description: 'Wrap the target in webs, rooting it for 4 seconds.',
    effect: { kind: 'cc', cc: 'root', duration: 4 } }),
  screech: Object.freeze<PetSkill>({ id: 'screech', name: 'Screech', cooldown: 15, learnLevel: 10, range: 0,
    description: 'A piercing screech that exposes nearby enemies, increasing damage they take by 8%.',
    effect: { kind: 'strike', damageMultiplier: 0.4, arc: Math.PI * 2, sunder: 0.08 } }),
  swoop: Object.freeze<PetSkill>({ id: 'swoop', name: 'Swoop', cooldown: 25, learnLevel: 20, range: 240,
    description: 'Swoop at the target, slowing it by 40% for 4 seconds.',
    effect: { kind: 'strike', damageMultiplier: 0.8, slow: { duration: 4, factor: 0.6 } } }),
  lightningBreath: Object.freeze<PetSkill>({ id: 'lightningBreath', name: 'Lightning Breath', cooldown: 8, learnLevel: 1, range: 260,
    description: 'Breathe lightning at the target for 120% weapon damage.',
    effect: { kind: 'projectile', damageMultiplier: 1.2, school: 'lightning' } }),
  scorpidPoison: Object.freeze<PetSkill>({ id: 'scorpidPoison', name: 'Scorpid Poison', cooldown: 6, learnLevel: 10, range: 0,
    description: 'Sting the target, poisoning it for damage over 10 seconds.',
    effect: { kind: 'dot', dot: { school: 'poison', dpsMultiplier: 0.18, duration: 10 } } }),
  shellShield: Object.freeze<PetSkill>({ id: 'shellShield', name: 'Shell Shield', cooldown: 60, learnLevel: 10, range: 0,
    description: 'The turtle withdraws into its shell, taking 50% less damage for 12 seconds.',
    effect: { kind: 'guard', duration: 12, reduction: 0.5 } }),
  firebolt: Object.freeze<PetSkill>({ id: 'firebolt', name: 'Firebolt', cooldown: 2, learnLevel: 1, range: 300,
    description: 'Hurl a bolt of fire at the target for 130% weapon damage.',
    effect: { kind: 'projectile', damageMultiplier: 1.3, school: 'fire' } }),
  bloodPact: Object.freeze<PetSkill>({ id: 'bloodPact', name: 'Blood Pact', cooldown: 60, learnLevel: 1, range: 0,
    description: 'The imp\'s pact lends the warlock demonic vigor (+4 Vitality) for 5 minutes.',
    effect: { kind: 'buff', target: 'player', buff: { duration: 300, exclusiveGroup: 'bloodPact', stats: { vitality: 4 } } } }),
  torment: Object.freeze<PetSkill>({ id: 'torment', name: 'Torment', cooldown: 8, learnLevel: 1, range: 0,
    description: 'The voidwalker torments the target, forcing it to attack the demon.',
    effect: { kind: 'taunt', duration: 5 } }),
  consumeShadows: Object.freeze<PetSkill>({ id: 'consumeShadows', name: 'Consume Shadows', cooldown: 45, learnLevel: 1, range: 0,
    description: 'The voidwalker consumes nearby shadows, regenerating 3% of its life per second for 10 seconds.',
    effect: { kind: 'buff', target: 'pet', buff: { duration: 10, healPerSecond: 0.03 } } }),
  shadowBite: Object.freeze<PetSkill>({ id: 'shadowBite', name: 'Shadow Bite', cooldown: 6, learnLevel: 1, range: 0,
    description: 'Bite the target with shadowy fangs for 140% weapon damage.',
    effect: { kind: 'strike', damageMultiplier: 1.4, school: 'shadow' } }),
  spellLock: Object.freeze<PetSkill>({ id: 'spellLock', name: 'Spell Lock', cooldown: 24, learnLevel: 1, range: 240,
    description: 'Silence the target for 3 seconds.',
    effect: { kind: 'cc', cc: 'silence', duration: 3 } }),
  felCleave: Object.freeze<PetSkill>({ id: 'felCleave', name: 'Cleave', cooldown: 6, learnLevel: 1, range: 0,
    description: 'A sweeping strike that hits enemies in front of the felguard for 120% weapon damage.',
    effect: { kind: 'strike', damageMultiplier: 1.2, arc: Math.PI * 1.4 } }),
  intercept: Object.freeze<PetSkill>({ id: 'intercept', name: 'Intercept', cooldown: 30, learnLevel: 1, range: 240,
    description: 'Charge the target, stunning it for 2 seconds.',
    effect: { kind: 'strike', damageMultiplier: 0.6, stun: 2 } }),
  lashOfPain: Object.freeze<PetSkill>({ id: 'lashOfPain', name: 'Lash of Pain', cooldown: 6, learnLevel: 1, range: 0,
    description: 'Lash the target for 130% weapon damage as shadow.',
    effect: { kind: 'strike', damageMultiplier: 1.3, school: 'shadow' } }),
  seduction: Object.freeze<PetSkill>({ id: 'seduction', name: 'Seduction', cooldown: 30, learnLevel: 1, range: 240,
    description: 'Mesmerize the target, incapacitating it for 6 seconds. Damage breaks the effect.',
    effect: { kind: 'cc', cc: 'incapacitate', duration: 6 } }),
});

/** Hunter pet families: ally template, learnable skills, tint and stat flavor. */
export const PET_FAMILIES: Readonly<Record<PetFamily, PetFamilyDef>> = Object.freeze({
  wolf: Object.freeze<PetFamilyDef>({ family: 'wolf', name: 'Wolf', allyKind: 'wolf', color: '#8a7a5a',
    skills: Object.freeze(['growl', 'bite', 'dash', 'furiousHowl']),
    statBias: Object.freeze({ hp: 1.0, damage: 1.1 }) }),
  cat: Object.freeze<PetFamilyDef>({ family: 'cat', name: 'Cat', allyKind: 'cat', color: '#a08a5a',
    skills: Object.freeze(['growl', 'claw', 'prowl', 'dash']),
    statBias: Object.freeze({ hp: 0.9, damage: 1.15 }) }),
  bear: Object.freeze<PetFamilyDef>({ family: 'bear', name: 'Bear', allyKind: 'bear', color: '#6a5a42',
    skills: Object.freeze(['growl', 'claw', 'swipe', 'demoralizingRoar']),
    statBias: Object.freeze({ hp: 1.25, damage: 0.9 }) }),
  boar: Object.freeze<PetFamilyDef>({ family: 'boar', name: 'Boar', allyKind: 'boar', color: '#7a6248',
    skills: Object.freeze(['growl', 'gore', 'charge']),
    statBias: Object.freeze({ hp: 1.15, damage: 0.95 }) }),
  raptor: Object.freeze<PetFamilyDef>({ family: 'raptor', name: 'Raptor', allyKind: 'raptor', color: '#5a7a4a',
    skills: Object.freeze(['growl', 'claw', 'rend', 'dash']),
    statBias: Object.freeze({ hp: 0.95, damage: 1.1 }) }),
  spider: Object.freeze<PetFamilyDef>({ family: 'spider', name: 'Spider', allyKind: 'spider', color: '#4a4a52',
    skills: Object.freeze(['growl', 'bite', 'web']),
    statBias: Object.freeze({ hp: 0.95, damage: 1.0 }) }),
  bird: Object.freeze<PetFamilyDef>({ family: 'bird', name: 'Carrion Bird', allyKind: 'bird', color: '#8a94a0',
    skills: Object.freeze(['growl', 'claw', 'screech', 'swoop']),
    statBias: Object.freeze({ hp: 0.9, damage: 1.0 }) }),
  windSerpent: Object.freeze<PetFamilyDef>({ family: 'windSerpent', name: 'Wind Serpent', allyKind: 'windSerpent', color: '#5aa08a',
    skills: Object.freeze(['growl', 'lightningBreath', 'swoop']),
    statBias: Object.freeze({ hp: 0.9, damage: 1.05 }) }),
  scorpid: Object.freeze<PetFamilyDef>({ family: 'scorpid', name: 'Scorpid', allyKind: 'scorpid', color: '#8a5a3a',
    skills: Object.freeze(['growl', 'claw', 'scorpidPoison']),
    statBias: Object.freeze({ hp: 1.05, damage: 0.95 }) }),
  turtle: Object.freeze<PetFamilyDef>({ family: 'turtle', name: 'Turtle', allyKind: 'turtle', color: '#4a7a5a',
    skills: Object.freeze(['growl', 'bite', 'shellShield']),
    statBias: Object.freeze({ hp: 1.3, damage: 0.8 }) }),
});

/** Warlock demons: persistent summons learned through the class skill kit, never tamed. */
export const DEMON_FAMILIES: Readonly<Record<DemonKind, DemonFamilyDef>> = Object.freeze({
  imp: Object.freeze<DemonFamilyDef>({ demon: 'imp', name: 'Imp', allyKind: 'imp', summonSkill: 'summonImp',
    skills: Object.freeze(['firebolt', 'bloodPact']) }),
  voidwalker: Object.freeze<DemonFamilyDef>({ demon: 'voidwalker', name: 'Voidwalker', allyKind: 'voidwalker', summonSkill: 'summonVoidwalker',
    skills: Object.freeze(['torment', 'consumeShadows']) }),
  succubus: Object.freeze<DemonFamilyDef>({ demon: 'succubus', name: 'Succubus', allyKind: 'succubus', summonSkill: 'summonSuccubus',
    skills: Object.freeze(['lashOfPain', 'seduction']) }),
  felhunter: Object.freeze<DemonFamilyDef>({ demon: 'felhunter', name: 'Felhunter', allyKind: 'felhunter', summonSkill: 'summonFelhunter',
    skills: Object.freeze(['shadowBite', 'spellLock']) }),
  felguard: Object.freeze<DemonFamilyDef>({ demon: 'felguard', name: 'Felguard', allyKind: 'felguard', summonSkill: 'summonFelguard',
    skills: Object.freeze(['felCleave', 'intercept']) }),
});

/** Family a beast enemy kind can be tamed into; undefined for bosses, elites-by-flag and humanoids. */
export function tameableFamily(enemyKind: EnemyKind): PetFamily | undefined {
  return ENEMY_DEFINITIONS[enemyKind].beast;
}

/** Ally template behind a pet family. */
export function petFamilyForAlly(allyKind: AllyKind): PetFamily | undefined {
  for (const family of Object.values(PET_FAMILIES)) if (family.allyKind === allyKind) return family.family;
  return undefined;
}

/** Demon behind an ally template, or behind a summon skill id. */
export function demonFamilyForAlly(allyKind: AllyKind): DemonKind | undefined {
  for (const demon of Object.values(DEMON_FAMILIES)) if (demon.allyKind === allyKind) return demon.demon;
  return undefined;
}
export function demonFamilyForSkill(skill: string): DemonKind | undefined {
  for (const demon of Object.values(DEMON_FAMILIES)) if (demon.summonSkill === skill) return demon.demon;
  return undefined;
}

/** XP needed to leave `level`; the player curve at the pet fraction. */
export function petXpForLevel(level: number): number {
  return Math.max(1, Math.round(xpForNextLevel(level) * PET_RULES.xpCurveFraction));
}

/** Level reached by a total accumulated XP pool (distinct from PetRecord.xp, which is per-level). */
export function petLevelForXp(totalXp: number): number {
  let level = 1, remaining = Math.max(0, Math.floor(Number.isFinite(totalXp) ? totalXp : 0));
  while (level < MAX_CONTENT_LEVEL) {
    const threshold = petXpForLevel(level);
    if (remaining < threshold) break;
    remaining -= threshold;
    level++;
  }
  return level;
}

/** Combat stats for a pet record: the source beast scaled to pet level, biased by family. */
export function petStatsFor(record: Pick<PetRecord, 'sourceKind' | 'family' | 'level'>): { maxHp: number; damage: number } {
  const scaled = scaledEnemyStats(record.sourceKind, record.level, 'normal');
  const bias = PET_FAMILIES[record.family].statBias;
  return { maxHp: Math.max(1, Math.round(scaled.maxHp * bias.hp)),
    damage: Math.max(1, Math.round(scaled.damage * bias.damage)) };
}

/** Skills a family knows at a level, in learn order. */
export function petSkillsLearned(family: PetFamily, level: number): readonly PetSkill[] {
  return PET_FAMILIES[family].skills
    .map(id => PET_SKILLS[id]!)
    .filter(skill => skill.learnLevel <= level);
}

/** Skills newly learnable at exactly this level (for level-up grants). */
export function petSkillsAtLevel(family: PetFamily, level: number): readonly PetSkill[] {
  return PET_FAMILIES[family].skills
    .map(id => PET_SKILLS[id]!)
    .filter(skill => skill.learnLevel === level);
}

/** Record for a freshly tamed beast: captured level, no XP, family skills known at that level. */
export function createPetRecord(id: number, sourceKind: EnemyKind, level: number, name?: string): PetRecord {
  const family = tameableFamily(sourceKind);
  if (!family) throw new Error(`not tameable: ${sourceKind}`);
  const petLevel = normalizeLevel(level);
  const def = PET_FAMILIES[family];
  return { id, sourceKind, allyKind: def.allyKind, family,
    name: name ?? def.name, level: petLevel, xp: 0,
    skills: petSkillsLearned(family, petLevel).map(skill => skill.id),
    loyalty: PET_RULES.freshLoyalty };
}

/** Grant kill XP to a pet: levels up to the owner's level, learning family skills on the way. */
export function awardPetXp(pet: PetRecord, amount: number, ownerLevel: number): PetRecord {
  if (!Number.isFinite(amount) || amount <= 0) return pet;
  const cap = normalizeLevel(ownerLevel);
  let { level, xp, skills } = pet;
  xp = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(xp)) + Math.floor(amount));
  while (level < cap) {
    const threshold = petXpForLevel(level);
    if (xp < threshold) break;
    xp -= threshold;
    level++;
    for (const skill of petSkillsAtLevel(pet.family, level))
      if (!skills.includes(skill.id)) skills = [...skills, skill.id];
  }
  if (level === cap) xp = Math.min(xp, petXpForLevel(level));
  return { ...pet, level, xp, skills };
}

/** Loyalty is bounded; feeding and kills add, death and abandonment subtract. */
export function adjustPetLoyalty(pet: PetRecord, delta: number): PetRecord {
  return { ...pet, loyalty: Math.max(0, Math.min(PET_RULES.maxLoyalty, Math.round(pet.loyalty + delta))) };
}

export const freshPetStable = (): PetStable => ({ active: null, stabled: [] });

/** Tame a beast into the stable: active if empty, otherwise stabled; undefined when full. */
export function adoptPet(stable: PetStable, pet: PetRecord): PetStable | undefined {
  if (!stable.active) return { ...stable, active: pet };
  if (stable.stabled.length >= PET_RULES.stableSlots) return undefined;
  return { ...stable, stabled: [...stable.stabled, pet] };
}

/** Move the active pet into a stable slot; undefined when there is no active pet or no room. */
export function stableActivePet(stable: PetStable): PetStable | undefined {
  if (!stable.active || stable.stabled.length >= PET_RULES.stableSlots) return undefined;
  return { active: null, stabled: [...stable.stabled, stable.active] };
}

/** Swap a stabled pet into the active slot; the old active pet takes the freed slot. */
export function activateStabledPet(stable: PetStable, index: number): PetStable | undefined {
  const pet = stable.stabled[index];
  if (!pet) return undefined;
  const stabled = stable.stabled.slice();
  if (stable.active) stabled.splice(index, 1, stable.active);
  else stabled.splice(index, 1);
  return { active: pet, stabled };
}

/** Release a pet entirely: clears the active slot or removes it from the stable. */
export function releasePet(stable: PetStable, petId: number): PetStable {
  return { active: stable.active?.id === petId ? null : stable.active,
    stabled: stable.stabled.filter(pet => pet.id !== petId) };
}
