/** Quest ledger state (docs/wow-deepening.md §1): pure progress bookkeeping on
 * `player.quests`. No world access, no persistence — quest-command.ts owns the
 * durable accept/turn-in path; this file only mutates a ledger object. */
import type { Player } from './model.ts';
import type { EnemyKind } from './model.ts';
import { GAME_FEATURES } from './game-features.ts';
import {
  QUESTS, QUEST_PREV, QUEST_ITEMS, QUEST_BY_ID, giverSpec, turnInSpec, questGiverKey,
  type QuestDef, type QuestGiver, type QuestId, type QuestObjective, type QuestState,
} from './quest-content.ts';
/** Quests offered a little early, WoW-style: the marker shows before the level gate. */
export const QUEST_RULES = Object.freeze({
  /** NPC/POI offers appear this many levels below the quest's authored level. */
  previewBelowLevel: 2,
  /** Interact reach for POI givers (posters, sites). */
  poiReach: 140,
  /** Explore objectives credit POIs inside this radius of the player. */
  exploreRadius: 420,
  /** Map-marker search rings around the player (world units). */
  markerScan: [4200, 9000, 16000] as readonly number[],
});

export type QuestLedger = Record<string, QuestState>;
export interface QuestsCarrier { quests?: QuestLedger }

export function questsEnabled(): boolean { return GAME_FEATURES.quests; }

export function questState(player: QuestsCarrier, id: QuestId): QuestState | undefined {
  return player.quests?.[id];
}

/** A quest can be offered once its chain prerequisite is turned in (chain heads have none). */
export function questUnlocked(player: QuestsCarrier, def: QuestDef): boolean {
  const prev = QUEST_PREV[def.id];
  return prev === undefined || player.quests?.[prev]?.status === 'turnedIn';
}

/** Offerable right now: unlocked, not yet accepted, and the player meets the level. */
export function questAvailable(player: Player, def: QuestDef): boolean {
  return questUnlocked(player, def) && player.quests?.[def.id] === undefined && player.level >= def.level;
}
/** Within the preview window: unlocked and unaccepted, but under-level (gray `!`). */
export function questPreviewable(player: Player, def: QuestDef): boolean {
  return questUnlocked(player, def) && player.quests?.[def.id] === undefined
    && player.level >= def.level - QUEST_RULES.previewBelowLevel && player.level < def.level;
}

export function objectiveDone(state: QuestState, def: QuestDef, index: number): boolean {
  return (state.progress[index] ?? 0) >= (def.objectives[index]?.count ?? 0);
}
export function questObjectivesMet(state: QuestState, def: QuestDef): boolean {
  return def.objectives.every((_, i) => objectiveDone(state, def, i));
}

/** Display line for one objective ("Riverpaw gnolls slain: 3/8"). */
export function objectiveText(objective: QuestObjective, progress: number): string {
  return `${objective.label ?? objective.target}: ${Math.min(progress, objective.count)}/${objective.count}`;
}

/** Reward item display name: material name, gear slot label, or quest-item name. */
export function questItemName(id: string): string {
  if (id.startsWith('gear:')) return `${id.slice(5)} (equipment)`;
  return QUEST_ITEMS[id] ?? id;
}

/** Ledger entries grouped for the log panel. */
export function questLog(player: QuestsCarrier): { active: QuestDef[]; complete: QuestDef[]; turnedIn: QuestDef[] } {
  const active: QuestDef[] = [], complete: QuestDef[] = [], turnedIn: QuestDef[] = [];
  for (const def of QUESTS) {
    const status = player.quests?.[def.id]?.status;
    if (status === 'active') active.push(def);
    else if (status === 'complete') complete.push(def);
    else if (status === 'turnedIn') turnedIn.push(def);
  }
  return { active, complete, turnedIn };
}

// ── Dailies (WotLK repeatables; docs/wow-deepening.md §1) ────────────────────

/** UTC day number for an epoch-ms instant — the daily reset boundary. */
export function dailyResetKey(now: number): number {
  return Math.floor(now / 86400000);
}

/** Seconds until the next UTC midnight (for the "resets in …" countdown). */
export function dailyResetCountdown(now: number): number {
  return 86400 - Math.floor(now / 1000) % 86400;
}

/** "23h 59m" countdown label for the quest log. */
export function dailyResetLabel(now: number): string {
  const totalMinutes = Math.ceil(dailyResetCountdown(now) / 60);
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

/** A turned-in daily whose stamp predates today's UTC boundary is due to reset.
 * A missing stamp (legacy save) counts as a prior day — the quest re-offers. */
export function dailyResettable(state: QuestState | undefined, now: number): boolean {
  return state?.status === 'turnedIn'
    && (state.lastCompletedAt === undefined || dailyResetKey(state.lastCompletedAt * 1000) < dailyResetKey(now));
}

/** Daily defs the player can pick up today: not held, or turned in on a prior
 * UTC day (the ledger entry still sits there until `resetDailies` sweeps it). */
export function availableDailies(player: Player, now: number): readonly QuestDef[] {
  if (!GAME_FEATURES.dailyQuests) return [];
  return QUESTS.filter(def => def.daily && questUnlocked(player, def) && player.level >= def.level
    && (player.quests?.[def.id] === undefined || dailyResettable(player.quests[def.id], now)));
}

/** Sweep stale daily receipts: a daily turned in before today's UTC boundary
 * loses its ledger entry (status, progress and visited all clear), so the giver
 * offers it again. Idempotent within a day; returns the defs reset. */
export function resetDailies(player: QuestsCarrier, now = Date.now()): readonly QuestDef[] {
  if (!GAME_FEATURES.dailyQuests || !player.quests) return [];
  const reset: QuestDef[] = [];
  for (const def of QUESTS) {
    if (!def.daily) continue;
    if (dailyResettable(player.quests[def.id], now)) {
      delete player.quests[def.id];
      reset.push(def);
    }
  }
  return reset;
}

// ── Progress application (live ledger; persisted by the next checkpoint) ─────

export interface QuestProgressNote {
  readonly quest: QuestDef;
  readonly objective: QuestObjective;
  readonly index: number;
  readonly progress: number;
  /** Set when this note flipped the quest to 'complete'. */
  readonly completed: boolean;
}

function bump(ledger: QuestLedger, def: QuestDef, index: number, amount: number, notes: QuestProgressNote[]): void {
  const state = ledger[def.id];
  const objective = def.objectives[index];
  if (!state || state.status !== 'active' || !objective) return;
  const before = state.progress[index] ?? 0;
  if (before >= objective.count) return;
  state.progress[index] = Math.min(objective.count, before + amount);
  if (questObjectivesMet(state, def)) state.status = 'complete';
  notes.push({ quest: def, objective, index, progress: state.progress[index], completed: state.status === 'complete' });
}

function eachActive(player: QuestsCarrier, fn: (ledger: QuestLedger, def: QuestDef, state: QuestState) => void): void {
  const ledger = player.quests;
  if (!ledger) return;
  for (const def of QUESTS) {
    const state = ledger[def.id];
    if (state?.status === 'active') fn(ledger, def, state);
  }
}

/** Kill credit: 'kill'/'boss' objectives match the enemy kind; 'collect' objectives
 * roll their drop chance against the objective's `dropFrom` kind. */
export function applyKill(player: QuestsCarrier, kind: EnemyKind, random: () => number = Math.random): QuestProgressNote[] {
  const notes: QuestProgressNote[] = [];
  eachActive(player, (ledger, def) => {
    def.objectives.forEach((objective, i) => {
      if ((objective.kind === 'kill' || objective.kind === 'boss') && objective.target === kind)
        bump(ledger, def, i, 1, notes);
      else if (objective.kind === 'collect' && objective.dropFrom === kind && random() < (objective.dropChance ?? 1))
        bump(ledger, def, i, 1, notes);
    });
  });
  return notes;
}

/** Pickup/gather credit: 'collect' objectives whose target is a real item or
 * material id (virtual drop items never reach this path — kills credit them). */
export function applyCollect(player: QuestsCarrier, itemId: string, count = 1): QuestProgressNote[] {
  const notes: QuestProgressNote[] = [];
  eachActive(player, (ledger, def) => {
    def.objectives.forEach((objective, i) => {
      if (objective.kind === 'collect' && !objective.dropFrom && objective.target === itemId)
        bump(ledger, def, i, count, notes);
    });
  });
  return notes;
}

/** Explore credit: counts a POI once per objective (dedupe via `state.visited`). */
export function applyExplore(player: QuestsCarrier, poi: { id: string; kind: string }): QuestProgressNote[] {
  const notes: QuestProgressNote[] = [];
  eachActive(player, (ledger, def, state) => {
    def.objectives.forEach((objective, i) => {
      if (objective.kind !== 'explore' || objective.target !== poi.kind) return;
      const key = `${i}:${poi.id}`;
      if (state.visited?.includes(key)) return;
      (state.visited ??= []).push(key);
      bump(ledger, def, i, 1, notes);
    });
  });
  return notes;
}

/** Accept staging: writes the ledger entry on any carrier (live player or checkpoint). */
export function stageAccept(carrier: QuestsCarrier, def: QuestDef): void {
  (carrier.quests ??= {})[def.id] = {
    status: def.objectives.length ? 'active' : 'complete',
    progress: def.objectives.map(() => 0),
  };
}
export function stageAbandon(carrier: QuestsCarrier, id: QuestId): void {
  if (carrier.quests && carrier.quests[id]?.status !== 'turnedIn') delete carrier.quests[id];
}
export function stageTurnIn(carrier: QuestsCarrier, id: QuestId, now?: number): void {
  const state = carrier.quests?.[id];
  if (!state) return;
  state.status = 'turnedIn';
  // Dailies stamp the wall-clock day so the UTC reset can re-offer them.
  if (QUEST_BY_ID[id]?.daily) state.lastCompletedAt = Math.floor((now ?? Date.now()) / 1000);
}

// ── Giver bucketing (shared by markers and the interact dialog) ──────────────

/** Quests grouped by the giver spec that offers or accepts them. */
export interface QuestBuckets {
  readonly spec: QuestGiver;
  /** Turned-in-ready quests (status 'complete') accepted here. */
  readonly turnIns: QuestDef[];
  /** Offerable at the player's level. */
  readonly offers: QuestDef[];
  /** Unlocked but under-level (gray `!` preview). */
  readonly upcoming: QuestDef[];
  /** Active but unfinished quests this giver accepts (gray `?`). */
  readonly pending: QuestDef[];
}

/** Fingerprint of the ledger fields that decide bucketing: which quests are
 * held and their status. Progress counts and timestamps don't move markers. */
function ledgerFingerprint(player: QuestsCarrier): string {
  const ledger = player.quests;
  if (!ledger) return '';
  let out = '';
  for (const id of Object.keys(ledger)) out += `${id}=${ledger[id]!.status};`;
  return out;
}

let bucketCache: { key: string; level: number; map: Map<string, QuestBuckets> } | null = null;

/** All giver specs with quest business for `player`, keyed by questGiverKey.
 * One pass over the quest catalog, cached on (ledger fingerprint, level) —
 * marker drawing and interact hit-testing call this several times a frame. */
export function questBuckets(player: Player): Map<string, QuestBuckets> {
  const key = ledgerFingerprint(player);
  if (bucketCache && bucketCache.key === key && bucketCache.level === player.level) return bucketCache.map;
  const map = new Map<string, QuestBuckets>();
  const bucket = (spec: QuestGiver): QuestBuckets => {
    const id = questGiverKey(spec);
    let entry = map.get(id);
    if (!entry) map.set(id, entry = { spec, turnIns: [], offers: [], upcoming: [], pending: [] });
    return entry;
  };
  for (const def of QUESTS) {
    const state = player.quests?.[def.id];
    if (state?.status === 'complete') bucket(turnInSpec(def)).turnIns.push(def);
    else if (state?.status === 'active') bucket(turnInSpec(def)).pending.push(def);
    else if (!state) {
      if (questAvailable(player, def)) bucket(giverSpec(def)).offers.push(def);
      else if (questPreviewable(player, def)) bucket(giverSpec(def)).upcoming.push(def);
    }
  }
  bucketCache = { key, level: player.level, map };
  return map;
}

