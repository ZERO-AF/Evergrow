/** PvP match loop (wayfinder T06): drives a live match through its lifecycle —
 * prep countdown → live combat → team wipe / objective victory / timeout →
 * finished. The integrator calls `updatePvpMatch(sim, dt)` once per frame while
 * `currentPvpMatch(sim)` is live; when it returns a `PvpMatchEnd` the caller
 * owns the async teardown (`exitPvpMatch` then `awardMatchRewards`).
 *
 * Two seams live here:
 * - `match.objectives` — an optional PvpObjectives controller (battlegrounds,
 *   T07). Attach it with `attachPvpObjectives`, NEVER by plain assignment: the
 *   match record rides through structuredClone in every checkpoint, and an
 *   enumerable function-valued field throws DataCloneError mid-match.
 * - `sim.pvpDamageSink` — per-hit attribution for the scoreboard.
 *
 * Prep holds every combatant with a refreshed stun (the same cantAct gate the
 * player pipeline already honors) — WoW's "gates closed" countdown. */
import './arena-maps.ts';
import type { Simulation } from './simulation.ts';
import { aliveCombatants, combatants, isCombatant, type Combatant, type PvpTeam } from './pvp-combatant.ts';
import { attachPvpObjectives, currentPvpMatch, type PvpMatch, type PvpObjectives } from './pvp-instance.ts';
import { pvpOnCombatantKill, type PvpMatchResult } from './pvp-rewards.ts';
import { PvpScoreTracker, type PvpScoreboard } from './pvp-scoreboard.ts';
import { attachBattlegroundObjectives } from './pvp-objectives.ts';
import { pushChatMessage } from './chat-log.ts';

/** Seconds the gates stay closed before the fight goes live. */
export const PVP_PREP_SECONDS = 3;
/** Hard match cap; on expiry the team ahead on score/alive/hp wins. */
export const PVP_MATCH_SECONDS = 300;

/** Per-match runtime state. Keyed by the match object (WeakMap) so nothing
 * lands on the serialized record; a mid-match reload simply re-initializes it
 * (prep restarts, stats reset — combatant actors are gone anyway). */
interface MatchRuntime {
  prepUntil: number;
  endsAt: number;
  tracker: PvpScoreTracker;
  lastCountdown: number;
}
const runtimes = new WeakMap<PvpMatch, MatchRuntime>();

/** Re-exported for controllers that attach through this module's neighbors. */
export { attachPvpObjectives };

/** The match's objective controller, defaulting to the arena team-wipe rule.
 * A plain-assigned enumerable controller (T07 before it adopts the helper) is
 * re-defined non-enumerable so the next checkpoint cannot throw. */
function objectivesOf(match: PvpMatch): PvpObjectives {
  const existing = match.objectives;
  if (existing) {
    if (Object.prototype.propertyIsEnumerable.call(match, 'objectives')) attachPvpObjectives(match, existing);
    return existing;
  }
  const arena = arenaObjectives();
  attachPvpObjectives(match, arena);
  return arena;
}

/** Arena default: the fight ends when one team has no living combatants.
 * `update` snapshots alive counts so `winner()` stays argument-free per the
 * PvpObjectives contract. */
export function arenaObjectives(): PvpObjectives {
  let aliveA = 1, aliveB = 1;
  return {
    update(sim) {
      const roster = combatants(sim);
      aliveA = aliveCombatants(roster.filter(c => c.team === 'A')).length;
      aliveB = aliveCombatants(roster.filter(c => c.team === 'B')).length;
    },
    score: () => ({ A: aliveA, B: aliveB }),
    winner: () => (aliveB === 0 && aliveA === 0 ? null : aliveB === 0 ? 'A' : aliveA === 0 ? 'B' : null),
  };
}

/** Timeout tiebreak: objective score, then living members, then hp fraction. */
function timeoutWinner(match: PvpMatch, roster: readonly Combatant[]): PvpTeam | null {
  const score = match.score;
  if (score.A !== score.B) return score.A > score.B ? 'A' : 'B';
  const aliveA = aliveCombatants(roster.filter(c => c.team === 'A'));
  const aliveB = aliveCombatants(roster.filter(c => c.team === 'B'));
  if (aliveA.length !== aliveB.length) return aliveA.length > aliveB.length ? 'A' : 'B';
  const hp = (list: readonly Combatant[]) => list.reduce((sum, c) => sum + c.hp / Math.max(1, c.maxHp), 0);
  const hpA = hp(aliveA), hpB = hp(aliveB);
  return hpA === hpB ? null : hpA > hpB ? 'A' : 'B';
}

/** What the integrator gets when a match ends: the reward payload plus the
 * frozen scoreboard. `exitPvpMatch` then `awardMatchRewards(result)` — in that
 * order, so the award lands on the restored real character. */
export interface PvpMatchEnd {
  readonly winner: PvpTeam | null;
  readonly result: PvpMatchResult;
  readonly scoreboard: PvpScoreboard;
}

/**
 * One frame of match bookkeeping. Returns undefined while the fight runs (or
 * when no match is live); returns the end payload exactly once when the match
 * finishes. Never throws — a broken controller degrades to the wipe rule.
 */
export function updatePvpMatch(sim: Simulation, dt: number): PvpMatchEnd | undefined {
  const match = currentPvpMatch(sim);
  if (!match || match.phase === 'finished') return undefined;
  const roster = combatants(sim);
  // A reload mid-match drops the combatant actors but keeps the record:
  // abandon the match rather than leave a corpse-less run behind.
  if (!roster.length) {
    match.phase = 'finished';
    return { winner: null, result: { mode: match.mode, bracket: match.bracket, map: match.mapId, won: false, kills: 0, honorFromKills: true }, scoreboard: { rows: [], kills: { A: 0, B: 0 } } };
  }
  let rt = runtimes.get(match);
  if (!rt) {
    rt = {
      prepUntil: sim.time + PVP_PREP_SECONDS,
      endsAt: sim.time + PVP_MATCH_SECONDS,
      tracker: new PvpScoreTracker(match, roster),
      lastCountdown: Math.ceil(PVP_PREP_SECONDS) + 1,
    };
    runtimes.set(match, rt);
    sim.pvpDamageSink = (source, target, dealt) =>
      rt!.tracker.recordDamage(source && isCombatant(source) ? source : undefined, target, dealt);
    // Attach the arena default (or adopt T07's controller) up front.
    objectivesOf(match);
  }

  // ── Prep: gates closed — everyone held until the countdown ends. ──
  if (match.phase === 'prep') {
    if (sim.time < rt.prepUntil) {
      for (const c of roster) if (!c.dead) c.stunTime = Math.max(c.stunTime ?? 0, rt.prepUntil - sim.time + dt);
      const left = Math.ceil(rt.prepUntil - sim.time);
      if (left < rt.lastCountdown && left > 0) {
        rt.lastCountdown = left;
        pushChatMessage(sim.player, 'system', `The battle begins in ${left}…`, sim.time);
      }
      return undefined;
    }
    match.phase = 'live';
    for (const c of roster) c.stunTime = 0;
    pushChatMessage(sim.player, 'system', 'Fight!', sim.time);
  }

  // ── Live: stats, objectives, win check. ──
  const fallen = rt.tracker.scanDeaths(roster);
  for (const corpse of fallen) if (corpse.team === 'B') pvpOnCombatantKill(sim);
  attachBattlegroundObjectives(sim); // T07: re-creates the BG controller after reload; no-op for arenas
  const objectives = objectivesOf(match);
  try {
    objectives.update(sim, match, dt);
    match.score = objectives.score();
  } catch {
    // A broken controller must not stall the match; the wipe rule still ends it.
  }
  let winner = objectives.winner();
  const aliveA = aliveCombatants(roster.filter(c => c.team === 'A')).length;
  const aliveB = aliveCombatants(roster.filter(c => c.team === 'B')).length;
  if (!winner) {
    if (aliveB === 0 && aliveA > 0) winner = 'A'; else if (aliveA === 0 && aliveB > 0) winner = 'B';
  }
  // Over on a winner, a mutual wipe (draw), or the match timer.
  if (!winner && aliveA > 0 && aliveB > 0 && sim.time < rt.endsAt) return undefined;
  if (!winner) winner = timeoutWinner(match, roster);
  if (!winner && sim.time < rt.endsAt) return undefined;

  // ── Finished: freeze survivors, stamp the record, hand off the payload. ──
  match.phase = 'finished';
  for (const c of roster) if (!c.dead) c.stunTime = Math.max(c.stunTime ?? 0, 1);
  const playerKills = rt.tracker.snapshot().rows.find(row => row.isPlayer)?.kills ?? 0;
  const objectivesScore = match.mode === 'arena' ? undefined : Math.max(0, Math.floor(match.score.A));
  return {
    winner,
    result: {
      mode: match.mode, bracket: match.bracket, map: match.mapId,
      won: winner === 'A', kills: playerKills,
      ...(objectivesScore ? { objectives: objectivesScore } : {}),
      honorFromKills: true,
    },
    scoreboard: rt.tracker.snapshot(),
  };
}
