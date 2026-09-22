/** App-wide developer switches. No settings UI or saved per-character preferences.
 * Set battleBarks to false to disable all battle speech, including static reviews. */
export const GAME_FEATURES = {
  battleBarks: true,
  // WoW deepening (docs/wow-deepening.md)
  quests: true,
  mounts: true,
  professions: true,
  lootBeams: true,
  // Diablo-style rarity filter for ground loot (display-only; reveal key bypasses)
  lootFilter: true,
  // Ground equipment within reach glides to the player and auto-collects.
  lootVacuum: true,
  actionBars: true,
  hearthstone: true,
  currency: true,
  combatLog: true,
  minimapTracking: true,
  bossWarnings: true,
  achievements: true,
  durability: true,
  fishing: true,
  glyphs: true,
  // WoW jewelcrafting: socketed gems, socket bonuses, jeweler gem stock
  gems: true,
  // WoW melee attack table: miss/dodge/parry/glancing vs level delta + facing.
  attackTable: true,
 raidBoss: true,
 dungeon2: true,
 // Wave C (docs/wow-deepening.md, second pass)
 spellbook: true,
 itemSets: true,
  reputation: true,
  stats: true,
 castBars: true,
 bags: true,
 spellVfx: true,
  // Wave D (docs/wow-deepening.md, third pass)
  transmog: true,
  worldEvents: true,
  nameplates: true,
  dualSpec: true,
  // PvP (wayfinder/pvp-map.md): arena & battlegrounds, honor/arena points, vendor
  pvp: true,
  // Authored-atlas elevation shading + generalized occluder fade (wayfinder world-t03)
  elevation: true,
  // WoW world conversion (wayfinder/world-map.md): atlas transports
  transport: true,
  // WoW world (wayfinder world-t05): Alliance/Horde tags, hostility, racial starts
  factions: true,
  // WoW world (wayfinder world-t02): authored atlas replaces procedural climate
  authored: true,
  // Presentation-only combat juice: hit-stop, magnitude-scaled screen shake,
  // kill impact and crit popups. Never touches the 120 Hz simulation clock.
  combatJuice: true,
  // Legendary/epic drop moment: rarity stinger, minimap/world-map star,
  // name toast and a brief screen-edge pulse. Presentation only.
  legendaryMoment: true,
  // Diablo-style elite affixes: one seeded roll per elite (molten, arcane,
  // frozen, swift, shielding, avenger) with telegraphs and nameplate glyphs.
  eliteAffixes: true,
  // Massacre kill streaks: chained kills inside the window grant bonus XP and
  // announce at 10/25/50/100.
  killStreaks: true,
  // Rare goblin variant that flees, sheds gold, fountains loot on death and
  // portals out if it survives the escape window.
  treasureGoblins: true,
};
