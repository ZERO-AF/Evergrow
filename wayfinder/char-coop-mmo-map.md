# Wayfinder Map — Character Overhaul + Couch Co-op + MMORPG

> Local-markdown tracker. This file is the map (label `wayfinder:map`). Tickets are sibling
> files `ccm-tNN-*.md`. Frontier = open tickets with no open blockers.
>
> **Autonomous override:** the user directed fully-autonomous execution ("voll autonom,
> keine Zwischenfragen … starte die nächsten Runden"). This map carries execution, not just
> decisions — tickets are worked to completion by the agent + subagents with review gates,
> one workstream at a time, looping until done. No HITL tickets; the human playtests after.

## Destination

Three deliverables, all reachable from the game UI with zero manual config:

1. **Character overhaul** — every race (esp. non-human: tauren, orc, troll, undead,
   draenei, gnome, dwarf, night/blood elf) renders correctly proportioned and correctly
   skinned from all eight facings; the character editor is WoW-grade.
2. **Couch co-op** — two controllers, two characters, two saves, shared quests; one camera
   zooms to fit both while on-screen together, splits to two views when they separate.
3. **MMORPG** — toggle online/offline from the game UI anytime; a shared world with other
   players when online, seamless return to local/couch when offline.

## Notes

- Domain: 2D WoW-like ARPG, Vite+TS, no runtime deps, deterministic 120 Hz sim.
- Read `docs/architecture.md`, `docs/character-saves.md`, `docs/system-status.md` first.
- Race visuals: `wow-races.ts` (per-race `visual` + `skinTones`), `player-art.ts`,
  `appearance-*.ts`, `character-editor.ts`, `character-look.ts`, `player-arm-rig.ts`,
  `player-leg-rig.ts`, `character-motion.ts`, `character-pose.ts`.
- Input: `gamepad-input.ts`, `game-input.ts`, `game-keyboard.ts`, `touch-*.ts`.
- Sim is single-player-authoritative today (`Simulation` owns one `player`). Co-op and MMO
  both need a second controlled actor — the shared seam is a `PlayerController` abstraction.
- Reference MMORPG: `C:/Users/zeron/Downloads/dev/world-of-claudecraft`.
- Keep it local; no Sites/deploy. Player does gameplay testing — do NOT drive gameplay.
- All tests + `npx tsc --noEmit` + `tsconfig.core.json` must stay green.
- Review gates: a critic agent reviews each workstream's output before commit.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [T02 co-op model](ccm-t02-couch-coop.md) — shared-sim-two-players via the existing PvP `withActor`/`ActorControl`/`pvpCombatants` seam: a second real `Player` driven by a second `Input`; `update(dt, inputs[])`; enemies/threat/loot resolve against `players[]`; two-Renderer split-screen; two CharacterSessions. Two-sims rejected.
- [T03 netcode model](ccm-t03-mmo.md) — server-authoritative WebSocket sync (Node/Bun host runs the real `Simulation` at 120 Hz; clients send `Input` frames, receive interest-scoped snapshots, predict only self-movement, interpolate remotes via the `pvpCombatants`/`ActorControl` seam). world-of-claudecraft supplies portable patterns (input timeline, interest policy, net-interp clock, reconnect). Lockstep & host-relay rejected. Depends on the T02 PlayerController seam.

## Not yet specified

- Split-screen renderer topology (two viewports vs one canvas scissor) — depends on how
  `renderer.ts` composes the frame.
- MMO server hosting surface (in-process host vs separate relay binary) — resolved during
  T03 build; the netcode model is settled above.

## Out of scope

- Sites/cloud deployment of the multiplayer server (local/LAN + user-hosted only).
- Cross-platform matchmaking, persistent world servers, anti-cheat.
- More than 2 local players (couch co-op is 2P).

## Tickets

- [T01 Character overhaul — race proportions, skin, editor](ccm-t01-character-overhaul.md)
- [T02 Couch co-op — two players, split camera, two saves](ccm-t02-couch-coop.md)
- [T03 MMORPG — online/offline toggle, shared world](ccm-t03-mmo.md)
