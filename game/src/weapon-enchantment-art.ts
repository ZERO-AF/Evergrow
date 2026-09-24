import { weaponGlowColor, isRadiantWand, RADIANT_COLORS } from './radiant-content.ts';
import { drawRadiantSeal } from './radiant-art.ts';
import type { WeaponVisual } from './model.ts';
import { weaponArtLength } from './weapon-shapes.ts';
import { line, polygon, type Point } from './art-primitives.ts';

/** Weapon-imbue elements carried by WowBuff.imbue (Windfury/Flametongue/poisons/seals/stones). */
export type ImbueElement = 'fire' | 'frost' | 'lightning' | 'nature' | 'shadow' | 'holy';
export const IMBUE_COLORS: Readonly<Record<ImbueElement, string>> = Object.freeze({
  fire: '#f7995c', frost: '#91d4ee', lightning: '#bcb0ff',
  nature: '#8fd06a', shadow: '#a06ad8', holy: '#ffe9a0',
});

/** Small equipment glow also works in detached portrait canvases and geometry reviews. */
export function drawEquipmentGlow(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, power: number) {
  c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha *= power;
  const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color); gradient.addColorStop(.2, color + 'aa'); gradient.addColorStop(1, color + '00');
  c.fillStyle = gradient; c.fillRect(x - radius, y - radius, radius * 2, radius * 2); c.restore();
}

/** Local-space bounded effects: no particles allocated per frame, no gameplay state. */
export function drawWeaponEnchantment(c: CanvasRenderingContext2D, v: WeaponVisual, time: number, charge: number, imbue?: ImbueElement) {
  // An active imbue owns the blade's element and glow while its buff lasts.
  const element = imbue ?? v.element;
  const glow = imbue ? IMBUE_COLORS[imbue] : weaponGlowColor(v);
  if (!glow || !element || element === 'physical' || v.kind === 'bow' || v.kind === 'unarmed') return;
  const wand = v.kind === 'wand', caster = v.kind === 'staff' || wand, length = weaponArtLength(v);
  const start = caster ? length - 3 : length * (v.kind === 'axe' || v.kind === 'mace' ? .65 : .23);
  const end = length - 1, pulse = .65 + Math.sin(time * 2.2) * .08 + charge * .25;
  drawEquipmentGlow(c, (start + end) / 2, 0, wand ? 4 + charge * 2 : caster ? 7 + charge * 3 : 6, glow, pulse * .55);
  c.save(); c.globalCompositeOperation = 'screen';
  if (!caster) {
    c.globalAlpha *= .5;
    line(c, [[start, 0], [end, 0]], glow, 2.2);
    c.globalAlpha *= 1.5;
    line(c, [[start, 0], [end, 0]], '#eefbff', .4);
  }
  if (isRadiantWand(v)) {
    c.translate(end, 0);
    c.globalAlpha *= .45 + charge * .5;
    if (charge > .05) drawRadiantSeal(c, 1.8 + charge * 2, .25);
    polygon(c, [[-1.5, 0], [0, -.65], [1.8, 0], [0, .65]], RADIANT_COLORS.core);
  } else if (element === 'lightning') {
    const points: Point[] = Array.from({ length: 8 }, (_, i) => [start + (end - start + 3) * i / 7,
      Math.sin(i * 13.1 + Math.floor(time * 9)) * (i === 0 || i === 7 ? .3 : wand ? .8 : 2.3)]);
    c.globalAlpha *= .7; line(c, points, glow, .9); line(c, points, '#eef5ff', .3);
    // A second, finer arc jitters off-phase so the charge reads as live current.
    const arc: Point[] = Array.from({ length: 6 }, (_, i) => [start + (end - start) * i / 5,
      Math.sin(i * 7.7 + Math.floor(time * 13) + 2) * (wand ? .5 : 1.4)]);
    c.globalAlpha *= .6; line(c, arc, glow, .5);
    for (let i = 0; i < 3; i++) {
      const phase = ((time * 1.4 + i * .33) % 1 + 1) % 1;
      c.globalAlpha = Math.sin(phase * Math.PI) * .7;
      c.fillStyle = '#eef5ff';
      c.fillRect(start + (end - start) * phase - .5, Math.sin(i * 9 + time * 11) * 2 - .5, 1, 1);
    }
  } else if (element === 'shadow' || element === 'holy') {
    // Seals and stones: slow orbiting motes along the blade instead of flames.
    for (let i = 0; i < 4; i++) {
      const phase = ((time * .3 + i * .25) % 1 + 1) % 1;
      const x = start + (end - start) * phase, y = Math.sin(phase * Math.PI * 2) * (wand ? 1.6 : 3);
      c.globalAlpha *= 1;
      c.save(); c.globalAlpha *= Math.sin(phase * Math.PI) * .8;
      // Shadow motes drag a short dark tail; holy motes sparkle with a cross glint.
      if (element === 'shadow') line(c, [[x - 2.4, y + 1.2], [x, y]], glow, .7);
      polygon(c, [[x, y - 1.1], [x + .8, y], [x, y + 1.1], [x - .8, y]], glow);
      if (element === 'holy') {
        c.globalAlpha *= .8;
        line(c, [[x - 1.6, y], [x + 1.6, y]], '#fffbe8', .4);
        line(c, [[x, y - 1.6], [x, y + 1.6]], '#fffbe8', .4);
      }
      c.restore();
    }
  } else for (let i = 0; i < 4; i++) {
    const phase = ((time * (element === 'fire' ? .55 : .22) + i * .25) % 1 + 1) % 1;
    const x = start + (end - start) * (i / 3), y = -phase * (wand ? 2.5 : element === 'fire' ? 7 : 4);
    c.save(); c.globalAlpha *= Math.sin(phase * Math.PI) * .8;
    if (element === 'fire') {
      const size = wand ? .4 : 1;
      polygon(c, [[x - .7 * size, y], [x + Math.sin(time * 3 + i) * 1.2 * size, y - 2.8 * size], [x + .8 * size, y + .7 * size]], glow);
      // Ember flecks shed off the flame tongue.
      c.fillStyle = '#ffd98a';
      c.fillRect(x + Math.sin(time * 5 + i * 2) * 1.6, y - 3.4 * size - phase * 2, .7 * size, .7 * size);
    } else if (element === 'frost') {
      const size = .8 * (wand ? .65 : 1);
      polygon(c, [[x, y - size], [x + size * .6, y], [x, y + size], [x - size * .6, y]], glow);
      // A cold glint crosses each shard.
      c.globalAlpha *= .7;
      line(c, [[x - size * .8, y], [x + size * .8, y]], '#f2ffff', .35);
    } else if (element === 'nature') {
      // Living leaves orbit the blade instead of bare motes.
      const size = .55 * (wand ? .65 : 1);
      const rot = phase * Math.PI * 2 + i;
      c.save(); c.translate(x, y); c.rotate(rot);
      polygon(c, [[0, -size * 1.4], [size * .8, 0], [0, size * 1.4], [-size * .8, 0]], glow);
      line(c, [[0, -size], [0, size]], '#d8ffb0', .3);
      c.restore();
    } else {
      const size = .55 * (wand ? .65 : 1);
      polygon(c, [[x, y - size], [x + size * .6, y], [x, y + size], [x - size * .6, y]], glow);
    }
    c.restore();
  }
  c.restore();
}
