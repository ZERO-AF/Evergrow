/**
 * Online co-op window: host a session, join a host by room code through the
 * relay, or leave the current session. The panel owns no session state —
 * game.ts wires the actions to the host/client controllers and pushes status
 * text and the room code back via setStatus()/setRoom().
 */
import './net-panel.css';
import { attachPanelFrame, detachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';

const esc = escapeUI;

/** Prefill for the relay address field; matches the relay server's default port. */
export const NET_DEFAULT_RELAY = 'ws://localhost:8777';
/** Relay-side room code rule (server/net-relay.mjs ROOM_CODE_RE); checked
 * client-side so a bad code fails before the socket is even opened. */
const NET_ROOM_CODE = /^[A-Za-z0-9_-]{1,32}$/;

export interface NetPanelActions {
  /** Close the window (the coordinator resumes gameplay). */
  close(): void;
  /** Start hosting; the session reports the room code back via setRoom(). */
  host(address: string): void;
  /** Join a host's session through the relay. */
  join(code: string, address: string): void;
  /** Leave the current session. */
  leave(): void;
  /** Optional live status line shown when the panel renders. */
  status?(): string;
}

export class NetPanel {
  readonly element: HTMLElement;
  private abort = new AbortController();
  private focus: { dispose(): void } | null = null;
  private status = '';
  private room = '';
  private connected = false;
  private actions: NetPanelActions;

  constructor(mount: HTMLElement, actions: NetPanelActions) {
    this.actions = actions;
    this.element = document.createElement('section');
    this.element.className = 'net-panel';
    this.element.hidden = true;
    mount.append(this.element);
    this.element.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button) return;
      if (button.dataset.close !== undefined) this.actions.close();
      else if (button.dataset.host !== undefined) this.actions.host(this.element.querySelector<HTMLInputElement>('[data-net-address]')?.value.trim() || NET_DEFAULT_RELAY);
      else if (button.dataset.leave !== undefined) this.actions.leave();
    }, { signal: this.abort.signal });
    this.element.addEventListener('submit', event => {
      event.preventDefault();
      const code = this.element.querySelector<HTMLInputElement>('[data-net-code]')?.value.trim() ?? '';
      const address = this.element.querySelector<HTMLInputElement>('[data-net-address]')?.value.trim() || NET_DEFAULT_RELAY;
      if (!NET_ROOM_CODE.test(code)) { this.setStatus('Enter the room code from the host (letters, numbers, - and _).'); return; }
      this.actions.join(code, address);
    }, { signal: this.abort.signal });
  }

  get isOpen(): boolean { return !this.element.hidden; }

  open(): void {
    this.render();
    this.element.hidden = false;
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal });
  }

  close(): void {
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
  }

  /** Status line under the title; persists across renders. */
  setStatus(text: string): void {
    this.status = text;
    const line = this.element.querySelector<HTMLElement>('[data-net-status]');
    if (line) line.textContent = text;
  }

  /** Show the live room code while hosting; '' clears it. */
  setRoom(code: string): void {
    this.room = code;
    if (code) this.connected = true;
    if (this.isOpen) this.render();
  }

  /** Toggle the connected chrome: leave button visible, host/join disabled. */
  setConnected(connected: boolean): void {
    this.connected = connected;
    if (!connected) this.room = '';
    if (this.isOpen) this.render();
  }

  private render(): void {
    const status = this.status || this.actions.status?.() || 'Not connected.';
    const address = this.element.querySelector<HTMLInputElement>('[data-net-address]')?.value || NET_DEFAULT_RELAY;
    const code = this.element.querySelector<HTMLInputElement>('[data-net-code]')?.value ?? '';
    const off = this.connected ? 'disabled' : '';
    this.element.innerHTML = `<section class="ui-window net-window" role="dialog" aria-modal="true" aria-labelledby="net-title"><header class="ui-window-header"><h2 class="ui-title" id="net-title">Online Co-op</h2><button type="button" class="ui-button ui-button--icon" data-close aria-label="Close">${uiIcon('close')}</button></header><div class="ui-window-body net-body"><p class="net-status ui-muted" data-net-status role="status">${esc(status)}</p>${this.room ? `<p class="net-room">Room code <strong class="net-room-code">${esc(this.room)}</strong><span class="ui-muted">on ${esc(address)}</span></p>` : ''}<button type="button" class="ui-button ui-button--primary net-host" data-host ${off}>Host a session</button><form class="net-join"><label class="net-field"><span>Room code</span><input class="ui-input net-input" data-net-code type="text" autocomplete="off" spellcheck="false" placeholder="From the host" value="${esc(code)}" ${off}></label><label class="net-field"><span>Relay address</span><input class="ui-input net-input" data-net-address type="text" autocomplete="off" spellcheck="false" value="${esc(address)}" ${off}></label><button type="submit" class="ui-button" ${off}>Join session</button></form><button type="button" class="ui-button ui-button--danger net-leave" data-leave ${this.connected ? '' : 'hidden'}>Leave session</button></div></section>`;
    attachPanelFrame(this.element, 'net');
  }

  dispose(): void {
    this.close();
    detachPanelFrame(this.element);
    this.abort.abort();
    this.element.remove();
  }
}
