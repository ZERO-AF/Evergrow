import { skillIconSVG } from '../src/skill-icon.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { SKILL_EXECUTION } from '../src/skill-execution-content.ts';
import { writeFileSync } from 'node:fs';
// authored set = keys in recipes object of skill-icon-content
import { readFileSync } from 'node:fs';
const sic = readFileSync('src/skill-icon-content.ts','utf8');
const block = sic.slice(sic.indexOf('const recipes'), sic.indexOf('const authored'));
const authored = new Set([...block.matchAll(/^  ([a-zA-Z]+):/gm)].map(m=>m[1]));
const ids = Object.keys(SKILL_DEFINITIONS).filter(id => !authored.has(id));
const byKind = new Map<string,string[]>();
for (const id of ids) { const k = (SKILL_EXECUTION as any)[id]?.kind ?? '?'; (byKind.get(k) ?? byKind.set(k,[]).get(k)!).push(id); }
let html = `<!doctype html><meta charset="utf-8"><style>
body{background:#0b1520;font:11px sans-serif;color:#9ab;padding:10px}
h2{color:#cde;font-size:13px;margin:14px 0 4px}
.row{display:flex;flex-wrap:wrap;gap:3px}
.cell{display:flex;flex-direction:column;align-items:center;gap:1px;width:76px}
.ic{width:56px;height:56px}
span{font-size:8px;text-align:center;word-break:break-all}
</style>`;
for (const [k, list] of [...byKind.entries()].sort((a,b)=>b[1].length-a[1].length)) {
  html += `<h2>${k} (${list.length})</h2><div class="row">` + list.map(id=>`<div class="cell"><div class="ic">${skillIconSVG(id,56)}</div><span>${id}</span></div>`).join('') + '</div>';
}
writeFileSync('iconreview-tmp/fallback.html', html);
console.log('fallback ids:', ids.length);
