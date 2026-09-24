import { polygon, line, type Point } from './art-primitives.ts';
import { randomSource } from './random-source.ts';

/** Broad fractures, strata and lichen describe stone; all marks are clipped to the authored face. */
export function weatherStone(c: CanvasRenderingContext2D, outline: readonly Point[], seed: number,
  light = '#a9b3a0', dark = '#273b3e', moss = '#71825a') {
  const random = randomSource(seed);
  const left = Math.min(...outline.map(p => p[0])), right = Math.max(...outline.map(p => p[0]));
  const top = Math.min(...outline.map(p => p[1])), bottom = Math.max(...outline.map(p => p[1]));
  const w = right - left, h = bottom - top;
  c.save();
  c.beginPath(); c.moveTo(...outline[0]); for (const point of outline.slice(1)) c.lineTo(...point); c.closePath(); c.clip();
  for (let seam = 0; seam < 4; seam++) {
    const x = left + w * (.15 + random() * .2), y = top + h * (.18 + seam * .17);
    line(c, [[left, y + 1], [x, y - 1], [x + w * .2, y + 2], [right, y]], dark + '88', .8);
    line(c, [[left + 1, y + 2], [x, y], [x + w * .2, y + 3]], light + '65', .55);
  }
  const x = left + w * (.3 + random() * .4);
  line(c, [[x, top], [x - w * .08, top + h * .24], [x + w * .05, top + h * .45], [x - w * .03, top + h * .62]], dark, .9);
  for (let patch = 0; patch < 13; patch++) {
    const px = left + 4 + random() * Math.max(0, w - 8), py = top + h * .63 + random() * Math.max(0, h * .37 - 3);
    const size = 1.2 + random() * 2;
    polygon(c, [[px - size, py], [px - .4, py - size], [px + size, py - .4], [px + size * .7, py + 1]], patch % 4 ? moss + '88' : light + '70');
  }
  // Lichen speckle climbs the shaded face; a thin lit rim keeps the top edge readable.
  for (let dot = 0; dot < 9; dot++) {
    const px = left + random() * w, py = top + h * (.25 + random() * .5);
    c.fillStyle = dot % 3 ? moss + '55' : light + '40';
    c.beginPath(); c.arc(px, py, .7 + random() * 1.1, 0, Math.PI * 2); c.fill();
  }
  line(c, [[left + w * .12, top + 1], [left + w * .45, top - 1], [right - w * .15, top + 1]], light + '70', .8);
  c.restore();
}
