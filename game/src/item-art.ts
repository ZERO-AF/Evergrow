import { riftKeyShapes } from './rift-key-art.ts';
import { charmShapes } from './charm-shapes.ts';
import { armorAccessoryShapes } from './armor-accessory-shapes.ts';
import { bootShapes } from './boot-shapes.ts';
import { jewelryShapes } from './jewelry-shapes.ts';
import { focusShapes } from './focus-shapes.ts';
import { armorShapes } from './armor-shapes.ts';
import type { ArmorPiece, CharacterOutfit } from './art-types.ts';
import type { CharacterSheet, Item } from './character-types.ts';
import { STARTING_SWORD } from './equipment.ts';
import { gearShapesSVG, shieldShapes, weaponShapes, type GearShape } from './weapon-shapes.ts';
import { type Point } from './art-primitives.ts';
import { consumableFor } from './consumable-content.ts';
import { consumableShapes } from './consumable-art.ts';
import { TIER_COLORS } from './items.ts';

const safeColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : '#798590';
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

const dropShapes = new WeakMap<Item, readonly GearShape[]>();
// Inline SVG resource IDs are document-wide, even inside hidden panels. Each
// rendering of the same item needs its own gradients and clipping resources.
let iconSerial = 0;
const iconPrefix = (kind: 'itm' | 'pack') => `${kind}-${++iconSerial}`;

/** Small world drops preserve the equipped silhouette and material. The geometry
 * cache follows the item lifetime; it does not accumulate an unbounded ID map. */
export function itemDropShapes(item: Item): readonly GearShape[] {
  const cached = dropShapes.get(item);
  if (cached) return cached;
  const { base, shadow, edge, trim } = item.appearance;
  const piece: ArmorPiece = { style: item.appearance.style, seed: item.seed, material: { base, shadow, edge, trim, surface: item.appearance.surface } };
  let shapes: readonly GearShape[], angle = 0;
  switch (item.kind) {
    case 'riftKey': shapes = riftKeyShapes(item); break;
    case 'charm': shapes = charmShapes(item); break;
    case 'weapon': shapes = weaponShapes(item.weapon?.visual ?? STARTING_SWORD.visual); angle = -.52; break;
    case 'grimoire': case 'orb': shapes = focusShapes(item.focus!.visual); break;
    case 'shield': shapes = shieldShapes(item.shield?.visual ?? { kind: 'kite', base, shadow, edge, trim }); break;
    case 'head': shapes = armorShapes('head', piece); break;
    case 'chest': shapes = armorShapes('chest', piece); break;
    case 'cloak': shapes = armorAccessoryShapes('cloak',piece); break;
    case 'gloves': shapes = [-1,1].flatMap(side => [
      ...armorAccessoryShapes('bracer',piece).map(s=>({...s,points:s.points.map(([x,y]):Point=>[side*4+x,y-8])})),
      ...armorAccessoryShapes('glove',piece).map(s=>({...s,points:s.points.map(([x,y]):Point=>[side*4+x*1.25,y*1.25-.6])})),
    ]); break;
    case 'legs': shapes = [-1,1].flatMap(side => [
      ...armorAccessoryShapes('thigh',piece).map(s=>({...s,points:s.points.map(([x,y]):Point=>[side*2.6+x,y-8])})),
      ...armorAccessoryShapes('knee',piece).map(s=>({...s,points:s.points.map(([x,y]):Point=>[side*2.8+x,y+.1])})),
      ...armorAccessoryShapes('bracer',piece).map(s=>({...s,points:s.points.map(([x,y]):Point=>[side*3+x*.85,y+2])})),
    ]); break;
    case 'boots': shapes = [-1, 1].flatMap(side => bootShapes(piece, Math.PI / 2 - side * .3).map(shape => ({ ...shape,
      points: shape.points.map(([x,y]):Point => [x * 1.5 + side * 3.6, y * 1.5 + 3.5]) }))); break;
    case 'ring': case 'amulet': case 'relic': shapes = jewelryShapes(item); break;
    case 'consumable': { const def = consumableFor(item); shapes = def ? consumableShapes(def) : []; break; }
  }
  if (shapes.length === 0) return [];
  const rotated = shapes.map(shape => ({ ...shape,
    surface: shape.surface ? { ...shape.surface, normal: [
      shape.surface.normal[0] * Math.cos(angle) - shape.surface.normal[1] * Math.sin(angle),
      shape.surface.normal[0] * Math.sin(angle) + shape.surface.normal[1] * Math.cos(angle),
      shape.surface.normal[2]] as const } : undefined,
    points: shape.points.map(([x, y]): Point => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)]) }));
  const points = rotated.flatMap(shape => shape.points), xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const target = item.kind === 'weapon' ? 22 : item.kind === 'ring' || item.kind === 'amulet' ? 12 : 16;
  const scale = target / Math.max(1, maxX - minX, maxY - minY);
  const result = rotated.map(shape => ({ ...shape, width: (shape.width ?? .7) * scale,
    points: shape.points.map(([x, y]): Point => [(x - (minX + maxX) / 2) * scale, (y - (minY + maxY) / 2) * scale]) }));
  dropShapes.set(item, result);
  return result;
}

/** Inventory silhouettes share each item's material and weapon dimensions with its worn art. */
export function itemIconSVG(item: Item, size = 48): string {
  const pixels = Number.isFinite(size) ? Math.max(16, Math.min(512, Math.round(size))) : 48;
  const prefix = iconPrefix('itm');
  const base = safeColor(item.appearance.base), shadow = safeColor(item.appearance.shadow);
  const edge = safeColor(item.appearance.edge), trim = safeColor(item.appearance.trim);
  const armorPiece: ArmorPiece = { style: item.appearance.style, seed: item.seed, material: { base, shadow, edge, trim, surface: item.appearance.surface } };
  const fine = pixels >= 96;
  let surfaceIndex = 0;
  const detailed = (shapes: readonly GearShape[]) => {
    return gearShapesSVG(shapes, fine, `${prefix}-${surfaceIndex++}`);
  };
  let shape: string;
  switch (item.kind) {
    case 'riftKey': case 'charm': shape = `<g transform="translate(24 24) scale(2.3)">${detailed(itemDropShapes(item))}</g>`; break;
    case 'weapon': {
      const visual = item.weapon?.visual ?? STARTING_SWORD.visual;
      const shapes = weaponShapes(visual);
      if (shapes.length === 0) { shape = ''; break; }
      const degrees = visual.kind === 'bow' ? -18 : -52;
      const angle = degrees * Math.PI / 180;
      const points = shapes.flatMap(shape => shape.points.map(([x, y]) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)]));
      const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
      const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
      const occupancy = visual.kind === 'wand' ? .72 : visual.kind === 'dagger' ? .78 : visual.kind === 'mace' && visual.length < 26 ? .9 : 1;
      const scale = occupancy * Math.min(37 / Math.max(1, maxX - minX), 40 / Math.max(1, maxY - minY));
      shape = `<g transform="translate(24 24) scale(${scale}) translate(${-(minX + maxX) / 2} ${-(minY + maxY) / 2}) rotate(${degrees})">${detailed(shapes)}</g>`;
      break;
    }
    case 'grimoire': case 'orb': {
      shape = `<g transform="translate(24 ${item.kind === 'orb' ? 39 : 33}) scale(${item.kind === 'orb' ? 2.3 : 2.15})">${detailed(focusShapes(item.focus!.visual))}</g>`;
      break;
    }
    case 'shield': {
      const visual = item.shield?.visual ?? { kind: 'kite', base, edge, trim, shadow };
      shape = `<g transform="translate(24 23) scale(1.45)">${detailed(shieldShapes(visual))}</g>`;
      break;
    }
    case 'head':
      shape = `<g transform="translate(24 23) scale(3.3)"><path d="M-4-.5H4V4L0 5L-4 4Z" fill="${shadow}"/>${detailed(armorShapes('head', armorPiece))}</g>`;
      break;
    case 'chest':
      shape = `<g transform="translate(24 ${armorPiece.style==='cloth'?16:19}) scale(${armorPiece.style==='cloth'?1.5:2.15})">
        <path d="M-5-5H5L6 9L3 11H-3L-6 9Z" fill="${shadow}"/>
        <g transform="translate(-6 -4) rotate(18)">${detailed(armorShapes('shoulder', armorPiece))}</g>
        <g transform="translate(6 -4) scale(-1 1) rotate(18)">${detailed(armorShapes('shoulder', armorPiece))}</g>
        ${detailed(armorShapes('chest', armorPiece))}</g>`;
      break;
    case 'gloves': case 'legs': case 'cloak':
      shape = `<g transform="translate(24 24) scale(2.25)">${detailed(itemDropShapes(item))}</g>`;
      break;
    case 'boots':
      shape = [-1, 1].map(side => `<g transform="translate(${24 + side * 10} 36) scale(4)">${detailed(bootShapes(armorPiece, Math.PI / 2 - side * .3))}</g>`).join('');
      break;
    case 'amulet': case 'ring': case 'relic':
      shape = `<g transform="translate(24 24) scale(2.05)">${detailed(jewelryShapes(item))}</g>`;
      break;
    case 'consumable':
      shape = `<g transform="translate(24 25) scale(2.3)">${detailed(itemDropShapes(item))}</g>`;
      break;
  }
  const rarity = TIER_COLORS[item.tier];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><title>${escape(item.name)}</title>
    <defs><radialGradient id="${prefix}-bg" cx=".5" cy=".38" r=".78"><stop offset="0" stop-color="#1d2c38"/><stop offset=".7" stop-color="#0c151d"/><stop offset="1" stop-color="#070d13"/></radialGradient>
    <linearGradient id="${prefix}-sheen" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".16"/><stop offset=".42" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs>
    <rect x="1" y="1" width="46" height="46" fill="url(#${prefix}-bg)"/>
    <ellipse cx="24" cy="40" rx="15" ry="3.4" fill="#04070c" opacity=".5"/>${shape}
    <rect x="1" y="1" width="46" height="46" fill="url(#${prefix}-sheen)"/>
    <rect x="1" y="1" width="46" height="46" fill="none" stroke="#05090e" stroke-width="2.6"/>
    <rect x="2.4" y="2.4" width="43.2" height="43.2" fill="none" stroke="${rarity}" stroke-width="1.7"/>
    <rect x="4.6" y="4.6" width="38.8" height="38.8" fill="none" stroke="${rarity}" stroke-width=".7" opacity=".38"/></svg>`;
}

/** Upright, aspect-correct art for rectangular pack footprints. */
export function itemPackIconSVG(item: Item, width: number, height: number): string {
  let shapes = item.kind === 'weapon' ? weaponShapes(item.weapon?.visual ?? STARTING_SWORD.visual) : itemDropShapes(item);
  if (item.kind === 'weapon' && item.weapon?.family !== 'bow') shapes = shapes.map(shape => ({ ...shape, points: shape.points.map(([x, y]): Point => [y, -x]) }));
  const points = shapes.flatMap(shape => shape.points);
  if (!points.length) return '';
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = width * 40, h = height * 40;
  const scale = Math.min((w - 16) / Math.max(1, maxX - minX), (h - 18) / Math.max(1, maxY - minY));
  const prefix = iconPrefix('pack');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><g transform="translate(${w / 2} ${h / 2}) scale(${scale}) translate(${-(minX + maxX) / 2} ${-(minY + maxY) / 2})">${gearShapesSVG(shapes, true, prefix)}</g><rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="${TIER_COLORS[item.tier]}" stroke-width="2" opacity=".8"/></svg>`;
}

function armor(item: Item | null): ArmorPiece | null {
  if (!item) return null;
  const { base, shadow, edge, trim, style } = item.appearance;
  return { style, seed: item.seed, material: { base, shadow, edge, trim, surface: item.appearance.surface } };
}

/** Explicit empty pieces remove equipment from both the paper doll and world character. */
export function outfitFromEquipment(sheet: CharacterSheet): Partial<CharacterOutfit> {
  const { head, chest, gloves, legs, boots, cloak } = sheet.equipped;
  const shoulders = armor(chest);
  return {
    head: armor(head), chest: armor(chest), shoulders: shoulders ? { ...shoulders, seed: shoulders.seed + 25 } : null,
    hands: armor(gloves), legs: armor(legs), boots: armor(boots),
    cloak: cloak ? { base: cloak.appearance.base, shadow: cloak.appearance.shadow, highlight: cloak.appearance.edge,
      trim: cloak.appearance.trim, seed: cloak.seed } : null,
  };
}
