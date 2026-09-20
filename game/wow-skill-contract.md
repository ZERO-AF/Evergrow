# WoW Skill Authoring Contract (Evergrow)

You are authoring WotLK (Wrath of the Lich King) class skills for Evergrow, a 2D canvas ARPG.
Each skill is a `WowSkill` literal in `src/wow-skills-<class>.ts`. You ONLY edit that one file.

## WowSkill shape
```ts
interface WowSkill {
  id: WowSkillId;              // MUST be one of the ids assigned to you (already in the union)
  name: string;                // exact WotLK spell name
  classId: '<class>';          // your class
  requirement: 'any'|'melee'|'blade'|'heavy'|'dagger'|'bow'|'magic'|'shield';
  domain: 'Might'|'Cunning'|'Arcana';
  tier: 'basic'|'advanced'|'ultimate';   // basic = spammable/early, advanced = mid, ultimate = capstone/long-cd
  manaCost: number;            // class resource cost (rage/energy/mana/runic); 0 for free
  cooldown: number;            // seconds; 0 = no cooldown
  damageMultiplier: number;    // weapon/spell damage multiplier; 0 for pure utility
  color: string;               // use the class color const already at top of your file
  // optional:
  resource?: 'mana'|'rage'|'energy'|'runicPower';
  runeCost?: Partial<Record<'blood'|'frost'|'unholy',number>>;  // death knight
  runicPowerGain?: number;
  shardCost?: number;          // warlock soul shards
  combo?: 'build'|'spend';     // rogue / cat druid
  castTime?: number;           // seconds; omit = instant
  channel?: { duration:number; ticks:number };
  targetMode?: 'enemy'|'point'|'self'|'enemyOrPoint';  // omit = 'point'
  range?: number;              // world units for 'enemy' targeted (~14 units/yard)
  offGcd?: boolean;            // stances/forms/racials/most instants
  executeThreshold?: number;   // e.g. 0.2 = only below 20% target hp
  requiresStealth?: boolean;
  requiresForm?: 'bear'|'cat'|'moonkin'|'travel'|'shadow'|'metamorph'|'ghostWolf';
  requiresBehind?: boolean;
  description: string;         // one sentence, WotLK flavor, no WoW proper nouns needed
  execution: SkillExecution;   // see below
}
```

## SkillExecution — use ONLY these existing kinds (do NOT invent new kinds)
- `{kind:'strike', school?, dot?, slow?:{duration,factor}, stun?, silence?, healFrac?, sunder?, bonusVsDot?, bonusVsFrozen?, bonusBehind?, bonusVsRooted?, consumeDot?:{school,multiplier}}` — single melee/spell hit
- `{kind:'dot', dot:DotSpec, direct?}` — damage over time
- `{kind:'heal', amount:number, maxHpFrac?, hot?:HotSpec, consumeHot?}` — direct heal (amount = flat, maxHpFrac = fraction of max life)
- `{kind:'hot', hot:HotSpec, maxHpFrac?}` — heal over time
- `{kind:'buff', buff:BuffSpec}` — self buff/stance/seal/aspect/armor
- `{kind:'cc', cc:CcKind, duration:number, radius?, maxTargets?, resourceGain?}` — crowd control
- `{kind:'interrupt', silence:number}` — spell interrupt + silence
- `{kind:'pull', stun?}` — Death Grip style pull
- `{kind:'taunt', duration:number, expose?}` — force target / expose
- `{kind:'summon', ally:AllyKind, count:number, duration?}` — pet/totem/minion
- `{kind:'channel', school:DotSchool, ticks:number, duration:number, radius?, slow?, healFrac?, executeBonus?, manaPerTick?}` — channeled
- `{kind:'form', form:ShapeshiftForm, buff:BuffSpec}` — shapeshift
- `{kind:'stealth', duration:number, dropAggro?}` — stealth/vanish
- `{kind:'comboStrike', build?, spend?, school?, dot?, stunPerCombo?, buffPerCombo?, sunder?, requiresBehind?, requiresStealth?}` — rogue/cat combo
- `{kind:'runeStrike', school?, dot?, healFrac?, diseaseBonus?}` — DK rune strike
- `{kind:'cleanse', heal?, removeCc?, resourceGain?, buff?, hpCost?, resourceGainFrac?}` — cleanse/dispel/Life Tap
- `{kind:'sweep', reachMultiplier:number, arc:number}` — melee arc
- `{kind:'dash', duration:number, speed:number, radius:number, stun?, toTarget?}` — charge/leap
- `{kind:'step', duration:number, speed:number, retreat?, shot?, pierce?}` — short blink/disengage
- `{kind:'radial', targetRange?, radius:number, melee:boolean, stun?, slow?, style?, shelter?:{duration,reduction}}` — AoE around self/point
- `{kind:'cone', radius:number, arc:number, stun:number}` — frontal cone
- `{kind:'guard', duration:number, reduction:number}` — damage shield
- `{kind:'ward', duration:number, fraction:number}` — absorb ward
- `{kind:'stance', duration:number, reduction:number, charges:number, bonus:number, echo?}` — temporary stance
- `{kind:'backstab', minRange:number, reachMultiplier:number, arc:number, rearAngle:number, rearMultiplier:number, targets?}` — positional strike
- `{kind:'projectile', speed:number, radius:number, offsets:number[], effects:{style:ProjectileStyle, pierce?, chain?, chainRange?, blastRadius?, burnDuration?, burnDamageMultiplier?, groundDamageMultiplier?, slowFactor?, slowDuration?, lifeSteal?}}` — missile
- `{kind:'ground', effect:'meteor'|'arrowRain'|'storm'|'frost', radius:number, delay:number, duration:number, interval:number, style:ProjectileStyle, scatter?, scorch?, slow?, stun?, follow?, burn?}` — ground AoE
- `{kind:'chain', jumps:number, range:number, falloff:number, duration:number, style:ProjectileStyle, revisit?}` — chain lightning style
- `{kind:'aura', aura:AuraId, rank:number}` — passive aura (rarely needed)

## Payload types (from wow-types.ts)
- `DotSpec = { school:DotSchool, dpsMultiplier?|flatDps?, duration:number, interval?, ramp?, detonate? }`
- `HotSpec = { perTick?|flatTick?, duration:number, interval? }`
- `BuffSpec = { stats?:StatModifiers, duration:number, absorb?, reduction?, healPerSecond?, manaPerSecond?, resourcePerSecond?, exclusiveGroup?, form?, stealth?, reflect?, imbue?:{element,fraction}, breakControl?, allyDamage?, petShare?, immunity?, leech? }`
- `CcKind = 'root'|'fear'|'incapacitate'|'polymorph'|'silence'|'stun'|'freeze'|'slow'`
- `AllyKind = 'imp'|'felhunter'|'felguard'|'voidwalker'|'wolf'|'bear'|'cat'|'ghoul'|'waterElemental'|'mirrorImage'|'searingTotem'|'healingTotem'|'earthbindTotem'|'spiritWolf'|'infernal'`
- `DotSchool = DamageType|'bleed'|'poison'|'nature'|'holy'|'shadow'` (DamageType = 'physical'|'fire'|'frost'|'lightning'|'arcane')
- `StatModifiers` keys include: damagePercent, spellDamagePercent, attackSpeedPercent, castSpeedPercent, critPercent, armor, maxLifePercent, maxManaPercent, moveSpeedPercent, dodgePercent, etc.

## Rules
- WotLK accuracy: real spell names, real-ish costs/cooldowns/effects. Costs in the CLASS resource (warrior=rage, rogue/cat=energy, dk=runicPower+runes, others=mana).
- `damageMultiplier` ~0.5–3.0 for attacks; 0 for pure utility/buffs/heals (heals use `heal`/`hot` execution).
- Keep the existing class color const (e.g. `const W='#C79C6E'`). Add a const if your file lacks one.
- Append new entries inside the existing `Object.freeze([...])` array. Do NOT reorder existing entries.
- Every id you add MUST already exist in the `WowSkillId` union in `src/character-types.ts` (it does — use exactly those spellings).
- Do NOT touch any other file. Do NOT run tests or builds.
- Match the existing file's formatting (2-space indent, single quotes, trailing commas).
