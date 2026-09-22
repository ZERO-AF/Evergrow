/** WoW-style chat/combat frame (docs/wow-deepening.md §8).
 * Bottom-left scrolling feed over `player.combatLog`; presentation never mutates —
 * entries arrive only through `logCombatEvents` / `pushChatMessage` (chat-log.ts).
 * Line phrasing follows real WotLK combat-log strings ("You have slain Hogger!"). */
import type { Player } from './model.ts';
import type { CombatLogEntry, CombatLogKind } from './combat-log.ts';
import { GAME_FEATURES } from './game-features.ts';
import { getHUDLayout } from './hud-layout.ts';
import { UI_THEME } from './ui-theme.ts';
import { text, textWidth } from './font.ts';
import { BARK_RULES } from './battle-bark-content.ts';
import { placeBattleBark } from './battle-bark-layout.ts';
import { drawBattleBark, measureBattleBark } from './battle-bark-art.ts';

export { combatEventLines, logCombatEvents, pushChatMessage } from './chat-log.ts';

const UI = UI_THEME.palette;

/** Feed geometry and fade timing. Width yields to the centered Astral HUD. */
export const CHAT_FRAME = Object.freeze({
  margin: 12,
  width: 340,
  minWidth: 190,
  headerHeight: 16,
  padX: 8,
  padTop: 4,
  padBottom: 5,
  lineHeight: 13,
  textSize: .85,
  maxLines: 9,
  minLines: 3,
  holdSeconds: 7,
  fadeSeconds: 4,
  minAlpha: .22,
});

/** Per-kind colors; damage direction is told by the words, like the WoW combat tab. */
const KIND_COLORS: Readonly<Record<CombatLogKind, string>> = Object.freeze({
  damage: '#e8ddc8',
  heal: '#8fd98f',
  xp: '#c9a7f5',
  loot: '#ffd76a',
  death: '#ff7a6e',
  quest: '#ffe27a',
  level: '#ffd24a',
  system: '#f2e6a2',
  discovery: '#9fd8f0',
});

/** Ellipsize to the feed's inner width using the same face the lines draw in. */
function fitLine(value: string, limit: number): string {
  const size = CHAT_FRAME.textSize;
  const full = textWidth(value, size, 'interface');
  if (full <= limit) return value;
  let out = value.slice(0, Math.max(1, Math.floor(value.length * (limit / full))));
  while (out.length > 1 && textWidth(out + '…', size, 'interface') > limit) out = out.slice(0, -1);
  return out + '…';
}

export interface ChatFrameOptions {
  reducedMotion?: boolean;
  /** Logical pointer position; hovering the frame restores full opacity. */
  pointer?: { x: number; y: number } | null;
}

/** Toggleable bottom-left feed. Owns only visibility + last drawn bounds. */
export class ChatFrame {
  visible = true;
  private rect: { x: number; y: number; width: number; height: number } | null = null;

  toggle(): void { this.visible = !this.visible; }

  /** Last drawn frame rect in logical pixels; null while hidden or off-screen. */
  get bounds() { return this.rect; }

  /** Pointer-UI blocking + hover focus share the drawn rect. */
  contains(x: number, y: number): boolean {
    const r = this.rect;
    return !!r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
  }

  /** Draw into the native-resolution UI surface; `now` is `sim.time`. */
  draw(c: CanvasRenderingContext2D, player: Player, width: number, height: number, now: number, options: ChatFrameOptions = {}): void {
    const hud = getHUDLayout(width, height);
    const margin = CHAT_FRAME.margin;
    const frameWidth = Math.round(Math.min(CHAT_FRAME.width, hud.x - margin * 2));
    const entries = player.combatLog ?? [];
    const bodyTop = CHAT_FRAME.headerHeight + CHAT_FRAME.padTop;
    const maxFit = Math.floor((hud.y - margin * 2 - bodyTop - CHAT_FRAME.padBottom) / CHAT_FRAME.lineHeight);
    const lines = Math.min(CHAT_FRAME.maxLines, maxFit, Math.max(entries.length, CHAT_FRAME.minLines));
    if (!GAME_FEATURES.combatLog || !this.visible || hud.scale <= 0 || frameWidth < CHAT_FRAME.minWidth || lines < 1) {
      this.rect = null;
      return;
    }
    const frameHeight = bodyTop + lines * CHAT_FRAME.lineHeight + CHAT_FRAME.padBottom;
    const x = margin, y = Math.round(hud.y - margin - frameHeight);
    this.rect = { x, y, width: frameWidth, height: frameHeight };

    const hover = !!options.pointer && this.contains(options.pointer.x, options.pointer.y);
    const alphaOf = (entry: CombatLogEntry): number => {
      if (options.reducedMotion || hover) return 1;
      const age = now - entry.time;
      if (age <= CHAT_FRAME.holdSeconds) return 1;
      const fade = Math.min(1, (age - CHAT_FRAME.holdSeconds) / CHAT_FRAME.fadeSeconds);
      return 1 - fade * (1 - CHAT_FRAME.minAlpha);
    };
    const shown = entries.slice(-lines);
    const frameAlpha = shown.length ? Math.max(...shown.map(alphaOf)) : (options.reducedMotion || hover ? 1 : CHAT_FRAME.minAlpha);

    c.save();
    c.globalAlpha = .18 + .3 * frameAlpha;
    c.fillStyle = UI.ink;
    c.beginPath(); c.roundRect(x, y, frameWidth, frameHeight, 4); c.fill();
    c.globalAlpha = .25 + .5 * frameAlpha;
    c.strokeStyle = UI.line; c.lineWidth = 1;
    c.strokeRect(x + .5, y + .5, frameWidth - 1, frameHeight - 1);
    c.globalAlpha = .45 + .55 * frameAlpha;
    text(c, 'Combat', x + CHAT_FRAME.padX, y + 4, .72, UI.faint);
    c.globalAlpha = .2 + .35 * frameAlpha;
    c.beginPath(); c.moveTo(x + .5, y + CHAT_FRAME.headerHeight + .5); c.lineTo(x + frameWidth - .5, y + CHAT_FRAME.headerHeight + .5); c.stroke();

    const limit = frameWidth - CHAT_FRAME.padX * 2;
    let lineY = y + bodyTop;
    for (const entry of shown) {
      c.globalAlpha = alphaOf(entry);
      text(c, fitLine(entry.text, limit), x + CHAT_FRAME.padX, lineY, CHAT_FRAME.textSize, KIND_COLORS[entry.kind], 'left', 'interface');
      lineY += CHAT_FRAME.lineHeight;
    }
    c.restore();
  }
}

/** Player emote/say bubble over the head: same Ashglass speech art as battle
 * barks, so it shares the battleBarks feature switch and fade timing. `head` is
 * the player's head in logical screen pixels; `now` is `sim.time`. */
export function drawEmoteBubble(c: CanvasRenderingContext2D, bubble: { text: string; started: number } | null,
  head: { x: number; y: number }, width: number, height: number, now: number): void {
  if (!bubble || !GAME_FEATURES.combatLog) return;
  const age = now - bubble.started;
  if (age < 0 || age >= BARK_RULES.duration) return;
  const box = placeBattleBark(bubble.text, head, { width, height },
    line => measureBattleBark(c, line), []);
  if (box) drawBattleBark(c, box, age);
}
