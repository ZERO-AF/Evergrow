import { enemyMovementMultiplier } from './enemy-modifiers.ts';
import { decoyTarget } from './unique-combat.ts';
import { enemyRecoveryDuration, enemyWindupDuration, resolveThreatHolder, threatPlayer, tickThreat, threatTable } from './enemy-threat.ts';
import { projectileDamageType } from './resistance-content.ts';
import type { Ally, DamageType } from './model.ts';
import { hasWalkableSegment } from './world-navigation.ts';
import { goblinSpeed, goblinDamage } from './warband.ts';
import { alertEnemy, transitionEnemy } from './enemy-state.ts';
import { WOW_COMBAT, type BuffSpec, type CcKind } from './wow-types.ts';
import { ENEMY_AI_RULES, ENEMY_DEFINITIONS, enemyAttackVariant, enemyAttackDefinition, type EnemyDefinition, type ProjectileDefinition } from './combat-content.ts';
import { ELITE_AFFIX_RULES, TREASURE_GOBLIN, affixAttackFactor, affixDamageMultiplier, affixMoveFactor } from './combat-content.ts';
import { circleIntersectsSector } from './combat-geometry.ts';
import type { CombatEvent, Enemy, Player, ProjectileEffects, WorldQuery } from './model.ts';
import { enemyHostility, enemyHuntsPlayer } from './factions.ts';

/** Decisions own no RNG, loot, progression, or drawing. Simulation supplies bounded world mutations. */
export interface EnemyAIContext {
  /** The resolved victim for this enemy's tick (rebound per enemy by
   * updateEnemyAI/enemyTickContext); the sim seeds it with the primary player. */
  player: Player;
  /** Every controlled player in the shared world: [P1] solo, [P1, P2] in co-op.
   * Target resolution, area hit-tests and threat run over the whole roster. */
  players: readonly Player[];
  target?: Pick<Player,'x'|'y'|'radius'|'dead'>;
  /** Player allies (pets/minions/totems); valid hostile targets when hurtAlly is wired. */
  allies?: readonly Ally[];
  hurtAlly?(ally:Ally,amount:number,angle:number,enemy:Enemy):void;
  /** Decoy damage; `victim` is the decoy's owning player (defaults to player). */
  hurtDecoy?(id:number,amount:number,victim?:Player):void;
  enemies: readonly Enemy[];
  neighbors?(enemy:Enemy,padding:number):readonly Enemy[];
  world: WorldQuery;
  time: number;
  trial: { campId: string; x: number; y: number; radius: number } | null;
  visible(ax: number, ay: number, bx: number, by: number): boolean;
  move(enemy: Enemy, vx: number, vy: number, dt: number): void;
  /** Damages the resolved victim; pass `victim` to strike another roster player
   * (area effects hit-test every player and dispatch per victim). */
  hurt(amount: number, angle: number, enemy: Enemy, damageType: DamageType, victim?: Player): void;
  shoot(enemy: Enemy, angle: number, definition: ProjectileDefinition, effects: ProjectileEffects): void;
  emit(event: CombatEvent): void;
  /** Treasure goblins shed gold piles while fleeing (simulation owns the piles). */
  dropGold?(enemy: Enemy): void;
  /** Frozen elites chill the victim through the shared buff overlay. */
  addBuff?(name: string, color: string, spec: BuffSpec, id?: string, victim?: Player): void;
}

/** Every hostile ally across the roster (pets/minions/totems of all players). */
function contextAllies(context: EnemyAIContext): readonly Ally[] {
  const players = context.players;
  const own = context.allies ?? context.player.allies ?? [];
  if (players.length <= 1) return own;
  const allies = [...own];
  for (const p of players) for (const ally of p.allies ?? []) if (!allies.includes(ally)) allies.push(ally);
  return allies;
}
/** Live crowd-control check; entries expire when remaining reaches zero. */
function ccActive(enemy: Enemy, kind: CcKind): boolean {
  const list = enemy.cc;
  if (!list) return false;
  for (const entry of list) if (entry.kind === kind && entry.remaining > 0) return true;
  return false;
}

/** Enemies engage the nearest hostile: any living player or ally. Taunt pins
 * the taunting player (or the growling ally). */
function nearestHostile(enemy: Enemy, context: EnemyAIContext): Player | Ally {
  const players = context.players;
  const taunt = enemy.taunted;
  if ((taunt?.remaining ?? 0) > 0) {
    // Pet growls pin the taunting ally instead of a player.
    if (taunt!.allyId !== undefined) {
      const ally = contextAllies(context).find(a => a.id === taunt!.allyId && a.hp > 0);
      if (ally) return ally;
    } else {
      const taunter = threatPlayer(players, `player:${taunt!.playerId ?? 0}`);
      if (taunter && !taunter.dead) return taunter;
    }
  }
  let best: Player | Ally | undefined, bestD = Infinity;
  for (const p of players) {
    if (p.dead) continue;
    const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
    if (d < bestD) { best = p; bestD = d; }
  }
  if (context.hurtAlly) for (const ally of contextAllies(context)) {
    if (ally.hp <= 0 || (ally.stealth?.remaining ?? 0) > 0) continue;
    const d = Math.hypot(ally.x - enemy.x, ally.y - enemy.y);
    if (d < bestD) { best = ally; bestD = d; }
  }
  return best ?? context.player;
}

/** Threat-driven target: once a combatant holds threat, the enemy stays on it
 * until a challenger beats the holder by the WoW pull threshold (110% melee,
 * 130% ranged). Without a table the nearest hostile keeps its old behavior. */
function threatHostile(enemy: Enemy, context: EnemyAIContext): Player | Ally {
  const players = context.players;
  const allies = context.hurtAlly ? contextAllies(context) : [];
  const holder = threatTable(enemy) ? resolveThreatHolder(enemy, players, allies) : undefined;
  if (holder !== undefined) {
    const player = threatPlayer(players, holder);
    if (player) return player;
    const ally = allies.find(a => `ally:${a.id}` === holder);
    if (ally) return ally;
  }
  return nearestHostile(enemy, context);
}


function separatedMotion(enemy: Enemy, vx: number, vy: number, context: EnemyAIContext): { vx: number; vy: number } {
  for (const other of context.neighbors?.(enemy,ENEMY_AI_RULES.separationPadding)??context.enemies) {
    if (other === enemy || other.state === 'dead') continue;
    const dx = enemy.x - other.x, dy = enemy.y - other.y;
    const gap = enemy.radius + other.radius + ENEMY_AI_RULES.separationPadding;
    if(dx*dx+dy*dy>=gap*gap)continue;
    const distance=Math.hypot(dx,dy);
    if (distance > .01 && distance < gap) {
      const force = (gap - distance) * 5;
      vx += dx / distance * force; vy += dy / distance * force;
    }
  }
  const maxSpeed = ENEMY_DEFINITIONS[enemy.kind].speed * goblinSpeed(enemy)*enemyMovementMultiplier(enemy)
    * affixMoveFactor(enemy) * (enemy.treasure ? TREASURE_GOBLIN.speedFactor : 1)
    * (enemy.state === 'chase' ? ENEMY_AI_RULES.pursuitSpeedMultiplier : 1);
  const length = Math.hypot(vx, vy), scale = length > maxSpeed ? maxSpeed / length : 1;
  return { vx: vx * scale, vy: vy * scale };
}

function moveToward(enemy: Enemy, x: number, y: number, speed: number, dt: number, context: EnemyAIContext): void {
  // A flanking point may land inside scenery. Keep closing on the player instead
  // of asking navigation to reach an occupied decorative anchor.
  if (enemy.state === 'chase' && enemy.seesPlayer && context.world.blocked(x, y, enemy.radius + 1)) {
    x = (context.target??context.player).x; y = (context.target??context.player).y;
  }
  if (context.world.navigationTarget && !hasWalkableSegment(context.world, enemy.x, enemy.y, x, y, enemy.radius + 1)) { const target = context.world.navigationTarget(enemy.x,enemy.y,x,y,enemy.radius + 1); x=target.x; y=target.y; }
  const dx = x - enemy.x, dy = y - enemy.y, distance = Math.hypot(dx, dy);
  if (distance < .1) return;
  // A patrol target drifts much more slowly than a hound can run. Arrive gently
  // instead of stepping past it and reversing on the next fixed tick.
  const arriving = enemy.state === 'patrol' || (enemy.state === 'chase' && !enemy.seesPlayer);
  const approachSpeed = Math.min(speed * goblinSpeed(enemy)*enemyMovementMultiplier(enemy)*affixMoveFactor(enemy), distance / dt,
    arriving ? distance * ENEMY_AI_RULES.arrivalResponse : speed * goblinSpeed(enemy)*enemyMovementMultiplier(enemy)*affixMoveFactor(enemy));
  const velocity = separatedMotion(enemy, dx / distance * approachSpeed, dy / distance * approachSpeed, context);
  const beforeX = enemy.x, beforeY = enemy.y;
  context.move(enemy, velocity.vx, velocity.vy, dt);
  // Face resolved travel, including obstacle steering; blocked movement holds
  // its heading. Combat aim/telegraph locks remain owned by their attack state.
  const movedX = enemy.x - beforeX, movedY = enemy.y - beforeY;
  if (Math.hypot(movedX, movedY) > dt) {
    const targetAngle = Math.atan2(movedY, movedX);
    const turn = Math.atan2(Math.sin(targetAngle - enemy.angle), Math.cos(targetAngle - enemy.angle));
    const limit = ENEMY_AI_RULES.locomotionTurnSpeed * dt;
    enemy.angle += Math.max(-limit, Math.min(limit, turn));
    enemy.angle = Math.atan2(Math.sin(enemy.angle), Math.cos(enemy.angle));
  }
}

function sense(enemy: Enemy, dt: number, context: EnemyAIContext): void {
  const p = context.target??context.player, definition = ENEMY_DEFINITIONS[enemy.kind];
  enemy.senseTime -= dt;
  let distance = Math.hypot(p.x - enemy.x, p.y - enemy.y);
  let seen: typeof p | undefined;
  if (enemy.senseTime <= 0) {
    enemy.senseTime += ENEMY_AI_RULES.senseInterval;
    const range = enemy.awareness >= 1 ? definition.awarenessDistance * 1.35 : definition.awarenessDistance;
    // Stealth shrinks the sense bubble; only a real player can be stealthed.
    const rangeFor = (actor: typeof p) =>
      'stealthed' in actor && actor.stealthed ? Math.min(range, WOW_COMBAT.stealthSenseRadius) : range;
    if (distance < rangeFor(p) && context.visible(enemy.x, enemy.y, p.x, p.y)) seen = p;
    // Co-op: a target-locked enemy still notices the rest of the roster; the
    // nearest visible player owns lastSeen and the awareness rate.
    if (!context.target) for (const other of context.players) {
      if (other === p || other.dead) continue;
      const d = Math.hypot(other.x - enemy.x, other.y - enemy.y);
      if (d < rangeFor(other) && context.visible(enemy.x, enemy.y, other.x, other.y)
        && (!seen || d < distance)) { seen = other; distance = d; }
    }
    enemy.seesPlayer = seen !== undefined;
  }
  // A player-directed taunt compels attention regardless of sight or stealth;
  // a pet growl pins the ally instead and must not reveal a vanished player.
  if (p === context.player && (enemy.taunted?.remaining ?? 0) > 0 && enemy.taunted!.allyId === undefined) enemy.seesPlayer = true;
  if (enemy.seesPlayer) {
    const focus = seen ?? p;
    enemy.lastSeenX = focus.x; enemy.lastSeenY = focus.y; enemy.lostSightTime = 0;
    enemy.awareness = Math.min(1, enemy.awareness + dt / ENEMY_AI_RULES.awarenessSeconds
      * (distance < ENEMY_AI_RULES.hearingDistance ? 2 : 1));
  } else {
    enemy.lostSightTime += dt;
    if (enemy.state === 'idle' || enemy.state === 'patrol') enemy.awareness = Math.max(0, enemy.awareness - dt * .6);
  }
}

function patrol(enemy: Enemy, dt: number, context: EnemyAIContext): void {
  const phase = enemy.patrolPhase + context.time * .11;
  const radius = ENEMY_AI_RULES.patrolRadius * (.65 + .35 * Math.sin(enemy.patrolPhase * 2));
  const targetX = enemy.homeX + Math.cos(phase) * radius;
  const targetY = enemy.homeY + Math.sin(phase) * radius * .7;
  moveToward(enemy, targetX, targetY, ENEMY_DEFINITIONS[enemy.kind].speed * ENEMY_AI_RULES.patrolSpeed, dt, context);
}

function disengage(enemy: Enemy): void {
  transitionEnemy(enemy, 'return');
  enemy.awareness = 0; enemy.seesPlayer = false; enemy.attackHit = true;
}

function returnHome(enemy: Enemy, dt: number, context: EnemyAIContext): void {
  // Returning foes commit to their home instead of oscillating at the tether edge.
  const distance = Math.hypot(enemy.homeX - enemy.x, enemy.homeY - enemy.y);
  if (distance < ENEMY_AI_RULES.returnStopDistance) {
    enemy.lostSightTime = 0; enemy.senseTime = .35;
    transitionEnemy(enemy, 'idle', .6); return;
  }
  moveToward(enemy, enemy.homeX, enemy.homeY, ENEMY_DEFINITIONS[enemy.kind].speed * .85, dt, context);
}

function chase(enemy: Enemy, dt: number, context: EnemyAIContext, definition: EnemyDefinition): void {
  const p = context.target??context.player, hasSight = enemy.seesPlayer;
  const pursuitSpeed = definition.speed * ENEMY_AI_RULES.pursuitSpeedMultiplier;
  const targetX = hasSight ? p.x : enemy.lastSeenX, targetY = hasSight ? p.y : enemy.lastSeenY;
  const dx = targetX - enemy.x, dy = targetY - enemy.y, distance = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
  if (hasSight) enemy.angle = angle;
  if (enemy.kind === 'goblin' && enemy.warband?.order === 'rout') {
    const flee = angle + Math.PI + (enemy.id % 2 ? .5 : -.5);
    moveToward(enemy, enemy.x + Math.cos(flee) * 100, enemy.y + Math.sin(flee) * 100, definition.speed, dt, context);
    return;
  }
  // Silence permits only the basic melee swing; ranged and signature actions are locked out.
  const basic = ENEMY_DEFINITIONS[enemy.kind];
  const silenced = ccActive(enemy, 'silence');
  const action = silenced ? (basic.attack === 'melee' ? basic : null) : definition;
  const attackAction = action ?? definition;
  const attackDistance = attackAction.attack === 'melee'
    ? attackAction.engageDistance ?? attackAction.range + p.radius - 3 : attackAction.maxAttackDistance;
  const minDistance = attackAction.attack === 'melee' ? 0 : attackAction.retreatDistance;
  if (action && hasSight && distance <= attackDistance && distance > minDistance
    && context.visible(enemy.x, enemy.y, p.x, p.y)) {
    if (action !== definition) enemy.attackVariant = 0;
    enemy.attackDamage = enemy.damage * (action.damage / basic.damage) * goblinDamage(enemy) * affixDamageMultiplier(enemy) * ((enemy.rallyTime??0)>0?1.25:1);
    enemy.attackAngle = angle; enemy.attackTargetX = p.x; enemy.attackTargetY = p.y;
    enemy.attackTurns = ((enemy.attackTurns ?? 0) + 1) % 3;
    transitionEnemy(enemy, 'windup', enemyWindupDuration(enemy, action.windup) * affixAttackFactor(enemy)); return;
  }

  if (!hasSight || !context.visible(enemy.x, enemy.y, targetX, targetY)) { moveToward(enemy, targetX, targetY, pursuitSpeed * .8, dt, context); return; }
  const side = enemy.id % 2 ? 1 : -1;
  if (definition.role === 'ranged') {
    const radial = distance < definition.preferredDistance - 28 ? -.75
      : distance > definition.preferredDistance + 30 ? 1 : 0;
    const lateral = Math.abs(radial) < .1 ? .45 : .25;
    const velocity = separatedMotion(enemy,
      (Math.cos(angle) * radial - Math.sin(angle) * lateral * side) * pursuitSpeed,
      (Math.sin(angle) * radial + Math.cos(angle) * lateral * side) * pursuitSpeed, context);
    context.move(enemy, velocity.vx, velocity.vy, dt); return;
  }
  // Close into an attack lane independently; hounds approach their pounce range.
  // Separation and flanking spread the pack without parking allies in a waiting ring.
  const spread = definition.role === 'heavy' ? 0 : (enemy.warband?.order === 'surround' && !enemy.warband.warning ? 1.15 : ENEMY_AI_RULES.flankAngle) * side;
  const ring = definition.role === 'skirmisher' ? definition.preferredDistance * .7 : 18;
  const around = Math.atan2(enemy.y - p.y, enemy.x - p.x) + spread;
  moveToward(enemy, p.x + Math.cos(around) * ring, p.y + Math.sin(around) * ring, pursuitSpeed, dt, context);
  enemy.angle = angle;
}
/** Elite affix runtime: one behavior per rolled affix on a shared clock.
 * Telegraphs reuse the rift-warning cadence (warn → resolve → recover). */
function tickAffix(enemy: Enemy, dt: number, context: EnemyAIContext): void {
  const affix = enemy.affix;
  if (!affix) return;
  const rules = ELITE_AFFIX_RULES;
  const state = enemy.affixState ??= { clock: 0, shielded: 0, stacks: 0 };
  // Shielding decays and molten patches burn out even while the elite disengages.
  state.shielded = Math.max(0, state.shielded - dt);
  if (state.patches) {
    for (const patch of state.patches) {
      patch.remaining -= dt;
      if (patch.remaining <= 0) continue;
      for (const p of context.players)
        if (!p.dead && Math.hypot(p.x - patch.x, p.y - patch.y) <= rules.molten.radius + p.radius
          && context.visible(patch.x, patch.y, p.x, p.y))
          context.hurt(enemy.damage * rules.molten.damageFraction * affixDamageMultiplier(enemy),
            Math.atan2(p.y - patch.y, p.x - patch.x), enemy, 'fire', p);
    }
    state.patches = state.patches.filter(patch => patch.remaining > 0);
    if (!state.patches.length) delete state.patches;
  }
  // Affixes only cycle while the elite is committed to the fight.
  if (enemy.awareness < 1 || context.players.every(p => p.dead)) return;
  state.clock += dt;
  switch (affix) {
    case 'molten': {
      if (state.clock < rules.molten.interval) break;
      state.clock = 0;
      const patches = state.patches ??= [];
      patches.push({ x: enemy.x, y: enemy.y, remaining: rules.molten.duration });
      if (patches.length > rules.molten.maxPatches) patches.shift();
      break;
    }
    case 'arcane': {
      const r = rules.arcane, phase = state.clock % r.period;
      if (phase >= r.telegraph && phase < r.telegraph + r.active) {
        const angle = enemy.id * 1.7 + (phase - r.telegraph) * r.revolutionsPerSecond * Math.PI * 2;
        for (const p of context.players)
          if (!p.dead && circleIntersectsSector(p.x, p.y, p.radius, enemy.x, enemy.y, angle, r.length, r.width / r.length)
            && context.visible(enemy.x, enemy.y, p.x, p.y))
            context.hurt(enemy.damage * r.damageFraction * affixDamageMultiplier(enemy), angle, enemy, 'arcane', p);
      }
      break;
    }
    case 'frozen': {
      const r = rules.frozen;
      if (state.clock < r.period) break;
      state.clock -= r.period;
      context.emit({ type: 'blast', x: enemy.x, y: enemy.y, radius: r.radius, style: 'frost', enemyKind: enemy.kind });
      for (const p of context.players)
        if (!p.dead && Math.hypot(p.x - enemy.x, p.y - enemy.y) <= r.radius + p.radius
          && context.visible(enemy.x, enemy.y, p.x, p.y)) {
          context.hurt(enemy.damage * r.damageFraction * affixDamageMultiplier(enemy),
            Math.atan2(p.y - enemy.y, p.x - enemy.x), enemy, 'frost', p);
          context.addBuff?.('Chilled', '#8fd8f2',
            { duration: r.chillSeconds, stats: { moveSpeedPercent: r.chillPercent } }, `affix-chill:${enemy.id}`, p);
        }
      break;
    }
    case 'shielding': {
      if (state.clock < rules.shielding.period) break;
      state.clock -= rules.shielding.period;
      state.shielded = rules.shielding.duration;
      context.emit({ type: 'blast', x: enemy.x, y: enemy.y, radius: enemy.radius + 14, style: 'holy', enemyKind: enemy.kind });
      break;
    }
    // 'swift' is passive (movement/attack factors); 'avenger' stacks on packmate deaths.
  }
}

/** Treasure goblins never fight: on awareness they rout, shedding gold, and
 * portal out if they survive the escape window. */
function updateTreasureGoblin(enemy: Enemy, dt: number, context: EnemyAIContext): void {
  const treasure = enemy.treasure!, p = context.player;
  // Hard control still holds the goblin; fear wanders it like any other actor.
  if (ccActive(enemy, 'incapacitate') || ccActive(enemy, 'polymorph')) {
    enemy.stateTime = Math.max(0, enemy.stateTime - dt); enemy.vx = enemy.vy = 0; return;
  }
  if (ccActive(enemy, 'fear')) {
    const away = Math.atan2(enemy.y - p.y, enemy.x - p.x) + Math.sin(context.time * 2.3 + enemy.id * 1.7 + enemy.patrolPhase) * .6;
    enemy.angle = away;
    context.move(enemy, Math.cos(away) * ENEMY_DEFINITIONS[enemy.kind].speed * .6,
      Math.sin(away) * ENEMY_DEFINITIONS[enemy.kind].speed * .6, dt);
    return;
  }
  const distance = Math.hypot(p.x - enemy.x, p.y - enemy.y);
  if (!treasure.fleeing) {
    if (p.dead) return;
    // Same senses as a normal goblin: sight range plus a closer hearing bubble.
    const definition = ENEMY_DEFINITIONS[enemy.kind];
    if (distance < definition.awarenessDistance && context.visible(enemy.x, enemy.y, p.x, p.y))
      enemy.awareness = Math.min(1, enemy.awareness + dt / ENEMY_AI_RULES.awarenessSeconds
        * (distance < ENEMY_AI_RULES.hearingDistance ? 2 : 1));
    if (enemy.awareness >= 1) {
      transitionEnemy(enemy, 'chase');
      treasure.fleeing = dt;
      context.emit({ type: 'notice', x: enemy.x, y: enemy.y, message: 'A Treasure Goblin shrieks and bolts!' });
    } else if (enemy.state === 'idle' && enemy.stateTime >= enemy.stateDuration) transitionEnemy(enemy, 'patrol');
    else if (enemy.state === 'patrol') patrol(enemy, dt, context);
    return;
  }
  if (p.dead) { treasure.fleeing = 0; enemy.awareness = 0; disengage(enemy); return; }
  treasure.fleeing += dt;
  if (treasure.fleeing >= TREASURE_GOBLIN.escapeSeconds) {
    // The portal escape is a despawn, not a kill: no rewards, no corpse.
    enemy.hp = 0;
    transitionEnemy(enemy, 'dead', 0);
    context.emit({ type: 'blast', x: enemy.x, y: enemy.y, radius: 40, style: 'arcane', enemyKind: enemy.kind });
    context.emit({ type: 'notice', x: enemy.x, y: enemy.y, message: 'The Treasure Goblin cackles and escapes through a portal!' });
    return;
  }
  treasure.goldClock += dt;
  if (treasure.goldClock >= TREASURE_GOBLIN.goldInterval) {
    treasure.goldClock -= TREASURE_GOBLIN.goldInterval;
    treasure.drops++;
    context.dropGold?.(enemy);
  }
  const away = Math.atan2(enemy.y - p.y, enemy.x - p.x) + Math.sin(context.time * 2.1 + enemy.id * 1.3) * .5;
  enemy.angle = away;
  const speed = ENEMY_DEFINITIONS[enemy.kind].speed * TREASURE_GOBLIN.speedFactor;
  const velocity = separatedMotion(enemy, Math.cos(away) * speed, Math.sin(away) * speed, context);
  context.move(enemy, velocity.vx, velocity.vy, dt);
}


/** Tick only a living, unstaggered actor; status/damage integration remains simulation-owned. */
export function updateEnemyAI(enemy: Enemy, dt: number, context: EnemyAIContext): void {
  // Threat table maintenance: taunt snapshots, out-of-combat decay, leash wipes.
  tickThreat(enemy, dt, context.players, contextAllies(context));
  const taunted=(enemy.taunted?.remaining??0)>0;
  if(taunted)delete enemy.decoyTarget;
  const target=taunted&&enemy.taunted?.allyId===undefined?context.player:taunted?undefined:decoyTarget(enemy,context.player,context.world,context.visible);
  const original=context;if(target!==context.player)context={...context,target,hurt:(amount,angle,actor,type,victim)=>{if(actor.decoyTarget)original.hurtDecoy?.(actor.decoyTarget.id,amount,original.player);else original.hurt(amount,angle,actor,type,victim);}};
  if (enemy.state === 'chase') enemy.attackVariant = enemyAttackVariant(enemy);
  const hostile=context.target??threatHostile(enemy,context);
  if('kind' in hostile&&context.hurtAlly){
    const ally=hostile;
    context={...context,target:{x:ally.x,y:ally.y,radius:ally.radius,dead:ally.hp<=0},
      hurt:(amount,angle,actor)=>context.hurtAlly!(ally,amount,angle,actor)};
  }
  // Roots hold position without suppressing committed swings or shots.
  if(ccActive(enemy,'root'))context={...context,move:()=>{}};
  const p = context.target??context.player, definition = enemyAttackDefinition(enemy);
  if (context.world.isSanctuary?.(context.player.x, context.player.y)) {
    if (enemy.state !== 'return') disengage(enemy);
    const distance = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (distance < 100) {
      const away = Math.atan2(enemy.y - p.y, enemy.x - p.x);
      enemy.angle = away;
      context.move(enemy, Math.cos(away) * definition.speed * .7, Math.sin(away) * definition.speed * .7, dt);
    } else returnHome(enemy, dt, context);
    return;
  }
  // Incapacitate and polymorph suspend the actor entirely; the committed clock
  // rewinds like stagger so control never grants a free instant attack.
  if(ccActive(enemy,'incapacitate')||ccActive(enemy,'polymorph')){
    enemy.stateTime=Math.max(0,enemy.stateTime-dt);enemy.vx=enemy.vy=0;return;
  }
  // Fear breaks a committed action and wanders the victim away from its target.
  if(ccActive(enemy,'fear')){
    if(enemy.state==='windup'||enemy.state==='attack'){
      enemy.interrupted=true;
      transitionEnemy(enemy,'recover',enemyRecoveryDuration(enemy,definition.recovery)*affixAttackFactor(enemy));
    }
    const away=Math.atan2(enemy.y-p.y,enemy.x-p.x)+Math.sin(context.time*2.3+enemy.id*1.7+enemy.patrolPhase)*.6;
    enemy.angle=away;
    context.move(enemy,Math.cos(away)*definition.speed*.6,Math.sin(away)*definition.speed*.6,dt);
    return;
  }
  // Treasure goblins never fight: they rout on awareness, shed gold, and portal out.
  if (enemy.treasure) { updateTreasureGoblin(enemy, dt, context); return; }
  tickAffix(enemy, dt, context);
  // Faction layer (world-t05): opposing-faction actors hunt on sight; neutral
  // actors only retaliate once alerted (damage, taunt, trial); friendly actors
  // never fight the player — a forced combat state walks them home instead.
  if (!enemyHuntsPlayer(enemy, context.player)) {
    if (enemyHostility(enemy, context.player) === 'friendly'
      && enemy.state !== 'idle' && enemy.state !== 'patrol' && enemy.state !== 'return') disengage(enemy);
    if (enemy.state === 'return') { returnHome(enemy, dt, context); return; }
    if (enemy.state === 'idle' && enemy.stateTime >= enemy.stateDuration) transitionEnemy(enemy, 'patrol');
    if (enemy.state === 'patrol') patrol(enemy, dt, context);
    if (enemy.state === 'idle' || enemy.state === 'patrol') return;
  }
  const trial = context.trial;
  const guardingTrial = trial && !p.dead && enemy.campId === trial.campId
    && Math.hypot(p.x - trial.x, p.y - trial.y) <= trial.radius;
  // The ritual tells its guardians where the intruder is. Keep ordinary line-of-sight
  // and attack locks: awareness guides pursuit but never permits a hit through walls.
  if (guardingTrial) alertEnemy(enemy, p);
  if (enemy.state === 'return') { returnHome(enemy, dt, context); return; }
  sense(enemy, dt, context);
  const homeDistance = Math.hypot(enemy.x - enemy.homeX, enemy.y - enemy.homeY);
  if ((enemy.state === 'chase' || enemy.state === 'windup' || enemy.state === 'recover')
    && (homeDistance > (guardingTrial ? trial.radius : context.world.dungeonLevel ? 1800 : ENEMY_AI_RULES.tetherDistance)
      || !guardingTrial && enemy.lostSightTime > (context.world.dungeonLevel ? 14 : ENEMY_AI_RULES.loseSightAfter))) {
    disengage(enemy); returnHome(enemy, dt, context); return;
  }
  if (enemy.state === 'idle' || enemy.state === 'patrol') {
    if (enemy.awareness >= 1) { transitionEnemy(enemy, 'chase'); return; }
    if (enemy.state === 'idle' && enemy.stateTime >= enemy.stateDuration) transitionEnemy(enemy, 'patrol');
    if (enemy.state === 'patrol') patrol(enemy, dt, context);
  } else if (enemy.state === 'recover') {
    // Ranged actors sidestep between committed shots; never move their telegraph.
    if (definition.role === 'ranged') {
      const side = enemy.id % 2 ? 1 : -1, angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
      context.move(enemy, -Math.sin(angle) * definition.speed * .35 * side,
        Math.cos(angle) * definition.speed * .35 * side, dt);
    }
    if (enemy.stateTime >= enemy.stateDuration) transitionEnemy(enemy, 'chase');
  } else if (enemy.state === 'chase') chase(enemy, dt, context, definition);
  else if (enemy.state === 'windup') {
    if (!p.dead && enemy.stateTime < definition.aimLock) {
      enemy.attackAngle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
      enemy.attackTargetX = p.x; enemy.attackTargetY = p.y;
    }
    enemy.angle = enemy.attackAngle;
    if (enemy.stateTime + 1e-9 >= enemy.stateDuration) {
      transitionEnemy(enemy, 'attack', definition.active);
      if (definition.attack === 'projectile') {
        for (const offset of definition.shotOffsets) context.shoot(enemy, enemy.attackAngle + offset,
          { ...definition.projectile, damage: enemy.attackDamage ?? enemy.damage }, { style: definition.projectileStyle });
        context.emit({ type: 'cast', x: enemy.x, y: enemy.y, angle: enemy.attackAngle,
          enemyKind: enemy.kind, style: definition.projectileStyle });
      } else if (definition.attack === 'ground') {
        const tx = enemy.attackTargetX, ty = enemy.attackTargetY;
        context.emit({ type: 'blast', x: tx, y: ty, radius: definition.blastRadius, style: definition.blastStyle ?? 'frost', enemyKind: enemy.kind });
        if (!p.dead && Math.hypot(p.x - tx, p.y - ty) <= definition.blastRadius + p.radius
          && context.visible(enemy.x, enemy.y, tx, ty) && context.visible(tx, ty, p.x, p.y)) {
          context.hurt(enemy.attackDamage ?? enemy.damage, Math.atan2(p.y - ty, p.x - tx), enemy, projectileDamageType(definition.blastStyle ?? 'frost'));
        }
        // Area blasts never shield the real player, whatever redirected the aim.
        const real=context.player;
        if(p!==real&&!real.dead&&Math.hypot(real.x-tx,real.y-ty)<=definition.blastRadius+real.radius
          &&context.visible(enemy.x,enemy.y,tx,ty)&&context.visible(tx,ty,real.x,real.y))
          original.hurt(enemy.attackDamage??enemy.damage,Math.atan2(real.y-ty,real.x-tx),enemy,projectileDamageType(definition.blastStyle??'frost'));
        enemy.attackHit = true;
      }
    }
  } else if (enemy.state === 'attack') {
    if (definition.attack === 'melee') {
      if (definition.lungeSpeed > 0) context.move(enemy,
        Math.cos(enemy.attackAngle) * definition.lungeSpeed, Math.sin(enemy.attackAngle) * definition.lungeSpeed, dt);
      if (!p.dead && !(enemy.decoyTarget?enemy.decoyTarget.hit:enemy.attackHit) && circleIntersectsSector(p.x, p.y, p.radius,
        enemy.x, enemy.y, enemy.attackAngle, definition.range, definition.arc)
        && context.visible(enemy.x, enemy.y, p.x, p.y)) {
        if(enemy.decoyTarget)enemy.decoyTarget.hit=true;else enemy.attackHit=true;
        context.hurt(enemy.attackDamage ?? enemy.damage, enemy.attackAngle, enemy, 'physical');
      }
    }
    const real=context.player;
    if(definition.attack==='melee'&&enemy.decoyTarget&&!enemy.attackHit&&!real.dead
      &&circleIntersectsSector(real.x,real.y,real.radius,enemy.x,enemy.y,enemy.attackAngle,definition.range,definition.arc)
      &&context.visible(enemy.x,enemy.y,real.x,real.y)){enemy.attackHit=true;original.hurt(enemy.attackDamage??enemy.damage,enemy.attackAngle,enemy,'physical');}
    if (enemy.stateTime + 1e-9 >= enemy.stateDuration) transitionEnemy(enemy, 'recover', enemyRecoveryDuration(enemy, definition.recovery) * affixAttackFactor(enemy));
  }
}
