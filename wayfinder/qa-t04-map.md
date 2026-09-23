# QA-T04 — World map: zoom out to region/continent outlines

**Type:** task (AFK) · **Status:** OPEN · **Blocks:** — · **Blocked by:** —

## Question / Work

The user wants the world map (M key) to zoom out far enough to read region and continent
outlines like the real WoW map — currently it doesn't zoom out far enough.

1. Read `world-map.ts`, `map-view.ts`, `exploration.ts`, `atlas-*.ts`. Find the zoom
   limits and the projection/coarsening path.
2. Extend the zoom-out range so the player can see the whole explored region and the
   outlines of continents/zone boundaries. WoW-like: at max zoom-out, show zone/continent
   shapes and names even where unexplored (WoW shows the world silhouette with fog).
3. Keep it performant: the map uses 768/1536/3072-unit tiles + a 384-entry LRU + ≤256
   visible tiles + overview coarsening. Extend the overview path rather than rendering
   more detail tiles. Preserve the "explored-only" reveal rule where it applies, but
   allow continent/zone outlines (the silhouette) to show at the far zoom like WoW.
4. Verify: M opens, zooms out to a readable continent/region view, labels/POIs declutter
   correctly, no perf hitch. Screenshot evidence.

## Acceptance

- M map zooms out to a WoW-like continent/region outline view.
- Labels/POIs still declutter; explored-fog rules preserved where intended.
- `npx tsc --noEmit` clean; tests green; no perf regression.
