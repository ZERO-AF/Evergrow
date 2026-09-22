# T12 — Core systems + performance fixes (post-GeoFix)

**Type:** task (AFK) · **Blocked by:** T11 · **Blocks:** T14

## Own these files ONLY

`game/src/authored-world.ts`, `game/src/dungeon-command.ts`, `game/src/factions.ts`,
`game/src/world-save-upgrade.ts`, `game/src/save-hub.ts`, `game/src/zone-content.ts`,
`game/src/world-landscape.ts`, `game/src/elevation.ts`, `game/src/occlusion.ts`,
`game/src/road-shape.ts`, `game/src/hearthstone.ts`, `game/src/simulation.ts`
(spawn-table consumption only), `game/src/wilderness-sites.ts`, `game/src/camp-population.ts`,
plus new/edited tests. Do NOT touch world-atlas.ts, transport*.ts, zone-content-*.ts
data, settlement-art/elevation-art/transport-art, biome-props/biome-prop-art
(PresentationFix owns those).

## Systems bugs (from CriticSystems)

1. **Town portal band mismatch** — `getPortalAnchor(0)` returns band 593 (Stormwind)
   but `freshTravel().homeTown=0` → portal fails. Return `{...anchor, band:0}` for the
   home band, or initialize homeTown to the spawn town's band. Same fix for the
   dungeon 'town' portal action.
2. **Dungeon death unrecoverable** — `dungeon-command.ts` 'death' targets {x:0,y:0}
   (ocean in authored world). Target the dungeon's entrance or nearest graveyard.
3. **Raids unreachable** — `getDungeonEntrances` drops `EntranceSpec.kind` and emits
   `atlas:` ids that never match `isRaid*EntranceId`. Preserve kind + emit ids the
   raid gates recognize so authored raids generate raid floors; also keep the
   procedural raid entrances reachable.
4. **`zoneContent().spawns` dead data** — `spawnRoamingGroup` uses generic
   `chooseEncounterEnemy(biome,...)`. Consume the zone's authored `spawns` table
   (weighted pick + levelOffset) when inside an authored zone.
5. **113 non-camp member rosters dropped** — `getEnemyCamps`/`makeSite` only honor
   camp|bossLair members. Honor `members` on any authored site kind that carries them.
6. **factionAt ignores authored town factions** — resolve faction from authored
   `TownSpec.faction` (not only atlas `zone.cities`); 14 towns mis-tagged.
7. **generationVersion 11 orphans v10 saves** — add a 10→11 upgrade path in
   `world-save-upgrade.ts` (preserve characters/exploration; refresh changed world
   state) and let `save-hub.ts` import accept v11 bundles. Fix the town-POI regex
   to match `town:atlas:*` ids.
8. **Human racial spawn blocked by a tree** — nudge the Northshire spawn point or
   add a walkability fallback so the spawn is never inside a prop.
9. **CampSpec has no faction field** — add `faction?: FactionId` to CampSpec and
   route it into site/member faction tags (so factioned mobs can be expressed).
10. **Reliquaries never spawn authored** — `roadAnchors` excludes authored zones;
    place reliquaries along authored roads too.
11. **Home anchor faction-agnostic** — `getPortalAnchor(0)` always returns Stormwind;
    resolve the home anchor to the player's faction capital (or racial start town).
12. **authoredWater river width** — doc says half-width, code halves again; reconcile.
13. **Prop density gate missing** — authored props always place (~2x procedural);
    apply a landscapePropProbability-style density roll.
14. **Prop.occluder dead for authored props** — let authored prop tables carry
    occluder metadata through to the Prop.

## Performance bugs (from CriticPerformance)

15. **sampledSegmentClear disabled** — `world-landscape.ts:484` bails when
    `this.blocked !== WorldLandscape.prototype.blocked`; AuthoredWorld overrides
    blocked → LOS/walkable/nav fall to per-sample loops (100-700x slower). Give
    AuthoredWorld a real sampledSegmentClear (collision region already aggregates;
    only the elevation straddle check needs the sampled fallback) or make the guard
    a capability flag.
16. **ElevationField.siteAt re-resolves zone per sample** — memoize the last site
    (point still inside same zone rect) inside move/segment loops.
17. **zonesIn re-scans 62 zones per content query** — add a spatial index (coarse
    grid or per-continent lists) shared with the zoneAt fix.
18. **Cold-miss spikes** — bound per-frame prop/settlement generation (like
    getGroundTile's budget) and/or pre-warm towns at spawn/teleport so a 40-50ms
    synchronous generateSettlement can't hitch the query path.
19. **Ground tile ~2.5x slower** — per-tile zone fast path (a tile almost always
    sits in one zone) to collapse per-sample zoneAt cost in surfaceColor/terrainWater.

## Acceptance

- `npx tsc --noEmit` clean; `tsconfig.core.json` clean.
- Each fixed bug gets a regression test (portal band, dungeon respawn, raid
  entrance kind, authored spawns consumed, non-camp rosters, town factions, save
  upgrade, spawn walkable, camp faction, reliquary spawn, faction home anchor).
- Perf: a benchmark test or script showing LOS/walkable within ~2-5x of procedural
  (not 100x), zoneAt O(1), no per-frame flightPoints rebuild.
- Run your new tests + authored-world + factions + transport + dungeon + world-atlas green.
