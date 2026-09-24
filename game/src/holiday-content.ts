/** Darkmoon Faire (WoW holiday event): content tables and the seeded schedule.
 * Pure data + deterministic derivation — no live state, no checkpoint access.
 * The faire pitches its booths in a clearing beside the settlement nearest the
 * world origin; the real-time UTC calendar decides when the carnival is open
 * (the first week of each month, like Darkmoon's monthly visit). Runtime flags
 * and the ticket wallet live in holiday-state.ts, durable commands in
 * holiday-command.ts, and the faire window in holiday-panel.ts. */
import { siteHash } from './wilderness-sites.ts';
import { hashService, memoFixture, type TownNPC } from './npcs.ts';
import { getZoneAt } from './zone-progression.ts';
import { generateItem } from './items.ts';
import type { WorldQuery } from './model.ts';
import type { Settlement } from './settlements.ts';
import type { WildernessSite } from './wilderness-sites.ts';
import type { Attribute, Item, ItemKind, ItemTier } from './character-types.ts';
import type { CompanionId } from './companion-content.ts';
import type { MountId } from './mount-content.ts';
import type { WorldPOI } from './world-pois.ts';

export const FAIRE_NAME = 'Darkmoon Faire';
export const TICKET_NAME = 'Darkmoon Prize Ticket';

export const HOLIDAY_RULES = Object.freeze({
  /** UTC days each month the faire is open (the 1st through the 7th). */
  openDays: 7,
  /** E-reach for a booth interaction. */
  boothReach: 78,
  /** E-reach for the prize vendor (matches canInteractNPC). */
  vendorReach: 70,
  /** Booth ring radius inside the clearing. */
  boothRing: 150,
  /** Vendor stall offset south of the faire heart. */
  vendorOffset: 215,
  /** Clearing radius the site claims on the map. */
  siteRadius: 320,
  /** Extra margin kept between the clearing and the host settlement's edge. */
  townMargin: 150,
});

// ── Schedule ─────────────────────────────────────────────────────────────────

export interface FaireWindow {
  /** Months since the Unix epoch; identifies one faire for flags and seeds. */
  readonly index: number;
  /** Epoch-ms when the faire opens (UTC midnight on the 1st). */
  readonly start: number;
  /** Epoch-ms when the faire closes (UTC midnight on the 8th). */
  readonly end: number;
}

/** The faire window containing `now`, or the next one when the faire is away. */
export function faireWindowAt(now: number): FaireWindow {
  const day = new Date(now);
  let year = day.getUTCFullYear(), month = day.getUTCMonth();
  if (day.getUTCDate() > HOLIDAY_RULES.openDays) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  const start = Date.UTC(year, month, 1);
  return { index: year * 12 + month, start, end: start + HOLIDAY_RULES.openDays * 86400000 };
}

export const faireActive = (now: number): boolean => now >= faireWindowAt(now).start;

export interface FaireStatus {
  readonly active: boolean;
  readonly window: FaireWindow;
  /** Whole days left in the window (0 on the last day), or until it opens. */
  readonly days: number;
  /** Leftover hours inside the partial day, for a finer countdown. */
  readonly hours: number;
  readonly label: string;
}

/** HUD/panel projection of the schedule; never advances state. */
export function faireStatus(now: number): FaireStatus {
  const window = faireWindowAt(now);
  const active = now >= window.start;
  const remaining = Math.max(0, (active ? window.end : window.start) - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const label = active
    ? days > 0 ? `The faire is in town — ${days}d ${hours}h left` : `Last day — ${hours}h left`
    : `The faire returns in ${days}d ${hours}h`;
  return { active, window, days, hours, label };
}

// ── Activities ───────────────────────────────────────────────────────────────

export type FaireLimit = 'day' | 'faire';
export interface FaireActivity {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  /** Attribute that sharpens the seeded skill check. */
  readonly attribute: Attribute;
  /** Score (0–99 + attribute bonus) needed for the full prize. */
  readonly difficulty: number;
  /** Tickets on a success. */
  readonly tickets: number;
  /** Tickets on a miss — the faire always pays something for a try. */
  readonly consolation: number;
  /** 'day' re-arms each UTC day of the window; 'faire' once per visit. */
  readonly limit: FaireLimit;
}

const activity = (id: string, name: string, blurb: string, attribute: Attribute,
  difficulty: number, tickets: number, consolation: number, limit: FaireLimit): FaireActivity =>
  Object.freeze({ id, name, blurb, attribute, difficulty, tickets, consolation, limit });

/** Carnival booths: four daily skill checks plus Sayge's once-per-faire reading. */
export const DARKMOON_ACTIVITIES: readonly FaireActivity[] = Object.freeze([
  activity('tonk-challenge', 'Tonk Challenge', 'Pilot a steam tonk through the target course.',
    'dexterity', 55, 5, 2, 'day'),
  activity('whack-a-gnoll', 'Whack-a-Gnoll', 'Gnolls pop from the barrels — swing fast, swing true.',
    'strength', 45, 4, 1, 'day'),
  activity('ring-toss', 'Ring Toss', 'Land the ring on the bottle necks.',
    'dexterity', 65, 6, 2, 'day'),
  activity('cannon-blast', 'Cannon Blast', 'Take the ride and stick the landing in the target ring.',
    'vitality', 50, 5, 2, 'day'),
  activity('sayges-fortunes', "Sayge's Fortunes", 'The old seer reads your fortune once each visit.',
    'intelligence', 40, 8, 3, 'faire'),
]);

export const faireActivity = (id: string): FaireActivity | undefined =>
  DARKMOON_ACTIVITIES.find(a => a.id === id);

/** Deterministic 0–99 roll for one activity attempt; `flag` is the day key or
 * faire index the attempt is stamped with, so replays never re-roll. */
export function activityRoll(siteSeed: number, activityId: string, flag: number): number {
  return siteHash(siteSeed, flag, hashService(`faire:${activityId}`), 0xd4a7) % 100;
}

export interface FaireOutcome {
  readonly success: boolean;
  /** A roll of 97+ is a critical success: the barkers pay a bonus. */
  readonly critical: boolean;
  readonly tickets: number;
  readonly score: number;
  readonly roll: number;
}

/** Resolve the seeded skill check: roll + attribute bonus vs the difficulty. */
export function activityOutcome(siteSeed: number, activity: FaireActivity, flag: number, attributeScore: number): FaireOutcome {
  const roll = activityRoll(siteSeed, activity.id, flag);
  const score = Math.min(99, roll + Math.max(0, Math.floor(attributeScore / 10)));
  const critical = roll >= 97;
  const success = score >= activity.difficulty;
  const tickets = success ? activity.tickets + (critical ? 2 : 0) : activity.consolation;
  return { success, critical, tickets, score, roll };
}

// ── The faire site ───────────────────────────────────────────────────────────

/** World surface needed to place the clearing; mirrors WorldEventWorld. */
export interface FaireWorld extends WorldQuery {
  sampleWater?(x: number, y: number): { coverage: number };
  getSettlements?(x: number, y: number, width: number, height: number): readonly Settlement[];
  /** World/AuthoredWorld resolve the nearest town without a rect scan. */
  getNearestSettlement?(x: number, y: number): Settlement;
  getWildernessSites?(x: number, y: number, width: number, height: number): readonly WildernessSite[];
}

export interface FaireSite {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly seed: number;
  readonly level: number;
  /** Host settlement identity for panel copy and map labels. */
  readonly townId: string;
  readonly townName: string;
}

export interface FaireBooth {
  readonly id: string;
  readonly activityId: string;
  readonly x: number;
  readonly y: number;
  readonly seed: number;
  readonly site: FaireSite;
}

/** Open ground for the clearing: no collision, no deep water, outside the host
 * settlement's walls but close enough to read as its fairground. */
function clearingClear(world: FaireWorld, town: Settlement | null, x: number, y: number): boolean {
  if (world.blocked(x, y, 60) || world.isSanctuary?.(x, y)) return false;
  if ((world.sampleWater?.(x, y)?.coverage ?? 0) > .12) return false;
  if (town && Math.hypot(x - town.x, y - town.y) < town.radius + HOLIDAY_RULES.townMargin) return false;
  if (world.getSettlements?.(x - 400, y - 400, 800, 800).some(t => Math.hypot(t.x - x, t.y - y) < t.radius + HOLIDAY_RULES.townMargin)) return false;
  if (world.getWildernessSites?.(x - 400, y - 400, 800, 800).some(s => Math.hypot(s.x - x, s.y - y) < s.radius + 240)) return false;
  return true;
}

/** Spiral out from the seeded hint; deterministic order, bounded work per call. */
function probeClearing(world: FaireWorld, town: Settlement | null, hint: { x: number; y: number }): { x: number; y: number } {
  for (let ring = 0; ring <= 14; ring++) {
    const radius = ring * 130;
    const steps = ring === 0 ? 1 : Math.min(24, ring * 6);
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2 + ring * .7;
      const x = hint.x + Math.cos(angle) * radius, y = hint.y + Math.sin(angle) * radius;
      if (clearingClear(world, town, x, y)) return { x, y };
    }
  }
  return hint;
}

/** The faire's permanent clearing: beside the settlement nearest the world
 * origin (the home town under the authored atlas), probed onto open ground.
 * The site exists year-round; the window only gates its activities. */
export function faireSite(world: FaireWorld): FaireSite {
  const seed = world.seed ?? 7319;
  const town = world.getNearestSettlement?.(0, 0)
    ?? (world.getSettlements?.(-60000, -60000, 120000, 120000) ?? [])
      .slice().sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0] ?? null;
  const siteSeed = siteHash(0, 0, seed, 0xfae1) >>> 0;
  const angle = siteSeed / 4294967296 * Math.PI * 2;
  const hint = town
    ? { x: town.x + Math.cos(angle) * (town.radius + HOLIDAY_RULES.townMargin + 170), y: town.y + Math.sin(angle) * (town.radius + HOLIDAY_RULES.townMargin + 170) }
    : { x: Math.cos(angle) * 900, y: Math.sin(angle) * 900 };
  const at = probeClearing(world, town, hint);
  const zone = getZoneAt(at.x, at.y, seed);
  return { id: 'faire:darkmoon', name: FAIRE_NAME, x: at.x, y: at.y, radius: HOLIDAY_RULES.siteRadius,
    seed: siteSeed, level: zone.level, townId: town?.id ?? '', townName: town?.name ?? 'the wilds' };
}

/** One booth per activity, ringed around the faire heart in catalog order. */
export function faireBooths(site: FaireSite): FaireBooth[] {
  return DARKMOON_ACTIVITIES.map((def, i) => {
    const angle = -Math.PI / 2 + i * (Math.PI * 2 / DARKMOON_ACTIVITIES.length);
    return { id: `${site.id}:booth:${def.id}`, activityId: def.id,
      x: site.x + Math.cos(angle) * HOLIDAY_RULES.boothRing,
      y: site.y + Math.sin(angle) * HOLIDAY_RULES.boothRing,
      seed: siteHash(site.seed, i, 0xb007) >>> 0, site };
  });
}

// ── The prize vendor ─────────────────────────────────────────────────────────

/** The faire's prize NPC — a standalone service NPC like the badge vendor,
 * anchored to the site rather than a building. `role` is 'darkmoonVendor',
 * which the integrator adds to NPCRole/NPC_NAMES so world NPC rendering and
 * the panel frame resolve it. */
export type FaireNPC = Omit<TownNPC, 'role'> & { role: 'darkmoonVendor' };

const FAIRE_VENDOR_NAMES = ['Silas', 'Gelvas', 'Lhara', 'Rona', 'Boomie', 'Flik'] as const;

export const faireVendor = memoFixture((site: FaireSite): FaireNPC => {
  const x = site.x, y = site.y + HOLIDAY_RULES.vendorOffset;
  const id = `${site.id}:vendor`;
  const seed = hashService(id);
  const zone = getZoneAt(x, y, site.seed);
  return { id, buildingId: site.id, role: 'darkmoonVendor', x, y, seed,
    name: FAIRE_VENDOR_NAMES[seed % FAIRE_VENDOR_NAMES.length],
    level: zone.level, maxLevel: zone.maxLevel, faction: 'neutral' };
});

/** One prize row: generated gear (replica weapon, cosmetics, heirloom trinket),
 * a companion collection marker, or a mount unlock flag. */
export type PrizeEntry =
  | { readonly id: string; readonly name: string; readonly kind: 'gear'; readonly slot: ItemKind; readonly tier: ItemTier; readonly price: number; readonly note: string }
  | { readonly id: string; readonly name: string; readonly kind: 'companion'; readonly companion: CompanionId; readonly price: number; readonly note: string }
  | { readonly id: string; readonly name: string; readonly kind: 'mount'; readonly mount: MountId; readonly price: number; readonly note: string };

const prizeGear = (id: string, name: string, slot: ItemKind, tier: ItemTier, price: number, note: string): PrizeEntry =>
  Object.freeze({ id, name, kind: 'gear', slot, tier, price, note });
const prizeCompanion = (id: string, name: string, companion: CompanionId, price: number, note: string): PrizeEntry =>
  Object.freeze({ id, name, kind: 'companion', companion, price, note });
const prizeMount = (id: string, name: string, mount: MountId, price: number, note: string): PrizeEntry =>
  Object.freeze({ id, name, kind: 'mount', mount, price, note });

/** Darkmoon prize stock: pets, a mount, cosmetics, a replica weapon and an
 * heirloom-style trinket — the WoW faire's ticket-sink catalog. */
export const DARKMOON_PRIZES: readonly PrizeEntry[] = Object.freeze([
  prizeCompanion('darkmoon-cub', 'Darkmoon Cub', 'worg-pup', 40, 'A companion pet for your collection.'),
  prizeCompanion('faerie-sprite', 'Faerie Sprite', 'sprite-darter', 60, 'A companion pet for your collection.'),
  prizeGear('faire-beret', 'Darkmoon Beret', 'head', 'rare', 25, 'Cosmetic carnival finery.'),
  prizeGear('faire-cloak', 'Cloak of the Carnival', 'cloak', 'rare', 30, 'Cosmetic carnival finery.'),
  prizeGear('replica-reaper', 'Replica Arcanite Reaper', 'weapon', 'epic', 90, 'A showpiece replica of a legendary axe.'),
  prizeGear('heirloom-charm', 'Heirloom Faire Charm', 'relic', 'epic', 75, 'A keepsake trinket that grows with you.'),
  prizeMount('dancing-bear', 'Darkmoon Dancing Bear', 'polarBear', 150, 'Unlocks a mount for your stable.'),
]);

export const prizeEntry = (stockId: string): PrizeEntry | undefined =>
  DARKMOON_PRIZES.find(entry => entry.id === stockId);

/** Roll a gear row's item at the buyer's level; deterministic per seed. */
export function prizeItem(entry: PrizeEntry & { kind: 'gear' }, level: number, seed: number): Item {
  const item = generateItem(seed, level, entry.slot, undefined, entry.tier);
  item.name = entry.name;
  item.baseName = entry.name;
  return item;
}

// ── Map marker ───────────────────────────────────────────────────────────────

/** Map marker for the clearing; `kind` is 'faire', which the integrator adds
 * to POI_DEFINITIONS so world-map/minimap render it. */
export interface FaireMarker extends Omit<WorldPOI, 'kind'> { kind: 'faire' }

export function faireMapMarker(site: FaireSite, now: number): FaireMarker {
  const status = faireStatus(now);
  return { id: site.id, name: `${FAIRE_NAME} — ${site.townName}`, kind: 'faire', x: site.x, y: site.y,
    description: status.active ? `Open now · ${status.days}d ${status.hours}h left` : `Returns in ${status.days}d ${status.hours}h` };
}
