/**
 * Transmogrification window: per-slot picker over owned items, a live paper-doll
 * preview, and apply/restore through the durable command hooks. Read-only
 * projection — the panel owns no state beyond the pending selection.
 */
import './transmog-panel.css';
import { attachPanelFrame, detachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { drawHumanoid } from './art.ts';
import { characterBounds, fitCharacter } from './character-framing.ts';
import { itemIconSVG, outfitFromEquipment } from './item-art.ts';
import { tintedOutfit } from './appearance-armor.ts';
import { UNARMED_WEAPON } from './equipment.ts';
import { itemDisplayName, TIER_COLORS, TIER_NAMES } from './items.ts';
import { formatWalletCompact } from './currency.ts';
import { goldBalance } from './wallet.ts';
import { DURABILITY_SLOT_NAMES } from './durability.ts';
import {
  ownedItems, transmogCost, transmogOf, transmogSource, transmogSources,
  transmoggedSheet, TRANSMOG_SLOTS, type TransmogMap,
} from './transmog-state.ts';
import type { ActionResult, EquipmentSlot, Item } from './character-types.ts';
import type { CharacterPose } from './art-types.ts';
import type { Player } from './model.ts';

const esc = escapeUI;
interface FocusTrap { dispose(): void }
interface TransmogHooks {
  /** Durable commands; the panel shows the returned message. */
  apply(slot: EquipmentSlot, sourceId: string): Promise<ActionResult> | void;
  clear(slot: EquipmentSlot): Promise<ActionResult> | void;
  close(): void;
}

/** Where an owned item is carried, shown next to its name in the picker. */
function itemLocation(sheet: Player['character'], item: Item): string {
  for (const [slot, equipped] of Object.entries(sheet.equipped))
    if (equipped === item) return `Worn · ${DURABILITY_SLOT_NAMES[slot as EquipmentSlot]}`;
  return sheet.stash?.includes(item) ? 'Stash' : 'Bag';
}

export class TransmogPanel {
  readonly element: HTMLElement;
  private abort = new AbortController();
  private focus: FocusTrap | null = null;
  private player: Player | null = null;
  private notice = '';
  private signature = '';
  private slot: EquipmentSlot = 'weapon';
  /** undefined = nothing staged; null = restore staged; string = source id staged. */
  private pending: string | null | undefined;
  private hooks: TransmogHooks;
  constructor(mount: HTMLElement, hooks: TransmogHooks) {
    this.hooks = hooks;
    this.element = document.createElement('section');
    this.element.className = 'transmog-panel';
    this.element.hidden = true;
    mount.append(this.element);
    attachPanelFrame(this.element, 'transmog');
    this.element.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || !this.player) return;
      if (b.dataset.close !== undefined) this.close();
      else if (b.dataset.slot !== undefined) {
        this.slot = b.dataset.slot as EquipmentSlot;
        this.pending = undefined;
        this.notice = '';
        this.render();
      } else if (b.dataset.source !== undefined) {
        this.pending = b.dataset.source || null;
        this.render();
      } else if (b.dataset.apply !== undefined && this.pending !== undefined) {
        const pending = this.pending;
        void this.run(pending === null ? this.hooks.clear(this.slot) : this.hooks.apply(this.slot, pending));
      } else if (b.dataset.clear !== undefined) {
        void this.run(this.hooks.clear(this.slot));
      }
    }, { signal: this.abort.signal });
  }
  get opened() { return !this.element.hidden; }
  private async run(result: Promise<ActionResult> | void) {
    const resolved = await result;
    if (resolved?.message) this.notice = resolved.message;
    if (resolved?.ok) this.pending = undefined;
    this.render();
  }
  /** Refresh the projection; call whenever the player or inventory may have changed. */
  update(player: Player) {
    this.player = player;
    if (this.element.hidden) return;
    const signature = JSON.stringify([
      goldBalance(player.character), transmogOf(player.character),
      ownedItems(player.character).map(item => item.id),
    ]);
    if (signature !== this.signature) { this.signature = signature; this.render(); }
  }
  open() {
    this.element.hidden = false;
    this.notice = '';
    this.signature = '';
    this.pending = undefined;
    this.render();
    this.focus = trapDialogFocus(this.element, { signal: this.abort.signal });
  }
  close() {
    if (this.element.hidden) return;
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
    this.hooks.close();
  }
  private slotRow(slot: EquipmentSlot): string {
    const sheet = this.player!.character;
    const equipped = sheet.equipped[slot];
    const source = transmogSource(sheet, slot);
    return `<button class="transmog-slot${slot === this.slot ? ' is-selected' : ''}${source ? ' is-transmogged' : ''}" data-slot="${slot}">
<span class="transmog-slot-name">${DURABILITY_SLOT_NAMES[slot]}</span>
<span class="transmog-slot-item" ${equipped ? `style="color:${TIER_COLORS[equipped.tier]}"` : ''}>${equipped ? esc(itemDisplayName(equipped)) : 'Empty'}</span>
${source ? `<span class="transmog-slot-as">as ${esc(itemDisplayName(source))}</span>` : ''}</button>`;
  }
  private sourceRow(item: Item): string {
    const sheet = this.player!.character;
    const active = this.pending === item.id || this.pending === undefined && transmogSource(sheet, this.slot)?.id === item.id;
    return `<button class="transmog-source${active ? ' is-selected' : ''}" data-source="${esc(item.id)}">
<span class="transmog-source-icon">${itemIconSVG(item, 36)}</span>
<span class="transmog-source-text"><span class="transmog-source-name" style="color:${TIER_COLORS[item.tier]}">${esc(itemDisplayName(item))}</span>
<small>${TIER_NAMES[item.tier]} · ${esc(itemLocation(sheet, item))}</small></span></button>`;
  }
  private render() {
    const p = this.player;
    if (!p || this.element.hidden) return;
    const sheet = p.character;
    this.signature = JSON.stringify([goldBalance(sheet), transmogOf(sheet), ownedItems(sheet).map(item => item.id)]);
    const equipped = sheet.equipped[this.slot];
    const current = transmogSource(sheet, this.slot);
    const sources = transmogSources(sheet, this.slot);
    const cost = equipped ? transmogCost(equipped) : 0;
    const gold = goldBalance(sheet);
    const originalActive = this.pending === null || this.pending === undefined && !current;
    const applyLabel = this.pending === null ? 'Restore appearance'
      : `Apply · ${formatWalletCompact(cost)}`;
    const applyDisabled = this.pending === undefined || this.pending !== null && gold < cost;
    this.element.innerHTML = `<section class="ui-window transmog-window" role="dialog" aria-modal="true" aria-labelledby="transmog-title">
<header class="ui-window-header"><span class="transmog-heading-icon">${uiIcon('palette')}</span><h2 class="ui-title" id="transmog-title">Transmogrify</h2><button class="ui-button ui-button--icon" data-close aria-label="Close transmogrify">×</button></header>
<div class="transmog-body">
<nav class="transmog-slots" aria-label="Equipment slots">${TRANSMOG_SLOTS.map(slot => this.slotRow(slot)).join('')}</nav>
<div class="transmog-detail">
<canvas class="transmog-preview-canvas" aria-label="Appearance preview"></canvas>
<div class="transmog-slot-summary">${equipped
  ? `<strong style="color:${TIER_COLORS[equipped.tier]}">${esc(itemDisplayName(equipped))}</strong>${current
    ? `<span class="transmog-current">appears as <strong style="color:${TIER_COLORS[current.tier]}">${esc(itemDisplayName(current))}</strong> <button class="ui-button ui-button--quiet" data-clear>Restore</button></span>`
    : '<span class="transmog-current is-dim">true appearance</span>'}`
  : `<span class="transmog-current is-dim">Nothing equipped in ${DURABILITY_SLOT_NAMES[this.slot]}.</span>`}</div>
<div class="ui-scroll-area transmog-sources">${equipped
  ? `<button class="transmog-source${originalActive ? ' is-selected' : ''}" data-source=""><span class="transmog-source-icon">${itemIconSVG(equipped, 36)}</span><span class="transmog-source-text"><span class="transmog-source-name">Original appearance</span><small>${esc(itemDisplayName(equipped))}</small></span></button>`
    + (sources.length ? sources.map(item => this.sourceRow(item)).join('')
      : '<p class="transmog-empty"><small>No compatible items owned. Looks must match the slot — weapons also keep handedness and attack style.</small></p>')
  : ''}</div>
<footer class="transmog-actions">
${this.notice ? `<p class="transmog-notice" role="status">${esc(this.notice)}</p>` : ''}
<span class="transmog-gold">${formatWalletCompact(gold)}</span>
<button class="ui-button ui-button--primary" data-apply ${applyDisabled ? `disabled${this.pending !== undefined && this.pending !== null && gold < cost ? ` data-tooltip="${esc(`Needs ${formatWalletCompact(cost)}`)}"` : ''}` : ''}>${applyLabel}</button>
</footer>
</div>
</div></section>`;
    attachPanelFrame(this.element, 'transmog');
    this.drawPreview();
  }
  /** Paper-doll preview of the staged look; mirrors character-portrait framing. */
  private drawPreview() {
    const canvas = this.element.querySelector<HTMLCanvasElement>('.transmog-preview-canvas');
    const p = this.player;
    if (!canvas || !p) return;
    const width = canvas.clientWidth || 240, height = canvas.clientHeight || 300;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const map: TransmogMap = { ...transmogOf(p.character) };
    if (this.pending === null) delete map[this.slot];
    else if (this.pending !== undefined) map[this.slot] = this.pending;
    const preview = transmoggedSheet(p.character, map);
    const main = preview.equipped.weapon?.weapon ?? UNARMED_WEAPON;
    const off = preview.equipped.offhand;
    const look = p.character.look;
    const facing = Math.PI / 2;
    const pose: CharacterPose = {
      kind: 'player', appearance: look.appearance, raceId: p.character.raceId,
      angle: facing, attackAngle: facing, time: 0, moving: 0, attack: 0, hitFlash: 0, dodging: false,
      outfit: tintedOutfit(outfitFromEquipment(preview), look.armorTints, look.showHelmet),
      weapon: main.visual, grip: main.hands === 2 ? 'two-handed' : 'one-handed',
      offHand: off?.shield ? { kind: 'shield', visual: off.shield.visual }
        : off?.focus ? { kind: 'focus', visual: off.focus.visual }
        : off?.weapon ? { kind: 'weapon', visual: off.weapon.visual } : null,
    };
    const fit = fitCharacter(characterBounds(pose), width, height);
    ctx.clearRect(0, 0, width, height);
    ctx.save(); ctx.translate(fit.x, fit.y); ctx.scale(fit.scale, fit.scale);
    const glow = ctx.createRadialGradient(0, -28, 2, 0, -28, 40);
    glow.addColorStop(0, '#83adc917'); glow.addColorStop(1, '#83adc900');
    ctx.fillStyle = glow; ctx.fillRect(-45, -75, 90, 95);
    ctx.fillStyle = '#02070cb0'; ctx.beginPath(); ctx.ellipse(0, 2, 13, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    drawHumanoid(ctx, pose);
    ctx.restore();
  }
  dispose() { this.close(); detachPanelFrame(this.element); this.abort.abort(); this.element.remove(); }
}

/** Panel toggle for the integrator's input/panel wiring. */
export function transmogPanelToggle(panel: TransmogPanel): void {
  if (panel.opened) panel.close(); else panel.open();
}
