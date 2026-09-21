/** Missing balance means an empty wallet. Amounts are always whole, safe integers. */
export interface GoldWallet { gold?: number; }
export const validGold = (amount: unknown): amount is number =>
  typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0;
export const goldBalance = (wallet: GoldWallet): number => wallet.gold ?? 0;
export function canAfford(wallet: GoldWallet, amount: number): boolean {
  return validGold(amount) && validGold(goldBalance(wallet)) && goldBalance(wallet) >= amount;
}
/** Atomic operations shared by pickups and future shops. Failure never changes the wallet. */
export function creditGold(wallet: GoldWallet, amount: number): boolean {
  const balance = goldBalance(wallet);
  if (!validGold(amount) || !validGold(balance) || !validGold(balance + amount)) return false;
  wallet.gold = balance + amount;
  return true;
}
export function spendGold(wallet: GoldWallet, amount: number): boolean {
  if (!canAfford(wallet, amount)) return false;
  wallet.gold = goldBalance(wallet) - amount;
  return true;
}

/** PvP currencies (wayfinder/pvp-t05): Honor and Arena Points are plain integer
 * balances on the character sheet, parallel to gold but never denominated. */
export interface HonorWallet { honor?: number; }
export interface ArenaPointsWallet { arenaPoints?: number; }
export const validHonor = (amount: unknown): amount is number =>
  typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0;
export const validArenaPoints = validHonor;
export const honorBalance = (wallet: HonorWallet): number => wallet.honor ?? 0;
export const arenaPointsBalance = (wallet: ArenaPointsWallet): number => wallet.arenaPoints ?? 0;
export function canAffordHonor(wallet: HonorWallet, amount: number): boolean {
  return validHonor(amount) && validHonor(honorBalance(wallet)) && honorBalance(wallet) >= amount;
}
export function canAffordArenaPoints(wallet: ArenaPointsWallet, amount: number): boolean {
  return validArenaPoints(amount) && validArenaPoints(arenaPointsBalance(wallet)) && arenaPointsBalance(wallet) >= amount;
}
/** Atomic operations shared by match awards and the PvP vendor. Failure never changes the wallet. */
export function creditHonor(wallet: HonorWallet, amount: number): boolean {
  const balance = honorBalance(wallet);
  if (!validHonor(amount) || !validHonor(balance) || !validHonor(balance + amount)) return false;
  wallet.honor = balance + amount;
  return true;
}
export function spendHonor(wallet: HonorWallet, amount: number): boolean {
  if (!canAffordHonor(wallet, amount)) return false;
  wallet.honor = honorBalance(wallet) - amount;
  return true;
}
export function creditArenaPoints(wallet: ArenaPointsWallet, amount: number): boolean {
  const balance = arenaPointsBalance(wallet);
  if (!validArenaPoints(amount) || !validArenaPoints(balance) || !validArenaPoints(balance + amount)) return false;
  wallet.arenaPoints = balance + amount;
  return true;
}
export function spendArenaPoints(wallet: ArenaPointsWallet, amount: number): boolean {
  if (!canAffordArenaPoints(wallet, amount)) return false;
  wallet.arenaPoints = arenaPointsBalance(wallet) - amount;
  return true;
}
