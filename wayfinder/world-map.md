# Wayfinder Map — WoW World: Total Map Conversion (WotLK)

> Local-markdown tracker. This file is the map (label `wayfinder:map`). Tickets are sibling
> files `world-tNN-*.md`. Frontier = open tickets with no open blockers. Resolve one ticket
> per work session; record the answer in the ticket and gist it under Decisions so far.

## Destination

Replace Evergrow's procedural wilderness with the **complete authored WoW WotLK world**:
every continent (Kalimdor, Eastern Kingdoms, Northrend, Outland), every zone at an exact
predefined atlas position/size, elevation (cliffs/valleys/ramps), correct camera with
occlusion transparency, walkable roads, ships/zeppelins/portals/flight-paths for
intercontinental travel, every dungeon entrance, every city/village/mob-camp/vendor,
Alliance/Horde factions with race-correct starting zones and faction hostility, NPC daily
routines and zone quests. Travel must feel WoW-scale — a 40-minute journey stays 40 minutes.

## Notes

- Domain: 2D WoW-like ARPG, Vite+TS, no runtime deps. Deterministic 120 Hz sim.
- Read `docs/architecture.md`, `docs/world-generation.md`, `docs/biomes.md`,
  `docs/explored-atlas.md`, `docs/settlements.md`, `docs/wilderness-and-encounters.md` first.
- The world is currently procedural (seeded climate field → terrain/props/collision). The
  conversion swaps the *source* of truth to an authored atlas while keeping the
  `World`/`WorldQuery` interface, renderer, collision and exploration-chart consumers.
- WoW data lives in `wayfinder/wow-zones.json` (T01 research output) — the authoritative
  zone/transport dataset the atlas is built from.
- Keep it local; no Sites/deploy. Player does gameplay testing.
- All tests + `npx tsc --noEmit` + `tsconfig.core.json` must stay green.

## Decisions so far

- [T01 World atlas contract + WoW zone data](world-t01-atlas.md) — `world-atlas.ts`: 62 zones at fixed rects (validated non-overlapping), 193 transports, 154 cities, 70 dungeons, 137 flightpaths; ATLAS_SCALE=24 u/yd matches WoW travel times; `wow-zones.json` is the content source.

## Not yet specified

- Per-zone terrain palettes & prop sets (which WoW zone maps to which visual recipe).
- Named-location density: exact mob camps, quest hubs, rare spawns per zone.
- Dungeon interiors for the ~40 WotLK instances (entrances are in scope; full interior
  layouts may graduate into per-dungeon tickets).
- Raid content (Naxxramas, Ulduar, ICC…) — entrances yes, full raid encounters likely a
  later effort.
- Flying (Northrend/Outland flight) — engine is ground-based; mounts/flight is its own fog.

## Out of scope

- Real networked multiplayer (single-player world; NPCs fill it).
- Post-WotLK zones (Cataclysm revamp, Pandaria, etc).
- Playable inside-dungeon raid bosses beyond entrance placement (unless graduated).

## Tickets

- [T01 World atlas contract + WoW zone data](world-t01-atlas.md)
- [T02 Authored-world provider](world-t02-provider.md)
- [T03 Elevation + camera occlusion](world-t03-elevation.md)
- [T04 Transport network](world-t04-transport.md)
- [T05 Factions + race starts](world-t05-factions.md)
- [T06 Kalimdor zones](world-t06-kalimdor.md)
- [T07 Eastern Kingdoms zones](world-t07-eastern-kingdoms.md)
- [T08 Northrend zones](world-t08-northrend.md)
- [T09 Outland zones](world-t09-outland.md)
- [T10 Content density: dungeons, vendors, routines, quests](world-t10-content.md)
- [T11 Review gates + travel-time validation](world-t11-review.md)
