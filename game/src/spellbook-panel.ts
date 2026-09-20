/** Spellbook panel — WoW-style read-only listing of every skill the character's
 * class can learn (WOW_CLASS_SKILLS) plus the racial active (WOW_RACIAL_SKILLS),
 * grouped by damage school / role. Learned state reads the talent atlas ledger
 * (allocatedNodes via knowsSkill/learnedSkillRank); locked entries stay greyed
 * and show the unlock cost (1 skill point on the class sanctum node).
 * Never mutates state — learning happens in the skill atlas (T). */
import { skillRequirementLabel } from './skill-content.ts';
import { attachPanelFrame } from './panel-frames.ts';
import { SKILL_EXECUTION, skillDamageSuffix, skillUtilityLabel, type WowSkill } from './skill-execution-content.ts';
import { skillMechanicFacts } from './skill-mechanic-facts.ts';
import { skillIconSVG } from './skill-icon.ts';
import { SKILL_NODES } from './skill-tree.ts';
import { knowsSkill, learnedSkillRank, resolveSkill, selectedSpecialization, sheetClassId, sheetRaceId } from './skill-progression.ts';
import { WOW_CLASS_SKILLS, WOW_RACIAL_SKILLS } from './wow-skills.ts';
import { WOW_CLASSES } from './wow-classes.ts';
import { WOW_RACES } from './wow-races.ts';
import type { ResourceType, RuneKind, ShapeshiftForm } from './wow-types.ts';
import type { SkillId } from './character-types.ts';
import type { Player } from './model.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import './spellbook-panel.css';

const e = escapeUI;
type Filter = 'all' | 'learned' | 'locked';
const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'learned', label: 'Learned' }, { id: 'locked', label: 'Locked' },
];

/** Spellbook groups: damage schools first, then role buckets. */
const GROUP_ORDER = ['Physical', 'Fire', 'Frost', 'Lightning', 'Arcane', 'Holy', 'Shadow', 'Nature',
  'Restoration', 'Summons', 'Forms', 'Stealth', 'Mobility', 'Defense', 'Control', 'Enhancement', 'Utility'] as const;
type SpellGroup = typeof GROUP_ORDER[number];

/** Recipe → school. Projectile/ground/chain styles and dot schools are the authored damage element. */
const STYLE_SCHOOL: Record<string, SpellGroup> = {
  arrow: 'Physical', spirit: 'Shadow', radiant: 'Holy',
  physical: 'Physical', fire: 'Fire', frost: 'Frost', lightning: 'Lightning',
  arcane: 'Arcane', holy: 'Holy', shadow: 'Shadow', nature: 'Nature',
  bleed: 'Physical', poison: 'Nature',
};
interface FocusTrap { dispose(): void }
const SCHOOL_OVERRIDES: Partial<Record<SkillId, SpellGroup>> = {
  frostNova: 'Frost', coneOfCold: 'Frost', deepFreeze: 'Frost', chainsOfIce: 'Frost',
  dragonsBreath: 'Fire', entanglingRoots: 'Nature', earthbindTotem: 'Nature',
  psychicScream: 'Shadow', silence: 'Shadow', strangulate: 'Shadow',
  hammerOfJustice: 'Holy', repentance: 'Holy', freezingTrap: 'Frost',
};
const TIER_ORDER: Record<WowSkill['tier'], number> = { basic: 0, advanced: 1, ultimate: 2, aura: 3 };
const RUNE_LABELS: Record<RuneKind, string> = { blood: 'Blood', frost: 'Frost', unholy: 'Unholy' };
const FORM_LABELS: Record<ShapeshiftForm, string> = {
  bear: 'Bear Form', cat: 'Cat Form', moonkin: 'Moonkin Form', travel: 'Travel Form',
  shadow: 'Shadowform', metamorph: 'Metamorphosis', ghostWolf: 'Ghost Wolf',
};
const RESOURCE_LABELS: Record<ResourceType, string> = { mana: 'Mana', rage: 'Rage', energy: 'Energy', runicPower: 'Runic Power' };

/** Group a spell by its damage school; non-damaging recipes fall back to a role bucket. */
function spellGroup(skill: WowSkill): SpellGroup {
  const r = skill.execution;
  const override = SCHOOL_OVERRIDES[skill.id];
  if (override) return override;
  const school = 'school' in r && r.school ? r.school
    : r.kind === 'projectile' ? r.effects.style
    : r.kind === 'ground' || r.kind === 'chain' ? r.style
    : r.kind === 'radial' && r.style ? r.style
    : 'dot' in r && r.dot ? r.dot.school
    : undefined;
  if (school && STYLE_SCHOOL[school]) return STYLE_SCHOOL[school];
  switch (r.kind) {
    case 'heal': case 'hot': return 'Restoration';
    case 'summon': return 'Summons';
    case 'form': return 'Forms';
    case 'stealth': return 'Stealth';
    case 'step': case 'dash': return 'Mobility';
    case 'guard': case 'ward': return 'Defense';
    case 'cc': case 'interrupt': case 'pull': case 'taunt': return 'Control';
    case 'cleanse': return r.heal || r.hpCost ? 'Restoration' : r.resourceGain || r.resourceGainFrac ? 'Utility' : 'Defense';
    case 'buff': case 'stance': case 'aura':
      return r.kind === 'buff' && (r.buff.reduction !== undefined || r.buff.absorb !== undefined || r.buff.immunity) ? 'Defense' : 'Enhancement';
    case 'channel': return r.healFrac || r.manaPerTick ? 'Restoration' : 'Physical';
    default: return 'Physical';
  }
}

const seconds = (v: number) => `${Number(v.toFixed(1))}s`;

export class SpellbookPanel {
  readonly element: HTMLElement;
  private abort = new AbortController();
  private focus: FocusTrap | null = null;
  private filter: Filter = 'all';
  private query = '';
  private player: Player | null = null;
  private signature = '';
  private hooks: { close(): void; atlas?(skill: SkillId): void };

  constructor(mount: HTMLElement, hooks: { close(): void; atlas?(skill: SkillId): void }) {
    this.hooks = hooks;
    this.element = document.createElement('section');
    this.element.className = 'spellbook-panel';
    this.element.hidden = true;
    mount.append(this.element);
    attachPanelFrame(this.element, 'spellbook');
    this.element.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      if (b.dataset.close !== undefined) this.hooks.close();
      else if (b.dataset.filter) { this.filter = b.dataset.filter as Filter; this.render(); }
      else if (b.dataset.atlas) this.hooks.atlas?.(b.dataset.atlas as SkillId);
    }, { signal: this.abort.signal });
    this.element.addEventListener('input', event => {
      const input = event.target as HTMLInputElement;
      if (input.dataset.search === undefined) return;
      this.query = input.value.trim().toLowerCase();
      const caret = input.selectionStart ?? input.value.length;
      this.render();
      const restored = this.element.querySelector<HTMLInputElement>('input[data-search]');
      restored?.focus({ preventScroll: true });
      restored?.setSelectionRange(caret, caret);
    }, { signal: this.abort.signal });
  }

  get opened() { return !this.element.hidden; }

  /** Refresh the projection; re-renders only when the learned/cost ledger moved. */
  update(player: Player): void {
    this.player = player;
    if (this.element.hidden) return;
    const sheet = player.character;
    const signature = JSON.stringify([
      sheet.classId, sheet.raceId, sheet.allocatedNodes, sheet.skillRanks, sheet.activeSkillRanks,
      sheet.skillSpecializations, sheet.skillPoints,
      player.derived.manaCostMultiplier, player.derived.cooldownMultiplier,
    ]);
    if (signature !== this.signature) { this.signature = signature; this.render(); }
  }

  open(): void {
    this.signature = '';
    this.element.hidden = false;
    this.render();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal });
  }

  close(): void {
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
  }

  /** Cost line: runes, resource spend, soul shards, combo-point role. */
  private costLabel(skill: WowSkill, player: Player): string {
    const resolved = resolveSkill(skill.id, player.derived, player.character);
    const parts: string[] = [];
    if (skill.runeCost) {
      parts.push((Object.entries(skill.runeCost) as [RuneKind, number][])
        .map(([kind, n]) => `${n} ${RUNE_LABELS[kind]}`).join(' · ') + ' Rune' + (Object.values(skill.runeCost).reduce((a, b) => a + (b ?? 0), 0) > 1 ? 's' : ''));
    }
    if (resolved.mana > 0) {
      const resource = skill.resource ?? (skill.classId ? WOW_CLASSES[skill.classId].resource : 'mana');
      parts.push(`${resolved.mana} ${RESOURCE_LABELS[resource]}`);
    }
    if (skill.shardCost) parts.push(`${skill.shardCost} Soul Shard${skill.shardCost > 1 ? 's' : ''}`);
    const recipe = skill.execution;
    if (recipe.kind === 'cleanse' && recipe.hpCost) parts.push(`${Math.round(recipe.hpCost * 100)}% of max life`);
    const gain = 'resourceGain' in recipe && recipe.resourceGain ? recipe.resourceGain
      : recipe.kind === 'cleanse' && recipe.resourceGainFrac ? `${Math.round(recipe.resourceGainFrac * 100)}%` : 0;
    if (gain) parts.push(`Generates ${gain} resource`);
    if (skill.runicPowerGain) parts.push(`+${skill.runicPowerGain} Runic Power per rune`);
    if (skill.combo === 'build') parts.push('Builds combo points');
    if (skill.combo === 'spend') parts.push('Finishing move');
    return parts.length ? parts.join(' · ') : 'No cost';
  }

  private metaLine(skill: WowSkill, player: Player): string {
    const resolved = resolveSkill(skill.id, player.derived, player.character);
    const parts: string[] = [];
    if (resolved.damageMultiplier > 0)
      parts.push(`${Number(resolved.damageMultiplier.toFixed(2))}× damage${skillDamageSuffix(skill.id, resolved.recipe)}`);
    parts.push(this.costLabel(skill, player));
    parts.push(resolved.cooldown > 0 ? `${seconds(resolved.cooldown)} cooldown` : 'No cooldown');
    if (resolved.channel) parts.push(`Channeled ${seconds(resolved.channel.duration)}`);
    else parts.push(resolved.castTime ? `${seconds(resolved.castTime)} cast` : 'Instant');
    if (resolved.range) parts.push(`${Math.round(resolved.range / 14)} yd range`);
    if (resolved.offGcd) parts.push('Off GCD');
    return parts.join(' · ');
  }

  private tagLine(skill: WowSkill): string {
    const tags: string[] = [];
    if (skill.requirement !== 'any') tags.push(skillRequirementLabel(skill.requirement));
    if (skill.requiresForm) tags.push(`${FORM_LABELS[skill.requiresForm]} only`);
    if (skill.requiresStealth) tags.push('Requires Stealth');
    if (skill.requiresBehind) tags.push('Behind the target');
    if (skill.executeThreshold) tags.push(`Target below ${Math.round(skill.executeThreshold * 100)}%`);
    const mode = skill.targetMode ?? 'point';
    if (mode === 'enemy') tags.push('Enemy target');
    if (mode === 'self') tags.push('Self');
    return tags.join(' · ');
  }

  private spellRow(skill: WowSkill, player: Player, racial: boolean): string {
    const sheet = player.character;
    const known = racial || knowsSkill(sheet, skill.id);
    const rank = known ? learnedSkillRank(sheet, skill.id) : 0;
    const spec = known ? selectedSpecialization(sheet, skill.id) : undefined;
    const node = SKILL_NODES.get(`wow-${skill.classId}-${skill.id}`);
    const connected = !!node && node.neighbors.some(id => sheet.allocatedNodes.includes(id));
    const affordable = sheet.skillPoints >= 1;
    const facts = skillMechanicFacts(skill.id, SKILL_EXECUTION[skill.id]);
    const utility = skillUtilityLabel(skill.id);
    const tags = this.tagLine(skill);
    const status = racial
      ? '<span class="spellbook-rank is-known">Racial</span>'
      : known
        ? `<span class="spellbook-rank is-known">Rank ${rank}${spec ? ` · ${e(spec.name)}` : ''}</span>`
        : `<span class="spellbook-rank">Locked</span>`;
    const lock = !known && !racial
      ? `<div class="spellbook-lock">${uiIcon('diamond')}<span>Unlock: <strong>1 skill point</strong> in the talent atlas${connected ? '' : ' — connect its node first'}${affordable ? '' : ' — no skill points available'}</span>${this.hooks.atlas ? `<button type="button" class="ui-button ui-button--quiet spellbook-atlas" data-atlas="${e(skill.id)}">View in atlas</button>` : ''}</div>`
      : '';
    return `<article class="spellbook-spell ${known ? 'is-learned' : 'is-locked'}" data-spell="${e(skill.id)}">
      <span class="spellbook-icon" style="color:${e(skill.color)}">${skillIconSVG(skill.id, 30)}</span>
      <div class="spellbook-body">
        <div class="spellbook-head"><span class="spellbook-name">${e(skill.name)}</span>${status}</div>
        <div class="spellbook-meta">${e(this.metaLine(skill, player))}</div>
        <div class="spellbook-desc">${e(skill.description)}</div>
        ${facts && facts !== utility ? `<div class="spellbook-facts">${e(facts)}</div>` : ''}
        ${tags ? `<div class="spellbook-tags">${e(tags)}</div>` : ''}
        ${lock}
      </div></article>`;
  }

  private render(): void {
    const player = this.player;
    if (!player) return;
    const sheet = player.character;
    const classId = sheetClassId(sheet);
    const raceId = sheetRaceId(sheet);
    const cls = classId ? WOW_CLASSES[classId] : undefined;
    const race = raceId ? WOW_RACES[raceId] : undefined;
    const racial = raceId ? WOW_RACIAL_SKILLS[raceId] : undefined;
    const kit = classId ? WOW_CLASS_SKILLS[classId] : [];

    const groups = new Map<SpellGroup, WowSkill[]>();
    for (const skill of kit) {
      const group = spellGroup(skill);
      (groups.get(group) ?? groups.set(group, []).get(group)!).push(skill);
    }
    const matches = (skill: WowSkill) =>
      (this.filter === 'all' || (this.filter === 'learned') === knowsSkill(sheet, skill.id))
      && (!this.query || `${skill.name} ${skill.description}`.toLowerCase().includes(this.query));
    const sections = GROUP_ORDER.filter(g => groups.has(g)).map(group => {
      const spells = groups.get(group)!.filter(matches)
        .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.name.localeCompare(b.name));
      if (!spells.length) return '';
      const learned = spells.filter(s => knowsSkill(sheet, s.id)).length;
      return `<section class="spellbook-group"><h3 class="spellbook-group-title">${e(group)}<span class="spellbook-group-count">${learned}/${spells.length}</span></h3>
        <div class="spellbook-grid">${spells.map(s => this.spellRow(s, player, false)).join('')}</div></section>`;
    }).join('');
    const racialSection = racial && matches(racial)
      ? `<section class="spellbook-group"><h3 class="spellbook-group-title">Racial — ${e(race?.name ?? '')}<span class="spellbook-group-count">1/1</span></h3>
        <div class="spellbook-grid">${this.spellRow(racial, player, true)}</div></section>`
      : '';
    const total = kit.length + (racial ? 1 : 0);
    const learnedTotal = kit.filter(s => knowsSkill(sheet, s.id)).length + (racial ? 1 : 0);
    const empty = !sections && !racialSection
      ? `<div class="spellbook-empty">${kit.length ? 'No spells match this view.' : 'This character has no class spellbook.'}</div>` : '';

    const focus = (document.activeElement as HTMLElement | null)?.dataset;
    this.element.innerHTML = `<section class="ui-window spellbook-window" role="dialog" aria-modal="true" aria-labelledby="spellbook-title">
      <header class="ui-window-header"><span class="spellbook-heading-icon">${uiIcon('journal')}</span><h2 class="ui-title" id="spellbook-title">Spellbook</h2><button class="ui-button ui-button--icon" data-close aria-label="Close spellbook">×</button></header>
      <div class="spellbook-summary"><strong style="color:${e(cls?.color ?? '#e3ddc4')}">${e(cls?.name ?? 'Adventurer')}</strong><span>${e(race?.name ?? '')}</span><span class="spellbook-summary-spacer"></span><span><strong>${learnedTotal} / ${total}</strong> learned</span><span class="spellbook-points">${sheet.skillPoints} skill point${sheet.skillPoints === 1 ? '' : 's'}</span></div>
      <div class="spellbook-toolbar"><input type="search" data-search class="spellbook-search" placeholder="Search spells…" aria-label="Search spells" value="${e(this.query)}"><nav class="spellbook-filters" aria-label="Spellbook filters">${FILTERS.map(f => `<button data-filter="${f.id}" aria-pressed="${this.filter === f.id}">${f.label}</button>`).join('')}</nav></div>
      <div class="spellbook-list ui-scroll-area">${racialSection}${sections}${empty}</div>
      <footer class="ui-window-footer"><span>Learn spells in the talent atlas (T)</span><span>B / Esc <span>Close</span></span></footer></section>`;
    if (focus?.filter) this.element.querySelector<HTMLElement>(`[data-filter="${CSS.escape(focus.filter)}"]`)?.focus({ preventScroll: true });
  }

  dispose(): void {
    this.close();
    this.abort.abort();
    this.element.remove();
  }
}
