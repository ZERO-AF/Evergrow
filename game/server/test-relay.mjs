// Smoke test for server/net-relay.mjs — run with `node server/test-relay.mjs`
// while the relay is up on :8777. Exercises handshake, role routing, `to`
// unicast, `from` stamping, member-leave notice, host-leave kick, ping/pong.
import { connect } from 'node:net';
import { createHash } from 'node:crypto';

const BASE = 'ws://127.0.0.1:8777';
let passed = 0;
let failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ws(url) {
  return new Promise((resolve, reject) => {
    const sock = new WebSocket(url);
    const inbox = [];
    const waiters = [];
    sock.onmessage = (e) => {
      const m = JSON.parse(e.data);
      inbox.push(m);
      for (const w of waiters.splice(0)) w();
    };
    sock.onopen = () => resolve({
      sock, inbox,
      send: (o) => sock.send(JSON.stringify(o)),
      next: (ms = 2000) => new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('timeout waiting for message')), ms);
        waiters.push(() => { clearTimeout(t); res(); });
      }),
      closed: new Promise((res) => { sock.onclose = (ev) => res(ev); }),
    });
    sock.onerror = (e) => reject(new Error('ws error'));
  });
}

// ── 1. handshake + role routing ─────────────────────────────────────────────
const host = await ws(`${BASE}/?room=TEST1`);
const m2 = await ws(`${BASE}/?room=TEST1`);
const m3 = await ws(`${BASE}/?room=TEST1`);
await sleep(50);

// member → host (role default)
m2.send({ type: 'hello', char: 'knight' });
await host.next();
check('member→host delivers', host.inbox[0]?.type === 'hello');
check('from stamped with member peer id', host.inbox[0]?.from === 2, JSON.stringify(host.inbox[0]));
check('member did not self-receive', m2.inbox.length === 0);
check('other member not in path', m3.inbox.length === 0);

// host → all members (role default broadcast)
host.send({ type: 'snapshot', tick: 1 });
await m2.next(); await m3.next();
check('host→member2 broadcast', m2.inbox[0]?.type === 'snapshot');
check('host→member3 broadcast', m3.inbox[0]?.type === 'snapshot');
check('broadcast from=1 (host)', m2.inbox[0]?.from === 1 && m3.inbox[0]?.from === 1);

// `to` unicast: host → member 3 only
host.send({ type: 'welcome', to: 3 });
await m3.next();
check('to:3 unicast reaches member3', m3.inbox[1]?.type === 'welcome');
check('to:3 unicast skips member2', m2.inbox.length === 1);

// `to: "host"` from a member
m3.send({ type: 'input', seq: 9, to: 'host' });
await host.next();
check('to:"host" unicast reaches host', host.inbox[1]?.type === 'input' && host.inbox[1]?.from === 3);

// member → member via numeric `to`
m2.send({ type: 'emote', to: 3 });
await m3.next();
check('member→member to:3 works', m3.inbox[2]?.type === 'emote' && m3.inbox[2]?.from === 2);

// ── 2. member disconnect → host notified ────────────────────────────────────
m2.sock.close();
await host.next();
check('host got relayPeerLeft for peer 2',
  host.inbox[2]?.type === 'relayPeerLeft' && host.inbox[2]?.peer === 2,
  JSON.stringify(host.inbox[2]));

// ── 3. host disconnect → members kicked, room closed ────────────────────────
host.sock.close();
const ev3 = await m3.closed;
check('member3 got kick message', m3.inbox.some((m) => m.type === 'kick' && m.reason === 'host-left'));
check('member3 ws closed with 4000', ev3.code === 4000, `code=${ev3.code}`);

// room destroyed → next client becomes host again (peer id 1)
const fresh = await ws(`${BASE}/?room=TEST1`);
fresh.send({ type: 'probe' });
await sleep(150);
check('new client in emptied room is host (no echo, no crash)', fresh.inbox.length === 0);
fresh.sock.close();

// ── 4. raw-socket ping → pong ───────────────────────────────────────────────
await new Promise((resolve, reject) => {
  const s = connect(8777, '127.0.0.1', () => {
    const key = Buffer.alloc(16, 7).toString('base64');
    s.write(
      'GET /?room=PING HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\n' +
      'Connection: Upgrade\r\nSec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
  });
  let buf = Buffer.alloc(0);
  let shook = false;
  s.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    if (!shook) {
      const i = buf.indexOf('\r\n\r\n');
      if (i < 0) return;
      const head = buf.subarray(0, i).toString();
      const key = Buffer.alloc(16, 7).toString('base64');
      const expect = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      check('101 + correct Sec-WebSocket-Accept',
        head.includes('101') && head.includes(expect), head.split('\r\n')[0]);
      shook = true;
      buf = buf.subarray(i + 4);
      // masked ping, payload "hi"
      s.write(Buffer.from([0x89, 0x82, 0xaa, 0xbb, 0xcc, 0xdd, 0xaa ^ 0x68, 0xbb ^ 0x69]));
      return;
    }
    if (buf.length >= 4 && (buf[0] & 0x0f) === 0x0a) {
      check('ping answered with pong echoing payload',
        buf[1] === 2 && buf[2] === 0x68 && buf[3] === 0x69);
      s.destroy();
      resolve();
    }
  });
  s.on('error', reject);
  setTimeout(() => reject(new Error('ping timeout')), 3000);
});

// ── 5. bad room code rejected ───────────────────────────────────────────────
const bad = await fetch('http://127.0.0.1:8777/?room=ok').then((r) => r.text());
check('HTTP GET returns status page', bad.includes('net-relay'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
