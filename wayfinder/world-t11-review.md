# T11 — Review gates + travel-time validation

**Type:** task (AFK) · **Blocks:** — · **Blocked by:** T06, T07, T08, T09, T10

## Question

Does the converted world hit WoW fidelity, performance, and scale — verified by
independent critic agents and measured travel times?

## Scope

- **Critic agents** (independent reviewers, score 1–10):
  - *WoW fidelity* — does each zone read as its WoW counterpart (palette, layout,
    elevation, cities, mob mix)?
  - *Visual* — terrain blending, elevation shading, occlusion transparency, prop density.
  - *Performance* — frame cost of authored world + streaming + occlusion at scale.
  - *Gameplay* — travel feel, mob density, faction presence, quest flow.
- **Travel-time validation**: measure real traversal times between distant points
  (e.g. Orgrimmar → Tanaris, Stormwind → Blasted Lands) and confirm they land in the
  WoW-scale band the atlas `SCALE` targets (~40 min for a long cross-continent trip).
- **Review gates**: each continent must pass its critic gate before merge; fix-forward
  any score < 7.

## Acceptance

- Critic reports recorded; every continent ≥7 on fidelity/visual/performance/gameplay or
  the gap is ticketed.
- A measured travel-time table (route → minutes) matching WoW scale.
- Full suite + both tsconfigs green.
