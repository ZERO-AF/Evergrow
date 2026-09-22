import type { DamageType, Player, WowBuff } from './model.ts';
import type { SkillId } from './character-types.ts';
import { LEGENDARY_PROCS } from './legendary-content.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { PROJECTILE_COLORS } from './projectile-colors.ts';

/**
 * WoW SpellActivationOverlay state (docs/wow-deepening.md): when a proc lands the
 * screen edges light up with mirrored glowing arcs and the spell name flashes.
 * This tracker diffs `player.buffs` each frame — legendary procs arrive as
 * `proc:<id>` buffs (legendary-combat.ts grantBuff), and Hot Streak-style
 * instant-cast procs arrive as huge castSpeedPercent buffs (Presence of Mind
 * grants +300%). Pure and headless: canvas presentation lives in
 * proc-alert-art.ts.
 */

/** Seconds an alert stays on screen after the proc fires (WoW flash window). */
export const PROC_ALERT_SECONDS = 1.5;
/** Most simultaneous overlays drawn; extra procs queue behind the oldest. */
export const PROC_ALERT_MAX = 4;
/** castSpeedPercent at or above this reads as "next spell is instant", not haste. */
export const PROC_INSTANT_CAST_SPEED = 100;

/** Screen edge an overlay band hugs; 'left'/'right' are drawn mirrored. */
export type ProcAlertEdge = 'top' | 'left' | 'right' | 'bottom';

/** One active overlay: a school-colored edge glow plus the proc's spell name. */
export interface ProcAlert {
  /** Buff id this alert tracks (`proc:<legendary>` or a skill id). */
  readonly key: string;
  /** Display name — the proc/buff name shown under the arcs. */
  readonly name: string;
  /** Resolved glow color: proc school first, then skill/buff color. */
  readonly color: string;
  /** Damage school when the proc carries one (drives art tinting). */
  readonly school: DamageType | null;
  /** Edges the overlay hugs; ['left','right'] renders as mirrored side arcs. */
  readonly edges: readonly ProcAlertEdge[];
  /** Total display window in seconds (PROC_ALERT_SECONDS). */
  readonly duration: number;
  /** Seconds of display time left; the alert dies at 0 or when its buff does. */
  readonly remaining: number;
}

/** School palette for proc glows: projectile colors plus a physical fallback. */
const PROC_SCHOOL_COLORS: Readonly<Record<DamageType, string>> = Object.freeze({
  ...PROJECTILE_COLORS, physical: '#d9a08a',
});

/** Narrows a legendary proc's school (DamageType | DotSchool) to a DamageType. */
function procSchool(procId: string): DamageType | null {
  const school = LEGENDARY_PROCS[procId]?.effect.school;
  if (!school) return null;
  if (school === 'bleed') return 'physical';
  if (school === 'poison') return 'nature';
  return school as DamageType;
}

/** WoW proc rule: `proc:` ids are legendary procs; a buff granting ≥100% cast
 * speed is a Hot Streak/Presence of Mind-style instant-cast proc. */
export function isProcBuff(buff: WowBuff): boolean {
  return buff.id.startsWith('proc:') || (buff.stats?.castSpeedPercent ?? 0) >= PROC_INSTANT_CAST_SPEED;
}

/** Edge layout per proc family: instant-cast procs arc over the top (WoW's
 * Hot Streak/PoM position), legendary buffs flare on both sides. */
function procAlertEdges(buff: WowBuff): readonly ProcAlertEdge[] {
  return buff.id.startsWith('proc:') ? ['left', 'right'] : ['top'];
}

/** Glow color: the proc's damage school wins, then the authored skill color,
 * then the buff's own tint. */
function procAlertColor(buff: WowBuff, school: DamageType | null): string {
  if (school) return PROC_SCHOOL_COLORS[school];
  const skill = SKILL_DEFINITIONS[buff.id as SkillId];
  return skill?.color ?? buff.color;
}

interface TrackedProc {
  /** Last observed buff.remaining; a rise means the proc re-fired. */
  seenRemaining: number;
  expiresAt: number;
}

/**
 * Frame-side proc watcher. `update(player, now)` diffs the live buff list:
 * newly-gained proc buffs open an alert, a re-proc (remaining jumps back up)
 * refreshes it instead of stacking a second copy, and alerts expire with their
 * display window or the moment their buff is consumed. `now` is the sim clock
 * in seconds (sim.time).
 */
export class ProcAlertTracker {
  private readonly tracked = new Map<string, TrackedProc>();
  private alerts: ProcAlert[] = [];

  /** Currently-visible alerts (bounded by PROC_ALERT_MAX, oldest first). */
  active(): readonly ProcAlert[] { return this.alerts; }

  update(player: Player, now: number): readonly ProcAlert[] {
    const tracked = this.tracked;
    const seen = new Set<string>();
    if (!player.dead) for (const buff of player.buffs ?? []) {
      if (buff.remaining <= 0 || !isProcBuff(buff)) continue;
      seen.add(buff.id);
      const entry = tracked.get(buff.id);
      if (!entry) {
        tracked.set(buff.id, { seenRemaining: buff.remaining, expiresAt: now + PROC_ALERT_SECONDS });
      } else {
        // A re-proc refreshes the same buff's remaining — refresh, never stack.
        if (buff.remaining > entry.seenRemaining + 1e-6) entry.expiresAt = now + PROC_ALERT_SECONDS;
        entry.seenRemaining = buff.remaining;
      }
    }
    // Alerts die with their buff (consumed/expired) or with their flash window.
    for (const [key, entry] of tracked) {
      if (!seen.has(key) || entry.expiresAt <= now) tracked.delete(key);
    }
    this.alerts = [];
    for (const buff of player.buffs ?? []) {
      const entry = tracked.get(buff.id);
      if (!entry || this.alerts.length >= PROC_ALERT_MAX) continue;
      const school = buff.id.startsWith('proc:') ? procSchool(buff.id.slice(5)) : null;
      this.alerts.push({
        key: buff.id, name: buff.name, color: procAlertColor(buff, school), school,
        edges: procAlertEdges(buff), duration: PROC_ALERT_SECONDS,
        remaining: Math.max(0, entry.expiresAt - now),
      });
    }
    return this.alerts;
  }
}
