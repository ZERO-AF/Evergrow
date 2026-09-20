import { enemyMovementMultiplier } from './enemy-modifiers.ts';
import { BOSS_PRESSURE, bossQuickMove, updateBossPressure } from './boss-pressure.ts';
import { enemyRecoveryDuration, enemyWindupDuration } from './enemy-threat.ts';
import type { Ally, Enemy } from './model.ts';
import type { EnemyAIContext } from './enemy-ai.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { alertEnemy, transitionEnemy } from './enemy-state.ts';
import { circleIntersectsSector, segmentDistanceSquared } from './combat-geometry.ts';
import { pushChatMessage } from './chat-log.ts';
import { isRaid2Boss, RAGNAROS_RULES as R } from './raid2-boss-content.ts';

/**
 * Ragnaros's raid AI (docs/wow-deepening.md §15, second wave), modeled on the
 * real Molten Core fight and built on the wilderness-boss state machine.
 * Ragnaros is rooted in his lava pool: he never chases — Sulfuras Smash and
 * Lava Wave cover melee range, Eruption and Magma Blast reach the whole arena.
 *
 *   P1 100–65%  Sulfuras Smash + Lava Splash, quick Wrath of Ragnaros /
 *               Magma Blast pressure, Lava Wave novas and projected waves.
 *   P2  65–30%  First Submerge: he sinks for R.submergeSeconds while Sons of
 *               Flame stream in (wave bit 1, admitted by updateDungeon), then
 *               Emerge — a radial knockback burst. Molten ground persists.
 *   P3  30– 0%  Second Submerge + veteran Sons and Flamewakers (wave bit 2);
 *               afterwards his tempo quickens and eruptions leave scorch.
 *   Enrage      Firelord's Fury at R.enrageAfter seconds of engagement:
 *               +120% damage and a pulsing arena-wide burn until the wipe.
 *
 * Solo+allies scaling: hostiles are picked from the player and live allies
 * (nearest wins), outgoing damage eases 10% per ally (cap 30%), and AoE
 * mechanics hit every hostile in their footprint.
 */

interface Scorch { x: number; y: number; remaining: number; tick: number }
interface Raid2State {
  engagedAt: number;
  enragePulse: number;
  warned: number; // bitmask of issued enrage warnings
  scorches: Scorch[];
  submergedUntil: number; // sim time when the current submerge ends; 0 = surfaced
  submergeDone: number;   // bitmask of phase bits already consumed by a submerge
}
const raid = new WeakMap<Enemy, Raid2State>();
const state = (e: Enemy): Raid2State => {
  let s = raid.get(e);
  if (!s) { s = { engagedAt: -1, enragePulse: 0, warned: 0, scorches: [], submergedUntil: 0, submergeDone: 0 }; raid.set(e, s); }
  return s;
};

/** Seconds of enrage timer remaining; negative once Firelord's Fury is active. */
export function raid2EnrageRemaining(e: Enemy, now: number): number | undefined {
  if (!isRaid2Boss(e)) return undefined;
  const s = raid.get(e);
  if (!s || s.engagedAt < 0) return R.enrageAfter;
  return R.enrageAfter - (now - s.engagedAt);
}

/** Live molten scorch zones for the art layer. */
export function raid2Scorches(e: Enemy): readonly { x: number; y: number; remaining: number }[] {
  return raid.get(e)?.scorches ?? [];
}

/** True while Ragnaros is submerged for the Sons of Flame intermission. */
export function raid2Submerged(e: Enemy): boolean {
  return (raid.get(e)?.submergedUntil ?? 0) > 0;
}
type Hostile = { x: number; y: number; radius: number; dead: boolean; ally?: Ally };

export function updateRaid2Boss(e: Enemy, dt: number, c: EnemyAIContext): void {
  if (!isRaid2Boss(e)) return;
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

  // ── Leash: leaving the arena (or wiping) sends him home and resets the fight clock.
  if (player.dead || c.world.isSanctuary?.(player.x, player.y)
    || Math.hypot(player.x - e.homeX, player.y - e.homeY) > R.leash || Math.hypot(e.x - e.homeX, e.y - e.homeY) > R.leash) {
    if (e.state !== 'return') { transitionEnemy(e, 'return'); e.bossMove = undefined; e.awareness = 0; e.burnTime = 0; e.slowTime = 0; }
  }
  if (e.state === 'return') {
    if (Math.hypot(e.x - e.homeX, e.y - e.homeY) < 12) {
      raid.delete(e); // fresh engagement clock, scorch field and submerge cycle next pull
      e.bossTurns = 0;
      transitionEnemy(e, 'idle', 1);
    } else walk(e.homeX, e.homeY, def.speed * 1.5);
    return;
  }
  if (e.state === 'idle' || e.state === 'patrol') {
    if ((d < R.awareness && c.visible(e.x, e.y, p.x, p.y)) || e.awareness >= 1) {
      alertEnemy(e, p);
      s.engagedAt = c.time;
      pushChatMessage(player, 'system', 'Ragnaros booms: "TASTE THE FLAMES OF SULFURON!"', c.time);
    } else return;
  }
  if (s.engagedAt < 0) s.engagedAt = c.time; // re-engaged after a wound restore
  if (e.interrupted) e.interrupted = false;

  // ── Firelord's Fury: hard enrage — pulsing arena burn + warnings.
  if (enraged) {
    if (!(s.warned & 4)) { s.warned |= 4; pushChatMessage(player, 'system', 'Ragnaros enters the Firelord\'s fury — "BY FIRE BE PURGED!"', c.time); }
    s.enragePulse -= dt;
    if (s.enragePulse <= 0) {
      s.enragePulse = R.enragePulse;
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: R.enrageRadius, duration: .5, color: '#ff6a2e' });
      blastHostiles(e.x, e.y, R.enrageRadius, power * .8);
    }
  } else {
    const left = R.enrageAfter - (c.time - s.engagedAt);
    if (left <= 60 && !(s.warned & 1)) { s.warned |= 1; pushChatMessage(player, 'system', 'Ragnaros grows impatient — the lava churns hotter!', c.time); }
    if (left <= 15 && !(s.warned & 2)) { s.warned |= 2; pushChatMessage(player, 'system', 'Ragnaros\'s fury is about to peak!', c.time); }
  }

  // ── Molten scorch zones left by eruptions and Lava Waves. They keep burning
  //    through the submerge intermission, so tick them before the recover gate.
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

  // ── Submerge dormancy: while sunk he cannot act; the Sons of Flame carry the phase.
  if (s.submergedUntil > 0) {
    if (c.time < s.submergedUntil) {
      if (e.state !== 'recover') transitionEnemy(e, 'recover', s.submergedUntil - c.time);
      return;
    }
    // Emerge: radial knockback burst, then the fight resumes faster.
    s.submergedUntil = 0;
    e.bossMove = 'command';
    e.attackVariant = 2; // marks the emerge burst for the warning spec
    e.attackAngle = angle; e.attackTargetX = p.x; e.attackTargetY = p.y; e.bossHits = 0;
    e.attackDamage = power * 1.3;
    transitionEnemy(e, 'windup', enemyWindupDuration(e, 1.1));
    c.emit({ type: 'blast', x: e.x, y: e.y, radius: 200, duration: .9, color: '#ff8a3c' });
    pushChatMessage(player, 'system', 'Ragnaros erupts from the lava — "NOW FOR YOU, INSECTS!"', c.time);
    return;
  }
  if (e.state === 'recover') { if (e.stateTime >= e.stateDuration) transitionEnemy(e, 'chase'); return; }

  if (updateBossPressure(e, c)) return;

  const phase = e.hp / e.maxHp <= R.phaseThree ? 2 : e.hp / e.maxHp <= R.phaseTwo ? 1 : 0;

  if (e.state === 'chase') {
    e.angle = angle; e.seesPlayer = c.visible(e.x, e.y, p.x, p.y);
    // Phase transitions commit a 'summon' flourish — the Submerge. The wave bits
    // (auto-set by updateDungeon at 65% / 30%) gate the Sons of Flame admission.
    const bit = phase === 1 && !((e.bossPhases ?? 0) & 1) ? 1 : phase === 2 && !((e.bossPhases ?? 0) & 2) ? 2 : 0;
    if (bit && !(s.submergeDone & bit)) {
      s.submergeDone |= bit;
      e.bossPhases = (e.bossPhases ?? 0) | bit;
      e.bossMove = 'summon';
      e.bossTurns = (e.bossTurns ?? 0) + 1;
      e.attackAngle = angle; e.attackTargetX = p.x; e.attackTargetY = p.y; e.bossHits = 0;
      e.attackDamage = power;
      transitionEnemy(e, 'windup', enemyWindupDuration(e, 1.4));
      return;
    }
    // Rooted in the lava pool: he pivots to face his target but never chases.
    const turns = e.bossTurns ?? 0;
    let move: Enemy['bossMove'];
    if (turns % 2) move = bossQuickMove(d, p.radius);
    else if (phase === 2) move = ['sweep', 'command', 'fracture', 'rush', 'eruption'][Math.floor(turns / 2) % 5] as Enemy['bossMove'];
    else move = ['sweep', 'command', 'fracture', 'rush'][Math.floor(turns / 2) % 4] as Enemy['bossMove'];
    if (move === 'sweep' && d > R.smashReach + 10) move = phase === 2 ? 'command' : 'eruption';
    if (move === 'command' && d > R.novaRadius + 10) move = 'eruption';
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
      // Submerge: he sinks beneath the lava for the intermission; the 'recover'
      // state holds him dormant until submergedUntil, then the emerge branch fires.
      s.submergedUntil = c.time + R.submergeSeconds;
      e.attackVariant = 0;
      transitionEnemy(e, 'recover', R.submergeSeconds);
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: 240, duration: 1, color: '#ff7a30' });
      pushChatMessage(player, 'system', (e.bossPhases ?? 0) & 2 && s.submergeDone & 2
        ? 'Ragnaros submerges again — "COME FORTH, MY SERVANTS! DEFEND YOUR MASTER!"'
        : 'Ragnaros sinks beneath the lava — "COME FORTH, MY SERVANTS! DEFEND YOUR MASTER!"', c.time);
      return;
    }
    transitionEnemy(e, 'attack', move === 'rush' ? .8 : move === 'fracture' ? .7 : move === 'eruption' ? 1.4 : move === 'command' ? .5 : .28);
    if (move === 'rush') {
      c.emit({ type: 'cast', x: e.x, y: e.y, angle: e.attackAngle, enemyKind: e.kind, style: 'fire' });
    } else {
      c.emit({ type: 'blast', x: move === 'eruption' ? e.attackTargetX : e.x, y: move === 'eruption' ? e.attackTargetY : e.y,
        radius: move === 'eruption' ? R.blastRadius : move === 'command' ? 130 : 80, duration: .45, color: '#ff8a3c' });
    }
  }
  if (e.state !== 'attack') return;

  let hit = false;
  if (e.bossMove === 'sweep') // Sulfuras Smash: frontal melee arc.
    hit = circleIntersectsSector(p.x, p.y, p.radius, e.x, e.y, e.attackAngle, R.smashReach, R.smashArc);
  if (e.bossMove === 'fracture') // Lava Splash: three staggered radial lanes.
    for (let i = 0; i < R.splashOffsets.length; i++) {
      if (e.stateTime < i * .2 || ((e.bossHits ?? 0) & 1 << i)) continue;
      e.bossHits = (e.bossHits ?? 0) | 1 << i;
      const a = e.attackAngle + R.splashOffsets[i], ox = e.bossOriginX!, oy = e.bossOriginY!;
      c.emit({ type: 'blast', x: ox + Math.cos(a) * 200, y: oy + Math.sin(a) * 200, radius: 56, duration: .4, color: '#ff8a3c' });
      hit ||= segmentDistanceSquared(p.x, p.y, ox, oy, ox + Math.cos(a) * R.splashLength, oy + Math.sin(a) * R.splashLength) < (R.splashWidth + p.radius) ** 2;
    }
  if (e.bossMove === 'eruption') { // Eruption: magma blast at the committed target; scorches once the Core is fully awake.
    hit = Math.hypot(p.x - e.attackTargetX, p.y - e.attackTargetY) < R.blastRadius + p.radius;
    if (e.stateTime >= e.stateDuration - .05 && !((e.bossHits ?? 0) & 1)) { e.bossHits = (e.bossHits ?? 0) | 1; if (phase === 2) scorch(e.attackTargetX, e.attackTargetY); }
  }
  if (e.bossMove === 'rush') { // Lava Wave: a projected wave front travels the lane; Ragnaros stays rooted.
    const t = Math.min(1, e.stateTime / Math.max(.01, e.stateDuration));
    const fx = e.bossOriginX! + Math.cos(e.attackAngle) * R.waveLength * t;
    const fy = e.bossOriginY! + Math.sin(e.attackAngle) * R.waveLength * t;
    hit = segmentDistanceSquared(p.x, p.y, e.bossOriginX!, e.bossOriginY!, fx, fy) < (R.waveWidth + p.radius) ** 2;
    if (!((e.bossHits ?? 0) & 1) && e.stateTime >= e.stateDuration * .5) { e.bossHits = (e.bossHits ?? 0) | 1; scorch(fx, fy); }
  }
  if (e.bossMove === 'command') // Lava Wave nova / Emerge: arena-wide burst around him.
    hit = d < R.novaRadius + p.radius;
  if (hit && !e.attackHit && c.visible(e.x, e.y, p.x, p.y)) {
    e.attackHit = true;
    if (e.bossMove === 'command') blastHostiles(e.x, e.y, R.novaRadius, e.attackDamage ?? power * 1.15);
    else hurtHostile(e.attackDamage ?? power, e.attackAngle, p);
  }
  if (e.stateTime >= e.stateDuration) {
    if (e.attackVariant === 2) e.attackVariant = 0; // emerge marker consumed
    transitionEnemy(e, 'recover', enemyRecoveryDuration(e,
      e.bossMove === 'command' ? 1.3 : e.bossMove === 'rush' ? 1 : phase === 2 ? .8 : 1.15));
  }
}
