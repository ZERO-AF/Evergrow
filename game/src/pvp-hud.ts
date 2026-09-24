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
  const prep = status.phase === 'prep';
  // Cheap pulses: prep breathes slowly, sudden death flashes hot.
  const prepPulse = .5 + .5 * Math.sin(sim.time * 4.2);
  const deathPulse = .5 + .5 * Math.sin(sim.time * 7.5);
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const clock = prep ? `The battle begins in ${Math.ceil(status.prepLeft)}…` : fmt(status.timeLeft);
  const scoreText = `${status.score.A} – ${status.score.B}`;
  const label = status.suddenDeath ? `${status.scoreLabel} — SUDDEN DEATH` : status.scoreLabel;
  const clockFont = `700 ${prep ? 19 : 15}px ${GAME_FONT_STACK}`;
  c.font = `600 13px ${GAME_FONT_STACK}`;
  const w = Math.max(c.measureText(clock).width * (prep ? 1.45 : 1), c.measureText(scoreText).width, c.measureText(label).width) + 34;
  const h = prep ? 62 : 54;
  c.fillStyle = status.suddenDeath ? `rgba(${28 + 14 * deathPulse},10,12,.78)` : 'rgba(8,12,18,.72)';
  c.strokeStyle = status.suddenDeath ? `rgba(243,78,96,${.45 + .45 * deathPulse})` : 'rgba(160,180,200,.4)';
  c.lineWidth = status.suddenDeath ? 1.5 : 1;
  roundRect(c, cx - w / 2, top, w, h, 6); c.fill(); c.stroke();
  if (status.suddenDeath) {
    // Soft outer glow so the bar reads as "burning" without new assets.
    c.strokeStyle = `rgba(243,78,96,${.18 * deathPulse})`; c.lineWidth = 5;
    roundRect(c, cx - w / 2, top, w, h, 6); c.stroke();
  }
  c.font = clockFont;
  c.fillStyle = prep ? `rgba(232,193,90,${.72 + .28 * prepPulse})` : status.suddenDeath ? '#ff8a5c' : '#e8eef4';
  c.fillText(clock, cx, top + (prep ? 16 : 13));
  // Live score: team-colored numbers so the arena/BG standing reads at a glance.
  c.font = `700 13px ${GAME_FONT_STACK}`;
  const aW = c.measureText(String(status.score.A)).width;
  const bW = c.measureText(String(status.score.B)).width;
  const sepW = c.measureText(' – ').width;
  const left = cx - (aW + sepW + bW) / 2;
  const scoreY = top + (prep ? 38 : 30);
  c.fillStyle = TEAM_COLOR.A; c.fillText(String(status.score.A), left + aW / 2, scoreY);
  c.fillStyle = '#a9b8c4'; c.fillText(' – ', left + aW + sepW / 2, scoreY);
  c.fillStyle = TEAM_COLOR.B; c.fillText(String(status.score.B), left + aW + sepW + bW / 2, scoreY);
  c.font = `600 10px ${GAME_FONT_STACK}`;
  if (status.suddenDeath) c.fillStyle = `rgba(255,140,92,${.55 + .45 * deathPulse})`;
  else c.fillStyle = prep ? '#c9b98a' : '#a9b8c4';
  c.fillText(prep ? 'Gates closed — take your position' : label, cx, top + (prep ? 52 : 45));
  c.restore();
  return top + h;
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
