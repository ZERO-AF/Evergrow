/** Dual talent specialization commands (docs/wow-deepening.md wave): unlock,
 * swap, rename. Every mutation flows through the durable checkpoint path —
 * capture → mutate the parsed copy → persist → commit — mirroring
 * glyph-command.ts. Presentation code never mutates spec state. */
import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { ActionResult, SkillId } from './character-types.ts';
import type { WowBuff } from './model.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { unlockedSkills } from './skill-tree.ts';
import { racialSkillId, refreshCharacter } from './character.ts';
import { refreshBuffStats, restoreFormResource } from './player-skill-effects.ts';
import { spendGold } from './wallet.ts';
import { formatWalletCompact } from './currency.ts';
import { pushChatMessage } from './chat-log.ts';
import { text } from './item-validation.ts';
import {
  activeSpecIndex, applySpec, captureSpec, DUAL_SPEC_COST, DUAL_SPEC_LEVEL, DUAL_SPEC_NAMES,
  dualSpecProblem, dualSpecUnlocked, emptySpec, inactiveSpecIndex, SPEC_NAME_MAX, validSpec,
  type DualSpecSheet,
} from './dual-spec-state.ts';

/** Checkpoint extension carrying the live combat fields a swap prunes. */
export type DualSpecCheckpoint = CharacterCheckpoint & {
  allies?: Simulation['player']['allies'];
  buffs?: Simulation['player']['buffs'];
};
type Persist = (checkpoint: CharacterCheckpoint) => Promise<ActionResult>;

/** Purchase dual specialization (WotLK: level 40, 1000 gold). The current build
 * becomes the Primary spec; the Secondary starts empty with every point unspent. */
export async function executeDualSpecUnlock(sim: Simulation, persist: Persist): Promise<ActionResult> {
  const p = sim.player;
  const problem = dualSpecProblem(sim);
  if (problem) return { ok: false, message: problem };
  if (dualSpecUnlocked(p.character as DualSpecSheet)) return { ok: false, message: 'You already know dual specialization.' };
  if (p.level < DUAL_SPEC_LEVEL) return { ok: false, message: `Dual specialization requires level ${DUAL_SPEC_LEVEL}.` };
  const checkpoint = sim.captureCheckpoint() as DualSpecCheckpoint;
  const sheet = checkpoint.character as DualSpecSheet;
  if (!spendGold(sheet, DUAL_SPEC_COST))
    return { ok: false, message: `Dual specialization costs ${formatWalletCompact(DUAL_SPEC_COST)}.` };
  sheet.specs = [captureSpec(sheet, DUAL_SPEC_NAMES[0]), emptySpec(DUAL_SPEC_NAMES[1])];
  sheet.activeSpec = 0;
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. No gold was spent.' };
  p.character = checkpoint.character;
  const message = `Dual talent specialization learned for ${formatWalletCompact(DUAL_SPEC_COST)}. Your ${DUAL_SPEC_NAMES[1].toLowerCase()} spec starts unspent.`;
  pushChatMessage(p, 'system', message, sim.time);
  return { ok: true, message };
}

/** Activate the stored inactive spec: the live build is snapshotted into its
 * slot, the stored build is installed, and combat state the old build owned
 * (cooldowns, allies, skill buffs) is stripped. Out of combat, outdoors only. */
export async function executeSpecSwap(sim: Simulation, persist: Persist): Promise<ActionResult> {
  const p = sim.player;
  const problem = dualSpecProblem(sim);
  if (problem) return { ok: false, message: problem };
  const live = p.character as DualSpecSheet;
  const specs = live.specs;
  if (!specs?.length) return { ok: false, message: 'Learn dual specialization first.' };
  const active = activeSpecIndex(live), target = inactiveSpecIndex(live);
  const stored = specs[target];
  if (!stored || !validSpec(stored, live.classId, live.raceId, p.level))
    return { ok: false, message: 'The stored specialization is no longer valid.' };
  const checkpoint = sim.captureCheckpoint() as DualSpecCheckpoint;
  const sheet = checkpoint.character as DualSpecSheet;
  // Refund the live build into its slot, then apply the stored one.
  sheet.specs![active] = captureSpec(sheet, specs[active]?.name ?? DUAL_SPEC_NAMES[active] ?? 'Spec');
  applySpec(sheet, stored, checkpoint.level);
  sheet.activeSpec = target;
  const known = new Set<SkillId>([...unlockedSkills(sheet.allocatedNodes), racialSkillId(sheet)]);
  checkpoint.skillCooldowns = Object.fromEntries(
    Object.entries(checkpoint.skillCooldowns).filter(([id]) => known.has(id as SkillId))) as Partial<Record<SkillId, number>>;
  checkpoint.allies = [];
  const keepBuff = (buff: WowBuff) =>
    !(Object.hasOwn(SKILL_DEFINITIONS, buff.id) && !known.has(buff.id as SkillId));
  checkpoint.buffs = checkpoint.buffs?.filter(keepBuff);
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. The specialization was not swapped.' };
  for (const buff of p.buffs ?? []) if (!keepBuff(buff)) restoreFormResource(p, buff);
  p.character = checkpoint.character;
  p.skillCooldowns = checkpoint.skillCooldowns;
  p.allies = [];
  p.buffs = checkpoint.buffs;
  p.comboPoints = 0;
  p.autoAttack = false;
  p.activeSkill = null;
  p.cast = null;
  p.stealthed = p.buffs?.some(buff => buff.stealth) ?? false;
  p.skillEffects = undefined;
  p.affixBuffs = undefined;
  refreshCharacter(p);
  refreshBuffStats(p);
  const message = `${stored.name} specialization activated.`;
  pushChatMessage(p, 'system', message, sim.time);
  return { ok: true, message };
}
/** Rename a stored spec tab (WoW allows naming each spec). */
export async function executeSpecRename(sim: Simulation, index: number, name: string, persist: Persist): Promise<ActionResult> {
  const p = sim.player;
  if (!dualSpecUnlocked(p.character as DualSpecSheet)) return { ok: false, message: 'Learn dual specialization first.' };
  const trimmed = name.trim();
  if (!text(trimmed, SPEC_NAME_MAX)) return { ok: false, message: `Choose a name up to ${SPEC_NAME_MAX} characters.` };
  const checkpoint = sim.captureCheckpoint() as DualSpecCheckpoint;
  const specs = (checkpoint.character as DualSpecSheet).specs!;
  if (!Number.isSafeInteger(index) || index < 0 || index >= specs.length) return { ok: false, message: 'Unknown specialization.' };
  if (specs[index]!.name === trimmed) return { ok: true, message: 'Name unchanged.' };
  specs[index]!.name = trimmed;
  const saved = await persist(checkpoint);
  if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. The name was not changed.' };
  p.character = checkpoint.character;
  const message = `Specialization renamed to ${trimmed}.`;
  pushChatMessage(p, 'system', message, sim.time);
  return { ok: true, message };
}
