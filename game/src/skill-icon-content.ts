import type { SkillId } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { SKILL_EXECUTION } from './skill-execution-content.ts';

/** A 64-unit glass emblem, composed from silhouettes, inset facets and sparse engraving. */
export type SkillIconMaterial = 'steel' | 'gold' | 'fire' | 'ice' | 'jade' | 'violet' | 'rose' | 'dark';
export interface IconMaterial {
  readonly light: string; readonly face: string; readonly shade: string; readonly edge: string;
}
export const ICON_MATERIALS: Readonly<Record<SkillIconMaterial, IconMaterial>> = Object.freeze({
  steel: { light: '#eeffff', face: '#9edfe5', shade: '#25466d', edge: '#d4e7e8' },
  gold: { light: '#fff3bd', face: '#efb939', shade: '#864021', edge: '#ffd982' },
  fire: { light: '#fff4c9', face: '#ff9a28', shade: '#a51e37', edge: '#ffc176' },
  ice: { light: '#dcffff', face: '#39dbf5', shade: '#2346a2', edge: '#95f4ff' },
  jade: { light: '#dcffd9', face: '#48dca3', shade: '#175762', edge: '#a1f5c5' },
  violet: { light: '#f4e3ff', face: '#bd83fb', shade: '#452282', edge: '#dec2ff' },
  rose: { light: '#ffe1f1', face: '#f781be', shade: '#752060', edge: '#ffbdda' },
  dark: { light: '#8cb0c2', face: '#294d64', shade: '#101c31', edge: '#637785' },
});
export interface IconPart {
  readonly path: string;
  readonly material: SkillIconMaterial;
  readonly kind: 'body' | 'facet' | 'cut';
  readonly transform?: readonly [number, number, number, number, number, number];
  readonly opacity?: number;
  /** Engraving is absent below 40 CSS pixels. Silhouettes and facets always survive. */
  readonly detail?: boolean;
}
const body = (path: string, material: SkillIconMaterial = 'steel'): IconPart => ({ path, material, kind: 'body' });
const facet = (path: string, material: SkillIconMaterial): IconPart => ({ path, material, kind: 'facet' });
const cut = (path: string, material: SkillIconMaterial = 'steel'): IconPart => ({ path, material, kind: 'cut', detail: true });
function place(parts: readonly IconPart[], x: number, y: number, angle = 0, scale = 1, opacity = 1): IconPart[] {
  const a = angle * Math.PI / 180, c = Math.cos(a) * scale, s = Math.sin(a) * scale;
  return parts.map(p => ({ ...p, transform: [c, s, -s, c, x, y], opacity }));
}
function blade(material: SkillIconMaterial = 'steel'): IconPart[] {
  return [body('M-4 9V-15L0-25 4-15V9Z', material), facet('M0-23 3-14V8H0Z', 'dark'),
    body('M-10 8-8 5-3 7H3L8 5 10 8 7 11H-7Z', 'gold'),
    body('M-2 11H2V21H-2Z', 'dark'), body('M0 20 4 23 0 26-4 23Z', 'gold'), cut('M-2-12V5', material)];
}
function shield(material: SkillIconMaterial = 'steel'): IconPart[] {
  return [body('M0-24 18-17 16 6Q12 17 0 25-12 17-16 6L-18-17Z', material),
    body('M0-18 12-13 10 5Q7 13 0 18-7 13-10 5L-12-13Z', 'dark'),
    facet('M0-17 4-10 3 8 0 16-3 8-4-10Z', material), cut('M-14-12-12 4Q-9 12-3 17', material)];
}
function arrow(material: SkillIconMaterial = 'jade'): IconPart[] {
  return [body('M-2 20V-8H-7L0-24 7-8H2V20Z', material),
    facet('M0-22 5-10H0Z', 'steel'), body('M-2 12-7 7V16L-2 21ZM2 12 7 7V16L2 21Z', 'gold')];
}
function crystal(material: SkillIconMaterial = 'ice'): IconPart[] {
  return [body('M0-23 9-5 5 12 0 23-6 10-9-5Z', material),
    facet('M0-21 0 21-5 8-7-5Z', material), facet('M0-21 7-5 2 1Z', 'steel'),
    facet('M2 1 7-5 4 11 0 21Z', 'dark')];
}
function bow(material: SkillIconMaterial = 'gold'): IconPart[] {
  return [body('M-9-25Q26 0-9 25L-5 18Q15 0-5-18Z', material),
    body('M-8-22-5-22 2 0-5 22-8 22-1 0Z', 'steel'), body('M4-5H10V5H4Z', 'dark')];
}
function boot(): IconPart[] {
  return [body('M-10-22 8-20 5-4 9 4 21 10 24 16 20 20H-16L-18 12-11 3Z'),
    facet('M-7-17 3-16 0-4-6 4-12 9-9-1Z', 'steel'),
    body('M-17 13-8 10 7 12 21 14 20 18H-15Z', 'dark'), cut('M-8-13 2-12M-8-8 1-7M-5 5 5 7')];
}
const ring = (material: SkillIconMaterial, path = 'M32 5A27 27 0 1 1 5 32L10 34A22 22 0 1 0 32 10Z') => body(path, material);
const lightning = (material: SkillIconMaterial = 'violet') => body('M38 3 12 35 29 31 23 61 52 24 35 29Z', material);
const flame = (): IconPart[] => [
  body('M55 5C39 6 39 22 27 23L29 13C20 19 17 25 17 29L13 24C1 40 9 57 25 58 43 59 46 44 45 33L38 39C39 23 48 21 55 5Z', 'fire'),
  facet('M43 17C31 28 39 31 29 40L28 30C14 39 15 51 26 53 38 54 39 44 37 37L32 43C32 31 40 27 43 17Z', 'gold'),
  facet('M26 39C18 47 23 53 29 49L31 43 27 46Z', 'steel'), cut('M12 38C8 48 17 57 28 55', 'fire')];

// ---- WoW motif library: local-space silhouettes (centered on 0,0) composed via place() ----
const zap = (m: SkillIconMaterial = 'violet'): IconPart[] => [
  body('M7-24-9 3-1 1-7 24 11-5 3-2Z', m), facet('M5-19-4 2 0 0-4 17 6-4 1-1Z', m)];
const bolt = (m: SkillIconMaterial = 'ice'): IconPart[] => [
  body('M-2 18-5-6 0-24 5-6 2 14Z', m), facet('M0-20 3-7 1 10-1 4Z', m)];
const orb = (m: SkillIconMaterial): IconPart[] => [
  body('M0-15A15 15 0 1 0 0 15 15 15 0 1 0 0-15Z', m), facet('M-9-6A6 6 0 0 1 3-10L1-3A5 5 0 0 0-9-6Z', m)];
const drop = (m: SkillIconMaterial = 'rose'): IconPart[] => [
  body('M0-22C-4-12-12-4-12 6A12 12 0 0 0 12 6C12-4 4-12 0-22Z', m),
  facet('M-5 0A7 8 0 0 0 4 9L6 3C4-2 0-6-1-9Z', m)];
const heart = (m: SkillIconMaterial = 'rose'): IconPart[] => [
  body('M0 20C-16 8-22-2-16-10-10-16-2-13 0-6 2-13 10-16 16-10 22-2 16 8 0 20Z', m),
  facet('M-13-7C-9-12-3-11-2-7-6-6-9-4-10 0Z', m)];
const cross = (m: SkillIconMaterial = 'gold'): IconPart[] => [
  body('M-5-22H5V-5H22V5H5V22H-5V5H-22V-5H-5Z', m),
  facet('M-3-19H3V-3H19V3H3V19H-3V3H-19V-3H-3Z', 'dark')];
const star = (m: SkillIconMaterial = 'gold'): IconPart[] => [
  body('M0-24 6-6 24 0 6 6 0 24-6 6-24 0-6-6Z', m), facet('M0-15 4-4 15 0 4 4 0 15-4 4-15 0-4-4Z', m)];
const moon = (m: SkillIconMaterial = 'ice'): IconPart[] => [
  body('M10-20A22 22 0 1 0 10 20 17 17 0 1 1 10-20Z', m), facet('M4-13A14 14 0 0 0 4 13 11 11 0 0 1 4-13Z', m)];
const skull = (m: SkillIconMaterial = 'steel'): IconPart[] => [
  body('M0-20C-13-20-18-10-18 0-18 7-14 11-10 13V20H-6V15H-2V20H2V15H6V20H10V13C14 11 18 7 18 0 18-10 13-20 0-20Z', m),
  body('M-11-2A5 5 0 1 0-1-2 5 5 0 1 0-11-2Z', 'dark'), body('M1-2A5 5 0 1 0 11-2 5 5 0 1 0 1-2Z', 'dark'),
  body('M-2 6 0 11 2 6Z', 'dark')];
const paw = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M0-2C-9-2-15 4-15 11-15 18-8 22 0 22 8 22 15 18 15 11 15 4 9-2 0-2Z', m),
  body('M-18-14A5 6 0 1 0-8-14 5 6 0 1 0-18-14Z', m), body('M-9-19A5 6 0 1 0 1-19 5 6 0 1 0-9-19Z', m),
  body('M-1-19A5 6 0 1 0 9-19 5 6 0 1 0-1-19Z', m), body('M8-14A5 6 0 1 0 18-14 5 6 0 1 0 8-14Z', m)];
const clawMarks = (m: SkillIconMaterial = 'rose'): IconPart[] => [
  body('M-20-22-13-22-1 22-8 22Z', m), body('M-6-22 1-22 13 22 6 22Z', m), body('M8-22 15-22 24 6 20 12Z', m)];
const leaf = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M0-22C14-14 16 4 0 22-16 4-14-14 0-22Z', m), cut('M0-17V17M0-4-7-9M0 3 7-2', m)];
const vine = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-3 22C-11 10 9 4 3-8-1-15-9-13-7-21L-1-19C-5-13 5-13 9-5 15 5-3 10 3 22Z', m),
  body('M3-8C9-12 15-10 17-4 11-2 5-4 3-8Z', m), body('M-1 8C-7 6-11 8-13 14-7 16-2 13-1 8Z', m)];
const halo = (m: SkillIconMaterial): IconPart[] => [
  body('M0-24A24 24 0 1 0 0 24 24 24 0 1 0 0-24ZM0-18A18 18 0 1 1 0 18 18 18 0 1 1 0-18Z', m)];
const swirl = (m: SkillIconMaterial = 'violet'): IconPart[] => [
  body('M0-22A22 22 0 1 0 22 0L14 0A14 14 0 1 1 0-14Z', m), body('M13-6 26 0 12 8Z', m)];
const wings = (m: SkillIconMaterial = 'gold'): IconPart[] => [
  body('M-2 10C-4-6-14-18-26-20-20-10-20-4-24 0-16 0-12 4-12 10Z', m),
  body('M2 10C4-6 14-18 26-20 20-10 20-4 24 0 16 0 12 4 12 10Z', m), body('M-3 6H3V18H-3Z', m)];
const horns = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-3 10C-12 6-19-4-17-20-11-12-5-8 1-8-1-2-2 5-3 10Z', m),
  body('M3 10C12 6 19-4 17-20 11-12 5-8-1-8 1-2 2 5 3 10Z', m)];
const eye = (m: SkillIconMaterial = 'gold'): IconPart[] => [
  body('M-24 0Q0-18 24 0 0 18-24 0Z', m), body('M-8 0A8 8 0 1 0 8 0 8 8 0 1 0-8 0Z', 'dark'),
  facet('M-5-5A4 4 0 0 1 2-6L0-2Z', m)];
const shout = (m: SkillIconMaterial = 'gold'): IconPart[] => [
  body('M-14-5A7 7 0 0 1-14 5L-17 8A11 11 0 0 0-17-8Z', m),
  body('M-6-10A14 14 0 0 1-6 10L-10 14A20 20 0 0 0-10-14Z', m),
  body('M2-15A21 21 0 0 1 2 15L-2 19A27 27 0 0 0-2-19Z', m)];
const trap = (m: SkillIconMaterial = 'steel'): IconPart[] => [
  body('M-20-3A20 20 0 0 1 20-3L15 2A15 15 0 0 0-15 2Z', m),
  body('M-20 3A20 20 0 0 0 20 3L15-2A15 15 0 0 1-15-2Z', m),
  body('M-14-9-10-2-6-9ZM-2-11 2-4 6-11ZM10-9 14-2 18-9Z', m),
  body('M-14 9-10 2-6 9ZM-2 11 2 4 6 11ZM10 9 14 2 18 9Z', m)];
const feather = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-4 20C-14 4-8-14 12-22 16-8 10 8-4 20Z', m), cut('M-2 16 10-18M0 8-6 4M3 1 9-3', m)];
const rune = (m: SkillIconMaterial = 'violet'): IconPart[] => [
  body('M0-22 16 0 0 22-16 0Z', m), body('M0-15 10 0 0 15-10 0Z', 'dark'), cut('M-4-6 1 0-4 6M1 0 7-7M1 0V9', m)];
const totem = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-9-22H9L7-8H-7Z', m), body('M-7-7H7L9 6H-9Z', m), body('M-9 7H9L11 22H-11Z', m),
  cut('M-4-17H4M-3-1H3M-4 13H4', 'dark')];
const wolfHead = (m: SkillIconMaterial = 'steel'): IconPart[] => [
  body('M-13-14-17-24-7-19 0-21 7-19 17-24 13-14 18-6 12 4 6 8 4 20-4 20-6 8-12 4-18-6Z', m),
  body('M-8-5-3-4-7 0Z', 'dark'), body('M8-5 3-4 7 0Z', 'dark'), body('M-3 12 0 16 3 12Z', 'dark')];
const bearHead = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-15-10A8 8 0 0 1-7-19 16 16 0 0 1 7-19 8 8 0 0 1 15-10C20-2 18 8 12 14 8 19-8 19-12 14-18 8-20-2-15-10Z', m),
  body('M-7 3A7 6 0 0 0 7 3 7 7 0 0 1 7 12 7 5 0 0 1-7 12 7 7 0 0 1-7 3Z', m),
  body('M-9-5-4-4-8 0Z', 'dark'), body('M9-5 4-4 8 0Z', 'dark'), body('M-3 5 0 8 3 5Z', 'dark')];
const catHead = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-15-3-17-22-6-12 0-14 6-12 17-22 15-3C19 8 12 18 0 18-12 18-19 8-15-3Z', m),
  body('M-10-2-4-1-9 3Z', 'dark'), body('M10-2 4-1 9 3Z', 'dark'), body('M-2 8 0 11 2 8Z', 'dark')];
const owlHead = (m: SkillIconMaterial = 'violet'): IconPart[] => [
  body('M-15-11-19-22-9-16 0-18 9-16 19-22 15-11C21 2 14 18 0 18-14 18-21 2-15-11Z', m),
  body('M-12-4A6 6 0 1 0 0-4 6 6 0 1 0-12-4Z', 'gold'), body('M0-4A6 6 0 1 0 12-4 6 6 0 1 0 0-4Z', 'gold'),
  body('M-9-4A3 3 0 1 0-3-4 3 3 0 1 0-9-4Z', 'dark'), body('M3-4A3 3 0 1 0 9-4 3 3 0 1 0 3-4Z', 'dark'),
  body('M-2 3 0 8 2 3Z', 'gold')];
const sheepHead = (m: SkillIconMaterial = 'violet'): IconPart[] => [
  body('M-14-8C-20-14-12-22-6-18-4-24 6-24 8-18 14-22 20-14 14-8 18-2 14 4 8 2 6 10-6 10-8 2-14 4-18-2-14-8Z', m),
  body('M-8 0C-10 8-6 16 0 16 6 16 10 8 8 0 4 4-4 4-8 0Z', 'dark'), body('M-5 6-3 4-2 7ZM5 6 3 4 2 7Z', m)];
const impHead = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-11-7-15-21-5-12 0-14 5-12 15-21 11-7C15 3 10 14 0 14-10 14-15 3-11-7Z', m),
  body('M-7-4-2-3-6 1Z', 'dark'), body('M7-4 2-3 6 1Z', 'dark'), body('M-4 8 0 5 4 8 0 10Z', 'dark')];
const demonHead = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-9-5C-17-9-21-17-19-25-13-17-9-15-5-15 0-17 0-17 5-15 9-15 13-17 19-25 21-17 17-9 9-5 13 3 9 14 0 16-9 14-13 3-9-5Z', m),
  body('M-6-3-1-2-5 2Z', 'fire'), body('M6-3 1-2 5 2Z', 'fire'), body('M-3 9 0 12 3 9Z', 'dark')];
const snowflake = (m: SkillIconMaterial = 'ice'): IconPart[] => [
  body('M0-24 5-8 21-12 8 0 21 12 5 8 0 24-5 8-21 12-8 0-21-12-5-8Z', m),
  facet('M0-14 3-5 12-7 5 0 12 7 3 5 0 14-3 5-12 7-5 0-12-7-3-5Z', m)];
const crown = (m: SkillIconMaterial = 'gold'): IconPart[] => [
  body('M-18 12-20-10-10 2 0-16 10 2 20-10 18 12Z', m), body('M-18 14H18V20H-18Z', m),
  facet('M-4 4 0-3 4 4 0 10Z', 'rose')];
const hood = (m: SkillIconMaterial = 'dark'): IconPart[] => [
  body('M0-22C-14-22-20-8-18 8L-13 22H13L18 8C20-8 14-22 0-22Z', m),
  body('M-8-3A8 9 0 1 0 8-3 8 9 0 1 0-8-3Z', 'violet'),
  body('M-6-5-2-4-5-1Z', 'gold'), body('M6-5 2-4 5-1Z', 'gold')];
const ghost = (m: SkillIconMaterial = 'violet'): IconPart[] => [
  body('M0-20C-12-20-16-10-16 0V18L-10 14-5 20 0 15 5 20 10 14 16 18V0C16-10 12-20 0-20Z', m),
  body('M-9-6A3 4 0 1 0-3-6 3 4 0 1 0-9-6Z', 'dark'), body('M3-6A3 4 0 1 0 9-6 3 4 0 1 0 9-6Z', 'dark'),
  body('M-3 3A3 4 0 1 0 3 3 3 4 0 1 0-3 3Z', 'dark')];
const beam = (m: SkillIconMaterial = 'gold'): IconPart[] => [
  body('M-6-24H6L3 24H-3Z', m), facet('M-2-22H2L1 22H-1Z', m)];
const tornado = (m: SkillIconMaterial = 'ice'): IconPart[] => [
  body('M-22-16A22 7 0 0 0 22-16L18-8A16 5 0 0 1-18-8Z', m),
  body('M-16-3A16 6 0 0 0 16-3L12 4A10 4 0 0 1-12 4Z', m),
  body('M-10 8A10 4 0 0 0 10 8L4 22A5 6 0 0 1-4 22Z', m)];
const serpent = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-13 18C-19 8-7 4-5-2-3-8-11-10-7-18L-1-16C-7-12 3-8 1-1-1 8-11 8-7 18Z', m),
  body('M-7-18-13-24-3-22Z', m), body('M3 9C9 7 15 9 17 15 11 17 5 15 3 9Z', m)];
const target = (m: SkillIconMaterial = 'rose'): IconPart[] => [
  body('M-20 0A20 20 0 1 0 20 0 20 20 0 1 0-20 0ZM-14 0A14 14 0 1 1 14 0 14 14 0 1 1-14 0Z', m),
  body('M-7 0A7 7 0 1 0 7 0 7 7 0 1 0-7 0Z', m)];
const bomb = (m: SkillIconMaterial = 'dark'): IconPart[] => [
  body('M0-11A14 14 0 1 0 0 17 14 14 0 1 0 0-11Z', m),
  body('M-3-16H5V-11H-3Z', 'steel'), body('M4-18 10-24 12-21 7-16Z', 'gold'), body('M10-26 13-23 16-26 14-21Z', 'fire')];
const hook = (m: SkillIconMaterial = 'dark'): IconPart[] => [
  body('M-2-24H3V6A9 9 0 0 1-15 6L-15 0-9 0-9 6A4 4 0 0 0-2 6Z', m), body('M-15-2-19 5-11 4Z', m)];
const grasp = (m: SkillIconMaterial = 'dark'): IconPart[] => [
  body('M-13 22C-15 8-11-2-3-6L-7-18-1-16 1-4 3-20 9-19 7-5 13-16 18-13 11-2C17 2 16 12 12 22Z', m)];
const handRise = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-9 22V2C-9-4-5-6-3-2V-14C-3-18 1-18 1-14V-3 3-16 5-16 5-12V-2 7-11 9-11 9-7V3C9 12 6 20 2 22Z', m)];
const fangs = (m: SkillIconMaterial = 'steel'): IconPart[] => [
  body('M-15-8C-8-13 8-13 15-8 13 0 9 2 7-2 5 8 3 14 0 16-3 14-5 8-7-2-9 2-13 0-15-8Z', m),
  body('M-11-6-8 9-5-4ZM11-6 8 9 5-4Z', m)];
const seedPod = (m: SkillIconMaterial = 'violet'): IconPart[] => [
  body('M0-14C-10-10-14-1-10 8-6 18 6 18 10 8 14-1 10-10 0-14Z', m),
  body('M0-14C-2-21 2-25 8-25 8-19 4-15 0-14Z', 'jade'), facet('M-5-3A5 6 0 0 0 3 7L5 1C3-3 0-5-1-7Z', m)];
const meteorRock = (m: SkillIconMaterial = 'fire'): IconPart[] => [
  body('M-14-6C-16-14-6-20 2-18 12-16 16-8 14 0 12 10 2 16-6 14-14 12-18 2-14-6Z', 'dark'),
  facet('M-8-8C-6-13 0-15 5-13 0-9-2-6-3-2Z', m), facet('M2 2C6 0 9 2 10 6 6 8 2 7 0 5Z', m),
  body('M14-14 22-22 18-12Z', m), body('M16-4 26-8 18 2Z', m)];
const horn = (m: SkillIconMaterial = 'gold'): IconPart[] => [
  body('M-20 4C-12-2 2-8 20-14 18-4 10 4-2 8-10 10-16 10-20 4Z', m),
  body('M-22 2C-24 6-22 10-18 10-16 6-18 4-22 2Z', 'dark'), facet('M-14 2C-6-2 4-6 14-9 8-3 0 2-8 5Z', m)];
const brokenChain = (m: SkillIconMaterial = 'steel'): IconPart[] => [
  body('M-20-7A8 8 0 0 1-4-7L-6-2A4 4 0 0 0-18-2Z', m), body('M-20 7A8 8 0 0 0-4 7L-6 2A4 4 0 0 1-18 2Z', m),
  body('M4-7A8 8 0 0 1 20-7L18-2A4 4 0 0 0 6-2Z', m), body('M4 7A8 8 0 0 0 20 7L18 2A4 4 0 0 1 6 2Z', m),
  body('M-2-11 3-4-2 0 3 5-2 11-7 3-2-1-7-5Z', 'gold')];
const rock = (m: SkillIconMaterial = 'steel'): IconPart[] => [
  body('M-18 12-14-6-2-14 12-10 18 2 14 14-2 18Z', m),
  facet('M-12 8-9-4-1-9-4 2-8 10Z', m), facet('M2-8 10-6 13 2 6 0Z', 'dark')];
const hoof = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-10-14C-14-2-12 8-8 14L-2 12C-4 4-4-4-2-12Z', m), body('M10-14C14-2 12 8 8 14L2 12C4 4 4-4 2-12Z', m)];
const fist = (m: SkillIconMaterial = 'steel'): IconPart[] => [
  body('M-12-2C-12-10-6-14 0-14 8-14 12-8 12-2V8C12 16 6 20 0 20-8 20-12 14-12 8Z', m),
  cut('M-8-8-8 2M-3-11-3 1M2-11 2 1M7-8 7 2', 'dark')];
const ember = (m: SkillIconMaterial = 'fire'): IconPart[] => [
  body('M4-20C-4-14-10-6-8 4-6 14 2 20 8 16 16 10 14 0 8-4 10 2 6 6 2 4-2 0-2-8 4-20Z', m),
  facet('M2-8C-2-4-4 2-2 8 0 12 4 14 7 11 10 7 8 1 5-1 6 3 4 5 2 4 0 1 0-3 2-8Z', 'gold')];
const hands = (m: SkillIconMaterial = 'gold'): IconPart[] => [
  body('M-18 2C-16-6-8-10-2-8-8-2-10 4-8 12-14 12-18 8-18 2Z', m),
  body('M18 2C16-6 8-10 2-8 8-2 10 4 8 12 14 12 18 8 18 2Z', m), body('M-6 14H6V20H-6Z', m)];
const insect = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M0-6A6 8 0 1 0 0 10 6 8 0 1 0 0-6Z', m), body('M-3-12A3 4 0 1 0 3-12 3 4 0 1 0-3-12Z', m),
  body('M-5-5-13-11-11-7-4-2ZM5-5 13-11 11-7 4-2Z', m), cut('M-6 3-13 7M6 3 13 7M-5 9-10 15M5 9 10 15', m)];
const missile = (m: SkillIconMaterial = 'violet'): IconPart[] => [
  body('M0-20 5-6 2 14 0 20-2 14-5-6Z', m), facet('M0-16 3-6 0 10Z', m)];
const iceBlockShape = (m: SkillIconMaterial = 'ice'): IconPart[] => [
  body('M-14-18H14L18 14-14 18Z', m), facet('M-10-14H0L-4 12-12 10Z', m),
  facet('M2-14H10L14 10 0 12Z', 'dark'), cut('M-6-8 4-2M-2 4 8-2', m)];
const sunburst = (m: SkillIconMaterial = 'gold'): IconPart[] => [
  body('M0-24 3-8 17-17 8-3 24 0 8 3 17 17 3 8 0 24-3 8-17 17-8 3-24 0-8-3-17-17-3-8Z', m),
  body('M-7 0A7 7 0 1 0 7 0 7 7 0 1 0-7 0Z', m)];
const wave = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-22 2C-14-6-6-6 0 0 6 6 14 6 22 0L20 8C14 14 4 14-2 8-8 2-14 4-18 10Z', m)];
const link = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-17-5A8 8 0 0 1-1-5L-3 0A4 4 0 0 0-15 0Z', m), body('M-17 5A8 8 0 0 0-1 5L-3 0A4 4 0 0 1-15 0Z', m),
  body('M1-5A8 8 0 0 1 17-5L15 0A4 4 0 0 0 3 0Z', m), body('M1 5A8 8 0 0 0 17 5L15 0A4 4 0 0 1 3 0Z', m)];
const speedLines = (m: SkillIconMaterial = 'steel'): IconPart[] => [
  body('M-24-11-6-13-8-8-24-6Z', m), body('M-24-1-10-3-8 2-24 4Z', m), body('M-24 9-14 7-12 12-24 14Z', m)];
const cloud = (m: SkillIconMaterial = 'ice'): IconPart[] => [
  body('M-18 6C-22-2-14-10-6-8-4-16 8-16 10-8 18-10 22-2 18 6 14 10-14 10-18 6Z', m)];
const bark = (m: SkillIconMaterial = 'jade'): IconPart[] => [
  body('M-14-20H14L10 20H-10Z', m), cut('M-8-14-6 14M0-16-2 16M7-12 5 12', 'dark'),
  facet('M-11-16H-4L-6 14-10 12Z', m)];
const dagger = (m: SkillIconMaterial = 'steel'): IconPart[] => [
  body('M-3 8V-13L0-24 3-13V8Z', m), body('M-8 7-7 4H7L8 7 5 10H-5Z', 'gold'),
  body('M-2 10H2V18H-2Z', 'dark'), cut('M0-11V4', m)];
const axe = (m: SkillIconMaterial = 'steel'): IconPart[] => [
  body('M-2-24H2V24H-2Z', 'dark'), body('M2-20C14-19 20-10 18 2 12-4 8-6 2-6Z', m),
  facet('M4-17C12-15 15-9 14-3 10-7 7-8 4-9Z', m), body('M-4-24H4V-20H-4Z', 'gold')];
const hammer = (m: SkillIconMaterial = 'gold'): IconPart[] => [
  body('M-2-14H2V24H-2Z', 'dark'), body('M-13-24H13V-8H-13Z', m),
  facet('M-10-21H0V-11H-10Z', m), facet('M2-21H10V-11H2Z', 'dark')];
const dome = (m: SkillIconMaterial = 'ice'): IconPart[] => [
  body('M-20 12A20 20 0 0 1 20 12L16 17A16 16 0 0 0-16 17Z', m)];

const recipes: Partial<Record<SkillId, readonly IconPart[]>> = {
  ironroot: [...place(shield('jade'),32,27,0,.8),body('M30 34H34V45L48 54 34 49 32 58 30 49 16 54 30 45Z','gold')],
  bloodOath: [body('M32 5C29 18 16 27 16 37A16 16 0 0 0 48 37C48 26 36 17 32 5Z','rose'),facet('M32 16 28 36 34 43 38 35Z','gold')],
  hawkeye: [body('M4 31Q32 5 60 31Q32 55 4 31Z','gold'),body('M21 31A11 11 0 1 0 43 31A11 11 0 1 0 21 31Z','jade'),facet('M31 17 35 30 31 44 28 30Z','steel')],
  thornbound: [body('M12 48 19 24 9 17 25 21 32 5 36 24 53 16 45 32 58 43 40 41 32 59 27 41 8 48Z','jade'),body('M26 29 36 29 37 37 27 39Z','dark')],
  elementalResonance: [body('M32 5 43 24 32 34 21 24Z','fire'),body('M12 31 27 33 31 52 9 48Z','ice'),body('M41 31 55 31 55 48 34 53Z','violet')],
  stillwater: [body('M10 37Q32 29 54 37L49 44Q32 37 15 44ZM16 48Q32 42 48 48L44 54H20Z','ice'),body('M32 6Q17 23 23 30Q32 38 41 30Q47 23 32 6Z','steel')],
  elementalSpikes: [body('M8 49 14 15 24 46Z','fire'),body('M23 51 32 5 41 51Z','ice'),body('M40 46 51 15 57 49Z','violet'),facet('M8 52H57V57H8Z','gold')],
  fireball: flame(),
  shieldBash: [...place(shield(), 25, 30, -14, .88), body('M47 13 61 31 48 48 51 35 43 32 51 28Z', 'gold')],
  bulwark: [body('M8 12 18 8V35L13 44 7 34ZM56 12 46 8V35L51 44 57 34Z', 'steel'), ...place(shield(), 32, 31),
    facet('M32 14 37 22 35 40 32 48 29 40 27 22Z', 'ice')],
  repulse: [body('M7 13Q-2 32 7 51L11 46Q4 32 11 18ZM57 13Q66 32 57 51L53 46Q60 32 53 18Z', 'gold'),
    ...place(shield('gold'), 32, 31, 0, .83), body('M27 29H37V34H27Z', 'steel')],
  ironCitadel: [body('M6 54V20L12 11 19 20 25 14 32 5 39 14 45 20 52 11 58 20V54Z', 'steel'),
    body('M13 48V26H23V48ZM41 48V26H51V48Z', 'dark'), ...place(shield('gold'), 32, 37, 0, .64),
    facet('M8 21 12 16 16 22V49H10ZM48 22 52 16 56 21 54 49H48Z', 'steel')],
  brace: [body('M8 49 12 17 23 12 26 22 20 42 29 48 26 55 15 54ZM56 49 52 17 41 12 38 22 44 42 35 48 38 55 49 54Z'),
    body('M18 9Q32 0 46 9L44 15Q32 9 20 15Z', 'gold'), facet('M13 23 18 20 17 40 12 47ZM46 20 51 23 52 47 47 40Z', 'steel'),
    body('M27 29 32 24 37 29 32 35Z', 'gold')],
  rallyOfIron: [body('M15 5H20V57H15Z'), body('M21 7H56L45 20 53 33H21Z', 'gold'),
    facet('M23 10H48L38 19 45 27H23Z', 'fire'), body('M9 55 18 48 27 55 25 59H11Z'),
    body('M31 16 37 12 40 17 34 23Z', 'steel')],
  cleave: [body('M19 6C52 0 65 27 48 49L44 45C57 23 42 10 19 6Z', 'gold'),
    body('M33 8C49 13 55 27 48 39L46 34C49 21 42 15 33 8Z', 'fire'), ...place(blade(), 27, 34, 40, .94)],
  lunge: [body('M3 22 26 18 22 23 3 26ZM4 33 19 29 15 35 4 37ZM13 48 21 41 21 46 12 52Z', 'jade'), ...place(blade(), 35, 31, 43, 1.08)],
  whirlwind: [ring('gold'), body('M7 12 8 30 23 21Z', 'gold'), body('M57 52 56 34 41 43Z', 'gold'), ...place(blade(), 32, 32, 38, .76)],
  earthshatter: [body('M4 54 18 46 27 55 34 40 41 51 59 45 48 60 33 55 22 62Z', 'fire'),
    ...place([body('M-3-4H3V26H-3Z', 'gold'), body('M-17-21H15L18-15 14-2H-17L-20-8Z'),
      facet('M-16-18H12L13-11H-17Z', 'steel'), facet('M11-18 15-14 11-5 7-5Z', 'dark')], 31, 28, 35, .93)],
  backstab: [body('M43 10C57 15 60 29 54 44L48 48 49 36C52 24 48 18 40 16Z', 'rose'),
    ...place(blade(), 28, 32, 36, .95), body('M49 43 60 43 49 56 40 44Z', 'rose')],
  nightReaping: [body('M32 6C6 10-1 41 23 58L22 50C6 36 16 15 32 6Z', 'violet'),
    ...place(blade('jade'), 23, 30, -29, .77), ...place(blade('steel'), 41, 30, 29, .77),
    body('M32 40 39 49 32 61 25 49Z', 'rose')],
  sidestep: [...place(boot(), 40, 31, 8, .86, .3), body('M3 21 16 17 14 22 3 25ZM3 32 13 28 11 34 2 37Z', 'jade'),
    ...place(boot(), 27, 33, 8, .9)],
  smokeVeil: [body('M12 47C-1 42 0 27 13 24 7 8 29 2 36 14 49 4 60 18 53 29 67 37 54 54 43 49Z', 'dark'),
    facet('M7 31C5 19 20 20 24 30 12 22 10 35 18 38 6 39 4 34 7 31ZM32 17C45 9 53 23 43 29 48 21 40 15 32 22Z', 'steel'),
    body('M18 38Q32 23 48 38L43 47 22 47Z', 'jade'), facet('M24 39 30 38 28 41ZM36 38 42 39 38 41Z', 'dark'),
    cut('M12 54Q32 48 53 54', 'steel')],
  volley: [...place(arrow(), 17, 32, -27, .78), ...place(arrow(), 47, 32, 27, .78), ...place(arrow('steel'), 32, 31, 0, 1.02)],
  piercingShot: [body('M8 14 14 17 43 50 39 54ZM24 7 28 7 56 36 54 42Z', 'dark'),
    ...place(arrow('gold'), 32, 31, 44, 1.16), facet('M8 48 16 44 20 49 11 55Z', 'jade')],
  ricochet: [body('M5 51 19 15 39 38 48 15 53 17 41 49 21 27 10 54Z', 'jade'),
    body('M43 15 57 6 56 25 51 20Z', 'gold'), body('M16 20 21 14 26 20 21 26ZM34 42 39 36 44 42 39 48Z', 'steel')],
  rainOfArrows: [body('M4 54Q32 40 60 54L55 59Q32 49 9 59Z', 'jade'),
    ...place(arrow(), 13, 25, 180, .68), ...place(arrow('steel'), 32, 30, 180, .86), ...place(arrow(), 51, 24, 180, .68)],
  vaultingShot: [body('M26 48Q10 49 9 31L4 35 7 17 19 31 13 30Q14 42 29 42Z', 'jade'),
    ...place(bow(), 35, 29, 0, .92), ...place(arrow('steel'), 39, 29, 90, .67)],
  ghostHunt: [...place(bow('jade'), 45, 30, 0, .96, .32), ...place(bow('jade'), 22, 30, 0, .96),
    ...place(arrow('steel'), 33, 30, 90, 1.04), cut('M44 9 50 14M44 53 50 48', 'jade')],
  arcLightning: [lightning(), facet('M37 8 19 31 31 27 28 44 44 28 32 33Z', 'steel'),
    body('M8 11 19 18 14 21ZM49 43 59 50 48 48Z', 'gold')],
  tempest: [ring('violet'), body('M6 21 7 7 22 10ZM58 43 57 57 42 54Z', 'ice'),
    ...place([lightning(), facet('M38 6 18 32 31 28 28 47 43 30 32 34Z', 'steel')], 9, 8, 0, .74)],
  iceNova: Array.from({ length: 6 }, (_, i) => {
    const a = i * Math.PI / 3;
    return place(crystal(), 32 + Math.sin(a) * 18, 32 - Math.cos(a) * 18, i * 60, .49);
  }).flat(),
  frostLance: [body('M2 35 18 29 12 37ZM27 54 32 45 35 49 30 60Z', 'ice'), ...place(crystal(), 32, 31, 42, 1.19)],
  absoluteZero: [body('M6 34Q16 52 32 49 48 52 58 34L53 53 32 62 11 53Z', 'steel'),
    ...place(crystal(), 15, 35, -16, .56), ...place(crystal(), 49, 35, 16, .56), ...place(crystal(), 32, 28, 0, 1.06)],
  runicWard: [body('M32 3 56 16V45L32 61 8 45V16Z', 'jade'), body('M32 9 50 20V41L32 54 14 41V20Z', 'dark'),
    ...place(crystal('jade'), 32, 31, 0, .66), facet('M11 18 16 16 16 38 11 42ZM48 16 53 18V42L48 38Z', 'steel'),
    cut('M24 14 32 10 40 14M24 50 32 55 40 50', 'jade')],
  meteor: [body('M60 4 49 32 36 43 20 25Z', 'fire'), facet('M50 12 43 31 30 38 25 29Z', 'gold'),
    body('M21 24 36 28 42 42 34 55 20 58 8 49 6 35Z', 'dark'),
    facet('M21 27 31 31 28 39 14 41 10 35Z', 'fire'), facet('M30 41 37 35 38 44 30 52 21 54Z', 'gold'),
    body('M3 57 12 54 17 60 7 62ZM46 49 56 48 60 53 47 55Z', 'fire')],
  cataclysm: [body('M4 55 12 44 20 51 31 40 44 52 53 43 61 57 46 61 29 53 16 60Z', 'fire'),
    body('M37 2 36 22 28 38 18 29Z', 'fire'), body('M13 8 19 22 15 34 8 28Z', 'gold'), body('M61 9 53 34 45 40 39 29Z', 'gold'),
    body('M27 23 35 28 35 37 26 43 17 37 18 29Z', 'dark'), facet('M26 26 32 29 28 36 20 35Z', 'fire')],
  siphon: [body('M49 10C19-8-3 26 11 46 22 64 53 59 58 35 46 47 25 44 25 30 25 19 36 15 43 20L36 26 59 20 50 3Z', 'rose'),
    facet('M43 12C21 8 8 27 17 42 27 54 44 49 50 43 29 47 19 32 28 20Z', 'violet'),
    body('M36 36C29 26 21 35 27 42L36 50 45 42C51 35 43 26 36 36Z', 'gold')],
  // ---- Warrior ----
  heroicStrike: [...place(blade('gold'), 32, 32, 38, .95), ...place(star('gold'), 46, 18, 0, .5)],
  charge: [...place(blade('gold'), 38, 32, 90, .95), ...place(speedLines('gold'), 26, 32, 0, .9)],
  thunderClap: [...place(zap('gold'), 32, 30, 0, .9), ...place(halo('gold'), 32, 32, 0, .85)],
  hamstring: [...place(blade(), 30, 28, 40, .85), ...place(boot(), 40, 44, 15, .55)],
  overpower: [body('M10 12Q32 2 54 12L50 20Q32 12 14 20Z', 'gold'), ...place(blade('gold'), 32, 36, 0, .8)],
  execute: [...place(blade('rose'), 32, 34, 180, 1.05), body('M14 12 24 18 20 24 10 18ZM50 12 40 18 44 24 54 18Z', 'rose')],
  pummel: [...place(fist('gold'), 32, 32, 0, .95), ...place(star('gold'), 46, 16, 0, .45)],
  sunderArmor: [...place(shield('steel'), 30, 32, 0, .8), body('M40 8 36 22 44 30 38 44 48 38 44 26 50 18Z', 'gold')],
  battleShout: [...place(horn('gold'), 28, 34, 0, .9), ...place(shout('gold'), 44, 30, 0, .8)],
  berserkerRage: [...place(fist('rose'), 32, 34, 0, .9), ...place(shout('rose'), 32, 14, 90, .55)],
  shieldSlam: [...place(shield('gold'), 28, 32, -10, .85), ...place(star('gold'), 46, 30, 0, .6)],
  shieldBlock: [...place(shield('steel'), 32, 32, 0, .95), ...place(halo('gold'), 32, 32, 0, .9)],
  revenge: [...place(shield('steel'), 24, 34, -12, .7), ...place(blade('gold'), 42, 30, 40, .85)],
  shieldWall: [...place(shield('steel'), 32, 32, 0, 1.05), ...place(shield('gold'), 32, 32, 0, .7)],
  mortalStrike: [...place(blade('rose'), 32, 32, 40, .95), ...place(clawMarks('rose'), 32, 32, 0, .5)],
  bloodthirst: [...place(fangs('rose'), 32, 30, 0, .9), ...place(drop('rose'), 32, 46, 0, .5)],
  bladestorm: [0, 90, 180, 270].flatMap(a => place(blade('gold'), 32 + Math.sin(a * Math.PI / 180) * 13, 32 - Math.cos(a * Math.PI / 180) * 13, a + 45, .62)),
  heroicLeap: [body('M8 46Q32 16 56 46L50 52Q32 30 14 52Z', 'gold'), ...place(boot(), 32, 30, 0, .8)],
  intimidatingShout: [...place(skull('gold'), 26, 32, 0, .7), ...place(shout('gold'), 44, 32, 0, .8)],
  sweepingStrikes: [...place(blade('gold'), 24, 32, 55, .8), ...place(blade('gold'), 40, 32, 15, .8)],
  // ---- Paladin ----
  crusaderStrike: [...place(blade('gold'), 32, 32, 38, .9), ...place(cross('gold'), 32, 32, 0, .45)],
  judgement: [...place(hammer('gold'), 32, 30, 30, .9), ...place(star('gold'), 46, 16, 0, .45)],
  sealOfCommand: [...place(rune('gold'), 32, 30, 0, .85), ...place(blade('gold'), 32, 36, 0, .6)],
  consecration: [...place(halo('gold'), 32, 36, 0, .95), ...place(cross('gold'), 32, 26, 0, .55), body('M12 50 22 44 32 52 42 44 52 50 48 56 32 58 16 56Z', 'gold')],
  hammerOfJustice: [...place(hammer('gold'), 32, 32, 0, .95), ...place(star('gold'), 32, 10, 0, .4)],
  holyLight: [...place(beam('gold'), 32, 32, 0, .95), ...place(cross('gold'), 32, 32, 0, .5)],
  flashOfLight: [...place(star('gold'), 32, 32, 0, .85), ...place(halo('gold'), 32, 32, 0, .6)],
  divineShield: [...place(halo('gold'), 32, 32, 0, 1), ...place(shield('gold'), 32, 32, 0, .75)],
  divineProtection: [...place(shield('gold'), 32, 34, 0, .8), ...place(wings('gold'), 32, 26, 0, .7)],
  layOnHands: [...place(hands('gold'), 32, 34, 0, .9), ...place(cross('gold'), 32, 14, 0, .5)],
  avengingWrath: [...place(wings('gold'), 32, 30, 0, 1), ...place(eye('gold'), 32, 34, 0, .5)],
  hammerOfWrath: [...place(hammer('gold'), 32, 32, 140, .95), ...place(halo('gold'), 32, 32, 0, .8)],
  exorcism: [...place(cross('gold'), 30, 32, 0, .8), ...place(zap('gold'), 42, 30, 0, .6)],
  holyShock: [...place(zap('gold'), 32, 30, 0, .9), ...place(orb('gold'), 32, 44, 0, .5)],
  repentance: [...place(eye('gold'), 32, 30, 0, .9), ...place(halo('gold'), 32, 30, 0, .8)],
  blessingOfKings: [...place(crown('gold'), 32, 32, 0, .95)],
  divineStorm: [0, 120, 240].flatMap(a => place(hammer('gold'), 32 + Math.sin(a * Math.PI / 180) * 11, 32 - Math.cos(a * Math.PI / 180) * 11, a + 30, .55)),
  holyShield: [...place(shield('gold'), 32, 32, 0, .9), ...place(cross('gold'), 32, 32, 0, .5)],
  // ---- Hunter ----
  arcaneShot: [...place(arrow('violet'), 32, 32, 45, 1)],
  aimedShot: [...place(target('rose'), 32, 32, 0, .9), ...place(arrow('jade'), 32, 32, 45, .9)],
  multiShot: [...place(arrow('jade'), 20, 34, 65, .8), ...place(arrow('jade'), 32, 30, 90, .8), ...place(arrow('jade'), 44, 34, 115, .8)],
  serpentSting: [...place(serpent('jade'), 32, 32, 0, .95)],
  concussiveShot: [...place(arrow('jade'), 32, 32, 45, .95), ...place(star('gold'), 44, 20, 0, .45)],
  scatterShot: [...place(arrow('jade'), 32, 34, 90, .7), ...place(sunburst('jade'), 32, 30, 0, .6)],
  freezingTrap: [...place(trap('ice'), 32, 34, 0, .9), ...place(snowflake('ice'), 32, 14, 0, .4)],
  disengage: [body('M10 44Q32 14 54 44L48 50Q32 28 16 50Z', 'jade'), ...place(boot(), 32, 30, 180, .75)],
  aspectHawk: [...place(feather('jade'), 30, 32, 20, .95), ...place(eye('jade'), 42, 24, 0, .45)],
  feignDeath: [...place(eye('jade'), 32, 34, 0, .9), cut('M12 20 52 48', 'dark')],
  callPet: [...place(paw('jade'), 32, 34, 0, .85), ...place(shout('jade'), 32, 16, 90, .5)],
  killCommand: [...place(paw('jade'), 26, 32, 0, .7), ...place(arrow('rose'), 42, 32, 90, .7)],
  bestialWrath: [...place(wolfHead('rose'), 32, 32, 0, .95)],
  huntersVolley: [...place(arrow('jade'), 16, 24, 160, .6), ...place(arrow('jade'), 32, 28, 180, .7), ...place(arrow('jade'), 48, 24, 200, .6), body('M10 52Q32 44 54 52L50 58Q32 52 14 58Z', 'jade')],
  explosiveShot: [...place(bomb('dark'), 32, 34, 0, .9), ...place(arrow('jade'), 40, 26, 45, .6)],
  steadyShot: [...place(bow('jade'), 30, 32, 0, .85), ...place(arrow('steel'), 38, 32, 90, .7)],
  killShot: [...place(skull('rose'), 32, 30, 0, .7), ...place(arrow('steel'), 32, 36, 90, .75)],
  chimeraShot: [...place(serpent('jade'), 26, 32, 0, .7), ...place(ember('fire'), 44, 30, 0, .55)],
  // ---- Rogue ----
  sinisterStrike: [...place(dagger('jade'), 32, 32, 40, .95)],
  eviscerate: [...place(dagger('jade'), 26, 30, 55, .8), ...place(dagger('jade'), 38, 34, 25, .8), ...place(drop('rose'), 32, 48, 0, .45)],
  ambush: [...place(hood('dark'), 30, 30, 0, .8), ...place(dagger('jade'), 42, 38, 40, .7)],
  garrote: [...place(swirl('rose'), 32, 32, 0, .8), ...place(dagger('jade'), 32, 30, 90, .6)],
  rupture: [...place(clawMarks('rose'), 32, 32, 0, .8), ...place(drop('rose'), 44, 44, 0, .5)],
  kidneyShot: [...place(dagger('jade'), 30, 34, 40, .85), ...place(star('gold'), 44, 18, 0, .45)],
  sliceAndDice: [...place(dagger('jade'), 26, 32, 60, .75), ...place(dagger('jade'), 38, 32, 30, .75), cut('M14 50 50 14', 'rose')],
  stealth: [...place(hood('dark'), 32, 32, 0, 1)],
  vanish: [...place(hood('dark'), 32, 32, 0, .95), ...place(cloud('dark'), 32, 44, 0, .7)],
  sap: [...place(fist('jade'), 30, 34, 0, .8), ...place(star('gold'), 44, 18, 0, .4), ...place(star('gold'), 50, 28, 0, .3)],
  gouge: [...place(eye('jade'), 32, 30, 0, .9), ...place(dagger('jade'), 32, 40, 90, .55)],
  kick: [...place(boot(), 32, 32, -30, .9)],
  sprint: [...place(boot(), 34, 32, 0, .85), ...place(speedLines('jade'), 24, 32, 0, .85)],
  evasion: [...place(dagger('jade'), 40, 30, 40, .7), ...place(boot(), 26, 38, 15, .7)],
  blind: [...place(eye('jade'), 32, 32, 0, .95), cut('M16 16 48 48', 'rose')],
  fanOfKnives: [0, 72, 144, 216, 288].flatMap(a => place(dagger('jade'), 32 + Math.sin(a * Math.PI / 180) * 12, 32 - Math.cos(a * Math.PI / 180) * 12, a, .5)),
  adrenalineRush: [...place(zap('gold'), 32, 32, 0, .95), ...place(heart('rose'), 32, 34, 0, .5)],
  cheapShot: [...place(hood('dark'), 30, 30, 0, .7), ...place(fist('jade'), 40, 38, 0, .6)],
  hemorrhage: [...place(dagger('rose'), 32, 30, 40, .8), ...place(drop('rose'), 26, 46, 0, .5), ...place(drop('rose'), 40, 48, 0, .4)],
  cloakOfShadows: [...place(hood('violet'), 32, 32, 0, .95), ...place(halo('violet'), 32, 32, 0, .8)],
  // ---- Priest ----
  smite: [...place(bolt('gold'), 32, 32, 30, .9), ...place(halo('gold'), 32, 32, 0, .7)],
  shadowWordPain: [...place(rune('violet'), 32, 30, 0, .85), ...place(drop('violet'), 32, 46, 0, .5)],
  mindBlast: [...place(orb('violet'), 32, 32, 0, .9), ...place(zap('violet'), 32, 32, 0, .6)],
  mindFlay: [...place(beam('violet'), 30, 32, 25, .9), ...place(orb('violet'), 44, 40, 0, .4)],
  powerWordShield: [...place(dome('gold'), 32, 30, 0, .95), ...place(orb('gold'), 32, 34, 0, .5)],
  renew: [...place(cross('jade'), 32, 32, 0, .8), ...place(halo('jade'), 32, 32, 0, .75)],
  flashHeal: [...place(star('gold'), 32, 32, 0, .7), ...place(cross('gold'), 32, 32, 0, .5)],
  greaterHeal: [...place(cross('gold'), 32, 32, 0, .95), ...place(halo('gold'), 32, 32, 0, .85)],
  psychicScream: [...place(skull('violet'), 26, 32, 0, .7), ...place(shout('violet'), 44, 32, 0, .8)],
  dispelMagic: [...place(rune('violet'), 32, 32, 0, .85), cut('M18 18 46 46', 'rose')],
  shadowform: [...place(ghost('violet'), 32, 32, 0, .95), ...place(halo('violet'), 32, 32, 0, .85)],
  holyNova: [...place(sunburst('gold'), 32, 32, 0, .95)],
  prayerOfHealing: [...place(halo('gold'), 32, 32, 0, .9), ...place(cross('gold'), 32, 32, 0, .55), ...place(heart('rose'), 32, 46, 0, .35)],
  innerFire: [...place(ember('gold'), 32, 32, 0, .9), ...place(halo('gold'), 32, 32, 0, .8)],
  shadowWordDeath: [...place(skull('violet'), 32, 30, 0, .8), ...place(bolt('violet'), 32, 44, 0, .5)],
  silence: [...place(shout('violet'), 30, 32, 0, .9), cut('M40 14 56 46M56 14 40 46', 'rose')],
  vampiricEmbrace: [...place(fangs('violet'), 32, 28, 0, .85), ...place(heart('rose'), 32, 44, 0, .55)],
  // ---- Death Knight ----
  icyTouch: [...place(grasp('ice'), 32, 32, 0, .85), ...place(snowflake('ice'), 40, 18, 0, .4)],
  plagueStrike: [...place(blade('jade'), 30, 32, 40, .85), ...place(insect('jade'), 44, 44, 0, .45)],
  bloodStrike: [...place(blade('rose'), 32, 32, 40, .9), ...place(drop('rose'), 44, 44, 0, .5)],
  deathStrike: [...place(blade('dark'), 30, 32, 40, .9), ...place(heart('rose'), 44, 22, 0, .45)],
  obliterate: [...place(blade('ice'), 26, 32, 55, .8), ...place(blade('ice'), 38, 32, 25, .8), ...place(snowflake('ice'), 32, 32, 0, .4)],
  scourgeStrike: [...place(blade('jade'), 30, 32, 40, .85), ...place(skull('jade'), 44, 20, 0, .4)],
  deathCoil: [...place(swirl('jade'), 32, 32, 0, .9), ...place(skull('jade'), 32, 32, 0, .45)],
  deathGrip: [...place(hook('dark'), 40, 26, 135, .95), ...place(link('dark'), 24, 44, 45, .7)],
  chainsOfIce: [...place(link('ice'), 32, 32, 0, .95), ...place(snowflake('ice'), 32, 32, 0, .5)],
  mindFreeze: [...place(snowflake('ice'), 32, 32, 0, .9), ...place(rune('ice'), 32, 32, 0, .5)],
  bloodBoil: [...place(drop('rose'), 32, 30, 0, .9), ...place(halo('rose'), 32, 34, 0, .75)],
  deathAndDecay: [...place(skull('jade'), 32, 28, 0, .7), ...place(halo('jade'), 32, 38, 0, .85)],
  frostPresence: [...place(shield('ice'), 32, 32, 0, .9), ...place(snowflake('ice'), 32, 32, 0, .45)],
  bloodPresence: [...place(shield('rose'), 32, 32, 0, .9), ...place(drop('rose'), 32, 32, 0, .5)],
  unholyPresence: [...place(shield('jade'), 32, 32, 0, .9), ...place(skull('jade'), 32, 32, 0, .45)],
  iceboundFortitude: [...place(iceBlockShape('ice'), 32, 32, 0, .9), ...place(shield('ice'), 32, 32, 0, .55)],
  antiMagicShell: [...place(dome('jade'), 32, 30, 0, .95), ...place(rune('jade'), 32, 34, 0, .5)],
  raiseDead: [...place(handRise('jade'), 32, 30, 0, .9), body('M10 50 22 44 32 52 42 44 54 50 50 56 32 58 14 56Z', 'dark')],
  armyOfDead: [...place(skull('jade'), 20, 36, 0, .5), ...place(skull('jade'), 44, 36, 0, .5), ...place(handRise('jade'), 32, 26, 0, .7)],
  strangulate: [...place(grasp('rose'), 32, 32, 0, .9), cut('M22 20 42 44M42 20 22 44', 'rose')],
  // ---- Shaman ----
  lightningBolt: [...place(zap('violet'), 32, 32, 0, 1)],
  chainLightning: [...place(zap('violet'), 28, 32, 0, .85), ...place(link('violet'), 42, 34, 0, .6)],
  earthShock: [...place(rock('jade'), 32, 32, 0, .9), ...place(star('jade'), 44, 18, 0, .4)],
  flameShock: [...place(ember('fire'), 32, 32, 0, .95)],
  frostShock: [...place(snowflake('ice'), 32, 32, 0, .9)],
  lavaBurst: [...place(ember('fire'), 32, 30, 0, .85), ...place(rock('fire'), 32, 40, 0, .55)],
  stormstrike: [...place(axe('violet'), 30, 32, 40, .85), ...place(zap('violet'), 42, 26, 0, .55)],
  windShear: [...place(tornado('jade'), 32, 32, 0, .8), cut('M18 46 46 18', 'jade')],
  healingWave: [...place(wave('jade'), 32, 30, 0, .95), ...place(cross('jade'), 32, 40, 0, .5)],
  lesserHealingWave: [...place(wave('jade'), 32, 34, 0, .75), ...place(cross('jade'), 32, 40, 0, .4)],
  chainHeal: [...place(link('jade'), 32, 30, 0, .9), ...place(cross('jade'), 32, 42, 0, .5)],
  searingTotem: [...place(totem('fire'), 32, 32, 0, .9), ...place(ember('fire'), 32, 12, 0, .4)],
  healingStreamTotem: [...place(totem('jade'), 32, 32, 0, .9), ...place(drop('ice'), 32, 12, 0, .4)],
  earthbindTotem: [...place(totem('jade'), 32, 30, 0, .85), ...place(vine('jade'), 32, 44, 0, .5)],
  ghostWolf: [...place(wolfHead('ice'), 32, 32, 0, .95), ...place(halo('ice'), 32, 32, 0, .8)],
  bloodlust: [...place(heart('rose'), 32, 32, 0, .95), ...place(shout('rose'), 32, 32, 0, .8)],
  feralSpirit: [...place(wolfHead('jade'), 24, 32, 0, .6), ...place(wolfHead('jade'), 42, 32, 0, .6)],
  thunderstorm: [...place(cloud('ice'), 32, 24, 0, .9), ...place(zap('violet'), 32, 40, 0, .7)],
  lightningShield: [...place(shield('violet'), 32, 32, 0, .85), ...place(zap('violet'), 32, 32, 0, .55)],
  // ---- Mage ----
  frostbolt: [...place(crystal('ice'), 32, 32, 40, .9), ...place(bolt('ice'), 32, 32, 40, .6)],
  pyroblast: [...place(orb('fire'), 32, 34, 0, .95), ...place(ember('fire'), 32, 20, 0, .55)],
  fireBlast: [...place(ember('fire'), 32, 32, 0, .9), ...place(halo('fire'), 32, 32, 0, .8)],
  scorch: [...place(ember('fire'), 34, 32, 0, .8), ...place(speedLines('fire'), 24, 32, 0, .8)],
  arcaneMissiles: [...place(missile('violet'), 22, 32, 30, .7), ...place(missile('violet'), 32, 30, 0, .7), ...place(missile('violet'), 42, 32, -30, .7)],
  arcaneExplosion: [...place(sunburst('violet'), 32, 32, 0, .9)],
  frostNova: [...place(snowflake('ice'), 32, 32, 0, .9), ...place(halo('ice'), 32, 32, 0, .85)],
  iceLance: [...place(crystal('ice'), 32, 32, 40, 1.2)],
  coneOfCold: [...place(crystal('ice'), 22, 34, 65, .6), ...place(crystal('ice'), 32, 30, 90, .6), ...place(crystal('ice'), 42, 34, 115, .6)],
  blizzard: [...place(cloud('ice'), 32, 22, 0, .9), ...place(snowflake('ice'), 24, 42, 0, .45), ...place(snowflake('ice'), 40, 46, 0, .45)],
  blink: [...place(speedLines('violet'), 24, 32, 0, .9), ...place(star('violet'), 44, 32, 0, .7)],
  polymorph: [...place(sheepHead('violet'), 32, 32, 0, .95)],
  counterspell: [...place(rune('violet'), 32, 32, 0, .9), cut('M20 20 44 44M44 20 20 44', 'rose')],
  iceBlock: [...place(iceBlockShape('ice'), 32, 32, 0, 1)],
  iceBarrier: [...place(dome('ice'), 32, 30, 0, .95), ...place(snowflake('ice'), 32, 34, 0, .45)],
  evocation: [...place(orb('violet'), 32, 32, 0, .8), ...place(halo('violet'), 32, 32, 0, .7), ...place(star('violet'), 32, 32, 0, .4)],
  mirrorImage: [...place(hood('violet'), 24, 32, 0, .7, .45), ...place(hood('violet'), 40, 32, 0, .7, .45), ...place(hood('violet'), 32, 30, 0, .8)],
  combustion: [...place(ember('fire'), 32, 32, 0, .9), ...place(rune('fire'), 32, 32, 0, .5)],
  dragonsBreath: [...place(ember('fire'), 24, 36, 0, .6), ...place(ember('fire'), 34, 32, 0, .75), ...place(ember('fire'), 44, 28, 0, .6)],
  deepFreeze: [...place(iceBlockShape('ice'), 32, 32, 0, .85), ...place(snowflake('ice'), 32, 32, 0, .5)],
  // ---- Warlock ----
  shadowBolt: [...place(bolt('violet'), 32, 32, 30, 1)],
  immolate: [...place(ember('fire'), 32, 30, 0, .9), ...place(drop('fire'), 32, 46, 0, .5)],
  corruption: [...place(swirl('violet'), 32, 32, 0, .95), ...place(drop('violet'), 32, 44, 0, .45)],
  curseOfAgony: [...place(skull('violet'), 32, 30, 0, .8), ...place(rune('violet'), 32, 44, 0, .45)],
  unstableAffliction: [...place(orb('violet'), 32, 32, 0, .9), ...place(swirl('violet'), 32, 32, 0, .65)],
  drainLife: [...place(beam('jade'), 28, 32, 25, .85), ...place(heart('rose'), 44, 40, 0, .45)],
  drainSoul: [...place(beam('violet'), 28, 32, 25, .85), ...place(ghost('violet'), 44, 38, 0, .45)],
  searingPain: [...place(bolt('fire'), 32, 32, 30, .95)],
  shadowburn: [...place(ember('violet'), 32, 32, 0, .95)],
  chaosBolt: [...place(ember('jade'), 32, 32, 0, .9), ...place(bolt('jade'), 32, 32, 30, .6)],
  conflagrate: [...place(ember('fire'), 32, 32, 0, .85), ...place(halo('fire'), 32, 32, 0, .8)],
  fear: [...place(ghost('violet'), 32, 32, 0, .95)],
  howlOfTerror: [...place(ghost('violet'), 26, 32, 0, .7), ...place(shout('violet'), 44, 32, 0, .8)],
  warlockDeathCoil: [...place(swirl('violet'), 32, 32, 0, .9), ...place(skull('violet'), 32, 32, 0, .45)],
  lifeTap: [...place(drop('rose'), 32, 30, 0, .85), ...place(orb('violet'), 32, 44, 0, .45)],
  felArmor: [...place(shield('jade'), 32, 32, 0, .9), ...place(horns('jade'), 32, 26, 0, .55)],
  summonImp: [...place(impHead('jade'), 32, 32, 0, .95)],
  summonFelguard: [...place(demonHead('jade'), 32, 32, 0, .95)],
  metamorphosis: [...place(demonHead('jade'), 32, 34, 0, .8), ...place(wings('jade'), 32, 24, 0, .8)],
  seedOfCorruption: [...place(seedPod('violet'), 32, 32, 0, .95)],
  rainOfFire: [...place(meteorRock('fire'), 24, 40, 0, .5), ...place(meteorRock('fire'), 42, 44, 0, .45), ...place(ember('fire'), 34, 20, 0, .5)],
  shadowfury: [...place(meteorRock('violet'), 32, 32, 0, .95)],
  // ---- Druid ----
  wrath: [...place(bolt('jade'), 32, 32, 30, .9), ...place(leaf('jade'), 32, 32, 0, .45)],
  starfire: [...place(star('violet'), 32, 32, 0, .9), ...place(bolt('violet'), 32, 36, 0, .5)],
  moonfire: [...place(moon('violet'), 32, 32, 0, .9), ...place(ember('violet'), 40, 40, 0, .4)],
  insectSwarm: [...place(insect('jade'), 24, 30, 0, .6), ...place(insect('jade'), 40, 26, 30, .55), ...place(insect('jade'), 34, 42, -20, .55)],
  entanglingRoots: [...place(vine('jade'), 26, 32, 0, .85), ...place(vine('jade'), 40, 34, 15, .7)],
  hurricane: [...place(tornado('ice'), 32, 32, 0, .95)],
  starfall: [...place(star('violet'), 32, 20, 0, .6), ...place(star('violet'), 20, 38, 0, .45), ...place(star('violet'), 44, 38, 0, .45), ...place(star('violet'), 32, 48, 0, .35)],
  healingTouch: [...place(leaf('jade'), 32, 32, 0, .9), ...place(cross('jade'), 32, 32, 0, .45)],
  regrowth: [...place(vine('jade'), 32, 32, 0, .9), ...place(cross('jade'), 32, 16, 0, .4)],
  rejuvenation: [...place(leaf('jade'), 32, 32, 0, .85), ...place(halo('jade'), 32, 32, 0, .75)],
  swiftmend: [...place(cross('jade'), 32, 32, 0, .8), ...place(star('jade'), 32, 32, 0, .5)],
  barkskin: [...place(bark('jade'), 32, 32, 0, .95)],
  bearForm: [...place(bearHead('jade'), 32, 32, 0, 1)],
  catForm: [...place(catHead('jade'), 32, 32, 0, 1)],
  moonkinForm: [...place(owlHead('violet'), 32, 32, 0, 1)],
  travelForm: [...place(hoof('jade'), 34, 32, 0, .9), ...place(speedLines('jade'), 24, 32, 0, .8)],
  maul: [...place(paw('jade'), 32, 32, 0, .95)],
  swipe: [...place(clawMarks('jade'), 32, 32, 0, .9), ...place(halo('jade'), 32, 32, 0, .7)],
  bash: [...place(paw('jade'), 32, 34, 0, .85), ...place(star('gold'), 32, 14, 0, .4)],
  feralCharge: [...place(paw('jade'), 38, 32, 0, .85), ...place(speedLines('jade'), 24, 32, 0, .85)],
  mangle: [...place(clawMarks('rose'), 32, 32, 0, .9), ...place(paw('jade'), 32, 36, 0, .5)],
  claw: [...place(clawMarks('jade'), 32, 32, 0, .95)],
  rake: [...place(clawMarks('jade'), 32, 32, 0, .85), ...place(drop('rose'), 44, 44, 0, .45)],
  rip: [...place(clawMarks('rose'), 32, 32, 0, .9), ...place(drop('rose'), 26, 46, 0, .5), ...place(drop('rose'), 40, 48, 0, .4)],
  ferociousBite: [...place(fangs('jade'), 32, 32, 0, .95)],
  prowl: [...place(catHead('dark'), 32, 32, 0, .95), ...place(halo('violet'), 32, 32, 0, .8)],
  pounce: [...place(catHead('jade'), 30, 28, 0, .6), ...place(paw('jade'), 38, 42, 0, .55)],
  faerieFire: [...place(star('jade'), 32, 32, 0, .85), ...place(swirl('jade'), 32, 32, 0, .6)],
  innervate: [...place(orb('jade'), 32, 32, 0, .85), ...place(leaf('jade'), 32, 32, 0, .5)],
  // ---- Racial actives ----
  everyMan: [...place(brokenChain('gold'), 32, 32, 0, .95)],
  stoneform: [...place(rock('steel'), 32, 32, 0, .95), ...place(shield('steel'), 32, 32, 0, .6)],
  shadowmeld: [...place(hood('violet'), 32, 32, 0, .9), ...place(moon('violet'), 44, 18, 0, .4)],
  escapeArtist: [...place(boot(), 34, 32, 0, .85), ...place(brokenChain('gold'), 26, 40, 0, .5)],
  giftNaaru: [...place(rune('gold'), 32, 32, 0, .9), ...place(halo('gold'), 32, 32, 0, .8)],
  bloodFury: [...place(fist('rose'), 32, 32, 0, .9), ...place(drop('rose'), 32, 14, 0, .45)],
  willForsaken: [...place(skull('dark'), 32, 32, 0, .9), ...place(halo('violet'), 32, 32, 0, .8)],
  warStomp: [...place(hoof('jade'), 32, 28, 0, .9), ...place(halo('jade'), 32, 42, 0, .7)],
  berserking: [...place(zap('fire'), 32, 32, 0, .9), ...place(fangs('rose'), 32, 40, 0, .5)],
  arcaneTorrent: [...place(swirl('violet'), 32, 32, 0, .9), ...place(star('violet'), 32, 32, 0, .5)],
};

/** Freeze authored recipes once; renderers cannot accumulate or mutate presentation state. */
const authored: Readonly<Partial<Record<SkillId, readonly IconPart[]>>> = Object.freeze(
  Object.fromEntries(Object.entries(recipes).map(([id, parts]) => [id, Object.freeze(parts.map(p => Object.freeze({
    ...p, ...(p.transform ? { transform: Object.freeze(p.transform) } : {}),
  })))])) as Record<SkillId, readonly IconPart[]>,
);
/** School signature of a skill's execution recipe (mirrors castSchoolStyle, without a player). */
function recipeSchool(id: string): string | null {
  const r = SKILL_EXECUTION[id as SkillId];
  if (!r) return null;
  if (r.kind === 'projectile') return r.effects.style ?? null;
  if ('style' in r && r.style) return r.style;
  if ('school' in r && r.school) return r.school;
  if (r.kind === 'dot') return r.dot.school;
  return null;
}

/** School → glass material so icons share the combat palette. */
const SCHOOL_MATERIALS: Readonly<Record<string, SkillIconMaterial>> = Object.freeze({
  fire: 'fire', frost: 'ice', lightning: 'ice', nature: 'jade', poison: 'jade',
  holy: 'gold', radiant: 'gold', shadow: 'violet', arcane: 'violet', spirit: 'violet',
  physical: 'steel', bleed: 'rose', arrow: 'jade',
});
/** Nearest material face to a skill's authored color (class color for unschooled skills). */
function nearestMaterial(color: string | undefined): SkillIconMaterial | null {
  const hex = color && /^#[0-9a-f]{6}$/i.exec(color);
  if (!hex) return null;
  const r = parseInt(hex[0].slice(1, 3), 16), g = parseInt(hex[0].slice(3, 5), 16), b = parseInt(hex[0].slice(5, 7), 16);
  let best: SkillIconMaterial | null = null, dist = Infinity;
  for (const [key, mat] of Object.entries(ICON_MATERIALS) as [SkillIconMaterial, IconMaterial][]) {
    const dr = r - parseInt(mat.face.slice(1, 3), 16), dg = g - parseInt(mat.face.slice(3, 5), 16), db = b - parseInt(mat.face.slice(5, 7), 16);
    const d = dr * dr + dg * dg + db * db;
    if (d < dist) { dist = d; best = key; }
  }
  return best;
}

/**
 * Name/id keyword → motif, with an optional material override for unschooled
 * skills (a searing totem should read fire even though summons carry no school).
 * First match wins, so specific phrases precede broad element words
 * ('stormstrike' before 'storm', 'feral spirit' before 'spirit').
 */
const KEYWORD_MOTIFS: readonly (readonly [string, (m: SkillIconMaterial) => IconPart[], SkillIconMaterial?])[] = [
  ['searing totem', m => totem(m), 'fire'], ['magma totem', m => totem(m), 'fire'],
  ['flametongue totem', m => totem(m), 'fire'], ['totem of wrath', m => totem(m), 'fire'],
  ['fire elemental totem', m => totem(m), 'fire'],
  ['healing stream totem', m => totem(m), 'ice'], ['mana spring totem', m => totem(m), 'ice'],
  ['wrath of air totem', m => totem(m), 'ice'], ['windfury totem', m => totem(m), 'ice'],
  ['cleansing totem', m => totem(m), 'ice'], ['grounding totem', m => totem(m), 'violet'],
  ['earthbind totem', m => totem(m), 'jade'], ['strength of earth totem', m => totem(m), 'jade'],
  ['stoneskin totem', m => totem(m), 'jade'], ['tremor totem', m => totem(m), 'jade'],
  ['earth elemental totem', m => totem(m), 'jade'],
  ['totem', m => totem(m)],
  ['force of nature', m => leaf(m), 'jade'], ['treant', m => leaf(m), 'jade'],
  ['feral spirit', m => wolfHead(m)], ['spirit wolf', m => wolfHead(m)], ['ghost wolf', m => wolfHead(m)],
  ['dire bear', m => bearHead(m)], ['bear form', m => bearHead(m)],
  ['cat form', m => catHead(m)], ['moonkin', m => owlHead(m)],
  ['polymorph', m => sheepHead(m)], ['sheep', m => sheepHead(m)],
  ['metamorph', m => demonHead(m)], ['transform', m => demonHead(m)],
  ['doomguard', m => demonHead(m), 'jade'], ['felguard', m => demonHead(m), 'jade'], ['demon', m => demonHead(m)],
  ['voidwalker', m => hood(m), 'violet'], ['succubus', m => heart(m), 'violet'], ['seduc', m => heart(m), 'violet'],
  ['felhunter', m => wolfHead(m), 'jade'], ['gargoyle', m => wings(m), 'violet'],
  ['summonimp', m => impHead(m)], ['imp', m => impHead(m)],
  ['water elemental', m => wave(m), 'ice'], ['earth elemental', m => rock(m), 'jade'], ['fire elemental', m => ember(m), 'fire'],
  ['elemental', m => crystal(m)],
  ['army of the dead', m => handRise(m)], ['raise dead', m => handRise(m)], ['ghoul', m => skull(m)],
  ['mirror image', m => crystal(m)], ['dancing rune', m => blade(m)],
  ['shout', m => shout(m)], ['roar', m => shout(m)], ['howl', m => shout(m)],
  ['intimidat', m => shout(m)], ['demoraliz', m => shout(m)], ['challenging', m => shout(m)],
  ['command', m => shout(m)], ['bloodlust', m => shout(m)], ['heroism', m => shout(m)],
  ['rallying', m => shout(m)], ['growl', m => shout(m)], ['scream', m => shout(m)],
  ['berserk', m => fist(m)], ['enrage', m => fist(m)], ['rampage', m => fist(m)],
  ['frenzy', m => fist(m)], ['recklessness', m => fist(m)], ['hysteria', m => fist(m)], ['fury', m => fist(m)],
  ['bash', m => hammer(m)],
  ['curse', m => skull(m)], ['agony', m => skull(m)], ['affliction', m => skull(m)],
  ['corpse', m => skull(m)], ['decay', m => skull(m)], ['scourge', m => skull(m)],
  ['lich', m => skull(m), 'violet'], ['desecr', m => skull(m), 'violet'], ['skull', m => skull(m)],
  ['death', m => skull(m), 'violet'], ['unholy', m => skull(m), 'violet'],
  ['festering', m => insect(m)], ['outbreak', m => insect(m)],
  ['poison', m => drop(m), 'jade'], ['venom', m => drop(m), 'jade'], ['envenom', m => drop(m), 'jade'],
  ['scorpid', m => insect(m), 'jade'], ['serpent', m => serpent(m), 'jade'], ['viper', m => serpent(m), 'jade'],
  ['wyvern', m => serpent(m), 'jade'], ['sting', m => serpent(m), 'jade'],
  ['bleed', m => clawMarks(m), 'rose'], ['rend', m => clawMarks(m), 'rose'], ['garrote', m => clawMarks(m), 'rose'],
  ['rupture', m => clawMarks(m), 'rose'], ['lacerat', m => clawMarks(m), 'rose'], ['gore', m => clawMarks(m), 'rose'],
  ['claw', m => clawMarks(m)], ['swipe', m => clawMarks(m)], ['rake', m => clawMarks(m)],
  ['maul', m => clawMarks(m)], ['mangle', m => clawMarks(m)], ['shred', m => clawMarks(m)],
  ['ravage', m => clawMarks(m)], ['pounce', m => clawMarks(m)], ['thrash', m => clawMarks(m)],
  ['hamstring', m => clawMarks(m)], ['clip', m => clawMarks(m)],
  ['bite', m => fangs(m)], ['fang', m => fangs(m)], ['cannibal', m => fangs(m)], ['bloodthirst', m => fangs(m)],
  ['blood', m => drop(m), 'rose'],
  ['grip', m => hook(m)], ['hook', m => hook(m)],
  ['strangulate', m => grasp(m)], ['drain', m => grasp(m)], ['siphon', m => grasp(m)],
  ['leech', m => grasp(m)], ['vampiric', m => grasp(m)], ['tap', m => grasp(m)],
  ['pact', m => grasp(m)], ['harvest', m => grasp(m)], ['pickpocket', m => grasp(m)],
  ['heal', m => cross(m)], ['mend', m => cross(m)], ['renew', m => cross(m)],
  ['regen', m => cross(m)], ['rejuven', m => cross(m)], ['revive', m => cross(m)],
  ['resurrect', m => cross(m)], ['redemption', m => cross(m)], ['rebirth', m => cross(m)],
  ['reincarnation', m => cross(m)], ['nourish', m => cross(m)], ['growth', m => cross(m)],
  ['lifebloom', m => cross(m)], ['prayer', m => hands(m)], ['glory', m => cross(m)],
  ['guardian spirit', m => wings(m)], ['archangel', m => wings(m)], ['avenging', m => wings(m)],
  ['cleanse', m => swirl(m)], ['cleansing', m => swirl(m)], ['purif', m => swirl(m)],
  ['dispel', m => swirl(m)], ['purge', m => swirl(m)], ['abolish', m => swirl(m)],
  ['remove', m => swirl(m)], ['spellsteal', m => swirl(m)], ['counterspell', m => swirl(m)],
  ['silence', m => swirl(m)], ['shear', m => swirl(m)], ['banish', m => swirl(m)],
  ['spell lock', m => swirl(m)], ['slow', m => swirl(m)],
  ['ice block', m => iceBlockShape(m), 'ice'], ['icebound', m => iceBlockShape(m), 'ice'],
  ['frost', m => snowflake(m), 'ice'], ['ice', m => snowflake(m), 'ice'], ['blizzard', m => snowflake(m), 'ice'],
  ['freeze', m => snowflake(m), 'ice'], ['chill', m => snowflake(m), 'ice'], ['winter', m => snowflake(m), 'ice'],
  ['cold', m => snowflake(m), 'ice'], ['icy', m => snowflake(m), 'ice'],
  ['meteor', m => meteorRock(m), 'fire'], ['inferno', m => meteorRock(m), 'fire'], ['rain of fire', m => meteorRock(m), 'fire'],
  ['cataclysm', m => meteorRock(m)],
  ['fire', m => ember(m), 'fire'], ['flame', m => ember(m), 'fire'], ['immolate', m => ember(m), 'fire'],
  ['incinerate', m => ember(m), 'fire'], ['pyro', m => ember(m), 'fire'], ['scorch', m => ember(m), 'fire'],
  ['conflag', m => ember(m), 'fire'], ['ignite', m => ember(m), 'fire'], ['combust', m => ember(m), 'fire'],
  ['lava', m => ember(m), 'fire'], ['magma', m => ember(m), 'fire'], ['searing', m => ember(m), 'fire'],
  ['hellfire', m => ember(m), 'fire'], ['burn', m => ember(m), 'fire'], ['dragon', m => ember(m), 'fire'],
  ['stormstrike', m => [...blade(m), ...zap('violet')]],
  ['lightning', m => zap(m), 'ice'], ['thunder', m => zap(m), 'ice'], ['shock', m => zap(m), 'ice'],
  ['storm', m => tornado(m)], ['tempest', m => tornado(m)], ['hurricane', m => tornado(m)],
  ['cyclone', m => tornado(m)], ['tornado', m => tornado(m)], ['typhoon', m => tornado(m)],
  ['wind', m => speedLines(m)], ['gust', m => speedLines(m)],
  ['shadow', m => ghost(m), 'violet'], ['void', m => hood(m), 'violet'], ['terror', m => ghost(m), 'violet'],
  ['horror', m => ghost(m)], ['despair', m => ghost(m)], ['fear', m => ghost(m)],
  ['scare', m => ghost(m)], ['nightmare', m => ghost(m)], ['dispers', m => ghost(m)],
  ['spirit', m => ghost(m)], ['soul', m => ghost(m)], ['forsaken', m => ghost(m)],
  ['spectral', m => ghost(m)], ['wraith', m => ghost(m)],
  ['mind', m => eye(m)], ['psychic', m => eye(m)], ['vision', m => eye(m)],
  ['holy', m => sunburst(m), 'gold'], ['divine storm', m => sunburst(m), 'gold'], ['smite', m => sunburst(m), 'gold'],
  ['consecr', m => sunburst(m)], ['righteous', m => sunburst(m)], ['sanctity', m => sunburst(m)],
  ['retribution', m => sunburst(m), 'gold'], ['light', m => sunburst(m), 'gold'],
  ['judg', m => hammer(m)], ['hammer', m => hammer(m)],
  ['exorcis', m => beam(m)], ['penance', m => beam(m)], ['beacon', m => beam(m)],
  ['beam', m => beam(m)], ['ray', m => beam(m)], ['illumination', m => beam(m)],
  ['blessing', m => hands(m)], ['hand of', m => hands(m)], ['hands', m => hands(m)],
  ['missile', m => missile(m)], ['barrage', m => missile(m)],
  ['arcane', m => rune(m)], ['evocat', m => orb(m)], ['conjur', m => orb(m)],
  ['brilliance', m => rune(m)], ['intellect', m => rune(m)], ['mana', m => orb(m)],
  ['innervate', m => orb(m)], ['healthstone', m => heart(m)], ['soulstone', m => ghost(m)],
  ['spellstone', m => orb(m)], ['firestone', m => orb(m)],
  ['starfall', m => star(m)], ['starfire', m => star(m)], ['starsurge', m => star(m)],
  ['star', m => star(m)], ['sunfire', m => sunburst(m)], ['solar', m => sunburst(m)],
  ['moon', m => moon(m)], ['lunar', m => moon(m)], ['eclipse', m => moon(m)],
  ['hibernate', m => moon(m)], ['faerie', m => star(m)],
  ['insect', m => insect(m)], ['swarm', m => insect(m)],
  ['root', m => vine(m), 'jade'], ['entangl', m => vine(m), 'jade'], ['vine', m => vine(m), 'jade'], ['web', m => vine(m), 'jade'],
  ['bark', m => bark(m), 'jade'], ['thorn', m => leaf(m), 'jade'], ['wild', m => leaf(m), 'jade'],
  ['nature', m => leaf(m), 'jade'], ['leaf', m => leaf(m), 'jade'], ['bloom', m => leaf(m), 'jade'],
  ['living', m => leaf(m)], ['wrath', m => bolt(m)], ['seed', m => seedPod(m)],
  ['divine shield', m => dome(m)], ['deterrence', m => dome(m)],
  ['anti-magic', m => dome(m)], ['antimagic', m => dome(m)], ['grounding', m => dome(m)],
  ['resistance', m => dome(m)], ['absorb', m => dome(m)],
  ['shield', m => shield(m)], ['block', m => shield(m)], ['barrier', m => shield(m)],
  ['ward', m => shield(m)], ['aegis', m => shield(m)], ['bulwark', m => shield(m)],
  ['defen', m => shield(m)], ['guard', m => shield(m)], ['protect', m => shield(m)],
  ['sanctuar', m => shield(m)], ['sacrifice', m => shield(m)], ['wall', m => shield(m)],
  ['shell', m => shield(m)], ['carapace', m => shield(m)], ['fortif', m => shield(m)],
  ['unbreakable', m => shield(m)], ['stoneskin', m => shield(m)], ['armor', m => shield(m)],
  ['survival', m => shield(m)], ['stand', m => shield(m)], ['vigil', m => eye(m)],
  ['whirlwind', m => [...blade(m), ...swirl(m)]], ['bladestorm', m => [...blade(m), ...swirl(m)]],
  ['sinister', m => dagger(m)], ['dagger', m => dagger(m)], ['knife', m => dagger(m)],
  ['knives', m => dagger(m)], ['shiv', m => dagger(m)], ['ambush', m => dagger(m)],
  ['gouge', m => dagger(m)], ['eviscerate', m => dagger(m)], ['mutilate', m => dagger(m)],
  ['backstab', m => dagger(m)], ['throw', m => dagger(m)],
  ['execute', m => axe(m)], ['axe', m => axe(m)],
  ['slam', m => hammer(m)], ['smash', m => hammer(m)], ['crush', m => hammer(m)],
  ['devastate', m => hammer(m)], ['concussion', m => hammer(m)], ['pulverize', m => hammer(m)],
  ['sunder', m => brokenChain(m)], ['expose', m => brokenChain(m)],
  ['shatter', m => brokenChain(m)], ['disarm', m => brokenChain(m)], ['chains', m => link(m)],
  ['sword', m => blade(m)], ['slash', m => blade(m)], ['cleave', m => blade(m)],
  ['strike', m => blade(m)], ['mortal', m => blade(m)], ['overpower', m => blade(m)],
  ['heroic', m => blade(m)], ['sweep', m => blade(m)], ['blade', m => blade(m)],
  ['riposte', m => blade(m)], ['carve', m => blade(m)], ['slice', m => blade(m)],
  ['dice', m => blade(m)], ['revenge', m => blade(m)], ['retaliation', m => blade(m)],
  ['spree', m => blade(m)], ['flurry', m => blade(m)], ['counterattack', m => blade(m)],
  ['aimed', m => target(m)], ['kill shot', m => target(m)], ['deadly', m => target(m)],
  ['snipe', m => target(m)], ['trueshot', m => target(m)], ['misdirection', m => target(m)],
  ['focus', m => target(m)], ['mark', m => target(m)], ['precision', m => target(m)],
  ['shot', m => arrow(m)], ['shoot', m => arrow(m)], ['arrow', m => arrow(m)],
  ['volley', m => arrow(m)], ['scatter', m => arrow(m)], ['multi', m => arrow(m)],
  ['chimera', m => arrow(m)], ['bolt', m => bolt(m)],
  ['trap', m => trap(m)], ['snare', m => trap(m)],
  ['stealth', m => hood(m), 'dark'], ['vanish', m => hood(m), 'dark'], ['prowl', m => hood(m), 'dark'],
  ['shadowmeld', m => hood(m), 'dark'], ['sneak', m => hood(m), 'dark'], ['cloak', m => hood(m), 'dark'],
  ['sap', m => hood(m), 'dark'], ['feign', m => hood(m), 'dark'], ['camouflage', m => hood(m), 'dark'],
  ['invisibility', m => hood(m)], ['fade', m => hood(m)], ['evasion', () => boot()],
  ['blind', m => eye(m)], ['distract', m => eye(m)],
  ['blink', m => swirl(m)], ['teleport', m => swirl(m)],
  ['charge', m => speedLines(m)], ['dash', m => speedLines(m)], ['sprint', m => speedLines(m)],
  ['rush', m => speedLines(m)], ['intercept', m => speedLines(m)], ['intervene', m => speedLines(m)],
  ['leap', m => speedLines(m)], ['disengage', m => speedLines(m)], ['pursuit', m => speedLines(m)],
  ['swiftness', m => speedLines(m)], ['rapid', m => speedLines(m)], ['fervor', m => speedLines(m)],
  ['cheetah', m => speedLines(m)], ['step', () => boot()], ['escape', () => boot()],
  ['link', m => link(m)], ['chain', m => link(m)],
  ['nova', m => sunburst(m)], ['burst', m => sunburst(m)], ['explosion', m => sunburst(m)],
  ['shockwave', m => sunburst(m)], ['clap', m => sunburst(m)],
  ['explosive', m => bomb(m)], ['bomb', m => bomb(m)], ['detonate', m => bomb(m)],
  ['track', m => eye(m)], ['eye', m => eye(m)], ['lore', m => eye(m)], ['sense', m => eye(m)],
  ['detect', m => eye(m)], ['flare', m => eye(m)], ['sight', m => eye(m)], ['watch', m => eye(m)],
  ['horn', m => horn(m)], ['hymn', m => horn(m)], ['song', m => horn(m)], ['stomp', m => hoof(m)],
  ['earth', m => rock(m), 'jade'], ['stone', m => rock(m), 'jade'], ['rock', m => rock(m), 'jade'],
  ['quake', m => rock(m)], ['tremor', m => rock(m)],
  ['water', m => wave(m), 'ice'], ['tidal', m => wave(m), 'ice'], ['riptide', m => wave(m), 'ice'],
  ['rain', m => wave(m), 'ice'], ['spring', m => wave(m), 'ice'], ['wave', m => wave(m), 'ice'], ['tranquil', m => wave(m), 'ice'],
  ['feather', m => feather(m)], ['wing', m => feather(m)], ['flight', m => feather(m)],
  ['soar', m => feather(m)], ['swoop', m => feather(m)], ['hawk', m => feather(m)],
  ['levitate', m => feather(m)], ['hoof', m => hoof(m)], ['stag', m => hoof(m)],
  ['travel', m => hoof(m)],
  ['hawk', m => feather(m)], ['pack', m => paw(m)], ['monkey', m => paw(m)],
  ['fox', m => paw(m)], ['aspect', m => paw(m)], ['beast', m => paw(m)],
  ['pet', m => paw(m)], ['tame', m => paw(m)], ['companion', m => paw(m)],
  ['raise', m => handRise(m)], ['summon', m => paw(m)], ['call', m => paw(m)], ['invoke', m => paw(m)],
  ['ritual', m => rune(m)], ['rune', m => rune(m)], ['runic', m => rune(m)],
  ['sigil', m => rune(m)], ['glyph', m => rune(m)], ['hex', m => rune(m)],
  ['shackle', m => brokenChain(m)], ['circle', m => rune(m)],
  ['mirror', m => crystal(m)], ['image', m => crystal(m)], ['echo', m => crystal(m)],
  ['reflect', m => crystal(m)], ['simulacrum', m => eye(m)],
  ['weapon', m => blade(m)], ['imbue', m => blade(m)], ['brand', m => blade(m)],
  ['kick', m => fist(m)], ['pummel', m => fist(m)], ['fist', m => fist(m)],
  ['punch', m => fist(m)], ['jab', m => fist(m)],
  ['crown', m => crown(m)], ['banner', m => crown(m)], ['seal', m => crown(m)],
  ['cloud', m => cloud(m)], ['mist', m => cloud(m)], ['fog', m => cloud(m)],
  ['smoke', m => cloud(m)], ['veil', m => cloud(m)],
  ['heart', m => heart(m)], ['courage', m => heart(m)], ['valor', m => heart(m)],
  ['aura', m => halo(m)], ['chakra', m => halo(m)], ['repent', m => halo(m)],
  ['presence', m => halo(m)], ['naaru', m => halo(m)], ['gift', m => halo(m)],
  ['readiness', m => star(m)], ['astral', m => star(m)],
];

/** Keyword match from the skill's id + display name: motif maker + optional material override. */
function keywordMotif(id: string): { make: (m: SkillIconMaterial) => IconPart[]; material?: SkillIconMaterial } | null {
  const key = `${id} ${SKILL_DEFINITIONS[id as SkillId]?.name ?? ''}`.toLowerCase();
  for (const [word, make, material] of KEYWORD_MOTIFS) if (key.includes(word)) return { make, material };
  return null;
}

/** Execution-kind fallback when no keyword matches. */
function kindMotif(kind: string, m: SkillIconMaterial): IconPart[] {
  switch (kind) {
    case 'projectile': case 'channel': return bolt(m);
    case 'ground': return [...place(star(m), 32, 30, 0, .9), ...place(dome(m), 32, 30, 0, .9)];
    case 'chain': return zap(m);
    case 'radial': case 'cone': return [...place(swirl(m), 32, 32, 0, .9), ...place(halo(m), 32, 32, 0, .6)];
    case 'sweep': case 'strike': case 'backstab': case 'comboStrike': case 'runeStrike': return blade(m);
    case 'dash': case 'step': return boot();
    case 'buff': case 'stance': case 'form': case 'aura': return [...place(halo(m), 32, 32, 0, .95), ...place(star(m), 32, 32, 0, .7)];
    case 'guard': case 'ward': return shield(m);
    case 'heal': case 'hot': case 'cleanse': return cross(m);
    case 'dot': return drop(m);
    case 'cc': case 'interrupt': case 'taunt': case 'pull': return [...place(moon(m), 32, 32, 0, .9), ...place(halo(m), 32, 32, 0, .6)];
    case 'summon': return paw(m);
    case 'stealth': return [...place(moon('dark'), 32, 32, 0, .9), ...place(swirl(m), 32, 32, 0, .5)];
    default: return crystal(m);
  }
}

/**
 * Generic motif, seeded by skill id so every icon stays distinct. The material
 * follows the skill's school (class color when unschooled); the silhouette
 * follows a name/id keyword before the execution-kind fallback, so totems read
 * as totems, shouts as sound waves, curses as skulls and poisons as drops.
 */
export function genericSkillIconParts(kind: string, id: string): readonly IconPart[] {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const mats: SkillIconMaterial[] = ['gold', 'jade', 'violet', 'ice', 'fire', 'rose', 'steel'];
  const hit = keywordMotif(id);
  const m = SCHOOL_MATERIALS[recipeSchool(id) ?? ''] ?? hit?.material ?? nearestMaterial(SKILL_DEFINITIONS[id as SkillId]?.color) ?? mats[Math.abs(h) % mats.length];
  const rot = (h % 360), sc = .72 + ((Math.abs(h) >> 8) % 5) * .07;
  const motif = hit ? hit.make(m) : kindMotif(kind, m);
  // A seeded accent dot plus rotation/scale keep same-kind same-school icons visually distinct.
  const ax = 32 + Math.cos(h) * 20, ay = 32 + Math.sin(h) * 20;
  return [...place(motif, 32, 32, rot, sc), facet(`M${ax - 3} ${ay}L${ax} ${ay - 4}L${ax + 3} ${ay}L${ax} ${ay + 4}Z`, m)];
}
/** Every skill resolves to an icon: authored where present, a seeded generic motif otherwise. */
export const SKILL_ICON_RECIPES: Readonly<Record<SkillId, readonly IconPart[]>> = Object.freeze(
  Object.fromEntries(Object.keys(SKILL_DEFINITIONS).map(id => [id as SkillId,
    authored[id as SkillId] ?? genericSkillIconParts(SKILL_EXECUTION[id as SkillId].kind, id)])) as Record<SkillId, readonly IconPart[]>,
);

