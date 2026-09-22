import { appearancePalette, HAIR_PALETTES, RACE_FEATURE_OPTIONS, SKIN_PALETTES, type CharacterAppearance, type RaceFeatureId } from './appearance-content.ts';
import { mixColor, type Point } from './art-primitives.ts';
import type { GearShape } from './weapon-shapes.ts';
import { hairShapes } from './appearance-hair-shapes.ts';
import { facialHairShapes, faceAccessoryShapes } from './appearance-face-details.ts';
import { WOW_RACES } from './wow-races.ts';
import type { AppearancePalette } from './appearance-content.ts';
import type { WowRaceId } from './wow-types.ts';
import { isHeadProfile } from './character-facing.ts';
import { appearanceProfileShapes } from './appearance-profile-shapes.ts';

const fill = (points: readonly Point[], color: string): GearShape => ({ points, fill: color });
const line = (points: readonly Point[], color: string, width = .6): GearShape => ({ points, stroke: color, width });

/** All shapes are local to the existing head mount. Body proportions never change. */
export function appearanceHeadShapes(appearance: Readonly<CharacterAppearance>, facing: number, covered: boolean, raceId?: WowRaceId): GearShape[] {
  if (isHeadProfile(facing)) return appearanceProfileShapes(appearance, facing, covered, raceId);
  const skin = appearancePalette(SKIN_PALETTES, appearance.skin);
  const hair = appearancePalette(HAIR_PALETTES, appearance.hairColor);
  const v = raceId ? WOW_RACES[raceId]?.visual : undefined;
  const feat = appearance.feature ?? (raceId ? RACE_FEATURE_OPTIONS[raceId]?.[0] : undefined);
  const back = Math.sin(facing) < -.16, side = Math.cos(facing), look = Math.abs(side) * .8;
  const shapes: GearShape[] = [];
  const shape = (points: readonly Point[], color: string) => shapes.push(fill(points, color));
  const stroke = (points: readonly Point[], color: string, width = .6) => shapes.push(line(points, color, width));
  const hairLayers = covered ? {rear:[],front:[]} : hairShapes(appearance.hair,hair,facing);
  shapes.push(...hairLayers.rear);
  const mirror = side < 0;
  const mx = (x:number)=>mirror?-x:x;
  shape([[-4.2, -.8], [-3.2, -3.9], [.6, -4.8], [3.7, -2.7], [4.2, .6], [2.7, 4.1], [.7, 5.3], [-2, 4.6], [-3.9, 1.8]].map(([x,y])=>[mx(x),y]), back ? skin.shadow : '#403b39');
  if (!back) {
    shape([[-3 + look, -1.4], [.2 + look, -2.6], [2.7 + look, -1.3], [3 + look, 2.4], [1.1 + look, 4.7], [-1.1 + look, 4.4], [-2.6 + look, 2.6]].map(([x,y])=>[mx(x),y]), skin.base);
    shape([[-3 + look, -1.4], [-1.1 + look, -.7], [-.7 + look, 3.8], [-1.1 + look, 4.4], [-2.6 + look, 2.6]].map(([x,y])=>[mx(x),y]), skin.shadow);
    // A wide orc jaw bulks out the lower face before nose and mouth sit on it.
    if (v?.jaw === 'wide') {
      shape([[-3.2 + look, 2.4], [3.2 + look, 2.4], [3.4 + look, 4.6], [1.7 + look, 6.2], [-1.7 + look, 6.2], [-3.4 + look, 4.6]].map(([x,y])=>[mx(x),y]), skin.base);
      shape([[-3.4 + look, 4.6], [-1.7 + look, 6.2], [1.7 + look, 6.2], [3.4 + look, 4.6], [2.1 + look, 5.1], [0 + look, 5.5], [-2.1 + look, 5.1]].map(([x,y])=>[mx(x),y]), skin.shadow);
    }
    // The nose is the race's profile: bovine muzzle, dwarf breadth, troll hook.
    if (v?.muzzle) {
      shape([[-2.5 + look * 1.3, 1.7], [2.5 + look * 1.3, 1.7], [3.2 + look * 1.7, 3.9], [2 + look * 1.7, 6.5], [-2 + look * 1.7, 6.5], [-3.2 + look * 1.7, 3.9]].map(([x,y])=>[mx(x),y]), skin.base);
      shape([[-3.2 + look * 1.7, 3.9], [-2 + look * 1.7, 6.5], [-1 + look * 1.7, 6.5], [-2.3 + look * 1.7, 3.7]].map(([x,y])=>[mx(x),y]), skin.shadow);
      shape([[2.3 + look * 1.7, 3.7], [3.2 + look * 1.7, 3.9], [2 + look * 1.7, 6.5], [1 + look * 1.7, 6.5]].map(([x,y])=>[mx(x),y]), mixColor(skin.base, skin.light, .5));
      shape([[-1.8 + look * 1.8, 4.5], [1.8 + look * 1.8, 4.5], [2.2 + look * 1.8, 6], [look * 1.8, 7], [-2.2 + look * 1.8, 6]].map(([x,y])=>[mx(x),y]), '#413028');
      for (const n of [-1, 1]) shape([[mx(n * .9 + look * 1.8 - .4), 5.4], [mx(n * .9 + look * 1.8 + .4), 5.4], [mx(n * .9 + look * 1.8 + .3), 6], [mx(n * .9 + look * 1.8 - .3), 6]], '#1d1512');
      stroke([[mx(look * 1.3), .6], [mx(look * 1.5), 4.1]], skin.shadow, .5);
      stroke([[mx(-1.2 + look * 1.8), 6.6], [mx(look * 1.8), 6.9], [mx(1.2 + look * 1.8), 6.6]], '#241a16', .6);
      // A chin tuft of beard fur rounds out the bovine jaw.
      shape([[mx(-1 + look * 1.6), 6.7], [mx(1 + look * 1.6), 6.7], [mx(.5 + look * 1.6), 8.7], [mx(-.5 + look * 1.6), 8.5]], hair.base);
    } else if (v?.nose === 'broad') {
      shape([[-.5 + look, .9], [1.5 + look, 1.9], [1.4 + look, 3.1], [.2 + look, 3.5], [-.9 + look, 3.1], [-1 + look, 1.8]].map(([x,y])=>[mx(x),y]), skin.light);
    } else if (v?.nose === 'hooked') {
      shape([[.1 + look, .6], [1.6 + look, 2.1], [1.3 + look, 3.7], [.4 + look, 4.1], [-.3 + look, 3.4], [-.1 + look, 2.1]].map(([x,y])=>[mx(x),y]), skin.light);
      stroke([[mx(1.3 + look), 3.7], [mx(.4 + look), 4.1]], skin.shadow, .4);
    } else {
      shape([[.2 + look, 1.1], [1 + look, 2.2], [.4 + look, 2.7], [-.1 + look, 2.1]].map(([x,y])=>[mx(x),y]), skin.light);
    }
    // Eyes: glowing races replace the dark lash line with a lit iris and halo.
    const eyeScale = v?.eyeScale ?? 1;
    for (const eye of [-1, 1]) {
      const width = (.9 - Math.max(0, Math.abs(side) * eye) * .35) * eyeScale;
      const ex = mx(eye * 1.6 + look);
      if (v?.eyeGlow && !v.decay) {
        shape(mirror?[[ex + width * .6, 1.9], [ex - width * .6, 1.9], [ex - width * .8, .7], [ex + width * .8, .7]]:[[ex - width * .8, .7], [ex + width * .8, .7], [ex + width * .6, 1.9], [ex - width * .6, 1.9]], `${v.eyeGlow}44`);
        shape(mirror?[[ex + width * .4, 1.65], [ex - width * .4, 1.65], [ex - width * .55, 1], [ex + width * .55, 1]]:[[ex - width * .55, 1], [ex + width * .55, 1], [ex + width * .4, 1.65], [ex - width * .4, 1.65]], v.eyeGlow);
        stroke(mirror?[[ex + width / 2, .95], [ex - width / 2, .95]]:[[ex - width / 2, .95], [ex + width / 2, .95]], mixColor(v.eyeGlow, '#ffffff', .5), .5);
      } else if (eyeScale > 1) {
        shape(mirror?[[ex + width / 2 + .15, .85], [ex - width / 2 - .15, .85], [ex - width / 2, 1.9], [ex + width / 2, 1.9]]:[[ex - width / 2 - .15, .85], [ex + width * .15, .85], [ex + width / 2, 1.9], [ex - width / 2, 1.9]], '#263239');
        shape(mirror?[[ex + width * .2, 1.05], [ex - width * .05, .95], [ex - width * .12, 1.2], [ex + width * .13, 1.3]]:[[ex - width * .2, 1.05], [ex + width * .05, .95], [ex + width * .12, 1.2], [ex - width * .13, 1.3]], '#dfe8ea');
      } else {
        stroke(mirror?[[ex + width / 2, 1.25], [ex - width / 2, 1.25]]:[[ex - width / 2, 1.25], [ex + width / 2, 1.25]], '#263239', .65);
      }
    }
    if (v?.jaw === 'bone' && feat !== 'bone-covered') {
      // Forsaken bone-bare option: the jaw is exposed bone with teeth lines.
      shape([[-2.3 + look, 3.5], [2.3 + look, 3.5], [2 + look, 5.6], [look, 6.2], [-2 + look, 5.6]].map(([x,y])=>[mx(x),y]), '#cfc9b0');
      for (const t of [-1.4, -.7, 0, .7, 1.4]) stroke([[mx(t + look), 3.9], [mx(t + look), 5.2]], '#8a8471', .4);
      stroke([[mx(-2.1 + look), 4.5], [mx(2.1 + look), 4.5]], '#8a8471', .45);
    } else if (!v?.muzzle) {
      stroke([[mx(-.8 + look), 3.1], [mx(.9 + look), 3.3]], mixColor(skin.shadow, '#553c3e', .3), v?.jaw === 'wide' ? .8 : .55);
      stroke([[mx(-.5 + look), 4.2], [mx(.8 + look), 4.3]], skin.light, .45);
    }
    shapes.push(...facialHairShapes(appearance.facialHair,hair,skin,look));
  } else {
    shape([[-2.8, -3.4], [.5, -4], [3, -2.5], [3.3, .8], [1.8, 4], [-.7, 4.4], [-2.7, 2.5]].map(([x,y])=>[mx(x),y]), skin.base);
  }
  const underHair = ['eyepatch','spectacles','nosering'].includes(appearance.accessory);
  if(underHair) shapes.push(...faceAccessoryShapes(appearance.accessory,facing,covered));
  shapes.push(...hairLayers.front);
  if(!underHair) shapes.push(...faceAccessoryShapes(appearance.accessory,facing,covered));
  if (raceId) shapes.push(...raceFeatureShapes(raceId, appearance, facing, skin, covered, feat));
  // Gnomes scale the whole head up around the neck mount.
  const headScale = v?.headScale ?? 1;
  if (headScale !== 1) for (const s of shapes) {
    s.points = s.points.map(([x, y]): Point => [x * headScale, .6 + (y - .6) * headScale]);
    if (s.width !== undefined) s.width *= headScale;
  }
  return shapes;
}

/** Race silhouette on the head: ears, tusks, horns, markings, undead hollows.
 * `overlayOnly` keeps just the protruding features that must draw over helmets. */
function raceFeatureShapes(raceId: WowRaceId, appearance: Readonly<CharacterAppearance>, facing: number, skin: AppearancePalette, covered: boolean, feat?: RaceFeatureId, overlayOnly = false): GearShape[] {
  const v = WOW_RACES[raceId]?.visual;
  if (!v) return [];
  const back = Math.sin(facing) < -.16, side = Math.cos(facing), look = side * .8;
  const shapes: GearShape[] = [];
  const shape = (points: readonly Point[], color: string) => shapes.push(fill(points, color));
  const stroke = (points: readonly Point[], color: string, width = .6) => shapes.push(line(points, color, width));
  // Ears sit behind the jaw; troll ears droop outward, bovine ears lie flat.
  if (v.ears && (overlayOnly || !covered)) {
    for (const e of [-1, 1]) {
      if (v.ears === 'bovine') {
        const ex = e * 3.6, ey = 1.6;
        shape([[ex - e * .3, ey - .9], [ex + e * 4.4, ey - 1.4], [ex + e * 4.8, ey + .2], [ex + e * .6, ey + 1.1]], skin.shadow);
        shape([[ex + e * .4, ey - .4], [ex + e * 3.6, ey - .8], [ex + e * 3.9, ey], [ex + e * .7, ey + .5]], skin.base);
      } else if (v.ears === 'long') {
        const ex = e * (3.4 + Math.abs(look) * .3), ey = .4;
        shape([[ex, ey + 1.6], [ex + e * 4.9, ey + 2.8], [ex + e * .6, ey - .8]], skin.shadow);
        shape([[ex + e * .3, ey + 1.2], [ex + e * 3.9, ey + 2.2], [ex + e * .5, ey - .3]], skin.base);
      } else {
        const ex = e * (3.4 + Math.abs(look) * .3), ey = .4;
        shape([[ex, ey + 1.7], [ex + e * 4, ey - 2.3], [ex + e * .5, ey - .9]], skin.shadow);
        shape([[ex + e * .3, ey + 1.2], [ex + e * 3.2, ey - 1.8], [ex + e * .4, ey - .4]], skin.base);
      }
    }
  }
  // Horns/crest above the brow; the feature pick chooses the variant.
  if (v.horns && (overlayOnly || !covered)) {
    const horn = '#e8dcc0', hornShade = '#a8946e';
    if (v.horns === 'tauren') {
      for (const e of [-1, 1]) {
        if (feat === 'horns-swept') {
          shape([[e * 2.6, -3.6], [e * 6.2, -3.4], [e * 7.4, -2], [e * 5, -1.4], [e * 3, -2.4]], hornShade);
          shape([[e * 3, -3.4], [e * 6, -3.1], [e * 6.7, -2.2], [e * 4.8, -1.8]], horn);
        } else if (feat === 'horns-grand') {
          shape([[e * 2.4, -3.4], [e * 5.4, -5.8], [e * 7.6, -4.4], [e * 5.4, -1.8], [e * 2.9, -2.2]], hornShade);
          shape([[e * 3, -3.6], [e * 5.5, -5.3], [e * 6.8, -4.2], [e * 5, -2.3]], horn);
        } else {
          shape([[e * 2.6, -3.2], [e * 5.2, -4.6], [e * 6.4, -3.4], [e * 4.6, -2.2], [e * 3, -2.4]], hornShade);
          shape([[e * 3, -3.4], [e * 5.4, -4.4], [e * 5.8, -3.6], [e * 4.4, -2.6]], horn);
        }
      }
    } else if (feat === 'crest') {
      // Male draenei: a ridged forehead crest plate instead of horn pairs.
      shape([[-1.6 + look, -4.4], [.1 + look, -7.4], [2 + look, -4.6], [1.3 + look, -3.4], [-.9 + look, -3.4]], hornShade);
      shape([[-1 + look, -4.5], [.1 + look, -6.6], [1.3 + look, -4.6], [.9 + look, -3.7], [-.6 + look, -3.7]], horn);
      stroke([[-.5 + look, -4.2], [.1 + look, -5.9], [.8 + look, -4.3]], hornShade, .5);
    } else if (feat === 'tendrils') {
      // Tendril-only look: no horn volume.
    } else {
      for (const e of [-1, 1]) {
        shape([[e * 1.4, -4], [e * 3.8, -5.6], [e * 4.6, -4.8], [e * 2.6, -3.2]], hornShade);
        shape([[e * 1.7, -4.1], [e * 3.7, -5.3], [e * 4.1, -4.8], [e * 2.5, -3.5]], horn);
      }
    }
  }
  // Tusks flank the mouth on the front face only; orcs are short, trolls long.
  if (v.tusks && !back && (overlayOnly || !covered)) {
    const ivory = '#f0e6cc', ivoryShade = '#c9b892';
    for (const e of [-1, 1]) {
      if (v.tusks === 'long') {
        const tipY = feat === 'tusks-small' ? 2.4 : feat === 'tusks-upcurved' ? .6 : 1.1;
        const tipX = feat === 'tusks-upcurved' ? 3.1 : 2.4;
        shape([[e * 1.5 + look, 4.7], [e * tipX + look, tipY], [e * (tipX + .6) + look, tipY + 1.2], [e * 2.1 + look, 5.1]], ivory);
        stroke([[e * 1.8 + look, 4.6], [e * (tipX + .2) + look, tipY + .8]], ivoryShade, .4);
      } else {
        const big = feat === 'tusks-large';
        const w = big ? 1.15 : .8, top = big ? 2.4 : 3;
        shape([[e * 1.8 + look, 4.4], [e * (2.2 + w) + look, top], [e * (2.2 + w * .6) + look, 4.9]], ivory);
        stroke([[e * 2 + look, 4.3], [e * (2.2 + w * .7) + look, top + .7]], ivoryShade, .4);
      }
    }
  }
  // Undead: sunken dark eye hollows with a lit ember inside, bone brow, stitches.
  if (v.decay && !back && !overlayOnly) {
    for (const e of [-1, 1]) {
      shape([[e * 1.6 + look - .9, .6], [e * 1.6 + look + .9, .6], [e * 1.6 + look + .7, 1.9], [e * 1.6 + look - .7, 1.9]], '#2a2226');
      if (v.eyeGlow) shape([[e * 1.6 + look - .42, 1], [e * 1.6 + look + .42, 1], [e * 1.6 + look + .32, 1.7], [e * 1.6 + look - .32, 1.7]], v.eyeGlow);
    }
    stroke([[-1.6 + look, .2], [1.6 + look, .2]], skin.light, .5);
    stroke([[-2.4 + look, -1.1], [-1.2 + look, -.7], [look, -1], [1.2 + look, -.6], [2.4 + look, -1]], mixColor(skin.shadow, '#3a3236', .5), .45);
  }
  // Night elf markings: dark violet stripes under the eyes and a forehead V.
  if (v.markings && feat === 'markings' && !back && !overlayOnly) {
    const mark = mixColor(skin.shadow, '#4a2a6a', .55);
    for (const e of [-1, 1]) {
      stroke([[e * 1.1 + look, 2.2], [e * 1.4 + look, 3.6]], mark, .55);
      stroke([[e * 2 + look, 2.1], [e * 2.3 + look, 3.3]], mark, .55);
    }
    stroke([[-.6 + look, -1.6], [look, -.9], [.6 + look, -1.6]], mark, .5);
  }
  // Draenei tendrils hang beside the jaw.
  if (v.tendrils && !back && (overlayOnly || !covered)) {
    for (const e of [-1, 1]) {
      shape([[e * 2.1 + look, 4.3], [e * 2.6 + look, 4.6], [e * 2.4 + look, 7.2], [e * 1.9 + look, 7.8], [e * 1.7 + look, 6]], skin.base);
      stroke([[e * 2.2 + look, 5], [e * 2.15 + look, 7]], skin.light, .4);
    }
  }
  // Dwarf rings clasp the beard when one is grown.
  if (feat === 'beard-ringed' && !back && !overlayOnly && appearance.facialHair !== 'none' && appearance.facialHair !== 'stubble') {
    stroke([[-1.7 + look, 5.1], [1.7 + look, 5.1]], '#8a7a4a', .8);
    stroke([[-1.2 + look, 6.3], [1.2 + look, 6.3]], '#8a7a4a', .8);
  }
  return shapes;
}

/** Protruding race features (ears, horns, tusks, tendrils) drawn over head armor.
 * Returns the same head-local space as appearanceHeadShapes, headScale applied. */
export function raceOverlayShapes(raceId: WowRaceId, appearance: Readonly<CharacterAppearance>, facing: number): GearShape[] {
  const v = WOW_RACES[raceId]?.visual;
  if (!v) return [];
  const skin = appearancePalette(SKIN_PALETTES, appearance.skin);
  const feat = appearance.feature ?? RACE_FEATURE_OPTIONS[raceId]?.[0];
  const shapes = raceFeatureShapes(raceId, appearance, facing, skin, false, feat, true);
  const headScale = v.headScale ?? 1;
  if (headScale === 1) return shapes;
  return shapes.map(s => ({ ...s, points: s.points.map(([x, y]): Point => [x * headScale, .6 + (y - .6) * headScale]), width: s.width === undefined ? undefined : s.width * headScale }));
}
