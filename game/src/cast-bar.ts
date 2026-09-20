import type { Enemy, EnemyKind } from './model.ts';
import { enemyAttackDefinition } from './combat-content.ts';
import { BOSS_PALETTES } from './wilderness-boss-content.ts';
import { wardenProfile } from './dungeon-boss.ts';
import { raidBossWarningSpec } from './raid-boss-content.ts';
import { raid2BossWarningSpec } from './raid2-boss-content.ts';
import { PROJECTILE_COLORS } from './projectile-colors.ts';

/**
 * Per-enemy in-world cast bars (WoW nameplate casts). Headless model: resolves
 * which enemies are casting, what the spell is called, how far along it is and
 * whether the player can interrupt it. Presentation lives in cast-bar-art.ts;
 * user preferences live in cast-bar-settings.ts.
 *
 * Enemies have no `cast` field — a windup IS the cast: `state === 'windup'`
 * fills the bar toward release, `state === 'attack'` drains it during the
 * brief release window (WoW's "cast finished" flash). Spell names reuse the
 * same WotLK vocabulary as boss-warnings.ts so both surfaces agree.
 */

export type CastBarPhase = 'cast' | 'release';

export interface EnemyCast {
  readonly enemy: Enemy;
  /** WoW spell name shown on the bar. */
  readonly spell: string;
  /** School/ability color for the fill. */
  readonly color: string;
  /** 0..1 fill: grows during windup, drains during release. */
  readonly progress: number;
  /** Seconds left in the windup; 0 during release. */
  readonly remaining: number;
  /** EnemyDefinition.interruptible — false draws the WoW grey + shield look. */
  readonly interruptible: boolean;
  readonly phase: CastBarPhase;
}

const PHYSICAL = '#e8b04a';
const DANGER = '#f34e60';

/** Boss signature moves → WoW spell names (mirrors BOSS_MOVE_WARNINGS). */
const BOSS_MOVE_CASTS: Readonly<Record<NonNullable<Enemy['bossMove']>, string>> = Object.freeze({
  sweep: 'Cleave', fracture: 'Shadow Fissure', summon: 'Summon Minions', rush: 'Charge',
  eruption: 'Eruption', command: 'Rallying Cry', jab: 'Thrash', bolt: 'Shadow Bolt',
});

/** Signature attacks (attackVariant 1) → WoW spell names per archetype. */
const SIGNATURE_CASTS: Readonly<Partial<Record<EnemyKind, string>>> = Object.freeze({
  thornReaver: 'Mortal Strike', mireSpitter: 'Shadow Bolt Volley', frostRevenant: 'Blizzard',
  emberAcolyte: 'Rain of Fire', duneScuttler: 'Pounce', stormSentinel: 'Chain Lightning',
});

/** Projectile schools → WoW cast names for ordinary ranged windups. */
const PROJECTILE_CASTS: Readonly<Record<keyof typeof PROJECTILE_COLORS, string>> = Object.freeze({
  arrow: 'Shoot', fire: 'Fireball', frost: 'Frostbolt', lightning: 'Lightning Bolt',
  arcane: 'Arcane Blast', spirit: 'Spirit Bolt', radiant: 'Smite',
  holy: 'Holy Smite', shadow: 'Shadow Bolt', nature: 'Wrath',
});

function bossColor(e: Enemy): string {
  if (e.kind === 'warden') return wardenProfile(e.dungeonTheme).color;
  return (BOSS_PALETTES as Record<string, string>)[e.kind] ?? DANGER;
}

/** Spell name + fill color for one enemy's current action. */
export function enemyCastSpec(e: Enemy): { spell: string; color: string } {
  const raid = raidBossWarningSpec(e) ?? raid2BossWarningSpec(e);
  if (raid) return { spell: raid.ability, color: bossColor(e) };
  if (e.bossMove) return { spell: BOSS_MOVE_CASTS[e.bossMove], color: bossColor(e) };
  const definition = enemyAttackDefinition(e);
  const style = definition.attack === 'ground' ? definition.blastStyle
    : definition.attack === 'projectile' ? definition.projectileStyle : undefined;
  if (e.attackVariant === 1 && SIGNATURE_CASTS[e.kind])
    return { spell: SIGNATURE_CASTS[e.kind]!, color: style ? PROJECTILE_COLORS[style] : PHYSICAL };
  if (definition.attack === 'ground')
    return { spell: 'Holy Nova', color: PROJECTILE_COLORS[style ?? 'holy'] };
  if (definition.attack === 'projectile')
    return { spell: PROJECTILE_CASTS[definition.projectileStyle], color: PROJECTILE_COLORS[definition.projectileStyle] };
  return { spell: definition.engageDistance ? 'Pounce' : 'Strike', color: PHYSICAL };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/**
 * The cast bar for one enemy, or null when it is not casting. `windup` fills
 * toward release; `attack` drains the just-completed cast so the bar eases off
 * instead of popping.
 */
export function enemyCast(e: Enemy): EnemyCast | null {
  if (e.hp <= 0 || e.state === 'dead') return null;
  const duration = Math.max(.001, e.stateDuration);
  if (e.state === 'windup') {
    const progress = clamp01(e.stateTime / duration);
    const spec = enemyCastSpec(e);
    return { enemy: e, ...spec, progress, remaining: Math.max(0, e.stateDuration - e.stateTime),
      interruptible: enemyAttackDefinition(e).interruptible, phase: 'cast' };
  }
  if (e.state === 'attack') {
    const spec = enemyCastSpec(e);
    return { enemy: e, ...spec, progress: 1 - clamp01(e.stateTime / duration), remaining: 0,
      interruptible: enemyAttackDefinition(e).interruptible, phase: 'release' };
  }
  return null;
}

/** Most bars a player can parse at once; extras are culled by priority. */
export const CAST_BAR_LIMIT = 12;

/**
 * Live cast bars, capped and ordered: the player's current target first, then
 * casts over releases, soonest release first. `targetId` is the player's
 * tab/click target (`sim.player.targetId`).
 */
export function collectCastBars(enemies: readonly Enemy[], targetId: number | null | undefined,
  limit = CAST_BAR_LIMIT): EnemyCast[] {
  const casts: EnemyCast[] = [];
  for (const e of enemies) {
    const cast = enemyCast(e);
    if (cast) casts.push(cast);
  }
  if (casts.length > 1) casts.sort((a, b) =>
    (b.enemy.id === targetId ? 1 : 0) - (a.enemy.id === targetId ? 1 : 0)
    || (a.phase === 'cast' ? 0 : 1) - (b.phase === 'cast' ? 0 : 1)
    || a.remaining - b.remaining);
  return casts.length > limit ? casts.slice(0, limit) : casts;
}
