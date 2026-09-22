# T13 — Presentation/visual fixes (post-GeoFix)

**Type:** task (AFK) · **Blocked by:** T11 · **Blocks:** T14

## Own these files ONLY

`game/src/transport-content.ts`, `game/src/transport.ts`, `game/src/transport-art.ts`,
`game/src/settlement-art.ts`, `game/src/elevation-art.ts`, `game/src/biome-props.ts`,
`game/src/biome-prop-art.ts`, `game/src/renderer.ts` (vehicle/occlusion draw only),
`game/src/settlements.ts` (town-kind roll only), plus new/edited tests. Do NOT touch
world-atlas.ts, authored-world.ts, zone-content.ts, world-landscape.ts, elevation.ts,
occlusion.ts, factions.ts, dungeon-command.ts (CoreFix owns those).

## Visual bugs (from CriticVisual)

1. **Ships/turtles sail over land** — routes are straight `points:[a,b]` lerps; no
   water routing. Add waypoint polylines that keep vessels in water (route around
   landmasses). `vehicleAt`/`polylineAt` already support polylines — author real
   sea lanes per ship/turtle route so ≥90% of each route is over water. Verify by
   sampling zoneAt along each route.
2. **~1/3 of named towns render as tent camps** — `settlements.ts` `seed%3===0 →
   'settlement'` roll applies to `tier:'town'` too. Named towns (Goldshire,
   Crossroads) must always generate real buildings/houses, not tents. Gate the
   settlement roll so authored towns never downgrade to a camp.
3. **World map is flat colored rects** — zones render as uniform blocks. Add
   organic coastline/relief to `atlasColor`/`surfaceColor` so the map reads as
   terrain, not a schematic grid (blend biome edges, add relief shading from
   elevation/coast proximity). NOTE: world-landscape.ts is CoreFix's — coordinate
   via hub if the map-color path lives there; otherwise implement in the map/render
   layer you own.
4. **Nagrand floating islands invisible** — `kind:'overhang'` elevation features
   draw only a shadow arc. Draw the island body above (rocky underside + green top)
   so it reads as a floating island.
5. **Zangarmarsh has no giant mushrooms** — add a large-fungus PropKind (towering
   mushroom tree) in biome-props + its art in biome-prop-art, and weight it into
   Zangarmarsh's prop table (coordinate the zone-content-*.ts prop weight via hub
   with CoreFix if that file is contested — else propose the kind and a helper).
6. **Deeprun Tram docked in open snow** — give the tram a station/tunnel context
   (a depot structure or portal frame at the dock) so it doesn't sit in a forest.
7. **Elevation face shading too subtle** — raise cliff-face contrast so plateau/
   mesa edges read clearly (stronger south-face gradient + rim highlight).
8. **Rift portals inside friendly towns** — keep rift/event sites out of town
   commons (offset or suppress within settlement radius).

## Perf items you own (from CriticPerformance)

9. **flightPoints() rebuilds every call** — memoize the resolved flight-master list
   (static data) like flightEdges' edgeCache; transportPrompt calls it per frame.
10. **dockEtaSec overstates ETA by dwellSec** — target the START of the docking
    window, not the end.
11. **vehicleAt allocates per call** — reuse a scratch VehicleState for the
    per-frame vehiclesNear/transportPrompt/advanceTransport calls.
12. **occluder per-frame allocations** — scratch object / struct-of-arrays for
    occluderBlocks + propOccluder + elevation-art face ids (coordinate with
    CoreFix on occlusion.ts if needed — prefer doing it in the art/draw layer).

## Acceptance

- `npx tsc --noEmit` clean; `tsconfig.core.json` clean.
- A node script samples each ship/turtle route and reports ≥90% over water.
- Tests: named towns always generate houses; flightPoints memoized; dockEtaSec
  correct; tram dock has station context.
- Run your new tests + transport + authored-world + world-atlas green.
