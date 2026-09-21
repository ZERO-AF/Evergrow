# T08 — Northrend zones

**Type:** task (AFK) · **Blocks:** T10 · **Blocked by:** T01, T02, T03

## Question

Build every Northrend zone at its atlas rect: terrain, elevation, roads, cities, mob
camps, and zone-appropriate spawns — faithful to WotLK.

## Zones

Borean Tundra, Howling Fjord, Dragonblight, Grizzly Hills, Zul'Drak, Sholazar Basin,
The Storm Peaks, Icecrown, Crystalsong Forest, Wintergrasp — plus Dalaran (floating city).

## Per-zone deliverable

- Terrain palette + prop recipe matching the WoW zone (tundra, fjord cliffs, dragonshrine
  Dragonblight, jungle Sholazar, ice/snow Storm Peaks + Icecrown, crystalline Crystalsong).
- Elevation: fjord cliffs, mountain Storm Peaks, Icecrown's tiered citadel terraces,
  Sholazar's below-sea-level basin ringed by cliffs.
- Roads connecting zones at shared border points.
- Cities/villages + Dalaran at atlas positions with buildings + NPC placeholders.
- Mob camps + zone-appropriate spawn tables (level range from atlas, 68-80).
- Faction tagging (Alliance Valiance/Warsong holds, neutral hubs, Scourge Icecrown).

## Acceptance

- Each zone renders its palette, is walkable, has correct borders/roads, and spawns
  level-appropriate mobs. `northrend.test.ts` samples each zone.
