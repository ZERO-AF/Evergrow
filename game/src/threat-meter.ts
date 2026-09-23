import { basicAttackWeapon } from './equipment.ts';
import { nameplateName } from './nameplate.ts';
import { getMinimapRect } from './map-view.ts';
import { ALLY_TEMPLATES } from './wow-allies.ts';
import { UI_THEME } from './ui-theme.ts';
import { text } from './font.ts';
import { playerThreatSource, resolveThreatHolder, resetThreatTables, threatPlayer, threatTable, tickThreat, THREAT_RULES, type ThreatSource } from './enemy-threat.ts';
import type { CombatEvent, Enemy, Player } from './model.ts';

export { THREAT_RULES };
export type { ThreatSource };

/**
 * WoW-style threat meter (Omen/Details! readout). Presentation only: the meter
 * reads the simulation's live threat tables (enemy-threat.ts), so the readout
 * and enemy AI aggro never disagree.
 *
 * Model: one threat table per enemy. Damage adds threat 1:1 to its source —
 * the player or one `ally:<id>` bucket per pet/summon (pet tanking is the real
 * solo case). Periodic ticks split across the enemy's live DoTs by ownership.
 * Taunt snapshots the taunter up to the current holder's threat, matching
 * WoW's "taunt fixes you at the top" rule. Tables drop on death, despawn and
 * leash resets (returning home unaware).
 */



export interface ThreatRow {
  source: ThreatSource;
  label: string;
  threat: number;
  /** Share of the current aggro holder's threat (1 = tied with the tank). */
  percent: number;
  tanking: boolean;
  you: boolean;
}

export interface ThreatListEntry {
  enemy: Enemy;
  name: string;
  /** Player threat as a share of whoever holds aggro. */
  percent: number;
  tanking: boolean;
}



const UI = UI_THEME.palette;

export class ThreatMeter {
  reset(): void {
    resetThreatTables();
  }

  /** Threat accrues sim-side (recordThreat at the damage site); the meter only
   * reads the shared tables. Kept for the renderer's event-drain call. */
  handleEvents(_events: readonly CombatEvent[]): void {
  }

  /** Optional maintenance pass: taunt snapshots and dead-combatant pruning for
   * actors whose AI didn't tick this frame. The AI tick owns real decay. */
  update(enemies: readonly Enemy[], player?: Player): void {
    if (!player) return;
    const allies = player.allies ?? [];
    for (const enemy of enemies) tickThreat(enemy, 0, [player], allies);
  }

  /** The source the enemy is attacking: the taunter while taunted, else the
   * threat holder under the pull rule. The roster resolves `player:<id>`
   * buckets so a co-op partner's aggro reads correctly. */
  private holder(enemy: Enemy, players: readonly Player[]): ThreatSource | null {
    const taunt = enemy.taunted;
    if (taunt && taunt.remaining > 0)
      return taunt.allyId !== undefined ? `ally:${taunt.allyId}` : `player:${taunt.playerId ?? 0}`;
    return resolveThreatHolder(enemy, players, players.flatMap(p => p.allies ?? [])) ?? null;
  }



  private allyLabel(player: Player, id: number): string {
    const ally = player.allies?.find(a => a.id === id);
    if (!ally) return 'Pet';
    const pet = ally.petId !== undefined ? player.character.pets?.active : undefined;
    return pet && ally.petId === pet.id ? pet.name : ALLY_TEMPLATES[ally.kind].name;
  }

  /** Threat rows for one enemy, highest first; empty without a table. */
  rows(enemy: Enemy, player: Player, players: readonly Player[] = [player]): ThreatRow[] {
    const table = threatTable(enemy);
    if (!table || !table.entries.size) return [];
    const holder = this.holder(enemy, players);
    const holderPlayer = holder ? threatPlayer(players, holder) : undefined;
    const top = Math.max(...table.entries.values());
    return [...table.entries.entries()]
      .map(([source, threat]): ThreatRow => {
        const owner = threatPlayer(players, source);
        return {
          source, threat,
          tanking: source === holder || (holderPlayer !== undefined && owner === holderPlayer),
          you: owner === player,
          label: owner ? (owner === player ? 'You' : `P${(owner.id ?? 0) + 1}`) : this.allyLabel(player, Number(source.slice(5))),
          percent: top > 0 ? threat / top : 1,
        };
      })
      .sort((a, b) => b.threat - a.threat);
  }

  /** Player threat share of the table top on one enemy; 0 without a table. */
  playerPercent(enemy: Enemy, player?: Player): number {
    const table = threatTable(enemy);
    if (!table || !table.entries.size) return 0;
    const top = Math.max(...table.entries.values());
    const threat = player ? (table.entries.get(playerThreatSource(player)) ?? 0)
      + ((player.id ?? 0) === 0 ? table.entries.get('player') ?? 0 : 0)
      : table.entries.get('player') ?? 0;
    return top > 0 ? threat / top : 0;
  }

  /** Enemies with live threat tables, sorted by the player's share. */
  list(enemies: readonly Enemy[], player: Player, players: readonly Player[] = [player], limit = 5): ThreatListEntry[] {
    const out: ThreatListEntry[] = [];
    for (const enemy of enemies) {
      const table = threatTable(enemy);
      if (!table || !table.entries.size || enemy.state === 'dead' || enemy.hp <= 0) continue;
      const holder = this.holder(enemy, players);
      const holderPlayer = holder ? threatPlayer(players, holder) : undefined;
      out.push({ enemy, name: nameplateName(enemy), tanking: holderPlayer === player, percent: this.playerPercent(enemy, player) });
    }
    return out.sort((a, b) => b.percent - a.percent).slice(0, limit);
  }
}

/** WoW pull threshold: 110% in melee, 130% with a ranged basic weapon. */
export function pullThreshold(player: Player): number {
  return basicAttackWeapon(player).attackKind === 'melee' ? THREAT_RULES.meleePull : THREAT_RULES.rangedPull;
}

/** WoW threat coloring: red while tanking, orange at the pull line, yellow near it. */
export function threatColor(percent: number, tanking: boolean, threshold: number = THREAT_RULES.meleePull): string {
  if (tanking) return '#e2574c';
  if (percent >= threshold) return '#e8913d';
  if (percent >= .7) return '#e8c93a';
  return '#7fb069';
}

/** Omen-style readout under the target plate: one row per threat holder. */
export function drawThreatRows(c: CanvasRenderingContext2D, meter: ThreatMeter, enemy: Enemy,
  player: Player, plate: { x: number; y: number; width: number; height: number }, opacity = 1,
  players: readonly Player[] = [player]): number {
  const rows = meter.rows(enemy, player, players);
  if (!rows.length || plate.height <= 0 || opacity <= 0) return 0;
  const threshold = pullThreshold(player);
  const x = plate.x + 15, width = plate.width - 30;
  let y = plate.y + plate.height + 5;
  c.save();
  c.globalAlpha *= Math.min(1, opacity);
  text(c, 'THREAT', x, y + 6, .62, UI.muted);
  y += 9;
  for (const row of rows.slice(0, 4)) {
    const color = threatColor(row.percent, row.tanking, threshold);
    text(c, row.tanking ? `» ${row.label}` : row.label, x, y + 6, .72, row.you ? UI.ivory : UI.text);
    text(c, `${Math.round(row.percent * 100)}%`, x + width, y + 6, .72, color, 'right');
    c.fillStyle = '#070c12'; c.fillRect(x, y + 8, width, 2);
    c.fillStyle = color; c.fillRect(x, y + 8, width * Math.min(1, row.percent), 2);
    y += 12;
  }
  c.restore();
  return y - plate.y - plate.height - 5;
}

/** Side list for the target group: the player's share on every engaged enemy. */
export function drawThreatList(c: CanvasRenderingContext2D, meter: ThreatMeter,
  enemies: readonly Enemy[], player: Player, width: number, height: number, y: number,
  players: readonly Player[] = [player]): number {
  const entries = meter.list(enemies, player, players);
  if (entries.length < 2) return 0;
  const map = getMinimapRect(width, height);
  const x = map.x + 10, w = map.width - 20;
  const threshold = pullThreshold(player);
  text(c, 'THREAT', x, y + 6, .62, UI.muted);
  let row = y + 10;
  for (const entry of entries) {
    const color = threatColor(entry.percent, entry.tanking, threshold);
    const name = entry.name.length > 16 ? `${entry.name.slice(0, 15)}…` : entry.name;
    text(c, name, x, row + 6, .68, entry.tanking ? '#e2574c' : UI.text);
    text(c, `${Math.round(entry.percent * 100)}%`, x + w, row + 6, .68, color, 'right');
    row += 10;
  }
  return row - y;
}
