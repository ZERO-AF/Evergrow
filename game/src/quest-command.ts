/** Durable quest commands (docs/wow-deepening.md §1): accept, turn-in, abandon,
 * plus the live progress hooks (kill/collect/explore) and giver resolution.
 * Ledger mutations that grant rewards stage on a checkpoint clone, persist,
 * then commit to the live player — mirroring profession-command/poi-command. */
import { cloneData } from './data-clone.ts';
import { awardCharacterExperience, refreshCharacter } from './character.ts';
import { addInventoryItem } from './inventory.ts';
import { canPackItem } from './inventory-grid.ts';
import { generateRewardItem } from './items.ts';
import { creditGold } from './wallet.ts';
import { xpLevelFactor } from './progression.ts';
import { pushChatMessage } from './chat-log.ts';
import { formatWalletCompact } from './currency.ts';
import { GAME_FEATURES } from './game-features.ts';
import { buildingNPC, canInteractNPC, hashService, positionedNPC, type TownNPC } from './npcs.ts';
import { grantMaterial, type ProfessionsCarrier } from './profession-state.ts';
import { PROFESSION_MATERIALS } from './profession-content.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { EnemyKind, Player, WorldQuery } from './model.ts';
import type { Simulation } from './simulation.ts';
import type { Building, Settlement } from './settlements.ts';
import type { WorldPOI } from './world-pois.ts';
import type { ItemKind } from './character-types.ts';
import {
  QUEST_BY_ID, QUEST_ITEMS, giverSpec, turnInSpec,
  type QuestDef, type QuestGiver, type QuestId,
} from './quest-content.ts';
import {
  QUEST_RULES, applyCollect, applyExplore, applyKill, questAvailable, questPreviewable,
  questState, resetDailies, stageAbandon, stageAccept, stageTurnIn, objectiveText,
  type QuestProgressNote, type QuestsCarrier,
} from './quest-state.ts';

export interface QuestResult { ok: boolean; message: string; quest?: QuestDef }
export type QuestPersist = (checkpoint: CharacterCheckpoint) => QuestResult | Promise<QuestResult>;

/** The checkpoint fields this feature stages; the integrator persists them on save. */
export type CheckpointWithQuests = CharacterCheckpoint & QuestsCarrier & ProfessionsCarrier;

const fail = (message: string): QuestResult => ({ ok: false, message });
const ok = (message: string, quest?: QuestDef): QuestResult => ({ ok: true, message, quest });

// ── Giver resolution ─────────────────────────────────────────────────────────

/** World surface needed to resolve givers and objective anchors. */
export interface QuestWorld extends WorldQuery {
  getPOIs(x: number, y: number, width: number, height: number): readonly WorldPOI[];
  getSettlements(x: number, y: number, width: number, height: number): readonly Settlement[];
}

/** A resolved giver anchor: an NPC, a settlement poster (hearth), or a POI. */
export type QuestGiverAnchor =
  | { readonly kind: 'npc'; readonly npc: TownNPC; readonly x: number; readonly y: number }
  | { readonly kind: 'poster'; readonly town: Settlement; readonly x: number; readonly y: number }
  | { readonly kind: 'poi'; readonly poi: WorldPOI; readonly x: number; readonly y: number };

function npcMatches(npc: TownNPC, building: Building | undefined, spec: QuestGiver): boolean {
  return npc.role === spec.role
    && (spec.tier === undefined || npc.settlementTier === spec.tier)
    && (spec.biome === undefined || building?.biome === spec.biome);
}

function poiMatches(poi: WorldPOI, spec: QuestGiver, world: QuestWorld): boolean {
  if (poi.kind !== spec.poi || spec.poi === 'town') return false;
  return spec.biome === undefined || world.sampleBiome?.(poi.x, poi.y).id === spec.biome;
}

/** The poster anchor for `poi: 'town'` givers: the settlement hearth, else its center. */
function posterAnchor(town: Settlement): { x: number; y: number } {
  const hearth = town.buildings.find(b => b.kind === 'hearth');
  return hearth ? { x: hearth.door.x, y: hearth.door.y } : { x: town.x, y: town.y };
}

function townMatches(town: Settlement, spec: QuestGiver): boolean {
  return spec.poi === 'town'
    && (spec.tier === undefined || town.kind === spec.tier)
    && (spec.biome === undefined || town.buildings[0]?.biome === spec.biome);
}

/** All anchors offering/accepting `spec` inside the bounds. When `time` (sim
 * seconds) is given, NPC anchors resolve to their daily-routine position. */
export function questGiverAnchors(world: QuestWorld, spec: QuestGiver,
  x: number, y: number, width: number, height: number, time?: number): QuestGiverAnchor[] {
  const anchors: QuestGiverAnchor[] = [];
  if (spec.role) {
    const towns = time === undefined ? [] : world.getSettlements(x - 1400, y - 1400, width + 2800, height + 2800);
    for (const building of world.getBuildings?.(x, y, width, height) ?? []) {
      const npc = buildingNPC(building);
      if (!npc || !npcMatches(npc, building, spec)) continue;
      const town = towns.find(t => t.buildings.some(b => b.id === building.id));
      const placed = positionedNPC(npc, town, time);
      anchors.push({ kind: 'npc', npc: placed, x: placed.x, y: placed.y });
    }
  } else if (spec.poi === 'town') {
    for (const town of world.getSettlements(x, y, width, height))
      if (townMatches(town, spec)) anchors.push({ kind: 'poster', town, ...posterAnchor(town) });
  } else if (spec.poi) {
    for (const poi of world.getPOIs(x, y, width, height))
      if (poiMatches(poi, spec, world)) anchors.push({ kind: 'poi', poi, x: poi.x, y: poi.y });
  }
  return anchors;
}

/** Nearest anchor for `spec` around a point; `reach` gates interaction distance. */
export function nearestGiverAnchor(world: QuestWorld, spec: QuestGiver, x: number, y: number, span = 900): QuestGiverAnchor | null {
  return questGiverAnchors(world, spec, x - span / 2, y - span / 2, span, span)
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] ?? null;
}

/** Whether the player can interact with this anchor right now. */
export function giverInReach(anchor: QuestGiverAnchor, player: { x: number; y: number; dead?: boolean }, world: WorldQuery): boolean {
  if (anchor.kind === 'npc') return canInteractNPC(anchor.npc, player, world);
  return !player.dead && Math.hypot(player.x - anchor.x, player.y - anchor.y) <= QUEST_RULES.poiReach;
}

/** Display name for a giver spec ("Marshal Dughan", "Wanted Poster", role name). */
export function giverLabel(spec: QuestGiver): string {
  return spec.label ?? spec.role ?? 'Notice';
}

// ── Quests at a giver ────────────────────────────────────────────────────────

export interface QuestGreeting {
  readonly anchor: QuestGiverAnchor;
  readonly label: string;
  /** Ready to turn in (status 'complete'). */
  readonly turnIns: readonly QuestDef[];
  /** Offerable at the player's level. */
  readonly offers: readonly QuestDef[];
  /** Unlocked but under-level (shown grayed). */
  readonly upcoming: readonly QuestDef[];
  /** Active but unfinished quests this giver accepts (gray `?`). */
  readonly pending: readonly QuestDef[];
  /** True when the anchor is a service NPC that also trades. */
  readonly service: boolean;
}

/** Quests relevant to one giver spec, bucketed for the dialog. */
export function questsAtGiver(player: Player, spec: QuestGiver): Omit<QuestGreeting, 'anchor' | 'label' | 'service'> {
  const turnIns: QuestDef[] = [], offers: QuestDef[] = [], upcoming: QuestDef[] = [], pending: QuestDef[] = [];
  // A daily turned in before today's UTC boundary re-offers here.
  resetDailies(player);
  for (const def of Object.values(QUEST_BY_ID)) {
    const state = questState(player, def.id);
    const sameGiver = (s: QuestGiver) => s.role === spec.role && s.poi === spec.poi
      && s.biome === spec.biome && s.tier === spec.tier;
    if (state?.status === 'complete' && sameGiver(turnInSpec(def))) turnIns.push(def);
    else if (state?.status === 'active' && sameGiver(turnInSpec(def))) pending.push(def);
    else if (!state && sameGiver(giverSpec(def))) {
      if (questAvailable(player, def)) offers.push(def);
      else if (questPreviewable(player, def)) upcoming.push(def);
    }
  }
  return { turnIns, offers, upcoming, pending };
}

/** E-interact entry: resolve the nearest giver with quest business in reach.
 * Returns null so the caller falls through to NPC/site interacts. */
export function questInteract(sim: Simulation, world: QuestWorld, pointer?: { x: number; y: number }): QuestGreeting | null {
  if (!GAME_FEATURES.quests || sim.dungeonFloor || sim.player.dead) return null;
  const p = sim.player;
  const candidates: { anchor: QuestGiverAnchor; spec: QuestGiver; greeting: Omit<QuestGreeting, 'anchor' | 'label' | 'service'> }[] = [];
  const seen = new Set<string>();
  const consider = (spec: QuestGiver) => {
    const key = `${spec.role ?? ''}:${spec.poi ?? ''}:${spec.biome ?? ''}:${spec.tier ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    const buckets = questsAtGiver(p, spec);
    if (!buckets.turnIns.length && !buckets.offers.length && !buckets.upcoming.length && !buckets.pending.length) return;
    for (const anchor of questGiverAnchors(world, spec, p.x - 320, p.y - 320, 640, 640, sim.time)) candidates.push({ anchor, spec, greeting: buckets });
  };
  for (const def of Object.values(QUEST_BY_ID)) { consider(giverSpec(def)); consider(turnInSpec(def)); }
  const hit = candidates
    .filter(c => giverInReach(c.anchor, p, world)
      && (!pointer || Math.hypot(pointer.x - c.anchor.x, pointer.y - (c.anchor.y - 17)) <= 40))
    .sort((a, b) => Math.hypot(p.x - a.anchor.x, p.y - a.anchor.y) - Math.hypot(p.x - b.anchor.x, p.y - b.anchor.y))[0];
  if (!hit) return null;
  return {
    anchor: hit.anchor, ...hit.greeting,
    label: hit.spec.label ?? (hit.anchor.kind === 'npc' ? hit.anchor.npc.name
      : hit.anchor.kind === 'poster' ? 'Wanted Poster' : hit.anchor.poi.name),
    service: hit.anchor.kind === 'npc',
  };
}

// ── Durable ledger commands ──────────────────────────────────────────────────

function stageLedger(sim: Simulation, checkpoint: CheckpointWithQuests): CheckpointWithQuests {
  checkpoint.quests = cloneData(sim.player.quests) as CheckpointWithQuests['quests'];
  return checkpoint;
}

/** Accept a quest: ledger entry persists before it goes live. */
export async function questAccept(sim: Simulation, id: QuestId, persist: QuestPersist): Promise<QuestResult> {
  const def = QUEST_BY_ID[id], p = sim.player;
  if (!GAME_FEATURES.quests) return fail('Quests are not available.');
  if (!def) return fail('Unknown quest.');
  if (p.dead) return fail('You are dead.');
  // Sweep yesterday's daily receipts so a reset daily can be re-accepted.
  resetDailies(p);
  if (questState(p, id)) return fail('Quest already accepted.');
  if (!questAvailable(p, def)) return fail(p.level < def.level ? `Requires level ${def.level}.` : 'Quest is not available.');
  const checkpoint = stageLedger(sim, sim.captureCheckpoint() as CheckpointWithQuests);
  stageAccept(checkpoint, def);
  const result = await persist(checkpoint);
  if (!result.ok) return result;
  p.quests = checkpoint.quests as Player['quests'];
  pushChatMessage(p, 'quest', `Quest accepted: ${def.name}`, sim.time);
  return ok(`Quest accepted: ${def.name}`, def);
}

/** Abandon an active/complete quest; turned-in receipts are permanent. */
export async function questAbandon(sim: Simulation, id: QuestId, persist: QuestPersist): Promise<QuestResult> {
  const def = QUEST_BY_ID[id], p = sim.player;
  if (!def) return fail('Unknown quest.');
  const state = questState(p, id);
  if (!state || state.status === 'turnedIn') return fail('This quest cannot be abandoned.');
  const checkpoint = stageLedger(sim, sim.captureCheckpoint() as CheckpointWithQuests);
  stageAbandon(checkpoint, id);
  const result = await persist(checkpoint);
  if (!result.ok) return result;
  p.quests = checkpoint.quests as Player['quests'];
  pushChatMessage(p, 'quest', `Quest abandoned: ${def.name}`, sim.time);
  return ok(`Quest abandoned: ${def.name}`, def);
}

/** Turn in a complete quest: xp/gold/items/skill points commit atomically. */
export async function questTurnIn(sim: Simulation, id: QuestId, persist: QuestPersist, now = Date.now()): Promise<QuestResult> {
  const def = QUEST_BY_ID[id], p = sim.player;
  if (!GAME_FEATURES.quests) return fail('Quests are not available.');
  if (!def) return fail('Unknown quest.');
  if (questState(p, id)?.status !== 'complete') return fail('Quest is not complete.');
  const checkpoint = stageLedger(sim, sim.captureCheckpoint() as CheckpointWithQuests);
  // Material rewards ride the profession bags; stage them only when needed.
  const materials = (def.rewards.items ?? []).filter(item => Object.hasOwn(PROFESSION_MATERIALS, item));
  if (materials.length) {
    checkpoint.professions = cloneData(p.professions) as CheckpointWithQuests['professions'];
    checkpoint.fishing = cloneData(p.fishing) as CheckpointWithQuests['fishing'];
  }
  const gear = (def.rewards.items ?? []).filter(item => item.startsWith('gear:'))
    .map((item, i) => generateRewardItem(hashService(`${def.id}:${i}`), def.level, item.slice(5) as ItemKind));
  for (const item of gear) if (!canPackItem(checkpoint.character, item)) return fail('Your bags are full.');
  stageTurnIn(checkpoint, id, now);
  const staged = { ...p, character: checkpoint.character, level: checkpoint.level, xp: checkpoint.xp };
  const xp = Math.round(def.rewards.xp * xpLevelFactor(p.level, def.level) * p.derived.xpGainMultiplier);
  if (xp > 0) awardCharacterExperience(staged, xp);
  checkpoint.character = staged.character;
  checkpoint.level = staged.level;
  checkpoint.xp = staged.xp;
  if (def.rewards.gold > 0 && !creditGold(checkpoint.character, def.rewards.gold)) return fail('Your purse cannot hold the reward.');
  for (const item of gear) addInventoryItem(checkpoint.character, item);
  for (const material of materials) grantMaterial(checkpoint, material, 1);
  if (def.rewards.skillPoints) checkpoint.character.skillPoints += def.rewards.skillPoints;
  const result = await persist(checkpoint);
  if (!result.ok) return result;
  const levels = checkpoint.level - p.level;
  p.quests = checkpoint.quests as Player['quests'];
  p.professions = checkpoint.professions as Player['professions'];
  p.fishing = checkpoint.fishing as Player['fishing'];
  p.character = checkpoint.character;
  p.level = checkpoint.level;
  p.xp = checkpoint.xp;
  refreshCharacter(p);
  const parts = [`Quest complete: ${def.name}`];
  if (xp > 0) parts.push(`${xp} XP`);
  if (def.rewards.gold > 0) parts.push(formatWalletCompact(def.rewards.gold));
  for (const item of gear) parts.push(`[${item.name}]`);
  for (const material of materials) parts.push(`[${PROFESSION_MATERIALS[material].name}]`);
  if (def.rewards.skillPoints) parts.push(`${def.rewards.skillPoints} skill point${def.rewards.skillPoints > 1 ? 's' : ''}`);
  pushChatMessage(p, 'quest', parts.join(' · '), sim.time);
  if (levels > 0) pushChatMessage(p, 'level', `You have reached level ${p.level}!`, sim.time);
  return ok(parts.join(' · '), def);
}

// ── Live progress hooks (call sites: kill path, pickup, POI discovery) ───────

function reportNotes(sim: Simulation, notes: readonly QuestProgressNote[]): void {
  for (const note of notes) {
    const item = note.objective.kind === 'collect' ? `[${QUEST_ITEMS[note.objective.target] ?? note.objective.target}] ` : '';
    pushChatMessage(sim.player, 'quest',
      `${item}${objectiveText(note.objective, note.progress)}`, sim.time);
    if (note.completed)
      pushChatMessage(sim.player, 'quest', `${note.quest.name} complete — return to ${giverLabel(turnInSpec(note.quest))}.`, sim.time);
  }
}

/** Kill path: feed the slain enemy kind. Returns the progress notes applied. */
export function questOnKill(sim: Simulation, kind: EnemyKind, random: () => number = Math.random): QuestProgressNote[] {
  if (!GAME_FEATURES.quests) return [];
  const notes = applyKill(sim.player, kind, random);
  reportNotes(sim, notes);
  return notes;
}

/** Ground-item pickup / gather yield: feed the item or material id. */
export function questOnCollect(sim: Simulation, itemId: string, count = 1): QuestProgressNote[] {
  if (!GAME_FEATURES.quests) return [];
  const notes = applyCollect(sim.player, itemId, count);
  reportNotes(sim, notes);
  return notes;
}

/** POI discovery (exploration onDiscover) or arrival at a matching site. */
export function questOnExplore(sim: Simulation, poi: { id: string; kind: string }): QuestProgressNote[] {
  if (!GAME_FEATURES.quests) return [];
  const notes = applyExplore(sim.player, poi);
  reportNotes(sim, notes);
  return notes;
}

/** Movement tick: credit explore objectives for POIs the player stands near,
 * including sites discovered before the quest was accepted. Cheap to call every
 * few hundred ms — dedupe lives on the ledger's `visited` list. */
export function questExploreScan(sim: Simulation, world: QuestWorld): QuestProgressNote[] {
  if (!GAME_FEATURES.quests || sim.dungeonFloor) return [];
  const p = sim.player;
  const needed = new Set<string>();
  for (const def of Object.values(QUEST_BY_ID)) {
    const state = questState(p, def.id);
    if (state?.status !== 'active') continue;
    def.objectives.forEach((objective, i) => {
      if (objective.kind === 'explore' && (state.progress[i] ?? 0) < objective.count) needed.add(objective.target);
    });
  }
  if (!needed.size) return [];
  const r = QUEST_RULES.exploreRadius;
  const notes: QuestProgressNote[] = [];
  for (const poi of world.getPOIs(p.x - r, p.y - r, r * 2, r * 2)) {
    if (!needed.has(poi.kind) || Math.hypot(poi.x - p.x, poi.y - p.y) > r) continue;
    notes.push(...applyExplore(p, poi));
  }
  reportNotes(sim, notes);
  return notes;
}
