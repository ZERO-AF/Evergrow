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
    const t = reducedMotion ? 0 : time;
    const wind = biomeWind(view.left + view.width / 2, view.top + view.height / 2, t, weights, reducedMotion);
    const vx = mix.drift + wind.x * 26, vy = mix.fall + wind.y * 18;
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
        let x = (pool[o] * width + vx * scale * t) % width;
        let y = (pool[o + 1] * height + vy * scale * t) % height;
        if (x < 0) x += width; if (y < 0) y += height;
        x += view.left - MARGIN; y += view.top - MARGIN;
        // Sway rides perpendicular to the dominant travel axis.
        const sway = Math.sin(t * (0.9 + scale) + pool[o + 3]) * mix.sway;
        if (Math.abs(vy) >= Math.abs(vx)) x += sway; else y += sway;
        if (streaked) { c.moveTo(x, y); c.lineTo(x + tailX * scale, y + tailY * scale); continue; }
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
        } else {
          c.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      if (streaked) c.stroke();
    }
    c.restore();
  }
}
