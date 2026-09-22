/** World bosses (WoW outdoor raid elites — Kazzak, Azuregos, the green
 * dragons): rare, powerful open-world bosses on long respawn timers. Unlike
 * wilderness boss lairs (permanent cleared-once camps) these are authored
 * encounters that respawn on a real-time-scale cooldown tracked by
 * world-boss-state.ts.
 *
 * Pure data + deterministic derivation — no live state, no world queries.
 * Admission/AI lives in world-boss.ts, the kill ledger in world-boss-state.ts.
 *
 * Boss kinds reuse the wilderness-boss silhouettes, exactly like raid bosses
 * reuse 'ashColossus'/'graveMarshal' (raid-boss-content.ts): the def's `name`
 * is the display identity, `kind` picks the rig and base stats. */
import type { DamageType, EnemyKind } from './model.ts';
import type { MountId } from './mount-content.ts';
import type { CompanionId } from './companion-content.ts';
import { WORLD_TIME } from './world-time.ts';
import { CONTINENTS, ZONES } from './world-atlas.ts';
import { siteHash } from './wilderness-sites.ts';
export type WorldBossId = 'kazzak' | 'azuregos' | 'emeriss' | 'ysondre';

/** One signature move in the boss's committed cycle (world-boss.ts resolves
 * the shared bossMove geometry; the def owns order, school and weight). */
export interface WorldBossAbility {
  readonly move: 'sweep' | 'rush' | 'eruption' | 'fracture' | 'command';
  readonly name: string;
  readonly damageType: DamageType;
  /** Multiplier on the boss's base damage when this move connects. */
  readonly damage: number;
}

/** A rare vanity drop: a flag mount or a companion pet, rolled per kill. */
export type WorldBossRareDrop =
  | { readonly kind: 'mount'; readonly id: MountId }
  | { readonly kind: 'companion'; readonly id: CompanionId };

export interface WorldBossDef {
  readonly id: WorldBossId;
  readonly name: string;
  readonly title: string;
  /** Existing boss rig/stats (the raid-boss convention). */
  readonly kind: EnemyKind;
  /** Authored atlas zone the lair lives in. */
  readonly zoneId: string;
  /** Normalized point inside the zone rect (0..1), like atlas cities. */
  readonly nx: number;
  readonly ny: number;
  /** Fixed encounter level — world bosses are endgame fights. */
  readonly level: number;
  /** Respawn in in-game days (WORLD_TIME.daySeconds each). */
  readonly respawnDays: number;
  /** Warning/blast tint for the fight's telegraphs. */
  readonly palette: string;
  /** Committed move cycle; odd turns interleave a quick jab/bolt. */
  readonly abilities: readonly WorldBossAbility[];
  /** Escort roster; offsets orbit the lair anchor. */
  readonly guards: readonly { kind: EnemyKind; rank: 'normal' | 'veteran' | 'elite'; dx: number; dy: number }[];
  /** Epic-biased ground loot; `rolls` independent draws per kill. */
  readonly loot: { readonly rolls: number; readonly rareChance: number; readonly rare: WorldBossRareDrop };
  readonly description: string;
}

const ability = (move: WorldBossAbility['move'], name: string, damageType: DamageType, damage: number): WorldBossAbility =>
  Object.freeze({ move, name, damageType, damage });

export const WORLD_BOSSES: Readonly<Record<WorldBossId, WorldBossDef>> = Object.freeze({
  kazzak: Object.freeze({
    id: 'kazzak', name: 'Lord Kazzak', title: 'Doomlord of the Blasted Lands',
    kind: 'ashColossus', zoneId: 'blasted-lands', nx: .42, ny: .62, level: 60, respawnDays: 3,
    palette: '#e05a3c',
    abilities: Object.freeze([
      ability('sweep', 'Cleave of the Legion', 'shadow', 1),
      ability('eruption', 'Shadow Bolt Volley', 'shadow', 1.15),
      ability('rush', 'Fel Charge', 'fire', 1.15),
      ability('command', 'Mark of Kazzak', 'shadow', 1),
    ] as const),
    guards: Object.freeze([
      { kind: 'emberAcolyte', rank: 'elite', dx: -140, dy: -90 },
      { kind: 'emberAcolyte', rank: 'elite', dx: 140, dy: -90 },
      { kind: 'brute', rank: 'veteran', dx: -90, dy: 120 },
      { kind: 'brute', rank: 'veteran', dx: 90, dy: 120 },
    ] as const),
    loot: Object.freeze({ rolls: 4, rareChance: .05, rare: Object.freeze({ kind: 'companion', id: 'phoenix' }) }),
    description: 'A doomlord of the Burning Legion holds the Tainted Scar. His shadow volleys and fel charge have ended every raid that found him sleeping.',
  }),
  azuregos: Object.freeze({
    id: 'azuregos', name: 'Azuregos', title: 'The Blue Dragon of Azshara',
    kind: 'warden', zoneId: 'azshara', nx: .55, ny: .72, level: 60, respawnDays: 4,
    palette: '#7ec8f2',
    abilities: Object.freeze([
      ability('sweep', 'Tail Sweep', 'physical', 1),
      ability('fracture', 'Frost Breath', 'frost', 1.15),
      ability('eruption', 'Arcane Eruption', 'arcane', 1.15),
    ] as const),
    guards: Object.freeze([
      { kind: 'stormSentinel', rank: 'elite', dx: -150, dy: -80 },
      { kind: 'stormSentinel', rank: 'elite', dx: 150, dy: -80 },
      { kind: 'wisp', rank: 'veteran', dx: 0, dy: 150 },
    ] as const),
    loot: Object.freeze({ rolls: 4, rareChance: .05, rare: Object.freeze({ kind: 'mount', id: 'drake' }) }),
    description: 'The blue dragon Azuregos lounges among the naga ruins of Azshara, hoarding arcane relics and a legendary sense of humor.',
  }),
  emeriss: Object.freeze({
    id: 'emeriss', name: 'Emeriss', title: 'Nightmare of Duskwood',
    kind: 'graveMarshal', zoneId: 'duskwood', nx: .5, ny: .5, level: 60, respawnDays: 3,
    palette: '#8fd6a0',
    abilities: Object.freeze([
      ability('sweep', 'Corrupted Sweep', 'nature', 1),
      ability('rush', 'Nightmare Charge', 'nature', 1.15),
      ability('eruption', 'Noxious Breath', 'nature', 1.15),
      ability('command', 'Call of the Nightmare', 'nature', 1),
    ] as const),
    guards: Object.freeze([
      { kind: 'thornReaver', rank: 'elite', dx: -130, dy: -85 },
      { kind: 'thornReaver', rank: 'elite', dx: 130, dy: -85 },
      { kind: 'stalker', rank: 'veteran', dx: -70, dy: 130 },
      { kind: 'stalker', rank: 'veteran', dx: 70, dy: 130 },
    ] as const),
    loot: Object.freeze({ rolls: 4, rareChance: .05, rare: Object.freeze({ kind: 'companion', id: 'sprite-darter' }) }),
    description: 'A green dragon twisted by the Nightmare circles the Twilight Grove in Duskwood, breathing corruption over the dream portal.',
  }),
  ysondre: Object.freeze({
    id: 'ysondre', name: 'Ysondre', title: 'Nightmare of the Hinterlands',
    kind: 'briarMatriarch', zoneId: 'hinterlands', nx: .62, ny: .38, level: 60, respawnDays: 5,
    palette: '#a8e05a',
    abilities: Object.freeze([
      ability('sweep', 'Wing Buffet', 'physical', 1),
      ability('fracture', 'Lightning Breath', 'lightning', 1.15),
      ability('rush', 'Dreamfury Dive', 'nature', 1.15),
    ] as const),
    guards: Object.freeze([
      { kind: 'hound', rank: 'elite', dx: -120, dy: -70 },
      { kind: 'hound', rank: 'elite', dx: 120, dy: -70 },
      { kind: 'archer', rank: 'veteran', dx: 0, dy: 140 },
    ] as const),
    loot: Object.freeze({ rolls: 4, rareChance: .05, rare: Object.freeze({ kind: 'mount', id: 'raptor' }) }),
    description: 'Ysondre haunts Seradane in the Hinterlands, the last of the nightmare-corrupted green flight to hold a fixed roost.',
  }),
});

export const WORLD_BOSS_IDS: readonly WorldBossId[] = Object.freeze(Object.keys(WORLD_BOSSES) as WorldBossId[]);
export function isWorldBossId(v: unknown): v is WorldBossId {
  return typeof v === 'string' && Object.hasOwn(WORLD_BOSSES, v);
}

export const WORLD_BOSS_RULES = Object.freeze({
  /** Player must be inside this radius of the lair for the boss to materialize. */
  activationDistance: 1400,
  /** Boss leash: past this from the anchor it disengages and walks home. */
  leash: 900,
  /** Awareness radius once the player closes in. */
  awareness: 460,
  /** Epic-biased tier weights for every world boss kill roll. */
  tierWeights: Object.freeze({ common: 0, magic: 0, rare: 30, epic: 62, legendary: 6, unique: 2 }),
});

/** Sim-time respawn window for a boss (in-game days → seconds). */
export function worldBossRespawnMs(def: WorldBossDef): number {
  return def.respawnDays * WORLD_TIME.daySeconds;
}

/** Live-actor identity: the boss and its guards share one camp id. The
 * `event:` prefix keeps CampPopulation from adopting them into a cleared-once
 * camp record — world bosses own their own respawn ledger. */
export const worldBossCampId = (id: WorldBossId): string => `event:world-boss:${id}`;
export const WORLD_BOSS_MEMBER_ID = 'boss';
export const worldBossGuardId = (index: number): string => `guard:${index}`;

/** Reverse lookup for live actors; null for ordinary enemies. */
export function worldBossByCampId(campId: string | undefined): WorldBossDef | null {
  if (!campId?.startsWith('event:world-boss:')) return null;
  const id = campId.slice('event:world-boss:'.length);
  return isWorldBossId(id) ? WORLD_BOSSES[id] : null;
}

/** Display name for a live actor: the boss takes its def name, guards fall
 * through to the normal zone-roster naming. */
export function worldBossName(e: { campId?: string; campMemberId?: string }): string | undefined {
  const def = worldBossByCampId(e.campId);
  return def && e.campMemberId === WORLD_BOSS_MEMBER_ID ? def.name : undefined;
}

/** The def's preferred lair anchor in world coordinates (zone rect + nx/ny). */
export function worldBossAnchor(def: WorldBossDef): { x: number; y: number } | null {
  const zone = ZONES[def.zoneId];
  if (!zone) return null;
  const origin = CONTINENTS[zone.continent].origin;
  return { x: origin.x + zone.rect.x + zone.rect.w * def.nx, y: origin.y + zone.rect.y + zone.rect.h * def.ny };
}

/** Stable per-boss loot seed; independent of spawn order and traversal. */
export function worldBossLootSeed(worldSeed: number, id: WorldBossId): number {
  return siteHash(worldSeed, WORLD_BOSS_IDS.indexOf(id), 0x9e3779b9) >>> 0;
}

/** Deterministic rare-drop roll for one kill: same boss + kill timestamp
 * always yields the same answer, so a replayed checkpoint cannot re-roll. */
export function worldBossRareRoll(def: WorldBossDef, killedAt: number): boolean {
  const seed = siteHash(Math.floor(killedAt * 1000), 0, worldBossLootSeed(0, def.id) ^ 0x5f3759df, 0x7a11) >>> 0;
  return seed / 4294967296 < def.loot.rareChance;
}
