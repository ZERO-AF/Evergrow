import { upgradeSkillTree } from './skill-tree-upgrade.ts';
import { doctrineConflict, SKILL_TREE_VERSION } from './skill-tree.ts';
import { STASH_CAPACITY, MAX_STORAGE_TABS } from './storage-content.ts';
import { validPackLayout } from './inventory-grid.ts';
import { validBagSlots } from './bag-state.ts';
import { bagGridLayout } from './bag-content.ts';
import { validEncounterScales } from './encounter-scaling.ts';
import { validChronicle, type ChronicleProgress } from './chronicle.ts';
import { validTreasureFlight } from './treasure-flight.ts';
import { createRaceLook, validCharacterLook } from './character-look.ts';
import { ROAMING_RULES } from './roaming-encounters.ts';
import { validJourneys, type JourneyState } from './journey-state.ts';
import type { Expeditions, StoredActor } from './dungeon-state.ts';
import type { Pickup } from './model.ts';
import { validExpeditions, validActors, validCampWounds, validPickups } from './dungeon-validation.ts';
import { validEvents, validBlessing } from './poi-validation.ts';
import type { EventState } from './poi-content.ts';
import { validSkillProgression } from './skill-progression.ts';
import { validTravel, type TravelState } from './travel.ts';
import { GOLD_RULES, type GroundGold } from './gold.ts';
import { validArenaPoints, validEmblems, validGold, validHonor } from './wallet.ts';
import type { CharacterSheet, GroundItem, Item, SkillId } from './character-types.ts';
import { BAR_TOTAL, ensureBarSlots } from './action-bar.ts';
import { isWowClassId, isWowRaceId, WOW_COMBAT, type WowClassId, type WowRaceId } from './wow-types.ts';
import { ALLY_TEMPLATES } from './wow-allies.ts';
import { WOW_RACES } from './wow-races.ts';
import { isMountId } from './mount-content.ts';
import { isProfessionId } from './profession-content.ts';
import { isGlyphId, GLYPH_SLOTS } from './glyph-content.ts';
import { INVENTORY_CAPACITY, EQUIPMENT_SLOTS, roundItemStats, refreshEquipmentBudgets, rebalanceCharm, rebalanceItemMana, rebalanceItemOffense, rebalanceItemRolls } from './items.ts';
import { object, number, integer, text, validItem, type ObjectValue } from './item-validation.ts';
import { validCommerce } from './commerce-validation.ts';
import { itemFitsSlot } from './inventory.ts';
import { SKILL_NODES, unlockedSkills, freeNodeCount } from './skill-tree.ts';
import { MAX_CONTENT_LEVEL } from './progression-content.ts';
import { xpForNextLevel } from './progression.ts';
import { ENEMY_DEFINITIONS, LOOT_RULES } from './combat-content.ts';
import { validTransmogMap } from './transmog-state.ts';
import { validSpecs } from './dual-spec-state.ts';
import { freshWorldEvents, validWorldEvents, type WorldEventState } from './world-event-state.ts';
import { validAuctionHouse } from './auction-state.ts';
import { PET_FAMILIES, PET_RULES, petXpForLevel } from './pet-content.ts';
import { GUILD_RULES, GUILD_VAULT_CAPACITY } from './guild-content.ts';
import type { GuildMembership } from './guild-state.ts';
import { validDungeonFinder } from './dungeon-finder-state.ts';
import { validRaidLockouts } from './raid-lockout.ts';

export const CHARACTER_SLOT_COUNT = 8;
export const CHARACTER_SAVE_VERSION = 7;
export const SAVE_MAX_CODE_UNITS = 8 * 1024 * 1024;
export interface CharacterCheckpoint {
  chronicle?: ChronicleProgress;
  brokenContainers?: string[];
  journeys?: JourneyState;
  roaming?: {warmup:number;cooldown:number;requiredDistance:number};
  encounterScales?: import('./encounter-scaling.ts').EncounterScales;
  campWounds?: StoredActor[];
  expeditions?: Expeditions; actors?: StoredActor[]; pickups?: Pickup[];
  events?: EventState;
  /** Absent until travel has been initialized; no portal and Briarwatch home by default. */
  travel?: TravelState;
  character: CharacterSheet; level: number; xp: number; x: number; y: number; angle: number;
  hp: number; mana: number; dead: boolean; flasks: number; healCooldown: number;
  dodgeCharges: number; dodgeRecharge: number; skillCooldowns: Partial<Record<SkillId, number>>;
  time: number; kills: number; randomState: number; spawnOrdinal: number; killRecharge: number;
  clearedCamps: string[]; defeatedCampMembers: Record<string, string[]>; groundItems: GroundItem[]; groundGold?: GroundGold[];
  /** Scourge Invasion schedule + war-chest ledger (world-event-state.ts). */
  worldEvents?: WorldEventState;
}
export interface CharacterSave {
  version: typeof CHARACTER_SAVE_VERSION; id: string; name: string;
  createdAt: number; updatedAt: number; worldSeed: number; worldVersion: number;
  checkpoint: CharacterCheckpoint;
}

/** v4→v5 class inference from the equipped weapon (assignment: staff→mage, wand→priest, bow→hunter, dagger→rogue, shield→paladin, 2H sword→warrior, else warrior). */
function inferWowClassId(character: ObjectValue): WowClassId {
  const equipped = character.equipped;
  if (!object(equipped)) return 'warrior';
  const weapon = object(equipped.weapon) && object(equipped.weapon.weapon) ? equipped.weapon.weapon : undefined;
  if (weapon?.family === 'staff') return 'mage';
  if (weapon?.family === 'wand') return 'priest';
  if (weapon?.family === 'bow') return 'hunter';
  if (weapon?.family === 'dagger') return 'rogue';
  if (object(equipped.offhand) && equipped.offhand.kind === 'shield') return 'paladin';
  if (weapon?.family === 'sword' && weapon?.hands === 2) return 'warrior';
  return 'warrior';
}

/** Guild membership + shared vault (guild-state.ts); the vault requires a guild. */
function validGuild(v: unknown): v is GuildMembership {
  return object(v) && text(v.name, GUILD_RULES.nameMax) && v.name.trim().length >= GUILD_RULES.nameMin
    && integer(v.level, 1, GUILD_RULES.maxLevel) && integer(v.xp, 0, 1e9) && number(v.memberSince, 0, 1e12);
}
function validSheet(v: unknown, level: number): v is CharacterSheet {
  if (object(v) && v.recentItems !== undefined && (!Array.isArray(v.recentItems)
    || v.recentItems.length > INVENTORY_CAPACITY + EQUIPMENT_SLOTS.length
    || !v.recentItems.every(id => text(id, 160)) || new Set(v.recentItems).size !== v.recentItems.length)) return false;
  if (object(v) && v.stash !== undefined && (!Array.isArray(v.stash) || v.stash.length < STASH_CAPACITY || v.stash.length > STASH_CAPACITY * MAX_STORAGE_TABS || v.stash.length % STASH_CAPACITY !== 0 || !v.stash.every(i=>i===null||validItem(i)))) return false;
  if (object(v) && v.guild !== undefined && !validGuild(v.guild)) return false;
  if (object(v) && v.guildVault !== undefined && (!object(v.guild) || !Array.isArray(v.guildVault) || v.guildVault.length !== GUILD_VAULT_CAPACITY || !v.guildVault.every(i => i === null || validItem(i)))) return false;
  if (!object(v) || !isWowClassId(v.classId) || !isWowRaceId(v.raceId) || !validCharacterLook(v.look) || !validBlessing(v.blessing) || !validCommerce(v.commerce, level) || (v.gold !== undefined && !validGold(v.gold)) || (v.honor !== undefined && !validHonor(v.honor)) || (v.arenaPoints !== undefined && !validArenaPoints(v.arenaPoints)) || (v.emblems !== undefined && !validEmblems(v.emblems)) || !object(v.attributes) || !['strength', 'dexterity', 'intelligence', 'vitality'].every(k => integer((v.attributes as ObjectValue)[k], 10, 5e6 + 10))
    || v.attributeResetUsed !== undefined && v.attributeResetUsed !== true
    || !integer(v.statPoints, 0, 5e6) || !integer(v.skillPoints, 0, MAX_CONTENT_LEVEL)
    || !Array.isArray(v.inventory) || !(v.inventory.length === 64 || v.inventory.length === 72 || v.inventory.length === bagGridLayout(v as unknown as { bags?: Array<Item | null> }).totalCells) || !v.inventory.every(i => i === null || validItem(i))
    || (v.bags !== undefined && !validBagSlots(v.bags))
    || !object(v.equipped) || Object.keys(v.equipped).length !== EQUIPMENT_SLOTS.length
    || !EQUIPMENT_SLOTS.every(slot => { const item = (v.equipped as ObjectValue)[slot]; return item === null || validItem(item) && itemFitsSlot(item, slot) && item.requiredLevel <= level; })
    || !Array.isArray(v.allocatedNodes) || v.allocatedNodes.length > SKILL_NODES.size || !v.allocatedNodes.includes('origin')
    || !v.allocatedNodes.every(id => typeof id === 'string' && SKILL_NODES.has(id)) || new Set(v.allocatedNodes).size !== v.allocatedNodes.length) return false;
  if (v.transmog !== undefined && !validTransmogMap(v.transmog)) return false;
  if (v.pets !== undefined && !validPetStable(v.pets)) return false;
  if (v.mount !== undefined && !isMountId(v.mount)) return false;
  if (v.dungeonFinder !== undefined && !validDungeonFinder(v.dungeonFinder)) return false;
  if (v.raidLockouts !== undefined && !validRaidLockouts(v.raidLockouts)) return false;
  if (v.auctionHouse !== undefined && !validAuctionHouse(v.auctionHouse)) return false;
  const sheet = v as unknown as CharacterSheet;
  if (sheet.treeVersion!==SKILL_TREE_VERSION || sheet.treeRefunded!==undefined&&sheet.treeRefunded!==true || sheet.allocatedNodes.some(id=>{const node=SKILL_NODES.get(id)!;return doctrineConflict(sheet.allocatedNodes,node)||node.classId!==undefined&&node.classId!==sheet.classId;}) || !validSkillProgression(sheet) || sheet.inventory.length > bagGridLayout(sheet).totalCells || !validPackLayout(sheet.inventory, sheet.inventoryLayout, bagGridLayout(sheet)) || !validSpecs(sheet.specs, sheet.activeSpec, sheet.classId, sheet.raceId, level)) return false;
  const ids = [...(sheet.stash??[]), ...(sheet.guildVault??[]), ...sheet.inventory, ...Object.values(sheet.equipped), ...(sheet.bags??[])].filter((i): i is Item => i !== null).map(i => i.id);
  if (new Set(ids).size !== ids.length || sheet.equipped.weapon?.weapon?.hands === 2 && sheet.equipped.offhand !== null) return false;
  const allocated = new Set(sheet.allocatedNodes), connected = new Set(['origin']), queue = ['origin'];
  for (let i = 0; i < queue.length; i++) for (const next of SKILL_NODES.get(queue[i])!.neighbors) {
    if (allocated.has(next) && !connected.has(next)) { connected.add(next); queue.push(next); }
  }
  if (connected.size !== allocated.size || sheet.skillPoints + allocated.size - freeNodeCount(sheet.allocatedNodes) + Object.values(sheet.skillRanks).reduce((sum, rank) => sum + rank - 1, 0) !== level - 1
    || sheet.statPoints + Object.values(sheet.attributes).reduce((sum, n) => sum + n - 10, 0) !== (level - 1) * 5) return false;
  const unlocked = unlockedSkills(sheet.allocatedNodes);
  return Array.isArray(v.skillSlots) && v.skillSlots.length === BAR_TOTAL && v.skillSlots.every(id => id === null || unlocked.includes(id))
    && new Set(v.skillSlots.filter(Boolean)).size === v.skillSlots.filter(Boolean).length;
}
/** A PetRecord: the tamed beast's source kind, family, level curve position and learned skills. */
function validPetRecord(v: unknown): boolean {
  if (!object(v) || !integer(v.id, 1) || typeof v.sourceKind !== 'string' || !Object.hasOwn(ENEMY_DEFINITIONS, v.sourceKind)
    || typeof v.family !== 'string' || !Object.hasOwn(PET_FAMILIES, v.family)) return false;
  // The hasOwn checks above prove both keys; the family must match the kind's tameable flag,
  // and the ally template must be the family's own — a crafted allyKind crashes summonAlly.
  if (ENEMY_DEFINITIONS[v.sourceKind as keyof typeof ENEMY_DEFINITIONS].beast !== v.family
    || v.allyKind !== PET_FAMILIES[v.family as keyof typeof PET_FAMILIES].allyKind) return false;
  return text(v.name, 24) && integer(v.level, 1, MAX_CONTENT_LEVEL) && integer(v.xp, 0, petXpForLevel(MAX_CONTENT_LEVEL))
    && Array.isArray(v.skills) && v.skills.length <= 8 && v.skills.every(id => text(id, 60))
    && new Set(v.skills).size === v.skills.length && integer(v.loyalty, 0, PET_RULES.maxLoyalty);
}

/** The hunter's stable: one active pet plus bounded stable slots; ids are unique across both. */
function validPetStable(v: unknown): boolean {
  if (!object(v) || !(v.active === null || validPetRecord(v.active))
    || !Array.isArray(v.stabled) || v.stabled.length > PET_RULES.stableSlots || !v.stabled.every(validPetRecord)) return false;
  const ids = [v.active, ...v.stabled].map(pet => object(pet) ? pet.id : undefined);

  return new Set(ids).size === ids.length;
}


const DOT_SCHOOLS: ReadonlySet<string> = new Set(['physical', 'fire', 'frost', 'lightning', 'arcane', 'holy', 'shadow', 'nature', 'bleed', 'poison']);

const CC_KINDS: ReadonlySet<string> = new Set(['root', 'fear', 'incapacitate', 'polymorph', 'silence', 'stun', 'freeze', 'slow']);
const SHAPESHIFT_FORMS: ReadonlySet<string> = new Set(['bear', 'cat', 'moonkin', 'travel', 'shadow', 'metamorph', 'ghostWolf']);

/** Live WoW combat state persisted on the checkpoint: allies, buffs, resources, actor dots/cc. */
function validWowState(p: ObjectValue): boolean {
  if (p.allies !== undefined && (!Array.isArray(p.allies) || p.allies.length > WOW_COMBAT.maxAllies
    || !p.allies.every(a => object(a) && integer(a.id, 1) && typeof a.kind === 'string' && Object.hasOwn(ALLY_TEMPLATES, a.kind)
      && (a.petId === undefined || integer(a.petId, 1))
      && (a.regen === undefined || object(a.regen) && number(a.regen.remaining, 0, 1e6) && number(a.regen.perSecond, 0, 10))
      && (a.guard === undefined || object(a.guard) && number(a.guard.remaining, 0, 1e6) && number(a.guard.reduction, 0, 1))
      && (a.speedBoost === undefined || object(a.speedBoost) && number(a.speedBoost.remaining, 0, 1e6) && number(a.speedBoost.factor, 0, 10))
      && (a.stealth === undefined || object(a.stealth) && number(a.stealth.remaining, 0, 1e6))
      && number(a.x, -4e7, 4e7) && number(a.y, -4e7, 4e7) && number(a.prevX, -4e7, 4e7) && number(a.prevY, -4e7, 4e7)
      && number(a.angle, -1000, 1000) && number(a.hp, 0, 1e9) && number(a.maxHp, 1, 1e9) && a.hp <= a.maxHp
      && number(a.damage, 0, 1e9) && typeof a.stationary === 'boolean'
      && (a.remaining === undefined || number(a.remaining, 0, 1e6))
      && (a.targetId === null || integer(a.targetId, 1)) && number(a.attackCooldown, 0, 1000) && number(a.radius, 0, 1e4)
      && (a.aura === undefined || object(a.aura) && ['heal', 'slow', 'mana', 'buff', 'absorb', 'ccBreak', 'cleanse'].includes(a.aura.kind as string)
        && number(a.aura.amount, 0, 1e6) && number(a.aura.radius, 0, 1e5)
        && (a.aura.stats === undefined || object(a.aura.stats)))))) return false;
  if (p.petCommand !== undefined && !['attack', 'follow', 'stay', 'passive'].includes(p.petCommand as string)) return false;
  if (p.buffs !== undefined && (!Array.isArray(p.buffs) || p.buffs.length > 64
    || !p.buffs.every(b => object(b) && text(b.id, 160) && text(b.name, 160) && text(b.color, 32)
      && number(b.remaining, 0, 1e6) && number(b.duration, 0, 1e6)
      && (b.stats === undefined || object(b.stats))
      && (b.absorb === undefined || number(b.absorb, 0, 10)) && (b.absorbRemaining === undefined || number(b.absorbRemaining, 0, 1e9))
      && (b.reduction === undefined || number(b.reduction, 0, 1))
      && (b.healPerSecond === undefined || number(b.healPerSecond, -10, 10))
      && (b.manaPerSecond === undefined || number(b.manaPerSecond, -10, 10))
      && (b.resourcePerSecond === undefined || number(b.resourcePerSecond, -1e4, 1e4))
      && (b.exclusiveGroup === undefined || text(b.exclusiveGroup, 60))
      && (b.form === undefined || typeof b.form === 'string' && SHAPESHIFT_FORMS.has(b.form))
      && (b.stealth === undefined || typeof b.stealth === 'boolean')
      && (b.reflect === undefined || number(b.reflect, 0, 10))
      && (b.imbue === undefined || object(b.imbue) && typeof b.imbue.element === 'string' && DOT_SCHOOLS.has(b.imbue.element) && number(b.imbue.fraction, 0, 10))
      && (b.breakControl === undefined || typeof b.breakControl === 'boolean')
      && (b.allyDamage === undefined || number(b.allyDamage, 0, 100))
      && (b.immunity === undefined || typeof b.immunity === 'boolean')
      && (b.leech === undefined || number(b.leech, 0, 10))
      && (b.tickAcc === undefined || number(b.tickAcc, 0, 10))
      && (b.storedResource === undefined || number(b.storedResource, 0, 1e9))))) return false;
  if (p.comboPoints !== undefined && !integer(p.comboPoints, 0, WOW_COMBAT.maxComboPoints)) return false;
  if (p.runes !== undefined && (!Array.isArray(p.runes) || p.runes.length !== 6 || !p.runes.every(r => number(r, 0, 1e9)))) return false;
  if (p.soulShards !== undefined && !integer(p.soulShards, 0, WOW_COMBAT.maxSoulShards)) return false;
  if (p.stealthed !== undefined && typeof p.stealthed !== 'boolean') return false;
  if (p.autoAttack !== undefined && typeof p.autoAttack !== 'boolean') return false;
  // WoW deepening fields (docs/wow-deepening.md)
  if (p.mounted !== undefined && p.mounted !== null && !(object(p.mounted) && isMountId(p.mounted.id) && number(p.mounted.since, 0, 1e9))) return false;
  if (p.restedXp !== undefined && !number(p.restedXp, 0, 1e12)) return false;
  if (p.hearthstone !== undefined && p.hearthstone !== null && !(object(p.hearthstone) && number(p.hearthstone.x, -4e7, 4e7) && number(p.hearthstone.y, -4e7, 4e7) && text(p.hearthstone.zone, 120))) return false;
  if (p.professions !== undefined && !(object(p.professions) && Object.entries(p.professions).every(([id, pr]) => isProfessionId(id) && object(pr) && integer(pr.level, 1, 450) && number(pr.xp, 0, 1e9)))) return false;
  if (p.quests !== undefined && !(object(p.quests) && Object.values(p.quests).every(q => object(q) && ['active', 'complete', 'turnedIn'].includes(q.status as string) && Array.isArray(q.progress) && q.progress.every((n: unknown) => integer(n, 0, 1e6)) && (q.visited === undefined || Array.isArray(q.visited) && q.visited.length <= 64 && q.visited.every((v: unknown) => text(v, 80))) && (q.lastCompletedAt === undefined || number(q.lastCompletedAt, 0, 1e12))))) return false;
  if (p.achievements !== undefined && !(object(p.achievements) && Object.values(p.achievements).every(n => number(n, 0, 1e12)))) return false;
  if (p.glyphs !== undefined && !(object(p.glyphs) && Object.entries(p.glyphs).every(([slot, id]) => GLYPH_SLOTS.includes(slot as never) && isGlyphId(id)))) return false;
  if (p.fishing !== undefined && !(object(p.fishing) && integer(p.fishing.level, 1, 450) && number(p.fishing.xp, 0, 1e9))) return false;
  if (p.durability !== undefined && !(object(p.durability) && Object.values(p.durability).every(n => number(n, 0, 100)))) return false;
  if (p.reputation !== undefined && !(object(p.reputation) && Object.keys(p.reputation).length <= 64 && Object.entries(p.reputation).every(([id, n]) => text(id, 60) && number(n, -42000, 42999)))) return false;
  if (p.combatLog !== undefined && (!Array.isArray(p.combatLog) || p.combatLog.length > 40 || !p.combatLog.every(e => object(e) && typeof e.kind === 'string' && text(e.text, 240) && number(e.time, 0, 1e9)))) return false;
  return true;
}

/** Per-actor WoW extras stored alongside StoredActor on checkpoint actors. */
function validActorWowExtras(actors: unknown): boolean {
  return (actors as ObjectValue[]).every(a => a.dots === undefined && a.cc === undefined && a.sundered === undefined && a.taunted === undefined
    || (a.dots === undefined || Array.isArray(a.dots) && a.dots.length <= 16 && a.dots.every((d: unknown) => object(d) && text((d as ObjectValue).id, 160)
        && typeof (d as ObjectValue).school === 'string' && DOT_SCHOOLS.has((d as ObjectValue).school as string)
        && number((d as ObjectValue).dps, 0, 1e9) && number((d as ObjectValue).remaining, 0, 1e6)
        && number((d as ObjectValue).tick, 0, 1e6) && number((d as ObjectValue).interval, 0, 1e4)
        && ((d as ObjectValue).ramp === undefined || number((d as ObjectValue).ramp, 0, 100))
        && ((d as ObjectValue).detonate === undefined || number((d as ObjectValue).detonate, 0, 100))
        && ['player', 'ally'].includes((d as ObjectValue).source as string)
        && ((d as ObjectValue).allyId === undefined || integer((d as ObjectValue).allyId, 1))))
      && (a.cc === undefined || Array.isArray(a.cc) && a.cc.length <= 8 && a.cc.every((c: unknown) => object(c)
        && typeof (c as ObjectValue).kind === 'string' && CC_KINDS.has((c as ObjectValue).kind as string)
        && number((c as ObjectValue).remaining, 0, 1e6) && typeof (c as ObjectValue).breakOnDamage === 'boolean'
        && ((c as ObjectValue).factor === undefined || number((c as ObjectValue).factor, 0, 1))))
      && (a.sundered === undefined || object(a.sundered) && number(a.sundered.fraction, 0, 1) && number(a.sundered.remaining, 0, 1e6))
      && (a.taunted === undefined || object(a.taunted) && number(a.taunted.remaining, 0, 1e6) && (a.taunted.allyId === undefined || integer(a.taunted.allyId, 1))));
}
/** Upgrade pre-WoW saves (v3 appearance, v4 class/race) on the parsed copy, then validate the entire checkpoint. */
export function decodeCharacterSave(raw: string): CharacterSave | null {
  if (raw.length > SAVE_MAX_CODE_UNITS) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (object(v) && (v.version === 3 || v.version === 4 || v.version === 5 || v.version === 6) && object(v.checkpoint) && object(v.checkpoint.character)) {
      // v4 predates class/race: infer the class from the equipped weapon; every legacy hero is human.
      if (!isWowClassId(v.checkpoint.character.classId)) v.checkpoint.character.classId = inferWowClassId(v.checkpoint.character);
      if (!isWowRaceId(v.checkpoint.character.raceId)) v.checkpoint.character.raceId = 'human';
      // v3 predates appearance. Seed the race's default look; preserve any existing recipe and let validation reject malformed data.
      if (!Object.hasOwn(v.checkpoint.character, 'look')) v.checkpoint.character.look = createRaceLook(v.checkpoint.character.raceId as WowRaceId);
      // v5 predates the 36-slot action bar: pad legacy 5-slot sheets; existing assignments keep slots 0-4.
      ensureBarSlots(v.checkpoint.character as unknown as CharacterSheet);
      v.version = CHARACTER_SAVE_VERSION;
    }
    if (!object(v) || v.version !== CHARACTER_SAVE_VERSION || !text(v.id, 64) || !/^[a-zA-Z0-9-]+$/.test(v.id)
      || !text(v.name, 24) || !integer(v.createdAt) || !integer(v.updatedAt) || v.updatedAt < v.createdAt
      || !integer(v.worldSeed, 0, 4294967295) || !integer(v.worldVersion, 1)) return null;
    const p = v.checkpoint;
    if(!object(p)||!upgradeSkillTree(p))return null;
    if (!object(p) || (p.encounterScales !== undefined && !validEncounterScales(p.encounterScales)) || (p.chronicle !== undefined && !validChronicle(p.chronicle)) || (p.journeys !== undefined && !validJourneys(p.journeys)) || (p.campWounds!==undefined&&!validCampWounds(p.campWounds)) || (p.roaming !== undefined && (!object(p.roaming) || !integer(p.roaming.warmup,0,ROAMING_RULES.warmupPopulation) || !number(p.roaming.cooldown,-1,10) || !number(p.roaming.requiredDistance,0,300))) || (p.expeditions !== undefined && !validExpeditions(p.expeditions)) || (p.actors !== undefined && !validActors(p.actors)) || (p.pickups !== undefined && !validPickups(p.pickups)) || (p.events !== undefined && !validEvents(p.events)) || (p.travel !== undefined && !validTravel(p.travel)) || !integer(p.level, 1, MAX_CONTENT_LEVEL) || !integer(p.xp, 0) || (p.level < MAX_CONTENT_LEVEL && p.xp >= xpForNextLevel(p.level))
      || !validSheet(p.character, p.level) || !number(p.x, -4e7, 4e7) || !number(p.y, -4e7, 4e7) || !number(p.angle, -1000, 1000)
      || !number(p.hp, 0, 1e9) || !number(p.mana, 0, 1e9) || typeof p.dead !== 'boolean' || (!p.dead && p.hp <= 0)
      || !integer(p.flasks, 0, 2) || !number(p.healCooldown, 0, 1000) || !integer(p.dodgeCharges, 0, 2) || !number(p.dodgeRecharge, 0, 1000)
      || !number(p.time) || !integer(p.kills) || !integer(p.randomState, 0, 4294967295) || !integer(p.spawnOrdinal)
      || !integer(p.killRecharge, 0, 1000) || !object(p.skillCooldowns)
      || !Object.entries(p.skillCooldowns).every(([id, n]) => (unlockedSkills((p.character as CharacterSheet).allocatedNodes).includes(id as SkillId) || id === WOW_RACES[(p.character as CharacterSheet).raceId].racial) && number(n, 0, 1000))
      || !Array.isArray(p.clearedCamps) || !p.clearedCamps.every(id => text(id, 180))
      || new Set(p.clearedCamps).size !== p.clearedCamps.length
      || !object(p.defeatedCampMembers)
      || !Object.entries(p.defeatedCampMembers).every(([id, members]) => text(id, 180) && Array.isArray(members)
        && members.length <= 32 && members.every(member => text(member, 180)) && new Set(members).size === members.length)
      || !Array.isArray(p.groundItems) || p.groundItems.length > LOOT_RULES.maxGroundItems
      || !p.groundItems.every(i => object(i) && integer(i.id, 1) && number(i.x, -4e7, 4e7) && number(i.y, -4e7, 4e7) && validItem(i.item) && validTreasureFlight(i.flight))
      || !validWowState(p) || (p.actors !== undefined && !validActorWowExtras(p.actors))) return null;
    if (p.brokenContainers !== undefined && (!Array.isArray(p.brokenContainers)
      || !p.brokenContainers.every(id => text(id, 180)) || new Set(p.brokenContainers).size !== p.brokenContainers.length)) return null;
    if (p.groundGold !== undefined && (!Array.isArray(p.groundGold) || p.groundGold.length > GOLD_RULES.maxPiles
      || !p.groundGold.every(i => object(i) && integer(i.id, 1) && number(i.x, -4e7, 4e7)
        && number(i.y, -4e7, 4e7) && integer(i.amount, 1) && validTreasureFlight(i.flight) && number(i.age, 0, 10)))) return null;
    const groundIds = [...p.groundItems, ...((p.groundGold ?? []) as GroundGold[])].map(i => i.id);
    if (new Set(groundIds).size !== groundIds.length) return null;
    const expedition=p.expeditions as Expeditions | undefined;
    const storedItems=expedition?[...(expedition.surface?.groundItems??[]),...expedition.runs.flatMap(r=>r.contents.groundItems)].map(i=>i.item):[];
    if (expedition?.location && !expedition.runs.some(r=>r.entrance.id===expedition.location)) return null;
    const dungeonReturn=(p.travel as TravelState | undefined)?.returnTo?.dungeon;
    if(dungeonReturn && !expedition?.runs.some(r=>r.entrance.id===dungeonReturn))return null;
    const items = [...storedItems,...(p.character.stash??[]),...(p.character.guildVault??[]),...p.character.inventory, ...Object.values(p.character.equipped), ...p.groundItems.map(i => i.item), ...p.character.commerce.buyback.map(i => i.item)].filter(Boolean) as Item[];
    if (new Set(items.map(i => i.id)).size !== items.length || new Set(p.groundItems.map(i => i.id)).size !== p.groundItems.length) return null;
    for (const item of items) {
      if (!item.id.startsWith('stock:')) continue;
      const source = /^stock:(town:[0-9]+:-?[0-9]+:building:[0-9]+:(blacksmith|jeweler)):([0-9]+):([0-9]+)$/.exec(item.id);
      if (!source) return null;
      const epoch = Number(source[3]), slot = Number(source[4]), state = p.character.commerce;
      if (!Number.isSafeInteger(epoch) || epoch > Math.floor((p.level - 1) / 3) || slot >= (source[2] === 'jeweler' ? 16 : 24)) return null;
      if (epoch >= state.epoch && !(state.sold[source[1]] & 1 << slot)) return null;
    }
    // Scourge Invasion state is self-healing: malformed or absent data restarts the schedule.
    p.worldEvents = validWorldEvents(p.worldEvents) ? p.worldEvents : freshWorldEvents();
    // Retire suppression and opt-out settings; the HUD now follows accepted work.
    if (object(p.journeys)) { delete p.journeys.dismissed; delete p.journeys.suggestions; }
    // Normalize the validated parsed copy, including stored dungeon loot and buyback.
    for (const item of items) Object.assign(item, roundItemStats(refreshEquipmentBudgets(rebalanceItemRolls(rebalanceItemOffense(rebalanceItemMana(rebalanceCharm(item)))))));
    return v as unknown as CharacterSave;
  } catch { return null; }
}
