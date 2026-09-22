/** Championing tabard state (docs/wow-deepening.md — identity wave): pure
 * reads over the equipped cloak. reputation-state.ts consumes
 * `championedFaction` to redirect kill and dungeon-clear reputation; no
 * mutation and no persistence — `Item.tabardFaction` rides the character
 * sheet like any other item field. */
import type { Item } from './character-types.ts';
import { isFactionId, type FactionId } from './reputation-content.ts';

/** Anything carrying an equipment map: the live player (`player.character`)
 * or a staged checkpoint's sheet. */
export interface TabardCarrier {
  character?: { equipped?: { cloak?: Item | null } };
}

/** The equipped cloak when it is a championing tabard, else undefined. */
export function equippedTabard(carrier: TabardCarrier): Item | undefined {
  const cloak = carrier.character?.equipped?.cloak;
  return cloak?.tabardFaction !== undefined ? cloak : undefined;
}

/** The faction the worn tabard champions, else undefined. Malformed
 * `tabardFaction` values (e.g. from a hand-edited save) are ignored. */
export function championedFaction(carrier: TabardCarrier): FactionId | undefined {
  const faction = equippedTabard(carrier)?.tabardFaction;
  return isFactionId(faction) ? faction : undefined;
}
