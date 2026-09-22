import type { DamageType, WeaponFamily } from './model.ts';
import type { StatModifiers, WowSkillId } from './character-types.ts';

/** WotLK class identity. Persisted on CharacterSheet.classId. */
export type WowClassId = 'warrior' | 'paladin' | 'hunter' | 'rogue' | 'priest'
  | 'deathKnight' | 'shaman' | 'mage' | 'warlock' | 'druid';
export const WOW_CLASS_IDS: readonly WowClassId[] = Object.freeze([
  'warrior', 'paladin', 'hunter', 'rogue', 'priest', 'deathKnight', 'shaman', 'mage', 'warlock', 'druid',
]);
export function isWowClassId(v: unknown): v is WowClassId {
  return typeof v === 'string' && (WOW_CLASS_IDS as readonly string[]).includes(v);
}

/** WotLK race identity. Persisted on CharacterSheet.raceId. */
export type WowRaceId = 'human' | 'dwarf' | 'nightElf' | 'gnome' | 'draenei'
  | 'orc' | 'undead' | 'tauren' | 'troll' | 'bloodElf';
export const WOW_RACE_IDS: readonly WowRaceId[] = Object.freeze([
  'human', 'dwarf', 'nightElf', 'gnome', 'draenei', 'orc', 'undead', 'tauren', 'troll', 'bloodElf',
]);
export function isWowRaceId(v: unknown): v is WowRaceId {
  return typeof v === 'string' && (WOW_RACE_IDS as readonly string[]).includes(v);
}

/** The war axis a playable race belongs to. Static per race (wow-races.ts). */
export type PlayerFaction = 'alliance' | 'horde';


/** Primary resource riding Player.mana/maxMana. */
export type ResourceType = 'mana' | 'rage' | 'energy' | 'runicPower';
export type RuneKind = 'blood' | 'frost' | 'unholy';
export type ShapeshiftForm = 'bear' | 'cat' | 'moonkin' | 'travel' | 'shadow' | 'metamorph' | 'ghostWolf';

export interface WowClassDef {
  readonly id: WowClassId;
  readonly name: string;
  /** WoW class color. */
  readonly color: string;
  readonly resource: ResourceType;
  readonly resourceLabel: string;
  /** Base resource cap (rage/energy/runic = 100; mana classes use derived maxMana). */
  readonly resourceCap: number;
  /** Flat resource regenerated per second (energy 10; mana uses derived regen; rage/runic decay). */
  readonly resourceRegen: number;
  /** Out-of-combat decay per second (rage/runic). */
  readonly resourceDecay: number;
  /** Rage gained when dealing a basic hit / when taking a hit. */
  readonly gainOnDeal: number;
  readonly gainOnHit: number;
  /** Global cooldown seconds (rogue/cat 1.0, others 1.5). */
  readonly gcd: number;
  readonly armorStyle: 'plate' | 'leather' | 'cloth';
  /** Equipable weapon families (spec §1 Weapons column; 'unarmed' is the fallback, never listed). */
  readonly weapons: readonly WeaponFamily[];
  /** True when the class may equip two-handed melee weapons (sword/axe/mace). */
  readonly twoHandedMelee: boolean;
  /** Starter loadout: weapon profile id + optional offhand profile id. */
  readonly starter: { weapon: string; offhand?: string };
  /** The class's level-1 skill; its sanctum node is free and pre-allocated at creation. */
  readonly starterSkill: WowSkillId;
  /** The class's three WotLK talent specializations, in sanctum order (Warrior: Arms/Fury/Protection). */
  readonly specs: readonly [string, string, string];
  readonly description: string;
  readonly roles: readonly string[];
}

export interface WowRaceDef {
  readonly id: WowRaceId;
  readonly name: string;
  /** Alliance or Horde — drives the starting zone, NPC hostility and guards. */
  readonly faction: PlayerFaction;
  /** Playable classes; deathKnight is additionally available to every race. */
  readonly classes: readonly WowClassId[];
  /** Racial active skill id (auto-known, R key). */
  readonly racial: string;
  readonly racialName: string;
  readonly racialDescription: string;
  /** Passive stat modifiers merged in characterModifierSources. */
  readonly passives: StatModifiers;
  readonly passiveDescription: string;
  /** Selectable SKIN_PALETTES ids for this race; [0] is the creation default. */
  readonly skinTones: readonly string[];
  /** Silhouette + head features that make the race readable at a glance. */
  readonly visual: WowRaceVisual;
}

export interface WowRaceVisual {
  /** Default HAIR_PALETTES id for a fresh character of this race. */
  readonly hairColor: string;
  /** Default FACIAL_HAIR id (dwarves start bearded). */
  readonly facialHair?: string;
  /** Default RACE_FEATURES id for the race's signature option (horns, tusks…). */
  readonly feature?: string;
  /** Body scale: height multiplies vertical reach, width horizontal bulk. */
  readonly height: number;
  readonly width: number;
  /** Head scale relative to the body (gnomes run large-headed). */
  readonly headScale?: number;
  /** Forward stoop: shears the torso toward the facing and drops the head. */
  readonly hunch?: number;
  /** Ear silhouette drawn beside the head. */
  readonly ears?: 'elf' | 'long' | 'bovine';
  /** Lower-face tusks: short orc underbite or long troll pair. */
  readonly tusks?: 'short' | 'long';
  /** Horn pair (tauren, draenei crest). */
  readonly horns?: 'tauren' | 'draenei';
  /** Bovine muzzle replacing nose and mouth (tauren). */
  readonly muzzle?: boolean;
  /** Sunken undead features: dark eye hollows, exposed bone. */
  readonly decay?: boolean;
  /** Glowing eye color (night elf gold, blood elf green, undead yellow, draenei blue). */
  readonly eyeGlow?: string;
  /** Eye scale for oversized gnome eyes. */
  readonly eyeScale?: number;
  /** Dark facial markings (night elf). */
  readonly markings?: boolean;
  /** Chin tendrils hanging beside the jaw (draenei). */
  readonly tendrils?: boolean;
  /** Cloven hooves replace boots (tauren, draenei). */
  readonly hooves?: boolean;
  /** Tail silhouette: tufted bovine or smooth draenei. */
  readonly tail?: 'tuft' | 'smooth';
  /** Nose silhouette: broad dwarf nose or hooked troll nose. */
  readonly nose?: 'broad' | 'hooked';
  /** Jaw silhouette: wide orc underbite or bony undead jaw. */
  readonly jaw?: 'wide' | 'bone';
}

/** Damage-over-time school: DamageType plus physical 'bleed' and nature 'poison'. */
export type DotSchool = DamageType | 'bleed' | 'poison' | 'nature' | 'holy' | 'shadow';
export interface DotSpec {
  readonly school: DotSchool;
  /** Fraction of the triggering hit's damage dealt per second. */
  readonly dpsMultiplier?: number;
  /** Flat damage per second (alternative to dpsMultiplier). */
  readonly flatDps?: number;
  readonly duration: number;
  /** Seconds between ticks (default 0.5). */
  readonly interval?: number;
  /** Dps grows by this fraction per tick (Curse of Agony ramp). */
  readonly ramp?: number;
  /** On early removal (host death or a consume effect) the dot bursts for this fraction
   * of its unpaid damage (dps × remaining). Natural expiry pays nothing extra. */
  readonly detonate?: number;
}

export interface HotSpec {
  /** Fraction of the triggering heal per tick. */
  readonly perTick?: number;
  /** Flat heal per tick (alternative). */
  readonly flatTick?: number;
  readonly duration: number;
  readonly interval?: number;
}

export type CcKind = 'root' | 'fear' | 'incapacitate' | 'polymorph' | 'silence' | 'stun' | 'freeze' | 'slow';
/** Creature family for family-gated control (Banish, Shackle Undead, Enslave Demon). */
export type CreatureFamily = 'beast' | 'humanoid' | 'undead' | 'demon' | 'elemental' | 'dragonkin' | 'critter';

/** Player buff entry (stances, seals, aspects, forms, shields, haste…). */
export interface BuffSpec {
  readonly stats?: StatModifiers;
  readonly duration: number;
  /** Absorb pool as fraction of max life (PW:S, Ice Barrier). */
  readonly absorb?: number;
  /** Fraction of incoming hit damage prevented (Shield Wall, Barkskin). */
  readonly reduction?: number;
  readonly healPerSecond?: number;
  readonly manaPerSecond?: number;
  /** Rage/energy/runic per second while active. */
  readonly resourcePerSecond?: number;
  /** Mutually exclusive group (aspects, seals, stances, forms, armors). */
  readonly exclusiveGroup?: string;
  readonly form?: ShapeshiftForm;
  readonly stealth?: boolean;
  /** Reflected damage fraction (thorns, lightning shield). */
  readonly reflect?: number;
  /** Weapon imbue: added elemental damage fraction on basics. */
  readonly imbue?: { element: 'fire' | 'frost' | 'lightning' | 'nature' | 'shadow' | 'holy'; fraction: number };
  /** Breaks crowd control on application. */
  readonly breakControl?: boolean;
  /** Multiplies ally (pet/minion) damage while active (Kill Command, Bestial Wrath). */
  readonly allyDamage?: number;
  readonly petShare?: number;
  /** Full damage immunity while active (Ice Block, Divine Shield). */
  readonly immunity?: boolean;
  /** Fraction of damage dealt returned as healing (Vampiric Embrace). */
  readonly leech?: number;
}

/** Ally (pet/minion/totem) template id. */
export type AllyKind = 'imp' | 'felhunter' | 'felguard' | 'voidwalker' | 'succubus' | 'doomguard'
  | 'wolf' | 'bear' | 'cat' | 'boar' | 'raptor' | 'spider' | 'bird' | 'windSerpent' | 'scorpid' | 'turtle'
  | 'ghoul' | 'waterElemental' | 'earthElemental' | 'fireElemental' | 'mirrorImage' | 'treant' | 'shadowfiend' | 'gargoyle'
  | 'searingTotem' | 'healingTotem' | 'earthbindTotem' | 'magmaTotem' | 'manaSpringTotem' | 'totemOfWrath'
  | 'wrathOfAirTotem' | 'windfuryTotem' | 'strengthOfEarthTotem' | 'stoneskinTotem' | 'flametongueTotem'
  | 'tremorTotem' | 'cleansingTotem' | 'groundingTotem'
  | 'spiritWolf' | 'infernal'
  | 'partyTank' | 'partyHealer' | 'partyDps';

/** Tab-target tuning (world units; ~14 units per yard). */
export const TAB_TARGETING = Object.freeze({
  coneHalfNear: (45 * Math.PI) / 180,
  coneHalfFar: (60 * Math.PI) / 180,
  nearRadius: 420,
  queryRadius: 700,
  meleeEngagedRadius: 80,
});

/** Combat model constants. */
export const WOW_COMBAT = Object.freeze({
  gcdDefault: 1.5,
  gcdRogueCat: 1.0,
  castMoveFactor: 0.45,
  rageDecayDelay: 8,
  runeRecharge: 10,
  runicPowerPerRune: 10,
  maxComboPoints: 5,
  maxSoulShards: 4,
  maxAllies: 6,
  allyLeash: 70,
  stealthSenseRadius: 25,
});
