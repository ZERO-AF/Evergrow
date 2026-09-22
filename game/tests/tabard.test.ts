import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { FACTIONS, FACTION_BY_ID, KILL_REP, STANDING_BY_TIER, type FactionId } from '../src/reputation-content.ts';
import { applyKillReputation, applyReputation, reputationPoints } from '../src/reputation-state.ts';
import { repClaimReward, repOnDungeonClear } from '../src/reputation-command.ts';
import { TABARDS, TABARD_BY_FACTION, tabardDefinition, tabardForFaction, tabardItem } from '../src/tabard-content.ts';
import { championedFaction, equippedTabard } from '../src/tabard-state.ts';
import { validItem } from '../src/item-validation.ts';
import type { CharacterCheckpoint } from '../src/character-save.ts';
import type { ActionResult, Item } from '../src/character-types.ts';

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
const wear = (s: Simulation, item: Item | null) => { s.player.character.equipped.cloak = item; };

test('every faction sells exactly one tabard that champions it', () => {
  assert.equal(TABARDS.length, FACTIONS.length);
  for (const faction of FACTIONS) {
    const def = tabardForFaction(faction.id);
    assert.ok(def, `missing tabard for ${faction.id}`);
    assert.equal(def.factionId, faction.id);
    const reward = faction.rewards.find(r => r.kind === 'tabard');
    assert.ok(reward, `${faction.id} has no tabard reward`);
    assert.equal(reward.kind === 'tabard' && reward.tabardFaction, faction.id);
    assert.equal(reward.id, def.id, 'reward id is the tabard definition id');
    assert.ok(['friendly', 'honored'].includes(reward.standing), `${faction.id} tabard gates at friendly/honored`);
  }
});

test('tabardItem builds a cosmetic cloak carrying tabardFaction', () => {
  const item = tabardItem('argent-tabard', 1234);
  assert.equal(item.kind, 'cloak');
  assert.equal(item.tabardFaction, 'argentCrusade');
  assert.equal(item.name, 'Tabard of the Argent Crusade');
  assert.equal(item.tier, 'common');
  assert.equal(item.affixes.length, 0);
  assert.match(item.flavor ?? '', /Argent Crusade/);
  assert.ok(validItem(item), 'tabard passes save validation');
  assert.equal(tabardItem('argent-tabard', 1234).id, item.id, 'deterministic id');
  assert.throws(() => tabardItem('nope', 1), RangeError);
});

test('equippedTabard and championedFaction read the cloak slot', () => {
  const s = sim();
  assert.equal(equippedTabard(s.player), undefined);
  assert.equal(championedFaction(s.player), undefined);
  const tabard = tabardItem('kirin-tor-tabard', 7);
  wear(s, tabard);
  assert.equal(equippedTabard(s.player), tabard);
  assert.equal(championedFaction(s.player), 'kirinTor');
  // A plain cloak without tabardFaction champions nothing.
  wear(s, { ...tabard, tabardFaction: undefined });
  assert.equal(championedFaction(s.player), undefined);
  // A malformed faction id is ignored rather than crashing resolution.
  wear(s, { ...tabard, tabardFaction: 'bogus' as FactionId });
  assert.equal(championedFaction(s.player), undefined);
});

test('kill reputation redirects to the worn tabard faction', () => {
  const s = sim();
  // verdant kills naturally credit Stormwind.
  const enemy = { kind: 'stalker' as const, biome: 'verdant' as const, rank: 'normal' as const };
  const natural = applyKillReputation(s.player, enemy);
  assert.equal(natural?.faction.id, 'stormwind');
  wear(s, tabardItem('kirin-tor-tabard', 7));
  const gain = applyKillReputation(s.player, enemy);
  assert.equal(gain?.faction.id, 'kirinTor');
  assert.equal(gain?.applied, KILL_REP.normal);
  assert.equal(reputationPoints(s.player, 'kirinTor'), KILL_REP.normal);
  assert.equal(reputationPoints(s.player, 'stormwind'), KILL_REP.normal, 'only the first unchampioned kill credited Stormwind');
});

test('the tabard faction kill cap gates the redirected gain', () => {
  const s = sim();
  wear(s, tabardItem('kirin-tor-tabard', 7));
  // Kirin Tor is at its default kill cap (revered): kills pay nothing even
  // though the natural Stormwind faction is uncapped.
  applyReputation(s.player, 'kirinTor', STANDING_BY_TIER.revered.min);
  const gain = applyKillReputation(s.player, { kind: 'stalker', biome: 'verdant', rank: 'normal' });
  assert.equal(gain, undefined);
});

test('dungeon-clear reputation redirects to the worn tabard faction', () => {
  const s = sim();
  // The ossuary theme naturally credits the Argent Crusade.
  const entrance = { id: 'dungeon:x', theme: 'ossuary' as const };
  const natural = repOnDungeonClear(s, entrance);
  assert.equal(natural?.faction.id, 'argentCrusade');
  assert.equal(natural?.applied, FACTION_BY_ID.argentCrusade.clearRep);
  wear(s, tabardItem('hodir-tabard', 9));
  const gain = repOnDungeonClear(s, entrance);
  assert.equal(gain?.faction.id, 'sonsOfHodir');
  assert.equal(gain?.applied, FACTION_BY_ID.argentCrusade.clearRep, 'the dungeon pays its own rate');
  assert.equal(reputationPoints(s.player, 'sonsOfHodir'), FACTION_BY_ID.argentCrusade.clearRep);
});

test('claiming a tabard reward grants a cloak item with tabardFaction', async () => {
  const s = sim();
  const { writes, persist } = recorder();
  // Friendly (3000) unlocks the Kirin Tor tabard.
  applyReputation(s.player, 'kirinTor', STANDING_BY_TIER.friendly.min);
  const result = await repClaimReward(s, 'kirinTor', 'kirin-tor-tabard', persist);
  assert.ok(result.ok, result.message);
  assert.equal(writes.length, 1, 'one atomic checkpoint write');
  const staged = writes[0]!.character.inventory.filter(Boolean) as Item[];
  assert.equal(staged.length, 1);
  assert.equal(staged[0]!.kind, 'cloak');
  assert.equal(staged[0]!.tabardFaction, 'kirinTor');
  assert.equal(staged[0]!.name, 'Tabard of the Kirin Tor');
  assert.ok(validItem(staged[0]));
  // The claim marker committed to the live ledger.
  assert.equal(s.player.reputation?.['claimed:kirinTor:kirin-tor-tabard'], 1);
  // Second claim is refused.
  const again = await repClaimReward(s, 'kirinTor', 'kirin-tor-tabard', persist);
  assert.equal(again.ok, false);
});

test('standing gate blocks the tabard below its required tier', async () => {
  const s = sim();
  const { persist } = recorder();
  const result = await repClaimReward(s, 'kirinTor', 'kirin-tor-tabard', persist);
  assert.equal(result.ok, false);
  assert.match(result.message ?? '', /Requires Friendly/);
});

test('tabardDefinition resolves by id and misses cleanly', () => {
  assert.equal(tabardDefinition('outrider-tabard')?.factionId, 'warsong');
  assert.equal(tabardDefinition('missing'), undefined);
  assert.equal(TABARD_BY_FACTION.stormwind.id, 'stormwind-tabard');
});
