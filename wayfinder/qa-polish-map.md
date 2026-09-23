# Wayfinder Map — QA, Bugfix & Polish Pass

> Local-markdown tracker. This file is the map (label `wayfinder:map`). Tickets are sibling
> files `qa-tNN-*.md`. Frontier = open tickets with no open blockers.
>
> **Autonomous override:** the user directed fully-autonomous execution ("voll autonom,
> keine Zwischenfragen … starte die nächsten Runden … nichts anderes als bugs ausmerzen,
> game breaking probleme fixed, verschönern, performance steigern, testen"). This map
> carries execution: tickets are worked to completion by the agent + subagents with
> critic/review gates, looping until done. No HITL tickets; the human playtests after.

## Destination

A bug-free, sharp, performant WoW-like game. Specifically:
- **No game-breaking bugs** — no frame-loop crashes, no save-validation resets, no
  broken core interactions. (Two already fixed this session: the `addColorStop`
  `rgb()ce` crash and the null-active world-event reset.)
- **Characters correct** — every race upright and correctly proportioned/skinned from
  all eight facings (user saw distortion on the stale 5199 build; re-verify on current).
- **Graphics sharp** — keep the silhouette/post effect but remove the glassy/milky
  blur; the character and world must be crisp enough to read.
- **Mounts work** — summonable, grant a speed boost, visible.
- **World map** — zoom out far enough to read region/continent outlines like WoW.
- **Content verified** — every attack, skill, and gear piece exercised; bugs fixed.
- **Performance** — profiled and improved.

## Notes

- Domain: 2D WoW-like ARPG, Vite+TS, no runtime deps, deterministic 120 Hz sim.
- Read `docs/architecture.md`, `docs/system-status.md` first.
- Dev server: http://127.0.0.1:5173 (Vite, HMR). Relay: ws://127.0.0.1:8777.
- Review pages (no gameplay/save): `/rig.html?race=<race>` (8 facings),
  `/race-grid.html`, `/bestiary.html`, `/biomes.html`, `/hud.html`, `/ui.html`,
  `/character.html`, `/atlas.html`, `/deaths.html`, `/weapon-lights.html`.
- Race visuals: `wow-races.ts`, `player-art.ts`, `appearance-*.ts`, `player-arm-rig.ts`,
  `player-leg-rig.ts`, `character-motion.ts`, `character-pose.ts`.
- Post/CRT: `postfx.ts`, `renderer.ts`, `lighting.ts`, `hud*.ts`.
- Mounts: search `mount`, `summon`, `speed` — likely absent or stubbed.
- Map: `world-map.ts`, `map-view.ts`, `exploration.ts`, `atlas-*.ts`.
## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [T01 Character rendering](qa-t01-characters.md) — NO DEFECT: all 10 races render upright, correctly proportioned/skinned at all 8 facings on the current build; the user's distortion was the stale 5199 server (now killed). Verified via screenshots.
- [T02 Graphics fidelity](qa-t02-graphics.md) — FIXED: the co-op commit dropped `canvas.height=worldBufferHeight`, leaving the WebGL canvas at 150px CSS-stretched fullscreen (the milky blur). Restored + native-density rasterization; bloom tightened; scanlines fixed; color-suffix crash shape swept.
- [T03 Mounts](qa-t03-mounts.md) — VERIFIED + FIXED: mechanic already worked (summon→mounted→speed); fixed rider seat height, added a discoverability hint chip + live keybind badges + ghost-summon guard.
- [T04 World map](qa-t04-map.md) — DONE: M zooms out to a WoW-style continent/region outline (zone fills, coastlines, exploration fog, continent names, decluttered labels).
- [T05 Content sweep](qa-t05-content.md) — DONE: content-sweep.test.ts exercises all ~200 skills/auras/weapons/shields/foci/armor/charms through the real sim; fixed manaShield ward + savageRoar self-buff finisher.
- [T06 Performance](qa-t06-performance.md) — DONE: eliminated per-frame allocations across the render hot path; fixed a ground-layer preview-cache key bug; ~8% mean frame-time improvement.
- [T07 Latent-bug sweep](qa-t07-bugs.md) — DONE: 10 validation-reset + co-op state-mutation bugs fixed (heroic boss hp, bossPhases cap, dual-spec accounting, channel owner scoping).
- Critic pass (QACritic) — 5 defects found & fixed: partner event-channel advance, resize split-squash, residual unscoped portal.cancel, gather-channel shared-flag, clearInputAll for co-op.

## Not yet specified

<!-- empty — all reported issues resolved; the frontier is clear -->

## Out of scope

- New content beyond fixing/polishing what exists (no new zones/classes/raids).
- Sites/cloud deployment.
- Save-format migrations (prototype; stale saves may reset by design).

## Tickets

- [T01 Character rendering — verify/fix all races upright & undistorted](qa-t01-characters.md)
- [T02 Graphics fidelity — remove glassy/milky blur, restore sharpness](qa-t02-graphics.md)
- [T03 Mounts — make summonable, grant speed, visible](qa-t03-mounts.md)
- [T04 World map — zoom out to region/continent outlines](qa-t04-map.md)
- [T05 Content sweep — exercise every attack, skill, gear piece; fix bugs](qa-t05-content.md)
- [T06 Performance — profile & optimize frame/render](qa-t06-performance.md)
- [T07 Latent-bug sweep — code review pass for crashes/validation/state bugs](qa-t07-bugs.md)
