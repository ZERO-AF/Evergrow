import { isBossKind } from './wilderness-boss-content.ts';
import { enemyThreat } from './enemy-threat.ts';
import type { Enemy, ProjectileStyle } from './model.ts';
import { interruptStaggeredEnemy } from './enemy-state.ts';
import type { CcKind, DotSchool, DotSpec } from './wow-types.ts';
import { applyEnemyBuff } from './enemy-buffs.ts';

export { applyEnemyBuff, dispelEnemyBuffs, enemyBuffDamageMultiplier, enemyHasteFactor,
  absorbEnemyHit, enemySpawnBuffs, stolenBuffSpec, ENEMY_BUFFS, ENEMY_SPAWN_BUFFS, ENEMY_COMBAT_BUFFS } from './enemy-buffs.ts';

/** Elites enrage once when wounded below this fraction (WoW enrage). */
export const ENRAGE_RULES = Object.freeze({ threshold: .35 });

export interface SlowEffect { readonly duration: number; readonly factor: number }
export interface BurnEffect { readonly duration: number; readonly dps: number }
export const STATUS_RULES = Object.freeze({ burnInterval: .5, detonateRadius: 120 });

/** WoW diminishing returns: repeated control within a 15s window halves duration
 * (100% → 50% → 25% → immune). Normal/veteran ranks only; elite/boss keep their
 * existing controlImmunity scaling on top. */
export const DIMINISHING_RULES = Object.freeze({ window: 15, minimum: .25, immuneAt: 3 });
const DIMINISHED_KINDS: Record<CcKind, true | undefined> = { root: true, fear: true, incapacitate: true, polymorph: true, stun: true, freeze: true, silence: true, slow: undefined };

/** Returns the DR-scaled duration; 0 means the target is currently immune. */
function diminished(enemy: Enemy, kind: CcKind, duration: number): number {
  if (!DIMINISHED_KINDS[kind] || (enemy.rank !== 'normal' && enemy.rank !== 'veteran')) return duration;
  const windows = enemy.ccDiminishedUntil ??= {};
  if ((windows[kind] ?? 0) <= 0) delete (enemy.ccDiminished ??= {})[kind];
  const count = enemy.ccDiminished?.[kind] ?? 0;
  (enemy.ccDiminished ??= {})[kind] = count + 1;
  windows[kind] = DIMINISHING_RULES.window;
  if (count >= DIMINISHING_RULES.immuneAt) return 0;
  return duration * Math.max(DIMINISHING_RULES.minimum, Math.pow(.5, count));
}

/** Reapplication retains the strongest value and longest remaining duration;
 * it does not add stacks or restart the accrued burn tick. Dead targets ignore effects. */
export function applySlow(enemy: Enemy, effect: SlowEffect): void {
  if (enemy.state === 'dead') return;
  if (isBossKind(enemy.kind)) effect = { duration: effect.duration * .5, factor: Math.max(.65, effect.factor) };
  if (effect.duration >= enemy.slowTime) (enemy.statusDurations ??= {}).slow = effect.duration;
  enemy.slowTime = Math.max(enemy.slowTime, effect.duration);
  enemy.slowFactor = Math.min(enemy.slowFactor, effect.factor);
}
export function applyBurn(enemy: Enemy, effect: BurnEffect): void {
  if (enemy.state === 'dead') return;
  if (effect.duration >= enemy.burnTime) (enemy.statusDurations ??= {}).burn = effect.duration;
  enemy.burnTime = Math.max(enemy.burnTime, effect.duration);
  enemy.burnDps = Math.max(enemy.burnDps, effect.dps);
}
export function applyStun(enemy: Enemy, duration: number, kind: 'stun' | 'freeze' | 'stagger' = 'stun'): void {
  if (enemy.state === 'dead' || !Number.isFinite(duration) || duration <= 0) return;
  if (kind !== 'stagger') {
    duration = diminished(enemy, kind, duration);
    if (duration <= 0) return;
  }
  const threat = enemyThreat(enemy);
  if (threat.controlRest > 0) {
    if ((enemy.controlImmunity ?? 0) > 0) return;
    duration = Math.min(threat.controlMaximum, duration * threat.controlFactor);
    enemy.controlImmunity = duration + threat.controlRest;
  }
  // Bosses resist via the threat controlMaximum cap above; no extra halving here.
  if (duration >= enemy.stagger) (enemy.statusDurations ??= {}).stagger = duration;
  enemy.stagger = Math.max(enemy.stagger, duration); enemy.interrupted = true;
  if (kind === 'freeze') {
    if (duration >= (enemy.freezeTime ?? 0)) (enemy.statusDurations ??= {}).freeze = duration;
    enemy.freezeTime = Math.max(enemy.freezeTime ?? 0, duration);
  }
  if (kind === 'stun') {
    if (duration >= (enemy.stunTime ?? 0)) (enemy.statusDurations ??= {}).stun = duration;
    enemy.stunTime = Math.max(enemy.stunTime ?? 0, duration);
  }
}

/** WoW DoT application: non-stacking per id, strongest/longest wins (burn rule). */
export function applyDot(enemy: Enemy, id: string, spec: DotSpec, baseDamage: number, source: 'player' | 'ally' = 'player', allyId?: number, playerId?: number): void {
  if (enemy.state === 'dead') return;
  const dps = spec.flatDps ?? baseDamage * (spec.dpsMultiplier ?? 0);
  if (dps <= 0 || spec.duration <= 0) return;
  const dots = enemy.dots ??= [];
  const existing = dots.find(dot => dot.id === id);
  if (existing) {
    if (dps >= existing.dps || spec.duration >= existing.remaining) {
      existing.dps = Math.max(existing.dps, dps);
      existing.remaining = Math.max(existing.remaining, spec.duration);
    }
    return;
  }
  dots.push({ id, school: spec.school, dps, remaining: spec.duration, tick: 0,
    interval: spec.interval ?? STATUS_RULES.burnInterval, ramp: spec.ramp, detonate: spec.detonate, source,
    ...(source === 'ally' && allyId !== undefined ? { allyId } : {}),
    ...(source === 'player' && playerId !== undefined ? { playerId } : {}) });
}

/** WoW crowd control: root/fear/incapacitate/polymorph/silence ride enemy.cc; stun/freeze/slow reuse the legacy fields. */
export function applyCc(enemy: Enemy, kind: CcKind, duration: number, breakOnDamage = kind === 'incapacitate' || kind === 'polymorph', factor?: number): void {
  if (enemy.state === 'dead' || !Number.isFinite(duration) || duration <= 0) return;
  // Stun/freeze/slow delegate to their own owners, which apply DR, threat and
  // boss scaling themselves — do not pre-diminish here or they double-diminish.
  if (kind === 'stun' || kind === 'freeze') { applyStun(enemy, duration, kind); return; }
  if (kind === 'slow') { applySlow(enemy, { duration, factor: factor ?? .5 }); return; }
  duration = diminished(enemy, kind, duration);
  if (duration <= 0) return;
  const threat = enemyThreat(enemy);
  if (threat.controlRest > 0) {
    if ((enemy.controlImmunity ?? 0) > 0) return;
    duration = Math.min(threat.controlMaximum, duration * threat.controlFactor);
    enemy.controlImmunity = duration + threat.controlRest;
  }
  if (isBossKind(enemy.kind)) duration *= .5;
  const cc = enemy.cc ??= [];
  const existing = cc.find(effect => effect.kind === kind);
  if (existing) { existing.remaining = Math.max(existing.remaining, duration); return; }
  cc.push({ kind, remaining: duration, breakOnDamage, factor });
  // Incapacitating control and silence interrupt a windup in progress.
  if (kind !== 'root') { enemy.interrupted = true; interruptStaggeredEnemy(enemy); }
}

/** Sunder/expose: refreshes to the strongest fraction and longest duration. */
export function applySunder(enemy: Enemy, fraction: number, duration: number): void {
  if (enemy.state === 'dead' || fraction <= 0 || duration <= 0) return;
  const sundered = enemy.sundered ??= { fraction: 0, remaining: 0 };
  sundered.fraction = Math.max(sundered.fraction, fraction);
  sundered.remaining = Math.max(sundered.remaining, duration);
}

/** Damage strips break-on-damage control (incapacitate/polymorph and flagged roots). */
export function breakCcOnDamage(enemy: Enemy): void {
  if (enemy.cc?.some(effect => effect.breakOnDamage)) enemy.cc = enemy.cc.filter(effect => !effect.breakOnDamage);
}

/** Run after state time advances and before AI. False suppresses this tick's AI. */
export function advanceEnemyStatuses(enemy: Enemy, dt: number, damage: (enemy: Enemy, amount: number, school?: DotSchool) => void): boolean {
  if (enemy.state === 'dead') return false;
  enemy.freezeTime = Math.max(0, (enemy.freezeTime ?? 0) - dt);
  enemy.stunTime = Math.max(0, (enemy.stunTime ?? 0) - dt);
  enemy.controlImmunity = Math.max(0, (enemy.controlImmunity ?? 0) - dt);
  enemy.reactionCooldown = Math.max(0, (enemy.reactionCooldown ?? 0) - dt);
  enemy.chillTime = Math.max(0, (enemy.chillTime ?? 0) - dt);
  enemy.fractureTime = Math.max(0, (enemy.fractureTime ?? 0) - dt);
  if (enemy.ccDiminishedUntil) for (const [kind, left] of Object.entries(enemy.ccDiminishedUntil) as [CcKind, number][]) {
    const next = left - dt;
    if (next <= 0) { delete enemy.ccDiminishedUntil[kind]; delete enemy.ccDiminished?.[kind]; }
    else enemy.ccDiminishedUntil[kind] = next;
  }
  if (enemy.slowTime > 0) enemy.slowTime = Math.max(0, enemy.slowTime - dt);
  if (enemy.slowTime <= 0) enemy.slowFactor = 1;
  // Burn intentionally stays on its own fields in parallel with enemy.dots:
  // elemental-reaction.ts consumes/clears burnTime for Overload & Combustion,
  // renderer.ts reads it for the burning visual, and enemy-debuffs.ts renders the
  // authored Burn row — none of those read dots. Migrating burn into dots
  // (wow-transformation §3) is a cross-module cutover, not a local change.
  if (enemy.burnTime > 0) {
    enemy.burnTick += Math.min(dt, enemy.burnTime);
    const remainingBurn = enemy.burnTime - dt;
    enemy.burnTime = remainingBurn > 1e-9 ? remainingBurn : 0;
    if (enemy.burnTick > 1e-9 && (enemy.burnTick + 1e-9 >= STATUS_RULES.burnInterval || enemy.burnTime <= 0)) {
      damage(enemy, enemy.burnDps * enemy.burnTick, 'fire');
      enemy.burnTick = 0;
    }
    if (enemy.burnTime <= 0) enemy.burnDps = 0;
  }
  if (enemy.dots) {
    for (const dot of enemy.dots) {
      dot.tick += Math.min(dt, dot.remaining);
      dot.remaining = Math.max(0, dot.remaining - dt);
      if (dot.tick > 1e-9 && (dot.tick + 1e-9 >= dot.interval || dot.remaining <= 0)) {
        damage(enemy, dot.dps * dot.tick, dot.school);
        dot.tick = 0;
        if (dot.ramp) dot.dps *= 1 + dot.ramp;
      }
      // Detonate pays a fraction of the dot's UNPAID damage (dps × remaining) when it is
      // removed early — host death or a consume effect. At natural expiry remaining is 0,
      // so there is no bonus on top of the ticks already dealt.
    }
    enemy.dots = enemy.dots.filter(dot => dot.remaining > 0);
  }
  if (enemy.cc) {
    for (const effect of enemy.cc) effect.remaining = Math.max(0, effect.remaining - dt);
    enemy.cc = enemy.cc.filter(effect => effect.remaining > 0);
  }
  if (enemy.sundered) {
    enemy.sundered.remaining = Math.max(0, enemy.sundered.remaining - dt);
    if (enemy.sundered.remaining <= 0) delete enemy.sundered;
  }
  if (enemy.taunted) {
    enemy.taunted.remaining = Math.max(0, enemy.taunted.remaining - dt);
    if (enemy.taunted.remaining <= 0) delete enemy.taunted;
  }
  if (enemy.buffs) {
    for (const buff of enemy.buffs) buff.remaining = Math.max(0, buff.remaining - dt);
    enemy.buffs = enemy.buffs.filter(buff => buff.remaining > 0);
    if (!enemy.buffs.length) delete enemy.buffs;
  }
  // WoW enrage: wounded elites flare once; a purge removes it for good.
  if (!enemy.enrageUsed && (enemy.rank === 'elite' || enemy.rank === 'rare') && !isBossKind(enemy.kind)
    && enemy.hp > 0 && enemy.hp <= enemy.maxHp * ENRAGE_RULES.threshold) {
    enemy.enrageUsed = true;
    applyEnemyBuff(enemy, 'enrage');
  }
  if (enemy.cc?.some(effect => effect.kind === 'incapacitate' || effect.kind === 'polymorph' || effect.kind === 'stun' || effect.kind === 'freeze')) {
    // Can't-act control suppresses this tick's AI entirely.
    enemy.stateTime = Math.max(0, enemy.stateTime - dt);
    enemy.vx = enemy.vy = 0;
    return false;
  }
  if (enemy.stagger > 0) {
    // The clock advanced before statuses; a frozen/staggered actor cannot spend
    // its recovery while control is suppressing the AI.
    enemy.stateTime = Math.max(0, enemy.stateTime - dt);
    interruptStaggeredEnemy(enemy);
    enemy.stagger = Math.max(0, enemy.stagger - dt);
    enemy.vx = enemy.vy = 0;
    return false;
  }
  return true;
}

/** Elemental contacts share one non-stacking status rule across weapons and spells. */
export const ELEMENTAL_CONTACT = Object.freeze({ burnDuration: 2, burnFractionPerSecond: .15, chillDuration: 1.5, chillFactor: .8, lightningInterrupt: .12 });
export function applyElementalContact(enemy: Enemy, style: ProjectileStyle | undefined, damage: number): void {
  if (damage <= 0 || !Number.isFinite(damage) || enemy.state === 'dead') return;
  if (style === 'fire') applyBurn(enemy, { duration: ELEMENTAL_CONTACT.burnDuration, dps: damage * ELEMENTAL_CONTACT.burnFractionPerSecond });
  else if (style === 'frost') {
    applySlow(enemy, { duration: ELEMENTAL_CONTACT.chillDuration, factor: ELEMENTAL_CONTACT.chillFactor });
    if (ELEMENTAL_CONTACT.chillDuration >= (enemy.chillTime ?? 0)) (enemy.statusDurations ??= {}).chill = ELEMENTAL_CONTACT.chillDuration;
    enemy.chillTime = Math.max(enemy.chillTime ?? 0, ELEMENTAL_CONTACT.chillDuration);
  }
  else if (style === 'lightning') applyStun(enemy, ELEMENTAL_CONTACT.lightningInterrupt, 'stagger');
}
