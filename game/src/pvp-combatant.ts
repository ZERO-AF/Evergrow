import type { Enemy, EnemyKind, EnemyState, Player } from './model.ts';
import type { BiomeId } from './biomes.ts';
import type { EnemyRank } from './progression-content.ts';
import type { CcKind } from './wow-types.ts';
import { PlayerMovement } from './player-movement.ts';
import { deriveAttackStats } from './equipment.ts';

/** Arena team id: 'A' is the player's team, 'B' the opposing team. */
export type PvpTeam = 'A' | 'B';

/** Per-actor input/combat bookkeeping the simulation swaps in while running a
 * combatant's turn. The real player's bag lives on the Simulation fields outside
 * PvP; inside a match every combatant owns one of these. */
export interface ActorControl {
  skillBuffer: { slot: number; until: number; pressed?: boolean } | null;
  blockedDrawSlot: number | null;
  attackBuffer: number;
  dodgeBuffer: number;
  healBuffer: number;
  hurtGuard: number;
  /** Rage/runic decay deadline: the last sim time this actor dealt or took damage + delay. */
  combatUntil: number;
  resourceInitialized: boolean;
  /** Edge-slide steering state; one per combatant, never shared. */
  movement: PlayerMovement;
  /** Pet/minion skill cooldowns keyed by ally id → skill id → ready-at sim time. */
  allySkillCooldowns: Map<number, Map<string, number>>;
}

export function freshActorControl(): ActorControl {
  return {
    skillBuffer: null, blockedDrawSlot: null,
    attackBuffer: -1, dodgeBuffer: -1, healBuffer: -1,
    hurtGuard: 0, combatUntil: 0, resourceInitialized: false,
    movement: new PlayerMovement(), allySkillCooldowns: new Map(),
  };
}

/** AI controller state carried by every combatant (the real player's is inert —
 * its input comes from the keyboard). `role`/`preferredRange` steer pvp-ai.ts. */
export interface CombatantAi {
  role: 'melee' | 'ranged' | 'healer' | 'tank';
  /** Preferred standoff distance for ranged/healer kits; melee ignores it. */
  preferredRange: number;
  control: ActorControl;
  /** Focus-fire override: a hostile id the AI keeps until it dies. */
  focusId?: number;
  /** Sim time of the next allowed target re-evaluation (target stickiness). */
  retargetAt: number;
}

/**
 * A PvP combatant is a full Player-shaped actor (character sheet, derived stats,
 * skills, resource, buffs) that ALSO satisfies the Enemy interface structurally:
 * the skill engine, projectiles, ground effects and combat-status functions can
 * target it through the existing `Enemy` surface. Fields below are the Enemy
 * members a Player lacks; `kind`/`rank`/`biome` are inert placeholders that keep
 * enemy-side helpers (enemyThreat, isBossKind, tameableFamily) harmless.
 */
export interface Combatant extends Player {
  team: PvpTeam;
  ai: CombatantAi;
  // ── Enemy targeting/status surface ──
  id: number;
  kind: EnemyKind;
  rank: EnemyRank;
  biome: BiomeId;
  lootSeed: number;
  damage: number;
  xpReward: number;
  state: EnemyState;
  stateTime: number;
  stateDuration: number;
  attackAngle: number;
  attackTargetX: number;
  attackTargetY: number;
  homeX: number;
  homeY: number;
  awareness: number;
  lostSightTime: number;
  lastSeenX: number;
  lastSeenY: number;
  senseTime: number;
  seesPlayer: boolean;
  patrolPhase: number;
  knockbackX: number;
  knockbackY: number;
  stagger: number;
  attackHit: boolean;
  interrupted: boolean;
  slowTime: number;
  slowFactor: number;
  burnTime: number;
  burnDps: number;
  burnTick: number;
  statusDurations?: Enemy['statusDurations'];
  freezeTime?: number;
  stunTime?: number;
  chillTime?: number;
  fractureTime?: number;
  reactionCooldown?: number;
  controlImmunity?: number;
  ccDiminished?: Partial<Record<CcKind, number>>;
  ccDiminishedUntil?: Partial<Record<CcKind, number>>;
  sundered?: { fraction: number; remaining: number };
  taunted?: { remaining: number; allyId?: number };
}

/** True for Player-shaped actors carrying a PvP team (never for world mobs). */
export function isCombatant(actor: Player | Enemy): actor is Combatant {
  return (actor as Combatant).team !== undefined;
}

/** Combatant placeholder kind: non-beast, non-boss, so enemy-side helpers stay inert. */
const COMBATANT_KIND: EnemyKind = 'caster';
const COMBATANT_BIOME: BiomeId = 'deadwood';

/** Infers a default AI role from the equipped weapon. Roster roles steer
 * explicitly (pvp-instance maps heal/tank); a damage-dealing priest must fight
 * at range, not triage — no class hard-codes a role here. */
function inferRole(player: Player): CombatantAi['role'] {
  return player.equipment.mainHand.attackKind === 'melee' ? 'melee' : 'ranged';
}

/** Compile-time proof that a Combatant can stand in for an Enemy target. */
export type AssertCombatantIsEnemy = Combatant extends Enemy ? true : never;
export const assertCombatantIsEnemy: AssertCombatantIsEnemy = true;

/**
 * Augments a Player in place into a Combatant: assigns the entity id, team and AI
 * state, and materializes the Enemy-shaped targeting/status surface. The same
 * object stays usable as a Player everywhere (it IS the player for combatant[0]).
 */
export function asCombatant(player: Player, id: number, team: PvpTeam, options: { role?: CombatantAi['role']; preferredRange?: number } = {}): Combatant {
  const combatant = player as Combatant;
  combatant.id = id;
  combatant.team = team;
  combatant.kind = COMBATANT_KIND;
  combatant.rank = 'normal';
  combatant.biome = COMBATANT_BIOME;
  combatant.lootSeed = 0;
  combatant.damage = 0;
  combatant.xpReward = 0;
  combatant.state = combatant.dead ? 'dead' : 'chase';
  combatant.stateTime = 0;
  combatant.stateDuration = 0;
  combatant.attackAngle = 0;
  combatant.attackTargetX = player.x;
  combatant.attackTargetY = player.y;
  combatant.homeX = player.x;
  combatant.homeY = player.y;
  combatant.awareness = 1;
  combatant.lostSightTime = 0;
  combatant.lastSeenX = player.x;
  combatant.lastSeenY = player.y;
  combatant.senseTime = 0;
  combatant.seesPlayer = true;
  combatant.patrolPhase = 0;
  combatant.knockbackX = 0;
  combatant.knockbackY = 0;
  combatant.stagger = 0;
  combatant.attackHit = false;
  combatant.interrupted = false;
  combatant.slowTime = 0;
  combatant.slowFactor = 1;
  combatant.burnTime = 0;
  combatant.burnDps = 0;
  combatant.burnTick = 0;
  const role = options.role ?? inferRole(player);
  const reach = deriveAttackStats(player.stats, player.equipment.mainHand).range;
  combatant.ai = {
    role,
    preferredRange: options.preferredRange ?? (role === 'melee' || role === 'tank' ? Math.max(30, reach) : 220),
    control: freshActorControl(),
    retargetAt: 0,
  };
  return combatant;
}

/** Strips the combatant surface off a Player leaving a PvP match. */
export function releaseCombatant(player: Player): void {
  const combatant = player as Partial<Combatant>;
  delete combatant.id; delete combatant.team; delete combatant.ai;
  delete combatant.kind; delete combatant.rank; delete combatant.biome;
  delete combatant.lootSeed; delete combatant.damage; delete combatant.xpReward;
  delete combatant.state; delete combatant.stateTime; delete combatant.stateDuration;
  delete combatant.attackAngle; delete combatant.attackTargetX; delete combatant.attackTargetY;
  delete combatant.homeX; delete combatant.homeY; delete combatant.awareness;
  delete combatant.lostSightTime; delete combatant.lastSeenX; delete combatant.lastSeenY;
  delete combatant.senseTime; delete combatant.seesPlayer; delete combatant.patrolPhase;
  delete combatant.knockbackX; delete combatant.knockbackY; delete combatant.stagger;
  delete combatant.attackHit; delete combatant.interrupted;
  delete combatant.slowTime; delete combatant.slowFactor;
  delete combatant.burnTime; delete combatant.burnDps; delete combatant.burnTick;
  delete combatant.statusDurations; delete combatant.freezeTime; delete combatant.stunTime;
  delete combatant.chillTime; delete combatant.fractureTime; delete combatant.reactionCooldown;
  delete combatant.controlImmunity; delete combatant.ccDiminished; delete combatant.ccDiminishedUntil;
  delete combatant.sundered; delete combatant.taunted; delete combatant.dots;
}

/** The match roster; the real player is always combatant[0] on team 'A'. */
export function combatants(sim: { pvpCombatants: Combatant[] | null }): readonly Combatant[] {
  return sim.pvpCombatants ?? [];
}

/** Living combatants on the opposing team (corpses are excluded). */
export function hostiles(of: Combatant, sim: { pvpCombatants: Combatant[] | null }): Combatant[] {
  return (sim.pvpCombatants ?? []).filter(other => other.team !== of.team && !other.dead);
}

/** Living teammates excluding the combatant itself. */
export function allies(of: Combatant, sim: { pvpCombatants: Combatant[] | null }): Combatant[] {
  return (sim.pvpCombatants ?? []).filter(other => other !== of && other.team === of.team && !other.dead);
}

export function aliveCombatants(list: readonly Combatant[]): Combatant[] {
  return list.filter(combatant => !combatant.dead);
}
