import type { GroundItem, ItemTier } from './character-types.ts';
import type { PointLight } from './light-types.ts';
import { treasurePose, TREASURE_FLIGHT_DURATION } from './treasure-flight.ts';
import { lootFilterHides, type LootFilterMode } from './loot.ts';

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
  /** Ground ring pulse period in seconds on high-rarity drops (0 = none). */
  readonly pulse: number;
}

/** Spec palette follows TIER_COLORS: white / green / blue / purple / orange / pink (unique keeps its item color). */
export const LOOT_BEAMS: Readonly<Record<ItemTier, LootBeamSpec>> = Object.freeze({
  common:    { color: '#e8f0e9', core: '#ffffff', height: 56,  width: 4.5, glow: 20, motes: 2, alpha: .26, light: 0,   pulse: 0 },
  magic:     { color: '#5ee06e', core: '#dcffde', height: 84,  width: 6,   glow: 30, motes: 3, alpha: .42, light: .18, pulse: 0 },
  rare:      { color: '#5e9de0', core: '#d8ecff', height: 108, width: 7,   glow: 38, motes: 4, alpha: .54, light: .3,  pulse: 0 },
  epic:      { color: '#c08bff', core: '#ecd9ff', height: 138, width: 8.5, glow: 50, motes: 6, alpha: .66, light: .48, pulse: 2.2 },
  legendary: { color: '#ff9e4f', core: '#ffe3bd', height: 172, width: 10,  glow: 62, motes: 8, alpha: .78, light: .7,  pulse: 1.6 },
  unique:    { color: '#ff8fb8', core: '#ffd9e8', height: 172, width: 10,  glow: 62, motes: 8, alpha: .78, light: .7,  pulse: 1.6 },
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
export function lootBeamAnchors(drops: readonly GroundItem[], worldTime: number, reducedMotion = false, filter: LootFilterMode = 'off'): LootBeamAnchor[] {
  const groups = new Map<string, GroundItem[]>();
  for (const drop of drops) {
    const key = `${drop.x}:${drop.y}`;
    const group = groups.get(key) ?? []; group.push(drop); groups.set(key, group);
  }
  const anchors: LootBeamAnchor[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.id - b.id).forEach((drop, i) => {
      const pose = treasurePose(drop, worldTime, reducedMotion);
      // Filtered drops keep their spread slot so surviving beams stay aligned.
      if (!pose.landed || lootFilterHides(drop.item.tier, filter)) return;
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
