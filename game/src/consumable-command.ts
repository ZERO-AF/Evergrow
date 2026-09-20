/** Consumable use (docs/wow-deepening.md): one charge from a pack stack applies the
 * consumable's effect. Buff categories carry exclusiveGroup `consumable:<category>`,
 * so WoW's one-flask / one-food / one-battle-elixir / one-guardian-elixir rule is
 * enforced by replacing the same-category buff; potions share a short cooldown.
 * Synchronous like equipItem — the caller's saveCharacter/autosave persists the
 * inventory stack and the buff list (both live on the checkpoint). */
import type { ActionResult } from './character-types.ts';
import type { Player } from './model.ts';
import { refreshBuffStats, restoreFormResource } from './player-skill-effects.ts';
import {
  CONSUMABLES, consumableBuffGroup, consumableFor, type ConsumableDef,
} from './consumable-content.ts';

const success = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });

/** Remaining shared consumable cooldown in seconds (real-time, like a potion sip). */
export function consumableCooldown(p: Player, now = 0): number {
  return Math.max(0, (p.consumableCooldownUntil ?? 0) - now);
}

/** Push the consumable's buff, replacing any active buff in its category. Mirrors
 * Simulation.addBuff's player-side record so headless callers get the same shape. */
function applyConsumableBuff(p: Player, def: ConsumableDef): void {
  const spec = def.buff!, group = consumableBuffGroup(def.buffCategory);
  const buffs = p.buffs ??= [];
  for (let i = buffs.length - 1; i >= 0; i--) if (buffs[i]!.exclusiveGroup === group) {
    restoreFormResource(p, buffs[i]!);
    buffs.splice(i, 1);
  }
  const id = `consumable:${def.id}`, duration = spec.duration;
  const existing = buffs.find(buff => buff.id === id);
  if (existing) { existing.remaining = Math.max(existing.remaining, duration); return; }
  buffs.push({ id, name: def.buffName ?? def.name, color: def.color, remaining: duration, duration,
    stats: spec.stats, absorb: spec.absorb, absorbRemaining: spec.absorb ? p.maxHp * spec.absorb : undefined,
    reduction: spec.reduction, healPerSecond: spec.healPerSecond, manaPerSecond: spec.manaPerSecond,
    resourcePerSecond: spec.resourcePerSecond, exclusiveGroup: group, form: spec.form,
    stealth: spec.stealth, reflect: spec.reflect, imbue: spec.imbue, petShare: spec.petShare,
    immunity: spec.immunity, leech: spec.leech, breakControl: spec.breakControl, allyDamage: spec.allyDamage });
  if (spec.stealth) p.stealthed = true;
  if (spec.breakControl) { p.cc = undefined; p.ccImmunity = Math.max(p.ccImmunity ?? 0, spec.duration); }
}

/** Consume one charge of the inventory stack at `index` and apply its effect. */
export function useConsumable(player: Player, index: number, now = 0): ActionResult {
  const inventory = player.character.inventory;
  if (!Number.isInteger(index) || index < 0 || index >= inventory.length) return fail('Choose an item in your pack.');
  const item = inventory[index];
  if (!item) return fail('That inventory cell is empty.');
  const def = consumableFor(item);
  if (!def) return fail('That item cannot be used.');
  if (player.dead) return fail('You are dead.');
  if (player.level < item.requiredLevel) return fail(`Requires level ${item.requiredLevel}.`);
  if (def.buffCategory === 'potion') {
    const cooldown = consumableCooldown(player, now);
    if (cooldown > 0) return fail(`${def.name} is not ready yet (${cooldown.toFixed(1)}s).`);
  }
  if (def.buff) {
    const same = (player.buffs ?? []).find(b => b.id === `consumable:${def.id}`);
    if (same && same.remaining >= same.duration) return fail(`${def.name} is already active.`);
  }
  const stack = item.stack ?? 1;
  if (stack <= 1) {
    inventory[index] = null;
    delete player.character.inventoryLayout?.[item.id];
  } else item.stack = stack - 1;
  if (def.healFraction) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * def.healFraction * player.derived.potionMultiplier);
  if (def.manaFraction) player.mana = Math.min(player.maxMana, player.mana + player.maxMana * def.manaFraction * player.derived.potionMultiplier);
  if (def.buff) applyConsumableBuff(player, def);
  if (def.buffCategory === 'potion') player.consumableCooldownUntil = now + def.cooldown * player.derived.cooldownMultiplier;
  refreshBuffStats(player);
  return success(def.useText);
}

/** Use the first pack stack of `consumableId` — the hotbar path resolves by definition. */
export function useConsumableId(player: Player, consumableId: string, now = 0): ActionResult {
  const def = CONSUMABLES[consumableId];
  if (!def) return fail('Unknown consumable.');
  const index = player.character.inventory.findIndex(item => consumableFor(item)?.id === consumableId);
  if (index < 0) return fail(`No ${def.name} left.`);
  return useConsumable(player, index, now);
}
