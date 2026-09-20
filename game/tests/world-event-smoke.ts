/** Headless lifecycle smoke test for world events. Run: node --experimental-strip-types tests/world-event-smoke.ts */
import { freshWorldEvents, advanceWorldEvents, worldEventProgress, worldEventMapMarkers, worldEventChestAt, validWorldEvents, type WorldEventContext } from '../src/world-event-state.ts';
import type { Enemy, Player } from '../src/model.ts';

import type { WorldEventWorld } from '../src/world-event-state.ts';
import type { CombatEvent } from '../src/model.ts';

const world: WorldEventWorld = {
  blocked: () => false,
  isSanctuary: () => false,
  sampleWater: () => ({ coverage: 0 }),
  getSettlements: () => [],
  getWildernessSites: () => [],
  navigationTarget: (x: number, y: number) => ({ x, y }),
  move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }),
  seed: 7319,
};

const player = { x: 0, y: 0, dead: false, level: 10 } as Player;
const enemies: Enemy[] = [];
let nextId = 1;
const events: CombatEvent[] = [];

const view = { x: -4000, y: -4000, width: 8000, height: 8000 };

const state = freshWorldEvents();
let time = 0;
const ctx: WorldEventContext = {
  dt: 0.1, state, player, enemies, world, view, time: 0, worldSeed: 7319, playerLevel: 10,
  spawn: (kind, x, y, rank, source) => {
    const e = { id: nextId++, kind, x, y, rank, hp: 100, maxHp: 100, state: 'idle', angle: 0,
      campId: source?.campId, campMemberId: source?.memberId, homeX: x, homeY: y } as unknown as Enemy;
    enemies.push(e); return e;
  },
  emit: e => events.push(e),
};

// 1. Schedule fires at firstAt.
for (let i = 0; i < 5000; i++) { ctx.time = time += 0.1; advanceWorldEvents(ctx); }
console.log('active:', !!state.active, 'phase:', state.active?.phase, 'anchor:', !!state.active?.anchor, 'zone:', state.active?.zoneName);
console.log('notices:', events.filter(e => e.type === 'notice').map(e => e.message));

// 2. Teleport player to anchor, run waves.
const ev = state.active!;
player.x = ev.anchor!.x; player.y = ev.anchor!.y;
for (let i = 0; i < 3000 && ev.phase === 'active'; i++) {
  ctx.time = time += 0.1;
  advanceWorldEvents(ctx);
  for (const e of enemies) if (e.campId && e.state !== 'dead') { e.state = 'dead'; e.hp = 0; }
}
console.log('spawned total:', enemies.length, 'guardians:', ev.guardians.length, 'waves finished:', ev.waves.finished, 'boss admitted:', ev.boss.admitted, 'phase:', ev.phase);
console.log('progress:', JSON.stringify(worldEventProgress(state, time)));

// 3. Markers + chest.
console.log('markers:', worldEventMapMarkers(state, time).map(m => `${m.kind}:${m.name}`));
console.log('chest at player:', !!worldEventChestAt(state, player));

// 4. Validation round-trip.
console.log('valid checkpoint:', validWorldEvents(JSON.parse(JSON.stringify(state))));

// 5. Expiry path: fresh state, never engage.
const s2 = freshWorldEvents();
const ctx2 = { ...ctx, state: s2, enemies: [] as Enemy[] };
let t2 = 0;
for (let i = 0; i < 12000; i++) { ctx2.time = t2 += 0.1; advanceWorldEvents(ctx2); }
console.log('expired history:', s2.history.map(e => e.phase), 'next active:', !!s2.active);
