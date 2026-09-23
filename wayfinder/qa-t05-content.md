# QA-T05 — Content sweep: exercise every attack, skill, gear piece; fix bugs

**Type:** task (AFK) · **Status:** OPEN · **Blocks:** — · **Blocked by:** T01, T02

## Question / Work

Systematically exercise all combat content and fix what breaks. The user wants "every
attack tried once, every skill, every armor piece — really go through the whole code."

1. **Skills:** all 30 active skills + the 5-slot assignment + LMB basics for each weapon
   family (melee/bow/staff/wand). Use the headless sim / skill playground / review pages
   to trigger each and confirm it executes, costs mana correctly, respects cooldowns,
   and produces its effect without errors. Fix any that throw or no-op.
2. **Gear:** every weapon profile (17), shield (3), focus (6), armor slots, charms —
   equip each via `planEquipmentChange`/character-commands and confirm stats apply,
   handedness/off-hand rules hold, and art renders. Fix failures.
3. **Attacks:** basic attacks per weapon, paired one-handed alternation, 2H poses.
4. Watch the console for frame faults / validation warnings during the sweep; fix each.
5. Prefer headless sim tests + review pages (no manual gameplay driving). Add regression
   tests for any real bug found.

## Acceptance

- Every skill/attack/gear piece executes without error; bugs found are fixed.
- Console clean during the sweep (no frame faults, no validation resets).
- `npx tsc --noEmit` clean; tests green; regression tests for fixed bugs.
