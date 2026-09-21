# T03 — Elevation + camera occlusion transparency

**Type:** task (AFK) · **Blocks:** T06, T07, T08, T09 · **Blocked by:** T01

## Question

How do we get WoW-style height (cliffs, valleys, ramps, mesas) and correct camera
occlusion (objects between camera and player turn transparent) in the 2D engine?

## Scope

- An elevation field per zone: height at (x,y) → cliffs (impassable edges), ramps
  (walkable slopes connecting levels), valleys, mesas. Authored per zone from the atlas
  (mountain ranges, canyons, plateaus) + bounded noise.
- Collision: cliff edges block movement; ramps are the only connectors between levels.
  `blocked`/`move` respect elevation transitions.
- Rendering: height shading (lit tops, shadowed cliff faces), so terrain reads as 3D.
- Camera occlusion transparency: any tall object (tree crown, building, cliff overhang,
  prop) overlapping the screen-space line/area between camera focus and the player fades.
  Extend the existing roof-fade / tree-crown-occlusion mechanism into a general
  "occluder → alpha" pass driven by the camera transform.

## Acceptance

- `elevation.ts` + renderer support: a zone can express a cliff/valley/ramp; movement is
  blocked across cliff edges, allowed on ramps.
- Occlusion: standing behind a tall object fades it (verify in a review scene).
- `elevation.test.ts` covers cliff-block / ramp-pass / height sampling.
