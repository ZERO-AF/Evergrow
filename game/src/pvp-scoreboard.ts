/** PvP match scoreboard (wayfinder T06): per-combatant stat bookkeeping for the
 * live scoreboard and the end-of-match summary. Headless — panels read the
 * snapshot, the match loop (pvp-match.ts) owns the tracker.
 *
 * Damage and kills come from `sim.pvpDamageSink` (the only place attacker,
 * victim and dealt hp meet); healing rides each combatant's own chronicle —
 * `trackChronicleEvent` records 'heal'/life-on-hit/regen against whichever actor
 * is swapped in, so a per-match delta of the `healing` metric is exact. */
import type { Combatant, PvpTeam } from './pvp-combatant.ts';
import { isCombatant } from './pvp-combatant.ts';
import type { PvpMatch } from './pvp-instance.ts';
import type { WowClassId } from './wow-types.ts';

/** One scoreboard row: identity from the roster plus live combat stats. */
export interface PvpScoreRow {
  /** Stable per-match identity (the combatant's id) — names can repeat. */
  readonly id: number;
  readonly name: string;
  readonly team: PvpTeam;
  readonly classId?: WowClassId;
  readonly role?: string;
  /** True for the real player (combatant[0] on team 'A'). */
  readonly isPlayer: boolean;
  kills: number;
  deaths: number;
  /** Hit points this combatant removed from enemies (absorbs included). */
  damageDone: number;
  /** Hit points this combatant restored (self and allies). */
  healingDone: number;
  /** Hit points removed from this combatant. */
  damageTaken: number;
  /** Objective contributions: flag captures/returns, node captures. */
  objectives: number;
  alive: boolean;
}

export interface PvpScoreboard {
  readonly rows: readonly PvpScoreRow[];
  readonly kills: { A: number; B: number };
}

/** Live 'healing' metric for one combatant's active chronicle source. */
function healingMetric(combatant: Combatant): number {
  const chronicle = combatant.chronicle;
  const source = chronicle?.sources.find(s => s.id === chronicle.active);
  return source?.values.healing ?? 0;
}

/**
 * Per-match stat tracker. Constructed when the match runtime initializes and
 * fed by the match loop: `recordDamage` from the sim's pvpDamageSink,
 * `scanDeaths` once per tick, `snapshot` for the scoreboard.
 */
export class PvpScoreTracker {
  private readonly rows: PvpScoreRow[];
  private readonly byCombatant = new Map<Combatant, PvpScoreRow>();
  /** Last enemy combatant to damage each victim — credits kills when the
   * finishing blow is a self-sourced dot/burn tick (source === target). */
  private readonly lastDamager = new Map<Combatant, Combatant>();
  private readonly dead = new Set<Combatant>();
  private readonly healingBase = new Map<Combatant, number>();

  constructor(match: PvpMatch, roster: readonly Combatant[]) {
    this.rows = roster.map((combatant, i) => {
      const entry = match.roster[i];
      const row: PvpScoreRow = {
        id: combatant.id,
        name: entry?.name ?? combatant.name ?? 'Combatant',
        team: combatant.team,
        classId: entry?.classId ?? combatant.character.classId,
        role: entry?.role,
        isPlayer: i === 0,
        kills: 0, deaths: 0, damageDone: 0, healingDone: 0, damageTaken: 0,
        objectives: 0,
        alive: !combatant.dead,
      };
      this.byCombatant.set(combatant, row);
      this.healingBase.set(combatant, healingMetric(combatant));
      return row;
    });
  }

  /** One landed hit. `source === target` marks a self-sourced periodic tick
   * (dots/burn tick inside the victim's own status pass) — it counts as damage
   * taken but keeps the last real attacker for kill credit. */
  recordDamage(source: Combatant | undefined, target: Combatant, dealt: number): void {
    if (dealt <= 0) return;
    const victim = this.byCombatant.get(target);
    if (!victim) return;
    victim.damageTaken += dealt;
    if (!source || !isCombatant(source) || source === target) return;
    const attacker = this.byCombatant.get(source);
    if (attacker && attacker.team !== victim.team) {
      attacker.damageDone += dealt;
      this.lastDamager.set(target, source);
    }
  }

  /** One objective contribution (flag capture/return, node capture). */
  creditObjective(combatant: Combatant, amount = 1): void {
    const row = this.byCombatant.get(combatant);
    if (row) row.objectives += amount;
  }

  /** Detects fresh corpses and credits the kill to the victim's last damager.
   * Returns {victim, killer} pairs so the caller can drip honor per enemy kill
   * and announce killing blows. */
  scanDeaths(roster: readonly Combatant[]): { victim: Combatant; killer?: Combatant }[] {
    const fallen: { victim: Combatant; killer?: Combatant }[] = [];
    for (const combatant of roster) {
      const row = this.byCombatant.get(combatant);
      if (!row) continue;
      row.healingDone = Math.max(0, Math.round(healingMetric(combatant) - (this.healingBase.get(combatant) ?? 0)));
      row.alive = !combatant.dead;
      if (!combatant.dead || this.dead.has(combatant)) continue;
      this.dead.add(combatant);
      row.deaths += 1;
      const killer = this.lastDamager.get(combatant);
      if (killer) this.byCombatant.get(killer)!.kills += 1;
      fallen.push({ victim: combatant, killer });
    }
    return fallen;
  }

  /** Rows in roster order (team A first, player first) plus per-team kills. */
  snapshot(): PvpScoreboard {
    const kills = { A: 0, B: 0 };
    for (const row of this.rows) kills[row.team] += row.kills;
    return { rows: this.rows.map(row => ({ ...row })), kills };
  }
}

/** One-line end-of-match summary for chat/notifications. `winner` distinguishes
 * a draw (null) from a defeat — 'won' alone can't. */
export function pvpScoreboardSummary(board: PvpScoreboard, won: boolean, winner?: 'A' | 'B' | null): string {
  const player = board.rows.find(row => row.isPlayer);
  const mine = player ? ` — you: ${player.kills} KB, ${Math.round(player.damageDone)} dmg, ${Math.round(player.healingDone)} heal` : '';
  const outcome = winner === null ? 'Draw' : won ? 'Victory' : 'Defeat';
  return `${outcome} ${board.kills.A}–${board.kills.B}${mine}`;
}
