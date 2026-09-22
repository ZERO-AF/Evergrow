/** Reputation panel (U) — projection of `player.reputation` (docs/wow-deepening.md,
 * second wave). Lists every faction with its WoW standing bar, the vendor
 * discount earned, and claimable quartermaster rewards. Presentation only —
 * claims route through the `claim` hook (repClaimReward in reputation-command). */
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { attachPanelFrame } from './panel-frames.ts';
import { formatWalletCompact } from './currency.ts';
import type { Player } from './model.ts';
import {
  EXALTED_CAP, FACTIONS, STANDING_BY_TIER, STANDING_DISCOUNT,
  type FactionDef, type FactionId, type FactionReward,
} from './reputation-content.ts';
import {
  knownFactions, reputationPoints, rewardClaimed, rewardProblem, standingIndex, standingProgress,
  type ReputationCarrier,
} from './reputation-state.ts';
const e = escapeUI;

export interface ReputationPanelHooks {
  close(): void;
  /** Durable reward claim; the host wraps it in its durable() + notify path. */
  claim(faction: FactionId, reward: string): void;
}

export class ReputationPanel {
  readonly element: HTMLElement;
  private abort = new AbortController();
  private focus: ReturnType<typeof trapDialogFocus> | null = null;
  private player: (Player & ReputationCarrier) | null = null;
  private signature = '';
  private readonly hooks: ReputationPanelHooks;

  constructor(mount: HTMLElement, hooks: ReputationPanelHooks) {
    this.hooks = hooks;
    this.element = document.createElement('section');
    this.element.className = 'reputation-panel';
    this.element.hidden = true;
    mount.append(this.element);
    attachPanelFrame(this.element, 'reputation');
    this.element.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      if (b.dataset.close !== undefined) this.hooks.close();
      else if (b.dataset.claim) this.hooks.claim(b.dataset.faction as FactionId, b.dataset.claim);
    }, { signal: this.abort.signal });
  }

  /** Refresh the projection; re-renders only when open and the ledger moved.
   * `reputation` joins Player with the integrator's checkpoint field; widen here. */
  update(player: Player): void {
    this.player = player as Player & ReputationCarrier;
    if (this.element.hidden) return;
    const signature = JSON.stringify(this.player?.reputation ?? {});
    if (signature !== this.signature) { this.signature = signature; this.render(); }
  }

  open(): void {
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
    this.element.hidden = true;
  }

  private bar(player: ReputationCarrier, faction: FactionDef): string {
    const { points, standing, into, span } = standingProgress(player, faction.id);
    const exalted = standing.tier === 'exalted';
    const width = exalted ? 100 : span > 0 ? Math.min(100, into / span * 100) : 0;
    const meta = exalted
      ? `${points.toLocaleString()} / ${EXALTED_CAP.toLocaleString()}`
      : `${into.toLocaleString()} / ${span.toLocaleString()}`;
    return `<div class="reputation-bar" role="meter" aria-label="${e(faction.name)} standing"
        aria-valuemin="0" aria-valuemax="${span || EXALTED_CAP}" aria-valuenow="${exalted ? points : into}"
        aria-valuetext="${e(standing.label)}">
      <i style="width:${width}%;background:${standing.color}"></i>
      <span class="reputation-bar-label" style="color:${standing.color}">${e(standing.label)}</span>
      <span class="reputation-bar-meta">${meta}</span></div>`;
  }

  private rewardRow(player: ReputationCarrier, faction: FactionDef, reward: FactionReward): string {
    const claimed = rewardClaimed(player, faction.id, reward);
    const problem = rewardProblem(player, faction, reward);
    const gate = STANDING_BY_TIER[reward.standing];
    const detail = reward.kind === 'gear' ? `${reward.slot} · ${reward.tier}`
      : reward.kind === 'tabard' ? 'tabard · cloak'
      : reward.kind === 'gold' ? formatWalletCompact(reward.copper)
      : `${reward.count}× material`;
    const action = claimed ? '<span class="reputation-reward-claimed">Claimed</span>'
      : problem
        ? `<span class="reputation-reward-gate" style="color:${gate.color}">${e(gate.label)}</span>`
        : `<button class="ui-button reputation-claim" data-faction="${e(faction.id)}" data-claim="${e(reward.id)}">Claim</button>`;
    return `<li class="reputation-reward ${claimed ? 'is-claimed' : ''}">
      <span class="reputation-reward-name">${e(reward.name)}</span>
      <span class="reputation-reward-detail">${e(detail)}</span>${action}</li>`;
  }

  private row(player: ReputationCarrier, faction: FactionDef, known: boolean): string {
    const discount = STANDING_DISCOUNT[standingProgress(player, faction.id).standing.tier];
    const perks = discount > 0 ? `<span class="reputation-perk">${Math.round(discount * 100)}% vendor discount</span>` : '';
    const rewards = faction.rewards.length
      ? `<ul class="reputation-rewards">${faction.rewards.map(r => this.rewardRow(player, faction, r)).join('')}</ul>` : '';
    return `<article class="reputation-row ${known ? '' : 'is-unknown'}">
      <span class="reputation-icon" style="color:${faction.color}">${uiIcon(faction.icon)}</span>
      <div class="reputation-body">
        <div class="reputation-name">${e(faction.name)}${perks}</div>
        <div class="reputation-desc">${e(faction.description)}</div>
        ${this.bar(player, faction)}
        ${rewards}
      </div></article>`;
  }

  private render(): void {
    const player = this.player;
    if (!player) return;
    const known = new Set(knownFactions(player).map(faction => faction.id));
    const sorted = [...FACTIONS].sort((a, b) =>
      (known.has(b.id) ? 1 : 0) - (known.has(a.id) ? 1 : 0)
      || standingIndex(standingProgress(player, b.id).standing.tier) - standingIndex(standingProgress(player, a.id).standing.tier)
      || reputationPoints(player, b.id) - reputationPoints(player, a.id));
    const focus = (document.activeElement as HTMLElement | null)?.dataset;
    this.element.innerHTML = `<section class="ui-window reputation-window" role="dialog" aria-modal="true" aria-labelledby="reputation-title">
      <header class="ui-window-header"><span class="reputation-heading-icon">${uiIcon('star')}</span><h2 class="ui-title" id="reputation-title">Reputation</h2><button class="ui-button ui-button--icon" data-close aria-label="Close reputation">×</button></header>
      <div class="reputation-summary"><strong>${known.size} / ${FACTIONS.length}</strong><span>factions known · discounts apply at Friendly and above</span></div>
      <div class="reputation-list ui-scroll-area">${sorted.map(faction => this.row(player, faction, known.has(faction.id))).join('')}</div>
      <footer class="ui-window-footer"><span></span><span>U / Esc <span>Close</span></span></footer></section>`;
    if (focus?.claim) this.element.querySelector<HTMLElement>(`[data-claim="${CSS.escape(focus.claim)}"]`)?.focus({ preventScroll: true });
  }

  dispose(): void {
    this.close();
    this.abort.abort();
    this.element.remove();
  }
}
