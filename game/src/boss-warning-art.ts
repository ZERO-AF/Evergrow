import { text, textWidth } from './font.ts';
import { UI_THEME } from './ui-theme.ts';
import { getHUDLayout } from './hud-layout.ts';
import { shade } from './hud-orb.ts';
import { BOSS_WARNING_FLASH_SECONDS, BOSS_WARNING_OUTCOME_FADE, type BossWarning, type BossWarnings } from './boss-warnings.ts';

/** Center-screen DBM pass (docs/wow-deepening.md §10): a brief "⚠ Ability — advice!"
 * flash per new telegraph, plus countdown bars while casts wind up. Drawn at
 * native HUD resolution inside the renderer's HUD pass. */

const UI = UI_THEME.palette;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const BAR_WIDTH = 232;
const BAR_HEIGHT = 13;
const BAR_STEP = 17;
const MAX_BARS = 4;
const MAX_FLASHES = 2;
function warningGlyph(c: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, mark = '#0a0f14'): void {
  c.beginPath();
  c.moveTo(x, y - size * .58); c.lineTo(x + size * .56, y + size * .42); c.lineTo(x - size * .56, y + size * .42);
  c.closePath();
  c.fillStyle = color; c.fill();
  c.strokeStyle = '#0a0f14'; c.lineWidth = .8; c.stroke();
  text(c, '!', x, y - size * .3, size * .075, mark, 'center');
}

function flashAlpha(warning: BossWarning): number {
  return Math.min(1, warning.age * 9) * clamp((BOSS_WARNING_FLASH_SECONDS - warning.age) * 2.4);
}

function drawFlash(c: CanvasRenderingContext2D, warning: BossWarning, cx: number, y: number): void {
  const alpha = flashAlpha(warning);
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  const halo = c.createRadialGradient(cx, y + 8, 2, cx, y + 8, 150);
  halo.addColorStop(0, '#0a111bcc'); halo.addColorStop(1, '#0a111b00');
  c.fillStyle = halo; c.fillRect(cx - 170, y - 18, 340, 56);
  const abilitySize = 1.5, adviceSize = .95;
  const abilityWidth = textWidth(warning.ability, abilitySize);
  const adviceWidth = textWidth(`— ${warning.advice}`, adviceSize);
  const total = 16 + abilityWidth + 7 + adviceWidth;
  const left = cx - total / 2;
  warningGlyph(c, left + 7, y + 9, 13, warning.color);
  text(c, warning.ability, left + 16, y, abilitySize, shade(warning.color, .3));
  text(c, `— ${warning.advice}`, left + 16 + abilityWidth + 7, y + 4.5, adviceSize, UI.ivory);
  text(c, warning.caster, cx, y + 17, .72, UI.muted, 'center');
  c.restore();
}

function drawBar(c: CanvasRenderingContext2D, warning: BossWarning, cx: number, y: number,
  time: number, reducedMotion: boolean): void {
  const x = cx - BAR_WIDTH / 2;
  const casting = warning.outcome === 'casting';
  const ratio = casting ? clamp(warning.remaining / Math.max(.01, warning.duration)) : 1;
  const urgent = casting && warning.remaining <= .55;
  let alpha = 1, color = warning.color;
  if (!casting) {
    alpha = clamp(warning.fade / BOSS_WARNING_OUTCOME_FADE);
    if (warning.outcome === 'interrupted') color = UI.jade;
    else if (warning.outcome === 'released') color = shade(warning.color, .45);
    else color = UI.faint;
  } else if (urgent && !reducedMotion) {
    alpha = .78 + .22 * Math.sin(time * 22);
  }
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = '#050a10e2'; c.fillRect(x - 1, y - 1, BAR_WIDTH + 2, BAR_HEIGHT + 2);
  c.strokeStyle = urgent ? '#f34e60' : '#4a6573'; c.lineWidth = .8;
  c.strokeRect(x - .5, y - .5, BAR_WIDTH + 1, BAR_HEIGHT + 1);
  const fill = c.createLinearGradient(x, y, x, y + BAR_HEIGHT);
  fill.addColorStop(0, shade(color, .25)); fill.addColorStop(.5, color); fill.addColorStop(1, shade(color, -.45));
  c.fillStyle = fill; c.fillRect(x, y, BAR_WIDTH * ratio, BAR_HEIGHT);
  c.fillStyle = '#ffffff22'; c.fillRect(x, y, BAR_WIDTH * ratio, .7);
  warningGlyph(c, x + 8, y + BAR_HEIGHT / 2 + .5, 10, casting ? '#0a0f14' : color, casting ? color : '#0a0f14');
  const label = warning.outcome === 'interrupted' ? `${warning.ability} — Interrupted` : warning.ability;
  text(c, label, x + 16, y + 2.6, .72, casting ? '#f4f0e2' : UI.ivory);
  if (casting) text(c, warning.remaining.toFixed(1), x + BAR_WIDTH - 4, y + 2.6, .68, '#ffe9d6', 'right');
  c.restore();
}

/** Draws every live warning: flashes centered, countdown bars stacked below. */
export function drawBossWarnings(c: CanvasRenderingContext2D, warnings: BossWarnings,
  width: number, height: number, time: number, reducedMotion = false): void {
  const flashes = warnings.flashes().slice(0, MAX_FLASHES);
  const bars = warnings.bars().slice(0, MAX_BARS);
  if (!flashes.length && !bars.length) return;
  const hudTop = getHUDLayout(width, height).y;
  const cy = Math.max(96, Math.min(height * .3, hudTop - 150));
  for (const [i, warning] of flashes.entries()) drawFlash(c, warning, width / 2, cy + i * 34);
  const barTop = cy + flashes.length * 34 + 8;
  for (const [i, warning] of bars.entries()) drawBar(c, warning, width / 2, barTop + i * BAR_STEP, time, reducedMotion);
}
