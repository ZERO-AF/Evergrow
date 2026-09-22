import type { Enemy } from './model.ts';
import type { Simulation } from './simulation.ts';
import { worldToScreen, type CameraView } from './camera.ts';
import { enemyBodyBounds } from './enemy-body.ts';
import { enemyCast, type EnemyCast } from './cast-bar.ts';
import type { EnemyRank } from './progression-content.ts';
import { isBossKind, isWildernessBoss, BOSS_NAMES } from './wilderness-boss-content.ts';
import { raidBossName } from './raid-boss-content.ts';
import { raid2BossName } from './raid2-boss-content.ts';
import { DUNGEON_THEMES } from './dungeon-content.ts';
import { riftMechanic } from './rift-encounters.ts';
import { enemyDisplayName } from './zone-roster.ts';
import { ELITE_AFFIXES, type EliteAffixId } from './combat-content.ts';

/**
 * WoW-style floating enemy nameplates (V key). Headless model: resolves which
 * on-screen enemies get a plate and everything the plate needs to draw — name,
 * level, health, rank crest and the live cast from cast-bar.ts. Presentation
 * lives in nameplate-art.ts; user preferences live in nameplate-settings.ts.
 *
 * This complements enemy-plate.ts (the single hover/target readout at the top
 * of the screen): nameplates float over every visible enemy at once.
 */

/** always: every visible enemy · combat: engaged enemies + the target · off. */
export type NameplateMode = 'always' | 'combat' | 'off';
export const NAMEPLATE_MODES: readonly NameplateMode[] = Object.freeze(['always', 'combat', 'off']);

/** Heraldry tier shown on the plate, mapped onto WoW's badge vocabulary. */
export type NameplateCrest = 'none' | 'rare' | 'elite' | 'boss';

export interface Nameplate {
  readonly id: number;
  /** Screen-space anchor at the enemy's head top (plates hang above it). */
  readonly x: number;
  readonly y: number;
  /** Interpolated world position, for consumers that stay in world space. */
  readonly worldX: number;
  readonly worldY: number;
  readonly name: string;
  readonly level: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly rank: EnemyRank;
  readonly crest: NameplateCrest;
  readonly boss: boolean;
  /** Live cast/windup from cast-bar.ts, or null. */
  readonly casting: EnemyCast | null;
  /** Player's tab/click target — the plate draws last and highlighted. */
  readonly targeted: boolean;
  /** Fighting the player right now (drives 'combat' mode). */
  readonly engaged: boolean;
  /** Raw hit-flash timer for the white damage blink. */
  readonly hitFlash: number;
  /** Elite affix id + display color for the glyph left of the name. */
  readonly affix?: EliteAffixId;
  readonly affixColor?: string;
}

/** Most plates drawn at once; extras are culled by priority, nearest first. */
export const NAMEPLATE_LIMIT = 40;

/** Mirrors tabTarget's engagement test: aware, taunted, mid-attack or recently hit. */
export function enemyEngaged(e: Enemy): boolean {
  return e.awareness > 0 || !!e.taunted || e.hitFlash > 0
    || e.state === 'chase' || e.state === 'windup' || e.state === 'attack'
    || e.state === 'recover' || e.state === 'return';
}

/** Display name, mirroring enemy-plate.ts: rift roles, then boss identities, then the archetype. */
export function nameplateName(e: Enemy): string {
  if (e.treasure) return 'Treasure Goblin';
  const role = riftMechanic(e);
  const base = enemyDisplayName(e);
  if (role === 'ritual') return 'Rift Cantor';
  if (role === 'storm') return `Stormbound ${base}`;
  if (role === 'fire') return `Cinder ${base}`;
  if (isBossKind(e.kind)) {
    return raidBossName(e) ?? raid2BossName(e)
      ?? (e.dungeonTheme ? DUNGEON_THEMES[e.dungeonTheme]?.bossName : undefined)
      ?? (isWildernessBoss(e.kind) ? BOSS_NAMES[e.kind] : undefined)
      ?? base;
  }
  return base;
}

/**
 * Every visible, living enemy's plate data in painter's order: sorted by screen
 * y so lower plates overlap higher ones, with the player's target last (on top).
 * `mode` filters before culling — 'combat' keeps engaged enemies and the target.
 */
export function collectNameplates(sim: Simulation, view: CameraView,
  mode: NameplateMode = 'always', limit = NAMEPLATE_LIMIT): Nameplate[] {
  if (mode === 'off' || limit <= 0) return [];
  const alpha = sim.interpolationAlpha;
  const p = sim.player;
  const screenW = view.width * view.zoom, screenH = view.height * view.zoom;
  const plates: Nameplate[] = [];
  for (const e of sim.enemies) {
    if (e.hp <= 0 || e.state === 'dead') continue;
    const targeted = e.id === p.targetId;
    const engaged = enemyEngaged(e);
    if (mode === 'combat' && !engaged && !targeted) continue;
    const wx = e.prevX + (e.x - e.prevX) * alpha;
    const wy = e.prevY + (e.y - e.prevY) * alpha;
    const bounds = enemyBodyBounds(e);
    const head = worldToScreen(view, wx, wy + (bounds.headTop ?? bounds.top));
    // Generous margin: plates extend above the head point and bosses are wide.
    if (head.x < -80 || head.x > screenW + 80 || head.y < -60 || head.y > screenH + 60) continue;
    plates.push({
      id: e.id, x: head.x, y: head.y, worldX: wx, worldY: wy,
      name: nameplateName(e), level: e.level, hp: Math.max(0, e.hp), maxHp: Math.max(1, e.maxHp),
      rank: e.rank, crest: isBossKind(e.kind) ? 'boss' : e.rank === 'elite' ? 'elite' : e.rank === 'veteran' ? 'rare' : 'none', boss: isBossKind(e.kind),
      casting: enemyCast(e), targeted, engaged, hitFlash: e.hitFlash,
      affix: e.affix, affixColor: e.affix ? ELITE_AFFIXES[e.affix].color : undefined,
    });
  }
  if (plates.length > limit) {
    const priority = (n: Nameplate) =>
      (n.targeted ? 0 : n.engaged ? 1 : 2) * 1e7
      + (n.worldX - p.x) ** 2 + (n.worldY - p.y) ** 2;
    plates.sort((a, b) => priority(a) - priority(b));
    plates.length = limit;
  }
  // Painter's order: deeper (lower on screen) plates draw over higher ones; the
  // target plate always finishes on top. Sort is stable, so the y order holds.
  plates.sort((a, b) => a.y - b.y);
  plates.sort((a, b) => (a.targeted ? 1 : 0) - (b.targeted ? 1 : 0));
  return plates;
}
