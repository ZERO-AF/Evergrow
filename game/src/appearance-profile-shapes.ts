import { appearancePalette, HAIR_PALETTES, RACE_FEATURE_OPTIONS, SKIN_PALETTES, type AppearancePalette, type CharacterAppearance, type RaceFeatureId } from './appearance-content.ts';
import { profileHairShapes } from './appearance-hair-directions.ts';
import { mixColor, type Point } from './art-primitives.ts';
import type { GearShape } from './weapon-shapes.ts';
import { WOW_RACES } from './wow-races.ts';
import type { WowRaceId, WowRaceVisual } from './wow-types.ts';

/** A right-facing skull, nose, jaw and one visible eye; mirror for west. All
 * cosmetics stay on this head mount, including the projected hairstyle recipe. */
export function appearanceProfileShapes(appearance: Readonly<CharacterAppearance>, facing: number, covered: boolean, raceId?: WowRaceId): GearShape[] {
  const skin = appearancePalette(SKIN_PALETTES, appearance.skin);
  const hair = appearancePalette(HAIR_PALETTES, appearance.hairColor);
  const sign = Math.cos(facing) >= 0 ? 1 : -1;
  const v = raceId ? WOW_RACES[raceId]?.visual : undefined;
  const feat = appearance.feature ?? (raceId ? RACE_FEATURE_OPTIONS[raceId]?.[0] : undefined);
  const shapes: GearShape[] = [];
  const f = (points: readonly Point[], fill: string) => shapes.push({ points, fill });
  const l = (points: readonly Point[], stroke: string, width = .55) => shapes.push({ points, stroke, width });
  const layers = covered ? { rear: [], front: [] } : profileHairShapes(appearance.hair, hair);
  shapes.push(...layers.rear);
  f([[-3.8,-1.3],[-3.3,-3.6],[-1.3,-4.7],[1.8,-4.4],[3.2,-2.7],[3.4,-.5],
    [3.1,.6],[4.7,2],[4.5,2.65],[3.1,2.8],[3.2,3.8],[2.2,5],[.1,5.1],[-1.4,3.8],[-3.2,2.2]], '#403b39');
  f([[-3.2,-1.2],[-2.8,-3.3],[-1,-4.1],[1.7,-3.9],[2.7,-2.3],[2.8,.5],
    [4.15,2.15],[2.55,2.4],[2.7,3.6],[1.9,4.5],[.2,4.6],[-1.2,3.3],[-2.8,1.9]], skin.base);
  f([[-3.2,-1.2],[-1.3,-1.7],[-.7,1.1],[-.5,3.4],[.2,4.6],[-1.2,3.3],[-2.8,1.9]], skin.shadow);
  f([[1.8,-.8],[2.7,-.5],[2.8,.5],[4.15,2.15],[2.55,2.4],[1.8,1.9]], skin.light);
  // The muzzle replaces nose and mouth with a bovine snout (tauren).
  if (v?.muzzle) {
    f([[1.6,1.6],[3.4,1.5],[5.6,2.7],[5.9,3.7],[5.2,4.7],[3.4,5.3],[1.9,4.9],[2.4,3.6]], skin.base);
    f([[4.6,2.9],[5.9,3.5],[5.5,4.4],[4.4,4.6]], '#413028');
    f([[5.1,3.3],[5.6,3.4],[5.5,3.9],[5,3.9]], '#1d1512');
    l([[3.2,4.6],[4.3,4.9]], '#241a16', .55);
    f([[1.2,4.9],[2.6,5.1],[2.2,7],[1,6.8]], hair.base);
  } else if (v?.jaw === 'wide') {
    // Orc underbite: the lower face juts past the nose line.
    f([[1.4,2.9],[3.4,2.9],[3.9,4.2],[3,5.6],[.6,5.5],[.4,4.4]], skin.base);
    f([[.6,5.5],[3,5.6],[3.9,4.2],[2.6,4.7],[1,4.8]], skin.shadow);
    l([[2.2,3.4],[3.2,3.35]], mixColor(skin.shadow,'#553c3e',.3), .5);
  } else if (v?.jaw === 'bone' && feat !== 'bone-covered') {
    // Forsaken bone-bare jaw: exposed bone with teeth lines.
    f([[1,3.4],[3,3.4],[2.8,5.4],[.6,5.8],[.2,4.6]], '#cfc9b0');
    for (const tx of [1, 1.7, 2.4]) l([[tx,3.8],[tx,5]], '#8a8471', .4);
    l([[.7,4.4],[2.9,4.4]], '#8a8471', .45);
  } else {
    l([[2.2,3.2],[3,3.15]], mixColor(skin.shadow,'#553c3e',.3), .5);
    l([[.8,4.2],[2,4.25]], skin.light, .4);
  }
  // Eyes: glowing races replace the lash line with a lit iris and halo; undead sink it in a hollow.
  if (v?.decay) {
    f([[1.3,.35],[3.1,.55],[2.9,1.9],[1.6,1.8]], '#2a2226');
    if (v.eyeGlow) f([[1.9,.95],[2.6,1],[2.5,1.6],[2,1.55]], v.eyeGlow);
  } else if (v?.eyeGlow) {
    f([[1.5,.55],[3,.7],[2.85,1.75],[1.7,1.6]], `${v.eyeGlow}44`);
    f([[1.8,.8],[2.75,.9],[2.65,1.55],[1.95,1.45]], v.eyeGlow);
  } else if ((v?.eyeScale ?? 1) > 1) {
    // Oversized gnome eye: a larger dark iris with a glint.
    f([[1.3,.5],[3.1,.75],[2.9,2],[1.6,1.9]], '#263239');
    f([[2,.95],[2.5,1],[2.45,1.4],[2.05,1.35]], '#dfe8ea');
  } else {
    l([[1.65,.7],[2.85,.85]], '#263239', .8);
  }
  // Night elf markings: dark stripes under the eye and a forehead V.
  if (v?.markings && feat === 'markings') {
    const mark = mixColor(skin.shadow, '#4a2a6a', .55);
    l([[1.9,2.1],[1.7,3.2]], mark, .55);
    l([[2.5,2],[2.4,3]], mark, .55);
    l([[.4,-1.7],[1.2,-1],[2,-1.6]], mark, .5);
  }
  const beard = appearance.facialHair;
  if (beard !== 'none') {
    const bottom = beard === 'fullbeard' ? 7.5 : beard === 'chinbraid' ? 6 : beard === 'beard' ? 5.8 : 4.7;
    if (['stubble','beard','fullbeard','chinbraid'].includes(beard)) {
      f([[-.2,2.8],[1.1,3.8],[2.65,3.5],[2.4,4.6],[1.2,bottom],[-.5,bottom-.5],[-1,3]],
        beard === 'stubble' ? mixColor(skin.base,hair.shadow,.42) : hair.base);
      if (beard !== 'stubble') l([[.3,4.2],[.7,bottom-.5]],hair.light,.35);
    }
    if (beard === 'goatee') {
      f([[1.1,3.8],[2.65,3.6],[2.5,4.7],[1.5,6.4],[.65,5.7],[.8,4.4]],hair.base);
      l([[1.5,4.5],[1.4,5.7]],hair.light,.35);
    }
    if (beard !== 'stubble') l([[1.8,2.8],[2.9,2.95],[3.1,3.4]],hair.base,.65);
    if (beard === 'handlebar') {
      l([[2.9,3.05],[3.7,3.15],[4,2.75],[3.8,2.35]],hair.base,.7);
      l([[3.3,3.05],[3.65,2.85]],hair.light,.3);
    }
    if (beard === 'chinbraid') for(let i=0;i<3;i++) {
      const y=5.2+i*1.05; f([[.1,y],[1,y-.2],[1.5,y+.5],[.7,y+1.2],[0,y+.6]],i%2?hair.shadow:hair.base);
    }
  }
  // Tusks rise from the lower jaw over the beard; trolls run long, orcs short.
  // Draenei tendrils hang beside the jaw. Both re-draw over helmets via the overlay.
  if (!covered) shapes.push(...profileJawShapes(v, feat, skin));
  const accessory=appearance.accessory;
  if (accessory === 'spectacles') {
    l([[1.55,.15],[2.9,.3],[3.1,1.55],[1.8,1.8],[1.55,.15]],'#d3bc86',.55);
    l([[-1,.65],[1.6,.55]],'#7b725f',.45);
  }
  if (accessory === 'eyepatch') {
    l([[-3,.15],[2,.55]],'#303038',.6);
    // The patch covers the anatomical right eye, visible from the east view.
    if (sign > 0) f([[1.5,.15],[3,.35],[2.9,1.65],[2,1.85],[1.5,1.1]],'#222a2f');
  }
  if (accessory === 'nosering') l([[3.8,2.25],[4,2.9],[3.4,3],[3.3,2.6]],'#e0c38b',.3);
  shapes.push(...layers.front);
  // Near ear overlaps the sideburn, giving the profile a readable depth cue.
  if (!covered) {
    if (v?.ears) shapes.push(...profileEarShapes(v, skin));
    else {
      f([[-1.4,.15],[-.3,-.15],[.15,.65],[-.1,2.15],[-1,2.45],[-1.6,1.45]],skin.base);
      l([[-1, .65],[-.55,.45],[-.4,1.45],[-.9,1.8]],skin.shadow,.45);
    }
    if(accessory==='hoop') l([[-.65,2],[-.1,2.5],[-.2,3.6],[-1,3.8],[-1.35,2.9],[-.65,2]],'#d5b478',.55);
    if(accessory==='studs') f([[-.7,1.5],[-.15,2],[-.7,2.5],[-1.2,2]],'#d2dbda');
    if(accessory==='earcuff') l([[-1.3,.6],[-.4,.4],[-.15,1.1],[-1,1.4],[-1.3,.6]],'#c9d5d7',.65);
    if(accessory==='circlet') { l([[-3.2,-1.8],[.4,-1.4],[2.8,-.9]],'#d5dcca',.6); f([[2.5,-1.4],[3,-.8],[2.6,-.1],[2.2,-.8]],'#abd2d5'); }
  }
  // Horns crown the silhouette above the hair; the feature pick chooses the variant.
  if (!covered) shapes.push(...profileHornShapes(v, feat));
  const headScale = v?.headScale ?? 1;
  return shapes.map(shape => ({ ...shape, points: shape.points.map(([x,y]) => [x*sign*headScale, .6+(y-.6)*headScale] as Point), width: shape.width === undefined ? undefined : shape.width * headScale }));
}

/** Tusks and chin tendrils in right-facing head-local space (unmirrored, unscaled). */
function profileJawShapes(v: WowRaceVisual | undefined, feat: RaceFeatureId | undefined, skin: AppearancePalette): GearShape[] {
  const shapes: GearShape[] = [];
  const f = (points: readonly Point[], fill: string) => shapes.push({ points, fill });
  const l = (points: readonly Point[], stroke: string, width = .55) => shapes.push({ points, stroke, width });
  if (v?.tusks) {
    const ivory = '#f0e6cc', ivoryShade = '#c9b892';
    if (v.tusks === 'long') {
      const tipY = feat === 'tusks-small' ? 2.2 : feat === 'tusks-upcurved' ? -.2 : .9;
      const tipX = feat === 'tusks-upcurved' ? 3.4 : 3.9;
      f([[2.5,4.6],[tipX,tipY],[tipX + .7,tipY + 1.3],[3.2,5]], ivory);
      l([[2.8,4.5],[tipX + .2,tipY + .9]], ivoryShade, .4);
    } else {
      const big = feat === 'tusks-large';
      f([[2.4,4.4],[3.4,big ? 2.4 : 3],[3.6,4.6]], ivory);
      l([[2.7,4.3],[3.3,big ? 2.9 : 3.4]], ivoryShade, .4);
    }
  }
  if (v?.tendrils) {
    f([[.6,4.4],[1.4,4.6],[1.2,7.4],[.4,8],[.2,6]], skin.base);
    l([[.9,5],[.8,7.2]], skin.light, .4);
  }
  return shapes;
}

/** Race ear silhouettes in right-facing head-local space. */
function profileEarShapes(v: WowRaceVisual, skin: AppearancePalette): GearShape[] {
  const shapes: GearShape[] = [];
  const f = (points: readonly Point[], fill: string) => shapes.push({ points, fill });
  if (v.ears === 'long') {
    // Troll ears droop outward past the jaw.
    f([[-1.6,.6],[-4.6,3.4],[-3.4,4.3],[-.9,2.6]], skin.shadow);
    f([[-1.4,.9],[-3.9,3.3],[-3,3.8],[-.9,2.4]], skin.base);
  } else if (v.ears === 'bovine') {
    // Tauren ears lie flat beside the skull.
    f([[-2.2,-.5],[-5.6,-1.1],[-6.1,.2],[-2.4,.9]], skin.shadow);
    f([[-2.3,-.2],[-5,-.7],[-5.4,.1],[-2.4,.6]], skin.base);
  } else if (v.ears === 'elf') {
    // Elf ears sweep up and back.
    f([[-1.5,.2],[-4.3,-2.6],[-3.1,-3],[-.6,-.4]], skin.shadow);
    f([[-1.3,.1],[-3.8,-2.3],[-2.9,-2.6],[-.6,-.2]], skin.base);
  }
  return shapes;
}

/** Horn crowns in right-facing head-local space; the feature pick chooses the variant. */
function profileHornShapes(v: WowRaceVisual | undefined, feat: RaceFeatureId | undefined): GearShape[] {
  const shapes: GearShape[] = [];
  const f = (points: readonly Point[], fill: string) => shapes.push({ points, fill });
  const l = (points: readonly Point[], stroke: string, width = .55) => shapes.push({ points, stroke, width });
  if (v?.horns) {
    const horn = '#e8dcc0', hornShade = '#a8946e';
    if (v.horns === 'tauren') {
      if (feat === 'horns-swept') {
        f([[.6,-3.6],[3.4,-4.2],[4.4,-3.4],[2.4,-2.6],[.8,-2.8]], hornShade);
        f([[.9,-3.5],[3.2,-3.9],[3.9,-3.3],[2.3,-2.8]], horn);
      } else if (feat === 'horns-grand') {
        f([[.2,-3.6],[1.4,-6.6],[2.6,-6.2],[2.2,-3],[1,-2.8]], hornShade);
        f([[.5,-3.7],[1.5,-6],[2.2,-5.7],[1.9,-3.2]], horn);
      } else {
        f([[.4,-3.4],[1.8,-5.6],[3,-5.2],[2.4,-2.9],[1,-2.7]], hornShade);
        f([[.7,-3.5],[1.9,-5.1],[2.6,-4.8],[2.1,-3.1]], horn);
      }
    } else if (feat === 'crest') {
      // Male draenei: a ridged forehead crest plate instead of horn pairs.
      f([[1,-4.4],[2.2,-6.8],[3.1,-4.4],[2.6,-3.4],[1.4,-3.5]], hornShade);
      f([[1.4,-4.4],[2.2,-6],[2.7,-4.4],[2.4,-3.7],[1.6,-3.8]], horn);
      l([[1.7,-4.2],[2.2,-5.4],[2.5,-4.3]], hornShade, .5);
    } else if (feat !== 'tendrils') {
      f([[.6,-4.2],[-1.8,-5.8],[-2.8,-5.2],[-.8,-3.4]], hornShade);
      f([[.4,-4.3],[-1.6,-5.4],[-2.3,-5],[-.7,-3.6]], horn);
    }
  }
  return shapes;
}

/** Protruding race features (ears, horns, tusks, tendrils) drawn over head armor.
 * Returns the same head-local space as appearanceProfileShapes, headScale applied. */
export function raceProfileOverlayShapes(raceId: WowRaceId, appearance: Readonly<CharacterAppearance>, facing: number): GearShape[] {
  const v = WOW_RACES[raceId]?.visual;
  if (!v) return [];
  const skin = appearancePalette(SKIN_PALETTES, appearance.skin);
  const feat = appearance.feature ?? RACE_FEATURE_OPTIONS[raceId]?.[0];
  const sign = Math.cos(facing) >= 0 ? 1 : -1;
  const headScale = v.headScale ?? 1;
  const shapes = [...profileJawShapes(v, feat, skin), ...profileEarShapes(v, skin), ...profileHornShapes(v, feat)];
  return shapes.map(shape => ({ ...shape, points: shape.points.map(([x, y]) => [x * sign * headScale, .6 + (y - .6) * headScale] as Point), width: shape.width === undefined ? undefined : shape.width * headScale }));
}
