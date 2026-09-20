import { LEGENDARY_PROCS, procKinds, procTrigger, type LegendaryProc, type ProcTrigger } from './legendary-content.ts';
import { damageEnemy, type EnemyDamageContext } from './combat-damage.ts';
import { applyBurn, applyCc, applyDot, applySlow } from './combat-status.ts';
import { projectileDamageType } from './resistance-content.ts';
import { schoolProjectileStyle } from './spell-school.ts';
import { refreshBuffStats } from './player-skill-effects.ts';
import type { ProjectileDefinition } from './combat-content.ts';
import type { Item } from './character-types.ts';
import type { Enemy, HitSnapshot, Player, ProjectileEffects, CombatEvent } from './model.ts';
import type { BuffSpec } from './wow-types.ts';

/**
 * WotLK legendary procs. A landed direct hit (never periodic, ally or
 * proc-sourced damage) rolls each equipped item's procId whose trigger is
 * 'onHit'; damagePlayer rolls 'onBeingHit' procs, skill casts 'onCast' and
 * heals 'onHeal'. Chance first, then the item's own internal cooldown. Proc
 * state lives on player.skillEffects so it dies with the player and clears on
 * unequip (advanceSkillEffects).
 */

/** The slice of a damage context self-targeted procs need: buffs and events. */
export interface ProcContext {
  emit(event: CombatEvent): void;
  addBuff?(name: string, color: string, spec: BuffSpec, id?: string): void;
}

/** Proc damage carries this snapshot so it can crit but can never re-proc. */
const procOffense = (player: Player): HitSnapshot => ({
  proc: true, critChance: player.derived.critChance, critMultiplier: player.derived.critMultiplier,
  lifeOnHit: player.derived.lifeOnHit, directDamageMultiplier: player.derived.directDamageMultiplier ?? 1,
});

/** Equipped items carrying a proc for `trigger`, striking hand first so its roll wins ties. */
function procItems(player: Player, trigger: ProcTrigger): Item[] {
  const items = Object.values(player.character.equipped)
    .filter((item): item is Item => {
      const proc = item?.recipe.procId ? LEGENDARY_PROCS[item.recipe.procId] : undefined;
      return !!item && proc !== undefined && procTrigger(proc) === trigger && procKinds(proc).includes(item.kind);
    });
  const striking = player.attack?.weapon.id;
  return items.sort((a, b) => Number(b.id === striking) - Number(a.id === striking));
}

function grantBuff(player: Player, proc: LegendaryProc, context: ProcContext): void {
  const effect = proc.effect, duration = effect.duration ?? 6;
  const spec: BuffSpec = { duration, stats: effect.stats, absorb: effect.absorb,
    reduction: effect.reduction, healPerSecond: effect.healPerSecond, manaPerSecond: effect.manaPerSecond, leech: effect.leech };
  if (context.addBuff) { context.addBuff(proc.name, '#f0a16b', spec, `proc:${proc.id}`); return; }
  // Headless contexts without the sim's buff owner still get the real buff record.
  const buffs = player.buffs ??= [];
  const existing = buffs.find(buff => buff.id === `proc:${proc.id}`);
  if (existing) { existing.remaining = Math.max(existing.remaining, duration); return; }
  buffs.push({ id: `proc:${proc.id}`, name: proc.name, color: '#f0a16b', remaining: duration, duration,
    stats: spec.stats, absorb: spec.absorb, absorbRemaining: spec.absorb ? player.maxHp * spec.absorb : undefined,
    reduction: spec.reduction, healPerSecond: spec.healPerSecond, manaPerSecond: spec.manaPerSecond, leech: spec.leech });
  if (effect.stats) refreshBuffStats(player);
}

/** Self-targeted procs (buffs, heals, absorbs) — the payload of non-hit triggers. */
function executeSelfProc(player: Player, proc: LegendaryProc, context: ProcContext): void {
  const effect = proc.effect;
  if (effect.kind === 'heal') {
    const healed = Math.min(player.maxHp - player.hp, player.maxHp * (effect.value ?? .05));
    player.hp += healed;
    if (healed > 0) context.emit({ type: 'heal', x: player.x, y: player.y, value: healed });
    if (effect.absorb) grantBuff(player, proc, context);
    return;
  }
  grantBuff(player, proc, context);
}

function executeProc(player: Player, enemy: Enemy, item: Item, proc: LegendaryProc,
  entry: { cooldown: number; stacks: number }, context: EnemyDamageContext): void {
  const effect = proc.effect, weaponDamage = Math.max(1, item.weapon?.damage ?? player.equipment.mainHand.damage);
  const offense = procOffense(player);
  const style = schoolProjectileStyle(effect.school);
  // The elemental portion is the whole payload only for real damage schools.
  const elemental = (amount: number) => style && projectileDamageType(style) !== 'physical' ? amount : undefined;
  const hit = (target: Enemy, amount: number) => { if (target.hp > 0)
    damageEnemy(target, amount, Math.atan2(target.y - player.y, target.x - player.x), false, context, false, style, elemental(amount), offense); };
  // Stacking procs (Shadowmourne) gather a soul per proc and burst at the cap.
  if (effect.stacks) {
    entry.stacks++;
    context.emit({ type: 'chain', x: player.x, y: player.y, toX: enemy.x, toY: enemy.y, style: 'shadow', duration: .3 });
    if (entry.stacks < effect.stacks) return;
    entry.stacks = 0;
  }
  switch (effect.kind) {
    case 'projectile': {
      const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      const effects: ProjectileEffects = { style: style ?? 'arcane', offense,
        ...(effect.burn ? { burnDuration: effect.burn.duration, burnDps: weaponDamage * effect.burn.dps } : {}) };
      const definition: ProjectileDefinition = { owner: 'player', speed: 320, life: 1.2, radius: 5, damage: weaponDamage * (effect.damage ?? 1) };
      if (!context.projectile || !context.projectile(player.x, player.y, angle, definition, effects)) hit(enemy, weaponDamage * (effect.damage ?? 1));
      break;
    }
    case 'aoe': {
      const victims = [enemy, ...context.enemies.filter(near => near !== enemy && near.state !== 'dead'
        && Math.hypot(near.x - enemy.x, near.y - enemy.y) <= (effect.radius ?? 100) + near.radius
        && context.visible(enemy.x, enemy.y, near.x, near.y)).slice(0, effect.chain ?? 8)];
      for (const victim of victims) {
        hit(victim, weaponDamage * (effect.damage ?? 1));
        if (victim.state === 'dead') continue;
        if (effect.slow) applySlow(victim, effect.slow);
        if (effect.exposure) (victim.auraExposure ??= {})[effect.exposure.element] = { power: effect.exposure.power, remaining: effect.exposure.duration };
        if (effect.cc) applyCc(victim, effect.cc.kind, effect.cc.duration);
        if (effect.burn) applyBurn(victim, { duration: effect.burn.duration, dps: weaponDamage * effect.burn.dps });
      }
      context.emit({ type: 'blast', x: enemy.x, y: enemy.y, radius: effect.radius ?? 100, ...(style ? { style } : {}) });
      break;
    }
    case 'buff': {
      if (effect.damage) hit(enemy, weaponDamage * effect.damage);
      executeSelfProc(player, proc, context);
      break;
    }
    case 'debuff': {
      if (effect.damage) hit(enemy, weaponDamage * effect.damage);
      if (enemy.state !== 'dead') {
        if (effect.slow) applySlow(enemy, effect.slow);
        if (effect.cc) applyCc(enemy, effect.cc.kind, effect.cc.duration);
        if (effect.exposure) (enemy.auraExposure ??= {})[effect.exposure.element] = { power: effect.exposure.power, remaining: effect.exposure.duration };
      }
      break;
    }
    case 'dot': {
      applyDot(enemy, `proc:${proc.id}`, { school: effect.school ?? 'shadow', flatDps: weaponDamage * (effect.dps ?? .2), duration: effect.duration ?? 5 }, weaponDamage);
      break;
    }
    case 'heal': {
      executeSelfProc(player, proc, context);
      break;
    }
  }
}

let resolvingProc = false;

/** One roll per equipped 'onHit' proc item per landed direct hit; icd is per item. */
export function tryProc(player: Player, enemy: Enemy, context: EnemyDamageContext): void {
  if (resolvingProc || player.dead) return;
  resolvingProc = true;
  try {
    for (const item of procItems(player, 'onHit')) {
      const proc = LEGENDARY_PROCS[item.recipe.procId!]!;
      const entry = ((player.skillEffects ??= { echoes: [] }).procs ??= {})[item.id] ??= { cooldown: 0, stacks: 0 };
      if (entry.cooldown > 0 || context.random() >= proc.chance) continue;
      entry.cooldown = proc.internalCooldown;
      executeProc(player, enemy, item, proc, entry, context);
    }
  } finally {
    resolvingProc = false;
  }
}

/** Rolls equipped procs for a non-hit trigger (being hit, casting, healing).
 * Self-targeted effects only — buffs, heals and absorbs; icd is per item. */
export function tryTriggerProc(player: Player, trigger: Exclude<ProcTrigger, 'onHit'>, context: ProcContext & { random(): number }): void {
  if (resolvingProc || player.dead) return;
  resolvingProc = true;
  try {
    for (const item of procItems(player, trigger)) {
      const proc = LEGENDARY_PROCS[item.recipe.procId!]!;
      const entry = ((player.skillEffects ??= { echoes: [] }).procs ??= {})[item.id] ??= { cooldown: 0, stacks: 0 };
      if (entry.cooldown > 0 || context.random() >= proc.chance) continue;
      entry.cooldown = proc.internalCooldown;
      executeSelfProc(player, proc, context);
    }
  } finally {
    resolvingProc = false;
  }
}

/** Defensive procs roll when the player takes a hit (damagePlayer). */
export function tryDefensiveProc(player: Player, context: ProcContext & { random(): number }): void {
  tryTriggerProc(player, 'onBeingHit', context);
}
