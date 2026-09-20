/** Procedural quadruped mount art drawn under the player (docs/wow-deepening.md §2).
 * Reuses the hound's forward/across projection and taper/polygon/line primitives;
 * the saddle blanket and trim carry each mount's tint/accent. */
import { clamp, line, polygon, taper, type Point } from './art-primitives.ts';
import type { MountDef } from './mount-content.ts';
import type { Player } from './model.ts';

/** Pixels the rider's feet lift above the ground point while mounted —
 * low enough that the legs straddle the mount's body at the saddle. */
export const MOUNT_SEAT_HEIGHT = 7;

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
  const drake = def.id === 'drake';
  const big = (drake ? 1.22 : def.id === 'ram' ? 1.05 : 1) * 1.9;
  const bodyHeight = (13 + Math.abs(Math.sin(phase)) * moving * 1.4) * big;
  const forward = [Math.cos(pose.moveAngle), Math.sin(pose.moveAngle) * .55] as const;
  const across = [-Math.sin(pose.moveAngle), Math.cos(pose.moveAngle) * .55] as const;
  const p = (x: number, y: number, z: number): Point =>
    [forward[0] * x + across[0] * y, forward[1] * x + across[1] * y - z];
  const poly = (points: readonly (readonly [number, number, number])[], fill: string): void =>
    polygon(ctx, points.map(([x, y, z]) => p(x, y, z)), fill);

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
  if (def.id === 'ram') poly([[-9, 0, bodyHeight + 2], [-12, 0, bodyHeight + 1], [-10, 0, bodyHeight - 1]], def.accent);
  else {
    const reach = drake ? 24 : 16, drop = drake ? 2 : 8;
    line(ctx, [p(-9 * big, 0, bodyHeight), p(-9 * big - reach * .6, .8, bodyHeight + (drake ? 3 : -2)),
      p(-9 * big - reach, 1.2, bodyHeight + drop + sway)], def.accent, drake ? 2.6 : 2.2);
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

  if (def.id === 'horse') {
    // Mane along the neck crest plus a small forelock.
    line(ctx, [p(7.5 * big, 0, bodyHeight + 6), p(10 * big, 0, bodyHeight + 10), p(12 * big, 0, headZ + 3)], def.accent, 2.4);
    poly([[12 * big, -1, headZ + 4], [13.5 * big, 0, headZ + 6], [14.5 * big, 1, headZ + 4]], def.accent);
    // Ears.
    poly([[11 * big, -1.6, headZ + 3], [11.8 * big, -2, headZ + 6.5], [12.8 * big, -1.4, headZ + 3.4]], def.tint);
    poly([[11 * big, 1.6, headZ + 3], [11.8 * big, 2, headZ + 6.5], [12.8 * big, 1.4, headZ + 3.4]], def.tint);
  } else if (def.id === 'wolf') {
    // Pointed ears and a hackle ridge.
    poly([[11 * big, -1.8, headZ + 2.5], [12 * big, -2.4, headZ + 7], [13 * big, -1.6, headZ + 3]], def.accent);
    poly([[11 * big, 1.8, headZ + 2.5], [12 * big, 2.4, headZ + 7], [13 * big, 1.6, headZ + 3]], def.accent);
    for (let spike = 0; spike < 3; spike++)
      poly([[4 + spike * 2.4, 0, bodyHeight + 5.5], [5.2 + spike * 2.4, 0, bodyHeight + 8.5], [6.4 + spike * 2.4, 0, bodyHeight + 5.5]], def.accent);
  } else if (def.id === 'ram') {
    // Curled horns: two arcs hugging the skull on each side.
    for (const side of [-1, 1] as const) {
      line(ctx, [p(12 * big, side * 2.6, headZ + 2), p(10.5 * big, side * 4.4, headZ + 4.5),
        p(9 * big, side * 4.6, headZ + 1.5), p(10 * big, side * 3.6, headZ - .5)], '#d8cdb4', 1.8);
    }
    // Woolly crown.
    poly([[10.5 * big, -2, headZ + 3.5], [12 * big, 0, headZ + 5.5], [13.5 * big, 2, headZ + 3.5], [12 * big, 0, headZ + 2.5]], '#b8b2a4');
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
