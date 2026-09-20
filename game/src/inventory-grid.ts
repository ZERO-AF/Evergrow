import type { CharacterSheet, Item } from './character-types.ts';
import {
  BASE_PACK_GRID, PACK_COLUMNS, findPackSpace, footprintCells, isCharmGridCell, itemFootprint, packOccupancy,
  type ItemFootprint, type PackGrid, type PackLayout,
} from './pack-grid.ts';
import { EQUIPMENT_SLOTS } from './items.ts';
import { bagGridLayout, resolveBagPackLayout, canPackInBagGrid, bagSpaceProblem } from './bag-content.ts';
import { consumableFor } from './consumable-content.ts';

// The grid primitives live in pack-grid.ts (a leaf) so bag-content can build on
// them without a module cycle; they are re-exported here to keep the existing
// import surface stable.
export {
  BASE_PACK_GRID, CHARM_ROWS, INVENTORY_CELLS, PACK_CELLS, PACK_COLUMNS, PACK_ROWS,
  findPackSpace, footprintCells, isCharmGridCell, isPackGridCell, itemFootprint, packOccupancy,
  packGridSectionAt,
} from './pack-grid.ts';
export type { ItemFootprint, PackGrid, PackLayout } from './pack-grid.ts';

/** The grid a sheet's pack currently spans: base geometry plus equipped bags. */
export function packGrid(sheet: Pick<CharacterSheet, 'bags'>): PackGrid {
  return bagGridLayout(sheet);
}

/** Storage presentation grows vertically to preserve its item-count capacity.
 * Keep saved slot indices intact for retrieval; stored charms remain inactive. */
export function storageGridLayout(items: readonly (Item | null)[]): { cells: Array<number | null>; rows: number } {
  const occupied = new Set<number>();
  let rows = 8;
  const cells = items.map(item => {
    if (!item) return null;
    const { width, height } = itemFootprint(item);
    // The first row below all existing items is always a valid fallback.
    for (let cell = 0; cell <= rows * PACK_COLUMNS; cell++) {
      if (cell % PACK_COLUMNS + width > PACK_COLUMNS) continue;
      const footprint = Array.from({ length: width * height }, (_, i) => cell + i % width + Math.floor(i / width) * PACK_COLUMNS);
      if (footprint.some(value => occupied.has(value))) continue;
      footprint.forEach(value => occupied.add(value));
      rows = Math.max(rows, Math.floor(cell / PACK_COLUMNS) + height);
      return cell;
    }
    throw new Error('Unable to lay out stored item');
  });
  return { cells, rows };
}

/** Keep placed items fixed; older unpositioned items pack deterministically. Unfitted items remain owned in overflow. */
export function resolvePackLayout(sheet: Pick<CharacterSheet, 'inventory' | 'inventoryLayout'> & { bags?: Array<Item | null> }): PackLayout {
  return resolveBagPackLayout(sheet);
}
export function normalizePackLayout(sheet: CharacterSheet): void { sheet.inventoryLayout = resolvePackLayout(sheet); }

export function validPackLayout(inventory: CharacterSheet['inventory'], value: unknown, grid: PackGrid = BASE_PACK_GRID): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const items = new Map(inventory.filter((item): item is Item => !!item).map(item => [item.id, item]));
  const occupied = new Set<number>();
  for (const [id, cell] of Object.entries(value)) {
    const item = items.get(id), cells = item && typeof cell === 'number' && footprintCells(item, cell, grid);
    if (!cells || cells.some(n => occupied.has(n))) return false;
    cells.forEach(n => occupied.add(n));
  }
  return true;
}

/** Consumable stacks merge into existing stacks; only the overflow needs a free cell. */
function consumableMergeable(sheet: Pick<CharacterSheet, 'inventory'>, item: Item): boolean {
  const def = consumableFor(item);
  return !!def && sheet.inventory.some(existing => (existing?.stack ?? 1) < def.stackSize && consumableFor(existing)?.id === def.id);
}

export function canPackItem(sheet: Pick<CharacterSheet, 'inventory' | 'inventoryLayout'> & { bags?: Array<Item | null> }, item: Item): boolean {
  return consumableMergeable(sheet, item) || canPackInBagGrid(sheet, item);
}

/** Level-eligible stones in the dedicated charm grid grant bonuses; overflow and stash do not. */
export function activeCharms(sheet: Pick<CharacterSheet,'inventory'|'inventoryLayout'> & { bags?: Array<Item | null> }, level = Infinity): Item[] {
  const grid = bagGridLayout(sheet), layout = resolvePackLayout(sheet);
  return sheet.inventory.filter((item):item is Item=>!!item && item.kind==='charm' && item.requiredLevel<=level && layout[item.id]!==undefined && isCharmGridCell(grid, layout[item.id]));
}

/** Repack each region independently (backpack + each bag section, then charms); compact mode tries eight bounded shape orders. */
export function repackLayout(inventory: CharacterSheet['inventory'], previous: PackLayout = {}, compact = false, grid: PackGrid = BASE_PACK_GRID): PackLayout {
  const items=inventory.filter((item):item is Item=>!!item);
  const active=(item:Item)=>item.kind==='charm'&&previous[item.id]!==undefined&&isCharmGridCell(grid,previous[item.id]);
  const bagRanges: [number, number][] = [[0, grid.packCells], ...grid.sections.map(s => [s.start, s.start + s.cells] as [number, number])];
  return {...packRegion(items.filter(i=>!active(i)),bagRanges,compact,grid),...packRegion(items.filter(active),[[grid.charmStart,grid.charmEnd]],compact,grid)};
}
function packRegion(items: Item[], ranges: readonly [number, number][], compact: boolean, grid: PackGrid): PackLayout {
  let best:PackLayout={},bestCount=-1;
  const metrics=[(s:ItemFootprint)=>s.height*100+s.width,(s:ItemFootprint)=>s.width*100+s.height,
    (s:ItemFootprint)=>s.width*s.height*100+s.height,(s:ItemFootprint)=>Math.max(s.width,s.height)*100+s.width*s.height];
  for(const metric of (compact?metrics:[()=>0]))for(const reverse of (compact?[false,true]:[false])){
    const ordered=[...items].sort((a,b)=>metric(itemFootprint(b))-metric(itemFootprint(a)));
    const layout:PackLayout={},occupied=new Set<number>();
    for(const item of ordered){
      for(const [start,end] of ranges){
        let placed=false;
        for(let i=start;i<end;i++){
          const cell=reverse?Math.floor(i/PACK_COLUMNS)*PACK_COLUMNS+PACK_COLUMNS-1-i%PACK_COLUMNS:i;
          const cells=footprintCells(item,cell,grid);
          if(cells?.every(n=>!occupied.has(n))){layout[item.id]=cell;cells.forEach(n=>occupied.add(n));placed=true;break;}
        }
        if(placed)break;
      }
    }
    const count=Object.keys(layout).length;
    if(count>bestCount){best=layout;bestCount=count;}
    if(count===items.length)break;
  }
  return best;
}

export function packSpaceProblem(sheet: Pick<CharacterSheet,'inventory'|'inventoryLayout'> & { bags?: Array<Item | null> },item:Item,region: 'bag' | 'charms' = 'bag'): string {
  return bagSpaceProblem(sheet, item, region);
}

/** Add an item to the first free pack cell, growing the array to the bag-aware grid. */
export function addInventoryItem(sheet: CharacterSheet, item: Item): boolean {
  const consumable = consumableFor(item);
  if (consumable) {
    let remaining = item.stack ?? 1;
    for (const existing of sheet.inventory) {
      if (!existing || consumableFor(existing)?.id !== consumable.id) continue;
      const space = consumable.stackSize - (existing.stack ?? 1);
      if (space <= 0) continue;
      const moved = Math.min(space, remaining);
      existing.stack = (existing.stack ?? 1) + moved;
      remaining -= moved;
      if (remaining <= 0) return true;
    }
    item.stack = remaining;
  }
  if (sheet.inventory.some(existing => existing?.id === item.id) || EQUIPMENT_SLOTS.some(slot => sheet.equipped[slot]?.id === item.id)) return false;
  const grid = packGrid(sheet), layout = resolvePackLayout(sheet);
  if (sheet.inventory.some(existing => existing && layout[existing.id] === undefined)) return false;
  const empty = sheet.inventory.findIndex(existing => existing === null);
  const index = empty >= 0 ? empty : sheet.inventory.length < grid.totalCells ? sheet.inventory.length : -1;
  const cell = findPackSpace(item, packOccupancy(sheet.inventory, layout, grid), undefined, 'bag', grid);
  if (index < 0 || cell === null) return false;
  while (sheet.inventory.length < grid.totalCells) sheet.inventory.push(null);
  sheet.inventory[index] = item; sheet.inventoryLayout = { ...layout, [item.id]: cell };
  const owned = new Set([...sheet.inventory, ...Object.values(sheet.equipped)].filter((i): i is Item => i !== null).map(i => i.id));
  sheet.recentItems = [item.id, ...(sheet.recentItems ?? []).filter(id => id !== item.id && owned.has(id))];
  return true;
}
