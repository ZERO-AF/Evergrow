/** Emblems of Heroism (WotLK heroic dungeons): the badge currency.
 * The balance lives on `CharacterSheet` as an optional integer field beside
 * gold/honor; the atomic credit/spend helpers themselves are defined in
 * wallet.ts next to their counterparts and re-exported here so heroic code has
 * one import site. Award amounts live in heroic-content.ts; the vendor stock
 * and durable purchase live in emblem-content.ts / badge-vendor.ts. */
import { heroicDungeonsEnabled } from './heroic-content.ts';

export {
  canAffordEmblems, creditEmblems, emblemBalance, spendEmblems, validEmblems,
} from './wallet.ts';
export type { EmblemWallet } from './wallet.ts';

/** Emblems exist only while heroic dungeons are enabled. */
export const emblemsEnabled = heroicDungeonsEnabled;

/** Comma-grouped point display ("1,250") — emblems have no denominations. */
const pointFormat = new Intl.NumberFormat('en-US');
export const formatEmblems = (amount: number): string =>
  pointFormat.format(Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0);
