# T06 — Arena mode (2v2/3v3/4v4, maps, match flow)

**Type:** task (AFK) · **Blocks:** T08 · **Blocked by:** T01, T02, T03, T04

## Question

How does Arena run: team sizes, WoW-faithful maps, match flow (prep → fight → end →
return)?

## Resolution (decided)

- **Sizes:** 2v2, 3v3, 4v4 (player-chosen). Player team = player + (N-1) chosen NPC
  teammates (class + role direction). Enemy team = N random NPCs at the player's level
  with random legal builds + equal-ilevel gear.
- **Maps (WotLK arenas, faithful within the polygonal-floor engine):**
  - Nagrand Arena — open field, 4 pillars, central platform.
  - Blade's Edge Arena — elevated bridge/platform, ropes, side ramps.
  - Dalaran Sewers — central water channel + raised ledges, tight.
  - Ruins of Lordaeron — open courtyard, central crypt mound, side alcoves.
  - Ring of Trials (Nagrand) — circular pit, 4 pillars.
  Pillars/ledges = DungeonProp obstacles (collision + LOS break where the engine allows).
- **Match flow:** enter via battlemaster/menu → setup panel → `planDungeonTravel`-style
  transition into the `pvp:` floor → brief prep phase (gates open) → fight until one team
  wiped → scoreboard → award Honor/ArenaPoints/rep → return to exact start point.
- **Custom mode:** session character built via T03, discarded after; only rewards persist.

New files: `pvp-arena.ts` (match controller), `arena-maps.ts` (floor builders per map),
`pvp-scoreboard.ts`. Edits: per T01/T02 integration points.
