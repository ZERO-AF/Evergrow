import test from 'node:test';
import { createWowSim } from './fixtures/wow-sim.ts';
import { enterPvpMatch } from '../src/pvp-instance.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { validExpeditions } from '../src/dungeon-validation.ts';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { generateDungeon } from '../src/dungeon.ts';
import { currentDungeon } from '../src/dungeon-state.ts';

const surface: any = { seed: 7319, blocked: () => false, move: (x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy}), sampleBiome: () => ({id:'deadwood'}) };

test('repro checkpoint validation', async () => {
  const sim = createWowSim('warrior');
  sim.player.x = 600; sim.player.y = 0;
  const setup: any = { mode:'arena', bracket:'2v2', teammates:[{classId:'priest',role:'heal'}], custom:null };
  let captured: any = null;
  const host: any = { surface:()=>surface, persist:(c:any)=>{captured=c;return{ok:true,message:''}}, restoreWorld:(c:any)=>{const run=currentDungeon(c.expeditions);sim.world=run?new DungeonWorld(generateDungeon(run.entrance.seed,run.entrance.level,run.entrance),run.entrance):surface;}, arrived:()=>{} };
  const res = await enterPvpMatch(sim, setup, host);
  console.log('enter ok:', res.ok, res.message);
  const cp = captured ?? sim.captureCheckpoint();
  const json = JSON.stringify({version:6,id:'test',name:'Test',worldSeed:7319,worldVersion:5,createdAt:1,updatedAt:2,checkpoint:cp});
  const decoded = decodeCharacterSave(json);
  console.log('decoded:', !!decoded);
  if(!decoded){
    const p:any = cp;
    console.log('expeditions valid:', validExpeditions(p.expeditions));
    const run = p.expeditions?.runs?.[0];
    if(run){ console.log('run keys:', Object.keys(run)); console.log('pvp keys:', run.pvp?Object.keys(run.pvp):'none'); }
  }
});
