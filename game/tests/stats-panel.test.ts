import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Exercise the stats sheet's real DOM owner without launching gameplay.
const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { StatsPanel, statsPanelToggle } = await import('../src/stats-panel.ts');
const { initialPlayer } = await import('../src/simulation.ts');
const { createCharacterSheet } = await import('../src/items.ts');
const { refreshCharacter } = await import('../src/character.ts');
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
  querySelectorAll() { return []; }
  getClientRects() { return { length: 0 }; }
  focus() {}
}

function playerOf(classId: Parameters<typeof createCharacterSheet>[0]) {
  const p = initialPlayer(0, 0);
  p.character = createCharacterSheet(classId, 'human');
  refreshCharacter(p);
  p.hp = p.maxHp; p.mana = p.maxMana;
  return p;
}

function openPanel() {
  const doc = new Surface();
  Object.assign(doc, { createElement: () => { const el = new Surface(); el.ownerDocument = doc; return el; }, activeElement: null, defaultView: null });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  const panel = new StatsPanel(new Surface() as unknown as HTMLElement, { close() {} });
  return { panel, restore: () => { panel.dispose(); if (original) Object.defineProperty(globalThis, 'document', original); } };
}

test('stats panel renders WotLK groups from derived stats', () => {
  const { panel, restore } = openPanel();
  try {
    const p = playerOf('warrior');
    p.mana = 40; // rage
    panel.update(p, 10);
    panel.open();
    const html = panel.element.innerHTML;
    for (const title of ['Base Stats', 'Melee', 'Ranged', 'Spell', 'Defenses', 'Resource'])
      assert.ok(html.includes(`>${title}<`), title);
    assert.ok(html.includes('Rage'), 'warrior resource label');
    assert.ok(html.includes('40 / 100'), 'rage pool');
    assert.ok(html.includes('100%'), 'hit chance');
    assert.ok(html.includes('Damage per second'), 'dps row');
    assert.ok(html.includes('Block chance'), 'shield block row');
    assert.ok(html.includes('Fire resistance'), 'resistance rows');
    assert.ok(!html.includes('Runes'), 'no runes for warrior');
  } finally { restore(); }
});

test('stats panel shows class resources: runes, shards, combo points', () => {
  const { panel, restore } = openPanel();
  try {
    const dk = playerOf('deathKnight');
    dk.runes = [15, 0, 0, 0, 0, 0]; dk.mana = 55;
    panel.update(dk, 10);
    panel.open();
    let html = panel.element.innerHTML;
    assert.ok(html.includes('Runic Power'), 'dk resource label');
    assert.ok(html.includes('5 / 6 ready'), 'rune readiness');
    assert.ok(html.includes('Next rune in 5s'), 'rune recharge countdown');

    const lock = playerOf('warlock');
    lock.soulShards = 3;
    panel.update(lock, 10);
    html = panel.element.innerHTML;
    assert.ok(html.includes('Soul shards'), 'warlock shards');
    assert.ok(html.includes('3 / 4'), 'shard count');

    const rogue = playerOf('rogue');
    rogue.comboPoints = 4; rogue.mana = 80;
    panel.update(rogue, 10);
    html = panel.element.innerHTML;
    assert.ok(html.includes('Energy'), 'rogue resource label');
    assert.ok(html.includes('80 / 100'), 'energy pool');
    assert.ok(html.includes('4 / 5'), 'combo points');
    assert.ok(html.includes('>1 sec<'), 'rogue gcd');
  } finally { restore(); }
});

test('statsPanelToggle opens and closes the panel', () => {
  const { panel, restore } = openPanel();
  try {
    panel.update(playerOf('mage'), 0);
    assert.equal(panel.opened, false);
    statsPanelToggle(panel);
    assert.equal(panel.opened, true);
    statsPanelToggle(panel);
    assert.equal(panel.opened, false);
  } finally { restore(); }
});
