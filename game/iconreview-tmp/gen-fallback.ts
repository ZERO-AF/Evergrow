import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { SKILL_EXECUTION } from '../src/skill-execution-content.ts';
import { SKILL_ICON_RECIPES, genericSkillIconParts } from '../src/skill-icon-content.ts';
import { skillIconSVG } from '../src/skill-icon.ts';
import { writeFileSync } from 'node:fs';
import type { SkillId } from '../src/character-types.ts';

const ids = Object.keys(SKILL_DEFINITIONS) as SkillId[];
const generic = ids.filter(id =>
  JSON.stringify(SKILL_ICON_RECIPES[id]) === JSON.stringify(genericSkillIconParts(SKILL_EXECUTION[id].kind, id)));

// Duplicate check: no two skills may produce identical part lists.
const seen = new Map<string, SkillId>();
const dupes: string[] = [];
for (const id of generic) {
  const key = JSON.stringify(SKILL_ICON_RECIPES[id]);
  const prev = seen.get(key);
  if (prev) dupes.push(`${prev}=${id}`); else seen.set(key, id);
}
console.log(`generic icons: ${generic.length}/${ids.length}; duplicates: ${dupes.length}`);
for (const d of dupes) console.log('DUPE', d);

const byClass = new Map<string, SkillId[]>();
for (const id of generic) {
  const cls = SKILL_DEFINITIONS[id].classId ?? SKILL_DEFINITIONS[id].raceId ?? 'core';
  (byClass.get(cls) ?? byClass.set(cls, []).get(cls)!).push(id);
}
const sections = [...byClass.entries()].map(([cls, list]) =>
  `<h2>${cls} (${list.length})</h2><div class="row">${list.map(id =>
    `<div class="cell"><div class="ic">${skillIconSVG(id, 56)}</div><span>${id}</span></div>`).join('')}</div>`).join('');
writeFileSync(new URL('./fallback.html', import.meta.url),
  `<!doctype html><meta charset="utf-8"><style>
body{background:#0b1520;font:11px sans-serif;color:#9ab;padding:10px}
h2{color:#cde;font-size:13px;margin:14px 0 4px}
.row{display:flex;flex-wrap:wrap;gap:3px}
.cell{display:flex;flex-direction:column;align-items:center;gap:1px;width:76px}
.ic{width:56px;height:56px}
span{font-size:8px;text-align:center;word-break:break-all}
</style>${sections}`);
console.log('wrote fallback.html');
