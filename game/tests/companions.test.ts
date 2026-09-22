import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import type { WorldQuery } from '../src/model.ts';
import {
  COMPANIONS, COMPANION_IDS, companionFromToken, companionToken, isCompanionId,
} from '../src/companion-content.ts';
import {
  COMPANION_RULES, activeCompanion, advanceCompanionFollower, companionAnchor, companionCount,
  companionEarned, companionOwned, freshCompanionFollower, grantCompanion, ownedCompanions,
  summonCompanion, syncCompanions,
} from '../src/companion-state.ts';
import { drawCompanion } from '../src/companion-art.ts';
import { MOUNTS, MOUNT_IDS } from '../src/mount-content.ts';
import { grantMount, mountUnlocked, preferredMount } from '../src/mount-state.ts';
import { drawMount, mountPose } from '../src/mount-art.ts';
import { ACHIEVEMENT_BY_ID } from '../src/achievement-content.ts';
import { achievementComplete, achievementProgress, achievementTrack } from '../src/achievement-state.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const sim = () => new Simulation(world, { spawn: false });
const stubCtx = () => ({
  fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
  beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {},
  arc() {}, ellipse() {}, fillRect() {}, save() {}, restore() {}, translate() {}, scale() {},
}) as unknown as CanvasRenderingContext2D;

// ── Collection ──────────────────────────────────────────────────────────────

test('grantCompanion collects once and tracks the count', () => {
  const s = sim();
  const first = grantCompanion(s.player, 'wisp');
  assert.equal(first.added, true);
  assert.equal(companionOwned(s.player, 'wisp'), true);
  assert.equal(companionCount(s.player), 1);
  const again = grantCompanion(s.player, 'wisp');
  assert.equal(again.added, false);
  assert.equal(companionCount(s.player), 1);
  assert.deepEqual(ownedCompanions(s.player), ['wisp']);
});

test('syncCompanions auto-grants achievement, profession, reputation and fishing sources', () => {
  const s = sim();
  s.player.achievements = { 'the-fall-of-naxxramas': 1e9, 'world-explorer': 1e9, 'northrend-dungeonmaster': 1e9 };
  s.player.professions = { engineering: { level: 100, xp: 0 } };
  s.player.reputation = { timbermawHold: 9000, thoriumBrotherhood: 21000 };
  s.player.fishing = { level: 200, xp: 0 };
  const { added } = syncCompanions(s.player);
  // Earned: mini-diablo, sprite-darter, proto-whelp (achievements), squirrel
  // (blacksmithing 75), wolvar-pup (honored), core-hound-pup (revered), snapjaw
  // (fishing 150). Vendor/drop sources never auto-grant.
  assert.deepEqual([...added].sort(),
    ['core-hound-pup', 'mini-diablo', 'proto-whelp', 'snapjaw', 'sprite-darter', 'squirrel', 'wolvar-pup']);

  assert.equal(companionOwned(s.player, 'wisp'), false);
  assert.equal(companionOwned(s.player, 'penguin'), false);
  // A second sync is a no-op.
  assert.equal(syncCompanions(s.player).added.length, 0);
});

test('companionEarned gates on each source kind', () => {
  const s = sim();
  assert.equal(companionEarned(s.player, COMPANIONS['squirrel']), false);
  s.player.professions = { engineering: { level: 75, xp: 0 } };
  assert.equal(companionEarned(s.player, COMPANIONS['squirrel']), true);
  assert.equal(companionEarned(s.player, COMPANIONS['crate-rat']), false); // drop: never auto
  s.player.reputation = { sonsOfHodir: 21000 };
  assert.equal(companionEarned(s.player, COMPANIONS['core-hound-pup']), false); // wrong faction
});

// ── Summon ──────────────────────────────────────────────────────────────────

test('summon requires ownership; one active at a time; dismiss clears', () => {
  const s = sim();
  assert.equal(activeCompanion(s.player), null);
  assert.match(summonCompanion(s.player, 'wisp') ?? '', /not in your collection/);
  grantCompanion(s.player, 'wisp');
  grantCompanion(s.player, 'penguin');
  assert.equal(summonCompanion(s.player, 'wisp'), null);
  assert.equal(activeCompanion(s.player), 'wisp');
  // Summoning another replaces the active pick.
  assert.equal(summonCompanion(s.player, 'penguin'), null);
  assert.equal(activeCompanion(s.player), 'penguin');
  assert.equal(summonCompanion(s.player, null), null);
  assert.equal(activeCompanion(s.player), null);
});

test('active pick survives a checkpoint round-trip through the achievements ledger', () => {
  const s = sim();
  grantCompanion(s.player, 'phoenix');
  summonCompanion(s.player, 'phoenix');
  const checkpoint = s.captureCheckpoint();
  assert.equal(checkpoint.achievements?.[COMPANION_RULES.activeKey], companionToken('phoenix'));
  assert.equal(checkpoint.achievements?.[`${COMPANION_RULES.seenPrefix}phoenix`], 1);
  // Simulate reload: a fresh player carrying the persisted ledger.
  const s2 = sim();
  s2.player.achievements = { ...checkpoint.achievements };
  assert.equal(activeCompanion(s2.player), 'phoenix');
  assert.equal(companionCount(s2.player), 1);
});

test('a stored pick whose marker is gone reads as dismissed', () => {
  const s = sim();
  s.player.achievements = { [COMPANION_RULES.activeKey]: companionToken('wisp') };
  assert.equal(activeCompanion(s.player), null);
});

// ── Follow ──────────────────────────────────────────────────────────────────

test('follower converges on the anchor and teleports when too far', () => {
  const s = sim();
  s.player.x = 500; s.player.y = 500; s.player.angle = 0;
  const f = freshCompanionFollower(0, 0); // far beyond teleportRange
  advanceCompanionFollower(f, s.player, 1 / 60);
  const anchor = companionAnchor(s.player);
  assert.equal(f.x, anchor.x);
  assert.equal(f.y, anchor.y);
  // Drift the player; the follower closes the gap over steps.
  s.player.x += 30;
  for (let i = 0; i < 120; i++) advanceCompanionFollower(f, s.player, 1 / 60);
  const next = companionAnchor(s.player);
  assert.ok(Math.hypot(f.x - next.x, f.y - next.y) < 1);
  assert.ok(f.phase > 0);
});

test('reduced motion snaps to the anchor and freezes the phase', () => {
  const s = sim();
  const f = freshCompanionFollower(0, 0);
  advanceCompanionFollower(f, s.player, 1 / 60, true);
  const anchor = companionAnchor(s.player);
  assert.equal(f.x, anchor.x);
  const phase = f.phase;
  advanceCompanionFollower(f, s.player, 1 / 60, true);
  assert.equal(f.phase, phase);
});

// ── Collection achievements ─────────────────────────────────────────────────

test("Lil' Game Hunter credits collected companions", () => {
  const s = sim();
  const def = ACHIEVEMENT_BY_ID['lil-game-hunter'];
  assert.equal(def.criterion.kind, 'companions');
  for (const id of COMPANION_IDS.slice(0, 5)) grantCompanion(s.player, id);
  assert.equal(achievementComplete(s.player.achievements, 'lil-game-hunter'), false);
  assert.equal(achievementProgress(def, s.player).value, 5);
  const { unlocked } = grantCompanion(s.player, COMPANION_IDS[5]);
  assert.ok(unlocked.some(a => a.id === 'lil-game-hunter'));
  assert.equal(achievementComplete(s.player.achievements, 'lil-game-hunter'), true);
});

test("Mountain o' Mounts credits distinct summoned mounts", () => {
  const s = sim();
  const def = ACHIEVEMENT_BY_ID['mountain-o-mounts'];
  assert.equal(def.count, 10);
  for (const id of MOUNT_IDS.slice(0, 9)) achievementTrack(s.player, { type: 'mount', mount: id });
  assert.equal(achievementComplete(s.player.achievements, 'mountain-o-mounts'), false);
  const unlocked = achievementTrack(s.player, { type: 'mount', mount: MOUNT_IDS[9] });
  assert.ok(unlocked.some(a => a.id === 'mountain-o-mounts'));
});

// ── Mount unlocks ───────────────────────────────────────────────────────────

test('base mounts stay unlocked; flag mounts wait on grantMount', () => {
  const s = sim();
  for (const id of ['horse', 'wolf', 'ram'] as const) assert.equal(mountUnlocked(s.player, id), true);
  for (const id of ['drake', 'raptor', 'polarBear'] as const) assert.equal(mountUnlocked(s.player, id), false);
  grantMount(s.player, 'raptor');
  assert.equal(mountUnlocked(s.player, 'raptor'), true);
  assert.equal(mountUnlocked(s.player, 'polarBear'), false);
});

test('achievement, profession, reputation and fishing mounts evaluate live state', () => {
  const s = sim();
  assert.equal(mountUnlocked(s.player, 'spectralSteed'), false);
  s.player.achievements = { 'the-loremaster': 1e9 };
  assert.equal(mountUnlocked(s.player, 'spectralSteed'), true);
  assert.equal(mountUnlocked(s.player, 'carpet'), false);
  s.player.professions = { enchanting: { level: 300, xp: 0 } };
  assert.equal(mountUnlocked(s.player, 'carpet'), true);
  assert.equal(mountUnlocked(s.player, 'mammoth'), false);
  s.player.reputation = { sonsOfHodir: 21000 };
  assert.equal(mountUnlocked(s.player, 'mammoth'), true);
  assert.equal(mountUnlocked(s.player, 'turtle'), false);
  s.player.fishing = { level: 300, xp: 0 };
  assert.equal(mountUnlocked(s.player, 'turtle'), true);
});

test('preferredMount falls back to the fastest unlocked mount', () => {
  const s = sim();
  assert.equal(preferredMount(s.player), 'horse');
  s.player.character.mount = 'protoDrake'; // locked pick
  assert.equal(preferredMount(s.player), 'horse');
  s.player.achievements = { 'northrend-dungeonmaster': 1e9 };
  assert.equal(preferredMount(s.player), 'protoDrake'); // fastest unlocked wins
  s.player.character.mount = 'wolf'; // a valid pick beats fastest
  assert.equal(preferredMount(s.player), 'wolf');
});

// ── Art smoke ───────────────────────────────────────────────────────────────

test('companion art draws every companion without throwing', () => {
  const ctx = stubCtx();
  const f = freshCompanionFollower(10, 10);
  for (const id of COMPANION_IDS) {
    drawCompanion(ctx, COMPANIONS[id], f, 10, 10, 1.5);
    drawCompanion(ctx, COMPANIONS[id], f, 10, 10, 0, true); // reduced motion
  }
});

test('mount art draws every mount silhouette without throwing', () => {
  const ctx = stubCtx();
  const s = sim();
  const pose = mountPose(s.player, 1.5);
  for (const id of MOUNT_IDS) drawMount(ctx, MOUNTS[id], pose);
});

test('companion tokens round-trip and validate ids', () => {
  for (const id of COMPANION_IDS) assert.equal(companionFromToken(companionToken(id)), id);
  assert.equal(companionFromToken(0), null);
  assert.equal(companionFromToken(999), null);
  assert.equal(isCompanionId('wisp'), true);
  assert.equal(isCompanionId('dragon'), false);
});
