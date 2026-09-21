/** Alliance/Horde faction layer (wayfinder world-t05).
 * Race → faction → authored starting zone; entity faction tags; the hostility
 * matrix the spawn and AI layers resolve against the player's faction.
 *
 * Two faction vocabularies exist upstream and stay distinct here:
 * - `world-atlas.ts` `FactionId` — territorial control of zones/cities/docks
 *   (includes 'contested', a zone-only value).
 * - `reputation-content.ts` `FactionId` — the standing ledger's factions.
 * This module owns the *entity* tag (`FactionTag`, no 'contested') and the
 * player axis (`PlayerFaction` from wow-types). */
import { zoneAt, zonePoint, type AtlasPoint, type AtlasZone, type FactionId as AtlasFactionId } from './world-atlas.ts';
import { WOW_RACES } from './wow-races.ts';
import type { WowRaceId, PlayerFaction } from './wow-types.ts';
import { FACTION_BY_ID, type FactionId as ReputationFactionId } from './reputation-content.ts';
import { GAME_FEATURES } from './game-features.ts';

// ── Tags ─────────────────────────────────────────────────────────────────────
/** Faction tag carried by entities (NPCs, guards, mobs). 'contested' is a
 * territorial attribute, never an entity tag — contested ground resolves to
 * 'neutral' here. 'hostile' marks always-hostile actors (Scourge, wildlife). */
export type FactionTag = Exclude<AtlasFactionId, 'contested'>;
export const FACTION_TAGS: readonly FactionTag[] = Object.freeze(['alliance', 'horde', 'neutral', 'hostile']);
export function isFactionTag(value: unknown): value is FactionTag {
  return typeof value === 'string' && (FACTION_TAGS as readonly string[]).includes(value);
}

/** How an entity treats the player: hostile attacks on sight, neutral retaliates
 * only when struck, friendly never fights the player (and can't be attacked). */
export type FactionHostility = 'hostile' | 'neutral' | 'friendly';

// ── Race → faction → start zone ──────────────────────────────────────────────
export interface RaceStart {
  /** Atlas zone id containing the spawn. */
  readonly zone: string;
  /** Named starting area (Northshire Abbey, Valley of Trials…). */
  readonly area: string;
  /** Normalized 0..1 position inside the zone rect. */
  readonly nx: number;
  readonly ny: number;
}

/** WotLK starting areas at atlas positions. Zones are pinned by world-atlas;
 * nx/ny land on each race's canonical starting village/valley. The faction is
 * derived from WowRaceDef.faction — one source of truth. */
export const RACE_STARTS: Readonly<Record<WowRaceId, RaceStart>> = Object.freeze({
  human:    Object.freeze({ zone: 'elwynn',     area: 'Northshire Abbey',   nx: 0.50, ny: 0.35 }),
  dwarf:    Object.freeze({ zone: 'dun-morogh', area: 'Coldridge Valley',   nx: 0.28, ny: 0.72 }),
  gnome:    Object.freeze({ zone: 'dun-morogh', area: 'Gnomeregan',         nx: 0.27, ny: 0.45 }),
  nightElf: Object.freeze({ zone: 'teldrassil', area: 'Shadowglen',         nx: 0.62, ny: 0.30 }),
  draenei:  Object.freeze({ zone: 'azuremyst',  area: 'Ammen Vale',         nx: 0.72, ny: 0.42 }),
  orc:      Object.freeze({ zone: 'durotar',    area: 'Valley of Trials',   nx: 0.45, ny: 0.72 }),
  troll:    Object.freeze({ zone: 'durotar',    area: 'Sen\'jin Village',   nx: 0.55, ny: 0.80 }),
  tauren:   Object.freeze({ zone: 'mulgore',    area: 'Red Cloud Mesa',     nx: 0.45, ny: 0.82 }),
  undead:   Object.freeze({ zone: 'tirisfal',   area: 'Deathknell',         nx: 0.30, ny: 0.62 }),
  bloodElf: Object.freeze({ zone: 'eversong',   area: 'Sunstrider Isle',    nx: 0.38, ny: 0.20 }),
});

/** The race's faction; the static field on WowRaceDef is the source of truth. */
export function raceFaction(raceId: WowRaceId): PlayerFaction {
  return WOW_RACES[raceId].faction;
}

/** A player's faction from their character sheet race. */
export function playerFaction(player: { character: { raceId: WowRaceId } }): PlayerFaction {
  return raceFaction(player.character.raceId);
}

export interface StartingZone {
  readonly faction: PlayerFaction;
  /** The atlas zone the spawn lands in. */
  readonly zone: AtlasZone;
  readonly area: string;
  /** World-space spawn point inside the zone rect. */
  readonly spawn: AtlasPoint;
}

/** The race's authored starting zone + world-space spawn point. */
export function startingZone(raceId: WowRaceId): StartingZone {
  const start = RACE_STARTS[raceId];
  const spawn = zonePoint(start.zone, start.nx, start.ny)!;
  return { faction: raceFaction(raceId), zone: zoneAt(spawn.x, spawn.y)!, area: start.area, spawn };
}

// ── Territory ────────────────────────────────────────────────────────────────
/** Radius (units) around an atlas city anchor where its faction tags entities —
 * city guards patrol their walls, not the whole zone. */
export const CITY_FACTION_RADIUS = 3000;

/** Faction tag for a world point: the nearest city anchor inside its radius wins
 * (enemy cities in contested zones are dangerous); otherwise the zone's
 * territorial faction, with 'contested' resolving to 'neutral'. Ocean/unmapped
 * points are 'neutral'. */
export function factionAt(x: number, y: number): FactionTag {
  const zone = zoneAt(x, y);
  if (!zone) return 'neutral';
  let best = Infinity, tag: FactionTag | null = null;
  for (const city of zone.cities) {
    const p = zonePoint(zone.id, city.nx, city.ny)!;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= CITY_FACTION_RADIUS && d < best) { best = d; tag = city.faction === 'contested' ? 'neutral' : city.faction; }
  }
  return tag ?? (zone.faction === 'contested' ? 'neutral' : zone.faction);
}

// ── Hostility ────────────────────────────────────────────────────────────────
/** Entity-vs-player hostility. Opposing factions are hostile on sight; same
 * faction is friendly; 'neutral' never opens a fight; 'hostile' (or an untagged
 * mob) always attacks. */
export function factionHostility(entity: FactionTag | undefined, player: PlayerFaction): FactionHostility {
  if (entity === undefined || entity === 'hostile') return 'hostile';
  if (entity === 'neutral') return 'neutral';
  return entity === player ? 'friendly' : 'hostile';
}

/** Hostility of a spawned enemy toward a player (resolves the player's race). */
export function enemyHostility(enemy: { faction?: FactionTag }, player: { character: { raceId: WowRaceId } }): FactionHostility {
  return factionHostility(enemy.faction, playerFaction(player));
}

/** True when the enemy actively hunts this player (opposing faction or hostile
 * tag). Neutral and friendly actors never aggro on sight. */
export function enemyHuntsPlayer(enemy: { faction?: FactionTag }, player: { character: { raceId: WowRaceId } }): boolean {
  return !GAME_FEATURES.factions || enemyHostility(enemy, player) === 'hostile';
}

/** True when the player may target/damage the actor — friendly faction NPCs are
 * unattackable like WoW's green-name guards and vendors. */
export function playerCanAttack(enemy: { faction?: FactionTag }, player: { character: { raceId: WowRaceId } }): boolean {
  return !GAME_FEATURES.factions || enemyHostility(enemy, player) !== 'friendly';
}

// ── Reputation axis ──────────────────────────────────────────────────────────
/** The Alliance/Horde axis a reputation faction rides on, or 'neutral'. The
 * ledger keeps its 9 flat factions; `FactionDef.axis` maps them onto the war —
 * Stormwind is Alliance, the Warsong Outriders are Horde, the rest are neutral. */
export function reputationAxis(id: ReputationFactionId): PlayerFaction | 'neutral' {
  return FACTION_BY_ID[id].axis ?? 'neutral';
}
