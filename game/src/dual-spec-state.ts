/** Dual talent specialization (WotLK): two saved talent builds the player swaps
 * between out of combat. State lives on the character sheet as `specs` +
 * `activeSpec` so it rides the existing checkpoint/save pipeline; the integrator
 * adds the two fields to CharacterSheet and calls `validSpecs` from validSheet.
 *
 * Model: `specs` holds BOTH builds. `specs[activeSpec]` mirrors the live sheet
 * fields (allocatedNodes, skillSlots, skillRanks, activeSkillRanks,
 * skillSpecializations, arcaneOverload) and is re-snapshotted on every swap;
 * `specs[1 - activeSpec]` is the dormant build. Unspent points are never stored:
 * each spec draws from the shared level pool, so the live `skillPoints` is
 * recomputed as `level - 1 - spent(active)` on every swap and the save-time
 * conservation invariant holds for whichever spec is active. */
import { GAME_FEATURES } from './game-features.ts';
import { SKILL_NODES, SKILL_TREE_ORIGIN, doctrineConflict, freeNodeCount, unlockedSkills } from './skill-tree.ts';
import { validSkillProgression } from './skill-progression.ts';
import { BAR_TOTAL } from './action-bar.ts';
import { object, text } from './item-validation.ts';
import type { CharacterSheet, SkillId } from './character-types.ts';
import type { WowClassId, WowRaceId } from './wow-types.ts';
import type { Player } from './model.ts';
import type { Simulation } from './simulation.ts';
import { summonCast } from './mount-state.ts';
import { trainedNodeIds, trainedRankCount, trainedOf } from './trainer-state.ts';
import { gatherChannelOf } from './gather-node.ts';

/** Local gate until the integrator adds `dualSpec` to GAME_FEATURES. */
export const dualSpecEnabled = (): boolean =>
  !('dualSpec' in GAME_FEATURES) || GAME_FEATURES.dualSpec !== false;

/** WotLK dual spec: purchasable at level 40 for 1000 gold (wallet stores copper). */
export const DUAL_SPEC_LEVEL = 40;
export const DUAL_SPEC_COST = 1_000 * 10_000;
export const DUAL_SPEC_COUNT = 2;
export const DUAL_SPEC_NAMES = ['Primary', 'Secondary'] as const;
export const SPEC_NAME_MAX = 24;

/** One saved talent build. `skillPoints` is deliberately absent — it derives
 * from the shared level pool minus this build's spent points. */
export interface TalentSpec {
  name: string;
  allocatedNodes: string[];
  skillSlots: Array<SkillId | null>;
  skillRanks: Partial<Record<SkillId, number>>;
  activeSkillRanks: Partial<Record<SkillId, number>>;
  skillSpecializations: Partial<Record<SkillId, string>>;
  arcaneOverload: boolean;
}

/** CharacterSheet view with the dual-spec fields the integrator adds. */
export type DualSpecSheet = CharacterSheet & { specs?: TalentSpec[]; activeSpec?: number };

/** A fresh build: the free origin node, empty bars, every point unspent. */
export function emptySpec(name: string): TalentSpec {
  return {
    name,
    allocatedNodes: [SKILL_TREE_ORIGIN],
    skillSlots: Array<SkillId | null>(BAR_TOTAL).fill(null),
    skillRanks: {},
    activeSkillRanks: {},
    skillSpecializations: {},
    arcaneOverload: false,
  };
}

export const dualSpecUnlocked = (sheet: DualSpecSheet): boolean => !!sheet.specs?.length;

export function activeSpecIndex(sheet: DualSpecSheet): number {
  const active = sheet.activeSpec ?? 0;
  return sheet.specs && active >= 0 && active < sheet.specs.length ? active : 0;
}

export function inactiveSpecIndex(sheet: DualSpecSheet): number {
  return (activeSpecIndex(sheet) + 1) % (sheet.specs?.length || DUAL_SPEC_COUNT);
}

/** Points a build spends: every allocated node except the free ones (origin +
 * the class starter) and gold-trained nodes (those cost gold, not points), plus
 * purchased skill ranks beyond the first. Mirrors commerce.ts respecPoints and
 * validSheet's conservation ledger. */
export function specSpentPoints(spec: Pick<TalentSpec, 'allocatedNodes' | 'skillRanks'>, trainedIds: readonly string[] = []): number {
  const trained = new Set(trainedIds);
  return spec.allocatedNodes.filter(id => !trained.has(id)).length - freeNodeCount(spec.allocatedNodes)
    + Object.values(spec.skillRanks).reduce((sum, rank) => sum + rank - 1, 0);
}

/** Points this build would leave unspent at the given level. */
export function specUnspentPoints(spec: Pick<TalentSpec, 'allocatedNodes' | 'skillRanks'>, level: number): number {
  return Math.max(0, level - 1 - specSpentPoints(spec));
}

/** Snapshot the sheet's live build fields, preserving the stored spec's name. */
export function captureSpec(sheet: DualSpecSheet, name: string): TalentSpec {
  const trained = new Set(trainedNodeIds(sheet));
  const trainedSkills = new Set(trainedOf(sheet).skills);
  const skillRanks: Partial<Record<SkillId, number>> = {};
  for (const [id, rank] of Object.entries(sheet.skillRanks)) {
    const paid = rank - trainedRankCount(sheet, id as SkillId);
    if (paid >= 2) skillRanks[id as SkillId] = paid;
  }
  const activeSkillRanks: Partial<Record<SkillId, number>> = {};
  for (const [id, rank] of Object.entries(sheet.activeSkillRanks)) {
    const paid = Math.min(rank - trainedRankCount(sheet, id as SkillId), skillRanks[id as SkillId] ?? rank);
    if (paid >= 2) activeSkillRanks[id as SkillId] = paid;
  }
  const skillSpecializations = { ...sheet.skillSpecializations };
  for (const id of trainedSkills) delete skillSpecializations[id];
  return {
    name,
    allocatedNodes: sheet.allocatedNodes.filter(id => !trained.has(id)),
    skillSlots: sheet.skillSlots.map(id => id !== null && trainedSkills.has(id) ? null : id),
    skillRanks,
    activeSkillRanks,
    skillSpecializations,
    arcaneOverload: sheet.arcaneOverload,
  };
}

export function applySpec(sheet: DualSpecSheet, spec: TalentSpec, level: number): void {
  sheet.allocatedNodes = [...spec.allocatedNodes, ...trainedNodeIds(sheet).filter(id => !spec.allocatedNodes.includes(id))];
  sheet.skillSlots = [...spec.skillSlots];
  sheet.skillRanks = { ...spec.skillRanks };
  sheet.activeSkillRanks = { ...spec.activeSkillRanks };
  for (const id of trainedOf(sheet).skills) {
    const total = (spec.skillRanks[id] ?? 1) + trainedRankCount(sheet, id);
    sheet.skillRanks[id] = total;
    sheet.activeSkillRanks[id] = Math.min(spec.activeSkillRanks[id] ?? total, total);
  }
  sheet.skillSpecializations = { ...spec.skillSpecializations };
  sheet.arcaneOverload = spec.arcaneOverload;
  sheet.skillPoints = level - 1 - specSpentPoints(spec, trainedNodeIds(sheet));
}

/** Re-mirror the live build into its spec slot. Optional housekeeping for the
 * integrator (e.g. before saving); the swap command re-snapshots on its own. */
export function syncActiveSpec(sheet: DualSpecSheet): void {
  const specs = sheet.specs;
  if (!specs?.length) return;
  const active = activeSpecIndex(sheet);
  specs[active] = captureSpec(sheet, specs[active]?.name ?? DUAL_SPEC_NAMES[active] ?? 'Spec');
}

/** A tree-version refund wipes every stored build back to a fresh origin spec;
 * the unlock itself is kept. For skill-tree-upgrade.ts when the tree migrates. */
export function resetSpecs(sheet: DualSpecSheet): void {
  if (!sheet.specs) return;
  sheet.specs = sheet.specs.map((spec, i) => emptySpec(spec.name || DUAL_SPEC_NAMES[i] || 'Spec'));
  sheet.activeSpec = 0;
}

/** Strict stored-build validation for the save boundary. Mirrors validSheet's
 * tree checks (known nodes, uniqueness, doctrine exclusivity, origin-rooted
 * connectivity) plus class gating and the shared point budget. */
export function validSpec(spec: unknown, classId: WowClassId, raceId: WowRaceId, level: number, trainedIds: readonly string[] = []): spec is TalentSpec {
  if (!object(spec) || !text(spec.name, SPEC_NAME_MAX)) return false;
  const nodes = spec.allocatedNodes;
  if (!Array.isArray(nodes) || !nodes.length || nodes.length > SKILL_NODES.size
    || !nodes.includes(SKILL_TREE_ORIGIN)
    || !nodes.every(id => typeof id === 'string' && SKILL_NODES.has(id))
    || new Set(nodes).size !== nodes.length) return false;
  for (const id of nodes) {
    const node = SKILL_NODES.get(id)!;
    if (node.classId && node.classId !== classId) return false;
    if (doctrineConflict(nodes as string[], node)) return false;
  }
  // Connectivity runs over the effective build: the spec's own nodes plus the
  // trained nodes applySpec re-installs. A bought node whose only route passes
  // through a trained node is legal, so trained ids seed the walk like
  // validSheet does.
  const trained = new Set(trainedIds), effective = new Set([...nodes, ...trained] as string[]);
  const connected = new Set([SKILL_TREE_ORIGIN, ...trained]), queue = [SKILL_TREE_ORIGIN, ...trained];
  for (let i = 0; i < queue.length; i++) for (const next of SKILL_NODES.get(queue[i])!.neighbors) {
    if (effective.has(next) && !connected.has(next)) { connected.add(next); queue.push(next); }
  }
  if (connected.size !== effective.size) return false;
  const unlocked = unlockedSkills(nodes as string[]);
  if (!Array.isArray(spec.skillSlots) || spec.skillSlots.length !== BAR_TOTAL
    || !spec.skillSlots.every(id => id === null || unlocked.includes(id as SkillId))
    || new Set(spec.skillSlots.filter(Boolean)).size !== spec.skillSlots.filter(Boolean).length) return false;
  // Reuse the live progression validator against a pseudo-sheet carrying the spec's fields.
  const pseudo = { classId, raceId, allocatedNodes: nodes, skillSlots: spec.skillSlots,
    skillRanks: spec.skillRanks, activeSkillRanks: spec.activeSkillRanks,
    skillSpecializations: spec.skillSpecializations, arcaneOverload: spec.arcaneOverload } as CharacterSheet;
  if (!validSkillProgression(pseudo)) return false;
  // validSkillProgression proved skillRanks is a rank record; nodes are known strings.
  const spent = specSpentPoints({ allocatedNodes: nodes as string[], skillRanks: spec.skillRanks as TalentSpec['skillRanks'] }, trainedIds);
  return spent <= level - 1;
}

/** Save-boundary validation for the sheet's dual-spec fields: absent or a full
 * pair of legal builds with a consistent active index. */
export function validSpecs(specs: unknown, activeSpec: unknown, classId: WowClassId, raceId: WowRaceId, level: number, trainedIds: readonly string[] = []): boolean {
  if (specs === undefined) return activeSpec === undefined;
  return Array.isArray(specs) && specs.length === DUAL_SPEC_COUNT
    && Number.isSafeInteger(activeSpec) && (activeSpec as number) >= 0 && (activeSpec as number) < specs.length
    && specs.every(spec => validSpec(spec, classId, raceId, level, trainedIds));
}

/** Enemy states that mean the fight is on (or the camp is still leashing back). */
const ENGAGED_STATES: Record<string, true> = { chase: true, windup: true, attack: true, recover: true, return: true };

/** Why a spec swap cannot happen right now; null means the swap may proceed. */
export function dualSpecProblem(sim: Simulation): string | null {
  if (!dualSpecEnabled()) return 'Dual specialization is not available.';
  const p = sim.player;
  if (p.dead) return 'You cannot swap specializations while defeated.';
  if (sim.dungeonFloor || sim.expeditions.location) return 'You cannot swap specializations inside a dungeon.';
  if (p.cast || p.castTime > 0 || p.attack || p.dash || p.dodgeTime > 0 || p.hitFlash > 0
    || p.cc?.some(cc => cc.remaining > 0)) return 'You cannot swap specializations right now.';
  if (sim.portal.active || sim.hearthstone.active || sim.eventChannel.site
    || summonCast(sim) || gatherChannelOf(sim)) return 'Finish your current action first.';
  if (p.autoAttack && p.targetId != null && sim.enemies.some(e => e.id === p.targetId && e.state !== 'dead'))
    return 'You cannot swap specializations in combat.';
  if (p.allies?.some(ally => ally.hp > 0 && ally.targetId !== null
    && sim.enemies.some(e => e.id === ally.targetId && e.state !== 'dead')))
    return 'You cannot swap specializations in combat.';
  if (sim.enemies.some(e => e.state !== 'dead' && (ENGAGED_STATES[e.state] || (e.taunted?.remaining ?? 0) > 0)))
    return 'You cannot swap specializations in combat.';
  return null;
}

/** Per-spec summary for the atlas/stats UI. The active spec reports live sheet
 * values (its stored mirror may lag until the next swap). */
export interface DualSpecView {
  unlocked: boolean;
  active: number;
  specs: Array<{ name: string; spent: number; unspent: number; skills: number }>;
}

export function dualSpecView(player: Player): DualSpecView {
  const sheet = player.character as DualSpecSheet;
  const specs = sheet.specs ?? [];
  const active = activeSpecIndex(sheet);
  return {
    unlocked: dualSpecUnlocked(sheet),
    active,
    specs: specs.map((spec, i) => i === active
      ? {
        name: spec.name,
        // The live sheet's spent points are the pool minus what's unspent;
        // specSpentPoints would count trained nodes/ranks as point-bought.
        spent: Math.max(0, player.level - 1 - sheet.skillPoints),
        unspent: Math.max(0, sheet.skillPoints),
        skills: unlockedSkills(sheet.allocatedNodes).length,
      }
      : {
        name: spec.name,
        spent: specSpentPoints(spec),
        unspent: specUnspentPoints(spec, player.level),
        skills: unlockedSkills(spec.allocatedNodes).length,
      }),
  };
}
