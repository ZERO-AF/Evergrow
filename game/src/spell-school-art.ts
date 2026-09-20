import { drawGlow } from './lighting.ts';
import { clamp, hash, polygon, TAU } from './art-primitives.ts';
import { schoolOf, type School, type SchoolStyle } from './spell-school.ts';
export { castSchoolStyle } from './spell-school.ts';
export type { SchoolStyle } from './spell-school.ts';
/**
 * WoW school-flavored spell VFX (docs/wow-deepening.md §4 lineage). Maps each
 * damage school to a signature impact burst plus an ambient cast aura:
 *   holy      — golden radiant burst + light rays
 *   shadow    — purple-black void tendrils + soul wisps
 *   fire      — ember explosion + scorch ring
 *   frost     — ice shard shatter + frost nova ring
 *   lightning — forked arc + spark cascade
 *   nature    — green leaf/vine burst
 *   arcane    — violet rune circle + arcane missiles
 * 'physical'/'bleed' share a steel-and-blood slash; 'arrow' stays unstyled
 * (returns false) so the caller keeps the existing art, and 'spirit'/'radiant'
 * keep their own packs.
 *
 * Presentation only: pure functions, no state, no gameplay mutation. Every
 * flourish is a fixed-count loop (hard particle caps), deterministic from the
 * `time` argument, and freezes mid-pose under reducedMotion.
 */


/**
 * Resolves the school signature of a skill being cast: projectile recipes carry
 * `effects.style`, ground/chain/radial carry `style`, strike/channel/
 * comboStrike/runeStrike carry a WoW `school`, and pure DoTs fall back to their
 * dot school. Returns null when the skill has no school signature.
 */


interface SchoolPalette { core: string; hot: string; deep: string; glow: string; }
const PALETTES: Readonly<Record<School, SchoolPalette>> = Object.freeze({
  holy:      { core: '#ffd76e', hot: '#fff7d4', deep: '#c98f2e', glow: '#ffd76e' },
  shadow:    { core: '#8a6fb8', hot: '#d9c6ff', deep: '#150b24', glow: '#7a5fb0' },
  fire:      { core: '#ff803c', hot: '#ffe9b0', deep: '#3a1c10', glow: '#ff9a4e' },
  frost:     { core: '#8ee7ff', hot: '#eaffff', deep: '#2a6a8a', glow: '#8ee7ff' },
  lightning: { core: '#b7afff', hot: '#f4f2ff', deep: '#4a3f9a', glow: '#b7afff' },
  nature:    { core: '#7fd06a', hot: '#d8ffb0', deep: '#2e5a26', glow: '#7fd06a' },
  arcane:    { core: '#a894ec', hot: '#e9ddff', deep: '#3a2a6e', glow: '#a894ec' },
  physical:  { core: '#c8ccd4', hot: '#f4f7fb', deep: '#4a4f58', glow: '#d8dde6' },
});

/** Seconds a school impact burst takes to fully expand and fade. */
export const SCHOOL_IMPACT_DURATION = .5;
const CAP = { rays: 10, tendrils: 6, wisps: 5, embers: 12, shards: 8, bolts: 4, sparks: 10, leaves: 8, runes: 6, missiles: 5, motes: 6, drops: 9 };

/** Deterministic per-particle jitter in [0,1); no allocation, no Math.random. */
function unit(index: number, salt: number): number {
  return hash((index + 1) * 2654435761 + salt * 40503) / 4294967296;
}

/** Particle count honoring caps, intensity, and reduced-motion halving. */
function count(base: number, intensity: number, reducedMotion: boolean): number {
  return Math.max(1, Math.round(base * Math.min(1.4, intensity) * (reducedMotion ? .5 : 1)));
}

/**
 * One-shot school impact burst, drawn in the emission pass. `time` is the
 * impact's age in seconds (0 = contact); `intensity` scales the flourish
 * (1 = normal hit, ~1.3 kills, ~.8 player-hurt). Returns false for unstyled
 * schools so the caller falls back to the generic impact star.
 */
export function drawSchoolImpact(c: CanvasRenderingContext2D, x: number, y: number,
  style: SchoolStyle, time: number, intensity = 1, reducedMotion = false): boolean {
  const school = schoolOf(style);
  if (!school) return false;
  const pal = PALETTES[school];
  const p = clamp(time / SCHOOL_IMPACT_DURATION);
  const pm = reducedMotion ? .45 : p;         // motion pose freezes; fade stays real
  const fade = 1 - p;
  if (fade <= 0) return true;
  const k = clamp(intensity, .25, 2);
  const ease = 1 - (1 - pm) * (1 - pm);       // ease-out expansion

  c.save();
  c.translate(x, y);
  switch (school) {
    case 'holy': {
      c.globalCompositeOperation = 'lighter';
      drawGlow(c, 0, 0, (30 + 26 * ease) * k, pal.glow, .5 * fade);
      // Radiant core: hot center collapsing as the burst expands.
      c.globalAlpha = fade;
      c.fillStyle = pm < .3 ? pal.hot : pal.core;
      c.beginPath(); c.arc(0, 0, (11 - 5 * pm) * k, 0, TAU); c.fill();
      // Light rays: tapered shafts rotating slowly outward.
      const rays = count(CAP.rays, intensity, reducedMotion);
      c.fillStyle = pal.core;
      for (let i = 0; i < rays; i++) {
        const a = i * TAU / rays + pm * .5 + unit(i, 1) * .3;
        const len = (24 + unit(i, 2) * 24) * k * (.3 + ease);
        const w = (2.6 + unit(i, 3) * 1.6) * fade;
        c.save(); c.rotate(a);
        c.globalAlpha = fade * (.5 + unit(i, 4) * .5);
        polygon(c, [[7, -w], [len, 0], [7, w]], i % 3 === 0 ? pal.hot : pal.core);
        c.restore();
      }
      // Ground halo ring.
      c.globalAlpha = .7 * fade;
      c.strokeStyle = pal.core; c.lineWidth = 1.6 * fade + .4;
      c.beginPath(); c.ellipse(0, 12, (14 + 46 * ease) * k, (6 + 19 * ease) * k, 0, 0, TAU); c.stroke();
      // Rising motes.
      const motes = count(CAP.motes, intensity, reducedMotion);
      for (let i = 0; i < motes; i++) {
        const mx = (unit(i, 5) - .5) * 44 * ease * k;
        const my = -pm * (26 + unit(i, 6) * 22) * k;
        c.globalAlpha = fade * .8;
        c.fillStyle = i % 2 ? pal.hot : pal.core;
        c.fillRect(mx - 1, my - 1, 2, 2);
      }
      break;
    }
    case 'shadow': {
      // Void core: a dark disc that collapses — drawn source-over so it reads black.
      c.globalAlpha = .55 * fade;
      c.fillStyle = pal.deep;
      c.beginPath(); c.arc(0, 0, (20 - 9 * pm) * k, 0, TAU); c.fill();
      c.globalCompositeOperation = 'lighter';
      drawGlow(c, 0, 0, (26 + 14 * ease) * k, pal.glow, .35 * fade);
      // Void tendrils: wavy strokes reaching out then curling.
      const tendrils = count(CAP.tendrils, intensity, reducedMotion);
      c.strokeStyle = pal.core; c.lineCap = 'round';
      for (let i = 0; i < tendrils; i++) {
        const a = i * TAU / tendrils + unit(i, 7) * .7;
        const reach = (18 + unit(i, 8) * 22) * k * (.25 + ease);
        const wob = Math.sin(pm * 9 + i * 2.1) * .5;
        const mx = Math.cos(a + wob * .6) * reach * .55, my = Math.sin(a + wob * .6) * reach * .55 - 4;
        const ex = Math.cos(a + wob) * reach, ey = Math.sin(a + wob) * reach - 8 * pm;
        c.globalAlpha = fade * (.45 + unit(i, 9) * .4);
        c.lineWidth = (2.4 - pm * 1.4) * (0.8 + unit(i, 10) * .5);
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
      }
      // Soul wisps: pale spirits drifting upward with a sinusoidal sway.
      const wisps = count(CAP.wisps, intensity, reducedMotion);
      for (let i = 0; i < wisps; i++) {
        const wx = (unit(i, 11) - .5) * 30 * k + Math.sin(pm * 6 + i * 2.4) * 5;
        const wy = -pm * (30 + unit(i, 12) * 26) * k - 6;
        const wr = (2.6 - pm * 1.2) * (0.7 + unit(i, 13) * .6);
        c.globalAlpha = fade * .8;
        c.fillStyle = i % 2 ? pal.hot : pal.core;
        c.beginPath(); c.arc(wx, wy, Math.max(.6, wr), 0, TAU); c.fill();
        c.globalAlpha = fade * .35;
        c.beginPath(); c.arc(wx, wy + wr * 1.6, Math.max(.4, wr * .5), 0, TAU); c.fill();
      }
      // Imploding rim: ring contracts into the void.
      c.globalAlpha = .5 * fade;
      c.strokeStyle = pal.core; c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(0, 0, (34 - 20 * ease) * k, (34 - 20 * ease) * .7 * k, 0, 0, TAU); c.stroke();
      break;
    }
    case 'fire': {
      // Scorch ring: dark ground scar under the blast — source-over so it chars.
      c.globalAlpha = .5 * fade;
      c.strokeStyle = pal.deep; c.lineWidth = 3.2;
      c.beginPath(); c.ellipse(0, 10, (8 + 40 * ease) * k, (3.5 + 17 * ease) * k, 0, 0, TAU); c.stroke();
      c.globalCompositeOperation = 'lighter';
      drawGlow(c, 0, 0, (34 + 24 * ease) * k, pal.glow, .6 * fade);
      c.globalAlpha = fade;
      c.fillStyle = pm < .25 ? pal.hot : pal.core;
      c.beginPath(); c.arc(0, 0, (13 - 6 * pm) * k, 0, TAU); c.fill();
      // Ember explosion: hot particles flung outward with a slight rise.
      const embers = count(CAP.embers, intensity, reducedMotion);
      for (let i = 0; i < embers; i++) {
        const a = i * TAU / embers + unit(i, 14) * .6;
        const dist = (10 + unit(i, 15) * 34) * k * ease;
        const ex = Math.cos(a) * dist, ey = Math.sin(a) * dist * .8 - pm * (6 + unit(i, 16) * 10);
        const s = (2.6 * (1 - pm) + .8) * (0.7 + unit(i, 17) * .6);
        c.globalAlpha = fade * (.55 + unit(i, 18) * .45);
        c.fillStyle = i % 3 === 0 ? '#ffd674' : i % 3 === 1 ? pal.hot : pal.core;
        c.fillRect(ex - s / 2, ey - s / 2, s, s);
      }
      // Bright rim over the scorch.
      c.globalAlpha = .65 * fade;
      c.strokeStyle = pal.core; c.lineWidth = 1.5 * fade + .4;
      c.beginPath(); c.ellipse(0, 10, (8 + 40 * ease) * k, (3.5 + 17 * ease) * k, 0, 0, TAU); c.stroke();
      break;
    }
    case 'frost': {
      c.globalCompositeOperation = 'lighter';
      // Frost patch on the ground.
      c.globalAlpha = .2 * fade;
      c.fillStyle = '#bff0ff';
      c.beginPath(); c.ellipse(0, 10, 30 * k * ease + 6, 12 * k * ease + 3, 0, 0, TAU); c.fill();
      drawGlow(c, 0, 0, (26 + 20 * ease) * k, pal.glow, .5 * fade);
      // Frost nova ring: double ellipse racing outward.
      c.globalAlpha = .8 * fade;
      c.strokeStyle = pal.core; c.lineWidth = 2.4 * fade + .5;
      c.beginPath(); c.ellipse(0, 8, (6 + 52 * ease) * k, (2.5 + 22 * ease) * k, 0, 0, TAU); c.stroke();
      c.globalAlpha = .55 * fade;
      c.strokeStyle = pal.hot; c.lineWidth = 1;
      c.beginPath(); c.ellipse(0, 8, (4 + 40 * ease) * k, (2 + 17 * ease) * k, 0, 0, TAU); c.stroke();
      // Ice shard shatter: spinning crystal splinters.
      const shards = count(CAP.shards, intensity, reducedMotion);
      for (let i = 0; i < shards; i++) {
        const a = i * TAU / shards + unit(i, 19) * .5;
        const dist = (8 + unit(i, 20) * 36) * k * ease;
        const sx = Math.cos(a) * dist, sy = Math.sin(a) * dist * .75 - pm * (4 + unit(i, 21) * 12);
        const s = (4.5 + unit(i, 22) * 4) * (1 - pm * .5) * k;
        const rot = a + pm * (2 + unit(i, 23) * 4);
        const ca = Math.cos(rot), sa = Math.sin(rot);
        c.globalAlpha = fade * (.6 + unit(i, 24) * .4);
        polygon(c, [
          [sx + ca * s, sy + sa * s],
          [sx - sa * s * .4 - ca * s * .3, sy + ca * s * .4 - sa * s * .3],
          [sx - ca * s * .55, sy - sa * s * .55],
          [sx + sa * s * .4 - ca * s * .2, sy - ca * s * .4 - sa * s * .2],
        ], i % 3 === 0 ? pal.hot : i % 3 === 1 ? pal.core : '#5fb8e8');
      }
      // Sparkle motes.
      for (let i = 0; i < 4; i++) {
        c.globalAlpha = fade * .7;
        c.fillStyle = pal.hot;
        c.fillRect((unit(i, 25) - .5) * 40 * ease * k, -pm * (14 + unit(i, 26) * 18) * k, 1.4, 1.4);
      }
      break;
    }
    case 'lightning': {
      c.globalCompositeOperation = 'lighter';
      drawGlow(c, 0, 0, (30 + 18 * ease) * k, pal.glow, .55 * fade);
      c.globalAlpha = fade;
      c.fillStyle = pal.hot;
      c.beginPath(); c.arc(0, 0, (8 * (1 - pm) + 3) * k, 0, TAU); c.fill();
      // Forked arcs: jagged bolts with one branch each.
      const bolts = count(CAP.bolts, intensity, reducedMotion);
      for (let i = 0; i < bolts; i++) {
        const a = i * TAU / bolts + unit(i, 27) * .8;
        const len = (28 + unit(i, 28) * 26) * k * (.3 + ease);
        const dx = Math.cos(a), dy = Math.sin(a);
        const px = -dy, py = dx; // perpendicular jitter axis
        const j1 = (unit(i, 29) - .5) * 11, j2 = (unit(i, 30) - .5) * 11, j3 = (unit(i, 31) - .5) * 8;
        const m1x = dx * len * .33 + px * j1, m1y = dy * len * .33 + py * j1;
        const m2x = dx * len * .66 + px * j2, m2y = dy * len * .66 + py * j2;
        const ex = dx * len + px * j3, ey = dy * len + py * j3;
        for (const pass of [[pal.hot, 1.7], [pal.core, .8]] as const) {
          c.globalAlpha = fade * (pass[1] > 1 ? .85 : .6);
          c.strokeStyle = pass[0]; c.lineWidth = pass[1] * fade + .3;
          c.beginPath(); c.moveTo(0, 0); c.lineTo(m1x, m1y); c.lineTo(m2x, m2y); c.lineTo(ex, ey); c.stroke();
        }
        // Branch off the second joint.
        const ba = a + (unit(i, 32) > .5 ? .7 : -.7);
        c.globalAlpha = fade * .5;
        c.strokeStyle = pal.core; c.lineWidth = .8;
        c.beginPath(); c.moveTo(m2x, m2y);
        c.lineTo(m2x + Math.cos(ba) * len * .3 + px * j1 * .4, m2y + Math.sin(ba) * len * .3 + py * j1 * .4);
        c.stroke();
      }
      // Spark cascade: particles arcing up then raining down.
      const sparks = count(CAP.sparks, intensity, reducedMotion);
      for (let i = 0; i < sparks; i++) {
        const sx = (unit(i, 33) - .5) * 52 * k * ease;
        const sy = -pm * (18 + unit(i, 34) * 14) * k + pm * pm * 34 * k;
        c.globalAlpha = fade * (.5 + unit(i, 35) * .5);
        c.fillStyle = i % 2 ? pal.hot : pal.core;
        const s = 1.2 + unit(i, 36) * 1.2;
        c.fillRect(sx - s / 2, sy - s / 2, s, s);
      }
      break;
    }
    case 'nature': {
      // Vine ring: green ground swell.
      c.globalAlpha = .55 * fade;
      c.strokeStyle = '#5d8a4a'; c.lineWidth = 2 * fade + .4;
      c.beginPath(); c.ellipse(0, 10, (10 + 38 * ease) * k, (4 + 16 * ease) * k, 0, 0, TAU); c.stroke();
      // Ground tendrils: short arcs curling out of the ring.
      c.strokeStyle = pal.deep; c.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3 + .6;
        const r = (12 + 30 * ease) * k;
        c.globalAlpha = fade * .45;
        c.beginPath(); c.ellipse(0, 10, r, r * .42, 0, a, a + .9); c.stroke();
      }
      c.globalCompositeOperation = 'lighter';
      drawGlow(c, 0, 0, (24 + 16 * ease) * k, pal.glow, .4 * fade);
      // Leaf burst: diamond leaves spiraling outward.
      const leaves = count(CAP.leaves, intensity, reducedMotion);
      for (let i = 0; i < leaves; i++) {
        const a = i * TAU / leaves + pm * 2.2 + unit(i, 37) * .4;
        const dist = (6 + unit(i, 38) * 28) * k * ease;
        const lx = Math.cos(a) * dist, ly = Math.sin(a) * dist * .8 - pm * (8 + unit(i, 39) * 14);
        const s = (3.4 + unit(i, 40) * 2.4) * (1 - pm * .4);
        const rot = a + pm * 5;
        const ca = Math.cos(rot), sa = Math.sin(rot);
        c.globalAlpha = fade * (.6 + unit(i, 41) * .4);
        polygon(c, [
          [lx + ca * s, ly + sa * s],
          [lx - sa * s * .45, ly + ca * s * .45],
          [lx - ca * s, ly - sa * s],
          [lx + sa * s * .45, ly - ca * s * .45],
        ], i % 3 === 0 ? '#9fe870' : i % 3 === 1 ? pal.core : '#4e9a3f');
      }
      // Pollen motes drifting up.
      for (let i = 0; i < 5; i++) {
        c.globalAlpha = fade * .7;
        c.fillStyle = pal.hot;
        c.fillRect((unit(i, 42) - .5) * 36 * ease * k, -pm * (20 + unit(i, 43) * 20) * k, 1.5, 1.5);
      }
      break;
    }
    case 'arcane': {
      c.globalCompositeOperation = 'lighter';
      drawGlow(c, 0, 0, (28 + 18 * ease) * k, pal.glow, .5 * fade);
      c.globalAlpha = fade;
      c.fillStyle = pal.hot;
      c.beginPath(); c.arc(0, 0, (9 * (1 - pm) + 2) * k, 0, TAU); c.fill();
      // Rune circle: expanding ring with rotating glyph ticks.
      const rr = (12 + 30 * ease) * k;
      c.globalAlpha = .75 * fade;
      c.strokeStyle = pal.core; c.lineWidth = 1.4 * fade + .3;
      c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.stroke();
      c.globalAlpha = .45 * fade;
      c.lineWidth = .8;
      c.beginPath(); c.arc(0, 0, rr * .55, 0, TAU); c.stroke();
      const runes = count(CAP.runes, intensity, reducedMotion);
      c.strokeStyle = pal.hot; c.lineWidth = 1.1;
      for (let i = 0; i < runes; i++) {
        const a = i * TAU / runes + pm * 1.5;
        const rx = Math.cos(a) * rr, ry = Math.sin(a) * rr;
        const tx = Math.cos(a + .22) * rr, ty = Math.sin(a + .22) * rr;
        c.globalAlpha = fade * .8;
        c.beginPath(); c.moveTo(rx, ry); c.lineTo(tx, ty); c.stroke();
        c.beginPath(); c.moveTo(rx * .82, ry * .82); c.lineTo(rx, ry); c.stroke();
      }
      // Arcane missiles: darts with short trails spiraling out.
      const missiles = count(CAP.missiles, intensity, reducedMotion);
      for (let i = 0; i < missiles; i++) {
        const a = i * TAU / missiles + .4 + pm * 1.1;
        const dist = (4 + 34 * ease) * k;
        const mx = Math.cos(a) * dist, my = Math.sin(a) * dist * .85 - pm * 6;
        const tail = 9 * (1 - pm * .5);
        const tx = Math.cos(a) * (dist - tail), ty = Math.sin(a) * (dist - tail) * .85 - pm * 6;
        c.globalAlpha = fade * .55;
        c.strokeStyle = pal.core; c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(tx, ty); c.lineTo(mx, my); c.stroke();
        c.globalAlpha = fade * .9;
        const ha = a + Math.PI / 2;
        polygon(c, [
          [mx + Math.cos(a) * 3.4, my + Math.sin(a) * 3.4],
          [mx + Math.cos(ha) * 1.8, my + Math.sin(ha) * 1.8],
          [mx - Math.cos(ha) * 1.8, my - Math.sin(ha) * 1.8],
        ], pal.hot);
      }
      break;
    }
    case 'physical': {
      // Steel flash: a hot core collapsing fast, then paired slash arcs sweeping
      // outward and a spray of blood droplets — WotLK warrior/rogue contact.
      c.globalCompositeOperation = 'lighter';
      drawGlow(c, 0, 0, (22 + 14 * ease) * k, pal.glow, .4 * fade);
      c.globalAlpha = fade;
      c.fillStyle = pm < .3 ? pal.hot : pal.core;
      c.beginPath(); c.arc(0, 0, (9 - 4 * pm) * k, 0, TAU); c.fill();
      for (let i = 0; i < 2; i++) {
        const a = i * Math.PI + unit(i, 49) * .7 + pm * .9;
        const r = (10 + 26 * ease) * k;
        c.globalAlpha = fade * (.65 - i * .2);
        c.strokeStyle = i ? pal.core : pal.hot; c.lineWidth = (2.2 - i * .8) * fade + .4;
        c.beginPath(); c.ellipse(0, 0, r, r * .62, a, -.5, .9); c.stroke();
      }
      // Blood spray: droplets flung outward, arcing down.
      const drops = count(CAP.drops, intensity, reducedMotion);
      for (let i = 0; i < drops; i++) {
        const a = i * TAU / drops + unit(i, 50) * .8;
        const dist = (6 + unit(i, 51) * 30) * k * ease;
        const dx = Math.cos(a) * dist, dy = Math.sin(a) * dist * .7 - pm * (4 + unit(i, 52) * 10) + pm * pm * 16 * k;
        const s = (1.4 + unit(i, 53) * 1.6) * (1 - pm * .4);
        c.globalAlpha = fade * (.5 + unit(i, 54) * .4);
        c.fillStyle = i % 3 === 0 ? '#e05a4a' : '#a8322e';
        c.fillRect(dx - s / 2, dy - s / 2, s, s);
      }
      // Ground scuff: a short dark scrape under the contact.
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = .4 * fade;
      c.strokeStyle = pal.deep; c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(0, 9, (6 + 22 * ease) * k, (2.5 + 9 * ease) * k, 0, 0, TAU); c.stroke();
      break;
    }
  }
  c.restore();
  return true;
}

/**
 * Ambient school aura for the cast path — a looping, low-key signature drawn
 * at the caster's hands (or under a projectile for a school trail). `time` is
 * the absolute clock; the aura cycles deterministically from it. `scale`
 * shrinks the flourish for projectile trails (~.6). Returns false for
 * unstyled schools so callers can skip the call entirely.
 */
export function schoolCastAura(c: CanvasRenderingContext2D, x: number, y: number,
  style: SchoolStyle, time: number, scale = 1, reducedMotion = false): boolean {
  const school = schoolOf(style);
  if (!school) return false;
  const pal = PALETTES[school];
  const t = reducedMotion ? 0 : time;
  const k = scale;

  c.save();
  c.translate(x, y);
  switch (school) {
    case 'holy': {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = .22 + Math.sin(t * 3) * .08;
      c.strokeStyle = pal.core; c.lineWidth = 1.2;
      c.beginPath(); c.ellipse(0, 8, 20 * k, 8 * k, 0, 0, TAU); c.stroke();
      drawGlow(c, 0, -6, 16 * k, pal.glow, .16 + Math.sin(t * 3.7) * .05);
      for (let i = 0; i < 4; i++) {
        const cy = (t * .35 + i * .25) % 1;
        c.globalAlpha = Math.sin(cy * Math.PI) * .6;
        c.fillStyle = i % 2 ? pal.hot : pal.core;
        c.fillRect((unit(i, 44) - .5) * 22 * k, -cy * 34 * k - 4, 1.6, 1.6);
      }
      break;
    }
    case 'shadow': {
      // Dark tinge under the wisps — source-over so it reads as void.
      c.globalAlpha = .2;
      c.fillStyle = pal.deep;
      c.beginPath(); c.ellipse(0, 8, 18 * k, 7 * k, 0, 0, TAU); c.fill();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const a = t * 1.4 + i * TAU / 3;
        const r = (15 + Math.sin(t * 2 + i * 2.1) * 3) * k;
        const wx = Math.cos(a) * r, wy = Math.sin(a) * r * .5 - 8;
        c.globalAlpha = .5;
        c.fillStyle = pal.core;
        c.beginPath(); c.arc(wx, wy, 2, 0, TAU); c.fill();
        c.globalAlpha = .3;
        c.fillStyle = pal.hot;
        c.beginPath(); c.arc(wx, wy - 2.4, 1.1, 0, TAU); c.fill();
      }
      drawGlow(c, 0, -6, 14 * k, pal.glow, .14);
      break;
    }
    case 'fire': {
      c.globalCompositeOperation = 'lighter';
      drawGlow(c, 0, -4, 17 * k, pal.glow, .18 + Math.sin(t * 7) * .06);
      for (let i = 0; i < 5; i++) {
        const cy = (t * .5 + i * .2) % 1;
        c.globalAlpha = Math.sin(cy * Math.PI) * .65;
        c.fillStyle = i % 3 === 0 ? '#ffd674' : pal.core;
        const s = 1.8 - cy;
        c.fillRect((unit(i, 45) - .5) * 20 * k + Math.sin(t * 4 + i) * 2, -cy * 30 * k - 2, s, s);
      }
      break;
    }
    case 'frost': {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = .2;
      c.strokeStyle = pal.core; c.lineWidth = 1;
      c.beginPath(); c.ellipse(0, 8, 18 * k, 7 * k, 0, 0, TAU); c.stroke();
      drawGlow(c, 0, -4, 14 * k, pal.glow, .15);
      for (let i = 0; i < 4; i++) {
        const a = t * .9 + i * TAU / 4;
        const cx = Math.cos(a) * 17 * k, cy = Math.sin(a) * 8 * k - 6;
        const s = 2.2;
        c.globalAlpha = .55;
        polygon(c, [[cx, cy - s], [cx + s * .6, cy], [cx, cy + s], [cx - s * .6, cy]], i % 2 ? pal.hot : pal.core);
      }
      break;
    }
    case 'lightning': {
      c.globalCompositeOperation = 'lighter';
      drawGlow(c, 0, -4, 15 * k, pal.glow, .15);
      // Flicker arcs: each bolt only shows inside its short cycle window.
      for (let i = 0; i < 2; i++) {
        const phase = (t * 2.4 + i * .5) % 1;
        if (phase >= .3) continue;
        const a = unit(i, 46) * TAU + i * 2.4;
        const len = 16 * k;
        const dx = Math.cos(a), dy = Math.sin(a);
        const j = (unit(i, 47) - .5) * 8;
        c.globalAlpha = .55 * (1 - phase / .3);
        c.strokeStyle = pal.hot; c.lineWidth = 1;
        c.beginPath(); c.moveTo(0, -4);
        c.lineTo(dx * len * .5 - dy * j * .5, -4 + dy * len * .5 + dx * j * .5);
        c.lineTo(dx * len - dy * j * .3, -4 + dy * len + dx * j * .3);
        c.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const a = t * 3 + i * TAU / 3;
        c.globalAlpha = .5;
        c.fillStyle = pal.core;
        c.fillRect(Math.cos(a) * 15 * k - .8, Math.sin(a) * 7 * k - 6.8, 1.6, 1.6);
      }
      break;
    }
    case 'nature': {
      c.globalAlpha = .18;
      c.fillStyle = pal.deep;
      c.beginPath(); c.ellipse(0, 8, 17 * k, 7 * k, 0, 0, TAU); c.fill();
      c.globalCompositeOperation = 'lighter';
      drawGlow(c, 0, -4, 14 * k, pal.glow, .14);
      for (let i = 0; i < 3; i++) {
        const a = t * 1.1 + i * TAU / 3;
        const lx = Math.cos(a) * 15 * k, ly = Math.sin(a) * 7 * k - 7;
        const s = 2.6, rot = a + t;
        const ca = Math.cos(rot), sa = Math.sin(rot);
        c.globalAlpha = .55;
        polygon(c, [
          [lx + ca * s, ly + sa * s], [lx - sa * s * .45, ly + ca * s * .45],
          [lx - ca * s, ly - sa * s], [lx + sa * s * .45, ly - ca * s * .45],
        ], i % 2 ? '#9fe870' : pal.core);
      }
      for (let i = 0; i < 2; i++) {
        const cy = (t * .3 + i * .5) % 1;
        c.globalAlpha = Math.sin(cy * Math.PI) * .5;
        c.fillStyle = pal.hot;
        c.fillRect((unit(i, 48) - .5) * 18 * k, -cy * 24 * k - 4, 1.4, 1.4);
      }
      break;
    }
    case 'arcane': {
      c.globalCompositeOperation = 'lighter';
      drawGlow(c, 0, -4, 16 * k, pal.glow, .16);
      const rr = 16 * k;
      c.globalAlpha = .4;
      c.strokeStyle = pal.core; c.lineWidth = 1;
      c.beginPath(); c.arc(0, -4, rr, 0, TAU); c.stroke();
      for (let i = 0; i < 6; i++) {
        const a = t * .8 + i * TAU / 6;
        const rx = Math.cos(a) * rr, ry = Math.sin(a) * rr - 4;
        c.globalAlpha = .6;
        c.strokeStyle = pal.hot; c.lineWidth = .9;
        c.beginPath(); c.moveTo(rx * .8, (ry + 4) * .8 - 4); c.lineTo(rx, ry); c.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const a = -t * 1.6 + i * TAU / 3;
        c.globalAlpha = .55;
        c.fillStyle = pal.hot;
        c.fillRect(Math.cos(a) * rr * .6 - .8, Math.sin(a) * rr * .6 - 4.8, 1.6, 1.6);
      }
      break;
    }
    case 'physical': {
      // Steel glint: two sparks orbiting the weapon with a faint ready ring.
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = .14;
      c.strokeStyle = pal.core; c.lineWidth = 1;
      c.beginPath(); c.ellipse(0, 6, 15 * k, 6 * k, 0, 0, TAU); c.stroke();
      drawGlow(c, 0, -4, 11 * k, pal.glow, .1);
      for (let i = 0; i < 2; i++) {
        const a = t * 2.6 + i * Math.PI;
        c.globalAlpha = .5;
        c.fillStyle = i ? pal.core : pal.hot;
        c.fillRect(Math.cos(a) * 13 * k - .8, Math.sin(a) * 6 * k - 5.8, 1.6, 1.6);
      }
      break;
    }
  }
  c.restore();
  return true;
}
