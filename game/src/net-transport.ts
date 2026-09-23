/**
 * Transport implementations of the `NetChannel` contract (net-protocol.ts).
 *
 * - `createMemoryChannels()` — in-process duplex pair for tests and
 *   same-machine loopback; delivery is async (microtask) to mimic a real
 *   socket.
 * - `WebSocketChannel` / `connectWebSocket()` — browser WebSocket wrapper.
 *
 * This module must stay importable in a headless context (no DOM globals):
 * `WebSocket` is referenced only inside class methods/constructor, never at
 * module top level.
 */

import type { NetChannel } from './net-protocol.ts';

// ── Memory pair ─────────────────────────────────────────────────────────────

/** In-process duplex channel pair. `a.send()` is delivered to `b.onMessage`
 * on a microtask, and vice versa. */
export interface MemoryChannelPair {
  a: NetChannel;
  b: NetChannel;
}

class MemoryChannel implements NetChannel {
  onMessage: ((data: string) => void) | null = null;
  onClose: (() => void) | null = null;

  /** Other end of the pair; set once by createMemoryChannels. */
  peer: MemoryChannel | null = null;
  private open = true;

  get ready(): boolean {
    return this.open;
  }

  send(data: string): void {
    const peer = this.peer;
    if (!this.open || !peer) return;
    queueMicrotask(() => {
      // Drop silently if either end closed before delivery.
      if (!this.open || !peer.open) return;
      peer.onMessage?.(data);
    });
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    const peer = this.peer;
    if (peer && peer.open) {
      peer.open = false;
      peer.onClose?.();
    }
  }
}

/** Create a connected pair of in-memory channels. */
export function createMemoryChannels(): MemoryChannelPair {
  const a = new MemoryChannel();
  const b = new MemoryChannel();
  a.peer = b;
  b.peer = a;
  return { a, b };
}

// ── WebSocket ───────────────────────────────────────────────────────────────

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

/** `NetChannel` over a browser WebSocket. Constructing the channel starts the
 * connection; `send()` drops until `ready` (readyState === OPEN). */
export class WebSocketChannel implements NetChannel {
  onMessage: ((data: string) => void) | null = null;
  onClose: (() => void) | null = null;

  private readonly ws: WebSocket;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e: MessageEvent) => {
      this.onMessage?.(e.data as string);
    };
    this.ws.onclose = () => {
      this.onClose?.();
    };
  }

  get ready(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  send(data: string): void {
    if (this.ready) this.ws.send(data);
  }

  close(): void {
    this.ws.close();
  }

  /** Resolves once the socket is open; rejects on error, pre-open close, or
   * timeout. Resolves immediately if already open. */
  whenOpen(timeoutMs: number = DEFAULT_CONNECT_TIMEOUT_MS): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    const ws = this.ws;
    const url = this.url;
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
        ws.removeEventListener('close', onEarlyClose);
      };
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error(`WebSocket connection failed: ${url}`));
      };
      const onEarlyClose = () => {
        cleanup();
        reject(new Error(`WebSocket closed before opening: ${url}`));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`WebSocket connect timed out after ${timeoutMs}ms: ${url}`));
      }, timeoutMs);
      ws.addEventListener('open', onOpen);
      ws.addEventListener('error', onError);
      ws.addEventListener('close', onEarlyClose);
    });
  }
}

/** Open a WebSocketChannel and wait for it to become ready. */
export async function connectWebSocket(
  url: string,
  timeoutMs: number = DEFAULT_CONNECT_TIMEOUT_MS,
): Promise<WebSocketChannel> {
  const channel = new WebSocketChannel(url);
  await channel.whenOpen(timeoutMs);
  return channel;
}
