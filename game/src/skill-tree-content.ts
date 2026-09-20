import type { StatModifiers } from './character-types.ts';
import type { WowClassId } from './wow-types.ts';
import { WOW_CLASS_SKILLS } from './wow-skills.ts';
import type { WowSkill } from './skill-execution-content.ts';

export interface Territory { id: string; name: string; domain: 'Might' | 'Cunning' | 'Arcana'; angle: number; bend: number; color: string; motto: string; }
export const SKILL_TERRITORIES: readonly Territory[] = Object.freeze([
  { id: 'bastion', name: 'Bastion', domain: 'Might', angle: -2.62, bend: -.10, color: '#e5bd80', motto: 'Endure · recover · retaliate' },
  { id: 'forge', name: 'Forge', domain: 'Might', angle: 2.62, bend: .10, color: '#eb986f', motto: 'Impact · reach · commitment' },
  { id: 'hunt', name: 'Hunt', domain: 'Cunning', angle: -.52, bend: -.10, color: '#b9d990', motto: 'Distance · projectiles · precision' },
  { id: 'veil', name: 'Veil', domain: 'Cunning', angle: .52, bend: .10, color: '#79d5be', motto: 'Movement · openings · tempo' },
  { id: 'crucible', name: 'Crucible', domain: 'Arcana', angle: 1.57, bend: -.07, color: '#c7a0ef', motto: 'Flame · lightning · spellweave' },
  { id: 'wellspring', name: 'Wellspring', domain: 'Arcana', angle: -1.57, bend: .07, color: '#8bd9ef', motto: 'Frost · reserves · wards' },
]);
export interface Specialty { name: string; small: StatModifiers; reward: StatModifiers; description: string; }
const f = (name: string, small: StatModifiers, reward: StatModifiers, description: string): Specialty => ({ name, small, reward, description });
/** Broad passive rewards compete with focused skill ranks without changing attribute or gear scaling.
 * Dedicated damage: 8% minor / 24% endpoint. Crit-damage investments include useful chance.
 * Each territory keeps eight authored subjects; graph geometry owns the access cost. */
export const TERRITORY_SPECIALTIES: Readonly<Record<string, readonly Specialty[]>> = {
  bastion: [
    f('First Shelter',{maxHp:8},{maxHp:24,vitality:2},'A larger life reserve.'),
    f('Shieldwork',{blockChance:1},{blockChance:4,blockReduction:5},'Block more often and absorb more with a shield.'),
    f('Living Stone',{armor:8},{armor:32,afterguardPercent:24},'Blocking primes three seconds of stronger armor; requires a shield.'),
    f('Second Breath',{lifeRegen:.15},{lifeRegen:.65,maxHp:12},'Recover life steadily between hits.'),
    f('Ashproof',{fireResistance:3},{fireResistance:12,lightningResistance:6},'Prepare for fire and lightning.'),
    f('Deep Draught',{potionPercent:3},{potionPercent:15},'Increase actual life and mana restored by your shared potion.'),
    f('Unbroken',{vitality:2},{vitality:6,allResistance:4},'Life and broad elemental protection.'),
    f('Winter Wall',{frostResistance:3},{frostResistance:12,arcaneResistance:8},'A defense against frost and arcane hits.'),
  ],
  forge: [
    f('Tempered Edge',{damagePercent:8},{damagePercent:24},'Reliable weapon damage.'),
    f('Wide Arc',{damagePercent:6},{areaPercent:20,damagePercent:10},'Larger sweeps, shockwaves and other area skills.'),
    f('Blood and Iron',{maxHp:6},{lifeOnHit:1.5,damagePercent:14},'Direct hits restore life; periodic damage cannot trigger it.'),
    f('Heavy Hand',{strength:3},{strength:6,critChance:2,critDamage:20},'Strength with stronger critical impacts.'),
    f('Battle Rhythm',{attackSpeedPercent:3},{attackSpeedPercent:10,manaCostPercent:4},'Shorter recovery and cheaper actions.'),
    f('War Reserve',{maxMana:5},{maxMana:18,manaOnKill:2},'A reserve for expensive weapon skills.'),
    f('Fault Line',{areaPercent:4},{areaPercent:18,damagePercent:12},'Broaden the space controlled by heavy attacks.'),
    f('Iron Harvest',{lifeOnHit:.25},{lifeOnHit:1,armor:24},'Direct-hit sustain supported by physical armor.'),
  ],
  hunt: [
    f('Sure Aim',{dexterity:3,damagePercent:3},{dexterity:6,damagePercent:14},'Dexterity and bow-ready weapon damage.'),
    f('Flight Path',{damagePercent:6},{projectilePierce:1},'Non-explosive skill projectiles pass through one more enemy.'),
    f('Perfect Opening',{critChance:1.5,critDamage:4},{critChance:4,critDamage:20},'Build toward precise critical hits.'),
    f('Field Supplies',{manaRegen:.5},{manaOnKill:2,potionPercent:8},'Keep resources available during long hunts.'),
    f('Arrowstorm',{areaPercent:4},{areaPercent:18,attackSpeedPercent:7},'Wider ground coverage and faster bow recovery.'),
    f('Heartseeker',{critDamage:8,critChance:.75},{critDamage:28,critChance:2,damagePercent:12},'Commit to powerful critical impacts.'),
    f('Running Quarry',{moveSpeedPercent:2},{moveSpeedPercent:6,cooldownPercent:3},'Reposition and recover utility skills sooner.'),
    f('Far Horizon',{dexterity:3,damagePercent:3},{projectilePierce:1,critChance:2},'A second route into line shots.'),
  ],
  veil: [
    f('Light Foot',{moveSpeedPercent:2},{moveSpeedPercent:6},'Every step becomes faster.'),
    f('Quick Steel',{attackSpeedPercent:3},{attackSpeedPercent:11},'Shorten weapon recovery.'),
    f('Borrowed Time',{cooldownPercent:1},{cooldownPercent:4},'Recover skills and dodge charges sooner.'),
    f('Close Quarters',{damagePercent:6},{lifeOnHit:1,critChance:3,critDamage:12},'Direct contact rewards accuracy and sustain.'),
    f('Quiet Mind',{manaCostPercent:1},{manaCostPercent:5,maxMana:12},'Reserve mana for repositioning.'),
    f('Cutpurse Ward',{arcaneResistance:3},{arcaneResistance:12,moveSpeedPercent:4},'Arcane protection without giving up mobility.'),
    f('Knife Edge',{critDamage:8,critChance:1},{critChance:4,critDamage:28},'A deliberate critical investment.'),
    f('Elusive Heart',{maxHp:7},{maxHp:22,cooldownPercent:3},'Survive a mistake and recover your escape.'),
  ],
  crucible: [
    f('Kindling',{spellDamagePercent:8},{spellDamagePercent:24},'Stronger spell hits and their snapshotted effects.'),
    f('Live Wire',{castSpeedPercent:3},{castSpeedPercent:11},'Faster spell windups and recovery.'),
    f('Spellweave',{maxMana:5},{spellweavePercent:20},'Enables Spellweave: melee hits empower spells; spell hits empower melee. Four seconds. No skill slot.'),
    f('Furnace Mouth',{areaPercent:4},{areaPercent:20,spellDamagePercent:12},'Broaden spell explosions and ground effects.'),
    f('Conductive Vein',{manaRegen:.6},{manaRegen:2.5,lightningResistance:8},'Regenerate mana while insulating against lightning.'),
    f('Cinder Skin',{fireResistance:3},{fireResistance:12,maxHp:20},'Protection for close-range casting.'),
    f('Volatile Thought',{critChance:1.25,critDamage:4},{critChance:4,critDamage:24},'Spell and weapon critical power.'),
    f('Afterburn',{intelligence:3,spellDamagePercent:3},{intelligence:6,spellDamagePercent:16},'A late investment into raw spell potency.'),
  ],
  wellspring: [
    f('Clear Water',{manaRegen:.6},{manaRegen:2.5,maxMana:12},'Mana regeneration is displayed per five seconds.'),
    f('Reservoir',{maxMana:6},{maxMana:24},'Bank mana for expensive spells and wards.'),
    f('Rime Shell',{frostResistance:3},{frostResistance:12,maxHp:16},'A cold-weather reserve of life.'),
    f('Still Current',{manaCostPercent:1},{manaCostPercent:5,manaRegen:1.5},'Efficient casts supported by regeneration.'),
    f('Icefield',{areaPercent:4},{areaPercent:22},'Control a larger area with frost and other area skills.'),
    f('Soul Stitch',{lifeRegen:.15},{lifeRegen:.6,arcaneResistance:8},'Slow recovery with arcane protection.'),
    f('Returning Tide',{cooldownPercent:1},{cooldownPercent:4,maxMana:12},'Recover major spells sooner.'),
    f('Deep Aquifer',{intelligence:2},{maxMana:26,allResistance:4},'Reserves and elemental resilience.'),
  ],
};
/** Late optional clusters use ordinary passive budgets; none shortens an ultimate route. */
export const OUTER_SPECIALTIES: Readonly<Record<string, readonly Specialty[]>> = {
 bastion:[
  f('Stonefast',{armor:8},{armor:24,blockReduction:4},'Physical armor with deeper shield absorption.'),
  f('Ember Refuge',{fireResistance:3},{fireResistance:10,lifeRegen:.5},'Fire protection and steady life recovery.'),
  f('Last Vigil',{maxHp:7},{maxHp:20,potionPercent:10},'A final life reserve supported by stronger potions.'),
 ],
 veil:[
  f('Silent Passage',{arcaneResistance:3},{arcaneResistance:10,manaCostPercent:3},'Arcane protection with cheaper repositioning.'),
  f('Patient Blade',{critDamage:8,critChance:.75},{critDamage:24,critChance:3,manaRegen:1.5},'Prepare critical openings while mana returns.'),
  f('Moonlit Recovery',{lifeRegen:.1},{lifeRegen:.5,cooldownPercent:3},'Recover between openings and bring escapes back sooner.'),
 ],
};
/** Border gardens offer hybrid investments between the six primary roads. */
export const BORDER_GARDENS: readonly { from: string; to: string; specialties: readonly Specialty[] }[] = [
  {from:'bastion',to:'wellspring',specialties:[
    f('Mending Waters',{maxHp:5},{lifeRegen:.5,manaRegen:1.5},'Life and mana recovery for a patient defender.'),
    f('Glacial Aegis',{armor:6},{blockReduction:5,frostResistance:8},'Shield absorption backed by frost resistance.'),
    f('Sanctuary',{maxMana:4},{maxHp:18,maxMana:16},'Build both reserves before a difficult encounter.'),
    f('Crystal Rampart',{frostResistance:2},{armor:24,arcaneResistance:8},'Physical armor and arcane insulation.'),
    f('Restorative Ritual',{potionPercent:2},{potionPercent:10,manaCostPercent:3},'Stretch your potion and the mana it restores.'),
    f('Watchful Stillness',{lifeRegen:.1},{afterguardPercent:16,manaRegen:2},'Blocking reinforces armor while mana steadily returns.'),
  ]},
  {from:'wellspring',to:'hunt',specialties:[
    f('Dewcatcher',{manaRegen:.4},{manaOnKill:2,maxMana:12},'Fund sustained ranged attacks with kills and a larger reserve.'),
    f('Winter Pursuit',{frostResistance:2},{moveSpeedPercent:5,frostResistance:8},'Keep moving through hostile cold.'),
    f('Lucid Aim',{dexterity:2,intelligence:2},{critChance:3,critDamage:12,maxMana:16},'Precision supported by mana.'),
    f('Mistwalker',{maxMana:4},{cooldownPercent:3,arcaneResistance:8},'Recover repositioning skills with arcane protection.'),
    f('Silver Current',{manaCostPercent:1},{attackSpeedPercent:7,manaRegen:1.5},'Keep bow recovery and mana recovery in step.'),
    f('Distant Echo',{critDamage:8,critChance:.75},{areaPercent:16,critChance:2,critDamage:16,manaOnKill:2},'Critical investment with wider coverage and kill sustain.'),
  ]},
  {from:'hunt',to:'veil',specialties:[
    f('Trail Runner',{dexterity:2,moveSpeedPercent:1},{moveSpeedPercent:5,maxHp:12},'Travel quickly with a small margin for mistakes.'),
    f('Ambush Craft',{damagePercent:5},{critChance:3,critDamage:12,attackSpeedPercent:5},'Fast, precise openings for weapon attacks.'),
    f('Moving Target',{maxHp:5},{cooldownPercent:3,moveSpeedPercent:4},'Faster escapes and steadier repositioning.'),
    f('Predator Rhythm',{attackSpeedPercent:3},{damagePercent:16,manaOnKill:2},'Weapon tempo sustained by kills.'),
    f('Needlework',{critChance:1.25,critDamage:4},{critChance:3,critDamage:24,lifeOnHit:.75},'Critical precision with direct-hit recovery.'),
    f('Wild Instinct',{dexterity:2,damagePercent:3},{dexterity:6,allResistance:3},'Sharpen weapon handling without abandoning protection.'),
  ]},
  {from:'veil',to:'crucible',specialties:[
    f('Sparkstep',{maxMana:4,castSpeedPercent:2},{castSpeedPercent:7,moveSpeedPercent:4},'Cast, reposition, and find the next opening.'),
    f('Cinder Veil',{fireResistance:2},{fireResistance:8,cooldownPercent:3},'Fire protection for close-range repositioning.'),
    f('Dancing Embers',{damagePercent:5,spellDamagePercent:3},{spellweavePercent:20,attackSpeedPercent:5},'Enables Spellweave and improves alternating melee and magic.'),
    f('Fleet Incantation',{castSpeedPercent:3},{manaCostPercent:4,moveSpeedPercent:4},'Mobile casting with lighter mana demands.'),
    f('Stormglass',{lightningResistance:2},{critChance:3,critDamage:16,lightningResistance:8},'Critical investment with lightning insulation.'),
    f('Shadow Conduit',{intelligence:2,spellDamagePercent:3},{spellDamagePercent:20,lifeOnHit:.75},'Stronger spells and recovery from direct contact.'),
  ]},
  {from:'crucible',to:'forge',specialties:[
    f('Runesmith',{strength:2,intelligence:2},{damagePercent:14,spellDamagePercent:14},'A balanced foundation for a spellblade.'),
    f('Tempered Will',{armor:6},{maxMana:16,fireResistance:8},'Armor, mana and protection against fire.'),
    f('Resonant Steel',{damagePercent:5,spellDamagePercent:3},{spellweavePercent:22,maxHp:12},'Enables Spellweave with extra life for melee and magic builds.'),
    f('Molten Reach',{areaPercent:4},{areaPercent:16,spellDamagePercent:12},'Broaden weapon sweeps and magical explosions.'),
    f('Furnace Heart',{maxHp:5},{manaOnKill:2,lifeOnHit:.75},'Direct contact and kills replenish different resources.'),
    f('Thunder Anvil',{critDamage:8,critChance:.75},{strength:4,critChance:2,critDamage:16,castSpeedPercent:6},'Critical power with strength and faster casting.'),
  ]},
  {from:'forge',to:'bastion',specialties:[
    f('Frontline',{armor:6},{maxHp:18,damagePercent:12},'A first investment in offense and survival.'),
    f('Steady Grip',{strength:2,damagePercent:3},{blockChance:2,attackSpeedPercent:5},'Shield readiness without sacrificing weapon tempo.'),
    f('Scar Tissue',{maxHp:5},{lifeOnHit:1,lifeRegen:.3},'Recover through direct hits and quiet moments.'),
    f('Siegebreaker',{damagePercent:5},{areaPercent:16,armor:20},'Control more space while wearing physical armor.'),
    f('Iron Provision',{maxMana:4},{potionPercent:12,maxHp:12},'A stronger shared potion and a larger life reserve.'),
    f('Lasting Resolve',{vitality:1},{afterguardPercent:18,damagePercent:14},'Blocking reinforces armor before the next weapon exchange.'),
  ]},
];

export interface Doctrine { id: string; territory: string; name: string; choices: readonly { name: string; description: string; bonuses: StatModifiers }[]; }
export const SKILL_DOCTRINES: readonly Doctrine[] = [
  {id:'guard',territory:'bastion',name:'Guard Doctrine',choices:[
    {name:'Deflect',description:'Shield block chance +5%.',bonuses:{blockChance:5}},
    {name:'Absorb',description:'Shield block reduction +10%.',bonuses:{blockReduction:10}},
    {name:'Recover',description:'Life regeneration +1 per second.',bonuses:{lifeRegen:1}}]},
  {id:'impact',territory:'forge',name:'Impact Doctrine',choices:[
    {name:'Weight',description:'Weapon damage +28%.',bonuses:{damagePercent:28}},
    {name:'Reach',description:'Area of effect +24%.',bonuses:{areaPercent:24}},
    {name:'Rhythm',description:'Attack speed +12%.',bonuses:{attackSpeedPercent:12}}]},
  {id:'flight',territory:'hunt',name:'Flight Doctrine',choices:[
    {name:'Thread',description:'One additional pierce for non-explosive skill projectiles.',bonuses:{projectilePierce:1}},
    {name:'Precision',description:'Critical chance +5%, critical damage +24%.',bonuses:{critChance:5,critDamage:24}},
    {name:'Coverage',description:'Area of effect +24%.',bonuses:{areaPercent:24}}]},
  {id:'motion',territory:'veil',name:'Motion Doctrine',choices:[
    {name:'Stride',description:'Movement speed +8%.',bonuses:{moveSpeedPercent:8}},
    {name:'Return',description:'Skill cooldowns and dodge recharge 6% shorter.',bonuses:{cooldownPercent:6}},
    {name:'Economy',description:'Reduced mana costs +8%.',bonuses:{manaCostPercent:8}}]},
  {id:'casting',territory:'crucible',name:'Casting Doctrine',choices:[
    {name:'Incantation',description:'Spell damage +30%.',bonuses:{spellDamagePercent:30}},
    {name:'Impulse',description:'Cast speed +12%.',bonuses:{castSpeedPercent:12}},
    {name:'Alternation',description:'Enables Spellweave: +28% damage when alternating melee and magic.',bonuses:{spellweavePercent:28}}]},
  {id:'reserve',territory:'wellspring',name:'Reserve Doctrine',choices:[
    {name:'Depth',description:'Maximum mana +35.',bonuses:{maxMana:35}},
    {name:'Flow',description:'Mana regeneration +5 per five seconds.',bonuses:{manaRegen:5}},
    {name:'Shelter',description:'Maximum life +28 and all elemental resistances +3%.',bonuses:{maxHp:28,allResistance:3}}]},
  {id:'recovery',territory:'bastion',name:'Recovery Doctrine',choices:[
    {name:'Contact',description:'Direct hits restore +2 life.',bonuses:{lifeOnHit:2}},
    {name:'Draught',description:'Potion restoration +25%.',bonuses:{potionPercent:25}},
    {name:'Patience',description:'Life regeneration +1.2 per second.',bonuses:{lifeRegen:1.2}}]},
  {id:'insulation',territory:'wellspring',name:'Insulation Doctrine',choices:[
    {name:'Emberproof',description:'Fire and lightning resistances +12%.',bonuses:{fireResistance:12,lightningResistance:12}},
    {name:'Rimeproof',description:'Frost and arcane resistances +12%.',bonuses:{frostResistance:12,arcaneResistance:12}},
    {name:'Balanced',description:'All elemental resistances +7%.',bonuses:{allResistance:7}}]},
];

function freezeContent(value:object):void {Object.freeze(value);for(const child of Object.values(value))if(child&&typeof child==='object'&&!Object.isFrozen(child))freezeContent(child);}
for(const territory of SKILL_TERRITORIES)freezeContent(territory);
freezeContent(OUTER_SPECIALTIES);freezeContent(BORDER_GARDENS);freezeContent(TERRITORY_SPECIALTIES);freezeContent(SKILL_DOCTRINES);

/** A class-gated pocket in the Class Sanctum ring: the class's authored skill kit
 * plus three class-flavored passives and three specialization signature keystones.
 * Nodes cost one point and only unlock for a CharacterSheet whose classId matches. */
export interface ClassSanctum {
  readonly classId: WowClassId;
  readonly domain: Territory['domain'];
  readonly skills: readonly WowSkill[];
  readonly passives: readonly Specialty[];
  /** One keystone per WotLK specialization (WowClassDef.specs order). */
  readonly specs: readonly SpecSignature[];
}
/** A specialization keystone: the signature passive that defines the spec's
 * playstyle. `id` is unique within the class; `spec` is the WotLK tree name. */
export interface SpecSignature {
  readonly id: string;
  readonly spec: string;
  readonly name: string;
  readonly description: string;
  readonly bonuses: StatModifiers;
}
const sig = (id: string, spec: string, name: string, description: string, bonuses: StatModifiers): SpecSignature =>
  ({ id, spec, name, description, bonuses });
/** Spec keystone node id inside a class sanctum; the exclusivity family is `spec:<classId>`. */
export const specSignatureNode = (classId: WowClassId, specId: string) => `wow-${classId}-spec-${specId}`;
const s = (classId: WowClassId, domain: Territory['domain'], passives: readonly Specialty[], specs: readonly SpecSignature[]): ClassSanctum =>
  ({ classId, domain, skills: WOW_CLASS_SKILLS[classId], passives, specs });

/** The ten Class Sanctum clusters. Skill ids come from the authored kits in
 * wow-skills-*.ts (the WowSkillId union); passives keep ordinary atlas budgets. */
export const CLASS_SANCTUMS: readonly ClassSanctum[] = [
  s('warrior', 'Might', [
    f('Warrior Conditioning', { strength: 2 }, { strength: 4, damagePercent: 6 }, 'Raw strength behind every strike.'),
    f('Plate Discipline', { armor: 12 }, { armor: 30, maxHp: 15 }, 'Heavier plate worn well.'),
    f('Battle Fury', { damagePercent: 3 }, { damagePercent: 9, attackSpeedPercent: 2 }, 'Rage honed into harder blows.'),
  ], [
    sig('arms', 'Arms', 'Taste for Blood', 'Critical wounds run deep: Rend and Overpower fight above their training.', { 'skill:rend': 3, 'skill:overpower': 3, critDamage: 15 }),
    sig('fury', 'Fury', "Titan's Grip", 'Two-handed fury: Bloodthirst and Slam fight above their training.', { 'skill:bloodthirst': 3, 'skill:slam': 3, attackSpeedPercent: 6, damagePercent: 8 }),
    sig('protection', 'Protection', 'Sword and Board', 'Shield mastery: Shield Slam and Revenge fight above their training. Requires a shield.', { 'skill:shieldSlam': 3, 'skill:revenge': 3, blockChance: 4, blockReduction: 6 }),
  ]),
  s('paladin', 'Might', [
    f('Holy Might', { strength: 2 }, { strength: 3, damagePercent: 5 }, 'The Light lends weight to the blow.'),
    f('Devout Aegis', { armor: 10 }, { armor: 24, allResistance: 3 }, 'Faith made plate.'),
    f('Righteous Zeal', { spellDamagePercent: 3 }, { spellDamagePercent: 8, critChance: 1 }, 'Judgement burns brighter.'),
  ], [
    sig('holy', 'Holy', 'Beacon of Light', 'The Light answers faster: heals and holy spells hit harder.', { spellDamagePercent: 10, castSpeedPercent: 5, manaRegen: 1.5 }),
    sig('protection', 'Protection', 'Holy Shield Mastery', 'Shield of Righteousness and Avenger\'s Shield fight above their training. Requires a shield.', { 'skill:shieldOfRighteousness': 3, 'skill:avengersShield': 3, blockChance: 4, blockReduction: 6 }),
    sig('retribution', 'Retribution', 'The Art of War', 'Judgement and Divine Storm fight above their training.', { 'skill:judgement': 3, 'skill:divineStorm': 3, damagePercent: 8, critChance: 2 }),
  ]),
  s('hunter', 'Cunning', [
    f('Deadeye', { dexterity: 2 }, { dexterity: 4, critChance: 1.5 }, 'A steadier hand on the string.'),
    f('Wild Bond', { damagePercent: 2 }, { damagePercent: 6, moveSpeedPercent: 2 }, 'Hunter and beast move as one.'),
    f('Trailcraft', { moveSpeedPercent: 1 }, { moveSpeedPercent: 3, maxHp: 12 }, 'Long roads, quick feet.'),
  ], [
    sig('beast-mastery', 'Beast Mastery', 'Master of Beasts', 'Kill Command fights above its training; the hunt never slows.', { 'skill:killCommand': 4, damagePercent: 6, moveSpeedPercent: 4 }),
    sig('marksmanship', 'Marksmanship', 'Master Marksman', 'Aimed Shot and Chimera Shot fight above their training.', { 'skill:aimedShot': 3, 'skill:chimeraShot': 3, critChance: 3, critDamage: 12 }),
    sig('survival', 'Survival', 'Lock and Load', 'Explosive Shot and Black Arrow fight above their training.', { 'skill:explosiveShot': 3, 'skill:blackArrow': 3, fireDamage: 6, areaPercent: 8 }),
  ]),
  s('rogue', 'Cunning', [
    f('Blade Finesse', { dexterity: 2 }, { dexterity: 4, critDamage: 10 }, 'Precision over power.'),
    f('Shadowstep', { moveSpeedPercent: 1 }, { moveSpeedPercent: 3, critChance: 1 }, 'Unseen, unhurried.'),
    f('Lethality', { critChance: 1 }, { critChance: 2.5, critDamage: 12 }, 'Strike where it ends.'),
  ], [
    sig('assassination', 'Assassination', 'Master Poisoner', 'Mutilate and Envenom fight above their training.', { 'skill:mutilate': 3, 'skill:envenom': 3, critDamage: 15 }),
    sig('combat', 'Combat', 'Combat Potency', 'Sinister Strike and Eviscerate fight above their training.', { 'skill:sinisterStrike': 3, 'skill:eviscerate': 3, attackSpeedPercent: 7 }),
    sig('subtlety', 'Subtlety', 'Master of Subtlety', 'Ambush and Hemorrhage fight above their training.', { 'skill:ambush': 3, 'skill:hemorrhage': 3, critChance: 3, moveSpeedPercent: 4 }),
  ]),
  s('priest', 'Arcana', [
    f('Devotion', { intelligence: 2 }, { intelligence: 4, spellDamagePercent: 5 }, 'Faith sharpens the mind.'),
    f('Inner Sanctum', { maxMana: 8 }, { maxMana: 20, manaRegen: 0.6 }, 'A deeper well of spirit.'),
    f('Holy Resolve', { maxHp: 8 }, { maxHp: 20, allResistance: 3 }, 'The faithful endure.'),
  ], [
    sig('discipline', 'Discipline', 'Soul Warding', 'Penance fights above its training; shields and wards hold longer.', { 'skill:penance': 3, maxMana: 20, manaRegen: 1.5 }),
    sig('holy', 'Holy', 'Divine Providence', 'Heals and holy spells answer faster and land harder.', { spellDamagePercent: 10, castSpeedPercent: 5, manaRegen: 1.5 }),
    sig('shadow', 'Shadow', 'Shadow Weaving', 'Mind Flay and Mind Blast fight above their training.', { 'skill:mindFlay': 3, 'skill:mindBlast': 3, spellDamagePercent: 8 }),
  ]),
  s('deathKnight', 'Might', [
    f('Runic Might', { strength: 2 }, { strength: 4, damagePercent: 6 }, 'Runes carve strength into the blade.'),
    f('Unholy Resilience', { armor: 10 }, { armor: 24, maxHp: 15 }, 'Death is a poor argument.'),
    f('Chill of the Grave', { critChance: 1 }, { critChance: 2, critDamage: 10 }, 'Cold precision in every cut.'),
  ], [
    sig('blood', 'Blood', 'Blood Gorged', 'Death Strike and Blood Strike fight above their training; blood sustains the blade.', { 'skill:deathStrike': 3, 'skill:bloodStrike': 3, maxHp: 20, lifeOnHit: 1 }),
    sig('frost', 'Frost', 'Threat of Thassarian', 'Obliterate and Frost Strike fight above their training.', { 'skill:obliterate': 3, 'skill:frostStrike': 3, frostDamage: 6, critDamage: 12 }),
    sig('unholy', 'Unholy', 'Master of Ghouls', 'Scourge Strike fights above its training; plagues spread wider.', { 'skill:scourgeStrike': 3, 'skill:deathCoil': 3, areaPercent: 10, damagePercent: 6 }),
  ]),
  s('shaman', 'Arcana', [
    f('Elemental Attunement', { intelligence: 2 }, { intelligence: 4, spellDamagePercent: 6 }, 'The elements answer faster.'),
    f('Ancestral Vigor', { maxHp: 8 }, { maxHp: 20, allResistance: 3 }, 'Old blood runs strong.'),
    f('Stormcall', { castSpeedPercent: 1 }, { castSpeedPercent: 3, critChance: 1 }, 'The storm does not wait.'),
  ], [
    sig('elemental', 'Elemental', 'Elemental Mastery', 'Lava Burst and Chain Lightning fight above their training.', { 'skill:lavaBurst': 3, 'skill:chainLightning': 3, spellDamagePercent: 8, castSpeedPercent: 4 }),
    sig('enhancement', 'Enhancement', 'Stormbringer', 'Stormstrike fights above its training; weapon swings quicken.', { 'skill:stormstrike': 4, attackSpeedPercent: 7, damagePercent: 6 }),
    sig('restoration', 'Restoration', 'Tidal Waves', 'Healing waters answer faster and land harder.', { spellDamagePercent: 10, castSpeedPercent: 5, manaRegen: 1.5 }),
  ]),
  s('mage', 'Arcana', [
    f('Arcane Brilliance', { intelligence: 2 }, { intelligence: 4, spellDamagePercent: 6 }, 'A sharper mind cuts deeper.'),
    f('Mana Reserves', { maxMana: 8 }, { maxMana: 22, manaRegen: 0.6 }, 'A larger font to draw from.'),
    f('Spellweaver', { castSpeedPercent: 1 }, { castSpeedPercent: 3, spellDamagePercent: 4 }, 'Threads of magic, woven faster.'),
  ], [
    sig('arcane', 'Arcane', 'Arcane Power', 'Arcane Blast and Arcane Missiles fight above their training; spells cost 15% more mana.', { 'skill:arcaneBlast': 3, 'skill:arcaneMissiles': 3, spellDamagePercent: 10, manaCostPercent: -15 }),
    sig('fire', 'Fire', 'Hot Streak', 'Pyroblast and Fire Blast fight above their training.', { 'skill:pyroblast': 3, 'skill:fireBlast': 3, fireDamage: 6, critDamage: 15 }),
    sig('frost', 'Frost', 'Fingers of Frost', 'Frostbolt and Ice Lance fight above their training.', { 'skill:frostbolt': 3, 'skill:iceLance': 3, frostDamage: 6, critChance: 3 }),
  ]),
  s('warlock', 'Arcana', [
    f('Fel Corruption', { intelligence: 2 }, { intelligence: 4, spellDamagePercent: 6 }, 'Power taken, not given.'),
    f('Soul Harvest', { manaRegen: 0.5 }, { manaRegen: 1.5, maxMana: 14 }, 'Every soul has its use.'),
    f('Demonic Resilience', { maxHp: 8 }, { maxHp: 20, allResistance: 3 }, 'What does not kill you is fuel.'),
  ], [
    sig('affliction', 'Affliction', 'Everlasting Affliction', 'Corruption and Unstable Affliction fight above their training.', { 'skill:corruption': 3, 'skill:unstableAffliction': 3, spellDamagePercent: 8 }),
    sig('demonology', 'Demonology', 'Demonic Pact', 'Shadow Bolt fights above its training; demonic resilience deepens.', { 'skill:shadowBolt': 3, maxHp: 20, armor: 20 }),
    sig('destruction', 'Destruction', 'Backdraft', 'Chaos Bolt and Conflagrate fight above their training.', { 'skill:chaosBolt': 3, 'skill:conflagrate': 3, critDamage: 15, castSpeedPercent: 4 }),
  ]),
  s('druid', 'Cunning', [
    f('Natural Vigor', { vitality: 2 }, { vitality: 4, maxHp: 15 }, 'The wild does not tire.'),
    f('Moonkin Insight', { intelligence: 2 }, { intelligence: 4, spellDamagePercent: 5 }, 'The moon teaches patience.'),
    f('Feral Instinct', { dexterity: 2 }, { dexterity: 4, critChance: 1.5 }, 'Claw and fang remember.'),
  ], [
    sig('balance', 'Balance', 'Eclipse', 'Wrath and Starfire fight above their training.', { 'skill:wrath': 3, 'skill:starfire': 3, spellDamagePercent: 8, critChance: 2 }),
    sig('feral', 'Feral', 'Leader of the Pack', 'Shred and Ferocious Bite fight above their training.', { 'skill:shred': 3, 'skill:ferociousBite': 3, attackSpeedPercent: 5, critDamage: 12 }),
    sig('restoration', 'Restoration', 'Gift of the Earthmother', 'Heals and nature spells answer faster and land harder.', { spellDamagePercent: 10, castSpeedPercent: 5, manaRegen: 1.5 }),
  ]),
];
freezeContent(CLASS_SANCTUMS);
