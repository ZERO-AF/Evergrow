# T03 — NPC & Custom character generation

**Type:** task (AFK) · **Blocks:** T05, T06, T07 · **Blocked by:** —

## Question

How do we (a) generate a random level-N NPC of a class with a random legal talent build
and equal-ilevel gear, and (b) let Custom mode build a session character (level/skills/
gear) that never touches the save?

## Resolution (decided)

- **NPC sheet:** `createCharacterSheet(classId, raceId, look)` → set `level` + attributes
  → allocate talents via the validated path (`allocateSkillNode` over `buildSkillRoutes`
  legal neighbors, respecting `doctrineConflict`) until skillPoints spent → equip
  `generateItem(seed, itemLevel, kind, profileId, tierOverride)` per slot →
  `refreshCharacter`. Random build = seeded walk of affordable route neighbors.
- **Equal gear:** pick a target itemLevel from the match level; roll each slot at that
  ilevel with a rarity mix (mostly rare/epic at high level). Same generator the player
  loot uses → "same items the player can get."
- **Custom session char:** build the Player/sheet in memory, never construct a
  CharacterSession or call save — the appearance-editor `study:true` pattern. On match
  end, discard the session sheet; only rewards persist to the real character.
- **Role direction:** map heal/tank/dd to attributes + armorStyle + weapon family +
  doctrine/spec nodes per `WOW_CLASSES[id].roles`. Tank→vitality/armor/shield+Protection;
  heal→intelligence/manaRegen+Restoration/Holy; dd→strength-or-int + damage spec.

New files: `pvp-chargen.ts` (random NPC build + custom session builder + role presets).
Edits: none to shared files (consumes existing generators).
