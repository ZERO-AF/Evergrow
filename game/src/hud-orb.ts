import { saturate as clamp } from './art-primitives.ts';
const TAU = Math.PI * 2;
const GLASS_RADIUS = 25;

/** Mix a hex resource color toward white (positive) or black (negative). */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255, a = Math.abs(amount);
  const mix = (v: number) => Math.round(v + (target - v) * a);
  return `#${((1 << 24) | (mix(n >> 16 & 255) << 16) | (mix(n >> 8 & 255) << 8) | mix(n & 255)).toString(16).slice(1)}`;
}

/** Mana keeps its authored lapis palette; other resources derive shades from one tint. */
interface OrbPalette {
  readonly empty0: string; readonly empty1: string;
  readonly liquid: readonly [string, string, string, string];
  readonly glow0: string; readonly glow1: string;
  readonly meniscus: string; readonly moteA: string; readonly moteB: string; readonly rim: string;
}
const MANA_PALETTE: OrbPalette = {
  empty0: '#142131', empty1: '#0b1321',
  liquid: ['#619fe9', '#327bd8', '#2048a3', '#0a1c50'],
  glow0: '#448ded55', glow1: '#2a62be24',
  meniscus: '#b3d7f7', moteA: '#b9b6ff', moteB: '#a6dfff', rim: '#80a8d653',
};
function resourcePalette(tint: string | undefined): OrbPalette {
  if (!tint) return MANA_PALETTE;
  return {
    empty0: shade(tint, -.78), empty1: shade(tint, -.88),
    liquid: [shade(tint, .45), shade(tint, .15), shade(tint, -.25), shade(tint, -.65)],
    glow0: `${tint}55`, glow1: `${shade(tint, -.2)}24`,
    meniscus: shade(tint, .6), moteA: shade(tint, .55), moteB: shade(tint, .35), rim: `${tint}53`,
  };
}

function circle(c: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  c.beginPath(); c.arc(x, y, radius, 0, TAU);
}

/** The filled circular segment, rather than its height, measures the resource. */
function liquidLevel(ratio: number): number {
  if (ratio <= 0) return GLASS_RADIUS;
  if (ratio >= 1) return -GLASS_RADIUS;
  let low = -1, high = 1;
  for (let i = 0; i < 18; i++) {
    const position = (low + high) / 2;
    const area = (Math.acos(position) - position * Math.sqrt(1 - position * position)) / Math.PI;
    if (area > ratio) low = position; else high = position;
  }
  return (low + high) * GLASS_RADIUS / 2;
}

/** Small luminous motes rise through the resource, at the same scale as health bubbles. */
function manaEnergy(c: CanvasRenderingContext2D, time: number, level: number, moteA = '#b9b6ff', moteB = '#a6dfff') {
  for (let i = 0; i < 9; i++) {
    const phase = (time * (.07 + i % 3 * .012) + i * .381966) % 1;
    const x = Math.sin(i * 2.4) * 16 + Math.sin(time * .75 + i * 1.7) * 1.2;
    const y = 25 - phase * 53;
    const radius = .5 + i % 3 * .18;
    const submerged = Math.min(1, Math.max(0, (y - level) / 3));
    const fade = Math.min(1, phase * 9) * submerged * (.75 + Math.sin(time * 1.5 + i) * .15);
    if (fade <= 0) continue;
    const tint = i % 3 === 0 ? moteA : moteB;
    const halo = c.createRadialGradient(x, y, 0, x, y, radius * 2.7);
    halo.addColorStop(0, tint + '60'); halo.addColorStop(.4, tint + '24'); halo.addColorStop(1, tint + '00');
    c.globalAlpha = fade * .65; c.fillStyle = halo;
    c.fillRect(x - 3, y - 3, 6, 6);
    c.globalAlpha = fade * .46; c.fillStyle = tint;
    circle(c, x, y, radius); c.fill();
    // A very short fading wake reads as rising energy without tracing a pattern.
    c.globalAlpha = fade * .16; c.strokeStyle = tint; c.lineWidth = .45;
    c.beginPath(); c.moveTo(x, y + radius); c.lineTo(x - .25, y + radius + 1.4); c.stroke();
  }
}

/** Native-resolution garnet/lapis glass and its complete, 31px metal socket. */
export function drawHUDOrb(c: CanvasRenderingContext2D, x: number, y: number,
  ratio: number, time: number, mana: boolean, trail = ratio, hit = 0, reserved = 0, tint?: string) {
  const palette = mana ? resourcePalette(tint) : MANA_PALETTE;
  const r = GLASS_RADIUS;
  ratio = clamp(ratio); trail = clamp(trail); hit = clamp(hit);
  const lowPulse = !mana && ratio > 0 && ratio < .3 ? .5 + Math.sin(time * 4.5) * .5 : 0;
  c.save(); c.translate(x, y);
  // Even contact flashes stay inside the socket, clear of the skill controls.
  circle(c, 0, 0, 31); c.clip();
  circle(c, 0, 0, 30.8); c.fillStyle = '#04070b'; c.fill();

  const metal = c.createLinearGradient(-23, -29, 18, 30);
  metal.addColorStop(0, '#77776a'); metal.addColorStop(.15, '#40474a');
  metal.addColorStop(.4, '#20282d'); metal.addColorStop(.66, '#10171d');
  metal.addColorStop(.85, '#4c4537'); metal.addColorStop(1, '#272b2b');
  circle(c, 0, 0, 28.4); c.lineWidth = 4.4; c.strokeStyle = metal; c.stroke();
  circle(c, 0, 0, 30.3); c.lineWidth = .65; c.strokeStyle = '#8d816150'; c.stroke();
  circle(c, 0, 0, 26.25); c.lineWidth = 1.3; c.strokeStyle = '#050b12'; c.stroke();
  circle(c, 0, 0, 25.5); c.lineWidth = .65; c.strokeStyle = '#a99a6d75'; c.stroke();
  c.beginPath(); c.arc(0, 0, 28.6, 3.55, 4.95);
  c.lineWidth = .6; c.strokeStyle = '#d6cba172'; c.stroke();
  c.beginPath(); c.arc(0, 0, 28.6, .55, 1.9);
  c.strokeStyle = '#8b785347'; c.stroke();

  c.save(); circle(c, 0, 0, r); c.clip();
  const empty = c.createRadialGradient(-7, -9, 1, 0, 0, r * 1.25);
  empty.addColorStop(0, mana ? palette.empty0 : '#271722');
  empty.addColorStop(.6, mana ? palette.empty1 : '#160e19');
  empty.addColorStop(1, '#03060c');
  c.fillStyle = empty; c.fillRect(-r, -r, r * 2, r * 2);

  if (!mana && trail > ratio + .001) {
    const level = liquidLevel(trail);
    const lag = c.createLinearGradient(0, level, 0, r);
    lag.addColorStop(0, '#e78c9480'); lag.addColorStop(1, '#78384b60');
    c.fillStyle = lag; c.fillRect(-r, level, r * 2, r - level);
  }

  if (ratio > 0) {
    const level = liquidLevel(ratio);
    c.save();
    // Keep the area exact. Ripples move within the liquid instead of adding or
    // removing apparent health as the surface animates.
    c.beginPath(); c.rect(-r, level, r * 2, r - level); c.clip();
    const liquid = c.createLinearGradient(-8, -r, 9, r);
    liquid.addColorStop(0, mana ? palette.liquid[0] : '#ee4863');
    liquid.addColorStop(.24, mana ? palette.liquid[1] : '#cd2249');
    liquid.addColorStop(.59, mana ? palette.liquid[2] : '#991334');
    liquid.addColorStop(1, mana ? palette.liquid[3] : '#45091f');
    c.fillStyle = liquid; c.fillRect(-r, -r, r * 2, r * 2);

    // Soft illumination remains behind the resource-specific motion.
    c.globalCompositeOperation = 'screen';
    const glowX = -7 + Math.sin(time * .31) * 2;
    const glowY = 9 + Math.cos(time * .27) * 2;
    const glow = c.createRadialGradient(glowX, glowY, 0, glowX, glowY, 24);
    glow.addColorStop(0, mana ? palette.glow0 : '#f34b5559');
    glow.addColorStop(.55, mana ? palette.glow1 : '#bf28472b');
    glow.addColorStop(1, '#00000000');
    c.fillStyle = glow; c.fillRect(-r, -r, r * 2, r * 2);

    if (ratio < 1) {
      const halfWidth = Math.sqrt(Math.max(0, r * r - level * level));
      c.globalAlpha = .6; c.lineWidth = .75;
      c.strokeStyle = mana ? palette.meniscus : '#f38b99';
      c.beginPath(); c.moveTo(-halfWidth, level + .4); c.lineTo(halfWidth, level + .4); c.stroke();
      for (let i = 0; !mana && i < 2; i++) {
        const travel = (time * .14 + i * .5) % 1;
        const width = halfWidth * (.25 + travel * .6);
        c.globalAlpha = Math.sin(travel * Math.PI) * .2;
        c.lineWidth = .55; c.beginPath();
        c.ellipse(Math.sin(time * .47 + i) * halfWidth * .12, level + .9 + travel * 1.8,
          Math.max(.1, width), .3 + travel * .35, 0, .12, Math.PI - .12);
        c.stroke();
      }
    }

    if (mana) manaEnergy(c, time, level, palette.moteA, palette.moteB);
    // Health retains hollow rising bubbles; mana uses soft luminous motes instead.
    for (let i = 0; !mana && i < 11; i++) {
      const phase = (time * (.09 + (i % 4) * .017) + i * .381966) % 1;
      const bx = Math.sin(i * 2.4) * 16 + Math.sin(time * 1.2 + i * 1.7) * 1.5;
      const by = 25 - phase * 53;
      const radius = .7 + (i % 4) * .36;
      const submerged = Math.min(1, Math.max(0, (by - level) / (radius * 2.5)));
      const fade = Math.min(1, phase * 9) * submerged;
      if (fade <= 0) continue;
      c.globalAlpha = fade * .55;
      c.fillStyle = '#ff9caa28';
      circle(c, bx, by, radius); c.fill();
      c.strokeStyle = '#ffb8bd'; c.lineWidth = .42;
      c.stroke();
      c.globalAlpha = fade * .85;
      c.beginPath(); c.arc(bx, by, radius * .76, 3.5, 4.8);
      c.strokeStyle = '#ffe1d3'; c.lineWidth = .5; c.stroke();
    }
    c.restore();
  }

  const glass = c.createRadialGradient(-2, -3, 10, 0, 0, r);
  glass.addColorStop(0, '#01061000'); glass.addColorStop(.45, '#0106100c');
  glass.addColorStop(.8, '#01051048'); glass.addColorStop(1, '#01040ac7');
  c.fillStyle = glass; c.fillRect(-r, -r, r * 2, r * 2);
  const reflection = c.createLinearGradient(-15, -24, 7, 7);
  reflection.addColorStop(0, '#dcebf51f'); reflection.addColorStop(.7, '#dcebf500');
  c.fillStyle = reflection; c.fillRect(-r, -r, r * 2, r * 2);
  c.beginPath(); c.arc(0, 0, 23.4, 3.65, 4.28);
  c.lineWidth = .95; c.strokeStyle = '#e1e9e376'; c.stroke();
  c.beginPath(); c.arc(0, 0, 23.7, .53, 1.15);
  c.lineWidth = .55; c.strokeStyle = mana ? palette.rim : '#af626453'; c.stroke();
  c.restore();

  // Small recessed steel pins, rather than ornamental corner jewels.
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI * (.25 + i * .5);
    const px = Math.cos(angle) * 28.45, py = Math.sin(angle) * 28.45;
    circle(c, px, py, 1.2); c.fillStyle = '#05090d'; c.fill();
    circle(c, px, py - .2, .65); c.fillStyle = '#70716a'; c.fill();
    c.beginPath(); c.moveTo(px - .4, py + .1); c.lineTo(px + .4, py - .1);
    c.strokeStyle = '#252b2e'; c.lineWidth = .45; c.stroke();
  }
  if (!mana && (hit > 0 || lowPulse > 0)) {
    c.globalCompositeOperation = 'screen';
    circle(c, 0, 0, 25.8); c.lineWidth = .9;
    c.strokeStyle = hit > 0 ? '#ffc7a6' : '#d84c56';
    c.globalAlpha = Math.max(hit * .8, lowPulse * .28); c.stroke();
    if (hit > 0) {
      circle(c, 0, 0, 29.1); c.lineWidth = 1.35;
      c.globalAlpha = hit * .48; c.strokeStyle = '#df7c6b'; c.stroke();
    }
  }
  if(mana&&reserved>0){
    c.save();circle(c,0,0,r);c.clip();
    const boundary=liquidLevel(1-clamp(reserved));
    c.fillStyle='#10101edf';c.fillRect(-r,-r,r*2,boundary+r);
    c.save();c.beginPath();c.rect(-r,-r,r*2,boundary+r);c.clip();c.strokeStyle='#a394bd35';c.lineWidth=.65;
    for(let i=-65;i<65;i+=7){c.beginPath();c.moveTo(i,-r);c.lineTo(i+36,r);c.stroke();}c.restore();
    c.strokeStyle='#c4b6d999';c.lineWidth=.8;c.beginPath();c.moveTo(-r,boundary);c.lineTo(r,boundary);c.stroke();c.restore();
  }
  c.restore();
}
