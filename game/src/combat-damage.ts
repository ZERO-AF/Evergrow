import { riftWardActive } from './rift-tactics.ts';
import { RIFT_TACTICS } from './rift-encounters.ts';
import { auraPower, bloodOathHit, resonanceHit } from './auras.ts';
import type { WardBurst } from './unique-combat.ts';
import { storeBastion } from './unique-combat.ts';
import { mitigateSkillHit } from './player-skill-effects.ts';
import { projectileDamageType } from './resistance-content.ts';
import { metric } from './chronicle.ts';
import { primeSpellweave, primeAfterguard, effectiveArmor } from './affix-combat.ts';
import { applyElementalContact, applyStun, breakCcOnDamage, absorbEnemyHit, applyEnemyBuff, enemyBuffDamageMultiplier, ENEMY_COMBAT_BUFFS, STATUS_RULES } from './combat-status.ts';
import { resolveElementalReaction, ELEMENTAL_REACTION_RULES } from './elemental-reaction.ts';
import { schoolProjectileStyle } from './spell-school.ts';
import { enemyThreat, playerThreatSource, recordThreat } from './enemy-threat.ts';
import type { HitSnapshot, CombatEvent, Enemy, EnemyKind, Player, Projectile, ProjectileEffects, ProjectileStyle, WorldQuery, DamageType } from './model.ts';
import type { ProjectileDefinition } from './combat-content.ts';
import type { BuffSpec } from './wow-types.ts';
import { COMBAT_TIMING, ENEMY_DEFINITIONS } from './combat-content.ts';
import { ENCOUNTER_RULES } from './encounter-director.ts';
import { armorReduction } from './progression-content.ts';
import { alertEnemy, transitionEnemy, interruptStaggeredEnemy } from './enemy-state.ts';
import { GAME_FEATURES } from './game-features.ts';
import { resourceModelOf } from './player-skill-effects.ts';
import { demonFamilyForAlly } from './pet-content.ts';
import { angleDifference } from './combat-geometry.ts';
import { enemyDisplayName } from './zone-roster.ts';

/** WoW attack table (docs/wow-transformation.md): a direct contact rolls
 * miss → dodge → parry → glancing before the ordinary hit/crit resolution. Every
 * chance scales with the level gap (target − attacker), so equal-level fights are
 * unchanged; hit rating and expertise are the player's answers. Dodge and parry
 * require a melee blow the target faces — attacks from behind can only miss or
 * glance. Arrows and bolts share the miss and glancing slices; spells trade
 * glancing for a partial resist and are never dodged or parried. */
export const ATTACK_TABLE = Object.freeze({
  /** Rating points that convert to one percentage point of avoidance reduction. */
  ratingPerPercent: 8,
  /** Miss chance per level the target outlevels the attacker. */
  missPerLevel: .05,
  /** Dodge chance per level the target outlevels the attacker. */
  dodgePerLevel: .015,
  /** Parry chance per level the target outlevels the attacker. */
  parryPerLevel: .015,
  /** Glancing-blow chance per level the target outlevels the attacker. */
  glancePerLevel: .1,
  /** Damage a glancing blow still deals. */
  glanceDamage: .65,
  /** Frontal arc (half-angle) inside which dodge and parry apply. */
  facingArc: Math.PI / 2,
  /** Combined avoidance never exceeds this share of the table. */
  cap: .8,
});
export type AttackChannel = 'melee' | 'ranged' | 'spell';
export type AttackOutcome = 'miss' | 'dodge' | 'parry' | 'glancing' | 'resisted' | 'hit';
/** One seeded roll over the attack table; consumes no randomness when nothing can fail. */
export function attackTableRoll(random: () => number, attackerLevel: number, targetLevel: number,
  targetFacing: number, hitAngle: number, hitRating = 0, expertise = 0, channel: AttackChannel = 'melee'): { outcome: AttackOutcome; damage: number } {
  const delta = Math.max(0, targetLevel - attackerLevel);
  const facing = channel === 'melee' && Math.abs(angleDifference(targetFacing, hitAngle + Math.PI)) <= ATTACK_TABLE.facingArc;
  const miss = Math.max(0, delta * ATTACK_TABLE.missPerLevel - hitRating / (ATTACK_TABLE.ratingPerPercent * 100));
  const dodge = facing ? Math.max(0, delta * ATTACK_TABLE.dodgePerLevel - expertise / (ATTACK_TABLE.ratingPerPercent * 100)) : 0;
  const parry = facing ? Math.max(0, delta * ATTACK_TABLE.parryPerLevel - expertise / (ATTACK_TABLE.ratingPerPercent * 100)) : 0;
  // Physical hits glance off higher-level targets; spells partially resist instead.
  const glance = channel === 'spell' ? 0 : Math.min(ATTACK_TABLE.cap, delta * ATTACK_TABLE.glancePerLevel);
  const resist = channel === 'spell' ? Math.min(ATTACK_TABLE.cap, delta * ATTACK_TABLE.glancePerLevel) : 0;
  if (miss + dodge + parry + glance + resist <= 0) return { outcome: 'hit', damage: 1 };
  const roll = random();
  if (roll < miss) return { outcome: 'miss', damage: 0 };
  if (roll < miss + dodge) return { outcome: 'dodge', damage: 0 };
  if (roll < miss + dodge + parry) return { outcome: 'parry', damage: 0 };
  if (roll < miss + dodge + parry + glance + resist)
    return channel === 'spell' ? { outcome: 'resisted', damage: ATTACK_TABLE.glanceDamage } : { outcome: 'glancing', damage: ATTACK_TABLE.glanceDamage };
  return { outcome: 'hit', damage: 1 };
}

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
  /** Attacker's melee ratings for the attack table (PvP sources); enemies carry none. */
  offense?: { readonly hitRating?: number; readonly expertise?: number };
  /** The live attacker this hit came from (enemy or PvP combatant); absent for
   * unattributed damage — reflect buffs cannot answer those hits. */
  attacker?: Enemy;
  /** True on a reflected strike itself; reflect never answers reflect. */
  reflected?: boolean;
  /** Reflect channel: deals post-mitigation damage back to the attacker through
   * the enemy-damage path. Injected by the simulation (contact owner). */
  strikeBack?(attacker: Enemy, amount: number, damageType: DamageType): void;
}

/** One contact owner: damage, awareness, impulse, interruption and death commitment. */
export function damageEnemy(enemy: Enemy, damage: number, angle: number, melee: boolean,
  context: EnemyDamageContext, periodic = false, style?: ProjectileStyle, elementalDamage?: number, offense?: HitSnapshot, authoredBurn = false): void {
  if (enemy.state === 'dead') return;
  if (!periodic) {
    alertEnemy(enemy, context.player);
    // A camp shares danger only with nearby members who can see the struck ally.
    if (enemy.campId) for (const ally of context.enemies) if (ally !== enemy && ally.campId === enemy.campId
      && ally.state !== 'dead' && Math.hypot(ally.x - enemy.x, ally.y - enemy.y) < 190
      && context.visible(ally.x, ally.y, enemy.x, enemy.y)) alertEnemy(ally, context.player);
  }
  // Shielding elites are briefly invulnerable: no table roll, no statuses, no hit.
  if (enemy.affixState?.shielded) {
    context.emit({ type: 'block', x: enemy.x, y: enemy.y, angle, value: 0, blocked: 'immune', enemyKind: enemy.kind, enemyName: enemyDisplayName(enemy) });
    return;
  }
  const hitStats = offense ?? context.player.derived;
  // WoW attack table: a direct contact can miss a higher-level target; melee can
  // also be dodged or parried by a facing one, arrows and bolts glance, and
  // spells partially resist. Periodic ticks and authored burns bypass the table;
  // a whiff still alerts the target above.
  let glancing = false;
  if (!periodic && GAME_FEATURES.attackTable) {
    const channel: AttackChannel = melee ? 'melee'
      : style !== undefined && projectileDamageType(style) !== 'physical' ? 'spell' : 'ranged';
    const roll = attackTableRoll(context.random, context.player.level, enemy.level, enemy.angle, angle,
      hitStats.hitRating ?? 0, hitStats.expertise ?? 0, channel);
    if (roll.outcome !== 'hit' && roll.outcome !== 'glancing' && roll.outcome !== 'resisted') {
      context.emit({ type: 'avoid', outcome: roll.outcome, x: enemy.x, y: enemy.y, angle,
        targetId: enemy.id, enemyKind: enemy.kind, enemyName: enemyDisplayName(enemy), classId: context.player.character?.classId,
        ...(offense?.allyId !== undefined ? { allyId: offense.allyId } : {}) });
      return;
    }
    glancing = roll.outcome === 'glancing';
    if (roll.outcome === 'resisted')
      context.emit({ type: 'block', x: enemy.x, y: enemy.y, angle, value: Math.round(damage * (1 - roll.damage)), blocked: 'resist', enemyKind: enemy.kind, enemyName: enemyDisplayName(enemy) });
    damage *= roll.damage;
    if (elementalDamage !== undefined) elementalDamage *= roll.damage;
  }
  if(riftWardActive(enemy,context.visible)){damage*=1-RIFT_TACTICS.wardReduction;if(elementalDamage!==undefined)elementalDamage*=1-RIFT_TACTICS.wardReduction;}
  if(!periodic){const oath=bloodOathHit(context.player,enemy,melee);damage*=oath;if(elementalDamage!==undefined)elementalDamage*=oath;}
  const exposure=resonanceHit(context.player,enemy,style,periodic);
  if(elementalDamage!==undefined){damage+=elementalDamage*(exposure-1);elementalDamage*=exposure;}else damage*=exposure;
  if(enemy.sundered&&enemy.sundered.remaining>0){damage*=1+enemy.sundered.fraction;if(elementalDamage!==undefined)elementalDamage*=1+enemy.sundered.fraction;}
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
            context.emit({ type: 'hit', actualValue: Math.round(statusDamage * 0.3), angle: pushAngle, value: Math.round(statusDamage * 0.3), targetId: other.id, remainingHp: other.hp, enemyKind: other.kind, enemyName: enemyDisplayName(other), heavy: true, reaction: 'cascade', color: '#67e8f9', x: other.x, y: other.y });
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
  const critical = !periodic && !glancing && hitStats.critChance > 0 && context.random() < hitStats.critChance;
  damage = Math.max(1, Math.round(damage * (critical ? hitStats.critMultiplier : 1) * (periodic ? 1 : hitStats.directDamageMultiplier ?? 1)));
  // Dispellable shield buffs soak damage before health (Purge/Dispel strip them).
  if (enemy.buffs?.length) {
    const absorbed = damage - absorbEnemyHit(enemy, damage);
    if (absorbed > 0) {
      damage -= absorbed;
      context.emit({ type: 'block', x: enemy.x, y: enemy.y, angle, value: absorbed, color: '#9ed6d5', blocked: 'absorb', enemyKind: enemy.kind, enemyName: enemyDisplayName(enemy) });
    }
  }
  const actualValue = Math.min(enemy.hp, damage);
  enemy.hp = Math.max(0, enemy.hp - damage);
  breakCcOnDamage(enemy);
  // Reactive ward: warded kinds shield up the first time a hit lands. The hit
  // itself is never absorbed, and a killing blow never feeds the ward.
  if (!enemy.buffCast && enemy.hp > 0 && ENEMY_COMBAT_BUFFS[enemy.kind]) {
    enemy.buffCast = true;
    for (const kind of ENEMY_COMBAT_BUFFS[enemy.kind]!) applyEnemyBuff(enemy, kind);
  }
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
  context.emit({ ...(style ? { style } : {}), classId: context.player.character?.classId, type: 'hit', actualValue, elementalValue:actualValue*elementFraction, melee, periodic, ...(offense?.skill?{skill:offense.skill}:{}), ...(offense?.allyId !== undefined ? { allyId: offense.allyId } : {}), ...(reaction ? { reaction: reaction.type, color: reaction.color } : {}), ...(glancing ? { glancing: true } : {}), x: enemy.x, y: enemy.y, angle, value: damage,
    targetId: enemy.id, remainingHp: enemy.hp, enemyKind: enemy.kind, enemyName: enemyDisplayName(enemy), heavy: critical || !!reaction });
  // Feed the live threat table: damage (and periodic ticks) accrue threat so the
  // AI holds aggro on the highest-threat combatant, not merely the nearest.
  recordThreat(enemy, offense?.allyId !== undefined ? `ally:${offense.allyId}` : playerThreatSource(context.player), actualValue, periodic);
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
    context.emit({ ...(style ? { style } : {}), classId: context.player.character?.classId, type: 'kill', x: enemy.x, y: enemy.y, angle, facing: enemy.angle,
      targetId: enemy.id, remainingHp: 0, enemyKind: enemy.kind, enemyName: enemyDisplayName(enemy) });
  } else if (definition.interruptible && melee) {
    applyStun(enemy, COMBAT_TIMING.staggerDuration, 'stagger');
    interruptStaggeredEnemy(enemy);
  }
}

/** Returns whether damage landed; the clock owner handles input/fixed-step cancellation.
 * `context.player` is the TARGET — any Player-shaped actor, including PvP combatants.
 * Periodic ticks (dots/burns) bypass the hurt guard and never grant protection. */
export function damageCombatant(amount: number, angle: number, sourceLevel: number, damageType: DamageType, context: PlayerDamageContext, kind?: EnemyKind, periodic = false, style?: ProjectileStyle, sourceName?: string, melee = false): boolean {
  const p = context.player;
  if (p.dead || (!periodic && p.invulnerable > 0) || context.world.isSanctuary?.(p.x, p.y)) return false;
  if (p.buffs?.some(buff => buff.immunity && buff.remaining > 0)) {
    context.emit({ type: 'block', x: p.x, y: p.y, angle, value: 0, blocked: 'immune', incoming: true });
    return false;
  }
  // Enraged enemies (dispellable buff) deal increased damage on every hit type.
  if (context.attacker && 'kind' in context.attacker) amount *= enemyBuffDamageMultiplier(context.attacker);
  // The same attack table guards the player: a facing combatant can dodge or
  // parry a melee blow, a lower-level attacker's arrows glance off, and its
  // spells can miss or partially resist.
  let glancingHit = false;
  if (!periodic && GAME_FEATURES.attackTable) {
    const channel: AttackChannel = melee ? 'melee' : damageType === 'physical' ? 'ranged' : 'spell';
    const roll = attackTableRoll(context.random, sourceLevel, p.level, p.angle, angle,
      context.offense?.hitRating ?? 0, context.offense?.expertise ?? 0, channel);
    if (roll.outcome !== 'hit' && roll.outcome !== 'glancing' && roll.outcome !== 'resisted') {
      context.emit({ type: 'avoid', outcome: roll.outcome, x: p.x, y: p.y, angle, incoming: true, enemyKind: kind, enemyName: sourceName });
      return false;
    }
    if (roll.outcome === 'glancing') { amount *= roll.damage; glancingHit = true; }
    if (roll.outcome === 'resisted') {
      context.emit({ type: 'block', x: p.x, y: p.y, angle, value: Math.round(amount * (1 - roll.damage)), blocked: 'resist', incoming: true, enemyKind: kind, enemyName: sourceName });
      amount *= roll.damage;
    }
  }
  const reduction = damageType === 'physical' ? armorReduction(effectiveArmor(p), sourceLevel) : p.derived.resistances[damageType];
  const preResist = amount;
  amount = Math.max(1, Math.round(amount * (1 - reduction) * (damageType==='physical'?1-auraPower(p,'ironroot')/800:1)));
  // WoW partial resist readout: elemental damage shaved by resistance floats "N Resisted".
  if (damageType !== 'physical' && preResist - amount >= 1)
    context.emit({ type: 'block', x: p.x, y: p.y, angle, value: preResist - amount, blocked: 'resist', incoming: true });
  for (const buff of p.buffs ?? []) if (buff.reduction && buff.remaining > 0) amount = Math.max(1, Math.round(amount * (1 - buff.reduction)));
  if (!periodic && p.equipment.offHand?.kind === 'shield' && (p.guardTime > 0 || context.random() < p.derived.blockChance)) {
    const reduction = p.guardTime > 0 ? Math.max(p.guardReduction, p.derived.blockReduction) : p.derived.blockReduction;
    const blocked = Math.floor(amount * reduction);
    storeBastion(p,blocked);
    amount = Math.max(1, amount - blocked);
    primeAfterguard(p);
    context.emit({ type: 'block', x: p.x, y: p.y, angle, value: blocked, color: '#a9daca', blocked: 'shield', incoming: true });
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
  if(mitigated.absorbed+buffAbsorbed)context.emit({type:'block',x:p.x,y:p.y,angle,value:mitigated.absorbed+buffAbsorbed,color:'#9ed6d5',blocked:'absorb',incoming:true});
  // PvP combatants carry the enemy status surface: sunder amplifies, elemental
  // contacts apply burn/chill/interrupt, and damage strips break-on-damage CC.
  const combatant = p.team !== undefined ? p as unknown as Enemy : undefined;
  if (combatant) {
    if (combatant.sundered && combatant.sundered.remaining > 0) amount = Math.max(1, Math.round(amount * (1 + combatant.sundered.fraction)));
    if (!periodic) { applyElementalContact(combatant, style, amount); breakCcOnDamage(combatant); }
  }
  const actualValue = Math.min(p.hp, amount);
  p.hp = Math.max(0, p.hp - amount);
  p.hitFlash = COMBAT_TIMING.hitFlashDuration;
  p.hitAngle = angle;
  // PvP combatants never gain the PvE hurt guard: focus fire and dot ticks must land.
  if (!periodic && p.team === undefined) p.invulnerable = COMBAT_TIMING.hurtGuard;
  context.emit({ type: 'hurt', ...(damageType === 'physical' ? {} : { style: damageType }), actualValue, x: p.x, y: p.y, angle, value: amount,
    remainingHp: p.hp, enemyKind: kind, ...(sourceName ? { enemyName: sourceName } : {}), heavy: amount >= 20, ...(glancingHit ? { glancing: true } : {}) });
  // Thorns-style reflect: a landed, non-periodic hit with a live attacker returns
  // a fraction of the post-mitigation damage through the enemy-damage path.
  if (!periodic && !context.reflected && amount > 0 && context.strikeBack
    && context.attacker !== undefined && 'kind' in context.attacker && context.attacker.state !== 'dead') {
    const reflect = (p.buffs ?? []).reduce((sum, buff) => sum + (buff.remaining > 0 ? buff.reflect ?? 0 : 0), 0);
    if (reflect > 0) context.strikeBack(context.attacker, amount * reflect, damageType);
  }
  const resource = resourceModelOf(p);
  if (resource && resource.gainOnHit > 0) p.mana = Math.min(p.maxMana, p.mana + resource.gainOnHit);
  if (p.stealthed) { p.stealthed = false; p.buffs = p.buffs?.filter(buff => !buff.stealth); }
  if (p.hp <= 0) {
    p.dead = true; p.auras=undefined; p.affixBuffs = undefined; p.skillEffects = undefined;
    p.attack = null;
    p.dash = null; p.guardTime = 0;
    p.castTime = p.dodgeTime = 0; p.cast = null;
    p.vx = p.vy = 0;
    if (combatant) {
      // A combatant at 0 hp becomes a corpse: statuses clear, the AI stops driving it.
      combatant.state = 'dead'; combatant.stateTime = 0;
      combatant.dots = undefined; combatant.cc = undefined;
      combatant.slowTime = 0; combatant.slowFactor = 1;
      combatant.burnTime = 0; combatant.burnDps = 0; combatant.burnTick = 0;
      combatant.stagger = 0; combatant.stunTime = 0; combatant.freezeTime = 0;
    }
  }
  if(mitigated.burst&&!p.dead)context.wardBurst?.(mitigated.burst);
  // Armor/accessory procs roll on landed hits — after mitigation so a killing
  // blow cannot raise a shield on a corpse.
  if (!p.dead) context.defensiveProc?.(p, context);
  return true;
}
