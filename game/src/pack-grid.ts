import { charmProfile } from './charm-content.ts';
import type { Item } from './character-types.ts';

/**
 * Pack-grid primitives shared by inventory-grid.ts and bag-content.ts.
 * This module is a leaf: it must never import inventory-grid or bag-content,
 * so bag-content can build its bag-aware layout on top without a module cycle.
 */

export const PACK_COLUMNS = 12;
export const PACK_ROWS = 6;
export const PACK_CELLS = PACK_COLUMNS * PACK_ROWS;
export const CHARM_ROWS = 4;
export const INVENTORY_CELLS = PACK_CELLS + PACK_COLUMNS * CHARM_ROWS;
export interface ItemFootprint { width: number; height: number; }
export type PackLayout = Record<string, number>;

/**
 * Grid shape a layout operates on. Structurally satisfied by bag-content's
 * BagGridLayout; declared here so inventory-grid's functions accept a bag-aware
 * grid without importing bag-content (which would close a module cycle).
 */
export interface PackGrid {
  /** Backpack region: cells [0, packCells). */
  readonly packCells: number;
  /** Charm region: cells [charmStart, charmEnd). */
  readonly charmStart: number;
  readonly charmEnd: number;
  /** Equipped-bag sections in slot order, contiguous from charmEnd. */
  readonly sections: readonly { readonly start: number; readonly cells: number }[];
  /** Total addressable cells: charmEnd + sum(section.cells). */
  readonly totalCells: number;
}

/** The grid with no equipped bags — the frozen pre-bags geometry. */
export const BASE_PACK_GRID: PackGrid = Object.freeze({
  packCells: PACK_CELLS, charmStart: PACK_CELLS, charmEnd: INVENTORY_CELLS,
  sections: Object.freeze([]) as readonly { start: number; cells: number }[], totalCells: INVENTORY_CELLS,
});

/** The bag section containing `cell`, if any. */
export function packGridSectionAt(grid: PackGrid, cell: number): { readonly start: number; readonly cells: number } | undefined {
  return grid.sections.find(section => cell >= section.start && cell < section.start + section.cells);
}
/** Cells that hold ordinary items: backpack plus every equipped-bag section. */
export const isPackGridCell = (grid: PackGrid, cell: number): boolean =>
  cell >= 0 && (cell < grid.packCells || packGridSectionAt(grid, cell) !== undefined);
export const isCharmGridCell = (grid: PackGrid, cell: number): boolean =>
  cell >= grid.charmStart && cell < grid.charmEnd;

/** Physical size follows the equipment silhouette, never rarity or rolled stats. */
export function itemFootprint(item: Item): ItemFootprint {
  // Bag items are compact 1x1 regardless of capacity. The 'bag:' literal mirrors
  // BAG_ITEM_PREFIX in bag-content.ts — kept literal so this leaf stays import-free.
  if (item.id.startsWith('bag:')) return { width: 1, height: 1 };
  if (item.kind === 'charm') { const size=charmProfile(item)?.size; return size ? {width:size.width,height:size.height} : {width:1,height:1}; }
  switch (item.kind) {
    case 'riftKey': return { width: 1, height: 2 };
    case 'consumable': return { width: 1, height: 1 };
    case 'ring': case 'amulet': return { width: 1, height: 1 };
    case 'weapon':
      if (item.weapon?.hands === 2) return { width: 2, height: 4 };
      if (item.weapon?.family === 'wand' || item.weapon?.family === 'dagger') return { width: 1, height: 2 };
      return { width: 1, height: 3 };
    case 'chest': case 'cloak': case 'legs': case 'shield': return { width: 2, height: 3 };
    default: return { width: 2, height: 2 };
  }
}

/**
 * Cells an item occupies at `cell` under `grid`, or null when it does not fit.
 * Base cells keep the frozen rules; expansion cells must stay inside their own
 * bag section (items never span two bags).
 */
export function footprintCells(item: Item, cell: number, grid: PackGrid = BASE_PACK_GRID): number[] | null {
  const { width, height } = itemFootprint(item);
  if (!Number.isInteger(cell) || cell < 0 || cell >= grid.totalCells || cell % PACK_COLUMNS + width > PACK_COLUMNS) return null;
  if (cell < grid.charmEnd) {
    if (Math.floor(cell / PACK_COLUMNS) + height > (cell >= grid.charmStart ? CHARM_ROWS + PACK_ROWS : PACK_ROWS)) return null;
    if (cell >= grid.charmStart && item.kind !== 'charm') return null;
  } else {
    const section = packGridSectionAt(grid, cell);
    if (!section || cell + (width - 1) + (height - 1) * PACK_COLUMNS > section.start + section.cells - 1) return null;
  }
  return Array.from({ length: width * height }, (_, i) => cell + i % width + Math.floor(i / width) * PACK_COLUMNS);
}

export function packOccupancy(inventory: readonly (Item | null)[], layout: PackLayout, grid: PackGrid = BASE_PACK_GRID): Set<number> {
  return new Set(inventory.flatMap(item => item && layout[item.id] !== undefined ? footprintCells(item, layout[item.id], grid) ?? [] : []));
}

/** First free cell fitting `item`; 'bag' region covers backpack + expansion sections. */
export function findPackSpace(item: Item, occupied: ReadonlySet<number>, preferred?: number,
  region: 'bag' | 'charms' = 'bag', grid: PackGrid = BASE_PACK_GRID): number | null {
  const charms = region === 'charms';
  const fits = (cell: number) => footprintCells(item, cell, grid)?.every(n => !occupied.has(n)) ?? false;
  if (preferred !== undefined && isCharmGridCell(grid, preferred) === charms && fits(preferred)) return preferred;
  for (let cell = charms ? grid.charmStart : 0; cell < (charms ? grid.charmEnd : grid.packCells); cell++) if (fits(cell)) return cell;
  if (!charms) for (const section of grid.sections) for (let cell = section.start; cell < section.start + section.cells; cell++) if (fits(cell)) return cell;
  return null;
}
