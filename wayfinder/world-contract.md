# World conversion — shared contracts (read before building)

The atlas (`game/src/world-atlas.ts`) pins every zone to a fixed world rect. These are the
interfaces every workstream codes against. Do NOT change zone rects.

## ZoneContent — what a continent team produces per zone

```ts
// game/src/zone-content.ts
interface ZoneContent {
  readonly id: string;                    // atlas zone id
  readonly palette: PaletteId;            // ground color recipe key
  readonly props: PropWeightTable;        // biome-prop weights for this zone
  readonly elevation?: ElevationSpec;     // cliffs/ramps/valleys (T03)
  readonly water?: readonly WaterSpec[];  // lakes/rivers/coastline
  readonly roads: readonly RoadSpec[];    // polylines to border crossings
  readonly towns: readonly TownSpec[];    // cities/villages (buildings+NPC anchors)
  readonly camps: readonly CampSpec[];    // mob camps
  readonly spawns: readonly SpawnEntry[]; // zone mob table {kind,weight,levelOffset}
  readonly pois: readonly POISpec[];      // named locations
  readonly entrances: readonly EntranceSpec[]; // dungeon/raid doors
}
```

`ZONE_CONTENT: Record<zoneId, ZoneContent>` is the registry the provider consumes.
Continent teams fill it; the provider renders terrain/props/collision/spawns from it.

## Seam rules (from recon)

- `WorldQuery` (model.ts) is the stable contract — never break it.
- `AuthoredWorld extends World` (precedent `DungeonWorld`/`RiftWorld`) overrides the
  content queries to read `zoneAt(x,y)` + `ZONE_CONTENT` instead of the climate field.
- Module-level free functions that bypass dispatch get an atlas-aware branch:
  `sampleBiome(x,y,seed)`, `getZoneAt(x,y,seed)`, `hydrology(seed)`, road-shape fns,
  world-geography fns. Rule: **if the point is inside an authored zone → authored answer;
  else → existing procedural fallback** (keeps RiftWorld/dev-scenes working).
- `BiomeId` is a closed union of 9 — each zone maps to the nearest existing BiomeId for
  encounter/prop tables; the zone's own `terrain`/`palette` key drives visuals.
- Ocean (no zone) = impassable water, no spawns, `blocked` true.
- Durable mutations keep the checkpoint→persist→commit pattern.
- New subsystems add a `GAME_FEATURES` flag.

## Ownership boundaries (avoid collisions)

- **T02 provider**: `authored-world.ts`, `zone-content.ts` (the interface + registry),
  free-function reroute, exploration/map color. Owns `world.ts`/`world-landscape.ts`
  overrides and the `sampleBiome`/`getZoneAt`/`hydrology`/road/world-geography seams.
- **T03 elevation**: `elevation.ts` (height field + cliff/ramp collision helper) +
  `ElevationSpec` type + a renderer occlusion/shading hook. Does NOT touch world content
  queries; the provider calls `elevationAt(zone,x,y)` and `elevationBlocked(...)`.
- **T04 transport**: `transport.ts` + `transport-content.ts` + dock/vehicle entities +
  a new staged-travel action in location-controller. Consumes `TRANSPORTS` + docks.
- **T05 factions**: `factions.ts` (race→faction→startZone, hostility matrix) + race
  `faction` field + spawn placement + faction tag on NPCs/mobs. Consumes atlas factions.
