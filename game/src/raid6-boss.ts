import { enemyMovementMultiplier } from './enemy-modifiers.ts';
import { BOSS_PRESSURE, bossQuickMove, updateBossPressure } from './boss-pressure.ts';
import { enemyRecoveryDuration, enemyWindupDuration } from './enemy-threat.ts';
import type { Ally, DamageType, Enemy } from './model.ts';
import type { EnemyAIContext } from './enemy-ai.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { alertEnemy, transitionEnemy } from './enemy-state.ts';
import { circleIntersectsSector, segmentDistanceSquared } from './combat-geometry.ts';
import { pushChatMessage } from './chat-log.ts';
import { isRaid6Boss, isSarthDrake, SARTH_DRAKES, SARTH_DRAKE_DEAD_BIT, SARTH_RULES as R } from './raid6-boss-content.ts';

/**
 * Sartharion's raid AI (docs/wow-deepening.md §15, sixth wave), modeled on the
 * real WotLK Obsidian Sanctum fight and built on the wilderness-boss state
 * machine. Sartharion holds the lava platform: he never chases — Cleave and
 * Flame Breath cover melee range, Lava Fissure / Lava Wave / Twilight Revenge
 * reach the whole sanctum.
 *
 *   Pull       The three drake lieutenants (Tenebron, Shadron, Vesperon) stand
 *              on the rim as ordinary members. Kill them first for the easy
 *              fight — or pull with drakes alive for the real '3D' hardmode:
 *              each living drake empowers Sartharion +25% damage (Will of
 *              Sartharion) and answers his timed call-downs into the fight.
 *   P1 100–65% Cleave + Flame Breath, quick Tail Lash / Fireball pressure,
 *              Lava Fissure detonations and Twilight Revenge novas.
 *   P2  65–30% Twilight Whelps swarm in (wave bit 1, admitted by updateDungeon).
 *   P3  30– 0% Veteran whelps plus Onyx Guardians (wave bit 2); afterwards his
 *              tempo quickens and fissures leave lava scorch.
 *   Enrage     Twilight Fury at R.enrageAfter seconds of engagement:
 *              +120% damage and a pulsing arena-wide burn until the wipe.
 *
 * Hardmode bookkeeping: each drake's death latches a high bit on the boss's
 * own `bossPhases` (4/8/16 — bits 1/2 stay wave gates). The latch survives
 * corpse culling, leash resets and save/load via syncDungeon's
 * run.states.warden row, so `sartharionDrakesAlive(run)` reads the kill-time
 * count for the chest's hardmode bonus.
 * Solo+allies scaling: hostiles are picked from the player and live allies
 * (nearest wins), outgoing damage eases 10% per ally (cap 30%), and AoE
 * mechanics hit every hostile in their footprint.
 */


interface Scorch { x: number; y: number; remaining: number; tick: number }
interface Raid6State {
  engagedAt: number;
  enragePulse: number;
  warned: number; // bitmask of issued enrage warnings
  scorches: Scorch[];
  called: number;    // bitmask of drake call-downs already issued (bits 1/2/4)
}
const raid = new WeakMap<Enemy, Raid6State>();
const state = (e: Enemy): Raid6State => {
  let s = raid.get(e);
  if (!s) { s = { engagedAt: -1, enragePulse: 0, warned: 0, scorches: [], called: 0 }; raid.set(e, s); }
  return s;
};


/** Seconds of enrage timer remaining; negative once Twilight Fury is active. */
export function raid6EnrageRemaining(e: Enemy, now: number): number | undefined {
  if (!isRaid6Boss(e)) return undefined;
  const s = raid.get(e);
  if (!s || s.engagedAt < 0) return R.enrageAfter;
  return R.enrageAfter - (now - s.engagedAt);
}

/** Live lava scorch zones for the art layer. */
export function raid6Scorches(e: Enemy): readonly { x: number; y: number; remaining: number }[] {
  return raid.get(e)?.scorches ?? [];
}
type Hostile = { x: number; y: number; radius: number; dead: boolean; ally?: Ally };

export function updateRaid6Boss(e: Enemy, dt: number, c: EnemyAIContext): void {
  if (!isRaid6Boss(e)) return;
  const def = ENEMY_DEFINITIONS[e.kind], s = state(e), player = c.player;
  const allies = c.allies ?? [];
  const drakes = c.enemies.filter(en => isSarthDrake(en));

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
  // Will of Sartharion: every living drake empowers him. Deaths latch on the
  // boss's own bossPhases high bits (4/8/16) — corpses are culled from
  // c.enemies after ~0.5s and leash resets wipe WeakMap state, but the bits
  // persist on run.states.warden via syncDungeon. Unlatched drakes are alive.
  const drakeIds = Object.keys(SARTH_DRAKES);
  for (let i = 0; i < drakeIds.length; i++)
    if (drakes.some(en => en.campMemberId === drakeIds[i] && en.hp <= 0))
      e.bossPhases = (e.bossPhases ?? 0) | SARTH_DRAKE_DEAD_BIT(i);
  const drakesAlive = drakeIds.reduce((n, _id, i) => n + (((e.bossPhases ?? 0) & SARTH_DRAKE_DEAD_BIT(i)) ? 0 : 1), 0);
  const power = e.damage * allyEase * (enraged ? R.enrageDamage : 1) * (1 + R.drakeDamage * drakesAlive);
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

  // ── Leash: leaving the sanctum (or wiping) sends him home and resets the fight clock.
  if (player.dead || c.world.isSanctuary?.(player.x, player.y)
    || Math.hypot(player.x - e.homeX, player.y - e.homeY) > R.leash || Math.hypot(e.x - e.homeX, e.y - e.homeY) > R.leash) {
    if (e.state !== 'return') { transitionEnemy(e, 'return'); e.bossMove = undefined; e.awareness = 0; e.burnTime = 0; e.slowTime = 0; }
  }
  if (e.state === 'return') {
    if (Math.hypot(e.x - e.homeX, e.y - e.homeY) < 12) {
      raid.delete(e); // fresh engagement clock, scorch field and call-downs next pull
      e.bossTurns = 0;
      transitionEnemy(e, 'idle', 1);
    } else walk(e.homeX, e.homeY, def.speed * 1.5);
    return;
  }
  if (e.state === 'idle' || e.state === 'patrol') {
    if ((d < R.awareness && c.visible(e.x, e.y, p.x, p.y)) || e.awareness >= 1) {
      alertEnemy(e, p);
      s.engagedAt = c.time;
      pushChatMessage(player, 'system', drakesAlive > 0
        ? `Sartharion roars: "I AM THE ONYX GUARDIAN! ${drakesAlive === 3 ? 'ALL' : 'MY'} DRAKES, TO ME!" — ${drakesAlive} drake${drakesAlive === 1 ? '' : 's'} empower him!`
        : 'Sartharion roars: "I AM THE ONYX GUARDIAN! BURN, INSECTS!"', c.time);
    } else return;
  }
  if (s.engagedAt < 0) s.engagedAt = c.time; // re-engaged after a wound restore
  if (e.interrupted) e.interrupted = false;

  // ── Drake call-downs: on cadence he calls a living drake into the fight.
  for (let i = 0; i < R.drakeCalls.length; i++) {
    const bit = 1 << i;
    if ((s.called & bit) || c.time - s.engagedAt < R.drakeCalls[i]) continue;
    s.called |= bit;
    const drake = drakes.find(en => en.campMemberId === Object.keys(SARTH_DRAKES)[i] && en.hp > 0);
    if (!drake) continue; // already slain — the call goes unanswered
    alertEnemy(drake, p);
    c.emit({ type: 'blast', x: drake.x, y: drake.y, radius: 160, duration: .8, color: '#8a5adf' });
    pushChatMessage(player, 'system', `Sartharion calls out: "${SARTH_DRAKES[drake.campMemberId!].toUpperCase()}! TO ME!"`, c.time);
  }

  // ── Twilight Fury: hard enrage — pulsing arena burn + warnings.
  if (enraged) {
    if (!(s.warned & 4)) { s.warned |= 4; pushChatMessage(player, 'system', 'Sartharion enters the Twilight Fury — "THE TWILIGHT CLAIMS YOU!"', c.time); }
    s.enragePulse -= dt;
    if (s.enragePulse <= 0) {
      s.enragePulse = R.enragePulse;
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: R.enrageRadius, duration: .5, color: '#ff6a2e' });
      blastHostiles(e.x, e.y, R.enrageRadius, power * .8, 'fire');
    }
  } else {
    const left = R.enrageAfter - (c.time - s.engagedAt);
    if (left <= 60 && !(s.warned & 1)) { s.warned |= 1; pushChatMessage(player, 'system', 'Sartharion grows impatient — the lava churns hotter!', c.time); }
    if (left <= 15 && !(s.warned & 2)) { s.warned |= 2; pushChatMessage(player, 'system', 'Sartharion\'s fury is about to peak!', c.time); }
  }

  // ── Lava scorch zones left by fissures and Lava Waves.
  for (let i = s.scorches.length - 1; i >= 0; i--) {
    const z = s.scorches[i];
    z.remaining -= dt; z.tick -= dt;
    if (z.tick <= 0) { z.tick = R.scorchInterval; blastHostiles(z.x, z.y, R.scorchRadius, power * R.scorchDps, 'fire'); }
    if (z.remaining <= 0) s.scorches.splice(i, 1);
  }
  const scorch = (x: number, y: number) => {
    if (s.scorches.length >= R.scorchMax) s.scorches.shift();
    s.scorches.push({ x, y, remaining: R.scorchDuration, tick: R.scorchInterval });
  };

  if (e.state === 'recover') { if (e.stateTime >= e.stateDuration) transitionEnemy(e, 'chase'); return; }

  if (updateBossPressure(e, c)) return;

  const phase = e.hp / e.maxHp <= R.phaseThree ? 2 : e.hp / e.maxHp <= R.phaseTwo ? 1 : 0;

  if (e.state === 'chase') {
    e.angle = angle; e.seesPlayer = c.visible(e.x, e.y, p.x, p.y);
    // Phase transitions commit a 'summon' flourish — the Twilight Whelp /
    // Guardian calls. The wave bits (set here since 'warden' gets no auto-bits)
    // gate the add admission.
    const bit = phase === 1 && !((e.bossPhases ?? 0) & 1) ? 1 : phase === 2 && !((e.bossPhases ?? 0) & 2) ? 2 : 0;
    if (bit) {
      e.bossPhases = (e.bossPhases ?? 0) | bit;
      e.bossMove = 'summon';
      e.bossTurns = (e.bossTurns ?? 0) + 1;
      e.attackAngle = angle; e.attackTargetX = p.x; e.attackTargetY = p.y; e.bossHits = 0;
      e.attackDamage = power;
      transitionEnemy(e, 'windup', enemyWindupDuration(e, 1.4));
      return;
    }
    // Rooted on the platform: he pivots to face his target but never chases.
    const turns = e.bossTurns ?? 0;
    let move: Enemy['bossMove'];
    if (turns % 2) move = bossQuickMove(d, p.radius);
    else if (phase === 2) move = ['sweep', 'command', 'fracture', 'rush', 'eruption'][Math.floor(turns / 2) % 5] as Enemy['bossMove'];
    else move = ['sweep', 'command', 'fracture', 'rush'][Math.floor(turns / 2) % 4] as Enemy['bossMove'];
    if (move === 'sweep' && d > R.cleaveReach + 10) move = phase === 2 ? 'command' : 'eruption';
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
      // The wave bit was set at commit; the flourish only announces it.
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: 220, duration: .9, color: '#ff8a3c' });
      pushChatMessage(player, 'system', (e.bossPhases ?? 0) & 2
        ? 'Sartharion calls out: "ONYX GUARDIANS! DEFEND YOUR MASTER!"'
        : 'Sartharion calls out: "TWILIGHT WHELPS! FEAST UPON THEM!"', c.time);
      transitionEnemy(e, 'recover', enemyRecoveryDuration(e, 1.5));
      return;
    }
    transitionEnemy(e, 'attack', move === 'rush' ? .8 : move === 'fracture' ? .7 : move === 'eruption' ? 1.4 : move === 'command' ? .5 : .28);
    if (move === 'rush') {
      c.emit({ type: 'cast', x: e.x, y: e.y, angle: e.attackAngle, enemyKind: e.kind, style: 'fire' });
    } else {
      c.emit({ type: 'blast', x: move === 'eruption' ? e.attackTargetX : e.x, y: move === 'eruption' ? e.attackTargetY : e.y,
        radius: move === 'eruption' ? R.fissureRadius : move === 'command' ? 130 : 80, duration: .45,
        color: move === 'eruption' ? '#8a5adf' : '#ff8a3c' });
    }
  }
  if (e.state !== 'attack') return;

  let hit = false;
  if (e.bossMove === 'sweep') // Cleave: frontal melee arc.
    hit = circleIntersectsSector(p.x, p.y, p.radius, e.x, e.y, e.attackAngle, R.cleaveReach, R.cleaveArc);
  if (e.bossMove === 'fracture') // Flame Breath: three staggered fire lanes.
    for (let i = 0; i < R.breathOffsets.length; i++) {
      if (e.stateTime < i * .2 || ((e.bossHits ?? 0) & 1 << i)) continue;
      e.bossHits = (e.bossHits ?? 0) | 1 << i;
      const a = e.attackAngle + R.breathOffsets[i], ox = e.bossOriginX!, oy = e.bossOriginY!;
      c.emit({ type: 'blast', x: ox + Math.cos(a) * 200, y: oy + Math.sin(a) * 200, radius: 56, duration: .4, color: '#ff8a3c' });
      hit ||= segmentDistanceSquared(p.x, p.y, ox, oy, ox + Math.cos(a) * R.breathLength, oy + Math.sin(a) * R.breathLength) < (R.breathWidth + p.radius) ** 2;
    }
  if (e.bossMove === 'eruption') { // Lava Fissure: detonation at the committed target; the scorch lingers.
    hit = Math.hypot(p.x - e.attackTargetX, p.y - e.attackTargetY) < R.fissureRadius + p.radius;
    if (e.stateTime >= e.stateDuration - .05 && !((e.bossHits ?? 0) & 1)) { e.bossHits = (e.bossHits ?? 0) | 1; scorch(e.attackTargetX, e.attackTargetY); }
  }
  if (e.bossMove === 'rush') { // Lava Wave: a projected wave front travels the lane; Sartharion stays rooted.
    const t = Math.min(1, e.stateTime / Math.max(.01, e.stateDuration));
    const fx = e.bossOriginX! + Math.cos(e.attackAngle) * R.waveLength * t;
    const fy = e.bossOriginY! + Math.sin(e.attackAngle) * R.waveLength * t;
    hit = segmentDistanceSquared(p.x, p.y, e.bossOriginX!, e.bossOriginY!, fx, fy) < (R.waveWidth + p.radius) ** 2;
    if (!((e.bossHits ?? 0) & 1) && e.stateTime >= e.stateDuration * .5) { e.bossHits = (e.bossHits ?? 0) | 1; scorch(fx, fy); }
  }
  if (e.bossMove === 'command') // Twilight Revenge: arena-wide nova around him.
    hit = d < R.novaRadius + p.radius;
  if (hit && !e.attackHit && c.visible(e.x, e.y, p.x, p.y)) {
    e.attackHit = true;
    if (e.bossMove === 'command') blastHostiles(e.x, e.y, R.novaRadius, e.attackDamage ?? power * 1.15, 'shadow');
    else hurtHostile(e.attackDamage ?? power, e.attackAngle, p,
      e.bossMove === 'eruption' ? 'shadow' : 'fire');
  }
  if (e.stateTime >= e.stateDuration)
    transitionEnemy(e, 'recover', enemyRecoveryDuration(e,
      e.bossMove === 'command' ? 1.3 : e.bossMove === 'rush' ? 1 : phase === 2 ? .8 : 1.15));
}
