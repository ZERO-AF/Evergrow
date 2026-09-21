// Merge: my authored grid rects (positions) + wow-zones.json (content) → final
// world-atlas ZONES/TRANSPORTS TS block. Validates non-overlap + adjacency + transports.
import fs from 'fs';
const CELL = 20000;
const data = JSON.parse(fs.readFileSync('wayfinder/wow-zones.json','utf8'));
const byId = Object.fromEntries(data.zones.map(z=>[z.id,z]));

// rect layout keyed by DATASET zone id: [continent, col,row,cw,ch]
const L = {
  // KALIMDOR (mainland cols 4-15, islands 0-2)
  'teldrassil':['kalimdor',0,1,3,2],'bloodmyst':['kalimdor',0,5,3,2],'azuremyst':['kalimdor',0,7,3,3],
  'moonglade':['kalimdor',7,0,3,2],'winterspring':['kalimdor',10,0,6,3],'darkshore':['kalimdor',4,0,3,6],
  'felwood':['kalimdor',7,3,4,3],'azshara':['kalimdor',11,3,5,4],'ashenvale':['kalimdor',4,6,7,4],
  'durotar':['kalimdor',12,7,4,5],'stonetalon':['kalimdor',4,10,3,3],
  'barrens-north':['kalimdor',7,10,5,3],'barrens-south':['kalimdor',7,13,5,2],
  'dustwallow':['kalimdor',12,12,4,3],'desolace':['kalimdor',4,13,3,3],
  'mulgore':['kalimdor',7,15,3,3],'thousand-needles':['kalimdor',10,15,2,3],
  'feralas':['kalimdor',4,16,3,2],'tanaris':['kalimdor',12,15,4,5],
  'ungoro':['kalimdor',10,18,2,2],'silithus':['kalimdor',4,18,6,2],
  // EASTERN KINGDOMS
  'eversong':['eastern-kingdoms',8,0,6,2],'ghostlands':['eastern-kingdoms',8,2,6,1],
  'tirisfal':['eastern-kingdoms',0,3,4,3],'western-plaguelands':['eastern-kingdoms',4,3,4,3],
  'eastern-plaguelands':['eastern-kingdoms',8,3,6,3],'silverpine':['eastern-kingdoms',0,6,3,3],
  'hillsbrad':['eastern-kingdoms',3,6,4,3],'hinterlands':['eastern-kingdoms',8,6,6,3],
  'alterac':['eastern-kingdoms',3,9,4,2],'arathi':['eastern-kingdoms',7,9,4,2],
  'wetlands':['eastern-kingdoms',5,11,3,2],'dun-morogh':['eastern-kingdoms',2,11,3,3],
  'loch-modan':['eastern-kingdoms',5,13,3,2],'searing-gorge':['eastern-kingdoms',3,14,2,2],
  'badlands':['eastern-kingdoms',6,15,3,2],'burning-steppes':['eastern-kingdoms',3,16,3,2],
  'elwynn':['eastern-kingdoms',0,14,3,3],'westfall':['eastern-kingdoms',0,17,3,3],
  'redridge':['eastern-kingdoms',3,18,3,2],'swamp-of-sorrows':['eastern-kingdoms',6,18,3,2],
  'duskwood':['eastern-kingdoms',0,20,3,3],'deadwind':['eastern-kingdoms',3,20,3,2],
  'blasted-lands':['eastern-kingdoms',6,20,5,3],'stranglethorn':['eastern-kingdoms',0,23,5,2],
  // NORTHREND
  'icecrown':['northrend',3,0,4,3],'storm-peaks':['northrend',7,0,3,3],'zuldrak':['northrend',10,0,4,3],
  'sholazar':['northrend',0,3,4,3],'crystalsong':['northrend',4,3,4,3],'grizzly-hills':['northrend',10,3,4,3],
  'borean-tundra':['northrend',0,6,4,4],'dragonblight':['northrend',4,6,6,3],
  'howling-fjord':['northrend',10,6,4,4],'wintergrasp':['northrend',4,9,4,1],
  // OUTLAND
  'hellfire':['outland',4,0,4,3],'netherstorm':['outland',8,0,4,3],'zangarmarsh':['outland',0,3,4,3],
  'terokkar':['outland',4,3,4,3],'shadowmoon':['outland',8,3,4,5],'nagrand':['outland',0,6,4,2],
  'blades-edge':['outland',4,6,4,2],
};

const fac = f => ({Alliance:'alliance',Horde:'horde',Neutral:'neutral',Contested:'contested',Hostile:'hostile'}[f]||'contested');
const zones = [];
for (const id in L) {
  const d = byId[id]; if(!d){console.log('MISSING dataset zone',id);continue;}
  const [cont,col,row,cw,ch]=L[id];
  zones.push({id,continent:cont,rect:{x:col*CELL,y:row*CELL,w:cw*CELL,h:ch*CELL},d});
}
// validate non-overlap
let errs=[];
for(let i=0;i<zones.length;i++)for(let j=i+1;j<zones.length;j++){
  const a=zones[i],b=zones[j];if(a.continent!==b.continent)continue;const A=a.rect,B=b.rect;
  if(A.x<B.x+B.w&&B.x<A.x+A.w&&A.y<B.y+B.h&&B.y<A.y+A.h)errs.push(`OVERLAP ${a.id} x ${b.id}`);
}
// transports resolve
for(const t of data.transports){if(!byId[t.from.zone])errs.push(`T from ${t.from.zone}`);if(!byId[t.to.zone])errs.push(`T to ${t.to.zone}`);}
console.log('zones:',zones.length,'transports:',data.transports.length);
if(errs.length){errs.forEach(e=>console.log(' ',e));process.exit(1);}
console.log('OK no overlaps, transports resolve.');

// emit zone() calls
const q=s=>`'${String(s).replace(/'/g,"\\'")}'`;
const arr=(a,f)=>a&&a.length?`[${a.map(f).join(',')}]`:'[]';
let ts='';
for(const z of zones){
  const d=z.d,r=z.rect;
  const cities=arr(d.cities,c=>`{name:${q(c.name)},faction:${q(fac(c.faction))},nx:${c.x},ny:${c.y},tier:'town'}`);
  const dungs=arr(d.dungeons,g=>`{name:${q(g.name)},nx:${g.x},ny:${g.y},levelMin:${d.levelMin},levelMax:${d.levelMax},kind:${q(g.raid?'raid':'dungeon')}}`);
  const docks=arr(d.docks,k=>`{name:${q(k.name)},faction:${q(fac(k.faction||d.faction))},nx:${k.x},ny:${k.y},routes:[]}`);
  const fps=arr(d.flightpaths,f=>`{name:${q(f.name)},faction:${q(fac(f.faction||d.faction))},nx:${f.x},ny:${f.y}}`);
  const borders=`{north:${d.borders?.north?q(d.borders.north):'null'},south:${d.borders?.south?q(d.borders.south):'null'},east:${d.borders?.east?q(d.borders.east):'null'},west:${d.borders?.west?q(d.borders.west):'null'}}`;
  ts+=`  ${q(z.id)}: zone(${q(z.id)},${q(d.name)},${q(z.continent)}, ${r.x},${r.y},${r.w},${r.h}, ${d.levelMin},${d.levelMax}, ${q(fac(d.faction))},${q(d.biome)}, {borders:${borders},cities:${cities},dungeons:${dungs},docks:${docks},flightpaths:${fps}}),\n`;
}
let tt='';
for(const t of data.transports){
  const id=`${t.kind}-${t.from.zone}-${t.to.zone}-${(t.from.name||'').replace(/[^a-z0-9]/gi,'')}-${(t.to.name||'').replace(/[^a-z0-9]/gi,'')}`.toLowerCase().slice(0,80);
  tt+=`  transport(${q(id)},${q(t.kind)},${q(t.from.zone)},${q(t.from.name)},${q(t.to.zone)},${q(t.to.name)},${t.durationSec},${q(fac(t.faction||'contested'))}),\n`;
}
fs.writeFileSync('wayfinder/atlas-zones-full.ts.txt', ts);
fs.writeFileSync('wayfinder/atlas-transports-full.ts.txt', tt);
console.log('wrote atlas-zones-full.ts.txt + atlas-transports-full.ts.txt');
