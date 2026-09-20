import { skillIconSVG } from '../src/skill-icon.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { writeFileSync } from 'node:fs';
const ids = Object.keys(SKILL_DEFINITIONS);
const cells = ids.map(id => `<div class="cell"><div class="ic">${skillIconSVG(id, 40)}</div><span>${id}</span></div>`).join('');
writeFileSync('iconreview-tmp/icons.html', `<!doctype html><meta charset="utf-8"><style>
body{background:#0b1520;font:10px sans-serif;color:#9ab;display:grid;grid-template-columns:repeat(auto-fill,64px);gap:2px;padding:8px}
.cell{display:flex;flex-direction:column;align-items:center;gap:1px}
.ic{width:40px;height:40px}
span{font-size:7px;text-align:center;word-break:break-all;max-width:62px}
</style>${cells}`);
console.log('wrote', ids.length, 'icons');
