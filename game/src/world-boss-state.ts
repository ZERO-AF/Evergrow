/** World boss respawn ledger (world-boss-content.ts owns the defs).
 *
 * Persisted on the character checkpoint as `worldBosses`: one `killedAt`
 * sim-time stamp per boss id. A boss is alive when `now - killedAt` exceeds
 * its respawn window; a boss never killed has no entry and is always alive.
 * Entries are never pruned — the ledger is bounded by WORLD_BOSS_IDS (4).
 *
 * Self-healing like worldEvents: malformed or absent data restarts empty. */
import { isWorldBossId, worldBossRespawnMs, WORLD_BOSSES, type WorldBossId } from './world-boss-content.ts';
import { object, number } from './item-validation.ts';

export interface WorldBossLedger {
  /** Boss id → sim time of the last kill. */
  killedAt: Partial<Record<WorldBossId, number>>;
}

export const freshWorldBossLedger = (): WorldBossLedger => ({ killedAt: {} });

/** True when the boss is off cooldown and may stand at its lair. */
export function worldBossAlive(ledger: WorldBossLedger, id: WorldBossId, now: number): boolean {
  const killedAt = ledger.killedAt[id];
  return killedAt === undefined || !Number.isFinite(killedAt) || now - killedAt >= worldBossRespawnMs(WORLD_BOSSES[id]);
}

/** Sim seconds until the boss respawns; 0 when it is already up. */
export function worldBossRespawnIn(ledger: WorldBossLedger, id: WorldBossId, now: number): number {
  const killedAt = ledger.killedAt[id];
  if (killedAt === undefined || !Number.isFinite(killedAt)) return 0;
  return Math.max(0, killedAt + worldBossRespawnMs(WORLD_BOSSES[id]) - now);
}

/** Stamp a kill. Returns false for unknown ids or non-finite times so the
 * kill path can ignore stray actors. */
export function recordWorldBossKill(ledger: WorldBossLedger, id: WorldBossId, now: number): boolean {
  if (!isWorldBossId(id) || !Number.isFinite(now)) return false;
  ledger.killedAt[id] = now;
  return true;
}

export function validWorldBossLedger(v: unknown): v is WorldBossLedger {
  if (!object(v) || !object(v.killedAt)) return false;
  return Object.entries(v.killedAt).every(([id, at]) => isWorldBossId(id) && number(at, 0, 1e12));
}
