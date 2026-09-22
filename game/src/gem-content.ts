import { randomSource } from './random-source.ts';
import { itemAffixGrowthLevel, normalizeLevel } from './progression-content.ts';
import type { Item, ItemKind, ItemTier, SocketColor, StatKey, StatModifiers } from './character-types.ts';

/**
 * Jewelcrafting gems and equipment sockets (WoW jewelcrafting flavor).
 *
 * ItemKind is frozen, so a gem item rides the 'amulet' kind with a starter
 * recipe — the same convention glyph-content.ts uses: that shape passes
 * validItem with zero affixes/implicit and survives deriveItem unchanged.
 * Unlike glyphs the gem id lives in `recipe.profileId` (not the item id), so
 * vendor stock stamping (`stock:` ids) cannot corrupt gem identity.
 *
 * Sockets: socketable equipment rolls 0-3 colored sockets at generation
 * (rarity-weighted, dedicated RNG stream so existing rolls stay stable). A
 * socketed gem stores its definition id plus its own item level; its stats are
 * folded into the item's implicit modifiers by deriveItem. Removing or
 * replacing a gem destroys it (WoW jewelcrafting rule — see gem-command.ts).
 *
 * Socket bonus: when every socket holds a gem whose color matches the socket
 * (hybrids match either parent color, prismatic matches all), the item gains a
 * small deterministic bonus derived from its seed.
 */

export const MAX_SOCKETS = 3;
export const SOCKET_COLORS: readonly SocketColor[] = Object.freeze(['red', 'blue', 'yellow']);
/** WoW socketable gear: weapons, shields and the five armor slots. */
export const SOCKETABLE_KINDS: readonly ItemKind[] = Object.freeze(['weapon', 'shield', 'head', 'chest', 'gloves', 'legs', 'boots']);
/** The host kind every gem item carries (see module header). */
export const GEM_ITEM_KIND: ItemKind = 'amulet';

export type GemColor = SocketColor | 'orange' | 'purple' | 'green' | 'prismatic';
export const GEM_COLOR_HEX: Readonly<Record<GemColor, string>> = Object.freeze({
  red: '#e0524d', blue: '#4d8fe0', yellow: '#e0c34d',
  orange: '#e08a3d', purple: '#a05fd0', green: '#5fb85f', prismatic: '#e8e4da',
});

export interface GemStat {
  stat: StatKey;
  base: number;
  growth: number;
  /** 'affix' follows the affix growth curve (percents, mana, str/int); 'level' follows flat stats (level - 1). */
  scale: 'affix' | 'level';
}
export interface GemDefinition {
  id: string;
  name: string;
  color: GemColor;
  stats: readonly GemStat[];
  flavor: string;
}

const GEM_DEFINITIONS: GemDefinition[] = [
  { id: 'bold-scarlet-ruby', name: 'Bold Scarlet Ruby', color: 'red', flavor: 'A warrior’s cut, edges like a honed blade.',
    stats: [{ stat: 'strength', base: 2, growth: .4, scale: 'affix' }] },
  { id: 'bright-cardinal-ruby', name: 'Bright Cardinal Ruby', color: 'red', flavor: 'It pulses in time with a heartbeat.',
    stats: [{ stat: 'damagePercent', base: 3, growth: .3, scale: 'affix' }] },
  { id: 'solid-azure-moonstone', name: 'Solid Azure Moonstone', color: 'blue', flavor: 'Cool and patient as deep water.',
    stats: [{ stat: 'vitality', base: 2, growth: .35, scale: 'level' }] },
  { id: 'lustrous-skysapphire', name: 'Lustrous Sky Sapphire', color: 'blue', flavor: 'Rain gathers inside the stone.',
    stats: [{ stat: 'manaRegen', base: 1.5, growth: .15, scale: 'affix' }] },
  { id: 'brilliant-kings-amber', name: 'Brilliant King’s Amber', color: 'yellow', flavor: 'Sunlight, cut and set.',
    stats: [{ stat: 'intelligence', base: 2, growth: .4, scale: 'affix' }] },
  { id: 'smooth-sun-crystal', name: 'Smooth Sun Crystal', color: 'yellow', flavor: 'Polished until the light slides off.',
    stats: [{ stat: 'critChance', base: 1, growth: .08, scale: 'affix' }] },
  { id: 'quick-autumn-glow', name: 'Quick Autumn’s Glow', color: 'yellow', flavor: 'It hums faintly, impatient to move.',
    stats: [{ stat: 'attackSpeedPercent', base: 2, growth: .12, scale: 'affix' }] },
  // Hybrids match either parent socket color and split their budget.
  { id: 'etched-monarch-topaz', name: 'Etched Monarch Topaz', color: 'orange', flavor: 'Strength guided by a steady hand.',
    stats: [{ stat: 'strength', base: 1, growth: .2, scale: 'affix' }, { stat: 'critChance', base: .5, growth: .04, scale: 'affix' }] },
  { id: 'purified-twilight-opal', name: 'Purified Twilight Opal', color: 'purple', flavor: 'A calm mind behind a strong arm.',
    stats: [{ stat: 'intelligence', base: 1, growth: .2, scale: 'affix' }, { stat: 'manaRegen', base: .8, growth: .08, scale: 'affix' }] },
  { id: 'jagged-forest-emerald', name: 'Jagged Forest Emerald', color: 'green', flavor: 'Grown, not cut; it remembers the wild.',
    stats: [{ stat: 'critChance', base: .5, growth: .04, scale: 'affix' }, { stat: 'vitality', base: 1, growth: .18, scale: 'level' }] },
  // Prismatic matches every socket color.
  { id: 'nightmare-tear', name: 'Nightmare Tear', color: 'prismatic', flavor: 'A little of everything the dreamer feared.',
    stats: [
      { stat: 'strength', base: 1, growth: .2, scale: 'affix' }, { stat: 'dexterity', base: 1, growth: .12, scale: 'level' },
      { stat: 'intelligence', base: 1, growth: .2, scale: 'affix' }, { stat: 'vitality', base: 1, growth: .18, scale: 'level' },
    ] },
];
export const GEMS: readonly GemDefinition[] = Object.freeze(GEM_DEFINITIONS.map(def => Object.freeze({ ...def, stats: Object.freeze(def.stats) })));
export type GemId = (typeof GEMS)[number]['id'];
export const gemDefinition = (id: string | null | undefined): GemDefinition | undefined => GEMS.find(g => g.id === id);
export const isGemId = (id: unknown): id is GemId => typeof id === 'string' && gemDefinition(id) !== undefined;

/** Hybrid gems satisfy either parent color; prismatic satisfies all. */
export function gemMatchesSocket(gem: GemDefinition, color: SocketColor): boolean {
  return gem.color === 'prismatic' || gem.color === color
    || gem.color === 'orange' && (color === 'red' || color === 'yellow')
    || gem.color === 'purple' && (color === 'red' || color === 'blue')
    || gem.color === 'green' && (color === 'blue' || color === 'yellow');
}

/** Whole-stat value at the gem's own item level; mirrors the affix growth curve. */
export function gemStatValue(stat: GemStat, level: number): number {
  const growth = stat.scale === 'affix' ? itemAffixGrowthLevel(level) : normalizeLevel(level) - 1;
  return Math.max(1, Math.round(stat.base + growth * stat.growth));
}
const GEM_PERCENT_STATS: Readonly<Record<string, true>> = { damagePercent: true, critChance: true, attackSpeedPercent: true };
export const formatGemStat = (stat: GemStat, level: number): string =>
  `+${gemStatValue(stat, level)}${GEM_PERCENT_STATS[stat.stat] ? '%' : ''}`;

/** Deterministic gem item for vendor stock and rewards; the gem id rides recipe.profileId. */
export function createGem(gemId: string, seed: number, level: number): Item {
  const def = gemDefinition(gemId);
  if (!def) throw new RangeError(`Unknown gem: ${gemId}`);
  const itemLevel = normalizeLevel(level), s = (seed >>> 0).toString(36), hex = GEM_COLOR_HEX[def.color];
  return {
    id: `gem-${s}-${itemLevel}-${def.id}`, seed: seed >>> 0,
    name: def.name, baseName: def.name, kind: GEM_ITEM_KIND, tier: 'rare',
    itemLevel, requiredLevel: Math.max(1, itemLevel - 2), power: 1,
    implicit: {}, affixes: [],
    recipe: { manaVersion: 1, offenseVersion: 1, rollVersion: 1, profileId: def.id, starter: true, enhancement: 0, revision: 0, targetedRolls: 0, fullRolls: 0, rolls: [] },
    flavor: `${def.flavor} ${def.stats.map(stat => formatGemStat(stat, itemLevel)).join(', ')} — fits a ${def.color === 'prismatic' ? 'any' : def.color} socket.`,
    appearance: { base: hex, shadow: '#1c1a22', edge: '#f4f0e4', trim: hex, style: 'cloth' },
  };
}
/** Deterministic pick for stock and drops: seed chooses among the catalog. */
export const createGemForSeed = (seed: number, level: number): Item =>
  createGem(GEMS[Math.floor(randomSource((seed ^ 0x3d9f1c7b) >>> 0)() * GEMS.length)].id, seed, level);

/** The socketed gem's definition id, or null when the item is not a gem token. */
export function gemItemId(item: Item | null | undefined): GemId | null {
  const id = item?.recipe?.profileId;
  return isGemId(id) ? id : null;
}
export const isGemItem = (item: Item | null | undefined): boolean => gemItemId(item) !== null;

// ── Sockets ──

/** Cumulative roll thresholds per tier; a roll past the last threshold grants MAX_SOCKETS. */
const SOCKET_COUNT_CHANCES: Readonly<Record<ItemTier, readonly number[]>> = Object.freeze({
  common: [1, 1, 1], magic: [.75, .95, 1], rare: [.45, .8, .97], epic: [.15, .5, .85], legendary: [0, .3, .7], unique: [0, .3, .7],
});

/** Rarity-weighted socket roll on a dedicated stream; never consumes the item's own draws. */
export function rollSockets(kind: ItemKind, tier: ItemTier, seed: number): Item['sockets'] {
  if (!SOCKETABLE_KINDS.includes(kind)) return undefined;
  const random = randomSource((seed ^ 0x5f3a9c71) >>> 0);
  const chances = SOCKET_COUNT_CHANCES[tier], roll = random(), index = chances.findIndex(c => roll < c);
  const count = index < 0 ? chances.length : index;
  if (count <= 0) return undefined;
  return Array.from({ length: count }, () => ({ color: SOCKET_COLORS[Math.floor(random() * SOCKET_COLORS.length)] }));
}

interface SocketBonus { stat: StatKey; base: number; growth: number; scale: GemStat['scale']; }
/** Small per-kind bonus pools; the item's seed picks one at generation time. */
const SOCKET_BONUS_POOLS: Readonly<Partial<Record<ItemKind, readonly SocketBonus[]>>> = Object.freeze({
  weapon: [{ stat: 'damagePercent', base: 2, growth: .15, scale: 'affix' }, { stat: 'critChance', base: .5, growth: .04, scale: 'affix' }, { stat: 'lifeOnHit', base: 1, growth: .1, scale: 'level' }],
  shield: [{ stat: 'blockChance', base: 1, growth: .05, scale: 'affix' }, { stat: 'armor', base: 4, growth: .8, scale: 'level' }, { stat: 'vitality', base: 1, growth: .2, scale: 'level' }],
  head: [{ stat: 'intelligence', base: 1, growth: .25, scale: 'affix' }, { stat: 'maxMana', base: 6, growth: .6, scale: 'affix' }, { stat: 'cooldownPercent', base: 1, growth: .06, scale: 'affix' }],
  chest: [{ stat: 'maxHp', base: 8, growth: 1.2, scale: 'level' }, { stat: 'armor', base: 5, growth: .9, scale: 'level' }, { stat: 'vitality', base: 1, growth: .25, scale: 'level' }],
  gloves: [{ stat: 'attackSpeedPercent', base: 1, growth: .07, scale: 'affix' }, { stat: 'critChance', base: .5, growth: .04, scale: 'affix' }, { stat: 'dexterity', base: 1, growth: .15, scale: 'level' }],
  legs: [{ stat: 'maxHp', base: 6, growth: 1, scale: 'level' }, { stat: 'armor', base: 4, growth: .8, scale: 'level' }, { stat: 'strength', base: 1, growth: .2, scale: 'affix' }],
  boots: [{ stat: 'moveSpeedPercent', base: 1, growth: .05, scale: 'affix' }, { stat: 'dexterity', base: 1, growth: .15, scale: 'level' }, { stat: 'vitality', base: 1, growth: .2, scale: 'level' }],
});

/** The item's authored socket bonus (seed-picked); shown even while unmatched. */
export function socketBonusStats(item: Pick<Item, 'kind' | 'seed' | 'itemLevel'>): { stat: StatKey; value: number } | null {
  const pool = SOCKET_BONUS_POOLS[item.kind];
  if (!pool?.length) return null;
  const bonus = pool[Math.floor(randomSource((item.seed ^ 0x7c4e2a91) >>> 0)() * pool.length)];
  return { stat: bonus.stat, value: gemStatValue(bonus, item.itemLevel) };
}

/** WoW rule: every socket filled with a color-matching gem activates the bonus. */
export function socketBonusActive(item: Pick<Item, 'sockets'>): boolean {
  return !!item.sockets?.length && item.sockets.every(socket => {
    const gem = gemDefinition(socket.gem);
    return !!gem && gemMatchesSocket(gem, socket.color);
  });
}

/** Gem stats plus the matched socket bonus; deriveItem folds these into implicit. */
export function socketedModifiers(item: Pick<Item, 'sockets' | 'kind' | 'seed' | 'itemLevel'>): StatModifiers {
  const modifiers: StatModifiers = {};
  for (const socket of item.sockets ?? []) {
    const gem = gemDefinition(socket.gem);
    if (!gem) continue;
    for (const stat of gem.stats) modifiers[stat.stat] = (modifiers[stat.stat] ?? 0) + gemStatValue(stat, socket.gemLevel ?? item.itemLevel);
  }
  if (socketBonusActive(item)) {
    const bonus = socketBonusStats(item);
    if (bonus) modifiers[bonus.stat] = (modifiers[bonus.stat] ?? 0) + bonus.value;
  }
  return modifiers;
}

/** Structural socket check for save validation; gem ids and levels must be real. */
export function validItemSockets(v: unknown, kind: ItemKind): boolean {
  if (v === undefined) return true;
  if (!Array.isArray(v) || !v.length || v.length > MAX_SOCKETS || !SOCKETABLE_KINDS.includes(kind)) return false;
  return v.every((socket: unknown) => {
    if (typeof socket !== 'object' || socket === null || Array.isArray(socket) || !('color' in socket)) return false;
    if (!(SOCKET_COLORS as readonly unknown[]).includes(socket.color)) return false;
    const gem = 'gem' in socket ? socket.gem : undefined;
    if (gem === undefined) return true;
    const gemLevel = 'gemLevel' in socket ? socket.gemLevel : undefined;
    return isGemId(gem) && typeof gemLevel === 'number' && Number.isSafeInteger(gemLevel) && gemLevel >= 1 && gemLevel <= 1e6;
  });
}

/** Strict gem-token shape for save validation; tolerates stamped vendor ids and locked flags. */
export function validGemItem(v: unknown): v is Item {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const item = v as Item;
  const def = gemDefinition(gemItemId(item));
  return !!def && item.kind === GEM_ITEM_KIND && item.tier === 'rare'
    && item.recipe?.starter === true && !item.recipe.materialId && !item.recipe.enhancement
    && !item.affixes?.length && !Object.keys(item.implicit ?? {}).length
    && !item.weapon && !item.shield && !item.focus && item.sockets === undefined
    && item.name === def.name && item.baseName === def.name;
}
