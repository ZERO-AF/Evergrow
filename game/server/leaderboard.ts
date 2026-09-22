import type { CloudEnv } from './worker.ts';
import { backfillRankings } from './leaderboard-backfill.ts';
import type { LeaderboardEntry, LeaderboardSnapshot } from '../src/leaderboard.ts';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
/** Query only small public projections. Private owner IDs and save objects never leave this handler. */
export async function leaderboardAPI(request:Request,env:CloudEnv,owner:string|null):Promise<Response> {
  const url=new URL(request.url);
  if(url.pathname!=='/api/cloud/leaderboard')return json({error:'Not found.'},404);
  if(request.method!=='GET')return json({error:'Method not allowed.'},405);
  const order=url.searchParams.get('order')??'level';if(order!=='level'&&order!=='gear'&&order!=='rift')return json({error:'Unknown ranking.'},400);
  const updating=await backfillRankings(env);
  const sort=order==='rift'?'rank_rift DESC, rank_rift_seconds ASC':order==='gear'?'rank_gear DESC, rank_level DESC':'rank_level DESC, rank_gear DESC';
  const {results}=await env.DB.prepare(`WITH ranked AS (
    SELECT c.owner,c.slot,c.rank_name,c.rank_level,c.rank_gear,c.rank_rift,c.rank_rift_seconds,c.updated_at,
      ROW_NUMBER() OVER(ORDER BY ${sort},c.owner ASC,c.slot ASC) AS place, COUNT(*) OVER() AS total
    FROM characters c
    WHERE c.object IS NOT NULL AND c.rank_name IS NOT NULL
  ) SELECT owner,rank_name,rank_level,rank_gear,rank_rift,rank_rift_seconds,updated_at,place,total FROM ranked WHERE place<=100 OR owner=? ORDER BY place`)
    .bind(owner??'').all<{owner:string;rank_name:string;rank_level:number;rank_gear:number|null;rank_rift:number|null;rank_rift_seconds:number|null;updated_at:number;place:number;total:number}>();
  const project=(r:typeof results[number]):LeaderboardEntry=>({rank:r.place,name:r.rank_name,level:r.rank_level,gearPower:r.rank_gear,riftTier:r.rank_rift!==null&&r.rank_rift>=0?r.rank_rift:null,riftSeconds:r.rank_rift_seconds!==null&&r.rank_rift_seconds>=0?r.rank_rift_seconds:null,updatedAt:r.updated_at,mine:r.owner===owner});
  const own=results.filter(r=>r.owner===owner).map(project);
  const snapshot:LeaderboardSnapshot={entries:results.filter(r=>r.place<=100).map(project),own,signedIn:!!owner,total:results[0]?.total??0,updating};
  return json(snapshot);
}
