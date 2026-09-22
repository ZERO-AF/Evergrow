/** World event commands (WoW Scourge Invasion): the live kill hook and the
 * durable war-chest claim. The claim stages items/gold/xp/reputation on a
 * checkpoint clone, persists, then commits — mirroring poi-command's
 * commitEvent and reputation-command's repClaimReward. */
import { cloneData } from './data-clone.ts';
import { metric } from './chronicle.ts';
import { treasureLanding } from './treasure-flight.ts';
import { stageJourneyCompletion } from './journey-rewards.ts';
import { getZoneAt } from './zone-progression.ts';
import { awardCharacterExperience } from './character.ts';
import { xpLevelFactor } from './progression.ts';
import { addGroundItem } from './ground-loot.ts';
import { GOLD_RULES } from './gold.ts';
import { pushChatMessage } from './chat-log.ts';
import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { Enemy } from './model.ts';
import { KILL_REP, STANDING_BY_TIER, FACTION_BY_ID } from './reputation-content.ts';
import { applyReputation, reputationEnabled, reputationPoints, type ReputationCarrier } from './reputation-state.ts';
import {
  INVASION_NAME, WORLD_EVENT_FACTION, WORLD_EVENT_RULES, worldEventRewards,
} from './world-event-content.ts';
import {
  recordWorldEventKill, worldEventChestAt, worldEventsEnabled, worldEventsOf,
  type InvasionEvent, type WorldEventCarrier, type WorldEventState,
} from './world-event-state.ts';

export interface WorldEventResult { ok: boolean; message: string }
export type WorldEventPersist = (checkpoint: CharacterCheckpoint) => WorldEventResult | Promise<WorldEventResult>;

/** The checkpoint fields this feature stages; the integrator persists them on save. */
export type CheckpointWithWorldEvents = CharacterCheckpoint & { worldEvents?: WorldEventState } & ReputationCarrier;

// ── Kill hook ────────────────────────────────────────────────────────────────

/** Kill path: feed the slain actor. Marks the durable roster entry dead and
 * credits the Argent Crusade for every invasion kill (rank-scaled, kill-capped
 * like applyKillReputation). Returns true when the actor was a Scourge mob. */
export function worldEventOnKill(sim: Simulation, actor: Pick<Enemy, 'campId' | 'campMemberId' | 'rank'>): boolean {
  if (!worldEventsEnabled() || !recordWorldEventKill(worldEventsOf(sim), actor)) return false;

  const faction = FACTION_BY_ID[WORLD_EVENT_FACTION];
  const carrier = sim.player as Simulation['player'] & ReputationCarrier;
  const capMin = STANDING_BY_TIER[faction.killCap ?? 'revered'].min;
  if (reputationPoints(carrier, faction.id) >= capMin) return true;
  const amount = actor.campMemberId === 'boss' ? KILL_REP.boss : KILL_REP[actor.rank];
  const gain = applyReputation(carrier, faction.id, amount, capMin);
  if (gain.applied > 0) {
    pushChatMessage(sim.player, 'system', `Reputation with ${gain.faction.name} increased by ${gain.applied}.`, sim.time);
    if (gain.changed) pushChatMessage(sim.player, 'discovery', `You are now ${gain.changed.label} with ${gain.faction.name}.`, sim.time);
  }
  return true;
}

// ── War chest claim (durable) ────────────────────────────────────────────────

/** Why the war chest cannot be claimed right now; null means it can. */
export function worldEventRewardProblem(sim: Simulation, event: InvasionEvent): string | null {
  if (sim.player.dead) return 'You are dead.';
  if (event.phase !== 'won') return 'The invasion is not repelled yet.';
  if (!event.anchor) return 'The necropolis has withdrawn.';
  if (Math.hypot(sim.player.x - event.anchor.x, sim.player.y - event.anchor.y) > WORLD_EVENT_RULES.reach)
    return 'Return to the necropolis to claim the war chest.';
  return null;
}

/** Auto-claim scan for the game loop, mirroring pendingEventReward: a won event
 * whose chest is in reach is ready to deliver. */
export function pendingWorldEventReward(sim: Simulation): InvasionEvent | null {
  if (sim.dungeonFloor) return null;
  return worldEventChestAt(worldEventsOf(sim), sim.player);
}

/** Claim the war chest: items and gold burst onto the necropolis ground, xp and
 * Argent Crusade reputation land on the character, and a journey receipt records
 * the clear. All of it persists before going live. */
export async function claimWorldEventReward(sim: Simulation, event: InvasionEvent, persist: WorldEventPersist): Promise<WorldEventResult> {
  const problem = worldEventRewardProblem(sim, event);
  if (problem) return { ok: false, message: problem };
  const checkpoint = sim.captureCheckpoint() as CheckpointWithWorldEvents;
  checkpoint.worldEvents = cloneData(worldEventsOf(sim));
  const staged = [...(checkpoint.worldEvents.active ? [checkpoint.worldEvents.active] : []), ...checkpoint.worldEvents.history]
    .find(e => e.id === event.id);
  if (!staged || staged.phase !== 'won' || !staged.anchor) return { ok: false, message: 'The war chest is gone.' };
  staged.phase = 'claimed';

  const bundle = worldEventRewards(staged, sim.player.level);
  let nextId = sim.nextEntityIdentity;
  bundle.items.forEach((item, i) => {
    addGroundItem(checkpoint.groundItems, { id: nextId++, ...treasureLanding(sim.world, staged.anchor!.x, staged.anchor!.y, i, staged.seed),
      flight: { x: staged.anchor!.x, y: staged.anchor!.y, at: sim.time, delay: i * .11 }, item });
  });
  if (checkpoint.groundGold!.length < GOLD_RULES.maxPiles)
    checkpoint.groundGold!.push({ id: nextId++, ...treasureLanding(sim.world, staged.anchor.x, staged.anchor.y, 12, staged.seed),
      flight: { x: staged.anchor.x, y: staged.anchor.y, at: sim.time, delay: .1 },
      amount: Math.round(bundle.gold * sim.player.derived.goldFindMultiplier), age: 0 });

  metric(checkpoint.chronicle, 'worldEvents'); metric(checkpoint.chronicle, 'worldEvent:invasion');
  const stagedPlayer = { ...sim.player, character: checkpoint.character, level: checkpoint.level, xp: checkpoint.xp };
  const reward = Math.round(bundle.xp * xpLevelFactor(checkpoint.level, staged.level) * sim.player.derived.xpGainMultiplier);
  awardCharacterExperience(stagedPlayer, reward, sim.time);
  metric(checkpoint.chronicle, 'xp', reward); metric(checkpoint.chronicle, 'highestLevel', stagedPlayer.level);
  checkpoint.character = stagedPlayer.character; checkpoint.level = stagedPlayer.level; checkpoint.xp = stagedPlayer.xp;

  if (reputationEnabled()) {
    checkpoint.reputation = cloneData(sim.player.reputation);
    applyReputation(checkpoint, WORLD_EVENT_FACTION, bundle.rep);
  }

  const oldLevel = sim.player.level;
  const zone = getZoneAt(staged.anchor.x, staged.anchor.y, sim.world.seed);
  const completion = stageJourneyCompletion(checkpoint,
    { id: staged.id, kind: 'bossLair', name: `${INVASION_NAME}: ${staged.zoneName}`, x: staged.anchor.x, y: staged.anchor.y,
      level: staged.level, region: zone.name }, sim.player, sim.time, oldLevel);

  const result = await persist(checkpoint);
  if (!result.ok) return result;
  const carrier = sim as unknown as WorldEventCarrier; // integrator-owned field; see world-event-state.ts
  carrier.worldEvents = checkpoint.worldEvents;
  // Do not restore/reset the simulation: actors, projectiles and world state stay live.
  sim.commitEventCheckpoint(checkpoint, reward + (completion?.xp ?? 0), checkpoint.level - oldLevel, completion);
  if (checkpoint.reputation) sim.player.reputation = checkpoint.reputation;
  const message = `${INVASION_NAME} repelled — the Argent Crusade thanks you.`;
  pushChatMessage(sim.player, 'loot', message, sim.time);
  return { ok: true, message };
}
