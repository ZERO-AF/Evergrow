/**
 * Dungeon Finder (WotLK Looking-for-Dungeon / RDF + raid browser): the
 * queueable catalog.
 *
 * The list is derived from the same source the world doors use — every
 * `zoneContent(zone).entrances` entry becomes a queueable row: dungeons keep
 * the real entrance id (`atlas:<zone>:entrance:<i>`) while raids resolve to
 * the dedicated arena id (`dungeon:raid:*`) or the themed raid-floor id
 * (`dungeon:atlas:<zone>:<i>`), exactly like authored-world.ts. Queuing
 * therefore enters the same run the physical door would: cleared tombstones,
 * in-progress runs and weekly raid lockouts are shared between the finder and
 * walking in.
 *
 * `dungeonFinderEntrance` reproduces authored-world.ts's seed/theme derivation
 * so a queued run generates the identical floor as its world door.
 */
import { ZONES } from './world-atlas.ts';
import { zoneContent } from './zone-content.ts';
import { zoneBiome, type BiomeId } from './biomes.ts';
import { hash2 } from './random-source.ts';
import { DUNGEON_THEME_IDS, dungeonTheme, type DungeonThemeId } from './dungeon-content.ts';
import type { DungeonEntrance } from './dungeon.ts';
import type { EncounterScale } from './encounter-scaling.ts';
import { HEROIC_RULES, heroicProblem } from './heroic-content.ts';
import type { Player } from './model.ts';
import './zone-content-kalimdor.ts';
import './zone-content-eastern-kingdoms.ts';
import './zone-content-northrend.ts';
import './zone-content-outland.ts';
import { raidLockedOut, raidLockoutLabel, type RaidLockoutCarrier } from './raid-lockout.ts';
import { RAID_ENTRANCE_ID, RAID_BOSS_NAME } from './raid-boss-content.ts';
import { RAID2_ENTRANCE_ID, RAID2_BOSS_NAME } from './raid2-boss-content.ts';
import { RAID3_ENTRANCE_ID, RAID3_BOSS_NAME } from './raid3-boss-content.ts';
import { RAID4_ENTRANCE_ID, RAID4_BOSS_NAME } from './raid4-boss-content.ts';
import { RAID5_ENTRANCE_ID, RAID5_BOSS_NAME } from './raid5-boss-content.ts';
import { RAID6_ENTRANCE_ID, RAID6_BOSS_NAME } from './raid6-boss-content.ts';
import { RAID7_ENTRANCE_ID, RAID7_BOSS_NAME } from './raid7-boss-content.ts';
import { RAID8_ENTRANCE_ID, RAID8_BOSS_NAME } from './raid8-boss-content.ts';
import { RAID9_ENTRANCE_ID, RAID9_BOSS_NAME } from './raid9-boss-content.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';

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
  /** 'raid' rows live on the Raids tab and respect the weekly lockout. */
  readonly kind: 'dungeon' | 'raid';
  /** Final boss shown on raid rows; undefined only for a theme-less raid. */
  readonly boss?: string;
}

const ZONE_INDEX: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(Object.keys(ZONES).map((id, i) => [id, i])),
);

/** Authored raid name → dedicated arena door + final boss, mirroring
 * authored-world.ts's AUTHORED_RAID_IDS. Raids absent here keep the themed
 * `dungeon:atlas:` door and never carry a weekly lockout. */
const RAID_ARENAS: Readonly<Record<string, { id: string; boss: string }>> = Object.freeze(
  Object.fromEntries([
    { id: RAID_ENTRANCE_ID, name: "Onyxia's Lair", boss: RAID_BOSS_NAME },
    { id: RAID2_ENTRANCE_ID, name: 'Molten Core', boss: RAID2_BOSS_NAME },
    { id: RAID3_ENTRANCE_ID, name: 'Naxxramas', boss: RAID3_BOSS_NAME },
    { id: RAID4_ENTRANCE_ID, name: 'Icecrown Citadel', boss: RAID4_BOSS_NAME },
    { id: RAID5_ENTRANCE_ID, name: 'Eye of Eternity', boss: RAID5_BOSS_NAME },
    { id: RAID6_ENTRANCE_ID, name: 'Obsidian Sanctum', boss: RAID6_BOSS_NAME },
    { id: RAID7_ENTRANCE_ID, name: 'Ulduar', boss: RAID7_BOSS_NAME },
    { id: RAID8_ENTRANCE_ID, name: 'Trial of the Crusader', boss: RAID8_BOSS_NAME },
    { id: RAID9_ENTRANCE_ID, name: 'Ruby Sanctum', boss: RAID9_BOSS_NAME },
  ].map(r => [r.name.toLowerCase(), { id: r.id, boss: r.boss }])),
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
        kind: 'dungeon',
        theme: spec.theme,
      }));
    }
  }
  return Object.freeze(out) as unknown as DungeonFinderEntry[];
}

/** The boss a themed raid floor actually fields: the theme's named boss, or
 * the display name of the kind dungeon.ts falls back to (warden/matriarch/
 * colossus). Theme-less raids keep no label — their boss is seed-rolled. */
function raidBossLabel(theme: DungeonThemeId | undefined): string | undefined {
  if (!theme) return undefined;
  const t = dungeonTheme(0, theme);
  const kind = t.boss ?? (t.id === 'foundry' ? 'ashColossus' : t.id === 'drowned' ? 'briarMatriarch' : 'warden');
  return t.bossName ?? ENEMY_DEFINITIONS[kind].name;
}

/** Every authored raid, resolved to the same door id the world gate uses. */
function raidCatalog(): DungeonFinderEntry[] {
  const out: DungeonFinderEntry[] = [];
  for (const zone of Object.values(ZONES)) {
    const biome = zoneBiome(zone.terrain);
    for (const [i, spec] of zoneContent(zone.id).entrances.entries()) {
      if (spec.kind !== 'raid') continue;
      const arena = RAID_ARENAS[spec.name.toLowerCase()];
      out.push(Object.freeze({
        id: `rdf:${zone.id}:${i}`,
        entranceId: arena?.id ?? `dungeon:atlas:${zone.id}:${i}`,
        name: spec.name,
        zoneId: zone.id,
        zone: zone.name,
        levelMin: spec.levelMin ?? zone.levelMin,
        levelMax: spec.levelMax ?? zone.levelMax,
        index: i,
        biome,
        kind: 'raid',
        boss: arena?.boss ?? raidBossLabel(spec.theme),
        theme: spec.theme,
      }));
    }
  }
  return Object.freeze(out) as unknown as DungeonFinderEntry[];
}

/** Every queueable raid, sorted like the dungeon list. */
export const RDF_RAIDS: readonly DungeonFinderEntry[] = Object.freeze(
  [...raidCatalog()].sort((a, b) => a.levelMin - b.levelMin || a.name.localeCompare(b.name)),
);

/** Every queueable dungeon, sorted by level range like the WotLK finder list. */
export const RDF_DUNGEONS: readonly DungeonFinderEntry[] = Object.freeze(
  [...catalog()].sort((a, b) => a.levelMin - b.levelMin || a.name.localeCompare(b.name)),
);

/** The catalog row behind a queue id — dungeons and raids share the id space. */
export const dungeonFinderDungeon = (id: string | undefined): DungeonFinderEntry | undefined =>
  id === undefined ? undefined : RDF_DUNGEONS.find(d => d.id === id) ?? RDF_RAIDS.find(d => d.id === id);

/** Why this player cannot queue for the entry, or null when eligible. Heroic
 * queues ignore the normal level band — the floor pins its own level-80 scale;
 * raids have no heroic mode. A raid inside its weekly lockout reports
 * 'Locked · resets <label>' so the row can show the countdown verbatim. */
export function dungeonFinderProblem(entry: DungeonFinderEntry, player: Pick<Player, 'level' | 'dead'> & { character?: RaidLockoutCarrier }, heroic = false, now = Date.now()): string | null {
  if (player.dead) return 'Recover in town first.';
  if (player.level < DUNGEON_FINDER_RULES.minimumLevel)
    return `The Dungeon Finder unlocks at level ${DUNGEON_FINDER_RULES.minimumLevel}.`;
  if (entry.kind === 'raid' && player.character && raidLockedOut(player.character, entry.entranceId, now))
    return `Locked · resets ${raidLockoutLabel(player.character, entry.entranceId, now)}`;
  if (heroic && entry.kind !== 'raid') return heroicProblem(entry, player);
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
  const seed = hash2(ZONE_INDEX[entry.zoneId] ?? 0, entry.index, worldSeed, 0xd0e7) >>> 0;
  const heroicMode = heroic && entry.kind !== 'raid';
  const base = heroicMode ? HEROIC_RULES.level : Math.max(entry.levelMin, Math.min(entry.levelMax, Math.floor(player.level)));
  const scaling: EncounterScale = heroicMode
    ? { base, min: HEROIC_RULES.level, max: HEROIC_RULES.level + 2, heroic: true }
    : { base, min: entry.levelMin, max: entry.levelMax };
  return {
    id: entry.entranceId,
    name: heroicMode ? `${entry.name} (Heroic)` : entry.name,
    seed,
    level: base,
    biome: entry.biome,
    theme: entry.theme ?? DUNGEON_THEME_IDS[seed % DUNGEON_THEME_IDS.length],
    scaling,
    x: player.x,
    y: player.y,
  };
}
