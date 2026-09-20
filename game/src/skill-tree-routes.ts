import type { ActionResult, CharacterSheet } from './character-types.ts';
import { SKILL_NODES, doctrineConflict } from './skill-tree.ts';

export interface SkillRouteStep {
  readonly cost: number;
  readonly previous: string | null;
}

/** Fewest additional points from any owned node. This is a preview, never an allocation.
 *  Class-gated nodes are only routable for the matching class; no classId previews none. */
export function buildSkillRoutes(allocated: ReadonlySet<string>, classId?: string): Map<string, SkillRouteStep> {
  const routes = new Map<string, SkillRouteStep>();
  // Sort both roots and branches so equivalent builds always preview the same tied route.
  const queue = [...allocated].filter(id => SKILL_NODES.has(id)).sort();
  for (const id of queue) routes.set(id, { cost: 0, previous: null });

  for (let index = 0; index < queue.length; index++) {
    const id = queue[index], cost = routes.get(id)!.cost;
    for (const neighbor of [...SKILL_NODES.get(id)!.neighbors].sort()) {
      const neighborNode=SKILL_NODES.get(neighbor)!;
      if (routes.has(neighbor) || neighborNode.classId && neighborNode.classId !== classId || doctrineConflict(allocated,neighborNode)) continue;
      routes.set(neighbor, { cost: cost + 1, previous: id });
      queue.push(neighbor);
    }
  }
  return routes;
}

/** Ordered owned anchor → destination, including both; missing routes have no preview. */
export function previewSkillRoute(routes: ReadonlyMap<string, SkillRouteStep>, nodeId: string): string[] {
  const path: string[] = [], visited = new Set<string>();
  let current: string | null = nodeId;
  while (current !== null) {
    if (visited.has(current)) return [];
    const step: SkillRouteStep | undefined = routes.get(current);
    if (!step) return [];
    visited.add(current); path.push(current);
    current = step.previous;
  }
  return path.reverse();
}

/** Allocate the same shortest route shown in the atlas, all or nothing. Class-gated nodes reject foreign classes. */
export function allocateSkillRoute(sheet: CharacterSheet, nodeId: string): ActionResult {
  const target = SKILL_NODES.get(nodeId);
  if (!target) return { ok: false, message: 'Unknown node.' };
  if (target.classId && target.classId !== sheet.classId) return { ok: false, message: 'Only a member of this class can learn this.' };
  if(doctrineConflict(sheet.allocatedNodes,target))return{ok:false,message:target.spec?'Choose only one specialization for your class.':'Choose only one Doctrine in each family.'};
  const owned = new Set(sheet.allocatedNodes);
  if (owned.has(nodeId)) return { ok: false, message: 'Already allocated.' };
  const path = previewSkillRoute(buildSkillRoutes(owned, sheet.classId), nodeId).filter(id => !owned.has(id));
  if (!path.length) return { ok: false, message: 'No connected path.' };
  if (path.some(id => { const n = SKILL_NODES.get(id)!; return n.classId && n.classId !== sheet.classId; }))
    return { ok: false, message: 'Only a member of this class can learn this.' };
  if (!Number.isSafeInteger(sheet.skillPoints) || sheet.skillPoints < path.length)
    return { ok: false, message: `Requires ${path.length} skill ${path.length === 1 ? 'point' : 'points'}.` };
  delete sheet.treeRefunded;
  sheet.allocatedNodes.push(...path);
  sheet.skillPoints -= path.length;
  for (const id of path) {
    const node = SKILL_NODES.get(id)!;
    if (node.specialization && node.developmentSkill) sheet.skillSpecializations[node.developmentSkill] = node.specialization;
  }
  return { ok: true };
}
