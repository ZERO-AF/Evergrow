import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FISHING_RULES, FISHING_JUNK, FISHING_TIERS,
  freshFishing, fishingCast, fishingBite, fishingCatch, fishingCancel,
  fishingSkill, fishingProgress, awardFishingXp, catchesForLevel, fishingMaterialCount,
  fishingSpotNear, fishingSpotAt, fishingZoneAt, fishingZoneName, fishingRequiredSkill, fishingPrompt,
  type FishingSession, type FishingZone,
} from '../src/fishing.ts';
import { validItem } from '../src/item-validation.ts';
import { INVENTORY_CAPACITY } from '../src/items.ts';
import type { Player, WorldQuery } from '../src/model.ts';
const zone = (level = 15, requiredSkill = 78): FishingZone =>
  ({ level, biome: 'steppe', name: 'The Barrens', requiredSkill });
const wet = () => ({ coverage: 1 });
const dry = () => ({ coverage: 0 });
const rng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
function player(skill = 300): Player {
  return {
    x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, angle: 0, dead: false,
    fishing: { level: skill, xp: 0 },
    character: {
      gold: 0, inventory: new Array(INVENTORY_CAPACITY).fill(null), inventoryLayout: {},
      equipped: {}, recentItems: [],
    },
  } as unknown as Player;
}
/** Cast and advance until the splash; returns the bite time. */
function castToBite(session: FishingSession, p: Player, random: () => number, z = zone()): number {
  assert.ok(fishingCast(session, p, wet, z, 0, random).ok);
  let t = 0, event = null;
  while (!event && t < 30) { t += .05; event = fishingBite(session, p, t, random); }
  assert.equal(event, 'bite');
  return t;
}

test('cast requires fishable water and reports the problem', () => {
  const session = freshFishing(), p = player();
  const result = fishingCast(session, p, dry, zone(), 0, rng(1));
  assert.equal(result.ok, false);
  assert.match(result.problem, /water/i);
  assert.equal(session.bobber, null);
  // Aimed casts must also land in water inside range.
  assert.equal(fishingCast(session, p, wet, zone(), 0, rng(1), { x: 9999, y: 0 }).ok, false);
  assert.equal(fishingCast(session, p, dry, zone(), 0, rng(1), { x: 40, y: 0 }).ok, false);
});

test('bite fires inside the scheduled window and catch yields a real fish material', () => {
  const session = freshFishing(), p = player(300), random = rng(7);
  const t = castToBite(session, p, random);
  const result = fishingCatch(session, p, t + .3, random);
  assert.equal(result.kind, 'fish');
  const fish = result.kind === 'fish' ? result.fish : null;
  assert.ok(fish && FISHING_TIERS[1].fish.some(f => f.id === fish.id) || fish!.id === 'bristleWhiskerCatfish');
  assert.equal(fishingMaterialCount(p, fish!.id), 1);
  assert.equal(session.bobber, null);
  assert.ok(p.combatLog!.some(e => e.text.includes(fish!.name)));
});

test('reeling before the bite ends the cast with no catch', () => {
  const session = freshFishing(), p = player(), random = rng(3);
  assert.ok(fishingCast(session, p, wet, zone(), 0, random).ok);
  const result = fishingCatch(session, p, 1, random);
  assert.equal(result.kind, 'early');
  assert.equal(session.bobber, null);
  assert.equal(fishingSkill(p).xp, 0);
});

test('a missed splash window reschedules the bite instead of ending the cast', () => {
  const session = freshFishing(), p = player(), random = rng(11);
  const t = castToBite(session, p, random);
  fishingBite(session, p, t + FISHING_RULES.biteWindow + .1, random);
  assert.ok(session.bobber);
  assert.equal(session.bobber!.bitAt, undefined);
  assert.ok(session.bobber!.biteAt > t);
});

test('the cast expires after the timeout and walking away snaps the line', () => {
  const session = freshFishing(), p = player(), random = rng(5);
  assert.ok(fishingCast(session, p, wet, zone(), 0, random).ok);
  assert.equal(fishingBite(session, p, FISHING_RULES.castTimeout + .5, random), 'expired');
  assert.equal(session.bobber, null);
  assert.ok(fishingCast(session, p, wet, zone(), 0, random).ok);
  p.x = session.bobber!.x + FISHING_RULES.breakDistance + 1;
  assert.equal(fishingBite(session, p, 1, random), 'cancelled');
  assert.equal(session.bobber, null);
});

test('under-skilled anglers mostly lose the fish; skilled anglers catch', () => {
  const session = freshFishing(), hard = zone(60, 312);
  let escaped = 0;
  for (let i = 0; i < 30; i++) {
    const p = player(1), random = rng(100 + i);
    const t = castToBite(session, p, random, hard);
    if (fishingCatch(session, p, t + .2, random).kind === 'escaped') escaped++;
  }
  assert.ok(escaped >= 20, `expected most casts to escape, got ${escaped}`);
  const p = player(450), random = rng(9);
  const t = castToBite(session, p, random, hard);
  assert.notEqual(fishingCatch(session, p, t + .2, random).kind, 'escaped');
});

test('successful catches award xp and level the skill on the WotLK curve', () => {
  assert.equal(catchesForLevel(1), 1);
  assert.equal(catchesForLevel(75), 2);
  assert.equal(catchesForLevel(375), 6);
  const p = player(1);
  assert.equal(awardFishingXp(p, 1), 1);
  assert.equal(fishingSkill(p).level, 2);
  p.fishing = { level: 449, xp: 0 };
  assert.equal(awardFishingXp(p, catchesForLevel(449)), 1);
  assert.equal(fishingSkill(p).level, 450);
  assert.equal(awardFishingXp(p, 10), 0);
  assert.equal(fishingProgress(p).maxed, true);
});

test('junk catches auto-sell for gold and treasure items stay save-valid', () => {
  const session = freshFishing(), p = player(450);
  // Rig the roll: escape 0.5 (no), treasure/junk boundary via junkChance=.05 → roll .06 lands junk.
  const seq = [.5, .06, .3, .3];
  let i = 0;
  const rig = () => seq[i++] ?? .5;
  const t = castToBite(session, p, rng(1));
  const junk = fishingCatch(session, p, t + .2, rig);
  assert.equal(junk.kind, 'junk');
  assert.ok(p.character.gold! > 0);
  assert.ok(FISHING_JUNK.some(j => j.name === (junk.kind === 'junk' ? junk.name : '')));
  // Force treasures until every item-kind entry has been exercised.
  const seen = new Set<string>();
  for (let k = 0; k < 400 && seen.size < 4; k++) {
    const r = rng(1000 + k);
    const tt = castToBite(session, p, r);
    const seq2 = [.9, .01, r(), r()];
    let j = 0;
    const result = fishingCatch(session, p, tt + .2, () => seq2[j++] ?? .5);
    if (result.kind === 'treasure' && result.item) {
      seen.add(result.name);
      assert.ok(validItem(result.item), `${result.name} failed item validation`);
    }
  }
  assert.ok(seen.has('Rockhide Strongfish'));
  assert.ok(seen.has('The 1 Ring'));
});

test('zone names and required skill follow real WoW bands', () => {
  assert.equal(fishingZoneName(8, 'verdant'), 'Elwynn Forest');
  assert.equal(fishingZoneName(15, 'steppe'), 'The Barrens');
  assert.equal(fishingZoneName(35, 'verdant'), 'Stranglethorn Vale');
  assert.equal(fishingZoneName(55, 'frostpine'), 'Winterspring');
  assert.equal(fishingZoneName(75, 'highlands'), 'Grizzly Hills');
  assert.equal(fishingRequiredSkill(80), 416);
  const world: WorldQuery = { blocked: () => false, move: (x, y) => ({ x, y }), seed: 7319, sampleBiome: () => ({ id: 'steppe' }) };
  const z = fishingZoneAt(world, 0, 0, 10);
  assert.ok(z.requiredSkill > 0 && z.name.length > 0);
});

test('prompt reflects the fishing state machine', () => {
  const session = freshFishing(), p = player();
  assert.equal(fishingPrompt(session, p, dry, 'E'), null);
  assert.equal(fishingPrompt(session, p, wet, 'E'), 'Fish  [E]');
  assert.ok(fishingCast(session, p, wet, zone(), 0, rng(2)).ok);
  assert.match(fishingPrompt(session, p, wet, 'E')!, /reel in/);
  session.bobber!.bitAt = 1;
  assert.equal(fishingPrompt(session, p, wet, 'E'), 'Click to catch!');
  fishingCancel(session);
  assert.equal(session.bobber, null);
});

test('fishingSpotNear finds the closest water ring and respects range', () => {
  const p = player();
  // Water only in a band 100–140 east.
  const band = (x: number, y: number) => ({ coverage: x > 100 && x < 140 && Math.abs(y) < 40 ? 1 : 0 });
  const spot = fishingSpotNear(p, band);
  assert.ok(spot && spot.x > 100 && spot.x < 140);
  assert.ok(Math.hypot(spot!.x, spot!.y) <= FISHING_RULES.castRange);
  assert.equal(fishingSpotNear(p, dry), null);
  assert.equal(fishingSpotAt(p, { x: 50, y: 0 }, band), null);
  assert.ok(fishingSpotAt(p, { x: 120, y: 0 }, band));
});
