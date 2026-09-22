import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_RANKS } from '../src/progression-content.ts';
import { getLootTable } from '../src/loot-content.ts';
import { enemyLootCount, lootItemLevel, rollEnemyLoot } from '../src/loot.ts';
import { chooseEncounterRank, encounterRankChances } from '../src/encounter-director.ts';
import { scaledEnemyStats } from '../src/zone-progression.ts';
import { enemyThreat } from '../src/enemy-threat.ts';
import { enemyVisualScale, enemyModifiers } from '../src/enemy-modifiers.ts';
import { enemyBodyBounds } from '../src/enemy-body.ts';
import { RANK_METALS } from '../src/enemy-rank-art.ts';
import { rollEnemyGold } from '../src/gold.ts';
import { bossFrameEligible } from '../src/boss-frame.ts';
import { enemyMapIconId } from '../src/map-legend-content.ts';
import { riftPoints } from '../src/rift-content.ts';
import { KILL_REP } from '../src/reputation-content.ts';
import { enemyDisplayName, rareEnemyName, ZONE_RARE_NAMES, BIOME_RARE_NAMES } from '../src/zone-roster.ts';
import { collectNameplates } from '../src/nameplate.ts';
import { achievementTrack, achievementProgress } from '../src/achievement-state.ts';
import { ACHIEVEMENT_BY_ID } from '../src/achievement-content.ts';
import { Simulation } from '../src/simulation.ts';
import { zonePoint } from '../src/world-atlas.ts';
import { BIOME_IDS } from '../src/biomes.ts';
import type { Enemy, WorldQuery } from '../src/model.ts';
import '../src/zone-content-kalimdor.ts';
import '../src/zone-content-eastern-kingdoms.ts';
import '../src/zone-content-northrend.ts';
import '../src/zone-content-outland.ts';

const open: WorldQuery = { blocked: () => false, move: (x, y) => ({ x, y }), sampleBiome: () => ({ id: 'deadwood' }) };
const make = () => new Simulation(open, { spawn: false, seed: 42 });

/** Rare spawn at a zone's center; homeX/homeY anchor the rare-name lookup. */
const rareAt = (sim: Simulation, zoneId: string, kind: Enemy['kind'], lootSeed: number): Enemy => {
  const p = zonePoint(zoneId, .5, .5)!;
  return sim.spawnEnemy(kind, p.x, p.y, 'rare', { campId: 'test', memberId: `rare:${lootSeed}`, lootSeed })!;
};

test('rare is a registered rank between elite and boss', () => {
  const rare = ENEMY_RANKS.rare;
  assert.equal(rare.name, 'Rare');
  assert.ok(Object.isFrozen(rare));
  // ~1.5x elite durability, stronger damage and XP than elite.
  assert.equal(rare.healthMultiplier / ENEMY_RANKS.elite.healthMultiplier, 1.5);
  assert.ok(rare.damageMultiplier > ENEMY_RANKS.elite.damageMultiplier);
  assert.ok(rare.xpMultiplier > ENEMY_RANKS.elite.xpMultiplier);
  // Scaled stats reflect the rank and share the elite durability ramp.
  const elite = scaledEnemyStats('stalker', 37, 'elite'), named = scaledEnemyStats('stalker', 37, 'rare');
  assert.ok(Math.abs(named.maxHp / elite.maxHp - 1.5) < .001, `rare hp ${named.maxHp} vs elite ${elite.maxHp}`);
  // Threat profile sits between elite and boss; rares resist control like elites.
  const threat = enemyThreat({ kind: 'stalker', rank: 'rare' });
  assert.ok(threat.controlFactor < enemyThreat({ kind: 'stalker', rank: 'elite' }).controlFactor);
  assert.ok(threat.controlFactor > 0);
  assert.ok(threat.knockback < enemyThreat({ kind: 'stalker', rank: 'elite' }).knockback);
  // Rares read bigger than elites and keep the two-trait modifier pool.
  assert.ok(enemyVisualScale({ kind: 'stalker', rank: 'rare' }) > enemyVisualScale({ kind: 'stalker', rank: 'elite' }));
  assert.equal(enemyModifiers({ kind: 'stalker', rank: 'rare', lootSeed: 7 }).length, 2);
  assert.ok(enemyBodyBounds({ kind: 'stalker', rank: 'rare' }).radiusX > enemyBodyBounds({ kind: 'stalker', rank: 'elite' }).radiusX);
});

test('silver heraldry and frame treatment distinguish rares', () => {
  assert.ok(RANK_METALS.rare, 'rare metal exists for the silver crest');
  assert.notEqual(RANK_METALS.rare.edge, RANK_METALS.elite.edge);
  assert.ok(bossFrameEligible({ kind: 'stalker', rank: 'rare' }), 'rare earns the portrait plate');
  assert.ok(!bossFrameEligible({ kind: 'stalker', rank: 'veteran' }));
  assert.equal(enemyMapIconId({ kind: 'stalker', rank: 'rare' }), 'enemy:rare');
  // World-space nameplate carries the rare (silver) crest.
  const sim = make();
  const enemy = rareAt(sim, 'elwynn', 'stalker', 7);
  const view = { zoom: 1, offsetX: 500 - enemy.x, offsetY: 400 - enemy.y, left: 0, top: 0, width: 1000, height: 800 };
  const plate = collectNameplates(sim, view).find(n => n.id === enemy.id)!;
  assert.equal(plate.crest, 'rare');
  assert.equal(plate.rank, 'rare');
});

test('seeded rare spawns are sparse, level-gated and deterministic', () => {
  // No rares below level 5; the slice stays a sliver at the cap.
  for (const level of [1, 2, 3, 4]) assert.equal(encounterRankChances(level).rare, 0);
  assert.ok(encounterRankChances(5).rare > 0);
  assert.ok(encounterRankChances(1_000_000).rare <= .02);
  for (const level of [1, 5, 20, 80, 500]) {
    const chances = encounterRankChances(level);
    assert.ok(Math.abs(chances.normal + chances.veteran + chances.elite + chances.rare - 1) < 1e-10);
  }
  // The rare slice owns the bottom of the roll range.
  const rare = encounterRankChances(20).rare;
  assert.equal(chooseEncounterRank(20, 0), 'rare');
  assert.equal(chooseEncounterRank(20, rare - Number.EPSILON), 'rare');
  assert.equal(chooseEncounterRank(20, rare), 'elite');
  // Same level + roll always yields the same rank.
  for (const roll of [0, .005, .02, .5, .999])
    assert.equal(chooseEncounterRank(30, roll), chooseEncounterRank(30, roll));
});

test('rare spawns carry unique zone names, seeded and stable', () => {
  const sim = make();
  const a = rareAt(sim, 'elwynn', 'stalker', 7);
  assert.ok(ZONE_RARE_NAMES['elwynn'].includes(enemyDisplayName(a)), `expected an Elwynn rare name, got ${enemyDisplayName(a)}`);
  assert.equal(rareEnemyName(a), enemyDisplayName(a));
  // Same seed → same name; a different seed rotates the pool.
  const b = rareAt(sim, 'elwynn', 'stalker', 7);
  assert.equal(enemyDisplayName(b), enemyDisplayName(a));
  const names = new Set([...Array(ZONE_RARE_NAMES['elwynn'].length * 2).keys()]
    .map(seed => enemyDisplayName(rareAt(sim, 'elwynn', 'stalker', seed))));
  assert.ok(names.size > 1, 'seed rotates the zone pool');
  // Different zones name different rares; biome pools cover unlisted zones.
  const northrend = rareAt(sim, 'icecrown', 'stalker', 7);
  assert.ok(ZONE_RARE_NAMES['icecrown'].includes(enemyDisplayName(northrend)));
  assert.notEqual(enemyDisplayName(a), enemyDisplayName(northrend));
  const wilds = sim.spawnEnemy('stalker', -4e7 + 5, -4e7 + 5, 'rare', { campId: 'test', memberId: 'wilds', lootSeed: 3 })!;
  assert.ok(BIOME_RARE_NAMES[wilds.biome].includes(enemyDisplayName(wilds)));
  // Non-rare ranks never take a rare name; dungeon actors keep theme names.
  const normal = sim.spawnEnemy('stalker', zonePoint('elwynn', .5, .5)!.x, zonePoint('elwynn', .5, .5)!.y, 'normal')!;
  assert.equal(rareEnemyName(normal), null);
  assert.ok(!ZONE_RARE_NAMES['elwynn'].includes(enemyDisplayName(normal)));
  assert.equal(rareEnemyName({ ...a, dungeonTheme: 'rootbound' }), null);
  // Every authored pool is non-empty and every biome has a fallback.
  for (const pool of Object.values(ZONE_RARE_NAMES)) assert.ok(pool.length > 0);
  assert.deepEqual(Object.keys(BIOME_RARE_NAMES).sort(), [...BIOME_IDS].sort());
});

test('rare kills drop from the rare table: guaranteed rare+, +1 item level over elite', () => {
  const table = getLootTable('rare');
  assert.equal(table.guaranteedItems, 1);
  assert.equal(table.itemLevelBonus, getLootTable('elite').itemLevelBonus + 1);
  assert.equal(table.tierWeights.common, 0);
  assert.equal(table.tierWeights.magic, 0);
  assert.ok(table.tierWeights.unique > 0, 'unique named-drop chance');
  assert.ok(Math.abs(Object.values(table.tierWeights).reduce((sum, w) => sum + w, 0) - 100) < 1e-10);
  assert.equal(enemyLootCount('rare', .999), 1);
  assert.equal(enemyLootCount('rare', 0), 2);
  assert.equal(lootItemLevel(20, 'rare'), lootItemLevel(20, 'elite') + 1);
  // Every rolled item is rare tier or better.
  for (let seed = 0; seed < 40; seed++)
    for (const item of rollEnemyLoot({ playerLevel: 20, seed, level: 20, rank: 'rare', biome: 'deadwood', kind: 'stalker' }))
      assert.ok(['rare', 'epic', 'legendary', 'unique'].includes(item.tier), `unexpected tier ${item.tier}`);
  // Gold and side tables know the rank.
  assert.ok(rollEnemyGold(1234, 20, 'rare') > rollEnemyGold(1234, 20, 'normal'));
  assert.equal(riftPoints('rare'), 6);
  assert.equal(KILL_REP.rare, 30);
});

test('rare kills credit Bloody Rare once per distinct named rare', () => {
  const sim = make();
  const player = sim.player;
  const def = ACHIEVEMENT_BY_ID['bloody-rare'];
  assert.ok(def && def.criterion.kind === 'distinctRares');
  const kill = (enemy: Enemy) =>
    achievementTrack(player, { type: 'kill', x: 0, y: 0, angle: 0, facing: 0, targetId: enemy.id, remainingHp: 0, enemyKind: enemy.kind }, sim.enemies, 1_800_000_000_000);
  // Two kills of the same named rare count once.
  const hogger = rareAt(sim, 'elwynn', 'stalker', 0);
  kill(hogger); kill(hogger);
  assert.equal(achievementProgress(def, player).value, 1);
  // Different names accumulate; non-rare kills never count. One rare per zone
  // pool (seed 0 → the pool's first name) guarantees nine more distinct names.
  const zones = Object.keys(ZONE_RARE_NAMES).filter(id => id !== 'elwynn');
  for (const zone of zones.slice(0, 9)) kill(rareAt(sim, zone, 'stalker', 0));
  const normal = sim.spawnEnemy('stalker', 0, 0, 'normal')!;
  kill(normal);
  const progress = achievementProgress(def, player);
  assert.equal(progress.target, 10);
  assert.equal(progress.value, 10);
  assert.ok(player.achievements!['bloody-rare'] >= 1e9, 'achievement stamped complete');
  assert.ok(Object.keys(player.achievements!).filter(k => k.startsWith('seen:rare:')).length >= 10);
});
