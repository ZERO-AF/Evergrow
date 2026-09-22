import { sampleBiome, type BiomeId } from './biomes.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { Input, Player, WorldQuery } from './model.ts';
import { hashService } from './npcs.ts';
import { interruptTrial } from './poi-content.ts';
import type { Simulation } from './simulation.ts';
import type { Building } from './settlements.ts';
import { guildHearthstoneChannelFactor } from './guild-state.ts';
import { portalLanding } from './travel.ts';

/** WoW hearthstone: a long interruptible cast that returns the player to their bound inn. */
export const HEARTHSTONE_RULES = Object.freeze({ channel: 10, reach: 70 });

/** Classic/WotLK zone names mapped onto our biomes (real WoW content per docs/wow-deepening.md scope). */
export const WOW_ZONE_NAMES: Readonly<Record<BiomeId, string>> = Object.freeze({
  verdant: 'Elwynn Forest', steppe: 'The Barrens', sunscar: 'Durotar', deadwood: 'Duskwood',
  swamp: 'Swamp of Sorrows', frostpine: 'Winterspring', emberfall: 'Burning Steppes',
  autumn: 'Azshara', highlands: 'Arathi Highlands',
});


/** Real WoW towns per biome (Goldshire · Elwynn, Razor Hill · Durotar, Crossroads · The Barrens…). */
export const WOW_TOWN_NAMES: Readonly<Record<BiomeId, string>> = Object.freeze({
  verdant: 'Goldshire', steppe: 'Crossroads', sunscar: 'Razor Hill', deadwood: 'Darkshire',
  swamp: 'Stonard', frostpine: 'Everlook', emberfall: 'Kargath', autumn: 'Valormok', highlands: 'Hammerfall',
});
/** Real WoW innkeepers (Farley · Lion's Pride Inn, Allison · The Gilded Rose, Gryshka · Orgrimmar…). */
const INNKEEPER_NAMES = ['Farley', 'Allison', 'Heather', 'Brianna', 'Anderson', 'Saelienne', 'Norman', 'Gryshka'] as const;

export interface HearthstoneTarget { x: number; y: number; zone: string }

/** Innkeepers are the bind point for the hearthstone; they stand inside 'inn' buildings like service NPCs. */
export interface Innkeeper {
  readonly id: string;
  readonly name: string;
  /** Owning inn's display name ("The Lantern Inn"). */
  readonly inn: string;
  readonly buildingId: string;
  readonly x: number;
  readonly y: number;
}

export function innkeeperFor(building: Building): Innkeeper | null {
  if (building.kind !== 'inn') return null;
  const id = `${building.id}:innkeeper`, seed = hashService(id);
  return { id, buildingId: building.id, inn: building.name,
    x: building.door.x, y: building.door.y + (building.form === 'stall' ? 22 : -57),
    name: INNKEEPER_NAMES[seed % INNKEEPER_NAMES.length] };
}

export function innkeepersNear(world: WorldQuery, x: number, y: number, width: number, height: number): Innkeeper[] {
  return (world.getBuildings?.(x, y, width, height) ?? [])
    .map(innkeeperFor).filter((innkeeper): innkeeper is Innkeeper => innkeeper !== null);
}

export function canBindAt(innkeeper: Innkeeper, player: { x: number; y: number; dead?: boolean }, world: WorldQuery): boolean {
  return !player.dead && !world.blocked(innkeeper.x, innkeeper.y, 0) && !world.blocked(player.x, player.y, 0)
    && Math.hypot(player.x - innkeeper.x, player.y - innkeeper.y) <= HEARTHSTONE_RULES.reach
    && hasLineOfSight(world, player.x, player.y, innkeeper.x, innkeeper.y);
}

export function focusedInnkeeper(innkeepers: readonly Innkeeper[], player: { x: number; y: number; dead?: boolean }, world: WorldQuery,
  pointer?: { x: number; y: number }): Innkeeper | null {
  return innkeepers.filter(innkeeper => canBindAt(innkeeper, player, world) && (!pointer || Math.hypot(pointer.x - innkeeper.x, pointer.y - (innkeeper.y - 17)) <= 28))
    .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0] ?? null;
}

/** Bound inn wins; an unbound hearthstone falls back to the home-town anchor. */
export function hearthstoneDestination(player: Player, home: HearthstoneTarget): HearthstoneTarget {
  return player.hearthstone ?? home;
}

/** Unlike the town portal, the hearthstone also works inside sanctuaries and dungeons. */
export function hearthstoneProblem(player: Player, world: WorldQuery): string | null {
  if (player.dead) return 'You cannot use a hearthstone while defeated.';
  if (world.blocked(player.x, player.y, player.radius)) return 'No room to use a hearthstone here.';
  if (player.attack || player.castTime > 0 || player.dash || player.dodgeTime > 0 || Math.hypot(player.vx, player.vy) > 1)
    return 'Stand still to use your hearthstone.';
  return null;
}

/** Fixed-step channel mirroring PortalChannel; damage cancels at the contact boundary via Simulation.takeDamage. */
export class HearthstoneChannel {
  origin: { x: number; y: number } | null = null;
  elapsed = 0;
  /** Cast length snapshotted at start (Hasty Hearth halves it). */
  private duration: number = HEARTHSTONE_RULES.channel;
  get active() { return this.origin !== null; }
  get ready() { return this.active && this.elapsed + 1e-9 >= this.duration; }
  get progress() { return Math.min(1, this.elapsed / this.duration); }
  start(player: Player, world: WorldQuery): string | null {
    if (this.active) { this.cancel(); return null; }
    const problem = hearthstoneProblem(player, world); if (problem) return problem;
    this.duration = HEARTHSTONE_RULES.channel * guildHearthstoneChannelFactor(player);
    this.origin = { x: player.x, y: player.y }; this.elapsed = 0; return null;
  }
  cancel() { this.origin = null; this.elapsed = 0; this.duration = HEARTHSTONE_RULES.channel; }
  advance(dt: number, player: Player, input: Input): void {
    if (!this.origin) return;
    if (player.dead || input.moveX || input.moveY || input.attack || input.dodge || input.skillSlot !== null
      || player.attack || player.dash || player.castTime > 0 || player.dodgeTime > 0
      || Math.hypot(player.x - this.origin.x, player.y - this.origin.y) > .5) { this.cancel(); return; }
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
  }
}

/** Simulation once the integrator adds `readonly hearthstone = new HearthstoneChannel()`. */
export type HearthstoneHost = Simulation & { readonly hearthstone: HearthstoneChannel };

/** H key edge: cancel competing channels, then start the 10s cast. Returns a problem to notify, or null. */
export function hearthstoneCast(sim: HearthstoneHost): string | null {
  sim.eventChannel.cancel();
  sim.portal.cancel();
  sim.clearCombatInput();
  return sim.hearthstone.start(sim.player, sim.world);
}

type Result = { ok: boolean; message: string };
type Persist = (checkpoint: CharacterCheckpoint) => Result | Promise<Result>;
type CheckpointWithHearth = CharacterCheckpoint & { hearthstone?: Player['hearthstone'] };

/** Default hearthstone destination: the home-town portal anchor, labelled with its real WoW town. */
export function hearthstoneHome(sim: Simulation, anchor: { x: number; y: number; name: string }): HearthstoneTarget {
  const biome = (sim.world.sampleBiome?.(anchor.x, anchor.y) ?? sampleBiome(anchor.x, anchor.y, sim.world.seed)).id;
  return { x: anchor.x, y: anchor.y + 35, zone: WOW_TOWN_NAMES[biome] };
}

/** Channel complete: stage the bound-inn relocation in one checkpoint, then publish after durable storage. */
export async function executeHearthstone(sim: HearthstoneHost, home: HearthstoneTarget, persist: Persist): Promise<Result> {
  const p = sim.player;
  if (!sim.hearthstone.ready) return { ok: false, message: 'The hearthstone is not ready.' };
  const problem = hearthstoneProblem(p, sim.world);
  if (problem) { sim.hearthstone.cancel(); return { ok: false, message: problem }; }
  const destination = hearthstoneDestination(p, home);
  const point = portalLanding(sim.world, destination, p.radius);
  if (!point) { sim.hearthstone.cancel(); return { ok: false, message: 'Your hearthstone destination is blocked.' }; }
  const checkpoint: CheckpointWithHearth = sim.captureCheckpoint();
  interruptTrial(checkpoint.events!, checkpoint.actors ?? []);
  checkpoint.x = point.x; checkpoint.y = point.y;
  const result = await persist(checkpoint);
  if (!result.ok) { sim.hearthstone.cancel(); return result; }
  interruptTrial(sim.eventState, sim.enemies);
  sim.hearthstone.cancel();
  sim.relocate(point.x, point.y);
  return { ok: true, message: destination.zone };
}

/** Innkeeper interact: bind the hearthstone to this inn through the durable checkpoint path. */
export async function bindInteract(sim: HearthstoneHost, innkeeper: Innkeeper, persist: Persist): Promise<Result> {
  const p = sim.player;
  if (!canBindAt(innkeeper, p, sim.world)) return { ok: false, message: 'The innkeeper is no longer in reach.' };
  const bound: HearthstoneTarget = { x: innkeeper.x, y: innkeeper.y + 35,
    zone: WOW_ZONE_NAMES[(sim.world.sampleBiome?.(innkeeper.x, innkeeper.y) ?? sampleBiome(innkeeper.x, innkeeper.y, sim.world.seed)).id] };
  if (p.hearthstone && Math.hypot(p.hearthstone.x - bound.x, p.hearthstone.y - bound.y) < 1)
    return { ok: true, message: `${innkeeper.inn} is already your home.` };
  const checkpoint: CheckpointWithHearth = sim.captureCheckpoint();
  checkpoint.hearthstone = bound;
  const result = await persist(checkpoint);
  if (result.ok) p.hearthstone = checkpoint.hearthstone;
  return result.ok ? { ok: true, message: `${innkeeper.inn} is now your home.` } : result;
}
