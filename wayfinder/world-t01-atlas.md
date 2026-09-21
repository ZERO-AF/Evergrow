# T01 — World atlas contract + WoW zone data

**Type:** task (AFK) · **Blocks:** T02, T03, T04, T05, T06, T07, T08, T09 · **Blocked by:** —

## Question

What is the single authoritative data contract that pins every WoW zone to an exact
rectangle in world space — and what is the complete WotLK zone/transport dataset that
fills it?

## Why first

Every continent team (T06–T09) and every system (provider, transport, factions) consumes
this atlas. Positions must be **100% defined here** so zones merge at exact coordinates —
no agent invents a zone's location. This is the user's core requirement.

## Deliverables

1. `wayfinder/wow-zones.json` — the authoritative dataset (research subagent output):
   every WotLK zone { id, name, continent, levelRange, factionControl, dimensions,
   borders{N,S,E,W}, cities[], dungeons[], transports[] } + a `transports[]` route table
   (ship/zeppelin/portal/flightpath with endpoints).
2. `game/src/world-atlas.ts` — the frozen contract:
   - `CONTINENTS`: id → { bounds, ocean }
   - `ZONES`: id → { continent, rect {x,y,w,h}, levelRange, faction, biome, palette,
     borders, cities[], dungeons[], docks[], flightpaths[], portals[] }
   - `TRANSPORTS`: route records { kind, from{dockId}, to{dockId}, durationSec }
   - `zoneAt(x,y)`, `continentAt(x,y)`, `zoneRect(id)`, `zoneLevel(x,y)` lookups.
   - A `SCALE` constant mapping WoW yards → game units, chosen so travel times match
     WoW (validate against player speed in `equipment.ts`/movement).
3. A layout rule: continents occupy disjoint coordinate regions far enough apart that
   ocean separates them; zone rects tile their continent without overlap and match WoW
   relative geography (Durotar east of The Barrens, etc).

## Acceptance

- `world-atlas.ts` compiles under `tsconfig.core.json`; every WotLK zone present with a
  non-overlapping rect; `zoneAt` total over each continent's landmass.
- `wow-zones.json` covers all four continents' zones + the transport route table.
- A `world-atlas.test.ts` asserts: no zone overlap, adjacency consistency (A borders B ⇔
  B borders A), every transport endpoint resolves to a real dock, level ranges sane.
