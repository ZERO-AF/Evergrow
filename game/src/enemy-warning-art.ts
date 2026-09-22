import { riftCanChannel } from './rift-tactics.ts';
import { riftMechanic, RIFT_TACTICS as RT } from './rift-encounters.ts';
import { BOSS_PRESSURE } from './boss-pressure.ts';
import { drawWildernessBossImpact } from './wilderness-boss-effect-art.ts';
import { isWildernessBoss, LAIR_RULES as R } from './wilderness-boss-content.ts';
import type { Enemy } from './model.ts';
import { enemyAttackDefinition } from './combat-content.ts';
import { WARDEN_RULES, wardenProfile } from './dungeon-boss.ts';
import { drawAttackWarning, type WarningShape } from './attack-warning-art.ts';
import { drawGlow, type PointLight } from './lighting.ts';
import { raidBossWarnings, drawRaidBossEffects, raidBossWarningLight } from './raid-boss-art.ts';
import { raid2BossWarnings, drawRaid2BossEffects, raid2BossWarningLight } from './raid2-boss-art.ts';
import { raid3BossWarnings, drawRaid3BossEffects, raid3BossWarningLight } from './raid3-boss-art.ts';
import { raid4BossWarnings, drawRaid4BossEffects, raid4BossWarningLight } from './raid4-boss-art.ts';
import { ELITE_AFFIXES, ELITE_AFFIX_RULES } from './combat-content.ts';

interface Warning { x: number; y: number; angle: number; shape: WarningShape; color: string; progress: number; locked: boolean }
export function enemyWarnings(e: Enemy, alpha = 1): Warning[] {
  const warnings = baseWarnings(e, alpha);
  // Elite affix telegraphs ride alongside the attack warning, never replace it.
  const state = e.affixState;
  if (!e.affix || !state || e.hp <= 0) return warnings;
  const x = e.prevX + (e.x - e.prevX) * alpha, y = e.prevY + (e.y - e.prevY) * alpha;
  const color = ELITE_AFFIXES[e.affix].color;
  if (e.affix === 'arcane') {
    const r = ELITE_AFFIX_RULES.arcane, phase = state.clock % r.period;
    if (phase < r.telegraph)
      warnings.push({ x, y, angle: e.id * 1.7, progress: phase / r.telegraph, locked: false, color,
        shape: { kind: 'lane', length: r.length, width: r.width } });
    else if (phase < r.telegraph + r.active)
      warnings.push({ x, y, angle: e.id * 1.7 + (phase - r.telegraph) * r.revolutionsPerSecond * Math.PI * 2,
        progress: 1, locked: true, color, shape: { kind: 'lane', length: r.length, width: r.width } });
  } else if (e.affix === 'frozen') {
    const r = ELITE_AFFIX_RULES.frozen;
    if (state.clock >= r.period - r.telegraph)
      warnings.push({ x, y, angle: 0, progress: (state.clock - (r.period - r.telegraph)) / r.telegraph,
        locked: false, color, shape: { kind: 'circle', radius: r.radius } });
  }
  return warnings;
}
function baseWarnings(e: Enemy, alpha = 1): Warning[] {
  if(e.hp>0&&e.riftWarning){const w=e.riftWarning;return [{x:w.x,y:w.y,angle:w.angle,progress:1-w.remaining/RT.warning,locked:true,color:w.kind==='storm'?'#cca3ff':'#ff935f',shape:w.kind==='storm'?{kind:'circle',radius:RT.stormRadius}:{kind:'sector',radius:RT.fireRadius,arc:RT.fireArc}}];}
  const raid = raidBossWarnings(e, alpha); if (raid.length) return raid;
  const raid2 = raid2BossWarnings(e, alpha); if (raid2.length) return raid2;
  const raid3 = raid3BossWarnings(e, alpha); if (raid3.length) return raid3;
  const raid4 = raid4BossWarnings(e, alpha); if (raid4.length) return raid4;
  if (e.hp <= 0 || (e.state !== 'windup' && e.state !== 'attack')) return [];
  const d = enemyAttackDefinition(e), x = e.prevX + (e.x - e.prevX) * alpha, y = e.prevY + (e.y - e.prevY) * alpha;
  const progress = e.state === 'attack' ? 1 : Math.min(1, e.stateTime / Math.max(.01, e.stateDuration));
  const base = { x, y, angle: e.attackAngle, progress, locked: e.state === 'attack' || e.stateTime >= d.aimLock, color: '#f34e60' };
  if((isWildernessBoss(e.kind)||e.kind==='warden')&&(e.bossMove==='jab'||e.bossMove==='bolt')) {
    const rule=BOSS_PRESSURE[e.bossMove], locked=e.state==='attack'||e.stateTime>=rule.aimLock;
    return [{...base,locked,shape:e.bossMove==='jab'
      ? {kind:'sector',radius:BOSS_PRESSURE.jab.range,arc:BOSS_PRESSURE.jab.arc}
      : {kind:'lane',length:BOSS_PRESSURE.bolt.speed*BOSS_PRESSURE.bolt.life,width:BOSS_PRESSURE.bolt.radius}}];
  }
  if(isWildernessBoss(e.kind)) {
    const origin={...base,x:e.bossOriginX??x,y:e.bossOriginY??y,locked:true};
    if(e.bossMove==='rush')return [{...origin,shape:{kind:'lane',length:R.rushLength,width:R.rushWidth}}];
    if(e.bossMove==='fracture')return [-.55,0,.55].map(offset=>({...origin,angle:e.attackAngle+offset,shape:{kind:'lane',length:R.fractureLength,width:R.fractureWidth}}));
    if(e.bossMove==='eruption')return [{...base,x:e.attackTargetX,y:e.attackTargetY,locked:true,shape:{kind:'circle',radius:R.eruptionRadius}}];
    if(e.bossMove==='sweep')return [{...base,locked:true,shape:{kind:'sector',radius:R.sweepReach,arc:R.sweepArc}}];
    return [];
  }
  if (e.kind === 'warden') {
    const profile=wardenProfile(e.dungeonTheme);
    if (e.bossMove === 'fracture') return profile.offsets.map(offset => ({ ...base, locked:true, angle: e.attackAngle + offset,
      shape: { kind: 'lane', length: profile.length, width: profile.width } }));
    if (e.bossMove === 'sweep') return [{ ...base, locked:true, shape: { kind: 'sector', radius: WARDEN_RULES.reach, arc: Math.PI * 1.3 } }];
    return []; // Summoning has no damage footprint; show an aura rather than a false hit boundary.
  }
  if (d.attack === 'ground') return [{ ...base, x: e.attackTargetX, y: e.attackTargetY, color: '#e83d59', shape: { kind: 'circle', radius: d.blastRadius } }];
  // Basic arrows and the Hexer's three bolts are readable from their projectiles.
  // Suppress both the floor footprint and its warning light; preserve the cast pose/aim lock.
  if (d.attack === 'projectile') return d.warning ? d.shotOffsets.map(offset => ({ ...base, locked:true, angle: e.attackAngle + offset,
    shape: { kind: 'lane', width: d.projectile.radius, length: d.projectile.speed * d.projectile.life } })) : [];
  if (d.engageDistance) return [{ ...base, shape: { kind: 'lane', width: 11,
    length: d.lungeSpeed * Math.max(0, d.active - (e.state === 'attack' ? e.stateTime : 0)) + d.range } }];
  return [{ ...base, shape: { kind: 'sector', radius: d.range, arc: d.arc } }];
}
export function drawEnemyWarning(c: CanvasRenderingContext2D, e: Enemy, alpha: number, time: number, reduced: boolean): void {
  drawWildernessBossImpact(c,e,time,reduced);
  drawRaidBossEffects(c, e, time, reduced);
  drawRaid2BossEffects(c, e, time, reduced);
  drawRaid3BossEffects(c, e, time, reduced);
  drawRaid4BossEffects(c, e, time, reduced);
  if(riftMechanic(e)==='ritual'&&riftCanChannel(e)&&e.awareness>=1){
    c.save();c.strokeStyle='#9ae0c7';c.globalAlpha=.2;c.lineWidth=1.5;
    c.beginPath();c.arc(e.x,e.y,RT.wardRadius,0,Math.PI*2);c.stroke();c.restore();
    drawGlow(c,e.x,e.y-30,48,'#9ae0c7',.2);
  }
  if(e.bossMove==='command'&&(e.state==='windup'||e.state==='attack'))drawGlow(c,e.x,e.y-35,100,'#b4a3eb',.3);
  if((e.rallyTime??0)>0)drawGlow(c,e.x,e.y-15,34,'#b4a3eb',.24);
  if (e.kind === 'warden' && e.bossMove === 'summon' && (e.state === 'windup' || e.state === 'attack'))
    drawGlow(c, e.x, e.y - 25, 70, '#e83d59', .25 + Math.min(1, e.stateTime / Math.max(.01, e.stateDuration)) * .3);
  // Elite affix presence: a colored aura ring plus per-affix ground dressing.
  if (e.affix && e.hp > 0) {
    const color = ELITE_AFFIXES[e.affix].color, state = e.affixState;
    const pulse = reduced ? .7 : .7 + Math.sin(time * 3.1 + e.id) * .3;
    c.save();
    c.globalAlpha = .16 * pulse;
    c.strokeStyle = color; c.lineWidth = 2;
    c.beginPath(); c.arc(e.x, e.y, e.radius + 7, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = .1 * pulse;
    c.beginPath(); c.arc(e.x, e.y, e.radius + 11, 0, Math.PI * 2); c.stroke();
    c.restore();
    if (state?.patches) for (const patch of state.patches) {
      const fade = Math.min(1, patch.remaining / .8);
      c.save();
      c.globalAlpha = .3 * fade;
      c.fillStyle = ELITE_AFFIXES.molten.color;
      c.beginPath(); c.arc(patch.x, patch.y, ELITE_AFFIX_RULES.molten.radius, 0, Math.PI * 2); c.fill();
      c.globalAlpha = .55 * fade;
      c.strokeStyle = '#ffb066'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(patch.x, patch.y, ELITE_AFFIX_RULES.molten.radius * .8, 0, Math.PI * 2); c.stroke();
      c.restore();
      drawGlow(c, patch.x, patch.y, ELITE_AFFIX_RULES.molten.radius, '#f2793a', .18 * fade);
    }
    if ((state?.shielded ?? 0) > 0) {
      c.save();
      c.globalAlpha = .5;
      c.strokeStyle = ELITE_AFFIXES.shielding.color; c.lineWidth = 2.5;
      c.beginPath(); c.arc(e.x, e.y - e.radius * .6, e.radius + 10, 0, Math.PI * 2); c.stroke();
      c.restore();
      drawGlow(c, e.x, e.y - e.radius * .6, e.radius + 22, '#f0d98a', .35);
    }
    if (e.affix === 'avenger' && (state?.stacks ?? 0) > 0)
      drawGlow(c, e.x, e.y - 20, 30 + state!.stacks * 8, '#e86a6a', .2 + state!.stacks * .05);
  }
  for (const w of enemyWarnings(e, alpha)) {
    c.save(); c.translate(w.x, w.y); c.rotate(w.angle);
    drawAttackWarning(c, w.shape, w.progress, w.color, time + e.id * .137, reduced, w.locked, '#ffd1da'); c.restore();
  }
}
export function enemyWarningLight(e: Enemy): PointLight | null {
  const w = enemyWarnings(e)[0];
  const raid = raidBossWarningLight(e) ?? raid2BossWarningLight(e) ?? raid3BossWarningLight(e) ?? raid4BossWarningLight(e); if (raid) return raid;
  if (!w) return null;
  return { x: w.x, y: w.y, radius: w.shape.kind === 'circle' ? w.shape.radius * 1.3 : 65,
    color: w.color, power: .12 + w.progress * .3 };
}
