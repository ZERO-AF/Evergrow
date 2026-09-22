import type { EnemyKind } from './model.ts';
import type { WaveRules } from './wave-system.ts';
import { BLACKROCK_DEPTHS } from './dungeon2-content.ts';
export type DungeonThemeId = 'rootbound' | 'foundry' | 'drowned' | 'rime' | 'ossuary' | 'astral' | 'blackrock' | 'nerubian' | 'titankeep' | 'frostmourne' | 'violet';
export interface DungeonTheme {
    id: DungeonThemeId; name: string; description: string;
    ambient: string; stone: readonly [number, number, number]; floor: readonly [number, number, number];
    accent: string; light: string; map: string; wall: string;
    roster: readonly EnemyKind[];
    boss?: EnemyKind; bossName?: string;
}
export const DUNGEON_THEMES: Readonly<Record<DungeonThemeId, DungeonTheme>> = Object.freeze({
    rootbound: Object.freeze({ id: 'rootbound', name: 'Rootbound Crypt', description: 'Split tombs, root-veined masonry and green witchlights.', ambient: '#17271f', stone: [66, 75, 59] as const, floor: [58, 68, 52] as const, accent: '#91d9a5', light: '#a8e4a0', map: '#365447', wall: '#91a88b', roster: ['stalker', 'hound', 'archer', 'brute', 'caster'] as const }),
    foundry: Object.freeze({ id: 'foundry', name: 'Cinder Foundry', bossName:'Furnace Sovereign', description: 'Basalt galleries, cold anvils and furnaces still burning below.', ambient: '#291b1d', stone: [78, 57, 50] as const, floor: [63, 49, 46] as const, accent: '#ffad64', light: '#ff9952', map: '#654238', wall: '#c89b75', roster: ['emberAcolyte', 'brute', 'archer', 'stormSentinel', 'stalker'] as const }),
    drowned: Object.freeze({ id: 'drowned', name: 'Drowned Vault', bossName:'The Drowned Matron', description: 'Blue limestone, shallow water channels and luminous crystals.', ambient: '#152433', stone: [54, 72, 85] as const, floor: [42, 63, 76] as const, accent: '#7ed9f2', light: '#80d2f3', map: '#324e66', wall: '#86b6c8', roster: ['frostRevenant', 'mireSpitter', 'wisp', 'stalker', 'archer'] as const }),
    rime: Object.freeze({id:'rime',name:'Rime Cathedral',description:'Frozen nave, shattered rose windows and hoarfrost reliquaries.',ambient:'#172435',stone:[69,87,105] as const,floor:[57,73,91] as const,accent:'#b5e8ff',light:'#9bd7ff',map:'#425d74',wall:'#b4d4df',roster:['frostRevenant','wisp','archer','brute'] as const,boss:'warden',bossName:'The Rime Prelate'}),
    ossuary: Object.freeze({id:'ossuary',name:'Sunken Ossuary',description:'Ochre burial halls, bone niches and fallen sandstone idols.',ambient:'#30241f',stone:[112,89,60] as const,floor:[88,69,48] as const,accent:'#e6c18a',light:'#f5c87f',map:'#756047',wall:'#ceb78b',roster:['stalker','archer','brute','caster'] as const,boss:'graveMarshal',bossName:'The Sepulchral King'}),
    astral: Object.freeze({id:'astral',name:'Astral Archive',description:'Violet marble, bronze orreries and sealed star charts.',ambient:'#221a34',stone:[76,63,99] as const,floor:[55,48,75] as const,accent:'#ceadff',light:'#bda1ff',map:'#55446b',wall:'#c4addd',roster:['stormSentinel','wisp','caster','archer'] as const,boss:'warden',bossName:'The Astral Custodian'}),
    blackrock: BLACKROCK_DEPTHS,
    nerubian: Object.freeze({id:'nerubian',name:'Nerubian Ziggurat',description:'Web-shrouded ziggurat halls, chitin reliefs and cold teal witchfire.',ambient:'#12262a',stone:[52,80,80] as const,floor:[40,66,68] as const,accent:'#6fd8ce',light:'#7fe0d6',map:'#2c4c50',wall:'#8fb8b2',roster:['stalker','caster','brute','hound','archer'] as const,boss:'graveMarshal',bossName:'The Nerubian Underking'}),
    titankeep: Object.freeze({id:'titankeep',name:'Titankeep Halls',description:'Titan-cut stone, brass runes and arcane gold conduits.',ambient:'#26221a',stone:[96,88,66] as const,floor:[80,72,54] as const,accent:'#e8c96a',light:'#f2d67c',map:'#5c5238',wall:'#c9b98a',roster:['stormSentinel','brute','caster','archer','wisp'] as const,boss:'ashColossus',bossName:'The Titan Keeper'}),
    frostmourne: Object.freeze({id:'frostmourne',name:'Frozen Halls',description:'Frozen citadel galleries, pale blue ice and chained souls.',ambient:'#141f2e',stone:[62,80,100] as const,floor:[50,68,88] as const,accent:'#a5d8ff',light:'#8fc9ff',map:'#3a5468',wall:'#a9c8dd',roster:['frostRevenant','stalker','caster','brute','archer'] as const,boss:'warden',bossName:'Herald of the Lich King'}),
    violet: Object.freeze({id:'violet',name:'Violet Hold',description:'Arcane prison tiers, violet wards and bound portal cells.',ambient:'#1e1730',stone:[72,58,96] as const,floor:[58,46,80] as const,accent:'#b98cff',light:'#c49aff',map:'#4a3a66',wall:'#b9a3d8',roster:['caster','wisp','stormSentinel','stalker','archer'] as const,boss:'warden',bossName:'The Violet Jailer'}),
});
/** Procedural roll pool: the original seven themes only. The WotLK themes stay
 * reachable through explicit theme selection and authored entrances so existing
 * seeds keep their theme rolls; validation accepts every registered theme. */
export const DUNGEON_THEME_IDS = Object.freeze(['rootbound', 'foundry', 'drowned', 'rime', 'ossuary', 'astral', 'blackrock'] as const satisfies readonly DungeonThemeId[]);
export const dungeonTheme = (seed: number, theme?: DungeonThemeId): DungeonTheme => DUNGEON_THEMES[theme ?? (['rootbound', 'foundry', 'drowned'] as const)[(seed >>> 0) % 3]];
export type DungeonEventKind = 'reliquary' | 'ward' | 'champion';
export interface DungeonEventRecipe { name: string; action: string; objective: string; rules: Readonly<WaveRules>; size: number }
export const DUNGEON_EVENTS: Readonly<Record<DungeonEventKind, DungeonEventRecipe>> = Object.freeze({
    reliquary: Object.freeze({ name: 'Bound Reliquary', action: 'Unseal the reliquary', objective: 'Defeat the awakened waves', size: 5, rules: Object.freeze({ count: 3, duration: 0, interval: 2, hold: 0 }) }),
    ward: Object.freeze({ name: 'Fading Ward', action: 'Rekindle the ward', objective: 'Hold the circle and defeat its guardians', size: 6, rules: Object.freeze({ count: 2, duration: 0, interval: 2, hold: 10 }) }),
    champion: Object.freeze({ name: 'Oathbound Sentinel', action: 'Challenge the sentinel', objective: 'Defeat the elite and its retinue', size: 8, rules: Object.freeze({ count: 1, duration: 0, interval: 0, hold: 0 }) }),
});
