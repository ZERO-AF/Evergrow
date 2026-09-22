import type { CharacterSheet } from './character-types.ts';
import type { RiftLedger } from './rift-content.ts';
import { deriveItem } from './items.ts';
export type LeaderboardOrder = 'level' | 'gear' | 'rift';
export interface LeaderboardEntry { rank: number; name: string; level: number; gearPower: number | null; riftTier: number | null; riftSeconds: number | null; updatedAt: number; mine: boolean; }
export interface LeaderboardSnapshot { entries: LeaderboardEntry[]; own: LeaderboardEntry[]; signedIn: boolean; total: number; updating?: boolean; }
/** Eleven occupied slot equivalents. A two-handed weapon fills both hand slots;
 * empty slots contribute zero. Rebuild recipe scores instead of trusting stored power. */
export function equippedGearPower(sheet: Pick<CharacterSheet, 'equipped'>): number {
  let total=0;
  for(const [slot,item] of Object.entries(sheet.equipped)) {
    if(!item)continue;
    total+=deriveItem(item).power*(slot==='weapon'&&item.weapon?.hands===2?2:1);
  }
  return Math.round(total/11);
}

/** Highest cleared key tier, tie-broken by that tier's fastest clear. Unkeyed clears rank as tier 0. */
export function bestRiftClear(ledger:RiftLedger|undefined):{tier:number;seconds:number}|null {
  if(!ledger||!ledger.best.length)return null;
  const top=ledger.best.reduce((a,b)=>b.keyTier>a.keyTier||(b.keyTier===a.keyTier&&b.seconds<a.seconds)?b:a);
  return {tier:top.keyTier,seconds:top.seconds};
}
