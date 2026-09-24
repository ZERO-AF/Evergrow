import { BIOME_IDS, type BiomeId, type BiomeWeights } from './biomes.ts';

export type WeatherKind = 'rain' | 'snow' | 'ash' | 'sand' | 'motes' | 'leaves' | 'embers' | 'seeds' | 'none';

/** Immutable per-biome precipitation recipe. Presentation only: no gameplay,
 * save or simulation meaning. Numeric fields blend across biome weights. */
export interface WeatherRecipe {
  readonly kind: WeatherKind;
  /** Palette for individual particles; the renderer assigns one per particle. */
  readonly colors: readonly string[];
  /** Downward speed in world units per second; negative values rise. */
  readonly fall: number;
  /** Sideways drift in world units per second, before biome wind. */
  readonly drift: number;
  /** Per-particle sine sway amplitude in world units. */
  readonly sway: number;
  /** Share of the fixed particle pool visible at full biome weight (0–1). */
  readonly density: number;
  /** Base particle size in world units. */
  readonly size: number;
  /** Peak particle alpha (0–1). */
  readonly alpha: number;
  /** Elongation along the fall direction for streaked kinds (rain/sand). */
  readonly streak: number;
}


export const WEATHER_RECIPES: Readonly<Record<BiomeId, WeatherRecipe>> = {
  frostpine: { kind: 'snow', colors: ['#f4f8ff', '#dbe8f2', '#ffffff'], fall: 46, drift: 14, sway: 26, density: .95, size: 2.4, alpha: .8, streak: 0 },
  emberfall: { kind: 'embers', colors: ['#e8a06a', '#f4c68c', '#b8a89a', '#8f8378'], fall: -16, drift: 22, sway: 30, density: .8, size: 1.6, alpha: .6, streak: 0 },
  swamp: { kind: 'rain', colors: ['#a9c4d4', '#8fb0c4'], fall: 480, drift: 30, sway: 0, density: .9, size: 1, alpha: .5, streak: 14 },
  verdant: { kind: 'rain', colors: ['#a9c4d4', '#bcd2de'], fall: 460, drift: 24, sway: 0, density: .7, size: 1, alpha: .45, streak: 12 },
  sunscar: { kind: 'sand', colors: ['#e6c896', '#d4b078', '#c9a06a'], fall: 12, drift: 150, sway: 18, density: .65, size: 1.4, alpha: .4, streak: 10 },
  deadwood: { kind: 'motes', colors: ['#c9d4c2', '#9fb4a8'], fall: 6, drift: 8, sway: 20, density: .34, size: 1.4, alpha: .5, streak: 0 },
  autumn: { kind: 'leaves', colors: ['#d6aa53', '#b8753e', '#dfbf68', '#9d5738'], fall: 26, drift: 18, sway: 34, density: .5, size: 2.2, alpha: .75, streak: 0 },
  highlands: { kind: 'motes', colors: ['#d4d0e0', '#b8bcd0'], fall: 8, drift: 30, sway: 22, density: .26, size: 1.3, alpha: .45, streak: 0 },
  steppe: { kind: 'seeds', colors: ['#e4d9a8', '#cfc48c'], fall: 9, drift: 55, sway: 30, density: .3, size: 1.3, alpha: .5, streak: 0 },
};
for (const recipe of Object.values(WEATHER_RECIPES)) {
  Object.freeze(recipe.colors); Object.freeze(recipe);
}
Object.freeze(WEATHER_RECIPES);

/** Blended weather for one position: the dominant contributing biome picks the
 * particle kind and palette, numeric fields are share-weighted averages, and
 * intensity is the total density-weighted biome share (0–1). */
export interface WeatherMix {
  readonly kind: WeatherKind;
  readonly colors: readonly string[];
  readonly fall: number;
  readonly drift: number;
  readonly sway: number;
  readonly size: number;
  readonly alpha: number;
  readonly streak: number;
  readonly intensity: number;
}

const NO_WEATHER: WeatherMix = Object.freeze({ kind: 'none', colors: [], fall: 0, drift: 0, sway: 0, size: 0, alpha: 0, streak: 0, intensity: 0 });

export function weatherMix(weights: BiomeWeights): WeatherMix {
  let intensity = 0, fall = 0, drift = 0, sway = 0, size = 0, alpha = 0, streak = 0;
  let dominant: BiomeId | null = null, dominantShare = 0;
  for (const id of BIOME_IDS) {
    const recipe = WEATHER_RECIPES[id], share = weights[id] * recipe.density;
    if (share <= 0) continue;
    intensity += share;
    fall += recipe.fall * share; drift += recipe.drift * share; sway += recipe.sway * share;
    size += recipe.size * share; alpha += recipe.alpha * share; streak += recipe.streak * share;
    if (share > dominantShare) { dominantShare = share; dominant = id; }
  }
  if (!dominant || intensity < .001) return NO_WEATHER;
  const recipe = WEATHER_RECIPES[dominant];
  return { kind: recipe.kind, colors: recipe.colors, fall: fall / intensity, drift: drift / intensity,
    sway: sway / intensity, size: size / intensity, alpha: alpha / intensity, streak: streak / intensity,
    intensity: Math.min(1, intensity) };
}
