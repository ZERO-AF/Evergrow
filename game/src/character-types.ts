import type { Element, ResistanceStat } from './resistance-content.ts';
import type { ItemMaterialId } from './item-materials.ts';
import type { GearMaterial } from './gear-material-content.ts';
import type { ArenaPointsWallet, EmblemWallet, GoldWallet, HonorWallet } from './wallet.ts';
import type { HolidayWallet } from './holiday-state.ts';
import type { WeaponDefinition, FocusDefinition, ShieldDefinition } from './model.ts';
import type { WowClassId, WowRaceId } from './wow-types.ts';
import type { PetStable } from './pet-content.ts';
import type { GuildMembership } from './guild-state.ts';
import type { DungeonFinderState } from './dungeon-finder-state.ts';
import type { AuctionHouseState } from './auction-state.ts';
import type { EnchantId } from './enchant-content.ts';

export type Attribute = 'strength' | 'dexterity' | 'intelligence' | 'vitality';
export type StatKey = Attribute | ResistanceStat | 'goldFindPercent' | 'xpGainPercent' | 'maxHp' | 'maxHpPercent' | 'maxMana' | 'armor' | 'armorPercent' | 'damagePercent' | 'attackSpeedPercent' | 'castSpeedPercent'
  | 'critChance' | 'critDamage' | 'moveSpeedPercent' | 'spellDamagePercent' | 'manaRegen'
  | `skill:${SkillId}` | 'manaOnKill' | 'areaPercent' | 'potionPercent' | 'projectilePierce' | 'spellweavePercent' | 'afterguardPercent'
  | 'lifeRegen' | 'manaCostPercent' | 'cooldownPercent' | 'lifeOnHit' | 'blockChance' | 'blockReduction' | 'fireDamage' | 'frostDamage' | 'lightningDamage'
  | 'hitRating' | 'expertise';
export type StatModifiers = Partial<Record<StatKey, number>>;
export type EquipmentSlot = 'weapon' | 'offhand' | 'head' | 'chest' | 'gloves' | 'legs' | 'boots' | 'cloak' | 'amulet' | 'ring1' | 'ring2';
export type ItemKind = Exclude<EquipmentSlot, 'offhand' | 'ring1' | 'ring2'> | 'ring' | 'shield' | 'grimoire' | 'orb' | 'relic' | 'charm' | 'riftKey' | 'consumable';
export type ItemTier = 'common' | 'magic' | 'rare' | 'epic' | 'legendary' | 'unique';
export interface ItemAffix { name: string; stat: StatKey; value: number; }
export type SocketColor = 'red' | 'blue' | 'yellow';
export interface ItemSocket {
  color: SocketColor;
  /** Socketed gem definition id (gem-content.ts); absent = empty socket. */
  gem?: string;
  /** The socketed gem's own item level; stats scale from it, not the host's. */
  gemLevel?: number;
}
export interface ItemRecipe {
  riftKeyTier?: number;
  uniqueId?: string;
  /** Legendary proc (legendary-content.ts LEGENDARY_PROCS). */
  procId?: string;
  charmVersion?: 1;
  manaVersion?: 1;
  offenseVersion?: 1;
  rollVersion?: 1;
  materialId?: ItemMaterialId;
  profileId?: string; starter: boolean; enhancement: number; revision: number;
  targetedRolls: number; fullRolls: number; rolls: number[];
}
export interface CommerceState {
  epoch: number; revision: number; operations: number; sold: Record<string, number>;
  /** Paid stock generations, scoped to the current level epoch and vendor. */
  refreshes?: Record<string, number>;
  buyback: Array<{ item: Item; price: number }>;
}
export interface Item {
  locked?: boolean;
  recipe: ItemRecipe;
  id: string; seed: number; name: string; baseName: string; kind: ItemKind; tier: ItemTier;
  itemLevel: number; requiredLevel: number; power: number;
  implicit: StatModifiers; affixes: ItemAffix[]; weapon?: WeaponDefinition; shield?: ShieldDefinition; focus?: FocusDefinition;
  /** Iconic class association on named legendaries (Thunderfury, Atiesh…). */
  classId?: WowClassId;
  /** Lore line shown under the item's stats, used by named legendaries. */
  flavor?: string;
  /** Stack count for consumables (consumable-content.ts); absent = a single unit. */
  stack?: number;
  /** Rolled sockets (gem-content.ts); absent = none. Socketed gems fold into implicit via deriveItem. */
  sockets?: ItemSocket[];
  /** Permanent enchant id (enchant-content.ts); stats fold into implicit via deriveItem. */
  enchant?: EnchantId;
  appearance: { surface?: GearMaterial; base: string; shadow: string; edge: string; trim: string; style: 'plate' | 'leather' | 'cloth' };
  /** Championing tabard: while equipped, kill/dungeon reputation redirects to this faction (reputation-content.ts). */
  tabardFaction?: import('./reputation-content.ts').FactionId;
}
export type WowSkillId =
  // Warrior
  | 'heroicStrike' | 'charge' | 'thunderClap' | 'hamstring' | 'overpower' | 'execute' | 'pummel'
  | 'sunderArmor' | 'battleShout' | 'berserkerRage' | 'shieldSlam' | 'shieldBlock' | 'revenge'
  | 'shieldWall' | 'mortalStrike' | 'bloodthirst' | 'bladestorm' | 'heroicLeap' | 'intimidatingShout' | 'sweepingStrikes'
  | 'slam' | 'rend' | 'victoryRush' | 'intercept' | 'intervene' | 'spellReflection' | 'disarm'
  | 'demoralizingShout' | 'piercingHowl' | 'concussionBlow' | 'shockwave' | 'lastStand' | 'enragedRegeneration'
  | 'commandingShout' | 'taunt' | 'challengingShout' | 'heroicThrow' | 'shatteringThrow' | 'retaliation'
  | 'battleStance' | 'defensiveStance' | 'berserkerStance'
  // Paladin
  | 'crusaderStrike' | 'judgement' | 'sealOfCommand' | 'consecration' | 'hammerOfJustice' | 'holyLight'
  | 'flashOfLight' | 'divineShield' | 'divineProtection' | 'layOnHands' | 'avengingWrath' | 'hammerOfWrath'
  | 'exorcism' | 'holyShock' | 'repentance' | 'blessingOfKings' | 'divineStorm' | 'holyShield'
  | 'blessingOfMight' | 'blessingOfWisdom' | 'blessingOfSanctuary' | 'handOfFreedom' | 'handOfProtection'
  | 'handOfSacrifice' | 'handOfSalvation' | 'divineSacrifice' | 'divinePlea' | 'shieldOfRighteousness'
  | 'hammerOfTheRighteous' | 'avengersShield' | 'judgementOfLight' | 'judgementOfWisdom' | 'judgementOfJustice'
  | 'sealOfVengeance' | 'sealOfRighteousness' | 'sealOfCorruption' | 'sealOfWisdom' | 'sealOfLight' | 'righteousFury'
  | 'divineIllumination' | 'beaconOfLight' | 'holyWrath' | 'turnEvil' | 'purify' | 'cleanse' | 'redemption' | 'sacredShield'
  | 'devotionAura' | 'retributionAura' | 'concentrationAura' | 'resistanceAura' | 'crusaderAura'
  // Hunter
  | 'arcaneShot' | 'aimedShot' | 'multiShot' | 'serpentSting' | 'concussiveShot' | 'scatterShot'
  | 'freezingTrap' | 'disengage' | 'aspectHawk' | 'feignDeath' | 'callPet' | 'killCommand'
  | 'bestialWrath' | 'huntersVolley' | 'explosiveShot' | 'steadyShot' | 'killShot' | 'chimeraShot'
  | 'raptorStrike' | 'mongooseBite' | 'wingClip' | 'frostTrap' | 'immolationTrap' | 'explosiveTrap'
  | 'deterrence' | 'misdirection' | 'tranquilizingShot' | 'viperSting' | 'scorpidSting' | 'mendPet'
  | 'revivePet' | 'intimidation' | 'wyvernSting' | 'blackArrow' | 'silencingShot' | 'readiness'
  | 'tameBeast'
  | 'aspectViper' | 'aspectCheetah' | 'aspectPack' | 'aspectDragonhawk' | 'aspectBeast'
  // Rogue
  | 'sinisterStrike' | 'eviscerate' | 'ambush' | 'garrote' | 'rupture' | 'kidneyShot' | 'sliceAndDice'
  | 'stealth' | 'vanish' | 'sap' | 'gouge' | 'kick' | 'sprint' | 'evasion' | 'blind' | 'fanOfKnives'
  | 'adrenalineRush' | 'cheapShot' | 'hemorrhage' | 'cloakOfShadows'
  | 'mutilate' | 'envenom' | 'deadlyThrow' | 'shiv' | 'feint' | 'distract' | 'dismantle'
  | 'tricksOfTheTrade' | 'preparation' | 'shadowstep' | 'shadowDance' | 'killingSpree' | 'hungerForBlood'
  | 'exposeArmor' | 'cripplingPoison' | 'deadlyPoison' | 'woundPoison' | 'instantPoison' | 'mindNumbingPoison' | 'detectTraps' | 'rogueBackstab'
  // Priest
  | 'smite' | 'shadowWordPain' | 'mindBlast' | 'mindFlay' | 'powerWordShield' | 'renew' | 'flashHeal'
  | 'greaterHeal' | 'psychicScream' | 'dispelMagic' | 'shadowform' | 'holyNova' | 'prayerOfHealing'
  | 'innerFire' | 'shadowWordDeath' | 'silence' | 'vampiricEmbrace'
  | 'bindingHeal' | 'circleOfHealing' | 'prayerOfMending' | 'penance' | 'guardianSpirit' | 'painSuppression'
  | 'powerInfusion' | 'divineHymn' | 'hymnOfHope' | 'manaBurn' | 'mindControl' | 'mindSear'
  | 'devouringPlague' | 'vampiricTouch' | 'shadowfiend' | 'dispersion' | 'fade' | 'shackleUndead' | 'levitate' | 'massDispel' | 'fearWard'
  // Death Knight
  | 'icyTouch' | 'plagueStrike' | 'bloodStrike' | 'deathStrike' | 'obliterate' | 'scourgeStrike'
  | 'deathCoil' | 'deathGrip' | 'chainsOfIce' | 'mindFreeze' | 'bloodBoil' | 'deathAndDecay'
  | 'frostPresence' | 'bloodPresence' | 'unholyPresence' | 'iceboundFortitude' | 'antiMagicShell'
  | 'raiseDead' | 'armyOfDead' | 'strangulate'
  | 'pestilence' | 'howlingBlast' | 'frostStrike' | 'runeStrike' | 'deathchill' | 'lichborne'
  | 'unbreakableArmor' | 'vampiricBlood' | 'runeTap' | 'markOfBlood' | 'hysteria' | 'dancingRuneWeapon'
  | 'summonGargoyle' | 'corpseExplosion' | 'antiMagicZone' | 'boneShield' | 'darkCommand' | 'deathPact' | 'hornOfWinter' | 'pathOfFrost' | 'empowerRuneWeapon'
  // Shaman
  | 'lightningBolt' | 'chainLightning' | 'earthShock' | 'flameShock' | 'frostShock' | 'lavaBurst'
  | 'stormstrike' | 'windShear' | 'healingWave' | 'lesserHealingWave' | 'chainHeal' | 'searingTotem'
  | 'healingStreamTotem' | 'earthbindTotem' | 'ghostWolf' | 'bloodlust' | 'feralSpirit' | 'thunderstorm' | 'lightningShield'
  | 'windfuryWeapon' | 'flametongueWeapon' | 'frostbrandWeapon' | 'rockbiterWeapon' | 'earthlivingWeapon'
  | 'fireNova' | 'magmaTotem' | 'manaSpringTotem' | 'totemOfWrath' | 'wrathOfAirTotem' | 'windfuryTotem'
  | 'strengthOfEarthTotem' | 'stoneskinTotem' | 'flametongueTotem' | 'tremorTotem' | 'cleansingTotem' | 'groundingTotem'
  | 'earthElementalTotem' | 'fireElementalTotem' | 'purge' | 'hex' | 'riptide' | 'earthShield' | 'waterShield' | 'ancestralSpirit' | 'reincarnation' | 'astralRecall' | 'shamanisticRage'
  // Mage
  | 'frostbolt' | 'pyroblast' | 'fireBlast' | 'scorch' | 'arcaneMissiles' | 'arcaneExplosion' | 'frostNova'
  | 'iceLance' | 'coneOfCold' | 'blizzard' | 'blink' | 'polymorph' | 'counterspell' | 'iceBlock'
  | 'iceBarrier' | 'evocation' | 'mirrorImage' | 'combustion' | 'dragonsBreath' | 'deepFreeze'
  | 'flamestrike' | 'blastWave' | 'livingBomb' | 'arcaneBlast' | 'arcaneBarrage' | 'frostfireBolt'
  | 'coldSnap' | 'icyVeins' | 'summonWaterElemental' | 'manaShield' | 'mageArmor' | 'moltenArmor'
  | 'removeCurse' | 'spellSteal' | 'slowFall' | 'conjureRefreshment' | 'focusMagic' | 'presenceOfMind' | 'arcanePower'
  // Warlock
  | 'shadowBolt' | 'immolate' | 'corruption' | 'curseOfAgony' | 'unstableAffliction' | 'drainLife'
  | 'drainSoul' | 'searingPain' | 'shadowburn' | 'chaosBolt' | 'conflagrate' | 'fear' | 'howlOfTerror'
  | 'warlockDeathCoil' | 'lifeTap' | 'felArmor' | 'summonImp' | 'summonFelguard' | 'metamorphosis'
  | 'seedOfCorruption' | 'rainOfFire' | 'shadowfury'
  | 'curseOfElements' | 'curseOfWeakness' | 'curseOfTongues' | 'curseOfDoom' | 'demonArmor' | 'demonicCircle'
  | 'demonicEmpowerment' | 'felDomination' | 'soulLink' | 'darkPact' | 'soulshatter' | 'ritualOfSouls'
  | 'ritualOfSummoning' | 'summonVoidwalker' | 'summonSuccubus' | 'summonFelhunter' | 'summonDoomguard' | 'inferno' | 'banish' | 'enslaveDemon' | 'healthstone' | 'soulstone' | 'createSpellstone' | 'createFirestone'
  // Druid
  | 'wrath' | 'starfire' | 'moonfire' | 'insectSwarm' | 'entanglingRoots' | 'hurricane' | 'starfall'
  | 'healingTouch' | 'regrowth' | 'rejuvenation' | 'swiftmend' | 'barkskin' | 'bearForm' | 'catForm'
  | 'moonkinForm' | 'travelForm' | 'maul' | 'swipe' | 'bash' | 'feralCharge' | 'mangle' | 'claw'
  | 'rake' | 'rip' | 'ferociousBite' | 'prowl' | 'pounce' | 'faerieFire' | 'innervate'
  | 'nourish' | 'wildGrowth' | 'lifebloom' | 'tranquility' | 'rebirth' | 'revive' | 'abolishPoison' | 'removeCurseDruid'
  | 'naturesGrasp' | 'cyclone' | 'typhoon' | 'forceOfNature' | 'savageRoar' | 'shred' | 'ravage' | 'tigersFury'
  | 'berserk' | 'survivalInstincts' | 'frenziedRegeneration' | 'growl' | 'challengingRoar' | 'demoralizingRoar' | 'lacerate' | 'enrage' | 'dash' | 'aquaticForm' | 'flightForm' | 'treeOfLife'
  // Racial actives
  | 'everyMan' | 'stoneform' | 'shadowmeld' | 'escapeArtist' | 'giftNaaru' | 'bloodFury'
  | 'willForsaken' | 'warStomp' | 'berserking' | 'arcaneTorrent';
export type SkillId = import('./aura-content.ts').AuraId | WowSkillId | 'repulse' | 'ironCitadel' | 'smokeVeil' | 'nightReaping' | 'sidestep' | 'brace' | 'runicWard' | 'vaultingShot' | 'rallyOfIron' | 'ghostHunt' | 'cleave' | 'lunge' | 'whirlwind' | 'earthshatter' | 'shieldBash' | 'bulwark'
  | 'volley' | 'piercingShot' | 'ricochet' | 'rainOfArrows' | 'backstab'
  | 'cataclysm' | 'tempest' | 'absoluteZero' | 'fireball' | 'arcLightning' | 'iceNova' | 'frostLance' | 'meteor' | 'siphon';
export interface CharacterSheet extends GoldWallet, HonorWallet, ArenaPointsWallet, EmblemWallet, HolidayWallet {
  /** Personal arena rating; updated by arena match results (pvp-rewards.ts). */
  arenaRating?: number;
  /** WotLK class identity; gates class skill kits and starter gear. */
  classId: WowClassId;
  /** WotLK race identity; grants the racial active and passive modifiers. */
  raceId: WowRaceId;
  treeVersion?: number;
  treeRefunded?: true;
  look: import('./character-look.ts').CharacterLook;
  blessing?: import('./poi-content.ts').Blessing;
  commerce: CommerceState;
  attributes: Record<Attribute, number>;
  statPoints: number; skillPoints: number;
  /** One complimentary attribute refund for the offensive balance revision. */
  attributeResetUsed?: true;
  allocatedNodes: string[];
  inventory: Array<Item | null>;
  /** Item IDs map to top-left cells in the carried pack. Unplaced older items remain in overflow. */
  inventoryLayout?: Record<string, number>;
  /** Up to four equipped bags (bag-content.ts); each adds its slot count to the pack grid. */
  bags?: Array<Item | null>;
  /** Personal storage shared by settlement chests: one to five consecutive 96-item tabs. */
  stash?: Array<Item | null>;
  /** Guild membership ledger (guild-state.ts); absent until the guild is founded. */
  guild?: GuildMembership;
  /** Shared guild vault: one 96-item tab unlocked by the Mobile Banking perk. */
  guildVault?: Array<Item | null>;
  /** Newest acquired first; absent until the first tracked pickup. */
  recentItems?: string[];
  equipped: Record<EquipmentSlot, Item | null>;
  skillSlots: Array<SkillId | null>;
  skillRanks: Partial<Record<SkillId, number>>;
  activeSkillRanks: Partial<Record<SkillId, number>>;
  skillSpecializations: Partial<Record<SkillId, string>>;
  arcaneOverload: boolean;
  /** Transmogrification: slot → owned item id whose appearance replaces the equipped item's (transmog-state.ts). */
  transmog?: Partial<Record<EquipmentSlot, string>>;
  /** Dual talent specialization: stored builds plus the active index (dual-spec-state.ts). */
  specs?: import('./dual-spec-state.ts').TalentSpec[];
  activeSpec?: number;
  /** Hunter pet stable: the active companion plus stabled pets (pet-content.ts). */
  pets?: PetStable;
  /** Earned player title id (title-content.ts); shown on the nameplate/character sheet. */
  title?: string;
  /** Gold-trained skills/ranks from a class trainer (trainer-state.ts); exempt from point conservation. */
  trained?: import('./trainer-state.ts').TrainedSkills;
  /** Preferred mount for the X summon toggle; set at the stable master (mount-state.ts). */
  mount?: import('./mount-content.ts').MountId;
  /** Dungeon Finder queue marker: the queued catalog id and when (dungeon-finder-state.ts). */
  dungeonFinder?: DungeonFinderState;
  /** Weekly raid lockouts: raid entrance id → epoch-second of the reset that frees it (raid-lockout.ts). */
  raidLockouts?: Record<string, number>;
  /** Auction House ledger: posted listings, sale receipts, pending proceeds (auction-state.ts). */
  auctionHouse?: AuctionHouseState;
}
export interface DerivedCharacterStats {
  directDamageMultiplier?: number;
  resistances: Record<Element, number>; goldFindMultiplier: number; xpGainMultiplier: number;
  attackSpeedMultiplier: number; castSpeedMultiplier: number; attackDamageMultiplier: number;
  maxHp: number; maxMana: number; armor: number; damageReduction: number;
  critChance: number; critMultiplier: number; moveSpeedMultiplier: number;
  spellDamageMultiplier: number; manaRegeneration: number; lifeRegeneration: number;
  manaCostMultiplier: number; cooldownMultiplier: number; lifeOnHit: number;
  blockChance: number; blockReduction: number; hitRating: number; expertise: number;
  manaOnKill: number; areaMultiplier: number; potionMultiplier: number; projectilePierce: number;
  spellweavePercent: number; afterguardPercent: number; skillBonuses: Partial<Record<SkillId, number>>;
  attributes: Record<Attribute, number>;
}
export interface ActionResult { ok: boolean; message?: string; }
export interface GroundItem { flight?: import('./treasure-flight.ts').TreasureFlight; id: number; x: number; y: number; item: Item; }
