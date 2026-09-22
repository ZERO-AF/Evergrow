/** Title state (docs/wow-deepening.md — identity wave): pure helpers on a
 * carrier. `earnedTitles` derives which titles the player qualifies for from
 * the achievement ledger, reputation standings, quest receipts, level and
 * arena rating — nothing is recorded per title; `CharacterSheet.title` holds
 * only the equipped pick. Mirrors the achievement/reputation ledger
 * conventions so save validation stays simple. */
import { achievementComplete } from './achievement-state.ts';
import { standingIndex, standingOf, type ReputationCarrier } from './reputation-state.ts';
import { isFactionId } from './reputation-content.ts';
import { WOW_RACES } from './wow-races.ts';
import { isWowRaceId, type PlayerFaction, type WowRaceId } from './wow-types.ts';
import type { ActionResult } from './character-types.ts';
import { TITLE_BY_ID, TITLES, type TitleDef } from './title-content.ts';

/** Anything carrying the fields titles read: the live player or a staged
 * checkpoint-shaped record. */
export interface TitleCarrier extends ReputationCarrier {
  name?: string;
  level?: number;
  achievements?: Record<string, number>;
  quests?: Record<string, { status: string }>;
  character: { title?: string; raceId?: WowRaceId; arenaRating?: number };
}

const factionOf = (carrier: TitleCarrier): PlayerFaction | undefined => {
  const raceId = carrier.character.raceId;
  return raceId && isWowRaceId(raceId) ? WOW_RACES[raceId].faction : undefined;
};

const exalted = standingIndex('exalted');
const exaltedCount = (carrier: TitleCarrier): number =>
  // The ledger also carries `claimed:` reward markers; only real factions count.
  Object.keys(carrier.reputation ?? {}).filter(isFactionId)
    .filter(id => standingIndex(standingOf(carrier, id).tier) >= exalted)
    .length;

/** Whether the carrier qualifies for the title right now. */
export function titleEarned(carrier: TitleCarrier, def: TitleDef): boolean {
  if (def.faction && factionOf(carrier) !== def.faction) return false;
  const source = def.source;
  switch (source.kind) {
    case 'achievement': return achievementComplete(carrier.achievements, source.id);
    case 'reputation': return source.factions.every(id => standingIndex(standingOf(carrier, id).tier) >= standingIndex(source.standing));
    case 'exalted': return exaltedCount(carrier) >= source.count;
    case 'quest': return carrier.quests?.[source.id]?.status === 'turnedIn';
    case 'level': return (carrier.level ?? 0) >= source.level;
    case 'pvpRating': return (carrier.character.arenaRating ?? 0) >= source.rating;
  }
}

/** Titles the carrier currently qualifies for, in registry order. */
export function earnedTitles(carrier: TitleCarrier): TitleDef[] {
  return TITLES.filter(def => titleEarned(carrier, def));
}

/** The equipped title definition, or undefined when none/unknown. */
export function equippedTitle(carrier: TitleCarrier): TitleDef | undefined {
  const id = carrier.character.title;
  return id === undefined ? undefined : TITLE_BY_ID[id];
}

/** Equip an earned title, or clear the slot with null. Pure mutation on the
 * carrier's sheet; the caller's durable path persists it. */
export function equipTitle(carrier: TitleCarrier, id: string | null): ActionResult {
  if (id === null) {
    carrier.character.title = undefined;
    return { ok: true, message: 'Title cleared.' };
  }
  const def = TITLE_BY_ID[id];
  if (!def) return { ok: false, message: 'Unknown title.' };
  if (!titleEarned(carrier, def)) return { ok: false, message: 'You have not earned that title.' };
  carrier.character.title = id;
  return { ok: true, message: `Title changed: ${def.name.replace('%s', carrier.name ?? 'Wayfarer')}` };
}

/** The character name with the equipped title folded in ('%s' → name). */
export function displayName(carrier: TitleCarrier): string {
  const name = carrier.name ?? 'Wayfarer';
  const title = equippedTitle(carrier);
  return title ? title.name.replace('%s', name) : name;
}
