# T01 — PvP combatant model (how NPCs fight as class characters)

**Type:** task (AFK) · **Blocks:** T02, T05, T06, T07 · **Blocked by:** —

## Question

How do NPC combatants fight as real class characters (skills, resource, gear, talents,
status) on both teams? Player/Enemy/Ally are disjoint; enemies can't use player skills.

## Resolution (decided)

**Model: Player-driven combatants.** Each NPC is a `Player`-shaped actor (full
CharacterSheet + derived stats + skills + resource + buffs) driven by a class AI that
synthesizes `Input` each fixed step — the same control surface the real player uses.
The match runs in a PvP instance; combatants carry a `team` ('A' player team / 'B' enemy
team). The sim's single-player assumption is generalized minimally:

- Introduce a `Combatant` view over the Player shape (position, hp, resource, team,
  targetId, skills, cc/dots). The real player is combatant[0] on team A.
- Damage/status: extend the player damage path to all combatants (port enemy
  dots/slows/stagger/cc onto the Player status surface — `p.cc`/`p.dots` become live).
- Targeting: each combatant's AI picks a hostile-team target; `resolveTarget` /
  `enemies` lists become "hostile combatants" for that combatant.
- Death: a combatant at 0 hp becomes a corpse/spectator, not a sim halt; match ends on
  team wipe or objective, not on `player.dead` (suppress the death→defeat flow inside PvP).

New files: `pvp-combatant.ts` (Combatant type + team helpers), `pvp-ai.ts` (class AI →
Input), `pvp-status.ts` (player-side dots/cc/slows). Edits: model.ts (Player.dots live,
team field), combat-damage.ts, combat-status.ts, skill-combat.ts (generalize context),
simulation.ts (drive N combatants, PvP death rule).

## Why

Reuses the entire player skill/gear/talent/status engine for free — an NPC mage casts
real Fireball with real mana/cooldowns. The alternative (teach Enemy archetypes player
skills) duplicates the whole skill engine. Synthesized Input keeps AI honest: NPCs obey
the same GCD/cast/cost rules as the player.
