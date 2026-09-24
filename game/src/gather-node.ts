/** World gather nodes (docs/wow-deepening.md §3): deterministic per-cell placement like
 * wilderness sites, a fixed-step gather channel, and the procedural node art.
 * Gathered state persists on `player.professions[prof].gathered` (node id → sim time). */
import { hash2 } from './random-source.ts';
import { getZoneAt } from './zone-progression.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { randomSource } from './items.ts';
import { GATHER_NODES, PROFESSIONS, PROFESSION_RULES, type GatherNodeDef } from './profession-content.ts';
import type { Input, Player, WorldQuery } from './model.ts';
import type { Simulation } from './simulation.ts';
import { GAME_FEATURES } from './game-features.ts';
import { gatheredAt, type ProfessionsCarrier } from './profession-state.ts';

export const GATHER_RULES = Object.freeze({
  /** One node cell is this many world pixels; 0–2 nodes per cell. */
  cellSize: 900,
  /** E-interact reach and the channel's break radius. */
  reach: 78,
  /** Channel seconds per gather. */
  channel: 2.5,
  /** Sim seconds before a gathered node respawns. */
  respawn: 300,
  cacheLimit: 256,
});

export interface GatherNode {
  readonly id: string;
  readonly def: GatherNodeDef;
  readonly x: number;
  readonly y: number;
  /** Zone-derived skill band used for banded yields (skinning). */
  readonly zoneSkill: number;
  readonly seed: number;
}

interface CellNodes { readonly nodes: readonly GatherNode[] }
const cellCache = new WeakMap<WorldQuery, Map<string, CellNodes>>();

function zoneSkillAt(world: WorldQuery, x: number, y: number): number {
  return Math.min(PROFESSION_RULES.maxSkill, Math.round(getZoneAt(x, y, world.seed ?? 7319).level * PROFESSION_RULES.zoneSkillFactor));
}

/** Deterministic cell contents: kind by biome affinity, def by zone skill band. */
function cellNodes(world: WorldQuery, cx: number, cy: number): readonly GatherNode[] {
  const seed = world.seed ?? 7319;
  const roll = (salt: number) => hash2(cx, cy, seed, salt) / 0x100000000;
  const countRoll = roll(0x6a17);
  const count = countRoll < .45 ? 0 : countRoll < .85 ? 1 : 2;
  if (!count) return [];
  const nodes: GatherNode[] = [];
  for (let i = 0; i < count; i++) {
    const x = (cx + .18 + .64 * roll(0x1000 + i * 3)) * GATHER_RULES.cellSize;
    const y = (cy + .18 + .64 * roll(0x2000 + i * 3)) * GATHER_RULES.cellSize;
    if (world.isSanctuary?.(x, y) || world.blocked(x, y, 6)) continue;
    const biome = world.sampleBiome?.(x, y)?.id;
    const zoneSkill = zoneSkillAt(world, x, y);
    // Kind roll: herbs vs ore vs carcass, weighted by biome affinity.
    const affinity = (def: GatherNodeDef) => biome ? def.biomes?.[biome] ?? .25 : 1;
    const groups = (['herbalism', 'mining', 'skinning'] as const).map(prof => {
      const eligible = (PROFESSIONS_NODES[prof] ?? []).map(id => GATHER_NODES[id])
        .filter((def): def is GatherNodeDef => !!def && def.skill[0] <= zoneSkill + 40);
      // Within the profession prefer the highest-skill nodes the zone supports (WoW zone tiers).
      const sorted = [...eligible].sort((a, b) => a.skill[0] - b.skill[0]);
      const fitting = sorted.filter(def => def.skill[0] <= zoneSkill);
      const pool = fitting.length ? fitting.slice(-3) : sorted.slice(0, 2);
      const weight = pool.reduce((sum, def) => sum + affinity(def), 0);
      return { pool, weight };
    }).filter(g => g.weight > 0 && g.pool.length);
    if (!groups.length) continue;
    let pick = roll(0x3000 + i) * groups.reduce((s, g) => s + g.weight, 0);
    const group = groups.find(g => (pick -= g.weight) < 0) ?? groups[groups.length - 1]!;
    const def = group.pool[Math.floor(roll(0x4000 + i) * group.pool.length)]!;
    nodes.push({ id: `gather:${seed}:${cx}:${cy}:${i}`, def, x, y, zoneSkill, seed: hash2(cx, cy, seed, 0x5000 + i) });
  }
  return nodes;
}
/** Node defs per gather profession, resolved once from PROFESSIONS.nodes. */
const PROFESSIONS_NODES: Record<string, readonly string[]> = Object.fromEntries(
  Object.values(PROFESSIONS).filter(p => p.nodes).map(p => [p.id, p.nodes!]));


/** Live (ungathered or respawned) nodes intersecting a world-space rect. */
export function gatherNodesIn(world: WorldQuery, carrier: ProfessionsCarrier, time: number,
  x: number, y: number, width: number, height: number): GatherNode[] {
  if (!GAME_FEATURES.professions || world.dungeonTheme !== undefined) return [];
  const { cellSize, cacheLimit } = GATHER_RULES;
  const minX = Math.floor(x / cellSize), maxX = Math.floor((x + width) / cellSize);
  const minY = Math.floor(y / cellSize), maxY = Math.floor((y + height) / cellSize);
  if ((maxX - minX + 1) * (maxY - minY + 1) > 256) return [];
  let cache = cellCache.get(world);
  if (!cache) cellCache.set(world, cache = new Map());
  const out: GatherNode[] = [];
  for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
    const key = `${cx}:${cy}`;
    let cell = cache.get(key);
    if (!cell) {
      cell = { nodes: cellNodes(world, cx, cy) };
      if (cache.size >= cacheLimit) cache.delete(cache.keys().next().value!);
      cache.set(key, cell);
    }
    for (const node of cell.nodes) {
      if (node.x < x || node.x >= x + width || node.y < y || node.y >= y + height) continue;
      const at = gatheredAt(carrier, node.def.profession, node.id);
      if (at !== undefined && time - at < GATHER_RULES.respawn) continue;
      out.push(node);
    }
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Minimap-tracking blips (AgentMinimap's TrackingSources.gatherNodes shape). */
export function gatherNodeBlips(world: WorldQuery, carrier: ProfessionsCarrier, time: number,
  x: number, y: number, width: number, height: number): { x: number; y: number; label: string }[] {
  return gatherNodesIn(world, carrier, time, x, y, width, height).map(n => ({ x: n.x, y: n.y, label: n.def.name }));
}

/** Nearest gatherable node in reach; pointer selects like focusEvent. */
export function focusGatherNode(world: WorldQuery, carrier: ProfessionsCarrier, time: number,
  player: Pick<Player, 'x' | 'y' | 'dead'>, pointer?: { x: number; y: number }): GatherNode | null {
  if (player.dead) return null;
  const nodes = gatherNodesIn(world, carrier, time, player.x - GATHER_RULES.reach, player.y - GATHER_RULES.reach, GATHER_RULES.reach * 2, GATHER_RULES.reach * 2);
  return nodes.filter(n => Math.hypot(n.x - player.x, n.y - player.y) <= GATHER_RULES.reach
      && (!pointer || Math.hypot(n.x - pointer.x, n.y - 14 - pointer.y) < 34)
      && hasLineOfSight(world, player.x, player.y, n.x, n.y))
    .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0] ?? null;
}

/** Why a node can't be gathered right now; null = E starts the channel. */
export function gatherProblem(player: Player, node: GatherNode): string | null {
  if (player.dead) return 'You are dead.';
  if (player.mounted) return 'Dismount first.';
  const level = player.professions?.[node.def.profession]?.level ?? 1;
  if (level < node.def.skill[0]) return `Requires ${node.def.profession === 'skinning' ? 'Skinning' : node.def.profession === 'mining' ? 'Mining' : 'Herbalism'} (${node.def.skill[0]}).`;
  return null;
}

/** Overhead label for the focused node, mirroring the [E] interact labels. */
export function gatherNodeLabel(player: Player, node: GatherNode, channeling: boolean): string {
  if (channeling) return node.def.name;
  const problem = gatherProblem(player, node);
  return problem ? `${node.def.name} · ${problem}` : `${node.def.name}  [E]`;
}

/** Deterministic per-gather yield roll: node seed + how many times it was harvested. */
export function rollNodeYields(node: GatherNode, attempt: number): { id: string; count: number }[] {
  const random = randomSource((node.seed ^ Math.imul(attempt + 1, 0x9E3779B9)) >>> 0);
  const count = (c: number | readonly [number, number]) => Array.isArray(c) ? c[0] + Math.floor(random() * (c[1] - c[0] + 1)) : c;
  const yields = node.def.bands
    ? [...node.def.bands].reverse().find(b => node.zoneSkill >= b.minZoneSkill)?.yields ?? []
    : node.def.yields;
  const out = yields.map(e => ({ id: e.id, count: count(e.count) })).filter(e => e.count > 0);
  for (const bonus of node.def.bonus ?? []) if (random() < bonus.chance) out.push({ id: bonus.id, count: bonus.count });
  return out;
}

// ── Channel (transient; keyed by Simulation like mount-state's summon cast) ────

export interface GatherChannel { readonly node: GatherNode; elapsed: number }
/** Keyed by the acting player (sim.player resolves per-actor in co-op), so each
 * player's gather channel is independent — a partner's input never cancels it. */
const channels = new WeakMap<Player, GatherChannel>();

export function gatherChannelOf(sim: Simulation): GatherChannel | null {
  return channels.get(sim.player) ?? null;
}
export function gatherChannelProgress(sim: Simulation): number {
  const channel = channels.get(sim.player);
  return channel ? Math.min(1, channel.elapsed / GATHER_RULES.channel) : 0;
}
export function cancelGatherChannel(sim: Simulation): void { channels.delete(sim.player); }

/** E on a focused node: validates, then starts the channel. Returns a problem to notify, or null. */
export function startGather(sim: Simulation, node: GatherNode): string | null {
  const p = sim.player;
  const problem = gatherProblem(p, node)
    ?? (Math.hypot(node.x - p.x, node.y - p.y) > GATHER_RULES.reach ? 'Move closer.' : null)
    ?? (!hasLineOfSight(sim.world, p.x, p.y, node.x, node.y) ? 'No line of sight.' : null);
  if (problem) return problem;
  // Owner-scoped cancels: a partner starting a gather must not cancel the other
  // player's in-progress portal/event channel.
  sim.eventChannel.cancelFor(p); sim.portal.cancelFor(p); sim.clearCombatInput();
  channels.set(sim.player, { node, elapsed: 0 });
  return null;
}

/** Fixed-step advance inside Simulation.step, beside eventChannel.advance. */
export function advanceGatherChannel(sim: Simulation, dt: number, input: Input): void {
  const channel = channels.get(sim.player);
  if (!channel) return;
  const p = sim.player;
  if (p.dead || input.moveX || input.moveY || input.attack || input.dodge || input.skillSlot !== null
    || p.attack || p.castTime > 0 || p.dash || p.dodgeTime > 0 || p.mounted
    // Only the gatherer's own channels interrupt — a partner's portal/event
    // channel must not cancel this player's gather.
    || sim.eventChannel.activeFor(p) || sim.portal.activeFor(p)
    || Math.hypot(p.x - channel.node.x, p.y - channel.node.y) > GATHER_RULES.reach) {
    channels.delete(sim.player);
    return;
  }
  channel.elapsed = Math.min(GATHER_RULES.channel, channel.elapsed + dt);
}
export function gatherChannelReady(sim: Simulation): boolean {
  const channel = channels.get(sim.player);
  return !!channel && channel.elapsed + 1e-9 >= GATHER_RULES.channel;
}


