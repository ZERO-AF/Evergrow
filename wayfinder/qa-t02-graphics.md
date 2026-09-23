# QA-T02 — Graphics fidelity: remove glassy/milky blur, restore sharpness

**Type:** task (AFK) · **Status:** OPEN · **Blocks:** — · **Blocked by:** —

## Question / Work

The user reports the in-game graphics are now "very pixelated, glassy/milky, blurred —
there's a nice silhouette effect over the whole image but everything is blurry, not sharp
enough to actually see your character." Likely the post-processing chain (bloom + CRT +
phosphor + a silhouette/outline pass) is over-blurring or mis-scaled.

1. Read `postfx.ts`, `renderer.ts`, `lighting.ts` and the render pipeline. Identify what
   produces the "silhouette effect" and where sharpness is lost (bloom radius/strength,
   a low-res intermediate buffer upscaled, CRT grille, a blur pass, wrong devicePixelRatio).
2. Reproduce visually: screenshot the live game (or `/bestiary.html`, `/biomes.html`,
   `/encounters.html`) and confirm the milky/blurry look.
3. Restore sharpness while KEEPING the silhouette/post aesthetic the user likes: tighten
   bloom, fix any half-res buffer being upscaled, ensure the world pass renders at native
   resolution, keep HUD/text at native res. The CRT treatment stays fixed (no modes).
4. Verify: character and world are crisp; silhouette/glow still present; no regression
   to the fixed `addColorStop` crash.

## Acceptance

- World + character render sharp (no milky/glassy blur); silhouette/post effect retained.
- Screenshot before/after evidence.
- `npx tsc --noEmit` clean; tests green; no new frame faults.
