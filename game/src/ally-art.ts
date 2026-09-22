import { drawGlow } from './lighting.ts';
import { clamp, mixColor, polygon, taper, TAU, type Point } from './art-primitives.ts';
import type { Ally } from './model.ts';
import type { AllyKind } from './wow-types.ts';
import { ALLY_TEMPLATES } from './wow-allies.ts';
/**
 * Summoned-ally silhouettes (docs/wow-deepening.md §2 lineage). Every pet,
 * minion and totem is a small readable figure tinted by its template color
 * with a school accent: demons burn, shadow summons smolder violet, beasts
 * stay earthy, elementals and totems glow with their element. Each hunter
 * pet family owns a distinct silhouette — spider skitters on eight legs,
 * turtle carries a dome, scorpid raises a stinger, raptor runs bipedal,
 * birds and wind serpents fly on wings and coils.
 *
 * Presentation only: pure functions, no state, no gameplay mutation. Motion
 * derives from the interpolated position delta and the absolute clock, so the
 * art freezes under reducedMotion and never allocates per frame.
 */

type AllyShape = 'quadruped' | 'imp' | 'brute' | 'floater' | 'elemental' | 'humanoid' | 'totem'
  | 'boar' | 'spider' | 'turtle' | 'scorpid' | 'raptor' | 'bird' | 'serpent' | 'treant' | 'gargoyle' | 'fiend';

/** Quadruped proportion overrides; omitted fields draw the baseline wolf body. */
export interface QuadArt {
  /** Leg length and stance multiplier. */
  leg?: number;
  /** Torso width multiplier. */
  bulk?: number;
  /** Tail length in units; 0 hides it. */
  tail?: number;
  /** Ear spike height; 0 hides ears. */
  ear?: number;
  /** Snout length multiplier. */
  snout?: number;
  /** Extra head lift. */
  head?: number;
  /** Dorsal spikes along the spine (felhunter). */
  spikes?: boolean;
}

/** Large biped extras: swept horns, bat wings, flame mantle, rock plates. */
export interface BruteArt {
  horns?: boolean; wings?: boolean; flames?: boolean; plates?: boolean;
}

/**
 * Ground-plane quadruped (wolf baseline) at local (0,0), facing `angle`.
 * Shared by summoned allies and player shapeshift forms; pure drawing, no state.
 */
export function drawQuadruped(c: CanvasRenderingContext2D, angle: number, gait: number, moving: number,
  time: number, tint: string, dark: string, accent: string, art: QuadArt = {}, bob = 0, lunge = 0, seed = 0): void {
  const forward = [Math.cos(angle), Math.sin(angle) * .55] as const;
  const across = [-Math.sin(angle), Math.cos(angle) * .55] as const;
  const at = (px: number, py: number, z: number): Point =>
    [forward[0] * px + across[0] * py, forward[1] * px + across[1] * py - z];
  const poly = (points: readonly (readonly [number, number, number])[], fill: string) =>
    polygon(c, points.map(q => at(...q)), fill);
  const leg = art.leg ?? 1, bulk = art.bulk ?? 1, tail = art.tail ?? 5, ear = art.ear ?? 2.4, snout = art.snout ?? 1;
  const step = Math.sin(gait) * moving * 2.6;
  const lift = Math.abs(Math.cos(gait)) * moving * 1.4;
  const body = 9 * leg + bob * .4 + lunge * 2;
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    const stride = step * (end === side ? -1 : 1);
    taper(c, at(end * 4.5, side * 2.4 * bulk, body), at(end * 5 + stride, side * 3 * bulk, lift * (end === side ? 1 : .4)), 2.4 * bulk, 1.4 * bulk, dark);
  }
  if (tail > 0)
    taper(c, at(-7 * bulk, 0, body + 1), at(-7 * bulk - tail, .6, body + 4 + Math.sin(time * 4 + seed) * 1.2), 1.6, .7, dark);
  if (art.spikes) for (const sx of [-4, 0, 4])
    poly([[sx - 1.4, -1, body + 3.6], [sx, -1, body + 7], [sx + 1.4, -1, body + 3.4]], dark);
  poly([[-8 * bulk, -2.6 * bulk, body + 2.4], [5 * bulk, -2.6 * bulk, body + 3], [8 * bulk, 0, body + 1.6], [5 * bulk, 2.6 * bulk, body + 1], [-6 * bulk, 2.6 * bulk, body]], tint);
  poly([[-6 * bulk, -2 * bulk, body + 3.4], [4 * bulk, -2 * bulk, body + 4], [6.4 * bulk, 0, body + 2.6], [-4 * bulk, 1.6 * bulk, body + 1.6]], dark);
  const head = body + 2 + (art.head ?? 0) + lunge * 2;
  const nose = 6 + 6.6 * snout;
  poly([[6, -2.2, head + 1], [9, -1.6, head + 3.4], [nose, -1, head + 1.4], [nose, 1, head + 1], [9, 2.4, head - .4], [6.4, 1.8, head - .8]], tint);
  if (ear > 0) {
    poly([[7.4, -1.8, head + 3], [8.6, -2.2, head + 3 + ear], [9.8, -1.6, head + 3.2]], dark);
    poly([[7.4, 1.8, head + 3], [8.6, 2.2, head + 3 + ear], [9.8, 1.6, head + 3.2]], dark);
  }
  const eye = at(4 + 6.4 * snout, -1.2, head + 1.6);
  c.fillStyle = accent;
  c.fillRect(eye[0] - .7, eye[1] - .7, 1.4, 1.4);
}

/**
 * Billboard biped brute (felguard/infernal baseline) at local (0,0): legs, arms,
 * torso, head plus optional horns/wings/flames/plates. Shared by summoned allies
 * and the metamorphosis form; pure drawing, no state.
 */
export function drawBrute(c: CanvasRenderingContext2D, gait: number, moving: number, time: number,
  tint: string, dark: string, accent: string, art: BruteArt = {}, lunge = 0, seed = 0): void {
  const sway = Math.sin(gait * .5) * moving * 1.2;
  for (const side of [-1, 1])
    taper(c, [side * 3.4, -8], [side * 4.4 + Math.sin(gait + side * Math.PI) * moving * 2.4, -1], 3.6, 2.4, dark);
  for (const side of [-1, 1])
    taper(c, [side * 6.4 + sway, -20], [side * (8.4 + lunge * 3) + sway, -9 - lunge * 3], 3.4, 2.2, dark);
  if (art.wings) for (const side of [-1, 1])
    polygon(c, [[side * 5 + sway, -22], [side * 15 + sway, -26 + Math.sin(time * 3 + seed) * 1.5], [side * 17 + sway, -16], [side * 9 + sway, -14]], dark);
  polygon(c, [[-7 + sway, -24], [7 + sway, -24], [8.6 + sway, -8], [-8.6 + sway, -8]], tint);
  polygon(c, [[-4.6 + sway, -23], [4.6 + sway, -23], [5.6 + sway, -10], [-5.6 + sway, -10]], dark);
  if (art.plates) for (const side of [-1, 1]) {
    polygon(c, [[side * 4 + sway, -25], [side * 10 + sway, -26], [side * 11 + sway, -19], [side * 5 + sway, -18]], dark);
    polygon(c, [[side * 5.5 + sway, -24], [side * 9 + sway, -24.6], [side * 9.6 + sway, -20], [side * 6 + sway, -19.6]], tint);
  } else for (const side of [-1, 1])
    polygon(c, [[side * 4.4 + sway, -24], [side * 8.4 + sway, -28.4], [side * 7 + sway, -22.4]], dark);
  polygon(c, [[-3 + sway, -30], [3 + sway, -30], [4 + sway, -23.4], [-4 + sway, -23.4]], tint);
  if (art.horns) for (const side of [-1, 1])
    polygon(c, [[side * 2.4 + sway, -29], [side * 6.5 + sway, -34], [side * 4.6 + sway, -27.6]], dark);
  if (art.flames) for (const side of [-1, 1]) {
    const flick = Math.sin(time * 9 + seed + side) * 1.2;
    polygon(c, [[side * 5 + sway, -24], [side * 7 + sway + flick, -31], [side * 8.6 + sway, -23]], accent);
  }
  c.fillStyle = accent;
  c.fillRect(-2 + sway, -27.4, 1.4, 1.4);
  c.fillRect(.8 + sway, -27.4, 1.4, 1.4);
}

/** Totem crown glyphs — the pulsing emblem at the pole's tip. */
type TotemCrown = 'flame' | 'ember' | 'bolt' | 'star' | 'drop' | 'wave' | 'rock'
  | 'spire' | 'orb' | 'gust' | 'rune' | 'quake' | 'shield' | 'horn';

interface AllyArt {
  shape: AllyShape; accent: string; glow?: number; spectral?: boolean;
  /** Quadruped proportions (shape 'quadruped'). */
  quad?: QuadArt;
  /** Dorsal spikes along the spine (felhunter). */
  spikes?: boolean;
  /** Brute extras: swept horns, bat wings, flame mantle, rock plates. */
  horns?: boolean; wings?: boolean; flames?: boolean; plates?: boolean;
  /** Hunched posture: head low and forward, arms reaching (ghoul). */
  hunched?: boolean;
  /** Totem crown glyph. */
  crown?: TotemCrown;
}

/** Per-kind silhouette + school accent; tint comes from ALLY_TEMPLATES. */
const ALLY_ART: Readonly<Record<AllyKind, AllyArt>> = Object.freeze({
  imp:            { shape: 'imp',       accent: '#ff9a4e', glow: .3 },
  felhunter:      { shape: 'quadruped', accent: '#b08ae0', glow: .18, quad: { tail: 6, ear: 0, snout: 1.1 }, spikes: true },
  felguard:       { shape: 'brute',     accent: '#b08ae0', glow: .22, horns: true },
  voidwalker:     { shape: 'floater',   accent: '#8a6fd0', glow: .28 },
  succubus:       { shape: 'humanoid',  accent: '#e08ac0', glow: .2, wings: true },
  doomguard:      { shape: 'brute',     accent: '#e05a6a', glow: .3, wings: true, horns: true },
  wolf:           { shape: 'quadruped', accent: '#8fd06a' },
  bear:           { shape: 'quadruped', accent: '#8fd06a', quad: { leg: .85, bulk: 1.4, tail: 1.5, ear: 1.4, snout: .85, head: .5 } },
  cat:            { shape: 'quadruped', accent: '#8fd06a', quad: { leg: 1.05, bulk: .75, tail: 7, ear: 2.8, snout: .8 } },
  boar:           { shape: 'boar',      accent: '#8fd06a' },
  raptor:         { shape: 'raptor',    accent: '#8fd06a' },
  spider:         { shape: 'spider',    accent: '#8fd06a' },
  bird:           { shape: 'bird',      accent: '#8fd06a' },
  windSerpent:    { shape: 'serpent',   accent: '#8fd06a', glow: .18 },
  scorpid:        { shape: 'scorpid',   accent: '#8fd06a' },
  turtle:         { shape: 'turtle',    accent: '#8fd06a' },
  ghoul:          { shape: 'humanoid',  accent: '#b08ae0', glow: .16, hunched: true },
  waterElemental: { shape: 'elemental', accent: '#8ee7ff', glow: .3 },
  earthElemental: { shape: 'brute',     accent: '#c8b06a', glow: .2, plates: true },
  fireElemental:  { shape: 'elemental', accent: '#ff9a4e', glow: .34, flames: true },
  mirrorImage:    { shape: 'humanoid',  accent: '#a894ec', glow: .24, spectral: true },
  treant:         { shape: 'treant',    accent: '#8fd06a' },
  shadowfiend:    { shape: 'fiend',     accent: '#a08ae0', glow: .24, spectral: true },
  gargoyle:       { shape: 'gargoyle',  accent: '#9ab8d0', glow: .2 },
  searingTotem:   { shape: 'totem',     accent: '#ff9a4e', glow: .3, crown: 'flame' },
  healingTotem:   { shape: 'totem',     accent: '#8ee7ff', glow: .26, crown: 'drop' },
  earthbindTotem: { shape: 'totem',     accent: '#8fd06a', glow: .2, crown: 'rock' },
  magmaTotem:     { shape: 'totem',     accent: '#ff6a3a', glow: .3, crown: 'ember' },
  manaSpringTotem:{ shape: 'totem',     accent: '#6a9aff', glow: .26, crown: 'wave' },
  totemOfWrath:   { shape: 'totem',     accent: '#ffc76a', glow: .3, crown: 'star' },
  wrathOfAirTotem:{ shape: 'totem',     accent: '#b8e8ff', glow: .26, crown: 'rune' },
  windfuryTotem:  { shape: 'totem',     accent: '#8fe0b8', glow: .26, crown: 'gust' },
  strengthOfEarthTotem: { shape: 'totem', accent: '#d0a86a', glow: .2, crown: 'orb' },
  stoneskinTotem: { shape: 'totem',     accent: '#b8b8a8', glow: .2, crown: 'spire' },
  flametongueTotem: { shape: 'totem',   accent: '#ffaa5a', glow: .3, crown: 'bolt' },
  tremorTotem:    { shape: 'totem',     accent: '#d0b88a', glow: .2, crown: 'quake' },
  cleansingTotem: { shape: 'totem',     accent: '#8ae0c8', glow: .26, crown: 'shield' },
  groundingTotem: { shape: 'totem',     accent: '#8aa8e0', glow: .26, crown: 'horn' },
  spiritWolf:     { shape: 'quadruped', accent: '#8ee7ff', glow: .26, spectral: true },
  infernal:       { shape: 'brute',     accent: '#ff9a4e', glow: .34, flames: true },
  // Dungeon Finder party: humanoid adventurers; the ally's `tint` carries the class color.
  partyTank:      { shape: 'humanoid',  accent: '#7ed9f2', glow: .22 },
  partyHealer:    { shape: 'humanoid',  accent: '#ffe8a0', glow: .26 },
  partyDps:       { shape: 'humanoid',  accent: '#c0acf0', glow: .2 },
});

/** Pulsing emblem at a totem's tip; local space, ~10 units across. */
function totemCrown(c: CanvasRenderingContext2D, crown: TotemCrown, accent: string, dark: string): void {
  switch (crown) {
    case 'flame':
      polygon(c, [[0, -5.5], [2.6, -1], [1.4, 2.4], [0, 4.5], [-1.4, 2.4], [-2.6, -1]], accent);
      polygon(c, [[0, -2], [1.2, .6], [0, 2.6], [-1.2, .6]], dark); break;
    case 'ember':
      for (const [x, y] of [[-2.6, 1], [0, -2.4], [2.6, 1]] as const) {
        c.fillStyle = accent; c.beginPath(); c.arc(x, y, 1.8, 0, TAU); c.fill();
      } break;
    case 'bolt':
      polygon(c, [[1.4, -5.5], [-2.8, .4], [-.6, .4], [-1.6, 5.5], [2.8, -1], [.4, -1]], accent); break;
    case 'star':
      polygon(c, [[0, -5.5], [1.5, -1.5], [5.5, 0], [1.5, 1.5], [0, 5.5], [-1.5, 1.5], [-5.5, 0], [-1.5, -1.5]], accent); break;
    case 'drop':
      polygon(c, [[0, -5.5], [2.8, -1], [2.8, 1.6], [0, 4.6], [-2.8, 1.6], [-2.8, -1]], accent); break;
    case 'wave':
      polygon(c, [[-5, .5], [-2.5, -2], [0, .5], [2.5, -2], [5, .5], [5, 3], [2.5, 5], [0, 3], [-2.5, 5], [-5, 3]], accent); break;
    case 'rock':
      polygon(c, [[-4.5, 3.5], [-3, -2.5], [0, -4.5], [3.4, -2], [4.5, 3.5]], accent);
      polygon(c, [[-1.5, 2.5], [-.6, -1.6], [1.8, -1], [2.4, 2.5]], dark); break;
    case 'spire':
      polygon(c, [[0, -6.5], [2.8, 4], [-2.8, 4]], accent); break;
    case 'orb':
      c.fillStyle = accent; c.beginPath(); c.arc(0, 0, 3.6, 0, TAU); c.fill();
      c.fillStyle = dark; c.beginPath(); c.arc(0, 0, 1.6, 0, TAU); c.fill(); break;
    case 'gust':
      c.strokeStyle = accent; c.lineWidth = 1.8; c.lineCap = 'round';
      c.beginPath(); c.arc(0, 0, 4, -2.4, 1.8); c.stroke();
      c.beginPath(); c.arc(0, 0, 4, .7, 3.6); c.stroke(); break;
    case 'rune':
      polygon(c, [[0, -5], [3.4, 0], [0, 5], [-3.4, 0]], accent);
      polygon(c, [[0, -2.6], [1.8, 0], [0, 2.6], [-1.8, 0]], dark); break;
    case 'quake':
      polygon(c, [[-5.5, 1.5], [-3, -2.5], [-.5, 1.5], [2, -2.5], [4.5, 1.5], [5.5, 1.5], [5.5, 3.5], [-5.5, 3.5]], accent); break;
    case 'shield':
      polygon(c, [[-3.4, -4], [3.4, -4], [3.4, .5], [0, 5], [-3.4, .5]], accent);
      polygon(c, [[-1.6, -2.4], [1.6, -2.4], [1.6, .2], [0, 2.6], [-1.6, .2]], dark); break;
    case 'horn':
      polygon(c, [[-4.5, 3.5], [-4, -1], [-1, -4.5], [2.5, -5.5], [1, -2], [3.5, -1], [1.5, 1.5], [-1, 3.5]], accent); break;
  }
}

/**
 * One summoned ally at its interpolated ground point (x, y). Draws its own
 * contact shadow and, for aura totems, a faint ring at the aura's radius.
 */
export function drawAlly(c: CanvasRenderingContext2D, ally: Ally, x: number, y: number,
  time: number, reducedMotion = false): void {
  const art = ALLY_ART[ally.kind];
  const tint = (ally as { tint?: string }).tint ?? ALLY_TEMPLATES[ally.kind].color;
  const dark = mixColor(tint, '#0a0d12', .55);
  const t = reducedMotion ? 0 : time;
  const fade = ally.remaining !== undefined ? clamp(ally.remaining / .8) : 1;
  const moving = clamp(Math.hypot(ally.x - ally.prevX, ally.y - ally.prevY) / 3.2);
  const gait = t * 9 + ally.id * 1.7;
  const bob = Math.sin(t * 3 + ally.id) * 1.2;
  // Ground-plane projection matching the hound rig: x forward, y across, z up.
  const forward = [Math.cos(ally.angle), Math.sin(ally.angle) * .55] as const;
  const across = [-Math.sin(ally.angle), Math.cos(ally.angle) * .55] as const;
  const at = (px: number, py: number, z: number): Point =>
    [forward[0] * px + across[0] * py, forward[1] * px + across[1] * py - z];
  const poly = (points: readonly (readonly [number, number, number])[], fill: string) =>
    polygon(c, points.map(q => at(...q)), fill);
  // attackCooldown resets to the template interval on each strike — flash a lunge.
  const lunge = clamp((ally.attackCooldown - (ALLY_TEMPLATES[ally.kind].attackInterval - .35)) / .35) * .8;
  c.save();
  c.translate(x, y);
  c.globalAlpha = fade * (art.spectral ? .78 : 1);
  c.fillStyle = '#02091180';
  c.beginPath(); c.ellipse(0, 2, ally.radius * .9, ally.radius * .38, 0, 0, TAU); c.fill();
  if (ally.aura) {
    c.globalAlpha = fade * .12;
    c.strokeStyle = art.accent; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(0, 0, ally.aura.radius, ally.aura.radius * .45, 0, 0, TAU); c.stroke();
    c.globalAlpha = fade * (art.spectral ? .78 : 1);
  }
  const s = ally.radius / 11;
  c.scale(s, s);

  switch (art.shape) {
    case 'quadruped': {
      drawQuadruped(c, ally.angle, gait, moving, t, tint, dark, art.accent, art.quad, bob, lunge, ally.id);
      break;
    }
    case 'boar': {
      const step = Math.sin(gait) * moving * 2.2;
      const lift = Math.abs(Math.cos(gait)) * moving * 1.2;
      const body = 7 + bob * .4 + lunge * 1.6;
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        const stride = step * (end === side ? -1 : 1);
        taper(c, at(end * 4, side * 2.8, body), at(end * 4.4 + stride, side * 3.4, lift * (end === side ? 1 : .4)), 2.6, 1.6, dark);
      }
      taper(c, at(-6.5, 0, body + 1), at(-8.5, .5, body + 2.5 + Math.sin(t * 5 + ally.id)), 1.4, .6, dark);
      // Low slab torso with a high shoulder hump.
      poly([[-7.5, -3.4, body + 2.6], [4.5, -3.4, body + 3.4], [7.5, 0, body + 1.8], [4.5, 3.4, body + 1], [-6, 3.4, body]], tint);
      poly([[-6, -2.6, body + 3.8], [3.5, -2.6, body + 4.4], [6, 0, body + 3], [-4, 2, body + 1.8]], dark);
      const head = body + .5 + lunge * 1.6;
      poly([[5.5, -2.4, head + 1.4], [8.5, -2, head + 2.6], [12, -1.2, head + .8], [12, 1.2, head + .6], [8.5, 2.6, head - .6], [6, 2.2, head - .8]], tint);
      poly([[11.4, -1.4, head + 1], [13.2, 0, head + .8], [11.4, 1.4, head + .6]], dark);
      for (const side of [-1, 1])
        taper(c, at(10.5, side * 1.8, head + .4), at(12.6, side * 2.7, head + 2.8), 1.1, .5, '#e8dcc0');
      const eye = at(9.5, -1.4, head + 1.8);
      c.fillStyle = art.accent;
      c.fillRect(eye[0] - .7, eye[1] - .7, 1.4, 1.4);
      break;
    }
    case 'spider': {
      const body = 5 + bob * .3 + lunge;
      for (const side of [-1, 1]) for (let leg = 0; leg < 4; leg++) {
        const lx = -4 + leg * 2.8;
        const swing = Math.sin(gait * 1.6 + leg * 1.7 + side) * moving * 1.6;
        taper(c, at(lx, side * 2.2, body + 1), at(lx + swing, side * (5.5 + (leg % 2)), .5), .9, .5, dark);
      }
      // Round abdomen behind, smaller cephalothorax ahead.
      poly([[-9, -3.4, body + 2], [-4, -4, body + 3.4], [-1.5, 0, body + 2.4], [-4, 4, body + 1.4], [-9, 3.4, body + 1.2]], tint);
      poly([[0, -2.2, body + 1.8], [4.5, -1.6, body + 2.4], [6, 0, body + 1.4], [4.5, 1.6, body + .8], [0, 2.2, body + .8]], tint);
      c.fillStyle = art.accent;
      for (const [ex, ey] of [[4.6, -1], [5.4, -.2], [4.6, .8]] as const) {
        const e = at(ex, ey, body + 2);
        c.fillRect(e[0] - .5, e[1] - .5, 1, 1);
      }
      break;
    }
    case 'turtle': {
      const step = Math.sin(gait) * moving * 1.6;
      const body = 4.5 + bob * .2;
      for (const side of [-1, 1]) for (const end of [-1, 1])
        taper(c, at(end * 4.5, side * 3, body), at(end * 4.8 + step * (end === side ? -1 : 1), side * 3.6, .4), 2.2, 1.6, dark);
      // Shell: dark rim, tinted dome, raised crown plate.
      poly([[-8, -4.4, body + 1], [8, -4.4, body + 1.4], [9.5, 0, body + .8], [8, 4.4, body + .6], [-8, 4.4, body + .4], [-9.5, 0, body + .6]], dark);
      poly([[-6.5, -3.6, body + 3.4], [6.5, -3.6, body + 3.8], [8, 0, body + 2.6], [6.5, 3.6, body + 2], [-6.5, 3.6, body + 1.6], [-8, 0, body + 2.2]], tint);
      poly([[-4, -2.4, body + 5.4], [4, -2.4, body + 5.8], [5.5, 0, body + 4.4], [4, 2.4, body + 3.8], [-4, 2.4, body + 3.4], [-5.5, 0, body + 4]], dark);
      const head = body + 1 + lunge * 1.4;
      taper(c, at(7.5, 0, body + 1.6), at(10.5 + lunge * 2, 0, head + 1), 2.2, 1.8, tint);
      poly([[10 + lunge * 2, -1.6, head + 1.6], [12.6 + lunge * 2, -1, head + 1.2], [12.6 + lunge * 2, 1, head + .8], [10 + lunge * 2, 1.6, head + .6]], tint);
      const eye = at(11.8 + lunge * 2, -.8, head + 1.4);
      c.fillStyle = art.accent;
      c.fillRect(eye[0] - .6, eye[1] - .6, 1.2, 1.2);
      break;
    }
    case 'scorpid': {
      const body = 5.5 + bob * .3;
      for (const side of [-1, 1]) for (let leg = 0; leg < 3; leg++) {
        const lx = -3 + leg * 3;
        taper(c, at(lx, side * 2.4, body), at(lx + Math.sin(gait + leg * 2 + side) * moving * 1.4, side * 4.6, .4), 1, .6, dark);
      }
      // Pincers reaching ahead of the low segmented body.
      for (const side of [-1, 1]) {
        taper(c, at(5, side * 2.2, body + .6), at(9 + lunge * 2, side * 4.2, body - 1), 1.8, 1.2, tint);
        poly([[9 + lunge * 2, side * 3.4, body - 1.4], [12 + lunge * 2, side * 4.6, body - .6], [10.5 + lunge * 2, side * 5.4, body - 2.2]], dark);
        poly([[9 + lunge * 2, side * 3.4, body - 1.4], [11.5 + lunge * 2, side * 2.6, body - .4], [10 + lunge * 2, side * 4.4, body - 2.4]], dark);
      }
      poly([[-7, -2.6, body + 1.4], [5, -2.6, body + 2], [7, 0, body + 1.2], [5, 2.6, body + .8], [-7, 2.6, body + .6]], tint);
      poly([[-5.5, -1.8, body + 2.6], [4, -1.8, body + 3], [5.6, 0, body + 2], [-4, 1.6, body + 1.4]], dark);
      // Segmented tail arcs overhead, tipped with a bright stinger.
      const sway = Math.sin(t * 2.2 + ally.id) * 1.4;
      taper(c, at(-6.5, 0, body + 1.6), at(-9, 0, body + 7), 1.6, 1.2, tint);
      taper(c, at(-9, 0, body + 7), at(-6 + sway, 0, body + 12), 1.2, .9, tint);
      taper(c, at(-6 + sway, 0, body + 12), at(-1 + sway, 0, body + 13.5), .9, .6, dark);
      poly([[-1 + sway, -1, body + 14.6], [1.5 + sway, 0, body + 13], [-1 + sway, 1, body + 12.6]], art.accent);
      const eye = at(5.6, -1, body + 2.4);
      c.fillStyle = art.accent;
      c.fillRect(eye[0] - .6, eye[1] - .6, 1.2, 1.2);
      break;
    }
    case 'raptor': {
      const step = Math.sin(gait) * moving * 3;
      const lift = Math.abs(Math.cos(gait)) * moving * 1.6;
      const hip = 8 + bob * .5 + lunge * 2;
      for (const side of [-1, 1])
        taper(c, at(-.5, side * 1.8, hip), at(1 + step * (side > 0 ? 1 : -1), side * 2.4, lift * (side > 0 ? 1 : .3)), 2.2, 1.2, dark);
      taper(c, at(-4, 0, hip + 1), at(-13, .5, hip + 3 + Math.sin(t * 3 + ally.id)), 1.8, .6, dark);
      // Forward-leaning torso, small arms, long neck and narrow skull.
      poly([[-5, -2.4, hip + 2], [2, -2.6, hip + 5], [5.5, 0, hip + 4], [3, 2.4, hip + 1.6], [-3, 2.4, hip + .8]], tint);
      poly([[-3.5, -1.8, hip + 3.4], [1.5, -2, hip + 5.6], [4, 0, hip + 4.6], [-2, 1.4, hip + 2]], dark);
      for (const side of [-1, 1])
        taper(c, at(3, side * 1.8, hip + 3.4), at(5.5 + lunge * 2, side * 2.6, hip + 1), 1, .6, dark);
      taper(c, at(4, 0, hip + 4.4), at(7.5, 0, hip + 8 + lunge * 2), 1.8, 1.4, tint);
      poly([[7, -1.4, hip + 9 + lunge * 2], [11.5, -.8, hip + 8.4 + lunge * 2], [11.5, .8, hip + 7.6 + lunge * 2], [7, 1.4, hip + 7.4 + lunge * 2]], tint);
      const eye = at(9.4, -.9, hip + 8.6 + lunge * 2);
      c.fillStyle = art.accent;
      c.fillRect(eye[0] - .7, eye[1] - .7, 1.4, 1.4);
      break;
    }
    case 'bird': {
      const hover = 8 + bob * 1.4;
      const flap = Math.sin(t * 10 + ally.id);
      taper(c, at(-3.5, 0, hover + .8), at(-8, 0, hover + 2.4), 1.6, .8, dark);
      poly([[-4, -1.8, hover + 1], [3, -2, hover + 1.6], [5.5, 0, hover + .6], [3, 2, hover], [-4, 1.8, hover - .2]], tint);
      poly([[4, -1.4, hover + 2.6], [6.5, -1, hover + 3], [7, 1, hover + 2], [4, 1.4, hover + 1.6]], tint);
      poly([[6.8, -.7, hover + 2.6], [9.2, 0, hover + 2.2], [6.8, .7, hover + 2]], '#e8c04a');
      // Wings beat across the body axis; tips rise and fall with the flap.
      for (const side of [-1, 1]) {
        const tipZ = hover + 3 + flap * 3.5;
        const tipY = side * (8 + Math.abs(flap) * 2);
        poly([[-1, side * 1.4, hover + 1.6], [2, side * 3, hover + 2], [-1 + flap, tipY, tipZ], [-4, side * 4.5, hover + 1]], dark);
      }
      const eye = at(5.6, -.9, hover + 2.6);
      c.fillStyle = '#0a0d12';
      c.fillRect(eye[0] - .6, eye[1] - .6, 1.2, 1.2);
      break;
    }
    case 'serpent': {
      const hover = 7 + bob;
      const wave = Math.sin(t * 3 + ally.id);
      // S-curved body: four tapering segments alternating tint.
      const pts = [[-9, wave * 2.5, hover + 1], [-5, -wave * 2, hover + 2.4], [-1, wave * 1.6, hover + 2.8], [3, -wave, hover + 3.2]] as const;
      for (let i = 0; i < 3; i++)
        taper(c, at(pts[i]![0], pts[i]![1], pts[i]![2]), at(pts[i + 1]![0], pts[i + 1]![1], pts[i + 1]![2]), 2.4 - i * .4, 2 - i * .4, i % 2 ? dark : tint);
      // Fin wings behind the head.
      for (const side of [-1, 1])
        poly([[1, side * 1.2, hover + 3.6], [-1.5, side * (5 + Math.abs(wave)), hover + 5.5], [3, side * 2.4, hover + 3]], dark);
      poly([[3, -1.6, hover + 4], [7, -1, hover + 4.4], [8, 1, hover + 3.4], [3.5, 1.6, hover + 3]], tint);
      const eye = at(6, -.9, hover + 4);
      c.fillStyle = art.accent;
      c.fillRect(eye[0] - .6, eye[1] - .6, 1.2, 1.2);
      break;
    }
    case 'imp': {
      const hop = Math.abs(Math.sin(gait)) * moving * 2 + lunge * 2;
      for (const side of [-1, 1])
        taper(c, [side * 2.6, -5], [side * 3.4 + Math.sin(gait + side) * moving * 2, -1], 2.2, 1.4, dark);
      polygon(c, [[-4.4, -12 - hop], [4.4, -12 - hop], [5.4, -4], [-5.4, -4]], tint);
      polygon(c, [[-3, -11 - hop], [3, -11 - hop], [3.6, -5], [-3.6, -5]], dark);
      polygon(c, [[-4.6, -20 - hop], [4.6, -20 - hop], [5.6, -13 - hop], [-5.6, -13 - hop]], tint);
      for (const side of [-1, 1])
        polygon(c, [[side * 4, -19 - hop], [side * 7.4, -23 - hop], [side * 5.6, -17.4 - hop]], dark);
      c.fillStyle = art.accent;
      c.fillRect(-2.4, -17.4 - hop, 1.5, 1.5);
      c.fillRect(1, -17.4 - hop, 1.5, 1.5);
      break;
    }
    case 'brute': {
      drawBrute(c, gait, moving, t, tint, dark, art.accent, art, lunge, ally.id);
      break;
    }
    case 'floater': {
      const hover = 4 + bob;
      c.globalAlpha *= .5;
      c.fillStyle = dark;
      c.beginPath(); c.ellipse(0, -10 - hover, 8.6, 6.4, 0, 0, TAU); c.fill();
      c.globalAlpha /= .5;
      c.fillStyle = tint;
      c.beginPath(); c.ellipse(0, -12 - hover, 7.4, 6, 0, 0, TAU); c.fill();
      c.fillStyle = dark;
      c.beginPath(); c.ellipse(0, -9 - hover, 5.4, 3.6, 0, 0, TAU); c.fill();
      for (const side of [-1, 1])
        taper(c, [side * 6, -13 - hover], [side * 9, -8 - hover + Math.sin(t * 2.4 + side) * 1.4], 2.6, 1.4, dark);
      c.fillStyle = art.accent;
      c.fillRect(-2.4, -14.4 - hover, 1.6, 1.6);
      c.fillRect(.9, -14.4 - hover, 1.6, 1.6);
      for (let i = 0; i < 3; i++) {
        const a = t * 1.6 + i * TAU / 3;
        c.globalAlpha = fade * .5;
        c.fillStyle = art.accent;
        c.fillRect(Math.cos(a) * 10 - .7, -11 - hover + Math.sin(a) * 4 - .7, 1.4, 1.4);
      }
      break;
    }
    case 'elemental': {
      const swirl = Math.sin(t * 2.6 + ally.id) * 1.4;
      for (let i = 0; i < 3; i++) {
        const w = 7.4 - i * 1.8, ringY = -4 - i * 6 - bob * .5;
        c.fillStyle = i % 2 ? tint : dark;
        c.beginPath(); c.ellipse(swirl * (i % 2 ? -1 : 1) * .4, ringY, w, w * .55, 0, 0, TAU); c.fill();
      }
      polygon(c, [[-3.4, -22 - bob], [3.4, -22 - bob], [4.6, -16 - bob], [-4.6, -16 - bob]], tint);
      polygon(c, [[-1.6, -25 - bob], [1.6, -25 - bob], [2.6, -21 - bob], [-2.6, -21 - bob]], dark);
      for (const side of [-1, 1])
        taper(c, [side * 5, -15 - bob], [side * (8 + lunge * 3), -8 - bob - lunge * 2], 2.2, 1, tint);
      if (art.flames) for (let i = 0; i < 3; i++) {
        const flick = Math.sin(t * 9 + ally.id + i * 2) * 1.4;
        polygon(c, [[-4 + i * 4 - 1.2, -25 - bob], [-4 + i * 4 + flick, -31 - bob], [-4 + i * 4 + 1.2, -25 - bob]], art.accent);
      }
      c.fillStyle = art.accent;
      c.fillRect(-1.8, -23.4 - bob, 1.3, 1.3);
      c.fillRect(.7, -23.4 - bob, 1.3, 1.3);
      break;
    }
    case 'humanoid': {
      const step = Math.sin(gait) * moving * 2.2;
      const hunch = art.hunched ? 3 : 0;
      for (const side of [-1, 1])
        taper(c, [side * 2.4, -9], [side * 3 + step * side, -1], 2.6, 1.8, dark);
      for (const side of [-1, 1])
        taper(c, [side * 4.6, -19 + hunch], [side * (6.4 + lunge * 3 + hunch), -10 - lunge * 2 + hunch * .6], 2.2, 1.4, tint);
      if (art.wings) for (const side of [-1, 1])
        polygon(c, [[side * 3.5, -19], [side * 10, -23 + Math.sin(t * 3 + ally.id) * 1.2], [side * 11.5, -14], [side * 6, -12]], dark);
      polygon(c, [[-4.6, -21 + hunch], [4.6, -21 + hunch], [5.6, -8], [-5.6, -8]], tint);
      polygon(c, [[-3, -20 + hunch], [3, -20 + hunch], [3.8, -10], [-3.8, -10]], dark);
      polygon(c, [[-3.2 + hunch, -27 + hunch], [3.2 + hunch, -27 + hunch], [3.8 + hunch, -20.4 + hunch], [-3.8 + hunch, -20.4 + hunch]], tint);
      c.fillStyle = art.accent;
      c.fillRect(-1.9 + hunch, -24.6 + hunch, 1.3, 1.3);
      c.fillRect(.7 + hunch, -24.6 + hunch, 1.3, 1.3);
      break;
    }
    case 'treant': {
      const sway = Math.sin(gait * .5) * moving * 1;
      for (const side of [-1, 1])
        taper(c, [side * 2.2, -6], [side * 3.4 + Math.sin(gait + side) * moving * 1.6, -1], 2.6, 1.8, dark);
      // Trunk torso, branch arms with twig tips, leaf crown.
      polygon(c, [[-5 + sway, -20], [5 + sway, -20], [6.5, -5], [-6.5, -5]], tint);
      polygon(c, [[-3 + sway, -19], [3 + sway, -19], [4, -7], [-4, -7]], dark);
      for (const side of [-1, 1]) {
        taper(c, [side * 4.5 + sway, -17], [side * (8 + lunge * 3) + sway, -10 - lunge * 2], 2, 1.2, tint);
        taper(c, [side * (8 + lunge * 3) + sway, -10 - lunge * 2], [side * (10 + lunge * 3) + sway, -13 - lunge * 2], 1, .5, dark);
      }
      polygon(c, [[-2.5 + sway, -24], [2.5 + sway, -24], [3 + sway, -19.5], [-3 + sway, -19.5]], tint);
      for (const side of [-1, 0, 1])
        polygon(c, [[side * 3 + sway, -23], [side * 5.5 + sway, -28 - (side === 0 ? 2 : 0)], [side * 1.5 + sway, -26]], art.accent);
      c.fillStyle = '#ffe8a0';
      c.fillRect(-1.7 + sway, -22.6, 1.2, 1.2);
      c.fillRect(.6 + sway, -22.6, 1.2, 1.2);
      break;
    }
    case 'gargoyle': {
      const hover = 6 + bob * 1.2;
      const flap = Math.sin(t * 7 + ally.id);
      for (const side of [-1, 1])
        taper(c, [side * 1.8, -6 - hover * .3], [side * 2.4, -1 - hover * .3], 2, 1.4, dark);
      // Bat wings span wide behind the compact torso.
      for (const side of [-1, 1]) {
        const lift = flap * 3;
        polygon(c, [[side * 3.5, -15 - hover], [side * 11, -18 - hover + lift], [side * 14, -12 - hover + lift * .6], [side * 9, -10 - hover], [side * 6, -8 - hover]], dark);
      }
      polygon(c, [[-4, -16 - hover], [4, -16 - hover], [5, -6 - hover], [-5, -6 - hover]], tint);
      polygon(c, [[-3, -22 - hover], [3, -22 - hover], [3.6, -15.4 - hover], [-3.6, -15.4 - hover]], tint);
      for (const side of [-1, 1])
        polygon(c, [[side * 2.6, -21.4 - hover], [side * 5.4, -25 - hover], [side * 4, -20 - hover]], dark);
      c.fillStyle = art.accent;
      c.fillRect(-1.8, -19.6 - hover, 1.3, 1.3);
      c.fillRect(.6, -19.6 - hover, 1.3, 1.3);
      break;
    }
    case 'fiend': {
      const step = Math.sin(gait) * moving * 2.4;
      const lift = Math.abs(Math.cos(gait)) * moving * 1.2;
      const body = 6.5 + bob * .5 + lunge * 1.6;
      for (const side of [-1, 1]) for (const end of [-1, 1])
        taper(c, at(end * 3.6, side * 2, body), at(end * 4 + step * (end === side ? -1 : 1), side * 2.6, lift * (end === side ? 1 : .4)), 2, 1.2, dark);
      // Hunched torso: shoulders rise over a low rear; a wispy tail dissipates.
      taper(c, at(-6, 0, body + 1), at(-11, .5, body + 3 + Math.sin(t * 5 + ally.id) * 1.4), 1.4, .3, art.accent);
      poly([[-6.5, -2.4, body + .6], [3, -2.8, body + 3.6], [7, 0, body + 2.6], [4, 2.8, body + 1], [-5, 2.4, body]], tint);
      for (const side of [-1, 1])
        taper(c, at(4, side * 2.4, body + 2.4), at(8 + lunge * 3, side * 3.6, body - 2), 1.6, .8, dark);
      poly([[6, -1.8, body + 3.4], [9.5, -1.2, body + 4], [10.5, 1, body + 3], [6.5, 1.8, body + 2.2]], tint);
      const eye = at(8.6, -1, body + 3.6);
      c.fillStyle = art.accent;
      c.fillRect(eye[0] - .7, eye[1] - .7, 1.4, 1.4);
      break;
    }
    case 'totem': {
      taper(c, [0, -1], [0, -17], 4.6, 3.2, dark);
      taper(c, [0, -3], [0, -15], 2.6, 1.6, tint);
      taper(c, [-5, -12], [5, -12], 1.6, 1.6, tint);
      const pulse = 1 + Math.sin(t * 4 + ally.id) * .15;
      c.save();
      c.translate(0, -21);
      c.scale(pulse, pulse);
      totemCrown(c, art.crown ?? 'orb', art.accent, dark);
      c.restore();
      break;
    }
  }
  if (art.glow) drawGlow(c, 0, -12, 15 * art.glow * 3, art.accent, art.glow * .5);
  c.restore();
}
