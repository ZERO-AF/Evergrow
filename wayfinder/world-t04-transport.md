# T04 — Transport network (ships, zeppelins, portals, flight paths)

**Type:** task (AFK) · **Blocks:** T10 · **Blocked by:** T01, T02

## Question

How do players cross oceans and continents the WoW way — rideable ships and zeppelins on
real routes, mage-style portals, and taxi flight paths?

## Scope

- **Docks/harbors** placed at atlas positions (Ratchet, Booty Bay, Menethil, Theramore,
  Auberdine, Orgrimmar/Undercity zeppelin towers, Northrend ports…).
- **Moving transports**: a ship/zeppelin entity travels a route on a schedule; the player
  boards at the dock, rides in real time (WoW-scale duration), disembarks at the far dock.
  Reuse `Simulation.relocate` for the cross-continent position change; the vehicle is a
  moving platform the player stands on.
- **Portals**: fixed point-to-point links (Shattrath → capitals, etc) using the existing
  portal/travel command.
- **Flight paths**: taxi network — discover a flight master, then fly between unlocked
  points along a route (bounded cinematic or fast-forward travel).

## Acceptance

- `transport.ts` + content: every route in `TRANSPORTS` is rideable end-to-end; boarding
  moves the player with the vehicle; arrival places them at the destination dock.
- Portals teleport correctly; flight paths unlock and traverse.
- `transport.test.ts` covers route resolution, boarding, arrival position.
