import { torsoFacing } from './character-facing.ts';
import { gearSurface } from './gear-material.ts';
import { projectArmPoint } from './player-arm-rig.ts';
import type { CharacterOutfit } from './art-types.ts';
import type { StatusPose } from './status-art.ts';
import { PLAYER_ATTACHMENTS, playerMotion } from './character-motion.ts';
import { playerLegRig, projectLegPoint } from './player-leg-rig.ts';
import { STARTER_OUTFIT, heldWeapon, heldShield, heldFocus, upperArm, forearm, gauntlet, armorBoot, armorSegment, kneeArmor, drawGearShapes, chestArmor, shoulderArmor, headArmor } from './equipment-art.ts';
import { hash, polygon, line, taper, mixColor, TAU, type Color, type Point } from './art-primitives.ts';
import { WOW_RACES } from './wow-races.ts';
import { appearancePalette, HAIR_PALETTES, SKIN_PALETTES } from './appearance-content.ts';
import { raceAppearance } from './character-look.ts';
import { drawQuadruped, drawBrute, type QuadArt, type BruteArt } from './ally-art.ts';
import { drawGlow } from './lighting.ts';
import type { ShapeshiftForm } from './wow-types.ts';

/** Per-form silhouette recipe: quadruped proportions or a biped brute, plus the aura accent. */
const FORM_ART: Readonly<Record<Exclude<ShapeshiftForm, 'shadow'>, {
  shape: 'quadruped' | 'brute' | 'moonkin'; tint: string; accent: string; scale: number;
  quad?: QuadArt; brute?: BruteArt; spectral?: boolean;
}>> = Object.freeze({
  bear:      { shape: 'quadruped', tint: '#6b4f38', accent: '#e8c07a', scale: 1.5, quad: { leg: .85, bulk: 1.4, tail: 1.5, ear: 1.4, snout: .85, head: .5 } },
  cat:       { shape: 'quadruped', tint: '#5a4a3e', accent: '#a8e07a', scale: 1.15, quad: { leg: 1.05, bulk: .75, tail: 7, ear: 2.8, snout: .8 } },
  ghostWolf: { shape: 'quadruped', tint: '#7a8a9a', accent: '#8ee7ff', scale: 1.2, spectral: true },
  travel:    { shape: 'quadruped', tint: '#7a5c40', accent: '#d8c88a', scale: 1.3, quad: { leg: 1.15, bulk: .85, tail: 2, ear: 3.4, snout: 1.15, head: 1.5 } },
  moonkin:   { shape: 'moonkin',   tint: '#6a5a7c', accent: '#c9a8ff', scale: 1.35 },
  metamorph: { shape: 'brute',     tint: '#4a3a5c', accent: '#a06ad8', scale: 1.55, brute: { horns: true, wings: true } },
});

/** Broad avian moonkin: feathered bulk, wing-arms, antlered head. Local space, facing `angle`. */
function drawMoonkin(c: CanvasRenderingContext2D, angle: number, gait: number, moving: number,
  time: number, tint: string, dark: string, accent: string, lunge: number): void {
  const forward = [Math.cos(angle), Math.sin(angle) * .55] as const;
  const across = [-Math.sin(angle), Math.cos(angle) * .55] as const;
  const at = (px: number, py: number, z: number): Point =>
    [forward[0] * px + across[0] * py, forward[1] * px + across[1] * py - z];
  const poly = (points: readonly (readonly [number, number, number])[], fill: string) =>
    polygon(c, points.map(q => at(...q)), fill);
  const bob = Math.sin(time * 2.2) * .8, sway = Math.sin(gait * .5) * moving * 1.4;
  for (const side of [-1, 1])
    taper(c, at(side * 2.6, 0, 8), at(side * 3.4 + Math.sin(gait + side * Math.PI) * moving * 2, 0, .5), 3, 2, dark);
  // Wing-arms: broad feathered slabs that lift with the lunge.
  for (const side of [-1, 1]) {
    poly([[side * 4 + sway, side * 1.5, 17 + bob], [side * (11 + lunge * 3) + sway, side * 5, 13 + bob + lunge * 2],
      [side * (13 + lunge * 3) + sway, side * 6, 8 + bob], [side * 5 + sway, side * 3, 9]], dark);
    poly([[side * 5 + sway, side * 2, 16 + bob], [side * (9 + lunge * 2) + sway, side * 4, 12 + bob],
      [side * (10 + lunge * 2) + sway, side * 5, 9 + bob]], tint);
  }
  // Barrel torso and feathered breast.
  poly([[-6 + sway, -3, 20 + bob], [6 + sway, -3, 20 + bob], [8 + sway, 0, 8], [-8 + sway, 0, 8]], tint);
  poly([[-4 + sway, -2, 19 + bob], [4 + sway, -2, 19 + bob], [5 + sway, 0, 10], [-5 + sway, 0, 10]], dark);
  // Head with small antler branches and glowing eyes.
  poly([[-3.4 + sway, -2, 26 + bob], [3.4 + sway, -2, 26 + bob], [4 + sway, 0, 20 + bob], [-4 + sway, 0, 20 + bob]], tint);
  for (const side of [-1, 1]) {
    taper(c, at(side * 2 + sway, -1, 26 + bob), at(side * 4.5 + sway, -1.5, 30 + bob), 1, .6, dark);
    taper(c, at(side * 3.4 + sway, -1.3, 28.4 + bob), at(side * 5.4 + sway, -1.6, 29.6 + bob), .8, .4, dark);
  }
  const beak = at(4.6 + sway, 0, 23.4 + bob);
  polygon(c, [[beak[0], beak[1] - 1], [beak[0] + 2.6, beak[1]], [beak[0], beak[1] + 1]], accent);
  c.fillStyle = accent;
  const e1 = at(1.6 + sway, -1.4, 24 + bob), e2 = at(1.6 + sway, 1.4, 24 + bob);
  c.fillRect(e1[0] - .8, e1[1] - .8, 1.6, 1.6); c.fillRect(e2[0] - .8, e2[1] - .8, 1.6, 1.6);
}

/** Form identity under the feet: class-colored ring plus two slow orbiting motes. */
function drawFormAura(c: CanvasRenderingContext2D, accent: string, time: number): void {
  c.save();
  c.globalAlpha = .3; c.strokeStyle = accent; c.lineWidth = 1.2;
  c.beginPath(); c.ellipse(0, 2, 15, 6, 0, 0, Math.PI * 2); c.stroke();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 2; i++) {
    const a = time * 1.4 + i * Math.PI;
    const x = Math.cos(a) * 15, y = 2 + Math.sin(a) * 6;
    c.globalAlpha = .55; c.fillStyle = accent;
    c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill();
  }
  drawGlow(c, 0, -8, 26, accent, .18);
  c.restore();
}

/** Shapeshifted players draw a creature silhouette instead of the humanoid rig. */
function drawFormSilhouette(ctx: CanvasRenderingContext2D, pose: StatusPose, color: Color, form: Exclude<ShapeshiftForm, 'shadow'>): void {
  const art = FORM_ART[form];
  const gait = pose.gaitPhase ?? pose.time * 8;
  const moving = pose.dead ? 0 : Math.min(1, pose.moving);
  const lunge = Math.min(1, Math.max(0, pose.attack)) * .9;
  const t = pose.effectTime ?? pose.time;
  const tint = color(art.tint), dark = color(mixColor(art.tint, '#0a0d12', .55)), accent = color(art.accent);
  ctx.save();
  if (art.spectral) ctx.globalAlpha *= .78;
  ctx.scale(art.scale, art.scale);
  if (art.shape === 'quadruped') drawQuadruped(ctx, pose.angle, gait, moving, t, tint, dark, accent, art.quad, Math.sin(t * 3) * 1.2, lunge);
  else if (art.shape === 'brute') drawBrute(ctx, gait, moving, t, tint, dark, accent, art.brute, lunge);
  else drawMoonkin(ctx, pose.angle, gait, moving, t, tint, dark, accent, lunge);
  ctx.restore();
  drawFormAura(ctx, accent, t);
}

/** Saturated armor reads at distance; skin and cloth keep their authored tones. */
const vividCache = new Map<string, string>();
function vividColor(value: string): string {
  let out = vividCache.get(value);
  if (out) return out;
  const hex = value[0] === '#' ? Number.parseInt(value.slice(1), 16) : NaN;
  if (!Number.isFinite(hex)) return value;
  const r = (hex >>> 16) & 255, g = (hex >>> 8) & 255, b = hex & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510;
  const d = max - min, s = d === 0 ? 0 : d / (255 - Math.abs(max + min - 255));
  const boost = Math.min(1, s * 1.35 + .06), lift = Math.min(1, l * 1.08 + .02);
  // HSL round-trip with boosted saturation.
  const hue = d === 0 ? 0 : max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  const a = boost * Math.min(lift, 1 - lift) * 2;
  const channel = (n: number) => {
    const h = (hue + n / 3 + 1) % 1;
    const v = h < 1 / 6 ? lift + a * h * 6 : h < .5 ? lift + a : h < 2 / 3 ? lift + a * (2 / 3 - h) * 6 : lift;
    return Math.round(Math.max(0, Math.min(255, v * 255)));
  };
  out = `rgb(${channel(0)},${channel(1)},${channel(2)})`;
  if (vividCache.size > 256) vividCache.clear();
  vividCache.set(value, out);
  return out;
}

export function player(ctx: CanvasRenderingContext2D, pose: StatusPose, color: Color): void {
  // Stealth renders the whole rig translucent; the save/restore keeps the alpha scoped.
  if (pose.stealthed) { ctx.save(); ctx.globalAlpha *= .55; }
  // Shapeshift forms replace the rig with a creature silhouette; shadow form
  // keeps the humanoid rig but darkens and translucifies it.
  if (pose.form && pose.form !== 'shadow') {
    drawFormSilhouette(ctx, pose, color, pose.form);
    if (pose.stealthed) ctx.restore();
    return;
  }
  if (pose.form === 'shadow') {
    ctx.save(); ctx.globalAlpha *= .72;
    const shadowed = color; color = (value: string) => mixColor(shadowed(value), '#241a38', .62);
    drawFormAura(ctx, '#a06ad8', pose.effectTime ?? pose.time);
  }
  const outfit: CharacterOutfit = { ...STARTER_OUTFIT, ...pose.outfit };
  // Equipment reads in saturated metal/cloth tones; skin, fur and hair keep the
  // authored palette through the plain resolver.
  const gear: Color = value => color(vividColor(value));
  const { moving, phase, step, moveX, moveY, bob, back, commitment, torsoTurn, cast,
    weaponAngle, offWeaponAngle, weaponScale, offWeaponScale, rangedDraw, weaponCharge, weaponBehind, supportHolding, bodyAngle, hipX, hipY, lean, leanDepth, hunch, body, weaponOrigin, offWeaponOrigin, weaponArm, offArm } = playerMotion(pose);
  const rv = pose.raceId ? WOW_RACES[pose.raceId]?.visual : undefined;
  // A race without an explicit look still wears its default skin and hair.
  const appearance = pose.appearance ?? (pose.raceId ? raceAppearance(pose.raceId) : undefined);
  const skin = appearance ? appearancePalette(SKIN_PALETTES, appearance.skin) : undefined;
  const fur = rv?.muzzle && skin;
  // Race build: bulk thickens limbs and torso; bare skin shows where armor is absent.
  const bulk = rv?.bulk ?? 1;
  const bareArms = skin && !outfit.chest ? skin : undefined;
  const bareHands = skin && !outfit.hands ? skin : undefined;
  const bareLegs = skin && !outfit.legs ? skin : undefined;
  const legs = playerLegRig(pose.angle, pose.moveAngle ?? pose.angle, phase, moving, hipX, hipY);
  const cape = () => {
    const cloth = outfit.cloak;
    if (!cloth) return;
    const turn = torsoFacing(bodyAngle);
    const fabric = (points:readonly Point[],fill:string) => {
      const cx=points.reduce((sum,p)=>sum+p[0],0)/points.length;
      drawGearShapes(ctx,[{points,fill,surface:gearSurface('cloth',cloth.seed,[Math.max(-.5,Math.min(.5,cx*.06)),-.15,.95])}],color);
    };
    ctx.save(); ctx.translate(-turn.side * 3.1, 0); ctx.scale(Math.max(.22, turn.surface), 1);
    const offset = (hash(cloth.seed) % 11) * 0.1;
    const wind = Math.sin(pose.time * 3.6 - 0.6 + offset) * (0.8 + moving * 1.1);
    const lag = Math.sin(phase - 0.7) * moving * 1.8;
    const trailX = -moveX * moving * 5 - Math.cos(pose.attackAngle) * commitment * 2.3
      - Math.sin(pose.attackAngle) * torsoTurn * 3;
    const trailY = -moveY * moving * 3 + Math.cos(pose.attackAngle) * torsoTurn * 1.6;
    const hemX = wind + lag + trailX;
    const hemY = -5.2 + trailY + Math.sin(pose.time * 4.7 - 0.4) * 0.5;
    fabric([[-6, -27], [6, -27], [8 + hemX, hemY - 2],
      [3 + hemX * 0.9, hemY + 1], [-1 + hemX * 0.7, hemY - 0.5], [-7 + hemX * 0.6, hemY - 2]], '#281f2b');
    fabric([[-5, -26], [5, -26], [6.5 + hemX, hemY - 3],
      [2 + hemX * 0.9, hemY - 0.5], [-5.7 + hemX * 0.6, hemY - 3]], cloth.base);
    fabric([[-4, -25], [-0.5, -25], [hemX * 0.82, hemY - 2],
      [-4.5 + hemX * 0.6, hemY - 4]], cloth.highlight);
    fabric([[2, -24], [4, -24], [5 + hemX * 0.9, hemY - 4],
      [2 + hemX * 0.7, hemY - 2]], cloth.shadow);
    // The center pleat is an actual fold with an inset lining and a split hem.
    fabric([[-.8, -23], [.8, -23], [2.1 + hemX * .82, hemY - .8],
      [.5 + hemX * .7, hemY - 4.1], [-.9 + hemX * .7, hemY - 1.1]], cloth.shadow);
    line(ctx, [[-1.1, -22], [-.5 + hemX * .45, -13], [-1.2 + hemX * .7, hemY - 3.2]], color(cloth.highlight), .6);
    line(ctx, [[-5.7 + hemX * 0.6, hemY - 3], [2 + hemX * 0.9, hemY - 0.5],
      [6.5 + hemX, hemY - 3]], color(cloth.trim), 0.65);
    line(ctx, [[-4.5, -24], [-4.5 + hemX * 0.3, -17], [-4.5 + hemX * 0.6, hemY - 4]], color(cloth.trim), 0.45);
    line(ctx, [[-4, -26], [0, -24.5], [4, -26]], color(cloth.trim), 0.8);
    if (back) {
      // A small stitched wayfarer's seal supplies an identity without hiding cloth.
      line(ctx, [[-.8, -21.5], [1, -19.1], [-.5, -16.8], [-2.1, -19]], color(cloth.trim), .65);
      line(ctx, [[-.6, -20.6], [-.6, -17.8]], color(cloth.highlight), .5);
    }
    ctx.restore();
  };
  // The front-facing cape is behind the whole rig, including both legs.
  if (!back) { ctx.save(); ctx.transform(...body); cape(); ctx.restore(); }
  // Tails trail opposite the facing, behind the legs; tauren end in a hair tuft.
  if (rv?.tail && skin) {
    const sway = Math.sin(phase + .9) * (0.5 + moving * 1.4) + Math.sin(pose.time * 2.2) * .3;
    const rootX = -Math.cos(pose.angle) * 3.4 + hipX * .6, rootY = -14 + bob * .6;
    const tipX = rootX - Math.cos(pose.angle) * 4.5 + sway, tipY = -2.5;
    taper(ctx, [rootX, rootY], [tipX, tipY], 1.5 * bulk, .8 * bulk, color(skin.shadow));
    ctx.save(); ctx.translate(tipX, tipY); ctx.scale(bulk, bulk); ctx.translate(-tipX, -tipY);
    if (rv.tail === 'tuft') {
      const hair = appearancePalette(HAIR_PALETTES, appearance!.hairColor);
      polygon(ctx, [[tipX - 1.4, tipY - 1.2], [tipX + 1.3, tipY - 1], [tipX + 1.6, tipY + 1.6], [tipX - .2, tipY + 2.6], [tipX - 1.7, tipY + 1.2]], color(hair.shadow));
    } else {
      polygon(ctx, [[tipX - 1, tipY - .9], [tipX + 1.1, tipY - .6], [tipX + .9, tipY + 1], [tipX - .9, tipY + .8]], color(skin.shadow));
    }
    ctx.restore();
  }
  // Contact shadow: a soft blob grounding the actor, WoW-style. Squashes with
  // the gait so it reads as attached to the feet, not a painted decal.
  ctx.save();
  ctx.globalAlpha = .34;
  ctx.fillStyle = '#0a0f0d';
  ctx.beginPath();
  ctx.ellipse(0, 2.5, 13 + Math.abs(step) * 2, 4.6 - Math.abs(step) * .4, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // A faint warm halo behind the torso keeps the small figure readable against
  // dark ground without touching the authored palette.
  drawGlow(ctx, 0, -18, 24, '#ffe9b8', .14);
  // Cast rune: a school-colored magic circle under the feet while channeling —
  // two counter-rotating tick rings and a diamond lattice, WoW-style.
  if (cast > 0.04) {
    const runeColor = pose.castColor ?? '#c0acf0';
    const t = pose.effectTime ?? pose.time;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const strength = Math.min(1, cast * 1.4);
    ctx.globalAlpha = .5 * strength;
    ctx.strokeStyle = color(runeColor); ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.ellipse(0, 2, 21, 8.5, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = .28 * strength;
    ctx.beginPath(); ctx.ellipse(0, 2, 15, 6, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = t * 1.1 + i * TAU / 8;
      const rx = Math.cos(a) * 21, ry = Math.sin(a) * 8.5 + 2;
      ctx.globalAlpha = .7 * strength;
      line(ctx, [[rx * .88, (ry - 2) * .88 + 2], [rx, ry]], color(runeColor), .9);
      if (i % 2 === 0) polygon(ctx, [[rx, ry - 1.6], [rx + 1.2, ry], [rx, ry + 1.6], [rx - 1.2, ry]], color(runeColor));
    }
    for (let i = 0; i < 4; i++) {
      const a = -t * .7 + i * TAU / 4;
      const rx = Math.cos(a) * 10, ry = Math.sin(a) * 4 + 2;
      ctx.globalAlpha = .55 * strength;
      polygon(ctx, [[rx, ry - 1.3], [rx + 1, ry], [rx, ry + 1.3], [rx - 1, ry]], color('#f4edff'));
    }
    drawGlow(ctx, 0, 0, 26, runeColor, .18 * strength);
    ctx.restore();
  }
  for (const leg of legs) {
    const hip = projectLegPoint(leg.hip), knee = projectLegPoint(leg.knee), ankle = projectLegPoint(leg.ankle);
    const thighFill = fur ? skin.shadow : bareLegs ? bareLegs.shadow : '#293d39';
    const shinFill = fur ? skin.base : bareLegs ? bareLegs.base : '#4d5a4c';
    taper(ctx, hip, knee, (fur ? 4.6 : 3.8) * bulk, (fur ? 3.6 : 2.8) * bulk, color(thighFill));
    taper(ctx, knee, ankle, (fur ? 3.6 : 2.8) * bulk, (fur ? 2.8 : 2.1) * bulk, color(shinFill));
    if (rv?.decay && bareLegs) polygon(ctx, [[knee[0] - 1.1 * bulk, knee[1] - .9], [knee[0] + 1.1 * bulk, knee[1] - .9], [knee[0] + .8 * bulk, knee[1] + .9], [knee[0] - .8 * bulk, knee[1] + .9]], color('#cfc9b0'));
    if (outfit.legs) {
      const m = outfit.legs.material;
      armorSegment(ctx,hip,[knee[0],knee[1]-.5],outfit.legs,gear,'thigh',(.65+.35*Math.abs(Math.sin(pose.angle)))*bulk);
      if (outfit.legs.style === 'plate') {
        taper(ctx, [hip[0], hip[1] - 0.5], [hip[0] + step * 0.25, hip[1] + 3.4], 4.6 * bulk, 4.1 * bulk, gear(m.shadow));
        line(ctx, [[hip[0] - 1.8 * bulk, hip[1] + 2], [hip[0] + 1.8 * bulk, hip[1] + 2.4]], gear(m.trim), 0.65);
      }
    }
    const foot = projectLegPoint(leg.foot);
    if (rv?.hooves && skin) {
      // Cloven hoof: a dark wedge seated on the ground line, fetlock fur above.
      ctx.save(); ctx.translate(foot[0], foot[1]); ctx.scale(bulk, bulk); ctx.translate(-foot[0], -foot[1]);
      const dir = Math.cos(pose.angle) * .75 + leg.side * .15;
      polygon(ctx, [[foot[0] - 2.3, foot[1] - 2.6], [foot[0] + 2.3, foot[1] - 2.6], [foot[0] + 2.7 + dir, foot[1] + .6], [foot[0] - 2.7 + dir, foot[1] + .6]], color('#2b2119'));
      line(ctx, [[foot[0] + dir * .5, foot[1] - .6], [foot[0] + dir * .5, foot[1] + .6]], color('#171008'), .7);
      if (fur) polygon(ctx, [[foot[0] - 2.6, foot[1] - 4.6], [foot[0] + 2.6, foot[1] - 4.6], [foot[0] + 2.4, foot[1] - 2.2], [foot[0] - 2.4, foot[1] - 2.2]], color(skin.base));
      ctx.restore();
    } else armorBoot(ctx, foot, outfit.boots, outfit.boots ? gear : color, leg.facing, ankle, knee, bulk, skin);
    // The knee cap overlaps the boot cuff when the lower leg is foreshortened.
    if (outfit.legs) kneeArmor(ctx,knee,outfit.legs,gear,pose.angle,bulk);
  }
  if (bareLegs && !fur) {
    // A breechcloth keeps bare-legged races decent between the hip sockets.
    const leftHip = projectLegPoint(legs[legs.length - 1].hip), rightHip = projectLegPoint(legs[0].hip);
    const cx = (leftHip[0] + rightHip[0]) / 2, top = Math.min(leftHip[1], rightHip[1]) - 1.2;
    polygon(ctx, [[cx - 4.4 * bulk, top], [cx + 4.4 * bulk, top], [cx + 3.4 * bulk, top + 4.6], [cx - 3.4 * bulk, top + 4.6]], color('#29363d'));
    line(ctx, [[cx - 4 * bulk, top + .8], [cx + 4 * bulk, top + .8]], color('#496257'), .6);
  }

  ctx.save();
  ctx.transform(...body);
  const bow = pose.weapon?.kind === 'bow';
  const mainWeapon = () => {
    const hand = projectArmPoint(weaponArm.hand);
    if (pose.weapon?.kind === 'unarmed') {
      const elbow = projectArmPoint(weaponArm.elbow);
      gauntlet(ctx, hand, outfit.hands, outfit.hands ? gear : color, -Math.atan2(hand[0] - elbow[0], hand[1] - elbow[1]), pose.attack > 0, bulk, bareHands);
      return;
    }
    heldWeapon(ctx, weaponOrigin, weaponAngle, gear, pose.weapon, rangedDraw, pose.effectTime ?? pose.time, pose.attackHand === 'off' ? 0 : weaponCharge, weaponScale, pose.imbueElement);
    gauntlet(ctx, hand, outfit.hands, outfit.hands ? gear : color, weaponAngle, true, bulk, bareHands);
    if (supportHolding) gauntlet(ctx, projectArmPoint(offArm.hand), outfit.hands, outfit.hands ? gear : color, weaponAngle, true, bulk, bareHands);
    // Fingers cross the grip, keeping the weapon seated in the animated gauntlet.
    ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(weaponAngle);
    line(ctx, [[-0.6, -1.2], [-0.6, 1.3]], gear(outfit.hands?.material.edge ?? '#baa078'), 0.7);
    ctx.restore();
    if (supportHolding && !bow) {
      const support = projectArmPoint(offArm.hand);
      ctx.save(); ctx.translate(support[0], support[1]); ctx.rotate(weaponAngle);
      line(ctx, [[-.6, -1.2], [-.6, 1.3]], gear(outfit.hands?.material.edge ?? '#baa078'), .7);
      ctx.restore();
    }
  };
  const offEquipment = () => {
    const offHand = projectArmPoint(offArm.hand);
    if (pose.offHand?.kind === 'focus') {
      heldFocus(ctx, offHand, pose.offHand.visual, gear, pose.effectTime ?? pose.time, pose.angle, weaponCharge);
      gauntlet(ctx, offHand, outfit.hands, outfit.hands ? gear : color, -.2, false, bulk, bareHands);
    }
    if (pose.offHand?.kind === 'shield') heldShield(ctx, offHand, pose.angle, pose.offHand.visual, gear, pose.guard);
    if (pose.offHand?.kind === 'weapon') {
      heldWeapon(ctx, offWeaponOrigin, offWeaponAngle, gear, pose.offHand.visual, 0, pose.effectTime ?? pose.time, pose.attackHand === 'off' ? weaponCharge : 0, offWeaponScale, pose.imbueElement);
      gauntlet(ctx, offHand, outfit.hands, outfit.hands ? gear : color, offWeaponAngle, true, bulk, bareHands);
    }
  };
  const armLayers = [weaponArm, offArm].flatMap(arm => [
    { depth: (arm.shoulder[1] + arm.elbow[1]) / 2,
      draw: () => upperArm(ctx, projectArmPoint(arm.shoulder), projectArmPoint(arm.elbow), color, bulk, bareArms) },
    { depth: supportHolding ? (weaponBehind ? -1 : 1) : (arm.elbow[1] + arm.hand[1]) / 2,
      draw: () => forearm(ctx, projectArmPoint(arm.elbow), projectArmPoint(arm.hand), outfit.hands, outfit.hands ? gear : color, bulk, bareHands) },
  ]).sort((a, b) => a.depth - b.depth);
  if (!supportHolding) {
    const hand = projectArmPoint(offArm.hand), elbow = projectArmPoint(offArm.elbow);
    const relaxed = pose.weapon?.kind === 'unarmed' && !pose.offHand;
    armLayers.push({ depth: offArm.hand[1], draw: () => gauntlet(ctx, hand, outfit.hands, outfit.hands ? gear : color,
      relaxed ? -Math.atan2(hand[0] - elbow[0], hand[1] - elbow[1]) : -.5, false, bulk, bareHands) });
    armLayers.sort((a, b) => a.depth - b.depth);
  }
  for (const layer of armLayers) if (layer.depth < 0) layer.draw();
  if (weaponBehind) mainWeapon();
  if (pose.offHand && offArm.hand[1] < 0) offEquipment();
  ctx.save();
  ctx.translate(0, PLAYER_ATTACHMENTS.chest[1]);
  // Idle breathing: a slow chest swell when the rig is at rest, suppressed while
  // moving or mid-swing so it never fights the gait.
  const breathe = 1 + Math.sin(pose.time * 1.9) * .012 * (1 - moving) * (1 - Math.abs(pose.attack));
  ctx.transform(1 - Math.abs(torsoTurn) * 0.08, torsoTurn * 0.12, 0, breathe, 0, 0);
  ctx.translate(0, -PLAYER_ATTACHMENTS.chest[1]);
  chestArmor(ctx, outfit.chest, outfit.chest ? gear : color, bodyAngle, bulk, skin);
  if (outfit.cloak && !back) {
    ctx.save(); const turn = torsoFacing(bodyAngle); ctx.translate(turn.surfaceOffset, 0); ctx.scale(turn.surface, 1);
    const trim = outfit.cloak.trim;
    line(ctx, [[-5.1, -26.3], [-2.5, -24.1], [2.2, -24.1], [5.1, -26.3]], color('#29363d'), 1.7);
    line(ctx, [[-5.1, -26.3], [-2.5, -24.1], [2.2, -24.1], [5.1, -26.3]], color(trim), .65);
    polygon(ctx, [[-5.8, -26.2], [-4.6, -27.5], [-3.5, -26.2], [-4.6, -24.9]], color(trim));
    polygon(ctx, [[3.6, -26.2], [4.8, -27.5], [6, -26.2], [4.8, -24.9]], color(trim));
    ctx.restore();
  }
  ctx.restore();
  if (back) cape();
  for (const layer of armLayers) if (layer.depth >= 0) layer.draw();
  const caps = [weaponArm, offArm].sort((a, b) => a.shoulder[1] - b.shoulder[1]);
  for (const arm of caps) {
    shoulderArmor(ctx, projectArmPoint(arm.shoulder), projectArmPoint(arm.elbow), outfit.shoulders, gear, bulk);
  }
  // Rare specular glint sweeping the nearer pauldron — a tiny star flash that
  // reads as polished metal catching the key light, never while moving fast.
  if (outfit.shoulders && moving < .4) {
    const glint = Math.pow(Math.max(0, Math.sin(pose.time * .55 + 1.3)), 24);
    if (glint > .02) {
      const cap = projectArmPoint(caps[caps.length - 1].shoulder);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = glint * .8;
      const gx = cap[0] + 2, gy = cap[1] - 4;
      line(ctx, [[gx - 3.4, gy], [gx + 3.4, gy]], '#fff6dc', .7);
      line(ctx, [[gx, gy - 3.4], [gx, gy + 3.4]], '#fff6dc', .7);
      line(ctx, [[gx - 1.8, gy - 1.8], [gx + 1.8, gy + 1.8]], gear(outfit.shoulders.material.trim), .5);
      line(ctx, [[gx - 1.8, gy + 1.8], [gx + 1.8, gy - 1.8]], gear(outfit.shoulders.material.trim), .5);
      ctx.restore();
    }
  }
  // The head seats on the torso's top edge: the chest plate crests at -28 in
  // body space and the collar hangs ~9.4 below the scaled head mount, so a
  // baseline drop of ~3.5 keeps the collar overlapping the shoulders on every
  // race. The hunch then cranes the head forward and down for stooped races,
  // and the neck counterbalances the moving torso. The head reads ~18% larger
  // with a warm rim arc so the silhouette separates from dark terrain.
  const headX = lean * -12 + Math.cos(pose.angle) * hunch * 7;
  const headY = -bob * 0.3 - leanDepth * 12 + 3.5 + hunch * (0.8 + Math.sin(pose.angle) * 1.6);
  ctx.save(); ctx.translate(headX, headY);
  ctx.scale(1.18, 1.18);
  headArmor(ctx, outfit.head, gear, pose.angle, appearance, pose.raceId, color);
  ctx.restore();
  ctx.save(); ctx.translate(headX, headY);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .3;
  ctx.strokeStyle = '#ffe9b8'; ctx.lineWidth = .9;
  ctx.beginPath(); ctx.arc(0, -31, 6.4, -Math.PI * .92, -Math.PI * .08); ctx.stroke();
  ctx.restore();
  const equipmentLayers = [
    ...(!weaponBehind ? [{ depth: weaponArm.hand[1], draw: mainWeapon }] : []),
    ...(pose.offHand && offArm.hand[1] >= 0 ? [{ depth: offArm.hand[1], draw: offEquipment }] : []),
  ];
  equipmentLayers.sort((a, b) => a.depth - b.depth).forEach(layer => layer.draw());
  if (cast > 0.05 && pose.weapon?.kind !== 'staff' && pose.weapon?.kind !== 'wand' && !bow && !pose.offHand && !pose.gesture) {
    const offHand = projectArmPoint(offArm.hand);
    ctx.save(); ctx.translate(offHand[0], offHand[1]); ctx.rotate(pose.time * 4.5);
    const radius = 1 + cast * 2.8;
    polygon(ctx, [[0, -radius], [radius, 0], [0, radius], [-radius, 0]], color(pose.castColor ?? '#c0acf0'));
    ctx.fillStyle = color('#fff5c0'); ctx.fillRect(-0.8, -0.8, 1.6, 1.6);
    ctx.restore();
  }
  ctx.restore();
  if (pose.form === 'shadow') ctx.restore();
  if (pose.stealthed) ctx.restore();
}
