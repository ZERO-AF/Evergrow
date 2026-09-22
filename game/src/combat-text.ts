import { GAME_FEATURES } from './game-features.ts';
import { PROJECTILE_COLORS } from './projectile-colors.ts';
import type { CombatEvent } from './model.ts';

/**
 * WoW-style floating combat text: maps confirmed CombatEvents to popup specs.
 * Presentation only — CombatEffects owns the live list, motion and drawing;
 * this module owns the label/color/size vocabulary so the mapping is testable
 * without a canvas.
 *
 * Vocabulary (docs/wow-transformation.md):
 *  - auto-attack melee: white; melee skills: yellow; spells: school color
 *  - crits: larger, hotter, longer-lived, drawn with a '!' flourish
 *  - heals: green with '+'; damage taken: warm red with '-'
 *  - miss/dodge/parry: grey-blue words over whoever avoided the blow
 *  - block/absorb/immune/resist: shield-blue words with the absorbed amount
 */

export interface CombatPopup {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; value: string; color: string; size: number;
  /** Critical flourish: drawNumbers appends the '!' and pops harder. */
  crit?: boolean;
}

const WHITE_MELEE = '#f4f1e6';
const YELLOW_MELEE = '#ffd100';
const CRIT_HOT = '#ffb347';
const HEAVY_YELLOW = '#ffd177';
const NORMAL_YELLOW = '#fff0c8';
const HEAL_GREEN = '#83ffbb';
const HURT_RED = '#ff9075';
const AVOID_GREY = '#9fb4c8';
const BLOCK_BLUE = '#b4e4ee';
const GLANCING_GREY = '#c9d4d0';
const IMMUNE_GREY = '#a8b6c4';
const RESIST_VIOLET = '#b9a7e8';

const REACTION_COLORS = {
  melt: '#ffd177', overload: '#ff77aa', superconduct: '#a0d0ff',
  singularity: '#c578ff', combustion: '#ff4d79', cascade: '#67e8f9',
} as const;

/** WoW damage-number color: reaction > crit > school > melee white/yellow. */
function hitColor(event: Extract<CombatEvent, { type: 'hit' }>, crit: boolean): string {
  if (event.reaction) return REACTION_COLORS[event.reaction];
  if (crit) return CRIT_HOT;
  const school = event.style ? PROJECTILE_COLORS[event.style] : undefined;
  if (school) return school;
  if (event.heavy) return HEAVY_YELLOW;
  return event.melee ? (event.skill ? YELLOW_MELEE : WHITE_MELEE) : NORMAL_YELLOW;
}

/** Popup specs for one event; empty for events with no floating text. */
export function combatTextForEvent(event: CombatEvent, random: () => number = Math.random): CombatPopup[] {
  const enemyKind = 'enemyKind' in event ? event.enemyKind : undefined;
  const heavy = 'heavy' in event && event.heavy;
  const tall = enemyKind === 'brute' ? 54 : 44;
  const tag = enemyKind === 'brute' ? 78 : 68;
  switch (event.type) {
    case 'hit': {
      if (!event.value) break;
      // Juice crits: bigger, hotter, longer-lived numbers that always show,
      // even where heavy-hit popups are otherwise suppressed for loot beams.
      const crit = heavy && !event.reaction && GAME_FEATURES.combatJuice;
      const out: CombatPopup[] = [];
      if (!(heavy && GAME_FEATURES.lootBeams) || crit) out.push({
        x: event.x + (random() - .5) * 10, y: event.y - tall,
        vx: (random() - .5) * 22, vy: crit ? -58 : -47,
        life: crit ? 1 : .85, max: crit ? 1 : .85,
        value: String(Math.round(event.value)), color: hitColor(event, crit),
        size: crit ? 3.4 : heavy ? 2.6 : event.periodic ? 1.7 : 2,
        ...(crit ? { crit: true } : {}),
      });
      if (event.reaction) out.push({ x: event.x, y: event.y - tag, vx: 0, vy: -47,
        life: .75, max: .75, value: event.reaction.toUpperCase(), color: hitColor(event, false), size: 1.6 });
      if (event.glancing) out.push({ x: event.x, y: event.y - tag - (event.reaction ? 14 : 0),
        vx: 0, vy: -47, life: .75, max: .75, value: 'GLANCING', color: GLANCING_GREY, size: 1.6 });
      return out;
    }
    case 'hurt': {
      const out: CombatPopup[] = [{ x: event.x, y: event.y - 61,
        vx: Math.cos(event.angle) * 14, vy: -55, life: .95, max: .95,
        value: `-${Math.round(event.value)}`, color: (event.style ? PROJECTILE_COLORS[event.style] : undefined) ?? HURT_RED, size: 2.5 }];
      if (event.glancing) out.push({ x: event.x, y: event.y - 80,
        vx: 0, vy: -47, life: .75, max: .75, value: 'GLANCING', color: GLANCING_GREY, size: 1.6 });
      return out;
    }
    case 'heal':
      return [{ x: event.x, y: event.y - 61, vx: 14, vy: -55,
        life: .95, max: .95, value: `+${Math.round(event.value)}`, color: HEAL_GREEN, size: 2 }];
    case 'potion': {
      const out: CombatPopup[] = [];
      if (event.life > 0) out.push({ x: event.x, y: event.y - 61, vx: -9, vy: -35,
        life: .95, max: .95, value: `+${Math.round(event.life)}`, color: '#ffad9c', size: 1.8 });
      if (event.mana > 0) out.push({ x: event.x, y: event.y - (event.life > 0 ? 80 : 61), vx: 9, vy: -35,
        life: .95, max: .95, value: `+${Math.round(event.mana)}`, color: '#91c8ff', size: 1.8 });
      return out;
    }
    case 'block': {
      // One event carries shielded immunity, shield blocks, absorb wards and
      // partial resists; `blocked` picks the WoW label.
      const kind = event.blocked ?? 'shield';
      const value = kind === 'immune' ? 'IMMUNE'
        : kind === 'absorb' ? `${Math.round(event.value)} ABSORBED`
        : kind === 'resist' ? `${Math.round(event.value)} RESISTED`
        : 'BLOCK';
      const color = kind === 'immune' ? IMMUNE_GREY : kind === 'resist' ? RESIST_VIOLET : event.color ?? BLOCK_BLUE;
      return [{ x: event.x, y: event.y - 58, vx: 0, vy: -25,
        life: .65, max: .65, value, color, size: 1.7 }];
    }
    case 'avoid':
      // Attack-table whiffs read as WoW floating text: MISS over the target,
      // DODGE/PARRY over whoever avoided the blow.
      return [{ x: event.x, y: event.y - (event.incoming ? 58 : tall), vx: 0, vy: -25,
        life: .65, max: .65, value: event.outcome.toUpperCase(),
        color: event.outcome === 'miss' ? AVOID_GREY : BLOCK_BLUE, size: 1.7 }];
    default:
      return [];
  }
  return [];
}
