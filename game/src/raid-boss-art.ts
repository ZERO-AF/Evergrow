import type { Enemy } from './model.ts';
import type { WarningShape } from './attack-warning-art.ts';
import { BOSS_PRESSURE } from './boss-pressure.ts';
import { drawGlow, type PointLight } from './lighting.ts';
import { isRaidBoss, ONYXIA_RULES as R } from './raid-boss-content.ts';
import { raidScorches } from './raid-boss.ts';

/**
 * Onyxia presentation layer (docs/wow-deepening.md §15). Drop-in branches for
 * the shared enemy-warning pass: `raidBossWarnings` returns the same Warning
 * shape enemyWarnings() yields, so the integrator can short-circuit
 * `isRaidBoss(e) ? raidBossWarnings(e, alpha) : enemyWarnings(e, alpha)`.
 * `drawRaidBossEffects` renders persistent lava scorch decals and the enrage
 * aura — call it alongside drawEnemyWarning for raid bosses.
 */

export interface RaidWarning { x: number; y: number; angle: number; shape: WarningShape; color: string; progress: number; locked: boolean }
const FIRE = '#ff8a4e';

/** Telegraph geometry for every raid bossMove; matches the contact math in raid-boss.ts exactly. */
export function raidBossWarnings(e: Enemy, alpha = 1): RaidWarning[] {
  if (!isRaidBoss(e) || e.hp <= 0 || (e.state !== 'windup' && e.state !== 'attack')) return [];
  const x = e.prevX + (e.x - e.prevX) * alpha, y = e.prevY + (e.y - e.prevY) * alpha;
  const progress = e.state === 'attack' ? 1 : Math.min(1, e.stateTime / Math.max(.01, e.stateDuration));
  const locked = e.state === 'attack';
  const base = { x, y, angle: e.attackAngle, progress, color: FIRE };
  switch (e.bossMove) {
    case 'sweep': // Tail Sweep
      return [{ ...base, locked: true, shape: { kind: 'sector', radius: R.sweepReach, arc: R.sweepArc } }];
    case 'fracture': // Flame Breath: three staggered lanes
      return R.breathOffsets.map(offset => ({ ...base, x: e.bossOriginX ?? x, y: e.bossOriginY ?? y,
        angle: e.attackAngle + offset, locked: true, shape: { kind: 'lane', length: R.breathLength, width: R.breathWidth } }));
    case 'eruption': // Fireball blast at the committed target
      return [{ ...base, x: e.attackTargetX, y: e.attackTargetY, locked: true, shape: { kind: 'circle', radius: R.fireballRadius } }];
    case 'rush': // Deep Breath strafe lane
      return [{ ...base, x: e.bossOriginX ?? x, y: e.bossOriginY ?? y, locked: true,
        shape: { kind: 'lane', length: R.deepBreathLength, width: R.deepBreathWidth } }];
    case 'command': // Bellowing Roar
      return [{ ...base, locked: true, shape: { kind: 'circle', radius: R.roarRadius } }];
    case 'jab':
      return [{ ...base, locked, shape: { kind: 'sector', radius: BOSS_PRESSURE.jab.range, arc: BOSS_PRESSURE.jab.arc } }];
    case 'bolt':
      return [{ ...base, locked, shape: { kind: 'lane', length: BOSS_PRESSURE.bolt.speed * BOSS_PRESSURE.bolt.life, width: BOSS_PRESSURE.bolt.radius } }];
    default: // 'summon' flourish — aura only, no damage footprint
      return [];
  }
}

/** Scorch decals, summon/enrage auras. Call inside the same pass as drawEnemyWarning. */
export function drawRaidBossEffects(c: CanvasRenderingContext2D, e: Enemy, time: number, reduced: boolean): void {
  if (!isRaidBoss(e)) return;
  for (const z of raidScorches(e)) {
    const fade = Math.min(1, z.remaining / 4);
    c.save();
    c.translate(z.x, z.y);
    const pulse = reduced ? .8 : .75 + Math.sin(time * 3.1 + z.x * .01) * .25;
    c.globalAlpha = .16 * fade * pulse;
    c.fillStyle = '#ff5a26';
    c.beginPath(); c.arc(0, 0, R.scorchRadius, 0, Math.PI * 2); c.fill();
    c.globalAlpha = .5 * fade;
    c.strokeStyle = '#ffb35e'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, R.scorchRadius * (.82 + pulse * .12), 0, Math.PI * 2); c.stroke();
    c.restore();
    drawGlow(c, z.x, z.y, R.scorchRadius * .8, '#ff7a30', .22 * fade);
  }
  if (e.bossMove === 'summon' && (e.state === 'windup' || e.state === 'attack'))
    drawGlow(c, e.x, e.y - 40, 130, '#ff9a4e', .3 + Math.min(1, e.stateTime / Math.max(.01, e.stateDuration)) * .3);
  if (e.bossMove === 'command' && (e.state === 'windup' || e.state === 'attack'))
    drawGlow(c, e.x, e.y - 35, 110, '#e8b04a', .3);
}

/** Warning light matching enemyWarningLight's contract for the lighting pass. */
export function raidBossWarningLight(e: Enemy): PointLight | null {
  const w = raidBossWarnings(e, 1)[0];
  if (!w) return null;
  return { x: w.x, y: w.y, radius: w.shape.kind === 'circle' ? w.shape.radius * 1.3 : 65,
    color: w.color, power: .12 + w.progress * .3 };
}
