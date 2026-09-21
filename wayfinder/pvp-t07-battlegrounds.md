# T07 — Battlegrounds (objective maps vs NPC teams)

**Type:** task (AFK) · **Blocks:** T08 · **Blocked by:** T01, T02, T03, T04

## Question

Which battlegrounds, with what objective mechanics, and how do larger NPC teams fight
over objectives?

## Resolution (decided)

Start with the two most engine-feasible, then expand:

- **Warsong Gulch (CTF):** two bases, flag pickup/carry/return/capture, first to 3.
  Flag = a carried objective prop; carrier slowed, drops on death; return on touch by
  own team. NPC AI: flag-runners, escorts, defenders, flag-returners.
- **Arathi Basin (node control):** 5 nodes (Stables/Farm/Lumber/Mine/Blacksmith), channel
  to capture, tick resource accrual to 1600. NPC AI: capture groups, node defense,
  reinforcement to contested nodes.
- **(stretch) Eye of the Storm:** hybrid — 4 towers + center flag.
- **(stretch) Alterac Valley:** large; only if the objective engine generalizes cheaply.

Team sizes larger than arena (e.g. 5v5/10v10 WSG, 15v15 AB) — bounded by the combatant
count the sim can drive; start symmetric, scale to performance. Same enter/setup/return
flow as arena; objectives drive the win condition instead of a wipe.

New files: `pvp-bg.ts` (objective controllers: flag/node), `bg-maps.ts` (WSG/AB floor
builders), `pvp-objectives.ts` (flag carry, node capture, resource ticks). Edits: same
integration points as T06.

## Implementation (landed)

- `game/src/bg-maps.ts` — registers `warsong` (two flag rooms + bases + midfield,
  `pvp:flag:A/B` props) and `arathi` (basin + two bases, five `pvp:node:*` props:
  stables/lumbermill/blacksmith/goldmine/farm). Non-solid objective props; solid
  pillars are the only LOS blockers.
- `game/src/pvp-objectives.ts` — `WarsongGulchObjectives` (touch pickup, carrier
  slowed via `applySlow`, drop-on-death, own-team touch return, capture at own
  stand while own flag home, first to 3) and `ArathiBasinObjectives` (presence
  capture with contested pause + decay, owned nodes tick resources, first to
  1600). `attachBattlegroundObjectives(sim)` picks the controller from floor
  props and attaches via T06's `attachPvpObjectives` (non-enumerable →
  structuredClone-safe); `updatePvpMatch` calls it each live tick.
- NPC objective AI: controllers publish `ObjectiveDirective`s (WeakMap) each
  update; `decideCombatantInput` (pvp-ai.ts) steers to the point, yields to
  hostiles inside `engage` (0 = carrier never diverts), holds on arrival.
  WSG roles: carrier / flag-returners (focusId on enemy carrier) / runners /
  escorts / defenders. AB roles: node guards (2 when contested) / capture
  groups of 2 / reinforcements.
- `game/src/pvp-bg.ts` — `battlegroundSetup` fills short rosters with seeded
  legal picks; `enterBattleground` = `enterPvpMatch` + attach. Team sizes from
  `PVP_BATTLEGROUNDS` (5v5 / 8v8).
- Tests: `game/tests/pvp-bg.test.ts` — floors, directive steering, WSG pickup/
  drop/return/capture + first-to-3 via `updatePvpMatch`, AB capture/contest/
  resource tick + first-to-1600, production-path attach.
