import { manaCapacity } from './auras.ts';
import { manaVialAmount } from './mana-content.ts';
import { isBossKind } from './wilderness-boss-content.ts';
import { metric } from './chronicle.ts';
import { ENEMY_LOOT_YIELD } from './loot-content.ts';
import { dropGold, rollEnemyGold, type GroundGold } from './gold.ts';
import type { CombatEvent, Enemy, Pickup, Player } from './model.ts';
import type { GroundItem } from './character-types.ts';
import { LOOT_RULES, PLAYER_ABILITIES } from './combat-content.ts';
import { awardCharacterExperience } from './character.ts';
import { xpLevelFactor } from './progression.ts';
import { rollEnemyLoot } from './loot.ts';
import { addGroundItem } from './ground-loot.ts';
import { restedBonus } from './rested.ts';
import { rollGlyphDrop } from './glyph-content.ts';
import { rollBagDrop } from './bag-content.ts';
import { GAME_FEATURES } from './game-features.ts';
import { PET_RULES, adjustPetLoyalty, awardPetXp, petStatsFor } from './pet-content.ts';

export interface KillRewardContext {
  suppressDrops?: boolean;
  player: Player; groundGold: GroundGold[]; groundItems: GroundItem[]; pickups: Pickup[];
  nextId(): number; emit(event: CombatEvent): void;
}

/** Called once after the damage resolver commits an enemy's death. */
export function awardKillRewards(enemy: Enemy, kills: number, recharge: number, context: KillRewardContext): { kills: number; recharge: number } {
  const { player } = context;
  const dropPlayerLevel=player.level;
  kills++;
  if (!player.dead) metric(player.chronicle,'manaRestored',Math.min(manaCapacity(player)-player.mana,player.derived.manaOnKill));
  if (!player.dead) metric(player.chronicle,'manaRecovery:kill',Math.min(manaCapacity(player)-player.mana,player.derived.manaOnKill));
  if (!player.dead) player.mana = Math.min(manaCapacity(player), player.mana + player.derived.manaOnKill);
  const goldMultiplier = player.derived.goldFindMultiplier;
  const reward = Math.max(1, Math.round(enemy.xpReward * xpLevelFactor(player.level, enemy.level) * player.derived.xpGainMultiplier));
  const levels = awardCharacterExperience(player, reward + restedBonus(player, reward));
  context.emit({ type: 'experience', x: enemy.x, y: enemy.y, amount: reward });
  // The active pet earns a share of kill XP while its ally is live; level-ups rescale it.
  const pet = player.character.pets?.active;
  const petAlly = pet ? player.allies?.find(ally => ally.petId === pet.id && ally.hp > 0) : undefined;
  if (pet && petAlly) {
    const before = pet.level;
    const grown = adjustPetLoyalty(awardPetXp(pet, reward * PET_RULES.xpShare, player.level), 1);
    player.character.pets = { ...player.character.pets!, active: grown };
    if (grown.level > before) {
      const stats = petStatsFor(grown);
      petAlly.damage = stats.damage;
      petAlly.hp = Math.min(stats.maxHp, petAlly.hp + Math.max(0, stats.maxHp - petAlly.maxHp));
      petAlly.maxHp = stats.maxHp;
      context.emit({ type: 'notice', x: petAlly.x, y: petAlly.y, message: `${grown.name} reaches level ${grown.level}.` });
    }
  }
  const gold = context.suppressDrops || isBossKind(enemy.kind) ? 0 : Math.round(rollEnemyGold(enemy.lootSeed, enemy.level, enemy.rank) * (ENEMY_LOOT_YIELD[enemy.kind] ?? 1) * goldMultiplier);
  if (gold) dropGold(context.groundGold, { id: context.nextId(), x: enemy.x, y: enemy.y, amount: gold, age: 0 });
  if (levels) context.emit({ type: 'level', x: player.x, y: player.y,
    level: player.level, skillPoints: levels, statPoints: levels * 5, color: '#c0acf0' });
  for (const item of context.suppressDrops || isBossKind(enemy.kind) ? [] : rollEnemyLoot({ playerLevel: dropPlayerLevel, seed: enemy.lootSeed, level: enemy.level, rank: enemy.rank,
    biome: enemy.biome, kind: enemy.kind, encounter: enemy.bossPhases!==undefined||enemy.kind==='goblinChief'?'boss':undefined, firstKill: kills === 1, classId: player.character.classId })) {
    addGroundItem(context.groundItems, { id: context.nextId(), x: enemy.x, y: enemy.y, item });
  }
  if (!context.suppressDrops) {
    const glyph = rollGlyphDrop(enemy.lootSeed ^ 0x5f3759df, player.character.classId);
    if (glyph) addGroundItem(context.groundItems, { id: context.nextId(), x: enemy.x, y: enemy.y, item: glyph });
    if (GAME_FEATURES.bags) {
      const bag = rollBagDrop(enemy.lootSeed ^ 0x2b992dd0, enemy.level);
      if (bag) addGroundItem(context.groundItems, { id: context.nextId(), x: enemy.x, y: enemy.y, item: bag });
    }
  }
  recharge++;
  if (recharge >= PLAYER_ABILITIES.potion.killsPerCharge) {
    recharge -= PLAYER_ABILITIES.potion.killsPerCharge;
    player.flasks = Math.min(PLAYER_ABILITIES.potion.charges, player.flasks + 1);
  }
  const health = kills % LOOT_RULES.healthEveryKills === 0;
  if (!context.suppressDrops && context.pickups.length < LOOT_RULES.maxPickups) context.pickups.push({ id: context.nextId(), x: enemy.x, y: enemy.y,
    kind: health ? 'health' : 'mana', ...(!health?{restoreAmount:manaVialAmount(enemy.level)}:{}), restoreFraction: health ? LOOT_RULES.healthFraction : LOOT_RULES.manaFraction,
    life: LOOT_RULES.life, radius: LOOT_RULES.radius });
  return { kills, recharge };
}
