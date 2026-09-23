import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RACE_STARTS, startingZone, raceFaction, playerFaction, factionAt, factionHostility,
  enemyHostility, enemyHuntsPlayer, playerCanAttack, reputationAxis, isFactionTag,
  CITY_FACTION_RADIUS, type FactionTag,
} from '../src/factions.ts';
import { zoneAt, zonePoint, zoneRect, ZONES } from '../src/world-atlas.ts';
import { ZONE_CONTENT } from '../src/zone-content.ts';
import { AuthoredWorld } from '../src/authored-world.ts';
import { WOW_RACES } from '../src/wow-races.ts';
import { WOW_RACE_IDS, type WowRaceId } from '../src/wow-types.ts';
import { FACTIONS } from '../src/reputation-content.ts';
import { Simulation } from '../src/simulation.ts';
import { updateEnemyAI, type EnemyAIContext } from '../src/enemy-ai.ts';
import { alertEnemy } from '../src/enemy-state.ts';
import { createCharacter } from '../src/character.ts';
import { initialPlayer } from '../src/simulation.ts';
import type { Enemy } from '../src/model.ts';

const ALLIANCE: readonly WowRaceId[] = ['human', 'dwarf', 'nightElf', 'gnome', 'draenei'];
const HORDE: readonly WowRaceId[] = ['orc', 'undead', 'tauren', 'troll', 'bloodElf'];
const EXPECTED_ZONE: Record<WowRaceId, string> = {
  human: 'elwynn', dwarf: 'dun-morogh', gnome: 'dun-morogh', nightElf: 'teldrassil',
  draenei: 'azuremyst', orc: 'durotar', troll: 'durotar', tauren: 'mulgore',
  undead: 'tirisfal', bloodElf: 'eversong',
};

test('every race maps to its faction and its WoW starting zone', () => {
  for (const race of WOW_RACE_IDS) {
    const start = startingZone(race);
    assert.equal(start.zone.id, EXPECTED_ZONE[race], `${race} starts in ${EXPECTED_ZONE[race]}`);
    assert.equal(start.faction, raceFaction(race));
    assert.equal(WOW_RACES[race].faction, start.faction, `${race} def faction matches start`);
    // The spawn lands inside the zone's world rect and the zone belongs to the race's faction.
    const r = zoneRect(start.zone.id)!;
    assert.ok(start.spawn.x >= r.x && start.spawn.x < r.x + r.w && start.spawn.y >= r.y && start.spawn.y < r.y + r.h,
      `${race} spawn inside ${start.zone.id}`);
    assert.equal(start.zone.faction, start.faction, `${race} zone is ${start.faction}`);
    assert.equal(zoneAt(start.spawn.x, start.spawn.y)?.id, start.zone.id);
  }
  for (const race of ALLIANCE) assert.equal(raceFaction(race), 'alliance', race);
  for (const race of HORDE) assert.equal(raceFaction(race), 'horde', race);
});

test('starting areas are named places; gnome/troll share their faction valley', () => {
  // WotLK: gnomes share Coldridge Valley with dwarves, trolls share the Valley
  // of Trials with orcs — 8 distinct areas across 10 races.
  const areas = new Set(WOW_RACE_IDS.map(r => RACE_STARTS[r].area));
  assert.equal(areas.size, WOW_RACE_IDS.length - 2, 'gnome/troll share dwarf/orc start');
  for (const r of WOW_RACE_IDS) assert.ok(RACE_STARTS[r].area.length > 0, `${r} has a named start`);
});

test('factionHostility resolves the full matrix', () => {
  // Same faction friendly, opposing hostile, neutral neutral, hostile/untagged hostile.
  for (const player of ['alliance', 'horde'] as const) {
    assert.equal(factionHostility(player, player), 'friendly');
    assert.equal(factionHostility(player === 'alliance' ? 'horde' : 'alliance', player), 'hostile');
    assert.equal(factionHostility('neutral', player), 'neutral');
    assert.equal(factionHostility('hostile', player), 'hostile');
    assert.equal(factionHostility(undefined, player), 'hostile', 'untagged mobs stay hostile');
  }
});

test('factionAt tags zone territory, city anchors, and ocean', () => {
  // Zone territory away from any city anchor.
  const durotar = zoneRect('durotar')!;
  assert.equal(factionAt(durotar.x + durotar.w * 0.5, durotar.y + durotar.h * 0.45), 'horde');
  const elwynn = zoneRect('elwynn')!;
  assert.equal(factionAt(elwynn.x + elwynn.w * 0.5, elwynn.y + elwynn.h * 0.45), 'alliance');
  // A faction city inside a contested zone overrides the neutral territory.
  const astranaar = zonePoint('ashenvale', 0.4, 0.55)!;
  assert.equal(factionAt(astranaar.x, astranaar.y), 'alliance', 'Astranaar is alliance');
  const splintertree = zonePoint('ashenvale', 0.72, 0.5)!;
  assert.equal(factionAt(splintertree.x, splintertree.y), 'horde', 'Splintertree is horde');
  // Contested wilderness without a nearby anchor is neutral; ocean is neutral.
  const ashenvale = zoneRect('ashenvale')!;
  assert.equal(factionAt(ashenvale.x + ashenvale.w * 0.5, ashenvale.y + ashenvale.h * 0.95), 'neutral');
  assert.equal(factionAt(-50000, -50000), 'neutral', 'ocean');
  // City anchors only tag their own radius.
  const orgrimmar = zonePoint('durotar', 0.45, 0.1)!;
  assert.equal(factionAt(orgrimmar.x, orgrimmar.y), 'horde');
  assert.equal(factionAt(orgrimmar.x + CITY_FACTION_RADIUS + 500, orgrimmar.y), 'horde',
    'durotar is horde territory anyway');
});

test('reputation factions ride the alliance/horde axis without duplicating the ledger', () => {
  assert.equal(reputationAxis('stormwind'), 'alliance');
  assert.equal(reputationAxis('warsong'), 'horde');
  for (const f of FACTIONS) if (f.id !== 'stormwind' && f.id !== 'warsong') assert.equal(reputationAxis(f.id), 'neutral', f.id);
  assert.equal(FACTIONS.length, 9, 'no umbrella factions were added');
});

test('isFactionTag accepts entity tags and rejects contested', () => {
  for (const tag of ['alliance', 'horde', 'neutral', 'hostile']) assert.ok(isFactionTag(tag));
  assert.ok(!isFactionTag('contested'));
  assert.ok(!isFactionTag('stormwind'));
  assert.ok(!isFactionTag(undefined));
});

// ── Live behavior ────────────────────────────────────────────────────────────
const world = { seed: 1, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
function fixture(race: WowRaceId = 'human') {
  const sim = new Simulation(world, { spawn: false });
  sim.player.character.raceId = race;
  sim.player.x = 0; sim.player.y = 0;
  const hits: number[] = [];
  const context: EnemyAIContext = {
    world, player: sim.player, players: [sim.player], enemies: sim.enemies, time: 0, trial: null, visible: () => true,
    move: (e, vx, vy, dt) => { e.x += vx * dt; e.y += vy * dt; },
    hurt: amount => hits.push(amount),
    shoot: () => {}, emit: () => {},
  };
  const tick = (e: Enemy) => { context.time += 1 / 120; e.stateTime += 1 / 120; updateEnemyAI(e, 1 / 120, context); };
  return { sim, context, hits, tick };
}
function tagged(sim: Simulation, faction: FactionTag, x = 60, y = 0): Enemy {
  const e = sim.spawnEnemy('stalker', x, y, 'normal',
    { campId: 'test:guard', memberId: `test:guard:${faction}`, lootSeed: 1, faction })!;
  e.stateDuration = 1e9; // hold idle; awareness alone must decide aggro
  return e;
}

test('opposing-faction guards aggro on sight; same-faction guards never do', () => {
  const { sim, hits, tick } = fixture('human');
  const horde = tagged(sim, 'horde');
  for (let i = 0; i < 600 && horde.state !== 'chase'; i++) tick(horde);
  assert.equal(horde.state, 'chase', 'horde guard hunts the alliance player');

  const ally = tagged(sim, 'alliance', -60, 0);
  for (let i = 0; i < 600; i++) tick(ally);
  assert.ok(ally.state === 'idle' || ally.state === 'patrol', 'alliance guard stays peaceful');
  assert.equal(ally.awareness, 0, 'friendly guard never builds awareness');
  assert.equal(hits.length, 0);
});

test('neutral actors never aggro on sight but retaliate when alerted', () => {
  const { sim, tick } = fixture('orc');
  const neutral = tagged(sim, 'neutral');
  for (let i = 0; i < 600; i++) tick(neutral);
  assert.ok(neutral.state === 'idle' || neutral.state === 'patrol', 'neutral actor ignores the player');
  alertEnemy(neutral, sim.player);
  assert.equal(neutral.state, 'chase', 'alerted neutral actor retaliates');
  for (let i = 0; i < 120; i++) tick(neutral);
  assert.ok(['chase', 'windup', 'attack', 'recover'].includes(neutral.state), 'and keeps hunting');
});

test('a friendly actor forced into combat disengages and walks home', () => {
  const { sim, tick } = fixture('dwarf');
  const ally = tagged(sim, 'alliance');
  ally.x = 400; // away from home so 'return' persists past one tick
  ally.state = 'chase'; ally.awareness = 1; ally.seesPlayer = true;
  tick(ally);
  assert.equal(ally.state, 'return', 'friendly actor disengages');
  for (let i = 0; i < 600 && ally.state === 'return'; i++) tick(ally);
  assert.ok(ally.state === 'idle' || ally.state === 'patrol', 'and settles back home');
});

test('friendly faction actors cannot be damaged or tab-targeted', () => {
  const { sim } = fixture('nightElf');
  const ally = tagged(sim, 'alliance');
  const hp = ally.hp;
  // Simulation.damageEnemy is private; bind it once to reach the player→enemy damage funnel.
  const damageEnemy = (sim as unknown as { damageEnemy(e: Enemy, d: number, a: number, m: boolean): void }).damageEnemy.bind(sim);
  damageEnemy(ally, 50, 0, true);
  assert.equal(ally.hp, hp, 'friendly actor takes no damage');
  assert.equal(ally.awareness, 0, 'blocked damage never alerts');
  assert.equal(sim.tabTarget(), null, 'friendly actor is not a tab target');
  const hostile = tagged(sim, 'horde', 30, 0);
  assert.equal(sim.tabTarget(), hostile.id, 'hostile actors still tab-target');
});

test('spawnEnemy stamps the source faction tag', () => {
  const { sim } = fixture();
  assert.equal(tagged(sim, 'horde').faction, 'horde');
  assert.equal(sim.spawnEnemy('hound', 200, 0)!.faction, undefined, 'untagged mobs stay untagged');
});

test('createCharacter places the hero at the racial starting spawn', () => {
  for (const race of WOW_RACE_IDS) {
    const player = initialPlayer(0, 0);
    const result = createCharacter(player, 'Hero', WOW_RACES[race].classes[0], race);
    assert.ok(result.ok, `${race} can play ${WOW_RACES[race].classes[0]}`);
    const start = startingZone(race);
    assert.equal(player.x, start.spawn.x, `${race} x`);
    assert.equal(player.y, start.spawn.y, `${race} y`);
    assert.equal(zoneAt(player.x, player.y)?.id, start.zone.id);
  }
});

test('death knights start at level 55 in Acherus with earned points', () => {
  const player = initialPlayer(0, 0);
  const result = createCharacter(player, 'DK', 'deathKnight', 'human');
  assert.ok(result.ok);
  assert.equal(player.level, 55, 'hero class starts at 55');
  assert.equal(zoneAt(player.x, player.y)?.id, 'eastern-plaguelands', 'Acherus sits in EPL');
  assert.equal(player.character.skillPoints, 54, 'one point per level past 1');
  assert.equal(player.character.statPoints, 54 * 5, 'five attribute points per level');
});

test('playerFaction reads the sheet race', () => {
  const player = initialPlayer(0, 0);
  player.character.raceId = 'tauren';
  assert.equal(playerFaction(player), 'horde');
  assert.equal(enemyHostility({ faction: 'alliance' }, player), 'hostile');
  assert.ok(enemyHuntsPlayer({ faction: 'alliance' }, player));
  assert.ok(!playerCanAttack({ faction: 'horde' }, player));
});

test('every faction town fields a guard post and contested zones field faction camps', () => {
  for (const [id, zone] of Object.entries(ZONES)) {
    const content = ZONE_CONTENT[id];
    if (!content) continue;
    const factionTowns = content.towns.filter(t => t.faction === 'alliance' || t.faction === 'horde');
    for (const town of factionTowns) {
      const post = content.camps.find(c => c.faction === town.faction && c.name === `${town.name} Guard Post`);
      assert.ok(post, `${id}: ${town.name} has a ${town.faction} guard post`);
      assert.ok(post.members?.length, `${id}: ${town.name} guard post has a garrison`);
    }
    const factions = new Set(factionTowns.map(t => t.faction));
    if (zone.faction === 'contested' && factions.size === 2)
      for (const faction of factions)
        assert.ok(content.camps.some(c => c.faction === faction), `${id}: contested zone fields a ${faction} camp`);
  }
});

test('authored guard posts spawn faction-tagged garrisons outside the sanctuary', () => {
  const world = new AuthoredWorld(1);
  const rect = zoneRect('durotar')!;
  const camps = world.getEnemyCamps(rect.x, rect.y, rect.w, rect.h);
  const post = camps.find(c => c.name === 'Razor Hill Guard Post');
  assert.ok(post, 'Razor Hill guard post exists');
  assert.equal(post.faction, 'horde');
  assert.ok(post.members.length > 0 && post.members.every(m => m.faction === 'horde'), 'garrison inherits the tag');
  assert.ok(!world.isSanctuary(post.x, post.y), 'guards spawn outside the town sanctuary');
  const alliance = { character: { raceId: 'human' as const } }, horde = { character: { raceId: 'orc' as const } };
  assert.ok(enemyHuntsPlayer(post, alliance), 'horde guards hunt the alliance player');
  assert.ok(!enemyHuntsPlayer(post, horde), 'horde guards ignore the horde player');
  assert.ok(!playerCanAttack(post, horde), 'same-faction guards are unattackable');
  const goldshire = world.getEnemyCamps(...(() => { const r = zoneRect('elwynn')!; return [r.x, r.y, r.w, r.h] as const; })())
    .find(c => c.name === 'Goldshire Guard Post');
  assert.ok(goldshire?.faction === 'alliance', 'Goldshire guard post is alliance');
  assert.ok(enemyHuntsPlayer(goldshire!, horde), 'alliance guards hunt the horde player');
});
