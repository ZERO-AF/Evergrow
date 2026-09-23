import { advanceUniqueEffects, type StoredEmbers, type WardBurst } from './unique-combat.ts';
import { hasUnique } from './unique-content.ts';
import type { HitSnapshot, Player, ProjectileEffects, WowBuff } from './model.ts';
import type { SkillId } from './character-types.ts';
import type { ProjectileDefinition } from './combat-content.ts';
import { canUseSkill } from './skill-content.ts';
import { deriveCharacterStats } from './character-stats.ts';
import { getTreeBonuses } from './skill-tree.ts';
import { manaCapacity } from './auras.ts';
import { WOW_CLASSES, wowClassOf } from './wow-classes.ts';
import type { WowClassDef } from './wow-types.ts';
export interface TimedSkillStance { remaining: number; reduction: number; charges: number; bonus: number; }
export interface SkillEcho { delay: number; x: number; y: number; angle: number; definition: ProjectileDefinition; effects: ProjectileEffects; }
export interface PlayerSkillEffects {
  uniqueSerial?: number;
  draw?: {slot:number;elapsed:number;released?:boolean;remaining:number};
  bastion?: {damage:number;remaining:number};
  harvest?: Array<{target:number;remaining:number}>;
  conductor?: {x:number;y:number;remaining:number};
  decoy?: {id:number;x:number;y:number;radius:number;reach:number;angle:number;remaining:number;hp:number;maxHp:number};
  returnStep?: {x:number;y:number;remaining:number;speed:number;outward?:Player['dash']};
  archer?: {x:number;y:number;angle:number;remaining:number;shotRemaining?:number};
  borrowed?: {capacity:number;remaining:number};
  brace?: TimedSkillStance; rallyOfIron?: TimedSkillStance; ghostHunt?: TimedSkillStance;
  shelters?: Partial<Record<SkillId, { remaining: number; reduction: number }>>;
  embers?: StoredEmbers[];
  /** Legendary proc state by equipped item id: icd remaining + gathered stacks. */
  procs?: Record<string, { cooldown: number; stacks: number }>;
  ward?: { remaining: number; capacity: number; rupture?: {absorbed:number;cap:number;radius:number;offense:HitSnapshot} };
  echoes: SkillEcho[];
}
export const skillEffects = (p: Player): PlayerSkillEffects => p.skillEffects ??= { echoes: [] };
export function snapshotSkillOffense(p: Player, skill?: SkillId): HitSnapshot {
  return { ...(skill ? { skill } : {}), playerId:p.id ?? 0, critChance:p.derived.critChance,critMultiplier:p.derived.critMultiplier,lifeOnHit:p.derived.lifeOnHit,directDamageMultiplier:p.derived.directDamageMultiplier ?? 1,hitRating:p.derived.hitRating,expertise:p.derived.expertise };
}
/** Consume at manual action commitment, once for a sweep/volley, never per contact. */
export function consumeRally(p: Player, melee: boolean): number {
  const buff=p.skillEffects?.rallyOfIron;
  if(!melee || !buff || buff.remaining<=0 || buff.charges<=0 || !canUseSkill('rallyOfIron',p.equipment))return 1;
  buff.charges--;return 1+buff.bonus;
}
/** One delayed first-arrow snapshot per action. Topology and crit survive; healing/statuses/recursion do not. */
export function queueSkillEcho(p: Player, x:number,y:number,angle:number,definition:ProjectileDefinition,effects:ProjectileEffects,aim?:{x:number;y:number}):void {
  const state=p.skillEffects,buff=state?.ghostHunt;
  if(!state || !buff || buff.remaining<=0 || buff.charges<=0 || state.echoes.length>=5 || effects.style!=='arrow' || !canUseSkill('ghostHunt',p.equipment))return;
  buff.charges--;
  const archer=state.archer;
  if(archer){const reach=definition.speed*definition.life;angle=Math.atan2((aim?.y??y+Math.sin(angle)*reach)-archer.y,(aim?.x??x+Math.cos(angle)*reach)-archer.x);x=archer.x;y=archer.y;archer.angle=angle;archer.shotRemaining=.32;}
  state.echoes.push({delay:.32,x,y,angle,definition:{...definition,damage:definition.damage*buff.bonus},effects:{style:'arrow',pierce:effects.pierce,chain:effects.chain,chainRange:effects.chainRange,offense:{skill:'ghostHunt',playerId:p.id ?? 0,critChance:effects.offense?.critChance??0,critMultiplier:effects.offense?.critMultiplier??1.5,lifeOnHit:0,directDamageMultiplier:effects.offense?.directDamageMultiplier??1}}});
}
/** Highest stance mitigation wins; a finite ward consumes only the remaining damage. */
export function mitigateSkillHit(p: Player, amount:number):{damage:number;absorbed:number;burst?:WardBurst} {
  const s=p.skillEffects;if(!s)return{damage:amount,absorbed:0};
  const reduction=Math.max(...Object.entries(s.shelters??{}).map(([id,b])=>b.remaining&&canUseSkill(id as SkillId,p.equipment)?b.reduction:0),s.brace?.remaining? s.brace.reduction:0,s.rallyOfIron?.remaining&&canUseSkill('rallyOfIron',p.equipment)?s.rallyOfIron.reduction:0);
  amount=Math.max(1,Math.round(amount*(1-reduction)));
  const ward=s.ward?.remaining&&canUseSkill('runicWard',p.equipment)?s.ward:undefined;
  const absorbed=ward?Math.min(amount,ward.capacity):0;
  let burst:WardBurst|undefined;
  if(ward){
    ward.capacity-=absorbed;
    if(ward.rupture)ward.rupture.absorbed+=absorbed;
    if(ward.capacity<=0){
      if(ward.rupture&&hasUnique(p.character,'broken-seal'))burst={damage:Math.min(ward.rupture.absorbed,ward.rupture.cap),radius:ward.rupture.radius,offense:ward.rupture.offense};
      delete s.ward;
    }
  }
  const borrowed=s.borrowed;
  const borrowedAbsorbed=borrowed?Math.min(amount-absorbed,borrowed.capacity):0;
  if(borrowed){borrowed.capacity-=borrowedAbsorbed;if(borrowed.capacity<=0)delete s.borrowed;}
  return{damage:amount-absorbed-borrowedAbsorbed,absorbed:absorbed+borrowedAbsorbed,...(burst?{burst}:{})};
}
export function advanceSkillEffects(p: Player,dt:number,emitEcho?:(echo:SkillEcho)=>boolean|void):void {
  const s=p.skillEffects;if(!s)return;if(p.dead){p.skillEffects=undefined;return;}
  for(const id of ['brace','rallyOfIron','ghostHunt'] as const){const b=s[id];if(b){b.remaining=Math.max(0,b.remaining-dt);if(!b.remaining||!p.character.allocatedNodes.includes(`skill:${id}`)||!canUseSkill(id,p.equipment))delete s[id];}}
  for(const [id,b]of Object.entries(s.shelters??{})){b.remaining=Math.max(0,b.remaining-dt);if(!b.remaining||!p.character.allocatedNodes.includes(`skill:${id}`)||!canUseSkill(id as SkillId,p.equipment))delete s.shelters![id as SkillId];}
  if(s.ward){s.ward.remaining=Math.max(0,s.ward.remaining-dt);s.ward.capacity=Math.min(s.ward.capacity,p.maxHp*.35);if(!s.ward.remaining||!p.character.allocatedNodes.includes('skill:runicWard')||!canUseSkill('runicWard',p.equipment))delete s.ward;}
  // The shared barrier budget uses the current life limit and surviving ward.
  advanceUniqueEffects(p,dt);
  // Legendary proc cooldowns tick down; entries die with the item that owns them.
  if(s.procs)for(const [itemId,proc]of Object.entries(s.procs)){proc.cooldown=Math.max(0,proc.cooldown-dt);
    const equipped=Object.values(p.character.equipped).some(item=>item?.id===itemId);
    if(!equipped||proc.cooldown<=0&&proc.stacks<=0)delete s.procs[itemId];}
  if(s.archer&&!s.ghostHunt){delete s.archer;s.echoes=[];}
  if(!p.character.allocatedNodes.includes('skill:ghostHunt')||!canUseSkill('ghostHunt',p.equipment))s.echoes=[];
  for(const echo of s.echoes)echo.delay-=dt;
  if(emitEcho){const due=s.echoes.filter(e=>e.delay<=0);s.echoes=s.echoes.filter(e=>e.delay>0);for(const echo of due)if(emitEcho(echo)===false)s.echoes.push(echo);}
}

/** Active resource model: a bear/cat shapeshift buff swaps the pool (rage/energy rules);
 * every other form and the base class keep their own model. */
export function resourceModelOf(p: Player): WowClassDef | undefined {
  const form = p.buffs?.find(buff => buff.form && buff.remaining > 0)?.form;
  if (form === 'bear') return WOW_CLASSES.warrior;
  if (form === 'cat') return WOW_CLASSES.rogue;
  return wowClassOf(p.character);
}

/** Rebuild derived stats with live buff modifiers folded in (combat overlay seam:
 * sheet-level derivation has no player, so buffs join here at add/remove/refresh). */
export function refreshBuffStats(p: Player): void {
  const derived = deriveCharacterStats(p.character, getTreeBonuses(p.character.allocatedNodes), p.level, p.buffs, p);
  p.derived = derived;
  p.stats = { castSpeedMultiplier: derived.castSpeedMultiplier, attackDamageMultiplier: derived.attackDamageMultiplier,
    attackSpeedMultiplier: derived.attackSpeedMultiplier, spellDamageMultiplier: derived.spellDamageMultiplier };
  p.maxHp = derived.maxHp;
  // Non-mana resource pools keep their class cap; updatePlayer re-asserts it each tick.
  const model = resourceModelOf(p);
  if (!model || model.resource === 'mana') p.maxMana = derived.maxMana;
  p.hp = Math.min(p.hp, p.maxHp);
  p.mana = Math.min(p.mana, manaCapacity(p));
}

/** Form end hands the stashed pool back: bear/cat ran on rage/energy, mana returns. */
export function restoreFormResource(p: Player, buff: WowBuff): void {
  if (buff.form !== 'bear' && buff.form !== 'cat') return;
  const cls = wowClassOf(p.character);
  if (cls && cls.resource !== 'mana') {
    p.maxMana = cls.resourceCap;
  } else {
    // p.maxMana still holds the 100-point form pool here, so derive the real
    // mana cap without the outgoing form buff rather than reading the stale cap.
    const rest = (p.buffs ?? []).filter(b => b !== buff);
    p.maxMana = deriveCharacterStats(p.character, getTreeBonuses(p.character.allocatedNodes), p.level, rest, p).maxMana;
  }
  p.mana = Math.min(p.maxMana, buff.storedResource ?? 0);
}

/** WoW buff clock: expiry, per-second heal/mana/resource ticks, stealth flag sync.
 * healPerSecond/manaPerSecond are fractions of the player's maxima; resourcePerSecond is flat units.
 * Stealth is carried by stealth buffs; p.stealthed is the cached flag enemy AI reads. */
export function advanceWowBuffs(p: Player, dt: number, resourceCap: number): void {
  const buffs = p.buffs;
  let removed = false;
  if (buffs) for (const buff of buffs) {
    buff.remaining = Math.max(0, buff.remaining - dt);
    const rate = (buff.healPerSecond ?? 0) + (buff.manaPerSecond ?? 0) + (buff.resourcePerSecond ?? 0);
    if (rate > 0 && buff.remaining > 0) {
      buff.tickAcc = (buff.tickAcc ?? 0) + dt;
      if (buff.tickAcc >= .5) {
        const acc = buff.tickAcc; buff.tickAcc = 0;
        if (buff.healPerSecond) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * buff.healPerSecond * acc);
        if (buff.manaPerSecond) p.mana = Math.min(p.maxMana, p.mana + p.maxMana * buff.manaPerSecond * acc);
        if (buff.resourcePerSecond) p.mana = Math.min(resourceCap, p.mana + buff.resourcePerSecond * acc);
      }
    }
  }
  if (buffs?.length) {
    for (const buff of buffs) if (buff.remaining <= 0) { removed = true; restoreFormResource(p, buff); }
    p.buffs = buffs.filter(buff => buff.remaining > 0);
  }
  if (removed) refreshBuffStats(p);
  p.stealthed = p.buffs?.some(buff => buff.stealth) ?? false;
  // Player-side CC clock: enemies do not apply control yet, but cleanse/breakControl
  // and the immunity window are live contract.
  p.ccImmunity = Math.max(0, (p.ccImmunity ?? 0) - dt);
  if (p.cc?.length) {
    for (const effect of p.cc) effect.remaining = Math.max(0, effect.remaining - dt);
    p.cc = p.cc.filter(effect => effect.remaining > 0);
  }
}
