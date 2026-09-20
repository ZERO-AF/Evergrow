/** Combat/system log ring (docs/wow-deepening.md §8). */
export type CombatLogKind = 'damage' | 'heal' | 'xp' | 'loot' | 'death' | 'quest' | 'level' | 'system' | 'discovery';
export interface CombatLogEntry {
  readonly kind: CombatLogKind;
  readonly text: string;
  readonly time: number;
}
export const COMBAT_LOG_CAP = 40;
/** Append an entry, keeping the ring bounded. */
export function pushCombatLog(log: CombatLogEntry[] | undefined, entry: CombatLogEntry): CombatLogEntry[] {
  const next = log ? [...log, entry] : [entry];
  return next.length > COMBAT_LOG_CAP ? next.slice(next.length - COMBAT_LOG_CAP) : next;
}
