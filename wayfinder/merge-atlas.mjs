// Merge: authored rect layout (layout-data.mjs) + wow-zones.json (content) →
// world-atlas.ts ZONES/TRANSPORTS blocks. Validates non-overlap, declared-border
// adjacency, undeclared adjacencies, and transport resolution, then splices the
// generated lines into game/src/world-atlas.ts between the GENERATED markers.
import fs from 'fs';
import { LAYOUT } from './layout-data.mjs';

const data = JSON.parse(fs.readFileSync('wayfinder/wow-zones.json', 'utf8'));
const byId = Object.fromEntries(data.zones.map(z => [z.id, z]));

// Capital cities get tier:'capital'; everything else stays 'town'.
const CAPITALS = new Set(['Stormwind City', 'Orgrimmar', 'Ironforge', 'Darnassus',
  'The Exodar', 'Thunder Bluff', 'Undercity', 'Silvermoon City', 'Dalaran', 'Shattrath City']);

const zones = [];
for (const id in LAYOUT) {
  const d = byId[id];
  if (!d) { console.log('MISSING dataset zone', id); continue; }
  const [cont, x, y, w, h] = LAYOUT[id];
  zones.push({ id, continent: cont, rect: { x, y, w, h }, d });
}
// Keep zone key order stable: zones added after the original 62 (quel-danas)
// emit last so ZONE_INDEX seeds for existing zones never shift.
zones.sort((a, b) => (a.id === 'quel-danas') - (b.id === 'quel-danas'));
for (const z of data.zones) if (!LAYOUT[z.id]) console.log('MISSING layout for', z.id);

// ── Validate ────────────────────────────────────────────────────────────────
const EPS = 0.5;
let errs = [];
for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
  const a = zones[i], b = zones[j]; if (a.continent !== b.continent) continue;
  const A = a.rect, B = b.rect;
  if (A.x < B.x + B.w - EPS && B.x < A.x + A.w - EPS && A.y < B.y + B.h - EPS && B.y < A.y + A.h - EPS)
    errs.push(`OVERLAP ${a.id} x ${b.id}`);
}
function sharedEdge(a, b) {
  if (Math.abs(a.y - (b.y + b.h)) < EPS && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS) return 'north';
  if (Math.abs((a.y + a.h) - b.y) < EPS && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS) return 'south';
  if (Math.abs((a.x + a.w) - b.x) < EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS) return 'east';
  if (Math.abs(a.x - (b.x + b.w)) < EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS) return 'west';
  return null;
}
const adjPairs = new Set(), declaredPairs = new Set();
for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
  const a = zones[i], b = zones[j]; if (a.continent !== b.continent) continue;
  if (sharedEdge(a.rect, b.rect)) adjPairs.add([a.id, b.id].sort().join('|'));
}
for (const z of zones) {
  const b = z.d.borders || {};
  for (const side of ['north', 'south', 'east', 'west']) {
    const n = b[side]; if (!n) continue;
    const nz = zones.find(o => o.id === n && o.continent === z.continent);
    if (!nz) { errs.push(`BORDER ${z.id}.${side}=${n}: unknown zone`); continue; }
    declaredPairs.add([z.id, n].sort().join('|'));
    const s = sharedEdge(z.rect, nz.rect);
    if (s !== side) errs.push(`BORDER ${z.id}.${side}=${n} but abuts side ${s ?? 'NONE'}`);
  }
}
for (const p of adjPairs) if (!declaredPairs.has(p)) errs.push(`UNDECLARED adjacency: ${p}`);
for (const t of data.transports) {
  if (!byId[t.from.zone]) errs.push(`transport from ${t.from.zone}`);
  if (!byId[t.to.zone]) errs.push(`transport to ${t.to.zone}`);
}
console.log(`zones: ${zones.length}  transports: ${data.transports.length}  declared pairs: ${declaredPairs.size}  adjacent pairs: ${adjPairs.size}`);
if (errs.length) { errs.forEach(e => console.log('  ' + e)); process.exit(1); }
console.log('OK: no overlaps, every declared border abuts on the correct side, no undeclared adjacencies.');

// ── Emit ────────────────────────────────────────────────────────────────────
const q = s => `'${String(s).replace(/'/g, "\\'")}'`;
const arr = (a, f) => a && a.length ? `[${a.map(f).join(',')}]` : '[]';
const fac = f => ({ Alliance: 'alliance', Horde: 'horde', Neutral: 'neutral', Contested: 'contested', Hostile: 'hostile', PvP: 'contested' }[f] || 'contested');

let ts = '';
for (const z of zones) {
  const d = z.d, r = z.rect;
  const cities = arr(d.cities, c => `{name:${q(c.name)},faction:${q(fac(c.faction))},nx:${c.x},ny:${c.y},tier:${q(CAPITALS.has(c.name) ? 'capital' : 'town')}}`);
  const dungs = arr(d.dungeons, g => `{name:${q(g.name)},nx:${g.x},ny:${g.y},levelMin:${g.levelMin ?? d.levelMin},levelMax:${g.levelMax ?? d.levelMax},kind:${q(g.raid ? 'raid' : 'dungeon')}}`);
  const docks = arr(d.docks, k => `{name:${q(k.name)},faction:${q(fac(k.faction || d.faction))},nx:${k.x},ny:${k.y},routes:[]}`);
  const fps = arr(d.flightpaths, f => `{name:${q(f.name)},faction:${q(fac(f.faction || d.faction))},nx:${f.x},ny:${f.y}}`);
  const borders = `{north:${d.borders?.north ? q(d.borders.north) : 'null'},south:${d.borders?.south ? q(d.borders.south) : 'null'},east:${d.borders?.east ? q(d.borders.east) : 'null'},west:${d.borders?.west ? q(d.borders.west) : 'null'}}`;
  ts += `  ${q(z.id)}: zone(${q(z.id)},${q(d.name)},${q(z.continent)}, ${r.x},${r.y},${r.w},${r.h}, ${d.levelMin},${d.levelMax}, ${q(fac(d.faction))},${q(d.biome)}, {borders:${borders},cities:${cities},dungeons:${dungs},docks:${docks},flightpaths:${fps}}),\n`;
}
let tt = '';
for (const t of data.transports) {
  const id = `${t.kind}-${t.from.zone}-${t.to.zone}-${(t.from.name || '').replace(/[^a-z0-9]/gi, '')}-${(t.to.name || '').replace(/[^a-z0-9]/gi, '')}`.toLowerCase().slice(0, 80);
  tt += `  transport(${q(id)},${q(t.kind)},${q(t.from.zone)},${q(t.from.name)},${q(t.to.zone)},${q(t.to.name)},${t.durationSec},${q(fac(t.faction || 'contested'))}),\n`;
}
fs.writeFileSync('wayfinder/atlas-zones-full.ts.txt', ts);
fs.writeFileSync('wayfinder/atlas-transports-full.ts.txt', tt);

// ── Splice into world-atlas.ts ───────────────────────────────────────────────
const ATLAS = 'game/src/world-atlas.ts';
let src = fs.readFileSync(ATLAS, 'utf8');
const splice = (src, tag, body) => {
  const open = `// [GENERATED:${tag}]`, close = `// [/GENERATED:${tag}]`;
  const i = src.indexOf(open), j = src.indexOf(close);
  if (i < 0 || j < 0 || j < i) throw new Error(`markers ${tag} not found`);
  return src.slice(0, i + open.length) + '\n' + body + src.slice(j);
};
src = splice(src, 'ZONES', ts);
src = splice(src, 'TRANSPORTS', tt);
fs.writeFileSync(ATLAS, src);
console.log('spliced ZONES + TRANSPORTS into', ATLAS);
