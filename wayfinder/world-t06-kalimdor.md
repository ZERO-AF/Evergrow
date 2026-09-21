# T06 — Kalimdor zones

**Type:** task (AFK) · **Blocks:** T10 · **Blocked by:** T01, T02, T03

## Question

Build every Kalimdor zone at its atlas rect: terrain, elevation, roads, cities, mob camps,
and zone-appropriate spawns — faithful to WotLK.

## Zones

Durotar, Mulgore, Teldrassil, Darkshore, The Barrens (N+S), Stonetalon Mountains,
Ashenvale, Desolace, Feralas, Thousand Needles, Tanaris, Un'Goro Crater, Silithus,
Dustwallow Marsh, Azshara, Felwood, Winterspring, Moonglade, Bloodmyst Isle, Azuremyst
Isle — plus cities Orgrimmar, Thunder Bluff, Darnassus, Exodar.

## Per-zone deliverable

- Terrain palette + prop recipe matching the WoW zone (desert Durotar, red-rock Barrens,
  purple Teldrassil, crater Un'Goro, silithid Silithus…).
- Elevation: mesas (Thunder Bluff, Thousand Needles), canyons, mountains.
- Roads connecting to adjacent zones at the shared border points from the atlas.
- Cities/villages at atlas positions with buildings + NPC placeholders (T10 fills routines).
- Mob camps + zone-appropriate spawn tables (level range from atlas).
- Faction tagging (Horde-heavy Kalimdor; Alliance pockets).

## Acceptance

- Each zone renders its palette, is walkable, has correct borders/roads, and spawns
  level-appropriate mobs. `kalimdor.test.ts` samples each zone.
