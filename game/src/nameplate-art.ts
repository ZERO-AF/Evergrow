import { collectNameplates, type Nameplate } from './nameplate.ts';
import type { NameplateSettings } from './nameplate-settings.ts';
import type { Simulation } from './simulation.ts';
import type { CameraView } from './camera.ts';
import { text, textWidth } from './font.ts';
import { UI_THEME } from './ui-theme.ts';
import { ENEMY_RANKS } from './progression-content.ts';
import { drawRankCrest } from './enemy-rank-art.ts';
import { COMBAT_TIMING } from './combat-content.ts';
import { shade } from './hud-orb.ts';
import { clamp } from './art-primitives.ts';

/**
 * Canvas pass for WoW-style floating enemy nameplates. Drawn in screen space
 * over the world — call after the camera transform is restored, next to
 * drawCastBars (e.g. `drawNameplates(c, sim, this.view, nameplateSettings(),
 * settings.reducedMotion)` right after the cast-bar call in renderer.ts).
 *
 * Each plate keeps a constant screen size like WoW: name over a compact health
 * bar, rank-colored border, difficulty-colored level, rare/elite crest or boss
 * skull, and the enemy's cast bar embedded underneath (data from cast-bar.ts).
 * The player's current target draws last with a bright border.
 */

const UI = UI_THEME.palette;

const PLATE_W = 84;
const BOSS_W = 110;
const BAR_H = 6;
const CAST_H = 5;
const UNINTERRUPTIBLE = '#8d9aa4';

/** WoW difficulty colors for the level badge, by level delta vs the player. */
function levelColor(n: Nameplate, playerLevel: number): string {
  if (n.boss) return '#f34e50';
  const d = n.level - playerLevel;
  return d >= 5 ? '#f34e50' : d >= 3 ? '#f09a4e' : d >= -2 ? '#e8d44f' : d >= -6 ? '#6fc24e' : '#9a9a9a';
}

/** Rank-colored plate border; 'none' keeps WoW's thin dark edge. */
function borderColor(n: Nameplate): string {
  return n.crest === 'boss' ? '#8a1f1f' : n.crest === 'elite' ? '#d4af5a'
    : n.crest === 'rare' ? '#a8c4d4' : '#141c22';
}

/** Small skull glyph marking a boss plate, left of the name. */
function bossSkull(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.beginPath(); c.arc(0, -1, 3.4, Math.PI * .95, Math.PI * 2.05);
  c.lineTo(2.4, 2.6); c.lineTo(-2.4, 2.6); c.closePath();
  c.fillStyle = '#d8d2c0'; c.fill(); c.strokeStyle = '#0a0e12'; c.lineWidth = .7; c.stroke();
  c.fillStyle = '#0a0e12';
  c.beginPath(); c.arc(-1.4, -.9, .85, 0, 7); c.arc(1.4, -.9, .85, 0, 7); c.fill();
  c.fillRect(-.4, .6, .8, 1.4);
  c.restore();
}

/** Embedded cast bar under the health bar — same EnemyCast data as cast-bar-art. */
function drawPlateCast(c: CanvasRenderingContext2D, n: Nameplate, x: number, top: number,
  w: number, s: number, time: number, reducedMotion: boolean): void {
  const cast = n.casting!;
  const h = CAST_H * s;
  const casting = cast.phase === 'cast';
  const color = cast.interruptible ? cast.color : UNINTERRUPTIBLE;
  const urgent = casting && cast.remaining <= .55;
  c.save();
  if (urgent && !reducedMotion) c.globalAlpha = .78 + .22 * Math.sin(time * 22);
  c.fillStyle = '#050a10e2'; c.fillRect(x - w / 2 - 1, top - 1, w + 2, h + 2);
  const fill = c.createLinearGradient(0, top, 0, top + h);
  fill.addColorStop(0, shade(color, .25)); fill.addColorStop(.5, color); fill.addColorStop(1, shade(color, -.45));
  c.fillStyle = fill; c.fillRect(x - w / 2, top, w * clamp(cast.progress), h);
  c.strokeStyle = urgent ? '#f34e60' : '#4a6573'; c.lineWidth = Math.max(.5, .7 * s);
  c.strokeRect(x - w / 2 - .5, top - .5, w + 1, h + 1);
  // Spell name sits inside the bar; uninterruptible casts get the shield tick.
  c.shadowColor = '#010409'; c.shadowBlur = 2;
  const nameSize = Math.min(.5 * s, (w - 14 * s) / Math.max(1, textWidth(cast.spell)));
  text(c, cast.spell, x, top + h / 2 - 2 * s, nameSize, casting ? '#f4f0e2' : UI.ivory, 'center');
  c.shadowBlur = 0;
  if (!cast.interruptible) {
    const ix = x - w / 2 - 4.5 * s, iy = top + h / 2;
    c.beginPath(); c.moveTo(ix, iy - 3.4 * s); c.lineTo(ix + 2.8 * s, iy - 2.2 * s);
    c.lineTo(ix + 2.5 * s, iy + 1.2 * s); c.lineTo(ix, iy + 3.4 * s);
    c.lineTo(ix - 2.5 * s, iy + 1.2 * s); c.lineTo(ix - 2.8 * s, iy - 2.2 * s); c.closePath();
    c.fillStyle = '#22303a'; c.fill(); c.strokeStyle = UNINTERRUPTIBLE; c.lineWidth = .7; c.stroke();
  } else if (casting) {
    text(c, cast.remaining.toFixed(1), x + w / 2 + 3 * s, top + h / 2 - 2 * s, .5 * s, '#ffe9d6', 'left');
  }
  c.restore();
}

function drawPlate(c: CanvasRenderingContext2D, n: Nameplate, playerLevel: number,
  s: number, time: number, showCast: boolean, reducedMotion: boolean): void {
  const w = (n.boss ? BOSS_W : PLATE_W) * s, hb = BAR_H * s;
  const cast = showCast && n.casting ? n.casting : null;
  // The stack hangs above the head anchor: cast bar lowest, then health, then name.
  const castTop = cast ? n.y - 3 * s - CAST_H * s : 0;
  const barTop = (cast ? castTop - 2 * s : n.y - 3 * s) - hb;
  const nameY = barTop - 7.5 * s;
  const x = n.x;

  c.save();
  // Name: rank-colored like the top plate, shifted right when a boss skull sits left.
  c.shadowColor = '#010409'; c.shadowBlur = 2; c.shadowOffsetY = 1;
  const rank = ENEMY_RANKS[n.rank];
  // PvP: allies read friendly green, enemies keep the hostile red name.
  const ally = n.team === 'A';
  const nameColor = n.team ? (ally ? '#7fd08a' : '#e8907f')
    : n.boss ? '#f0b8b0' : n.rank === 'normal' ? UI.ivory : rank.color;
  const nameSize = Math.min(.68 * s, (w + 20 * s) / Math.max(1, textWidth(n.name)));
  text(c, n.name, x + (n.boss ? 5 * s : 0), nameY, nameSize, nameColor, 'center');
  c.shadowBlur = 0; c.shadowOffsetY = 0;
  if (n.boss) bossSkull(c, x - Math.min(w / 2 + 2 * s, textWidth(n.name) * nameSize / 2 + 6 * s), nameY + 3 * s, s);
  // Elite affix glyph: a small affix-colored diamond left of the name.
  if (n.affix && n.affixColor) {
    const half = Math.min(w / 2 + 2 * s, textWidth(n.name) * nameSize / 2 + 6 * s);
    const gx = x - half - 5 * s, gy = nameY + 3 * s, r = 2.6 * s;
    c.save();
    c.fillStyle = n.affixColor;
    c.strokeStyle = '#010409'; c.lineWidth = Math.max(.6, .8 * s);
    c.beginPath();
    c.moveTo(gx, gy - r); c.lineTo(gx + r, gy); c.lineTo(gx, gy + r); c.lineTo(gx - r, gy);
    c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  // Health bar: dark well, team-colored fill (ally green / enemy red), border.
  const barX = x - w / 2;
  c.fillStyle = '#050a10e2'; c.fillRect(barX - 1, barTop - 1, w + 2, hb + 2);
  const ratio = clamp(n.hp / Math.max(1, n.maxHp));
  if (ratio > 0) {
    const hp = c.createLinearGradient(0, barTop, 0, barTop + hb);
    if (ally) { hp.addColorStop(0, '#5cb668'); hp.addColorStop(.5, '#3a8a4a'); hp.addColorStop(1, '#1e5a2c'); }
    else { hp.addColorStop(0, '#d05248'); hp.addColorStop(.5, '#a82e2e'); hp.addColorStop(1, '#6e1a1e'); }
    c.fillStyle = hp; c.fillRect(barX, barTop, w * ratio, hb);
    c.fillStyle = '#ffffff22'; c.fillRect(barX, barTop, w * ratio, Math.max(.6, .7 * s));
    const flash = clamp(n.hitFlash / COMBAT_TIMING.hitFlashDuration);
    if (flash > 0) { c.globalAlpha = flash * .55; c.fillStyle = '#fbd2bb'; c.fillRect(barX, barTop, w * ratio, hb); c.globalAlpha = 1; }
  }
  c.strokeStyle = n.targeted ? '#f0e6c8' : borderColor(n);
  c.lineWidth = Math.max(.7, (n.targeted ? 1.2 : .9) * s);
  c.strokeRect(barX - .5, barTop - .5, w + 1, hb + 1);
  if (n.targeted) {
    c.save(); c.globalAlpha = .5; c.strokeStyle = '#f0e6c8'; c.lineWidth = .5;
    c.strokeRect(barX - 2.5 * s, barTop - 2.5 * s, w + 5 * s, hb + 5 * s); c.restore();
  }

  // Level badge left of the bar in WoW difficulty colors; bosses read '??'.
  c.shadowColor = '#010409'; c.shadowBlur = 2;
  text(c, n.boss ? '??' : String(n.level), barX - 4 * s, barTop + hb / 2 - 2.4 * s,
    .62 * s, levelColor(n, playerLevel), 'right');
  c.shadowBlur = 0;

  // Rare/elite crest rides the right end of the bar (bosses wear the skull instead).
  if (n.crest === 'rare' || n.crest === 'elite')
    drawRankCrest(c, n.rank, barX + w + 7 * s, barTop + hb / 2, .5 * s);

  if (cast) drawPlateCast(c, n, x, castTop, w, s, time, reducedMotion);
  c.restore();
}

/**
 * Draws every visible enemy's nameplate. Screen-space pass: project through
 * `view` inside collectNameplates, so call it after the world transform is
 * restored — the same slot as drawCastBars.
 */
export function drawNameplates(c: CanvasRenderingContext2D, sim: Simulation, view: CameraView,
  settings: NameplateSettings, reducedMotion = false): void {
  if (!settings.visible || settings.mode === 'off' || settings.scale <= 0) return;
  const plates = collectNameplates(sim, view, settings.mode);
  if (!plates.length) return;
  for (const n of plates)
    drawPlate(c, n, sim.player.level, settings.scale, sim.time, settings.castBar, reducedMotion);
}
