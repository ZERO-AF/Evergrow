import { isAura } from './aura-content.ts';
import { auraPower } from './auras.ts';
import { PLAYER_ABILITIES } from './combat-content.ts';
import { GAME_FEATURES } from './game-features.ts';
import { drawHUDUtility } from './hud-utility-art.ts';
import { shade } from './hud-orb.ts';
import { MOUNTS } from './mount-content.ts';
import { resolveSkill } from './skill-progression.ts';
import { drawSkillIcon } from './skill-icon-canvas.ts';
import { SKILL_DEFINITIONS, canUseSkill } from './skill-content.ts';
import { text, textWidth } from './font.ts';
import { UI_THEME } from './ui-theme.ts';
import { WOW_COMBAT, isWowClassId } from './wow-types.ts';
import { WOW_CLASSES, RESOURCE_COLORS } from './wow-classes.ts';
import type { Player } from './model.ts';
import type { SkillId } from './character-types.ts';
import { BAR_KEY_LABELS, BAR_SLOTS, barIndex, type ActionBars, type BarStrip } from './action-bar.ts';
import { drawActionBarCaps } from './action-bar-caps.ts';
import { CONSUMABLES, consumableCount, } from './consumable-content.ts';
import { consumableCooldown } from './consumable-command.ts';
import { consumableShapes } from './consumable-art.ts';
import { hotbarSlotAt, isHotbarPoint, resolveBarLayout } from './hotbar-layout.ts';
/** WoW action bars (docs/wow-deepening.md §5): the 12-slot main bar shows the
 * active page and rides just above the Astral instrument; two side bars at the
 * right screen edge mirror the inactive pages. All geometry flows through
 * `actionBarLayout` so drawing and pointer hit-testing can never diverge. */

const UI = UI_THEME.palette;
const TAU = Math.PI * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** Absolute bar index under a screen point, or null. Geometry mirrors the draw pass. */
export function actionBarSlotAt(bars: ActionBars, x: number, y: number, width: number, height: number): number | null {
  return hotbarSlotAt(bars, x, y, width, height);
}

/** Pointer routing: any point over a bar slot blocks world input. */
export function isActionBarPoint(bars: ActionBars, x: number, y: number, width: number, height: number): boolean {
  return isHotbarPoint(bars, x, y, width, height);
}

function chamfer(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut = 3) {
  c.beginPath();
  c.moveTo(x + cut, y); c.lineTo(x + w - cut, y); c.lineTo(x + w, y + cut);
  c.lineTo(x + w, y + h - cut); c.lineTo(x + w - cut, y + h); c.lineTo(x + cut, y + h);
  c.lineTo(x, y + h - cut); c.lineTo(x, y + cut); c.closePath();
}

/** Horseshoe glyph tinted per mount; reads at side-bar size where art stamps would not. */
function mountGlyph(c: CanvasRenderingContext2D, id: keyof typeof MOUNTS, x: number, y: number, size: number) {
  const def = MOUNTS[id], r = size * .3;
  c.save(); c.translate(x, y); c.lineCap = 'round';
  c.strokeStyle = def.tint; c.lineWidth = size * .14;
  c.beginPath(); c.arc(0, -size * .04, r, Math.PI * .78, Math.PI * .22, true); c.stroke();
  c.strokeStyle = def.accent; c.lineWidth = size * .07;
  for (const a of [Math.PI * .92, Math.PI * .5, Math.PI * .08]) {
    c.beginPath();
    c.moveTo(Math.cos(a) * (r - size * .1), -size * .04 + Math.sin(a) * (r - size * .1));
    c.lineTo(Math.cos(a) * (r + size * .1), -size * .04 + Math.sin(a) * (r + size * .1));
    c.stroke();
  }
  c.restore();
}

function slotPlate(c: CanvasRenderingContext2D, x: number, y: number, size: number, occupied: boolean, active: boolean) {
  chamfer(c, x, y, size, size, 1);
  const well = c.createLinearGradient(x, y, x, y + size);
  well.addColorStop(0, occupied ? UI.steel : '#101a23'); well.addColorStop(1, UI.steelDeep);
  c.fillStyle = well; c.fill();
  c.strokeStyle = active ? '#c4ad7a' : occupied ? UI.silverDim : '#415763'; c.lineWidth = .8; c.stroke();
  c.strokeStyle = occupied ? UI.silver + '60' : '#52697670';
  c.beginPath(); c.moveTo(x + 4, y + 1.5); c.lineTo(x + size - 4, y + 1.5); c.stroke();
}

function skillSlot(c: CanvasRenderingContext2D, p: Player, id: SkillId, x: number, y: number, size: number, gcd: number, gcdDuration: number, keybind: string | null) {
  const definition = SKILL_DEFINITIONS[id];
  const cooldown = p.skillCooldowns[id] ?? 0;
  const compatible = canUseSkill(id, p.equipment);
  const resolved = resolveSkill(id, p.derived, p.character);
  const active = p.activeSkill === id || (isAura(id) && auraPower(p, id) > 0);
  const usable = !p.dead && compatible && cooldown <= 0 && p.mana >= resolved.mana;
  slotPlate(c, x, y, size, true, active);
  const glow = c.createRadialGradient(x + size / 2, y + size / 2, 0, x + size / 2, y + size / 2, size * .55);
  glow.addColorStop(0, active ? '#d3ba8035' : '#d3ba8015'); glow.addColorStop(1, '#d3ba8000');
  c.fillStyle = glow; c.fillRect(x + 1, y + 2, size - 2, size - 4);
  c.globalAlpha = usable ? 1 : .42;
  drawSkillIcon(c, id, x + size / 2, y + size / 2, size - 3);
  c.globalAlpha = 1;
  if (!compatible) {
    c.fillStyle = '#dc9a87'; c.beginPath(); c.moveTo(x + 3, y + 3); c.lineTo(x + 9, y + 3); c.lineTo(x + 3, y + 9); c.closePath(); c.fill();
  } else if (resolved.reservation) {
    text(c, `${Number(resolved.reservation.toFixed(1))}%`, x + size - 4, y + 3, .62, '#c6bbdd', 'right');
  } else if (cooldown > 0) {
    c.fillStyle = '#030a10a8'; c.fillRect(x + 2, y + 2, size - 4, (size - 4) * clamp(cooldown / Math.max(.001, resolved.cooldown)));
    text(c, cooldown.toFixed(1), x + size / 2, y + size / 2 - 4, 1.15, UI.ivory, 'center');
  } else if (resolved.mana > 0) {
    const cls = isWowClassId(p.character.classId) ? WOW_CLASSES[p.character.classId] : null;
    text(c, String(resolved.mana), x + size - 5, y + 3, .75, cls ? shade(RESOURCE_COLORS[cls.resource], .35) : '#91bddd', 'right');
  }
  if (gcd > 0 && !definition?.offGcd) {
    const sweep = -Math.PI / 2 + TAU * clamp(gcd / gcdDuration);
    c.save(); c.beginPath(); c.rect(x + 2, y + 2, size - 4, size - 4); c.clip();
    c.fillStyle = '#030a1090'; c.beginPath(); c.moveTo(x + size / 2, y + size / 2);
    c.arc(x + size / 2, y + size / 2, size * .72, -Math.PI / 2, sweep); c.closePath(); c.fill();
    c.restore();
  }
  if (keybind !== null) keyBadge(c, x, y, size, keybind, !p.dead);
  if (active) { c.fillStyle = '#c4ad7a'; c.fillRect(x + 8, y + size - 1, size - 16, .8); }
}



function keyBadge(c: CanvasRenderingContext2D, x: number, y: number, size: number, binding: string, lit: boolean) {
  const scale = Math.min(.78, (size - 9) / Math.max(1, textWidth(binding)));
  const badgeWidth = textWidth(binding) * scale + 5;
  c.fillStyle = '#07111de8'; c.fillRect(x + size - badgeWidth - 1, y + size - 10, badgeWidth, 9);
  text(c, binding, x + size - 3, y + size - 9, scale, lit ? UI.text : '#718490', 'right');
}

function potionSlot(c: CanvasRenderingContext2D, p: Player, x: number, y: number, size: number, keybind: string | null) {
  const usable = !p.dead && p.flasks > 0 && p.healCooldown <= 0;
  slotPlate(c, x, y, size, true, false);
  c.globalAlpha = usable ? 1 : .42;
  drawHUDUtility(c, 'potion', x + size / 2, y + size / 2, size - 3);
  c.globalAlpha = 1;
  if (p.healCooldown > 0) {
    const cooldown = PLAYER_ABILITIES.potion.cooldown * p.derived.cooldownMultiplier;
    c.fillStyle = '#030a10a8'; c.fillRect(x + 2, y + 2, size - 4, (size - 4) * clamp(p.healCooldown / Math.max(.001, cooldown)));
  }
  text(c, String(p.flasks), x + 4, y + size - 9, .8, p.flasks > 0 ? '#a9dfea' : '#718490');
  if (keybind !== null) keyBadge(c, x, y, size, keybind, !p.dead);
}

function mountSlot(c: CanvasRenderingContext2D, p: Player, id: keyof typeof MOUNTS, x: number, y: number, size: number, keybind: string | null) {
  const active = p.mounted?.id === id;
  slotPlate(c, x, y, size, true, active);
  c.globalAlpha = p.dead ? .42 : 1;
  mountGlyph(c, id, x + size / 2, y + size / 2, size - 3);
  c.globalAlpha = 1;
  if (keybind !== null) keyBadge(c, x, y, size, keybind, !p.dead);
  if (active) { c.fillStyle = '#c4ad7a'; c.fillRect(x + 8, y + size - 1, size - 16, .8); }
}

/** Consumable slot: item glyph, stack count bottom-left, shared cooldown veil. */
function consumableSlot(c: CanvasRenderingContext2D, p: Player, id: string, x: number, y: number, size: number, keybind: string | null, now = 0) {
  const def = CONSUMABLES[id];
  if (!def) { slotPlate(c, x, y, size, false, false); return; }
  const count = consumableCount(p.character, id), cooldown = def.buffCategory === 'potion' ? consumableCooldown(p, now) : 0;
  const usable = !p.dead && count > 0 && cooldown <= 0;
  slotPlate(c, x, y, size, true, false);
  c.globalAlpha = usable ? 1 : .42;
  c.save(); c.translate(x + size / 2, y + size / 2); c.scale(size / 22, size / 22);
  for (const shape of consumableShapes(def)) {
    c.beginPath();
    shape.points.forEach(([px, py], i) => i === 0 ? c.moveTo(px, py) : c.lineTo(px, py));
    if (shape.stroke) { c.strokeStyle = shape.stroke; c.lineWidth = shape.width ?? .7; c.stroke(); }
    else { c.closePath(); c.fillStyle = shape.fill ?? '#798590'; c.fill(); }
  }
  c.restore(); c.globalAlpha = 1;
  if (cooldown > 0) {
    c.fillStyle = '#030a10a8'; c.fillRect(x + 2, y + 2, size - 4, (size - 4) * clamp(cooldown / Math.max(.001, def.cooldown * p.derived.cooldownMultiplier)));
    text(c, cooldown.toFixed(1), x + size / 2, y + size / 2 - 4, 1.15, UI.ivory, 'center');
  }
  text(c, String(count), x + 4, y + size - 9, .8, count > 0 ? '#a9dfea' : '#718490');
  if (keybind !== null) keyBadge(c, x, y, size, keybind, !p.dead);
}

function strip(c: CanvasRenderingContext2D, p: Player, bars: ActionBars, layout: BarStrip, vertical: boolean, gcd: number, gcdDuration: number, keybinds: boolean, now = 0) {
  for (let i = 0; i < BAR_SLOTS; i++) {
    const x = vertical ? layout.x : layout.x + i * (layout.slot + layout.gap);
    const y = vertical ? layout.y + i * (layout.slot + layout.gap) : layout.y;
    const action = bars.actionAt(p, barIndex(layout.page, i));
    const keybind = keybinds ? BAR_KEY_LABELS[i] : null;
    if (!action) { slotPlate(c, x, y, layout.slot, false, false); if (keybind !== null) keyBadge(c, x, y, layout.slot, keybind, false); continue; }
    if (action.kind === 'skill') skillSlot(c, p, action.id, x, y, layout.slot, gcd, gcdDuration, keybind);
    else if (action.kind === 'potion') potionSlot(c, p, x, y, layout.slot, keybind);
    else if (action.kind === 'consumable') consumableSlot(c, p, action.id, x, y, layout.slot, keybind, now);
    else mountSlot(c, p, action.id, x, y, layout.slot, keybind);
  }
}

function pageTag(c: CanvasRenderingContext2D, x: number, y: number, page: number) {
  c.fillStyle = '#07111de8'; c.fillRect(x, y, 14, 14);
  c.strokeStyle = '#4a6573'; c.lineWidth = .7; c.strokeRect(x + .5, y + .5, 13, 13);
  text(c, String(page + 1), x + 7, y + 3, .8, UI.ivory, 'center');
}

export interface ActionBarDrawOptions { simTime?: number; }

/** Drawn at native display density after the floating HUD; no-ops when the
 * actionBars feature flag is off or the layout cannot fit. */
export function drawActionBars(c: CanvasRenderingContext2D, p: Player, bars: ActionBars, width: number, height: number, options: ActionBarDrawOptions = {}) {
  if (!GAME_FEATURES.actionBars) return;
  const layout = resolveBarLayout(bars, width, height);
  const gcd = options.simTime !== undefined ? Math.max(0, (p.gcdReady ?? 0) - options.simTime) : 0;
  const cls = isWowClassId(p.character.classId) ? WOW_CLASSES[p.character.classId] : null;
  const gcdDuration = cls?.gcd ?? WOW_COMBAT.gcdDefault;
  c.save();
  if (layout.main.visible) {
    drawActionBarCaps(c, layout.main);
    strip(c, p, bars, layout.main, layout.main.vertical, gcd, gcdDuration, true, options.simTime ?? 0);
    // WoW's page number rides the main bar's left end, riveted to the cap's lug.
    pageTag(c, layout.main.x - 18, layout.main.y + layout.main.slot - 14, layout.main.page);
  }
  for (const side of layout.sides) {
    if (!side.visible) continue;
    strip(c, p, bars, side, side.vertical, gcd, gcdDuration, false, options.simTime ?? 0);
    pageTag(c, side.x + side.slot / 2 - 7, side.y - 18, side.page);
  }
  c.restore();
}
