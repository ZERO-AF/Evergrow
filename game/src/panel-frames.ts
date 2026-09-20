/**
 * DOM panel frame registration for the shared ui-layout store — kept free of
 * CSS imports so headless-tested panels (world-map, stats-panel, …) can attach
 * their frames without a stylesheet loader.
 *
 *  - `registerPanelFrames()` — registers every popup window's frame id. Call
 *    once during game construction.
 *  - `attachPanelFrame(el, id)` — idempotent attach helper panels should call
 *    instead of raw `attachUiFrame`: panels that rebuild `innerHTML` on render
 *    recreate their `.ui-window` node, and this re-attaches to the new node
 *    while disposing the stale handle (no listener/subscription leaks).
 *  - `detachPanelFrame(el)` — releases a panel's frame handle.
 */
import { attachUiFrame, registerUiFrame, type UiFrameHandle, type UiFrameSpec } from './ui-layout.ts';

/** Every popup window's frame id. 'inventory' and 'poi' are reserved specs:
 * the combined character+inventory window attaches as 'character' and the
 * event/dungeon-entrance dialog attaches as 'event'; these ids stay registered
 * so a future standalone bag panel or POI detail window can adopt them without
 * breaking saved layouts.
 *
 * Panels are not `hidable`: `attachUiFrame` never applies `visible` to DOM
 * windows, and a hidden-but-open modal would still pause the game and hold its
 * focus trap. Canvas HUD frames registered elsewhere may be hidable. */
const PANEL_FRAMES: readonly UiFrameSpec[] = [
  { id: 'character', label: 'Character & inventory' },
  { id: 'skills', label: 'Skill atlas' },
  { id: 'quests', label: 'Quest log' },
  { id: 'professions', label: 'Professions' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'glyphs', label: 'Glyphs' },
  { id: 'spellbook', label: 'Spellbook' },
  { id: 'stats', label: 'Character stats' },
  { id: 'reputation', label: 'Reputation' },
  { id: 'inventory', label: 'Inventory bags' },
  { id: 'map', label: 'World map', scalable: false },
  { id: 'service', label: 'Service & trade' },
  { id: 'stable', label: 'Pet stable' },
  { id: 'event', label: 'Event & dungeon entrance' },
  { id: 'expedition', label: 'Expeditions' },
  { id: 'journey', label: 'Journeys' },
  { id: 'chronicle', label: 'Chronicle' },
  { id: 'controls', label: 'Controls window' },
  { id: 'changelog', label: 'Changelog' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'rift', label: 'Crimson Rift' },
  { id: 'poi', label: 'POI detail' },
  { id: 'transmog', label: 'Transmogrify' },
].map(spec => ({ group: 'Panels' as const, ...spec }));

/** Register all DOM panel frames. Idempotent — safe to call more than once. */
export function registerPanelFrames(): void {
  for (const spec of PANEL_FRAMES) registerUiFrame(spec);
}

const attached = new WeakMap<HTMLElement, { win: HTMLElement; header: HTMLElement; handle: UiFrameHandle }>();

/**
 * Attach a panel element to a registered frame. Unlike `attachUiFrame` this is
 * safe to call after every render: when a panel rebuilds its `.ui-window` (or
 * rewrites `innerHTML` inside a stable window, which recreates the header the
 * drag listeners live on) the stale handle is disposed and the new node is
 * attached. Returns the live handle, or null when the element has no window
 * node yet.
 */
export function attachPanelFrame(el: HTMLElement, id: string): UiFrameHandle | null {
  // Headless tests drive panels with minimal element stubs; skip frame wiring there.
  if (typeof el.classList?.contains !== 'function' || typeof el.querySelector !== 'function') return null;
  const win = (el.classList.contains('ui-window') ? el : el.querySelector<HTMLElement>('.ui-window')) ?? el;
  const header = win.querySelector<HTMLElement>('.ui-window-header, .ui-window__header, header') ?? win;
  const prev = attached.get(el);
  if (prev?.win === win && prev.header === header) return prev.handle;
  prev?.handle.dispose();
  const handle = attachUiFrame(el, id);
  attached.set(el, { win, header, handle });
  return handle;
}

/** Release a panel's frame handle (layout listener + grip). Call from the
 * panel's dispose(); optional — the handle is otherwise collected with the
 * element, but its store listener lives until then. */
export function detachPanelFrame(el: HTMLElement): void {
  if (typeof el.classList?.contains !== 'function') return;
  attached.get(el)?.handle.dispose();
  attached.delete(el);
}

