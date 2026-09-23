# RF-T01 — Character posture: remove the unwanted tilt, refine all races

**Type:** task (AFK) · **Status:** OPEN · **Blocks:** — · **Blocked by:** —

## Question / Work

The user reports all races stand upright but **tilted/leaning sideways** ("sehr schräg,
nicht normal") — see the screenshot: the figure leans to one side. This affects ALL races,
so it's a shared cause, not per-race `hunch`.

1. **Diagnose from screenshots first.** Use the `browser` tool on
   `http://127.0.0.1:5173/rig.html?race=<race>` (all 10 races × 8 facings) and
   `/race-grid.html`. Confirm the tilt direction/magnitude and whether it's idle-only or
   also in walk/attack poses.
2. **Find the cause** in `character-motion.ts` `playerMotion` (~line 165-172): the `body`
   affine has a horizontal shear `-lean - hunch*.45*cos(angle)`, and `lean`/`hipX`/`bob`
   offsets. At idle `moving=0` so `lean` should be 0 — if the tilt persists at idle, look
   for a constant shear, a non-zero `hunch` applied to all races, a `bodyAngle` rotation,
   or a leg/arm rig asymmetry that reads as a lean. Also check `character-pose.ts` and the
   leg rig for a lopsided stance.
3. **Fix** so every race stands naturally upright at idle and reads correctly in motion.
   Keep intentional race posture (orc/troll/undead/tauren forward hunch is fine — that's
   a hunch, not a sideways shear). Remove only the unwanted lateral tilt/shear.
4. **Iterate visually**: fix → screenshot all races/facings → refine → repeat until they
   look tip-top. This is a look-and-feel task; use your judgment for "natural upright."

## Acceptance

- Every race stands naturally upright (no sideways tilt) at all 8 facings, idle + walk.
- Intentional race hunch preserved where it's a forward hunch, not a lateral shear.
- Screenshot evidence per race before/after.
- `npx tsc --noEmit` clean; tests green.
