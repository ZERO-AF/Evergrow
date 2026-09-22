/** WoW-style chat edit box (docs/wow-deepening.md §8): a small DOM input pinned
 * under the chat frame. Enter opens it from game.ts; while open the field owns
 * every keystroke (stopPropagation), so game hotkeys cannot fire. Enter submits,
 * Escape closes, and any focus loss closes it — while closed it does not exist
 * in the input path. */
import { CHAT_FRAME } from './chat-frame.ts';
import { getHUDLayout } from './hud-layout.ts';
import './chat-input.css';

export interface ChatInputActions {
  /** Receives the raw submitted line; parsing lives in emote.ts. */
  submit(text: string): void;
  /** Returns keyboard focus to the game surface after Enter/Escape. */
  restoreFocus(): void;
}

export class ChatInput {
  private readonly element: HTMLElement;
  private readonly field: HTMLInputElement;
  private readonly actions: ChatInputActions;
  private open = false;

  constructor(mount: HTMLElement, actions: ChatInputActions) {
    this.actions = actions;
    this.element = document.createElement('div');
    this.element.className = 'chat-input';
    this.element.hidden = true;
    this.element.innerHTML = '<input type="text" maxlength="240" autocomplete="off" spellcheck="false" aria-label="Chat" placeholder="Say…">';
    this.field = this.element.querySelector('input')!;
    mount.append(this.element);
    // The field swallows every key while focused; Escape/Enter close it here so
    // the window-level gameplay handlers never see chat keystrokes.
    this.field.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.code === 'Escape') { event.preventDefault(); this.close(); this.actions.restoreFocus(); }
      else if (event.code === 'Enter') {
        event.preventDefault();
        const text = this.field.value;
        this.close();
        this.actions.submit(text);
        this.actions.restoreFocus();
      } else if (event.code === 'Tab') event.preventDefault();
    });
    this.field.addEventListener('blur', () => this.close());
  }

  get isOpen(): boolean { return this.open; }

  /** Show and focus the box under the chat frame; `view` is logical pixels. */
  show(view: { width: number; height: number }): boolean {
    if (this.open) return false;
    this.open = true;
    const hud = getHUDLayout(view.width, view.height);
    const width = Math.max(CHAT_FRAME.minWidth, Math.min(CHAT_FRAME.width, hud.x - CHAT_FRAME.margin * 2));
    const top = Math.max(4, hud.y - CHAT_FRAME.margin + 4);
    this.element.style.left = `${CHAT_FRAME.margin / view.width * 100}%`;
    this.element.style.top = `${top / view.height * 100}%`;
    this.element.style.width = `${width / view.width * 100}%`;
    this.field.value = '';
    this.element.hidden = false;
    this.field.focus();
    return true;
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.element.hidden = true;
    this.field.blur();
  }

  dispose(): void { this.element.remove(); }
}
