/** PvP currencies (wayfinder/pvp-t05): Honor and Arena Points.
 * The balances live on `CharacterSheet` as optional integer fields beside gold;
 * the atomic credit/spend helpers themselves are defined in wallet.ts next to
 * their gold counterparts and re-exported here so PvP code has one import site.
 * Award amounts and the match-end durable path live in pvp-rewards.ts. */
import { GAME_FEATURES } from './game-features.ts';
import type { ArenaPointsWallet, HonorWallet } from './wallet.ts';

export {
  arenaPointsBalance, canAffordArenaPoints, canAffordHonor, creditArenaPoints, creditHonor,
  honorBalance, spendArenaPoints, spendHonor, validArenaPoints, validHonor,
} from './wallet.ts';
export type { ArenaPointsWallet, HonorWallet } from './wallet.ts';

/** The PvP feature switch (game-features.ts); absent means enabled. */
export const pvpEnabled = (): boolean => !('pvp' in GAME_FEATURES) || GAME_FEATURES.pvp !== false;

/** The two PvP currency kinds, for price tags and award summaries. */
export type PvpCurrency = 'honor' | 'arenaPoints';
export const PVP_CURRENCY_LABELS: Readonly<Record<PvpCurrency, string>> = Object.freeze({
  honor: 'Honor', arenaPoints: 'Arena Points',
});

export function pvpCurrencyBalance(wallet: HonorWallet & ArenaPointsWallet, currency: PvpCurrency): number {
  return currency === 'honor' ? wallet.honor ?? 0 : wallet.arenaPoints ?? 0;
}

/** Comma-grouped point display ("12,500") — PvP points have no denominations. */
const pointFormat = new Intl.NumberFormat('en-US');
export const formatPvpPoints = (amount: number): string =>
  pointFormat.format(Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0);
