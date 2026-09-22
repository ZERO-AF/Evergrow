/** Guild ledger state (docs/wow-deepening.md — guild wave): pure bookkeeping on
 * `character.guild` plus the shared vault on `character.guildVault`. No world
 * access — the command layer stages mutations on checkpoint clones.
 *
 * Mirrors the reputation ledger convention: a `GuildCarrier` is anything with a
 * `character` (the live player or a staged checkpoint), and every getter also
 * accepts a bare sheet so `character-stats.ts` can fold perk stats in. */
import { GAME_FEATURES } from './game-features.ts';
import type { CharacterSheet, Item, StatModifiers } from './character-types.ts';
import {
  GUILD_PERKS, GUILD_RULES, GUILD_VAULT_CAPACITY, guildXpForNext,
  type GuildPerkDef,
} from './guild-content.ts';

/** Persisted guild membership on the character sheet. */
export interface GuildMembership {
  name: string;
  level: number;
  xp: number;
  /** Epoch seconds when the guild was founded/joined (panel display). */
  memberSince: number;
}

/** Anything carrying the sheet: the live player or a staged checkpoint. */
export interface GuildCarrier { character?: Pick<CharacterSheet, 'guild' | 'guildVault'> }
export type GuildSource = GuildCarrier | Pick<CharacterSheet, 'guild' | 'guildVault'>;

const sheetOf = (source: GuildSource): Pick<CharacterSheet, 'guild' | 'guildVault'> | undefined => {
  // A carrier (player/checkpoint) resolves to its sheet; a bare sheet is used as-is.
  const carrier = source as GuildCarrier;
  return 'character' in carrier ? carrier.character : source as Pick<CharacterSheet, 'guild' | 'guildVault'>;
};

/** Reads the integrator-added flag; defaults to on until it lands. */
export function guildsEnabled(): boolean {
  return 'guilds' in GAME_FEATURES ? GAME_FEATURES.guilds === true : true;
}

export function guildOf(source: GuildSource): GuildMembership | undefined {
  return sheetOf(source)?.guild;
}

/** Perks unlocked at the guild's current level; none while the flag is off. */
export function unlockedGuildPerks(source: GuildSource): readonly GuildPerkDef[] {
  if (!guildsEnabled()) return [];
  const level = guildOf(source)?.level ?? 0;
  return GUILD_PERKS.filter(perk => perk.level <= level);
}

export function guildHasPerk(source: GuildSource, id: GuildPerkDef['id']): boolean {
  return unlockedGuildPerks(source).some(perk => perk.id === id);
}

/** Level progress for the panel bar: XP into the level and the next threshold. */
export function guildLevelProgress(source: GuildSource): { level: number; into: number; span: number; capped: boolean } {
  const guild = guildOf(source);
  if (!guild) return { level: 0, into: 0, span: guildXpForNext(1), capped: false };
  const capped = guild.level >= GUILD_RULES.maxLevel;
  return { level: guild.level, into: capped ? 0 : Math.max(0, guild.xp), span: guildXpForNext(guild.level), capped };
}

// ── Perk modifiers ───────────────────────────────────────────────────────────
// Ranked perks replace their weaker rank: each modifier takes the strongest
// unlocked value (max for bonuses, min for cost/loss factors).

const best = (source: GuildSource, pick: (def: GuildPerkDef) => number | undefined, fold: (a: number, b: number) => number, base: number): number => {
  let value = base;
  for (const perk of unlockedGuildPerks(source)) {
    const next = pick(perk);
    if (next !== undefined) value = fold(value, next);
  }
  return value;
};

/** Perk stats folded into derived stats (xpGainPercent / goldFindPercent). */
export function guildStats(source: GuildSource): StatModifiers {
  const modifiers: StatModifiers = {};
  for (const perk of unlockedGuildPerks(source))
    for (const [key, value] of Object.entries(perk.effect.stats ?? {}) as [keyof StatModifiers, number][])
      modifiers[key] = Math.max(modifiers[key] ?? 0, value);
  return modifiers;
}

/** Mounted-speed multiplier (Mount Up); 1 without the perk. */
export const guildMountSpeedFactor = (source: GuildSource): number => best(source, p => p.effect.mountSpeedFactor, Math.max, 1);
/** Reputation-gain multiplier (Mr. Popularity); 1 without the perk. */
export const guildReputationFactor = (source: GuildSource): number => best(source, p => p.effect.reputationFactor, Math.max, 1);
/** Honor-gain multiplier (Honorable Mention); 1 without the perk. */
export const guildHonorFactor = (source: GuildSource): number => best(source, p => p.effect.honorFactor, Math.max, 1);
/** Profession skill-up chance multiplier (Working Overtime); 1 without the perk. */
export const guildProfessionChanceFactor = (source: GuildSource): number => best(source, p => p.effect.professionChanceFactor, Math.max, 1);
/** Hearthstone channel-time multiplier (Hasty Hearth); 1 without the perk. */
export const guildHearthstoneChannelFactor = (source: GuildSource): number => best(source, p => p.effect.hearthstoneChannelFactor, Math.min, 1);
/** Resurrection health/mana multiplier (The Quick and the Dead); 1 without it. */
export const guildReviveFactor = (source: GuildSource): number => best(source, p => p.effect.reviveFactor, Math.max, 1);
/** Vendor buy-price and repair-cost multiplier (Bartering); 1 without the perk. */
export const guildBarterFactor = (source: GuildSource): number => best(source, p => p.effect.barterFactor, Math.min, 1);

/** Durability-loss multiplier for one cause (Reinforce); 1 without the perk. */
export function guildDurabilityLossFactor(source: GuildSource, cause: 'death' | 'hit-taken' | 'strike'): number {
  return best(source, p => cause === 'death' ? p.effect.durabilityLoss?.death : p.effect.durabilityLoss?.combat, Math.min, 1);
}

/** Aggregated view for the panel and tests. */
export interface GuildPerkModifiers {
  stats: StatModifiers;
  mountSpeedFactor: number;
  reputationFactor: number;
  honorFactor: number;
  professionChanceFactor: number;
  hearthstoneChannelFactor: number;
  reviveFactor: number;
  barterFactor: number;
  vaultTabs: number;
}

export function guildPerks(source: GuildSource): GuildPerkModifiers {
  return {
    stats: guildStats(source),
    mountSpeedFactor: guildMountSpeedFactor(source),
    reputationFactor: guildReputationFactor(source),
    honorFactor: guildHonorFactor(source),
    professionChanceFactor: guildProfessionChanceFactor(source),
    hearthstoneChannelFactor: guildHearthstoneChannelFactor(source),
    reviveFactor: guildReviveFactor(source),
    barterFactor: guildBarterFactor(source),
    vaultTabs: guildVaultTabs(source),
  };
}

// ── Guild XP ─────────────────────────────────────────────────────────────────

export interface GuildXpResult {
  /** XP actually credited (0 at the level cap or without a guild). */
  applied: number;
  level: number;
  /** Levels gained by this contribution. */
  levels: number;
  /** Perks unlocked by the gained levels. */
  unlocked: readonly GuildPerkDef[];
}

/** Credit raw guild XP to a sheet's membership; rides the next checkpoint like
 * quest progress. Exact threshold arithmetic mirroring awardExperience. */
export function addGuildXp(sheet: Pick<CharacterSheet, 'guild'>, amount: number): GuildXpResult {
  const guild = sheet.guild;
  const none: GuildXpResult = { applied: 0, level: guild?.level ?? 0, levels: 0, unlocked: [] };
  if (!guildsEnabled() || !guild || !Number.isFinite(amount) || amount <= 0 || guild.level >= GUILD_RULES.maxLevel) return none;
  const before = guild.level;
  guild.xp = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(guild.xp + Math.floor(amount))));
  while (guild.level < GUILD_RULES.maxLevel && guild.xp >= guildXpForNext(guild.level)) {
    guild.xp -= guildXpForNext(guild.level);
    guild.level++;
  }
  if (guild.level >= GUILD_RULES.maxLevel) guild.xp = 0;
  const levels = guild.level - before;
  return { applied: Math.floor(amount), level: guild.level, levels,
    unlocked: GUILD_PERKS.filter(perk => perk.level > before && perk.level <= guild.level) };
}

/** The guild's share of an awarded player-XP amount (kills, quests, events). */
export function guildXpShare(playerXp: number): number {
  return Math.floor(playerXp * GUILD_RULES.xpShare);
}

// ── Guild vault ──────────────────────────────────────────────────────────────

/** Vault tabs unlocked by perks (Mobile Banking grants the single shared tab). */
export function guildVaultTabs(source: GuildSource): number {
  return Math.min(1, best(source, p => p.effect.vaultTabs, (a, b) => a + b, 0));
}

export const guildVaultUnlocked = (source: GuildSource): boolean => guildVaultTabs(source) > 0;

/** The shared vault contents; empty until the first deposit creates the tab. */
export function guildVaultItems(sheet: Pick<CharacterSheet, 'guildVault'>): readonly (Item | null)[] {
  return sheet.guildVault ?? [];
}

/** First free vault slot index, or -1 when the tab is full. */
export function guildVaultFreeSlot(sheet: Pick<CharacterSheet, 'guildVault'>): number {
  const vault = sheet.guildVault ?? [];
  for (let i = 0; i < GUILD_VAULT_CAPACITY; i++) if (!vault[i]) return i;
  return -1;
}

/** Why a guild name cannot be used, or null when it is valid. */
export function guildNameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < GUILD_RULES.nameMin || trimmed.length > GUILD_RULES.nameMax)
    return `Guild names are ${GUILD_RULES.nameMin}–${GUILD_RULES.nameMax} characters.`;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '-]*$/u.test(trimmed)) return 'Guild names use letters, spaces, apostrophes and hyphens.';
  return null;
}
