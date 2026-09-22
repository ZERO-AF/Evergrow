import { enemyMovementMultiplier } from './enemy-modifiers.ts';
import { BOSS_PRESSURE, bossQuickMove, updateBossPressure } from './boss-pressure.ts';
import { enemyRecoveryDuration, enemyWindupDuration } from './enemy-threat.ts';
import type { Ally, DamageType, Enemy } from './model.ts';
import type { EnemyAIContext } from './enemy-ai.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { alertEnemy, transitionEnemy } from './enemy-state.ts';
import { circleIntersectsSector, segmentDistanceSquared } from './combat-geometry.ts';
import { pushChatMessage } from './chat-log.ts';
import { isRaid9Boss, HALION_RULES as R, RAID9_ARENA_CENTER } from './raid9-boss-content.ts';

/**
 * Halion's raid AI (docs/wow-deepening.md §15, ninth wave), modeled on the
 * real WotLK Ruby Sanctum fight and built on the wilderness-boss state
 * machine. Halion holds the forge heart: he never chases — Flame Breath and
 * Tail Lash cover melee range, Meteor Strike / Twilight Cutter / the
 * combustion marks reach the whole sanctum.
 *
 *   P1 100–75% Flame Breath, Meteor Strike detonations, Fiery Combustion
 *              marks (the debuff expires into a lingering fire zone) and the
 *              Twilight Cutter beam sweeping through the arena heart.
 *   P2  75–50% The twilight realm bleeds through: Twilight Whelps and Living
 *              Embers stream in (wave bit 1).
 *   P3  50– 0% The corporeality split: Twilight Scalebearers land (wave bit
 *              2) while Halion's kit turns shadow — Dark Breath replaces
 *              Flame Breath and Soul Consumption replaces Fiery Combustion
 *              (attackVariant 1; void zones burn shadow instead of fire).
 *   Enrage     Twilight Fury at R.enrageAfter seconds of engagement:
 *              +120% damage and a pulsing arena-wide twilight burn.
 *
 * Solo+allies scaling: hostiles are picked from the player and live allies
 * (nearest wins), outgoing damage eases 10% per ally (cap 30%), and AoE
 * mechanics hit every hostile in their footprint.
 */

interface Zone { x: number; y: number; remaining: number; tick: number; shadow: boolean }
type Hostile = { x: number; y: number; radius: number; dead: boolean; ally?: Ally };
interface Mark { target: Hostile; remaining: number; shadow: boolean }
interface Raid9State {
  engagedAt: number;
  enragePulse: number;
  warned: number; // bitmask of issued enrage warnings
  zones: Zone[];
  marks: Mark[];
}
const raid = new WeakMap<Enemy, Raid9State>();
const state = (e: Enemy): Raid9State => {
  let s = raid.get(e);
  if (!s) { s = { engagedAt: -1, enragePulse: 0, warned: 0, zones: [], marks: [] }; raid.set(e, s); }
  return s;
};

/** Seconds of enrage timer remaining; negative once Twilight Fury is active. */
export function raid9EnrageRemaining(e: Enemy, now: number): number | undefined {
  if (!isRaid9Boss(e)) return undefined;
  const s = raid.get(e);
  if (!s || s.engagedAt < 0) return R.enrageAfter;
  return R.enrageAfter - (now - s.engagedAt);
}

/** Live combustion/consumption void zones for the art layer. */
export function raid9Zones(e: Enemy): readonly { x: number; y: number; remaining: number; shadow: boolean }[] {
  return raid.get(e)?.zones ?? [];
}

/** Live combustion/consumption marks for the art layer (targets carrying the expiring debuff). */
export function raid9Marks(e: Enemy): readonly { x: number; y: number; remaining: number; shadow: boolean }[] {
  return (raid.get(e)?.marks ?? []).map(m => ({ x: m.target.x, y: m.target.y, remaining: m.remaining, shadow: m.shadow }));
}

export function updateRaid9Boss(e: Enemy, dt: number, c: EnemyAIContext): void {
  if (!isRaid9Boss(e)) return;
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

  // ── Leash: leaving the sanctum (or wiping) sends him home and resets the fight clock.
  if (player.dead || c.world.isSanctuary?.(player.x, player.y)
    || Math.hypot(player.x - e.homeX, player.y - e.homeY) > R.leash || Math.hypot(e.x - e.homeX, e.y - e.homeY) > R.leash) {
    if (e.state !== 'return') { transitionEnemy(e, 'return'); e.bossMove = undefined; e.awareness = 0; e.burnTime = 0; e.slowTime = 0; }
  }
  if (e.state === 'return') {
    if (Math.hypot(e.x - e.homeX, e.y - e.homeY) < 12) {
      raid.delete(e); // fresh engagement clock, void field and marks next pull
      e.bossTurns = 0;
      transitionEnemy(e, 'idle', 1);
    } else walk(e.homeX, e.homeY, def.speed * 1.5);
    return;
  }
  if (e.state === 'idle' || e.state === 'patrol') {
    if ((d < R.awareness && c.visible(e.x, e.y, p.x, p.y)) || e.awareness >= 1) {
      alertEnemy(e, p);
      s.engagedAt = c.time;
      pushChatMessage(player, 'system', 'Halion roars: "YOUR WORLD TEETERS ON THE BRINK — BEAR WITNESS TO A NEW AGE OF DESTRUCTION!"', c.time);
    } else return;
  }
  if (s.engagedAt < 0) s.engagedAt = c.time; // re-engaged after a wound restore
  if (e.interrupted) e.interrupted = false;

  // ── Twilight Fury: hard enrage — pulsing arena burn + warnings.
  if (enraged) {
    if (!(s.warned & 4)) { s.warned |= 4; pushChatMessage(player, 'system', 'Halion enters the Twilight Fury — "THE TWILIGHT CLAIMS YOU!"', c.time); }
    s.enragePulse -= dt;
    if (s.enragePulse <= 0) {
      s.enragePulse = R.enragePulse;
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: R.enrageRadius, duration: .5, color: '#b06ae8' });
      blastHostiles(e.x, e.y, R.enrageRadius, power * .8, 'shadow');
    }
  } else {
    const left = R.enrageAfter - (c.time - s.engagedAt);
    if (left <= 60 && !(s.warned & 1)) { s.warned |= 1; pushChatMessage(player, 'system', 'Halion grows impatient — the twilight bleeds through!', c.time); }
    if (left <= 15 && !(s.warned & 2)) { s.warned |= 2; pushChatMessage(player, 'system', 'Halion\'s fury is about to peak!', c.time); }
  }

  // ── Void zones left by expired marks and Meteor Strikes.
  for (let i = s.zones.length - 1; i >= 0; i--) {
    const z = s.zones[i];
    z.remaining -= dt; z.tick -= dt;
    if (z.tick <= 0) { z.tick = R.zoneInterval; blastHostiles(z.x, z.y, R.zoneRadius, power * R.zoneDps, z.shadow ? 'shadow' : 'fire'); }
    if (z.remaining <= 0) s.zones.splice(i, 1);
  }
  const zone = (x: number, y: number, shadow: boolean) => {
    if (s.zones.length >= R.zoneMax) s.zones.shift();
    s.zones.push({ x, y, remaining: R.zoneDuration, tick: R.zoneInterval, shadow });
  };

  // ── Fiery Combustion / Soul Consumption: the mark expires into a void zone
  //    at the target's feet — the real fight's drop-the-zone mechanic.
  for (let i = s.marks.length - 1; i >= 0; i--) {
    const m = s.marks[i];
    m.remaining -= dt;
    if (m.remaining > 0) continue;
    s.marks.splice(i, 1);
    const zx = m.target.x, zy = m.target.y;
    zone(zx, zy, m.shadow);
    c.emit({ type: 'blast', x: zx, y: zy, radius: R.zoneRadius, duration: .6, color: m.shadow ? '#8a5adf' : '#ff8a3c' });
    blastHostiles(zx, zy, R.zoneRadius, power * .9, m.shadow ? 'shadow' : 'fire');
    pushChatMessage(player, 'system', m.shadow
      ? 'Soul Consumption erupts — a void zone tears open!'
      : 'Fiery Combustion erupts — fire pools underfoot!', c.time);
  }

  if (e.state === 'recover') { if (e.stateTime >= e.stateDuration) transitionEnemy(e, 'chase'); return; }

  if (updateBossPressure(e, c)) return;

  const phase = e.hp / e.maxHp <= R.phaseThree ? 2 : e.hp / e.maxHp <= R.phaseTwo ? 1 : 0;

  if (e.state === 'chase') {
    e.angle = angle; e.seesPlayer = c.visible(e.x, e.y, p.x, p.y);
    // Phase transitions commit a 'summon' flourish — the twilight bleed at 75%
    // and the corporeality split at 50%. The wave bits (set here since
    // 'warden' gets no auto-bits) gate the whelp / scalebearer admission.
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
    else move = ['sweep', 'command', 'fracture', 'eruption'][Math.floor(turns / 2) % 4] as Enemy['bossMove'];
    if (move === 'sweep' && d > R.breathReach + 10) move = 'eruption';
    e.bossMove = move; e.bossTurns = turns + 1;
    // The corporeality split (phase 3) turns his kit shadow: Dark Breath and
    // Soul Consumption ride attackVariant 1 for the warning spec and damage type.
    e.attackVariant = phase === 2 && (move === 'sweep' || move === 'command') ? 1 : 0;
    e.bossOriginX = e.x; e.bossOriginY = e.y;
    e.attackAngle = angle; e.attackTargetX = p.x; e.attackTargetY = p.y; e.bossHits = 0;
    const quick = e.bossMove === 'jab' || e.bossMove === 'bolt' ? BOSS_PRESSURE[e.bossMove] : null;
    e.attackDamage = power * (quick?.damage ?? (e.bossMove === 'sweep' ? 1 : 1.15));
    const warning = quick?.windup ?? (e.bossMove === 'sweep' ? .9 : e.bossMove === 'command' ? 1.2 : e.bossMove === 'eruption' ? 1.1 : 1.15);
    transitionEnemy(e, 'windup', enemyWindupDuration(e, warning));
    return;
  }

  if (e.state === 'windup') {
    if (e.stateTime < e.stateDuration) return;
    const move = e.bossMove;
    if (move === 'summon') {
      // The wave bit was set at commit; the flourish only announces it.
      c.emit({ type: 'blast', x: e.x, y: e.y, radius: 220, duration: .9, color: '#b06ae8' });
      pushChatMessage(player, 'system', (e.bossPhases ?? 0) & 2
        ? 'Halion\'s corporeality splits — "BALANCED BETWEEN TWO WORLDS — AND MASTER OF BOTH!"'
        : 'Halion phases into twilight — "YOU WILL NOT FOLLOW SO EASILY! MY WHELPS, TO ME!"', c.time);
      transitionEnemy(e, 'recover', enemyRecoveryDuration(e, 1.5));
      return;
    }
    transitionEnemy(e, 'attack', move === 'fracture' ? 1.2 : move === 'eruption' ? 1.4 : move === 'command' ? .5 : .28);
    if (move === 'fracture') {
      c.emit({ type: 'cast', x: e.x, y: e.y, angle: e.attackAngle, enemyKind: e.kind, style: 'shadow' });
    } else {
      c.emit({ type: 'blast', x: move === 'eruption' ? e.attackTargetX : e.x, y: move === 'eruption' ? e.attackTargetY : e.y,
        radius: move === 'eruption' ? R.meteorRadius : move === 'command' ? 90 : 80, duration: .45,
        color: e.attackVariant === 1 ? '#8a5adf' : move === 'eruption' ? '#b06ae8' : '#ff8a3c' });
    }
  }
  if (e.state !== 'attack') return;

  let hit = false;
  if (e.bossMove === 'sweep') // Flame Breath / Dark Breath: frontal cone.
    hit = circleIntersectsSector(p.x, p.y, p.radius, e.x, e.y, e.attackAngle, R.breathReach, R.breathArc);
  if (e.bossMove === 'fracture') { // Twilight Cutter: a beam sweeping through the arena heart.
    const a = e.attackAngle + R.cutterSpeed * e.stateTime;
    const cx = RAID9_ARENA_CENTER.x, cy = RAID9_ARENA_CENTER.y;
    const bx = Math.cos(a) * R.cutterLength, by = Math.sin(a) * R.cutterLength;
    hit = segmentDistanceSquared(p.x, p.y, cx - bx, cy - by, cx + bx, cy + by) < (R.cutterWidth + p.radius) ** 2;
  }
  if (e.bossMove === 'eruption') { // Meteor Strike: delayed detonation at the committed target; the blaze lingers.
    hit = Math.hypot(p.x - e.attackTargetX, p.y - e.attackTargetY) < R.meteorRadius + p.radius;
    if (e.stateTime >= e.stateDuration - .05 && !((e.bossHits ?? 0) & 1)) { e.bossHits = (e.bossHits ?? 0) | 1; zone(e.attackTargetX, e.attackTargetY, false); }
  }
  if (e.bossMove === 'command') { // Fiery Combustion / Soul Consumption: mark the target; expiry drops the zone.
    if (!((e.bossHits ?? 0) & 1)) {
      e.bossHits = (e.bossHits ?? 0) | 1;
      s.marks.push({ target: p, remaining: R.markDuration, shadow: e.attackVariant === 1 });
      c.emit({ type: 'blast', x: p.x, y: p.y, radius: 60, duration: .4, color: e.attackVariant === 1 ? '#8a5adf' : '#ff8a3c' });
    }
  }
  if (hit && !e.attackHit && c.visible(e.x, e.y, p.x, p.y)) {
    e.attackHit = true;
    hurtHostile(e.attackDamage ?? power, e.attackAngle, p,
      e.bossMove === 'fracture' || e.attackVariant === 1 ? 'shadow' : 'fire');
  }
  if (e.stateTime >= e.stateDuration)
    transitionEnemy(e, 'recover', enemyRecoveryDuration(e,
      e.bossMove === 'command' ? 1.3 : e.bossMove === 'fracture' ? 1 : phase === 2 ? .8 : 1.15));
}
