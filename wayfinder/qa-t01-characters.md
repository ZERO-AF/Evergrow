# QA-T01 — Character rendering: verify/fix all races upright & undistorted

**Type:** task (AFK) · **Status:** OPEN · **Blocks:** — · **Blocked by:** —

## Question / Work

The user reported characters "still distorted — skewed in different directions and not
standing upright" — but on the **stale 5199 build**. First verify on the **current**
build whether the distortion is real or was the old build.

1. Screenshot every race at all 8 facings via `/rig.html?race=<race>` and
   `/race-grid.html` on the live 5173 server. Races: human, orc, tauren, troll, undead,
   dwarf, gnome, night elf, blood elf, draenei.
2. For each: confirm the figure stands upright, correctly proportioned, correctly
   skinned, no skew/shear/mirror artifacts, feet grounded.
3. If any race is distorted: find the rig/pose bug (`player-art.ts`, `player-arm-rig.ts`,
   `player-leg-rig.ts`, `character-motion.ts`, `character-pose.ts`, `wow-races.ts`) and
   fix it. Re-verify with screenshots.
4. Also verify in-editor preview and in-game idle/walk if reachable without driving gameplay.

## Acceptance

- Every race renders upright, undistorted, correctly skinned at all 8 facings.
- Screenshot evidence for each race.
- `npx tsc --noEmit` clean; tests green.
