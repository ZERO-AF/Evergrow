/** Vanity companion sprites (docs/wow-deepening.md §2 lineage): small
 * silhouettes drawn at the follower's ground point, ~14px tall. Pure drawing —
 * position/follow state lives in companion-state.ts, keyed per renderer. */
import { polygon, taper, TAU, type Point } from './art-primitives.ts';
import { drawQuadruped } from './ally-art.ts';
import type { CompanionDef } from './companion-content.ts';
import type { CompanionFollower } from './companion-state.ts';

/** Ground-plane projection matching drawQuadruped: x along the facing, y
 * across it (squashed), z up. */
type Project = (x: number, y: number, z: number) => Point;
const projector = (angle: number): Project => {
  const forward = [Math.cos(angle), Math.sin(angle) * .55] as const;
  const across = [-Math.sin(angle), Math.cos(angle) * .55] as const;
  return (x: number, y: number, z: number): Point =>
    [forward[0] * x + across[0] * y, forward[1] * x + across[1] * y - z];
};

function critter(c: CanvasRenderingContext2D, def: CompanionDef, at: Project, phase: number, moving: number): void {
  const hop = Math.abs(Math.sin(phase)) * moving * 1.6;
  const body = 4 + hop;
  const poly = (pts: readonly (readonly [number, number, number])[], fill: string) =>
    polygon(c, pts.map(([x, y, z]) => at(x, y, z)), fill);
  // Tail first so the body overlaps its root.
  if (def.id === 'squirrel') {
    // The squirrel's signature: a curled plume taller than its body.
    taper(c, at(-3.4, 0, body), at(-5.6, 0, body + 6.5 + Math.sin(phase * .7) * .6), 1.8, 1.1, def.accent);
    taper(c, at(-5.6, 0, body + 6.5), at(-3.2, 0, body + 8.6), 1.1, .5, def.accent);
  } else if (def.id === 'snapjaw') {
    // Shell dome; the head pokes out front.
    poly([[-3.6, -2.6, body + .6], [0, -3, body + 3.4], [3.4, -2.4, body + .8], [3, 2.4, body + .4], [-3, 2.6, body + .2]], def.accent);
  } else {
    taper(c, at(-3, 0, body + .6), at(-5.4, .4, body + 1.6 + Math.sin(phase * .8) * .5), 1, .4, def.accent);
  }
  // Body blob.
  poly([[-3.4, -2, body + .4], [2.6, -2.2, body + 1], [3.6, 0, body + .4], [2.4, 2.2, body - .2], [-3, 2, body - .4]], def.tint);
  // Head + ears/beak.
  poly([[2.4, -1.4, body + 1.6], [4.6, -1, body + 2.6], [5.6, 0, body + 1.8], [4.6, 1.4, body + 1], [2.6, 1.2, body + .8]], def.tint);
  if (def.id === 'penguin') {
    // White belly + beak; upright stance reads as a tiny tuxedo.
    poly([[-1, -1.2, body + .8], [2, -1.4, body + 1.4], [2.6, 0, body + .8], [-1.2, 1.2, body + .2]], def.accent);
    poly([[5.4, -.6, body + 2], [6.8, 0, body + 1.6], [5.4, .6, body + 1.6]], '#e0a03c');
  } else {
    poly([[3.4, -1.2, body + 2.4], [4, -1.4, body + 4], [4.6, -1, body + 2.6]], def.accent);
    poly([[3.4, 1.2, body + 2.4], [4, 1.4, body + 4], [4.6, 1, body + 2.6]], def.accent);
  }
  const eye = at(4.4, -.8, body + 2);
  c.fillStyle = def.accent;
  c.fillRect(eye[0] - .5, eye[1] - .5, 1, 1);
}

function bird(c: CanvasRenderingContext2D, def: CompanionDef, at: Project, phase: number, moving: number): void {
  const flap = Math.sin(phase * 1.6) * (1.2 + moving * 2);
  const body = 5 + Math.abs(Math.sin(phase)) * .8;
  const poly = (pts: readonly (readonly [number, number, number])[], fill: string) =>
    polygon(c, pts.map(([x, y, z]) => at(x, y, z)), fill);
  // Tail fan behind.
  for (const side of [-1, 0, 1] as const)
    poly([[-3, side * .8, body + 1], [-7.5, side * 2.4, body + 2.5 + Math.abs(side) * .8], [-5.5, side * .6, body + .4]], def.accent);
  // Wings beat outward.
  for (const side of [-1, 1] as const)
    poly([[0, side * 1.4, body + 2], [-2.5, side * 5.4, body + 4.5 + flap], [-5, side * 6, body + 2.5 + flap], [-1.5, side * 2, body + .8]], def.tint);
  // Body + crested head.
  poly([[-3.4, -1.6, body + .6], [2.8, -1.8, body + 1.4], [4, 0, body + .6], [2.6, 1.8, body], [-3, 1.6, body - .2]], def.tint);
  poly([[3, -1, body + 2.4], [5, -.6, body + 3.6], [6, 0, body + 2.6], [5, 1, body + 1.8], [3.2, .8, body + 1.6]], def.tint);
  poly([[4, -.4, body + 3.6], [4.8, -.6, body + 5.4], [5.4, -.2, body + 3.8]], def.accent);
  poly([[5.8, -.5, body + 2.8], [7, 0, body + 2.4], [5.8, .5, body + 2.4]], def.accent);
  const eye = at(4.8, -.7, body + 3);
  c.fillStyle = '#1a1410';
  c.fillRect(eye[0] - .5, eye[1] - .5, 1, 1);
}

function floater(c: CanvasRenderingContext2D, def: CompanionDef, at: Project, phase: number): void {
  const hover = 7 + Math.sin(phase * .9) * 1.4;
  const core = at(0, 0, hover);
  // Trailing wisps curl under the glow.
  for (const side of [-1, 1] as const)
    taper(c, at(-1, side * .8, hover - 1), at(-3.5, side * 1.6, hover - 4 - Math.sin(phase + side) * .8), .9, .3, def.tint);
  if (def.id === 'sprite-darter') {
    // Tiny faerie-dragon wings on the glow.
    const poly = (pts: readonly (readonly [number, number, number])[], fill: string) =>
      polygon(c, pts.map(([x, y, z]) => at(x, y, z)), fill);
    const flap = Math.sin(phase * 2.2) * 1.4;
    for (const side of [-1, 1] as const)
      poly([[0, side * 1, hover + 1], [-2, side * 4.4, hover + 3.5 + flap], [-3.6, side * 4.8, hover + 1.5 + flap]], def.accent);
  }
  c.save();
  c.globalAlpha = .35;
  c.fillStyle = def.tint;
  c.beginPath(); c.arc(core[0], core[1], 5.2, 0, TAU); c.fill();
  c.globalAlpha = 1;
  c.fillStyle = def.accent;
  c.beginPath(); c.arc(core[0], core[1], 2.4, 0, TAU); c.fill();
  c.restore();
}

function imp(c: CanvasRenderingContext2D, def: CompanionDef, at: Project, phase: number, moving: number): void {
  const bounce = Math.abs(Math.sin(phase)) * moving * 1.8;
  const hip = 3.4 + bounce, chest = 7 + bounce, head = 10.5 + bounce;
  const poly = (pts: readonly (readonly [number, number, number])[], fill: string) =>
    polygon(c, pts.map(([x, y, z]) => at(x, y, z)), fill);
  // Stubby legs.
  const step = Math.sin(phase) * moving * 1.6;
  for (const side of [-1, 1] as const)
    taper(c, at(0, side * 1.4, hip), at(step * side, side * 1.8, 0), 1.2, .8, def.accent);
  // Torso + arms.
  poly([[-1.8, -1.8, hip], [1.8, -1.8, chest], [2.2, 1.8, chest - .6], [-1.6, 1.8, hip - .4]], def.tint);
  for (const side of [-1, 1] as const)
    taper(c, at(1, side * 1.8, chest - .4), at(2.6 + step * .4 * side, side * 2.6, hip - .6), .9, .5, def.tint);
  // Big head, little horns.
  poly([[.4, -2, head - 1.4], [3.4, -1.8, head + .6], [4, 0, head + 1.4], [3.2, 2, head + .2], [.2, 1.8, head - 1.8]], def.tint);
  for (const side of [-1, 1] as const)
    poly([[2.2, side * 1.6, head + .4], [2.8, side * 2.4, head + 2.4], [3.4, side * 1.8, head + .6]], def.accent);
  const eye = at(3, -.9, head + .4);
  c.fillStyle = def.accent;
  c.fillRect(eye[0] - .6, eye[1] - .6, 1.2, 1.2);
  if (def.id === 'mini-diablo') {
    // Embers drift off the little lord of terror.
    for (let i = 0; i < 3; i++) {
      const ember = at(-1 - i * 1.4, (i - 1) * 1.2, head - 2 - ((phase * 2 + i * 2.1) % 4));
      c.fillStyle = def.accent;
      c.fillRect(ember[0] - .5, ember[1] - .5, 1, 1);
    }
  }
}

/** One companion at its interpolated ground point. `time` drives idle sway;
 * pass 0 under reduced motion to freeze the bob. */
export function drawCompanion(
  c: CanvasRenderingContext2D,
  def: CompanionDef,
  f: CompanionFollower,
  x: number,
  y: number,
  time: number,
  reducedMotion = false,
): void {
  const phase = reducedMotion ? 0 : f.phase;
  const bob = reducedMotion ? 0 : Math.sin(phase * .9) * .8;
  c.save();
  c.translate(x, y - bob);
  const at = projector(f.angle);
  switch (def.shape) {
    case 'quad':
      c.scale(.55, .55);
      drawQuadruped(c, f.angle, phase, f.moving, time, def.tint, def.accent, def.accent,
        def.id === 'core-hound-pup' ? { bulk: 1.25, head: 1.5, tail: 3 } : { bulk: .8, snout: .8 });
      break;
    case 'critter': critter(c, def, at, phase, f.moving); break;
    case 'bird': bird(c, def, at, phase, f.moving); break;
    case 'floater': floater(c, def, at, phase); break;
    case 'imp': imp(c, def, at, phase, f.moving); break;
  }
  c.restore();
}
