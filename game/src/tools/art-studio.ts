import { toolPage, downloadJSON, boundedNumber, reportRoute } from './common.ts';
import './art-studio.css';
import { createTreeSprite, TREE_BOUNDS, type TreeKind } from '../tree-art.ts';
import { EnvironmentArt } from '../environment-art.ts';
import { ArtLibrary } from '../prop-art.ts';
import { GroundDressing, GROUND_PALETTES, drawGroundPatches } from '../ground-art.ts';
import { drawRoofCourses, drawBuildingApron, drawWallWeathering } from '../architecture-art.ts';
import { architectureStyle, roofVariant } from '../settlement-style.ts';
import { WaterArt } from '../water-art.ts';
import { WaterSimulation } from '../water-simulation.ts';
import { AtmosphereArt } from '../atmosphere-art.ts';
import { PostFX } from '../postfx.ts';
import { SceneShadows } from '../scene-shadows.ts';
import { PropSurfaceLight } from '../prop-surface-light.ts';
import { biomeWind } from '../biome-wind.ts';
import { drawGlow } from '../lighting.ts';
import { skyAtHour } from '../world-time.ts';
import { drawGearShapes } from '../equipment-art.ts';
import { weaponShapes, shieldShapes } from '../weapon-shapes.ts';
import { focusShapes } from '../focus-shapes.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../weapon-content.ts';
import { FOCUS_PROFILES } from '../focus-content.ts';
import { materializeGear, withGearLight, GEAR_MATERIAL_IDS, type GearMaterial, type GearLight } from '../gear-material.ts';
import { drawWeaponEnchantment, type ImbueElement } from '../weapon-enchantment-art.ts';
import { ELEMENT_COLORS } from '../elemental-weapon.ts';
import { PROP_KINDS, BIOME_PROP_TABLES, propDefinition, type PropKind } from '../biome-props.ts';
import { BIOME_IDS, BIOMES, proceduralBiomeSample, type BiomeId, type BiomeWeights, type BiomeSample } from '../biomes.ts';
import { World, type Prop } from '../world.ts';
import { noise } from '../world-landscape.ts';
import type { Building, Rect } from '../settlements.ts';
import type { Sprite } from '../art-types.ts';
import type { WaterSample } from '../hydrology.ts';
import type { CameraView } from '../camera.ts';
import type { PointLight } from '../light-types.ts';
import type { DamageType } from '../model.ts';
import { randomFromSeed, hash, mixColor, polygon, line } from '../art-primitives.ts';

type Family = 'trees' | 'props' | 'equipment' | 'ground' | 'water' | 'architecture' | 'atmosphere';
const FAMILIES: readonly { id: Family; name: string }[] = [
  { id: 'trees', name: 'Trees' }, { id: 'props', name: 'Biome props' }, { id: 'equipment', name: 'Equipment silhouettes' },
  { id: 'ground', name: 'Ground & terrain stamps' }, { id: 'water', name: 'Water' },
  { id: 'architecture', name: 'Architecture' }, { id: 'atmosphere', name: 'Atmosphere' },
];
const TREE_KINDS = Object.keys(TREE_BOUNDS) as TreeKind[];
const EQUIPMENT_SUBJECTS: readonly { id: string; name: string }[] = [
  ...WEAPON_PROFILES.map(w => ({ id: `weapon:${w.id}`, name: w.name })),
  ...SHIELD_PROFILES.map(s => ({ id: `shield:${s.id}`, name: s.name })),
  ...FOCUS_PROFILES.map(f => ({ id: `focus:${f.id}`, name: f.name })),
];
const WATER_SUBJECTS = [
  { id: 'pond', name: 'Pond' }, { id: 'stream', name: 'Stream' }, { id: 'shore', name: 'Shoreline' },
] as const;
type WaterKind = typeof WATER_SUBJECTS[number]['id'];
const ARCH_KINDS = ['house', 'inn', 'blacksmith', 'merchant', 'chapel', 'noble'] as const;
type ArchKind = typeof ARCH_KINDS[number];
const ATMOSPHERE_SUBJECTS = [
  { id: 'mist', name: 'Drifting mist' }, { id: 'lily-rings', name: 'Lily rings' }, { id: 'motes', name: 'Ambient motes' },
] as const;
type AtmosphereKind = typeof ATMOSPHERE_SUBJECTS[number]['id'];
const ELEMENT_OPTIONS: readonly (DamageType | 'profile')[] = ['profile', 'physical', 'fire', 'frost', 'lightning', 'arcane', 'holy', 'shadow', 'nature'];

interface StudioParams {
  size: number; density: number; sway: number; hue: number; variants: number;
  biome: BiomeId; material: GearMaterial | 'variant'; element: DamageType | 'profile';
  kind: ArchKind; hour: number;
}
interface StudioState {
  family: Family; subject: string; seed: number; params: StudioParams;
  lighting: boolean; shadows: boolean; crt: boolean; frozen: boolean;
}
const DEFAULT_PARAMS: StudioParams = {
  size: 1, density: .5, sway: 1, hue: 0, variants: 6,
  biome: 'verdant', material: 'variant', element: 'profile', kind: 'house', hour: 9,
};

const root = await toolPage('Procedural art studio',
  'Tune the shared procedural generators in memory: pick an art family, adjust seed, palette, density, size and sway, compare seeded variants, then export the tuned recipe or a PNG sheet.');
root.classList.add('art-studio');
root.insertAdjacentHTML('beforeend', `
<div class="tool-toolbar">
  <label>Art family <select id="family">${FAMILIES.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}</select></label>
  <label>Subject <select id="subject"></select></label>
  <label>Noise seed <input id="seed" type="number" min="0" max="999999" step="1"></label>
  <button id="new-seed" type="button">New seed</button>
</div>
<div class="art-studio-params">
  <label><span>Size <output id="size-out"></output></span><input id="size" type="range" min="0.5" max="2.5" step="0.05"></label>
  <label id="density-row"><span>Density <output id="density-out"></output></span><input id="density" type="range" min="0" max="3" step="0.05"></label>
  <label id="sway-row"><span>Sway <output id="sway-out"></output></span><input id="sway" type="range" min="0" max="2" step="0.05"></label>
  <label><span>Palette shift <output id="hue-out"></output></span><input id="hue" type="range" min="-180" max="180" step="5"></label>
  <label>Variants <select id="variants">${[1, 2, 4, 6, 8, 9, 12, 16].map(n => `<option value="${n}">${n}</option>`).join('')}</select></label>
  <label id="biome-row">Backdrop biome <select id="biome">${BIOME_IDS.map(b => `<option value="${b}">${BIOMES[b].name}</option>`).join('')}</select></label>
  <label id="material-row">Material <select id="material"><option value="variant">Per-variant cycle</option>${GEAR_MATERIAL_IDS.map(m => `<option value="${m}">${m}</option>`).join('')}</select></label>
  <label id="element-row">Element <select id="element">${ELEMENT_OPTIONS.map(e => `<option value="${e}">${e === 'profile' ? 'Profile default' : e}</option>`).join('')}</select></label>
  <label id="kind-row">Building <select id="kind">${ARCH_KINDS.map(k => `<option value="${k}">${k}</option>`).join('')}</select></label>
  <label><span>Hour <output id="hour-out"></output></span><input id="hour" type="range" min="0" max="24" step="0.5"></label>
</div>
<div class="art-studio-toggles">
  <label><input id="lighting" type="checkbox" checked> Lighting</label>
  <label><input id="shadows" type="checkbox" checked> Shadows</label>
  <label><input id="crt" type="checkbox"> CRT postfx</label>
  <label><input id="frozen" type="checkbox"> Freeze motion</label>
  <span class="art-export"><button id="export-json" type="button">Export JSON</button><button id="export-png" type="button">Export PNG</button></span>
</div>
<canvas id="stage" class="art-studio-stage" role="img" aria-label="Procedural art variant sheet"></canvas>
<canvas id="gl-stage" hidden></canvas>
<p class="art-studio-status" role="status"></p>`);

const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
const familySelect = $<HTMLSelectElement>('family'), subjectSelect = $<HTMLSelectElement>('subject');
const seedInput = $<HTMLInputElement>('seed'), stage = $<HTMLCanvasElement>('stage'), glStage = $<HTMLCanvasElement>('gl-stage');
const status = root.querySelector<HTMLElement>('.art-studio-status')!;
const stageCtx = stage.getContext('2d', { alpha: false })!;

const query = new URLSearchParams(location.search);
const state: StudioState = {
  family: (FAMILIES.some(f => f.id === query.get('family')) ? query.get('family') : 'trees') as Family,
  subject: query.get('subject') ?? '', seed: boundedNumber(query.get('seed'), 7319, 0, 999999),
  params: { ...DEFAULT_PARAMS },
  lighting: true, shadows: true, crt: false, frozen: matchMedia('(prefers-reduced-motion: reduce)').matches,
};

// ---------------------------------------------------------------------------
// Shared art owners (memory-only; disposed on teardown)
const envArt = new EnvironmentArt();
const artLib = new ArtLibrary();
const dressing = new GroundDressing();
const sceneShadows = new SceneShadows();
const surfaceLight = new PropSurfaceLight();
const waterArt = new WaterArt();
const atmosphereArt = new AtmosphereArt();
let postfx: PostFX | undefined;
let world: World | undefined;
let worldSeed = -1;
const waterSims = new Map<number, { sim: WaterSimulation; key: string; pulse: number }>();
const biomeAnchors = new Map<string, { x: number; y: number }>();
const life = new AbortController();
let dirty = true, visualTime = 0, lastFrame = 0, lastRender = 0, raf = 0, disposed = false;

const rand = (seed: number, salt: number) => hash(seed + Math.imul(salt, 7879)) / 0x100000000;
const weightsOf = (biome: BiomeId): BiomeWeights =>
  ({ deadwood: 0, verdant: 0, swamp: 0, frostpine: 0, emberfall: 0, autumn: 0, highlands: 0, steppe: 0, sunscar: 0, [biome]: 1 });
const makeProp = (kind: PropKind, x: number, y: number, seed: number, scale = 1, biome?: BiomeId): Prop => {
  const def = propDefinition(kind);
  return { id: `studio-${kind}-${seed}`, x, y, radius: (def.radius[0] + def.radius[1]) / 2, kind, biome, seed, scale };
};
const propSprite = (prop: Prop): Sprite =>
  envArt.getSprite(prop) ?? (prop.kind === 'tree' || prop.kind === 'deadTree'
    ? artLib.getTree(prop.seed, prop.kind === 'deadTree', prop.scale)
    : prop.kind === 'rock' ? artLib.getRock(prop.seed, prop.scale) : artLib.getShrine());

/** Minimal world surface for outdoor surface-light climates. */
const miniWorld = (biome: BiomeId) => ({
  sampleBiome: (): BiomeSample => ({ id: biome, name: BIOMES[biome].name, weights: weightsOf(biome) }),
  sampleGroundContact: () => ({ weights: weightsOf(biome), water: 0, natural: 1, indoors: false }),
});

function shiftColor(value: string, degrees: number): string {
  if (!degrees || !value.startsWith('#') || (value.length !== 7 && value.length !== 4)) return value;
  const hex = value.length === 4 ? value.slice(1).split('').map(ch => ch + ch).join('') : value.slice(1);
  const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return value;
  const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = ((h * 60 + degrees) % 360 + 360) % 360;
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const channel = (t: number) => {
    t = ((t % 1) + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  const to255 = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${to255(channel(h / 360 + 1 / 3))}${to255(channel(h / 360))}${to255(channel(h / 360 - 1 / 3))}`;
}

// ---------------------------------------------------------------------------
// Subject lists per family
function subjectsFor(family: Family): { id: string; name: string }[] {
  switch (family) {
    case 'trees': return TREE_KINDS.map(k => ({ id: k, name: k.replace(/([A-Z])/g, ' $1').replace(/^./, ch => ch.toUpperCase()) }));
    case 'props': return PROP_KINDS.map(k => ({ id: k, name: k.replace(/([A-Z])/g, ' $1').replace(/^./, ch => ch.toUpperCase()) }));
    case 'equipment': return EQUIPMENT_SUBJECTS.map(e => ({ ...e }));
    case 'ground': return BIOME_IDS.map(b => ({ id: b, name: `${BIOMES[b].name} stamps` }));
    case 'water': return WATER_SUBJECTS.map(w => ({ ...w }));
    case 'architecture': return BIOME_IDS.map(b => ({ id: b, name: `${BIOMES[b].name} buildings` }));
    case 'atmosphere': return ATMOSPHERE_SUBJECTS.map(a => ({ ...a }));
  }
}
function refreshSubjects(keep: boolean) {
  const list = subjectsFor(state.family);
  subjectSelect.innerHTML = list.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  subjectSelect.value = keep && list.some(s => s.id === state.subject) ? state.subject : list[0].id;
  state.subject = subjectSelect.value;
}
function refreshParamVisibility() {
  const f = state.family;
  $('density-row').hidden = f === 'trees';
  $('sway-row').hidden = f === 'ground' || f === 'water' || f === 'architecture';
  $('biome-row').hidden = f === 'equipment' || f === 'ground' || f === 'architecture';
  $('material-row').hidden = f !== 'equipment';
  $('element-row').hidden = f !== 'equipment';
  $('kind-row').hidden = f !== 'architecture';
}

// ---------------------------------------------------------------------------
// Cell painters. Each draws inside a clipped cell rect; world-space scenes use
// a translate+scale transform so runtime art keeps authored coordinates.
interface Cell { x: number; y: number; w: number; h: number }

function backdropBiome(): BiomeId {
  return state.family === 'ground' || state.family === 'architecture' ? state.subject as BiomeId : state.params.biome;
}
function paintGround(c: CanvasRenderingContext2D, cell: Cell, biome: BiomeId, seed: number, zoom: number) {
  const palette = GROUND_PALETTES[biome];
  const g = c.createLinearGradient(0, cell.y, 0, cell.y + cell.h);
  g.addColorStop(0, mixColor(palette.cover, '#0b1319', .35));
  g.addColorStop(1, mixColor(palette.soil, '#0b1319', .45));
  c.fillStyle = g; c.fillRect(cell.x, cell.y, cell.w, cell.h);
  c.save();
  c.translate(cell.x, cell.y); c.scale(zoom, zoom);
  const size = Math.max(cell.w, cell.h) / zoom;
  drawGroundPatches(c, 0, 0, size, seed, () => biome, () => true);
  c.restore();
}
function drawPropSprite(c: CanvasRenderingContext2D, prop: Prop, sprite: Sprite, time: number, biome: BiomeId) {
  const def = propDefinition(prop.kind), frozen = state.frozen;
  const wind = biomeWind(prop.x, prop.y, time, prop.biome ?? biome, frozen).x * def.sway * state.params.sway;
  c.save(); c.translate(prop.x, prop.y); c.scale(prop.scale, prop.scale);
  if (!sprite.foliage && def.radius[1] === 0) c.transform(1, 0, wind * -.012, 1, 0, 0);
  c.drawImage(sprite.image, -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height);
  if (state.lighting) {
    surfaceLight.draw(c, prop, sprite, sprite.image, skyAtHour(state.params.hour));
    surfaceLight.drawOutdoor(c, prop, sprite, sprite.image, miniWorld(prop.biome ?? biome), time, frozen, skyAtHour(state.params.hour));
  }
  if (sprite.foliage) for (const [layer, foliage] of sprite.foliage.entries()) {
    const gust = biomeWind(prop.x, prop.y, time - layer * .18, prop.biome ?? biome, frozen).x * def.sway * 2.2 * state.params.sway;
    c.save(); c.transform(1, 0, gust * (layer ? -.009 : -.005), 1, 0, 0);
    c.drawImage(foliage, -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height);
    if (state.lighting) {
      surfaceLight.draw(c, prop, sprite, foliage, skyAtHour(state.params.hour));
      surfaceLight.drawOutdoor(c, prop, sprite, foliage, miniWorld(prop.biome ?? biome), time, frozen, skyAtHour(state.params.hour));
    }
    c.restore();
  }
  c.restore();
  if (state.lighting && def.emissive)
    drawGlow(c, prop.x + def.emissive.offsetX * prop.scale, prop.y + def.emissive.offsetY * prop.scale,
      def.emissive.radius * prop.scale, def.emissive.color, def.emissive.power);
}
function castShadows(c: CanvasRenderingContext2D, props: readonly Prop[], sprites: Map<Prop, Sprite>,
  cell: Cell, zoom: number, time: number) {
  if (!state.shadows || !props.length) return;
  const view: CameraView = { zoom, offsetX: 0, offsetY: 0, left: 0, top: 0, width: cell.w / zoom, height: cell.h / zoom };
  const sky = state.lighting ? skyAtHour(state.params.hour) : undefined;
  sceneShadows.drawProps(c, props, view, prop => sprites.get(prop) ?? propSprite(prop),
    time, state.frozen, sky?.direction, sky?.shadow ?? .55);
}

function paintTrees(c: CanvasRenderingContext2D, cell: Cell, index: number, time: number) {
  const kind = state.subject as TreeKind, biome = backdropBiome();
  const seed = state.seed + index * 101;
  paintGround(c, cell, biome, seed, 1);
  const sprite = createTreeSprite((width, height) => {
    const image = document.createElement('canvas'); image.width = width; image.height = height; return image;
  }, kind, seed, 2);
  const scale = Math.min(state.params.size, (cell.h * .86) / sprite.height, (cell.w * .9) / sprite.width);
  const prop = makeProp(kind, cell.w / 2, cell.h * .88, seed, scale, biome);
  c.save(); c.translate(cell.x, cell.y);
  castShadows(c, [prop], new Map([[prop, sprite]]), cell, 1, time);
  drawPropSprite(c, prop, sprite, time, biome);
  c.restore();
  const habit = Math.floor(randomFromSeed(seed)() * 3);
  return `seed ${seed} · habit ${['tall', 'broad', 'wide'][habit]}`;
}

function paintProps(c: CanvasRenderingContext2D, cell: Cell, index: number, time: number) {
  const kind = state.subject as PropKind, biome = backdropBiome();
  const seed = state.seed + index * 733;
  paintGround(c, cell, biome, seed, 1);
  const count = 1 + Math.round(state.params.density * 4);
  const random = randomFromSeed(seed);
  const props: Prop[] = [], sprites = new Map<Prop, Sprite>();
  for (let i = 0; i < count; i++) {
    const scale = state.params.size * (.75 + random() * .5);
    const prop = makeProp(kind, cell.w * (.12 + random() * .76), cell.h * (.3 + random() * .62), seed + i * 37, scale, biome);
    props.push(prop); sprites.set(prop, propSprite(prop));
  }
  props.sort((a, b) => a.y - b.y);
  c.save(); c.translate(cell.x, cell.y);
  castShadows(c, props, sprites, cell, 1, time);
  dressing.draw(c, props);
  for (const prop of props) drawPropSprite(c, prop, sprites.get(prop)!, time, biome);
  c.restore();
  return `seed ${seed} · ×${count}`;
}

function paintEquipment(c: CanvasRenderingContext2D, cell: Cell, index: number, time: number) {
  const [group, id] = state.subject.split(':');
  const seed = state.seed + index * 977;
  const g = c.createLinearGradient(0, cell.y, 0, cell.y + cell.h);
  g.addColorStop(0, '#16222b'); g.addColorStop(1, '#0b141a');
  c.fillStyle = g; c.fillRect(cell.x, cell.y, cell.w, cell.h);
  const material: GearMaterial = state.params.material === 'variant'
    ? GEAR_MATERIAL_IDS[(index + Math.floor(rand(seed, 5) * 3)) % GEAR_MATERIAL_IDS.length] : state.params.material;
  const colorFn = (v: string) => shiftColor(v, state.params.hue);
  const light: GearLight = state.lighting
    ? { direction: skyAtHour(state.params.hour).direction, color: '#e9f1ff', power: .6 + skyAtHour(state.params.hour).power * .6 }
    : { direction: [-.45, -.6, .66], color: '#e9f1ff', power: .8 };
  const echoes = 1 + Math.round(state.params.density * 2);
  const zoom = Math.min(cell.w, cell.h) / 72 * state.params.size;
  c.save(); c.translate(cell.x + cell.w / 2, cell.y + cell.h * .58);
  if (state.shadows) {
    c.fillStyle = '#030a1355';
    c.beginPath(); c.ellipse(6 * zoom, 14 * zoom, 26 * zoom, 7 * zoom, -.2, 0, Math.PI * 2); c.fill();
  }
  for (let e = echoes - 1; e >= 0; e--) {
    const angle = -.62 + (echoes === 1 ? 0 : (e / (echoes - 1) - .5) * .5);
    c.save(); c.rotate(angle); c.scale(zoom, zoom); c.globalAlpha = e === 0 ? 1 : .55;
    withGearLight(c, light, () => {
      if (group === 'weapon') {
        const profile = WEAPON_PROFILES.find(w => w.id === id)!;
        const element = state.params.element === 'profile' ? profile.visual.element : state.params.element;
        const visual = { ...profile.visual, element, glow: element ? ELEMENT_COLORS[element] ?? profile.visual.glow : profile.visual.glow };
        const draw = profile.family === 'bow' ? Math.min(1, state.params.sway) : 0;
        drawGearShapes(c, materializeGear(weaponShapes(visual, draw), material, seed), colorFn);
        if (element && element !== 'physical' && element !== 'arcane')
          drawWeaponEnchantment(c, visual, state.frozen ? 0 : time, 0, element as ImbueElement);
      } else if (group === 'shield') {
        const profile = SHIELD_PROFILES.find(s => s.id === id)!;
        drawGearShapes(c, materializeGear(shieldShapes(profile.visual), material, seed), colorFn);
      } else {
        const profile = FOCUS_PROFILES.find(f => f.id === id)!;
        drawGearShapes(c, materializeGear(focusShapes(profile.visual, state.frozen ? 0 : time), material, seed), colorFn);
      }
    });
    c.restore();
  }
  c.restore();
  if (state.lighting && group === 'focus') {
    const profile = FOCUS_PROFILES.find(f => f.id === id)!;
    drawGlow(c, cell.x + cell.w / 2, cell.y + cell.h * .5, 30 * zoom, profile.visual.glow, .3);
  }
  return `seed ${seed} · ${material}`;
}

function paintGroundCell(c: CanvasRenderingContext2D, cell: Cell, index: number, time: number) {
  const biome = state.subject as BiomeId, seed = state.seed + index * 389;
  const zoom = state.params.size;
  paintGround(c, cell, biome, seed, zoom);
  const table = BIOME_PROP_TABLES[biome], total = table.reduce((s, e) => s + e.weight, 0);
  const random = randomFromSeed(seed);
  const count = 2 + Math.round(state.params.density * 5);
  const props: Prop[] = [], sprites = new Map<Prop, Sprite>();
  for (let i = 0; i < count; i++) {
    let roll = random() * total, kind = table[table.length - 1].kind;
    for (const entry of table) { if (roll < entry.weight) { kind = entry.kind; break; } roll -= entry.weight; }
    const prop = makeProp(kind, cell.w * (.1 + random() * .8) / zoom, cell.h * (.35 + random() * .55) / zoom, seed + i * 61, .9 + random() * .3, biome);
    if (prop.radius <= 0 || kind === 'shrine') continue;
    props.push(prop); sprites.set(prop, propSprite(prop));
  }
  props.sort((a, b) => a.y - b.y);
  c.save(); c.translate(cell.x, cell.y); c.scale(zoom, zoom);
  castShadows(c, props, sprites, cell, zoom, time);
  dressing.draw(c, props);
  for (const prop of props) drawPropSprite(c, prop, sprites.get(prop)!, time, biome);
  c.restore();
  return `seed ${seed} · ${BIOMES[biome].name}`;
}

function waterSampler(kind: WaterKind, seed: number, worldW: number, worldH: number, density: number) {
  return (x: number, y: number): WaterSample => {
    const nx = (x - worldW / 2) / (worldW / 2), ny = (y - worldH / 2) / (worldH / 2);
    const wobble = (noise(x / 140 + seed % 97, y / 140, seed) - .5) * .55;
    let d: number;
    if (kind === 'stream') d = Math.abs(nx + wobble * .8) / (.34 + density * .3);
    else if (kind === 'shore') d = (nx + .45 + wobble) / (.5 + density * .35);
    else d = Math.hypot(nx, ny * 1.35 + wobble * .4) / (.5 + density * .3);
    const coverage = Math.max(0, Math.min(1, (1 - d) * 2.4));
    const depth = Math.max(0, Math.min(1.6, (1 - d) * 1.5));
    return { coverage, depth, flowX: kind === 'stream' ? .4 : .05, flowY: kind === 'shore' ? .2 : .1, bank: Math.max(0, 1 - Math.abs(d - 1) * 3), kind: coverage > .05 ? 'lake' : 'dry' };
  };
}
function paintWater(c: CanvasRenderingContext2D, cell: Cell, index: number, time: number, dt: number) {
  const kind = state.subject as WaterKind, biome = backdropBiome();
  const seed = state.seed + index * 557;
  paintGround(c, cell, biome, seed, 1);
  const zoom = state.params.size, worldW = cell.w / zoom, worldH = cell.h / zoom;
  const key = `${kind}:${seed}:${Math.round(worldW)}:${Math.round(state.params.density * 20)}`;
  let entry = waterSims.get(index);
  if (!entry || entry.key !== key) {
    const sim = new WaterSimulation();
    sim.fit({ x: -worldW * .25, y: -worldH * .25, width: worldW * 1.5, height: worldH * 1.5 },
      waterSampler(kind, seed, worldW, worldH, state.params.density));
    entry = { sim, key, pulse: -1 }; waterSims.set(index, entry);
    if (waterSims.size > 24) waterSims.delete(waterSims.keys().next().value!);
  }
  const sim = entry.sim;
  if (!state.frozen) {
    const pulse = Math.floor(time / 1.1);
    if (pulse !== entry.pulse) {
      entry.pulse = pulse;
      sim.disturb({ x: worldW * (.3 + rand(seed + pulse, 3) * .4), y: worldH * (.35 + rand(seed + pulse, 7) * .3),
        radius: 26 + rand(seed + pulse, 11) * 40, strength: .5 + state.params.sway });
    }
    sim.update(Math.min(.05, dt));
  }
  const sky = state.lighting ? skyAtHour(state.params.hour) : undefined;
  const lights: PointLight[] = state.lighting
    ? [{ x: worldW * .5, y: worldH * .42, radius: 130, color: '#ffd9a0', power: .5, stationary: true }] : [];
  c.save(); c.translate(cell.x, cell.y); c.scale(zoom, zoom);
  waterArt.begin(sim, { left: 0, top: 0, width: worldW, height: worldH });
  waterArt.drawSurface(c, sim, lights, state.frozen, 0, sky);
  waterArt.drawSplashes(c, sim);
  c.restore();
  return `seed ${seed} · ${sim.wetCells} wet cells`;
}

function studioBuilding(biome: BiomeId, kind: ArchKind, seed: number, width: number, height: number): Building {
  return {
    id: `studio-${biome}-${kind}-${seed}`, seed, name: kind, kind, biome, form: 'house',
    x: 0, y: 0, width, height,
    door: { x: width / 2, y: height, width: 42 }, walls: [], furniture: [],
  };
}
function paintArchitecture(c: CanvasRenderingContext2D, cell: Cell, index: number, _time: number) {
  const biome = state.subject as BiomeId, kind = state.params.kind;
  const seed = state.seed + index * 271;
  paintGround(c, cell, biome, seed, 1);
  const count = 1 + Math.round(state.params.density);
  const scale = Math.min(state.params.size, (cell.h * .8) / 130, (cell.w * .86) / (150 * count));
  const style = architectureStyle({ biome });
  c.save(); c.translate(cell.x, cell.y);
  for (let i = 0; i < count; i++) {
    const b = studioBuilding(biome, kind, seed + i * 43, 120 + rand(seed, i) * 60, 74 + rand(seed, i + 9) * 26);
    const cx = cell.w * (count === 1 ? .5 : .18 + .64 * i / (count - 1)), base = cell.h * .86;
    c.save(); c.translate(cx - b.width * scale / 2, base - b.height * scale); c.scale(scale, scale);
    if (state.shadows) {
      c.fillStyle = '#030a1348';
      c.beginPath(); c.ellipse(b.width / 2 + 14, b.height + 8, b.width * .58, 12, -.12, 0, Math.PI * 2); c.fill();
    }
    drawBuildingApron(c, b);
    // South facade: the same wall recipe the settlement renderer paints, with a door opening.
    const stone = kind === 'chapel' || kind === 'blacksmith' || kind === 'noble';
    const wallTop = b.height - 8 - 42;
    c.fillStyle = stone ? style.stone : style.wall; c.fillRect(0, wallTop, b.width, 50);
    c.fillStyle = style.trim; c.fillRect(0, wallTop, b.width, 4);
    line(c, [[.5, wallTop + .5], [b.width - .5, wallTop + .5]], '#c2b08a', .75);
    if (stone) {
      c.strokeStyle = '#1a30373c'; c.lineWidth = .7;
      for (let y = wallTop + 6; y < b.height; y += 7) { c.beginPath(); c.moveTo(0, y); c.lineTo(b.width, y); c.stroke(); }
    } else {
      c.fillStyle = '#443b30';
      c.fillRect(0, wallTop, b.width, 2); c.fillRect(0, b.height - 4, b.width, 3);
      for (let x = 3; x < b.width; x += 27) {
        c.fillRect(x, wallTop + 1, 2.5, 47);
        if (x + 24 < b.width) line(c, [[x + 2, b.height - 5], [x + 25, wallTop + 4]], '#514936', 2);
      }
    }
    const wallRect: Rect = { x: 0, y: b.height - 8, width: b.width, height: 8 };
    drawWallWeathering(c, wallRect, 42, stone);
    c.fillStyle = '#1d2b2e'; c.fillRect(b.door.x - 13, b.height - 34, 26, 34);
    line(c, [[b.door.x - 13, b.height - 34], [b.door.x + 13, b.height - 34]], style.trim, 2);
    drawStudioRoof(c, b);
    c.restore();
  }
  c.restore();
  return `seed ${seed} · ${roofVariant(studioBuilding(biome, kind, seed, 140, 80))} roof`;
}
/** The settlement roof recipe: gable face, clipped course slopes, ridge and weathering. */
function drawStudioRoof(c: CanvasRenderingContext2D, b: Building) {
  const w = b.width, h = b.height;
  const rise = (roofVariant(b) === 'terrace' ? 3 : (b.biome === 'frostpine' ? 9 : 0)
    + Math.min(36, Math.max(22, w * .19)) + (b.kind === 'chapel' ? 7 : 0));
  const left = -8, right = w + 8, center = w / 2, back = -45, front = h - 39;
  const style = architectureStyle(b);
  if (roofVariant(b) === 'terrace') {
    polygon(c, [[left, back], [right, back], [right, front], [left, front]], style.wall);
    for (let i = 0; i < 44; i++) {
      const xx = rand(b.seed, i + 48) * w, yy = back + rand(b.seed, i + 179) * (front - back);
      line(c, [[xx, yy], [xx + 7, yy + 1]], '#8a765655', .7);
    }
    line(c, [[left, front], [left, back], [right, back], [right, front]], style.trim, 6);
    line(c, [[left, front], [right, front]], '#8d795c', 5);
    return;
  }
  polygon(c, [[left + 1, front], [right - 1, front], [right - 2, front + 5], [left + 2, front + 5]], '#1b2e34');
  polygon(c, [[left, front], [center, front - rise], [right, front]], b.kind === 'chapel' ? '#647575' : '#a09374');
  line(c, [[center, front - rise + 1], [center, front]], '#483d32', 2);
  line(c, [[left + 8, front - 1], [center, front - rise + 3], [right - 8, front - 1]], '#564a36', 2);
  polygon(c, [[center, front - rise * .71], [center + 5, front - rise * .48], [center, front - rise * .25],
    [center - 5, front - rise * .48]], b.kind === 'chapel' ? '#b6c5a4' : '#425964');
  for (const side of [-1, 1]) {
    const edge = side < 0 ? left : right;
    c.save();
    polygon(c, [[edge, back], [center, back - rise], [center, front - rise], [edge, front]], side < 0 ? '#3d535e' : '#283f4d');
    c.clip();
    drawRoofCourses(c, b, edge, center, back, front, rise, side);
    c.restore();
    line(c, [[edge, front], [edge, back], [center, back - rise]], '#a7a68a', 1.4);
    line(c, [[edge, front], [center, front - rise]], side < 0 ? '#8a968b' : '#5f7980', 2);
  }
  if (roofVariant(b) === 'hipped') {
    polygon(c, [[left, front], [center, front - rise - 28], [right, front]], style.roof[1]);
    for (let row = 0; row < 5; row++) {
      const f = row / 5;
      line(c, [[left + (center - left) * f, front - (rise + 28) * f], [right + (center - right) * f, front - (rise + 28) * f]], style.roof[3] + '70', 1);
    }
  }
  line(c, [[center, back - rise], [center, front - rise]], '#abb39b', 3);
  line(c, [[center + 1.5, back - rise + 1], [center + 1.5, front - rise]], '#516a70', .9);
}

function atmosphereWorld(): World {
  if (!world || worldSeed !== state.seed) { world?.dispose(); world = new World(state.seed); worldSeed = state.seed; }
  return world;
}
function biomeAnchor(biome: BiomeId): { x: number; y: number } {
  const key = `${state.seed}:${biome}`;
  let anchor = biomeAnchors.get(key);
  if (anchor) return anchor;
  anchor = { x: 0, y: 0 };
  for (let ring = 0; ring < 40 && proceduralBiomeSample(anchor.x, anchor.y, state.seed).id !== biome; ring++) {
    const angle = ring * 2.399963, radius = 400 + ring * 700;
    anchor = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }
  biomeAnchors.set(key, anchor);
  return anchor;
}
function paintAtmosphere(c: CanvasRenderingContext2D, cell: Cell, index: number, time: number) {
  const kind = state.subject as AtmosphereKind, biome = backdropBiome();
  const seed = state.seed + index * 149;
  const zoom = state.params.size, worldW = cell.w / zoom, worldH = cell.h / zoom;
  const sky = state.lighting ? skyAtHour(state.params.hour) : undefined;
  const g = c.createLinearGradient(0, cell.y, 0, cell.y + cell.h);
  const ground = GROUND_PALETTES[biome];
  g.addColorStop(0, mixColor('#24343e', ground.dark, .4));
  g.addColorStop(1, mixColor(ground.soil, '#0b1319', .5));
  c.fillStyle = g; c.fillRect(cell.x, cell.y, cell.w, cell.h);
  c.save(); c.translate(cell.x, cell.y); c.scale(zoom, zoom);
  const t = state.frozen ? 0 : time * state.params.sway;
  if (kind === 'lily-rings') {
    const random = randomFromSeed(seed), props: Prop[] = [];
    const count = 2 + Math.round(state.params.density * 4);
    for (let i = 0; i < count; i++)
      props.push(makeProp('lilies', worldW * (.15 + random() * .7), worldH * (.3 + random() * .55), seed + i * 17, .9 + random() * .4, 'swamp'));
    c.fillStyle = '#1d3a40';
    c.beginPath(); c.ellipse(worldW / 2, worldH * .62, worldW * .46, worldH * .3, 0, 0, Math.PI * 2); c.fill();
    atmosphereArt.drawWater(c, props, t, state.frozen);
    for (const prop of props) drawPropSprite(c, prop, propSprite(prop), time, 'swamp');
  } else if (kind === 'motes') {
    envArt.drawAmbient(c, () => weightsOf(biome), { x: 0, y: 0, width: worldW, height: worldH }, t, state.frozen);
  } else {
    const anchor = biomeAnchor(biome), w = atmosphereWorld();
    const view: CameraView = { zoom, offsetX: 0, offsetY: 0, left: anchor.x, top: anchor.y, width: worldW, height: worldH };
    const layer = document.createElement('canvas');
    layer.width = Math.max(1, Math.round(cell.w)); layer.height = Math.max(1, Math.round(cell.h));
    const lc = layer.getContext('2d')!;
    lc.scale(zoom, zoom); lc.translate(-anchor.x, -anchor.y);
    // The player anchor sits at the far corner so foreground mist keeps full
    // clearance alpha across the study cell.
    const px = anchor.x + worldW * 1.6, py = anchor.y + worldH * 1.6;
    atmosphereArt.drawLayer(lc, w, view, t, state.frozen, px, py, false, false, 0, sky);
    atmosphereArt.drawLayer(lc, w, view, t * 1.3 + 40, state.frozen, px, py, true, false, 0, sky);
    // Density layers the same anchored mist field through the screen blend:
    // more passes read as a thicker bank without changing the recipe.
    const passes = 1 + Math.round(state.params.density * 2);
    for (let pass = 0; pass < passes; pass++) {
      c.globalAlpha = .55;
      c.drawImage(layer, pass * 9 - passes * 4, pass * 5 - passes * 2, worldW, worldH);
    }
    c.globalAlpha = 1;
  }
  c.restore();
  return `seed ${seed} · ${BIOMES[biome].name}`;
}

// ---------------------------------------------------------------------------
// Frame composition
function render(dt: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = Math.max(320, stage.clientWidth || stage.parentElement!.clientWidth || 960);
  const n = state.params.variants;
  const cols = Math.max(1, Math.min(n, Math.floor(cssW / 300) || 1));
  const rows = Math.ceil(n / cols);
  const cssH = Math.max(240, Math.min(560, cssW / cols * .78)) * rows;
  const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
  if (stage.width !== w || stage.height !== h) { stage.width = w; stage.height = h; stage.style.height = `${cssH}px`; }
  stageCtx.setTransform(1, 0, 0, 1, 0, 0);
  stageCtx.fillStyle = '#0a141a'; stageCtx.fillRect(0, 0, w, h);
  const cellW = w / cols, cellH = h / rows;
  const labels: string[] = [];
  for (let i = 0; i < n; i++) {
    const cell: Cell = { x: (i % cols) * cellW, y: Math.floor(i / cols) * cellH, w: cellW, h: cellH };
    stageCtx.save();
    stageCtx.beginPath(); stageCtx.rect(cell.x + 1, cell.y + 1, cell.w - 2, cell.h - 2); stageCtx.clip();
    if (state.params.hue) stageCtx.filter = `hue-rotate(${state.params.hue}deg)`;
    let label = '';
    switch (state.family) {
      case 'trees': label = paintTrees(stageCtx, cell, i, visualTime); break;
      case 'props': label = paintProps(stageCtx, cell, i, visualTime); break;
      case 'equipment': label = paintEquipment(stageCtx, cell, i, visualTime); break;
      case 'ground': label = paintGroundCell(stageCtx, cell, i, visualTime); break;
      case 'water': label = paintWater(stageCtx, cell, i, visualTime, dt); break;
      case 'architecture': label = paintArchitecture(stageCtx, cell, i, visualTime); break;
      case 'atmosphere': label = paintAtmosphere(stageCtx, cell, i, visualTime); break;
    }
    stageCtx.filter = 'none';
    stageCtx.restore();
    labels.push(label);
    stageCtx.strokeStyle = '#2b3b43'; stageCtx.lineWidth = 1;
    stageCtx.strokeRect(cell.x + .5, cell.y + .5, cell.w - 1, cell.h - 1);
    stageCtx.font = `${11 * dpr}px 'Pixelify Sans', sans-serif`;
    stageCtx.fillStyle = '#0b1319cc'; stageCtx.fillRect(cell.x + 6, cell.y + cell.h - 22, stageCtx.measureText(label).width + 14, 17);
    stageCtx.fillStyle = '#c9d6cc';
    stageCtx.fillText(label, cell.x + 12, cell.y + cell.h - 9);
  }
  if (state.crt) {
    if (glStage.width !== w || glStage.height !== h) { glStage.width = w; glStage.height = h; }
    postfx ??= new PostFX(glStage);
    postfx.render(stage, 0);
    stageCtx.drawImage(glStage, 0, 0);
  }
  stage.setAttribute('aria-label', `${FAMILIES.find(f => f.id === state.family)!.name}: ${labels.join('; ')}`);
}

function frame(now: number) {
  if (disposed) return;
  raf = requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  if (document.hidden) return;
  if (state.frozen && !dirty) return;
  if (!dirty && now - lastRender < 33) return;
  lastRender = now; dirty = false;
  visualTime += dt;
  render(dt);
}

// ---------------------------------------------------------------------------
// Controls
function syncURL() {
  const url = new URL(location.href);
  url.searchParams.set('family', state.family);
  url.searchParams.set('subject', state.subject);
  url.searchParams.set('seed', String(state.seed));
  history.replaceState(null, '', url);
  reportRoute();
}
function mark() { dirty = true; }
function readControls() {
  state.params.size = Number($<HTMLInputElement>('size').value);
  state.params.density = Number($<HTMLInputElement>('density').value);
  state.params.sway = Number($<HTMLInputElement>('sway').value);
  state.params.hue = Number($<HTMLInputElement>('hue').value);
  state.params.variants = Number($<HTMLSelectElement>('variants').value);
  state.params.biome = $<HTMLSelectElement>('biome').value as BiomeId;
  state.params.material = $<HTMLSelectElement>('material').value as StudioParams['material'];
  state.params.element = $<HTMLSelectElement>('element').value as StudioParams['element'];
  state.params.kind = $<HTMLSelectElement>('kind').value as ArchKind;
  state.params.hour = Number($<HTMLInputElement>('hour').value);
  state.lighting = $<HTMLInputElement>('lighting').checked;
  state.shadows = $<HTMLInputElement>('shadows').checked;
  state.crt = $<HTMLInputElement>('crt').checked;
  state.frozen = $<HTMLInputElement>('frozen').checked;
  for (const id of ['size', 'density', 'sway', 'hue', 'hour']) {
    const input = $<HTMLInputElement>(id), out = $<HTMLOutputElement>(`${id}-out`);
    const value = Number(input.value);
    out.textContent = id === 'hour' ? `${String(Math.floor(value)).padStart(2, '0')}:${value % 1 ? '30' : '00'}`
      : id === 'hue' ? `${input.value}°` : `×${input.value}`;
  }
}
function writeControls() {
  $<HTMLInputElement>('size').value = String(state.params.size);
  $<HTMLInputElement>('density').value = String(state.params.density);
  $<HTMLInputElement>('sway').value = String(state.params.sway);
  $<HTMLInputElement>('hue').value = String(state.params.hue);
  $<HTMLSelectElement>('variants').value = String(state.params.variants);
  $<HTMLSelectElement>('biome').value = state.params.biome;
  $<HTMLSelectElement>('material').value = state.params.material;
  $<HTMLSelectElement>('element').value = state.params.element;
  $<HTMLSelectElement>('kind').value = state.params.kind;
  $<HTMLInputElement>('hour').value = String(state.params.hour);
  $<HTMLInputElement>('lighting').checked = state.lighting;
  $<HTMLInputElement>('shadows').checked = state.shadows;
  $<HTMLInputElement>('crt').checked = state.crt;
  $<HTMLInputElement>('frozen').checked = state.frozen;
  seedInput.value = String(state.seed);
  familySelect.value = state.family;
}

familySelect.addEventListener('change', () => {
  state.family = familySelect.value as Family;
  refreshSubjects(false); refreshParamVisibility(); syncURL(); mark();
}, { signal: life.signal });
subjectSelect.addEventListener('change', () => { state.subject = subjectSelect.value; syncURL(); mark(); }, { signal: life.signal });
seedInput.addEventListener('change', () => {
  state.seed = boundedNumber(seedInput.value, state.seed, 0, 999999);
  seedInput.value = String(state.seed); waterSims.clear(); syncURL(); mark();
}, { signal: life.signal });
$('new-seed').addEventListener('click', () => {
  state.seed = Math.floor(Math.random() * 999999);
  seedInput.value = String(state.seed); waterSims.clear(); syncURL(); mark();
}, { signal: life.signal });
for (const id of ['size', 'density', 'sway', 'hue', 'variants', 'biome', 'material', 'element', 'kind', 'hour',
  'lighting', 'shadows', 'crt', 'frozen'])
  $(id).addEventListener('input', () => { readControls(); mark(); }, { signal: life.signal });

$('export-json').addEventListener('click', () => {
  readControls();
  downloadJSON(`evergrow-art-${state.family}-${state.subject.replace(':', '-')}-s${state.seed}.json`, {
    tool: 'art-studio', exported: new Date().toISOString(),
    family: state.family, subject: state.subject, seed: state.seed,
    params: { ...state.params },
    render: { lighting: state.lighting, shadows: state.shadows, crt: state.crt, frozen: state.frozen },
    variants: Array.from({ length: state.params.variants }, (_, i) => ({ index: i, seed: state.seed + i })),
  });
  status.textContent = 'Recipe exported as JSON (development artifact; not a save file).';
}, { signal: life.signal });
$('export-png').addEventListener('click', () => {
  if (dirty) render(0);
  const a = document.createElement('a');
  a.download = `evergrow-art-${state.family}-${state.subject.replace(':', '-')}-s${state.seed}.png`;
  a.href = stage.toDataURL('image/png'); a.click();
  status.textContent = `PNG exported${state.crt ? ' (includes CRT postfx)' : ''}.`;
}, { signal: life.signal });

const resize = new ResizeObserver(mark);
resize.observe(root);
document.addEventListener('visibilitychange', mark, { signal: life.signal });

refreshSubjects(true);
refreshParamVisibility();
writeControls();
readControls();
syncURL();
status.textContent = 'Tune parameters to regenerate; variants render side by side from consecutive seeds.';
raf = requestAnimationFrame(frame);

function dispose() {
  disposed = true;
  cancelAnimationFrame(raf);
  life.abort();
  resize.disconnect();
  postfx?.dispose();
  world?.dispose();
  envArt.reset(); dressing.reset(); sceneShadows.reset();
  surfaceLight.reset(); waterArt.reset(); atmosphereArt.reset();
  waterSims.clear(); biomeAnchors.clear();
}
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, { signal: life.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
