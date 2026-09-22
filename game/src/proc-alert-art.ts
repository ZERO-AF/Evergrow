import { text } from './font.ts';
import { shade } from './hud-orb.ts';
import { PROC_ALERT_MAX, type ProcAlert, type ProcAlertEdge } from './proc-alert.ts';

/**
 * WoW SpellActivationOverlay pass (docs/wow-deepening.md): mirrored translucent
 * arcs hug the screen edges and the proc's name flashes beneath, pulsing in the
 * proc's school color. Drawn in screen space on the UI surface — the arcs are
 * circles centered just off-screen so only their inner rim sweeps into view.
 * Reduced motion keeps the glow static (no pulse) while the fade envelope stays.
 */

/** Screen-space viewport the overlay is drawn into. */
export interface ProcAlertView {
  readonly width: number;
  readonly height: number;
  readonly reducedMotion?: boolean;
}

const FADE_IN = .15;    // seconds to reach full glow
const FADE_OUT = .35;   // seconds to dissolve
const NAME_STEP = 24;   // vertical stack step for simultaneous names

/** Display envelope: quick attack, sustained glow, gentle release. */
function alertAlpha(alert: ProcAlert): number {
  const elapsed = alert.duration - alert.remaining;
  return Math.min(1, elapsed / FADE_IN) * Math.min(1, alert.remaining / FADE_OUT);
}

/** Arc geometry per edge: an off-screen circle whose rim bulges inward. */
function edgeArc(edge: ProcAlertEdge, w: number, h: number): { x: number; y: number; r: number; a0: number; a1: number } {
  const spread = .62;
  switch (edge) {
    case 'left': { const r = h * .62; return { x: -r * .42, y: h / 2, r, a0: -spread, a1: spread }; }
    case 'right': { const r = h * .62; return { x: w + r * .42, y: h / 2, r, a0: Math.PI - spread, a1: Math.PI + spread }; }
    case 'top': { const r = w * .5; return { x: w / 2, y: -r * .42, r, a0: Math.PI / 2 - spread, a1: Math.PI / 2 + spread }; }
    case 'bottom': { const r = w * .5; return { x: w / 2, y: h + r * .42, r, a0: -Math.PI / 2 - spread, a1: -Math.PI / 2 + spread }; }
  }
}

/** Three nested strokes: a wide faint halo, a mid band, and a hot core. */
function drawArc(c: CanvasRenderingContext2D, arc: { x: number; y: number; r: number; a0: number; a1: number },
  color: string, alpha: number, pulse: number): void {
  c.strokeStyle = color;
  c.shadowColor = color;
  c.shadowBlur = 22 * pulse;
  c.lineWidth = 30; c.globalAlpha = alpha * .16 * pulse;
  c.beginPath(); c.arc(arc.x, arc.y, arc.r, arc.a0, arc.a1); c.stroke();
  c.lineWidth = 13; c.globalAlpha = alpha * .34 * pulse;
  c.beginPath(); c.arc(arc.x, arc.y, arc.r, arc.a0, arc.a1); c.stroke();
  c.lineWidth = 4; c.globalAlpha = alpha * .62 * pulse;
  c.strokeStyle = shade(color, .55);
  c.beginPath(); c.arc(arc.x, arc.y, arc.r, arc.a0, arc.a1); c.stroke();
}

/** Draws every active proc overlay: edge arcs first, then stacked spell names. */
export function drawProcAlerts(c: CanvasRenderingContext2D, alerts: readonly ProcAlert[],
  view: ProcAlertView, time: number): void {
  const shown = alerts.slice(0, PROC_ALERT_MAX);
  if (!shown.length) return;
  const { width: w, height: h } = view;
  const reduced = view.reducedMotion === true;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const [i, alert] of shown.entries()) {
    const alpha = alertAlpha(alert);
    if (alpha <= 0) continue;
    const pulse = reduced ? 1 : .82 + .18 * Math.sin(time * 9 + i * 1.7);
    for (const edge of alert.edges) drawArc(c, edgeArc(edge, w, h), alert.color, alpha, pulse);
  }
  c.restore();
  // Spell names stack under the top-center arc position, brightest at flash peak.
  c.save();
  for (const [i, alert] of shown.entries()) {
    const alpha = alertAlpha(alert);
    if (alpha <= 0) continue;
    c.globalAlpha = alpha;
    c.shadowColor = alert.color;
    c.shadowBlur = reduced ? 8 : 14;
    text(c, alert.name, w / 2, h * .3 + i * NAME_STEP, 1.05, shade(alert.color, .6), 'center');
  }
  c.restore();
}
