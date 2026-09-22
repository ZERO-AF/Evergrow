import { riftMechanic } from './rift-encounters.ts';
import { isBossKind, isWildernessBoss } from './wilderness-boss-content.ts';
import { enemyEngaged } from './enemy-engagement.ts';
import { debuffDuration, type EnemyDebuff, type EnemyDebuffState } from './enemy-debuffs.ts';
import type { Enemy, Player } from './model.ts';
import { ENEMY_RANKS } from './progression-content.ts';
import { UI_THEME } from './ui-theme.ts';
import { text, textWidth } from './font.ts';
import { getHUDLayout } from './hud-layout.ts';
import { getMinimapRect } from './map-view.ts';
import { drawBossCrest, BOSS_METAL, RANK_METALS } from './enemy-rank-art.ts';
import { drawSkillIcon } from './skill-icon-canvas.ts';
import { SKILL_ICON_RECIPES } from './skill-icon-content.ts';
import { enemyDisplayName } from './zone-roster.ts';
import type { SkillId } from './character-types.ts';

/** WoW-style encounter frame: one large unit plate per engaged boss or elite. */
export const BOSS_FRAME = Object.freeze({ width: 380, minWidth: 240, height: 80, gap: 8, maxIcons: 8 });

export interface BossFrameOptions {
  name?: string;
  debuffs?: readonly EnemyDebuff[];
  /** Stacked slot: 0 is the primary frame, 1 sits directly beneath it. */
  slot?: number;
  touch?: boolean;
  compactLandscape?: boolean;
  topInset?: number;
  opacity?: number;
  healthTrail?: number;
  hitPulse?: number;
  time?: number;
  reducedMotion?: boolean;
  comboPoints?: number;
}

const UI = UI_THEME.palette;
const TAU = Math.PI * 2;
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const compact = (value: number) => value >= 10_000 ? compactNumber.format(value) : `${Math.ceil(value)}`;

/** Boss kinds and elite ranks qualify for the encounter frame; normals keep the small plate. */
export function bossFrameEligible(enemy: Pick<Enemy, 'kind' | 'rank'>): boolean {
  return isBossKind(enemy.kind) || enemy.rank === 'elite';
}

/**
 * The current boss/elite targets, primary first: the locked combat target and the
 * focused (hovered/last-hit) enemy always qualify; other candidates must be
 * engaged and inside their encounter radius. At most two frames stack.
 */
export function bossFrameTargets<T extends Pick<Enemy, 'id' | 'kind' | 'rank' | 'hp' | 'state' | 'x' | 'y'>>(
  enemies: readonly T[], player: Pick<Player, 'x' | 'y' | 'targetId'>, focusedId: number | null): T[] {
  const alive = (e: T) => e.hp > 0 && e.state !== 'dead';
  const engagedNear = (e: T) => enemyEngaged(e) && Math.hypot(e.x - player.x, e.y - player.y) < (isWildernessBoss(e.kind) ? 650 : 1100);
  const locked = player.targetId != null ? enemies.find(e => e.id === player.targetId && alive(e)) : undefined;
  const focused = focusedId != null ? enemies.find(e => e.id === focusedId && alive(e)) : undefined;
  const rest = enemies.filter(e => bossFrameEligible(e) && alive(e) && engagedNear(e)
    && e.id !== locked?.id && e.id !== focused?.id)
    .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
  return [locked, focused, ...rest].filter((e): e is T => !!e && bossFrameEligible(e)).slice(0, 2);
}

/** Top-center layout sharing the enemy plate's minimap clearance and HUD bounds. */
export function getBossFrameLayout(width: number, height: number, options: Pick<BossFrameOptions, 'slot' | 'touch' | 'compactLandscape' | 'topInset'> = {}): { x: number; y: number; width: number; height: number } {
  const slot = Math.max(0, Math.floor(options.slot ?? 0));
  width = Math.max(0, Number.isFinite(width) ? width : 0);
  height = Math.max(0, Number.isFinite(height) ? height : 0);
  const bottom = Math.min(height - 8, getHUDLayout(width, height).y - 8);
  let frameWidth: number, y: number;
  if (options.touch) {
    frameWidth = Math.max(0, Math.min(300, width - 24));
    const safeTop = Math.max(8, (Number.isFinite(options.topInset) ? options.topInset! : 0) + 6);
    y = height >= 134 ? Math.max(options.compactLandscape ? 32 : 64, safeTop) : safeTop;
  } else {
    const map = getMinimapRect(width, height);
    const besideMap = 2 * (map.x - 12 - width / 2);
    const belowMap = besideMap < BOSS_FRAME.minWidth;
    frameWidth = Math.max(0, Math.min(BOSS_FRAME.width, width - 32, belowMap ? Infinity : besideMap));
    y = belowMap ? map.y + map.height + 8 : width < 720 ? 60 : 16;
  }
  y += slot * (BOSS_FRAME.height + BOSS_FRAME.gap);
  const fits = frameWidth >= BOSS_FRAME.minWidth && y + BOSS_FRAME.height <= bottom;
  return { x: (width - frameWidth) / 2, y: Math.min(y, height), width: frameWidth, height: fits ? BOSS_FRAME.height : 0 };
}

function chamfer(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, cut: number) {
  c.beginPath(); c.moveTo(x + cut, y); c.lineTo(x + width - cut, y);
  c.lineTo(x + width, y + cut); c.lineTo(x + width, y + height - cut);
  c.lineTo(x + width - cut, y + height); c.lineTo(x + cut, y + height);
  c.lineTo(x, y + height - cut); c.lineTo(x, y + cut); c.closePath();
}

/** A slow ember drift inside the remaining health, calmer than the plate's blood bubbles. */
function emberMotion(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number,
  ratio: number, time: number) {
  c.save(); c.beginPath(); c.rect(x, y, width * ratio, height); c.clip();
  const opacity = c.globalAlpha;
  for (let i = 0; i < 10; i++) {
    const phase = (time * (.1 + i % 3 * .04) + i * .618034) % 1;
    const bx = x + (i + .5) / 10 * width + Math.sin(time * .6 + i) * 2;
    const by = y + height + 1 - phase * (height + 3);
    c.globalAlpha = opacity * Math.sin(phase * Math.PI) * .45;
    c.beginPath(); c.arc(bx, by, .8 + i % 3 * .3, 0, TAU);
    c.fillStyle = '#ff9a70'; c.fill();
  }
  if (ratio < 1) {
    c.globalAlpha = opacity * .7; c.fillStyle = '#f9a2ac';
    c.fillRect(x + width * ratio - .8, y + .5, .8, height - 1);
  }
  c.restore();
}

/** Debuff icon cell: skill art when a recipe exists, else a tinted letter tile. */
function debuffIcon(c: CanvasRenderingContext2D, debuff: EnemyDebuff, x: number, y: number, size: number) {
  c.fillStyle = '#0a141c'; c.fillRect(x, y, size, size);
  const id = debuff.icon as SkillId;
  if (SKILL_ICON_RECIPES[id]) drawSkillIcon(c, id, x + size / 2, y + size / 2, size - 3);
  else {
    c.fillStyle = `${debuff.color}30`; c.fillRect(x + 2, y + 2, size - 4, size - 4);
    text(c, debuff.name[0] ?? '?', x + size / 2, y + 4.5, .72, debuff.color, 'center');
  }
  const spent = 1 - clamp(debuff.progress ?? (debuff.persistent ? 1 : debuff.remaining / Math.max(.001, debuff.duration)));
  if (spent > 0) { c.fillStyle = '#030910a8'; c.fillRect(x + 1, y + 1, size - 2, (size - 2) * spent); }
  c.strokeStyle = debuff.color; c.lineWidth = .8; c.strokeRect(x + .5, y + .5, size - 1, size - 1);
  if (!debuff.persistent && debuff.remaining > 0)
    text(c, debuffDuration(debuff.remaining), x + size / 2, y + size - 5.5, .56, '#edf5f5', 'center');
}

/** The encounter frame: ornate crest, name, health bar with percent, and status icons. */
export function drawBossFrame(c: CanvasRenderingContext2D, enemy: Pick<Enemy, 'kind' | 'hp' | 'maxHp' | 'level' | 'rank'> & EnemyDebuffState & Partial<Pick<Enemy, 'biome' | 'lootSeed' | 'rift' | 'stateTime' | 'stateDuration' | 'homeX' | 'homeY' | 'dungeonTheme'>>,
  width: number, height: number, options: BossFrameOptions = {}): void {
  const layout = getBossFrameLayout(width, height, options);
  const opacity = clamp(options.opacity ?? 1);
  if (!layout.height || opacity <= 0) return;
  const w = layout.width, boss = isBossKind(enemy.kind);
  const trim = boss ? BOSS_METAL : RANK_METALS[enemy.rank];
  const rank = ENEMY_RANKS[enemy.rank];
  const maxHp = Math.max(0, Number.isFinite(enemy.maxHp) ? enemy.maxHp : 0);
  const hp = Math.max(0, Math.min(maxHp, Number.isFinite(enemy.hp) ? enemy.hp : 0));
  const ratio = hp / Math.max(1, maxHp);
  const trail = Math.max(ratio, clamp((options.healthTrail ?? hp) / Math.max(1, maxHp)));
  const hit = clamp(options.hitPulse ?? 0);
  c.save(); c.translate(layout.x, layout.y); c.globalAlpha *= opacity;

  // Elliptical ground shadow keeps the frame legible over bright terrain.
  c.save(); c.translate(w / 2, 40); c.scale(w / 2 + 14, 44);
  const shadow = c.createRadialGradient(0, 0, .05, 0, 0, 1);
  shadow.addColorStop(0, '#02050ac2'); shadow.addColorStop(.55, '#02050a80'); shadow.addColorStop(1, '#02050a00');
  c.fillStyle = shadow; c.fillRect(-1, -1, 2, 2); c.restore();

  // Ornate panel: rank metal over dark steel, with a raised inner lip.
  chamfer(c, 4, 4, w - 8, 72, 8);
  const panel = c.createLinearGradient(0, 4, 0, 76);
  panel.addColorStop(0, trim.edge); panel.addColorStop(.12, trim.shade);
  panel.addColorStop(.4, UI.panel); panel.addColorStop(1, UI.ink);
  c.fillStyle = panel; c.fill(); c.strokeStyle = trim.edge; c.lineWidth = 1.1; c.stroke();
  chamfer(c, 7, 7, w - 14, 66, 6);
  c.strokeStyle = `${trim.light}55`; c.lineWidth = .6; c.stroke();
  for (const side of [-1, 1]) {
    c.save(); c.translate(side < 0 ? 4 : w - 4, 40); c.scale(side, 1);
    c.strokeStyle = trim.edge; c.lineWidth = .9;
    c.beginPath(); c.moveTo(0, -10); c.lineTo(-6, -16); c.lineTo(-11, -16);
    c.moveTo(0, 10); c.lineTo(-6, 16); c.lineTo(-11, 16); c.stroke();
    c.fillStyle = trim.gem; c.fillRect(-8.5, -1.5, 3, 3); c.restore();
  }

  const barX = 66, barWidth = w - 82;
  // Name row: rank-colored name on the left, BOSS/rank tag on the right.
  const role = riftMechanic(enemy);
  const name = options.name ?? (role === 'ritual' ? 'Rift Cantor' : role === 'storm' ? `Stormbound ${enemyDisplayName(enemy)}` : role === 'fire' ? `Cinder ${enemyDisplayName(enemy)}` : enemyDisplayName(enemy));
  const tag = boss ? 'BOSS' : rank.name;
  c.save(); c.shadowColor = '#010409'; c.shadowBlur = 3; c.shadowOffsetY = 1;
  text(c, name, barX, 13, Math.min(1.05, (barWidth - 52) / Math.max(1, textWidth(name))), boss ? trim.light : rank.color);
  text(c, tag, w - 16, 15, .66, boss ? trim.gem : rank.color, 'right');
  c.restore();

  // Health bar: garnet fill over a damage trail, percent centered, totals right.
  const barY = 30, barHeight = 14;
  c.fillStyle = '#060d13'; c.fillRect(barX, barY, barWidth, barHeight);
  if (trail > ratio) { c.fillStyle = '#bb866a9c'; c.fillRect(barX, barY, barWidth * trail, barHeight); }
  if (ratio > 0) {
    const blood = c.createLinearGradient(0, barY, 0, barY + barHeight);
    blood.addColorStop(0, '#d66270'); blood.addColorStop(.27, '#b53048');
    blood.addColorStop(.7, '#861832'); blood.addColorStop(1, '#4b0e24');
    c.fillStyle = blood; c.fillRect(barX, barY, barWidth * ratio, barHeight);
    const time = options.reducedMotion || !Number.isFinite(options.time) ? 0 : options.time!;
    emberMotion(c, barX, barY, barWidth, barHeight, ratio, time);
    c.fillStyle = '#eea0a047'; c.fillRect(barX, barY, barWidth * ratio, .7);
    if (hit > 0) {
      c.save(); c.globalAlpha *= hit * .55;
      c.fillStyle = '#fbd2bb'; c.fillRect(barX, barY, barWidth * ratio, barHeight);
      c.restore();
    }
  }
  c.strokeStyle = trim.edge; c.lineWidth = .8; c.strokeRect(barX - .5, barY - .5, barWidth + 1, barHeight + 1);
  c.beginPath(); c.moveTo(barX, barY + .8); c.lineTo(barX + barWidth, barY + .8);
  c.strokeStyle = `${trim.light}70`; c.lineWidth = .5; c.stroke();
  c.save(); c.shadowColor = '#010409'; c.shadowBlur = 2;
  const percent = `${Math.floor(ratio * 100)}%`;
  text(c, percent, barX + barWidth / 2, barY + 2.6, .8, '#f4f0e2', 'center');
  const totals = `${compact(hp)} / ${compact(maxHp)}`;
  text(c, totals, barX + barWidth - 5, barY + 3.4, .62, '#d8e4ea', 'right');
  c.restore();

  // Enemy windup reads as a thin amber cast channel under the health rail.
  if (enemy.state === 'windup' && (enemy.stateDuration ?? 0) > 0) {
    const progress = clamp((enemy.stateTime ?? 0) / Math.max(.001, enemy.stateDuration!));
    c.fillStyle = '#050a10d8'; c.fillRect(barX, 46.5, barWidth, 3);
    const cast = c.createLinearGradient(barX, 46.5, barX, 49.5);
    cast.addColorStop(0, '#f2d68a'); cast.addColorStop(1, '#b07f3c');
    c.fillStyle = cast; c.fillRect(barX, 46.5, barWidth * progress, 3);
    c.strokeStyle = '#8d7a4f80'; c.lineWidth = .5; c.strokeRect(barX - .5, 46, barWidth + 1, 4);
  }

  // Active debuff/status icons ride the frame's lower band, bounded to one row.
  const debuffs = options.debuffs ?? [];
  if (debuffs.length) {
    const size = 16, gap = 4, shown = Math.min(debuffs.length, BOSS_FRAME.maxIcons);
    const rowWidth = shown * size + (shown - 1) * gap;
    let x = barX + Math.max(0, (barWidth - rowWidth) / 2);
    for (const debuff of debuffs.slice(0, shown)) { debuffIcon(c, debuff, x, 54, size); x += size + gap; }
    if (debuffs.length > shown)
      text(c, `+${debuffs.length - shown}`, x + 2, 59, .62, UI.muted);
  }

  // The portrait seal overlaps the panel's left edge; the level badge rides its base.
  drawBossCrest(c, enemy.rank, boss, 40, 40, 1.05);
  c.beginPath(); c.arc(58, 62, 7.5, 0, TAU);
  c.fillStyle = '#0a141c'; c.fill(); c.strokeStyle = trim.light; c.lineWidth = .9; c.stroke();
  text(c, String(enemy.level), 58, 58.4, .68, UI.ivory, 'center');

  // Combo points arc under the crest like WoW's portrait pips.
  const combo = options.comboPoints;
  if (combo !== undefined && Number.isFinite(combo)) {
    const filled = Math.max(0, Math.min(5, Math.floor(combo)));
    for (let i = 0; i < 5; i++) {
      const px = 40 + (i - 2) * 8.5, py = 74;
      c.beginPath(); c.moveTo(px, py - 3); c.lineTo(px + 3, py); c.lineTo(px, py + 3); c.lineTo(px - 3, py); c.closePath();
      c.fillStyle = i < filled ? '#e8c93a' : '#101a22'; c.fill();
      c.strokeStyle = i < filled ? '#f6e28a' : '#4a5a64'; c.lineWidth = .6; c.stroke();
    }
  }
  c.restore();
}
