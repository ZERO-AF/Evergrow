import { dungeonRunChest, dungeonRunExit } from './dungeon-locations.ts';
import { currentDungeon, type Expeditions } from './dungeon-state.ts';
import { dungeonChestMask } from './expedition-route.ts';
import { dungeonTheme } from './dungeon-content.ts';
import { isRaidEntranceId, RAID_BOSS_NAME } from './raid-boss-content.ts';
import { isRaid2EntranceId, RAID2_BOSS_NAME } from './raid2-boss-content.ts';
import { isRaid3EntranceId, RAID3_BOSS_NAME } from './raid3-boss-content.ts';
import { isRaid4EntranceId, RAID4_BOSS_NAME } from './raid4-boss-content.ts';
import { isRaid5EntranceId, RAID5_BOSS_NAME } from './raid5-boss-content.ts';
import { isRaid6EntranceId, RAID6_BOSS_NAME } from './raid6-boss-content.ts';
import { isRaid7EntranceId, RAID7_BOSS_NAME } from './raid7-boss-content.ts';
import { isRaid8EntranceId, RAID8_BOSS_NAME } from './raid8-boss-content.ts';
import { isRaid9EntranceId, RAID9_BOSS_NAME } from './raid9-boss-content.ts';
import type { DungeonFloor } from './dungeon.ts';
import type { JourneyMarker } from './journey-marker.ts';

export interface DungeonJourney {
  id: string;
  name: string;
  level: number;
  objective: string;
  phase: 'boss' | 'chest' | 'exit';
  marker: JourneyMarker | null;
  stage?: number;
}
/** Temporary local guidance; never replaces the player's saved surface pin. */
export function dungeonJourney(state: Expeditions, floor: DungeonFloor | null | undefined): DungeonJourney | null {
  const run = currentDungeon(state);
  if (!run || !floor) return null;
  if(run.rift){
    const phase=run.rift.phase==='complete'?(run.rift.claimed?'exit':'chest'):'boss';
    const objective=run.rift.phase==='hunt'?`Cull monsters · ${run.rift.points} / 600`:phase==='boss'?'Slay the rift guardian':phase==='chest'?'Claim the rift chest':'Return to town';
    const target=phase==='exit'?dungeonRunExit(floor,run):phase==='chest'?dungeonRunChest(floor,run,2):run.states.warden;
    return {id:run.entrance.id,name:run.entrance.name,level:run.entrance.level,objective,phase,marker:run.rift.phase==='hunt'?null:{x:target.x,y:target.y,name:objective,known:true}};
  }
  const boss = run.states.warden;
  const bossName = isRaidEntranceId(run.entrance.id) ? RAID_BOSS_NAME : isRaid2EntranceId(run.entrance.id) ? RAID2_BOSS_NAME : isRaid3EntranceId(run.entrance.id) ? RAID3_BOSS_NAME : isRaid4EntranceId(run.entrance.id) ? RAID4_BOSS_NAME : isRaid5EntranceId(run.entrance.id) ? RAID5_BOSS_NAME : isRaid6EntranceId(run.entrance.id) ? RAID6_BOSS_NAME : isRaid7EntranceId(run.entrance.id) ? RAID7_BOSS_NAME : isRaid8EntranceId(run.entrance.id) ? RAID8_BOSS_NAME : isRaid9EntranceId(run.entrance.id) ? RAID9_BOSS_NAME : dungeonTheme(run.entrance.seed, run.entrance.theme).bossName ?? 'Hollow Warden';
  const phase = boss.hp > 0 ? 'boss' : run.chestMasks[2] === dungeonChestMask(run, 2) ? 'exit' : 'chest';
  const objective = phase === 'boss' ? `Defeat ${bossName}` : phase === 'chest' ? 'Claim the boss chest' : 'Return to the surface';
  const target = phase === 'boss' ? boss : phase === 'chest' ? floor.chests[2] : floor.exit;
  let marker: JourneyMarker | null = { x: target.x, y: target.y, name: objective, known: true };
  const bossRoom = floor.rooms.find(r => r.kind === 'boss');
  if (phase === 'boss' && bossRoom && !run.explored.includes(bossRoom.id)) {
    // Guide to the revealed doorway on the route to the boss, not to an arbitrary side room.
    const toward = new Map<number, number>(), queue = [bossRoom.id];
    const visited = new Set(queue);
    for (let i = 0; i < queue.length; i++) for (const [a,b] of floor.edges) {
      const next = a === queue[i] ? b : b === queue[i] ? a : undefined;
      if (next !== undefined && !visited.has(next)) { visited.add(next); toward.set(next, queue[i]); queue.push(next); }
    }
    const fromId = queue.find(id => run.explored.includes(id));
    const toId = fromId === undefined ? undefined : toward.get(fromId);
    const from = floor.rooms.find(r => r.id === fromId), to = floor.rooms.find(r => r.id === toId);
    const connection=floor.edges.findIndex(([a,b])=>a===fromId&&b===toId||a===toId&&b===fromId);
    const passage=floor.corridors.find(c=>c.connection===connection);
    const point=passage?.path?.[Math.floor(passage.path.length/2)];
    marker = point ? {...point,known:false,name:objective} : from && to ? { x: to.x+to.width/2, y: to.y+to.height/2, known:false, name:objective } : null;
  }
  return { id: run.entrance.id, name: run.entrance.name, level: run.entrance.level + 3, objective, phase, marker,
    ...(run.entrance.expedition ? {stage: run.entrance.expedition.stage + 1} : {}) };
}
