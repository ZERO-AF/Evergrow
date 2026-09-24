import { toolPage, boundedNumber, downloadJSON, reportRoute } from './common.ts';
import './enemy-studio.css';
import {
  ENEMY_DEFINITIONS, ENEMY_SIGNATURE_ATTACKS, ELITE_QUICK_ATTACKS, ELITE_AFFIXES, ELITE_AFFIX_RULES,
  eliteAffix, creatureFamily, type EnemyDefinition,
} from '../combat-content.ts';
import {
  ENEMY_RANKS, monsterHealthScale, monsterDamageScale, monsterExperienceScale,
  eliteDurabilityMultiplier, type EnemyRank,
} from '../progression-content.ts';
import { enemyThreat, enemyRecoveryDuration, enemyWindupDuration } from '../enemy-threat.ts';
import { enemyVisualScale, enemyModifiers, enemyMovementMultiplier, applyEnemyModifiers } from '../enemy-modifiers.ts';
import { isBossKind } from '../wilderness-boss-content.ts';
import { ENEMY_BODY_BOUNDS } from '../enemy-body.ts';
import { drawHumanoid } from '../art.ts';
import { drawDeathFigure } from '../death-art.ts';
import { ENEMY_DEATHS, DEATH_VARIANTS, type DeathVariant } from '../death-content.ts';
import { drawAttackWarning, type WarningShape } from '../attack-warning-art.ts';
import { drawEnemyPlate } from '../enemy-plate.ts';
import { enemyRosterSkin } from '../zone-roster.ts';
import { World } from '../world.ts';
import { Renderer } from '../renderer.ts';
import { PostFX } from '../postfx.ts';
import { Simulation } from '../simulation.ts';
import { scaledEnemyStats } from '../zone-progression.ts';
import { escapeUI as e } from '../ui-components.ts';
import type { Enemy, EnemyKind } from '../model.ts';
import type { CharacterPose } from '../art-types.ts';
import type { WildernessSite } from '../wilderness-sites.ts';

// Authoring studio: staged enemies and a disposable Simulation for the terrain
// preview. No playable saves, no persistence, no live gameplay input.
const root = await toolPage('Enemy & encounter studio',
  'Author an enemy from any archetype, tune its definition against live rank/level scaling, preview all eight facings plus windup, attack and death animations, then compose a formation on real terrain and export the recipe as JSON. Everything is staged in memory.');

const KINDS = Object.keys(ENEMY_DEFINITIONS) as EnemyKind[];
const RANKS: readonly EnemyRank[] = ['normal', 'veteran', 'elite', 'rare'];
const FACING_NAMES = ['East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest', 'North', 'Northeast'];
const STYLE_COLORS: Record<string, string> = {
  fire: '#ffac63', spirit: '#8fc88c', lightning: '#a5baff', arrow: '#d8cba8',
  frost: '#8fd8f2', nature: '#9ae0c7', shadow: '#c98ef5', holy: '#f0d98a', physical: '#d8cba8',
};
const q = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const abort = new AbortController();

// ── Authored draft: a mutable copy of the base definition the sliders edit. ──
interface Draft {
  name: string; hp: number; damage: number; xpReward: number; radius: number; speed: number;
  range: number; windup: number; active: number; recovery: number; aimLock: number;
  awarenessDistance: number; preferredDistance: number; knockbackDistance: number;
  arc: number; lungeSpeed: number; engageDistance: number;
  blastRadius: number; maxAttackDistance: number; retreatDistance: number;
  projectileSpeed: number; projectileLife: number; projectileRadius: number;
}
const draftFrom = (d: EnemyDefinition): Draft => ({
  name: d.name, hp: d.hp, damage: d.damage, xpReward: d.xpReward, radius: d.radius, speed: d.speed,
  range: d.range, windup: d.windup, active: d.active, recovery: d.recovery, aimLock: d.aimLock,
  awarenessDistance: d.awarenessDistance, preferredDistance: d.preferredDistance,
  knockbackDistance: d.knockbackDistance,
  arc: d.attack === 'melee' ? d.arc : Math.PI * .7,
  lungeSpeed: d.attack === 'melee' ? d.lungeSpeed : 0,
  engageDistance: d.attack === 'melee' ? d.engageDistance ?? 0 : 0,
  blastRadius: d.attack === 'ground' ? d.blastRadius : 52,
  maxAttackDistance: d.attack === 'melee' ? 250 : d.maxAttackDistance,
  retreatDistance: d.attack === 'melee' ? 0 : d.retreatDistance,
  projectileSpeed: d.attack === 'projectile' ? d.projectile.speed : 170,
  projectileLife: d.attack === 'projectile' ? d.projectile.life : 2,
  projectileRadius: d.attack === 'projectile' ? d.projectile.radius : 5,
});

/** Apply the draft's scalar fields onto whichever attack recipe is previewed. */
function defFromDraft(base: EnemyDefinition, d: Draft): EnemyDefinition {
  const shared = {
    ...base, name: d.name, hp: d.hp, damage: d.damage, xpReward: d.xpReward, radius: d.radius,
    speed: d.speed, range: d.range, windup: d.windup, active: d.active, recovery: d.recovery,
    aimLock: d.aimLock, awarenessDistance: d.awarenessDistance, preferredDistance: d.preferredDistance,
    knockbackDistance: d.knockbackDistance,
  };
  if (shared.attack === 'melee') {
    const { engageDistance: _baseEngage, ...rest } = shared;
    return { ...rest, arc: d.arc, lungeSpeed: d.lungeSpeed, ...(d.engageDistance > 0 ? { engageDistance: d.engageDistance } : {}) };
  }
  if (shared.attack === 'projectile') return {
    ...shared, maxAttackDistance: d.maxAttackDistance, retreatDistance: d.retreatDistance,
    projectile: Object.freeze({ ...shared.projectile, speed: d.projectileSpeed, life: d.projectileLife, radius: d.projectileRadius }),
  };
  return { ...shared, blastRadius: d.blastRadius, maxAttackDistance: d.maxAttackDistance, retreatDistance: d.retreatDistance };
}

// ── State ────────────────────────────────────────────────────────────────────
let kind: EnemyKind = KINDS.includes(q.get('kind') as EnemyKind) ? q.get('kind') as EnemyKind : 'stalker';
let rank: EnemyRank = RANKS.includes(q.get('rank') as EnemyRank) ? q.get('rank') as EnemyRank : 'normal';
let level = boundedNumber(q.get('level'), 8, 1, 100);
let lootSeed = boundedNumber(q.get('seed'), 7331, 0, 4294967295);
let facing = boundedNumber(q.get('facing'), 2, 0, 7) * Math.PI / 4;
let moving = q.get('move') === '1';
let variant = ([0, 1, 2].includes(Number(q.get('variant'))) ? Number(q.get('variant')) : 0) as 0 | 1 | 2;
let deathVariant: DeathVariant = 0;
let draft = draftFrom(ENEMY_DEFINITIONS[kind]);

interface Member { kind: EnemyKind; rank: EnemyRank; level: number; dx: number; dy: number }
let members: Member[] = [
  { kind: 'stalker', rank: 'normal', level: 8, dx: -70, dy: -30 },
  { kind: 'stalker', rank: 'normal', level: 8, dx: 70, dy: -30 },
  { kind: 'brute', rank: 'veteran', level: 9, dx: 0, dy: 55 },
  { kind: 'caster', rank: 'normal', level: 8, dx: 0, dy: -95 },
];
let selectedMember = 0;
let siteKind: 'field' | 'camp' = 'field';

// ── Layout ───────────────────────────────────────────────────────────────────
root.insertAdjacentHTML('beforeend', `<div class="enemy-studio">
<aside class="tool-panel"><label>Find an archetype<input type="search" id="search" placeholder="Name, role, family…" style="width:100%;margin:10px 0"></label>
<div class="tool-list" id="kinds"></div></aside>
<section>
<form class="tool-toolbar" id="author">
<label>Rank <select name="rank">${RANKS.map(r => `<option value="${r}">${ENEMY_RANKS[r].name}</option>`).join('')}</select></label>
<label>Level <input name="level" type="number" min="1" max="100" value="${level}"></label>
<label>Loot seed <input name="seed" type="number" min="0" max="4294967295" value="${lootSeed}"></label>
<label>Facing <select name="facing">${FACING_NAMES.map((n, i) => `<option value="${i}"${i === 2 ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
<label>Attack <select name="variant"><option value="0">Basic</option><option value="1">Signature</option><option value="2">Elite quick</option></select></label>
<label>Stride <select name="move"><option value="0">Idle</option><option value="1">Walking</option></select></label>
<button type="button" id="reroll">Reroll seed</button>
<button type="button" id="reset-draft">Reset definition</button>
</form>
<div class="studio-grid">
<div class="tool-panel">
<canvas id="stage" width="960" height="620" aria-label="Live enemy preview"></canvas>
<div class="phase-readout"><span id="phase-name">Idle</span><output id="phase-time"></output></div>
<div class="tool-toolbar">
<button type="button" id="play">Play attack</button>
<label>Phase <input id="scrub" type="range" min="0" max="1" step="0.001" value="0" style="width:220px"></label>
<label>Speed <select id="speed"><option value="1">1×</option><option value="0.5">½×</option><option value="0.25">¼×</option></select></label>
</div>
<canvas id="facings" width="960" height="168" aria-label="All eight facings"></canvas>
<div class="tool-toolbar" style="margin-bottom:0">
<label>Death <select id="death-variant"></select></label>
<button type="button" id="death-play">Play death</button>
<label>Age <input id="death-scrub" type="range" min="0" max="2.2" step="0.005" value="0" style="width:180px"></label>
</div>
<canvas id="death" width="960" height="300" aria-label="Death animation preview"></canvas>
</div>
<div class="tool-panel">
<h2 id="enemy-title"></h2>
<div class="trait-chips" id="traits"></div>
<div class="stat-grid" id="stats"></div>
<details open><summary>Tune the definition</summary><div class="tune-grid" id="tune"></div></details>
</div>
</div>
<div class="tool-panel" style="margin-top:18px">
<h2>Encounter composer <small id="encounter-count"></small></h2>
<form class="tool-toolbar" id="encounter-form">
<label>Site <select name="site"><option value="field">Open field</option><option value="camp">Wilderness camp</option></select></label>
<label>Formation <select name="formation"><option value="ring">Ring</option><option value="line">Line</option><option value="wedge">Wedge</option><option value="scatter">Scatter</option></select></label>
<button type="button" id="add-member">Add current enemy</button>
<button type="button" id="apply-formation">Apply formation</button>
<button type="button" id="warband">Goblin warband</button>
<button type="button" id="clear-members">Clear</button>
</form>
<div class="member-list" id="members"></div>
<canvas id="encounter-stage" width="1440" height="960" aria-label="Formation preview on generated terrain"></canvas>
<p class="tool-status" id="encounter-status"></p>
</div>
<div class="tool-panel" style="margin-top:18px">
<h2>Export</h2>
<div class="tool-toolbar">
<button type="button" id="export-enemy">Download enemy JSON</button>
<button type="button" id="export-encounter">Download encounter JSON</button>
</div>
<div class="export-grid"><pre id="enemy-json"></pre><pre id="encounter-json"></pre></div>
</div>
</section></div>`);

const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
const author = $('#author') as HTMLFormElement;
const field = (name: string) => author.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
const stage = $('#stage') as HTMLCanvasElement;
const stageCtx = stage.getContext('2d')!;
const facingsCanvas = $('#facings') as HTMLCanvasElement;
const facingsCtx = facingsCanvas.getContext('2d')!;
const deathCanvas = $('#death') as HTMLCanvasElement;
const deathCtx = deathCanvas.getContext('2d')!;
const encounterCanvas = $('#encounter-stage') as HTMLCanvasElement;
const encounterCtx = encounterCanvas.getContext('2d', { alpha: false })!;
const phaseName = $('#phase-name'), phaseTime = $('#phase-time');
const scrubEl = $('#scrub') as HTMLInputElement, deathScrubEl = $('#death-scrub') as HTMLInputElement;
const playBtn = $('#play') as HTMLButtonElement, deathPlayBtn = $('#death-play') as HTMLButtonElement;

// ── Derived definitions and stats ────────────────────────────────────────────
const base = () => ENEMY_DEFINITIONS[kind];
const variantSource = (): EnemyDefinition =>
  variant === 1 ? ENEMY_SIGNATURE_ATTACKS[kind] ?? base()
    : variant === 2 ? ELITE_QUICK_ATTACKS[kind] ?? base() : base();
const previewDef = () => defFromDraft(variantSource(), draft);
const authoredDef = () => defFromDraft(base(), draft);

function effectiveStats(def: EnemyDefinition, forLevel = level, forRank = rank) {
  const quality = ENEMY_RANKS[forRank], elite = (forRank === 'elite' || forRank === 'rare') && !isBossKind(kind);
  return {
    maxHp: Math.max(1, Math.round(def.hp * monsterHealthScale(forLevel) * quality.healthMultiplier * (elite ? eliteDurabilityMultiplier(forLevel) : 1))),
    damage: Math.max(1, Math.round(def.damage * monsterDamageScale(forLevel) * quality.damageMultiplier * enemyThreat({ kind, rank: forRank }).damage)),
    xpReward: Math.max(1, Math.round(def.xpReward * monsterExperienceScale(forLevel) * quality.xpMultiplier)),
  };
}

/** Minimal live Enemy for warning/plate/modifier consumers — never simulated. */
function stagedEnemy(): Enemy {
  const def = authoredDef(), stats = effectiveStats(def);
  const affix = eliteAffix({ kind, rank, lootSeed });
  return {
    id: 1, level, rank, biome: 'verdant', lootSeed,
    damage: stats.damage, xpReward: stats.xpReward,
    x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, knockbackX: 0, knockbackY: 0,
    angle: facing, hp: stats.maxHp, maxHp: stats.maxHp, kind,
    state: 'idle', stateTime: 0, stateDuration: 1, attackAngle: facing,
    attackTargetX: 0, attackTargetY: 0, homeX: 0, homeY: 0,
    awareness: 0, lostSightTime: 0, lastSeenX: 0, lastSeenY: 0, senseTime: 0, seesPlayer: false,
    patrolPhase: 0, hitFlash: 0, hitAngle: 0, radius: def.radius, stagger: 0,
    attackHit: false, interrupted: false, slowTime: 0, slowFactor: 1, burnTime: 0, burnDps: 0, burnTick: 0,
    attackTurns: 0, attackVariant: variant,
    ...(affix ? { affix, affixState: { clock: 0, shielded: 0, stacks: 0 } } : {}),
  };
}

// ── Kind list ────────────────────────────────────────────────────────────────
function listKinds(filter = '') {
  $('#kinds').innerHTML = KINDS
    .filter(k => `${ENEMY_DEFINITIONS[k].name} ${ENEMY_DEFINITIONS[k].role} ${creatureFamily(k)} ${k}`.toLowerCase().includes(filter.toLowerCase()))
    .map(k => `<button data-kind="${k}" aria-pressed="${k === kind}">${e(ENEMY_DEFINITIONS[k].name)}<small>${ENEMY_DEFINITIONS[k].role} · ${creatureFamily(k)}${isBossKind(k) ? ' · boss' : ''}</small></button>`).join('');
}

// ── Tuning controls ──────────────────────────────────────────────────────────
interface TuneField { key: keyof Draft; label: string; min: number; max: number; step: number; when?: (d: EnemyDefinition) => boolean }
const TUNE: TuneField[] = [
  { key: 'hp', label: 'Base life', min: 1, max: 5000, step: 1 },
  { key: 'damage', label: 'Base damage', min: 1, max: 500, step: 1 },
  { key: 'xpReward', label: 'XP reward', min: 1, max: 2000, step: 1 },
  { key: 'radius', label: 'Body radius', min: 4, max: 60, step: 1 },
  { key: 'speed', label: 'Move speed', min: 0, max: 400, step: 1 },
  { key: 'range', label: 'Attack range', min: 0, max: 500, step: 1 },
  { key: 'windup', label: 'Windup s', min: 0, max: 3, step: .01 },
  { key: 'active', label: 'Active s', min: .01, max: 2, step: .01 },
  { key: 'recovery', label: 'Recovery s', min: 0, max: 3, step: .01 },
  { key: 'aimLock', label: 'Aim lock s', min: 0, max: 2, step: .01 },
  { key: 'awarenessDistance', label: 'Awareness', min: 0, max: 1000, step: 5 },
  { key: 'preferredDistance', label: 'Preferred range', min: 0, max: 500, step: 5 },
  { key: 'knockbackDistance', label: 'Knockback taken', min: 0, max: 60, step: 1 },
  { key: 'arc', label: 'Melee arc rad', min: .1, max: Math.PI * 2, step: .01, when: d => d.attack === 'melee' },
  { key: 'lungeSpeed', label: 'Lunge speed', min: 0, max: 400, step: 1, when: d => d.attack === 'melee' },
  { key: 'engageDistance', label: 'Pounce distance (0 = off)', min: 0, max: 300, step: 1, when: d => d.attack === 'melee' },
  { key: 'blastRadius', label: 'Blast radius', min: 10, max: 200, step: 1, when: d => d.attack === 'ground' },
  { key: 'maxAttackDistance', label: 'Max attack distance', min: 0, max: 600, step: 5, when: d => d.attack !== 'melee' },
  { key: 'retreatDistance', label: 'Retreat distance', min: 0, max: 400, step: 5, when: d => d.attack !== 'melee' },
  { key: 'projectileSpeed', label: 'Projectile speed', min: 20, max: 600, step: 5, when: d => d.attack === 'projectile' },
  { key: 'projectileLife', label: 'Projectile life s', min: .2, max: 6, step: .05, when: d => d.attack === 'projectile' },
  { key: 'projectileRadius', label: 'Projectile radius', min: 1, max: 20, step: .5, when: d => d.attack === 'projectile' },
];
function buildTune() {
  const def = authoredDef();
  $('#tune').innerHTML = `<label style="grid-column:1/-1">Display name<input data-name type="text" value="${e(draft.name)}" style="width:100%"></label>` +
    TUNE.filter(t => !t.when || t.when(def)).map(t => {
      const authored = draftFrom(base())[t.key];
      return `<label>${t.label}<span class="tune-row">
      <input data-tune="${t.key}" type="range" min="${t.min}" max="${t.max}" step="${t.step}" value="${draft[t.key]}">
      <input data-num="${t.key}" type="number" min="${t.min}" max="${t.max}" step="${t.step}" value="${draft[t.key]}"></span>
      <span class="tune-base">authored ${typeof authored === 'number' ? (Number.isInteger(authored) ? authored : authored.toFixed(2)) : authored}</span></label>`;
    }).join('');
}

// ── Stat sheet ───────────────────────────────────────────────────────────────
function statSheet() {
  const def = authoredDef(), stats = effectiveStats(def), staged = stagedEnemy();
  const windup = enemyWindupDuration(staged, def.windup), recovery = enemyRecoveryDuration(staged, def.recovery);
  const speed = def.speed * enemyMovementMultiplier(staged);
  const dps = stats.damage / (windup + def.active + recovery);
  const scale = enemyVisualScale(staged);
  const fmt = (n: number) => n.toLocaleString('en-US');
  const cells: [string, string, string][] = [
    ['Life', fmt(stats.maxHp), `base ${def.hp} · ×${(monsterHealthScale(level) * ENEMY_RANKS[rank].healthMultiplier).toFixed(2)}`],
    ['Damage', fmt(stats.damage), `base ${def.damage} · ×${(monsterDamageScale(level) * ENEMY_RANKS[rank].damageMultiplier).toFixed(2)}`],
    ['XP reward', fmt(stats.xpReward), `base ${def.xpReward}`],
    ['Speed', String(Math.round(speed)), `base ${def.speed}`],
    ['Windup', `${windup.toFixed(2)} s`, `authored ${def.windup.toFixed(2)} + rhythm`],
    ['Active', `${def.active.toFixed(2)} s`, 'contact window'],
    ['Recovery', `${recovery.toFixed(2)} s`, `authored ${def.recovery.toFixed(2)} ×${enemyThreat(staged).recovery}`],
    ['Est. DPS', dps.toFixed(1), 'per full attack cycle'],
    ['Attack', def.attack, def.attack === 'melee' ? `arc ${(def.arc / Math.PI).toFixed(2)}π · lunge ${def.lungeSpeed}` : def.attack === 'projectile' ? `${def.projectile.speed} u/s · ${def.shotOffsets.length} shot${def.shotOffsets.length > 1 ? 's' : ''}` : `blast r${def.blastRadius}`],
    ['Range', String(def.range), `preferred ${def.preferredDistance}`],
    ['Awareness', String(def.awarenessDistance), `aim lock ${def.aimLock.toFixed(2)} s`],
    ['Body', `r${def.radius}`, `visual ×${scale.toFixed(2)}`],
    ['Role', def.role, creatureFamily(kind)],
    ['Control', def.interruptible ? 'Interruptible' : 'Uninterruptible', `knockback ${def.knockbackDistance}`],
  ];
  $('#stats').innerHTML = cells.map(([k, v, s]) => `<div class="stat-cell"><small>${k}</small><b>${e(v)}</b><em>${e(s)}</em></div>`).join('');
  const traits: string[] = [`${ENEMY_RANKS[rank].name} rank`];
  if (isBossKind(kind)) traits.push('Boss kind');
  if (staged.affix) traits.push(`${ELITE_AFFIXES[staged.affix].name} affix — ${ELITE_AFFIXES[staged.affix].description}`);
  for (const m of enemyModifiers(staged)) traits.push(`${m.name} trait — ${m.description}`);
  if (ENEMY_SIGNATURE_ATTACKS[kind]) traits.push('Signature attack');
  if (ELITE_QUICK_ATTACKS[kind]) traits.push('Elite quick attack');
  if (def.beast) traits.push(`Tameable · ${def.beast}`);
  $('#traits').innerHTML = traits.map(t => `<span>${e(t)}</span>`).join('');
  $('#enemy-title').textContent = `${draft.name} · Lv ${level} ${ENEMY_RANKS[rank].name}`;
}

// ── Stage preview ────────────────────────────────────────────────────────────
const bg = document.createElement('canvas'); bg.width = 960; bg.height = 620;
{
  const c = bg.getContext('2d')!;
  const wash = c.createRadialGradient(480, 380, 30, 480, 320, 620);
  wash.addColorStop(0, '#223a2e'); wash.addColorStop(.6, '#16261f'); wash.addColorStop(1, '#0d1a17');
  c.fillStyle = wash; c.fillRect(0, 0, 960, 620);
  let s = 831; const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
  for (let i = 0; i < 700; i++) {
    c.fillStyle = `rgba(${140 + rnd() * 60},${150 + rnd() * 50},${110 + rnd() * 40},${.03 + rnd() * .05})`;
    c.fillRect(rnd() * 960, rnd() * 620, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

let attackClock = 0, playing = false, speed = 1, animTime = 0, deathClock = 0, deathPlaying = false;

const fitScale = (top: number, bottom: number, available: number) =>
  Math.min(3.4, Math.max(1.1, available / Math.max(30, Math.abs(top) + bottom)));

/** Draft-accurate telegraphs: same shapes as enemy-warning-art but reading the
 * tuned definition, plus the elite-affix aura and arcane/frozen telegraphs. */
function drawDraftWarning(c: CanvasRenderingContext2D, staged: Enemy, def: EnemyDefinition) {
  if (staged.affix) {
    const color = ELITE_AFFIXES[staged.affix].color, state = staged.affixState;
    const pulse = reduced.matches ? .7 : .7 + Math.sin(animTime * 3.1 + staged.id) * .3;
    c.save();
    c.globalAlpha = .16 * pulse; c.strokeStyle = color; c.lineWidth = 2 / 3;
    c.beginPath(); c.arc(0, 0, staged.radius + 7, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = .1 * pulse;
    c.beginPath(); c.arc(0, 0, staged.radius + 11, 0, Math.PI * 2); c.stroke();
    c.restore();
    if (state && staged.affix === 'arcane') {
      const r = ELITE_AFFIX_RULES.arcane, phase = state.clock % r.period;
      if (phase < r.telegraph + r.active) {
        const telegraphing = phase < r.telegraph;
        c.save(); c.rotate(staged.id * 1.7 + (telegraphing ? 0 : (phase - r.telegraph) * r.revolutionsPerSecond * Math.PI * 2));
        drawAttackWarning(c, { kind: 'lane', length: r.length, width: r.width }, telegraphing ? phase / r.telegraph : 1,
          color, animTime, reduced.matches, !telegraphing, '#ffd1da');
        c.restore();
      }
    } else if (state && staged.affix === 'frozen') {
      const r = ELITE_AFFIX_RULES.frozen;
      if (state.clock >= r.period - r.telegraph)
        drawAttackWarning(c, { kind: 'circle', radius: r.radius }, (state.clock - (r.period - r.telegraph)) / r.telegraph,
          color, animTime, reduced.matches, false, '#ffd1da');
    }
  }
  if (staged.state !== 'windup' && staged.state !== 'attack') return;
  const progress = staged.state === 'attack' ? 1 : Math.min(1, staged.stateTime / Math.max(.01, staged.stateDuration));
  const locked = staged.state === 'attack' || staged.stateTime >= def.aimLock;
  const paint = (shape: WarningShape, angle: number, x = 0, y = 0, color = '#f34e60', lock = locked) => {
    c.save(); c.translate(x, y); c.rotate(angle);
    drawAttackWarning(c, shape, progress, color, animTime + staged.id * .137, reduced.matches, lock, '#ffd1da');
    c.restore();
  };
  if (def.attack === 'ground') paint({ kind: 'circle', radius: def.blastRadius }, 0, staged.attackTargetX, staged.attackTargetY, '#e83d59', true);
  else if (def.attack === 'projectile') { if (def.warning) for (const offset of def.shotOffsets) paint({ kind: 'lane', width: def.projectile.radius, length: def.projectile.speed * def.projectile.life }, staged.attackAngle + offset, 0, 0, '#f34e60', true); }
  else if (def.engageDistance) paint({ kind: 'lane', width: 11, length: def.lungeSpeed * Math.max(0, def.active - (staged.state === 'attack' ? staged.stateTime : 0)) + def.range }, staged.attackAngle);
  else paint({ kind: 'sector', radius: def.range, arc: def.arc }, staged.attackAngle);
}

function drawStage() {
  const W = stage.width, H = stage.height, c = stageCtx;
  c.drawImage(bg, 0, 0);
  const staged = stagedEnemy(), def = previewDef();
  const bounds = ENEMY_BODY_BOUNDS[kind];
  const scale = fitScale(bounds.top, bounds.bottom, H * .52) * enemyVisualScale(staged);
  const ex = W * .36, ey = H * .74;
  const windup = enemyWindupDuration(staged, def.windup), active = def.active, recovery = enemyRecoveryDuration(staged, def.recovery);
  const total = windup + active + recovery;
  const t = Math.min(attackClock, total);
  const phase: 'idle' | 'windup' | 'attack' | 'recover' = !playing && attackClock === 0 ? 'idle'
    : t < windup ? 'windup' : t < windup + active ? 'attack' : 'recover';
  const phaseT = phase === 'windup' ? t : phase === 'attack' ? t - windup : Math.max(0, t - windup - active);
  const phaseDur = phase === 'windup' ? windup : phase === 'attack' ? active : recovery;
  const reach = def.attack === 'melee' ? Math.max(def.range, (def.engageDistance ?? 0) + def.range)
    : def.attack === 'ground' ? Math.min(def.maxAttackDistance, 230) : def.maxAttackDistance * .72;
  const tx = Math.cos(facing) * reach, ty = Math.sin(facing) * reach * .72;
  staged.state = phase === 'windup' ? 'windup' : phase === 'attack' ? 'attack' : 'idle';
  staged.stateTime = phaseT; staged.stateDuration = Math.max(.01, phaseDur);
  staged.attackAngle = facing; staged.attackTargetX = tx; staged.attackTargetY = ty;
  if (staged.affixState) staged.affixState.clock = animTime;

  // Range ring.
  c.save(); c.translate(ex, ey); c.scale(scale, scale);
  c.strokeStyle = '#9fb8a52a'; c.lineWidth = 2 / scale;
  c.beginPath(); c.ellipse(0, 0, def.range, def.range * .72, 0, 0, Math.PI * 2); c.stroke();
  c.restore();

  c.save(); c.translate(ex, ey); c.scale(scale, scale);
  drawDraftWarning(c, staged, def);
  c.restore();

  // Committed target reticle.
  c.save(); c.translate(ex + tx * scale, ey + ty * scale);
  c.strokeStyle = '#e8d9a0aa'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(-13, 0); c.lineTo(-5, 0); c.moveTo(13, 0); c.lineTo(5, 0);
  c.moveTo(0, -13); c.lineTo(0, -5); c.moveTo(0, 13); c.lineTo(0, 5); c.stroke();
  c.restore();

  // Contact shadow + figure.
  c.fillStyle = '#050d1399'; c.beginPath();
  c.ellipse(ex, ey + 3, Math.max(14, staged.radius * scale * 1.4), 7, 0, 0, Math.PI * 2); c.fill();
  const skin = enemyRosterSkin(staged);
  const pose: CharacterPose = {
    kind, angle: facing, time: animTime, effectTime: reduced.matches ? 0 : animTime,
    gaitPhase: animTime * Math.max(20, def.speed) / 13, moveAngle: facing,
    moving: moving && phase === 'idle' ? 1 : 0,
    attack: phase === 'windup' ? -Math.max(.001, phaseT / phaseDur) : phase === 'attack' ? Math.min(1, phaseT / phaseDur) : 0,
    attackAngle: facing, hitFlash: 0, dodging: false,
    ...(skin?.tint ? { tint: skin.tint, tintAmount: skin.tintAmount } : {}),
  };
  c.save(); c.translate(ex, ey); c.scale(scale, scale); drawHumanoid(c, pose); c.restore();

  // Projectile / blast / swing dressing during the active window.
  if (phase === 'attack') {
    const p = Math.min(1, phaseT / active);
    if (def.attack === 'projectile') {
      const color = STYLE_COLORS[def.projectileStyle] ?? '#e8d9a0';
      for (const offset of def.shotOffsets) {
        const a = facing + offset, dist = def.projectile.speed * phaseT;
        const px = ex + Math.cos(a) * dist * scale, py = ey + Math.sin(a) * dist * scale * .72;
        c.save(); c.globalAlpha = .9;
        c.strokeStyle = color; c.lineWidth = 2;
        c.beginPath(); c.moveTo(px - Math.cos(a) * 14, py - Math.sin(a) * 10); c.lineTo(px, py); c.stroke();
        c.fillStyle = color; c.beginPath(); c.arc(px, py, def.projectile.radius * scale * .55 + 1.5, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    } else if (def.attack === 'ground') {
      const color = STYLE_COLORS[def.blastStyle ?? 'fire'] ?? '#ffac63';
      c.save(); c.translate(ex + tx * scale, ey + ty * scale);
      c.globalAlpha = .55 * (1 - p * .6);
      c.fillStyle = color; c.beginPath(); c.arc(0, 0, def.blastRadius * scale * (.3 + .7 * p), 0, Math.PI * 2); c.fill();
      c.globalAlpha = .8; c.strokeStyle = '#fff0d6'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(0, 0, def.blastRadius * scale, 0, Math.PI * 2); c.stroke();
      c.restore();
    } else {
      c.save(); c.translate(ex, ey); c.rotate(facing); c.scale(scale, scale);
      c.globalAlpha = .4 * (1 - p);
      c.fillStyle = '#ffe9c8';
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, def.range, -def.arc / 2, def.arc / 2); c.closePath(); c.fill();
      c.restore();
    }
  }

  drawEnemyPlate(c, staged, W, H);

  const fellBack = (variant === 1 && !ENEMY_SIGNATURE_ATTACKS[kind]) || (variant === 2 && !ELITE_QUICK_ATTACKS[kind]);
  const variantLabel = fellBack ? 'basic' : variant === 1 ? 'signature' : variant === 2 ? 'elite quick' : 'basic';
  phaseName.textContent = phase === 'idle'
    ? `Idle — press Play attack or scrub · ${def.name} (${variantLabel} ${def.attack})`
    : `${phase[0].toUpperCase()}${phase.slice(1)} ${phaseT.toFixed(2)} / ${phaseDur.toFixed(2)} s · ${def.name} (${variantLabel} ${def.attack})`;
  phaseTime.textContent = `cycle ${total.toFixed(2)} s · windup ${windup.toFixed(2)} · active ${active.toFixed(2)} · recovery ${recovery.toFixed(2)}`;
  if (document.activeElement !== scrubEl) scrubEl.value = String(total ? t / total : 0);
}

function drawFacings() {
  const c = facingsCtx, W = facingsCanvas.width, H = facingsCanvas.height;
  c.clearRect(0, 0, W, H);
  const staged = stagedEnemy(), bounds = ENEMY_BODY_BOUNDS[kind];
  const scale = fitScale(bounds.top, bounds.bottom, H * .6) * enemyVisualScale(staged) * .8;
  const skin = enemyRosterSkin(staged);
  for (let i = 0; i < 8; i++) {
    const cx = (i + .5) * W / 8, gy = H - 34;
    c.fillStyle = '#050d1399'; c.beginPath(); c.ellipse(cx, gy + 3, 16, 5, 0, 0, Math.PI * 2); c.fill();
    const pose: CharacterPose = {
      kind, angle: i * Math.PI / 4, time: animTime + i * .7, moving: moving ? 1 : 0,
      gaitPhase: animTime * 6 + i, attack: 0, attackAngle: i * Math.PI / 4, hitFlash: 0, dodging: false,
      ...(skin?.tint ? { tint: skin.tint, tintAmount: skin.tintAmount } : {}),
    };
    c.save(); c.translate(cx, gy); c.scale(scale, scale); drawHumanoid(c, pose); c.restore();
    c.fillStyle = '#8fa49e'; c.font = '11px system-ui'; c.textAlign = 'center';
    c.fillText(FACING_NAMES[i], cx, H - 8);
  }
}

function drawDeath() {
  const c = deathCtx, W = deathCanvas.width, H = deathCanvas.height;
  c.clearRect(0, 0, W, H);
  c.drawImage(bg, 0, 160, W, 300, 0, 0, W, H);
  const recipe = ENEMY_DEATHS[kind][deathVariant];
  const staged = stagedEnemy(), bounds = ENEMY_BODY_BOUNDS[kind];
  const scale = fitScale(bounds.top, bounds.bottom, H * .68) * enemyVisualScale(staged);
  const age = Math.min(deathClock, recipe.settle + .4);
  c.save(); c.translate(W * .5, H * .78); c.scale(scale, scale);
  drawDeathFigure(c, kind, deathVariant, age, facing);
  c.restore();
  c.fillStyle = '#8fa49e'; c.font = '13px system-ui'; c.textAlign = 'left';
  c.fillText(`${recipe.title} — ${recipe.sequence}`, 14, 24);
  c.fillText(age < .12 ? 'Impact' : age < recipe.contact ? 'Falling' : age < recipe.settle ? 'Settling' : 'At rest', 14, 44);
  deathScrubEl.max = String(recipe.settle + .4);
  if (document.activeElement !== deathScrubEl) deathScrubEl.value = String(age);
}

// ── Encounter composer ───────────────────────────────────────────────────────
const world = new World(7319);
const renderer = new Renderer();
const display = document.createElement('canvas'); display.width = 1440; display.height = 960;
const fx = new PostFX(display);
const sites = world.getWildernessSites(-8000, -8000, 16000, 16000);
const campSite: WildernessSite | undefined = sites.find(s => s.kind === 'camp');
let fieldAnchor = { x: 0, y: 0 };
{
  let best = -1;
  for (let i = 0; i < 49; i++) {
    const x = (i % 7 - 3) * 220, y = (Math.floor(i / 7) - 3) * 220;
    if (world.blocked(x, y, 16)) continue;
    let score = 0;
    for (let j = 0; j < 12; j++) if (!world.blocked(x + Math.cos(j * Math.PI / 6) * 140, y + Math.sin(j * Math.PI / 6) * 140, 20)) score++;
    if (score > best) { best = score; fieldAnchor = { x, y }; }
    if (best === 12) break;
  }
}
const anchor = () => siteKind === 'camp' && campSite ? { x: campSite.x, y: campSite.y } : fieldAnchor;

function renderMembers() {
  $('#encounter-count').textContent = `${members.length} member${members.length === 1 ? '' : 's'}`;
  $('#members').innerHTML = members.map((m, i) => `<div class="member" data-member="${i}" aria-current="${i === selectedMember}">
    <div><span class="member-name">${e(ENEMY_DEFINITIONS[m.kind].name)}</span> <small>Lv ${m.level} ${ENEMY_RANKS[m.rank].name} · ${m.dx},${m.dy}</small></div>
    <div class="member-controls">
      <select data-m-rank="${i}">${RANKS.map(r => `<option value="${r}"${r === m.rank ? ' selected' : ''}>${ENEMY_RANKS[r].name}</option>`).join('')}</select>
      <button type="button" data-m-remove="${i}" aria-label="Remove">✕</button>
    </div>
    <div class="member-xy">offset <input type="number" data-m-dx="${i}" value="${m.dx}" step="5"> <input type="number" data-m-dy="${i}" value="${m.dy}" step="5">
    level <input type="number" data-m-level="${i}" value="${m.level}" min="1" max="100" step="1">
    <small>click the scene to move the selected member</small></div>
  </div>`).join('');
}

function renderEncounter() {
  const a = anchor();
  const sim = new Simulation(world, { seed: 7319, spawn: false, startX: a.x, startY: a.y + 158 });
  sim.time = 22.5; sim.player.angle = -Math.PI / 2;
  let blocked = 0;
  for (const m of members) {
    let enemy: Enemy | null = null;
    for (let ring = 0; ring <= 4 && !enemy; ring++)
      for (let s = 0; s < Math.max(1, ring * 6) && !enemy; s++) {
        const ang = s / Math.max(1, ring * 6) * Math.PI * 2;
        enemy = sim.spawnEnemy(m.kind, a.x + m.dx + Math.round(Math.cos(ang) * ring * 18), a.y + m.dy + Math.round(Math.sin(ang) * ring * 18), m.rank);
      }
    if (!enemy) { blocked++; continue; }
    const stats = applyEnemyModifiers(scaledEnemyStats(m.kind, m.level, m.rank), { kind: m.kind, rank: m.rank, lootSeed: enemy.lootSeed });
    Object.assign(enemy, stats, { level: m.level, hp: stats.maxHp });
    enemy.angle = Math.atan2(-m.dy, -m.dx || .001); enemy.attackAngle = enemy.angle;
  }
  renderer.reset(); renderer.resize(720, 480, 1440, 960);
  renderer.cameraX = a.x; renderer.cameraY = a.y;
  renderer.render(sim, world, 0.12, { phase: 'playing', reducedMotion: false });
  fx.render(renderer.canvas, 0);
  encounterCtx.setTransform(1, 0, 0, 1, 0, 0);
  encounterCtx.drawImage(display, 0, 0);
  const m = members[selectedMember];
  if (m) {
    encounterCtx.strokeStyle = '#e8d9a0'; encounterCtx.lineWidth = 3;
    encounterCtx.beginPath(); encounterCtx.arc(720 + m.dx * 2, 480 + m.dy * 2, 26, 0, Math.PI * 2); encounterCtx.stroke();
  }
  $('#encounter-status').textContent =
    `${members.length} staged at ${siteKind === 'camp' && campSite ? `camp “${campSite.name}”` : 'open field'} · ${a.x}, ${a.y}${blocked ? ` · ${blocked} blocked by terrain` : ''} · frozen scene, no simulation ticks`;
}

// ── Export ───────────────────────────────────────────────────────────────────
function enemyJSON() {
  const def = authoredDef(), stats = effectiveStats(def), staged = stagedEnemy();
  return {
    kind, name: draft.name, rank, level, lootSeed,
    boss: isBossKind(kind), role: def.role, family: creatureFamily(kind),
    definition: def,
    effective: {
      ...stats,
      speed: Math.round(def.speed * enemyMovementMultiplier(staged)),
      windup: Number(enemyWindupDuration(staged, def.windup).toFixed(3)),
      recovery: Number(enemyRecoveryDuration(staged, def.recovery).toFixed(3)),
      visualScale: Number(enemyVisualScale(staged).toFixed(3)),
    },
    signature: ENEMY_SIGNATURE_ATTACKS[kind] ?? null,
    eliteQuick: ELITE_QUICK_ATTACKS[kind] ?? null,
    affix: staged.affix ?? null,
    traits: enemyModifiers(staged).map(m => m.id),
  };
}
function encounterJSON() {
  const a = anchor();
  return {
    site: siteKind, anchor: a, seed: 7319,
    members: members.map(m => ({
      ...m, x: a.x + m.dx, y: a.y + m.dy,
      name: ENEMY_DEFINITIONS[m.kind].name,
      effective: scaledEnemyStats(m.kind, m.level, m.rank),
    })),
  };
}
function refreshExport() {
  $('#enemy-json').textContent = JSON.stringify(enemyJSON(), null, 2);
  $('#encounter-json').textContent = JSON.stringify(encounterJSON(), null, 2);
}

// ── Refresh pipeline ─────────────────────────────────────────────────────────
function refresh() {
  statSheet(); drawStage(); drawFacings(); drawDeath(); refreshExport();
  const params = new URLSearchParams({
    kind, rank, level: String(level), seed: String(lootSeed),
    facing: String(Math.round(facing / (Math.PI / 4))), move: moving ? '1' : '0', variant: String(variant),
  });
  history.replaceState(null, '', `?${params}`);
  reportRoute();
}

// ── Events ───────────────────────────────────────────────────────────────────
$('#kinds').addEventListener('click', ev => {
  const b = (ev.target as Element).closest<HTMLElement>('[data-kind]');
  if (!b) return;
  kind = b.dataset.kind as EnemyKind;
  draft = draftFrom(base());
  if (variant === 1 && !ENEMY_SIGNATURE_ATTACKS[kind]) variant = 0;
  if (variant === 2 && !ELITE_QUICK_ATTACKS[kind]) variant = 0;
  (field('variant') as HTMLSelectElement).value = String(variant);
  deathVariant = 0; attackClock = 0; playing = false; playBtn.textContent = 'Play attack';
  deathClock = 0; deathPlaying = false; deathPlayBtn.textContent = 'Play death';
  listKinds(($('#search') as HTMLInputElement).value); buildTune(); deathOptions(); refresh();
}, { signal: abort.signal });
($('#search') as HTMLInputElement).addEventListener('input', ev => listKinds((ev.target as HTMLInputElement).value), { signal: abort.signal });

author.addEventListener('submit', ev => ev.preventDefault());
author.addEventListener('change', () => {
  rank = field('rank').value as EnemyRank;
  level = boundedNumber(field('level').value, level, 1, 100);
  lootSeed = boundedNumber(field('seed').value, lootSeed, 0, 4294967295);
  facing = boundedNumber(field('facing').value, 2, 0, 7) * Math.PI / 4;
  variant = Number(field('variant').value) as 0 | 1 | 2;
  moving = field('move').value === '1';
  attackClock = 0;
  refresh();
});
$('#reroll').addEventListener('click', () => {
  lootSeed = (Math.random() * 4294967296) >>> 0;
  (field('seed') as HTMLInputElement).value = String(lootSeed);
  refresh();
}, { signal: abort.signal });
$('#reset-draft').addEventListener('click', () => { draft = draftFrom(base()); buildTune(); refresh(); }, { signal: abort.signal });

$('#tune').addEventListener('input', ev => {
  const el = ev.target as HTMLInputElement;
  if (el.dataset.name !== undefined) { draft.name = el.value || base().name; statSheet(); refreshExport(); return; }
  const key = (el.dataset.tune ?? el.dataset.num) as keyof Draft | undefined;
  if (!key) return;
  const v = Number(el.value);
  if (!Number.isFinite(v)) return;
  (draft as Record<keyof Draft, string | number>)[key] = v;
  const row = el.closest('.tune-row')!;
  for (const input of row.querySelectorAll<HTMLInputElement>('input')) if (input !== el) input.value = String(v);
  statSheet(); drawStage(); drawFacings(); refreshExport();
}, { signal: abort.signal });

const cycleTotal = () => {
  const staged = stagedEnemy(), def = previewDef();
  return enemyWindupDuration(staged, def.windup) + def.active + enemyRecoveryDuration(staged, def.recovery);
};
playBtn.addEventListener('click', () => {
  if (playing) { playing = false; playBtn.textContent = 'Play attack'; return; }
  if (attackClock >= cycleTotal()) attackClock = 0;
  playing = true; playBtn.textContent = 'Pause';
}, { signal: abort.signal });
scrubEl.addEventListener('input', () => {
  attackClock = Number(scrubEl.value) * cycleTotal();
  playing = false; playBtn.textContent = 'Play attack';
  drawStage();
}, { signal: abort.signal });
$('#speed').addEventListener('change', ev => { speed = Number((ev.target as HTMLSelectElement).value); }, { signal: abort.signal });

function deathOptions() {
  const sel = $('#death-variant') as HTMLSelectElement;
  sel.innerHTML = DEATH_VARIANTS.map(v => `<option value="${v}">${e(ENEMY_DEATHS[kind][v].title)}</option>`).join('');
  sel.value = String(deathVariant);
}
$('#death-variant').addEventListener('change', ev => { deathVariant = Number((ev.target as HTMLSelectElement).value) as DeathVariant; deathClock = 0; drawDeath(); }, { signal: abort.signal });
deathPlayBtn.addEventListener('click', () => {
  if (deathPlaying) { deathPlaying = false; deathPlayBtn.textContent = 'Play death'; return; }
  if (deathClock >= ENEMY_DEATHS[kind][deathVariant].settle + .9) deathClock = 0;
  deathPlaying = true; deathPlayBtn.textContent = 'Pause';
}, { signal: abort.signal });
deathScrubEl.addEventListener('input', () => {
  deathClock = Number(deathScrubEl.value);
  deathPlaying = false; deathPlayBtn.textContent = 'Play death';
  drawDeath();
}, { signal: abort.signal });

// Encounter events
const encounterForm = $('#encounter-form') as HTMLFormElement;
const efield = (name: string) => encounterForm.elements.namedItem(name) as HTMLSelectElement;
encounterForm.addEventListener('submit', ev => ev.preventDefault());
encounterForm.addEventListener('change', ev => {
  if ((ev.target as Element).closest('[name=site]')) { siteKind = efield('site').value as 'field' | 'camp'; renderEncounter(); }
});
$('#add-member').addEventListener('click', () => {
  members.push({ kind, rank, level, dx: (members.length % 5 - 2) * 55, dy: Math.floor(members.length / 5) * 55 - 60 });
  selectedMember = members.length - 1;
  renderMembers(); renderEncounter(); refreshExport();
}, { signal: abort.signal });
$('#apply-formation').addEventListener('click', () => {
  const f = efield('formation').value, n = members.length;
  members.forEach((m, i) => {
    if (f === 'ring') { const a = i / Math.max(1, n) * Math.PI * 2 - Math.PI / 2; m.dx = Math.round(Math.cos(a) * 110); m.dy = Math.round(Math.sin(a) * 110); }
    else if (f === 'line') { m.dx = Math.round((i - (n - 1) / 2) * 60); m.dy = 0; }
    else if (f === 'wedge') { const row = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2), col = i - row * (row + 1) / 2; m.dx = Math.round((col - row / 2) * 62); m.dy = Math.round(row * 58 - 60); }
    else { m.dx = Math.round((Math.random() - .5) * 260); m.dy = Math.round((Math.random() - .5) * 200); }
  });
  renderMembers(); renderEncounter(); refreshExport();
}, { signal: abort.signal });
$('#warband').addEventListener('click', () => {
  members = [{ kind: 'goblinChief', rank: 'elite', level, dx: 0, dy: 0 }];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    members.push({ kind: 'goblin', rank: 'normal', level, dx: Math.round(Math.cos(a) * 115), dy: Math.round(Math.sin(a) * 115) });
  }
  selectedMember = 0;
  renderMembers(); renderEncounter(); refreshExport();
}, { signal: abort.signal });
$('#clear-members').addEventListener('click', () => { members = []; selectedMember = -1; renderMembers(); renderEncounter(); refreshExport(); }, { signal: abort.signal });
$('#members').addEventListener('click', ev => {
  const el = ev.target as Element;
  const remove = el.closest<HTMLElement>('[data-m-remove]');
  if (remove) { members.splice(Number(remove.dataset.mRemove), 1); selectedMember = Math.min(selectedMember, members.length - 1); renderMembers(); renderEncounter(); refreshExport(); return; }
  const row = el.closest<HTMLElement>('[data-member]');
  if (row) { selectedMember = Number(row.dataset.member); renderMembers(); renderEncounter(); }
}, { signal: abort.signal });
$('#members').addEventListener('change', ev => {
  const el = ev.target as HTMLInputElement | HTMLSelectElement;
  if (el.dataset.mRank !== undefined) members[Number(el.dataset.mRank)].rank = el.value as EnemyRank;
  else if (el.dataset.mLevel !== undefined) members[Number(el.dataset.mLevel)].level = boundedNumber(el.value, members[Number(el.dataset.mLevel)].level, 1, 100);
  else if (el.dataset.mDx !== undefined) members[Number(el.dataset.mDx)].dx = Number(el.value) || 0;
  else if (el.dataset.mDy !== undefined) members[Number(el.dataset.mDy)].dy = Number(el.value) || 0;
  else return;
  renderMembers(); renderEncounter(); refreshExport();
}, { signal: abort.signal });
encounterCanvas.addEventListener('click', ev => {
  const m = members[selectedMember];
  if (!m) return;
  const r = encounterCanvas.getBoundingClientRect();
  m.dx = Math.round(((ev.clientX - r.left) / r.width * 1440 - 720) / 2);
  m.dy = Math.round(((ev.clientY - r.top) / r.height * 960 - 480) / 2);
  renderMembers(); renderEncounter(); refreshExport();
}, { signal: abort.signal });

$('#export-enemy').addEventListener('click', () => downloadJSON(`evergrow-enemy-${kind}.json`, enemyJSON()), { signal: abort.signal });
$('#export-encounter').addEventListener('click', () => downloadJSON('evergrow-encounter.json', encounterJSON()), { signal: abort.signal });

// ── Animation loop ───────────────────────────────────────────────────────────
let raf = 0, last = 0, disposed = false;
function frame(now: number) {
  if (disposed) return;
  const dt = Math.min(.05, last ? (now - last) / 1000 : 0); last = now;
  if (!document.hidden) {
    animTime += dt;
    if (playing) {
      attackClock += dt * speed;
      if (attackClock >= cycleTotal() + .5) attackClock = 0;
    }
    if (deathPlaying) {
      deathClock += dt * speed;
      if (deathClock >= ENEMY_DEATHS[kind][deathVariant].settle + .9) deathClock = 0;
    }
    drawStage(); drawFacings(); drawDeath();
  }
  raf = requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { last = 0; }, { signal: abort.signal });

function dispose() {
  if (disposed) return;
  disposed = true; cancelAnimationFrame(raf); abort.abort();
  renderer.reset(); fx.dispose(); world.dispose();
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);

// ── Boot ─────────────────────────────────────────────────────────────────────
(field('rank') as HTMLSelectElement).value = rank;
(field('level') as HTMLInputElement).value = String(level);
(field('seed') as HTMLInputElement).value = String(lootSeed);
(field('facing') as HTMLSelectElement).value = String(Math.round(facing / (Math.PI / 4)));
(field('variant') as HTMLSelectElement).value = String(variant);
(field('move') as HTMLSelectElement).value = moving ? '1' : '0';
listKinds(); buildTune(); deathOptions(); renderMembers(); renderEncounter(); refresh();
raf = requestAnimationFrame(frame);
