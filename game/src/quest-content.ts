/** Quest definitions (docs/wow-deepening.md §1).
 *
 * Real WotLK quest names mapped onto Evergrow's archetypes and places:
 *   goblin → Kobold, stalker/archer/brute → Defias & gnoll warbands,
 *   hound → Gnoll/wolf packs, caster/mireSpitter → Murloc tribes,
 *   goblinChief → named bandit leaders, wilderness bosses → Hogger/Princess/Stalvan.
 * Towns are procedural, so givers are anchored by NPC role + settlement tier +
 * town biome (Goldshire = verdant village, Sentinel Hill = steppe village,
 * Lakeshire = highlands village, Darkshire = deadwood village). `giver: 'poi'`
 * quests hang on world objects instead: `giverPoi: 'town'` is the settlement's
 * wanted poster at the hearth, other POI kinds are the site itself. */
import type { NPCRole } from './npcs.ts';
import type { BiomeId } from './biomes.ts';
import type { SettlementTier } from './settlement-services.ts';
import type { POIKind } from './world-pois.ts';
import { toCopper } from './currency.ts';

export type QuestId = string;
export type QuestType = 'kill' | 'collect' | 'explore' | 'boss';

export interface QuestObjective {
  readonly kind: QuestType;
  /** kill/boss: EnemyKind. collect: quest-item id or profession material id.
   * explore: POIKind — progress counts distinct visited sites of that kind. */
  readonly target: string;
  readonly count: number;
  /** Objective line shown in the log/tracker ("Riverpaw gnolls slain"). */
  readonly label?: string;
  /** collect only: EnemyKind that drops the item while the quest is active. */
  readonly dropFrom?: string;
  /** collect + dropFrom: per-kill drop chance (default 1). */
  readonly dropChance?: number;
}

export interface QuestReward {
  /** Base experience before the level-difference factor. */
  readonly xp: number;
  /** Copper total (currency.ts units), credited to the wallet on turn-in. */
  readonly gold: number;
  /** Material ids (granted to the profession bag) or `gear:<ItemKind>` for a
   * generated reward item at the quest's level. */
  readonly items?: readonly string[];
  readonly skillPoints?: number;
}

/** Where a quest is offered or completed. `role` is a service NPC; `poi` is a
 * world object (settlement poster, watchtower, graveyard…). */
export interface QuestGiver {
  readonly role?: NPCRole;
  readonly poi?: POIKind;
  /** Town biome the giver must stand in (Goldshire quests only spawn in verdant towns). */
  readonly biome?: BiomeId;
  /** Settlement size the giver's town must have. */
  readonly tier?: SettlementTier;
  /** Display name for dialog headers and "return to" text. */
  readonly label?: string;
}

export interface QuestDef {
  readonly id: QuestId;
  readonly name: string;
  /** NPC role or 'poi' that offers the quest (see giverSpec()). */
  readonly giver: NPCRole | 'poi';
  readonly level: number;
  readonly type: QuestType;
  readonly objectives: readonly QuestObjective[];
  readonly rewards: QuestReward;
  /** Follow-up quest unlocked on turn-in. */
  readonly next?: QuestId;
  readonly description: string;
  /** WoW zone label shown in the log ("Elwynn Forest"). */
  readonly zone?: string;
  readonly giverLabel?: string;
  readonly giverBiome?: BiomeId;
  readonly giverTier?: SettlementTier;
  /** POI kind that offers the quest when `giver === 'poi'` ('town' = wanted poster). */
  readonly giverPoi?: POIKind;
  /** Turn-in location when it differs from the giver (wanted posters → marshal). */
  readonly turnIn?: QuestGiver;
}

export interface QuestState {
  status: 'active' | 'complete' | 'turnedIn';
  /** Per-objective progress counts. */
  progress: number[];
  /** Explore dedupe: POI ids already counted, kept across save/load. */
  visited?: string[];
}

const obj = (kind: QuestType, target: string, count: number, label: string,
  extra?: Pick<QuestObjective, 'dropFrom' | 'dropChance'>): QuestObjective =>
  Object.freeze({ kind, target, count, label, ...extra });

const q = (def: QuestDef): Readonly<QuestDef> => Object.freeze(def);

/** Virtual quest items (never enter the inventory; progress is the ledger). */
export const QUEST_ITEMS: Readonly<Record<string, string>> = Object.freeze({
  koboldCandle: 'Kobold Candle',
  redLinen: 'Red Linen Bandana',
  toughHide: 'Tough Condor Hide',
  stolenTome: 'Stolen Tome of the Vigil',
});

export const QUESTS: readonly QuestDef[] = Object.freeze([
  // ── Goldshire (verdant villages) ──────────────────────────────────────────
  q({ id: 'investigate-echo-ridge', name: 'Investigate Echo Ridge', zone: 'Elwynn Forest',
    giver: 'blacksmith', giverLabel: 'Marshal Dughan', giverBiome: 'verdant', giverTier: 'village',
    level: 1, type: 'explore',
    objectives: [obj('explore', 'hamlet', 1, 'Echo Ridge investigated')],
    rewards: { xp: 110, gold: toCopper(0, 0, 40) }, next: 'kobold-candles',
    description: 'Kobolds have overrun the occupied hamlet east of Goldshire. Scout the Echo Ridge camp and report back to Marshal Dughan.' }),
  q({ id: 'kobold-candles', name: 'Kobold Candles', zone: 'Elwynn Forest',
    giver: 'jeweler', giverLabel: 'William Pestle', giverBiome: 'verdant', giverTier: 'village',
    level: 2, type: 'collect',
    objectives: [obj('collect', 'koboldCandle', 8, 'Kobold Candles collected', { dropFrom: 'goblin', dropChance: .6 })],
    rewards: { xp: 170, gold: toCopper(0, 0, 75) }, next: 'the-fargodeep-mine',
    description: 'William Pestle needs candles for a remedy — the kobold warbands carry them. Slay scrap goblins and take their candles.' }),
  q({ id: 'the-fargodeep-mine', name: 'The Fargodeep Mine', zone: 'Elwynn Forest',
    giver: 'blacksmith', giverLabel: 'Marshal Dughan', giverBiome: 'verdant', giverTier: 'village',
    level: 3, type: 'explore',
    objectives: [obj('explore', 'quarry', 1, 'Fargodeep Mine scouted')],
    rewards: { xp: 210, gold: toCopper(0, 0, 90) }, next: 'the-jasperlode-mine',
    description: 'The Fargodeep quarry fell to the kobolds. Scout the mine workings and confirm how deep the infestation runs.' }),
  q({ id: 'the-jasperlode-mine', name: 'The Jasperlode Mine', zone: 'Elwynn Forest',
    giver: 'blacksmith', giverLabel: 'Marshal Dughan', giverBiome: 'verdant', giverTier: 'village',
    level: 4, type: 'explore',
    objectives: [obj('explore', 'quarry', 1, 'Jasperlode Mine scouted'), obj('kill', 'goblin', 6, 'Kobold workers slain')],
    rewards: { xp: 280, gold: toCopper(0, 1, 10) },
    description: 'One more mine remains unaccounted for. Scout a second quarry and put down the kobold workers guarding it.' }),
  q({ id: 'brotherhood-of-thieves', name: 'Brotherhood of Thieves', zone: 'Elwynn Forest',
    giver: 'enchanter', giverLabel: 'Deputy Willem', giverBiome: 'verdant', giverTier: 'village',
    level: 2, type: 'kill',
    objectives: [obj('kill', 'stalker', 8, 'Defias thieves slain')],
    rewards: { xp: 160, gold: toCopper(0, 0, 60) }, next: 'bounty-garrick-padfoot',
    description: 'Defias thieves stalk the farms outside Goldshire. Deputy Willem wants their numbers thinned before they reach the village.' }),
  q({ id: 'bounty-garrick-padfoot', name: 'Bounty on Garrick Padfoot', zone: 'Elwynn Forest',
    giver: 'enchanter', giverLabel: 'Deputy Willem', giverBiome: 'verdant', giverTier: 'village',
    level: 5, type: 'boss',
    objectives: [obj('boss', 'goblinChief', 1, 'Garrick Padfoot slain')],
    rewards: { xp: 420, gold: toCopper(0, 2, 50), items: ['gear:weapon'] },
    description: 'Garrick Padfoot leads the local Defias cell from a fortified camp. Bring the war-chief down and claim the bounty.' }),
  q({ id: 'the-stolen-tome', name: 'The Stolen Tome', zone: 'Elwynn Forest',
    giver: 'enchanter', giverLabel: 'Brother Neals', giverBiome: 'verdant',
    level: 4, type: 'collect',
    objectives: [obj('collect', 'stolenTome', 1, 'Stolen Tome recovered', { dropFrom: 'stalker' }),
      obj('explore', 'camp', 1, 'Thieves’ camp searched')],
    rewards: { xp: 300, gold: toCopper(0, 1, 0), items: ['gear:orb'] },
    description: 'Defias raiders stole a tome from the chapel reliquary. Search their camp and take it back from the thieves.' }),
  q({ id: 'riverpaw-gnoll-bounty', name: 'Riverpaw Gnoll Bounty', zone: 'Elwynn Forest',
    giver: 'blacksmith', giverLabel: 'Guard Thomas', giverBiome: 'verdant',
    level: 6, type: 'kill',
    objectives: [obj('kill', 'hound', 8, 'Riverpaw gnolls slain')],
    rewards: { xp: 340, gold: toCopper(0, 1, 40) },
    description: 'Riverpaw gnolls harry the forest roads. Guard Thomas posts a bounty on the pack — thin them out.' }),
  q({ id: 'a-fishy-peril', name: 'A Fishy Peril', zone: 'Elwynn Forest',
    giver: 'gambler', giverLabel: 'Remy “Two Times”', giverBiome: 'verdant',
    level: 5, type: 'kill',
    objectives: [obj('kill', 'caster', 6, 'Murloc scouts slain')],
    rewards: { xp: 260, gold: toCopper(0, 1, 0) }, next: 'murloc-threat',
    description: '“Murlocs, I tell you! Fish-men in the shallows!” Remy Two Times saw murloc scouts — prove him right and drive them off.' }),
  q({ id: 'murloc-threat', name: 'Murloc Threat', zone: 'Elwynn Forest',
    giver: 'gambler', giverLabel: 'Remy “Two Times”', giverBiome: 'verdant',
    level: 7, type: 'kill',
    objectives: [obj('kill', 'mireSpitter', 8, 'Murloc tidecallers slain')],
    rewards: { xp: 430, gold: toCopper(0, 2, 0), items: ['gear:boots'] },
    description: 'The murlocs answer scouts with tidecallers. Break the tribe before it reaches the village wells.' }),
  q({ id: 'wanted-hogger', name: 'Wanted: Hogger', zone: 'Elwynn Forest',
    giver: 'poi', giverPoi: 'town', giverLabel: 'Wanted Poster', giverBiome: 'verdant', giverTier: 'village',
    turnIn: { role: 'blacksmith', biome: 'verdant', tier: 'village', label: 'Marshal Dughan' },
    level: 8, type: 'boss',
    objectives: [obj('boss', 'briarMatriarch', 1, 'Hogger slain')],
    rewards: { xp: 650, gold: toCopper(0, 4, 0), items: ['gear:chest'], skillPoints: 1 },
    description: 'WANTED: Hogger, king of the Riverpaw gnolls. The beast dens in a lair deep in the forest. Report to Marshal Dughan for the bounty.' }),
  q({ id: 'princess-must-die', name: 'Princess Must Die', zone: 'Elwynn Forest',
    giver: 'poi', giverPoi: 'town', giverLabel: 'Wanted Poster', giverBiome: 'verdant', giverTier: 'village',
    turnIn: { role: 'blacksmith', biome: 'verdant', tier: 'village', label: 'Marshal Dughan' },
    level: 9, type: 'boss',
    objectives: [obj('boss', 'ashColossus', 1, 'Princess slain')],
    rewards: { xp: 720, gold: toCopper(0, 4, 50), items: ['gear:legs'] },
    description: 'The Stonefield prize boar “Princess” has grown monstrous and turned on the farms. End her rampage and collect the bounty.' }),
  // ── Sentinel Hill (steppe villages stand in for Westfall) ─────────────────
  q({ id: 'the-peoples-militia', name: 'The People’s Militia', zone: 'Westfall',
    giver: 'blacksmith', giverLabel: 'Gryan Stoutmantle', giverBiome: 'steppe', giverTier: 'village',
    level: 9, type: 'kill',
    objectives: [obj('kill', 'stalker', 10, 'Defias trappers slain')],
    rewards: { xp: 480, gold: toCopper(0, 2, 20) }, next: 'the-peoples-militia-2',
    description: 'Gryan Stoutmantle raises the People’s Militia at Sentinel Hill. Prove yourself against the Defias trappers in the fields.' }),
  q({ id: 'the-peoples-militia-2', name: 'The People’s Militia', zone: 'Westfall',
    giver: 'blacksmith', giverLabel: 'Gryan Stoutmantle', giverBiome: 'steppe', giverTier: 'village',
    level: 12, type: 'kill',
    objectives: [obj('kill', 'stalker', 8, 'Defias smugglers slain'), obj('kill', 'archer', 8, 'Defias lookouts slain')],
    rewards: { xp: 640, gold: toCopper(0, 3, 0) }, next: 'the-defias-brotherhood',
    description: 'The Defias answer with smugglers and lookouts along the ridges. Break their watch on Sentinel Hill.' }),
  q({ id: 'the-defias-brotherhood', name: 'The Defias Brotherhood', zone: 'Westfall',
    giver: 'blacksmith', giverLabel: 'Gryan Stoutmantle', giverBiome: 'steppe', giverTier: 'village',
    level: 14, type: 'kill',
    objectives: [obj('kill', 'brute', 6, 'Defias reavers slain'), obj('kill', 'archer', 6, 'Defias marksmen slain')],
    rewards: { xp: 900, gold: toCopper(0, 5, 0), items: ['gear:gloves'], skillPoints: 1 },
    description: 'The Brotherhood’s reavers gather in force. Strike their war-camps and end the Defias grip on Westfall.' }),
  q({ id: 'red-linen-goods', name: 'Red Linen Goods', zone: 'Westfall',
    giver: 'jeweler', giverLabel: 'Scout Galiaan', giverBiome: 'steppe', giverTier: 'village',
    level: 9, type: 'collect',
    objectives: [obj('collect', 'redLinen', 6, 'Red Linen Bandanas collected', { dropFrom: 'stalker', dropChance: .5 })],
    rewards: { xp: 420, gold: toCopper(0, 1, 80) },
    description: 'Scout Galiaan tracks Defias cells by their red linen bandanas. Collect them from fallen Defias as proof of the Militia’s work.' }),
  // ── Lakeshire (highlands villages stand in for Redridge) ──────────────────
  q({ id: 'the-everstill-bridge', name: 'The Everstill Bridge', zone: 'Redridge Mountains',
    giver: 'blacksmith', giverLabel: 'Foreman Oslow', giverBiome: 'highlands', giverTier: 'village',
    level: 15, type: 'explore',
    objectives: [obj('explore', 'crossing', 1, 'Everstill Bridge inspected')],
    rewards: { xp: 520, gold: toCopper(0, 1, 60) },
    description: 'Foreman Oslow needs the contested crossing at Everstill inspected before repairs can begin. Reach the bridge and survey it.' }),
  q({ id: 'a-baying-of-gnolls', name: 'A Baying of Gnolls', zone: 'Redridge Mountains',
    giver: 'blacksmith', giverLabel: 'Verner Osgood', giverBiome: 'highlands', giverTier: 'village',
    level: 16, type: 'kill',
    objectives: [obj('kill', 'hound', 10, 'Redridge gnolls slain')],
    rewards: { xp: 780, gold: toCopper(0, 3, 40) },
    description: 'Gnoll packs bay through the Redridge night. Verner Osgood wants the hills quiet again — cull the pack.' }),
  q({ id: 'the-price-of-shoes', name: 'The Price of Shoes', zone: 'Redridge Mountains',
    giver: 'blacksmith', giverLabel: 'Verner Osgood', giverBiome: 'highlands', giverTier: 'village',
    level: 17, type: 'collect',
    objectives: [obj('collect', 'toughHide', 4, 'Tough Condor Hides collected', { dropFrom: 'hound', dropChance: .6 })],
    rewards: { xp: 700, gold: toCopper(0, 2, 80) }, next: 'return-to-verner',
    description: 'Verner’s cobblers need tough hides for the garrison’s boots. Hunt the gnoll packs and bring back workable leather.' }),
  q({ id: 'return-to-verner', name: 'Return to Verner', zone: 'Redridge Mountains',
    giver: 'jeweler', giverLabel: 'Messenger', giverBiome: 'highlands',
    turnIn: { role: 'blacksmith', biome: 'highlands', tier: 'village', label: 'Verner Osgood' },
    level: 18, type: 'collect',
    objectives: [],
    rewards: { xp: 380, gold: toCopper(0, 1, 20) },
    description: 'A messenger from the outlying post carries word for Verner Osgood. Return to the smithy in Lakeshire.' }),
  // ── Darkshire (deadwood villages stand in for Duskwood) ───────────────────
  q({ id: 'the-legend-of-stalvan', name: 'The Legend of Stalvan', zone: 'Duskwood',
    giver: 'enchanter', giverLabel: 'Clerk Daltry', giverBiome: 'deadwood', giverTier: 'village',
    level: 22, type: 'explore',
    objectives: [obj('explore', 'graveyard', 1, 'Stalvan’s grave found'), obj('explore', 'ruinedChapel', 1, 'Manor ruins searched')],
    rewards: { xp: 900, gold: toCopper(0, 2, 0) }, next: 'stalvans-reckoning',
    description: 'Clerk Daltry keeps the Darkshire records on Stalvan Mistmantle. Find his grave and search the ruined chapel for the truth.' }),
  q({ id: 'stalvans-reckoning', name: 'Stalvan’s Reckoning', zone: 'Duskwood',
    giver: 'enchanter', giverLabel: 'Clerk Daltry', giverBiome: 'deadwood', giverTier: 'village',
    level: 24, type: 'boss',
    objectives: [obj('boss', 'graveMarshal', 1, 'Stalvan Mistmantle destroyed')],
    rewards: { xp: 1400, gold: toCopper(0, 7, 0), items: ['gear:amulet'], skillPoints: 1 },
    description: 'The records end in blood: Stalvan rises as the Grave Marshal. Put the legend to rest in his lair.' }),
]);

export const QUEST_IDS: readonly QuestId[] = Object.freeze(QUESTS.map(def => def.id));
export const QUEST_BY_ID: Readonly<Record<QuestId, QuestDef>> = Object.freeze(
  Object.fromEntries(QUESTS.map(def => [def.id, def])));
/** Chain prerequisite: quest id → the quest that must be turned in first. */
export const QUEST_PREV: Readonly<Record<QuestId, QuestId>> = Object.freeze(
  Object.fromEntries(QUESTS.filter(def => def.next).map(def => [def.next!, def.id])));

export function isQuestId(v: unknown): v is QuestId {
  return typeof v === 'string' && Object.hasOwn(QUEST_BY_ID, v);
}

/** Normalized giver spec for a quest's offer point (turn-in uses `def.turnIn ?? giverSpec(def)`). */
export function giverSpec(def: QuestDef): QuestGiver {
  return def.giver === 'poi'
    ? { poi: def.giverPoi ?? 'town', biome: def.giverBiome, tier: def.giverTier, label: def.giverLabel }
    : { role: def.giver, biome: def.giverBiome, tier: def.giverTier, label: def.giverLabel };
}
/** Where the quest is completed; defaults to the offer point. */
export function turnInSpec(def: QuestDef): QuestGiver {
  return def.turnIn ?? giverSpec(def);
}
