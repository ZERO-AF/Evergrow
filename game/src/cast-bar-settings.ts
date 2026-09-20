import { registerUiFrame, setUiLayout, uiLayout } from './ui-layout.ts';
import { uiIcon } from './ui-icons.ts';

/**
 * Enemy cast-bar preferences (WoW edit-mode style). `visible` and `scale`
 * persist through the shared ui-layout frame 'enemyCastBar'; `position` and
 * `interruptIcon` persist under a small sibling key since UiFrameLayout has
 * no field for them. Render-side module — cast-bar.ts stays headless.
 */

export const CAST_BAR_FRAME_ID = 'enemyCastBar';
export const CAST_BAR_SCALE = Object.freeze({ min: .5, max: 2, step: .1 });
const POSITION_KEY = 'evergrow-cast-bar-v1';

export type CastBarPosition = 'above' | 'below';

export interface CastBarSettings {
  /** Master toggle; persisted as the frame's `visible`. */
  readonly visible: boolean;
  /** Bar stack sits above the head/health bar or hangs under the feet. */
  readonly position: CastBarPosition;
  /** 0.5–2.0 multiplier on the whole bar stack. */
  readonly scale: number;
  /** Draw the interruptible spark / uninterruptible shield glyph. */
  readonly interruptIcon: boolean;
}

/** Registers the frame; idempotent — safe to call at module load and lazily. */
export function registerCastBarFrame(): void {
  registerUiFrame({ id: CAST_BAR_FRAME_ID, label: 'Enemy cast bars', group: 'Combat',
    movable: false, scalable: true, hidable: true,
    minScale: CAST_BAR_SCALE.min, maxScale: CAST_BAR_SCALE.max });
}
registerCastBarFrame();

interface StoredExtras { position?: CastBarPosition; interruptIcon?: boolean }
let extras: StoredExtras | undefined;

function storedExtras(): StoredExtras {
  if (extras) return extras;
  extras = {};
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(POSITION_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as StoredExtras;
      if (parsed && typeof parsed === 'object') extras = {
        position: parsed.position === 'below' ? 'below' : parsed.position === 'above' ? 'above' : undefined,
        interruptIcon: typeof parsed.interruptIcon === 'boolean' ? parsed.interruptIcon : undefined,
      };
    }
  } catch { extras = {}; }
  return extras;
}

function persistExtras(): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(POSITION_KEY, JSON.stringify(storedExtras())); }
  catch { /* quota / privacy mode */ }
}

/** Resolved settings: ui-layout owns visible+scale, extras own position+icon. */
export function castBarSettings(): CastBarSettings {
  registerCastBarFrame();
  const layout = uiLayout(CAST_BAR_FRAME_ID), extra = storedExtras();
  return { visible: layout.visible, position: extra.position ?? 'above',
    scale: layout.scale, interruptIcon: extra.interruptIcon !== false };
}

export function setCastBarVisible(visible: boolean): void {
  setUiLayout(CAST_BAR_FRAME_ID, { visible });
}

export function setCastBarPosition(position: CastBarPosition): void {
  storedExtras().position = position === 'below' ? 'below' : 'above';
  persistExtras();
  // Re-persist the frame so ui-layout listeners refresh any open UI.
  setUiLayout(CAST_BAR_FRAME_ID, {});
}

export function setCastBarScale(scale: number): void {
  setUiLayout(CAST_BAR_FRAME_ID, { scale });
}

export function setCastBarInterruptIcon(on: boolean): void {
  storedExtras().interruptIcon = on;
  persistExtras();
  setUiLayout(CAST_BAR_FRAME_ID, {});
}

// ── Options-menu fragment ────────────────────────────────────────────────────

/**
 * Markup for the Escape → Options window, matching its `.pause-option` rows.
 * Pair with `bindCastBarOptions`.
 */
export function castBarOptionsMarkup(): string {
  return `<div class="pause-option"><span id="cast-bars-label">Enemy cast bars</span><button type="button" data-cast-bars-toggle class="ui-button pause-toggle" aria-pressed="true" aria-labelledby="cast-bars-label">On</button></div>
    <div class="pause-option"><span id="cast-bars-position-label">Cast bar position</span><div class="pause-loot-modes" role="group" aria-labelledby="cast-bars-position-label"><button type="button" data-cast-bars-position="above" class="ui-button ui-button--quiet" aria-pressed="true">Above</button><button type="button" data-cast-bars-position="below" class="ui-button ui-button--quiet" aria-pressed="false">Below</button></div></div>
    <div class="pause-option"><span id="cast-bars-scale-label">Cast bar scale</span><div class="pause-stepper" role="group" aria-labelledby="cast-bars-scale-label"><button type="button" data-cast-bars-scale="down" class="ui-button ui-button--icon" aria-label="Smaller cast bars">${uiIcon('minus')}</button><output data-cast-bars-scale-label style="align-self:center;min-width:4ch;text-align:center">100%</output><button type="button" data-cast-bars-scale="up" class="ui-button ui-button--icon" aria-label="Larger cast bars">${uiIcon('plus')}</button></div></div>
    <div class="pause-option"><span id="cast-bars-icon-label">Interrupt icon</span><button type="button" data-cast-bars-icon class="ui-button pause-toggle" aria-pressed="true" aria-labelledby="cast-bars-icon-label">On</button></div>`;
}

/** Wires `castBarOptionsMarkup` inside an options window; returns a refresher. */
export function bindCastBarOptions(root: HTMLElement, signal: AbortSignal): () => void {
  const refresh = () => {
    const settings = castBarSettings();
    const toggle = root.querySelector<HTMLButtonElement>('[data-cast-bars-toggle]');
    if (toggle) { toggle.textContent = settings.visible ? 'On' : 'Off'; toggle.setAttribute('aria-pressed', String(settings.visible)); }
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-cast-bars-position]'))
      button.setAttribute('aria-pressed', String(button.dataset.castBarsPosition === settings.position));
    const icon = root.querySelector<HTMLButtonElement>('[data-cast-bars-icon]');
    if (icon) { icon.textContent = settings.interruptIcon ? 'On' : 'Off'; icon.setAttribute('aria-pressed', String(settings.interruptIcon)); }
    const label = root.querySelector<HTMLOutputElement>('[data-cast-bars-scale-label]');
    if (label) label.textContent = `${Math.round(settings.scale * 100)}%`;
  };
  root.querySelector('[data-cast-bars-toggle]')!.addEventListener('click', () => {
    setCastBarVisible(!castBarSettings().visible); refresh();
  }, { signal });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-cast-bars-position]'))
    button.addEventListener('click', () => {
      setCastBarPosition(button.dataset.castBarsPosition === 'below' ? 'below' : 'above'); refresh();
    }, { signal });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-cast-bars-scale]'))
    button.addEventListener('click', () => {
      const delta = (button.dataset.castBarsScale === 'up' ? 1 : -1) * CAST_BAR_SCALE.step;
      setCastBarScale(castBarSettings().scale + delta); refresh();
    }, { signal });
  root.querySelector('[data-cast-bars-icon]')!.addEventListener('click', () => {
    setCastBarInterruptIcon(!castBarSettings().interruptIcon); refresh();
  }, { signal });
  refresh();
  return refresh;
}
