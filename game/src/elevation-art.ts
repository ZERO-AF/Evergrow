/** Elevation shading overlay (wayfinder world-t03): a bounded pass drawn over the
 * ground layer that makes authored height read as 3D — lit rims on the high side,
 * shadowed cliff faces on the low side, and a worn strip along ramps. Geometry comes
 * from ElevationRegion, so the drawn face band is exactly the band collision blocks.
 * Overhang faces carry an occluder; their alpha comes from the shared OcclusionField
 * so a cliff lip fades like a tree crown when it covers the player.
 *
 * world-t13: overhangs also draw the floating island itself — a rocky underside
 * and a green top hovering above the ground shadow — and the face shading was
 * strengthened so plateau/mesa edges read clearly. The per-face occlusion test
 * is inlined (segmentHitsRect) and face ids are memoized so this pass allocates
 * nothing per frame. */

import type { ElevationFace, ElevationRampView, ElevationRegion } from './elevation.ts';
import { ELEVATION_TIER_HEIGHT } from './elevation.ts';
import type { OccluderVolume } from './occlusion.ts';
import type { OcclusionField } from './occlusion.ts';

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
    g.addColorStop(0, `rgba(8,12,18,${(.68 * strength * shadow).toFixed(3)})`);
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
    rim.addColorStop(0, `rgba(255,244,214,${(.24 * strength * light + .16 * strength).toFixed(3)})`);
    rim.addColorStop(1, 'rgba(255,244,214,0)');
    c.fillStyle = rim; c.fillRect(x, y, w, Math.min(10, h));
    // Cliff lip: a crisp highlight along the south edge so the drop reads at a glance.
    c.fillStyle = `rgba(255,244,214,${(.30 * strength).toFixed(3)})`;
    c.fillRect(x, y + h - 1.5, w, 2);
  } else {
    band(x, y, w, edge, 'top');                           // north inner wall faces the camera
    band(x - edge * .5, y, edge * .5, h, null);
    band(x + w, y, edge * .5, h, null);
    band(x, y + h - edge * .4, w, edge * .4, 'bottom');   // south inner wall, shadowed lip
    const rim = c.createLinearGradient(0, y + h - Math.min(10, h), 0, y + h);
    rim.addColorStop(0, 'rgba(255,244,214,0)');
    rim.addColorStop(1, `rgba(255,244,214,${(.18 * strength).toFixed(3)})`);
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
  c.strokeStyle = `rgba(8,12,18,${(.58 * strength).toFixed(3)})`;
  c.beginPath(); c.arc(x, y, radius, 0, Math.PI); c.stroke();            // south half
  c.strokeStyle = `rgba(8,12,18,${(.18 * strength).toFixed(3)})`;
  c.beginPath(); c.arc(x, y, radius, Math.PI, TAU); c.stroke();          // north half
  c.lineWidth = Math.min(9, edge * .3);
  c.strokeStyle = `rgba(255,244,214,${(.22 * strength).toFixed(3)})`;
  c.beginPath(); c.arc(x, y, raised ? r - 4 : r + 4, Math.PI, TAU); c.stroke();
  c.restore();
}

/** Deterministic per-face variant so islands in one zone don't look stamped. */
function faceVariant(face: ElevationFace): number {
  const n = Math.imul(Math.round(face.x), 0x45d9f3b) ^ Math.imul(Math.round(face.y), 0x27d4eb2d)
    ^ Math.imul(Math.round(face.r + face.w), 0x165667b1);
  return ((n ^ n >>> 15) >>> 0) / 0x100000000;
}

/** A floating island above the overhang's ground shadow: tapered rocky
 * underside, green top, and a few hanging rock teeth. Drawn at the face's
 * position lifted by its tier height so it reads as hovering overhead. */
function drawOverhangIsland(c: CanvasRenderingContext2D, face: ElevationFace, alpha: number) {
  const lift = Math.abs(face.tier) * ELEVATION_TIER_HEIGHT + face.edge * 1.6;
  const v = faceVariant(face);
  c.save();
  c.globalAlpha *= alpha;
  if (face.shape === 'disc') {
    const { x, y, r } = face;
    if (r <= 0) { c.restore(); return; }
    const topY = y - lift, rx = r * .92, ry = r * .62;
    // Rocky underside: a tapered cone of strata narrowing to a keel.
    const keel = ry * (0.55 + v * .3);
    c.fillStyle = '#4a4038';
    c.beginPath();
    c.moveTo(x - rx, topY);
    c.quadraticCurveTo(x - rx * .55, topY + keel * .8, x, topY + keel);
    c.quadraticCurveTo(x + rx * .55, topY + keel * .8, x + rx, topY);
    c.closePath(); c.fill();
    c.fillStyle = '#5d5248';
    c.beginPath();
    c.moveTo(x - rx * .8, topY + 2);
    c.quadraticCurveTo(x - rx * .3, topY + keel * .55, x, topY + keel * .72);
    c.quadraticCurveTo(x + rx * .3, topY + keel * .55, x + rx * .8, topY + 2);
    c.closePath(); c.fill();
    // Hanging rock teeth under the rim.
    c.fillStyle = '#3a332c';
    for (let i = -2; i <= 2; i++) {
      const tx = x + i * rx * .3 + (v - .5) * 9, tw = 4 + ((i + 2 + Math.floor(v * 7)) % 3) * 2;
      const th = 9 + ((i * 31 + Math.floor(v * 97)) % 4) * 5;
      c.beginPath(); c.moveTo(tx - tw, topY + ry * .28); c.lineTo(tx + tw, topY + ry * .28);
      c.lineTo(tx, topY + ry * .28 + th); c.closePath(); c.fill();
    }
    // Green top with a lit north rim and a darker south lip.
    c.fillStyle = '#5c7a44';
    c.beginPath(); c.ellipse(x, topY, rx, ry, 0, 0, TAU); c.fill();
    c.fillStyle = '#74945a';
    c.beginPath(); c.ellipse(x, topY - ry * .12, rx * .86, ry * .78, 0, 0, TAU); c.fill();
    c.strokeStyle = '#a8c07a'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(x, topY, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    c.strokeStyle = '#3d5530'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(x, topY, rx, ry, 0, Math.PI * .08, Math.PI * .92); c.stroke();
  } else {
    const { x, y, w, h } = face;
    const topY = y - lift, inset = Math.min(w, h) * .08;
    // Rocky underside: stepped skirt tapering inward.
    c.fillStyle = '#4a4038';
    c.beginPath();
    c.moveTo(x - inset, y); c.lineTo(x + w + inset, y);
    c.lineTo(x + w - inset * 1.5, y + h * .5); c.lineTo(x + inset * 1.5, y + h * .5);
    c.closePath(); c.fill();
    c.fillStyle = '#3a332c';
    c.fillRect(x + w * .2, y + h * .5, w * .6, Math.min(14, h * .2));
    // Green top slab with lit north edge.
    c.fillStyle = '#5c7a44';
    c.beginPath(); c.roundRect(x - inset, topY, w + inset * 2, h + inset, 10); c.fill();
    c.fillStyle = '#74945a';
    c.beginPath(); c.roundRect(x - inset * .4, topY + 3, w + inset * .8, h * .72, 8); c.fill();
    c.strokeStyle = '#a8c07a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x - inset + 8, topY + 2); c.lineTo(x + w + inset - 8, topY + 2); c.stroke();
  }
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

/** Allocation-free copy of occlusion.ts's slab test: true when the volume covers
 * any part of the focus→player segment. Kept local so this per-frame pass never
 * allocates (occlusion.ts is owned by the core-fix stream). */
function segmentHitsRect(vx: number, vy: number, vw: number, vh: number,
  ax: number, ay: number, bx: number, by: number): boolean {
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  if (Math.abs(dx) < 1e-12) { if (ax < vx || ax > vx + vw) return false; }
  else {
    let ta = (vx - ax) / dx, tb = (vx + vw - ax) / dx;
    if (ta > tb) { const swap = ta; ta = tb; tb = swap; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  if (Math.abs(dy) < 1e-12) { if (ay < vy || ay > vy + vh) return false; }
  else {
    let ta = (vy - ay) / dy, tb = (vy + vh - ay) / dy;
    if (ta > tb) { const swap = ta; ta = tb; tb = swap; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** Stable occlusion ids per face object — the compiled ElevationSite hands out
 * frozen faces, so a WeakMap memoizes the string instead of rebuilding it per frame. */
const FACE_IDS = new WeakMap<ElevationFace, string>();
function faceId(face: ElevationFace): string {
  let id = FACE_IDS.get(face);
  if (id === undefined) {
    id = `elev:${face.shape}:${face.x}:${face.y}`;
    FACE_IDS.set(face, id);
  }
  return id;
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
      ? occlusion.update(faceId(face), segmentHitsRect(occluder.x, occluder.y, occluder.width, occluder.height,
        focus.x, focus.y, player.x, player.y), dt, reducedMotion, .3)
      : 1;
    if (alpha < .02) continue;
    if (face.kind === 'overhang') drawOverhangIsland(c, face, alpha);
    if (face.shape === 'disc') drawDiscFace(c, face, alpha);
    else drawRectFace(c, face, alpha);
    drawn++;
  }
  for (const ramp of region.ramps) drawRamp(c, ramp);
  return drawn;
}
