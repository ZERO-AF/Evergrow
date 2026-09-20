/** World events (WoW Scourge Invasion): content tables and the seeded schedule.
 * Pure data + deterministic derivation — no live state, no world queries.
 * Runtime/admission lives in world-event-state.ts, rewards in world-event-command.ts,
 * presentation in world-event-art.ts. */
import type { EnemyKind } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import { getZoneAt, scaledEnemyStats, type ZoneProgression } from './zone-progression.ts';
import { siteHash } from './wilderness-sites.ts';
import { BOSS_CHEST_LOOT_TABLES } from './loot-content.ts';
import { generateRewardItem } from './items.ts';
import type { ItemTier } from './character-types.ts';
import { encounterMemberLevel, type EncounterScale } from './encounter-scaling.ts';

export const WORLD_EVENT_RULES = Object.freeze({
  /** Sim-time seconds between invasion starts (the WoW event ran on a timer). */
  interval: 900,
  /** First invasion lands a few minutes into a fresh world. */
  firstAt: 480,
  /** An active invasion despawns when this much sim time passes. */
  duration: 600,
  /** Player must be inside this radius of the necropolis for waves to spawn. */
  engageRadius: 1500,
  /** Guardians leash back to their post past this distance. */
  tetherRadius: 1500,
  /** E-reach for the war chest. */
  reach: 78,
  /** Waves per invasion; each wave grows by `waveGrowth`. */
  waveCount: 4,
  waveSize: 6,
  waveGrowth: 2,
  waveInterval: 3,
  /** Live guardians admitted at once; the rest of the wave waits offscreen. */
  maxConcurrent: 10,
  /** Ring radius around the anchor where the risen dead appear. */
  spawnRingMin: 120,
  spawnRingMax: 300,
  /** Bounded history; unclaimed 'won' records are never evicted. */
  historyLimit: 8,
});

/** Undead roster for the invasion waves — the Scourge reads as revenants,
 * grave-bound stalkers and cult casters, not the biome's usual wildlife. */
export const INVASION_ROSTER: readonly EnemyKind[] = Object.freeze([
  'stalker', 'stalker', 'brute', 'archer', 'caster', 'wisp', 'frostRevenant',
]);

/** The necropolis commander: a Grave Marshal fielded as the zone boss. */
export const INVASION_BOSS = Object.freeze({ kind: 'graveMarshal' as EnemyKind, rank: 'elite' as EnemyRank, name: 'Shadow of Doom' });

/** Every invasion kill credits the Argent Crusade (the Scourge's enemy). */
export const WORLD_EVENT_FACTION = 'argentCrusade' as const;
export const INVASION_NAME = 'Scourge Invasion';
export const WORLD_EVENT_CAMP_PREFIX = 'worldEvent:';
export const worldEventCampId = (eventId: string): string => `${WORLD_EVENT_CAMP_PREFIX}${eventId}`;

/** Stable per-invasion seed; independent of spawn order and traversal. */
export function invasionSeed(worldSeed: number, index: number): number {
  return siteHash(index, 0, worldSeed, 0x1e4f) >>> 0;
}

/** Deterministic zone pick: a ring cell 1–4 regions out, resolved to its district. */
export function invasionZone(worldSeed: number, index: number): ZoneProgression {
  const ring = 1 + siteHash(index, 1, worldSeed, 0x77aa) % 4;
  const angle = (siteHash(index, 2, worldSeed, 0x31c9) / 4294967296) * Math.PI * 2;
  const cx = Math.round(Math.cos(angle) * ring), cy = Math.round(Math.sin(angle) * ring);
  return getZoneAt(cx * 3600, cy * 3600, worldSeed);
}

/** Preferred necropolis point before collision probing: near the zone heart. */
export function invasionAnchorHint(worldSeed: number, index: number, zone: ZoneProgression): { x: number; y: number } {
  const angle = (siteHash(index, 3, worldSeed, 0x9a3c) / 4294967296) * Math.PI * 2;
  const distance = 240 + (siteHash(index, 4, worldSeed, 0x5d11) / 4294967296) * 720;
  return { x: zone.x + Math.cos(angle) * distance, y: zone.y + Math.sin(angle) * distance };
}

/** One guardian slot: wave, roster pick, rank and a stable loot/hp seed. */
export interface InvasionGuardian {
  readonly wave: number;
  readonly kind: EnemyKind;
  readonly rank: EnemyRank;
  readonly seed: number;
  hp: number;
  x: number;
  y: number;
  admitted: boolean;
  dead: boolean;
}

/** The full roster for one invasion; wave 0 is the lightest, the last wave fields elites. */
export function invasionGuardians(seed: number, scale: EncounterScale): InvasionGuardian[] {
  const guardians: InvasionGuardian[] = [];
  for (let wave = 0; wave < WORLD_EVENT_RULES.waveCount; wave++) {
    const size = Math.min(18, WORLD_EVENT_RULES.waveSize + wave * WORLD_EVENT_RULES.waveGrowth);
    for (let i = 0; i < size; i++) {
      const gSeed = siteHash(seed, wave * 32 + i, 0x5eed) >>> 0;
      const final = wave === WORLD_EVENT_RULES.waveCount - 1;
      const rank: EnemyRank = i === 0 ? (final ? 'elite' : 'veteran') : i === 1 && wave >= 2 ? 'veteran' : 'normal';
      const kind = INVASION_ROSTER[(i + wave * 3 + (gSeed % 5)) % INVASION_ROSTER.length]!;
      const level = encounterMemberLevel(scale, rank, gSeed);
      guardians.push({ wave, kind, rank, seed: gSeed, hp: scaledEnemyStats(kind, level, rank).maxHp, x: 0, y: 0, admitted: false, dead: false });
    }
  }
  return guardians;
}

/** Commander stats snapshot for the boss record and the HUD health bar. */
export function invasionBossHp(scale: EncounterScale): number {
  return scaledEnemyStats(INVASION_BOSS.kind, encounterMemberLevel(scale, INVASION_BOSS.rank, 0, true), INVASION_BOSS.rank).maxHp;
}
export const invasionBossLevel = (scale: EncounterScale): number => encounterMemberLevel(scale, INVASION_BOSS.rank, 0, true);

/** Deterministic reward bundle for a repelled invasion; mirrors poi-rewards' seeded rolls. */
export function worldEventRewards(event: { seed: number; level: number }, playerLevel: number) {
  const random = (salt: number) => siteHash(event.seed, salt, 0x37518) / 4294967296;
  const items = Array.from({ length: 3 }, (_, i) => {
    const table = BOSS_CHEST_LOOT_TABLES.raid[i]!;
    let roll = random(10 + i) * 100, tier: ItemTier = 'common';
    for (const [key, weight] of Object.entries(table) as [ItemTier, number][]) {
      roll -= weight;
      if (roll < 0) { tier = key; break; }
    }
    const item = generateRewardItem(siteHash(event.seed, i, 497), tier === 'unique' ? playerLevel : Math.min(1e6, event.level + 1),
      undefined, undefined, tier, undefined, { level: event.level, encounter: 'bossChest' });
    item.id = `worldEvent:${event.seed}:${i}`;
    return item;
  });
  const gold = Math.round((65 + Math.floor(random(80) * 36)) * (1 + .1 * (event.level - 1)));
  const xp = Math.round(scaledEnemyStats('stalker', event.level, 'veteran').xpReward * 4);
  const rep = 250;
  return { items, gold, xp, rep };
}
