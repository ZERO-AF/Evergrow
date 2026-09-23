/**
 * Dungeon party AI: role behavior layered on top of the generic ally tick.
 * Simulation.updateAllies already moves allies, fights their `targetId` and
 * records `ally:<id>` threat on every hit — this module only assigns targets,
 * runs the tank's taunt/threat trickle and the healer's triage, and despawns
 * the group when the run ends.
 *
 * The host calls tickDungeonParty once per frame ahead of sim.update, so the
 * fixed step consumes this frame's target assignments. Decisions are gated on
 * sim-time cooldowns (tauntReady/healReady/threatTick), so the fixed-step sim
 * stays deterministic regardless of frame rate.
 */
import type { Ally, Enemy, Player } from './model.ts';
import type { Simulation } from './simulation.ts';
import { recordThreat, resolveThreatHolder, tauntThreat, THREAT_RULES } from './enemy-threat.ts';
import { PARTY_RULES } from './party-content.ts';
import { despawnDungeonParty, partyAllies, type PartyAlly } from './party-state.ts';

const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Engaged = aware, taunted, or mid-attack — the states that keep a mob fighting. */
const engaged = (enemy: Enemy): boolean =>
  enemy.state !== 'dead' && enemy.hp > 0
  && (enemy.awareness > 0 || (enemy.taunted?.remaining ?? 0) > 0
    || enemy.state === 'chase' || enemy.state === 'windup' || enemy.state === 'attack' || enemy.state === 'recover');

const liveEnemy = (sim: Simulation, id: number | null | undefined): Enemy | undefined =>
  id == null ? undefined : sim.enemies.find(e => e.id === id && e.state !== 'dead' && e.hp > 0);

function nearestEnemy(sim: Simulation, from: { x: number; y: number }, filter: (e: Enemy) => boolean): Enemy | undefined {
  let best: Enemy | undefined, bestD = Infinity;
  for (const enemy of sim.enemies) {
    if (!filter(enemy)) continue;
    const d = distance(enemy, from);
    if (d < bestD) { best = enemy; bestD = d; }
  }
  return best;
}

/** Who the enemy would swing at without a threat table: the nearest hostile. */
function nearestHostileIs(sim: Simulation, enemy: Enemy, tank: PartyAlly): boolean {
  const p = sim.player;
  let bestD = p.dead ? Infinity : distance(enemy, p);
  let best: Player | Ally | undefined = p.dead ? undefined : p;
  for (const ally of p.allies ?? []) {
    if (ally.hp <= 0 || (ally.stealth?.remaining ?? 0) > 0) continue;
    const d = distance(enemy, ally);
    if (d < bestD) { best = ally; bestD = d; }
  }
  return best === tank;
}

/** Tank: engage the player's target or the nearest engaged enemy; taunt strays
 * off the party and drip bonus threat so damage dealers don't pull. */
function tickTank(sim: Simulation, tank: PartyAlly): void {
  const p = sim.player;
  const playerTarget = liveEnemy(sim, p.targetId);
  const target = playerTarget && engaged(playerTarget) ? playerTarget
    : nearestEnemy(sim, tank, engaged)
    ?? nearestEnemy(sim, p, e => e.state !== 'dead' && e.hp > 0 && distance(e, p) <= PARTY_RULES.engageRadius);
  tank.targetId = target?.id ?? null;
  const source = `ally:${tank.id}` as const;
  // Defensive stance: a steady threat drip on every engaged enemy, gated on
  // sim time so the cadence is frame-rate independent.
  if (sim.time >= tank.party.threatTick + PARTY_RULES.threatTickSeconds) {
    tank.party.threatTick = sim.time;
    for (const enemy of sim.enemies)
      if (engaged(enemy)) recordThreat(enemy, source, tank.damage * PARTY_RULES.threatMultiplier);
  }
  if (sim.time < tank.party.tauntReady) return;
  // Taunt the first engaged enemy that isn't already bound to the tank.
  for (const enemy of sim.enemies) {
    if (!engaged(enemy)) continue;
    const holder = resolveThreatHolder(enemy, sim.players, sim.players.flatMap(pl => pl.allies ?? []));
    if (holder === source) continue;
    if (holder === undefined && nearestHostileIs(sim, enemy, tank)) continue;
    enemy.taunted = { remaining: PARTY_RULES.tauntDuration, allyId: tank.id };
    enemy.awareness = Math.max(enemy.awareness, 1);
    tauntThreat(enemy, source);
    tank.party.tauntReady = sim.time + PARTY_RULES.tauntCooldown;
    break;
  }
}

/** Healer: triage the lowest-hp party member (player included), else smite the
 * tank's target. Heals credit `ally:<id>` threat like the player's own heals. */
function tickHealer(sim: Simulation, healer: PartyAlly, focus: Enemy | undefined): void {
  const p = sim.player;
  const wounded: { hp: number; maxHp: number; ally?: Ally }[] = [];
  if (!p.dead && p.hp < p.maxHp * PARTY_RULES.healBelow) wounded.push(p);
  for (const ally of p.allies ?? [])
    if (ally.hp > 0 && ally.hp < ally.maxHp * PARTY_RULES.healBelow) wounded.push({ hp: ally.hp, maxHp: ally.maxHp, ally });
  let target: { hp: number; maxHp: number; ally?: Ally } | undefined;
  for (const candidate of wounded) {
    if (candidate.ally && distance(candidate.ally, healer) > PARTY_RULES.healRange) continue;
    if (!candidate.ally && distance(p, healer) > PARTY_RULES.healRange) continue;
    if (!target || candidate.hp / candidate.maxHp < target.hp / target.maxHp) target = candidate;
  }
  if (target && sim.time >= healer.party.healReady) {
    healer.party.healReady = sim.time + PARTY_RULES.healCooldown;
    let healed: number;
    if (target.ally) {
      const before = target.ally.hp;
      sim.healAlly(target.ally, PARTY_RULES.healFraction, '#7ed9a8');
      healed = target.ally.hp - before;
    } else {
      // playerHeal would credit 'player' threat; the healer owns its aggro.
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.round(p.maxHp * PARTY_RULES.healFraction)));
      healed = p.hp - before;
    }
    // WoW healer-aggro: half the heal, split across every engaged enemy.
    const engagedEnemies = sim.enemies.filter(engaged);
    if (healed > 0 && engagedEnemies.length) {
      const share = healed * THREAT_RULES.healFactor / engagedEnemies.length;
      for (const enemy of engagedEnemies) recordThreat(enemy, `ally:${healer.id}`, share);
    }
  }
  const smite = focus ?? nearestEnemy(sim, healer, engaged);
  healer.targetId = smite?.id ?? null;
}

/**
 * One frame of party behavior. Despawns the group the moment the run ends
 * (exit portal, hearthstone, death transition — all clear dungeonFloor).
 */
export function tickDungeonParty(sim: Simulation): void {
  const members = partyAllies(sim);
  if (!members.length) return;
  if (!sim.dungeonFloor && !sim.expeditions.location) { despawnDungeonParty(sim); return; }
  const p = sim.player;
  if (p.dead) return;
  const tank = members.find(m => m.party.role === 'tank' && m.hp > 0);
  const healer = members.find(m => m.party.role === 'healer' && m.hp > 0);
  const dps = members.filter(m => m.party.role === 'dps' && m.hp > 0);
  if (tank) tickTank(sim, tank);
  const focus = tank ? liveEnemy(sim, tank.targetId) : undefined;
  if (healer) tickHealer(sim, healer, focus);
  for (const member of dps) {
    // Focus-fire the tank's target; without one, assist on whatever is engaged.
    member.targetId = (focus ?? nearestEnemy(sim, member, engaged))?.id ?? null;
  }
}
