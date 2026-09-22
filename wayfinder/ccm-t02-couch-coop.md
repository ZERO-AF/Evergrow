# T02 — Couch co-op: two players, split camera, two saves — OPEN

**Type:** task (AFK) · **Blocks:** T03 · **Blocked by:** T01

## Question / Work

Local 2-player couch co-op: two controllers (or controller + keyboard), each player creates
and controls their own character, both accept quests, each has an independent character
save. While both are on the same screen the camera zooms to frame both; when they separate
beyond a threshold the screen splits into two viewports so each explores independently.

## Deliverables

1. A `PlayerController` seam: today `Simulation` owns one `player`. Introduce a second
   controlled actor sharing the world/sim (enemies, loot, quests see both). Decide shared-sim
   vs dual-sim; shared-sim is the WoW-co-op answer (same world, shared mobs/quests).
2. Input routing: gamepad 1 → P1, gamepad 2 (or keyboard) → P2; each drives its own
   movement/skills/target. `gamepad-input.ts` already exists — extend to a second index.
3. Camera: single shared camera that zooms out to fit both players while within a radius;
   splits into two side-by-side (or top/bottom) viewports past the threshold; rejoins when
   close again. `renderer.ts`/`camera.ts` need a two-viewport path.
4. Two character saves: each player has an independent `CharacterSave` slot; both persist.
5. Character creation for both players from the title screen (P1 then P2, or side-by-side).
6. Review gate + tests green.

## Acceptance

- Two controllers move two distinct characters; camera zooms/splits correctly; both save.
- `npx tsc --noEmit`, `tsconfig.core.json`, suite green.
