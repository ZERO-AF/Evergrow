/** Shared logical coordinates for Astral artwork, controls, and pointer routing. */
export const HUD_ART = Object.freeze({
  width: 520, height: 150, maxScale: .82,
  menu: Object.freeze({ x: 246, y: 31, width: 28, height: 28 }),
  skill: Object.freeze({ x: 134, y: 65, width: 40, height: 40, step: 42, count: 6 }),
  utility: Object.freeze({ left: 113, right: 379, y: 27, width: 28, height: 28 }),
  /** Racial active medallion (R key) seated in the right utility gap. */
  racial: Object.freeze({ x: 345, y: 27, width: 28, height: 28 }),
  orb: Object.freeze({ left: 74, right: 446, y: 70, scale: 1.18, readoutY: 122 }),
  inventory: Object.freeze({ skillY: 51, experienceY: 99, height: 136 }),
  experience: Object.freeze({ x: 133, y: 117, width: 254, height: 28, railHeight: 7 }),
});

export const HUD_MENU_SHORTCUTS = [
  { id: 'character', label: 'Character', key: 'C' },
  { id: 'inventory', label: 'Inventory', key: 'I' },
  { id: 'skilltree', label: 'Skill tree', key: 'T' },
  { id: 'journal', label: 'Journeys', key: 'J' },
  { id: 'transmog', label: 'Transmogrify', key: 'G' },
] as const;

/** Empty bindings reserve room for future equipped skills; they perform no action. */
export const HUD_SKILL_SLOTS = [
  { id: 'basic', key: 'LMB', action: 'attack' },
  { id: 'skill-1', key: 'RMB', action: null },
  { id: 'skill-2', key: '1', action: null },
  { id: 'skill-3', key: '2', action: null },
  { id: 'skill-4', key: '3', action: null },
  { id: 'skill-5', key: '4', action: null },
] as const;

export interface HUDRect { x: number; y: number; width: number; height: number; }
export interface HUDShortcut extends HUDRect { id: string; label: string; key: string; }
export interface HUDLayout extends HUDRect { scale: number; shortcuts: HUDShortcut[]; }

/** Art and native menu targets use the same responsive transform. The layout
 * is a pure function of the viewport, so the last result is cached — pointer
 * hit-tests and several draw passes ask for it every frame. */
let layoutCache: { width: number; height: number; layout: HUDLayout } | null = null;
export function getHUDLayout(width: number, height: number): HUDLayout {
  if (layoutCache && layoutCache.width === width && layoutCache.height === height) return layoutCache.layout;
  const scale = Math.max(0, Math.min(HUD_ART.maxScale,
    (width - 20) / HUD_ART.width, (height - 28) / HUD_ART.height));
  const hudWidth = HUD_ART.width * scale, hudHeight = HUD_ART.height * scale;
  const x = (width - hudWidth) / 2, y = height - hudHeight - 14;
  const menu = HUD_ART.menu;
  const layout: HUDLayout = {
    x, y, width: hudWidth, height: hudHeight, scale,
    shortcuts: [{ id: 'menu', label: 'Character menus', key: '',
      x: x + menu.x * scale, y: y + menu.y * scale,
      width: menu.width * scale, height: menu.height * scale }],
  };
  layoutCache = { width, height, layout };
  return layout;
}

/** Block the instrument's surfaces while leaving its surrounding space playable. */
export function isHUDPoint(x: number, y: number, width: number, height: number): boolean {
  // The layout is cached per viewport, so this stays allocation-free while
  // comparing against the exact same bounds the menu buttons were placed with.
  const h = getHUDLayout(width, height);
  if (h.scale <= 0 || x < h.x || x > h.x + h.width || y < h.y || y > h.y + h.height) return false;
  // The menu button uses the same bounds as its native target.
  for (const s of h.shortcuts)
    if (x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height) return true;
  const lx = (x - h.x) / h.scale, ly = (y - h.y) / h.scale;
  const utility = HUD_ART.utility;
  if ((lx >= utility.left && lx <= utility.left + utility.width + 15
      || lx >= utility.right - 27 && lx <= utility.right + utility.width)
    && ly >= utility.y && ly <= utility.y + utility.height + 5) return true;
  const racial = HUD_ART.racial;
  if (lx >= racial.x - 2 && lx <= racial.x + racial.width + 2 && ly >= racial.y && ly <= racial.y + racial.height + 5) return true;
  // Include a small input margin between adjacent skill plates.
  const skill = HUD_ART.skill;
  if (lx >= skill.x - 2 && lx <= skill.x + 5 * skill.step + skill.width + 2
    && ly >= skill.y - 4 && ly <= skill.y + skill.height + 7) return true;
  const xp = HUD_ART.experience;
  if (lx >= xp.x && lx <= xp.x + xp.width && ly >= xp.y && ly <= xp.y + xp.height) return true;
  const orb = HUD_ART.orb;
  return (Math.hypot(lx - orb.left, ly - orb.y) <= 55
      || (Math.abs(lx - orb.left) <= 5 && ly >= orb.y - 59 && ly <= orb.y - 45)
      || (Math.abs(lx - orb.left) <= 34 && ly >= orb.readoutY - 11 && ly <= orb.readoutY + 11))
    || (Math.hypot(lx - orb.right, ly - orb.y) <= 55
      || (Math.abs(lx - orb.right) <= 5 && ly >= orb.y - 59 && ly <= orb.y - 45)
      || (Math.abs(lx - orb.right) <= 34 && ly >= orb.readoutY - 11 && ly <= orb.readoutY + 11));
}
