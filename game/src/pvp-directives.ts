import type { Combatant } from './pvp-combatant.ts';

/** Where an objective controller wants this combatant to be. Consumed by
 * `decideCombatantInput` (pvp-ai.ts): the combatant moves within `within` of the
 * point and only diverts to fight while a hostile is inside `engage` (0 = never
 * divert — a flag carrier keeps running). */
export interface ObjectiveDirective {
    readonly x: number;
    readonly y: number;
    readonly within: number;
    readonly engage: number;
}
const DIRECTIVES = new WeakMap<Combatant, ObjectiveDirective>();
/** The combatant's current objective directive, if a controller assigned one. */
export const objectiveDirective = (combatant: Combatant): ObjectiveDirective | undefined => DIRECTIVES.get(combatant);
/** Publish/clear a directive. Controllers re-issue these every update. */
export function setObjectiveDirective(combatant: Combatant, directive: ObjectiveDirective | undefined): void {
    if (directive) DIRECTIVES.set(combatant, directive); else DIRECTIVES.delete(combatant);
}
