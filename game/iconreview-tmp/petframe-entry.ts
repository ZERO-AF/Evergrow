import { drawFloatingHUD } from '../src/hud.ts';
import { WEAPON_PROFILES } from '../src/weapon-content.ts';
import type { Player, Ally } from '../src/model.ts';
const cv = document.getElementById('c') as HTMLCanvasElement;
const c = cv.getContext('2d')!;
c.fillStyle = '#0b1520'; c.fillRect(0, 0, cv.width, cv.height);
const pet = { id: 7, name: 'Clawjaw', family: 'wolf', species: 'wolf', level: 12, experience: 0, command: 'attack' };
const ally = { id: 3, kind: 'wolf', x: 0, y: 0, prevX: 0, prevY: 0, angle: 0, hp: 34, maxHp: 60,
  radius: 8, attackCooldown: 0, stationary: false, targetId: null, petId: 7 } as unknown as Ally;
const p = {
  hp: 210, maxHp: 260, mana: 80, maxMana: 120, level: 12, name: 'Huntress',
  character: { name: 'Huntress', classId: 'hunter', raceId: 'nightElf', level: 12,
    pets: { active: pet, stable: [pet] }, skillSlots: [], allocatedNodes: [], actionBars: [], learnedSkills: {},
    skillRanks: {}, activeSkillRanks: {}, skillSpecializations: {} },
  allies: [ally], petCommand: 'follow', buffs: [], castTime: 0,
  skillCooldowns: {}, derived: {}, attack: null, dead: false,
  affixBuffs: {}, auras: { reservation: 0 },
  equipment: { mainHand: WEAPON_PROFILES.find(w => w.id === 'thorn-shortbow') ?? null, offHand: null },
} as unknown as Player;
try { drawFloatingHUD(c, p, cv.width, cv.height, 1.2, {}); } catch (e) { document.title = 'ERR ' + (e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 6).join(' << ') : String(e)); }
(document as unknown as { done: boolean }).done = true;
