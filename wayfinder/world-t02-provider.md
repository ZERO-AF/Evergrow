# T02 — Authored-world provider

**Type:** task (AFK) · **Blocks:** T06, T07, T08, T09, T10 · **Blocked by:** T01

## Question

How does the engine serve an authored (finite, fixed) world instead of the procedural
climate field — while keeping every `World`/`WorldQuery` consumer working?

## Scope

- A `WorldProvider`/`AuthoredWorld` that satisfies the same interface `world.ts` exposes
  today (blocked/move/sampleBiome/props/pois/settlements/water/roads) but derives answers
  from `world-atlas.ts` + per-zone authored data instead of the seeded climate field.
- Zone-aware terrain: each zone renders its own palette/prop recipe; borders blend.
- Ocean between continents: impassable water, correct biome/color, no spawns.
- Keep `terrain-stream.ts`/worker path working (or a bounded authored equivalent).
- Exploration chart (`world-map.ts`/`exploration.ts`) must render the authored world:
  zone shapes, roads, cities, fog-of-war per zone.
- Level ranges: `zone-progression`/`encounter-scaling` read `zoneLevel(x,y)` from the
  atlas instead of the procedural remoteness model.

## Acceptance

- `World` backed by the atlas returns correct zone/biome/collision for sampled points in
  every zone; ocean blocks movement; consumers compile unchanged.
- Exploration map shows authored zone shapes.
- `world-provider.test.ts` covers zoneAt/blocked/biome across zone borders and ocean.
