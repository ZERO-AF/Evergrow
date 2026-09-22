// Layout checker: given rect layout per zone id, validate against declared borders.
// Usage: node wayfinder/layout-check.mjs  (reads LAYOUT from layout-data.mjs)
import fs from 'fs';
import { LAYOUT } from './layout-data.mjs';
const data = JSON.parse(fs.readFileSync('wayfinder/wow-zones.json', 'utf8'));
const byId = Object.fromEntries(data.zones.map(z => [z.id, z]));

const OPP = { north: 'south', south: 'north', east: 'west', west: 'east' };
let errs = [], warns = [];
const zones = [];
for (const id in LAYOUT) {
  const d = byId[id];
  if (!d) { errs.push(`LAYOUT has unknown zone ${id}`); continue; }
  const [cont, x, y, w, h] = LAYOUT[id];
  zones.push({ id, cont, x, y, w, h, d });
}
// dataset zones missing from layout
for (const z of data.zones) if (!LAYOUT[z.id]) errs.push(`no layout for ${z.id}`);

const EPS = 0.5;
// overlap
for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
  const a = zones[i], b = zones[j]; if (a.cont !== b.cont) continue;
  if (a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS)
    errs.push(`OVERLAP ${a.id} x ${b.id}`);
}
// adjacency detection: shared edge segment (positive length)
function sharedEdge(a, b) {
  // returns 'a-side' if b abuts a on that side with positive overlap
  if (Math.abs(a.y - (b.y + b.h)) < EPS && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS) return 'north';
  if (Math.abs((a.y + a.h) - b.y) < EPS && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS) return 'south';
  if (Math.abs((a.x + a.w) - b.x) < EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS) return 'east';
  if (Math.abs(a.x - (b.x + b.w)) < EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS) return 'west';
  return null;
}
const adjPairs = new Set();
for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
  const a = zones[i], b = zones[j]; if (a.cont !== b.cont) continue;
  const s = sharedEdge(a, b);
  if (s) adjPairs.add([a.id, b.id].sort().join('|'));
}
// declared borders → adjacency on correct side
const declaredPairs = new Set();
for (const z of zones) {
  const b = z.d.borders || {};
  for (const side of ['north', 'south', 'east', 'west']) {
    const n = b[side]; if (!n) continue;
    const nz = zones.find(o => o.id === n && o.cont === z.cont);
    if (!nz) { errs.push(`${z.id}.${side}=${n}: no such zone in continent`); continue; }
    declaredPairs.add([z.id, n].sort().join('|'));
    const s = sharedEdge(z, nz);
    if (s !== side) errs.push(`BORDER ${z.id}.${side}=${n} but ${n} abuts side ${s ?? 'NONE'}`);
  }
}
// undeclared adjacencies
// per-continent summary
const byCont = {};
for (const z of zones) (byCont[z.cont] = byCont[z.cont] || { zones: 0, declared: new Set(), adjacent: new Set() }).zones++;
for (const p of declaredPairs) { const id = p.split('|')[0]; const z = zones.find(o => o.id === id); if (z) byCont[z.cont].declared.add(p); }
for (const p of adjPairs) { const id = p.split('|')[0]; const z = zones.find(o => o.id === id); if (z) byCont[z.cont].adjacent.add(p); }
for (const c in byCont) {
  const v = byCont[c];
  const cErrs = errs.filter(e => zones.find(z => e.includes(z.id) && z.cont === c));
  console.log(`  ${c}: ${v.zones} zones, ${v.declared.size} declared borders, ${v.adjacent.size} adjacent pairs, ${cErrs.length} violations`);
}
for (const p of adjPairs) if (!declaredPairs.has(p)) warns.push(`UNDECLARED adjacency: ${p}`);
// walkability: midpoint + quartiles of each declared shared edge must be inside a zone
// (here: by construction they are, since rects share edge — check no third rect covers the seam)
console.log(`zones: ${zones.length}, declared pairs: ${declaredPairs.size}, adjacent pairs: ${adjPairs.size}`);
for (const e of errs) console.log('  ERR ' + e);
for (const w of warns) console.log('  WARN ' + w);
console.log(errs.length === 0 ? (warns.length ? 'OK with warnings' : 'OK CLEAN') : 'FAILED');
process.exit(errs.length ? 1 : 0);
