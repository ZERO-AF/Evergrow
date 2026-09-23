# QA-T06 — Performance: profile & optimize frame/render

**Type:** task (AFK) · **Status:** OPEN · **Blocks:** — · **Blocked by:** T02

## Question / Work

Profile and improve frame/render performance. The post chain and per-frame allocations
are the likely hot spots.

1. Use `frame-profiler.ts` / `performance-monitor.ts` (F3 or `?profile=1`) and a headless
   profile to find the top frame costs: render passes, lighting, postfx, actor art,
   terrain, allocations in the hot loop.
2. Fix the top offenders: avoid per-frame allocations/copies, cache light stamps and
   sprites, cull offscreen work, keep the world pass at the right resolution, avoid
   redundant gradient/canvas creation (the `lightStamp` cache exists — verify it's hit).
3. Keep the 120 Hz sim and 60 FPS draw budgets; don't change gameplay.
4. Measure before/after (frame ms, allocation rate). Report the delta.

## Acceptance

- Measurable frame-time improvement on the hot path; no new allocations per frame in
  the render loop.
- No visual or gameplay regression.
- `npx tsc --noEmit` clean; tests green.
