import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { createCharacterSheet } from '../src/items.ts';
import { knowsSkill, learnedSkillRank, SKILL_RANK_RULES } from '../src/skill-progression.ts';
import { WOW_CLASS_SKILLS } from '../src/wow-skills.ts';
import { WOW_CLASS_IDS } from '../src/wow-types.ts';
import { MAX_PLAYER_LEVEL } from '../src/progression-content.ts';
import { trainerStock, TRAINER_CATALOG, trainerLearnable } from '../src/trainer-content.ts';
import { canLearnSkill, canUpgradeRank, learnPrice, rankPrice, trainedNodeIds, trainedRankCount, validTrainerLedger, type TrainedSheet } from '../src/trainer-state.ts';
import { executeLearnSkill, executeUpgradeRank } from '../src/trainer-command.ts';
import { trainerFor, trainersNear, focusedTrainer } from '../src/trainer-npc.ts';
import type { Building } from '../src/settlements.ts';
import type { ActionResult } from '../src/character-types.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }), isSanctuary: () => false };
const ok = async (): Promise<ActionResult> => ({ ok: true });

const chapel = (id = '7319:building:4'): Building => ({
  id, seed: 1, name: 'Chapel', kind: 'chapel', x: 0, y: 0, width: 120, height: 100,
  door: { x: 60, y: 100, width: 42 }, walls: [], furniture: [],
});

const rig = (classId: 'warrior' | 'mage' = 'warrior', level = 80, gold = 10_000_000) => {
  const sim = new Simulation(world, { spawn: false });
  const p = sim.player;
  p.character = createCharacterSheet(classId);
  p.level = level;
  p.character.gold = gold;
  return { sim, p, sheet: p.character as TrainedSheet };
};

test('trainer stock is per-class, level-gated and gold-priced', () => {
  for (const classId of WOW_CLASS_IDS) {
    const kit = WOW_CLASS_SKILLS[classId];
    const stock = trainerStock(classId, 1);
    assert.equal(stock.length, kit.length);
    assert.ok(stock.every(entry => entry.kind === 'learn' && entry.cost > 0 && entry.requiredLevel >= 1 && entry.requiredLevel <= MAX_PLAYER_LEVEL));
    assert.ok(stock.every(entry => kit.some(skill => skill.id === entry.skillId)), 'stock only sells the class kit');
    // Level 1 only unlocks the cheapest early skills; the cap unlocks everything.
    assert.ok(stock.some(entry => entry.locked));
    assert.ok(trainerStock(classId, MAX_PLAYER_LEVEL).every(entry => !entry.locked));
  }
  // A warrior trainer never lists mage spells and vice versa.
  assert.ok(!trainerStock('warrior', 80).some(entry => entry.skillId === 'frostbolt'));
  assert.ok(!trainerStock('mage', 80).some(entry => entry.skillId === 'heroicStrike'));
  // Capstones cost far more than early skills (WotLK curve).
  const warrior = TRAINER_CATALOG.warrior;
  const cheapest = Math.min(...warrior.map(entry => entry.cost));
  const priciest = Math.max(...warrior.map(entry => entry.cost));
  assert.ok(priciest > cheapest * 20, `${priciest} should dwarf ${cheapest}`);
});

test('known skills surface as rank rows with a level gate and growing price', () => {
  const { sheet } = rig('warrior', 80);
  // heroicStrike is the free starter — already known at creation.
  const stock = trainerStock('warrior', 80, sheet);
  const heroic = stock.find(entry => entry.skillId === 'heroicStrike')!;
  assert.equal(heroic.kind, 'rank');
  assert.equal(heroic.rank, 2);
  assert.ok(heroic.cost > 0 && !heroic.locked);
  // A low-level character sees the rank row locked behind its level gate.
  const low = trainerStock('warrior', 1, sheet).find(entry => entry.skillId === 'heroicStrike')!;
  assert.equal(low.locked, true);
  assert.match(low.reason!, /Requires level/);
  // Max rank reads as a locked max-rank row.
  sheet.skillRanks.heroicStrike = SKILL_RANK_RULES.maximum;
  const maxed = trainerStock('warrior', 80, sheet).find(entry => entry.skillId === 'heroicStrike')!;
  assert.equal(maxed.locked, true);
  assert.equal(maxed.reason, 'Max rank');
});

test('canLearnSkill gates on kit membership, known state, level and gold', () => {
  const { p, sheet } = rig('warrior', 80);
  assert.equal(canLearnSkill(p, 'heroicStrike'), 'Already learned.');
  assert.equal(canLearnSkill(p, 'frostbolt'), 'Your class cannot learn that.');
  assert.equal(canLearnSkill(p, 'cleave'), 'Your class cannot learn that.');
  const entry = trainerLearnable('warrior', 'charge')!;
  assert.equal(canLearnSkill(p, 'charge'), null);
  p.level = entry.requiredLevel - 1;
  assert.match(canLearnSkill(p, 'charge')!, /Requires level/);
  p.level = 80;
  sheet.gold = entry.cost - 1;
  assert.equal(canLearnSkill(p, 'charge'), 'Not enough gold.');
});

test('canUpgradeRank requires a known class skill and prices the next rank', () => {
  const { p, sheet } = rig('warrior', 80);
  assert.equal(canUpgradeRank(p, 'charge'), 'Learn this skill first.');
  assert.equal(canUpgradeRank(p, 'frostbolt'), 'Your class cannot train that.');
  assert.equal(canUpgradeRank(p, 'heroicStrike'), null);
  assert.equal(rankPrice(sheet, 'heroicStrike'), trainerStock('warrior', 80, sheet).find(e => e.skillId === 'heroicStrike')!.cost);
  sheet.skillRanks.heroicStrike = SKILL_RANK_RULES.maximum;
  assert.equal(canUpgradeRank(p, 'heroicStrike'), 'Already at max rank.');
  assert.equal(rankPrice(sheet, 'heroicStrike'), null);
});

test('executeLearnSkill debits gold, allocates the sanctum node and ledgers the grant', async () => {
  const { sim, p } = rig('warrior', 80);
  const price = learnPrice('charge')!;
  const goldBefore = p.character.gold!;
  const result = await executeLearnSkill(sim, 'charge', ok);
  assert.equal(result.ok, true);
  const sheet = p.character as TrainedSheet;
  assert.equal(sheet.gold, goldBefore - price);
  assert.ok(sheet.allocatedNodes.includes('wow-warrior-charge'));
  assert.ok(knowsSkill(sheet, 'charge'));
  assert.deepEqual(trainedNodeIds(sheet), ['wow-warrior-charge']);
  assert.equal(learnedSkillRank(sheet, 'charge'), 1);
  // Second purchase refuses without spending again.
  const again = await executeLearnSkill(sim, 'charge', ok);
  assert.equal(again.ok, false);
  assert.equal((p.character as TrainedSheet).gold, goldBefore - price);
});

test('executeLearnSkill leaves the live sheet untouched when persist fails', async () => {
  const { sim, p } = rig('warrior', 80);
  const before = structuredClone(p.character);
  const result = await executeLearnSkill(sim, 'charge', async () => ({ ok: false, message: 'Storage unavailable.' }));
  assert.equal(result.ok, false);
  assert.deepEqual(p.character, before);
  assert.equal(knowsSkill(p.character, 'charge'), false);
});

test('executeUpgradeRank debits gold and bumps the real rank records', async () => {
  const { sim, p } = rig('warrior', 80);
  const price = rankPrice(p.character, 'heroicStrike')!;
  const goldBefore = p.character.gold!;
  const result = await executeUpgradeRank(sim, 'heroicStrike', ok);
  assert.equal(result.ok, true);
  const sheet = p.character as TrainedSheet;
  assert.equal(sheet.gold, goldBefore - price);
  assert.equal(sheet.skillRanks.heroicStrike, 2);
  assert.equal(sheet.activeSkillRanks.heroicStrike, 2);
  assert.equal(trainedRankCount(sheet, 'heroicStrike'), 1);
  // The ledger keeps the save's point math balanced: rank 2 with zero points spent.
  assert.equal(sheet.skillPoints, 0);
});


test('trainer NPCs anchor to chapels and focus like other service NPCs', () => {
  const building = chapel();
  const trainer = trainerFor(building)!;
  assert.equal(trainer.role, 'trainer');
  assert.equal(trainer.buildingId, building.id);
  assert.equal(trainerFor({ ...building, kind: 'noble' }), null);
  const near = trainersNear({ ...world, getBuildings: () => [building, { ...building, id: 'x:building:9', kind: 'noble' as const }] }, 0, 0, 500, 500);
  assert.deepEqual(near.map(n => n.id), [trainer.id]);
  const player = { x: trainer.x + 10, y: trainer.y, dead: false };
  assert.equal(focusedTrainer(near, player, world)?.id, trainer.id);
  assert.equal(focusedTrainer(near, { ...player, x: trainer.x + 500 }, world), null);
  assert.equal(focusedTrainer(near, { ...player, dead: true }, world), null);
});

test('validTrainerLedger accepts real ledgers and rejects foreign or malformed ones', () => {
  const { sheet } = rig('warrior', 80);
  assert.equal(validTrainerLedger(undefined, 'warrior'), true);
  assert.equal(validTrainerLedger({ skills: ['charge'], ranks: { charge: 2 } }, 'warrior'), true);
  assert.equal(validTrainerLedger({ skills: ['frostbolt'], ranks: {} }, 'warrior'), false);
  assert.equal(validTrainerLedger({ skills: ['charge', 'charge'], ranks: {} }, 'warrior'), false);
  assert.equal(validTrainerLedger({ skills: [], ranks: { charge: 0 } }, 'warrior'), false);
  assert.equal(validTrainerLedger({ skills: [], ranks: { charge: SKILL_RANK_RULES.maximum } }, 'warrior'), false);
  assert.equal(validTrainerLedger('trained', 'warrior'), false);
  assert.equal(sheet.trained, undefined);
});
