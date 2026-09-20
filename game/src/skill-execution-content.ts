import { AURA_IDS, auraSummary, type AuraId } from './aura-content.ts';
import type { SkillId, WowSkillId } from './character-types.ts';
import type { ProjectileEffects, ProjectileStyle } from './model.ts';
import type { SlowEffect } from './combat-status.ts';
import type { AllyKind, BuffSpec, CcKind, DotSchool, DotSpec, HotSpec, ShapeshiftForm } from './wow-types.ts';
import type { SkillDefinition } from './skill-content.ts';
import { WOW_SKILLS } from './wow-skills.ts';

/** Optional WoW payloads existing recipes can carry (docs/wow-transformation.md §3):
 *  dot/cc/slow/sunder apply per enemy hit; heal/buff apply once per cast on the player.
 *  heal is a fraction of player max life. */
export interface WowSkillPayload {
  readonly dot?: DotSpec;
  readonly cc?: { readonly kind: CcKind; readonly duration: number; readonly factor?: number };
  readonly heal?: number;
  readonly buff?: BuffSpec;
  readonly slow?: SlowEffect;
  readonly sunder?: number;
  /** Seconds each struck enemy is compelled to attack the player (Challenging Shout). */
  readonly taunt?: number;
  /** Flat resource granted to the player on cast (rage/energy/mana/runic). */
  readonly resourceGain?: number;
}

export type SkillExecution = (
  | {kind:'aura'; aura:AuraId; rank:number}
  | ({ kind: 'step'; duration: number; speed: number; retreat?: boolean; shot?: boolean; pierce?: number } & WowSkillPayload)
  | ({ kind: 'ward'; duration: number; fraction: number } & WowSkillPayload)
  | ({ kind: 'stance'; duration: number; reduction: number; charges: number; bonus: number; echo?: boolean } & WowSkillPayload)
  | ({ kind: 'sweep'; reachMultiplier: number; arc: number } & WowSkillPayload)
  | ({ kind: 'dash'; duration: number; speed: number; radius: number; stun?: number; toTarget?: boolean } & WowSkillPayload)
  | ({ kind: 'radial'; targetRange?:number; radius: number; melee: boolean; stun?: number; slow?: SlowEffect; style?: ProjectileStyle; echo?: boolean; shelter?: { duration: number; reduction: number } } & WowSkillPayload)
  | ({ kind: 'cone'; radius: number; arc: number; stun: number } & WowSkillPayload)
  | ({ kind: 'guard'; duration: number; reduction: number } & WowSkillPayload)
  | ({ kind: 'backstab'; minRange: number; reachMultiplier: number; arc: number; rearAngle: number; rearMultiplier: number; targets?: number } & WowSkillPayload)
  | ({ kind: 'projectile'; speed: number; radius: number; offsets: readonly number[];
      effects: Readonly<Omit<ProjectileEffects, 'burnDps' | 'groundDps'> & { burnDamageMultiplier?: number; groundDamageMultiplier?: number }> } & WowSkillPayload)
  | ({ kind: 'ground'; effect: 'meteor' | 'arrowRain' | 'storm' | 'frost'; radius: number; delay: number; duration: number; interval: number;
      style: ProjectileStyle; scatterRadiusMultiplier?: number; scorch?: { readonly duration: number; readonly interval: number; readonly damageMultiplier: number }; scatter?: number; slow?: SlowEffect; stun?: number; follow?: boolean; burn?: { readonly duration: number; readonly damageMultiplier: number } } & WowSkillPayload)
  | ({ kind: 'chain'; travelSpeed: number; jumps: number; range: number; falloff: number; duration: number; style: ProjectileStyle; revisit?: boolean } & WowSkillPayload)
  // WoW additions — see docs/wow-transformation.md
  | { kind: 'strike'; school?: DotSchool; dot?: DotSpec;
      slow?: { duration: number; factor: number }; stun?: number; silence?: number; healFrac?: number;
      cc?: { readonly kind: CcKind; readonly duration: number; readonly factor?: number };
      sunder?: number; bonusVsDot?: number; bonusVsFrozen?: number; bonusBehind?: number; bonusVsRooted?: number;
      consumeDot?: { school: DotSchool; multiplier: number } }
  | { kind: 'dot'; dot: DotSpec; direct?: number }
  | { kind: 'heal'; amount: number; maxHpFrac?: number; hot?: HotSpec; consumeHot?: number;
      /** Hot heals this fraction of the healed target's maxHp per second (pet heals scale off the pet). */ hotFrac?: number;
      /** Pet-targeted heal (Mend Pet / Revive Pet): acts on the active pet ally, not the player. */ pet?: 'mend' | 'revive';
      /** Sacrifice a live ally of this kind to power the heal (Death Pact). */ consumeAlly?: AllyKind | 'demon' }
  | { kind: 'hot'; hot: HotSpec; maxHpFrac?: number }
  | { kind: 'buff'; buff: BuffSpec }
  | { kind: 'cc'; cc: CcKind; duration: number; radius?: number; maxTargets?: number; resourceGain?: number }
  | { kind: 'interrupt'; silence: number }
  | { kind: 'pull'; stun?: number }
  | { kind: 'taunt'; duration: number; expose?: number }
  | { kind: 'summon'; ally: AllyKind; count: number; duration?: number;
      /** Arrival burst: stuns enemies within radius of the summon point (Inferno). */ stun?: number; radius?: number }
  | { kind: 'tame' }
  | { kind: 'channel'; school: DotSchool; ticks: number; duration: number; radius?: number;
      /** Radial channels center on the aimed point at this range instead of the player (Hunter's Volley). */ targetRange?: number;
      slow?: { duration: number; factor: number }; healFrac?: number; executeBonus?: number; manaPerTick?: number }
  | { kind: 'form'; form: ShapeshiftForm; buff: BuffSpec }
  | { kind: 'stealth'; duration: number; dropAggro?: boolean }
  | { kind: 'comboStrike'; build?: number; spend?: boolean; school?: DotSchool;
      dot?: DotSpec; stunPerCombo?: number; buffPerCombo?: BuffSpec;
      sunder?: number; requiresBehind?: boolean; requiresStealth?: boolean }
  | { kind: 'runeStrike'; school?: DotSchool; dot?: DotSpec;
      healFrac?: number; diseaseBonus?: number }
  | { kind: 'cleanse'; heal?: number; removeCc?: boolean; resourceGain?: number; buff?: BuffSpec;
      /** Fraction of maxHp paid as cost (Life Tap). */ hpCost?: number;
      /** resourceGain as fraction of maxMana instead of flat. */ resourceGainFrac?: number });

/** Authored WoW skill entry: definition fields plus its execution recipe. */
export interface WowSkill extends Omit<SkillDefinition, 'id'> {
  readonly id: WowSkillId;
  readonly execution: SkillExecution;
}

export const GROUND_EFFECT_RULES = Object.freeze({ maximum: 16, minimumInterval: .05 });
/** One full life-on-hit proc, then smaller procs for new targets only. */
export const CHAIN_SUSTAIN = Object.freeze({ subsequentTarget: .25 });
export function chainLifeOnHitMultiplier(contact: number, revisited: boolean): number {
  return revisited ? 0 : contact === 0 ? 1 : CHAIN_SUSTAIN.subsequentTarget;
}
export function groundEffectPulseCount(effect: { duration: number; interval: number }): number {
  return Math.max(1, Math.ceil(effect.duration / Math.max(GROUND_EFFECT_RULES.minimumInterval, effect.interval)));
}

export const SKILL_TARGETING = Object.freeze({ maximumRange: 900, probeStep: 4, probeRadius: 1,
  minimumProjectileLife: .1, blastDuration: .45 });

/** Execution tuning is content. Handlers operate on these recipes, never skill-name branches. */
export const SKILL_EXECUTION = {
  ...Object.fromEntries(AURA_IDS.map(id=>[id,{kind:'aura',aura:id,rank:1}])) as Record<AuraId,{kind:'aura';aura:AuraId;rank:number}>,
  repulse: { kind: 'cone', radius: 95, arc: Math.PI * 1.5, stun: 1.2 },
  ironCitadel: { kind: 'radial', radius: 130, melee: true, shelter: { duration: 5, reduction: .45 } },
  smokeVeil: { kind: 'radial', radius: 115, melee: false, style: 'spirit', slow: { duration: 3, factor: .5 }, shelter: { duration: 2, reduction: .2 } },
  nightReaping: { kind: 'backstab', minRange: 160, reachMultiplier: 2, arc: Math.PI * 2, rearAngle: Math.PI * .6, rearMultiplier: 2, targets: 5 },
  sidestep: { kind: 'step', duration: .22, speed: 720 },
  brace: { kind: 'stance', duration: 2, reduction: .2, charges: 0, bonus: 0 },
  runicWard: { kind: 'ward', duration: 4, fraction: .18 },
  vaultingShot: { kind: 'step', duration: .24, speed: 440, retreat: true, shot: true },
  rallyOfIron: { kind: 'stance', duration: 6, reduction: .25, charges: 3, bonus: .35 },
  ghostHunt: { kind: 'stance', duration: 6, reduction: 0, charges: 3, bonus: .6, echo: true },
  cataclysm: { kind: 'ground', effect: 'meteor', radius: 105, delay: 1, duration: 0, interval: .5, style: 'fire', scatter: 7, scorch: { duration: 4, interval: .25, damageMultiplier: .12 }, burn: { duration: 3, damageMultiplier: .12 } },
  tempest: { kind: 'ground', effect: 'storm', radius: 195, delay: .4, duration: 6, interval: .5, style: 'lightning', follow: true },
  absoluteZero: { kind: 'ground', effect: 'frost', radius: 240, delay: .5, duration: 1.3, interval: 1.2, style: 'frost', slow: { duration: 4, factor: .25 }, stun: 1.5 },
  cleave: { kind: 'sweep', reachMultiplier: 1.4, arc: Math.PI * 1.4 },
  whirlwind: { kind: 'sweep', reachMultiplier: 1.25, arc: Math.PI * 2 },
  lunge: { kind: 'dash', duration: .24, speed: 520, radius: 23 },
  earthshatter: { kind: 'radial', radius: 125, melee: true, stun: 1.2 },
  shieldBash: { kind: 'cone', radius: 68, arc: Math.PI * .7, stun: 1.1 },
  bulwark: { kind: 'guard', duration: 3, reduction: .75 },
  backstab: { kind: 'backstab', minRange: 48, reachMultiplier: 1.25, arc: Math.PI / 2, rearAngle: Math.PI * .6, rearMultiplier: 2 },
  volley: { kind: 'projectile', speed: 550, radius: 3, offsets: [-.23, 0, .23], effects: { style: 'arrow' } },
  piercingShot: { kind: 'projectile', speed: 680, radius: 3, offsets: [0], effects: { style: 'arrow', pierce: 3 } },
  ricochet: { kind: 'projectile', speed: 530, radius: 3, offsets: [0], effects: { style: 'arrow', chain: 3, chainRange: 150 } },
  rainOfArrows: { kind: 'ground', effect: 'arrowRain', radius: 92, delay: .4, duration: 1.2, interval: .3, style: 'arrow' },
  fireball: { kind: 'projectile', speed: 320, radius: 5, offsets: [0], effects: { style: 'fire', blastRadius: 85, burnDuration: 3, burnDamageMultiplier: .12 } },
  frostLance: { kind: 'projectile', speed: 440, radius: 5, offsets: [0], effects: { style: 'frost', pierce: 3, slowFactor: .5, slowDuration: 2.5 } },
  siphon: { kind: 'projectile', speed: 350, radius: 5, offsets: [0], effects: { style: 'spirit', lifeSteal: .35 } },
  iceNova: { kind: 'radial', radius: 115, melee: false, slow: { duration: 2.5, factor: .5 }, style: 'frost' },
  meteor: { kind: 'ground', effect: 'meteor', radius: 125, delay: .85, duration: 0, interval: 1, style: 'fire', scorch: { duration: 4, interval: .25, damageMultiplier: .12 }, burn: { duration: 3, damageMultiplier: .12 } },
  // WoW class kits + racial actives (docs/wow-transformation.md §4).
  ...Object.fromEntries(WOW_SKILLS.map(({ execution, id }) => [id, execution])) as Record<WowSkillId, SkillExecution>,
  arcLightning: { kind: 'chain', travelSpeed: 1400, jumps: 5, range: 145, falloff: .78, duration: .28, style: 'lightning' },
} as const satisfies Record<SkillId, SkillExecution>;

function freeze(value: object): void {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
}
freeze(SKILL_EXECUTION);

/** Numeric UI labels read the same recipe as execution. */
export function skillDamageSuffix(id: SkillId, recipe: SkillExecution = SKILL_EXECUTION[id]): string {
  if (recipe.kind === 'projectile' && recipe.offsets.length > 1) return recipe.effects.style === 'arrow' ? ' / arrow' : ' / projectile';
  if (recipe.kind === 'ground' && recipe.scatter) return ' / impact';
  if (recipe.kind === 'ground' && groundEffectPulseCount(recipe) > 1) return ' / wave';
  return '';
}
export function skillUtilityLabel(id: SkillId, recipe:SkillExecution = SKILL_EXECUTION[id]): string {
  const n=(v:number)=>Number(v.toFixed(2));
  if(recipe.kind==='aura')return auraSummary(recipe.aura,recipe.rank);
  if(recipe.kind==='radial'&&recipe.shelter)return `${n(recipe.shelter.duration)}s · ${n(recipe.shelter.reduction*100)}% less hit damage${recipe.slow?` · ${Math.round((1-recipe.slow.factor)*100)}% slow for ${n(recipe.slow.duration)}s`:''}`;
  if(recipe.kind==='guard')return `${n(recipe.duration)}s · ${n(recipe.reduction*100)}% block`;
  if(recipe.kind==='step')return `${Math.round(recipe.speed*recipe.duration)} units · no invulnerability`;
  if(recipe.kind==='ward')return `${n(recipe.fraction*100)}% max life barrier · ${n(recipe.duration)}s`;
  if(recipe.kind==='stance')return `${n(recipe.duration)}s${recipe.reduction?` · ${n(recipe.reduction*100)}% less hit damage`:''}${recipe.charges?` · ${recipe.charges} ${recipe.echo?'echoes at':'actions at +'} ${n(recipe.bonus*100)}% damage`:''}`;
  return '';
}
