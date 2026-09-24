import type { Prop } from './world.ts';
import type { PointLight } from './light-types.ts';

export type { PointLight } from './light-types.ts';

const stamps = new Map<string, HTMLCanvasElement>();
const rgbCache = new Map<string, [number, number, number]>();

/** Parse any CSS color (hex, rgb(), named) into [r,g,b] once — lightStamp
 * appends alpha stops, which only works on numeric channels. */
let colorProbe: CanvasRenderingContext2D | null = null;
export function rgbOf(color: string): [number, number, number] {
  const hit = rgbCache.get(color);
  if (hit) return hit;
  // Fast path: parse #rgb/#rrggbb/#rrggbbaa and rgb()/rgba() directly — no DOM
  // needed, so headless tests (canvas stubs) work too.
  let rgb: [number, number, number] | null = null;
  const s = color.trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    rgb = [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  } else {
    const m = s.match(/rgba?\(([^)]*)\)/);
    if (m) rgb = m[1]!.split(',').slice(0, 3).map(v => Number(v.trim())) as [number, number, number];
  }
  if (!rgb || rgb.some(v => !Number.isFinite(v))) {
    // Named/exotic colors: normalize through a canvas probe when available.
    const probe = colorProbe ?? (colorProbe = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null);
    if (probe) {
      probe.fillStyle = '#000'; probe.fillStyle = color;
      const n = probe.fillStyle;
      rgb = n.startsWith('#')
        ? [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)]
        : (n.match(/\d+/g)!.slice(0, 3).map(Number) as [number, number, number]);
    } else rgb = [255, 255, 255]; // headless fallback: white
  }
  if (rgbCache.size >= 64) rgbCache.delete(rgbCache.keys().next().value!);
  rgbCache.set(color, rgb);
  return rgb;
}

/** Cached, code-generated light cookies are shared by lights and flying sparks. */
function lightStamp(color: string): HTMLCanvasElement {
  const cached = stamps.get(color);
  if (cached) return cached;
  const image = document.createElement('canvas');
  image.width = image.height = 256;
  const c = image.getContext('2d')!;
  const [r, g, b] = rgbOf(color);
  // WoW-style point light: a white-hot core, a tight colored shoulder, then a
  // long soft falloff. The hot center keeps flames and spell cores luminous
  // instead of uniformly tinted.
  const hot = `rgba(${Math.min(255, r + (255 - r) * .62 | 0)},${Math.min(255, g + (255 - g) * .62 | 0)},${Math.min(255, b + (255 - b) * .62 | 0)}`;
  const gradient = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, `${hot},1)`);
  gradient.addColorStop(.09, `rgba(${r},${g},${b},.96)`);
  gradient.addColorStop(.22, `rgba(${r},${g},${b},.72)`);
  gradient.addColorStop(.48, `rgba(${r},${g},${b},.30)`);
  gradient.addColorStop(.74, `rgba(${r},${g},${b},.09)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  c.fillStyle = gradient;
  c.fillRect(0, 0, 256, 256);
  if (stamps.size >= 24) stamps.delete(stamps.keys().next().value!);
  stamps.set(color, image);
  return image;
}

export function drawGlow(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, power = 1) {
  if (radius <= 0 || power <= 0) return;
  // Manual state restore: save()/restore() snapshot the whole graphics state,
  // and this helper runs dozens of times per frame (motes, sparks, emitters).
  const alpha = c.globalAlpha, composite = c.globalCompositeOperation;
  c.globalCompositeOperation = 'screen';
  c.globalAlpha = alpha * Math.min(1, power);
  c.drawImage(lightStamp(color), x - radius, y - radius, radius * 2, radius * 2);
  c.globalAlpha = alpha; c.globalCompositeOperation = composite;
}

/** Shadow wedge passes: [softness, alpha] — hoisted so the per-light path allocates nothing. */
const SHADOW_PASSES: readonly (readonly [number, number])[] = [[.035, .2], [0, .65]];

/** One shared soft dark ellipse for prop contact occlusion (multiply composite). */
let occlusion: HTMLCanvasElement | null = null;
function occlusionStamp(): HTMLCanvasElement {
  if (occlusion) return occlusion;
  const image = document.createElement('canvas');
  image.width = image.height = 128;
  const c = image.getContext('2d')!;
  const gradient = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgb(96,102,110)');
  gradient.addColorStop(.45, 'rgb(158,163,168)');
  gradient.addColorStop(.78, 'rgb(228,230,232)');
  gradient.addColorStop(1, 'rgb(255,255,255)');
  c.fillStyle = gradient;
  c.fillRect(0, 0, 128, 128);
  return occlusion = image;
}

/** Half-resolution surface illumination with bounded trunk/rock shadow casting. */
export class Lighting {
  private map = document.createElement('canvas');
  private context = this.map.getContext('2d')!;
  private scratch = document.createElement('canvas');
  private observed = new Set<string>();
  private nextObserved = new Set<string>();
  private cookies = new Map<string, HTMLCanvasElement>();
  private cookieProps: Prop[] | null = null;
  private scratchContext: CanvasRenderingContext2D;
  private grade: CanvasGradient | null = null;
  private gradeKey = '';

  constructor() {
    this.scratch.width = this.scratch.height = 256;
    this.scratchContext = this.scratch.getContext('2d')!;
  }

  reset() { this.cookies.clear(); this.observed.clear(); this.nextObserved.clear(); this.cookieProps = null; }

  apply(target: CanvasRenderingContext2D, width: number, height: number,
    left: number, top: number, lights: PointLight[], props: Prop[], ambient = '#839cae', zoom = 1) {
    if (props !== this.cookieProps) { this.cookies.clear(); this.cookieProps = props; }
    const mw = Math.ceil(width / 2), mh = Math.ceil(height / 2);
    const worldWidth = width / zoom, worldHeight = height / zoom;
    // Use the real map ratios so odd-sized viewports upscale back onto the same
    // camera projection as the world, without drifting half a pixel at the edges.
    const scaleX = zoom * mw / width, scaleY = zoom * mh / height;
    if (this.map.width !== mw || this.map.height !== mh) {
      this.map.width = mw; this.map.height = mh;
    }
    const c = this.context;
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    // Cool moonlight keeps unlit combat terrain readable; warm sources change its color.
    // A faint vertical grade (sky overhead, settled shade below) gives the flat
    // ambient a day-mood depth cue for free.
    const [ar, ag, ab] = rgbOf(ambient);
    const gradeKey = `${mw}x${mh}:${ar},${ag},${ab}`;
    if (this.gradeKey !== gradeKey) {
      const grade = c.createLinearGradient(0, 0, 0, mh);
      grade.addColorStop(0, `rgb(${Math.min(255, ar * 1.07 | 0)},${Math.min(255, ag * 1.07 | 0)},${Math.min(255, ab * 1.07 | 0)})`);
      grade.addColorStop(.55, ambient);
      grade.addColorStop(1, `rgb(${ar * .93 | 0},${ag * .93 | 0},${ab * .93 | 0})`);
      this.grade = grade; this.gradeKey = gradeKey;
    }
    c.fillStyle = this.grade!;
    c.fillRect(0, 0, mw, mh);
    c.globalCompositeOperation = 'lighter';
    this.nextObserved.clear();
    let shadowCount = 0;
    const limit = Math.min(lights.length, 18);
    for (let i = 0; i < limit; i++) {
      const light = lights[i];
      if (light.x + light.radius < left || light.x - light.radius > left + worldWidth
        || light.y + light.radius < top || light.y - light.radius > top + worldHeight) continue;
      const shadows = !!light.shadows && shadowCount++ < 4;
      // Power changes (fire flicker, roof fading) do not alter the reusable cookie.
      // The string key is built only for stationary lights — dynamic lights never
      // consult the cookie map, so keying them was pure per-frame string churn.
      const key = light.stationary
        ? `${light.x}:${light.y}:${light.radius}:${light.color}:${shadows}:` + (light.clip?.map(p => `${p.x},${p.y}`).join(';') ?? '')
        : '';
      if (light.stationary) this.nextObserved.add(key);
      let cookie = !shadows && !light.clip?.length ? lightStamp(light.color) : light.stationary ? this.cookies.get(key) : undefined;
      if (!cookie) {
        const scratch = this.scratchContext;
        scratch.setTransform(1, 0, 0, 1, 0, 0);
        scratch.clearRect(0, 0, 256, 256);
        scratch.globalAlpha = 1;
        scratch.globalCompositeOperation = 'source-over';
        scratch.drawImage(lightStamp(light.color), 0, 0);
        if (light.clip?.length) {
          scratch.globalCompositeOperation = 'destination-in';
          scratch.fillStyle = '#fff';
          scratch.beginPath();
          light.clip.forEach((p, i) => {
            const x = 128 + (p.x - light.x) * 128 / light.radius, y = 128 + (p.y - light.y) * 128 / light.radius;
            if (i) scratch.lineTo(x, y); else scratch.moveTo(x, y);
          });
          scratch.closePath(); scratch.fill();
          scratch.globalCompositeOperation = 'source-over';
        }
        if (shadows) this.cutShadows(light, props);
        cookie = this.scratch;
        if (light.stationary && this.observed.has(key)) {
          cookie = document.createElement('canvas'); cookie.width = cookie.height = 256;
          cookie.getContext('2d')!.drawImage(this.scratch, 0, 0);
          if (this.cookies.size >= 32) this.cookies.delete(this.cookies.keys().next().value!);
          this.cookies.set(key, cookie);
        }
      }
      c.globalAlpha = Math.min(1, light.power);
      c.drawImage(cookie, (light.x - light.radius - left) * scaleX,
        (light.y - light.radius - top) * scaleY, light.radius * 2 * scaleX, light.radius * 2 * scaleY);
    }
    const previous = this.observed; this.observed = this.nextObserved; this.nextObserved = previous;

    // Contact occlusion: a soft multiply patch where each prop meets the ground.
    // Drawn after the additive lights so trunks and rocks stay grounded even
    // inside a torch pool — the same read as WoW's baked blob shadows.
    c.globalCompositeOperation = 'multiply';
    c.globalAlpha = 1; // Contact shadows are full-strength, not the last light's power.
    const stamp = occlusionStamp();
    let contacts = 0;
    for (const prop of props) {
      if (prop.radius <= 0 || prop.kind === 'shrine') continue;
      if (prop.x < left - 40 || prop.x > left + worldWidth + 40
        || prop.y < top - 40 || prop.y > top + worldHeight + 40) continue;
      if (contacts++ >= 72) break;
      const rx = Math.min(46, prop.radius * 1.9) * prop.scale * scaleX;
      const ry = Math.min(20, prop.radius * .82) * prop.scale * scaleY;
      c.drawImage(stamp, (prop.x - left) * scaleX - rx, (prop.y - top) * scaleY - ry * .55, rx * 2, ry * 2);
    }

    c.globalAlpha = 1;
    target.save();
    target.globalCompositeOperation = 'multiply';
    target.imageSmoothingEnabled = true;
    target.drawImage(this.map, 0, 0, width, height);
    target.restore();
  }

  private cutShadows(light: PointLight, props: Prop[]) {
    const c = this.scratchContext, scale = 128 / light.radius;
    c.save();
    c.translate(128, 128); c.scale(scale, scale);
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';
    let count = 0;
    for (const prop of props) {
      if (prop.kind === 'shrine' || prop.radius <= 0) continue;
      const dx = prop.x - light.x, dy = prop.y - light.y;
      const distance = Math.hypot(dx, dy), radius = Math.max(3, prop.radius * .85);
      if (distance <= radius + 4 || distance - radius > light.radius || count++ >= 24) continue;
      const center = Math.atan2(dy, dx), spread = Math.asin(radius / distance);
      const near = Math.sqrt(distance * distance - radius * radius), far = light.radius * 1.7;
      // A wider, faint wedge softens the edge of the central shadow.
      for (const [softness, alpha] of SHADOW_PASSES) {
        const a = center - spread - softness, b = center + spread + softness;
        c.globalAlpha = alpha;
        c.beginPath();
        c.moveTo(Math.cos(a) * near, Math.sin(a) * near);
        c.lineTo(Math.cos(a) * far, Math.sin(a) * far);
        c.lineTo(Math.cos(b) * far, Math.sin(b) * far);
        c.lineTo(Math.cos(b) * near, Math.sin(b) * near);
        c.closePath(); c.fill();
      }
    }
    c.restore();
  }
}
