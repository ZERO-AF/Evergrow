/**
 * Dungeon Finder queue ledger (WotLK RDF): which dungeon the character is
 * queued for and when. Lives on `character.dungeonFinder` so it serializes
 * with the sheet — no checkpoint extension needed. The marker is staged by
 * queueForDungeon before the entry travel persist, so a failed or interrupted
 * entry leaves a resumable queue; a successful entry clears it again.
 */
import { GAME_FEATURES } from './game-features.ts';
import type { CharacterSheet } from './character-types.ts';
import { integer, object, text, type ObjectValue } from './item-validation.ts';
import { RDF_DUNGEONS, type DungeonFinderEntry } from './dungeon-finder-content.ts';

export interface DungeonFinderState {
  /** Catalog id (rdf:<zone>:<index>) of the queued dungeon. */
  queued?: string;
  /** Wall-clock ms when the queue was taken; display/flavor only. */
  queuedAt?: number;
  /** WotLK Heroic mode (heroic-content.ts): the queued run promotes trash one
   * rank tier and doubles boss health. Persisted so a resumed queue re-enters
   * the same difficulty. */
  heroic?: boolean;
}

/** CharacterSheet carrying the queue marker until the field lands on the interface. */
export type DungeonFinderSheet = CharacterSheet & { dungeonFinder?: DungeonFinderState };

/** Feature flag read through a tolerant lens until GAME_FEATURES.dungeonFinder lands. */
export const dungeonFinderEnabled = (): boolean =>
  (GAME_FEATURES as Record<string, boolean | undefined>).dungeonFinder ?? true;

/** The sheet's queue marker; undefined until the first queue. */
export const dungeonFinderOf = (sheet: CharacterSheet): DungeonFinderState | undefined =>
  (sheet as DungeonFinderSheet).dungeonFinder;

/** The dungeon the sheet is queued for, or undefined when idle/stale. */
export function queuedDungeon(sheet: CharacterSheet): DungeonFinderEntry | undefined {
  const id = dungeonFinderOf(sheet)?.queued;
  return id === undefined ? undefined : RDF_DUNGEONS.find(d => d.id === id);
}

/** Save validation for `character.dungeonFinder`; wired into validSheet.
 * Shape-only: an unknown catalog id is a stale queue, not a corrupt save. */
export function validDungeonFinder(v: unknown): v is DungeonFinderState {
  if (!object(v)) return false;
  const s = v as ObjectValue;
  if (s.queued === undefined && s.queuedAt === undefined && s.heroic === undefined) return true;
  return text(s.queued, 64) && integer(s.queuedAt, 0) && (s.heroic === undefined || s.heroic === true);
}
