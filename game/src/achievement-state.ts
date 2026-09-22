/** Achievement progress + unlock tracking (docs/wow-deepening.md §11).
 *
 * Storage on `player.achievements` (Record<string, number>):
 * - `achievements[def.id]` — progress count, or a unix-seconds completion
 *   timestamp once earned. Values >= COMPLETED_SENTINEL mean "earned".
 * - `achievements['seen:<set>:<id>']` — dedupe markers (1) for set-based
 *   criteria: seen:poi:, seen:zone:, seen:mount:, seen:dungeon:.
 *
 * `achievementTrack` is the single entry point: feed it CombatEvents from the
 * simulation drain plus feature events (explore/zone/quest/gather/craft/fish/
 * mount/dungeon/raid/snapshot). It mutates the ledger and returns the defs
 * unlocked by this call so the caller can toast them. */
import { ACHIEVEMENTS, type AchievementDef } from './achievement-content.ts';
import { isBossKind } from './wilderness-boss-content.ts';
import { enemyDisplayName } from './zone-roster.ts';
import type { CombatEvent, Enemy, Player } from './model.ts';
import type { POIKind } from './world-pois.ts';
import type { ProfessionId } from './profession-content.ts';
import type { MountId } from './mount-content.ts';

/** Completion timestamps are unix seconds (~1.8e9); progress counts stay far below. */
const COMPLETED_SENTINEL = 1e9;

/** Feature events beyond the simulation's CombatEvent union. */
export type AchievementEvent = CombatEvent
  | { readonly type: 'explore'; readonly id: string; readonly poiKind?: POIKind }
  | { readonly type: 'zone'; readonly id: string }
  | { readonly type: 'event-complete'; readonly id: string }
  | { readonly type: 'quest'; readonly id: string; readonly questType?: string }
  | { readonly type: 'gather'; readonly profession: ProfessionId }
  | { readonly type: 'craft'; readonly profession: ProfessionId }
  | { readonly type: 'fish' }
  | { readonly type: 'mount'; readonly mount: MountId }
  | { readonly type: 'dungeon'; readonly id: string; readonly theme?: string }
  | { readonly type: 'raid'; readonly id: string }
  /** PvP match settled (pvp-rewards.ts): win/loss, honorable kills, post-match
   * rating, the map/bracket id, the player's flag captures and whether their
   * team ever held every node. */
  | { readonly type: 'pvp-match'; readonly won: boolean; readonly kills?: number; readonly rating?: number; readonly map?: string; readonly flagCaptures?: number; readonly heldAllNodes?: boolean }
  | { readonly type: 'snapshot' };

export function achievementComplete(record: Readonly<Record<string, number>> | undefined, id: string): boolean {
  return (record?.[id] ?? 0) >= COMPLETED_SENTINEL;
}

/** Earned achievements among the known definitions. */
export function achievementEarnedCount(record: Readonly<Record<string, number>> | undefined): number {
  if (!record) return 0;
  let earned = 0;
  for (const a of ACHIEVEMENTS) if (achievementComplete(record, a.id)) earned++;
  return earned;
}

const markerCount = (record: Readonly<Record<string, number>> | undefined, prefix: string): number => {
  if (!record) return 0;
  let n = 0;
  for (const key of Object.keys(record)) if (key.startsWith(prefix) && record[key] > 0) n++;
  return n;
};

const professionsAt = (player: Player, level: number): number => {
  if (!player.professions) return 0;
  let n = 0;
  for (const p of Object.values(player.professions)) if (p && p.level >= level) n++;
  return n;
};

/** Current progress toward a definition. `value >= target` means earned. */
export function achievementProgress(a: AchievementDef, player: Player): { value: number; target: number } {
  const c = a.criterion, record = player.achievements;
  if (achievementComplete(record, a.id)) return { value: a.count, target: a.count };
  switch (c.kind) {
    case 'level': return { value: player.level, target: a.count };
    case 'places': return { value: markerCount(record, 'seen:poi:'), target: a.count };
    case 'zones': return { value: markerCount(record, 'seen:zone:'), target: a.count };
    case 'profession': {
      if (c.minProfessions) return { value: professionsAt(player, a.count), target: c.minProfessions };
      if (c.profession) return { value: player.professions?.[c.profession]?.level ?? 0, target: a.count };
      let best = 0;
      for (const p of Object.values(player.professions ?? {})) if (p && p.level > best) best = p.level;
      return { value: best, target: a.count };
    }
    case 'fishingSkill': return { value: player.fishing?.level ?? 0, target: a.count };
    case 'mounts': return { value: markerCount(record, 'seen:mount:'), target: a.count };
    case 'distinctDungeons': return { value: markerCount(record, 'seen:dungeon:'), target: a.count };
    case 'pvpMaps': return { value: markerCount(record, `seen:pvpmap:${c.prefix ?? ''}`), target: a.count };
    case 'distinctRares': return { value: markerCount(record, 'seen:rare:'), target: a.count };
    case 'pvpStreak': return { value: Math.min(record?.['pvp:streak'] ?? 0, a.count), target: a.count };
    case 'meta': return { value: achievementEarnedCount(record), target: a.count };
    default: {
      const stored = record?.[a.id] ?? 0;
      return { value: Math.min(stored, a.count), target: a.count };
    }
  }
}

/** Feed one event into the ledger; returns defs unlocked by this call. */
export function achievementTrack(player: Player, event: AchievementEvent, enemies: readonly Enemy[] = [], now = Date.now()): AchievementDef[] {
  const record = player.achievements ??= {};
  const stamp = Math.max(COMPLETED_SENTINEL, Math.floor(now / 1000));
  const bump = (a: AchievementDef, amount = 1) => {
    if (achievementComplete(record, a.id)) return;
    record[a.id] = Math.min(a.count, (record[a.id] ?? 0) + amount);
  };
  const mark = (key: string) => { if (!record[key]) record[key] = 1; };

  switch (event.type) {
    case 'kill': {
      const enemy = enemies.find(e => e.id === event.targetId);
      const riftWarden = enemy?.campMemberId === 'warden' && !!enemy.campId?.startsWith('dungeon:rift:');
      if (enemy?.rank === 'rare') mark(`seen:rare:${enemyDisplayName(enemy)}`);
      for (const a of ACHIEVEMENTS) {
        const c = a.criterion;
        if (c.kind === 'kills'
          && (!c.rank || enemy?.rank === c.rank)
          && (!c.enemyKind || event.enemyKind === c.enemyKind)
          && (!c.boss || isBossKind(event.enemyKind))) bump(a);
        else if (c.kind === 'rifts' && riftWarden) bump(a);
      }
      break;
    }
    case 'gold':
      for (const a of ACHIEVEMENTS)
        if (a.criterion.kind === 'gold' && !achievementComplete(record, a.id))
          record[a.id] = Math.max(record[a.id] ?? 0, Math.min(a.count, event.balance));
      break;
    case 'explore': mark(`seen:poi:${event.id}`); break;
    case 'zone': mark(`seen:zone:${event.id}`); break;
    case 'event-complete':
      for (const a of ACHIEVEMENTS) if (a.criterion.kind === 'events') bump(a);
      break;
    case 'quest':
      for (const a of ACHIEVEMENTS) {
        const c = a.criterion;
        if (c.kind === 'quests' && (!c.questType || c.questType === event.questType)) bump(a);
      }
      break;
    case 'gather': case 'craft':
      for (const a of ACHIEVEMENTS) if (a.criterion.kind === 'crafts') bump(a);
      break;
    case 'fish':
      for (const a of ACHIEVEMENTS) if (a.criterion.kind === 'fish') bump(a);
      break;
    case 'mount': {
      mark(`seen:mount:${event.mount}`);
      for (const a of ACHIEVEMENTS) {
        const c = a.criterion;
        if (c.kind === 'mount' && c.mount === event.mount) bump(a);
      }
      break;
    }
    case 'dungeon': {
      mark(`seen:dungeon:${event.id}`);
      for (const a of ACHIEVEMENTS) {
        const c = a.criterion;
        if (c.kind === 'dungeons') bump(a);
        else if (c.kind === 'dungeonId' && (c.id === event.id || c.id === event.theme)) bump(a);
      }
      break;
    }
    case 'raid':
      for (const a of ACHIEVEMENTS) {
        const c = a.criterion;
        if (c.kind === 'raid' && (!c.id || c.id === event.id)) bump(a);
      }
      break;
    case 'pvp-match': {
      if (event.won && event.map) mark(`seen:pvpmap:${event.map}`);
      // The win streak is a live counter: losses reset it, wins grow it.
      record['pvp:streak'] = event.won ? (record['pvp:streak'] ?? 0) + 1 : 0;
      for (const a of ACHIEVEMENTS) {
        const c = a.criterion;
        if (c.kind === 'pvpWins' && event.won) bump(a);
        else if (c.kind === 'pvpMap' && event.won && c.map === event.map) bump(a);
        else if (c.kind === 'pvpKills' && event.kills) bump(a, event.kills);
        else if (c.kind === 'pvpFlags' && event.flagCaptures) bump(a, event.flagCaptures);
        else if (c.kind === 'pvpNodes' && event.heldAllNodes) bump(a);
        else if (c.kind === 'pvpRating' && event.rating !== undefined && !achievementComplete(record, a.id))
          record[a.id] = Math.max(record[a.id] ?? 0, Math.min(a.count, event.rating));
      }
      break;
    }
  }

  // Uniform completion pass: counters bumped above plus computed criteria
  // (level, profession, fishing, sets, meta) all resolve through progress.
  const unlocked: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (achievementComplete(record, a.id)) continue;
    const { value, target } = achievementProgress(a, player);
    if (value >= target) { record[a.id] = stamp; unlocked.push(a); }
  }
  return unlocked;
}
