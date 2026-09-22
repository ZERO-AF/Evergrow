/**
 * Dungeon Finder (WotLK Looking-for-Dungeon / RDF): the queueable catalog.
 *
 * The list is derived from the same source the world doors use — every
 * `zoneContent(zone).entrances` entry that is not a raid becomes a queueable
 * dungeon, keeping the real entrance id (`atlas:<zone>:entrance:<i>`), the real
 * WoW name and the authored level range. Queuing therefore enters the same
 * dungeon run the physical door would: cleared tombstones and in-progress runs
 * are shared between the finder and walking in.
 *
 * `dungeonFinderEntrance` reproduces authored-world.ts's seed/theme derivation
 * so a queued run generates the identical floor as its world door.
 */
import { ZONES } from './world-atlas.ts';
import { zoneContent } from './zone-content.ts';
import { zoneBiome, type BiomeId } from './biomes.ts';
import { hash } from './world-landscape.ts';
import { DUNGEON_THEME_IDS, type DungeonThemeId } from './dungeon-content.ts';
import type { DungeonEntrance } from './dungeon.ts';
import type { EncounterScale } from './encounter-scaling.ts';
import { HEROIC_RULES, heroicProblem } from './heroic-content.ts';
import type { Player } from './model.ts';
import './zone-content-kalimdor.ts';
import './zone-content-eastern-kingdoms.ts';
import './zone-content-northrend.ts';
import './zone-content-outland.ts';

/** WotLK unlocks the Dungeon Finder at level 15 regardless of dungeon range. */
export const DUNGEON_FINDER_RULES = Object.freeze({ minimumLevel: 15 });

export interface DungeonFinderEntry {
  /** Stable catalog id; also the persisted `dungeonFinder.queued` value. */
  readonly id: string;
  /** The world-door entrance id this queue shares runs with. */
  readonly entranceId: string;
  readonly name: string;
  readonly zoneId: string;
  readonly zone: string;
  readonly levelMin: number;
  readonly levelMax: number;
  /** Index inside the zone's entrance table; resolves the door's seed/theme. */
  readonly index: number;
  readonly biome: BiomeId;
  readonly theme?: DungeonThemeId;
}

const ZONE_INDEX: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(Object.keys(ZONES).map((id, i) => [id, i])),
);

function catalog(): DungeonFinderEntry[] {
  const out: DungeonFinderEntry[] = [];
  for (const zone of Object.values(ZONES)) {
    const biome = zoneBiome(zone.terrain);
    for (const [i, spec] of zoneContent(zone.id).entrances.entries()) {
      if (spec.kind === 'raid') continue;
      out.push(Object.freeze({
        id: `rdf:${zone.id}:${i}`,
        entranceId: `atlas:${zone.id}:entrance:${i}`,
        name: spec.name,
        zoneId: zone.id,
        zone: zone.name,
        levelMin: spec.levelMin ?? zone.levelMin,
        levelMax: spec.levelMax ?? zone.levelMax,
        index: i,
        biome,
        theme: spec.theme,
      }));
    }
  }
  return Object.freeze(out) as unknown as DungeonFinderEntry[];
}

/** Every queueable dungeon, sorted by level range like the WotLK finder list. */
export const RDF_DUNGEONS: readonly DungeonFinderEntry[] = Object.freeze(
  [...catalog()].sort((a, b) => a.levelMin - b.levelMin || a.name.localeCompare(b.name)),
);

export const dungeonFinderDungeon = (id: string | undefined): DungeonFinderEntry | undefined =>
  id === undefined ? undefined : RDF_DUNGEONS.find(d => d.id === id);

/** Why this player cannot queue for the dungeon, or null when eligible. Heroic
 * queues ignore the normal level band — the floor pins its own level-80 scale. */
export function dungeonFinderProblem(entry: DungeonFinderEntry, player: Pick<Player, 'level' | 'dead'>, heroic = false): string | null {
  if (player.dead) return 'Recover in town first.';
  if (player.level < DUNGEON_FINDER_RULES.minimumLevel)
    return `The Dungeon Finder unlocks at level ${DUNGEON_FINDER_RULES.minimumLevel}.`;
  if (heroic) return heroicProblem(entry, player);
  if (player.level < entry.levelMin) return `Requires level ${entry.levelMin}.`;
  if (player.level > entry.levelMax) return `Requires level ${entry.levelMax} or lower.`;
  return null;
}

/** Flavor wait shown while the party "assembles"; deterministic per dungeon. */
export function dungeonFinderWaitSeconds(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return 2 + h % 4;
}

/**
 * The entrance handed to planDungeonTravel's 'enter' action. The id, seed and
 * theme match the world door exactly, so the finder shares its run; x/y are
 * the player's position — the proximity check passes and the exit portal
 * returns the player to where they queued, like WotLK's teleport-out.
 * `scaling` pins the floor to the dungeon's authored band instead of the
 * zone the player happens to be standing in.
 */
export function dungeonFinderEntrance(entry: DungeonFinderEntry, player: Pick<Player, 'x' | 'y' | 'level'>, worldSeed: number, heroic = false): DungeonEntrance {
  const seed = hash(ZONE_INDEX[entry.zoneId] ?? 0, entry.index, worldSeed, 0xd0e7) >>> 0;
  const base = heroic ? HEROIC_RULES.level : Math.max(entry.levelMin, Math.min(entry.levelMax, Math.floor(player.level)));
  const scaling: EncounterScale = heroic
    ? { base, min: HEROIC_RULES.level, max: HEROIC_RULES.level + 2, heroic: true }
    : { base, min: entry.levelMin, max: entry.levelMax };
  return {
    id: entry.entranceId,
    name: heroic ? `${entry.name} (Heroic)` : entry.name,
    seed,
    level: base,
    biome: entry.biome,
    theme: entry.theme ?? DUNGEON_THEME_IDS[seed % DUNGEON_THEME_IDS.length],
    scaling,
    x: player.x,
    y: player.y,
  };
}
