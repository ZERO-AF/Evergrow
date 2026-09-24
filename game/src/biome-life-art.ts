import { hash, polygon } from './art-primitives.ts';
import { BiomeLife, type BiomeBird, type BiomeCritter, type BiomeFish } from './biome-life.ts';
import { biomeWind } from './biome-wind.ts';
import { BIOME_LIFE } from './biome-life-content.ts';
import { propDefinition } from './biome-props.ts';
import { drawGlow } from './lighting.ts';
import type { SkyState } from './world-time.ts';
import type { Prop } from './world.ts';

export class BiomeLifeArt {
  private lightStamps = new Map<string, HTMLCanvasElement>();
  drawGround(c: CanvasRenderingContext2D, life: BiomeLife, props: readonly Prop[], time: number,
    reducedMotion: boolean, view: { left: number; top: number; width: number; height: number }) {
    c.save(); let count = 0;
    // Fish swim under the water pass: the surface shader refracts these
    // silhouettes and rings, so they read as life inside the water.
    for (const fish of life.fish) this.drawFish(c, fish, time, reducedMotion);
    for (const prop of props) {
      if (!prop.biome) continue;
      const profile = BIOME_LIFE[prop.biome];
      if (!profile.ground.includes(prop.kind)
        || prop.x < view.left - 60 || prop.x > view.left + view.width + 60
        || prop.y < view.top - 60 || prop.y > view.top + view.height + 60 || count++ >= 100) continue;
      const wind = biomeWind(prop.x, prop.y, time, prop.biome, reducedMotion);
      for (let i = 0; i < (profile.grassHeight ? 5 : 0); i++) {
        const seed = hash(prop.seed + i * 7919), a = seed / 0x100000000 * Math.PI * 2;
        const x = prop.x + Math.cos(a) * (23 + seed % 29), y = prop.y + Math.sin(a) * (10 + seed % 18);
        const bend = reducedMotion ? 0 : life.bend(x, y);
        c.strokeStyle = profile.grass[i % 3 ? 0 : 1]; c.lineWidth = .9;
        c.globalAlpha = .58;
        for (let blade = 0; blade < 3; blade++) {
          const height = (5 + (seed + blade * 3) % 8) * profile.grassHeight;
          c.beginPath(); c.moveTo(x + blade * 2, y);
          c.quadraticCurveTo(x + blade * 2 + wind.x * 1.5 + bend * 5, y - height * .6,
            x + blade * 2 + wind.x * 3 + bend * 12 + blade - 1, y - height * (1 - Math.abs(bend) * .45)); c.stroke();
        }
      }
      if (!propDefinition(prop.kind).canopy || !profile.dapple) continue;
      for (let i = 0; i < 3; i++) {
        const a = hash(prop.seed + i * 91) / 0x100000000 * Math.PI * 2;
        const x = prop.x + Math.cos(a) * 38 + wind.x * 6, y = prop.y - 16 + Math.sin(a) * 16;
        c.globalAlpha = (.10 + wind.gust * .06) * profile.dapple;
        c.drawImage(this.stamp(profile.light), x - 20, y - 9, 40, 18);
      }
    }
    for (const critter of life.critters) this.drawCritter(c, critter, time, reducedMotion);
    for (const foot of life.footsteps) {
      c.save(); c.translate(foot.x, foot.y);
      if (foot.wet > .18) {
        const age = foot.age / 1.5;
        if (age < 1) {
          c.globalAlpha = Math.sin(age * Math.PI) * .48 * foot.wet;
          c.strokeStyle = '#a1c8c7'; c.lineWidth = .7;
          c.beginPath(); c.ellipse(0, 0, 4 + age * 22, 2 + age * 7, 0, .1, Math.PI * 1.9); c.stroke();
        }
      } else {
        c.rotate(foot.angle + Math.PI / 2);
        c.globalAlpha = Math.max(0, 1 - foot.age / 3.5) * (foot.material === 'snow' ? .55 : .23);
        c.fillStyle = foot.color; c.fillRect(-1.8, -3, 3.6, 6);
        if (foot.material === 'snow') { c.fillStyle = '#d5e3e4'; c.fillRect(-2.8, -3, 1, 5); }
      }
      c.restore();
    }
    c.restore();
  }
  /** Small fauna share the ground pass so grass and props occlude them naturally. */
  private drawCritter(c: CanvasRenderingContext2D, critter: BiomeCritter, time: number, reducedMotion: boolean) {
    const t = reducedMotion ? 0 : time;
    const moving = critter.state === 'dart' || critter.state === 'flee';
    const facing = moving ? (critter.dx < 0 ? -1 : 1) : (Math.sin(t * .5 + critter.phase) > 0 ? 1 : -1);
    // Hoppers bounce while moving; runners stay low.
    const hop = critter.kind === 'rabbit' || critter.kind === 'frog'
      ? (moving ? Math.abs(Math.sin(t * 11 + critter.phase)) * 3.2 : 0)
      : critter.kind === 'squirrel' && moving ? Math.abs(Math.sin(t * 14 + critter.phase)) * 1.6 : 0;
    c.save();
    c.globalAlpha = Math.min(1, critter.age * 1.5);
    c.fillStyle = '#06130b'; c.globalAlpha *= .24;
    c.beginPath(); c.ellipse(critter.x, critter.y + 1, 4.5, 1.6, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = Math.min(1, critter.age * 1.5);
    c.translate(critter.x, critter.y - hop); c.scale(facing, 1);
    const color = critter.color;
    if (critter.kind === 'rabbit') {
      const alert = !moving && Math.sin(t * .31 + critter.phase * 2) > .55;
      c.fillStyle = color;
      c.beginPath(); c.ellipse(0, -2.4, 4.2, 2.6, -.12, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(3.4, -3.6, 1.9, 1.7, 0, 0, Math.PI * 2); c.fill();
      // Ears lie flat while running, prick up when alert.
      const ear = alert ? -5.6 : -3.4, tilt = alert ? .16 : .8;
      c.save(); c.translate(3.2, -4.4); c.rotate(tilt);
      c.fillRect(-.8, ear, 1.4, -ear); c.fillRect(.7, ear * .92, 1.3, -ear * .92); c.restore();
      c.fillStyle = '#e8e2d2'; c.beginPath(); c.ellipse(-4.2, -2.6, 1.1, 1.1, 0, 0, Math.PI * 2); c.fill();
    } else if (critter.kind === 'squirrel') {
      c.fillStyle = color;
      c.beginPath(); c.ellipse(0, -2.2, 3.6, 2.1, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(3, -3.4, 1.5, 1.4, 0, 0, Math.PI * 2); c.fill();
      // The tail curls over the back and flags while darting.
      const curl = moving ? 1.35 : 1 + Math.sin(t * .9 + critter.phase) * .12;
      c.strokeStyle = color; c.lineWidth = 2.1; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-3, -2); c.quadraticCurveTo(-6.5 * curl, -3.5, -4.5 * curl, -8 * curl); c.stroke();
      c.fillStyle = '#3d2c1d'; c.fillRect(3.6, -3.9, .8, .8);
    } else if (critter.kind === 'frog') {
      c.fillStyle = color;
      c.beginPath(); c.ellipse(0, -1.8, 3.4, 2, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(2.6, -3.1, 1.5, 1.3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d8d9b0'; c.fillRect(2.4, -4.2, 1, 1);
      c.strokeStyle = color; c.lineWidth = 1; c.beginPath(); c.moveTo(-2.6, -1); c.lineTo(-4.6, .4); c.stroke();
    } else if (critter.kind === 'lizard') {
      c.fillStyle = color;
      c.beginPath(); c.ellipse(0, -1.4, 4.6, 1.5, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(4.6, -1.7, 1.6, 1.1, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = color; c.lineWidth = 1.1; c.lineCap = 'round';
      const wag = moving ? Math.sin(t * 16 + critter.phase) * 1.6 : Math.sin(t * 1.2 + critter.phase) * .5;
      c.beginPath(); c.moveTo(-4.2, -1.2); c.quadraticCurveTo(-7, -1 + wag, -9.5, -.4 + wag); c.stroke();
      c.lineWidth = .8;
      for (const leg of [-2.4, .6]) { c.beginPath(); c.moveTo(leg, -1); c.lineTo(leg - .8, .6); c.stroke(); }
    } else {
      // beetle: a dark dome with a shell split and short legs
      c.fillStyle = color;
      c.beginPath(); c.ellipse(0, -1.4, 2.6, 1.7, 0, Math.PI, Math.PI * 2); c.fill();
      c.fillRect(-2.6, -1.5, 5.2, 1.2);
      c.strokeStyle = '#191512'; c.lineWidth = .5;
      c.beginPath(); c.moveTo(0, -3); c.lineTo(0, -.6); c.stroke();
      c.strokeStyle = color; c.lineWidth = .6;
      for (const leg of [-1.8, 0, 1.8]) { c.beginPath(); c.moveTo(leg, -.8); c.lineTo(leg + .7, .5); c.stroke(); }
    }
    c.restore();
  }
  /** Subsurface silhouettes plus occasional rings where a fish turns or breaks the surface. */
  private drawFish(c: CanvasRenderingContext2D, fish: BiomeFish, time: number, reducedMotion: boolean) {
    const t = reducedMotion ? 0 : time;
    const dx = fish.tx - fish.x;
    const facing = Math.abs(dx) > .5 ? Math.sign(dx) : (Math.sin(fish.phase) > 0 ? 1 : -1);
    c.save();
    c.globalAlpha = Math.min(1, fish.age) * .5;
    c.translate(fish.x, fish.y); c.scale(facing, 1);
    const wiggle = Math.sin(t * 6 + fish.phase) * .9;
    c.fillStyle = '#0d2a30';
    c.beginPath(); c.ellipse(0, 0, 5.2, 1.7, wiggle * .06, 0, Math.PI * 2); c.fill();
    polygon(c, [[-4.6, 0], [-7.4, -1.6 + wiggle * .5], [-7.4, 1.6 + wiggle * .5]], '#0d2a30');
    c.fillStyle = '#274b4e'; c.fillRect(-1, -1.9, 2.4, .7);
    c.restore();
    if (fish.ring > 0) {
      const age = 1 - fish.ring;
      c.save(); c.globalAlpha = fish.ring * .3;
      c.strokeStyle = '#a9cfc4'; c.lineWidth = .8;
      c.beginPath(); c.ellipse(fish.x, fish.y, 4 + age * 16, 1.6 + age * 5.5, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = fish.ring * .16;
      c.beginPath(); c.ellipse(fish.x, fish.y, 2 + age * 9, .9 + age * 3, 0, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
  }
  drawBird(c: CanvasRenderingContext2D, bird: BiomeBird, time: number, reducedMotion: boolean) {
    const flying = bird.state !== 'perched', t = reducedMotion ? 0 : time;
    const colors = BIRD_COLORS[bird.kind];
    c.save(); c.globalAlpha *= Math.min(1, bird.age * 1.5);
    c.fillStyle = '#06130b'; c.globalAlpha *= .28;
    c.beginPath(); c.ellipse(bird.x, bird.y, Math.max(2, 6 - bird.z * .035), 2, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = Math.min(1, bird.age * 1.5); c.translate(bird.x, bird.y - bird.z);
    const facing = flying ? (bird.dx < 0 ? -1 : 1) : (Math.sin(t * .7 + bird.phase) > -.25 ? 1 : -1);
    const size = bird.kind === 'snowfinch' ? .72 : bird.kind === 'wader' ? 1.1 : bird.kind === 'moorbird' ? .88 : bird.kind === 'hawk' ? 1.45 : 1;
    c.scale(facing * size, size);
    if (bird.kind === 'wader') c.translate(0, -7);
    polygon(c, [[-6, 1], [-3, -3], [2, -4], [5, -2], [4, 2], [-2, 3]], colors[0]);
    polygon(c, [[-3, 0], [-9, 3], [-5, 4], [0, 2]], colors[1]);
    if (bird.kind !== 'wader') {
      polygon(c, [[1, -4], [2, -7], [5, -7], [7, -4], [4, -2]], colors[0]);
      polygon(c, [[5, -5], [bird.kind === 'snowfinch' ? 7.5 : 10, -3], [6, -2]], colors[3]);
    }
    if (bird.kind === 'jay') polygon(c, [[1, -5], [2, -11], [5, -7]], colors[2]);
    if (bird.kind === 'hawk') polygon(c, [[-6, 1], [-11, 4], [-8, 5], [-3, 3]], colors[2]);
    if (bird.kind === 'wader') {
      polygon(c, [[4, -3], [3, -12], [6, -15], [9, -13], [6, -10], [7, -3]], colors[0]);
      polygon(c, [[8, -13], [18, -11], [8, -10]], colors[3]);
    }
    c.fillStyle = '#bfcbba'; c.fillRect(bird.kind === 'wader' ? 7 : 4.5, bird.kind === 'wader' ? -13 : -5.6, .9, .9);
    if (flying) {
      // Soaring raptors hold wings flat and only adjust; flappers beat fast.
      const soaring = bird.state === 'soaring';
      const flap = soaring ? Math.sin(t * 2.2 + bird.phase) * .18 : Math.sin(t * 23 + bird.phase);
      const tip = soaring ? -7 - flap * 4 : -5 - flap * 10;
      polygon(c, [[-3, -1], [-11, tip], [-16, tip + 2], [-7, 2], [2, 1]], colors[2]);
      polygon(c, [[0, 0], [5, tip * .8], [10, tip * .8 + 1], [4, 2]], colors[1]);
    } else {
      c.strokeStyle = '#938976'; c.lineWidth = .7;
      c.beginPath(); c.moveTo(-1, 2); c.lineTo(-2, 5); c.lineTo(-4, 5); c.moveTo(2, 2); c.lineTo(3, 5); c.lineTo(5, 5); c.stroke();
      if (bird.kind === 'wader') { c.beginPath(); c.moveTo(-1, 3); c.lineTo(-2, 12); c.moveTo(3, 3); c.lineTo(5, 12); c.stroke(); }
      polygon(c, [[-4, -1], [2, -2], [1, 1], [-3, 2]], colors[2]);
    }
    c.restore();
  }
  drawAir(c: CanvasRenderingContext2D, life: BiomeLife, time: number, reducedMotion: boolean, sky?: SkyState) {
    const t = reducedMotion ? 0 : time;
    const daylight = sky ? sky.daylight : life.daylight;
    c.save();
    for (const particle of life.particles) {
      c.save(); c.globalAlpha = Math.min(1, particle.age * 4, (particle.life - particle.age) * 1.4) * .8;
      c.translate(particle.x + Math.sin(t * 2 + particle.phase) * (particle.z > 0 ? 4 : 0), particle.y - particle.z);
      c.rotate(Math.sin(t * 2.7 + particle.phase) * 1.5);
      const width = .5 + Math.abs(Math.cos(t * 5 + particle.phase)) * 2.7;
      c.fillStyle = particle.color; c.strokeStyle = particle.color; c.lineWidth = .7;
      switch (particle.kind) {
        case 'leaf': polygon(c, [[-width, 0], [-.8, -1.4], [width, -.4], [.5, 1.5]], particle.color); break;
        case 'snow': c.fillRect(-1.2, -.8, 2.4, 1.6); c.fillRect(-.5, -1.6, 1, 3.2); break;
        case 'droplet': c.beginPath(); c.moveTo(0, -2.5); c.lineTo(.4, 1); c.stroke(); break;
        case 'seed':
          c.beginPath(); c.moveTo(0, 3); c.lineTo(0, -1); c.lineTo(-2, -3); c.moveTo(0, -1); c.lineTo(2, -3);
          c.moveTo(0, -1); c.lineTo(0, -4); c.stroke(); break;
        case 'ember':
          c.globalAlpha *= .7 + Math.sin(t * 8 + particle.phase) * .3;
          c.fillRect(-1, -1, 2, 2); c.globalAlpha *= .15 + (1 - daylight) * .2;
          c.beginPath(); c.arc(0, 0, 3.5, 0, Math.PI * 2); c.fill(); break;
        case 'ash': c.fillRect(-1.7, -.5, 3.4, 1); break;
        case 'dust': c.beginPath(); c.ellipse(0, 0, 1.7, 1.1, 0, 0, Math.PI * 2); c.fill(); break;
        default: { const exhaustive: never = particle.kind; throw new Error(String(exhaustive)); }
      }
      c.restore();
    }
    for (const b of life.insects) {
      const rest = Math.sin(t * .38 + b.phase) > (b.kind === 'dragonfly' ? .92 : b.kind === 'bee' ? .8 : .65) && b.alarm < .1;
      const lift = rest ? 0 : 5 + Math.sin(t * 3 + b.phase) * 3 + b.alarm * 14;
      c.save(); c.globalAlpha = Math.min(1, b.age) * .85; c.translate(b.x, b.y - lift);
      const wing = rest ? 1.4 : .5 + Math.abs(Math.sin(t * 17 + b.phase)) * 3.6;
      c.fillStyle = b.color;
      if (b.kind === 'dragonfly') {
        const span = rest ? 5 : 3 + Math.abs(Math.sin(t * 34 + b.phase)) * 5;
        c.globalAlpha *= .65;
        for (const side of [-1, 1]) for (const row of [-1, 1]) {
          c.beginPath(); c.ellipse(side * span * .45, row * 1.7, span * .6, 1, side * row * .2, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = Math.min(1, b.age); c.fillRect(-.55, -3.5, 1.1, 7); c.restore(); continue;
      }
      if (b.kind === 'firefly') {
        // Lantern pulse peaks at dusk/night; the body stays a dark speck by day.
        const pulse = .35 + .65 * Math.max(0, Math.sin(t * 2.2 + b.phase * 2));
        const glow = (.12 + .88 * (1 - daylight)) * pulse;
        c.globalAlpha = Math.min(1, b.age) * .5;
        c.fillStyle = '#3a3a28'; c.fillRect(-.6, -1.4, 1.2, 2.8);
        if (glow > .03) {
          drawGlow(c, 0, .8, 6 + glow * 7, b.color, glow * .8);
          c.globalAlpha = Math.min(1, b.age) * Math.min(1, glow + .25);
          c.fillStyle = b.color; c.fillRect(-.55, .4, 1.1, 1.2);
        }
        c.restore(); continue;
      }
      if (b.kind === 'bee') {
        // Bees fly a tight, fast loop; wings are a blurred figure-eight.
        const buzz = Math.abs(Math.sin(t * 42 + b.phase));
        c.globalAlpha *= .5;
        c.beginPath(); c.ellipse(-.8, -1.6, 1.6, .8 + buzz * .8, -.5, 0, Math.PI * 2);
        c.ellipse(.8, -1.6, 1.6, .8 + buzz * .8, .5, 0, Math.PI * 2); c.fill();
        c.globalAlpha = Math.min(1, b.age) * .9;
        c.fillStyle = '#3d3324'; c.beginPath(); c.ellipse(0, 0, 1.5, 1.1, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = b.color; c.fillRect(-1, -.9, .7, 1.8); c.fillRect(.3, -.9, .7, 1.8);
        c.restore(); continue;
      }
      if (b.kind === 'moth') {
        polygon(c, [[-wing * 1.4, 2], [-wing, -2], [0, -.5], [wing, -2], [wing * 1.4, 2], [0, 1]], b.color);
        c.fillStyle = '#5e5b52'; c.fillRect(-.45, -1, .9, 3); c.restore(); continue;
      }
      c.beginPath(); c.ellipse(-wing * .6, 0, wing, 2.6, -.45, 0, Math.PI * 2);
      c.ellipse(wing * .6, 0, wing, 2.6, .45, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#544e3b'; c.fillRect(-.5, -2, 1, 4); c.restore();
    }
    c.restore();
  }
  drawLight(c: CanvasRenderingContext2D, props: readonly Prop[], time: number, reducedMotion: boolean,
    playerX: number, playerY: number) {
    c.save(); let count = 0;
    for (const prop of props) {
      if (!prop.biome) continue;
      const profile = BIOME_LIFE[prop.biome];
      if (!propDefinition(prop.kind).canopy || profile.dapple < .25 || hash(prop.seed) % 3 !== 0 || count++ >= 5) continue;
      const wind = biomeWind(prop.x, prop.y, time, prop.biome, reducedMotion), x = prop.x + 30 + wind.x * 7, y = prop.y - 80;
      const clearance = Math.min(1, Math.hypot(x + 25 - playerX, y + 60 - playerY) / 100);
      const gradient = c.createLinearGradient(x, y - 90, x + 70, y + 100);
      gradient.addColorStop(0, profile.light + '00'); gradient.addColorStop(.3, profile.light + '1c'); gradient.addColorStop(1, profile.light + '00');
      c.globalAlpha = (.28 + wind.gust * .24) * clearance * profile.dapple; c.fillStyle = gradient;
      c.beginPath(); c.moveTo(x - 15, y - 90); c.lineTo(x + 8, y - 90); c.lineTo(x + 90, y + 110); c.lineTo(x + 28, y + 110); c.fill();
    }
    c.restore();
  }
  private stamp(color: string) {
    const cached = this.lightStamps.get(color); if (cached) return cached;
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 32;
    const c = canvas.getContext('2d')!;
    c.scale(1, .5); const g = c.createRadialGradient(32, 32, 1, 32, 32, 30);
    g.addColorStop(0, color); g.addColorStop(.45, color + '80'); g.addColorStop(1, color + '00');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); this.lightStamps.set(color, canvas); return canvas;
  }
}

const BIRD_COLORS = {
  crow: ['#182329', '#101b22', '#33434a', '#879296'],
  jay: ['#617a87', '#293d4c', '#8bb4c6', '#a8a499'],
  snowfinch: ['#d3d9d5', '#728798', '#f0eee0', '#8a8177'],
  wader: ['#849da2', '#3c5764', '#c3d2ca', '#bdad80'],
  moorbird: ['#8d8072', '#504953', '#b6a799', '#b7a181'],
  hawk: ['#5c4a38', '#3d3229', '#8a7355', '#d8c9a8'],
} as const;
