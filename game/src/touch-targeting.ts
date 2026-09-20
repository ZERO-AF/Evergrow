import type { SkillExecution } from './skill-execution-content.ts';
import type { TouchTargeting } from './touch-input.ts';

/** Presentation classification follows the resolved recipe, including specializations. */
export function touchTargeting(recipe: SkillExecution): TouchTargeting {
  switch (recipe.kind) {
    case 'ground': return recipe.follow || recipe.effect === 'frost' ? 'self' : 'ground';
    case 'radial': return recipe.targetRange?'ground':'self';
    case 'aura': case 'ward': case 'stance': case 'guard': return 'self';
    case 'sweep': case 'cone': case 'backstab': return recipe.arc >= Math.PI * 1.9 ? 'self' : 'direction';
    case 'step':
    case 'dash': case 'projectile': case 'chain': return 'direction';
    // WoW kinds: strikes ride the weapon direction; dots/cc/pulls aim at a target;
    // heals/buffs/forms/stealth/summons/cleanses are self-cast.
    case 'strike': case 'comboStrike': case 'runeStrike': case 'interrupt': case 'taunt': case 'tame':
    case 'dot': case 'cc': case 'pull': case 'channel': return 'direction';
    case 'heal': case 'hot': case 'buff': case 'form': case 'stealth': case 'summon':
    case 'cleanse': return 'self';
  }
}
