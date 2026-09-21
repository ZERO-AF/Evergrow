import { raidBossWarningSpec } from './raid-boss-content.ts';
import { raid2BossWarningSpec } from './raid2-boss-content.ts';
import { raid3BossWarningSpec } from './raid3-boss-content.ts';
import { raid4BossWarningSpec } from './raid4-boss-content.ts';
import type { CombatEvent, Enemy, EnemyKind, ProjectileStyle } from './model.ts';
import { ENEMY_DEFINITIONS, enemyAttackDefinition } from './combat-content.ts';
import { BOSS_PALETTES, isBossKind } from './wilderness-boss-content.ts';
import { wardenProfile } from './dungeon-boss.ts';
import { RIFT_TACTICS } from './rift-encounters.ts';
import { PROJECTILE_COLORS } from './projectile-colors.ts';

/** DBM-style telegraph warnings (docs/wow-deepening.md §10). Presentation only:
 * reads enemy windup/rift state and cast events; never mutates the simulation.
 * Ability labels use real WoW spell names; caster names resolve live from enemy
 * content so renamed mobs/bosses flow through automatically. */

export type BossWarningOutcome = 'casting' | 'released' | 'interrupted' | 'faded';

export interface BossWarning {
  /** Stable key while the telegraph lives: `e<id>` for casts, `r<id>` for rift channels. */
  readonly key: string;
  readonly kind?: EnemyKind;
  readonly casterId?: number;
  readonly caster: string;
  /** Real WoW ability name shown on the flash and bar. */
  readonly ability: string;
  /** Short DBM advice: 'move!' | 'sidestep!' | 'adds!' | 'incoming!'. */
  readonly advice: string;
  readonly color: string;
  /** Seconds left on the telegraph; counts down while `outcome === 'casting'`. */
  remaining: number;
  /** Total telegraph duration for bar fill. */
  duration: number;
  /** Seconds since the warning was raised (drives flash fade). */
  age: number;
  /** Seconds left on the post-outcome bar fade. */
  fade: number;
  outcome: BossWarningOutcome;
  /** Announce-only warnings (cast events without a tracked windup) draw no bar. */
  readonly announceOnly: boolean;
}

interface WarningSpec { ability: string; advice: string; color: string }

const DANGER = '#f34e60';
const PHYSICAL = '#e8b04a';

/** Boss signature moves → real WoW spell names (WotLK-era vocabulary). */
const BOSS_MOVE_WARNINGS: Readonly<Record<NonNullable<Enemy['bossMove']>, { ability: string; advice: string }>> = Object.freeze({
  sweep: Object.freeze({ ability: 'Cleave', advice: 'move!' }),
  fracture: Object.freeze({ ability: 'Shadow Fissure', advice: 'sidestep!' }),
  summon: Object.freeze({ ability: 'Summon Minions', advice: 'adds!' }),
  rush: Object.freeze({ ability: 'Charge', advice: 'sidestep!' }),
  eruption: Object.freeze({ ability: 'Eruption', advice: 'move!' }),
  command: Object.freeze({ ability: 'Rallying Cry', advice: 'incoming!' }),
  jab: Object.freeze({ ability: 'Thrash', advice: 'move!' }),
  bolt: Object.freeze({ ability: 'Shadow Bolt', advice: 'sidestep!' }),
});

/** Signature attacks (attackVariant 1) → real WoW spell names per archetype. */
const SIGNATURE_WARNINGS: Readonly<Partial<Record<EnemyKind, { ability: string; advice: string }>>> = Object.freeze({
  thornReaver: Object.freeze({ ability: 'Mortal Strike', advice: 'move!' }),
  mireSpitter: Object.freeze({ ability: 'Shadow Bolt Volley', advice: 'move!' }),
  frostRevenant: Object.freeze({ ability: 'Blizzard', advice: 'move!' }),
  emberAcolyte: Object.freeze({ ability: 'Rain of Fire', advice: 'move!' }),
  duneScuttler: Object.freeze({ ability: 'Pounce', advice: 'move!' }),
  stormSentinel: Object.freeze({ ability: 'Chain Lightning', advice: 'sidestep!' }),
});

/** Boss cast events carry a projectile style but no move id; name the school. */
const CAST_EVENT_ABILITIES: Readonly<Record<ProjectileStyle, string>> = Object.freeze({
  arrow: 'Shoot', fire: 'Fireball', frost: 'Frostbolt', lightning: 'Lightning Bolt',
  arcane: 'Arcane Blast', spirit: 'Spirit Bolt', radiant: 'Smite',
  holy: 'Holy Smite', shadow: 'Shadow Bolt', nature: 'Wrath',
});

const RIFT_WARNINGS: Readonly<Record<'storm' | 'fire', { ability: string; advice: string; color: string }>> = Object.freeze({
  storm: Object.freeze({ ability: 'Lightning Storm', advice: 'move!', color: '#cca3ff' }),
  fire: Object.freeze({ ability: 'Flame Breath', advice: 'sidestep!', color: '#ff935f' }),
});

/** A windup that ends with this much time unspent was interrupted, not released. */
const INTERRUPT_GRACE = .09;
export const BOSS_WARNING_OUTCOME_FADE = .45;
export const BOSS_WARNING_FLASH_SECONDS = 1.6;
const MAX_WARNINGS = 6;

function bossColor(e: Enemy): string {
  if (e.kind === 'warden') return wardenProfile(e.dungeonTheme).color;
  return (BOSS_PALETTES as Record<string, string>)[e.kind] ?? DANGER;
}

/** Telegraphs worth a center-screen warning; ordinary basics stay silent. */
function warningSpec(e: Enemy): WarningSpec | undefined {
  const raid = raidBossWarningSpec(e) ?? raid2BossWarningSpec(e) ?? raid3BossWarningSpec(e) ?? raid4BossWarningSpec(e); if (raid) return { ...raid, color: bossColor(e) };
  if (e.bossMove) {
    const move = BOSS_MOVE_WARNINGS[e.bossMove];
    return { ability: move.ability, advice: move.advice, color: bossColor(e) };
  }
  const definition = enemyAttackDefinition(e);
  if (e.attackVariant === 1) {
    const signature = SIGNATURE_WARNINGS[e.kind];
    if (signature) {
      const style = definition.attack === 'ground' ? definition.blastStyle
        : definition.attack === 'projectile' ? definition.projectileStyle : undefined;
      return { ability: signature.ability, advice: signature.advice,
        color: style ? PROJECTILE_COLORS[style] : PHYSICAL };
    }
  }
  if (definition.attack === 'ground') {
    return { ability: 'Holy Nova', advice: 'move!',
      color: PROJECTILE_COLORS[definition.blastStyle ?? 'holy'] };
  }
  if (definition.attack === 'projectile' && definition.warning) {
    return { ability: 'Volley', advice: 'sidestep!', color: PROJECTILE_COLORS[definition.projectileStyle] };
  }
  return undefined;
}

/**
 * Tracks live enemy telegraphs for the HUD. `update` observes windup/rift state
 * each frame; `handleEvents` announces boss casts that fired without a tracked
 * windup (streamed-in attackers, evicted warnings).
 */
export class BossWarnings {
  private readonly warnings = new Map<string, BossWarning>();
  private readonly raised: BossWarning[] = [];
  private lastTime: number | undefined;
  private announceSeq = 0;

  clear(): void { this.warnings.clear(); this.lastTime = undefined; }

  /** Feed drained combat events; only enemy 'cast' events matter. */
  handleEvents(events: readonly CombatEvent[]): void {
    for (const event of events) {
      if (event.type !== 'cast' || !event.enemyKind || !isBossKind(event.enemyKind)) continue;
      let tracked = false;
      for (const warning of this.warnings.values()) {
        if (warning.kind === event.enemyKind && warning.outcome === 'casting' && !warning.announceOnly) { tracked = true; break; }
      }
      if (tracked) continue; // The windup poll owns tracked telegraphs through release.
      this.push({
        key: `a${this.announceSeq++}`, kind: event.enemyKind, caster: ENEMY_DEFINITIONS[event.enemyKind].name,
        ability: event.style ? CAST_EVENT_ABILITIES[event.style] : 'Shadow Bolt',
        advice: 'incoming!', color: event.style ? PROJECTILE_COLORS[event.style] : DANGER,
        remaining: 0, duration: 0, age: 0, fade: 0, outcome: 'casting', announceOnly: true,
      });
    }
  }

  /** Poll live enemies once per rendered frame; `time` is the renderer clock. */
  update(enemies: readonly Enemy[], time: number): void {
    const dt = this.lastTime === undefined ? 0 : Math.max(0, Math.min(.5, time - this.lastTime));
    this.lastTime = time;
    const live = new Set<string>();
    const byId = new Map<number, Enemy>();
    for (const e of enemies) {
      byId.set(e.id, e);
      if (e.hp <= 0) continue;
      if (e.riftWarning) {
        const key = `r${e.id}`, spec = RIFT_WARNINGS[e.riftWarning.kind];
        live.add(key);
        const warning = this.warnings.get(key);
        if (warning && warning.outcome === 'casting') {
          warning.remaining = e.riftWarning.remaining;
        } else {
          this.push({ key, kind: e.kind, casterId: e.id, caster: ENEMY_DEFINITIONS[e.kind].name,
            ability: spec.ability, advice: spec.advice, color: spec.color,
            remaining: e.riftWarning.remaining, duration: RIFT_TACTICS.warning,
            age: 0, fade: 0, outcome: 'casting', announceOnly: false });
        }
        continue;
      }
      if (e.state !== 'windup') continue;
      const spec = warningSpec(e);
      if (!spec) continue;
      const key = `e${e.id}`;
      live.add(key);
      const warning = this.warnings.get(key);
      if (warning && warning.outcome === 'casting') {
        warning.remaining = Math.max(0, e.stateDuration - e.stateTime);
        warning.duration = Math.max(warning.duration, e.stateDuration);
      } else {
        this.push({ key, kind: e.kind, casterId: e.id, caster: ENEMY_DEFINITIONS[e.kind].name,
          ability: spec.ability, advice: spec.advice, color: spec.color,
          remaining: Math.max(0, e.stateDuration - e.stateTime), duration: Math.max(.01, e.stateDuration),
          age: 0, fade: 0, outcome: 'casting', announceOnly: false });
      }
    }
    for (const [key, warning] of this.warnings) {
      warning.age += dt;
      if (warning.outcome === 'casting' && !warning.announceOnly && !live.has(key)) {
        const caster = warning.casterId === undefined ? undefined : byId.get(warning.casterId);
        if (!caster || caster.hp <= 0 || caster.state === 'dead') warning.outcome = 'faded';
        else if (warning.remaining > INTERRUPT_GRACE) warning.outcome = 'interrupted';
        else warning.outcome = 'released';
        warning.fade = BOSS_WARNING_OUTCOME_FADE;
      }
      if (warning.outcome !== 'casting') warning.fade -= dt;
      const expired = warning.announceOnly ? warning.age >= BOSS_WARNING_FLASH_SECONDS
        : warning.outcome !== 'casting' && warning.fade <= 0;
      if (expired) this.warnings.delete(key);
    }
  }

  /** Newest-first flash announcements for the center-screen pass. */
  flashes(): BossWarning[] {
    return [...this.warnings.values()]
      .filter(w => w.age < BOSS_WARNING_FLASH_SECONDS)
      .sort((a, b) => b.age - a.age);
  }

  /** Active countdown bars, soonest telegraph first. */
  bars(): BossWarning[] {
    return [...this.warnings.values()]
      .filter(w => !w.announceOnly)
      .sort((a, b) => a.remaining - b.remaining);
  }
  /** Warnings raised since the last drain; the integrator may echo them to chat. */
  drainRaised(): BossWarning[] { return this.raised.splice(0); }

  /** A one-off center-screen flash with no telegraph bar — PvP callouts
   * ("Fight!", "First Blood") ride the same flash pass as boss warnings. */
  announce(ability: string, advice: string, color: string, caster = ''): void {
    this.push({
      key: `p${this.announceSeq++}`, caster, ability, advice, color,
      remaining: 0, duration: 0, age: 0, fade: 0, outcome: 'casting', announceOnly: true,
    });
  }


  private push(warning: BossWarning): void {
    this.warnings.set(warning.key, warning);
    this.raised.push(warning);
    while (this.warnings.size > MAX_WARNINGS) {
      const oldest = this.warnings.keys().next().value;
      if (oldest === undefined) break;
      this.warnings.delete(oldest);
    }
  }
}
