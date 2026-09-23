/** Mount commands: every `player.mounted` mutation flows through here
 * (docs/wow-deepening.md §2). Presentation code never mutates mount state. */
import type { CombatEvent, Input } from './model.ts';
import type { Simulation } from './simulation.ts';
import { MOUNTS, type MountId } from './mount-content.ts';
import { GAME_FEATURES } from './game-features.ts';
import { pushChatMessage } from './chat-log.ts';
import {
  advanceSummonCast, cancelSummonCast, mountIndoors, mountUnlocked,
  preferredMount, startSummonCast, summonCast,
} from './mount-state.ts';

export interface MountResult {
  ok: boolean;
  message: string;
}

export type MountEmit = (event: CombatEvent) => void;

/** Why a summon cannot start right now; null means the cast may begin. */
export function summonProblem(sim: Simulation, id: MountId): string | null {
  const p = sim.player;
  if (!GAME_FEATURES.mounts) return 'Mounts are not available.';
  if (p.dead || sim.ghost) return 'You cannot summon a mount while defeated.';
  if (!mountUnlocked(p, id)) return `${MOUNTS[id].name} is still locked.`;
  if (mountIndoors(sim)) return 'You cannot summon a mount indoors.';
  if (p.attack || p.cast || p.castTime > 0 || p.dash || p.dodgeTime > 0 || Math.hypot(p.vx, p.vy) > 1)
    return 'Stand still to summon your mount.';
  return null;
}

/** X toggles: mounted → instant dismount; otherwise start the summon cast. */
export function mountToggle(sim: Simulation, id: MountId = preferredMount(sim.player)): MountResult {
  const p = sim.player;
  if (p.mounted) {
    const name = MOUNTS[p.mounted.id].name;
    dismount(sim);
    pushChatMessage(p, 'system', `You dismount your ${name}.`, sim.time);
    return { ok: true, message: `You dismount your ${name}.` };
  }
  if (summonCast(sim)) return { ok: false, message: 'Already summoning.' };
  const problem = summonProblem(sim, id);
  if (problem) return { ok: false, message: problem };
  startSummonCast(sim, id);
  return { ok: true, message: `Summoning ${MOUNTS[id].name}…` };
}

/** Instant dismount; safe to call when not mounted. */
export function dismount(sim: Simulation): void {
  sim.player.mounted = null;
}

/** Any offensive action (attack, skill cast) dismounts. Call from the attack
 * and skill paths before the action commits. */
export function mountOnOffense(sim: Simulation): void {
  if (sim.player.mounted) dismount(sim);
}

/** Damage interrupts the summon cast and dismounts. Call from the player
 * damage path only after damage actually lands. */
export function mountOnDamage(sim: Simulation): void {
  cancelSummonCast(sim);
  if (sim.player.mounted) dismount(sim);
}

/** Per-step mount clock: enforces the outdoor rule, interrupts the cast on
 * input, and commits the summon when the cast finishes. Call once per fixed
 * step with the same input the player update consumed. */
export function advanceMount(sim: Simulation, dt: number, input: Input, emit?: MountEmit): void {
  const p = sim.player;
  if (!GAME_FEATURES.mounts) { p.mounted = null; cancelSummonCast(sim); return; }
  if (p.dead || sim.ghost) { p.mounted = null; cancelSummonCast(sim); return; }
  if (p.mounted && mountIndoors(sim)) {
    dismount(sim);
    emit?.({ type: 'notice', x: p.x, y: p.y, message: 'You cannot ride indoors.' });
    return;
  }
  if (!summonCast(sim)) return;
  if (input.moveX || input.moveY || input.attack || input.dodge || input.skillSlot !== null
    || p.attack || p.cast || p.dash || p.dodgeTime > 0) {
    cancelSummonCast(sim);
    emit?.({ type: 'notice', x: p.x, y: p.y, message: 'Summon interrupted.' });
    return;
  }
  const done = advanceSummonCast(sim, dt);
  if (done) {
    p.mounted = { id: done.id, since: sim.time };
    emit?.({ type: 'notice', x: p.x, y: p.y, message: `You summon your ${MOUNTS[done.id].name}.` });
  }
}
