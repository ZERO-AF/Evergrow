/** App-wide developer switches. No settings UI or saved per-character preferences.
 * Set battleBarks to false to disable all battle speech, including static reviews. */
export const GAME_FEATURES = {
  battleBarks: true,
  // WoW deepening (docs/wow-deepening.md)
  quests: true,
  mounts: true,
  professions: true,
  lootBeams: true,
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
};
