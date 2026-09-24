import { advanceChains, type ChainFlight } from './chain-lightning.ts';
import { RiftTactics } from './rift-tactics.ts';
import { EnemyNeighbors } from './enemy-neighbors.ts';
import { applyEnemyModifiers } from './enemy-modifiers.ts';
import { tickRift, riftKill } from './rift-runtime.ts';
import { advanceAuras, auraPower, manaCapacity } from './auras.ts';
import { resolvePlayerSkill } from './glyph-state.ts';
import { hasUnique, UNIQUE_RULES } from './unique-content.ts';
import { releaseStoredEmbers, hurtDecoy, consumeBastion } from './unique-combat.ts';
import { manaVialAmount, manaVialRestoration } from './mana-content.ts';
import { roamingEscortRole, roamingFormationRadius, roamingMemberOffset, roamingMemberRank } from './roaming-encounters.ts';
import { packSpaceProblem } from './inventory-grid.ts';
import type { DamageType } from './model.ts';
import { GroundItemPickup } from './ground-item-pickup.ts';
import { updateWildernessBoss } from './wilderness-boss.ts';
import { completeBossLair } from './wilderness-boss-rewards.ts';
import { isWildernessBoss } from './wilderness-boss-content.ts';
import { freshChronicle, metric, syncRiftChronicle } from './chronicle.ts';
import { trackChronicleEvent } from './chronicle-tracking.ts';
import { TREASURE_FLIGHT_DURATION } from './treasure-flight.ts';
import { advanceSkillEffects, consumeRally, snapshotSkillOffense, queueSkillEcho, advanceWowBuffs, resourceModelOf, refreshBuffStats, restoreFormResource } from './player-skill-effects.ts';
import { advanceAffixBuffs, consumeSpellweave } from './affix-combat.ts';
import { alternatesBasicAttacks, basicAttackWeapon } from './equipment.ts';
import { canUseSkill, skillWeapon, SKILL_DEFINITIONS } from './skill-content.ts';
import { weaponImpactStyle } from './elemental-weapon.ts';
import { breakContainer, strikeContainers, strikeContainerSegment, type ContainerAttackContext } from './breakable-containers.ts';
import { enemyInCombatViewport, type CombatViewport } from './combat-visibility.ts';
import { stageJourneyCompletion, journeyWasCompleted, type JourneyCompletion } from './journey-rewards.ts';
import { EnemyEngagements } from './enemy-engagement.ts';
import type { JourneyGoal } from './journey-state.ts';
import { cloneData } from './data-clone.ts';
import { freshJourneys } from './journey-state.ts';
import { freshExpeditions, currentDungeon, syncDungeon, storedActor, type Expeditions, type LocationContents, type StoredActor } from './dungeon-state.ts';
import { dungeonFromState, updateDungeon } from './dungeon-runtime.ts';
import type { DungeonFloor } from './dungeon.ts';
import { updateWarden } from './dungeon-boss.ts';
import { updateWarbands } from './warband.ts';
import { interruptTrial, freshEvents, syncTrial, EVENT_RULES } from './poi-content.ts';
import { EventChannel, advanceTrial } from './poi-runtime.ts';
import { GROUND_EFFECT_RULES, SKILL_EXECUTION } from './skill-execution-content.ts';
import { freshTravel, PortalChannel, PORTAL_RULES } from './travel.ts';
import { advanceTransport, type TransportArrival, type TransportRide } from './transport.ts';
import { advanceGold, dropGold, type GroundGold } from './gold.ts';
import { advanceGroundLoot } from './ground-loot.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { Attack, CombatEvent, Enemy, EnemyKind, Input, Player, Projectile, ProjectileStyle, ProjectileEffects, GroundEffect, SimulationOptions, WorldQuery, Ally, WowBuff, EnemyDot, EnemyCc } from './model.ts';
import type { Pickup } from './model.ts';
import { createBaseStats, createStartingEquipment, deriveAttackStats, basicAttackManaCost, basicProjectileStyle } from './equipment.ts';
import { getActiveSwingOffset } from './attack-motion.ts';
import { RANGED_BASIC_ATTACK_PHASES, BASIC_ATTACK_PHASES, COMBAT_TIMING, SKILL_CAST_MOTION, ENEMY_DEFINITIONS, LOOT_RULES, PLAYER_ABILITIES,
  PLAYER_DEFAULTS, PLAYER_MOVEMENT, type ProjectileDefinition } from './combat-content.ts';
import { applySpawnTraits, TREASURE_GOBLIN } from './combat-content.ts';
import { chooseEncounterEnemy, ENCOUNTER_RULES } from './encounter-director.ts';
import { zoneAt } from './world-atlas.ts';
import { ZONE_CONTENT, type SpawnEntry } from './zone-content.ts';
import { circleIntersectsSector, segmentDistanceSquared, hasLineOfSight } from './combat-geometry.ts';
import { refreshCharacter } from './character.ts';
import { createCharacterSheet, TIER_COLORS } from './items.ts';
import { damageEnemy, damageCombatant } from './combat-damage.ts';
import { addInventoryItem } from './inventory.ts';
import { deriveCharacterStats } from './character-stats.ts';
import { tryProc, tryTriggerProc, tryDefensiveProc, type ProcContext } from './legendary-combat.ts';
import { awardKillRewards } from './combat-rewards.ts';
import { advanceEnemyStatuses, applyDot as applyDotStatus, applyCc as applyCcStatus, applySunder as applySunderStatus, applyStun, applySlow } from './combat-status.ts';
import { recordHealThreat, tauntThreat } from './enemy-threat.ts';
import type { HitSnapshot } from './model.ts';
import { scheduleGroundEffect, advanceGroundEffects, type ActiveGroundEffect } from './ground-effects.ts';
import { activateSkill, schoolProjectileStyle, type SkillContext } from './skill-combat.ts';
import { advanceProjectiles, MAX_PROJECTILES } from './projectile-combat.ts';
import type { GroundItem, SkillId } from './character-types.ts';
import type { EnemyRank } from './progression-content.ts';
import { encounterScaleAt, encounterMemberLevel, isBossKind, type EncounterScale } from './encounter-scaling.ts';
import { awardHeroicBossEmblems } from './heroic-content.ts';
import { enemyLootSeed, scaledEnemyStats } from './zone-progression.ts';
import { CampPopulation, CAMP_POPULATION_RULES, type CampSpawnSource, type CampState } from './camp-population.ts';
import { sampleBiome } from './biomes.ts';
import { RoamingEncounters, ROAMING_RULES, ROAMING_GROUPS, roamingSpawnAnchor, shouldRetireRoamer } from './roaming-encounters.ts';
import { enemyDisplayName } from './zone-roster.ts';
import { isSpawnHidden, type SpawnExclusion } from './spawn-visibility.ts';
import { updateEnemyAI, type EnemyAIContext } from './enemy-ai.ts';
import { playerCanAttack } from './factions.ts';
import { TAB_TARGETING, WOW_COMBAT, isWowRaceId } from './wow-types.ts';
import type { AllyKind, BuffSpec, CcKind, DotSpec, RuneKind } from './wow-types.ts';
import { WOW_CLASSES, wowClassOf } from './wow-classes.ts';
import { ALLY_TEMPLATES } from './wow-allies.ts';
import { WOW_RACES } from './wow-races.ts';
import { RACIAL_SLOT } from './action-bar.ts';
import { GAME_FEATURES } from './game-features.ts';
import { mountSpeedFactor, cancelSummonCast } from './mount-state.ts';
import { advanceMount, mountOnOffense, mountOnDamage } from './mount-command.ts';
import { HearthstoneChannel } from './hearthstone.ts';
import { restedAccrual } from './rested.ts';
import { durabilityLoss } from './durability.ts';
import { NET_SNAPSHOT_HZ } from './net-protocol.ts';
import { questOnKill, questOnCollect, questExploreScan, type QuestWorld } from './quest-command.ts';
import { advanceGatherChannel, cancelGatherChannel } from './gather-node.ts';
import { isRaidBoss } from './raid-boss-content.ts';
import { updateRaidBoss } from './raid-boss.ts';
import { updateRaid2Boss } from './raid2-boss.ts';
import { isRaid2Boss } from './raid2-boss-content.ts';
import { repOnKill, repOnDungeonClear } from './reputation-command.ts';
import { updateRaid3Boss } from './raid3-boss.ts';
import { isRaid3Boss } from './raid3-boss-content.ts';
import { updateRaid4Boss } from './raid4-boss.ts';
import { isRaid4Boss } from './raid4-boss-content.ts';
import { updateRaid5Boss } from './raid5-boss.ts';
import { isRaid5Boss } from './raid5-boss-content.ts';
import { updateRaid6Boss } from './raid6-boss.ts';
import { isRaid6Boss } from './raid6-boss-content.ts';
import { updateRaid7Boss } from './raid7-boss.ts';
import { isRaid7Boss } from './raid7-boss-content.ts';
import { updateRaid8Boss } from './raid8-boss.ts';
import { isRaid8Boss } from './raid8-boss-content.ts';
import { updateRaid9Boss } from './raid9-boss.ts';
import { isRaid9Boss } from './raid9-boss-content.ts';
import { advanceWorldEvents, freshWorldEvents, recordWorldEventKill, worldEventTrialContext, type WorldEventState } from './world-event-state.ts';
import { DEMON_FAMILIES, PET_SKILLS, PET_RULES, adoptPet, adjustPetLoyalty, createPetRecord, demonFamilyForAlly, freshPetStable,
  petFamilyForAlly, petStatsFor, stableActivePet, tameableFamily, type PetRecord, type PetSkill } from './pet-content.ts';
import { worldEventOnKill } from './world-event-command.ts';
import { updateWorldBosses, updateWorldBoss, isWorldBossActor, worldBossOnKill } from './world-boss.ts';
import { freshWorldBossLedger, type WorldBossLedger } from './world-boss-state.ts';
import type { AchievementDef } from './achievement-content.ts';
import { freshHoliday, type HolidayState } from './holiday-state.ts';
import { GHOST_RULES, RESURRECTION_SICKNESS, type GhostState } from './death-content.ts';
import { guildReviveFactor } from './guild-state.ts';
import { asCombatant, releaseCombatant, isCombatant, freshActorControl, type Combatant, type PvpTeam, type ActorControl } from './pvp-combatant.ts';
import { decideCombatantInput } from './pvp-ai.ts';
import { advanceCombatantStatuses, combatantControl, sanitizeCombatantInput } from './pvp-status.ts';
import { projectileDamageType } from './resistance-content.ts';
import { PlayerMovement } from './player-movement.ts';

export const FIXED_STEP = COMBAT_TIMING.fixedStep;
export const HIT_FLASH_DURATION = COMBAT_TIMING.hitFlashDuration;
const TAU = Math.PI * 2;

/** Checkpoint extension carrying the WoW combat state (kept local so older saves stay valid). */
type WowCheckpoint = CharacterCheckpoint & {
  allies?: Ally[]; buffs?: WowBuff[]; comboPoints?: number; runes?: number[]; petCommand?: Player['petCommand'];
  soulShards?: number; stealthed?: boolean; autoAttack?: boolean;
  actors?: Array<StoredActor & { dots?: EnemyDot[]; cc?: EnemyCc[]; sundered?: Enemy['sundered']; taunted?: Enemy['taunted'] }>;
  worldEvents?: WorldEventState;
  worldBosses?: WorldBossLedger;
  holiday?: HolidayState;
  mounted?: Player['mounted']; restedXp?: number; hearthstone?: Player['hearthstone'];
  professions?: Player['professions']; quests?: Player['quests']; achievements?: Player['achievements'];
  glyphs?: Player['glyphs']; fishing?: Player['fishing']; durability?: Player['durability']; combatLog?: Player['combatLog'];
  reputation?: Player['reputation'];
};

/** Flared on-screen cone half-angle: tight up close, widening toward the near radius. */
function tabConeHalfAt(d: number): number {
  const t = TAB_TARGETING.nearRadius > 0 ? Math.min(1, Math.max(0, d / TAB_TARGETING.nearRadius)) : 1;
  return TAB_TARGETING.coneHalfNear + (TAB_TARGETING.coneHalfFar - TAB_TARGETING.coneHalfNear) * t;
}

/** Recipe kinds that count as offensive: they arm auto-attack and break stealth. */
const OFFENSIVE_EXECUTION: Record<string, true> = { sweep: true, dash: true, radial: true, cone: true, backstab: true, projectile: true,
  ground: true, chain: true, strike: true, dot: true, cc: true, interrupt: true, pull: true, taunt: true, channel: true, comboStrike: true, runeStrike: true };


/** Weighted pick from a zone's authored spawn table; `preferred` wins when the
 * table lists it (pack recipes keep their escort composition). */
function pickSpawnEntry(table: readonly SpawnEntry[], roll: number, preferred?: EnemyKind): SpawnEntry {
  if (preferred && table.some(e => e.kind === preferred)) return table.find(e => e.kind === preferred)!;
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let choice = Math.max(0, Math.min(1 - Number.EPSILON, roll)) * total;
  for (const entry of table) { if (choice < entry.weight) return entry; choice -= entry.weight; }
  return table[table.length - 1];
}
const ALLY_OFFENSE: HitSnapshot = Object.freeze({ critChance: 0, critMultiplier: 1, lifeOnHit: 0, directDamageMultiplier: 1, hitRating: 0, expertise: 0, ally: true });
/** Reflected damage is a proc-sourced hit: it never crits, procs, or reflects again. */
const REFLECT_OFFENSE: HitSnapshot = Object.freeze({ critChance: 0, critMultiplier: 1, lifeOnHit: 0, proc: true });

export function initialPlayer(x: number, y: number): Player {
  const character = createCharacterSheet();
  return {
    chronicle:freshChronicle(), character, derived: deriveCharacterStats(character), skillCooldowns: {}, activeSkill: null,
    nextAttackHand: 'main', guardTime: 0, guardReduction: .75, dash: null,
    x, y, prevX: x, prevY: y, vx: 0, vy: 0, locomotionVX: 0, locomotionVY: 0, angle: 0,
    hp: PLAYER_DEFAULTS.maxHp, maxHp: PLAYER_DEFAULTS.maxHp, mana: PLAYER_DEFAULTS.maxMana, maxMana: PLAYER_DEFAULTS.maxMana,
    level: 1, xp: 0,
    stats: createBaseStats(), equipment: createStartingEquipment(),
    attack: null, dodgeTime: 0, dodgeAngle: 0, dodgeCharges: PLAYER_ABILITIES.dodge.charges, dodgeRecharge: 0,
    invulnerable: 0, flasks: PLAYER_ABILITIES.potion.charges, healCooldown: 0, castTime: 0, castDuration: 0,
    castAngle: 0, healFlash: 0, hitFlash: 0, hitAngle: 0, walkTime: 0, radius: PLAYER_DEFAULTS.radius, dead: false,
    targetId: null, autoAttack: false, gcdReady: 0, cast: null, comboPoints: 0,
    runes: [0, 0, 0, 0, 0, 0], soulShards: 3, stealthed: false, buffs: [], allies: [],
  };
}


/** A neutral input frame for a co-op partner with no connected device.
 * `targetId` stays absent — null would clear the partner's target every frame. */
function emptyInput(): Input {
  return { moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
}

export class Simulation {
  player: Player;
  /** Every controlled player in the shared world: [P1] solo, [P1, P2] in co-op.
   * Canonical objects — never the rebound `this.player` alias mid-turn. */
  get players(): readonly Player[] {
    // A net client renders remote peers as puppets alongside its own player.
    return this.netMode === 'client' ? [this.player, ...this.netPeers] : this.coopPlayers;
  }
  /** True while a second local player shares the world. */
  get coop(): boolean { return this.coopRoster !== null && this.coopRoster.length > 1; }
  /** Canonical roster backing `players`: [P1] solo, [P1, P2] in co-op. Rebuilt
   * wherever the primary player object is canonically assigned — never by the
   * withActor alias swap. */
  private coopPlayers: Player[] = [];
  journeys = freshJourneys();
  eventState = freshEvents();
  readonly eventChannel = new EventChannel();
  private eventTimer = 0;
  get nextEntityIdentity() { return this.nextId; }
  commitEventCheckpoint(saved: CharacterCheckpoint, xp: number, levels: number, completion: JourneyCompletion | null = null): void {
    this.expeditions = saved.expeditions ?? freshExpeditions(); this.dungeonFloor = dungeonFromState(this);
    this.eventState = saved.events!;
    this.groundItems = saved.groundItems ?? []; this.groundGold = saved.groundGold ?? [];
    this.nextId = Math.max(this.nextId, ...this.groundItems.map(i => i.id + 1), ...this.groundGold.map(i => i.id + 1));
    this.commitJourneyCheckpoint(saved,completion,xp,levels);
  }
  commitJourneyCheckpoint(saved: CharacterCheckpoint, completion: JourneyCompletion | null, xp = completion?.xp ?? 0, levels = saved.level-this.player.level): void {
    this.player.chronicle=saved.chronicle;
    this.journeys=saved.journeys??freshJourneys();this.player.character=saved.character;this.player.level=saved.level;this.player.xp=saved.xp;
    refreshCharacter(this.player);
    if(completion)this.events.push({type:'journey',x:this.player.x,y:this.player.y,...completion});
    if (xp) this.events.push({ type: 'experience', x: this.player.x, y: this.player.y, amount: xp });
    if (levels) this.events.push({ type: 'level', x: this.player.x, y: this.player.y, level: this.player.level, skillPoints: levels, statPoints: levels * 5, color: '#c0acf0' });
  }
  /** Arrival rewards follow combat's atomic XP + ledger checkpoint model. No input interruption. */
  completeJourneyArrival(goal: JourneyGoal): boolean {
    if(this.player.dead||this.ghost||this.expeditions.location||!['town','frontier'].includes(goal.kind)||journeyWasCompleted(this.journeys,goal.id)
      ||Math.hypot(goal.x-this.player.x,goal.y-this.player.y)>=(goal.kind==='town'?260:180))return false;
    const saved=this.captureCheckpoint(), completion=stageJourneyCompletion(saved,goal,this.player,this.time);
    if(!completion)return false;
    this.commitJourneyCheckpoint(saved,completion);return true;
  }
  readonly hearthstone = new HearthstoneChannel();
  travel = freshTravel();
  readonly portal = new PortalChannel();
  /** Live transport ride (ship/zeppelin/taxi); not persisted — a reload lands at the dock. */
  transportRide: TransportRide | null = null;
  /** Set while a ridden vehicle is docked at the destination; the host disembarks durably. */
  transportArrival: TransportArrival | null = null;
  private arrivalProtection = 0;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  groundItems: GroundItem[] = [];
  groundGold: GroundGold[] = [];
  readonly brokenContainers = new Set<string>();
  groundEffects: ActiveGroundEffect[] = [];
  chains: ChainFlight[] = [];
  /** Online co-op (wayfinder/T03): 'host' runs the authoritative sim and emits
   * snapshots; 'client' is a render puppet whose entity arrays are overwritten
   * from host snapshots and whose update() only interpolates. */
  netMode: 'host' | 'client' | null = null;
  /** Client-side remote player puppets (excludes the client's own player). */
  netPeers: Player[] = [];
  readonly groundPickup = new GroundItemPickup();
  private skillBuffer: { slot: number; until: number; pressed?: boolean; reported?: boolean } | null = null;
  private blockedDrawSlot: number | null = null;
  time = 0;
  kills = 0;
  private questScanTimer = 0;
  world: WorldQuery;
  expeditions: Expeditions = freshExpeditions();
  dungeonFloor: DungeonFloor | null = null;
  worldEvents: WorldEventState = freshWorldEvents();
  worldBosses: WorldBossLedger = freshWorldBossLedger();
  holiday: HolidayState = freshHoliday();
  /** Achievement defs unlocked inside the sim (world bosses); game.ts drains to toasts. */
  pendingAchievements: AchievementDef[] = [];
  private options: SimulationOptions;
  private randomState = 1;
  private accumulator = 0;
  /** Client-mode snapshot interpolation clock: sweeps 0→1 across one snapshot
   * interval so puppets lerp between the previous and latest host positions. */
  private netAlpha = 1;
  private nextId = 1;
  private spawnOrdinal = 0;
  private events: CombatEvent[] = [];
  private engagements = new EnemyEngagements();
  private attackBuffer = -1;
  private dodgeBuffer = -1;
  private healBuffer = -1;
  private hurtGuard = 0;
  private roaming = new RoamingEncounters();
  private campTimer = 0;
  private camps = new CampPopulation();
  private combatViewport: CombatViewport | null = null;
  private spawnExclusion: SpawnExclusion | null = null;
  private killRecharge = 0;
  /** PvP match roster (arena/battleground); combatant[0] is the real player on team 'A'.
   * While set, the sim drives every combatant through the player pipeline and a
   * combatant death becomes a corpse instead of the defeat flow. */
  pvpCombatants: Combatant[] | null = null;
  /** The real player object while a PvP match runs (=== pvpCombatants[0]). */
  private pvpPlayer: Combatant | null = null;
  /** Couch co-op roster: canonical player objects plus each actor's control bag
   * and ground-pickup channel. Null in single-player; [P1, P2] while co-op runs.
   * `this.player` stays the mutable 'current actor' alias — it is rebound to the
   * actor whose turn is running, so it must never seed this roster. */
  private coopRoster: { player: Player; control: ActorControl; pickup: GroundItemPickup }[] | null = null;
  /** Hostile list for the combatant whose turn is currently running. */
  private turnHostiles: Enemy[] | null = null;
  /** Owning combatant per chain flight (ChainFlight has no source field). */
  private chainSources = new Map<ChainFlight, Player>();
  /** PvP match bookkeeping (T06): fired once per landed combatant hit with the
   * attacker, victim and hp actually removed. The match loop (pvp-match.ts) sets
   * it while a match is live; leavePvp clears it. Null outside matches. */
  pvpDamageSink: ((source: Player | undefined, target: Combatant, dealt: number) => void) | null = null;
  private combatUntil = 0;
  private resourceInitialized = false;
  private allySkillCooldowns = new Map<number, Map<string, number>>();
  /** Spirit-release state (WoW corpse run); the player stays alive-but-ghosted while set.
   * Stored per player so co-op ghosts are independent; `this.ghost` resolves the
   * current actor's (`this.player`) ghost — the primary's outside actor turns. */
  private ghosts = new Map<Player, GhostState>();
  get ghost(): GhostState | null { return this.ghosts.get(this.player) ?? null; }
  set ghost(value: GhostState | null) {
    if (value === null) this.ghosts.delete(this.player); else this.ghosts.set(this.player, value);
  }
  /** A specific roster member's ghost state (co-op death UI reads each player). */
  ghostOf(player: Player): GhostState | null { return this.ghosts.get(player) ?? null; }
  /** Release a specific roster member's spirit (co-op auto-release on death). */
  releaseSpiritFor(player: Player, healer: { x: number; y: number; name: string }): boolean {
    return this.forPlayer(player, () => this.releaseSpirit(healer));
  }
  /** Resurrect a specific roster member's ghost at corpse or healer. */
  resurrectFor(player: Player, mode: 'corpse' | 'healer'): boolean {
    return this.forPlayer(player, () => mode === 'corpse' ? this.resurrectAtCorpse() : this.resurrectAtHealer());
  }
  /** Which resurrection a specific player's ghost is in reach of. */
  ghostPromptFor(player: Player): 'corpse' | 'healer' | null {
    return this.forPlayer(player, () => this.ghostPrompt());
  }
  private playerMovement = new PlayerMovement();

  constructor(world: WorldQuery, options: SimulationOptions = {}) {
    this.world = world;
    this.options = { seed: 74319, spawn: true, ...(world.spawnPoint ? { startX: world.spawnPoint.x, startY: world.spawnPoint.y } : { startX: 0, startY: 0 }), ...options };
    this.player = initialPlayer(this.options.startX!, this.options.startY!);
    this.reset();
  }

  reset(): void {
    this.worldEvents = freshWorldEvents();
    this.worldBosses = freshWorldBossLedger();
    this.holiday = freshHoliday();
    this.playerMovement.clear();
    this.brokenContainers.clear(); this.world.setBrokenContainers?.(this.brokenContainers);
    this.journeys = freshJourneys();
    this.hearthstone.cancel(); cancelSummonCast(this); cancelGatherChannel(this);
    this.expeditions = freshExpeditions(); this.dungeonFloor = null;
    this.eventState = freshEvents(); this.eventChannel.cancel(); this.eventTimer = 0;
    this.worldEvents = freshWorldEvents();
    this.travel = freshTravel(); this.portal.cancel(); this.hearthstone.cancel(); this.arrivalProtection = 0;
    this.transportRide = null; this.transportArrival = null;
    this.player = initialPlayer(this.options.startX!, this.options.startY!);
    this.coopRoster = null; this.coopPlayers = [this.player];
    this.enemies = [];
    this.projectiles = [];
    this.groundEffects = []; this.chains = [];
    this.pickups = [];
    this.groundItems = []; this.groundGold = []; this.groundPickup.cancel(); this.skillBuffer = null; this.blockedDrawSlot = null;
    refreshCharacter(this.player);
    this.time = 0;
    this.kills = 0;
    this.accumulator = 0;
    this.nextId = 1;
    this.spawnOrdinal = 0; this.camps.reset(); this.campTimer = 0;
    this.events = []; this.engagements.reset();
    this.randomState = this.options.seed! >>> 0;
    this.attackBuffer = this.dodgeBuffer = this.healBuffer = -1;
    this.hurtGuard = this.killRecharge = 0;
    this.allySkillCooldowns.clear();
    this.pvpCombatants = null; this.pvpPlayer = null; this.turnHostiles = null;
    this.chainSources.clear();
    this.ghosts.clear();
    this.spawnExclusion = null; this.combatViewport = null;
    this.roaming.reset(this.player.x, this.player.y);
  }

  encounterScale(id: string) { return this.camps.scaleFor(id); }
  reserveIdentity(next:number):void { this.nextId=Math.max(this.nextId,next); }
  captureContents(): LocationContents {
      return cloneData({ encounterScales: this.camps.captureScales(), campWounds: this.camps.captureWounds(this.enemies), actors: this.enemies.filter(e => e.hp > 0).map(storedActor), groundItems: this.groundItems, groundGold: this.groundGold, pickups: this.pickups, clearedCamps: this.camps.clearedIds(), defeatedCampMembers: this.camps.defeatedMembers() });
  }
  /** Snapshot the checkpoint. The default deep clone protects staged-mutation
   * callers (restore paths mutate the payload); `clone: false` returns live
   * references for callers that only serialize it immediately. */
  captureCheckpoint(options?: { clone?: boolean }): WowCheckpoint {
    const p = this.player;
    const run = currentDungeon(this.expeditions); if (run) syncDungeon(run,this.enemies,p.x,p.y);
    syncTrial(this.eventState, this.enemies);
    const snapshot = { chronicle:p.chronicle, brokenContainers: [...this.brokenContainers], journeys:this.journeys, encounterScales:this.camps.captureScales(), campWounds:this.camps.captureWounds(this.enemies), roaming:this.roaming.capture(), expeditions: this.expeditions, actors: this.enemies.filter(e=>e.hp>0).map(e=>Object.assign(storedActor(e),{dots:e.dots,cc:e.cc,sundered:e.sundered,taunted:e.taunted})), pickups: this.pickups, events: this.eventState, travel: this.travel, character: p.character, level: p.level, xp: p.xp,
      x: p.x, y: p.y, angle: p.angle, hp: p.hp, mana: p.mana, dead: p.dead || this.ghost !== null,
      flasks: p.flasks, healCooldown: p.healCooldown, dodgeCharges: p.dodgeCharges, dodgeRecharge: p.dodgeRecharge,
      skillCooldowns: p.skillCooldowns, time: this.time, kills: this.kills,
      mounted: p.mounted, restedXp: p.restedXp, hearthstone: p.hearthstone, professions: p.professions,
      worldEvents: this.worldEvents, worldBosses: this.worldBosses, holiday: this.holiday,
      quests: p.quests, achievements: p.achievements, glyphs: p.glyphs, fishing: p.fishing,
      reputation: p.reputation,
      randomState: this.randomState, spawnOrdinal: this.spawnOrdinal, killRecharge: this.killRecharge,
      allies: p.allies, buffs: p.buffs, comboPoints: p.comboPoints, runes: p.runes, soulShards: p.soulShards, petCommand: p.petCommand,
      stealthed: p.stealthed, autoAttack: p.autoAttack,
      clearedCamps: this.camps.clearedIds(), defeatedCampMembers: this.camps.defeatedMembers(), groundItems: this.groundItems, groundGold: this.groundGold };
    const checkpoint = (options?.clone === false ? snapshot : cloneData(snapshot)) as CharacterCheckpoint;
    // Optional WoW fields stay absent (not undefined) so the in-memory checkpoint
    // matches its persisted JSON form byte-for-byte.
    for (const key of Object.keys(checkpoint) as (keyof CharacterCheckpoint)[]) if (checkpoint[key] === undefined) delete checkpoint[key];
    return checkpoint;
  }

  /** Apply only a decoded checkpoint. Active encounters/attacks restart; character progress does not. */
  restoreCheckpoint(checkpoint: CharacterCheckpoint): void {
    // A co-op partner survives a checkpoint restore (dungeon entry, travel):
    // reset() clears the roster, so capture and re-seat them beside the primary.
    const partner = this.coopRoster?.[1]?.player ?? null;
    this.reset();
    const saved = cloneData(checkpoint) as WowCheckpoint;
    for (const id of saved.brokenContainers ?? []) this.brokenContainers.add(id);
    this.worldEvents = saved.worldEvents ?? freshWorldEvents();
    this.worldBosses = saved.worldBosses ?? freshWorldBossLedger();
    this.holiday = saved.holiday ?? freshHoliday();
    this.expeditions = saved.expeditions ?? freshExpeditions(); this.dungeonFloor = dungeonFromState(this);
    this.journeys = saved.journeys ?? freshJourneys();
    this.player.chronicle = saved.chronicle ?? freshChronicle();
    syncRiftChronicle(this.player.chronicle,this.expeditions.rifts);
    this.eventState = saved.events ?? freshEvents();
    this.travel = saved.travel ?? freshTravel();
    if (saved.dead) this.travel.returnTo = null;
    const p = this.player;
    Object.assign(p, { character: saved.character, level: saved.level, xp: saved.xp,
      x: saved.x, y: saved.y, angle: saved.angle, hp: saved.hp, mana: saved.mana, dead: saved.dead,
      flasks: saved.flasks, healCooldown: saved.healCooldown, dodgeCharges: saved.dodgeCharges,
      dodgeRecharge: saved.dodgeRecharge, skillCooldowns: saved.skillCooldowns,
      mounted: saved.mounted, restedXp: saved.restedXp, hearthstone: saved.hearthstone,
      professions: saved.professions, quests: saved.quests, achievements: saved.achievements,
      glyphs: saved.glyphs, fishing: saved.fishing, durability: saved.durability, combatLog: saved.combatLog,
      reputation: saved.reputation,
      allies: (saved.allies ?? []).map(ally => ({ ...ally, targetId: null })), buffs: saved.buffs ?? [], comboPoints: 0,
      runes: saved.runes ?? [0, 0, 0, 0, 0, 0], soulShards: saved.soulShards ?? 3,
      autoAttack: saved.autoAttack ?? false, stealthed: saved.stealthed ?? false, petCommand: saved.petCommand });
    p.targetId = null; p.cast = null; p.gcdReady = 0;
    // Persisted pet/ally records hold entity ids; reserve them before syncPetAlly summons.
    this.reserveIdentity(Math.max(1, ...(saved.allies ?? []).map(ally => ally.id + 1),
      ...(saved.character.pets ? [saved.character.pets.active, ...saved.character.pets.stabled].map(pet => (pet?.id ?? 0) + 1) : [])));
    this.syncPetAlly();
    this.resourceInitialized = true;
    refreshCharacter(p);
    refreshBuffStats(p);
    if (this.world.blocked(p.x, p.y, p.radius)) {
      let found = false;
      for (let r = 24; r <= 240 && !found; r += 24) for (let i = 0; i < 16 && !found; i++) {
        const x = saved.x + Math.cos(i * Math.PI / 8) * r, y = saved.y + Math.sin(i * Math.PI / 8) * r;
        if (!this.world.blocked(x, y, p.radius)) { p.x = x; p.y = y; found = true; }
      }
      if (!found) { p.x = this.options.startX!; p.y = this.options.startY!; }
    }
    p.prevX = p.x; p.prevY = p.y;
    this.time = saved.time; this.kills = saved.kills;
    this.randomState = saved.randomState; this.spawnOrdinal = saved.spawnOrdinal; this.killRecharge = saved.killRecharge;
    this.camps.restoreCleared(saved.clearedCamps); this.camps.restoreDefeated(saved.defeatedCampMembers); this.groundItems = saved.groundItems;
    this.groundGold = saved.groundGold ?? [];
    this.nextId = Math.max(1, ...saved.groundItems.map(item => item.id + 1), ...this.groundGold.map(pile => pile.id + 1), ...(saved.pickups??[]).map(p=>p.id+1),
      ...(p.allies ?? []).map(ally => ally.id + 1),
      ...(saved.character.pets ? [saved.character.pets.active, ...saved.character.pets.stabled].map(pet => (pet?.id ?? 0) + 1) : []));
    this.camps.restoreScales(saved.encounterScales);
    for (const actor of saved.actors ?? []) {
      const enemy=this.spawnEnemy(actor.kind,actor.x,actor.y,actor.rank, actor.campId ? {campId:actor.campId,memberId:actor.memberId!,lootSeed:actor.seed,...(actor.faction?{faction:actor.faction}:{})} : undefined);
      if(enemy){Object.assign(enemy,applyEnemyModifiers(scaledEnemyStats(actor.kind,actor.level,actor.rank),{kind:actor.kind,rank:actor.rank,lootSeed:actor.seed,rift:actor.rift,heroic:this.expeditions.runs.find(r=>r.entrance.id===actor.campId)?.entrance.scaling?.heroic===true}),{rift:actor.rift,faction:actor.faction,level:actor.level,biome:actor.biome,lootSeed:actor.seed,hp:actor.hp,homeX:actor.homeX,homeY:actor.homeY,bossPhases:actor.bossPhases,state:'idle',stateDuration:1});
        if(actor.dots?.length)enemy.dots=actor.dots;if(actor.cc?.length)enemy.cc=actor.cc;if(actor.sundered)enemy.sundered=actor.sundered;if(actor.taunted)enemy.taunted=actor.taunted;
        applySpawnTraits(enemy);}
    }

    // Restored enemies hold fresh ids; a taunt aimed at a despawned ally reverts to the player.
    const liveAllyIds = new Set((p.allies ?? []).map(ally => ally.id));
    for (const enemy of this.enemies) if (enemy.taunted?.allyId !== undefined && !liveAllyIds.has(enemy.taunted.allyId)) delete enemy.taunted.allyId;
    this.camps.adopt(this.enemies); this.camps.restoreWounds(saved.campWounds??[]); this.pickups=saved.pickups??[];
    this.reserveIdentity(Math.max(1,...this.pickups.map(i=>i.id+1)));
    this.groundPickup.cancel();
    this.randomState=saved.randomState; this.spawnOrdinal=saved.spawnOrdinal;
    this.events=[];
    if(saved.roaming)this.roaming.restore(saved.roaming,p.x,p.y);else this.roaming.reset(p.x, p.y);
    // Re-seat the co-op partner beside the restored primary and rebuild the roster.
    if (partner) {
      partner.x = partner.prevX = p.x + 48; partner.y = partner.prevY = p.y;
      partner.attack = null; partner.dash = null; partner.cast = null; partner.castTime = partner.castDuration = 0;
      this.enterCoop(partner);
    }
  }
  revive(): void {
    this.ghost = null;
    const saved = this.captureCheckpoint();
    delete saved.character.blessing;
    if (saved.travel) saved.travel.returnTo = null;
    saved.x = this.options.startX!; saved.y = this.options.startY!; saved.dead = false;
    saved.hp = this.player.maxHp; saved.mana = this.player.maxMana;
    saved.flasks = PLAYER_ABILITIES.potion.charges; saved.healCooldown = 0;
    saved.dodgeCharges = PLAYER_ABILITIES.dodge.charges; saved.dodgeRecharge = 0; saved.skillCooldowns = {};
    saved.allies = []; saved.buffs = []; saved.comboPoints = 0; saved.stealthed = false; saved.autoAttack = false;
    this.restoreCheckpoint(saved);
    // A full-wipe revive brings the co-op partner back too, beside the primary.
    const partner = this.coopRoster?.[1]?.player;
    if (partner) {
      partner.dead = false; partner.hp = partner.maxHp; partner.mana = partner.maxMana;
      partner.buffs = []; partner.stealthed = false; partner.autoAttack = false; partner.targetId = null;
      partner.comboPoints = 0; partner.mounted = null; partner.hitFlash = 0; partner.invulnerable = 0;
      this.ghosts.delete(partner);
      partner.x = partner.prevX = this.player.x + 48; partner.y = partner.prevY = this.player.y;
    }
  }

  // ── Spirit release (WoW corpse run) ──────────────────────────────────

  /** Release Spirit: the fallen player becomes a ghost at the graveyard's spirit
   * healer while the corpse waits at the death spot. Overworld only — dungeon
   * deaths keep the classic defeat flow. */
  releaseSpirit(healer: { x: number; y: number; name: string }): boolean {
    const p = this.player;
    if (!p.dead || this.ghost || this.dungeonFloor || this.expeditions.location) return false;
    this.ghost = { corpse: { x: p.x, y: p.y }, healer };
    p.dead = false;
    p.hp = p.maxHp; p.mana = p.maxMana;
    p.buffs = []; p.stealthed = false; p.autoAttack = false; p.targetId = null;
    p.comboPoints = 0; p.mounted = null; p.hitFlash = 0;
    this.relocatePlayer(p, healer.x, healer.y);
    p.invulnerable = Math.max(p.invulnerable, 1e9);
    return true;
  }

  /** Which resurrection the ghost is in reach of; null while still running. */
  ghostPrompt(): 'corpse' | 'healer' | null {
    const ghost = this.ghost, p = this.player;
    if (!ghost) return null;
    if (Math.hypot(p.x - ghost.corpse.x, p.y - ghost.corpse.y) <= GHOST_RULES.corpseRadius) return 'corpse';
    if (Math.hypot(p.x - ghost.healer.x, p.y - ghost.healer.y) <= GHOST_RULES.healerRadius) return 'healer';
    return null;
  }

  /** Corpse resurrection: half life and mana, a short sickness, no extra wear. */
  resurrectAtCorpse(): boolean {
    if (this.ghostPrompt() !== 'corpse') return false;
    this.finishResurrection(GHOST_RULES.corpseHealth * guildReviveFactor(this.player), GHOST_RULES.corpseMana * guildReviveFactor(this.player), RESURRECTION_SICKNESS.corpse);
    this.emit({ type: 'notice', x: this.player.x, y: this.player.y, message: 'You return to your body.' });
    return true;
  }

  /** Spirit healer resurrection: weaker return, the WoW durability tax and a long sickness. */
  resurrectAtHealer(): boolean {
    if (this.ghostPrompt() !== 'healer') return false;
    this.finishResurrection(GHOST_RULES.healerHealth * guildReviveFactor(this.player), GHOST_RULES.healerMana * guildReviveFactor(this.player), RESURRECTION_SICKNESS.healer);
    durabilityLoss(this.player, 'death', this.time);
    this.emit({ type: 'notice', x: this.player.x, y: this.player.y, message: 'The spirit healer restores you — at a price.' });
    return true;
  }

  private finishResurrection(hpFraction: number, manaFraction: number, sickness: { duration: number; stats: { damagePercent: number; moveSpeedPercent: number } }): void {
    const p = this.player;
    this.ghost = null;
    p.dead = false; p.invulnerable = 0;
    p.hp = Math.max(1, Math.round(p.maxHp * hpFraction));
    p.mana = Math.round(p.maxMana * manaFraction);
    p.buffs = []; p.stealthed = false; p.autoAttack = false; p.targetId = null;
    p.comboPoints = 0; p.mounted = null; p.hitFlash = 0;
    this.clearInput();
    this.addBuff('Resurrection Sickness', '#9fb4d8', { duration: sickness.duration, stats: sickness.stats }, 'rez-sickness');
  }

  /** Travel preserves actors, loot, clocks and camp memory. It is not a reset/load. */
  relocate(x: number, y: number): void {
    this.playerMovement.clear();
    this.chains.length = 0;
    this.groundEffects = this.groundEffects.filter(effect => effect.kind !== 'storm');
    this.chains.length = 0;
    this.clearInput(); this.portal.cancel(); this.hearthstone.cancel();
    this.transportRide = null; this.transportArrival = null;
    // Co-op moves the whole party together; solo is a roster of one.
    const roster = this.coopRoster?.map(a => a.player) ?? [this.player];
    for (const [i, p] of roster.entries())
      this.relocatePlayer(p, x + (i === 0 ? 0 : Math.cos(i * 2.4) * 48), y + (i === 0 ? 0 : Math.sin(i * 2.4) * 48));
    this.arrivalProtection = PORTAL_RULES.protection;
    this.spawnExclusion = null; this.combatViewport = null; this.roaming.relocate(x, y);
  }

  /** Move a single player (spirit release, partner join) without the shared
   * world reset a party relocate performs. */
  private relocatePlayer(p: Player, x: number, y: number): void {
    p.x = p.prevX = x; p.y = p.prevY = y;
    p.skillEffects = undefined; p.attack = null; p.dash = null; p.activeSkill = null; p.castTime = p.castDuration = p.dodgeTime = 0; p.cast = null;
    p.invulnerable = Math.max(p.invulnerable, PORTAL_RULES.protection);
  }

  // ── PvP combatants (wayfinder/pvp-t01) ────────────────────────────────────

  /** Enter a PvP match: the real player becomes combatant[0] on team 'A' and the
   * given NPC players join as AI-driven combatants. While active, update() keeps
   * stepping after the player's death (corpse/spectator) and every combatant runs
   * the same input→fixed-step pipeline. */
  enterPvp(npcs: Player[], teams: PvpTeam[] = []): Combatant[] {
    const roster: Combatant[] = [asCombatant(this.player, this.nextId++, 'A')];
    npcs.forEach((npc, index) => roster.push(asCombatant(npc, this.nextId++, teams[index] ?? 'B')));
    this.pvpCombatants = roster;
    this.pvpPlayer = roster[0]!;
    return roster;
  }

  /** Leave the match: strips the combatant surface off the player and clears
   * in-flight sources so lingering projectiles/ground effects harm no one. */
  leavePvp(): void {
    if (!this.pvpCombatants) return;
    releaseCombatant(this.player);
    this.pvpCombatants = null; this.pvpPlayer = null; this.turnHostiles = null; this.pvpDamageSink = null;
    for (const shot of this.projectiles) delete shot.source;
    for (const effect of this.groundEffects) delete effect.source;
    this.chainSources.clear();
  }

  /** The combatant's own control bag; the real player's lives on the sim fields
   * outside a match, so its bag is only canonical while pvpCombatants is set. */
  private controlFor(actor: Player): ActorControl | null {
    return isCombatant(actor) ? actor.ai.control : null;
  }

  /** Hostile targets for one actor: opposing combatants plus world mobs. */
  private hostileTargets(actor: Player): Enemy[] {
    if (!this.pvpCombatants || !isCombatant(actor)) return this.enemies;
    const foes = this.pvpCombatants.filter(other => other.team !== actor.team);
    return this.enemies.length ? [...foes, ...this.enemies] : foes;
  }
  /** The target list the current actor's combat code reads. */
  private activeTargets(): Enemy[] {
    return this.turnHostiles ?? (this.pvpPlayer ? this.hostileTargets(this.pvpPlayer) : this.enemies);
  }


  /** Runs fn with the sim's per-actor state swapped to `actor`: player, turn
   * hostiles, input buffers, movement steering and ally cooldowns. `this.enemies`
   * always denotes the real world list — combatant targeting reads the
   * turnHostiles/activeTargets() projection so spawns and splices inside fn()
   * land on the live list. `control` is the actor's own ActorControl bag (a
   * combatant's `ai.control`, or a co-op player's roster bag). */
  private withActor<T>(actor: Player, control: ActorControl, fn: () => T): T {
    const savedPlayer = this.player;
    const savedSkillBuffer = this.skillBuffer, savedBlockedDraw = this.blockedDrawSlot;
    const savedAttack = this.attackBuffer, savedDodge = this.dodgeBuffer, savedHeal = this.healBuffer;
    const savedHurtGuard = this.hurtGuard, savedCombatUntil = this.combatUntil;
    const savedResourceInit = this.resourceInitialized;
    const savedMovement = this.playerMovement, savedAllyCooldowns = this.allySkillCooldowns;
    const savedTurnHostiles = this.turnHostiles;
    this.player = actor;
    this.turnHostiles = this.hostileTargets(actor);
    this.skillBuffer = control.skillBuffer; this.blockedDrawSlot = control.blockedDrawSlot;
    this.attackBuffer = control.attackBuffer; this.dodgeBuffer = control.dodgeBuffer; this.healBuffer = control.healBuffer;
    this.hurtGuard = control.hurtGuard; this.combatUntil = control.combatUntil;
    this.resourceInitialized = control.resourceInitialized;
    this.playerMovement = control.movement; this.allySkillCooldowns = control.allySkillCooldowns;
    try {
      return fn();
    } finally {
      control.skillBuffer = this.skillBuffer; control.blockedDrawSlot = this.blockedDrawSlot;
      control.attackBuffer = this.attackBuffer; control.dodgeBuffer = this.dodgeBuffer; control.healBuffer = this.healBuffer;
      control.hurtGuard = this.hurtGuard; control.combatUntil = this.combatUntil;
      control.resourceInitialized = this.resourceInitialized;
      this.player = savedPlayer;
      this.skillBuffer = savedSkillBuffer; this.blockedDrawSlot = savedBlockedDraw;
      this.attackBuffer = savedAttack; this.dodgeBuffer = savedDodge; this.healBuffer = savedHeal;
      this.hurtGuard = savedHurtGuard; this.combatUntil = savedCombatUntil;
      this.resourceInitialized = savedResourceInit;
      this.playerMovement = savedMovement; this.allySkillCooldowns = savedAllyCooldowns;
      this.turnHostiles = savedTurnHostiles;
    }
  }

  /** Runs fn with the sim's actor state bound to `player`. Co-op roster members
   * go through withActor so this.player/this.ghost/buffers resolve to them; a
   * non-roster player (solo P1, PvP combatant) runs directly. */
  private forPlayer<T>(player: Player, fn: () => T): T {
    const actor = this.coopRoster?.find(a => a.player === player);
    return actor ? this.withActor(actor.player, actor.control, fn) : fn();
  }

  /** Public: run fn with this.player/ghost/buffers bound to a roster member.
   * Game-layer per-player actions (mount, consumable, interact) use this so a
   * co-op partner's command mutates their own state, never the primary's. */
  asPlayer<T>(player: Player, fn: () => T): T { return this.forPlayer(player, fn); }

  /** The ground-pickup channel for a player: per-actor in co-op, the shared
   * field otherwise. */
  private pickupFor(player: Player): GroundItemPickup {
    return this.coopRoster?.find(a => a.player === player)?.pickup ?? this.groundPickup;
  }

  /** Enter couch co-op: `partner` joins the shared world beside the primary
   * player. Snapshots the primary's live control state into a roster bag so both
   * players run through the same withActor pipeline. Returns false if a second
   * player is already present or a PvP match is live. */
  enterCoop(partner: Player): boolean {
    if (this.coopRoster || this.pvpCombatants) return false;
    this.netDeltaBaseline = null; // fresh session: re-baseline the world delta
    const primary = this.player;
    const primaryControl: ActorControl = {
      skillBuffer: this.skillBuffer, blockedDrawSlot: this.blockedDrawSlot,
      attackBuffer: this.attackBuffer, dodgeBuffer: this.dodgeBuffer, healBuffer: this.healBuffer,
      hurtGuard: this.hurtGuard, combatUntil: this.combatUntil,
      resourceInitialized: this.resourceInitialized,
      movement: this.playerMovement, allySkillCooldowns: this.allySkillCooldowns,
    };
    // Stable combatant ids drive per-player threat buckets, taunts and kill credit.
    primary.id ??= 0;
    partner.id = 1;
    // Reserve the partner's pet/ally entity ids so they can't collide with the
    // live sim's nextId sequence (corrupting ally:<id> threat buckets).
    this.reserveIdentity(Math.max(1, ...(partner.allies ?? []).map(ally => ally.id + 1),
      ...(partner.character.pets ? [partner.character.pets.active, ...partner.character.pets.stabled].map(pet => (pet?.id ?? 0) + 1) : [])));
    this.coopRoster = [
      { player: primary, control: primaryControl, pickup: this.groundPickup },
      { player: partner, control: freshActorControl(), pickup: new GroundItemPickup() },
    ];
    this.coopPlayers = [primary, partner];
    return true;
  }

  /** Leave couch co-op: drops the partner and restores the primary's control
   * state onto the sim fields so single-player continues seamlessly. */
  exitCoop(): Player | null {
    const roster = this.coopRoster;
    if (!roster) return null;
    const primary = roster[0];
    this.skillBuffer = primary.control.skillBuffer; this.blockedDrawSlot = primary.control.blockedDrawSlot;
    this.attackBuffer = primary.control.attackBuffer; this.dodgeBuffer = primary.control.dodgeBuffer;
    this.healBuffer = primary.control.healBuffer; this.hurtGuard = primary.control.hurtGuard;
    this.combatUntil = primary.control.combatUntil; this.resourceInitialized = primary.control.resourceInitialized;
    this.playerMovement = primary.control.movement; this.allySkillCooldowns = primary.control.allySkillCooldowns;
    this.player = primary.player;
    this.coopRoster = null; this.coopPlayers = [primary.player];
    return roster[1]?.player ?? null;
  }

  // ── Online co-op (wayfinder/T03) ───────────────────────────────────────────

  /** Host: serialize a roster member into its wire puppet shape. */
  private netPlayerOf(p: Player, id: number): import('./net-protocol.ts').NetPlayer {
    return {
      id, name: p.name ?? '', x: p.x, y: p.y, prevX: p.prevX, prevY: p.prevY,
      vx: p.vx, vy: p.vy, locomotionVX: p.locomotionVX, locomotionVY: p.locomotionVY,
      angle: p.angle, hp: p.hp, maxHp: p.maxHp, mana: p.mana, maxMana: p.maxMana,
      level: p.level, dead: p.dead, ghost: this.ghosts.get(p) ?? null,
      mounted: p.mounted ?? null, stealthed: p.stealthed ?? false,
      castTime: p.castTime, castDuration: p.castDuration, activeSkill: p.activeSkill,
      attack: p.attack ? { angle: p.attack.angle, elapsed: p.attack.elapsed, duration: p.attack.duration, kind: String(p.attack.kind ?? '') } : null,
      dash: p.dash ? { angle: p.dash.angle, remaining: p.dash.remaining, speed: p.dash.speed } : null,
      dodgeTime: p.dodgeTime, hitFlash: p.hitFlash,
      character: p.character, derived: p.derived, buffs: p.buffs ?? [],
    };
  }

  /** Host: serialize an enemy into its wire puppet shape. */
  private netEnemyOf(e: Enemy): import('./net-protocol.ts').NetEnemy {
    return {
      id: e.id, kind: e.kind, rank: e.rank, level: e.level, biome: e.biome,
      x: e.x, y: e.y, prevX: e.prevX, prevY: e.prevY, vx: e.vx, vy: e.vy, angle: e.angle,
      hp: e.hp, maxHp: e.maxHp, state: e.state, stateTime: e.stateTime, stateDuration: e.stateDuration,
      radius: e.radius, attackAngle: e.attackAngle, attackTargetX: e.attackTargetX, attackTargetY: e.attackTargetY,
      hitFlash: e.hitFlash, hitAngle: e.hitAngle, faction: e.faction,
      burnTime: e.burnTime, freezeTime: e.freezeTime, stunTime: e.stunTime, chillTime: e.chillTime,
      slowTime: e.slowTime, slowFactor: e.slowFactor, stagger: e.stagger,
      sundered: e.sundered, bossPhases: e.bossPhases, affix: e.affix, campId: e.campId,
    };
  }

  /** The roster id the host assigned this client (its own player). */
  netPeerId = 0;

  /** Public: apply authoritative own-player fields (net client self-sync). */
  applyNetSelf(fields: import('./character-save.ts').PlayerCheckpointFields): void {
    this.applyPlayerFields(this.player, fields);
    this.player.x = fields.x; this.player.y = fields.y;
    this.player.prevX = fields.x; this.player.prevY = fields.y;
    // The host assigns this client's roster id; adopt it so threat/kill
    // attribution and event sourceIds resolve to the right combatant.
    this.player.id = this.netPeerId;
  }
  /** Public: extract a roster member's player-field half (host welcome/snapshot). */
  netPlayerFields(p: Player): import('./character-save.ts').PlayerCheckpointFields {
    return this.playerFieldsOf(p);
  }
  /** Public: build a remote partner Player from a joining client's fields. */
  netPartnerFrom(fields: import('./character-save.ts').PlayerCheckpointFields, name: string): Player {
    const p = initialPlayer(fields.x ?? this.player.x + 48, fields.y ?? this.player.y);
    p.name = name;
    this.applyPlayerFields(p, fields);
    // Pets/summons travel in the checkpoint fields; restore them so pet classes
    // (hunter, warlock, DK, mage) arrive with their companions. Ids are
    // re-reserved by enterCoop so they never collide with host entities.
    p.allies = (fields.allies ?? []).map(ally => ({ ...ally, targetId: null }));
    p.petCommand = fields.petCommand;
    return p;
  }

  /** Client: apply additive world-state deltas from a snapshot (broken
   * containers, cleared camps, defeated camp members). Merges with existing
   * state rather than replacing it. */
  applyNetDelta(delta: import('./net-protocol.ts').NetWorldDelta): void {
    if (!delta) return;
    if (delta.brokenContainers) {
      for (const id of delta.brokenContainers) this.brokenContainers.add(id);
      this.world.setBrokenContainers?.(this.brokenContainers);
    }
    if (delta.clearedCamps?.length)
      this.camps.restoreCleared([...new Set([...this.camps.clearedIds(), ...delta.clearedCamps])]);
    if (delta.defeatedCampMembers?.length) {
      const merged: Record<string, string[]> = this.camps.defeatedMembers();
      for (const m of delta.defeatedCampMembers) (merged[m.campId] ??= []).push(m.memberId);
      this.camps.restoreDefeated(merged);
    }
  }
  /** Host: capture a snapshot addressed to one client (its own player rides in
   * `self`; enemies/loot are culled to that client's radius). */
  captureNetSnapshot(tick: number, forPlayer: Player, events: import('./model.ts').CombatEvent[]): import('./net-protocol.ts').MsgSnapshot {
    const near = (x: number, y: number, r: number) => Math.hypot(x - forPlayer.x, y - forPlayer.y) <= r;
    const roster = this.coopRoster?.map(a => a.player) ?? [this.player];
    return {
      type: 'snapshot', tick, time: this.time, kills: this.kills,
      players: roster.map((p, i) => this.netPlayerOf(p, i)),
      enemies: this.enemies.filter(e => near(e.x, e.y, 2400)).map(e => this.netEnemyOf(e)),
      projectiles: this.projectiles.filter(pr => near(pr.x, pr.y, 2400)).map(pr => ({
        id: pr.id, x: pr.x, y: pr.y, prevX: pr.prevX, prevY: pr.prevY, angle: pr.angle,
        style: pr.effects?.style, skill: pr.skill, owner: pr.owner, sourceId: pr.sourceId ?? pr.source?.id,
      })),
      groundEffects: this.groundEffects.filter(g => near(g.x, g.y, 2400)).map(g => ({
        id: g.id, kind: String(g.kind), x: g.x, y: g.y, radius: g.radius,
        delay: g.delay, duration: g.duration, interval: g.interval, tick: g.tick,
        sourceId: g.source?.id, style: g.style, skill: g.skill,
      })),
      groundItems: this.groundItems.filter(g => near(g.x, g.y, 2400)),
      groundGold: this.groundGold.filter(g => near(g.x, g.y, 2400)),
      pickups: this.pickups.filter(pk => near(pk.x, pk.y, 2400)),
      events,
      self: this.playerFieldsOf(forPlayer),
      delta: this.netDelta(),
    };
  }

  /** World-state delta since the previous snapshot: newly broken containers,
   * cleared camps and defeated camp members. The baseline is the state at the
   * first capture (post-join), so pre-join history isn't re-sent — the welcome
   * checkpoint already carries it. */
  private netDeltaBaseline: { containers: Set<string>; camps: Set<string>; members: Set<string> } | null = null;
  private netDelta(): import('./net-protocol.ts').NetWorldDelta | undefined {
    const containers = this.brokenContainers;
    const camps = new Set(this.camps.clearedIds());
    const members = new Set<string>();
    const defeated = this.camps.defeatedMembers();
    for (const campId of Object.keys(defeated)) for (const m of defeated[campId]!) members.add(`${campId}${m}`);
    if (!this.netDeltaBaseline) {
      this.netDeltaBaseline = { containers: new Set(containers), camps, members };
      return undefined;
    }
    const base = this.netDeltaBaseline;
    const brokenContainers = [...containers].filter(id => !base.containers.has(id));
    const clearedCamps = [...camps].filter(id => !base.camps.has(id));
    const defeatedCampMembers: { campId: string; memberId: string }[] = [];
    for (const campId of Object.keys(defeated)) for (const memberId of defeated[campId]!)
      if (!base.members.has(`${campId}${memberId}`)) defeatedCampMembers.push({ campId, memberId });
    // Advance the baseline so each change is sent once.
    for (const id of brokenContainers) base.containers.add(id);
    for (const id of clearedCamps) base.camps.add(id);
    for (const m of defeatedCampMembers) base.members.add(`${m.campId}${m.memberId}`);
    if (!brokenContainers.length && !clearedCamps.length && !defeatedCampMembers.length) return undefined;
    return { brokenContainers, clearedCamps, defeatedCampMembers };
  }

  /** Client: apply a host snapshot. Rebuilds remote puppets and the client's own
   * authoritative player; positions are interpolated by netTick(). */
  applyNetSnapshot(snap: import('./net-protocol.ts').MsgSnapshot): void {
    // Own position is host-authoritative too (no client prediction in v1). The
    // rendered position lerps from the previous target toward the new one.
    this.player.prevX = this.player.x; this.player.prevY = this.player.y;
    this.player.x = snap.self.x; this.player.y = snap.self.y;
    this.time = snap.time; this.kills = snap.kills;
    this.applyPlayerFields(this.player, snap.self);
    // Presentation-only fields (facing, cast, attack, ghost) ride in the roster
    // entry for this client, not in the checkpoint `self` block.
    const selfNet = snap.players.find(np => np.id === this.netPeerId);
    if (selfNet) this.applyNetPlayerPresentation(this.player, selfNet);
    const peers: Player[] = [];
    for (const np of snap.players) {
      if (np.id === this.netPeerId) continue;
      const puppet = this.netPeers.find(p => p.id === np.id) ?? this.spawnNetPeer(np);
      this.applyNetPlayer(puppet, np);
      peers.push(puppet);
    }
    this.netPeers = peers;
    const seen = new Set<number>();
    for (const ne of snap.enemies) {
      seen.add(ne.id);
      let e = this.enemies.find(en => en.id === ne.id);
      if (!e) { e = this.spawnNetEnemy(ne); this.enemies.push(e); }
      this.applyNetEnemy(e, ne);
    }
    this.enemies = this.enemies.filter(e => seen.has(e.id));
    // Projectiles and ground effects are pure puppets: rebuild them each
    // snapshot so ranged combat and area effects are visible to the client.
    this.projectiles = snap.projectiles.map(np => this.netProjectileOf(np));
    this.groundEffects = snap.groundEffects.map(ng => this.netGroundEffectOf(ng));
    this.groundItems = snap.groundItems; this.groundGold = snap.groundGold; this.pickups = snap.pickups;
    // Restart the interpolation sweep toward this snapshot's positions.
    this.netAlpha = 0;
  }

  /** Client: advance remote puppets between snapshots. The netAlpha clock sweeps
   * 0→1 across the snapshot interval so the renderer lerps prev→current; only
   * presentation timers decay here — no combat, spawning or world mutation. */
  netTick(dt: number): void {
    this.netAlpha = Math.min(1, this.netAlpha + dt * NET_SNAPSHOT_HZ);
    for (const e of this.enemies) {
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.stateTime += dt;
      if (e.burnTime > 0) e.burnTime = Math.max(0, e.burnTime - dt);
      if (e.slowTime > 0) e.slowTime = Math.max(0, e.slowTime - dt);
      if (e.stunTime) e.stunTime = Math.max(0, e.stunTime - dt);
      if (e.freezeTime) e.freezeTime = Math.max(0, e.freezeTime - dt);
      if (e.chillTime) e.chillTime = Math.max(0, e.chillTime - dt);
    }
    for (const p of this.netPeers) {
      p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (p.castDuration > 0) p.castTime = Math.min(p.castDuration, p.castTime + dt);
      if (p.dodgeTime > 0) p.dodgeTime = Math.max(0, p.dodgeTime - dt);
      if (p.attack) p.attack.elapsed += dt;
    }
    // Own player presentation timers also decay between authoritative snapshots.
    this.player.hitFlash = Math.max(0, this.player.hitFlash - dt);
    if (this.player.castDuration > 0) this.player.castTime = Math.min(this.player.castDuration, this.player.castTime + dt);
    if (this.player.attack) this.player.attack.elapsed += dt;
  }

  private spawnNetPeer(np: import('./net-protocol.ts').NetPlayer): Player {
    const p = initialPlayer(np.x, np.y);
    p.id = np.id; p.name = np.name;
    return p;
  }
  private applyNetPlayer(p: Player, np: import('./net-protocol.ts').NetPlayer): void {
    // Interpolate: keep the rendered position as the lerp start, the snapshot
    // position becomes the new target.
    p.prevX = p.x; p.prevY = p.y;
    p.x = np.x; p.y = np.y;
    p.vx = np.vx; p.vy = np.vy; p.locomotionVX = np.locomotionVX; p.locomotionVY = np.locomotionVY;
    p.hp = np.hp; p.maxHp = np.maxHp; p.mana = np.mana; p.maxMana = np.maxMana;
    p.level = np.level; p.dead = np.dead; p.mounted = np.mounted as Player['mounted']; p.stealthed = np.stealthed;
    p.character = np.character; p.buffs = np.buffs as Player['buffs'];
    refreshCharacter(p); // rebuild equipment so the attack weapon visual resolves
    p.derived = np.derived; // host-authoritative stats win over the recompute
    this.applyNetPlayerPresentation(p, np);
  }
  /** Presentation-only fields shared by remote puppets and the client's own
   * player: facing, cast/attack/dash animation, hit flash and ghost state. */
  private applyNetPlayerPresentation(p: Player, np: import('./net-protocol.ts').NetPlayer): void {
    p.angle = np.angle;
    p.castTime = np.castTime; p.castDuration = np.castDuration; p.activeSkill = np.activeSkill;
    p.dodgeTime = np.dodgeTime; p.hitFlash = np.hitFlash;
    // Rebuild a minimal attack/dash so swings and dashes animate on the puppet.
    // The full Attack payload (weapon, offense, hitIds) is host-side only; the
    // renderer needs angle/elapsed/duration/kind plus the equipped weapon.
    p.attack = np.attack ? {
      kind: np.attack.kind === 'ranged' ? 'ranged' : 'melee',
      weapon: p.equipment?.mainHand ?? p.attack?.weapon,
      hand: 'main', angle: np.attack.angle, elapsed: np.attack.elapsed, duration: np.attack.duration,
      activeStart: 0, activeEnd: np.attack.duration, hitIds: new Set<number>(),
    } as Player['attack'] : null;
    p.dash = np.dash ? {
      angle: np.dash.angle, remaining: np.dash.remaining, speed: np.dash.speed,
      damage: 0, radius: 0, skill: np.activeSkill ?? ('' as SkillId), hitIds: new Set<number>(),
    } as Player['dash'] : null;
    // Ghost state lives in the ghosts map, not on the Player.
    if (np.ghost) this.ghosts.set(p, { corpse: np.ghost.corpse, healer: np.ghost.healer });
    else this.ghosts.delete(p);
  }

  /** Rebuild a projectile puppet from its wire shape. */
  private netProjectileOf(np: import('./net-protocol.ts').NetProjectile): import('./model.ts').Projectile {
    return {
      id: np.id, sourceLevel: 1, sourceId: np.sourceId,
      x: np.x, y: np.y, prevX: np.prevX, prevY: np.prevY,
      vx: Math.cos(np.angle), vy: Math.sin(np.angle), angle: np.angle,
      radius: 6, damage: 0, life: 0, maxLife: 1,
      owner: np.owner, skill: np.skill,
      effects: np.style ? { style: np.style } as import('./model.ts').ProjectileEffects : undefined,
      hitIds: new Set<number>(),
    } as import('./model.ts').Projectile;
  }
  /** Rebuild a ground-effect puppet from its wire shape. */
  private netGroundEffectOf(ng: import('./net-protocol.ts').NetGroundEffect): ActiveGroundEffect {
    return {
      id: ng.id, kind: ng.kind as import('./model.ts').GroundEffect['kind'],
      x: ng.x, y: ng.y, radius: ng.radius,
      delay: ng.delay, duration: ng.duration, interval: ng.interval, tick: ng.tick,
      damage: 0, skill: ng.skill ?? ('' as SkillId), style: (ng.style ?? 'arcane') as import('./model.ts').ProjectileStyle,
      // Presentation-only puppet: pulsesLeft drives remaining-pulse rendering.
      pulsesLeft: Math.max(0, Math.ceil(ng.duration / Math.max(0.001, ng.interval))),
    } as ActiveGroundEffect;
  }
  private spawnNetEnemy(ne: import('./net-protocol.ts').NetEnemy): Enemy {
    const stats = scaledEnemyStats(ne.kind, ne.level, ne.rank);
    return {
      id: ne.id, level: ne.level, rank: ne.rank, biome: ne.biome, lootSeed: 0,
      damage: stats.damage, xpReward: stats.xpReward,
      x: ne.x, y: ne.y, prevX: ne.x, prevY: ne.y, vx: ne.vx, vy: ne.vy,
      knockbackX: 0, knockbackY: 0, angle: ne.angle, hp: ne.hp, maxHp: ne.maxHp,
      kind: ne.kind, state: ne.state, stateTime: ne.stateTime, stateDuration: ne.stateDuration,
      attackAngle: ne.attackAngle, attackTargetX: ne.attackTargetX, attackTargetY: ne.attackTargetY,
      homeX: ne.x, homeY: ne.y, awareness: 0, lostSightTime: 0, lastSeenX: ne.x, lastSeenY: ne.y,
      senseTime: 0, seesPlayer: false, patrolPhase: 0, hitFlash: ne.hitFlash, hitAngle: ne.hitAngle,
      radius: ne.radius, stagger: ne.stagger, attackHit: false, interrupted: false,
      slowTime: ne.slowTime, slowFactor: ne.slowFactor, burnTime: ne.burnTime, burnDps: 0, burnTick: 0,
      faction: ne.faction as Enemy['faction'], freezeTime: ne.freezeTime,
      stunTime: ne.stunTime, chillTime: ne.chillTime, sundered: ne.sundered, bossPhases: ne.bossPhases,
      affix: ne.affix as Enemy['affix'], campId: ne.campId,
    } as Enemy;
  }
  private applyNetEnemy(e: Enemy, ne: import('./net-protocol.ts').NetEnemy): void {
    // Interpolate: rendered position is the lerp start, snapshot pos the target.
    e.prevX = e.x; e.prevY = e.y;
    e.x = ne.x; e.y = ne.y;
    e.vx = ne.vx; e.vy = ne.vy; e.angle = ne.angle;
    e.hp = ne.hp; e.maxHp = ne.maxHp; e.state = ne.state; e.stateTime = ne.stateTime; e.stateDuration = ne.stateDuration;
    e.attackAngle = ne.attackAngle; e.attackTargetX = ne.attackTargetX; e.attackTargetY = ne.attackTargetY;
    e.hitFlash = ne.hitFlash; e.hitAngle = ne.hitAngle; e.burnTime = ne.burnTime;
    e.freezeTime = ne.freezeTime; e.stunTime = ne.stunTime; e.chillTime = ne.chillTime;
    e.slowTime = ne.slowTime; e.slowFactor = ne.slowFactor; e.stagger = ne.stagger;
    e.sundered = ne.sundered; e.bossPhases = ne.bossPhases;
  }
  /** Apply authoritative own-player fields from a snapshot's `self` block. */
  private applyPlayerFields(p: Player, fields: import('./character-save.ts').PlayerCheckpointFields): void {
    if (!fields) return;
    p.character = fields.character; p.level = fields.level; p.xp = fields.xp;
    p.hp = fields.hp; p.mana = fields.mana; p.dead = fields.dead;
    p.flasks = fields.flasks; p.healCooldown = fields.healCooldown;
    p.dodgeCharges = fields.dodgeCharges; p.dodgeRecharge = fields.dodgeRecharge;
    p.skillCooldowns = fields.skillCooldowns; p.buffs = fields.buffs; p.comboPoints = fields.comboPoints;
    p.runes = fields.runes; p.soulShards = fields.soulShards; p.stealthed = fields.stealthed;
    p.autoAttack = fields.autoAttack; p.mounted = fields.mounted; p.restedXp = fields.restedXp;
    p.hearthstone = fields.hearthstone; p.professions = fields.professions; p.quests = fields.quests;
    p.achievements = fields.achievements; p.glyphs = fields.glyphs; p.fishing = fields.fishing;
    p.durability = fields.durability; p.combatLog = fields.combatLog; p.reputation = fields.reputation;
    // Facing, pets and pet orders are authoritative too — they were dropped
    // before, leaving the client's own avatar facing a frozen direction and
    // pet classes without their companions.
    if (fields.angle !== undefined) p.angle = fields.angle;
    if (fields.allies) p.allies = fields.allies.map(ally => ({ ...ally, targetId: null }));
    if (fields.petCommand !== undefined) p.petCommand = fields.petCommand;
    refreshCharacter(p);
  }
  /** Extract the player-field half of a checkpoint for one roster member. */
  private playerFieldsOf(p: Player): import('./character-save.ts').PlayerCheckpointFields {
    return {
      chronicle: p.chronicle, character: p.character, level: p.level, xp: p.xp,
      x: p.x, y: p.y, angle: p.angle, hp: p.hp, mana: p.mana, dead: p.dead,
      flasks: p.flasks, healCooldown: p.healCooldown, dodgeCharges: p.dodgeCharges, dodgeRecharge: p.dodgeRecharge,
      skillCooldowns: p.skillCooldowns, allies: p.allies, buffs: p.buffs, comboPoints: p.comboPoints,
      runes: p.runes, petCommand: p.petCommand, soulShards: p.soulShards, stealthed: p.stealthed,
      autoAttack: p.autoAttack, mounted: p.mounted, restedXp: p.restedXp, hearthstone: p.hearthstone,
      professions: p.professions, quests: p.quests, achievements: p.achievements, glyphs: p.glyphs,
      fishing: p.fishing, durability: p.durability, combatLog: p.combatLog, reputation: p.reputation,
    } as import('./character-save.ts').PlayerCheckpointFields;
  }

  /** Combat-clock bump for rage/runic decay, written to the actor's own bag. */
  private bumpCombat(actor: Player): void {
    const until = this.time + WOW_COMBAT.rageDecayDelay;
    const control = this.controlFor(actor);
    if (actor === this.player || !control) this.combatUntil = until;
    else control.combatUntil = until;
  }

  /** Player-shaped damage entry: armor/resist/absorb/block mitigation, then the
   * PvP corpse rule. `source` owns combat-clock credit and leech-style procs. */
  private damageCombatant(target: Player, amount: number, angle: number, sourceLevel: number, damageType: DamageType,
    periodic = false, style?: ProjectileStyle, source?: Player, kind?: EnemyKind, melee = false, reflected = false): boolean {
    const hpBefore = target.hp;
    const landed = damageCombatant(amount, angle, sourceLevel, damageType, {
      player: target, world: this.world, random: () => this.random(), emit: event => this.emit(event),
      addBuff: (name, color, spec, id) => this.addBuffTo(target, name, color, spec, id),
      defensiveProc: (player, context) => tryDefensiveProc(player, context),
      ...(source ? { offense: { hitRating: source.derived.hitRating, expertise: source.derived.expertise },
        attacker: source as unknown as Enemy } : {}),
      reflected,
      strikeBack: (foe, reflectedAmount, type) => this.reflectStrike(target, foe, reflectedAmount, type),
      wardBurst: burst => {
        this.emit({ type: 'blast', x: target.x, y: target.y, radius: burst.radius, style: 'arcane', skill: 'runicWard', color: '#d98eda' });
        strikeContainers(this.containerContext(), target.x, target.y, burst.radius);
        for (const enemy of this.hostileTargets(target)) if (enemy.state !== 'dead'
          && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= burst.radius + enemy.radius
          && this.lineOfSight(target.x, target.y, enemy.x, enemy.y))
          this.damageEnemy(enemy, burst.damage, Math.atan2(enemy.y - target.y, enemy.x - target.x), false, false, 'arcane', undefined, burst.offense, false, target);
      },
    }, kind, periodic, style, undefined, melee);
    if (!landed) return false;
    if (this.pvpDamageSink && isCombatant(target)) this.pvpDamageSink(source, target, hpBefore - target.hp);
    this.bumpCombat(source ?? this.player);
    this.bumpCombat(target);
    return true;
  }

  /** Reflect channel for damageCombatant: the post-mitigation fraction returns to
   * the attacker through the enemy-damage path. Combatant attackers take the
   * player-shaped path flagged `reflected` so reflect never answers reflect. */
  private reflectStrike(target: Player, attacker: Enemy, amount: number, damageType: DamageType): void {
    const style = damageType === 'physical' ? undefined : damageType;
    if (isCombatant(attacker)) {
      this.damageCombatant(attacker, amount, Math.atan2(attacker.y - target.y, attacker.x - target.x),
        target.level, damageType, false, style, target, undefined, false, true);
      return;
    }
    this.damageEnemy(attacker, amount, Math.atan2(attacker.y - target.y, attacker.x - target.x),
      false, false, style, style ? amount : undefined, REFLECT_OFFENSE, false, target);
  }


  /** Automatic population waits for the camera's current/pending visible envelope. */
  setSpawnExclusion(bounds: { x: number; y: number; width: number; height: number } | null): void {
    this.spawnExclusion = bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
      && bounds.width > 0 && bounds.height > 0 ? { ...bounds } : null;
  }

  setCombatViewport(bounds: CombatViewport | null): void {
    this.combatViewport = bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
      && bounds.width > 0 && bounds.height > 0 ? { ...bounds } : null;
  }

  getCampState(id: string): CampState { return this.camps.getState(id); }

  /** Call when focus/control context changes, including pause and resume. */
  clearInput(preserveMovement = false): void {
    // Owner-scoped cancels: in co-op a partner's clearInput must not cancel the
    // other player's in-progress portal/hearthstone/event/pickup channel.
    this.pickupFor(this.player).cancel();
    this.portal.cancelFor(this.player); this.eventChannel.cancelFor(this.player); this.hearthstone.cancelFor(this.player);
    this.attackBuffer = this.dodgeBuffer = this.healBuffer = -1;
    this.skillBuffer = null; this.blockedDrawSlot = null;
    if(this.player.skillEffects)delete this.player.skillEffects.draw;
    if (!preserveMovement) {
      this.player.vx = this.player.vy = 0;
      this.player.locomotionVX = this.player.locomotionVY = 0;
      this.accumulator = 0;
      this.capturePositions();
    }
  }

  /** Context changes (pause, resume, blur, menu) clear every player's buffers in
   * co-op — not just the primary's — so no queued partner action fires on resume. */
  clearInputAll(preserveMovement = false): void {
    if (!this.coop) { this.clearInput(preserveMovement); return; }
    for (const actor of this.players) this.forPlayer(actor, () => this.clearInput(preserveMovement));
  }

  /** UI hover cancels queued weapons while movement and current actions continue. */
  clearBasicAttackInput(): void { this.attackBuffer = -1; }

  clearCombatInput(): void {
    this.attackBuffer = -1; this.skillBuffer = null; this.blockedDrawSlot = null;
    if(this.player.skillEffects)delete this.player.skillEffects.draw;
  }

  /** Fraction between the two most recent fixed-tick positions for rendering.
   * A net client interpolates across the snapshot interval instead. */
  get interpolationAlpha(): number {
    if (this.netMode === 'client') return this.netAlpha;
    return Math.max(0, Math.min(1, this.accumulator / FIXED_STEP));
  }

  private emit(event: CombatEvent): void { trackChronicleEvent(this.player,this.enemies,event); this.events.push(event); }

  drainEvents(): CombatEvent[] {
    const result = this.events;
    this.events = [];
    return result;
  }

  // ── WoW combat model (docs/wow-transformation.md) ──────────────────────

  /** Live hostile for an id, or undefined when dead/absent. In a PvP turn the
   * swapped-in list already holds the acting combatant's foes. */
  private targetEnemy(id: number | null | undefined): Enemy | undefined {
    return id == null ? undefined : this.activeTargets().find(enemy => enemy.id === id && enemy.state !== 'dead');
  }

  /** Select or clear the current target; switching drops combo points, clearing drops auto-attack. */
  setTarget(id: number | null): void {
    const p = this.player;
    const next = id == null ? null : (this.targetEnemy(id)?.id ?? null);
    if (next !== (p.targetId ?? null)) p.comboPoints = 0;
    p.targetId = next;
    if (next === null) p.autoAttack = false;
  }

  /** Tab cycle: the near fight cluster wraps; the distant fallback is reached only when it is empty. */
  tabTarget(step: 1 | -1 = 1): number | null {
    const p = this.player;
    const ranked = this.activeTargets().filter(enemy => enemy.state !== 'dead'
      && playerCanAttack(enemy, p)
      && Math.hypot(enemy.x - p.x, enemy.y - p.y) <= TAB_TARGETING.queryRadius)
      .map(enemy => {
        const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        const engaged = enemy.awareness > 0 || !!enemy.taunted
          || enemy.state === 'chase' || enemy.state === 'windup' || enemy.state === 'attack' || enemy.state === 'recover';
        const vis = d <= 1e-6 || Math.cos(Math.atan2(enemy.y - p.y, enemy.x - p.x) - p.angle) >= Math.cos(tabConeHalfAt(d));
        const meleeEngaged = engaged && d <= TAB_TARGETING.meleeEngagedRadius;
        const tier = engaged && (vis || meleeEngaged) ? 0 : vis ? 1 : engaged ? 2 : 3;
        return { id: enemy.id, d, tier, near: (vis && (engaged || d <= TAB_TARGETING.nearRadius)) || meleeEngaged };
      })
      .sort((a, b) => a.tier - b.tier || a.d - b.d || a.id - b.id);
    if (!ranked.length) { this.setTarget(null); return null; }
    const primary = ranked.filter(c => c.near), fallback = ranked.filter(c => !c.near);
    const ids = [...primary, ...fallback].map(c => c.id);
    const curIdx = ids.indexOf(p.targetId ?? -1);
    const next = curIdx === -1 ? ids[0]!
      : curIdx < primary.length ? ids[(curIdx + step + primary.length) % primary.length]!
      : ids[(curIdx + step + ids.length) % ids.length]!;
    this.setTarget(next);
    return next;
  }

  /** Combo points only accumulate against the current target. */
  addComboPoint(): void {
    const p = this.player;
    if (!this.targetEnemy(p.targetId)) return;
    p.comboPoints = Math.min(WOW_COMBAT.maxComboPoints, (p.comboPoints ?? 0) + 1);
  }

  /** Returns and clears the combo points riding the current target. */
  spendComboPoints(): number {
    const p = this.player, points = p.comboPoints ?? 0;
    p.comboPoints = 0;
    return points;
  }

  addRunicPower(amount: number): void {
    const p = this.player;
    p.mana = Math.min(100, Math.max(0, p.mana + amount));
  }

  /** Rune slots [blood×2, frost×2, unholy×2] hold ready-at sim times; each spent rune grants runic power. */
  spendRuneCost(cost: Partial<Record<RuneKind, number>>): boolean {
    const p = this.player, runes = p.runes ??= [0, 0, 0, 0, 0, 0];
    const kinds: readonly RuneKind[] = ['blood', 'frost', 'unholy'];
    const slots: number[] = [];
    for (const [index, kind] of kinds.entries()) {
      for (let n = cost[kind] ?? 0; n > 0; n--) {
        const slot = [2 * index, 2 * index + 1].find(s => runes[s]! <= this.time);
        if (slot === undefined) return false;
        slots.push(slot);
      }
    }
    for (const slot of slots) runes[slot] = this.time + WOW_COMBAT.runeRecharge;
    return true;
  }

  /** WoW DoT; non-stacking per id (strongest/longest wins), ticks in combat-status. */
  applyDot(enemy: Enemy, spec: DotSpec, baseDamage: number, id = spec.school): void {
    applyDotStatus(enemy, id, spec, baseDamage, 'player', undefined, this.player.id ?? 0);
  }

  /** WoW crowd control; breakOnDamage defaults per kind inside combat-status.
   * Combatant targets additionally lose any cast in progress (WoW interrupt rule). */
  applyCc(enemy: Enemy, kind: CcKind, duration: number, breakOnDamage?: boolean, factor?: number): void {
    applyCcStatus(enemy, kind, duration, breakOnDamage, factor);
    if (isCombatant(enemy) && kind !== 'root' && kind !== 'slow') enemy.cast = null;
  }

  /** Sunder/expose: the enemy takes bonus damage while it lasts. */
  applySunder(enemy: Enemy, fraction: number, duration: number): void {
    applySunderStatus(enemy, fraction, duration);
  }

  /** Player buff entry; an exclusiveGroup replaces any buff in the same group. */
  addBuff(name: string, color: string, spec: BuffSpec, id = name): void {
    this.addBuffTo(this.player, name, color, spec, id);
  }

  /** Buff entry on an explicit actor — defensive procs and PvP combatants need it. */
  addBuffTo(p: Player, name: string, color: string, spec: BuffSpec, id = name): void {
    const buffs = p.buffs ??= [];
    if (spec.exclusiveGroup) for (let i = buffs.length - 1; i >= 0; i--) if (buffs[i]!.exclusiveGroup === spec.exclusiveGroup) {
      restoreFormResource(p, buffs[i]!);
      buffs.splice(i, 1);
    }
    const existing = buffs.find(buff => buff.id === id);
    if (existing) { existing.remaining = Math.max(existing.remaining, spec.duration); return; }
    const buff: WowBuff = { id, name, color, remaining: spec.duration, duration: spec.duration,
      stats: spec.stats, absorb: spec.absorb, absorbRemaining: spec.absorb ? p.maxHp * spec.absorb : undefined,
      reduction: spec.reduction, healPerSecond: spec.healPerSecond, manaPerSecond: spec.manaPerSecond,
      resourcePerSecond: spec.resourcePerSecond, exclusiveGroup: spec.exclusiveGroup, form: spec.form,
      stealth: spec.stealth, reflect: spec.reflect, imbue: spec.imbue, petShare: spec.petShare,
      immunity: spec.immunity, leech: spec.leech, breakControl: spec.breakControl, allyDamage: spec.allyDamage };
    // Bear/cat forms swap the resource pool: stash the current pool on the buff and
    // start the form pool (rage empty, energy full); restoreFormResource hands it back.
    if (spec.form === 'bear' || spec.form === 'cat') {
      buff.storedResource = p.mana;
      const model = spec.form === 'bear' ? WOW_CLASSES.warrior : WOW_CLASSES.rogue;
      p.maxMana = model.resourceCap;
      p.mana = model.resource === 'energy' ? model.resourceCap : 0;
    }
    buffs.push(buff);
    if (spec.stealth) p.stealthed = true;
    if (spec.breakControl) { p.cc = undefined; p.ccImmunity = Math.max(p.ccImmunity ?? 0, spec.duration); }
    if (spec.stats) refreshBuffStats(p);
  }
  /** Summon allies from ALLY_TEMPLATES; hp scales off player maxHp, damage off attack damage.
   * Permanent pets (no duration) replace a live ally of the same kind — one per kind, and
   * one permanent demon-family ally at a time. Pet-family kinds route through
   * summonActivePet: no active PetRecord means no summon, and a live pet is never
   * respawned (no free full heal). */
  summonAlly(kind: AllyKind, count = 1, duration?: number): void {
    if (petFamilyForAlly(kind)) { this.summonActivePet(); return; }
    const p = this.player, allies = p.allies ??= [];
    const template = ALLY_TEMPLATES[kind];
    const demon = demonFamilyForAlly(kind);
    if (duration === undefined) for (let i = allies.length - 1; i >= 0; i--)
      if (allies[i]!.kind === kind || (demon && allies[i]!.remaining === undefined && demonFamilyForAlly(allies[i]!.kind))) allies.splice(i, 1);
    const attack = deriveAttackStats(p.stats, p.equipment.mainHand);
    for (let i = 0; i < count && allies.length < WOW_COMBAT.maxAllies; i++) {
      const angle = this.random() * TAU;
      const spot = this.world.move(p.x, p.y, Math.cos(angle) * 24, Math.sin(angle) * 24, template.radius);
      const hp = Math.max(1, Math.round(p.maxHp * template.hpFraction));
      allies.push({ id: this.nextId++, kind, x: spot.x, y: spot.y, prevX: spot.x, prevY: spot.y, angle: p.angle,
        hp, maxHp: hp, damage: Math.max(1, Math.round(attack.damage * template.damageFraction)),
        stationary: template.stationary, ...(duration !== undefined ? { remaining: duration } : {}),
        targetId: null, attackCooldown: 0, radius: template.radius,
        ...(template.aura ? { aura: { ...template.aura } } : {}) });
      // Arrival flash so demons/elementals/totems don't pop in silently.
      this.emit({ type: 'blast', x: spot.x, y: spot.y, radius: template.radius + 26, duration: .4 });
    }
  }

  /** Spawn the active PetRecord's ally; level-scaled stats (petStatsFor) replace the template's. */
  private summonPetAlly(pet: PetRecord): void {
    const p = this.player, allies = p.allies ??= [];
    const template = ALLY_TEMPLATES[pet.allyKind];
    for (let i = allies.length - 1; i >= 0; i--)
      if (allies[i]!.petId === pet.id) allies.splice(i, 1);
    if (allies.length >= WOW_COMBAT.maxAllies) return;
    const angle = this.random() * TAU;
    const spot = this.world.move(p.x, p.y, Math.cos(angle) * 24, Math.sin(angle) * 24, template.radius);
    const stats = petStatsFor(pet);
    allies.push({ id: this.nextId++, kind: pet.allyKind, x: spot.x, y: spot.y, prevX: spot.x, prevY: spot.y, angle: p.angle,
      hp: stats.maxHp, maxHp: stats.maxHp, damage: stats.damage,
      stationary: template.stationary, targetId: null, attackCooldown: 0, radius: template.radius,
      petId: pet.id, ...(template.aura ? { aura: { ...template.aura } } : {}) });
  }

  /** The live ally bound to the active PetRecord, if it is alive. */
  petAlly(): Ally | undefined {
    const pet = this.player.character.pets?.active;
    return pet ? this.player.allies?.find(ally => ally.petId === pet.id && ally.hp > 0) : undefined;
  }

  /** Heal an ally (Mend Pet); amount ≤1 is a fraction of the ally's maxHp. Emits the heal event. */
  healAlly(ally: Ally, amount: number, color?: string): void {
    const before = ally.hp;
    ally.hp = Math.min(ally.maxHp, ally.hp + (amount <= 1 ? ally.maxHp * amount : amount));
    const healed = ally.hp - before;
    if (healed > 0) this.emit({ type: 'heal', x: ally.x, y: ally.y, value: healed, ...(color ? { color } : {}) });
  }

  /** Summon the active PetRecord's ally when none is live (Call Pet / Revive Pet). */
  summonActivePet(): boolean {
    const pet = this.player.character.pets?.active;
    if (!pet || this.petAlly()) return false;
    this.summonPetAlly(pet);
    return true;
  }

  /** Reconcile live allies with the stable: stray pet-family allies despawn, the active pet is summoned. */
  syncPetAlly(): void {
    const p = this.player, pet = p.character.pets?.active;
    if (p.allies) p.allies = p.allies.filter(ally => !petFamilyForAlly(ally.kind) || ally.petId === pet?.id);
    if (pet) this.summonActivePet();
  }

  /** Hunter pet stance: attack the player's target, return, hold position, or never engage. */
  setPetCommand(command: NonNullable<Player['petCommand']>): void {
    this.player.petCommand = command;
  }

  /** Tame Beast completion: convert a live beast enemy into a PetRecord plus its summoned ally.
   * The enemy is consumed — camp members count as defeated, dungeon members stay dead,
   * event guardians are marked dead — without kill rewards. */
  tameBeast(enemy: Enemy): 'tamed' | 'untameable' | 'full' {
    const p = this.player;
    if (enemy.state === 'dead' || isCombatant(enemy) || !tameableFamily(enemy.kind) || enemy.rank === 'elite'
      || enemy.bossPhases !== undefined || isBossKind(enemy.kind)) return 'untameable';
    let stable = p.character.pets ?? freshPetStable();
    if (stable.active) {
      const stabled = stableActivePet(stable);
      if (!stabled) return 'full';
      stable = stabled;
    }
    const pet = createPetRecord(this.nextId++, enemy.kind, enemy.level);
    const adopted = adoptPet(stable, pet);
    if (!adopted) return 'full';
    p.character.pets = adopted;
    enemy.hp = 0; enemy.state = 'dead';
    recordWorldEventKill(this.worldEvents, enemy);
    if (enemy.campId?.startsWith('event:')) syncTrial(this.eventState, this.enemies);
    else {
      const run = currentDungeon(this.expeditions);
      if (run && enemy.campId === run.entrance.id && enemy.campMemberId && run.states[enemy.campMemberId]) run.states[enemy.campMemberId]!.hp = 0;
      const index = this.enemies.indexOf(enemy); if (index >= 0) this.enemies.splice(index, 1);
    }
    this.syncPetAlly();
    this.emit({ type: 'notice', x: enemy.x, y: enemy.y, message: `${pet.name} tamed.` });
    return 'tamed';
  }

  /** Enemy → ally damage path; dead allies are filtered by updateAllies. */
  damageAlly(ally: Ally, amount: number): void {
    if (ally.guard && ally.guard.remaining > 0) amount *= 1 - ally.guard.reduction;
    ally.hp = Math.max(0, ally.hp - Math.max(1, Math.round(amount)));
  }

  /** Instant heal: a fraction of max life (≤1) or flat points (>1). Emits the heal event for VFX/log. */
  playerHeal(amount: number, color?: string): void {
    const p = this.player, before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + (amount <= 1 ? p.maxHp * amount : amount));
    p.healFlash = PLAYER_ABILITIES.potion.flashDuration;
    const healed = p.hp - before;
    if (healed > 0) this.emit({ type: 'heal', x: p.x, y: p.y, value: healed, ...(color ? { color } : {}) });
    if (healed > 0) tryTriggerProc(p, 'onHeal', this.procContext());
    // Healing generates threat on every engaged enemy (WoW healer-aggro rule).
    if (healed > 0) recordHealThreat(this.enemies, healed, p);
  }

  /** Minimal context for self-targeted proc triggers (cast/heal): buffs, events, rolls. */
  private procContext(): ProcContext & { random(): number } {
    return { random: () => this.random(), emit: event => this.emit(event),
      addBuff: (name, color, spec, id) => this.addBuff(name, color, spec, id) };
  }

  /** Skill id behind an action slot; slot 5 is the racial. */
  private skillIdForSlot(slot: number): SkillId | undefined {
    const p = this.player;
    if (slot === RACIAL_SLOT) {
      const raceId = 'raceId' in p.character && isWowRaceId(p.character.raceId) ? p.character.raceId : undefined;
      return raceId ? WOW_RACES[raceId].racial as SkillId : undefined;
    }
    return p.character.skillSlots[slot] ?? undefined;
  }

  /** Shared activation context; sim hooks let recipes drive WoW mechanics without name branches. */
  private skillContext(input: Input): SkillContext {
    const p = this.player;
    return {
      drawStrength: p.skillEffects?.draw?.released ? p.skillEffects.draw.elapsed / UNIQUE_RULES.drawTime : 0,
      allowReturn: this.skillBuffer?.pressed,
      chains: this.chains,
      containers: this.containerContext(),
      availableGroundEffects: GROUND_EFFECT_RULES.maximum - this.groundEffects.length
        - this.projectiles.filter(shot => shot.life > 0 && (shot.effects?.groundDuration || shot.effects?.shatter)).length,
      availableProjectiles: MAX_PROJECTILES - this.projectiles.length,
      player: p, world: this.world, enemies: this.activeTargets(),
      aimX: input.aimX, aimY: input.aimY,
      onScreen: enemy => enemyInCombatViewport(enemy, this.combatViewport),
      damage: (enemy, amount, angle, melee, style, elementalDamage, offense) => this.damageEnemy(enemy, amount, angle, melee, false, style, elementalDamage, offense),
      visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by),
      projectile: (x, y, angle, definition, skill, effects) => this.projectile(x, y, angle, definition, skill, effects),
      schedule: effect => this.scheduleGroundEffect(effect),
      emit: event => this.emit(event),
      time: this.time, sim: this,
    } as SkillContext;
  }

  private invokeSkillSlot(slot: number, input: Input): boolean {
    const p = this.player, id = this.skillIdForSlot(slot);
    if (!id) return false;
    const context = this.skillContext(input);
    context.reportFailures = !this.skillBuffer?.reported;
    if (!activateSkill(context, slot)) {
      if (context.failReported && this.skillBuffer) this.skillBuffer.reported = true;
      return false;
    }
    if (this.pvpCombatants) for (const flight of this.chains) if (!this.chainSources.has(flight)) this.chainSources.set(flight, p);
    tryTriggerProc(p, 'onCast', this.procContext());
    const kind = SKILL_EXECUTION[id]?.kind;
    // Non-damaging control that requires stealth (Sap) is not offensive and keeps stealth.
    if (kind && OFFENSIVE_EXECUTION[kind] && !(kind === 'cc' && SKILL_DEFINITIONS[id]?.requiresStealth)) {
      this.combatUntil = this.time + WOW_COMBAT.rageDecayDelay;
      if (p.targetId != null) p.autoAttack = true;
      if (p.stealthed) { p.stealthed = false; p.buffs = p.buffs?.filter(buff => !buff.stealth); }
    }
    return true;
  }

  /** Re-invoke a skill by id for cast completion and channel ticks. Costs and gates were
   * settled at cast start (prepaid); the recipe executes against the snapshotted target/point. */
  private invokeSkill(id: SkillId, input: Input, cast?: Player['cast']): boolean {
    mountOnOffense(this);
    const p = this.player;
    let slot = p.character.skillSlots.indexOf(id);
    if (slot < 0 && this.skillIdForSlot(RACIAL_SLOT) === id) slot = RACIAL_SLOT;
    if (slot < 0) return false;
    const prevTarget = p.targetId;
    if (cast?.targetId !== undefined) p.targetId = cast.targetId;
    const context = this.skillContext(input);
    context.prepaid = true;
    if (cast && cast.x !== undefined) { context.aimX = cast.x; context.aimY = cast.y!; }
    const ok = activateSkill(context, slot);
    if (ok && (this.pvpCombatants || this.coopRoster)) for (const flight of this.chains) if (!this.chainSources.has(flight)) this.chainSources.set(flight, p);
    p.targetId = prevTarget;
    if (!ok) return false;
    const kind = SKILL_EXECUTION[id]?.kind;
    if (kind && OFFENSIVE_EXECUTION[kind] && !(kind === 'cc' && SKILL_DEFINITIONS[id]?.requiresStealth)) {
      this.combatUntil = this.time + WOW_COMBAT.rageDecayDelay;
      if (p.targetId != null) p.autoAttack = true;
      if (p.stealthed) { p.stealthed = false; p.buffs = p.buffs?.filter(buff => !buff.stealth); }
    }
    return true;
  }

  /** True when every controlled player is dead (a full wipe). Released ghosts
   * still move and act, so they never count as down. */
  private allPlayersDown(): boolean {
    return this.players.every(p => p.dead);
  }

  update(dt: number, input: Input, partnerInput?: Input): void {
    // A net client is a render puppet: it never simulates combat, spawning or
    // world state — it only interpolates toward the host's snapshots.
    if (this.netMode === 'client') { this.netTick(dt); return; }
    const coop = this.coopRoster;
    if (!coop && this.player.dead && !this.pvpCombatants) return;
    if (coop && this.allPlayersDown()) return;
    // A released spirit moves only: no combat, targeting, potions or channels.
    const stripGhost = (player: Player, raw: Input): Input =>
      this.ghosts.has(player) ? { moveX: raw.moveX, moveY: raw.moveY, aimX: raw.aimX, aimY: raw.aimY,
        attack: false, dodge: false, heal: false, skillSlot: null, targetId: null } : raw;
    const inputs: Input[] = coop
      ? coop.map((a, i) => stripGhost(a.player, i === 0 ? input : (partnerInput ?? emptyInput())))
      : [stripGhost(this.player, input)];
    // In a PvP match the player's edges resolve against hostile combatants; its
    // control state lives in the combatant bag, so the swap is required here too.
    if (coop) {
      for (const [i, actor] of coop.entries())
        if (!actor.player.dead) this.withActor(actor.player, actor.control, () => this.applyInputEdges(inputs[i]));
    } else if (this.pvpCombatants && this.pvpPlayer && !this.pvpPlayer.dead)
      this.withActor(this.pvpPlayer, this.pvpPlayer.ai.control, () => this.applyInputEdges(inputs[0]));
    else if (!this.pvpCombatants) this.applyInputEdges(inputs[0]);
    // Bound catch-up after a suspended tab; normal frames always run at 120 Hz.
    this.accumulator += Math.min(dt, 0.25);
    while (this.accumulator + 1e-10 >= FIXED_STEP && (coop ? !this.allPlayersDown() : (!this.player.dead || !!this.pvpCombatants))) {
      this.accumulator -= FIXED_STEP;
      this.step(FIXED_STEP, inputs);
      if (this.portal.ready || this.eventChannel.ready || this.hearthstone.ready) { this.accumulator = 0; break; }
    }
  }

  /** Per-frame input edges: targeting, attack/dodge/heal buffers and the skill
   * press buffer. Runs against whichever actor's control state is swapped in. */
  private applyInputEdges(input: Input): void {
    if (input.targetId !== undefined) this.setTarget(input.targetId);
    if (input.cycleTarget) this.tabTarget(input.cycleTarget);
    if (input.attack) {
      this.attackBuffer = this.time + COMBAT_TIMING.attackBuffer;
      // LMB with a live target toggles auto-attack on; a free-aim press turns it off.
      this.player.autoAttack = !!this.targetEnemy(this.player.targetId);
    }
    if (input.dodge) this.dodgeBuffer = this.time + COMBAT_TIMING.inputBuffer;
    if (this.skillBuffer && this.skillBuffer.until < this.time) this.skillBuffer = null;
    if (input.skillSlot !== null && (input.skillPressed !== false || !this.skillBuffer?.pressed)) {
      const p = this.player, pressed = input.skillPressed !== false;
      // Keep one deliberate press through the action already underway. Held repeats
      // cannot overwrite it or extend its lifetime while waiting on mana/cooldown.
      const recovery = pressed ? Math.max(0, p.castTime, p.cast?.remaining ?? 0, p.dodgeTime, p.dash?.remaining ?? 0,
        (p.gcdReady ?? 0) - this.time, p.attack?.skill ? p.attack.duration - p.attack.elapsed : 0) : 0;
      this.skillBuffer = { slot: input.skillSlot, until: this.time + recovery + COMBAT_TIMING.inputBuffer, pressed,
        ...(pressed ? {} : { reported: this.skillBuffer?.reported }) };
    }
    if (input.heal) this.healBuffer = this.time + COMBAT_TIMING.inputBuffer;
  }

  /** Useful for authored encounters and deterministic headless tests. */
  spawnEnemy(kind: EnemyKind, x: number, y: number, rank: EnemyRank = 'normal', source?: CampSpawnSource, scaling?: EncounterScale): Enemy | null {
    const stats = ENEMY_DEFINITIONS[kind];
    if (this.world.isSanctuary?.(x, y)) return null;
    if (this.world.blocked(x, y, stats.radius)) return null;
    const lootSeed = source?.lootSeed ?? enemyLootSeed(this.options.seed!, ++this.spawnOrdinal, x, y);
    const level = source?.level ?? this.world.dungeonLevel ?? encounterMemberLevel(scaling ?? encounterScaleAt(x, y, this.world.seed ?? this.options.seed!, this.player.level), rank, lootSeed, isBossKind(kind));
    const run=currentDungeon(this.expeditions);
    const rift=run?.entrance.rift;
    const scaled = applyEnemyModifiers(scaledEnemyStats(kind, level, rank),{kind,rank,lootSeed,rift,heroic:run?.entrance.scaling?.heroic===true});
    const biome = this.world.dungeonBiome ?? (this.world.sampleBiome?.(x, y) ?? sampleBiome(x, y)).id;
    const enemy: Enemy = {
      id: this.nextId++, level, rank, biome, lootSeed, ...(rift?{rift}:{}), ...(source?.faction?{faction:source.faction}:{}), ...scaled, dungeonTheme:this.world.dungeonTheme,
      ...(source ? { campId: source.campId, campMemberId: source.memberId } : {}),
      x, y, prevX: x, prevY: y, vx: 0, vy: 0, knockbackX: 0, knockbackY: 0, angle: 0, hp: scaled.maxHp,
      kind, state: 'idle', stateTime: 0, stateDuration: ENCOUNTER_RULES.initialIdleMin + this.random() * ENCOUNTER_RULES.initialIdleRange,
      attackAngle: 0, attackTargetX: x, attackTargetY: y, homeX: x, homeY: y, awareness: 0, lostSightTime: 0,
      lastSeenX: x, lastSeenY: y, senseTime: 0, seesPlayer: false, patrolPhase: (this.nextId * 2.399963) % TAU,
      hitFlash: 0, hitAngle: 0, radius: stats.radius, stagger: 0,
      attackHit: false, interrupted: false,
      slowTime: 0, slowFactor: 1, burnTime: 0, burnDps: 0, burnTick: 0,
    };
    applySpawnTraits(enemy);
    this.enemies.push(enemy);
    this.emit({ type: 'spawn', x, y, enemyKind: kind });
    return enemy;
  }

  private random(): number {
    this.randomState = (this.randomState + 0x6D2B79F5) >>> 0;
    let value = this.randomState;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }

  private step(dt: number, inputs: readonly Input[]): void {
    if (this.coopRoster) { this.stepCoop(dt, inputs); return; }
    let input = inputs[0];
    if(!this.ghost)input=this.groundPickup.input(this.player,this.groundItems,this.world,this.time,dt,input);
    tickRift(this,dt);
    if(currentDungeon(this.expeditions)?.rift?.phase==='failed')return;
    this.capturePositions();
    // Decrement before damage resolves so every new impact gets a full flash.
    this.player.hitFlash = Math.max(0, this.player.hitFlash - dt);
    for (const enemy of this.enemies) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    if (this.pvpCombatants) for (const combatant of this.pvpCombatants) combatant.hitFlash = Math.max(0, combatant.hitFlash - dt);
    this.time += dt; metric(this.player.chronicle,'time',dt);
    const history=this.player.chronicle?.sources.find(s=>s.id===this.player.chronicle?.active);
    if(history)metric(this.player.chronicle,'longestLife',(history.values.time??0)-(history.values.highestDeathTime??0));
    if (input.attack) this.attackBuffer = this.time + COMBAT_TIMING.attackBuffer;
    const beforeX=this.player.x,beforeY=this.player.y;
    if (this.pvpCombatants) this.updateCombatants(dt, input); else this.updatePlayer(dt, input);
    advanceTransport(this, dt);
    metric(this.player.chronicle,'distance',Math.hypot(this.player.x-beforeX,this.player.y-beforeY));
    if(!this.dungeonFloor&&Math.floor(this.time)!==Math.floor(this.time-dt)) metric(this.player.chronicle,'seen:biome:'+sampleBiome(this.player.x,this.player.y,this.options.seed!).id,1);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.advanceChains(dt);
    this.updateGroundEffects(dt);
    this.engagements.update(this.enemies, this.time, event => this.emit(event));
    this.updatePickups(dt);
    if(!this.ghost){
      this.groundGold = advanceGold(this.groundGold, this.player, this.world, dt, event => this.emit(event));
      if (GAME_FEATURES.lootVacuum)
        advanceGroundLoot(this.groundItems, this.player, this.world, this.time, dt,
          index => this.awardGroundItem(index), this.groundPickup.id);
      this.collectSelectedGroundItem();
    }
    syncTrial(this.eventState, this.enemies);
    if (this.player.dead && !this.pvpCombatants) {
      interruptTrial(this.eventState,this.enemies);
      // A death may clear input midway through this tick; freeze its final poses.
      this.travel.returnTo = null; this.portal.cancel(); this.eventChannel.cancel(); this.hearthstone.cancel();
      if (this.player.character.blessing) { delete this.player.character.blessing; refreshCharacter(this.player); }
      tickRift(this,0);
      this.capturePositions();
      return;
    }
    if (!this.ghost) this.eventChannel.advance(dt, this.player, input);
    const blessing = this.player.character.blessing;
    if (blessing && !this.world.isSanctuary?.(this.player.x, this.player.y)) {
      blessing.remaining = Math.max(0, blessing.remaining - dt);
      if (!blessing.remaining) { delete this.player.character.blessing; refreshCharacter(this.player); }
    }
    this.eventTimer -= dt;
    if (!this.dungeonFloor && !this.ghost && this.eventTimer <= 0) {
      this.eventTimer = .5;
      advanceTrial({ state: this.eventState, player: this.player, enemies: this.enemies, world: this.world, view: this.spawnExclusion,
        spawn: (kind, x, y, rank, source) => this.spawnEnemy(kind, x, y, rank, source) });
    }
    if (!this.dungeonFloor && !this.ghost) advanceWorldEvents({ dt, state: this.worldEvents, player: this.player, enemies: this.enemies,
      world: this.world, view: this.spawnExclusion, time: this.time, worldSeed: this.options.seed!,
      playerLevel: this.player.level,
      spawn: (kind, x, y, rank, source) => this.spawnEnemy(kind, x, y, rank, source),
      emit: event => this.emit(event) });
    if (GAME_FEATURES.worldBosses && !this.dungeonFloor && !this.ghost) updateWorldBosses({ state: this.worldBosses, player: this.player, enemies: this.enemies,
      world: this.world, view: this.spawnExclusion, time: this.time, worldSeed: this.options.seed!,
      spawn: (kind, x, y, rank, source) => this.spawnEnemy(kind, x, y, rank, source),
      emit: event => this.emit(event) });
    if (!this.ghost) {
      this.portal.advance(dt, this.player, input);
      this.hearthstone.advance(dt, this.player, input);
      advanceMount(this, dt, input, event => this.emit(event));
      advanceGatherChannel(this, dt, input);
      if (GAME_FEATURES.hearthstone) restedAccrual(this.player, this.world, dt);
    }
    this.questScanTimer -= dt;
    if (!this.ghost && this.questScanTimer <= 0) { this.questScanTimer = 0.5; questExploreScan(this, this.world as QuestWorld); }
    if(this.dungeonFloor) updateDungeon(this,this.spawnExclusion,dt,event=>this.emit(event)); else this.updateSpawns(dt);
    this.retireEnemies(enemy => enemy.state !== 'dead' || enemy.stateTime < ENCOUNTER_RULES.corpseDuration);
    if (!this.dungeonFloor && this.spawnExclusion) this.retireEnemies(enemy =>
      !shouldRetireRoamer(enemy, this.player, this.spawnExclusion!, this.roaming.heading));
  }

  /** Co-op fixed step: identical system ordering to step(), but the per-player
   * segments run once per roster actor inside withActor and shared world systems
   * anchor to the primary player. inputs[i] is actor i's frame input. */
  private stepCoop(dt: number, inputs: readonly Input[]): void {
    const roster = this.coopRoster!;
    tickRift(this, dt);
    if (currentDungeon(this.expeditions)?.rift?.phase === 'failed') return;
    this.capturePositions();
    for (const enemy of this.enemies) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    for (const actor of roster) actor.player.hitFlash = Math.max(0, actor.player.hitFlash - dt);
    this.time += dt;
    for (const actor of roster) {
      metric(actor.player.chronicle, 'time', dt);
      const history = actor.player.chronicle?.sources.find(s => s.id === actor.player.chronicle?.active);
      if (history) metric(actor.player.chronicle, 'longestLife', (history.values.time ?? 0) - (history.values.highestDeathTime ?? 0));
    }
    this.updateCoopActors(dt, inputs);
    advanceTransport(this, dt);
    for (const actor of roster) {
      const p = actor.player;
      metric(p.chronicle, 'distance', Math.hypot(p.x - p.prevX, p.y - p.prevY));
      if (!this.dungeonFloor && Math.floor(this.time) !== Math.floor(this.time - dt))
        metric(p.chronicle, 'seen:biome:' + sampleBiome(p.x, p.y, this.options.seed!).id, 1);
    }
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.advanceChains(dt);
    this.updateGroundEffects(dt);
    this.engagements.update(this.enemies, this.time, event => this.emit(event));
    this.updatePickups(dt);
    for (const actor of roster) {
      const p = actor.player;
      if (p.dead || this.ghosts.has(p)) continue;
      this.groundGold = advanceGold(this.groundGold, p, this.world, dt, event => this.emit(event));
      if (GAME_FEATURES.lootVacuum)
        advanceGroundLoot(this.groundItems, p, this.world, this.time, dt,
          index => this.awardGroundItem(index, p), actor.pickup.id);
      this.collectSelectedGroundItem(p);
    }
    syncTrial(this.eventState, this.enemies);
    if (this.allPlayersDown()) {
      interruptTrial(this.eventState, this.enemies);
      this.travel.returnTo = null; this.portal.cancel(); this.eventChannel.cancel(); this.hearthstone.cancel();
      for (const actor of roster) if (actor.player.character.blessing) { delete actor.player.character.blessing; refreshCharacter(actor.player); }
      tickRift(this, 0);
      this.capturePositions();
      return;
    }
    const primary = roster[0].player;
    for (const actor of roster) {
      const p = actor.player, blessing = p.character.blessing;
      if (blessing && !this.world.isSanctuary?.(p.x, p.y)) {
        blessing.remaining = Math.max(0, blessing.remaining - dt);
        if (!blessing.remaining) { delete p.character.blessing; refreshCharacter(p); }
      }
    }
    this.eventTimer -= dt;
    const anyActive = roster.some(a => !a.player.dead && !this.ghosts.has(a.player));
    if (!this.dungeonFloor && anyActive && this.eventTimer <= 0) {
      this.eventTimer = .5;
      advanceTrial({ state: this.eventState, player: primary, enemies: this.enemies, world: this.world, view: this.spawnExclusion,
        spawn: (kind, x, y, rank, source) => this.spawnEnemy(kind, x, y, rank, source) });
    }
    if (!this.dungeonFloor && anyActive) advanceWorldEvents({ dt, state: this.worldEvents, player: primary, enemies: this.enemies,
      world: this.world, view: this.spawnExclusion, time: this.time, worldSeed: this.options.seed!,
      playerLevel: Math.max(...roster.map(a => a.player.level)),
      spawn: (kind, x, y, rank, source) => this.spawnEnemy(kind, x, y, rank, source),
      emit: event => this.emit(event) });
    if (GAME_FEATURES.worldBosses && !this.dungeonFloor && anyActive) updateWorldBosses({ state: this.worldBosses, player: primary, enemies: this.enemies,
      world: this.world, view: this.spawnExclusion, time: this.time, worldSeed: this.options.seed!,
      spawn: (kind, x, y, rank, source) => this.spawnEnemy(kind, x, y, rank, source),
      emit: event => this.emit(event) });
    for (const [i, actor] of roster.entries()) {
      const p = actor.player;
      if (p.dead || this.ghosts.has(p)) continue;
      this.forPlayer(p, () => {
        this.portal.advance(dt, p, inputs[i]);
        this.hearthstone.advance(dt, p, inputs[i]);
        // Event channels are owner-scoped: advance per-actor so a partner-owned
        // channel progresses (advance early-returns for non-owners).
        this.eventChannel.advance(dt, p, inputs[i]);
        advanceMount(this, dt, inputs[i], event => this.emit(event));
        advanceGatherChannel(this, dt, inputs[i]);
        if (GAME_FEATURES.hearthstone) restedAccrual(p, this.world, dt);
      });
    }
    this.questScanTimer -= dt;
    if (anyActive && this.questScanTimer <= 0) { this.questScanTimer = 0.5; questExploreScan(this, this.world as QuestWorld); }
    if (this.dungeonFloor) updateDungeon(this, this.spawnExclusion, dt, event => this.emit(event)); else this.updateSpawns(dt);
    this.retireEnemies(enemy => enemy.state !== 'dead' || enemy.stateTime < ENCOUNTER_RULES.corpseDuration);
    if (!this.dungeonFloor && this.spawnExclusion) this.retireEnemies(enemy =>
      !roster.some(actor => shouldRetireRoamer(enemy, actor.player, this.spawnExclusion!, this.roaming.heading)));
  }

  /** One fixed step for every co-op actor: each real player consumes its own
   * input through the shared player pipeline with its control bag swapped in. */
  private updateCoopActors(dt: number, inputs: readonly Input[]): void {
    const roster = this.coopRoster!;
    for (const [i, actor] of roster.entries()) {
      const p = actor.player;
      if (p.dead) continue;
      this.withActor(p, actor.control, () => {
        let input = inputs[i];
        if (!this.ghost) input = actor.pickup.input(p, this.groundItems, this.world, this.time, dt, input);
        this.updatePlayer(dt, input);
        this.updateAllies(dt);
      });
    }
  }

  private capturePositions(): void {
    for (const p of this.players) { p.prevX = p.x; p.prevY = p.y; }
    for (const enemy of this.enemies) {
      enemy.prevX = enemy.x;
      enemy.prevY = enemy.y;
    }
    if (this.pvpCombatants) for (const combatant of this.pvpCombatants) {
      combatant.prevX = combatant.x;
      combatant.prevY = combatant.y;
    }
    for (const projectile of this.projectiles) {
      projectile.prevX = projectile.x;
      projectile.prevY = projectile.y;
    }
  }

  private updatePlayer(dt: number, input: Input): void {
    const p = this.player;
    const wowClass = resourceModelOf(p);
    const resourceCap = wowClass && wowClass.resource !== 'mana' ? wowClass.resourceCap : manaCapacity(p);
    if (!this.resourceInitialized) {
      this.resourceInitialized = true;
      if (wowClass && wowClass.resource !== 'mana') p.mana = wowClass.resource === 'energy' ? resourceCap : 0;
    }
    if (this.ghost) { p.autoAttack = false; p.targetId = null; p.cast = null; }
    // PvP combatant control state: stun/freeze/polymorph suppress every action and
    // break casts/swings; silence blocks skills; root blocks movement input.
    const control = isCombatant(p) ? combatantControl(p) : null;
    const cantAct = !!control?.cantAct, rooted = !!control?.rooted, silenced = !!control?.silenced;
    if (cantAct) { p.attack = null; p.cast = null; }
    if (p.targetId != null && !this.targetEnemy(p.targetId)) { p.targetId = null; p.autoAttack = false; p.comboPoints = 0; }
    advanceWowBuffs(p, dt, resourceCap);
    p.locomotionVX = p.locomotionVY = 0;
    let completedAttackTime = 0;
    const channelSlot=(input.heldSkillSlots??(input.skillSlot===null?[]:[input.skillSlot])).find(slot=>p.character.skillSlots[slot]==='whirlwind');
    if(hasUnique(p.character,'dervish-grasp')){
      if(channelSlot!==undefined&&!(this.skillBuffer?.pressed&&this.skillBuffer.until>=this.time))this.skillBuffer={slot:channelSlot,until:this.time+COMBAT_TIMING.inputBuffer};
      else if(channelSlot===undefined&&input.skillSlot===null&&input.heldSkillSlots&&this.skillBuffer&&p.character.skillSlots[this.skillBuffer.slot]==='whirlwind')this.skillBuffer=null;
    }
    this.arrivalProtection = input.attack || input.skillSlot !== null ? 0 : Math.max(0, this.arrivalProtection - dt);
    this.hurtGuard = Math.max(0, this.hurtGuard - dt);
    p.healCooldown = Math.max(0, p.healCooldown - dt);
    p.guardTime = Math.max(0, p.guardTime - dt);
    advanceAffixBuffs(p, dt);
    advanceSkillEffects(p,dt,echo=>{if(this.world.blocked(echo.x,echo.y,echo.definition.radius))return true;const shot=this.projectile(echo.x,echo.y,echo.angle,echo.definition,'ghostHunt',echo.effects);if(shot)delete shot.launch;return !!shot;});
    for (const id of Object.keys(p.skillCooldowns) as SkillId[]) p.skillCooldowns[id] = Math.max(0, p.skillCooldowns[id]! - dt);
    advanceAuras(p,this.activeTargets(),dt,Math.hypot(input.moveX,input.moveY)>.01||!!p.dash||p.dodgeTime>0,
      (ax,ay,bx,by)=>this.lineOfSight(ax,ay,bx,by),
      (e,damage,style)=>this.damageEnemy(e,damage,Math.atan2(e.y-p.y,e.x-p.x),false,true,style,undefined,undefined,false,p),
      (style,radius)=>this.emit({type:'blast',x:p.x,y:p.y,radius,style,skill:'elementalSpikes'}));
    for(const e of this.activeTargets())if(e.auraExposure)for(const [key,exposure] of Object.entries(e.auraExposure))if((exposure.remaining-=dt)<=0)delete e.auraExposure[key as keyof typeof e.auraExposure];
    p.healFlash = Math.max(0, p.healFlash - dt);
    if (!wowClass || wowClass.resource === 'mana') {
      metric(p.chronicle,'manaRestored',Math.min(resourceCap-p.mana,p.derived.manaRegeneration*dt));
      metric(p.chronicle,'manaRecovery:passive',Math.min(resourceCap-p.mana,p.derived.manaRegeneration*dt));
      p.mana = Math.min(resourceCap, p.mana + p.derived.manaRegeneration * dt);
    } else if (wowClass.resource === 'energy') {
      p.mana = Math.min(resourceCap, p.mana + wowClass.resourceRegen * dt);
    } else if (wowClass.resourceDecay > 0 && this.time >= this.combatUntil) {
      p.mana = Math.max(0, p.mana - wowClass.resourceDecay * dt);
    }
    metric(p.chronicle,'healing',Math.min(p.maxHp-p.hp,p.derived.lifeRegeneration*dt));
    p.hp = Math.min(p.maxHp, p.hp + p.derived.lifeRegeneration * dt);
    if (p.dodgeCharges < PLAYER_ABILITIES.dodge.charges) {
      p.dodgeRecharge += dt / p.derived.cooldownMultiplier;
      if (p.dodgeRecharge + 1e-9 >= PLAYER_ABILITIES.dodge.recharge) {
        p.dodgeCharges++;
        p.dodgeRecharge -= PLAYER_ABILITIES.dodge.recharge;
        if (p.dodgeCharges === PLAYER_ABILITIES.dodge.charges) p.dodgeRecharge = 0;
      }
    }
    const aimingSkill = this.skillBuffer && this.skillBuffer.until >= this.time ? p.character.skillSlots[this.skillBuffer.slot] : null;
    const aimingWeapon = aimingSkill ? skillWeapon(aimingSkill, p.equipment) ?? basicAttackWeapon(p) : basicAttackWeapon(p);
    const direction = aimingSkill !== 'sidestep' && aimingWeapon.attackKind !== 'melee' && input.rangedAim
      && Number.isFinite(input.rangedAim.x) && Number.isFinite(input.rangedAim.y) ? input.rangedAim : { x: input.aimX, y: input.aimY };
    if (direction.x !== p.x || direction.y !== p.y) p.angle = Math.atan2(direction.y - p.y, direction.x - p.x);
    // Targeted casts and auto-attack keep the player squared on the target.
    const faceTarget = this.targetEnemy(p.cast?.targetId ?? (p.autoAttack ? p.targetId : null));
    if (faceTarget) p.angle = Math.atan2(faceTarget.y - p.y, faceTarget.x - p.x);
    if (!cantAct && this.healBuffer >= this.time && p.flasks > 0 && (p.hp < p.maxHp || p.mana < manaCapacity(p)) && p.healCooldown <= 0) {
      const healed = Math.min(p.maxHp * PLAYER_ABILITIES.potion.lifeFraction * p.derived.potionMultiplier, p.maxHp - p.hp);
      const mana = Math.min(p.maxMana * PLAYER_ABILITIES.potion.manaFraction * p.derived.potionMultiplier, manaCapacity(p) - p.mana);
      p.hp += healed; p.mana += mana;
      p.flasks--;
      p.healCooldown = PLAYER_ABILITIES.potion.cooldown * p.derived.cooldownMultiplier;
      p.healFlash = PLAYER_ABILITIES.potion.flashDuration;
      this.healBuffer = -1;
      this.emit({ type: 'potion', x: p.x, y: p.y, life: healed, mana, color: '#a9bfea' });
    }

    if (p.attack) {
      const previousElapsed = p.attack.elapsed;
      // Let aim corrections steer anticipation, then lock the actual contact arc.
      if (p.attack.elapsed < p.attack.activeStart) p.attack.angle = p.angle;
      p.attack.elapsed += dt;
      if(!p.attack.skill&&!p.attack.embersReleased&&p.attack.elapsed>=p.attack.activeStart){
        p.attack.embersReleased=true;
        releaseStoredEmbers(p,MAX_PROJECTILES-this.projectiles.length-Number(p.attack.kind==='ranged'),
          GROUND_EFFECT_RULES.maximum-this.groundEffects.length-this.projectiles.filter(s=>s.life>0&&(s.effects?.groundDuration||s.effects?.shatter)).length,
          stored=>this.projectile(p.x,p.y,p.attack!.angle+stored.offset,stored.definition,'fireball',stored.effects,stored.sourceLevel));
      }
      if (p.attack.kind === 'melee' && p.attack.elapsed >= p.attack.activeStart && previousElapsed < p.attack.activeEnd) this.resolveMelee(p.attack, previousElapsed);
      if (p.attack.kind === 'ranged' && !p.attack.released && p.attack.elapsed >= p.attack.activeStart) {
        const attack = p.attack, style = attack.projectile?.style ?? 'arrow';
        const speed = style === 'arrow' ? 560 : 380;
        const shot = this.projectile(p.x, p.y, attack.angle,
          { owner: 'player', damage: attack.damage, speed, life: attack.range / speed, radius: style === 'arrow' ? 2 : 5 },
          undefined, attack.projectile);
        if (shot) shot.launch = {
          weapon: { ...attack.weapon.visual }, mainWeapon: { ...p.equipment.mainHand.visual }, hand: attack.hand, hands: attack.weapon.hands, facing: attack.angle, time: this.time,
          gaitPhase: p.walkTime, moving: Math.min(1, Math.hypot(p.vx, p.vy) / 130), moveAngle: Math.atan2(p.vy, p.vx),
          start: attack.activeStart / attack.duration, end: attack.activeEnd / attack.duration, raceId: p.character.raceId,
        };
        if(shot&&style==='arrow'&&attack.projectile)queueSkillEcho(p,p.x,p.y,attack.angle,{owner:'player',damage:attack.damage,speed,life:attack.range/speed,radius:2},attack.projectile,{x:input.aimX,y:input.aimY});
        attack.released = true;
        this.emit({ type: 'cast', x: p.x, y: p.y, angle: attack.angle, style, ...(shot?.launch ? { launch: shot.launch } : {}) });
      }
      if (p.attack.elapsed + 1e-9 >= p.attack.duration) {
        // Carry sub-tick recovery time so repeated swings keep the derived rate.
        completedAttackTime = Math.max(0, p.attack.elapsed - p.attack.duration);
        p.attack = null;
      }
    }
    p.castTime = Math.max(0, p.castTime - dt);
    if (!p.attack && !p.dash && p.castTime <= 0) p.activeSkill = null;

    const canCancel = (!p.attack || p.attack.elapsed >= p.attack.activeEnd) && p.castTime <= (p.castDuration * SKILL_CAST_MOTION.releaseRemainingFraction);
      mountOnOffense(this);
    if (!cantAct && this.dodgeBuffer >= this.time && p.dodgeTime <= 0 && p.dodgeCharges > 0 && canCancel) {
      const moving = Math.hypot(input.moveX, input.moveY) > 0.01;
      p.dodgeAngle = moving ? Math.atan2(input.moveY, input.moveX) : p.angle;
      p.dodgeTime = PLAYER_ABILITIES.dodge.duration;
      p.dodgeCharges--;
      if(p.skillEffects?.draw){delete p.skillEffects.draw;this.skillBuffer=null;}
      p.attack = null;
      p.dash = null;
      p.castTime = 0;
      p.cast = null;
      this.dodgeBuffer = -1;
      this.emit({ type: 'dodge', x: p.x, y: p.y, angle: p.dodgeAngle });
    }

    // Holding draws the bow without paying or firing. Release commits one normal skill action.
    const heldDraw=(input.heldSkillSlots??(input.skillSlot===null?[]:[input.skillSlot])).find(slot=>p.character.skillSlots[slot]==='piercingShot');
    if(this.blockedDrawSlot!==null&&heldDraw!==this.blockedDrawSlot)this.blockedDrawSlot=null;
    let draw=p.skillEffects?.draw;
    if(draw&&(input.attack||input.dodge||p.dodgeTime>0||(input.skillSlot!==null&&input.skillSlot!==draw.slot))){
      const switchedSkill=input.skillSlot!==null&&input.skillSlot!==draw.slot;
      delete p.skillEffects!.draw;if(switchedSkill)this.blockedDrawSlot=draw.slot;else this.skillBuffer=null;draw=undefined;
    }
    if(!draw&&heldDraw!==undefined&&heldDraw!==this.blockedDrawSlot&&!input.attack&&!input.dodge&&p.dodgeTime<=0&&!p.attack&&!p.dash&&p.castTime<=0
      &&hasUnique(p.character,'heartwood-draw')&&canUseSkill('piercingShot',p.equipment)&&p.character.allocatedNodes.includes('skill:piercingShot')
      &&(p.skillCooldowns.piercingShot??0)<=0&&p.mana>=resolvePlayerSkill('piercingShot',p).mana){
      draw=(p.skillEffects??={echoes:[]}).draw={slot:heldDraw,elapsed:0,remaining:COMBAT_TIMING.inputBuffer};
    }
    if(draw){
      if(heldDraw===draw.slot&&!draw.released){draw.elapsed=Math.min(UNIQUE_RULES.drawTime,draw.elapsed+dt);this.skillBuffer=null;}
      else {
        if(!draw.released){draw.released=true;this.skillBuffer={slot:draw.slot,until:this.time+draw.remaining,pressed:true};}
        draw.remaining-=dt;
        if(draw.remaining<=0){delete p.skillEffects!.draw;this.skillBuffer=null;}
      }
    }

    // WoW cast/channel clock: the recipe fires on completion, channel ticks re-invoke per interval.
    if (p.cast) {
      const cast = p.cast;
      const castTarget = cast.targetId !== undefined ? this.targetEnemy(cast.targetId) : undefined;
      if ((cast.targetId !== undefined && !castTarget)
        || (castTarget && cast.breakRange !== undefined
          && Math.hypot(castTarget.x - p.x, castTarget.y - p.y) > cast.breakRange)) p.cast = null;
      else {
        cast.remaining = Math.max(0, cast.remaining - dt);
        if (cast.channel) {
          const ticks = Math.max(1, SKILL_DEFINITIONS[cast.skill]?.channel?.ticks ?? 1);
          const interval = cast.duration / ticks;
          const due = Math.min(ticks, Math.floor((cast.duration - cast.remaining + 1e-9) / interval));
          while ((cast.ticksDone ?? 0) < due) {
            cast.ticksDone = (cast.ticksDone ?? 0) + 1;
            if (!this.invokeSkill(cast.skill, input, cast)) { cast.remaining = 0; break; }
          }
          if (cast.remaining <= 0) p.cast = null;
        } else if (cast.remaining <= 1e-9) {
          p.cast = null;
          this.invokeSkill(cast.skill, input, cast);
        }
      }
    }


    if (!cantAct && !silenced && this.skillBuffer && this.skillBuffer.until >= this.time && this.invokeSkillSlot(this.skillBuffer.slot, input)) {
      this.skillBuffer = null; if(p.skillEffects)delete p.skillEffects.draw;
    }

    if (!cantAct && p.dodgeTime <= 0 && p.castTime <= 0 && !p.cast && !p.dash && !p.skillEffects?.draw && this.attackBuffer >= this.time && !p.attack) {
      this.startAttack(completedAttackTime);
      this.attackBuffer = -1;
    }

    // Auto-attack repeats the basic swing on the current target inside weapon reach.
    if (!cantAct && p.autoAttack && p.targetId != null && !p.attack && !p.dash && !p.cast && p.dodgeTime <= 0 && p.castTime <= 0) {
      const target = this.targetEnemy(p.targetId);
      if (target) {
        p.angle = Math.atan2(target.y - p.y, target.x - p.x);
        const reach = deriveAttackStats(p.stats, basicAttackWeapon(p)).range + target.radius;
        if (Math.hypot(target.x - p.x, target.y - p.y) <= reach && this.lineOfSight(p.x, p.y, target.x, target.y)) this.startAttack(completedAttackTime);
      }
    }

    let targetVX = 0;
    let targetVY = 0;
    const movementX = p.x, movementY = p.y;
    const walking = !rooted && !p.dash && p.dodgeTime <= 0 && Math.hypot(input.moveX, input.moveY) > .01;
    if (p.dash) {
      const dash = p.dash, startX = p.x, startY = p.y, delta = Math.min(dt, dash.remaining);
      const steps = Math.max(1, Math.ceil(dash.speed * delta / 4));
      for (let i = 0; i < steps; i++) {
        const to = this.world.move(p.x, p.y, Math.cos(dash.angle) * dash.speed * delta / steps,
          Math.sin(dash.angle) * dash.speed * delta / steps, p.radius);
        p.x = to.x; p.y = to.y;
      }
      for (const enemy of this.activeTargets()) if (dash.damage > 0 && enemy.state !== 'dead' && !dash.hitIds.has(enemy.id)
        && segmentDistanceSquared(enemy.x, enemy.y, startX, startY, p.x, p.y) <= (enemy.radius + dash.radius) ** 2
        && this.lineOfSight(p.x, p.y, enemy.x, enemy.y)) {
        dash.hitIds.add(enemy.id); this.damageEnemy(enemy, dash.damage, dash.angle, true, false, dash.style, dash.elementalDamage, dash.offense);
        if (dash.stun) applyStun(enemy, dash.stun);
      }
      if(dash.damage>0)strikeContainerSegment(this.containerContext(), startX, startY, p.x, p.y, dash.radius + p.radius);
      dash.remaining = Math.max(0, dash.remaining - dt);
      p.walkTime += Math.hypot(p.x - startX, p.y - startY) / PLAYER_MOVEMENT.gaitDistance;
      p.vx = p.vy = 0;
      if (dash.remaining <= 0) p.dash = null;
    } else if (p.dodgeTime > 0) {
      p.vx = Math.cos(p.dodgeAngle) * PLAYER_ABILITIES.dodge.speed;
      p.vy = Math.sin(p.dodgeAngle) * PLAYER_ABILITIES.dodge.speed;
      p.dodgeTime = Math.max(0, p.dodgeTime - dt);
    } else {
      const length = Math.hypot(input.moveX, input.moveY);
      const factor = (p.activeSkill==='bulwark'&&hasUnique(p.character,'patient-bastion') ? 1 : p.attack?.skill==='whirlwind'&&hasUnique(p.character,'dervish-grasp') ? 1 : p.attack
        ? p.attack.elapsed < p.attack.activeStart ? PLAYER_MOVEMENT.attackMultiplier.windup
          : p.attack.elapsed < p.attack.activeEnd ? PLAYER_MOVEMENT.attackMultiplier.active : PLAYER_MOVEMENT.attackMultiplier.recovery
        : p.cast ? WOW_COMBAT.castMoveFactor : p.castTime > 0 ? PLAYER_MOVEMENT.castMultiplier : 1)
        * (this.ghost ? GHOST_RULES.moveSpeed : 1) * (control?.moveFactor ?? 1);
      if (length > 0) {
        targetVX = input.moveX / Math.max(1, length) * PLAYER_MOVEMENT.speed * p.derived.moveSpeedMultiplier * factor * mountSpeedFactor(p);
        targetVY = input.moveY / Math.max(1, length) * PLAYER_MOVEMENT.speed * p.derived.moveSpeedMultiplier * factor * mountSpeedFactor(p);
      }
      const reversing = p.vx * targetVX + p.vy * targetVY < 0;
      const responseTime = length === 0 ? PLAYER_MOVEMENT.response.stop
        : reversing ? PLAYER_MOVEMENT.response.reverse : PLAYER_MOVEMENT.response.accelerate;
      const easing = 1 - Math.exp(-dt / responseTime);
      p.vx += (targetVX - p.vx) * easing;
      p.vy += (targetVY - p.vy) * easing;
      if (length === 0 && Math.hypot(p.vx, p.vy) < PLAYER_MOVEMENT.stopThreshold) p.vx = p.vy = 0;
    }
    if (!walking) this.playerMovement.clear();
    const destination = walking
      ? this.playerMovement.move(this.world, p.x, p.y, p.vx * dt, p.vy * dt, p.radius, this.time)
      : this.world.move(p.x, p.y, p.vx * dt, p.vy * dt, p.radius);
    p.walkTime += Math.hypot(destination.x - p.x, destination.y - p.y) / PLAYER_MOVEMENT.gaitDistance;
    p.locomotionVX = (destination.x - movementX) / dt;
    p.locomotionVY = (destination.y - movementY) / dt;
    p.x = destination.x;
    p.y = destination.y;
    const dodgeElapsed = PLAYER_ABILITIES.dodge.duration - p.dodgeTime;
    p.invulnerable = Math.max(this.hurtGuard, this.arrivalProtection,
      p.dodgeTime > 0 && dodgeElapsed >= PLAYER_ABILITIES.dodge.invulnerabilityStart && dodgeElapsed < PLAYER_ABILITIES.dodge.invulnerabilityEnd
        ? PLAYER_ABILITIES.dodge.invulnerabilityEnd - dodgeElapsed : 0);
    if (this.ghost) p.invulnerable = Math.max(p.invulnerable, 1e9);
  }

  private startAttack(elapsed = 0): void {
    mountOnOffense(this);
    const p = this.player, off = p.equipment.offHand;
    p.cast = null;
    const dual = alternatesBasicAttacks(p.equipment);
    const hand = dual ? p.nextAttackHand : 'main';
    const weapon = hand === 'off' && off?.kind === 'weapon' ? off.weapon : p.equipment.mainHand;
    const manaCost = resourceModelOf(p)?.resource !== 'mana' && resourceModelOf(p) ? 0 : basicAttackManaCost(weapon, p.derived);
    if (p.mana < manaCost) {
      this.emit({ type: 'insufficient-mana', x: p.x, y: p.y });
      return;
    }
    p.mana -= manaCost; metric(p.chronicle,'manaSpent',manaCost);metric(p.chronicle,'basics');
    const stats = deriveAttackStats(p.stats, weapon);
    const weave = consumeRally(p,weapon.attackKind==='melee') * consumeSpellweave(p, weapon.attackKind === 'melee' ? 'melee' : weapon.attackKind === 'bolt' ? 'spell' : 'other');
    const duration = 1 / stats.attacksPerSecond;
    const ranged = weapon.attackKind !== 'melee';
    // Weapon imbues (seals, poisons, shaman imbues) add a fraction of the swing's
    // damage as elemental damage on melee and bolt basics; arrows carry no imbue.
    // The strongest active imbue's element styles the hit when it outweighs the
    // weapon's own elemental portion.
    let imbueDamage = 0, imbueFraction = 0, imbueStyle: ProjectileStyle | undefined;
    if (weapon.attackKind !== 'arrow') for (const buff of p.buffs ?? []) {
      if (!buff.imbue || buff.remaining <= 0) continue;
      imbueDamage += stats.damage * weave * buff.imbue.fraction;
      if (buff.imbue.fraction > imbueFraction) { imbueFraction = buff.imbue.fraction; imbueStyle = buff.imbue.element; }
    }
    const imbueDominant = imbueStyle !== undefined && imbueDamage >= stats.elementalDamage * weave;
    const style: ProjectileStyle = imbueDominant ? imbueStyle! : basicProjectileStyle(weapon);
    this.player.attack = {
      kind: ranged ? 'ranged' : 'melee', weapon, hand,
      elapsed, duration, activeStart: duration * (ranged ? RANGED_BASIC_ATTACK_PHASES.activeStart : BASIC_ATTACK_PHASES.activeStart),
      activeEnd: duration * (ranged ? RANGED_BASIC_ATTACK_PHASES.activeEnd : BASIC_ATTACK_PHASES.activeEnd), angle: this.player.angle,
      range: stats.range, arc: stats.arc, damage: stats.damage * weave + imbueDamage + consumeBastion(p,stats.damage,weapon.attackKind==='melee'), elementalDamage: stats.elementalDamage * weave + imbueDamage, hitIds: new Set<number>(),
      offense: snapshotSkillOffense(p),
      ...(imbueDominant ? { style: imbueStyle } : {}),
      ...(ranged ? { projectile: { style, pierce: p.derived.projectilePierce, offense: snapshotSkillOffense(p), ...(imbueDamage > 0 ? { elementalDamage: stats.elementalDamage * weave + imbueDamage } : {}) } } : {}),
    };
    p.nextAttackHand = hand === 'main' ? 'off' : 'main';
    if (!ranged) this.emit({ type: 'swing', x: p.x, y: p.y, angle: p.angle });
  }

  private resolveMelee(attack: Attack, previousElapsed: number): void {
    const p = this.player;
    const activeDuration = attack.activeEnd - attack.activeStart;
    const before = getActiveSwingOffset((previousElapsed - attack.activeStart) / activeDuration, attack.arc, attack.hand);
    const after = getActiveSwingOffset((attack.elapsed - attack.activeStart) / activeDuration, attack.arc, attack.hand);
    const from = Math.max(-attack.arc / 2, Math.min(before, after) - PLAYER_ABILITIES.basicAttack.bladeHalfAngle);
    const to = Math.min(attack.arc / 2, Math.max(before, after) + PLAYER_ABILITIES.basicAttack.bladeHalfAngle);
    const angle = attack.angle + (from + to) / 2;
    strikeContainers(this.containerContext(), p.x, p.y, attack.range, angle, to - from);
    for (const enemy of this.activeTargets()) {
      if (enemy.state === 'dead' || attack.hitIds.has(enemy.id)) continue;
      if (!circleIntersectsSector(enemy.x, enemy.y, enemy.radius, p.x, p.y, angle, attack.range, to - from)) continue;
      if (!this.lineOfSight(p.x, p.y, enemy.x, enemy.y)) continue;
      attack.hitIds.add(enemy.id);
      this.damageEnemy(enemy, attack.damage, Math.atan2(enemy.y - p.y, enemy.x - p.x), true, false, attack.style ?? weaponImpactStyle(attack.weapon), attack.elementalDamage ?? 0, attack.offense);
    }
    // One solid-surface response per swing; scenery impact never changes its collision.
    if (!attack.surfaceHit && this.world.impactMaterial) for (let reach = p.radius + 4; reach <= attack.range; reach += 4) {
      const x = p.x + Math.cos(angle) * reach, y = p.y + Math.sin(angle) * reach;
      if (!this.world.blocked(x, y, 2)) continue;
      attack.surfaceHit = true;
      this.emit({ type: 'surface-hit', x, y, angle, material: this.world.impactMaterial(x, y, 2) });
      break;
    }
  }

  private lineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
    return hasLineOfSight(this.world, ax, ay, bx, by);
  }

  private damageEnemy(enemy: Enemy, damage: number, angle: number, melee: boolean, periodic = false, style?: ProjectileStyle, elementalDamage?: number, offense?: HitSnapshot, authoredBurn = false, source?: Player): void {
    const attacker = source ?? this.player;
    // PvP combatants take the player-shaped damage path: armor/resist/absorb/block.
    if (isCombatant(enemy)) {
      const damageType = elementalDamage !== undefined && elementalDamage > 0 ? projectileDamageType(style ?? 'arcane') : style ? projectileDamageType(style) : 'physical';
      this.damageCombatant(enemy, damage + (elementalDamage ?? 0), angle, attacker.level, damageType, periodic, style, attacker, undefined, melee);
      return;
    }
    // Friendly faction actors are unattackable (world-t05): no damage, no aggro.
    if (!playerCanAttack(enemy, attacker)) return;
    this.bumpCombat(attacker);
    if (!periodic && !offense?.ally) durabilityLoss(attacker, 'strike', this.time);
    damageEnemy(enemy, damage, angle, melee, {
      player: attacker, enemies: this.hostileTargets(attacker), random: () => this.random(),
      visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by), emit: event => this.emit(event),
      projectile: (x, y, shotAngle, definition, effects) => this.projectile(x, y, shotAngle, definition, undefined, effects),
      proc: (player, enemy, context) => tryProc(player, enemy, context),
      killed: actor => {
        riftKill(this,actor);
        completeBossLair(actor, this.eventState);
        const reward = awardKillRewards(actor, this.kills, this.killRecharge, {
          suppressDrops: !!currentDungeon(this.expeditions)?.rift,
          player: this.player, groundGold: this.groundGold, groundItems: this.groundItems, pickups: this.pickups,
          world: this.world, time: this.time, enemies: this.enemies,
          nextId: () => this.nextId++, emit: event => this.emit(event),
        });
        this.kills = reward.kills; this.killRecharge = reward.recharge;
        questOnKill(this, actor.kind, () => this.random());
        repOnKill(this, { kind: actor.kind, biome: actor.biome, rank: actor.rank, dungeonTheme: this.dungeonFloor?.theme });
        worldEventOnKill(this, actor);
        this.pendingAchievements.push(...worldBossOnKill(actor, { ledger: this.worldBosses, player: this.player, enemies: this.enemies, world: this.world, time: this.time, now: Date.now(), groundItems: this.groundItems, groundGold: this.groundGold, nextId: () => this.nextId++, emit: e => this.emit(e) }));
        const emblems = awardHeroicBossEmblems(this.expeditions, actor, this.player.character);
        if (emblems) this.emit({ type: 'notice', x: actor.x, y: actor.y, message: `+${emblems} Emblem${emblems > 1 ? 's' : ''} of Heroism` });
        if (actor.campMemberId === 'warden' && this.expeditions.location)
          repOnDungeonClear(this, { id: this.expeditions.location, theme: this.dungeonFloor?.theme });
        if (wowClassOf(attacker.character)?.id === 'warlock')
          attacker.soulShards = Math.min(WOW_COMBAT.maxSoulShards, (attacker.soulShards ?? 0) + 1);
      },
    }, periodic, style, elementalDamage, offense, authoredBurn);
  }

  /** One fixed step for every living combatant: the real player consumes the
   * frame input, NPCs get a synthesized Input from their class AI. Each turn runs
   * the shared player pipeline with that combatant's control state swapped in. */
  private updateCombatants(dt: number, input: Input): void {
    const roster = this.pvpCombatants!;
    for (const combatant of roster) {
      if (combatant.dead) { combatant.stateTime += dt; continue; }
      combatant.stateTime += dt;
      this.withActor(combatant, combatant.ai.control, () => {
        const control = advanceCombatantStatuses(combatant, dt,
          (target, amount, damageType) => void this.damageCombatant(target, amount, 0, target.level, damageType, true, undefined, combatant));
        if (combatant.dead) return;
        const raw = combatant === this.pvpPlayer ? { ...input }
          : decideCombatantInput({ self: combatant, allies: roster.filter(o => o.team === combatant.team && !o.dead),
              hostiles: roster.filter(o => o.team !== combatant.team && !o.dead), time: this.time });
        const sanitized = sanitizeCombatantInput(combatant, raw, control);
        if (combatant !== this.pvpPlayer) this.applyInputEdges(sanitized);
        this.updatePlayer(dt, sanitized);
        this.updateAllies(dt);
      });
    }
  }

  /** Chain lightning partitioned per owning combatant so jumps only pick
   * hostiles of the caster's team. Outside PvP it is a single pass. */
  private advanceChains(dt: number): void {
    if (!this.pvpCombatants && !this.coopRoster) {
      advanceChains(this.chains, dt, {
        player: this.player, enemies: this.enemies,
        onScreen: enemy => enemyInCombatViewport(enemy, this.combatViewport),
        visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by),
        damage: (enemy, amount, angle, melee, style, elementalDamage, offense) => this.damageEnemy(enemy, amount, angle, melee, false, style, elementalDamage, offense),
        emit: event => this.emit(event),
      });
      return;
    }
    const bySource = new Map<Player, ChainFlight[]>();
    for (const flight of this.chains) {
      const source = this.chainSources.get(flight) ?? this.player;
      const list = bySource.get(source) ?? [];
      if (!list.length) bySource.set(source, list);
      list.push(flight);
    }
    const kept: ChainFlight[] = [];
    for (const [source, flights] of bySource) {
      advanceChains(flights, dt, {
        player: source, enemies: this.hostileTargets(source),
        onScreen: enemy => enemyInCombatViewport(enemy, this.combatViewport),
        visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by),
        damage: (enemy, amount, angle, melee, style, elementalDamage, offense) => this.forPlayer(source, () => this.damageEnemy(enemy, amount, angle, melee, false, style, elementalDamage, offense, false, source)),
        emit: event => this.emit(event),
      });
      kept.push(...flights);
    }
    this.chains = kept;
    for (const flight of this.chainSources.keys()) if (!kept.includes(flight)) this.chainSources.delete(flight);
  }

  private enemyNeighbors=new EnemyNeighbors();
  private riftTactics=new RiftTactics();
  /** Persistent AI context; mutable fields are restamped each tick. */
  private enemyContext: EnemyAIContext | null = null;
  /** In-place filter: compacts a live list without allocating a new array
   * each tick (the old `filter` reassignment churned one array per step). */
  private compactList<T>(list: T[], keep: (item: T) => boolean): void {
    let write = 0;
    for (let read = 0; read < list.length; read++)
      if (keep(list[read])) list[write++] = list[read];
    list.length = write;
  }
  private retireEnemies(keep: (enemy: Enemy) => boolean): void {
    this.compactList(this.enemies, keep);
  }

  private updateEnemies(dt: number): void {
    this.enemyNeighbors.rebuild(this.enemies);
    updateWarbands(this.enemies, this.player, this.world, dt);
    const p = this.player;
    const trial = this.eventState.trial && !this.dungeonFloor ? this.eventState.sites[this.eventState.trial.siteId] : null;
    // One persistent context: the closures capture `this` once and the mutable
    // fields are restamped each tick instead of allocating ~15 closures/tick.
    const context = this.enemyContext ??= {
      player: p, players: this.players, enemies: this.enemies, world: this.world, time: this.time,
      allies: p.allies ?? [],
      hurtAlly: (ally: Ally, amount: number) => this.damageAlly(ally, amount),
      neighbors:(enemy,padding)=>this.enemyNeighbors.around(enemy,padding),
      hurtDecoy:(id,amount,victim)=>{hurtDecoy(victim??this.player,id,amount);},
      trial: null,
      visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by),
      move: (actor, vx, vy, delta) => this.moveEnemy(actor, vx, vy, delta),
      hurt: (amount, angle, actor, damageType, victim) => this.forPlayer(victim ?? this.player, () => this.takeDamage(amount, angle, actor.level, damageType, actor.kind, enemyDisplayName(actor), damageType === 'physical', actor)),
      shoot: (actor, angle, definition, effects) => this.projectile(actor.x, actor.y, angle,
        definition, undefined, effects, actor.level, actor.kind, enemyDisplayName(actor), actor.id),
      emit: event => this.emit(event),
      dropGold: actor => dropGold(this.groundGold, { id: this.nextId++, x: actor.x, y: actor.y,
        amount: TREASURE_GOBLIN.goldBase + TREASURE_GOBLIN.goldPerLevel * actor.level, age: 0 }),
      addBuff: (name, color, spec, id, victim) => this.addBuffTo(victim ?? this.player, name, color, spec, id),
    } as EnemyAIContext;
    context.player = p; context.players = this.players; context.enemies = this.enemies;
    context.world = this.world; context.time = this.time; context.allies = p.allies ?? [];
    context.trial = trial ? { campId: `event:${trial.id}`, x: trial.x, y: trial.y, radius: EVENT_RULES.trialRadius } : worldEventTrialContext(this.worldEvents);
    this.riftTactics.tick(context,dt,currentDungeon(this.expeditions)?.rift?.phase==='hunt');
    for (const enemy of this.enemies) {
      if (isCombatant(enemy)) continue;
      this.updateKnockback(enemy, dt);
      enemy.stateTime += dt;
      if (enemy.state === 'dead') continue;
      enemy.rallyTime=Math.max(0,(enemy.rallyTime??0)-dt);
      if (!advanceEnemyStatuses(enemy, dt,
        (actor, amount, school) => this.damageEnemy(actor, amount, 0, false, true, schoolProjectileStyle(school ?? 'fire')))) continue;
      if(isWorldBossActor(enemy)) updateWorldBoss(enemy,dt,context); else if(isRaid7Boss(enemy)) updateRaid7Boss(enemy,dt,context); else if(isRaid8Boss(enemy)) updateRaid8Boss(enemy,dt,context); else if(isRaid9Boss(enemy)) updateRaid9Boss(enemy,dt,context); else if(isRaid5Boss(enemy)) updateRaid5Boss(enemy,dt,context); else if(isRaid6Boss(enemy)) updateRaid6Boss(enemy,dt,context); else if(isRaid4Boss(enemy)) updateRaid4Boss(enemy,dt,context); else if(isRaid3Boss(enemy)) updateRaid3Boss(enemy,dt,context); else if(isRaid2Boss(enemy)) updateRaid2Boss(enemy,dt,context); else if(isRaidBoss(enemy)) updateRaidBoss(enemy,dt,context); else if(isWildernessBoss(enemy.kind)) updateWildernessBoss(enemy,dt,context); else if(enemy.kind==='warden') updateWarden(enemy,dt,context); else updateEnemyAI(enemy, dt, context);
      this.enemyNeighbors.update(enemy);
      if (this.players.every(pl => pl.dead)) break;
    }
    for (const enemy of this.enemies) {
      enemy.vx = (enemy.x - enemy.prevX) / dt;
      enemy.vy = (enemy.y - enemy.prevY) / dt;
    }
    // Co-op ticks each actor's allies inside updateCoopActors; only solo/PvP
    // needs the shared tail pass (which would double-tick P1's allies).
    if (!this.pvpCombatants && !this.coopRoster) this.updateAllies(dt);
  }

  private updateKnockback(enemy: Enemy, dt: number): void {
    if (enemy.knockbackX === 0 && enemy.knockbackY === 0) return;
    const decay = Math.exp(-dt / COMBAT_TIMING.knockbackDecay);
    // Integrating the exponential preserves the old shove distance across ticks.
    const travel = COMBAT_TIMING.knockbackDecay * (1 - decay);
    let destination = this.world.move(enemy.x, enemy.y, enemy.knockbackX * travel, enemy.knockbackY * travel, enemy.radius);
    if (this.world.isSanctuary?.(destination.x, destination.y)
      && !this.world.isSanctuary(enemy.x, enemy.y)) destination = { x: enemy.x, y: enemy.y };
    enemy.x = destination.x;
    enemy.y = destination.y;
    enemy.knockbackX *= decay;
    enemy.knockbackY *= decay;
    if (Math.hypot(enemy.knockbackX, enemy.knockbackY) < 0.4) enemy.knockbackX = enemy.knockbackY = 0;
  }

  /** Ally AI: follow inside the leash, strike the player's target or the nearest aware enemy, tick totem auras.
   * Pet allies (petId) obey the hunter's petCommand: attack uses the player's target, follow returns
   * to the player, stay holds position, passive never engages. Pets and demons auto-cast their
   * learned PET_SKILLS on cooldown. */
  private updateAllies(dt: number): void {
    const p = this.player, allies = p.allies;
    if (!allies?.length) return;
    for (const ally of allies) {
      const template = ALLY_TEMPLATES[ally.kind];
      ally.prevX = ally.x; ally.prevY = ally.y;
      if (ally.hp <= 0) continue;
      if (ally.remaining !== undefined) ally.remaining = Math.max(0, ally.remaining - dt);
      ally.attackCooldown = Math.max(0, ally.attackCooldown - dt);
      if (ally.regen && (ally.regen.remaining -= dt) <= 0) ally.regen = undefined;
      else if (ally.regen) ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * ally.regen.perSecond * dt);
      if (ally.guard && (ally.guard.remaining -= dt) <= 0) ally.guard = undefined;
      if (ally.speedBoost && (ally.speedBoost.remaining -= dt) <= 0) ally.speedBoost = undefined;
      if (ally.stealth && (ally.stealth.remaining -= dt) <= 0) ally.stealth = undefined;
      if (ally.aura) {
        ally.aura.tickAcc = (ally.aura.tickAcc ?? 0) + dt;
        if (ally.aura.tickAcc >= 1) {
          ally.aura.tickAcc = 0;
          const aura = ally.aura, inRadius = Math.hypot(p.x - ally.x, p.y - ally.y) <= aura.radius;
          if (aura.kind === 'slow') {
            for (const enemy of this.activeTargets()) if (enemy.state !== 'dead' && Math.hypot(enemy.x - ally.x, enemy.y - ally.y) <= aura.radius)
              applySlow(enemy, { duration: 1.2, factor: aura.amount });
          }
          else if (inRadius) {
            if (aura.kind === 'heal') p.hp = Math.min(p.maxHp, p.hp + p.maxHp * aura.amount);
            else if (aura.kind === 'mana') p.mana = Math.min(p.maxMana, p.mana + p.maxMana * aura.amount);
            else if (aura.kind === 'buff') this.addBuff(template.name, template.color, { duration: 2, stats: aura.stats }, `totem:${ally.kind}`);
            else if (aura.kind === 'absorb') this.addBuff(template.name, template.color, { duration: 2, absorb: aura.amount }, `totem:${ally.kind}`);
            else if (aura.kind === 'ccBreak') { p.cc = undefined; p.ccImmunity = Math.max(p.ccImmunity ?? 0, aura.amount); }
            else if (aura.kind === 'cleanse') {
              const index = p.cc?.findIndex(cc => cc.kind === 'slow' || cc.kind === 'root' || cc.kind === 'fear') ?? -1;
              if (index >= 0) { p.cc!.splice(index, 1); if (!p.cc!.length) p.cc = undefined; }
            }
          }
        }
      }
      const activePet = p.character.pets?.active;
      const pet = activePet && ally.petId === activePet.id ? activePet : undefined;
      const command = pet ? p.petCommand ?? 'attack' : 'attack';
      const noAttack = command === 'follow' || command === 'passive';
      const holdPosition = command === 'stay' || command === 'follow';
      let target = noAttack ? undefined
        : command === 'attack' && pet ? this.targetEnemy(p.targetId) ?? this.targetEnemy(ally.targetId)
        : this.targetEnemy(ally.targetId) ?? this.targetEnemy(p.targetId);
      if (!target && command === 'attack') {
        let best = Infinity;
        for (const enemy of this.activeTargets()) {
          if (enemy.state === 'dead' || enemy.awareness <= 0) continue;
          const d = Math.hypot(enemy.x - ally.x, enemy.y - ally.y);
          if (d < best) { best = d; target = enemy; }
        }
      }
      ally.targetId = target?.id ?? null;
      if (target) this.fireAllySkills(ally, target, pet);
      const leash = Math.hypot(ally.x - p.x, ally.y - p.y) > WOW_COMBAT.allyLeash;
      const standoff = target ? (template.attackRange > 0 ? template.attackRange : ally.radius + target.radius + 8) : 0;
      let mx = 0, my = 0;
      const recall = leash || command === 'follow' || (!target && command !== 'stay' && command !== 'passive');
      if (recall) {
        const d = Math.hypot(p.x - ally.x, p.y - ally.y);
        if (d > 40) { mx = (p.x - ally.x) / d; my = (p.y - ally.y) / d; }
      } else if (target && !holdPosition) {
        const d = Math.hypot(target.x - ally.x, target.y - ally.y);
        if (d > standoff) { mx = (target.x - ally.x) / d; my = (target.y - ally.y) / d; }
      }
      if (!ally.stationary && (mx || my)) {
        const speed = PLAYER_MOVEMENT.speed * 1.1 * (ally.speedBoost?.factor ?? 1);
        const to = this.world.move(ally.x, ally.y, mx * speed * dt, my * speed * dt, ally.radius);
        ally.x = to.x; ally.y = to.y;
      }
      if (target) ally.angle = Math.atan2(target.y - ally.y, target.x - ally.x);
      if (target && ally.attackCooldown <= 0 && Math.hypot(target.x - ally.x, target.y - ally.y) <= standoff + 4
        && this.lineOfSight(ally.x, ally.y, target.x, target.y)) {
        ally.attackCooldown = template.attackInterval;
        const allyDamage = 1 + (p.buffs ?? []).reduce((bonus, buff) => bonus + (buff.remaining > 0 ? buff.allyDamage ?? 0 : 0), 0);
        this.damageEnemy(target, ally.damage * allyDamage, ally.angle, template.attackRange === 0, false, undefined, undefined, { ...ALLY_OFFENSE, allyId: ally.id });
        if (ally.kind === 'shadowfiend') p.mana = Math.min(p.maxMana, p.mana + p.maxMana * .01);
      }
    }
    // A pet that falls in battle loses loyalty on its record.
    const active = p.character.pets?.active;
    if (active && allies.some(ally => ally.petId === active.id && ally.hp <= 0))
      p.character.pets = { ...p.character.pets!, active: adjustPetLoyalty(active, -PET_RULES.deathLoyaltyLoss) };
    this.compactList(allies, ally => ally.hp > 0 && (ally.remaining === undefined || ally.remaining > 0));
    if (this.allySkillCooldowns.size) {
      const live = new Set(allies.map(ally => ally.id));
      for (const id of this.allySkillCooldowns.keys()) if (!live.has(id)) this.allySkillCooldowns.delete(id);
    }
  }

  private fireAllySkills(ally: Ally, target: Enemy, pet: PetRecord | undefined): void {
    const demon = demonFamilyForAlly(ally.kind);
    const skills = pet ? pet.skills : demon ? DEMON_FAMILIES[demon].skills : undefined;
    if (!skills?.length) return;
    const cooldowns = this.allySkillCooldowns.get(ally.id) ?? new Map<string, number>();
    this.allySkillCooldowns.set(ally.id, cooldowns);
    for (const id of skills) {
      const skill = PET_SKILLS[id];
      if (!skill || (cooldowns.get(id) ?? 0) > this.time) continue;
      const reach = skill.range > 0 ? skill.range : ally.radius + target.radius + 8;
      if (Math.hypot(target.x - ally.x, target.y - ally.y) > reach + target.radius) continue;
      cooldowns.set(id, this.time + skill.cooldown);
      this.applyAllySkill(ally, target, skill);
    }
  }

  private applyAllySkill(ally: Ally, target: Enemy, skill: PetSkill): void {
    const p = this.player, effect = skill.effect;
    const allyDamage = 1 + (p.buffs ?? []).reduce((bonus, buff) => bonus + (buff.remaining > 0 ? buff.allyDamage ?? 0 : 0), 0);
    switch (effect.kind) {
      case 'strike': {
        const arc = effect.arc ?? 0;
        for (const enemy of this.activeTargets()) {
          if (enemy.state !== 'dead' && (enemy === target || (arc > 0 && circleIntersectsSector(enemy.x, enemy.y, enemy.radius, ally.x, ally.y, ally.angle, ally.radius + 48, arc)))) {
            this.damageEnemy(enemy, ally.damage * effect.damageMultiplier * allyDamage, Math.atan2(enemy.y - ally.y, enemy.x - ally.x), skill.range === 0, false, schoolProjectileStyle(effect.school), undefined, { ...ALLY_OFFENSE, allyId: ally.id });
            if (effect.stun) applyStun(enemy, effect.stun);
            if (effect.sunder) applySunderStatus(enemy, effect.sunder, 15);
            if (effect.slow) applySlow(enemy, effect.slow);
          }
        }
        break;
      }
      case 'dot': applyDotStatus(target, skill.id, effect.dot, ally.damage * allyDamage, 'ally', ally.id); break;
      case 'taunt':
        target.taunted = { remaining: effect.duration, allyId: ally.id };
        target.awareness = Math.max(target.awareness, 1);
        tauntThreat(target, `ally:${ally.id}`);
        break;
      case 'cc': applyCcStatus(target, effect.cc, effect.duration, effect.cc === 'incapacitate' || effect.cc === 'polymorph', effect.factor); break;
      case 'projectile':
        this.projectile(ally.x, ally.y, Math.atan2(target.y - ally.y, target.x - ally.x),
          { owner: 'player', speed: 480, life: Math.max(.1, skill.range / 480), radius: 4, damage: ally.damage * effect.damageMultiplier * allyDamage },
          undefined, { style: schoolProjectileStyle(effect.school) ?? 'arcane', offense: { ...ALLY_OFFENSE, allyId: ally.id } });
        break;
      case 'guard': ally.guard = { remaining: effect.duration, reduction: effect.reduction }; break;
      case 'stealth': ally.stealth = { remaining: effect.duration }; break;
      case 'buff':
        if (effect.target === 'player') this.addBuff(skill.name, '#a8c68a', effect.buff, skill.id);
        else {
          const move = effect.buff.stats?.moveSpeedPercent;
          if (move) ally.speedBoost = { remaining: effect.buff.duration, factor: 1 + move / 100 };
          if (effect.buff.healPerSecond) ally.regen = { remaining: effect.buff.duration, perSecond: effect.buff.healPerSecond };
        }
        break;
    }
  }

  private moveEnemy(enemy: Enemy, vx: number, vy: number, dt: number): void {
    vx *= enemy.slowFactor; vy *= enemy.slowFactor;
    let destination = this.world.move(enemy.x, enemy.y, vx * dt, vy * dt, enemy.radius);
    // Local steering lets pursuers slip around trunks without a pathfinding grid.
    const intendedDistance = Math.hypot(vx, vy) * dt;
    if ((enemy.state === 'chase' || enemy.state === 'return' || enemy.state === 'patrol' || enemy.state === 'recover') && intendedDistance > 0 && Math.hypot(destination.x - enemy.x, destination.y - enemy.y) < intendedDistance * 0.35) {
      const heading = Math.atan2(vy, vx);
      const handedness = enemy.id % 2 === 0 ? 1 : -1;
      for (const turn of [0.7, -0.7, 1.3, -1.3]) {
        const candidate = this.world.move(enemy.x, enemy.y, Math.cos(heading + turn * handedness) * intendedDistance, Math.sin(heading + turn * handedness) * intendedDistance, enemy.radius);
        if (Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) > intendedDistance * 0.7) { destination = candidate; break; }
      }
    }
    if (this.world.isSanctuary?.(destination.x, destination.y)
      && !this.world.isSanctuary(enemy.x, enemy.y)) destination = { x: enemy.x, y: enemy.y };
    enemy.vx = (destination.x - enemy.x) / dt;
    enemy.vy = (destination.y - enemy.y) / dt;
    enemy.x = destination.x;
    enemy.y = destination.y;
  }

  takeDamage(amount: number, angle: number, sourceLevel: number, damageType: DamageType, kind?: EnemyKind, sourceName?: string, melee = false, attacker?: Enemy): void {
    this.bumpCombat(this.player);
    if(currentDungeon(this.expeditions)?.rift?.phase==='complete')return;
    if (!damageCombatant(amount, angle, sourceLevel, damageType, {
      player: this.player, world: this.world, random: () => this.random(), emit: event => this.emit(event),
      addBuff: (name, color, spec, id) => this.addBuffTo(this.player, name, color, spec, id),
      defensiveProc: (player, context) => tryDefensiveProc(player, context),
      attacker,
      strikeBack: (foe, reflectedAmount, type) => this.reflectStrike(this.player, foe, reflectedAmount, type),
      wardBurst: burst=>{
        const p=this.player;
        this.emit({type:'blast',x:p.x,y:p.y,radius:burst.radius,style:'arcane',skill:'runicWard',color:'#d98eda'});
        strikeContainers(this.containerContext(),p.x,p.y,burst.radius);
        for(const enemy of this.activeTargets())if(enemy.state!=='dead'&&Math.hypot(enemy.x-p.x,enemy.y-p.y)<=burst.radius+enemy.radius&&this.lineOfSight(p.x,p.y,enemy.x,enemy.y))
          this.damageEnemy(enemy,burst.damage,Math.atan2(enemy.y-p.y,enemy.x-p.x),false,false,'arcane',undefined,burst.offense);
      },
    }, kind, false, undefined, sourceName, melee)) return;
    this.portal.cancelFor(this.player); this.eventChannel.cancelFor(this.player); this.hearthstone.cancelFor(this.player);
    mountOnDamage(this);
    durabilityLoss(this.player, this.player.dead ? 'death' : 'hit-taken', this.time);
    this.hurtGuard = COMBAT_TIMING.hurtGuard;
    // Inside a PvP match a dead combatant is a corpse: no defeat flow, no input
    // clear — the match controller (T06) decides when the fight is over.
    if (this.player.dead && !this.pvpCombatants) { this.chains.length = 0; this.clearInput(); }
  }

  private collectSelectedGroundItem(player: Player = this.player): void {
    const pickup = this.pickupFor(player);
    if(pickup.id===null)return;
    const index=this.groundItems.findIndex(drop=>drop.id===pickup.id);
    if(index<0)return;
    const drop=this.groundItems[index];
    if(!pickup.ready(player,drop,this.world))return;
    if(drop.flight&&this.time<drop.flight.at+drop.flight.delay+TREASURE_FLIGHT_DURATION)return;
    this.awardGroundItem(index, player);
  }

  private projectile(x: number, y: number, angle: number, definition: ProjectileDefinition, skill?: SkillId, effects?: ProjectileEffects, sourceLevel = this.player.level, sourceKind?: EnemyKind, sourceName?: string, sourceId?: number): Projectile | undefined {
    if (this.projectiles.length >= MAX_PROJECTILES) return;
    const { life, radius, damage, owner } = definition;
    const hawkeye=owner==='player'&&effects?.style==='arrow'?auraPower(this.player,'hawkeye'):0;
    const speed=definition.speed*(1+hawkeye/100);
    if(hawkeye)effects={...effects!,hawkeye:{x,y,crit:this.player.character.allocatedNodes.includes('keystone:measured-force')?0:hawkeye/200}};
    const shot: Projectile = { id: this.nextId++, sourceLevel, sourceKind, sourceName, sourceId, x, y, prevX: x, prevY: y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, angle, radius, damage, life, maxLife: life, owner, skill,
      ...(((this.pvpCombatants || this.coopRoster) && owner === 'player') ? { source: this.player } : {}),
      effects: effects ? { ...effects, ...(effects.offense ? { offense: { ...effects.offense } } : {}) } : undefined, hitIds: new Set() };
    if (skill) {
      const p = this.player, weapon = skillWeapon(skill, p.equipment);
      if (weapon && weapon.attackKind !== 'melee') shot.launch = {
        skill, weapon: { ...weapon.visual }, mainWeapon: { ...p.equipment.mainHand.visual },
        hand: weapon === p.equipment.mainHand ? 'main' : 'off', hands: weapon.hands, facing: p.angle, time: this.time,
        gaitPhase: p.walkTime, moving: Math.min(1, Math.hypot(p.vx, p.vy) / 130), moveAngle: Math.atan2(p.vy, p.vx), start: 0, end: 1,
        raceId: p.character.raceId,
      };
    }
    this.projectiles.push(shot);
    return shot;
  }

  private containerContext(): ContainerAttackContext {
    return { world: this.world, break: (target, angle) => {
      const level = this.world.dungeonLevel ?? encounterScaleAt(target.x, target.y, this.world.seed ?? this.options.seed!, this.player.level).base;
      if (breakContainer(target, angle, level, this.brokenContainers, this.groundGold,
        () => this.nextId++, event => this.emit(event), this.player.derived.goldFindMultiplier)) {
        this.world.setBrokenContainers?.(this.brokenContainers);
        this.playerMovement.clear();
      }
    } };
  }

  private updateProjectiles(dt: number): void {
    // Player shots carry their shooter in `source` (PvP and co-op); partition so
    // each player's shots resolve damage/kills against that player. Enemy shots
    // (no source) hit-test the whole roster via `players`.
    const partitioned = !!(this.pvpCombatants || this.coopRoster);
    const run = (shots: Projectile[], source: Player | undefined) => advanceProjectiles(shots, dt, {
      containers: this.containerContext(),
      player: source ?? this.player, players: this.players,
      enemies: source ? this.hostileTargets(source) : this.enemies, world: this.world,
      onScreen: enemy => enemyInCombatViewport(enemy, this.combatViewport),
      damage: (enemy, amount, angle, melee, style, offense, authoredBurn, elementalDamage) =>
        this.forPlayer(source ?? this.player, () => this.damageEnemy(enemy, amount, angle, melee, false, style, elementalDamage, offense, authoredBurn, source)),
      hurt: (amount, angle, sourceLevel, damageType, sourceKind, sourceName, sourceId, victim) =>
        this.forPlayer(victim ?? this.player, () => this.takeDamage(amount, angle, sourceLevel, damageType, sourceKind, sourceName, false, sourceId === undefined ? undefined : this.enemies.find(e => e.id === sourceId))),
      hurtAlly: (ally, amount) => this.damageAlly(ally, amount),
      visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by),
      emit: event => this.emit(event),
      schedule: effect => this.scheduleGroundEffect(effect),
    });
    if (!partitioned) { run(this.projectiles, undefined); }
    else {
      const bySource = new Map<Player | undefined, Projectile[]>();
      for (const shot of this.projectiles) {
        const source = shot.owner === 'player' ? shot.source : undefined;
        const list = bySource.get(source) ?? [];
        if (!list.length) bySource.set(source, list);
        list.push(shot);
      }
      for (const [source, shots] of bySource) run(shots, source);
    }
    this.compactList(this.projectiles, projectile => projectile.life > 0);
  }

  private scheduleGroundEffect(effect: Omit<GroundEffect, 'id' | 'tick'>): void {
    const before = this.groundEffects.length;
    scheduleGroundEffect(this.groundEffects, effect, {
      nextId: () => this.nextId++, emit: event => this.emit(event),
    });
    if ((this.pvpCombatants || this.coopRoster) && this.groundEffects.length > before)
      this.groundEffects[this.groundEffects.length - 1]!.source = this.player;
  }

  private updateGroundEffects(dt: number): void {
    if (!this.pvpCombatants && !this.coopRoster) {
      this.groundEffects = advanceGroundEffects(this.groundEffects, dt, {
        containers: this.containerContext(),
        player: this.player,
        enemies: this.enemies, visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by),
        damage: (enemy, amount, angle, melee, style, periodic = false, offense, authoredBurn) => this.damageEnemy(enemy, amount, angle, melee, periodic, style, undefined, offense, authoredBurn),
        emit: event => this.emit(event),
      });
      return;
    }
    // Per-source partition: a ground effect only damages its team's hostiles and
    // follows/drains the combatant that placed it.
    const bySource = new Map<Player | undefined, ActiveGroundEffect[]>();
    for (const effect of this.groundEffects) {
      const list = bySource.get(effect.source) ?? [];
      if (!list.length) bySource.set(effect.source, list);
      list.push(effect);
    }
    const kept: ActiveGroundEffect[] = [];
    for (const [source, effects] of bySource) {
      kept.push(...advanceGroundEffects(effects, dt, {
        containers: this.containerContext(),
        player: source ?? this.player,
        enemies: source ? this.hostileTargets(source) : this.enemies, visible: (ax, ay, bx, by) => this.lineOfSight(ax, ay, bx, by),
        damage: (enemy, amount, angle, melee, style, periodic = false, offense, authoredBurn) => this.forPlayer(source ?? this.player, () => this.damageEnemy(enemy, amount, angle, melee, periodic, style, undefined, offense, authoredBurn, source)),
        emit: event => this.emit(event),
      }));
    }
    this.groundEffects = kept;
  }

  private updatePickups(dt: number): void {
    for (const pickup of this.pickups) {
      pickup.life -= dt;
      if (pickup.life <= 0) continue;
      // Nearest eligible player collects; co-op players share the same piles.
      for (const p of this.players) {
        const needed = pickup.kind === 'health' ? p.hp < p.maxHp : p.mana < manaCapacity(p);
        if (!needed || p.dead || this.ghosts.has(p)) continue;
        const dx = p.x - pickup.x;
        const dy = p.y - pickup.y;
        const distance = Math.hypot(dx, dy);
        if (distance < LOOT_RULES.collectDistance) {
          const before = pickup.kind === 'health' ? p.hp : p.mana;
          if (pickup.kind === 'health') p.hp = Math.min(p.maxHp, p.hp + p.maxHp * pickup.restoreFraction);
          else p.mana = Math.min(manaCapacity(p), p.mana + manaVialRestoration(p.maxMana,pickup.restoreAmount ?? manaVialAmount(1)));
          const value = (pickup.kind === 'health' ? p.hp : p.mana) - before;
          pickup.life = 0;
          this.emit({ type: 'pickup', x: pickup.x, y: pickup.y, value, heavy: pickup.kind === 'health' });
          break;
        } else if (distance < LOOT_RULES.magnetDistance) {
          const destination = this.world.move(pickup.x, pickup.y, dx / distance * LOOT_RULES.magnetSpeed * dt,
            dy / distance * LOOT_RULES.magnetSpeed * dt, pickup.radius);
          pickup.x = destination.x;
          pickup.y = destination.y;
          break;
        }
      }
    }
    this.compactList(this.pickups, pickup => pickup.life > 0);
  }

  requestGroundItem(id: number, player: Player = this.player): string | null {
    // Owner-scoped cancels: a co-op partner's pickup must not cancel the other
    // player's in-progress portal/hearthstone/event channel.
    this.clearCombatInput();this.portal.cancelFor(player);this.eventChannel.cancelFor(player);this.hearthstone.cancelFor(player);
    return this.pickupFor(player).select(player,this.groundItems.find(drop=>drop.id===id),this.time);
  }
  private awardGroundItem(index: number, player: Player = this.player): void {
    const drop=this.groundItems[index];
    const pickup = this.pickupFor(player);
    if(pickup.id===drop.id)pickup.cancel();
    if(!addInventoryItem(player.character,drop.item)) {
      this.emit({type:'notice',x:drop.x,y:drop.y,message:`${packSpaceProblem(player.character,drop.item)} Item left on the ground.`});return;
    }
    questOnCollect(this, drop.item.id);
    if (drop.item.kind === 'charm') refreshCharacter(player);
    this.groundItems.splice(index,1);
    this.emit({type:'loot',x:drop.x,y:drop.y,item:drop.item,color:TIER_COLORS[drop.item.tier]});
  }

  private updateSpawns(dt: number): void {
    const view = this.spawnExclusion;
    if (!this.options.spawn || !view) return;
    this.roaming.advance(this.player, dt);
    this.campTimer -= dt;
    if (this.campTimer <= 0 && this.world.getEnemyCamps) {
      this.campTimer = CAMP_POPULATION_RULES.updateInterval;
      const radius = Math.min(CAMP_POPULATION_RULES.maximumActivationDistance, Math.max(
        CAMP_POPULATION_RULES.activationDistance, Math.hypot(view.width, view.height) * .5 + 350));
      const camps = this.world.getEnemyCamps(this.player.x - radius, this.player.y - radius, radius * 2, radius * 2);
      this.camps.update(camps, this.player, this.enemies, this.world,
        (member, x, y, source) => this.spawnEnemy(member.kind, x, y, member.rank, source), radius, view);
    }
    if (this.world.isSanctuary?.(this.player.x, this.player.y) || !this.roaming.ready) return;
    this.roaming.resolved(this.spawnRoamingGroup(view), () => this.random());
  }

  private spawnRoamingGroup(view: SpawnExclusion): number {
    const living = this.enemies.filter(enemy => enemy.state !== 'dead');
    const sizeRoll=this.random();
    let checks=0;
    for (let attempt = 0; attempt < ENCOUNTER_RULES.maxSpawnAttempts; attempt++) {
      // Reserve the largest footprint before capturing the anchor's regional
      // level: widening a pack afterward must not move it into another district.
      const anchor = roamingSpawnAnchor(this.player, view, this.roaming.heading, () => this.random(), attempt,
        roamingFormationRadius(ROAMING_RULES.maxGroupSize));
      const scaling = encounterScaleAt(anchor.x, anchor.y, this.world.seed ?? this.options.seed!, this.player.level);
      const size = this.roaming.groupSize(scaling.base,sizeRoll);
      const members: Array<{ kind: EnemyKind; rank: EnemyRank; x: number; y: number; levelOffset: number }> = [];
      for (let index = 0; index < size; index++) {
        for(let placement=0;placement<ROAMING_RULES.memberPlacementAttempts;placement++){
          if(++checks>ROAMING_RULES.placementBudget)return 0;
          const offset=roamingMemberOffset(size,index,anchor.angle,()=>this.random(),placement);
          const x = anchor.x + offset.x, y = anchor.y + offset.y;
          const biome = (this.world.sampleBiome?.(x, y) ?? sampleBiome(x, y)).id;
          const recipe=index?ROAMING_GROUPS[members[0].kind]:undefined;
          const preferred = recipe ? recipe[1+(index-1)%(recipe.length-1)] : undefined;
          // Authored zones carry their own spawn table (weighted pick +
          // levelOffset); elsewhere the biome encounter table applies.
          const zone = zoneAt(x, y), table = zone ? ZONE_CONTENT[zone.id]?.spawns : undefined;
          let kind: EnemyKind, levelOffset = 0;
          if (table?.length) {
            const entry = pickSpawnEntry(table, this.random(), preferred);
            kind = entry.kind; levelOffset = entry.levelOffset ?? 0;
          } else {
            kind = chooseEncounterEnemy(biome, () => this.random(), preferred, roamingEscortRole(members[0], index));
          }

          if (!isSpawnHidden(x, y, view, ENEMY_DEFINITIONS[kind].radius)
            || this.world.isSanctuary?.(x, y)
            || this.world.blocked(x, y, ENEMY_DEFINITIONS[kind].radius + ENCOUNTER_RULES.spawnClearance)
            || this.world.getEnemyCamps?.(x - 60, y - 60, 120, 120)
              .some(camp => Math.hypot(camp.x - x, camp.y - y) < camp.radius + 60)
            || living.some(enemy => Math.hypot(enemy.x - x, enemy.y - y) < ENCOUNTER_RULES.minimumSeparation)
            || members.some(enemy => Math.hypot(enemy.x - x, enemy.y - y) < ENCOUNTER_RULES.minimumSeparation)) continue;
          const rank = roamingMemberRank(scaling.base,index,this.random());
          members.push({ kind, rank, x, y, levelOffset });
          break;
        }
        if(members.length!==index+1)break;
      }
      if (members.length !== size) continue;
      // A loose encounter is validated together, so a single blocked member does
      // not scatter a half-formed group through several unrelated candidates.
      const created: Enemy[] = [], firstEvent = this.events.length;
      for (const member of members) {
        const memberScaling = member.levelOffset
          ? { base: Math.max(1, scaling.base + member.levelOffset), min: Math.max(1, scaling.min + member.levelOffset), max: Math.max(1, scaling.max + member.levelOffset), ...(scaling.fixed ? { fixed: true } : {}) }
          : scaling;
        const enemy = this.spawnEnemy(member.kind, member.x, member.y, member.rank, undefined, memberScaling);
        if (enemy) {
          enemy.angle = anchor.angle + Math.PI + (this.random() - .5) * .9;
          created.push(enemy);
        }
      }
      if (created.length === members.length) return created.length;
      this.enemies = this.enemies.filter(enemy => !created.includes(enemy));
      this.events.splice(firstEvent);
    }
    return 0;
  }
}
