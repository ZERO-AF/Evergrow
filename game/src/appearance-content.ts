import type { WowRaceId } from './wow-types.ts';

/** Presentation recipes for the character-editor study. Not part of saved sheets yet. */
export interface AppearancePalette { readonly id: string; readonly name: string; readonly base: string; readonly shadow: string; readonly light: string; }
export const SKIN_PALETTES: readonly AppearancePalette[] = [
  { id: 'porcelain', name: 'Porcelain', base: '#ecd0b5', shadow: '#b08c7c', light: '#ffe6c9' },
  { id: 'sand', name: 'Sand', base: '#d7b08a', shadow: '#94705a', light: '#f1d1a5' },
  { id: 'warm', name: 'Warm', base: '#b89a7d', shadow: '#755f51', light: '#e0c39c' },
  { id: 'olive', name: 'Olive', base: '#b19868', shadow: '#74664b', light: '#d8bd8b' },
  { id: 'copper', name: 'Copper', base: '#ac7552', shadow: '#724a3d', light: '#d59d72' },
  { id: 'umber', name: 'Umber', base: '#87593f', shadow: '#503b32', light: '#b27d58' },
  { id: 'mahogany', name: 'Mahogany', base: '#684638', shadow: '#392c29', light: '#986950' },
  { id: 'ebony', name: 'Ebony', base: '#49372f', shadow: '#292426', light: '#79594a' },
  { id: 'rose', name: 'Rose', base: '#d5a497', shadow: '#956a69', light: '#f2cbba' },
  { id: 'honey', name: 'Honey', base: '#c29660', shadow: '#815b3f', light: '#e4bc85' },
  { id: 'bronze', name: 'Bronze', base: '#936347', shadow: '#604133', light: '#c28e65' },
  { id: 'ashen', name: 'Ashen', base: '#a5a59b', shadow: '#666f6c', light: '#d2d3bd' },
  { id: 'moonblue', name: 'Moon blue', base: '#8faab8', shadow: '#526978', light: '#c3d8dd' },
  { id: 'moss', name: 'Moss', base: '#91a183', shadow: '#586b53', light: '#c4ce9d' },
  { id: 'lavender', name: 'Lavender', base: '#ad92b2', shadow: '#715a7e', light: '#d9bddc' },
  { id: 'duskwine', name: 'Dusk wine', base: '#855b69', shadow: '#523b4c', light: '#b68692' },
  { id: 'fel', name: 'Fel green', base: '#7ba05b', shadow: '#4a6b3f', light: '#a8c47e' },
  { id: 'swamp', name: 'Swamp', base: '#5d7a4a', shadow: '#3a5233', light: '#8aa468' },
  { id: 'cerulean', name: 'Cerulean', base: '#5f87a8', shadow: '#3d5a74', light: '#8fb4cc' },
  { id: 'deepsea', name: 'Deep sea', base: '#4a6b8a', shadow: '#2e4459', light: '#7499b4' },
  { id: 'pelt', name: 'Pelt', base: '#8a6a4e', shadow: '#54402e', light: '#b39272' },
  { id: 'stonepelt', name: 'Stone pelt', base: '#6e6258', shadow: '#453d36', light: '#9a8d80' },
  { id: 'grave', name: 'Grave', base: '#9aa08b', shadow: '#5f665a', light: '#c6c9ae' },
  { id: 'pale', name: 'Pale', base: '#c9c4b2', shadow: '#8a8577', light: '#e8e3cf' },
  { id: 'azure', name: 'Azure', base: '#6f8fc4', shadow: '#46598a', light: '#a4bce0' },
  { id: 'indigohide', name: 'Indigo hide', base: '#5a6aa8', shadow: '#39427a', light: '#8b9bd0' },
  { id: 'violet', name: 'Violet', base: '#9a86c0', shadow: '#5f4d85', light: '#c4b2de' },
];
export const HAIR_PALETTES: readonly AppearancePalette[] = [
  { id: 'chestnut', name: 'Chestnut', base: '#4c3b32', shadow: '#282527', light: '#8f7457' },
  { id: 'raven', name: 'Raven', base: '#252c32', shadow: '#151c23', light: '#54616b' },
  { id: 'walnut', name: 'Walnut', base: '#6d4830', shadow: '#342a26', light: '#a77950' },
  { id: 'copper', name: 'Copper', base: '#ad5e37', shadow: '#66382c', light: '#e1a363' },
  { id: 'golden', name: 'Golden', base: '#bea269', shadow: '#796344', light: '#edcf89' },
  { id: 'silver', name: 'Silver', base: '#a6b4b3', shadow: '#637677', light: '#e2e1cb' },
  { id: 'wine', name: 'Wine', base: '#743e51', shadow: '#3d2939', light: '#b47688' },
  { id: 'sage', name: 'Sage', base: '#697e68', shadow: '#344c45', light: '#a5b68a' },
  { id: 'espresso', name: 'Espresso', base: '#382c29', shadow: '#1d2022', light: '#72564a' },
  { id: 'auburn', name: 'Auburn', base: '#71382a', shadow: '#3b2625', light: '#b07348' },
  { id: 'flax', name: 'Flax', base: '#d1bf91', shadow: '#8e7c5d', light: '#f4e6bf' },
  { id: 'snow', name: 'Snow', base: '#d6d9d4', shadow: '#8d9ca2', light: '#f5eee0' },
  { id: 'teal', name: 'Teal', base: '#3f8584', shadow: '#24474d', light: '#8ec4b8' },
  { id: 'indigo', name: 'Indigo', base: '#505788', shadow: '#2b3057', light: '#9b9fc6' },
  { id: 'lilac', name: 'Lilac', base: '#9e80b4', shadow: '#594567', light: '#d1b5df' },
  { id: 'blush', name: 'Blush', base: '#bd808b', shadow: '#6e4757', light: '#edb7b9' },
];
export const HAIR_STYLES = [
  { id: 'swept', name: 'Windswept' }, { id: 'crop', name: 'Cropped' },
  { id: 'bob', name: 'Bob' }, { id: 'long', name: 'Long' },
  { id: 'braid', name: 'Braid' }, { id: 'bun', name: 'High bun' },
  { id: 'curls', name: 'Curls' }, { id: 'bald', name: 'Shaved' },
  { id: 'pixie', name: 'Pixie' }, { id: 'sidepart', name: 'Side part' },
  { id: 'undercut', name: 'Undercut' }, { id: 'quiff', name: 'Quiff' },
  { id: 'fringe', name: 'Fringe' }, { id: 'mohawk', name: 'Mohawk' },
  { id: 'waves', name: 'Waves' }, { id: 'afro', name: 'Coils' },
  { id: 'ponytail', name: 'Ponytail' }, { id: 'twinbraids', name: 'Twin braids' },
  { id: 'lowbun', name: 'Low bun' }, { id: 'doublebun', name: 'Twin buns' },
  { id: 'locs', name: 'Locs' }, { id: 'halfup', name: 'Half-up' },
  { id: 'topknot', name: 'Topknot' }, { id: 'longside', name: 'Side sweep' },
] as const;
export const FACIAL_HAIR = [
  { id: 'none', name: 'None' }, { id: 'stubble', name: 'Stubble' },
  { id: 'moustache', name: 'Moustache' }, { id: 'beard', name: 'Short beard' },
  { id: 'goatee', name: 'Goatee' }, { id: 'fullbeard', name: 'Full beard' },
  { id: 'handlebar', name: 'Handlebar' }, { id: 'chinbraid', name: 'Braided beard' },
] as const;
export const ACCESSORIES = [
  { id: 'none', name: 'None' }, { id: 'hoop', name: 'Gold hoop' },
  { id: 'circlet', name: 'Moon circlet' }, { id: 'eyepatch', name: 'Eyepatch' },
  { id: 'spectacles', name: 'Spectacles' }, { id: 'studs', name: 'Silver studs' },
  { id: 'earcuff', name: 'Ear cuff' }, { id: 'nosering', name: 'Nose ring' },
] as const;
export interface CharacterAppearance {
  skin: string; hairColor: string;
  hair: typeof HAIR_STYLES[number]['id'];
  facialHair: typeof FACIAL_HAIR[number]['id'];
  accessory: typeof ACCESSORIES[number]['id'];
  /** Race signature option (horn style, tusk size, markings…); absent on humans. */
  feature?: RaceFeatureId;
}
export const DEFAULT_APPEARANCE: Readonly<CharacterAppearance> = Object.freeze({
  skin: 'warm', hairColor: 'chestnut', hair: 'swept', facialHair: 'none', accessory: 'none',
});
/** Race-specific feature choices; ids are stable save data, names face the editor. */
export const RACE_FEATURES = [
  { id: 'horns-curved', name: 'Curved horns' }, { id: 'horns-swept', name: 'Swept horns' },
  { id: 'horns-grand', name: 'Grand horns' }, { id: 'crest', name: 'Crest' },
  { id: 'horns-back', name: 'Swept-back horns' }, { id: 'tusks-small', name: 'Small tusks' },
  { id: 'tusks-large', name: 'Large tusks' }, { id: 'tusks-long', name: 'Long tusks' },
  { id: 'tusks-upcurved', name: 'Upcurved tusks' }, { id: 'markings', name: 'Face markings' },
  { id: 'markings-none', name: 'No markings' }, { id: 'tendrils', name: 'Tendrils' },
  { id: 'tendrils-none', name: 'No tendrils' }, { id: 'bone-bare', name: 'Exposed bone' },
  { id: 'bone-covered', name: 'Covered bone' }, { id: 'beard-ringed', name: 'Ringed beard' },
] as const;
export type RaceFeatureId = typeof RACE_FEATURES[number]['id'];
/** Feature ids a race actually offers; the first entry is the creation default. */
export const RACE_FEATURE_OPTIONS: Readonly<Partial<Record<WowRaceId, readonly RaceFeatureId[]>>> = Object.freeze({
  dwarf: ['beard-ringed'],
  nightElf: ['markings', 'markings-none'],
  draenei: ['crest', 'horns-back', 'tendrils'],
  orc: ['tusks-small', 'tusks-large'],
  undead: ['bone-bare', 'bone-covered'],
  tauren: ['horns-curved', 'horns-swept', 'horns-grand'],
  troll: ['tusks-long', 'tusks-upcurved', 'tusks-small'],
});
export function appearancePalette(catalog: readonly AppearancePalette[], id: string): AppearancePalette {
  return catalog.find(palette => palette.id === id) ?? catalog[0];
}
