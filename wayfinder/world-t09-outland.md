# T09 — Outland zones

**Type:** task (AFK) · **Blocks:** T10 · **Blocked by:** T01, T02, T03

## Question

Build every Outland zone at its atlas rect: terrain, elevation, roads, cities, mob camps,
and zone-appropriate spawns — faithful to WotLK-era Outland.

## Zones

Hellfire Peninsula, Zangarmarsh, Terokkar Forest, Nagrand, Blade's Edge Mountains,
Netherstorm, Shadowmoon Valley — plus Shattrath City.

## Per-zone deliverable

- Terrain palette + prop recipe matching the WoW zone (fel-red Hellfire, mushroom-swamp
  Zangarmarsh, forest Terokkar, green Nagrand, spiky Blade's Edge, arcane Netherstorm,
  fel-green Shadowmoon).
- Elevation: Hellfire ramparts, Zangarmarsh mushroom caps, Blade's Edge spikes,
  Netherstorm's floating-island feel (bounded), Shadowmoon's fel volcano.
- Roads connecting zones at shared border points.
- Cities/villages + Shattrath at atlas positions with buildings + NPC placeholders.
- Mob camps + zone-appropriate spawn tables (level range from atlas, 58-70).
- Faction tagging (Honor Hold/Thrallmar, neutral Shattrath, Aldor/Scryer).

## Acceptance

- Each zone renders its palette, is walkable, has correct borders/roads, and spawns
  level-appropriate mobs. `outland.test.ts` samples each zone.
