import './character-studio.css';
import { toolPage, downloadJSON } from './common.ts';
import { WOW_RACES } from '../wow-races.ts';
import { WOW_RACE_IDS, isWowRaceId, type WowRaceId, type WowRaceVisual } from '../wow-types.ts';
import { ACCESSORIES, FACIAL_HAIR, HAIR_PALETTES, HAIR_STYLES, RACE_FEATURES, RACE_FEATURE_OPTIONS, SKIN_PALETTES, type RaceFeatureId } from '../appearance-content.ts';
import { createRaceLook } from '../character-look.ts';
import { createCharacterSheet, generateItem, TIER_NAMES } from '../items.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../weapon-content.ts';
import { FOCUS_PROFILES } from '../focus-content.ts';
import { itemMaterialPool, ITEM_MATERIALS, type ItemMaterialId } from '../item-materials.ts';
import { outfitFromEquipment } from '../item-art.ts';
import { UNARMED_WEAPON, weaponActionRate } from '../equipment.ts';
import { BASIC_ATTACK_PHASES, RANGED_BASIC_ATTACK_PHASES, PLAYER_MOVEMENT } from '../combat-content.ts';
import { characterBounds, fitCharacter, type CharacterBounds } from '../character-framing.ts';
import { drawHumanoid, type CharacterPose } from '../art.ts';
import { text } from '../font.ts';
import { escapeUI as e } from '../ui-components.ts';
import type { Item, ItemTier } from '../character-types.ts';
import type { WeaponDefinition } from '../model.ts';

const root = await toolPage('Character studio',
  'Compose a hero from the real race, appearance and item rules, tune the race silhouette live, then export the recipe. Everything stays in this study — no saves.');

// The race visual record is frozen content, so the studio poses as a synthetic
// race id resolved through the prototype chain: WOW_RACES[STUDIO_RACE] reaches a
// mutable def whose `visual` the sliders rewrite. Every renderer (art.ts,
// character-motion.ts, player-art.ts, appearance-*.ts, character-framing.ts)
// reads WOW_RACES[pose.raceId].visual, so each override lands in the real rig.
const STUDIO_RACE = 'studio:custom' as WowRaceId;
const raceProto = Object.getPrototypeOf(WOW_RACES) as Record<string, unknown>;
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const raceParam = new URLSearchParams(location.search).get('race');
const initialRace: WowRaceId = raceParam && isWowRaceId(raceParam) ? raceParam : 'human';
const state = {
  race: initialRace,
  appearance: createRaceLook(initialRace).appearance,
  visual: { ...WOW_RACES[initialRace].visual } as Mutable<WowRaceVisual>,
  gear: { weapon: null as Item | null, offhand: null as Item | null, head: null as Item | null, chest: null as Item | null,
    gloves: null as Item | null, legs: null as Item | null, boots: null as Item | null, cloak: null as Item | null },
  gearSeed: 7319, gearLevel: 10, gearTier: 'rare' as ItemTier,
  motion: 'idle' as 'idle' | 'walk' | 'attack' | 'cast',
  playing: !matchMedia('(prefers-reduced-motion: reduce)').matches,
  elapsed: 0, speed: 1, facing: 2,
};

function installRaceDef() {
  state.visual = { ...WOW_RACES[state.race].visual } as Mutable<WowRaceVisual>;
  Object.defineProperty(raceProto, STUDIO_RACE, {
    configurable: true, writable: true, enumerable: false,
    value: { ...WOW_RACES[state.race], visual: state.visual },
  });
}
installRaceDef();

const ARMOR_SLOTS = [
  ['head', 'Head'], ['chest', 'Chest'], ['gloves', 'Gloves'], ['legs', 'Legs'], ['boots', 'Boots'], ['cloak', 'Cloak'],
] as const;
type ArmorSlot = typeof ARMOR_SLOTS[number][0];
const SLOT_SALT: Record<ArmorSlot, number> = { head: 11, chest: 23, gloves: 37, legs: 41, boots: 53, cloak: 67 };
const DIRECTIONS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const VISUAL_SLIDERS = [
  ['height', 'Height', 0.5, 1.6], ['width', 'Width', 0.6, 1.7], ['bulk', 'Bulk', 0.5, 1.8],
  ['hunch', 'Hunch', 0, 1], ['headScale', 'Head scale', 0.6, 1.8], ['eyeScale', 'Eye scale', 0.5, 2],
] as const;
const MOTIONS = [['idle', 'Idle'], ['walk', 'Walk'], ['attack', 'Attack'], ['cast', 'Cast']] as const;
const APPEARANCE_FIELDS = ['skin', 'hair', 'hairColor', 'facialHair', 'accessory'] as const;

const offhandOptions = [
  ...SHIELD_PROFILES.map(p => ({ value: `shield:${p.id}`, label: `Shield · ${p.name}` })),
  ...FOCUS_PROFILES.map(p => ({ value: `focus:${p.id}`, label: `${p.visual.kind === 'orb' ? 'Orb' : 'Grimoire'} · ${p.name}` })),
  ...WEAPON_PROFILES.filter(p => p.hands === 1).map(p => ({ value: `dual:${p.id}`, label: `Dual · ${p.name}` })),
];

root.insertAdjacentHTML('beforeend', `<div class="studio-layout">
<div class="studio-controls">
  <section class="tool-panel"><h2>Character</h2>
    <label><span>Race</span><select id="race">${WOW_RACE_IDS.map(id => `<option value="${id}">${e(WOW_RACES[id].name)}</option>`).join('')}</select></label>
    <label><span>Skin tone</span><select id="skin"></select></label>
    <label><span>Hairstyle</span><select id="hair">${HAIR_STYLES.map(h => `<option value="${h.id}">${e(h.name)}</option>`).join('')}</select></label>
    <label><span>Hair color</span><select id="hairColor">${HAIR_PALETTES.map(h => `<option value="${h.id}">${e(h.name)}</option>`).join('')}</select></label>
    <label><span>Facial hair</span><select id="facialHair">${FACIAL_HAIR.map(f => `<option value="${f.id}">${e(f.name)}</option>`).join('')}</select></label>
    <label><span>Accessory</span><select id="accessory">${ACCESSORIES.map(a => `<option value="${a.id}">${e(a.name)}</option>`).join('')}</select></label>
    <label><span>Race feature</span><select id="feature"></select></label>
  </section>
  <section class="tool-panel"><h2>Race visual</h2>
    ${VISUAL_SLIDERS.map(([key, label, min, max]) =>
      `<label><span>${label}<output id="out-${key}"></output></span><input id="vis-${key}" type="range" min="${min}" max="${max}" step="0.01"></label>`).join('')}
    <button id="reset-visual" type="button">Reset race defaults</button>
  </section>
  <section class="tool-panel"><h2>Equipment</h2>
    <div class="studio-row">
      <label><span>Seed</span><input id="gear-seed" type="number" min="0" max="4294967295" value="${state.gearSeed}"></label>
      <label><span>Item level</span><input id="gear-level" type="number" min="1" max="1000000" value="${state.gearLevel}"></label>
      <label><span>Rarity</span><select id="gear-tier">${Object.entries(TIER_NAMES).filter(([id]) => id !== 'unique').map(([id, name]) => `<option value="${id}">${e(name)}</option>`).join('')}</select></label>
    </div>
    <label><span>Weapon</span><select id="weapon"><option value="unarmed">Unarmed</option>${WEAPON_PROFILES.map(p => `<option value="${p.id}">${e(p.name)}</option>`).join('')}</select></label>
    <label><span>Off-hand</span><select id="offhand"><option value="none">None</option>${offhandOptions.map(o => `<option value="${o.value}">${e(o.label)}</option>`).join('')}</select></label>
    ${ARMOR_SLOTS.map(([slot, label]) => `<label><span>${label}</span><select id="armor-${slot}"><option value="">None</option></select></label>`).join('')}
    <button id="regen" type="button">Regenerate equipment</button>
  </section>
</div>
<div class="studio-preview">
  <section class="tool-panel">
    <div class="studio-motion">
      <label><span>Motion</span><select id="motion">${MOTIONS.map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</select></label>
      <button id="play" type="button">Pause</button>
      <label><span>Speed</span><select id="speed"><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label>
      <label class="studio-scrub"><span>Phase <output id="phase-out">0%</output></span><input id="phase" type="range" min="0" max="1" step="0.001" value="0"></label>
      <label><span>Facing</span><select id="facing">${DIRECTIONS.map((d, i) => `<option value="${i}"${i === state.facing ? ' selected' : ''}>${d}</option>`).join('')}</select></label>
    </div>
    <figure class="studio-hero"><canvas id="hero" role="img" aria-label="Composed character at the selected facing"></canvas></figure>
    <div class="studio-facings" id="facings"></div>
    <p class="tool-status" id="status"></p>
  </section>
  <section class="tool-panel studio-export"><h2>Export</h2>
    <div class="studio-row">
      <button id="copy" type="button">Copy JSON</button>
      <button id="download" type="button">Download JSON</button>
      <button id="png" type="button">Save PNG</button>
    </div>
    <pre id="export-json"></pre>
  </section>
</div>
</div>`);

const control = <T extends HTMLElement = HTMLSelectElement>(id: string) => root.querySelector<T>(`#${id}`)!;
const abort = new AbortController();
let disposed = false, dirty = true, raf = 0, last = 0;
const envelopes: CharacterBounds[] = [];
let outfitSheet = createCharacterSheet('warrior', initialRace);

for (const [slot] of ARMOR_SLOTS)
  control<HTMLSelectElement>(`armor-${slot}`).innerHTML = '<option value="">None</option>'
    + itemMaterialPool(slot).map(m => `<option value="${m.id}">${e(ITEM_MATERIALS[m.id].name)}</option>`).join('');

function syncAppearanceControls() {
  const race = WOW_RACES[state.race];
  control('race').value = state.race;
  control('skin').innerHTML = race.skinTones.map(id => `<option value="${id}">${e(SKIN_PALETTES.find(p => p.id === id)?.name ?? id)}</option>`).join('');
  const features = RACE_FEATURE_OPTIONS[state.race] ?? [];
  control('feature').innerHTML = '<option value="">None</option>'
    + features.map(id => `<option value="${id}">${e(RACE_FEATURES.find(f => f.id === id)?.name ?? id)}</option>`).join('');
  control('feature').disabled = !features.length;
  for (const key of APPEARANCE_FIELDS) control(key).value = state.appearance[key];
  control('feature').value = state.appearance.feature ?? '';
  for (const [key, , min, max] of VISUAL_SLIDERS) {
    const value = state.visual[key] ?? (key === 'hunch' ? 0 : 1);
    control<HTMLInputElement>(`vis-${key}`).value = String(Math.max(min, Math.min(max, value)));
    control(`out-${key}`).textContent = value.toFixed(2);
  }
  control('reset-visual').textContent = `Reset to ${race.name} defaults`;
}

function weaponDef(): WeaponDefinition {
  return state.gear.weapon?.weapon ?? UNARMED_WEAPON;
}
function period(): number {
  if (state.motion === 'walk') return Math.PI * 2 * PLAYER_MOVEMENT.gaitDistance / PLAYER_MOVEMENT.speed;
  if (state.motion === 'attack') return 1 / weaponActionRate(weaponDef());
  return state.motion === 'idle' ? Math.PI * 2 / 1.8 : 1.6;
}
const cycleAt = (t: number) => (t / period()) % 1;

function poseAt(angle: number, t: number): CharacterPose {
  const weapon = weaponDef();
  const cycle = cycleAt(t);
  const ranged = weapon.attackKind !== 'melee';
  const phases = ranged ? RANGED_BASIC_ATTACK_PHASES : BASIC_ATTACK_PHASES;
  const off = state.gear.offhand;
  return {
    kind: 'player', angle, time: t, moving: state.motion === 'walk' ? 1 : 0,
    moveAngle: angle, gaitPhase: state.motion === 'walk' ? t * PLAYER_MOVEMENT.speed / PLAYER_MOVEMENT.gaitDistance : undefined,
    attack: state.motion === 'attack' ? cycle : 0, attackAngle: angle,
    attackKind: ranged ? 'ranged' : 'melee', attackStart: phases.activeStart, attackEnd: phases.activeEnd, attackArc: weapon.arc,
    cast: state.motion === 'cast' ? cycle : 0,
    weapon: weapon.visual, grip: weapon.hands === 1 ? 'one-handed' : 'two-handed',
    offHand: weapon.hands === 2 || !off ? null
      : off.shield ? { kind: 'shield', visual: off.shield.visual }
      : off.focus ? { kind: 'focus', visual: off.focus.visual }
      : off.weapon ? { kind: 'weapon', visual: off.weapon.visual } : null,
    raceId: STUDIO_RACE, appearance: state.appearance, outfit: outfitFromEquipment(outfitSheet),
    hitFlash: 0, dodging: false,
  };
}

function regenGear() {
  try {
    const seed = state.gearSeed >>> 0, level = state.gearLevel, tier = state.gearTier;
    const weaponSel = control('weapon').value;
    state.gear.weapon = weaponSel === 'unarmed' ? null : generateItem(seed, level, 'weapon', weaponSel, tier);
    const offSel = control('offhand').value;
    const [offKind, offProfile] = offSel.split(':');
    state.gear.offhand = offSel === 'none' ? null
      : generateItem(seed + 5, level,
        offKind === 'dual' ? 'weapon' : offKind === 'shield' ? 'shield' : FOCUS_PROFILES.find(p => p.id === offProfile)?.visual.kind ?? 'orb',
        offProfile, tier);
    for (const [slot] of ARMOR_SLOTS) {
      const material = control<HTMLSelectElement>(`armor-${slot}`).value;
      state.gear[slot] = material ? generateItem(seed + SLOT_SALT[slot], level, slot, undefined, tier, material as ItemMaterialId) : null;
    }
    outfitSheet = createCharacterSheet('warrior', state.race);
    for (const [slot] of ARMOR_SLOTS) outfitSheet.equipped[slot] = state.gear[slot];
    control<HTMLSelectElement>('offhand').disabled = weaponDef().hands === 2;
    changed();
    status();
  } catch (error) { control('status').textContent = String(error); }
}

function status() {
  const weapon = state.gear.weapon;
  const worn = ARMOR_SLOTS.filter(([slot]) => state.gear[slot]).length;
  control('status').textContent =
    `${WOW_RACES[state.race].name} · ${weapon ? weapon.name : 'Unarmed'}${state.gear.offhand && weaponDef().hands === 1 ? ` + ${state.gear.offhand.name}` : ''} · ${worn} armor piece${worn === 1 ? '' : 's'} · ${state.motion}`;
}

function exportData() {
  const gear = (item: Item | null) => item && {
    name: item.name, kind: item.kind, tier: item.tier, itemLevel: item.itemLevel,
    recipe: { seed: item.seed, profileId: item.recipe.profileId ?? null, materialId: item.recipe.materialId ?? null },
  };
  return {
    kind: 'evergrow-character-studio', version: 1,
    race: state.race, appearance: state.appearance, visual: state.visual,
    gear: {
      seed: state.gearSeed, level: state.gearLevel, tier: state.gearTier,
      weapon: gear(state.gear.weapon), offhand: gear(state.gear.offhand),
      ...Object.fromEntries(ARMOR_SLOTS.map(([slot]) => [slot, gear(state.gear[slot])])),
    },
  };
}

function recomputeEnvelopes() {
  const samples = 24;
  for (let facing = 0; facing < 8; facing++) {
    const angle = facing * Math.PI / 4;
    const bounds = Array.from({ length: samples }, (_, i) => characterBounds(poseAt(angle, i * period() / samples)));
    envelopes[facing] = {
      left: Math.min(...bounds.map(b => b.left)), right: Math.max(...bounds.map(b => b.right)),
      top: Math.min(...bounds.map(b => b.top)), bottom: Math.max(...bounds.map(b => b.bottom)),
    };
  }
}

function drawInto(canvas: HTMLCanvasElement, facing: number, label?: string) {
  const rect = canvas.getBoundingClientRect(), density = devicePixelRatio || 1;
  const width = Math.max(2, Math.round(rect.width * density)), height = Math.max(2, Math.round(rect.height * density));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(density, 0, 0, density, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  const fit = fitCharacter(envelopes[facing], rect.width, rect.height, .07);
  ctx.save(); ctx.translate(fit.x, fit.y); ctx.scale(fit.scale, fit.scale);
  const glow = ctx.createRadialGradient(0, -26, 0, 0, -26, 52);
  glow.addColorStop(0, '#70989818'); glow.addColorStop(1, '#70989800');
  ctx.fillStyle = glow; ctx.fillRect(-55, -80, 110, 110);
  ctx.fillStyle = '#030a10a0'; ctx.beginPath(); ctx.ellipse(0, 2, 15, 3, 0, 0, Math.PI * 2); ctx.fill();
  drawHumanoid(ctx, poseAt(facing * Math.PI / 4, state.elapsed));
  ctx.restore();
  if (label) text(ctx, label, 8, 8, 1.4, '#a5b3a5');
}

const facingCells = DIRECTIONS.map((name, index) => {
  const cell = document.createElement('figure');
  cell.className = 'studio-facing'; cell.setAttribute('aria-pressed', String(index === state.facing));
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${name} facing preview`);
  const caption = document.createElement('figcaption'); caption.textContent = name;
  cell.append(canvas, caption);
  cell.addEventListener('click', () => {
    state.facing = index; control('facing').value = String(index); syncFacingCells(); render();
  }, { signal: abort.signal });
  control<HTMLElement>('facings').append(cell);
  return { cell, canvas };
});
function syncFacingCells() { facingCells.forEach((f, i) => f.cell.setAttribute('aria-pressed', String(i === state.facing))); }

function changed() { dirty = true; render(); }
function render() {
  if (dirty) {
    recomputeEnvelopes();
    control('export-json').textContent = JSON.stringify(exportData(), null, 2);
    dirty = false;
  }
  drawInto(control<HTMLCanvasElement>('hero'), state.facing, DIRECTIONS[state.facing]);
  for (const [i, f] of facingCells.entries()) drawInto(f.canvas, i);
  const cycle = cycleAt(state.elapsed);
  control<HTMLInputElement>('phase').value = String(cycle);
  control('phase-out').textContent = `${Math.round(cycle * 100)}%`;
}
function frame(now: number) {
  if (disposed) return;
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (state.playing && !document.hidden) { state.elapsed += dt * state.speed; render(); }
  else if (dirty) render();
  raf = requestAnimationFrame(frame);
}

function setRace(race: WowRaceId) {
  state.race = race;
  state.appearance = createRaceLook(race).appearance;
  installRaceDef();
  syncAppearanceControls();
  changed(); status();
}

control('race').addEventListener('change', () => setRace(control('race').value as WowRaceId), { signal: abort.signal });
for (const key of APPEARANCE_FIELDS)
  control(key).addEventListener('change', () => {
    (state.appearance as Record<typeof key, string>)[key] = control(key).value;
    changed();
  }, { signal: abort.signal });
control('feature').addEventListener('change', () => {
  state.appearance.feature = (control('feature').value || undefined) as RaceFeatureId | undefined;
  changed();
}, { signal: abort.signal });
for (const [key] of VISUAL_SLIDERS)
  control<HTMLInputElement>(`vis-${key}`).addEventListener('input', () => {
    const value = Number(control<HTMLInputElement>(`vis-${key}`).value);
    state.visual[key] = value;
    control(`out-${key}`).textContent = value.toFixed(2);
    changed();
  }, { signal: abort.signal });
control('reset-visual').addEventListener('click', () => { installRaceDef(); syncAppearanceControls(); changed(); }, { signal: abort.signal });

for (const id of ['gear-seed', 'gear-level', 'gear-tier'])
  control(id).addEventListener('change', () => {
    state.gearSeed = Math.max(0, Math.min(4294967295, Math.round(Number(control<HTMLInputElement>('gear-seed').value) || 0)));
    state.gearLevel = Math.max(1, Math.min(1000000, Math.round(Number(control<HTMLInputElement>('gear-level').value) || 1)));
    state.gearTier = control('gear-tier').value as ItemTier;
    regenGear();
  }, { signal: abort.signal });
control('weapon').addEventListener('change', regenGear, { signal: abort.signal });
control('offhand').addEventListener('change', regenGear, { signal: abort.signal });
for (const [slot] of ARMOR_SLOTS) control(`armor-${slot}`).addEventListener('change', regenGear, { signal: abort.signal });
control('regen').addEventListener('click', () => {
  state.gearSeed = crypto.getRandomValues(new Uint32Array(1))[0];
  control<HTMLInputElement>('gear-seed').value = String(state.gearSeed);
  regenGear();
}, { signal: abort.signal });

control('motion').addEventListener('change', () => {
  state.motion = control('motion').value as typeof state.motion;
  state.elapsed = 0; changed(); status();
}, { signal: abort.signal });
control('play').addEventListener('click', () => {
  state.playing = !state.playing;
  control('play').textContent = state.playing ? 'Pause' : 'Play';
}, { signal: abort.signal });
control('speed').addEventListener('change', () => { state.speed = Number(control('speed').value); }, { signal: abort.signal });
control<HTMLInputElement>('phase').addEventListener('input', () => {
  state.playing = false; control('play').textContent = 'Play';
  state.elapsed = Number(control<HTMLInputElement>('phase').value) * period();
  render();
}, { signal: abort.signal });
control('facing').addEventListener('change', () => { state.facing = Number(control('facing').value); syncFacingCells(); render(); }, { signal: abort.signal });
window.addEventListener('resize', render, { signal: abort.signal });

control('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(exportData(), null, 2));
    control('status').textContent = 'Character JSON copied to the clipboard.';
  } catch { control('status').textContent = 'Clipboard unavailable — select the export text instead.'; }
}, { signal: abort.signal });
control('download').addEventListener('click', () => downloadJSON(`evergrow-character-${state.race}.json`, exportData()), { signal: abort.signal });
control('png').addEventListener('click', () => {
  control<HTMLCanvasElement>('hero').toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `evergrow-character-${state.race}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}, { signal: abort.signal });

// Initial control state.
control('race').value = state.race;
control('weapon').value = 'longsword';
control('gear-tier').value = state.gearTier;
control('play').textContent = state.playing ? 'Pause' : 'Play';
syncAppearanceControls();
regenGear();
status();
raf = requestAnimationFrame(frame);

if (import.meta.hot) import.meta.hot.dispose(() => {
  disposed = true; abort.abort(); cancelAnimationFrame(raf);
  delete raceProto[STUDIO_RACE];
});
