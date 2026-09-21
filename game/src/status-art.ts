import type { CharacterPose } from './art-types.ts';
import { line, polygon } from './art-primitives.ts';
import { drawGlow } from './lighting.ts';
import type { CcKind, DotSchool } from './wow-types.ts';

/** WoW status fields the renderer stamps on the pose alongside the legacy timers. */
export interface StatusPose extends CharacterPose {
  /** Active crowd control (root/fear/incapacitate/polymorph/silence; stun/freeze/slow reuse the legacy timers). */
  cc?: readonly { readonly kind: CcKind; remaining: number }[];
  /** Active damage-over-time effects; burn keeps its own fields, so fire dots reuse the flame cue. */
  dots?: readonly { readonly school: DotSchool; remaining: number }[];
  /** Translucency cue for a stealthed player; player-art reads it for the rig alpha. */
  stealthed?: boolean;
}

const ccRemaining = (pose: StatusPose, kind: CcKind): number =>
  pose.cc?.reduce((max, effect) => effect.kind === kind ? Math.max(max, effect.remaining) : max, 0) ?? 0;
const dotRemaining = (pose: StatusPose, ...schools: DotSchool[]): number =>
  pose.dots?.reduce((max, dot) => schools.includes(dot.school) ? Math.max(max, dot.remaining) : max, 0) ?? 0;

/** Cues are derived from remaining combat status timers, without adding gameplay state. */
export function drawCharacterStatus(c: CanvasRenderingContext2D, pose: StatusPose): void {
  if (pose.dead) return;
  if ((pose.frozen ?? 0) > 0) {
    c.save();
    const fade = Math.min(1, pose.frozen! / .2);
    c.globalAlpha *= fade * .46;
    polygon(c, [[-16,0],[-20,-17],[-12,-40],[0,-48],[15,-37],[19,-15],[13,2]], '#77bedc');
    c.globalAlpha = fade * .85;
    line(c, [[-16,0],[-20,-17],[-12,-40],[0,-48],[15,-37],[19,-15],[13,2],[-16,0]], '#c6f4ff', 1.3);
    line(c, [[0,-48],[-4,-24],[13,2],[-4,-24],[-20,-17]], '#e1fbff', .9);
    c.globalAlpha = fade * .6;
    line(c, [[-12,-40],[7,-30],[19,-15]], '#b9eaff', 1.1);
    c.restore();
  } else if ((pose.stunned ?? 0) > 0) {
    c.save();
    const t = pose.effectTime ?? pose.time;
    c.globalAlpha *= Math.min(1, pose.stunned! / .2);
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + i * Math.PI * 2 / 3, x = Math.cos(a) * 12, y = -48 + Math.sin(a) * 4;
      polygon(c, [[x-3,y],[x,y-4],[x+3,y],[x,y+4]], '#f4da92');
    }
    c.restore();
  }
  const frostTime = Math.max(pose.slow ?? 0, pose.chill ?? 0, dotRemaining(pose, 'frost'));
  if (frostTime > 0) {
    c.save();
    c.globalAlpha *= Math.min(1, frostTime / .3);
    drawGlow(c, 0, -12, 28, '#75c6e2', .32);
    c.strokeStyle = '#7ed6ec'; c.lineWidth = .9;
    c.beginPath(); c.ellipse(0, 0, 14, 6, 0, .2, Math.PI * 1.8); c.stroke();
    for (let i = 0; i < 6; i++) {
      const x = -11 + i * 4.4, height = 5 + Math.sin(i * 3.7) * 3;
      polygon(c, [[x, 1], [x - 1.8, -height], [x + .6, -height - 3], [x + 1.8, 1]], '#68a6b6');
      line(c, [[x + .6, -height - 3], [x + 1.8, 0]], '#c1f8ff', .8);
    }
    // Crystalline frost flakes floating around body
    for (let i = 0; i < 4; i++) {
      const t = (pose.effectTime ?? pose.time) * 1.2 + i * 1.57;
      const fx = Math.cos(t) * 13, fy = -18 + Math.sin(t * 1.5) * 10;
      polygon(c, [[fx - 2, fy], [fx, fy - 2], [fx + 2, fy], [fx, fy + 2]], '#d9f8ff');
    }
    c.restore();
  }
  const burnTime = Math.max(pose.burning ?? 0, dotRemaining(pose, 'fire'));
  if (burnTime > 0) {
    c.save();
    c.globalAlpha = Math.min(1, burnTime / .25) * .85;
    drawGlow(c, 0, -17, 30, '#ff6020', .35);
    // Fiery ember ring on ground
    c.strokeStyle = '#ff7b39'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, 0, 13, 5, 0, 0, Math.PI * 2); c.stroke();
    // Rising flame tongues
    for (let i = 0; i < 5; i++) {
      const phase = ((pose.effectTime ?? pose.time) * 1.8 + i * .21) % 1, x = Math.sin(i * 2.3) * 9;
      const y = -6 - phase * 25, width = 2.8 * Math.sin(phase * Math.PI);
      c.globalAlpha = Math.sin(phase * Math.PI) * .9;
      polygon(c, [[x - width, y], [x - 1, y - 5], [x + Math.sin((pose.effectTime ?? pose.time) * 14 + i) * 2, y - 11], [x + width, y - 2]], '#ed6328');
      line(c, [[x, y], [x, y - 5]], '#ffd464', .9);
    }
    // Floating ember motes
    for (let i = 0; i < 4; i++) {
      const t = (pose.effectTime ?? pose.time) * 2 + i * 1.57;
      const ex = Math.sin(t * 1.3) * 12, ey = -12 - ((t * 8) % 24);
      c.fillStyle = '#ffea78';
      c.fillRect(ex - 1, ey - 1, 2, 2);
    }
    c.restore();
  }
  if ((pose.fracture ?? 0) > 0) {
    c.save();
    c.globalAlpha = Math.min(1, pose.fracture! / .3) * .85;
    drawGlow(c, 0, -15, 24, '#5bb8f5', .25);
    // Cracked jagged armor sparks around body
    for (let i = 0; i < 4; i++) {
      const angle = (pose.effectTime ?? pose.time) * 1.6 + i * (Math.PI / 2);
      const cx = Math.cos(angle) * 14, cy = -16 + Math.sin(angle) * 9;
      line(c, [[cx - 3, cy - 3], [cx, cy], [cx + 3, cy - 2]], '#9ee3ff', 1.2);
    }
    c.restore();
  }
  const fxTime = pose.effectTime ?? pose.time;
  const bleed = dotRemaining(pose, 'bleed', 'physical');
  if (bleed > 0) {
    c.save();
    c.globalAlpha *= Math.min(1, bleed / .25);
    // Blood drips fall from the torso and pool on the ground.
    for (let i = 0; i < 3; i++) {
      const phase = (fxTime * .9 + i * .37) % 1, x = -5 + i * 4.6;
      const y = -26 + phase * 24;
      polygon(c, [[x - .9, y], [x + .9, y], [x + .5, y + 2.2], [x - .5, y + 2.2]], '#a02c2c');
      line(c, [[x, y - 1.4], [x, y]], '#e26a6a', .7);
    }
    c.globalAlpha *= .8;
    c.fillStyle = '#7c1f1f';
    c.beginPath(); c.ellipse(0, .6, 7, 2.2, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  const poison = dotRemaining(pose, 'poison', 'nature');
  if (poison > 0) {
    c.save();
    c.globalAlpha *= Math.min(1, poison / .3);
    drawGlow(c, 0, -14, 22, '#6fae4a', .22);
    // Sickly motes bubble up around the torso.
    for (let i = 0; i < 6; i++) {
      const phase = (fxTime * .55 + i * .19) % 1;
      const x = Math.sin(i * 2.7 + fxTime * 1.4) * (5 + phase * 6), y = -4 - phase * 26;
      c.globalAlpha = Math.min(1, poison / .3) * Math.sin(phase * Math.PI) * .9;
      polygon(c, [[x - 1.1, y], [x, y - 1.5], [x + 1.1, y], [x, y + 1.5]], i % 2 ? '#8fd06a' : '#5d9a3e');
    }
    c.restore();
  }
  const shadow = dotRemaining(pose, 'shadow');
  if (shadow > 0) {
    c.save();
    c.globalAlpha *= Math.min(1, shadow / .3);
    drawGlow(c, 0, -18, 24, '#6a4f9e', .26);
    // Violet wisps orbit the shoulders with a trailing tail.
    for (let i = 0; i < 3; i++) {
      const a = fxTime * 2.1 + i * Math.PI * 2 / 3;
      const x = Math.cos(a) * 11, y = -22 + Math.sin(a) * 8;
      polygon(c, [[x - 1.6, y], [x, y - 2.4], [x + 1.6, y], [x, y + 2.4]], '#8a6fb8');
      line(c, [[x, y], [x - Math.cos(a) * 5, y - Math.sin(a) * 3]], '#b9a0e8', .8);
    }
    c.restore();
  }
  const holy = dotRemaining(pose, 'holy');
  if (holy > 0) {
    c.save();
    const fade = Math.min(1, holy / .3);
    c.globalAlpha *= fade;
    drawGlow(c, 0, -10, 26, '#ffd76e', .22);
    // A gold seal turns under the feet: ring, rune ticks, rising sparkles.
    c.strokeStyle = '#ffd76e'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, 0, 12.5, 4.8, 0, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 6; i++) {
      const a = fxTime * .8 + i * Math.PI / 3;
      line(c, [[Math.cos(a) * 11.5, Math.sin(a) * 4.4], [Math.cos(a) * 13.5, Math.sin(a) * 5.2]], '#ffe9a8', .8);
    }
    for (let i = 0; i < 3; i++) {
      const phase = (fxTime * .7 + i * .33) % 1;
      const x = Math.sin(i * 2.1) * 8, y = -6 - phase * 20;
      c.globalAlpha = fade * Math.sin(phase * Math.PI) * .85;
      polygon(c, [[x - 1, y], [x, y - 1.6], [x + 1, y], [x, y + 1.6]], '#fff3c4');
    }
    c.restore();
  }
  const polymorph = ccRemaining(pose, 'polymorph');
  if (polymorph > 0) {
    c.save();
    c.globalAlpha *= Math.min(1, polymorph / .25) * .8;
    // A translucent critter blob swallows the torso; long ears sell the shape.
    polygon(c, [[-8, -4], [-9.5, -12], [-6, -20], [0, -23], [6, -20], [9.5, -12], [8, -4], [4, -1], [-4, -1]], '#ef82ad');
    polygon(c, [[-4.5, -21], [-6.5, -30], [-3.5, -29], [-2, -21.5]], '#ef82ad');
    polygon(c, [[4.5, -21], [6.5, -30], [3.5, -29], [2, -21.5]], '#ef82ad');
    line(c, [[-8, -4], [-9.5, -12], [-6, -20], [0, -23], [6, -20], [9.5, -12], [8, -4]], '#f7b8d2', .9);
    c.restore();
  }
  const fear = ccRemaining(pose, 'fear');
  if (fear > 0) {
    c.save();
    c.globalAlpha *= Math.min(1, fear / .25);
    // Panic lines radiate off the head.
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * .82 + i * Math.PI * .29;
      const jitter = Math.sin(fxTime * 13 + i * 2.1) * 1.2;
      const x0 = Math.cos(a) * (9 + jitter), y0 = -44 + Math.sin(a) * (9 + jitter) * .8;
      line(c, [[x0, y0], [Math.cos(a) * (14 + jitter), -44 + Math.sin(a) * (14 + jitter) * .8]], '#c5b6ef', 1);
    }
    c.restore();
  }
  const root = ccRemaining(pose, 'root');
  if (root > 0) {
    c.save();
    c.globalAlpha *= Math.min(1, root / .25);
    // Ground grasp: tendrils claw up around the ankles.
    for (const side of [-1, 1]) {
      const grip = Math.sin(fxTime * 2.4 + side) * .8;
      polygon(c, [[side * 9, 1], [side * 7.4, -4], [side * (4.6 + grip), -9], [side * (5.8 + grip), -9.4], [side * 8.6, -4.6], [side * 10.4, 1]], '#6d7f45');
      line(c, [[side * 8.6, -1], [side * (5.4 + grip), -8.6]], '#a8c686', .7);
    }
    c.restore();
  }
  const silence = ccRemaining(pose, 'silence');
  if (silence > 0) {
    c.save();
    const fade = Math.min(1, silence / .25);
    c.globalAlpha *= fade;
    // Muted glyph hovering overhead: a struck-out ring.
    drawGlow(c, 0, -52, 8, '#9db8c7', .3);
    c.strokeStyle = '#9db8c7'; c.lineWidth = 1.1;
    c.beginPath(); c.arc(0, -52, 4.4, 0, Math.PI * 2); c.stroke();
    line(c, [[-3.1, -48.9], [3.1, -55.1]], '#cfe0ea', 1.2);
    c.restore();
  }
}
