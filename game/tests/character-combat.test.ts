import { PACK_CELLS, footprintCells } from '../src/inventory-grid.ts';
import { xpLevelFactor } from '../src/progression.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { awardCharacterExperience, assignSkill, refreshCharacter } from '../src/character.ts';
import { equipItem, unequipItem } from '../src/inventory.ts';
import { generateItem } from '../src/items.ts';
import { allocateNode, SKILL_NODES, SKILL_TREE } from '../src/skill-tree.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { WEAPON_PROFILES } from '../src/weapon-content.ts';
import { SKILL_EXECUTION } from '../src/skill-execution-content.ts';
import { deriveAttackStats } from '../src/equipment.ts';
import { WOW_CLASSES } from '../src/wow-classes.ts';
import { createWowSim, manaClassForRace } from './fixtures/wow-sim.ts';
import { BAR_TOTAL, RACIAL_SLOT } from '../src/action-bar.ts';
import type { Enemy, Input, WorldQuery } from '../src/model.ts';
import type { SkillId } from '../src/character-types.ts';


const idle: Input = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
// Default harness character: mage/undead — mana resource, neutral passives, sword-capable.
const createSim = () => createWowSim('mage', 'undead');
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);
function advance(sim: Simulation, seconds: number, input: Partial<Input> = {}): void {
  for (let tick = 0; tick < Math.round(seconds / FIXED_STEP); tick++) sim.update(FIXED_STEP, { ...idle, ...input });
}
function target(sim: Simulation, x = 45, y = 0, hp = 10000): Enemy {
  const enemy = sim.spawnEnemy('brute', x, y)!;
  enemy.hp = enemy.maxHp = hp; enemy.state = 'recover'; enemy.stateDuration = 999;
  return enemy;
}
function equipForSkill(sim: Simulation, id: SkillId): void {
  const required = SKILL_DEFINITIONS[id].requirement;
  const usable = WOW_CLASSES[sim.player.character.classId].weapons;
  const families = required === 'magic' ? ['staff', 'wand'] : required === 'bow' ? ['bow']
    : required === 'dagger' ? ['dagger'] : required === 'heavy' ? ['axe', 'mace']
    : required === 'blade' ? ['sword', 'axe', 'dagger'] : ['sword', 'axe', 'mace', 'dagger', 'staff', 'wand', 'bow'];
  const profile = WEAPON_PROFILES.find(w => w.hands === 1 && families.includes(w.family) && usable.includes(w.family))
    ?? WEAPON_PROFILES.find(w => families.includes(w.family) && usable.includes(w.family));
  assert.ok(profile, `no legal ${required} weapon for ${sim.player.character.classId}`);
  const item = generateItem(723, 1, 'weapon', profile.id); item.implicit = {}; item.affixes = [];
  sim.player.character.inventory[47] = item;
  assert.ok(equipItem(sim.player.character, 47, sim.player.level).ok);
  if (required === 'shield') {
    const shield = generateItem(724, 1, 'shield', 'iron-buckler'); shield.affixes = [];
    sim.player.character.inventory[47] = shield;
    assert.ok(equipItem(sim.player.character, 47, sim.player.level).ok);
  }
  refreshCharacter(sim.player);
}
function unlock(sim: Simulation, id: SkillId, slot = 0): void {
  equipForSkill(sim, id);
  const definition = SKILL_DEFINITIONS[id];
  // Racial actives are auto-known on the dedicated R slot — no tree node, no assignment.
  if (definition.raceId) { refreshCharacter(sim.player); return; }
  const major = SKILL_TREE.nodes.find(node => node.skill === id)!;
  const classId = sim.player.character.classId;
  const paths = new Map<string, string[]>([['origin', []]]), queue = ['origin'];
  for (let index = 0; index < queue.length && !paths.has(major.id); index++) {
    for (const neighbor of SKILL_NODES.get(queue[index])!.neighbors) if (!paths.has(neighbor)) {
      // Foreign-class sanctum nodes are unreachable for this character.
      const node = SKILL_NODES.get(neighbor)!;
      if (node.classId && node.classId !== classId) continue;
      paths.set(neighbor, [...paths.get(queue[index])!, neighbor]); queue.push(neighbor);
    }
  }
  const path = paths.get(major.id)!;
  sim.player.character.skillPoints += path.filter(node => !sim.player.character.allocatedNodes.includes(node)).length;
  for (const node of path) if (!sim.player.character.allocatedNodes.includes(node)) assert.ok(allocateNode(sim.player.character, node).ok);
  refreshCharacter(sim.player);
  assert.ok(assignSkill(sim.player, slot, id).ok);
}

test('multi-level rewards grant one skill and five attribute points per level without assigning or healing', () => {
  const sim = createSim(), player = sim.player;
  player.xp = 80; player.hp = 42; player.mana = 63;
  player.character.statPoints = 3; player.character.skillPoints = 2;
  const beforeAttributes = { ...player.character.attributes }, beforeStats = { ...player.derived };
  assert.equal(awardCharacterExperience(player, 805), 4);
  assert.equal(player.level, 5); assert.equal(player.xp, 80);
  assert.equal(player.character.skillPoints, 6); assert.equal(player.character.statPoints, 23);
  assert.deepEqual(player.character.attributes, beforeAttributes); assert.deepEqual(player.derived, beforeStats);
  assert.equal(player.hp, 42); assert.equal(player.mana, 63);
  assert.equal(awardCharacterExperience(player, 0), 0);
  assert.equal(player.character.skillPoints, 6); assert.equal(player.character.statPoints, 23);
});

test('equipping an item changes actual melee damage and repeated attack timing through shared stats', () => {
  const sim = createSim(), weapon = generateItem(455, 1, 'weapon', 'longsword', 'common');
  weapon.weapon!.damage = 40; weapon.weapon!.baseAttacksPerSecond = 1;
  weapon.implicit = { damagePercent: 50, attackSpeedPercent: 25 }; weapon.affixes = [];
  sim.player.character.inventory[4] = weapon;
  assert.ok(equipItem(sim.player.character, 4, sim.player.level).ok); refreshCharacter(sim.player);
  const enemy = target(sim, 35);
  advance(sim, FIXED_STEP, { attack: true });
  close(sim.player.attack!.duration, 1); assert.equal(sim.player.attack!.damage, 60);
  advance(sim, 4 - FIXED_STEP, { attack: true });
  const events = sim.drainEvents(), hits = events.filter(event => event.type === 'hit');
  assert.equal(events.filter(event => event.type === 'swing').length, 4);
  assert.ok(hits.length >= 4); assert.ok(hits.every(event => event.value === 60));
  assert.equal(enemy.hp, 10000 - hits.length * 60);
});

test('equipping larger resource pools preserves current values and removing gear clamps them', () => {
  const sim = createSim(), item = generateItem(879, 1, 'head'), player = sim.player;
  item.implicit = { maxHp: 40, maxMana: 30 }; item.affixes = [];
  player.hp = 37; player.mana = 29; player.character.inventory[4] = item;
  assert.ok(equipItem(player.character, 4, 1).ok); refreshCharacter(player);
  assert.equal(player.maxHp, 140); assert.equal(player.maxMana, 130);
  assert.equal(player.hp, 37); assert.equal(player.mana, 29);
  player.hp = 138; player.mana = 128;
  assert.ok(unequipItem(player.character, 'head').ok); refreshCharacter(player);
  assert.equal(player.maxHp, 100); assert.equal(player.maxMana, 100);
  assert.equal(player.hp, 100); assert.equal(player.mana, 100);
  assert.ok(unequipItem(player.character, 'weapon').ok); refreshCharacter(player);
  assert.equal(player.equipment.mainHand.visual.kind, 'unarmed');
  assert.ok(deriveAttackStats(player.stats, player.equipment.mainHand).damage < 24);
});

test('all five empty slots and a locked skill are inert and cannot consume mana', () => {
  const sim = createSim();
  assert.equal(assignSkill(sim.player, 0, 'fireball').ok, false);
  for (let slot = 0; slot < 5; slot++) advance(sim, .2, { skillSlot: slot });
  sim.player.character.skillSlots[0] = 'fireball';
  advance(sim, .2, { skillSlot: 0 });
  assert.equal(sim.player.mana, sim.player.maxMana);
  assert.equal(sim.projectiles.length, 0); assert.equal(sim.player.attack, null);
  assert.equal(sim.player.castTime, 0); assert.deepEqual(sim.player.skillCooldowns, {});
  assert.equal(sim.drainEvents().filter(event => event.type === 'cast' || event.type === 'swing' || event.type === 'hit').length, 0);
});

for (const id of (Object.keys(SKILL_DEFINITIONS) as SkillId[]).filter(id=>SKILL_DEFINITIONS[id].tier!=='aura')) {
  test(`${id} unlocks through connected nodes, pays its cost once and produces its actual combat effect`, () => {
    const definition = SKILL_DEFINITIONS[id];
    // Class skills need a matching character; racials a matching race (played as a mana class
    // so the resource assertion stays exact — racials cost no class resource).
    const sim = definition.classId ? createWowSim(definition.classId)
      : definition.raceId ? createWowSim(manaClassForRace(definition.raceId), definition.raceId)
      : createWowSim(definition.requirement === 'bow' || definition.requirement === 'heavy' ? 'hunter' : 'mage', 'undead');
    const player = sim.player, wowClass = WOW_CLASSES[player.character.classId!];
    const slot = definition.raceId ? RACIAL_SLOT : 0;
    unlock(sim, id, definition.raceId ? 0 : 0);
    sim.setCombatViewport({ x: -600, y: -400, width: 1200, height: 800 });
    const enemy = target(sim, id === 'fireball' || id === 'volley' || id === 'siphon' ? 80 : 45);
    // Gates: live target, execute range, stealth (carried by a stealth buff), form, combo.
    if ((definition.targetMode ?? 'point') === 'enemy') sim.setTarget(enemy.id);
    if (definition.executeThreshold) enemy.hp = enemy.maxHp * definition.executeThreshold * .5;
    if (definition.requiresStealth) sim.addBuff('stealth', definition.color, { duration: 60, stealth: true });
    if (definition.requiresForm) sim.addBuff(definition.requiresForm + ' form', definition.color, { duration: 60, form: definition.requiresForm });
    if (definition.combo === 'spend') player.comboPoints = 5;
    // Ally-gated casts need a matching summon; frozen-gated casts need a frozen target.
    if (definition.requiresAlly) sim.summonAlly(definition.requiresAlly === 'demon' ? 'imp' : definition.requiresAlly, 1);
    if (definition.requiresFrozen) enemy.freezeTime = 5;
    // Passive regen is orthogonal noise; the assertion isolates the skill's own cost.
    player.derived.manaRegeneration = 0;
    const spent = Math.max(0, Math.round(definition.manaCost * player.derived.manaCostMultiplier * 10) / 10);
    // Costs above the pool (e.g. Prayer of Healing) need a bigger pool to fire at all.
    if (spent > player.maxMana && wowClass.resource === 'mana') player.maxMana = spent + 10;
    // Bear/cat forms swap the resource pool: the form's model (rage/energy), not the class's.
    const formModel = definition.requiresForm === 'bear' ? WOW_CLASSES.warrior
      : definition.requiresForm === 'cat' ? WOW_CLASSES.rogue : undefined;
    const model = formModel ?? wowClass;
    // Non-mana resources live in player.mana but cap at the class resourceCap, which the
    // sim enforces every tick — derived maxMana from gear does not apply to rage/energy/runic.
    const resourceCap = model.resource !== 'mana' ? model.resourceCap : player.maxMana;
    player.mana = resourceCap;
    sim.drainEvents();
    // Tick 1 starts the cast; it completes after castTime more ticks.
    const castTicks = 1 + Math.ceil((definition.castTime ?? 0) / FIXED_STEP);
    advance(sim, FIXED_STEP * castTicks, { skillSlot: slot, aimX: enemy.x });
    // Costs and gains settle at cast start; decay ticks before the cast and, for
    // non-offensive casts (no combatUntil), through the remaining cast time.
    const recipe = SKILL_EXECUTION[id] as { kind?: string; form?: string; resourceGain?: number; resourceGainFrac?: number } | undefined;
    const offensive = !!recipe?.kind && ['sweep','dash','radial','cone','backstab','projectile','ground','chain','strike','dot','cc','interrupt','pull','taunt','channel','comboStrike','runeStrike'].includes(recipe.kind);
    const runesSpent = definition.runeCost ? Object.values(definition.runeCost).reduce((a, b) => a + (b ?? 0), 0) : 0;
    const runicGain = runesSpent ? runesSpent * (definition.runicPowerGain ?? 10) : (definition.runicPowerGain ?? 0);
    const gained = (recipe?.resourceGain ?? 0) + (recipe?.resourceGainFrac ?? 0) * resourceCap;
    const decay = model.resourceDecay * FIXED_STEP;
    const afterCast = Math.max(0, Math.min(resourceCap, resourceCap - decay - spent + runicGain + gained));
    // Bear/cat form skills swap the pool after the cost is paid (rage 0 / energy cap).
    const formSwap = recipe?.kind === 'form' ? (recipe.form === 'bear' ? 0 : recipe.form === 'cat' ? 100 : undefined) : undefined;
    const expectedMana = formSwap ?? Math.max(0, afterCast - (offensive || !definition.castTime ? 0 : decay * (castTicks - 1)));
    close(player.mana, expectedMana);
    if (runesSpent) assert.equal(player.runes!.filter(r => r > 0).length, runesSpent, `${id} must spend its runes`);
    if (definition.shardCost) assert.equal(player.soulShards, 4 - definition.shardCost);
    // Cooldown starts at cast start (prepaid) and ticks down through the cast; ultimates
    // and bulwark have a floor in resolveSkill.
    const cooldownFloor = id === 'bulwark' ? 4 : definition.tier === 'ultimate' ? 12 : 0;
    close(player.skillCooldowns[id]!, Math.max(0, Math.max(cooldownFloor, definition.cooldown * player.derived.cooldownMultiplier) - (castTicks - 1) * FIXED_STEP));

    const firstEvents = sim.drainEvents();
    // Cast-time skills emit 'cast' at start and completion; instant/channel skills emit once.
    assert.equal(firstEvents.filter(event => (event.type === 'cast' || event.type === 'swing') && event.skill === id).length, definition.castTime ? 2 : 1);
    if (id === 'cleave' || id === 'whirlwind') {
      assert.ok(player.attack); assert.ok(player.attack.arc > Math.PI);
      assert.ok(player.attack.damage > deriveAttackStats(player.stats, player.equipment.mainHand).damage);
    } else if (id === 'lunge') {
      assert.ok(player.x > 0 && player.x < 10, 'dash advances over time, not a teleport');
    } else if(id==='sidestep'){assert.ok(player.dash);assert.equal(player.dash.damage,0);} else if(id==='runicWard'){assert.ok(player.skillEffects?.ward?.capacity);} else if(id==='brace'||id==='rallyOfIron'||id==='ghostHunt'){assert.ok(player.skillEffects?.[id]);} else if (id === 'bulwark') assert.ok(player.guardTime > 2.9);
    else if (id === 'meteor' || id === 'rainOfArrows') assert.equal(sim.groundEffects.length, 1);
    // Offensive casts arm auto-attack; stop it so later ticks measure only this skill.
    player.autoAttack = false;
    // Observe past the skill's first damage event: delayed ground effects arm after
    // `delay`, dots tick after `interval`/`detonate`, so the window follows the recipe.
    const exec = SKILL_EXECUTION[id] as { kind?: string; delay?: number; dot?: { interval?: number; detonate?: number }; healFrac?: number; radius?: number } | undefined;
    const window = Math.max(.5, (exec?.delay ?? 0) + .5, (exec?.dot?.interval ?? 0) + .5, (exec?.dot?.detonate ?? 0) + .5);
    advance(sim, id === 'meteor' || id === 'cataclysm' ? 1.1 : window, { aimX: enemy.x });
    const laterEvents = sim.drainEvents();
    assert.equal(laterEvents.filter(event => (event.type === 'cast' || event.type === 'swing') && event.skill === id).length, 0);
    // Only recipes that actually strike the enemy can lower its hp (interrupt/taunt/cc don't).
    // Heal-only channels (Tranquility, Divine Hymn) carry a damageMultiplier for heal
    // scaling but never touch the enemy, so they are exempt from the damage check.
    const healOnly = exec?.kind === 'channel' && exec.healFrac !== undefined
      && exec.radius === undefined && (definition.targetMode === 'self' || definition.targetMode === undefined);
    const damages = !healOnly && ['sweep','dash','radial','cone','backstab','projectile','ground','chain','strike','dot','channel','comboStrike','runeStrike'].includes(SKILL_EXECUTION[id]?.kind ?? '');
    if (definition.damageMultiplier>0 && damages) assert.ok(enemy.hp < enemy.maxHp, `${id} must damage the actual enemy`);
    if (id === 'siphon') {
      assert.ok(player.hp > 20); assert.ok(laterEvents.some(event => event.type === 'heal' && event.value! > 0));
    }

  });
}

test('skill cooldown belongs to the skill and cannot be reset by moving it to another slot', () => {
  const sim = createSim(); unlock(sim, 'frostLance');
  advance(sim, FIXED_STEP, { skillSlot: 0 }); sim.drainEvents();
  assert.ok(assignSkill(sim.player, 4, 'frostLance').ok);
  assert.equal(sim.player.character.skillSlots[0], null); assert.equal(sim.player.character.skillSlots[4], 'frostLance');
  advance(sim, .4, { skillSlot: 4 });
  assert.equal(sim.drainEvents().filter(event => event.type === 'cast').length, 0);
  advance(sim, 1.5, { skillSlot: 4 });
  assert.equal(sim.drainEvents().filter(event => event.type === 'cast').length, 1);
});

test('insufficient mana and blocked geometry prevent free or wall-crossing skill effects', () => {
  const sim = createSim(); unlock(sim, 'iceNova');
  sim.player.mana = 0;
  advance(sim, FIXED_STEP, { skillSlot: 0 });
  assert.ok(sim.player.mana < 1); assert.equal(sim.player.activeSkill, null); assert.equal(sim.player.skillCooldowns.iceNova, undefined);
  const wall: WorldQuery = { blocked: x => x >= 30 && x <= 40,
    move: (x, y, dx, dy, radius) => x + dx + radius >= 30 ? { x, y } : { x: x + dx, y: y + dy } };
  const blocked = new Simulation(wall, { spawn: false }); unlock(blocked, 'lunge');
  const behind = target(blocked, 55);
  advance(blocked, FIXED_STEP, { skillSlot: 0 });
  assert.ok(blocked.player.x < 30); assert.equal(behind.hp, behind.maxHp);
});

test('armor, passive regeneration and movement gear affect simulation rather than only the character panel', () => {
  const sim = createSim(), item = sim.player.character.equipped.chest!;
  item.implicit = { armor: 120, lifeRegen: 6, manaRegen: 3, moveSpeedPercent: 20 };
  refreshCharacter(sim.player);
  const enemy = sim.spawnEnemy('brute', -20, 0)!;
  enemy.state = 'attack'; enemy.attackAngle = 0; enemy.stateDuration = 999;
  advance(sim, FIXED_STEP);
  assert.equal(sim.player.hp, 87);
  assert.equal(sim.drainEvents().find(event => event.type === 'hurt')!.value, 13);
  sim.enemies = []; sim.player.hp = 50; sim.player.mana = 20;
  advance(sim, 1, { moveX: 1 });
  close(sim.player.hp, 56); close(sim.player.mana, 23.1);
  assert.ok(sim.player.vx > 197 && sim.player.vx <= 198);
});

test('the first real death drops loot and awards level points exactly once', () => {
  // Warrior melee lands inside the swing's active window — no projectile travel.
  const sim = createWowSim('warrior', 'undead'); sim.player.xp = 90;
  const enemy = sim.spawnEnemy('stalker', 45, 0)!; enemy.hp = 1; enemy.stateDuration = 999;
  advance(sim, .25, { attack: true });
  assert.equal(enemy.state, 'dead'); assert.equal(sim.groundItems.length, 1);
  assert.equal(sim.player.level, 2); assert.equal(sim.player.xp, Math.round(enemy.xpReward*xpLevelFactor(1,enemy.level))-10);
  assert.equal(sim.player.character.skillPoints, 1); assert.equal(sim.player.character.statPoints, 5);
  assert.equal(sim.groundItems[0].item.itemLevel, enemy.level, 'the source level owns loot even when the kill levels the player');
  const id = sim.groundItems[0].item.id;
  advance(sim, 1, { attack: true });
  assert.equal(sim.kills, 1); assert.equal(sim.player.xp, Math.round(enemy.xpReward*xpLevelFactor(1,enemy.level))-10);
  assert.equal(sim.groundItems.length, 1); assert.equal(sim.groundItems[0].item.id, id);
  const events = sim.drainEvents();
  assert.equal(events.filter(event => event.type === 'kill').length, 1);
  const levels = events.filter(event => event.type === 'level');
  assert.equal(levels.length, 1);
  assert.equal(levels[0].level, sim.player.level);
  assert.equal(levels[0].skillPoints, 1); assert.equal(levels[0].statPoints, 5);
});

test('repeated seeded enemy deaths generate reproducible loot with unique identities', () => {
  const run = () => {
    // Warrior melee arc clears each stacked wave in one swing — no projectile travel.
    const sim = createWowSim('warrior', 'undead');
    for (let wave = 0; wave < 4; wave++) {
      for (let count = 0; count < 10; count++) {
        const enemy = sim.spawnEnemy('stalker', 48, 0)!; assert.ok(enemy);
        enemy.hp = 1; enemy.stateDuration = 999;
      }
      advance(sim, 1.25, { attack: true });
    }
    assert.equal(sim.kills, 40);
    assert.ok(sim.groundItems.length > 5);
    assert.equal(new Set(sim.groundItems.map(drop => drop.item.id)).size, sim.groundItems.length);
    return sim.groundItems.map(drop => drop.item);
  };
  assert.deepEqual(run(), run());
});

test('a full inventory preserves dropped loot until a cell is available, then an explicit pickup collects it once', () => {
  // Warrior melee lands inside the swing's active window — no projectile travel.
  const sim = createWowSim('warrior', 'undead');
  sim.player.character.inventory = Array.from({ length: PACK_CELLS }, (_, index) => generateItem(9000 + index, 1, 'ring'));
  const enemy = sim.spawnEnemy('stalker', 22, 0)!; enemy.hp = 1; enemy.stateDuration = 999;
  advance(sim, .25, { attack: true });
  assert.equal(sim.groundItems.length, 1);
  const drop = sim.groundItems[0];
  assert.equal(sim.player.character.inventory.some(item => item?.id === drop.item.id), false);
  assert.equal(sim.requestGroundItem(drop.id), 'Bag full. Make room for this item.');
  assert.equal(sim.groundPickup.id, null);
  sim.player.x = drop.x; sim.player.y = drop.y;
  for (const cell of footprintCells(drop.item,0)!) sim.player.character.inventory[cell] = null;
  assert.equal(sim.requestGroundItem(drop.id),null);
  advance(sim, FIXED_STEP);
  assert.equal(sim.groundItems.length, 0); assert.equal(sim.player.character.inventory.at(0)?.id, drop.item.id);
  advance(sim, .25);
  assert.equal(sim.player.character.inventory.filter(item => item?.id === drop.item.id).length, 1);
  assert.equal(sim.drainEvents().filter(event => event.type === 'loot' && event.item.id === drop.item.id).length, 1);
  assert.equal(sim.player.xp, Math.round(enemy.xpReward*xpLevelFactor(1,enemy.level)));
});

test('starting a new run resets character allocations, points, inventory changes and drops together', () => {
  const sim = createSim(); unlock(sim, 'iceNova'); awardCharacterExperience(sim.player, 800);
  sim.player.character.inventory.fill(null);
  sim.groundItems.push({ id: 991, x: 10, y: 10, item: generateItem(991, 4) });
  sim.reset();
  assert.equal(sim.player.level, 1); assert.equal(sim.player.xp, 0);
  assert.equal(sim.player.character.skillPoints, 0); assert.equal(sim.player.character.statPoints, 0);
  // A fresh sheet owns the free class starter node and carries it on bar slot 1.
  const starter = WOW_CLASSES[sim.player.character.classId].starterSkill;
  assert.deepEqual(sim.player.character.allocatedNodes, ['origin', `wow-${sim.player.character.classId}-${starter}`]);
  assert.deepEqual(sim.player.character.skillSlots, [starter, ...Array.from({ length: BAR_TOTAL - 1 }, () => null)]);
  assert.equal(sim.player.character.inventory.filter(Boolean).length, 0);
  assert.equal(sim.groundItems.length, 0);
  assert.deepEqual(sim.player.skillCooldowns, {});
});


test('a projectile already in flight cannot revive a fallen player through life on hit', () => {
  const sim = createSim(), enemy = target(sim, 40), player = sim.player;
  const armor = player.character.equipped.chest!;
  armor.implicit = { lifeOnHit: 20 }; refreshCharacter(player);
  player.hp = 1;
  const attacker = target(sim, -20); attacker.state = 'attack'; attacker.attackAngle = 0; attacker.stateDuration = 1;
  sim.projectiles.push({ hitIds: new Set(), id: 9999, x: 38, y: 0, prevX: 38, prevY: 0, vx: 360, vy: 0, angle: 0,
    radius: 5, damage: 10, life: 1, maxLife: 1, owner: 'player', sourceLevel: 1 });
  sim.update(FIXED_STEP, idle);
  assert.equal(player.dead, true); assert.equal(player.hp, 0);
  assert.ok(enemy.hp < enemy.maxHp);
});

test('held no-cooldown magic repeats at cast speed, never at physical attack speed', () => {
  // WoW skills are GCD-bound; cast speed drives the staff's bolt auto-attack cadence
  // (equipment.ts: bolt attackKind uses castSpeedMultiplier, melee uses attackSpeedMultiplier).
  const bolts = (castSpeed: number, attackSpeed: number) => {
    const sim = createSim(); equipForSkill(sim, 'fireball'); // ember-staff: bolt attackKind
    const enemy = target(sim, 45); sim.setTarget(enemy.id);
    sim.player.stats.castSpeedMultiplier = castSpeed;
    sim.player.stats.attackSpeedMultiplier = attackSpeed;
    sim.player.mana = sim.player.maxMana = 10000;
    sim.player.autoAttack = true;
    let shots = 0;
    for (let tick = 0; tick < Math.round(6 / FIXED_STEP); tick++) {
      const before = sim.projectiles.length;
      sim.update(FIXED_STEP, idle);
      shots += Math.max(0, sim.projectiles.length - before);
    }
    return shots;
  };
  const normal = bolts(1, 1);
  assert.ok(normal >= 2);
  assert.equal(bolts(1, 3), normal);
  assert.ok(bolts(2, 1) >= normal * 2 - 1);
});


test('Living Ember creates snapshotted damaging ground at the actual fireball impact',()=>{
  const sim=createSim(); unlock(sim,'fireball'); const p=sim.player;
  p.character.allocatedNodes.push('specialization:fireball-ember'); p.character.skillSpecializations.fireball='fireball-ember';
  target(sim,80); advance(sim,FIXED_STEP,{skillSlot:0,aimX:80});
  const released=sim.projectiles[0].damage;
  delete p.character.skillSpecializations.fireball;
  advance(sim,.3);
  const embers=sim.groundEffects.find(e=>e.kind==='embers'); assert.ok(embers);
  assert.equal(embers.damage,0); close(embers.burn!.dps,released*.24); assert.ok(embers.pulsesLeft>0&&embers.pulsesLeft<=12);
  sim.drainEvents(); advance(sim,.6);
  assert.equal(sim.drainEvents().some(e=>e.type==='blast'&&e.skill==='fireball'),false);
});

test('relocation ends a following storm while preserving unrelated ground attacks',()=>{
  const sim=createSim(); unlock(sim,'tempest');
  advance(sim,FIXED_STEP,{skillSlot:0}); assert.ok(sim.groundEffects.some(e=>e.follow));
  sim.groundEffects.push({id:999,kind:'meteor',skill:'meteor',x:50,y:0,radius:50,delay:1,duration:0,interval:1,damage:10,style:'fire',tick:0,pulsesLeft:1});
  sim.relocate(2000,0);
  assert.equal(sim.groundEffects.length,1); assert.equal(sim.groundEffects[0].id,999);
});
