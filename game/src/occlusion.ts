/** Generalized camera-occlusion transparency (wayfinder world-t03). Any tall object —
 * tree crown, building roof, cliff overhang, large prop — whose projected silhouette
 * overlaps the segment between the camera focus and the player fades toward a target
 * alpha. This is presentation-side alpha, not a camera raycast: sources register a
 * world-space OccluderVolume (the silhouette they cast upward from their ground
 * contact), and OcclusionField owns the smoothed per-id opacity map.
 *
 * The metadata path for authored tall objects is `Prop.occluder` (same shape as the
 * prop-definition canopy): continent teams tag a prop and the renderer fades it for
 * free. Props with a canopy definition occlude through their crown automatically;
 * buildings occlude through their roof volume (settlement-art buildingOccluder). */

import { propDefinition } from './biome-props.ts';
import type { Prop } from './world-landscape.ts';

/** World-space silhouette of a tall object: the rect it occupies above the ground. */
export interface OccluderVolume {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Authoring metadata for tall props — same shape as PropDefinition.canopy. */
export interface OccluderMeta {
  /** Silhouette height above the prop's ground contact. */
  readonly height: number;
  /** Silhouette half-extent around the (offset) center. */
  readonly radius: number;
  readonly offsetX?: number;
}

/** True when the volume covers any part of the focus→player segment. The camera
 * transform is uniform, so the world-space test equals the screen-space test. */
export function occluderBlocks(volume: OccluderVolume,
  ax: number, ay: number, bx: number, by: number): boolean {
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  for (const [p, d, lo, hi] of [
    [ax, dx, volume.x, volume.x + volume.width],
    [ay, dy, volume.y, volume.y + volume.height],
  ] as const) {
    if (Math.abs(d) < 1e-12) { if (p < lo || p > hi) return false; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d;
    if (ta > tb) { const swap = ta; ta = tb; tb = swap; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** A prop's occluder volume: explicit `occluder` metadata wins, then the canopy
 * definition. The silhouette reaches from the crown top down to just below the
 * ground contact, matching the legacy crown-fade trigger. */
export function propOccluder(prop: Prop): OccluderVolume | null {
  // Explicit null disables the fade; absent/undefined falls back to the canopy definition.
  const meta = prop.occluder === undefined ? propDefinition(prop.kind).canopy : prop.occluder;
  if (!meta) return null;
  const scale = prop.scale, radius = meta.radius * scale;
  const cx = prop.x + (meta.offsetX ?? 0) * scale;
  return { x: cx - radius, y: prop.y - (meta.height + meta.radius) * scale,
    width: radius * 2, height: meta.height * scale + radius + 8 };
}

/** Per-id smoothed occluder opacity. Replaces the renderer's crownOpacity map;
 * `alphas` stays a ReadonlyMap so existing consumers (battle barks) keep working. */
export class OcclusionField {
  private readonly values = new Map<string, number>();
  private readonly capacity: number;
  constructor(capacity = 512) { this.capacity = capacity; }

  get alphas(): ReadonlyMap<string, number> { return this.values; }
  alpha(id: string): number { return this.values.get(id) ?? 1; }

  /** Advance one occluder toward its target (occluded ? faded : 1) and return the
   * smoothed value. Reduced motion snaps; otherwise the fade eases like the legacy
   * crown pass. Ids that settle back at full opacity are dropped. */
  update(id: string, occluded: boolean, dt: number, reducedMotion: boolean,
    faded = .24): number {
    const target = occluded ? faded : 1;
    if (reducedMotion) {
      if (target >= 1) this.values.delete(id);
      else this.values.set(id, target);
      return target;
    }
    let value = (this.values.get(id) ?? 1) + (target - (this.values.get(id) ?? 1)) * (1 - Math.exp(-dt * 13));
    if (!occluded && value > .995) { this.values.delete(id); return 1; }
    if (Math.abs(value - target) < .002) value = target;
    this.values.set(id, value);
    if (this.values.size > this.capacity) this.values.delete(this.values.keys().next().value!);
    return value;
  }

  delete(id: string): void { this.values.delete(id); }
  clear(): void { this.values.clear(); }
}
