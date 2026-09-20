/** Stable-master window (WotLK pet stables): the hunter's active companion plus up to
 * PET_RULES.stableSlots stabled pets, with swap / stable / rename actions.
 *
 * All sheet access goes through `StableActions` — the panel never touches the
 * character sheet itself; game.ts wires the interface to `character.pets` via
 * the pet-content stable helpers. */
import { attachPanelFrame } from './panel-frames.ts';
import { PET_FAMILIES, DEMON_FAMILIES, PET_SKILLS, PET_RULES, petXpForLevel, type PetRecord } from './pet-content.ts';
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
    const control = (event.target as HTMLElement).closest<HTMLElement>('[data-close],[data-swap],[data-stable-active],[data-rename],[data-rename-cancel],[data-dismiss]');
    if (!control) return;
    if (control.dataset.close !== undefined) { this.actions.close(); return; }
    if (this.busy) return;
    if (control.dataset.dismiss !== undefined) { void this.run(this.actions.dismissPet(Number(control.dataset.dismiss))); return; }
    if (control.dataset.swap !== undefined) { void this.run(this.actions.swapPet(Number(control.dataset.swap))); return; }
    if (control.dataset.stableActive !== undefined) { void this.run(this.actions.stableActive()); return; }
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

  private petCard(pet: PetRecord, active: boolean, index: number): string {
    const family = familyDef(pet);
    const xpNeed = petXpForLevel(pet.level);
    const xpPct = Math.max(0, Math.min(100, pet.xp / xpNeed * 100));
    const loyaltyPct = Math.max(0, Math.min(100, pet.loyalty / PET_RULES.maxLoyalty * 100));
    const renaming = this.renaming === pet.id;
    return `<article class="stable-pet${active ? ' is-active' : ''}" style="--pet-color:${family.color ?? NPC_COLORS.stable}">
      <header class="stable-pet-head"><span class="stable-pet-family">${e(family.name)}</span><span class="stable-pet-level">Lv ${pet.level}</span></header>
      ${renaming
        ? `<form class="stable-rename" data-rename-form="${pet.id}"><input name="pet-name" type="text" value="${e(pet.name)}" maxlength="24" autocomplete="off" aria-label="Pet name"><button class="ui-button ui-button--quiet" type="submit">Save</button><button class="ui-button ui-button--quiet" type="button" data-rename-cancel>Cancel</button></form>`
        : `<h3 class="stable-pet-name">${e(pet.name)}</h3>`}
      <div class="stable-bars">
        <div class="stable-bar" title="Experience ${Math.floor(pet.xp)} / ${xpNeed}"><span>XP</span><div class="stable-bar-track"><i style="width:${xpPct}%"></i></div></div>
        <div class="stable-bar" title="Loyalty ${pet.loyalty} / ${PET_RULES.maxLoyalty}"><span>Loyalty</span><div class="stable-bar-track is-loyalty"><i style="width:${loyaltyPct}%"></i></div></div>
      </div>
      ${this.skillChips(pet)}
      <footer class="stable-pet-actions">
        ${active
          ? `<button class="ui-button ui-button--quiet" data-stable-active ${this.actions.stabledPets().length >= this.actions.stableCapacity() ? 'disabled' : ''}>Stable</button>`
          : `<button class="ui-button ui-button--quiet" data-swap="${index}">Activate</button>`}
        ${renaming ? '' : `<button class="ui-button ui-button--quiet" data-rename="${pet.id}">Rename</button><button class="ui-button ui-button--quiet stable-dismiss" data-dismiss="${pet.id}" title="Release this pet permanently">Dismiss</button>`}
      </footer>
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
      </div>
      <footer class="ui-window-footer"><span class="stable-message" role="status">${e(this.message)}</span><span>Esc <span>Close</span></span></footer>`;
    if (this.renaming !== null) this.element.querySelector<HTMLInputElement>('input[name="pet-name"]')?.select();
  }
}
