import { hash, randomFromSeed } from './art-primitives.ts';
import { biomeWind } from './biome-wind.ts';
import { BIOME_LIFE, biomeForDebris, type ParticleKind, type BirdKind, type InsectKind, type CritterKind } from './biome-life-content.ts';
import type { GroundContact } from './ground-material.ts';
import type { BiomeId } from './biomes.ts';
import type { Prop } from './world.ts';

export const BIOME_LIFE_LIMITS = Object.freeze({ trails: 40, footsteps: 48, particles: 100, birds: 8, insects: 14, critters: 8, fish: 5 });
export interface BiomeSubject { x: number; y: number; vx: number; vy: number; }
export interface BiomeTrail { x: number; y: number; age: number; angle: number; foot: number; material: ParticleKind; color: string; wet: number; }
export interface BiomeParticle { biome: BiomeId; kind: ParticleKind; x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; phase: number; color: string; }
export interface BiomeBird { biome: BiomeId; kind: BirdKind;
  id: string; x: number; y: number; z: number; homeX: number; homeY: number; homeZ: number;
  age: number; phase: number; state: 'perched' | 'fleeing' | 'returning' | 'soaring'; elapsed: number; dx: number; dy: number;
  /** Raptors ride thermals: they leave the perch on a seeded schedule and circle. */
  soar: boolean;
}
export interface BiomeInsect { biome: BiomeId; kind: InsectKind; color: string; id: string; x: number; y: number; homeX: number; homeY: number; phase: number; age: number; alarm: number; }
export interface BiomeCritter { biome: BiomeId; kind: CritterKind; color: string; id: string;
  x: number; y: number; homeX: number; homeY: number; phase: number; age: number; elapsed: number;
  state: 'idle' | 'dart' | 'flee' | 'return'; dx: number; dy: number; }
export interface BiomeFish { id: string; x: number; y: number; homeX: number; homeY: number; tx: number; ty: number;
  phase: number; age: number; elapsed: number; ring: number; }

/** Bounded presentation state. No gameplay RNG, world writes, collisions, damage or rewards. */
export class BiomeLife {
  readonly trails: BiomeTrail[] = [];
  readonly footsteps: BiomeTrail[] = [];
  readonly particles: BiomeParticle[] = [];
  readonly birds: BiomeBird[] = [];
  readonly insects: BiomeInsect[] = [];
  readonly critters: BiomeCritter[] = [];
  readonly fish: BiomeFish[] = [];
  /** Latest daylight factor (0 night – 1 noon); the renderer may pass sky.daylight. */
  daylight = 1;
  private previous: { x: number; y: number } | undefined;
  private groundAt: ((x: number, y: number) => GroundContact) | undefined;
  private distance = 0;
  private side = 1;
  private syncTime = 0;
  private particleTime = 0;
  private serial = 0;
  reset() {
    this.trails.length = this.footsteps.length = this.particles.length = this.birds.length = this.insects.length = 0;
    this.critters.length = this.fish.length = 0;
    this.previous = undefined; this.groundAt = undefined; this.distance = this.syncTime = this.particleTime = this.serial = 0; this.side = 1;
    this.daylight = 1;
  }
  update(dt: number, time: number, props: readonly Prop[], subject: BiomeSubject, reducedMotion: boolean,
    groundAt: (x: number, y: number) => GroundContact, daylight = 1) {
    const step = Math.max(0, Math.min(.1, dt));
    this.groundAt = groundAt;
    this.daylight = Number.isFinite(daylight) ? Math.max(0, Math.min(1, daylight)) : 1;
    if (reducedMotion) {
      this.syncTime -= step;
      if (!this.previous || this.syncTime <= 0) {
        this.sync(props, subject); this.syncTime = .6;
        for (const bird of this.birds) bird.age = Math.max(1, bird.age);
        for (const insect of this.insects) insect.age = Math.max(1, insect.age);
        for (const critter of this.critters) critter.age = Math.max(1, critter.age);
        for (const fish of this.fish) fish.age = Math.max(1, fish.age);
      }
      this.previous = { x: subject.x, y: subject.y }; this.distance = 0; return;
    }
    if (step === 0) return;
    const moved = this.previous ? Math.hypot(subject.x - this.previous.x, subject.y - this.previous.y) : 0;
    if (moved > 120) { this.trails.length = this.footsteps.length = 0; this.distance = 0; }
    else if (moved > .1 && step > 0) {
      const angle = Math.atan2(subject.y - this.previous!.y, subject.x - this.previous!.x);
      this.distance += moved;
      if (this.distance >= 16) {
        this.distance %= 16; this.side *= -1;
        const x = subject.x + Math.cos(angle + Math.PI / 2) * this.side * 4;
        const y = subject.y + Math.sin(angle + Math.PI / 2) * this.side * 3;
        const contact = groundAt(x, y);
        if (!contact.indoors && !contact.simulatedWater) {
          const random = randomFromSeed(hash(++this.serial + Math.floor(x * 7 + y * 13)));
          const biome = biomeForDebris(contact.weights, random());
          const wet = contact.water, natural = random() < contact.natural;
          const material: ParticleKind = wet > .18 ? 'droplet' : natural ? BIOME_LIFE[biome].debris : 'dust';
          const color = natural ? BIOME_LIFE[biome].footColor : '#3b3630';
          const foot = { x, y, age: 0, angle, foot: this.side, material, color, wet };
          this.trails.push(foot); this.footsteps.push({ ...foot });
          for (let i = 0; i < 3; i++) {
            const localBiome = biomeForDebris(contact.weights, random());
            const kind = random() < wet ? 'droplet' : random() < contact.natural ? BIOME_LIFE[localBiome].debris : 'dust';
            this.particle(x, y, 1, time, true, localBiome, kind);
          }
        }
      }
    }
    this.previous = { x: subject.x, y: subject.y };
    for (const trail of [...this.trails, ...this.footsteps]) trail.age += step;
    this.trim(this.trails, BIOME_LIFE_LIMITS.trails, t => t.age > 2.2);
    this.trim(this.footsteps, BIOME_LIFE_LIMITS.footsteps, t => t.age > 3.5);
    for (const particle of this.particles) {
      const wind = biomeWind(particle.x, particle.y, time, particle.biome);
      particle.age += step; particle.x += (particle.vx + wind.x * 12) * step; particle.y += (particle.vy + wind.y * 5) * step;
      particle.vz -= step * (particle.kind === 'ember' ? -2 : particle.kind === 'droplet' ? 45 : particle.kind === 'snow' || particle.kind === 'seed' ? 4 : 16); particle.z = Math.max(0, particle.z + particle.vz * step);
      if (particle.z === 0) { particle.vx *= Math.exp(-step * 5); particle.vy *= Math.exp(-step * 5); }
    }
    this.trim(this.particles, BIOME_LIFE_LIMITS.particles, particle => particle.age > particle.life);
    this.syncTime -= step; this.particleTime -= step;
    if (this.syncTime <= 0) { this.syncTime = .6; this.sync(props, subject); }
    if (this.particleTime <= 0) {
      this.particleTime = .2;
      let emitted = 0;
      for (const prop of props) {
        if (!prop.biome) continue;
        if (!BIOME_LIFE[prop.biome].emitters.includes(prop.kind) || hash(prop.seed) % 3 !== 0 || Math.hypot(prop.x - subject.x, prop.y - subject.y) > 600) continue;
        if (biomeWind(prop.x, prop.y, time, prop.biome).gust < .52 || emitted++ >= 3) continue;
        const random = randomFromSeed(hash(prop.seed + this.serial));
        const crown = ['tree', 'canopy', 'willow', 'snowPine', 'autumnTree', 'deadTree', 'charredTree', 'windTree'].includes(prop.kind);
        const kind = prop.kind === 'emberRock' ? 'ember' : prop.kind === 'snowPine' ? 'snow' : BIOME_LIFE[prop.biome].debris;
        this.particle(prop.x + (random() - .5) * (crown ? 65 : 18), prop.y - 12,
          (crown ? 58 + random() * 35 : 5 + random() * 12) * prop.scale, time, false, prop.biome, kind);
      }
    }
    for (const bird of this.birds) {
      bird.age += step; bird.elapsed += step;
      const near = Math.hypot(subject.x - bird.x, subject.y - bird.y) < 90;
      if (bird.state === 'perched' && near && Math.hypot(subject.vx, subject.vy) > 12) {
        bird.state = 'fleeing'; bird.elapsed = 0;
        const angle = Math.atan2(bird.y - subject.y, bird.x - subject.x);
        const speed = bird.kind === 'snowfinch' ? 1.3 : bird.kind === 'wader' ? .8 : bird.kind === 'hawk' ? 1.15 : 1;
        bird.dx = Math.cos(angle) * 58 * speed; bird.dy = Math.sin(angle) * 34 * speed;
      }
      // Soaring birds leave on a deterministic schedule and ride a drifting thermal.
      if (bird.state === 'perched' && bird.soar && bird.elapsed > 7 + (bird.phase / Math.PI) * 9) {
        bird.state = 'soaring'; bird.elapsed = 0;
      }
      if (bird.state === 'fleeing') {
        bird.x += bird.dx * step; bird.y += bird.dy * step; bird.z = Math.min(95, bird.z + step * 34);
        if (bird.elapsed > 2.6) { bird.state = 'returning'; bird.elapsed = 0; }
      } else if (bird.state === 'soaring') {
        // A slow circle around a thermal that drifts with the wind; the bird
        // climbs for the first seconds, then holds altitude.
        const wind = biomeWind(bird.x, bird.y, time, bird.biome);
        const cx = bird.homeX + Math.sin(time * .05 + bird.phase) * 120 + wind.x * 40;
        const cy = bird.homeY + Math.cos(time * .04 + bird.phase) * 80;
        const a = bird.elapsed * .5 + bird.phase;
        const x = cx + Math.cos(a) * 150, y = cy + Math.sin(a) * 78;
        const blend = 1 - Math.exp(-step * 1.1);
        bird.dx = x - bird.x; bird.dy = y - bird.y;
        bird.x += bird.dx * blend; bird.y += bird.dy * blend;
        bird.z += (Math.min(120, 60 + bird.elapsed * 14) - bird.z) * blend;
        if (bird.elapsed > 16 + (bird.phase % 1) * 8) { bird.state = 'returning'; bird.elapsed = 0; }
      } else if (bird.state === 'returning') {
        if (Math.hypot(subject.x - bird.homeX, subject.y - bird.homeY) < 115) {
          // A bird circles above an occupied perch instead of hovering in place.
          const a = bird.elapsed * .65 + bird.phase, blend = 1 - Math.exp(-step * 1.2);
          const x = bird.homeX + Math.cos(a) * 145, y = bird.homeY + Math.sin(a) * 70;
          bird.dx = x - bird.x; bird.dy = y - bird.y;
          bird.x += bird.dx * blend; bird.y += bird.dy * blend;
          bird.z += (85 - bird.z) * blend;
          continue;
        }
        const blend = 1 - Math.exp(-step * .65);
        bird.x += (bird.homeX - bird.x) * blend; bird.y += (bird.homeY - bird.y) * blend; bird.z += (bird.homeZ - bird.z) * blend;
        if (Math.hypot(bird.x - bird.homeX, bird.y - bird.homeY, bird.z - bird.homeZ) < 2) {
          bird.state = 'perched'; bird.x = bird.homeX; bird.y = bird.homeY; bird.z = bird.homeZ; bird.elapsed = 0;
        }
      }
    }
    for (const insect of this.insects) {
      insect.age += step;
      const dx = insect.x - subject.x, dy = insect.y - subject.y, d = Math.hypot(dx, dy);
      insect.alarm = Math.max(0, insect.alarm - step * .6);
      if (d < 48 && Math.hypot(subject.vx, subject.vy) > 12) {
        insect.alarm = 1; insect.x += dx / Math.max(1, d) * step * 50; insect.y += dy / Math.max(1, d) * step * 40;
      } else {
        const rest = Math.sin(time * .38 + insect.phase) > (insect.kind === 'dragonfly' ? .92 : insect.kind === 'bee' ? .8 : .65);
        const range = insect.kind === 'bee' ? 13 : 20;
        const x = insect.homeX + (rest ? 0 : Math.sin(time * .9 + insect.phase) * range);
        const y = insect.homeY + (rest ? 0 : Math.cos(time * .67 + insect.phase) * (range * .55));
        const blend = 1 - Math.exp(-step * 2); insect.x += (x - insect.x) * blend; insect.y += (y - insect.y) * blend;
      }
    }
    for (const critter of this.critters) {
      critter.age += step; critter.elapsed += step;
      const dx = critter.x - subject.x, dy = critter.y - subject.y, d = Math.hypot(dx, dy);
      const speed = critter.kind === 'lizard' ? 95 : critter.kind === 'frog' ? 70 : critter.kind === 'beetle' ? 26 : 85;
      if (critter.state !== 'flee' && d < 64 && Math.hypot(subject.vx, subject.vy) > 14) {
        critter.state = 'flee'; critter.elapsed = 0;
        const away = Math.atan2(dy, dx) + Math.sin(critter.phase) * .5;
        critter.dx = Math.cos(away) * speed; critter.dy = Math.sin(away) * speed * .7;
      }
      if (critter.state === 'flee') {
        critter.x += critter.dx * step; critter.y += critter.dy * step;
        if (critter.elapsed > 1.6 || Math.hypot(critter.x - critter.homeX, critter.y - critter.homeY) > 190) {
          critter.state = 'return'; critter.elapsed = 0;
        }
      } else if (critter.state === 'dart') {
        critter.x += critter.dx * step; critter.y += critter.dy * step;
        if (critter.elapsed > .5) { critter.state = 'idle'; critter.elapsed = 0; }
      } else if (critter.state === 'return') {
        const blend = 1 - Math.exp(-step * 1.6);
        critter.x += (critter.homeX - critter.x) * blend; critter.y += (critter.homeY - critter.y) * blend;
        if (Math.hypot(critter.x - critter.homeX, critter.y - critter.homeY) < 3) {
          critter.state = 'idle'; critter.x = critter.homeX; critter.y = critter.homeY; critter.elapsed = 0;
        }
      } else if (critter.elapsed > 2.5 && Math.sin(time * .23 + critter.phase * 3.1) > .93) {
        // Occasional short hop to a nearby spot; beetles barely wander.
        const a = critter.phase + time * .11, range = critter.kind === 'beetle' ? 9 : 26;
        const tx = critter.homeX + Math.cos(a) * range, ty = critter.homeY + Math.sin(a) * range * .6;
        const dd = Math.max(1, Math.hypot(tx - critter.x, ty - critter.y));
        critter.dx = (tx - critter.x) / dd * speed * .55; critter.dy = (ty - critter.y) / dd * speed * .55;
        critter.state = 'dart'; critter.elapsed = 0;
      }
    }
    for (const fish of this.fish) {
      fish.age += step; fish.elapsed += step;
      const blend = 1 - Math.exp(-step * 1.4);
      fish.x += (fish.tx - fish.x) * blend; fish.y += (fish.ty - fish.y) * blend;
      fish.ring = Math.max(0, fish.ring - step * .8);
      if (fish.elapsed > 2.2 + (fish.phase % 1) * 3) {
        fish.elapsed = 0;
        const random = randomFromSeed(hash(++this.serial + Math.floor(fish.homeX + fish.homeY)));
        const a = random() * Math.PI * 2, r = 12 + random() * 42;
        const tx = fish.homeX + Math.cos(a) * r, ty = fish.homeY + Math.sin(a) * r * .6;
        // Fish stay in water: a dry target keeps them circling the home pool.
        if ((this.groundAt?.(tx, ty).water ?? 0) > .18) { fish.tx = tx; fish.ty = ty; fish.ring = 1; }
      }
    }
  }
  bend(x: number, y: number) {
    let value = 0;
    for (const trail of this.trails) {
      const d = Math.hypot(x - trail.x, (y - trail.y) * 1.35);
      if (d < 30) value += (x < trail.x ? -1 : 1) * (1 - d / 30) * Math.exp(-trail.age * 2.2);
    }
    return Math.max(-1, Math.min(1, value));
  }
  private trim<T>(items: T[], limit: number, expired: (item: T) => boolean) {
    for (let i = items.length - 1; i >= 0; i--) if (expired(items[i])) items.splice(i, 1);
    if (items.length > limit) items.splice(0, items.length - limit);
  }
  private particle(x: number, y: number, z: number, time: number, kicked: boolean, biome: BiomeId, kind: ParticleKind) {
    const random = randomFromSeed(hash(++this.serial + Math.floor(x * 7 + y * 13)));
    const palette = kind === 'droplet' ? ['#91bdbf', '#78a5b4', '#bddad6']
      : kind === 'ember' ? ['#e9a563', '#f4c68c', '#cc7956']
      : kind === 'dust' ? ['#9a9078', '#777f79', '#a9a593'] : BIOME_LIFE[biome].colors;
    this.particles.push({ x, y, z, biome, kind,
      vx: (random() - .5) * (kicked ? 50 : 12), vy: (random() - .5) * 22,
      vz: kind === 'ember' ? 9 : kicked ? 19 + random() * 18 : -3,
      age: 0, life: kind === 'droplet' ? .8 : kicked ? 1.8 : 4.8,
      phase: time + random() * 6.28, color: palette[Math.floor(random() * palette.length)] });
    if (this.particles.length > BIOME_LIFE_LIMITS.particles) this.particles.shift();
  }
  private sync(props: readonly Prop[], subject: BiomeSubject) {
    const candidates = props.filter(p => Math.hypot(p.x - subject.x, p.y - subject.y) < 650)
      .sort((a, b) => Math.hypot(a.x - subject.x, a.y - subject.y) - Math.hypot(b.x - subject.x, b.y - subject.y));
    const nearby = new Set(candidates.map(p => p.id));
    this.trim(this.birds, BIOME_LIFE_LIMITS.birds, b => !nearby.has(b.id));
    // Insects/critters carry composite `${propId}:${kind}` ids — match on the
    // prop-id prefix so they persist instead of churning every sync.
    const propId = (id: string) => id.slice(0, id.lastIndexOf(':'));
    this.trim(this.insects, BIOME_LIFE_LIMITS.insects, b => !nearby.has(propId(b.id)));
    this.trim(this.critters, BIOME_LIFE_LIMITS.critters, b => !nearby.has(propId(b.id)));
    this.trim(this.fish, BIOME_LIFE_LIMITS.fish, f => Math.hypot(f.homeX - subject.x, f.homeY - subject.y) > 700);
    for (const prop of candidates) {
      if (!prop.biome) continue;
      const profile = BIOME_LIFE[prop.biome];
      const phase = hash(prop.seed) / 0x100000000 * Math.PI * 2;
      for (const bird of profile.birds) {
        if (this.birds.length >= BIOME_LIFE_LIMITS.birds || !bird.perches.includes(prop.kind)
          || this.birds.some(b => b.id === prop.id)) continue;
        const z = prop.kind === 'deadTree' || prop.kind === 'windTree' ? 38 : prop.kind === 'lilies' ? 0
          : prop.kind === 'tree' || prop.kind === 'canopy' || prop.kind === 'autumnTree' ? 55
          : prop.kind === 'charredTree' ? 34 : prop.kind === 'stump' ? 15 : 12;
        this.birds.push({ id: prop.id, biome: prop.biome, kind: bird.kind, x: prop.x + 3, y: prop.y, z, homeX: prop.x + 3, homeY: prop.y, homeZ: z,
          age: 0, phase, state: 'perched', elapsed: phase * 3, dx: 0, dy: 0, soar: !!bird.soaring });
        break; // One bird per perch prop.
      }
      for (const insect of profile.insects) {
        if (this.insects.length >= BIOME_LIFE_LIMITS.insects || !insect.anchors.includes(prop.kind)) continue;
        const id = `${prop.id}:${insect.kind}`;
        if (this.insects.some(b => b.id === id)) continue;
        this.insects.push({ id, biome: prop.biome, kind: insect.kind, color: insect.color,
          x: prop.x, y: prop.y - 8, homeX: prop.x, homeY: prop.y - 8, phase, age: 0, alarm: 0 });
      }
      for (const critter of profile.critters) {
        if (this.critters.length >= BIOME_LIFE_LIMITS.critters || !critter.anchors.includes(prop.kind)) continue;
        const id = `${prop.id}:${critter.kind}`;
        if (this.critters.some(b => b.id === id) || hash(prop.seed + critter.kind.length * 131) % 3 !== 0) continue;
        this.critters.push({ id, biome: prop.biome, kind: critter.kind, color: critter.color,
          x: prop.x + 6, y: prop.y + 4, homeX: prop.x + 6, homeY: prop.y + 4, phase, age: 0, elapsed: phase * 2,
          state: 'idle', dx: 0, dy: 0 });
      }
    }
    // Fish anchor to seeded water cells around the subject instead of props.
    if (this.groundAt) {
      const cell = 170;
      for (let cy = Math.floor((subject.y - 560) / cell); cy <= Math.floor((subject.y + 560) / cell); cy++) {
        for (let cx = Math.floor((subject.x - 560) / cell); cx <= Math.floor((subject.x + 560) / cell); cx++) {
          if (this.fish.length >= BIOME_LIFE_LIMITS.fish) break;
          const seed = hash(Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ 5011);
          if (seed % 5 > 1) continue;
          const random = randomFromSeed(seed);
          const x = (cx + .2 + random() * .6) * cell, y = (cy + .2 + random() * .6) * cell;
          const contact = this.groundAt(x, y);
          if (contact.indoors || contact.water < .3) continue;
          const biome = biomeForDebris(contact.weights, random());
          if (!BIOME_LIFE[biome].fish) continue;
          const id = `fish:${cx}:${cy}`;
          if (this.fish.some(f => f.id === id)) continue;
          this.fish.push({ id, x, y, homeX: x, homeY: y, tx: x, ty: y, phase: random() * Math.PI * 2, age: 0, elapsed: random() * 4, ring: 0 });
        }
      }
    }
  }
}
