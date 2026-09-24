import { BIOME_IDS, type BiomeId, type BiomeWeights } from './biomes.ts';
import type { PropKind } from './biome-props.ts';

export type ParticleKind = 'leaf' | 'dust' | 'snow' | 'ash' | 'seed' | 'droplet' | 'ember';
export type BirdKind = 'crow' | 'jay' | 'snowfinch' | 'wader' | 'moorbird' | 'hawk';
export type InsectKind = 'butterfly' | 'moth' | 'dragonfly' | 'firefly' | 'bee';
export type CritterKind = 'rabbit' | 'squirrel' | 'frog' | 'lizard' | 'beetle';
export interface BirdProfile { readonly kind: BirdKind; readonly perches: readonly PropKind[]; readonly soaring?: boolean; }
export interface InsectProfile { readonly kind: InsectKind; readonly color: string; readonly anchors: readonly PropKind[]; }
export interface CritterProfile { readonly kind: CritterKind; readonly color: string; readonly anchors: readonly PropKind[]; }
interface LifeProfile {
  readonly wind: number;
  readonly debris: ParticleKind;
  readonly colors: readonly string[];
  readonly grass: readonly [string, string];
  readonly grassHeight: number;
  readonly footColor: string;
  readonly light: string;
  readonly dapple: number;
  readonly emitters: readonly PropKind[];
  readonly ground: readonly PropKind[];
  readonly birds: readonly BirdProfile[];
  readonly insects: readonly InsectProfile[];
  readonly critters: readonly CritterProfile[];
  /** Surface-water fish: silhouettes and rings under the water pass. */
  readonly fish: boolean;
}
export const BIOME_LIFE: Readonly<Record<BiomeId, LifeProfile>> = {
  steppe: { wind: 1.7, debris: 'seed', colors: ['#ddd29c','#bcb77e'], grass: ['#89904e','#c8bd79'], grassHeight: 1.2,
    footColor: '#615334', light: '#e9dba0', dapple: .1, emitters: ['dryGrass','thornBrush'], ground: ['dryGrass','thornBrush'],
    birds: [{ kind: 'hawk', perches: ['steppeStone','thornBrush'], soaring: true }, { kind: 'moorbird', perches: ['steppeStone','thornBrush'] }],
    insects: [{ kind: 'butterfly', color: '#d9c896', anchors: ['flowers','dryGrass'] }, { kind: 'bee', color: '#d8b45e', anchors: ['flowers'] }],
    critters: [{ kind: 'rabbit', color: '#a08d6a', anchors: ['dryGrass','thornBrush','steppeStone'] }], fish: false },
  sunscar: { wind: 1.25, debris: 'dust', colors: ['#e1c69a','#b89971'], grass: ['#a58a58','#c9b57c'], grassHeight: .25,
    footColor: '#92734e', light: '#ffe0ad', dapple: 0, emitters: ['desertScrub','sandstone'], ground: ['desertScrub'],
    birds: [{ kind: 'hawk', perches: ['sandstone','sandstoneShard'], soaring: true }],
    insects: [],
    critters: [{ kind: 'lizard', color: '#c2a06e', anchors: ['sandstone','sandstoneShard','desertScrub'] }], fish: false },
  deadwood: { wind: .8, debris: 'dust', colors: ['#9a9078', '#777f79', '#a9a593'], grass: ['#53645a', '#929782'], grassHeight: .65,
    footColor: '#142727', light: '#a9c3c7', dapple: .12, emitters: ['deadTree', 'tussock', 'stump'], ground: ['deadTree', 'tussock', 'stump', 'mushrooms'],
    birds: [{ kind: 'crow', perches: ['stump', 'rock', 'deadTree'] }],
    insects: [{ kind: 'moth', color: '#bcbda9', anchors: ['mushrooms', 'stump'] }, { kind: 'firefly', color: '#cfe0a0', anchors: ['mushrooms', 'tussock'] }],
    critters: [{ kind: 'beetle', color: '#4a4640', anchors: ['stump', 'mushrooms', 'deadTree'] }], fish: false },
  verdant: { wind: 1, debris: 'leaf', colors: ['#aa9b58', '#7e9952', '#bbaf6a', '#688447'], grass: ['#577849', '#769354'], grassHeight: 1,
    footColor: '#0b1b14', light: '#dece87', dapple: 1, emitters: ['tree', 'canopy'], ground: ['tree', 'canopy', 'fern', 'flowers', 'stump'],
    birds: [{ kind: 'crow', perches: ['stump', 'rock', 'deadTree'] }, { kind: 'jay', perches: ['tree', 'canopy', 'stump'] }],
    insects: [{ kind: 'butterfly', color: '#d6c586', anchors: ['flowers', 'fern'] }, { kind: 'bee', color: '#d8b45e', anchors: ['flowers'] }],
    critters: [{ kind: 'rabbit', color: '#8d7c62', anchors: ['fern', 'flowers', 'stump'] }, { kind: 'squirrel', color: '#9a6b45', anchors: ['tree', 'canopy', 'stump'] }],
    fish: true },
  swamp: { wind: .72, debris: 'leaf', colors: ['#698d74', '#839c79', '#9eae83'], grass: ['#496e64', '#8aaf93'], grassHeight: 1.3,
    footColor: '#123036', light: '#b1d3b0', dapple: .35, emitters: ['willow', 'reeds'], ground: ['willow', 'reeds', 'fern'],
    birds: [{ kind: 'wader', perches: ['rock', 'stump', 'lilies'] }],
    insects: [{ kind: 'dragonfly', color: '#a2d7d1', anchors: ['lilies', 'reeds'] }, { kind: 'firefly', color: '#b8d98a', anchors: ['reeds', 'willow'] }],
    critters: [{ kind: 'frog', color: '#5f7d4e', anchors: ['lilies', 'reeds', 'tussock'] }], fish: true },
  frostpine: { wind: .9, debris: 'snow', colors: ['#dce7e7', '#accedb', '#f2eee0'], grass: ['#819fa6', '#c4d3d0'], grassHeight: .4,
    footColor: '#384f64', light: '#bfd9eb', dapple: .52, emitters: ['snowPine', 'iceCrystal'], ground: ['snowPine', 'iceCrystal', 'tussock'],
    birds: [{ kind: 'snowfinch', perches: ['rock', 'iceCrystal', 'stump'] }],
    insects: [],
    critters: [{ kind: 'rabbit', color: '#cfd6d2', anchors: ['tussock', 'snowPine'] }], fish: true },
  emberfall: { wind: 1.12, debris: 'ash', colors: ['#a6968a', '#7f7774', '#bcaa94'], grass: ['#66564f', '#96806b'], grassHeight: 0,
    footColor: '#272429', light: '#e4a56e', dapple: 0, emitters: ['charredTree', 'basalt', 'emberRock'], ground: ['charredTree', 'basalt', 'emberRock'],
    birds: [{ kind: 'crow', perches: ['charredTree', 'basalt', 'stump'] }],
    insects: [{ kind: 'moth', color: '#b09d8d', anchors: ['charredTree', 'stump'] }],
    critters: [{ kind: 'lizard', color: '#8a6f5c', anchors: ['basalt', 'emberRock', 'charredTree'] }], fish: false },
  autumn: { wind: 1.1, debris: 'leaf', colors: ['#d6aa53', '#b8753e', '#dfbf68', '#9d5738'], grass: ['#827846', '#bea764'], grassHeight: .8,
    footColor: '#3e3021', light: '#ecc079', dapple: .85, emitters: ['autumnTree', 'leafPile'], ground: ['autumnTree', 'leafPile', 'flowers', 'stump'],
    birds: [{ kind: 'jay', perches: ['stump', 'rock', 'deadTree', 'autumnTree'] }],
    insects: [{ kind: 'butterfly', color: '#e5b65f', anchors: ['flowers', 'leafPile'] }, { kind: 'bee', color: '#d8b45e', anchors: ['flowers'] }],
    critters: [{ kind: 'squirrel', color: '#a5713f', anchors: ['autumnTree', 'leafPile', 'stump'] }, { kind: 'rabbit', color: '#8d7c62', anchors: ['fern', 'leafPile'] }],
    fish: true },
  highlands: { wind: 1.55, debris: 'seed', colors: ['#c7bc9b', '#b0a7c0', '#e1d7b6'], grass: ['#65715a', '#a8ad85'], grassHeight: 1.15,
    footColor: '#32353c', light: '#c9c2d7', dapple: .3, emitters: ['windTree', 'heather', 'tussock'], ground: ['windTree', 'heather', 'tussock', 'limestone'],
    birds: [{ kind: 'moorbird', perches: ['limestone', 'rock', 'windTree'] }, { kind: 'hawk', perches: ['limestone', 'windTree'], soaring: true }],
    insects: [{ kind: 'moth', color: '#b8adc9', anchors: ['heather'] }, { kind: 'bee', color: '#cbb26a', anchors: ['heather'] }],
    critters: [{ kind: 'rabbit', color: '#9a917c', anchors: ['heather', 'tussock', 'limestone'] }], fish: true },
};
for (const profile of Object.values(BIOME_LIFE)) {
  for (const value of Object.values(profile)) if (Array.isArray(value)) Object.freeze(value);
  for (const entry of [...profile.birds, ...profile.insects, ...profile.critters]) {
    for (const value of Object.values(entry)) if (Array.isArray(value)) Object.freeze(value);
    Object.freeze(entry);
  }
  Object.freeze(profile);
}
Object.freeze(BIOME_LIFE);

/** Choose individual pieces of debris from the same blended field as terrain. */
export function biomeForDebris(weights: BiomeWeights, random: number): BiomeId {
  let cumulative = 0;
  for (const id of BIOME_IDS) { cumulative += weights[id]; if (random < cumulative) return id; }
  return 'highlands';
}
