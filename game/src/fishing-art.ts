import type { FishingSession } from './fishing.ts';

/** Fishing presentation (docs/wow-deepening.md §13): bobber, line, splash.
 * World-space drawing — the renderer translates to the camera before calling.
 * Presentation only; all state lives in the integrator-owned FishingSession. */

const BOB = '#d8d3c8', BOB_DARK = '#8f2f2f', LINE = '#c9c2a8', SPLASH = '#cfe8ef', RING = '#9fd4e2';

/** Cast arc: faint dashed line from the player to the bobber while it flies. */
export function drawFishingLine(c: CanvasRenderingContext2D, fromX: number, fromY: number, bobberX: number, bobberY: number, time: number): void {
  c.save();
  c.strokeStyle = LINE + '88';
  c.lineWidth = .8;
  c.setLineDash([3, 4]);
  c.lineDashOffset = -time * 6;
  // Slight sag: the line dips toward the water between rod tip and bobber.
  const mx = (fromX + bobberX) / 2, my = (fromY + bobberY) / 2 + 10;
  c.beginPath();
  c.moveTo(fromX, fromY - 26);
  c.quadraticCurveTo(mx, my, bobberX, bobberY - 4);
  c.stroke();
  c.restore();
}

/** Bobber + water rings + bite splash. `bitAt` drives the splash phase. */
export function drawFishingBobber(c: CanvasRenderingContext2D, session: FishingSession, time: number, reducedMotion = false): void {
  const bobber = session.bobber;
  if (!bobber) return;
  const age = time - bobber.castAt;
  const biting = bobber.bitAt !== undefined;
  const biteAge = biting ? time - bobber.bitAt! : 0;
  const bob = reducedMotion ? 0 : Math.sin(age * 2.2) * 1.6 + (biting ? Math.sin(biteAge * 26) * 2.4 : 0);
  const x = bobber.x, y = bobber.y + bob;

  c.save();
  // Water rings: a slow idle ripple, plus expanding splash rings on the bite.
  c.strokeStyle = RING;
  c.lineWidth = 1;
  const idle = reducedMotion ? .5 : (age * .5) % 1;
  c.globalAlpha = (1 - idle) * .35;
  c.beginPath();
  c.ellipse(x, bobber.y + 2, 6 + idle * 12, 2.4 + idle * 4.5, 0, 0, Math.PI * 2);
  c.stroke();
  if (biting) {
    for (let i = 0; i < 2; i++) {
      const phase = Math.min(1, biteAge * 1.6 - i * .3);
      if (phase <= 0) continue;
      c.globalAlpha = (1 - phase) * .8;
      c.beginPath();
      c.ellipse(x, bobber.y + 2, 5 + phase * 22, 2 + phase * 8, 0, 0, Math.PI * 2);
      c.stroke();
    }
    // Splash droplets kicked up around the bobber.
    if (!reducedMotion) {
      c.fillStyle = SPLASH;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047 + .4, d = 4 + biteAge * 26, rise = Math.max(0, 9 * Math.sin(Math.min(1, biteAge * 2.4) * Math.PI));
        c.globalAlpha = Math.max(0, .9 - biteAge * .9);
        c.fillRect(x + Math.cos(a) * d - .8, bobber.y - rise + Math.sin(a) * 3 - .8, 1.6, 1.6);
      }
    }
  }
  c.globalAlpha = 1;

  // Shadow on the water, then the classic red/white bobber.
  c.fillStyle = '#04121acc';
  c.beginPath();
  c.ellipse(x, bobber.y + 3, 5.5, 2.2, 0, 0, Math.PI * 2);
  c.fill();
  c.translate(x, y);
  if (biting) c.rotate(Math.sin(biteAge * 30) * .18);
  c.fillStyle = BOB_DARK;
  c.beginPath();
  c.arc(0, 0, 4.2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = BOB;
  c.beginPath();
  c.arc(0, -1.4, 4.2, Math.PI, 0);
  c.fill();
  c.fillStyle = '#f4efe2';
  c.beginPath();
  c.arc(-1.2, -2.4, 1.2, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#2a1d1d';
  c.lineWidth = .7;
  c.beginPath();
  c.arc(0, 0, 4.2, 0, Math.PI * 2);
  c.stroke();
  // Stem + tip.
  c.strokeStyle = '#3a2c22';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, -4);
  c.lineTo(0, -8.5);
  c.stroke();
  c.fillStyle = biting ? '#ffd76a' : '#e8e2d2';
  c.beginPath();
  c.arc(0, -9.4, 1.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Floating prompt above the bobber ("Click to catch!") or the cast hint. Screen-space. */
export function drawFishingLabel(c: CanvasRenderingContext2D, label: string, screenX: number, screenY: number, urgent = false): void {
  c.save();
  c.font = '12px "Evergrow Numerals", system-ui, sans-serif';
  c.textAlign = 'center';
  const width = c.measureText(label).width + 18;
  c.fillStyle = '#071019ed';
  c.fillRect(screenX - width / 2, screenY - 14, width, 23);
  if (urgent) {
    c.strokeStyle = '#ffd76a90';
    c.strokeRect(screenX - width / 2, screenY - 14, width, 23);
  }
  c.fillStyle = urgent ? '#ffd76a' : '#e1dfcd';
  c.fillText(label, screenX, screenY + 2);
  c.restore();
}

/** All world-space fishing art for one frame: line, bobber, splash. */
export function drawFishing(c: CanvasRenderingContext2D, session: FishingSession, playerX: number, playerY: number, time: number, reducedMotion = false): void {
  if (!session.bobber) return;
  drawFishingLine(c, playerX, playerY, session.bobber.x, session.bobber.y, time);
  drawFishingBobber(c, session, time, reducedMotion);
}


