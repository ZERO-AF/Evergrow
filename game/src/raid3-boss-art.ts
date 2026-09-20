import type { Enemy } from './model.ts';
import type { WarningShape } from './attack-warning-art.ts';
import { BOSS_PRESSURE } from './boss-pressure.ts';
import { drawGlow, type PointLight } from './lighting.ts';
import { isRaid3Boss, KELTHUZAD_RULES as R } from './raid3-boss-content.ts';
import { raid3Voids } from './raid3-boss.ts';

/**
 * Kel'Thuzad presentation layer (docs/wow-deepening.md §15, third wave).
 * Drop-in branches for the shared enemy-warning pass: `raid3BossWarnings`
 * returns the same Warning shape enemyWarnings() yields, so the integrator can
 * short-circuit `isRaid3Boss(e) ? raid3BossWarnings(e, alpha) : enemyWarnings(e, alpha)`.
 * `drawRaid3BossEffects` renders Shadow Fissure void decals and the summon /
 * volley auras — call it alongside drawEnemyWarning for raid bosses.
 */

export interface Raid3Warning { x: number; y: number; angle: number; shape: WarningShape; color: string; progress: number; locked: boolean }
const FROST = '#8fd8ff';
const SHADOW = '#8a5adf';
const ARCANE = '#c9a8ff';

/** Telegraph geometry for every raid bossMove; matches the contact math in raid3-boss.ts exactly. */
export function raid3BossWarnings(e: Enemy, alpha = 1): Raid3Warning[] {
  if (!isRaid3Boss(e) || e.hp <= 0 || (e.state !== 'windup' && e.state !== 'attack')) return [];
  const x = e.prevX + (e.x - e.prevX) * alpha, y = e.prevY + (e.y - e.prevY) * alpha;
  const progress = e.state === 'attack' ? 1 : Math.min(1, e.stateTime / Math.max(.01, e.stateDuration));
  const locked = e.state === 'attack';
  const base = { x, y, angle: e.attackAngle, progress, color: FROST };
  switch (e.bossMove) {
    case 'sweep': // Frost Blast
      return [{ ...base, locked: true, shape: { kind: 'sector', radius: R.blastReach, arc: R.blastArc } }];
    case 'fracture': // Mana Detonation: three staggered lanes
      return R.detonateOffsets.map(offset => ({ ...base, x: e.bossOriginX ?? x, y: e.bossOriginY ?? y,
        angle: e.attackAngle + offset, locked: true, color: ARCANE, shape: { kind: 'lane', length: R.detonateLength, width: R.detonateWidth } }));
    case 'eruption': // Shadow Fissure detonation at the committed target
      return [{ ...base, x: e.attackTargetX, y: e.attackTargetY, locked: true, color: SHADOW, shape: { kind: 'circle', radius: R.fissureRadius } }];
    case 'rush': // Shadow Fissure creep: projected lane from the dais
      return [{ ...base, x: e.bossOriginX ?? x, y: e.bossOriginY ?? y, locked: true, color: SHADOW,
        shape: { kind: 'lane', length: R.creepLength, width: R.creepWidth } }];
    case 'command': // Frost Bolt Volley nova
      return [{ ...base, locked: true, shape: { kind: 'circle', radius: R.volleyRadius } }];
    case 'jab': // Frost Bolt (point-blank)
      return [{ ...base, locked, shape: { kind: 'sector', radius: BOSS_PRESSURE.jab.range, arc: BOSS_PRESSURE.jab.arc } }];
    case 'bolt': // Frost Bolt
      return [{ ...base, locked, shape: { kind: 'lane', length: BOSS_PRESSURE.bolt.speed * BOSS_PRESSURE.bolt.life, width: BOSS_PRESSURE.bolt.radius } }];
    default: // 'summon' flourish — aura only, no damage footprint
      return [];
  }
}

/** Void decals and summon/volley auras. Call inside the same pass as drawEnemyWarning. */
export function drawRaid3BossEffects(c: CanvasRenderingContext2D, e: Enemy, time: number, reduced: boolean): void {
  if (!isRaid3Boss(e)) return;
  for (const z of raid3Voids(e)) {
    const fade = Math.min(1, z.remaining / 4);
    c.save();
    c.translate(z.x, z.y);
    const pulse = reduced ? .8 : .75 + Math.sin(time * 3.1 + z.x * .01) * .25;
    c.globalAlpha = .16 * fade * pulse;
    c.fillStyle = '#5a2ea6';
    c.beginPath(); c.arc(0, 0, R.voidRadius, 0, Math.PI * 2); c.fill();
    c.globalAlpha = .5 * fade;
    c.strokeStyle = '#b08aff'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, R.voidRadius * (.82 + pulse * .12), 0, Math.PI * 2); c.stroke();
    c.restore();
    drawGlow(c, z.x, z.y, R.voidRadius * .8, '#7a4adf', .22 * fade);
  }
  if (e.bossMove === 'summon' && (e.state === 'windup' || e.state === 'attack'))
    drawGlow(c, e.x, e.y - 40, 150, e.attackVariant === 2 ? '#8a5adf' : '#8fd8ff',
      .3 + Math.min(1, e.stateTime / Math.max(.01, e.stateDuration)) * .3);
  if (e.bossMove === 'command' && (e.state === 'windup' || e.state === 'attack'))
    drawGlow(c, e.x, e.y - 35, 130, '#9fe0ff', .32);
}

/** Warning light matching enemyWarningLight's contract for the lighting pass. */
export function raid3BossWarningLight(e: Enemy): PointLight | null {
  const w = raid3BossWarnings(e, 1)[0];
  if (!w) return null;
  return { x: w.x, y: w.y, radius: w.shape.kind === 'circle' ? w.shape.radius * 1.3 : 65,
    color: w.color, power: .12 + w.progress * .3 };
}
