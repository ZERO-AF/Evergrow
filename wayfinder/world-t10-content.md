# T10 — Content density: dungeons, vendors, routines, quests

**Type:** task (AFK) · **Blocks:** T11 · **Blocked by:** T04, T05, T06, T07, T08, T09

## Question

Fill the authored world with its living content: every dungeon entrance at its true
position, every vendor/service, NPC daily routines, and zone-appropriate quests.

## Scope

- **Dungeon entrances**: every WotLK dungeon/raid entrance placed at its atlas position
  (Ragefire in Orgrimmar, Deadmines in Westfall, Wailing Caverns in Barrens, … through
  Naxxramas/Ulduar/ICC in Northrend). Reuse the `dungeon:`/`pvp:` entrance chassis; each
  entrance maps to a generated floor (full interior layouts may graduate to their own
  tickets).
- **Vendors/services**: blacksmith, jeweler, enchanter, gambler, stash, innkeeper,
  flight master, battlemaster, quartermaster per city/village — reusing the existing
  service/NPC framework, placed at atlas positions.
- **NPC daily routines**: NPCs follow a schedule (patrol, work, sleep, wander) rather
  than standing static — a bounded routine system on the NPC layer.
- **Quests**: zone-appropriate quest givers with kill/collect/deliver quests matching the
  zone's level range and faction. Extend the journey/quest system into real quests.

## Acceptance

- Every atlas dungeon entrance is present and enterable; every city has its services;
  NPCs move on routines; each zone offers quests.
- `world-content.test.ts` covers entrance placement, vendor presence, routine stepping.
