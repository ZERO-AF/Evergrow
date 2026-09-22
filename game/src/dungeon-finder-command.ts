/**
 * Durable Dungeon Finder commands (docs/wow-deepening.md conventions):
 * stage on a captured checkpoint, persist, then commit to the live player.
 *
 * `queueForDungeon` persists the queue marker first — a failed or interrupted
 * entry leaves the character still queued — then hands a synthesized entrance
 * to the same planDungeonTravel 'enter' path the world doors use. The
 * entrance's x/y is the player's position, so the proximity gate passes and
 * the exit portal returns the player to where they queued.
 *
 * Only the marker field is committed, never the staged sheet object: the
 * session retains persisted checkpoints by reference, so sharing the staged
 * clone would let later live mutations rewrite the durable snapshot.
 */
import type { Simulation } from './simulation.ts';
import type { WorldQuery } from './model.ts';
import type { ActionResult } from './character-types.ts';
import { planDungeonTravel, type DungeonResult, type PersistDungeon } from './dungeon-command.ts';
import { dungeonFinderDungeon, dungeonFinderEntrance, dungeonFinderProblem } from './dungeon-finder-content.ts';
import { dungeonFinderEnabled, dungeonFinderOf, type DungeonFinderSheet } from './dungeon-finder-state.ts';

export type DungeonFinderResult = DungeonResult;

/**
 * Queue for a dungeon and enter it. Two durable writes: the queue marker
 * (kept if entry fails, so the queue survives), then the location change.
 * The caller completes the transition like LocationController.dungeon —
 * restoreWorld(result.checkpoint), sim.restoreCheckpoint, relocate, arrived.
 */
export async function queueForDungeon(sim: Simulation, dungeonId: string, surface: WorldQuery, persist: PersistDungeon, heroic = false): Promise<DungeonFinderResult> {
  const p = sim.player;
  if (!dungeonFinderEnabled()) return { ok: false, message: 'The Dungeon Finder is not available.' };
  const entry = dungeonFinderDungeon(dungeonId);
  if (!entry) return { ok: false, message: 'That dungeon is not in the Dungeon Finder.' };
  const problem = dungeonFinderProblem(entry, p, heroic);
  if (problem) return { ok: false, message: problem };
  if (sim.dungeonFloor || sim.expeditions.location) return { ok: false, message: 'Already in a dungeon.' };

  // Stage the queue marker before the entry travel persist: a failed entry
  // leaves the character queued so the panel can retry or leave cleanly.
  const marker = { queued: entry.id, queuedAt: Date.now(), ...(heroic ? { heroic: true } : {}) };
  const staged = sim.captureCheckpoint();
  (staged.character as DungeonFinderSheet).dungeonFinder = marker;
  const queued = await persist(staged);
  if (!queued.ok) return { ok: false, message: queued.message };
  (p.character as DungeonFinderSheet).dungeonFinder = { ...marker };

  // The entry consumes the queue; clearing it on the live sheet lands in the
  // travel checkpoint. A failed entry restores the marker to match the save.
  delete (p.character as DungeonFinderSheet).dungeonFinder;
  const result = await planDungeonTravel(sim, { kind: 'enter', entrance: dungeonFinderEntrance(entry, p, surface.seed ?? 0, heroic) }, surface, persist);
  if (!result.ok) (p.character as DungeonFinderSheet).dungeonFinder = { ...marker };
  return result;
}

/** Leave the queue: clears the persisted marker. Refused when not queued. */
export async function leaveQueue(sim: Simulation, persist: PersistDungeon): Promise<ActionResult> {
  const p = sim.player;
  if (!dungeonFinderOf(p.character)?.queued) return { ok: false, message: 'You are not in a queue.' };
  const checkpoint = sim.captureCheckpoint();
  delete (checkpoint.character as DungeonFinderSheet).dungeonFinder;
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message };
  delete (p.character as DungeonFinderSheet).dungeonFinder;
  return { ok: true, message: 'You are no longer queued for a dungeon.' };
}
