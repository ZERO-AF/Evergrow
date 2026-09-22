/** Professions panel (docs/wow-deepening.md §3): skill bars, recipe list with WoW
 * difficulty colors, material counts, disenchanting, and consumable use.
 * Presentation only — every mutation routes through profession-command hooks. */
import type { Player } from './model.ts';
import type { EquipmentSlot, StatKey } from './character-types.ts';
import { attachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { ENCHANTS, enchantDefinition } from './enchant-content.ts';
import { TIER_COLORS, STAT_LABELS, formatStatValue, itemDisplayName } from './items.ts';
import { enchantTargets, type EnchantTarget } from './enchant-command.ts';
import {
  PROFESSIONS, PROFESSION_IDS, PROFESSION_MATERIALS, PROFESSION_RULES, DIFFICULTY_COLORS, GATHER_NODES,
  skillDifficulty, type ProfessionId, type RecipeDef,
} from './profession-content.ts';
import {
  allMaterials, disenchantYield, disenchantableItems, materialCount,
  missingMaterials, professionLevel, professionProgress,
} from './profession-state.ts';
import './profession-panel.css';

const e = escapeUI;
export interface ProfessionPanelHooks {
  close(): void;
  craft(recipeId: string): void;
  disenchant(inventoryIndex: number): void;
  use(materialId: string): void;
  /** Apply a permanent enchant (enchant-command.ts) to a bag or equipped item. */
  enchant(enchantId: string, target: EnchantTarget): void;
}

const KIND_LABELS: Record<string, string> = {
  herb: 'Herbs', ore: 'Ore', stone: 'Stone', bar: 'Bars', leather: 'Leather & hides',
  meat: 'Meat', fish: 'Fish', essence: 'Enchanting', gem: 'Gems', part: 'Parts', product: 'Crafted',
};


export class ProfessionPanel {
  readonly element: HTMLElement;
  private abort = new AbortController();
  private focus: ReturnType<typeof trapDialogFocus> | null = null;
  private player: Player | null = null;
  private selected: ProfessionId = 'herbalism';
  private signature = '';
  /** Selected permanent enchant awaiting a target pick (enchanting tab). */
  private pendingEnchant: string | null = null;
  private readonly hooks: ProfessionPanelHooks;

  constructor(mount: HTMLElement, hooks: ProfessionPanelHooks) {
    this.hooks = hooks;
    this.element = document.createElement('section');
    this.element.className = 'profession-panel';
    this.element.hidden = true;
    mount.append(this.element);
    attachPanelFrame(this.element, 'professions');
    this.element.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || !this.player) return;
      if (b.dataset.close !== undefined) this.hooks.close();
      else if (b.dataset.prof) { this.selected = b.dataset.prof as ProfessionId; this.pendingEnchant = null; this.render(); }
      else if (b.dataset.craft) this.hooks.craft(b.dataset.craft);
      else if (b.dataset.disenchant) this.hooks.disenchant(Number(b.dataset.disenchant));
      else if (b.dataset.use) this.hooks.use(b.dataset.use);
      else if (b.dataset.enchant) { this.pendingEnchant = this.pendingEnchant === b.dataset.enchant ? null : b.dataset.enchant; this.render(); }
      else if (b.dataset.enchantTarget && this.pendingEnchant) {
        const [kind, value] = b.dataset.enchantTarget.split(':');
        const target: EnchantTarget = kind === 'equipped' ? { equipped: value as EquipmentSlot } : { bag: Number(value) };
        this.hooks.enchant(this.pendingEnchant, target);
      }
    }, { signal: this.abort.signal });
  }

  /** Refresh the projection; re-renders only when open and the signature moved. */
  update(player: Player): void {
    this.player = player;
    if (this.element.hidden) return;
    const signature = JSON.stringify([
      player.professions, (player.fishing as { materials?: Record<string, number> } | undefined)?.materials, player.character.inventory.length,
      player.character.inventory.filter(Boolean).length, player.hp,
      player.character.inventory.map(i => i?.enchant), Object.values(player.character.equipped).map(i => i?.enchant), this.pendingEnchant,
    ]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.render();
  }

  open(profession?: ProfessionId): void {
    if (profession) this.selected = profession;
    this.element.hidden = false;
    this.signature = '';
    this.render();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal });
  }
  close(): void { this.focus?.dispose(); this.focus = null; this.element.hidden = true; }
  dispose(): void { this.close(); this.abort.abort(); this.element.remove(); }

  private skillBar(id: ProfessionId): string {
    const progress = professionProgress(this.player!, id);
    const level = professionLevel(this.player!, id);
    const need = PROFESSION_RULES.xpForLevel(level);
    return `<div class="prof-skill-bar" role="meter" aria-label="${e(PROFESSIONS[id].name)} skill ${level} of ${PROFESSION_RULES.maxSkill}"
      aria-valuemin="0" aria-valuemax="${PROFESSION_RULES.maxSkill}" aria-valuenow="${level}">
      <span style="width:${level / PROFESSION_RULES.maxSkill * 100}%"></span></div>
      <small>${progress ? `${level} / ${PROFESSION_RULES.maxSkill}` : 'Not started'}${progress && level < PROFESSION_RULES.maxSkill ? ` · ${progress.xp}/${need} xp` : ''}</small>`;
  }

  private recipeRow(recipe: RecipeDef): string {
    const player = this.player!;
    const level = professionLevel(player, this.selected);
    const difficulty = skillDifficulty(recipe.skill, level);
    const learnable = level >= recipe.skill[0];
    const missing = missingMaterials(player, recipe.materials);
    const mats = Object.entries(recipe.materials).map(([id, need]) => {
      const have = materialCount(player, id), short = have < need;
      return `<span class="prof-mat ${short ? 'is-missing' : ''}" data-tooltip="${e(PROFESSION_MATERIALS[id]?.name ?? id)}: ${have}/${need}">${e(PROFESSION_MATERIALS[id]?.name ?? id)} ${have}/${need}</span>`;
    }).join('');
    const result = recipe.item
      ? `<span style="color:${TIER_COLORS[recipe.item.tier]}">${e(recipe.name)}</span>`
      : `${e(recipe.name)}${recipe.resultCount > 1 ? ` ×${recipe.resultCount}` : ''}`;
    const problem = !learnable ? `Requires skill ${recipe.skill[0]}` : Object.keys(missing).length ? 'Missing materials' : '';
    return `<li class="prof-recipe" data-difficulty="${difficulty}">
      <button data-craft="${e(recipe.id)}" ${problem ? 'disabled' : ''} data-tooltip="${e(problem || `Craft ${recipe.name}`)}">
        <span class="prof-recipe-name" style="color:${DIFFICULTY_COLORS[difficulty]}">${result}</span>
        <span class="prof-recipe-mats">${mats}</span>
      </button></li>`;
  }

  private disenchantSection(): string {
    if (this.selected !== 'enchanting') return '';
    const items = disenchantableItems(this.player!);
    if (!items.length) return `<p class="prof-empty">No magic-or-better items in your bags to disenchant.</p>`;
    return `<h3>Disenchant</h3><ul class="prof-disenchant">${items.map(({ index, item }) => {
      const yields = disenchantYield(item).map(y => PROFESSION_MATERIALS[y.id]?.name ?? y.id).join(', ');
      return `<li><button data-disenchant="${index}" data-tooltip="Yields: ${e(yields)}">
        <span style="color:${TIER_COLORS[item.tier]}">${e(item.name)}</span><small>ilvl ${item.itemLevel}</small></button></li>`;
    }).join('')}</ul>`;
  }

  /** Permanent enchants (enchant-content.ts): pick an enchant, then a target item.
   * These bind to the item itself — unlike the timed scroll recipes above. */
  private enchantSection(): string {
    if (this.selected !== 'enchanting') return '';
    const player = this.player!;
    const level = professionLevel(player, 'enchanting');
    const rows = ENCHANTS.map(def => {
      const difficulty = skillDifficulty(def.skill, level);
      const missing = missingMaterials(player, def.materials);
      const stats = Object.entries(def.stats).map(([stat, value]) =>
        `${STAT_LABELS[stat as StatKey] ?? stat} ${formatStatValue(stat as StatKey, value!)}`).join(', ');
      const mats = Object.entries(def.materials).map(([id, need]) =>
        `${e(PROFESSION_MATERIALS[id]?.name ?? id)} ${materialCount(player, id)}/${need}`).join(', ');
      const problem = level < def.skill[0] ? `Requires Enchanting ${def.skill[0]}` : Object.keys(missing).length ? 'Missing materials' : '';
      const active = this.pendingEnchant === def.id;
      return `<li class="prof-recipe" data-difficulty="${difficulty}">
        <button data-enchant="${e(def.id)}" ${problem ? 'disabled' : ''} aria-pressed="${active}"
          data-tooltip="${e(problem || `${stats} — ${mats}`)}">
          <span class="prof-recipe-name" style="color:${DIFFICULTY_COLORS[difficulty]}">${e(def.name)}</span>
          <span class="prof-recipe-mats">${e(stats)}</span></button></li>`;
    }).join('');
    let targets = '';
    if (this.pendingEnchant) {
      const def = ENCHANTS.find(d => d.id === this.pendingEnchant)!;
      const options = enchantTargets(player.character, def.id);
      targets = options.length
        ? `<ul class="prof-disenchant">${options.map(({ target, item }) => {
            const key = 'equipped' in target ? `equipped:${target.equipped}` : `bag:${target.bag}`;
            const where = 'equipped' in target ? target.equipped : 'bag';
            const current = item.enchant ? ` · ${e(enchantDefinition(item.enchant)?.name ?? item.enchant)}` : '';
            return `<li><button data-enchant-target="${key}" ${item.enchant ? 'disabled' : ''}
              data-tooltip="${item.enchant ? 'Already enchanted' : `Enchant ${e(itemDisplayName(item))}`}">
              <span style="color:${TIER_COLORS[item.tier]}">${e(itemDisplayName(item))}</span><small>${e(where)}${current}</small></button></li>`;
          }).join('')}</ul>`
        : `<p class="prof-empty">No ${def.kinds.join('/')} item to enchant.</p>`;
    }
    return `<h3>Enchant Item</h3><ul class="prof-recipes">${rows}</ul>${targets}`;
  }

  private materialsSection(): string {
    const mats = allMaterials(this.player!);
    if (!mats.length) return `<p class="prof-empty">No materials yet. Gather herbs, ore and carcasses out in the world.</p>`;
    const groups = new Map<string, { def: (typeof mats)[number]['def']; count: number }[]>();
    for (const entry of mats) {
      const list = groups.get(entry.def.kind) ?? [];
      list.push(entry); groups.set(entry.def.kind, list);
    }
    return [...groups.entries()].map(([kind, entries]) =>
      `<h4>${KIND_LABELS[kind] ?? kind}</h4><ul class="prof-materials">${entries.map(({ def, count }) => {
        const usable = def.use ? `<button data-use="${e(def.id)}" data-tooltip="Use ${e(def.name)}">` : '<span>';
        const close = def.use ? '</button>' : '</span>';
        return `<li>${usable}<span class="prof-mat-name">${e(def.name)}</span><small>×${count}</small>${close}</li>`;
      }).join('')}</ul>`).join('');
  }

  private render(): void {
    const player = this.player;
    if (!player) return;
    const def = PROFESSIONS[this.selected];
    const recipes = def.recipes ?? [];
    const tabs = PROFESSION_IDS.map(id => {
      const p = PROFESSIONS[id], active = id === this.selected;
      return `<button data-prof="${id}" aria-pressed="${active}" class="${p.kind}">${e(p.name)}</button>`;
    }).join('');
    const focus = (document.activeElement as HTMLElement | null)?.dataset;
    this.element.innerHTML = `<section class="ui-window profession-window" role="dialog" aria-modal="true" aria-labelledby="profession-title">
      <header class="ui-window-header"><span class="profession-heading-icon">${uiIcon('skilltree')}</span>
        <h2 class="ui-title" id="profession-title">Professions</h2>
        <button class="ui-button ui-button--icon" data-close aria-label="Close professions">×</button></header>
      <nav class="profession-tabs" aria-label="Professions">${tabs}</nav>
      <div class="profession-body">
        <section class="profession-detail">
          <div class="profession-detail-head"><h3>${e(def.name)}</h3>${this.skillBar(this.selected)}</div>
          ${def.nodes?.length ? `<p class="prof-hint">Gather ${def.nodes.map(n => e(GATHER_NODES[n]?.name ?? n)).join(', ')} nodes in the wild — walk up and press E.</p>` : ''}
          ${recipes.length ? `<ul class="prof-recipes">${recipes.map(r => this.recipeRow(r)).join('')}</ul>` : ''}
          ${this.disenchantSection()}
          ${this.enchantSection()}
        </section>
        <aside class="profession-bag"><h3>Materials</h3>${this.materialsSection()}</aside>
      </div></section>`;
    if (focus?.prof) this.element.querySelector<HTMLElement>(`[data-prof="${CSS.escape(focus.prof)}"]`)?.focus({ preventScroll: true });
    else if (focus?.craft) this.element.querySelector<HTMLElement>(`[data-craft="${CSS.escape(focus.craft)}"]`)?.focus({ preventScroll: true });
  }
}
