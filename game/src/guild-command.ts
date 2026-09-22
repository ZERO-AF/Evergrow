/** Guild commands (docs/wow-deepening.md — guild wave): founding, XP
 * contribution and the shared vault. Durable actions stage a cloned sheet,
 * persist it, then commit — mirroring commerce-command's persist(character,
 * hp, mana) contract. Guild XP accrual rides the next checkpoint like quest
 * progress (character.ts feeds it from awardCharacterExperience). */
import { cloneData } from './data-clone.ts';
import type { ActionResult, CharacterSheet, Item } from './character-types.ts';
import type { Player } from './model.ts';
import { refreshCharacter } from './character.ts';
import { addInventoryItem } from './inventory.ts';
import { GUILD_VAULT_CAPACITY } from './guild-content.ts';
import {
  guildNameProblem, guildOf, guildVaultFreeSlot, guildVaultUnlocked,
  guildsEnabled,
} from './guild-state.ts';


/** Active perk modifiers for a player/sheet (aggregated in guild-state). */
export { guildPerks } from './guild-state.ts';
export type GuildResult = ActionResult;
/** Commerce-style persist: stage the sheet, persist before committing live. */
export type GuildPersist = (character: CharacterSheet, hp: number, mana: number) => ActionResult | Promise<ActionResult>;

const fail = (message: string): GuildResult => ({ ok: false, message });

/** Found the character's guild. One guild per character; the name is trimmed
 * and validated against WoW's naming rules. `memberSince` stamps epoch seconds. */
export async function foundGuild(player: Player, name: string, persist: GuildPersist, now = Date.now() / 1000): Promise<GuildResult> {
  if (!guildsEnabled()) return fail('Guilds are not available.');
  if (player.dead) return fail('Cannot do that while defeated.');
  if (guildOf(player)) return fail(`You are already a member of ${guildOf(player)!.name}.`);
  const trimmed = name.trim();
  const problem = guildNameProblem(trimmed);
  if (problem) return fail(problem);
  const character = cloneData(player.character);
  character.guild = { name: trimmed, level: 1, xp: 0, memberSince: Math.floor(now) };
  const candidate = { ...player, character };
  refreshCharacter(candidate);
  const saved = await persist(character, candidate.hp, candidate.mana);
  if (!saved.ok) return fail(saved.message ?? 'Could not save. The guild was not founded.');
  player.character = character;
  refreshCharacter(player);
  return { ok: true, message: `Founded <${trimmed}>.` };
}

/** Re-exported for callers/tests: the implementation lives in guild-state.ts so
 * character.ts can award XP without a character.ts → guild-command.ts cycle. */
export { contributeGuildXp } from './guild-state.ts';

// ── Guild vault (Mobile Banking) ─────────────────────────────────────────────

const vaultProblem = (player: Player): string | null => {
  if (!guildsEnabled()) return 'Guilds are not available.';
  if (player.dead) return 'Cannot do that while defeated.';
  if (!guildOf(player)) return 'You are not in a guild.';
  if (!guildVaultUnlocked(player)) return 'The guild vault requires the Mobile Banking perk (guild level 12).';
  return null;
};

/** Move a bag item into the shared guild vault's first free slot. */
export async function guildVaultDeposit(player: Player, inventoryIndex: number, persist: GuildPersist): Promise<GuildResult> {
  const problem = vaultProblem(player);
  if (problem) return fail(problem);
  const item = Number.isInteger(inventoryIndex) ? player.character.inventory[inventoryIndex] ?? null : null;
  if (!item) return fail('There is no item in that bag slot.');
  if (item.locked) return fail('Unlock this item before depositing it.');
  const character = cloneData(player.character);
  const slot = guildVaultFreeSlot(character);
  if (slot < 0) return fail('The guild vault is full.');
  character.inventory[inventoryIndex] = null;
  if (character.inventoryLayout) delete character.inventoryLayout[item.id];
  (character.guildVault ??= Array<Item | null>(GUILD_VAULT_CAPACITY).fill(null))[slot] = item;
  const saved = await persist(character, player.hp, player.mana);
  if (!saved.ok) return fail(saved.message ?? 'Could not save. The item stayed in your bag.');
  player.character = character;
  return { ok: true, message: `Deposited ${item.name} in the guild vault.` };
}

/** Move a vault item back into the bag. */
export async function guildVaultWithdraw(player: Player, vaultIndex: number, persist: GuildPersist): Promise<GuildResult> {
  const problem = vaultProblem(player);
  if (problem) return fail(problem);
  const vault = player.character.guildVault;
  const item = vault && Number.isInteger(vaultIndex) ? vault[vaultIndex] ?? null : null;
  if (!item) return fail('There is no item in that vault slot.');
  const character = cloneData(player.character);
  if (!addInventoryItem(character, item)) return fail('No room in your bag.');
  character.guildVault![vaultIndex] = null;
  const saved = await persist(character, player.hp, player.mana);
  if (!saved.ok) return fail(saved.message ?? 'Could not save. The item stayed in the vault.');
  player.character = character;
  return { ok: true, message: `Withdrew ${item.name} from the guild vault.` };
}
