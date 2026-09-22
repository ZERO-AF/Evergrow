# T11 — Rebuild zone rect layout to satisfy declared borders + real WotLK geography

**Type:** task (AFK) · **Blocks:** T12, T13 · **Blocked by:** T06–T09

## Problem

The hand-authored zone rects in `game/src/world-atlas.ts` do NOT implement the
declared `borders` adjacency (from `wayfinder/wow-zones.json`). Critic verified
95 divergences: 41 declared borders are geometrically non-adjacent, 54 real rect
adjacencies are undeclared, and interior voids (zoneAt→null = impassable ocean)
wall off real walkable crossings. Examples: Elwynn's east edge is Searing Gorge
(should be Redridge/Duskwood); Alterac & Hillsbrad are swapped N/S; Blade's Edge
sits south of Terokkar (should be north of Zangarmarsh); Wintergrasp is a strip
under Dragonblight (should be central-west); Dustwallow touches Durotar &
Tanaris directly; Moonglade→Felwood is a void wall.

## Target

Rebuild the `rect` of every zone in `world-atlas.ts` (via `wayfinder/merge-atlas.mjs`
which generates the ZONES block) so that:

1. **Every declared border is geometrically adjacent** — if `ZONES[a].borders[d]===b`,
   zone a's rect must share an edge segment with zone b's rect on side d.
2. **No interior voids at declared crossings** — a player walking across a declared
   border never hits zoneAt→null. Voids may remain ONLY where WoW has real ocean/
   impassable gaps (continent edges, the sea between zones that genuinely don't touch).
3. **Real WotLK relative geography** — north/south/east/west relationships match the
   real map (use `wayfinder/wow-zones.json` `borders` + `widthKm`/`heightKm` + your
   WotLK knowledge). Zone sizes ∝ real dimensions (km→units via the existing scale).
4. **No overlaps** (existing test) and rects stay inside their continent bounds.

### Method (suggested)

Per continent, lay out rects on a coarse grid so declared neighbors share edges.
The `borders` field is the adjacency source of truth. Use `widthKm`/`heightKm`
for relative sizes. Keep continent origins/scale (ATLAS_SCALE=24). Validate with
a script: for each zone, for each declared border side, assert the neighbor rect
abuts on that side; assert no two rects overlap; assert declared crossings are
walkable (zoneAt non-null along the shared edge).

### Also fix (same files)

- Add **Isle of Quel'Danas** zone (Eastern Kingdoms, north of Eversong, level 70,
  faction contested) + **Sunwell Plateau** raid entrance + its flightpath/portal.
- Add **Orgrimmar↔Grom'gol zeppelin** route and **Dalaran→Shattrath portal**.
- Fix dungeon `levelMin/levelMax` to **instance** level ranges, not zone ranges
  (Karazhan 70, Zul'Aman 70, Zul'Gurub 60, Scarlet Monastery 26-45, Gnomeregan
  24-35, Stockade 22-30, RFC 13-18, all TBC/WotLK dungeons their real ranges).
- Make `zoneAt` **O(1) and allocation-free**: precompute per-continent rect lists
  or a coarse spatial grid at module init; no per-call `zoneRect` allocation.
- Stamp capital cities `tier:'capital'` (Stormwind, Orgrimmar, Ironforge,
  Darnassus, Exodar, Thunder Bluff, Undercity, Silvermoon, Dalaran, Shattrath).

### Road/content follow-through

`RoadSpec.points` in `zone-content-*.ts` are world-space — after re-layout, update
any road endpoint that no longer lands inside its intended zone/crossing. Keep
normalized `nx/ny` content (cities/dungeons/docks) untouched — it survives re-layout.

## Acceptance

- `npx tsc --noEmit` clean; `tsconfig.core.json` clean.
- Extend `game/tests/world-atlas.test.ts`: assert every declared border is
  geometrically adjacent on the correct side; assert no rect overlap; assert
  zoneAt is non-null along each declared shared edge; assert continent bounds.
- Re-run world-atlas + authored-world + all zone-content tests green.

## Resolution

Done. `merge-atlas.mjs` now consumes `wayfinder/layout-data.mjs` (continent-local
rects) + `wow-zones.json` (content/borders), validates overlap + declared-border
adjacency + undeclared adjacencies, and splices ZONES/TRANSPORTS into
`world-atlas.ts` between GENERATED markers. `layout-check.mjs` prints the
per-continent adjacency result (0 violations: 84 declared pairs = 84 adjacent
pairs). Border fixes applied to wow-zones.json where the dataset dropped
"+extra" neighbors or declared geometrically impossible sides (dustwallow N,
TN E, deadwind N/E, swamp W, hillsbrad W, badlands S, zangar W, northrend
ring, ungoro N, eversong N→quel-danas, darkshore↔felwood, azshara N,
epl S→hinterlands, arathi N→hinterlands). Added quel-danas (+Magisters'
Terrace/Sunwell Plateau, Sun's Reach fp, Shattrath portal), Orgrimmar↔Grom'gol
zeppelin, Dalaran→Shattrath portal; per-dungeon instance level ranges; capital
tiers; O(1) zoneAt via per-continent spatial grid + shared frozen world rects.
quel-danas emits last so ZONE_INDEX seeds are stable. Road endpoints re-projected
old-rect→new-rect; crossings re-pointed (ashenvale→azshara, barrens-south→TN,
feralas→TN, deadwind→swamp, dragonblight→wintergrasp, storm-peaks↔zuldrak,
netherstorm→blades-edge, zangar→nagrand, shadowmoon→terokkar, elwynn→redridge,
westfall, hillsbrad alterac-pass).
- A node script prints, per continent, the adjacency check result (0 violations).
