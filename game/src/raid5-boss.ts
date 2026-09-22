import { enemyMovementMultiplier } from './enemy-modifiers.ts';
import { BOSS_PRESSURE, bossQuickMove, updateBossPressure } from './boss-pressure.ts';
import { enemyRecoveryDuration, enemyWindupDuration } from './enemy-threat.ts';
import type { Ally, DamageType, Enemy } from './model.ts';
import type { EnemyAIContext } from './enemy-ai.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { alertEnemy, transitionEnemy } from './enemy-state.ts';
import { circleIntersectsSector, segmentDistanceSquared } from './combat-geometry.ts';
import { pushChatMessage } from './chat-log.ts';
import { isRaid5Boss, isRaid5Spark, MALYGOS_RULES as R, RAID5_ARENA_CENTER } from './raid5-boss-content.ts';

/**
 * Malygos's raid AI (docs/wow-deepening.md §15, fifth wave), modeled on the
 * real WotLK Eye of Eternity fight and built on the wilderness-boss state
 * machine. Malygos is rooted over the disc: he never chases — Arcane Breath
 * covers melee range, Arcane Storm / Surge of Power / Vortex reach the whole
 * arena.
 *
 *   P1 100–50%  Arcane Breath + Arcane Storm, quick Arcane Burst / Arcane
 *               Barrage pressure, Surge of Power detonations and Vortex novas.
 *   P2  50–25%  He takes to the air: Nexus Lords and Scions of Eternity stream
 *               in (wave bit 1) alongside four Power Sparks. Killing a spark
 *               grants the raid a stacking +50% damage buff — the real fight's
 *               spark-harvest mechanic.
 *   P3  25– 0%  The platform shatters: the raid lands on Wyrmrest Skytalons
 *               (a stacking drake buff — +75% damage, +40% speed) while a last
 *               pair of Power Sparks drifts in (wave bit 2). Malygos stays
 *               airborne, circling the disc at speed and casting only ranged
 *               moves — melee cannot pin him down.
 *   Enrage      Arcane Fury at R.enrageAfter seconds of engagement:
 *               +120% damage and a pulsing arena-wide arcane burn.
 *
 * Solo+allies scaling: hostiles are picked from the player and live allies
 * (nearest wins), outgoing damage eases 10% per ally (cap 30%), and AoE
 * mechanics hit every hostile in their footprint.
 */

interface Rift { x: number; y: number; remaining: number; tick: number }
interface Raid5State {
  engagedAt: number;
  enragePulse: number;
  warned: number; // bitmask of issued enrage warnings
  rifts: Rift[];
  sparkGranted: Set<number>; // enemy ids of Power Sparks already harvested
  orbit: number;             // phase-3 flight angle around the disc's heart
}
const raid = new WeakMap<Enemy, Raid5State>();
const state = (e: Enemy): Raid5State => {
  let s = raid.get(e);
  if (!s) { s = { engagedAt: -1, enragePulse: 0, warned: 0, rifts: [], sparkGranted: new Set(), orbit: 0 }; raid.set(e, s); }
  return s;
};

/** Seconds of enrage timer remaining; negative once Arcane Fury is active. */
export function raid5EnrageRemaining(e: Enemy, now: number): number | undefined {
  if (!isRaid5Boss(e)) return undefined;
  const s = raid.get(e);
  if (!s || s.engagedAt < 0) return R.enrageAfter;
  return R.enrageAfter - (now - s.engagedAt);
}

/** Live Power Rift zones for the art layer. */
export function raid5Rifts(e: Enemy): readonly { x: number; y: number; remaining: number }[] {
  return raid.get(e)?.rifts ?? [];
}
type Hostile = { x: number; y: number; radius: number; dead: boolean; ally?: Ally };

export function updateRaid5Boss(e: Enemy, dt: number, c: EnemyAIContext): void {
  if (!isRaid5Boss(e)) return;
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

  // ── Leash: leaving the disc (or wiping) sends him home and resets the fight clock.
  if (player.dead || c.world.isSanctuary?.(player.x, player.y)
    || Math.hypot(player.x - e.homeX, player.y - e.homeY) > R.leash || Math.hypot(e.x - e.homeX, e.y - e.homeY) > R.leash) {
    if (e.state !== 'return') { transitionEnemy(e, 'return'); e.bossMove = undefined; e.awareness = 0; e.burnTime = 0; e.slowTime = 0; }
  }
  if (e.state === 'return') {
    if (Math.hypot(e.x - e.homeX, e.y - e.homeY) < 12) {
      raid.delete(e); // fresh engagement clock, rift field and spark harvest next pull
      e.bossTurns = 0;
      transitionEnemy(e, 'idle', 1);
    } else walk(e.homeX, e.homeY, def.speed * 1.5);
    return;
  }
  if (e.state === 'idle' || e.state === 'patrol') {
    if ((d < R.awareness && c.visible(e.x, e.y, p.x, p.y)) || e.awareness >= 1) {
      alertEnemy(e, p);
      s.engagedAt = c.time;
      pushChatMessage(player, 'system', 'Malygos roars: "I AM THE SPELL-WEAVER! MY POWER IS INFINITE!"', c.time);
    } else return;
  }
  if (s.engagedAt < 0) s.engagedAt = c.time; // re-engaged after a wound restore
  if (e.interrupted) e.interrupted = false;

  // ── Arcane Fury: hard enrage — pulsing arena burn + warnings.
  if (enraged) {
    if (!(s.warned & 4)) { s.warned |= 4; pushChatMessage(player, 'system', 'Malygos channels Arcane Fury — "UNLIMITED POWER!"', c.time); }
    s.enragePulse -= dt;
    if (s.enragePulse <= 0) {
      s.enragePulse = R.enragePulse;
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: R.enrageRadius, duration: .5, color: '#7ab8ff' });
      blastHostiles(e.x, e.y, R.enrageRadius, power * .8, 'arcane');
    }
  } else {
    const left = R.enrageAfter - (c.time - s.engagedAt);
    if (left <= 60 && !(s.warned & 1)) { s.warned |= 1; pushChatMessage(player, 'system', 'Malygos grows impatient — the ley lines surge!', c.time); }
    if (left <= 15 && !(s.warned & 2)) { s.warned |= 2; pushChatMessage(player, 'system', 'Malygos\'s fury is about to peak!', c.time); }
  }

  // ── Power Rift zones left by Surge of Power detonations.
  for (let i = s.rifts.length - 1; i >= 0; i--) {
    const z = s.rifts[i];
    z.remaining -= dt; z.tick -= dt;
    if (z.tick <= 0) { z.tick = R.riftInterval; blastHostiles(z.x, z.y, R.riftRadius, power * R.riftDps, 'arcane'); }
    if (z.remaining <= 0) s.rifts.splice(i, 1);
  }
  const rift = (x: number, y: number) => {
    if (s.rifts.length >= R.riftMax) s.rifts.shift();
    s.rifts.push({ x, y, remaining: R.riftDuration, tick: R.riftInterval });
  };

  // ── Power Spark harvest: a dead spark grants the raid a stacking damage buff.
  for (const en of c.enemies) {
    if (!isRaid5Spark(en) || en.hp > 0 || s.sparkGranted.has(en.id)) continue;
    s.sparkGranted.add(en.id);
    c.addBuff?.('Power Spark', '#7ab8ff',
      { duration: R.sparkBuffDuration, stats: { damagePercent: R.sparkBuffDamage, spellDamagePercent: R.sparkBuffDamage } },
      `raid5-spark:${en.id}`);
    pushChatMessage(player, 'system', 'The Power Spark\'s energy surges through you!', c.time);
  }

  const phase = e.hp / e.maxHp <= R.phaseThree ? 2 : e.hp / e.maxHp <= R.phaseTwo ? 1 : 0;

  // ── Phase 3 flight: the Wyrmrest Skytalon carries the raid; Malygos circles
  //    the shattered disc between casts, unreachable by planted melee.
  if (phase === 2) {
    c.addBuff?.('Wyrmrest Skytalon', '#5a9eff',
      { duration: R.drakeBuffDuration, stats: { damagePercent: R.drakeBuffDamage, spellDamagePercent: R.drakeBuffDamage, moveSpeedPercent: R.drakeBuffSpeed } },
      'raid5-skytalon');
    if (e.state === 'recover' || e.state === 'chase') {
      s.orbit += dt * (R.orbitSpeed / R.orbitRadius);
      walk(RAID5_ARENA_CENTER.x + Math.cos(s.orbit) * R.orbitRadius,
        RAID5_ARENA_CENTER.y + Math.sin(s.orbit) * R.orbitRadius, def.speed * 3);
    }
  }

  if (e.state === 'recover') { if (e.stateTime >= e.stateDuration) transitionEnemy(e, 'chase'); return; }

  if (updateBossPressure(e, c)) return;

  if (e.state === 'chase') {
    e.angle = angle; e.seesPlayer = c.visible(e.x, e.y, p.x, p.y);
    // Phase transitions commit a 'summon' flourish — the Nexus call at 50% and
    // the platform shatter at 25%. The wave bits (set here since 'warden' gets
    // no auto-bits) gate the Nexus Lord / Power Spark admission.
    const bit = phase === 1 && !((e.bossPhases ?? 0) & 1) ? 1 : phase === 2 && !((e.bossPhases ?? 0) & 2) ? 2 : 0;
    if (bit) {
      e.bossPhases = (e.bossPhases ?? 0) | bit;
      e.bossMove = 'summon';
      e.attackVariant = bit === 2 ? 2 : 0; // 2 marks the platform shatter for the warning spec
      e.bossTurns = (e.bossTurns ?? 0) + 1;
      e.attackAngle = angle; e.attackTargetX = p.x; e.attackTargetY = p.y; e.bossHits = 0;
      e.attackDamage = power;
      transitionEnemy(e, 'windup', enemyWindupDuration(e, 1.4));
      return;
    }
    // Rooted over the disc: he pivots to face his target but never chases. In
    // phase 3 he is airborne — only ranged moves, and the orbit keeps him moving.
    const turns = e.bossTurns ?? 0;
    let move: Enemy['bossMove'];
    if (turns % 2) move = phase === 2 ? 'bolt' : bossQuickMove(d, p.radius);
    else if (phase === 2) move = ['command', 'fracture', 'rush', 'eruption'][Math.floor(turns / 2) % 4] as Enemy['bossMove'];
    else if (phase === 1) move = ['command', 'fracture', 'rush', 'eruption'][Math.floor(turns / 2) % 4] as Enemy['bossMove'];
    else move = ['sweep', 'command', 'fracture', 'eruption'][Math.floor(turns / 2) % 4] as Enemy['bossMove'];
    if (move === 'sweep' && d > R.breathReach + 10) move = phase === 2 ? 'command' : 'eruption';
    if (move === 'command' && d > R.vortexRadius + 10) move = 'eruption';
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
      // The wave bit was set at commit; the flourish only announces it.
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: 220, duration: .9, color: '#7ab8ff' });
      pushChatMessage(player, 'system', e.attackVariant === 2
        ? 'Malygos shatters the platform — "YOUR PRECARIOUS PERCH IS GONE! THE DRAGONS OF WYRMREST WILL CARRY YOU!"'
        : 'Malygos calls out: "MY CHILDREN! DEFEND THE NEXUS!"', c.time);
      e.attackVariant = 0;
      transitionEnemy(e, 'recover', enemyRecoveryDuration(e, 1.5));
      return;
    }
    transitionEnemy(e, 'attack', move === 'rush' ? .8 : move === 'fracture' ? .7 : move === 'eruption' ? 1.4 : move === 'command' ? .5 : .28);
    if (move === 'rush') {
      c.emit({ type: 'cast', x: e.x, y: e.y, angle: e.attackAngle, enemyKind: e.kind, style: 'arcane' });
    } else {
      c.emit({ type: 'blast', x: move === 'eruption' ? e.attackTargetX : e.x, y: move === 'eruption' ? e.attackTargetY : e.y,
        radius: move === 'eruption' ? R.surgeRadius : move === 'command' ? 130 : 80, duration: .45,
        color: move === 'eruption' ? '#8a5adf' : '#7ab8ff' });
    }
  }
  if (e.state !== 'attack') return;

  let hit = false;
  if (e.bossMove === 'sweep') // Arcane Breath: frontal arcane cone.
    hit = circleIntersectsSector(p.x, p.y, p.radius, e.x, e.y, e.attackAngle, R.breathReach, R.breathArc);
  if (e.bossMove === 'fracture') // Arcane Storm: three staggered arcane lanes.
    for (let i = 0; i < R.stormOffsets.length; i++) {
      if (e.stateTime < i * .2 || ((e.bossHits ?? 0) & 1 << i)) continue;
      e.bossHits = (e.bossHits ?? 0) | 1 << i;
      const a = e.attackAngle + R.stormOffsets[i], ox = e.bossOriginX!, oy = e.bossOriginY!;
      c.emit({ type: 'blast', x: ox + Math.cos(a) * 200, y: oy + Math.sin(a) * 200, radius: 56, duration: .4, color: '#7ab8ff' });
      hit ||= segmentDistanceSquared(p.x, p.y, ox, oy, ox + Math.cos(a) * R.stormLength, oy + Math.sin(a) * R.stormLength) < (R.stormWidth + p.radius) ** 2;
    }
  if (e.bossMove === 'eruption') { // Surge of Power: detonation at the committed target; the rift lingers.
    hit = Math.hypot(p.x - e.attackTargetX, p.y - e.attackTargetY) < R.surgeRadius + p.radius;
    if (e.stateTime >= e.stateDuration - .05 && !((e.bossHits ?? 0) & 1)) { e.bossHits = (e.bossHits ?? 0) | 1; rift(e.attackTargetX, e.attackTargetY); }
  }
  if (e.bossMove === 'rush') { // Surge of Power: a projected arcane front travels the lane; Malygos stays airborne.
    const t = Math.min(1, e.stateTime / Math.max(.01, e.stateDuration));
    const fx = e.bossOriginX! + Math.cos(e.attackAngle) * R.stormLength * 1.3 * t;
    const fy = e.bossOriginY! + Math.sin(e.attackAngle) * R.stormLength * 1.3 * t;
    hit = segmentDistanceSquared(p.x, p.y, e.bossOriginX!, e.bossOriginY!, fx, fy) < (R.stormWidth + 14 + p.radius) ** 2;
    if (!((e.bossHits ?? 0) & 1) && e.stateTime >= e.stateDuration * .5) { e.bossHits = (e.bossHits ?? 0) | 1; rift(fx, fy); }
  }
  if (e.bossMove === 'command') // Vortex: arena-wide nova around him.
    hit = d < R.vortexRadius + p.radius;
  if (hit && !e.attackHit && c.visible(e.x, e.y, p.x, p.y)) {
    e.attackHit = true;
    if (e.bossMove === 'command') blastHostiles(e.x, e.y, R.vortexRadius, e.attackDamage ?? power * 1.15, 'arcane');
    else hurtHostile(e.attackDamage ?? power, e.attackAngle, p, 'arcane');
  }
  if (e.stateTime >= e.stateDuration)
    transitionEnemy(e, 'recover', enemyRecoveryDuration(e,
      e.bossMove === 'command' ? 1.3 : e.bossMove === 'rush' ? 1 : phase === 2 ? .8 : 1.15));
}
