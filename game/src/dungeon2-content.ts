import type { DungeonEntrance, DungeonProp } from './dungeon.ts';
import type { DungeonTheme, DungeonThemeId, DungeonEventKind } from './dungeon-content.ts';
import type { WorldLandscape } from './world-landscape.ts';
import type { WildernessKind } from './wilderness-sites.ts';
import type { EnemyKind } from './model.ts';
import type { BiomeId } from './biomes.ts';
import { getZoneAt } from './zone-progression.ts';
import { GAME_FEATURES } from './game-features.ts';

/**
 * Second dungeon theme (docs/wow-deepening.md §16): Blackrock Depths — the real
 * WoW fire/forge dungeon. Dark Iron halls, slag channels and the Black Forge.
 * Everything the theme needs is data: the integrator registers BLACKROCK_DEPTHS
 * into DUNGEON_THEMES and the existing DungeonWorld plumbing (layout, roster,
 * events, boss, chests, map, lighting) picks it up unchanged.
 *
 * BLACKROCK_THEME_ID is typed as DungeonThemeId ahead of registration so this file
 * compiles against the frozen union; the cast is confined to pendingThemeId and
 * becomes a no-op once 'blackrock' joins the union in dungeon-content.ts.
 */
const pendingThemeId = (id: string) => id as DungeonThemeId;
export const BLACKROCK_THEME_ID: DungeonThemeId = pendingThemeId('blackrock');
export const isBlackrockTheme = (id: DungeonThemeId | undefined): boolean => id === BLACKROCK_THEME_ID;

export const BLACKROCK_DEPTHS: DungeonTheme = Object.freeze({
    id: BLACKROCK_THEME_ID,
    name: 'Blackrock Depths',
    // Magmus — the molten giant guarding the Iron Hall — matches the ashColossus
    // model and its sweep/eruption/fracture fire kit. (Emperor Dagran Thaurissan
    // is the canonical final boss if a Dark Iron humanoid boss kind ever lands.)
    bossName: 'Magmus',
    description: 'Dark Iron halls, slag channels and the Black Forge still burning below.',
    ambient: '#1d0f10',
    stone: [84, 52, 44] as const,
    floor: [66, 44, 40] as const,
    accent: '#ff8a4a',
    light: '#ffb066',
    map: '#5a3229',
    wall: '#d99a6a',
    // Dark Iron garrison, mapped onto the frozen EnemyKind union (real BRD mobs):
    //   brute        → Anvilrage Guardsman
    //   emberAcolyte → Twilight Emissary
    //   hound        → Bloodhound Mastiff
    //   duneScuttler → Flamekin
    //   caster       → Doomforge Arcanasmith

    roster: ['brute', 'emberAcolyte', 'hound', 'duneScuttler', 'caster'] as const,
    // Ashbound Colossus already runs the wilderness-boss AI (sweep/eruption/fracture,
    // fire bolts, phase thresholds) and its molten palette matches the theme.
    boss: 'ashColossus',
});

/** Perimeter prop mix for generateDungeon's alcove pass — reuses existing DungeonProp kinds. */
export const BLACKROCK_PROP_KINDS: readonly DungeonProp['kind'][] = Object.freeze(['furnace', 'anvil', 'furnace', 'barrel'] as const);

/** Optional room-dimension override for buildDungeonLayout: the Depths are famously sprawling. */
export const BLACKROCK_ROOM_DIMENSIONS = Object.freeze([[768, 576], [640, 704], [896, 512]] as const);

/** Optional event recipe override for the two treasure rooms (first, second). */
export const BLACKROCK_EVENT_KINDS: readonly [DungeonEventKind, DungeonEventKind] = Object.freeze(['champion', 'ward'] as const);

/** Optional boss-room retinue override for the four buried wave members (i % 2 indexed): Twilight's Hammer Emissaries and Anvilrage Wardens. */
export const BLACKROCK_RETINUE: readonly [EnemyKind, EnemyKind] = Object.freeze(['emberAcolyte', 'brute'] as const);

/** Surface biome the theme belongs to — our 'emberfall' biome stands in for Searing Gorge / the Burning Steppes. Also the expedition-route biome mapping. */
export const BLACKROCK_BIOME: BiomeId = 'emberfall';

export const BLACKROCK_ENTRANCE_ID = 'dungeon:blackrock';
/** Wilderness anchors that expose a Depths gate: the Dark Iron city sits under its colossus lairs and old workings. */
export const BLACKROCK_ANCHOR_KINDS: readonly WildernessKind[] = Object.freeze(['bossLair', 'quarry'] as const);
const ENTRANCE_SEED_SALT = 0x1eaf11;

/**
 * Guaranteed Blackrock Depths entrances, anchored to emberfall-biome boss lairs and
 * quarries. Mirrors dungeonEntrances(): deterministic placement on a clear ring
 * around the site's approach, same level/biome rules. Concatenate into
 * dungeonEntrances() (or getDungeonEntrances) so gates render, enter and list as POIs.
 */
export function blackrockEntrances(world: Pick<WorldLandscape, 'seed' | 'getWildernessSites' | 'blocked' | 'isSanctuary' | 'sampleBiome'>, x: number, y: number, w: number, h: number): DungeonEntrance[] {
    if (!GAME_FEATURES.dungeon2 || ![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 100000 || h > 100000)
        return [];
    const out: DungeonEntrance[] = [];
    for (const site of world.getWildernessSites(x - 220, y - 220, w + 440, h + 440)) {
        if (site.biome !== BLACKROCK_BIOME || !BLACKROCK_ANCHOR_KINDS.includes(site.kind))
            continue;
        for (let i = 0; i < 16; i++) {
            const a = i * Math.PI / 8, px = site.entrance.x + Math.cos(a) * 160, py = site.entrance.y + Math.sin(a) * 160;
            if (px < x || py < y || px >= x + w || py >= y + h)
                continue;
            if (!world.blocked(px, py, 40) && !world.isSanctuary(px, py)) {
                out.push({ id: `${BLACKROCK_ENTRANCE_ID}:${site.id}`, theme: BLACKROCK_THEME_ID, name: BLACKROCK_DEPTHS.name,
                    x: px, y: py, seed: (site.seed ^ ENTRANCE_SEED_SALT) >>> 0,
                    level: Math.min(1e6, getZoneAt(px, py, world.seed).level + 1), biome: world.sampleBiome(px, py).id });
                break;
            }
        }
    }
    return out;
}
