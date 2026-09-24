import type { Attack, Player } from './model.ts';
import type { SkillId } from './character-types.ts';
import { getActiveSwingOffset } from './attack-motion.ts';
import { line, polygon, type Point } from './art-primitives.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { SKILL_EXECUTION } from './skill-execution-content.ts';
import { PROJECTILE_COLORS } from './projectile-colors.ts';

interface Sweep {
  attack: Attack; x: number; y: number; progress: number; fade: number;
  reach: number; arc: number; angle: number; hand: 'main' | 'off';
  skill: SkillId; color: string;
}
const AFTERIMAGE = .24;
/** The same angular progression and outer reach as swept combat, in world coordinates. */
export function skillSweepPoint(angle: number, arc: number, hand: 'main' | 'off', progress: number, reach: number): Point {
  const yaw = angle + getActiveSwingOffset(progress, arc, hand);
  return [Math.cos(yaw) * reach, Math.sin(yaw) * reach];
}

/** Skill reach is an energy blade beyond the actual metal blade; basic attacks retain their ribbon. */
export class SkillMeleeArt {
  private sweeps: Sweep[] = [];
  private dashes: Array<{ x: number; y: number; angle: number; radius: number; life: number; color: string }> = [];
  /** Step dashes (Blink/Disengage) leave a vanish burst at the origin and an arrival flash at the destination. */
  private teleports: Array<{ ox: number; oy: number; dx: number; dy: number; life: number; color: string }> = [];
  private lastDash: Player['dash'] | null = null;
  reset(): void { this.sweeps = []; this.dashes = []; this.teleports = []; this.lastDash = null; }
  update(p: Player, dt: number, alpha = 1): void {
    for (const dash of this.dashes) dash.life -= dt;
    for (const tp of this.teleports) tp.life -= dt;
    const dash = p.dash;
    if (dash && dash !== this.lastDash && SKILL_EXECUTION[dash.skill]?.kind === 'step') {
      // One poof pair per step: vanish at the origin, flash where the blink lands.
      const dist = dash.speed * dash.remaining;
      this.teleports.push({ ox: p.x, oy: p.y,
        dx: p.x + Math.cos(dash.angle) * dist, dy: p.y + Math.sin(dash.angle) * dist,
        life: .3, color: SKILL_DEFINITIONS[dash.skill]?.color ?? (dash.style ? PROJECTILE_COLORS[dash.style] : '#b7ead8') });
    }
    this.lastDash = dash;
    if (dash && SKILL_EXECUTION[dash.skill]?.kind !== 'step' && Math.hypot(p.x-p.prevX,p.y-p.prevY)>0)
      this.dashes.push({ x:p.x,y:p.y,angle:dash.angle,radius:dash.radius,life:.18,
        color: SKILL_DEFINITIONS[dash.skill]?.color ?? (dash.style ? PROJECTILE_COLORS[dash.style] : '#b7ead8') });
    this.dashes = this.dashes.filter(d=>d.life>0).slice(-24);
    this.teleports = this.teleports.filter(t=>t.life>0).slice(-8);
    for (const sweep of this.sweeps) sweep.fade -= dt;
    const attack = p.attack;
    if (attack?.kind === 'melee' && attack.skill && SKILL_EXECUTION[attack.skill].kind === 'sweep'
      && attack.elapsed >= attack.activeStart && attack.elapsed <= attack.activeEnd) {
      let sweep = this.sweeps.find(s => s.attack === attack);
      if (!sweep) {
        sweep = { attack, skill: attack.skill, x: p.x, y: p.y, progress: 0, fade: AFTERIMAGE,
          reach: attack.range, arc: attack.arc, angle: attack.angle, hand: attack.hand,
          color: attack.specialization?.endsWith('-force') ? '#ffc078' : attack.specialization?.endsWith('-reach') ? '#ffe4a8' : SKILL_DEFINITIONS[attack.skill!]?.color ?? '#eec274' };
        this.sweeps.push(sweep);
      }
      sweep.x = p.prevX + (p.x - p.prevX) * alpha;
      sweep.y = p.prevY + (p.y - p.prevY) * alpha;
      sweep.progress = Math.max(0, Math.min(1, (attack.elapsed - attack.activeStart) / (attack.activeEnd - attack.activeStart)));
      sweep.fade = AFTERIMAGE;
    }
    for (const sweep of this.sweeps) if (sweep.progress < 1 && sweep.attack.elapsed >= sweep.attack.activeEnd) {
      sweep.progress = 1; sweep.fade = AFTERIMAGE;
    }
    this.sweeps = this.sweeps.filter(s => s.fade > 0).slice(-6);
  }
  draw(c: CanvasRenderingContext2D, reduced: boolean): void {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const d of this.dashes) {
      const width = d.radius * .5;
      c.save(); c.translate(d.x,d.y-14); c.rotate(d.angle); c.globalAlpha = d.life/.18*.5;
      polygon(c, [[-22,-width],[4,0],[-22,width],[-14,0]], d.color); c.restore();
    }
    for (const tp of this.teleports) {
      const age = .3 - tp.life, fade = Math.min(1, tp.life / .15);
      // Vanish burst: expanding ring plus a few outward sparks at the origin.
      c.save(); c.translate(tp.ox, tp.oy - 14);
      c.globalAlpha = fade * .6; c.strokeStyle = tp.color; c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(0, 0, 6 + age * 90, 3 + age * 40, 0, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + .4, d = 4 + age * 60;
        c.globalAlpha = fade * .7;
        line(c, [[Math.cos(a) * d, Math.sin(a) * d * .5], [Math.cos(a) * (d + 5), Math.sin(a) * (d + 5) * .5]], i % 2 ? tp.color : '#f4faff', 1.2);
      }
      c.restore();
      // Arrival flash: destination marker brightens as the blink lands.
      const arrive = Math.min(1, age / .12);
      c.save(); c.translate(tp.dx, tp.dy - 14);
      c.globalAlpha = fade * .8 * arrive; c.strokeStyle = '#f4faff'; c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(0, 0, 10 - arrive * 4, 4.5 - arrive * 2, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = fade * .5 * arrive; c.fillStyle = tp.color;
      c.beginPath(); c.ellipse(0, -6, 5 * arrive, 8 * arrive, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    for (const s of this.sweeps) {
      const life = Math.min(1, s.fade / AFTERIMAGE), end = s.progress;
      const tail = s.skill === 'cleave' ? .46 : .38;
      const start = Math.max(0, end - tail), count = 32;
      if (end <= start) continue;
      c.save(); c.translate(s.x, s.y - 12);
      const outer: Point[] = [], inner: Point[] = [], edge: Point[] = [];
      for (let i = 0; i <= count; i++) {
        const t = i / count, progress = start + (end - start) * t;
        const taper = Math.sin(Math.PI * t) ** .65;
        const spread = reduced ? 0 : (1 - life) * 5;
        outer.push(skillSweepPoint(s.angle, s.arc, s.hand, progress, s.reach + spread));
        inner.push(skillSweepPoint(s.angle, s.arc, s.hand, progress, s.reach * (1 - .25 * taper * life)));
        edge.push(skillSweepPoint(s.angle, s.arc, s.hand, progress, s.reach * (1 - .025 * taper)));
      }
      c.globalAlpha = life * .2; line(c, outer, s.color, 18);
      c.globalAlpha = life * .68; polygon(c, [...outer, ...inner.reverse()], s.color);
      c.globalAlpha = life * .95; line(c, edge, '#fff1ce', 2.2);
      // Hot leading tip: the sweep's cutting edge reads as a bright head.
      const [hx, hy] = skillSweepPoint(s.angle, s.arc, s.hand, end, s.reach * .97);
      c.globalAlpha = life * .9; c.fillStyle = '#fff8e2';
      c.beginPath(); c.ellipse(hx, hy, 3.2, 2.2, s.angle + getActiveSwingOffset(end, s.arc, s.hand), 0, Math.PI * 2); c.fill();
      // A second, tighter wake separates a full-circle spin from a broad crescent.
      if (s.arc > Math.PI * 1.5) {
        const wake = outer.map(([x,y]): Point => [x * .72, y * .72]);
        c.globalAlpha = life * .45; line(c, wake, '#d6e6df', 2.2);
      }
      for (let i = 0; i < 9; i++) {
        const t = (i + .5) / 9, progress = start + (end - start) * t;
        const [x,y] = skillSweepPoint(s.angle, s.arc, s.hand, progress, s.reach * (.82 + i % 3 * .055));
        const scatter = reduced ? 0 : (1 - life) * (8 + i % 4 * 4);
        c.globalAlpha = life * (1 - t) * .7;
        line(c, [[x,y], [x + Math.cos(i * 2.4) * scatter, y - 3 - scatter]], '#ffe2a0', 1.2);
      }
      c.restore();
    }
    c.restore();
  }
}
