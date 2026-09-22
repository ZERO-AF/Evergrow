import { enemyMovementMultiplier } from './enemy-modifiers.ts';
import { BOSS_PRESSURE, bossQuickMove, updateBossPressure } from './boss-pressure.ts';
import { enemyRecoveryDuration, enemyWindupDuration } from './enemy-threat.ts';
import type { Ally, DamageType, Enemy } from './model.ts';
import type { EnemyAIContext } from './enemy-ai.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { alertEnemy, transitionEnemy } from './enemy-state.ts';
import { circleIntersectsSector, segmentDistanceSquared } from './combat-geometry.ts';
import { pushChatMessage } from './chat-log.ts';
import { isRaid8Boss, ANUBARAK_RULES as R } from './raid8-boss-content.ts';

/**
 * Anub'arak's raid AI (docs/wow-deepening.md §15, eighth wave), modeled on the
 * real WotLK Trial of the Crusader fight and built on the wilderness-boss
 * state machine. The Traitor King holds the coliseum pit: he never chases —
 * Freezing Slash covers melee range, Impale / Pursuit by Anub'arak / Leeching
 * Swarm reach the whole arena.
 *
 *   P1 100–75% Freezing Slash + Impale, quick slash / spike pressure, and
 *              Pursuit by Anub'arak — chasing ground spikes that erupt on
 *              contact.
 *   Submerge   At 75% and again at 45% he burrows (the 'summon' flourish sets
 *              wave bits 1/2, admitting the Swarm Scarab / Nerubian Burrower
 *              packs). For R.burrowed seconds he tunnels beneath the pit —
 *              untargeted but still vulnerable — while pursuit spikes erupt
 *              around him on cadence.
 *   P3  30– 0% Leeching Swarm: a periodic nature drain siphons every hostile
 *              in the arena and heals him for a share of the damage, plus the
 *              nova cast stays in his rotation.
 *   Enrage     Swarm Fury at R.enrageAfter seconds of engagement: +120%
 *              damage and a pulsing arena-wide frost burn until the wipe.
 *
 * Solo+allies scaling: hostiles are picked from the player and live allies
 * (nearest wins), outgoing damage eases 10% per ally (cap 30%), and AoE
 * mechanics hit every hostile in their footprint.
 */

interface Spike { x: number; y: number; remaining: number }
interface Raid8State {
  engagedAt: number;
  enragePulse: number;
  warned: number;      // bitmask of issued warnings (1/2 enrage, 4 enraged, 8 swarm)
  spikes: Spike[];     // live Pursuit by Anub'arak ground spikes
  burrowed: number;    // seconds left underground (Submerge)
  spikeCd: number;     // burrowed spike cadence
  swarmCd: number;     // Leeching Swarm aura cadence
}
const raid = new WeakMap<Enemy, Raid8State>();
const state = (e: Enemy): Raid8State => {
  let s = raid.get(e);
  if (!s) { s = { engagedAt: -1, enragePulse: 0, warned: 0, spikes: [], burrowed: 0, spikeCd: 0, swarmCd: 0 }; raid.set(e, s); }
  return s;
};

/** Seconds of enrage timer remaining; negative once Swarm Fury is active. */
export function raid8EnrageRemaining(e: Enemy, now: number): number | undefined {
  if (!isRaid8Boss(e)) return undefined;
  const s = raid.get(e);
  if (!s || s.engagedAt < 0) return R.enrageAfter;
  return R.enrageAfter - (now - s.engagedAt);
}

/** Live Pursuit by Anub'arak spikes for the art layer. */
export function raid8Spikes(e: Enemy): readonly { x: number; y: number; remaining: number }[] {
  return raid.get(e)?.spikes ?? [];
}
type Hostile = { x: number; y: number; radius: number; dead: boolean; ally?: Ally };

export function updateRaid8Boss(e: Enemy, dt: number, c: EnemyAIContext): void {
  if (!isRaid8Boss(e)) return;
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
  /** AoE contact: every hostile inside `radius` of (x,y) takes damage once; returns total dealt. */
  const blastHostiles = (x: number, y: number, radius: number, amount: number, type: DamageType): number => {
    let dealt = 0;
    if (!player.dead && Math.hypot(player.x - x, player.y - y) <= radius + player.radius) {
      dealt += amount; c.hurt(amount, Math.atan2(player.y - y, player.x - x), e, type);
    }
    for (const a of allies)
      if (a.hp > 0 && Math.hypot(a.x - x, a.y - y) <= radius + a.radius) {
        dealt += amount; c.hurtAlly?.(a, amount, Math.atan2(a.y - y, a.x - x), e);
      }
    return dealt;
  };
  const walk = (x: number, y: number, speed: number) => {
    speed *= enemyMovementMultiplier(e);
    const target = c.world.navigationTarget?.(e.x, e.y, x, y, e.radius + 1) ?? { x, y };
    const length = Math.hypot(target.x - e.x, target.y - e.y);
    if (length > .5) { e.angle = Math.atan2(target.y - e.y, target.x - e.x); c.move(e, (target.x - e.x) / length * speed, (target.y - e.y) / length * speed, dt); }
  };
  const spawnSpike = (x: number, y: number) => {
    if (s.spikes.length >= R.spikeMax) s.spikes.shift();
    s.spikes.push({ x, y, remaining: R.spikeDuration });
  };

  // ── Leash: leaving the pit (or wiping) sends him home and resets the fight clock.
  if (player.dead || c.world.isSanctuary?.(player.x, player.y)
    || Math.hypot(player.x - e.homeX, player.y - e.homeY) > R.leash || Math.hypot(e.x - e.homeX, e.y - e.homeY) > R.leash) {
    if (e.state !== 'return') { transitionEnemy(e, 'return'); e.bossMove = undefined; e.awareness = 0; e.burnTime = 0; e.slowTime = 0; }
  }
  if (e.state === 'return') {
    if (Math.hypot(e.x - e.homeX, e.y - e.homeY) < 12) {
      raid.delete(e); // fresh engagement clock, spike field and burrow next pull
      e.bossTurns = 0;
      transitionEnemy(e, 'idle', 1);
    } else walk(e.homeX, e.homeY, def.speed * 1.5);
    return;
  }
  if (e.state === 'idle' || e.state === 'patrol') {
    if ((d < R.awareness && c.visible(e.x, e.y, p.x, p.y)) || e.awareness >= 1) {
      alertEnemy(e, p);
      s.engagedAt = c.time;
      pushChatMessage(player, 'system', 'Anub\'arak rises from the pit: "THE SWARM WILL CONSUME YOU!"', c.time);
    } else return;
  }
  if (s.engagedAt < 0) s.engagedAt = c.time; // re-engaged after a wound restore
  if (e.interrupted) e.interrupted = false;

  // ── Swarm Fury: hard enrage — pulsing arena burn + warnings.
  if (enraged) {
    if (!(s.warned & 4)) { s.warned |= 4; pushChatMessage(player, 'system', 'Anub\'arak enters the Swarm Fury — "AZJOL-NERUB WAS MERELY A SETBACK!"', c.time); }
    s.enragePulse -= dt;
    if (s.enragePulse <= 0) {
      s.enragePulse = R.enragePulse;
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: R.enrageRadius, duration: .5, color: '#8fd8f2' });
      blastHostiles(e.x, e.y, R.enrageRadius, power * .8, 'frost');
    }
  } else {
    const left = R.enrageAfter - (c.time - s.engagedAt);
    if (left <= 60 && !(s.warned & 1)) { s.warned |= 1; pushChatMessage(player, 'system', 'Anub\'arak grows impatient — the swarm stirs beneath the ice!', c.time); }
    if (left <= 15 && !(s.warned & 2)) { s.warned |= 2; pushChatMessage(player, 'system', 'Anub\'arak\'s fury is about to peak!', c.time); }
  }

  // ── Pursuit by Anub'arak: ground spikes chase the nearest hostile and erupt
  //    on contact. They persist through the Submerge and after he resurfaces.
  for (let i = s.spikes.length - 1; i >= 0; i--) {
    const sp = s.spikes[i];
    sp.remaining -= dt;
    if (sp.remaining <= 0) { s.spikes.splice(i, 1); continue; }
    const dx = p.x - sp.x, dy = p.y - sp.y, dist = Math.hypot(dx, dy);
    if (dist <= R.spikeRadius + p.radius) {
      s.spikes.splice(i, 1);
      c.emit({ type: 'blast', x: sp.x, y: sp.y, radius: R.spikeRadius, duration: .4, color: '#a8c8d8' });
      blastHostiles(sp.x, sp.y, R.spikeRadius, power * 1.05, 'physical');
      continue;
    }
    if (dist > .5) { sp.x += dx / dist * R.spikeSpeed * dt; sp.y += dy / dist * R.spikeSpeed * dt; }
  }

  // ── Submerge: burrowed he tunnels beneath the pit — no moves, no target —
  //    while pursuit spikes erupt around him on cadence.
  if (s.burrowed > 0) {
    s.burrowed -= dt;
    s.spikeCd -= dt;
    if (s.spikeCd <= 0) {
      s.spikeCd = R.spikeInterval;
      spawnSpike(e.x, e.y);
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: 90, duration: .5, color: '#a8c8d8' });
    }
    if (e.state !== 'recover') transitionEnemy(e, 'recover', R.burrowed);
    if (s.burrowed <= 0) {
      transitionEnemy(e, 'chase');
      pushChatMessage(player, 'system', 'Anub\'arak erupts from the frozen earth!', c.time);
    }
    return;
  }

  // ── Leeching Swarm: below 30% a periodic nature drain siphons the arena and
  //    heals him for a share of the damage dealt.
  if (e.hp / e.maxHp <= R.swarmPhase) {
    if (!(s.warned & 8)) { s.warned |= 8; pushChatMessage(player, 'system', 'Anub\'arak unleashes the Leeching Swarm — "YOUR LIFE FORCE IS MINE!"', c.time); }
    s.swarmCd -= dt;
    if (s.swarmCd <= 0) {
      s.swarmCd = R.swarmInterval;
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: R.swarmRadius, duration: .6, color: '#7ab87a' });
      const dealt = blastHostiles(e.x, e.y, R.swarmRadius, power * R.swarmDrain, 'nature');
      if (dealt > 0) e.hp = Math.min(e.maxHp, e.hp + dealt * R.swarmHeal);
    }
  }

  if (e.state === 'recover') { if (e.stateTime >= e.stateDuration) transitionEnemy(e, 'chase'); return; }

  if (updateBossPressure(e, c)) return;

  const phase = e.hp / e.maxHp <= R.phaseThree ? 2 : e.hp / e.maxHp <= R.phaseTwo ? 1 : 0;

  if (e.state === 'chase') {
    e.angle = angle; e.seesPlayer = c.visible(e.x, e.y, p.x, p.y);
    // Submerge transitions commit a 'summon' flourish — the burrow at 75% and
    // 45%. The wave bits (set here) gate the Swarm Scarab / Burrower admission.
    const bit = phase === 1 && !((e.bossPhases ?? 0) & 1) ? 1 : phase === 2 && !((e.bossPhases ?? 0) & 2) ? 2 : 0;
    if (bit) {
      e.bossPhases = (e.bossPhases ?? 0) | bit;
      e.bossMove = 'summon';
      e.attackVariant = bit === 2 ? 2 : 0; // 2 marks the second Submerge for the warning spec
      e.bossTurns = (e.bossTurns ?? 0) + 1;
      e.attackAngle = angle; e.attackTargetX = p.x; e.attackTargetY = p.y; e.bossHits = 0;
      e.attackDamage = power;
      transitionEnemy(e, 'windup', enemyWindupDuration(e, 1.4));
      return;
    }
    // Rooted in the pit: he pivots to face his target but never chases.
    const turns = e.bossTurns ?? 0;
    let move: Enemy['bossMove'];
    if (turns % 2) move = bossQuickMove(d, p.radius);
    else if (phase === 2) move = ['sweep', 'command', 'fracture', 'rush', 'eruption'][Math.floor(turns / 2) % 5] as Enemy['bossMove'];
    else move = ['sweep', 'fracture', 'rush', 'eruption'][Math.floor(turns / 2) % 4] as Enemy['bossMove'];
    if (move === 'sweep' && d > R.slashReach + 10) move = 'eruption';
    if (move === 'command' && d > R.swarmRadius + 10) move = 'eruption';
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
      // The wave bit was set at commit; the flourish announces the burrow and
      // starts the underground window — spikes erupt on cadence while he is down.
      s.burrowed = R.burrowed;
      s.spikeCd = R.spikeInterval;
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: 220, duration: .9, color: '#a8c8d8' });
      pushChatMessage(player, 'system', e.attackVariant === 2
        ? 'Anub\'arak burrows once more — "RISE, MY SWARM! SCARABS, TO ME!"'
        : 'Anub\'arak burrows beneath the coliseum floor — "THE GROUND ITSELF WILL DEVOUR YOU!"', c.time);
      e.attackVariant = 0;
      transitionEnemy(e, 'recover', enemyRecoveryDuration(e, 1.5));
      return;
    }
    transitionEnemy(e, 'attack', move === 'rush' ? .8 : move === 'fracture' ? .7 : move === 'eruption' ? 1.4 : move === 'command' ? .5 : .28);
    if (move === 'rush') {
      c.emit({ type: 'cast', x: e.x, y: e.y, angle: e.attackAngle, enemyKind: e.kind, style: 'frost' });
    } else {
      c.emit({ type: 'blast', x: move === 'eruption' ? e.attackTargetX : e.x, y: move === 'eruption' ? e.attackTargetY : e.y,
        radius: move === 'eruption' ? R.spikeRadius : move === 'command' ? 130 : 80, duration: .45,
        color: move === 'eruption' ? '#a8c8d8' : move === 'command' ? '#7ab87a' : '#8fd8f2' });
    }
  }
  if (e.state !== 'attack') return;

  let hit = false;
  if (e.bossMove === 'sweep') // Freezing Slash: frontal frost cone.
    hit = circleIntersectsSector(p.x, p.y, p.radius, e.x, e.y, e.attackAngle, R.slashReach, R.slashArc);
  if (e.bossMove === 'fracture') // Impale: three staggered spike lanes.
    for (let i = 0; i < R.impaleOffsets.length; i++) {
      if (e.stateTime < i * .2 || ((e.bossHits ?? 0) & 1 << i)) continue;
      e.bossHits = (e.bossHits ?? 0) | 1 << i;
      const a = e.attackAngle + R.impaleOffsets[i], ox = e.bossOriginX!, oy = e.bossOriginY!;
      c.emit({ type: 'blast', x: ox + Math.cos(a) * 200, y: oy + Math.sin(a) * 200, radius: 56, duration: .4, color: '#a8c8d8' });
      hit ||= segmentDistanceSquared(p.x, p.y, ox, oy, ox + Math.cos(a) * R.impaleLength, oy + Math.sin(a) * R.impaleLength) < (R.impaleWidth + p.radius) ** 2;
    }
  if (e.bossMove === 'eruption') { // Pursuit by Anub'arak: detonation at the committed target; the spike keeps hunting.
    hit = Math.hypot(p.x - e.attackTargetX, p.y - e.attackTargetY) < R.spikeRadius + p.radius;
    if (e.stateTime >= e.stateDuration - .05 && !((e.bossHits ?? 0) & 1)) { e.bossHits = (e.bossHits ?? 0) | 1; spawnSpike(e.attackTargetX, e.attackTargetY); }
  }
  if (e.bossMove === 'rush') { // Pursuit by Anub'arak: a projected spike front travels the lane, then keeps hunting.
    const t = Math.min(1, e.stateTime / Math.max(.01, e.stateDuration));
    const fx = e.bossOriginX! + Math.cos(e.attackAngle) * R.impaleLength * 1.3 * t;
    const fy = e.bossOriginY! + Math.sin(e.attackAngle) * R.impaleLength * 1.3 * t;
    hit = segmentDistanceSquared(p.x, p.y, e.bossOriginX!, e.bossOriginY!, fx, fy) < (R.impaleWidth + 14 + p.radius) ** 2;
    if (!((e.bossHits ?? 0) & 1) && e.stateTime >= e.stateDuration * .5) { e.bossHits = (e.bossHits ?? 0) | 1; spawnSpike(fx, fy); }
  }
  if (e.bossMove === 'command') // Leeching Swarm: arena-wide drain nova around him.
    hit = d < R.swarmRadius + p.radius;
  if (hit && !e.attackHit && c.visible(e.x, e.y, p.x, p.y)) {
    e.attackHit = true;
    if (e.bossMove === 'command') {
      const dealt = blastHostiles(e.x, e.y, R.swarmRadius, e.attackDamage ?? power * 1.15, 'nature');
      if (dealt > 0) e.hp = Math.min(e.maxHp, e.hp + dealt * R.swarmHeal);
    } else hurtHostile(e.attackDamage ?? power, e.attackAngle, p,
      e.bossMove === 'sweep' ? 'frost' : 'physical');
  }
  if (e.stateTime >= e.stateDuration)
    transitionEnemy(e, 'recover', enemyRecoveryDuration(e,
      e.bossMove === 'command' ? 1.3 : e.bossMove === 'rush' ? 1 : phase === 2 ? .8 : 1.15));
}
