# T01 — Character overhaul: race proportions, skin, WoW-grade editor — DONE (verified + critic-passed)

**Type:** task (AFK) · **Blocks:** T02, T03 · **Blocked by:** —

## Question / Work

The user reports non-human races (tauren, orc, troll, undead, draenei…) render **distorted**
and with **wrong skin colors**, and wants the character editor to be WoW-grade. Fix the
rendering so every race is correctly proportioned and correctly skinned from all eight
facings, and polish the editor.

## Deliverables

1. Diagnose the distortion: `player-art.ts` reads `WOW_RACES[raceId].visual` (height, width,
   horns, tusks, hooves, tail, hunch, muzzle, ears, eyeGlow, markings, decay, tendrils) and
   `appearance.skin` → `SKIN_PALETTES`. Find where proportions/skin break (likely the body
   transform, limb rig, or palette lookup) across facings.
2. Fix proportions + skin for all 10 races; verify each renders correctly at all 8 facings
   via `rig.html` / `character-review.ts` / `appearance-*-review.ts` (frozen reviews, no
   gameplay).
3. WoW-grade character editor polish: race-appropriate skin-tone swatches, feature options
   (horns/tusks/markings/decay per race), live preview across facings.
4. A critic/review agent passes on the visual result before commit.

## Acceptance

- All 10 races render correctly proportioned + skinned at all 8 facings (screenshot-verified
  via the frozen review pages).
- `npx tsc --noEmit`, `tsconfig.core.json`, and the test suite stay green.
