import type { GroundItem } from './character-types.ts';
import type { Player, WorldQuery } from './model.ts';
import { LOOT_RULES } from './combat-content.ts';
import { TREASURE_FLIGHT_DURATION } from './treasure-flight.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { canPackItem } from './inventory-grid.ts';

/** Saved array order is drop order: retain the newest equipment, oldest out first. */
export function addGroundItem(items: GroundItem[], drop: GroundItem): void {
  const overflow = items.length - LOOT_RULES.maxGroundItems + 1;
  if (overflow > 0) items.splice(0, overflow);
  items.push(drop);
}

/**
 * Diablo-style vacuum: landed equipment inside the magnet radius glides toward
 * the player and is collected on contact. `collect` is the simulation's
 * validated award path — this helper only moves drops and reports contact.
 * Items that cannot fit the pack stay put so a full bag never spams notices.
 */
export function advanceGroundLoot(items: GroundItem[], player: Player, world: WorldQuery, time: number,
  dt: number, collect: (index: number) => void, excludeId: number | null = null): void {
  if (player.dead) return;
  for (let i = items.length - 1; i >= 0; i--) {
    const drop = items[i];
    if (drop.flight && time < drop.flight.at + drop.flight.delay + TREASURE_FLIGHT_DURATION) continue;
    if (drop.id === excludeId) continue;
    const dx = player.x - drop.x, dy = player.y - drop.y, distance = Math.hypot(dx, dy);
    if (distance > LOOT_RULES.equipmentMagnetDistance || !canPackItem(player.character, drop.item)) continue;
    if (distance <= LOOT_RULES.equipmentCollectDistance) {
      if (hasLineOfSight(world, drop.x, drop.y, player.x, player.y)) collect(i);
      continue;
    }
    const move = Math.min(distance, (LOOT_RULES.equipmentMagnetSpeed
      + (LOOT_RULES.equipmentMagnetDistance - distance) * 4) * dt);
    if (distance > 0) Object.assign(drop, world.move(drop.x, drop.y, dx / distance * move, dy / distance * move, 2));
  }
}
