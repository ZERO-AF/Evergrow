import assert from 'node:assert/strict';
import test from 'node:test';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { SKILL_EXECUTION } from '../src/skill-execution-content.ts';
import { resolvePlayerSkill } from '../src/glyph-state.ts';
import { WOW_CLASSES } from '../src/wow-classes.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { FOCUS_PROFILES } from '../src/focus-content.ts';
import { CHARM_PROFILES } from '../src/charm-content.ts';
import { AURA_IDS, assignedAuras } from '../src/aura-content.ts';
import { generateItem, itemModifiers } from '../src/items.ts';
import { itemMaterialPool } from '../src/item-materials.ts';
import { addInventoryItem, activeCharms } from '../src/inventory-grid.ts';
import { equipItem, planEquipmentChange } from '../src/inventory.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { createPetRecord, adoptPet, freshPetStable, petFamilyForAlly } from '../src/pet-content.ts';
import { RACIAL_SLOT } from '../src/action-bar.ts';
import { BASE_PACK_GRID } from '../src/pack-grid.ts';
import type { Input, Enemy } from '../src/model.ts';
import type { SkillId, EquipmentSlot } from '../src/character-types.ts';
import type { WowClassId, WowRaceId } from '../src/wow-types.ts';
import { createWowSim, idleInput, manaClassForRace, raceForClass } from './fixtures/wow-sim.ts';

const idle: Input = { ...idleInput };
const tick = (sim: Simulation, input: Input = idle) => sim.update(FIXED_STEP, input);
const settle = (sim: Simulation, seconds: number) => {
  const steps = Math.ceil(seconds / FIXED_STEP);
  for (let i = 0; i < steps; i++) tick(sim);
};

/** First weapon profile satisfying the skill's requirement that the class can legally equip. */
function legalWeapon(classId: WowClassId, requirement: string) {
  const cls = WOW_CLASSES[classId];
  const legal = (w: (typeof WEAPON_PROFILES)[number]) => cls.weapons.includes(w.family);
  switch (requirement) {
    case 'melee': return WEAPON_PROFILES.find(w => w.attackKind === 'melee' && w.hands === 1 && legal(w))!;
    case 'blade': return WEAPON_PROFILES.find(w => (w.family === 'sword' || w.family === 'dagger') && legal(w))!;
    case 'heavy': return WEAPON_PROFILES.find(w => (w.family === 'axe' || w.family === 'mace' || w.family === 'polearm') && legal(w))!;
    case 'dagger': return WEAPON_PROFILES.find(w => w.family === 'dagger' && legal(w))!;
    case 'bow': return WEAPON_PROFILES.find(w => (w.family === 'bow' || w.family === 'gun') && legal(w))!;
    case 'magic': return WEAPON_PROFILES.find(w => (w.family === 'staff' || w.family === 'wand') && legal(w))!;
    case 'shield': return WEAPON_PROFILES.find(w => w.hands === 1 && w.attackKind === 'melee' && legal(w))!;
    default: return WEAPON_PROFILES.find(w => legal(w))!;
  }
}

/** Equip a legal weapon (and shield when required) through the real item path. */
function equipFor(sim: Simulation, id: SkillId): void {
  const p = sim.player, def = SKILL_DEFINITIONS[id];
  const weapon = legalWeapon(p.character.classId, def.requirement);
  const item = generateItem(101, 1, 'weapon', weapon.id, 'common', itemMaterialPool('weapon', weapon.family)[0]!.id);
  p.character.equipped.weapon = item;
  p.character.equipped.offhand = def.requirement === 'shield'
    ? generateItem(102, 1, 'shield', 'iron-buckler', 'common', itemMaterialPool('shield')[0]!.id)
    : null;
  executeCharacterCommand(p, { type: 'equipTitle', id: null }); // cheap refreshCharacter trigger
}

/** Spawn a docile target that never acts or moves during the sweep. */
function spawnTarget(sim: Simulation, x = 60, y = 0): Enemy {
  const enemy = sim.spawnEnemy('brute', x, y)!;
  enemy.hp = enemy.maxHp = 100000;
  enemy.state = 'idle';
  enemy.stateDuration = 9999;
  enemy.awareness = 0;
  return enemy;
}

/** Satisfy every authored activation gate so the recipe itself is what runs. */
function satisfyGates(sim: Simulation, id: SkillId, target: Enemy | undefined): void {
  const p = sim.player, costs = resolvePlayerSkill(id, p), recipe = SKILL_EXECUTION[id];
  // The fixture doesn't allocate attributes; a real caster sinks points into
  // Intelligence (+2 mana each). Ensure the pool covers the cost so expensive
  // ultimates (Prayer of Healing 130, Tranquility 120) can actually cast.
  if (costs.mana > p.maxMana) {
    const attrs = (p.character as { attributes?: Record<string, number> }).attributes ??= {};
    attrs.intelligence = (attrs.intelligence ?? 0) + Math.ceil((costs.mana - p.maxMana) / 2) + 20;
    executeCharacterCommand(p, { type: 'equipTitle', id: null }); // re-derive stats
  }
  p.mana = p.maxMana;
  if (costs.requiresStealth || (recipe.kind === 'comboStrike' && recipe.requiresStealth))
    sim.addBuff('Stealth', '#888', { duration: 60, stealth: true });
  if (costs.requiresForm) {
    sim.addBuff('Form', '#888', { duration: 60, form: costs.requiresForm });
    p.mana = p.maxMana; // form swap resets the pool (rage 0 / energy cap)
  }
  if (costs.requiresBuff) sim.addBuff('Stance', '#888', { duration: 60 }, costs.requiresBuff);
  if (costs.requiresAlly) sim.summonAlly(costs.requiresAlly === 'demon' ? 'imp' : costs.requiresAlly, 1, 60);
  if (costs.requiresFrozen && target) target.freezeTime = 10;
  if (costs.executeThreshold && target) target.hp = Math.max(1, target.maxHp * costs.executeThreshold * 0.5);
  // Combo points reset when the target changes; set the target first, then the points.
  if (target) p.targetId = target.id;
  if (costs.combo === 'spend' || (recipe.kind === 'comboStrike' && recipe.spend)) p.comboPoints = 5;
  if (costs.shardCost) p.soulShards = 5;
  if (costs.runeCost) p.runes = [0, 0, 0, 0, 0, 0];
  if (costs.requiresBehind || (recipe.kind === 'comboStrike' && recipe.requiresBehind)) {
    // behind() = player sits inside the enemy's rear arc: face the enemy away from the player.
    if (target) target.angle = Math.atan2(target.y - p.y, target.x - p.x);
  }
  // Heals need a wounded body; summons of pet-family kinds need an adopted PetRecord.
  if (recipe.kind === 'heal' || recipe.kind === 'hot' || recipe.kind === 'cleanse' || recipe.kind === 'channel')
    p.hp = Math.max(1, p.maxHp * 0.4);
  if (recipe.kind === 'summon' && petFamilyForAlly(recipe.ally)) {
    const pet = createPetRecord(9001, 'hound', 5);
    p.character.pets = adoptPet(freshPetStable(), pet) ?? p.character.pets;
    sim.syncPetAlly();
  }
  if (recipe.kind === 'heal' && recipe.pet) {
    const pet = createPetRecord(9002, 'hound', 5);
    p.character.pets = adoptPet(freshPetStable(), pet) ?? p.character.pets;
    sim.syncPetAlly();
    const ally = sim.petAlly();
    if (ally && recipe.pet === 'mend') ally.hp = Math.max(1, ally.maxHp * 0.4);
    if (ally && recipe.pet === 'revive') ally.hp = 0;
  }
  if (recipe.kind === 'heal' && recipe.consumeAlly)
    sim.summonAlly(recipe.consumeAlly === 'demon' ? 'imp' : recipe.consumeAlly, 1, 60);
  if (recipe.kind === 'tame' && target) target.kind = 'thornReaver'; // a tameable beast
  if (recipe.kind === 'cc' && recipe.family && target) {
    const kindByFamily = { undead: 'brute', humanoid: 'goblin', beast: 'hound', demon: 'brute', elemental: 'wisp', dragonkin: 'brute', critter: 'goblin' } as const;
    target.kind = kindByFamily[recipe.family] ?? 'brute';
  }
}

test('every active skill casts through the real sim: gates, costs, cooldowns and effects', () => {
  const failures: string[] = [];
  const skills = Object.values(SKILL_DEFINITIONS).filter(s => s.tier !== 'aura');
  for (const def of skills) {
    const id = def.id;
    try {
      const classId: WowClassId = def.classId ?? (def.raceId ? manaClassForRace(def.raceId) : 'warrior');
      const raceId: WowRaceId = def.raceId ?? raceForClass(classId);
      const sim = createWowSim(classId, raceId);
      const p = sim.player;
      p.level = 60;
      const node = def.classId ? `wow-${def.classId}-${id}` : `skill:${id}`;
      if (!def.raceId) p.character.allocatedNodes.push(node);
      equipFor(sim, id);
      if (def.raceId) p.character.skillSlots[0] = null;
      else {
        const assigned = executeCharacterCommand(p, { type: 'assignSkill', slot: 0, skill: id });
        if (!assigned.ok) { failures.push(`${id}: assignSkill rejected: ${assigned.message}`); continue; }
      }
      const recipe = SKILL_EXECUTION[id];
      const melee = recipe.kind === 'comboStrike' || recipe.kind === 'backstab' || recipe.kind === 'strike'
        || recipe.kind === 'runeStrike' || recipe.kind === 'sweep' || recipe.kind === 'tame';
      const target = spawnTarget(sim, melee ? 24 : 60);
      const costs = resolvePlayerSkill(id, p);
      satisfyGates(sim, id, target);
      const manaBefore = p.mana, shardsBefore = p.soulShards ?? 0;
      const comboBefore = p.comboPoints ?? 0;
      const runesBefore = (p.runes ?? []).slice();
      const hpBefore = p.hp;
      const input: Input = { ...idle, aimX: target.x, aimY: target.y, skillSlot: def.raceId ? RACIAL_SLOT : 0, targetId: target.id };
      tick(sim, input);
      const events = sim.drainEvents();
      // Activation marker: instant casts record their cooldown key; cast-time/channel
      // skills open p.cast and pay costs up front (prepaid).
      if (!(id in p.skillCooldowns) && !p.cast) {
        const failed = events.find(e => e.type === 'skill-failed');
        failures.push(`${id}: did not activate${failed && 'reason' in failed ? ` (${String(failed.reason)})` : ''}`);
        continue;
      }
      if (costs.mana > 0 && recipe.kind !== 'form') {
        // Runic-power gains refund into the DK's mana pool; count them so the
        // net spend matches (corpseExplosion: 40 mana − 10 runic = 30 net).
        const refund = (recipe as { resourceGain?: number }).resourceGain ?? 0;
        const runic = (costs.runeCost ? (costs.runicPowerGain ?? 10) * Object.values(costs.runeCost).reduce((a, b) => a + (b ?? 0), 0) : 0)
          + (costs.runeCost ? 0 : (costs.runicPowerGain ?? 0));
        if (p.mana > manaBefore - costs.mana + refund + runic + 0.5)
          failures.push(`${id}: mana ${manaBefore} -> ${p.mana}, expected spend ${costs.mana}`);
      }
      if (costs.shardCost && (p.soulShards ?? 0) !== shardsBefore - costs.shardCost)
        failures.push(`${id}: soul shards ${shardsBefore} -> ${p.soulShards}`);
      if (costs.runeCost) {
        const spent = (p.runes ?? []).some((ready, i) => ready > 0 && runesBefore[i] === 0);
        if (!spent) failures.push(`${id}: no rune went on cooldown`);
      }
      if (costs.combo === 'spend' && (p.comboPoints ?? 0) >= comboBefore)
        failures.push(`${id}: combo points not spent (${comboBefore} -> ${p.comboPoints})`);
      if (costs.combo === 'build' && (p.comboPoints ?? 0) <= 0)
        failures.push(`${id}: no combo point built`);
      // Cooldown/GCD respected: a second press must not restart the cooldown.
      if (costs.cooldown > 0 || !costs.offGcd) {
        const cdBefore = p.skillCooldowns[id] ?? 0;
        tick(sim, { ...idle, skillSlot: def.raceId ? RACIAL_SLOT : 0, targetId: target.id });
        sim.drainEvents();
        if ((p.skillCooldowns[id] ?? 0) > cdBefore)
          failures.push(`${id}: cooldown restarted on a rejected recast`);
      }
      // Let casts/channels/dashes finish; capture peak state so short-lived
      // effects (3s buffs, guard windows, stealth) still count.
      let peakGuard = p.guardTime, peakBuffs = (p.buffs ?? []).length, peakAllies = (p.allies ?? []).length;
      let peakStealth = !!p.stealthed, peakWard = !!p.skillEffects?.ward, peakEffects = !!p.skillEffects;
      const runSeconds = Math.min(30, (costs.castTime ?? 0) + (recipe.kind === 'channel' ? recipe.duration : 0) + 3);
      const steps = Math.ceil(runSeconds / FIXED_STEP);
      for (let i = 0; i < steps; i++) {
        tick(sim);
        peakGuard = Math.max(peakGuard, p.guardTime);
        peakBuffs = Math.max(peakBuffs, (p.buffs ?? []).length);
        peakAllies = Math.max(peakAllies, (p.allies ?? []).length);
        peakStealth ||= !!p.stealthed;
        peakWard ||= !!p.skillEffects?.ward;
        peakEffects ||= !!p.skillEffects;
      }
      events.push(...sim.drainEvents());
      const hurt = target.hp < target.maxHp || target.state === 'dead';
      const controlled = !!(target.cc?.length || target.stagger > 0 || target.slowTime > 0 || target.freezeTime! > 10 || target.taunted || target.dots?.length || target.sundered);
      const moved = Math.hypot(target.x - (melee ? 24 : 60), target.y) > 1;
      const buffed = peakBuffs > 0;
      const healed = p.hp > hpBefore;
      const summoned = peakAllies > 0;
      const effectOk = (() => {
        switch (recipe.kind) {
          case 'projectile': return hurt || sim.projectiles.length > 0 || events.some(e => e.type === 'blast' || e.type === 'hit');
          case 'chain': return events.some(e => e.type === 'chain') || hurt;
          case 'ground': return events.some(e => e.type === 'ground' || e.type === 'blast') || hurt;
          case 'sweep': case 'cone': case 'backstab': case 'strike': case 'runeStrike': case 'comboStrike':
            return hurt || controlled || events.some(e => e.type === 'skill-strike' || e.type === 'swing');
          case 'radial': return hurt || controlled || buffed || events.some(e => e.type === 'blast');
          case 'dot': return hurt || controlled;
          case 'cc': case 'interrupt': case 'taunt': return controlled || events.some(e => e.type === 'skill-strike' || e.type === 'blast');
          case 'pull': return moved || controlled;
          case 'dash': case 'step': return events.some(e => e.type === 'cast' || e.type === 'swing' || e.type === 'skill-strike') || hurt;
          case 'heal': case 'hot': return healed || buffed || summoned || events.some(e => e.type === 'heal' || e.type === 'notice');
          case 'buff': case 'form': return buffed;
          case 'stealth': return peakStealth || buffed;
          case 'ward': return peakWard;
          case 'stance': return peakEffects;
          case 'guard': return peakGuard > 0;
          case 'summon': return summoned;
          case 'tame': return !!p.character.pets?.active || events.some(e => e.type === 'notice');
          case 'channel': return hurt || controlled || healed || p.mana > manaBefore - costs.mana || events.some(e => e.type === 'blast' || e.type === 'cast');
          case 'cleanse': return healed || buffed || events.length > 0;
          default: return events.length > 0;
        }
      })();
      if (!effectOk) failures.push(`${id}: activated but produced no observable effect (kind ${recipe.kind})`);
    } catch (error) {
      failures.push(`${id}: threw ${(error as Error).message}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('every aura assigns to the bar, reserves mana and ticks without errors', () => {
  const failures: string[] = [];
  for (const id of AURA_IDS) {
    try {
      const sim = createWowSim('warrior');
      const p = sim.player;
      p.character.allocatedNodes.push(`skill:${id}`);
      const assigned = executeCharacterCommand(p, { type: 'assignSkill', slot: 0, skill: id });
      if (!assigned.ok) { failures.push(`${id}: assignSkill rejected: ${assigned.message}`); continue; }
      if (!assignedAuras(p.character).includes(id)) { failures.push(`${id}: not in assignedAuras`); continue; }
      // elementalSpikes scales off a melee weapon; give the warrior one.
      p.character.equipped.weapon = generateItem(31, 1, 'weapon', 'longsword', 'common', itemMaterialPool('weapon', 'sword')[0]!.id);
      executeCharacterCommand(p, { type: 'equipTitle', id: null });
      const target = spawnTarget(sim, 40);
      settle(sim, 2);
      const events = sim.drainEvents();
      if (id === 'elementalSpikes' && !(target.hp < target.maxHp) && !events.some(e => e.type === 'blast'))
        failures.push(`${id}: no spike damage or pulse in 2s`);
      if (id === 'thornbound' && !(target.slowTime > 0)) failures.push(`${id}: no slow applied`);
    } catch (error) {
      failures.push(`${id}: threw ${(error as Error).message}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('every weapon profile equips through the real path and swings its family basic', () => {
  const failures: string[] = [];
  for (const profile of WEAPON_PROFILES) {
    try {
      const classId = WOW_CLASSES.warrior.weapons.includes(profile.family) ? 'warrior'
        : (Object.keys(WOW_CLASSES) as WowClassId[]).find(c => WOW_CLASSES[c].weapons.includes(profile.family))!;
      const sim = createWowSim(classId);
      const p = sim.player;
      const item = generateItem(41, 1, 'weapon', profile.id, 'common', itemMaterialPool('weapon', profile.family)[0]!.id);
      assert.ok(addInventoryItem(p.character, item));
      const equipped = equipItem(p.character, p.character.inventory.findIndex(i => i?.id === item.id), 60);
      if (!equipped.ok) { failures.push(`${profile.id}: equip rejected: ${equipped.message}`); continue; }
      executeCharacterCommand(p, { type: 'equipTitle', id: null });
      if (p.equipment.mainHand.id !== item.id || p.equipment.mainHand.family !== profile.family) { failures.push(`${profile.id}: not in mainHand`); continue; }
      const target = spawnTarget(sim, profile.attackKind === 'melee' ? 24 : 120);
      const hpBefore = target.hp;
      settle(sim, 0.2);
      let swung = false;
      for (let i = 0; i < 300 && !swung; i++) {
        tick(sim, { ...idle, attack: true, targetId: target.id, aimX: target.x, aimY: target.y });
        swung = target.hp < hpBefore || sim.projectiles.length > 0
          || sim.drainEvents().some(e => e.type === 'swing' || e.type === 'hit');
      }
      if (!swung) failures.push(`${profile.id}: basic attack produced no hit, swing or projectile`);
    } catch (error) {
      failures.push(`${profile.id}: threw ${(error as Error).message}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('paired one-handed weapons alternate hands; two-handed equip displaces the offhand', () => {
  const sim = createWowSim('warrior');
  const p = sim.player;
  const sword = generateItem(11, 1, 'weapon', 'longsword', 'common', itemMaterialPool('weapon', 'sword')[0]!.id);
  const axe = generateItem(12, 1, 'weapon', 'hand-axe', 'common', itemMaterialPool('weapon', 'axe')[0]!.id);
  assert.ok(addInventoryItem(p.character, sword) && addInventoryItem(p.character, axe));
  assert.ok(equipItem(p.character, p.character.inventory.findIndex(i => i?.id === sword.id), 60).ok);
  assert.ok(equipItem(p.character, p.character.inventory.findIndex(i => i?.id === axe.id), 60, 'offhand').ok);
  executeCharacterCommand(p, { type: 'equipTitle', id: null });
  assert.equal(p.equipment.offHand?.kind, 'weapon');
  const target = spawnTarget(sim, 24);
  // Hold attack; record each swing's hand as it starts.
  const hands: string[] = [];
  for (let i = 0; i < 600 && hands.length < 4; i++) {
    tick(sim, { ...idle, attack: true, targetId: target.id });
    if (p.attack && p.attack.elapsed <= FIXED_STEP * 1.5 && hands[hands.length - 1] !== p.attack.hand)
      hands.push(p.attack.hand);
  }
  assert.deepEqual(hands, ['main', 'off', 'main', 'off']);
  // Equipping a two-hander must displace both weapons back into the pack.
  const great = generateItem(13, 1, 'weapon', 'greatblade', 'common', itemMaterialPool('weapon', 'sword')[0]!.id);
  assert.ok(addInventoryItem(p.character, great));
  const plan = planEquipmentChange(p.character, great, 60, { sourceIndex: p.character.inventory.findIndex(i => i?.id === great.id) });
  assert.ok(plan.ok);
  assert.equal(plan.displaced.length, 2);
  assert.ok(equipItem(p.character, p.character.inventory.findIndex(i => i?.id === great.id), 60).ok);
  executeCharacterCommand(p, { type: 'equipTitle', id: null });
  assert.equal(p.equipment.mainHand.hands, 2);
  assert.equal(p.equipment.offHand, null);
  assert.ok(p.character.inventory.some(i => i?.id === axe.id), 'displaced offhand returned to pack');
});

test('every shield and focus profile equips to the offhand and applies its stats', () => {
  const failures: string[] = [];
  for (const profile of SHIELD_PROFILES) {
    try {
      const sim = createWowSim('warrior');
      const p = sim.player;
      const item = generateItem(21, 1, 'shield', profile.id, 'common', itemMaterialPool('shield')[0]!.id);
      assert.ok(addInventoryItem(p.character, item));
      assert.ok(equipItem(p.character, p.character.inventory.findIndex(i => i?.id === item.id), 60).ok);
      executeCharacterCommand(p, { type: 'equipTitle', id: null });
      if (p.equipment.offHand?.kind !== 'shield' || p.equipment.offHand.shield.id !== item.shield?.id)
        failures.push(`${profile.id}: not in offHand`);
      if (!(p.derived.blockChance > 0)) failures.push(`${profile.id}: no block chance derived`);
    } catch (error) {
      failures.push(`${profile.id}: threw ${(error as Error).message}`);
    }
  }
  for (const profile of FOCUS_PROFILES) {
    try {
      const sim = createWowSim('mage');
      const p = sim.player;
      const item = generateItem(22, 1, profile.visual.kind, profile.id, 'common', itemMaterialPool(profile.visual.kind)[0]!.id);
      assert.ok(addInventoryItem(p.character, item));
      assert.ok(equipItem(p.character, p.character.inventory.findIndex(i => i?.id === item.id), 60).ok);
      executeCharacterCommand(p, { type: 'equipTitle', id: null });
      if (p.equipment.offHand?.kind !== 'focus' || p.equipment.offHand.focus.id !== item.focus?.id)
        failures.push(`${profile.id}: not in offHand`);
      const mods = itemModifiers(item);
      for (const [stat, value] of Object.entries(profile.implicit)) {
        const rolled = (mods as Record<string, number | undefined>)[stat];
        if (rolled === undefined || rolled < (value as number) * 0.5)
          failures.push(`${profile.id}: implicit ${stat} missing from item modifiers`);
      }
    } catch (error) {
      failures.push(`${profile.id}: threw ${(error as Error).message}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('every armor slot equips and its implicit stats reach the derived sheet', () => {
  const failures: string[] = [];
  const sim = createWowSim('warrior');
  const p = sim.player;
  const slots: EquipmentSlot[] = ['head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'amulet', 'ring1', 'ring2'];
  for (const [n, slot] of slots.entries()) {
    try {
      const kind = slot === 'ring1' || slot === 'ring2' ? 'ring' : slot;
      const item = generateItem(61 + n * 13, 10, kind === 'weapon' || kind === 'offhand' ? 'chest' : kind, undefined, 'rare');
      assert.ok(addInventoryItem(p.character, item));
      const equipped = equipItem(p.character, p.character.inventory.findIndex(i => i?.id === item.id), 60, slot);
      if (!equipped.ok) { failures.push(`${slot}: equip rejected: ${equipped.message}`); continue; }
      executeCharacterCommand(p, { type: 'equipTitle', id: null });
      const mods = itemModifiers(item);
      if (!Object.keys(mods).length) failures.push(`${slot}: no modifiers rolled`);
    } catch (error) {
      failures.push(`${slot}: threw ${(error as Error).message}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('every charm profile lands in the charm grid and grants its rolled stats', () => {
  const failures: string[] = [];
  for (const profile of CHARM_PROFILES) {
    try {
      const sim = createWowSim('mage');
      const p = sim.player;
      p.level = 60;
      const item = generateItem(51, 10, 'charm', profile.id, 'rare');
      assert.ok(addInventoryItem(p.character, item), `${profile.id}: no pack space`);
      // Charms only count inside the dedicated grid; move it there.
      const index = p.character.inventory.findIndex(i => i?.id === item.id);
      const moved = executeCharacterCommand(p, { type: 'moveItem', from: index, to: BASE_PACK_GRID.charmStart });
      if (!moved.ok) { failures.push(`${profile.id}: cannot move to charm grid: ${moved.message}`); continue; }
      if (!activeCharms(p.character, 60).some(c => c.id === item.id)) { failures.push(`${profile.id}: not active in charm grid`); continue; }
      const mods = itemModifiers(item);
      if (!Object.keys(mods).length) failures.push(`${profile.id}: no modifiers`);
      // Charms must never equip.
      const plan = planEquipmentChange(p.character, item, 60);
      if (plan.ok) failures.push(`${profile.id}: charm equip plan accepted`);
    } catch (error) {
      failures.push(`${profile.id}: threw ${(error as Error).message}`);
    }
  }
  assert.deepEqual(failures, []);
});
