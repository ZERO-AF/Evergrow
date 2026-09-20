/** Consumable silhouettes (vials, plates) in the shared item-shape space. DOM/art
 * only — kept out of consumable-content.ts so the headless core never pulls in
 * weapon-shapes/gear-material. */
import type { GearShape } from './weapon-shapes.ts';
import type { ConsumableDef } from './consumable-content.ts';

const shape = (points: readonly (readonly [number, number])[], fill: string): GearShape => ({ points, fill });
const line = (points: readonly (readonly [number, number])[], stroke: string, width = .5): GearShape => ({ points, stroke, width });

/** Vial/plate silhouettes in the same local space as the other item shape packs. */
export function consumableShapes(def: ConsumableDef): readonly GearShape[] {
  const liquid = def.color, glass = '#d8e4ea', cork = '#c9a86a', shadow = '#1a2530';
  switch (def.buffCategory) {
    case 'flask': return [
      shape([[-1.6, -8.5], [1.6, -8.5], [1.6, -6.8], [-1.6, -6.8]], cork),
      shape([[-1.1, -6.8], [1.1, -6.8], [1.1, -4.6], [-1.1, -4.6]], glass),
      shape([[-1.1, -4.6], [1.1, -4.6], [4.4, 1.2], [4.9, 4.4], [3.4, 7.2], [-3.4, 7.2], [-4.9, 4.4], [-4.4, 1.2]], liquid),
      line([[-2.2, .4], [-3.4, 4.6]], '#ffffff', .45),
    ];
    case 'battleElixir': case 'guardianElixir': return [
      shape([[-1.2, -8.5], [1.2, -8.5], [1.2, -7], [-1.2, -7]], cork),
      shape([[-.9, -7], [.9, -7], [.9, -4.8], [2.7, -1.6], [2.7, 5.4], [-2.7, 5.4], [-2.7, -1.6], [-.9, -4.8]], glass),
      shape([[-2.2, .6], [2.2, .6], [2.2, 4.9], [-2.2, 4.9]], liquid),
      line([[-1.4, -3.4], [-1.4, 4.2]], '#ffffff', .4),
    ];
    case 'potion': return [
      shape([[-1.3, -7.6], [1.3, -7.6], [1.3, -6.2], [-1.3, -6.2]], cork),
      shape([[-1, -6.2], [1, -6.2], [1, -4.4], [3.5, -.8], [3.5, 4.6], [2.2, 6.4], [-2.2, 6.4], [-3.5, 4.6], [-3.5, -.8], [-1, -4.4]], glass),
      shape([[-2.9, .4], [2.9, .4], [2.9, 4.4], [1.9, 5.8], [-1.9, 5.8], [-2.9, 4.4]], liquid),
      line([[-1.9, -.4], [-1.9, 4.6]], '#ffffff', .4),
    ];
    case 'food': return [
      shape([[-7.4, 4.4], [7.4, 4.4], [5.4, 6.6], [-5.4, 6.6]], shadow),
      shape([[-6.4, 3.6], [6.4, 3.6], [5, 5.4], [-5, 5.4]], glass),
      shape([[-4.6, 3.4], [-3.4, -.6], [-1.4, -2.6], [1.4, -2.6], [3.4, -.6], [4.6, 3.4]], liquid),
      line([[-1.6, -3.4], [-2.4, -5], [-1.2, -6.4]], '#e8f0f2', .5),
      line([[1.4, -3.4], [.6, -5], [1.8, -6.4]], '#e8f0f2', .5),
    ];
  }
}
