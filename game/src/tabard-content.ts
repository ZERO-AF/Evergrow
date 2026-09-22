/** Championing tabards (docs/wow-deepening.md — identity wave): WotLK's
 * "wear the tabard, earn the rep" system. Each reputation faction sells a
 * cosmetic tabard; while it is worn in the cloak slot, kill and dungeon-clear
 * reputation redirects to that faction (tabard-state.ts reads the equipped
 * item, reputation-state.ts resolves the redirect).
 *
 * Tabard items are hand-built like bags (bag-content.ts): cosmetic 'cloak'
 * items with no affixes, `recipe.starter` and `Item.tabardFaction` set. */
import type { Item } from './character-types.ts';
import { FACTION_BY_ID, type FactionId } from './reputation-content.ts';

export interface TabardDef {
  readonly id: string;
  /** The faction this tabard champions; one tabard per faction. */
  readonly factionId: FactionId;
  readonly name: string;
  /** Cosmetic item level — city tabards are 1, Northrend champion tabards 75. */
  readonly itemLevel: number;
  /** Lore line shown under the item's stats. */
  readonly flavor: string;
  readonly appearance: Item['appearance'];
}

const t = (def: TabardDef): Readonly<TabardDef> =>
  Object.freeze({ ...def, appearance: Object.freeze(def.appearance) });

/** One tabard per reputation faction; ids double as the reward ids in
 * reputation-content.ts. */
export const TABARDS: readonly TabardDef[] = Object.freeze([
  t({ id: 'stormwind-tabard', factionId: 'stormwind', name: 'Tabard of Stormwind', itemLevel: 1,
    flavor: 'Bear the lion into battle and Stormwind will hear of it.',
    appearance: { base: '#3f6fb5', shadow: '#1c2f4e', edge: '#7fa3d8', trim: '#d8b45a', style: 'cloth' } }),
  t({ id: 'argent-tabard', factionId: 'argentCrusade', name: 'Tabard of the Argent Crusade', itemLevel: 75,
    flavor: 'The light of dawn carried against the Scourge.',
    appearance: { base: '#c8b46a', shadow: '#4e452a', edge: '#e8d89a', trim: '#8a7a44', style: 'cloth' } }),
  t({ id: 'kirin-tor-tabard', factionId: 'kirinTor', name: 'Tabard of the Kirin Tor', itemLevel: 75,
    flavor: 'The violet eye of Dalaran watches over its champions.',
    appearance: { base: '#9a6fd8', shadow: '#3d2a56', edge: '#c4a3f0', trim: '#e8d44d', style: 'cloth' } }),
  t({ id: 'timbermaw-tabard', factionId: 'timbermawHold', name: 'Tabard of Timbermaw Hold', itemLevel: 1,
    flavor: 'Rough fur and old promises, worn by the few the Hold trusts.',
    appearance: { base: '#a9825a', shadow: '#453420', edge: '#d0b088', trim: '#6e5638', style: 'cloth' } }),
  t({ id: 'cenarion-tabard', factionId: 'cenarionCircle', name: 'Tabard of the Cenarion Circle', itemLevel: 1,
    flavor: 'The green sigil of the wilds, pledged against the corruption.',
    appearance: { base: '#6fae62', shadow: '#2a4423', edge: '#a3d695', trim: '#4a7a40', style: 'cloth' } }),
  t({ id: 'thorium-tabard', factionId: 'thoriumBrotherhood', name: 'Tabard of the Thorium Brotherhood', itemLevel: 1,
    flavor: 'Forge-blackened cloth for those who keep the Brotherhood\'s secrets.',
    appearance: { base: '#c07a4a', shadow: '#4e2f1c', edge: '#e8a878', trim: '#8a5a34', style: 'cloth' } }),
  t({ id: 'hodir-tabard', factionId: 'sonsOfHodir', name: 'Tabard of the Sons of Hodir', itemLevel: 75,
    flavor: 'Frost-etched weave bearing the giant-father\'s mark.',
    appearance: { base: '#7fb8d8', shadow: '#2c4a5e', edge: '#b0d8ee', trim: '#5a8aa8', style: 'cloth' } }),
  t({ id: 'cartel-tabard', factionId: 'steamwheedleCartel', name: 'Steamwheedle Cartel Tabard', itemLevel: 1,
    flavor: 'Every stitch invoiced; every favor itemized.',
    appearance: { base: '#c9a44a', shadow: '#4e3f1c', edge: '#e8cc7a', trim: '#8a7434', style: 'cloth' } }),
  t({ id: 'outrider-tabard', factionId: 'warsong', name: 'Outrider’s Tabard', itemLevel: 1,
    flavor: 'Blood-red cloth for those who ride with the Warsong.',
    appearance: { base: '#b5543c', shadow: '#4a2018', edge: '#d88468', trim: '#7a3a2a', style: 'cloth' } }),
]);

export const TABARD_BY_ID: Readonly<Record<string, TabardDef>> = Object.freeze(
  Object.fromEntries(TABARDS.map(def => [def.id, def])));
export const TABARD_BY_FACTION: Readonly<Record<FactionId, TabardDef>> = Object.freeze(
  Object.fromEntries(TABARDS.map(def => [def.factionId, def])) as Record<FactionId, TabardDef>);

export const tabardDefinition = (id: string): TabardDef | undefined => TABARD_BY_ID[id];
export const tabardForFaction = (faction: FactionId): TabardDef | undefined => TABARD_BY_FACTION[faction];

export const TABARD_ITEM_PREFIX = 'tabard:';

/** Deterministic cosmetic cloak carrying `tabardFaction`; the championing
 * redirect reads it while the item sits in the cloak slot. */
export function tabardItem(id: string, seed: number): Item {
  const def = tabardDefinition(id);
  if (!def) throw new RangeError(`Unknown tabard: ${id}`);
  const s = (seed >>> 0).toString(36);
  return {
    id: `${TABARD_ITEM_PREFIX}${def.id}:${s}`, seed: seed >>> 0,
    name: def.name, baseName: def.name, kind: 'cloak', tier: 'common',
    itemLevel: def.itemLevel, requiredLevel: 1, power: 1,
    implicit: {}, affixes: [],
    recipe: { manaVersion: 1, offenseVersion: 1, rollVersion: 1, starter: true, enhancement: 0, revision: 0, targetedRolls: 0, fullRolls: 0, rolls: [] },
    flavor: `${def.flavor} Champions the ${FACTION_BY_ID[def.factionId].name}.`,
    appearance: { ...def.appearance },
    tabardFaction: def.factionId,
  };
}
