import { text } from './font.ts';
import { UI_THEME } from './ui-theme.ts';

/** Presentation-only massacre announcements for kill streaks (combat-rewards.ts
 * emits the 'streak' event; this module owns the banner, never the sim). */
export interface StreakNotice { count: number; bonusPercent: number; }
export const STREAK_BANNER_TIMING = Object.freeze({ enter: .35, hold: 1.9, exit: .9, duration: 3.15 });

const STREAK_TITLES: readonly [number, string][] = [[100, 'MASSACRE'], [50, 'RAMPAGE'], [25, 'SLAUGHTER'], [10, 'MASSACRE']];
export function streakTitle(count: number): string {
  for (const [threshold, title] of STREAK_TITLES) if (count >= threshold) return title;
  return 'MASSACRE';
}

const smooth = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
export function streakBannerOpacity(age: number): number {
  return smooth(age / STREAK_BANNER_TIMING.enter)
    * (1 - smooth((age - STREAK_BANNER_TIMING.enter - STREAK_BANNER_TIMING.hold) / STREAK_BANNER_TIMING.exit));
}
export function streakBannerLayout(width: number, height: number) {
  const vertical = Math.max(.38, Math.min(1, (height * .3 - 6) / 72));
  return { x: width / 2, y: height * .3, radius: Math.min(300, width * .5),
    titleSize: Math.min(40, Math.max(22, 40 * vertical), Math.max(22, width * .07)),
    smallSize: vertical < .7 ? 12 : 15 };
}

/** One latest streak milestone; a higher threshold replaces a showing banner. */
export class StreakBanner {
  notice: Readonly<StreakNotice> | null = null;
  age = 0;
  show(notice: StreakNotice): void {
    if (this.notice && this.notice.count > notice.count && this.age < STREAK_BANNER_TIMING.enter + STREAK_BANNER_TIMING.hold) return;
    this.notice = { ...notice }; this.age = 0;
  }
  clear(): void { this.notice = null; this.age = 0; }
  update(dt: number): void {
    if (!this.notice) return;
    this.age += Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (this.age >= STREAK_BANNER_TIMING.duration) this.clear();
  }
  /** Screen-space pass; call after the world transform is restored. */
  draw(c: CanvasRenderingContext2D, width: number, height: number, reducedMotion = false): void {
    const notice = this.notice;
    if (!notice) return;
    const opacity = streakBannerOpacity(this.age);
    if (opacity <= 0) return;
    const layout = streakBannerLayout(width, height);
    const UI = UI_THEME.palette;
    c.save();
    c.globalAlpha = opacity;
    // Diablo-style blood-red banner: dark vignette bar, glowing title, XP line.
    const bar = c.createLinearGradient(layout.x - layout.radius, 0, layout.x + layout.radius, 0);
    bar.addColorStop(0, '#1a050800'); bar.addColorStop(.5, '#1a0508cc'); bar.addColorStop(1, '#1a050800');
    c.fillStyle = bar;
    c.fillRect(layout.x - layout.radius, layout.y - layout.titleSize * 1.1, layout.radius * 2, layout.titleSize * 2.6);
    const grow = reducedMotion ? 1 : 1 + Math.max(0, 1 - this.age / .3) * .18;
    c.shadowColor = '#e83d59'; c.shadowBlur = 18;
    text(c, `${streakTitle(notice.count)} x${notice.count}`, layout.x, layout.y,
      layout.titleSize * grow / 34, '#f2b8a8', 'center');
    c.shadowBlur = 0;
    text(c, `+${notice.bonusPercent}% XP`, layout.x, layout.y + layout.titleSize * 1.05,
      layout.smallSize / 15, UI.brass, 'center');
    c.restore();
  }
}
