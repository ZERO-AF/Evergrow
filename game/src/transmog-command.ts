/**
 * Durable transmogrification commands (docs/wow-deepening.md conventions):
 * stage on a captured checkpoint, persist, then commit to the live player.
 * The map lives on `checkpoint.character.transmog`, so it serializes with the
 * sheet — no WowCheckpoint extension is needed.
 */
import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { ActionResult, EquipmentSlot } from './character-types.ts';
import { refreshCharacter } from './character.ts';
import { pushChatMessage } from './chat-log.ts';
import { spendGold } from './wallet.ts';
import { formatWalletCompact } from './currency.ts';
import { itemDisplayName } from './items.ts';
import { DURABILITY_SLOT_NAMES } from './durability.ts';
import {
  ownedItem, pruneTransmog, transmogCost, transmogEnabled, transmogProblem,
  type TransmoggedSheet,
} from './transmog-state.ts';

type Persist = (checkpoint: CharacterCheckpoint) => Promise<ActionResult>;

/** Apply an owned item's appearance to an equipped slot for the vendor-value fee. */
export async function executeTransmogApply(sim: Simulation, slot: EquipmentSlot, sourceId: string, persist: Persist): Promise<ActionResult> {
  const p = sim.player;
  if (!transmogEnabled()) return { ok: false, message: 'Transmogrification is not available.' };
  if (p.dead) return { ok: false, message: 'Cannot transmogrify while defeated.' };
  const equipped = p.character.equipped[slot];
  const source = ownedItem(p.character, sourceId);
  const problem = transmogProblem(p.character, slot, source);
  if (problem || !equipped || !source) return { ok: false, message: problem ?? 'That item cannot supply this look.' };
  const cost = transmogCost(equipped);
  const checkpoint = sim.captureCheckpoint();
  const character = checkpoint.character as TransmoggedSheet;
  if (!spendGold(character, cost)) return { ok: false, message: 'Not enough gold.' };
  // Stale entries (sold or dropped sources) are swept while the map is open.
  const transmog = { ...pruneTransmog(character), [slot]: source.id };
  character.transmog = transmog;
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. No gold was spent.' };
  p.character = checkpoint.character;
  refreshCharacter(p);
  const message = `${itemDisplayName(equipped)} now appears as ${itemDisplayName(source)} · ${formatWalletCompact(cost)}`;
  pushChatMessage(p, 'system', message, sim.time);
  return { ok: true, message };
}

/** Restore a slot's true appearance. Free, like WoW's restore. */
export async function executeTransmogClear(sim: Simulation, slot: EquipmentSlot, persist: Persist): Promise<ActionResult> {
  const p = sim.player;
  if (!transmogEnabled()) return { ok: false, message: 'Transmogrification is not available.' };
  if (p.dead) return { ok: false, message: 'Cannot transmogrify while defeated.' };
  const current = (p.character as TransmoggedSheet).transmog?.[slot];
  if (!current) return { ok: false, message: 'That slot already shows its true appearance.' };
  const checkpoint = sim.captureCheckpoint();
  const character = checkpoint.character as TransmoggedSheet;
  const transmog = { ...character.transmog };
  delete transmog[slot];
  character.transmog = Object.keys(transmog).length ? transmog : undefined;
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. The look was not restored.' };
  p.character = checkpoint.character;
  refreshCharacter(p);
  const equipped = p.character.equipped[slot];
  const message = `${DURABILITY_SLOT_NAMES[slot]} restored to its true appearance${equipped ? ` — ${itemDisplayName(equipped)}` : ''}.`;
  pushChatMessage(p, 'system', message, sim.time);
  return { ok: true, message };
}
