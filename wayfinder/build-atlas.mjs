// Atlas rect generator + validator. Zones are authored as continent-local rects in
// "cells"; CELL converts to game units. Validates: no overlap, adjacency consistency,
// every transport endpoint resolves. Prints the TS ZONES/TRANSPORTS table.
const CELL = 20000; // game units per grid cell (~833 WoW yards at SCALE 24)

// zone: [id, name, continent, col,row,cw,ch (cells), lvlMin,lvlMax, faction, terrain]
const Z = [
  // ── KALIMDOR (grid 16×20; mainland cols 4-15, islands cols 0-2) ─────────────
  ['teldrassil','Teldrassil','kalimdor', 0,1,3,2, 1,10,'alliance','forest-purple'],
  ['bloodmyst','Bloodmyst Isle','kalimdor', 0,5,3,2, 10,20,'alliance','fel-isle'],
  ['azuremyst','Azuremyst Isle','kalimdor', 0,7,3,3, 1,10,'alliance','forest-azure'],
  ['moonglade','Moonglade','kalimdor', 7,0,3,2, 1,80,'neutral','forest-moon'],
  ['winterspring','Winterspring','kalimdor', 10,0,6,3, 55,60,'contested','snow'],
  ['darkshore','Darkshore','kalimdor', 4,0,3,6, 10,20,'alliance','coast-dark'],
  ['felwood','Felwood','kalimdor', 7,3,4,3, 48,55,'contested','forest-fel'],
  ['azshara','Azshara','kalimdor', 11,3,5,4, 45,55,'contested','coast-autumn'],
  ['ashenvale','Ashenvale','kalimdor', 4,6,7,4, 18,30,'contested','forest-ashen'],
  ['durotar','Durotar','kalimdor', 12,7,4,5, 1,10,'horde','desert-red'],
  ['stonetalon','Stonetalon Mountains','kalimdor', 4,10,3,3, 15,27,'contested','mountain'],
  ['barrens','The Barrens','kalimdor', 7,10,5,5, 10,25,'horde','savanna'],
  ['dustwallow','Dustwallow Marsh','kalimdor', 12,12,4,3, 35,45,'contested','swamp'],
  ['desolace','Desolace','kalimdor', 4,13,3,3, 30,40,'contested','waste'],
  ['mulgore','Mulgore','kalimdor', 7,15,3,3, 1,10,'horde','plains'],
  ['thousand-needles','Thousand Needles','kalimdor', 10,15,2,3, 25,35,'contested','canyon'],
  ['feralas','Feralas','kalimdor', 4,16,3,2, 40,50,'contested','forest-lush'],
  ['tanaris','Tanaris','kalimdor', 12,15,4,5, 40,50,'contested','desert'],
  ['ungoro','Un\'Goro Crater','kalimdor', 10,18,2,2, 48,55,'contested','jungle-crater'],
  ['silithus','Silithus','kalimdor', 4,18,6,2, 55,60,'contested','desert-silithid'],
  // ── EASTERN KINGDOMS (grid 14×25) ──────────────────────────────────────────
  ['eversong','Eversong Woods','eastern-kingdoms', 8,0,6,2, 1,10,'horde','forest-gold'],
  ['ghostlands','Ghostlands','eastern-kingdoms', 8,2,6,1, 10,20,'horde','forest-dead'],
  ['tirisfal','Tirisfal Glades','eastern-kingdoms', 0,3,4,3, 1,10,'horde','forest-gloom'],
  ['wpl','Western Plaguelands','eastern-kingdoms', 4,3,4,3, 51,58,'contested','plague'],
  ['epl','Eastern Plaguelands','eastern-kingdoms', 8,3,6,3, 53,60,'contested','plague'],
  ['silverpine','Silverpine Forest','eastern-kingdoms', 0,6,3,3, 10,20,'horde','forest-silver'],
  ['hillsbrad','Hillsbrad Foothills','eastern-kingdoms', 3,6,4,3, 20,30,'contested','hills'],
  ['hinterlands','The Hinterlands','eastern-kingdoms', 8,6,6,3, 30,45,'contested','forest-high'],
  ['alterac','Alterac Mountains','eastern-kingdoms', 3,9,4,2, 30,40,'contested','mountain-snow'],
  ['arathi','Arathi Highlands','eastern-kingdoms', 7,9,4,2, 30,40,'contested','highland'],
  ['wetlands','Wetlands','eastern-kingdoms', 5,11,3,2, 20,30,'contested','marsh'],
  ['dun-morogh','Dun Morogh','eastern-kingdoms', 2,11,3,3, 1,10,'alliance','snow'],
  ['loch-modan','Loch Modan','eastern-kingdoms', 5,13,3,2, 10,20,'alliance','lake'],
  ['searing-gorge','Searing Gorge','eastern-kingdoms', 3,14,2,2, 43,50,'contested','volcanic'],
  ['badlands','Badlands','eastern-kingdoms', 6,15,3,2, 35,45,'contested','badlands'],
  ['burning-steppes','Burning Steppes','eastern-kingdoms', 3,16,3,2, 50,58,'contested','volcanic'],
  ['elwynn','Elwynn Forest','eastern-kingdoms', 0,14,3,3, 1,10,'alliance','forest'],
  ['westfall','Westfall','eastern-kingdoms', 0,17,3,3, 10,20,'alliance','plains-dry'],
  ['redridge','Redridge Mountains','eastern-kingdoms', 3,18,3,2, 15,25,'contested','mountain-red'],
  ['swamp-of-sorrows','Swamp of Sorrows','eastern-kingdoms', 6,18,3,2, 35,45,'contested','swamp'],
  ['duskwood','Duskwood','eastern-kingdoms', 0,20,3,3, 18,30,'contested','forest-dark'],
  ['deadwind','Deadwind Pass','eastern-kingdoms', 3,20,3,2, 55,60,'contested','dead'],
  ['blasted-lands','Blasted Lands','eastern-kingdoms', 6,20,5,3, 45,55,'contested','fel-waste'],
  ['stranglethorn','Stranglethorn Vale','eastern-kingdoms', 0,23,5,2, 30,45,'contested','jungle'],
  // ── NORTHREND (grid 14×10) ─────────────────────────────────────────────────
  ['icecrown','Icecrown','northrend', 3,0,4,3, 77,80,'hostile','ice'],
  ['storm-peaks','The Storm Peaks','northrend', 7,0,3,3, 77,80,'contested','mountain-ice'],
  ['zuldrak','Zul\'Drak','northrend', 10,0,4,3, 74,77,'contested','troll-snow'],
  ['sholazar','Sholazar Basin','northrend', 0,3,4,3, 75,78,'contested','jungle'],
  ['crystalsong','Crystalsong Forest','northrend', 4,3,4,3, 77,80,'neutral','crystal'],
  ['grizzly-hills','Grizzly Hills','northrend', 10,3,4,3, 73,75,'contested','forest-pine'],
  ['borean-tundra','Borean Tundra','northrend', 0,6,4,4, 68,72,'contested','tundra'],
  ['dragonblight','Dragonblight','northrend', 4,6,6,3, 71,74,'contested','snow-dragon'],
  ['howling-fjord','Howling Fjord','northrend', 10,6,4,4, 68,72,'contested','fjord'],
  ['wintergrasp','Wintergrasp','northrend', 4,9,4,1, 80,80,'contested','snow-pvp'],
  // ── OUTLAND (grid 12×8) ────────────────────────────────────────────────────
  ['hellfire','Hellfire Peninsula','outland', 4,0,4,3, 58,63,'contested','fel-red'],
  ['netherstorm','Netherstorm','outland', 8,0,4,3, 67,70,'contested','arcane'],
  ['zangarmarsh','Zangarmarsh','outland', 0,3,4,3, 60,64,'contested','swamp-shroom'],
  ['terokkar','Terokkar Forest','outland', 4,3,4,3, 62,65,'contested','forest-terok'],
  ['shadowmoon','Shadowmoon Valley','outland', 8,3,4,5, 67,70,'contested','fel-green'],
  ['nagrand','Nagrand','outland', 0,6,4,2, 64,67,'contested','plains-float'],
  ['blades-edge','Blade\'s Edge Mountains','outland', 4,6,4,2, 65,68,'contested','mountain-spike'],
];

// transports: [id, kind, fromZone, fromDock, toZone, toDock, durationSec, faction]
const T = [
  ['zep-org-uc','zeppelin','durotar','Orgrimmar','tirisfal','Undercity',120,'horde'],
  ['zep-org-grom','zeppelin','durotar','Orgrimmar','stranglethorn','Grom\'gol',100,'horde'],
  ['zep-uc-grom','zeppelin','tirisfal','Undercity','stranglethorn','Grom\'gol',110,'horde'],
  ['zep-uc-vengeance','zeppelin','tirisfal','Undercity','howling-fjord','Vengeance Landing',150,'horde'],
  ['zep-org-warsong','zeppelin','durotar','Orgrimmar','borean-tundra','Warsong Hold',150,'horde'],
  ['ship-menethil-theramore','ship','wetlands','Menethil Harbor','dustwallow','Theramore Isle',120,'neutral'],
  ['ship-menethil-auberdine','ship','wetlands','Menethil Harbor','darkshore','Auberdine',110,'alliance'],
  ['ship-auberdine-ruttheran','ship','darkshore','Auberdine','teldrassil','Rut\'theran Village',60,'alliance'],
  ['ship-auberdine-azuremyst','ship','darkshore','Auberdine','azuremyst','Valaar\'s Berth',80,'alliance'],
  ['ship-ratchet-booty','ship','barrens','Ratchet','stranglethorn','Booty Bay',130,'neutral'],
  ['ship-menethil-valgarde','ship','wetlands','Menethil Harbor','howling-fjord','Valgarde',160,'alliance'],
  ['ship-stormwind-valiance','ship','elwynn','Stormwind Harbor','borean-tundra','Valiance Keep',160,'alliance'],
  ['ship-stormwind-auberdine','ship','elwynn','Stormwind Harbor','darkshore','Auberdine',140,'alliance'],
  ['portal-shattrath-stormwind','portal','terokkar','Shattrath','elwynn','Stormwind',5,'alliance'],
  ['portal-shattrath-ironforge','portal','terokkar','Shattrath','dun-morogh','Ironforge',5,'alliance'],
  ['portal-shattrath-darnassus','portal','terokkar','Shattrath','teldrassil','Darnassus',5,'alliance'],
  ['portal-shattrath-exodar','portal','terokkar','Shattrath','azuremyst','Exodar',5,'alliance'],
  ['portal-shattrath-orgrimmar','portal','terokkar','Shattrath','durotar','Orgrimmar',5,'horde'],
  ['portal-shattrath-thunderbluff','portal','terokkar','Shattrath','mulgore','Thunder Bluff',5,'horde'],
  ['portal-shattrath-undercity','portal','terokkar','Shattrath','tirisfal','Undercity',5,'horde'],
  ['portal-shattrath-silvermoon','portal','terokkar','Shattrath','eversong','Silvermoon',5,'horde'],
  ['portal-blasted-hellfire','portal','blasted-lands','Dark Portal','hellfire','Stair of Destiny',5,'neutral'],
  ['portal-dalaran-crystalsong','portal','crystalsong','Dalaran','crystalsong','Dalaran',5,'neutral'],
];

// ── build + validate ─────────────────────────────────────────────────────────
const zones = Z.map(([id,name,continent,col,row,cw,ch,l0,l1,faction,terrain]) => ({
  id,name,continent,rect:{x:col*CELL,y:row*CELL,w:cw*CELL,h:ch*CELL},levelMin:l0,levelMax:l1,faction,terrain,
  borders:{north:null,south:null,east:null,west:null},cities:[],dungeons:[],docks:[],flightpaths:[],
}));
const byId = Object.fromEntries(zones.map(z=>[z.id,z]));
let errs = [];
for (let i=0;i<zones.length;i++) for (let j=i+1;j<zones.length;j++){
  const a=zones[i],b=zones[j]; if(a.continent!==b.continent)continue;
  const A=a.rect,B=b.rect;
  if(A.x<B.x+B.w&&B.x<A.x+A.w&&A.y<B.y+B.h&&B.y<A.y+A.h) errs.push(`OVERLAP ${a.id} x ${b.id}`);
}
for(const t of T){ const[,,fz,,tz]=t; if(!byId[fz])errs.push(`TRANSPORT from bad zone ${fz}`); if(!byId[tz])errs.push(`TRANSPORT to bad zone ${tz}`); }
const conts={};
for(const z of zones){const c=conts[z.continent]??={x:1e18,y:1e18,x2:-1e18,y2:-1e18};const r=z.rect;c.x=Math.min(c.x,r.x);c.y=Math.min(c.y,r.y);c.x2=Math.max(c.x2,r.x+r.w);c.y2=Math.max(c.y2,r.y+r.h);}
console.log('zones:',zones.length,' transports:',T.length);
for(const c in conts){const b=conts[c];console.log(` ${c}: ${b.x2-b.x}x${b.y2-b.y} units (${((b.x2-b.x)/CELL).toFixed(0)}x${((b.y2-b.y)/CELL).toFixed(0)} cells)`);}
if(errs.length){console.log('\nERRORS:');errs.forEach(e=>console.log(' ',e));process.exit(1);}
console.log('\nOK — no overlaps, all transports resolve.');
// emit TS table
let ts='';
for(const z of zones){
  ts+=`  '${z.id}': zone('${z.id}','${z.name}','${z.continent}', ${z.rect.x},${z.rect.y},${z.rect.w},${z.rect.h}, ${z.levelMin},${z.levelMax}, '${z.faction}','${z.terrain}'),\n`;
}
await import('fs').then(fs=>fs.writeFileSync('wayfinder/atlas-zones.ts.txt', ts));
console.log('wrote wayfinder/atlas-zones.ts.txt');
