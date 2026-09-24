/** PvP match rewards (wayfinder/pvp-t05): the durable match-end award and the
 * live per-kill honor drip.
 *
 * `awardMatchRewards` mirrors repClaimReward's checkpoint flow: stage Honor,
 * Arena Points, Warsong Outriders reputation and any reward items on ONE
 * captured checkpoint → persist → commit. Achievements are tracked on the live
 * player before the capture so they ride the same write; a failed persist
 * restores the pre-award ledger.
 *
 * Call it AFTER the match teardown restores the real save character (Custom
 * mode swaps `player.character` for a session sheet — awarding before the swap
 * back would strand the rewards on the discarded sheet). */
import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { ActionResult, Item } from './character-types.ts';
import type { AchievementDef } from './achievement-content.ts';
import { achievementTrack } from './achievement-state.ts';
import { applyReputation } from './reputation-state.ts';
import { EXALTED_CAP } from './reputation-content.ts';
import { guildHonorFactor, guildReputationFactor } from './guild-state.ts';
import { addInventoryItem } from './inventory.ts';
import { refreshCharacter } from './character.ts';
import { pushChatMessage } from './chat-log.ts';
import {
  creditArenaPoints, creditHonor, formatPvpPoints, pvpEnabled,
} from './pvp-currency.ts';
import type { PvpBracket, PvpMode } from './pvp-setup.ts';

/** Award amounts (tuned inside T05/T08 per the map). */
export const PVP_REWARDS = Object.freeze({
  /** Honor for a win / a loss, per mode. */
  arenaWin: 150, arenaLoss: 50,
  battlegroundWin: 250, battlegroundLoss: 100,
  /** Honor per honorable kill when the match end awards it (see honorFromKills). */
  honorPerKill: 20,
  /** Bonus honor per objective score (flag caps, node ticks). */
  honorPerObjective: 30,
  /** Arena Points: arena matches only, win-biased. */
  arenaPointsWin: 150, arenaPointsLoss: 25,
  /** Warsong Outriders reputation per match, win / loss. */
  repWin: 250, repLoss: 100,
});

export interface PvpMatchResult {
  readonly mode: PvpMode;
  /** Arena bracket or battleground map id from the setup (pvp-setup.ts). */
  readonly bracket: PvpBracket;
  /** Arena map id (arena-maps.ts, T06) for per-map victory achievements;
   * battlegrounds may omit it — `bracket` already is the map id there. */
  readonly map?: string;
  /** True when the player's team ('A') won. */
  readonly won: boolean;
  /** The player's honorable kills this match (achievement progress). */
  readonly kills?: number;
  /** Objective score: flag captures, node ticks, etc. */
  readonly objectives?: number;
  readonly items?: readonly Item[];
  /** True when per-kill honor already rode the live `pvpOnCombatantKill` path —
   * the match-end award then skips `kills * honorPerKill` to avoid double pay. */
  readonly honorFromKills?: boolean;
  /** Flags the player personally captured (Warsong achievement progress). */
  readonly flagCaptures?: number;
  /** True when the player's team held every Arathi node at once this match. */
  readonly heldAllNodes?: boolean;
}

/** Personal arena rating: starts at 1500, ±16 per arena result (WoW's flat
 * early ladder). Battlegrounds never touch it. */
export const PVP_RATING_START = 1500;
export const PVP_RATING_STEP = 16;
export function nextArenaRating(current: number | undefined, result: PvpMatchResult): number {
  if (result.mode !== 'arena') return current ?? PVP_RATING_START;
  return Math.max(0, (current ?? PVP_RATING_START) + (result.won ? PVP_RATING_STEP : -PVP_RATING_STEP));
}

export interface PvpAwardResult extends ActionResult {
  /** Honor credited by this call (0 when the persist failed). */
  readonly honor: number;
  /** Arena Points credited by this call. */
  readonly arenaPoints: number;
  /** Warsong Outriders reputation applied by this call. */
  readonly reputation: number;
  /** Achievements unlocked by the match event (for toasts). */
  readonly unlocked: readonly AchievementDef[];
}

type PvpPersist = (checkpoint: CharacterCheckpoint) => Promise<ActionResult>;
/** Checkpoint extension carrying the ledgers this award stages (both already on
 * the sim's WowCheckpoint): achievements and the reputation ledger. */
type PvpAwardCheckpoint = CharacterCheckpoint & {
  achievements?: Record<string, number>;
  reputation?: Record<string, number>;
};

/** Live path: honor for one honorable kill, credited immediately like repOnKill.
 * The match controller calls this per enemy combatant death and then passes
 * `honorFromKills: true` in the PvpMatchResult so the end award skips them. */
export function pvpOnCombatantKill(sim: Simulation): number {
  if (!pvpEnabled()) return 0;
  const honor = Math.round(PVP_REWARDS.honorPerKill * guildHonorFactor(sim.player));
  if (!creditHonor(sim.player.character, honor)) return 0;
  pushChatMessage(sim.player, 'system', `+${honor} Honor`, sim.time);
  return honor;
}

/** Pure reward math for a finished match — the scoreboard shows this before the
 * durable `awardMatchRewards` commits it. No mutation, no persist. */
export function previewMatchRewards(sim: Simulation, result: PvpMatchResult): { honor: number; arenaPoints: number; reputation: number } {
  const p = sim.player;
  const kills = Math.max(0, Math.floor(result.kills ?? 0));
  const objectives = Math.max(0, Math.floor(result.objectives ?? 0));
  const honor = Math.round(((result.won
    ? result.mode === 'arena' ? PVP_REWARDS.arenaWin : PVP_REWARDS.battlegroundWin
    : result.mode === 'arena' ? PVP_REWARDS.arenaLoss : PVP_REWARDS.battlegroundLoss)
    + (result.honorFromKills ? 0 : kills * PVP_REWARDS.honorPerKill)
    + objectives * PVP_REWARDS.honorPerObjective) * guildHonorFactor(p));
  const arenaPoints = result.mode === 'arena'
    ? result.won ? PVP_REWARDS.arenaPointsWin : PVP_REWARDS.arenaPointsLoss
    : 0;
  // Warsong Outriders rep is a battleground reward; arenas pay rating, not rep.
  const reputation = result.mode === 'battleground' ? (result.won ? PVP_REWARDS.repWin : PVP_REWARDS.repLoss) : 0;
  return { honor, arenaPoints, reputation };
}

/** The durable match-end award: currency + reputation + items in one checkpoint. */
export async function awardMatchRewards(sim: Simulation, result: PvpMatchResult, persist: PvpPersist): Promise<PvpAwardResult> {
  const none = { honor: 0, arenaPoints: 0, reputation: 0, unlocked: [] as const };
  if (!pvpEnabled()) return { ...none, ok: false, message: 'PvP is not available.' };
  const p = sim.player;
  const { honor, arenaPoints, reputation: rep } = previewMatchRewards(sim, result);
  const kills = Math.max(0, Math.floor(result.kills ?? 0));

  // Achievements track on the live player so they are captured with the award;
  // a failed persist restores the pre-award ledger. Arena rating is computed
  // here (the durable award owns the ladder) and lands on the checkpoint below.
  const achievementsBefore = p.achievements ? { ...p.achievements } : undefined;
  const rating = nextArenaRating(p.character.arenaRating, result);
  const unlocked = achievementTrack(p, {
    type: 'pvp-match', won: result.won, kills, rating, map: result.map ?? result.bracket,
    flagCaptures: result.flagCaptures, heldAllNodes: result.heldAllNodes,
  });

  const checkpoint = sim.captureCheckpoint() as PvpAwardCheckpoint;
  checkpoint.character.arenaRating = rating;

  if (!creditHonor(checkpoint.character, honor) || !creditArenaPoints(checkpoint.character, arenaPoints)) {
    p.achievements = achievementsBefore;
    return { ...none, ok: false, message: 'Your PvP purse cannot hold the reward.' };
  }
  const gain = applyReputation(checkpoint, 'warsong', rep, EXALTED_CAP, guildReputationFactor(checkpoint));
  const delivered: string[] = [];
  for (const item of result.items ?? [])
    if (addInventoryItem(checkpoint.character, item)) delivered.push(item.name);
  const saved = await persist(checkpoint);
  if (!saved.ok) {
    p.achievements = achievementsBefore;
    return { ...none, ok: false, message: saved.message ?? 'Could not save. The match rewards were lost.' };
  }
  p.character = checkpoint.character;
  p.reputation = checkpoint.reputation;
  refreshCharacter(p);

  const parts = [`${formatPvpPoints(honor)} Honor`];
  if (arenaPoints) parts.push(`${formatPvpPoints(arenaPoints)} Arena Points`);
  if (gain.applied) parts.push(`${gain.applied} ${gain.faction.name} reputation`);
  if (delivered.length) parts.push(delivered.map(name => `[${name}]`).join(', '));
  pushChatMessage(p, 'loot', `${result.won ? 'Victory' : 'Defeat'} — received ${parts.join(', ')}.`, sim.time);
  if (gain.changed)
    pushChatMessage(p, 'discovery', `You are now ${gain.changed.label} with ${gain.faction.name}.`, sim.time);
  return { ok: true, honor, arenaPoints, reputation: gain.applied, unlocked };
}
