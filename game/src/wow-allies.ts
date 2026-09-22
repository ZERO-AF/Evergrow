import type { AllyKind } from './wow-types.ts';
import type { AllyAura } from './model.ts';

export interface AllyTemplate {
  readonly kind: AllyKind;
  readonly name: string;
  /** Base hp as fraction of player maxHp. */
  readonly hpFraction: number;
  /** Base damage as fraction of player attack damage. */
  readonly damageFraction: number;
  readonly stationary: boolean;
  readonly radius: number;
  /** Seconds between attacks. */
  readonly attackInterval: number;
  /** Preferred standoff range (0 = melee). */
  readonly attackRange: number;
  readonly color: string;
  /** Totem aura (heal player / slow enemies / mana, stat ward, absorb, cc-break, cleanse in radius). */
  readonly aura?: Omit<AllyAura, 'tickAcc'>;
  /** Signature ability note (demon skills live in pet-content.ts PET_SKILLS). */
  readonly ability?: string;
}

/** Ally templates: warlock demons, hunter pets, DK ghouls, shaman totems, mage images. */
export const ALLY_TEMPLATES: Readonly<Record<AllyKind, AllyTemplate>> = Object.freeze({
  imp: Object.freeze({ kind: 'imp', name: 'Imp', hpFraction: 0.25, damageFraction: 0.35, stationary: false, radius: 10, attackInterval: 1.8, attackRange: 280, color: '#e05a3a', ability: 'Firebolt · Blood Pact' }),
  felhunter: Object.freeze({ kind: 'felhunter', name: 'Felhunter', hpFraction: 0.4, damageFraction: 0.45, stationary: false, radius: 12, attackInterval: 1.5, attackRange: 0, color: '#7a4fd0', ability: 'Shadow Bite · Spell Lock' }),
  felguard: Object.freeze({ kind: 'felguard', name: 'Felguard', hpFraction: 0.6, damageFraction: 0.7, stationary: false, radius: 14, attackInterval: 1.6, attackRange: 0, color: '#5a3fb0', ability: 'Cleave · Intercept' }),
  voidwalker: Object.freeze({ kind: 'voidwalker', name: 'Voidwalker', hpFraction: 0.8, damageFraction: 0.3, stationary: false, radius: 14, attackInterval: 2.0, attackRange: 0, color: '#3a2f80', ability: 'Torment · Consume Shadows' }),
  doomguard: Object.freeze({ kind: 'doomguard', name: 'Doomguard', hpFraction: 0.9, damageFraction: 0.75, stationary: false, radius: 15, attackInterval: 1.7, attackRange: 0, color: '#7a3a4a', ability: 'War Stomp · Rain of Fire' }),
  succubus: Object.freeze({ kind: 'succubus', name: 'Succubus', hpFraction: 0.4, damageFraction: 0.55, stationary: false, radius: 11, attackInterval: 1.6, attackRange: 0, color: '#c05a8a', ability: 'Lash of Pain · Seduction' }),
  wolf: Object.freeze({ kind: 'wolf', name: 'Wolf', hpFraction: 0.5, damageFraction: 0.5, stationary: false, radius: 11, attackInterval: 1.4, attackRange: 0, color: '#8a7a5a' }),
  bear: Object.freeze({ kind: 'bear', name: 'Bear', hpFraction: 0.8, damageFraction: 0.4, stationary: false, radius: 14, attackInterval: 1.8, attackRange: 0, color: '#6a5a42' }),
  cat: Object.freeze({ kind: 'cat', name: 'Cat', hpFraction: 0.4, damageFraction: 0.6, stationary: false, radius: 10, attackInterval: 1.2, attackRange: 0, color: '#a08a5a' }),
  boar: Object.freeze({ kind: 'boar', name: 'Boar', hpFraction: 0.7, damageFraction: 0.4, stationary: false, radius: 12, attackInterval: 1.6, attackRange: 0, color: '#7a6248' }),
  raptor: Object.freeze({ kind: 'raptor', name: 'Raptor', hpFraction: 0.45, damageFraction: 0.55, stationary: false, radius: 11, attackInterval: 1.3, attackRange: 0, color: '#5a7a4a' }),
  spider: Object.freeze({ kind: 'spider', name: 'Spider', hpFraction: 0.4, damageFraction: 0.45, stationary: false, radius: 10, attackInterval: 1.4, attackRange: 0, color: '#4a4a52' }),
  bird: Object.freeze({ kind: 'bird', name: 'Carrion Bird', hpFraction: 0.35, damageFraction: 0.5, stationary: false, radius: 9, attackInterval: 1.3, attackRange: 0, color: '#8a94a0' }),
  windSerpent: Object.freeze({ kind: 'windSerpent', name: 'Wind Serpent', hpFraction: 0.35, damageFraction: 0.5, stationary: false, radius: 10, attackInterval: 1.7, attackRange: 240, color: '#5aa08a' }),
  scorpid: Object.freeze({ kind: 'scorpid', name: 'Scorpid', hpFraction: 0.55, damageFraction: 0.45, stationary: false, radius: 11, attackInterval: 1.6, attackRange: 0, color: '#8a5a3a' }),
  turtle: Object.freeze({ kind: 'turtle', name: 'Turtle', hpFraction: 0.85, damageFraction: 0.3, stationary: false, radius: 12, attackInterval: 2.0, attackRange: 0, color: '#4a7a5a' }),
  ghoul: Object.freeze({ kind: 'ghoul', name: 'Ghoul', hpFraction: 0.35, damageFraction: 0.4, stationary: false, radius: 11, attackInterval: 1.5, attackRange: 0, color: '#7a8a6a' }),
  waterElemental: Object.freeze({ kind: 'waterElemental', name: 'Water Elemental', hpFraction: 0.4, damageFraction: 0.45, stationary: false, radius: 12, attackInterval: 1.7, attackRange: 260, color: '#4a9ad0' }),
  earthElemental: Object.freeze({ kind: 'earthElemental', name: 'Earth Elemental', hpFraction: 1.0, damageFraction: 0.5, stationary: false, radius: 15, attackInterval: 1.8, attackRange: 0, color: '#8a7a52', ability: 'Taunt · Hardened Skin' }),
  fireElemental: Object.freeze({ kind: 'fireElemental', name: 'Fire Elemental', hpFraction: 0.6, damageFraction: 0.7, stationary: false, radius: 13, attackInterval: 1.6, attackRange: 260, color: '#e06a3a', ability: 'Fire Nova · Fire Blast' }),
  treant: Object.freeze({ kind: 'treant', name: 'Treant', hpFraction: 0.5, damageFraction: 0.4, stationary: false, radius: 12, attackInterval: 1.7, attackRange: 0, color: '#5a8a4a' }),
  shadowfiend: Object.freeze({ kind: 'shadowfiend', name: 'Shadowfiend', hpFraction: 0.3, damageFraction: 0.45, stationary: false, radius: 10, attackInterval: 1.4, attackRange: 0, color: '#4a3a70', ability: 'Mana return on hit' }),
  gargoyle: Object.freeze({ kind: 'gargoyle', name: 'Gargoyle', hpFraction: 0.4, damageFraction: 0.6, stationary: false, radius: 11, attackInterval: 1.5, attackRange: 280, color: '#6a7a8a', ability: 'Gargoyle Strike' }),
  mirrorImage: Object.freeze({ kind: 'mirrorImage', name: 'Mirror Image', hpFraction: 0.15, damageFraction: 0.25, stationary: false, radius: 10, attackInterval: 2.0, attackRange: 300, color: '#9ab8e0' }),
  searingTotem: Object.freeze({ kind: 'searingTotem', name: 'Searing Totem', hpFraction: 0.1, damageFraction: 0.3, stationary: true, radius: 8, attackInterval: 2.0, attackRange: 260, color: '#e07a3a' }),
  healingTotem: Object.freeze({ kind: 'healingTotem', name: 'Healing Stream Totem', hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: '#4ac0a0', aura: { kind: 'heal' as const, amount: 0.02, radius: 140 } }),
  earthbindTotem: Object.freeze({ kind: 'earthbindTotem', name: 'Earthbind Totem', hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: '#a08a4a', aura: { kind: 'slow' as const, amount: 0.5, radius: 140 } }),
  magmaTotem: Object.freeze({ kind: 'magmaTotem', name: 'Magma Totem', hpFraction: 0.1, damageFraction: 0.35, stationary: true, radius: 8, attackInterval: 2.2, attackRange: 120, color: '#e04a2a' }),
  manaSpringTotem: Object.freeze({ kind: 'manaSpringTotem', name: 'Mana Spring Totem', hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: '#4a7ad0', aura: { kind: 'mana' as const, amount: 0.015, radius: 140 } }),
  totemOfWrath: Object.freeze({ kind: 'totemOfWrath', name: 'Totem of Wrath', hpFraction: 0.1, damageFraction: 0.3, stationary: true, radius: 8, attackInterval: 2.0, attackRange: 260, color: '#e0a03a', aura: { kind: 'buff' as const, amount: 0, radius: 140, stats: { spellDamagePercent: 6 } } }),
  wrathOfAirTotem: Object.freeze({ kind: 'wrathOfAirTotem', name: 'Wrath of Air Totem', hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: '#9ad0e0', aura: { kind: 'buff' as const, amount: 0, radius: 140, stats: { castSpeedPercent: 5 } } }),
  windfuryTotem: Object.freeze({ kind: 'windfuryTotem', name: 'Windfury Totem', hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: '#7ac0a0', aura: { kind: 'buff' as const, amount: 0, radius: 140, stats: { attackSpeedPercent: 8 } } }),
  strengthOfEarthTotem: Object.freeze({ kind: 'strengthOfEarthTotem', name: 'Strength of Earth Totem', hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: '#a0784a', aura: { kind: 'buff' as const, amount: 0, radius: 140, stats: { strength: 6 } } }),
  stoneskinTotem: Object.freeze({ kind: 'stoneskinTotem', name: 'Stoneskin Totem', hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: '#8a8a7a', aura: { kind: 'buff' as const, amount: 0, radius: 140, stats: { armor: 8 } } }),
  flametongueTotem: Object.freeze({ kind: 'flametongueTotem', name: 'Flametongue Totem', hpFraction: 0.1, damageFraction: 0.3, stationary: true, radius: 8, attackInterval: 2.0, attackRange: 260, color: '#e08a3a' }),
  tremorTotem: Object.freeze({ kind: 'tremorTotem', name: 'Tremor Totem', hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: '#b09a6a', aura: { kind: 'ccBreak' as const, amount: 1.5, radius: 140 } }),
  cleansingTotem: Object.freeze({ kind: 'cleansingTotem', name: 'Cleansing Totem', hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: '#6ac0b0', aura: { kind: 'cleanse' as const, amount: 0, radius: 140 } }),
  groundingTotem: Object.freeze({ kind: 'groundingTotem', name: 'Grounding Totem', hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: '#7a9ad0', aura: { kind: 'absorb' as const, amount: 0.06, radius: 140 } }),
  spiritWolf: Object.freeze({ kind: 'spiritWolf', name: 'Spirit Wolf', hpFraction: 0.45, damageFraction: 0.55, stationary: false, radius: 11, attackInterval: 1.3, attackRange: 0, color: '#7ab8e0' }),
  infernal: Object.freeze({ kind: 'infernal', name: 'Infernal', hpFraction: 0.9, damageFraction: 0.8, stationary: false, radius: 16, attackInterval: 1.8, attackRange: 0, color: '#4ae07a' }),
  // Dungeon Finder AI party (party-content.ts): adventurers, not summons.
  // hp/damage fractions scale off the player's sheet like every summon; the
  // tank is a durable melee body, healer and dps stand at range.
  partyTank: Object.freeze({ kind: 'partyTank', name: 'Party Tank', hpFraction: 1.7, damageFraction: 0.5, stationary: false, radius: 13, attackInterval: 1.6, attackRange: 0, color: '#8fa8c0', ability: 'Taunt · Defensive Stance' }),
  partyHealer: Object.freeze({ kind: 'partyHealer', name: 'Party Healer', hpFraction: 0.8, damageFraction: 0.35, stationary: false, radius: 11, attackInterval: 2.2, attackRange: 260, color: '#e8d9a0', ability: 'Heal · Smite' }),
  partyDps: Object.freeze({ kind: 'partyDps', name: 'Party DPS', hpFraction: 0.9, damageFraction: 0.75, stationary: false, radius: 11, attackInterval: 1.5, attackRange: 240, color: '#b09ad0', ability: 'Class nuke' }),
});
