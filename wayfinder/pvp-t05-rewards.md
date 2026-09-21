# T05 — PvP rewards: Honor, Arena Points, faction rep, vendor

**Type:** task (AFK) · **Blocks:** T08 · **Blocked by:** T03

## Question

How do matches award Honor + Arena Points + faction reputation, and how does the player
spend them at a PvP vendor in the main game?

## Resolution (decided)

- **Currencies:** add `honor?: number` and `arenaPoints?: number` to `CharacterSheet`
  (optional int fields like gold) + `validSheet` checks + parallel `creditHonor`/
  `spendHonor`/`creditArenaPoints`/`spendArenaPoints` wallet helpers. Display beside
  `[data-gold]` in inventory-panel and the service header.
- **Faction:** add a PvP `FactionId` (e.g. `'warsong'` / `'arena'`) + one `FACTIONS`
  entry — auto-surfaces in the Reputation panel with standing bar + claimable rewards.
- **Award path:** match-end uses the durable `repClaimReward` pattern — stage
  checkpoint.character.honor/arenaPoints + checkpoint.reputation + reward items in ONE
  checkpoint → persist → commit. Per-kill honor can ride the live `repOnKill`-style path.
- **Vendor:** standalone NPC (stableMasterFor pattern) with STATIC stock (glyph/bag
  pattern) priced in honor/arenaPoints via a dedicated `executePvpBuy` command
  (glyph-command.ts:80 template). Stock = PvP gear set, weapons, mounts, tabard.
- **Achievements:** add 'PvP' category + criterion kinds (pvpWins, pvpKills, rating).

New files: `pvp-currency.ts`, `pvp-vendor.ts`, `pvp-rewards.ts`. Edits:
character-types.ts, character-save.ts, wallet.ts, reputation-content.ts,
achievement-content.ts, achievement-state.ts, inventory-panel.ts, service-panel.ts,
commerce-validation.ts (vendor role regex), game-features.ts (`pvp` flag).
