/** Battleground match setup (wayfinder T07): the entry path for Warsong Gulch
 * and Arathi Basin. `enterBattleground` normalizes the wizard's setup to the
 * bracket's team size (WSG 5v5, AB 8v8 — inside the combatant budget the sim
 * drives), delegates travel/roster placement to `enterPvpMatch`, then attaches
 * the objective controller so the match loop's `match.objectives` seam is live.
 *
 * `attachBattlegroundObjectives` (pvp-objectives.ts) is idempotent and
 * reload-safe, so the per-tick match loop may also call it directly — this
 * wrapper exists so the entry path alone is enough. */
import { enterPvpMatch, type PvpMatchHost } from './pvp-instance.ts';
import { attachBattlegroundObjectives } from './pvp-objectives.ts';
import { pvpClassRoles, pvpTeamSize, type PvpSetup, type PvpTeammate } from './pvp-setup.ts';
import { WOW_CLASS_IDS } from './wow-types.ts';
import { randomSource } from './random-source.ts';
import type { DungeonResult } from './dungeon-command.ts';
import type { Combatant } from './pvp-combatant.ts';
import type { Simulation } from './simulation.ts';

/** Fills missing teammate slots with seeded legal class/role picks so a
 * battleground setup always fields a full side. */
export function battlegroundSetup(setup: PvpSetup, seed = 0): PvpSetup {
    const size = pvpTeamSize(setup.bracket) - 1;
    if (setup.teammates.length >= size) return setup;
    const random = randomSource(seed ^ 0x5eed);
    const teammates: PvpTeammate[] = [...setup.teammates];
    while (teammates.length < size) {
        const classId = WOW_CLASS_IDS[Math.floor(random() * WOW_CLASS_IDS.length)]!;
        teammates.push({ classId, role: pvpClassRoles(classId)[0] });
    }
    return { ...setup, teammates };
}

/** Enter a battleground: same chassis as arena, plus the objective controller
 * for the map's bracket. Returns the travel result and the live roster. */
export async function enterBattleground(sim: Simulation, setup: PvpSetup, host: PvpMatchHost): Promise<DungeonResult & { combatants?: readonly Combatant[] }> {
    const result = await enterPvpMatch(sim, battlegroundSetup(setup), host);
    if (result.ok) attachBattlegroundObjectives(sim);
    return result;
}
