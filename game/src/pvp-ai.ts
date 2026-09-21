import type { Input } from './model.ts';
import type { SkillId } from './character-types.ts';
import type { SkillExecution } from './skill-execution-content.ts';
import { resolvePlayerSkill } from './glyph-state.ts';
import { knowsSkill } from './skill-progression.ts';
import { deriveAttackStats } from './equipment.ts';
import { wowClassOf } from './wow-classes.ts';
import { RACIAL_SLOT } from './action-bar.ts';
import { racialSkillId } from './character.ts';
import { isWowRaceId } from './wow-types.ts';
import type { Combatant } from './pvp-combatant.ts';
import { combatantControl } from './pvp-status.ts';
import { objectiveDirective } from './pvp-directives.ts';

/** What the AI sees each fixed step: itself plus living allies/enemies. */
export interface CombatantView {
  readonly self: Combatant;
  /** Living teammates including the combatant itself (self-heal triage). */
  readonly allies: readonly Combatant[];
  /** Living hostile combatants. */
  readonly hostiles: readonly Combatant[];
  readonly time: number;
}

const RETARGET_INTERVAL = 0.5;
/** Below this health fraction a combatant looks for defensives, heals and potions. */
const DEFENSIVE_HP = 0.45;
const POTION_HP = 0.35;
/** Healers triage allies below this fraction. */
const HEAL_ALLY_HP = 0.6;
/** Skills with a cast time are only started while standing (or nearly) still. */
const CAST_MOVE_TOLERANCE = 30;

/** Focus-fire: lowest health fraction wins, nearest breaks ties. */
function pickTarget(view: CombatantView): Combatant | undefined {
  const c = view.self;
  const current = view.hostiles.find(hostile => hostile.id === (c.ai.focusId ?? c.targetId));
  if (current && view.time < c.ai.retargetAt) return current;
  let best: Combatant | undefined;
  let bestScore = Infinity;
  for (const hostile of view.hostiles) {
    const distance = Math.hypot(hostile.x - c.x, hostile.y - c.y);
    const score = hostile.hp / hostile.maxHp * 1000 + distance;
    if (score < bestScore) { bestScore = score; best = hostile; }
  }
  c.ai.retargetAt = view.time + RETARGET_INTERVAL;
  return best;
}

interface SkillChoice { slot: number; score: number }

/** Scores one action-bar skill for this tick; negative means "not usable now". */
function scoreSkill(view: CombatantView, id: SkillId, target: Combatant | undefined, hurtAlly: boolean): number {
  const c = view.self;
  const costs = resolvePlayerSkill(id, c);
  const recipe: SkillExecution = costs.recipe;
  if (recipe.kind === 'aura' || recipe.kind === 'tame') return -1;
  if ((c.skillCooldowns[id] ?? 0) > 0) return -1;
  if (c.mana < costs.mana) return -1;
  if (!costs.offGcd && (c.gcdReady ?? 0) > view.time) return -1;
  if (costs.classId && costs.classId !== wowClassOf(c.character)?.id) return -1;
  if (costs.requiresStealth && !c.stealthed) return -1;
  if (costs.requiresForm && c.buffs?.find(buff => buff.form && buff.remaining > 0)?.form !== costs.requiresForm) return -1;
  if (costs.requiresAlly) {
    const allies = c.allies ?? [];
    const found = costs.requiresAlly === 'demon' ? allies.some(ally => ally.hp > 0) : allies.some(ally => ally.hp > 0 && ally.kind === costs.requiresAlly);
    if (!found) return -1;
  }
  const mode = costs.targetMode ?? 'point';
  const distance = target ? Math.hypot(target.x - c.x, target.y - c.y) : Infinity;
  /** Weapon reach — melee-range checks. `costs.range` is the skill's own range
   * (a 350-range Charge must not count as "already in melee"). */
  const meleeReach = deriveAttackStats(c.stats, c.equipment.mainHand).range + (target?.radius ?? 0);
  const reach = (costs.range ?? meleeReach - (target?.radius ?? 0)) + (target?.radius ?? 0);
  const targetRequired = mode === 'enemy';
  if (targetRequired && !target) return -1;
  const inReach = !!target && distance <= meleeReach + 4;
  const casting = (costs.castTime ?? 0) > 0 || !!costs.channel;
  if (casting && Math.hypot(c.vx, c.vy) > CAST_MOVE_TOLERANCE) return -1;
  if (costs.executeThreshold && (!target || target.hp / target.maxHp > costs.executeThreshold)) return -1;
  if (costs.combo === 'spend' && (c.comboPoints ?? 0) < 1) return -1;
  if ((costs.shardCost ?? 0) > (c.soulShards ?? 0)) return -1;
  if (costs.requiresFrozen && !(target && ((target.freezeTime ?? 0) > 0 || target.cc?.some(cc => cc.kind === 'freeze' && cc.remaining > 0)))) return -1;
  if (costs.requiresBehind || (recipe.kind === 'comboStrike' && recipe.requiresBehind)) return -1;
  if (recipe.kind === 'comboStrike' && recipe.requiresStealth && !c.stealthed) return -1;

  const lowHp = c.hp / c.maxHp <= DEFENSIVE_HP;
  switch (recipe.kind) {
    case 'heal': {
      if (recipe.pet) return (c.allies ?? []).some(ally => ally.hp > 0 && ally.hp < ally.maxHp * .8) ? 70 : -1;
      return lowHp || (c.ai.role === 'healer' && hurtAlly) ? 80 : -1;
    }
    case 'hot':
      return lowHp || (c.ai.role === 'healer' && hurtAlly) ? 80 : -1;
    case 'cleanse': {
      if (recipe.hpCost) return c.hp / c.maxHp > .5 && c.mana < c.maxMana * .5 ? 40 : -1;
      const controlled = (c.cc?.length ?? 0) > 0 || (c.stunTime ?? 0) > 0;
      if (recipe.removeCc && controlled) return 85;
      if (recipe.heal && lowHp) return 78;
      return -1;
    }
    case 'guard': case 'ward': case 'stance': {
      const active = c.guardTime > 0 || !!c.skillEffects?.ward || (c.buffs ?? []).some(buff => buff.id === id && buff.remaining > 0);
      return !active && lowHp ? 90 : -1;
    }
    case 'interrupt':
      return target && target.cast && inReach ? 95 : -1;
    case 'cc':
      if (!target) return -1;
      if (recipe.radius) return distance <= (costs.range ?? recipe.radius) + 40 ? 55 : -1;
      return inReach ? 55 : -1;
    case 'pull':
      return target && c.ai.role !== 'ranged' && distance > meleeReach * .8 && distance <= (costs.range ?? 400) ? 60 : -1;
    case 'taunt':
      return c.ai.role === 'tank' && target && inReach ? 50 : -1;
    case 'buff': case 'form': {
      const active = (c.buffs ?? []).some(buff => buff.id === id && buff.remaining > 0);
      return active ? -1 : 30;
    }
    case 'summon':
      return (c.allies ?? []).filter(ally => ally.hp > 0).length < 2 ? 35 : -1;
    case 'step':
      return target && c.ai.role !== 'melee' && c.ai.role !== 'tank' && distance < c.ai.preferredRange * .5 ? 45 : -1;
    case 'dash':
      return target && !inReach && distance <= (costs.range ?? 300) ? 50 : -1;
    case 'sweep': case 'cone': case 'backstab': case 'strike': case 'comboStrike': case 'runeStrike': case 'dot':
      return inReach ? 40 + costs.damageMultiplier * 10 : -1;
    case 'projectile': case 'chain':
      return target && distance <= reach + 40 ? 40 + costs.damageMultiplier * 10 : -1;
    case 'ground': case 'radial': case 'channel': {
      const near = view.hostiles.filter(h => Math.hypot(h.x - c.x, h.y - c.y) <= (recipe.radius ?? 100) + (costs.range ?? 0));
      return near.length ? 38 + costs.damageMultiplier * 10 + near.length * 2 : -1;
    }
    default:
      return -1;
  }
}

/**
 * Synthesizes one fixed-step Input for an NPC combatant. The same fields the
 * player's keyboard fills: movement, aim, attack/auto-attack, dodge, potion and
 * a single skill slot — so NPCs obey identical GCD/cast/cost rules.
 */
export function decideCombatantInput(view: CombatantView): Input {
  const c = view.self;
  const input: Input = { moveX: 0, moveY: 0, aimX: c.x + Math.cos(c.angle), aimY: c.y + Math.sin(c.angle),
    attack: false, dodge: false, heal: false, skillSlot: null };
  if (c.dead) return input;
  const control = combatantControl(c);
  if (control.cantAct || control.feared) return input;

  const target = pickTarget(view);
  if (target) {
    input.targetId = target.id;
    input.aimX = target.x; input.aimY = target.y;
  }

  // ── Skill choice ──
  const hurtAlly = view.allies.some(ally => ally.hp < ally.maxHp * HEAL_ALLY_HP);
  const choices: SkillChoice[] = [];
  const consider = (slot: number, id: SkillId | null | undefined) => {
    if (!id || !knowsSkill(c.character, id)) return;
    const score = scoreSkill(view, id, target, hurtAlly);
    if (score >= 0) choices.push({ slot, score });
  };
  c.character.skillSlots.forEach((id, slot) => consider(slot, id));
  if (isWowRaceId(c.character.raceId)) consider(RACIAL_SLOT, racialSkillId(c.character));
  const best = choices.reduce((a, b) => (b.score > a.score ? b : a), choices[0]!);
  if (choices.length) input.skillSlot = best.slot;

  // ── Potion ──
  if (c.flasks > 0 && c.healCooldown <= 0 && c.hp < c.maxHp * POTION_HP) input.heal = true;

  // ── Movement ──
  if (target && !control.rooted) {
    const distance = Math.hypot(target.x - c.x, target.y - c.y);
    const reach = deriveAttackStats(c.stats, c.equipment.mainHand).range + target.radius;
    const casting = !!c.cast || c.castTime > 0;
    let want = 0; // -1 away, +1 toward
    if (c.ai.role === 'melee' || c.ai.role === 'tank') want = distance > reach * .9 ? 1 : 0;
    else {
      const preferred = c.ai.preferredRange;
      if (distance < preferred - 30) want = -1;
      else if (distance > preferred + 60) want = 1;
    }
    if (casting && want < 0) want = 0; // don't break a cast to kite
    if (want !== 0) {
      const ux = (target.x - c.x) / Math.max(1, distance), uy = (target.y - c.y) / Math.max(1, distance);
      input.moveX = ux * want; input.moveY = uy * want;
    }
    // Auto-attack inside weapon reach; the sim keeps it swinging on the target.
    if (distance <= reach + 4) input.attack = true;
    // Cornered and hurt: dodge away from the attacker.
    if (c.dodgeCharges > 0 && c.hp < c.maxHp * .3 && distance < 40) input.dodge = true;
  }
  // Objective layer (battlegrounds): a directive steers the combatant to its
  // objective — flag stand, carrier, node — yielding to base combat movement
  // only while a hostile is inside the directive's engage radius (0 = never
  // divert: flag carriers keep running). On arrival it holds position instead
  // of chasing distant targets.
  const directive = objectiveDirective(c);
  if (directive && !control.rooted) {
    const d = Math.hypot(directive.x - c.x, directive.y - c.y);
    const engaged = view.hostiles.some(h => Math.hypot(h.x - c.x, h.y - c.y) <= directive.engage);
    if (!engaged) {
      if (d > directive.within) {
        input.moveX = (directive.x - c.x) / d; input.moveY = (directive.y - c.y) / d;
      } else {
        input.moveX = 0; input.moveY = 0;
      }
    }
  }
  return input;
}
