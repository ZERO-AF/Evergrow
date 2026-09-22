import { drawRadiantSeal } from './radiant-art.ts';
import { drawSchoolImpact, classStyle, type ClassStyle } from './spell-school-art.ts';
import { weaponGlowColor } from './radiant-content.ts';
import { SkillMeleeArt } from './skill-melee-art.ts';
import { weaponReleasePoint } from './projectile-launch.ts';
import { PROJECTILE_HEIGHT } from './ranged-aim.ts';
import { SKILL_CAST_MOTION } from './combat-content.ts';
import { SKILL_DEFINITIONS, skillWeapon } from './skill-content.ts';
import { playerMotion } from './character-motion.ts';
import { getPlayerSwordTip } from './art.ts';
import { playerPose } from './character-pose.ts';
import { drawGlow } from './lighting.ts';
import type { PointLight } from './lighting.ts';
import type { CombatEvent, ProjectileStyle } from './model.ts';
import type { ItemTier } from './character-types.ts';
import { ALLY_TEMPLATES } from './wow-allies.ts';
import { demonFamilyForAlly } from './pet-content.ts';
import type { Simulation } from './simulation.ts';
import { GAME_FONT_STACK, text } from './font.ts';
import { GAME_FEATURES } from './game-features.ts';
import { SwordTrail } from './sword-trail.ts';
import { projectileStyle, PROJECTILE_COLORS } from './projectile-art.ts';
import { SkillEffects } from './skill-effects.ts';
import { LOOT_BEAMS } from './loot-beam.ts';
import { LOOT_RULES } from './combat-content.ts';
import { TREASURE_FLIGHT_DURATION } from './treasure-flight.ts';
import { combatTextForEvent, type CombatPopup } from './combat-text.ts';

interface Spark {
  x: number; y: number; vx: number; vy: number;
  z: number; vz: number; curl: number;
  life: number; max: number; size: number; color: string; luminous: boolean;
}
interface Flash { x: number; y: number; life: number; max: number; radius: number; color: string; ring: boolean; radiant?: boolean; }
interface Impact { x: number; y: number; angle: number; life: number; max: number; color: string; hurt: boolean; lethal: boolean; radiant?: boolean; style?: ProjectileStyle; cls?: ClassStyle | null; }
const GOLD = '#ffbd63', FIRE = '#ff643b', MINT = '#54e8b8', BLUE = '#64baff';
const MANA_WARNING_DURATION = 1.15;
/** Short floating cue per rejected-skill reason (skill-failed events). */
const SKILL_FAIL_FLOAT: Record<string, string> = {
  cooldown: 'Not Ready Yet', gcd: 'Not Ready Yet', 'no-target': 'No Target', 'out-of-range': 'Out of Range',
  'requires-stealth': 'Requires Stealth', 'requires-form': 'Wrong Form', 'requires-ally': 'Needs an Ally',
  'requires-buff': 'Missing Aura', 'requires-behind': 'Must Be Behind', 'execute-threshold': 'Not Wounded Enough',
  'no-combo': 'No Combo Points', 'no-shards': 'No Soul Shards', 'no-runes': 'Runes Not Ready',
  frozen: 'Cannot While Frozen', unusable: 'Cannot Use That', tame: 'Cannot Tame That',
};
const LOOT_MOMENT_TIERS: Partial<Record<ItemTier, true>> = { epic: true, legendary: true, unique: true };
const LOOT_PULSE_TIERS: Partial<Record<ItemTier, true>> = { legendary: true, unique: true };
const LOOT_PULSE_DURATION = .9;

/** A fresh epic-or-better ground drop, surfaced once for stinger/toast/marker wiring. */
export interface LootMoment { id: number; x: number; y: number; tier: ItemTier; name: string; }

/** Effects never drive gameplay. All collections and continuous emitters are bounded. */
export class CombatEffects {
  private sparks: Spark[] = [];
  private flashes: Flash[] = [];
  private impacts: Impact[] = [];
  private popups: CombatPopup[] = [];
  private manaWarningLife = 0;
  private skillFailText = 'Not Enough Mana';
  private emitterTime = 0;
  private sword = new SwordTrail();
  private skillEffects = new SkillEffects();
  private meleeSkills = new SkillMeleeArt();
  /** Ground-drop ids already seen, so a landing item bursts exactly once. */
  private seenGroundItems = new Set<number>();
  private groundItemsPrimed = false;
  /** Ally ids already primed; a new ally fires one themed arrival burst. */
  private seenAllies = new Set<number>();
  private alliesPrimed = false;
  /** Screen-edge glow on legendary/unique drops; read by the renderer, decays in update. */
  lootPulse = 0;
  private pendingLootMoments: LootMoment[] = [];
  lootPulseColor = LOOT_BEAMS.legendary.color;

  reset() {
    this.sparks = []; this.flashes = []; this.impacts = []; this.popups = [];
    this.manaWarningLife = 0;
    this.emitterTime = 0; this.sword.reset(); this.skillEffects.reset(); this.meleeSkills.reset();
    this.seenGroundItems.clear(); this.groundItemsPrimed = false;
    this.seenAllies.clear(); this.alliesPrimed = false;
    this.pendingLootMoments = []; this.lootPulse = 0;
  }

  /**
   * Rarity-scaled sparkle burst when a ground drop appears or its treasure
   * flight lands. Presentation only; bounded per tick and by the drop cap.
   */
  private updateDropBursts(sim: Simulation) {
    const drops = sim.groundItems;
    if (!this.groundItemsPrimed) {
      // Restored or travelled-to loot is scenery, not a fresh drop.
      this.groundItemsPrimed = true;
      for (const drop of drops) this.seenGroundItems.add(drop.id);
      return;
    }
    let bursts = 0;
    for (const drop of drops) {
      if (this.seenGroundItems.has(drop.id)) continue;
      if (drop.flight && sim.time < drop.flight.at + drop.flight.delay + TREASURE_FLIGHT_DURATION) continue;
      this.seenGroundItems.add(drop.id);
      // The drop moment: epic+ landings surface once for the shell (stinger,
      // toast, map star); legendary+ also kick the screen-edge pulse.
      if (GAME_FEATURES.legendaryMoment && LOOT_MOMENT_TIERS[drop.item.tier]) {
        if (this.pendingLootMoments.length < 16)
          this.pendingLootMoments.push({ id: drop.id, x: drop.x, y: drop.y, tier: drop.item.tier, name: drop.item.name });
        if (LOOT_PULSE_TIERS[drop.item.tier]) {
          this.lootPulse = 1;
          this.lootPulseColor = LOOT_BEAMS[drop.item.tier].color;
        }
      }
      if (bursts >= 8) continue;
      bursts++;
      const spec = LOOT_BEAMS[drop.item.tier];
      for (let i = 0; i < 4 + spec.motes * 2; i++)
        this.spark(drop.x, drop.y, Math.random() * Math.PI * 2, i % 3 === 0 ? spec.core : spec.color, .5 + spec.motes * .12);
      if (spec.motes >= 4) this.flashes.push({ x: drop.x, y: drop.y, life: .3, max: .3,
        radius: spec.glow * .9, color: spec.color, ring: spec.motes >= 5 });
    }
    // Collected drops leak ids; rebuild from live drops before the set can grow past the cap.
    if (this.seenGroundItems.size > LOOT_RULES.maxGroundItems * 2) {
      this.seenGroundItems.clear();
      for (const drop of drops) this.seenGroundItems.add(drop.id);
    }
  }

  /**
   * A freshly summoned ally fires one themed arrival burst: infernal meteor,
   * totem earth-thump, demon fel portal, or a generic school ring for pets.
   * The first update primes the set so restored allies don't burst.
   */
  private updateAllyArrivals(sim: Simulation) {
    const allies = sim.player.allies ?? [];
    if (!this.alliesPrimed) {
      this.alliesPrimed = true;
      for (const ally of allies) this.seenAllies.add(ally.id);
      return;
    }
    for (const ally of allies) {
      if (this.seenAllies.has(ally.id)) continue;
      this.seenAllies.add(ally.id);
      const template = ALLY_TEMPLATES[ally.kind];
      const demon = demonFamilyForAlly(ally.kind);
      const kind = ally.kind === 'infernal' ? 'meteor' : template?.stationary ? 'earth' : demon ? 'portal' : 'ring';
      const color = kind === 'meteor' ? '#ff8a3c' : kind === 'earth' ? '#a08a4a' : kind === 'portal' ? '#8a5adf' : (template?.color ?? '#c0acf0');
      this.skillEffects.summonArrival(ally.x, ally.y, kind, color, (template?.radius ?? 10) + 26);
    }
    if (this.seenAllies.size > 64) {
      this.seenAllies.clear();
      for (const ally of allies) this.seenAllies.add(ally.id);
    }
  }

  /** Fresh epic+ drops since the last call; the shell turns them into stingers and toasts. */
  drainLootMoments(): LootMoment[] {
    const moments = this.pendingLootMoments;
    this.pendingLootMoments = [];
    return moments;
  }

  private spark(x: number, y: number, angle: number, color: string, strength = 1, airborne = true, luminous = true) {
    const speed = (40 + Math.random() * 170) * strength;
    const life = .2 + Math.random() * .48;
    this.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      z: airborne ? 15 : 0, vz: airborne ? 25 + Math.random() * 95 : 0,
      curl: (Math.random() - .5) * (luminous ? 5 : 1.2), life, max: life,
      size: luminous ? .8 + Math.random() * 1.7 : 1.6 + Math.random() * 2, color, luminous });
  }

  handleEvents(events: CombatEvent[]) {
    for (const event of events) {
      if (event.type === 'insufficient-mana') {
        // Buffered/held attempts share one cue; never stack or restart its fade.
        if (this.manaWarningLife <= 0) { this.manaWarningLife = MANA_WARNING_DURATION; this.skillFailText = 'Not Enough Mana'; }
        continue;
      }
      if (event.type === 'skill-failed') {
        if (this.manaWarningLife <= 0) { this.manaWarningLife = MANA_WARNING_DURATION; this.skillFailText = SKILL_FAIL_FLOAT[event.reason] ?? 'Cannot use that yet.'; }
        continue;
      }
      this.skillEffects.handle(event);
      const enemyKind = 'enemyKind' in event ? event.enemyKind : undefined;
      const heavy = 'heavy' in event && event.heavy;
      const eventAngle = 'angle' in event ? event.angle : 0;
      const restoring = event.type === 'heal' || event.type === 'potion';
      const tip = event.type === 'cast' && event.launch ? weaponReleasePoint(event.launch) : null;
      const enemyCast = event.type === 'cast' && event.enemyKind;
      const contact = event.type === 'hit' || event.type === 'hurt' || event.type === 'kill';
      const seal = event.style === 'radiant' || event.style === 'holy';
      const color = event.color ?? (event.style ? PROJECTILE_COLORS[event.style] : undefined) ?? (event.type === 'hurt' ? '#ff5e4e' : restoring || enemyCast ? MINT
        : event.type === 'dodge' ? BLUE : event.type === 'cast' ? FIRE : GOLD);
      const blastRadius = event.type === 'blast' && Number.isFinite(event.radius) ? event.radius! : 0;
      const count = event.type === 'blast' ? Math.min(96, 46 + Math.round(blastRadius * .28)) : event.type === 'block' ? 22 : event.type === 'hit' ? 30 : event.type === 'kill' ? 16
        : event.type === 'hurt' ? 32 : event.type === 'cast' ? seal ? 10 : 26 : restoring ? 30
        : event.type === 'loot' ? 8 : event.type === 'pickup' ? 10 : event.type === 'dodge' ? 14 : 0;
      // MaterialResponses owns solid debris. Retain the short luminous contact accents here.
      for (let i = 0; i < (contact ? event.type === 'kill' ? 0 : 8 : count); i++) {
        const radial = ['heal', 'potion', 'pickup', 'level', 'blast'].includes(event.type) || event.skill === 'iceNova';
        const angle = radial ? Math.random() * Math.PI * 2 : eventAngle + (Math.random() - .5) * 2.8;
        this.spark(event.x + (tip?.x ?? 0), event.y + (tip ? tip.y + 15 : 0), angle, i % 4 === 0 ? '#fff7db' : color,
          contact ? 1.2 : event.type === 'blast' ? 1 + Math.min(1.4, blastRadius / 130) : 1);
      }
      const contactY = event.y - (event.type === 'hurt' ? 24 : enemyKind === 'brute' ? 25 : 18);
      if (contact) this.impacts.push({ x: event.x, y: contactY, angle: eventAngle,
        life: event.type === 'kill' ? (GAME_FEATURES.combatJuice ? .38 : .3) : .22,
        max: event.type === 'kill' ? (GAME_FEATURES.combatJuice ? .38 : .3) : .22,
        color, hurt: event.type === 'hurt', lethal: event.type === 'kill', radiant: seal, style: event.style, cls: classStyle(event.classId) });
      if (count > 5) {
        const max = restoring ? .55 : event.type === 'kill' && GAME_FEATURES.combatJuice ? .24 : event.type === 'kill' ? .16 : event.type === 'blast' ? .34 : .22;
        // Blasts scale with their real gameplay radius; WoW bursts dominate the
        // frame instead of reading as a small contact glow.
        const radius = seal ? 58 : event.type === 'kill' ? (GAME_FEATURES.combatJuice ? 96 : 62)
          : event.type === 'blast' ? Math.max(120, blastRadius * 1.15)
          : heavy ? 145 : contact ? 118 : event.type === 'loot' || event.type === 'pickup' ? 35 : event.type === 'cast' ? 110 : 90;
        this.flashes.push({ x: event.x + (tip?.x ?? 0), y: tip ? event.y + tip.y : contact ? contactY : event.y - 10, life: max, max,
          radius, color,
          radiant: event.type === 'cast' && seal, ring: restoring || event.type === 'level' || event.skill === 'iceNova' || event.type === 'blast' || (event.type === 'kill' && GAME_FEATURES.combatJuice) });
      }
      // WoW floating combat text: labels/colors/sizes live in combat-text.ts.
      this.popups.push(...combatTextForEvent(event));
      // Large event batches must not allocate their entire particle history
      // before enforcing the cap. Keep the same newest effects after each event.
      this.trim();
    }
  }

  private trim() {
    if (this.sparks.length > 650) this.sparks.splice(0, this.sparks.length - 650);
    if (this.flashes.length > 22) this.flashes.splice(0, this.flashes.length - 22);
    if (this.impacts.length > 24) this.impacts.splice(0, this.impacts.length - 24);
    if (this.popups.length > 35) this.popups.splice(0, this.popups.length - 35);
  }

  update(sim: Simulation, dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.manaWarningLife = sim.player.dead ? 0 : Math.max(0, this.manaWarningLife - dt);
    this.sword.update(sim.player, dt, sim.time, sim.interpolationAlpha);
    this.skillEffects.update(dt, sim.enemies);
    this.updateAllyArrivals(sim);
    this.meleeSkills.update(sim.player, dt, sim.interpolationAlpha);
    this.updateDropBursts(sim);
    this.lootPulse = Math.max(0, this.lootPulse - dt / LOOT_PULSE_DURATION);
    for (const spark of this.sparks) {
      spark.life -= dt;
      const angle = spark.curl * dt, cos = Math.cos(angle), sin = Math.sin(angle);
      const vx = spark.vx * cos - spark.vy * sin;
      spark.vy = (spark.vx * sin + spark.vy * cos) * Math.exp(-dt * 1.7);
      spark.vx = vx * Math.exp(-dt * 1.7);
      spark.x += spark.vx * dt; spark.y += spark.vy * dt;
      spark.z = Math.max(0, spark.z + spark.vz * dt); spark.vz -= dt * 190;
    }
    for (const flash of this.flashes) flash.life -= dt;
    for (const impact of this.impacts) impact.life -= dt;
    for (const popup of this.popups) {
      popup.life -= dt; popup.x += popup.vx * dt; popup.y += popup.vy * dt;
      popup.vx *= Math.exp(-dt * 2.5); popup.vy = Math.min(-17, popup.vy + dt * 60);
    }
    this.sparks = this.sparks.filter(s => s.life > 0);
    this.flashes = this.flashes.filter(f => f.life > 0);
    this.impacts = this.impacts.filter(i => i.life > 0);
    this.popups = this.popups.filter(p => p.life > 0);
    // Let the final impact disperse behind the death menu without emitting forever
    // from projectiles whose gameplay state has already stopped.
    if (sim.player.dead) return;
    // Expire existing visuals using real elapsed time, but do not replay a long
    // backlog of continuous emission after a stalled or suspended frame.
    this.emitterTime += Math.min(dt, .05);
    while (this.emitterTime >= .016) {
      this.emitterTime -= .016;
      const p = sim.player, attack = p.attack;
      if (attack?.kind === 'melee' && attack.weapon.visual.kind !== 'unarmed' && attack.elapsed >= attack.activeStart && attack.elapsed <= attack.activeEnd) {
        const angle = playerMotion(playerPose(p, sim.time)).activeWeaponAngle;
        const tip = getPlayerSwordTip(playerPose(p, sim.time));
        const x = p.prevX + (p.x - p.prevX) * sim.interpolationAlpha + tip.x;
        const y = p.prevY + (p.y - p.prevY) * sim.interpolationAlpha + tip.y;
        for (let i = 0; i < 2; i++) this.spark(x, y, angle + 1.3,
          i === 0 ? '#fff0d4' : (attack.weapon.visual.glow ?? GOLD), .5, false);
      }
      for (const shot of sim.projectiles.slice(0, 32)) {
        const style = projectileStyle(shot);
        if (style === 'arrow' || style === 'radiant') continue;
        const color = PROJECTILE_COLORS[style];
        for (let i = 0; i < (style === 'fire' ? 2 : 1); i++) {
          this.spark(shot.x, shot.y - PROJECTILE_HEIGHT, shot.angle + Math.PI + (Math.random() - .5) * .7,
            i ? '#ffd674' : color, style === 'fire' ? .45 : .22, false);
        }
      }
      const castingWeapon = p.activeSkill ? skillWeapon(p.activeSkill, p.equipment) : p.equipment.mainHand;
      if (castingWeapon?.attackKind === 'bolt' && p.castTime > (p.castDuration * SKILL_CAST_MOTION.releaseRemainingFraction)) {
        const angle = sim.time * 22, tip = getPlayerSwordTip(playerPose(p, sim.time));
        this.spark(p.x + tip.x + Math.cos(angle) * 8,
          p.y + tip.y + Math.sin(angle) * 8, angle + Math.PI / 2, p.activeSkill ? SKILL_DEFINITIONS[p.activeSkill].color : weaponGlowColor(castingWeapon.visual) ?? GOLD, .25, false);
      }
    }
    this.trim();
  }

  getLights(): PointLight[] {
    return [...this.flashes.slice(-7).map(f => ({ x: f.x, y: f.y, radius: f.radius,
      power: Math.pow(f.life / f.max, .75), color: f.color })), ...this.skillEffects.getLights()].slice(-7);
  }

  drawSword(c: CanvasRenderingContext2D) { this.sword.draw(c); }

  draw(c: CanvasRenderingContext2D, reducedMotion = false) {
    c.save();
    for (const flash of this.flashes) {
      c.globalAlpha = 1;
      const t = flash.life / flash.max;
      drawGlow(c, flash.x, flash.y, flash.radius * .5, flash.color, t * .52);
      if (flash.radiant) {
        c.save(); c.translate(flash.x, flash.y); c.globalAlpha = t * .6;
        drawRadiantSeal(c, reducedMotion ? 7 : 5 + (1 - t) * 5, .8); c.restore();
      }
      if (flash.ring) {
        // Ground decal: the shockwave ring tracks the flash's real radius so
        // large blasts scorch the terrain they actually cover.
        const spread = Math.min(4, Math.max(1, flash.radius / 55));
        c.globalAlpha = t * .65;
        c.strokeStyle = flash.color; c.lineWidth = 1 + t * 2;
        c.beginPath(); c.ellipse(flash.x, flash.y + 14, (8 + (1 - t) * 47) * spread, (4 + (1 - t) * 24) * spread, 0, 0, Math.PI * 2); c.stroke();
        if (spread > 1.4) {
          c.globalAlpha = t * .3;
          c.beginPath(); c.ellipse(flash.x, flash.y + 14, (8 + (1 - t) * 47) * spread * .62, (4 + (1 - t) * 24) * spread * .62, 0, 0, Math.PI * 2); c.stroke();
        }
      }
    }
    this.skillEffects.draw(c, reducedMotion);
    this.meleeSkills.draw(c, reducedMotion);
    for (const impact of this.impacts) this.drawImpact(c, impact, reducedMotion);
    for (const spark of this.sparks) {
      const t = Math.min(1, spark.life / spark.max * 1.8), y = spark.y - spark.z;
      c.globalCompositeOperation = spark.luminous ? 'lighter' : 'source-over';
      c.globalAlpha = t;
      c.strokeStyle = spark.color; c.lineWidth = spark.size * .75;
      c.beginPath(); c.moveTo(spark.x - spark.vx * .038, y - (spark.vy - spark.vz) * .026);
      c.lineTo(spark.x, y); c.stroke();
      c.fillStyle = spark.luminous && spark.life > spark.max * .65 ? '#fff0c9' : spark.color;
      if (spark.luminous) c.fillRect(spark.x - spark.size / 2, y - spark.size / 2, spark.size, spark.size);
      else {
        const size = spark.size, turn = Math.sin((spark.max - spark.life) * 15 + spark.curl);
        c.beginPath(); c.moveTo(spark.x - size, y); c.lineTo(spark.x + turn * size, y - size * .6);
        c.lineTo(spark.x + size * .7, y + size * .2); c.lineTo(spark.x - size * .3, y + size * .5); c.closePath(); c.fill();
      }
      if (spark.luminous && spark.size > 1.7) drawGlow(c, spark.x, y, 8, spark.color, t * .4);
    }
    c.restore();
  }

  private drawImpact(c: CanvasRenderingContext2D, impact: Impact, reducedMotion: boolean) {
    if (GAME_FEATURES.spellVfx && impact.style && drawSchoolImpact(c, impact.x, impact.y, impact.style, impact.max - impact.life, impact.lethal ? 2 : impact.hurt ? 1.2 : 1.5, reducedMotion, impact.cls)) return;
    const t = Math.max(0, impact.life / impact.max), elapsed = impact.radiant && reducedMotion ? .4 : 1 - t;
    c.save(); c.translate(impact.x, impact.y); c.rotate(impact.angle);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = Math.pow(t, 1.5);
    const length = (impact.lethal ? (GAME_FEATURES.combatJuice ? 38 : 30) : 23) * Math.sin(Math.min(1, elapsed * 2 + .25) * Math.PI / 2);
    const waist = 3.7 * t;
    c.fillStyle = elapsed < .3 ? '#fff8da' : impact.color;
    // The contact has a hard, brief center, followed by an expanding broken star.
    c.beginPath(); c.moveTo(-length * .7, 0); c.lineTo(-waist, -waist);
    c.lineTo(0, -length * .65); c.lineTo(waist, -waist);
    c.lineTo(length, 0); c.lineTo(waist, waist);
    c.lineTo(0, length * .65); c.lineTo(-waist, waist); c.closePath(); c.fill();
    if (impact.radiant) {
      drawRadiantSeal(c, reducedMotion ? 16 : 11 + elapsed * 9, 1);
      c.restore(); return;
    }
    c.rotate(impact.hurt ? -.6 : .65);
    c.strokeStyle = impact.color; c.lineWidth = 1.3 * t;
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + elapsed * .35, r = 11 + elapsed * (impact.hurt ? 29 : 20);
      c.beginPath(); c.ellipse(0, 0, r, r * .7, 0, a, a + .6); c.stroke();
    }
    c.restore();
  }

  /** One player-attached cue, drawn above CRT at native text size at every zoom. */
  drawManaWarning(c: CanvasRenderingContext2D, head: { x: number; y: number }, reducedMotion: boolean) {
    if (this.manaWarningLife <= 0) return;
    const elapsed = MANA_WARNING_DURATION - this.manaWarningLife;
    const progress = Math.min(1, elapsed / MANA_WARNING_DURATION);
    const rise = 1 - (1 - progress) ** 2;
    const fadeIn = Math.min(1, elapsed / .08);
    const fadeOut = Math.max(0, Math.min(1, (elapsed - .15) / (MANA_WARNING_DURATION - .15)));
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const y = head.y - 8 - (reducedMotion ? 0 : rise * 18);
    c.save();
    c.globalAlpha = .85 * smooth(fadeIn) * (1 - smooth(fadeOut));
    c.font = `400 11px ${GAME_FONT_STACK}`;
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.strokeText(this.skillFailText, head.x, y);
    c.shadowColor = '#3289ff'; c.shadowBlur = 6;
    c.fillStyle = '#94d0ff';
    c.fillText(this.skillFailText, head.x, y);
    c.restore();
  }

  drawNumbers(c: CanvasRenderingContext2D, project: (x: number, y: number) => { x: number; y: number } = (x, y) => ({ x, y })) {
    c.save();
    for (const popup of this.popups) {
      const elapsed = popup.max - popup.life;
      const pop = 1 + .35 * Math.exp(-elapsed * 22);
      const size = popup.size * pop;
      const { x, y } = project(popup.x, popup.y);
      c.globalAlpha = Math.min(1, popup.life / .2);
      // WoW crit flourish: the number pops with a trailing '!'.
      const value = popup.crit ? `${popup.value}!` : popup.value;
      text(c, value, x - 1, y, size, '#04070b', 'center');
      text(c, value, x + 1, y + 1, size, '#04070b', 'center');
      text(c, value, x, y, size, popup.color, 'center');
    }
    c.restore();
  }
}
