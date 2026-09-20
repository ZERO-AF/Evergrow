import type { Enemy } from './model.ts';
import type { WarningShape } from './attack-warning-art.ts';
import { BOSS_PRESSURE } from './boss-pressure.ts';
import { drawGlow, type PointLight } from './lighting.ts';
import { isRaid4Boss, LICHKING_RULES as R } from './raid4-boss-content.ts';
import { raid4Defiles } from './raid4-boss.ts';

/**
 * Lich King presentation layer (docs/wow-deepening.md §15, fourth wave).
 * Drop-in branches for the shared enemy-warning pass: `raid4BossWarnings`
 * returns the same Warning shape enemyWarnings() yields, so the integrator can
 * short-circuit `isRaid4Boss(e) ? raid4BossWarnings(e, alpha) : enemyWarnings(e, alpha)`.
 * `drawRaid4BossEffects` renders Defile void decals and the summon / winter
 * auras — call it alongside drawEnemyWarning for raid bosses.
 */

export interface Raid4Warning { x: number; y: number; angle: number; shape: WarningShape; color: string; progress: number; locked: boolean }
const FROST = '#8fd8ff';
const SHADOW = '#8a5adf';
const PLAGUE = '#a5d64f';

/** Telegraph geometry for every raid bossMove; matches the contact math in raid4-boss.ts exactly. */
export function raid4BossWarnings(e: Enemy, alpha = 1): Raid4Warning[] {
  if (!isRaid4Boss(e) || e.hp <= 0 || (e.state !== 'windup' && e.state !== 'attack')) return [];
  const x = e.prevX + (e.x - e.prevX) * alpha, y = e.prevY + (e.y - e.prevY) * alpha;
  const progress = e.state === 'attack' ? 1 : Math.min(1, e.stateTime / Math.max(.01, e.stateDuration));
  const locked = e.state === 'attack';
  const base = { x, y, angle: e.attackAngle, progress, color: FROST };
  switch (e.bossMove) {
    case 'sweep': // Soul Reaper
      return [{ ...base, locked: true, color: SHADOW, shape: { kind: 'sector', radius: R.reaperReach, arc: R.reaperArc } }];
    case 'fracture': // Pain and Suffering: three staggered lanes
      return R.sufferingOffsets.map(offset => ({ ...base, x: e.bossOriginX ?? x, y: e.bossOriginY ?? y,
        angle: e.attackAngle + offset, locked: true, color: PLAGUE, shape: { kind: 'lane', length: R.sufferingLength, width: R.sufferingWidth } }));
    case 'eruption': // Defile detonation at the committed target
      return [{ ...base, x: e.attackTargetX, y: e.attackTargetY, locked: true, color: SHADOW, shape: { kind: 'circle', radius: R.defileRadius } }];
    case 'rush': // Ice Sphere: projected lane from the throne
      return [{ ...base, x: e.bossOriginX ?? x, y: e.bossOriginY ?? y, locked: true, color: FROST,
        shape: { kind: 'lane', length: R.sphereLength, width: R.sphereWidth } }];
    case 'command': // Remorseless Winter nova
      return [{ ...base, locked: true, shape: { kind: 'circle', radius: R.winterRadius } }];
    case 'jab': // Infest (point-blank)
      return [{ ...base, locked, color: PLAGUE, shape: { kind: 'sector', radius: BOSS_PRESSURE.jab.range, arc: BOSS_PRESSURE.jab.arc } }];
    case 'bolt': // Necrotic Plague
      return [{ ...base, locked, color: PLAGUE, shape: { kind: 'lane', length: BOSS_PRESSURE.bolt.speed * BOSS_PRESSURE.bolt.life, width: BOSS_PRESSURE.bolt.radius } }];
    default: // 'summon' flourish — aura only, no damage footprint
      return [];
  }
}

/** Defile decals and summon/winter auras. Call inside the same pass as drawEnemyWarning. */
export function drawRaid4BossEffects(c: CanvasRenderingContext2D, e: Enemy, time: number, reduced: boolean): void {
  if (!isRaid4Boss(e)) return;
  for (const z of raid4Defiles(e)) {
    const fade = Math.min(1, z.remaining / 4);
    c.save();
    c.translate(z.x, z.y);
    const pulse = reduced ? .8 : .75 + Math.sin(time * 3.1 + z.x * .01) * .25;
    c.globalAlpha = .16 * fade * pulse;
    c.fillStyle = '#5a2ea6';
    c.beginPath(); c.arc(0, 0, R.defileZoneRadius, 0, Math.PI * 2); c.fill();
    c.globalAlpha = .5 * fade;
    c.strokeStyle = '#b08aff'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, R.defileZoneRadius * (.82 + pulse * .12), 0, Math.PI * 2); c.stroke();
    c.restore();
    drawGlow(c, z.x, z.y, R.defileZoneRadius * .8, '#7a4adf', .22 * fade);
  }
  if (e.bossMove === 'summon' && (e.state === 'windup' || e.state === 'attack'))
    drawGlow(c, e.x, e.y - 40, 150, e.attackVariant === 2 ? '#8a5adf' : '#8fd8ff',
      .3 + Math.min(1, e.stateTime / Math.max(.01, e.stateDuration)) * .3);
  if (e.bossMove === 'command' && (e.state === 'windup' || e.state === 'attack'))
    drawGlow(c, e.x, e.y - 35, 130, '#9fe0ff', .32);
}

/** Warning light matching enemyWarningLight's contract for the lighting pass. */
export function raid4BossWarningLight(e: Enemy): PointLight | null {
  const w = raid4BossWarnings(e, 1)[0];
  if (!w) return null;
  return { x: w.x, y: w.y, radius: w.shape.kind === 'circle' ? w.shape.radius * 1.3 : 65,
    color: w.color, power: .12 + w.progress * .3 };
}
