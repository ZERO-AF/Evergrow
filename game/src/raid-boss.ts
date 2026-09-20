import { enemyMovementMultiplier } from './enemy-modifiers.ts';
import { BOSS_PRESSURE, bossQuickMove, updateBossPressure } from './boss-pressure.ts';
import { enemyRecoveryDuration, enemyWindupDuration } from './enemy-threat.ts';
import type { Ally, Enemy } from './model.ts';
import type { EnemyAIContext } from './enemy-ai.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { alertEnemy, transitionEnemy } from './enemy-state.ts';
import { circleIntersectsSector, segmentDistanceSquared } from './combat-geometry.ts';
import { pushChatMessage } from './chat-log.ts';
import { isRaidBoss, ONYXIA_RULES as R } from './raid-boss-content.ts';

/**
 * Onyxia's three-phase raid AI (docs/wow-deepening.md §15), modeled on the real
 * WotLK fight and built on the wilderness-boss state machine:
 *
 *   P1 100–65%  Grounded: Tail Sweep + Flame Breath, quick jab/bolt pressure.
 *   P2  65–30%  Air phase: she hovers and rains Fireball / Deep Breath while
 *               Onyxian Whelps stream in (wave bit 1, admitted by updateDungeon).
 *   P3  30– 0%  Landing: melee resumes faster, Bellowing Roar, second whelp
 *               wave (bit 2), lava scorch zones persist under eruptions.
 *   Enrage      Broodmother's Fury at R.enrageAfter seconds of engagement:
 *               +120% damage and a pulsing arena-wide burn until the wipe.
 *
 * Solo+allies scaling: hostiles are picked from the player and live allies
 * (nearest wins), outgoing damage eases 10% per ally (cap 30%), and AoE
 * mechanics hit every hostile in their footprint.
 */

interface Scorch { x: number; y: number; remaining: number; tick: number }
interface RaidState {
  engagedAt: number;
  enragePulse: number;
  warned: number; // bitmask of issued enrage warnings
  scorches: Scorch[];
}
const raid = new WeakMap<Enemy, RaidState>();
const state = (e: Enemy): RaidState => {
  let s = raid.get(e);
  if (!s) { s = { engagedAt: -1, enragePulse: 0, warned: 0, scorches: [] }; raid.set(e, s); }
  return s;
};

/** Seconds of enrage timer remaining; negative once Broodmother's Fury is active. */
export function raidEnrageRemaining(e: Enemy, now: number): number | undefined {
  if (!isRaidBoss(e)) return undefined;
  const s = raid.get(e);
  if (!s || s.engagedAt < 0) return R.enrageAfter;
  return R.enrageAfter - (now - s.engagedAt);
}

/** Live lava scorch zones for the art layer. */
export function raidScorches(e: Enemy): readonly { x: number; y: number; remaining: number }[] {
  return raid.get(e)?.scorches ?? [];
}
type Hostile = { x: number; y: number; radius: number; dead: boolean; ally?: Ally };

export function updateRaidBoss(e: Enemy, dt: number, c: EnemyAIContext): void {
  if (!isRaidBoss(e)) return;
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

  const hurtHostile = (amount: number, hitAngle: number, h: Hostile) => {
    if (h.ally) c.hurtAlly?.(h.ally, amount, hitAngle, e);
    else c.hurt(amount, hitAngle, e, 'fire');
  };
  /** AoE contact: every hostile inside `radius` of (x,y) takes fire damage once. */
  const blastHostiles = (x: number, y: number, radius: number, amount: number): boolean => {
    let hit = false;
    if (!player.dead && Math.hypot(player.x - x, player.y - y) <= radius + player.radius) {
      hit = true; c.hurt(amount, Math.atan2(player.y - y, player.x - x), e, 'fire');
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

  // ── Leash: leaving the arena (or wiping) sends her home and resets the fight clock.
  if (player.dead || c.world.isSanctuary?.(player.x, player.y)
    || Math.hypot(player.x - e.homeX, player.y - e.homeY) > R.leash || Math.hypot(e.x - e.homeX, e.y - e.homeY) > R.leash) {
    if (e.state !== 'return') { transitionEnemy(e, 'return'); e.bossMove = undefined; e.awareness = 0; e.burnTime = 0; e.slowTime = 0; }
  }
  if (e.state === 'return') {
    if (Math.hypot(e.x - e.homeX, e.y - e.homeY) < 12) {
      raid.delete(e); // fresh engagement clock and scorch field next pull
      e.bossTurns = 0;
      transitionEnemy(e, 'idle', 1);
    } else walk(e.homeX, e.homeY, def.speed * 1.5);
    return;
  }
  if (e.state === 'idle' || e.state === 'patrol') {
    if ((d < R.awareness && c.visible(e.x, e.y, p.x, p.y)) || e.awareness >= 1) {
      alertEnemy(e, p);
      s.engagedAt = c.time;
      pushChatMessage(player, 'system', 'Onyxia roars: "How fortuitous. Usually, I must leave my lair to feed."', c.time);
    } else return;
  }
  if (s.engagedAt < 0) s.engagedAt = c.time; // re-engaged after a wound restore
  if (e.interrupted) e.interrupted = false;
  if (e.state === 'recover') { if (e.stateTime >= e.stateDuration) transitionEnemy(e, 'chase'); return; }

  // ── Broodmother's Fury: hard enrage — pulsing arena burn + warnings.
  if (enraged) {
    if (!(s.warned & 4)) { s.warned |= 4; pushChatMessage(player, 'system', 'Onyxia enters a broodmother\'s fury!', c.time); }
    s.enragePulse -= dt;
    if (s.enragePulse <= 0) {
      s.enragePulse = R.enragePulse;
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: R.enrageRadius, duration: .5, color: '#ff7a3c' });
      blastHostiles(e.x, e.y, R.enrageRadius, power * .8);
    }
  } else {
    const left = R.enrageAfter - (c.time - s.engagedAt);
    if (left <= 60 && !(s.warned & 1)) { s.warned |= 1; pushChatMessage(player, 'system', 'Onyxia grows impatient — finish her before her fury peaks!', c.time); }
    if (left <= 15 && !(s.warned & 2)) { s.warned |= 2; pushChatMessage(player, 'system', 'Onyxia\'s fury is about to peak!', c.time); }
  }

  // ── Lava scorch zones left by eruptions and Deep Breath.
  for (let i = s.scorches.length - 1; i >= 0; i--) {
    const z = s.scorches[i];
    z.remaining -= dt; z.tick -= dt;
    if (z.tick <= 0) { z.tick = R.scorchInterval; blastHostiles(z.x, z.y, R.scorchRadius, power * R.scorchDps); }
    if (z.remaining <= 0) s.scorches.splice(i, 1);
  }
  const scorch = (x: number, y: number) => {
    if (s.scorches.length >= R.scorchMax) s.scorches.shift();
    s.scorches.push({ x, y, remaining: R.scorchDuration, tick: R.scorchInterval });
  };

  if (updateBossPressure(e, c)) return;

  const phase = e.hp / e.maxHp <= R.phaseThree ? 2 : e.hp / e.maxHp <= R.phaseTwo ? 1 : 0;
  const airborne = phase === 1;

  if (e.state === 'chase') {
    e.angle = angle; e.seesPlayer = c.visible(e.x, e.y, p.x, p.y);
    // Phase transitions commit a 'summon' flourish; the wave bits gate the adds.
    const bit = phase === 1 && !((e.bossPhases ?? 0) & 1) ? 1 : phase === 2 && !((e.bossPhases ?? 0) & 2) ? 2 : 0;
    if (bit) {
      e.bossPhases = (e.bossPhases ?? 0) | bit;
      e.bossMove = 'summon';
      e.bossTurns = (e.bossTurns ?? 0) + 1;
      e.attackAngle = angle; e.attackTargetX = p.x; e.attackTargetY = p.y; e.bossHits = 0;
      e.attackDamage = power;
      transitionEnemy(e, 'windup', enemyWindupDuration(e, 1.3));
      return;
    }
    if (airborne) {
      // Hover at range; drift to keep the hover band, never landing for melee.
      if (!e.seesPlayer || d > R.airHoverMax) walk(p.x, p.y, def.speed * 1.35);
      else if (d < R.airHoverMin) {
        const away = Math.atan2(e.y - p.y, e.x - p.x);
        walk(e.x + Math.cos(away) * 120, e.y + Math.sin(away) * 120, def.speed);
      }
      const turns = e.bossTurns ?? 0;
      e.bossMove = turns % 2 ? 'bolt' : Math.floor(turns / 2) % 2 ? 'rush' : 'eruption';
      e.bossTurns = turns + 1;
    } else {
      if (!e.seesPlayer || d > 380) { walk(p.x, p.y, def.speed * (e.slowTime > 0 ? e.slowFactor : 1) * (phase === 2 ? 1.2 : 1)); return; }
      const turns = e.bossTurns ?? 0;
      let move: Enemy['bossMove'];
      if (turns % 2) move = bossQuickMove(d, p.radius);
      else if (phase === 2) move = ['sweep', 'command', 'fracture', 'eruption'][Math.floor(turns / 2) % 4] as Enemy['bossMove'];
      else move = Math.floor(turns / 2) % 2 ? 'fracture' : 'sweep';
      if (move === 'sweep' && d > R.sweepReach + 10) move = phase === 2 ? 'command' : 'fracture';
      e.bossMove = move; e.bossTurns = turns + 1;
    }
    e.bossOriginX = e.x; e.bossOriginY = e.y;
    e.attackAngle = angle; e.attackTargetX = p.x; e.attackTargetY = p.y; e.bossHits = 0;
    const quick = e.bossMove === 'jab' || e.bossMove === 'bolt' ? BOSS_PRESSURE[e.bossMove] : null;
    e.attackDamage = power * (quick?.damage ?? (e.bossMove === 'sweep' ? 1 : 1.15));
    const warning = quick?.windup ?? (e.bossMove === 'sweep' ? .85 : e.bossMove === 'rush' ? 1.5 : e.bossMove === 'command' ? 1.2 : e.bossMove === 'eruption' ? 1.1 : 1.15);
    transitionEnemy(e, 'windup', enemyWindupDuration(e, warning));
    return;
  }

  if (e.state === 'windup') {
    if (e.stateTime < e.stateDuration) return;
    const move = e.bossMove;
    transitionEnemy(e, 'attack', move === 'rush' ? .8 : move === 'fracture' ? .7 : move === 'eruption' ? 1.4 : move === 'command' ? .5 : move === 'summon' ? .6 : .28);
    if (move === 'summon') {
      const landing = (e.bossPhases ?? 0) & 2;
      c.emit({ type: 'blast', x: e.x, y: e.y - 35, radius: landing ? 260 : 150, duration: .8, color: '#ff9a4e' });
      pushChatMessage(player, 'system', landing
        ? 'Onyxia bellows and crashes back to the ground — whelps answer from every ledge!'
        : 'Onyxia takes to the air! Onyxian Whelps pour from the nests!', c.time);
    } else if (move === 'rush') {
      c.emit({ type: 'cast', x: e.x, y: e.y, angle: e.attackAngle, enemyKind: e.kind, style: 'fire' });
    } else {
      c.emit({ type: 'blast', x: move === 'eruption' ? e.attackTargetX : e.x, y: move === 'eruption' ? e.attackTargetY : e.y,
        radius: move === 'eruption' ? R.fireballRadius : move === 'command' ? 120 : 70, duration: .45, color: '#ffac61' });
    }
  }
  if (e.state !== 'attack') return;

  let hit = false;
  if (e.bossMove === 'sweep')
    hit = circleIntersectsSector(p.x, p.y, p.radius, e.x, e.y, e.attackAngle, R.sweepReach, R.sweepArc);
  if (e.bossMove === 'fracture') // Flame Breath: three-lane cone, staggered like the warden's fracture.
    for (let i = 0; i < R.breathOffsets.length; i++) {
      if (e.stateTime < i * .2 || ((e.bossHits ?? 0) & 1 << i)) continue;
      e.bossHits = (e.bossHits ?? 0) | 1 << i;
      const a = e.attackAngle + R.breathOffsets[i], ox = e.bossOriginX!, oy = e.bossOriginY!;
      c.emit({ type: 'blast', x: ox + Math.cos(a) * 200, y: oy + Math.sin(a) * 200, radius: 52, duration: .4, color: '#ffac61' });
      hit ||= segmentDistanceSquared(p.x, p.y, ox, oy, ox + Math.cos(a) * R.breathLength, oy + Math.sin(a) * R.breathLength) < (R.breathWidth + p.radius) ** 2;
    }
  if (e.bossMove === 'eruption') { // Fireball blast; leaves a lava scorch in the landing phase.
    hit = Math.hypot(p.x - e.attackTargetX, p.y - e.attackTargetY) < R.fireballRadius + p.radius;
    if (e.stateTime >= e.stateDuration - .05 && !((e.bossHits ?? 0) & 1)) { e.bossHits = (e.bossHits ?? 0) | 1; if (phase === 2) scorch(e.attackTargetX, e.attackTargetY); }
  }
  if (e.bossMove === 'rush') { // Deep Breath: she strafes a fire lane across the arena.
    const x = e.x, y = e.y;
    c.move(e, Math.cos(e.attackAngle) * R.deepBreathLength / .8, Math.sin(e.attackAngle) * R.deepBreathLength / .8, dt);
    hit = segmentDistanceSquared(p.x, p.y, x, y, e.x, e.y) < (R.deepBreathWidth + p.radius) ** 2;
    if (!((e.bossHits ?? 0) & 1) && e.stateTime >= e.stateDuration * .5) { e.bossHits = (e.bossHits ?? 0) | 1; scorch(e.x, e.y); }
  }
  if (e.bossMove === 'command') // Bellowing Roar: arena-wide burst around her.
    hit = d < R.roarRadius + p.radius;
  if (hit && !e.attackHit && c.visible(e.x, e.y, p.x, p.y)) {
    e.attackHit = true;
    if (e.bossMove === 'command') blastHostiles(e.x, e.y, R.roarRadius, power * 1.15);
    else hurtHostile(e.attackDamage ?? power, e.attackAngle, p);
  }
  if (e.stateTime >= e.stateDuration)
    transitionEnemy(e, 'recover', enemyRecoveryDuration(e,
      e.bossMove === 'summon' ? 1.6 : e.bossMove === 'command' ? 1.4 : phase === 2 ? .7 : airborne ? .9 : 1.15));
}
