/** WoW ghost-run presentation on the HUD canvas: a pale veil over the world, a
 * spectral aura on the spirit, and markers for the waiting corpse and the spirit
 * healer. DOM/canvas only — kept out of the headless core (death-content.ts owns
 * the GhostState data). */
import type { GhostState } from './death-content.ts';

const SPIRIT_COLORS = Object.freeze({ veil: 'rgba(96, 120, 148, .16)', aura: '#bcd8ff', corpse: '#e8d9b0', healer: '#cfe4ff' });

/** Screen-space marker: a diamond + label on-screen, an edge arrow pointing off-screen. */
function spiritMarker(c: CanvasRenderingContext2D, point: { x: number; y: number }, label: string,
  color: string, width: number, height: number): void {
  const margin = 26;
  const x = Math.max(margin, Math.min(width - margin, point.x));
  const y = Math.max(margin + 14, Math.min(height - margin - 14, point.y));
  const offScreen = x !== point.x || y !== point.y;
  c.save();
  c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 1.5;
  if (offScreen) {
    const angle = Math.atan2(point.y - y, point.x - x);
    c.translate(x, y); c.rotate(angle);
    c.beginPath(); c.moveTo(9, 0); c.lineTo(-4, -6); c.lineTo(-4, 6); c.closePath(); c.fill();
    c.rotate(-angle); c.font = '10px "Evergrow Numerals", system-ui, sans-serif'; c.textAlign = 'center';
    c.fillText(label, 0, 22);
  } else {
    c.beginPath(); c.moveTo(point.x, point.y - 8); c.lineTo(point.x + 6, point.y);
    c.lineTo(point.x, point.y + 8); c.lineTo(point.x - 6, point.y); c.closePath(); c.stroke();
    c.font = '10px "Evergrow Numerals", system-ui, sans-serif'; c.textAlign = 'center';
    c.fillText(label, point.x, point.y - 14);
  }
  c.restore();
}

/** Ghost-run overlay: veil, spectral aura, corpse + Spirit Healer markers. */
export function drawSpiritWorld(c: CanvasRenderingContext2D, ghost: GhostState,
  player: { x: number; y: number }, project: (x: number, y: number) => { x: number; y: number },
  width: number, height: number, time: number, reducedMotion: boolean): void {
  c.save();
  c.fillStyle = SPIRIT_COLORS.veil; c.fillRect(0, 0, width, height);
  const at = project(player.x, player.y);
  const pulse = reducedMotion ? .5 : .5 + Math.sin(time * 3.2) * .18;
  const aura = c.createRadialGradient(at.x, at.y - 16, 2, at.x, at.y - 16, 34);
  aura.addColorStop(0, `rgba(188, 216, 255, ${.34 * pulse + .12})`);
  aura.addColorStop(1, 'rgba(188, 216, 255, 0)');
  c.fillStyle = aura; c.beginPath(); c.arc(at.x, at.y - 16, 34, 0, Math.PI * 2); c.fill();
  c.strokeStyle = `rgba(188, 216, 255, ${.5 * pulse + .2})`; c.lineWidth = 1;
  c.beginPath(); c.ellipse(at.x, at.y + 2, 13, 5, 0, 0, Math.PI * 2); c.stroke();
  spiritMarker(c, project(ghost.corpse.x, ghost.corpse.y), 'Corpse', SPIRIT_COLORS.corpse, width, height);
  spiritMarker(c, project(ghost.healer.x, ghost.healer.y), `Spirit Healer · ${ghost.healer.name}`, SPIRIT_COLORS.healer, width, height);
  c.restore();
}
