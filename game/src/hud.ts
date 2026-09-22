import { controls } from './control-preferences.ts';
import { SKILL_ACTIONS } from './control-bindings.ts';
import { isAura } from './aura-content.ts';
import { auraPower, manaCapacity } from './auras.ts';
import { canSpellweave } from './affix-combat.ts';
import { UNIQUE_RULES } from './unique-content.ts';
import { lungeReturn } from './unique-combat.ts';
import { skillSustain } from './skill-sustain.ts';
import { basicAttackWeapon } from './equipment.ts';
import { basicAttackManaCost } from './equipment.ts';
import { resolveSkill } from './skill-progression.ts';
import { PAD_SKILL_LABELS } from './gamepad-input.ts';
import { drawSkillIcon } from './skill-icon-canvas.ts';
import { SKILL_ICON_RECIPES } from './skill-icon-content.ts';
import { SKILL_DEFINITIONS, canUseSkill, skillWeapon } from './skill-content.ts';
import { drawHUDWeapon } from './hud-weapon-icon.ts';
import { drawHUDUtility } from './hud-utility-art.ts';
import type { Ally, GroundEffect, Player } from './model.ts';
import type { SkillId } from './character-types.ts';
import { PLAYER_ABILITIES, KILL_STREAK } from './combat-content.ts';
import { GAME_FEATURES } from './game-features.ts';
import { UI_THEME } from './ui-theme.ts';
import { text, textWidth } from './font.ts';
import { drawHUDSkillIcon } from './hud-icons.ts';
import { drawHUDOrb, shade } from './hud-orb.ts';
import { drawHUDFrame, drawHUDOrbFrame } from './hud-frame.ts';
import { drawHUDExperience, type ExperienceDisplay } from './hud-experience.ts';
import { HUD_ART, HUD_SKILL_SLOTS, getHUDLayout } from './hud-layout.ts';
import { RESOURCE_COLORS, WOW_CLASSES } from './wow-classes.ts';
import { WOW_RACES } from './wow-races.ts';
import { WOW_COMBAT } from './wow-types.ts';
import type { RuneKind, WowClassDef } from './wow-types.ts';
import { isWowClassId, isWowRaceId } from './wow-types.ts';
import { ALLY_TEMPLATES } from './wow-allies.ts';

// Preserve the public entrypoint for the shell and existing UI consumers.
export { HUD_MENU_SHORTCUTS, getHUDLayout, isHUDPoint } from './hud-layout.ts';
export type { HUDRect, HUDShortcut, HUDLayout } from './hud-layout.ts';

export interface HUDOptions { inventory?: boolean; groundEffects?: readonly GroundEffect[]; layout?: {x:number;y:number;scale:number}; touch?: boolean; gamepad?: boolean; reducedMotion?: boolean; healthTrail?: number; hitPulse?: number; experience?: ExperienceDisplay;
  /** Simulation clock; required for GCD sweeps and rune recharge (visual time diverges). */
  simTime?: number;
  /** Safe-area top inset for the floating buff strip. */
  topInset?: number; }

const UI = UI_THEME.palette;
const TAU = Math.PI * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** Blend two hex colors; amount 0 keeps `a`, 1 keeps `b`. */
function mixHex(a: string, b: string, amount: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), t = clamp(amount);
  const mix = (shift: number) => Math.round((pa >> shift & 255) + ((pb >> shift & 255) - (pa >> shift & 255)) * t);
  return `#${((1 << 24) | (mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).slice(1)}`;
}
/** WoW health ramp: wounded players read red, healthy ones green. */
function healthColor(ratio: number): string {
  const r = clamp(ratio);
  return r < .5 ? mixHex('#c0392b', '#e8c93a', r * 2) : mixHex('#e8c93a', '#7fd06a', (r - .5) * 2);
}

/** Class identity rides the sheet; absent until the WoW save schema lands. */
function wowClass(p: Player): WowClassDef | null {
  const id = 'classId' in p.character ? p.character.classId : undefined;
  return isWowClassId(id) ? WOW_CLASSES[id] : null;
}
/** Racial actives are race-gated skills; absent without a WoW race. */
function racialSkill(p: Player): SkillId | null {
  const id = 'raceId' in p.character ? p.character.raceId : undefined;
  // WOW_RACES racial ids are authored skill ids; the union cast is validated by the table.
  return isWowRaceId(id) ? WOW_RACES[id].racial as SkillId : null;
}
/** Class/WoW icons may lack glass recipes while the icon pass lands; fall back to a tinted rune. */
function skillIconSafe(c: CanvasRenderingContext2D, id: SkillId, x: number, y: number, size: number) {
  if (SKILL_ICON_RECIPES[id]) { drawSkillIcon(c, id, x, y, size); return; }
  const color = SKILL_DEFINITIONS[id]?.color ?? '#9db8c7';
  c.fillStyle = shade(color, -.55); c.fillRect(x - size / 2, y - size / 2, size, size);
  c.strokeStyle = color; c.lineWidth = .8; c.strokeRect(x - size / 2 + .5, y - size / 2 + .5, size - 1, size - 1);
  text(c, (SKILL_DEFINITIONS[id]?.name ?? '?')[0], x, y - size * .26, size / 11 * .9, shade(color, .45), 'center');
}

function polygon(c: CanvasRenderingContext2D, points: readonly number[]) {
  c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
}

function chamfer(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut = 3) {
  polygon(c, [x + cut, y, x + w - cut, y, x + w, y + cut, x + w, y + h - cut,
    x + w - cut, y + h, x + cut, y + h, x, y + h - cut, x, y + cut]);
}

function skills(c: CanvasRenderingContext2D, p: Player, time: number, gamepad = false, groundEffects: readonly GroundEffect[] = [], inventory = false, simTime?: number) {
  const field = HUD_ART.skill;
  const cls = wowClass(p), costColor = cls ? shade(RESOURCE_COLORS[cls.resource], .35) : '#91bddd';
  const gcd = simTime !== undefined ? Math.max(0, (p.gcdReady ?? 0) - simTime) : 0;
  const gcdDuration = cls?.gcd ?? WOW_COMBAT.gcdDefault;
  for (const [i] of HUD_SKILL_SLOTS.entries()) {
    const x = field.x + i * field.step, y = inventory ? HUD_ART.inventory.skillY : field.y, w = field.width, h = field.height;
    const skill = i > 0 ? p.character.skillSlots[i - 1] : null;
    const definition = skill ? SKILL_DEFINITIONS[skill] : null;
    const returning=skill==='lunge'?lungeReturn(p):undefined;
    const cooldown = skill && !returning ? p.skillCooldowns[skill] ?? 0 : 0;
    const sustain = skillSustain(skill, p, groundEffects);
    const occupied = i === 0 || !!skill, active = i === 0 ? !!p.attack : !!skill && (p.activeSkill === skill || !!sustain || isAura(skill)&&auraPower(p,skill)>0);
    const compatible = !skill || canUseSkill(skill, p.equipment);
    const resolved = skill ? resolveSkill(skill, p.derived, p.character) : null;
    const manaCost = returning ? 0 : resolved?.mana ?? (i === 0 ? basicAttackManaCost(basicAttackWeapon(p), p.derived) : 0);
    const weaveWeapon = skill ? skillWeapon(skill, p.equipment) : basicAttackWeapon(p);
    const weaveKind = definition?.requirement === 'magic' || weaveWeapon?.attackKind === 'bolt' ? 'spell' : weaveWeapon?.attackKind === 'melee' ? 'melee' : null;
    const weaveReady = occupied && !returning && canSpellweave(p) && weaveKind && (p.affixBuffs?.[weaveKind] ?? 0) > 0 && (!definition || definition.damageMultiplier > 0);
    const usable = !p.dead && compatible && cooldown <= 0 && p.mana >= manaCost;
    c.save();
    chamfer(c, x, y, w, h, 1);
    const well = c.createLinearGradient(x, y, x, y + h);
    well.addColorStop(0, occupied ? UI.steel : '#101a23'); well.addColorStop(1, UI.steelDeep);
    c.fillStyle = well; c.fill();
    c.strokeStyle = active ? '#c4ad7a' : occupied ? UI.silverDim : '#415763'; c.lineWidth = .8; c.stroke();
    c.strokeStyle = occupied ? UI.silver + '60' : '#52697670';
    c.beginPath(); c.moveTo(x + 4, y + 1.5); c.lineTo(x + w - 4, y + 1.5); c.stroke();
    if (occupied) {
      const glow = c.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 20);
      glow.addColorStop(0, active ? '#d3ba8035' : '#d3ba8015'); glow.addColorStop(1, '#d3ba8000');
      c.fillStyle = glow; c.fillRect(x + 1, y + 2, w - 2, h - 4);
      c.globalAlpha = usable ? 1 : .42;
      c.save(); c.beginPath(); c.rect(x + 2, y + 2, w - 4, h - 4); c.clip(); c.translate(x + w / 2, y + h / 2);
      if (skill) skillIconSafe(c, skill, 0, 0, w - 2);
      else if (basicAttackWeapon(p).family === 'unarmed') drawHUDSkillIcon(c, 0, 0, 0, time, active);
      else drawHUDWeapon(c, basicAttackWeapon(p).visual, w - 7);
      c.restore(); c.globalAlpha = 1;
      if (!compatible) {
        c.fillStyle = '#dc9a87'; c.beginPath(); c.moveTo(x + 3, y + 3); c.lineTo(x + 9, y + 3); c.lineTo(x + 3, y + 9); c.closePath(); c.fill();
      } else if(resolved?.reservation){
        text(c,`${Number(resolved.reservation.toFixed(1))}%`,x+w-4,y+3,.65,'#c6bbdd','right');
      } else if(skill==='piercingShot'&&p.skillEffects?.draw){
        const draw=p.skillEffects.draw;
        text(c,draw.elapsed>=UNIQUE_RULES.drawTime?'READY':`${Math.round(draw.elapsed/UNIQUE_RULES.drawTime*100)}%`,x+w/2,y+h/2-4,.75,'#d4e7ba','center');
      } else if(returning){
        text(c,'RETURN',x+w/2,y+h/2-9,.65,'#d2bee6','center');
        text(c,`${returning.remaining.toFixed(1)}s`,x+w/2,y+h/2+1,.7,'#d2bee6','center');
      } else if (definition && cooldown > 0) {
        c.fillStyle = '#030a10a8'; c.fillRect(x + 2, y + 2, w - 4, (h - 4) * clamp(cooldown / Math.max(.001, resolved!.cooldown)));
        text(c, cooldown.toFixed(1), x + w / 2, y + h / 2 - 4, 1.3, UI.ivory, 'center');
      } else if (manaCost > 0) text(c, String(manaCost), x + w - 5, y + 3, .8, costColor, 'right');
      // Shared GCD wipe: a radial sweep with a lit leading edge so it reads at a glance.
      if (gcd > 0 && !(definition?.offGcd)) {
        const sweep = -Math.PI / 2 + TAU * clamp(gcd / gcdDuration);
        c.save(); c.beginPath(); c.rect(x + 2, y + 2, w - 4, h - 4); c.clip();
        c.fillStyle = '#030a1090'; c.beginPath(); c.moveTo(x + w / 2, y + h / 2);
        c.arc(x + w / 2, y + h / 2, w * .72, -Math.PI / 2, sweep); c.closePath(); c.fill();
        c.strokeStyle = '#e8f0f4b8'; c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(x + w / 2, y + h / 2);
        c.lineTo(x + w / 2 + Math.cos(sweep) * w * .72, y + h / 2 + Math.sin(sweep) * w * .72); c.stroke();
        c.restore();
      }
    }
    if (sustain) {
      if (sustain.upkeep) text(c, `${sustain.upkeep}/s`, x + w - 4, y + 3, .65, '#91bddd', 'right');
      text(c, `${sustain.remaining.toFixed(1)}s`, x + w / 2, y + h / 2 - 3, .76, '#adead2', 'center');
    }
    // Small corner badges leave the square artwork intact; there is no separate label row.
    const binding = gamepad ? PAD_SKILL_LABELS[i] : controls.label(i === 0 ? 'attack' : SKILL_ACTIONS[i - 1]);
    const keyScale = Math.min(.82, 31 / Math.max(1, textWidth(binding)));
    const badgeWidth = textWidth(binding) * keyScale + 5;
    c.fillStyle = '#07111de8'; c.fillRect(x + w - badgeWidth - 1, y + h - 10, badgeWidth, 9);
    text(c, binding, x + w - 3, y + h - 9, keyScale,
      occupied && !p.dead ? UI.text : '#718490', 'right');
    if (weaveReady && usable) {
      c.strokeStyle = weaveKind === 'spell' ? '#d8b4ff' : '#f4d69a'; c.lineWidth = 1.5;
      c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      c.fillStyle = c.strokeStyle; c.beginPath(); c.arc(x + 5, y + 5, 2, 0, TAU); c.fill();
    }
    if (active) {
      c.fillStyle = '#c4ad7a'; c.fillRect(x + 8, y + h - 1, w - 16, .8);
    }
    c.restore();
  }
}

function medallion(c: CanvasRenderingContext2D, x: number, y: number, size: number, active = false) {
  c.beginPath(); c.arc(x + size / 2, y + size / 2, size / 2, 0, TAU);
  c.fillStyle = '#0a141cf5'; c.fill(); c.strokeStyle = active ? '#ceb986' : '#546873'; c.lineWidth = .85; c.stroke();
  c.beginPath(); c.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, TAU);
  c.strokeStyle = '#8f9b8155'; c.lineWidth = .45; c.stroke();
}
function utilities(c: CanvasRenderingContext2D, p: Player, gamepad = false) {
  const field = HUD_ART.utility, dodge = PLAYER_ABILITIES.dodge, potion = PLAYER_ABILITIES.potion;
  const slots = [
    { x: field.left, key: gamepad ? 'LB' : controls.label('heal'), icon: 'potion' as const, charges: p.flasks, capacity: potion.charges,
      cooldown: p.healCooldown, duration: potion.cooldown, active: p.healFlash > 0, color: '#d5a4bf' },

    { x: field.right, key: gamepad ? 'B' : controls.label('dodge'), icon: 'dodge' as const, charges: p.dodgeCharges, capacity: dodge.charges,
      cooldown: p.dodgeCharges > 0 ? 0 : Math.max(0, dodge.recharge - p.dodgeRecharge), duration: dodge.recharge,
      active: p.dodgeTime > 0, color: '#8ac9b4' },
  ];
  for (const slot of slots) {
    const { x } = slot, y = field.y, w = field.width, cx = x + w / 2, cy = y + w / 2;
    c.save(); medallion(c, x, y, w, slot.active);
    c.globalAlpha = slot.charges > 0 && !p.dead ? 1 : .45;
    drawHUDUtility(c, slot.icon, cx, cy, w - 3); c.globalAlpha = 1;
    if (slot.cooldown > 0) {
      c.strokeStyle = slot.color; c.lineWidth = 1.4; c.beginPath();
      c.arc(cx, cy, w / 2 - 1, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - clamp(slot.cooldown / slot.duration))); c.stroke();
      text(c, slot.cooldown.toFixed(1), cx, cy - 3, .9, UI.ivory, 'center');
    }
    const left = slot.icon === 'potion', bx = left ? x + w + 2 : x - 2;
    const keyScale = Math.min(.8, 23 / Math.max(1, textWidth(slot.key, 1, 'interface')));
    const keyWidth = Math.max(13, textWidth(slot.key, 1, 'interface') * keyScale + 4);
    c.fillStyle = '#b7b9a4'; c.fillRect(left ? bx : bx - keyWidth, y + 4, keyWidth, 12);
    text(c, slot.key, left ? bx + keyWidth / 2 : bx - keyWidth / 2, y + 6, keyScale, '#162129', 'center', 'interface');
    for (let charge = 0; charge < slot.capacity; charge++) {
      c.beginPath(); c.arc(cx - (slot.capacity - 1) * 2.5 + charge * 5, y + w + 3, 1.2, 0, TAU);
      c.fillStyle = charge < slot.charges ? slot.color : '#1a242c'; c.fill();
    }
    c.restore();
  }
  racial(c, p, gamepad);
}
/** The racial active sits in the right utility gap as a sixth, race-bound medallion. */
function racial(c: CanvasRenderingContext2D, p: Player, gamepad = false) {
  const skill = racialSkill(p);
  if (!skill) return;
  const field = HUD_ART.racial, x = field.x, y = field.y, w = field.width;
  const cx = x + w / 2, cy = y + w / 2;
  const definition = SKILL_DEFINITIONS[skill];
  const cooldown = p.skillCooldowns[skill] ?? 0;
  // Racial definitions land with the data pass; the medallion still previews before then.
  const resolved = definition ? resolveSkill(skill, p.derived, p.character) : null;
  const usable = !p.dead && cooldown <= 0 && p.mana >= (resolved?.mana ?? 0);
  c.save(); medallion(c, x, y, w, p.activeSkill === skill);
  c.globalAlpha = usable ? 1 : .45;
  c.save(); c.beginPath(); c.arc(cx, cy, w / 2 - 2, 0, TAU); c.clip();
  skillIconSafe(c, skill, cx, cy, w - 3); c.restore(); c.globalAlpha = 1;
  if (cooldown > 0) {
    c.strokeStyle = definition?.color ?? '#c9a86a'; c.lineWidth = 1.4; c.beginPath();
    c.arc(cx, cy, w / 2 - 1, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - clamp(cooldown / Math.max(.001, resolved?.cooldown ?? 1)))); c.stroke();
  }
  const binding = gamepad ? '—' : controls.label('skill5');
  const keyScale = Math.min(.8, 23 / Math.max(1, textWidth(binding, 1, 'interface')));
  const keyWidth = Math.max(13, textWidth(binding, 1, 'interface') * keyScale + 4);
  c.fillStyle = '#b7b9a4'; c.fillRect(x - 2 - keyWidth, y + 4, keyWidth, 12);
  text(c, binding, x - 2 - keyWidth / 2, y + 6, keyScale, '#162129', 'center', 'interface');
  c.restore();
}

function shortcuts(c: CanvasRenderingContext2D, p: Player) {
  const { x, y, width: w } = HUD_ART.menu;
  c.strokeStyle = '#596974'; c.lineWidth = .7;
  c.beginPath(); c.moveTo(x + w / 2, y + w); c.lineTo(x + w / 2, HUD_ART.skill.y - 3); c.stroke();
  medallion(c, x, y, w);
  drawHUDUtility(c, 'menu', x + w / 2, y + w / 2, w - 4);
  if (p.character.statPoints + p.character.skillPoints > 0) {
    c.beginPath(); c.arc(x + w - 2, y + 2, 3, 0, TAU); c.fillStyle = '#e1bd79'; c.fill();
    c.strokeStyle = '#101c24'; c.lineWidth = 1; c.stroke();
  }
}

function readout(c: CanvasRenderingContext2D, x: number, current: number, max: number, mana: boolean, label?: string, labelColor?: string) {
  const value = `${current} / ${max}`;
  // Reserve the same clear opening when future gear raises resource capacities.
  const size = Math.min(1.13, 58 / Math.max(1, textWidth(value)));
  text(c, value, x, HUD_ART.orb.readoutY - size * 3.85, size, mana ? '#b9cee0' : '#dfb9af', 'center');
  if (label) text(c, label, x, 143, .62, labelColor ?? '#8fa8b5', 'center');
}

/** Death knight runes and warlock shards share the shelf under the resource orb. */
function resourcePips(c: CanvasRenderingContext2D, p: Player, cls: WowClassDef | null, simTime?: number) {
  const cx = HUD_ART.orb.right;
  if (cls?.id === 'deathKnight' && p.runes) {
    const kinds: readonly RuneKind[] = ['blood', 'blood', 'frost', 'frost', 'unholy', 'unholy'];
    const colors: Record<RuneKind, string> = { blood: '#c0392b', frost: '#5aa7d6', unholy: '#6fae4e' };
    for (const [i, kind] of kinds.entries()) {
      const x = cx - 22.5 + i * 9, y = 133;
      const readyAt = p.runes[i] ?? 0;
      const remaining = simTime === undefined ? 0 : Math.max(0, readyAt - simTime);
      c.beginPath(); c.moveTo(x, y - 3.4); c.lineTo(x + 3.4, y); c.lineTo(x, y + 3.4); c.lineTo(x - 3.4, y); c.closePath();
      c.fillStyle = remaining > 0 ? '#101a22' : colors[kind]; c.fill();
      c.strokeStyle = shade(colors[kind], .3); c.lineWidth = .55; c.stroke();
      if (remaining > 0) {
        c.save(); c.beginPath(); c.moveTo(x, y - 3.4); c.lineTo(x + 3.4, y); c.lineTo(x, y + 3.4); c.lineTo(x - 3.4, y); c.closePath(); c.clip();
        c.fillStyle = colors[kind];
        const fill = 1 - clamp(remaining / WOW_COMBAT.runeRecharge);
        c.fillRect(x - 3.4, y + 3.4 - 6.8 * fill, 6.8, 6.8 * fill); c.restore();
      }
    }
  } else if (cls?.id === 'warlock' && p.soulShards !== undefined) {
    for (let i = 0; i < WOW_COMBAT.maxSoulShards; i++) {
      const x = cx - 13.5 + i * 9, y = 133, filled = i < p.soulShards;
      c.beginPath(); c.moveTo(x, y - 3.4); c.lineTo(x + 3.4, y); c.lineTo(x, y + 3.4); c.lineTo(x - 3.4, y); c.closePath();
      c.fillStyle = filled ? '#9482C9' : '#101a22'; c.fill();
      c.strokeStyle = filled ? '#c4b6e6' : '#4a5a64'; c.lineWidth = .55; c.stroke();
    }
  }
}

export function drawHUDContents(c: CanvasRenderingContext2D, p: Player, time: number, options: HUDOptions = {}) {
  const t = options.reducedMotion ? 0 : time;
  const orb = HUD_ART.orb, cls = wowClass(p);
  const resourceTint = cls ? RESOURCE_COLORS[cls.resource] : undefined;
  for (const mana of [false, true]) {
    c.save(); c.translate(mana ? orb.right : orb.left, orb.y); c.scale(orb.scale, orb.scale);
    drawHUDOrb(c, 0, 0, mana ? p.mana / Math.max(1, p.maxMana) : p.hp / Math.max(1, p.maxHp),
      t + (mana && !options.reducedMotion ? 7 : 0), mana, mana ? undefined : options.healthTrail,
      mana ? 0 : (options.hitPulse ?? 0) * (options.reducedMotion ? .4 : 1),mana?(p.auras?.reservation??0)/100:0,
      mana ? resourceTint : undefined);
    c.restore();
  }
  skills(c, p, t, options.gamepad, options.groundEffects, options.inventory, options.simTime);
  if (!options.inventory) { utilities(c, p, options.gamepad); shortcuts(c, p); resourcePips(c, p, cls, options.simTime); }
  readout(c, orb.left, Math.ceil(Math.max(0, p.hp)), p.maxHp, false);
  readout(c, orb.right, Math.floor(Math.max(0, p.mana)), manaCapacity(p), true,
    cls?.resourceLabel, resourceTint ? shade(resourceTint, .35) : undefined);
  drawHUDExperience(c, p, t, options.experience, options.inventory ? HUD_ART.inventory.experienceY : HUD_ART.experience.y);
}

/** Compact Astral instruments flank the unchanged XP rail and reward landing point. */
function drawTouchResources(c: CanvasRenderingContext2D, p: Player, time: number, options: HUDOptions) {
  const t = options.reducedMotion ? 0 : time;
  const cls = wowClass(p);
  for (const mana of [false, true]) {
    const x = mana ? 436 : 84;
    c.save(); c.translate(x, 96); c.scale(.72, .72);
    c.lineCap = 'round'; c.lineJoin = 'round';
    drawHUDOrbFrame(c, 0, 0, mana ? 1 : -1, t);
    c.scale(HUD_ART.orb.scale, HUD_ART.orb.scale);
    drawHUDOrb(c, 0, 0, mana ? p.mana / Math.max(1, p.maxMana) : p.hp / Math.max(1, p.maxHp),
      t + (mana && !options.reducedMotion ? 7 : 0), mana, mana ? undefined : options.healthTrail,
      mana ? 0 : (options.hitPulse ?? 0) * (options.reducedMotion ? .4 : 1),mana?(p.auras?.reservation??0)/100:0,
      mana && cls ? RESOURCE_COLORS[cls.resource] : undefined);
    c.restore();
    // Keep the numeric plate larger than the scaled instrument for phone readability.
    chamfer(c, x - 44, 129, 88, 18, 4);
    const metal = c.createLinearGradient(0, 129, 0, 147);
    metal.addColorStop(0, '#263943'); metal.addColorStop(1, '#0a141c');
    c.fillStyle = metal; c.fill(); c.strokeStyle = '#77929c'; c.lineWidth = .8; c.stroke();
    const current = mana ? Math.floor(Math.max(0, p.mana)) : Math.ceil(Math.max(0, p.hp));

    const value = `${current} / ${mana ? manaCapacity(p) : p.maxHp}`;
    const size = Math.min(1.6, 78 / Math.max(1, textWidth(value)));
    text(c, value, x, 138 - size * 3.85, size, mana ? '#b9cee0' : '#dfb9af', 'center');
  }
}

/** Drawn at native display density above the world shader. */
export function drawFloatingHUD(c: CanvasRenderingContext2D, p: Player, width: number, height: number, time: number, options: HUDOptions = {}) {
  const layout = options.layout ?? getHUDLayout(width, height);
  if (!layout.scale) return;
  c.save(); c.translate(layout.x, layout.y); c.scale(layout.scale, layout.scale);
  if(options.touch) {
    drawTouchResources(c, p, time, options);
    drawHUDExperience(c, p, options.reducedMotion ? 0 : time, options.experience);
  }
  else { drawHUDFrame(c, options.reducedMotion ? 0 : time, options.inventory); drawHUDContents(c, p, time, options); }
  c.restore();
  drawPlayerFrame(c, p, options.topInset ?? 0);
  const pet = drawPetFrame(c, p, options.topInset ?? 0);
  drawWowBuffs(c, p, (options.topInset ?? 0) + (pet ? PET_FRAME.height + 4 : 0));
  drawKillStreak(c, p, options.simTime ?? time, options.topInset ?? 0);
  drawCastBar(c, p, layout);
}
/** Compact WoW player frame anchored top-left; the buff strip hangs directly beneath it. */
const PLAYER_FRAME = Object.freeze({ x: 12, y: 8, height: 36, barX: 52, barWidth: 148 });

function frameBar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ratio: number, color: string) {
  c.fillStyle = '#060d13'; c.fillRect(x, y, w, h);
  const fill = c.createLinearGradient(x, y, x, y + h);
  fill.addColorStop(0, shade(color, .3)); fill.addColorStop(.45, color); fill.addColorStop(1, shade(color, -.45));
  c.fillStyle = fill; c.fillRect(x, y, w * clamp(ratio), h);
  c.fillStyle = '#ffffff22'; c.fillRect(x, y, w * clamp(ratio), .7);
  c.strokeStyle = '#5a707c'; c.lineWidth = .7; c.strokeRect(x - .5, y - .5, w + 1, h + 1);
}

/** WoW-style unit frame: class crest, class-colored name, health and resource bars, level badge. */
function drawPlayerFrame(c: CanvasRenderingContext2D, p: Player, topInset: number) {
  const cls = wowClass(p), classColor = cls?.color ?? UI.silver;
  const x = PLAYER_FRAME.x, y = PLAYER_FRAME.y + Math.max(0, topInset);
  const crest = 36, barX = PLAYER_FRAME.barX, barWidth = PLAYER_FRAME.barWidth;
  c.save();
  const shadow = c.createRadialGradient(x + 96, y + 18, 4, x + 96, y + 18, 112);
  shadow.addColorStop(0, '#02050a9c'); shadow.addColorStop(1, '#02050a00');
  c.fillStyle = shadow; c.fillRect(x - 16, y - 10, 224, 60);
  // Class crest: a small portrait mark carrying the class color and initial.
  chamfer(c, x, y, crest, crest, 4);
  const metal = c.createLinearGradient(x, y, x, y + crest);
  metal.addColorStop(0, '#2c3e49'); metal.addColorStop(1, '#0a141c');
  c.fillStyle = metal; c.fill();
  c.strokeStyle = p.stealthed ? '#e8c93a' : classColor; c.lineWidth = 1; c.stroke();
  const glow = c.createRadialGradient(x + crest / 2, y + crest / 2, 1, x + crest / 2, y + crest / 2, crest * .7);
  glow.addColorStop(0, `${classColor}30`); glow.addColorStop(1, `${classColor}00`);
  c.fillStyle = glow; c.fillRect(x, y, crest, crest);
  text(c, (cls?.name ?? 'Wayfarer')[0], x + crest / 2, y + 13.5, 1.15, shade(classColor, .35), 'center');
  // Level badge rides the crest's lower corner like WoW's portrait level.
  c.beginPath(); c.arc(x + crest - 1, y + crest - 1, 6, 0, TAU);
  c.fillStyle = '#0a141c'; c.fill(); c.strokeStyle = UI.brass; c.lineWidth = .8; c.stroke();
  text(c, String(p.level), x + crest - 1, y + crest - 3.9, .62, UI.ivory, 'center');
  // Name bar: dark steel with a class-colored leading edge and name.
  chamfer(c, barX, y, barWidth, 12, 3);
  const plate = c.createLinearGradient(barX, y, barX, y + 12);
  plate.addColorStop(0, '#1b2830'); plate.addColorStop(1, '#0a141c');
  c.fillStyle = plate; c.fill();
  c.strokeStyle = '#5a707c'; c.lineWidth = .7; c.stroke();
  c.fillStyle = classColor; c.fillRect(barX + 1, y + 1, 2, 10);
  c.fillStyle = `${classColor}55`; c.fillRect(barX + 1, y + 11, barWidth - 2, .8);
  const name = p.name ?? 'Wayfarer';
  text(c, name, barX + 6, y + 2.6, Math.min(.95, (barWidth - 12) / Math.max(1, textWidth(name, .95))),
    p.dead ? UI.faint : classColor);
  frameBar(c, barX, y + 14, barWidth, 9, p.hp / Math.max(1, p.maxHp), healthColor(p.hp / Math.max(1, p.maxHp)));
  frameBar(c, barX, y + 25, barWidth, 7, p.mana / Math.max(1, p.maxMana), cls ? RESOURCE_COLORS[cls.resource] : RESOURCE_COLORS.mana);
  c.restore();
}

/** Compact pet frame under the player frame: name, HP bar and command mode. */
const PET_FRAME = Object.freeze({ x: 12, height: 26, barX: 34, barWidth: 110 });
const PET_COMMANDS = { attack: 'ATK', follow: 'FLW', stay: 'STY', passive: 'PSV' } as const;

/** The live pet/minion ally worth a unit frame: the active PetRecord's ally, else a permanent demon. */
function petFrameAlly(p: Player): Ally | undefined {
  const pet = p.character.pets?.active;
  const allies = p.allies?.filter(a => a.hp > 0 && !a.stationary);
  return (pet ? allies?.find(a => a.petId === pet.id) : undefined)
    ?? allies?.find(a => a.remaining === undefined);
}

/** WoW-style pet unit frame; returns true when drawn so the buff strip shifts down. */
function drawPetFrame(c: CanvasRenderingContext2D, p: Player, topInset: number): boolean {
  const ally = petFrameAlly(p);
  if (!ally) return false;
  const template = ALLY_TEMPLATES[ally.kind];
  const pet = p.character.pets?.active;
  const name = pet && ally.petId === pet.id ? pet.name : template.name;
  const x = PET_FRAME.x, y = PLAYER_FRAME.y + PLAYER_FRAME.height + 6 + Math.max(0, topInset);
  const crest = 22, barX = x + PET_FRAME.barX - PET_FRAME.x, barWidth = PET_FRAME.barWidth;
  c.save();
  const shadow = c.createRadialGradient(x + 60, y + 13, 4, x + 60, y + 13, 80);
  shadow.addColorStop(0, '#02050a80'); shadow.addColorStop(1, '#02050a00');
  c.fillStyle = shadow; c.fillRect(x - 10, y - 6, 160, 40);
  chamfer(c, x, y, crest, crest, 3);
  const metal = c.createLinearGradient(x, y, x, y + crest);
  metal.addColorStop(0, '#2c3e49'); metal.addColorStop(1, '#0a141c');
  c.fillStyle = metal; c.fill();
  c.strokeStyle = template.color; c.lineWidth = .8; c.stroke();
  text(c, template.name[0] ?? '?', x + crest / 2, y + 8.5, .8, shade(template.color, .35), 'center');
  chamfer(c, barX, y, barWidth, 10, 3);
  const plate = c.createLinearGradient(barX, y, barX, y + 10);
  plate.addColorStop(0, '#1b2830'); plate.addColorStop(1, '#0a141c');
  c.fillStyle = plate; c.fill();
  c.strokeStyle = '#5a707c'; c.lineWidth = .7; c.stroke();
  c.fillStyle = template.color; c.fillRect(barX + 1, y + 1, 2, 8);
  text(c, name, barX + 5, y + 2.2, Math.min(.8, (barWidth - 34) / Math.max(1, textWidth(name, .8))), UI.ivory);
  const command = ally.petId !== undefined ? PET_COMMANDS[p.petCommand ?? 'attack'] : null;
  if (command) text(c, command, barX + barWidth - 3, y + 2.4, .6, shade(template.color, .4), 'right');
  frameBar(c, barX, y + 12, barWidth, 8, ally.hp / Math.max(1, ally.maxHp), healthColor(ally.hp / Math.max(1, ally.maxHp)));
  c.restore();
  return true;
}

/** WoW buff strip: player.buffs icons with drain sweeps, stealth/forms highlighted. */
function drawWowBuffs(c: CanvasRenderingContext2D, p: Player, topInset: number) {
  const buffs = p.buffs;
  if (!buffs?.length) return;
  const size = 18, gap = 3, x0 = PLAYER_FRAME.x, y0 = PLAYER_FRAME.y + PLAYER_FRAME.height + 6 + Math.max(0, topInset);
  for (const [i, buff] of buffs.entries()) {
    const x = x0 + i * (size + gap), y = y0;
    const highlight = !!(buff.stealth || buff.form);
    c.save();
    c.fillStyle = '#0a141cf0'; c.fillRect(x, y, size, size);
    c.strokeStyle = highlight ? '#e8c93a' : buff.color; c.lineWidth = highlight ? 1.2 : .8;
    c.strokeRect(x + .5, y + .5, size - 1, size - 1);
    if (highlight) {
      const glow = c.createRadialGradient(x + size / 2, y + size / 2, 1, x + size / 2, y + size / 2, size);
      glow.addColorStop(0, '#e8c93a22'); glow.addColorStop(1, '#e8c93a00');
      c.fillStyle = glow; c.fillRect(x - 3, y - 3, size + 6, size + 6);
    }
    const icon = buff.id as SkillId;
    if (SKILL_ICON_RECIPES[icon]) skillIconSafe(c, icon, x + size / 2, y + size / 2, size - 3);
    else {
      c.fillStyle = shade(buff.color, -.5); c.fillRect(x + 2, y + 2, size - 4, size - 4);
      text(c, buff.name[0] ?? '?', x + size / 2, y + 4, .8, shade(buff.color, .5), 'center');
    }
    if (buff.duration > 0) {
      const spent = 1 - clamp(buff.remaining / Math.max(.001, buff.duration));
      c.fillStyle = '#030a10a0'; c.fillRect(x + 1, y + 1, size - 2, (size - 2) * spent);
      const label = buff.remaining >= 60 ? `${Math.floor(buff.remaining / 60)}m` : `${Math.ceil(buff.remaining)}`;
      text(c, label, x + size / 2, y + size - 7, .62, UI.ivory, 'center');
    }
    c.restore();
  }
}

/** Diablo-style kill-streak counter under the buff strip: count plus a draining
 * window bar so the player sees the chain about to expire. */
function drawKillStreak(c: CanvasRenderingContext2D, p: Player, simTime: number, topInset: number) {
  const streak = p.killStreak;
  if (!GAME_FEATURES.killStreaks || !streak || streak.count < 2) return;
  const remaining = KILL_STREAK.window - (simTime - streak.lastKillAt);
  if (remaining <= 0) return;
  const x = PLAYER_FRAME.x, y = PLAYER_FRAME.y + PLAYER_FRAME.height + 30 + Math.max(0, topInset);
  c.save();
  c.globalAlpha = Math.min(1, remaining / .6);
  text(c, `x${streak.count}`, x + 2, y, .9, '#f2b8a8', 'left');
  const w = 46, h = 3;
  c.fillStyle = '#060d13'; c.fillRect(x + 2, y + 5, w, h);
  c.fillStyle = '#e83d59'; c.fillRect(x + 2, y + 5, w * clamp(remaining / KILL_STREAK.window), h);
  c.restore();
}

/** WoW cast/channel bar floating just above the Astral instrument. */
function drawCastBar(c: CanvasRenderingContext2D, p: Player, layout: { x: number; y: number; scale: number }) {
  const cast = p.cast;
  if (!cast || cast.duration <= 0) return;
  const w = 180, h = 12, x = layout.x + layout.scale * (HUD_ART.width - w) / 2, y = layout.y - 20;
  const progress = clamp(1 - cast.remaining / cast.duration);
  const channel = !!cast.channel;
  c.save();
  c.fillStyle = '#050a10e0'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
  c.strokeStyle = '#4a6573'; c.lineWidth = .8; c.strokeRect(x - .5, y - .5, w + 1, h + 1);
  const fill = c.createLinearGradient(x, y, x, y + h);
  if (channel) { fill.addColorStop(0, '#7fb8e8'); fill.addColorStop(1, '#2b5f9e'); }
  else { fill.addColorStop(0, '#f2d68a'); fill.addColorStop(1, '#b07f3c'); }
  c.fillStyle = fill;
  if (channel) c.fillRect(x + w * (1 - progress), y, w * progress, h);
  else c.fillRect(x, y, w * progress, h);
  const definition = SKILL_DEFINITIONS[cast.skill];
  const ticks = definition?.channel?.ticks ?? 0;
  if (channel && ticks > 1) {
    c.strokeStyle = '#dcebf5aa'; c.lineWidth = .7;
    for (let i = 1; i < ticks; i++) {
      const tx = x + w * (1 - i / ticks);
      c.beginPath(); c.moveTo(tx, y + 1); c.lineTo(tx, y + h - 1); c.stroke();
    }
  }
  const name = definition?.name ?? String(cast.skill);
  text(c, name, x + w / 2, y + 2, .72, '#f4f0e2', 'center');
  text(c, cast.remaining.toFixed(1), x + w - 4, y + 2, .62, '#d8e4ea', 'right');
  c.restore();
}
