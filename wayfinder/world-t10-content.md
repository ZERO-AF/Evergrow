# T10 — Zone quests + NPC daily routines

**Type:** task (AFK) · **Blocks:** T11 · **Blocked by:** T06–T09

## Target

Two workstreams in the authored world (AuthoredWorld + ZONE_CONTENT now serve
all 62 WoW zones; see `game/src/zone-content.ts`, `world-atlas.ts`).

### A. Expand zone quest coverage

`game/src/quest-content.ts` has 22 quests across 4 zones (Elwynn, Westfall,
Redridge, Duskwood). Givers resolve via `questGiverAnchors` (quest-command.ts):
NPC role + `giverBiome` + `giverTier`, or `giver:'poi'` on a world object.

Extend coverage so **every leveling zone band** has quests. Add quests for the
major WoW zones, prioritizing the classic 1-60 path and WotLK zones. Reuse the
existing `q({...})` helper and `QuestGiver` spec (role/poi + biome + tier). Keep
the WoW quest names/themes faithful (real WotLK quest names where possible).
Aim for ~5-8 quests per covered zone across: the remaining Alliance 1-60 zones
(Darkshore, Ashenvale, Stonetalon, Wetlands, Loch Modan, Hillsbrad, Arathi,
Desolace, Dustwallow, Tanaris, Feralas, Un'Goro, Felwood, Winterspring, Silithus,
Plaguelands, Searing Gorge, Burning Steppes, Blasted Lands), Horde starters
(Durotar, Mulgore, Tirisfal, Eversong, Silverpine, Barrens), Outland (Hellfire,
Zangarmarsh, Terokkar, Nagrand, Blade's Edge, Netherstorm, Shadowmoon), and
Northrend (Borean, Howling Fjord, Dragonblight, Grizzly Hills, Zul'Drak,
Sholazar, Storm Peaks, Icecrown). Match `giverBiome` to each zone's authored
biome (see zone-content-*.ts `palette`/TERRAIN_BIOME) and `giverTier` to the
town tier.

### B. NPC daily routines

`game/src/npcs.ts` NPCs are static anchors. Add a lightweight **daily routine**:
each town NPC gets a deterministic home anchor + a small set of waypoints (work
spot, inn, wander) and a time-of-day schedule so they stroll between them.
Presentation-only movement — NPCs must not change combat, saves, or collision.
Keep it bounded (a few waypoints per NPC, deterministic per NPC id). Draw them
walking via the existing npc-art path. Gate behind `GAME_FEATURES` if a flag
exists for it; otherwise wire it into the NPC update path used by the renderer.

## Acceptance

- `npx tsc --noEmit` clean; `tsconfig.core.json` clean.
- Extend/add a test asserting each covered zone id has >=1 quest whose giver
  spec resolves to a real anchor in that zone's authored world (use
  `questGiverAnchors` against `new AuthoredWorld(seed)` + the zone rect).
- NPC routines: a test asserting a town NPC's position changes over simulated
  time and returns near its anchor; deterministic per id.
- Run your new tests + `tests/quest-*.test.ts` + `tests/authored-world.test.ts` green.
