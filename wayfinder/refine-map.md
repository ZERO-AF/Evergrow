# Wayfinder Map — Character Posture + Map Fidelity Refinement

> Local-markdown tracker. Map label `wayfinder:map`. Tickets are sibling files
> `rf-tNN-*.md`. Frontier = open tickets with no open blockers.
>
> **Autonomous override:** fully-autonomous execution ("voll autonom, keine
> Zwischenfragen"). Tickets are worked to completion by the agent + subagents with
> critic/review gates. No HITL tickets; the human playtests after.

## Destination

1. **Characters look tip-top** — every race stands naturally upright (not tilted/
   leaning) from all eight facings, in idle and motion. The user sees all races
   "sehr schräg" (very tilted) — find and remove the unwanted lean while keeping
   intentional race posture (orc/troll/undead/tauren hunch is fine, a sideways
   shear/lean is not).
2. **Map fidelity + zoom performance** — the M map shows WoW-faithful continent/
   region shapes (the real coastline/border course, not generic blobs), nicer
   parchment-style coloring, AND zooms between levels without the current large
   performance hitches.

## Notes

- Domain: 2D WoW-like ARPG, Vite+TS, no runtime deps, deterministic 120 Hz sim.
- Dev server LIVE at http://127.0.0.1:5173 (Vite HMR). Verify visually with the
  `browser` tool on the save-free review pages.
- Character art: `player-art.ts`, `character-motion.ts` (`playerMotion` — `lean`,
  `hunch`, `body` affine shear at ~line 167-172), `character-pose.ts`,
  `player-arm-rig.ts`, `player-leg-rig.ts`, `wow-races.ts` (`visual.hunch/bulk/
  height/width`), `appearance-*.ts`. Review: `/rig.html?race=<race>`,
  `/race-grid.html`, `/bestiary.html`, `/character.html`.
- Map: `world-map.ts`, `map-view.ts`, `exploration.ts`, `atlas-overview.ts` (the
  zoom<.02 overview pass added last pass), `atlas-*.ts`, `wow-zones.json`,
## Decisions so far

- [T01 Character posture](rf-t01-posture.md) — DONE. The `body` affine was a pure
  horizontal shear `[1,0,c,1,tx,ty]` with `c=-lean-hunch*.45*cos(angle)`, `d=1` —
  walk-lean and race-hunch sheared the torso sideways instead of pitching along
  facing (worst at E/W facings). Fix: added `leanDepth` (lean projected onto
  screen-y via ARM_DEPTH_SCALE) into the `d` term, tempered hunch shear .45→.32,
  and extended head-translate y to counterbalance. All races upright at idle;
  hunched races pitch forward. Verified via screenshots.
- [T02 Map fidelity + zoom](rf-t02-map.md) — DONE. Overview now renders real WoW
  continent/zone outlines (shared-edge displacement, parchment fills, wavy
  borders, coast halo). Zoom gestures use a snapshot-stretch path — no tile
  rebuild/fog/labels mid-gesture (233ms spikes → 0.5ms max). Critic pass found 6
  non-blocking defects; fixed the 2 visible ones (zone-corner seam gaps via
  fill-color outline stroke, viewport-edge cull inflation) + zoom polish
  (center clamp, stale area-info, stale snapshot).
  atlas data files for the real zone geometry.
- Keep it local; no Sites/deploy. Do NOT drive live gameplay — review pages only.
- All tests + `npx tsc --noEmit` + `tsconfig.core.json` must stay green.
- Review gates: a critic agent reviews each workstream before commit.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

## Not yet specified

- The exact tilt source (body shear vs lean vs a pose offset) — RF-T01 diagnoses it
  from screenshots before fixing.
- Whether the map zoom hitch is tile rebuilds, fog recompute, or label layout —
  RF-T02 profiles it.

## Out of scope

- New races/classes/content.
- Sites/cloud deployment.

## Tickets

- [T01 Character posture — remove the unwanted tilt, refine all races](rf-t01-posture.md)
- [T02 Map fidelity + zoom performance — WoW-faithful shapes, smooth zoom](rf-t02-map.md)
