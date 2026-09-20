import { enemyMovementMultiplier } from './enemy-modifiers.ts';
import { BOSS_PRESSURE, bossQuickMove, updateBossPressure } from './boss-pressure.ts';
import { enemyRecoveryDuration, enemyWindupDuration } from './enemy-threat.ts';
import type { Ally, DamageType, Enemy } from './model.ts';
import type { EnemyAIContext } from './enemy-ai.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { alertEnemy, transitionEnemy } from './enemy-state.ts';
import { circleIntersectsSector, segmentDistanceSquared } from './combat-geometry.ts';
import { pushChatMessage } from './chat-log.ts';
import { isRaid3Boss, KELTHUZAD_RULES as R } from './raid3-boss-content.ts';

/**
 * Kel'Thuzad's raid AI (docs/wow-deepening.md §15, third wave), modeled on the
 * real WotLK Naxxramas fight and built on the wilderness-boss state machine.
 * Kel'Thuzad is rooted on his dais: he never chases — Frost Blast covers melee
 * range, Frost Bolt / Frost Bolt Volley / Shadow Fissure reach the whole arena.
 *
 *   P1 100–65%  Frost Blast + Mana Detonation, quick Frost Bolt pressure,
 *               Shadow Fissure void zones and Frost Bolt Volley novas.
 *   P2  65–30%  First Guardian call: Guardians of Icecrown stream in (wave
 *               bit 1, admitted by updateDungeon). Chains of Kel'Thuzad begins
 *               on its cadence — each cast binds a pack of enthralled souls
 *               (wave bits 4/8/16) or detonates for shadow damage once the
 *               packs are spent.
 *   P3  30– 0%  Second Guardian call + veteran Guardians and Unstoppable
 *               Abominations (wave bit 2); afterwards his tempo quickens and
 *               Shadow Fissure creeps across the floor as a projected lane.
 *   Enrage      Fury of the Lich King at R.enrageAfter seconds of engagement:
 *               +120% damage and a pulsing arena-wide frost until the wipe.
 *
 * Solo+allies scaling: hostiles are picked from the player and live allies
 * (nearest wins), outgoing damage eases 10% per ally (cap 30%), and AoE
 * mechanics hit every hostile in their footprint.
 */

interface VoidZone { x: number; y: number; remaining: number; tick: number }
interface Raid3State {
  engagedAt: number;
  enragePulse: number;
  warned: number; // bitmask of issued enrage warnings
  voids: VoidZone[];
  nextChains: number; // sim time when Chains of Kel'Thuzad is next due; 0 = not yet scheduled
}
const raid = new WeakMap<Enemy, Raid3State>();
const state = (e: Enemy): Raid3State => {
  let s = raid.get(e);
  if (!s) { s = { engagedAt: -1, enragePulse: 0, warned: 0, voids: [], nextChains: 0 }; raid.set(e, s); }
  return s;
};

/** Seconds of enrage timer remaining; negative once Fury of the Lich King is active. */
export function raid3EnrageRemaining(e: Enemy, now: number): number | undefined {
  if (!isRaid3Boss(e)) return undefined;
  const s = raid.get(e);
  if (!s || s.engagedAt < 0) return R.enrageAfter;
  return R.enrageAfter - (now - s.engagedAt);
}

/** Live Shadow Fissure void zones for the art layer. */
export function raid3Voids(e: Enemy): readonly { x: number; y: number; remaining: number }[] {
  return raid.get(e)?.voids ?? [];
}
type Hostile = { x: number; y: number; radius: number; dead: boolean; ally?: Ally };

export function updateRaid3Boss(e: Enemy, dt: number, c: EnemyAIContext): void {
  if (!isRaid3Boss(e)) return;
  const def = ENEMY_DEFINITIONS[e.kind], s = state(e), player = c.player;
  const allies = c.allies ?? [];

  // Nearest living hostile: the player or an ally (pets/minions/totems count).
  let hostile: Hostile = { x: player.x, y: player.y, radius: player.radius, dead: player.dead };
  let best = Math.hypot(player.x - e.x, player.y - e.y);
  for (const a of allies) {
    if (a.hp <= 0) continue;
    const d = Math.hypot(a.x - e.x, a.y - e.y);
    if (d < best) { best = d; hostile = { x: a.x, y: a.y, radius: a.radius, dead: false, ally: a }; }
  }
  const p = hostile, d = best, angle = Math.atan2(p.y - e.y, p.x - e.x);
  const allyEase = 1 - Math.min(R.allyDamageEaseMax, R.allyDamageEase * allies.filter(a => a.hp > 0).length);
  const enraged = s.engagedAt >= 0 && c.time - s.engagedAt >= R.enrageAfter;
  const power = e.damage * allyEase * (enraged ? R.enrageDamage : 1);

  const hurtHostile = (amount: number, hitAngle: number, h: Hostile, type: DamageType) => {
    if (h.ally) c.hurtAlly?.(h.ally, amount, hitAngle, e);
    else c.hurt(amount, hitAngle, e, type);
  };
  /** AoE contact: every hostile inside `radius` of (x,y) takes damage once. */
  const blastHostiles = (x: number, y: number, radius: number, amount: number, type: DamageType): boolean => {
    let hit = false;
    if (!player.dead && Math.hypot(player.x - x, player.y - y) <= radius + player.radius) {
      hit = true; c.hurt(amount, Math.atan2(player.y - y, player.x - x), e, type);
    }
    for (const a of allies)
      if (a.hp > 0 && Math.hypot(a.x - x, a.y - y) <= radius + a.radius) {
        hit = true; c.hurtAlly?.(a, amount, Math.atan2(a.y - y, a.x - x), e);
      }
    return hit;
  };
  const walk = (x: number, y: number, speed: number) => {
    speed *= enemyMovementMultiplier(e);
    const target = c.world.navigationTarget?.(e.x, e.y, x, y, e.radius + 1) ?? { x, y };
    const length = Math.hypot(target.x - e.x, target.y - e.y);
    if (length > .5) { e.angle = Math.atan2(target.y - e.y, target.x - e.x); c.move(e, (target.x - e.x) / length * speed, (target.y - e.y) / length * speed, dt); }
  };

  // ── Leash: leaving the crypt (or wiping) sends him home and resets the fight clock.
  if (player.dead || c.world.isSanctuary?.(player.x, player.y)
    || Math.hypot(player.x - e.homeX, player.y - e.homeY) > R.leash || Math.hypot(e.x - e.homeX, e.y - e.homeY) > R.leash) {
    if (e.state !== 'return') { transitionEnemy(e, 'return'); e.bossMove = undefined; e.awareness = 0; e.burnTime = 0; e.slowTime = 0; }
  }
  if (e.state === 'return') {
    if (Math.hypot(e.x - e.homeX, e.y - e.homeY) < 12) {
      raid.delete(e); // fresh engagement clock, void field and Chains cadence next pull
      e.bossTurns = 0;
      transitionEnemy(e, 'idle', 1);
    } else walk(e.homeX, e.homeY, def.speed * 1.5);
    return;
  }
  if (e.state === 'idle' || e.state === 'patrol') {
    if ((d < R.awareness && c.visible(e.x, e.y, p.x, p.y)) || e.awareness >= 1) {
      alertEnemy(e, p);
      s.engagedAt = c.time;
      s.nextChains = c.time + R.chainsAfter;
      pushChatMessage(player, 'system', 'Kel\'Thuzad rasps: "Who dares violate the sanctity of my domain? Be warned — all who trespass here are doomed!"', c.time);
    } else return;
  }
  if (s.engagedAt < 0) { s.engagedAt = c.time; s.nextChains = c.time + R.chainsAfter; } // re-engaged after a wound restore
  if (e.interrupted) e.interrupted = false;

  // ── Fury of the Lich King: hard enrage — pulsing arena frost + warnings.
  if (enraged) {
    if (!(s.warned & 4)) { s.warned |= 4; pushChatMessage(player, 'system', 'Kel\'Thuzad channels the Fury of the Lich King — "Your petty magics are no challenge to the might of the Scourge!"', c.time); }
    s.enragePulse -= dt;
    if (s.enragePulse <= 0) {
      s.enragePulse = R.enragePulse;
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: R.enrageRadius, duration: .5, color: '#8fd8ff' });
      blastHostiles(e.x, e.y, R.enrageRadius, power * .8, 'frost');
    }
  } else {
    const left = R.enrageAfter - (c.time - s.engagedAt);
    if (left <= 60 && !(s.warned & 1)) { s.warned |= 1; pushChatMessage(player, 'system', 'Kel\'Thuzad grows impatient — the cold in the crypt deepens!', c.time); }
    if (left <= 15 && !(s.warned & 2)) { s.warned |= 2; pushChatMessage(player, 'system', 'Kel\'Thuzad\'s fury is about to peak!', c.time); }
  }

  // ── Shadow Fissure void zones left by eruptions and fissure creeps.
  for (let i = s.voids.length - 1; i >= 0; i--) {
    const z = s.voids[i];
    z.remaining -= dt; z.tick -= dt;
    if (z.tick <= 0) { z.tick = R.voidInterval; blastHostiles(z.x, z.y, R.voidRadius, power * R.voidDps, 'shadow'); }
    if (z.remaining <= 0) s.voids.splice(i, 1);
  }
  const voidZone = (x: number, y: number) => {
    if (s.voids.length >= R.voidMax) s.voids.shift();
    s.voids.push({ x, y, remaining: R.voidDuration, tick: R.voidInterval });
  };

  if (e.state === 'recover') { if (e.stateTime >= e.stateDuration) transitionEnemy(e, 'chase'); return; }

  if (updateBossPressure(e, c)) return;

  const phase = e.hp / e.maxHp <= R.phaseThree ? 2 : e.hp / e.maxHp <= R.phaseTwo ? 1 : 0;

  if (e.state === 'chase') {
    e.angle = angle; e.seesPlayer = c.visible(e.x, e.y, p.x, p.y);
    // Phase transitions commit a 'summon' flourish — the Guardian call. The wave
    // bits (set here since 'warden' gets no auto-bits) gate Guardian admission.
    const bit = phase === 1 && !((e.bossPhases ?? 0) & 1) ? 1 : phase === 2 && !((e.bossPhases ?? 0) & 2) ? 2 : 0;
    if (bit) {
      e.bossPhases = (e.bossPhases ?? 0) | bit;
      e.bossMove = 'summon';
      e.attackVariant = 0;
      e.bossTurns = (e.bossTurns ?? 0) + 1;
      e.attackAngle = angle; e.attackTargetX = p.x; e.attackTargetY = p.y; e.bossHits = 0;
      e.attackDamage = power;
      transitionEnemy(e, 'windup', enemyWindupDuration(e, 1.4));
      return;
    }
    // Chains of Kel'Thuzad on its cadence: a 'summon' flourish (attackVariant 2)
    // that binds the next pack of enthralled souls — or detonates for shadow
    // damage once all three packs are spent.
    if (s.nextChains > 0 && c.time >= s.nextChains) {
      s.nextChains = c.time + R.chainsEvery;
      e.bossMove = 'summon';
      e.attackVariant = 2;
      e.bossTurns = (e.bossTurns ?? 0) + 1;
      e.attackAngle = angle; e.attackTargetX = p.x; e.attackTargetY = p.y; e.bossHits = 0;
      e.attackDamage = power * 1.1;
      transitionEnemy(e, 'windup', enemyWindupDuration(e, 1.2));
      return;
    }
    // Rooted on the dais: he pivots to face his target but never chases.
    const turns = e.bossTurns ?? 0;
    let move: Enemy['bossMove'];
    if (turns % 2) move = bossQuickMove(d, p.radius);
    else if (phase === 2) move = ['sweep', 'command', 'fracture', 'rush', 'eruption'][Math.floor(turns / 2) % 5] as Enemy['bossMove'];
    else move = ['sweep', 'command', 'fracture', 'eruption'][Math.floor(turns / 2) % 4] as Enemy['bossMove'];
    if (move === 'sweep' && d > R.blastReach + 10) move = phase === 2 ? 'command' : 'eruption';
    if (move === 'command' && d > R.volleyRadius + 10) move = 'eruption';
    e.bossMove = move; e.bossTurns = turns + 1;
    e.bossOriginX = e.x; e.bossOriginY = e.y;
    e.attackAngle = angle; e.attackTargetX = p.x; e.attackTargetY = p.y; e.bossHits = 0;
    const quick = e.bossMove === 'jab' || e.bossMove === 'bolt' ? BOSS_PRESSURE[e.bossMove] : null;
    e.attackDamage = power * (quick?.damage ?? (e.bossMove === 'sweep' ? 1 : 1.15));
    const warning = quick?.windup ?? (e.bossMove === 'sweep' ? .9 : e.bossMove === 'rush' ? 1.5 : e.bossMove === 'command' ? 1.2 : e.bossMove === 'eruption' ? 1.1 : 1.15);
    transitionEnemy(e, 'windup', enemyWindupDuration(e, warning));
    return;
  }

  if (e.state === 'windup') {
    if (e.stateTime < e.stateDuration) return;
    const move = e.bossMove;
    if (move === 'summon') {
      if (e.attackVariant === 2) {
        // Chains of Kel'Thuzad: bind the next soul pack; once all packs are spent
        // the chains lash out as a shadow burst instead.
        const pack = R.chainsBits.find(b => !((e.bossPhases ?? 0) & b));
        if (pack !== undefined) {
          e.bossPhases = (e.bossPhases ?? 0) | pack;
          c.emit({ type: 'blast', x: e.x, y: e.y, radius: 190, duration: .8, color: '#8a5adf' });
          pushChatMessage(player, 'system', 'Kel\'Thuzad hisses: "Your soul is bound to me now!"', c.time);
        } else {
          blastHostiles(p.x, p.y, 150, e.attackDamage ?? power, 'shadow');
          c.emit({ type: 'blast', x: p.x, y: p.y, radius: 150, duration: .6, color: '#8a5adf' });
          pushChatMessage(player, 'system', 'Kel\'Thuzad hisses: "There is no escape!"', c.time);
        }
      } else {
        // Guardian call: the wave bit was set at commit; the flourish only announces it.
        c.emit({ type: 'blast', x: e.x, y: e.y, radius: 220, duration: .9, color: '#8fd8ff' });
        pushChatMessage(player, 'system', (e.bossPhases ?? 0) & 2
          ? 'Kel\'Thuzad calls out: "Minions, servants, soldiers of the cold dark — obey the call of Kel\'Thuzad!"'
          : 'Kel\'Thuzad calls out: "Minions, servants, soldiers of the cold dark — obey the call of Kel\'Thuzad!"', c.time);
      }
      e.attackVariant = 0;
      transitionEnemy(e, 'recover', enemyRecoveryDuration(e, 1.5));
      return;
    }
    transitionEnemy(e, 'attack', move === 'rush' ? .8 : move === 'fracture' ? .7 : move === 'eruption' ? 1.4 : move === 'command' ? .5 : .28);
    if (move === 'rush') {
      c.emit({ type: 'cast', x: e.x, y: e.y, angle: e.attackAngle, enemyKind: e.kind, style: 'shadow' });
    } else {
      c.emit({ type: 'blast', x: move === 'eruption' ? e.attackTargetX : e.x, y: move === 'eruption' ? e.attackTargetY : e.y,
        radius: move === 'eruption' ? R.fissureRadius : move === 'command' ? 130 : 80, duration: .45,
        color: move === 'eruption' ? '#8a5adf' : move === 'fracture' ? '#c9a8ff' : '#8fd8ff' });
    }
  }
  if (e.state !== 'attack') return;

  let hit = false;
  if (e.bossMove === 'sweep') // Frost Blast: frontal freeze cone.
    hit = circleIntersectsSector(p.x, p.y, p.radius, e.x, e.y, e.attackAngle, R.blastReach, R.blastArc);
  if (e.bossMove === 'fracture') // Mana Detonation: three staggered arcane lanes.
    for (let i = 0; i < R.detonateOffsets.length; i++) {
      if (e.stateTime < i * .2 || ((e.bossHits ?? 0) & 1 << i)) continue;
      e.bossHits = (e.bossHits ?? 0) | 1 << i;
      const a = e.attackAngle + R.detonateOffsets[i], ox = e.bossOriginX!, oy = e.bossOriginY!;
      c.emit({ type: 'blast', x: ox + Math.cos(a) * 200, y: oy + Math.sin(a) * 200, radius: 56, duration: .4, color: '#c9a8ff' });
      hit ||= segmentDistanceSquared(p.x, p.y, ox, oy, ox + Math.cos(a) * R.detonateLength, oy + Math.sin(a) * R.detonateLength) < (R.detonateWidth + p.radius) ** 2;
    }
  if (e.bossMove === 'eruption') { // Shadow Fissure: void detonation at the committed target; the zone lingers.
    hit = Math.hypot(p.x - e.attackTargetX, p.y - e.attackTargetY) < R.fissureRadius + p.radius;
    if (e.stateTime >= e.stateDuration - .05 && !((e.bossHits ?? 0) & 1)) { e.bossHits = (e.bossHits ?? 0) | 1; voidZone(e.attackTargetX, e.attackTargetY); }
  }
  if (e.bossMove === 'rush') { // Shadow Fissure creep: a void front travels the lane; Kel'Thuzad stays rooted.
    const t = Math.min(1, e.stateTime / Math.max(.01, e.stateDuration));
    const fx = e.bossOriginX! + Math.cos(e.attackAngle) * R.creepLength * t;
    const fy = e.bossOriginY! + Math.sin(e.attackAngle) * R.creepLength * t;
    hit = segmentDistanceSquared(p.x, p.y, e.bossOriginX!, e.bossOriginY!, fx, fy) < (R.creepWidth + p.radius) ** 2;
    if (!((e.bossHits ?? 0) & 1) && e.stateTime >= e.stateDuration * .5) { e.bossHits = (e.bossHits ?? 0) | 1; voidZone(fx, fy); }
  }
  if (e.bossMove === 'command') // Frost Bolt Volley: arena-wide nova around him.
    hit = d < R.volleyRadius + p.radius;
  if (hit && !e.attackHit && c.visible(e.x, e.y, p.x, p.y)) {
    e.attackHit = true;
    if (e.bossMove === 'command') blastHostiles(e.x, e.y, R.volleyRadius, e.attackDamage ?? power * 1.15, 'frost');
    else hurtHostile(e.attackDamage ?? power, e.attackAngle, p,
      e.bossMove === 'fracture' ? 'arcane' : e.bossMove === 'eruption' || e.bossMove === 'rush' ? 'shadow' : 'frost');
  }
  if (e.stateTime >= e.stateDuration)
    transitionEnemy(e, 'recover', enemyRecoveryDuration(e,
      e.bossMove === 'command' ? 1.3 : e.bossMove === 'rush' ? 1 : phase === 2 ? .8 : 1.15));
}
