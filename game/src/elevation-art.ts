/** Elevation shading overlay (wayfinder world-t03): a bounded pass drawn over the
 * ground layer that makes authored height read as 3D — lit rims on the high side,
 * shadowed cliff faces on the low side, and a worn strip along ramps. Geometry comes
 * from ElevationRegion, so the drawn face band is exactly the band collision blocks.
 * Overhang faces carry an occluder; their alpha comes from the shared OcclusionField
 * so a cliff lip fades like a tree crown when it covers the player. */

import type { ElevationFace, ElevationRampView, ElevationRegion } from './elevation.ts';
import type { OccluderVolume } from './occlusion.ts';
import { occluderBlocks, type OcclusionField } from './occlusion.ts';

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function faceStrength(face: ElevationFace): number {
  return clamp01(Math.abs(face.tier) * .55 + .3);
}

/** Shadow on the low side of a rect edge: south face darkest, side faces moderate,
 * north face nearly none (the camera looks from the south). Valleys invert: the
 * band sits inside the bowl and the south rim casts the shadow. */
function rectFaceBands(face: ElevationFace): { shadow: number; light: number } {
  return face.tier > 0 ? { shadow: 1, light: .3 } : { shadow: .85, light: .35 };
}

function drawRectFace(c: CanvasRenderingContext2D, face: ElevationFace, alpha: number) {
  const { x, y, w, h, edge, tier } = face;
  const strength = faceStrength(face) * alpha;
  const { shadow, light } = rectFaceBands(face);
  const raised = tier > 0;
  // Face band on the low side: outside the footprint for raised features, inside for valleys.
  const band = (bx: number, by: number, bw: number, bh: number, vertical: 'top' | 'bottom' | null) => {
    if (bw <= 0 || bh <= 0) return;
    const g = vertical === 'bottom'
      ? c.createLinearGradient(0, by, 0, by + bh)
      : vertical === 'top'
        ? c.createLinearGradient(0, by + bh, 0, by)
        : c.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, `rgba(8,12,18,${(.5 * strength * shadow).toFixed(3)})`);
    g.addColorStop(1, 'rgba(8,12,18,0)');
    c.fillStyle = g;
    c.fillRect(bx, by, bw, bh);
  };
  if (raised) {
    band(x, y + h, w, edge, 'bottom');                    // south face
    band(x - edge * .6, y, edge * .6, h, null);           // west face
    band(x + w, y, edge * .6, h, null);                   // east face (gradient flips via direction)
    band(x, y - edge * .35, w, edge * .35, 'top');        // north face, faint
    // Lit rim just inside the top edge.
    const rim = c.createLinearGradient(0, y, 0, y + Math.min(10, h));
    rim.addColorStop(0, `rgba(255,244,214,${(.16 * strength * light + .1 * strength).toFixed(3)})`);
    rim.addColorStop(1, 'rgba(255,244,214,0)');
    c.fillStyle = rim; c.fillRect(x, y, w, Math.min(10, h));
  } else {
    band(x, y, w, edge, 'top');                           // north inner wall faces the camera
    band(x - edge * .5, y, edge * .5, h, null);
    band(x + w, y, edge * .5, h, null);
    band(x, y + h - edge * .4, w, edge * .4, 'bottom');   // south inner wall, shadowed lip
    const rim = c.createLinearGradient(0, y + h - Math.min(10, h), 0, y + h);
    rim.addColorStop(0, 'rgba(255,244,214,0)');
    rim.addColorStop(1, `rgba(255,244,214,${(.12 * strength).toFixed(3)})`);
    c.fillStyle = rim; c.fillRect(x, y + h - Math.min(10, h), w, Math.min(10, h));
  }
}

function drawDiscFace(c: CanvasRenderingContext2D, face: ElevationFace, alpha: number) {
  const { x, y, r, edge, tier } = face;
  if (r <= 0) return;
  const strength = faceStrength(face) * alpha;
  const raised = tier > 0;
  // Raised: shadow ring outside, heaviest on the south arc; valley: inside.
  const radius = raised ? r + edge / 2 : Math.max(1, r - edge / 2);
  c.save();
  c.lineWidth = edge;
  c.strokeStyle = `rgba(8,12,18,${(.42 * strength).toFixed(3)})`;
  c.beginPath(); c.arc(x, y, radius, 0, Math.PI); c.stroke();            // south half
  c.strokeStyle = `rgba(8,12,18,${(.12 * strength).toFixed(3)})`;
  c.beginPath(); c.arc(x, y, radius, Math.PI, TAU); c.stroke();          // north half
  c.lineWidth = Math.min(8, edge * .3);
  c.strokeStyle = `rgba(255,244,214,${(.14 * strength).toFixed(3)})`;
  c.beginPath(); c.arc(x, y, raised ? r - 4 : r + 4, Math.PI, TAU); c.stroke();
  c.restore();
}

function drawRamp(c: CanvasRenderingContext2D, ramp: ElevationRampView) {
  const dx = ramp.x2 - ramp.x1, dy = ramp.y2 - ramp.y1;
  const length = Math.hypot(dx, dy);
  if (length < 1) return;
  const nx = -dy / length, ny = dx / length, half = ramp.width / 2;
  c.save();
  c.lineCap = 'round';
  // Worn light strip up the ramp.
  c.strokeStyle = 'rgba(226,214,188,.10)';
  c.lineWidth = ramp.width * .55;
  c.beginPath(); c.moveTo(ramp.x1, ramp.y1); c.lineTo(ramp.x2, ramp.y2); c.stroke();
  // Ledge shading along both sides.
  c.strokeStyle = 'rgba(8,12,18,.16)';
  c.lineWidth = Math.min(7, half * .45);
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(ramp.x1 + nx * half * side, ramp.y1 + ny * half * side);
    c.lineTo(ramp.x2 + nx * half * side, ramp.y2 + ny * half * side);
    c.stroke();
  }
  c.restore();
}

/** Draw the elevation overlay for one region. `focus` is the smoothed camera center
 * and `player` the interpolated player position; overhang faces fade through the
 * shared occlusion field. Returns the number of faces drawn (test hook). */
export function drawElevationRegion(c: CanvasRenderingContext2D, region: ElevationRegion,
  occlusion: OcclusionField, focus: { x: number; y: number }, player: { x: number; y: number },
  dt: number, reducedMotion: boolean): number {
  let drawn = 0;
  for (const face of region.faces) {
    const occluder: OccluderVolume | undefined = face.occluder;
    const alpha = occluder
      ? occlusion.update(`elev:${face.shape}:${face.x}:${face.y}`, occluderBlocks(occluder, focus.x, focus.y, player.x, player.y), dt, reducedMotion, .3)
      : 1;
    if (alpha < .02) continue;
    if (face.shape === 'disc') drawDiscFace(c, face, alpha);
    else drawRectFace(c, face, alpha);
    drawn++;
  }
  for (const ramp of region.ramps) drawRamp(c, ramp);
  return drawn;
}
