/** Shared tail for durable vendor purchases: every buy command validates on
 * the live player, stages the sale on a captured checkpoint, persists, then
 * commits the staged sheet back onto the player and announces the result. */
import type { Simulation } from './simulation.ts';
import type { ActionResult } from './character-types.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import { refreshCharacter } from './character.ts';
import { pushChatMessage } from './chat-log.ts';

export type VendorPersist = (checkpoint: CharacterCheckpoint) => Promise<ActionResult>;

/** Persist a staged purchase and commit it: the checkpoint's character sheet
 * becomes the player's, derived stats refresh, and the sale is announced in
 * chat. `apply` copies any extra staged fields (achievements, holiday state)
 * onto the live player; `refresh` skips the stat rebuild for buys that cannot
 * change derived stats. */
export async function commitPurchase<C extends CharacterCheckpoint>(sim: Simulation, checkpoint: C,
  persist: (checkpoint: C) => ActionResult | Promise<ActionResult>, apply: (checkpoint: C) => void,
  message: string, saveFailure: string, refresh = true): Promise<{ ok: boolean; message: string }> {
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? saveFailure };
  const p = sim.player;
  p.character = checkpoint.character;
  apply(checkpoint);
  if (refresh) refreshCharacter(p);
  pushChatMessage(p, 'loot', message, sim.time);
  return { ok: true, message };
}
