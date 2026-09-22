import type { LootFilterMode } from './loot.ts';

export type GroundLootNameplates = 'always' | 'ctrl';
export function showGroundLootNames(mode: GroundLootNameplates, holdBound: boolean, holdHeld: boolean, alternateInput: boolean): boolean {
  return mode === 'always' || !holdBound || holdHeld || alternateInput;
}
export interface GroundLootLabel { id: number; x: number; y: number; width: number; height: number; anchorX: number; anchorY: number; visible?: boolean;
  /** Loot filter hides the plate; the physical item stays hoverable and pickupable. */
  filtered?: boolean; }
export interface GroundLootVisibility {
  showAll: boolean;
  pointer?: { x: number; y: number } | null;
  retainedId?: number;
  selectedId?: number | null;
  /** Active loot filter; labels below its threshold never draw. */
  filter?: LootFilterMode;
}
/** Hidden plates have no hit area; their physical item can still be hovered. */
export function groundLootVisibility(labels: readonly GroundLootLabel[], options: GroundLootVisibility): GroundLootLabel[] {
  const candidates = labels.map(label => ({ ...label, visible: options.showAll || label.id === options.retainedId || label.id === options.selectedId }));
  const hovered = options.pointer && hoveredGroundLoot(candidates, options.pointer.x, options.pointer.y);
  return candidates.map(label => ({ ...label, visible: !label.filtered && (options.showAll || label.id === hovered?.id || label.id === options.selectedId) }));
}
export function hoveredGroundLoot(labels: readonly GroundLootLabel[], x: number, y: number): GroundLootLabel | undefined {
  // Labels win over neighboring item silhouettes in a crowded pile.
  return labels.find(b => b.visible !== false && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)
    ?? labels.find(b => Math.abs(x - b.anchorX) <= 15 && y >= b.anchorY - 20 && y <= b.anchorY + 6);
}
