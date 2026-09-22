import type { CloudEnv } from './worker.ts';
import type { CharacterSheet } from '../src/character-types.ts';
import { EQUIPMENT_SLOTS } from '../src/items.ts';
import { object, validItem } from '../src/item-validation.ts';
import { itemFitsSlot } from '../src/inventory.ts';
import { bestRiftClear, equippedGearPower } from '../src/leaderboard.ts';
import { SAVE_BUNDLE_LIMIT } from '../src/save-bundle.ts';
import { validRiftLedger, type RiftLedger } from '../src/rift-content.ts';

/** Read only equipment: unrelated historical world/chart versions must not block a score. */
export function savedGearPower(raw: string): number | null {
  if (raw.length > SAVE_BUNDLE_LIMIT) return null;
  try {
    const bundle = JSON.parse(raw);
    const equipped: unknown = bundle?.character?.checkpoint?.character?.equipped;
    if (bundle?.format !== 'evergrow' || bundle.version !== 1 || !object(equipped)
      || Object.keys(equipped).length !== EQUIPMENT_SLOTS.length
      || !EQUIPMENT_SLOTS.every(slot => equipped[slot] === null || validItem(equipped[slot]) && itemFitsSlot(equipped[slot], slot))) return null;
    return equippedGearPower({ equipped: equipped as CharacterSheet['equipped'] });
  } catch { return null; }
}

/** Read only the rift ledger: unrelated historical world/chart versions must not block a score.
 * A readable save with no clears scores -1 so the row stops being eligible; NULL retries later. */
export function savedRiftClear(raw: string): { tier: number; seconds: number } | null {
  if (raw.length > SAVE_BUNDLE_LIMIT) return null;
  try {
    const bundle = JSON.parse(raw);
    const rifts: unknown = bundle?.character?.checkpoint?.expeditions?.rifts;
    if (bundle?.format !== 'evergrow' || bundle.version !== 1 || (rifts !== undefined && !validRiftLedger(rifts))) return null;
    return bestRiftClear(rifts as RiftLedger | undefined) ?? { tier: -1, seconds: -1 };
  } catch { return null; }
}

const BATCH_SIZE = 8, RETRY_AFTER = 5 * 60 * 1000;
/** Bounded lazy migration. Claims avoid duplicate reads; revision/object guards protect live saves. */
export async function backfillRankings(env: CloudEnv, now = Date.now()): Promise<boolean> {
  const cutoff = now - RETRY_AFTER;
  const eligible = 'object IS NOT NULL AND rank_name IS NOT NULL AND ((rank_gear IS NULL AND (rank_gear_checked_at IS NULL OR rank_gear_checked_at < ?)) OR (rank_rift IS NULL AND (rank_rift_checked_at IS NULL OR rank_rift_checked_at < ?)))';
  const { results } = await env.DB.prepare(`SELECT owner,slot,revision,object FROM characters WHERE ${eligible} ORDER BY owner,slot LIMIT ?`)
    .bind(cutoff, cutoff, BATCH_SIZE).all<{owner:string;slot:number;revision:number;object:string}>();
  // At most two full save objects in flight, irrespective of account or roster size.
  for (let i = 0; i < results.length; i += 2) await Promise.all(results.slice(i, i + 2).map(async row => {
    const claim = await env.DB.prepare(`UPDATE characters SET rank_gear_checked_at=?, rank_rift_checked_at=? WHERE owner=? AND slot=? AND revision=? AND object=? AND ${eligible}`)
      .bind(now,now,row.owner,row.slot,row.revision,row.object,cutoff,cutoff).run();
    if (!claim.meta.changes) return;
    try {
      const blob = await env.SAVES.get(row.object);
      const raw = blob ? await blob.text() : '';
      const power = blob ? savedGearPower(raw) : null, clear = blob ? savedRiftClear(raw) : null;
      if (power === null && clear === null) return;
      await env.DB.prepare(`UPDATE characters SET rank_gear=CASE WHEN rank_gear IS NULL THEN ? ELSE rank_gear END, rank_rift=CASE WHEN rank_rift IS NULL THEN ? ELSE rank_rift END, rank_rift_seconds=CASE WHEN rank_rift_seconds IS NULL THEN ? ELSE rank_rift_seconds END WHERE owner=? AND slot=? AND revision=? AND object=?`)
        .bind(power,clear?.tier??null,clear?.seconds??null,row.owner,row.slot,row.revision,row.object).run();
    } catch { /* Retry unavailable objects later; never rewrite or reject the character save. */ }
  }));
  return !!await env.DB.prepare(`SELECT 1 AS pending FROM characters WHERE ${eligible} LIMIT 1`).bind(cutoff,cutoff).first();
}
