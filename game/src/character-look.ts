import { ACCESSORIES, DEFAULT_APPEARANCE, FACIAL_HAIR, HAIR_PALETTES, HAIR_STYLES, RACE_FEATURES, SKIN_PALETTES, type CharacterAppearance } from './appearance-content.ts';
import { ARMOR_PARTS, ARMOR_TINTS, type ArmorTints } from './appearance-armor-content.ts';
import { WOW_RACES } from './wow-races.ts';
import type { WowRaceId } from './wow-types.ts';
export interface CharacterLook { appearance:CharacterAppearance; armorTints:ArmorTints; showHelmet:boolean; }
export function createCharacterLook():CharacterLook {return {appearance:{...DEFAULT_APPEARANCE},armorTints:{},showHelmet:false};}
/** Fresh look seeded with the race's default skin/hair so a new hero reads as its race. */
export function createRaceLook(raceId: WowRaceId):CharacterLook {
  const look = createCharacterLook();
  const race = WOW_RACES[raceId];
  if (race?.skinTones.length) look.appearance.skin = race.skinTones[0];
  if (race?.visual.hairColor) look.appearance.hairColor = race.visual.hairColor;
  if (race?.visual.facialHair) look.appearance.facialHair = race.visual.facialHair as CharacterAppearance['facialHair'];
  if (race?.visual.feature) look.appearance.feature = race.visual.feature as CharacterAppearance['feature'];
  return look;
}
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
/** Only bounded catalog IDs cross command/save boundaries. Unknown keys are rejected. */
export function validCharacterLook(v:unknown):v is CharacterLook {
  if(!record(v)||Object.keys(v).length!==3||!record(v.appearance)||typeof v.showHelmet!=='boolean'||!record(v.armorTints))return false;
  const a=v.appearance,keyCount=Object.keys(a).length;
  if(keyCount<5||keyCount>6)return false;
  if(!Object.keys(a).every(key=>key==='skin'||key==='hairColor'||key==='hair'||key==='facialHair'||key==='accessory'||key==='feature'))return false;
  return SKIN_PALETTES.some(p=>p.id===a.skin)&&HAIR_PALETTES.some(p=>p.id===a.hairColor)&&HAIR_STYLES.some(p=>p.id===a.hair)
    &&FACIAL_HAIR.some(p=>p.id===a.facialHair)&&ACCESSORIES.some(p=>p.id===a.accessory)
    &&(a.feature===undefined||RACE_FEATURES.some(p=>p.id===a.feature))
    &&Object.entries(v.armorTints).every(([part,tint])=>ARMOR_PARTS.some(p=>p.id===part)&&ARMOR_TINTS.some(p=>p.id===tint));
}
