import assert from 'node:assert/strict';
import test from 'node:test';
import { bossFrameEligible, bossFrameTargets, drawBossFrame, getBossFrameLayout, BOSS_FRAME } from '../src/boss-frame.ts';
import { getMinimapRect } from '../src/map-view.ts';
import { getHUDLayout } from '../src/hud-layout.ts';
import type { Enemy, EnemyKind, Player } from '../src/model.ts';

const enemy = (id = 1, x = 0, y = 0, kind: EnemyKind = 'stalker'): Enemy => ({
  id, level: 1, rank: 'normal', biome: 'deadwood', lootSeed: id, damage: 8, xpReward: 20, x, y, prevX: x, prevY: y, vx: 0, vy: 0, knockbackX: 0, knockbackY: 0,
  angle: 0, hp: 100, maxHp: 100, kind, state: 'idle', stateTime: 0, stateDuration: 1,
  homeX: x, homeY: y, awareness: 0, lostSightTime: 0, lastSeenX: x, lastSeenY: y, senseTime: 0, seesPlayer: false, patrolPhase: 0,
  attackAngle: 0, attackTargetX: x, attackTargetY: y, hitFlash: 0, hitAngle: 0, radius: 10, stagger: 0, attackHit: false, interrupted: false, slowTime: 0, slowFactor: 1, burnTime: 0, burnDps: 0, burnTick: 0,
});
const player = (targetId: number | null = null): Pick<Player, 'x' | 'y' | 'targetId'> => ({ x: 0, y: 0, targetId });

/** Minimal 2D stub: records commands and asserts finite geometry, like art.test.ts. */
class FrameContext {
  globalAlpha = 1; fillStyle = '#000'; strokeStyle = '#000'; lineWidth = 1; lineJoin = 'miter'; lineCap = 'butt';
  shadowColor = ''; shadowBlur = 0; shadowOffsetY = 0; font = ''; textAlign = 'left'; textBaseline = 'alphabetic';
  direction = 'ltr'; fontKerning = 'normal';
  commands = 0; private saved: this[] = [];
  private record(...values: number[]) { assert.ok(values.every(Number.isFinite), 'all emitted geometry must be finite'); this.commands++; }
  save() { this.saved.push(Object.assign(Object.create(FrameContext.prototype) as this, this, { saved: [] })); }
  restore() { const s = this.saved.pop(); if (s) Object.assign(this, s); }
  translate(...v: number[]) { this.record(...v); }
  scale(...v: number[]) { this.record(...v); }
  transform(...v: number[]) { this.record(...v); }
  setTransform(...v: number[]) { this.record(...v); }
  getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }
  beginPath() {} closePath() {} clip() {}
  moveTo(...v: number[]) { this.record(...v); }
  lineTo(...v: number[]) { this.record(...v); }
  quadraticCurveTo(...v: number[]) { this.record(...v); }
  bezierCurveTo(...v: number[]) { this.record(...v); }
  arc(...v: number[]) { this.record(...v); }
  ellipse(...v: number[]) { this.record(...v); }
  rect(...v: number[]) { this.record(...v); }
  fillRect(...v: number[]) { this.record(...v); }
  strokeRect(...v: number[]) { this.record(...v); }
  fill() { this.commands++; } stroke() { this.commands++; }
  fillText() { this.commands++; }
  measureText(v: string) { return { width: v.length * 6, actualBoundingBoxAscent: 8 }; }
  drawImage() { this.commands++; }
  createLinearGradient(...v: number[]) { this.record(...v); return { addColorStop: (o: number) => this.record(o) }; }
  createRadialGradient(...v: number[]) { this.record(...v); return { addColorStop: (o: number) => this.record(o) }; }
}

test('the frame draws finite geometry with live health, debuff icons and combo pips', () => {
  const g = globalThis as Record<string, unknown>;
  const hadDocument = 'document' in g, hadPath2D = 'Path2D' in g;
  g.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new FrameContext() }) };
  g.Path2D ??= class { constructor(_d?: string) {} };
  try {
    const boss = enemy(1, 0, 0, 'warden');
    boss.hp = 640; boss.maxHp = 1280; boss.state = 'windup'; boss.stateTime = .4; boss.stateDuration = 1;
    const c = new FrameContext();
    drawBossFrame(c as unknown as CanvasRenderingContext2D, boss, 960, 600, {
      debuffs: [
        { id: 'burn', name: 'Burn', label: 'Burn', icon: 'fireball', color: '#f5ab75', remaining: 3.2, duration: 6, summary: '' },
        { id: 'trait:swift', name: 'Swift', label: 'Swift', icon: 'lunge', color: '#7ce4ed', remaining: 1, duration: 1, persistent: true, summary: '' },
      ],
      hitPulse: .5, time: 2.5, comboPoints: 3,
    });
    assert.ok(c.commands > 100, 'an engaged boss emits a full frame');
    const empty = new FrameContext();
    drawBossFrame(empty as unknown as CanvasRenderingContext2D, boss, 200, 120, {});
    assert.equal(empty.commands, 0, 'a frame that cannot fit emits nothing');
  } finally {
    if (!hadDocument) delete g.document;
    if (!hadPath2D) delete g.Path2D;
  }
});

test('boss kinds and elite ranks qualify for the encounter frame; normals and veterans do not', () => {
  for (const kind of ['warden', 'briarMatriarch', 'ashColossus', 'graveMarshal'] as const)
    assert.ok(bossFrameEligible(enemy(1, 0, 0, kind)));
  assert.ok(bossFrameEligible({ ...enemy(), rank: 'elite' }));
  assert.ok(!bossFrameEligible(enemy()));
  assert.ok(!bossFrameEligible({ ...enemy(), rank: 'veteran' }));
});

test('engaging a boss sets the frame; killing or disengaging clears it', () => {
  const boss = enemy(1, 100, 0, 'warden');
  assert.equal(bossFrameTargets([boss], player(), null).length, 0, 'an idle nearby boss shows no frame');
  boss.state = 'chase';
  assert.deepEqual(bossFrameTargets([boss], player(), null).map(e => e.id), [1], 'engagement shows the frame');
  boss.hp = 0;
  assert.equal(bossFrameTargets([boss], player(), null).length, 0, 'death clears the frame');
  boss.hp = 100; boss.state = 'return';
  assert.equal(bossFrameTargets([boss], player(), null).length, 0, 'leashing back clears the frame');
});

test('a tab-targeted or focused boss shows the frame even before engagement', () => {
  const boss = enemy(1, 100, 0, 'warden');
  assert.deepEqual(bossFrameTargets([boss], player(1), null).map(e => e.id), [1], 'locked target');
  assert.deepEqual(bossFrameTargets([boss], player(), 1).map(e => e.id), [1], 'focused enemy');
  const dead = enemy(2, 100, 0, 'warden'); dead.hp = 0;
  assert.equal(bossFrameTargets([dead], player(2), 2).length, 0, 'dead targets never frame');
});

test('engaged bosses must stay inside their encounter radius', () => {
  const warden = enemy(1, 1200, 0, 'warden'); warden.state = 'chase';
  assert.equal(bossFrameTargets([warden], player(), null).length, 0, 'dungeon boss out of range');
  warden.x = 900;
  assert.equal(bossFrameTargets([warden], player(), null).length, 1);
  const matriarch = enemy(2, 800, 0, 'briarMatriarch'); matriarch.state = 'chase';
  assert.equal(bossFrameTargets([matriarch], player(), null).length, 0, 'wilderness boss leashes tighter');
  matriarch.x = 500;
  assert.equal(bossFrameTargets([matriarch], player(), null).length, 1);
});

test('engaged elites use the frame while engaged normals keep the small plate', () => {
  const elite = { ...enemy(1, 100, 0), rank: 'elite' as const, state: 'chase' as const };
  const normal = enemy(2, 100, 0); normal.state = 'chase';
  assert.deepEqual(bossFrameTargets([elite, normal], player(), null).map(e => e.id), [1]);
});

test('at most two frames stack, locked target first then nearest engaged', () => {
  const a = enemy(1, 300, 0, 'warden'), b = enemy(2, 200, 0, 'warden'), c = enemy(3, 100, 0, 'warden');
  for (const e of [a, b, c]) e.state = 'chase';
  assert.deepEqual(bossFrameTargets([a, b, c], player(), null).map(e => e.id), [3, 2], 'nearest two');
  assert.deepEqual(bossFrameTargets([a, b, c], player(1), null).map(e => e.id), [1, 3], 'locked target leads');
});

test('boss frame layout stays centered, clears the minimap, and stacks downward', () => {
  for (const width of [540, 720, 960, 1440]) {
    const frame = getBossFrameLayout(width, 600), map = getMinimapRect(width, 600);
    assert.equal(frame.x + frame.width / 2, width / 2);
    assert.ok(frame.width >= BOSS_FRAME.minWidth && frame.width <= BOSS_FRAME.width);
    assert.equal(frame.height, BOSS_FRAME.height);
    assert.ok(frame.x + frame.width <= map.x - 12 || frame.y >= map.y + map.height, 'minimap clearance');
    assert.ok(frame.y + frame.height <= getHUDLayout(width, 600).y - 8);
    const second = getBossFrameLayout(width, 600, { slot: 1 });
    assert.equal(second.y, frame.y + BOSS_FRAME.height + BOSS_FRAME.gap);
  }
});

test('surfaces too small for a readable boss frame omit it instead of overlapping the HUD', () => {
  for (const [width, height] of [[960, 160], [320, 240], [200, 844], [0, 0]]) {
    const frame = getBossFrameLayout(width, height);
    assert.equal(frame.height, 0);
    assert.ok(Object.values(frame).every(Number.isFinite));
  }
  // A second stacked slot that would cross into the HUD is omitted too.
  assert.equal(getBossFrameLayout(960, 130, { slot: 1 }).height, 0);
});
