/**
 * WoW-style movable / scalable / lockable UI framework.
 *
 * Every user-facing frame (DOM panels and canvas HUD elements) registers a
 * stable id and resolves its layout through this store. Layout persists to
 * localStorage so positions, scales, visibility and lock state survive
 * sessions — the same model WoW uses for its edit mode.
 *
 * Two consumers:
 *  - DOM panels: `attachUiFrame(el, id)` makes a `.ui-window` draggable by its
 *    header and scalable from a corner grip; layout applies as inline style.
 *  - Canvas HUD elements (action bars, minimap, cast bars): the renderer reads
 *    `uiLayout(id)` for {x,y,scale,visible} and `canvasFrameDrag` drives
 *    pointer dragging during edit mode.
 *
 * Headless-safe: the store is pure state + storage; DOM attach lives behind
 * `attachUiFrame` which is only called from render-side modules.
 */

export interface UiFrameLayout {
  /** Offset from the element's natural anchor, in CSS px. Undefined = anchored default. */
  x?: number;
  y?: number;
  /** Uniform scale multiplier (1 = natural size). */
  scale: number;
  /** Hidden frames are skipped by the renderer/panel. */
  visible: boolean;
  /** Locked frames ignore dragging (but still render). */
  locked: boolean;
}

export interface UiFrameSpec {
  /** Stable id — persisted key. Never rename once shipped. */
  id: string;
  /** Human label for the layout/edit panel. */
  label: string;
  /** Grouping for the edit panel. */
  group?: 'Panels' | 'HUD' | 'Combat';
  /** Whether the frame may be dragged. Default true. */
  movable?: boolean;
  /** Whether the frame may be scaled. Default true. */
  scalable?: boolean;
  /** Whether the frame may be hidden. Default false. */
  hidable?: boolean;
  minScale?: number;
  maxScale?: number;
}

const STORAGE_KEY = 'evergrow-ui-layout-v1';
const DEFAULT_MIN = 0.6, DEFAULT_MAX = 1.6;

const specs = new Map<string, UiFrameSpec>();
const layouts = new Map<string, UiFrameLayout>();
const listeners = new Set<() => void>();
let editMode = false;
let storage: Storage | null = null;

function store(): Storage | null {
  if (storage) return storage;
  try { storage = typeof localStorage !== 'undefined' ? localStorage : null; } catch { storage = null; }
  return storage;
}

function load(): void {
  const s = store();
  if (!s) return;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Partial<UiFrameLayout>>;
    for (const [id, l] of Object.entries(parsed)) {
      if (l && typeof l === 'object') layouts.set(id, sanitize(id, l));
    }
  } catch { /* corrupt layout -> defaults */ }
}

function persist(): void {
  const s = store();
  if (!s) return;
  const out: Record<string, UiFrameLayout> = {};
  for (const [id, l] of layouts) out[id] = l;
  try { s.setItem(STORAGE_KEY, JSON.stringify(out)); } catch { /* quota */ }
}

function sanitize(id: string, l: Partial<UiFrameLayout>): UiFrameLayout {
  const spec = specs.get(id);
  const min = spec?.minScale ?? DEFAULT_MIN, max = spec?.maxScale ?? DEFAULT_MAX;
  return {
    x: Number.isFinite(l.x) ? l.x : undefined,
    y: Number.isFinite(l.y) ? l.y : undefined,
    scale: Math.min(max, Math.max(min, Number.isFinite(l.scale) ? l.scale! : 1)),
    visible: l.visible !== false,
    locked: l.locked === true,
  };
}

let loaded = false;
function ensure(): void { if (!loaded) { loaded = true; load(); } }

/** Register a frame so it appears in the edit panel and resolves layout. */
export function registerUiFrame(spec: UiFrameSpec): void {
  specs.set(spec.id, spec);
  ensure();
  if (!layouts.has(spec.id)) layouts.set(spec.id, sanitize(spec.id, {}));
}

/** All registered frames, stable order. */
export function uiFrames(): readonly UiFrameSpec[] {
  ensure();
  return [...specs.values()];
}

/** Resolved layout for a frame (defaults when untouched). */
export function uiLayout(id: string): UiFrameLayout {
  ensure();
  return layouts.get(id) ?? sanitize(id, {});
}

/** Patch a frame's layout and persist. */
export function setUiLayout(id: string, patch: Partial<UiFrameLayout>): void {
  ensure();
  layouts.set(id, sanitize(id, { ...layouts.get(id), ...patch }));
  persist();
  for (const fn of listeners) fn();
}

/** Reset one frame (or all when id omitted) to defaults. */
export function resetUiLayout(id?: string): void {
  ensure();
  if (id) layouts.set(id, sanitize(id, {}));
  else for (const key of layouts.keys()) layouts.set(key, sanitize(key, {}));
  persist();
  for (const fn of listeners) fn();
}

/** Global edit mode: frames show move/scale affordances and accept drags. */
export function uiEditMode(): boolean { return editMode; }
export function setUiEditMode(on: boolean): void {
  if (editMode === on) return;
  editMode = on;
  for (const fn of listeners) fn();
}

/** True when a frame currently accepts a pointer drag (edit mode + unlocked + movable). */
export function uiFrameDraggable(id: string): boolean {
  const spec = specs.get(id);
  return editMode && spec?.movable !== false && !uiLayout(id).locked;
}

/** Subscribe to layout/edit-mode changes. Returns an unsubscribe. */
export function onUiLayoutChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── DOM attach ────────────────────────────────────────────────────────────────

export interface UiFrameHandle { dispose(): void; }

/**
 * Make a `.ui-window` panel draggable by its header and scalable from a
 * bottom-right grip. Applies persisted {x,y,scale} as inline transform.
 * `id` must be a registered frame. No-op-safe to call on every open.
 */
export function attachUiFrame(el: HTMLElement, id: string): UiFrameHandle {
  const win = (el.classList.contains('ui-window') ? el : el.querySelector<HTMLElement>('.ui-window')) ?? el;
  win.dataset.uiFrame = id;
  const apply = () => {
    const l = uiLayout(id);
    win.style.transform = `translate(${l.x ?? 0}px, ${l.y ?? 0}px) scale(${l.scale})`;
    win.style.transformOrigin = 'top left';
    win.classList.toggle('ui-frame--editing', editMode);
    win.classList.toggle('ui-frame--locked', l.locked);
    grip.hidden = !editMode || specs.get(id)?.scalable === false;
  };

  // Drag by header.
  const header = win.querySelector<HTMLElement>('.ui-window-header, .ui-window__header, header') ?? win;
  let drag: { sx: number; sy: number; ox: number; oy: number } | null = null;
  const onDown = (e: PointerEvent) => {
    if (!uiFrameDraggable(id) || (e.target as HTMLElement).closest('button,input,select,textarea,a')) return;
    const l = uiLayout(id);
    drag = { sx: e.clientX, sy: e.clientY, ox: l.x ?? 0, oy: l.y ?? 0 };
    header.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    setUiLayout(id, { x: drag.ox + (e.clientX - drag.sx), y: drag.oy + (e.clientY - drag.sy) });
  };
  const onUp = () => { drag = null; };
  header.addEventListener('pointerdown', onDown);
  header.addEventListener('pointermove', onMove);
  header.addEventListener('pointerup', onUp);
  header.addEventListener('pointercancel', onUp);

  // Scale grip.
  const grip = document.createElement('div');
  grip.className = 'ui-frame-grip';
  grip.setAttribute('aria-hidden', 'true');
  win.appendChild(grip);
  let scaling: { sx: number; sy: number; s0: number } | null = null;
  grip.addEventListener('pointerdown', e => {
    if (specs.get(id)?.scalable === false) return;
    scaling = { sx: e.clientX, sy: e.clientY, s0: uiLayout(id).scale };
    grip.setPointerCapture(e.pointerId);
    e.preventDefault(); e.stopPropagation();
  });
  grip.addEventListener('pointermove', e => {
    if (!scaling) return;
    const d = (e.clientX - scaling.sx + e.clientY - scaling.sy) / 220;
    setUiLayout(id, { scale: scaling.s0 + d });
  });
  grip.addEventListener('pointerup', () => { scaling = null; });
  grip.addEventListener('pointercancel', () => { scaling = null; });

  const unsub = onUiLayoutChange(apply);
  apply();
  return {
    dispose() {
      unsub();
      header.removeEventListener('pointerdown', onDown);
      header.removeEventListener('pointermove', onMove);
      header.removeEventListener('pointerup', onUp);
      header.removeEventListener('pointercancel', onUp);
      grip.remove();
    },
  };
}

// ── Canvas HUD drag ───────────────────────────────────────────────────────────

export interface CanvasDragState { id: string; dx: number; dy: number; }
let canvasDrag: CanvasDragState | null = null;

/**
 * Begin a canvas-frame drag if the pointer is inside `bounds` and the frame is
 * draggable. Returns true when the drag started (caller swallows the input).
 */
export function canvasFrameDragStart(id: string, px: number, py: number,
  bounds: { x: number; y: number; w: number; h: number }): boolean {
  if (!uiFrameDraggable(id)) return false;
  if (px < bounds.x || py < bounds.y || px > bounds.x + bounds.w || py > bounds.y + bounds.h) return false;
  const l = uiLayout(id);
  canvasDrag = { id, dx: px - (l.x ?? 0), dy: py - (l.y ?? 0) };
  return true;
}

/** Advance the active canvas drag; returns the active frame id or null. */
export function canvasFrameDragMove(px: number, py: number): string | null {
  if (!canvasDrag) return null;
  setUiLayout(canvasDrag.id, { x: px - canvasDrag.dx, y: py - canvasDrag.dy });
  return canvasDrag.id;
}

/** End the active canvas drag. */
export function canvasFrameDragEnd(): void { canvasDrag = null; }

/** Active canvas-drag frame id (for highlight rendering). */
export function canvasFrameDragging(): string | null { return canvasDrag?.id ?? null; }
