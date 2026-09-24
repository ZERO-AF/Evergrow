# Wayfinder Map — Polish & PvP Wave

> Local-markdown tracker. Map label `wayfinder:map`. Tickets `pl-tNN-*.md`.
> **Autonomous override:** fully-autonomous execution, parallel subagents,
> critic/review gates between iterations.

## Destination

Evergrow runs perfectly and looks great — floating-head regression fixed,
far-zoom smooth, studio linked in the menu, arena/battleground experience
polished (item picker, char e2e), combat feel + enemy hit feedback at
WoW/Diablo quality, perf + duplicate-code cleaned, more tests.

## Notes

- 2D WoW-like ARPG, Vite+TS, no runtime deps, deterministic 120 Hz sim.
- Dev server LIVE at http://127.0.0.1:5173. Verify with `browser` tool.
- PvP suite exists: arena-maps, bg-maps, pvp-{ai,announce,chargen,combatant,
  currency,directives,floor,instance,match,objectives,panel,rewards,scoreboard,
  setup,status,vendor}. Read before changing.
- Editors/reviews are memory-only; never touch playable saves.
- FILE OWNERSHIP per ticket; catalog.ts/menu files are integrator-owned.
- `npx tsc --noEmit` + targeted tests green; NOT the full suite.

## Decisions so far

## Not yet specified

- WoW/Diablo parity gaps beyond combat feel (named in the brief) — graduate as
  the audit surfaces them.

## Out of scope

- Sites/cloud deploy, save migrations.

## Tickets

- [T01 Floating heads — reconnect head to torso](pl-t01-heads.md)
- [T02 Far-zoom performance](pl-t02-zoom.md)
- [T03 Studio link in main menu](pl-t03-menu.md)
- [T04 Arena & battleground experience](pl-t04-pvp.md)
- [T05 Combat feel + enemy hit feedback](pl-t05-combat.md)
- [T06 Perf + duplicate-code + fidelity audit](pl-t06-audit.md)
- [T07 Test coverage](pl-t07-tests.md)
