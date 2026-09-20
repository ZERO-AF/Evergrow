import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Exercise the spellbook's real DOM owner without launching gameplay.
const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { SpellbookPanel } = await import('../src/spellbook-panel.ts');
const { initialPlayer } = await import('../src/simulation.ts');
const { createCharacterSheet } = await import('../src/items.ts');
const { refreshCharacter } = await import('../src/character.ts');
const { WOW_CLASS_SKILLS, WOW_RACIAL_SKILLS } = await import('../src/wow-skills.ts');
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
  querySelector() { return null; }
  getClientRects() { return { length: 0 }; }
  focus() {}
}

function playerOf(classId: Parameters<typeof createCharacterSheet>[0], raceId: Parameters<typeof createCharacterSheet>[1]) {
  const p = initialPlayer(0, 0);
  p.character = createCharacterSheet(classId, raceId);
  refreshCharacter(p);
  p.hp = p.maxHp; p.mana = p.maxMana;
  return p;
}

function openPanel() {
  const doc = new Surface();
  Object.assign(doc, { createElement: () => { const el = new Surface(); el.ownerDocument = doc; return el; }, activeElement: null, defaultView: null });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  const panel = new SpellbookPanel(new Surface() as unknown as HTMLElement, { close() {} });
  return { panel, restore: () => { panel.dispose(); if (original) Object.defineProperty(globalThis, 'document', original); } };
}

test('spellbook lists the full class kit plus the racial, locked until allocated', () => {
  const { panel, restore } = openPanel();
  try {
    const p = playerOf('mage', 'gnome');
    panel.update(p);
    panel.open();
    const html = panel.element.innerHTML;
    for (const skill of WOW_CLASS_SKILLS.mage) assert.ok(html.includes(`>${skill.name.replace(/'/g, '&#39;')}<`), skill.id);
    assert.ok(html.includes(WOW_RACIAL_SKILLS.gnome.name), 'racial listed');
    assert.ok(html.includes('Racial — Gnome'), 'racial group');
    for (const group of ['Frost', 'Fire', 'Arcane']) assert.ok(html.includes(`>${group}<`), group);
    assert.ok(html.includes('Locked'), 'unlearned spells show locked state');
    assert.ok(html.includes('1 skill point'), 'unlock cost shown');
    assert.ok(html.includes(`${WOW_CLASS_SKILLS.mage.length + 1}`), 'total count');
  } finally { restore(); }
});

test('allocated sanctum nodes flip spells to learned with rank', () => {
  const { panel, restore } = openPanel();
  try {
    const p = playerOf('warrior', 'tauren');
    p.character.allocatedNodes.push('wow-warrior-heroicStrike', 'wow-warrior-thunderClap');
    p.character.skillRanks.heroicStrike = 3;
    panel.update(p);
    panel.open();
    const html = panel.element.innerHTML;
    assert.ok(html.includes('Rank 3'), 'purchased rank shown');
    assert.ok(html.includes('War Stomp'), 'tauren racial');
    assert.ok(html.includes('Rage'), 'rage cost label');
  } finally { restore(); }
});

test('death knight rune costs and filters render', () => {
  const { panel, restore } = openPanel();
  try {
    const p = playerOf('deathKnight', 'orc');
    panel.update(p);
    panel.open();
    const html = panel.element.innerHTML;
    assert.ok(html.includes('1 Frost'), 'rune cost shown');
    assert.ok(html.includes('Blood'), 'blood rune label');
    assert.ok(html.includes('data-filter="locked"'), 'locked filter');
    assert.ok(html.includes('Summons'), 'summon group');
  } finally { restore(); }
});
