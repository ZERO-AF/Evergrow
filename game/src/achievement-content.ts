/** Achievement definitions (docs/wow-deepening.md §11).
 * Named after real WotLK achievements; criteria are adapted to Evergrow's
 * mechanics (kill ranks, POI discovery, quest turn-ins, professions, mounts,
 * dungeon/raid clears). Progress lives on `Player.achievements`. */
import type { EnemyKind } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import type { ProfessionId } from './profession-content.ts';
import type { MountId } from './mount-content.ts';
import type { UIIconName } from './ui-icons.ts';

export type AchievementCategory = 'Combat' | 'Exploration' | 'Quests' | 'Professions' | 'Mounts' | 'Dungeons' | 'PvP';

/** How a definition measures progress. `count` is always the threshold to earn. */
export type AchievementCriterion =
  /** Any enemy kill; optional rank/kind narrow it. `boss` matches dungeon + wilderness bosses. */
  | { readonly kind: 'kills'; readonly rank?: EnemyRank; readonly enemyKind?: EnemyKind; readonly boss?: boolean }
  /** Reach a character level (computed from player state). */
  | { readonly kind: 'level' }
  /** Distinct POIs discovered. */
  | { readonly kind: 'places' }
  /** Distinct zones entered. */
  | { readonly kind: 'zones' }
  /** Wilderness events completed. */
  | { readonly kind: 'events' }
  /** Quests turned in; `questType` narrows to a quest type (e.g. 'boss'). */
  | { readonly kind: 'quests'; readonly questType?: string }
  /** Profession skill level. `minProfessions` requires that many professions at `count` skill. */
  | { readonly kind: 'profession'; readonly profession?: ProfessionId; readonly minProfessions?: number }
  /** Gather or craft actions performed. */
  | { readonly kind: 'crafts' }
  /** Fish caught. */
  | { readonly kind: 'fish' }
  /** Fishing skill level (computed from player state). */
  | { readonly kind: 'fishingSkill' }
  /** Distinct mounts summoned. */
  | { readonly kind: 'mounts' }
  /** A specific mount summoned. */
  | { readonly kind: 'mount'; readonly mount: MountId }
  /** Dungeon boss clears (total). */
  | { readonly kind: 'dungeons' }
  /** Distinct dungeons cleared. */
  | { readonly kind: 'distinctDungeons' }
  /** A specific dungeon cleared; matches event id or theme. */
  | { readonly kind: 'dungeonId'; readonly id: string }
  /** Rift guardians defeated. */
  | { readonly kind: 'rifts' }
  /** Raid boss defeated; matches event id. */
  | { readonly kind: 'raid'; readonly id?: string }
  /** Gold balance reached (computed from event balance). */
  | { readonly kind: 'gold' }
  /** PvP matches won (arena + battleground). */
  | { readonly kind: 'pvpWins' }
  /** Honorable kills on enemy PvP combatants. */
  | { readonly kind: 'pvpKills' }
  /** Arena rating reached (computed from the match's post-match rating). */
  | { readonly kind: 'pvpRating' }
  /** PvP match won on a specific map/bracket id (e.g. 'warsong', 'arathi', arena map ids). */
  | { readonly kind: 'pvpMap'; readonly map: string }
  /** Distinct maps won; `prefix` narrows to a map-id family (e.g. 'arena-'). */
  | { readonly kind: 'pvpMaps'; readonly prefix?: string }
  /** Enemy flags personally captured in Warsong Gulch. */
  | { readonly kind: 'pvpFlags' }
  /** Held every Arathi Basin node at once at least once. */
  | { readonly kind: 'pvpNodes' }
  /** Consecutive PvP match wins (resets on a loss). */
  | { readonly kind: 'pvpStreak' }
  /** Total achievements earned (meta). */
  | { readonly kind: 'meta' }
  /** Distinct named rare elites slain (rare rank, unique name per spawn). */
  | { readonly kind: 'distinctRares' };

export interface AchievementDef {
  readonly id: string;
  /** Real WotLK achievement name (adapted criteria). */
  readonly name: string;
  readonly category: AchievementCategory;
  readonly description: string;
  readonly icon: UIIconName;
  readonly criterion: AchievementCriterion;
  /** Threshold to earn. */
  readonly count: number;
}

const def = (id: string, name: string, category: AchievementCategory, description: string, icon: UIIconName, criterion: AchievementCriterion, count: number): AchievementDef =>
  Object.freeze({ id, name, category, description, icon, criterion, count });

export const ACHIEVEMENTS: readonly AchievementDef[] = Object.freeze([
  // ── Combat ──
  def('pest-control', 'Pest Control', 'Combat', 'Slay 100 pests — Kobold Tunnelers, Murlocs, Gnolls and their ilk.', 'sword', { kind: 'kills' }, 100),
  def('medium-rare', 'Medium Rare', 'Combat', 'Defeat an elite enemy.', 'skull', { kind: 'kills', rank: 'elite' }, 1),
  def('northern-exposure', 'Northern Exposure', 'Combat', 'Defeat 25 elite enemies.', 'skull', { kind: 'kills', rank: 'elite' }, 25),
  def('bloody-rare', 'Bloody Rare', 'Combat', 'Defeat 10 different named rare enemies.', 'skull', { kind: 'distinctRares' }, 10),
  def('the-fall-of-naxxramas', 'The Fall of Naxxramas', 'Combat', 'Defeat 10 dungeon and wilderness bosses.', 'skull', { kind: 'kills', boss: true }, 10),
  def('briar-matriarch', 'Briar Matriarch', 'Combat', 'Defeat the Briar Matriarch in her lair.', 'leaf', { kind: 'kills', enemyKind: 'briarMatriarch' }, 1),
  def('ashbound-colossus', 'Ashbound Colossus', 'Combat', 'Defeat the Ashbound Colossus.', 'skull', { kind: 'kills', enemyKind: 'ashColossus' }, 1),
  def('grave-marshal', 'Grave Marshal', 'Combat', 'Defeat the Grave Marshal.', 'shield', { kind: 'kills', enemyKind: 'graveMarshal' }, 1),
  // ── Progression ──
  def('level-10', 'Level 10', 'Exploration', 'Reach level 10.', 'star', { kind: 'level' }, 10),
  def('level-40', 'Level 40', 'Exploration', 'Reach level 40.', 'star', { kind: 'level' }, 40),
  def('level-80', 'Level 80', 'Exploration', 'Reach level 80.', 'star', { kind: 'level' }, 80),
  // ── Exploration ──
  def('explore-kalimdor', 'Explore Kalimdor', 'Exploration', 'Enter 5 different zones.', 'map', { kind: 'zones' }, 5),
  def('world-explorer', 'World Explorer', 'Exploration', 'Discover 15 places.', 'map', { kind: 'places' }, 15),
  def('universal-explorer', 'Universal Explorer', 'Exploration', 'Enter 20 different zones.', 'map', { kind: 'zones' }, 20),
  def('a-simple-re-quest', 'A Simple Re-Quest', 'Exploration', 'Complete 10 wilderness events.', 'star', { kind: 'events' }, 10),
  def('the-bread-winner', 'The Bread Winner', 'Exploration', 'Hold 10,000 gold at once.', 'diamond', { kind: 'gold' }, 10000),
  // ── Quests ──
  def('loremaster-of-kalimdor', 'Loremaster of Kalimdor', 'Quests', 'Complete 5 quests.', 'journal', { kind: 'quests' }, 5),
  def('loremaster-of-eastern-kingdoms', 'Loremaster of Eastern Kingdoms', 'Quests', 'Complete 15 quests.', 'journal', { kind: 'quests' }, 15),
  def('the-loremaster', 'The Loremaster', 'Quests', 'Complete 25 quests.', 'journal', { kind: 'quests' }, 25),
  def('of-blood-and-anguish', 'Of Blood and Anguish', 'Quests', 'Complete a boss quest.', 'skull', { kind: 'quests', questType: 'boss' }, 1),
  // ── Professions ──
  def('professional-journeyman', 'Professional Journeyman', 'Professions', 'Reach 75 skill in a profession.', 'plus', { kind: 'profession' }, 75),
  def('professional-grand-master', 'Professional Grand Master', 'Professions', 'Reach 450 skill in a profession.', 'diamond', { kind: 'profession' }, 450),
  def('skills-to-pay-the-bills', 'Skills to Pay the Bills', 'Professions', 'Reach 150 skill in two professions.', 'plus', { kind: 'profession', minProfessions: 2 }, 150),
  def('the-cake-is-not-a-lie', 'The Cake Is Not A Lie', 'Professions', 'Craft 25 items.', 'potion', { kind: 'crafts' }, 25),
  def('grand-master-fisherman', 'Grand Master Fisherman', 'Professions', 'Reach 450 Fishing skill.', 'center', { kind: 'fishingSkill' }, 450),
  def('the-old-gnome-and-the-sea', 'The Old Gnome and the Sea', 'Professions', 'Catch 100 fish.', 'center', { kind: 'fish' }, 100),
  // ── Mounts ──
  def('stable-keeper', 'Stable Keeper', 'Mounts', 'Obtain 2 mounts.', 'dodge', { kind: 'mounts' }, 2),
  def('leading-the-cavalry', 'Leading the Cavalry', 'Mounts', 'Obtain every mount in the stable.', 'dodge', { kind: 'mounts' }, 4),
  def('awake-the-drakes', 'Awake the Drakes', 'Mounts', 'Take to the skies on the Nether Drake.', 'diamond', { kind: 'mount', mount: 'drake' }, 1),
  // ── Dungeons & raids ──
  def('deadmines', 'Deadmines', 'Dungeons', 'Defeat a dungeon boss.', 'skull', { kind: 'dungeons' }, 1),
  def('classic-dungeonmaster', 'Classic Dungeonmaster', 'Dungeons', 'Clear 3 different dungeons.', 'map', { kind: 'distinctDungeons' }, 3),
  def('northrend-dungeonmaster', 'Northrend Dungeonmaster', 'Dungeons', 'Defeat 10 dungeon bosses.', 'skull', { kind: 'dungeons' }, 10),
  def('blackrock-depths', 'Blackrock Depths', 'Dungeons', 'Clear Blackrock Depths.', 'lantern', { kind: 'dungeonId', id: 'blackrock' }, 1),
  def('tripping-the-rifts', 'Tripping the Rifts', 'Dungeons', 'Defeat a rift guardian before the timer expires.', 'portal', { kind: 'rifts' }, 1),
  def('molten-core', 'Molten Core', 'Dungeons', 'Defeat the raid boss.', 'skull', { kind: 'raid' }, 1),
  // ── PvP ──
  def('first-blood-arena', 'First Blood', 'PvP', 'Win your first arena or battleground match.', 'sword', { kind: 'pvpWins' }, 1),
  def('arena-veteran', 'Arena Veteran', 'PvP', 'Win 10 PvP matches.', 'shield', { kind: 'pvpWins' }, 10),
  def('honorable-kills', 'Honorable Kills', 'PvP', 'Defeat 100 enemy combatants in PvP.', 'skull', { kind: 'pvpKills' }, 100),
  def('warsong-gulch-victory', 'Warsong Gulch Victory', 'PvP', 'Win a Warsong Gulch battleground.', 'map', { kind: 'pvpMap', map: 'warsong' }, 1),
  def('arathi-basin-victory', 'Arathi Basin Victory', 'PvP', 'Win an Arathi Basin battleground.', 'map', { kind: 'pvpMap', map: 'arathi' }, 1),
  def('arena-contender', 'Arena Contender', 'PvP', 'Reach an arena rating of 1600.', 'star', { kind: 'pvpRating' }, 1600),
  def('arena-rival', 'Arena Rival', 'PvP', 'Reach an arena rating of 2000.', 'star', { kind: 'pvpRating' }, 2000),
  def('arena-map-veteran', 'Arena Map Veteran', 'PvP', 'Win on every arena map.', 'map', { kind: 'pvpMaps', prefix: 'arena-' }, 6),
  def('warsong-flag-runner', 'Warsong Flag Runner', 'PvP', 'Capture the enemy flag in Warsong Gulch.', 'map', { kind: 'pvpFlags' }, 1),
  def('warsong-expedience', 'Warsong Expedience', 'PvP', 'Capture 10 flags in Warsong Gulch.', 'map', { kind: 'pvpFlags' }, 10),
  def('arathi-perfection', 'Arathi Perfection', 'PvP', 'Hold all five Arathi Basin nodes at once.', 'shield', { kind: 'pvpNodes' }, 1),
  def('hot-streak', 'Hot Streak', 'PvP', 'Win 3 PvP matches in a row.', 'star', { kind: 'pvpStreak' }, 3),
  // ── Meta ──
  def('what-a-long-strange-trip', "What a Long, Strange Trip It's Been", 'Exploration', 'Earn 20 achievements. The Nether Drake answers only to proven heroes.', 'star', { kind: 'meta' }, 20),
]);

export const ACHIEVEMENT_BY_ID: Readonly<Record<string, AchievementDef>> = Object.freeze(
  Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a])));

export const ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = Object.freeze(
  [...new Set(ACHIEVEMENTS.map(a => a.category))]);

export function isAchievementId(value: unknown): value is string {
  return typeof value === 'string' && Object.hasOwn(ACHIEVEMENT_BY_ID, value);
}
