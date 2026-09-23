# QA-T07 — Latent-bug sweep: code review for crashes/validation/state bugs

**Type:** task (AFK) · **Status:** OPEN · **Blocks:** — · **Blocked by:** —

## Question / Work

A dedicated hunt for the *class* of bugs the user just hit — latent crashes and silent
state resets — across the codebase, beyond the two already fixed.

1. **Crash class:** find every `addColorStop`/`fillStyle`/`strokeStyle`/`createGradient`
   that concatenates a suffix onto a color that might be `rgb()`/`rgba()`/named rather
   than `#rrggbb` — the same bug shape as the lighting crash. Grep for `` `${color}` ``,
   `+ 'ce'`, `+ '00'`, alpha-suffix patterns. Fix all to normalize via a shared helper.
2. **Validation-reset class:** find every checkpoint validator that can reject a
   legitimately-saved state (like the null-active world-event bug): loops over possibly-
   null entries, recomputed bounds that can drift from saved values, off-by-one ranges.
   Audit `*-save.ts`, `*-state.ts`, `valid*` functions. Fix real bugs; add round-trip
   regression tests.
3. **State-mutation class:** shared channels/buffers not owner-scoped in co-op (the
   `clearInput` class), per-actor vs shared state confusion.
4. Add regression tests for each real bug fixed.

## Acceptance

- The crash/validation/state bug classes are swept; real bugs fixed with tests.
- `npx tsc --noEmit` clean; tests green.
