import { startChain, CHAIN_FLIGHT_LIMIT, type ChainFlight } from './chain-lightning.ts';
import { isAura } from './aura-content.ts';
import { hasUnique, UNIQUE_RULES } from './unique-content.ts';
import { harvestRear, lungeReturn, returningProjectile, storeFireballs, type StoredFireball } from './unique-combat.ts';
import { skillEffects, consumeRally, snapshotSkillOffense, queueSkillEcho } from './player-skill-effects.ts';
import { groundEffectPulseCount, type WowSkillPayload } from './skill-execution-content.ts';
import { metric } from './chronicle.ts';
import { consumeSpellweave } from './affix-combat.ts';
import { weaponImpactStyle } from './elemental-weapon.ts';
import { castSchoolStyle, schoolProjectileStyle } from './spell-school.ts';
import type { ProjectileStyle, HitSnapshot, Projectile, WeaponLaunch } from './model.ts';
import { containerVisible, strikeContainers, type ContainerAttackContext } from './breakable-containers.ts';
import { skillTargetPoint } from './skill-target-point.ts';
import { knowsSkill, sheetClassId, sheetRaceId } from './skill-progression.ts';
import type { Ally, CombatEvent, Enemy, GroundEffect, Player, ProjectileEffects, SkillFailReason, WorldQuery } from './model.ts';
import type { SkillId } from './character-types.ts';
import { skillWeapon, SKILL_DEFINITIONS } from './skill-content.ts';
import { unlockedSkills } from './skill-tree.ts';
import { deriveAttackStats } from './equipment.ts';
import { BASIC_ATTACK_PHASES, creatureFamily, type ProjectileDefinition } from './combat-content.ts';
import { SKILL_TARGETING, type SkillExecution } from './skill-execution-content.ts';
import { applySlow, applyStun } from './combat-status.ts';
import { dispelEnemyBuffs, stolenBuffSpec, ENEMY_BUFFS } from './enemy-buffs.ts';
import { circleIntersectsSector } from './combat-geometry.ts';
import { WOW_CLASSES } from './wow-classes.ts';
import { racialSkillId } from './character.ts';
import { WOW_COMBAT, isWowRaceId } from './wow-types.ts';
import type { AllyKind, BuffSpec, CcKind, DotSpec, HotSpec, RuneKind } from './wow-types.ts';
import { RACIAL_SLOT } from './action-bar.ts';
import { resolvePlayerSkill } from './glyph-state.ts';
import { tameableFamily, freshPetStable, PET_RULES, demonFamilyForAlly } from './pet-content.ts';
import { isBossKind } from './wilderness-boss-content.ts';
import { tauntThreat } from './enemy-threat.ts';

/** Simulation-owned mechanics the skill handlers drive (frozen contract — implemented in simulation.ts). */
export interface SkillSimApi {
  applyDot(enemy: Enemy, spec: DotSpec, baseDamage: number, id?: string): void;
  applyCc(enemy: Enemy, kind: CcKind, duration: number, breakOnDamage: boolean, factor?: number): void;
  addBuff(name: string, color: string, spec: BuffSpec, id?: string): void;
  summonAlly(kind: AllyKind, count: number, duration?: number): void;
  /** Convert a live beast enemy into a PetRecord + summoned ally; consumes the enemy. */
  tameBeast(enemy: Enemy): 'tamed' | 'untameable' | 'full';
  /** The live ally bound to the active PetRecord, if it is alive. */
  petAlly(): Ally | undefined;
  /** Heal an ally (Mend Pet); amount ≤1 is a fraction of the ally's maxHp. */
  healAlly(ally: Ally, amount: number, color?: string): void;
  /** Summon the active PetRecord's ally when none is live (Call Pet / Revive Pet). */
  summonActivePet(): boolean;
  addComboPoint(): void;
  spendComboPoints(): number;
  spendRuneCost(cost: Partial<Record<RuneKind, number>>): boolean;
  addRunicPower(amount: number): void;
  playerHeal(amount: number, color?: string): void;
  setTarget(id: number | null): void;
  tabTarget(direction: 1 | -1): void;
}

export { schoolProjectileStyle } from './spell-school.ts';

/** Non-damaging instant kinds that flash a school-colored activation ring at the player. */
const ACTIVATION_RING: Record<string, true> = { buff: true, heal: true, hot: true, cleanse: true, summon: true,
  stealth: true, form: true, stance: true, ward: true, step: true, tame: true };

export interface SkillContext {
  chains: ChainFlight[];
  allowReturn?: boolean;
  drawStrength?: number;
  containers?: ContainerAttackContext;
  availableGroundEffects: number;
  availableProjectiles: number;
  /** Current simulation time (GCD, cooldown gates). */
  time: number;
  /** Set when a cast-time skill already paid costs and passed gates at cast start. */
  prepaid?: boolean;
  /** Simulation mechanics surface for WoW recipes. */
  sim: SkillSimApi;
  player: Player; world: WorldQuery; enemies: Enemy[]; aimX: number; aimY: number;
  /** True enables gate feedback events; unset/false stays silent (prepaid
   * completions, suppressed retries, headless harnesses). */
  reportFailures?: boolean;
  /** Set when a gate emitted a skill-failed event; the sim marks the press reported. */
  failReported?: boolean;
  damage(enemy: Enemy, amount: number, angle: number, melee: boolean, style?: ProjectileStyle, elementalDamage?: number, offense?: HitSnapshot): void;
  onScreen(enemy: Enemy): boolean;
  visible(ax: number, ay: number, bx: number, by: number): boolean;
  projectile(x: number, y: number, angle: number, definition: ProjectileDefinition, skill: SkillId, effects?: ProjectileEffects): Projectile | void;
  schedule(effect: Omit<GroundEffect, 'id' | 'tick'>): void;
  emit(event: CombatEvent): void;
}


const angularDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** Rules and effects for every active skill; simulation owns collision, damage and effect timing. */
export function activateSkill(context: SkillContext, slot: number): boolean {
  const { player: p, enemies } = context;
  if (!Number.isInteger(slot) || slot < 0 || slot > RACIAL_SLOT || p.dead || p.dash || p.dodgeTime > 0) return false;
  const id = slot === RACIAL_SLOT ? (isWowRaceId(p.character.raceId) ? racialSkillId(p.character) : undefined) : p.character.skillSlots[slot];
  if(isAura(id))return false;
  if (!id || (!unlockedSkills(p.character.allocatedNodes).includes(id) && !knowsSkill(p.character, id))) return false;
  // A cast or channel in progress blocks new skills; the channel's own ticks pass through.
  const channeling = !!(p.cast?.channel && p.cast.skill === id);
  if ((p.castTime > 0 || p.cast) && !channeling) return false;
  const fail = (reason: SkillFailReason): false => {
    if (context.reportFailures === true) { context.emit({ type: 'skill-failed', x: p.x, y: p.y, skill: id, reason }); context.failReported = true; }
    return false;
  };
  // The basic swing timer is independent of the GCD (WoW rule): it never blocks
  // skills. A skill's own sweep still holds its contact window so a follow-up
  // press cannot truncate its hits.
  if (p.attack?.skill) return false;
  const weapon = skillWeapon(id, p.equipment);
  if (!weapon) return false;
  const returnStep=lungeReturn(p);
  if(id==='lunge'&&returnStep){
    if(context.allowReturn===false||returnStep.remaining<=0)return false;
    const to=skillTargetPoint(context.world,p,returnStep,Math.hypot(returnStep.x-p.x,returnStep.y-p.y));
    const distance=Math.hypot(to.x-p.x,to.y-p.y);delete p.skillEffects!.returnStep;
    if(distance<1)return true;
    const angle=Math.atan2(to.y-p.y,to.x-p.x),duration=distance/returnStep.speed;
    p.dash={angle,remaining:duration,speed:returnStep.speed,damage:0,radius:0,skill:id,hitIds:new Set()};
    p.castTime=duration;p.castDuration=duration;p.castAngle=angle;p.angle=angle;p.activeSkill=id;
    context.emit({type:'cast',x:p.x,y:p.y,angle,skill:id,style:'arcane'});return true;
  }
  const definition = SKILL_DEFINITIONS[id];
  const costs = resolvePlayerSkill(id, p);
  const recipe: SkillExecution = costs.recipe;
  const storeEmbers=id==='fireball'&&hasUnique(p.character,'cinderheart-testament');
  const throwShield=id==='shieldBash'&&hasUnique(p.character,'returning-verdict');
  if(storeEmbers&&(p.skillEffects?.embers?.length??0)>=UNIQUE_RULES.storedCasts)return false;
  const fissure=id==='earthshatter'&&hasUnique(p.character,'gravetide');
  const shatter=id==='frostLance'&&hasUnique(p.character,'rimeheart-spire');
  const projectileSlots = storeEmbers ? 0 : throwShield||fissure ? 1 : recipe.kind === 'projectile' ? recipe.offsets.length : recipe.kind === 'step' && recipe.shot ? 1 : 0;
  const groundSlots = storeEmbers ? 0 : shatter ? projectileSlots : recipe.kind === 'ground' ? recipe.scatter ?? 1 : recipe.kind === 'radial' && recipe.echo ? 1
    : recipe.kind === 'projectile' && recipe.effects.groundDuration ? projectileSlots : 0;
  if (recipe.kind === 'chain' && context.chains.length >= CHAIN_FLIGHT_LIMIT) return false;
  if (projectileSlots > context.availableProjectiles) return false;
  if (groundSlots > context.availableGroundEffects) return false;
  if (recipe.kind === 'chain' && context.chains.length >= CHAIN_FLIGHT_LIMIT) return false;
  // Channel ticks and cast completions re-enter prepaid; costs/cooldowns were settled at start.
  if (!context.prepaid) {
    if ((p.skillCooldowns[id] ?? 0) > 0) return fail('cooldown');
    if (p.mana < costs.mana) {
      context.emit({ type: 'insufficient-mana', x: p.x, y: p.y, skill: id });
      return false;
    }
  }

  const attack = deriveAttackStats(p.stats, weapon);
  // Spell base for heals/HoTs: the same base staff/wand bolts use (weapon damage ×
  // spellDamageMultiplier + enchantment), independent of the skill's damageMultiplier.
  const spellBase = weapon.attackKind === 'bolt' ? attack.damage
    : deriveAttackStats({ ...p.stats, attackDamageMultiplier: p.stats.spellDamageMultiplier }, weapon).damage;
  const draw = id==='piercingShot'&&hasUnique(p.character,'heartwood-draw') ? Math.max(0,Math.min(1,Number.isFinite(context.drawStrength)?context.drawStrength!:0)) : 0;
  attack.range *= 1 + draw * (UNIQUE_RULES.drawReach-1);
  // Staff weapon derivation already applies spell bonuses; applying them here again would square scaling.
  const weave = !definition.damageMultiplier ? 1 : consumeSpellweave(p, definition.requirement === 'magic' ? 'spell' : weapon.attackKind === 'melee' ? 'melee' : 'other');
  const rally = definition.damageMultiplier ? consumeRally(p, weapon.attackKind === 'melee') : 1;
  const damage = attack.damage * costs.damageMultiplier * weave * rally * (1+draw*(UNIQUE_RULES.drawDamage-1));
  const offense: HitSnapshot = snapshotSkillOffense(p,id);
  let launch: WeaponLaunch | undefined;
  const color = definition.color;
  const novaPoint=(recipe.kind==='radial'||recipe.kind==='channel')&&recipe.targetRange ? skillTargetPoint(context.world,p,{x:context.aimX,y:context.aimY},recipe.targetRange):p;
  const hitStyle = 'style' in recipe ? recipe.style : schoolProjectileStyle(castSchoolStyle(p, id)) ?? weaponImpactStyle(weapon);
  const damageTarget = (enemy: Enemy, amount: number, angle: number, melee: boolean, contactOffense = offense) => context.damage(enemy, amount, angle, melee, hitStyle, weapon.attackKind === 'melee' ? attack.elementalDamage * (damage > 0 ? amount / attack.damage : 0) : undefined, contactOffense);
  const living = () => enemies.filter(enemy => enemy.state !== 'dead');
  const visible = (enemy: Enemy) => context.visible(p.x, p.y, enemy.x, enemy.y);
  const radialAround = (cx: number, cy: number, radius: number, hit: (enemy: Enemy, angle: number) => void) => {
    for (const enemy of living()) if (Math.hypot(enemy.x - cx, enemy.y - cy) <= radius + enemy.radius && context.visible(cx,cy,enemy.x,enemy.y)) {
      hit(enemy, Math.atan2(enemy.y - cy, enemy.x - cx));
    }
  };
  const radial = (radius: number, hit: (enemy: Enemy, angle: number) => void) => radialAround(novaPoint.x, novaPoint.y, radius, hit);
  const blastAt = (x: number, y: number, radius: number, style?: ProjectileEffects['style']) => context.emit({ type: 'blast', x, y,
    skill: id, color, radius, duration: SKILL_TARGETING.blastDuration, ...(style ? { style } : {}) });
  const blast = (radius: number, style?: ProjectileEffects['style']) => blastAt(novaPoint.x, novaPoint.y, radius, style);
  const aimedPoint = () => skillTargetPoint(context.world,p,{x:context.aimX,y:context.aimY},costs.range ?? attack.range);


  // ── WoW targeting & mechanics (docs/wow-transformation.md §3) ──
  const reach = (t: Enemy) => Math.hypot(t.x - p.x, t.y - p.y) <= (costs.range ?? attack.range) + t.radius;
  /** The tab/click-selected enemy, when it is alive (reach/visibility checked by callers). */
  const storedTarget = p.targetId != null ? enemies.find(e => e.id === p.targetId && e.state !== 'dead') : undefined;
  const resolveTarget = (): Enemy | undefined => {
    const mode = costs.targetMode ?? 'point';
    // self/point skills aim at the cursor reticle only; a tab target must never
    // hijack a ground AoE or steer the player's facing.
    if (mode === 'self' || mode === 'point') return undefined;
    if (storedTarget && reach(storedTarget) && visible(storedTarget)) { p.angle = Math.atan2(storedTarget.y - p.y, storedTarget.x - p.x); return storedTarget; }
    if (mode === 'enemy') return undefined;
    // enemyOrPoint falls back to the nearest enemy inside a narrow aim sector.
    const fallback = living().filter(e => reach(e) && visible(e) && angularDistance(Math.atan2(e.y - p.y, e.x - p.x), p.angle) <= Math.PI / 3)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (fallback) p.angle = Math.atan2(fallback.y - p.y, fallback.x - p.x);
    return fallback;
  };
  const target = resolveTarget();
  const behind = (t: Enemy) => angularDistance(Math.atan2(p.y - t.y, p.x - t.x), t.angle) > Math.PI * .6;
  const hasCc = (t: Enemy, kinds: readonly CcKind[]) => !!t.cc?.some(c => c.remaining > 0 && kinds.includes(c.kind));
  const dotCount = (t: Enemy) => t.dots?.filter(d => d.remaining > 0).length ?? 0;
  const frozen = (t: Enemy) => (t.freezeTime ?? 0) > 0 || hasCc(t, ['freeze']);
  const rooted = (t: Enemy) => hasCc(t, ['root']);
  const sunder = (t: Enemy, fraction: number) => { t.sundered = { fraction: Math.max(fraction, t.sundered?.fraction ?? 0), remaining: Math.max(15, t.sundered?.remaining ?? 0) }; };
  const healBase = (amount: number | undefined, maxHpFrac: number | undefined) => (amount ?? 0) * spellBase + (maxHpFrac ?? 0) * p.maxHp;
  // BuffSpec.healPerSecond is a fraction of maxHp per second: convert the per-tick
  // spell-base amount to hp/s, then to a maxHp fraction; maxHpFrac spreads over duration.
  const hotToBuff = (hot: HotSpec, maxHpFrac?: number): BuffSpec => ({ duration: hot.duration,
    healPerSecond: ((hot.perTick ?? 0) * spellBase + (hot.flatTick ?? 0)) / Math.max(.1, hot.interval ?? 1) / p.maxHp + (maxHpFrac ?? 0) / hot.duration });
  const applyPayload = (r: WowSkillPayload, t: Enemy) => {
    if (r.dot) context.sim.applyDot(t, r.dot, damage, id);
    if (r.cc) context.sim.applyCc(t, r.cc.kind, r.cc.duration, r.cc.kind === 'incapacitate' || r.cc.kind === 'polymorph', r.cc.factor);
    if (r.slow) applySlow(t, r.slow);
    if (r.sunder) sunder(t, r.sunder);
    if (r.dispel) stripBuffs(r, t);
    if (r.taunt) { t.taunted = { remaining: r.taunt }; t.awareness = Math.max(t.awareness, 1); tauntThreat(t, 'player'); }
  };
  /** Offensive dispel: strips recipe.dispel buffs; recipe.steal grants the first to the caster. */
  const stripBuffs = (r: { dispel?: number; steal?: boolean }, t: Enemy) => {
    const stripped = dispelEnemyBuffs(t, r.dispel ?? 0);
    if (!stripped.length) return;
    if (r.steal) {
      const stolen = stripped[0]!;
      context.sim.addBuff(ENEMY_BUFFS[stolen.kind].name, ENEMY_BUFFS[stolen.kind].color, stolenBuffSpec(stolen, p.maxHp), `${id}:steal`);
      context.emit({ type: 'notice', x: t.x, y: t.y, message: `Stole ${ENEMY_BUFFS[stolen.kind].name}` });
      if (stripped.length > 1) context.emit({ type: 'notice', x: t.x, y: t.y, message: `Dispelled ${stripped.slice(1).map(b => ENEMY_BUFFS[b.kind].name).join(', ')}` });
    } else {
      context.emit({ type: 'notice', x: t.x, y: t.y, message: `Dispelled ${stripped.map(b => ENEMY_BUFFS[b.kind].name).join(', ')}` });
    }
    blastAt(t.x, t.y, 40, hitStyle);
  };
  const applySelfPayload = (r: WowSkillPayload) => {
    if (r.heal) context.sim.playerHeal(r.heal * p.maxHp, color);
    if (r.buff) context.sim.addBuff(definition.name, color, r.buff, id);
    if (r.resourceGain) p.mana = Math.min(p.maxMana, p.mana + r.resourceGain);
  };
  const strikeWhiff = () => context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle: p.angle, range: costs.range ?? attack.range, arc: Math.PI / 2, rear: false });
  const strikeExtras = (r: { dot?: DotSpec; slow?: { duration: number; factor: number }; stun?: number; silence?: number; healFrac?: number; sunder?: number; dispel?: number; cc?: { kind: CcKind; duration: number; factor?: number } }, t: Enemy, dealt: number) => {
    if (r.dot) context.sim.applyDot(t, r.dot, dealt, id);
    if (r.slow) applySlow(t, r.slow);
    if (r.stun) applyStun(t, r.stun);
    if (r.silence) context.sim.applyCc(t, 'silence', r.silence, false);
    if (r.cc) context.sim.applyCc(t, r.cc.kind, r.cc.duration, r.cc.kind === 'incapacitate' || r.cc.kind === 'polymorph', r.cc.factor);
    if (r.healFrac) context.sim.playerHeal(dealt * r.healFrac, color);
    if (r.sunder) sunder(t, r.sunder);
    if (r.dispel) stripBuffs(r, t);
  };
  const channelTick = (r: Extract<SkillExecution, { kind: 'channel' }>) => {
    if (r.manaPerTick) { const restored = r.manaPerTick * p.maxMana; p.mana = Math.min(p.maxMana, p.mana + restored); metric(p.chronicle, 'manaRestored', restored); }
    if (r.radius) {
      radial(r.radius, (e, a) => { damageTarget(e, damage * (r.executeBonus && e.hp / e.maxHp <= (costs.executeThreshold ?? .35) ? 1 + r.executeBonus : 1), a, false); if (r.slow) applySlow(e, r.slow); });
      blast(r.radius);
    } else if (target && target.state !== 'dead') {
      damageTarget(target, damage * (r.executeBonus && target.hp / target.maxHp <= (costs.executeThreshold ?? .35) ? 1 + r.executeBonus : 1), Math.atan2(target.y - p.y, target.x - p.x), false);
      if (r.slow) applySlow(target, r.slow);
    }
    if (r.healFrac) context.sim.playerHeal(damage * r.healFrac, color);
  };

  if (channeling && recipe.kind === 'channel') { channelTick(recipe); return true; }

  // ── Activation gates (docs/wow-transformation.md §3) ──
  // Cast-time skills run gates and pay costs at cast start (prepaid); completion skips them.
  if (!context.prepaid) {
    if (costs.classId && costs.classId !== sheetClassId(p.character)) return false;
    if (costs.raceId && costs.raceId !== sheetRaceId(p.character)) return false;
    if (!costs.offGcd && (p.gcdReady ?? 0) > context.time) return fail('gcd');
    if ((costs.targetMode ?? 'point') === 'enemy' && !target) return fail(storedTarget ? 'out-of-range' : 'no-target');
    if (costs.requiresStealth && !p.stealthed) return fail('requires-stealth');
    if (costs.requiresForm && p.buffs?.find(b => b.form && b.remaining > 0)?.form !== costs.requiresForm) return fail('requires-form');
    if (costs.requiresFrozen && (!target || !frozen(target))) return fail('requires-frozen');
    if (costs.requiresAlly) {
      const allies = p.allies ?? [];
      const found = costs.requiresAlly === 'demon'
        ? allies.some(a => a.hp > 0 && (demonFamilyForAlly(a.kind) !== undefined || a.kind === 'doomguard' || a.kind === 'infernal'))
        : allies.some(a => a.hp > 0 && a.kind === costs.requiresAlly);
      if (!found) return fail('requires-ally');
    }
    if (costs.requiresBuff && !(p.buffs ?? []).some(b => b.id === costs.requiresBuff && b.remaining > 0)) return fail('requires-buff');
    if ((costs.requiresBehind || (recipe.kind === 'comboStrike' && recipe.requiresBehind)) && (!target || !behind(target))) return fail('requires-behind');
    if (recipe.kind === 'comboStrike' && recipe.requiresStealth && !p.stealthed) return fail('requires-stealth');
    if (costs.executeThreshold && (costs.targetMode ?? 'point') === 'enemy' && (!target || target.hp / target.maxHp > costs.executeThreshold)) return fail(target ? 'execute-threshold' : 'no-target');
    if (costs.combo === 'spend' && (p.comboPoints ?? 0) < 1) return fail('no-combo');
    if ((costs.shardCost ?? 0) > (p.soulShards ?? 0)) return fail('no-shards');
    if (costs.runeCost && !context.sim.spendRuneCost(costs.runeCost)) return fail('no-runes');
    if (recipe.kind === 'tame') {
      // Tame Beast refuses non-beasts, elites and bosses, and a full stable — before mana is spent.
      const stable = p.character.pets ?? freshPetStable();
      const tameable = !!target && target.state !== 'dead' && !!tameableFamily(target.kind)
        && target.rank !== 'elite' && target.bossPhases === undefined && !isBossKind(target.kind);
      const room = tameable && (!stable.active || stable.stabled.length < PET_RULES.stableSlots);
      if (!tameable || !room) {
        context.emit({ type: 'notice', x: p.x, y: p.y, message: tameable ? 'Your stable is full.' : 'That beast cannot be tamed.' });
        return fail('unusable');
      }
    }
    p.mana -= costs.mana; metric(p.chronicle,'manaSpent',costs.mana); metric(p.chronicle,'casts'); metric(p.chronicle,'skillUses:'+id);
    if (costs.shardCost) p.soulShards = Math.max(0, (p.soulShards ?? 0) - costs.shardCost);
    if (costs.runeCost) context.sim.addRunicPower((costs.runicPowerGain ?? WOW_COMBAT.runicPowerPerRune) * Object.values(costs.runeCost).reduce((a, b) => a + (b ?? 0), 0));
    else if (costs.runicPowerGain) context.sim.addRunicPower(costs.runicPowerGain);
    const spellish = costs.requirement === 'magic' || (costs.castTime ?? 0) > 0 || !!costs.channel;
    const baseGcd = costs.classId === 'rogue' || p.buffs?.some(b => b.form === 'cat' && b.remaining > 0) ? WOW_COMBAT.gcdRogueCat : costs.classId ? WOW_CLASSES[costs.classId].gcd : WOW_COMBAT.gcdDefault;
    if (!costs.offGcd) p.gcdReady = context.time + (spellish ? Math.max(1, baseGcd / Math.max(.25, p.derived.castSpeedMultiplier)) : baseGcd);
    // Acting breaks stealth; stealth-granting recipes re-apply it below. Non-damaging
    // control that requires stealth (Sap) leaves it up.
    if (recipe.kind !== 'stealth' && !(recipe.kind === 'cc' && costs.requiresStealth)) p.stealthed = false;
    p.skillCooldowns[id] = costs.cooldown;
    if ((costs.castTime ?? 0) > 0 && !costs.channel) {
      // Cast speed (haste) shortens the cast; Presence of Mind / Bloodlust / gear all feed it.
      const castDuration = costs.castTime! / Math.max(.25, p.derived.castSpeedMultiplier);
      p.cast = { skill: id, remaining: castDuration, duration: castDuration,
        ...(target ? { targetId: target.id } : { x: context.aimX, y: context.aimY }),
        ...(recipe.kind === 'tame' && target ? { breakRange: (costs.range ?? attack.range) + target.radius } : {}) };
      p.castAngle = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(context.aimY - p.y, context.aimX - p.x);
      p.angle = p.castAngle;
      p.activeSkill = id;
      context.emit({ type: 'cast', x: p.x, y: p.y, angle: p.castAngle, skill: id });
      return true;
    }
  }
  p.activeSkill = id;
  if (recipe.kind === 'sweep') {
    const duration = 1 / attack.attacksPerSecond;
    p.attack = { kind: 'melee', offense, skill: id, specialization: costs.variant?.id, weapon, hand: weapon === p.equipment.mainHand ? 'main' : 'off', elapsed: 0, duration,
      activeStart: duration * BASIC_ATTACK_PHASES.activeStart, activeEnd: duration * BASIC_ATTACK_PHASES.activeEnd,
      angle: p.angle, range: attack.range * recipe.reachMultiplier,
      arc: recipe.arc, damage, elementalDamage: attack.elementalDamage * costs.damageMultiplier * weave * rally, hitIds: new Set() };
    applySelfPayload(recipe);
    context.emit({ type: 'swing', x: p.x, y: p.y, angle: p.angle, skill: id, color });
    return true;
  }

  p.castTime = 1 / attack.attacksPerSecond; p.castAngle = p.angle;
  switch (recipe.kind) {
    case 'aura': return false;
    case 'step': {
      const angle=p.angle;
      p.dash={angle:angle+(recipe.retreat?Math.PI:0),remaining:recipe.duration,speed:recipe.speed,damage:0,radius:0,skill:id,hitIds:new Set()};
      p.castTime=recipe.duration;
      if(recipe.shot){
        const shotDef:ProjectileDefinition={owner:'player',speed:560,life:Math.max(.1,attack.range/560),radius:3,damage};
        const effects:ProjectileEffects={style:'arrow',offense,pierce:recipe.pierce};
        const shot=context.projectile(p.x,p.y,angle,shotDef,id,effects);if(shot)launch=shot.launch;
        queueSkillEcho(p,p.x,p.y,angle,shotDef,effects,{x:context.aimX,y:context.aimY});
      }
      applySelfPayload(recipe);
      break;
    }
    case 'ward': {
      p.castTime=.18;
      skillEffects(p).ward={remaining:recipe.duration,capacity:p.maxHp*recipe.fraction,
        ...(hasUnique(p.character,'broken-seal')?{rupture:{absorbed:0,cap:attack.damage*UNIQUE_RULES.wardSpellCap,radius:UNIQUE_RULES.wardRadius*p.derived.areaMultiplier,offense:{...offense,critChance:0,lifeOnHit:0,directDamageMultiplier:1}}}:{})};
      if(p.skillEffects?.borrowed)p.skillEffects.borrowed.capacity=Math.min(p.skillEffects.borrowed.capacity,Math.max(0,p.maxHp*UNIQUE_RULES.borrowedLife-p.skillEffects.ward!.capacity));
      applySelfPayload(recipe);
      break;
    }
    case 'stance': {
      p.castTime=.18;
      const key=id==='ghostHunt'?'ghostHunt':id==='rallyOfIron'?'rallyOfIron':'brace';
      skillEffects(p)[key]={remaining:recipe.duration,reduction:recipe.reduction,charges:recipe.charges,bonus:recipe.bonus};
      if(id==='ghostHunt'&&hasUnique(p.character,'pale-huntsman')){skillEffects(p).archer={x:p.x,y:p.y,angle:p.angle,remaining:recipe.duration};skillEffects(p).echoes=[];}
      applySelfPayload(recipe);
      break;
    }
    case 'dash':
      if(id==='lunge'&&hasUnique(p.character,'duelists-return'))skillEffects(p).returnStep={x:p.x,y:p.y,remaining:UNIQUE_RULES.returnWindow,speed:recipe.speed};
      if(recipe.toTarget&&target)p.angle=Math.atan2(target.y-p.y,target.x-p.x);
      p.dash = { angle: p.angle, remaining: recipe.duration, speed: recipe.speed, damage, offense, elementalDamage: attack.elementalDamage * costs.damageMultiplier * weave * rally, radius: recipe.radius, skill: id, style: hitStyle, hitIds: new Set() };
      // Carried for the sim's dash-hit loop (Player.dash.stun is owned by simulation).
      if(recipe.stun)Object.assign(p.dash,{stun:recipe.stun});
      if(p.skillEffects?.returnStep)p.skillEffects.returnStep.outward=p.dash;
      p.castTime = Math.max(p.castTime, recipe.duration);
      applySelfPayload(recipe);
      break;
    case 'radial':
      if(id==='smokeVeil'&&hasUnique(p.character,'ashen-double')){
        const state=skillEffects(p),serial=state.uniqueSerial=(state.uniqueSerial??0)+1;
        state.decoy={id:serial,x:p.x,y:p.y,radius:p.radius,reach:recipe.radius,angle:p.angle,remaining:UNIQUE_RULES.decoyDuration,hp:p.maxHp*UNIQUE_RULES.decoyLife,maxHp:p.maxHp*UNIQUE_RULES.decoyLife};
      }
      if(fissure){
        context.projectile(p.x,p.y,p.angle,{owner:'player',speed:UNIQUE_RULES.fissureSpeed,life:UNIQUE_RULES.fissureRange/UNIQUE_RULES.fissureSpeed,radius:4,damage},id,
          {style:hitStyle??'arrow',fissureWidth:recipe.radius*.4,offense,pierce:Number.MAX_SAFE_INTEGER,stunDuration:recipe.stun,elementalDamage:attack.elementalDamage*costs.damageMultiplier*weave*rally});
        break;
      }
      if(recipe.shelter)(skillEffects(p).shelters??={})[id]={remaining:recipe.shelter.duration,reduction:recipe.shelter.reduction};
      if(!damage)p.castTime=.18;
      if(damage)strikeContainers(context.containers, novaPoint.x, novaPoint.y, recipe.radius);
      radial(recipe.radius, (enemy, angle) => {
        if(damage)damageTarget(enemy, damage, angle, recipe.melee);
        if (recipe.stun) applyStun(enemy, recipe.stun, recipe.style === 'frost' ? 'freeze' : 'stun');
        if (recipe.slow) applySlow(enemy, recipe.slow);
        applyPayload(recipe, enemy);
      });
      if (recipe.echo) context.schedule({ kind: 'frost', x: novaPoint.x, y: novaPoint.y, radius: recipe.radius * 1.2, delay: .6, duration: 0, interval: 1,
        damage: damage * .6, offense, skill: id, style: 'frost', slow: recipe.slow });
      blast(recipe.radius, recipe.style);
      applySelfPayload(recipe);
      break;
    case 'cone':
      if(throwShield){
        const range=UNIQUE_RULES.shieldRange*recipe.radius/68;
        const shot=context.projectile(p.x,p.y,p.angle,{owner:'player',speed:UNIQUE_RULES.shieldSpeed,life:range/UNIQUE_RULES.shieldSpeed,radius:Math.min(24,10*recipe.arc/(Math.PI*.7)),damage},id,
          {style:hitStyle??'arrow',offense,pierce:1000000,stunDuration:recipe.stun,elementalDamage:attack.elementalDamage*costs.damageMultiplier*weave*rally,thrownShield:p.character.equipped.offhand!.shield!.visual});
        if(shot)returningProjectile(shot,p.x,p.y);
        break;
      }
      context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle: p.angle, range: recipe.radius, arc: recipe.arc, rear: false });
      strikeContainers(context.containers, p.x, p.y, recipe.radius, p.angle, recipe.arc);
      for (const enemy of living()) if (circleIntersectsSector(enemy.x, enemy.y, enemy.radius, p.x, p.y, p.angle, recipe.radius, recipe.arc) && visible(enemy)) {
        damageTarget(enemy, damage, p.angle, true); applyStun(enemy, recipe.stun); applyPayload(recipe, enemy);
      }
      applySelfPayload(recipe);
      break;
    case 'guard': p.guardTime = Math.max(p.guardTime, recipe.duration); p.guardReduction = recipe.reduction; applySelfPayload(recipe); break;
    case 'backstab': {
      const targets = living().filter(enemy => circleIntersectsSector(enemy.x, enemy.y, enemy.radius, p.x, p.y, p.angle, Math.max(recipe.minRange, attack.range * recipe.reachMultiplier), recipe.arc) && visible(enemy))
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0,recipe.targets??1);
      for (const target of targets) {
        const behind = harvestRear(p,target.id,angularDistance(Math.atan2(p.y - target.y, p.x - target.x), target.angle) > recipe.rearAngle);
        const contactAngle=Math.atan2(target.y-p.y,target.x-p.x);
        damageTarget(target, damage * (behind ? recipe.rearMultiplier : 1), contactAngle, true);
        applyPayload(recipe, target);
        context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle: contactAngle, range: Math.hypot(target.x - p.x, target.y - p.y), arc: recipe.arc, rear: behind });
      }
      if (!targets.length) {
        const range = Math.max(recipe.minRange, attack.range * recipe.reachMultiplier);
        strikeContainers(context.containers, p.x, p.y, range, p.angle, recipe.arc);
        context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle: p.angle, range, arc: recipe.arc, rear: false });
      }
      applySelfPayload(recipe);
      break;
    }
    case 'projectile': {
      const { burnDamageMultiplier, groundDamageMultiplier, ...payload } = recipe.effects;
      const effects: ProjectileEffects = { ...payload, offense,
        ...(id==='ricochet'&&hasUnique(p.character,'thread-of-pursuit')?{pursuit:true}:{}),
        ...(shatter?{shatter:{radius:UNIQUE_RULES.shatterRadius*p.derived.areaMultiplier,delay:UNIQUE_RULES.shatterDelay}}:{}),
        ...(id==='siphon'&&hasUnique(p.character,'borrowed-life')?{borrowedLife:true}:{}),
        ...(groundDamageMultiplier !== undefined ? { groundDps: damage * groundDamageMultiplier } : {}),
        ...(burnDamageMultiplier !== undefined ? { burnDps: damage * burnDamageMultiplier } : {}) };
      applySelfPayload(recipe);
      if(storeEmbers){
        storeFireballs(p,recipe.offsets.map(offset=>({sourceLevel:p.level,offset,definition:{owner:'player',speed:recipe.speed,life:Math.max(SKILL_TARGETING.minimumProjectileLife,attack.range/recipe.speed),radius:recipe.radius,damage},effects:{...effects,offense:{...offense}}} satisfies StoredFireball)));
        break;
      }
      for (const [index,offset] of recipe.offsets.entries()) {
        const shot = context.projectile(p.x, p.y, p.angle + offset,
        { owner: 'player', speed: recipe.speed, life: Math.max(SKILL_TARGETING.minimumProjectileLife, attack.range / recipe.speed),
          radius: recipe.radius, damage }, id, effects);
        if (shot) {launch ??= shot.launch;if(id==='volley'&&hasUnique(p.character,'homeward-thorn'))returningProjectile(shot,p.x,p.y);}
        if(index===0)queueSkillEcho(p,p.x,p.y,p.angle+offset,{owner:'player',speed:recipe.speed,life:Math.max(SKILL_TARGETING.minimumProjectileLife,attack.range/recipe.speed),radius:recipe.radius,damage},effects,{x:context.aimX,y:context.aimY});
      }
      break;
    }
    case 'ground': {
      const point = recipe.follow || recipe.effect === 'frost' ? { x: p.x, y: p.y } : aimedPoint();
      const count = recipe.scatter ?? 1;
      for (let i = 0; i < count; i++) {
        const angle = i * Math.PI * 2 / count, radius = i ? recipe.radius * (recipe.scatterRadiusMultiplier ?? .7) : 0;
        const candidate = { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius };
        const target = context.world.blocked(candidate.x, candidate.y, 1) || !context.visible(point.x, point.y, candidate.x, candidate.y) ? point : candidate;
        context.schedule({ kind: recipe.effect, ...target, radius: recipe.radius, delay: recipe.delay + i * .18,
          duration: recipe.duration, interval: recipe.interval, damage, offense, skill: id, style: recipe.style,
          follow: recipe.follow, upkeep: costs.upkeep, slow: recipe.slow, stun: recipe.stun,
          ...(id==='rainOfArrows'&&hasUnique(p.character,'briarfall-mantle')?{travel:{vx:Math.cos(p.angle)*UNIQUE_RULES.rainTravel/Math.max(recipe.interval,(groundEffectPulseCount(recipe)-1)*recipe.interval),vy:Math.sin(p.angle)*UNIQUE_RULES.rainTravel/Math.max(recipe.interval,(groundEffectPulseCount(recipe)-1)*recipe.interval),remaining:UNIQUE_RULES.rainTravel}}:{}),
          ...(recipe.scorch ? { scorch: { duration: recipe.scorch.duration, interval: recipe.scorch.interval, dps: damage * recipe.scorch.damageMultiplier } } : {}),
          ...(recipe.burn ? { burn: { duration: recipe.burn.duration, dps: damage * recipe.burn.damageMultiplier } } : {}) });
      }
      applySelfPayload(recipe);
      break;
    }
    case 'chain': {
      const point = aimedPoint();
      const conductor=hasUnique(p.character,'stormglass-reliquary');
      if(conductor)skillEffects(p).conductor={...point,remaining:UNIQUE_RULES.conductorWindow};
      const from = conductor?{...point}:{ x: p.x, y: p.y };
      const next = living().filter(enemy => context.onScreen(enemy) && (conductor?Math.hypot(enemy.x-from.x,enemy.y-from.y)<=recipe.range+enemy.radius&&context.visible(from.x,from.y,enemy.x,enemy.y):Math.hypot(enemy.x-p.x,enemy.y-p.y)<=attack.range+enemy.radius&&visible(enemy)))
        .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
      // In a quiet area, an aimed bolt can discharge into a nearby container.
      // Enemy chains retain their own target budget and never jump through scenery.
      if (!next && context.containers) {
        const target = [...context.world.getContainers?.(p.x, p.y, attack.range) ?? []]
          .filter(t => Math.hypot(t.x - point.x, t.y - point.y) <= t.radius + 40 && containerVisible(context.world, from.x, from.y, t))
          .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
        if (target) {
          context.emit({ type: 'chain', x: from.x, y: from.y, toX: target.x, toY: target.y, skill: id, color, style: recipe.style, duration: recipe.duration });
          context.containers.break(target, Math.atan2(target.y - p.y, target.x - p.x));
        }
      }
      if (next) startChain(context.chains, from, next, damage, offense, recipe, id, color, context);
      applySelfPayload(recipe);
      break;
    }
    case 'strike': {
      const t = target;
      if (!t) { strikeWhiff(); break; }
      const angle = Math.atan2(t.y - p.y, t.x - p.x);
      let amount = damage;
      if (recipe.bonusVsDot && dotCount(t) > 0) amount *= 1 + recipe.bonusVsDot;
      if (recipe.bonusVsFrozen && frozen(t)) amount *= 1 + recipe.bonusVsFrozen;
      if (recipe.bonusBehind && behind(t)) amount *= 1 + recipe.bonusBehind;
      if (recipe.bonusVsRooted && rooted(t)) amount *= 1 + recipe.bonusVsRooted;
      if (recipe.consumeDot) {
        const dot = t.dots?.find(d => d.school === recipe.consumeDot!.school && d.remaining > 0);
        // A detonating dot pays its own detonate fraction of unpaid damage; otherwise the
        // consuming skill's multiplier converts the remaining ticks into burst.
        if (dot) { amount += dot.dps * dot.remaining * (dot.detonate ?? recipe.consumeDot.multiplier); t.dots = t.dots!.filter(d => d !== dot); }
      }
      damageTarget(t, amount, angle, true);
      context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle, range: Math.hypot(t.x - p.x, t.y - p.y), arc: Math.PI / 2, rear: false });
      strikeExtras(recipe, t, amount);
      break;
    }
    case 'dot': {
      const t = target;
      if (!t) { strikeWhiff(); break; }
      const angle = Math.atan2(t.y - p.y, t.x - p.x);
      if (recipe.direct) damageTarget(t, damage * recipe.direct, angle, false);
      context.sim.applyDot(t, recipe.dot, damage, id);
      context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle, range: Math.hypot(t.x - p.x, t.y - p.y), arc: Math.PI / 2, rear: false });
      break;
    }
    case 'heal': {
      if (recipe.pet) {
        // Mend Pet / Revive Pet act on the active pet ally, never the player.
        const pet = context.sim.petAlly();
        if (pet) {
          context.sim.healAlly(pet, (recipe.amount ?? 0) * spellBase + (recipe.maxHpFrac ?? 0) * pet.maxHp, color);
          if (recipe.hot || recipe.hotFrac) pet.regen = { remaining: recipe.hot?.duration ?? 5,
            perSecond: (recipe.hotFrac ?? 0) + ((recipe.hot?.perTick ?? 0) * spellBase + (recipe.hot?.flatTick ?? 0)) / Math.max(.1, recipe.hot?.interval ?? 1) / pet.maxHp };
        } else if (recipe.pet === 'revive' && context.sim.summonActivePet()) {
          // The fallen pet returns at full health.
        } else {
          context.emit({ type: 'notice', x: p.x, y: p.y, message: 'You have no active pet.' });
        }
        p.castTime = .18;
        break;
      }
      if (recipe.consumeAlly) {
        const allies = p.allies ?? [];
        const victim = recipe.consumeAlly === 'demon'
          ? allies.find(a => a.hp > 0 && (demonFamilyForAlly(a.kind) !== undefined || a.kind === 'doomguard' || a.kind === 'infernal'))
          : allies.find(a => a.hp > 0 && a.kind === recipe.consumeAlly);
        if (!victim) { context.emit({ type: 'notice', x: p.x, y: p.y, message: 'No minion to sacrifice.' }); break; }
        victim.hp = 0;
        context.emit({ type: 'notice', x: victim.x, y: victim.y, message: 'Sacrificed' });
        blastAt(victim.x, victim.y, 56, hitStyle);
      }
      const base = healBase(recipe.amount, recipe.maxHpFrac);
      if (base > 0) context.sim.playerHeal(base, color);
      if (recipe.hot) {
        const hot = hotToBuff(recipe.hot);
        context.sim.addBuff(definition.name, color, hot, id);
        if (base <= 0) context.emit({ type: 'heal', x: p.x, y: p.y, color, value: (hot.healPerSecond ?? 0) * p.maxHp * hot.duration });
      }
      if (recipe.consumeHot) {
        const hot = p.buffs?.find(b => (b.healPerSecond ?? 0) > 0 && b.remaining > 0);
        if (hot) { p.buffs = p.buffs!.filter(b => b !== hot); context.sim.playerHeal(spellBase * recipe.consumeHot, color); }
      }
      p.castTime = .18;
      break;
    }
    case 'hot': {
      const hot = hotToBuff(recipe.hot, recipe.maxHpFrac);
      context.sim.addBuff(definition.name, color, hot, id);
      context.emit({ type: 'heal', x: p.x, y: p.y, color, value: (hot.healPerSecond ?? 0) * p.maxHp * hot.duration });
      p.castTime = .18;
      break;
    }
    case 'buff': context.sim.addBuff(definition.name, color, recipe.buff, id); p.castTime = .18; break;
    case 'cc': {
      // Family-gated control (Banish/Shackle/Enslave) only lands on matching creatures.
      const familyOk = (e: Enemy) => !recipe.family || creatureFamily(e.kind) === recipe.family;
      if (recipe.radius) {
        // Point-targeted control centers on the aim point; otherwise on the player.
        const center = (costs.targetMode ?? 'point') === 'point' ? aimedPoint() : p;
        let hit = 0;
        radialAround(center.x, center.y, recipe.radius, enemy => { if (familyOk(enemy) && hit < (recipe.maxTargets ?? 99)) { hit++; context.sim.applyCc(enemy, recipe.cc, recipe.duration, recipe.cc === 'incapacitate' || recipe.cc === 'polymorph'); } });
        blastAt(center.x, center.y, recipe.radius, hitStyle);
      } else if (target && familyOk(target)) { context.sim.applyCc(target, recipe.cc, recipe.duration, recipe.cc === 'incapacitate' || recipe.cc === 'polymorph'); blastAt(target.x, target.y, 56, hitStyle); }
      else blastAt(p.x, p.y, 56, hitStyle);
      if (recipe.resourceGain) p.mana = Math.min(p.maxMana, p.mana + recipe.resourceGain);
      p.castTime = .18;
      break;
    }
    case 'interrupt': {
      const t = target;
      if (!t) { strikeWhiff(); blastAt(p.x, p.y, 56, hitStyle); break; }
      context.sim.applyCc(t, 'silence', recipe.silence, false);
      t.interrupted = true;
      applyStun(t, .15, 'stagger');
      context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle: Math.atan2(t.y - p.y, t.x - p.x), range: Math.hypot(t.x - p.x, t.y - p.y), arc: Math.PI / 2, rear: false });
      blastAt(t.x, t.y, 56, hitStyle);
      break;
    }
    case 'pull': {
      const t = target;
      if (!t) { strikeWhiff(); blastAt(p.x, p.y, 56, hitStyle); break; }
      const angle = Math.atan2(p.y - t.y, p.x - t.x);
      const distance = Math.max(0, Math.hypot(t.x - p.x, t.y - p.y) - (p.radius + t.radius + 8));
      // Tether visual from the player to the target's pre-pull position (Death Grip).
      context.emit({ type: 'chain', x: p.x, y: p.y, toX: t.x, toY: t.y, duration: .3, color, style: hitStyle });
      const to = context.world.move(t.x, t.y, Math.cos(angle) * distance, Math.sin(angle) * distance, t.radius);
      t.x = to.x; t.y = to.y;
      t.awareness = Math.max(t.awareness, 1);
      if (recipe.stun) applyStun(t, recipe.stun);
      context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle, range: distance, arc: Math.PI / 2, rear: false });
      blastAt(t.x, t.y, 56, hitStyle);
      break;
    }
    case 'taunt': {
      const t = target;
      if (!t) { strikeWhiff(); blastAt(p.x, p.y, 56, hitStyle); break; }
      t.taunted = { remaining: recipe.duration };
      tauntThreat(t, 'player');
      if (recipe.expose) sunder(t, recipe.expose);
      context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle: Math.atan2(t.y - p.y, t.x - p.x), range: Math.hypot(t.x - p.x, t.y - p.y), arc: Math.PI / 2, rear: false });
      blastAt(t.x, t.y, 56, hitStyle);
      break;
    }
    case 'summon': {
      context.sim.summonAlly(recipe.ally, recipe.count, recipe.duration);
      if (recipe.stun) {
        const point = aimedPoint();
        for (const enemy of living()) {
          if (Math.hypot(enemy.x - point.x, enemy.y - point.y) <= (recipe.radius ?? 40)) context.sim.applyCc(enemy, 'stun', recipe.stun, false);
        }
      }
      p.castTime = .18;
      break;
    }
    case 'tame': {
      const t = target;
      if (!t) break;
      const result = context.sim.tameBeast(t);
      if (result !== 'tamed') context.emit({ type: 'notice', x: p.x, y: p.y,
        message: result === 'full' ? 'Your stable is full.' : 'That beast cannot be tamed.' });
      p.castTime = .18;
      break;
    }
    case 'channel': {
      // Initiate the channel; the sim owns subsequent ticks and re-invokes this handler per tick.
      // The initial channelTick below counts as the first tick.
      p.cast = { skill: id, remaining: recipe.duration, duration: recipe.duration, channel: true, ticksDone: 1,
        ...(target ? { targetId: target.id, breakRange: (costs.range ?? attack.range) + target.radius } : { x: context.aimX, y: context.aimY }) };
      channelTick(recipe);
      break;
    }
    case 'form': context.sim.addBuff(definition.name, color, { ...recipe.buff, exclusiveGroup: 'form', form: recipe.form }, id); p.castTime = .18; break;
    case 'stealth': {
      p.stealthed = true;
      context.sim.addBuff(definition.name, color, { duration: recipe.duration, stealth: true }, id);
      if (recipe.dropAggro) for (const e of enemies) { e.awareness = 0; e.seesPlayer = false; if (e.taunted?.allyId === undefined) delete e.taunted; }
      p.castTime = .18;
      break;
    }
    case 'comboStrike': {
      const t = target;
      if (!t) { strikeWhiff(); break; }
      const angle = Math.atan2(t.y - p.y, t.x - p.x);
      const pts = recipe.spend ? context.sim.spendComboPoints() : 0;
      const dealt = damage * (recipe.spend ? Math.max(1, pts) : 1);
      // Builders award their point before the hit lands so a killing blow still pays it.
      if (recipe.build) for (let i = 0; i < recipe.build; i++) context.sim.addComboPoint();
      damageTarget(t, dealt, angle, true);
      context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle, range: Math.hypot(t.x - p.x, t.y - p.y), arc: Math.PI / 2, rear: false });
      if (recipe.dot) context.sim.applyDot(t, recipe.dot, dealt, id);
      if (recipe.sunder) sunder(t, recipe.sunder);
      if (recipe.stunPerCombo) applyStun(t, recipe.stunPerCombo * (recipe.spend ? pts : 1));
      if (recipe.buffPerCombo) context.sim.addBuff(definition.name, color, { ...recipe.buffPerCombo, duration: recipe.buffPerCombo.duration * (recipe.spend ? pts : 1) }, id);
      break;
    }
    case 'runeStrike': {
      const t = target;
      if (!t) { strikeWhiff(); break; }
      const angle = Math.atan2(t.y - p.y, t.x - p.x);
      const dealt = damage * (1 + (recipe.diseaseBonus ?? 0) * dotCount(t));
      damageTarget(t, dealt, angle, true);
      context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle, range: Math.hypot(t.x - p.x, t.y - p.y), arc: Math.PI / 2, rear: false });
      if (recipe.dot) context.sim.applyDot(t, recipe.dot, dealt, id);
      if (recipe.healFrac) context.sim.playerHeal(dealt * recipe.healFrac, color);
      break;
    }
    case 'cleanse': {
      if (recipe.hpCost) p.hp = Math.max(1, p.hp - p.maxHp * recipe.hpCost);
      // removeCc clears player CC and leaves a 1s control-immunity window (breakControl).
      if (recipe.removeCc) context.sim.addBuff(definition.name, color, { duration: 1, breakControl: true }, id);
      if (recipe.heal) context.sim.playerHeal(recipe.heal * p.maxHp, color);
      if (recipe.resourceGainFrac) p.mana = Math.min(p.maxMana, p.mana + p.maxMana * recipe.resourceGainFrac);
      else if (recipe.resourceGain) p.mana = Math.min(p.maxMana, p.mana + recipe.resourceGain);
      if (recipe.buff) context.sim.addBuff(definition.name, color, recipe.buff);
      // Offensive dispel: the resolved enemy target loses buffs; dispelRadius
      // widens it to an area centered on the target (or the aimed point).
      if (recipe.dispelRadius) {
        const center = target ?? aimedPoint();
        radialAround(center.x, center.y, recipe.dispelRadius, enemy => stripBuffs(recipe, enemy));
      } else if (target) stripBuffs(recipe, target);
      if (recipe.steal && !p.buffs?.some(b => b.id === `${id}:steal`))
        context.emit({ type: 'notice', x: p.x, y: p.y, message: 'Nothing to steal.' });
      p.castTime = .18;
      break;
    }
    default: {
      // A new skill must implement behavior before its content can compile.
      const unimplemented: never = recipe;
      throw new Error(`Missing skill execution handler: ${unimplemented}`);
    }
  }
  // Non-damaging activations ring in the skill's school color (class color when unschooled), never the weapon's impact style.
  if (ACTIVATION_RING[recipe.kind]) blastAt(p.x, p.y, ('radius' in recipe ? recipe.radius : undefined) ?? 56, schoolProjectileStyle(castSchoolStyle(p, id)));
  p.castDuration = p.castTime;
  context.emit({ type: 'cast', x: p.x, y: p.y, angle: p.angle, skill: id, color, ...(launch ? { launch } : {}) });
  return true;
}
