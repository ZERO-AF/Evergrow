/** Per-zone ground/ambient tints keyed by the atlas `terrain` string.
 *
 * The shared biome palettes (biomes.ts) only carry nine climates; authored WoW
 * zones need their own ground color so Teldrassil reads purple, Durotar red,
 * Nagrand green, Netherstorm violet and Shadowmoon fel-green. `ground` is the
 * zone's dominant soil/foliage color, `ambient` tints fog/light. Both are
 * blended over the biome base by the terrain strength in world-landscape. */
export interface ZoneTint {
  readonly ground: readonly [number, number, number];
  readonly ambient: readonly [number, number, number];
}

const t = (ground: [number, number, number], ambient: [number, number, number]): ZoneTint =>
  Object.freeze({ ground: Object.freeze(ground), ambient: Object.freeze(ambient) });

export const TERRAIN_TINT: Readonly<Record<string, ZoneTint>> = Object.freeze({
  // ── Kalimdor ──────────────────────────────────────────────────────────────
  'purple world-tree forest': t([64, 52, 86], [150, 122, 178]),       // Teldrassil violet canopy
  'corrupted red-crystal isle': t([96, 52, 58], [196, 120, 122]),     // Bloodmyst red crystals
  'crystalline pine isle': t([52, 78, 70], [150, 190, 190]),          // Azuremyst teal pines
  'sacred druid forest': t([40, 66, 40], [140, 180, 140]),            // Moonglade deep green
  'snowy mountains': t([120, 132, 148], [190, 205, 225]),             // Winterspring snow
  'gloomy coastal forest': t([44, 56, 52], [120, 140, 140]),          // Darkshore gloom
  'corrupted forest': t([58, 62, 44], [150, 160, 110]),               // Felwood sickly green
  'autumnal cliffs and naga ruins': t([110, 92, 60], [200, 170, 120]),// Azshara gold cliffs
  'dark ancient forest': t([36, 52, 40], [110, 140, 120]),            // Ashenvale deep forest
  'arid red canyon': t([150, 84, 56], [220, 150, 110]),               // Durotar red rock
  'rocky peaks and charred vale': t([96, 78, 66], [180, 160, 140]),   // Stonetalon brown peaks
  'savanna': t([150, 132, 78], [220, 200, 140]),                      // Barrens golden grass
  'dry savanna and razorfen brambles': t([140, 122, 70], [210, 190, 130]),
  'murky swamp': t([52, 62, 44], [130, 150, 120]),                    // Dustwallow murk
  'grey barren wastes': t([104, 100, 92], [170, 168, 158]),           // Desolace grey
  'green plains and mesas': t([96, 122, 62], [190, 210, 140]),        // Mulgore green
  'canyon needles and salt flats': t([168, 140, 96], [225, 200, 150]),// Thousand Needles tan
  'lush jungle forest': t([40, 74, 40], [130, 180, 130]),             // Feralas jungle
  'desert': t([196, 168, 116], [235, 215, 165]),                      // Tanaris sand
  'prehistoric jungle crater': t([50, 84, 46], [140, 190, 140]),      // Un'Goro lush crater
  'silithid desert': t([172, 148, 96], [225, 200, 140]),              // Silithus sand+hives
  // ── Eastern Kingdoms ──────────────────────────────────────────────────────
  'golden autumn forest': t([150, 122, 58], [220, 185, 110]),         // Eversong gold
  'sunlit elven isle': t([120, 130, 80], [210, 215, 160]),            // Quel'Danas bright
  'dead haunted forest': t([48, 46, 44], [110, 108, 110]),            // Ghostlands grey
  'forsaken woodland': t([58, 56, 62], [130, 128, 140]),              // Tirisfal cold gloom
  'plagued farmland': t([96, 92, 62], [170, 165, 130]),               // WPL plagued brown
  'blighted deadlands': t([84, 78, 56], [160, 152, 118]),             // EPL blight
  'dark pine forest': t([40, 50, 44], [110, 125, 120]),               // Silverpine dark pine
  'green foothills': t([86, 110, 58], [185, 200, 140]),               // Hillsbrad green
  'forested troll highlands': t([70, 96, 54], [170, 195, 130]),       // Hinterlands green
  'snowy ogre highlands': t([118, 128, 140], [190, 200, 218]),        // Alterac snow
  'grassy highlands': t([104, 118, 62], [195, 205, 140]),             // Arathi grass
  'marsh': t([56, 66, 48], [135, 150, 125]),                          // Wetlands marsh
  'snowy dwarf highlands': t([122, 132, 146], [195, 205, 222]),       // Dun Morogh snow
  'highland lake': t([88, 104, 66], [180, 195, 145]),                 // Loch Modan lake
  'volcanic gorge': t([72, 52, 46], [170, 120, 100]),                 // Searing Gorge ash
  'scorched badlands': t([128, 96, 66], [205, 165, 120]),             // Badlands ochre
  'ashen volcanic steppes': t([80, 62, 54], [175, 135, 115]),         // Burning Steppes ash
  'green forest': t([64, 96, 48], [170, 200, 130]),                   // Elwynn green
  'dry farmland': t([150, 128, 76], [215, 190, 130]),                 // Westfall wheat
  'red mountain ridges': t([128, 82, 60], [200, 140, 110]),           // Redridge red rock
  'haunted dark forest': t([40, 44, 40], [100, 105, 105]),            // Duskwood dark
  'dead canyon pass': t([70, 60, 54], [140, 125, 115]),               // Deadwind Pass
  'swamp': t([54, 62, 46], [130, 145, 120]),                          // Swamp of Sorrows
  'fel-scorched wastes': t([96, 74, 52], [185, 140, 105]),            // Blasted Lands
  'dense jungle': t([42, 76, 42], [135, 180, 130]),                   // Stranglethorn jungle
  // ── Northrend ─────────────────────────────────────────────────────────────
  'frozen tundra': t([110, 124, 140], [185, 200, 220]),               // Borean Tundra
  'tropical jungle basin': t([46, 82, 46], [140, 190, 140]),          // Sholazar jungle
  'dragon graveyard wastes': t([104, 108, 118], [175, 180, 200]),     // Dragonblight snow+bone
  'redwood hills': t([78, 92, 58], [170, 190, 140]),                  // Grizzly Hills redwood
  'troll temple ziggurats': t([96, 104, 110], [170, 180, 195]),       // Zul'Drak cold stone
  'crystalline forest': t([96, 110, 128], [185, 200, 225]),           // Crystalsong teal-violet
  'titan ice mountains': t([116, 128, 144], [190, 205, 228]),         // Storm Peaks ice
  'scourge glacier and citadel': t([88, 96, 112], [160, 175, 205]),   // Icecrown dark ice
  'fjord cliffs and pine forest': t([70, 88, 72], [160, 185, 175]),   // Howling Fjord
  'frozen battlefield lake': t([104, 116, 132], [180, 195, 218]),     // Wintergrasp
  // ── Outland ───────────────────────────────────────────────────────────────
  'fel-red shattered wastes': t([120, 62, 52], [200, 110, 95]),       // Hellfire fel-red
  'giant mushroom swamp': t([62, 74, 66], [140, 165, 155]),           // Zangarmarsh teal
  'misty forest and bone wastes': t([86, 84, 74], [160, 160, 150]),   // Terokkar bone
  'fel-green volcanic valley': t([78, 92, 48], [160, 185, 100]),      // Shadowmoon fel-green
  'green floating-island plains': t([92, 122, 62], [185, 210, 140]),  // Nagrand green
  'spiky ogre mountains': t([104, 92, 74], [180, 165, 140]),          // Blade's Edge
  'arcane shattered islands': t([88, 66, 110], [170, 140, 210]),      // Netherstorm violet
});

/** Ground tint for an authored zone's terrain, or null to keep the biome base. */
export function terrainTint(terrain: string): ZoneTint | null {
  return TERRAIN_TINT[terrain] ?? null;
}
