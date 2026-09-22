import test from 'node:test';
import assert from 'node:assert/strict';
import { classStyle, castSignature, castSchoolStyle, schoolOf, CLASS_STYLES } from '../src/spell-school.ts';
import { WOW_CLASS_IDS, type WowClassId } from '../src/wow-types.ts';
import { WOW_CLASSES } from '../src/wow-classes.ts';
import { createWowSim } from './fixtures/wow-sim.ts';
import { drawSchoolImpact, schoolCastAura } from '../src/spell-school-art.ts';

/** Recording 2D-context stub: absorbs every draw call, captures paint colors. */
function recordingContext() {
  const colors: string[] = [];
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (target, prop) => target[prop as string] ??= (typeof prop === 'string' && /^(fill|stroke)Style$/.test(prop) ? '' : () => {}),
    set: (target, prop, value) => {
      if (typeof prop === 'string' && /^(fill|stroke)Style$/.test(prop) && typeof value === 'string') colors.push(value);
      target[prop as string] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, colors };
}

test('classStyle returns a distinct signature palette for all 10 classes', () => {
  const accents = new Set<string>(), palettes = new Set<string>(), motifs = new Set<string>();
  for (const id of WOW_CLASS_IDS) {
    const cls = classStyle(id);
    assert.ok(cls, `${id} has a class style`);
    for (const key of ['accent', 'hot', 'deep'] as const) assert.match(cls[key], /^#[0-9a-f]{6}$/);
    assert.ok(cls.motif.length > 0);
    accents.add(cls.accent);
    palettes.add(`${cls.accent}|${cls.hot}|${cls.deep}|${cls.motif}`);
    motifs.add(cls.motif);
  }
  assert.equal(accents.size, WOW_CLASS_IDS.length, 'every class accent color is unique');
  assert.equal(palettes.size, WOW_CLASS_IDS.length, 'every class palette+ motif is unique');
  assert.equal(motifs.size, WOW_CLASS_IDS.length, 'every class motif is unique');
  assert.equal(Object.keys(CLASS_STYLES).length, WOW_CLASS_IDS.length);
});

test('classStyle is null-safe so shared and enemy skills keep school art', () => {
  assert.equal(classStyle(undefined), null);
  assert.equal(classStyle(null), null);
  assert.equal(classStyle('murloc'), null);
  assert.equal(classStyle(''), null);
});

test('schoolOf still maps every style payload to its school', () => {
  assert.equal(schoolOf('holy'), 'holy');
  assert.equal(schoolOf('shadow'), 'shadow');
  assert.equal(schoolOf('fire'), 'fire');
  assert.equal(schoolOf('frost'), 'frost');
  assert.equal(schoolOf('lightning'), 'lightning');
  assert.equal(schoolOf('nature'), 'nature');
  assert.equal(schoolOf('poison'), 'nature');
  assert.equal(schoolOf('arcane'), 'arcane');
  assert.equal(schoolOf('physical'), 'physical');
  assert.equal(schoolOf('bleed'), 'physical');
  // Unstyled packs keep their own art.
  assert.equal(schoolOf('arrow'), null);
  assert.equal(schoolOf('spirit'), null);
  assert.equal(schoolOf('radiant'), null);
});

test('castSignature pairs the school style with the caster class accent', () => {
  for (const id of WOW_CLASS_IDS) {
    const sim = createWowSim(id);
    const starter = WOW_CLASSES[id].starterSkill;
    const sig = castSignature(sim.player, starter);
    assert.equal(sig === null, castSchoolStyle(sim.player, starter) === null, `${id} signature matches school resolution`);
    if (!sig) continue;
    assert.equal(sig.style, castSchoolStyle(sim.player, starter));
    assert.equal(sig.cls, classStyle(id), `${id} cast carries its own class accent`);
  }
});

test('same school reads differently per class: mage frost vs death knight frost', () => {
  const mage = createWowSim('mage'), dk = createWowSim('deathKnight');
  const mageSig = castSignature(mage.player, 'frostbolt');
  const dkSig = castSignature(dk.player, 'icyTouch');
  assert.equal(mageSig?.style, 'frost');
  assert.equal(dkSig?.style, 'frost');
  assert.notEqual(mageSig?.cls?.accent, dkSig?.cls?.accent);
  assert.equal(mageSig?.cls?.motif, 'star');
  assert.equal(dkSig?.cls?.motif, 'rune');
});

test('shaman lightning carries the elemental class accent, not a generic nature look', () => {
  const sim = createWowSim('shaman');
  const sig = castSignature(sim.player, 'lightningBolt');
  assert.equal(sig?.style, 'lightning');
  assert.equal(sig?.cls?.motif, 'totem');
  assert.equal(sig?.cls, classStyle('shaman' as WowClassId));
});

test('class accent is painted into the burst and the cast aura', t => {
  // drawGlow caches a code-generated light stamp per color on a real canvas.
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({
      createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, set fillStyle(_v: string) {},
    }) }),
  } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  const mage = classStyle('mage')!;
  const burst = recordingContext();
  assert.equal(drawSchoolImpact(burst.ctx, 0, 0, 'frost', .2, 1, false, mage), true);
  assert.ok(burst.colors.includes(mage.accent), 'impact burst paints the class accent');
  const aura = recordingContext();
  assert.equal(schoolCastAura(aura.ctx, 0, 0, 'frost', 1.2, 1, false, mage), true);
  assert.ok(aura.colors.includes(mage.accent), 'cast aura paints the class accent');
  const plain = recordingContext();
  assert.equal(drawSchoolImpact(plain.ctx, 0, 0, 'frost', .2, 1, false), true);
  assert.ok(!plain.colors.includes(mage.accent), 'classless casts keep pure school art');
});
