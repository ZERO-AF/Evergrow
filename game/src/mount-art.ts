/** Procedural quadruped mount art drawn under the player (docs/wow-deepening.md §2).
 * Reuses the hound's forward/across projection and taper/polygon/line primitives;
 * the saddle blanket and trim carry each mount's tint/accent. */
import { clamp, line, polygon, taper, type Point } from './art-primitives.ts';
import type { MountDef } from './mount-content.ts';
import type { Player } from './model.ts';

/** Pixels the rider's feet lift above the ground point while mounted — stirrup
 * height on quadrupeds, so the legs wrap the torso instead of spearing through
 * it. Low-slung rigs (carpet/chopper/turtle) sit lower: `mountSeatHeight`. */
export const MOUNT_SEAT_HEIGHT = 20;

/** Rider foot lift for a specific mount; the renderer raises the rider by this. */
export function mountSeatHeight(def: MountDef): number {
  return def.art === 'carpet' ? 18 : def.art === 'machine' ? 14 : def.art === 'turtle' ? 15 : MOUNT_SEAT_HEIGHT;
}

/** Minimal pose the mount rig needs; derived from the live player each frame. */
export interface MountPose {
  angle: number;
  /** Travel direction; the mount leads with its motion, not the rider's aim. */
  moveAngle: number;
  /** 0..1 gait strength. */
  moving: number;
  /** Gait phase accumulator (player.walkTime works directly). */
  gaitPhase: number;
  time: number;
}

export function mountPose(player: Player, time: number): MountPose {
  const speed = Math.hypot(player.vx, player.vy);
  const moving = Math.min(1, speed / 130);
  return {
    angle: player.angle,
    moveAngle: moving > 0.02 ? Math.atan2(player.vy, player.vx) : player.angle,
    moving,
    gaitPhase: player.walkTime * 1.6,
    time,
  };
}

/** Draw the mount around (0, 0), its ground-contact point, facing pose.moveAngle. */
export function drawMount(ctx: CanvasRenderingContext2D, def: MountDef, pose: MountPose): void {
  const moving = clamp(pose.moving);
  const phase = pose.gaitPhase;
  const forward = [Math.cos(pose.moveAngle), Math.sin(pose.moveAngle) * .55] as const;
  const across = [-Math.sin(pose.moveAngle), Math.cos(pose.moveAngle) * .55] as const;
  const p = (x: number, y: number, z: number): Point =>
    [forward[0] * x + across[0] * y, forward[1] * x + across[1] * y - z];
  const poly = (points: readonly (readonly [number, number, number])[], fill: string): void =>
    polygon(ctx, points.map(([x, y, z]) => p(x, y, z)), fill);

  // Non-quadruped silhouettes draw their own rigs and return early.
  if (def.art === 'carpet') { drawCarpet(ctx, def, pose, poly, p); return; }
  if (def.art === 'machine') { drawChopper(ctx, def, pose, poly, p); return; }
  if (def.art === 'turtle') { drawTurtleMount(ctx, def, pose, poly, p); return; }

  const drake = def.art === 'drake';
  const big = (drake ? 1.22 : def.art === 'ram' ? 1.05 : def.art === 'bear' ? 1.3 : 1) * 1.9;
  const bodyHeight = (13 + Math.abs(Math.sin(phase)) * moving * 1.4) * big;


  // Diagonal gait: front-left pairs with rear-right. Far legs draw first.
  const limbs = ([-1, 1] as const).flatMap(side => ([-1, 1] as const).map(end => {
    const stride = Math.sin(phase + (end === side ? Math.PI : 0)) * moving * 4.5;
    const lift = Math.max(0, Math.cos(phase + (end === side ? Math.PI : 0))) * moving * 3;
    const hip = p(end * 7 * big, side * 3.4 * big, bodyHeight - 1);
    const knee = p(end * 7.8 * big - stride * .4, side * 4.4 * big, bodyHeight * .42 + lift * .3);
    const hoof = p(end * 7.8 * big + stride, side * 5 * big, lift);
    return { hip, knee, hoof, depth: p(end * 7 * big, side * 3.4 * big, 0)[1] };
  })).sort((a, b) => a.depth - b.depth);
  const leg = ({ hip, knee, hoof }: typeof limbs[number], shade: string) => {
    taper(ctx, hip, knee, 3.8 * big, 2.2 * big, shade);
    taper(ctx, knee, hoof, 1.9 * big, 1.3 * big, def.accent);
  };
  limbs.slice(0, 2).forEach(l => leg(l, def.accent));

  // Tail: horse/wolf hang low, ram stubs, drake sweeps long.
  const sway = Math.sin(pose.time * 3 + phase * .5) * (1 + moving);
  if (def.art === 'ram') poly([[-9, 0, bodyHeight + 2], [-12, 0, bodyHeight + 1], [-10, 0, bodyHeight - 1]], def.accent);
  else if (def.art === 'bear') {
    // Bear tail is a nub; skip the sweep.
    poly([[-10 * big, 0, bodyHeight + 2], [-12 * big, 0, bodyHeight + 1], [-10.5 * big, 0, bodyHeight - .5]], def.accent);
  } else {
    const tailLen = drake ? 16 : 10;
    taper(ctx, p(-9 * big, 0, bodyHeight + 2), p(-9 * big - tailLen, sway * 2, bodyHeight + (drake ? 4 : -2)), 2.2, .8, def.accent);
  }

  // Torso: deep-chested hexagon with a shaded belly.
  poly([[-10 * big, 0, bodyHeight + 2], [-7 * big, -4.4 * big, bodyHeight + 5], [5 * big, -4.4 * big, bodyHeight + 6],
    [9.5 * big, 0, bodyHeight + 3.5], [6.5 * big, 4.4 * big, bodyHeight], [-6.5 * big, 4.4 * big, bodyHeight - 1]], def.tint);
  poly([[-8 * big, -3 * big, bodyHeight + 4.5], [5 * big, -3 * big, bodyHeight + 5.5], [8 * big, 0, bodyHeight + 4],
    [1 * big, 2 * big, bodyHeight + 2], [-6 * big, 2 * big, bodyHeight + 1]], def.accent);

  // Saddle blanket + seat; the rider's feet land at the stirrups.
  poly([[-4, -4.6, bodyHeight + 6.5], [4, -4.6, bodyHeight + 7], [5, 4.6, bodyHeight + 2.5], [-5, 4.6, bodyHeight + 2]], def.accent);
  poly([[-2.5, -3, bodyHeight + 8], [3, -3, bodyHeight + 8.4], [3.6, 3, bodyHeight + 6], [-3.2, 3, bodyHeight + 5.6]], '#4a3626');
  line(ctx, [p(-3.4, -4.4, bodyHeight + 6.8), p(4.4, -4.4, bodyHeight + 7.2)], '#c9a86a', .8);
  line(ctx, [p(-3.4, 4.4, bodyHeight + 2.4), p(4.4, 4.4, bodyHeight + 2.8)], '#c9a86a', .8);

  // Neck and head lead the travel direction.
  const neckBase = p(7 * big, 0, bodyHeight + 4);
  const neckTop = p(11.5 * big, 0, bodyHeight + 11 * big);
  taper(ctx, neckBase, neckTop, 5 * big, 3.4 * big, def.tint);
  const headZ = bodyHeight + 12 * big;
  poly([[10 * big, -2.6, headZ + 2], [14 * big, -3, headZ + 3.5], [18.5 * big, -1.6, headZ + 1],
    [19 * big, 1.8, headZ], [14 * big, 3, headZ - 1], [10.5 * big, 2.4, headZ - 1]], def.tint);
  poly([[13 * big, 1.4, headZ + .5], [18.5 * big, 1.2, headZ], [14.5 * big, 2.8, headZ - 1.2]], def.accent);

  if (def.art === 'horse') {
    // Mane along the neck crest plus a small forelock.
    line(ctx, [p(7.5 * big, 0, bodyHeight + 6), p(10 * big, 0, bodyHeight + 10), p(12 * big, 0, headZ + 3)], def.accent, 2.4);
    poly([[12 * big, -1, headZ + 4], [13.5 * big, 0, headZ + 6], [14.5 * big, 1, headZ + 4]], def.accent);
    // Ears.
    poly([[11 * big, -1.6, headZ + 3], [11.8 * big, -2, headZ + 6.5], [12.8 * big, -1.4, headZ + 3.4]], def.tint);
    poly([[11 * big, 1.6, headZ + 3], [11.8 * big, 2, headZ + 6.5], [12.8 * big, 1.4, headZ + 3.4]], def.tint);
  } else if (def.art === 'wolf') {
    // Pointed ears and a hackle ridge.
    poly([[11 * big, -1.8, headZ + 2.5], [12 * big, -2.4, headZ + 7], [13 * big, -1.6, headZ + 3]], def.accent);
    poly([[11 * big, 1.8, headZ + 2.5], [12 * big, 2.4, headZ + 7], [13 * big, 1.6, headZ + 3]], def.accent);
    for (let spike = 0; spike < 3; spike++)
      poly([[4 + spike * 2.4, 0, bodyHeight + 5.5], [5.2 + spike * 2.4, 0, bodyHeight + 8.5], [6.4 + spike * 2.4, 0, bodyHeight + 5.5]], def.accent);
  } else if (def.art === 'ram') {
    // Curled horns: two arcs hugging the skull on each side.
    for (const side of [-1, 1] as const) {
      line(ctx, [p(12 * big, side * 2.6, headZ + 2), p(10.5 * big, side * 4.4, headZ + 4.5),
        p(9 * big, side * 4.6, headZ + 1.5), p(10 * big, side * 3.6, headZ - .5)], '#d8cdb4', 1.8);
    }
    // Woolly crown.
    poly([[10.5 * big, -2, headZ + 3.5], [12 * big, 0, headZ + 5.5], [13.5 * big, 2, headZ + 3.5], [12 * big, 0, headZ + 2.5]], '#b8b2a4');
  } else if (def.art === 'bear') {
    // Bear: round ears, a broad muzzle and a shoulder hump.
    poly([[11 * big, -1.8, headZ + 3], [12 * big, -2.2, headZ + 5], [13 * big, -1.6, headZ + 3.2]], def.tint);
    poly([[11 * big, 1.8, headZ + 3], [12 * big, 2.2, headZ + 5], [13 * big, 1.6, headZ + 3.2]], def.tint);
    poly([[16 * big, -1.4, headZ + .5], [20 * big, -1, headZ], [20.5 * big, 1, headZ - .6], [16 * big, 1.6, headZ - .8]], def.accent);
    poly([[2 * big, -2 * big, bodyHeight + 6], [6 * big, -2.4 * big, bodyHeight + 9], [8 * big, 0, bodyHeight + 8], [5 * big, 2.4 * big, bodyHeight + 6]], def.tint);
  } else {
    // Nether Drake: swept horns, back spines and folded wings.
    for (const side of [-1, 1] as const)
      line(ctx, [p(12 * big, side * 2, headZ + 3), p(9 * big, side * 3.4, headZ + 7), p(6.5 * big, side * 3.8, headZ + 8.5)], '#c9b8e8', 1.6);
    for (let spike = 0; spike < 4; spike++)
      poly([[-4 + spike * 3, 0, bodyHeight + 5], [-2.8 + spike * 3, 0, bodyHeight + 9], [-1.6 + spike * 3, 0, bodyHeight + 5]], '#8a76b8');
    for (const side of [-1, 1] as const) {
      const wingLift = Math.sin(pose.time * 2.2 + side) * 1.5 + moving * 2;
      poly([[2, side * 2, bodyHeight + 6], [-6, side * 7, bodyHeight + 13 + wingLift],
        [-13, side * 8.5, bodyHeight + 9 + wingLift], [-4, side * 3, bodyHeight + 5]], '#4a3a66');
      line(ctx, [p(2, side * 2, bodyHeight + 6), p(-6, side * 7, bodyHeight + 13 + wingLift)], '#8a76b8', 1);
    }
  }

  limbs.slice(2).forEach(l => leg(l, def.tint));
}

// ── Non-quadruped rigs ───────────────────────────────────────────────────────

type MountProject = (x: number, y: number, z: number) => Point;
type MountPoly = (points: readonly (readonly [number, number, number])[], fill: string) => void;

/** Flying carpet: a rippling rug that hovers; the rider kneels at its center. */
function drawCarpet(ctx: CanvasRenderingContext2D, def: MountDef, pose: MountPose,
  poly: MountPoly, p: MountProject): void {
  const hover = 16 + Math.sin(pose.time * 1.8) * 1.6 + pose.moving * 3;
  const ripple = Math.sin(pose.time * 3.2) * 1.4;
  // Rug: a wide diamond with a wavy trailing edge and tassels.
  poly([[-14, 0, hover + ripple * .4], [-6, -8, hover + 1], [8, -8.5, hover + 1.6], [15, 0, hover + ripple],
    [8, 8.5, hover + 1.6], [-6, 8, hover + 1]], def.tint);
  poly([[-11, 0, hover + .6 + ripple * .4], [-5, -6, hover + 1.2], [7, -6.5, hover + 1.8], [12, 0, hover + 1 + ripple],
    [7, 6.5, hover + 1.8], [-5, 6, hover + 1.2]], def.accent);
  poly([[-8, 0, hover + .8], [-3, -3.6, hover + 1.4], [6, -4, hover + 1.8], [10, 0, hover + 1.2 + ripple],
    [6, 4, hover + 1.8], [-3, 3.6, hover + 1.4]], def.tint);
  for (const side of [-1, 1] as const)
    for (let i = 0; i < 4; i++)
      line(ctx, [p(-14 - i * .4, side * (1.5 + i * 1.8), hover + .4), p(-16.5 - i * .5, side * (1.8 + i * 1.9), hover - 1.2)], def.accent, .9);
  // Gold trim along the front edge.
  line(ctx, [p(15, -6, hover + ripple), p(16.5, 0, hover + ripple), p(15, 6, hover + ripple)], '#e8d48a', 1.2);
}

/** Mekgineer's chopper: two wheels, a low frame, handlebars and an exhaust. */
function drawChopper(ctx: CanvasRenderingContext2D, def: MountDef, pose: MountPose,
  poly: MountPoly, p: MountProject): void {
  const moving = clamp(pose.moving);
  const wheelR = 6.5;
  const spin = pose.gaitPhase * 2.4;
  const wheel = (cx: number) => {
    // Octagon rim + hub spokes; stays on the polygon/line primitives.
    const rim = Array.from({ length: 8 }, (_, i) => {
      const a = i * Math.PI / 4;
      return [cx + Math.cos(a) * wheelR, 0, wheelR + Math.sin(a) * wheelR * .92] as const;
    });
    poly(rim, '#22242a');
    const hub = p(cx, 0, wheelR);
    for (let s = 0; s < 3; s++) {
      const a = spin + s * Math.PI / 3;
      line(ctx, [hub, p(cx + Math.cos(a) * wheelR * .8, 0, wheelR + Math.sin(a) * wheelR * .74)], '#8a8f98', 1);
    }
  };
  wheel(-9); wheel(10);
  // Frame: sloped tank over the seat, forks to the front wheel.
  poly([[-8, -2.4, wheelR + 4], [4, -2.8, wheelR + 7], [9, -2, wheelR + 5.5], [8, 2.4, wheelR + 4.5], [-6, 2.6, wheelR + 3]], def.tint);
  poly([[-5, -1.6, wheelR + 5.5], [3, -2, wheelR + 7.6], [6.5, -1.2, wheelR + 6], [5, 1.6, wheelR + 5], [-4, 1.8, wheelR + 4.6]], def.accent);
  line(ctx, [p(9, -1.4, wheelR + 5), p(12.5, -1.8, wheelR + 11), p(14.5, -2.4, wheelR + 11.5)], '#3a3d44', 1.6);
  line(ctx, [p(9, 1.4, wheelR + 5), p(12.5, 1.8, wheelR + 11), p(14.5, 2.4, wheelR + 11.5)], '#3a3d44', 1.6);
  // Exhaust pipes + a puff while moving.
  line(ctx, [p(-2, 3, wheelR + 3), p(-10, 3.6, wheelR + 2.4), p(-13, 3.8, wheelR + 2.8)], '#6a6f78', 1.8);
  if (moving > .1) {
    const puff = p(-14 - (pose.time * 30) % 8, 4, wheelR + 3 + (pose.time * 12) % 5);
    polygon(ctx, [[puff[0] - 2, puff[1]], [puff[0], puff[1] - 2], [puff[0] + 2, puff[1]], [puff[0], puff[1] + 2]], '#9aa0a8');
  }
}

/** Riding turtle: a low dome shell on stubby legs; slow and unbothered. */
function drawTurtleMount(ctx: CanvasRenderingContext2D, def: MountDef, pose: MountPose,
  poly: MountPoly, p: MountProject): void {
  const moving = clamp(pose.moving);
  const phase = pose.gaitPhase;
  const shell = 8;
  // Legs paddle slowly.
  for (const side of [-1, 1] as const) for (const end of [-1, 1] as const) {
    const stride = Math.sin(phase + (end === side ? Math.PI : 0)) * moving * 2;
    taper(ctx, p(end * 7, side * 4.6, shell - 3), p(end * 7.6 + stride, side * 5.6, 0), 2.6, 1.8, def.accent);
  }
  // Shell dome + rim + saddle pad.
  poly([[-11, -6, shell - 1], [-4, -8.5, shell + 4], [6, -8, shell + 5], [11.5, -4, shell + 2],
    [12, 4, shell + 1], [6, 8, shell + 3.6], [-4, 8.5, shell + 3], [-11, 6, shell - 1]], def.tint);
  poly([[-8, -4.5, shell + 2.5], [-2, -6, shell + 6], [6, -5.5, shell + 6.6], [9.5, -2.5, shell + 4],
    [8, 4, shell + 3.4], [-2, 6, shell + 5], [-8, 4.5, shell + 2]], def.accent);
  poly([[-3, -3, shell + 7], [3.4, -3, shell + 7.6], [4, 3, shell + 6], [-3.4, 3, shell + 5.6]], '#4a3626');
  // Head cranes forward, tail stubs behind.
  taper(ctx, p(10, 0, shell + 1), p(15, 0, shell + 3 + Math.sin(pose.time * 2) * .8), 3, 2.2, def.tint);
  poly([[14, -1.6, shell + 4], [17.5, -1, shell + 4.6], [18.5, 1, shell + 3.4], [15, 1.8, shell + 2.6]], def.tint);
  taper(ctx, p(-11, 0, shell), p(-14, .6, shell - 1), 1.4, .5, def.accent);
}
