import type { ItemKind, StatModifiers } from './character-types.ts';
import type { DamageType } from './model.ts';
import type { WowWeaponFamily } from './item-naming.ts';
import type { CcKind, DotSchool } from './wow-types.ts';

/**
 * WotLK legendary procs — pure data + tooltip text.
 * `id` matches the WOW_LEGENDARIES entry the proc belongs to; generic legendary
 * weapons roll a proc whose `families`/`hands` fit their rolled profile.
 * `trigger` picks the rolling event (hit, being hit, heal, cast) and `kinds`
 * the item kinds that may carry it — absent means onHit weapons only.
 * Damage fields are fractions of the striking weapon's damage so a proc stays
 * relevant at any item level; combat execution lives in legendary-combat.ts.
 */
export interface LegendaryProcEffect {
  readonly kind: 'projectile' | 'aoe' | 'buff' | 'debuff' | 'dot' | 'heal';
  /** Elemental school; drives resistances, exposure and the hit style. */
  readonly school?: DamageType | DotSchool;
  /** Weapon-damage fraction dealt to the target (and chained/aoe victims). */
  readonly damage?: number;
  /** Weapon-damage fraction per second for kind 'dot'. */
  readonly dps?: number;
  /** Buff/heal/absorb duration or dot duration in seconds. */
  readonly duration?: number;
  /** Heal/absorb strength: fraction of the player's maximum life. */
  readonly value?: number;
  /** AoE reach around the struck enemy. */
  readonly radius?: number;
  /** Extra enemies hit beyond the primary target (chain/aoe cap). */
  readonly chain?: number;
  /** Movement (and attack tempo) slow applied to victims. */
  readonly slow?: { readonly duration: number; readonly factor: number };
  /** Elemental vulnerability: victims take this much more of `school` damage. */
  readonly exposure?: { readonly element: Exclude<DamageType, 'physical'>; readonly power: number; readonly duration: number };
  /** Crowd control applied to victims (debuff kind). */
  readonly cc?: { readonly kind: CcKind; readonly duration: number };
  /** Player buff stats for kind 'buff' (haste, spell power…). */
  readonly stats?: StatModifiers;
  /** Absorb shield for kind 'heal'/'buff': fraction of max life. */
  readonly absorb?: number;
  /** Incoming-damage reduction fraction on a self-buff (Shield Wall style). */
  readonly reduction?: number;
  /** Fraction of max life restored per second while a self-buff lasts. */
  readonly healPerSecond?: number;
  /** Fraction of max mana restored per second while a self-buff lasts. */
  readonly manaPerSecond?: number;
  /** Fraction of damage dealt returned as healing while a self-buff lasts. */
  readonly leech?: number;
  /** Stacking procs (Shadowmourne souls): burst fires at this count. */
  readonly stacks?: number;
  /** Burn rider on a projectile/aoe hit (Sulfuras). */
  readonly burn?: { readonly duration: number; readonly dps: number };
}

/** Combat event that rolls a proc: direct hits, hits taken, heals or skill casts. */
export type ProcTrigger = 'onHit' | 'onBeingHit' | 'onHeal' | 'onCast';

export interface LegendaryProc {
  readonly id: string;
  readonly name: string;
  /** Weapon families this proc may roll on; absent = any. */
  readonly families?: readonly WowWeaponFamily[];
  /** Required handedness; absent = either. */
  readonly hands?: 1 | 2;
  /** Event that rolls the proc; absent = 'onHit'. */
  readonly trigger?: ProcTrigger;
  /** Item kinds that may carry the proc; absent = weapons only. */
  readonly kinds?: readonly ItemKind[];
  /** Per-event proc chance. */
  readonly chance: number;
  /** Seconds before the same item can proc again. */
  readonly internalCooldown: number;
  /** Tooltip line shown after the trigger label ("Chance on hit:"…). */
  readonly text: string;
  readonly effect: LegendaryProcEffect;
}

export const LEGENDARY_PROCS: Readonly<Record<string, LegendaryProc>> = Object.freeze({
  'thunderfury': { id: 'thunderfury', name: 'Thunderfury, Blessed Blade of the Windseeker',
    families: ['sword'], hands: 1, chance: .2, internalCooldown: 3,
    text: 'Blasts the enemy with lightning, dealing nature damage to it and up to 3 nearby enemies, slowing them and reducing their nature resistance.',
    effect: { kind: 'aoe', school: 'nature', damage: .6, radius: 140, chain: 3,
      slow: { duration: 3, factor: .75 }, exposure: { element: 'nature', power: 15, duration: 6 } } },
  'sulfuras': { id: 'sulfuras', name: 'Sulfuras, Hand of Ragnaros',
    families: ['mace'], hands: 2, chance: .2, internalCooldown: 4,
    text: 'Hurls a fiery ball that causes fire damage and burns the target for additional damage over 4 seconds.',
    effect: { kind: 'projectile', school: 'fire', damage: 1.2, burn: { duration: 4, dps: .15 } } },
  'warglaive-azzinoth': { id: 'warglaive-azzinoth', name: 'Warglaive of Azzinoth',
    families: ['sword'], hands: 1, chance: .15, internalCooldown: 6,
    text: 'Your attacks grant Fury of the Betrayer, increasing attack speed by 15% for 8 seconds and searing the target.',
    effect: { kind: 'buff', school: 'fire', damage: .3, duration: 8, stats: { attackSpeedPercent: 15 } } },
  'shadowmourne': { id: 'shadowmourne', name: 'Shadowmourne',
    families: ['axe'], hands: 2, chance: .15, internalCooldown: 2,
    text: 'Your attacks gather a soul fragment. At 10 fragments the souls erupt, dealing shadow damage to enemies around your target.',
    effect: { kind: 'aoe', school: 'shadow', damage: 1.5, radius: 120, stacks: 10 } },
  'atiesh': { id: 'atiesh', name: 'Atiesh, Greatstaff of the Guardian',
    families: ['staff', 'wand'], chance: .15, internalCooldown: 6,
    text: 'The Guardian\'s power surrounds you, increasing spell damage by 20% for 10 seconds.',
    effect: { kind: 'buff', duration: 10, stats: { spellDamagePercent: 20 } } },
  'valanyr': { id: 'valanyr', name: 'Val\'anyr, Hammer of Ancient Kings',
    families: ['mace'], hands: 1, chance: .2, internalCooldown: 4,
    text: 'Your attacks mend you for a portion of your maximum life and raise a protective barrier that absorbs damage for 8 seconds.',
    effect: { kind: 'heal', value: .04, absorb: .08, duration: 8 } },
  'thoridal': { id: 'thoridal', name: 'Thori\'dal, the Stars\' Fury',
    families: ['bow'], hands: 2, chance: .25, internalCooldown: 2,
    text: 'Launches a bolt of starfire at the target, dealing arcane damage.',
    effect: { kind: 'projectile', school: 'arcane', damage: .8 } },
  'shadows-edge': { id: 'shadows-edge', name: 'Shadow\'s Edge',
    families: ['axe'], chance: .2, internalCooldown: 3,
    text: 'Rends the target\'s soul, dealing shadow damage over 6 seconds.',
    effect: { kind: 'dot', school: 'shadow', dps: .2, duration: 6 } },
  'frostmourne': { id: 'frostmourne', name: 'Frostmourne',
    families: ['sword'], hands: 2, chance: .15, internalCooldown: 4,
    text: 'Steals a fragment of the victim\'s soul, dealing shadow damage and slowing its movement.',
    effect: { kind: 'debuff', school: 'shadow', damage: .8, slow: { duration: 3, factor: .7 } } },
  'ashbringer': { id: 'ashbringer', name: 'Ashbringer',
    families: ['sword'], hands: 2, chance: .2, internalCooldown: 3,
    text: 'Sears the target with holy fire, dealing holy damage to it and nearby enemies.',
    effect: { kind: 'aoe', school: 'holy', damage: .9, radius: 110 } },
  'dragonwrath': { id: 'dragonwrath', name: 'Dragonwrath, Tarecgosa\'s Rest',
    families: ['staff', 'wand'], chance: .15, internalCooldown: 5,
    text: 'Tarecgosa\'s wrath duplicates your strike as an arcane bolt at the target.',
    effect: { kind: 'projectile', school: 'arcane', damage: 1 } },
  'fangs-of-the-father': { id: 'fangs-of-the-father', name: 'Fangs of the Father',
    families: ['dagger'], hands: 1, chance: .2, internalCooldown: 3,
    text: 'The fangs drink deep, causing the target to bleed for damage over 5 seconds.',
    effect: { kind: 'dot', school: 'bleed', dps: .25, duration: 5 } },
  'quel-delar': { id: 'quel-delar', name: 'Quel\'Delar, Might of the Faithful',
    families: ['sword'], hands: 1, chance: .2, internalCooldown: 4,
    text: 'The blade\'s light restores a portion of your maximum life.',
    effect: { kind: 'heal', value: .05 } },
  'doomhammer': { id: 'doomhammer', name: 'Doomhammer',
    families: ['mace'], hands: 1, chance: .2, internalCooldown: 3,
    text: 'Calls down a bolt of storm lightning that arcs to up to 2 additional enemies.',
    effect: { kind: 'aoe', school: 'lightning', damage: .7, radius: 130, chain: 2 } },
  'oathbinder': { id: 'oathbinder', name: 'Oathbinder, Charge of the Ranger-General',
    families: ['polearm', 'staff'], hands: 2, chance: .2, internalCooldown: 3,
    text: 'The Ranger-General\'s charge roots the target in place for 2 seconds.',
    effect: { kind: 'debuff', school: 'nature', damage: .4, cc: { kind: 'root', duration: 2 } } },
  'titanstrike': { id: 'titanstrike', name: 'Titanstrike',
    families: ['gun', 'bow'], hands: 2, chance: .2, internalCooldown: 3,
    text: 'Discharges a titan spark that deals lightning damage to the target and up to 2 nearby enemies.',
    effect: { kind: 'aoe', school: 'lightning', damage: .8, radius: 140, chain: 2 } },
  'fangs-of-ashamane': { id: 'fangs-of-ashamane', name: 'Fangs of Ashamane',
    families: ['fist'], hands: 1, chance: .2, internalCooldown: 3,
    text: 'The claws rake deep, causing the target to bleed for damage over 5 seconds.',
    effect: { kind: 'dot', school: 'bleed', dps: .25, duration: 5 } },
  // Trinket/accessory procs — WotLK icons carried on amulets and rings.
  'deaths-verdict': { id: 'deaths-verdict', name: 'Death\'s Verdict',
    kinds: ['amulet', 'ring'], chance: .15, internalCooldown: 45,
    text: 'Your attacks can render a verdict, increasing your damage by 15% for 15 seconds.',
    effect: { kind: 'buff', duration: 15, stats: { damagePercent: 15 } } },
  'comets-trail': { id: 'comets-trail', name: 'Comet\'s Trail',
    kinds: ['amulet', 'ring'], chance: .15, internalCooldown: 45,
    text: 'Your attacks can quicken you with the comet\'s speed, increasing attack and cast speed by 20% for 10 seconds.',
    effect: { kind: 'buff', duration: 10, stats: { attackSpeedPercent: 20, castSpeedPercent: 20 } } },
  'darkmoon-greatness': { id: 'darkmoon-greatness', name: 'Darkmoon Card: Greatness',
    kinds: ['amulet', 'ring'], chance: .15, internalCooldown: 45,
    text: 'Your attacks can reveal your greatness, increasing strength, dexterity, intelligence and vitality by 15 for 15 seconds.',
    effect: { kind: 'buff', duration: 15, stats: { strength: 15, dexterity: 15, intelligence: 15, vitality: 15 } } },
  'deathbringers-will': { id: 'deathbringers-will', name: 'Deathbringer\'s Will',
    kinds: ['amulet', 'ring'], chance: .1, internalCooldown: 60,
    text: 'Your attacks can invoke the deathbringer\'s fury, increasing damage by 20% and attack speed by 10% for 15 seconds.',
    effect: { kind: 'buff', duration: 15, stats: { damagePercent: 20, attackSpeedPercent: 10 } } },
  'phylactery-nameless-lich': { id: 'phylactery-nameless-lich', name: 'Phylactery of the Nameless Lich',
    kinds: ['amulet', 'ring'], chance: .15, internalCooldown: 45,
    text: 'Your attacks can draw on the phylactery, increasing spell damage by 25% for 15 seconds.',
    effect: { kind: 'buff', duration: 15, stats: { spellDamagePercent: 25 } } },
  'reign-of-the-dead': { id: 'reign-of-the-dead', name: 'Reign of the Dead',
    kinds: ['amulet', 'ring'], chance: .15, internalCooldown: 8,
    text: 'Your attacks can hurl a bolt of smoldering fire at the target.',
    effect: { kind: 'projectile', school: 'fire', damage: .6 } },
  'tiny-abomination': { id: 'tiny-abomination', name: 'Tiny Abomination in a Jar',
    kinds: ['amulet', 'ring'], chance: .35, internalCooldown: 0,
    text: 'Your attacks gather a mote of anger. At 8 motes they erupt, dealing physical damage to enemies around your target.',
    effect: { kind: 'aoe', school: 'physical', damage: .8, radius: 110, stacks: 8 } },
  'solace-of-the-defeated': { id: 'solace-of-the-defeated', name: 'Solace of the Defeated',
    trigger: 'onCast', kinds: ['amulet', 'ring'], chance: .2, internalCooldown: 45,
    text: 'Your spells can grant you solace, restoring 2% of your maximum mana per second for 10 seconds.',
    effect: { kind: 'buff', duration: 10, manaPerSecond: .02 } },
  'pandoras-plea': { id: 'pandoras-plea', name: 'Pandora\'s Plea',
    trigger: 'onCast', kinds: ['amulet', 'ring'], chance: .15, internalCooldown: 45,
    text: 'Your spells can open Pandora\'s box, increasing spell damage by 20% for 10 seconds.',
    effect: { kind: 'buff', duration: 10, stats: { spellDamagePercent: 20 } } },
  'ephemeral-snowflake': { id: 'ephemeral-snowflake', name: 'Ephemeral Snowflake',
    trigger: 'onHeal', kinds: ['amulet', 'ring'], chance: .25, internalCooldown: 45,
    text: 'Your healing can crystallize into an ephemeral snowflake, restoring 1% of your maximum mana per second for 15 seconds.',
    effect: { kind: 'buff', duration: 15, manaPerSecond: .01 } },
  // Armor procs — defensive rolls when the wearer is struck.
  'essence-of-gossamer': { id: 'essence-of-gossamer', name: 'Essence of Gossamer',
    trigger: 'onBeingHit', kinds: ['cloak'], chance: .1, internalCooldown: 45,
    text: 'Being struck can weave a gossamer barrier that absorbs 12% of your maximum life for 10 seconds.',
    effect: { kind: 'buff', duration: 10, absorb: .12 } },
  'satrinas-impeding-scarab': { id: 'satrinas-impeding-scarab', name: 'Satrina\'s Impeding Scarab',
    trigger: 'onBeingHit', kinds: ['chest'], chance: .1, internalCooldown: 45,
    text: 'Being struck can harden your shell, reducing damage taken by 15% for 10 seconds.',
    effect: { kind: 'buff', duration: 10, reduction: .15 } },
  'the-black-heart': { id: 'the-black-heart', name: 'The Black Heart',
    trigger: 'onBeingHit', kinds: ['boots'], chance: .15, internalCooldown: 45,
    text: 'Being struck can blacken your heart, increasing armor by 25% for 10 seconds.',
    effect: { kind: 'buff', duration: 10, stats: { armorPercent: 25 } } },
  'juggernauts-vitality': { id: 'juggernauts-vitality', name: 'Juggernaut\'s Vitality',
    trigger: 'onBeingHit', kinds: ['head'], chance: .1, internalCooldown: 45,
    text: 'Being struck can rally the juggernaut\'s vitality, healing you for 5% of your maximum life and absorbing 8% for 8 seconds.',
    effect: { kind: 'heal', value: .05, absorb: .08, duration: 8 } },
  'corpse-tongue-coin': { id: 'corpse-tongue-coin', name: 'Corpse Tongue Coin',
    trigger: 'onBeingHit', kinds: ['ring'], chance: .1, internalCooldown: 45,
    text: 'Being struck can chill your blood, increasing armor by 20% for 10 seconds.',
    effect: { kind: 'buff', duration: 10, stats: { armorPercent: 20 } } },
});

/** Trigger a proc rolls on; absent trigger means 'onHit'. */
export const procTrigger = (proc: LegendaryProc | undefined): ProcTrigger => proc?.trigger ?? 'onHit';

/** Item kinds a proc may ride on; absent kinds means weapons only. */
export const procKinds = (proc: LegendaryProc | undefined): readonly ItemKind[] => proc?.kinds ?? ['weapon'];

/** Tooltip prefix per trigger — item-ui renders `${label}: ${proc.text}`. */
export const PROC_TRIGGER_LABELS: Readonly<Record<ProcTrigger, string>> = Object.freeze({
  onHit: 'Chance on hit', onBeingHit: 'Chance on being hit', onHeal: 'Chance on heal', onCast: 'Chance on cast',
});

/** Procs a rolled weapon silhouette could carry — generic legendaries draw from this pool. */
export function legendaryProcsFor(family: string, hands: 1 | 2): readonly LegendaryProc[] {
  return Object.values(LEGENDARY_PROCS).filter(proc => procKinds(proc).includes('weapon')
    && (proc.families === undefined || proc.families.includes(family as WowWeaponFamily)) && (proc.hands === undefined || proc.hands === hands));
}

