/** PvP scoreboard panel (wayfinder T08): the Tab-style in-match standings and
 * the end-of-match results screen. One overlay serves both — while the match
 * runs it refreshes from the live tracker snapshot; when the match ends it
 * freezes on the final board, shows the Victory/Defeat banner and counts down
 * to the automatic exit (or the Leave button).
 *
 * The panel is a non-modal overlay: it never pauses the sim and never joins the
 * PanelCoordinator phases, so the fight keeps running behind it mid-match. */
import type { PvpMatch } from './pvp-instance.ts';
import type { PvpScoreboard, PvpScoreRow } from './pvp-scoreboard.ts';
import { pvpMap } from './pvp-floor.ts';
import { pvpBracketLabel, pvpRoleLabel, type PvpRole } from './pvp-setup.ts';
import { WOW_CLASSES } from './wow-classes.ts';
import { escapeUI as esc, uiIcon } from './ui-components.ts';
import './pvp-scoreboard-panel.css';

/** Seconds the end-of-match board stays up before the auto-exit fires. */
export const PVP_SCOREBOARD_SECONDS = 15;

export interface PvpScoreboardActions {
    /** Leave the match (exit portal equivalent); the game owns teardown. */
    leave(): void;
}
/** End-of-match state: the winner plus the auto-exit deadline (ms clock). */
export interface PvpScoreboardEnd {
    readonly winner: 'A' | 'B' | null;
    readonly exitAt: number;
}

const num = (n: number): string => Math.round(n).toLocaleString();
const compact = (n: number): string => n >= 10000 ? `${(n / 1000).toFixed(1)}k` : num(n);

export class PvpScoreboardPanel {
    readonly element = document.createElement('section');
    private readonly actions: PvpScoreboardActions;
    private match: PvpMatch | null = null;
    private board: PvpScoreboard | null = null;
    private end: PvpScoreboardEnd | null = null;
    private lastRender = 0;
    private readonly life = new AbortController();

    constructor(mount: HTMLElement, actions: PvpScoreboardActions) {
        this.actions = actions;
        this.element.className = 'pvp-scoreboard';
        this.element.hidden = true;
        this.element.setAttribute('aria-label', 'Match scoreboard');
        mount.append(this.element);
        this.element.addEventListener('click', event => {
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
            if (button?.hasAttribute('data-pvp-leave')) this.actions.leave();
        }, { signal: this.life.signal });
    }

    get opened(): boolean { return !this.element.hidden; }

    /** Show the board — live standings in-match, the result screen at the end. */
    open(match: PvpMatch, board: PvpScoreboard | undefined, end?: PvpScoreboardEnd): void {
        this.match = match;
        this.board = board ?? null;
        this.end = end ?? null;
        this.element.hidden = false;
        this.render(true);
    }

    /** Refresh while open; throttled — the game loop calls this every frame. */
    update(match: PvpMatch, board: PvpScoreboard | undefined, end?: PvpScoreboardEnd): void {
        if (!this.opened) return;
        this.match = match;
        this.board = board ?? this.board;
        if (end) this.end = end;
        this.render();
    }

    close(): void { this.element.hidden = true; this.match = null; this.board = null; this.end = null; }
    dispose(): void { this.close(); this.life.abort(); this.element.remove(); }

    private row(row: PvpScoreRow): string {
        const cls = row.classId ? WOW_CLASSES[row.classId] : undefined;
        const color = cls?.color ?? '#8fa1a8';
        const role = row.role ? `<small class="pvp-score-role">${esc(pvpRoleLabel(row.role as PvpRole))}</small>` : '';
        return `<div class="pvp-score-row${row.isPlayer ? ' is-player' : ''}${row.alive ? '' : ' is-dead'}" role="row">
      <span class="pvp-score-name" role="cell"><i class="pvp-score-class" style="--class-color:${color}"></i><strong>${esc(row.name)}</strong>${row.isPlayer ? '<small class="pvp-score-you">You</small>' : role}</span>
      <span class="pvp-score-num" role="cell">${row.kills}</span>
      <span class="pvp-score-num" role="cell">${row.deaths}</span>
      <span class="pvp-score-num" role="cell">${compact(row.damageDone)}</span>
      <span class="pvp-score-num" role="cell">${compact(row.healingDone)}</span>
      <span class="pvp-score-num" role="cell">${row.objectives}</span>
    </div>`;
    }

    private teamTable(team: 'A' | 'B', rows: readonly PvpScoreRow[]): string {
        const label = team === 'A' ? 'Your team' : 'Enemy team';
        return `<div class="pvp-score-team is-${team === 'A' ? 'ally' : 'enemy'}">
      <h3>${esc(label)}</h3>
      <div class="pvp-score-cols" role="row"><span role="columnheader">Name</span><span role="columnheader" title="Killing blows">KB</span><span role="columnheader" title="Deaths">D</span><span role="columnheader" title="Damage done">Dmg</span><span role="columnheader" title="Healing done">Heal</span><span role="columnheader" title="Objective score">Obj</span></div>
      ${rows.map(r => this.row(r)).join('') || '<div class="pvp-score-empty">No combatants</div>'}
    </div>`;
    }

    private render(force = false): void {
        const now = performance.now();
        if (!force && now - this.lastRender < 200) return;
        this.lastRender = now;
        const match = this.match, board = this.board;
        if (!match) { this.element.innerHTML = ''; return; }
        const map = pvpMap(match.mapId)?.name ?? match.mapId;
        const scoreA = Math.floor(match.score.A), scoreB = Math.floor(match.score.B);
        const teamA = (board?.rows ?? []).filter(r => r.team === 'A');
        const teamB = (board?.rows ?? []).filter(r => r.team === 'B');
        const banner = this.end
            ? `<div class="pvp-score-banner is-${this.end.winner === 'A' ? 'victory' : this.end.winner === 'B' ? 'defeat' : 'draw'}">
          ${uiIcon(this.end.winner === 'A' ? 'star' : 'skull')}
          <strong>${this.end.winner === 'A' ? 'Victory!' : this.end.winner === 'B' ? 'Defeat' : 'Draw'}</strong>
          <span>Leaving in ${Math.max(0, Math.ceil((this.end.exitAt - now) / 1000))}s</span>
        </div>` : '';
        const footer = this.end
            ? `<button class="ui-button" data-pvp-leave>Leave match</button>`
            : `<span class="pvp-score-hint">${esc(';')} — close</span>`;
        this.element.innerHTML = `<div class="pvp-score-window ui-window">
      <header class="ui-window-header"><span class="ui-header-emblem">${uiIcon('sword')}</span>
        <h2>${esc(map)}</h2><span class="pvp-score-mode">${esc(pvpBracketLabel(match.bracket))}</span>
        <span class="pvp-score-points" aria-label="Score"><b>${scoreA}</b> – <b>${scoreB}</b></span>
      </header>
      ${banner}
      <div class="pvp-score-body ui-scroll-area">${this.teamTable('A', teamA)}${this.teamTable('B', teamB)}</div>
      <footer class="ui-window-footer">${footer}</footer>
    </div>`;
    }
}
