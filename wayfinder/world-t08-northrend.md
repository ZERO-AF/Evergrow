# T08 — Northrend authored zone content

**Type:** task (AFK) · **Blocks:** T10 · **Blocked by:** T02, T03

## Target

Author `game/src/zone-content-northrend.ts`: one `defineZoneContent({...})` per
Northrend zone (10 zones). The file already exists as a stub that imports
`defineZoneContent` — replace the TODO body. Do NOT touch `zone-content.ts`,
`authored-world.ts`, or any other continent file.

## Contract

`ZoneContent` (see `game/src/zone-content.ts`): `id`, `palette`, `props`,
`elevation?`, `water?`, `roads`, `towns`, `camps`, `spawns`, `pois`, `entrances`.
`nx/ny` normalized in-rect; road `points` world-space.

## Data source

`wayfinder/atlas-by-continent.json` → `northrend` array. Honor every atlas
city/dungeon/dock at its normalized position; add WoW-faithful towns/POIs.

## Vocabulary

- PROP_KINDS: sandstoneShard,dryGrass,desertScrub,thornBrush,sandstone,steppeStone,tree,deadTree,rock,shrine,canopy,willow,reeds,fern,flowers,snowPine,iceCrystal,charredTree,basalt,emberRock,autumnTree,leafPile,windTree,heather,limestone,tussock,mushrooms,stump,lilies
- WildernessKind: bossLair,camp,watchtower,graveyard,standingStones,caravan,cursedChest,ruinedChapel,beastDen,quarry,hamlet,crossing,corruptedGrove
- POIKind: rift,bossLair,cursedChest,ruinedChapel,beastDen,quarry,hamlet,crossing,corruptedGrove,dungeon,reliquary,portal,town,gambler,stash,blacksmith,jeweler,enchanter,merchant,inn,chapel,shrine,landmark,camp,watchtower,graveyard,standingStones,caravan,necropolis
- DungeonThemeId: rootbound,foundry,drowned,rime,ossuary,astral,blackrock
- EnemyKind: thornReaver,mireSpitter,frostRevenant,emberAcolyte,duneScuttler,stormSentinel,briarMatriarch,ashColossus,graveMarshal,warden,goblin,goblinChief,stalker,brute,caster,hound,archer,wisp

## WoW fidelity (Northrend)

Borean Tundra=tundra/geysers (frostpine/tussock/rock), Howling Fjord=fjord forest
(frostpine/snowPine/tree + water), Dragonblight=snowy graveyard (frostpine/deadTree/graveyard),
Grizzly Hills=pine forest (frostpine/snowPine/tree), Zul'Drak=troll ice ruins
(frostpine/iceCrystal/limestone), Sholazar Basin=jungle crater (verdant/fern/reeds + elevation rim),
Storm Peaks=high mountains (frostpine/rock/iceCrystal + elevation), Icecrown=glacier citadel
(frostpine/iceCrystal/basalt + elevation), Crystalsong=magic forest (verdant/iceCrystal/shrine),
Wintergrasp=battlefield lake (frostpine/rock + water). Heavy use of `elevation`
for cliffs/mesas is expected here. Match mob tables to WoW creatures.

## Acceptance

- `npx tsc --noEmit` clean; `tsconfig.core.json` clean (add the file if needed).
- Every Northrend zone id in the atlas has a `defineZoneContent` entry.
- New `game/tests/zone-content-northrend.test.ts` asserts all 10 ids register,
  non-empty props+spawns, atlas cities→towns, atlas dungeons→entrances,
  normalized coords in [0,1].
- Run the new test + `tests/authored-world.test.ts` + `tests/world-atlas.test.ts` green.
