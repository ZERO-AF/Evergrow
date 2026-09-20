import { riftWardActive } from './rift-tactics.ts';
import { RIFT_TACTICS } from './rift-encounters.ts';
import { auraPower, bloodOathHit, resonanceHit } from './auras.ts';
import type { WardBurst } from './unique-combat.ts';
import { storeBastion } from './unique-combat.ts';
import { mitigateSkillHit } from './player-skill-effects.ts';
import { projectileDamageType } from './resistance-content.ts';
import { metric } from './chronicle.ts';
import { primeSpellweave, primeAfterguard, effectiveArmor } from './affix-combat.ts';
import { applyElementalContact, applyStun, breakCcOnDamage, STATUS_RULES } from './combat-status.ts';
import { resolveElementalReaction, ELEMENTAL_REACTION_RULES } from './elemental-reaction.ts';
import { schoolProjectileStyle } from './spell-school.ts';
import { enemyThreat } from './enemy-threat.ts';
import type { HitSnapshot, CombatEvent, Enemy, EnemyKind, Player, Projectile, ProjectileEffects, ProjectileStyle, WorldQuery, DamageType } from './model.ts';
import type { ProjectileDefinition } from './combat-content.ts';
import type { BuffSpec } from './wow-types.ts';
import { COMBAT_TIMING, ENEMY_DEFINITIONS } from './combat-content.ts';
import { ENCOUNTER_RULES } from './encounter-director.ts';
import { armorReduction } from './progression-content.ts';
import { alertEnemy, transitionEnemy, interruptStaggeredEnemy } from './enemy-state.ts';
import { resourceModelOf } from './player-skill-effects.ts';
import { demonFamilyForAlly } from './pet-content.ts';

export interface EnemyDamageContext {
  player: Player; enemies: readonly Enemy[];
  random(): number; visible(ax: number, ay: number, bx: number, by: number): boolean;
  emit(event: CombatEvent): void; killed(enemy: Enemy): void;
  /** Optional owners legendary procs borrow: projectile launches and player buffs. */
  projectile?(x: number, y: number, angle: number, definition: ProjectileDefinition, effects?: ProjectileEffects): Projectile | undefined;
  addBuff?(name: string, color: string, spec: BuffSpec, id?: string): void;
  /** Legendary 'onHit' proc roll, injected by the simulation to avoid a combat-damage import cycle. */
  proc?(player: Player, enemy: Enemy, context: EnemyDamageContext): void;
}
export interface PlayerDamageContext {
  wardBurst?(burst:WardBurst):void;
  player: Player; world: Pick<WorldQuery, 'isSanctuary'>;
  random(): number; emit(event: CombatEvent): void;
  /** Optional buff owner legendary defensive procs borrow (same shape as EnemyDamageContext.addBuff). */
  addBuff?(name: string, color: string, spec: BuffSpec, id?: string): void;
  /** Legendary 'onBeingHit' proc roll, injected by the simulation to avoid a combat-damage import cycle. */
  defensiveProc?(player: Player, context: PlayerDamageContext): void;
}

/** One contact owner: damage, awareness, impulse, interruption and death commitment. */
export function damageEnemy(enemy: Enemy, damage: number, angle: number, melee: boolean,
  context: EnemyDamageContext, periodic = false, style?: ProjectileStyle, elementalDamage?: number, offense?: HitSnapshot, authoredBurn = false): void {
  if (enemy.state === 'dead') return;
  if(riftWardActive(enemy,context.visible)){damage*=1-RIFT_TACTICS.wardReduction;if(elementalDamage!==undefined)elementalDamage*=1-RIFT_TACTICS.wardReduction;}
  if(!periodic){const oath=bloodOathHit(context.player,enemy,melee);damage*=oath;if(elementalDamage!==undefined)elementalDamage*=oath;}
  const exposure=resonanceHit(context.player,enemy,style,periodic);
  if(elementalDamage!==undefined){damage+=elementalDamage*(exposure-1);elementalDamage*=exposure;}else damage*=exposure;
  if(enemy.sundered&&enemy.sundered.remaining>0){damage*=1+enemy.sundered.fraction;if(elementalDamage!==undefined)elementalDamage*=1+enemy.sundered.fraction;}
  if (!periodic) {
    alertEnemy(enemy, context.player);
    // A camp shares danger only with nearby members who can see the struck ally.
    if (enemy.campId) for (const ally of context.enemies) if (ally !== enemy && ally.campId === enemy.campId
      && ally.state !== 'dead' && Math.hypot(ally.x - enemy.x, ally.y - enemy.y) < 190
      && context.visible(ally.x, ally.y, enemy.x, enemy.y)) alertEnemy(ally, context.player);
  }
  // Contact status uses the elemental portion, never physical damage or recursive burn ticks.
  const statusDamage = elementalDamage ?? (style === 'fire' || style === 'frost' || style === 'lightning' || style === 'arcane' || style === 'spirit' ? damage : 0);
  const elementKind = (elementalDamage && elementalDamage > 0) ? (style ?? 'fire') : style;
  const reaction = !periodic ? resolveElementalReaction(enemy, elementKind, statusDamage) : null;
  if (reaction) {
    damage *= reaction.damageMultiplier;
    if (elementalDamage !== undefined) elementalDamage *= reaction.damageMultiplier;
    if (reaction.type === 'overload' && reaction.radius) {
      context.emit({ type: 'blast', x: enemy.x, y: enemy.y, radius: reaction.radius, color: reaction.color, reaction: 'overload' });
      for (const other of context.enemies) {
        if (other !== enemy && other.state !== 'dead' && Math.hypot(other.x - enemy.x, other.y - enemy.y) <= reaction.radius) {
          const pushAngle = Math.atan2(other.y - enemy.y, other.x - enemy.x);
          other.knockbackX += Math.cos(pushAngle) * 85 / COMBAT_TIMING.knockbackDecay;
          other.knockbackY += Math.sin(pushAngle) * 85 / COMBAT_TIMING.knockbackDecay;
          other.hp = Math.max(0, other.hp - Math.round(statusDamage * ELEMENTAL_REACTION_RULES.overloadBaseDamageFraction));
          // Chain Reaction / Cascade: Overload blast hitting Chilled/Frozen foes triggers Superconduct Cascade
          const otherHasFrost = ((other.chillTime ?? 0) > 0) || ((other.freezeTime ?? 0) > 0);
          if (otherHasFrost) {
            (other.statusDurations ??= {}).fracture = ELEMENTAL_REACTION_RULES.superconductDuration;
            other.fractureTime = Math.max(other.fractureTime ?? 0, ELEMENTAL_REACTION_RULES.superconductDuration);
            other.stagger = Math.max(other.stagger, other.stagger + ELEMENTAL_REACTION_RULES.superconductStaggerBonus);
            context.emit({ type: 'chain', x: enemy.x, y: enemy.y, toX: other.x, toY: other.y, duration: 0.28, style: 'lightning', color: '#67e8f9', reaction: 'cascade' });
            context.emit({ type: 'hit', actualValue: Math.round(statusDamage * 0.3), angle: pushAngle, value: Math.round(statusDamage * 0.3), targetId: other.id, remainingHp: other.hp, enemyKind: other.kind, heavy: true, reaction: 'cascade', color: '#67e8f9', x: other.x, y: other.y });
          }
        }
      }
    } else if (reaction.type === 'singularity' && reaction.pullRadius) {
      context.emit({ type: 'blast', x: enemy.x, y: enemy.y, radius: reaction.pullRadius, color: reaction.color, reaction: 'singularity' });
      for (const other of context.enemies) {
        if (other !== enemy && other.state !== 'dead') {
          const dist = Math.hypot(enemy.x - other.x, enemy.y - other.y);
          if (dist <= reaction.pullRadius) {
            const pullAngle = Math.atan2(enemy.y - other.y, enemy.x - other.x);
            const pullForce = Math.min(130, 240 * (1 - dist / reaction.pullRadius));
            other.knockbackX += Math.cos(pullAngle) * pullForce / COMBAT_TIMING.knockbackDecay;
            other.knockbackY += Math.sin(pullAngle) * pullForce / COMBAT_TIMING.knockbackDecay;
            applyStun(other, ELEMENTAL_REACTION_RULES.singularityStaggerDuration, 'stagger');
            other.hp = Math.max(0, other.hp - Math.round(statusDamage * 0.45));
          }
        }
      }
    } else if (reaction.type === 'combustion' && reaction.radius) {
      context.emit({ type: 'blast', x: enemy.x, y: enemy.y, radius: reaction.radius, color: reaction.color, reaction: 'combustion' });
      for (const other of context.enemies) {
        if (other !== enemy && other.state !== 'dead' && Math.hypot(other.x - enemy.x, other.y - enemy.y) <= reaction.radius) {
          applyElementalContact(other, 'fire', statusDamage * 0.6);
          other.hp = Math.max(0, other.hp - Math.round(statusDamage * 0.4));
        }
      }
    }
  }
  if (!periodic) primeSpellweave(context.player, melee, style);
  if (!periodic && !(style === 'fire' && authoredBurn)) applyElementalContact(enemy, style, statusDamage);
  const elementFraction=style && projectileDamageType(style)==='arcane'?1:Math.min(1,Math.max(0,statusDamage/Math.max(1,damage)));
  const hitStats = offense ?? context.player.derived;
  const critical = !periodic && hitStats.critChance > 0 && context.random() < hitStats.critChance;
  damage = Math.max(1, Math.round(damage * (critical ? hitStats.critMultiplier : 1) * (periodic ? 1 : hitStats.directDamageMultiplier ?? 1)));
  const actualValue = Math.min(enemy.hp, damage);
  enemy.hp = Math.max(0, enemy.hp - damage);
  breakCcOnDamage(enemy);
  const resource = resourceModelOf(context.player);
  if (!periodic && !offense?.skill && !offense?.ally && resource && resource.gainOnDeal > 0) context.player.mana = Math.min(context.player.maxMana, context.player.mana + resource.gainOnDeal);
  // Pet hits neither grant the player rage nor break stealth (WoW pet semantics).
  if (!periodic && !offense?.ally && context.player.stealthed) { context.player.stealthed = false; context.player.buffs = context.player.buffs?.filter(buff => !buff.stealth); }
  if (!context.player.dead) for (const buff of context.player.buffs ?? []) if (buff.leech) context.player.hp = Math.min(context.player.maxHp, context.player.hp + damage * buff.leech);
  if (!periodic && !context.player.dead) metric(context.player.chronicle,'healing',Math.min(context.player.maxHp-context.player.hp,hitStats.lifeOnHit));
  if (!periodic && !context.player.dead) context.player.hp = Math.min(context.player.maxHp, context.player.hp + hitStats.lifeOnHit);
  enemy.hitFlash = COMBAT_TIMING.hitFlashDuration;
  enemy.hitAngle = angle;
  const definition = ENEMY_DEFINITIONS[enemy.kind];
  const shove = definition.knockbackDistance * enemyThreat(enemy).knockback;
  if (!periodic) {
    enemy.knockbackX += Math.cos(angle) * shove / COMBAT_TIMING.knockbackDecay;
    enemy.knockbackY += Math.sin(angle) * shove / COMBAT_TIMING.knockbackDecay;
  }
  context.emit({ ...(style ? { style } : {}), type: 'hit', actualValue, elementalValue:actualValue*elementFraction, melee, periodic, ...(offense?.skill?{skill:offense.skill}:{}), ...(reaction ? { reaction: reaction.type, color: reaction.color } : {}), x: enemy.x, y: enemy.y, angle, value: damage,
    targetId: enemy.id, remainingHp: enemy.hp, enemyKind: enemy.kind, heavy: critical || !!reaction });
  // Legendary weapon procs roll on direct player hits only — never on periodic
  // ticks, ally strikes or proc-sourced damage (offense.proc guards recursion).
  if (!periodic && !offense?.ally && !offense?.proc) context.proc?.(context.player, enemy, context);
  if (enemy.hp <= 0) {
    // A legendary proc may have committed this kill inside tryProc already.
    if ((enemy.state as Enemy['state']) === 'dead') return;
    // Detonating dots (Living Bomb, Seed of Corruption) burst on early host death for a
    // fraction of their unpaid damage, splashing onto nearby enemies — WoW behaviour.
    for (const dot of enemy.dots ?? []) {
      if (!dot.detonate || dot.remaining <= 0) continue;
      const burst = dot.detonate * dot.dps * dot.remaining;
      for (const near of context.enemies) if (near !== enemy && near.state !== 'dead'
        && Math.hypot(near.x - enemy.x, near.y - enemy.y) <= STATUS_RULES.detonateRadius + near.radius)
        damageEnemy(near, burst, Math.atan2(near.y - enemy.y, near.x - enemy.x), false, context, true, schoolProjectileStyle(dot.school));
    }
    transitionEnemy(enemy, 'dead', ENCOUNTER_RULES.corpseDuration);
    context.killed(enemy);
    context.emit({ ...(style ? { style } : {}), type: 'kill', x: enemy.x, y: enemy.y, angle, facing: enemy.angle,
      targetId: enemy.id, remainingHp: 0, enemyKind: enemy.kind });
  } else if (definition.interruptible && melee) {
    applyStun(enemy, COMBAT_TIMING.staggerDuration, 'stagger');
    interruptStaggeredEnemy(enemy);
  }
}

/** Returns whether damage landed; the clock owner handles input/fixed-step cancellation. */
export function damagePlayer(amount: number, angle: number, sourceLevel: number, damageType: DamageType, context: PlayerDamageContext, kind?: EnemyKind): boolean {
  const p = context.player;
  if (p.dead || p.invulnerable > 0 || context.world.isSanctuary?.(p.x, p.y)) return false;
  if (p.buffs?.some(buff => buff.immunity && buff.remaining > 0)) return false;
  const reduction = damageType === 'physical' ? armorReduction(effectiveArmor(p), sourceLevel) : p.derived.resistances[damageType];
  amount = Math.max(1, Math.round(amount * (1 - reduction) * (damageType==='physical'?1-auraPower(p,'ironroot')/800:1)));
  for (const buff of p.buffs ?? []) if (buff.reduction && buff.remaining > 0) amount = Math.max(1, Math.round(amount * (1 - buff.reduction)));
  if (p.equipment.offHand?.kind === 'shield' && (p.guardTime > 0 || context.random() < p.derived.blockChance)) {
    const reduction = p.guardTime > 0 ? Math.max(p.guardReduction, p.derived.blockReduction) : p.derived.blockReduction;
    const blocked = Math.floor(amount * reduction);
    storeBastion(p,blocked);
    amount = Math.max(1, amount - blocked);
    primeAfterguard(p);
    context.emit({ type: 'block', x: p.x, y: p.y, angle, value: blocked, color: '#a9daca' });
  }
  const mitigated=mitigateSkillHit(p,amount); amount=mitigated.damage;
  let buffAbsorbed = 0;
  for (const buff of p.buffs ?? []) if (buff.absorbRemaining && buff.absorbRemaining > 0 && amount > 0) {
    const drained = Math.min(amount, buff.absorbRemaining);
    buff.absorbRemaining -= drained; amount -= drained; buffAbsorbed += drained;
  }
  const petShare = (p.buffs ?? []).reduce((share, buff) => share + (buff.remaining > 0 ? buff.petShare ?? 0 : 0), 0);
  const pet = petShare > 0 ? p.allies?.find(ally => ally.hp > 0 && (ally.petId !== undefined || demonFamilyForAlly(ally.kind) !== undefined)) ?? p.allies?.find(ally => ally.hp > 0) : undefined;
  if (pet && amount > 0) {
    const redirected = Math.min(pet.hp, Math.round(amount * petShare));
    pet.hp -= redirected; amount = Math.max(0, amount - redirected);
  }
  if(mitigated.absorbed+buffAbsorbed)context.emit({type:'block',x:p.x,y:p.y,angle,value:mitigated.absorbed+buffAbsorbed,color:'#9ed6d5'});
  const actualValue = Math.min(p.hp, amount);
  p.hp = Math.max(0, p.hp - amount);
  p.hitFlash = COMBAT_TIMING.hitFlashDuration;
  p.hitAngle = angle;
  p.invulnerable = COMBAT_TIMING.hurtGuard;
  context.emit({ type: 'hurt', ...(damageType === 'physical' ? {} : { style: damageType }), actualValue, x: p.x, y: p.y, angle, value: amount,
    remainingHp: p.hp, enemyKind: kind, heavy: amount >= 20 });
  const resource = resourceModelOf(p);
  if (resource && resource.gainOnHit > 0) p.mana = Math.min(p.maxMana, p.mana + resource.gainOnHit);
  if (p.stealthed) { p.stealthed = false; p.buffs = p.buffs?.filter(buff => !buff.stealth); }
  if (p.hp <= 0) {
    p.dead = true; p.auras=undefined; p.affixBuffs = undefined; p.skillEffects = undefined;
    p.attack = null;
    p.dash = null; p.guardTime = 0;
    p.castTime = p.dodgeTime = 0;
    p.vx = p.vy = 0;
  }
  if(mitigated.burst&&!p.dead)context.wardBurst?.(mitigated.burst);
  // Armor/accessory procs roll on landed hits — after mitigation so a killing
  // blow cannot raise a shield on a corpse.
  if (!p.dead) context.defensiveProc?.(p, context);
  return true;
}
