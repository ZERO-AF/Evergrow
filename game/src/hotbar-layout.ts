import { BAR_SLOTS, type ActionBars } from './action-bar.ts';
import { SKILL_ACTIONS, controlLabel, type ControlAction, type ControlBindings } from './control-bindings.ts';
import { GAME_FEATURES } from './game-features.ts';
import { actionBarLayout, type BarStrip } from './action-bar.ts';
import { text } from './font.ts';
import {
  canvasFrameDragEnd, canvasFrameDragMove, canvasFrameDragStart, canvasFrameDragging,
  registerUiFrame, setUiLayout, uiEditMode, uiLayout, uiFrames,
} from './ui-layout.ts';
import { UI_THEME } from './ui-theme.ts';

/** Hotbar customization (docs/wow-deepening.md §5 + ui-layout.ts): the three
 * action-bar strips register as canvas UI frames so edit mode can drag, scale,
 * hide and lock each one. Frame ids are positional — `actionBar2`/`actionBar3`
 * are the inner/outer right-edge columns, not page numbers — because the pages
 * shown on the side bars rotate with `bars.page` while the frames stay put.
 *
 * Geometry flows one way: `resolveBarLayout` applies the persisted
 * {x,y,scale,visible} to `actionBarLayout`'s natural anchors, and every
 * consumer (draw, slot hit-test, drag bounds) reads the resolved strips so the
 * three can never diverge. Scale grows a strip around its own center, which
 * keeps the main bar centered and the side bars on the right edge.
 *
 * Headless-safe for geometry (ui-layout falls back to in-memory state without
 * localStorage); only `drawHotbarEditOverlay` touches a canvas context. */

export type HotbarFrameId = 'actionBar1' | 'actionBar2' | 'actionBar3';
export const HOTBAR_MAIN: HotbarFrameId = 'actionBar1';
/** Side frames in draw order: index 0 is the inner column, index 1 the outer. */
export const HOTBAR_SIDE_IDS: readonly HotbarFrameId[] = ['actionBar2', 'actionBar3'];

/** Register the three bar frames with the shared layout store. Idempotent —
 * call once at boot (or lazily from resolveBarLayout). */
export function registerHotbarFrames(): void {
  registerUiFrame({ id: 'actionBar1', label: 'Main action bar', group: 'HUD', hidable: true });
  registerUiFrame({ id: 'actionBar2', label: 'Side action bar 1', group: 'HUD', hidable: true });
  registerUiFrame({ id: 'actionBar3', label: 'Side action bar 2', group: 'HUD', hidable: true });
}

export interface ResolvedBarStrip extends BarStrip {
  /** Frame this strip belongs to; side strips map positionally. */
  frame: HotbarFrameId;
  /** Vertical strips stack slots downward (side bars); horizontal go right (main). */
  vertical: boolean;
  /** Persisted visibility — invisible strips neither draw nor take input. */
  visible: boolean;
}
export interface ResolvedBarLayout { main: ResolvedBarStrip; sides: ResolvedBarStrip[]; }

/** Apply one frame's persisted layout to its natural strip. Offsets translate
 * the anchor; scale multiplies slot size and gap around the strip center. */
function resolveStrip(strip: BarStrip, frame: HotbarFrameId, vertical: boolean): ResolvedBarStrip {
  const l = uiLayout(frame);
  const scale = l.scale;
  const slot = strip.slot * scale, gap = strip.gap * scale;
  const w = vertical ? slot : BAR_SLOTS * slot + (BAR_SLOTS - 1) * gap;
  const h = vertical ? BAR_SLOTS * slot + (BAR_SLOTS - 1) * gap : slot;
  const nw = vertical ? strip.slot : BAR_SLOTS * strip.slot + (BAR_SLOTS - 1) * strip.gap;
  const nh = vertical ? BAR_SLOTS * strip.slot + (BAR_SLOTS - 1) * strip.gap : strip.slot;
  return {
    x: strip.x + (l.x ?? 0) + (nw - w) / 2,
    y: strip.y + (l.y ?? 0) + (nh - h) / 2,
    slot, gap, page: strip.page, frame, vertical, visible: l.visible,
  };
}

/** The bars' effective screen layout: natural anchors plus persisted
 * offsets/scale/visibility. Draw and hit-test must both use this. */
export function resolveBarLayout(bars: ActionBars, width: number, height: number): ResolvedBarLayout {
  registerHotbarFrames();
  const natural = actionBarLayout(bars, width, height);
  return {
    main: resolveStrip(natural.main, HOTBAR_MAIN, false),
    sides: natural.sides.map((strip, i) => resolveStrip(strip, HOTBAR_SIDE_IDS[i] ?? HOTBAR_SIDE_IDS[0], true)),
  };
}

export interface HotbarFrameBounds {
  id: HotbarFrameId;
  label: string;
  /** Screen rect covering the strip and its page tag — the drag target. */
  x: number; y: number; w: number; h: number;
  visible: boolean;
  locked: boolean;
}

function stripBounds(strip: ResolvedBarStrip): { x: number; y: number; w: number; h: number } {
  const w = strip.vertical ? strip.slot : BAR_SLOTS * strip.slot + (BAR_SLOTS - 1) * strip.gap;
  const h = strip.vertical ? BAR_SLOTS * strip.slot + (BAR_SLOTS - 1) * strip.gap : strip.slot;
  // Union the page tag: it rides the main bar's left end and each side bar's top.
  const tag = strip.vertical
    ? { x: strip.x + strip.slot / 2 - 7, y: strip.y - 18, w: 14, h: 14 }
    : { x: strip.x - 18, y: strip.y + strip.slot - 14, w: 14, h: 14 };
  const x = Math.min(strip.x, tag.x), y = Math.min(strip.y, tag.y);
  return { x, y, w: Math.max(strip.x + w, tag.x + tag.w) - x, h: Math.max(strip.y + h, tag.y + tag.h) - y };
}

/** Every registered bar frame's resolved screen rect — drag hit-testing and
 * the edit overlay. Hidden frames keep their bounds so edit mode can still
 * show and re-enable them. Draw order: sides first, main last (topmost). */
export function hotbarBounds(bars: ActionBars, width: number, height: number): HotbarFrameBounds[] {
  if (!GAME_FEATURES.actionBars) return [];
  const layout = resolveBarLayout(bars, width, height);
  const label = (id: string) => uiFrames().find(f => f.id === id)?.label ?? id;
  const entry = (strip: ResolvedBarStrip): HotbarFrameBounds => ({
    id: strip.frame, label: label(strip.frame), ...stripBounds(strip),
    visible: strip.visible, locked: uiLayout(strip.frame).locked,
  });
  return [...layout.sides.map(entry), entry(layout.main)];
}

/** Topmost bar frame under a screen point, or null. Includes hidden frames —
 * edit mode needs their rects — so callers routing gameplay input should gate
 * on `uiEditMode()` or use `isHotbarPoint`. */
export function hotbarFrameAt(bars: ActionBars, x: number, y: number, width: number, height: number): HotbarFrameId | null {
  for (const b of hotbarBounds(bars, width, height).slice().reverse()) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

/** Absolute bar index under a screen point on the resolved layout, or null.
 * Mirrors hud-action-bars' slot hit-test but honors moved/scaled/hidden frames. */
export function hotbarSlotAt(bars: ActionBars, x: number, y: number, width: number, height: number): number | null {
  if (!GAME_FEATURES.actionBars) return null;
  const layout = resolveBarLayout(bars, width, height);
  const hit = (strip: ResolvedBarStrip): number | null => {
    if (!strip.visible) return null;
    for (let i = 0; i < BAR_SLOTS; i++) {
      const sx = strip.vertical ? strip.x : strip.x + i * (strip.slot + strip.gap);
      const sy = strip.vertical ? strip.y + i * (strip.slot + strip.gap) : strip.y;
      if (x >= sx && x <= sx + strip.slot && y >= sy && y <= sy + strip.slot) return strip.page * BAR_SLOTS + i;
    }
    return null;
  };
  for (const strip of layout.sides) {
    const index = hit(strip);
    if (index !== null) return index;
  }
  return hit(layout.main);
}

/** Pointer routing on the resolved layout: any point over a visible bar slot
 * blocks world input. Drop-in replacement for `isActionBarPoint`. */
export function isHotbarPoint(bars: ActionBars, x: number, y: number, width: number, height: number): boolean {
  return hotbarSlotAt(bars, x, y, width, height) !== null;
}

// ── Edit-mode pointer routing ─────────────────────────────────────────────────

const GRIP = 14;
let scaleDrag: { id: HotbarFrameId; sx: number; sy: number; s0: number } | null = null;

/** Scale grip rect for a frame (bottom-right corner), shown only in edit mode. */
function gripRect(b: HotbarFrameBounds): { x: number; y: number; w: number; h: number } {
  return { x: b.x + b.w - GRIP, y: b.y + b.h - GRIP, w: GRIP, h: GRIP };
}

/** Frame whose scale grip is under the point, or null. Edit mode only; locked
 * frames still scale (lock blocks moving, matching attachUiFrame's DOM grip). */
export function hotbarGripAt(bars: ActionBars, x: number, y: number, width: number, height: number): HotbarFrameId | null {
  if (!uiEditMode()) return null;
  for (const b of hotbarBounds(bars, width, height).slice().reverse()) {
    const g = gripRect(b);
    if (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) return b.id;
  }
  return null;
}

/** Edit-mode pointerdown for the canvas bars: starts a scale-grip drag or a
 * frame move (via canvasFrameDragStart) and returns true when the input is
 * consumed. Outside edit mode this always returns false so clicks activate
 * slots normally. Call before `actionBarSlotAt` activation. */
export function hotbarPointerDown(bars: ActionBars, x: number, y: number, width: number, height: number): boolean {
  if (!uiEditMode()) return false;
  const grip = hotbarGripAt(bars, x, y, width, height);
  if (grip) {
    scaleDrag = { id: grip, sx: x, sy: y, s0: uiLayout(grip).scale };
    return true;
  }
  const frame = hotbarFrameAt(bars, x, y, width, height);
  if (!frame) return false;
  const bounds = hotbarBounds(bars, width, height).find(b => b.id === frame)!;
  // Locked frames swallow the click without starting a drag.
  return canvasFrameDragStart(frame, x, y, bounds) || true;
}

/** Advance an active bar drag (move or scale). Returns the frame id being
 * manipulated, or null when no canvas-frame drag is active. The id may belong
 * to another module's frame — canvas drags share one store. */
export function hotbarPointerMove(x: number, y: number): string | null {
  if (scaleDrag) {
    const d = (x - scaleDrag.sx + y - scaleDrag.sy) / 240;
    setUiLayout(scaleDrag.id, { scale: scaleDrag.s0 + d });
    return scaleDrag.id;
  }
  return canvasFrameDragMove(x, y);
}

/** End any active bar drag. Safe to call on every pointerup. */
export function hotbarPointerUp(): void {
  scaleDrag = null;
  canvasFrameDragEnd();
}

// ── Edit-mode overlay ─────────────────────────────────────────────────────────

/** Dashed frame outlines, labels and scale grips drawn over the bars while
 * edit mode is on — the canvas counterpart of `.ui-frame--editing`. Call after
 * `drawActionBars`. No-op outside edit mode. */
export function drawHotbarEditOverlay(c: CanvasRenderingContext2D, bars: ActionBars, width: number, height: number): void {
  if (!uiEditMode() || !GAME_FEATURES.actionBars) return;
  const UI = UI_THEME.palette;
  const dragging = canvasFrameDragging();
  c.save();
  for (const b of hotbarBounds(bars, width, height)) {
    const active = dragging === b.id || scaleDrag?.id === b.id;
    if (!b.visible) {
      c.fillStyle = 'rgba(10, 18, 26, .55)';
      c.fillRect(b.x, b.y, b.w, b.h);
    }
    c.strokeStyle = b.locked ? 'rgba(160, 170, 190, .5)' : active ? UI.brass : 'rgba(240, 200, 100, .55)';
    c.lineWidth = active ? 1.6 : 1;
    c.setLineDash(b.locked ? [2, 3] : [5, 4]);
    c.strokeRect(b.x + .5, b.y + .5, b.w - 1, b.h - 1);
    c.setLineDash([]);
    c.fillStyle = 'rgba(7, 17, 29, .9)';
    const labelW = b.label.length * 6.4 + 12;
    c.fillRect(b.x, b.y - 16, labelW, 14);
    text(c, b.label, b.x + 6, b.y - 13, .72, b.visible ? UI.ivory : 'rgba(216,228,234,.45)');
    if (!b.locked) {
      const g = gripRect(b);
      c.fillStyle = 'rgba(240, 200, 100, .8)';
      c.beginPath();
      c.moveTo(g.x + g.w, g.y); c.lineTo(g.x + g.w, g.y + g.h); c.lineTo(g.x, g.y + g.h);
      c.closePath(); c.fill();
    }
  }
  c.restore();
}

// ── Keybind helpers ───────────────────────────────────────────────────────────

/** Control action driving one slot of the active page (slot 0..11), or null
 * for out-of-range slots. Side-bar pages have no keybindable action — they are
 * click-only, matching WoW's unbound extra bars. */
export function hotbarSlotAction(slot: number): ControlAction | null {
  return Number.isInteger(slot) && slot >= 0 && slot < BAR_SLOTS ? SKILL_ACTIONS[slot] : null;
}

/** Display labels for the 12 active-page slots read from the player's actual
 * bindings (e.g. ['1','2',…,'='] by default, 'Q'/'M4' after rebinding). Use for
 * the drawn key badges instead of the static BAR_KEY_LABELS. */
export function hotbarKeyLabels(bindings: ControlBindings): string[] {
  return SKILL_ACTIONS.map(action => {
    const code = bindings.get(action).find(Boolean);
    return code ? controlLabel(code) : '';
  });
}
