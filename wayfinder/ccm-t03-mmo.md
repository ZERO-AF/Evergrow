# T03 — MMORPG: online/offline toggle, shared world — DONE (implemented; critic P1s fixed)

**Type:** task (AFK) · **Blocks:** — · **Blocked by:** T02

## Question / Work

Networked multiplayer: from the game UI, toggle online anytime — join a shared world with
other players — and drop back to local/couch anytime. No manual config; the player picks
"Go Online" / "Go Local" in-game. Reference: `C:/Users/zeron/Downloads/dev/world-of-claudecraft`.

## Deliverables

1. Netcode model decision (research): authoritative server vs host-relay vs lockstep.
   Reuse world-of-claudecraft's transport if it fits; else a minimal WebSocket relay.
   The deterministic 120 Hz sim favors server-authoritative state sync or input-lockstep.
2. A lightweight server/relay (Node/Bun) that hosts a shared world session; the game ships
   a "Host" + "Join" flow in the UI (host = this machine, join = address or LAN browse).
3. Remote player entities: other players render/interpolate in the world; combat, chat,
   and presence sync. Reuse the co-op `PlayerController` seam for remote actors.
4. Online↔offline toggle in the game menu: persist character locally always; online shares
   presence/world, offline returns to solo/couch seamlessly.
5. Review gate + tests green.

## Acceptance

- From the game UI: host or join a session, see another player move/fight in the shared
  world, toggle back to local without losing the character.
- `npx tsc --noEmit`, `tsconfig.core.json`, suite green.
