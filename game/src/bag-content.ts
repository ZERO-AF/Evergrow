import type { Item, ItemKind } from './character-types.ts';
import { PACK_COLUMNS, PACK_CELLS, CHARM_ROWS, INVENTORY_CELLS, itemFootprint, type ItemFootprint, type PackLayout } from './pack-grid.ts';
import { randomSource } from './items.ts';

/**
 * WoW-style equippable bags (docs/wow-deepening.md follow-up).
 *
 * ItemKind is frozen, so a bag item rides the 'cloak' kind with a starter
 * recipe — the same convention glyph-content.ts uses for 'amulet': that shape
 * passes validItem with zero affixes/implicit, survives deriveItem unchanged
 * (starter skips implicit derivation; all recipe versions are 1), and prices
 * without the jewelry markup. The bag id is encoded in the item id as
 * `bag:<bagId>:<seed36>`; never stamp bag items through vendorStock's
 * `stock:` id rewrite — buy them via bag-state's buyBag instead.
 *
 * Cell model: the backpack keeps cells [0, PACK_CELLS), charms keep
 * [PACK_CELLS, INVENTORY_CELLS), and each equipped bag appends a section at
 * INVENTORY_CELLS + n (12-column aligned, so existing row math still works).
 * Saved layouts never shift when bags change; only expansion cells appear or
 * vanish. Items never span two sections — WoW bags are discrete containers.
 */

export interface BagDefinition {
  id: string;
  name: string;
  /** Grid cells this bag adds to the pack while equipped. */
  slots: number;
  /** Drives vendor price (commerce.ts budget curve) and requiredLevel = itemLevel - 2. */
  itemLevel: number;
  flavor: string;
  appearance: Item['appearance'];
}

/** Real WotLK bag progression, cheapest to largest. */
const BAG_DEFINITIONS: BagDefinition[] = [
  { id: 'linen-bag', name: 'Linen Bag', slots: 6, itemLevel: 2,
    flavor: 'A rough-spun sack, better than pockets.',
    appearance: { base: '#a08b62', shadow: '#4a3f2c', edge: '#c9b183', trim: '#8a744e', style: 'cloth' } },
  { id: 'woolen-bag', name: 'Woolen Bag', slots: 8, itemLevel: 8,
    flavor: 'Thick wool weave that smells faintly of sheep.',
    appearance: { base: '#8a7a5c', shadow: '#3d3527', edge: '#b3a077', trim: '#6e5f42', style: 'cloth' } },
  { id: 'silk-bag', name: 'Silk Bag', slots: 10, itemLevel: 18,
    flavor: 'Fine silk, surprisingly sturdy.',
    appearance: { base: '#7d6a8a', shadow: '#332a3d', edge: '#a894b8', trim: '#5d4e6e', style: 'cloth' } },
  { id: 'mageweave-bag', name: 'Mageweave Bag', slots: 12, itemLevel: 30,
    flavor: 'Woven with threads that hum with latent magic.',
    appearance: { base: '#5a5f8a', shadow: '#23263d', edge: '#8a90c4', trim: '#454a75', style: 'cloth' } },
  { id: 'netherweave-bag', name: 'Netherweave Bag', slots: 16, itemLevel: 45,
    flavor: 'Outland cloth that holds more than it should.',
    appearance: { base: '#4a6a72', shadow: '#1d2c30', edge: '#74a0aa', trim: '#38545c', style: 'cloth' } },
  { id: 'frostweave-bag', name: 'Frostweave Bag', slots: 20, itemLevel: 60,
    flavor: 'Northrend weave, cold to the touch and cavernous inside.',
    appearance: { base: '#5d7d96', shadow: '#233240', edge: '#9cc3dd', trim: '#41607a', style: 'cloth' } },
];
export const BAG_ITEMS: readonly BagDefinition[] = Object.freeze(BAG_DEFINITIONS.map(value => Object.freeze({ ...value, appearance: Object.freeze(value.appearance) })));

/** WoW equips up to four bags beside the backpack. */
export const BAG_SLOT_COUNT = 4;
export const BAG_ITEM_PREFIX = 'bag:';
/** The host kind every bag item carries (see module header). */
export const BAG_ITEM_KIND: ItemKind = 'cloak';

export const bagDefinition = (id: string): BagDefinition | undefined => BAG_ITEMS.find(def => def.id === id);
export const isBagId = (id: string): boolean => bagDefinition(id) !== undefined;

/** Parse the bag definition id out of a bag item's encoded id. */
export function bagItemId(item: Item | null | undefined): string | null {
  const id = item?.id;
  if (!id?.startsWith(BAG_ITEM_PREFIX)) return null;
  const bagId = id.slice(BAG_ITEM_PREFIX.length, id.lastIndexOf(':'));
  return isBagId(bagId) ? bagId : null;
}
export function isBagItem(item: Item | null | undefined): boolean { return bagItemId(item) !== null; }
export function bagItemDefinition(item: Item | null | undefined): BagDefinition | undefined {
  const id = bagItemId(item);
  return id ? bagDefinition(id) : undefined;
}

/** Deterministic bag item for drops, vendor stock and quest rewards. */
export function createBagItem(bagId: string, seed: number): Item {
  const def = bagDefinition(bagId);
  if (!def) throw new RangeError(`Unknown bag: ${bagId}`);
  const s = (seed >>> 0).toString(36);
  return {
    id: `${BAG_ITEM_PREFIX}${def.id}:${s}`, seed: seed >>> 0,
    name: def.name, baseName: def.name, kind: BAG_ITEM_KIND, tier: 'common',
    itemLevel: def.itemLevel, requiredLevel: Math.max(1, def.itemLevel - 2), power: 1,
    implicit: {}, affixes: [],
    recipe: { manaVersion: 1, offenseVersion: 1, rollVersion: 1, starter: true, enhancement: 0, revision: 0, targetedRolls: 0, fullRolls: 0, rolls: [] },
    flavor: `${def.flavor} ${def.slots}-slot bag — equip it in a bag slot to expand your pack.`,
    appearance: { ...def.appearance },
  };
}

/** Structural check for save validation; tolerates stamped ids and locked flags. */
export function validBagItem(v: unknown): v is Item {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const item = v as Item;
  const def = bagItemDefinition(item);
  return !!def && item.kind === BAG_ITEM_KIND && item.tier === 'common'
    && item.itemLevel === def.itemLevel && item.requiredLevel === Math.max(1, def.itemLevel - 2)
    && item.recipe?.starter === true && !item.recipe.profileId && !item.recipe.materialId
    && !item.affixes?.length && !Object.keys(item.implicit ?? {}).length
    && !item.weapon && !item.shield && !item.focus;
}

/** Bags are compact one-cell items regardless of their capacity. */
export function bagItemFootprint(item: Item): ItemFootprint {
  return isBagItem(item) ? { width: 1, height: 1 } : itemFootprint(item);
}

// ── Grid layout ─────────────────────────────────────────────────────────────

export interface BagSection {
  /** Bag slot index 0-3 this section belongs to. */
  slot: number;
  item: Item;
  definition: BagDefinition;
  /** First cell index of this section (always a multiple of PACK_COLUMNS). */
  start: number;
  /** Usable cells in this section (= definition.slots). */
  cells: number;
  /** ceil(cells / PACK_COLUMNS) — rendered grid rows. */
  rows: number;
}
export interface BagGridLayout {
  /** Backpack region: cells [0, packCells). */
  packCells: number;
  /** Charm region: cells [charmStart, charmEnd). */
  charmStart: number;
  charmEnd: number;
  /** Equipped-bag sections in slot order, contiguous from charmEnd. */
  sections: readonly BagSection[];
  /** Total addressable cells: charmEnd + sum(section.cells). */
  totalCells: number;
}

/** Layout with no equipped bags — identical to the frozen inventory-grid constants. */
export const BASE_BAG_LAYOUT: BagGridLayout = Object.freeze({
  packCells: PACK_CELLS, charmStart: PACK_CELLS, charmEnd: INVENTORY_CELLS,
  sections: Object.freeze([]) as readonly BagSection[], totalCells: INVENTORY_CELLS,
});

type BagCarrier = { bags?: Array<Item | null> };

/** Equipped bag items in slot order; malformed entries are ignored. */
export function equippedBags(sheet: BagCarrier): Item[] {
  const seen = new Set<string>();
  return (sheet.bags ?? []).filter((item): item is Item => {
    if (!item || !isBagItem(item) || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, BAG_SLOT_COUNT);
}

/**
 * The grid-layout function the integrator wires into inventory-grid.ts:
 * every capacity/region decision flows from this one result.
 */
export function bagGridLayout(sheet: BagCarrier): BagGridLayout {
  const bags = equippedBags(sheet);
  if (!bags.length) return BASE_BAG_LAYOUT;
  let start = INVENTORY_CELLS;
  const sections = bags.map(item => {
    const definition = bagItemDefinition(item)!;
    const section: BagSection = {
      slot: (sheet.bags ?? []).indexOf(item), item, definition,
      start, cells: definition.slots, rows: Math.ceil(definition.slots / PACK_COLUMNS),
    };
    start += definition.slots;
    return section;
  });
  return { packCells: PACK_CELLS, charmStart: PACK_CELLS, charmEnd: INVENTORY_CELLS, sections, totalCells: start };
}

/** Total pack-grid cells: backpack plus every equipped bag's slots. */
export const bagSlots = (sheet: BagCarrier): number =>
  PACK_CELLS + equippedBags(sheet).reduce((sum, item) => sum + bagItemDefinition(item)!.slots, 0);
/** Total addressable cells including the charm grid. */
export const inventoryCells = (sheet: BagCarrier): number => bagGridLayout(sheet).totalCells;

/** The expansion section containing `cell`, if any. */
export function bagSectionAt(grid: BagGridLayout, cell: number): BagSection | undefined {
  return grid.sections.find(section => cell >= section.start && cell < section.start + section.cells);
}
export const isPackGridCell = (grid: BagGridLayout, cell: number): boolean =>
  cell >= 0 && (cell < grid.packCells || bagSectionAt(grid, cell) !== undefined);
export const isCharmGridCell = (grid: BagGridLayout, cell: number): boolean =>
  cell >= grid.charmStart && cell < grid.charmEnd;

/**
 * Drop-in replacement for inventory-grid's footprintCells under a bag layout.
 * Base cells keep the frozen rules; expansion cells must stay inside their
 * own bag section (items never span two bags).
 */
export function bagFootprintCells(item: Item, cell: number, grid: BagGridLayout = BASE_BAG_LAYOUT): number[] | null {
  const { width, height } = bagItemFootprint(item);
  if (!Number.isInteger(cell) || cell < 0 || cell >= grid.totalCells || cell % PACK_COLUMNS + width > PACK_COLUMNS) return null;
  if (cell < grid.charmEnd) {
    if (Math.floor(cell / PACK_COLUMNS) + height > (cell >= grid.charmStart ? CHARM_ROWS + PACK_CELLS / PACK_COLUMNS : PACK_CELLS / PACK_COLUMNS)) return null;
    if (cell >= grid.charmStart && item.kind !== 'charm') return null;
  } else {
    const section = bagSectionAt(grid, cell);
    if (!section || cell + (width - 1) + (height - 1) * PACK_COLUMNS > section.start + section.cells - 1) return null;
  }
  return Array.from({ length: width * height }, (_, i) => cell + i % width + Math.floor(i / width) * PACK_COLUMNS);
}

export function bagPackOccupancy(inventory: readonly (Item | null)[], layout: PackLayout, grid: BagGridLayout = BASE_BAG_LAYOUT): Set<number> {
  return new Set(inventory.flatMap(item => item && layout[item.id] !== undefined ? bagFootprintCells(item, layout[item.id], grid) ?? [] : []));
}

/** findPackSpace under a bag layout: 'bag' region covers backpack + expansion sections. */
export function findBagSpace(item: Item, occupied: ReadonlySet<number>, preferred?: number,
  region: 'bag' | 'charms' = 'bag', grid: BagGridLayout = BASE_BAG_LAYOUT): number | null {
  const charms = region === 'charms';
  const fits = (cell: number) => bagFootprintCells(item, cell, grid)?.every(n => !occupied.has(n)) ?? false;
  if (preferred !== undefined && isCharmGridCell(grid, preferred) === charms && fits(preferred)) return preferred;
  for (let cell = charms ? grid.charmStart : 0; cell < (charms ? grid.charmEnd : grid.packCells); cell++) if (fits(cell)) return cell;
  if (!charms) for (const section of grid.sections) for (let cell = section.start; cell < section.start + section.cells; cell++) if (fits(cell)) return cell;
  return null;
}

/** resolvePackLayout under a bag layout: placed items keep cells, the rest pack in order, leftovers stay in overflow. */
export function resolveBagPackLayout(sheet: { inventory: readonly (Item | null)[]; inventoryLayout?: PackLayout; bags?: Array<Item | null> },
  grid: BagGridLayout = bagGridLayout(sheet)): PackLayout {
  const result: PackLayout = {}, occupied = new Set<number>();
  for (const item of sheet.inventory) if (item && sheet.inventoryLayout?.[item.id] !== undefined) {
    const cell = sheet.inventoryLayout[item.id], cells = bagFootprintCells(item, cell, grid);
    if (cells && cells.every(n => !occupied.has(n))) { result[item.id] = cell; cells.forEach(n => occupied.add(n)); }
  }
  for (const item of sheet.inventory) if (item && result[item.id] === undefined) {
    const cell = findBagSpace(item, occupied, undefined, 'bag', grid)
      ?? (item.kind === 'charm' ? findBagSpace(item, occupied, undefined, 'charms', grid) : null);
    if (cell !== null) { result[item.id] = cell; bagFootprintCells(item, cell, grid)!.forEach(n => occupied.add(n)); }
  }
  return result;
}

/** True when every owned item fits the grid and `item` could still be added. */
export function canPackInBagGrid(sheet: { inventory: readonly (Item | null)[]; inventoryLayout?: PackLayout; bags?: Array<Item | null> }, item: Item): boolean {
  const grid = bagGridLayout(sheet);
  if (!sheet.inventory.includes(null) && sheet.inventory.length >= grid.totalCells) return false;
  const layout = resolveBagPackLayout(sheet, grid);
  return !sheet.inventory.some(owned => owned && layout[owned.id] === undefined)
    && findBagSpace(item, bagPackOccupancy(sheet.inventory, layout, grid), undefined, 'bag', grid) !== null;
}

/** packSpaceProblem under a bag layout. */
export function bagSpaceProblem(sheet: { inventory: readonly (Item | null)[]; inventoryLayout?: PackLayout; bags?: Array<Item | null> },
  item: Item, region: 'bag' | 'charms' = 'bag'): string {
  const grid = bagGridLayout(sheet), layout = resolveBagPackLayout(sheet, grid), occupied = bagPackOccupancy(sheet.inventory, layout, grid);
  const free: number[] = [];
  const scan = (start: number, end: number) => { for (let cell = start; cell < end; cell++) if (!occupied.has(cell)) free.push(cell); };
  if (region === 'charms') scan(grid.charmStart, grid.charmEnd);
  else { scan(0, grid.packCells); for (const section of grid.sections) scan(section.start, section.start + section.cells); }
  const shape = bagItemFootprint(item), name = region === 'charms' ? 'Charm grid' : 'Bag';
  return free.length < shape.width * shape.height ? `${name} full. Make room for this item.` : `No ${shape.width} × ${shape.height} space. Try Auto-sort.`;
}

// ── Drops ───────────────────────────────────────────────────────────────────

/** Enemy drop table: rare, weighted toward the smaller bags. */
export const BAG_DROP = Object.freeze({ chance: 0.02 });

/**
 * Deterministic enemy-drop roll: ~2% of eligible kills yield a bag, biased to
 * smaller sizes and capped by the kill's level. Call from the loot path
 * alongside rollGlyphDrop.
 */
export function rollBagDrop(seed: number, level: number): Item | null {
  const random = randomSource(seed >>> 0);
  if (random() >= BAG_DROP.chance) return null;
  const eligible = BAG_ITEMS.filter(def => def.itemLevel <= Math.max(2, level + 4));
  const pool = eligible.length ? eligible : [BAG_ITEMS[0]];
  const weights = pool.map(def => 1 / def.slots);
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  const def = pool[weights.findIndex(weight => (roll -= weight) < 0)] ?? pool[0];
  return createBagItem(def.id, seed);
}
