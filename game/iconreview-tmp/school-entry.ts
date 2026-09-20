import { drawSchoolImpact, schoolCastAura } from '../src/spell-school-art.ts';
const schools = ['holy','shadow','fire','frost','lightning','nature','arcane','physical'] as const;
const cv = document.getElementById('c') as HTMLCanvasElement;
const c = cv.getContext('2d')!;
c.fillStyle = '#0b1520'; c.fillRect(0,0,cv.width,cv.height);
const cw = 130, ch = 130;
// Row 1: impact at t=0.18 (mid-burst); Row 2: impact at t=0.35; Row 3: cast aura loop t=1.7
schools.forEach((s, i) => {
  const x = i * cw + cw/2;
  for (const [row, t] of [[0, .18],[1, .35]] as const) {
    const y = row * ch + ch/2;
    drawSchoolImpact(c, x, y, s as any, t, 1, false);
  }
  const y = 2 * ch + ch/2;
  schoolCastAura(c, x, y, s as any, 1.7, 1, false);
  c.fillStyle = '#9ab'; c.font = '10px sans-serif'; c.textAlign = 'center';
  c.fillText(s, x, 2 * ch + ch - 8);
});
