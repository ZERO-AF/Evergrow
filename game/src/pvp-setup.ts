/** PvP match setup — the contract between the setup wizard (pvp-panel.ts, T04) and the
 * match controllers (arena T06 / battlegrounds T07). Pure state + validation; no DOM.
 *
 * `PvpRole` is declared here so every PvP module shares one union; pvp-chargen.ts (T03)
 * imports it for teammate/custom builds. */
import { WOW_CLASS_IDS, WOW_RACE_IDS, type WowClassId, type WowRaceId } from './wow-types.ts';
import { WOW_CLASSES } from './wow-classes.ts';
import { raceAllowsClass } from './wow-races.ts';
import type { EquipmentSlot, WowSkillId } from './character-types.ts';
import { createRaceLook, type CharacterLook } from './character-look.ts';


export type PvpMode = 'arena' | 'battleground';
/** Role direction for NPC teammates and custom builds: healer, tank or damage dealer. */
export type PvpRole = 'heal' | 'tank' | 'dd';
export type PvpArenaBracket = '2v2' | '3v3' | '4v4';
export type PvpBattlegroundId = 'warsong' | 'arathi';
/** Arena bracket or battleground map id — one union so `PvpSetup.bracket` stays flat. */
export type PvpBracket = PvpArenaBracket | PvpBattlegroundId;

export const PVP_ARENA_BRACKETS: readonly PvpArenaBracket[] = Object.freeze(['2v2', '3v3', '4v4']);

export interface PvpBattlegroundDef { id: PvpBattlegroundId; name: string; teamSize: number; blurb: string; }
/** Battleground catalog. `teamSize` is the wizard's roster bound; T07 owns the final
 * combatant-count budget and may retune these numbers. */
export const PVP_BATTLEGROUNDS: readonly PvpBattlegroundDef[] = Object.freeze([
  { id: 'warsong', name: 'Warsong Gulch', teamSize: 5, blurb: 'Capture the enemy flag three times. First to three captures wins.' },
  { id: 'arathi', name: 'Arathi Basin', teamSize: 8, blurb: 'Hold the five resource nodes. First side to 1600 resources wins.' },
]);

export interface PvpTeammate { classId: WowClassId; role: PvpRole; }

/** Custom-mode session character choices. T03's `buildCustomCharacter` consumes this;
 * optional fields left undefined fall back to its defaults (role 'dd', itemLevel = level,
 * auto skill kit, seeded talent/gear variety). */
export interface PvpCustomBuild {
  classId: WowClassId; raceId: WowRaceId; level: number; look: CharacterLook;
  role?: PvpRole; skills?: WowSkillId[]; itemLevel?: number; seed?: number;
  /** Item-picker choices: slot → candidate seed (pvp-chargen.pvpGearOptions).
   * Absent slots auto-roll with the role loadout. */
  gear?: Partial<Record<EquipmentSlot, number>>;
}
export interface PvpSetup {
  mode: PvpMode;
  bracket: PvpBracket;
  /** Player's NPC teammates — `pvpTeamSize(bracket) - 1` entries. */
  teammates: readonly PvpTeammate[];
  custom: PvpCustomBuild | null;
}

export type PvpWizardStep = 'mode' | 'bracket' | 'team' | 'review';
export const PVP_WIZARD_STEPS: readonly PvpWizardStep[] = Object.freeze(['mode', 'bracket', 'team', 'review']);

export interface PvpSetupDraft {
  step: PvpWizardStep;
  mode: PvpMode;
  bracket: PvpBracket;
  teammates: PvpTeammate[];
  custom: PvpCustomBuild | null;
}

/** Custom level band — WotLK bracket feel without letting a level-1 sheet queue. */
export const PVP_LEVEL_MIN = 10;
export const PVP_LEVEL_MAX = 80;

export function pvpTeamSize(bracket: PvpBracket): number {
  const bg = PVP_BATTLEGROUNDS.find(def => def.id === bracket);
  return bg ? bg.teamSize : Number(bracket[0]);
}
export function isPvpArenaBracket(bracket: PvpBracket): bracket is PvpArenaBracket {
  return (PVP_ARENA_BRACKETS as readonly string[]).includes(bracket);
}
export function pvpBracketLabel(bracket: PvpBracket): string {
  return isPvpArenaBracket(bracket) ? bracket : PVP_BATTLEGROUNDS.find(def => def.id === bracket)?.name ?? bracket;
}

/** Class roles (WOW_CLASSES) projected onto the PvP direction, in the class's own order. */
export function pvpClassRoles(classId: WowClassId): readonly PvpRole[] {
  const roles = WOW_CLASSES[classId].roles.map(role => role === 'Healing' ? 'heal' as const : role === 'Tank' ? 'tank' as const : 'dd' as const);
  return roles.filter((role, i) => roles.indexOf(role) === i);
}
export function pvpRoleLabel(role: PvpRole): string { return role === 'heal' ? 'Healer' : role === 'tank' ? 'Tank' : 'Damage'; }

/** Deterministic teammate suggestions: healer first, then a tank where the class roster
 * allows, then damage. Seeded per slot so re-rolls stay stable across renders. */
const SUGGESTED: readonly (readonly [WowClassId, PvpRole])[] = [
  ['priest', 'heal'], ['paladin', 'tank'], ['mage', 'dd'], ['warrior', 'dd'], ['druid', 'heal'],
  ['shaman', 'dd'], ['rogue', 'dd'], ['warlock', 'dd'], ['hunter', 'dd'], ['deathKnight', 'tank'],
];
export function suggestTeammate(index: number): PvpTeammate {
  const [classId, role] = SUGGESTED[index % SUGGESTED.length];
  return { classId, role };
}

export function createPvpDraft(): PvpSetupDraft {
  const bracket: PvpBracket = '3v3';
  return { step: 'mode', mode: 'arena', bracket, teammates: suggestedTeam(bracket), custom: null };
}
function suggestedTeam(bracket: PvpBracket): PvpTeammate[] {
  return Array.from({ length: pvpTeamSize(bracket) - 1 }, (_, i) => suggestTeammate(i));
}

/** Switching mode resets the bracket to that mode's default and re-sizes the roster. */
export function setPvpMode(draft: PvpSetupDraft, mode: PvpMode): void {
  if (draft.mode === mode) return;
  draft.mode = mode;
  setPvpBracket(draft, mode === 'arena' ? '3v3' : PVP_BATTLEGROUNDS[0].id);
}
/** Resize the roster to the new bracket, keeping picks that still fit. */
export function setPvpBracket(draft: PvpSetupDraft, bracket: PvpBracket): void {
  draft.bracket = bracket;
  const size = pvpTeamSize(bracket) - 1;
  while (draft.teammates.length < size) draft.teammates.push(suggestTeammate(draft.teammates.length));
  draft.teammates.length = size;
}
export function setTeammateClass(draft: PvpSetupDraft, index: number, classId: WowClassId): void {
  const slot = draft.teammates[index];
  if (!slot) return;
  slot.classId = classId;
  if (!pvpClassRoles(classId).includes(slot.role)) slot.role = pvpClassRoles(classId)[0];
}
export function setTeammateRole(draft: PvpSetupDraft, index: number, role: PvpRole): void {
  const slot = draft.teammates[index];
  if (slot && pvpClassRoles(slot.classId).includes(role)) slot.role = role;
}

export function createCustomBuild(classId: WowClassId = 'warrior', raceId: WowRaceId = 'human'): PvpCustomBuild {
  return { classId, raceId, level: PVP_LEVEL_MAX, look: createRaceLook(raceId), role: 'dd' };
}
/** Class/race pairs stay legal: an incompatible pick clears the other side, like the
 * title-screen forge. */
export function setCustomClass(custom: PvpCustomBuild, classId: WowClassId): void {
  custom.classId = classId;
  delete custom.gear; // gear picks are class-scoped; a new class re-rolls them
  if (!raceAllowsClass(custom.raceId, classId)) custom.raceId = WOW_RACE_IDS.find(race => raceAllowsClass(race, classId))!;
}
export function setCustomRace(custom: PvpCustomBuild, raceId: WowRaceId): void {
  if (!raceAllowsClass(raceId, custom.classId)) return;
  custom.raceId = raceId;
}

/** A draft is enterable when every teammate pick is legal and either a loaded character
 * or a complete custom build is present. */
export function validPvpSetup(draft: PvpSetupDraft, hasCharacter: boolean): PvpSetup | null {
  if (draft.teammates.length !== pvpTeamSize(draft.bracket) - 1) return null;
  if (!draft.teammates.every(t => WOW_CLASS_IDS.includes(t.classId) && pvpClassRoles(t.classId).includes(t.role))) return null;
  if (draft.custom) {
    const { classId, raceId, level, gear } = draft.custom;
    if (!raceAllowsClass(raceId, classId) || level < PVP_LEVEL_MIN || level > PVP_LEVEL_MAX) return null;
    if (gear && !Object.values(gear).every(seed => seed === undefined || Number.isInteger(seed))) return null;
  } else if (!hasCharacter) return null;
  return { mode: draft.mode, bracket: draft.bracket, teammates: draft.teammates.map(t => ({ ...t })), custom: draft.custom };
}
