# QA-T03 — Mounts: verify render + discoverability (mechanic confirmed working)

**Type:** task (AFK) · **Status:** OPEN · **Blocks:** — · **Blocked by:** —

## Question / Work

The mount system is **fully implemented and works mechanically** — verified headless:
`mountToggle` → summon cast → `player.mounted` → `mountSpeedFactor` > 1. X is bound
(`control-bindings.ts` id `mount` → `KeyX`), `advanceMount` ticks in the sim, the
renderer draws the mount (`renderer.ts:1239`), and there's an action-bar mount slot
(`hud-action-bars.ts`). Three mounts are `unlock:'always'` (horse/wolf/ram).

The user reported "no mounts, nothing summoned, no speed boost, never seen one" — but
tested on the **stale 5199 build** which predates the system. So the real work is:

1. **Verify the mount renders** — confirm `drawMount`/`mountPose` actually draw a visible
   mount under the player (not invisible/tiny/off-screen). Screenshot a mounted player if
   you can stage one (a review page or a temporary harness — do NOT drive live gameplay).
2. **Discoverability** — the user didn't know mounts exist. Ensure the mount action is
   surfaced: the action-bar mount slot should show, the controls list documents X, and
   ideally a hint on first availability. Check `hud-action-bars.ts` mountSlot renders and
   the controls disclosure lists Mount/dismount.
3. **Edge cases** — summon interrupted by movement/attack (intended), indoor block,
   dismount on offense, ghost/dead block, co-op partner mount (asPlayer path at
   game.ts:2527). Confirm each behaves; fix real bugs.
4. Keep the regression test `tests/mount-summon.test.ts` passing; add coverage for any
   bug you fix.

## Acceptance

- Mounted player renders visibly; mount is discoverable (X documented + bar slot).
- Edge cases behave; any real bug fixed with a test.
- `npx tsc --noEmit` clean; tests green.
