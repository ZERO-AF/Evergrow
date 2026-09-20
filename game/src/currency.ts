import { GAME_FEATURES } from './game-features.ts';

/** WoW currency (docs/wow-deepening.md §7): the wallet stores one copper total;
 * gold and silver are display denominations only — 1g = 100s = 10_000c.
 * Every gold amount in the game (balances, prices, pile values, rewards) is copper. */
export const COPPER_PER_SILVER = 100;
export const COPPER_PER_GOLD = 10_000;
export type Copper = number;
export interface CoinSplit { gold: number; silver: number; copper: number; }

/** Strict check for mutation paths (credit/spend); display normalizes instead. */
export const validCopper = (amount: unknown): amount is Copper =>
  typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0;

/** Display input may arrive mid-drain as a float; clamp to a whole, non-negative total. */
const copperTotal = (amount: number): Copper =>
  Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;

/** Compose a copper total from denominations, for content definitions (quest/vendor prices). */
export function toCopper(gold = 0, silver = 0, copper = 0): Copper {
  if (!validCopper(gold) || !validCopper(silver) || !validCopper(copper)) return 0;
  const total = gold * COPPER_PER_GOLD + silver * COPPER_PER_SILVER + copper;
  return validCopper(total) ? total : 0;
}

export function splitCopper(copper: Copper): CoinSplit {
  const total = copperTotal(copper);
  return {
    gold: Math.floor(total / COPPER_PER_GOLD),
    silver: Math.floor(total % COPPER_PER_GOLD / COPPER_PER_SILVER),
    copper: total % COPPER_PER_SILVER,
  };
}

/** Canonical wallet format: every denomination, e.g. "12g 34s 56c". */
export function formatCopper(copper: Copper): string {
  const { gold, silver, copper: rest } = splitCopper(copper);
  return `${gold}g ${silver}s ${rest}c`;
}

/** Compact format for prices and pickup deltas: zero denominations drop out — "12g 56c", "34s", "0c". */
export function formatCopperCompact(copper: Copper): string {
  const { gold, silver, copper: rest } = splitCopper(copper);
  const parts: string[] = [];
  if (gold) parts.push(`${gold}g`);
  if (silver) parts.push(`${silver}s`);
  if (rest || !parts.length) parts.push(`${rest}c`);
  return parts.join(' ');
}

const legacyFormat = new Intl.NumberFormat('en-US');
/** Pre-currency display: a single comma-grouped gold number ("123,456"). */
const formatLegacyGold = (amount: number): string => legacyFormat.format(copperTotal(amount));

/** Wallet balance display. Honors the `currency` feature flag: g/s/c when on, legacy gold when off. */
export const formatWallet = (copper: Copper): string =>
  GAME_FEATURES.currency ? formatCopper(copper) : formatLegacyGold(copper);

/** Compact wallet display for prices, costs and "+N" gain text. Same flag rule as formatWallet. */
export const formatWalletCompact = (copper: Copper): string =>
  GAME_FEATURES.currency ? formatCopperCompact(copper) : formatLegacyGold(copper);
