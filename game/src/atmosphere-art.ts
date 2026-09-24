import type { SkyState } from './world-time.ts';
import type { Prop } from './world.ts';
import { hash, randomFromSeed } from './art-primitives.ts';
import type { World } from './world.ts';
import type { CameraView } from './camera.ts';
import { sceneClimate } from './scene-light-style.ts';
import { BIOME_LIFE } from './biome-life-content.ts';

/** Anchored water and air, with fixed draw budgets and no simulation or particle state. */
export class AtmosphereArt {
  private mist = new Map<string, HTMLCanvasElement>();
  private shafts = new Map<string, HTMLCanvasElement>();
  reset() { this.mist.clear(); this.shafts.clear(); }
  private mistStamp(color: string) {
    const cached = this.mist.get(color); if (cached) return cached;
    const image = document.createElement('canvas'); image.width = 256; image.height = 96;
    const c = image.getContext('2d')!, random = randomFromSeed(17319);
    for (let i = 0; i < 10; i++) {
      const x = 48 + random() * 160, y = 32 + random() * 32, radius = 20 + random() * 24;
      const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color + '75'); gradient.addColorStop(.45, color + '35'); gradient.addColorStop(1, color + '00');
      c.fillStyle = gradient; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      // A denser kernel inside each puff keeps banks from reading as flat haze.
      const core = c.createRadialGradient(x, y, 0, x, y, radius * .45);
      core.addColorStop(0, color + '50'); core.addColorStop(1, color + '00');
      c.fillStyle = core; c.fillRect(x - radius * .45, y - radius * .45, radius * .9, radius * .9);
    }
    if (this.mist.size >= 32) this.mist.delete(this.mist.keys().next().value!);
    this.mist.set(color, image); return image;
  }
  /** A soft slanted beam stamp; tinted per biome light color. */
  private shaftStamp(color: string) {
    const cached = this.shafts.get(color); if (cached) return cached;
    const image = document.createElement('canvas'); image.width = 96; image.height = 192;
    const c = image.getContext('2d')!;
    const beam = c.createLinearGradient(0, 0, 40, 192);
    beam.addColorStop(0, color + '00'); beam.addColorStop(.22, color + '2e');
    beam.addColorStop(.62, color + '16'); beam.addColorStop(1, color + '00');
    c.fillStyle = beam;
    c.beginPath(); c.moveTo(30, 0); c.lineTo(62, 0); c.lineTo(88, 192); c.lineTo(38, 192); c.closePath(); c.fill();
    // Feather the beam edges so it reads as scattered light, not a polygon.
    c.globalCompositeOperation = 'destination-in';
    const feather = c.createLinearGradient(0, 0, 96, 0);
    feather.addColorStop(0, '#ffffff00'); feather.addColorStop(.3, '#ffffff'); feather.addColorStop(.72, '#ffffff'); feather.addColorStop(1, '#ffffff00');
    c.fillStyle = feather; c.fillRect(0, 0, 96, 192);
    if (this.shafts.size >= 24) this.shafts.delete(this.shafts.keys().next().value!);
    this.shafts.set(color, image); return image;
  }
  drawWater(c: CanvasRenderingContext2D, props: readonly Prop[], time: number, reducedMotion: boolean) {
    const t = reducedMotion ? 0 : time;
    c.save(); let count = 0;
    for (const prop of props) {
      if (prop.kind !== 'lilies' || count++ >= 32) continue;
      const phase = hash(prop.seed) / 0x100000000;
      for (let ring = 0; ring < 2; ring++) {
        const life = (t * .18 + phase + ring * .5) % 1;
        c.globalAlpha = Math.sin(life * Math.PI) * .18;
        c.strokeStyle = '#95c1b6'; c.lineWidth = .7;
        c.beginPath(); c.ellipse(prop.x + 3, prop.y - 5, (14 + life * 28) * prop.scale,
          (4 + life * 9) * prop.scale, -.08, Math.PI * .15, Math.PI * 1.65); c.stroke();
      }
      // Occasional bubbles and a faint shore mist keep still water alive.
      if (hash(prop.seed + 7) % 3 === 0) {
        const bubble = (t * .5 + phase * 3) % 1;
        if (bubble < .3) {
          c.globalAlpha = Math.sin(bubble / .3 * Math.PI) * .3;
          c.strokeStyle = '#b9d8cd'; c.lineWidth = .5;
          const bx = prop.x + Math.sin(phase * 40) * 12, by = prop.y - 4 + Math.cos(phase * 31) * 5;
          c.beginPath(); c.arc(bx, by - bubble * 9, .8 + bubble * .9, 0, Math.PI * 2); c.stroke();
        }
      }
    }
    // Low mist crawling off the water around reed/lily clusters.
    let mist = 0;
    for (const prop of props) {
      if ((prop.kind !== 'reeds' && prop.kind !== 'lilies') || mist++ >= 10) continue;
      const phase = hash(prop.seed + 13) / 0x100000000;
      const drift = Math.sin(t * .12 + phase * 6) * 16;
      c.globalAlpha = .05 + .04 * Math.sin(t * .3 + phase * 9);
      c.drawImage(this.mistStamp('#9fc4bb'), prop.x - 60 + drift, prop.y - 26, 120, 34);
    }
    c.restore();
  }
  /** Separate ground and foreground banks: anchored in world space, never a screen veil. */
  drawLayer(c: CanvasRenderingContext2D, world: World, view: CameraView, time: number, reducedMotion: boolean,
    playerX: number, playerY: number, foreground: boolean, enclosed: boolean, indoorBlend: number, sky?: SkyState) {
    if (!enclosed && indoorBlend > .98) return;
    const t = reducedMotion ? 0 : time, cell = enclosed ? 180 : 360, margin = enclosed ? 120 : 420;
    const daylight = sky?.daylight ?? 1, warmth = sky?.warmth ?? 0;
    c.save(); c.globalCompositeOperation = 'screen'; let count = 0;
    for (let cy = Math.floor((view.top - margin) / cell); cy <= Math.floor((view.top + view.height + margin) / cell); cy++) {
      for (let cx = Math.floor((view.left - margin) / cell); cx <= Math.floor((view.left + view.width + margin) / cell); cx++) {
        if (count++ >= 96) break;
        const seed = hash(Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ (foreground ? 4717 : 9811));
        const phase = seed / 0x100000000 * Math.PI * 2;
        const anchorX = (cx + .5) * cell, anchorY = (cy + .5) * cell;
        const weights=world.sampleBiome(anchorX,anchorY).weights;
        const style = sceneClimate(weights, enclosed ? 1 : 0);
        const x = anchorX + Math.sin(t * (foreground ? .035 : .06) + phase) * (enclosed ? 14 : 75),
          y = anchorY + Math.cos(t * .045 + phase) * 24;
        if (world.getBuildingAt(x, y)) continue;
        // Keep enclosed mist inside floor space, away from walls and doorways.
        if (enclosed && (foreground || world.blocked(x, y, 65))) continue;
        const distance = Math.hypot(x - playerX, y - playerY);
        const clearance = foreground ? .18 + .82 * Math.min(1, distance / 260) : 1;
        c.globalAlpha = style.fog * (enclosed ? 1 : 1-weights.swamp*.4) * (foreground ? .52 : .85) * clearance * (enclosed ? 1 : (1 - indoorBlend) * (.42 + .58 * daylight));
        // Quantize only the cookie tint; biome opacity remains continuously blended.
        const color = style.color.replace(/[0-9a-f]{2}/gi, pair => Math.min(255, Math.round(parseInt(pair, 16) / 16) * 16).toString(16).padStart(2, '0'));
        const width = enclosed ? 150 : foreground ? 690 : 510, height = enclosed ? 65 : foreground ? 170 : 110;
        c.drawImage(this.mistStamp(color), x - width / 2, y - height / 2, width, height);
        // Near-camera motes: sparse drifting dust that catches the light.
        if (foreground && !enclosed && seed % 4 === 0) {
          const random = randomFromSeed(seed);
          for (let mote = 0; mote < 3; mote++) {
            const mx = anchorX + (random() - .5) * cell + Math.sin(t * (.3 + mote * .13) + phase + mote * 2) * 26;
            const my = anchorY + (random() - .5) * cell * .5 + Math.cos(t * (.24 + mote * .09) + phase + mote) * 18;
            const twinkle = .3 + .7 * Math.max(0, Math.sin(t * (1.1 + mote * .4) + phase * (mote + 2)));
            c.globalAlpha = .16 * twinkle * clearance * (1 - indoorBlend) * (.35 + .65 * daylight);
            c.fillStyle = color;
            c.fillRect(mx, my, 1.1, 1.1);
          }
        }
        // Light shafts lean with the sun through canopy biomes; they fade at
        // night and strengthen at golden hour when warmth tints them amber.
        if (!enclosed && !foreground && daylight > .25 && seed % 9 === 0) {
          const canopy = weights.verdant + weights.autumn * .8 + weights.swamp * .6 + weights.frostpine * .4;
          if (canopy > .45) {
            const biome = (Object.keys(weights) as Array<keyof typeof weights>).reduce((a, b) => weights[a] > weights[b] ? a : b);
            const light = BIOME_LIFE[biome].light;
            const sway = Math.sin(t * .11 + phase) * 12;
            const alpha = Math.min(.4, canopy) * daylight * (.4 + warmth * .7) * (1 - indoorBlend) * .09;
            c.globalAlpha = alpha;
            c.drawImage(this.shaftStamp(light), x - 48 + sway, y - 150, 96, 192);
          }
        }
      }
    }
    c.restore();
  }
}
