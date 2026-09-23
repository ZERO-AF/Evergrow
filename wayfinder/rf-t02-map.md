# RF-T02 — Map fidelity + zoom performance

**Type:** task (AFK) · **Status:** OPEN · **Blocks:** — · **Blocked by:** —

## Question / Work

Two asks on the M world map:

**A. Fidelity** — the zoomed-out overview (added last pass in `atlas-overview.ts`) shows
continents/regions, but the user wants the **actual map course like the original WoW** —
the real coastline/border shapes, not generic blobs — plus nicer parchment-style coloring
true to WoW's map look.

1. Read `atlas-overview.ts`, `world-map.ts`, `map-view.ts`, and the authored zone data
   (`wayfinder/wow-zones.json`, `wayfinder/atlas-zones*.ts`, `wayfinder/atlas-by-continent.json`,
   `world-*.md`). The zone geometry should already encode real WoW continent/zone shapes.
2. Make the overview render the **real zone/continent outlines** (coastline + borders
   following the authored geometry), WoW-style parchment/ocean coloring, zone name +
   level labels, continent names at world zoom. Keep the exploration fog.
3. Verify on `/atlas.html` at world zoom — the shapes should read as Kalimdor / Eastern
   Kingdoms / Northrend / Outland, not blobs.

**B. Zoom performance** — the user reports "ganz große performance probleme" when zooming
between zoom levels. Profile the zoom path (tile rebuilds, fog recompute, label layout,
the .02 silhouette/tile boundary swap) and eliminate the hitch — cache/coarsen/debounce
as needed so zooming is smooth.

## Acceptance

- Overview shows WoW-faithful continent/zone outlines + parchment coloring.
- Zooming between levels is smooth (no large hitch) — measure before/after.
- Exploration fog + labels still correct.
- `npx tsc --noEmit` clean; tests green.
