import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { deriveCharacterStats } from '../src/character-stats.ts';
import { awardCharacterExperience, refreshCharacter } from '../src/character.ts';
import { foundGuild, contributeGuildXp, guildVaultDeposit, guildVaultWithdraw } from '../src/guild-command.ts';
import {
  addGuildXp, guildHasPerk, guildLevelProgress, guildPerks, guildVaultFreeSlot,
  guildVaultUnlocked, unlockedGuildPerks,
} from '../src/guild-state.ts';
import { GUILD_PERKS, GUILD_RULES, GUILD_VAULT_CAPACITY, guildXpForNext } from '../src/guild-content.ts';
import { mountSpeedFactor } from '../src/mount-state.ts';
import { durabilityLoss, repairQuote } from '../src/durability.ts';
import { DURABILITY_RULES } from '../src/durability-state.ts';
import { HearthstoneChannel, HEARTHSTONE_RULES } from '../src/hearthstone.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { Simulation } from '../src/simulation.ts';
import { WORLD_GENERATION_VERSION } from '../src/world.ts';
import type { CharacterSheet } from '../src/character-types.ts';
import type { Player } from '../src/model.ts';

const world = { blocked: () => false, move: (x: number, y: number) => ({ x, y }) };
const sim = () => new Simulation(world, { spawn: false });
const ok = { ok: true as const };
const save = (sheet: CharacterSheet) =>
  decodeCharacterSave(JSON.stringify({ version: 4, id: 'guild', name: 'Rowan', worldSeed: 7319, worldVersion: WORLD_GENERATION_VERSION,
    createdAt: 1, updatedAt: 2, checkpoint: { ...sim().captureCheckpoint(), character: sheet } }));

/** Found a guild on a fresh sim player; asserts the durable path succeeded. */
async function guilded(player: Player, name = 'Evergrow'): Promise<void> {
  const result = await foundGuild(player, name, () => ok);
  assert.ok(result.ok, result.message);
}

test('foundGuild persists before committing and validates the name', async () => {
  const p = sim().player;
  for (const bad of ['', 'x', 'a'.repeat(25), 'bad<name>', '!!!']) {
    const result = await foundGuild(p, bad, () => ok);
    assert.equal(result.ok, false, bad);
    assert.equal(p.character.guild, undefined);
  }
  let staged: CharacterSheet | null = null;
  const result = await foundGuild(p, '  The Earthen Ring  ', character => { staged = character; return ok; }, 1_700_000_000);
  assert.ok(result.ok);
  assert.equal(staged!.guild!.name, 'The Earthen Ring');
  assert.equal(p.character.guild!.name, 'The Earthen Ring');
  assert.equal(p.character.guild!.level, 1);
  assert.equal(p.character.guild!.memberSince, 1_700_000_000);
  // A second founding and a failed persist leave the live sheet untouched.
  assert.equal((await foundGuild(p, 'Other', () => ok)).ok, false);
  const before = p.character;
  assert.equal((await foundGuild({ ...p, character: { ...p.character, guild: undefined } }, 'Fail', () => ({ ok: false, message: 'no' }))).ok, false);
  assert.equal(p.character, before);
});

test('guild XP accrues from awarded player XP and levels unlock perks', async () => {
  const p = sim().player;
  // No guild: XP accrual is a no-op.
  awardCharacterExperience(p, 10_000);
  assert.equal(p.character.guild, undefined);
  await guilded(p);
  awardCharacterExperience(p, 4_000);
  const guild = p.character.guild!;
  assert.equal(guild.xp + guildXpForNext(1) * (guild.level - 1), Math.floor(4_000 * GUILD_RULES.xpShare));
  assert.equal(guild.level, 2);
  assert.ok(guildHasPerk(p, 'fastTrack1'));
  assert.ok(!guildHasPerk(p, 'mountUp'));
  // contributeGuildXp applies the same share; level 3 unlocks Mount Up.
  const result = contributeGuildXp(p, 4_000);
  assert.equal(result.level, 3);
  assert.deepEqual(result.unlocked.map(perk => perk.id), ['mountUp']);
  assert.equal(guildPerks(p).mountSpeedFactor, 1.1);
});
test('perk stats fold into derived stats and ranked perks replace weaker ranks', async () => {
  const p = sim().player;
  await guilded(p);
  refreshCharacter(p);
  const baseline = p.derived.xpGainMultiplier; // Human racial already grants +5%.
  addGuildXp(p.character, guildXpForNext(1)); // level 2 → Fast Track
  refreshCharacter(p);
  assert.ok(Math.abs(p.derived.xpGainMultiplier - (baseline + .05)) < 1e-9);
  p.character.guild!.level = 6; // Fast Track rank 2 replaces rank 1
  refreshCharacter(p);
  assert.ok(Math.abs(p.derived.xpGainMultiplier - (baseline + .1)) < 1e-9);
  p.character.guild!.level = 16; // Cash Flow rank 2
  refreshCharacter(p);
  assert.equal(p.derived.goldFindMultiplier, 1.1);
  // Sheet-level derivation (no player) sees the same perk stats.
  assert.ok(Math.abs(deriveCharacterStats(p.character).xpGainMultiplier - (baseline + .1)) < 1e-9);
});

test('mount, durability, repair and hearthstone perks reach their owners', async () => {
  const p = sim().player;
  await guilded(p);
  p.mounted = { id: 'horse', since: 0 };
  const mounted = mountSpeedFactor(p);
  p.character.guild!.level = 3;
  assert.equal(mountSpeedFactor(p), mounted * 1.1);
  // Reinforce: death wear drops from 10 to 8 at level 9.
  p.character.guild!.level = 9;
  durabilityLoss(p, 'death');
  assert.equal(p.durability!.weapon, DURABILITY_RULES.max - 8);
  // Bartering: repair quote is discounted 10% at level 20.
  p.character.guild!.level = 20;
  const discounted = repairQuote(p);
  const unguilded = { ...p, character: { ...p.character, guild: undefined } };
  const full = repairQuote(unguilded as Player);
  assert.ok(discounted.ok && full.ok);
  assert.equal(discounted.ok && discounted.cost, Math.max(1, Math.round((full.ok ? full.cost : 0) * .9)));
  // Hasty Hearth halves the hearthstone channel.
  const channel = new HearthstoneChannel();
  assert.equal(channel.start(p, world), null);
  channel.advance(HEARTHSTONE_RULES.channel * .5 + .01, p, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null });
  assert.equal(channel.ready, true);
});

test('guild vault stays locked until Mobile Banking, then stores and returns items', async () => {
  const p = sim().player;
  await guilded(p);
  const item = generateItem(77001, 10, 'ring');
  p.character.inventory[0] = item;
  // Locked below level 12: deposit and withdraw both refuse.
  assert.equal((await guildVaultDeposit(p, 0, () => ok)).ok, false);
  assert.equal(p.character.inventory[0], item);
  assert.equal(p.character.guildVault, undefined);
  p.character.guild!.level = 12;
  assert.ok(guildVaultUnlocked(p));
  const deposited = await guildVaultDeposit(p, 0, () => ok);
  assert.ok(deposited.ok, deposited.message);
  assert.equal(p.character.inventory[0], null);
  assert.equal(p.character.guildVault!.length, GUILD_VAULT_CAPACITY);
  assert.equal(p.character.guildVault![0], item);
  // Withdraw returns the item to the bag.
  const withdrawn = await guildVaultWithdraw(p, 0, () => ok);
  assert.ok(withdrawn.ok, withdrawn.message);
  assert.equal(p.character.guildVault![0], null);
  assert.equal(p.character.inventory[0], item);
  // A failed persist keeps the item in the bag.
  const failed = await guildVaultDeposit(p, 0, () => ({ ok: false, message: 'no' }));
  assert.equal(failed.ok, false);
  assert.equal(p.character.inventory[0], item);
  assert.equal(p.character.guildVault![0], null);
  // A full vault refuses further deposits.
  p.character.guildVault = Array.from({ length: GUILD_VAULT_CAPACITY }, (_, i) => generateItem(78000 + i, 10, 'ring'));
  assert.equal(guildVaultFreeSlot(p.character), -1);
  assert.equal((await guildVaultDeposit(p, 0, () => ok)).ok, false);
});

test('guild membership and vault round-trip through save validation', async () => {
  const p = sim().player;
  await guilded(p);
  p.character.guild!.level = 12;
  p.character.guildVault = Array(GUILD_VAULT_CAPACITY).fill(null);
  p.character.guildVault[3] = generateItem(79001, 10, 'ring');
  const decoded = save(p.character);
  assert.ok(decoded);
  assert.equal(decoded.checkpoint.character.guild!.name, 'Evergrow');
  assert.equal(decoded.checkpoint.character.guildVault![3]!.id, p.character.guildVault[3]!.id);
  // Malformed guilds and vaults are rejected.
  assert.equal(save({ ...p.character, guild: { name: 'x', level: 1, xp: 0, memberSince: 0 } }), null);
  assert.equal(save({ ...p.character, guild: { name: 'Ok', level: 26, xp: 0, memberSince: 0 } }), null);
  assert.equal(save({ ...p.character, guildVault: Array(48).fill(null) }), null);
  const noGuild = { ...p.character, guild: undefined };
  assert.equal(save({ ...noGuild, guildVault: Array(GUILD_VAULT_CAPACITY).fill(null) }), null);
  // A vault item duplicated in the bag is rejected.
  const dup = { ...p.character, inventory: p.character.inventory.slice() };
  dup.inventory[0] = p.character.guildVault[3];
  assert.equal(save(dup), null);
});

test('perk track covers the level curve and progress reporting is exact', () => {
  assert.equal(GUILD_PERKS.length, 16);
  assert.ok(GUILD_PERKS.every(perk => perk.level >= 2 && perk.level <= GUILD_RULES.maxLevel));
  const sheet = createCharacterSheet();
  sheet.guild = { name: 'Test', level: 1, xp: 0, memberSince: 0 };
  assert.deepEqual(guildLevelProgress(sheet), { level: 1, into: 0, span: guildXpForNext(1), capped: false });
  sheet.guild.level = GUILD_RULES.maxLevel;
  assert.equal(guildLevelProgress(sheet).capped, true);
  assert.equal(unlockedGuildPerks(sheet).length, GUILD_PERKS.length);
  assert.equal(guildPerks(sheet).vaultTabs, 1);
  // XP at the cap is a no-op.
  const result = addGuildXp(sheet, 1e6);
  assert.equal(result.applied, 0);
  assert.equal(result.levels, 0);
});
