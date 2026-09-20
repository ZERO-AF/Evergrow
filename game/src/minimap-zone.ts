import { getZoneAt } from './zone-progression.ts';
import { regionLevelLabel } from './encounter-scaling.ts';
import { AreaNoticeTracker } from './notification-queue.ts';
import { hashService } from './npcs.ts';
import { text, textWidth } from './font.ts';
import { UI_THEME } from './ui-theme.ts';
import type { BiomeId } from './biomes.ts';

const palette = UI_THEME.palette;

/** WotLK zone identity per biome (docs/wow-deepening.md §9; real zone names per scope). */
export const BIOME_WOW_ZONES: Readonly<Record<BiomeId, string>> = Object.freeze({
  deadwood: 'Duskwood',
  verdant: 'Elwynn Forest',
  swamp: 'Swamp of Sorrows',
  frostpine: 'Winterspring',
  emberfall: 'Burning Steppes',
  autumn: 'Azshara',
  highlands: 'Arathi Highlands',
  steppe: 'The Barrens',
  sunscar: 'Tanaris',
});
export function wowZoneName(biome: BiomeId): string { return BIOME_WOW_ZONES[biome] ?? biome; }

/** Real WotLK settlements per generated settlement tier; the pick is stable per town seed. */
export const WOW_TOWN_NAMES = Object.freeze({
  settlement: Object.freeze(['Camp Taurajo', 'Camp Narache', 'Camp Mojache', 'Freewind Post', 'Splintertree Post',
    'Sun Rock Retreat', 'Thorium Point', 'Flame Crest', 'Chillwind Camp', 'The Bulwark', "Marshal's Refuge",
    'Nesingwary Base Camp', "River's Heart", "Light's Breach", "Zim'Torga", 'The Argent Stand', 'K3',
    "Bouldercrag's Refuge", "Camp Tunka'lo", 'Grom\'arsh Crash Site', 'Camp Oneqwah', 'Conquest Hold',
    "Agmar's Hammer", 'Venomspite']),
  village: Object.freeze(['Goldshire', 'Kharanos', 'Dolanaar', 'Bloodhoof Village', 'Razor Hill', 'Brill',
    'Sentinel Hill', 'The Crossroads', 'Astranaar', 'Auberdine', 'Darkshire', 'Lakeshire', 'Southshore',
    'Tarren Mill', 'Refuge Pointe', 'Hammerfall', 'Stonard', "Grom'gol Base Camp", 'Booty Bay', 'Ratchet',
    "Nijel's Point", 'Feathermoon Stronghold', 'Nighthaven', 'Everlook', 'Revantusk Village', 'Aerie Peak',
    'Gadgetzan', 'Mudsprocket', 'Fizzcrank Airstrip', 'Amberpine Lodge', 'Westguard Keep', 'Valgarde',
    'Fort Wildervar', 'Wintergarde Keep', "Stars' Rest", 'Fordragon Hold', 'Frosthold', 'Dun Niffelem']),
  city: Object.freeze(['Stormwind City', 'Ironforge', 'Darnassus', 'The Exodar', 'Orgrimmar', 'Thunder Bluff',
    'Undercity', 'Silvermoon City', 'Shattrath City', 'Dalaran']),
} as const);

/** Real WotLK inn names; every generated inn adopts one by seed. */
export const WOW_INN_NAMES: readonly string[] = Object.freeze([
  "Lion's Pride Inn", "Gallows' End Tavern", 'The Scarlet Raven Tavern', 'The Salty Sailor Tavern',
  'The Blue Recluse', 'Pig and Whistle Tavern', 'The Slaughtered Lamb', 'The Filthy Animal',
  "A Hero's Welcome", 'The Ledgerdemain Lounge', 'The Laughing Yeti', 'The Broken Keel Tavern',
  'Deepwater Tavern', 'The Seaspray Inn', 'The Golden Keg', 'The Drunken Hozen',
]);

const pick = (list: readonly string[], seed: number | undefined, id: string): string =>
  list[(seed ?? hashService(id)) % list.length];

/** WoW town name for a generated settlement; falls back to the generated name when unknown. */
export function wowTownName(town: { id: string; name: string; kind?: string; seed?: number }): string {
  const tier = town.kind === 'city' ? 'city' : town.kind === 'settlement' ? 'settlement' : 'village';
  return pick(WOW_TOWN_NAMES[tier], town.seed, town.id);
}

/** WoW inn name for a generated inn building; other buildings keep their generated name. */
export function wowBuildingName(building: { id?: string; name?: string; kind?: string; seed?: number }): string | undefined {
  if (!building.name) return undefined;
  if (building.kind === 'inn') return pick(WOW_INN_NAMES, building.seed, building.id ?? building.name);
  return building.name;
}

/** Minimal world surface the banner needs; the live `World` satisfies it. */
export interface ZoneBannerWorld {
  readonly seed: number;
  sampleBiome(x: number, y: number): { id: BiomeId; name: string };
  isSanctuary?(x: number, y: number): boolean;
  getBuildingAt?(x: number, y: number): { id?: string; name?: string; kind?: string; seed?: number } | null;
  getSettlements?(x: number, y: number, width: number, height: number): readonly { id: string; name: string; kind?: string; seed?: number; x: number; y: number; radius: number }[];
}

export interface ZoneBannerInfo {
  /** Stable identity for change detection and notice hysteresis. */
  key: string;
  title: string;
  subtitle: string;
  sanctuary: boolean;
}

/** WoW-style area identity: building → town → zone, most specific first. */
export function zoneBannerInfo(world: ZoneBannerWorld, x: number, y: number): ZoneBannerInfo {
  const zone = getZoneAt(x, y, world.seed);
  const biome = world.sampleBiome(x, y);
  const wow = wowZoneName(biome.id);
  if (world.isSanctuary?.(x, y)) {
    const towns = (world.getSettlements?.(x, y, .01, .01) ?? [])
      .filter(town => Math.hypot(x - town.x, y - town.y) < town.radius)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    const town = towns[0], townName = town ? wowTownName(town) : null;
    const building = world.getBuildingAt?.(x, y), buildingName = building ? wowBuildingName(building) : undefined;
    if (buildingName) return { key: `building:${building!.id ?? buildingName}`, title: buildingName,
      subtitle: townName ? `${townName} · Sanctuary` : 'Sanctuary', sanctuary: true };
    if (townName) return { key: `town:${town!.id}`, title: townName, subtitle: `${wow} · Sanctuary`, sanctuary: true };
    return { key: 'sanctuary', title: 'Sanctuary', subtitle: wow, sanctuary: true };
  }
  return { key: `zone:${zone.id}:${biome.id}`, title: wow,
    subtitle: `${zone.districtName} · ${regionLevelLabel(zone)}`, sanctuary: false };
}

export const ZONE_BANNER_TIMING = Object.freeze({ fadeIn: .8, hold: 2.4, fadeOut: 1.2 });
const BANNER_DURATION = ZONE_BANNER_TIMING.fadeIn + ZONE_BANNER_TIMING.hold + ZONE_BANNER_TIMING.fadeOut;

/** Center-screen zone name banner; fires when the area identity changes (fade in/out). */
export class ZoneBanner {
  private tracker = new AreaNoticeTracker();
  private active: (ZoneBannerInfo & { age: number }) | null = null;
  get current(): ZoneBannerInfo | null { return this.active; }

  /** Seed the tracker after teleport/character load so the current area does not re-announce. */
  reset(world: ZoneBannerWorld, x: number, y: number): void {
    this.tracker.reset(zoneBannerInfo(world, x, y).key);
    this.active = null;
  }

  /** Call each frame with the interpolated player position; `dt` in seconds.
   * Returns the info the frame a new banner fires (for chat/system feeds), else null. */
  update(world: ZoneBannerWorld, x: number, y: number, dt: number): ZoneBannerInfo | null {
    const info = zoneBannerInfo(world, x, y);
    let fired: ZoneBannerInfo | null = null;
    if (this.tracker.update(info.key, dt)) { this.active = { ...info, age: 0 }; fired = info; }
    if (this.active) {
      this.active.age += Math.max(0, Number.isFinite(dt) ? dt : 0);
      if (this.active.age >= BANNER_DURATION) this.active = null;
    }
    return fired;
  }

  draw(c: CanvasRenderingContext2D, width: number, height: number, reducedMotion = false): void {
    const banner = this.active;
    if (!banner) return;
    const { fadeIn, fadeOut } = ZONE_BANNER_TIMING;
    const fade = Math.min(1, banner.age / fadeIn) * Math.min(1, (BANNER_DURATION - banner.age) / fadeOut);
    if (fade <= 0) return;
    const cx = width / 2, cy = Math.max(92, height * .15);
    const rise = reducedMotion ? 0 : 10 * Math.exp(-banner.age * 3.2);
    c.save();
    c.globalAlpha = fade;
    c.translate(cx, cy + rise);
    const halo = c.createRadialGradient(0, 0, 1, 0, 0, 200);
    halo.addColorStop(0, '#0a111bb8'); halo.addColorStop(1, '#0a111b00');
    c.fillStyle = halo; c.fillRect(-210, -44, 420, 100);
    const titleSize = Math.min(2.3, 2.3 * (width * .58) / Math.max(1, textWidth(banner.title, 2.3)));
    const color = banner.sanctuary ? palette.jade : palette.ivory;
    const half = Math.min(width * .28, textWidth(banner.title, titleSize) / 2 + 34);
    c.strokeStyle = `${palette.brass}cc`; c.lineWidth = .8;
    c.beginPath(); c.moveTo(-half - 66, -6); c.lineTo(-half - 8, -6);
    c.moveTo(half + 8, -6); c.lineTo(half + 66, -6); c.stroke();
    c.fillStyle = `${palette.brass}cc`;
    c.beginPath(); c.arc(-half - 2, -6, 1.4, 0, Math.PI * 2); c.arc(half + 2, -6, 1.4, 0, Math.PI * 2); c.fill();
    text(c, banner.title, 0, -22, titleSize, color, 'center');
    if (banner.subtitle) text(c, banner.subtitle, 0, 16, .95, palette.muted, 'center');
    c.restore();
  }
}
