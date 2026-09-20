import { registerUiFrame, setUiLayout, uiLayout } from './ui-layout.ts';
import { uiIcon } from './ui-icons.ts';
import { NAMEPLATE_MODES, type NameplateMode } from './nameplate.ts';

/**
 * Enemy nameplate preferences (WoW edit-mode style). `visible` and `scale`
 * live in ui-layout.ts like every other frame; `mode` and `castBar` are
 * nameplate-specific extras persisted under their own localStorage key.
 * The 'nameplates' control action (V) cycles mode — see cycleNameplateMode.
 */

export const NAMEPLATE_FRAME_ID = 'enemyNameplates';
export const NAMEPLATE_SCALE = Object.freeze({ min: .6, max: 1.8, step: .1 });
const POSITION_KEY = 'evergrow-nameplates-v1';

export interface NameplateSettings {
  /** Master toggle; persisted as the frame's `visible`. */
  readonly visible: boolean;
  /** always: every enemy · combat: engaged + target only · off: none. */
  readonly mode: NameplateMode;
  /** 0.6–1.8 multiplier on the whole plate. */
  readonly scale: number;
  /** Embed the enemy's cast bar under the health bar (cast-bar.ts data). */
  readonly castBar: boolean;
}

/** Registers the frame; idempotent — safe to call at module load and lazily. */
export function registerNameplateFrame(): void {
  registerUiFrame({ id: NAMEPLATE_FRAME_ID, label: 'Enemy nameplates', group: 'Combat',
    movable: false, scalable: true, hidable: true,
    minScale: NAMEPLATE_SCALE.min, maxScale: NAMEPLATE_SCALE.max });
}
registerNameplateFrame();

interface StoredExtras { mode?: NameplateMode; castBar?: boolean }
let extras: StoredExtras | undefined;

function storedExtras(): StoredExtras {
  if (extras) return extras;
  extras = {};
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(POSITION_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as StoredExtras;
      if (parsed && typeof parsed === 'object') extras = {
        mode: NAMEPLATE_MODES.includes(parsed.mode as NameplateMode) ? parsed.mode : undefined,
        castBar: typeof parsed.castBar === 'boolean' ? parsed.castBar : undefined,
      };
    }
  } catch { extras = {}; }
  return extras;
}

function persistExtras(): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(POSITION_KEY, JSON.stringify(storedExtras())); }
  catch { /* quota / privacy mode */ }
}

/** Resolved settings: ui-layout owns visible+scale, extras own mode+castBar. */
export function nameplateSettings(): NameplateSettings {
  registerNameplateFrame();
  const layout = uiLayout(NAMEPLATE_FRAME_ID), extra = storedExtras();
  return { visible: layout.visible, mode: extra.mode ?? 'always',
    scale: layout.scale, castBar: extra.castBar !== false };
}

export function setNameplateVisible(visible: boolean): void {
  setUiLayout(NAMEPLATE_FRAME_ID, { visible });
}

export function setNameplateMode(mode: NameplateMode): void {
  storedExtras().mode = NAMEPLATE_MODES.includes(mode) ? mode : 'always';
  persistExtras();
  // Re-persist the frame so ui-layout listeners refresh any open UI.
  setUiLayout(NAMEPLATE_FRAME_ID, {});
}

/** V key: always → combat → off → always. Returns the new mode for a chat notice. */
export function cycleNameplateMode(): NameplateMode {
  const order: readonly NameplateMode[] = ['always', 'combat', 'off'];
  const next = order[(order.indexOf(nameplateSettings().mode) + 1) % order.length]!;
  setNameplateMode(next);
  return next;
}

export function setNameplateScale(scale: number): void {
  setUiLayout(NAMEPLATE_FRAME_ID, { scale });
}

export function setNameplateCastBar(on: boolean): void {
  storedExtras().castBar = on;
  persistExtras();
  setUiLayout(NAMEPLATE_FRAME_ID, {});
}

// ── Options-menu fragment ────────────────────────────────────────────────────

/**
 * Markup for the Escape → Options window, matching its `.pause-option` rows.
 * Pair with `bindNameplateOptions`.
 */
export function nameplateOptionsMarkup(): string {
  return `<div class="pause-option"><span id="nameplates-label">Enemy nameplates</span><button type="button" data-nameplates-toggle class="ui-button pause-toggle" aria-pressed="true" aria-labelledby="nameplates-label">On</button></div>
    <div class="pause-option"><span id="nameplates-mode-label">Nameplate mode</span><div class="pause-loot-modes" role="group" aria-labelledby="nameplates-mode-label"><button type="button" data-nameplates-mode="always" class="ui-button ui-button--quiet" aria-pressed="true">Always</button><button type="button" data-nameplates-mode="combat" class="ui-button ui-button--quiet" aria-pressed="false">In combat</button><button type="button" data-nameplates-mode="off" class="ui-button ui-button--quiet" aria-pressed="false">Off</button></div></div>
    <div class="pause-option"><span id="nameplates-scale-label">Nameplate scale</span><div class="pause-stepper" role="group" aria-labelledby="nameplates-scale-label"><button type="button" data-nameplates-scale="down" class="ui-button ui-button--icon" aria-label="Smaller nameplates">${uiIcon('minus')}</button><output data-nameplates-scale-label style="align-self:center;min-width:4ch;text-align:center">100%</output><button type="button" data-nameplates-scale="up" class="ui-button ui-button--icon" aria-label="Larger nameplates">${uiIcon('plus')}</button></div></div>
    <div class="pause-option"><span id="nameplates-cast-label">Nameplate cast bars</span><button type="button" data-nameplates-cast class="ui-button pause-toggle" aria-pressed="true" aria-labelledby="nameplates-cast-label">On</button></div>`;
}

/** Wires `nameplateOptionsMarkup` inside an options window; returns a refresher. */
export function bindNameplateOptions(root: HTMLElement, signal: AbortSignal): () => void {
  const refresh = () => {
    const settings = nameplateSettings();
    const toggle = root.querySelector<HTMLButtonElement>('[data-nameplates-toggle]');
    if (toggle) { toggle.textContent = settings.visible ? 'On' : 'Off'; toggle.setAttribute('aria-pressed', String(settings.visible)); }
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-nameplates-mode]'))
      button.setAttribute('aria-pressed', String(button.dataset.nameplatesMode === settings.mode));
    const cast = root.querySelector<HTMLButtonElement>('[data-nameplates-cast]');
    if (cast) { cast.textContent = settings.castBar ? 'On' : 'Off'; cast.setAttribute('aria-pressed', String(settings.castBar)); }
    const label = root.querySelector<HTMLOutputElement>('[data-nameplates-scale-label]');
    if (label) label.textContent = `${Math.round(settings.scale * 100)}%`;
  };
  root.querySelector('[data-nameplates-toggle]')!.addEventListener('click', () => {
    setNameplateVisible(!nameplateSettings().visible); refresh();
  }, { signal });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-nameplates-mode]'))
    button.addEventListener('click', () => {
      setNameplateMode(button.dataset.nameplatesMode === 'combat' ? 'combat'
        : button.dataset.nameplatesMode === 'off' ? 'off' : 'always'); refresh();
    }, { signal });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-nameplates-scale]'))
    button.addEventListener('click', () => {
      const delta = (button.dataset.nameplatesScale === 'up' ? 1 : -1) * NAMEPLATE_SCALE.step;
      setNameplateScale(nameplateSettings().scale + delta); refresh();
    }, { signal });
  root.querySelector('[data-nameplates-cast]')!.addEventListener('click', () => {
    setNameplateCastBar(!nameplateSettings().castBar); refresh();
  }, { signal });
  refresh();
  return refresh;
}
