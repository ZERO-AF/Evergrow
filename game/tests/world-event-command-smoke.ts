/** Headless command smoke test: kill hook rep + war-chest claim staging. */
import { freshWorldEvents, worldEventsOf, type InvasionEvent, type WorldEventState } from '../src/world-event-state.ts';
import { worldEventOnKill, claimWorldEventReward, pendingWorldEventReward, worldEventRewardProblem, type CheckpointWithWorldEvents } from '../src/world-event-command.ts';
import { freshJourneys } from '../src/journey-state.ts';
import type { Enemy, Player } from '../src/model.ts';
import type { Simulation } from '../src/simulation.ts';
import { freshChronicle } from '../src/chronicle.ts';
const state = freshWorldEvents();
const event: InvasionEvent = {
  id: 'invasion:0', index: 0, seed: 12345, zoneId: 'z', zoneName: 'Test Zone', level: 10,
  scaling: { base: 10, min: 4, max: 18 },
  anchor: { x: 100, y: 200 }, hint: { x: 100, y: 200 },
  startedAt: 0, endsAt: 600, phase: 'won',
  waves: { wave: 4, cleared: 4, elapsed: 30, rest: 0, held: 0, started: true, finished: true },
  guardians: [{ wave: 0, kind: 'stalker', rank: 'normal', seed: 1, hp: 0, x: 0, y: 0, admitted: true, dead: true }],
  boss: { hp: 0, x: 100, y: 200, admitted: true, dead: true },
  announced: true, bossAnnounced: true, wonAnnounced: true,
};
state.active = event;

const player = {
  x: 100, y: 200, dead: false, level: 10, xp: 0,
  derived: { goldFindMultiplier: 1, xpGainMultiplier: 1 },
  character: { name: 'T' }, chronicle: freshChronicle(), combatLog: [], reputation: undefined,
} as unknown as Player;

let nextId = 100;
const persisted: CheckpointWithWorldEvents[] = [];
const sim = {
  time: 500, player, enemies: [] as Enemy[], dungeonFloor: null,
  world: { seed: 7319, blocked: () => false },
  options: { seed: 7319 },
  get nextEntityIdentity() { return nextId; },
  captureCheckpoint() {
    return { chronicle: freshChronicle(), journeys: freshJourneys(), groundItems: [], groundGold: [],
      character: player.character, level: player.level, xp: player.xp, time: sim.time } as unknown as CheckpointWithWorldEvents;
  },
  commitEventCheckpoint(saved: CheckpointWithWorldEvents, _xp: number, _levels: number) {
    player.level = saved.level; player.xp = saved.xp;
  },
} as unknown as Simulation;

// Carrier install + kill hook.
const carrier = sim as unknown as { worldEvents?: WorldEventState };
carrier.worldEvents = state;
const killActor = { campId: 'worldEvent:invasion:0', campMemberId: '0', rank: 'veteran' } as Pick<Enemy, 'campId' | 'campMemberId' | 'rank'>;
console.log('kill hook (won event, still credits):', worldEventOnKill(sim, killActor));
console.log('rep after kill:', JSON.stringify(player.reputation));
console.log('non-event kill:', worldEventOnKill(sim, { campId: 'camp:x', campMemberId: '0', rank: 'normal' } as Pick<Enemy, 'campId' | 'campMemberId' | 'rank'>));

// Claim path.
console.log('pending:', pendingWorldEventReward(sim)?.id);
console.log('problem:', worldEventRewardProblem(sim, event));
const result = await claimWorldEventReward(sim, event, async cp => { persisted.push(cp); return { ok: true, message: 'saved' }; });
console.log('claim:', JSON.stringify(result));
console.log('staged phase:', persisted[0]?.worldEvents?.active?.phase, 'items:', persisted[0]?.groundItems?.length, 'gold:', persisted[0]?.groundGold?.length);
console.log('live phase:', worldEventsOf(sim).active?.phase, 'rep:', JSON.stringify(player.reputation));
console.log('reclaim blocked:', worldEventRewardProblem(sim, event));
console.log('pending after claim:', pendingWorldEventReward(sim));
