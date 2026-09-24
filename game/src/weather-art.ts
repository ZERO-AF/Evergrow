import { randomFromSeed } from './art-primitives.ts';
import { biomeWind } from './biome-wind.ts';
import { drawGlow } from './lighting.ts';
import { weatherMix } from './weather-content.ts';
import type { BiomeWeights } from './biomes.ts';
import type { CameraView } from './camera.ts';

/** Fixed precipitation pool: one shared budget for every weather kind. */
export const WEATHER_PARTICLE_LIMIT = 300;
const MARGIN = 90;

/** Bounded precipitation pass. A fixed seeded pool falls and drifts across a
 * padded view box, wrapping at the edges; positions are pure functions of the
 * pool seed and time, so there is no per-frame allocation or simulation state.
 * Presentation only — no gameplay, save or world writes. */
export class WeatherArt {
  /** Per particle: base x fraction, base y fraction, speed factor, phase, palette slot. */
  private readonly pool = new Float32Array(WEATHER_PARTICLE_LIMIT * 5);
  /** Splash rings: x, y, progress — bounded scratch, refilled each draw. */
  private readonly rings = new Float32Array(96 * 3);
  private ringCount = 0;
  constructor() {
    const random = randomFromSeed(41731);
    for (let i = 0; i < WEATHER_PARTICLE_LIMIT; i++) {
      const o = i * 5;
      this.pool[o] = random(); this.pool[o + 1] = random();
      this.pool[o + 2] = .55 + random() * .9; this.pool[o + 3] = random() * Math.PI * 2;
      this.pool[o + 4] = Math.floor(random() * 3);
    }
  }
  reset() { /* Stateless: every position derives from the seeded pool and time. */ }

  draw(c: CanvasRenderingContext2D, weights: BiomeWeights, view: CameraView,
    time: number, reducedMotion: boolean, indoorBlend: number) {
    const mix = weatherMix(weights);
    const cover = mix.intensity * (1 - indoorBlend);
    if (mix.kind === 'none' || cover < .02 || mix.colors.length === 0) return;
    this.ringCount = 0;
    const t = reducedMotion ? 0 : time;
    const wind = biomeWind(view.left + view.width / 2, view.top + view.height / 2, t, weights, reducedMotion);
    // Gusts and the slower surge front push precipitation sideways; light
    // kinds (leaves, seeds, ash, motes) answer the wind most.
    const light = mix.kind === 'leaves' || mix.kind === 'seeds' || mix.kind === 'ash' || mix.kind === 'motes' || mix.kind === 'embers';
    const gustPush = 1 + wind.gust * (light ? 1.6 : .55) + wind.surge * (light ? 2.2 : .8);
    const vx = mix.drift * gustPush + wind.x * 26, vy = mix.fall + wind.y * 18 * (light ? 1.4 : 1);
    const width = view.width + MARGIN * 2, height = view.height + MARGIN * 2;
    const count = Math.min(WEATHER_PARTICLE_LIMIT, Math.round(mix.intensity * WEATHER_PARTICLE_LIMIT));
    const alpha = mix.alpha * (1 - indoorBlend);
    if (alpha <= 0 || count <= 0) return;
    const streaked = mix.kind === 'rain' || mix.kind === 'sand';
    const speed = Math.hypot(vx, vy);
    // Streaks trail along the fall direction; a near-still mix keeps a short tail.
    const tailX = streaked ? -vx / (speed || 1) * mix.streak : 0;
    const tailY = streaked ? -vy / (speed || 1) * mix.streak : 0;
    const pool = this.pool;
    c.save();
    c.lineWidth = mix.size;
    for (let slot = 0; slot < mix.colors.length; slot++) {
      c.globalAlpha = alpha;
      c.strokeStyle = c.fillStyle = mix.colors[slot];
      if (streaked) c.beginPath();
      for (let i = slot; i < count; i += mix.colors.length) {
        const o = i * 5;
        const scale = pool[o + 2];
        const rawY = pool[o + 1] * height + vy * scale * t;
        let x = (pool[o] * width + vx * scale * t) % width;
        let y = rawY % height;
        if (x < 0) x += width; if (y < 0) y += height;
        x += view.left - MARGIN; y += view.top - MARGIN;
        // Sway rides perpendicular to the dominant travel axis.
        const sway = Math.sin(t * (0.9 + scale) + pool[o + 3]) * mix.sway;
        if (Math.abs(vy) >= Math.abs(vx)) x += sway; else y += sway;
        if (streaked) {
          c.moveTo(x, y); c.lineTo(x + tailX * scale, y + tailY * scale);
          // Raindrops burst into a small ring as they wrap off the bottom of
          // the cell — reads as splashdown on the ground plane.
          if (mix.kind === 'rain' && vy > 0 && this.ringCount < 96) {
            const frac = (rawY / height) % 1;
            if (frac > .965) {
              const r = this.ringCount++ * 3;
              this.rings[r] = x; this.rings[r + 1] = y; this.rings[r + 2] = (frac - .965) / .035;
            }
          }
          continue;
        }
        const size = mix.size * scale;
        if (mix.kind === 'motes') {
          const pulse = .45 + .55 * Math.sin(t * 1.4 + pool[o + 3] * 2);
          if (pulse <= 0) continue;
          c.globalAlpha = alpha * pulse;
          drawGlow(c, x, y, size * 5, mix.colors[slot], alpha * pulse * .5);
          c.fillRect(x - size / 2, y - size / 2, size, size);
          c.globalAlpha = alpha;
        } else if (mix.kind === 'ash') {
          c.globalAlpha = alpha * (.6 + .4 * Math.sin(t * 2.1 + pool[o + 3] * 3));
          c.fillRect(x - size / 2, y - size / 2, size, size);
          c.globalAlpha = alpha;
        } else if (mix.kind === 'embers') {
          // Rising cinders: a hot core that breathes, with a faint glow.
          const pulse = .4 + .6 * Math.max(0, Math.sin(t * 3.1 + pool[o + 3] * 3));
          c.globalAlpha = alpha * pulse;
          if (slot < 2) drawGlow(c, x, y, size * 4, mix.colors[slot], alpha * pulse * .45);
          c.fillRect(x - size / 2, y - size / 2, size, size);
          c.globalAlpha = alpha;
        } else if (mix.kind === 'leaves') {
          // Tumbling leaf: a small quad that spins and rocks as it falls.
          const spin = t * (1.6 + scale) + pool[o + 3];
          const w = size * (0.6 + Math.abs(Math.cos(spin)) * .8);
          c.save(); c.translate(x, y); c.rotate(Math.sin(spin * .8) * 1.2);
          c.globalAlpha = alpha * (.7 + .3 * Math.sin(spin * 1.3));
          c.beginPath(); c.moveTo(-w, 0); c.lineTo(-w * .3, -size * .55); c.lineTo(w, -size * .2); c.lineTo(w * .4, size * .55); c.closePath(); c.fill();
          c.restore(); c.globalAlpha = alpha;
        } else if (mix.kind === 'seeds') {
          // Steppe seeds drift as tiny forked tufts.
          c.globalAlpha = alpha * (.55 + .45 * Math.sin(t * 1.8 + pool[o + 3] * 2));
          c.beginPath();
          c.moveTo(x, y + size); c.lineTo(x, y - size * .4);
          c.moveTo(x, y - size * .4); c.lineTo(x - size * .8, y - size * 1.2);
          c.moveTo(x, y - size * .4); c.lineTo(x + size * .8, y - size * 1.2);
          c.stroke();
          c.globalAlpha = alpha;
        } else {
          c.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      if (streaked) c.stroke();
    }
    // Splash rings stroke after the streak paths so each can fade on its own.
    if (this.ringCount) {
      c.strokeStyle = mix.colors[0]; c.lineWidth = .6;
      for (let i = 0; i < this.ringCount; i++) {
        const r = i * 3, splash = this.rings[r + 2];
        c.globalAlpha = alpha * (1 - splash) * .8;
        c.beginPath(); c.ellipse(this.rings[r], this.rings[r + 1], 1 + splash * 5, .5 + splash * 1.6, 0, 0, Math.PI * 2); c.stroke();
      }
    }
    c.restore();
  }
}
