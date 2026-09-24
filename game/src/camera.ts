export const MIN_CAMERA_ZOOM = .8;
export const MAX_CAMERA_ZOOM = 1.8;

const WHEEL_LINE_HEIGHT = 16;
const MAX_WHEEL_PIXELS = 300;
const WHEEL_SENSITIVITY = Math.log(1.12) / 100;
const ZOOM_RESPONSE = 12;

export const CAMERA_FOLLOW = Object.freeze({ response: 11, lookAheadX: .07, lookAheadY: .05, height: 15 });
const SPAWN_LOOKAHEAD = .1;
// Game advances at most 50 ms before drawing. Include a changed movement/dodge
// direction and the full bounded impact kick; enemy body margins belong elsewhere.
const SPAWN_REACTION_TIME = .05;
const MAX_CAMERA_KICK_PIXELS = 8;

/** A bounded target keeps repeated wheel input responsive while the view catches up. */
export class CameraZoom {
  value = 1;
  target = 1;

  wheel(deltaY: number, deltaMode: number, viewportHeight: number): void {
    if (!Number.isFinite(deltaY)) return;
    const unit = deltaMode === 1 ? WHEEL_LINE_HEIGHT : deltaMode === 2 ? viewportHeight : 1;
    if (!Number.isFinite(unit) || unit <= 0) return;
    const pixels = Math.max(-MAX_WHEEL_PIXELS, Math.min(MAX_WHEEL_PIXELS, deltaY * unit));
    this.target = Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM,
      this.target * Math.exp(-pixels * WHEEL_SENSITIVITY)));
  }

  update(dt: number, reducedMotion = false): number {
    if (!Number.isFinite(dt) || dt <= 0) return this.value;
    this.value = reducedMotion ? this.target
      : this.target + (this.value - this.target) * Math.exp(-ZOOM_RESPONSE * dt);
    return this.value;
  }
}

/** Presentation-only impact shake: a directional kick plus a decaying ambient
 * tremor, both in screen pixels so amplitude is independent of zoom. Purely a
 * render offset — it never feeds back into the simulation. */
export class CameraShake {
  /** Ambient tremor amplitude in screen pixels. */
  shake = 0;
  private kickX = 0;
  private kickY = 0;
  /** Hit flash channel: a brief radial vignette pulse, 1 → 0 over ~.18s. */
  private hitPulse = 0;

  reset() { this.shake = 0; this.kickX = 0; this.kickY = 0; this.hitPulse = 0; }

  /** Directional impulse away from the hit plus an ambient tremor, both bounded. */
  impact(angle: number, strength: number, ambient: number) {
    this.kickX = Math.max(-6, Math.min(6, this.kickX - Math.cos(angle) * strength));
    this.kickY = Math.max(-5, Math.min(5, this.kickY - Math.sin(angle) * strength * .7));
    this.shake = Math.max(this.shake, ambient);
  }

  /** A short screen-edge flash on hits; the renderer composites it as a vignette. */
  pulse(strength: number) { this.hitPulse = Math.max(this.hitPulse, Math.min(1, strength)); }

  /** Current hit-flash strength, 0 when idle. Read by the vignette pass. */
  get pulseAmount() { return this.hitPulse; }

  update(dt: number) {
    this.shake *= Math.exp(-dt * 22);
    this.kickX *= Math.exp(-dt * 18);
    this.kickY *= Math.exp(-dt * 18);
    this.hitPulse *= Math.exp(-dt / .18);
    if (this.hitPulse < .004) this.hitPulse = 0;
  }

  /** Screen-pixel offset for the current frame; zero under reduced motion. */
  offset(time: number, reducedMotion: boolean): { x: number; y: number } {
    if (reducedMotion) return { x: 0, y: 0 };
    return { x: this.kickX + Math.sin(time * 103) * this.shake,
      y: this.kickY + Math.cos(time * 127) * this.shake * .7 };
  }
}

export interface CameraView {
  zoom: number;
  offsetX: number;
  offsetY: number;
  left: number;
  top: number;
  /** Visible extent in world units; HUD and render-buffer dimensions stay unchanged. */
  width: number;
  height: number;
}

export interface CameraBounds { x: number; y: number; width: number; height: number; }
interface CameraSubject { x: number; y: number; vx: number; vy: number; }

/** Shared couch co-op framing: the camera sits on the players' midpoint and
 * zooms out just enough to keep both on screen, clamped to the normal zoom
 * band. Returns the follow target plus the zoom that frames both bodies. */
export function coopCameraTarget(a: CameraSubject, b: CameraSubject,
  viewWidth: number, viewHeight: number): { x: number; y: number; zoom: number } {
  const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
  // Half the screen-space separation each player needs, plus body margin.
  const needX = Math.abs(a.x - b.x) / 2 + 140;
  const needY = Math.abs(a.y - b.y) / 2 + 110;
  const zoom = Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM,
    Math.min(viewWidth / 2 / needX, viewHeight / 2 / needY)));
  return { x, y, zoom };
}

export function cameraFollowTarget(subject: CameraSubject): { x: number; y: number } {
  return { x: subject.x + subject.vx * CAMERA_FOLLOW.lookAheadX,
    y: subject.y + subject.vy * CAMERA_FOLLOW.lookAheadY - CAMERA_FOLLOW.height };
}

/** Predict visible geometry without advancing the camera or changing the aim transform. */
export function cameraSpawnExclusion(width: number, height: number,
  cameraX: number, cameraY: number, zoom: number, targetZoom: number,
  lastDisplayed: CameraView, subject: CameraSubject, movementSpeed: number): CameraBounds {
  // Zoom-out may become visible immediately under reduced motion; zoom-in must
  // continue protecting the wider view while its animation catches up.
  const widestZoom = Math.min(zoom, targetZoom);
  const halfWidth = width / widestZoom / 2, halfHeight = height / widestZoom / 2;
  const follow = cameraFollowTarget(subject);
  const neutralY = subject.y - CAMERA_FOLLOW.height;
  const futureX = follow.x + subject.vx * SPAWN_LOOKAHEAD;
  const futureY = follow.y + subject.vy * SPAWN_LOOKAHEAD;
  const speed = Math.max(movementSpeed, Math.hypot(subject.vx, subject.vy));
  const kick = MAX_CAMERA_KICK_PIXELS / widestZoom;
  const marginX = speed * (SPAWN_REACTION_TIME + CAMERA_FOLLOW.lookAheadX) + kick;
  const marginY = speed * (SPAWN_REACTION_TIME + CAMERA_FOLLOW.lookAheadY) + kick;
  // Both ends contain every interpolated camera position. A resize cannot erase
  // the last displayed rectangle until a frame has actually replaced it.
  const left = Math.min(lastDisplayed.left,
    Math.min(cameraX, subject.x, follow.x, futureX) - halfWidth - marginX);
  const top = Math.min(lastDisplayed.top,
    Math.min(cameraY, neutralY, follow.y, futureY) - halfHeight - marginY);
  const right = Math.max(lastDisplayed.left + lastDisplayed.width,
    Math.max(cameraX, subject.x, follow.x, futureX) + halfWidth + marginX);
  const bottom = Math.max(lastDisplayed.top + lastDisplayed.height,
    Math.max(cameraY, neutralY, follow.y, futureY) + halfHeight + marginY);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Camera kick remains in screen pixels, independent of the world magnification. */
export function cameraView(width: number, height: number, cameraX: number, cameraY: number,
  zoom: number, kickX = 0, kickY = 0): CameraView {
  const offsetX = width / 2 - cameraX * zoom + kickX;
  const offsetY = height / 2 - cameraY * zoom + kickY;
  return { zoom, offsetX, offsetY, left: -offsetX / zoom, top: -offsetY / zoom,
    width: width / zoom, height: height / zoom };
}

export function screenToWorld(view: CameraView, x: number, y: number): { x: number; y: number } {
  return { x: (x - view.offsetX) / view.zoom, y: (y - view.offsetY) / view.zoom };
}

export function worldToScreen(view: CameraView, x: number, y: number): { x: number; y: number } {
  return { x: x * view.zoom + view.offsetX, y: y * view.zoom + view.offsetY };
}
