/** Chat-input parsing and the player emote presentation state (docs/wow-deepening.md §8).
 * Headless: the DOM box lives in chat-input.ts, the bubble art in chat-frame.ts.
 * Emotes are presentation-only — a chat line plus a brief overhead bubble. */
import type { Simulation } from './simulation.ts';
import { pushChatMessage } from './chat-log.ts';
import { enemyDisplayName } from './zone-roster.ts';
import { BARK_RULES } from './battle-bark-content.ts';
import { emoteForCommand, emoteLine } from './emote-content.ts';

/** One live overhead bubble; `started` rides the simulation clock like barks. */
export interface EmoteBubble { text: string; started: number; }

export type ChatSubmit =
  | { kind: 'empty' }
  | { kind: 'say'; text: string }
  | { kind: 'emote'; command: string }
  | { kind: 'custom'; text: string }
  | { kind: 'unknown'; command: string };

/** Parse one submitted chat line: bare text is /say, '/name' is an emote or an
 * unknown command, and /emote|/me prints a free-form line. */
export function parseChatInput(raw: string): ChatSubmit {
  const input = raw.trim();
  if (!input) return { kind: 'empty' };
  if (!input.startsWith('/')) return { kind: 'say', text: input };
  const space = input.indexOf(' ');
  const command = (space < 0 ? input.slice(1) : input.slice(1, space)).toLowerCase();
  const rest = space < 0 ? '' : input.slice(space + 1).trim();
  if (command === 'say' || command === 's') return rest ? { kind: 'say', text: rest } : { kind: 'empty' };
  if (command === 'emote' || command === 'e' || command === 'me')
    return rest ? { kind: 'custom', text: rest } : { kind: 'empty' };
  return emoteForCommand(command) ? { kind: 'emote', command } : { kind: 'unknown', command };
}

/** Bounded presentation state: one overhead bubble, replaced by each new emote. */
export class Emotes {
  private bubble: EmoteBubble | null = null;

  /** Active bubble while inside its lifetime; null otherwise. */
  active(now: number): EmoteBubble | null {
    const age = this.bubble ? now - this.bubble.started : -1;
    return this.bubble && age >= 0 && age < BARK_RULES.duration ? this.bubble : null;
  }

  reset(): void { this.bubble = null; }

  /** Route one submitted chat line into the feed and the overhead bubble. */
  submit(sim: Simulation, raw: string): void {
    const parsed = parseChatInput(raw);
    const player = sim.player, now = sim.time;
    const name = player.name ?? 'You';
    switch (parsed.kind) {
      case 'empty':
        return;
      case 'say':
        pushChatMessage(player, 'system', `${name} says: ${parsed.text}`, now);
        this.bubble = { text: parsed.text.slice(0, 80), started: now };
        return;
      case 'custom':
        pushChatMessage(player, 'quest', `${name} ${parsed.text}`, now);
        this.bubble = { text: parsed.text.slice(0, 80), started: now };
        return;
      case 'unknown':
        pushChatMessage(player, 'system', `Unknown command: /${parsed.command}.`, now);
        return;
      case 'emote': {
        const def = emoteForCommand(parsed.command)!;
        const target = sim.enemies.find(enemy => enemy.id === player.targetId && enemy.state !== 'dead');
        const line = emoteLine(def, target ? enemyDisplayName(target) : undefined);
        pushChatMessage(player, 'quest', line, now);
        this.bubble = { text: def.overhead ?? def.text, started: now };
        return;
      }
    }
  }
}
