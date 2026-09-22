/** Stable-master window (WotLK pet stables): the hunter's active companion plus up to
 * PET_RULES.stableSlots stabled pets, with swap / stable / rename actions.
 *
 * All sheet access goes through `StableActions` — the panel never touches the
 * character sheet itself; game.ts wires the interface to `character.pets` via
 * the pet-content stable helpers. */
import { attachPanelFrame } from './panel-frames.ts';
import { PET_FAMILIES, DEMON_FAMILIES, PET_SKILLS, PET_RULES, petXpForLevel, type PetRecord } from './pet-content.ts';
import { PET_FAMILY_TREE, PET_TALENTS, PET_TALENT_TREES, petTalentTreeTalents } from './pet-talent-content.ts';
import { petTalentPoints, petTalentProblem, petTalentSpent } from './pet-talent-state.ts';
import { MOUNTS, type MountId } from './mount-content.ts';
import { COMPANIONS, type CompanionId } from './companion-content.ts';
import { NPC_NAMES, NPC_COLORS, type StableMaster } from './npcs.ts';
import { npcEmblem } from './npc-art.ts';
import { escapeUI, trapDialogFocus } from './ui-components.ts';
import './stable-panel.css';

const e = escapeUI;

/** Sheet-facing actions the stable window needs; implemented by the host (game.ts `petActions`). */
export interface StableActions {
  close(): void;
  /** The pet currently summoned beside the player, if any. */
  activePet(): PetRecord | null;
  /** Pets resting in stable slots (at most `stableCapacity()`). */
  stabledPets(): readonly PetRecord[];
  /** Maximum stabled pets (PET_RULES.stableSlots). */
  stableCapacity(): number;
  /** Move the stabled pet at `index` into the active slot; the old active pet takes the freed slot. */
  swapPet(index: number): Promise<{ ok: boolean; message: string }>;
  /** Move the active pet into a free stable slot without a replacement. */
  stableActive(): Promise<{ ok: boolean; message: string }>;
  /** Rename the active or a stabled pet. */
  renamePet(petId: number, name: string): Promise<{ ok: boolean; message: string }>;
  /** Release a pet entirely — clears the active slot or removes it from the stable. */
  dismissPet(petId: number): Promise<{ ok: boolean; message: string }>;
  /** Spend one point on a talent for the active pet (pet-talent-command.ts). */
  learnPetTalent(talentId: string): Promise<{ ok: boolean; message: string }>;
  /** Refund every talent point on the active pet. */
  resetPetTalents(): Promise<{ ok: boolean; message: string }>;
  /** Every mount with its lock state and whether the X toggle prefers it. */
  mounts(): readonly StableMount[];
  /** Pick a mount as the X-toggle preference and ride out (summons when possible). */
  selectMount(id: MountId): Promise<{ ok: boolean; message: string }>;
  /** Every companion with its collection state and which is summoned. */
  companions(): readonly StableCompanion[];
  /** Summon a collected companion, or dismiss the active one with `null`. */
  summonCompanion(id: CompanionId | null): Promise<{ ok: boolean; message: string }>;
}

/** One row of the stable's mount list; `MOUNTS[id]` carries name/speed/colors. */
export interface StableMount {
  readonly id: MountId;
  readonly unlocked: boolean;
  readonly selected: boolean;
}

/** One row of the companion collection; `COMPANIONS[id]` carries name/source. */
export interface StableCompanion {
  readonly id: CompanionId;
  readonly owned: boolean;
  readonly active: boolean;
}

interface FocusTrap { dispose(): void }

function familyDef(pet: PetRecord): { name: string; color?: string } {
  return (PET_FAMILIES as Record<string, { name: string; color: string }>)[pet.family]
    ?? (DEMON_FAMILIES as Record<string, { name: string }>)[pet.family]
    ?? { name: pet.family };
}

export class StablePanel {
  readonly element: HTMLElement;
  private abort = new AbortController();
  private focus: FocusTrap | null = null;
  private master: StableMaster | null = null;
  private renaming: number | null = null;
  private message = '';
  private busy = false;
  private readonly actions: StableActions;

  constructor(mount: HTMLElement, actions: StableActions) {
    this.actions = actions;
    this.element = document.createElement('section');
    this.element.className = 'stable-panel ui-window';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'stable-title');
    mount.append(this.element);
    attachPanelFrame(this.element, 'stable');
    this.element.addEventListener('click', event => this.click(event), { signal: this.abort.signal });
    this.element.addEventListener('submit', event => {
      const form = (event.target as HTMLElement).closest<HTMLFormElement>('form[data-rename-form]');
      if (!form) return;
      event.preventDefault();
      const input = form.querySelector<HTMLInputElement>('input[name="pet-name"]');
      void this.run(this.actions.renamePet(Number(form.dataset.renameForm), input?.value ?? ''));
    }, { signal: this.abort.signal });
  }

  get opened() { return !this.element.hidden; }

  open(master: StableMaster | null): void {
    this.master = master;
    this.renaming = null;
    this.message = '';
    this.element.hidden = false;
    this.render();
    this.focus?.dispose();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal, initialFocus: this.element, restoreFocus: false });
  }

  close(): void {
    this.focus?.dispose();
    this.focus = null;
    this.renaming = null;
    this.element.hidden = true;
  }

  dispose(): void {
    this.close();
    this.abort.abort();
    this.element.remove();
  }

  private async run(action: Promise<{ ok: boolean; message: string }>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const result = await action;
    this.busy = false;
    this.renaming = null;
    this.message = result.message;
    if (!this.element.hidden) this.render();
  }

  private click(event: MouseEvent): void {
    const control = (event.target as HTMLElement).closest<HTMLElement>('[data-close],[data-swap],[data-stable-active],[data-rename],[data-rename-cancel],[data-dismiss],[data-mount],[data-companion],[data-pet-talent],[data-pet-talent-reset]');
    if (!control) return;

    if (control.dataset.close !== undefined) { this.actions.close(); return; }
    if (this.busy) return;
    if (control.dataset.dismiss !== undefined) { void this.run(this.actions.dismissPet(Number(control.dataset.dismiss))); return; }
    if (control.dataset.swap !== undefined) { void this.run(this.actions.swapPet(Number(control.dataset.swap))); return; }
    if (control.dataset.mount !== undefined) { void this.run(this.actions.selectMount(control.dataset.mount as MountId)); return; }
    if (control.dataset.companion !== undefined) {
      const id = control.dataset.companion;
      void this.run(this.actions.summonCompanion(id === 'dismiss' ? null : id as CompanionId));
      return;
    }
    if (control.dataset.petTalent !== undefined) { void this.run(this.actions.learnPetTalent(control.dataset.petTalent)); return; }
    if (control.dataset.petTalentReset !== undefined) { void this.run(this.actions.resetPetTalents()); return; }
    if (control.dataset.rename !== undefined) { this.renaming = Number(control.dataset.rename); this.message = ''; this.render(); return; }
    if (control.dataset.renameCancel !== undefined) { this.renaming = null; this.render(); }
  }


  private skillChips(pet: PetRecord): string {
    const known = new Set(pet.skills);
    const family = (PET_FAMILIES as Record<string, { skills: readonly string[] }>)[pet.family];
    const learnable = family ? family.skills.filter(id => !known.has(id)) : [];
    const chips = pet.skills.map(id => {
      const skill = PET_SKILLS[id];
      return `<span class="stable-skill" title="${e(skill?.description ?? id)}">${e(skill?.name ?? id)}</span>`;
    });
    for (const id of learnable) {
      const skill = PET_SKILLS[id];
      if (skill) chips.push(`<span class="stable-skill is-locked" title="Learns at level ${skill.learnLevel}. ${e(skill.description)}">${e(skill.name)} <small>Lv ${skill.learnLevel}</small></span>`);
    }
    return chips.length ? `<div class="stable-skills">${chips.join('')}</div>` : '';
  }
  /** Compact talent list for the active pet: rank pips plus a + button per row. */
  private petTalents(pet: PetRecord): string {
    const tree = PET_FAMILY_TREE[pet.family];
    if (!tree) return '';
    const earned = petTalentPoints(pet), spent = petTalentSpent(pet);
    const rows = petTalentTreeTalents(tree).map(talent => {
      const rank = pet.talents?.[talent.id] ?? 0;
      const problem = petTalentProblem(pet, talent.id);
      const pips = Array.from({ length: talent.maxRanks }, (_, i) => `<i class="${i < rank ? 'is-filled' : ''}"></i>`).join('');
      const need = talent.requires ? ` Requires ${PET_TALENTS[talent.requires.id]?.name ?? ''} rank ${talent.requires.points}.` : '';
      return `<li class="stable-talent${problem ? ' is-locked' : ''}" title="${e(talent.description)}${e(need)}${problem ? ` — ${e(problem)}` : ''}">
        <span class="stable-talent-name">${e(talent.name)}</span>
        <span class="stable-talent-pips">${pips}</span>
        ${rank < talent.maxRanks ? `<button class="ui-button ui-button--quiet stable-talent-add" data-pet-talent="${e(talent.id)}" ${problem ? 'disabled' : ''} aria-label="Learn ${e(talent.name)}">+</button>` : ''}
      </li>`;
    });
    return `<div class="stable-talents"><div class="stable-talents-head"><span>${e(PET_TALENT_TREES[tree].name)} talents</span><span>${spent} / ${earned} points${spent ? ' <button class="ui-button ui-button--quiet stable-talent-reset" data-pet-talent-reset>Reset</button>' : ''}</span></div><ul>${rows.join('')}</ul></div>`;
  }


  private petCard(pet: PetRecord, active: boolean, index: number): string {
    const family = familyDef(pet);
    const xpNeed = petXpForLevel(pet.level);
    const xpPct = Math.max(0, Math.min(100, pet.xp / xpNeed * 100));
    const loyaltyPct = Math.max(0, Math.min(100, pet.loyalty / PET_RULES.maxLoyalty * 100));
    const renaming = this.renaming === pet.id;
    return `<article class="stable-pet${active ? ' is-active' : ''}" style="--pet-color:${family.color ?? NPC_COLORS.stable}">
      ${renaming
        ? `<form class="stable-rename" data-rename-form="${pet.id}"><input name="pet-name" type="text" value="${e(pet.name)}" maxlength="24" autocomplete="off" aria-label="Pet name"><button class="ui-button ui-button--quiet" type="submit">Save</button><button class="ui-button ui-button--quiet" type="button" data-rename-cancel>Cancel</button></form>`
        : `<h3 class="stable-pet-name">${e(pet.name)}</h3>`}
      <div class="stable-bars">
        <div class="stable-bar" title="Experience ${Math.floor(pet.xp)} / ${xpNeed}"><span>XP</span><div class="stable-bar-track"><i style="width:${xpPct}%"></i></div></div>
        <div class="stable-bar" title="Loyalty ${pet.loyalty} / ${PET_RULES.maxLoyalty}"><span>Loyalty</span><div class="stable-bar-track is-loyalty"><i style="width:${loyaltyPct}%"></i></div></div>
      </div>
      ${this.skillChips(pet)}
      ${active ? this.petTalents(pet) : ''}
      <footer class="stable-pet-actions">
        ${active
          ? `<button class="ui-button ui-button--quiet" data-stable-active ${this.actions.stabledPets().length >= this.actions.stableCapacity() ? 'disabled' : ''}>Stable</button>`
          : `<button class="ui-button ui-button--quiet" data-swap="${index}">Activate</button>`}
        ${renaming ? '' : `<button class="ui-button ui-button--quiet" data-rename="${pet.id}">Rename</button><button class="ui-button ui-button--quiet stable-dismiss" data-dismiss="${pet.id}" title="Release this pet permanently">Dismiss</button>`}
      </footer>
    </article>`;
  }

  private mountCard(mount: StableMount): string {
    const def = MOUNTS[mount.id];
    const speed = `+${Math.round((def.speed - 1) * 100)}% speed`;
    return `<article class="stable-mount${mount.selected ? ' is-selected' : ''}${mount.unlocked ? '' : ' is-locked'}" style="--mount-color:${def.tint}">
      <span class="stable-mount-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke-linecap="round"><path d="M6.5 20a8.5 8.5 0 1 1 11 0" stroke="${def.tint}" stroke-width="3.4"/><path d="M4.5 16.5 2.6 19.4M12 3.2V.8M19.5 16.5l1.9 2.9" stroke="${def.accent}" stroke-width="1.8"/></svg></span>
      <div class="stable-mount-info"><h3 class="stable-pet-name">${e(def.name)}${mount.selected ? ' <span class="stable-mount-current">Current</span>' : ''}</h3><span class="stable-mount-speed">${speed}</span><span class="stable-mount-source">${e(def.source)}</span></div>
      ${mount.unlocked
        ? `<button class="ui-button ui-button--quiet" data-mount="${mount.id}">Ride</button>`
        : '<span class="stable-mount-lock">Locked</span>'}
    </article>`;
  }

  private companionCard(companion: StableCompanion): string {
    const def = COMPANIONS[companion.id];
    return `<article class="stable-mount stable-companion${companion.active ? ' is-selected' : ''}${companion.owned ? '' : ' is-locked'}" style="--mount-color:${def.tint}" title="${e(def.flavor)}">
      <span class="stable-mount-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke-linecap="round"><circle cx="12" cy="13" r="6.5" stroke="${def.tint}" stroke-width="3"/><path d="M8.5 8.5 7 5.5M15.5 8.5 17 5.5" stroke="${def.accent}" stroke-width="1.8"/><circle cx="10" cy="12.5" r=".9" fill="${def.accent}"/><circle cx="14" cy="12.5" r=".9" fill="${def.accent}"/></svg></span>
      <div class="stable-mount-info"><h3 class="stable-pet-name">${e(def.name)}${companion.active ? ' <span class="stable-mount-current">Summoned</span>' : ''}</h3><span class="stable-mount-source">${e(def.sourceLabel)}</span></div>
      ${companion.owned
        ? companion.active
          ? '<button class="ui-button ui-button--quiet" data-companion="dismiss">Dismiss</button>'
          : `<button class="ui-button ui-button--quiet" data-companion="${companion.id}">Summon</button>`
        : '<span class="stable-mount-lock">Not collected</span>'}
    </article>`;
  }


  private render(): void {
    const active = this.actions.activePet();
    const stabled = this.actions.stabledPets();
    const capacity = this.actions.stableCapacity();
    this.element.style.setProperty('--stable-color', NPC_COLORS.stable);
    const slots = stabled.map((pet, index) => this.petCard(pet, false, index));
    for (let i = stabled.length; i < capacity; i++)
      slots.push(`<div class="stable-slot is-empty"><span>Empty slot</span></div>`);
    this.element.innerHTML = `<header class="ui-window-header"><span class="ui-header-emblem">${npcEmblem('stable')}</span><h2 class="ui-title" id="stable-title">${NPC_NAMES.stable}</h2><span class="stable-master-name">${this.master ? e(this.master.name) : ''}</span><button class="ui-button ui-button--icon" data-close aria-label="Close stable">×</button></header>
      <div class="stable-body ui-scroll-area">
        <section class="stable-active" aria-label="Active pet"><div class="service-section-heading"><h3>Active companion</h3><span>${active ? 'Fights beside you' : 'None'}</span></div>
          ${active ? this.petCard(active, true, -1) : '<p class="stable-empty">No active pet. Hunters tame beasts in the wild; warlocks summon demons through their skills.</p>'}</section>
        <section class="stable-stabled" aria-label="Stabled pets"><div class="service-section-heading"><h3>Stable</h3><span>${stabled.length} / ${capacity}</span></div>
          <div class="stable-grid">${slots.join('')}</div></section>
        <section class="stable-mounts" aria-label="Mounts"><div class="service-section-heading"><h3>Mounts</h3><span>Pick your ride — X summons it</span></div>
          <div class="stable-mount-grid">${this.actions.mounts().map(mount => this.mountCard(mount)).join('')}</div></section>
        <section class="stable-companions" aria-label="Companions"><div class="service-section-heading"><h3>Companions</h3><span>${this.actions.companions().filter(c => c.owned).length} collected — one follows you</span></div>
          <div class="stable-mount-grid">${this.actions.companions().map(companion => this.companionCard(companion)).join('')}</div></section>
      </div>
      <footer class="ui-window-footer"><span class="stable-message" role="status">${e(this.message)}</span><span>Esc <span>Close</span></span></footer>`;
    if (this.renaming !== null) this.element.querySelector<HTMLInputElement>('input[name="pet-name"]')?.select();
  }
}
