/** PvP quartermaster (wayfinder/pvp-t05): a standalone service NPC beside the city
 * battlemaster (stableMasterFor pattern — derived from the noble hall, not a building
 * kind) with a STATIC stock of PvP rewards priced in Honor and Arena Points.
 * `executePvpBuy` is the durable purchase command (glyph-command.ts template):
 * validate currency + pack space → stage on a checkpoint → persist → commit. */
import type { Building } from './settlements.ts';
import type { WorldQuery } from './model.ts';
import type { Simulation } from './simulation.ts';
import type { ActionResult, CharacterSheet, Item, ItemKind, ItemTier } from './character-types.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { MountId } from './mount-content.ts';
import { canInteractNPC, focusNPC, memoFixture, npcsNear, serviceFixture, type TownNPC } from './npcs.ts';
import { generateItem } from './items.ts';
import { addInventoryItem } from './inventory.ts';
import { canPackItem } from './inventory-grid.ts';
import { commitPurchase } from './vendor-buy.ts';
import { MOUNT_RULES } from './mount-state.ts';
import {
  arenaPointsBalance, formatPvpPoints, honorBalance, pvpEnabled, spendArenaPoints, spendHonor,
  type PvpCurrency,
} from './pvp-currency.ts';

// ── The NPC ──────────────────────────────────────────────────────────────────

/** PvP quartermasters stand beside the Count's Hall in cities, opposite the
 * battlemaster — a standalone service NPC like the stable master. */
export type PvpVendor = TownNPC & { role: 'pvpVendor' };
const PVP_VENDOR_NAMES = ['Vixton', 'Sergeant', 'Kazzim', 'Drol', 'Herwin', 'Zeg', 'Myla', 'Borok'] as const;
export const pvpVendorFor = memoFixture((building: Building): PvpVendor | null =>
  serviceFixture(building, 'noble', 'pvpVendor', -70, 24, PVP_VENDOR_NAMES));
export function pvpVendorsNear(world: WorldQuery, x: number, y: number, width: number, height: number): PvpVendor[] {
  return npcsNear(world, x, y, width, height, pvpVendorFor);
}
export function focusedPvpVendor(vendors: readonly PvpVendor[], player: { x: number; y: number; dead?: boolean }, world: WorldQuery,
  pointer?: { x: number; y: number }): PvpVendor | null {
  return focusNPC(vendors, player, world, pointer);
}

// ── Static stock ─────────────────────────────────────────────────────────────

/** One catalog row: a generated gear piece or the arena mount unlock. Gear items
 * are rolled per purchase at the buyer's level (generateItem), like rep rewards. */
export type PvpStockEntry =
  | { readonly id: string; readonly name: string; readonly kind: 'gear'; readonly slot: ItemKind; readonly tier: ItemTier; readonly price: number; readonly currency: PvpCurrency }
  | { readonly id: string; readonly name: string; readonly kind: 'mount'; readonly mount: MountId; readonly price: number; readonly currency: PvpCurrency };

const gear = (id: string, name: string, slot: ItemKind, tier: ItemTier, price: number, currency: PvpCurrency = 'honor'): PvpStockEntry =>
  Object.freeze({ id, name, kind: 'gear', slot, tier, price, currency });

/** Gladiator's set (WotLK S5 honor gear) plus arena-point weapons and the drake. */
export const PVP_VENDOR_STOCK: readonly PvpStockEntry[] = Object.freeze([
  gear('gladiator-helm', 'Gladiator’s Helm', 'head', 'epic', 1200),
  gear('gladiator-chestguard', 'Gladiator’s Chestguard', 'chest', 'epic', 1500),
  gear('gladiator-legguards', 'Gladiator’s Legguards', 'legs', 'epic', 1400),
  gear('gladiator-treads', 'Gladiator’s Treads', 'boots', 'rare', 900),
  gear('gladiator-grips', 'Gladiator’s Grips', 'gloves', 'rare', 900),
  gear('gladiator-cloak', 'Gladiator’s Cloak of Victory', 'cloak', 'rare', 800),
  gear('gladiator-medallion', 'Gladiator’s Medallion', 'amulet', 'epic', 1100),
  gear('gladiator-band', 'Gladiator’s Band', 'ring', 'epic', 1100),
  gear('gladiator-weapon', 'Gladiator’s Weapon', 'weapon', 'epic', 1800, 'arenaPoints'),
  gear('gladiator-bulwark', 'Gladiator’s Bulwark', 'shield', 'epic', 900, 'arenaPoints'),
  gear('gladiator-focus', 'Gladiator’s Focus', 'orb', 'epic', 900, 'arenaPoints'),
  gear('outrider-tabard-stock', 'Outrider’s Tabard', 'cloak', 'rare', 400),
  Object.freeze({ id: 'vengeful-drake', name: 'Vengeful Nether Drake', kind: 'mount', mount: 'drake', price: 5000, currency: 'arenaPoints' }),
]);

/** Stock for a vendor NPC; empty when PvP is off or the role is wrong. */
export function pvpVendorStock(npc: Pick<TownNPC, 'role'>): readonly PvpStockEntry[] {
  return pvpEnabled() && npc.role === 'pvpVendor' ? PVP_VENDOR_STOCK : [];
}
export const pvpStockEntry = (stockId: string): PvpStockEntry | undefined =>
  PVP_VENDOR_STOCK.find(entry => entry.id === stockId);
export const pvpStockPrice = (entry: PvpStockEntry): { price: number; currency: PvpCurrency } =>
  ({ price: entry.price, currency: entry.currency });

/** Why a stock row cannot be bought right now; null means purchasable. */
export function pvpBuyProblem(sheet: Pick<CharacterSheet, 'honor' | 'arenaPoints' | 'inventory' | 'inventoryLayout' | 'bags'>,
  entry: PvpStockEntry, level: number, owned?: Readonly<Record<string, number>>): string | null {
  if (entry.kind === 'mount' && (owned?.[MOUNT_RULES.drakeAchievement] ?? 0) > 0) return 'You already ride the Nether Drake.';
  const balance = entry.currency === 'honor' ? honorBalance(sheet) : arenaPointsBalance(sheet);
  if (balance < entry.price) return `Not enough ${entry.currency === 'honor' ? 'honor' : 'arena points'}.`;
  if (entry.kind === 'gear' && !canPackItem(sheet, pvpStockItem(entry, level, 0))) return 'No room in your bag.';
  return null;
}

/** Roll the gear row's item at the buyer's level; deterministic per seed. */
export function pvpStockItem(entry: PvpStockEntry & { kind: 'gear' }, level: number, seed: number): Item {
  const item = generateItem(seed, level, entry.slot, undefined, entry.tier);
  item.name = entry.name;
  item.baseName = entry.name;
  return item;
}

// ── Durable purchase ─────────────────────────────────────────────────────────

type PvpPersist = (checkpoint: CharacterCheckpoint) => Promise<ActionResult>;
/** Checkpoint extension carrying the achievement ledger (mount unlock flag). */
type PvpBuyCheckpoint = CharacterCheckpoint & { achievements?: Record<string, number> };

/** Buy a PvP stock row: spends Honor or Arena Points and delivers the item to the
 * bag — or, for the drake, sets the mount-unlock flag on the achievement ledger. */
export async function executePvpBuy(sim: Simulation, npc: TownNPC, stockId: string, persist: PvpPersist): Promise<ActionResult> {
  const p = sim.player;
  if (!pvpEnabled()) return { ok: false, message: 'PvP is not available.' };
  const entry = pvpStockEntry(stockId);
  if (!entry || !pvpVendorStock(npc).includes(entry)) return { ok: false, message: 'That item is not sold here.' };
  if (!canInteractNPC(npc, p, sim.world)) return { ok: false, message: 'The quartermaster is no longer in reach.' };
  if (entry.kind === 'mount' && (p.achievements?.[MOUNT_RULES.drakeAchievement] ?? 0) > 0)
    return { ok: false, message: 'You already ride the Nether Drake.' };
  const checkpoint = sim.captureCheckpoint() as PvpBuyCheckpoint;
  const spend = entry.currency === 'honor' ? spendHonor : spendArenaPoints;
  if (!spend(checkpoint.character, entry.price))
    return { ok: false, message: `Not enough ${entry.currency === 'honor' ? 'honor' : 'arena points'}.` };
  let item: Item | null = null;
  if (entry.kind === 'gear') {
    item = pvpStockItem(entry, p.level, ((checkpoint.character.commerce.operations + 1) * 0x9e3779b1 + honorBalance(checkpoint.character) + arenaPointsBalance(checkpoint.character)) >>> 0);
    item.id += `:pvp:${entry.id}:${checkpoint.character.commerce.operations}`;
    if (!addInventoryItem(checkpoint.character, item)) return { ok: false, message: 'No room in your bag.' };
  } else {
    checkpoint.achievements = { ...p.achievements, [MOUNT_RULES.drakeAchievement]: 1 };
  }
  checkpoint.character.commerce.operations++;
  const label = entry.currency === 'honor' ? 'honor' : 'arena points';
  const message = `Bought ${entry.name} for ${formatPvpPoints(entry.price)} ${label}.`;
  return commitPurchase(sim, checkpoint, persist,
    staged => { if (staged.achievements) p.achievements = staged.achievements; },
    message, 'Could not save. No currency was spent.');
}
