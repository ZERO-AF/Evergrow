import './skill-studio.css';
import { BuffBar } from '../buff-bar.ts';
import { activeBuffs } from '../active-buffs.ts';
import { isAura } from '../aura-content.ts';
import { manaCapacity } from '../auras.ts';
import { toolPage, boundedNumber, downloadJSON, reportRoute } from './common.ts';
import { SkillStudy, studyWeapons, type SkillStudyOptions } from './skill-scene.ts';
import { SKILL_DEFINITIONS, skillRequirementLabel } from '../skill-content.ts';
import { skillUtilityLabel, GROUND_EFFECT_RULES, groundEffectPulseCount, type SkillExecution } from '../skill-execution-content.ts';
import { skillIconSVG, skillIconDrawing, glassIconDrawing, skillIconLight, skillIconSurface, skillIconHalo, SKILL_ICON_STOPS, SKILL_ICON_HALO_STOPS, type SkillIconDraw } from '../skill-icon.ts';
import { ICON_MATERIALS, SKILL_ICON_RECIPES, type SkillIconMaterial, type IconPart } from '../skill-icon-content.ts';
import { paintGlassIcon } from '../skill-icon-canvas.ts';
import { skillNodeIconSVG, drawSkillGlyph } from '../skill-tree-glyphs.ts';
import { SKILL_NODES } from '../skill-tree.ts';
import { SKILL_SPECIALIZATIONS, SKILL_RANK_RULES } from '../skill-progression.ts';
import { ENEMY_DEFINITIONS } from '../combat-content.ts';
import { World } from '../world.ts';
import { Renderer } from '../renderer.ts';
import { PostFX } from '../postfx.ts';
import { escapeUI as e } from '../ui-components.ts';
import type { SkillId } from '../character-types.ts';
import type { Ally, CombatEvent, EnemyKind, Projectile, WowBuff } from '../model.ts';
import type { ActiveGroundEffect } from '../ground-effects.ts';
import type { ChainFlight } from '../chain-lightning.ts';
import type { PlayerSkillEffects } from '../player-skill-effects.ts';

// ── Tuning model ─────────────────────────────────────────────────────────────
// Every slider is a multiplier on the resolved cast configuration. The preview
// applies them through the same seams combat uses (derived stats, live cast
// artifacts and applied statuses); the export reports the tuned profile.
interface Tuning { damage: number; mana: number; cooldown: number; range: number; duration: number; status: number; pulses: number }
const TUNING_DEFAULT: Tuning = { damage: 1, mana: 1, cooldown: 1, range: 1, duration: 1, status: 1, pulses: 1 };
const SLIDERS: ReadonlyArray<{ key: keyof Tuning; label: string; min: number; max: number; step: number; hint: string }> = [
  { key: 'damage', label: 'Damage multiplier', min: .1, max: 4, step: .05, hint: 'Scales the resolved damage multiplier; direct heals ride the same weapon base.' },
  { key: 'mana', label: 'Mana cost', min: 0, max: 3, step: .05, hint: 'Scales the resolved mana cost. Zero-cost skills and the 1-mana floor stay.' },
  { key: 'cooldown', label: 'Cooldown', min: 0, max: 3, step: .05, hint: 'Scales the resolved cooldown; tier floors still apply.' },
  { key: 'range', label: 'Range & radius', min: .25, max: 3, step: .05, hint: 'Area radius, reach, projectile flight, dash distance and enemy-target range.' },
  { key: 'duration', label: 'Duration', min: .1, max: 4, step: .05, hint: 'Self effects, ground fields, channels, summons and cast times.' },
  { key: 'status', label: 'Status potency', min: 0, max: 3, step: .05, hint: 'Stuns, slows, DoT/CC durations, sunder, taunt and absorb strength.' },
  { key: 'pulses', label: 'Pulse count', min: .25, max: 4, step: .05, hint: 'Ground ticks, chain jumps, pierce/ricochet counts and scatter.' },
];
const tuned = (t: Tuning) => SLIDERS.some(s => t[s.key] !== 1);

// ── Icon editing model ───────────────────────────────────────────────────────
interface IconEdit { theme?: SkillIconMaterial; detail: boolean; scale: number; rotate: number; opacity: number; parts: Record<number, { material?: SkillIconMaterial; opacity?: number; hide?: boolean }> }
const iconEdits = new Map<SkillId, IconEdit>();
const editFor = (id: SkillId): IconEdit => iconEdits.get(id) ?? { detail: true, scale: 1, rotate: 0, opacity: 1, parts: {} };
const MATERIALS = Object.keys(ICON_MATERIALS) as SkillIconMaterial[];

function editedDrawing(id: SkillId): readonly SkillIconDraw[] {
  const edit = editFor(id), recipe = SKILL_ICON_RECIPES[id] ?? [];
  const parts: IconPart[] = recipe.map((part, i) => {
    const p = edit.parts[i];
    if (p?.hide) return { ...part, opacity: 0 };
    return { ...part, ...(p?.material ? { material: p.material } : {}), ...(p?.opacity !== undefined ? { opacity: p.opacity } : {}) };
  });
  // The authored theme is the halo material of the drawing's first op.
  const theme = edit.theme ?? (skillIconDrawing(id, true)[0]?.halo ?? 'steel');
  const drawing = glassIconDrawing(parts, theme, edit.detail);
  const s = edit.scale, a = edit.rotate * Math.PI / 180, c = Math.cos(a), n = Math.sin(a);
  const global: readonly [number, number, number, number, number, number] = [c * s, n * s, -n * s, c * s, 32 - 32 * s * (c - n), 32 - 32 * s * (n + c)];
  const mul = (m: readonly number[], o: readonly number[]): readonly [number, number, number, number, number, number] =>
    [m[0] * o[0] + m[2] * o[1], m[1] * o[0] + m[3] * o[1], m[0] * o[2] + m[2] * o[3], m[1] * o[2] + m[3] * o[3], m[0] * o[4] + m[2] * o[5] + m[4], m[1] * o[4] + m[3] * o[5] + m[5]];
  const faded = edit.opacity === 1 ? drawing : drawing.map(op => ({ ...op, opacity: op.opacity * edit.opacity }));
  return faded.map(op => ({ ...op, transform: mul(global, op.transform) }));
}

let svgInstance = 0;
/** Same serialization as skillIconSVG, fed with the edited draw list. */
function drawingSVG(drawing: readonly SkillIconDraw[], size = 36): string {
  const dimension = Number.isFinite(size) ? Math.max(8, Math.min(256, size)) : 36;
  const prefix = `studio-glass-${svgInstance++}`;
  const paints = new Map<string, string>(), clips = new Map<string, string>();
  for (const op of drawing) {
    if (op.clip && !clips.has(op.clip)) clips.set(op.clip, `${prefix}-clip-${clips.size}`);
    const material = op.surface ?? op.halo;
    if (!material) continue;
    const key = `${op.halo ? 'halo' : 'glass'}-${material}-${Number(op.localGradient)}`;
    if (paints.has(key)) continue;
    const [cx, cy, r] = op.halo ? [32, 32, 31] : skillIconLight(op.localGradient);
    const colors = op.halo ? skillIconHalo(material) : skillIconSurface(material), stops = op.halo ? SKILL_ICON_HALO_STOPS : SKILL_ICON_STOPS;
    paints.set(key, `<radialGradient id="${prefix}-${key}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${colors.map((color, i) => `<stop offset="${stops[i]}" stop-color="${color.slice(0, 7)}"${color.length === 9 ? ` stop-opacity="${parseInt(color.slice(7), 16) / 255}"` : ''}/>`).join('')}</radialGradient>`);
  }
  const paths = drawing.map(op => {
    const material = op.surface ?? op.halo;
    const fill = material ? `url(#${prefix}-${op.halo ? 'halo' : 'glass'}-${material}-${Number(op.localGradient)})` : op.fill ?? 'none';
    return `<g transform="matrix(${op.transform.join(' ')})"${op.clip ? ` clip-path="url(#${clips.get(op.clip)})"` : ''}><path d="${op.path}" opacity="${op.opacity}" fill="${fill}"${op.stroke ? ` stroke="${op.stroke}" stroke-width="${op.width}"` : ''}/></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="${dimension}" height="${dimension}" viewBox="0 0 64 64" fill="none" stroke-linejoin="round" stroke-linecap="round"><defs>${[...paints.values()].join('')}${[...clips].map(([path, clip]) => `<clipPath id="${clip}" clipPathUnits="userSpaceOnUse"><path d="${path}"/></clipPath>`).join('')}</defs>${paths}</svg>`;
}

// ── Page ─────────────────────────────────────────────────────────────────────
const root = await toolPage('Skill & Effect Studio', 'Authoring workbench for skills and effects. Tune the resolved cast profile in memory, cast it on a frozen training scene through the real combat and art renderers, reshape the procedural icon relief and export the result as JSON. Nothing touches a saved run.');
const q = new URLSearchParams(location.search);
const CORE = Object.values(SKILL_DEFINITIONS).filter(s => !s.classId && !s.raceId && s.tier !== 'aura');
const EXTENDED = Object.values(SKILL_DEFINITIONS).filter(s => !CORE.includes(s));
let id: SkillId = SKILL_DEFINITIONS[q.get('skill') as SkillId] ? q.get('skill') as SkillId : 'fireball';
let tuning: Tuning = { ...TUNING_DEFAULT };
for (const s of SLIDERS) { const v = q.get(s.key); if (v !== null && Number.isFinite(Number(v))) tuning[s.key] = Math.max(s.min, Math.min(s.max, Number(v))); }

root.insertAdjacentHTML('beforeend', `<div class="skill-studio">
<aside class="tool-panel"><label>Find a skill<input type="search" id="search" placeholder="Name, school, weapon…" style="width:100%;margin:10px 0"></label>
<label style="font-size:12px;color:#a6bcb7;display:flex;gap:8px;align-items:center;margin-bottom:10px"><input type="checkbox" id="extended"> Class kits, racials & auras</label>
<div class="tool-list" id="skills"></div></aside>
<section>
<form class="tool-toolbar">
<label>Specialization<select name="specialization"></select></label>
<label>Rank<input name="rank" type="number" min="1" max="${SKILL_RANK_RULES.maximum}" value="1" style="width:70px"></label>
<label>Level<select name="level">${[1, 10, 25, 50, 100].map(n => `<option${n === 25 ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
<label>Weapon<select name="weapon"></select></label>
<label>Targets<select name="targets"><option value="fan">Fan · 7</option><option value="line">Line · 7</option><option value="ring">Ring · 7</option><option value="single">Single</option><option value="none">None</option></select></label>
<label>Creature<select name="enemy">${Object.entries(ENEMY_DEFINITIONS).map(([k, d]) => `<option value="${k}">${e(d.name)}</option>`).join('')}</select></label>
<label>Facing<select name="facing">${['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'].map((d, i) => `<option value="${i}">${d}</option>`).join('')}</select></label>
<label>Scenario<select name="scenario"><option value="showcase">Visual showcase · unlimited mana</option><option value="followup">Skill + basic attacks · finite mana</option><option value="sustain">30s rotation · finite mana</option></select></label>
<button id="play" type="button">Cast</button><button id="pause" type="button">Pause</button><button id="step" type="button">Step</button><button id="reset" type="button">Reset</button>
<label>Speed<select id="speed"><option value="1">1×</option><option value=".5">½×</option><option value=".25">¼×</option><option value="2">2×</option></select></label>
<label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="loop"> Loop</label>
<button id="export" type="button">Export JSON</button><button id="png" type="button">PNG</button>
</form>
<div id="skill-title"></div><div id="costs" class="tool-status"></div>
<canvas id="arena" width="1200" height="800"></canvas>
<div class="studio-scrub"><span style="font-size:12px;color:#829797">0s</span><input type="range" id="timeline" min="0" max="12" step="0.008333" value="0"><span id="timeline-end" style="font-size:12px;color:#829797">12s</span></div>
<div class="studio-status"><span class="tool-status" id="status"></span></div>
<div id="buffs"></div>
<div class="studio-grid">
<div class="tool-panel"><h2>Tuning</h2><div id="sliders"></div><button id="reset-tuning" type="button" style="margin-top:12px">Reset tuning</button>
<p class="studio-note">Multipliers apply to the resolved cast profile through the same seams combat uses: derived stats feed costs, radius and weapon base; live artifacts (projectiles, ground fields, buffs, stances, applied statuses) are rescaled at release. Aura reservation and channel tick counts are definition-fixed; the export notes them.</p></div>
<div class="tool-panel"><h2>Icon relief</h2><div class="icon-stage"><canvas id="icon-canvas" width="160" height="160"></canvas>
<div class="icon-sizes"><span id="icon-32"></span><span>32px</span><span id="icon-24"></span><span>24px</span><span id="icon-orig"></span><span>authored</span><span id="icon-node"></span><span>atlas node</span></div></div>
<div class="icon-controls" id="icon-controls"></div>
<h3>Parts</h3><div class="icon-parts" id="icon-parts"></div>
<p class="studio-note">Theme tints steel/dark parts only; explicit part materials keep their glass. Detail toggles engraving below 40px.</p></div>
<div class="tool-panel"><h2>Resolved profile</h2><div id="profile-summary" class="tool-status" style="margin-bottom:8px"></div><pre id="recipe"></pre>
<h3>Event log</h3><pre id="events" style="max-height:200px"></pre></div>
</div>
</section></div>`);

const buffMount = root.querySelector<HTMLElement>('#buffs')!;
const buffBar = new BuffBar(buffMount); Object.assign(buffBar.element.style, { position: 'relative', bottom: 'auto', left: 'auto', transform: 'none', margin: '12px auto' });
const form = root.querySelector('form')!, field = (name: string) => form.elements.namedItem(name) as HTMLSelectElement;
const canvas = root.querySelector<HTMLCanvasElement>('#arena')!, renderer = new Renderer(), fx = new PostFX(canvas), world = new World(7319), motion = matchMedia('(prefers-reduced-motion: reduce)');
// Same bounded open patch as the playground; world collision stays authoritative.
let anchor = { x: 0, y: 0 }, best = -1;
for (let i = 0; i < 49; i++) { const x = (i % 7 - 3) * 220, y = (Math.floor(i / 7) - 3) * 220; if (world.blocked(x, y, 16)) continue; let score = 0; for (let j = 0; j < 12; j++) { const a = j * Math.PI / 6; if (!world.blocked(x + Math.cos(a) * 140, y + Math.sin(a) * 140, 20)) score++; } if (score > best) { best = score; anchor = { x, y }; } if (best === 12) break; }

let study: SkillStudy, playing = false, frame = 0, last = 0, accumulator = 0, disposed = false;
let events: Array<{ time: number; type: string }> = [];
let derivedSeen: object | null = null;
const applied = { mana: 1, cooldown: 1, area: 1, attack: 1, spell: 1 };

// ── Tuning application ───────────────────────────────────────────────────────
function applyTuningPre(): void {
  const p = study.simulation.player, d = p.derived;
  if (derivedSeen !== d) { derivedSeen = d; applied.mana = applied.cooldown = applied.area = 1; }
  d.manaCostMultiplier = d.manaCostMultiplier / applied.mana * tuning.mana;
  d.cooldownMultiplier = d.cooldownMultiplier / applied.cooldown * tuning.cooldown;
  d.areaMultiplier = (d.areaMultiplier ?? 1) / applied.area * tuning.range;
  applied.mana = tuning.mana; applied.cooldown = tuning.cooldown; applied.area = tuning.range;
  p.stats.attackDamageMultiplier = p.stats.attackDamageMultiplier / applied.attack * tuning.damage;
  p.stats.spellDamageMultiplier = p.stats.spellDamageMultiplier / applied.spell * tuning.damage;
  applied.attack = applied.spell = tuning.damage;
}

interface EnemySnap { slowTime: number; slowFactor: number; stunTime: number; freezeTime: number; burnTime: number; dots: number[]; cc: number[]; sundered?: { fraction: number; remaining: number }; taunted?: { remaining: number } }
interface Snap {
  projectiles: Set<Projectile>; grounds: Set<ActiveGroundEffect>; chains: Set<ChainFlight>;
  buffs: Map<WowBuff, number>; guardTime: number; guardReduction: number;
  effects?: PlayerSkillEffects; ward?: PlayerSkillEffects['ward']; stances: Map<object, number>; shelters: Map<object, number>;
  cast?: object | null; dash?: object | null; attack?: object | null;
  enemies: Map<number, EnemySnap>; allies: Map<object, number | undefined>;
  cooldown: number;
}
function snapshot(): Snap {
  const sim = study.simulation, p = sim.player, se = p.skillEffects;
  return {
    projectiles: new Set(sim.projectiles), grounds: new Set(sim.groundEffects), chains: new Set(sim.chains),
    buffs: new Map((p.buffs ?? []).map(b => [b, b.remaining])), guardTime: p.guardTime, guardReduction: p.guardReduction,
    effects: se, ward: se?.ward,
    stances: new Map([se?.brace, se?.rallyOfIron, se?.ghostHunt].filter((s): s is NonNullable<typeof s> => !!s).map(s => [s, s.remaining])),
    shelters: new Map(Object.values(se?.shelters ?? {}).map(s => [s, s.remaining])),
    cast: p.cast, dash: p.dash, attack: p.attack,
    enemies: new Map(sim.enemies.map(en => [en.id, {
      slowTime: en.slowTime, slowFactor: en.slowFactor, stunTime: en.stunTime ?? 0, freezeTime: en.freezeTime ?? 0, burnTime: en.burnTime,
      dots: (en.dots ?? []).map(d => d.remaining), cc: (en.cc ?? []).map(c => c.remaining),
      sundered: en.sundered ? { ...en.sundered } : undefined, taunted: en.taunted ? { remaining: en.taunted.remaining } : undefined,
    }])),
    allies: new Map((p.allies ?? []).map(a => [a, a.remaining])),
    cooldown: p.skillCooldowns[id] ?? 0,
  };
}
const potency = (f: number) => Math.max(.05, 1 - (1 - f) * tuning.status);
function patchAfterStep(prev: Snap): void {
  const sim = study.simulation, p = sim.player, t = tuning;
  for (const shot of sim.projectiles) if (!prev.projectiles.has(shot) && shot.skill === id) {
    shot.radius *= t.range; shot.life *= t.range; shot.maxLife *= t.range;
    const fx = shot.effects;
    if (fx) {
      if (fx.blastRadius) fx.blastRadius *= t.range;
      if (fx.chainRange) fx.chainRange *= t.range;
      if (fx.fissureWidth) fx.fissureWidth *= t.range;
      if (fx.shatter) fx.shatter.radius *= t.range;
      if (fx.stunDuration) fx.stunDuration *= t.status;
      if (fx.slowDuration) fx.slowDuration *= t.status;
      if (fx.slowFactor) fx.slowFactor = potency(fx.slowFactor);
      if (fx.burnDuration) fx.burnDuration *= t.status;
      if (fx.groundDuration) fx.groundDuration *= t.duration;
      if (fx.pierce !== undefined) fx.pierce = Math.max(0, Math.round(fx.pierce * t.pulses));
      if (fx.chain !== undefined) fx.chain = Math.max(0, Math.round(fx.chain * t.pulses));
    }
  }
  for (const g of sim.groundEffects) if (!prev.grounds.has(g) && g.skill === id) {
    g.radius *= t.range; g.duration *= t.duration;
    if (g.initialDuration !== undefined) g.initialDuration *= t.duration;
    g.interval = Math.max(GROUND_EFFECT_RULES.minimumInterval, g.interval / t.pulses);
    g.pulsesLeft = groundEffectPulseCount(g);
    if (g.slow) g.slow = { duration: g.slow.duration * t.status, factor: potency(g.slow.factor) };
    if (g.stun) g.stun *= t.status;
    if (g.scorch) g.scorch = { duration: g.scorch.duration * t.status, interval: Math.max(GROUND_EFFECT_RULES.minimumInterval, g.scorch.interval / t.pulses), dps: g.scorch.dps };
    if (g.burn) g.burn = { duration: g.burn.duration * t.status, dps: g.burn.dps };
  }
  for (const c of sim.chains) if (!prev.chains.has(c) && c.skill === id) {
    c.recipe = { ...c.recipe, jumps: Math.max(1, Math.round(c.recipe.jumps * t.pulses)), range: c.recipe.range * t.range, duration: c.recipe.duration * t.duration };
  }
  for (const b of p.buffs ?? []) {
    const before = prev.buffs.get(b);
    if (before === undefined || b.remaining > before) b.remaining *= t.duration;
    if (before === undefined && b.absorbRemaining !== undefined) b.absorbRemaining *= t.status;
  }
  if (p.guardTime > prev.guardTime) { p.guardTime = prev.guardTime + (p.guardTime - prev.guardTime) * t.duration; p.guardReduction = Math.min(.95, p.guardReduction * t.status); }
  const se = p.skillEffects;
  if (se) {
    if (se.ward && se.ward !== prev.ward) { se.ward.remaining *= t.duration; se.ward.capacity *= t.status; if (se.ward.rupture) { se.ward.rupture.cap *= t.status; se.ward.rupture.radius *= t.range; } }
    for (const s of [se.brace, se.rallyOfIron, se.ghostHunt]) if (s) {
      const before = prev.stances.get(s);
      if (before === undefined || s.remaining > before) s.remaining *= t.duration;
      if (before === undefined) { s.reduction = Math.min(.95, s.reduction * t.status); s.bonus *= t.status; }
    }
    for (const s of Object.values(se.shelters ?? {})) {
      const before = prev.shelters.get(s);
      if (before === undefined || s.remaining > before) s.remaining *= t.duration;
      if (before === undefined) s.reduction = Math.min(.95, s.reduction * t.status);
    }
    if (se.returnStep && se.returnStep.remaining > 0 && !prev.effects?.returnStep) se.returnStep.remaining *= t.duration;
    if (se.decoy && !prev.effects?.decoy) { se.decoy.remaining *= t.duration; se.decoy.reach *= t.range; }
    if (se.archer && !prev.effects?.archer) se.archer.remaining *= t.duration;
    if (se.conductor && !prev.effects?.conductor) se.conductor.remaining *= t.duration;
    if (se.borrowed && !prev.effects?.borrowed) { se.borrowed.remaining *= t.duration; se.borrowed.capacity *= t.status; }
    if (se.bastion && !prev.effects?.bastion) se.bastion.remaining *= t.duration;
  }
  if (p.cast && p.cast !== prev.cast && p.cast.channel) { p.cast.remaining *= t.duration; p.cast.duration *= t.duration; }
  if (p.dash && p.dash !== prev.dash) { p.dash.speed *= t.range; p.dash.radius *= t.range; if (p.dash.stun) p.dash.stun *= t.status; }
  if (p.attack && p.attack !== prev.attack && p.attack.skill === id) { p.attack.range *= t.range; p.attack.arc = Math.min(Math.PI * 2, p.attack.arc * t.range); }
  for (const en of sim.enemies) {
    const s0 = prev.enemies.get(en.id); if (!s0) continue;
    en.slowTime = s0.slowTime + (en.slowTime - s0.slowTime) * t.status;
    en.stunTime = s0.stunTime + ((en.stunTime ?? 0) - s0.stunTime) * t.status;
    en.freezeTime = s0.freezeTime + ((en.freezeTime ?? 0) - s0.freezeTime) * t.status;
    en.burnTime = s0.burnTime + (en.burnTime - s0.burnTime) * t.status;
    if (en.slowFactor < s0.slowFactor) en.slowFactor = Math.max(s0.slowFactor * .4, potency(en.slowFactor));
    (en.dots ?? []).forEach((d, i) => { const r0 = s0.dots[i]; d.remaining = (r0 ?? 0) + (d.remaining - (r0 ?? 0)) * t.status; });
    (en.cc ?? []).forEach((c, i) => { const r0 = s0.cc[i]; c.remaining = (r0 ?? 0) + (c.remaining - (r0 ?? 0)) * t.status; });
    if (en.sundered) { const s = s0.sundered; en.sundered = { fraction: (s?.fraction ?? 0) + (en.sundered.fraction - (s?.fraction ?? 0)) * t.status, remaining: (s?.remaining ?? 0) + (en.sundered.remaining - (s?.remaining ?? 0)) * t.status }; }
    if (en.taunted) en.taunted = { ...en.taunted, remaining: (s0.taunted?.remaining ?? 0) + (en.taunted.remaining - (s0.taunted?.remaining ?? 0)) * t.status };
  }
  for (const ally of (p.allies ?? []) as Ally[]) { const r0 = prev.allies.get(ally); if (ally.remaining !== undefined && (r0 === undefined || ally.remaining > r0)) ally.remaining *= t.duration; }
  const cd = p.skillCooldowns[id] ?? 0;
  if (cd > prev.cooldown) p.skillCooldowns[id] = tunedCooldown();
}
function tunedCooldown(): number {
  const base = SKILL_DEFINITIONS[id], floor = id === 'bulwark' ? 4 : base.tier === 'ultimate' ? 12 : 0;
  return Math.max(floor, study.resolved.cooldown * tuning.cooldown);
}
/** Presentation events carry recipe geometry; rescale so VFX matches the tuned artifacts. */
function tuneEvent(ev: CombatEvent): CombatEvent {
  const t = tuning;
  if (ev.skill !== id) return ev;
  if (ev.type === 'blast' || ev.type === 'ground') return { ...ev, radius: ev.radius * t.range, ...(ev.duration !== undefined ? { duration: ev.duration * t.duration } : {}) };
  if (ev.type === 'skill-strike') return { ...ev, range: ev.range * t.range, arc: Math.min(Math.PI * 2, ev.arc * t.range) };
  if (ev.type === 'chain') return { ...ev, ...(ev.duration !== undefined ? { duration: ev.duration * t.duration } : {}) };
  return ev;
}

// ── Resolved profile + export ────────────────────────────────────────────────
const deep = <T>(v: T): T => v && typeof v === 'object' ? (Array.isArray(v) ? v.map(deep) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]))) as T : v;
function tuneRecipe(recipe: SkillExecution): SkillExecution {
  const t = tuning, r = deep(recipe) as Record<string, any>;
  if (typeof r.radius === 'number') r.radius *= t.range;
  if (typeof r.reachMultiplier === 'number') r.reachMultiplier *= t.range;
  if (typeof r.minRange === 'number') r.minRange *= t.range;
  if (typeof r.dispelRadius === 'number') r.dispelRadius *= t.range;
  if (r.kind === 'sweep') r.arc = Math.min(Math.PI * 2, r.arc * t.range);
  if ((r.kind === 'dash' || r.kind === 'step') && typeof r.speed === 'number') r.speed *= t.range;
  if (typeof r.duration === 'number') r.duration *= (r.kind === 'cc' || r.kind === 'taunt' ? t.status : t.duration);
  for (const k of ['stun', 'silence', 'taunt', 'sunder', 'executeBonus', 'healFrac', 'diseaseBonus', 'bonusVsDot', 'bonusVsFrozen', 'bonusBehind', 'bonusVsRooted', 'reduction', 'fraction', 'bonus', 'stunPerCombo'] as const)
    if (typeof r[k] === 'number') r[k] *= t.status;
  if (typeof r.amount === 'number') r.amount *= t.damage;
  if (typeof r.consumeHot === 'number') r.consumeHot *= t.damage;
  if (typeof r.interval === 'number') r.interval = Math.max(GROUND_EFFECT_RULES.minimumInterval, r.interval / t.pulses);
  for (const k of ['jumps', 'scatter', 'ticks', 'count'] as const) if (typeof r[k] === 'number') r[k] = Math.max(1, Math.round(r[k] * t.pulses));
  if (r.slow) { r.slow.duration *= t.status; r.slow.factor = potency(r.slow.factor); }
  if (r.dot) { r.dot.duration *= t.status; if (typeof r.dot.interval === 'number') r.dot.interval = Math.max(GROUND_EFFECT_RULES.minimumInterval, r.dot.interval / t.pulses); }
  if (r.hot) { r.hot.duration *= t.duration; if (typeof r.hot.perTick === 'number') r.hot.perTick *= t.damage; if (typeof r.hot.flatTick === 'number') r.hot.flatTick *= t.damage; }
  if (r.cc) r.cc.duration *= t.status;
  if (r.buff) { if (typeof r.buff.duration === 'number') r.buff.duration *= t.duration; if (typeof r.buff.absorb === 'number') r.buff.absorb *= t.status; }
  if (r.buffPerCombo) { if (typeof r.buffPerCombo.duration === 'number') r.buffPerCombo.duration *= t.duration; }
  if (r.shelter) { r.shelter.duration *= t.duration; r.shelter.reduction = Math.min(.95, r.shelter.reduction * t.status); }
  if (r.scorch) { r.scorch.duration *= t.status; r.scorch.interval = Math.max(GROUND_EFFECT_RULES.minimumInterval, r.scorch.interval / t.pulses); }
  if (r.burn) r.burn.duration *= t.status;
  if (r.effects) {
    const fx = r.effects;
    if (typeof fx.blastRadius === 'number') fx.blastRadius *= t.range;
    if (typeof fx.chainRange === 'number') fx.chainRange *= t.range;
    if (typeof fx.stunDuration === 'number') fx.stunDuration *= t.status;
    if (typeof fx.slowDuration === 'number') fx.slowDuration *= t.status;
    if (typeof fx.slowFactor === 'number') fx.slowFactor = potency(fx.slowFactor);
    if (typeof fx.burnDuration === 'number') fx.burnDuration *= t.status;
    if (typeof fx.groundDuration === 'number') fx.groundDuration *= t.duration;
    if (typeof fx.pierce === 'number') fx.pierce = Math.max(0, Math.round(fx.pierce * t.pulses));
    if (typeof fx.chain === 'number') fx.chain = Math.max(0, Math.round(fx.chain * t.pulses));
  }
  return r as SkillExecution;
}
function tunedProfile() {
  const r = study.resolved, t = tuning;
  return {
    ...r,
    mana: r.mana > 0 ? Math.max(1, Math.round(r.mana * t.mana * 10) / 10) : 0,
    cooldown: tunedCooldown(),
    damageMultiplier: r.damageMultiplier * t.damage,
    ...(r.range !== undefined ? { range: r.range * t.range } : {}),
    ...(r.castTime !== undefined ? { castTime: r.castTime * t.duration } : {}),
    ...(r.channel ? { channel: { ...r.channel, duration: r.channel.duration * t.duration } } : {}),
    ...(r.reservation ? { reservation: Math.round(r.reservation * t.mana * 100) / 100 } : {}),
    ...(r.upkeep ? { upkeep: Math.round(r.upkeep * t.mana * 10) / 10 } : {}),
    recipe: tuneRecipe(r.recipe),
  };
}

// ── Skill list + options ─────────────────────────────────────────────────────
function list(query = ''): void {
  const extended = root.querySelector<HTMLInputElement>('#extended')!.checked;
  const pool = extended ? [...CORE, ...EXTENDED] : CORE;
  root.querySelector('#skills')!.innerHTML = pool
    .filter(s => `${s.name} ${s.domain} ${s.requirement} ${s.classId ?? ''} ${s.raceId ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .map(s => `<button data-skill="${s.id}" aria-pressed="${s.id === id}"><span style="color:${s.color}">${skillIconSVG(s.id, 25)}</span> ${e(s.name)}<small>${s.domain} · ${s.tier}${s.classId ? ` · <em>${e(s.classId)}</em>` : ''}${s.raceId ? ` · <em>${e(s.raceId)}</em>` : ''}</small></button>`).join('');
}
function options(): void {
  field('weapon').innerHTML = studyWeapons(id).map(w => `<option value="${w.id}">${e(w.name)}</option>`).join('') || '<option value="">—</option>';
  field('specialization').innerHTML = '<option value="">Base skill</option>' + SKILL_SPECIALIZATIONS.filter(s => s.skill === id).map(s => `<option value="${s.id}">${e(s.name)}</option>`).join('');
}
options();
field('rank').value = String(boundedNumber(q.get('rank'), 1, 1, SKILL_RANK_RULES.maximum));
field('facing').value = String(boundedNumber(q.get('facing'), 0, 0, 7));
for (const key of ['weapon', 'specialization', 'targets', 'enemy', 'scenario', 'level']) if ([...field(key).options].some(o => o.value === q.get(key))) field(key).value = q.get(key)!;

function configuration(): SkillStudyOptions {
  return {
    scenario: field('scenario').value as SkillStudyOptions['scenario'], level: Number(field('level').value),
    skill: id, weapon: field('weapon').value, rank: Number(field('rank').value), specialization: field('specialization').value,
    facing: Number(field('facing').value) * Math.PI / 4, targets: field('targets').value as SkillStudyOptions['targets'],
    enemy: field('enemy').value as EnemyKind, ...anchor,
  };
}

// ── Study lifecycle ──────────────────────────────────────────────────────────
function rebuild(seekTo = 0): void {
  playing = false; accumulator = 0; events = [];
  try { study = new SkillStudy(world, configuration()); }
  catch (error) { root.querySelector('#status')!.textContent = `Cannot stage this skill: ${error instanceof Error ? error.message : error}`; draw(0); return; }
  derivedSeen = null; applied.mana = applied.cooldown = applied.area = applied.attack = applied.spell = 1;
  field('weapon').value = study.options.weapon;
  renderer.reset(); renderer.resize(850, 560, 1200, 800); renderer.cameraX = anchor.x; renderer.cameraY = anchor.y;
  const s = SKILL_DEFINITIONS[id];
  root.querySelector('#skill-title')!.innerHTML = `<h2 style="color:${s.color};margin:0">${skillIconSVG(id, 32)} ${e(s.name)}</h2><p style="margin:6px 0 10px">${e(s.description)}</p>`;
  root.querySelector<HTMLInputElement>('#timeline')!.max = String(study.duration);
  root.querySelector('#timeline-end')!.textContent = `${study.duration}s`;
  refreshReadouts(); refreshIcon(); refreshSliders();
  const params = new URLSearchParams({ skill: id, ...Object.fromEntries(new FormData(form) as Iterable<[string, string]>) });
  if (tuned(tuning)) for (const sl of SLIDERS) if (tuning[sl.key] !== 1) params.set(sl.key, String(tuning[sl.key]));
  history.replaceState(null, '', `?${params}`); reportRoute();
  if (seekTo > 0) seek(seekTo); else draw(0);
  buttons();
}
function refreshReadouts(): void {
  if (!study) return;
  const r = study.resolved, tp = tunedProfile(), s = SKILL_DEFINITIONS[id];
  const spec = SKILL_SPECIALIZATIONS.find(v => v.id === study.options.specialization);
  root.querySelector('#costs')!.textContent = `${skillRequirementLabel(s.requirement)} · ${r.reservation ? `${r.reservation}% mana reserved` : `${r.mana} mana · ${r.cooldown}s cooldown`} · ${r.damageMultiplier ? `${r.damageMultiplier.toFixed(2)}× damage` : skillUtilityLabel(id, r.recipe)}${r.damageMultiplier && skillUtilityLabel(id, r.recipe) ? ` · ${skillUtilityLabel(id, r.recipe)}` : ''} · Rank ${study.options.rank}${spec ? ` · ${spec.name}` : ''}${r.upkeep ? ` · ${r.upkeep} mana/s upkeep` : ''}`;
  root.querySelector('#profile-summary')!.innerHTML = tuned(tuning)
    ? `Tuned: <b>${tp.mana} mana</b> · <b>${tp.cooldown.toFixed(2)}s</b> · <b>${tp.damageMultiplier.toFixed(2)}×</b>${tp.range !== undefined ? ` · <b>${Math.round(tp.range)} range</b>` : ''} · recipe <b>${e(tp.recipe.kind)}</b>`
    : `Base profile · recipe ${e(tp.recipe.kind)} — move a slider to tune.`;
  root.querySelector('#recipe')!.textContent = JSON.stringify(tuned(tuning) ? { base: r, tuned: tp } : tp, null, 2);
}
function stepSim(): void {
  applyTuningPre();
  const prev = snapshot();
  const emitted = study.step();
  patchAfterStep(prev);
  const tunedEvents = emitted.map(tuneEvent);
  renderer.handleEvents(tunedEvents, motion.matches);
  events.push(...tunedEvents.map(ev => ({ time: Number(study.elapsed.toFixed(3)), type: ev.type })));
  events.splice(0, Math.max(0, events.length - 100));
  if (emitted.length) root.querySelector('#events')!.textContent = events.map(ev => `${ev.time.toFixed(3)}s  ${ev.type}`).join('\n');
}
function seek(to: number): void {
  if (!study) return;
  if (to < study.elapsed) { const keep = to; rebuildInner(); to = keep; }
  let guard = Math.ceil(study.duration * 120) + 240;
  while (study.elapsed < to && study.elapsed < study.duration && !study.simulation.player.dead && guard-- > 0) stepSim();
  draw(0);
}
function rebuildInner(): void {
  const elapsed = 0;
  playing = false; accumulator = 0; events = [];
  try { study = new SkillStudy(world, configuration()); } catch { return; }
  derivedSeen = null; applied.mana = applied.cooldown = applied.area = applied.attack = applied.spell = 1;
  renderer.reset(); renderer.cameraX = anchor.x; renderer.cameraY = anchor.y;
  void elapsed;
}
function draw(dt: number): void {
  if (!study) return;
  buffBar.update(activeBuffs(study.simulation.player, study.simulation.groundEffects));
  renderer.cameraX = anchor.x; renderer.cameraY = anchor.y;
  renderer.render(study.simulation, world, dt, { phase: 'playing', reducedMotion: motion.matches });
  fx.render(renderer.canvas, 0);
  root.querySelector<HTMLInputElement>('#timeline')!.value = String(study.elapsed);
  root.querySelector('#status')!.textContent = `${study.elapsed.toFixed(2)} / ${study.duration.toFixed(2)}s · ${isAura(id) ? 'Aura active' : study.didCast ? `${study.casts} casts` : 'Waiting for cast / mana'} · ${study.simulation.enemies.length} training targets · ${Math.round(study.damage)} damage · Life ${Math.round(study.simulation.player.hp)}/${study.simulation.player.maxHp} · Mana ${Math.round(study.simulation.player.mana)}/${manaCapacity(study.simulation.player)} · ${Math.round(study.manaSpent)} mana spent${study.simulation.player.dead ? ' · Defeated' : ''}`;
}
function buttons(): void {
  const b = root.querySelector<HTMLButtonElement>('#pause')!;
  b.disabled = !playing && (!study || study.elapsed === 0);
  b.textContent = playing ? 'Pause' : 'Resume';
}
function tick(now: number): void {
  frame = 0; if (disposed) return;
  const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
  if (playing && !document.hidden) {
    accumulator += dt * Number(root.querySelector<HTMLSelectElement>('#speed')!.value);
    let steps = 0;
    while (accumulator >= 1 / 120 && steps < 24) { stepSim(); accumulator -= 1 / 120; steps++; }
    if (steps) draw(steps / 120);
    if (study.elapsed >= study.duration || study.simulation.player.dead) {
      if (root.querySelector<HTMLInputElement>('#loop')!.checked) { rebuild(); playing = true; }
      else playing = false;
      buttons();
    }
  }
  if (playing && !document.hidden) frame = requestAnimationFrame(tick);
}
function run(): void { if (!frame) { last = 0; frame = requestAnimationFrame(tick); } buttons(); }

// ── Tuning sliders ───────────────────────────────────────────────────────────
const sliderInputs = new Map<keyof Tuning, HTMLInputElement>();
function buildSliders(): void {
  root.querySelector('#sliders')!.innerHTML = SLIDERS.map(s =>
    `<div class="tune-row"><label for="tune-${s.key}">${s.label}</label><output id="tune-${s.key}-out"></output><input type="range" id="tune-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}"><small>${s.hint}</small></div>`).join('');
  for (const s of SLIDERS) {
    const input = root.querySelector<HTMLInputElement>(`#tune-${s.key}`)!;
    sliderInputs.set(s.key, input);
    input.addEventListener('input', () => {
      tuning[s.key] = Number(input.value);
      refreshSliders(); refreshReadouts(); scheduleRepreview();
    });
  }
}
function refreshSliders(): void {
  for (const s of SLIDERS) {
    const input = sliderInputs.get(s.key); if (!input) continue;
    input.value = String(tuning[s.key]);
    root.querySelector(`#tune-${s.key}-out`)!.textContent = `${tuning[s.key].toFixed(2)}×`;
  }
}
let repreviewTimer = 0;
function scheduleRepreview(): void {
  window.clearTimeout(repreviewTimer);
  repreviewTimer = window.setTimeout(() => { const at = study?.elapsed ?? 0; rebuild(); seek(Math.min(at, study?.duration ?? 0)); }, 280);
}
root.querySelector('#reset-tuning')!.addEventListener('click', () => { tuning = { ...TUNING_DEFAULT }; refreshSliders(); refreshReadouts(); scheduleRepreview(); });

// ── Icon editor ──────────────────────────────────────────────────────────────
const iconCanvas = root.querySelector<HTMLCanvasElement>('#icon-canvas')!, iconCtx = iconCanvas.getContext('2d')!;
/** Redraw only the icon previews — cheap enough to run on every edit input. */
function refreshIconPreview(): void {
  const drawing = editedDrawing(id);
  iconCtx.setTransform(1, 0, 0, 1, 0, 0); iconCtx.clearRect(0, 0, 160, 160);
  paintGlassIcon(iconCtx, drawing, 80, 80, 144);
  // Passive engraving sample through the shared tree-glyph path.
  const minor = [...SKILL_NODES.values()].find(n => !n.skill && !n.specialization && !n.keystone && n.kind === 'minor');
  if (minor) drawSkillGlyph(iconCtx, minor, 146, 146, 26, '#9cae81');
  root.querySelector('#icon-32')!.innerHTML = drawingSVG(drawing, 32);
  root.querySelector('#icon-24')!.innerHTML = drawingSVG(drawing, 24);
  root.querySelector('#icon-orig')!.innerHTML = skillIconSVG(id, 24);
  const node = SKILL_NODES.get(`skill:${id}`) ?? [...SKILL_NODES.values()].find(n => n.skill === id);
  root.querySelector('#icon-node')!.innerHTML = node ? skillNodeIconSVG(node, 24) : '—';
}
/** Rebuild the icon editor controls — once per skill, never per input (that would detach a dragged slider). */
function refreshIcon(): void {
  refreshIconPreview();
  const edit = editFor(id);
  const controls = root.querySelector('#icon-controls')!;
  controls.innerHTML = `
    <label>Theme<select id="ic-theme"><option value="">Authored (${skillIconDrawing(id, true)[0]?.halo ?? 'steel'})</option>${MATERIALS.map(m => `<option value="${m}"${edit.theme === m ? ' selected' : ''}>${m}</option>`).join('')}</select><span></span></label>
    <label>Scale<input type="range" id="ic-scale" min="0.5" max="1.6" step="0.05" value="${edit.scale}"><output>${edit.scale.toFixed(2)}×</output></label>
    <label>Rotate<input type="range" id="ic-rotate" min="-180" max="180" step="5" value="${edit.rotate}"><output>${edit.rotate}°</output></label>
    <label>Opacity<input type="range" id="ic-opacity" min="0.1" max="1" step="0.05" value="${edit.opacity}"><output>${Math.round(edit.opacity * 100)}%</output></label>
    <label>Detail<input type="checkbox" id="ic-detail"${edit.detail ? ' checked' : ''} style="justify-self:start"><span style="font-size:12px;color:#829797">engraving cuts</span></label>`;
  controls.querySelector('#ic-theme')!.addEventListener('change', ev => { mutateEdit(em => { em.theme = (ev.target as HTMLSelectElement).value as SkillIconMaterial || undefined; }); });
  for (const [key, prop, fmt] of [['ic-scale', 'scale', (v: number) => `${v.toFixed(2)}×`], ['ic-rotate', 'rotate', (v: number) => `${v}°`], ['ic-opacity', 'opacity', (v: number) => `${Math.round(v * 100)}%`]] as const) {
    controls.querySelector(`#${key}`)!.addEventListener('input', ev => {
      const input = ev.target as HTMLInputElement;
      mutateEdit(em => { em[prop] = Number(input.value); });
      (input.nextElementSibling as HTMLOutputElement).textContent = fmt(Number(input.value));
    });
  }
  controls.querySelector('#ic-detail')!.addEventListener('change', ev => mutateEdit(em => { em.detail = (ev.target as HTMLInputElement).checked; }));
  const recipe = SKILL_ICON_RECIPES[id] ?? [];
  root.querySelector('#icon-parts')!.innerHTML = recipe.map((part, i) => {
    const p = edit.parts[i];
    return `<div class="icon-part"><svg width="30" height="30" viewBox="-32 -32 64 64"><path d="${part.path}" fill="none" stroke="${ICON_MATERIALS[part.material].face}" stroke-width="2"/></svg>
    <span>${part.kind}${part.detail ? ' · engraving' : ''}</span>
    <select data-part="${i}" data-field="material"><option value="">${part.material}</option>${MATERIALS.map(m => `<option value="${m}"${p?.material === m ? ' selected' : ''}>${m}</option>`).join('')}</select>
    <input type="range" data-part="${i}" data-field="opacity" min="0" max="1" step="0.05" value="${p?.opacity ?? part.opacity ?? 1}">
    <input type="checkbox" data-part="${i}" data-field="hide"${p?.hide ? ' checked' : ''} title="hide"></div>`;
  }).join('') || '<p class="studio-note">This skill has no authored icon parts.</p>';
}
function mutateEdit(fn: (em: IconEdit) => void): void {
  const em = editFor(id); fn(em); iconEdits.set(id, em); refreshIconPreview();
}
root.querySelector('#icon-parts')!.addEventListener('input', ev => {
  const el = ev.target as HTMLElement;
  const part = Number((el as HTMLInputElement).dataset.part), fieldName = (el as HTMLInputElement).dataset.field;
  if (!Number.isInteger(part) || !fieldName) return;
  mutateEdit(em => {
    const p = em.parts[part] ??= {};
    if (fieldName === 'material') p.material = (el as HTMLSelectElement).value as SkillIconMaterial || undefined;
    if (fieldName === 'opacity') p.opacity = Number((el as HTMLInputElement).value);
    if (fieldName === 'hide') p.hide = (el as HTMLInputElement).checked;
  });
});

// ── Wiring ───────────────────────────────────────────────────────────────────
root.querySelector('#play')!.addEventListener('click', () => { rebuild(); playing = true; run(); });
root.querySelector('#pause')!.addEventListener('click', () => { if (!study || study.elapsed >= study.duration || study.simulation.player.dead) rebuild(); playing = !playing; run(); });
root.querySelector('#reset')!.addEventListener('click', () => rebuild());
root.querySelector('#step')!.addEventListener('click', () => { playing = false; stepSim(); draw(1 / 120); buttons(); });
root.querySelector<HTMLInputElement>('#timeline')!.addEventListener('input', ev => { playing = false; seek(Number((ev.target as HTMLInputElement).value)); buttons(); });
form.addEventListener('submit', ev => ev.preventDefault());
form.addEventListener('change', ev => { if ((ev.target as HTMLElement).id === 'speed' || (ev.target as HTMLElement).id === 'loop') return; rebuild(); });
root.querySelector('#skills')!.addEventListener('click', ev => {
  const b = (ev.target as Element).closest<HTMLElement>('[data-skill]');
  if (b) { id = b.dataset.skill as SkillId; options(); list(root.querySelector<HTMLInputElement>('#search')!.value); rebuild(); }
});
root.querySelector<HTMLInputElement>('#search')!.addEventListener('input', ev => list((ev.target as HTMLInputElement).value));
root.querySelector<HTMLInputElement>('#extended')!.addEventListener('change', () => list(root.querySelector<HTMLInputElement>('#search')!.value));
root.querySelector('#export')!.addEventListener('click', () => {
  const edit = iconEdits.get(id);
  downloadJSON(`evergrow-skill-${id}.json`, {
    skill: id, name: SKILL_DEFINITIONS[id].name,
    options: study.options, tuning, resolved: study.resolved, tuned: tunedProfile(),
    iconEdit: edit ?? null,
    notes: [
      'Tuning is memory-only; SKILL_DEFINITIONS/SKILL_EXECUTION are unchanged.',
      'Aura reservation and channel tick counts are definition-fixed in preview; reservation is scaled in tuned profile only.',
      'Direct heals ride the weapon base and scale with the damage multiplier.',
    ],
    observation: { elapsed: study.elapsed, casts: study.casts, damage: study.damage, manaSpent: study.manaSpent, events },
  });
});
root.querySelector('#png')!.addEventListener('click', () => { draw(0); const a = document.createElement('a'); a.download = `skill-studio-${id}-${study.elapsed.toFixed(2)}.png`; a.href = canvas.toDataURL('image/png'); a.click(); });
function visibility(): void { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; last = 0; accumulator = 0; } else if (playing) run(); }
document.addEventListener('visibilitychange', visibility);
function dispose(): void {
  buffBar.dispose(); document.removeEventListener('visibilitychange', visibility);
  disposed = true; cancelAnimationFrame(frame); window.clearTimeout(repreviewTimer);
  renderer.reset(); fx.dispose(); world.dispose();
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
buildSliders(); list(); rebuild();
