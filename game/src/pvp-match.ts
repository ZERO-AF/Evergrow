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
import { PvpAnnouncer, type PvpAnnouncement } from './pvp-announce.ts';
import { applyDot } from './combat-status.ts';

/** Seconds the gates stay closed before the fight goes live. */
export const PVP_PREP_SECONDS = 3;
/** Hard match cap; on expiry the team ahead on score/alive/hp wins. */
export const PVP_MATCH_SECONDS = 300;
/** WoW's stalemate breaker: after this many live seconds every combatant takes
 * a ramping shadow burn until one side falls. Arena 5:00 → 4:00 left, BGs get
 * the last minute. */
export const PVP_SUDDEN_DEATH_SECONDS = 60;
/** The burn's starting fraction of max hp per second; +25% per tick. */
const SUDDEN_DEATH_DPS = .02;
const SUDDEN_DEATH_RAMP = .25;
const SUDDEN_DEATH_DOT = 'pvp:sudden-death';
/** Remaining-time callouts (seconds left → fired once each). */
const TIME_WARNINGS: readonly number[] = [60, 30, 10];

/** Per-match runtime state. Keyed by the match object (WeakMap) so nothing
 * lands on the serialized record; a mid-match reload simply re-initializes it
 * (prep restarts, stats reset — combatant actors are gone anyway). */
interface MatchRuntime {
  prepUntil: number;
  endsAt: number;
  /** Sim time sudden death begins (endsAt - PVP_SUDDEN_DEATH_SECONDS). */
  suddenDeathAt: number;
  suddenDeath: boolean;
  tracker: PvpScoreTracker;
  announcer: PvpAnnouncer;
  /** The player's own flag captures this match (achievement progress). */
  flagCaptures: number;
  lastCountdown: number;
  /** Time warnings already fired (seconds-left values). */
  warned: Set<number>;
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
  if (!match) return undefined;
  const roster = combatants(sim);
  // A reload mid-match drops the combatant actors but keeps the record:
  // abandon the match rather than leave a corpse-less run behind.
  if (!roster.length) {
    if (match.phase === 'finished') return undefined;
    match.phase = 'finished';
    return { winner: null, result: { mode: match.mode, bracket: match.bracket, map: match.mapId, won: false, kills: 0, honorFromKills: true }, scoreboard: { rows: [], kills: { A: 0, B: 0 } } };
  }
  // Finished matches hold everyone in place until the integrator exits —
  // the scoreboard stays up and no post-horn kills sneak in.
  if (match.phase === 'finished') {
    for (const c of roster) if (!c.dead) c.stunTime = Math.max(c.stunTime ?? 0, .5);
    return undefined;
  }
  let rt = runtimes.get(match);
  if (!rt) {
    rt = {
      prepUntil: sim.time + PVP_PREP_SECONDS,
      endsAt: sim.time + PVP_MATCH_SECONDS,
      suddenDeathAt: sim.time + PVP_MATCH_SECONDS - PVP_SUDDEN_DEATH_SECONDS,
      suddenDeath: false,
      tracker: new PvpScoreTracker(match, roster),
      announcer: new PvpAnnouncer(),
      flagCaptures: 0,
      lastCountdown: Math.ceil(PVP_PREP_SECONDS) + 1,
      warned: new Set(),
    };
    runtimes.set(match, rt);
    sim.pvpDamageSink = (source, target, dealt) =>
      rt!.tracker.recordDamage(source && isCombatant(source) ? source : undefined, target, dealt);
    // Attach the arena default (or adopt T07's controller) up front.
    objectivesOf(match);
    rt.announcer.bind(roster, match);
    rt.announcer.update(match, rt.tracker.snapshot(), []);
  }


  // ── Prep: gates closed — everyone held until the countdown ends. ──
  if (match.phase === 'prep') {
    if (sim.time < rt.prepUntil) {
      for (const c of roster) if (!c.dead) c.stunTime = Math.max(c.stunTime ?? 0, rt.prepUntil - sim.time + dt);
      const left = Math.ceil(rt.prepUntil - sim.time);
      if (left < rt.lastCountdown && left > 0) {
        rt.lastCountdown = left;
        rt.announcer.announce({ text: `The battle begins in ${left}…`, chat: 'system',
          flash: { title: `${left}`, subtitle: 'The battle begins', color: '#e8c15a' }, cue: 'warning' });
      }
      return undefined;
    }
    match.phase = 'live';
    for (const c of roster) c.stunTime = 0;
  }

  // ── Live: stats, objectives, win check. ──
  const fallen = rt.tracker.scanDeaths(roster);
  for (const { victim } of fallen) if (victim.team === 'B') pvpOnCombatantKill(sim);
  attachBattlegroundObjectives(sim); // T07: re-creates the BG controller after reload; no-op for arenas
  const objectives = objectivesOf(match);
  try {
    objectives.update(sim, match, dt);
    match.score = objectives.score();
  } catch {
    // A broken controller must not stall the match; the wipe rule still ends it.
  }
  // Objective beats → scoreboard credit + announcements (transient; drained here).
  const events = objectives.events?.splice(0) ?? [];
  for (const event of events) {
    if (event.kind === 'flag-capture' || event.kind === 'flag-return') {
      if (event.combatant) rt.tracker.creditObjective(event.combatant);
      if (event.kind === 'flag-capture' && event.combatant === roster[0]) rt.flagCaptures += 1;
    } else if (event.kind === 'node-capture') {
      for (const captor of event.captors ?? []) rt.tracker.creditObjective(captor);
    }
  }
  rt.announcer.update(match, rt.tracker.snapshot(), events);

  // ── Clock: remaining-time callouts, then sudden death. ──
  const timeLeft = rt.endsAt - sim.time;
  for (const at of TIME_WARNINGS) {
    if (timeLeft <= at && !rt.warned.has(at)) {
      rt.warned.add(at);
      rt.announcer.announce({ text: `${at >= 60 ? `${Math.round(at / 60)} minute` : `${at} seconds`} remaining.`, chat: 'system',
        flash: { title: `${at >= 60 ? `${Math.round(at / 60)}:00` : `0:${String(at).padStart(2, '0')}`}`, subtitle: 'remaining', color: '#e8c15a' }, cue: 'warning' });
    }
  }
  if (!rt.suddenDeath && sim.time >= rt.suddenDeathAt) {
    rt.suddenDeath = true;
    rt.announcer.announce({ text: 'Sudden death! The arena itself turns on the fighters.', chat: 'system',
      flash: { title: 'Sudden Death', subtitle: 'The arena burns — finish it', color: '#f34e60' }, cue: 'warning' });
  }
  if (rt.suddenDeath) {
    for (const c of roster) {
      if (c.dead) continue;
      applyDot(c, SUDDEN_DEATH_DOT, { school: 'shadow', flatDps: c.maxHp * SUDDEN_DEATH_DPS, duration: 2, interval: .5, ramp: SUDDEN_DEATH_RAMP }, 0);
    }
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
  rt.announcer.finish(match, winner);
  const playerKills = rt.tracker.snapshot().rows.find(row => row.isPlayer)?.kills ?? 0;
  const objectivesScore = match.mode === 'arena' ? undefined
    : Math.max(0, Math.floor(match.score.A / Math.max(1, objectives.target ?? 1) * 3));
  const heldAllNodes = !!objectives.peakOwned?.total && objectives.peakOwned.A >= objectives.peakOwned.total;
  return {
    winner,
    result: {
      mode: match.mode, bracket: match.bracket, map: match.mapId,
      won: winner === 'A', kills: playerKills,
      ...(objectivesScore ? { objectives: objectivesScore } : {}),
      ...(rt.flagCaptures ? { flagCaptures: rt.flagCaptures } : {}),
      ...(heldAllNodes ? { heldAllNodes: true } : {}),
      honorFromKills: !match.savedCharacter,
    },
    scoreboard: rt.tracker.snapshot(),
  };
}

/** Live scoreboard for the in-match panel: the tracker's snapshot while a
 * runtime exists, else zeroed rows from the roster record. */
export function pvpScoreboard(sim: Simulation): PvpScoreboard | undefined {
  const match = currentPvpMatch(sim);
  if (!match) return undefined;
  const rt = runtimes.get(match);
  if (rt) return rt.tracker.snapshot();
  return {
    rows: match.roster.map((entry, i) => ({
      name: entry.name, team: entry.team, classId: entry.classId, role: entry.role,
      isPlayer: i === 0, kills: 0, deaths: 0, damageDone: 0, healingDone: 0, damageTaken: 0,
      objectives: 0, alive: true,
    })),
    kills: { A: 0, B: 0 },
  };
}


/** What the HUD/scoreboard chrome needs each frame: phase, the match clock and
 * the sudden-death state. `timeLeft`/`suddenDeathIn` are seconds (0 when the
 * phase doesn't apply). */
export interface PvpMatchStatus {
  readonly phase: PvpMatch['phase'];
  /** Seconds left on the prep countdown (0 once live). */
  readonly prepLeft: number;
  /** Seconds left on the match clock (0 after expiry). */
  readonly timeLeft: number;
  /** True while the sudden-death burn ticks. */
  readonly suddenDeath: boolean;
  /** Seconds until sudden death starts (0 once it has). */
  readonly suddenDeathIn: number;
  /** Headline score label for the mode ('Alive', 'Flags', 'Resources'). */
  readonly scoreLabel: string;
}

/** Live match status for the HUD and scoreboard chrome; undefined outside a match. */
export function pvpMatchStatus(sim: Simulation): PvpMatchStatus | undefined {
  const match = currentPvpMatch(sim);
  if (!match) return undefined;
  const rt = runtimes.get(match);
  const scoreLabel = match.objectives?.scoreLabel ?? 'Alive';
  if (!rt) return { phase: match.phase, prepLeft: PVP_PREP_SECONDS, timeLeft: PVP_MATCH_SECONDS, suddenDeath: false, suddenDeathIn: PVP_MATCH_SECONDS - PVP_SUDDEN_DEATH_SECONDS, scoreLabel };
  return {
    phase: match.phase,
    prepLeft: Math.max(0, rt.prepUntil - sim.time),
    timeLeft: Math.max(0, rt.endsAt - sim.time),
    suddenDeath: rt.suddenDeath,
    suddenDeathIn: Math.max(0, rt.suddenDeathAt - sim.time),
    scoreLabel,
  };
}
/** Queued callouts for the live match (announcer lives in the runtime). */
export function drainPvpAnnouncements(sim: Simulation): PvpAnnouncement[] {
  const match = currentPvpMatch(sim);
  return match ? runtimes.get(match)?.announcer.drain() ?? [] : [];
}
