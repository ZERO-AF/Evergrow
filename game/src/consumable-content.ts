/** WotLK consumables (docs/wow-deepening.md): flasks, Well Fed food, battle/guardian
 * elixirs and potions as real stackable pack items (kind 'consumable'). The
 * definition id is encoded in the item id as `consumable:<defId>:<seed36>` — the
 * same convention bag-content.ts uses for 'cloak' — so the frozen save contract
 * needs no recipe field. Buffs ride the WowBuff pipeline; the buffCategory owns
 * the exclusiveGroup (`consumable:<category>`) so WoW's one-flask / one-food /
 * one-battle-elixir / one-guardian-elixir rule is enforced by buff replacement. */
import type { CharacterSheet, Item } from './character-types.ts';
import type { WowBuff } from './model.ts';
import type { BuffSpec } from './wow-types.ts';

export type ConsumableCategory = 'flask' | 'food' | 'battleElixir' | 'guardianElixir' | 'potion';
export const CONSUMABLE_CATEGORIES: readonly ConsumableCategory[] = Object.freeze(['flask', 'food', 'battleElixir', 'guardianElixir', 'potion']);
export const CONSUMABLE_CATEGORY_LABELS: Readonly<Record<ConsumableCategory, string>> = Object.freeze({
  flask: 'Flask', food: 'Food', battleElixir: 'Battle Elixir', guardianElixir: 'Guardian Elixir', potion: 'Potion',
});
/** WoW stacking rule: one active buff per category; a new use replaces it. */
export const consumableBuffGroup = (category: ConsumableCategory): string => `consumable:${category}`;
export const CONSUMABLE_STACK_MAX = 20;
export const CONSUMABLE_ITEM_PREFIX = 'consumable:';

export interface ConsumableDef {
  readonly id: string;
  readonly name: string;
  readonly kind: 'consumable';
  readonly buffCategory: ConsumableCategory;
  /** Timed buff applied on use; potions with instant effects leave it absent. */
  readonly buff?: BuffSpec;
  /** Seconds the effect lasts (mirrors buff.duration; 0 for instant potions). */
  readonly duration: number;
  /** Instant restoration as a fraction of max life / max mana (potions). */
  readonly healFraction?: number;
  readonly manaFraction?: number;
  /** Shared potion cooldown in seconds; buff consumables use a 1s sip. */
  readonly cooldown: number;
  readonly stackSize: number;
  readonly itemLevel: number;
  /** Liquid / dish color driving the item art and buff icon. */
  readonly color: string;
  /** Buff name when it differs from the item (Well Fed, Mana Surge). */
  readonly buffName?: string;
  readonly useText: string;
}

const def = (d: Omit<ConsumableDef, 'kind'>): Readonly<ConsumableDef> => Object.freeze({ ...d, kind: 'consumable' });

/** Real WotLK consumable names (wowhead.com/wotlk); stats map to this world's modifiers. */
export const CONSUMABLES: Readonly<Record<string, Readonly<ConsumableDef>>> = Object.freeze(Object.fromEntries([
  // ── Flasks (1h, persist through death in WotLK — here they ride the buff clock) ──
  def({ id: 'flaskEndlessRage', name: 'Flask of Endless Rage', buffCategory: 'flask', itemLevel: 80, stackSize: 20, cooldown: 1, color: '#e06a4b',
    duration: 3600, buff: { duration: 3600, stats: { damagePercent: 12 } },
    useText: 'Increases attack damage by 12% for 1 hour. Counts as both a Battle and Guardian elixir. Persists through death.' }),
  def({ id: 'flaskFrostWyrm', name: 'Flask of the Frost Wyrm', buffCategory: 'flask', itemLevel: 80, stackSize: 20, cooldown: 1, color: '#8ecbe0',
    duration: 3600, buff: { duration: 3600, stats: { spellDamagePercent: 12 } },
    useText: 'Increases spell damage by 12% for 1 hour. Counts as both a Battle and Guardian elixir. Persists through death.' }),
  def({ id: 'flaskStoneblood', name: 'Flask of Stoneblood', buffCategory: 'flask', itemLevel: 80, stackSize: 20, cooldown: 1, color: '#a9daca',
    duration: 3600, buff: { duration: 3600, stats: { maxHp: 650 } },
    useText: 'Increases maximum health by 650 for 1 hour. Counts as both a Battle and Guardian elixir. Persists through death.' }),
  def({ id: 'flaskPureMojo', name: 'Flask of Pure Mojo', buffCategory: 'flask', itemLevel: 80, stackSize: 20, cooldown: 1, color: '#7ab8f0',
    duration: 3600, buff: { duration: 3600, stats: { manaRegen: 12 } },
    useText: 'Restores 12 mana every 5 seconds for 1 hour. Counts as both a Battle and Guardian elixir. Persists through death.' }),
  // ── Food (Well Fed) ──
  def({ id: 'fishFeast', name: 'Fish Feast', buffCategory: 'food', itemLevel: 80, stackSize: 20, cooldown: 1, color: '#e0b45a', buffName: 'Well Fed',
    duration: 3600, buff: { duration: 3600, stats: { damagePercent: 6, spellDamagePercent: 6, vitality: 8 } },
    useText: 'Restores health and grants Well Fed: +6% damage, +6% spell damage and +8 Vitality for 1 hour.' }),
  def({ id: 'dragonfinFilet', name: 'Dragonfin Filet', buffCategory: 'food', itemLevel: 75, stackSize: 20, cooldown: 1, color: '#d8956a', buffName: 'Well Fed',
    duration: 1800, buff: { duration: 1800, stats: { strength: 10, vitality: 8 } },
    useText: 'Grants Well Fed: +10 Strength and +8 Vitality for 30 minutes.' }),
  def({ id: 'spicedWyrmBurger', name: 'Spiced Wyrm Burger', buffCategory: 'food', itemLevel: 75, stackSize: 20, cooldown: 1, color: '#c98a5a', buffName: 'Well Fed',
    duration: 1800, buff: { duration: 1800, stats: { critChance: 4, vitality: 8 } },
    useText: 'Grants Well Fed: +4% critical chance and +8 Vitality for 30 minutes.' }),
  def({ id: 'tenderShoveltuskSteak', name: 'Tender Shoveltusk Steak', buffCategory: 'food', itemLevel: 70, stackSize: 20, cooldown: 1, color: '#caa06a', buffName: 'Well Fed',
    duration: 1800, buff: { duration: 1800, stats: { dexterity: 10, vitality: 8 } },
    useText: 'Grants Well Fed: +10 Dexterity and +8 Vitality for 30 minutes.' }),
  def({ id: 'firecrackerSalmon', name: 'Firecracker Salmon', buffCategory: 'food', itemLevel: 70, stackSize: 20, cooldown: 1, color: '#e08a5a', buffName: 'Well Fed',
    duration: 1800, buff: { duration: 1800, stats: { spellDamagePercent: 6, vitality: 8 } },
    useText: 'Grants Well Fed: +6% spell damage and +8 Vitality for 30 minutes.' }),
  // ── Battle elixirs (offense; one at a time) ──
  def({ id: 'elixirWrath', name: 'Elixir of Wrath', buffCategory: 'battleElixir', itemLevel: 60, stackSize: 20, cooldown: 1, color: '#f0a16b',
    duration: 3600, buff: { duration: 3600, stats: { critChance: 3 } },
    useText: 'Increases critical chance by 3% for 1 hour. Battle elixir.' }),
  def({ id: 'elixirDeadlyStrikes', name: 'Elixir of Deadly Strikes', buffCategory: 'battleElixir', itemLevel: 60, stackSize: 20, cooldown: 1, color: '#e0c17a',
    duration: 3600, buff: { duration: 3600, stats: { critDamage: 12 } },
    useText: 'Increases critical damage by 12% for 1 hour. Battle elixir.' }),
  def({ id: 'elixirAccuracy', name: 'Elixir of Accuracy', buffCategory: 'battleElixir', itemLevel: 55, stackSize: 20, cooldown: 1, color: '#e8d44d',
    duration: 3600, buff: { duration: 3600, stats: { attackSpeedPercent: 4 } },
    useText: 'Increases attack speed by 4% for 1 hour. Battle elixir.' }),
  def({ id: 'elixirSpellpower', name: 'Elixir of Spellpower', buffCategory: 'battleElixir', itemLevel: 60, stackSize: 20, cooldown: 1, color: '#b895ef',
    duration: 3600, buff: { duration: 3600, stats: { spellDamagePercent: 6 } },
    useText: 'Increases spell damage by 6% for 1 hour. Battle elixir.' }),
  // ── Guardian elixirs (defense; one at a time) ──
  def({ id: 'elixirMightyFortitude', name: 'Elixir of Mighty Fortitude', buffCategory: 'guardianElixir', itemLevel: 60, stackSize: 20, cooldown: 1, color: '#a9daca',
    duration: 3600, buff: { duration: 3600, stats: { maxHp: 350 } },
    useText: 'Increases maximum health by 350 for 1 hour. Guardian elixir.' }),
  def({ id: 'elixirProtection', name: 'Elixir of Protection', buffCategory: 'guardianElixir', itemLevel: 60, stackSize: 20, cooldown: 1, color: '#9db2ba',
    duration: 3600, buff: { duration: 3600, stats: { armor: 500 } },
    useText: 'Increases armor by 500 for 1 hour. Guardian elixir.' }),
  def({ id: 'elixirMageblood', name: 'Elixir of Mighty Mageblood', buffCategory: 'guardianElixir', itemLevel: 60, stackSize: 20, cooldown: 1, color: '#8ecbe0',
    duration: 3600, buff: { duration: 3600, stats: { manaRegen: 8 } },
    useText: 'Restores 8 mana every 5 seconds for 1 hour. Guardian elixir.' }),
  // ── Potions (instant or short buff; shared cooldown) ──
  def({ id: 'runicHealingPotion', name: 'Runic Healing Potion', buffCategory: 'potion', itemLevel: 80, stackSize: 20, cooldown: 5, color: '#e08a8a',
    duration: 0, healFraction: .35,
    useText: 'Instantly restores 35% of your maximum health.' }),
  def({ id: 'runicManaPotion', name: 'Runic Mana Potion', buffCategory: 'potion', itemLevel: 80, stackSize: 20, cooldown: 5, color: '#7ab8f0',
    duration: 0, manaFraction: .3,
    useText: 'Instantly restores 30% of your maximum mana.' }),
  def({ id: 'potionOfSpeed', name: 'Potion of Speed', buffCategory: 'potion', itemLevel: 80, stackSize: 20, cooldown: 5, color: '#f0e68c',
    duration: 15, buff: { duration: 15, stats: { attackSpeedPercent: 20, castSpeedPercent: 20 } },
    useText: 'Increases attack and cast speed by 20% for 15 seconds.' }),
  def({ id: 'potionOfWildMagic', name: 'Potion of Wild Magic', buffCategory: 'potion', itemLevel: 80, stackSize: 20, cooldown: 5, color: '#c9a0e8',
    duration: 15, buff: { duration: 15, stats: { critChance: 5, spellDamagePercent: 10 } },
    useText: 'Increases critical chance by 5% and spell damage by 10% for 15 seconds.' }),
  def({ id: 'indestructiblePotion', name: 'Indestructible Potion', buffCategory: 'potion', itemLevel: 80, stackSize: 20, cooldown: 5, color: '#9db2ba',
    duration: 120, buff: { duration: 120, stats: { armor: 800 } },
    useText: 'Increases armor by 800 for 2 minutes.' }),
].map(d => [d.id, d])));

export const isConsumableId = (v: unknown): v is string => typeof v === 'string' && v in CONSUMABLES;

/** Parse the definition id out of a consumable item's encoded id. */
export function consumableItemId(item: Item | null | undefined): string | null {
  if (!item || item.kind !== 'consumable' || !item.id.startsWith(CONSUMABLE_ITEM_PREFIX)) return null;
  const rest = item.id.slice(CONSUMABLE_ITEM_PREFIX.length), cut = rest.indexOf(':');
  const id = cut < 0 ? rest : rest.slice(0, cut);
  return isConsumableId(id) ? id : null;
}
export const consumableFor = (item: Item | null | undefined): Readonly<ConsumableDef> | undefined => {
  const id = consumableItemId(item); return id ? CONSUMABLES[id] : undefined;
};
export const isConsumableItem = (item: Item | null | undefined): boolean => consumableFor(item) !== undefined;

/** Deterministic consumable stack for crafting, rewards and vendor stock. */
export function createConsumableItem(consumableId: string, seed: number, stack = 1): Item {
  const def = CONSUMABLES[consumableId];
  if (!def) throw new RangeError(`Unknown consumable: ${consumableId}`);
  seed = seed >>> 0;
  const count = Math.max(1, Math.min(CONSUMABLE_STACK_MAX, Math.floor(stack)));
  return {
    id: `${CONSUMABLE_ITEM_PREFIX}${def.id}:${seed.toString(36)}`, seed, name: def.name, baseName: def.name,
    kind: 'consumable', tier: 'common', itemLevel: def.itemLevel, requiredLevel: Math.max(1, def.itemLevel - 2),
    power: 0, implicit: {}, affixes: [], stack: count,
    recipe: { starter: false, enhancement: 0, revision: 0, targetedRolls: 0, fullRolls: 0, rolls: [] },
    appearance: { base: def.color, shadow: '#1a2530', edge: '#d8e4ea', trim: '#c9a86a', style: 'cloth' },
  };
}

/** Total charges of one consumable across every pack stack. */
export function consumableCount(sheet: CharacterSheet, consumableId: string): number {
  return sheet.inventory.reduce((total, item) => total + (consumableItemId(item) === consumableId ? item!.stack ?? 1 : 0), 0);
}

/** Distinct consumables in the pack with their combined stack counts (bar assignment source). */
export function ownedConsumables(sheet: CharacterSheet): { def: Readonly<ConsumableDef>; count: number }[] {
  const totals = new Map<string, number>();
  for (const item of sheet.inventory) {
    const id = consumableItemId(item);
    if (id) totals.set(id, (totals.get(id) ?? 0) + (item!.stack ?? 1));
  }
  return [...totals].map(([id, count]) => ({ def: CONSUMABLES[id]!, count }));
}

/** Category of a live consumable buff (exclusiveGroup `consumable:<category>`). */
export function consumableBuffCategory(buff: Pick<WowBuff, 'exclusiveGroup'>): ConsumableCategory | undefined {
  const group = buff.exclusiveGroup;
  if (!group?.startsWith(CONSUMABLE_ITEM_PREFIX)) return undefined;
  const category = group.slice(CONSUMABLE_ITEM_PREFIX.length);
  return (CONSUMABLE_CATEGORIES as readonly string[]).includes(category) ? category as ConsumableCategory : undefined;
}
/** Definition behind a live consumable buff (id `consumable:<defId>`). */
export function consumableBuffDef(buff: Pick<WowBuff, 'id'>): Readonly<ConsumableDef> | undefined {
  if (!buff.id.startsWith(CONSUMABLE_ITEM_PREFIX)) return undefined;
  const id = buff.id.slice(CONSUMABLE_ITEM_PREFIX.length);
  return isConsumableId(id) ? CONSUMABLES[id] : undefined;
}

// ── Art ──────────────────────────────────────────────────────────────────────

/** Small category glyph for the buff bar (36×36 viewBox, fixed palette). */
export function consumableCategoryIcon(category: ConsumableCategory, size = 36): string {
  const inner: Record<ConsumableCategory, string> = {
    flask: '<path d="M15 4h6v5l6 9a8 8 0 1 1-12 0l6-9V4Z" fill="#8ecbe0" stroke="#e8f4f8" stroke-width="1.6"/>',
    food: '<path d="M5 20c4-7 12-9 18-6l6-4-2 6c3 5-2 12-9 12S5 24 5 20Z" fill="#e0b45a" stroke="#fff0c8" stroke-width="1.6"/><circle cx="24" cy="15" r="1.6" fill="#5a3a1a"/>',
    battleElixir: '<path d="M8 28 24 8l3 3-14 18-5-1Zm20-2L12 10l-3-3 16 14 3 5Z" fill="#f0a16b" stroke="#ffe0b8" stroke-width="1.4"/>',
    guardianElixir: '<path d="M18 4 30 9v9c0 8-5 12-12 14C11 30 6 26 6 18V9Z" fill="#a9daca" stroke="#e8fff4" stroke-width="1.6"/>',
    potion: '<path d="M14 5h8v6l5 7a9 9 0 1 1-18 0l5-7V5Z" fill="#e08a8a" stroke="#ffe8e0" stroke-width="1.6"/><path d="M12 20h12" stroke="#fff" stroke-width="1.4"/>',
  };
  return `<svg viewBox="0 0 36 36" width="${size}" height="${size}" aria-hidden="true">${inner[category]}</svg>`;
}

