/** PvP character generation (wayfinder T03): seeded NPC combatants and the Custom-mode
 * session character. Everything is built in memory through the same generators the
 * live game uses — `createCharacterSheet`, `allocateSkillRoute` over `buildSkillRoutes`,
 * `generateItem`, `refreshCharacter` — so NPCs obey the exact legality rules a saved
 * character does (connected talents, one Doctrine/spec per family, class-gated gear,
 * point conservation). Nothing here constructs a CharacterSession or touches a save;
 * match controllers discard these sheets when the match ends. */
import { createCharacterSheet, generateItem, EQUIPMENT_SLOTS } from './items.ts';
import { allocateSkillRoute, buildSkillRoutes } from './skill-tree-routes.ts';
import { SKILL_NODES, unlockedSkills } from './skill-tree.ts';
import { specSignatureNode } from './skill-tree-content.ts';
import { chosenSpec, specIdentity } from './skill-progression.ts';
import { assignSkill, refreshCharacter } from './character.ts';
import { initialPlayer } from './simulation.ts';
import { WOW_CLASSES } from './wow-classes.ts';
import { raceAllowsClass, WOW_RACES } from './wow-races.ts';
import { WOW_CLASS_SKILLS } from './wow-skills.ts';
import { WEAPON_PROFILES } from './weapon-content.ts';
import { MATERIAL_POOLS, type ItemMaterialId } from './item-materials.ts';
import { randomSource } from './random-source.ts';
import { normalizeLevel } from './progression-content.ts';
import { pvpClassRoles, type PvpCustomBuild, type PvpRole } from './pvp-setup.ts';
import { BAR_TOTAL } from './action-bar.ts';
import type { Player, WeaponFamily } from './model.ts';
import type { Attribute, CharacterSheet, EquipmentSlot, ItemTier, SkillId, WowSkillId } from './character-types.ts';
import type { WowClassId, WowRaceId } from './wow-types.ts';
import type { CharacterLook } from './character-look.ts';

/** What the offhand slot carries for a loadout; 'dual' is a second one-handed melee weapon. */
export type PvpOffhand = 'none' | 'shield' | 'focus' | 'relic' | 'dual';

/** One coherent gear+spec direction inside a role (Enhancement vs Elemental shaman). */
export interface PvpLoadout {
  /** Attribute investment weights; missing attributes get nothing. */
  readonly attributes: Partial<Record<Attribute, number>>;
  /** Preferred weapon families, in priority order; intersected with class legality. */
  readonly weapons: readonly WeaponFamily[];
  readonly offhand: PvpOffhand;
  /** Preferred sanctum spec signature ids (CLASS_SANCTUMS order); first reachable wins. */
  readonly specs: readonly string[];
}

/** A class's answer to a role direction: attribute weights plus gear/spec loadouts. */
export interface PvpRolePreset {
  readonly classId: WowClassId;
  readonly role: PvpRole;
  readonly armorStyle: 'plate' | 'leather' | 'cloth';
  readonly loadouts: readonly PvpLoadout[];
}

const STR = { strength: 1 }, DEX = { dexterity: 1 }, INT = { intelligence: 1 };
const STR_DEX = { strength: .7, dexterity: .3 }, INT_DEX = { intelligence: .7, dexterity: .3 };
const TANKY_STR = { vitality: .55, strength: .45 };
const HEALER = { intelligence: .6, vitality: .4 };

/** Per (class, role) loadouts; presence implies WOW_CLASSES[classId].roles supports the role. */
const PVP_LOADOUTS: Readonly<Record<WowClassId, Partial<Record<PvpRole, readonly PvpLoadout[]>>>> = Object.freeze({
  warrior: {
    dd: [{ attributes: STR, weapons: ['sword', 'axe', 'mace', 'polearm'], offhand: 'none', specs: ['arms', 'fury'] }],
    tank: [{ attributes: TANKY_STR, weapons: ['sword', 'mace', 'axe'], offhand: 'shield', specs: ['protection'] }],
  },
  paladin: {
    dd: [{ attributes: STR, weapons: ['mace', 'sword', 'axe', 'polearm'], offhand: 'none', specs: ['retribution'] }],
    tank: [{ attributes: TANKY_STR, weapons: ['mace', 'sword', 'axe'], offhand: 'shield', specs: ['protection'] }],
    heal: [
      { attributes: HEALER, weapons: ['mace', 'sword'], offhand: 'shield', specs: ['holy'] },
      { attributes: HEALER, weapons: ['mace', 'sword'], offhand: 'relic', specs: ['holy'] },
    ],
  },
  hunter: { dd: [{ attributes: DEX, weapons: ['bow', 'gun'], offhand: 'none', specs: ['marksmanship', 'beast-mastery', 'survival'] }] },
  rogue: { dd: [{ attributes: DEX, weapons: ['dagger', 'sword', 'fist', 'mace', 'axe'], offhand: 'dual', specs: ['assassination', 'combat', 'subtlety'] }] },
  priest: {
    dd: [
      { attributes: INT, weapons: ['staff'], offhand: 'none', specs: ['shadow'] },
      { attributes: INT, weapons: ['wand'], offhand: 'focus', specs: ['shadow'] },
    ],
    heal: [
      { attributes: HEALER, weapons: ['staff'], offhand: 'none', specs: ['discipline', 'holy'] },
      { attributes: HEALER, weapons: ['wand', 'mace'], offhand: 'focus', specs: ['discipline', 'holy'] },
    ],
  },
  deathKnight: {
    dd: [
      { attributes: STR, weapons: ['sword', 'axe', 'mace', 'polearm'], offhand: 'none', specs: ['unholy', 'frost'] },
      { attributes: STR, weapons: ['sword', 'axe', 'mace'], offhand: 'dual', specs: ['frost'] },
      { attributes: STR, weapons: ['sword', 'axe', 'mace'], offhand: 'relic', specs: ['unholy', 'frost'] },
    ],
    tank: [
      { attributes: TANKY_STR, weapons: ['sword', 'axe', 'mace', 'polearm'], offhand: 'none', specs: ['blood'] },
      { attributes: TANKY_STR, weapons: ['sword', 'axe', 'mace'], offhand: 'relic', specs: ['blood'] },
    ],
  },
  shaman: {
    dd: [
      { attributes: STR_DEX, weapons: ['axe', 'mace', 'fist'], offhand: 'dual', specs: ['enhancement'] },
      { attributes: INT_DEX, weapons: ['staff'], offhand: 'none', specs: ['elemental'] },
    ],
    heal: [
      { attributes: HEALER, weapons: ['mace', 'axe'], offhand: 'shield', specs: ['restoration'] },
      { attributes: HEALER, weapons: ['mace', 'axe'], offhand: 'relic', specs: ['restoration'] },
    ],
  },
  mage: {
    dd: [
      { attributes: INT, weapons: ['staff'], offhand: 'none', specs: ['fire', 'frost', 'arcane'] },
      { attributes: INT, weapons: ['wand'], offhand: 'focus', specs: ['fire', 'frost', 'arcane'] },
    ],
  },
  warlock: {
    dd: [
      { attributes: INT, weapons: ['staff'], offhand: 'none', specs: ['affliction', 'destruction', 'demonology'] },
      { attributes: INT, weapons: ['wand'], offhand: 'focus', specs: ['affliction', 'destruction', 'demonology'] },
    ],
  },
  druid: {
    dd: [
      { attributes: STR_DEX, weapons: ['polearm', 'mace', 'staff'], offhand: 'none', specs: ['feral'] },
      { attributes: INT, weapons: ['staff'], offhand: 'none', specs: ['balance'] },
    ],
    tank: [{ attributes: { vitality: .5, strength: .3, dexterity: .2 }, weapons: ['polearm', 'staff', 'mace'], offhand: 'none', specs: ['feral'] }],
    heal: [
      { attributes: HEALER, weapons: ['staff'], offhand: 'none', specs: ['restoration'] },
      { attributes: HEALER, weapons: ['mace'], offhand: 'relic', specs: ['restoration'] },
    ],
  },
});

/** The class's preset for a role direction, or null when WOW_CLASSES roles don't allow it. */
export function rolePreset(classId: WowClassId, role: PvpRole): PvpRolePreset | null {
  const cls = WOW_CLASSES[classId];
  const loadouts = PVP_LOADOUTS[classId]?.[role];
  if (!pvpClassRoles(classId).includes(role) || !loadouts?.length) return null;
  return { classId, role, armorStyle: cls.armorStyle, loadouts };
}

/** Roles the class can actually field — the wizard's teammate pick list. */
export function supportedRoles(classId: WowClassId): readonly PvpRole[] {
  return pvpClassRoles(classId).filter(role => rolePreset(classId, role) !== null);
}

/** What a build produced, for scoreboards, logs and tests. */
export interface PvpBuildSummary {
  readonly classId: WowClassId;
  readonly raceId: WowRaceId;
  readonly level: number;
  readonly role: PvpRole;
  /** Chosen specialization name (WotLK tree name) when a spec signature was reached. */
  readonly spec?: string;
  readonly identity: string;
  readonly talentNodes: number;
  readonly skills: readonly SkillId[];
  /** Equipped item tier per slot. */
  readonly gear: Readonly<Partial<Record<EquipmentSlot, ItemTier>>>;
}

/** A combatant-ready actor: the Player-shaped sheet plus a readable summary. */
export interface PvpCharacter {
  readonly player: Player;
  readonly sheet: CharacterSheet;
  readonly summary: PvpBuildSummary;
}

const pick = <T>(random: () => number, values: readonly T[]): T => values[Math.floor(random() * values.length)];

/** Level-scaled rarity mix: commons fade out, rare/epic dominate the cap. */
function gearTier(roll: number, level: number): ItemTier {
  const t = Math.min(1, Math.max(0, (level - 1) / 79));
  if (roll < .02 * t) return 'legendary';
  if (roll < .05 + .45 * t) return 'epic';
  if (roll < .35 + .75 * t) return 'rare';
  if (roll < .8 - .3 * t) return 'magic';
  return 'common';
}

/** Armor materials matching the class's armor style, drawn from the armor pool's weights. */
const ARMOR_STYLE_MATERIALS: Readonly<Record<'plate' | 'leather' | 'cloth', readonly ItemMaterialId[]>> = Object.freeze({
  plate: ['iron', 'steel', 'silver', 'gold'],
  leather: ['leather'],
  cloth: ['cloth', 'silk', 'velvet', 'starweave'],
});
function armorMaterial(random: () => number, style: 'plate' | 'leather' | 'cloth'): ItemMaterialId {
  const pool = MATERIAL_POOLS.armor.filter(entry => ARMOR_STYLE_MATERIALS[style].includes(entry.id));
  let roll = random() * pool.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of pool) if ((roll -= entry.weight) < 0) return entry.id;
  return pool[pool.length - 1].id;
}

/** Weapon profiles the class may legally wield, honoring the two-handed melee rule. */
function legalWeapons(classId: WowClassId, families: readonly WeaponFamily[], hands?: 1 | 2): readonly (typeof WEAPON_PROFILES)[number][] {
  const cls = WOW_CLASSES[classId];
  return WEAPON_PROFILES.filter(profile => families.includes(profile.family) && cls.weapons.includes(profile.family)
    && (hands === undefined || profile.hands === hands)
    && (profile.hands === 1 || profile.attackKind !== 'melee' || cls.twoHandedMelee));
}

/** Roll the equipped record for a loadout at the target item level. */
function rollLoadoutGear(random: () => number, classId: WowClassId, preset: PvpRolePreset, loadout: PvpLoadout, itemLevel: number): CharacterSheet['equipped'] {
  const equipped = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, null])) as CharacterSheet['equipped'];
  const item = (kind: Parameters<typeof generateItem>[2], profileId?: string, material?: ItemMaterialId) =>
    generateItem(Math.floor(random() * 0xffffffff), itemLevel, kind, profileId, gearTier(random(), itemLevel), material);

  // Offhand 'none' prefers a two-handed profile when the class can legally carry one.
  const twoHanded = loadout.offhand === 'none' && legalWeapons(classId, loadout.weapons, 2).length > 0;
  const weapon = item('weapon', pick(random, legalWeapons(classId, loadout.weapons, loadout.offhand === 'none' && twoHanded ? 2 : loadout.offhand === 'none' ? undefined : 1)).id);
  equipped.weapon = weapon;

  switch (loadout.offhand) {
    case 'shield': equipped.offhand = item('shield'); break;
    case 'focus': equipped.offhand = item(pick(random, ['grimoire', 'orb'] as const)); break;
    case 'relic': equipped.offhand = item('relic'); break;
    case 'dual': {
      const oneHanded = legalWeapons(classId, loadout.weapons, 1).filter(profile => profile.attackKind === 'melee');
      equipped.offhand = item('weapon', pick(random, oneHanded).id);
      break;
    }
    default: break; // 'none'
  }

  for (const slot of ['head', 'chest', 'gloves', 'legs', 'boots'] as const)
    equipped[slot] = item(slot, undefined, armorMaterial(random, preset.armorStyle));
  equipped.cloak = item('cloak', undefined, 'cloth');
  equipped.amulet = item('amulet');
  equipped.ring1 = item('ring');
  equipped.ring2 = item('ring');
  return equipped;
}

/** Per-slot generateItem loadout at the match item level — the same items player loot rolls. */
export function equalGearFor(classId: WowClassId, itemLevel: number, role: PvpRole = 'dd', seed = 0): CharacterSheet['equipped'] {
  const preset = rolePreset(classId, role) ?? rolePreset(classId, 'dd');
  if (!preset) throw new RangeError(`Unknown class: ${classId}`);
  const random = randomSource(seed ^ 0x9e3779b9);
  return rollLoadoutGear(random, classId, preset, pick(random, preset.loadouts), normalizeLevel(itemLevel));
}

/** Spend attribute points by the loadout's weights; leftovers stay as unspent statPoints. */
function spendAttributes(sheet: CharacterSheet, points: number, weights: Partial<Record<Attribute, number>>): void {
  const order = (Object.keys(weights) as Attribute[]).filter(key => (weights[key] ?? 0) > 0)
    .sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
  const total = order.reduce((sum, key) => sum + (weights[key] ?? 0), 0);
  if (!order.length || total <= 0 || points <= 0) return;
  const exact = order.map(key => points * (weights[key] ?? 0) / total);
  const granted = exact.map(Math.floor);
  // Largest remainder first; ties resolve in weight order so the split is deterministic.
  let rest = points - granted.reduce((sum, n) => sum + n, 0);
  for (const index of order.map((_, i) => i).sort((a, b) => (exact[b] - granted[b]) - (exact[a] - granted[a]))) {
    if (rest <= 0) break;
    granted[index]++; rest--;
  }
  for (const [index, key] of order.entries()) sheet.attributes[key] += granted[index];
  sheet.statPoints = Math.max(0, sheet.statPoints - points);
}

/** Weighted random walk of the talent atlas through the validated route allocator.
 * Skill nodes and the loadout's spec signature are favored; doctrine conflicts and
 * class gates are enforced inside buildSkillRoutes/allocateSkillRoute. */
function spendTalents(sheet: CharacterSheet, random: () => number, preferredSpecs: readonly string[]): void {
  const blocked = new Set<string>();
  for (const specId of preferredSpecs) {
    if (sheet.skillPoints <= 0) return;
    const nodeId = specSignatureNode(sheet.classId, specId);
    if (SKILL_NODES.has(nodeId) && allocateSkillRoute(sheet, nodeId).ok) break;
    blocked.add(nodeId);
  }
  while (sheet.skillPoints > 0) {
    const owned = new Set(sheet.allocatedNodes);
    const routes = buildSkillRoutes(owned, sheet.classId);
    const candidates: { id: string; cost: number; weight: number }[] = [];
    for (const [id, step] of routes) {
      if (owned.has(id) || blocked.has(id) || step.cost < 1 || step.cost > sheet.skillPoints) continue;
      const node = SKILL_NODES.get(id)!;
      const weight = (node.skill ? 4 : 1) * (node.spec && preferredSpecs.includes(node.spec) ? 6 : 1) * (node.kind === 'notable' || node.kind === 'major' ? 2 : 1);
      candidates.push({ id, cost: step.cost, weight });
    }
    if (!candidates.length) return;
    let roll = random() * candidates.reduce((sum, c) => sum + c.weight, 0);
    const target = candidates.find(c => (roll -= c.weight) < 0) ?? candidates[candidates.length - 1];
    if (!allocateSkillRoute(sheet, target.id).ok) blocked.add(target.id);
  }
}

/** Bar slots in kit order: starter first, then the rest of the class kit, then any
 * generic atlas skills the random build happened to unlock. assignSkill enforces
 * unlocks, uniqueness and aura reservation. */
function fillSkillBar(player: Player, first: readonly WowSkillId[] = []): void {
  const sheet = player.character;
  sheet.skillSlots = Array.from({ length: BAR_TOTAL }, () => null);
  const unlocked = unlockedSkills(sheet.allocatedNodes);
  const kit = WOW_CLASS_SKILLS[sheet.classId].map(skill => skill.id);
  const ordered = [...first, ...kit, ...unlocked.filter(id => !kit.includes(id as WowSkillId))];
  let slot = 0;
  for (const id of ordered) {
    if (slot >= BAR_TOTAL) break;
    if (sheet.skillSlots.includes(id)) continue;
    if (unlocked.includes(id) && assignSkill(player, slot, id).ok) slot++;
  }
}

/** Melee gap closers per class (WoW's Charge/Shadowstep/Death Grip/Feral Charge).
 * Without one a melee NPC is kited to death by ranged AI and never fights. */
const MOBILITY_SKILLS: Partial<Record<WowClassId, readonly WowSkillId[]>> = {
  warrior: ['charge', 'intercept', 'heroicLeap'],
  rogue: ['shadowstep'],
  deathKnight: ['deathGrip'],
  druid: ['feralCharge'],
};

/** Reserve a mobility talent before the random walk drains the point pool —
 * melee/tank loadouts only (caster loadouts fight at range by design). */
function ensureMobility(sheet: CharacterSheet, classId: WowClassId, loadout: PvpLoadout): void {
  if (loadout.attributes.intelligence) return;
  for (const id of MOBILITY_SKILLS[classId] ?? []) {
    const nodeId = `wow-${classId}-${id}`;
    if (sheet.allocatedNodes.includes(nodeId)) return;
    if (SKILL_NODES.has(nodeId) && allocateSkillRoute(sheet, nodeId).ok) return;
  }
}

/** Resource seeding mirrors createCharacter: rage/runic start empty, mana/energy full. */
function seedResource(player: Player): void {
  const cls = WOW_CLASSES[player.character.classId];
  player.hp = player.maxHp;
  player.mana = cls.resource === 'rage' || cls.resource === 'runicPower' ? 0 : Math.min(player.maxMana, cls.resourceCap || player.maxMana);
}

function summarize(sheet: CharacterSheet, level: number, role: PvpRole): PvpBuildSummary {
  const spec = chosenSpec(sheet);
  return {
    classId: sheet.classId, raceId: sheet.raceId, level, role,
    spec: spec?.spec, identity: specIdentity(sheet),
    talentNodes: sheet.allocatedNodes.length,
    skills: sheet.skillSlots.filter((id): id is SkillId => id !== null),
    gear: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, sheet.equipped[slot]?.tier]).filter(([, tier]) => tier !== undefined)),
  };
}

/** A seeded, fully legal level-N NPC: random race, role-directed attributes, a random
 * talent build walked through the real route allocator, equal-ilevel gear and a full
 * skill bar. `role` falls back to 'dd' when the class can't field it; omitted picks a
 * seeded supported role. The match controller spawns it via `build.player`. */
export function randomNpcBuild(seed: number, classId: WowClassId, level: number, role?: PvpRole): PvpCharacter {
  const cls = WOW_CLASSES[classId];
  if (!cls) throw new RangeError(`Unknown class: ${classId}`);
  const targetLevel = normalizeLevel(level);
  const random = randomSource(seed);
  const resolvedRole = role && rolePreset(classId, role) ? role : role ? 'dd' : pick(random, supportedRoles(classId));
  const preset = rolePreset(classId, resolvedRole)!;
  const loadout = pick(random, preset.loadouts);

  const races = (Object.keys(WOW_RACES) as WowRaceId[]).filter(race => raceAllowsClass(race, classId));
  const sheet = createCharacterSheet(classId, pick(random, races));
  sheet.skillPoints = targetLevel - 1;
  sheet.statPoints = (targetLevel - 1) * 5;
  spendAttributes(sheet, sheet.statPoints, loadout.attributes);
  ensureMobility(sheet, classId, loadout);
  spendTalents(sheet, random, loadout.specs);
  sheet.equipped = rollLoadoutGear(random, classId, preset, loadout, targetLevel);

  const player = initialPlayer(0, 0);
  player.character = sheet;
  player.level = targetLevel;
  player.name = specIdentity(sheet);
  fillSkillBar(player);
  refreshCharacter(player);
  seedResource(player);
  player.soulShards = 4;
  return { player, sheet, summary: summarize(sheet, targetLevel, resolvedRole) };
}

/** Custom-mode options: the wizard's PvpCustomBuild plus explicit attribute and
 * talent-fill controls. `skills` are class-kit ids (WowSkillId); unknown or foreign
 * skills throw, since a chosen kit must be honored exactly. */
export interface CustomCharacterOptions extends Omit<PvpCustomBuild, 'look'> {
  /** Appearance; absent = the race's default look. */
  readonly look?: CharacterLook;
  /** Exact attribute totals; each must be an integer ≥10 within the level's point budget. */
  readonly attributes?: Partial<Record<Attribute, number>>;
  /** Display name; defaults to the spec identity. */
  readonly name?: string;
  /** Spend leftover skill points on a seeded random build (default true). */
  readonly fillTalents?: boolean;
}

/** The Custom-mode session character: a level-N Player built entirely in memory —
 * never a CharacterSession, never a save write (the character-editor study pattern).
 * The match controller discards it afterwards; only rewards reach the real sheet. */
export function buildCustomCharacter(options: CustomCharacterOptions): PvpCharacter {
  const cls = WOW_CLASSES[options.classId];
  if (!cls) throw new RangeError(`Unknown class: ${options.classId}`);
  if (!raceAllowsClass(options.raceId, options.classId))
    throw new RangeError(`${WOW_RACES[options.raceId].name} cannot be a ${cls.name}.`);
  const level = normalizeLevel(options.level);
  const role: PvpRole = options.role && rolePreset(options.classId, options.role) ? options.role : 'dd';
  const preset = rolePreset(options.classId, role)!;
  const random = randomSource(options.seed ?? 0x5eed);
  const loadout = pick(random, preset.loadouts);

  const sheet = createCharacterSheet(options.classId, options.raceId, options.look);
  sheet.skillPoints = level - 1;
  sheet.statPoints = (level - 1) * 5;

  if (options.attributes) {
    for (const [key, value] of Object.entries(options.attributes) as [Attribute, number][]) {
      if (!Number.isInteger(value) || value < 10) throw new RangeError(`Attribute ${key} must be an integer ≥ 10.`);
      sheet.attributes[key] = value;
    }
    const spent = Object.values(sheet.attributes).reduce((sum, n) => sum + n - 10, 0);
    if (spent > (level - 1) * 5) throw new RangeError(`Attributes exceed the level ${level} budget.`);
    sheet.statPoints = (level - 1) * 5 - spent;
  } else {
    spendAttributes(sheet, sheet.statPoints, loadout.attributes);
  }

  // Chosen skills first: their sanctum nodes are allocated through the validated
  // route, then the bar is filled with exactly those skills before the auto kit.
  const chosen = options.skills ?? [];
  for (const id of chosen) {
    const nodeId = `wow-${options.classId}-${id}`;
    if (!SKILL_NODES.has(nodeId)) throw new RangeError(`${cls.name} cannot learn ${id}.`);
    if (!sheet.allocatedNodes.includes(nodeId) && !allocateSkillRoute(sheet, nodeId).ok)
      throw new RangeError(`Cannot reach ${id} at level ${level}.`);
  }
  ensureMobility(sheet, options.classId, loadout);
  if (options.fillTalents !== false) spendTalents(sheet, random, loadout.specs);

  // Gear can require up to level + 2; clamp so the sheet stays equippable.
  const itemLevel = Math.min(normalizeLevel(options.itemLevel ?? level), level + 2);
  sheet.equipped = rollLoadoutGear(random, options.classId, preset, loadout, itemLevel);

  const player = initialPlayer(0, 0);
  player.character = sheet;
  player.level = level;
  fillSkillBar(player, chosen);
  refreshCharacter(player);
  seedResource(player);
  player.soulShards = 4;
  player.name = options.name ?? specIdentity(sheet);
  return { player, sheet, summary: summarize(sheet, level, role) };
}
