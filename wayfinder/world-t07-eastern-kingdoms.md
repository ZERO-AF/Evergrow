# T07 — Eastern Kingdoms authored zone content

**Type:** task (AFK) · **Blocks:** T10 · **Blocked by:** T02, T03

## Target

Author `game/src/zone-content-eastern-kingdoms.ts`: one `defineZoneContent({...})`
per Eastern Kingdoms zone (24 zones). The file already exists as a stub that
imports `defineZoneContent` — replace the TODO body. Do NOT touch
`zone-content.ts`, `authored-world.ts`, or any other continent file.

## Contract

`ZoneContent` (see `game/src/zone-content.ts`): `id`, `palette` (atlas terrain
string), `props` (PropWeight[]), `elevation?`, `water?`, `roads`, `towns`,
`camps`, `spawns`, `pois`, `entrances`. Read the interface comments for field
shapes; `nx/ny` are normalized in-rect, road `points` are world-space.

## Data source

`wayfinder/atlas-by-continent.json` → `eastern-kingdoms` array. Honor every atlas
city/dungeon/dock at its normalized position; add WoW-faithful towns/POIs.

## Vocabulary

- PROP_KINDS: sandstoneShard,dryGrass,desertScrub,thornBrush,sandstone,steppeStone,tree,deadTree,rock,shrine,canopy,willow,reeds,fern,flowers,snowPine,iceCrystal,charredTree,basalt,emberRock,autumnTree,leafPile,windTree,heather,limestone,tussock,mushrooms,stump,lilies
- WildernessKind: bossLair,camp,watchtower,graveyard,standingStones,caravan,cursedChest,ruinedChapel,beastDen,quarry,hamlet,crossing,corruptedGrove
- POIKind: rift,bossLair,cursedChest,ruinedChapel,beastDen,quarry,hamlet,crossing,corruptedGrove,dungeon,reliquary,portal,town,gambler,stash,blacksmith,jeweler,enchanter,merchant,inn,chapel,shrine,landmark,camp,watchtower,graveyard,standingStones,caravan,necropolis
- DungeonThemeId: rootbound,foundry,drowned,rime,ossuary,astral,blackrock
- EnemyKind: thornReaver,mireSpitter,frostRevenant,emberAcolyte,duneScuttler,stormSentinel,briarMatriarch,ashColossus,graveMarshal,warden,goblin,goblinChief,stalker,brute,caster,hound,archer,wisp

## WoW fidelity (Eastern Kingdoms)

Elwynn=forest (verdant/tree/flowers), Westfall=farmland (steppe/dryGrass/tussock),
Redridge=red hills (autumn/steppeStone/rock), Duskwood=dark forest (deadwood/deadTree),
Dun Morogh=snow (frostpine/snowPine/iceCrystal), Loch Modan=lake highlands (highlands/rock + water),
Wetlands=marsh (swamp/reeds/willow), Silverpine=forest (verdant/deadTree),
Tirisfal=plagued forest (deadwood/mushrooms), Eversong=golden forest (autumn/autumnTree/flowers),
Ghostlands=dead forest (deadwood/charredTree), Hillsbrad=hills (highlands/heather),
Alterac=mountains (highlands/rock/snowPine + elevation), Arathi=highlands (highlands/steppeStone),
Hinterlands=forest hills (verdant/tree), Western/Eastern Plaguelands=blight (deadwood/mushrooms/graveyard),
Searing Gorge=volcanic (emberfall/basalt/emberRock), Burning Steppes=volcanic (emberfall/charredTree/basalt),
Badlands=badlands (sunscar/steppeStone/rock), Swamp of Sorrows=swamp (swamp/reeds/mushrooms),
Blasted Lands=blasted (emberfall/basalt/deadTree), Deadwind Pass=dead (deadwood/deadTree),
Stranglethorn=jungle (verdant/canopy/fern/reeds). Match mob tables to WoW creatures.

## Acceptance

- `npx tsc --noEmit` clean; `tsconfig.core.json` clean (add the file if needed).
- Every Eastern Kingdoms zone id in the atlas has a `defineZoneContent` entry.
- New `game/tests/zone-content-eastern-kingdoms.test.ts` asserts all 24 ids
  register, non-empty props+spawns, atlas cities→towns, atlas dungeons→entrances,
  normalized coords in [0,1].
- Run the new test + `tests/authored-world.test.ts` + `tests/world-atlas.test.ts` green.
