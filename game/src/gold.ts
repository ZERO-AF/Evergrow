import { TREASURE_FLIGHT_DURATION } from './treasure-flight.ts';
import type { EnemyRank } from './progression-content.ts';
import type { CombatEvent, Player, WorldQuery } from './model.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { creditGold, goldBalance } from './wallet.ts';
import { randomSource } from './random-source.ts';

export interface GroundGold { flight?: import('./treasure-flight.ts').TreasureFlight; id: number; x: number; y: number; amount: number; age: number; }
export const GOLD_RULES = { maxPiles: 128, magnetRadius: 100, collectRadius: 15, settleTime: .3 } as const;
const TABLE: Record<EnemyRank, { chance: number; min: number; max: number }> = {
  normal: { chance: .55, min: 4, max: 8 }, veteran: { chance: .85, min: 10, max: 20 },
  elite: { chance: 1, min: 45, max: 80 }, rare: { chance: 1, min: 70, max: 120 },
};
/** Independent seed stream: currency tuning cannot change equipment rolls or encounter RNG. */
export function rollEnemyGold(seed: number, level: number, rank: EnemyRank): number {
  const random = randomSource(seed ^ 0x67a19f35);
  const row = TABLE[rank];
  if (random() >= row.chance) return 0;
  // Copper economy (1g = 10_000c): level^1.5 growth lands a level-80 normal at
  // ~30-60s and an elite at ~3-6g, keeping WotLK-nominal sinks reachable.
  return Math.round((row.min + Math.floor(random() * (row.max - row.min + 1)))
    * Math.pow(Math.max(1, Math.min(1_000_000, level)), 1.5));
}
export function dropGold(piles: GroundGold[], drop: GroundGold): void {
  if (piles.length < GOLD_RULES.maxPiles) { piles.push(drop); return; }
  // Preserve value at the capacity limit; no timer silently deletes uncollected currency.
  const nearest = piles.reduce((a, b) => Math.hypot(a.x - drop.x, a.y - drop.y)
    < Math.hypot(b.x - drop.x, b.y - drop.y) ? a : b);
  if (Number.isSafeInteger(nearest.amount + drop.amount)) nearest.amount += drop.amount;
}
export function advanceGold(piles: GroundGold[], player: Player, world: WorldQuery, dt: number,
  emit: (event: CombatEvent) => void): GroundGold[] {
  return piles.filter(pile => {
    pile.age = Math.min(10, pile.age + dt);
    if (player.dead || pile.age < (pile.flight ? TREASURE_FLIGHT_DURATION + pile.flight.delay : GOLD_RULES.settleTime)) return true;
    const dx = player.x - pile.x, dy = player.y - pile.y, distance = Math.hypot(dx, dy);
    if (distance > GOLD_RULES.magnetRadius || !hasLineOfSight(world, pile.x, pile.y, player.x, player.y)) return true;
    if (distance <= GOLD_RULES.collectRadius && creditGold(player.character, pile.amount)) {
      emit({ type: 'gold', x: pile.x, y: pile.y, amount: pile.amount, balance: goldBalance(player.character) });
      return false;
    }
    const move = Math.min(distance, (120 + (GOLD_RULES.magnetRadius - distance) * 4) * dt);
    if (distance > 0) Object.assign(pile, world.move(pile.x, pile.y, dx / distance * move, dy / distance * move, 2));
    return true;
  });
}
