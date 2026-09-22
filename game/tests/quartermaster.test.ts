import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { EXALTED_CAP, FACTIONS, FACTION_BY_ID, STANDING_BY_TIER } from '../src/reputation-content.ts';
import { applyReputation, factionForNpc, standingOf } from '../src/reputation-state.ts';
import { quartermasterStock, quartermasterBasePrice, quartermasterPrice } from '../src/quartermaster-content.ts';
import { canBuy, quartermasterBuyProblem, quartermasterFaction } from '../src/quartermaster-state.ts';
import { executeQuartermasterBuy } from '../src/quartermaster-command.ts';
import { focusedQuartermaster, quartermasterFor, quartermastersNear } from '../src/quartermaster-npc.ts';
import { materialCount } from '../src/profession-state.ts';
import { goldBalance } from '../src/wallet.ts';
import { toCopper } from '../src/currency.ts';
import { validItem } from '../src/item-validation.ts';
import { sampleBiome } from '../src/biomes.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';
import type { ActionResult, Item } from '../src/character-types.ts';
import type { Building } from '../src/settlements.ts';
import type { WorldQuery } from '../src/model.ts';

const world = { seed: 7319, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
function sim() {
  const s = new Simulation(world, { seed: 7319, spawn: false });
  s.player.x = 0; s.player.y = 0;
  return s;
}
function recorder() {
  const writes: CharacterCheckpoint[] = [];
  return {
    writes,
    persist: async (checkpoint: CharacterCheckpoint): Promise<ActionResult> => { writes.push(checkpoint); return { ok: true }; },
  };
}
const noble = (x: number, y: number, place = 0) => ({
  id: `town:7319:${place}:building:0`, kind: 'noble', settlementTier: 'city',
  door: { x, y, width: 10 }, x, y, width: 80, height: 80, seed: 5, name: 'Hall', walls: [], furniture: [],
} as unknown as Building);

test('quartermasterFor anchors to noble halls; near/focused follow the battlemaster pattern', () => {
  assert.equal(quartermasterFor({ ...noble(0, 0), kind: 'blacksmith' } as Building), null);
  const master = quartermasterFor(noble(0, 0))!;
  master.faction = 'neutral';
  assert.ok(master);
  assert.equal(master.role, 'quartermaster');
  assert.equal(master.x, -70);
  assert.equal(master.y, 78);
  assert.equal(master.id, 'town:7319:0:building:0:quartermaster');

  const withBuildings: WorldQuery = { ...world, getBuildings: () => [noble(0, 0), { ...noble(500, 0), kind: 'house' } as Building] };
  const near = quartermastersNear(withBuildings, -200, -200, 400, 400);
  assert.equal(near.length, 1, 'only the noble hall yields a quartermaster');
  assert.equal(near[0]!.id, master.id);

  const s = sim();
  s.player.x = master.x; s.player.y = master.y;
  assert.equal(focusedQuartermaster(near, s.player, withBuildings)?.id, master.id);
  s.player.x = master.x + 500;
  assert.equal(focusedQuartermaster(near, s.player, withBuildings), null, 'out of interact range');
  s.player.x = master.x; s.player.dead = true;
  assert.equal(focusedQuartermaster(near, s.player, withBuildings), null, 'dead players cannot interact');
});

test('quartermasterFaction resolves the settlement faction', () => {
  const home = quartermasterFor(noble(0, 0, 0))!;
  assert.equal(quartermasterFaction(home)?.id, 'stormwind', 'place 0 serves the home faction');
  assert.equal(factionForNpc(home)?.id, 'stormwind');
  // A noble hall in a biome-mapped zone serves that biome's faction.
  let found = false;
  for (let x = -40000; x <= 40000 && !found; x += 997) for (let y = -40000; y <= 40000; y += 991) {
    if (sampleBiome(x, y).id !== 'swamp') continue;
    const master = quartermasterFor(noble(x, y, 3))!;
    assert.equal(quartermasterFaction(master)?.id, 'cenarionCircle');
    found = true;
  }
  assert.ok(found, 'expected a swamp coordinate for the Cenarion quartermaster');
  const tagOnly = quartermasterFaction({ buildingId: 'town:7319:9:building:0', x: 0, y: 0, faction: 'horde' });
  assert.ok(tagOnly, 'the axis fallback still resolves a faction');
});

test('quartermasterStock is per-faction, standing-gated and gold-priced', () => {
  const s = sim();
  const stock = quartermasterStock('kirinTor', s.player);
  assert.equal(stock.length, FACTION_BY_ID.kirinTor.rewards.length, 'Kirin Tor sells every reward kind it lists');
  assert.equal(quartermasterBasePrice(FACTION_BY_ID.kirinTor.rewards.find(r => r.id === 'kirin-tor-tabard')!), toCopper(1));
  assert.ok(stock.every(e => e.goldCost > 0 && e.listPrice >= e.goldCost));
  // Neutral: only rows gated at neutral/below are eligible — every Kirin Tor row needs Friendly+.
  assert.ok(stock.every(e => !e.eligible && e.reason?.startsWith('Requires')));
  const tabard = stock.find(e => e.rewardId === 'kirin-tor-tabard')!;
  assert.equal(tabard.requiredStanding, 'friendly');
  assert.equal(tabard.kind, 'tabard');
  assert.equal(tabard.item?.kind, 'cloak');
  assert.equal(tabard.item?.tabardFaction, 'kirinTor');
  assert.equal(tabard.goldCost, toCopper(1), 'tabards list at 1g');

  // Friendly unlocks the tabard and applies the 5% discount.
  applyReputation(s.player, 'kirinTor', STANDING_BY_TIER.friendly.min);
  const friendly = quartermasterStock('kirinTor', s.player);
  const friendlyTabard = friendly.find(e => e.rewardId === 'kirin-tor-tabard')!;
  assert.ok(friendlyTabard.eligible);
  assert.equal(friendlyTabard.goldCost, Math.round(toCopper(1) * 0.95));
  assert.ok(friendly.find(e => e.rewardId === 'kirin-tor-ring')!.reason === 'Requires Exalted with Kirin Tor.');

  // Gold bounties are never sold.
  const cartel = quartermasterStock('steamwheedleCartel', s.player);
  assert.ok(!cartel.some(e => e.rewardId === 'cartel-voucher'));
  assert.equal(quartermasterStock('nope', s.player).length, 0);
});

test('canBuy and quartermasterBuyProblem gate on standing then gold', () => {
  const s = sim();
  const faction = FACTION_BY_ID.stormwind;
  const tabard = faction.rewards.find(r => r.id === 'stormwind-tabard')!;
  assert.equal(canBuy(s.player, faction, tabard), false);
  assert.match(quartermasterBuyProblem(s.player, faction, tabard) ?? '', /Requires Honored/);
  applyReputation(s.player, 'stormwind', STANDING_BY_TIER.honored.min);
  assert.equal(quartermasterBuyProblem(s.player, faction, tabard), 'Not enough gold.');
  s.player.character.gold = toCopper(50);
  assert.ok(canBuy(s.player, faction, tabard));
  // The gold bounty reward is refused even at exalted.
  applyReputation(s.player, 'steamwheedleCartel', STANDING_BY_TIER.exalted.min);
  const voucher = FACTION_BY_ID.steamwheedleCartel.rewards.find(r => r.id === 'cartel-voucher')!;
  assert.equal(quartermasterBuyProblem(s.player, FACTION_BY_ID.steamwheedleCartel, voucher), 'That item is not sold here.');
});

test('executeQuartermasterBuy debits gold and grants the reward item', async () => {
  const s = sim();
  const { writes, persist } = recorder();
  const master = quartermasterFor(noble(0, 0))!;
  master.faction = 'neutral';
  s.player.x = master.x; s.player.y = master.y;
  const faction = FACTION_BY_ID.stormwind;

  // Locked by standing: no write, no spend.
  let result = await executeQuartermasterBuy(s, master, 'stormwind-tabard', persist);
  assert.equal(result.ok, false);
  assert.match(result.message ?? '', /Requires Honored/);
  assert.equal(writes.length, 0);

  // Standing met but broke: refused before any write.
  applyReputation(s.player, 'stormwind', STANDING_BY_TIER.honored.min);
  result = await executeQuartermasterBuy(s, master, 'stormwind-tabard', persist);
  assert.equal(result.ok, false);
  assert.match(result.message ?? '', /gold/);
  assert.equal(writes.length, 0);

  // Funded: the buy debits the discounted price and packs the tabard cloak.
  s.player.character.gold = toCopper(100);
  const price = quartermasterPrice(s.player, faction, faction.rewards.find(r => r.id === 'stormwind-tabard')!);
  result = await executeQuartermasterBuy(s, master, 'stormwind-tabard', persist);
  assert.ok(result.ok, result.message);
  assert.equal(writes.length, 1);
  assert.equal(goldBalance(s.player.character), toCopper(100) - price);
  const tabard = s.player.character.inventory.find((i): i is Item => i?.id.includes(':qm:stormwind-tabard:') === true);
  assert.ok(tabard, 'the purchased tabard lands in the bag');
  assert.equal(tabard.kind, 'cloak');
  assert.equal(tabard.tabardFaction, 'stormwind');
  assert.equal(tabard.name, 'Tabard of Stormwind');
  assert.ok(validItem(tabard));

  // Purchases are repeatable — no claim marker is written.
  assert.equal(s.player.reputation?.['claimed:stormwind:stormwind-tabard'], undefined);
  result = await executeQuartermasterBuy(s, master, 'stormwind-tabard', persist);
  assert.ok(result.ok, result.message);
  assert.equal(s.player.character.inventory.filter(i => i?.id.includes(':qm:stormwind-tabard:')).length, 2);

  // Gear rolls a real item at the buyer's level (signet gates at Revered).
  applyReputation(s.player, 'stormwind', STANDING_BY_TIER.revered.min);
  s.player.character.gold = toCopper(500);
  result = await executeQuartermasterBuy(s, master, 'stormwind-signet', persist);
  assert.ok(result.ok, result.message);
  const signet = s.player.character.inventory.find(i => i?.id.includes(':qm:stormwind-signet:'));
  assert.ok(signet && validItem(signet));

  // Unknown rewards and out-of-range NPCs are refused.
  assert.equal((await executeQuartermasterBuy(s, master, 'nope', persist)).ok, false);
  s.player.x = master.x + 500;
  assert.equal((await executeQuartermasterBuy(s, master, 'stormwind-tabard', persist)).ok, false);
});

test('material stock rows grant into the profession bag', async () => {
  const s = sim();
  const { persist } = recorder();
  // The Cenarion quartermaster sells the herb bag into the herbalism bag.
  applyReputation(s.player, 'cenarionCircle', STANDING_BY_TIER.honored.min);
  s.player.character.gold = toCopper(100);
  const entry = quartermasterStock('cenarionCircle', s.player).find(e => e.rewardId === 'cenarion-herb-bag')!;
  assert.equal(entry.kind, 'material');
  assert.equal(entry.item, null);
  assert.equal(entry.material?.id, 'sungrass');
  assert.ok(entry.eligible);
  // Drive the command through a Cenarion-serving quartermaster.
  let master: ReturnType<typeof quartermasterFor> = null;
  for (let x = -40000; x <= 40000 && !master; x += 997) for (let y = -40000; y <= 40000; y += 991) {
    if (sampleBiome(x, y).id !== 'swamp') continue;
    const candidate = quartermasterFor(noble(x, y, 3));
    if (candidate) { candidate.faction = 'neutral'; if (quartermasterFaction(candidate)?.id === 'cenarionCircle') master = candidate; }
  }
  assert.ok(master);
  s.player.x = master.x; s.player.y = master.y;
  const before = materialCount(s.player, 'sungrass');
  const result = await executeQuartermasterBuy(s, master, 'cenarion-herb-bag', persist);
  assert.ok(result.ok, result.message);
  assert.equal(materialCount(s.player, 'sungrass'), before + 20);
});

test('every faction exposes at least one sellable stock row', () => {
  const s = sim();
  for (const faction of FACTIONS) {
    (s.player.reputation ??= {})[faction.id] = EXALTED_CAP;
    const stock = quartermasterStock(faction.id, s.player);
    assert.ok(stock.length >= 2, `${faction.id} should sell gear and a tabard`);
    assert.ok(stock.every(e => e.eligible), `${faction.id} fully unlocked at exalted`);
    assert.ok(stock.every(e => e.goldCost <= e.listPrice), 'exalted discount applies');
  }
  assert.equal(standingOf(s.player, 'stormwind').tier, 'exalted');
});
