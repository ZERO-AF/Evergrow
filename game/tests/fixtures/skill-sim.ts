import type { SkillSimApi } from '../../src/skill-combat.ts';

/** Minimal SkillSimApi for direct activateSkill harnesses: WoW mechanics (DoTs, CC,
 * buffs, summons, runes, heals, targeting) are no-ops that always permit the cast;
 * combo points accumulate so spenders read a real count. */
export function skillSimStub(): SkillSimApi {
  let combo = 0;
  return {
    applyDot: () => {},
    applyCc: () => {},
    addBuff: () => {},
    summonAlly: () => {},
    tameBeast: () => 'untameable',
    petAlly: () => undefined,
    healAlly: () => {},
    summonActivePet: () => false,
    addComboPoint: () => { combo = Math.min(5, combo + 1); },
    spendComboPoints: () => { const points = combo; combo = 0; return points; },
    spendRuneCost: () => true,
    addRunicPower: () => {},
    playerHeal: () => {},
    setTarget: () => {},
    tabTarget: () => {},
  };
}
