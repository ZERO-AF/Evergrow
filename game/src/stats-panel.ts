/** WoW-style character stats sheet — a read-only WotLK character-pane readout
 * grouped as Base / Melee / Ranged / Spell / Defenses / class Resource.
 * Every number is consumed from `player.derived`, `deriveAttackStats`,
 * `effectiveArmor`/`armorReduction`, `characterPower` and `resourceModelOf` —
 * the same derivations combat and the inventory panel use. Nothing is
 * recomputed here and the panel never mutates state.
 * Follows the AchievementPanel lifecycle: `update(player, simTime)` per frame,
 * `open()` / `close()` driven by the panel coordinator or `statsPanelToggle`. */
import { deriveAttackStats, alternatesBasicAttacks } from './equipment.ts';
import { attachPanelFrame } from './panel-frames.ts';
import { effectiveArmor } from './affix-combat.ts';
import { armorReduction } from './progression-content.ts';
import { characterPower } from './character-summary.ts';
import { manaCapacity } from './auras.ts';
import { resourceModelOf } from './player-skill-effects.ts';
import { wowClassOf } from './wow-classes.ts';
import { specIdentity } from './skill-progression.ts';
import { WOW_RACES } from './wow-races.ts';
import { isWowRaceId, WOW_COMBAT, type RuneKind, type WowClassDef } from './wow-types.ts';
import { ELEMENTS, RESISTANCE_LABELS } from './resistance-content.ts';
import { PLAYER_ABILITIES } from './combat-content.ts';
import { STAT_LABELS } from './items.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import type { Player, WeaponDefinition } from './model.ts';
import type { Attribute } from './character-types.ts';
import './stats-panel.css';

const e = escapeUI;
const n = (value: number, digits = 2) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
const pct = (value: number) => `${n(value * 100, 1)}%`;
const bonus = (multiplier: number) => `${multiplier >= 1 ? '+' : ''}${n((multiplier - 1) * 100, 1)}%`;

const ATTRIBUTES: readonly Attribute[] = ['strength', 'dexterity', 'intelligence', 'vitality'];
const RUNE_KINDS: readonly RuneKind[] = ['blood', 'blood', 'frost', 'frost', 'unholy', 'unholy'];
const RUNE_COLORS: Record<RuneKind, string> = { blood: '#c0392b', frost: '#5aa7d6', unholy: '#6fae4e' };
const RUNE_LABELS: Record<RuneKind, string> = { blood: 'Blood', frost: 'Frost', unholy: 'Unholy' };

interface StatPip { color: string; filled: boolean }
interface StatRow { label: string; value: string; hint?: string; dim?: boolean; pips?: StatPip[] }
interface StatGroup { title: string; rows: readonly StatRow[] }
interface FocusTrap { dispose(): void }

const WEAPON_ROW_LABELS = ['Damage', 'Damage per second', 'Attack speed', 'Attack power', 'Critical strike', 'Hit chance'] as const;
const EMPTY_WEAPON_ROWS: readonly StatRow[] = WEAPON_ROW_LABELS.map(label => ({ label, value: '—', dim: true }));

/** Per-weapon readout shared by the Melee and Ranged groups. */
function weaponRows(player: Player, weapon: WeaponDefinition, offHand = false): StatRow[] {
  const a = deriveAttackStats(player.stats, weapon);
  const s = player.derived;
  const prefix = offHand ? 'Off-hand ' : '';
  return [
    { label: `${prefix}Damage`, value: n(a.damage, 0), hint: `${weapon.name} · ${weapon.damageType}` },
    { label: `${prefix}Damage per second`, value: n(a.damage * a.attacksPerSecond, 1) },
    { label: `${prefix}Attack speed`, value: `${n(a.attacksPerSecond)} / sec`, hint: `${n(weapon.baseAttacksPerSecond)} base` },
    ...(offHand ? [] : [
      { label: 'Attack power', value: bonus(s.attackDamageMultiplier), hint: 'Physical damage bonus' },
      { label: 'Critical strike', value: pct(s.critChance), hint: `${pct(s.critMultiplier)} damage on crit` },
      { label: 'Hit chance', value: '100%', hint: 'Attacks always hit — there is no miss chance' },
    ]),
  ];
}

/** Class resource group: the primary pool plus runes / shards / combo points. */
function resourceGroup(player: Player, model: WowClassDef | undefined, simTime: number | undefined): StatGroup {
  const rows: StatRow[] = [];
  const cls = wowClassOf(player.character);
  const form = player.buffs?.find(buff => buff.form && buff.remaining > 0)?.form;
  if (form) rows.push({ label: 'Active form', value: `${form[0]!.toUpperCase()}${form.slice(1)} Form` });
  if (model) {
    const cap = model.resource === 'mana' ? manaCapacity(player) : model.resourceCap;
    rows.push({
      label: model.resourceLabel,
      value: `${n(Math.floor(Math.max(0, player.mana)), 0)} / ${n(cap, 0)}`,
      hint: model.resource === 'mana'
        ? `${n(player.derived.manaRegeneration)} regenerated per second`
        : model.resourceRegen > 0
          ? `+${n(model.resourceRegen, 0)} per second`
          : model.resourceDecay > 0
            ? `-${n(model.resourceDecay, 0)} per second out of combat · +${model.gainOnDeal} on hit dealt · +${model.gainOnHit} on hit taken`
            : undefined,
    });
    rows.push({ label: 'Global cooldown', value: `${n(model.gcd, 1)} sec` });
  }
  if (cls?.id === 'deathKnight') {
    const runes = player.runes ?? [];
    const ready = RUNE_KINDS.map((_, i) => simTime === undefined || (runes[i] ?? 0) <= simTime);
    const next = simTime === undefined ? 0 : Math.max(0, ...runes.map(r => r - simTime).filter(r => r > 0));
    rows.push({
      label: 'Runes',
      value: `${ready.filter(Boolean).length} / ${RUNE_KINDS.length} ready`,
      hint: `${next > 0 ? `Next rune in ${n(next, 1)}s · ` : ''}${n(WOW_COMBAT.runeRecharge, 0)}s recharge`,
      pips: RUNE_KINDS.map((kind, i) => ({ color: RUNE_COLORS[kind], filled: ready[i]! })),
    });
    const counts = RUNE_KINDS.map((kind, i) => `${RUNE_LABELS[kind]}${ready[i] ? '' : ' ↻'}`);
    rows.push({ label: 'Rune state', value: counts.join(' · '), dim: true });
  }
  if (cls?.id === 'warlock') {
    const shards = Math.max(0, Math.min(WOW_COMBAT.maxSoulShards, Math.floor(player.soulShards ?? 0)));
    rows.push({
      label: 'Soul shards', value: `${shards} / ${WOW_COMBAT.maxSoulShards}`,
      pips: Array.from({ length: WOW_COMBAT.maxSoulShards }, (_, i) => ({ color: '#9482C9', filled: i < shards })),
    });
  }
  if (cls?.id === 'rogue' || cls?.id === 'druid' || form === 'cat') {
    const combo = Math.max(0, Math.min(WOW_COMBAT.maxComboPoints, Math.floor(player.comboPoints ?? 0)));
    rows.push({
      label: 'Combo points', value: `${combo} / ${WOW_COMBAT.maxComboPoints}`,
      hint: combo ? 'On your current target' : 'Builders award points on the current target',
      pips: Array.from({ length: WOW_COMBAT.maxComboPoints }, (_, i) => ({ color: '#e3c15c', filled: i < combo })),
    });
  }
  return { title: 'Resource', rows };
}

/** The full WotLK-style sheet model; also the re-render signature source. */
function statsModel(player: Player, simTime: number | undefined): { groups: StatGroup[] } {
  const s = player.derived;
  const main = player.equipment.mainHand;
  const off = player.equipment.offHand;
  const armor = effectiveArmor(player);
  const shield = off?.kind === 'shield' ? off.shield : null;
  const model = resourceModelOf(player);

  const base: StatGroup = {
    title: 'Base Stats',
    rows: [
      ...ATTRIBUTES.map(attribute => ({ label: STAT_LABELS[attribute], value: n(s.attributes[attribute], 0) })),
      { label: 'Health', value: `${n(Math.ceil(Math.max(0, player.hp)), 0)} / ${n(player.maxHp, 0)}` },
    ],
  };

  const melee: StatGroup = {
    title: 'Melee',
    rows: main.attackKind === 'melee'
      ? [...weaponRows(player, main),
        ...(off?.kind === 'weapon' && alternatesBasicAttacks(player.equipment) ? weaponRows(player, off.weapon, true) : [])]
      : EMPTY_WEAPON_ROWS,
  };

  const ranged: StatGroup = {
    title: 'Ranged',
    rows: main.attackKind === 'arrow' ? weaponRows(player, main) : EMPTY_WEAPON_ROWS,
  };

  const spell: StatGroup = {
    title: 'Spell',
    rows: [
      { label: 'Spell power', value: bonus(s.spellDamageMultiplier), hint: 'Spell & elemental damage bonus' },
      ...(main.attackKind === 'bolt' ? [{ label: 'Bolt damage', value: n(deriveAttackStats(player.stats, main).damage, 0), hint: `${main.name} · ${main.damageType}` }] : []),
      { label: 'Cast speed', value: bonus(s.castSpeedMultiplier) },
      { label: 'Spell critical strike', value: pct(s.critChance) },
      { label: 'Mana per 5 sec', value: model?.resource === 'mana' || !model ? n(s.manaRegeneration * 5, 1) : '—', dim: !(model?.resource === 'mana' || !model) },
    ],
  };

  const defenses: StatGroup = {
    title: 'Defenses',
    rows: [
      { label: 'Armor', value: n(armor, 0) },
      { label: 'Damage reduction', value: pct(armorReduction(armor, player.level)), hint: `Physical, vs level ${player.level} attackers` },
      { label: 'Block chance', value: shield ? pct(s.blockChance) : '—', dim: !shield, hint: shield ? `${n(shield.blockChance)}% shield base` : 'Requires a shield' },
      { label: 'Block reduction', value: shield ? pct(s.blockReduction) : '—', dim: !shield, hint: shield ? `${n(shield.blockReduction)}% shield base` : 'Requires a shield' },
      { label: 'Dodge', value: `${player.dodgeCharges} / ${PLAYER_ABILITIES.dodge.charges} charges`, hint: 'Active dodge grants brief invulnerability' },
      ...ELEMENTS.map(element => ({ label: RESISTANCE_LABELS[`${element}Resistance`], value: pct(s.resistances[element]) })),
    ],
  };

  return { groups: [base, melee, ranged, spell, defenses, resourceGroup(player, model, simTime)] };
}

export class StatsPanel {
  readonly element: HTMLElement;
  private abort = new AbortController();
  private focus: FocusTrap | null = null;
  private player: Player | null = null;
  private simTime: number | undefined;
  private signature = '';
  private hooks: { close(): void };

  constructor(mount: HTMLElement, hooks: { close(): void }) {
    this.hooks = hooks;
    this.element = document.createElement('section');
    this.element.className = 'stats-panel';
    this.element.hidden = true;
    mount.append(this.element);
    attachPanelFrame(this.element, 'stats');
    this.element.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (b?.dataset.close !== undefined) this.hooks.close();
    }, { signal: this.abort.signal });
  }

  get opened() { return !this.element.hidden; }

  /** Refresh the projection; re-renders only when a displayed value changed. */
  update(player: Player, simTime?: number): void {
    this.player = player;
    this.simTime = simTime;
    if (this.element.hidden) return;
    const model = statsModel(player, simTime);
    const signature = JSON.stringify([player.name, player.level, specIdentity(player.character), model]);
    if (signature !== this.signature) { this.signature = signature; this.render(model); }
  }

  open(): void {
    this.signature = '';
    this.element.hidden = false;
    if (this.player) this.update(this.player, this.simTime);
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal });
  }

  close(): void {
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
  }

  private row(row: StatRow): string {
    const pips = row.pips
      ? `<span class="stats-pips">${row.pips.map(p => `<i class="stats-pip ${p.filled ? 'is-filled' : ''}" style="--pip:${p.color}"></i>`).join('')}</span>`
      : '';
    return `<div class="stats-row ${row.dim ? 'is-dim' : ''}"${row.hint ? ` title="${e(row.hint)}"` : ''}>
      <dt class="stats-label">${e(row.label)}</dt>
      <dd class="stats-value">${pips}${e(row.value)}</dd></div>`;
  }

  private render(model: { groups: StatGroup[] }): void {
    const player = this.player;
    if (!player) return;
    const cls = wowClassOf(player.character);
    const race = isWowRaceId(player.character.raceId) ? WOW_RACES[player.character.raceId] : undefined;
    const power = characterPower(player);
    const identity = cls && race
      ? `Level ${player.level} ${e(race.name)} <b style="color:${cls.color}">${e(specIdentity(player.character) || cls.name)}</b>`
      : `Level ${player.level}`;
    this.element.innerHTML = `<section class="ui-window stats-window" role="dialog" aria-modal="true" aria-labelledby="stats-title">
      <header class="ui-window-header"><span class="stats-heading-icon">${uiIcon('character')}</span><h2 class="ui-title" id="stats-title">${e(player.name || 'Character')}</h2><button class="ui-button ui-button--icon" data-close aria-label="Close character stats">×</button></header>
      <div class="stats-identity"><span>${identity}</span><span class="stats-power" title="Comparative equipment and build estimate">Power ${n(power.power, 0)} · ${n(power.dps, 1)} dps</span></div>
      <div class="stats-groups ui-scroll-area">${model.groups.map(group => `<section class="stats-group" aria-label="${e(group.title)}">
        <h3>${e(group.title)}</h3><dl>${group.rows.map(row => this.row(row)).join('')}</dl></section>`).join('')}</div>
      <footer class="ui-window-footer"><span></span><span>Esc <span>Close</span></span></footer></section>`;
  }

  dispose(): void {
    this.close();
    this.abort.abort();
    this.element.remove();
  }
}

/** Panel toggle for the integrator's input/panel wiring (no dedicated keybind exists). */
export function statsPanelToggle(panel: StatsPanel): void {
  if (panel.opened) panel.close(); else panel.open();
}
