/** Guild progression content (docs/wow-deepening.md — guild wave): the WoW
 * guild-level track compressed for a single hero. Guilds level 1–25 on a share
 * of the member's experience; each level unlocks a real Cataclysm-era guild
 * perk (Fast Track, Mount Up, Cash Flow, Mr. Popularity, Reinforce, …).
 * Immutable definitions only — the ledger lives in guild-state.ts. */
import type { UIIconName } from './ui-icons.ts';
import type { StatModifiers } from './character-types.ts';

export const GUILD_RULES = Object.freeze({
  /** Guilds progress from level 1 to 25, like the real perk track. */
  maxLevel: 25,
  /** Fraction of awarded player XP that also feeds the guild level. */
  xpShare: .25,
  /** WoW guild-name bounds (letters, spaces, apostrophes and hyphens). */
  nameMin: 2,
  nameMax: 24,
});

/** Guild XP needed to leave `level` (level 1 → 2 costs 400). */
export const guildXpForNext = (level: number): number => 400 * Math.max(1, Math.min(GUILD_RULES.maxLevel, Math.floor(level)));

/** One shared guild vault tab, gated by the Mobile Banking perk. */
export const GUILD_VAULT_CAPACITY = 96;
export const GUILD_VAULT_PERK = 'mobileBanking';

export interface GuildPerkEffect {
  /** Folded into derived stats via characterModifierSources (percentage points). */
  readonly stats?: StatModifiers;
  /** Mounted-speed multiplier (Mount Up: 1.1). */
  readonly mountSpeedFactor?: number;
  /** Reputation-gain multiplier (Mr. Popularity: 1.05 / 1.1). */
  readonly reputationFactor?: number;
  /** Honor-gain multiplier (Honorable Mention: 1.05 / 1.1). */
  readonly honorFactor?: number;
  /** Profession skill-up chance multiplier (Working Overtime: 1.1). */
  readonly professionChanceFactor?: number;
  /** Hearthstone channel-time multiplier (Hasty Hearth: .5). */
  readonly hearthstoneChannelFactor?: number;
  /** Resurrection health/mana multiplier (The Quick and the Dead: 1.5). */
  readonly reviveFactor?: number;
  /** Vendor buy-price and repair-cost multiplier (Bartering: .9). */
  readonly barterFactor?: number;
  /** Durability-loss multipliers: `death` for the death penalty, `combat` for hit/strike wear. */
  readonly durabilityLoss?: { readonly death?: number; readonly combat?: number };
  readonly vaultTabs?: number;
}

export interface GuildPerkDef {
  readonly id: GuildPerkId;
  readonly name: string;
  /** Guild level that unlocks the perk. */
  readonly level: number;
  readonly icon: UIIconName;
  readonly description: string;
  readonly effect: GuildPerkEffect;
}

export type GuildPerkId =
  | 'fastTrack1' | 'fastTrack2' | 'mountUp' | 'mrPopularity1' | 'mrPopularity2'
  | 'cashFlow1' | 'cashFlow2' | 'reinforce1' | 'reinforce2' | 'hastyHearth'
  | 'mobileBanking' | 'honorableMention1' | 'honorableMention2' | 'workingOvertime'
  | 'bartering' | 'quickAndDead';

const perk = (id: GuildPerkId, name: string, level: number, icon: UIIconName, description: string, effect: GuildPerkEffect): GuildPerkDef =>
  Object.freeze({ id, name, level, icon, description, effect: Object.freeze(effect) });

/** The real guild-perk track, one unlock per level where the roster allows. */
export const GUILD_PERKS: readonly GuildPerkDef[] = Object.freeze([
  perk('fastTrack1', 'Fast Track', 2, 'star', 'Experience gained from killing monsters and completing quests increased by 5%.', { stats: { xpGainPercent: 5 } }),
  perk('mountUp', 'Mount Up', 3, 'map', 'Increases speed while mounted by 10%.', { mountSpeedFactor: 1.1 }),
  perk('mrPopularity1', 'Mr. Popularity', 4, 'star', 'Reputation gained from killing monsters and completing quests increased by 5%.', { reputationFactor: 1.05 }),
  perk('cashFlow1', 'Cash Flow', 5, 'gold', 'Enemies drop 5% more gold.', { stats: { goldFindPercent: 5 } }),
  perk('fastTrack2', 'Fast Track', 6, 'star', 'Experience gained from killing monsters and completing quests increased by 10%.', { stats: { xpGainPercent: 10 } }),
  perk('reinforce1', 'Reinforce', 7, 'armor', 'Items take 10% less durability loss upon death.', { durabilityLoss: { death: .9 } }),
  perk('hastyHearth', 'Hasty Hearth', 8, 'portal', 'Reduces the hearthstone channel time by 50%.', { hearthstoneChannelFactor: .5 }),
  perk('reinforce2', 'Reinforce', 9, 'armor', 'Items take 20% less durability loss upon death and 10% less from combat wear.', { durabilityLoss: { death: .8, combat: .9 } }),
  perk('honorableMention1', 'Honorable Mention', 10, 'shield', 'Honor gained from battlegrounds and honorable kills increased by 5%.', { honorFactor: 1.05 }),
  perk('mobileBanking', 'Mobile Banking', 12, 'inventory', 'Opens the guild vault: a shared 96-slot bank tab.', { vaultTabs: 1 }),
  perk('mrPopularity2', 'Mr. Popularity', 13, 'star', 'Reputation gained from killing monsters and completing quests increased by 10%.', { reputationFactor: 1.1 }),
  perk('workingOvertime', 'Working Overtime', 14, 'journal', 'Increases the chance to gain a skill point on professions by 10%.', { professionChanceFactor: 1.1 }),
  perk('quickAndDead', 'The Quick and the Dead', 15, 'skull', 'You return with 50% more health and mana when resurrected.', { reviveFactor: 1.5 }),
  perk('cashFlow2', 'Cash Flow', 16, 'gold', 'Enemies drop 10% more gold.', { stats: { goldFindPercent: 10 } }),
  perk('honorableMention2', 'Honorable Mention', 18, 'shield', 'Honor gained from battlegrounds and honorable kills increased by 10%.', { honorFactor: 1.1 }),
  perk('bartering', 'Bartering', 20, 'diamond', 'Reduces the price of goods from vendors and repairs by 10%.', { barterFactor: .9 }),
]);

export const GUILD_PERK_BY_ID: Readonly<Record<GuildPerkId, GuildPerkDef>> = Object.freeze(
  Object.fromEntries(GUILD_PERKS.map(def => [def.id, def])) as Record<GuildPerkId, GuildPerkDef>);

export const isGuildPerkId = (id: unknown): id is GuildPerkId =>
  typeof id === 'string' && Object.hasOwn(GUILD_PERK_BY_ID, id);
