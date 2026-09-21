import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { CharacterSession } from '../src/character-session.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { FACTION_BY_ID, isFactionId } from '../src/reputation-content.ts';
import { knownFactions, reputationPoints, standingOf } from '../src/reputation-state.ts';
import { ACHIEVEMENT_BY_ID, ACHIEVEMENT_CATEGORIES } from '../src/achievement-content.ts';
import { achievementComplete, achievementProgress } from '../src/achievement-state.ts';
import {
  arenaPointsBalance, creditArenaPoints, creditHonor, honorBalance, spendArenaPoints, spendHonor,
} from '../src/pvp-currency.ts';
import {
  executePvpBuy, focusedPvpVendor, pvpBuyProblem, pvpStockEntry, pvpVendorFor, pvpVendorStock,
  PVP_VENDOR_STOCK, type PvpVendor,
} from '../src/pvp-vendor.ts';
import { awardMatchRewards, pvpOnCombatantKill, PVP_REWARDS } from '../src/pvp-rewards.ts';
import { MOUNT_RULES } from '../src/mount-state.ts';
import { mountUnlocked } from '../src/mount-state.ts';
import type { Building } from '../src/settlements.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';
import type { ActionResult } from '../src/character-types.ts';

const world = { seed: 7319, generationVersion: 4, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }), getPOIs: () => [] };
const noble: Building = {
  id: 'town:7319:0:building:4', seed: 11, name: "Count's Hall", kind: 'noble',
  x: 0, y: 0, width: 240, height: 164, door: { x: 120, y: 164, width: 24 }, walls: [], furniture: [],
};
const vendor: PvpVendor = { ...pvpVendorFor(noble)!, x: 0, y: 0, level: 1 };

function sim() {
  const s = new Simulation(world, { seed: 7319, spawn: false });
  s.player.x = 0; s.player.y = 0;
  return s;
}
/** A persist that stores the checkpoint so the test can inspect the staged write. */
function recorder() {
  const writes: CharacterCheckpoint[] = [];
  return {
    writes,
    persist: async (checkpoint: CharacterCheckpoint): Promise<ActionResult> => { writes.push(checkpoint); return { ok: true }; },
  };
}

test('honor and arena point wallets mirror gold: credit, spend, bounds', () => {
  const sheet = createCharacterSheet();
  assert.equal(honorBalance(sheet), 0);
  assert.equal(arenaPointsBalance(sheet), 0);
  assert.ok(creditHonor(sheet, 500));
  assert.equal(honorBalance(sheet), 500);
  assert.ok(spendHonor(sheet, 200));
  assert.equal(honorBalance(sheet), 300);
  assert.equal(spendHonor(sheet, 301), false);
  assert.equal(creditHonor(sheet, -1), false);
  assert.equal(creditHonor(sheet, 1.5), false);
  assert.equal(honorBalance(sheet), 300);
  assert.ok(creditArenaPoints(sheet, 150));
  assert.ok(spendArenaPoints(sheet, 150));
  assert.equal(arenaPointsBalance(sheet), 0);
  assert.equal(spendArenaPoints(sheet, 1), false);
});

test('validSheet accepts honor/arenaPoints and rejects invalid balances', async () => {
  const data = new Map<string, string>();
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
  const repo = new CharacterRepository(storage), session = new CharacterSession(repo, 4), s = sim();
  s.player.character.honor = 1200; s.player.character.arenaPoints = 300;
  assert.ok((await session.create(0, 'Vex', 7319, s.captureCheckpoint(), 'pvp-save', 1)), session.error);
  const record = repo.read(0).record!;
  const decoded = decodeCharacterSave(JSON.stringify(record));
  assert.equal(decoded?.checkpoint.character.honor, 1200);
  assert.equal(decoded?.checkpoint.character.arenaPoints, 300);
  for (const bad of [{ honor: -5 }, { honor: 1.5 }, { arenaPoints: -1 }, { arenaPoints: Number.MAX_SAFE_INTEGER + 1 }]) {
    const tampered = JSON.parse(JSON.stringify(record));
    Object.assign(tampered.checkpoint.character, bad);
    assert.equal(decodeCharacterSave(JSON.stringify(tampered)), null, JSON.stringify(bad));
  }
});

test('warsong faction is registered with standing-gated rewards', () => {
  assert.ok(isFactionId('warsong'));
  const faction = FACTION_BY_ID.warsong;
  assert.equal(faction.name, 'Warsong Outriders');
  assert.ok(faction.rewards.length >= 3);
  assert.equal(standingOf({}, 'warsong').tier, 'neutral');
});

test('awardMatchRewards stages honor, arena points and reputation in one checkpoint', async () => {
  const s = sim(), { writes, persist } = recorder();
  const result = await awardMatchRewards(s, { mode: 'arena', bracket: '2v2', won: true, kills: 2, rating: 1700 }, persist);
  assert.ok(result.ok, result.message);
  assert.equal(result.honor, PVP_REWARDS.arenaWin + 2 * PVP_REWARDS.honorPerKill);
  assert.equal(result.arenaPoints, PVP_REWARDS.arenaPointsWin);
  assert.equal(result.reputation, PVP_REWARDS.repWin);
  assert.equal(writes.length, 1, 'one atomic checkpoint write');
  const staged = writes[0]!;
  assert.equal(staged.character.honor, result.honor);
  assert.equal(staged.character.arenaPoints, PVP_REWARDS.arenaPointsWin);
  assert.equal((staged as CharacterCheckpoint & { reputation?: Record<string, number> }).reputation?.warsong, PVP_REWARDS.repWin);
  // Committed to the live player.
  assert.equal(honorBalance(s.player.character), result.honor);
  assert.equal(arenaPointsBalance(s.player.character), PVP_REWARDS.arenaPointsWin);
  assert.equal(reputationPoints(s.player, 'warsong'), PVP_REWARDS.repWin);
  assert.ok(knownFactions(s.player).some(f => f.id === 'warsong'));
  // Achievements: first win + rating threshold.
  assert.ok(achievementComplete(s.player.achievements, 'first-blood-arena'));
  assert.ok(achievementComplete(s.player.achievements, 'arena-contender'));
  assert.ok(result.unlocked.some(a => a.id === 'first-blood-arena'));
});

test('awardMatchRewards pays less on a loss, battleground rep, and rolls back on failed persist', async () => {
  const s = sim(), { persist } = recorder();
  const loss = await awardMatchRewards(s, { mode: 'battleground', bracket: 'warsong', won: false, kills: 1, objectives: 2 }, persist);
  assert.ok(loss.ok);
  assert.equal(loss.honor, PVP_REWARDS.battlegroundLoss + PVP_REWARDS.honorPerKill + 2 * PVP_REWARDS.honorPerObjective);
  assert.equal(loss.arenaPoints, 0, 'battlegrounds pay no arena points');
  assert.ok(achievementComplete(s.player.achievements, 'warsong-gulch-victory') === false, 'loss does not earn the map achievement');
  assert.equal(achievementProgress(ACHIEVEMENT_BY_ID['honorable-kills']!, s.player).value, 1);

  const failing = await awardMatchRewards(s, { mode: 'arena', bracket: '3v3', won: true }, async () => ({ ok: false, message: 'disk full' }));
  assert.equal(failing.ok, false);
  assert.equal(failing.honor, 0);
  // Live state rolled back: currency unchanged, achievements restored.
  assert.equal(honorBalance(s.player.character), loss.honor);
  assert.equal(achievementComplete(s.player.achievements, 'arena-veteran'), false);
});

test('honorFromKills avoids double-paying kills credited through the live path', async () => {
  const s = sim(), { persist } = recorder();
  assert.equal(pvpOnCombatantKill(s), PVP_REWARDS.honorPerKill);
  const before = honorBalance(s.player.character);
  const result = await awardMatchRewards(s, { mode: 'arena', bracket: '2v2', won: true, kills: 1, honorFromKills: true }, persist);
  assert.ok(result.ok);
  assert.equal(result.honor, PVP_REWARDS.arenaWin, 'kill honor already paid live');
  assert.equal(honorBalance(s.player.character), before + PVP_REWARDS.arenaWin);
});

test('pvpVendorFor mirrors the battlemaster at noble halls only; stock is static and role-gated', () => {
  const v = pvpVendorFor(noble)!;
  assert.equal(v.role, 'pvpVendor');
  assert.equal(v.id, 'town:7319:0:building:4:pvpVendor');
  assert.equal(v.x, noble.door.x - 70);
  assert.equal(v.y, noble.door.y + 24);
  assert.equal(pvpVendorFor({ ...noble, kind: 'stash' }), null);
  assert.ok(pvpVendorStock(v).length >= 10);
  assert.deepEqual(pvpVendorStock({ ...v, role: 'blacksmith' }), []);
  assert.ok(PVP_VENDOR_STOCK.some(e => e.kind === 'mount'));
  assert.ok(PVP_VENDOR_STOCK.some(e => e.currency === 'arenaPoints'));
  assert.equal(focusedPvpVendor([vendor], { x: 0, y: 0 }, world)?.id, vendor.id);
});

test('executePvpBuy spends honor for a gear item and arena points for the mount', async () => {
  const s = sim(), { persist } = recorder();
  s.player.character.honor = 2000; s.player.character.arenaPoints = 6000;
  const gear = pvpStockEntry('gladiator-helm')!;
  const bought = await executePvpBuy(s, vendor, gear.id, persist);
  assert.ok(bought.ok, bought.message);
  assert.equal(honorBalance(s.player.character), 800);
  const item = s.player.character.inventory.find(i => i?.name === gear.name);
  assert.ok(item, 'item delivered to the pack');
  assert.equal(item!.tier, 'epic');
  assert.equal(item!.kind, 'head');

  const drake = await executePvpBuy(s, vendor, 'vengeful-drake', persist);
  assert.ok(drake.ok, drake.message);
  assert.equal(arenaPointsBalance(s.player.character), 1000);
  assert.ok(mountUnlocked(s.player, 'drake'), 'mount unlock flag set');
  // Second purchase of the mount is refused.
  assert.equal((await executePvpBuy(s, vendor, 'vengeful-drake', persist)).ok, false);
});

test('executePvpBuy rejects bad stock, wrong vendor, short funds and failed persists', async () => {
  const s = sim(), { persist } = recorder();
  s.player.character.honor = 100;
  assert.equal((await executePvpBuy(s, vendor, 'nope', persist)).ok, false);
  assert.equal((await executePvpBuy(s, { ...vendor, role: 'blacksmith' }, 'gladiator-helm', persist)).ok, false);
  const broke = await executePvpBuy(s, vendor, 'gladiator-helm', persist);
  assert.equal(broke.ok, false);
  assert.match(broke.message!, /honor/i);
  assert.equal(honorBalance(s.player.character), 100);
  s.player.character.honor = 5000;
  const failed = await executePvpBuy(s, vendor, 'gladiator-helm', async () => ({ ok: false, message: 'disk full' }));
  assert.equal(failed.ok, false);
  assert.equal(honorBalance(s.player.character), 5000, 'failed persist leaves the wallet untouched');
});

test('pvpBuyProblem reports affordability, ownership and pack space', () => {
  const sheet = createCharacterSheet();
  const helm = pvpStockEntry('gladiator-helm')!;
  assert.match(pvpBuyProblem(sheet, helm, 10)!, /honor/i);
  sheet.honor = 99999;
  assert.equal(pvpBuyProblem(sheet, helm, 10), null);
  const drake = pvpStockEntry('vengeful-drake')!;
  sheet.arenaPoints = 99999;
  assert.equal(pvpBuyProblem(sheet, drake, 10), null);
  assert.match(pvpBuyProblem(sheet, drake, 10, { [MOUNT_RULES.drakeAchievement]: 1 })!, /already/i);
  sheet.inventory = Array.from({ length: 64 }, (_, i) => generateItem(4200 + i, 10, undefined, undefined, 'legendary'));
  assert.match(pvpBuyProblem(sheet, helm, 10)!, /room/i);
});

test('PvP achievement category and criteria are registered', () => {
  assert.ok(ACHIEVEMENT_CATEGORIES.includes('PvP'));
  for (const id of ['first-blood-arena', 'arena-veteran', 'honorable-kills', 'warsong-gulch-victory', 'arathi-basin-victory', 'arena-contender'])
    assert.ok(ACHIEVEMENT_BY_ID[id], id);
});
