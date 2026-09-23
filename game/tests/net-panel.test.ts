import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Exercise the co-op panel's real DOM owner without launching gameplay.
const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { NetPanel, NET_DEFAULT_RELAY } = await import('../src/net-panel.ts');
css.deregister();

class Surface extends EventTarget {
  hidden = false;
  innerHTML = '';
  ownerDocument: unknown = null;
  setAttribute() {}
  hasAttribute() { return false; }
  removeAttribute() {}
  append() {}
  remove() {}
  matches() { return false; }
  closest() { return null; }
  contains(node: unknown) { return node === this; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getClientRects() { return { length: 0 }; }
  focus() {}
}

function openPanel() {
  const doc = new Surface();
  Object.assign(doc, { createElement: () => { const el = new Surface(); el.ownerDocument = doc; return el; }, activeElement: null, defaultView: null });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  const calls: string[] = [];
  const panel = new NetPanel(new Surface() as unknown as HTMLElement, {
    close: () => calls.push('close'),
    host: () => calls.push('host'),
    join: (code, address) => calls.push(`join:${code}@${address}`),
    leave: () => calls.push('leave'),
    status: () => 'live status',
  });
  return { panel, calls, restore: () => { panel.dispose(); if (original) Object.defineProperty(globalThis, 'document', original); } };
}

test('net panel renders host/join controls and hides leave while offline', () => {
  const { panel, restore } = openPanel();
  try {
    panel.open();
    const html = panel.element.innerHTML;
    assert.ok(html.includes('Online Co-op'));
    assert.ok(html.includes('data-host'), 'host button');
    assert.ok(html.includes('data-net-code'), 'room code input');
    assert.ok(html.includes('data-net-address'), 'relay address input');
    assert.ok(html.includes(NET_DEFAULT_RELAY), 'relay address prefilled');
    assert.ok(html.includes('data-leave'), 'leave button exists');
    assert.ok(/data-leave[^>]*hidden/.test(html), 'leave hidden while offline');
    assert.ok(html.includes('live status'), 'status hook rendered');
  } finally { restore(); }
});

test('net panel shows room code and leave button once connected', () => {
  const { panel, restore } = openPanel();
  try {
    panel.open();
    panel.setRoom('AB12');
    const html = panel.element.innerHTML;
    assert.ok(html.includes('>AB12<'), 'room code shown');
    assert.ok(/data-leave(?![^>]*hidden)/.test(html), 'leave visible while connected');
    assert.ok(/data-host[^>]*disabled/.test(html), 'host disabled while connected');
    panel.setConnected(false);
    assert.ok(/data-leave[^>]*hidden/.test(panel.element.innerHTML), 'leave hidden after disconnect');
    assert.ok(!panel.element.innerHTML.includes('>AB12<'), 'room cleared after disconnect');
  } finally { restore(); }
});

test('net panel status line persists across renders', () => {
  const { panel, restore } = openPanel();
  try {
    panel.setStatus('Connecting…');
    panel.open();
    assert.ok(panel.element.innerHTML.includes('Connecting…'));
  } finally { restore(); }
});
