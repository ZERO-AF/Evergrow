import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP } from '../src/simulation.ts';
import { recordThreat, resolveThreatHolder, threatTable } from '../src/enemy-threat.ts';
import { partyComposition } from '../src/party-content.ts';
import { despawnDungeonParty, isPartyAlly, partyAllies, partyRoster, spawnDungeonParty } from '../src/party-state.ts';
import { tickDungeonParty } from '../src/party-ai.ts';
import { validDungeonFinder } from '../src/dungeon-finder-state.ts';
import { createWowSim, idleInput } from './fixtures/wow-sim.ts';

/** Pretend the run is live without building a floor: the tick only checks location. */
function inDungeon(sim: ReturnType<typeof createWowSim>) {
  sim.expeditions.location = 'test:dungeon';
}
function tick(sim: ReturnType<typeof createWowSim>, seconds: number) {
  for (let t = 0; t < seconds; t += FIXED_STEP) { sim.update(FIXED_STEP, idleInput); tickDungeonParty(sim); }
}

test('partyComposition is deterministic and role-correct', () => {
  const a = partyComposition(12345), b = partyComposition(12345);
  assert.deepEqual(a, b);
  assert.equal(a.length, 4);
  assert.deepEqual(a.map(m => m.role), ['tank', 'healer', 'dps', 'dps']);
  assert.equal(new Set(a.map(m => m.name)).size, 4, 'names are unique');
  assert.notEqual(a[2]!.classId, a[3]!.classId, 'the two dps differ');
  assert.ok(a.every(m => m.color && m.name && m.kind.startsWith('party')));
});

test('spawnDungeonParty summons four role-correct allies scaled off the player', () => {
  const sim = createWowSim('mage');
  inDungeon(sim);
  const members = spawnDungeonParty(sim, 777);
  assert.equal(members.length, 4);
  assert.equal(partyAllies(sim).length, 4);
  assert.deepEqual(members.map(m => m.party.role), ['tank', 'healer', 'dps', 'dps']);
  const tank = members[0]!;
  assert.equal(tank.kind, 'partyTank');
  assert.ok(tank.maxHp > sim.player.maxHp, 'tank is the durable one');
  assert.ok(tank.hp === tank.maxHp && tank.damage > 0);
  // Members arrive beside the player, not on top of them.
  for (const m of members) assert.ok(Math.hypot(m.x - sim.player.x, m.y - sim.player.y) < 60);
  // The roster feeds party frames in spawn order.
  const roster = partyRoster(sim);
  assert.equal(roster.length, 4);
  assert.deepEqual(roster.map(r => r.role), ['tank', 'healer', 'dps', 'dps']);
  assert.ok(roster.every(r => !r.dead && r.hp === r.maxHp));
});

test('the tank taunts an enemy off the player and holds the threat table', () => {
  const sim = createWowSim('mage');
  inDungeon(sim);
  const [tank] = spawnDungeonParty(sim, 42);
  const enemy = sim.spawnEnemy('stalker', sim.player.x + 40, sim.player.y, 'normal', undefined, { base: 5, min: 5, max: 5, fixed: true })!;
  enemy.awareness = 1; enemy.state = 'chase';
  // The player opened the fight; the tank should peel it off.
  recordThreat(enemy, 'player', 500);
  tickDungeonParty(sim);
  assert.equal(enemy.taunted?.allyId, tank!.id, 'taunt compels the enemy onto the tank');
  assert.equal(resolveThreatHolder(enemy, sim.player, sim.player.allies ?? []), `ally:${tank!.id}`);
  // The threat trickle keeps the tank ahead of fresh damage.
  const before = threatTable(enemy)!.entries.get(`ally:${tank!.id}`) ?? 0;
  tick(sim, 1.5);
  assert.ok((threatTable(enemy)!.entries.get(`ally:${tank!.id}`) ?? 0) > before, 'defensive stance accrues threat');
});

test('dps focus the tank target and allies fight dungeon enemies', () => {
  const sim = createWowSim('mage');
  inDungeon(sim);
  const members = spawnDungeonParty(sim, 99);
  const tank = members[0]!;
  // The attack table covers arrows and spells now, so the target must be at the
  // party's own level or every allied hit misses outright.
  const enemy = sim.spawnEnemy('stalker', sim.player.x + 30, sim.player.y, 'elite', undefined, { base: 1, min: 1, max: 1, fixed: true })!;
  enemy.awareness = 1; enemy.state = 'chase';
  tickDungeonParty(sim);
  assert.equal(tank.targetId, enemy.id, 'tank engages the aware enemy');
  for (const dps of members.filter(m => m.party.role === 'dps'))
    assert.equal(dps.targetId, enemy.id, 'dps assist the tank');
  // The generic ally tick lands hits through the shared damage/threat path.
  const hp = enemy.hp;
  tick(sim, 3);
  assert.ok(enemy.hp < hp, 'party members damage the enemy');
  assert.ok((threatTable(enemy)?.entries.get(`ally:${tank.id}`) ?? 0) > 0, 'tank hits record ally threat');
});

test('the healer heals the lowest-hp party member and owns the heal threat', () => {
  const sim = createWowSim('mage');
  inDungeon(sim);
  const members = spawnDungeonParty(sim, 7);
  const healer = members.find(m => m.party.role === 'healer')!;
  const dps = members.find(m => m.party.role === 'dps')!;
  dps.hp = Math.floor(dps.maxHp * 0.3);
  sim.player.hp = Math.floor(sim.player.maxHp * 0.6);
  const enemy = sim.spawnEnemy('stalker', sim.player.x + 50, sim.player.y, 'normal', undefined, { base: 5, min: 5, max: 5, fixed: true })!;
  enemy.awareness = 1; enemy.state = 'chase';
  tickDungeonParty(sim);
  assert.ok(dps.hp > dps.maxHp * 0.3, 'the lowest-hp member is healed first');
  assert.ok((threatTable(enemy)?.entries.get(`ally:${healer.id}`) ?? 0) > 0, 'heals credit the healer, not the player');
  assert.equal(threatTable(enemy)?.entries.get('player') ?? 0, 0);
  // Next tick heals the player once the dps is topped past the threshold.
  const playerHp = sim.player.hp;
  healer.party.healReady = 0;
  tickDungeonParty(sim);
  assert.ok(sim.player.hp > playerHp, 'the healer moves on to the player');
});

test('dead members stay dead and listed; the party despawns when the run ends', () => {
  const sim = createWowSim('mage');
  inDungeon(sim);
  const members = spawnDungeonParty(sim, 5);
  const dps = members.find(m => m.party.role === 'dps')!;
  dps.hp = 0;
  tick(sim, 0.5); // updateAllies filters the corpse; nothing respawns it
  assert.ok(!partyAllies(sim).includes(dps), 'dead members leave the live list');
  const roster = partyRoster(sim);
  assert.equal(roster.length, 4);
  assert.ok(roster.find(r => r.allyId === dps.id)?.dead, 'the frame keeps the fallen member');
  // Leaving the dungeon clears the group.
  sim.expeditions.location = null;
  tickDungeonParty(sim);
  assert.equal(partyAllies(sim).length, 0);
  assert.equal(partyRoster(sim).length, 0);
  assert.ok(!(sim.player.allies ?? []).some(isPartyAlly));
});

test('party allies survive a checkpoint restore inside the dungeon', () => {
  const sim = createWowSim('mage');
  inDungeon(sim);
  const members = spawnDungeonParty(sim, 314);
  const saved = sim.captureCheckpoint();
  sim.restoreCheckpoint(saved);
  const restored = partyAllies(sim);
  assert.equal(restored.length, 4);
  assert.deepEqual(restored.map(m => m.party.role), members.map(m => m.party.role));
  assert.ok(restored.every(m => m.party.name && m.targetId === null));
  assert.equal(partyRoster(sim).length, 4);
});

test('despawnDungeonParty removes only party members, never pets or totems', () => {
  const sim = createWowSim('mage');
  inDungeon(sim);
  sim.summonAlly('searingTotem', 1, 30);
  spawnDungeonParty(sim, 1);
  assert.equal((sim.player.allies ?? []).length, 5);
  despawnDungeonParty(sim);
  const left = sim.player.allies ?? [];
  assert.equal(left.length, 1);
  assert.equal(left[0]!.kind, 'searingTotem');
});

test('the Find Group queue marker round-trips through save validation', () => {
  assert.ok(validDungeonFinder({ queued: 'rdf:westfall:0', queuedAt: 1, party: true }));
  assert.ok(validDungeonFinder({ queued: 'rdf:westfall:0', queuedAt: 1, heroic: true, party: true }));
  assert.ok(validDungeonFinder({ queued: 'rdf:westfall:0', queuedAt: 1 }));
  assert.ok(!validDungeonFinder({ queued: 'rdf:westfall:0', queuedAt: 1, party: 'yes' }));
});
