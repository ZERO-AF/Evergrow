/** Badge vendor (WotLK emblem quartermaster): a standalone service NPC beside
 * the city noble hall — below the battlemaster, opposite the PvP quartermaster —
 * with a STATIC stock of tier-7 offset epics and authored uniques priced in
 * Emblems of Heroism (emblem-content.ts). `executeBadgeBuy` is the durable
 * purchase command (pvp-vendor.ts template): validate currency + pack space →
 * stage on a checkpoint → persist → commit. */
import type { Building } from './settlements.ts';
import type { WorldQuery } from './model.ts';
import type { Simulation } from './simulation.ts';
import type { ActionResult, CharacterSheet } from './character-types.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import { getZoneAt } from './zone-progression.ts';
import { canInteractNPC, hashService, memoFixture, type TownNPC } from './npcs.ts';
import { factionAt } from './factions.ts';
import { addInventoryItem } from './inventory.ts';
import { canPackItem } from './inventory-grid.ts';
import { refreshCharacter } from './character.ts';
import { pushChatMessage } from './chat-log.ts';
import { BADGE_VENDOR_STOCK, badgeStockEntry, badgeStockItem, type BadgeStockEntry } from './emblem-content.ts';
import { emblemBalance, emblemsEnabled, formatEmblems, spendEmblems } from './emblem-state.ts';

// ── The NPC ──────────────────────────────────────────────────────────────────

/** Badge vendors stand beside the Count's Hall in cities, below the
 * battlemaster — a standalone service NPC like the PvP quartermaster. */
export type BadgeVendor = TownNPC & { role: 'badgeVendor' };
const BADGE_VENDOR_NAMES = ['Arcanist', 'Magister', 'Lukems', 'Braeg', 'Nixi', 'Varesh', 'Ormus', 'Selin'] as const;
export const badgeVendorFor = memoFixture((building: Building): BadgeVendor | null => {
  if (building.kind !== 'noble') return null;
  const x = building.door.x + 70, y = building.door.y + 78, id = `${building.id}:badgeVendor`;
  const seed = hashService(id);
  const zone = getZoneAt(x, y, Number(building.id.split(':')[1]));
  return { settlementTier: building.settlementTier, id, buildingId: building.id, role: 'badgeVendor', x, y, seed,
    name: BADGE_VENDOR_NAMES[seed % BADGE_VENDOR_NAMES.length],
    level: zone.level, maxLevel: zone.maxLevel, faction: factionAt(x, y) };
});
export function badgeVendorsNear(world: WorldQuery, x: number, y: number, width: number, height: number): BadgeVendor[] {
  return (world.getBuildings?.(x, y, width, height) ?? [])
    .map(badgeVendorFor).filter((vendor): vendor is BadgeVendor => vendor !== null);
}
export function focusedBadgeVendor(vendors: readonly BadgeVendor[], player: { x: number; y: number; dead?: boolean }, world: WorldQuery,
  pointer?: { x: number; y: number }): BadgeVendor | null {
  return vendors.filter(vendor => canInteractNPC(vendor, player, world) && (!pointer || Math.hypot(pointer.x - vendor.x, pointer.y - (vendor.y - 17)) <= 28))
    .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0] ?? null;
}

// ── Static stock ─────────────────────────────────────────────────────────────

/** Stock for a vendor NPC; empty when heroic dungeons are off or the role is wrong. */
export function badgeVendorStock(npc: Pick<TownNPC, 'role'>): readonly BadgeStockEntry[] {
  return emblemsEnabled() && npc.role === 'badgeVendor' ? BADGE_VENDOR_STOCK : [];
}

/** Why a stock row cannot be bought right now; null means purchasable. */
export function badgeBuyProblem(sheet: Pick<CharacterSheet, 'emblems' | 'inventory' | 'inventoryLayout' | 'bags'>,
  entry: BadgeStockEntry, level: number): string | null {
  if (emblemBalance(sheet) < entry.price) return 'Not enough emblems.';
  if (!canPackItem(sheet, badgeStockItem(entry, level, 0))) return 'No room in your bag.';
  return null;
}

// ── Durable purchase ─────────────────────────────────────────────────────────

type BadgePersist = (checkpoint: CharacterCheckpoint) => Promise<ActionResult>;

/** Buy a badge stock row: spends Emblems of Heroism and delivers the item to the bag. */
export async function executeBadgeBuy(sim: Simulation, npc: TownNPC, stockId: string, persist: BadgePersist): Promise<ActionResult> {
  const p = sim.player;
  if (!emblemsEnabled()) return { ok: false, message: 'Heroic dungeons are not available.' };
  const entry = badgeStockEntry(stockId);
  if (!entry || !badgeVendorStock(npc).includes(entry)) return { ok: false, message: 'That item is not sold here.' };
  if (!canInteractNPC(npc, p, sim.world)) return { ok: false, message: 'The badge vendor is no longer in reach.' };
  const checkpoint = sim.captureCheckpoint();
  if (!spendEmblems(checkpoint.character, entry.price))
    return { ok: false, message: 'Not enough emblems.' };
  const item = badgeStockItem(entry, p.level, ((checkpoint.character.commerce.operations + 1) * 0x9e3779b1 + emblemBalance(checkpoint.character)) >>> 0);
  item.id += `:badge:${entry.id}:${checkpoint.character.commerce.operations}`;
  if (!addInventoryItem(checkpoint.character, item)) return { ok: false, message: 'No room in your bag.' };
  checkpoint.character.commerce.operations++;
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. No emblems were spent.' };
  p.character = checkpoint.character;
  refreshCharacter(p);
  const message = `Bought ${entry.name} for ${formatEmblems(entry.price)} emblems.`;
  pushChatMessage(p, 'loot', message, sim.time);
  return { ok: true, message };
}
