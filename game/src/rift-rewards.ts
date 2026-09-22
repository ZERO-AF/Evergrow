import { RIFT_RULES, riftBonus, riftRandom, createRiftKey, riftRewardItemCount } from './rift-content.ts';
import { withUniqueChance } from './unique-content.ts';
import { rollEnemyLoot, selectLootWeight } from './loot.ts';
import type { DungeonEntrance } from './dungeon.ts';
import type { Item, ItemTier } from './character-types.ts';
export function riftRewardItems(entrance:DungeonEntrance,playerLevel:number,elapsed?:number):Item[]{
  const tag=entrance.rift!,random=riftRandom(entrance.seed^0x793ba189),luck=1+riftBonus(tag,'fortune')/100;
  const weights=withUniqueChance({rare:60,epic:35*luck,legendary:5*luck});
  const items=Array.from({length:riftRewardItemCount(tag)-1},()=>rollEnemyLoot({playerLevel,seed:Math.floor(random()*4294967296),level:entrance.level,rank:'normal',kind:'stalker',biome:entrance.biome,encounter:'bossChest',firstKill:true,tierOverride:selectLootWeight(weights,random()) as ItemTier})[0]);
  // Key progression is independent of gear count, charm eligibility and rarity rolls.
  // Every clear empowers the replacement key; a fast clear empowers it twice.
  const keyRandom=riftRandom(entrance.seed^0x51c9a2bd),current=tag.keyTier??0;
  const tier=current+(elapsed!==undefined&&elapsed<=RIFT_RULES.fastClear?2:1);
  items.push(createRiftKey(Math.floor(keyRandom()*4294967296),entrance.level,tier));return items;
}
