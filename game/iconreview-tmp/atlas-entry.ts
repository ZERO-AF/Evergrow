import { SKILL_TREE } from '../src/skill-tree.ts';
import { WOW_CLASSES } from '../src/wow-classes.ts';
const cv = document.getElementById('c') as HTMLCanvasElement;
const c = cv.getContext('2d')!;
c.fillStyle = '#0b1520'; c.fillRect(0,0,cv.width,cv.height);
// draw two sanctums: warrior (biggest?) and mage
const clusters = SKILL_TREE.clusters.filter(cl => cl.classId);
const byId = new Map(SKILL_TREE.nodes.map(n=>[n.id,n]));
let ox = 0;
for (const cl of clusters) {
  const members = SKILL_TREE.nodes.filter(n => n.cluster === cl.id);
  const scale = 0.55;
  const cx = ox + cl.radius*scale + 30, cy = 200;
  ox = cx + cl.radius*scale + 30;
  // edges within cluster
  c.strokeStyle = '#3a5a6a'; c.lineWidth = 0.7;
  for (const e of SKILL_TREE.edges) {
    const a = byId.get(e.from)!, b = byId.get(e.to)!;
    if (a.cluster !== cl.id && b.cluster !== cl.id) continue;
    c.beginPath(); c.moveTo(cx+(a.x-cl.x)*scale, cy+(a.y-cl.y)*scale); c.lineTo(cx+(b.x-cl.x)*scale, cy+(b.y-cl.y)*scale); c.stroke();
  }
  for (const n of members) {
    const x = cx+(n.x-cl.x)*scale, y = cy+(n.y-cl.y)*scale;
    c.beginPath(); c.arc(x,y, n.skill?3.4:2.6, 0, Math.PI*2);
    c.fillStyle = n.free ? '#ffe1a7' : WOW_CLASSES[cl.classId!].color; c.fill();
    if (n.skill) { c.strokeStyle='#0a1726'; c.lineWidth=.8; c.stroke(); }
  }
  c.fillStyle='#cde'; c.font='11px sans-serif'; c.textAlign='center';
  c.fillText(`${cl.name} r=${Math.round(cl.radius)} members=${members.length}`, cx, cy + cl.radius*scale + 24);
}
