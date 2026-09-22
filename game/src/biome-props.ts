import { BIOME_IDS, type BiomeId, type BiomeWeights } from './biomes.ts';

export type PropKind = 'tree' | 'deadTree' | 'rock' | 'shrine' | 'willow' | 'reeds' | 'fern' | 'flowers'
  | 'canopy' | 'snowPine' | 'iceCrystal' | 'charredTree' | 'basalt' | 'emberRock' | 'autumnTree'
  | 'sandstoneShard' | 'dryGrass' | 'sandstone' | 'thornBrush' | 'steppeStone' | 'desertScrub'
  | 'leafPile' | 'windTree' | 'heather' | 'limestone' | 'tussock' | 'mushrooms' | 'stump' | 'lilies'
  | 'giantMushroom';

export interface PropDefinition {
  readonly radius: readonly [number, number];
  readonly scale: readonly [number, number];
  /** Projected crown center above the ground contact, used for site clearance and player occlusion. */
  readonly canopy: Readonly<{ height: number; radius: number; offsetX: number }> | null;
  readonly shadow: readonly [number, number];
  readonly sway: number;
  readonly emissive: Readonly<{ offsetX: number; offsetY: number; radius: number; color: string; power: number }> | null;
  /** Placement-rate multiplier consumed by the shared seeded density gate. */
  readonly density: number;
}
const definition = (radius: readonly [number, number], canopy: PropDefinition['canopy'] = null,
  shadow: readonly [number, number] = [14, 6], sway = 0, emissive: PropDefinition['emissive'] = null,
  scale: readonly [number, number] = [.82, 1.2], density = 1): PropDefinition => Object.freeze({
  radius: Object.freeze(radius), scale: Object.freeze(scale), canopy: canopy ? Object.freeze(canopy) : null,
  shadow: Object.freeze(shadow), sway, emissive: emissive ? Object.freeze(emissive) : null, density,
});
const crown = (height: number, radius: number, offsetX = 0) => ({ height, radius, offsetX });

/** Collision, silhouette, wind and emitted light all consume this same immutable vocabulary. */
export const PROP_DEFINITIONS: Readonly<Record<PropKind, PropDefinition>> = Object.freeze({
  sandstoneShard: definition([7, 10], null, [13, 4], 0, null, [.82, 1.2], 2.4),
  dryGrass: definition([0, 0], null, [0, 0], 1.1, null, [.8, 1.2], 2.6),
  desertScrub: definition([0, 0], null, [0, 0], .3, null, [.82, 1.2], 2.6),
  thornBrush: definition([7, 10], null, [18, 5], .3, null, [.82, 1.2], 2.2),
  sandstone: definition([11, 14], null, [24, 9], 0, null, [.9, 1.2], 1.5),
  steppeStone: definition([9, 13], null, [19, 7], 0, null, [.9, 1.2], 1.5),
  tree: definition([9, 14], crown(90, 66), [24, 9], .7, null, [.9, 1.3], 1.35),
  deadTree: definition([9, 14], crown(79, 55), [18, 7], .25, null, [.9, 1.3], 1.35),
  rock: definition([8, 13], null, [14, 6], 0, null, [.82, 1.2], 1.5),
  shrine: definition([15, 15], null, [15, 9], 0, { offsetX: -18, offsetY: -31, radius: 215, color: '#ffa64f', power: .92 }, [1, 1]),
  canopy: definition([10, 14], crown(100, 80), [28, 10], .65, null, [.95, 1.4], 1.35),
  willow: definition([10, 14], crown(99, 80), [27, 10], 1, null, [.95, 1.4], 1.35),
  reeds: definition([0, 0], null, [0, 0], 1, null, [.82, 1.2], 2.6),
  fern: definition([0, 0], null, [0, 0], .6, null, [.9, 1.35], 2.6),
  flowers: definition([0, 0], null, [0, 0], .7, null, [.9, 1.35], 2.6),
  snowPine: definition([9, 14], crown(96, 59), [25, 9], .35, null, [.9, 1.3], 1.35),
  iceCrystal: definition([7, 12], null, [16, 5], 0, { offsetX: 0, offsetY: -16, radius: 72, color: '#8cd7ec', power: .16 }, [.82, 1.2], 1.8),
  charredTree: definition([9, 13], crown(70, 55), [18, 7], .18, null, [.9, 1.3], 1.35),
  basalt: definition([9, 14], null, [17, 6], 0, null, [.82, 1.2], 1.5),
  emberRock: definition([8, 12], null, [17, 6], 0, { offsetX: 0, offsetY: -6, radius: 90, color: '#ed925d', power: .25 }, [.82, 1.2], 1.8),
  autumnTree: definition([10, 14], crown(97, 87), [29, 10], .8, null, [.95, 1.4], 1.35),
  leafPile: definition([0, 0], null, [0, 0], 0, null, [.82, 1.2], 2.6),
  windTree: definition([9, 13], crown(69, 64, 15), [24, 7], 1.1, null, [.9, 1.3], 1.35),
  heather: definition([0, 0], null, [0, 0], .85, null, [.9, 1.35], 2.6),
  limestone: definition([8, 14], null, [19, 6], 0, null, [.82, 1.2], 1.5),
  tussock: definition([0, 0], null, [0, 0], 1.1, null, [.9, 1.35], 2.6),
  mushrooms: definition([0, 0], null, [0, 0], 0, { offsetX: 0, offsetY: -7, radius: 36, color: '#a5cdb6', power: .07 }, [.8, 1.1], 2.6),
  stump: definition([7, 11], null, [13, 5], 0, null, [.8, 1.1], 1.6),
  lilies: definition([0, 0], null, [0, 0], .1, null, [.82, 1.2], 2.6),
  // Zangarmarsh's towering mushroom trees: a thick stalk and a broad glowing cap.
  giantMushroom: definition([11, 15], crown(120, 84), [30, 11], .35,
    { offsetX: 0, offsetY: -96, radius: 120, color: '#7fd4c9', power: .3 }, [.9, 1.2], 1.2),
});

export const PROP_KINDS = Object.freeze(Object.keys(PROP_DEFINITIONS) as PropKind[]);
export const propDefinition = (kind: PropKind): PropDefinition => PROP_DEFINITIONS[kind];
export interface PropWeight { readonly kind: PropKind; readonly weight: number; }
const table = (...entries: readonly (readonly [PropKind, number])[]): readonly PropWeight[] =>
  Object.freeze(entries.map(([kind, weight]) => Object.freeze({ kind, weight })));

/** Relative local abundance. At an ecotone, both biome identity and species are
 * sampled from the continuous material weights at the prop's actual position. */
export const BIOME_PROP_TABLES: Readonly<Record<BiomeId, readonly PropWeight[]>> = Object.freeze({
  steppe: table(['dryGrass', 78], ['tussock', 14], ['thornBrush', 8], ['steppeStone', 8], ['flowers', 10], ['desertScrub', 4]),
  sunscar: table(['sandstone', 18], ['desertScrub', 56], ['dryGrass', 16], ['sandstoneShard', 9], ['thornBrush', 3]),
  deadwood: table(['deadTree', 34], ['tree', 8], ['rock', 10], ['stump', 12], ['mushrooms', 16], ['tussock', 14], ['fern', 6]),
  verdant: table(['canopy', 40], ['tree', 5], ['fern', 20], ['flowers', 14], ['mushrooms', 11], ['stump', 5], ['rock', 5]),
  swamp: table(['willow', 30], ['reeds', 26], ['lilies', 20], ['deadTree', 8], ['mushrooms', 9], ['stump', 3], ['rock', 4]),
  frostpine: table(['snowPine', 42], ['iceCrystal', 16], ['rock', 7], ['deadTree', 4], ['tussock', 18], ['stump', 7], ['flowers', 6]),
  emberfall: table(['charredTree', 30], ['basalt', 22], ['emberRock', 17], ['stump', 10], ['tussock', 15], ['dryGrass', 6]),
  autumn: table(['autumnTree', 38], ['leafPile', 24], ['fern', 10], ['mushrooms', 11], ['stump', 7], ['rock', 5], ['flowers', 5]),
  highlands: table(['windTree', 12], ['heather', 30], ['limestone', 18], ['tussock', 30], ['flowers', 8], ['stump', 2]),
});
const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1 - Number.EPSILON, value)) : 0;

export function chooseBiomeProp(weights: BiomeWeights, biomeRoll: number, kindRoll: number): { biome: BiomeId; kind: PropKind } {
  let roll = unit(biomeRoll), biome: BiomeId = BIOME_IDS[BIOME_IDS.length - 1];
  for (const candidate of BIOME_IDS) {
    if (roll < weights[candidate]) { biome = candidate; break; }
    roll -= weights[candidate];
  }
  const entries = BIOME_PROP_TABLES[biome], total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let choice = unit(kindRoll) * total;
  for (const entry of entries) {
    if (choice < entry.weight) return { biome, kind: entry.kind };
    choice -= entry.weight;
  }
  return { biome, kind: entries[entries.length - 1].kind };
}
