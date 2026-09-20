import type { GatherNode } from './gather-node.ts';

const NODE_COLORS: Record<string, { base: string; accent: string; glow: string }> = {
  peacebloom: { base: '#e8e4f0', accent: '#f0c040', glow: '#fff4c0' },
  silverleaf: { base: '#9fc4d8', accent: '#e8f4f8', glow: '#c8ecf8' },
  earthroot: { base: '#8a6a4a', accent: '#c8a878', glow: '#e8d0a0' },
  mageroyal: { base: '#b878d8', accent: '#e0b0f8', glow: '#e8c8ff' },
  briarthorn: { base: '#5a7a3a', accent: '#a0c060', glow: '#c8e890' },
  kingsblood: { base: '#a04858', accent: '#e07080', glow: '#f0a0a8' },
  wildSteelbloom: { base: '#7898a8', accent: '#c0d8e8', glow: '#d8ecf8' },
  goldthorn: { base: '#c8a038', accent: '#f0d878', glow: '#f8e8a0' },
  sungrass: { base: '#d8c040', accent: '#f8e878', glow: '#fff0a8' },
  copperVein: { base: '#8a6a4a', accent: '#e8a050', glow: '#f8c080' },
  tinVein: { base: '#8a8a92', accent: '#c8ccd8', glow: '#e0e4f0' },
  silverVein: { base: '#a8b8c8', accent: '#e8f0f8', glow: '#f0f8ff' },
  ironVein: { base: '#6a5a50', accent: '#b89078', glow: '#d8b898' },
  goldVein: { base: '#a08030', accent: '#f0d050', glow: '#f8e888' },
  mithrilVein: { base: '#4a7a8a', accent: '#80d8e8', glow: '#a0ecf8' },
  thoriumVein: { base: '#3a5a4a', accent: '#70c8a0', glow: '#98e8c0' },
  beastCorpse: { base: '#7a5a48', accent: '#b89878', glow: '#d8b898' },
};

/** Procedural node art: herb sprig, ore cluster, or carcass; soft glow when trackable. */
export function drawGatherNode(c: CanvasRenderingContext2D, node: GatherNode, time: number, focused: boolean): void {
  const colors = NODE_COLORS[node.def.id] ?? NODE_COLORS.beastCorpse!;
  const pulse = .75 + Math.sin(time * 2.4 + node.x * .01) * .25;
  c.save();
  c.translate(node.x, node.y);
  // Ground shadow.
  c.fillStyle = '#00000038';
  c.beginPath(); c.ellipse(0, 2, 14, 5, 0, 0, Math.PI * 2); c.fill();
  if (node.def.profession === 'skinning') {
    // Carcass: ribbed torso mound with bone tips.
    c.fillStyle = colors.base;
    c.beginPath(); c.ellipse(0, -4, 13, 8, -.15, 0, Math.PI * 2); c.fill();
    c.strokeStyle = colors.accent; c.lineWidth = 1.4;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(i * 5, -6, 4, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    c.fillStyle = '#e8dcc8';
    c.beginPath(); c.ellipse(-11, -6, 3.4, 2.2, .5, 0, Math.PI * 2); c.fill();
  } else if (node.def.profession === 'mining') {
    // Ore cluster: three faceted shards.
    c.fillStyle = colors.base;
    for (const [dx, h] of [[-7, 10], [0, 15], [7, 11]] as const) {
      c.beginPath(); c.moveTo(dx - 4, 0); c.lineTo(dx, -h); c.lineTo(dx + 4, 0); c.closePath(); c.fill();
    }
    c.fillStyle = colors.accent;
    for (const [dx, h] of [[-7, 10], [0, 15], [7, 11]] as const) {
      c.beginPath(); c.moveTo(dx, -h); c.lineTo(dx + 4, 0); c.lineTo(dx + 1.5, 0); c.closePath(); c.fill();
    }
  } else {
    // Herb: stem with paired leaves and a blossom.
    c.strokeStyle = '#4a6a34'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(1.5, -7, 0, -13); c.stroke();
    c.fillStyle = '#5a8040';
    for (const side of [-1, 1]) { c.beginPath(); c.ellipse(side * 4, -5 - (side + 1), 3.4, 1.6, side * .6, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = colors.base;
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      c.beginPath(); c.ellipse(Math.cos(a) * 3, -14 + Math.sin(a) * 3, 2.4, 1.5, a, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = colors.accent;
    c.beginPath(); c.arc(0, -14, 2, 0, Math.PI * 2); c.fill();
  }
  // Trackable glow ring (minimap tracking reads the same nodes).
  c.globalAlpha = (focused ? .55 : .3) * pulse;
  c.strokeStyle = colors.glow; c.lineWidth = focused ? 2 : 1.2;
  c.beginPath(); c.ellipse(0, 0, 16 + pulse * 3, 7 + pulse, 0, 0, Math.PI * 2); c.stroke();
  c.restore();
}
