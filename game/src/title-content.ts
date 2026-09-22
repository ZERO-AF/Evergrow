/** Player title definitions (docs/wow-deepening.md — identity wave).
 * Named after real WotLK titles; sources are adapted to Evergrow's mechanics
 * (achievement ledger, reputation standings, quest turn-ins, arena rating).
 * The equipped title id lives on `CharacterSheet.title`; derivation and
 * formatting live in title-state.ts. */
import type { FactionId, StandingTier } from './reputation-content.ts';
import type { PlayerFaction } from './wow-types.ts';

/** How a title is earned. `achievement` reads the completion sentinel on
 * `player.achievements`; `reputation` requires every listed faction at
 * `standing` or better; `exalted` counts factions at Exalted; `quest` reads a
 * turned-in receipt on `player.quests`; `level`/`pvpRating` read the sheet. */
export type TitleSource =
  | { readonly kind: 'achievement'; readonly id: string }
  | { readonly kind: 'reputation'; readonly factions: readonly FactionId[]; readonly standing: StandingTier }
  | { readonly kind: 'exalted'; readonly count: number }
  | { readonly kind: 'quest'; readonly id: string }
  | { readonly kind: 'level'; readonly level: number }
  | { readonly kind: 'pvpRating'; readonly rating: number };

export interface TitleDef {
  readonly id: string;
  /** Display template: `%s` marks where the character name lands. */
  readonly name: string;
  /** Whether the title rides before ('Jenkins %s') or after ('%s the Explorer') the name. */
  readonly format: 'prefix' | 'suffix';
  /** What earns the title. */
  readonly source: TitleSource;
  /** Player-facing description of the source, for pickers and tooltips. */
  readonly description: string;
  /** Restricts the title to one war faction (Alliance/Horde); absent = either. */
  readonly faction?: PlayerFaction;
}

const def = (id: string, name: string, format: 'prefix' | 'suffix', source: TitleSource, description: string, faction?: PlayerFaction): TitleDef =>
  Object.freeze({ id, name, format, source, description, ...(faction ? { faction } : {}) });

export const TITLES: readonly TitleDef[] = Object.freeze([
  // ── Exploration ──
  def('the-explorer', '%s the Explorer', 'suffix',
    { kind: 'achievement', id: 'universal-explorer' },
    'Earn the Universal Explorer achievement (enter 20 different zones).'),
  def('the-seeker', '%s the Seeker', 'suffix',
    { kind: 'achievement', id: 'the-loremaster' },
    'Earn the Loremaster achievement (complete 25 quests).'),
  def('the-patient', '%s the Patient', 'suffix',
    { kind: 'achievement', id: 'northrend-dungeonmaster' },
    'Earn the Northrend Dungeonmaster achievement (defeat 10 dungeon bosses).'),
  // ── Combat & dungeons ──
  def('jenkins', 'Jenkins %s', 'prefix',
    { kind: 'achievement', id: 'pest-control' },
    'Earn the Pest Control achievement (slay 100 pests). Leeeroy!'),
  def('the-lich-slayer', '%s the Lich Slayer', 'suffix',
    { kind: 'achievement', id: 'grave-marshal' },
    'Defeat the Grave Marshal.'),
  def('the-undying', '%s the Undying', 'suffix',
    { kind: 'achievement', id: 'the-fall-of-naxxramas' },
    'Earn the Fall of Naxxramas achievement (defeat 10 dungeon and wilderness bosses).'),
  def('the-kingslayer', '%s the Kingslayer', 'suffix',
    { kind: 'achievement', id: 'molten-core' },
    'Earn the Molten Core achievement (defeat the raid boss).'),
  def('champion-of-the-frozen-wastes', '%s, Champion of the Frozen Wastes', 'suffix',
    { kind: 'achievement', id: 'outdoor-raider' },
    'Earn the Outdoor Raider achievement (defeat all four outdoor world bosses).'),
  def('of-the-nightfall', '%s of the Nightfall', 'suffix',
    { kind: 'achievement', id: 'tripping-the-rifts' },
    'Earn the Tripping the Rifts achievement (defeat a rift guardian before the timer expires).'),
  def('the-twilight-vanquisher', '%s, the Twilight Vanquisher', 'suffix',
    { kind: 'achievement', id: 'classic-dungeonmaster' },
    'Earn the Classic Dungeonmaster achievement (clear 3 different dungeons).'),
  def('the-hallowed', '%s the Hallowed', 'suffix',
    { kind: 'quest', id: 'cleansing-felwood' },
    'Turn in the Cleansing Felwood quest.'),
  def('the-merrymaker', '%s the Merrymaker', 'suffix',
    { kind: 'achievement', id: 'a-simple-re-quest' },
    'Earn the A Simple Re-Quest achievement (complete 10 wilderness events).'),
  def('the-noble', '%s the Noble', 'suffix',
    { kind: 'quest', id: 'keepers-of-the-glade' },
    'Turn in the Keepers of the Glade quest in Moonglade.'),
  // ── Reputation ──
  def('the-argent-champion', '%s the Argent Champion', 'suffix',
    { kind: 'reputation', factions: ['argentCrusade'], standing: 'exalted' },
    'Reach Exalted with the Argent Crusade.'),
  def('the-diplomat', '%s the Diplomat', 'suffix',
    { kind: 'reputation', factions: ['timbermawHold', 'cenarionCircle', 'thoriumBrotherhood'], standing: 'revered' },
    'Reach Revered with Timbermaw Hold, the Cenarion Circle and the Thorium Brotherhood.'),
  def('the-insane', '%s the Insane', 'suffix',
    { kind: 'reputation', factions: ['steamwheedleCartel', 'thoriumBrotherhood'], standing: 'exalted' },
    'Reach Exalted with the Steamwheedle Cartel and the Thorium Brotherhood.'),
  def('of-the-ashen-verdict', '%s of the Ashen Verdict', 'suffix',
    { kind: 'reputation', factions: ['sonsOfHodir'], standing: 'exalted' },
    'Reach Exalted with the Sons of Hodir.'),
  def('the-stormpike', '%s the Stormpike', 'suffix',
    { kind: 'reputation', factions: ['stormwind'], standing: 'exalted' },
    'Reach Exalted with Stormwind.', 'alliance'),
  def('the-frostwolf', '%s the Frostwolf', 'suffix',
    { kind: 'reputation', factions: ['warsong'], standing: 'exalted' },
    'Reach Exalted with the Warsong Outriders.', 'horde'),
  def('the-exalted', '%s the Exalted', 'suffix',
    { kind: 'exalted', count: 5 },
    'Reach Exalted with 5 factions.'),
  // ── PvP ──
  def('of-the-alliance', '%s of the Alliance', 'suffix',
    { kind: 'achievement', id: 'honorable-kills' },
    'Earn the Honorable Kills achievement (defeat 100 enemy combatants in PvP).', 'alliance'),
  def('of-the-horde', '%s of the Horde', 'suffix',
    { kind: 'achievement', id: 'honorable-kills' },
    'Earn the Honorable Kills achievement (defeat 100 enemy combatants in PvP).', 'horde'),
  def('the-bloodthirsty', '%s the Bloodthirsty', 'suffix',
    { kind: 'achievement', id: 'honorable-kills' },
    'Earn the Honorable Kills achievement (defeat 100 enemy combatants in PvP).'),
  def('arena-master', 'Arena Master %s', 'prefix',
    { kind: 'pvpRating', rating: 2000 },
    'Reach an arena rating of 2000.'),
  // ── Fortune & craft ──
  def('the-wealthy', '%s the Wealthy', 'suffix',
    { kind: 'achievement', id: 'the-bread-winner' },
    'Earn the Bread Winner achievement (hold 10,000 gold at once).'),
  def('the-master-angler', '%s the Master Angler', 'suffix',
    { kind: 'achievement', id: 'grand-master-fisherman' },
    'Earn the Grand Master Fisherman achievement (reach 450 Fishing skill).'),
]);

export const TITLE_BY_ID: Readonly<Record<string, TitleDef>> = Object.freeze(
  Object.fromEntries(TITLES.map(t => [t.id, t])));

export function isTitleId(value: unknown): value is string {
  return typeof value === 'string' && Object.hasOwn(TITLE_BY_ID, value);
}
