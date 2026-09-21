# T05 — Factions + race-correct starting zones

**Type:** task (AFK) · **Blocks:** T10 · **Blocked by:** T01

## Question

How do Alliance/Horde factions drive starting locations, NPC hostility, and guards — so a
Dwarf starts near Ironforge and an Orc near Orgrimmar, and the opposing faction fights you?

## Scope

- Race → faction → starting zone mapping (wow-races.ts already has races; add faction +
  home zone). Dwarf/Draenei/Gnome/Human/Night Elf = Alliance; Orc/Troll/Tauren/Undead/
  Blood Elf = Horde.
- Starting position: new characters spawn in their race's WoW starting zone (Coldridge
  Valley / Northshire / Shadowglen / Valley of Trials / Sen'jin / Red Cloud Mesa /
  Deathknell / Sunstrider Isle / Azuremyst) at the atlas position.
- Faction hostility: faction NPCs/mobs are friendly or hostile by your faction; enemy
  guards attack on sight; enemy cities are dangerous.
- Reputation integration if a rep system exists (extend, don't duplicate).

## Acceptance

- `factions.ts`: race→faction→start-zone; `startingZone(raceId)` returns an atlas zone +
  spawn point; character creation places the player there.
- Faction NPCs carry a faction tag; hostility resolved against the player's faction.
- `factions.test.ts` covers every race's start zone and faction hostility matrix.
