/** WoW aura frame (docs/wow-deepening.md): a read-only projection of the player's
 * live auras — skill buffs, consumables, procs, totem wards, shapeshift forms and
 * stealth from `player.buffs`, reserved-mana auras from `player.auras`, the active
 * mount — plus a second row of harmful effects (`player.cc` crowd control and
 * `player.dots` damage-over-time). Presentation consumes this model; it never
 * mutates the player. Right-click cancel routes through `cancelBuff`, the
 * validated command boundary that mirrors Simulation.addBuffTo's removal rules. */
import type { ActionResult, SkillId, StatKey } from './character-types.ts';
import type { Player, WowBuff } from './model.ts';
import { AURA_IDS, AURAS, auraRank, auraSummary, resolveAura } from './aura-content.ts';
import { auraPower } from './auras.ts';
import { consumableBuffCategory, consumableBuffDef } from './consumable-content.ts';
import { MOUNTS } from './mount-content.ts';
import { refreshBuffStats, restoreFormResource } from './player-skill-effects.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { SKILL_ICON_RECIPES } from './skill-icon-content.ts';
import { STAT_LABELS, formatStatValue } from './items.ts';
import { CC_META, DOT_COLORS, dotIcon, seenDuration } from './enemy-debuffs.ts';

/** One aura icon in the frame. `icon` is a SkillId for skill buffs, `consumable:<category>`
 * for flask/food/elixir/potion effects, `mount:<id>` for the active mount, or '' for
 * the letter fallback (procs, totem wards, blessings without a skill glyph). */
export interface BuffFrameEntry {
  /** Stable identity across frames; `cancelBuff` accepts this key. */
  readonly key: string;
  readonly name: string;
  readonly color: string;
  readonly icon: string;
  /** Seconds remaining; timed entries only. */
  readonly remaining: number;
  /** Full applied duration; 0 for persistent effects (no drain sweep). */
  readonly duration: number;
  readonly harmful: boolean;
  /** WoW parity: right-click removes the effect. */
  readonly cancelable: boolean;
  /** No countdown: auras, mounts and hour-long flasks. */
  readonly persistent?: boolean;
  readonly summary: string;
  /** Optional glossary term for the nested explanation link. */
  readonly term?: string;
}
export interface BuffFrameModel { readonly buffs: readonly BuffFrameEntry[]; readonly debuffs: readonly BuffFrameEntry[]; }

const percent = (n: number) => `${Math.round(n * 100)}%`;

/** WoW rule of thumb: player-applied buffs cancel on right-click; procs and
 * resurrection sickness are explicitly non-cancelable. Auras and the mount are
 * cancelable through their own keys rather than the buff list. */
export function buffCancelable(buff: WowBuff): boolean {
  return !buff.id.startsWith('proc:') && buff.id !== 'rez-sickness';
}

/** Icon token for a live buff: consumables resolve to their category glyph,
 * authored skill ids keep their glass icon, everything else falls back to a letter. */
export function buffIconToken(buff: WowBuff): string {
  const category = consumableBuffCategory(buff);
  if (category) return `consumable:${category}`;
  return Object.hasOwn(SKILL_ICON_RECIPES, buff.id) ? buff.id : '';
}

/** One-line effect summary for the tooltip, folded from the live buff fields. */
export function describeBuff(buff: WowBuff): string {
  const parts = Object.entries(buff.stats ?? {}).map(([key, value]) => `${STAT_LABELS[key as StatKey] ?? key} ${formatStatValue(key as StatKey, value)}`);
  if (buff.absorb) parts.push(`Absorbs ${Math.round(buff.absorbRemaining ?? 0)} damage`);
  if (buff.reduction) parts.push(`${percent(buff.reduction)} hit damage prevented`);
  if (buff.healPerSecond) parts.push(`Restores ${percent(buff.healPerSecond)} health / second`);
  if (buff.manaPerSecond) parts.push(`Restores ${percent(buff.manaPerSecond)} mana / second`);
  if (buff.resourcePerSecond) parts.push(`+${buff.resourcePerSecond} resource / second`);
  if (buff.stealth) parts.push('Stealthed');
  if (buff.form) parts.push('Shapeshifted');
  if (buff.imbue) parts.push(`Imbued: +${percent(buff.imbue.fraction)} ${buff.imbue.element} damage`);
  if (buff.reflect) parts.push(`Reflects ${percent(buff.reflect)} damage`);
  if (buff.immunity) parts.push('Immune to damage');
  if (buff.leech) parts.push(`${percent(buff.leech)} of damage returns as health`);
  if (buff.allyDamage) parts.push(`Allies deal +${percent(buff.allyDamage)} damage`);
  return parts.join(' · ') || consumableBuffDef(buff)?.useText || 'Magical effect.';
}

/** WoW duration readout: hours, minutes, then seconds (tenths under 10s). */
export function formatAuraTime(entry: Pick<BuffFrameEntry, 'remaining' | 'duration' | 'persistent'>): string {
  if (entry.persistent || entry.duration <= 0) return '';
  const remaining = entry.remaining;
  if (remaining >= 3600) return `${Math.floor(remaining / 3600)}h`;
  if (remaining >= 60) return `${Math.floor(remaining / 60)}m`;
  return remaining < 10 ? (Math.ceil(remaining * 10) / 10).toFixed(1) : String(Math.ceil(remaining));
}

/** Read-only projection of the player's aura state into the two frame rows.
 * Dead players show nothing; expired entries are filtered rather than clamped. */
export function buffFrameModel(player: Player): BuffFrameModel {
  if (player.dead) return { buffs: [], debuffs: [] };
  const buffs: BuffFrameEntry[] = [];
  for (const buff of player.buffs ?? []) {
    if (!Number.isFinite(buff.remaining) || buff.remaining <= 0) continue;
    buffs.push({ key: buff.id, name: buff.name, color: buff.color, icon: buffIconToken(buff),
      remaining: buff.remaining, duration: buff.duration, harmful: false,
      cancelable: buffCancelable(buff), persistent: buff.duration >= 300 || buff.duration <= 0,
      summary: describeBuff(buff) });
  }
  // Reserved-mana auras are persistent passives, not timed buffs (WoW aura icons).
  for (const id of AURA_IDS) {
    if (auraPower(player, id) <= 0) continue;
    const aura = resolveAura(id, auraRank(player.character, id));
    buffs.push({ key: `aura:${id}`, name: AURAS[id].name, color: AURAS[id].color, icon: id,
      remaining: 1, duration: 0, harmful: false, cancelable: false, persistent: true,
      summary: `${auraSummary(id, aura.rank)} Reserves ${Number(aura.reservation.toFixed(1))}% mana.` });
  }
  const mount = player.mounted;
  if (mount && Object.hasOwn(MOUNTS, mount.id)) {
    const def = MOUNTS[mount.id];
    buffs.push({ key: 'mount', name: def.name, color: def.tint, icon: `mount:${mount.id}`,
      remaining: 1, duration: 0, harmful: false, cancelable: true, persistent: true,
      summary: `Mounted · +${percent(def.speed - 1)} movement speed.` });
  }
  const debuffs: BuffFrameEntry[] = [];
  for (const cc of player.cc ?? []) {
    if (!Number.isFinite(cc.remaining) || cc.remaining <= 0) continue;
    const meta = CC_META[cc.kind];
    debuffs.push({ key: `cc:${cc.kind}`, name: meta.name, color: meta.color, icon: meta.icon,
      remaining: cc.remaining, duration: seenDuration(player, `cc:${cc.kind}`, cc.remaining),
      harmful: true, cancelable: false, summary: meta.summary, term: 'cc' });
  }
  for (const dot of player.dots ?? []) {
    if (!Number.isFinite(dot.remaining) || dot.remaining <= 0) continue;
    const skill = SKILL_DEFINITIONS[dot.id as SkillId];
    debuffs.push({ key: `dot:${dot.id}`, name: skill?.name ?? `${dot.school[0]!.toUpperCase()}${dot.school.slice(1)}`,
      color: DOT_COLORS[dot.school] ?? '#d9a08a', icon: dotIcon(dot.id, dot.school),
      remaining: dot.remaining, duration: seenDuration(player, `dot:${dot.id}`, dot.remaining),
      harmful: true, cancelable: false,
      summary: `${Number(dot.dps.toFixed(1))} ${dot.school} damage / second.`, term: 'dot' });
  }
  return { buffs, debuffs };
}

const fail = (message: string): ActionResult => ({ ok: false, message });
const success = (message: string): ActionResult => ({ ok: true, message });

/** Right-click cancel (WoW parity). Validated command boundary: refuses dead
 * players, unknown keys, non-cancelable effects and harmful debuffs; on success it
 * mirrors addBuffTo's removal rules — form resource hand-back, stealth flag sync
 * and a derived-stat refresh. Synchronous like useConsumable: the caller's
 * saveCharacter/autosave persists the buff list on the checkpoint. */
export function cancelBuff(player: Player, key: string): ActionResult {
  if (player.dead) return fail('You are dead.');
  if (key === 'mount') {
    if (!player.mounted) return fail('You are not mounted.');
    player.mounted = null;
    return success('You dismount.');
  }
  if (key.startsWith('aura:')) return fail('Auras are dismissed from the skill bar.');
  const buffs = player.buffs ?? [];
  const index = buffs.findIndex(buff => buff.id === key);
  if (index < 0) return fail('That effect is no longer active.');
  const buff = buffs[index]!;
  if (!buffCancelable(buff)) return fail(`${buff.name} cannot be cancelled.`);
  restoreFormResource(player, buff);
  buffs.splice(index, 1);
  player.stealthed = buffs.some(active => active.stealth);
  refreshBuffStats(player);
  return success(`${buff.name} fades.`);
}
