import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Exercise the edit-mode panel's real DOM owner without launching gameplay.
const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { UiLayoutPanel, attachPanelFrame, registerPanelFrames } = await import('../src/ui-layout-panel.ts');
const { registerUiFrame, resetUiLayout, setUiEditMode, setUiLayout, uiEditMode, uiFrames, uiLayout } = await import('../src/ui-layout.ts');
css.deregister();

/** Minimal element surface: enough for attachUiFrame + the panel's markup/sync. */
class Surface extends EventTarget {
  hidden = false;
  innerHTML = '';
  textContent = '';
  title = '';
  value = '';
  disabled = false;
  removed = false;
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  classes = new Set<string>();
  children: Surface[] = [];
  parent: Surface | null = null;
  inner: Surface | null = null;
  header: Surface | null = null;
  style: Record<string, string> = {};
  ownerDocument: unknown = null;
  classList = {
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, force?: boolean) => {
      const on = force ?? !this.classes.has(name);
      on ? this.classes.add(name) : this.classes.delete(name);
      return on;
    },
  };
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  hasAttribute(key: string) { return this.attributes.has(key); }
  append(...nodes: Surface[]) { for (const n of nodes) n.parent = this; this.children.push(...nodes); }
  appendChild(node: Surface) { node.parent = this; this.children.push(node); return node; }
  remove() { this.removed = true; this.parent?.children.splice(this.parent.children.indexOf(this), 1); }
  matches() { return false; }
  closest(selector: string) { return selector === 'button' ? this : null; }
  contains(node: unknown) { return node === this; }
  querySelector(selector: string) {
    if (selector === '.ui-window') return this.inner;
    if (selector.includes('header')) return this.header;
    return null;
  }
  querySelectorAll() { return []; }
  focus() {}
  setPointerCapture() {}
}

function withDocument<T>(run: () => T): T {
  const doc = new Surface();
  Object.assign(doc, { createElement: () => { const el = new Surface(); el.ownerDocument = doc; return el; }, activeElement: null });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  try { return run(); }
  finally { if (original) Object.defineProperty(globalThis, 'document', original); }
}

function reset() {
  resetUiLayout();
  setUiEditMode(false);
}

/** dispatchEvent can't set a synthetic target — define it on the event. */
function fire(el: Surface, type: string, target: Surface): void {
  const event = new Event(type);
  Object.defineProperty(event, 'target', { value: target });
  el.dispatchEvent(event);
}

test('registerPanelFrames registers every panel id once, in the Panels group', () => {
  reset();
  registerPanelFrames(); registerPanelFrames();
  const ids = uiFrames().filter(f => f.group === 'Panels').map(f => f.id);
  for (const id of ['character', 'skills', 'quests', 'professions', 'achievements', 'glyphs', 'spellbook',
    'stats', 'inventory', 'map', 'service', 'event', 'expedition', 'journey', 'chronicle', 'controls',
    'changelog', 'leaderboard', 'rift', 'poi']) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate registrations');
});

test('attachPanelFrame survives innerHTML re-renders and disposes stale handles', () => withDocument(() => {
  reset();
  registerPanelFrames();
  const el = new Surface();
  const winA = new Surface(), headerA = new Surface();
  winA.classes.add('ui-window'); winA.header = headerA; el.inner = winA;
  const first = attachPanelFrame(el as unknown as HTMLElement, 'character')!;
  assert.equal(winA.dataset.uiFrame, 'character');
  assert.equal(winA.children.length, 1, 'scale grip appended');
  // Same window node → same handle, no duplicate grip.
  assert.equal(attachPanelFrame(el as unknown as HTMLElement, 'character'), first);
  // Re-render replaces the .ui-window node → old grip removed, new node attached.
  const gripA = winA.children[0] as Surface;
  const winB = new Surface(), headerB = new Surface();
  winB.classes.add('ui-window'); winB.header = headerB; el.inner = winB;
  const second = attachPanelFrame(el as unknown as HTMLElement, 'character')!;
  assert.notEqual(second, first);
  assert.ok(gripA.removed, 'stale grip disposed');
  assert.equal(winB.dataset.uiFrame, 'character');
  assert.equal(winB.children.length, 1);
  // Stable window, recreated header (service/rift/expedition innerHTML renders)
  // → re-attach so the new header owns the drag listeners.
  const headerC = new Surface(); winB.header = headerC;
  const third = attachPanelFrame(el as unknown as HTMLElement, 'character')!;
  assert.notEqual(third, second);
  assert.equal(winB.children.length, 1, 'old grip replaced, not duplicated');
}));

test('edit-mode panel opens into edit mode and closes out of it', () => withDocument(() => {
  reset();
  registerPanelFrames();
  let closed = 0;
  const panel = new UiLayoutPanel(new Surface() as unknown as HTMLElement, { close: () => closed++ });
  try {
    panel.open();
    assert.ok(panel.opened);
    assert.ok(uiEditMode());
    assert.ok(panel.element.innerHTML.includes('data-row="character"'));
    assert.ok(panel.element.innerHTML.includes('data-reset-all'));
    panel.close();
    assert.ok(!panel.opened && !uiEditMode() && closed === 1);
  } finally { panel.dispose(); }
}));

test('external edit-mode exit closes the panel and notifies once', () => withDocument(() => {
  reset();
  registerPanelFrames();
  let closed = 0;
  const panel = new UiLayoutPanel(new Surface() as unknown as HTMLElement, { close: () => closed++ });
  try {
    panel.open();
    setUiEditMode(false);
    assert.ok(!panel.opened);
    assert.equal(closed, 1);
  } finally { panel.dispose(); }
}));

test('row controls write through to the layout store', () => withDocument(() => {
  reset();
  registerPanelFrames();
  const panel = new UiLayoutPanel(new Surface() as unknown as HTMLElement, { close() {} });
  try {
    panel.open();
    const lock = new Surface(); lock.dataset = { frame: 'character', lock: '' };
    fire(panel.element as unknown as Surface, 'click', lock);
    assert.ok(uiLayout('character').locked);
    const scale = new Surface(); scale.dataset = { frame: 'character', scale: '' }; scale.value = '125';
    fire(panel.element as unknown as Surface, 'input', scale);
    assert.equal(uiLayout('character').scale, 1.25);
    const resetAll = new Surface(); resetAll.dataset = { resetAll: '' };
    fire(panel.element as unknown as Surface, 'click', resetAll);
    assert.ok(!uiLayout('character').locked && uiLayout('character').scale === 1);
  } finally { panel.dispose(); }
}));

test('HUD frames registered by other features appear alongside panels', () => withDocument(() => {
  reset();
  registerPanelFrames();
  registerUiFrame({ id: 'actionBar1', label: 'Action bar 1', group: 'HUD', hidable: true });
  const panel = new UiLayoutPanel(new Surface() as unknown as HTMLElement, { close() {} });
  try {
    panel.open();
    assert.ok(panel.element.innerHTML.includes('data-row="actionBar1"'));
    assert.ok(panel.element.innerHTML.includes('>HUD<'));
    const hide = new Surface(); hide.dataset = { frame: 'actionBar1', hide: '' };
    fire(panel.element as unknown as Surface, 'click', hide);
    assert.equal(uiLayout('actionBar1').visible, false);
    setUiLayout('actionBar1', { visible: true });
  } finally { panel.dispose(); }
}));
