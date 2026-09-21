import { BuffBar } from './buff-bar.ts';
import type { ActiveBuff } from './active-buffs.ts';
import { PauseMenu, type PauseActions } from './pause-menu.ts';
import type { PauseNavigation } from './pause-navigation.ts';
import type { GamepadInput } from './gamepad-input.ts';
import './travel-ui.css';
import { GameNotifications } from './notifications.ts';
import { getHUDLayout } from './hud.ts';
import { HUDShortcutMenu } from './hud-shortcut-menu.ts';
import type { HUDRect } from './hud.ts';
import { getMinimapRect, getMinimapHomeRect } from './map-view.ts';
import type { GamePhase } from './game-phase.ts';
import { gameMenuMarkup } from './game-menu.ts';
import { trapDialogFocus, uiIcon, escapeUI } from './ui-components.ts';
import { PORTAL_RULES } from './travel.ts';

interface ShellActions extends PauseActions { lastSavedAt?(): number | undefined; saveLocation?(): 'Local' | 'Online'; shortcutMenuChanged?(): void; homePortal?(): void; play(): void; openMap(): void; openCharacter(): void; openSkills(): void; openTransmog?(): void; canReleaseSpirit?(): boolean; releaseSpirit?(): void; resurrectGhost?(mode: 'corpse' | 'healer'): void; }

/** Owns DOM presentation and its listeners; it never reads or mutates simulation state. */
export class GameShell {
  readonly canvas: HTMLCanvasElement;
  readonly uiCanvas: HTMLCanvasElement;
  readonly mapMount: HTMLElement;
  readonly panelMount: HTMLElement;
  readonly titleMount: HTMLElement;
  private readonly element: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly status: HTMLElement;
  readonly notifications: GameNotifications;
  private readonly abort = new AbortController();
  private menuAbort = new AbortController();
  private readonly actions: ShellActions;
  readonly shortcutMenu: HUDShortcutMenu;
  readonly buffs: BuffBar;
  readonly targetBuffs: BuffBar;
  private targetId: number | null = null;
  private readonly spiritPrompt: HTMLElement;
  setTargetEffects(target: { id: number; buffs: readonly ActiveBuff[]; x: number; y: number; opacity: number } | null): void {
    if (target?.id !== this.targetId) this.targetBuffs.hide();
    this.targetId = target?.id ?? null;
    this.targetBuffs.update(this.controls.hidden ? [] : target?.buffs ?? []);
    if (target) {
      this.targetBuffs.element.style.left = `${target.x * 100}%`;
      this.targetBuffs.element.style.top = `${target.y * 100}%`;
      this.targetBuffs.element.style.opacity = String(target.opacity);
    }
  }
  setBuffs(buffs: readonly ActiveBuff[]): void { this.buffs.update(this.controls.hidden ? [] : buffs); }
  private pauseMenu: PauseMenu | null = null;
  private saveMessage = '';
  private pauseNavigation: PauseNavigation = { category: 'character', focus: null };
  backInMenu(): boolean { return this.pauseMenu?.back() ?? false; }
  refreshOptions(): void { this.pauseMenu?.refresh(); }
  updatePauseGamepad(pad: GamepadInput, now: number): void { this.pauseMenu?.updateGamepad(pad, now); }

  refreshBindings(): void {
    this.pauseMenu?.refresh();
    this.controls.querySelector('[data-hud="map"]')!.removeAttribute('aria-keyshortcuts');
    this.shortcutMenu.refreshBindings();
  }

  constructor(root: HTMLElement, actions: ShellActions) {
    this.actions = actions;
    root.innerHTML = `<div class="game-shell">
      <canvas id="game" tabindex="0" aria-label="Evergrow: wilderness and settlements"></canvas>
      <canvas id="game-ui" aria-hidden="true"></canvas>
      <nav id="hud-controls" class="hud-controls" aria-label="Character menus" hidden>
        <button type="button" class="hud-control" data-hud="menu" aria-haspopup="dialog" aria-label="Open character menus" data-tooltip="Character menus"></button>
        <button type="button" class="hud-control" data-hud="map" aria-label="World map" aria-keyshortcuts="M"
          aria-haspopup="dialog" data-tooltip="World map" data-tooltip-placement="left"></button>
        <button type="button" class="hud-control minimap-home" data-hud="home" aria-label="Home · Open town portal"
          data-tooltip="Home · Open town portal · ${PORTAL_RULES.channel} second cast" data-tooltip-placement="left" hidden>${uiIcon('home')}</button>
      </nav>
      <div id="title-mount"></div>
      <div id="world-map-mount"></div>
      <div id="character-panels-mount"></div>
      <div id="overlay" class="overlay ui-scroll-area" role="dialog" aria-modal="true" aria-labelledby="menu-title"></div>
      <div id="save-warning" class="save-warning" role="status" hidden></div>
      <div id="ghost-prompt" role="status" style="display:none;position:fixed;left:50%;bottom:18%;transform:translateX(-50%);align-items:center;gap:12px;padding:10px 16px;background:rgba(8,14,22,.82);border:1px solid rgba(160,190,230,.35);border-radius:8px;pointer-events:none;z-index:30"></div>
      <p id="state-description" class="sr-only" aria-live="polite"></p>
    </div>`;
    this.element = root.querySelector<HTMLElement>('.game-shell')!;
    this.canvas = root.querySelector<HTMLCanvasElement>('#game')!;
    this.uiCanvas = root.querySelector<HTMLCanvasElement>('#game-ui')!;
    this.mapMount = root.querySelector<HTMLElement>('#world-map-mount')!;
    this.panelMount = root.querySelector<HTMLElement>('#character-panels-mount')!;
    this.titleMount = root.querySelector<HTMLElement>('#title-mount')!;
    this.overlay = root.querySelector<HTMLElement>('#overlay')!;
    this.controls = root.querySelector<HTMLElement>('#hud-controls')!;
    this.status = root.querySelector<HTMLElement>('#state-description')!;
    this.notifications = new GameNotifications(this.element);
    this.spiritPrompt = root.querySelector<HTMLElement>('#ghost-prompt')!;
    this.buffs = new BuffBar(this.controls);
    this.targetBuffs = new BuffBar(this.controls, 'Target effects');
    this.targetBuffs.element.classList.add('target-buff-bar');
    const signal = this.abort.signal;
    this.element.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    this.controls.querySelector('[data-hud="map"]')!.addEventListener('click', actions.openMap, { signal });
    this.controls.querySelector('[data-hud="home"]')!.addEventListener('click', () => {
      if (this.homePortalVisible && this.navigationVisible) {
        this.canvas.focus({ preventScroll: true });
        actions.homePortal?.();
      }
    }, { signal });
    this.spiritPrompt.addEventListener('click', event => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-ghost]')?.dataset.ghost;
      if (action === 'corpse' || action === 'healer') this.actions.resurrectGhost?.(action);
    }, { signal });
    this.shortcutMenu = new HUDShortcutMenu(this.controls, this.controls.querySelector('[data-hud="menu"]')!, id => {
      if (id === 'character' || id === 'inventory') actions.openCharacter();
      else if (id === 'skilltree') actions.openSkills();
      else if (id === 'map') actions.openMap();
      else if (id === 'transmog') actions.openTransmog?.();
      else actions.openJourneys?.();
    }, () => actions.shortcutMenuChanged?.());
    this.refreshBindings();
  }

  private navigationVisible = true;
  private homePortalVisible = false;
  setHomePortalVisible(visible: boolean): void {
    this.homePortalVisible = visible && !!this.actions.homePortal;
    const button = this.controls.querySelector<HTMLButtonElement>('[data-hud="home"]')!;
    button.hidden = !this.homePortalVisible || !this.navigationVisible;
    if (button.hidden && document.activeElement === button) this.canvas.focus({ preventScroll: true });
  }
  setNavigationVisible(visible: boolean): void {
    if (this.navigationVisible === visible) return;
    this.navigationVisible = visible;
    this.controls.querySelector<HTMLElement>('[data-hud="map"]')!.hidden = !visible;
    this.setHomePortalVisible(this.homePortalVisible);
  }

  resizeControls(width: number, height: number): void {
    const place = (id: string, rect: HUDRect) => {
      const button = this.controls.querySelector<HTMLElement>(`[data-hud="${id}"]`)!;
      button.style.left = `${rect.x / width * 100}%`; button.style.top = `${rect.y / height * 100}%`;
      button.style.width = `${rect.width / width * 100}%`; button.style.height = `${rect.height / height * 100}%`;
    };
    const hud = getHUDLayout(width, height);
    this.buffs.element.style.bottom = `${(height - hud.y + 8) / height * 100}%`;
    for (const shortcut of hud.shortcuts) place(shortcut.id, shortcut);
    place('map', getMinimapRect(width, height));
    place('home', getMinimapHomeRect(width, height));
    this.shortcutMenu.position();
  }

  portalTransition(): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.element.querySelector('.portal-transition')?.remove();
    const veil = document.createElement('div'); veil.className = 'portal-transition'; veil.setAttribute('aria-hidden', 'true');
    this.element.append(veil); veil.addEventListener('animationend', () => veil.remove(), { once: true });
  }

  setSaveStatus(message = '', failed = false): void {
    this.saveMessage = message;
    this.refreshSaveStatus();
    const warning = this.element.querySelector<HTMLElement>('#save-warning')!;
    warning.hidden = !failed;
    if (warning.textContent !== message) warning.textContent = message;
  }

  private refreshSaveStatus(): void {
    const status = this.overlay.querySelector<HTMLElement>('.menu-save-state');
    if (!status) return;
    const timestamp = this.actions.lastSavedAt?.();
    const saved = timestamp === undefined ? null : new Date(timestamp);
    if (!saved || !Number.isFinite(saved.getTime())) {
      status.textContent = this.saveMessage || 'Not saved yet.'; status.removeAttribute('title'); return;
    }
    const today = saved.toDateString() === new Date().toDateString();
    const clock = saved.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const location = this.actions.saveLocation?.() ?? 'Local';
    const lastSave = `Last saved ${today ? clock : `${saved.toLocaleDateString()} · ${clock}`} (${location})`;
    status.textContent = this.saveMessage ? `${lastSave} · ${this.saveMessage}` : lastSave;
    status.title = `Last saved ${saved.toLocaleString()} (${location})`;
  }

  /** Ghost-run prompt: a persistent hint plus the resurrection action in reach. */
  setGhostPrompt(mode: 'corpse' | 'healer' | 'run' | null, healerName = ''): void {
    if (this.spiritPrompt.dataset.mode === (mode ?? '')) return;
    this.spiritPrompt.dataset.mode = mode ?? '';
    this.spiritPrompt.style.display = mode === null ? 'none' : 'flex';
    if (mode === null) { this.spiritPrompt.innerHTML = ''; return; }
    const hint = mode === 'corpse' ? 'Your corpse is here.'
      : mode === 'healer' ? `${escapeUI(healerName)} can return you to life — for a price.`
      : 'Return to your corpse, or find the Spirit Healer.';
    const button = mode === 'corpse'
      ? '<button type="button" class="ui-button ui-button--primary" data-ghost="corpse" style="pointer-events:auto">RESURRECT</button>'
      : mode === 'healer'
        ? '<button type="button" class="ui-button ui-button--primary" data-ghost="healer" style="pointer-events:auto">RESURRECT NOW</button>'
        : '';
    this.spiritPrompt.innerHTML = `<span style="color:#cfe0f4;font-size:13px;text-shadow:0 1px 2px #000">${hint}</span>${button}`;
  }

  setStatus(message: string): void { this.status.textContent = message; }

  showMenu(phase: GamePhase, kills: number, time: number, location = 'Deadwood'): void {
    this.shortcutMenu.close(false);
    this.menuAbort.abort(); this.menuAbort = new AbortController(); this.pauseMenu = null;
    const playing = phase === 'playing';
    if (playing || phase === 'ready' || phase === 'dead') this.pauseNavigation.focus = null;
    if (phase === 'ready') this.pauseNavigation.category = 'character';
    const panel = phase === 'map' || phase === 'character' || phase === 'skills' || phase === 'service' || phase === 'stable' || phase === 'event' || phase === 'journeys' || phase === 'chronicle' || phase === 'arena' || phase === 'pvpVendor';
    this.overlay.hidden = playing || panel || phase === 'ready';
    this.controls.hidden = !playing;
    if (!playing) { this.buffs.hide(); this.targetBuffs.hide(); }
    this.element.classList.toggle('playing', playing);
    if (playing || panel || phase === 'ready') {
      this.overlay.innerHTML = '';
      if (playing) this.setStatus('Exploring the world.');
      return;
    }
    const dead = phase === 'dead';
    this.overlay.innerHTML = gameMenuMarkup(dead ? 'dead' : 'paused', kills, time, location);
    const release = dead && this.actions.canReleaseSpirit?.();
    if (release) {
      const play = this.overlay.querySelector<HTMLButtonElement>('#play-action')!;
      play.classList.remove('ui-button--primary');
      play.insertAdjacentHTML('beforebegin',
        `<button type="button" class="ui-button ui-button--primary menu-primary" id="release-action"><span>RELEASE SPIRIT</span>${uiIcon('chevron')}</button>`);
    }
    this.refreshSaveStatus();
    const signal = this.menuAbort.signal;
    const play = this.overlay.querySelector<HTMLButtonElement>('#play-action')!;
    const releaseButton = this.overlay.querySelector<HTMLButtonElement>('#release-action');
    if (releaseButton) releaseButton.addEventListener('click', () => this.actions.releaseSpirit?.(), { signal });
    play.addEventListener('click', this.actions.play, { signal });
    if (dead) this.overlay.querySelector('#title-action')?.addEventListener('click', this.actions.returnToTitle, { signal });
    this.overlay.querySelector('#close-menu')?.addEventListener('click', this.actions.play, { signal });
    if (!dead) this.pauseMenu = new PauseMenu(this.overlay, this.actions, signal, this.pauseNavigation);
    trapDialogFocus(this.overlay, { signal, initialFocus: releaseButton ?? play, restoreFocus: false });
    this.pauseMenu?.restoreFocus();
    this.setStatus(dead ? `You fell after defeating ${kills} enemies.${release ? ' Release your spirit to run back to your corpse.' : ''}`
      : phase === 'paused' ? 'Game paused.' : 'Ready to enter Deadwood.');
  }

  dispose(): void {
    this.buffs.dispose(); this.targetBuffs.dispose();
    this.shortcutMenu.dispose();
    this.notifications.dispose();
    this.menuAbort.abort(); this.abort.abort();
  }
}
