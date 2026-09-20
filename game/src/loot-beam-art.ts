import { drawGlow } from './lighting.ts';
import type { LootBeamAnchor } from './loot-beam.ts';

/**
 * Rarity pillars drawn in the emission pass (after lighting), so they read
 * through terrain and roofs exactly like Diablo ground-loot beacons.
 * World-space; the caller holds the world transform.
 */
export function drawLootBeams(c: CanvasRenderingContext2D, anchors: readonly LootBeamAnchor[],
  time: number, reducedMotion = false): void {
  c.save();
  for (const anchor of anchors) {
    const { spec, x, y, fade } = anchor;
    if (fade <= 0) continue;
    const t = reducedMotion ? 0 : time;
    // Slow breathing keeps the pillar alive without reading as a hazard telegraph.
    const breathe = reducedMotion ? .9 : .82 + Math.sin(t * 2.1 + anchor.drop.id * 1.7) * .18;
    const alpha = spec.alpha * fade * breathe;
    const height = spec.height * (reducedMotion ? .8 : 1);
    const width = spec.width;

    // Ground pool: a soft rarity halo the item silhouette sits inside.
    drawGlow(c, x, y, spec.glow, spec.color, alpha * .9);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = alpha * .5;
    c.fillStyle = spec.color;
    c.beginPath(); c.ellipse(x, y + 1, spec.glow * .55, spec.glow * .2, 0, 0, Math.PI * 2); c.fill();

    // Pillar: base-hot gradient column plus a narrow near-white core.
    const pillar = c.createLinearGradient(0, y, 0, y - height);
    pillar.addColorStop(0, spec.color);
    pillar.addColorStop(.55, spec.color + 'aa');
    pillar.addColorStop(1, spec.color + '00');
    c.globalAlpha = alpha;
    c.fillStyle = pillar;
    c.beginPath();
    c.moveTo(x - width, y);
    c.lineTo(x - width * .28, y - height);
    c.lineTo(x + width * .28, y - height);
    c.lineTo(x + width, y);
    c.closePath(); c.fill();

    const core = c.createLinearGradient(0, y, 0, y - height * .8);
    core.addColorStop(0, spec.core);
    core.addColorStop(1, spec.core + '00');
    c.globalAlpha = alpha * .75;
    c.fillStyle = core;
    c.beginPath();
    c.moveTo(x - width * .34, y);
    c.lineTo(x - width * .1, y - height * .8);
    c.lineTo(x + width * .1, y - height * .8);
    c.lineTo(x + width * .34, y);
    c.closePath(); c.fill();

    // Rising motes: deterministic drift per drop so the beam sparkles without state.
    for (let i = 0; i < spec.motes; i++) {
      const seed = anchor.drop.id * 7.13 + i * 3.71;
      const cycle = reducedMotion ? .5 : (t * (.32 + (i % 3) * .11) + seed % 1) % 1;
      const mx = x + Math.sin(seed * 12.9 + t * (reducedMotion ? 0 : 1.4)) * width * .8;
      const my = y - 6 - cycle * (height - 14);
      const mote = Math.sin(cycle * Math.PI) * alpha;
      if (mote <= 0) continue;
      c.globalAlpha = mote;
      c.fillStyle = i % 2 ? spec.core : spec.color;
      const s = 1 + (i % 3) * .5;
      c.fillRect(mx - s / 2, my - s / 2, s, s);
    }
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}
