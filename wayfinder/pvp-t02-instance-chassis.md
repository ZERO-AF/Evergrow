# T02 — PvP instance chassis (enter/exit, return-to-start)

**Type:** task (AFK) · **Blocks:** T06, T07 · **Blocked by:** T01

## Question

How does a self-contained PvP map host a match and return the player to their exact
start point afterward?

## Resolution (decided)

Reuse the instanced-dungeon chassis verbatim. `generateDungeon` already branches on
entrance id for hand-authored floors (raid-boss precedent). Add a `pvp:` entrance scheme
→ `buildPvpFloor(mapId)` returning a frozen DungeonFloor (rooms/corridors/props/spawns).
`DungeonWorld` swaps in as `sim.world` unchanged. `planDungeonTravel` handles enter/exit
with checkpoint staging and exact `travel.returnTo` — the "return to where I started"
requirement is already its 'town'/'return'/'exit' path.

Handle the gotchas the scout flagged:
- `run.states.warden` unconditional derefs → author a captain/flag-carrier 'warden'
  member per map, or guard the derefs.
- Member admission requires off-screen spawns → small arenas need an admission bypass
  (combatants placed at fixed spawn points at match start, not streamed).
- Hearthstone inside a PvP instance → disable (no escape hatch mid-match).
- In-room LOS blockers (arena pillars) → geometry is a union of open polygons; represent
  pillars as `DungeonProp` obstacles with collision, not subtractive rooms.

New files: `pvp-floor.ts` (buildPvpFloor + map registry), `pvp-instance.ts` (match state
on top of DungeonRun). Edits: dungeon.ts (pvp branch), dungeon-command.ts (pvp enter/exit,
hearthstone gate), dungeon-runtime.ts (fixed-spawn admission for combatants).
