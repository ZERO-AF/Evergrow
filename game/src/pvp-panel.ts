/** Arena & Battleground setup window (T04): one ui-window wizard reached from the pause
 * menu, the title-screen Arena page and city battlemasters. Steps: mode → bracket →
 * teammates → review (saved character or Custom build). Queue/Enter emits a `PvpSetup`
 * through `PvpPanelActions.enter` — the match controller (T06/T07) consumes it there.
 *
 * All state lives in `PvpSetupDraft` (pvp-setup.ts); the panel only renders it. The
 * Custom build's appearance step reuses the character-editor `study` sheet — unsaved,
 * discarded with the draft. */
import { attachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { npcEmblem } from './npc-art.ts';
import { createAppearanceEditor, type AppearanceEditor } from './character-editor.ts';
import { createCharacterSheet } from './items.ts';
import { itemIconSVG } from './item-art.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { pvpGearOptions, resolveGearPick } from './pvp-chargen.ts';
import type { EquipmentSlot } from './character-types.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import { PAD, type GamepadInput } from './gamepad-input.ts';
import { WOW_CLASSES } from './wow-classes.ts';
import { WOW_RACES, raceAllowsClass } from './wow-races.ts';
import { WOW_CLASS_IDS, WOW_RACE_IDS, isWowClassId, isWowRaceId, type WowClassId, type WowRaceId } from './wow-types.ts';
import type { Battlemaster } from './npcs.ts';
import {
  PVP_ARENA_BRACKETS, PVP_BATTLEGROUNDS, PVP_LEVEL_MAX, PVP_LEVEL_MIN, PVP_WIZARD_STEPS,
  createCustomBuild, createPvpDraft, pvpBracketLabel, pvpClassRoles, pvpRoleLabel, pvpTeamSize,
  setCustomClass, setCustomRace, setPvpBracket, setPvpMode, setTeammateClass, setTeammateRole, validPvpSetup,
  type PvpBracket, type PvpCustomBuild, type PvpRole, type PvpSetup, type PvpSetupDraft, type PvpWizardStep,
} from './pvp-setup.ts';
import './pvp-panel.css';

const e = escapeUI;
const ROLE_ICONS = { heal: 'plus', tank: 'shield', dd: 'sword' } as const;
const STEP_LABELS: Record<PvpWizardStep, string> = { mode: 'Mode', bracket: 'Bracket', team: 'Team', review: 'Review' };

/** What the host (game.ts / title screen) provides. `character()` is null when no save
 * is loaded — the wizard then requires a Custom build to enter. */
export interface PvpPanelActions {
  close(): void;
  character(): { name: string; level: number; classId: WowClassId; raceId: WowRaceId } | null;
  /** Queue/Enter hand-off: receives the validated setup. The integrator wires this to
   * the match controller (T06 arena / T07 battlegrounds). */
  enter(setup: PvpSetup): void;
}
/** The title screen mounts the panel through this narrow handle (TitleActions.arena). */
export interface PvpPanelHandle {
  open(): void; close(): void; dispose(): void;
  updateGamepad?(pad: GamepadInput, now: number): boolean;
}

export class PvpPanel implements PvpPanelHandle {
  readonly element: HTMLElement;
  private readonly actions: PvpPanelActions;
  private readonly embedded: boolean;
  private abort = new AbortController();
  private focus: { dispose(): void } | null = null;
  private controller = new GamepadMenu();
  private draft: PvpSetupDraft = createPvpDraft();
  private editor: AppearanceEditor | null = null;
  private master: Battlemaster | null = null;
  private tooltip: ItemTooltip;

  constructor(mount: HTMLElement, actions: PvpPanelActions, embedded = false) {
    this.actions = actions;
    this.embedded = embedded;
    this.element = document.createElement('div');
    this.element.className = 'pvp-panel' + (embedded ? ' home-embedded' : '');
    this.element.hidden = true;
    mount.append(this.element);
    if (!embedded) attachPanelFrame(this.element, 'arena');
    this.tooltip = new ItemTooltip(this.element, 'pvp-gear-tooltip');
    const signal = this.abort.signal;
    this.element.addEventListener('click', event => this.click(event), { signal });
    this.element.addEventListener('input', event => {
      const input = event.target as HTMLInputElement;
      if (input.dataset.pvpLevel !== undefined && this.draft.custom) {
        this.draft.custom.level = Math.max(PVP_LEVEL_MIN, Math.min(PVP_LEVEL_MAX, Math.round(input.valueAsNumber || PVP_LEVEL_MIN)));
        const out = this.element.querySelector<HTMLOutputElement>('[data-pvp-level-out]');
        if (out) out.textContent = `Level ${this.draft.custom.level}`;
      }
    }, { signal });
    this.element.addEventListener('change', event => {
      const control = event.target as HTMLSelectElement;
      if (control.dataset.pvpGear !== undefined && this.draft.custom) {
        const slot = control.dataset.pvpGear as EquipmentSlot;
        const gear = { ...(this.draft.custom.gear ?? {}) };
        if (control.value === '') delete gear[slot]; else gear[slot] = Number(control.value);
        this.draft.custom.gear = Object.keys(gear).length ? gear : undefined;
        this.render();
        return;
      }
      if (control.dataset.pvpClass !== undefined && isWowClassId(control.value)) {
        setTeammateClass(this.draft, Number(control.dataset.pvpClass), control.value);
        this.render();
      }
    }, { signal });
    this.element.addEventListener('mouseover', event => {
      const row = (event.target as HTMLElement).closest<HTMLElement>('[data-pvp-gear-row]');
      if (!row || !this.draft.custom) return;
      const slot = row.dataset.pvpGearRow as EquipmentSlot;
      const options = this.gearOptions(slot);
      if (!options.length) return;
      const seed = this.draft.custom.gear?.[slot] ?? options[0]!.seed;
      const item = resolveGearPick(this.draft.custom.classId, slot, seed, this.gearItemLevel());
      if (item) this.tooltip.show(item, { sheet: createCharacterSheet(this.draft.custom.classId, this.draft.custom.raceId), level: this.draft.custom.level, compare: false }, row);
    }, { signal });
    this.element.addEventListener('mouseout', event => {
      if ((event.target as HTMLElement).closest('[data-pvp-gear-row]')) this.tooltip.hide();
    }, { signal });
    this.element.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      if (!this.editor) this.actions.close();
    }, { signal });
  }

  get opened() { return !this.element.hidden; }

  open(master: Battlemaster | null = null): void {
    this.master = master;
    this.draft = createPvpDraft();
    this.element.hidden = false;
    this.render();
    this.focus?.dispose();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal, initialFocus: this.element, restoreFocus: false });
  }

  close(): void {
    this.tooltip.hide();
    this.editor?.dispose();
    this.editor = null;
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
    this.master = null;
    this.controller.clear();
  }

  dispose(): void {
    this.tooltip.dispose();
    this.close();
    this.abort.abort();
    this.element.remove();
  }

  updateGamepad(pad: GamepadInput, now: number): boolean {
    if (!this.opened) return false;
    if (this.editor) { this.editor.updateGamepad(pad, now); return true; }
    if (pad.pressed.has(PAD.dodge) || pad.pressed.has(PAD.pause)) { this.actions.close(); return true; }
    this.controller.update(this.element, pad, now);
    return true;
  }

  private click(event: MouseEvent): void {
    const control = (event.target as HTMLElement).closest<HTMLElement>('[data-close],[data-pvp-step],[data-pvp-mode],[data-pvp-bracket],[data-pvp-role],[data-pvp-playas],[data-pvp-custom-class],[data-pvp-custom-race],[data-pvp-custom-role],[data-pvp-appearance],[data-pvp-back],[data-pvp-next],[data-pvp-enter]');
    if (!control || (control as HTMLButtonElement).disabled || control.getAttribute('aria-disabled') === 'true') return;
    const d = control.dataset, draft = this.draft;
    if (d.close !== undefined) { this.actions.close(); return; }
    if (d.pvpStep) { draft.step = d.pvpStep as PvpWizardStep; this.render(); return; }
    if (d.pvpMode) { setPvpMode(draft, d.pvpMode as PvpSetup['mode']); this.render(); return; }
    if (d.pvpBracket) { setPvpBracket(draft, d.pvpBracket as PvpBracket); this.render(); return; }
    if (d.pvpRole) { setTeammateRole(draft, Number(d.pvpRole), control.dataset.value as PvpRole); this.render(); return; }
    if (d.pvpPlayas) {
      const character = this.actions.character();
      draft.custom = d.pvpPlayas === 'custom' ? createCustomBuild(character?.classId ?? 'warrior', character?.raceId ?? 'human') : null;
      this.render(); return;
    }
    if (d.pvpCustomClass && draft.custom && isWowClassId(d.pvpCustomClass)) { setCustomClass(draft.custom, d.pvpCustomClass); this.render(); return; }
    if (d.pvpCustomRace && draft.custom && isWowRaceId(d.pvpCustomRace)) { setCustomRace(draft.custom, d.pvpCustomRace); this.render(); return; }
    if (d.pvpCustomRole && draft.custom) { draft.custom.role = d.pvpCustomRole as PvpRole; this.render(); return; }
    if (d.pvpAppearance !== undefined) { this.openAppearanceEditor(); return; }
    if (d.pvpBack !== undefined) { draft.step = PVP_WIZARD_STEPS[PVP_WIZARD_STEPS.indexOf(draft.step) - 1] ?? draft.step; this.render(); return; }
    if (d.pvpNext !== undefined) { draft.step = PVP_WIZARD_STEPS[PVP_WIZARD_STEPS.indexOf(draft.step) + 1] ?? draft.step; this.render(); return; }
    if (d.pvpEnter !== undefined) {
      const setup = validPvpSetup(draft, !!this.actions.character());
      if (setup) this.actions.enter(setup);
    }
  }

  /** Custom build appearance: the character editor's study sheet — unsaved, session-only. */
  private openAppearanceEditor(): void {
    const custom = this.draft.custom;
    if (!custom || this.editor) return;
    this.editor = createAppearanceEditor(this.element.closest('.title-screen') ?? this.element.parentElement ?? this.element, {
      sheet: createCharacterSheet(custom.classId, custom.raceId, custom.look),
      name: 'Arena contender', look: custom.look, study: true,
      onCancel: look => {
        custom.look = look;
        this.editor?.dispose();
        this.editor = null;
      },
    });
  }

  private modeStep(): string {
    const card = (mode: PvpSetup['mode'], title: string, blurb: string) =>
      `<button type="button" class="pvp-card" data-pvp-mode="${mode}" aria-pressed="${this.draft.mode === mode}"><strong>${title}</strong><small>${blurb}</small></button>`;
    return `<div class="pvp-card-grid">
      ${card('arena', 'Arena', 'Small-team skirmish — 2v2, 3v3 or 4v4 on a single arena map. Last team standing wins.')}
      ${card('battleground', 'Battleground', 'Objective maps with larger NPC teams — capture flags or hold resource nodes.')}
    </div>`;
  }

  private bracketStep(): string {
    const draft = this.draft;
    const cards = draft.mode === 'arena'
      ? PVP_ARENA_BRACKETS.map(b =>
        `<button type="button" class="pvp-card" data-pvp-bracket="${b}" aria-pressed="${draft.bracket === b}"><strong>${b}</strong><small>You plus ${Number(b[0]) - 1} NPC teammate${b[0] === '2' ? '' : 's'} against an equal enemy team.</small></button>`).join('')
      : PVP_BATTLEGROUNDS.map(def =>
        `<button type="button" class="pvp-card" data-pvp-bracket="${def.id}" aria-pressed="${draft.bracket === def.id}"><strong>${e(def.name)}</strong><small>${def.teamSize}v${def.teamSize} · ${e(def.blurb)}</small></button>`).join('');
    return `<div class="pvp-card-grid">${cards}</div>`;
  }

  private teamStep(): string {
    const draft = this.draft, size = pvpTeamSize(draft.bracket);
    const slots = draft.teammates.map((mate, i) => {
      const cls = WOW_CLASSES[mate.classId];
      const roles = pvpClassRoles(mate.classId);
      return `<article class="pvp-slot" style="--slot-color:${cls.color}">
        <header class="pvp-slot-head"><span class="pvp-slot-index">${i + 2}</span><select data-pvp-class="${i}" aria-label="Teammate ${i + 2} class">${WOW_CLASS_IDS.map(id =>
          `<option value="${id}"${id === mate.classId ? ' selected' : ''}>${WOW_CLASSES[id].name}</option>`).join('')}</select></header>
        <div class="pvp-role-row" role="group" aria-label="Teammate ${i + 2} role">${roles.map(role =>
          `<button type="button" class="pvp-role" data-pvp-role="${i}" data-value="${role}" aria-pressed="${mate.role === role}">${uiIcon(ROLE_ICONS[role])}<span>${pvpRoleLabel(role)}</span></button>`).join('')}</div>
      </article>`;
    });
    return `<p class="pvp-hint">${pvpBracketLabel(draft.bracket)} fields ${size} per side — you plus ${size - 1} teammate${size === 2 ? '' : 's'}.</p>
      <div class="pvp-roster">
        <article class="pvp-slot is-player"><header class="pvp-slot-head"><span class="pvp-slot-index">1</span><strong>You</strong></header><p class="pvp-slot-note">Your ${draft.custom ? 'custom build' : 'character'} — set on the next step.</p></article>
        ${slots.join('')}
      </div>`;
  }

  /** Gear candidates for one slot under the current custom build (class + a
   * resolved weapon pick decide offhand legality). */
  private gearOptions(slot: EquipmentSlot) {
    const custom = this.draft.custom;
    if (!custom) return [];
    const weaponSeed = custom.gear?.weapon;
    const weapon = weaponSeed === undefined ? undefined
      : resolveGearPick(custom.classId, 'weapon', weaponSeed, this.gearItemLevel()) ?? undefined;
    return pvpGearOptions(custom.classId, slot, this.gearItemLevel(), weapon);
  }
  /** The item level gear picks resolve at — the same clamp buildCustomCharacter uses. */
  private gearItemLevel(): number {
    const custom = this.draft.custom!;
    return Math.min(Math.max(1, Math.round(custom.itemLevel ?? custom.level)), custom.level + 2);
  }
  /** Per-slot gear selects for the custom build; 'Auto' keeps the seeded roll. */
  private gearPicker(custom: PvpCustomBuild): string {
    const itemLevel = this.gearItemLevel();
    const weaponSeed = custom.gear?.weapon;
    const weapon = weaponSeed === undefined ? undefined
      : resolveGearPick(custom.classId, 'weapon', weaponSeed, itemLevel) ?? undefined;
    const row = (slot: EquipmentSlot, label: string): string => {
      const options = pvpGearOptions(custom.classId, slot, itemLevel, weapon);
      const picked = custom.gear?.[slot];
      const current = options.find(c => c.seed === picked);
      const icon = current ? itemIconSVG(current.item) : '';
      const note = slot === 'offhand' && weapon?.weapon?.hands === 2 ? ' <small>(needs a one-handed weapon)</small>' : '';
      return `<label class="pvp-gear-row" data-pvp-gear-row="${slot}"><span class="pvp-gear-slot">${label}${note}</span>
        <span class="pvp-gear-icon">${icon}</span>
        <select data-pvp-gear="${slot}" ${options.length ? '' : 'disabled'} aria-label="${label} gear">
          <option value="">Auto</option>
          ${options.map(c => `<option value="${c.seed}"${c.seed === picked ? ' selected' : ''}>${e(c.item.name)}</option>`).join('')}
        </select></label>`;
    };
    return `<div class="pvp-custom-row"><span class="pvp-custom-label">Gear</span><div class="pvp-gear-grid">
      ${row('weapon', 'Weapon')}${row('offhand', 'Offhand')}
      ${row('head', 'Head')}${row('chest', 'Chest')}${row('gloves', 'Gloves')}${row('legs', 'Legs')}${row('boots', 'Boots')}
      ${row('cloak', 'Cloak')}${row('amulet', 'Amulet')}${row('ring1', 'Ring')}${row('ring2', 'Ring')}
    </div></div>`;
  }

  private customEditor(custom: PvpCustomBuild): string {
    const cls = WOW_CLASSES[custom.classId], race = WOW_RACES[custom.raceId];
    return `<div class="pvp-custom">
      <div class="pvp-custom-row"><span class="pvp-custom-label">Class</span><div class="pvp-chip-grid" role="group" aria-label="Custom class">${WOW_CLASS_IDS.map(id =>
        `<button type="button" class="pvp-chip" style="--slot-color:${WOW_CLASSES[id].color}" data-pvp-custom-class="${id}" aria-pressed="${custom.classId === id}">${WOW_CLASSES[id].name}</button>`).join('')}</div></div>
      <div class="pvp-custom-row"><span class="pvp-custom-label">Race</span><div class="pvp-chip-grid" role="group" aria-label="Custom race">${WOW_RACE_IDS.map(id => {
        const blocked = !raceAllowsClass(id, custom.classId);
        return `<button type="button" class="pvp-chip" data-pvp-custom-race="${id}" aria-pressed="${custom.raceId === id}" aria-disabled="${blocked}" title="${blocked ? `${WOW_RACE_IDS.includes(id) ? WOW_RACES[id].name : id} cannot be a ${cls.name}` : WOW_RACES[id].name}">${WOW_RACES[id].name}</button>`;
      }).join('')}</div></div>
      <div class="pvp-custom-row"><span class="pvp-custom-label">Level</span><label class="pvp-level"><input type="range" min="${PVP_LEVEL_MIN}" max="${PVP_LEVEL_MAX}" step="1" value="${custom.level}" data-pvp-level aria-label="Custom level"><output data-pvp-level-out>Level ${custom.level}</output></label></div>
      <div class="pvp-custom-row"><span class="pvp-custom-label">Role</span><div class="pvp-role-row" role="group" aria-label="Custom role">${pvpClassRoles(custom.classId).map(role =>
        `<button type="button" class="pvp-role" data-pvp-custom-role="${role}" aria-pressed="${(custom.role ?? 'dd') === role}">${uiIcon(ROLE_ICONS[role])}<span>${pvpRoleLabel(role)}</span></button>`).join('')}</div></div>
      <div class="pvp-custom-row"><span class="pvp-custom-label">Look</span><button type="button" class="ui-button ui-button--quiet" data-pvp-appearance>${uiIcon('palette')}<span>Appearance &amp; armor</span></button><span class="pvp-custom-summary">${e(race.name)} ${e(cls.name)}</span></div>
      ${this.gearPicker(custom)}
      <p class="pvp-hint">Session character — never saved. Talents and gear are rolled for the match at this level.</p>
    </div>`;
  }

  private reviewStep(): string {
    const draft = this.draft, character = this.actions.character();
    const savedLabel = character
      ? `${e(character.name)} · Lv ${character.level} ${e(WOW_RACES[character.raceId]?.name ?? character.raceId)} <b style="color:${WOW_CLASSES[character.classId]?.color ?? 'inherit'}">${e(WOW_CLASSES[character.classId]?.name ?? character.classId)}</b>`
      : 'No character loaded';
    return `<div class="pvp-playas" role="group" aria-label="Play as">
        <button type="button" class="pvp-card" data-pvp-playas="saved" aria-pressed="${!draft.custom}" ${character ? '' : 'disabled'}><strong>Saved character</strong><small>${savedLabel}</small></button>
        <button type="button" class="pvp-card" data-pvp-playas="custom" aria-pressed="${!!draft.custom}"><strong>Custom build</strong><small>Set class, race, level and look — never saved.</small></button>
      </div>
      ${draft.custom ? this.customEditor(draft.custom) : ''}`;
  }

  private body(): string {
    switch (this.draft.step) {
      case 'mode': return this.modeStep();
      case 'bracket': return this.bracketStep();
      case 'team': return this.teamStep();
      case 'review': return this.reviewStep();
    }
  }

  private render(): void {
    const draft = this.draft, stepIndex = PVP_WIZARD_STEPS.indexOf(draft.step), last = stepIndex === PVP_WIZARD_STEPS.length - 1;
    const setup = validPvpSetup(draft, !!this.actions.character());
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active && this.element.contains(active)
      ? ['data-pvp-step', 'data-pvp-mode', 'data-pvp-bracket', 'data-pvp-playas', 'data-pvp-custom-class', 'data-pvp-custom-race', 'data-pvp-custom-role', 'data-pvp-appearance']
        .map(key => active.hasAttribute(key) ? `[${key}="${active.getAttribute(key)}"]` : null).find(Boolean)
        ?? (active.hasAttribute('data-pvp-role') ? `[data-pvp-role="${active.getAttribute('data-pvp-role')}"][data-value="${active.getAttribute('data-value')}"]` : null)
      : null;
    this.element.innerHTML = `<section class="ui-window pvp-window" role="${this.embedded ? 'region' : 'dialog'}" ${this.embedded ? '' : 'aria-modal="true"'} aria-labelledby="pvp-title">
      <header class="ui-window-header"><span class="ui-header-emblem">${npcEmblem('battlemaster')}</span><h2 class="ui-title" id="pvp-title">Arena &amp; Battlegrounds</h2><span class="pvp-master-name">${this.master ? e(this.master.name) : ''}</span><button class="ui-button ui-button--icon" data-close aria-label="Close">×</button></header>
      <nav class="pvp-steps" aria-label="Setup steps">${PVP_WIZARD_STEPS.map((step, i) =>
        `<button type="button" class="pvp-step" data-pvp-step="${step}" aria-current="${step === draft.step ? 'step' : 'false'}"><span class="pvp-step-index">${i + 1}</span>${STEP_LABELS[step]}</button>`).join('')}</nav>
      <div class="pvp-body ui-scroll-area">${this.body()}</div>
      <footer class="ui-window-footer">
        ${stepIndex > 0 ? '<button type="button" class="ui-button ui-button--quiet" data-pvp-back>Back</button>' : '<span></span>'}
        ${last
          ? `<button type="button" class="ui-button ui-button--primary" data-pvp-enter ${setup ? '' : 'disabled'}><span>${draft.mode === 'arena' ? 'Enter arena' : 'Queue for battleground'}</span>${uiIcon('chevron')}</button>`
          : '<button type="button" class="ui-button ui-button--primary" data-pvp-next><span>Continue</span>' + uiIcon('chevron') + '</button>'}
      </footer>
    </section>`;
    if (!this.embedded) attachPanelFrame(this.element, 'arena');
    if (focusKey) this.element.querySelector<HTMLElement>(focusKey)?.focus({ preventScroll: true });
  }
}
