/** PvP match HUD: a compact top-center status bar (clock, score headline,
 * sudden-death warning) plus world-anchored objective markers for flags and
 * nodes. Drawn into the native-resolution UI pass; presentation only. */
import { pvpMatchStatus } from './pvp-match.ts';
import { currentPvpMatch } from './pvp-instance.ts';
import type { Simulation } from './simulation.ts';
import { GAME_FONT_STACK } from './font.ts';

const TEAM_COLOR: Record<string, string> = { A: '#e8b64a', B: '#7fa8e0' };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Top-center match status bar. Returns the bar's bottom edge (px) so callers
 * can keep other chrome clear; 0 when no match is live. */
export function drawPvpStatus(c: CanvasRenderingContext2D, sim: Simulation, width: number): number {
  const status = pvpMatchStatus(sim);
  if (!status || status.phase === 'finished') return 0;
  const cx = width / 2, top = 14;
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const clock = status.phase === 'prep' ? `Starts in ${Math.ceil(status.prepLeft)}` : fmt(status.timeLeft);
  const label = status.suddenDeath ? `${status.scoreLabel} — SUDDEN DEATH` : status.scoreLabel;
  c.font = `600 13px ${GAME_FONT_STACK}`;
  const w = Math.max(c.measureText(clock).width, c.measureText(label).width) + 34;
  c.fillStyle = 'rgba(8,12,18,.72)'; c.strokeStyle = 'rgba(160,180,200,.4)'; c.lineWidth = 1;
  roundRect(c, cx - w / 2, top, w, 40, 6); c.fill(); c.stroke();
  c.fillStyle = status.suddenDeath ? '#ff8a5c' : '#e8eef4';
  c.font = `700 15px ${GAME_FONT_STACK}`; c.fillText(clock, cx, top + 14);
  c.fillStyle = status.suddenDeath ? '#ffb08a' : '#a9b8c4';
  c.font = `600 10px ${GAME_FONT_STACK}`; c.fillText(label, cx, top + 30);
  c.restore();
  return top + 40;
}

/** World-anchored objective markers (flags / nodes) projected to screen. */
export function drawPvpMarkers(c: CanvasRenderingContext2D, sim: Simulation,
  project: (x: number, y: number) => { x: number; y: number }): void {
  const match = currentPvpMatch(sim);
  const markers = match?.objectives?.markers?.() ?? [];
  if (!markers.length) return;
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const m of markers) {
    const s = project(m.x, m.y);
    if (s.x < -30 || s.x > c.canvas.width + 30 || s.y < -30 || s.y > c.canvas.height + 30) continue;
    const color = m.owner ? TEAM_COLOR[m.owner] : '#9aa4ae';
    if (m.kind === 'flag') {
      c.fillStyle = color; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(s.x, s.y - 14); c.lineTo(s.x + 11, s.y - 9); c.lineTo(s.x, s.y - 4); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(s.x, s.y - 14); c.lineTo(s.x, s.y + 4); c.stroke();
      if (m.state === 'dropped') { c.fillStyle = '#ffd76a'; c.font = `700 9px ${GAME_FONT_STACK}`; c.fillText('!', s.x + 8, s.y - 16); }
    } else {
      c.fillStyle = color; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1;
      c.beginPath(); c.arc(s.x, s.y - 8, 6, 0, Math.PI * 2); c.fill(); c.stroke();
      if (m.progress != null && m.progress > 0 && m.progressTeam) {
        c.strokeStyle = TEAM_COLOR[m.progressTeam]; c.lineWidth = 2;
        c.beginPath(); c.arc(s.x, s.y - 8, 8, -Math.PI / 2, -Math.PI / 2 + m.progress * Math.PI * 2); c.stroke();
      }
    }
  }
  c.restore();
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
