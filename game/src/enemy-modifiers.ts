import type { Enemy } from './model.ts';
import { isBossKind } from './wilderness-boss-content.ts';
import { riftBonus, riftEnemyStats } from './rift-content.ts';
import { ELITE_AFFIX_RULES } from './combat-content.ts';
import { HEROIC_BOSS_HEALTH } from './progression-content.ts';
const TRAITS=Object.freeze([
  Object.freeze({id:'swift',color:'#7ce4ed',label:'Swift',name:'Swift',description:'+15% movement speed',speed:1.15,recovery:1,damage:1,control:1}),
  Object.freeze({id:'relentless',color:'#ffc774',label:'Relentless',name:'Relentless',description:'20% shorter attack recovery',speed:1,recovery:.8,damage:1,control:1}),
  Object.freeze({id:'savage',color:'#f8799a',label:'Savage',name:'Savage',description:'+10% damage',speed:1,recovery:1,damage:1.1,control:1}),
  Object.freeze({id:'resolute',color:'#caa4fc',label:'Resolute',name:'Resolute',description:'25% shorter control effects',speed:1,recovery:1,damage:1,control:.75}),
]);
type Source=Pick<Enemy,'kind'|'rank'> & Partial<Pick<Enemy,'lootSeed'|'rift'|'affixState'>> & { heroic?: boolean };
const EMPTY:readonly typeof TRAITS[number][]=Object.freeze([]);
const SETS=Array.from({length:8},(_,i)=>Object.freeze(i<4?[TRAITS[i]]:[TRAITS[i-4],TRAITS[(i-4+1)%4]]));
export function enemyModifiers(e:Source):readonly typeof TRAITS[number][]{
  if(e.rank==='normal'||isBossKind(e.kind)||e.lootSeed===undefined)return EMPTY;
  let n=Math.imul(e.lootSeed^(e.lootSeed>>>16),0x45d9f3b);n=(n^(n>>>16))>>>0;
  return SETS[n%4+(e.rank==='elite'||e.rank==='rare'?4:0)];
}
export function enemyMovementMultiplier(e:Source):number{return enemyModifiers(e).reduce((n,m)=>n*m.speed,1)*(1+riftBonus(e.rift,'swift')/100);}
export function enemyVisualScale(e:Source):number{
  const avenger=1+(e.affixState?.stacks??0)*ELITE_AFFIX_RULES.avenger.scalePerStack;
  return (isBossKind(e.kind)?1:e.rank==='rare'?1.34:e.rank==='elite'?1.28:e.rank==='veteran'?1.14:1)*avenger;
}

/** Spawn and save restoration must apply the same snapshotted combat modifiers. */
export function applyEnemyModifiers<T extends {maxHp:number;damage:number}>(stats:T, source:Source):T {
  const result=riftEnemyStats(stats,source.rift);
  const heroicBoss=source.heroic&&isBossKind(source.kind)?HEROIC_BOSS_HEALTH:1;
  return {...result,maxHp:Math.round(result.maxHp*heroicBoss),damage:Math.round(result.damage*enemyModifiers(source).reduce((value,trait)=>value*trait.damage,1))};
}
