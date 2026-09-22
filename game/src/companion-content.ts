/** Vanity companion pets (docs/wow-deepening.md §2 lineage): collectible,
 * non-combat critters that follow the player. One may be summoned at a time.
 *
 * Persistence rides the achievement ledger (`player.achievements`): owned
 * companions are `seen:companion:<id>` markers and the summoned pick is the
 * `companion:active` numeric token — both already validated by
 * character-save.ts, so no CharacterSheet field is required.
 *
 * COMPANION_IDS order is persisted (the active pick stores the index); only
 * ever append new companions. */
import type { FactionId, StandingTier } from './reputation-content.ts';
import type { ProfessionId } from './profession-content.ts';

export type CompanionId =
  | 'squirrel' | 'worg-pup' | 'phoenix' | 'mini-diablo' | 'wisp' | 'penguin'
  | 'snapjaw' | 'core-hound-pup' | 'wolvar-pup' | 'crate-rat' | 'sprite-darter' | 'proto-whelp';

/** Silhouette family the companion art picks from. */
export type CompanionShape = 'quad' | 'critter' | 'bird' | 'floater' | 'imp';

/** How the companion enters the collection. `vendor`/`drop` sources are
 * granted by their host systems via `grantCompanion`; the rest are evaluated
 * from player state by `syncCompanions`. */
export type CompanionSource =
  | { readonly kind: 'vendor' }
  | { readonly kind: 'drop' }
  | { readonly kind: 'achievement'; readonly achievement: string }
  | { readonly kind: 'profession'; readonly profession: ProfessionId; readonly level: number }
  | { readonly kind: 'reputation'; readonly faction: FactionId; readonly standing: StandingTier }
  | { readonly kind: 'fishing'; readonly level: number };

export interface CompanionDef {
  readonly id: CompanionId;
  readonly name: string;
  readonly shape: CompanionShape;
  readonly tint: string;
  readonly accent: string;
  readonly source: CompanionSource;
  /** One-line "how to get it" shown on locked collection rows. */
  readonly sourceLabel: string;
  readonly flavor: string;
}

const def = (d: CompanionDef): CompanionDef => Object.freeze(d);

export const COMPANIONS: Readonly<Record<CompanionId, CompanionDef>> = Object.freeze({
  'squirrel': def({ id: 'squirrel', name: 'Mechanical Squirrel', shape: 'critter', tint: '#8a7a5a', accent: '#c9a86a',
    source: { kind: 'profession', profession: 'engineering', level: 75 },
    sourceLabel: 'Crafted: Engineering 75', flavor: 'Winds itself. Occasionally winds down mid-hop.' }),
  'worg-pup': def({ id: 'worg-pup', name: 'Worg Pup', shape: 'quad', tint: '#5a5f66', accent: '#2e3238',
    source: { kind: 'drop' }, sourceLabel: 'Rare drop from worgs', flavor: 'Too small to howl. Tries anyway.' }),
  'phoenix': def({ id: 'phoenix', name: 'Phoenix Hatchling', shape: 'bird', tint: '#e08a3c', accent: '#f4c95d',
    source: { kind: 'drop' }, sourceLabel: 'Rare drop from fire elementals', flavor: 'Reborn every time it trips.' }),
  'mini-diablo': def({ id: 'mini-diablo', name: 'Mini Diablo', shape: 'imp', tint: '#7a2e2e', accent: '#e05a3c',
    source: { kind: 'achievement', achievement: 'the-fall-of-naxxramas' },
    sourceLabel: 'Achievement: The Fall of Naxxramas', flavor: 'Lord of Terror, fun-sized.' }),
  'wisp': def({ id: 'wisp', name: 'Captured Wisp', shape: 'floater', tint: '#9adcc8', accent: '#e0fff2',
    source: { kind: 'vendor' }, sourceLabel: 'Sold by the stable master', flavor: 'It hums when it is happy. It is always happy.' }),
  'penguin': def({ id: 'penguin', name: 'Penguin', shape: 'critter', tint: '#3a4250', accent: '#e8ecf2',
    source: { kind: 'vendor' }, sourceLabel: 'Sold by the stable master', flavor: 'Dressed for a formal occasion, always.' }),
  'snapjaw': def({ id: 'snapjaw', name: 'Snapjaw Hatchling', shape: 'critter', tint: '#5a7a4a', accent: '#8aa86a',
    source: { kind: 'fishing', level: 150 }, sourceLabel: 'Fishing skill 150', flavor: 'Snapped at the hook. Came home instead.' }),
  'core-hound-pup': def({ id: 'core-hound-pup', name: 'Core Hound Pup', shape: 'quad', tint: '#6a3a2e', accent: '#e07a3c',
    source: { kind: 'reputation', faction: 'thoriumBrotherhood', standing: 'revered' },
    sourceLabel: 'Thorium Brotherhood: Revered', flavor: 'Two heads, one shared brain cell.' }),
  'wolvar-pup': def({ id: 'wolvar-pup', name: 'Wolvar Pup', shape: 'imp', tint: '#7a6a4a', accent: '#c9b88a',
    source: { kind: 'reputation', faction: 'timbermawHold', standing: 'honored' },
    sourceLabel: 'Timbermaw Hold: Honored', flavor: 'Fierce. Fuzzy. Mostly fuzzy.' }),
  'crate-rat': def({ id: 'crate-rat', name: 'Crate Rat', shape: 'critter', tint: '#6a625a', accent: '#a89a88',
    source: { kind: 'drop' }, sourceLabel: 'Rare drop from breakable crates', flavor: 'Stowed away. Refused to leave.' }),
  'sprite-darter': def({ id: 'sprite-darter', name: 'Sprite Darter Hatchling', shape: 'floater', tint: '#8a6ac9', accent: '#c9aef4',
    source: { kind: 'achievement', achievement: 'world-explorer' },
    sourceLabel: 'Achievement: World Explorer', flavor: 'A faerie dragon that thinks you are interesting.' }),
  'proto-whelp': def({ id: 'proto-whelp', name: 'Proto-Drake Whelp', shape: 'bird', tint: '#7a4a5a', accent: '#c98aa0',
    source: { kind: 'achievement', achievement: 'northrend-dungeonmaster' },
    sourceLabel: 'Achievement: Northrend Dungeonmaster', flavor: 'Primordial. Adorable. Slightly on fire.' }),
});

export const COMPANION_IDS: readonly CompanionId[] = Object.freeze(Object.keys(COMPANIONS) as CompanionId[]);
export function isCompanionId(v: unknown): v is CompanionId { return typeof v === 'string' && v in COMPANIONS; }

/** Stable numeric token persisted in `achievements['companion:active']`. */
export function companionToken(id: CompanionId): number { return COMPANION_IDS.indexOf(id) + 1; }
export function companionFromToken(token: number): CompanionId | null {
  const id = COMPANION_IDS[token - 1];
  return id ?? null;
}
