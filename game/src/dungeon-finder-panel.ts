/**
 * Dungeon Finder window (WotLK RDF): the queueable dungeon list with level
 * ranges, a Queue action per row and a queued state that counts down a short
 * estimated wait before handing off to the durable queueForDungeon command.
 * A persisted queue marker (failed/interrupted entry) shows a banner with
 * Enter now / Leave Queue so the queue is resumable.
 *
 * The panel only renders state; all mutation goes through `actions`, which the
 * host wires to dungeon-finder-command.ts inside the durable-action barrier.
 */
import type { Player } from './model.ts';
import { attachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import {
  DUNGEON_FINDER_RULES, RDF_DUNGEONS, dungeonFinderDungeon, dungeonFinderProblem,
  dungeonFinderWaitSeconds, type DungeonFinderEntry,
} from './dungeon-finder-content.ts';
import { dungeonFinderOf, queuedDungeon } from './dungeon-finder-state.ts';
import './dungeon-finder-panel.css';

const e = escapeUI;

/** What the host (game.ts) provides. `queue` runs queueForDungeon and completes
 * the travel transition; `leave` runs leaveQueue. Both resolve false on a
 * refused/failed durable action — the panel then shows the status line. */
export interface DungeonFinderActions {
  close(): void;
  queue(dungeonId: string): Promise<boolean>;
  leave(): Promise<boolean>;
}

export class DungeonFinderPanel {
  readonly element = document.createElement('section');
  private focus: { dispose(): void } | null = null;
  private timer = 0;
  private player?: Player;
  private pending: { id: string; endsAt: number } | null = null;
  private busy = false;
  private status = '';
  private readonly actions: DungeonFinderActions;

  constructor(mount: HTMLElement, actions: DungeonFinderActions) {
    this.actions = actions;
    this.element.className = 'dungeon-finder-panel ui-window';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-label', 'Dungeon Finder');
    mount.append(this.element);
    attachPanelFrame(this.element, 'dungeonFinder');
    this.element.addEventListener('click', event => this.click(event));
    this.element.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      this.actions.close();
    });
  }

  get opened() { return !this.element.hidden; }

  open(player: Player): void {
    this.stopTimer();
    this.player = player;
    this.pending = null;
    this.busy = false;
    this.status = '';
    this.element.hidden = false;
    this.render();
    this.focus?.dispose();
    this.focus = trapDialogFocus(this.element);
  }

  close(): void {
    this.stopTimer();
    this.pending = null;
    this.busy = false;
    this.element.hidden = true;
    this.focus?.dispose();
    this.focus = null;
  }

  dispose(): void {
    this.close();
    this.element.remove();
  }

  private click(event: MouseEvent): void {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || button.disabled || this.busy) return;
    if (button.hasAttribute('data-close')) { this.actions.close(); return; }
    const queueId = button.dataset.queue;
    if (queueId !== undefined) {
      const entry = dungeonFinderDungeon(queueId);
      if (!entry || !this.player) return;
      this.beginWait(entry);
      return;
    }
    if (button.hasAttribute('data-enter-now')) {
      const queued = this.player ? queuedDungeon(this.player.character) : undefined;
      if (queued) void this.enter(queued);
      return;
    }
    if (button.hasAttribute('data-leave')) {
      // A pending wait is local theater — cancel it without a durable write.
      if (this.pending) { this.stopTimer(); this.pending = null; this.status = ''; this.render(); return; }
      void this.leave();
    }
  }

  /** The cosmetic "party is assembling" wait; the durable queue happens on entry. */
  private beginWait(entry: DungeonFinderEntry): void {
    this.pending = { id: entry.id, endsAt: performance.now() + dungeonFinderWaitSeconds(entry.id) * 1000 };
    this.status = '';
    this.render();
    this.tick();
  }

  private tick = (): void => {
    this.timer = 0;
    if (!this.pending || this.element.hidden) return;
    const left = this.pending.endsAt - performance.now();
    if (left <= 0) {
      const entry = dungeonFinderDungeon(this.pending.id);
      this.pending = null;
      if (entry) void this.enter(entry);
      return;
    }
    const label = this.element.querySelector<HTMLElement>('[data-wait]');
    if (label) label.textContent = `${Math.ceil(left / 1000)}s`;
    this.timer = window.setTimeout(this.tick, 200);
  };

  private async enter(entry: DungeonFinderEntry): Promise<void> {
    this.busy = true;
    this.render();
    try {
      if (await this.actions.queue(entry.id)) return; // host swaps the world and closes us
      this.status = 'Could not enter the dungeon. Check your level and try again.';
    } catch {
      this.status = 'Could not save the queue. Please try again.';
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async leave(): Promise<void> {
    this.busy = true;
    this.stopTimer();
    this.pending = null;
    try {
      if (await this.actions.leave()) this.status = '';
      else this.status = 'Could not leave the queue.';
    } catch {
      this.status = 'Could not save. Please try again.';
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private stopTimer(): void {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = 0;
  }

  render(): void {
    this.stopTimer();
    const player = this.player;
    const queued = player ? queuedDungeon(player.character) : undefined;
    const queuedAt = player ? dungeonFinderOf(player.character)?.queuedAt : undefined;
    const pendingEntry = this.pending ? dungeonFinderDungeon(this.pending.id) : undefined;
    const rows = RDF_DUNGEONS.map(entry => {
      const problem = player ? dungeonFinderProblem(entry, player) : 'No character loaded.';
      const isQueued = queued?.id === entry.id || pendingEntry?.id === entry.id;
      return `<li class="rdf-row${problem ? ' locked' : ''}${isQueued ? ' queued' : ''}">
        <div class="rdf-info">
          <span class="rdf-name">${e(entry.name)}</span>
          <span class="rdf-zone">${e(entry.zone)}</span>
        </div>
        <span class="rdf-level">Lv ${entry.levelMin}–${entry.levelMax}</span>
        ${isQueued
          ? '<span class="ui-badge rdf-badge">Queued</span>'
          : `<button class="ui-button ui-button--quiet rdf-queue" data-queue="${e(entry.id)}"${problem || this.busy || this.pending ? ' disabled' : ''}
              data-tooltip="${e(problem ?? 'Queue for this dungeon')}">${problem ? e(problem) : 'Queue'}</button>`}
      </li>`;
    }).join('');

    this.element.innerHTML = `<header class="ui-window-header">
        <div class="rdf-heading"><span class="ui-header-emblem" aria-hidden="true">${uiIcon('portal')}</span>
        <div><small>LOOKING FOR DUNGEON</small><h2>Dungeon Finder</h2></div></div>
        <button class="ui-button ui-button--icon" data-close aria-label="Close dungeon finder">${uiIcon('close')}</button>
      </header>
      <div class="ui-window-body rdf-body">
        ${pendingEntry ? `<div class="rdf-status-card" role="status">
            <strong>${e(pendingEntry.name)}</strong>
            <span>Your party is assembling… estimated wait <b data-wait>${dungeonFinderWaitSeconds(pendingEntry.id)}s</b></span>
            <button class="ui-button ui-button--danger" data-leave${this.busy ? ' disabled' : ''}>Leave Queue</button>
          </div>` : ''}
        ${!pendingEntry && queued ? `<div class="rdf-status-card" role="status">
            <strong>${e(queued.name)}</strong>
            <span>Queued since ${new Date(queuedAt ?? 0).toLocaleTimeString()}</span>
            <span class="rdf-actions">
              <button class="ui-button ui-button--primary" data-enter-now${this.busy ? ' disabled' : ''}>Enter now</button>
              <button class="ui-button ui-button--danger" data-leave${this.busy ? ' disabled' : ''}>Leave Queue</button>
            </span>
          </div>` : ''}
        ${player && player.level < DUNGEON_FINDER_RULES.minimumLevel
          ? `<p class="rdf-note">The Dungeon Finder unlocks at level ${DUNGEON_FINDER_RULES.minimumLevel}.</p>` : ''}
        <ul class="rdf-list">${rows}</ul>
        <p class="rdf-note" role="status">${e(this.status)}</p>
      </div>`;
    if (this.pending) this.tick();
  }
}
