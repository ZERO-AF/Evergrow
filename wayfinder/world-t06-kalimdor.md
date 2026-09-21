# T06 — Kalimdor authored zone content

**Type:** task (AFK) · **Blocks:** T10 · **Blocked by:** T02, T03

## Target

Author `game/src/zone-content-kalimdor.ts`: one `defineZoneContent({...})` per
Kalimdor zone (21 zones). The file already exists as a stub that imports
`defineZoneContent` — replace the TODO body. Do NOT touch `zone-content.ts`,
`authored-world.ts`, or any other continent file (they are owned by siblings).

## Contract

`ZoneContent` (see `game/src/zone-content.ts`):
- `id` — atlas zone id (must match `ZONES` key exactly).
- `palette` — the zone's atlas `terrain` string (drives ground color via TERRAIN_BIOME).
- `props` — `PropWeight[]` `{kind, weight}`; pick from PROP_KINDS below to match the zone's WoW look.
- `elevation?` — `ElevationSpec` (cliffs/ramps/valleys/mesas); use for canyon/mesa zones.
- `water?` — `WaterSpec[]` lakes/rivers; `nx/ny` normalized in-rect, `depth>=.75` blocks.
- `roads` — `RoadSpec[]` world-space polylines; connect towns to border crossings.
- `towns` — `TownSpec[]` `{name,nx,ny,faction,tier}`; use atlas `cities` + add WoW villages.
- `camps` — `CampSpec[]` `{kind?,name?,nx,ny,members?}`; mob camps.
- `spawns` — `SpawnEntry[]` `{kind,weight,levelOffset?}`; the zone's roaming mob table.
- `pois` — `POISpec[]` `{name,kind,nx,ny,description?}`; named locations.
- `entrances` — `EntranceSpec[]` `{name,nx,ny,levelMin?,levelMax?,kind?,theme?}`; dungeon/raid doors.

## Data source

`wayfinder/atlas-by-continent.json` → `kalimdor` array. Each zone gives `id`,
`name`, `terrain`, `faction`, `lvl`, `rect` (world-space), `cities`, `dungeons`,
`docks`, `borders`. Honor every atlas city/dungeon/dock at its normalized
position; add WoW-faithful towns/POIs beyond the atlas minimum.

## Vocabulary

- PROP_KINDS: sandstoneShard,dryGrass,desertScrub,thornBrush,sandstone,steppeStone,tree,deadTree,rock,shrine,canopy,willow,reeds,fern,flowers,snowPine,iceCrystal,charredTree,basalt,emberRock,autumnTree,leafPile,windTree,heather,limestone,tussock,mushrooms,stump,lilies
- BiomeId (for spawn/prop mood): deadwood,verdant,swamp,frostpine,emberfall,autumn,highlands,steppe,sunscar
- WildernessKind (camp.kind): bossLair,camp,watchtower,graveyard,standingStones,caravan,cursedChest,ruinedChapel,beastDen,quarry,hamlet,crossing,corruptedGrove
- POIKind: rift,bossLair,cursedChest,ruinedChapel,beastDen,quarry,hamlet,crossing,corruptedGrove,dungeon,reliquary,portal,town,gambler,stash,blacksmith,jeweler,enchanter,merchant,inn,chapel,shrine,landmark,camp,watchtower,graveyard,standingStones,caravan,necropolis
- DungeonThemeId: rootbound,foundry,drowned,rime,ossuary,astral,blackrock
- EnemyKind (18): thornReaver,mireSpitter,frostRevenant,emberAcolyte,duneScuttler,stormSentinel,briarMatriarch,ashColossus,graveMarshal,warden,goblin,goblinChief,stalker,brute,caster,hound,archer,wisp

## WoW fidelity (Kalimdor)

Teldrassil=world-tree forest (verdant/canopy/tree), Durotar=red canyon (sunscar/basalt/rock),
Mulgore=plains (steppe/tussock/heather), Barrens=savanna (steppe/dryGrass/thornBrush),
Ashenvale=forest (verdant/tree/fern), Felwood=corrupted (deadwood/deadTree/mushrooms),
Winterspring=snow (frostpine/snowPine/iceCrystal), Silithus=desert (sunscar/sandstone),
Tanaris=desert (sunscar/sandstoneShard), Un'Goro=jungle crater (verdant/fern/reeds + elevation rim),
Desolace=barren (deadwood/steppeStone), Stonetalon=mountains (highlands/rock/limestone),
Thousand Needles=canyon mesas (sunscar + elevation), Feralas=jungle (verdant/canopy),
Dustwallow=swamp (swamp/reeds/willow), Azshara=autumn ruins (autumn/autumnTree/leafPile),
Moonglade=sacred forest (verdant/shrine), Darkshore=coastal forest (verdant/willow),
Azuremyst/Bloodmyst=crystal isles (emberfall/iceCrystal/mushrooms).
Match each zone's mob table to its WoW creatures (map to nearest EnemyKind).

## Acceptance

- `npx tsc --noEmit` clean; `tsconfig.core.json` clean (add the file if needed).
- Every Kalimdor zone id in the atlas has a `defineZoneContent` entry.
- A new `game/tests/zone-content-kalimdor.test.ts` asserts all 21 ids register,
  each entry has non-empty props+spawns, atlas cities appear as towns, atlas
  dungeons appear as entrances, and normalized coords stay in [0,1].
- Run the new test + `tests/authored-world.test.ts` + `tests/world-atlas.test.ts` green.
