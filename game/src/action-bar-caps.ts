/** WoW action-bar end caps (docs/wow-deepening.md §5): a gryphon and a wyvern
 * ornament flank the main bar like the classic UI, cast in the same Astral
 * metalwork as the instrument — dark steel, silver engraving, rivets, a small
 * celestial star. Decorative only: they draw outside the slot strip, so hit
 * geometry never changes. */
import { BAR_SLOTS, type BarStrip } from './action-bar.ts';

const TAU = Math.PI * 2;

/* Local space: origin at the strip's bottom-inner corner, +x outward (away
 * from the bar), -y up. Heads face -x (toward the bar) with wings sweeping
 * +x (outward), matching WoW's inward-gazing gryphon/wyvern pose. Authored
 * for a 34px slot and scaled by strip.slot / 34 at draw time. The bar edge
 * sits at x = -2; every silhouette stays at x >= 0 so no pixel enters a
 * slot's hit rect. */

const PLINTH = 'M1 0 L1 -15 L4 -18 L17 -18 L17 -6 L38 -6 L38 0 Z';

const GRYPHON_WING_A = 'M14 -12 C24 -14 36 -26 40 -42 C41 -48 37 -52 33 -49 '
  + 'Q27 -42 28 -35 Q22 -28 23 -21 Q17 -15 17 -12 L10 -12 Z';
const GRYPHON_WING_B = 'M15 -11 C21 -14 29 -22 33 -34 C34 -38 31 -40 29 -37 C24 -29 18 -20 12 -12 Z';
const GRYPHON_TUFTS = 'M16 -38 L23 -45 L14 -41 Z M19 -36 L26 -42 L17 -38 Z';
const GRYPHON_BODY = 'M9 0 C6 -9 7 -17 11 -23 C13 -27 14 -29 14 -30 L10 -33 L3 -34 L0 -36 '
  + 'L1 -39 L3 -42 L7 -45 L14 -45 L19 -42 L21 -36 L19 -31 C17 -26 16 -21 16 -16 C15 -10 15 -5 15 0 Z';

const WYVERN_WING = 'M15 -12 C24 -13 34 -23 39 -38 C40 -42 37 -45 34 -42 '
  + 'Q30 -35 32 -31 Q26 -27 27 -21 Q21 -19 21 -13 L15 -12 Z';
const WYVERN_HORN = 'M13 -37 L20 -46 L26 -48 L22 -41 L14 -34 Z '
  + 'M15 -32 L22 -38 L27 -38 L21 -31 L16 -28 Z';
const WYVERN_FRILL = 'M18 -34 L26 -37 L20 -30 Z M18 -28 L25 -30 L19 -24 Z M17 -22 L23 -23 L18 -17 Z';
const WYVERN_BODY = 'M9 0 C6 -9 7 -17 11 -23 C13 -27 14 -28 14 -29 L10 -31 L3 -32 L0 -32 '
  + 'L1 -35 L4 -37 L10 -38 L16 -37 L19 -34 L20 -30 C19 -25 18 -20 18 -15 C17 -9 17 -4 17 0 Z';

const pathCache = new Map<string, Path2D>();
function path(data: string): Path2D {
  let p = pathCache.get(data);
  if (!p) { p = new Path2D(data); pathCache.set(data, p); }
  return p;
}

interface CapPaths {
  plinth: Path2D;
  wingA: Path2D; wingB: Path2D; tufts: Path2D; body: Path2D;
  horn: Path2D; frill: Path2D;
}
let cached: { gryphon: CapPaths; wyvern: CapPaths } | null = null;
function capPaths() {
  if (!cached) cached = {
    gryphon: {
      plinth: path(PLINTH),
      wingA: path(GRYPHON_WING_A), wingB: path(GRYPHON_WING_B),
      tufts: path(GRYPHON_TUFTS), body: path(GRYPHON_BODY),
      horn: path(''), frill: path(''),
    },
    wyvern: {
      plinth: path(PLINTH),
      wingA: path(WYVERN_WING), wingB: path(''),
      tufts: path(''), body: path(WYVERN_BODY),
      horn: path(WYVERN_HORN), frill: path(WYVERN_FRILL),
    },
  };
  return cached;
}

/** The frame's black-steel gradient, tuned for the cap's 46px rise. */
function capMetal(c: CanvasRenderingContext2D) {
  const gradient = c.createLinearGradient(0, -46, 0, 0);
  gradient.addColorStop(0, '#80969f');
  gradient.addColorStop(.045, '#3b4f5b');
  gradient.addColorStop(.13, '#233039');
  gradient.addColorStop(.53, '#101b23');
  gradient.addColorStop(.91, '#0a131b');
  gradient.addColorStop(1, '#344852');
  return gradient;
}

/** Raised steel for wings, horns and tufts so they read against the night. */
function capMetalLight(c: CanvasRenderingContext2D) {
  const gradient = c.createLinearGradient(0, -46, 0, 0);
  gradient.addColorStop(0, '#9db4bc');
  gradient.addColorStop(.08, '#5d7683');
  gradient.addColorStop(.3, '#3b4f5b');
  gradient.addColorStop(.7, '#1b2a34');
  gradient.addColorStop(1, '#2c4049');
  return gradient;
}

/** Eight-point celestial star, matching the instrument's engraved spark. */
function capStar(c: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  c.beginPath();
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8, r = i % 2 === 0 ? radius : radius * .38;
    const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.closePath(); c.fillStyle = '#afc4ca'; c.fill();
}

function rivet(c: CanvasRenderingContext2D, x: number, y: number) {
  c.beginPath(); c.arc(x, y, 1, 0, TAU); c.fillStyle = '#0c1721'; c.fill();
  c.strokeStyle = '#809ba4'; c.lineWidth = .6; c.stroke();
  c.beginPath(); c.arc(x, y, .35, 0, TAU); c.fillStyle = '#c6d5d4'; c.fill();
}

function stroke(c: CanvasRenderingContext2D, data: string, color: string, width: number) {
  c.strokeStyle = color; c.lineWidth = width; c.stroke(path(data));
}

/** Pedestal bracket: the upright lug carries the page tag on the left cap. */
function plinth(c: CanvasRenderingContext2D, paths: CapPaths, metal: CanvasGradient) {
  c.fillStyle = metal; c.fill(paths.plinth);
  c.strokeStyle = '#050c12'; c.lineWidth = 1.4; c.stroke(paths.plinth);
  stroke(c, 'M4 -17.4 L16 -17.4', '#a8bfc5', .7);
  stroke(c, 'M18 -5.5 L37 -5.5', '#8ca8b2', .6);
  rivet(c, 9, -8); rivet(c, 24, -3); rivet(c, 33, -3);
}

function gryphon(c: CanvasRenderingContext2D) {
  const paths = capPaths().gryphon, metal = capMetal(c);
  plinth(c, paths, metal);
  // Lion tail curled around the pedestal foot.
  stroke(c, 'M9 -1 C4 -1 1 -4 2 -8', '#4a6573', 1.4);
  c.fillStyle = '#4a6573'; c.fill(path('M2 -8 L-.5 -11 L4.5 -10.5 Z'));
  // Wing blades and ear tufts sit behind the body so their roots stay buried.
  c.fillStyle = capMetalLight(c);
  c.fill(paths.wingA); c.fill(paths.wingB); c.fill(paths.tufts);
  c.strokeStyle = '#050c12'; c.lineWidth = 1.4;
  c.stroke(paths.wingA); c.stroke(paths.wingB); c.stroke(paths.tufts);
  c.fillStyle = metal; c.fill(paths.body); c.stroke(paths.body);
  // Engraved feathering, beak groove and rim light.
  stroke(c, 'M15 -13 C22 -17 30 -27 34 -40', '#6d828a', .7);
  stroke(c, 'M16 -12 C22 -16 28 -23 32 -32', '#6d828a', .7);
  stroke(c, 'M17 -11 C22 -14 26 -19 29 -24', '#6d828a', .7);
  stroke(c, 'M15 -13 C23 -16 32 -26 35 -41', '#a8bfc5', .7);
  stroke(c, 'M10 -33 C6 -33.8 2 -34.8 0 -36', '#050c12', .9);
  stroke(c, 'M3 -42 C7 -43.5 11 -44.5 15 -44.5', '#a8bfc5', .7);
  stroke(c, 'M14 -38 C10 -42 5 -43.5 1 -43', '#8ca8b2', .6);
  stroke(c, 'M10 -19 C13 -17.8 15 -17.8 16 -18.5', '#6d828a', .65);
  stroke(c, 'M9 -13 C12 -12 14 -12 16 -12.8', '#6d828a', .65);
  // Gold eye over a dark almond; a star marks the shoulder.
  c.fillStyle = '#0b141c'; c.fill(path('M5 -38.5 Q8 -40.5 11 -38.5 Q8 -36.8 5 -38.5 Z'));
  c.beginPath(); c.arc(8, -38.4, .9, 0, TAU); c.fillStyle = '#d8c890'; c.fill();
  capStar(c, 12, -18, 2);
}

function wyvern(c: CanvasRenderingContext2D) {
  const paths = capPaths().wyvern, metal = capMetal(c);
  plinth(c, paths, metal);
  // Serpent tail curling off the pedestal foot.
  stroke(c, 'M9 -1 C3 -1 -1 -4 0 -9 C1 -12 4 -12 5 -10', '#4a6573', 1.4);
  c.fillStyle = capMetalLight(c);
  c.fill(paths.wingA); c.fill(paths.horn); c.fill(paths.frill);
  c.strokeStyle = '#050c12'; c.lineWidth = 1.4;
  c.stroke(paths.wingA); c.stroke(paths.horn); c.stroke(paths.frill);
  c.fillStyle = metal; c.fill(paths.body); c.stroke(paths.body);
  // Membrane struts, horn ridge and rim light.
  stroke(c, 'M15 -13 C23 -17 31 -27 37 -37', '#4a6573', .8);
  stroke(c, 'M15 -13 C21 -18 27 -24 31 -29', '#4a6573', .8);
  stroke(c, 'M15 -13 C19 -15 23 -17 26 -19', '#4a6573', .8);
  stroke(c, 'M15 -13 C24 -14 33 -23 38 -37', '#a8bfc5', .7);
  stroke(c, 'M14 -36 C18 -41 23 -44 28 -45', '#8ca8b2', .6);
  stroke(c, 'M16 -31 C20 -34 24 -34.5 27 -33', '#8ca8b2', .55);
  stroke(c, 'M10 -31 C6 -31.5 2 -32 0 -32', '#050c12', .9);
  stroke(c, 'M10 -19 C13 -17.8 15 -17.8 16 -18.5', '#6d828a', .65);
  stroke(c, 'M9 -13 C12 -12 14 -12 16 -12.8', '#6d828a', .65);
  // Slit amber eye and a nostril; a star marks the wing knuckle.
  c.fillStyle = '#0b141c'; c.fill(path('M5 -34 Q8 -35.8 11 -34.3 Q8 -32.7 5 -34 Z'));
  stroke(c, 'M8 -35.3 L8 -33.3', '#d8c890', .9);
  c.beginPath(); c.arc(2, -33, .5, 0, TAU); c.fillStyle = '#050c12'; c.fill();
  capStar(c, 24, -24, 2);
}

/** Both end caps flanking the main bar: gryphon on the left, wyvern on the
 * right. Draw before the strip so the ornaments sit behind the end slots. */
export function drawActionBarCaps(c: CanvasRenderingContext2D, strip: BarStrip) {
  const width = BAR_SLOTS * strip.slot + (BAR_SLOTS - 1) * strip.gap;
  const scale = strip.slot / 34, y = strip.y + strip.slot;
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.save(); c.translate(strip.x - 2, y); c.scale(-scale, scale); gryphon(c); c.restore();
  c.save(); c.translate(strip.x + width + 2, y); c.scale(scale, scale); wyvern(c); c.restore();
  c.restore();
}
