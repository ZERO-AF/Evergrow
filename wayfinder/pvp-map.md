# Wayfinder Map — PvP: Arena & Battlegrounds

> Local-markdown tracker. This file is the map (label `wayfinder:map`). Tickets are sibling
> files `pvp-tNN-*.md`. Frontier = open tickets with no open blockers. Resolve one ticket per
> work session; record the answer in the ticket and gist it under Decisions so far.

## Destination

A playable WoW-style PvP layer: **Arena** (2v2/3v3/4v4, player-chosen NPC teammates with a
role direction heal/tank/dd, vs an equal-level NPC enemy team) and **Battlegrounds**
(objective maps vs NPC teams), entered from the main menu, the in-game options, and a city
battlemaster NPC. A **Custom** mode lets the player set level/skills/gear for a session
character; without it the real save character goes in. NPCs get random legal talent builds
and equal-ilevel gear. After a match the player returns to their exact start point with
earned Honor / Arena Points / reputation, spendable at a PvP vendor in the main game.
Maps recreate WoW arenas & battlegrounds as faithfully as the engine allows.

## Notes

- Domain: 2D WoW-like ARPG, Vite+TS, no runtime deps. Deterministic 120 Hz sim.
- Read `docs/wow-transformation.md`, `docs/wow-deepening.md`, `docs/architecture.md` first.
- Reuse the instanced-dungeon chassis (`dungeon.ts`/`dungeon-state.ts`/`dungeon-command.ts`)
  for self-contained PvP maps with return-to-start.
- NPC combatants reuse the `Ally`/`Enemy` actor model + class kits from `wow-skills-*.ts`.
- Keep it local; no Sites/deploy. Player does gameplay testing.
- All 2212 tests + `npx tsc --noEmit` must stay green.

## Decisions so far

All eight tickets resolved. The way is clear — the PvP layer is built and verified.

- [T01 PvP combatant model](pvp-t01-combatant-model.md) — NPCs are Player-shaped actors driven by class AI synthesizing `Input`; dots/cc/DR live on the player status surface; PvP death = corpse, not defeat. `sim.enterPvp/leavePvp`.
- [T02 PvP instance chassis](pvp-t02-instance-chassis.md) — `pvp:` dungeon entrances → `buildPvpFloor`; `enterPvpMatch`/`exitPvpMatch` with exact return-to-start; hearthstone sealed; pillars as solid props.
- [T03 NPC & Custom chargen](pvp-t03-chargen.md) — `randomNpcBuild` (legal talents + equal-ilevel gear + role preset); `buildCustomCharacter` unsaved session sheet.
- [T04 Entry & setup UI](pvp-t04-entry-ui.md) — `arena` PanelPhase + 4-step wizard; main menu, Escape menu, city battlemaster + quartermaster NPCs.
- [T05 Rewards](pvp-t05-rewards.md) — `honor`/`arenaPoints` currencies, Warsong Outriders faction, static-stock PvP vendor (`executePvpBuy`), atomic `awardMatchRewards`, PvP achievements.
- [T06 Arena](pvp-t06-arena.md) — 5 WotLK maps (Nagrand, Blade's Edge, Dalaran Sewers, Ruins of Lordaeron, Ring of Trials/Valor); shared match loop (prep→live→finished); scoreboard; 2v2/3v3/4v4.
- [T07 Battlegrounds](pvp-t07-battlegrounds.md) — Warsong Gulch CTF (first to 3) + Arathi Basin node control (first to 1600); objective-aware NPC AI (flag-runners/escorts/defenders, capture groups).
- [T08 Polish](pvp-t08-polish.md) — scoreboard panel (Semicolon), announcements (horn/first-blood/sprees/objectives/victory), PvP achievements + arena rating ladder, balance pass.

## Out of scope

- Real networked PvP / multiplayer (NPC-only per request).
- Ranked ladder persistence across seasons, MMR decay.
- Spectate / replay.
- Eye of the Storm / Alterac Valley — engine-feasible via the same objective seam; not built this pass.
