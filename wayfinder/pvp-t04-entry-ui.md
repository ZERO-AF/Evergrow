# T04 — Entry points & setup UI (menu / options / battlemaster / team picker)

**Type:** task (AFK) · **Blocks:** T06, T07 · **Blocked by:** —

## Question

How is PvP reached from the main menu, the in-game options, and a city NPC — and how does
the player compose their team (mode → size → teammates → role → custom build)?

## Resolution (decided)

Three entry points, all opening one `arena`/`pvp` PanelPhase with internal step state:

- **Main menu:** new `HomePage` in TitleScreen nav + panel mounted in `.title-library`
  (TitleActions loader hook). Lets you jump into a match without loading a save only in
  Custom mode; normal mode needs a loaded character.
- **Escape menu:** new `PauseDestination` in `PAUSE_CATEGORIES` (adventure group) +
  `PauseActions.openArena` → `panels.open('arena')`.
- **City battlemaster:** standalone NPC via the `stableMasterFor` pattern, anchored to a
  building fixture; `interact()` branch beside the stable-master case opens the panel.

Panel = one ui-window with steps: mode (Arena/Battleground) → bracket/size (2v2/3v3/4v4
or BG) → teammate class+role slots (StablePanel roster-slot pattern) → optional Custom
build editor (reuse character-editor `study` sheet) → Queue/Enter. Reuse
`attachPanelFrame`, `trapDialogFocus`, `data-*` delegation, card-grid selection.

New files: `pvp-panel.ts` (+`.css`), `pvp-setup.ts` (step state). Edits: game-phase.ts
('arena'), panel-coordinator.ts (OPEN_FROM + lifecycle), pause-navigation.ts,
pause-menu.ts, title-screen.ts (HomePage + loader), npcs.ts + game.ts interact()
(battlemaster), game-shell.ts (phase clause), PANEL_FRAMES.
