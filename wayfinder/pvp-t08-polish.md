# T08 — PvP polish: scoreboard, announcements, achievements, balance

**Type:** task (AFK) · **Blocks:** — · **Blocked by:** T05, T06, T07

## Question

What makes it feel like WoW PvP — scoreboard, kill announcements, objective callouts,
PvP achievements, and a balance pass?

## Resolution (decided)

- **Scoreboard:** end-of-match + in-match (Tab-style) panel: names, class, kills, deaths,
  damage, healing, objective score (flag caps / node ticks). Reuse leaderboard/panel
  primitives.
- **Announcements:** center-screen + combat-log callouts — "X captured the flag",
  "Stables under attack", first-blood, killing-blow sprees. Reuse boss-warnings /
  notification-queue plumbing.
- **Achievements:** PvP category — first win, win streak, 100 honorable kills, capture N
  flags, hold all 5 nodes, win each arena map, reach rating tiers.
- **Balance:** NPC equal-ilevel + random builds vs player; tune team AI focus/peel so
  matches are winnable but not trivial; rating ladder adjusts enemy ilevel/build quality.
- **Audio/VFX:** match-start horn, kill stingers, flag pickup/capture cues via vfx-pack.

New files: `pvp-scoreboard-panel.ts`, `pvp-announce.ts`, `pvp-achievements.ts`.
Edits: achievement-content.ts, boss-warnings.ts/notification-queue.ts reuse.
