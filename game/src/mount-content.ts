/** Mount definitions (docs/wow-deepening.md §2).
 *
 * `unlock` describes how the mount enters the stable:
 * - `flag` — a `mount:<id>` marker on the achievement ledger, set by
 *   `grantMount` (vendor purchases, rare drops, quest rewards).
 * - `achievement` — earned once the named achievement completes.
 * - `profession`/`reputation`/`fishing` — computed from live player state.
 * `art` picks the silhouette family mount-art draws. */
import type { FactionId, StandingTier } from './reputation-content.ts';
import type { ProfessionId } from './profession-content.ts';

export type MountId =
  | 'horse' | 'wolf' | 'ram' | 'drake'
  | 'raptor' | 'polarBear' | 'spectralSteed' | 'mammoth'
  | 'carpet' | 'chopper' | 'turtle' | 'protoDrake';

export type MountUnlock =
  | { readonly kind: 'always' }
  | { readonly kind: 'flag' }
  | { readonly kind: 'achievement'; readonly achievement: string }
  | { readonly kind: 'profession'; readonly profession: ProfessionId; readonly level: number }
  | { readonly kind: 'reputation'; readonly faction: FactionId; readonly standing: StandingTier }
  | { readonly kind: 'fishing'; readonly level: number };

/** Silhouette family: quadruped baseline, horned (ram/bear), winged drake,
 * hovering carpet, or the two-wheeled chopper. */
export type MountArt = 'horse' | 'wolf' | 'ram' | 'drake' | 'bear' | 'carpet' | 'machine' | 'turtle';

export interface MountDef {
  readonly id: MountId;
  readonly name: string;
  /** Movement speed multiplier while mounted. */
  readonly speed: number;
  /** Saddle/body tint for the procedural mount art. */
  readonly tint: string;
  readonly accent: string;
  readonly art: MountArt;
  readonly unlock: MountUnlock;
  /** One-line "how to get it" shown on locked stable rows. */
  readonly source: string;
}

const def = (d: MountDef): MountDef => Object.freeze(d);

export const MOUNTS: Readonly<Record<MountId, MountDef>> = Object.freeze({
  horse: def({ id: 'horse', name: 'Brown Horse', speed: 1.6, tint: '#6b4a33', accent: '#3a2a20',
    art: 'horse', unlock: { kind: 'always' }, source: 'Stable master' }),
  wolf: def({ id: 'wolf', name: 'Dire Wolf', speed: 1.6, tint: '#5a5f66', accent: '#2e3238',
    art: 'wolf', unlock: { kind: 'always' }, source: 'Stable master' }),
  ram: def({ id: 'ram', name: 'Gray Ram', speed: 1.6, tint: '#7d7a72', accent: '#45423c',
    art: 'ram', unlock: { kind: 'always' }, source: 'Stable master' }),
  drake: def({ id: 'drake', name: 'Nether Drake', speed: 2.0, tint: '#5a4a7a', accent: '#2e2444',
    art: 'drake', unlock: { kind: 'flag' }, source: 'Raid drop / PvP quartermaster' }),
  raptor: def({ id: 'raptor', name: 'Swift Raptor', speed: 1.8, tint: '#4a6a3a', accent: '#2e4426',
    art: 'wolf', unlock: { kind: 'flag' }, source: 'Stable master — premium stock' }),
  polarBear: def({ id: 'polarBear', name: 'White Polar Bear', speed: 1.8, tint: '#d8dce2', accent: '#8a929e',
    art: 'bear', unlock: { kind: 'flag' }, source: 'Rare drop in the frozen wilds' }),
  spectralSteed: def({ id: 'spectralSteed', name: 'Spectral Steed', speed: 1.9, tint: '#7a8a9e', accent: '#b8d4e8',
    art: 'horse', unlock: { kind: 'achievement', achievement: 'the-loremaster' },
    source: 'Achievement: The Loremaster' }),
  mammoth: def({ id: 'mammoth', name: "Traveler's Mammoth", speed: 1.7, tint: '#8a6a4a', accent: '#5a4430',
    art: 'bear', unlock: { kind: 'reputation', faction: 'sonsOfHodir', standing: 'revered' },
    source: 'Sons of Hodir: Revered' }),
  carpet: def({ id: 'carpet', name: 'Magnificent Flying Carpet', speed: 2.0, tint: '#7a3a5a', accent: '#c9a44a',
    art: 'carpet', unlock: { kind: 'profession', profession: 'enchanting', level: 300 },
    source: 'Crafted: Enchanting 300' }),
  chopper: def({ id: 'chopper', name: 'Mekgineer\'s Chopper', speed: 1.9, tint: '#5a5a62', accent: '#c97a3a',
    art: 'machine', unlock: { kind: 'profession', profession: 'engineering', level: 450 },
    source: 'Crafted: Engineering 450' }),
  turtle: def({ id: 'turtle', name: 'Riding Turtle', speed: 1.4, tint: '#4a6a52', accent: '#8aa86a',
    art: 'turtle', unlock: { kind: 'fishing', level: 300 }, source: 'Fishing skill 300' }),
  protoDrake: def({ id: 'protoDrake', name: 'Red Proto-Drake', speed: 2.1, tint: '#8a3a3a', accent: '#4a2020',
    art: 'drake', unlock: { kind: 'achievement', achievement: 'northrend-dungeonmaster' },
    source: 'Achievement: Northrend Dungeonmaster' }),
});
export const MOUNT_IDS: readonly MountId[] = Object.freeze(Object.keys(MOUNTS) as MountId[]);
export function isMountId(v: unknown): v is MountId { return typeof v === 'string' && v in MOUNTS; }
