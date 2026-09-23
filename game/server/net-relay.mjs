#!/usr/bin/env node
/**
 * Minimal WebSocket relay for Evergrow online co-op rooms (wayfinder/T03).
 *
 * Plain Node, zero dependencies — the RFC6455 handshake and frame codec are
 * implemented inline (text frames only, ping/pong, close handshake).
 *
 * Usage:
 *   node server/net-relay.mjs            # PORT env or 8777, binds 0.0.0.0
 *   PORT=9000 node server/net-relay.mjs
 *
 * Clients connect to ws://<host>:<port>/?room=CODE
 *
 * Room semantics:
 *   - First client in a room is the HOST (relay peer id 1); later clients are
 *     MEMBERS (peer ids 2, 3, …, per-room).
 *   - Every relayed JSON message gets an authoritative `from` field stamped
 *     with the sender's relay peer id (any client-supplied `from` is
 *     overwritten — never trust it).
 *   - Routing: if the message JSON has a `to` field it is unicast —
 *     `to: "host"` or `to: 1` → the host, `to: <n>` → that member,
 *     `to: "all"` → everyone except the sender. With no `to`, routing is
 *     role-based: member → host, host → all members (broadcast).
 *   - Member disconnect → host receives {"type":"relayPeerLeft","peer":N}
 *     (relay peer id, not a roster playerId — the host maps `from` on hello).
 *   - Host disconnect → members receive {"type":"kick","reason":"host-left"}
 *     then a WebSocket close (code 4000) and the room is destroyed.
 */

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { networkInterfaces } from 'node:os';

const PORT = Number(process.env.PORT) || 8777;
const HOST = process.env.HOST || '0.0.0.0';
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 1 << 20; // 1 MiB — snapshots are a few KB
const MAX_MEMBERS = 7; // host + 7 = 8 clients per room
const ROOM_CODE_RE = /^[A-Za-z0-9_-]{1,32}$/;

// Opcodes
const OP_CONT = 0x0;
const OP_TEXT = 0x1;
const OP_BIN = 0x2;
const OP_CLOSE = 0x8;
const OP_PING = 0x9;
const OP_PONG = 0xa;

// Close codes (4000–4999 are application-defined)
const CLOSE_HOST_LEFT = 4000;
const CLOSE_ROOM_FULL = 4001;

// ── Frame codec ─────────────────────────────────────────────────────────────

/** Build an unmasked server→client frame. */
function encodeFrame(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | opcode; // FIN + opcode
  return Buffer.concat([header, payload]);
}

function sendText(peer, str) {
  if (peer.open && !peer.dead)
    peer.socket.write(encodeFrame(OP_TEXT, Buffer.from(str, 'utf8')));
}

function sendClose(peer, code, reason) {
  if (peer.closeSent || !peer.open) return;
  peer.closeSent = true;
  const reasonBuf = Buffer.from(reason || '', 'utf8');
  const payload = Buffer.allocUnsafe(2 + reasonBuf.length);
  payload.writeUInt16BE(code, 0);
  reasonBuf.copy(payload, 2);
  peer.socket.write(encodeFrame(OP_CLOSE, payload));
}

function sendPong(peer, payload) {
  if (peer.open) peer.socket.write(encodeFrame(OP_PONG, payload));
}

/**
 * Incremental frame parser. Returns as many complete frames as the buffer
 * holds; each is { fin, opcode, masked, payload }. Returns null and sets
 * peer.protocolError when the stream is malformed.
 */
function drainFrames(peer) {
  const frames = [];
  let buf = peer.buf;
  for (;;) {
    if (buf.length < 2) break;
    const b0 = buf[0];
    const b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const rsv = b0 & 0x70;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let off = 2;

    if (rsv !== 0) return fail(peer, 'RSV bits set');
    if (len === 126) {
      if (buf.length < 4) break;
      len = buf.readUInt16BE(2);
      off = 4;
    } else if (len === 127) {
      if (buf.length < 10) break;
      const big = buf.readBigUInt64BE(2);
      if (big > BigInt(MAX_PAYLOAD)) return fail(peer, 'frame too large');
      len = Number(big);
      off = 10;
    }
    if (len > MAX_PAYLOAD) return fail(peer, 'frame too large');

    const maskLen = masked ? 4 : 0;
    if (buf.length < off + maskLen + len) break; // wait for more data

    let payload = buf.subarray(off + maskLen, off + maskLen + len);
    if (masked) {
      const key = buf.subarray(off, off + 4);
      const unmasked = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) unmasked[i] = payload[i] ^ key[i & 3];
      payload = unmasked;
    } else {
      payload = Buffer.from(payload); // detach before buf is sliced
    }

    buf = buf.subarray(off + maskLen + len);
    frames.push({ fin, opcode, masked, payload });
  }
  peer.buf = buf;
  return frames;

  function fail(p, why) {
    p.protocolError = why;
    return null;
  }
}

// ── Rooms ───────────────────────────────────────────────────────────────────

/** @type {Map<string, {host: object, members: Map<number, object>, nextId: number}>} */
const rooms = new Map();

function resolveTo(room, sender, to) {
  if (to === 'host' || to === 1) return room.host ? [room.host] : [];
  if (to === 'all') {
    const all = [room.host, ...room.members.values()].filter((p) => p && p !== sender);
    return all;
  }
  if (typeof to === 'number') {
    const p = room.members.get(to);
    return p ? [p] : [];
  }
  return [];
}

function routeMessage(peer, data) {
  const room = peer.room;
  if (!room) return;

  let to;
  try {
    const msg = JSON.parse(data);
    if (msg && typeof msg === 'object' && !Array.isArray(msg)) {
      if (msg.to !== undefined) to = msg.to;
      msg.from = peer.id; // authoritative sender stamp
      data = JSON.stringify(msg);
    }
  } catch {
    // Non-JSON payload: deliver verbatim via role routing.
  }

  let targets;
  if (to !== undefined) {
    targets = resolveTo(room, peer, to);
  } else if (peer.isHost) {
    targets = [...room.members.values()];
  } else {
    targets = room.host ? [room.host] : [];
  }
  for (const t of targets) sendText(t, data);
}

function leaveRoom(peer) {
  const room = peer.room;
  if (!room) return;
  peer.room = null;

  if (peer.isHost) {
    // Host left: kick every member and destroy the room.
    for (const member of room.members.values()) {
      member.room = null;
      sendText(member, JSON.stringify({ type: 'kick', reason: 'host-left' }));
      sendClose(member, CLOSE_HOST_LEFT, 'host-left');
      member.socket.end();
    }
    room.members.clear();
    rooms.delete(room.code);
    log(`room ${room.code} closed (host left)`);
  } else {
    room.members.delete(peer.id);
    if (room.host && room.host.open) {
      sendText(room.host, JSON.stringify({ type: 'relayPeerLeft', peer: peer.id }));
    }
    log(`room ${room.code}: member ${peer.id} left (${room.members.size} member(s))`);
  }
}

// ── Connection lifecycle ────────────────────────────────────────────────────

function handleText(peer, payload) {
  routeMessage(peer, payload.toString('utf8'));
}

function handleFrame(peer, frame) {
  const { fin, opcode, masked, payload } = frame;

  // RFC6455 §5.4: client→server frames MUST be masked.
  if (!masked) return protocolClose(peer, 1002, 'unmasked client frame');

  switch (opcode) {
    case OP_CONT: {
      if (!peer.fragOp) return protocolClose(peer, 1002, 'unexpected continuation');
      peer.fragChunks.push(payload);
      peer.fragBytes += payload.length;
      if (peer.fragBytes > MAX_PAYLOAD) return protocolClose(peer, 1009, 'message too large');
      if (fin) {
        const op = peer.fragOp;
        const whole = Buffer.concat(peer.fragChunks);
        peer.fragOp = 0;
        peer.fragChunks = [];
        peer.fragBytes = 0;
        if (op === OP_TEXT) handleText(peer, whole);
        else protocolClose(peer, 1003, 'binary not supported');
      }
      return;
    }
    case OP_TEXT:
    case OP_BIN: {
      if (peer.fragOp) return protocolClose(peer, 1002, 'interleaved data frame');
      if (!fin) {
        peer.fragOp = opcode;
        peer.fragChunks = [payload];
        peer.fragBytes = payload.length;
        return;
      }
      if (opcode === OP_TEXT) handleText(peer, payload);
      else protocolClose(peer, 1003, 'binary not supported');
      return;
    }
    case OP_PING:
      if (!fin || payload.length > 125) return protocolClose(peer, 1002, 'bad ping');
      sendPong(peer, payload);
      return;
    case OP_PONG:
      if (!fin || payload.length > 125) return protocolClose(peer, 1002, 'bad pong');
      return; // unsolicited pong: ignore
    case OP_CLOSE: {
      if (!fin || payload.length > 125)
        return protocolClose(peer, 1002, 'bad close');
      if (!peer.closeSent) {
        // Echo the close (code+reason) back per RFC6455 §5.5.1.
        peer.closeSent = true;
        peer.socket.write(encodeFrame(OP_CLOSE, payload));
      }
      peer.dead = true;
      peer.socket.end();
      return;
    }
    default:
      return protocolClose(peer, 1002, `unknown opcode ${opcode}`);
  }
}

function protocolClose(peer, code, reason) {
  peer.dead = true;
  sendClose(peer, code, reason);
  peer.socket.end();
}

function onSocketData(peer, chunk) {
  peer.buf = peer.buf.length ? Buffer.concat([peer.buf, chunk]) : chunk;
  const frames = drainFrames(peer);
  if (frames === null) {
    protocolClose(peer, 1002, peer.protocolError || 'protocol error');
    return;
  }
  for (const f of frames) {
    handleFrame(peer, f);
    if (peer.dead) break;
  }
}

function onSocketClose(peer) {
  if (!peer.open) return;
  peer.open = false;
  leaveRoom(peer);
}

// ── HTTP + upgrade ──────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`evergrow net-relay: ${rooms.size} room(s) active\n`);
});

server.on('upgrade', (req, socket) => {
  socket.setNoDelay(true);

  const fail = (status, msg) => {
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
    log(`upgrade rejected (${status.trim()}): ${msg} — ${req.url}`);
  };

  // Header validation (Node lowercases header names).
  const upgrade = String(req.headers.upgrade || '').toLowerCase();
  const conn = String(req.headers.connection || '').toLowerCase();
  const key = req.headers['sec-websocket-key'];
  const version = req.headers['sec-websocket-version'];
  if (upgrade !== 'websocket') return fail('400 Bad Request', 'not a websocket upgrade');
  if (!conn.split(',').map((s) => s.trim()).includes('upgrade'))
    return fail('400 Bad Request', 'missing Connection: upgrade');
  if (!key) return fail('400 Bad Request', 'missing Sec-WebSocket-Key');
  if (version !== '13') return fail('426 Upgrade Required', 'unsupported websocket version');

  // Room code from the query string.
  let roomCode;
  try {
    roomCode = new URL(req.url, 'http://relay.local').searchParams.get('room');
  } catch {
    return fail('400 Bad Request', 'bad request URL');
  }
  if (!roomCode || !ROOM_CODE_RE.test(roomCode))
    return fail('400 Bad Request', 'missing/invalid ?room=CODE');

  // Join or create the room.
  let room = rooms.get(roomCode);
  let isHost = false;
  if (!room) {
    room = { code: roomCode, host: null, members: new Map(), nextId: 1 };
    rooms.set(roomCode, room);
    isHost = true;
  } else if (room.members.size >= MAX_MEMBERS) {
    // Complete the handshake so the client gets a clean close + reason.
    return acceptThenClose(socket, key, CLOSE_ROOM_FULL, 'room-full');
  }

  const accept = createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );

  const peer = {
    id: room.nextId++,
    isHost,
    room,
    socket,
    open: true,
    dead: false,
    closeSent: false,
    buf: Buffer.alloc(0),
    fragOp: 0,
    fragChunks: [],
    fragBytes: 0,
    protocolError: null,
  };
  if (isHost) room.host = peer;
  else room.members.set(peer.id, peer);

  socket.on('data', (chunk) => onSocketData(peer, chunk));
  socket.on('close', () => onSocketClose(peer));
  socket.on('error', () => onSocketClose(peer));
  socket.on('end', () => onSocketClose(peer));

  log(
    `room ${roomCode}: ${isHost ? 'host' : `member ${peer.id}`} joined ` +
      `(${room.members.size} member(s))`,
  );
});

/** Handshake succeeds, then immediately close with an app code + reason. */
function acceptThenClose(socket, key, code, reason) {
  const accept = createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  const stub = { open: true, closeSent: false, socket };
  sendClose(stub, code, reason);
  socket.end();
}

function log(msg) {
  process.stdout.write(`[net-relay ${new Date().toISOString()}] ${msg}\n`);
}

server.listen(PORT, HOST, () => {
  const nets = networkInterfaces();
  const addrs = [];
  for (const list of Object.values(nets)) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) addrs.push(ni.address);
    }
  }
  log(`listening on ws://0.0.0.0:${PORT} (join: ws://<host>:${PORT}/?room=CODE)`);
  for (const a of addrs) log(`  LAN: ws://${a}:${PORT}`);
});
