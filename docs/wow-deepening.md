# WoW deepening — quests, mounts, professions, loot, bars, world systems

Second WoW pass on top of `wow-transformation.md`. Goal: WoW-meets-Diablo gameplay loops, not just combat. All features are additive; the existing combat model (tab-target, GCD, cast, auto-attack, resources) is untouched.

## Contract (frozen in code)

- `CHARACTER_SAVE_VERSION = 6`. v5 saves migrate on read: new fields default to empty.
- New `Player` fields (all optional, default undefined):
  - `mounted?: { id: MountId; since: number }` — active mount.
  - `restedXp?: number` — banked rested XP pool (earned while offline/in town).
  - `hearthstone?: { x: number; y: number; zone: string }` — bound inn location.
  - `professions?: Partial<Record<ProfessionId, { level: number; xp: number }>>`.
  - `quests?: Record<QuestId, QuestState>` — active/completed quest ledger.
  - `achievements?: Record<string, number>` — achievement id → progress/completed timestamp.
  - `glyphs?: Partial<Record<GlyphSlot, GlyphId>>` — major/minor glyph slots.
  - `fishing?: { level: number; xp: number }`.
  - `durability?: Partial<Record<EquipmentSlot, number>>` — current durability per equipped slot.
  - `combatLog?: CombatLogEntry[]` — bounded ring buffer (last 40).
- New `Input` actions: `mount` (KeyX), `hearthstone` (KeyH), `questLog` (KeyL), `professions` (KeyK), `achievements` (KeyY), `barPage` (Shift+1..3 → bar page), `interact` already exists.
- `GAME_FEATURES` flags: `quests`, `mounts`, `professions`, `lootBeams`, `actionBars`, `hearthstone`, `currency`, `combatLog`, `minimapTracking`, `bossWarnings`, `achievements`, `durability`, `fishing`, `glyphs`, `raidBoss`, `dungeon2` — all default true.

## Features

### 1. Quests (`quest-content.ts`, `quest-state.ts`, `quest-command.ts`, `quest-panel.ts`, `quest-marker.ts`)
WoW quest loop: NPC offers → accept → objectives → turn in → reward.
- `QuestDef { id, name, giver: NpcRole|'poi', level, type: 'kill'|'collect'|'explore'|'boss', objectives: [{kind, target, count}], rewards: {xp, gold, items?, skillPoints?}, next?: QuestId }`.
- ~20 quests seeded across home + districts: kill N of archetype, collect M drops, explore POI, boss kill. Chains via `next`.
- `QuestState { status: 'active'|'complete'|'turnedIn', progress: number[] }`.
- NPCs get `!` (available) / `?` (turn-in) overhead markers; quest items drop while quest active.
- Quest log panel (L): tracked quests, objectives, rewards. Map markers for objectives.
- Rewards commit through the durable command path (xp/gold/items), receipt-persisted.

### 2. Mounts (`mount-content.ts`, `mount-state.ts`, `mount-art.ts`)
- `MountDef { id, name, speed: number, art }`. 4 mounts: Horse (+60%), Wolf (+60%), Ram (+60%), Drake (+100%, achievement-gated).
- X toggles summon/dismiss (1.5s cast, interrupted by damage). Mounted: +speed, no combat (any offensive action dismounts), no indoor.
- Mount art: procedural quadruped under the player (reuse leg/torso primitives, saddle tint per mount).

### 3. Professions (`profession-content.ts`, `profession-state.ts`, `profession-command.ts`, `profession-panel.ts`)
- Gathering: Herbalism, Mining, Skinning. World nodes (herb/ore/beast corpses) glow when trackable; E to gather (channel), yields materials + profession xp.
- Crafting: Alchemy (potions), Blacksmithing (weapons/armor), Enchanting (enchants), Cooking (food buffs). Recipes need materials + skill level; craft at any time (no station required for v1).
- `ProfessionDef { id, name, kind: 'gather'|'craft', nodes?, recipes? }`. Level 1-450, xp per gather/craft, orange/yellow/green/gray difficulty.

### 4. Loot beams + VFX (`loot-beam.ts`, `loot-beam-art.ts`, `vfx-pack.ts`)
- Diablo-style vertical light beams on ground loot, colored by rarity (white/blue/yellow/orange/green). Visible through terrain, pillar of light + glow.
- VFX pack: cast-target circle decal, level-up golden burst, quest-complete flash, mount summon poof, gather sparkle, crit damage-number pop (bigger/shake).

### 5. Action bars (`action-bar.ts`, `action-bar-panel.ts`, `hud-action-bars.ts`)
- Expand from 5 skill slots to a 12-slot main bar + 2 optional side bars (paged). Drag skills/consumables/mount onto slots. Shift+1..3 pages.
- Reuses existing skill-slot assignment; new slots map to `skillSlots` extended to 12. Keys 1-9,0,-,=.

### 6. Hearthstone + rested (`hearthstone.ts`, `rested.ts`)
- Hearthstone item (H): 10s cast, teleports to bound inn (default home). Bind at innkeepers.
- Rested XP: accrues while in town/offline (simulated: while in settlement, +rested pool up to 1.5 levels). Kills consume rested for 2x xp. XP bar shows rested portion.

### 7. Currency (`currency.ts`)
- Gold/silver/copper: 1g = 100s = 10000c. Wallet stores copper total; display formats "12g 34s 56c". All existing gold flows route through the formatter.

### 8. Combat log / chat frame (`combat-log.ts`, `chat-frame.ts`)
- Bottom-left scrolling frame: combat log (damage/heal/xp/loot/death) + system messages (quest, level, discovery). Toggleable, bounded 40 lines, fades.

### 9. Minimap zone + tracking (`minimap-zone.ts`, `minimap-tracking.ts`)
- Zone name banner on area change (fade in/out, like WoW zone text).
- Minimap tracking dots: quest givers, gather nodes, vendors, innkeepers — toggleable filter.

### 10. Boss warnings (`boss-warnings.ts`)
- DBM-style center-screen warnings for boss telegraphs: "⚠ Warden casts X — move!", countdown bars for timed abilities. Driven by existing enemy cast/windup events.

### 11. Achievements (`achievement-content.ts`, `achievement-state.ts`, `achievement-panel.ts`)
- ~30 achievements: kills, level milestones, exploration, quests, professions, mounts, dungeon/raid clears. Toast on unlock + panel (Y).

### 12. Durability (`durability.ts`)
- Equipped items lose durability on death/combat; at 0 the item's stats stop applying (item kept). Repair at blacksmiths for gold. Durability shown on item tooltip + paper-doll warning icon.

### 13. Fishing (`fishing.ts`)
- Secondary profession: cast a bobber at water (E near water), wait for splash, click to catch. Fish = cooking materials + occasional junk/treasure. Level 1-450.

### 14. Glyphs (`glyph-content.ts`, `glyph-state.ts`, `glyph-panel.ts`)
- 3 major + 3 minor glyph slots (unlock at 15/30/50). Major glyphs modify a skill's numbers/behavior (e.g. +range, -cost, +duration); minor are cosmetic/convenience. Glyph items drop/vendor.

### 15. Raid boss (`raid-boss.ts`, `raid-boss-content.ts`)
- One multi-phase raid boss in a dedicated arena (new POI): 3 phases with phase-transition mechanics (adds, ground effects, enrage timer). Uses existing boss/dungeon plumbing; scaled for a solo player with allies.

### 16. Second dungeon (`dungeon2-content.ts`, `dungeon2-art.ts`)
- A second dungeon theme (e.g. "Emberfall Depths" — fire/forge) reusing `DungeonWorld`/`dungeon.ts` plumbing: new tileset, enemy composition, boss. Proves the dungeon system generalizes.

## Ownership

Shared contract files (model.ts, character-save.ts, control-bindings.ts, game-features.ts, input actions) are owned by the integrator (Main). Feature agents own their `*-content/-state/-command/-panel/-art` files and consume the contract; they do NOT edit shared files — integration hooks are added by the integrator after agents land.
