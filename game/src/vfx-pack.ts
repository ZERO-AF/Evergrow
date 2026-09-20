import { drawGlow } from './lighting.ts';
import type { PointLight } from './lighting.ts';
import { text } from './font.ts';
import { resolveSkill } from './skill-progression.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import type { CombatEvent, Enemy, Player } from './model.ts';
import type { Simulation } from './simulation.ts';

/**
 * WoW-deepening presentation pack (docs/wow-deepening.md §4). One-shot world
 * effects plus the cast-target decal and crit damage numbers. Presentation
 * only: nothing here mutates simulation state, and every collection is bounded.
 */

interface VfxParticle {
  x: number; y: number; vx: number; vy: number;
  z: number; vz: number;
  life: number; max: number; size: number;
  color: string; luminous: boolean; gravity: number;
}
interface VfxBurst {
  x: number; y: number; life: number; max: number;
  radius: number; color: string; kind: 'ring' | 'flash' | 'pillar' | 'star';
}
interface VfxCrit { x: number; y: number; life: number; max: number; value: string; }

const GOLD = '#ffd75e', PALE_GOLD = '#fff3c4', SMOKE = '#b9c4bd', CRIT = '#ffd977';

/** Cast decal radius follows the skill's resolved area when it has one. */
function castDecalRadius(p: Player, cast: NonNullable<Player['cast']>, target: Enemy | undefined): number {
  const recipe = resolveSkill(cast.skill, p.derived, p.character).recipe;
  if (recipe.kind === 'ground' || recipe.kind === 'radial' || recipe.kind === 'cone') return recipe.radius;
  if (recipe.kind === 'cc' && recipe.radius) return recipe.radius;
  if (target) return Math.max(20, target.radius + 10);
  return 26;
}

/**
 * Ground decal under the active cast's committed target: point casts mark the
 * aim, enemy-targeted casts ring the target, self casts ring the player.
 * World-space; draw in the emission pass beside drawGroundSpell.
 */
export function drawCastTargetDecal(c: CanvasRenderingContext2D, sim: Simulation,
  time: number, reducedMotion = false): void {
  const cast = sim.player.cast;
  if (!cast || cast.duration <= 0) return;
  const p = sim.player, alpha = sim.interpolationAlpha;
  const target = cast.targetId !== undefined ? sim.enemies.find(e => e.id === cast.targetId && e.hp > 0) : undefined;
  const x = target ? target.prevX + (target.x - target.prevX) * alpha
    : cast.x !== undefined ? cast.x : p.prevX + (p.x - p.prevX) * alpha;
  const y = target ? target.prevY + (target.y - target.prevY) * alpha
    : cast.y !== undefined ? cast.y : p.prevY + (p.y - p.prevY) * alpha;
  const radius = castDecalRadius(p, cast, target);
  const color = SKILL_DEFINITIONS[cast.skill]?.color ?? '#d4d5ac';
  const progress = Math.max(0, Math.min(1, 1 - cast.remaining / cast.duration));
  const t = reducedMotion ? 0 : time;

  c.save();
  c.translate(x, y);
  // Soft wash + dim rim: reads as "your spell lands here", not an enemy telegraph.
  const wash = c.createRadialGradient(0, 0, 0, 0, 0, radius);
  wash.addColorStop(0, color + '00'); wash.addColorStop(.7, color + '0a'); wash.addColorStop(1, color + '2e');
  c.fillStyle = wash;
  c.beginPath(); c.arc(0, 0, radius, 0, Math.PI * 2); c.fill();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = .16 + progress * .2;
  c.strokeStyle = color; c.lineWidth = 5;
  c.beginPath(); c.arc(0, 0, radius, 0, Math.PI * 2); c.stroke();
  c.globalAlpha = .5 + progress * .3;
  c.lineWidth = 1.1;
  c.beginPath(); c.arc(0, 0, radius, 0, Math.PI * 2); c.stroke();
  // Cast progress sweeps the rim; channel ticks pulse the marker instead.
  c.globalAlpha = .85;
  c.strokeStyle = '#fff3d0'; c.lineWidth = 1.4;
  c.beginPath(); c.arc(0, 0, radius - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); c.stroke();
  // Slow inner spokes gather toward the release point.
  c.strokeStyle = color; c.lineWidth = .8;
  for (let i = 0; i < 10; i++) {
    const f = (t * .5 + i * .173) % 1, a = i * 2.39996;
    const r = radius * (.4 + f * .6);
    c.globalAlpha = .3 * Math.sin(f * Math.PI) + progress * .15;
    c.beginPath();
    c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    c.lineTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4));
    c.stroke();
  }
  drawGlow(c, 0, 0, Math.min(28, radius * .4), color, .14 + progress * .2);
  c.restore();
}

export class VfxPack {
  private particles: VfxParticle[] = [];
  private bursts: VfxBurst[] = [];
  private crits: VfxCrit[] = [];

  reset() { this.particles = []; this.bursts = []; this.crits = []; }

  private spark(x: number, y: number, angle: number, color: string, strength = 1, luminous = true) {
    const speed = (30 + Math.random() * 140) * strength;
    const life = .25 + Math.random() * .5;
    this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      z: luminous ? 12 : 4, vz: luminous ? 30 + Math.random() * 80 : 12 + Math.random() * 30,
      life, max: life, size: luminous ? .9 + Math.random() * 1.6 : 2 + Math.random() * 2.6,
      color, luminous, gravity: luminous ? 190 : 60 });
  }

  /** Golden pillar + ring + rising sparks on level-up. */
  levelUp(x: number, y: number) {
    this.bursts.push({ x, y, life: .9, max: .9, radius: 110, color: GOLD, kind: 'pillar' });
    this.bursts.push({ x, y, life: .7, max: .7, radius: 90, color: PALE_GOLD, kind: 'ring' });
    for (let i = 0; i < 26; i++) this.spark(x, y - 8, Math.random() * Math.PI * 2, i % 3 ? GOLD : PALE_GOLD, 1.2);
    this.trim();
  }

  /** Bright white-gold flash when a quest is completed or turned in. */
  questComplete(x: number, y: number) {
    this.bursts.push({ x, y, life: .55, max: .55, radius: 80, color: '#ffe9b0', kind: 'flash' });
    this.bursts.push({ x, y, life: .6, max: .6, radius: 64, color: GOLD, kind: 'ring' });
    for (let i = 0; i < 14; i++) this.spark(x, y - 10, Math.random() * Math.PI * 2, i % 2 ? '#ffe9b0' : GOLD, .8);
    this.trim();
  }

  /** Summon/dismiss smoke poof; non-luminous puffs, no pillar. */
  mountPoof(x: number, y: number) {
    for (let i = 0; i < 12; i++) this.spark(x, y - 4, Math.random() * Math.PI * 2, SMOKE, .7, false);
    this.bursts.push({ x, y, life: .35, max: .35, radius: 34, color: '#cfd8cf', kind: 'ring' });
    this.trim();
  }

  /** Small rising glints while a gather channel completes. */
  gatherSparkle(x: number, y: number) {
    for (let i = 0; i < 12; i++) this.spark(x, y - 6, -Math.PI / 2 + (Math.random() - .5) * 1.6, i % 2 ? '#ffd98a' : '#fff3c4', .55);
    this.bursts.push({ x, y, life: .3, max: .3, radius: 26, color: '#ffd98a', kind: 'flash' });
    this.trim();
  }

  /** Bigger, shaking crit number plus a star accent at the victim. */
  crit(x: number, y: number, value: number) {
    this.crits.push({ x: x + (Math.random() - .5) * 8, y: y - 52, life: 1, max: 1, value: String(Math.round(value)) });
    this.bursts.push({ x, y: y - 30, life: .22, max: .22, radius: 44, color: CRIT, kind: 'star' });
    for (let i = 0; i < 6; i++) this.spark(x, y - 26, Math.random() * Math.PI * 2, CRIT, .8);
    this.trim();
  }

  /** Event-driven hooks: level burst and crit pops ride the combat event stream. */
  handleEvents(events: readonly CombatEvent[]) {
    for (const event of events) {
      if (event.type === 'level') this.levelUp(event.x, event.y);
      else if (event.type === 'hit' && event.heavy) this.crit(event.x, event.y, event.value);
    }
  }

  private trim() {
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
    if (this.bursts.length > 12) this.bursts.splice(0, this.bursts.length - 12);
    if (this.crits.length > 12) this.crits.splice(0, this.crits.length - 12);
  }

  update(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (const s of this.particles) {
      s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= Math.exp(-dt * 2.2); s.vy *= Math.exp(-dt * 2.2);
      s.z = Math.max(0, s.z + s.vz * dt); s.vz -= dt * s.gravity;
    }
    for (const b of this.bursts) b.life -= dt;
    for (const crit of this.crits) { crit.life -= dt; crit.y -= dt * 34; }
    this.particles = this.particles.filter(s => s.life > 0);
    this.bursts = this.bursts.filter(b => b.life > 0);
    this.crits = this.crits.filter(crit => crit.life > 0);
  }

  getLights(): PointLight[] {
    return this.bursts.slice(-3).map(b => ({ x: b.x, y: b.y - 12, radius: b.radius * 1.6,
      color: b.color, power: (b.life / b.max) * .5 }));
  }

  /** World-space pass: bursts and particles, drawn beside CombatEffects.draw. */
  draw(c: CanvasRenderingContext2D, reducedMotion = false) {
    const motion = reducedMotion ? .55 : 1;
    c.save();
    for (const b of this.bursts) {
      const t = Math.max(0, b.life / b.max), elapsed = 1 - t;
      if (b.kind === 'flash') {
        drawGlow(c, b.x, b.y - 10, b.radius, b.color, t * .8);
      } else if (b.kind === 'pillar') {
        const height = b.radius * 1.3 * motion;
        const pillar = c.createLinearGradient(0, b.y, 0, b.y - height);
        pillar.addColorStop(0, b.color); pillar.addColorStop(1, b.color + '00');
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = t * .55;
        c.fillStyle = pillar;
        c.beginPath();
        c.moveTo(b.x - 10, b.y); c.lineTo(b.x - 3, b.y - height);
        c.lineTo(b.x + 3, b.y - height); c.lineTo(b.x + 10, b.y);
        c.closePath(); c.fill();
        drawGlow(c, b.x, b.y - 8, b.radius * .5, b.color, t * .6);
      } else if (b.kind === 'ring') {
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = t * .7;
        c.beginPath(); c.ellipse(b.x, b.y, 6 + elapsed * b.radius * motion, 3 + elapsed * b.radius * .5 * motion, 0, 0, Math.PI * 2); c.stroke();
      } else {
        // Star accent: short radiating spikes behind the crit number.
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = t;
        const reach = b.radius * (.4 + elapsed * .6 * motion);
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 + .3;
          c.beginPath();
          c.moveTo(b.x + Math.cos(a) * reach * .3, b.y + Math.sin(a) * reach * .3);
          c.lineTo(b.x + Math.cos(a) * reach, b.y + Math.sin(a) * reach);
          c.stroke();
        }
        drawGlow(c, b.x, b.y, b.radius * .5, b.color, t * .5);
      }
    }
    for (const s of this.particles) {
      const t = Math.min(1, s.life / s.max * 1.8), y = s.y - s.z;
      c.globalCompositeOperation = s.luminous ? 'lighter' : 'source-over';
      c.globalAlpha = t * (s.luminous ? 1 : .6);
      c.strokeStyle = s.color; c.lineWidth = s.size * .7;
      c.beginPath(); c.moveTo(s.x - s.vx * .03, y - (s.vy - s.vz) * .02); c.lineTo(s.x, y); c.stroke();
      c.fillStyle = s.color;
      if (s.luminous) c.fillRect(s.x - s.size / 2, y - s.size / 2, s.size, s.size);
      else { c.beginPath(); c.arc(s.x, y, s.size, 0, Math.PI * 2); c.fill(); }
    }
    c.restore();
  }

  /** Screen-space pass: crit numbers ride the UI surface like CombatEffects.drawNumbers. */
  drawNumbers(c: CanvasRenderingContext2D, project: (x: number, y: number) => { x: number; y: number }, reducedMotion = false) {
    c.save();
    for (const crit of this.crits) {
      const elapsed = crit.max - crit.life;
      const pop = 1 + .6 * Math.exp(-elapsed * 14);
      const shake = reducedMotion ? 0 : Math.sin(elapsed * 70) * Math.exp(-elapsed * 9) * 2.4;
      const size = 3.4 * pop;
      const { x, y } = project(crit.x + shake, crit.y);
      c.globalAlpha = Math.min(1, crit.life / .25);
      text(c, crit.value, x - 1.5, y, size, '#04070b', 'center');
      text(c, crit.value, x + 1.5, y + 1.5, size, '#04070b', 'center');
      text(c, crit.value, x, y, size, CRIT, 'center');
      if (pop > 1.12) text(c, crit.value, x, y, size * .92, '#fff6d8', 'center');
    }
    c.restore();
  }
}
