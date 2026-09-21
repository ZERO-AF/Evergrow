# T07 — Eastern Kingdoms zones

**Type:** task (AFK) · **Blocks:** T10 · **Blocked by:** T01, T02, T03

## Question

Build every Eastern Kingdoms zone at its atlas rect: terrain, elevation, roads, cities,
mob camps, and zone-appropriate spawns — faithful to WotLK.

## Zones

Elwynn Forest, Dun Morogh, Tirisfal Glades, Loch Modan, Westfall, Redridge Mountains,
Duskwood, Wetlands, Hillsbrad Foothills, Arathi Highlands, Alterac Mountains, Silverpine
Forest, The Hinterlands, Western Plaguelands, Eastern Plaguelands, Badlands, Searing
Gorge, Burning Steppes, Swamp of Sorrows, Blasted Lands, Deadwind Pass, Stranglethorn
Vale, Eversong Woods, Ghostlands — plus cities Stormwind, Ironforge, Undercity,
Silvermoon.

## Per-zone deliverable

- Terrain palette + prop recipe matching the WoW zone (green Elwynn, snowy Dun Morogh,
  dead Plaguelands, volcanic Searing Gorge/Burning Steppes, jungle Stranglethorn…).
- Elevation: mountain ranges (Dun Morogh, Alterac, Redridge), the Thandol Span, Blackrock.
- Roads connecting to adjacent zones at the shared border points from the atlas.
- Cities/villages at atlas positions with buildings + NPC placeholders.
- Mob camps + zone-appropriate spawn tables (level range from atlas).
- Faction tagging (Alliance-heavy south, contested north, Horde Undercity/Silvermoon).

## Acceptance

- Each zone renders its palette, is walkable, has correct borders/roads, and spawns
  level-appropriate mobs. `eastern-kingdoms.test.ts` samples each zone.
