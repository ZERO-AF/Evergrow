import type { DamageType } from './model.ts';
import type { CcKind, DotSchool } from './wow-types.ts';
import { STATUS_RULES, applyCc } from './combat-status.ts';
import type { Combatant } from './pvp-combatant.ts';

/** What crowd control currently does to a combatant, read each tick by the sim
 * (input sanitization) and the AI (it never sees a suppressed action). */
export interface CombatantControl {
  /** Stun/freeze/incapacitate/polymorph/fear: no actions at all. */
  readonly cantAct: boolean;
  /** Rooted: movement input is zeroed. */
  readonly rooted: boolean;
  /** Silenced: skill input is dropped (basics, dodge and potions still work). */
  readonly silenced: boolean;
  /** Feared: no actions and a deterministic wander replaces movement input. */
  readonly feared: boolean;
  /** Net movement multiplier (slow effects), 1 when unhindered. */
  readonly moveFactor: number;
}

const CANT_ACT: readonly CcKind[] = ['stun', 'freeze', 'incapacitate', 'polymorph'];

/** Reads the live CC fields; safe to call any time, never mutates. */
export function combatantControl(combatant: Combatant): CombatantControl {
  const cc = combatant.cc ?? [];
  const has = (kind: CcKind) => cc.some(effect => effect.kind === kind && effect.remaining > 0);
  const feared = has('fear');
  const cantAct = feared || (combatant.stunTime ?? 0) > 0 || (combatant.freezeTime ?? 0) > 0 || CANT_ACT.some(has);
  const rooted = has('root');
  const silenced = has('silence');
  const ccSlow = cc.filter(effect => effect.kind === 'slow' && effect.remaining > 0)
    .reduce((factor, effect) => Math.min(factor, effect.factor ?? .5), 1);
  const moveFactor = Math.min(combatant.slowTime > 0 ? combatant.slowFactor : 1, ccSlow);
  return { cantAct, rooted, silenced, feared, moveFactor };
}

/** Dot schools map onto the combatant's armor/resistance table. */
function dotDamageType(school: DotSchool): DamageType {
  if (school === 'bleed') return 'physical';
  if (school === 'poison') return 'nature';
  return school as DamageType;
}

/**
 * The combatant-side mirror of advanceEnemyStatuses (combat-status.ts): ticks
 * dots, burn, slows, CC timers, DR windows, sunder and taunt on a Player-shaped
 * actor. Enemy-AI coupling (state clocks, interruptStaggeredEnemy, vx zeroing)
 * is replaced by the returned CombatantControl flags, which the sim applies to
 * the combatant's synthesized input. Periodic damage routes through `damage`
 * (sim.damageCombatant) so ticks respect armor/resist/absorbs.
 */
export function advanceCombatantStatuses(
  combatant: Combatant,
  dt: number,
  damage: (combatant: Combatant, amount: number, damageType: DamageType) => void,
): CombatantControl {
  const c = combatant;
  if (c.dead) return { cantAct: true, rooted: true, silenced: true, feared: false, moveFactor: 0 };
  c.freezeTime = Math.max(0, (c.freezeTime ?? 0) - dt);
  c.stunTime = Math.max(0, (c.stunTime ?? 0) - dt);
  c.controlImmunity = Math.max(0, (c.controlImmunity ?? 0) - dt);
  c.reactionCooldown = Math.max(0, (c.reactionCooldown ?? 0) - dt);
  c.chillTime = Math.max(0, (c.chillTime ?? 0) - dt);
  c.fractureTime = Math.max(0, (c.fractureTime ?? 0) - dt);
  c.ccImmunity = Math.max(0, (c.ccImmunity ?? 0) - dt);
  if (c.ccDiminishedUntil) for (const [kind, left] of Object.entries(c.ccDiminishedUntil) as [CcKind, number][]) {
    const next = left - dt;
    if (next <= 0) { delete c.ccDiminishedUntil[kind]; delete c.ccDiminished?.[kind]; }
    else c.ccDiminishedUntil[kind] = next;
  }
  if (c.slowTime > 0) c.slowTime = Math.max(0, c.slowTime - dt);
  if (c.slowTime <= 0) c.slowFactor = 1;
  if (c.burnTime > 0) {
    c.burnTick += Math.min(dt, c.burnTime);
    const remainingBurn = c.burnTime - dt;
    c.burnTime = remainingBurn > 1e-9 ? remainingBurn : 0;
    if (c.burnTick > 1e-9 && (c.burnTick + 1e-9 >= STATUS_RULES.burnInterval || c.burnTime <= 0)) {
      damage(c, c.burnDps * c.burnTick, 'fire');
      c.burnTick = 0;
    }
    if (c.burnTime <= 0) c.burnDps = 0;
  }
  if (c.dots) {
    for (const dot of c.dots) {
      dot.tick += Math.min(dt, dot.remaining);
      dot.remaining = Math.max(0, dot.remaining - dt);
      if (dot.tick > 1e-9 && (dot.tick + 1e-9 >= dot.interval || dot.remaining <= 0)) {
        damage(c, dot.dps * dot.tick, dotDamageType(dot.school));
        dot.tick = 0;
        if (dot.ramp) dot.dps *= 1 + dot.ramp;
      }
    }
    c.dots = c.dots.filter(dot => dot.remaining > 0);
    if (!c.dots.length) c.dots = undefined;
  }
  if (c.cc) {
    for (const effect of c.cc) effect.remaining = Math.max(0, effect.remaining - dt);
    c.cc = c.cc.filter(effect => effect.remaining > 0);
    if (!c.cc.length) c.cc = undefined;
  }
  if (c.sundered) {
    c.sundered.remaining = Math.max(0, c.sundered.remaining - dt);
    if (c.sundered.remaining <= 0) delete c.sundered;
  }
  if (c.taunted) {
    c.taunted.remaining = Math.max(0, c.taunted.remaining - dt);
    if (c.taunted.remaining <= 0) delete c.taunted;
  }
  const control = combatantControl(c);
  // Hard control cancels channels/casts and any attack swing already in flight.
  if ((control.cantAct || control.silenced) && c.cast) c.cast = null;
  if (control.cantAct) c.attack = null;
  return control;
}

/** Sanitizes a combatant's input for its current control state. Feared actors
 * wander on a deterministic per-combatant heading; everyone else keeps aim. */
export function sanitizeCombatantInput<T extends { moveX: number; moveY: number; attack: boolean; dodge: boolean; heal: boolean; skillSlot: number | null }>(
  combatant: Combatant, input: T, control: CombatantControl,
): T {
  if (control.feared) {
    const angle = combatant.id * 2.399963 + combatant.stateTime * 1.7;
    input.moveX = Math.cos(angle); input.moveY = Math.sin(angle);
  } else if (control.cantAct || control.rooted) {
    input.moveX = 0; input.moveY = 0;
  }
  if (control.cantAct || control.feared) { input.attack = false; input.dodge = false; input.heal = false; input.skillSlot = null; }
  else if (control.silenced) input.skillSlot = null;
  return input;
}

/** Applies a CC effect to a combatant, honoring the shared DR table. The enemy
 * applyCc path already handles every kind for combatants (they satisfy Enemy);
 * this wrapper adds the player-side cast interruption WoW expects. */
export function applyCombatantCc(combatant: Combatant, kind: CcKind, duration: number, breakOnDamage?: boolean, factor?: number): void {
  applyCc(combatant, kind, duration, breakOnDamage, factor);
  if (kind !== 'root' && kind !== 'slow') combatant.cast = null;
}
