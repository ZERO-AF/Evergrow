/** Quest markers (docs/wow-deepening.md §1): overhead !/? glyphs over givers and
 * objective dots on the world map. Pure projection + canvas drawing; the ledger
 * lives in quest-state.ts and giver resolution in quest-command.ts. */
import { projectMapPoint, type MapView } from './map-view.ts';
import { GAME_FEATURES } from './game-features.ts';
import type { Player } from './model.ts';
import type { WorldPOI } from './world-pois.ts';
import {
  QUEST_BY_ID, giverSpec, turnInSpec, type QuestDef, type QuestGiver,
} from './quest-content.ts';
import {
  QUEST_RULES, questAvailable, questPreviewable, questState,
  type QuestsCarrier,
} from './quest-state.ts';
import { questGiverAnchors, type QuestGiverAnchor, type QuestWorld } from './quest-command.ts';

export type QuestMarkKind = 'available' | 'turnIn' | 'pending' | 'locked';
export interface QuestMark {
  readonly x: number;
  readonly y: number;
  readonly mark: QuestMarkKind;
  /** Quests behind this marker (turn-ins first). */
  readonly quests: readonly QuestDef[];
  readonly label: string;
}

const sameSpec = (a: QuestGiver, b: QuestGiver) =>
  a.role === b.role && a.poi === b.poi && a.biome === b.biome && a.tier === b.tier;

/** Marker state for one giver spec: '?' beats '!' beats pending '?'. */
function markFor(player: Player, spec: QuestGiver): { mark: QuestMarkKind; quests: QuestDef[] } | null {
  const turnIns: QuestDef[] = [], offers: QuestDef[] = [], pending: QuestDef[] = [], locked: QuestDef[] = [];
  for (const def of Object.values(QUEST_BY_ID)) {
    const state = questState(player, def.id);
    if (state?.status === 'complete' && sameSpec(turnInSpec(def), spec)) turnIns.push(def);
    else if (state?.status === 'active' && sameSpec(turnInSpec(def), spec)) pending.push(def);
    else if (!state && sameSpec(giverSpec(def), spec)) {
      if (questAvailable(player, def)) offers.push(def);
      else if (questPreviewable(player, def)) locked.push(def);
    }
  }
  if (turnIns.length) return { mark: 'turnIn', quests: turnIns };
  if (offers.length) return { mark: 'available', quests: offers };
  if (pending.length) return { mark: 'pending', quests: pending };
  if (locked.length) return { mark: 'locked', quests: locked };
  return null;
}

function anchorLabel(anchor: QuestGiverAnchor, spec: QuestGiver): string {
  return spec.label ?? (anchor.kind === 'npc' ? anchor.npc.name
    : anchor.kind === 'poster' ? 'Wanted Poster' : anchor.poi.name);
}

/** Every giver anchor in view carrying a marker. Call once per frame from the
 * renderer; bounds should cover the visible world plus a small margin. */
export function questMarkers(world: QuestWorld, player: Player,
  x: number, y: number, width: number, height: number, time?: number): QuestMark[] {
  if (!GAME_FEATURES.quests) return [];
  const specs: QuestGiver[] = [];
  for (const def of Object.values(QUEST_BY_ID)) {
    const offer = giverSpec(def), turnIn = turnInSpec(def);
    if (!specs.some(s => sameSpec(s, offer))) specs.push(offer);
    if (!specs.some(s => sameSpec(s, turnIn))) specs.push(turnIn);
  }
  const marks: QuestMark[] = [];
  for (const spec of specs) {
    const result = markFor(player, spec);
    if (!result) continue;
    for (const anchor of questGiverAnchors(world, spec, x, y, width, height, time))
      marks.push({ x: anchor.x, y: anchor.y, mark: result.mark, quests: result.quests, label: anchorLabel(anchor, spec) });
  }
  return marks;
}

/** Marker for a single anchor (hover/focus checks). */
export function questMarkAt(world: QuestWorld, player: Player, anchor: QuestGiverAnchor): QuestMark | null {
  for (const mark of questMarkers(world, player, anchor.x - 1, anchor.y - 1, 2, 2))
    if (Math.hypot(mark.x - anchor.x, mark.y - anchor.y) < 1) return mark;
  return null;
}

// ── Overhead glyph drawing ───────────────────────────────────────────────────

const MARK_COLORS: Record<QuestMarkKind, string> = {
  available: '#f0c33c', turnIn: '#f0c33c', pending: '#9aa4a6', locked: '#8a7a4a',
};

/** WoW overhead glyph: golden ! / ?, grayed for pending and under-level offers.
 * `x`,`y` are screen coordinates of the anchor's head; `time` drives the bob. */
export function drawQuestMarker(c: CanvasRenderingContext2D, x: number, y: number,
  mark: QuestMarkKind, time = 0): void {
  const bob = mark === 'pending' || mark === 'locked' ? 0 : Math.sin(time * 3.2) * 2.5;
  const glyph = mark === 'available' || mark === 'locked' ? '!' : '?';
  c.save();
  c.translate(x, y - 14 + bob);
  c.font = '700 17px "Evergrow Numerals", system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineWidth = 4;
  c.strokeStyle = '#10130ccc';
  c.strokeText(glyph, 0, 0);
  c.fillStyle = MARK_COLORS[mark];
  c.fillText(glyph, 0, 0);
  c.restore();
}

// ── World-map objective markers ──────────────────────────────────────────────

export interface QuestMapMarker {
  readonly x: number;
  readonly y: number;
  readonly quest: QuestDef;
  readonly mark: 'objective' | 'turnIn';
  readonly label: string;
}

/** Nearest POI of a kind to a point, scanning expanding rings. */
function nearestPoi(world: QuestWorld, kind: string, x: number, y: number): WorldPOI | null {
  for (const span of QUEST_RULES.markerScan) {
    const hit = world.getPOIs(x - span / 2, y - span / 2, span, span)
      .filter(poi => poi.kind === kind)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (hit) return hit;
  }
  return null;
}

/** Nearest enemy camp (or boss lair) fielding the target kind. */
function nearestCamp(world: QuestWorld, kind: string, x: number, y: number): { x: number; y: number } | null {
  for (const span of QUEST_RULES.markerScan) {
    const hit = (world.getEnemyCamps?.(x - span / 2, y - span / 2, span, span) ?? [])
      .filter(camp => camp.members.some(member => member.kind === kind))
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (hit) return hit;
  }
  return null;
}

/** Objective anchor for an active quest: POI for explore, camp for kill/collect/boss. */
function objectiveAnchor(world: QuestWorld, def: QuestDef, state: { progress: number[] },
  x: number, y: number): { x: number; y: number } | null {
  for (const [i, objective] of def.objectives.entries()) {
    if ((state.progress[i] ?? 0) >= objective.count) continue;
    if (objective.kind === 'explore') {
      const poi = nearestPoi(world, objective.target, x, y);
      if (poi) return poi;
    } else {
      const kind = objective.kind === 'collect' ? objective.dropFrom ?? objective.target : objective.target;
      const camp = nearestCamp(world, kind, x, y);
      if (camp) return camp;
    }
  }
  return null;
}

/** Map markers for the quest log: objectives for active quests, giver for
 * complete ones. `known` POIs only — unexplored targets stay off the chart. */
export function questMapMarkers(world: QuestWorld, player: Player): QuestMapMarker[] {
  if (!GAME_FEATURES.quests) return [];
  const markers: QuestMapMarker[] = [];
  for (const def of Object.values(QUEST_BY_ID)) {
    const state = questState(player, def.id);
    if (!state || state.status === 'turnedIn') continue;
    if (state.status === 'complete') {
      const anchor = nearestGiverAnchorForMap(world, turnInSpec(def), player.x, player.y);
      if (anchor) markers.push({ x: anchor.x, y: anchor.y, quest: def, mark: 'turnIn', label: `Turn in: ${def.name}` });
    } else {
      const anchor = objectiveAnchor(world, def, state, player.x, player.y);
      if (anchor) markers.push({ x: anchor.x, y: anchor.y, quest: def, mark: 'objective', label: def.name });
    }
  }
  return markers;
}

function nearestGiverAnchorForMap(world: QuestWorld, spec: QuestGiver, x: number, y: number): { x: number; y: number } | null {
  for (const span of QUEST_RULES.markerScan) {
    const hit = questGiverAnchors(world, spec, x - span / 2, y - span / 2, span, span)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (hit) return hit;
  }
  return null;
}

/** Draw one quest marker on the world map/minimap: golden diamond for
 * objectives, '?' for turn-ins; off-view markers clamp to the edge. */
export function drawQuestMapMarker(c: CanvasRenderingContext2D, view: MapView, marker: QuestMapMarker): void {
  const p = projectMapPoint(marker.x, marker.y, view);
  const cx = view.x + view.width / 2, cy = view.y + view.height / 2;
  const dx = p.x - cx, dy = p.y - cy;
  const scale = Math.min(1, (view.width / 2 - 9) / Math.max(1, Math.abs(dx)), (view.height / 2 - 9) / Math.max(1, Math.abs(dy)));
  const x = cx + dx * scale, y = cy + dy * scale;
  c.save();
  c.beginPath();
  c.rect(view.x + 1, view.y + 1, view.width - 2, view.height - 2);
  c.clip();
  c.translate(x, y);
  if (marker.mark === 'turnIn') {
    c.font = '700 11px "Evergrow Numerals", system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 3;
    c.strokeStyle = '#10130ccc';
    c.strokeText('?', 0, 0);
    c.fillStyle = '#f0c33c';
    c.fillText('?', 0, 0);
  } else {
    c.rotate(Math.PI / 4);
    c.fillStyle = '#10130c';
    c.fillRect(-5, -5, 10, 10);
    c.fillStyle = '#f0c33c';
    c.fillRect(-3.4, -3.4, 6.8, 6.8);
  }
  c.restore();
}

/** Compact objective line for map tooltips and the tracker. */
export function questMarkerHint(player: QuestsCarrier, def: QuestDef): string {
  const state = questState(player, def.id);
  if (!state) return def.name;
  if (state.status === 'complete') return `${def.name} — ready to turn in`;
  const open = def.objectives.map((objective, i) => ({ objective, i }))
    .filter(({ objective, i }) => (state.progress[i] ?? 0) < objective.count)
    .map(({ objective, i }) => `${objective.label ?? objective.target} ${Math.min(state.progress[i] ?? 0, objective.count)}/${objective.count}`);
  return open.length ? `${def.name} — ${open.join(' · ')}` : def.name;
}
