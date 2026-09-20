import type { Input } from './model.ts';

import { ControlBindings, SKILL_ACTIONS, isMovementAction, type ControlAction } from './control-bindings.ts';
import { BAR_PAGE_KEY_CODES, BAR_SLOTS, RACIAL_SLOT } from './action-bar.ts';

type Point = { x: number; y: number };
type PointerBounds = { left: number; top: number; width: number; height: number };

/** Browser events accumulate here; the frame consumes action edges exactly once. */
export class GameInput {
  readonly pointer = { x: 0, y: 0, present: false };
  private keys = new Set<string>();
  private buttons = new Set<number>();
  private pointerUIBlocked = false;
  private pendingSkill: number | null = null;
  private pending = { attack: false, dodge: false, heal: false };
  /** Tab edges accumulate as direction; click edges carry the hovered enemy id (null = clear). */
  private pendingCycle = 0;
  private pendingTarget: number | null | undefined = undefined;

  private readonly bindings: ControlBindings;
  private readonly page: () => number;
  private pendingBarPage: number | null = null;
  /** Digit keys consumed as Shift+page keys; excluded from held-skill checks until released. */
  private readonly pagedDigits = new Set<string>();
  constructor(bindings = new ControlBindings(), page: () => number = () => 0) { this.bindings = bindings; this.page = page; }

  private press(action: ControlAction | undefined): void {
    if (action === 'attack' || action === 'dodge' || action === 'heal') this.pending[action] = true;
    if (action === 'cycleTarget') this.pendingCycle = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? -1 : 1;
    if (action === 'racial') this.pendingSkill = RACIAL_SLOT;
    const slot = SKILL_ACTIONS.findIndex(id => id === action);
    if (slot >= 0) this.pendingSkill = this.page() * BAR_SLOTS + slot;
  }
  /** Click or programmatic activation of one absolute slot; the game routes the result. */
  activateBarSlot(index: number): void { this.pendingSkill = index; }
  /** Potion bar slots fold into the heal buffer. */
  pressHeal(): void { this.pending.heal = true; }
  /** Held check that ignores digits currently acting as Shift+page keys. */
  private heldSkill(action: ControlAction): boolean {
    return this.bindings.get(action).some(code => code !== null && !this.pagedDigits.has(code)
      && (code.startsWith('Mouse') ? this.buttons.has(Number(code.slice(5))) : this.keys.has(code)));
  }
  keyDown(code: string): void {
    if (this.keys.has(code)) return;
    this.keys.add(code);
    // WoW paging: Shift+1..3 switches the main bar page instead of firing the slot.
    const pageIndex = (BAR_PAGE_KEY_CODES as readonly string[]).indexOf(code);
    if (pageIndex >= 0 && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))) {
      this.pagedDigits.add(code); this.pendingBarPage = pageIndex; return;
    }
    this.press(this.bindings.action(code));
  }
  keyUp(code: string): void { this.keys.delete(code); this.pagedDigits.delete(code); }
  pointerDown(button: number): void {
    if (this.buttons.has(button)) return;
    this.buttons.add(button); this.press(this.bindings.action(`Mouse${button}`));
  }
  pointerUp(button: number): void { this.buttons.delete(button); }

  /** Click-targeting: a hovered enemy id selects it; empty ground is a no-op (WoW keeps the target). */
  clickTarget(enemyId: number | null | undefined): void {
    if (enemyId !== null && enemyId !== undefined) this.pendingTarget = enemyId;
  }
  /** Escape clears the current target on the next consumed frame. */
  clearTarget(): void { this.pendingTarget = null; }

  held(action: ControlAction): boolean {
    return this.bindings.get(action).some(code => code !== null
      && (code.startsWith('Mouse') ? this.buttons.has(Number(code.slice(5))) : this.keys.has(code)));
  }

  /** Ignore invalid/hidden surface bounds instead of injecting NaN into aiming. */
  movePointer(clientX: number, clientY: number, bounds: PointerBounds, width: number, height: number): void {
    if (![clientX, clientY, bounds.left, bounds.top, bounds.width, bounds.height, width, height].every(Number.isFinite)
      || bounds.width <= 0 || bounds.height <= 0 || width <= 0 || height <= 0) {
      this.pointer.present = false;
      return;
    }
    const x = clientX - bounds.left, y = clientY - bounds.top;
    this.pointer.present = x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height;
    this.pointer.x = x / bounds.width * width;
    this.pointer.y = y / bounds.height * height;
  }

  /** Coordinate-based entry also catches canvas-captured drags and panels opening under a held pointer. */
  setPointerUIBlocked(blocked: boolean): boolean {
    const entered = blocked && !this.pointerUIBlocked;
    this.pointerUIBlocked = blocked;
    if (entered) this.clear();
    return entered;
  }

  consume(aim: Point, combatBlocked: boolean): Input {
    const page = this.page();
    const input: Input = {
      moveX: Number(this.held('right')) - Number(this.held('left')),
      moveY: Number(this.held('down')) - Number(this.held('up')),
      aimX: aim.x, aimY: aim.y,
      attack: !combatBlocked && (this.held('attack') || this.pending.attack),
      dodge: this.pending.dodge, heal: this.pending.heal,
      ...(this.pendingSkill===null&&this.heldSkill('skill0')?{skillPressed:false}:{}),
      heldSkillSlots: combatBlocked?[]:[...(this.heldSkill('skill0')?[page*BAR_SLOTS]:[]),...[1,2,3,4,5,6,7,8,9,10,11].filter(n=>this.heldSkill(SKILL_ACTIONS[n])).map(n=>page*BAR_SLOTS+n)],
      skillSlot: combatBlocked ? null : this.pendingSkill ?? (this.heldSkill('skill0') ? page * BAR_SLOTS : null),
      ...(this.pendingCycle !== 0 ? { cycleTarget: this.pendingCycle as 1 | -1 } : {}),
      ...(this.pendingTarget !== undefined ? { targetId: this.pendingTarget } : {}),
      ...(this.pendingBarPage !== null ? { barPage: this.pendingBarPage } : {}),
    };
    this.pending.attack = this.pending.dodge = this.pending.heal = false;
    this.pendingSkill = null;
    this.pendingCycle = 0;
    this.pendingTarget = undefined;
    this.pendingBarPage = null;
    return input;
  }

  /** Tab transitions retain movement, loot reveal and mouse holds; pause/blur discard everything. */
  clear(preserveMovement = false): void {
    if (preserveMovement) {
      for (const key of this.keys) {
        const action = this.bindings.action(key);
        if (!isMovementAction(action) && action !== 'revealLoot') this.keys.delete(key);
      }
    } else this.keys.clear();
    if (!preserveMovement) this.buttons.clear();
    this.pagedDigits.clear();
    this.pending.attack = this.pending.dodge = this.pending.heal = false;
    this.pendingSkill = null;
    this.pendingCycle = 0;
    this.pendingTarget = undefined;
    this.pendingBarPage = null;
  }
}
