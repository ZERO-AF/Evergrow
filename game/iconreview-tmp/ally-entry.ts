import { drawAlly } from '../src/ally-art.ts';
import { ALLY_TEMPLATES } from '../src/wow-allies.ts';
import type { Ally } from '../src/model.ts';
const kinds = Object.keys(ALLY_TEMPLATES) as (keyof typeof ALLY_TEMPLATES)[];
const cv = document.getElementById('c') as HTMLCanvasElement;
const cols = 8, cw = 110, ch = 110;
cv.width = cols * cw; cv.height = Math.ceil(kinds.length / cols) * ch;
const c = cv.getContext('2d')!;
c.fillStyle = '#0b1520'; c.fillRect(0,0,cv.width,cv.height);
let i = 0;
for (const kind of kinds) {
  const t = ALLY_TEMPLATES[kind];
  const x = (i % cols) * cw + cw/2, y = Math.floor(i / cols) * ch + ch - 26;
  const ally = { id: i+1, kind, x: 0, y: 0, prevX: 0, prevY: 0, angle: -Math.PI/2 + Math.PI/2, hp: 10, maxHp: 10,
    radius: t.radius, attackCooldown: 0, remaining: undefined,
    ...(t.aura ? { aura: { ...t.aura } } : {}) } as unknown as Ally;
  // face right-ish: angle 0 → forward = +x
  ally.angle = 0;
  drawAlly(c, ally, x, y, 1.3, false);
  c.fillStyle = '#9ab'; c.font = '9px sans-serif'; c.textAlign = 'center';
  c.fillText(kind, x, y + 14);
  i++;
}
(document as any).done = true;
