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
  DUNGEON_FINDER_RULES, RDF_DUNGEONS, RDF_RAIDS, dungeonFinderDungeon, dungeonFinderProblem,
  dungeonFinderWaitSeconds, type DungeonFinderEntry,
} from './dungeon-finder-content.ts';
import { dungeonFinderOf, queuedDungeon } from './dungeon-finder-state.ts';
import { HEROIC_RULES, heroicDungeonsEnabled } from './heroic-content.ts';
import './dungeon-finder-panel.css';

const e = escapeUI;

/** What the host (game.ts) provides. `queue` runs queueForDungeon and completes
 * the travel transition; `leave` runs leaveQueue. Both resolve false on a
 * refused/failed durable action — the panel then shows the status line. */
export interface DungeonFinderActions {
  close(): void;
  queue(dungeonId: string, heroic: boolean, group: boolean): Promise<boolean>;
  leave(): Promise<boolean>;
}

export class DungeonFinderPanel {
  readonly element = document.createElement('section');
  private focus: { dispose(): void } | null = null;
  private timer = 0;
  private player?: Player;
  private pending: { id: string; heroic: boolean; group: boolean; endsAt: number } | null = null;
  private heroic = false;
  private busy = false;
  private status = '';
  private tab: 'dungeons' | 'raids' = 'dungeons';
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
    const queueId = button.dataset.queue ?? button.dataset.group;
    if (queueId !== undefined) {
      const entry = dungeonFinderDungeon(queueId);
      if (!entry || !this.player) return;
      this.beginWait(entry, entry.kind === 'raid' ? false : this.heroic, button.dataset.group !== undefined);
      return;
    }
    if (button.hasAttribute('data-heroic')) {
      this.heroic = !this.heroic;
      this.render();
      return;
    }
    const tab = button.dataset.tab;
    if (tab === 'dungeons' || tab === 'raids') {
      if (this.tab !== tab) { this.tab = tab; this.render(); }
      return;
    }
    if (button.hasAttribute('data-enter-now')) {
      const queued = this.player ? queuedDungeon(this.player.character) : undefined;
      const marker = this.player ? dungeonFinderOf(this.player.character) : undefined;
      if (queued) void this.enter(queued, marker?.heroic === true, marker?.party === true);
      return;
    }
    if (button.hasAttribute('data-leave')) {
      // A pending wait is local theater — cancel it without a durable write.
      if (this.pending) { this.stopTimer(); this.pending = null; this.status = ''; this.render(); return; }
      void this.leave();
    }
  }

  /** The cosmetic "party is assembling" wait; the durable queue happens on entry. */
  private beginWait(entry: DungeonFinderEntry, heroic: boolean, group: boolean): void {
    this.pending = { id: entry.id, heroic, group, endsAt: performance.now() + dungeonFinderWaitSeconds(entry.id) * 1000 };
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
      const heroic = this.pending.heroic, group = this.pending.group;
      this.pending = null;
      if (entry) void this.enter(entry, heroic, group);
      return;
    }
    const label = this.element.querySelector<HTMLElement>('[data-wait]');
    if (label) label.textContent = `${Math.ceil(left / 1000)}s`;
    this.timer = window.setTimeout(this.tick, 200);
  };

  private async enter(entry: DungeonFinderEntry, heroic: boolean, group: boolean): Promise<void> {
    this.busy = true;
    this.render();
    try {
      if (await this.actions.queue(entry.id, heroic, group)) return; // host swaps the world and closes us
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
    const marker = player ? dungeonFinderOf(player.character) : undefined;
    const queuedAt = marker?.queuedAt;
    const queuedHeroic = marker?.heroic === true;
    const pendingEntry = this.pending ? dungeonFinderDungeon(this.pending.id) : undefined;
    const heroic = this.heroic && heroicDungeonsEnabled();
    const raids = this.tab === 'raids';
    const rows = (raids ? RDF_RAIDS : RDF_DUNGEONS).map(entry => {
      const problem = player ? dungeonFinderProblem(entry, player, heroic) : 'No character loaded.';
      const isQueued = queued?.id === entry.id || pendingEntry?.id === entry.id;
      const raid = entry.kind === 'raid';
      return `<li class="rdf-row${problem ? ' locked' : ''}${isQueued ? ' queued' : ''}">
        <div class="rdf-info">
          <span class="rdf-name">${e(entry.name)}${heroic && !raid ? ' <span class="ui-badge rdf-heroic-badge">Heroic</span>' : ''}</span>
          <span class="rdf-zone">${e(entry.zone)}${raid && entry.boss ? ` · ${e(entry.boss)}` : ''}</span>
        </div>
        <span class="rdf-level">${heroic && !raid ? `Lv ${HEROIC_RULES.level}` : entry.levelMin === entry.levelMax ? `Lv ${entry.levelMin}` : `Lv ${entry.levelMin}–${entry.levelMax}`}</span>
        ${isQueued
          ? '<span class="ui-badge rdf-badge">Queued</span>'
          : `<span class="rdf-actions">
              <button class="ui-button ui-button--quiet rdf-queue" data-queue="${e(entry.id)}"${problem || this.busy || this.pending ? ' disabled' : ''}
                data-tooltip="${e(problem ?? `Queue solo for this ${raid ? 'raid' : 'dungeon'}`)}">${problem ? e(problem) : 'Queue'}</button>
              <button class="ui-button ui-button--quiet rdf-group" data-group="${e(entry.id)}"${problem || this.busy || this.pending ? ' disabled' : ''}
                data-tooltip="${e(problem ?? 'Queue with a full AI party (tank, healer, 2 dps)')}">Find Group</button>
            </span>`}
      </li>`;
    }).join('');

    this.element.innerHTML = `<header class="ui-window-header">
        <div class="rdf-heading"><span class="ui-header-emblem" aria-hidden="true">${uiIcon('portal')}</span>
        <div><small>LOOKING FOR DUNGEON</small><h2>Dungeon Finder</h2></div></div>
        <button class="ui-button ui-button--icon" data-close aria-label="Close dungeon finder">${uiIcon('close')}</button>
      </header>
      <div class="ui-window-body rdf-body">
        <div class="rdf-difficulty rdf-tabs" role="group" aria-label="Finder list">
          <button class="ui-button ui-button--quiet${raids ? '' : ' active'}" data-tab="dungeons"${this.busy || this.pending ? ' disabled' : ''}>Dungeons</button>
          <button class="ui-button ui-button--quiet${raids ? ' active' : ''}" data-tab="raids"${this.busy || this.pending ? ' disabled' : ''}>Raids</button>
        </div>
        ${!raids && heroicDungeonsEnabled() ? `<div class="rdf-difficulty" role="group" aria-label="Dungeon difficulty">
          <button class="ui-button ui-button--quiet${heroic ? '' : ' active'}" data-heroic${this.busy || this.pending ? ' disabled' : ''}>Normal</button>
          <button class="ui-button ui-button--quiet${heroic ? ' active' : ''}" data-heroic${this.busy || this.pending ? ' disabled' : ''}
            data-tooltip="Heroic: level ${HEROIC_RULES.level} floors, promoted enemies, Emblems of Heroism">Heroic</button>
        </div>` : ''}
        ${pendingEntry ? `<div class="rdf-status-card" role="status">
            <strong>${e(pendingEntry.name)}${this.pending?.heroic ? ' <span class="ui-badge rdf-heroic-badge">Heroic</span>' : ''}</strong>
            <span>Your party is assembling… estimated wait <b data-wait>${dungeonFinderWaitSeconds(pendingEntry.id)}s</b></span>
            <button class="ui-button ui-button--danger" data-leave${this.busy ? ' disabled' : ''}>Leave Queue</button>
          </div>` : ''}
        ${!pendingEntry && queued ? `<div class="rdf-status-card" role="status">
            <strong>${e(queued.name)}${queuedHeroic ? ' <span class="ui-badge rdf-heroic-badge">Heroic</span>' : ''}</strong>
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
