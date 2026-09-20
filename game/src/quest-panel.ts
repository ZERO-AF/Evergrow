/** Quest log panel (L) + giver dialog + HUD tracker (docs/wow-deepening.md §1).
 * Presentation only — every mutation routes through quest-command hooks.
 * Follows the JourneyPanel lifecycle: `update(player)` per frame, `open()` /
 * `close()` driven by the panel coordinator or a plain overlay. */
import type { Player } from './model.ts';
import { attachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { formatWalletCompact } from './currency.ts';
import { getJourneyLogAnchor } from './map-view.ts';
import { GAME_FEATURES } from './game-features.ts';
import {
  QUEST_BY_ID, turnInSpec, type QuestDef, type QuestId,
} from './quest-content.ts';
import {
  objectiveText, questItemName, questLog, questState,
} from './quest-state.ts';
import { giverLabel, type QuestGreeting } from './quest-command.ts';
import './quest-panel.css';
import './hud-sidebar.css';

const e = escapeUI;

export interface QuestPanelHooks {
  close(): void;
  /** Durable commands; the host wraps them in its durable() + notify path. */
  accept(id: QuestId): void;
  turnIn(id: QuestId): void;
  abandon(id: QuestId): void;
  /** Optional: open the world map focused on this quest's objective. */
  map?(id: QuestId): void;
  /** Optional: giver is a service NPC — open its trade panel instead. */
  service?(): void;
}
const TYPE_LABELS: Record<QuestDef['type'], string> = {
  kill: 'Kill', collect: 'Collect', explore: 'Explore', boss: 'Boss',
};

export class QuestPanel {
  readonly element: HTMLElement;
  readonly tracker: HTMLElement;
  private abort = new AbortController();
  private focus: { dispose(): void } | null = null;
  private player: Player | null = null;
  private selected: QuestId | null = null;
  private greeting: QuestGreeting | null = null;
  private signature = '';
  private trackerSignature = '';
  private readonly hooks: QuestPanelHooks;

  constructor(mount: HTMLElement, hudMount: HTMLElement, hooks: QuestPanelHooks) {
    this.hooks = hooks;
    this.element = document.createElement('section');
    this.element.className = 'quest-panel';
    this.element.hidden = true;
    mount.append(this.element);
    attachPanelFrame(this.element, 'quests');
    this.tracker = document.createElement('aside');
    this.tracker.className = 'quest-tracker hud-sidebar-surface';
    this.tracker.hidden = true;
    this.tracker.setAttribute('aria-label', 'Quest tracker');
    hudMount.append(this.tracker);
    this.tracker.addEventListener('click', event => {
      if ((event.target as HTMLElement).closest('button')) this.open();
    }, { signal: this.abort.signal });
    this.element.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || !this.player) return;
      if (b.dataset.close !== undefined) this.hooks.close();
      else if (b.dataset.select) { this.selected = b.dataset.select; this.render(); }
      else if (b.dataset.accept) this.hooks.accept(b.dataset.accept);
      else if (b.dataset.turnin) this.hooks.turnIn(b.dataset.turnin);
      else if (b.dataset.abandon) this.hooks.abandon(b.dataset.abandon);
      else if (b.dataset.map && this.selected) this.hooks.map?.(this.selected);
      else if (b.dataset.service !== undefined) this.hooks.service?.();
    }, { signal: this.abort.signal });
  }

  /** Refresh the projection; re-renders only when open and the ledger moved. */
  update(player: Player, playing: boolean, width: number, height: number): void {
    this.player = player;
    const enabled = GAME_FEATURES.quests;
    const { active, complete } = questLog(player);
    this.tracker.hidden = !enabled || !playing || (!active.length && !complete.length);
    if (!this.tracker.hidden) {
      const anchor = getJourneyLogAnchor(width, height);
      this.tracker.style.left = `${anchor.x / width * 100}%`;
      this.tracker.style.width = `${anchor.width / width * 100}%`;
      this.tracker.style.top = `calc(${anchor.y / height * 100}% + var(--quest-tracker-offset, 0px))`;
      const rows = [...complete, ...active].map(def => {
        const state = questState(player, def.id)!;
        const lines = def.objectives.map((objective, i) =>
          `<span class="quest-tracker-objective ${(state.progress[i] ?? 0) >= objective.count ? 'is-done' : ''}">${e(objectiveText(objective, state.progress[i] ?? 0))}</span>`).join('');
        return `<button class="quest-tracker-row ${state.status === 'complete' ? 'is-complete' : ''}" data-open>
          <strong>${e(def.name)}</strong>${state.status === 'complete' ? '<span class="quest-tracker-objective is-done">Ready to turn in</span>' : lines}</button>`;
      }).join('');
      const html = `<header><button class="quest-tracker-title" data-open>Quests<kbd class="hud-sidebar-key">L</kbd></button></header>${rows}`;
      if (html !== this.trackerSignature) { this.tracker.innerHTML = html; this.trackerSignature = html; }
    }
    if (this.element.hidden) return;
    const signature = JSON.stringify([player.quests ?? {}, player.level, this.greeting?.label ?? '', this.selected]);
    if (signature !== this.signature) { this.signature = signature; this.render(); }
  }

  /** Quest log (L). */
  open(id?: QuestId): void {
    if (!this.player) return;
    this.greeting = null;
    const { active, complete } = questLog(this.player);
    this.selected = id ?? complete[0]?.id ?? active[0]?.id ?? null;
    this.signature = '';
    this.element.hidden = false;
    this.render();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal });
  }

  /** Giver dialog (E on an NPC/poster/POI with quest business). */
  openGiver(greeting: QuestGreeting): void {
    if (!this.player) return;
    this.greeting = greeting;
    this.selected = greeting.turnIns[0]?.id ?? greeting.offers[0]?.id ?? greeting.upcoming[0]?.id ?? greeting.pending[0]?.id ?? null;
    this.signature = '';
    this.element.hidden = false;
    this.render();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal });
  }

  toggle(): void { if (this.element.hidden) this.open(); else this.hooks.close(); }
  get isOpen(): boolean { return !this.element.hidden; }

  close(): void {
    this.focus?.dispose();
    this.focus = null;
    this.greeting = null;
    this.element.hidden = true;
  }

  private rewardLine(def: QuestDef): string {
    const parts = [`${def.rewards.xp} XP`];
    if (def.rewards.gold) parts.push(formatWalletCompact(def.rewards.gold));
    for (const item of def.rewards.items ?? []) parts.push(questItemName(item));
    if (def.rewards.skillPoints) parts.push(`${def.rewards.skillPoints} skill point${def.rewards.skillPoints > 1 ? 's' : ''}`);
    return parts.join(' · ');
  }

  private questRow(def: QuestDef, mark: string, extra = ''): string {
    const selected = this.selected === def.id;
    return `<button class="quest-list-row ${selected ? 'is-selected' : ''}" data-select="${e(def.id)}" aria-pressed="${selected}">
      <span class="quest-list-mark">${mark}</span><span>${e(def.name)}</span>
      <span class="quest-list-level">${def.level}${extra}</span></button>`;
  }

  private detail(def: QuestDef): string {
    const player = this.player!;
    const state = questState(player, def.id);
    const objectives = def.objectives.length
      ? `<ul class="quest-objectives">${def.objectives.map((objective, i) => {
          const done = state ? (state.progress[i] ?? 0) >= objective.count : false;
          return `<li class="${done ? 'is-done' : ''}">${e(objectiveText(objective, state?.progress[i] ?? 0))}</li>`;
        }).join('')}</ul>`
      : `<p class="quest-objectives quest-objectives--plain">${e('Report back to ' + giverLabel(turnInSpec(def)) + '.')}</p>`;
    const status = state?.status === 'complete' ? `<p class="quest-ready">Return to ${e(giverLabel(turnInSpec(def)))}.</p>` : '';
    const actions = this.greeting
      ? `${state?.status === 'complete' ? `<button class="ui-button ui-button--primary" data-turnin="${e(def.id)}">Complete quest</button>` : ''}
         ${!state ? `<button class="ui-button ui-button--primary" data-accept="${e(def.id)}" ${player.level < def.level ? 'disabled' : ''}>${player.level < def.level ? `Requires level ${def.level}` : 'Accept quest'}</button>` : ''}
         ${state?.status === 'active' ? `<button class="ui-button" data-abandon="${e(def.id)}">Abandon</button>` : ''}`
      : `${this.hooks.map ? '<button class="ui-button" data-map>Show on map</button>' : ''}
         ${state?.status === 'active' ? `<button class="ui-button" data-abandon="${e(def.id)}">Abandon</button>` : ''}`;
    return `<h3>${e(def.name)}</h3>
      <div class="quest-meta"><span class="ui-badge">Level ${def.level}</span><span class="ui-badge">${TYPE_LABELS[def.type]}</span>${def.zone ? `<span>${e(def.zone)}</span>` : ''}</div>
      <p class="quest-description">${e(def.description)}</p>
      ${objectives}${status}
      <div class="quest-rewards"><h4>Rewards</h4><p>${e(this.rewardLine(def))}</p></div>
      <div class="quest-actions">${actions}</div>`;
  }

  private render(): void {
    const player = this.player;
    if (!player) return;
    const focus = (document.activeElement as HTMLElement | null)?.dataset;
    if (this.greeting) {
      const g = this.greeting;
      const rows = [
        ...g.turnIns.map(def => this.questRow(def, '<span class="quest-mark quest-mark--turnin">?</span>')),
        ...g.offers.map(def => this.questRow(def, '<span class="quest-mark">!</span>')),
        ...g.pending.map(def => this.questRow(def, '<span class="quest-mark quest-mark--pending">?</span>')),
        ...g.upcoming.map(def => this.questRow(def, '<span class="quest-mark quest-mark--locked">!</span>')),
      ].join('');
      const def = this.selected ? QUEST_BY_ID[this.selected] : undefined;
      this.element.innerHTML = `<section class="ui-window quest-window" role="dialog" aria-modal="true" aria-labelledby="quest-title">
        <header class="ui-window-header"><span class="quest-heading-icon">${uiIcon('journal')}</span><h2 class="ui-title" id="quest-title">${e(g.label)}</h2><button class="ui-button ui-button--icon" data-close aria-label="Close">×</button></header>
        <div class="quest-columns"><nav class="quest-list ui-scroll-area" aria-label="Quests">${rows || '<div class="quest-empty">No quests here.</div>'}</nav>
        <div class="quest-detail ui-scroll-area">${def ? this.detail(def) : ''}</div></div>
        <footer class="ui-window-footer"><span>${g.service ? 'This contact also offers services.' : ''}</span><span>${g.service ? '<button class="ui-button" data-service>Services</button>' : ''}<span>Esc <span>Close</span></span></span></footer></section>`;
    } else {
      const { active, complete, turnedIn } = questLog(player);
      const rows = [
        complete.length ? `<h3>Ready to turn in</h3>${complete.map(def => this.questRow(def, '<span class="quest-mark quest-mark--turnin">?</span>')).join('')}` : '',
        active.length ? `<h3>Active</h3>${active.map(def => this.questRow(def, '<span class="quest-mark">◆</span>')).join('')}` : '',
        turnedIn.length ? `<h3>Completed</h3>${turnedIn.slice(-8).reverse().map(def => this.questRow(def, '<span class="quest-mark quest-mark--done">✓</span>')).join('')}` : '',
      ].join('');
      const def = this.selected ? QUEST_BY_ID[this.selected] : undefined;
      this.element.innerHTML = `<section class="ui-window quest-window" role="dialog" aria-modal="true" aria-labelledby="quest-title">
        <header class="ui-window-header"><span class="quest-heading-icon">${uiIcon('journal')}</span><h2 class="ui-title" id="quest-title">Quest Log</h2><button class="ui-button ui-button--icon" data-close aria-label="Close quest log">×</button></header>
        <div class="quest-columns"><nav class="quest-list ui-scroll-area" aria-label="Quests">${rows || '<div class="quest-empty">No quests yet. Look for <span class="quest-mark">!</span> over townsfolk and wanted posters.</div>'}</nav>
        <div class="quest-detail ui-scroll-area">${def ? this.detail(def) : '<div class="quest-empty">Select a quest.</div>'}</div></div>
        <footer class="ui-window-footer"><span></span><span>L / Esc <span>Close</span></span></footer></section>`;
    }
    if (focus?.select) this.element.querySelector<HTMLElement>(`[data-select="${CSS.escape(focus.select)}"]`)?.focus({ preventScroll: true });
  }

  dispose(): void {
    this.close();
    this.abort.abort();
    this.element.remove();
    this.tracker.remove();
  }
}
