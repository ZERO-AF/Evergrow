import { enemyMovementMultiplier } from './enemy-modifiers.ts';
import { BOSS_PRESSURE, bossQuickMove, updateBossPressure } from './boss-pressure.ts';
import { enemyRecoveryDuration, enemyWindupDuration } from './enemy-threat.ts';
import type { Ally, DamageType, Enemy } from './model.ts';
import type { EnemyAIContext } from './enemy-ai.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { alertEnemy, transitionEnemy } from './enemy-state.ts';
import { circleIntersectsSector, segmentDistanceSquared } from './combat-geometry.ts';
import { pushChatMessage } from './chat-log.ts';
import { isRaid4Boss, LICHKING_RULES as R } from './raid4-boss-content.ts';

/**
 * The Lich King's raid AI (docs/wow-deepening.md §15, fourth wave), modeled on
 * the real WotLK Icecrown Citadel fight and built on the wilderness-boss state
 * machine. The Lich King stands before the Frozen Throne: he never chases —
 * Soul Reaper covers melee range, Necrotic Plague / Remorseless Winter /
 * Defile reach the whole arena.
 *
 *   P1 100–70%  Soul Reaper + Pain and Suffering, quick Infest / Necrotic
 *               Plague pressure, Defile void zones and Remorseless Winter
 *               novas.
 *   P2  70–40%  First transition: Drudge Ghouls shamble in (wave bit 1,
 *               admitted by updateDungeon). Summon Vile Spirits begins on its
 *               cadence — each cast binds a pack of vile spirits (wave bits
 *               4/8/16) or detonates for shadow damage once the packs are
 *               spent.
 *   P3  40– 0%  Second transition: Val'kyr Shadowguards and Shambling Horrors
 *               (wave bit 2); afterwards his tempo quickens and Ice Spheres
 *               creep across the floor as projected frost lanes.
 *   Enrage      Fury of Frostmourne at R.enrageAfter seconds of engagement:
 *               +120% damage and a pulsing arena-wide shadowfrost until the
 *               wipe.
 *
 * Solo+allies scaling: hostiles are picked from the player and live allies
 * (nearest wins), outgoing damage eases 10% per ally (cap 30%), and AoE
 * mechanics hit every hostile in their footprint.
 */

interface DefileZone { x: number; y: number; remaining: number; tick: number }
interface Raid4State {
  engagedAt: number;
  enragePulse: number;
  warned: number; // bitmask of issued enrage warnings
  defiles: DefileZone[];
  nextVile: number; // sim time when Summon Vile Spirits is next due; 0 = not yet scheduled
}
const raid = new WeakMap<Enemy, Raid4State>();
const state = (e: Enemy): Raid4State => {
  let s = raid.get(e);
  if (!s) { s = { engagedAt: -1, enragePulse: 0, warned: 0, defiles: [], nextVile: 0 }; raid.set(e, s); }
  return s;
};

/** Seconds of enrage timer remaining; negative once Fury of Frostmourne is active. */
export function raid4EnrageRemaining(e: Enemy, now: number): number | undefined {
  if (!isRaid4Boss(e)) return undefined;
  const s = raid.get(e);
  if (!s || s.engagedAt < 0) return R.enrageAfter;
  return R.enrageAfter - (now - s.engagedAt);
}

/** Live Defile void zones for the art layer. */
export function raid4Defiles(e: Enemy): readonly { x: number; y: number; remaining: number }[] {
  return raid.get(e)?.defiles ?? [];
}
type Hostile = { x: number; y: number; radius: number; dead: boolean; ally?: Ally };

export function updateRaid4Boss(e: Enemy, dt: number, c: EnemyAIContext): void {
  if (!isRaid4Boss(e)) return;
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

  // ── Leash: leaving the throne room (or wiping) sends him home and resets the fight clock.
  if (player.dead || c.world.isSanctuary?.(player.x, player.y)
    || Math.hypot(player.x - e.homeX, player.y - e.homeY) > R.leash || Math.hypot(e.x - e.homeX, e.y - e.homeY) > R.leash) {
    if (e.state !== 'return') { transitionEnemy(e, 'return'); e.bossMove = undefined; e.awareness = 0; e.burnTime = 0; e.slowTime = 0; }
  }
  if (e.state === 'return') {
    if (Math.hypot(e.x - e.homeX, e.y - e.homeY) < 12) {
      raid.delete(e); // fresh engagement clock, Defile field and Vile Spirits cadence next pull
      e.bossTurns = 0;
      transitionEnemy(e, 'idle', 1);
    } else walk(e.homeX, e.homeY, def.speed * 1.5);
    return;
  }
  if (e.state === 'idle' || e.state === 'patrol') {
    if ((d < R.awareness && c.visible(e.x, e.y, p.x, p.y)) || e.awareness >= 1) {
      alertEnemy(e, p);
      s.engagedAt = c.time;
      s.nextVile = c.time + R.vileAfter;
      pushChatMessage(player, 'system', 'The Lich King speaks: "You stand upon the hallowed ground of the Scourge. Frostmourne hungers."', c.time);
    } else return;
  }
  if (s.engagedAt < 0) { s.engagedAt = c.time; s.nextVile = c.time + R.vileAfter; } // re-engaged after a wound restore
  if (e.interrupted) e.interrupted = false;

  // ── Fury of Frostmourne: hard enrage — pulsing arena shadowfrost + warnings.
  if (enraged) {
    if (!(s.warned & 4)) { s.warned |= 4; pushChatMessage(player, 'system', 'The Lich King channels the Fury of Frostmourne — "Frostmourne hungers!"', c.time); }
    s.enragePulse -= dt;
    if (s.enragePulse <= 0) {
      s.enragePulse = R.enragePulse;
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: R.enrageRadius, duration: .5, color: '#8fd8ff' });
      blastHostiles(e.x, e.y, R.enrageRadius, power * .8, 'shadow');
    }
  } else {
    const left = R.enrageAfter - (c.time - s.engagedAt);
    if (left <= 60 && !(s.warned & 1)) { s.warned |= 1; pushChatMessage(player, 'system', 'The Lich King grows impatient — the cold around the throne deepens!', c.time); }
    if (left <= 15 && !(s.warned & 2)) { s.warned |= 2; pushChatMessage(player, 'system', 'The Lich King\'s fury is about to peak!', c.time); }
  }

  // ── Defile void zones left by eruptions and Ice Sphere creeps.
  for (let i = s.defiles.length - 1; i >= 0; i--) {
    const z = s.defiles[i];
    z.remaining -= dt; z.tick -= dt;
    if (z.tick <= 0) { z.tick = R.defileZoneInterval; blastHostiles(z.x, z.y, R.defileZoneRadius, power * R.defileZoneDps, 'shadow'); }
    if (z.remaining <= 0) s.defiles.splice(i, 1);
  }
  const defileZone = (x: number, y: number) => {
    if (s.defiles.length >= R.defileZoneMax) s.defiles.shift();
    s.defiles.push({ x, y, remaining: R.defileZoneDuration, tick: R.defileZoneInterval });
  };

  if (e.state === 'recover') { if (e.stateTime >= e.stateDuration) transitionEnemy(e, 'chase'); return; }

  if (updateBossPressure(e, c)) return;

  const phase = e.hp / e.maxHp <= R.phaseThree ? 2 : e.hp / e.maxHp <= R.phaseTwo ? 1 : 0;

  if (e.state === 'chase') {
    e.angle = angle; e.seesPlayer = c.visible(e.x, e.y, p.x, p.y);
    // Phase transitions commit a 'summon' flourish — the add call. The wave
    // bits (set here since 'warden' gets no auto-bits) gate add admission.
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
    // Summon Vile Spirits on its cadence: a 'summon' flourish (attackVariant 2)
    // that binds the next pack of vile spirits — or detonates for shadow
    // damage once all three packs are spent.
    if (s.nextVile > 0 && c.time >= s.nextVile) {
      s.nextVile = c.time + R.vileEvery;
      e.bossMove = 'summon';
      e.attackVariant = 2;
      e.bossTurns = (e.bossTurns ?? 0) + 1;
      e.attackAngle = angle; e.attackTargetX = p.x; e.attackTargetY = p.y; e.bossHits = 0;
      e.attackDamage = power * 1.1;
      transitionEnemy(e, 'windup', enemyWindupDuration(e, 1.2));
      return;
    }
    // Rooted at the throne: he pivots to face his target but never chases.
    const turns = e.bossTurns ?? 0;
    let move: Enemy['bossMove'];
    if (turns % 2) move = bossQuickMove(d, p.radius);
    else if (phase === 2) move = ['sweep', 'command', 'fracture', 'rush', 'eruption'][Math.floor(turns / 2) % 5] as Enemy['bossMove'];
    else move = ['sweep', 'command', 'fracture', 'eruption'][Math.floor(turns / 2) % 4] as Enemy['bossMove'];
    if (move === 'sweep' && d > R.reaperReach + 10) move = phase === 2 ? 'command' : 'eruption';
    if (move === 'command' && d > R.winterRadius + 10) move = 'eruption';
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
        // Summon Vile Spirits: bind the next spirit pack; once all packs are
        // spent the spirits lash out as a shadow burst instead.
        const pack = R.vileBits.find(b => !((e.bossPhases ?? 0) & b));
        if (pack !== undefined) {
          e.bossPhases = (e.bossPhases ?? 0) | pack;
          c.emit({ type: 'blast', x: e.x, y: e.y, radius: 190, duration: .8, color: '#8a5adf' });
          pushChatMessage(player, 'system', 'The Lich King calls out: "Come, spirits of the damned!"', c.time);
        } else {
          blastHostiles(p.x, p.y, 150, e.attackDamage ?? power, 'shadow');
          c.emit({ type: 'blast', x: p.x, y: p.y, radius: 150, duration: .6, color: '#8a5adf' });
          pushChatMessage(player, 'system', 'The Lich King calls out: "Your souls are mine!"', c.time);
        }
      } else {
        // Transition call: the wave bit was set at commit; the flourish only announces it.
        c.emit({ type: 'blast', x: e.x, y: e.y, radius: 220, duration: .9, color: '#8fd8ff' });
        pushChatMessage(player, 'system', (e.bossPhases ?? 0) & 2
          ? 'The Lich King calls out: "Val\'kyr, your master calls!"'
          : 'The Lich King calls out: "Arise, Drudge Ghouls! Feast upon their flesh!"', c.time);
      }
      e.attackVariant = 0;
      transitionEnemy(e, 'recover', enemyRecoveryDuration(e, 1.5));
      return;
    }
    transitionEnemy(e, 'attack', move === 'rush' ? .8 : move === 'fracture' ? .7 : move === 'eruption' ? 1.4 : move === 'command' ? .5 : .28);
    if (move === 'rush') {
      c.emit({ type: 'cast', x: e.x, y: e.y, angle: e.attackAngle, enemyKind: e.kind, style: 'frost' });
    } else {
      c.emit({ type: 'blast', x: move === 'eruption' ? e.attackTargetX : e.x, y: move === 'eruption' ? e.attackTargetY : e.y,
        radius: move === 'eruption' ? R.defileRadius : move === 'command' ? 130 : 80, duration: .45,
        color: move === 'eruption' ? '#8a5adf' : move === 'fracture' ? '#a5d64f' : '#8fd8ff' });
    }
  }
  if (e.state !== 'attack') return;

  let hit = false;
  if (e.bossMove === 'sweep') // Soul Reaper: frontal Frostmourne cleave.
    hit = circleIntersectsSector(p.x, p.y, p.radius, e.x, e.y, e.attackAngle, R.reaperReach, R.reaperArc);
  if (e.bossMove === 'fracture') // Pain and Suffering: three staggered shadow lanes.
    for (let i = 0; i < R.sufferingOffsets.length; i++) {
      if (e.stateTime < i * .2 || ((e.bossHits ?? 0) & 1 << i)) continue;
      e.bossHits = (e.bossHits ?? 0) | 1 << i;
      const a = e.attackAngle + R.sufferingOffsets[i], ox = e.bossOriginX!, oy = e.bossOriginY!;
      c.emit({ type: 'blast', x: ox + Math.cos(a) * 200, y: oy + Math.sin(a) * 200, radius: 56, duration: .4, color: '#a5d64f' });
      hit ||= segmentDistanceSquared(p.x, p.y, ox, oy, ox + Math.cos(a) * R.sufferingLength, oy + Math.sin(a) * R.sufferingLength) < (R.sufferingWidth + p.radius) ** 2;
    }
  if (e.bossMove === 'eruption') { // Defile: void detonation at the committed target; the zone lingers.
    hit = Math.hypot(p.x - e.attackTargetX, p.y - e.attackTargetY) < R.defileRadius + p.radius;
    if (e.stateTime >= e.stateDuration - .05 && !((e.bossHits ?? 0) & 1)) { e.bossHits = (e.bossHits ?? 0) | 1; defileZone(e.attackTargetX, e.attackTargetY); }
  }
  if (e.bossMove === 'rush') { // Ice Sphere: a frost front travels the lane; the Lich King stays rooted.
    const t = Math.min(1, e.stateTime / Math.max(.01, e.stateDuration));
    const fx = e.bossOriginX! + Math.cos(e.attackAngle) * R.sphereLength * t;
    const fy = e.bossOriginY! + Math.sin(e.attackAngle) * R.sphereLength * t;
    hit = segmentDistanceSquared(p.x, p.y, e.bossOriginX!, e.bossOriginY!, fx, fy) < (R.sphereWidth + p.radius) ** 2;
    if (!((e.bossHits ?? 0) & 1) && e.stateTime >= e.stateDuration * .5) { e.bossHits = (e.bossHits ?? 0) | 1; defileZone(fx, fy); }
  }
  if (e.bossMove === 'command') // Remorseless Winter: arena-wide nova around him.
    hit = d < R.winterRadius + p.radius;
  if (hit && !e.attackHit && c.visible(e.x, e.y, p.x, p.y)) {
    e.attackHit = true;
    if (e.bossMove === 'command') blastHostiles(e.x, e.y, R.winterRadius, e.attackDamage ?? power * 1.15, 'frost');
    else hurtHostile(e.attackDamage ?? power, e.attackAngle, p,
      e.bossMove === 'rush' ? 'frost' : 'shadow');
  }
  if (e.stateTime >= e.stateDuration)
    transitionEnemy(e, 'recover', enemyRecoveryDuration(e,
      e.bossMove === 'command' ? 1.3 : e.bossMove === 'rush' ? 1 : phase === 2 ? .8 : 1.15));
}
