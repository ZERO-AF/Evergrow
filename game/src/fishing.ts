import { GAME_FEATURES } from './game-features.ts';
import { encounterScaleAt } from './encounter-scaling.ts';
import { generateItem } from './items.ts';
import { addInventoryItem } from './inventory.ts';
import { creditGold } from './wallet.ts';
import { pushChatMessage } from './chat-log.ts';
import { metric } from './chronicle.ts';
import type { Player, WorldQuery } from './model.ts';
import type { BiomeId } from './biomes.ts';
import type { Item } from './character-types.ts';

/** Fishing secondary profession (docs/wow-deepening.md §13).
 * Cast a bobber at water (E near water), wait for the splash, click to catch.
 * Fish land in `player.fishing.materials` — the shared material-bag convention
 * (`bag: 'fishing'`) that profession-state's materialCount/materialGrant resolves.
 * Junk auto-sells for coppers; rare treasure yields real equippable items.
 * Tables use real WotLK fish, junk, zones and the 1–450 skill cap. */

export const FISHING_RULES = Object.freeze({
  maxLevel: 450,
  /** Furthest the bobber may land from the player. */
  castRange: 260,
  /** Minimum hydrology coverage for a fishable point. */
  waterCoverage: .3,
  /** Seconds until a bite (WoW-ish 2–15s window). */
  biteMin: 2,
  biteMax: 15,
  /** Click window once the bobber splashes. */
  biteWindow: 2.5,
  /** A cast with no successful catch reels itself in. */
  castTimeout: 21,
  /** Bobber snaps when the player walks this far past cast range. */
  breakDistance: 340,
});

// ── Skill ────────────────────────────────────────────────────────────

/** `player.fishing` plus the material bag (extra key; save validation passes it through). */
export interface FishingSkill {
  level: number;
  /** Successful catches toward the next skill point. */
  xp: number;
  /** Material id → count. Fish ids are shared with profession-state's MATERIALS table. */
  materials?: Record<string, number>;
}

/** Lazily creates the persisted skill record. */
export function fishingSkill(player: Player): FishingSkill {
  player.fishing ??= { level: 1, xp: 0 };
  return player.fishing as FishingSkill;
}

/** Catches needed per skill point — approximates the WotLK curve (1 early, ~6 at 375+). */
export function catchesForLevel(level: number): number {
  return 1 + Math.floor(Math.max(0, level) / 75);
}

export interface FishingProgress { level: number; xp: number; needed: number; maxed: boolean }
export function fishingProgress(player: Player): FishingProgress {
  const skill = fishingSkill(player);
  return { level: skill.level, xp: skill.xp, needed: catchesForLevel(skill.level), maxed: skill.level >= FISHING_RULES.maxLevel };
}

/** Awards catches; returns the number of skill points gained. */
export function awardFishingXp(player: Player, catches = 1): number {
  const skill = fishingSkill(player);
  if (skill.level >= FISHING_RULES.maxLevel || catches <= 0) return 0;
  skill.xp += catches;
  let gained = 0;
  while (skill.level < FISHING_RULES.maxLevel && skill.xp >= catchesForLevel(skill.level)) {
    skill.xp -= catchesForLevel(skill.level);
    skill.level += 1;
    gained += 1;
  }
  if (skill.level >= FISHING_RULES.maxLevel) skill.xp = 0;
  return gained;
}

/** Material count in the fishing bag (profession-state resolves the same location). */
export function fishingMaterialCount(player: Player, id: string): number {
  return fishingSkill(player).materials?.[id] ?? 0;
}

// ── Content: fish, junk, treasure ────────────────────────────────────

export interface FishDef {
  /** Material id; shared ids match profession-state's MATERIALS table. */
  readonly id: string;
  readonly name: string;
  readonly weight: number;
  readonly bag: 'fishing';
  readonly flavor?: string;
}

interface FishingTier {
  /** Zone level at or below which this table applies. */
  readonly maxZoneLevel: number;
  readonly fish: readonly FishDef[];
}

const fish = (id: string, name: string, weight: number, flavor?: string): FishDef =>
  Object.freeze({ id, name, weight, bag: 'fishing' as const, flavor });

/** Real WotLK open-water catches, tiered by zone level (Elwynn → Icecrown). */
export const FISHING_TIERS: readonly FishingTier[] = Object.freeze([
  { maxZoneLevel: 10, fish: Object.freeze([ // Elwynn Forest / Mulgore / Teldrassil / Durotar
    fish('slitherskinMackerel', 'Raw Slitherskin Mackerel', 45),
    fish('longjawMudSnapper', 'Raw Longjaw Mud Snapper', 35),
    fish('brilliantSmallfish', 'Raw Brilliant Smallfish', 20),
  ]) },
  { maxZoneLevel: 20, fish: Object.freeze([ // The Barrens / Westfall / Silverpine / Loch Modan
    fish('longjawMudSnapper', 'Raw Longjaw Mud Snapper', 35),
    fish('bristleWhiskerCatfish', 'Raw Bristle Whisker Catfish', 30),
    fish('oilyBlackmouth', 'Oily Blackmouth', 20),
    fish('deviateFish', 'Deviate Fish', 15, 'A strange catch from the Wailing Caverns waters.'),
  ]) },
  { maxZoneLevel: 30, fish: Object.freeze([ // Ashenvale / Wetlands / Hillsbrad / Duskwood
    fish('bristleWhiskerCatfish', 'Raw Bristle Whisker Catfish', 40),
    fish('oilyBlackmouth', 'Oily Blackmouth', 25),
    fish('rockscaleCod', 'Raw Rockscale Cod', 20),
    fish('rainbowFinAlbacore', 'Raw Rainbow Fin Albacore', 15),
  ]) },
  { maxZoneLevel: 40, fish: Object.freeze([ // Stranglethorn / Dustwallow / Arathi / Desolace
    fish('rockscaleCod', 'Raw Rockscale Cod', 35),
    fish('firefinSnapper', 'Firefin Snapper', 30),
    fish('spottedYellowtail', 'Raw Spotted Yellowtail', 35),
  ]) },
  { maxZoneLevel: 50, fish: Object.freeze([ // Tanaris / Feralas / Hinterlands / Swamp of Sorrows
    fish('spottedYellowtail', 'Raw Spotted Yellowtail', 40),
    fish('summerSquid', 'Raw Summer Squid', 30),
    fish('mightfish', 'Raw Mightfish', 30),
  ]) },
  { maxZoneLevel: 60, fish: Object.freeze([ // Felwood / Winterspring / Plaguelands / Azshara
    fish('mightfish', 'Raw Mightfish', 40),
    fish('stonescaleEel', 'Raw Stonescale Eel', 35),
    fish('nightfinSnapper', 'Raw Nightfin Snapper', 25, 'It only bites after dark. Somehow.'),
  ]) },
  { maxZoneLevel: 70, fish: Object.freeze([ // Outland: Zangarmarsh / Terokkar / Nagrand
    fish('barbedGillTrout', 'Barbed Gill Trout', 40),
    fish('figlusterMudfish', 'Figluster\'s Mudfish', 35),
    fish('goldenDarter', 'Golden Darter', 25),
  ]) },
  { maxZoneLevel: 80, fish: Object.freeze([ // Northrend: Borean Tundra / Howling Fjord / Grizzly Hills
    fish('boreanManOWar', 'Borean Man O\' War', 30),
    fish('imperialMantaRay', 'Imperial Manta Ray', 30),
    fish('dragonfinAngelfish', 'Dragonfin Angelfish', 25),
    fish('sewerCarp', 'Sewer Carp', 10, 'Someone flushed it in Dalaran.'),
    fish('magicEater', 'Magic Eater', 5, 'It hums with latent arcane energy.'),
  ]) },
]);

/** Biome-flavoured bonus catches appended to the active tier table. */
const BIOME_FISH: Partial<Record<BiomeId, readonly FishDef[]>> = {
  frostpine: Object.freeze([fish('bonescaleSnapper', 'Bonescale Snapper', 20), fish('glassfinMinnow', 'Glassfin Minnow', 15)]),
  swamp: Object.freeze([fish('bristleWhiskerCatfish', 'Raw Bristle Whisker Catfish', 20)]),
  emberfall: Object.freeze([fish('firefinSnapper', 'Firefin Snapper', 20)]),
  sunscar: Object.freeze([fish('deviateFish', 'Deviate Fish', 12)]),
};

export interface JunkDef { readonly id: string; readonly name: string; readonly gold: number; readonly weight: number }
const junk = (id: string, name: string, gold: number, weight: number): JunkDef => Object.freeze({ id, name, gold, weight });

/** Real WoW fishing junk — auto-sold on the catch (no vendor-trash item kind exists). */
export const FISHING_JUNK: readonly JunkDef[] = Object.freeze([
  junk('driftwood', 'Driftwood', 2, 16),
  junk('tangledFishingLine', 'Tangled Fishing Line', 1, 14),
  junk('oldBoot', 'Old Boot', 1, 14),
  junk('rock', 'Rock', 1, 12),
  junk('weeds', 'Weeds', 1, 12),
  junk('tatteredCloth', 'Tattered Cloth', 1, 10),
  junk('sicklyFish', 'Sickly Fish', 1, 8),
  junk('waterSnail', 'Water Snail', 1, 6),
  junk('emptyRumBottle', 'Empty Rum Bottle', 2, 4),
  junk('oldSkull', 'Old Skull', 3, 2),
  junk('brokenFishingRod', 'Broken Fishing Rod', 4, 1),
  junk('rustyOldSpear', 'Rusty Old Spear', 3, 1),
]);

export type FishingTreasure =
  | { readonly kind: 'material'; readonly id: string; readonly name: string; readonly weight: number; readonly flavor: string }
  | { readonly kind: 'item'; readonly id: string; readonly name: string; readonly weight: number; readonly flavor: string;
      readonly itemKind: 'weapon' | 'shield' | 'ring'; readonly profileId?: string; readonly tier: 'common' | 'magic' | 'rare';
      readonly implicit?: Item['implicit'] };

/** Rare WotLK catches: equippable fish-weapons, The 1 Ring, trophy materials. */
export const FISHING_TREASURE: readonly FishingTreasure[] = Object.freeze([
  { kind: 'item', id: 'rockhideStrongfish', name: 'Rockhide Strongfish', weight: 30, itemKind: 'weapon', profileId: 'flanged-mace', tier: 'magic',
    flavor: 'A fish. A mace. A fish-mace.' },
  { kind: 'item', id: 'steelscaleCrushfish', name: 'Steelscale Crushfish', weight: 18, itemKind: 'weapon', profileId: 'flanged-mace', tier: 'rare',
    flavor: 'Hits like a very angry trout.' },
  { kind: 'item', id: 'oldCrafty', name: 'Old Crafty', weight: 8, itemKind: 'shield', profileId: 'iron-buckler', tier: 'magic',
    flavor: 'The one that didn\'t get away.' },
  { kind: 'item', id: 'the1Ring', name: 'The 1 Ring', weight: 4, itemKind: 'ring', tier: 'magic',
    implicit: { strength: 1, dexterity: 1, intelligence: 1, vitality: 1 },
    flavor: 'Not quite as good as The 2 Ring.' },
  { kind: 'material', id: 'mrPinchy', name: 'Mr. Pinchy', weight: 12, flavor: 'A magical crawdad. He looks like he grants wishes.' },
  { kind: 'material', id: 'giantSewerRat', name: 'Giant Sewer Rat', weight: 6, flavor: 'Dalaran\'s worst kept secret.' },
]);

// ── Zones ────────────────────────────────────────────────────────────

export interface FishingZone {
  /** Effective zone level (encounter scale base). */
  readonly level: number;
  readonly biome: BiomeId;
  /** Real WoW zone name for this level band + biome. */
  readonly name: string;
  /** Fishing skill where junk/escape stops dominating. */
  readonly requiredSkill: number;
}

const WOW_FISHING_ZONES: readonly { maxLevel: number; fallback: string; names: Partial<Record<BiomeId, string>> }[] = Object.freeze([
  { maxLevel: 10, fallback: 'Elwynn Forest', names: { verdant: 'Elwynn Forest', steppe: 'Mulgore', autumn: 'Teldrassil', sunscar: 'Durotar', deadwood: 'Tirisfal Glades', frostpine: 'Dun Morogh' } },
  { maxLevel: 20, fallback: 'The Barrens', names: { steppe: 'The Barrens', sunscar: 'The Barrens', highlands: 'Westfall', deadwood: 'Silverpine Forest', verdant: 'Loch Modan', autumn: 'Darkshore' } },
  { maxLevel: 30, fallback: 'Ashenvale', names: { verdant: 'Ashenvale', swamp: 'Wetlands', highlands: 'Hillsbrad Foothills', deadwood: 'Duskwood', steppe: 'Stonetalon Mountains' } },
  { maxLevel: 40, fallback: 'Stranglethorn Vale', names: { verdant: 'Stranglethorn Vale', swamp: 'Dustwallow Marsh', highlands: 'Arathi Highlands', sunscar: 'Desolace', autumn: 'Ashenvale' } },
  { maxLevel: 50, fallback: 'Tanaris', names: { sunscar: 'Tanaris', verdant: 'Feralas', highlands: 'The Hinterlands', swamp: 'Swamp of Sorrows', steppe: 'Desolace' } },
  { maxLevel: 60, fallback: 'Felwood', names: { deadwood: 'Western Plaguelands', frostpine: 'Winterspring', emberfall: 'Burning Steppes', autumn: 'Azshara', verdant: 'Felwood', highlands: 'Eastern Plaguelands' } },
  { maxLevel: 70, fallback: 'Nagrand', names: { swamp: 'Zangarmarsh', verdant: 'Terokkar Forest', steppe: 'Nagrand', highlands: 'Nagrand', sunscar: 'Hellfire Peninsula', emberfall: 'Shadowmoon Valley', deadwood: 'Zangarmarsh' } },
  { maxLevel: 80, fallback: 'Borean Tundra', names: { steppe: 'Borean Tundra', frostpine: 'Howling Fjord', highlands: 'Grizzly Hills', verdant: 'Grizzly Hills', autumn: 'Crystalsong Forest', deadwood: 'Icecrown', swamp: 'Borean Tundra', emberfall: 'Wintergrasp' } },
]);

/** WoW-style fishing skill needed for clean catches at a zone level. */
export function fishingRequiredSkill(zoneLevel: number): number {
  return Math.max(1, Math.min(430, Math.round(zoneLevel * 5.2)));
}

/** Real WoW zone name for a level band + biome. */
export function fishingZoneName(zoneLevel: number, biome: BiomeId): string {
  const band = WOW_FISHING_ZONES.find(z => zoneLevel <= z.maxLevel) ?? WOW_FISHING_ZONES[WOW_FISHING_ZONES.length - 1];
  return band.names[biome] ?? band.fallback;
}

/** Zone context at a world position (overworld; dungeons report dry water anyway). */
export function fishingZoneAt(world: WorldQuery, x: number, y: number, playerLevel: number): FishingZone {
  const level = encounterScaleAt(x, y, world.seed, playerLevel).base;
  const biome = world.sampleBiome?.(x, y).id ?? 'verdant';
  return { level, biome, name: fishingZoneName(level, biome), requiredSkill: fishingRequiredSkill(level) };
}

/** Catch table for a zone: tier fish plus biome-flavoured extras. */
export function fishingTable(zone: FishingZone): readonly FishDef[] {
  const tier = FISHING_TIERS.find(t => zone.level <= t.maxZoneLevel) ?? FISHING_TIERS[FISHING_TIERS.length - 1];
  const extra = BIOME_FISH[zone.biome];
  return extra ? [...tier.fish, ...extra] : tier.fish;
}

// ── Session state ────────────────────────────────────────────────────

export interface FishingBobber {
  x: number;
  y: number;
  /** Sim time the cast landed. */
  castAt: number;
  /** Sim time of the next scheduled bite. */
  biteAt: number;
  /** Sim time the splash fired; undefined while waiting. */
  bitAt?: number;
  readonly zone: FishingZone;
}

/** Run-local fishing state; owned by the integrator (e.g. `game.fishing`). Not persisted. */
export interface FishingSession { bobber: FishingBobber | null }
export const freshFishing = (): FishingSession => ({ bobber: null });

/** Water sampler — pass `(x, y) => world.sampleWater(x, y)`. */
export type FishingWater = (x: number, y: number) => { coverage: number };

export interface FishingSpot { x: number; y: number; coverage: number }

/** Nearest fishable point around the player (E-key cast). */
export function fishingSpotNear(player: Pick<Player, 'x' | 'y'>, water: FishingWater): FishingSpot | null {
  for (let r = 30; r <= FISHING_RULES.castRange; r += 24)
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2 + r * .37;
      const x = player.x + Math.cos(angle) * r, y = player.y + Math.sin(angle) * r;
      const coverage = water(x, y).coverage;
      if (coverage >= FISHING_RULES.waterCoverage) return { x, y, coverage };
    }
  return null;
}

/** Fishable point at an explicit aim (click cast); small forgiveness radius. */
export function fishingSpotAt(player: Pick<Player, 'x' | 'y'>, aim: { x: number; y: number }, water: FishingWater): FishingSpot | null {
  if (Math.hypot(aim.x - player.x, aim.y - player.y) > FISHING_RULES.castRange) return null;
  for (const [dx, dy] of [[0, 0], [10, 0], [-10, 0], [0, 10], [0, -10], [8, 8], [-8, -8]] as const) {
    const coverage = water(aim.x + dx, aim.y + dy).coverage;
    if (coverage >= FISHING_RULES.waterCoverage) return { x: aim.x + dx, y: aim.y + dy, coverage };
  }
  return null;
}

// ── Commands ─────────────────────────────────────────────────────────

export type FishingCastResult = { ok: true; bobber: FishingBobber } | { ok: false; problem: string };

/**
 * E near water (no aim) or click on water (aim). Recasting replaces the bobber.
 * `time` is sim.time; `random` is any [0,1) source.
 */
export function fishingCast(session: FishingSession, player: Player, water: FishingWater, zone: FishingZone,
  time: number, random: () => number, aim?: { x: number; y: number }): FishingCastResult {
  if (!GAME_FEATURES.fishing) return { ok: false, problem: 'Fishing is disabled.' };
  if (player.dead) return { ok: false, problem: 'You cannot fish while dead.' };
  if (player.mounted) return { ok: false, problem: 'You cannot fish while mounted.' };
  if (player.cast) return { ok: false, problem: 'You cannot fish while casting.' };
  const spot = aim ? fishingSpotAt(player, aim, water) : fishingSpotNear(player, water);
  if (!spot) return { ok: false, problem: aim ? 'Your bobber must land in water.' : 'No fishable water nearby.' };
  const bobber: FishingBobber = {
    x: spot.x, y: spot.y, castAt: time, zone,
    biteAt: time + FISHING_RULES.biteMin + random() * (FISHING_RULES.biteMax - FISHING_RULES.biteMin),
  };
  session.bobber = bobber;
  return { ok: true, bobber };
}

export type FishingBiteEvent = 'bite' | 'expired' | 'cancelled';

/**
 * Per-frame bite timer. Returns 'bite' the frame the splash fires (play splash/sound),
 * 'expired' when the cast times out, 'cancelled' when the line breaks (moved/died).
 * A missed click window silently schedules the next bite, like WoW.
 */
export function fishingBite(session: FishingSession, player: Player, time: number, random: () => number): FishingBiteEvent | null {
  const bobber = session.bobber;
  if (!bobber) return null;
  if (player.dead || Math.hypot(player.x - bobber.x, player.y - bobber.y) > FISHING_RULES.breakDistance) {
    session.bobber = null;
    return 'cancelled';
  }
  if (bobber.bitAt !== undefined) {
    if (time - bobber.bitAt > FISHING_RULES.biteWindow) {
      // Missed the splash — the fish swims off; another may bite before the cast ends.
      bobber.bitAt = undefined;
      bobber.biteAt = time + 1.5 + random() * 4;
    }
    return null;
  }
  if (time - bobber.castAt > FISHING_RULES.castTimeout) {
    session.bobber = null;
    return 'expired';
  }
  if (time >= bobber.biteAt) {
    bobber.bitAt = time;
    return 'bite';
  }
  return null;
}

export type FishingCatchResult =
  | { kind: 'none' }
  | { kind: 'early'; message: string }
  | { kind: 'escaped'; message: string }
  | { kind: 'junk'; name: string; gold: number; message: string; levelUps: number }
  | { kind: 'fish'; fish: FishDef; message: string; levelUps: number }
  | { kind: 'treasure'; name: string; item?: Item; bagFull?: boolean; message: string; levelUps: number };

/** Click during the splash window. Reeling in early or late ends the cast with no catch. */
export function fishingCatch(session: FishingSession, player: Player, time: number, random: () => number): FishingCatchResult {
  const bobber = session.bobber;
  if (!bobber) return { kind: 'none' };
  session.bobber = null;
  if (bobber.bitAt === undefined || time - bobber.bitAt > FISHING_RULES.biteWindow)
    return { kind: 'early', message: bobber.bitAt === undefined ? 'You reel in your line.' : 'Too slow — the fish is gone.' };

  const skill = fishingSkill(player);
  const deficit = Math.max(0, bobber.zone.requiredSkill - skill.level);
  const escapeChance = Math.min(.85, deficit / bobber.zone.requiredSkill);
  const finish = (message: string, levelUps: number): string => {
    const note = levelUps ? ` Fishing skill increases to ${skill.level}.` : '';
    pushChatMessage(player, 'loot', message + note, time);
    return message + note;
  };
  if (random() < escapeChance)
    return { kind: 'escaped', message: finish('The fish got away!', 0) };

  const roll = random();
  const junkChance = Math.min(.9, Math.max(.05, deficit / bobber.zone.requiredSkill * .9));
  const treasureChance = .03 + (skill.level >= bobber.zone.requiredSkill + 50 ? .02 : 0);
  const levelUps = awardFishingXp(player, 1);

  if (roll < treasureChance) {
    const total = FISHING_TREASURE.reduce((s, t) => s + t.weight, 0);
    let pick = random() * total, treasure = FISHING_TREASURE[FISHING_TREASURE.length - 1];
    for (const t of FISHING_TREASURE) { if ((pick -= t.weight) < 0) { treasure = t; break; } }
    metric(player.chronicle, 'fishCaught'); metric(player.chronicle, 'treasure:' + treasure.id);
    if (treasure.kind === 'material') {
      const bag = (skill.materials ??= {});
      bag[treasure.id] = (bag[treasure.id] ?? 0) + 1;
      return { kind: 'treasure', name: treasure.name, message: finish(`You catch: ${treasure.name}!`, levelUps), levelUps };
    }
    const item = generateItem(Math.floor(random() * 0xffffffff), Math.max(1, bobber.zone.level), treasure.itemKind, treasure.profileId, treasure.tier);
    item.id += `-${treasure.id}`; item.name = treasure.name; item.baseName = treasure.name; item.flavor = treasure.flavor;
    if (treasure.implicit) item.implicit = { ...treasure.implicit };
    if (!addInventoryItem(player.character, item))
      return { kind: 'treasure', name: treasure.name, item, bagFull: true, message: finish(`You catch: ${treasure.name}! (Inventory full — dropped at your feet.)`, levelUps), levelUps };
    return { kind: 'treasure', name: treasure.name, item, message: finish(`You catch: ${treasure.name}!`, levelUps), levelUps };
  }

  if (roll < treasureChance + junkChance) {
    const total = FISHING_JUNK.reduce((s, j) => s + j.weight, 0);
    let pick = random() * total, caught = FISHING_JUNK[0];
    for (const j of FISHING_JUNK) { if ((pick -= j.weight) < 0) { caught = j; break; } }
    creditGold(player.character, caught.gold);
    metric(player.chronicle, 'fishCaught');
    return { kind: 'junk', name: caught.name, gold: caught.gold, message: finish(`You catch: ${caught.name} (+${caught.gold}g)`, levelUps), levelUps };
  }

  const table = fishingTable(bobber.zone);
  const total = table.reduce((s, f) => s + f.weight, 0);
  let pick = random() * total, caughtFish = table[table.length - 1];
  for (const f of table) { if ((pick -= f.weight) < 0) { caughtFish = f; break; } }
  const bag = (skill.materials ??= {});
  bag[caughtFish.id] = (bag[caughtFish.id] ?? 0) + 1;
  metric(player.chronicle, 'fishCaught'); metric(player.chronicle, 'fish:' + caughtFish.id);
  return { kind: 'fish', fish: caughtFish, message: finish(`You catch: ${caughtFish.name}`, levelUps), levelUps };
}

/** Reel in / clear the bobber (movement, death, panel open, recast). */
export function fishingCancel(session: FishingSession | undefined): void {
  if (!session) return;
  session.bobber = null;
}

/** HUD prompt label, or null when nothing fishing-related applies. */
export function fishingPrompt(session: FishingSession, player: Player, water: FishingWater, interactKey: string): string | null {
  if (!GAME_FEATURES.fishing || player.dead) return null;
  const bobber = session.bobber;
  if (bobber) return bobber.bitAt !== undefined ? 'Click to catch!' : `Fishing…  [${interactKey}] reel in`;
  return fishingSpotNear(player, water) ? `Fish  [${interactKey}]` : null;
}
