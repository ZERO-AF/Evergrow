import { collectCastBars, type EnemyCast } from './cast-bar.ts';
import type { CastBarSettings } from './cast-bar-settings.ts';
import { enemyBodyBounds } from './enemy-body.ts';
import { worldToScreen, type CameraView } from './camera.ts';
import type { Simulation } from './simulation.ts';
import { text, textWidth } from './font.ts';
import { UI_THEME } from './ui-theme.ts';
import { shade } from './hud-orb.ts';

/**
 * Canvas pass for per-enemy cast bars (docs/wow-deepening.md — WoW nameplate
 * casts). Drawn in screen space over the world: each casting enemy gets a
 * compact bar + spell name anchored above its head (over the floating health
 * bar) or below its feet, per CastBarSettings. Bars keep a constant screen
 * size like WoW nameplates; `settings.scale` is the user's multiplier.
 */

const UI = UI_THEME.palette;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

const BAR_WIDTH = 64;
const BAR_HEIGHT = 7;
const UNINTERRUPTIBLE = '#8d9aa4';

/** WoW's shield glyph on casts that cannot be interrupted. */
function shieldIcon(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.beginPath();
  c.moveTo(x, y - 4.4 * s); c.lineTo(x + 3.6 * s, y - 2.8 * s); c.lineTo(x + 3.2 * s, y + 1.6 * s);
  c.lineTo(x, y + 4.4 * s); c.lineTo(x - 3.2 * s, y + 1.6 * s); c.lineTo(x - 3.6 * s, y - 2.8 * s);
  c.closePath();
  c.fillStyle = '#22303a'; c.fill();
  c.strokeStyle = UNINTERRUPTIBLE; c.lineWidth = .9; c.stroke();
}

/** Small spark marking a cast the player can interrupt. */
function interruptIcon(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  c.beginPath();
  c.moveTo(x + 1.6 * s, y - 4.6 * s); c.lineTo(x - 2.6 * s, y + .8 * s); c.lineTo(x - .2 * s, y + .8 * s);
  c.lineTo(x - 1.6 * s, y + 4.6 * s); c.lineTo(x + 2.6 * s, y - .8 * s); c.lineTo(x + .2 * s, y - .8 * s);
  c.closePath();
  c.fillStyle = color; c.fill();
  c.strokeStyle = '#050a10'; c.lineWidth = .7; c.stroke();
}

function drawBar(c: CanvasRenderingContext2D, cast: EnemyCast, x: number, barTop: number,
  s: number, time: number, settings: CastBarSettings, reducedMotion: boolean): void {
  const w = BAR_WIDTH * s, h = BAR_HEIGHT * s;
  const casting = cast.phase === 'cast';
  const color = cast.interruptible ? cast.color : UNINTERRUPTIBLE;
  const urgent = casting && cast.remaining <= .55;
  c.save();
  if (urgent && !reducedMotion) c.globalAlpha = .78 + .22 * Math.sin(time * 22);
  c.fillStyle = '#050a10e2'; c.fillRect(x - w / 2 - 1, barTop - 1, w + 2, h + 2);
  const fill = c.createLinearGradient(0, barTop, 0, barTop + h);
  fill.addColorStop(0, shade(color, .25)); fill.addColorStop(.5, color); fill.addColorStop(1, shade(color, -.45));
  c.fillStyle = fill; c.fillRect(x - w / 2, barTop, w * clamp(cast.progress), h);
  c.fillStyle = '#ffffff22'; c.fillRect(x - w / 2, barTop, w * clamp(cast.progress), Math.max(.6, .7 * s));
  c.strokeStyle = urgent ? '#f34e60' : '#4a6573'; c.lineWidth = Math.max(.6, .8 * s);
  c.strokeRect(x - w / 2 - .5, barTop - .5, w + 1, h + 1);
  if (settings.interruptIcon) {
    const ix = x - w / 2 - 6 * s, iy = barTop + h / 2;
    if (cast.interruptible) interruptIcon(c, ix, iy, s, color);
    else shieldIcon(c, ix, iy, s);
  }
  if (casting && w >= 40)
    text(c, cast.remaining.toFixed(1), x + w / 2 - 3 * s, barTop + 1.5 * s, .5 * s, '#ffe9d6', 'right');
  c.restore();
}

/**
 * Draws every live enemy cast bar. Call inside the world pass after the camera
 * transform is restored (the function projects through `view` itself), e.g.
 * right after `this.healthBars(sim, alpha); c.restore();`.
 */
export function drawCastBars(c: CanvasRenderingContext2D, sim: Simulation, view: CameraView,
  settings: CastBarSettings, reducedMotion = false): void {
  if (!settings.visible || settings.scale <= 0) return;
  const casts = collectCastBars(sim.enemies, sim.player.targetId);
  if (!casts.length) return;
  const s = settings.scale, alpha = sim.interpolationAlpha;
  const screenW = view.width * view.zoom, screenH = view.height * view.zoom;
  const above = settings.position !== 'below';
  for (const cast of casts) {
    const e = cast.enemy;
    const bounds = enemyBodyBounds(e);
    const wx = lerp(e.prevX, e.x, alpha);
    const head = worldToScreen(view, wx, lerp(e.prevY, e.y, alpha) + (bounds.headTop ?? bounds.top));
    if (head.x < -90 || head.x > screenW + 90 || head.y < -80 || head.y > screenH + 90) continue;
    const feet = worldToScreen(view, wx, lerp(e.prevY, e.y, alpha) + bounds.bottom);
    const w = BAR_WIDTH * s, h = BAR_HEIGHT * s;
    // 'above': stack sits over the floating health bar; 'below': hangs under the feet.
    // text() takes a cap-top y; the name is ~4.8*s tall at size .62*s.
    const barTop = above ? head.y - 6 * s - h : feet.y + 14 * s;
    const nameY = above ? barTop - 7.5 * s : feet.y + 7 * s;
    c.save();
    c.shadowColor = '#010409'; c.shadowBlur = 2; c.shadowOffsetY = 1;
    const nameSize = Math.min(.62 * s, (w + 34 * s) / Math.max(1, textWidth(cast.spell)));
    text(c, cast.spell, head.x + (settings.interruptIcon ? 4 * s : 0), nameY, nameSize,
      cast.phase === 'cast' ? '#f4f0e2' : UI.ivory, 'center');
    c.restore();
    drawBar(c, cast, head.x, barTop, s, sim.time, settings, reducedMotion);
  }
}
