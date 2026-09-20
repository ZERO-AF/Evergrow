import type { Enemy } from './model.ts';
import type { WarningShape } from './attack-warning-art.ts';
import { BOSS_PRESSURE } from './boss-pressure.ts';
import { drawGlow, type PointLight } from './lighting.ts';
import { isRaid2Boss, RAGNAROS_RULES as R } from './raid2-boss-content.ts';
import { raid2Scorches, raid2Submerged } from './raid2-boss.ts';

/**
 * Ragnaros presentation layer (docs/wow-deepening.md §15, second wave). Drop-in
 * branches for the shared enemy-warning pass: `raid2BossWarnings` returns the
 * same Warning shape enemyWarnings() yields, so the integrator can
 * short-circuit `isRaid2Boss(e) ? raid2BossWarnings(e, alpha) : enemyWarnings(e, alpha)`.
 * `drawRaid2BossEffects` renders molten scorch decals, the submerge pool and
 * the enrage aura — call it alongside drawEnemyWarning for raid bosses.
 */

export interface Raid2Warning { x: number; y: number; angle: number; shape: WarningShape; color: string; progress: number; locked: boolean }
const LAVA = '#ff6a2e';

/** Telegraph geometry for every raid bossMove; matches the contact math in raid2-boss.ts exactly. */
export function raid2BossWarnings(e: Enemy, alpha = 1): Raid2Warning[] {
  if (!isRaid2Boss(e) || e.hp <= 0 || (e.state !== 'windup' && e.state !== 'attack')) return [];
  const x = e.prevX + (e.x - e.prevX) * alpha, y = e.prevY + (e.y - e.prevY) * alpha;
  const progress = e.state === 'attack' ? 1 : Math.min(1, e.stateTime / Math.max(.01, e.stateDuration));
  const locked = e.state === 'attack';
  const base = { x, y, angle: e.attackAngle, progress, color: LAVA };
  switch (e.bossMove) {
    case 'sweep': // Sulfuras Smash
      return [{ ...base, locked: true, shape: { kind: 'sector', radius: R.smashReach, arc: R.smashArc } }];
    case 'fracture': // Lava Splash: three staggered lanes
      return R.splashOffsets.map(offset => ({ ...base, x: e.bossOriginX ?? x, y: e.bossOriginY ?? y,
        angle: e.attackAngle + offset, locked: true, shape: { kind: 'lane', length: R.splashLength, width: R.splashWidth } }));
    case 'eruption': // Eruption blast at the committed target
      return [{ ...base, x: e.attackTargetX, y: e.attackTargetY, locked: true, shape: { kind: 'circle', radius: R.blastRadius } }];
    case 'rush': // Lava Wave: projected lane from the pool
      return [{ ...base, x: e.bossOriginX ?? x, y: e.bossOriginY ?? y, locked: true,
        shape: { kind: 'lane', length: R.waveLength, width: R.waveWidth } }];
    case 'command': // Lava Wave nova / Emerge burst
      return [{ ...base, locked: true, shape: { kind: 'circle', radius: R.novaRadius } }];
    case 'jab': // Wrath of Ragnaros
      return [{ ...base, locked, shape: { kind: 'sector', radius: BOSS_PRESSURE.jab.range, arc: BOSS_PRESSURE.jab.arc } }];
    case 'bolt': // Magma Blast
      return [{ ...base, locked, shape: { kind: 'lane', length: BOSS_PRESSURE.bolt.speed * BOSS_PRESSURE.bolt.life, width: BOSS_PRESSURE.bolt.radius } }];
    default: // 'summon' submerge flourish — aura only, no damage footprint
      return [];
  }
}

/** Scorch decals, submerge pool and summon/enrage auras. Call inside the same pass as drawEnemyWarning. */
export function drawRaid2BossEffects(c: CanvasRenderingContext2D, e: Enemy, time: number, reduced: boolean): void {
  if (!isRaid2Boss(e)) return;
  for (const z of raid2Scorches(e)) {
    const fade = Math.min(1, z.remaining / 4);
    c.save();
    c.translate(z.x, z.y);
    const pulse = reduced ? .8 : .75 + Math.sin(time * 3.1 + z.x * .01) * .25;
    c.globalAlpha = .16 * fade * pulse;
    c.fillStyle = '#ff4e1e';
    c.beginPath(); c.arc(0, 0, R.scorchRadius, 0, Math.PI * 2); c.fill();
    c.globalAlpha = .5 * fade;
    c.strokeStyle = '#ffb35e'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, R.scorchRadius * (.82 + pulse * .12), 0, Math.PI * 2); c.stroke();
    c.restore();
    drawGlow(c, z.x, z.y, R.scorchRadius * .8, '#ff6a24', .22 * fade);
  }
  if (raid2Submerged(e)) {
    // The lava pool he sank into: a churning glow with rising bubble rings.
    const churn = reduced ? .7 : .6 + Math.sin(time * 2.4) * .25;
    drawGlow(c, e.x, e.y - 20, 170, '#ff5a22', .3 + churn * .25);
    c.save();
    c.translate(e.x, e.y - 20);
    c.globalAlpha = .22 + churn * .18;
    c.strokeStyle = '#ffb35e'; c.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      const f = reduced ? .5 : (time * .5 + i / 3) % 1;
      c.beginPath(); c.arc(0, 0, 40 + f * 120, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }
  if (e.bossMove === 'summon' && (e.state === 'windup' || e.state === 'attack'))
    drawGlow(c, e.x, e.y - 40, 150, '#ff8a3c', .3 + Math.min(1, e.stateTime / Math.max(.01, e.stateDuration)) * .3);
  if (e.bossMove === 'command' && (e.state === 'windup' || e.state === 'attack'))
    drawGlow(c, e.x, e.y - 35, 130, '#ff9a3c', .32);
}

/** Warning light matching enemyWarningLight's contract for the lighting pass. */
export function raid2BossWarningLight(e: Enemy): PointLight | null {
  const w = raid2BossWarnings(e, 1)[0];
  if (!w) return null;
  return { x: w.x, y: w.y, radius: w.shape.kind === 'circle' ? w.shape.radius * 1.3 : 65,
    color: w.color, power: .12 + w.progress * .3 };
}
