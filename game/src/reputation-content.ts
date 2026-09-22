/** Reputation factions (docs/wow-deepening.md — second wave).
 * Real WotLK factions mapped onto Evergrow's biomes, dungeon themes and quest
 * zones. Standings use the real WotLK point thresholds: Hated -42000 →
 * Hostile -6000 → Unfriendly -3000 → Neutral 0 → Friendly 3000 →
 * Honored 9000 → Revered 21000 → Exalted 42000 (cap 42999).
 * Progress lives on `player.reputation` (reputation-state.ts owns the ledger). */
import type { BiomeId } from './biomes.ts';
import type { EnemyKind } from './model.ts';
import type { DungeonThemeId } from './dungeon-content.ts';
import type { ItemKind, ItemTier } from './character-types.ts';
import type { UIIconName } from './ui-icons.ts';
import { toCopper } from './currency.ts';

export type FactionId =
  | 'stormwind' | 'argentCrusade' | 'kirinTor' | 'timbermawHold'
  | 'cenarionCircle' | 'thoriumBrotherhood' | 'sonsOfHodir' | 'steamwheedleCartel'
  | 'warsong';

export type StandingTier =
  | 'hated' | 'hostile' | 'unfriendly' | 'neutral'
  | 'friendly' | 'honored' | 'revered' | 'exalted';

export interface StandingDef {
  readonly tier: StandingTier;
  readonly label: string;
  /** First reputation point of this tier (absolute, Neutral = 0). */
  readonly min: number;
  /** WoW reputation-bar color. */
  readonly color: string;
}

/** Real WotLK standing thresholds, ascending. `EXALTED_CAP` is the hard ceiling. */
export const STANDINGS: readonly StandingDef[] = Object.freeze([
  Object.freeze({ tier: 'hated', label: 'Hated', min: -42000, color: '#cc2222' }),
  Object.freeze({ tier: 'hostile', label: 'Hostile', min: -6000, color: '#ff6622' }),
  Object.freeze({ tier: 'unfriendly', label: 'Unfriendly', min: -3000, color: '#ddaa44' }),
  Object.freeze({ tier: 'neutral', label: 'Neutral', min: 0, color: '#e8d44d' }),
  Object.freeze({ tier: 'friendly', label: 'Friendly', min: 3000, color: '#55cc55' }),
  Object.freeze({ tier: 'honored', label: 'Honored', min: 9000, color: '#22bb99' }),
  Object.freeze({ tier: 'revered', label: 'Revered', min: 21000, color: '#6688ee' }),
  Object.freeze({ tier: 'exalted', label: 'Exalted', min: 42000, color: '#c9a44a' }),
]);
export const EXALTED_CAP = 42999;
export const HATED_FLOOR = STANDINGS[0].min;

/** A quartermaster-style reward unlocked at a standing. Claimed once per
 * character through the reputation panel (repClaimReward in reputation-command). */
export type FactionReward =
  | { readonly id: string; readonly name: string; readonly standing: StandingTier; readonly kind: 'gear'; readonly slot: ItemKind; readonly tier: ItemTier }
  | { readonly id: string; readonly name: string; readonly standing: StandingTier; readonly kind: 'tabard'; readonly tabardFaction: FactionId }
  | { readonly id: string; readonly name: string; readonly standing: StandingTier; readonly kind: 'gold'; readonly copper: number }
  | { readonly id: string; readonly name: string; readonly standing: StandingTier; readonly kind: 'material'; readonly material: string; readonly count: number };

export interface FactionDef {
  readonly id: FactionId;
  readonly name: string;
  readonly description: string;
  readonly icon: UIIconName;
  /** Accent color for the panel row. */
  readonly color: string;
  /** Starting points (Timbermaw begins Unfriendly, like WoW). */
  readonly initial?: number;
  /** Surface biomes whose kills credit this faction. */
  readonly biomes?: readonly BiomeId[];
  /** Enemy kinds that credit this faction wherever they die (Scourge → Argent). */
  readonly enemyKinds?: readonly EnemyKind[];
  /** Dungeon themes whose kills and clears credit this faction. */
  readonly dungeonThemes?: readonly DungeonThemeId[];
  /** Quest `zone` labels whose turn-ins credit this faction. */
  readonly questZones?: readonly string[];
  /** Explicit quest id → this faction (wins over questZones). */
  readonly quests?: readonly string[];
  /** Dungeon entrance ids that credit this faction on clear (e.g. Onyxia's Lair). */
  readonly raidIds?: readonly string[];
  /** Home-settlement faction: NPCs in the starting town (place id 0) belong here. */
  readonly homeSettlement?: boolean;
  /** Alliance/Horde axis this faction rides on (factions.ts); absent = neutral. */
  readonly axis?: 'alliance' | 'horde';
  /** Reputation per dungeon/raid boss clear. */
  readonly clearRep: number;
  /** Reputation per quest turn-in. */
  readonly questRep: number;
  /** Kills stop granting reputation at this standing (default 'revered'). */
  readonly killCap?: StandingTier;
  readonly rewards: readonly FactionReward[];
}

const gear = (id: string, name: string, standing: StandingTier, slot: ItemKind, tier: ItemTier): FactionReward =>
  Object.freeze({ id, name, standing, kind: 'gear', slot, tier });
const bounty = (id: string, name: string, standing: StandingTier, gold: number): FactionReward =>
  Object.freeze({ id, name, standing, kind: 'gold', copper: toCopper(gold) });
const supplies = (id: string, name: string, standing: StandingTier, material: string, count: number): FactionReward =>
  Object.freeze({ id, name, standing, kind: 'material', material, count });
const tabard = (id: string, name: string, standing: StandingTier, faction: FactionId): FactionReward =>
  Object.freeze({ id, name, standing, kind: 'tabard', tabardFaction: faction });

const f = (def: FactionDef): Readonly<FactionDef> => Object.freeze(def);

export const FACTIONS: readonly FactionDef[] = Object.freeze([
  f({ id: 'stormwind', name: 'Stormwind', icon: 'shield', color: '#3f6fb5',
    description: 'The crown of the Alliance. Its marshals post bounties from Briarwatch to the farthest border towns.',
    homeSettlement: true,
    axis: 'alliance',
    biomes: ['verdant', 'highlands'],
    raidIds: ['dungeon:raid:onyxias-lair'],
    questZones: ['Elwynn Forest', 'Westfall', 'Redridge Mountains', 'Duskwood'],
    clearRep: 250, questRep: 150,
    rewards: [
      tabard('stormwind-tabard', 'Tabard of Stormwind', 'honored', 'stormwind'),
      gear('stormwind-signet', 'Stormwind Signet', 'revered', 'ring', 'epic'),
      gear('stormwind-greatsword', 'Stormwind Greatsword', 'exalted', 'weapon', 'epic'),
    ] }),
  f({ id: 'argentCrusade', name: 'Argent Crusade', icon: 'star', color: '#c8b46a',
    description: 'The united front against the Scourge. Every revenant and grave-lord destroyed is a debt repaid.',
    enemyKinds: ['frostRevenant', 'graveMarshal'],
    dungeonThemes: ['ossuary'],
    // WotLK Argent dailies (quest-content.ts Northrend dailies block).
    quests: ['defending-wyrmrest-temple', 'troll-patrol', 'intelligence-gathering', 'threat-from-above', 'slaves-to-saronite'],
    clearRep: 300, questRep: 200,
    rewards: [
      tabard('argent-tabard', 'Tabard of the Argent Crusade', 'friendly', 'argentCrusade'),
      gear('argent-commission', 'Argent Dawn Commission', 'honored', 'amulet', 'rare'),
      gear('argent-avenger', 'Argent Avenger', 'revered', 'weapon', 'epic'),
      gear('dawn-gambit', 'Dawn’s Gambit', 'exalted', 'amulet', 'epic'),
    ] }),
  f({ id: 'kirinTor', name: 'Kirin Tor', icon: 'diamond', color: '#9a6fd8',
    description: 'The magocracy of Dalaran keeps its archives sealed to all but proven allies.',
    biomes: ['autumn'],
    dungeonThemes: ['astral'],
    clearRep: 250, questRep: 150,
    rewards: [
      tabard('kirin-tor-tabard', 'Tabard of the Kirin Tor', 'friendly', 'kirinTor'),
      gear('stag-helm', 'Helm of the Majestic Stag', 'honored', 'head', 'rare'),
      gear('flameheart-scroll', 'Flameheart Spell Scalpel', 'revered', 'weapon', 'epic'),
      gear('kirin-tor-ring', 'Ring of the Kirin Tor', 'exalted', 'ring', 'epic'),
    ] }),
  f({ id: 'timbermawHold', name: 'Timbermaw Hold', icon: 'lantern', color: '#a9825a',
    description: 'The last uncorrupted furbolg hold. They trust no outsider — trust is earned pelt by pelt.',
    initial: -2500,
    biomes: ['deadwood'],
    dungeonThemes: ['rootbound'],
    clearRep: 250, questRep: 150,
    rewards: [
      tabard('timbermaw-tabard', 'Tabard of Timbermaw Hold', 'friendly', 'timbermawHold'),
      gear('fur-and-claw', 'Stave of Fur and Claw', 'honored', 'orb', 'rare'),
      gear('timbermaw-boots', 'Timbermaw Boots', 'revered', 'boots', 'rare'),
      gear('defender-timbermaw', 'Defender of the Timbermaw', 'exalted', 'amulet', 'epic'),
    ] }),
  f({ id: 'cenarionCircle', name: 'Cenarion Circle', icon: 'leaf', color: '#6fae62',
    description: 'Druids of the wilds fighting the creeping corruption in the swamps and groves.',
    biomes: ['swamp'],
    clearRep: 250, questRep: 150,
    rewards: [
      supplies('cenarion-herb-bag', 'Cenarion Herb Bag', 'honored', 'sungrass', 20),
      tabard('cenarion-tabard', 'Tabard of the Cenarion Circle', 'friendly', 'cenarionCircle'),
      gear('sylvan-crown', 'Sylvan Crown', 'honored', 'head', 'rare'),
      gear('reservist-legs', 'Cenarion Reservist’s Leggings', 'revered', 'legs', 'rare'),
      gear('wrath-of-cenarius', 'Wrath of Cenarius', 'exalted', 'ring', 'epic'),
    ] }),
  f({ id: 'thoriumBrotherhood', name: 'Thorium Brotherhood', icon: 'armor', color: '#c07a4a',
    description: 'Dark Iron defectors who keep the forges of the Depths burning for their own ends.',
    biomes: ['emberfall'],
    dungeonThemes: ['foundry', 'blackrock'],
    clearRep: 350, questRep: 150,
    rewards: [
      gear('dark-iron-bracers', 'Dark Iron Bracers', 'honored', 'gloves', 'rare'),
      tabard('thorium-tabard', 'Tabard of the Thorium Brotherhood', 'friendly', 'thoriumBrotherhood'),
      gear('dark-iron-helm', 'Dark Iron Helm', 'revered', 'head', 'epic'),
      gear('dark-iron-destroyer', 'Dark Iron Destroyer', 'exalted', 'weapon', 'epic'),
    ] }),
  f({ id: 'sonsOfHodir', name: 'The Sons of Hodir', icon: 'sword', color: '#7fb8d8',
    description: 'Frost giants of the storm peaks. Their favor is bought in blood and ice.',
    biomes: ['frostpine'],
    dungeonThemes: ['rime'],
    // WotLK Sons of Hodir dailies at Dun Niffelem / Frosthold.
    quests: ['pushed-too-far', 'hot-and-cold'],
    clearRep: 250, questRep: 150,
    rewards: [
      tabard('hodir-tabard', 'Tabard of the Sons of Hodir', 'friendly', 'sonsOfHodir'),
      gear('giant-friend-kilt', 'Giant-Friend Kilt', 'honored', 'legs', 'rare'),
      gear('broken-stalactite', 'Broken Stalactite', 'revered', 'weapon', 'epic'),
      gear('diamond-cane', 'Diamond-tipped Cane', 'exalted', 'weapon', 'epic'),
    ] }),
  f({ id: 'steamwheedleCartel', name: 'Steamwheedle Cartel', icon: 'jewelry', color: '#c9a44a',
    description: 'Goblin traders of the free ports. Loyalty is a line item — and so are you.',
    biomes: ['sunscar', 'steppe'],
    dungeonThemes: ['drowned'],
    clearRep: 250, questRep: 150,
    rewards: [
      tabard('cartel-tabard', 'Steamwheedle Cartel Tabard', 'friendly', 'steamwheedleCartel'),
      gear('rocket-boots', 'Goblin Rocket Boots', 'honored', 'boots', 'rare'),
      bounty('cartel-voucher', 'Cartel Trade Voucher', 'revered', 250),
      gear('rocket-helmet', 'Goblin Rocket Helmet', 'exalted', 'head', 'epic'),
    ] }),
  f({ id: 'warsong', name: 'Warsong Outriders', icon: 'sword', color: '#b5543c',
    axis: 'horde',
    description: 'The Outriders answer only to battle. Arena and battleground victories are the coin they respect.',
    clearRep: 0, questRep: 0,
    rewards: [
      tabard('outrider-tabard', 'Outrider’s Tabard', 'honored', 'warsong'),
      gear('warsong-blade', 'Warsong Blade', 'revered', 'weapon', 'epic'),
      gear('outrider-medallion', 'Medallion of the Outriders', 'exalted', 'amulet', 'epic'),
    ] }),
]);

export const FACTION_BY_ID: Readonly<Record<FactionId, FactionDef>> = Object.freeze(
  Object.fromEntries(FACTIONS.map(faction => [faction.id, faction])) as Record<FactionId, FactionDef>);

export function isFactionId(value: unknown): value is FactionId {
  return typeof value === 'string' && Object.hasOwn(FACTION_BY_ID, value);
}

/** Standing tier lookup; `standingIndex`/`standingAt` live in reputation-state. */
export const STANDING_BY_TIER: Readonly<Record<StandingTier, StandingDef>> = Object.freeze(
  Object.fromEntries(STANDINGS.map(s => [s.tier, s])) as Record<StandingTier, StandingDef>);

/** WoW vendor discount per standing (applied to buy-side prices at Friendly+). */
export const STANDING_DISCOUNT: Readonly<Record<StandingTier, number>> = Object.freeze({
  hated: 0, hostile: 0, unfriendly: 0, neutral: 0,
  friendly: .05, honored: .10, revered: .15, exalted: .20,
});

/** Reputation granted per kill by enemy rank; bosses use `bossRep`. */
export const KILL_REP = Object.freeze({ normal: 5, veteran: 10, elite: 20, rare: 30, boss: 150 });
