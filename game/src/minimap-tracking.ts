import { getMinimapRect, projectMapPoint, type MapView } from './map-view.ts';
import type { MapRect } from './exploration.ts';
import { buildingNPC, NPC_NAMES } from './npcs.ts';
import { wowBuildingName } from './minimap-zone.ts';
import { drawMapSymbol } from './map-symbol-art.ts';
import { text } from './font.ts';
import { UI_THEME } from './ui-theme.ts';
import type { Building } from './settlements.ts';

const palette = UI_THEME.palette;
const INK = '#0a111b';

/** Minimap tracking categories (docs/wow-deepening.md §9); each is toggleable. */
export type TrackingKind = 'quest' | 'node' | 'vendor' | 'innkeeper';
export const TRACKING_KINDS: readonly TrackingKind[] = Object.freeze(['quest', 'node', 'vendor', 'innkeeper']);
export const TRACKING_LABELS: Readonly<Record<TrackingKind, string>> = Object.freeze({
  quest: 'Quest Givers', node: 'Gather Nodes', vendor: 'Vendors', innkeeper: 'Innkeepers',
});
export const TRACKING_COLORS: Readonly<Record<TrackingKind, string>> = Object.freeze({
  quest: '#ffd100', node: '#f4c95d', vendor: '#c9a35f', innkeeper: '#9fc7e8',
});

export interface TrackingBlip {
  x: number;
  y: number;
  kind: TrackingKind;
  label: string;
  /** Quest blips: '!' while the giver offers work, '?' when a quest is ready to turn in. */
  turnIn?: boolean;
}

/** Everything the collector needs; quest givers and gather nodes arrive from their own systems. */
export interface TrackingSources {
  /** Settlement buildings in range — vendors and innkeepers are derived here. */
  buildings?: readonly Building[];
  questGivers?: readonly { x: number; y: number; label: string; turnIn?: boolean }[];
  gatherNodes?: readonly { x: number; y: number; label: string }[];
}

/** Blips for every enabled category, in a stable draw order. */
export function collectTrackingBlips(sources: TrackingSources,
  filter: Readonly<Record<TrackingKind, boolean>>): TrackingBlip[] {
  const blips: TrackingBlip[] = [];
  if (filter.quest) for (const giver of sources.questGivers ?? [])
    blips.push({ x: giver.x, y: giver.y, kind: 'quest', label: giver.label, ...(giver.turnIn ? { turnIn: true } : {}) });
  if (filter.node) for (const node of sources.gatherNodes ?? [])
    blips.push({ x: node.x, y: node.y, kind: 'node', label: node.label });
  if (filter.vendor || filter.innkeeper) for (const building of sources.buildings ?? []) {
    if (filter.innkeeper && (building.kind === 'inn' || building.kind === 'hearth'))
      blips.push({ x: building.door.x, y: building.door.y, kind: 'innkeeper',
        label: wowBuildingName(building) ?? building.name });
    if (filter.vendor) {
      const npc = buildingNPC(building);
      if (npc) blips.push({ x: npc.x, y: npc.y, kind: 'vendor', label: NPC_NAMES[npc.role] });
    }
  }
  return blips;
}

/** The terrain viewport `WorldMap.drawMinimap` uses; tracking dots share its projection. */
export function minimapView(player: { x: number; y: number }, width: number, height: number): MapView {
  const r = getMinimapRect(width, height);
  return { x: r.x + 6, y: r.y + 25, width: r.width - 12, height: r.height - 66,
    centerX: player.x, centerY: player.y, zoom: .05 };
}

/** World-space rect the minimap covers — the query bounds for tracking sources. */
export function minimapWorldBounds(player: { x: number; y: number }, width: number, height: number): MapRect {
  const view = minimapView(player, width, height);
  return { x: view.centerX - view.width / view.zoom / 2, y: view.centerY - view.height / view.zoom / 2,
    width: view.width / view.zoom, height: view.height / view.zoom };
}

function drawBlipGlyph(c: CanvasRenderingContext2D, kind: TrackingKind, x: number, y: number, turnIn = false): void {
  c.save();
  c.translate(x, y);
  if (kind === 'node') {
    c.fillStyle = TRACKING_COLORS.node; c.strokeStyle = INK; c.lineWidth = .8;
    c.beginPath(); c.moveTo(0, -3.1); c.lineTo(3.1, 0); c.lineTo(0, 3.1); c.lineTo(-3.1, 0); c.closePath();
    c.fill(); c.stroke();
  } else if (kind === 'innkeeper') {
    c.fillStyle = INK; c.beginPath(); c.arc(0, 0, 4.4, 0, Math.PI * 2); c.fill();
    drawMapSymbol(c, 'inn', 4.2, TRACKING_COLORS.innkeeper, INK);
  } else {
    const color = kind === 'quest' ? TRACKING_COLORS.quest : TRACKING_COLORS.vendor;
    c.fillStyle = color; c.strokeStyle = INK; c.lineWidth = .8;
    c.beginPath(); c.arc(0, 0, kind === 'quest' ? 3 : 2.2, 0, Math.PI * 2); c.fill(); c.stroke();
    if (kind === 'quest') {
      c.fillStyle = INK; c.strokeStyle = INK; c.lineWidth = .8; c.lineCap = 'round';
      if (turnIn) {
        c.beginPath(); c.arc(.1, -1.1, 1.15, Math.PI * .85, Math.PI * 2.05); c.stroke();
        c.beginPath(); c.moveTo(1.05, -.55); c.lineTo(.1, .35); c.stroke();
        c.beginPath(); c.arc(0, 1.55, .55, 0, Math.PI * 2); c.fill();
      } else {
        c.fillRect(-.55, -2.1, 1.1, 2.7);
        c.beginPath(); c.arc(0, 1.55, .6, 0, Math.PI * 2); c.fill();
      }
    }
  }
  c.restore();
}

/** Tracking dots inside the minimap terrain viewport; call while the map is being drawn. */
export function drawTrackingBlips(c: CanvasRenderingContext2D, view: MapView, blips: readonly TrackingBlip[],
  isRevealed?: (x: number, y: number) => boolean): void {
  c.save();
  c.beginPath(); c.rect(view.x, view.y, view.width, view.height); c.clip();
  for (const blip of blips) {
    if (isRevealed && !isRevealed(blip.x, blip.y)) continue;
    const p = projectMapPoint(blip.x, blip.y, view);
    if (p.x < view.x - 4 || p.y < view.y - 4 || p.x > view.x + view.width + 4 || p.y > view.y + view.height + 4) continue;
    drawBlipGlyph(c, blip.kind, p.x, p.y, blip.turnIn);
  }
  c.restore();
}

const BUTTON = { width: 14, height: 14 } as const;
const MENU = { width: 122, rowHeight: 18, pad: 5 } as const;

/** Toggleable tracking filter plus the WoW-style magnifier button and dropdown on the minimap edge. */
export class MinimapTracking {
  readonly filter: Record<TrackingKind, boolean> = { quest: true, node: true, vendor: true, innkeeper: true };
  private menuOpen = false;
  get menuVisible(): boolean { return this.menuOpen; }
  setMenu(open: boolean): void { this.menuOpen = open; }
  toggle(kind: TrackingKind): void { this.filter[kind] = !this.filter[kind]; }
  get anyDisabled(): boolean { return TRACKING_KINDS.some(kind => !this.filter[kind]); }

  /** Magnifier button docked to the minimap's left edge. */
  buttonRect(width: number, height: number): MapRect {
    const r = getMinimapRect(width, height);
    return { x: r.x - BUTTON.width - 4, y: r.y + 4, width: BUTTON.width, height: BUTTON.height };
  }

  /** Dropdown anchored left of the button; one row per tracking kind. */
  menuRect(width: number, height: number): MapRect {
    const button = this.buttonRect(width, height);
    return { x: button.x - MENU.width - 4, y: button.y,
      width: MENU.width, height: MENU.pad * 2 + TRACKING_KINDS.length * MENU.rowHeight };
  }

  /** True when the point hits the button or the open menu — feed HUD hit-testing. */
  covers(x: number, y: number, width: number, height: number): boolean {
    const inside = (r: MapRect) => x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height;
    return inside(this.buttonRect(width, height)) || (this.menuOpen && inside(this.menuRect(width, height)));
  }

  /** Canvas-space click. Returns true when consumed (toggle, menu open/close, or outside-dismiss). */
  handleClick(x: number, y: number, width: number, height: number): boolean {
    const inside = (r: MapRect) => x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height;
    if (this.menuOpen) {
      const menu = this.menuRect(width, height);
      if (inside(menu)) {
        const row = Math.floor((y - menu.y - MENU.pad) / MENU.rowHeight);
        if (row >= 0 && row < TRACKING_KINDS.length && y - menu.y - MENU.pad - row * MENU.rowHeight < MENU.rowHeight)
          this.toggle(TRACKING_KINDS[row]);
        return true;
      }
      this.menuOpen = false;
      return true;
    }
    if (inside(this.buttonRect(width, height))) { this.menuOpen = true; return true; }
    return false;
  }

  draw(c: CanvasRenderingContext2D, width: number, height: number,
    pointer?: { x: number; y: number } | null): void {
    const button = this.buttonRect(width, height);
    c.save();
    c.fillStyle = `${palette.well}f2`; c.fillRect(button.x, button.y, button.width, button.height);
    c.strokeStyle = this.menuOpen ? palette.brass : `${palette.silverDim}90`; c.lineWidth = 1;
    c.strokeRect(button.x + .5, button.y + .5, button.width - 1, button.height - 1);
    const cx = button.x + button.width / 2, cy = button.y + button.height / 2;
    c.strokeStyle = this.menuOpen ? palette.ivory : palette.silverDim; c.lineWidth = 1.2;
    c.beginPath(); c.arc(cx - 1, cy - 1, 2.6, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(cx + 1.2, cy + 1.2); c.lineTo(cx + 3.6, cy + 3.6); c.stroke();
    if (this.anyDisabled) { c.fillStyle = palette.brass; c.beginPath(); c.arc(button.x + 2, button.y + 2, 1.4, 0, Math.PI * 2); c.fill(); }
    if (this.menuOpen) this.drawMenu(c, width, height, pointer);
    c.restore();
  }

  private drawMenu(c: CanvasRenderingContext2D, width: number, height: number,
    pointer?: { x: number; y: number } | null): void {
    const menu = this.menuRect(width, height);
    c.fillStyle = `${palette.panel}fa`; c.fillRect(menu.x, menu.y, menu.width, menu.height);
    c.strokeStyle = palette.lineStrong; c.lineWidth = 1;
    c.strokeRect(menu.x + .5, menu.y + .5, menu.width - 1, menu.height - 1);
    TRACKING_KINDS.forEach((kind, i) => {
      const rowY = menu.y + MENU.pad + i * MENU.rowHeight;
      const hovered = pointer && pointer.x >= menu.x && pointer.x <= menu.x + menu.width
        && pointer.y >= rowY && pointer.y < rowY + MENU.rowHeight;
      if (hovered) { c.fillStyle = `${palette.silver}14`; c.fillRect(menu.x + 1, rowY, menu.width - 2, MENU.rowHeight); }
      const on = this.filter[kind], boxX = menu.x + 7, boxY = rowY + MENU.rowHeight / 2 - 4;
      c.fillStyle = on ? `${TRACKING_COLORS[kind]}30` : `${palette.well}`;
      c.fillRect(boxX, boxY, 8, 8);
      c.strokeStyle = on ? TRACKING_COLORS[kind] : palette.silverDim; c.lineWidth = 1;
      c.strokeRect(boxX + .5, boxY + .5, 7, 7);
      if (on) {
        c.strokeStyle = TRACKING_COLORS[kind]; c.lineWidth = 1.4; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(boxX + 1.8, boxY + 4.2); c.lineTo(boxX + 3.6, boxY + 6); c.lineTo(boxX + 6.4, boxY + 2); c.stroke();
      }
      drawBlipGlyph(c, kind, menu.x + 24, rowY + MENU.rowHeight / 2);
      text(c, TRACKING_LABELS[kind], menu.x + 33, rowY + 4.5, .8, on ? palette.text : palette.faint);
    });
  }
}
