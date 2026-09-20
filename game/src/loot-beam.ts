import type { GroundItem, ItemTier } from './character-types.ts';
import type { PointLight } from './light-types.ts';
import { treasurePose, TREASURE_FLIGHT_DURATION } from './treasure-flight.ts';

/** Diablo-style rarity beam tuning: pillar size, ground glow and rising motes. */
export interface LootBeamSpec {
  /** Beam hue; a brighter, luminous sibling of the item's TIER_COLORS text. */
  readonly color: string;
  /** Near-white hot core running inside the pillar. */
  readonly core: string;
  /** World units the pillar rises above the item. */
  readonly height: number;
  /** Pillar half-width at the base. */
  readonly width: number;
  /** Ground glow radius. */
  readonly glow: number;
  /** Rising sparkle count inside the pillar. */
  readonly motes: number;
  /** Peak pillar opacity. */
  readonly alpha: number;
  /** PointLight power contributed while the beam is on screen (0 = none). */
  readonly light: number;
}

/** Spec palette: white / blue / yellow / purple / orange / pink (unique keeps its item color). */
export const LOOT_BEAMS: Readonly<Record<ItemTier, LootBeamSpec>> = Object.freeze({
  common:    { color: '#e8f0e9', core: '#ffffff', height: 64,  width: 5,   glow: 22, motes: 2, alpha: .30, light: 0 },
  magic:     { color: '#6fb4ff', core: '#d8ecff', height: 84,  width: 6,   glow: 30, motes: 3, alpha: .42, light: .18 },
  rare:      { color: '#ffd75e', core: '#fff3c4', height: 104, width: 7,   glow: 38, motes: 4, alpha: .52, light: .3 },
  epic:      { color: '#c08bff', core: '#ecd9ff', height: 122, width: 8,   glow: 46, motes: 5, alpha: .60, light: .42 },
  legendary: { color: '#ff9e4f', core: '#ffe3bd', height: 148, width: 9.5, glow: 56, motes: 7, alpha: .70, light: .6 },
  unique:    { color: '#ff8fb8', core: '#ffd9e8', height: 148, width: 9.5, glow: 56, motes: 7, alpha: .70, light: .6 },
});

export interface LootBeamAnchor {
  readonly drop: GroundItem;
  readonly x: number;
  readonly y: number;
  readonly spec: LootBeamSpec;
  /** 0→1 fade-in once the treasure flight has landed. */
  readonly fade: number;
}

/**
 * Beam anchors mirror lootPositions() in loot-art.ts so pillars rise from the
 * drawn silhouettes in a multi-item drop. Keep the grouping math in sync.
 */
export function lootBeamAnchors(drops: readonly GroundItem[], worldTime: number, reducedMotion = false): LootBeamAnchor[] {
  const groups = new Map<string, GroundItem[]>();
  for (const drop of drops) {
    const key = `${drop.x}:${drop.y}`;
    const group = groups.get(key) ?? []; group.push(drop); groups.set(key, group);
  }
  const anchors: LootBeamAnchor[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.id - b.id).forEach((drop, i) => {
      const pose = treasurePose(drop, worldTime, reducedMotion);
      if (!pose.landed) return;
      const landedAt = drop.flight ? drop.flight.at + drop.flight.delay + TREASURE_FLIGHT_DURATION : -Infinity;
      anchors.push({
        drop,
        x: drop.x + (i - (group.length - 1) / 2) * 19,
        y: drop.y + (group.length > 1 ? Math.sin(i * 2.4) * 5 : 0),
        spec: LOOT_BEAMS[drop.item.tier],
        fade: Math.min(1, Math.max(0, (worldTime - landedAt) / .3)),
      });
    });
  }
  return anchors;
}

/** Rare-and-up beams feed the lighting pass; capped like every other light list. */
export function lootBeamLights(anchors: readonly LootBeamAnchor[]): PointLight[] {
  return anchors
    .filter(a => a.spec.light > 0 && a.fade > 0)
    .map(a => ({ x: a.x, y: a.y - a.spec.height * .3, radius: a.spec.glow * 2.6, color: a.spec.color, power: a.spec.light * a.fade }))
    .slice(-4);
}
