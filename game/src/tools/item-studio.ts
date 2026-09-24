import { UITooltipStack } from '../ui-tooltip-stack.ts';
import { effectExplanation } from '../effect-terms.ts';
import '../ui-kit.css';
import '../item-ui.css';
import '../inventory-pack.css';
import './item-studio.css';
import { toolPage, boundedNumber, downloadJSON, reportRoute } from './common.ts';
import { forgeItem, forgeProfiles, forgeMaterials, type ForgeRecipe } from './forge-model.ts';
import {
  ITEM_KINDS, TIER_NAMES, TIER_COLORS, STAT_LABELS, PERCENT_STATS,
  generateItem, deriveItem, roundItemStats, createCharacterSheet, itemAffixPool, affixConflicts,
  formatStatValue, itemDisplayName,
} from '../items.ts';
import { discreteAffixValue } from '../equipment-affix-content.ts';
import { ITEM_MATERIALS, type ItemMaterialId } from '../item-materials.ts';
import { itemIconSVG, itemPackIconSVG } from '../item-art.ts';
import { itemTooltipMarkup, EQUIPPED_LABELS } from '../item-ui.ts';
import { escapeUI as e } from '../ui-components.ts';
import { itemRollMultiplier, isGreaterAffix } from '../item-roll-content.ts';
import { PACK_COLUMNS, PACK_CELLS, itemFootprint, findPackSpace, footprintCells } from '../pack-grid.ts';
import { Simulation } from '../simulation.ts';
import { refreshCharacter } from '../character.ts';
import { addInventoryItem, equipItem, defaultEquipmentSlot } from '../inventory.ts';
import { drawCharacterPortrait } from '../character-portrait.ts';
import { cloneData } from '../data-clone.ts';
import { WOW_CLASSES } from '../wow-classes.ts';
import { WOW_CLASS_IDS, type WowClassId } from '../wow-types.ts';
import type { CharacterSheet, Item, ItemKind, ItemTier, StatKey, StatModifiers } from '../character-types.ts';

const root = await toolPage('Item studio', 'Author equipment with the real item rules: roll a base, edit stats and affixes, equip it on a staged character, roll variants and export the recipe. Everything stays in this study.');
const explanations = new UITooltipStack(root, effectExplanation);
window.addEventListener('pagehide', () => explanations.dispose(), { once: true });

const q = new URLSearchParams(location.search);
const STUDIO_KINDS = ITEM_KINDS.filter(k => k !== 'consumable');

root.insertAdjacentHTML('beforeend', `
<form class="tool-toolbar">
  <label>Seed<input name="seed" type="number" min="0" max="4294967295" required></label>
  <label>Kind<select name="kind">${STUDIO_KINDS.map(k => `<option>${k}</option>`).join('')}</select></label>
  <label>Profile<select name="profile"></select></label>
  <label>Rarity<select name="tier"><option value="">Natural roll</option>${Object.entries(TIER_NAMES).map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</select></label>
  <label>Material<select name="material"></select></label>
  <button type="submit">Roll item</button><button type="button" id="random">Random seed</button>
</form>
<p class="tool-status" role="status"></p>
<div class="studio-grid">
  <section class="tool-panel">
    <div id="gear"></div>
    <div id="tooltip"></div>
    <button id="export" type="button">Export item JSON</button>
    <details><summary>Exact recipe &amp; derived data</summary><pre id="recipe"></pre></details>
  </section>
  <section class="tool-panel studio-editor" id="editor"></section>
  <section class="tool-panel">
    <h2>Equipped preview</h2>
    <div class="studio-field-row">
      <label class="studio-field">Class<select id="class"></select></label>
      <label class="studio-field">Facing<input id="facing" type="range" min="0" max="7" value="2"></label>
    </div>
    <canvas id="portrait" width="600" height="660" aria-label="Authored equipment on a staged character"></canvas>
    <p class="studio-note" id="equip-note"></p>
  </section>
  <section class="tool-panel studio-pack">
    <h2>Pack preview</h2>
    <p class="studio-note">The authored item placed by the real pack rules alongside staged loot. Click a staged item to load it into the editor.</p>
    <div class="inventory-pack"><div class="character-bag character-tetris" id="bag" style="--pack-columns:${PACK_COLUMNS}"></div>
    <p class="studio-pack-label">Charm rows</p>
    <div class="character-charm-grid character-tetris" id="charmbag" style="--pack-columns:${PACK_COLUMNS}"></div></div>
  </section>
  <section class="tool-panel">
    <h2>Variants</h2>
    <div class="studio-field-row">
      <label class="studio-field">Count<input id="vcount" type="number" min="1" max="48" value="12"></label>
    </div>
    <div class="studio-addrow"><button id="roll-variants" type="button">Roll variants</button></div>
    <p class="studio-note">Successive seeds of the current recipe. Click a variant to load it into the editor.</p>
    <div class="studio-variants" id="variants"></div>
    <div class="studio-dist" id="dist"></div>
  </section>
</div>`);

const form = root.querySelector('form')!;
const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
const el = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;

interface StudioRecipe extends Omit<ForgeRecipe, 'tier'> { tier: ItemTier | ''; }
interface StudioOverrides {
  weapon: { damage?: number; speed?: number };
  shield: { blockChance?: number; blockReduction?: number };
  implicit: { set: StatModifiers; remove: StatKey[] };
}
const emptyOverrides = (): StudioOverrides => ({ weapon: {}, shield: {}, implicit: { set: {}, remove: [] } });

const recipe: StudioRecipe = {
  seed: boundedNumber(q.get('seed'), 7319, 0, 4294967295),
  level: boundedNumber(q.get('level'), 10, 1, 1000000),
  kind: STUDIO_KINDS.includes(q.get('kind') as (typeof STUDIO_KINDS)[number]) ? q.get('kind') as (typeof STUDIO_KINDS)[number] : 'weapon',
  profile: q.get('profile') ?? '',
  tier: q.get('tier') === 'natural' ? '' : Object.hasOwn(TIER_NAMES, q.get('tier') ?? '') ? q.get('tier') as ItemTier : 'rare',
  material: q.get('material') ?? '',
  enhancement: boundedNumber(q.get('enhancement'), 0, 0, 10),
};

let draft: Item;
let overrides = emptyOverrides();
let variants: Item[] = [];
let packFillers: Item[] = [];
let staged: { sheet: CharacterSheet; equipped: boolean; message: string } | null = null;
let equipClass: WowClassId = 'warrior';

function rollItem(r: StudioRecipe): Item {
  return r.tier ? forgeItem({ ...r, tier: r.tier }) : deriveItem(generateItem(r.seed, r.level, r.kind, r.profile || undefined, undefined, (r.material || undefined) as ItemMaterialId | undefined));
}

/** Re-derive the draft from its recipe, then re-apply the studio's direct stat edits. */
function rebuild(): void {
  const d = draft;
  if (d.recipe.rolls.length > d.affixes.length) d.recipe.rolls.length = d.affixes.length;
  while (d.recipe.rolls.length < d.affixes.length) d.recipe.rolls.push(.5);
  const next = deriveItem(d), ov = overrides;
  next.name = d.name; next.flavor = d.flavor;
  if (next.weapon && (ov.weapon.damage !== undefined || ov.weapon.speed !== undefined)) {
    next.weapon = { ...next.weapon };
    if (ov.weapon.damage !== undefined) next.weapon.damage = Math.max(0, Math.round(ov.weapon.damage));
    if (ov.weapon.speed !== undefined) next.weapon.baseAttacksPerSecond = Math.max(.1, ov.weapon.speed);
  }
  if (next.shield && (ov.shield.blockChance !== undefined || ov.shield.blockReduction !== undefined)) {
    next.shield = { ...next.shield };
    if (ov.shield.blockChance !== undefined) next.shield.blockChance = Math.max(0, ov.shield.blockChance);
    if (ov.shield.blockReduction !== undefined) next.shield.blockReduction = Math.max(0, ov.shield.blockReduction);
  }
  next.implicit = { ...next.implicit, ...ov.implicit.set };
  for (const stat of ov.implicit.remove) delete next.implicit[stat];
  draft = roundItemStats(next);
}

function roll(): void {
  draft = rollItem(recipe);
  recipe.level = draft.itemLevel;
  recipe.enhancement = draft.recipe.enhancement;
  overrides = emptyOverrides();
  variants = [];
}

/** Load a rolled item (variant or staged pack item) into the editor. */
function adopt(item: Item): void {
  draft = cloneData(item);
  overrides = emptyOverrides();
  recipe.seed = draft.seed; recipe.level = draft.itemLevel; recipe.kind = draft.kind;
  recipe.profile = draft.recipe.profileId ?? ''; recipe.tier = draft.tier;
  recipe.material = draft.recipe.materialId ?? ''; recipe.enhancement = draft.recipe.enhancement;
  syncForm();
}

function profiles(): void {
  const kind = field('kind').value as ItemKind;
  field('profile').innerHTML = forgeProfiles(kind).map(p => `<option value="${p.id}">${e(p.name)}</option>`).join('') || '<option value="">Automatic</option>';
  materials();
}
function materials(): void {
  field('material').innerHTML = '<option value="">Rolled naturally</option>'
    + forgeMaterials(field('kind').value as ItemKind, field('profile').value).map(m => `<option value="${m.id}">${ITEM_MATERIALS[m.id].name}</option>`).join('');
}
function syncForm(): void {
  field('seed').value = String(recipe.seed);
  field('kind').value = recipe.kind;
  profiles();
  if (forgeProfiles(recipe.kind).some(p => p.id === recipe.profile)) field('profile').value = recipe.profile;
  recipe.profile = field('profile').value;
  materials();
  field('material').value = forgeMaterials(recipe.kind, recipe.profile).some(m => m.id === recipe.material) ? recipe.material : '';
  recipe.material = field('material').value;
  field('tier').value = recipe.tier;
}

/** Shared implicit-stat write: a set wins over a queued removal, then re-derive. */
function setImplicit(stat: StatKey, value: number): void {
  overrides.implicit.set[stat] = value;
  const i = overrides.implicit.remove.indexOf(stat); if (i >= 0) overrides.implicit.remove.splice(i, 1);
  rebuild();
}

// ---- Rendering -------------------------------------------------------------

const statLabel = (stat: StatKey): string => STAT_LABELS[stat] ?? stat;

function affixReadout(index: number): string {
  const a = draft.affixes[index], roll = draft.recipe.rolls[index] ?? 0;
  const discrete = discreteAffixValue(a.stat, roll, draft.itemLevel);
  const quality = discrete !== undefined ? `rank ${discrete}` : `×${itemRollMultiplier(roll).toFixed(2)}`;
  const greater = isGreaterAffix(draft, index) ? ' <span class="is-greater">✦ greater</span>' : '';
  return `${formatStatValue(a.stat, a.value)} · ${quality}${greater}`;
}

function renderEditor(): void {
  const d = draft;
  const implicitRows = Object.entries(d.implicit).map(([stat, value]) => `
    <div class="studio-statrow"><span title="${e(stat)}">${e(statLabel(stat as StatKey))}${PERCENT_STATS.has(stat as StatKey) ? ' %' : ''}</span>
      <input type="number" step="any" value="${value}" data-action="implicit" data-stat="${e(stat)}" aria-label="${e(statLabel(stat as StatKey))} value">
      <button type="button" class="studio-remove" data-action="implicit-remove" data-stat="${e(stat)}" aria-label="Remove ${e(statLabel(stat as StatKey))}">✕</button></div>`).join('');
  const implicitOptions = (Object.keys(STAT_LABELS) as StatKey[]).filter(s => !(s in d.implicit)).sort((a, b) => statLabel(a).localeCompare(statLabel(b)))
    .map(s => `<option value="${e(s)}">${e(statLabel(s))}</option>`).join('');
  const affixRows = d.affixes.map((a, i) => {
    const others = d.affixes.map(x => x.stat).filter((_, j) => j !== i);
    const options = itemAffixPool(d).filter(def => def.stat === a.stat || !affixConflicts(def.stat, others))
      .map(def => `<option value="${e(def.stat)}"${def.stat === a.stat ? ' selected' : ''}>${e(statLabel(def.stat))}</option>`).join('');
    return `<div class="studio-affix">
      <div class="studio-affix-head"><select data-action="affix-stat" data-index="${i}" aria-label="Affix ${i + 1} stat">${options}</select>
        <span class="studio-affix-name">${e(a.name)}</span>
        <button type="button" class="studio-remove" data-action="affix-remove" data-index="${i}" aria-label="Remove affix ${e(a.name)}">✕</button></div>
      <div class="studio-roll"><input type="range" min="0" max="1" step="0.01" value="${d.recipe.rolls[i] ?? 0}" data-action="affix-roll" data-index="${i}" aria-label="Roll quality for ${e(a.name)}">
        <input type="number" min="0" max="1" step="0.01" value="${d.recipe.rolls[i] ?? 0}" data-action="affix-roll" data-index="${i}" aria-label="Roll quality value for ${e(a.name)}">
        <output>${affixReadout(i)}</output></div></div>`;
  }).join('');
  const addOptions = itemAffixPool(d).filter(a => !affixConflicts(a.stat, d.affixes.map(x => x.stat)))
    .map(def => `<option value="${e(def.stat)}">${e(statLabel(def.stat))}</option>`).join('');
  const baseRows = d.weapon ? `
    <div class="studio-statrow"><span>Damage</span><input type="number" min="0" step="1" value="${d.weapon.damage}" data-action="base-damage" aria-label="Weapon damage"></div>
    <div class="studio-statrow"><span>Attacks / second</span><input type="number" min="0.1" step="0.05" value="${d.weapon.baseAttacksPerSecond}" data-action="base-speed" aria-label="Weapon speed"></div>`
    : d.shield ? `
    <div class="studio-statrow"><span>Block chance %</span><input type="number" min="0" step="1" value="${d.shield.blockChance}" data-action="base-block" aria-label="Block chance"></div>
    <div class="studio-statrow"><span>Damage blocked %</span><input type="number" min="0" step="1" value="${d.shield.blockReduction}" data-action="base-blockred" aria-label="Blocked damage reduction"></div>`
    : '<p class="studio-note">No weapon or shield base stats on this kind — tune implicit bonuses below.</p>';
  el('#editor').innerHTML = `
    <h2>Authoring</h2>
    <label class="studio-field">Name<input type="text" value="${e(d.name)}" data-action="name" maxlength="60"${d.tier === 'unique' ? ' disabled title="Unique names come from their definition"' : ''}></label>
    <div class="studio-field-row">
      <label class="studio-field">Item level<input type="number" min="1" max="1000000" value="${d.itemLevel}" data-action="level"></label>
      <label class="studio-field">Enhancement<input type="number" min="0" max="10" value="${d.recipe.enhancement}" data-action="enhancement"></label>
    </div>
    <label class="studio-field">Flavor text<input type="text" value="${e(d.flavor ?? '')}" data-action="flavor" maxlength="160" placeholder="Optional lore line"></label>
    <h3>Base stats</h3>${baseRows}
    <h3>Implicit bonuses</h3>${implicitRows || '<p class="studio-note">No implicit bonuses.</p>'}
    <div class="studio-addrow"><select data-action="implicit-add" aria-label="Implicit stat to add">${implicitOptions}</select>
      <button type="button" data-action="implicit-add-btn"${implicitOptions ? '' : ' disabled'}>Add</button></div>
    <h3>Affixes <small>(${d.affixes.length})</small></h3>${affixRows || '<p class="studio-note">No affixes — common items stay plain.</p>'}
    <div class="studio-addrow"><select data-action="affix-add" aria-label="Affix stat to add">${addOptions}</select>
      <button type="button" data-action="affix-add-btn"${addOptions ? '' : ' disabled'}>Add affix</button></div>
    <h3>Session</h3>
    <div class="studio-addrow"><button type="button" data-action="reset">Reset edits (re-roll)</button></div>`;
}

function stageEquip(): void {
  const d = draft;
  const sheet = createCharacterSheet(equipClass);
  sim.player.character = sheet;
  sim.player.level = d.itemLevel;
  if (d.kind === 'charm') {
    staged = { sheet, equipped: false, message: 'Charms ride in the pack — no equipment slot.' };
  } else if (addInventoryItem(sheet, d)) {
    const result = equipItem(sheet, sheet.inventory.findIndex(i => i?.id === d.id), sim.player.level);
    const slot = defaultEquipmentSlot(sheet, d);
    staged = {
      sheet, equipped: result.ok,
      message: result.ok ? `Equipped · ${slot ? EQUIPPED_LABELS[slot] : d.kind}` : result.message ?? 'Cannot equip this item.',
    };
  } else {
    staged = { sheet, equipped: false, message: 'Could not add the item to the staged pack.' };
  }
  refreshCharacter(sim.player);
}

function renderPreview(): void {
  const d = draft;
  el('#gear').innerHTML = itemIconSVG(d, 160);
  el('#tooltip').innerHTML = `<div class="ui-item-tooltip">${itemTooltipMarkup(d, {
    sheet: staged!.sheet, level: sim.player.level,
    equipped: staged!.equipped, compare: d.kind === 'charm' ? false : undefined,
  })}</div>`;
  el('#recipe').textContent = JSON.stringify(d, null, 2);
  el('.tool-status')!.textContent = `${itemDisplayName(d)} · ${TIER_NAMES[d.tier]} ${d.baseName} · seed ${d.seed} · item level ${d.itemLevel} · power ${d.power}`;
}

function renderRig(): void {
  const canvas = el<HTMLCanvasElement>('#portrait');
  drawCharacterPortrait(canvas.getContext('2d')!, sim.player, 2, Number(el<HTMLInputElement>('#facing').value) * Math.PI / 4, canvas.width, canvas.height);
  el('#equip-note').textContent = `${staged!.message} · ${WOW_CLASSES[equipClass].name} starter outfit; hand conflicts use the real inventory rules.`;
}

function renderPack(): void {
  const kinds: ItemKind[] = ['chest', 'weapon', 'ring', 'boots', 'charm', 'shield'];
  packFillers = kinds.map((kind, i) => generateItem(4021 + i * 733, Math.max(1, draft.itemLevel - (i % 3)), kind));
  const occupied = new Set<number>();
  const bagSlots: string[] = [], charmSlots: string[] = [];
  const place = (item: Item, authored: boolean, index: number) => {
    const cell = findPackSpace(item, occupied, undefined, item.kind === 'charm' ? 'charms' : 'bag');
    if (cell === null) return;
    for (const c of footprintCells(item, cell) ?? []) occupied.add(c);
    const size = itemFootprint(item);
    const row = Math.floor((cell >= PACK_CELLS ? cell - PACK_CELLS : cell) / PACK_COLUMNS);
    const markup = `<button type="button" class="character-bag-slot${authored ? ' is-authored' : ''}"${authored ? '' : ` data-filler="${index}"`}
      style="grid-column:${cell % PACK_COLUMNS + 1} / span ${size.width};grid-row:${row + 1} / span ${size.height}"
      aria-label="${e(itemDisplayName(item))}${authored ? ', authored item' : ', staged item — click to load'}">${itemPackIconSVG(item, size.width, size.height)}</button>`;
    (cell >= PACK_CELLS ? charmSlots : bagSlots).push(markup);
  };
  place(draft, true, -1);
  packFillers.forEach((item, i) => place(item, false, i));
  el('#bag').innerHTML = Array.from({ length: PACK_CELLS }, (_, cell) =>
    `<span class="character-grid-cell" style="grid-column:${cell % PACK_COLUMNS + 1};grid-row:${Math.floor(cell / PACK_COLUMNS) + 1}"></span>`).join('') + bagSlots.join('');
  el('#charmbag').innerHTML = Array.from({ length: PACK_COLUMNS * 4 }, (_, i) =>
    `<span class="character-grid-cell" style="grid-column:${i % PACK_COLUMNS + 1};grid-row:${Math.floor(i / PACK_COLUMNS) + 1}"></span>`).join('') + charmSlots.join('');
}

function renderVariants(): void {
  el('#variants').innerHTML = variants.map((item, i) => `
    <button type="button" data-variant="${i}" style="border-color:${TIER_COLORS[item.tier]}55" title="${e(itemDisplayName(item))}">
      ${itemIconSVG(item, 48)}<small>${e(item.name)}</small><small class="studio-variant-power">${TIER_NAMES[item.tier]} · ${item.power}</small></button>`).join('');
  if (!variants.length) { el('#dist').innerHTML = ''; return; }
  const counts = new Map<string, number>();
  for (const item of variants) for (const a of item.affixes) counts.set(a.stat, (counts.get(a.stat) ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1])
    .map(([stat, n]) => `<tr><td>${e(statLabel(stat as StatKey))}</td><td>${n}</td><td>${Math.round(n / variants.length * 100)}%</td></tr>`).join('');
  const tiers: Record<string, number> = {};
  for (const item of variants) tiers[item.tier] = (tiers[item.tier] ?? 0) + 1;
  const powers = variants.map(v => v.power);
  el('#dist').innerHTML = `<h3>Distribution · ${variants.length} rolls</h3>
    <p class="studio-note">Power ${Math.min(...powers)}–${Math.max(...powers)} · ${Object.entries(tiers).map(([t, n]) => `${n} ${TIER_NAMES[t as ItemTier]}`).join(', ')}</p>
    <table class="tool-table"><thead><tr><th>Affix stat</th><th>Rolls</th><th>Share</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function syncURL(): void {
  const params = new URLSearchParams({ seed: String(recipe.seed), level: String(recipe.level), kind: recipe.kind, tier: recipe.tier || 'natural', enhancement: String(recipe.enhancement) });
  if (recipe.profile) params.set('profile', recipe.profile);
  if (recipe.material) params.set('material', recipe.material);
  window.history.replaceState(null, '', `?${params}`);
  reportRoute();
}

function renderDynamic(): void {
  stageEquip();
  renderPreview();
  renderRig();
  renderPack();
}
function renderAll(): void {
  syncURL();
  renderEditor();
  renderDynamic();
  renderVariants();
}

// ---- Events ----------------------------------------------------------------

const sim = new Simulation({ blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) }, { spawn: false });
const status = (error: unknown) => { el('.tool-status')!.textContent = String(error); };

field('kind').addEventListener('change', profiles);
field('profile').addEventListener('change', materials);
const rollFromForm = () => {
  recipe.seed = Number(field('seed').value);
  recipe.kind = field('kind').value as ItemKind;
  recipe.profile = field('profile').value;
  recipe.tier = field('tier').value as ItemTier | '';
  recipe.material = field('material').value;
  try { roll(); renderAll(); } catch (error) { status(error); }
};
form.addEventListener('change', rollFromForm);
form.addEventListener('submit', event => { event.preventDefault(); rollFromForm(); });
root.querySelector('#random')!.addEventListener('click', () => {
  field('seed').value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
  rollFromForm();
});

const editor = el('#editor');
editor.addEventListener('input', event => {
  const target = event.target as HTMLInputElement;
  const action = target.dataset.action, index = Number(target.dataset.index);
  try {
    if (action === 'name') { draft.name = target.value.trim() || draft.baseName; renderDynamic(); }
    else if (action === 'flavor') { draft.flavor = target.value || undefined; renderDynamic(); }
    else if (action === 'base-damage' && draft.weapon) { overrides.weapon.damage = Number(target.value); rebuild(); renderDynamic(); }
    else if (action === 'base-speed' && draft.weapon) { overrides.weapon.speed = Number(target.value); rebuild(); renderDynamic(); }
    else if (action === 'base-block' && draft.shield) { overrides.shield.blockChance = Number(target.value); rebuild(); renderDynamic(); }
    else if (action === 'base-blockred' && draft.shield) { overrides.shield.blockReduction = Number(target.value); rebuild(); renderDynamic(); }
    else if (action === 'implicit') { setImplicit(target.dataset.stat as StatKey, Number(target.value)); renderDynamic(); }
    else if (action === 'affix-roll' && draft.affixes[index]) {
      draft.recipe.rolls[index] = Math.max(0, Math.min(1, Number(target.value)));
      rebuild();
      const row = target.closest('.studio-roll')!;
      row.querySelectorAll<HTMLInputElement>('input[data-action="affix-roll"]').forEach(input => { if (input !== target) input.value = target.value; });
      row.querySelector('output')!.innerHTML = affixReadout(index);
      renderDynamic();
    }
  } catch (error) { status(error); }
});
editor.addEventListener('change', event => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  const action = target.dataset.action, index = Number(target.dataset.index);
  try {
    if (action === 'level') {
      draft.itemLevel = Math.max(1, Math.min(1000000, Math.round(Number(target.value))));
      recipe.level = draft.itemLevel; rebuild(); renderAll();
    } else if (action === 'enhancement') {
      draft.recipe.enhancement = Math.max(0, Math.min(10, Math.round(Number(target.value))));
      recipe.enhancement = draft.recipe.enhancement; rebuild(); renderAll();
    } else if (action === 'affix-stat' && draft.affixes[index]) {
      const definition = itemAffixPool(draft).find(a => a.stat === target.value);
      if (definition) { draft.affixes[index] = { name: definition.name, stat: definition.stat, value: 0 }; rebuild(); renderAll(); }
    }
  } catch (error) { status(error); }
});
editor.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLElement>('[data-action]');
  if (!button || button.tagName === 'SELECT' || button.tagName === 'INPUT') return;
  const action = button.dataset.action, index = Number(button.dataset.index);
  try {
    if (action === 'affix-remove') {
      draft.affixes.splice(index, 1); draft.recipe.rolls.splice(index, 1); rebuild(); renderAll();
    } else if (action === 'affix-add-btn') {
      const select = editor.querySelector<HTMLSelectElement>('select[data-action="affix-add"]')!;
      const occupied = draft.affixes.map(a => a.stat);
      const definition = itemAffixPool(draft).find(a => a.stat === select.value && !affixConflicts(a.stat, occupied));
      if (definition) { draft.affixes.push({ name: definition.name, stat: definition.stat, value: 0 }); draft.recipe.rolls.push(.5); rebuild(); renderAll(); }
    } else if (action === 'implicit-remove') {
      const stat = button.dataset.stat as StatKey;
      delete overrides.implicit.set[stat];
      if (!overrides.implicit.remove.includes(stat)) overrides.implicit.remove.push(stat);
      rebuild(); renderAll();
    } else if (action === 'implicit-add-btn') {
      const select = editor.querySelector<HTMLSelectElement>('select[data-action="implicit-add"]')!;
      if (select.value) { setImplicit(select.value as StatKey, 1); renderAll(); }
    } else if (action === 'reset') { roll(); renderAll(); }
  } catch (error) { status(error); }
});

const classSelect = el<HTMLSelectElement>('#class');
classSelect.innerHTML = WOW_CLASS_IDS.map(id => `<option value="${id}">${WOW_CLASSES[id].name}</option>`).join('');
classSelect.value = equipClass;
classSelect.addEventListener('change', () => { equipClass = classSelect.value as WowClassId; renderDynamic(); });
el<HTMLInputElement>('#facing').addEventListener('input', renderRig);

el('.studio-pack').addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLElement>('[data-filler]');
  const item = button && packFillers[Number(button.dataset.filler)];
  if (item) { adopt(item); renderAll(); }
});
el('#variants').addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLElement>('[data-variant]');
  const item = button && variants[Number(button.dataset.variant)];
  if (item) { adopt(item); renderAll(); }
});
el('#roll-variants').addEventListener('click', () => {
  const count = Math.max(1, Math.min(48, Number(el<HTMLInputElement>('#vcount').value) || 12));
  try {
    variants = Array.from({ length: count }, (_, i) => rollItem({ ...recipe, seed: (recipe.seed + i) >>> 0 }));
    renderVariants();
  } catch (error) { status(error); }
});
el('#export').addEventListener('click', () => downloadJSON(`evergrow-item-${draft.seed}.json`, draft));

syncForm();
try { roll(); renderAll(); } catch (error) { status(error); }
