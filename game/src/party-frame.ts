/**
 * Party frames (WotLK five-man): a compact left-side unit list for the AI
 * dungeon group — role badge, class-colored name, hp bar. Read-only projection
 * of the party roster; dead members stay listed with a ghosted frame until the
 * run ends. The host mounts it beside the buff frame and calls render(sim)
 * once per frame.
 */
import type { Simulation } from './simulation.ts';
import { partyRoster, type PartyRosterEntry } from './party-state.ts';
import { WOW_CLASSES } from './wow-classes.ts';
import { escapeUI } from './ui-components.ts';
import './party-frame.css';

const e = escapeUI;
const ROLE_BADGE: Readonly<Record<PartyRosterEntry['role'], string>> = Object.freeze({
  tank: 'T', healer: 'H', dps: 'D',
});

export class PartyFrame {
  readonly element = document.createElement('div');
  private rows = new Map<number, { root: HTMLElement; bar: HTMLElement; hp: HTMLElement }>();
  private order = '';

  constructor() {
    this.element.className = 'party-frame';
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', 'Party members');
    this.element.hidden = true;
    // Party frames are display-only; never let clicks reach the world.
    for (const type of ['pointerdown', 'dblclick', 'contextmenu'])
      this.element.addEventListener(type, event => event.stopPropagation());
  }

  mount(parent: HTMLElement): void {
    parent.append(this.element);
  }

  dispose(): void {
    this.element.remove();
    this.rows.clear();
  }

  render(sim: Simulation): void {
    const roster = partyRoster(sim);
    this.element.hidden = roster.length === 0;
    if (!roster.length) { this.order = ''; this.rows.clear(); this.element.replaceChildren(); return; }
    // Rebuild rows only when membership changes; hp bars update in place.
    const order = roster.map(r => r.allyId).join(',');
    if (order !== this.order) {
      this.order = order;
      this.rows.clear();
      this.element.replaceChildren(...roster.map(entry => this.buildRow(entry)));
    }
    for (const entry of roster) {
      const row = this.rows.get(entry.allyId);
      if (!row) continue;
      const ratio = Math.max(0, Math.min(1, entry.hp / Math.max(1, entry.maxHp)));
      row.bar.style.width = `${Math.round(ratio * 100)}%`;
      row.hp.textContent = entry.dead ? 'Dead' : `${Math.ceil(entry.hp)}`;
      row.root.classList.toggle('dead', entry.dead);
    }
  }

  private buildRow(entry: PartyRosterEntry): HTMLElement {
    const root = document.createElement('div');
    root.className = 'party-frame-row';
    root.dataset.role = entry.role;
    const className = WOW_CLASSES[entry.classId]?.name ?? entry.classId;
    root.innerHTML = `<span class="pf-role pf-role-${entry.role}" aria-hidden="true">${ROLE_BADGE[entry.role]}</span>
      <span class="pf-body">
        <span class="pf-name" style="color:${e(entry.color)}">${e(entry.name)}</span>
        <span class="pf-class">${e(className)}</span>
        <span class="pf-bar"><span class="pf-fill" style="background:${e(entry.color)}"></span></span>
      </span>
      <span class="pf-hp"></span>`;
    const row = {
      root,
      bar: root.querySelector<HTMLElement>('.pf-fill')!,
      hp: root.querySelector<HTMLElement>('.pf-hp')!,
    };
    this.rows.set(entry.allyId, row);
    return root;
  }
}
