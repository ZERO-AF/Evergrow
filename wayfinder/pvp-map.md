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

- [T01 PvP combatant model](pvp-t01-combatant-model.md) — NPCs are Player-shaped actors driven by class AI synthesizing `Input`; port dots/cc onto the player status surface; PvP death ≠ sim halt.
- [T02 PvP instance chassis](pvp-t02-instance-chassis.md) — reuse the dungeon chassis; `pvp:` entrance → `buildPvpFloor`; `planDungeonTravel` gives exact return-to-start; pillars as props.
- [T03 NPC & Custom chargen](pvp-t03-chargen.md) — `createCharacterSheet`+`buildSkillRoutes` random legal builds + `generateItem` equal-ilevel gear; Custom = unsaved session sheet.
- [T04 Entry & setup UI](pvp-t04-entry-ui.md) — one `arena` PanelPhase reached from main menu, Escape menu, and a city battlemaster; step wizard for mode/size/team/custom.
- [T05 Rewards](pvp-t05-rewards.md) — `honor`/`arenaPoints` on CharacterSheet + PvP faction + static-stock honor vendor + durable match-end award.
- [T06 Arena](pvp-t06-arena.md) — 2v2/3v3/4v4 on 5 WotLK arena maps; prep→fight→scoreboard→return.
- [T07 Battlegrounds](pvp-t07-battlegrounds.md) — Warsong Gulch CTF + Arathi Basin node-control first; EotS/AV stretch.
- [T08 Polish](pvp-t08-polish.md) — scoreboard, announcements, PvP achievements, balance.

## Not yet specified

- NPC class-AI depth per spec (kiting, healing triage, focus-fire, peel) — tuned inside T01/T06.
- Honor/Arena-Point gain formulas + rating ladder — tuned inside T05/T08.
- Battleground team sizes vs sim combatant-count budget — resolved inside T07.

## Out of scope

- Real networked PvP / multiplayer (NPC-only per request).
- Ranked ladder persistence across seasons, MMR decay.
- Spectate / replay.
