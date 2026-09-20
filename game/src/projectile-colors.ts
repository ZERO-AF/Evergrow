import { RADIANT_COLORS } from './radiant-content.ts';
import type { Projectile, ProjectileStyle } from './model.ts';

/** Shared projectile palette; kept headless so warning logic can read colors. */
export const PROJECTILE_COLORS: Readonly<Record<ProjectileStyle, string>> = Object.freeze({
  arrow: '#bdcca9', fire: '#ff803c', frost: '#8ee7ff', lightning: '#b7afff', arcane: '#a894ec', spirit: '#83dfb1', radiant: RADIANT_COLORS.light,
  holy: '#ffd76e', shadow: '#8a6fb8', nature: '#7fd06a',
});
export const projectileStyle = (shot: Projectile): ProjectileStyle => shot.effects?.style ?? (shot.owner === 'enemy' ? 'spirit' : 'arcane');
