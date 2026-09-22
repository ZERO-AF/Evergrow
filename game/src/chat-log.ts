/** WoW-style chat/combat feed logic (docs/wow-deepening.md §8): pure message
 * production over `player.combatLog`. Rendering lives in chat-frame.ts; this
 * module stays headless so commands can push lines from the core boundary.
 * Line phrasing follows real WotLK combat-log strings ("You have slain Hogger!"). */
import type { CombatEvent, EnemyKind, Player, SkillFailReason } from './model.ts';
import type { SkillId } from './character-types.ts';
import { pushCombatLog, type CombatLogEntry, type CombatLogKind } from './combat-log.ts';
import { GAME_FEATURES } from './game-features.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { itemDisplayName } from './items.ts';

type ChatLine = Pick<CombatLogEntry, 'kind' | 'text'>;

const enemyName = (kind: EnemyKind | undefined, name?: string): string =>
  name ?? (kind ? ENEMY_DEFINITIONS[kind]?.name ?? kind : 'Something');

/** WoW-style error strings for rejected skill presses (skill-failed events). */
export const SKILL_FAIL_TEXT: Record<SkillFailReason, string> = {
  'cooldown': 'That ability is not ready yet.',
  'gcd': 'Not ready yet.',
  'no-target': 'You have no target.',
  'out-of-range': 'Out of range.',
  'requires-stealth': 'Requires Stealth.',
  'requires-form': 'You are in the wrong form.',
  'requires-frozen': 'Target must be frozen.',
  'requires-ally': 'Requires an active minion.',
  'requires-buff': 'Requires a stance or effect.',
  'requires-behind': 'You must be behind your target.',
  'execute-threshold': 'Target is not wounded enough.',
  'no-combo': 'Requires combo points.',
  'no-shards': 'Not enough soul shards.',
  'no-runes': 'Runes are not ready.',
  'unusable': 'You cannot use that yet.',
};

/** Map one drained CombatEvent to chat lines; purely visual events produce none. */
export function combatEventLines(event: CombatEvent): readonly ChatLine[] {
  switch (event.type) {
    case 'hit': {
      // `skill` rides the event as an undeclared payload from the offense snapshot.
      const skill = (event as { skill?: SkillId }).skill;
      const skillName = skill ? SKILL_DEFINITIONS[skill]?.name : undefined;
      const amount = Math.round(event.actualValue ?? event.value);
      const text = event.allyId !== undefined
        ? `Your pet ${event.heavy ? 'crits' : 'hits'} ${enemyName(event.enemyKind, event.enemyName)} for ${amount}.`
        : event.periodic
        ? `${skillName ? `Your ${skillName}` : 'Your effect'} ticks on ${enemyName(event.enemyKind, event.enemyName)} for ${amount}.`
        : `${skillName ? `Your ${skillName}` : 'You'} ${skillName ? (event.heavy ? 'crits' : 'hits') : (event.heavy ? 'crit' : 'hit')} ${enemyName(event.enemyKind, event.enemyName)} for ${amount}.`;
      return [{ kind: 'damage', text }];
    }
    case 'kill':
      return [{ kind: 'death', text: `You have slain ${enemyName(event.enemyKind, event.enemyName)}!` }];
    case 'hurt': {
      const lines: ChatLine[] = [{ kind: 'damage', text: `${enemyName(event.enemyKind, event.enemyName)} ${event.heavy ? 'crits' : 'hits'} you for ${Math.round(event.actualValue ?? event.value)}.` }];
      if (event.remainingHp <= 0) lines.push({ kind: 'death', text: 'You die.' });
      return lines;
    }
    case 'block':
      return [{ kind: 'damage', text: !event.incoming
        ? `${enemyName(event.enemyKind, event.enemyName)} is immune.`
        : event.blocked === 'absorb' ? `You absorb ${Math.round(event.value)} damage.`
        : event.blocked === 'resist' ? `You resist ${Math.round(event.value)} damage.`
        : event.blocked === 'immune' ? 'You are immune.'
        : `You block ${Math.round(event.value)} damage.` }];
    case 'avoid':
      return [{ kind: 'damage', text: event.incoming
        ? `${enemyName(event.enemyKind, event.enemyName)} attacks. You ${event.outcome === 'miss' ? 'avoid it' : `${event.outcome} it`}.`
        : event.outcome === 'miss' ? `You miss ${enemyName(event.enemyKind, event.enemyName)}.` : `${enemyName(event.enemyKind, event.enemyName)} ${event.outcome}s your attack.` }];
    case 'heal':
      return [{ kind: 'heal', text: `You gain ${Math.round(event.value)} health.` }];
    case 'potion': {
      const parts = [`${Math.round(event.life)} health`];
      if (event.mana > 0) parts.push(`${Math.round(event.mana)} mana`);
      return [{ kind: 'heal', text: `You gain ${parts.join(' and ')}.` }];
    }
    case 'pickup':
      return [{ kind: 'heal', text: `You gain ${Math.round(event.value)} ${event.heavy ? 'health' : 'mana'}.` }];
    case 'experience':
      return [{ kind: 'xp', text: `You gain ${Math.round(event.amount)} experience.` }];
    case 'level':
      return [{ kind: 'level', text: `You have reached level ${event.level}!` }];
    case 'loot':
      return [{ kind: 'loot', text: `You receive loot: ${itemDisplayName(event.item)}.` }];
    case 'gold':
      return [{ kind: 'loot', text: `You loot ${Math.round(event.amount)} gold.` }];
    case 'journey':
      return [{ kind: 'quest', text: `${event.name} completed.` }];
    case 'notice':
      return [{ kind: 'system', text: event.message }];
    case 'insufficient-mana':
      return [{ kind: 'system', text: 'Not enough mana.' }];
    case 'skill-failed':
      return [{ kind: 'system', text: SKILL_FAIL_TEXT[event.reason] }];
    default:
      return [];
  }
}

/** Feed drained sim events into the player's bounded ring. Call once per frame after `drainEvents()`. */
export function logCombatEvents(player: Player, events: readonly CombatEvent[], now: number): void {
  if (!GAME_FEATURES.combatLog) return;
  let log = player.combatLog;
  for (const event of events)
    for (const line of combatEventLines(event))
      log = pushCombatLog(log, { ...line, time: now });
  if (log !== player.combatLog) player.combatLog = log;
}

/** Direct system-side line (quest, discovery, achievement…). Stamps `time` itself. */
export function pushChatMessage(player: Player, kind: CombatLogKind, message: string, now: number): void {
  if (!GAME_FEATURES.combatLog) return;
  player.combatLog = pushCombatLog(player.combatLog, { kind, text: message.slice(0, 240), time: now });
}
