import { basicAttackWeapon } from './equipment.ts';
import { nameplateName } from './nameplate.ts';
import { getMinimapRect } from './map-view.ts';
import { ALLY_TEMPLATES } from './wow-allies.ts';
import { UI_THEME } from './ui-theme.ts';
import { text } from './font.ts';
import type { CombatEvent, Enemy, Player } from './model.ts';

/**
 * WoW-style threat meter (Omen/Details! readout). Presentation only: the meter
 * consumes confirmed combat events and live enemy taunt state; it never writes
 * back to the simulation.
 *
 * Model: one threat table per enemy. Damage adds threat 1:1 to its source —
 * the player or one `ally:<id>` bucket per pet/summon (pet tanking is the real
 * solo case). Periodic ticks are queued and split across the enemy's live DoTs
 * by ownership. Taunt snapshots the taunter up to the current holder's threat,
 * matching WoW's "taunt fixes you at the top" rule. Tables drop on death,
 * despawn and leash resets (returning home unaware).
 */

export type ThreatSource = 'player' | `ally:${number}`;

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

export const THREAT_RULES = Object.freeze({
  /** WoW pull thresholds: melee pulls aggro at 110%, ranged at 130%. */
  meleePull: 1.1,
  rangedPull: 1.3,
  /** Taunt on an empty table still puts the taunter on it. */
  tauntFloor: 1,
  maxTables: 48,
  maxPending: 64,
});

const UI = UI_THEME.palette;

export class ThreatMeter {
  private tables = new Map<number, Map<ThreatSource, number>>();
  private taunts = new Map<number, { allyId?: number; remaining: number }>();
  private pending: { id: number; value: number }[] = [];

  reset(): void {
    this.tables.clear();
    this.taunts.clear();
    this.pending.length = 0;
  }

  /** Feed drained combat events; only damage and kills move threat. */
  handleEvents(events: readonly CombatEvent[]): void {
    for (const event of events) {
      if (event.type === 'hit' && event.value > 0) {
        const value = event.actualValue ?? event.value;
        if (event.periodic) {
          if (this.pending.length < THREAT_RULES.maxPending) this.pending.push({ id: event.targetId, value });
        } else this.add(event.targetId, event.allyId !== undefined ? `ally:${event.allyId}` : 'player', value);
      } else if (event.type === 'kill') {
        this.tables.delete(event.targetId);
        this.taunts.delete(event.targetId);
      }
    }
  }

  private add(enemyId: number, source: ThreatSource, amount: number): void {
    if (!(amount > 0)) return;
    const table = this.tables.get(enemyId) ?? new Map<ThreatSource, number>();
    table.set(source, (table.get(source) ?? 0) + amount);
    this.tables.set(enemyId, table);
  }

  /** WoW taunt: the taunter's threat rises to the current holder's level. */
  private applyTaunt(enemyId: number, source: ThreatSource): void {
    const table = this.tables.get(enemyId) ?? new Map<ThreatSource, number>();
    this.tables.set(enemyId, table);
    let top = 0;
    for (const value of table.values()) top = Math.max(top, value);
    table.set(source, Math.max(table.get(source) ?? 0, top, THREAT_RULES.tauntFloor));
  }

  /** Resolve queued periodic ticks against live DoT ownership, then track taunts. */
  update(enemies: readonly Enemy[]): void {
    for (const tick of this.pending) {
      const enemy = enemies.find(e => e.id === tick.id);
      const dots = enemy?.dots?.filter(d => d.dps > 0) ?? [];
      const total = dots.reduce((n, d) => n + d.dps, 0);
      if (!enemy || total <= 0) this.add(tick.id, 'player', tick.value);
      else for (const dot of dots)
        this.add(tick.id, dot.source === 'ally' ? `ally:${dot.allyId ?? 0}` : 'player', tick.value * dot.dps / total);
    }
    this.pending.length = 0;
    for (const enemy of enemies) {
      if (enemy.state === 'dead' || enemy.hp <= 0) continue;
      if (enemy.state === 'return' && enemy.awareness <= 0) {
        this.tables.delete(enemy.id);
        this.taunts.delete(enemy.id);
        continue;
      }
      const taunt = enemy.taunted;
      const previous = this.taunts.get(enemy.id);
      if (!taunt || taunt.remaining <= 0) {
        if (previous) this.taunts.delete(enemy.id);
        continue;
      }
      // A new application or a refresh (same source, longer clock) re-samples the top.
      if (!previous || previous.allyId !== taunt.allyId || taunt.remaining > previous.remaining + .05)
        this.applyTaunt(enemy.id, taunt.allyId !== undefined ? `ally:${taunt.allyId}` : 'player');
      this.taunts.set(enemy.id, { allyId: taunt.allyId, remaining: taunt.remaining });
    }
    for (const id of [...this.tables.keys()])
      if (!enemies.some(e => e.id === id && e.state !== 'dead' && e.hp > 0)) {
        this.tables.delete(id);
        this.taunts.delete(id);
      }
    while (this.tables.size > THREAT_RULES.maxTables) {
      const oldest = this.tables.keys().next().value!;
      this.tables.delete(oldest);
      this.taunts.delete(oldest);
    }
  }

  /** The source the enemy is attacking: the taunter while taunted, else top threat. */
  private aggroSource(enemy: Enemy, table: Map<ThreatSource, number>): ThreatSource | null {
    const taunt = enemy.taunted;
    if (taunt && taunt.remaining > 0) return taunt.allyId !== undefined ? `ally:${taunt.allyId}` : 'player';
    let top: ThreatSource | null = null, best = 0;
    for (const [source, value] of table) if (value > best) { best = value; top = source; }
    return top;
  }

  private allyLabel(player: Player, id: number): string {
    const ally = player.allies?.find(a => a.id === id);
    if (!ally) return 'Pet';
    const pet = ally.petId !== undefined ? player.character.pets?.active : undefined;
    return pet && ally.petId === pet.id ? pet.name : ALLY_TEMPLATES[ally.kind].name;
  }

  /** Threat rows for one enemy, highest first; empty without a table. */
  rows(enemy: Enemy, player: Player): ThreatRow[] {
    const table = this.tables.get(enemy.id);
    if (!table || !table.size) return [];
    const holder = this.aggroSource(enemy, table);
    const top = holder ? table.get(holder) ?? 0 : Math.max(...table.values());
    return [...table.entries()]
      .map(([source, threat]): ThreatRow => ({
        source, threat, tanking: source === holder, you: source === 'player',
        label: source === 'player' ? 'You' : this.allyLabel(player, Number(source.slice(5))),
        percent: top > 0 ? threat / top : 1,
      }))
      .sort((a, b) => b.threat - a.threat);
  }

  /** Player threat share vs the holder on one enemy; 0 without a table. */
  playerPercent(enemy: Enemy): number {
    const table = this.tables.get(enemy.id);
    if (!table || !table.size) return 0;
    const holder = this.aggroSource(enemy, table);
    const top = holder ? table.get(holder) ?? 0 : 0;
    return top > 0 ? (table.get('player') ?? 0) / top : 0;
  }

  /** Enemies with live threat tables, sorted by the player's share. */
  list(enemies: readonly Enemy[], limit = 5): ThreatListEntry[] {
    const out: ThreatListEntry[] = [];
    for (const enemy of enemies) {
      const table = this.tables.get(enemy.id);
      if (!table || !table.size || enemy.state === 'dead' || enemy.hp <= 0) continue;
      const holder = this.aggroSource(enemy, table);
      out.push({ enemy, name: nameplateName(enemy), tanking: holder === 'player', percent: this.playerPercent(enemy) });
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
  player: Player, plate: { x: number; y: number; width: number; height: number }, opacity = 1): number {
  const rows = meter.rows(enemy, player);
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
  enemies: readonly Enemy[], player: Player, width: number, height: number, y: number): number {
  const entries = meter.list(enemies);
  // Single-target fights already read on the plate rows.
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
