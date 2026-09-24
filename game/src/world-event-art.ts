/** World event presentation (WoW Scourge Invasion): the necropolis ground piece,
 * the war chest, the HUD progress card and minimap blips. Read-only over
 * WorldEventState — no state mutation, matching active-event-art/poi-art. */
import { text, textWidth } from './font.ts';
import { UI_THEME } from './ui-theme.ts';
import { drawCachedUIArt } from './ui-art-cache.ts';
import { drawGlow, type PointLight } from './lighting.ts';
import { ChestArt } from './chest-art.ts';
import { TAU } from './art-primitives.ts';
import { randomSource } from './random-source.ts';
import { projectMapPoint, type MapView } from './map-view.ts';
import { INVASION_NAME } from './world-event-content.ts';
import { worldEventMapMarkers, type InvasionEvent, type WorldEventProgress, type WorldEventState } from './world-event-state.ts';
const UI = UI_THEME.palette;
const PLAGUE = '#8fd6a0';   // Scourge green — the necropolis glow.
const NECRO = '#b4a3eb';    // Grave Marshal violet — crystal and boss accents.

/** World-space necropolis: a plague scar on the ground, a hovering crystal and
 * drifting soul motes. Drawn in the ground pass before actors. */
export function drawNecropolis(c: CanvasRenderingContext2D, event: InvasionEvent, time: number, reduced: boolean): void {
  const anchor = event.anchor;
  if (!anchor) return;
  const t = reduced ? 0 : time;
  c.save();
  c.translate(anchor.x, anchor.y);
  const random = randomSource(event.seed);

  // Blighted ground: a soft plague stain with a cracked summoning ring.
  const stain = c.createRadialGradient(0, 0, 0, 0, 0, 190);
  stain.addColorStop(0, 'rgba(46,75,65,.34)');
  stain.addColorStop(.55, 'rgba(38,58,50,.2)');
  stain.addColorStop(1, 'rgba(38,58,50,0)');
  c.fillStyle = stain;
  c.fillRect(-190, -190, 380, 380);
  c.strokeStyle = '#8fd6a055';
  c.lineWidth = 1.4;
  for (const radius of [64, 118]) {
    c.beginPath();
    c.ellipse(0, 0, radius, radius * .78, 0, 0, TAU);
    c.stroke();
  }
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU + random() * .2;
    c.strokeStyle = '#8fd6a038';
    c.beginPath();
    c.moveTo(Math.cos(a) * 66, Math.sin(a) * 51);
    c.lineTo(Math.cos(a) * 116, Math.sin(a) * 90);
    c.stroke();
  }
  // Risen-dead bone scatter.
  for (let i = 0; i < 26; i++) {
    const a = random() * TAU, d = 40 + Math.sqrt(random()) * 140;
    c.globalAlpha = .2 + random() * .3;
    c.fillStyle = i % 3 ? '#b9c4b4' : '#5a6a5e';
    c.fillRect(Math.cos(a) * d, Math.sin(a) * d * .8, 1 + random() * 3, 1 + random() * 2);
  }
  c.globalAlpha = 1;

  // The necropolis crystal: a floating shard over a shadowed plinth.
  const bob = Math.sin(t * .9) * 4;
  c.fillStyle = '#02060a99';
  c.beginPath();
  c.ellipse(0, 6, 34, 11, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#1a2422';
  c.strokeStyle = '#4c5a54';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(-20, 4); c.lineTo(-14, -6); c.lineTo(14, -6); c.lineTo(20, 4); c.lineTo(15, 10); c.lineTo(-15, 10);
  c.closePath(); c.fill(); c.stroke();
  const pulse = .75 + Math.sin(t * 1.7) * .25;
  drawGlow(c, 0, -34 + bob, 74, PLAGUE, .3 * pulse);
  c.save();
  c.translate(0, -34 + bob);
  c.rotate(Math.sin(t * .5) * .08);
  c.fillStyle = '#241f38';
  c.strokeStyle = NECRO;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(0, -26); c.lineTo(11, -6); c.lineTo(6, 14); c.lineTo(-6, 14); c.lineTo(-11, -6);
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = NECRO;
  c.globalAlpha = .5 + pulse * .4;
  c.beginPath();
  c.moveTo(0, -18); c.lineTo(5, -5); c.lineTo(0, 8); c.lineTo(-5, -5);
  c.closePath(); c.fill();
  c.globalAlpha = 1;
  c.restore();

  // Soul motes spiral out of the crystal while the invasion runs.
  if (event.phase === 'active') {
    for (let i = 0; i < 7; i++) {
      const phase = reduced ? i / 7 : (t * .22 + i / 7) % 1;
      const a = i * 2.4 + t * .5;
      c.globalAlpha = (1 - phase) * .7;
      c.fillStyle = i % 2 ? PLAGUE : NECRO;
      c.fillRect(Math.cos(a) * (14 + phase * 46), -30 + bob - phase * 60 + Math.sin(a) * 8, 2, 2);
    }
    c.globalAlpha = 1;
  }
  c.restore();
}

const chestArt = new WeakMap<CanvasRenderingContext2D, ChestArt>();

/** The war chest on the necropolis plinth; opens when the record is claimed. */
export function drawWorldEventChest(c: CanvasRenderingContext2D, event: InvasionEvent, time: number, reduced: boolean): void {
  if (!event.anchor || (event.phase !== 'won' && event.phase !== 'claimed')) return;
  let art = chestArt.get(c);
  if (!art) { art = new ChestArt(); chestArt.set(c, art); }
  art.draw(c, `${event.id}:chest`, event.anchor.x, event.anchor.y + 26, event.phase === 'claimed', time, 0, true, reduced);
}

/** Point lights for the renderer's lighting pass: plague glow + crystal. */
export function worldEventLights(state: WorldEventState, time: number, reduced: boolean): PointLight[] {
  const event = state.active;
  if (!event?.anchor) return [];
  const pulse = reduced ? .8 : .8 + Math.sin(time * 1.7) * .2;
  return [
    { x: event.anchor.x, y: event.anchor.y - 34, radius: 150, color: PLAGUE, power: .5 * pulse },
    { x: event.anchor.x, y: event.anchor.y, radius: 260, color: '#3a5a48', power: .3 },
  ];
}

// ── HUD card ─────────────────────────────────────────────────────────────────

function drawCardChrome(c: CanvasRenderingContext2D, width: number) {
  const surface = c.createLinearGradient(0, 0, width * .35, 71);
  surface.addColorStop(0, UI.panelRaised); surface.addColorStop(.5, UI.panel); surface.addColorStop(1, UI.steelDeep);
  c.fillStyle = surface; c.fillRect(0, 0, width, 71);
  c.lineWidth = 1; c.strokeStyle = UI.silverDim;
  c.strokeRect(.5, .5, width - 1, 70);
  c.strokeStyle = UI.ink; c.strokeRect(1.5, 1.5, width - 3, 68);
  c.fillStyle = PLAGUE + '0c'; c.fillRect(2, 2, width - 4, 23);
  c.fillStyle = PLAGUE + '25'; c.fillRect(14, 25, width - 28, 1);
  for (const x of [4, width - 4]) for (const y of [4, 67]) {
    const dx = x === 4 ? 1 : -1, dy = y === 4 ? 1 : -1;
    c.strokeStyle = y === 4 ? UI.silver : UI.silverDim;
    c.beginPath(); c.moveTo(x, y + dy * 8); c.lineTo(x, y); c.lineTo(x + dx * 8, y); c.stroke();
    c.fillStyle = UI.brassDim; c.fillRect(x + dx * 3 - .5, y + dy * 3 - .5, 1, 1);
  }
}

/** Native-resolution invasion card under the active-event card slot. */
export function drawWorldEventCard(c: CanvasRenderingContext2D, view: WorldEventCardView): void {
  if (!view || view.width <= 0) return;
  const { progress } = view;
  const title = `${INVASION_NAME} — ${progress.event.zoneName}`;
  const width = Math.max(280, textWidth(title, 1.2) + textWidth('00:00', 1.2) + 44, textWidth(progress.label, 1) + 30);
  c.save(); c.translate(16, 156);
  c.save(); c.scale(view.width, 1);
  drawCachedUIArt(c, `world-event:${width}`, 0, 0, width, 71, art => drawCardChrome(art, width));
  c.restore();
  c.globalAlpha *= view.opacity;
  text(c, title, 14, 10, 1.2, PLAGUE);
  text(c, progress.timer, width - 14, 10, 1.2, UI.brass, 'right');
  text(c, progress.label, 14, 33, 1, UI.text);
  c.fillStyle = UI.well; c.fillRect(13, 53, width - 26, 7);
  c.strokeStyle = UI.silverDim + '80'; c.strokeRect(13.5, 53.5, width - 27, 6);
  if (progress.fraction > 0) {
    const fillWidth = (width - 28) * progress.fraction;
    const enamel = c.createLinearGradient(0, 54, 0, 59);
    enamel.addColorStop(0, PLAGUE); enamel.addColorStop(.45, UI.silverDim); enamel.addColorStop(1, '#2e4b35');
    c.fillStyle = enamel; c.fillRect(14, 54, fillWidth, 5);
    c.fillStyle = UI.silver + '80'; c.fillRect(14, 54, fillWidth, 1);
    c.fillStyle = UI.brass; c.fillRect(14 + Math.max(0, fillWidth - 1), 54, Math.min(1, fillWidth), 5);
  }
  c.restore();
}

export type WorldEventCardView = { progress: WorldEventProgress; width: number; opacity: number } | null;

const CARD_MOTION = { expand: .36, fade: .24, duration: .6 } as const;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => value * value * (3 - 2 * value);

/** Renderer-owned reveal clock, mirroring EventProgressPresentation. */
export class WorldEventCardPresentation {
  private progress: WorldEventProgress | null = null;
  private elapsed = 0;

  reset() { this.progress = null; this.elapsed = 0; }

  update(progress: WorldEventProgress | null, dt: number, reducedMotion: boolean) {
    if (progress) {
      if (progress.event.id !== this.progress?.event.id) this.elapsed = 0;
      this.progress = progress;
    }
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.elapsed = reducedMotion ? (progress ? CARD_MOTION.duration : 0)
      : Math.max(0, Math.min(CARD_MOTION.duration, this.elapsed + (progress ? step : -step)));
    if (!progress && this.elapsed === 0) this.progress = null;
  }

  get view(): WorldEventCardView {
    if (!this.progress) return null;
    return {
      progress: this.progress,
      width: ease(clamp01(this.elapsed / CARD_MOTION.expand)),
      opacity: ease(clamp01((this.elapsed - CARD_MOTION.expand) / CARD_MOTION.fade)),
    };
  }
}

// ── Minimap ──────────────────────────────────────────────────────────────────

/** Necropolis skull blips inside the minimap viewport; call while the map draws. */
export function drawWorldEventMinimapMarkers(c: CanvasRenderingContext2D, view: MapView, state: WorldEventState, time: number): void {
  const markers = worldEventMapMarkers(state, time);
  if (!markers.length) return;
  c.save();
  c.beginPath(); c.rect(view.x, view.y, view.width, view.height); c.clip();
  for (const marker of markers) {
    const p = projectMapPoint(marker.x, marker.y, view);
    if (p.x < view.x - 5 || p.y < view.y - 5 || p.x > view.x + view.width + 5 || p.y > view.y + view.height + 5) continue;
    const pulse = .75 + Math.sin(time * 3) * .25;
    c.save(); c.translate(p.x, p.y);
    c.fillStyle = '#070d12';
    c.beginPath(); c.arc(0, 0, 4.6, 0, TAU); c.fill();
    c.strokeStyle = PLAGUE; c.globalAlpha = .5 * pulse; c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, 5.6, 0, TAU); c.stroke();
    c.globalAlpha = 1;
    // Skull: cranium + jaw + eyes, readable at 4px.
    c.fillStyle = marker.id.endsWith(':chest') ? '#d7c18a' : PLAGUE;
    c.beginPath(); c.arc(0, -.7, 2.4, Math.PI, 0); c.lineTo(2.4, .6); c.lineTo(-2.4, .6); c.closePath(); c.fill();
    c.fillRect(-1.6, .6, 3.2, 1.6);
    c.fillStyle = '#070d12';
    c.fillRect(-1.5, -.9, 1, 1.1); c.fillRect(.5, -.9, 1, 1.1);
    c.restore();
  }
  c.restore();
}

/** Interact prompt over the war chest; returns the label or null. */
export function worldEventChestLabel(event: InvasionEvent | null): string | null {
  return event ? `Open ${INVASION_NAME} war chest` : null;
}
