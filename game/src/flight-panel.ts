/** Flight-master destination picker (wayfinder world-t04): a small dialog in
 * the shared 'event' panel slot listing unlocked taxi destinations reachable
 * from this master, WoW-style. */
import { attachPanelFrame } from './panel-frames.ts';
import { escapeUI, trapDialogFocus } from './ui-components.ts';
import type { FlightPoint, FlightPlan } from './transport-content.ts';

export interface FlightDestination {
  readonly point: FlightPoint;
  readonly plan: FlightPlan;
}
export class FlightPanel {
  readonly element: HTMLElement;
  private lifetime = new AbortController();
  private focus: { dispose(): void } | null = null;
  private master: FlightPoint | null = null;
  private destinations: readonly FlightDestination[] = [];
  private readonly hooks: {
    close(): void;
    fly(master: FlightPoint, destination: FlightPoint): void;
  };
  constructor(mount: HTMLElement, hooks: FlightPanel['hooks']) {
    this.hooks = hooks;
    this.element = document.createElement('section');
    this.element.className = 'event-panel flight-panel';
    this.element.hidden = true;
    mount.append(this.element);
    attachPanelFrame(this.element, 'event');
    this.element.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button) return;
      if (button.dataset.close !== undefined) { this.hooks.close(); return; }
      const index = Number(button.dataset.fly);
      const destination = this.destinations[index];
      if (this.master && destination) this.hooks.fly(this.master, destination.point);
    }, { signal: this.lifetime.signal });
  }
  open(master: FlightPoint, destinations: readonly FlightDestination[]) {
    this.master = master;
    this.destinations = destinations;
    const rows = destinations.map((d, i) =>
      `<button class="ui-button event-choice" data-fly="${i}"><strong>${escapeUI(d.point.name)}</strong><span>${escapeUI(d.point.zone)} · ${Math.ceil(d.plan.durationSec)}s${d.plan.path.length > 2 ? ` · ${d.plan.path.length - 2} stop${d.plan.path.length > 3 ? 's' : ''}` : ''}</span></button>`).join('');
    this.element.innerHTML = `<section class="ui-window event-window" role="dialog" aria-modal="true" aria-labelledby="flight-title"><header class="ui-window-header"><h2 class="ui-title" id="flight-title">${escapeUI(master.name)}</h2><span class="ui-muted">Flight Master</span><button class="ui-button ui-button--icon" data-close aria-label="Close">×</button></header><div class="ui-window-body event-choices">${rows || '<p>No other flight points discovered yet.</p>'}</div></section>`;
    this.element.hidden = false;
    this.focus = trapDialogFocus(this.element, { signal: this.lifetime.signal });
  }
  close() { this.focus?.dispose(); this.focus = null; this.element.hidden = true; this.master = null; this.destinations = []; }
  dispose() { this.close(); this.lifetime.abort(); this.element.remove(); }
}
