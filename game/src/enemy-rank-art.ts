import type { EnemyRank } from './progression-content.ts';

/** Shared heraldry for the native target plate and small world-space rank badges. */
export const RANK_METALS = Object.freeze({
  normal: { edge: '#65726f', light: '#b8c4bd', shade: '#242e30', gem: '#a8b9ae' },
  veteran: { edge: '#668aa7', light: '#c2e1ee', shade: '#233b52', gem: '#81ccef' },
  elite: { edge: '#aa8954', light: '#f0d7a0', shade: '#4a3529', gem: '#f4af70' },
  /** Silver dragon heraldry for named rares — WoW's silver-wing portrait plate. */
  rare: { edge: '#7d95a8', light: '#dcebf5', shade: '#2c3d4c', gem: '#a8d8f0' },
});

/** Deep ember-bronze heraldry reserved for boss kinds; elites keep the gold rank metal. */
export const BOSS_METAL = Object.freeze({
  edge: '#8a4a3a', light: '#f2b8a0', shade: '#3a1a18', gem: '#ff7a5c',
});

/** Ornate boss-frame portrait seal: the shared rank crest inside a ringed medallion. */
export function drawBossCrest(c: CanvasRenderingContext2D, rank: EnemyRank, boss: boolean, x: number, y: number, scale = 1): void {
  const metal = boss ? BOSS_METAL : RANK_METALS[rank];
  c.save(); c.translate(x, y); c.scale(scale, scale); c.lineJoin = 'round';
  // Horn flares root under the ring so the silhouette reads before rank color does.
  if (boss) for (const side of [-1, 1]) {
    c.save(); c.scale(side, 1);
    c.beginPath(); c.moveTo(14, -12); c.quadraticCurveTo(26, -20, 30, -34);
    c.quadraticCurveTo(24, -26, 15, -22); c.closePath();
    c.fillStyle = metal.shade; c.fill(); c.strokeStyle = metal.edge; c.lineWidth = .9; c.stroke();
    c.strokeStyle = metal.light; c.lineWidth = .6;
    c.beginPath(); c.moveTo(17, -15); c.quadraticCurveTo(24, -21, 27, -29); c.stroke(); c.restore();
  }
  const ring = c.createLinearGradient(0, -26, 0, 26);
  ring.addColorStop(0, metal.light); ring.addColorStop(.3, metal.edge);
  ring.addColorStop(.7, metal.shade); ring.addColorStop(1, metal.edge);
  c.beginPath(); c.arc(0, 0, 25, 0, Math.PI * 2); c.fillStyle = ring; c.fill();
  c.strokeStyle = metal.light; c.lineWidth = .8; c.stroke();
  c.beginPath(); c.arc(0, 0, 21.5, 0, Math.PI * 2);
  c.strokeStyle = `${metal.light}80`; c.lineWidth = .6; c.stroke();
  const disc = c.createRadialGradient(0, -6, 2, 0, 0, 21);
  disc.addColorStop(0, '#1c2833'); disc.addColorStop(1, '#070e16');
  c.beginPath(); c.arc(0, 0, 20.5, 0, Math.PI * 2); c.fillStyle = disc; c.fill();
  for (const a of [-.75, .75, Math.PI - .75, Math.PI + .75]) {
    c.beginPath(); c.arc(Math.cos(a) * 23, Math.sin(a) * 23, 1.4, 0, Math.PI * 2);
    c.fillStyle = metal.gem; c.fill();
  }
  drawRankCrest(c, boss ? 'elite' : rank, 0, 0, 1.3);
  c.restore();
}

export function drawRankCrest(c: CanvasRenderingContext2D, rank: EnemyRank, x: number, y: number, scale = 1): void {
  const metal = RANK_METALS[rank];
  c.save(); c.translate(x, y); c.scale(scale, scale); c.lineJoin = 'round';
  // Silver pinions and a three-point crown carry meaning even without rank color.
  if (rank !== 'normal') for (const side of [-1, 1]) {
    c.save(); c.scale(side, 1);
    c.beginPath(); c.moveTo(4, -3); c.lineTo(16, -7); c.lineTo(12, 0);
    c.lineTo(7, 5); c.lineTo(4, 5); c.closePath();
    c.fillStyle = metal.shade; c.fill(); c.strokeStyle = metal.edge; c.lineWidth = .8; c.stroke();
    c.strokeStyle = metal.light; c.lineWidth = .65;
    c.beginPath(); c.moveTo(6, -2); c.lineTo(12, -4); c.moveTo(7, 1); c.lineTo(10, 0); c.stroke(); c.restore();
  }
  if (rank === 'elite') {
    c.beginPath(); c.moveTo(-6, -5); c.lineTo(-8, -12); c.lineTo(-3, -9);
    c.lineTo(0, -15); c.lineTo(3, -9); c.lineTo(8, -12); c.lineTo(6, -5); c.closePath();
    c.fillStyle = metal.shade; c.fill(); c.strokeStyle = metal.light; c.lineWidth = .75; c.stroke();
  }
  // Rare: swept dragon wings arc over the shield — the silver-dragon silhouette.
  if (rank === 'rare') for (const side of [-1, 1]) {
    c.save(); c.scale(side, 1);
    c.beginPath(); c.moveTo(2, -6); c.quadraticCurveTo(9, -15, 17, -13);
    c.quadraticCurveTo(12, -9, 13, -4); c.quadraticCurveTo(9, -7, 5, -3); c.closePath();
    c.fillStyle = metal.shade; c.fill(); c.strokeStyle = metal.edge; c.lineWidth = .8; c.stroke();
    c.strokeStyle = metal.light; c.lineWidth = .6;
    c.beginPath(); c.moveTo(5, -7); c.quadraticCurveTo(10, -11, 14, -11); c.stroke(); c.restore();
  }
  const fill = c.createLinearGradient(-6, -7, 6, 9);
  fill.addColorStop(0, metal.light); fill.addColorStop(.18, metal.edge);
  fill.addColorStop(.5, metal.shade); fill.addColorStop(1, metal.edge);
  c.beginPath(); c.moveTo(0, -9); c.lineTo(7, -3); c.lineTo(5, 5); c.lineTo(0, 10);
  c.lineTo(-5, 5); c.lineTo(-7, -3); c.closePath(); c.fillStyle = fill; c.fill();
  c.strokeStyle = metal.light; c.lineWidth = .65; c.stroke();
  c.beginPath(); c.moveTo(0, -5); c.lineTo(3, -1); c.lineTo(0, 5); c.lineTo(-3, -1); c.closePath();
  c.fillStyle = '#070e16'; c.fill(); c.strokeStyle = metal.gem; c.lineWidth = .8; c.stroke();
  c.fillStyle = metal.gem; c.fillRect(-.65, -2, 1.3, 3);
  c.restore();
}
