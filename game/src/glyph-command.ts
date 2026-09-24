import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { ActionResult, Item } from './character-types.ts';
import { GAME_FEATURES } from './game-features.ts';
import { GLYPHS, createGlyphItem, glyphDefinition, glyphItemId, type GlyphDef, type GlyphSlot } from './glyph-content.ts';
import { glyphSocketProblem, glyphSocketTarget } from './glyph-state.ts';
import { addInventoryItem } from './inventory.ts';
import { refreshCharacter } from './character.ts';
import { spendGold } from './wallet.ts';
import { itemPrice } from './commerce.ts';
import { canInteractNPC, type TownNPC } from './npcs.ts';
import { pushChatMessage } from './chat-log.ts';
import { commitPurchase } from './vendor-buy.ts';

/** Checkpoint extension carrying socketed glyphs; the integrator adds `glyphs` to
 * captureCheckpoint/restoreCheckpoint so the field round-trips through saves. */
export type GlyphCheckpoint = CharacterCheckpoint & { glyphs?: Simulation['player']['glyphs'] };
type Persist = (checkpoint: CharacterCheckpoint) => Promise<ActionResult>;

/** Enchanter NPCs stock every glyph (WotLK inscription vendors). */
export function glyphVendorStock(npc: Pick<TownNPC, 'role'>): readonly GlyphDef[] {
  return GAME_FEATURES.glyphs && npc.role === 'enchanter' ? GLYPHS : [];
}
export const glyphPrice = (def: GlyphDef): number => itemPrice(createGlyphItem(def.id, 0), 'buy');

/** Inscribe a glyph item from the bag into the first unlocked matching slot.
 * A displaced glyph returns to the bag; if it cannot fit, it is destroyed (WotLK overwrite). */
export async function executeGlyphSocket(sim: Simulation, inventoryIndex: number, persist: Persist): Promise<ActionResult> {
  const p = sim.player;
  if (!GAME_FEATURES.glyphs) return { ok: false, message: 'Glyphs are not available.' };
  if (p.dead) return { ok: false, message: 'Cannot inscribe glyphs while defeated.' };
  const item: Item | null = Number.isInteger(inventoryIndex) ? p.character.inventory[inventoryIndex] ?? null : null;
  const glyphId = glyphItemId(item), def = glyphId ? glyphDefinition(glyphId) : undefined;
  if (!item || !def) return { ok: false, message: 'That item is not a glyph.' };
  const problem = glyphSocketProblem(p, def);
  if (problem) return { ok: false, message: problem };
  const slot = glyphSocketTarget(p, def)!;
  const checkpoint = sim.captureCheckpoint() as GlyphCheckpoint;
  checkpoint.character.inventory[inventoryIndex] = null;
  checkpoint.glyphs = { ...p.glyphs, [slot]: def.id };
  const displaced = p.glyphs?.[slot];
  let message = `Inscribed ${def.name}.`;
  if (displaced) {
    const returned = createGlyphItem(displaced, item.seed ^ 0x5f3759df);
    if (addInventoryItem(checkpoint.character, returned)) message = `Inscribed ${def.name}; ${glyphDefinition(displaced)!.name} returned to your bag.`;
    else message = `Inscribed ${def.name}; ${glyphDefinition(displaced)!.name} was destroyed.`;
  }
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. The glyph was not inscribed.' };
  p.character = checkpoint.character;
  p.glyphs = checkpoint.glyphs;
  refreshCharacter(p);
  pushChatMessage(p, 'system', message, sim.time);
  return { ok: true, message };
}

/** Remove a socketed glyph, returning its item to the bag. */
export async function executeGlyphUnsocket(sim: Simulation, slot: GlyphSlot, persist: Persist): Promise<ActionResult> {
  const p = sim.player;
  if (!GAME_FEATURES.glyphs) return { ok: false, message: 'Glyphs are not available.' };
  if (p.dead) return { ok: false, message: 'Cannot remove glyphs while defeated.' };
  const id = p.glyphs?.[slot], def = id ? glyphDefinition(id) : undefined;
  if (!def) return { ok: false, message: 'That glyph slot is empty.' };
  const checkpoint = sim.captureCheckpoint() as GlyphCheckpoint;
  if (!addInventoryItem(checkpoint.character, createGlyphItem(def.id, (sim.time * 1000) >>> 0)))
    return { ok: false, message: 'No room in your bag for the removed glyph.' };
  checkpoint.glyphs = { ...p.glyphs, [slot]: undefined };
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. The glyph stays inscribed.' };
  p.character = checkpoint.character;
  p.glyphs = checkpoint.glyphs;
  refreshCharacter(p);
  const message = `Removed ${def.name}.`;
  pushChatMessage(p, 'system', message, sim.time);
  return { ok: true, message };
}

/** Buy a glyph item from an enchanter into the bag. */
export async function executeGlyphBuy(sim: Simulation, npc: TownNPC, glyphId: string, persist: Persist): Promise<ActionResult> {
  const p = sim.player;
  if (!GAME_FEATURES.glyphs) return { ok: false, message: 'Glyphs are not available.' };
  const def = glyphDefinition(glyphId);
  if (!def || !glyphVendorStock(npc).includes(def)) return { ok: false, message: 'That glyph is not sold here.' };
  if (!canInteractNPC(npc, p, sim.world)) return { ok: false, message: 'The enchanter is no longer in reach.' };
  const price = glyphPrice(def);
  const checkpoint = sim.captureCheckpoint() as GlyphCheckpoint;
  if (!spendGold(checkpoint.character, price)) return { ok: false, message: 'Not enough gold.' };
  const item = createGlyphItem(def.id, ((checkpoint.character.commerce.operations + 1) * 0x9e3779b1 + (checkpoint.character.gold ?? 0)) >>> 0);
  if (!addInventoryItem(checkpoint.character, item)) return { ok: false, message: 'No room in your bag.' };
  checkpoint.character.commerce.operations++;
  const message = `Bought ${def.name} for ${price} gold.`;
  return commitPurchase(sim, checkpoint, persist, () => {}, message, 'Could not save. No gold was spent.', false);
}
