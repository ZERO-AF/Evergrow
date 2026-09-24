import type { Settlement } from './settlements.ts';
import { circleHitsRect } from './settlements.ts';
import { hashService } from './npcs.ts';
export interface Resident {id:string;seed:number;name:string;x:number;y:number;angle:number;moving:number;child:boolean;household:string;}
const NAMES=['Elin','Tomas','Nessa','Ronan','Ada','Finn','Hilda','Orin','Lysa','Bram','Anja','Silas','Mina','Petra','Ivo','Cora'];

/** Per-town static data: the resident roster (id/seed/name/home) plus each
 * walker's path and segment lengths. Settlements are frozen generation data,
 * so this is computed once and the per-frame call only updates positions. */
interface WalkerPlan { path: Array<[number, number]>; lengths: number[]; total: number; }
interface ResidentPlan { resident: Resident; home?: Settlement['buildings'][number]; walker?: WalkerPlan; offset?: number }
interface TownPlan { homes: ResidentPlan[]; walkers: ResidentPlan[]; }
const townPlans = new WeakMap<Settlement, TownPlan>();

function planFor(town: Settlement): TownPlan {
  let plan = townPlans.get(town);
  if (plan) return plan;
  const homes: ResidentPlan[] = [];
  for (const home of town.buildings.filter(b => b.kind === 'house' || b.kind === 'inn' || b.kind === 'noble')) {
    const family = 2 + home.seed % 3;
    for (let i = 0; i < family; i++) {
      const id = `${home.id}:resident:${i}`, seed = hashService(id), child = i > 1;
      homes.push({ home, offset: i % 2 ? 17 : -17,
        resident: { id, seed, name: NAMES[seed % NAMES.length], x: 0, y: 0, angle: 0, moving: 0, child, household: home.id } });
    }
  }
  const walkers: ResidentPlan[] = [];
  const count = town.kind === 'settlement' ? 3 : town.kind === 'village' ? 6 : 10;
  for (let i = 0; i < count; i++) {
    const id = `${town.id}:walker:${i}`, seed = hashService(id), path = town.paths[2 + i % Math.max(1, town.paths.length - 2)].points;
    const lengths = path.slice(1).map((p, j) => Math.hypot(p[0] - path[j][0], p[1] - path[j][1]));
    const total = lengths.reduce((a, b) => a + b, 0);
    walkers.push({ walker: { path, lengths, total },
      resident: { id, seed, name: NAMES[seed % NAMES.length], x: 0, y: 0, angle: 0, moving: 0, child: false, household: town.id } });
  }
  plan = { homes, walkers };
  townPlans.set(town, plan);
  return plan;
}

/** Residents are non-colliding ambient life. Analytic schedules follow checked household aisles or generated paths.
 * The returned Resident objects are pooled per town — positions are restamped
 * each call; callers must not retain them across frames. */
export function settlementResidents(town: Settlement, time: number): Resident[] {
  const plan = planFor(town);
  const result: Resident[] = [];
  for (const { home, resident, offset } of plan.homes) {
    const seed = resident.seed;
    const mid = home!.door.x, back = home!.y + 62, front = home!.door.y - 18;
    const t = time * .16 + seed % 19, u = (1 - Math.cos(t)) * .5;
    let x = mid + offset!;
    const y = back + (front - back) * u;
    // Both parents and children remain within their furnished home's free center aisle.
    if (home!.furniture.some(r => circleHitsRect(x, y, 7, r))) x = mid;
    resident.x = x; resident.y = y;
    resident.angle = Math.sin(t) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    resident.moving = Math.abs(Math.sin(t)) * .22;
    result.push(resident);
  }
  for (const { walker, resident } of plan.walkers) {
    const { path, lengths, total } = walker!;
    const seed = resident.seed;
    const cycle = (time * 13 + seed % 500) % (total * 2 + 100), walking = cycle < total || cycle > total + 50 && cycle < total * 2 + 50;
    let distance = cycle <= total ? cycle : cycle < total + 50 ? total : cycle < total * 2 + 50 ? total * 2 + 50 - cycle : 0;
    let k = 0; while (k < lengths.length - 1 && distance > lengths[k]) distance -= lengths[k++];
    const a = path[k], b = path[k + 1], u = Math.max(0, Math.min(1, distance / (lengths[k] || 1))), reverse = cycle > total + 50;
    resident.x = a[0] + (b[0] - a[0]) * u; resident.y = a[1] + (b[1] - a[1]) * u;
    resident.angle = Math.atan2(b[1] - a[1], b[0] - a[0]) + (reverse ? Math.PI : 0);
    resident.moving = walking ? .28 : 0;
    result.push(resident);
  }
  return result;
}
export const RESIDENT_HINTS:Record<string,readonly string[]>={
  deadwood:['The dead gather by old stones.','Keep a flame for the deadwood.'],
  verdant:['The green hides more than trees.','Watch for thorns beyond the road.'],
  swamp:['The mire spits back. Keep moving.','Dry banks make safer crossings.'],
  frostpine:['Ice slows the unwary.','Pack warm cloth for the pines.'],
  emberfall:['Do not linger on burning ground.','Ash hides the foundry doors.'],
  autumn:['Old roads sleep under the leaves.','Amber groves shelter travellers.'],
  highlands:['Ruins watch the high passes.','The hills have hungry shadows.'],
  steppe:['You can see danger coming here.','Keep a road within sight.'],
  sunscar:['Ruins lie beyond the dunes.','Silver turns up in hard country.'],
};
export function residentHint(seed:number,biome:string,visit:number):string{
  const general=['Store spare gear by the fire.','The gambler makes no promises.','A town portal brings you home.','Harder foes carry better gear.','Use the journal to find a town.','Potion charges refill as foes fall.'];
  const lines=[...(RESIDENT_HINTS[biome]??RESIDENT_HINTS.deadwood),...general];return lines[(seed+visit)%lines.length];
}
