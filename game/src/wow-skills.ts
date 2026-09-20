import type { WowSkill } from './skill-execution-content.ts';
import { WARRIOR_SKILLS } from './wow-skills-warrior.ts';
import { PALADIN_SKILLS } from './wow-skills-paladin.ts';
import { HUNTER_SKILLS } from './wow-skills-hunter.ts';
import { ROGUE_SKILLS } from './wow-skills-rogue.ts';
import { PRIEST_SKILLS } from './wow-skills-priest.ts';
import { DEATHKNIGHT_SKILLS } from './wow-skills-deathknight.ts';
import { SHAMAN_SKILLS } from './wow-skills-shaman.ts';
import { MAGE_SKILLS } from './wow-skills-mage.ts';
import { WARLOCK_SKILLS } from './wow-skills-warlock.ts';
import { DRUID_SKILLS } from './wow-skills-druid.ts';
import { RACIAL_SKILLS } from './wow-skills-racial.ts';
import type { WowClassId, WowRaceId } from './wow-types.ts';

/** Every authored WoW skill (class kits + racial actives). */
export const WOW_SKILLS: readonly WowSkill[] = Object.freeze([
  ...WARRIOR_SKILLS, ...PALADIN_SKILLS, ...HUNTER_SKILLS, ...ROGUE_SKILLS, ...PRIEST_SKILLS,
  ...DEATHKNIGHT_SKILLS, ...SHAMAN_SKILLS, ...MAGE_SKILLS, ...WARLOCK_SKILLS, ...DRUID_SKILLS,
  ...RACIAL_SKILLS,
]);

/** Class kit lookup for the talent atlas and creation UI. */
export const WOW_CLASS_SKILLS: Readonly<Record<WowClassId, readonly WowSkill[]>> = Object.freeze({
  warrior: WARRIOR_SKILLS, paladin: PALADIN_SKILLS, hunter: HUNTER_SKILLS, rogue: ROGUE_SKILLS,
  priest: PRIEST_SKILLS, deathKnight: DEATHKNIGHT_SKILLS, shaman: SHAMAN_SKILLS, mage: MAGE_SKILLS,
  warlock: WARLOCK_SKILLS, druid: DRUID_SKILLS,
});

/** Racial active per race. */
export const WOW_RACIAL_SKILLS: Readonly<Record<WowRaceId, WowSkill>> = Object.freeze(
  Object.fromEntries(RACIAL_SKILLS.map((s) => [s.raceId!, s])) as Record<WowRaceId, WowSkill>,
);
