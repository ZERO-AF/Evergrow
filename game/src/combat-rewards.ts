import { manaCapacity } from './auras.ts';
import { manaVialAmount } from './mana-content.ts';
import { isBossKind } from './wilderness-boss-content.ts';
import { metric } from './chronicle.ts';
import { ENEMY_LOOT_YIELD } from './loot-content.ts';
import { dropGold, rollEnemyGold, type GroundGold } from './gold.ts';
import type { CombatEvent, Enemy, Pickup, Player } from './model.ts';
import type { GroundItem } from './character-types.ts';
import { ELITE_AFFIX_RULES, KILL_STREAK, TREASURE_GOBLIN, streakBonusFraction } from './combat-content.ts';
import { LOOT_RULES, PLAYER_ABILITIES } from './combat-content.ts';
import { treasureLanding } from './treasure-flight.ts';
import { awardCharacterExperience } from './character.ts';
import { xpLevelFactor } from './progression.ts';
import { rollEnemyLoot } from './loot.ts';
import { addGroundItem } from './ground-loot.ts';
import { WOW_CLASSES } from './wow-classes.ts';
import { restedBonus } from './rested.ts';
import { rollGlyphDrop } from './glyph-content.ts';
import { rollBagDrop } from './bag-content.ts';
import { GAME_FEATURES } from './game-features.ts';
import { PET_RULES, adjustPetLoyalty, awardPetXp, petStatsFor } from './pet-content.ts';

export interface KillRewardContext {
  suppressDrops?: boolean;
  player: Player; groundGold: GroundGold[]; groundItems: GroundItem[]; pickups: Pickup[];
  nextId(): number; emit(event: CombatEvent): void;
  /** Kill-loot flight needs the world for landing spots and the clock for arcs. */
  world?: import('./model.ts').WorldQuery;
  time?: number;
  /** Avenger elites grow when a packmate dies nearby. */
  enemies?: readonly Enemy[];
}

/** Kill loot bursts out of the corpse along the same arc chest treasure uses.
 * Without world/time (tests, headless callers) drops land at the corpse. */
function lootFlight(enemy: Enemy, index: number, context: KillRewardContext) {
  if (!context.world || context.time === undefined) return undefined;
  const landing = treasureLanding(context.world, enemy.x, enemy.y, index, enemy.lootSeed);
  return { landing, flight: { x: enemy.x, y: enemy.y, at: context.time, delay: index * .07 } };
}

/** Treasure goblins erupt in a guaranteed rare+ fountain plus extra gold piles. */
function treasureFountain(enemy: Enemy, context: KillRewardContext, dropPlayerLevel: number, index: number): number {
  const { player } = context;
  const weights = { common: 0, magic: 0, rare: 72, epic: 22, legendary: 6, unique: 0 };
  for (let roll = 0; roll < 2; roll++)
    for (const item of rollEnemyLoot({ playerLevel: dropPlayerLevel, seed: enemy.lootSeed ^ (roll * 0x9e3779b9),
      level: enemy.level, rank: 'elite', tierWeights: weights,
      biome: enemy.biome, kind: enemy.kind, encounter: 'boss', classId: player.character.classId })) {
      const arc = lootFlight(enemy, index++, context);
      addGroundItem(context.groundItems, { id: context.nextId(), x: arc?.landing.x ?? enemy.x, y: arc?.landing.y ?? enemy.y,
        item, ...(arc ? { flight: arc.flight } : {}) });
    }
  for (let i = 0; i < TREASURE_GOBLIN.fountainGold; i++) {
    const arc = lootFlight(enemy, index++, context);
    dropGold(context.groundGold, { id: context.nextId(), x: arc?.landing.x ?? enemy.x, y: arc?.landing.y ?? enemy.y,
      amount: Math.max(1, Math.round(rollEnemyGold(enemy.lootSeed ^ (i * 0x51ab), enemy.level, 'elite')
        * player.derived.goldFindMultiplier)), age: 0, ...(arc ? { flight: arc.flight } : {}) });
  }
  context.emit({ type: 'blast', x: enemy.x, y: enemy.y, radius: 90, style: 'radiant', enemyKind: enemy.kind });
  return index;
}

/** Called once after the damage resolver commits an enemy's death. */
export function awardKillRewards(enemy: Enemy, kills: number, recharge: number, context: KillRewardContext): { kills: number; recharge: number } {
  const { player } = context;
  const dropPlayerLevel=player.level;
  // Gold uses the multiplier from before this kill's level-up: a charm that only
  // becomes eligible through the new level must not boost the kill that granted it.
  const goldMultiplier = player.derived.goldFindMultiplier;
  kills++;
  if (!player.dead) metric(player.chronicle,'manaRestored',Math.min(manaCapacity(player)-player.mana,player.derived.manaOnKill));
  // Massacre streaks: kills inside the window chain; thresholds announce a banner.
  if (GAME_FEATURES.killStreaks && !player.dead) {
    const now = context.time ?? 0;
    const streak = now - (player.killStreak?.lastKillAt ?? -Infinity) <= KILL_STREAK.window
      ? (player.killStreak?.count ?? 0) + 1 : 1;
    player.killStreak = { count: streak, lastKillAt: now };
    if ((KILL_STREAK.thresholds as readonly number[]).includes(streak))
      context.emit({ type: 'streak', x: enemy.x, y: enemy.y, count: streak, bonusPercent: Math.round(streakBonusFraction(streak) * 100) });
  }
  if (GAME_FEATURES.eliteAffixes && context.enemies) {
    for (const other of context.enemies) {
      if (other === enemy || other.state === 'dead' || other.affix !== 'avenger') continue;
      if (Math.hypot(other.x - enemy.x, other.y - enemy.y) > ELITE_AFFIX_RULES.avenger.radius) continue;
      const state = other.affixState ??= { clock: 0, shielded: 0, stacks: 0 };
      if (state.stacks >= ELITE_AFFIX_RULES.avenger.maxStacks) continue;
      state.stacks++;
      context.emit({ type: 'blast', x: other.x, y: other.y, radius: other.radius + 16, style: 'shadow', enemyKind: other.kind });
    }
  }
  if (!player.dead) metric(player.chronicle,'manaRecovery:kill',Math.min(manaCapacity(player)-player.mana,player.derived.manaOnKill));
  // Mana-on-kill only refills mana classes; rage/energy/runic pools use their own rules.
  if (!player.dead && WOW_CLASSES[player.character.classId].resource === 'mana')
    player.mana = Math.min(manaCapacity(player), player.mana + player.derived.manaOnKill);
  const reward = Math.max(1, Math.round(enemy.xpReward * xpLevelFactor(player.level, enemy.level) * player.derived.xpGainMultiplier
    * (1 + ((player.killStreak?.count ?? 0) >= 2 ? streakBonusFraction(player.killStreak!.count) : 0))));
  const levels = awardCharacterExperience(player, reward + (GAME_FEATURES.hearthstone ? restedBonus(player, reward) : 0));
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
  let dropIndex = 0;
  if (gold) {
    const arc = lootFlight(enemy, dropIndex++, context);
    dropGold(context.groundGold, { id: context.nextId(), x: arc?.landing.x ?? enemy.x, y: arc?.landing.y ?? enemy.y,
      amount: gold, age: 0, ...(arc ? { flight: arc.flight } : {}) });
  }
  if (levels) context.emit({ type: 'level', x: player.x, y: player.y,
    level: player.level, skillPoints: levels, statPoints: levels * 5, color: '#c0acf0' });
  if (!context.suppressDrops && enemy.treasure) {
    dropIndex = treasureFountain(enemy, context, dropPlayerLevel, dropIndex);
  } else for (const item of context.suppressDrops || isBossKind(enemy.kind) ? [] : rollEnemyLoot({ playerLevel: dropPlayerLevel, seed: enemy.lootSeed, level: enemy.level, rank: enemy.rank,
    biome: enemy.biome, kind: enemy.kind, encounter: enemy.bossPhases!==undefined||enemy.kind==='goblinChief'?'boss':undefined, firstKill: kills === 1, classId: player.character.classId })) {
    const arc = lootFlight(enemy, dropIndex++, context);
    addGroundItem(context.groundItems, { id: context.nextId(), x: arc?.landing.x ?? enemy.x, y: arc?.landing.y ?? enemy.y,
      item, ...(arc ? { flight: arc.flight } : {}) });
  }
  if (!context.suppressDrops) {
    const glyph = rollGlyphDrop(enemy.lootSeed ^ 0x5f3759df, player.character.classId);
    if (glyph) {
      const arc = lootFlight(enemy, dropIndex++, context);
      addGroundItem(context.groundItems, { id: context.nextId(), x: arc?.landing.x ?? enemy.x, y: arc?.landing.y ?? enemy.y,
        item: glyph, ...(arc ? { flight: arc.flight } : {}) });
    }
    if (GAME_FEATURES.bags) {
      const bag = rollBagDrop(enemy.lootSeed ^ 0x2b992dd0, enemy.level);
      if (bag) {
        const arc = lootFlight(enemy, dropIndex++, context);
        addGroundItem(context.groundItems, { id: context.nextId(), x: arc?.landing.x ?? enemy.x, y: arc?.landing.y ?? enemy.y,
          item: bag, ...(arc ? { flight: arc.flight } : {}) });
      }
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
