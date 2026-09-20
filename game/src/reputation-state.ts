/** Reputation ledger state (docs/wow-deepening.md — second wave): pure
 * bookkeeping on `player.reputation`. No world access beyond the small
 * resolution helpers, no persistence — reputation-command.ts owns the durable
 * reward-claim path; kill/quest/dungeon gains mutate the live ledger and ride
 * the next checkpoint (same convention as quest progress).
 *
 * Persisted shape: `player.reputation` is a flat Record<string, number>:
 * - `reputation[factionId]` — absolute points (Neutral = 0, Exalted cap 42999).
 * - `reputation['claimed:<factionId>:<rewardId>']` — 1 once a reward is claimed.
 * Mirrors the achievements ledger convention so save validation stays simple. */
import { GAME_FEATURES } from './game-features.ts';
import { sampleBiome } from './biomes.ts';
import { isBossKind } from './wilderness-boss-content.ts';
import type { Enemy } from './model.ts';
import type { DungeonThemeId } from './dungeon-content.ts';
import type { TownNPC } from './npcs.ts';
import type { QuestDef } from './quest-content.ts';
import {
  EXALTED_CAP, FACTIONS, FACTION_BY_ID, HATED_FLOOR, KILL_REP, STANDINGS,
  STANDING_BY_TIER, STANDING_DISCOUNT,
  type FactionDef, type FactionId, type FactionReward, type StandingDef, type StandingTier,
} from './reputation-content.ts';

export type ReputationLedger = Record<string, number>;
/** Anything carrying the ledger: the live player or a staged checkpoint. */
export interface ReputationCarrier { reputation?: ReputationLedger }

/** Reads the integrator-added flag; defaults to on until it lands. */
export function reputationEnabled(): boolean {
  return 'reputation' in GAME_FEATURES ? GAME_FEATURES.reputation === true : true;
}

export function reputationPoints(carrier: ReputationCarrier, id: FactionId): number {
  return carrier.reputation?.[id] ?? FACTION_BY_ID[id].initial ?? 0;
}

/** Standing the points fall inside (Neutral = 0; Exalted caps at 42999). */
export function standingAt(points: number): StandingDef {
  let standing = STANDINGS[0];
  for (const def of STANDINGS) if (points >= def.min) standing = def;
  return standing;
}
export function standingOf(carrier: ReputationCarrier, id: FactionId): StandingDef {
  return standingAt(reputationPoints(carrier, id));
}
export function standingIndex(tier: StandingTier): number {
  return STANDINGS.indexOf(STANDING_BY_TIER[tier]);
}

/** Progress inside the current standing tier for the panel bar. */
export function standingProgress(carrier: ReputationCarrier, id: FactionId): { points: number; standing: StandingDef; into: number; span: number; next?: StandingDef } {
  const points = reputationPoints(carrier, id), standing = standingAt(points);
  const index = STANDINGS.indexOf(standing), next = STANDINGS[index + 1];
  const span = next ? next.min - standing.min : 0;
  return { points, standing, into: next ? points - standing.min : 0, span, next };
}

/** WoW vendor discount at this standing (5/10/15/20% at Friendly+). */
export function repDiscount(carrier: ReputationCarrier, id: FactionId): number {
  return STANDING_DISCOUNT[standingOf(carrier, id).tier];
}

/** Buy-side price multiplier for a vendor NPC (1 = no discount). The integrator
 * multiplies outgoing prices by this inside commerce's quote path. */
export function repPriceAdjust(player: ReputationCarrier, npc: TownNPC, worldSeed = 7319): number {
  const faction = factionForNpc(npc, worldSeed);
  return faction ? 1 - repDiscount(player, faction.id) : 1;
}

// ── Faction resolution ───────────────────────────────────────────────────────

const indexBy = <K extends string>(pick: (faction: FactionDef) => readonly K[] | undefined): Readonly<Record<K, FactionDef>> =>
  Object.freeze(Object.fromEntries(FACTIONS.flatMap(faction => (pick(faction) ?? []).map(key => [key, faction]))) as Record<K, FactionDef>);

const byBiome = indexBy(faction => faction.biomes);
const byKind = indexBy(faction => faction.enemyKinds);
const byTheme = indexBy(faction => faction.dungeonThemes);
const byZone = indexBy(faction => faction.questZones);
const byQuest = indexBy(faction => faction.quests);
const byRaid = indexBy(faction => faction.raidIds);
const homeFaction = FACTIONS.find(faction => faction.homeSettlement);

/** The faction a slain enemy credits: dungeon theme first (the run's faction),
 * then Scourge-style enemy kinds (Argent Crusade anywhere), then the biome. */
export function factionForKill(enemy: Pick<Enemy, 'kind' | 'biome'> & { dungeonTheme?: DungeonThemeId }): FactionDef | undefined {
  return (enemy.dungeonTheme && byTheme[enemy.dungeonTheme]) ?? byKind[enemy.kind] ?? byBiome[enemy.biome];
}

/** The faction a quest turn-in credits: explicit quest map → zone label →
 * the giver's biome. */
export function factionForQuest(def: QuestDef): FactionDef | undefined {
  return byQuest[def.id] ?? (def.zone && byZone[def.zone]) ?? (def.giverBiome && byBiome[def.giverBiome]);
}

/** The faction a dungeon/raid clear credits: raid entrance id → theme. */
export function factionForDungeon(entrance: { id: string; theme?: DungeonThemeId }): FactionDef | undefined {
  return byRaid[entrance.id] ?? (entrance.theme && byTheme[entrance.theme]);
}

/** The faction a vendor NPC belongs to: the home settlement's faction for the
 * starting town (building id `town:<seed>:0:building:<i>:<role>`), else the
 * NPC's biome. */
export function factionForNpc(npc: Pick<TownNPC, 'buildingId' | 'x' | 'y'>, worldSeed = 7319): FactionDef | undefined {
  if (homeFaction && Number(npc.buildingId.split(':')[2]) === 0) return homeFaction;
  return byBiome[sampleBiome(npc.x, npc.y, worldSeed).id];
}

// ── Gains ────────────────────────────────────────────────────────────────────

export interface RepGain {
  readonly faction: FactionDef;
  readonly amount: number;
  readonly applied: number;
  readonly points: number;
  readonly standing: StandingDef;
  /** Set when this gain crossed into a new standing tier. */
  readonly changed?: StandingDef;
}

/** Add points to one faction's ledger; returns the applied gain (0 at cap). */
export function applyReputation(carrier: ReputationCarrier, id: FactionId, amount: number, maxPoints = EXALTED_CAP): RepGain {
  const faction = FACTION_BY_ID[id];
  const before = reputationPoints(carrier, id);
  const after = Math.max(HATED_FLOOR, Math.min(maxPoints, before + amount));
  const applied = after - before;
  if (applied !== 0) (carrier.reputation ??= {})[id] = after;
  const prior = standingAt(before), standing = standingAt(after);
  return { faction, amount, applied, points: after, standing, changed: standing !== prior ? standing : undefined };
}

/** Apply a kill's reputation (rank-scaled; bosses pay `KILL_REP.boss`); returns
 * undefined when no faction claims the kill or its kill cap is reached. */
export function applyKillReputation(carrier: ReputationCarrier, enemy: Pick<Enemy, 'kind' | 'biome' | 'rank'> & { dungeonTheme?: DungeonThemeId }): RepGain | undefined {
  const faction = factionForKill(enemy);
  if (!faction) return undefined;
  const capMin = STANDING_BY_TIER[faction.killCap ?? 'revered'].min;
  if (reputationPoints(carrier, faction.id) >= capMin) return undefined;
  const amount = isBossKind(enemy.kind) ? KILL_REP.boss : KILL_REP[enemy.rank];
  return applyReputation(carrier, faction.id, amount, capMin);
}

// ── Rewards ──────────────────────────────────────────────────────────────────

const claimKey = (faction: FactionId, reward: string) => `claimed:${faction}:${reward}`;

export function rewardClaimed(carrier: ReputationCarrier, faction: FactionId, reward: FactionReward): boolean {
  return (carrier.reputation?.[claimKey(faction, reward.id)] ?? 0) > 0;
}

/** Why a reward cannot be claimed, or null when it can. */
export function rewardProblem(carrier: ReputationCarrier, faction: FactionDef, reward: FactionReward): string | null {
  if (rewardClaimed(carrier, faction.id, reward)) return 'Already claimed.';
  const standing = standingOf(carrier, faction.id);
  if (standingIndex(standing.tier) < standingIndex(reward.standing))
    return `Requires ${STANDING_BY_TIER[reward.standing].label} with ${faction.name}.`;
  return null;
}

/** Mark a reward claimed on any carrier (live player or staged checkpoint). */
export function stageClaim(carrier: ReputationCarrier, faction: FactionId, reward: FactionReward): void {
  (carrier.reputation ??= {})[claimKey(faction, reward.id)] = 1;
}

/** Factions the player has any standing with, for the panel's "known" section. */
export function knownFactions(carrier: ReputationCarrier): readonly FactionDef[] {
  return FACTIONS.filter(faction => carrier.reputation?.[faction.id] !== undefined);
}
