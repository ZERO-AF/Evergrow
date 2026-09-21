# T09 — Outland authored zone content

**Type:** task (AFK) · **Blocks:** T10 · **Blocked by:** T02, T03

## Target

Author `game/src/zone-content-outland.ts`: one `defineZoneContent({...})` per
Outland zone (7 zones). The file already exists as a stub that imports
`defineZoneContent` — replace the TODO body. Do NOT touch `zone-content.ts`,
`authored-world.ts`, or any other continent file.

## Contract

`ZoneContent` (see `game/src/zone-content.ts`): `id`, `palette`, `props`,
`elevation?`, `water?`, `roads`, `towns`, `camps`, `spawns`, `pois`, `entrances`.
`nx/ny` normalized in-rect; road `points` world-space.

## Data source

`wayfinder/atlas-by-continent.json` → `outland` array. Honor every atlas
city/dungeon/dock at its normalized position; add WoW-faithful towns/POIs.

## Vocabulary

- PROP_KINDS: sandstoneShard,dryGrass,desertScrub,thornBrush,sandstone,steppeStone,tree,deadTree,rock,shrine,canopy,willow,reeds,fern,flowers,snowPine,iceCrystal,charredTree,basalt,emberRock,autumnTree,leafPile,windTree,heather,limestone,tussock,mushrooms,stump,lilies
- WildernessKind: bossLair,camp,watchtower,graveyard,standingStones,caravan,cursedChest,ruinedChapel,beastDen,quarry,hamlet,crossing,corruptedGrove
- POIKind: rift,bossLair,cursedChest,ruinedChapel,beastDen,quarry,hamlet,crossing,corruptedGrove,dungeon,reliquary,portal,town,gambler,stash,blacksmith,jeweler,enchanter,merchant,inn,chapel,shrine,landmark,camp,watchtower,graveyard,standingStones,caravan,necropolis
- DungeonThemeId: rootbound,foundry,drowned,rime,ossuary,astral,blackrock
- EnemyKind: thornReaver,mireSpitter,frostRevenant,emberAcolyte,duneScuttler,stormSentinel,briarMatriarch,ashColossus,graveMarshal,warden,goblin,goblinChief,stalker,brute,caster,hound,archer,wisp

## WoW fidelity (Outland)

Hellfire Peninsula=shattered red waste (sunscar/basalt/emberRock + elevation),
Zangarmarsh=fungal marsh (swamp/mushrooms/reeds + water), Terokkar=forest
(verdant/tree/mushrooms), Nagrand=plains (steppe/tussock/heather + floating rock),
Blade's Edge=spiky mountains (highlands/rock/basalt + elevation), Netherstorm=
arcane shattered rock (emberfall/iceCrystal/basalt + elevation), Shadowmoon=
fel volcanic (emberfall/basalt/charredTree + elevation). Heavy `elevation` use
for the shattered/floating feel. Match mob tables to WoW creatures.

## Acceptance

- `npx tsc --noEmit` clean; `tsconfig.core.json` clean (add the file if needed).
- Every Outland zone id in the atlas has a `defineZoneContent` entry.
- New `game/tests/zone-content-outland.test.ts` asserts all 7 ids register,
  non-empty props+spawns, atlas cities→towns, atlas dungeons→entrances,
  normalized coords in [0,1].
- Run the new test + `tests/authored-world.test.ts` + `tests/world-atlas.test.ts` green.
