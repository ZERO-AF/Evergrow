/**
 * Dungeon party state: spawning the AI group into `player.allies` and tracking
 * the roster for party frames. Members are `Ally` actors carrying a `party`
 * payload — the field rides checkpoints and saves untouched (structuredClone
 * preserves it; validWowState ignores unknown ally fields), so a reload
 * mid-dungeon keeps the living members.
 *
 * The roster lives in a WeakMap keyed by the Simulation: it survives in-session
 * checkpoint restores (which clone allies into new objects) and releases with
 * the sim. Members who die stay listed as dead for the rest of the run.
 */
import type { Ally } from './model.ts';
import type { Simulation } from './simulation.ts';
import { WOW_COMBAT } from './wow-types.ts';
import { ALLY_TEMPLATES } from './wow-allies.ts';
import { deriveAttackStats } from './equipment.ts';
import { PARTY_RULES, partyComposition, type PartyMemberSpec, type PartyRole } from './party-content.ts';

/** Party metadata stamped on the ally; serialized with the checkpoint. */
export interface PartyMemberInfo {
  readonly role: PartyRole;
  readonly classId: PartyMemberSpec['classId'];
  readonly name: string;
  readonly color: string;
  /** Sim-time when the taunt compel may be recast. */
  tauntReady: number;
  /** Sim-time when the next heal lands. */
  healReady: number;
  /** Last sim-time the tank's threat trickle was applied. */
  threatTick: number;
}

/** An Ally carrying party metadata. `tint` overrides the template color in drawAlly. */
export type PartyAlly = Ally & { party: PartyMemberInfo; tint?: string };

/** Roster row for the party frame; dead members persist until the run ends. */
export interface PartyRosterEntry {
  readonly allyId: number;
  readonly role: PartyRole;
  readonly classId: PartyMemberSpec['classId'];
  readonly name: string;
  readonly color: string;
  hp: number;
  maxHp: number;
  dead: boolean;
}

const rosters = new WeakMap<Simulation, Map<number, PartyRosterEntry>>();

export const partyMemberOf = (ally: Ally): PartyMemberInfo | undefined =>
  (ally as PartyAlly).party;

export const isPartyAlly = (ally: Ally): ally is PartyAlly =>
  (ally as PartyAlly).party !== undefined;

/** Live party members in spawn order (tank, healer, dps, dps). */
export function partyAllies(sim: Simulation): PartyAlly[] {
  return (sim.player.allies ?? []).filter(isPartyAlly);
}

/**
 * The run's roster: live members first, then members who died this run.
 * Rebuilt from live allies when the map is empty (fresh spawn or reload).
 */
export function partyRoster(sim: Simulation): readonly PartyRosterEntry[] {
  let roster = rosters.get(sim);
  const live = partyAllies(sim);
  if (!roster) {
    if (!live.length) return [];
    roster = new Map();
    rosters.set(sim, roster);
  }
  const liveIds = new Set(live.map(ally => ally.id));
  for (const ally of live) {
    const info = ally.party;
    const entry = roster.get(ally.id);
    if (entry) { entry.hp = ally.hp; entry.maxHp = ally.maxHp; entry.dead = ally.hp <= 0; }
    else roster.set(ally.id, { allyId: ally.id, role: info.role, classId: info.classId, name: info.name, color: info.color, hp: ally.hp, maxHp: ally.maxHp, dead: ally.hp <= 0 });
  }
  // A member gone from the live list without a recorded corpse is dead.
  for (const entry of roster.values()) if (!liveIds.has(entry.allyId)) { entry.dead = true; entry.hp = 0; }
  return [...roster.values()];
}

/**
 * Summon the AI group at the player's position. Role order (tank first) keeps
 * the tank inside the ally cap when a pet or totems already occupy slots.
 * Returns the spawned members; empty when the cap is already full.
 */
export function spawnDungeonParty(sim: Simulation, seed: number): PartyAlly[] {
  const p = sim.player;
  // Despawn first: it reassigns p.allies, so capture the array after.
  despawnDungeonParty(sim);
  const allies = p.allies ??= [];
  const attack = deriveAttackStats(p.stats, p.equipment.mainHand);
  const specs = partyComposition(seed);
  const spawned: PartyAlly[] = [];
  let id = sim.nextEntityIdentity;
  for (const [i, spec] of specs.entries()) {
    if (allies.length >= WOW_COMBAT.maxAllies) break;
    const template = ALLY_TEMPLATES[spec.kind];
    // Fan out around the player; the tank steps ahead toward the player's facing.
    const angle = p.angle + (i - 1.5) * 0.9;
    const distance = spec.role === 'tank' ? 30 : 22;
    const spot = sim.world.move(p.x, p.y, Math.cos(angle) * distance, Math.sin(angle) * distance, template.radius);
    const hp = Math.max(1, Math.round(p.maxHp * template.hpFraction));
    const ally: PartyAlly = {
      id: id++, kind: spec.kind, x: spot.x, y: spot.y, prevX: spot.x, prevY: spot.y, angle: p.angle,
      hp, maxHp: hp, damage: Math.max(1, Math.round(attack.damage * template.damageFraction)),
      stationary: false, remaining: PARTY_RULES.duration,
      targetId: null, attackCooldown: 0, radius: template.radius,
      tint: spec.color,
      party: { role: spec.role, classId: spec.classId, name: spec.name, color: spec.color, tauntReady: 0, healReady: 0, threatTick: 0 },
    };
    allies.push(ally);
    spawned.push(ally);
  }
  sim.reserveIdentity(id);
  if (spawned.length) partyRoster(sim);
  return spawned;
}

/** Remove every party member (dungeon exit, new group, player death cleanup). */
export function despawnDungeonParty(sim: Simulation): void {
  const p = sim.player;
  if (p.allies) p.allies = p.allies.filter(ally => !isPartyAlly(ally));
  rosters.delete(sim);
}
