# Wayfinder Map — Evergrow Game Studio

> Local-markdown tracker. Map label `wayfinder:map`. Tickets are sibling files
> `st-tNN-*.md`. Frontier = open tickets with no open blockers.
>
> **Autonomous override:** fully-autonomous execution ("voll autonom, keine
> Zwischenfragen"). Tickets are work packages executed to completion by parallel
> subagents with critic/review gates — not HITL decision tickets.

## Destination

A full in-game **Game Studio** under `/tools/` — authoring editors that let you
create and tune game content (characters/races, items, maps/zones, enemies,
skills, procedural art) rather than only review it. Editors are save-free,
memory-only, reuse the real renderers/content, and register in the tools catalog.

## Notes

- Domain: 2D WoW-like ARPG, Vite+TS, no runtime deps, deterministic 120 Hz sim.
- Existing `/tools/` workspace (`game/src/tools/catalog.ts`) has 7 groups and many
  review pages — mostly read-only studies + a few generators (forge, data browser).
  The studio adds *authoring* editors. Read `docs/development-tools.md` first.
- Editors are disposable in-memory studies — never touch playable saves.
- Reuse real renderers, content definitions, item/skill/enemy/world generators.
- Register each editor in `catalog.ts` under the right workspace group.
- Each editor = a `/tools/<name>.html` page + a `*-review.ts`/`*-editor.ts` module.
- Shared file `catalog.ts`: builders do NOT edit it; the integrator registers all
  studio entries in one pass to avoid conflicts.
- Verify each editor with the `browser` tool on 127.0.0.1:5173 — screenshot,
  interact, iterate. `npx tsc --noEmit` clean; targeted tests green.

## Decisions so far

<!-- one line per closed ticket -->

## Not yet specified

- Editor→game round-trip: whether authored content can be exported/saved into the
  real content pipeline (JSON export vs. live content injection). Deferred until
  the editors exist — likely JSON export + a content-import path.

## Out of scope

- Sites/cloud deployment, save-format migrations, live gameplay changes.
- Editing the shared `catalog.ts` (integrator-owned).

## Tickets

- [T01 Character & race studio](st-t01-character-studio.md)
- [T02 Item & equipment studio](st-t02-item-studio.md)
- [T03 Map & world studio](st-t03-map-studio.md)
- [T04 Enemy & encounter studio](st-t04-enemy-studio.md)
- [T05 Skill & effect studio](st-t05-skill-studio.md)
- [T06 Procedural art studio](st-t06-art-studio.md)
