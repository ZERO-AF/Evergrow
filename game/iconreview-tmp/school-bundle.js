"use strict";
(() => {
  // src/lighting.ts
  var stamps = /* @__PURE__ */ new Map();
  function lightStamp(color) {
    const cached = stamps.get(color);
    if (cached) return cached;
    const image = document.createElement("canvas");
    image.width = image.height = 256;
    const c2 = image.getContext("2d");
    const gradient = c2.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.18, `${color}ce`);
    gradient.addColorStop(0.5, `${color}58`);
    gradient.addColorStop(1, `${color}00`);
    c2.fillStyle = gradient;
    c2.fillRect(0, 0, 256, 256);
    if (stamps.size >= 24) stamps.delete(stamps.keys().next().value);
    stamps.set(color, image);
    return image;
  }
  function drawGlow(c2, x, y, radius, color, power = 1) {
    if (radius <= 0 || power <= 0) return;
    c2.save();
    c2.globalCompositeOperation = "screen";
    c2.globalAlpha *= Math.min(1, power);
    c2.drawImage(lightStamp(color), x - radius, y - radius, radius * 2, radius * 2);
    c2.restore();
  }

  // src/art-primitives.ts
  var TAU = Math.PI * 2;
  function clamp(value, low = 0, high = 1) {
    return Math.max(low, Math.min(high, value));
  }
  function hash(value) {
    let x = value | 0;
    x = Math.imul(x ^ x >>> 16, 569420461);
    x = Math.imul(x ^ x >>> 15, 1935289751);
    return (x ^ x >>> 15) >>> 0;
  }
  function polygon(ctx, points, fill) {
    if (points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index][0], points[index][1]);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  // src/aura-content.ts
  var AURA_IDS = ["ironroot", "bloodOath", "hawkeye", "thornbound", "elementalResonance", "stillwater", "elementalSpikes"];
  var AURA_RULES = Object.freeze({
    rankPower: 0.03,
    rankReservation: 0.25,
    maximumRank: 20,
    bloodStacks: 5,
    bloodDuration: 3,
    stillDuration: 1.2,
    pulseInterval: 0.6,
    exposureDuration: 3,
    distantRange: 180
  });
  var AURAS = Object.freeze({
    ironroot: { name: "Ironroot", description: "Strengthens armor and reduces physical hit damage.", domain: "Might", color: "#b8c49a", reservation: 35, power: 40, territory: "bastion", points: 20 },
    bloodOath: { name: "Blood Oath", description: "Consecutive melee hits against one enemy build damage. Changing targets resets the oath.", domain: "Might", color: "#df8794", reservation: 45, power: 4, territory: "forge", points: 25 },
    hawkeye: { name: "Hawkeye", description: "Arrows fly faster and farther. Distant arrow hits gain critical chance.", domain: "Cunning", color: "#d9daa1", reservation: 35, power: 20, territory: "hunt", points: 29 },
    thornbound: { name: "Thornbound", description: "Slows nearby enemies while they remain close. Bosses resist the slow.", domain: "Cunning", color: "#a4c997", reservation: 40, power: 20, territory: "veil", points: 30 },
    elementalResonance: { name: "Elemental Resonance", description: "Elemental hits expose enemies to that element. Exposure refreshes without stacking.", domain: "Arcana", color: "#cbb3ed", reservation: 45, power: 10, territory: "crucible", points: 25 },
    stillwater: { name: "Stillwater", description: "Standing still gradually reduces mana costs. Moving releases the focus.", domain: "Arcana", color: "#9ad5da", reservation: 30, power: 12, territory: "wellspring", points: 20 },
    elementalSpikes: { name: "Elemental Spikes", description: "Short-range spikes cycle through fire, frost and lightning, scaling with melee weapon damage.", domain: "Might", color: "#d9b5a4", reservation: 40, power: 30, territory: "forge", points: 30 }
  });
  for (const aura of Object.values(AURAS)) Object.freeze(aura);

  // src/unique-content.ts
  var UNIQUE_RULES = Object.freeze({
    storedCasts: 3,
    emberLifetime: 20,
    shieldSpeed: 380,
    shieldRange: 220,
    wardRadius: 140,
    wardSpellCap: 3,
    novaRange: 420,
    decoyDuration: 2,
    decoyLife: 0.2,
    returnWindow: 2,
    fissureRange: 350,
    fissureSpeed: 310,
    shatterDelay: 0.6,
    shatterRadius: 70,
    borrowedLife: 0.2,
    borrowedDuration: 4,
    drawTime: 0.6,
    drawDamage: 2,
    drawReach: 1.3,
    rainTravel: 240,
    pursuitTime: 0.3,
    pursuitRadius: 28,
    bastionCap: 2,
    bastionWindow: 6,
    harvestWindow: 4,
    conductorWindow: 3
  });
  var UNIQUES = Object.freeze([
    {
      id: "dervish-grasp",
      name: "Dervish\u2019s Grasp",
      kind: "gloves",
      material: "leather",
      skill: "whirlwind",
      power: "Hold Whirlwind to spin at full movement speed.",
      details: "Hold Whirlwind to spin while moving at full speed. Each revolution deals its normal damage and costs its normal mana.",
      affixes: ["attackSpeedPercent", "damagePercent", "areaPercent", "maxHp"]
    },
    {
      id: "returning-verdict",
      name: "Returning Verdict",
      kind: "shield",
      profile: "iron-buckler",
      material: "iron",
      skill: "shieldBash",
      power: "Shield Bash throws your shield outward and back.",
      details: "Shield Bash throws your shield outward and back. Each enemy can be struck and stunned once on each journey.",
      affixes: ["damagePercent", "blockChance", "armor", "areaPercent"]
    },
    {
      id: "homeward-thorn",
      name: "Homeward Thorn",
      kind: "weapon",
      profile: "crescent-recurve",
      material: "ashwood",
      skill: "volley",
      power: "Thorn Volley arrows return to their firing position.",
      details: "Thorn Volley arrows return to their firing position. Each journey has its own hits and piercing allowance.",
      affixes: ["damagePercent", "attackSpeedPercent", "critChance", "critDamage"]
    },
    {
      id: "cinderheart-testament",
      name: "Cinderheart Testament",
      kind: "grimoire",
      profile: "ember-codex",
      material: "leather",
      skill: "fireball",
      power: "Store up to 3 Fireballs for 20s. Your next basic attack releases them.",
      details: "Fireball stores up to 3 paid casts for 20 seconds. Each cast keeps its own expiry. Your next basic attack releases every stored fireball toward your aim.",
      affixes: ["spellDamagePercent", "intelligence", "maxHp", "spellweavePercent"]
    },
    {
      id: "winters-reach",
      name: "Winter\u2019s Reach",
      kind: "orb",
      profile: "rime-orb",
      material: "glass",
      skill: "iceNova",
      power: "Cast Ice Nova at your aim.",
      details: "Ice Nova erupts at your aim, up to 420 reach. Echoing Frost repeats at the same position. Solid terrain blocks targeting.",
      affixes: ["spellDamagePercent", "areaPercent", "castSpeedPercent", "maxHp"]
    },
    {
      id: "broken-seal",
      name: "The Broken Seal",
      kind: "grimoire",
      profile: "astral-grimoire",
      material: "leather",
      skill: "runicWard",
      power: "When damage breaks your ward, it explodes.",
      details: "When enemy damage breaks Runic Ward, release an arcane explosion equal to damage absorbed, capped at 300% weapon spell damage. Expiration does not trigger it.",
      affixes: ["spellDamagePercent", "maxHp", "armor", "intelligence"]
    },
    {
      id: "ashen-double",
      name: "Ashen Double",
      kind: "cloak",
      material: "cloth",
      skill: "smokeVeil",
      power: "Smoke Veil leaves a fragile double for 2s.",
      details: "Smoke Veil leaves a fragile double for 2 seconds. Nearby ordinary enemies may attack it; already committed attacks, elites and bosses are not redirected.",
      affixes: ["dexterity", "maxHp", "armor", "critChance"]
    },
    {
      id: "duelists-return",
      name: "Duelist\u2019s Return",
      kind: "boots",
      material: "leather",
      skill: "lunge",
      power: "After Lunge, reactivate within 2s to return for free.",
      details: "After Lunge, reactivate within 2 seconds to dash back toward your starting position. Returning costs no mana, deals no damage and does not reset the cooldown.",
      affixes: ["moveSpeedPercent", "damagePercent", "maxHp", "armor"]
    },
    {
      id: "gravetide",
      name: "Gravetide",
      kind: "weapon",
      profile: "grave-maul",
      material: "iron",
      skill: "earthshatter",
      power: "Earthshatter sends a traveling fissure.",
      details: "Earthshatter sends a traveling fissure along your aim. It carries the full damage and stun through each enemy once, stopping at solid terrain.",
      affixes: ["damagePercent", "strength", "areaPercent", "critDamage"]
    },
    {
      id: "pale-huntsman",
      name: "Pale Huntsman\u2019s Signet",
      kind: "ring",
      profile: "garnet-band",
      material: "silver",
      skill: "ghostHunt",
      power: "Your spectral archer fires Ghost Hunt\u2019s echoes.",
      details: "Ghost Hunt leaves a spectral archer at your casting position. Your arrow actions trigger its finite echoes toward your aim while you reposition.",
      affixes: ["damagePercent", "dexterity", "critChance", "maxHp"]
    },
    {
      id: "rimeheart-spire",
      name: "Rimeheart Spire",
      kind: "weapon",
      profile: "hoarfrost-wand",
      material: "ashwood",
      skill: "frostLance",
      power: "Frost Lance shatters after 0.6s.",
      details: "Frost Lances lodge at their final contact and shatter after 0.6 seconds, dealing their full damage and slow in a small area. Piercing hits remain intact.",
      affixes: ["spellDamagePercent", "castSpeedPercent", "intelligence", "areaPercent"]
    },
    {
      id: "borrowed-life",
      name: "Vessel of Borrowed Life",
      kind: "amulet",
      profile: "warden-amulet",
      material: "silver",
      skill: "siphon",
      power: "Unused Siphon healing becomes a barrier for 4s.",
      details: "Unused Soul Siphon healing becomes a barrier for 4 seconds, up to 20% maximum life. It shares capacity with Runic Ward and cannot trigger The Broken Seal.",
      affixes: ["maxHp", "spellDamagePercent", "intelligence", "armor"]
    },
    {
      id: "heartwood-draw",
      name: "Heartwood Draw",
      kind: "weapon",
      profile: "warden-longbow",
      material: "ashwood",
      skill: "piercingShot",
      power: "Hold Piercing Shot for 0.6s: double damage and 30% more reach.",
      details: "Hold Piercing Shot to charge its damage and reach. After 0.6 seconds it deals double damage with 30% more reach. Release to fire; quick releases retain normal damage and mana cost.",
      affixes: ["damagePercent", "critDamage", "manaCostPercent", "strength"]
    },
    {
      id: "briarfall-mantle",
      name: "Briarfall Mantle",
      kind: "cloak",
      material: "cloth",
      skill: "rainOfArrows",
      power: "Rain of Arrows advances along your aim.",
      details: "Rain of Arrows advances 240 units from its target along your firing direction, carrying its normal waves and damage. Solid terrain stops the curtain.",
      affixes: ["damagePercent", "areaPercent", "manaRegen", "maxHp"]
    },
    {
      id: "thread-of-pursuit",
      name: "Thread of Pursuit",
      kind: "amulet",
      profile: "hawk-talisman",
      material: "silver",
      skill: "ricochet",
      power: "Unused Ricochet rebounds can strike previous targets again.",
      details: "When no fresh target remains, Ricochet spends its remaining rebounds looping back into previously struck enemies. Each loop takes 0.3 seconds; repeated contacts cannot restore life.",
      affixes: ["damagePercent", "critChance", "manaCostPercent", "maxMana"]
    },
    {
      id: "patient-bastion",
      name: "The Patient Bastion",
      kind: "shield",
      profile: "bastion-tower",
      material: "iron",
      skill: "bulwark",
      power: "Move freely during Bulwark. Blocked damage empowers your next basic melee attack.",
      details: "Move at full speed while raising Bulwark. Its blocked damage charges your next basic melee attack for 6 seconds, adding up to 200% of its weapon damage. The charge is consumed once per attack.",
      affixes: ["armor", "blockChance", "damagePercent", "maxHp"]
    },
    {
      id: "red-harvest",
      name: "Red Harvest",
      kind: "weapon",
      profile: "rondel-dagger",
      material: "steel",
      skill: "backstab",
      power: "Rear Backstab marks the target for 4s. Your next Backstab counts as a rear strike.",
      details: "A rear Backstab marks its victim for 4 seconds. Your next Backstab against that enemy counts as a rear strike from any direction and consumes the mark. That follow-up cannot renew it.",
      affixes: ["damagePercent", "critDamage", "attackSpeedPercent", "lifeOnHit"]
    },
    {
      id: "stormglass-reliquary",
      name: "Stormglass Reliquary",
      kind: "orb",
      profile: "astral-orb",
      material: "glass",
      skill: "arcLightning",
      power: "Arc Lightning starts at a conductor placed at your aim.",
      details: "Arc Lightning starts from a conductor placed at your aim within weapon reach and line of sight. Each cast moves the conductor; it lasts 3 seconds and never attacks on its own.",
      affixes: ["spellDamagePercent", "castSpeedPercent", "manaRegen", "maxHp"]
    }
  ].map((def) => Object.freeze({ ...def, affixes: Object.freeze(def.affixes) })));

  // src/item-materials.ts
  var material = (name, surface, base, shadow, edge, trim, value = 1) => Object.freeze({ name, surface, base, shadow, edge, trim, value });
  var ITEM_MATERIALS = Object.freeze({
    leather: material("Leather", "leather", "#78604e", "#322a29", "#b49a75", "#b3986b"),
    iron: material("Iron", "iron", "#7b8388", "#343e48", "#bcc5ca", "#9d896a"),
    steel: material("Steel", "steel", "#8a9cab", "#354957", "#e0ebf0", "#a3aeb4", 1.15),
    silver: material("Silver", "silver", "#bdcbd5", "#596b82", "#f5fcff", "#899fb8", 2),
    gold: material("Gold", "gold", "#d6ac52", "#735020", "#ffedb1", "#a87435", 3.5),
    crystal: material("Crystal", "gem", "#87cfd8", "#305a78", "#e8ffff", "#a0a6db", 6),
    ashwood: material("Ashwood", "wood", "#93734c", "#463525", "#cbb78d", "#a08b65"),
    runewood: material("Runewood", "wood", "#556d62", "#293c38", "#a1c7ab", "#b1a5ce", 1.2),
    glass: material("Glass", "glass", "#77979f", "#304752", "#d0e7eb", "#879da9"),
    quartz: material("Quartz", "gem", "#b7abd0", "#655477", "#f2eaff", "#b5acc5", 1.2),
    astralite: material("Astralite", "gem", "#7492cf", "#333b77", "#dce8ff", "#bda5e9", 3),
    silk: material("Silk", "silk", "#8b86ad", "#41405c", "#d7d0e9", "#b8a17b", 1.75),
    velvet: material("Velvet", "velvet", "#825267", "#382436", "#c699a9", "#b79872", 2.5),
    starweave: material("Starweave", "starweave", "#577eaf", "#293852", "#c1d9fa", "#bbc8e7", 4),
    cloth: material("Linen", "cloth", "#596257", "#29352f", "#97a490", "#a08d64")
  });
  var pool = (...entries) => Object.freeze(entries.map(([id, weight, baseScale]) => Object.freeze({ id, weight, baseScale })));
  var MATERIAL_POOLS = Object.freeze({
    melee: pool(["iron", 58, 1], ["steel", 36, 1.1], ["silver", 4.5, 1.25], ["gold", 1.2, 1.4], ["crystal", 0.3, 1.55]),
    armor: pool(["cloth", 21, 0.7], ["silk", 6, 0.9], ["velvet", 2.5, 1.05], ["starweave", 0.5, 1.3], ["leather", 35, 1], ["iron", 19, 1.1], ["steel", 12, 1.2], ["silver", 3.2, 1.4], ["gold", 0.8, 1.6]),
    metal: pool(["iron", 60, 1], ["steel", 35, 1.1], ["silver", 4, 1.25], ["gold", 1, 1.4]),
    caster: pool(["ashwood", 70, 1], ["runewood", 24, 1.1], ["silver", 4, 1.25], ["gold", 1.5, 1.4], ["crystal", 0.5, 1.55]),
    bow: pool(["ashwood", 80, 1], ["runewood", 19, 1.1], ["crystal", 1, 1.35]),
    book: pool(["leather", 70, 1], ["runewood", 24, 1.1], ["silver", 4, 1.2], ["gold", 1.5, 1.3], ["crystal", 0.5, 1.4]),
    orb: pool(["glass", 65, 1], ["quartz", 29, 1.1], ["astralite", 5, 1.25], ["crystal", 1, 1.4]),
    cloth: pool(["cloth", 100, 1])
  });

  // src/wow-skills-warrior.ts
  var W = "#C79C6E";
  var WARRIOR_SKILLS = Object.freeze([
    {
      id: "heroicStrike",
      name: "Heroic Strike",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 1.5,
      color: W,
      targetMode: "enemy",
      description: "A strong instant strike against your target.",
      execution: { kind: "strike" }
    },
    {
      id: "charge",
      name: "Charge",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 15,
      damageMultiplier: 0.6,
      color: W,
      targetMode: "enemy",
      range: 350,
      description: "Rush your target, stunning it for 1 second and generating 10 rage.",
      execution: { kind: "dash", duration: 0.3, speed: 900, radius: 24, stun: 1, toTarget: true, resourceGain: 10 }
    },
    {
      id: "thunderClap",
      name: "Thunder Clap",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 20,
      cooldown: 4,
      damageMultiplier: 1.1,
      color: W,
      description: "Slam the ground, damaging and slowing nearby enemies.",
      execution: { kind: "radial", radius: 110, melee: true, slow: { duration: 4, factor: 0.7 } }
    },
    {
      id: "hamstring",
      name: "Hamstring",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 10,
      cooldown: 0,
      damageMultiplier: 0.7,
      color: W,
      targetMode: "enemy",
      description: "Maim your target, slowing it by 40% for 5 seconds.",
      execution: { kind: "strike", slow: { duration: 5, factor: 0.6 } }
    },
    {
      id: "overpower",
      name: "Overpower",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 5,
      cooldown: 5,
      damageMultiplier: 1.6,
      color: W,
      targetMode: "enemy",
      description: "A precise strike that cannot be avoided.",
      execution: { kind: "strike" }
    },
    {
      id: "execute",
      name: "Execute",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 2.8,
      color: W,
      targetMode: "enemy",
      executeThreshold: 0.2,
      description: "Finish a wounded enemy. Only usable below 20% health.",
      execution: { kind: "strike" }
    },
    {
      id: "pummel",
      name: "Pummel",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 10,
      cooldown: 10,
      damageMultiplier: 0.4,
      color: W,
      targetMode: "enemy",
      description: "Interrupt your target's attack, silencing it for 4 seconds.",
      execution: { kind: "interrupt", silence: 4 }
    },
    {
      id: "sunderArmor",
      name: "Sunder Armor",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0.5,
      color: W,
      targetMode: "enemy",
      description: "Crack your target's armor, increasing its damage taken by 10% for 15 seconds.",
      execution: { kind: "strike", sunder: 0.1 }
    },
    {
      id: "battleShout",
      name: "Battle Shout",
      classId: "warrior",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 10,
      cooldown: 0,
      damageMultiplier: 0,
      color: W,
      targetMode: "self",
      offGcd: true,
      description: "A war cry that increases your damage by 10% for 60 seconds.",
      execution: { kind: "buff", buff: { duration: 60, stats: { damagePercent: 10, spellDamagePercent: 10 } } }
    },
    {
      id: "berserkerRage",
      name: "Berserker Rage",
      classId: "warrior",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 30,
      damageMultiplier: 0,
      color: W,
      targetMode: "self",
      offGcd: true,
      description: "Enter a rage: immune to fear and generate 5 rage per second for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, resourcePerSecond: 5, breakControl: true } }
    },
    {
      id: "shieldSlam",
      name: "Shield Slam",
      classId: "warrior",
      requirement: "shield",
      domain: "Might",
      tier: "advanced",
      manaCost: 20,
      cooldown: 6,
      damageMultiplier: 1.9,
      color: W,
      targetMode: "enemy",
      description: "Slam your target with your shield.",
      execution: { kind: "strike" }
    },
    {
      id: "shieldBlock",
      name: "Shield Block",
      classId: "warrior",
      requirement: "shield",
      domain: "Might",
      tier: "advanced",
      manaCost: 10,
      cooldown: 10,
      damageMultiplier: 0,
      color: W,
      targetMode: "self",
      offGcd: true,
      description: "Raise your shield, blocking all incoming hits for 3 seconds.",
      execution: { kind: "guard", duration: 3, reduction: 0.75 }
    },
    {
      id: "revenge",
      name: "Revenge",
      classId: "warrior",
      requirement: "shield",
      domain: "Might",
      tier: "basic",
      manaCost: 5,
      cooldown: 5,
      damageMultiplier: 1.4,
      color: W,
      targetMode: "enemy",
      description: "Counterstrike your target with shield and blade.",
      execution: { kind: "strike" }
    },
    {
      id: "shieldWall",
      name: "Shield Wall",
      classId: "warrior",
      requirement: "shield",
      domain: "Might",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: W,
      targetMode: "self",
      offGcd: true,
      description: "Reduce all damage taken by 60% for 8 seconds.",
      execution: { kind: "buff", buff: { duration: 8, reduction: 0.6 } }
    },
    {
      id: "mortalStrike",
      name: "Mortal Strike",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 25,
      cooldown: 6,
      damageMultiplier: 2,
      color: W,
      targetMode: "enemy",
      description: "A vicious strike that leaves a bleeding wound.",
      execution: { kind: "strike", dot: { school: "bleed", dpsMultiplier: 0.15, duration: 6 } }
    },
    {
      id: "bloodthirst",
      name: "Bloodthirst",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 20,
      cooldown: 4,
      damageMultiplier: 1.7,
      color: W,
      targetMode: "enemy",
      description: "A savage strike that restores health equal to 30% of the damage dealt.",
      execution: { kind: "strike", healFrac: 0.3 }
    },
    {
      id: "bladestorm",
      name: "Bladestorm",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "ultimate",
      manaCost: 30,
      cooldown: 60,
      damageMultiplier: 1.2,
      color: W,
      channel: { duration: 4, ticks: 6 },
      description: "Become a whirling storm of steel, striking all nearby enemies for 4 seconds.",
      execution: { kind: "channel", school: "physical", ticks: 6, duration: 4, radius: 120 }
    },
    {
      id: "heroicLeap",
      name: "Heroic Leap",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 30,
      damageMultiplier: 1,
      color: W,
      targetMode: "point",
      range: 420,
      description: "Leap to your aim, damaging enemies where you land.",
      execution: { kind: "dash", duration: 0.35, speed: 800, radius: 60, stun: 0.5 }
    },
    {
      id: "intimidatingShout",
      name: "Intimidating Shout",
      classId: "warrior",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 15,
      cooldown: 90,
      damageMultiplier: 0,
      color: W,
      description: "A terrifying roar that fears nearby enemies for 4 seconds.",
      execution: { kind: "cc", cc: "fear", duration: 4, radius: 120, maxTargets: 5 }
    },
    {
      id: "sweepingStrikes",
      name: "Sweeping Strikes",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 20,
      cooldown: 30,
      damageMultiplier: 0,
      color: W,
      targetMode: "self",
      offGcd: true,
      description: "Your strikes hit with greater force for 12 seconds (+10% damage).",
      execution: { kind: "buff", buff: { duration: 12, stats: { damagePercent: 10 } } }
    },
    {
      id: "slam",
      name: "Slam",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 1.5,
      color: W,
      targetMode: "enemy",
      castTime: 1.5,
      description: "A wind-up strike that deals heavy weapon damage.",
      execution: { kind: "strike" }
    },
    {
      id: "rend",
      name: "Rend",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 10,
      cooldown: 0,
      damageMultiplier: 1,
      color: W,
      targetMode: "enemy",
      description: "Open a bleeding wound that drains the target for 15 seconds.",
      execution: { kind: "dot", dot: { school: "bleed", dpsMultiplier: 0.25, duration: 15 } }
    },
    {
      id: "victoryRush",
      name: "Victory Rush",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 1.5,
      color: W,
      targetMode: "enemy",
      description: "A triumphant strike that restores health equal to the damage dealt. Best used after a kill.",
      execution: { kind: "strike", healFrac: 1 }
    },
    {
      id: "intercept",
      name: "Intercept",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 10,
      cooldown: 30,
      damageMultiplier: 0.5,
      color: W,
      targetMode: "enemy",
      range: 350,
      description: "Charge an enemy, stunning it for 2 seconds.",
      execution: { kind: "dash", duration: 0.3, speed: 900, radius: 24, stun: 2, toTarget: true }
    },
    {
      id: "intervene",
      name: "Intervene",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 10,
      cooldown: 30,
      damageMultiplier: 0,
      color: W,
      targetMode: "point",
      range: 350,
      description: "Rush to an ally's aid at high speed.",
      execution: { kind: "dash", duration: 0.3, speed: 900, radius: 24 }
    },
    {
      id: "spellReflection",
      name: "Spell Reflection",
      classId: "warrior",
      requirement: "shield",
      domain: "Might",
      tier: "advanced",
      manaCost: 15,
      cooldown: 10,
      damageMultiplier: 0,
      color: W,
      targetMode: "self",
      offGcd: true,
      description: "Raise your shield to reflect the next spell cast at you for 5 seconds.",
      execution: { kind: "buff", buff: { duration: 5, reflect: 1 } }
    },
    {
      id: "disarm",
      name: "Disarm",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 15,
      cooldown: 60,
      damageMultiplier: 0.5,
      color: W,
      targetMode: "enemy",
      description: "Strike your target's weapon away, increasing its damage taken by 15% for 10 seconds.",
      execution: { kind: "strike", sunder: 0.15 }
    },
    {
      id: "demoralizingShout",
      name: "Demoralizing Shout",
      classId: "warrior",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 10,
      cooldown: 0,
      damageMultiplier: 0,
      color: W,
      description: "A demoralizing roar that weakens nearby enemies, increasing their damage taken by 10% for 15 seconds.",
      execution: { kind: "radial", radius: 140, melee: false, sunder: 0.1 }
    },
    {
      id: "piercingHowl",
      name: "Piercing Howl",
      classId: "warrior",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 10,
      cooldown: 0,
      damageMultiplier: 0,
      color: W,
      description: "A piercing howl that slows all nearby enemies by 50% for 6 seconds.",
      execution: { kind: "radial", radius: 140, melee: false, slow: { duration: 6, factor: 0.5 } }
    },
    {
      id: "concussionBlow",
      name: "Concussion Blow",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 15,
      cooldown: 30,
      damageMultiplier: 0.75,
      color: W,
      targetMode: "enemy",
      description: "A brutal blow to the head that stuns the target for 4 seconds.",
      execution: { kind: "strike", stun: 4 }
    },
    {
      id: "shockwave",
      name: "Shockwave",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "ultimate",
      manaCost: 15,
      cooldown: 20,
      damageMultiplier: 0.75,
      color: W,
      description: "Slam the ground, sending a shockwave that damages and stuns enemies before you for 4 seconds.",
      execution: { kind: "cone", radius: 140, arc: Math.PI * 0.7, stun: 4 }
    },
    {
      id: "lastStand",
      name: "Last Stand",
      classId: "warrior",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 180,
      damageMultiplier: 0,
      color: W,
      targetMode: "self",
      offGcd: true,
      description: "Dig deep, increasing your maximum health by 30% for 20 seconds.",
      execution: { kind: "buff", buff: { duration: 20, stats: { maxLifePercent: 30 } } }
    },
    {
      id: "enragedRegeneration",
      name: "Enraged Regeneration",
      classId: "warrior",
      requirement: "any",
      domain: "Might",
      tier: "ultimate",
      manaCost: 15,
      cooldown: 180,
      damageMultiplier: 0,
      color: W,
      targetMode: "self",
      offGcd: true,
      description: "Channel your rage into regeneration, restoring 3% of maximum health per second for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, healPerSecond: 0.03 } }
    },
    {
      id: "commandingShout",
      name: "Commanding Shout",
      classId: "warrior",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 10,
      cooldown: 0,
      damageMultiplier: 0,
      color: W,
      targetMode: "self",
      offGcd: true,
      description: "A commanding war cry that increases your maximum health by 15% for 2 minutes.",
      execution: { kind: "buff", buff: { duration: 120, stats: { maxLifePercent: 15 } } }
    },
    {
      id: "taunt",
      name: "Taunt",
      classId: "warrior",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 10,
      damageMultiplier: 0,
      color: W,
      targetMode: "enemy",
      range: 420,
      description: "Taunt the target, forcing it to attack you for 3 seconds.",
      execution: { kind: "taunt", duration: 3 }
    },
    {
      id: "challengingShout",
      name: "Challenging Shout",
      classId: "warrior",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 5,
      cooldown: 180,
      damageMultiplier: 0.3,
      color: W,
      description: "A challenging roar that provokes all nearby enemies to attack you.",
      execution: { kind: "radial", radius: 140, melee: false }
    },
    {
      id: "heroicThrow",
      name: "Heroic Throw",
      classId: "warrior",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 60,
      damageMultiplier: 1.2,
      color: W,
      targetMode: "enemy",
      range: 420,
      description: "Hurl your weapon at the target, dealing heavy damage.",
      execution: { kind: "projectile", speed: 700, radius: 6, offsets: [0], effects: { style: "arrow" } }
    },
    {
      id: "shatteringThrow",
      name: "Shattering Throw",
      classId: "warrior",
      requirement: "any",
      domain: "Might",
      tier: "ultimate",
      manaCost: 25,
      cooldown: 300,
      damageMultiplier: 1,
      color: W,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Hurl your weapon at the target, shattering its armor and increasing damage taken by 20% for 10 seconds.",
      execution: { kind: "projectile", speed: 700, radius: 6, offsets: [0], effects: { style: "arrow" }, sunder: 0.2 }
    },
    {
      id: "retaliation",
      name: "Retaliation",
      classId: "warrior",
      requirement: "melee",
      domain: "Might",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 300,
      damageMultiplier: 0,
      color: W,
      targetMode: "self",
      offGcd: true,
      description: "Instantly counterattack any enemy that strikes you in melee for 12 seconds.",
      execution: { kind: "buff", buff: { duration: 12, reflect: 1 } }
    }
  ]);

  // src/wow-skills-paladin.ts
  var P = "#F58CBA";
  var PALADIN_SKILLS = Object.freeze([
    {
      id: "crusaderStrike",
      name: "Crusader Strike",
      classId: "paladin",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 30,
      cooldown: 4,
      damageMultiplier: 1.1,
      color: P,
      targetMode: "enemy",
      description: "An instant strike that deals weapon damage plus Holy damage.",
      execution: { kind: "strike", school: "holy" }
    },
    {
      id: "judgement",
      name: "Judgement",
      classId: "paladin",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 25,
      cooldown: 8,
      damageMultiplier: 1,
      color: P,
      targetMode: "enemy",
      range: 140,
      description: "Judge your target with Holy power, increasing its damage taken by 10% for 15 seconds.",
      execution: { kind: "strike", school: "holy", sunder: 0.1 }
    },
    {
      id: "sealOfCommand",
      name: "Seal of Command",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "Fill yourself with Holy power for 30 seconds; your melee swings deal additional Holy damage.",
      execution: { kind: "buff", buff: { duration: 30, exclusiveGroup: "seal", imbue: { element: "holy", fraction: 0.3 } } }
    },
    {
      id: "consecration",
      name: "Consecration",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 35,
      cooldown: 12,
      damageMultiplier: 0.4,
      color: P,
      targetMode: "point",
      description: "Consecrate the ground, dealing Holy damage to enemies in the area for 9 seconds.",
      execution: { kind: "ground", effect: "storm", radius: 110, delay: 0.3, duration: 9, interval: 1, style: "radiant" }
    },
    {
      id: "hammerOfJustice",
      name: "Hammer of Justice",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 60,
      damageMultiplier: 0,
      color: P,
      targetMode: "enemy",
      range: 140,
      description: "Stun your target for 4 seconds.",
      execution: { kind: "cc", cc: "stun", duration: 4 }
    },
    {
      id: "holyLight",
      name: "Holy Light",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      castTime: 2,
      description: "A slow, powerful heal that restores 50% of your maximum health.",
      execution: { kind: "heal", amount: 0.5 }
    },
    {
      id: "flashOfLight",
      name: "Flash of Light",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      castTime: 1,
      description: "A quick, efficient heal that restores 25% of your maximum health.",
      execution: { kind: "heal", amount: 0.25 }
    },
    {
      id: "divineShield",
      name: "Divine Shield",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 20,
      cooldown: 120,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      offGcd: true,
      description: "An impenetrable shield makes you immune to all damage for 6 seconds.",
      execution: { kind: "buff", buff: { duration: 6, immunity: true } }
    },
    {
      id: "divineProtection",
      name: "Divine Protection",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 15,
      cooldown: 30,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      offGcd: true,
      description: "Reduce all damage taken by 50% for 8 seconds.",
      execution: { kind: "buff", buff: { duration: 8, reduction: 0.5 } }
    },
    {
      id: "layOnHands",
      name: "Lay on Hands",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 300,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      offGcd: true,
      description: "A massive surge that restores 100% of your maximum health.",
      execution: { kind: "heal", amount: 1 }
    },
    {
      id: "avengingWrath",
      name: "Avenging Wrath",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 90,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      offGcd: true,
      description: "Unfurl wings of holy power, increasing all damage dealt by 20% for 15 seconds.",
      execution: { kind: "buff", buff: { duration: 15, stats: { damagePercent: 20, spellDamagePercent: 20 } } }
    },
    {
      id: "hammerOfWrath",
      name: "Hammer of Wrath",
      classId: "paladin",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 15,
      cooldown: 6,
      damageMultiplier: 1.8,
      color: P,
      targetMode: "enemy",
      range: 420,
      executeThreshold: 0.2,
      description: "Hurl a holy hammer at a wounded enemy. Only usable below 20% health.",
      execution: { kind: "strike", school: "holy" }
    },
    {
      id: "exorcism",
      name: "Exorcism",
      classId: "paladin",
      requirement: "melee",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 55,
      cooldown: 15,
      damageMultiplier: 1.8,
      color: P,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Banish the wicked with Holy wrath, dealing heavy Holy damage.",
      execution: { kind: "strike", school: "holy" }
    },
    {
      id: "holyShock",
      name: "Holy Shock",
      classId: "paladin",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 55,
      cooldown: 8,
      damageMultiplier: 1.2,
      color: P,
      targetMode: "enemy",
      range: 280,
      description: "Shock your target with Holy energy, restoring health equal to 50% of the damage dealt.",
      execution: { kind: "strike", school: "holy", healFrac: 0.5 }
    },
    {
      id: "repentance",
      name: "Repentance",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 60,
      damageMultiplier: 0,
      color: P,
      targetMode: "enemy",
      range: 280,
      description: "Force your target to repent, incapacitating it for 6 seconds. Any damage breaks the effect.",
      execution: { kind: "cc", cc: "incapacitate", duration: 6 }
    },
    {
      id: "blessingOfKings",
      name: "Blessing of Kings",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "A blessing that increases all of your attributes by 10% for 5 minutes.",
      execution: { kind: "buff", buff: { duration: 300, stats: { strength: 3, dexterity: 3, intelligence: 3, vitality: 3 } } }
    },
    {
      id: "divineStorm",
      name: "Divine Storm",
      classId: "paladin",
      requirement: "melee",
      domain: "Might",
      tier: "ultimate",
      manaCost: 40,
      cooldown: 20,
      damageMultiplier: 1.6,
      color: P,
      description: "A whirling storm of Holy power strikes all nearby enemies.",
      execution: { kind: "radial", radius: 120, melee: true, style: "radiant" }
    },
    {
      id: "holyShield",
      name: "Holy Shield",
      classId: "paladin",
      requirement: "shield",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 15,
      cooldown: 8,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      offGcd: true,
      description: "Raise a holy shield: +30% block chance and reflect 30% of damage taken for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, stats: { blockChance: 30 }, reflect: 0.3 } }
    },
    {
      id: "blessingOfMight",
      name: "Blessing of Might",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "A blessing that increases attack power, raising damage dealt by 15% for 5 minutes.",
      execution: { kind: "buff", buff: { duration: 300, exclusiveGroup: "blessing", stats: { damagePercent: 15 } } }
    },
    {
      id: "blessingOfWisdom",
      name: "Blessing of Wisdom",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "A blessing that restores mana over time for 5 minutes.",
      execution: { kind: "buff", buff: { duration: 300, exclusiveGroup: "blessing", manaPerSecond: 0.01 } }
    },
    {
      id: "blessingOfSanctuary",
      name: "Blessing of Sanctuary",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "A blessing that reduces damage taken by 3% and bolsters strength and stamina for 5 minutes.",
      execution: { kind: "buff", buff: { duration: 300, exclusiveGroup: "blessing", reduction: 0.03, stats: { strength: 3, vitality: 3 } } }
    },
    {
      id: "handOfFreedom",
      name: "Hand of Freedom",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 25,
      cooldown: 25,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      offGcd: true,
      description: "Break free of movement-impairing effects and become immune to them for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, breakControl: true } }
    },
    {
      id: "handOfProtection",
      name: "Hand of Protection",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 25,
      cooldown: 90,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      offGcd: true,
      description: "A protective hand that prevents all damage for 6 seconds.",
      execution: { kind: "buff", buff: { duration: 6, reduction: 1 } }
    },
    {
      id: "handOfSacrifice",
      name: "Hand of Sacrifice",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 25,
      cooldown: 60,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      offGcd: true,
      description: "Sacrifice yourself to shield an ally, reducing damage taken by 30% for 12 seconds.",
      execution: { kind: "buff", buff: { duration: 12, reduction: 0.3 } }
    },
    {
      id: "handOfSalvation",
      name: "Hand of Salvation",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 25,
      cooldown: 60,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      offGcd: true,
      description: "Fade from enemy sight, shedding threat for 8 seconds.",
      execution: { kind: "buff", buff: { duration: 8, stealth: true } }
    },
    {
      id: "divineSacrifice",
      name: "Divine Sacrifice",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 30,
      cooldown: 120,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      offGcd: true,
      description: "Redirect harm to yourself, reducing all damage taken by 30% for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, reduction: 0.3 } }
    },
    {
      id: "divinePlea",
      name: "Divine Plea",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 0,
      cooldown: 60,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      offGcd: true,
      description: "Plead for divine favor, restoring 25% of your mana over 15 seconds.",
      execution: { kind: "buff", buff: { duration: 15, manaPerSecond: 0.017 } }
    },
    {
      id: "shieldOfRighteousness",
      name: "Shield of Righteousness",
      classId: "paladin",
      requirement: "shield",
      domain: "Might",
      tier: "advanced",
      manaCost: 30,
      cooldown: 6,
      damageMultiplier: 1.6,
      color: P,
      targetMode: "enemy",
      description: "Slam the target with your shield, dealing Holy damage based on your block value.",
      execution: { kind: "strike", school: "holy" }
    },
    {
      id: "hammerOfTheRighteous",
      name: "Hammer of the Righteous",
      classId: "paladin",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 30,
      cooldown: 6,
      damageMultiplier: 1.2,
      color: P,
      targetMode: "enemy",
      description: "Hammer the current target and nearby enemies with Holy damage.",
      execution: { kind: "sweep", reachMultiplier: 1.3, arc: Math.PI * 1.5 }
    },
    {
      id: "avengersShield",
      name: "Avenger's Shield",
      classId: "paladin",
      requirement: "shield",
      domain: "Might",
      tier: "ultimate",
      manaCost: 35,
      cooldown: 30,
      damageMultiplier: 1.4,
      color: P,
      targetMode: "enemy",
      range: 420,
      description: "Hurl your shield at an enemy; it ricochets to two more targets, dealing Holy damage and slowing them.",
      execution: { kind: "chain", jumps: 3, range: 160, falloff: 0.8, duration: 0.3, style: "radiant", slow: { duration: 4, factor: 0.5 } }
    },
    {
      id: "judgementOfLight",
      name: "Judgement of Light",
      classId: "paladin",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 25,
      cooldown: 8,
      damageMultiplier: 1,
      color: P,
      targetMode: "enemy",
      range: 140,
      description: "Judge your target with Holy power, healing you for 30% of the damage dealt.",
      execution: { kind: "strike", school: "holy", healFrac: 0.3 }
    },
    {
      id: "judgementOfWisdom",
      name: "Judgement of Wisdom",
      classId: "paladin",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 25,
      cooldown: 8,
      damageMultiplier: 1,
      color: P,
      targetMode: "point",
      range: 140,
      description: "Judge your target with Holy power, restoring 25 mana.",
      execution: { kind: "radial", targetRange: 140, radius: 60, melee: false, style: "radiant", resourceGain: 25 }
    },
    {
      id: "judgementOfJustice",
      name: "Judgement of Justice",
      classId: "paladin",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 25,
      cooldown: 8,
      damageMultiplier: 1,
      color: P,
      targetMode: "enemy",
      range: 140,
      description: "Judge your target with Holy power, slowing its movement by 50% for 4 seconds.",
      execution: { kind: "strike", school: "holy", slow: { duration: 4, factor: 0.5 } }
    },
    {
      id: "sealOfVengeance",
      name: "Seal of Vengeance",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "Fill yourself with Holy power for 30 seconds; your melee swings apply stacking Holy damage.",
      execution: { kind: "buff", buff: { duration: 30, exclusiveGroup: "seal", imbue: { element: "holy", fraction: 0.15 } } }
    },
    {
      id: "sealOfRighteousness",
      name: "Seal of Righteousness",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "Fill yourself with Holy power for 30 seconds; your melee swings deal additional Holy damage.",
      execution: { kind: "buff", buff: { duration: 30, exclusiveGroup: "seal", imbue: { element: "holy", fraction: 0.25 } } }
    },
    {
      id: "sealOfCorruption",
      name: "Seal of Corruption",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "Fill yourself with vengeful power for 30 seconds; your melee swings apply stacking Holy damage.",
      execution: { kind: "buff", buff: { duration: 30, exclusiveGroup: "seal", imbue: { element: "holy", fraction: 0.15 } } }
    },
    {
      id: "sealOfWisdom",
      name: "Seal of Wisdom",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "Fill yourself with Holy power for 30 seconds; your melee swings restore mana.",
      execution: { kind: "buff", buff: { duration: 30, exclusiveGroup: "seal", manaPerSecond: 0.01 } }
    },
    {
      id: "sealOfLight",
      name: "Seal of Light",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "Fill yourself with Holy power for 30 seconds; your melee swings restore health.",
      execution: { kind: "buff", buff: { duration: 30, exclusiveGroup: "seal", healPerSecond: 0.01 } }
    },
    {
      id: "righteousFury",
      name: "Righteous Fury",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      offGcd: true,
      description: "Channel righteous fury, increasing your threat and damage dealt by 10%.",
      execution: { kind: "buff", buff: { duration: 300, stats: { damagePercent: 10 } } }
    },
    {
      id: "divineIllumination",
      name: "Divine Illumination",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      offGcd: true,
      description: "Divine clarity reduces the mana cost of your spells by 50% for 15 seconds.",
      execution: { kind: "buff", buff: { duration: 15, stats: { manaCostPercent: -50 } } }
    },
    {
      id: "beaconOfLight",
      name: "Beacon of Light",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "Become a beacon of healing, regenerating health over 60 seconds.",
      execution: { kind: "buff", buff: { duration: 60, healPerSecond: 0.03 } }
    },
    {
      id: "holyWrath",
      name: "Holy Wrath",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 45,
      cooldown: 30,
      damageMultiplier: 1.2,
      color: P,
      targetMode: "point",
      description: "Unleash a burst of Holy energy, damaging and stunning all nearby enemies for 2 seconds.",
      execution: { kind: "radial", radius: 130, melee: false, stun: 2, style: "radiant" }
    },
    {
      id: "turnEvil",
      name: "Turn Evil",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "enemy",
      range: 280,
      castTime: 1.5,
      description: "Fill an undead or demon target with holy fear, forcing it to flee for 10 seconds.",
      execution: { kind: "cc", cc: "fear", duration: 10 }
    },
    {
      id: "purify",
      name: "Purify",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "Purify yourself, removing poison and disease effects.",
      execution: { kind: "cleanse", removeCc: true }
    },
    {
      id: "cleanse",
      name: "Cleanse",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "Cleanse yourself of magic, poison, and disease, mending 10% of your health.",
      execution: { kind: "cleanse", removeCc: true, heal: 0.1 }
    },
    {
      id: "redemption",
      name: "Redemption",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      castTime: 10,
      description: "Redeem a fallen ally, returning them to life with 60% of their health.",
      execution: { kind: "heal", amount: 0, maxHpFrac: 0.6 }
    },
    {
      id: "sacredShield",
      name: "Sacred Shield",
      classId: "paladin",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 6,
      damageMultiplier: 0,
      color: P,
      targetMode: "self",
      description: "A sacred barrier absorbs damage equal to 25% of your health for 30 seconds.",
      execution: { kind: "buff", buff: { duration: 30, absorb: 0.25 } }
    }
  ]);

  // src/wow-skills-hunter.ts
  var H = "#ABD473";
  var HUNTER_SKILLS = Object.freeze([
    {
      id: "arcaneShot",
      name: "Arcane Shot",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "basic",
      manaCost: 25,
      cooldown: 6,
      damageMultiplier: 1.3,
      color: H,
      targetMode: "enemy",
      range: 490,
      description: "An instant shot that deals arcane damage to your target.",
      execution: { kind: "strike", school: "arcane" }
    },
    {
      id: "aimedShot",
      name: "Aimed Shot",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 30,
      cooldown: 8,
      damageMultiplier: 2.5,
      color: H,
      targetMode: "enemy",
      range: 490,
      castTime: 2,
      description: "Take careful aim and fire a devastating shot after a 2 second cast.",
      execution: { kind: "strike" }
    },
    {
      id: "multiShot",
      name: "Multi-Shot",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "basic",
      manaCost: 40,
      cooldown: 6,
      damageMultiplier: 0.9,
      color: H,
      targetMode: "enemy",
      range: 490,
      description: "Fire a volley of three arrows in a spreading fan.",
      execution: { kind: "projectile", speed: 620, radius: 4, offsets: [-0.22, 0, 0.22], effects: { style: "arrow" } }
    },
    {
      id: "serpentSting",
      name: "Serpent Sting",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0.4,
      color: H,
      targetMode: "enemy",
      range: 490,
      description: "Sting your target with venom, dealing nature damage over 15 seconds.",
      execution: { kind: "dot", dot: { school: "nature", dpsMultiplier: 0.25, duration: 15 } }
    },
    {
      id: "concussiveShot",
      name: "Concussive Shot",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "basic",
      manaCost: 20,
      cooldown: 12,
      damageMultiplier: 0.5,
      color: H,
      targetMode: "enemy",
      range: 490,
      description: "Daze your target, slowing it by 50% for 4 seconds.",
      execution: { kind: "strike", slow: { duration: 4, factor: 0.5 } }
    },
    {
      id: "scatterShot",
      name: "Scatter Shot",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 25,
      cooldown: 30,
      damageMultiplier: 0.5,
      color: H,
      targetMode: "enemy",
      range: 280,
      description: "A short-range blast that incapacitates your target for 3 seconds. Any damage breaks the effect.",
      execution: { kind: "strike", stun: 3 }
    },
    {
      id: "freezingTrap",
      name: "Freezing Trap",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 20,
      cooldown: 30,
      damageMultiplier: 0,
      color: H,
      targetMode: "point",
      range: 350,
      description: "Place a frost trap that freezes the first enemy to touch it for 6 seconds.",
      execution: { kind: "cc", cc: "freeze", duration: 6, radius: 60, maxTargets: 1 }
    },
    {
      id: "disengage",
      name: "Disengage",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 15,
      cooldown: 25,
      damageMultiplier: 0,
      color: H,
      description: "Leap backward, escaping melee range.",
      execution: { kind: "step", duration: 0.25, speed: 520, retreat: true }
    },
    {
      id: "aspectHawk",
      name: "Aspect of the Hawk",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: H,
      targetMode: "self",
      offGcd: true,
      description: "Take on the aspect of a hawk, increasing your ranged damage by 15%. Only one aspect can be active.",
      execution: { kind: "buff", buff: { duration: 3600, exclusiveGroup: "aspect", stats: { damagePercent: 15 } } }
    },
    {
      id: "feignDeath",
      name: "Feign Death",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 0,
      cooldown: 30,
      damageMultiplier: 0,
      color: H,
      targetMode: "self",
      offGcd: true,
      description: "Play dead, dropping all enemy aggro for 4 seconds.",
      execution: { kind: "stealth", duration: 4, dropAggro: true }
    },
    {
      id: "callPet",
      name: "Call Pet",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 35,
      cooldown: 10,
      damageMultiplier: 0,
      color: H,
      targetMode: "self",
      offGcd: true,
      description: "Call your loyal wolf companion to fight at your side.",
      execution: { kind: "summon", ally: "wolf", count: 1 }
    },
    {
      id: "killCommand",
      name: "Kill Command",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 20,
      cooldown: 45,
      damageMultiplier: 0,
      color: H,
      targetMode: "self",
      offGcd: true,
      description: "Command your pet to strike with fury: your pet deals 50% more damage and you deal 25% more damage for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, stats: { damagePercent: 25 }, allyDamage: 0.5 } }
    },
    {
      id: "bestialWrath",
      name: "Bestial Wrath",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 10,
      cooldown: 90,
      damageMultiplier: 0,
      color: H,
      targetMode: "self",
      offGcd: true,
      description: "Send your pet into a rage: your pet deals 50% more damage and you deal 30% more damage for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, stats: { damagePercent: 30 }, allyDamage: 0.5 } }
    },
    {
      id: "huntersVolley",
      name: "Hunter's Volley",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 40,
      cooldown: 30,
      damageMultiplier: 0.6,
      color: H,
      channel: { duration: 4, ticks: 8 },
      description: "Channel a rain of arrows over the target area for 4 seconds.",
      execution: { kind: "channel", school: "physical", ticks: 8, duration: 4, radius: 140 }
    },
    {
      id: "explosiveShot",
      name: "Explosive Shot",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 30,
      cooldown: 6,
      damageMultiplier: 1.4,
      color: H,
      targetMode: "enemy",
      range: 490,
      description: "Fire an explosive charge that detonates on impact, burning nearby enemies.",
      execution: { kind: "projectile", speed: 560, radius: 5, offsets: [0], effects: { style: "fire", blastRadius: 70 } }
    },
    {
      id: "steadyShot",
      name: "Steady Shot",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 1.1,
      color: H,
      targetMode: "enemy",
      range: 490,
      castTime: 1.5,
      description: "A steady shot that builds pressure between cooldowns.",
      execution: { kind: "strike" }
    },
    {
      id: "killShot",
      name: "Kill Shot",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 25,
      cooldown: 15,
      damageMultiplier: 2.4,
      color: H,
      targetMode: "enemy",
      range: 490,
      executeThreshold: 0.2,
      description: "Finish a wounded enemy. Only usable below 20% health.",
      execution: { kind: "strike" }
    },
    {
      id: "chimeraShot",
      name: "Chimera Shot",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 40,
      cooldown: 10,
      damageMultiplier: 1.6,
      color: H,
      targetMode: "enemy",
      range: 490,
      description: "A shot that consumes your Serpent Sting, instantly dealing 40% of its remaining nature damage.",
      execution: { kind: "strike", consumeDot: { school: "nature", multiplier: 0.4 } }
    },
    {
      id: "raptorStrike",
      name: "Raptor Strike",
      classId: "hunter",
      requirement: "melee",
      domain: "Cunning",
      tier: "basic",
      manaCost: 15,
      cooldown: 6,
      damageMultiplier: 1.5,
      color: H,
      targetMode: "enemy",
      range: 70,
      description: "A vicious melee strike that deals heavy damage to your target.",
      execution: { kind: "strike" }
    },
    {
      id: "mongooseBite",
      name: "Mongoose Bite",
      classId: "hunter",
      requirement: "melee",
      domain: "Cunning",
      tier: "basic",
      manaCost: 10,
      cooldown: 5,
      damageMultiplier: 1.4,
      color: H,
      targetMode: "enemy",
      range: 70,
      description: "Counterattack your enemy with a savage bite, dealing damage.",
      execution: { kind: "strike" }
    },
    {
      id: "wingClip",
      name: "Wing Clip",
      classId: "hunter",
      requirement: "melee",
      domain: "Cunning",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0.5,
      color: H,
      targetMode: "enemy",
      range: 70,
      description: "Maim your target, slowing its movement speed by 50% for 10 seconds.",
      execution: { kind: "strike", slow: { duration: 10, factor: 0.5 } }
    },
    {
      id: "frostTrap",
      name: "Frost Trap",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 20,
      cooldown: 30,
      damageMultiplier: 0,
      color: H,
      targetMode: "point",
      range: 350,
      description: "Place a frost trap that creates an icy slick, slowing all enemies within it by 50%.",
      execution: { kind: "ground", effect: "frost", radius: 120, delay: 1, duration: 30, interval: 1, style: "frost", slow: { duration: 3, factor: 0.5 } }
    },
    {
      id: "immolationTrap",
      name: "Immolation Trap",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 25,
      cooldown: 30,
      damageMultiplier: 0.8,
      color: H,
      targetMode: "point",
      range: 350,
      description: "Place a fire trap that burns the first enemy to approach, dealing fire damage over 15 seconds.",
      execution: { kind: "ground", effect: "meteor", radius: 80, delay: 1, duration: 0, interval: 1, style: "fire", burn: { duration: 15, damageMultiplier: 0.15 } }
    },
    {
      id: "explosiveTrap",
      name: "Explosive Trap",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 30,
      cooldown: 30,
      damageMultiplier: 1.2,
      color: H,
      targetMode: "point",
      range: 350,
      description: "Place a fire trap that explodes when an enemy approaches, burning all nearby enemies.",
      execution: { kind: "ground", effect: "meteor", radius: 110, delay: 1, duration: 0, interval: 1, style: "fire", burn: { duration: 8, damageMultiplier: 0.2 } }
    },
    {
      id: "deterrence",
      name: "Deterrence",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 10,
      cooldown: 90,
      damageMultiplier: 0,
      color: H,
      targetMode: "self",
      offGcd: true,
      description: "Deflect attacks and spells, reducing damage taken by 90% for 5 seconds.",
      execution: { kind: "buff", buff: { duration: 5, reduction: 0.9 } }
    },
    {
      id: "misdirection",
      name: "Misdirection",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 20,
      cooldown: 30,
      damageMultiplier: 0,
      color: H,
      targetMode: "self",
      offGcd: true,
      description: "Redirect the threat you generate to your pet for 30 seconds.",
      execution: { kind: "buff", buff: { duration: 30, petShare: 0.5 } }
    },
    {
      id: "tranquilizingShot",
      name: "Tranquilizing Shot",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 20,
      cooldown: 8,
      damageMultiplier: 0.3,
      color: H,
      targetMode: "enemy",
      range: 490,
      description: "A soothing shot that attempts to dispel an enrage or magic effect from your target.",
      execution: { kind: "projectile", speed: 640, radius: 4, offsets: [0], effects: { style: "spirit" } }
    },
    {
      id: "viperSting",
      name: "Viper Sting",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "basic",
      manaCost: 15,
      cooldown: 15,
      damageMultiplier: 0.4,
      color: H,
      targetMode: "enemy",
      range: 490,
      description: "Sting your target, draining its vitality as nature damage over 8 seconds.",
      execution: { kind: "projectile", speed: 600, radius: 4, offsets: [0], effects: { style: "nature" }, dot: { school: "nature", dpsMultiplier: 0.2, duration: 8 } }
    },
    {
      id: "scorpidSting",
      name: "Scorpid Sting",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0.3,
      color: H,
      targetMode: "enemy",
      range: 490,
      description: "Sting your target with scorpid venom, dealing nature damage over 20 seconds.",
      execution: { kind: "projectile", speed: 600, radius: 4, offsets: [0], effects: { style: "nature" }, dot: { school: "nature", dpsMultiplier: 0.15, duration: 20 } }
    },
    {
      id: "mendPet",
      name: "Mend Pet",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0,
      color: H,
      targetMode: "self",
      description: "Mend your pet's wounds, healing it over 15 seconds.",
      execution: { kind: "heal", amount: 25, hot: { flatTick: 25, duration: 15, interval: 3 }, pet: "mend" }
    },
    {
      id: "revivePet",
      name: "Revive Pet",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 80,
      cooldown: 0,
      damageMultiplier: 0,
      color: H,
      targetMode: "self",
      castTime: 6,
      description: "Revive your fallen pet, returning it to life with full health.",
      execution: { kind: "heal", amount: 0, maxHpFrac: 1, pet: "revive" }
    },
    {
      id: "tameBeast",
      name: "Tame Beast",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 40,
      cooldown: 0,
      damageMultiplier: 0,
      color: H,
      targetMode: "enemy",
      range: 300,
      castTime: 20,
      description: "Channel a bond with a wild beast for 20 seconds, taming it into your companion.",
      execution: { kind: "tame" }
    },
    {
      id: "intimidation",
      name: "Intimidation",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 15,
      cooldown: 60,
      damageMultiplier: 0,
      color: H,
      targetMode: "enemy",
      range: 490,
      description: "Command your pet to intimidate the target, stunning it for 3 seconds.",
      execution: { kind: "cc", cc: "stun", duration: 3 }
    },
    {
      id: "wyvernSting",
      name: "Wyvern Sting",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 30,
      cooldown: 60,
      damageMultiplier: 0.3,
      color: H,
      targetMode: "enemy",
      range: 490,
      description: "A stinging shot that puts your target to sleep for 6 seconds, then afflicts it with nature damage.",
      execution: { kind: "projectile", speed: 560, radius: 5, offsets: [0], effects: { style: "nature" }, cc: { kind: "incapacitate", duration: 6 }, dot: { school: "nature", dpsMultiplier: 0.2, duration: 6 } }
    },
    {
      id: "blackArrow",
      name: "Black Arrow",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 25,
      cooldown: 30,
      damageMultiplier: 0.6,
      color: H,
      targetMode: "enemy",
      range: 490,
      description: "Fire a black arrow that deals shadow damage over 15 seconds and increases your damage against the target.",
      execution: { kind: "projectile", speed: 600, radius: 5, offsets: [0], effects: { style: "shadow" }, dot: { school: "shadow", dpsMultiplier: 0.3, duration: 15 } }
    },
    {
      id: "silencingShot",
      name: "Silencing Shot",
      classId: "hunter",
      requirement: "bow",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 20,
      cooldown: 20,
      damageMultiplier: 0.5,
      color: H,
      targetMode: "enemy",
      range: 490,
      description: "A shot that interrupts spellcasting and silences your target for 3 seconds.",
      execution: { kind: "interrupt", silence: 3 }
    },
    {
      id: "readiness",
      name: "Readiness",
      classId: "hunter",
      requirement: "any",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 180,
      damageMultiplier: 0,
      color: H,
      targetMode: "self",
      offGcd: true,
      description: "Instantly ready your abilities, restoring your focus for 5 seconds.",
      execution: { kind: "buff", buff: { duration: 5, resourcePerSecond: 10 } }
    }
  ]);

  // src/wow-skills-rogue.ts
  var R = "#FFF569";
  var ROGUE_SKILLS = Object.freeze([
    {
      id: "sinisterStrike",
      name: "Sinister Strike",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "basic",
      manaCost: 45,
      cooldown: 0,
      damageMultiplier: 1.2,
      color: R,
      targetMode: "enemy",
      combo: "build",
      description: "An instant strike against your target. Awards 1 combo point.",
      execution: { kind: "comboStrike", build: 1 }
    },
    {
      id: "eviscerate",
      name: "Eviscerate",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "basic",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 1.8,
      color: R,
      targetMode: "enemy",
      combo: "spend",
      description: "Finishing move that deals damage per combo point spent.",
      execution: { kind: "comboStrike", spend: true }
    },
    {
      id: "ambush",
      name: "Ambush",
      classId: "rogue",
      requirement: "dagger",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 2.5,
      color: R,
      targetMode: "enemy",
      combo: "build",
      requiresStealth: true,
      description: "Strike from the shadows for massive damage. Must be stealthed. Awards 2 combo points.",
      execution: { kind: "comboStrike", build: 2, requiresStealth: true }
    },
    {
      id: "garrote",
      name: "Garrote",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 50,
      cooldown: 0,
      damageMultiplier: 0.6,
      color: R,
      targetMode: "enemy",
      combo: "build",
      requiresStealth: true,
      description: "Silence your target's throat, bleeding it for 18 seconds. Must be stealthed. Awards 1 combo point.",
      execution: { kind: "comboStrike", build: 1, requiresStealth: true, dot: { school: "bleed", dpsMultiplier: 0.15, duration: 18 } }
    },
    {
      id: "rupture",
      name: "Rupture",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0.4,
      color: R,
      targetMode: "enemy",
      combo: "spend",
      description: "Finishing move that wounds your target: it bleeds, longer per combo point spent.",
      execution: { kind: "comboStrike", spend: true, dot: { school: "bleed", dpsMultiplier: 0.2, duration: 8 } }
    },
    {
      id: "kidneyShot",
      name: "Kidney Shot",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 25,
      cooldown: 20,
      damageMultiplier: 0.3,
      color: R,
      targetMode: "enemy",
      combo: "spend",
      description: "Finishing move that stuns your target for 1 second per combo point spent.",
      execution: { kind: "comboStrike", spend: true, stunPerCombo: 1 }
    },
    {
      id: "sliceAndDice",
      name: "Slice and Dice",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: R,
      targetMode: "enemy",
      combo: "spend",
      description: "Finishing move that increases your attack speed by 30%, longer per combo point spent.",
      execution: { kind: "comboStrike", spend: true, buffPerCombo: { duration: 4, stats: { attackSpeedPercent: 30 } } }
    },
    {
      id: "stealth",
      name: "Stealth",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 0,
      cooldown: 6,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Melt into the shadows, becoming invisible to enemies beyond 25 units for 10 seconds.",
      execution: { kind: "stealth", duration: 10 }
    },
    {
      id: "vanish",
      name: "Vanish",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 60,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Vanish from sight, dropping all enemy aggro and entering stealth for 10 seconds.",
      execution: { kind: "stealth", duration: 10, dropAggro: true }
    },
    {
      id: "sap",
      name: "Sap",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 65,
      cooldown: 0,
      damageMultiplier: 0,
      color: R,
      targetMode: "enemy",
      requiresStealth: true,
      offGcd: true,
      description: "Incapacitate your target for 6 seconds without breaking stealth. Must be stealthed.",
      execution: { kind: "cc", cc: "incapacitate", duration: 6 }
    },
    {
      id: "gouge",
      name: "Gouge",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "basic",
      manaCost: 45,
      cooldown: 10,
      damageMultiplier: 0.4,
      color: R,
      targetMode: "enemy",
      description: "Strike your target's eyes, incapacitating it for 3 seconds. Any damage breaks the effect.",
      execution: { kind: "cc", cc: "incapacitate", duration: 3 }
    },
    {
      id: "kick",
      name: "Kick",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 15,
      cooldown: 10,
      damageMultiplier: 0.3,
      color: R,
      targetMode: "enemy",
      description: "Interrupt your target's attack, silencing it for 4 seconds.",
      execution: { kind: "interrupt", silence: 4 }
    },
    {
      id: "sprint",
      name: "Sprint",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 0,
      cooldown: 60,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Burst of speed: move 50% faster for 8 seconds.",
      execution: { kind: "buff", buff: { duration: 8, stats: { moveSpeedPercent: 50 } } }
    },
    {
      id: "evasion",
      name: "Evasion",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 0,
      cooldown: 60,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Dodge and weave, reducing all damage taken by 50% for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, reduction: 0.5 } }
    },
    {
      id: "blind",
      name: "Blind",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 30,
      cooldown: 60,
      damageMultiplier: 0,
      color: R,
      targetMode: "enemy",
      range: 140,
      description: "Throw blinding powder, incapacitating your target for 5 seconds. Any damage breaks the effect.",
      execution: { kind: "cc", cc: "incapacitate", duration: 5 }
    },
    {
      id: "fanOfKnives",
      name: "Fan of Knives",
      classId: "rogue",
      requirement: "dagger",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 50,
      cooldown: 6,
      damageMultiplier: 0.8,
      color: R,
      description: "Hurl a fan of knives, striking all nearby enemies.",
      execution: { kind: "radial", radius: 110, melee: true }
    },
    {
      id: "adrenalineRush",
      name: "Adrenaline Rush",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 90,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Your blood runs hot: regenerate 10 energy per second for 15 seconds.",
      execution: { kind: "buff", buff: { duration: 15, resourcePerSecond: 10 } }
    },
    {
      id: "cheapShot",
      name: "Cheap Shot",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 0.5,
      color: R,
      targetMode: "enemy",
      combo: "build",
      requiresStealth: true,
      description: "Strike from stealth, stunning your target for 2 seconds. Awards 2 combo points.",
      execution: { kind: "comboStrike", build: 2, requiresStealth: true, stunPerCombo: 2 }
    },
    {
      id: "hemorrhage",
      name: "Hemorrhage",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "basic",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 0.9,
      color: R,
      targetMode: "enemy",
      combo: "build",
      description: "A vicious strike that cracks your target's armor, increasing its damage taken by 10% for 15 seconds. Awards 1 combo point.",
      execution: { kind: "comboStrike", build: 1, sunder: 0.1 }
    },
    {
      id: "cloakOfShadows",
      name: "Cloak of Shadows",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 60,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Wrap yourself in shadow: break all crowd control and resist 90% of damage for 4 seconds.",
      execution: { kind: "cleanse", removeCc: true, buff: { duration: 4, reduction: 0.9 } }
    },
    {
      id: "mutilate",
      name: "Mutilate",
      classId: "rogue",
      requirement: "dagger",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 1.7,
      color: R,
      targetMode: "enemy",
      combo: "build",
      description: "Attack with both daggers, dealing heavy damage \u2014 increased against poisoned targets. Awards 2 combo points.",
      execution: { kind: "comboStrike", build: 2 }
    },
    {
      id: "envenom",
      name: "Envenom",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 0.5,
      color: R,
      targetMode: "enemy",
      combo: "spend",
      description: "Finishing move that drives poison into your target's veins, dealing nature damage over time per combo point spent.",
      execution: { kind: "comboStrike", spend: true, dot: { school: "nature", dpsMultiplier: 0.25, duration: 6 } }
    },
    {
      id: "deadlyThrow",
      name: "Deadly Throw",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 0.8,
      color: R,
      targetMode: "enemy",
      range: 420,
      combo: "spend",
      description: "Finishing move that hurls a poisoned knife at your target, slowing it by 50% for 6 seconds.",
      execution: { kind: "projectile", speed: 600, radius: 4, offsets: [0], effects: { style: "nature", slowFactor: 0.5, slowDuration: 6 } }
    },
    {
      id: "shiv",
      name: "Shiv",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0.5,
      color: R,
      targetMode: "enemy",
      combo: "build",
      description: "A quick off-hand strike that applies your weapon poison. Awards 1 combo point.",
      execution: { kind: "comboStrike", build: 1 }
    },
    {
      id: "feint",
      name: "Feint",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      description: "Feint and roll with incoming blows, reducing damage taken by 50% for 6 seconds.",
      execution: { kind: "buff", buff: { duration: 6, reduction: 0.5 } }
    },
    {
      id: "distract",
      name: "Distract",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 0,
      cooldown: 30,
      damageMultiplier: 0,
      color: R,
      description: "Toss a distraction that draws nearby enemies' attention, incapacitating them for 4 seconds.",
      execution: { kind: "cc", cc: "incapacitate", duration: 4, radius: 100, maxTargets: 4 }
    },
    {
      id: "dismantle",
      name: "Dismantle",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 25,
      cooldown: 60,
      damageMultiplier: 0,
      color: R,
      targetMode: "enemy",
      description: "Strip your target's weapon, disarming and incapacitating it for 6 seconds.",
      execution: { kind: "cc", cc: "incapacitate", duration: 6 }
    },
    {
      id: "tricksOfTheTrade",
      name: "Tricks of the Trade",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 15,
      cooldown: 30,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Misdirect your enemies, increasing your damage by 15% for 6 seconds.",
      execution: { kind: "buff", buff: { duration: 6, stats: { damagePercent: 15 } } }
    },
    {
      id: "preparation",
      name: "Preparation",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 300,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Gather your focus and refresh your readiness, regenerating 20 energy per second for 3 seconds.",
      execution: { kind: "buff", buff: { duration: 3, resourcePerSecond: 20 } }
    },
    {
      id: "shadowstep",
      name: "Shadowstep",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 10,
      cooldown: 30,
      damageMultiplier: 0,
      color: R,
      targetMode: "enemy",
      range: 350,
      description: "Step through the shadows to your target, increasing your damage by 20% for 10 seconds.",
      execution: { kind: "dash", duration: 0.2, speed: 1200, radius: 24, toTarget: true, buff: { duration: 10, stats: { damagePercent: 20 } } }
    },
    {
      id: "shadowDance",
      name: "Shadow Dance",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 60,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Dance through the shadows, slipping into stealth for 6 seconds even while in combat.",
      execution: { kind: "buff", buff: { duration: 6, stealth: true } }
    },
    {
      id: "killingSpree",
      name: "Killing Spree",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 2.5,
      color: R,
      targetMode: "enemy",
      combo: "spend",
      description: "Finishing move: unleash a relentless flurry of strikes, damage per combo point spent.",
      execution: { kind: "comboStrike", spend: true }
    },
    {
      id: "hungerForBlood",
      name: "Hunger for Blood",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0,
      color: R,
      targetMode: "enemy",
      description: "The scent of blood enrages you: increase all damage dealt by 15% for 60 seconds. Requires a bleeding target.",
      execution: { kind: "buff", buff: { duration: 60, stats: { damagePercent: 15 } } }
    },
    {
      id: "exposeArmor",
      name: "Expose Armor",
      classId: "rogue",
      requirement: "melee",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0.3,
      color: R,
      targetMode: "enemy",
      combo: "spend",
      description: "Finishing move that exposes your target's armor, increasing its damage taken by 20%.",
      execution: { kind: "comboStrike", spend: true, sunder: 0.2 }
    },
    {
      id: "cripplingPoison",
      name: "Crippling Poison",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 0,
      cooldown: 3,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Coat your weapons with crippling poison for 2 minutes: strikes deal nature damage and slow the target.",
      execution: { kind: "buff", buff: { duration: 120, exclusiveGroup: "poison", imbue: { element: "nature", fraction: 0.1 } } }
    },
    {
      id: "deadlyPoison",
      name: "Deadly Poison",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 0,
      cooldown: 3,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Coat your weapons with deadly poison for 2 minutes: strikes deal additional nature damage.",
      execution: { kind: "buff", buff: { duration: 120, exclusiveGroup: "poison", imbue: { element: "nature", fraction: 0.15 } } }
    },
    {
      id: "woundPoison",
      name: "Wound Poison",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 0,
      cooldown: 3,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Coat your weapons with wound poison for 2 minutes: strikes deal nature damage and hinder the target's healing.",
      execution: { kind: "buff", buff: { duration: 120, exclusiveGroup: "poison", imbue: { element: "nature", fraction: 0.12 } } }
    },
    {
      id: "instantPoison",
      name: "Instant Poison",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 0,
      cooldown: 3,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Coat your weapons with instant poison for 2 minutes: strikes deal heavy additional nature damage.",
      execution: { kind: "buff", buff: { duration: 120, exclusiveGroup: "poison", imbue: { element: "nature", fraction: 0.2 } } }
    },
    {
      id: "mindNumbingPoison",
      name: "Mind-Numbing Poison",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 0,
      cooldown: 3,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Coat your weapons with mind-numbing poison for 2 minutes: strikes deal nature damage and slow the target's casting.",
      execution: { kind: "buff", buff: { duration: 120, exclusiveGroup: "poison", imbue: { element: "nature", fraction: 0.08 } } }
    },
    {
      id: "detectTraps",
      name: "Detect Traps",
      classId: "rogue",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 0,
      cooldown: 30,
      damageMultiplier: 0,
      color: R,
      targetMode: "self",
      offGcd: true,
      description: "Heighten your senses for 30 seconds, revealing hidden traps and slightly increasing your dodge chance.",
      execution: { kind: "buff", buff: { duration: 30, stats: { dodgePercent: 5 } } }
    }
  ]);

  // src/wow-skills-priest.ts
  var P2 = "#FFFFFF";
  var PRIEST_SKILLS = Object.freeze([
    {
      id: "smite",
      name: "Smite",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 1.4,
      color: P2,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Hurl a bolt of holy light at your target.",
      execution: { kind: "projectile", speed: 460, radius: 6, offsets: [0], effects: { style: "holy" } }
    },
    {
      id: "shadowWordPain",
      name: "Shadow Word: Pain",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0.4,
      color: P2,
      targetMode: "enemy",
      range: 420,
      description: "A word of darkness that deals Shadow damage over 15 seconds.",
      execution: { kind: "dot", dot: { school: "shadow", dpsMultiplier: 0.2, duration: 15 } }
    },
    {
      id: "mindBlast",
      name: "Mind Blast",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 50,
      cooldown: 8,
      damageMultiplier: 1.9,
      color: P2,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Blast your target's mind with Shadow damage after a 1.5 second cast.",
      execution: { kind: "strike", school: "shadow" }
    },
    {
      id: "mindFlay",
      name: "Mind Flay",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 45,
      cooldown: 0,
      damageMultiplier: 1.2,
      color: P2,
      targetMode: "enemy",
      range: 280,
      channel: { duration: 3, ticks: 3 },
      description: "Channel Shadow energy into your target for 3 seconds, slowing it by 50%.",
      execution: { kind: "channel", school: "shadow", ticks: 3, duration: 3, slow: { duration: 3, factor: 0.5 } }
    },
    {
      id: "powerWordShield",
      name: "Power Word: Shield",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 45,
      cooldown: 6,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      description: "Shield yourself, absorbing damage equal to 35% of your health for 15 seconds.",
      execution: { kind: "buff", buff: { duration: 15, absorb: 0.35 } }
    },
    {
      id: "renew",
      name: "Renew",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      description: "Restore health over 12 seconds.",
      execution: { kind: "hot", hot: { perTick: 0.15, duration: 12 } }
    },
    {
      id: "flashHeal",
      name: "Flash Heal",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 50,
      cooldown: 0,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      castTime: 1,
      description: "A quick heal that restores a moderate amount of health.",
      execution: { kind: "heal", amount: 1.4 }
    },
    {
      id: "greaterHeal",
      name: "Greater Heal",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 95,
      cooldown: 0,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      castTime: 2.5,
      description: "A slow, powerful heal that restores a large amount of health.",
      execution: { kind: "heal", amount: 3.2 }
    },
    {
      id: "psychicScream",
      name: "Psychic Scream",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 45,
      cooldown: 30,
      damageMultiplier: 0,
      color: P2,
      description: "A psychic scream that fears nearby enemies for 5 seconds.",
      execution: { kind: "cc", cc: "fear", duration: 5, radius: 120, maxTargets: 5 }
    },
    {
      id: "dispelMagic",
      name: "Dispel Magic",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 40,
      cooldown: 8,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      description: "Dispel harmful magic, removing crowd control and restoring a small amount of health.",
      execution: { kind: "cleanse", heal: 0.5, removeCc: true }
    },
    {
      id: "shadowform",
      name: "Shadowform",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      offGcd: true,
      description: "Assume a Shadowform, increasing your spell damage by 15%.",
      execution: { kind: "form", form: "shadow", buff: { duration: 3600, exclusiveGroup: "form", form: "shadow", stats: { spellDamagePercent: 15 } } }
    },
    {
      id: "holyNova",
      name: "Holy Nova",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 70,
      cooldown: 0,
      damageMultiplier: 0.8,
      color: P2,
      description: "A burst of holy light that damages nearby enemies and heals you for 10% of your health.",
      execution: { kind: "radial", radius: 120, melee: false, style: "holy", heal: 0.1 }
    },
    {
      id: "prayerOfHealing",
      name: "Prayer of Healing",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 130,
      cooldown: 0,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      castTime: 2.5,
      description: "A powerful prayer that heals you, then continues healing over 12 seconds.",
      execution: { kind: "heal", amount: 2.4, hot: { perTick: 0.12, duration: 12 } }
    },
    {
      id: "innerFire",
      name: "Inner Fire",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      offGcd: true,
      description: "Inner flame increases your armor by 40 and spell damage by 10% for 10 minutes.",
      execution: { kind: "buff", buff: { duration: 600, exclusiveGroup: "armor", stats: { armor: 40, spellDamagePercent: 10 } } }
    },
    {
      id: "shadowWordDeath",
      name: "Shadow Word: Death",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 40,
      cooldown: 12,
      damageMultiplier: 2.2,
      color: P2,
      targetMode: "enemy",
      range: 420,
      executeThreshold: 0.25,
      description: "A word of death that devastates a wounded enemy. Only usable below 25% health.",
      execution: { kind: "strike", school: "shadow" }
    },
    {
      id: "silence",
      name: "Silence",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 35,
      cooldown: 45,
      damageMultiplier: 0,
      color: P2,
      targetMode: "enemy",
      range: 420,
      description: "Silence your target, preventing it from casting for 5 seconds.",
      execution: { kind: "cc", cc: "silence", duration: 5 }
    },
    {
      id: "vampiricEmbrace",
      name: "Vampiric Embrace",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 50,
      cooldown: 60,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      description: "Embrace the shadows: 30% of the damage you deal returns to you as healing for 15 seconds.",
      execution: { kind: "buff", buff: { duration: 15, leech: 0.3 } }
    },
    {
      id: "bindingHeal",
      name: "Binding Heal",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 70,
      cooldown: 0,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      castTime: 1.5,
      description: "A flash of light that binds your wounds, healing you and your target.",
      execution: { kind: "heal", amount: 2 }
    },
    {
      id: "circleOfHealing",
      name: "Circle of Healing",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 90,
      cooldown: 6,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      description: "A burst of holy light that heals you and nearby allies for 15% of maximum health.",
      execution: { kind: "heal", amount: 1.2, maxHpFrac: 0.15 }
    },
    {
      id: "prayerOfMending",
      name: "Prayer of Mending",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 60,
      cooldown: 10,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      description: "A prayer that mends your wounds now and continues healing over 10 seconds.",
      execution: { kind: "heal", amount: 1, hot: { perTick: 0.2, duration: 10 } }
    },
    {
      id: "penance",
      name: "Penance",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 60,
      cooldown: 10,
      damageMultiplier: 1.5,
      color: P2,
      targetMode: "enemy",
      range: 420,
      channel: { duration: 2, ticks: 3 },
      description: "Channel a volley of holy light, striking your target 3 times and mending your wounds.",
      execution: { kind: "channel", school: "holy", ticks: 3, duration: 2, healFrac: 0.5 }
    },
    {
      id: "guardianSpirit",
      name: "Guardian Spirit",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 60,
      cooldown: 180,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      description: "A guardian spirit watches over you for 10 seconds, reducing damage taken by 40% and mending wounds.",
      execution: { kind: "buff", buff: { duration: 10, reduction: 0.4, healPerSecond: 0.04 } }
    },
    {
      id: "painSuppression",
      name: "Pain Suppression",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 40,
      cooldown: 180,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      description: "Suppress all pain, reducing damage taken by 40% for 8 seconds.",
      execution: { kind: "buff", buff: { duration: 8, reduction: 0.4 } }
    },
    {
      id: "powerInfusion",
      name: "Power Infusion",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 60,
      cooldown: 120,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      description: "Infuse yourself with power, increasing cast speed by 20% and reducing mana costs by 20% for 15 seconds.",
      execution: { kind: "buff", buff: { duration: 15, stats: { castSpeedPercent: 20, manaCostPercent: 20 } } }
    },
    {
      id: "divineHymn",
      name: "Divine Hymn",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 80,
      cooldown: 300,
      damageMultiplier: 1,
      color: P2,
      targetMode: "self",
      channel: { duration: 8, ticks: 4 },
      description: "Channel a divine hymn for 8 seconds, each verse mending your wounds.",
      execution: { kind: "channel", school: "holy", ticks: 4, duration: 8, healFrac: 1 }
    },
    {
      id: "hymnOfHope",
      name: "Hymn of Hope",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 240,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      description: "Sing a hymn of hope, restoring mana over 8 seconds.",
      execution: { kind: "buff", buff: { duration: 8, manaPerSecond: 0.015 } }
    },
    {
      id: "manaBurn",
      name: "Mana Burn",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 50,
      cooldown: 0,
      damageMultiplier: 1.3,
      color: P2,
      targetMode: "enemy",
      range: 420,
      castTime: 2.5,
      description: "Burn away your target's mana, dealing Shadow damage for each point destroyed.",
      execution: { kind: "strike", school: "shadow" }
    },
    {
      id: "mindControl",
      name: "Mind Control",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 0,
      color: P2,
      targetMode: "enemy",
      range: 280,
      castTime: 3,
      description: "Seize control of your target's mind, incapacitating it for 30 seconds.",
      execution: { kind: "cc", cc: "incapacitate", duration: 30 }
    },
    {
      id: "mindSear",
      name: "Mind Sear",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 70,
      cooldown: 0,
      damageMultiplier: 0.5,
      color: P2,
      targetMode: "enemy",
      range: 420,
      channel: { duration: 5, ticks: 5 },
      description: "Channel shadowy tendrils into your target's mind for 5 seconds, searing all nearby enemies.",
      execution: { kind: "channel", school: "shadow", ticks: 5, duration: 5, radius: 140 }
    },
    {
      id: "devouringPlague",
      name: "Devouring Plague",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 70,
      cooldown: 0,
      damageMultiplier: 0.4,
      color: P2,
      targetMode: "enemy",
      range: 420,
      description: "A plague that devours your target's health over 24 seconds, returning it to you as healing.",
      execution: { kind: "dot", dot: { school: "shadow", dpsMultiplier: 0.25, duration: 24 } }
    },
    {
      id: "vampiricTouch",
      name: "Vampiric Touch",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 50,
      cooldown: 0,
      damageMultiplier: 0.4,
      color: P2,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "A vampiric touch that drains your target's life over 15 seconds.",
      execution: { kind: "dot", dot: { school: "shadow", dpsMultiplier: 0.22, duration: 15 } }
    },
    {
      id: "shadowfiend",
      name: "Shadowfiend",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 180,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      description: "Summon a shadowfiend to fight for you for 12 seconds, restoring mana with each attack.",
      execution: { kind: "summon", ally: "ghoul", count: 1, duration: 12 }
    },
    {
      id: "dispersion",
      name: "Dispersion",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      offGcd: true,
      description: "Disperse into pure shadow for 6 seconds, reducing damage taken by 90% and restoring mana.",
      execution: { kind: "buff", buff: { duration: 6, reduction: 0.9, form: "shadow", manaPerSecond: 0.03 } }
    },
    {
      id: "fade",
      name: "Fade",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 30,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      offGcd: true,
      description: "Fade into the shadows, dropping enemy aggression for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, stealth: true } }
    },
    {
      id: "shackleUndead",
      name: "Shackle Undead",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 40,
      cooldown: 0,
      damageMultiplier: 0,
      color: P2,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Shackle an undead enemy in place, incapacitating it for 30 seconds. Any damage breaks the effect.",
      execution: { kind: "cc", cc: "incapacitate", duration: 30 }
    },
    {
      id: "levitate",
      name: "Levitate",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      offGcd: true,
      description: "Levitate above the ground, moving 10% faster for 10 minutes.",
      execution: { kind: "buff", buff: { duration: 600, stats: { moveSpeedPercent: 10 } } }
    },
    {
      id: "massDispel",
      name: "Mass Dispel",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 90,
      cooldown: 15,
      damageMultiplier: 0,
      color: P2,
      castTime: 0.5,
      description: "Dispel magic in a wide area, removing crowd control from allies and effects from enemies.",
      execution: { kind: "cleanse", removeCc: true }
    },
    {
      id: "fearWard",
      name: "Fear Ward",
      classId: "priest",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 30,
      cooldown: 180,
      damageMultiplier: 0,
      color: P2,
      targetMode: "self",
      description: "Ward yourself against fear, breaking crowd control and preventing it for 60 seconds.",
      execution: { kind: "buff", buff: { duration: 60, breakControl: true } }
    }
  ]);

  // src/wow-skills-deathknight.ts
  var D = "#C41F3B";
  var FROST_FEVER = { school: "frost", dpsMultiplier: 0.12, duration: 12 };
  var BLOOD_PLAGUE = { school: "shadow", dpsMultiplier: 0.12, duration: 12 };
  var DEATHKNIGHT_SKILLS = Object.freeze([
    {
      id: "icyTouch",
      name: "Icy Touch",
      classId: "deathKnight",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 1,
      color: D,
      targetMode: "enemy",
      range: 280,
      runeCost: { frost: 1 },
      runicPowerGain: 10,
      description: "Chill your target with Frost Fever, dealing damage over 12 seconds.",
      execution: { kind: "runeStrike", school: "frost", dot: FROST_FEVER }
    },
    {
      id: "plagueStrike",
      name: "Plague Strike",
      classId: "deathKnight",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 0.9,
      color: D,
      targetMode: "enemy",
      runeCost: { unholy: 1 },
      runicPowerGain: 10,
      description: "Infect your target with Blood Plague, dealing shadow damage over 12 seconds.",
      execution: { kind: "runeStrike", school: "shadow", dot: BLOOD_PLAGUE }
    },
    {
      id: "bloodStrike",
      name: "Blood Strike",
      classId: "deathKnight",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 1.2,
      color: D,
      targetMode: "enemy",
      runeCost: { blood: 1 },
      runicPowerGain: 10,
      description: "A strike that deals 25% more damage per disease on the target.",
      execution: { kind: "runeStrike", diseaseBonus: 0.25 }
    },
    {
      id: "deathStrike",
      name: "Death Strike",
      classId: "deathKnight",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 1.5,
      color: D,
      targetMode: "enemy",
      runeCost: { frost: 1, unholy: 1 },
      runicPowerGain: 15,
      description: "A deadly strike that restores health equal to 40% of the damage dealt.",
      execution: { kind: "runeStrike", school: "shadow", healFrac: 0.4 }
    },
    {
      id: "obliterate",
      name: "Obliterate",
      classId: "deathKnight",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 2.2,
      color: D,
      targetMode: "enemy",
      runeCost: { frost: 1, unholy: 1 },
      runicPowerGain: 15,
      description: "A brutal strike, 25% stronger per disease on the target.",
      execution: { kind: "runeStrike", diseaseBonus: 0.25 }
    },
    {
      id: "scourgeStrike",
      name: "Scourge Strike",
      classId: "deathKnight",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 1.8,
      color: D,
      targetMode: "enemy",
      runeCost: { unholy: 1 },
      runicPowerGain: 10,
      description: "An unholy strike dealing shadow damage, 25% stronger per disease.",
      execution: { kind: "runeStrike", school: "shadow", diseaseBonus: 0.25 }
    },
    {
      id: "deathCoil",
      name: "Death Coil",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 40,
      cooldown: 0,
      damageMultiplier: 1.6,
      color: D,
      targetMode: "enemy",
      range: 420,
      description: "Hurl a coil of death energy at your target.",
      execution: { kind: "projectile", speed: 700, radius: 10, offsets: [0], effects: { style: "shadow" } }
    },
    {
      id: "deathGrip",
      name: "Death Grip",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 25,
      damageMultiplier: 0,
      color: D,
      targetMode: "enemy",
      range: 420,
      offGcd: true,
      description: "Harness unholy energy to drag your target to you.",
      execution: { kind: "pull", stun: 0.5 }
    },
    {
      id: "chainsOfIce",
      name: "Chains of Ice",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 0.3,
      color: D,
      targetMode: "enemy",
      range: 280,
      runeCost: { frost: 1 },
      runicPowerGain: 10,
      description: "Shackle your target with frozen chains, rooting it for 4 seconds.",
      execution: { kind: "cc", cc: "root", duration: 4 }
    },
    {
      id: "mindFreeze",
      name: "Mind Freeze",
      classId: "deathKnight",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 10,
      damageMultiplier: 0.2,
      color: D,
      targetMode: "enemy",
      offGcd: true,
      description: "Smash your target's mind with cold, interrupting and silencing for 4 seconds.",
      execution: { kind: "interrupt", silence: 4 }
    },
    {
      id: "bloodBoil",
      name: "Blood Boil",
      classId: "deathKnight",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 1,
      color: D,
      runeCost: { blood: 1 },
      runicPowerGain: 10,
      description: "Boil the blood of all nearby enemies.",
      execution: { kind: "radial", radius: 110, melee: true }
    },
    {
      id: "deathAndDecay",
      name: "Death and Decay",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 15,
      damageMultiplier: 0.5,
      color: D,
      targetMode: "point",
      range: 420,
      runeCost: { blood: 1, frost: 1, unholy: 1 },
      runicPowerGain: 15,
      description: "Corrupt the ground, dealing shadow damage to enemies in the area for 8 seconds.",
      execution: { kind: "ground", effect: "storm", radius: 120, delay: 0.3, duration: 8, interval: 1, style: "arcane" }
    },
    {
      id: "frostPresence",
      name: "Frost Presence",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 1,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      offGcd: true,
      description: "Take on a defensive presence: +30% armor, -10% damage taken.",
      execution: { kind: "buff", buff: { duration: 3600, exclusiveGroup: "presence", stats: { armor: 30 }, reduction: 0.1 } }
    },
    {
      id: "bloodPresence",
      name: "Blood Presence",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 1,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      offGcd: true,
      description: "Take on an aggressive presence: +10% damage, 2% of damage returns as health.",
      execution: { kind: "buff", buff: { duration: 3600, exclusiveGroup: "presence", stats: { damagePercent: 10, lifeOnHit: 2 } } }
    },
    {
      id: "unholyPresence",
      name: "Unholy Presence",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 1,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      offGcd: true,
      description: "Take on a swift presence: +15% attack speed and movement speed.",
      execution: { kind: "buff", buff: { duration: 3600, exclusiveGroup: "presence", stats: { attackSpeedPercent: 15, moveSpeedPercent: 15 } } }
    },
    {
      id: "iceboundFortitude",
      name: "Icebound Fortitude",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 20,
      cooldown: 60,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      offGcd: true,
      description: "Freeze your blood, reducing damage taken by 40% for 8 seconds.",
      execution: { kind: "buff", buff: { duration: 8, reduction: 0.4 } }
    },
    {
      id: "antiMagicShell",
      name: "Anti-Magic Shell",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 20,
      cooldown: 45,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      offGcd: true,
      description: "Surround yourself in a shell absorbing 30% of your life in damage for 5 seconds.",
      execution: { kind: "buff", buff: { duration: 5, absorb: 0.3 } }
    },
    {
      id: "raiseDead",
      name: "Raise Dead",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 40,
      cooldown: 60,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      description: "Raise a ghoul to fight at your side.",
      execution: { kind: "summon", ally: "ghoul", count: 1 }
    },
    {
      id: "armyOfDead",
      name: "Army of the Dead",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 180,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      castTime: 4,
      runeCost: { blood: 1, frost: 1, unholy: 1 },
      description: "Raise a pack of ghouls to swarm your enemies for 40 seconds.",
      execution: { kind: "summon", ally: "ghoul", count: 4, duration: 40 }
    },
    {
      id: "strangulate",
      name: "Strangulate",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 60,
      damageMultiplier: 0,
      color: D,
      targetMode: "enemy",
      range: 280,
      runeCost: { blood: 1 },
      runicPowerGain: 10,
      description: "Strangle your target with unholy strength, silencing it for 5 seconds.",
      execution: { kind: "cc", cc: "silence", duration: 5 }
    },
    {
      id: "pestilence",
      name: "Pestilence",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 0.3,
      color: D,
      runeCost: { blood: 1 },
      runicPowerGain: 10,
      description: "Spread your diseases to all nearby enemies, dealing shadow damage.",
      execution: { kind: "radial", radius: 130, melee: false, style: "shadow", dot: BLOOD_PLAGUE }
    },
    {
      id: "howlingBlast",
      name: "Howling Blast",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 8,
      damageMultiplier: 1.5,
      color: D,
      targetMode: "point",
      range: 280,
      runeCost: { frost: 1, unholy: 1 },
      runicPowerGain: 15,
      description: "Blast the target area with freezing wind, dealing frost damage and slowing enemies.",
      execution: { kind: "radial", targetRange: 280, radius: 120, melee: false, style: "frost", slow: { duration: 3, factor: 0.5 } }
    },
    {
      id: "frostStrike",
      name: "Frost Strike",
      classId: "deathKnight",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 40,
      cooldown: 0,
      damageMultiplier: 1.4,
      color: D,
      targetMode: "enemy",
      description: "A chilling strike that deals frost damage instead of physical.",
      execution: { kind: "runeStrike", school: "frost" }
    },
    {
      id: "runeStrike",
      name: "Rune Strike",
      classId: "deathKnight",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 1.6,
      color: D,
      targetMode: "enemy",
      description: "Strike the target after dodging or parrying, dealing heavy weapon damage.",
      execution: { kind: "runeStrike" }
    },
    {
      id: "deathchill",
      name: "Deathchill",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      offGcd: true,
      description: "Focus your cold fury, guaranteeing critical strikes for 8 seconds.",
      execution: { kind: "buff", buff: { duration: 8, stats: { critChance: 100 } } }
    },
    {
      id: "lichborne",
      name: "Lichborne",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      offGcd: true,
      description: "Draw on unholy energy to become undead, breaking and preventing crowd control for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, breakControl: true, immunity: true } }
    },
    {
      id: "unbreakableArmor",
      name: "Unbreakable Armor",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 60,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      offGcd: true,
      runeCost: { frost: 1 },
      runicPowerGain: 10,
      description: "Reinforce your armor with frost, increasing armor by 25% and reducing damage taken for 20 seconds.",
      execution: { kind: "buff", buff: { duration: 20, stats: { armor: 25 }, reduction: 0.05 } }
    },
    {
      id: "vampiricBlood",
      name: "Vampiric Blood",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 60,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      offGcd: true,
      runeCost: { blood: 1 },
      runicPowerGain: 10,
      description: "Increase your maximum health and leech life from your strikes for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, stats: { maxHp: 15 }, healPerSecond: 2, leech: 0.1 } }
    },
    {
      id: "runeTap",
      name: "Rune Tap",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 30,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      offGcd: true,
      runeCost: { blood: 1 },
      runicPowerGain: 10,
      description: "Tap a blood rune to instantly restore 10% of your maximum health.",
      execution: { kind: "heal", amount: 0, maxHpFrac: 0.1 }
    },
    {
      id: "markOfBlood",
      name: "Mark of Blood",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 0,
      color: D,
      targetMode: "enemy",
      range: 280,
      runeCost: { blood: 1 },
      runicPowerGain: 10,
      description: "Mark an enemy so its attacks return a portion of damage dealt as healing for 20 seconds.",
      execution: { kind: "buff", buff: { duration: 20, leech: 0.04 } }
    },
    {
      id: "hysteria",
      name: "Hysteria",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 180,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      runeCost: { blood: 1 },
      runicPowerGain: 10,
      description: "Drive yourself into a blood frenzy, increasing damage dealt by 20% for 30 seconds.",
      execution: { kind: "buff", buff: { duration: 30, stats: { damagePercent: 20 } } }
    },
    {
      id: "dancingRuneWeapon",
      name: "Dancing Rune Weapon",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 90,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      runeCost: { blood: 1 },
      runicPowerGain: 10,
      description: "Summon a rune weapon that mirrors your strikes for 12 seconds.",
      execution: { kind: "summon", ally: "mirrorImage", count: 1, duration: 12 }
    },
    {
      id: "summonGargoyle",
      name: "Summon Gargoyle",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "ultimate",
      manaCost: 60,
      cooldown: 180,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      description: "Call down a gargoyle to bombard your enemies for 30 seconds.",
      execution: { kind: "summon", ally: "infernal", count: 1, duration: 30 }
    },
    {
      id: "corpseExplosion",
      name: "Corpse Explosion",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 40,
      cooldown: 0,
      damageMultiplier: 1.2,
      color: D,
      targetMode: "point",
      range: 280,
      runeCost: { unholy: 1 },
      runicPowerGain: 10,
      description: "Detonate a corpse, dealing shadow damage to all nearby enemies.",
      execution: { kind: "radial", targetRange: 280, radius: 110, melee: false, style: "shadow" }
    },
    {
      id: "antiMagicZone",
      name: "Anti-Magic Zone",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: D,
      targetMode: "point",
      range: 280,
      runeCost: { unholy: 1 },
      runicPowerGain: 10,
      description: "Place a zone that reduces spell damage taken by allies inside by 75% for 10 seconds.",
      execution: { kind: "radial", targetRange: 280, radius: 120, melee: false, style: "arcane", shelter: { duration: 10, reduction: 0.75 } }
    },
    {
      id: "boneShield",
      name: "Bone Shield",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 60,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      offGcd: true,
      runeCost: { unholy: 1 },
      runicPowerGain: 10,
      description: "Surround yourself with a barrier of whirling bones, reducing damage taken by 20%.",
      execution: { kind: "buff", buff: { duration: 300, reduction: 0.2 } }
    },
    {
      id: "darkCommand",
      name: "Dark Command",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 8,
      damageMultiplier: 0,
      color: D,
      targetMode: "enemy",
      range: 280,
      description: "Command the target to attack you for 3 seconds.",
      execution: { kind: "taunt", duration: 3 }
    },
    {
      id: "deathPact",
      name: "Death Pact",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 40,
      cooldown: 120,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      offGcd: true,
      description: "Sacrifice an undead minion to restore 40% of your maximum health.",
      execution: { kind: "heal", amount: 0, maxHpFrac: 0.4 }
    },
    {
      id: "hornOfWinter",
      name: "Horn of Winter",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      runicPowerGain: 10,
      description: "Sound the Horn of Winter, increasing strength and dexterity for 2 minutes.",
      execution: { kind: "buff", buff: { duration: 120, stats: { strength: 10, dexterity: 10 } } }
    },
    {
      id: "pathOfFrost",
      name: "Path of Frost",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      runeCost: { frost: 1 },
      runicPowerGain: 10,
      description: "Freeze the ground beneath you, granting water walking and swift movement for 10 minutes.",
      execution: { kind: "buff", buff: { duration: 600, stats: { moveSpeedPercent: 10 } } }
    },
    {
      id: "empowerRuneWeapon",
      name: "Empower Rune Weapon",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 300,
      damageMultiplier: 0,
      color: D,
      targetMode: "self",
      offGcd: true,
      description: "Empower your rune weapon, rapidly regenerating runic power for 5 seconds.",
      execution: { kind: "buff", buff: { duration: 5, resourcePerSecond: 10 } }
    }
  ]);

  // src/wow-skills-shaman.ts
  var S = "#0070DE";
  var SHAMAN_SKILLS = Object.freeze([
    {
      id: "lightningBolt",
      name: "Lightning Bolt",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 1.6,
      color: S,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Hurl a bolt of lightning at your target after a 1.5 second cast.",
      execution: { kind: "projectile", speed: 520, radius: 5, offsets: [0], effects: { style: "lightning" } }
    },
    {
      id: "chainLightning",
      name: "Chain Lightning",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 40,
      cooldown: 6,
      damageMultiplier: 1.3,
      color: S,
      targetMode: "enemy",
      range: 420,
      description: "Strike your target with lightning that arcs to 3 nearby enemies.",
      execution: { kind: "chain", jumps: 3, range: 160, falloff: 0.7, duration: 0.3, style: "lightning" }
    },
    {
      id: "earthShock",
      name: "Earth Shock",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 20,
      cooldown: 6,
      damageMultiplier: 0.9,
      color: S,
      targetMode: "enemy",
      range: 280,
      description: "Shock your target with earthen force, silencing it for 2 seconds.",
      execution: { kind: "strike", school: "nature", silence: 2 }
    },
    {
      id: "flameShock",
      name: "Flame Shock",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 6,
      damageMultiplier: 0.6,
      color: S,
      targetMode: "enemy",
      range: 280,
      description: "Sear your target with flame, dealing fire damage over 12 seconds.",
      execution: { kind: "strike", school: "fire", dot: { school: "fire", dpsMultiplier: 0.18, duration: 12 } }
    },
    {
      id: "frostShock",
      name: "Frost Shock",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 6,
      damageMultiplier: 0.7,
      color: S,
      targetMode: "enemy",
      range: 280,
      description: "Chill your target with frost, slowing it by 50% for 4 seconds.",
      execution: { kind: "strike", school: "frost", slow: { duration: 4, factor: 0.5 } }
    },
    {
      id: "lavaBurst",
      name: "Lava Burst",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 8,
      damageMultiplier: 1.4,
      color: S,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Hurl molten lava at your target after a 1.5 second cast. Deals 50% more damage to enemies burning with Flame Shock.",
      execution: { kind: "strike", school: "fire", bonusVsDot: 0.5 }
    },
    {
      id: "stormstrike",
      name: "Stormstrike",
      classId: "shaman",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 20,
      cooldown: 8,
      damageMultiplier: 1.8,
      color: S,
      targetMode: "enemy",
      description: "Strike your target with both weapons, charging them with storm energy.",
      execution: { kind: "strike" }
    },
    {
      id: "windShear",
      name: "Wind Shear",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 15,
      cooldown: 6,
      damageMultiplier: 0.2,
      color: S,
      targetMode: "enemy",
      range: 350,
      offGcd: true,
      description: "A gust of wind that interrupts your target, silencing it for 3 seconds.",
      execution: { kind: "interrupt", silence: 3 }
    },
    {
      id: "healingWave",
      name: "Healing Wave",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 40,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      castTime: 2,
      description: "Call on ancestral waters to mend your wounds after a 2 second cast.",
      execution: { kind: "heal", amount: 2.6 }
    },
    {
      id: "lesserHealingWave",
      name: "Lesser Healing Wave",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      castTime: 1,
      description: "A quick surge of healing that mends your wounds after a 1 second cast.",
      execution: { kind: "heal", amount: 1.3 }
    },
    {
      id: "chainHeal",
      name: "Chain Heal",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 45,
      cooldown: 6,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      castTime: 1.5,
      description: "A wave of healing that mends your wounds and continues to restore health over 9 seconds.",
      execution: { kind: "heal", amount: 1.6, hot: { perTick: 0.15, duration: 9 } }
    },
    {
      id: "searingTotem",
      name: "Searing Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that sears nearby enemies with fire for 30 seconds.",
      execution: { kind: "summon", ally: "searingTotem", count: 1, duration: 30 }
    },
    {
      id: "healingStreamTotem",
      name: "Healing Stream Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that mends your wounds over time for 30 seconds.",
      execution: { kind: "summon", ally: "healingTotem", count: 1, duration: 30 }
    },
    {
      id: "earthbindTotem",
      name: "Earthbind Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that slows nearby enemies for 20 seconds.",
      execution: { kind: "summon", ally: "earthbindTotem", count: 1, duration: 20 }
    },
    {
      id: "ghostWolf",
      name: "Ghost Wolf",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 10,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      offGcd: true,
      description: "Transform into a spectral wolf, increasing movement speed by 30%.",
      execution: { kind: "form", form: "ghostWolf", buff: { duration: 3600, exclusiveGroup: "form", form: "ghostWolf", stats: { moveSpeedPercent: 30 } } }
    },
    {
      id: "bloodlust",
      name: "Bloodlust",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 30,
      cooldown: 120,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Fill yourself with primal fury, increasing attack and cast speed by 20% for 20 seconds.",
      execution: { kind: "buff", buff: { duration: 20, stats: { attackSpeedPercent: 20, castSpeedPercent: 20 } } }
    },
    {
      id: "feralSpirit",
      name: "Feral Spirit",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 40,
      cooldown: 90,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Summon two spirit wolves to fight at your side for 30 seconds.",
      execution: { kind: "summon", ally: "spiritWolf", count: 2, duration: 30 }
    },
    {
      id: "thunderstorm",
      name: "Thunderstorm",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 20,
      damageMultiplier: 1,
      color: S,
      description: "Call down a storm that blasts nearby enemies with lightning, stunning them for 1.5 seconds.",
      execution: { kind: "radial", radius: 130, melee: false, stun: 1.5, style: "lightning" }
    },
    {
      id: "lightningShield",
      name: "Lightning Shield",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      offGcd: true,
      description: "Surround yourself with lightning, reflecting 30% of incoming damage for 5 minutes. Only one shield can be active.",
      execution: { kind: "buff", buff: { duration: 300, exclusiveGroup: "shield", reflect: 0.3 } }
    },
    {
      id: "windfuryWeapon",
      name: "Windfury Weapon",
      classId: "shaman",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      offGcd: true,
      description: "Imbue your weapon with wind for 30 minutes; strikes deal additional lightning damage. Only one imbue can be active.",
      execution: { kind: "buff", buff: { duration: 1800, exclusiveGroup: "imbue", imbue: { element: "lightning", fraction: 0.35 } } }
    },
    {
      id: "flametongueWeapon",
      name: "Flametongue Weapon",
      classId: "shaman",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      offGcd: true,
      description: "Imbue your weapon with flame for 30 minutes; strikes deal additional fire damage. Only one imbue can be active.",
      execution: { kind: "buff", buff: { duration: 1800, exclusiveGroup: "imbue", imbue: { element: "fire", fraction: 0.25 } } }
    },
    {
      id: "frostbrandWeapon",
      name: "Frostbrand Weapon",
      classId: "shaman",
      requirement: "melee",
      domain: "Might",
      tier: "advanced",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      offGcd: true,
      description: "Imbue your weapon with frost for 30 minutes; strikes deal additional frost damage. Only one imbue can be active.",
      execution: { kind: "buff", buff: { duration: 1800, exclusiveGroup: "imbue", imbue: { element: "frost", fraction: 0.3 } } }
    },
    {
      id: "rockbiterWeapon",
      name: "Rockbiter Weapon",
      classId: "shaman",
      requirement: "melee",
      domain: "Might",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      offGcd: true,
      description: "Imbue your weapon with earthen weight for 30 minutes; strikes deal additional nature damage. Only one imbue can be active.",
      execution: { kind: "buff", buff: { duration: 1800, exclusiveGroup: "imbue", imbue: { element: "nature", fraction: 0.2 } } }
    },
    {
      id: "earthlivingWeapon",
      name: "Earthliving Weapon",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      offGcd: true,
      description: "Imbue your weapon with life-giving earth for 30 minutes, mending your wounds over time. Only one imbue can be active.",
      execution: { kind: "buff", buff: { duration: 1800, exclusiveGroup: "imbue", imbue: { element: "nature", fraction: 0.15 }, healPerSecond: 4e-3 } }
    },
    {
      id: "fireNova",
      name: "Fire Nova",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 35,
      cooldown: 10,
      damageMultiplier: 1.1,
      color: S,
      description: "Unleash a nova of fire that burns all nearby enemies.",
      execution: { kind: "radial", radius: 140, melee: false, style: "fire" }
    },
    {
      id: "magmaTotem",
      name: "Magma Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that erupts with magma, searing nearby enemies for 30 seconds.",
      execution: { kind: "summon", ally: "searingTotem", count: 1, duration: 30 }
    },
    {
      id: "manaSpringTotem",
      name: "Mana Spring Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that restores your mana over time for 45 seconds.",
      execution: { kind: "summon", ally: "healingTotem", count: 1, duration: 45 }
    },
    {
      id: "totemOfWrath",
      name: "Totem of Wrath",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem of wrath that empowers your spells and sears nearby enemies for 45 seconds.",
      execution: { kind: "summon", ally: "searingTotem", count: 1, duration: 45 }
    },
    {
      id: "wrathOfAirTotem",
      name: "Wrath of Air Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that quickens your spellcasting for 45 seconds.",
      execution: { kind: "summon", ally: "healingTotem", count: 1, duration: 45 }
    },
    {
      id: "windfuryTotem",
      name: "Windfury Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that quickens your attacks for 45 seconds.",
      execution: { kind: "summon", ally: "healingTotem", count: 1, duration: 45 }
    },
    {
      id: "strengthOfEarthTotem",
      name: "Strength of Earth Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that lends you the strength of the earth for 45 seconds.",
      execution: { kind: "summon", ally: "healingTotem", count: 1, duration: 45 }
    },
    {
      id: "stoneskinTotem",
      name: "Stoneskin Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that hardens your skin like stone for 45 seconds.",
      execution: { kind: "summon", ally: "healingTotem", count: 1, duration: 45 }
    },
    {
      id: "flametongueTotem",
      name: "Flametongue Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem wreathed in flame that sears nearby enemies for 45 seconds.",
      execution: { kind: "summon", ally: "searingTotem", count: 1, duration: 45 }
    },
    {
      id: "tremorTotem",
      name: "Tremor Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that trembles the ground, steadying you against fear for 30 seconds.",
      execution: { kind: "summon", ally: "healingTotem", count: 1, duration: 30 }
    },
    {
      id: "cleansingTotem",
      name: "Cleansing Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that cleanses you of poison and disease for 30 seconds.",
      execution: { kind: "summon", ally: "healingTotem", count: 1, duration: 30 }
    },
    {
      id: "groundingTotem",
      name: "Grounding Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 20,
      cooldown: 15,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that grounds hostile magic, slowing nearby enemies for 30 seconds.",
      execution: { kind: "summon", ally: "earthbindTotem", count: 1, duration: 30 }
    },
    {
      id: "earthElementalTotem",
      name: "Earth Elemental Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 50,
      cooldown: 180,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that calls forth an earth elemental to protect you for 45 seconds.",
      execution: { kind: "summon", ally: "infernal", count: 1, duration: 45 }
    },
    {
      id: "fireElementalTotem",
      name: "Fire Elemental Totem",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 50,
      cooldown: 180,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "Place a totem that calls forth a fire elemental to burn your enemies for 45 seconds.",
      execution: { kind: "summon", ally: "infernal", count: 1, duration: 45 }
    },
    {
      id: "purge",
      name: "Purge",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "enemy",
      range: 280,
      description: "Purge your target of beneficial magic, stripping away its enchantments.",
      execution: { kind: "cleanse", removeCc: true }
    },
    {
      id: "hex",
      name: "Hex",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 25,
      cooldown: 45,
      damageMultiplier: 0,
      color: S,
      targetMode: "enemy",
      range: 280,
      description: "Transform your target into a frog for 6 seconds. Any damage may break the effect.",
      execution: { kind: "cc", cc: "polymorph", duration: 6 }
    },
    {
      id: "riptide",
      name: "Riptide",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 6,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      description: "A surge of water that mends your wounds and continues to heal over 9 seconds.",
      execution: { kind: "heal", amount: 1.4, hot: { perTick: 0.12, duration: 9 } }
    },
    {
      id: "earthShield",
      name: "Earth Shield",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      offGcd: true,
      description: "Surround yourself with earthen plates that absorb 25% of your maximum health in damage for 5 minutes. Only one shield can be active.",
      execution: { kind: "buff", buff: { duration: 300, exclusiveGroup: "shield", absorb: 0.25 } }
    },
    {
      id: "waterShield",
      name: "Water Shield",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      offGcd: true,
      description: "Surround yourself with globes of water that restore your mana for 5 minutes. Only one shield can be active.",
      execution: { kind: "buff", buff: { duration: 300, exclusiveGroup: "shield", manaPerSecond: 5e-3 } }
    },
    {
      id: "ancestralSpirit",
      name: "Ancestral Spirit",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      castTime: 8,
      description: "Call an ancestral spirit back from beyond, restoring 40% of your maximum health after an 8 second cast.",
      execution: { kind: "heal", amount: 0, maxHpFrac: 0.4 }
    },
    {
      id: "reincarnation",
      name: "Reincarnation",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 600,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      offGcd: true,
      description: "Bind your spirit to the world for 5 minutes; ancestral energy slowly mends your wounds.",
      execution: { kind: "buff", buff: { duration: 300, healPerSecond: 3e-3 } }
    },
    {
      id: "astralRecall",
      name: "Astral Recall",
      classId: "shaman",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 10,
      cooldown: 300,
      damageMultiplier: 0,
      color: S,
      targetMode: "self",
      offGcd: true,
      castTime: 5,
      description: "Recall your spirit through the astral plane, moving 50% faster for 6 seconds after a 5 second cast.",
      execution: { kind: "buff", buff: { duration: 6, stats: { moveSpeedPercent: 50 } } }
    }
  ]);

  // src/wow-skills-mage.ts
  var M = "#69CCF0";
  var MAGE_SKILLS = Object.freeze([
    {
      id: "frostbolt",
      name: "Frostbolt",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 1.6,
      color: M,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Launch a bolt of frost that damages your target and slows it by 40% for 4 seconds.",
      execution: { kind: "projectile", speed: 600, radius: 10, offsets: [0], effects: { style: "frost", slowFactor: 0.6, slowDuration: 4 } }
    },
    {
      id: "pyroblast",
      name: "Pyroblast",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 3.2,
      color: M,
      targetMode: "enemy",
      range: 420,
      castTime: 3,
      description: "Hurl a massive fiery boulder that ignites your target, burning it over time.",
      execution: { kind: "projectile", speed: 500, radius: 14, offsets: [0], effects: { style: "fire", burnDuration: 4, burnDamageMultiplier: 0.3 } }
    },
    {
      id: "fireBlast",
      name: "Fire Blast",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 20,
      cooldown: 8,
      damageMultiplier: 1.2,
      color: M,
      targetMode: "enemy",
      range: 280,
      description: "Blast your target with an instant burst of flame.",
      execution: { kind: "strike", school: "fire" }
    },
    {
      id: "scorch",
      name: "Scorch",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0.9,
      color: M,
      targetMode: "enemy",
      range: 420,
      castTime: 1,
      description: "A quick burst of fire that sears your target.",
      execution: { kind: "strike", school: "fire" }
    },
    {
      id: "arcaneMissiles",
      name: "Arcane Missiles",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 50,
      cooldown: 0,
      damageMultiplier: 0.5,
      color: M,
      targetMode: "enemy",
      range: 420,
      channel: { duration: 3, ticks: 5 },
      description: "Channel a barrage of arcane missiles, striking your target 5 times over 3 seconds.",
      execution: { kind: "channel", school: "arcane", ticks: 5, duration: 3 }
    },
    {
      id: "arcaneExplosion",
      name: "Arcane Explosion",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 1,
      color: M,
      description: "Detonate an arcane burst, damaging all nearby enemies.",
      execution: { kind: "radial", radius: 110, melee: false, style: "arcane" }
    },
    {
      id: "frostNova",
      name: "Frost Nova",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 35,
      cooldown: 20,
      damageMultiplier: 0.3,
      color: M,
      description: "Freeze nearby enemies in place, rooting them for 5 seconds.",
      execution: { kind: "cc", cc: "root", duration: 5, radius: 120 }
    },
    {
      id: "iceLance",
      name: "Ice Lance",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 10,
      cooldown: 0,
      damageMultiplier: 0.8,
      color: M,
      targetMode: "enemy",
      range: 420,
      description: "Hurl a shard of ice, dealing triple damage against frozen targets.",
      execution: { kind: "strike", school: "frost", bonusVsFrozen: 3 }
    },
    {
      id: "coneOfCold",
      name: "Cone of Cold",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 40,
      cooldown: 10,
      damageMultiplier: 1.1,
      color: M,
      description: "A cone of freezing air damages enemies before you and slows them by 50% for 6 seconds.",
      execution: { kind: "cone", radius: 140, arc: Math.PI * 0.6, stun: 0, cc: { kind: "slow", duration: 6, factor: 0.5 } }
    },
    {
      id: "blizzard",
      name: "Blizzard",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 70,
      cooldown: 8,
      damageMultiplier: 0.35,
      color: M,
      targetMode: "point",
      range: 420,
      castTime: 2,
      description: "Call down a storm of ice over the target area for 8 seconds, slowing enemies caught within.",
      execution: { kind: "ground", effect: "storm", radius: 140, delay: 0.5, duration: 8, interval: 1, style: "frost", slow: { duration: 2, factor: 0.6 } }
    },
    {
      id: "blink",
      name: "Blink",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 40,
      cooldown: 12,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      offGcd: true,
      description: "Teleport 300 units forward.",
      execution: { kind: "step", duration: 0.15, speed: 2e3 }
    },
    {
      id: "polymorph",
      name: "Polymorph",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 50,
      cooldown: 15,
      damageMultiplier: 0,
      color: M,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Transform your target into a harmless sheep for 8 seconds. Any damage breaks the effect.",
      execution: { kind: "cc", cc: "polymorph", duration: 8 }
    },
    {
      id: "counterspell",
      name: "Counterspell",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 45,
      cooldown: 20,
      damageMultiplier: 0.2,
      color: M,
      targetMode: "enemy",
      range: 420,
      offGcd: true,
      description: "Counter your target's spell, interrupting it and silencing it for 5 seconds.",
      execution: { kind: "interrupt", silence: 5 }
    },
    {
      id: "iceBlock",
      name: "Ice Block",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 15,
      cooldown: 120,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      offGcd: true,
      description: "Encase yourself in ice, becoming immune to all damage and breaking crowd control for 6 seconds.",
      execution: { kind: "buff", buff: { duration: 6, immunity: true, breakControl: true } }
    },
    {
      id: "iceBarrier",
      name: "Ice Barrier",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 45,
      cooldown: 30,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      offGcd: true,
      description: "Raise a barrier of ice that absorbs damage equal to 30% of your health for 30 seconds.",
      execution: { kind: "buff", buff: { duration: 30, absorb: 0.3 } }
    },
    {
      id: "evocation",
      name: "Evocation",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 0,
      cooldown: 240,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      channel: { duration: 4, ticks: 4 },
      description: "Channel for 4 seconds, restoring 15% of your mana per second.",
      execution: { kind: "channel", school: "arcane", ticks: 4, duration: 4, manaPerTick: 0.15 }
    },
    {
      id: "mirrorImage",
      name: "Mirror Image",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 60,
      cooldown: 90,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      description: "Create 2 mirror images of yourself that fight beside you for 20 seconds.",
      execution: { kind: "summon", ally: "mirrorImage", count: 2, duration: 20 }
    },
    {
      id: "combustion",
      name: "Combustion",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 40,
      cooldown: 120,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      offGcd: true,
      description: "Ignite your fire magic: +50% critical strike chance and +15% fire damage for 15 seconds.",
      execution: { kind: "buff", buff: { duration: 15, stats: { critChance: 50, fireDamage: 15 } } }
    },
    {
      id: "dragonsBreath",
      name: "Dragon's Breath",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 50,
      cooldown: 20,
      damageMultiplier: 1,
      color: M,
      description: "Breathe a cone of dragonfire, damaging and disorienting enemies before you for 3 seconds.",
      execution: { kind: "cone", radius: 130, arc: Math.PI * 0.6, stun: 0, cc: { kind: "incapacitate", duration: 3 } }
    },
    {
      id: "deepFreeze",
      name: "Deep Freeze",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 45,
      cooldown: 30,
      damageMultiplier: 0.4,
      color: M,
      targetMode: "enemy",
      range: 420,
      description: "Freeze your target solid for 4 seconds. Only usable on frozen targets.",
      execution: { kind: "cc", cc: "freeze", duration: 4 }
    },
    {
      id: "flamestrike",
      name: "Flamestrike",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 55,
      cooldown: 0,
      damageMultiplier: 2,
      color: M,
      targetMode: "point",
      range: 420,
      castTime: 2,
      description: "Call down a pillar of flame on the target area, leaving fire burning on the ground for 8 seconds.",
      execution: {
        kind: "ground",
        effect: "meteor",
        radius: 120,
        delay: 0.5,
        duration: 0,
        interval: 1,
        style: "fire",
        scorch: { duration: 8, interval: 1, damageMultiplier: 0.1 }
      }
    },
    {
      id: "blastWave",
      name: "Blast Wave",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 40,
      cooldown: 30,
      damageMultiplier: 1.4,
      color: M,
      description: "Detonate a wave of flame around you, damaging nearby enemies and slowing them by 50% for 6 seconds.",
      execution: { kind: "radial", radius: 120, melee: false, style: "fire", slow: { duration: 6, factor: 0.5 } }
    },
    {
      id: "livingBomb",
      name: "Living Bomb",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 50,
      cooldown: 0,
      damageMultiplier: 1,
      color: M,
      targetMode: "enemy",
      range: 420,
      description: "Turn your target into a living bomb, burning for 12 seconds before exploding in flames.",
      execution: { kind: "dot", dot: { school: "fire", dpsMultiplier: 0.2, duration: 12, detonate: 0.5 } }
    },
    {
      id: "arcaneBlast",
      name: "Arcane Blast",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 2,
      color: M,
      targetMode: "enemy",
      range: 420,
      castTime: 2.5,
      description: "Blast your target with raw arcane energy after a 2.5 second cast.",
      execution: { kind: "projectile", speed: 650, radius: 10, offsets: [0], effects: { style: "arcane" } }
    },
    {
      id: "arcaneBarrage",
      name: "Arcane Barrage",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 45,
      cooldown: 3,
      damageMultiplier: 1.5,
      color: M,
      targetMode: "enemy",
      range: 420,
      description: "Launch a barrage of three arcane missiles at your target.",
      execution: { kind: "projectile", speed: 700, radius: 8, offsets: [-0.15, 0, 0.15], effects: { style: "arcane" } }
    },
    {
      id: "frostfireBolt",
      name: "Frostfire Bolt",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 45,
      cooldown: 0,
      damageMultiplier: 2.2,
      color: M,
      targetMode: "enemy",
      range: 420,
      castTime: 3,
      description: "Launch a bolt of frostfire that slows your target by 40% and burns it over 4 seconds.",
      execution: {
        kind: "projectile",
        speed: 550,
        radius: 12,
        offsets: [0],
        effects: { style: "frost", slowFactor: 0.6, slowDuration: 4, burnDuration: 4, burnDamageMultiplier: 0.15 }
      }
    },
    {
      id: "coldSnap",
      name: "Cold Snap",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 0,
      cooldown: 480,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      offGcd: true,
      description: "Snap the cold around you, restoring 30% of your mana over 6 seconds.",
      execution: { kind: "buff", buff: { duration: 6, manaPerSecond: 0.05 } }
    },
    {
      id: "icyVeins",
      name: "Icy Veins",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 20,
      cooldown: 180,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      offGcd: true,
      description: "Chill your veins, increasing casting speed by 20% for 20 seconds.",
      execution: { kind: "buff", buff: { duration: 20, stats: { castSpeedPercent: 20 } } }
    },
    {
      id: "summonWaterElemental",
      name: "Summon Water Elemental",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 40,
      cooldown: 180,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      description: "Summon a water elemental to fight at your side for 45 seconds.",
      execution: { kind: "summon", ally: "waterElemental", count: 1, duration: 45 }
    },
    {
      id: "manaShield",
      name: "Mana Shield",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 12,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      offGcd: true,
      description: "Shield yourself with mana, absorbing damage equal to 25% of your health for 60 seconds.",
      execution: { kind: "ward", duration: 60, fraction: 0.25 }
    },
    {
      id: "mageArmor",
      name: "Mage Armor",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 50,
      cooldown: 0,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      offGcd: true,
      description: "Ward yourself with mage armor, increasing all resistances and mana regeneration for 10 minutes.",
      execution: { kind: "buff", buff: { duration: 600, exclusiveGroup: "armor", stats: { allResistance: 10, manaRegen: 1 } } }
    },
    {
      id: "moltenArmor",
      name: "Molten Armor",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 55,
      cooldown: 0,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      offGcd: true,
      description: "Sheathe yourself in molten armor, increasing critical strike chance by 3% and burning attackers for 10 minutes.",
      execution: { kind: "buff", buff: { duration: 600, exclusiveGroup: "armor", stats: { critChance: 3 }, reflect: 0.1 } }
    },
    {
      id: "removeCurse",
      name: "Remove Curse",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      description: "Remove a curse, clearing crowd control effects from yourself.",
      execution: { kind: "cleanse", removeCc: true }
    },
    {
      id: "spellSteal",
      name: "Spell Steal",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 45,
      cooldown: 0,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      description: "Steal beneficial magic, increasing your spell damage by 10% for 20 seconds.",
      execution: { kind: "cleanse", buff: { duration: 20, stats: { spellDamagePercent: 10 } } }
    },
    {
      id: "slowFall",
      name: "Slow Fall",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      offGcd: true,
      description: "Lighten your steps, increasing movement speed by 10% for 30 seconds.",
      execution: { kind: "buff", buff: { duration: 30, stats: { moveSpeedPercent: 10 } } }
    },
    {
      id: "conjureRefreshment",
      name: "Conjure Refreshment",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      castTime: 3,
      description: "Conjure refreshments, restoring 2% health and 3% mana per second for 20 seconds.",
      execution: { kind: "buff", buff: { duration: 20, healPerSecond: 0.02, manaPerSecond: 0.03 } }
    },
    {
      id: "focusMagic",
      name: "Focus Magic",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      offGcd: true,
      description: "Focus your magic, increasing critical strike chance by 3% for 10 minutes.",
      execution: { kind: "buff", buff: { duration: 600, stats: { critChance: 3 } } }
    },
    {
      id: "presenceOfMind",
      name: "Presence of Mind",
      classId: "mage",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: M,
      targetMode: "self",
      offGcd: true,
      description: "Clear your mind, making your next spell cast nearly instant.",
      execution: { kind: "buff", buff: { duration: 3, stats: { castSpeedPercent: 300 } } }
    }
  ]);

  // src/wow-skills-warlock.ts
  var W2 = "#9482C9";
  var WARLOCK_SKILLS = Object.freeze([
    {
      id: "shadowBolt",
      name: "Shadow Bolt",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 1.8,
      color: W2,
      targetMode: "enemy",
      range: 420,
      castTime: 1.7,
      description: "Hurl a bolt of shadow at your target.",
      execution: { kind: "projectile", speed: 700, radius: 10, offsets: [0], effects: { style: "shadow" } }
    },
    {
      id: "immolate",
      name: "Immolate",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0.9,
      color: W2,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Ignite your target, dealing fire damage plus further damage over 12 seconds.",
      execution: { kind: "strike", school: "fire", dot: { school: "fire", dpsMultiplier: 0.12, duration: 12 } }
    },
    {
      id: "corruption",
      name: "Corruption",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 1,
      color: W2,
      targetMode: "enemy",
      range: 420,
      description: "Corrupt your target, dealing shadow damage over 15 seconds.",
      execution: { kind: "dot", dot: { school: "shadow", dpsMultiplier: 0.18, duration: 15 } }
    },
    {
      id: "curseOfAgony",
      name: "Curse of Agony",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 1,
      color: W2,
      targetMode: "enemy",
      range: 420,
      description: "Curse your target with escalating agony, dealing shadow damage over 20 seconds.",
      execution: { kind: "dot", dot: { school: "shadow", dpsMultiplier: 0.1, duration: 20, ramp: 0.1 } }
    },
    {
      id: "unstableAffliction",
      name: "Unstable Affliction",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 1,
      color: W2,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Afflict your target with volatile shadow energy, dealing heavy damage over 12 seconds.",
      execution: { kind: "dot", dot: { school: "shadow", dpsMultiplier: 0.3, duration: 12 } }
    },
    {
      id: "drainLife",
      name: "Drain Life",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0.5,
      color: W2,
      targetMode: "enemy",
      range: 280,
      channel: { duration: 4, ticks: 4 },
      description: "Channel shadow for 4 seconds, draining life from your target to heal yourself.",
      execution: { kind: "channel", school: "shadow", ticks: 4, duration: 4, healFrac: 1 }
    },
    {
      id: "drainSoul",
      name: "Drain Soul",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 0.5,
      color: W2,
      targetMode: "enemy",
      range: 280,
      executeThreshold: 0.25,
      channel: { duration: 6, ticks: 4 },
      description: "Channel shadow for 6 seconds, dealing triple damage. Only usable on targets below 25% health.",
      execution: { kind: "channel", school: "shadow", ticks: 4, duration: 6, executeBonus: 2 }
    },
    {
      id: "searingPain",
      name: "Searing Pain",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 1.4,
      color: W2,
      targetMode: "enemy",
      range: 420,
      description: "Sear your target with agonizing fire.",
      execution: { kind: "strike", school: "fire" }
    },
    {
      id: "shadowburn",
      name: "Shadowburn",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 35,
      cooldown: 15,
      damageMultiplier: 1.9,
      color: W2,
      targetMode: "enemy",
      range: 420,
      executeThreshold: 0.2,
      shardCost: 1,
      description: "Spend a soul shard to blast your target with shadow. Only usable below 20% health.",
      execution: { kind: "strike", school: "shadow" }
    },
    {
      id: "chaosBolt",
      name: "Chaos Bolt",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 55,
      cooldown: 12,
      damageMultiplier: 2.6,
      color: W2,
      targetMode: "enemy",
      range: 420,
      castTime: 2,
      description: "Hurl a massive bolt of chaotic fire at your target.",
      execution: { kind: "projectile", speed: 700, radius: 12, offsets: [0], effects: { style: "fire" } }
    },
    {
      id: "conflagrate",
      name: "Conflagrate",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 10,
      damageMultiplier: 1.2,
      color: W2,
      targetMode: "enemy",
      range: 420,
      description: "Consume your Immolate on the target, bursting its remaining burn damage instantly.",
      execution: { kind: "strike", school: "fire", consumeDot: { school: "fire", multiplier: 0.6 } }
    },
    {
      id: "fear",
      name: "Fear",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 35,
      cooldown: 15,
      damageMultiplier: 0,
      color: W2,
      targetMode: "enemy",
      range: 280,
      castTime: 1.5,
      description: "Strike terror into your target, causing it to flee for 5 seconds.",
      execution: { kind: "cc", cc: "fear", duration: 5 }
    },
    {
      id: "howlOfTerror",
      name: "Howl of Terror",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 40,
      cooldown: 40,
      damageMultiplier: 0,
      color: W2,
      description: "A bloodcurdling howl that fears nearby enemies for 4 seconds.",
      execution: { kind: "cc", cc: "fear", duration: 4, radius: 120, maxTargets: 5 }
    },
    {
      id: "warlockDeathCoil",
      name: "Death Coil",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 35,
      cooldown: 120,
      damageMultiplier: 1,
      color: W2,
      targetMode: "enemy",
      range: 280,
      description: "Horrify your target for 2 seconds and restore health equal to 30% of the damage dealt.",
      execution: { kind: "strike", school: "shadow", stun: 2, healFrac: 0.3 }
    },
    {
      id: "lifeTap",
      name: "Life Tap",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      description: "Sacrifice your own health to restore 30% of your mana.",
      execution: { kind: "cleanse", hpCost: 0.15, resourceGainFrac: 0.3 }
    },
    {
      id: "felArmor",
      name: "Fel Armor",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 40,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      offGcd: true,
      description: "Demonic armor increases your armor and spell power and regenerates health for 10 minutes.",
      execution: { kind: "buff", buff: { duration: 600, exclusiveGroup: "armor", stats: { armor: 20, spellDamagePercent: 10 }, healPerSecond: 0.01 } }
    },
    {
      id: "summonImp",
      name: "Summon Imp",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 50,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      castTime: 3,
      description: "Summon an imp to fight at your side until dismissed or slain.",
      execution: { kind: "summon", ally: "imp", count: 1 }
    },
    {
      id: "summonFelguard",
      name: "Summon Felguard",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 80,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      castTime: 5,
      shardCost: 1,
      description: "Spend a soul shard to summon a felguard to fight at your side until dismissed or slain.",
      execution: { kind: "summon", ally: "felguard", count: 1 }
    },
    {
      id: "metamorphosis",
      name: "Metamorphosis",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 50,
      cooldown: 120,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      offGcd: true,
      description: "Transform into a demon, increasing all damage dealt by 20% for 30 seconds.",
      execution: { kind: "form", form: "metamorph", buff: { duration: 30, exclusiveGroup: "form", form: "metamorph", stats: { damagePercent: 20, spellDamagePercent: 20 } } }
    },
    {
      id: "seedOfCorruption",
      name: "Seed of Corruption",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 1,
      color: W2,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Plant a seed of corruption that detonates for half its remaining damage after 10 seconds.",
      execution: { kind: "dot", dot: { school: "shadow", dpsMultiplier: 0.15, duration: 10, detonate: 0.5 } }
    },
    {
      id: "rainOfFire",
      name: "Rain of Fire",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 45,
      cooldown: 0,
      damageMultiplier: 0.8,
      color: W2,
      targetMode: "point",
      range: 420,
      description: "Rain fire over the target area for 6 seconds.",
      execution: { kind: "ground", effect: "storm", radius: 120, delay: 0.3, duration: 6, interval: 1, style: "fire" }
    },
    {
      id: "shadowfury",
      name: "Shadowfury",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 40,
      cooldown: 20,
      damageMultiplier: 0.6,
      color: W2,
      targetMode: "point",
      range: 420,
      castTime: 0.5,
      description: "Unleash shadowfury at the target point, stunning enemies for 2 seconds.",
      execution: { kind: "cc", cc: "stun", duration: 2, radius: 80 }
    },
    {
      id: "curseOfElements",
      name: "Curse of the Elements",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0.5,
      color: W2,
      targetMode: "enemy",
      range: 420,
      description: "Curse your target, weakening its defenses so it takes increased damage.",
      execution: { kind: "strike", school: "shadow", sunder: 0.13 }
    },
    {
      id: "curseOfWeakness",
      name: "Curse of Weakness",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0.4,
      color: W2,
      targetMode: "enemy",
      range: 420,
      description: "Curse your target, sapping its strength and slowing its attacks.",
      execution: { kind: "strike", school: "shadow", slow: { duration: 10, factor: 0.8 } }
    },
    {
      id: "curseOfTongues",
      name: "Curse of Tongues",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "enemy",
      range: 420,
      description: "Curse your target to speak in demonic tongues, slowing its casting for 12 seconds.",
      execution: { kind: "cc", cc: "slow", duration: 12 }
    },
    {
      id: "curseOfDoom",
      name: "Curse of Doom",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 40,
      cooldown: 60,
      damageMultiplier: 1,
      color: W2,
      targetMode: "enemy",
      range: 420,
      description: "Doom your target, dealing massive shadow damage after 60 seconds.",
      execution: { kind: "dot", dot: { school: "shadow", dpsMultiplier: 0.6, duration: 60, interval: 60, detonate: 2.5 } }
    },
    {
      id: "demonArmor",
      name: "Demon Armor",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 40,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      offGcd: true,
      description: "Demonic armor increases your armor and shadow resistance for 10 minutes.",
      execution: { kind: "buff", buff: { duration: 600, exclusiveGroup: "armor", stats: { armor: 30, shadowResistance: 10 } } }
    },
    {
      id: "demonicCircle",
      name: "Demonic Circle: Teleport",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 30,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      description: "Teleport back to your demonic circle.",
      execution: { kind: "step", duration: 0.25, speed: 1400 }
    },
    {
      id: "demonicEmpowerment",
      name: "Demonic Empowerment",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 60,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      offGcd: true,
      description: "Empower your demon, increasing its damage by 50% for 15 seconds.",
      execution: { kind: "buff", buff: { duration: 15, allyDamage: 0.5 } }
    },
    {
      id: "felDomination",
      name: "Fel Domination",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 180,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      offGcd: true,
      description: "Dominate the summoning ritual, greatly hastening your casting for 15 seconds.",
      execution: { kind: "buff", buff: { duration: 15, stats: { castSpeedPercent: 50 } } }
    },
    {
      id: "soulLink",
      name: "Soul Link",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 40,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      offGcd: true,
      description: "Link your soul to your demon: damage taken is reduced and 20% is redirected to it for 10 minutes.",
      execution: { kind: "buff", buff: { duration: 600, reduction: 0.15, petShare: 0.2 } }
    },
    {
      id: "darkPact",
      name: "Dark Pact",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 0,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      description: "Drain mana from your demon, restoring 30% of your mana.",
      execution: { kind: "cleanse", resourceGainFrac: 0.3 }
    },
    {
      id: "soulshatter",
      name: "Soulshatter",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 0,
      cooldown: 180,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      offGcd: true,
      shardCost: 1,
      description: "Spend a soul shard to shatter your threat, dropping all enemy aggro.",
      execution: { kind: "stealth", duration: 3, dropAggro: true }
    },
    {
      id: "ritualOfSouls",
      name: "Ritual of Souls",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 60,
      cooldown: 300,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      castTime: 5,
      shardCost: 1,
      description: "Spend a soul shard to perform a ritual that bolsters your vitality for 5 minutes.",
      execution: { kind: "buff", buff: { duration: 300, stats: { maxHp: 25 } } }
    },
    {
      id: "ritualOfSummoning",
      name: "Ritual of Summoning",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 60,
      cooldown: 300,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      castTime: 5,
      shardCost: 1,
      description: "Spend a soul shard to open a portal that calls a demonic ally for 60 seconds.",
      execution: { kind: "summon", ally: "imp", count: 1, duration: 60 }
    },
    {
      id: "summonVoidwalker",
      name: "Summon Voidwalker",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      castTime: 5,
      shardCost: 1,
      description: "Spend a soul shard to summon a voidwalker to fight at your side until dismissed or slain.",
      execution: { kind: "summon", ally: "voidwalker", count: 1 }
    },
    {
      id: "summonSuccubus",
      name: "Summon Succubus",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      castTime: 5,
      shardCost: 1,
      description: "Spend a soul shard to summon a succubus to fight at your side until dismissed or slain.",
      execution: { kind: "summon", ally: "succubus", count: 1 }
    },
    {
      id: "summonFelhunter",
      name: "Summon Felhunter",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      castTime: 5,
      shardCost: 1,
      description: "Spend a soul shard to summon a felhunter to fight at your side until dismissed or slain.",
      execution: { kind: "summon", ally: "felhunter", count: 1 }
    },
    {
      id: "summonDoomguard",
      name: "Summon Doomguard",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 80,
      cooldown: 600,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      castTime: 5,
      shardCost: 1,
      description: "Spend a soul shard to summon a doomguard to fight for you for 5 minutes.",
      execution: { kind: "summon", ally: "infernal", count: 1, duration: 300 }
    },
    {
      id: "inferno",
      name: "Inferno",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 80,
      cooldown: 600,
      damageMultiplier: 0,
      color: W2,
      targetMode: "point",
      range: 420,
      castTime: 2,
      shardCost: 1,
      description: "Spend a soul shard to call an infernal down from the sky to fight for you for 60 seconds.",
      execution: { kind: "summon", ally: "infernal", count: 1, duration: 60 }
    },
    {
      id: "banish",
      name: "Banish",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Banish a demon or elemental, incapacitating it for 20 seconds. Damage breaks the effect.",
      execution: { kind: "cc", cc: "incapacitate", duration: 20 }
    },
    {
      id: "enslaveDemon",
      name: "Enslave Demon",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 40,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "enemy",
      range: 420,
      castTime: 2,
      description: "Enslave a demon, binding it to your will for 15 seconds.",
      execution: { kind: "cc", cc: "incapacitate", duration: 15 }
    },
    {
      id: "healthstone",
      name: "Healthstone",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      offGcd: true,
      description: "Consume a healthstone to restore 25% of your health.",
      execution: { kind: "heal", amount: 0, maxHpFrac: 0.25 }
    },
    {
      id: "soulstone",
      name: "Soulstone",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 50,
      cooldown: 600,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      castTime: 3,
      shardCost: 1,
      description: "Spend a soul shard to store your soul, warding you against death for 10 minutes.",
      execution: { kind: "buff", buff: { duration: 600, absorb: 0.15 } }
    },
    {
      id: "createSpellstone",
      name: "Create Spellstone",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 40,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      castTime: 3,
      description: "Create a spellstone that imbues your weapon with shadow damage and critical chance for 1 hour.",
      execution: { kind: "buff", buff: { duration: 3600, exclusiveGroup: "weaponStone", imbue: { element: "shadow", fraction: 0.15 }, stats: { critChance: 1 } } }
    },
    {
      id: "createFirestone",
      name: "Create Firestone",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 40,
      cooldown: 0,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      castTime: 3,
      description: "Create a firestone that imbues your weapon with fire damage for 1 hour.",
      execution: { kind: "buff", buff: { duration: 3600, exclusiveGroup: "weaponStone", imbue: { element: "fire", fraction: 0.15 }, stats: { spellDamagePercent: 3 } } }
    }
  ]);

  // src/wow-skills-druid.ts
  var D2 = "#FF7D0A";
  var DRUID_SKILLS = Object.freeze([
    {
      id: "wrath",
      name: "Wrath",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 1.4,
      color: D2,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Hurl a bolt of nature energy at your target.",
      execution: { kind: "projectile", speed: 460, radius: 6, offsets: [0], effects: { style: "lightning" } }
    },
    {
      id: "starfire",
      name: "Starfire",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 80,
      cooldown: 0,
      damageMultiplier: 2.8,
      color: D2,
      targetMode: "enemy",
      range: 420,
      castTime: 2.5,
      description: "Call down a bolt of stellar fire, causing heavy Arcane damage.",
      execution: { kind: "projectile", speed: 380, radius: 8, offsets: [0], effects: { style: "arcane" } }
    },
    {
      id: "moonfire",
      name: "Moonfire",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 1,
      color: D2,
      targetMode: "enemy",
      range: 420,
      description: "Burn your target with moonfire: Arcane damage plus damage over 12 seconds.",
      execution: { kind: "strike", school: "arcane", dot: { school: "arcane", dpsMultiplier: 0.15, duration: 12 } }
    },
    {
      id: "insectSwarm",
      name: "Insect Swarm",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 45,
      cooldown: 0,
      damageMultiplier: 0.4,
      color: D2,
      targetMode: "enemy",
      range: 420,
      description: "Swarm your target with insects, dealing Nature damage over 12 seconds.",
      execution: { kind: "dot", dot: { school: "nature", dpsMultiplier: 0.15, duration: 12 } }
    },
    {
      id: "entanglingRoots",
      name: "Entangling Roots",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "enemy",
      range: 420,
      castTime: 1.5,
      description: "Root your target in place for 6 seconds.",
      execution: { kind: "cc", cc: "root", duration: 6 }
    },
    {
      id: "hurricane",
      name: "Hurricane",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 90,
      cooldown: 12,
      damageMultiplier: 0.5,
      color: D2,
      targetMode: "point",
      range: 420,
      channel: { duration: 8, ticks: 8 },
      description: "Channel a hurricane onto the target area for 8 seconds, battering enemies with Nature damage.",
      execution: { kind: "ground", effect: "storm", radius: 140, delay: 0.3, duration: 8, interval: 1, style: "lightning" }
    },
    {
      id: "starfall",
      name: "Starfall",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 100,
      cooldown: 90,
      damageMultiplier: 0.6,
      color: D2,
      targetMode: "point",
      range: 420,
      description: "Call down a storm of stars for 10 seconds, striking enemies with Arcane damage.",
      execution: { kind: "ground", effect: "storm", radius: 160, delay: 0.3, duration: 10, interval: 1, style: "arcane", follow: true }
    },
    {
      id: "healingTouch",
      name: "Healing Touch",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      castTime: 2.5,
      description: "A slow, powerful heal that restores a large amount of health.",
      execution: { kind: "heal", amount: 3 }
    },
    {
      id: "regrowth",
      name: "Regrowth",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 55,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      castTime: 2,
      description: "Heal yourself, then continue healing over 15 seconds.",
      execution: { kind: "heal", amount: 1.6, hot: { perTick: 0.12, duration: 15 } }
    },
    {
      id: "rejuvenation",
      name: "Rejuvenation",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      description: "Restore health over 12 seconds.",
      execution: { kind: "hot", hot: { perTick: 0.15, duration: 12 } }
    },
    {
      id: "swiftmend",
      name: "Swiftmend",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 40,
      cooldown: 15,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      description: "Consume an active heal-over-time effect to instantly restore its remaining healing.",
      execution: { kind: "heal", amount: 2, consumeHot: 1 }
    },
    {
      id: "barkskin",
      name: "Barkskin",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 60,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      description: "Your skin hardens like bark, reducing all damage taken by 30% for 8 seconds.",
      execution: { kind: "buff", buff: { duration: 8, reduction: 0.3 } }
    },
    {
      id: "bearForm",
      name: "Bear Form",
      classId: "druid",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      description: "Shapeshift into a bear: armor and maximum health increased, and your attacks build rage.",
      execution: { kind: "form", form: "bear", buff: { duration: 3600, exclusiveGroup: "form", form: "bear", stats: { armor: 80, maxHp: 60 } } }
    },
    {
      id: "catForm",
      name: "Cat Form",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      description: "Shapeshift into a cat: your attacks use energy and combo points, and you can prowl.",
      execution: { kind: "form", form: "cat", buff: { duration: 3600, exclusiveGroup: "form", form: "cat", stats: { damagePercent: 10, critChance: 3 } } }
    },
    {
      id: "moonkinForm",
      name: "Moonkin Form",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      description: "Shapeshift into a moonkin: spell damage increased by 15% and armor increased.",
      execution: { kind: "form", form: "moonkin", buff: { duration: 3600, exclusiveGroup: "form", form: "moonkin", stats: { spellDamagePercent: 15, armor: 60 } } }
    },
    {
      id: "travelForm",
      name: "Travel Form",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      description: "Shapeshift into a swift travel form, increasing movement speed by 40%.",
      execution: { kind: "form", form: "travel", buff: { duration: 3600, exclusiveGroup: "form", form: "travel", stats: { moveSpeedPercent: 40 } } }
    },
    {
      id: "maul",
      name: "Maul",
      classId: "druid",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 1.6,
      color: D2,
      targetMode: "enemy",
      resource: "rage",
      requiresForm: "bear",
      description: "A mauling strike against your target. Bear Form only.",
      execution: { kind: "strike" }
    },
    {
      id: "swipe",
      name: "Swipe",
      classId: "druid",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 1,
      color: D2,
      resource: "rage",
      requiresForm: "bear",
      description: "Sweep your claws through all nearby enemies. Bear Form only.",
      execution: { kind: "radial", radius: 110, melee: true }
    },
    {
      id: "bash",
      name: "Bash",
      classId: "druid",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 10,
      cooldown: 60,
      damageMultiplier: 0.3,
      color: D2,
      targetMode: "enemy",
      resource: "rage",
      requiresForm: "bear",
      description: "Stun your target for 3 seconds. Bear Form only.",
      execution: { kind: "cc", cc: "stun", duration: 3 }
    },
    {
      id: "feralCharge",
      name: "Feral Charge",
      classId: "druid",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 15,
      damageMultiplier: 0.4,
      color: D2,
      targetMode: "enemy",
      range: 350,
      resource: "rage",
      requiresForm: "bear",
      description: "Rush your target, stunning it for 1 second. Bear Form only.",
      execution: { kind: "dash", duration: 0.3, speed: 900, radius: 24, stun: 1, toTarget: true }
    },
    {
      id: "mangle",
      name: "Mangle",
      classId: "druid",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 1.5,
      color: D2,
      targetMode: "enemy",
      resource: "energy",
      description: "Mangle your target, increasing its damage taken by 10% for 15 seconds. Bear or Cat Form.",
      execution: { kind: "strike", sunder: 0.1 }
    },
    {
      id: "claw",
      name: "Claw",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 45,
      cooldown: 0,
      damageMultiplier: 1.2,
      color: D2,
      targetMode: "enemy",
      resource: "energy",
      combo: "build",
      requiresForm: "cat",
      description: "Claw your target. Awards 1 combo point. Cat Form only.",
      execution: { kind: "comboStrike", build: 1 }
    },
    {
      id: "rake",
      name: "Rake",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 0.8,
      color: D2,
      targetMode: "enemy",
      resource: "energy",
      combo: "build",
      requiresForm: "cat",
      description: "Rake your target, causing bleeding damage over 9 seconds. Awards 1 combo point. Cat Form only.",
      execution: { kind: "comboStrike", build: 1, dot: { school: "bleed", dpsMultiplier: 0.15, duration: 9 } }
    },
    {
      id: "rip",
      name: "Rip",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0.4,
      color: D2,
      targetMode: "enemy",
      resource: "energy",
      combo: "spend",
      requiresForm: "cat",
      description: "Finishing move that makes your target bleed, longer per combo point spent. Cat Form only.",
      execution: { kind: "comboStrike", spend: true, dot: { school: "bleed", dpsMultiplier: 0.2, duration: 12 } }
    },
    {
      id: "ferociousBite",
      name: "Ferocious Bite",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 1.8,
      color: D2,
      targetMode: "enemy",
      resource: "energy",
      combo: "spend",
      requiresForm: "cat",
      description: "Finishing move that deals damage per combo point spent. Cat Form only.",
      execution: { kind: "comboStrike", spend: true }
    },
    {
      id: "prowl",
      name: "Prowl",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 0,
      cooldown: 10,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      requiresForm: "cat",
      description: "Enter stealth, becoming invisible to enemies beyond 25 units for 10 seconds. Cat Form only.",
      execution: { kind: "stealth", duration: 10 }
    },
    {
      id: "pounce",
      name: "Pounce",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 50,
      cooldown: 0,
      damageMultiplier: 0.5,
      color: D2,
      targetMode: "enemy",
      resource: "energy",
      combo: "build",
      requiresForm: "cat",
      requiresStealth: true,
      description: "Strike from stealth, stunning your target for 2 seconds. Awards 1 combo point. Cat Form only.",
      execution: { kind: "comboStrike", build: 1, requiresStealth: true, stunPerCombo: 2 }
    },
    {
      id: "faerieFire",
      name: "Faerie Fire",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0.3,
      color: D2,
      targetMode: "enemy",
      range: 420,
      description: "Wreathe your target in faerie light, increasing its damage taken by 5% for 15 seconds.",
      execution: { kind: "strike", sunder: 0.05 }
    },
    {
      id: "innervate",
      name: "Innervate",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 0,
      cooldown: 180,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      description: "Restore 10 mana per second for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, manaPerSecond: 10 } }
    },
    {
      id: "nourish",
      name: "Nourish",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 18,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      castTime: 1.5,
      description: "A quick heal that restores a moderate amount of health, empowered by your heal-over-time effects.",
      execution: { kind: "heal", amount: 1.8 }
    },
    {
      id: "wildGrowth",
      name: "Wild Growth",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 70,
      cooldown: 8,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      description: "Healing energy blossoms around you, restoring health over 7 seconds.",
      execution: { kind: "hot", hot: { perTick: 0.2, duration: 7 } }
    },
    {
      id: "lifebloom",
      name: "Lifebloom",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 28,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      description: "A blooming heal that restores health over 9 seconds, flowering as it matures.",
      execution: { kind: "hot", hot: { perTick: 0.12, duration: 9 }, maxHpFrac: 0.08 }
    },
    {
      id: "tranquility",
      name: "Tranquility",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 120,
      cooldown: 480,
      damageMultiplier: 1,
      color: D2,
      targetMode: "self",
      channel: { duration: 8, ticks: 8 },
      description: "Channel a soothing rain for 8 seconds, mending your wounds each second.",
      execution: { kind: "channel", school: "nature", ticks: 8, duration: 8, healFrac: 1.5 }
    },
    {
      id: "rebirth",
      name: "Rebirth",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 80,
      cooldown: 600,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      castTime: 2,
      description: "Return from death's door, restoring 60% of your maximum health.",
      execution: { kind: "heal", amount: 0, maxHpFrac: 0.6 }
    },
    {
      id: "revive",
      name: "Revive",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      castTime: 10,
      description: "Recover from a near-fatal state, restoring 35% of your maximum health.",
      execution: { kind: "heal", amount: 0, maxHpFrac: 0.35 }
    },
    {
      id: "abolishPoison",
      name: "Abolish Poison",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      description: "Abolish the poison coursing through your body, shedding harmful effects.",
      execution: { kind: "cleanse", removeCc: true }
    },
    {
      id: "removeCurseDruid",
      name: "Remove Curse",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 20,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      description: "Lift a curse from yourself, shedding harmful effects.",
      execution: { kind: "cleanse", removeCc: true }
    },
    {
      id: "naturesGrasp",
      name: "Nature's Grasp",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "basic",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      description: "Thorny vines answer your attackers, reflecting 50% of damage for 45 seconds.",
      execution: { kind: "buff", buff: { duration: 45, reflect: 0.5 } }
    },
    {
      id: "cyclone",
      name: "Cyclone",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "enemy",
      range: 280,
      castTime: 1.5,
      description: "Hurl your target into the air on a violent cyclone, incapacitating it for 6 seconds.",
      execution: { kind: "cc", cc: "incapacitate", duration: 6 }
    },
    {
      id: "typhoon",
      name: "Typhoon",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "advanced",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0.8,
      color: D2,
      description: "Summon a violent typhoon that knocks back and slows nearby enemies for 3 seconds.",
      execution: { kind: "radial", radius: 130, melee: false, slow: { duration: 3, factor: 0.5 }, style: "lightning" }
    },
    {
      id: "forceOfNature",
      name: "Force of Nature",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 60,
      cooldown: 180,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      description: "Call three treants to fight at your side for 30 seconds.",
      execution: { kind: "summon", ally: "wolf", count: 3, duration: 30 }
    },
    {
      id: "savageRoar",
      name: "Savage Roar",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 25,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      resource: "energy",
      combo: "spend",
      requiresForm: "cat",
      description: "Finishing move that increases your damage by 30% for 30 seconds. Cat Form only.",
      execution: { kind: "comboStrike", spend: true, buffPerCombo: { duration: 30, stats: { damagePercent: 30 } } }
    },
    {
      id: "shred",
      name: "Shred",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 2.25,
      color: D2,
      targetMode: "enemy",
      resource: "energy",
      combo: "build",
      requiresForm: "cat",
      requiresBehind: true,
      description: "Shred your target from behind. Awards 1 combo point. Cat Form only.",
      execution: { kind: "comboStrike", build: 1, requiresBehind: true }
    },
    {
      id: "ravage",
      name: "Ravage",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 60,
      cooldown: 0,
      damageMultiplier: 2.6,
      color: D2,
      targetMode: "enemy",
      resource: "energy",
      combo: "build",
      requiresForm: "cat",
      requiresStealth: true,
      description: "Ravage your target from stealth. Awards 1 combo point. Cat Form only.",
      execution: { kind: "comboStrike", build: 1, requiresStealth: true }
    },
    {
      id: "tigersFury",
      name: "Tiger's Fury",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 0,
      cooldown: 30,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      resource: "energy",
      requiresForm: "cat",
      description: "Restore 60 energy and increase your damage by 15% for 6 seconds. Cat Form only.",
      execution: { kind: "buff", buff: { duration: 6, stats: { damagePercent: 15 }, resourcePerSecond: 10 } }
    },
    {
      id: "berserk",
      name: "Berserk",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "ultimate",
      manaCost: 0,
      cooldown: 180,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      requiresForm: "cat",
      description: "Enter a feral frenzy, increasing your damage by 25% and regenerating energy for 15 seconds. Cat Form only.",
      execution: { kind: "buff", buff: { duration: 15, stats: { damagePercent: 25 }, resourcePerSecond: 10 } }
    },
    {
      id: "survivalInstincts",
      name: "Survival Instincts",
      classId: "druid",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 0,
      cooldown: 180,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      resource: "rage",
      requiresForm: "bear",
      description: "Survival instincts reduce all damage taken by 30% for 20 seconds. Bear Form only.",
      execution: { kind: "buff", buff: { duration: 20, reduction: 0.3 } }
    },
    {
      id: "frenziedRegeneration",
      name: "Frenzied Regeneration",
      classId: "druid",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 15,
      cooldown: 180,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      resource: "rage",
      requiresForm: "bear",
      description: "Convert rage into health, restoring 3% of your maximum health per second for 10 seconds. Bear Form only.",
      execution: { kind: "buff", buff: { duration: 10, healPerSecond: 0.03 } }
    },
    {
      id: "growl",
      name: "Growl",
      classId: "druid",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 10,
      damageMultiplier: 0,
      color: D2,
      targetMode: "enemy",
      range: 420,
      resource: "rage",
      requiresForm: "bear",
      description: "Growl at your target, forcing it to attack you for 3 seconds. Bear Form only.",
      execution: { kind: "taunt", duration: 3 }
    },
    {
      id: "challengingRoar",
      name: "Challenging Roar",
      classId: "druid",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 15,
      cooldown: 180,
      damageMultiplier: 0.2,
      color: D2,
      resource: "rage",
      requiresForm: "bear",
      description: "A challenging roar that strikes all nearby enemies, forcing them to engage you. Bear Form only.",
      execution: { kind: "radial", radius: 140, melee: true }
    },
    {
      id: "demoralizingRoar",
      name: "Demoralizing Roar",
      classId: "druid",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 10,
      cooldown: 0,
      damageMultiplier: 0.2,
      color: D2,
      resource: "rage",
      requiresForm: "bear",
      description: "A demoralizing roar that weakens all nearby enemies for 10 seconds. Bear Form only.",
      execution: { kind: "radial", radius: 140, melee: true, slow: { duration: 10, factor: 0.85 } }
    },
    {
      id: "lacerate",
      name: "Lacerate",
      classId: "druid",
      requirement: "any",
      domain: "Might",
      tier: "advanced",
      manaCost: 15,
      cooldown: 0,
      damageMultiplier: 0.8,
      color: D2,
      targetMode: "enemy",
      resource: "rage",
      requiresForm: "bear",
      description: "Lacerate your target, causing it to bleed over 15 seconds. Bear Form only.",
      execution: { kind: "strike", dot: { school: "bleed", dpsMultiplier: 0.15, duration: 15 } }
    },
    {
      id: "enrage",
      name: "Enrage",
      classId: "druid",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 60,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      resource: "rage",
      requiresForm: "bear",
      description: "Enrage, generating 20 rage over 10 seconds. Bear Form only.",
      execution: { kind: "buff", buff: { duration: 10, resourcePerSecond: 2 } }
    },
    {
      id: "dash",
      name: "Dash",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 0,
      cooldown: 180,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      requiresForm: "cat",
      description: "Dash, increasing your movement speed by 70% for 15 seconds. Cat Form only.",
      execution: { kind: "buff", buff: { duration: 15, stats: { moveSpeedPercent: 70 } } }
    },
    {
      id: "aquaticForm",
      name: "Aquatic Form",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "basic",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      description: "Shapeshift into an aquatic form, increasing swim speed by 50% and allowing underwater breathing.",
      execution: { kind: "form", form: "travel", buff: { duration: 3600, exclusiveGroup: "form", form: "travel", stats: { moveSpeedPercent: 50 } } }
    },
    {
      id: "flightForm",
      name: "Flight Form",
      classId: "druid",
      requirement: "any",
      domain: "Cunning",
      tier: "advanced",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      description: "Shapeshift into flight form, increasing movement speed by 150% while outdoors.",
      execution: { kind: "form", form: "travel", buff: { duration: 3600, exclusiveGroup: "form", form: "travel", stats: { moveSpeedPercent: 150 } } }
    },
    {
      id: "treeOfLife",
      name: "Tree of Life",
      classId: "druid",
      requirement: "any",
      domain: "Arcana",
      tier: "ultimate",
      manaCost: 30,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      offGcd: true,
      description: "Shapeshift into the Tree of Life, increasing healing done by 15% and regenerating health.",
      execution: { kind: "form", form: "moonkin", buff: { duration: 3600, exclusiveGroup: "form", form: "moonkin", healPerSecond: 0.01, stats: { spellDamagePercent: 15 } } }
    }
  ]);

  // src/wow-skills-racial.ts
  var RACIAL_SKILLS = Object.freeze([
    {
      id: "everyMan",
      name: "Every Man for Himself",
      raceId: "human",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: "#e8c05a",
      targetMode: "self",
      offGcd: true,
      description: "Break all stuns, roots and control effects, and take 30% less damage for 2 seconds.",
      execution: { kind: "cleanse", removeCc: true, buff: { duration: 2, reduction: 0.3 } }
    },
    {
      id: "stoneform",
      name: "Stoneform",
      raceId: "dwarf",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: "#c9a86a",
      targetMode: "self",
      offGcd: true,
      description: "Harden your skin: shed control effects and take 25% less damage for 8 seconds.",
      execution: { kind: "cleanse", removeCc: true, buff: { duration: 8, reduction: 0.25 } }
    },
    {
      id: "shadowmeld",
      name: "Shadowmeld",
      raceId: "nightElf",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: "#8a9fd8",
      targetMode: "self",
      offGcd: true,
      description: "Fade into shadow for 6 seconds, hidden from distant enemies.",
      execution: { kind: "stealth", duration: 6 }
    },
    {
      id: "escapeArtist",
      name: "Escape Artist",
      raceId: "gnome",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 105,
      damageMultiplier: 0,
      color: "#e08fb8",
      targetMode: "self",
      offGcd: true,
      description: "Slip free of roots, slows and control effects, moving 30% faster for 3 seconds.",
      execution: { kind: "cleanse", removeCc: true, buff: { duration: 3, stats: { moveSpeedPercent: 30 } } }
    },
    {
      id: "giftNaaru",
      name: "Gift of the Naaru",
      raceId: "draenei",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 180,
      damageMultiplier: 0,
      color: "#7fb8e8",
      targetMode: "self",
      offGcd: true,
      description: "Blessed light restores 20% of your maximum life over 5 seconds.",
      execution: { kind: "hot", maxHpFrac: 0.2, hot: { perTick: 0.2, duration: 5, interval: 1 } }
    },
    {
      id: "bloodFury",
      name: "Blood Fury",
      raceId: "orc",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: "#d85a3a",
      targetMode: "self",
      offGcd: true,
      description: "Unleash your fury: +15% damage for 15 seconds.",
      execution: { kind: "buff", buff: { duration: 15, stats: { damagePercent: 15, spellDamagePercent: 15 } } }
    },
    {
      id: "willForsaken",
      name: "Will of the Forsaken",
      raceId: "undead",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: "#7a9a8a",
      targetMode: "self",
      offGcd: true,
      description: "Shake off fear and all control effects, taking 30% less damage for 2 seconds.",
      execution: { kind: "cleanse", removeCc: true, buff: { duration: 2, reduction: 0.3 } }
    },
    {
      id: "warStomp",
      name: "War Stomp",
      raceId: "tauren",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: "#c98a4a",
      targetMode: "self",
      offGcd: true,
      description: "Stomp the ground, stunning nearby enemies for 1.5 seconds.",
      execution: { kind: "cc", cc: "stun", duration: 1.5, radius: 100 }
    },
    {
      id: "berserking",
      name: "Berserking",
      raceId: "troll",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 180,
      damageMultiplier: 0,
      color: "#4ac8a0",
      targetMode: "self",
      offGcd: true,
      description: "Enter a frenzy: +20% attack and cast speed for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, stats: { attackSpeedPercent: 20, castSpeedPercent: 20 } } }
    },
    {
      id: "arcaneTorrent",
      name: "Arcane Torrent",
      raceId: "bloodElf",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 120,
      damageMultiplier: 0,
      color: "#e87ad0",
      targetMode: "self",
      offGcd: true,
      description: "Silence nearby enemies for 2 seconds and restore 15 resource.",
      execution: { kind: "cc", cc: "silence", duration: 2, radius: 100, resourceGain: 15 }
    }
  ]);

  // src/wow-skills.ts
  var WOW_SKILLS = Object.freeze([
    ...WARRIOR_SKILLS,
    ...PALADIN_SKILLS,
    ...HUNTER_SKILLS,
    ...ROGUE_SKILLS,
    ...PRIEST_SKILLS,
    ...DEATHKNIGHT_SKILLS,
    ...SHAMAN_SKILLS,
    ...MAGE_SKILLS,
    ...WARLOCK_SKILLS,
    ...DRUID_SKILLS,
    ...RACIAL_SKILLS
  ]);
  var WOW_CLASS_SKILLS = Object.freeze({
    warrior: WARRIOR_SKILLS,
    paladin: PALADIN_SKILLS,
    hunter: HUNTER_SKILLS,
    rogue: ROGUE_SKILLS,
    priest: PRIEST_SKILLS,
    deathKnight: DEATHKNIGHT_SKILLS,
    shaman: SHAMAN_SKILLS,
    mage: MAGE_SKILLS,
    warlock: WARLOCK_SKILLS,
    druid: DRUID_SKILLS
  });
  var WOW_RACIAL_SKILLS = Object.freeze(
    Object.fromEntries(RACIAL_SKILLS.map((s) => [s.raceId, s]))
  );

  // src/skill-content.ts
  var SKILL_DEFINITIONS = Object.freeze({
    ...Object.fromEntries(AURA_IDS.map((id) => [id, Object.freeze({ id, name: AURAS[id].name, description: AURAS[id].description, requirement: "any", domain: AURAS[id].domain, tier: "aura", manaCost: 0, cooldown: 0, damageMultiplier: 0, color: AURAS[id].color })])),
    repulse: Object.freeze({ id: "repulse", name: "Repulse", description: "Damage and stun enemies in a broad shield shockwave.", requirement: "shield", domain: "Might", tier: "advanced", manaCost: 18, cooldown: 5, damageMultiplier: 1.65, color: "#e5bd80" }),
    ironCitadel: Object.freeze({ id: "ironCitadel", name: "Iron Citadel", description: "Strike surrounding enemies, then gain damage reduction.", requirement: "shield", domain: "Might", tier: "ultimate", manaCost: 34, cooldown: 28, damageMultiplier: 2.4, color: "#f0d5a2" }),
    smokeVeil: Object.freeze({ id: "smokeVeil", name: "Smoke Veil", description: "Slow surrounding enemies and gain damage reduction. Deals no damage.", requirement: "any", domain: "Cunning", tier: "advanced", manaCost: 15, cooldown: 9, damageMultiplier: 0, color: "#9bbfc6" }),
    nightReaping: Object.freeze({ id: "nightReaping", name: "Night Reaping", description: "Strike nearby enemies with your dagger. Rear strikes deal more damage.", requirement: "dagger", domain: "Cunning", tier: "ultimate", manaCost: 36, cooldown: 28, damageMultiplier: 2.2, color: "#b9e3d6" }),
    sidestep: Object.freeze({ id: "sidestep", name: "Sidestep", description: "Step toward your aim. Terrain blocks movement; grants no invulnerability.", requirement: "any", domain: "Cunning", tier: "advanced", manaCost: 6, cooldown: 3.5, damageMultiplier: 0, color: "#b5cbb8" }),
    brace: Object.freeze({ id: "brace", name: "Brace", description: "Gain temporary damage reduction. No shield required.", requirement: "any", domain: "Might", tier: "advanced", manaCost: 11, cooldown: 8, damageMultiplier: 0, color: "#cfb88f" }),
    runicWard: Object.freeze({ id: "runicWard", name: "Runic Ward", description: "Create a Ward that absorbs incoming damage. Does not stack.", requirement: "magic", domain: "Arcana", tier: "advanced", manaCost: 17, cooldown: 10, damageMultiplier: 0, color: "#9ed6d5" }),
    vaultingShot: Object.freeze({ id: "vaultingShot", name: "Vaulting Shot", description: "Fire an arrow while retreating. Grants no invulnerability.", requirement: "bow", domain: "Cunning", tier: "advanced", manaCost: 17, cooldown: 6, damageMultiplier: 1.2, color: "#a7c897" }),
    rallyOfIron: Object.freeze({ id: "rallyOfIron", name: "Rally of Iron", description: "Gain damage reduction and empower your next melee actions.", requirement: "melee", domain: "Might", tier: "ultimate", manaCost: 32, cooldown: 24, damageMultiplier: 0, color: "#d4a677" }),
    ghostHunt: Object.freeze({ id: "ghostHunt", name: "Ghost Hunt", description: "Your next arrow actions release delayed echoes.", requirement: "bow", domain: "Cunning", tier: "ultimate", manaCost: 30, cooldown: 24, damageMultiplier: 0, color: "#c5dbc7" }),
    cataclysm: Object.freeze({ id: "cataclysm", name: "Cataclysm", description: "Meteors strike a wide area and leave burning ground.", requirement: "magic", domain: "Arcana", tier: "ultimate", manaCost: 80, cooldown: 30, damageMultiplier: 2.8, color: "#ffa46b" }),
    tempest: Object.freeze({ id: "tempest", name: "Tempest", description: "A moving storm strikes nearby enemies. Mana exhaustion ends it.", requirement: "magic", domain: "Arcana", tier: "ultimate", manaCost: 35, cooldown: 24, damageMultiplier: 0.65, color: "#c4c4ff" }),
    absoluteZero: Object.freeze({ id: "absoluteZero", name: "Absolute Zero", description: "Freezing waves damage and slow surrounding enemies.", requirement: "magic", domain: "Arcana", tier: "ultimate", manaCost: 75, cooldown: 28, damageMultiplier: 2.4, color: "#b7efff" }),
    cleave: Object.freeze({ id: "cleave", name: "Crescent Cleave", description: "Sweep a broad crescent, striking each enemy once.", requirement: "melee", domain: "Might", tier: "basic", manaCost: 9, cooldown: 0, damageMultiplier: 1.8, color: "#e6bd7b" }),
    lunge: Object.freeze({ id: "lunge", name: "Rift Lunge", description: "Dash forward, cutting enemies along your path.", requirement: "blade", domain: "Might", tier: "advanced", manaCost: 18, cooldown: 4, damageMultiplier: 1.5, color: "#add9ca" }),
    whirlwind: Object.freeze({ id: "whirlwind", name: "Whirlwind", description: "Sweep a full circle, striking surrounding enemies.", requirement: "melee", domain: "Might", tier: "basic", manaCost: 9, cooldown: 0, damageMultiplier: 1.6, color: "#d8c28c" }),
    earthshatter: Object.freeze({ id: "earthshatter", name: "Earthshatter", description: "Slam the ground to damage and stun nearby enemies.", requirement: "heavy", domain: "Might", tier: "advanced", manaCost: 27, cooldown: 6, damageMultiplier: 2.6, color: "#d9a077" }),
    shieldBash: Object.freeze({ id: "shieldBash", name: "Shield Bash", description: "Damage and stun enemies in front of your shield.", requirement: "shield", domain: "Might", tier: "basic", manaCost: 8, cooldown: 0, damageMultiplier: 1.35, color: "#b7c9bf" }),
    bulwark: Object.freeze({ id: "bulwark", name: "Bulwark", description: "Raise your shield to block incoming hits.", requirement: "shield", domain: "Might", tier: "advanced", manaCost: 24, cooldown: 8, damageMultiplier: 0, color: "#b8ccdb" }),
    volley: Object.freeze({ id: "volley", name: "Thorn Volley", description: "Fire arrows in a spreading fan.", requirement: "bow", domain: "Cunning", tier: "basic", manaCost: 8, cooldown: 0, damageMultiplier: 0.8, color: "#a6ce9d" }),
    piercingShot: Object.freeze({ id: "piercingShot", name: "Piercing Shot", description: "Fire a powerful arrow that pierces enemies in a line.", requirement: "bow", domain: "Cunning", tier: "advanced", manaCost: 21, cooldown: 3.5, damageMultiplier: 1.6, color: "#d0d7a1" }),
    ricochet: Object.freeze({ id: "ricochet", name: "Ricochet", description: "Fire an arrow that rebounds between nearby enemies.", requirement: "bow", domain: "Cunning", tier: "basic", manaCost: 9, cooldown: 0, damageMultiplier: 1.2, color: "#c0dca6" }),
    rainOfArrows: Object.freeze({ id: "rainOfArrows", name: "Rain of Arrows", description: "Waves of arrows strike the targeted area after a delay.", requirement: "bow", domain: "Cunning", tier: "advanced", manaCost: 27, cooldown: 6, damageMultiplier: 0.7, color: "#b7c49a" }),
    backstab: Object.freeze({ id: "backstab", name: "Backstab", description: "Thrust your dagger. Rear strikes deal more damage.", requirement: "dagger", domain: "Cunning", tier: "basic", manaCost: 8, cooldown: 0, damageMultiplier: 2.1, color: "#d1b2c3" }),
    fireball: Object.freeze({ id: "fireball", name: "Fireball", description: "Explodes on impact, damaging and applying Burn to nearby enemies.", requirement: "magic", domain: "Arcana", tier: "basic", manaCost: 12, cooldown: 0, damageMultiplier: 1.45, color: "#f4a271" }),
    arcLightning: Object.freeze({ id: "arcLightning", name: "Arc Lightning", description: "Lightning chains through nearby enemies, weakening with each jump.", requirement: "magic", domain: "Arcana", tier: "basic", manaCost: 12, cooldown: 0, damageMultiplier: 1.4, color: "#c4c4ff" }),
    iceNova: Object.freeze({ id: "iceNova", name: "Ice Nova", description: "Damage and slow surrounding enemies with a frost nova.", requirement: "magic", domain: "Arcana", tier: "basic", manaCost: 14, cooldown: 0, damageMultiplier: 1.5, color: "#a5dbe7" }),
    frostLance: Object.freeze({ id: "frostLance", name: "Frost Lance", description: "Fire a piercing ice shard that slows its targets.", requirement: "magic", domain: "Arcana", tier: "advanced", manaCost: 28, cooldown: 1.8, damageMultiplier: 1.65, color: "#c1e8f0" }),
    meteor: Object.freeze({ id: "meteor", name: "Meteor", description: "A delayed meteor explodes at your aim and leaves burning ground.", requirement: "magic", domain: "Arcana", tier: "advanced", manaCost: 40, cooldown: 7, damageMultiplier: 3.4, color: "#ef946a" }),
    siphon: Object.freeze({ id: "siphon", name: "Soul Siphon", description: "Fire a spirit that restores life from actual impact damage.", requirement: "magic", domain: "Arcana", tier: "advanced", manaCost: 30, cooldown: 4.5, damageMultiplier: 1.65, color: "#dba3c3" }),
    // WoW class kits + racial actives (docs/wow-transformation.md §4); execution recipes live in SKILL_EXECUTION.
    ...Object.fromEntries(WOW_SKILLS.map(({ execution: _execution, ...definition }) => [definition.id, Object.freeze(definition)]))
  });
  var REQUIREMENT_LABELS = Object.freeze({
    any: "Any weapon",
    melee: "Melee weapon",
    blade: "Sword, axe or dagger",
    heavy: "Axe or mace",
    dagger: "Dagger",
    bow: "Bow",
    magic: "Staff or wand",
    shield: "Equipped shield"
  });

  // src/equipment-affix-content.ts
  var SKILL_STATS = Object.freeze(Object.fromEntries(Object.values(SKILL_DEFINITIONS).map((s) => [`skill:${s.id}`, `${s.name} ranks`])));
  var SKILL_AFFIXES = Object.freeze(Object.values(SKILL_DEFINITIONS).filter((s) => s.tier !== "aura").map((s) => Object.freeze({ name: s.name, stat: `skill:${s.id}`, base: 1, growth: 0 })));
  var SPECIAL_AFFIXES = Object.freeze([
    { name: "Wellsip", stat: "manaOnKill", base: 1, growth: 0.04, weight: 1 },
    { name: "Expanse", stat: "areaPercent", base: 10, growth: 0.3, weight: 0.55 },
    { name: "Deep Draught", stat: "potionPercent", base: 12, growth: 0.35, weight: 1 },
    { name: "Piercing", stat: "projectilePierce", base: 1, growth: 0, weight: 0.12 },
    { name: "Spellweave", stat: "spellweavePercent", base: 16, growth: 0.4, weight: 0.18 },
    { name: "Afterguard", stat: "afterguardPercent", base: 20, growth: 0.5, weight: 0.55 }
  ].map((a) => Object.freeze(a)));
  var SPECIAL_AFFIX_LABELS = Object.freeze({
    manaOnKill: "Mana on kill",
    areaPercent: "Area of effect",
    potionPercent: "Potion restoration",
    projectilePierce: "Projectile pierce",
    spellweavePercent: "Spellweave damage",
    afterguardPercent: "Armor after blocking"
  });
  var AFFIX_COMBAT_RULES = Object.freeze({ weaveDuration: 4, guardDuration: 3, maxBonusRanks: 10, maxPierce: 4, maxAreaPercent: 100 });
  var SKILL_RANK_ROLLS = Object.freeze([
    { rank: 1, minimumLevel: 1, cumulative: 0.88 },
    { rank: 2, minimumLevel: 12, cumulative: 0.98 },
    { rank: 3, minimumLevel: 30, cumulative: 0.997 },
    { rank: 4, minimumLevel: 55, cumulative: 0.9997 },
    { rank: 5, minimumLevel: 80, cumulative: 1 }
  ].map((r) => Object.freeze(r)));

  // src/skill-execution-content.ts
  var GROUND_EFFECT_RULES = Object.freeze({ maximum: 16, minimumInterval: 0.05 });
  var CHAIN_SUSTAIN = Object.freeze({ subsequentTarget: 0.25 });
  var SKILL_TARGETING = Object.freeze({
    maximumRange: 900,
    probeStep: 4,
    probeRadius: 1,
    minimumProjectileLife: 0.1,
    blastDuration: 0.45
  });
  var SKILL_EXECUTION = {
    ...Object.fromEntries(AURA_IDS.map((id) => [id, { kind: "aura", aura: id, rank: 1 }])),
    repulse: { kind: "cone", radius: 95, arc: Math.PI * 1.5, stun: 1.2 },
    ironCitadel: { kind: "radial", radius: 130, melee: true, shelter: { duration: 5, reduction: 0.45 } },
    smokeVeil: { kind: "radial", radius: 115, melee: false, style: "spirit", slow: { duration: 3, factor: 0.5 }, shelter: { duration: 2, reduction: 0.2 } },
    nightReaping: { kind: "backstab", minRange: 160, reachMultiplier: 2, arc: Math.PI * 2, rearAngle: Math.PI * 0.6, rearMultiplier: 2, targets: 5 },
    sidestep: { kind: "step", duration: 0.22, speed: 720 },
    brace: { kind: "stance", duration: 2, reduction: 0.2, charges: 0, bonus: 0 },
    runicWard: { kind: "ward", duration: 4, fraction: 0.18 },
    vaultingShot: { kind: "step", duration: 0.24, speed: 440, retreat: true, shot: true },
    rallyOfIron: { kind: "stance", duration: 6, reduction: 0.25, charges: 3, bonus: 0.35 },
    ghostHunt: { kind: "stance", duration: 6, reduction: 0, charges: 3, bonus: 0.6, echo: true },
    cataclysm: { kind: "ground", effect: "meteor", radius: 105, delay: 1, duration: 0, interval: 0.5, style: "fire", scatter: 7, scorch: { duration: 4, interval: 0.25, damageMultiplier: 0.12 }, burn: { duration: 3, damageMultiplier: 0.12 } },
    tempest: { kind: "ground", effect: "storm", radius: 195, delay: 0.4, duration: 6, interval: 0.5, style: "lightning", follow: true },
    absoluteZero: { kind: "ground", effect: "frost", radius: 240, delay: 0.5, duration: 1.3, interval: 1.2, style: "frost", slow: { duration: 4, factor: 0.25 }, stun: 1.5 },
    cleave: { kind: "sweep", reachMultiplier: 1.4, arc: Math.PI * 1.4 },
    whirlwind: { kind: "sweep", reachMultiplier: 1.25, arc: Math.PI * 2 },
    lunge: { kind: "dash", duration: 0.24, speed: 520, radius: 23 },
    earthshatter: { kind: "radial", radius: 125, melee: true, stun: 1.2 },
    shieldBash: { kind: "cone", radius: 68, arc: Math.PI * 0.7, stun: 1.1 },
    bulwark: { kind: "guard", duration: 3, reduction: 0.75 },
    backstab: { kind: "backstab", minRange: 48, reachMultiplier: 1.25, arc: Math.PI / 2, rearAngle: Math.PI * 0.6, rearMultiplier: 2 },
    volley: { kind: "projectile", speed: 550, radius: 3, offsets: [-0.23, 0, 0.23], effects: { style: "arrow" } },
    piercingShot: { kind: "projectile", speed: 680, radius: 3, offsets: [0], effects: { style: "arrow", pierce: 3 } },
    ricochet: { kind: "projectile", speed: 530, radius: 3, offsets: [0], effects: { style: "arrow", chain: 3, chainRange: 150 } },
    rainOfArrows: { kind: "ground", effect: "arrowRain", radius: 92, delay: 0.4, duration: 1.2, interval: 0.3, style: "arrow" },
    fireball: { kind: "projectile", speed: 320, radius: 5, offsets: [0], effects: { style: "fire", blastRadius: 85, burnDuration: 3, burnDamageMultiplier: 0.12 } },
    frostLance: { kind: "projectile", speed: 440, radius: 5, offsets: [0], effects: { style: "frost", pierce: 3, slowFactor: 0.5, slowDuration: 2.5 } },
    siphon: { kind: "projectile", speed: 350, radius: 5, offsets: [0], effects: { style: "spirit", lifeSteal: 0.35 } },
    iceNova: { kind: "radial", radius: 115, melee: false, slow: { duration: 2.5, factor: 0.5 }, style: "frost" },
    meteor: { kind: "ground", effect: "meteor", radius: 125, delay: 0.85, duration: 0, interval: 1, style: "fire", scorch: { duration: 4, interval: 0.25, damageMultiplier: 0.12 }, burn: { duration: 3, damageMultiplier: 0.12 } },
    // WoW class kits + racial actives (docs/wow-transformation.md §4).
    ...Object.fromEntries(WOW_SKILLS.map(({ execution, id }) => [id, execution])),
    arcLightning: { kind: "chain", jumps: 5, range: 145, falloff: 0.78, duration: 0.28, style: "lightning" }
  };
  function freeze(value) {
    Object.freeze(value);
    for (const child of Object.values(value)) if (child && typeof child === "object") freeze(child);
  }
  freeze(SKILL_EXECUTION);

  // src/wow-types.ts
  var WOW_CLASS_IDS = Object.freeze([
    "warrior",
    "paladin",
    "hunter",
    "rogue",
    "priest",
    "deathKnight",
    "shaman",
    "mage",
    "warlock",
    "druid"
  ]);
  var WOW_RACE_IDS = Object.freeze([
    "human",
    "dwarf",
    "nightElf",
    "gnome",
    "draenei",
    "orc",
    "undead",
    "tauren",
    "troll",
    "bloodElf"
  ]);
  var TAB_TARGETING = Object.freeze({
    coneHalfNear: 45 * Math.PI / 180,
    coneHalfFar: 60 * Math.PI / 180,
    nearRadius: 420,
    queryRadius: 700,
    meleeEngagedRadius: 80
  });
  var WOW_COMBAT = Object.freeze({
    gcdDefault: 1.5,
    gcdRogueCat: 1,
    castMoveFactor: 0.45,
    rageDecayDelay: 8,
    runeRecharge: 10,
    runicPowerPerRune: 10,
    maxComboPoints: 5,
    maxSoulShards: 4,
    maxAllies: 6,
    allyLeash: 70,
    stealthSenseRadius: 25
  });

  // src/skill-progression.ts
  var SKILL_RANK_RULES = Object.freeze({
    maximum: 20,
    mana: 0.015,
    duration: 0.05,
    stepSpeed: 0.02,
    protection: 35e-4,
    wardCapacity: 35e-4,
    empowerment: 0.05
  });
  var SKILL_DAMAGE_RANK_RULES = Object.freeze({ purchased: 0.05, bonus: 0.12, bonusKnee: 3, bonusTail: 0.05 });
  var spec = (id, skill, name, description, mana, damage = 1, cooldown = 1, modify) => Object.freeze({ id, skill, name, description, mana, damage, cooldown, modify });
  var change = (kind, patch) => (recipe) => {
    if (recipe.kind !== kind) throw new Error(`Specialization recipe mismatch: ${kind}`);
    for (const [key, value] of Object.entries(patch)) Object.assign(recipe, { [key]: Array.isArray(value) ? [...value] : value && typeof value === "object" ? { ...value } : value });
  };
  var SKILL_SPECIALIZATIONS = Object.freeze([
    spec("repulse-wide", "repulse", "Open the Line", "A full circular shockwave with 20% more radius, but 25% less damage.", 1.2, 0.75, 1, change("cone", { radius: 114, arc: Math.PI * 2 })),
    spec("repulse-pin", "repulse", "Pinning Wall", "2-second stun, but the arc narrows to 120 degrees. Costs 30% more mana.", 1.3, 1, 1, change("cone", { stun: 2, arc: Math.PI * 2 / 3 })),
    spec("repulse-ready", "repulse", "Rolling Front", "30% less mana and cooldown; 20% less damage and a 0.5-second stun.", 0.7, 0.8, 0.7, change("cone", { stun: 0.5 })),
    spec("citadel-long", "ironCitadel", "Living Rampart", "Protection lasts 8 seconds at 30% hit reduction; impact deals 20% less damage.", 1.2, 0.8, 1, change("radial", { shelter: { duration: 8, reduction: 0.3 } })),
    spec("citadel-seal", "ironCitadel", "Unbroken Seal", "Protection rises to 65% hit reduction for only 2 seconds; 20% longer cooldown.", 1.1, 1, 1.2, change("radial", { shelter: { duration: 2, reduction: 0.65 } })),
    spec("citadel-break", "ironCitadel", "Breaking Siege", "50% more impact damage and a 1-second stun; protection falls to 25%.", 1.35, 1.5, 1, change("radial", { stun: 1, shelter: { duration: 5, reduction: 0.25 } })),
    spec("smoke-wide", "smokeVeil", "Spreading Haze", "50% larger smoke radius; only 10% hit reduction.", 1.15, 1, 1, change("radial", { radius: 172.5, shelter: { duration: 2, reduction: 0.1 } })),
    spec("smoke-deep", "smokeVeil", "Choking Mist", "Enemies are 70% slower for 2 seconds; 25% smaller radius and 20% longer cooldown.", 1.2, 1, 1.2, change("radial", { radius: 86.25, slow: { duration: 2, factor: 0.3 } })),
    spec("smoke-ready", "smokeVeil", "Fading Shroud", "35% less mana and cooldown; only 1 second of protection and 1.5 seconds of slow.", 0.65, 1, 0.65, change("radial", { slow: { duration: 1.5, factor: 0.5 }, shelter: { duration: 1, reduction: 0.2 } })),
    spec("reaping-many", "nightReaping", "Harvest Circle", "Strikes up to eight enemies with 25% more reach, but 25% less damage.", 1.35, 0.75, 1, change("backstab", { targets: 8, minRange: 200 })),
    spec("reaping-single", "nightReaping", "Marked for Death", "One target takes 100% more damage; front-facing damage remains lower than a rear strike.", 1, 2, 1, change("backstab", { targets: 1 })),
    spec("reaping-rear", "nightReaping", "Midnight Execution", "Rear strikes deal 3 times damage; 15% less base damage and a 20% longer cooldown.", 1.3, 0.85, 1.2, change("backstab", { rearMultiplier: 3 })),
    spec("sidestep-long", "sidestep", "Long Stride", "35% farther; 30% longer cooldown.", 1, 1, 1.3, change("step", { speed: 972 })),
    spec("sidestep-short", "sidestep", "Quick Footing", "25% shorter step; 25% shorter cooldown.", 1, 1, 0.75, change("step", { speed: 540 })),
    spec("brace-long", "brace", "Hold Fast", "Brace lasts 3 seconds; reduction falls to 15%.", 1.1, 1, 1, change("stance", { duration: 3, reduction: 0.15 })),
    spec("brace-hard", "brace", "Set Like Stone", "Brace reduces damage by 30% for 1 second.", 1, 1, 1, change("stance", { duration: 1, reduction: 0.3 })),
    spec("ward-deep", "runicWard", "Deep Inscription", "Barrier holds 26% of maximum life, but expires after 2 seconds.", 1.3, 1, 1, change("ward", { fraction: 0.26, duration: 2 })),
    spec("ward-lasting", "runicWard", "Patient Rune", "Barrier lasts 7 seconds, but holds only 12% of maximum life.", 1, 1, 1, change("ward", { fraction: 0.12, duration: 7 })),
    spec("vault-long", "vaultingShot", "Parting Arrow", "Retreat 30% farther; arrow deals 20% less damage.", 1, 0.8, 1, change("step", { speed: 572 })),
    spec("vault-close", "vaultingShot", "Snap Shot", "Retreat half as far; arrow deals 30% more damage.", 1.2, 1.3, 1, change("step", { speed: 220 })),
    spec("rally-last", "rallyOfIron", "Last Stand", "8 seconds and 35% hit reduction; only one empowered melee action.", 1.2, 1, 1, change("stance", { duration: 8, reduction: 0.35, charges: 1 })),
    spec("rally-march", "rallyOfIron", "Iron March", "Five empowered actions; hit reduction falls to 10%.", 1.15, 1, 1, change("stance", { charges: 5, reduction: 0.1 })),
    spec("ghost-patient", "ghostHunt", "Patient Hunt", "10-second window, two echoes at 90% damage.", 1, 1, 1, change("stance", { duration: 10, charges: 2, bonus: 0.9 })),
    spec("ghost-flurry", "ghostHunt", "Pale Flurry", "Five echoes at 40% damage; window lasts 4 seconds.", 1.15, 1, 1, change("stance", { duration: 4, charges: 5, bonus: 0.4 })),
    spec("sidestep-retreat", "sidestep", "Yielding Ground", "Step backward while keeping your aim. Costs half as much mana; 15% shorter travel.", 0.5, 1, 1, change("step", { retreat: true, speed: 612 })),
    spec("brace-ready", "brace", "Measured Breath", "Half the mana and 30% shorter cooldown; only 12% hit reduction.", 0.5, 1, 0.7, change("stance", { reduction: 0.12 })),
    spec("ward-renew", "runicWard", "Renewing Script", "40% shorter cooldown and 30% less mana; barrier holds 10% of maximum life for 3 seconds.", 0.7, 1, 0.6, change("ward", { fraction: 0.1, duration: 3 })),
    spec("vault-advance", "vaultingShot", "Pursuing Arrow", "Vault forward through the opening; 20% less arrow damage and 20% shorter cooldown.", 1, 0.8, 0.8, change("step", { retreat: false })),
    spec("rally-burst", "rallyOfIron", "Decisive Banner", "One melee action deals 140% more damage; window lasts 3 seconds, with no hit reduction.", 1, 1, 1, change("stance", { duration: 3, reduction: 0, charges: 1, bonus: 1.4 })),
    spec("ghost-focus", "ghostHunt", "One Perfect Shot", "One echo at 200% damage within 4 seconds; 20% longer cooldown.", 1.1, 1, 1.2, change("stance", { duration: 4, charges: 1, bonus: 2 })),
    spec("cleave-economy", "cleave", "Steady Crescent", "45% less mana and 20% less damage; a narrower 180-degree sweep.", 0.55, 0.8, 1, change("sweep", { arc: Math.PI })),
    spec("whirlwind-economy", "whirlwind", "Patient Orbit", "40% less mana and 25% less damage; preserves the full circular sweep.", 0.6, 0.75),
    spec("ricochet-pierce", "ricochet", "Through the Pack", "Pierces two enemies before its first rebound; only two rebounds. Costs 25% more mana.", 1.25, 0.9, 1, change("projectile", { effects: { style: "arrow", pierce: 2, chain: 2, chainRange: 150 } })),
    spec("backstab-economy", "backstab", "Opportunist", "40% less mana, 10% less hit damage; rear strikes use a wider 90-degree threshold.", 0.6, 0.9, 1, change("backstab", { rearAngle: Math.PI / 2 })),
    spec("cleave-reach", "cleave", "Reaching Crescent", "40% more reach, 15% less hit damage. Costs 30% more mana.", 1.3, 0.85),
    spec("cleave-force", "cleave", "Crushing Crescent", "35% more damage, 20% less reach. Costs 60% more mana.", 1.6, 1.35),
    spec("whirlwind-reach", "whirlwind", "Gathering Steel", "45% more reach, 20% less damage. Costs 35% more mana.", 1.35, 0.8),
    spec("whirlwind-force", "whirlwind", "Iron Cyclone", "40% more damage, 15% less reach. Costs 70% more mana.", 1.7, 1.4),
    spec("shield-wide", "shieldBash", "Shield Wall", "A wider, longer shield strike; 15% less damage. Costs 35% more mana.", 1.35, 0.85),
    spec("shield-force", "shieldBash", "Bellringer", "40% more damage and a longer stun. Costs 75% more mana.", 1.75, 1.4),
    spec("volley-fan", "volley", "Thornburst", "Five arrows instead of three, each dealing 25% less damage. Costs 50% more mana.", 1.5, 0.75),
    spec("volley-pierce", "volley", "Barbed Volley", "Each arrow pierces one additional enemy. Costs 65% more mana.", 1.65),
    spec("ricochet-chain", "ricochet", "Endless Pursuit", "Three extra rebounds, 15% less damage. Costs 55% more mana.", 1.55, 0.85),
    spec("ricochet-force", "ricochet", "Heavy Rebound", "50% more damage, only one rebound. Costs 40% more mana.", 1.4, 1.5),
    spec("backstab-reach", "backstab", "Long Shadow", "50% more reach, 10% less damage. Costs 30% more mana.", 1.3, 0.9),
    spec("backstab-rear", "backstab", "Executioner", "Rear strikes deal 3\xD7 instead of 2\xD7 damage; other hits deal 15% less. Costs 70% more mana.", 1.7, 0.85),
    spec("fireball-fork", "fireball", "Forked Flame", "Three fireballs, each dealing 35% less damage. Costs 80% more mana.", 1.8, 0.65),
    spec("fireball-ember", "fireball", "Living Ember", "Explosions leave burning ground for three seconds. Costs 65% more mana.", 1.65),
    spec("arc-circuit", "arcLightning", "Storm Circuit", "Three extra jumps may revisit targets at reduced damage. Costs 70% more mana.", 1.7),
    spec("arc-focus", "arcLightning", "Concentrated Current", "60% more damage, but only three targets. Costs 45% more mana.", 1.45, 1.6),
    spec("nova-echo", "iceNova", "Echoing Frost", "A second nova expands after 0.6 seconds at 60% damage. Costs 70% more mana.", 1.7),
    spec("nova-deep", "iceNova", "Deep Winter", "30% more radius and a stronger, longer slow; 15% less damage. Costs 40% more mana.", 1.4, 0.85),
    spec("meteor-shards", "meteor", "Shattered Sky", "Five impacts with 35% smaller radius spread across a wider target area at 45% damage each. Costs 90% more mana; 25% longer cooldown.", 1.9, 0.45, 1.25),
    spec("shield-control", "shieldBash", "Concussion", "2-second stun, 30% less damage. Costs 20% more mana.", 1.2, 0.7, 1, change("cone", { stun: 2 })),
    spec("volley-focus", "volley", "Needle Fan", "A tight three-arrow fan; 20% more damage. Costs 35% more mana.", 1.35, 1.2, 1, change("projectile", { offsets: [-0.09, 0, 0.09] })),
    spec("fireball-impact", "fireball", "Flashfire", "40% wider explosion, 20% less damage. Costs 40% more mana.", 1.4, 0.8, 1, change("projectile", { effects: { ...SKILL_EXECUTION.fireball.effects, blastRadius: 119 } })),
    spec("arc-economy", "arcLightning", "Static Thread", "30% less mana, 20% less damage; jumps retain 85% damage.", 0.7, 0.8, 1, change("chain", { falloff: 0.85 })),
    spec("nova-freeze", "iceNova", "Snap Freeze", "Freezes for 0.6 seconds; 20% smaller radius, 20% less damage. Costs 35% more mana.", 1.35, 0.8, 1, change("radial", { radius: 92, stun: 0.6 })),
    spec("meteor-inferno", "meteor", "Lasting Inferno", "Ground fire lasts 8 seconds at 18% impact damage per second. Costs 45% more mana.", 1.45, 1, 1, change("ground", { scorch: { duration: 8, interval: 0.25, damageMultiplier: 0.18 } })),
    spec("meteor-impact", "meteor", "Worldbreaker", "60% more impact damage, 25% larger radius; no ground fire. Costs 50% more mana; 20% longer cooldown.", 1.5, 1.6, 1.2, change("ground", { radius: 156.25, scorch: void 0 })),
    spec("lunge-distance", "lunge", "Farstrike", "50% longer dash, 15% less damage. Costs 20% more mana.", 1.2, 0.85, 1, change("dash", { duration: 0.36 })),
    spec("lunge-force", "lunge", "Impaling Rush", "50% more damage, 30% wider contact. Costs 50% more mana; 25% longer cooldown.", 1.5, 1.5, 1.25, change("dash", { radius: 29.9 })),
    spec("lunge-swift", "lunge", "Fleeting Step", "30% shorter cooldown and 20% less mana; 25% less damage, shorter dash.", 0.8, 0.75, 0.7, change("dash", { duration: 0.18 })),
    spec("earthshatter-wide", "earthshatter", "Faultline", "40% wider shockwave, 20% less damage. Costs 30% more mana.", 1.3, 0.8, 1, change("radial", { radius: 175 })),
    spec("earthshatter-force", "earthshatter", "Seismic Hammer", "60% more damage and 2-second stun; 20% smaller radius. Costs 60% more mana; 25% longer cooldown.", 1.6, 1.6, 1.25, change("radial", { radius: 100, stun: 2 })),
    spec("earthshatter-swift", "earthshatter", "Tremor", "35% shorter cooldown, 25% less damage; stun lasts 0.6 seconds.", 1, 0.75, 0.65, change("radial", { stun: 0.6 })),
    spec("bulwark-duration", "bulwark", "Enduring Guard", "Guard lasts 5 seconds. Costs 50% more mana; 25% longer cooldown.", 1.5, 1, 1.25, change("guard", { duration: 5 })),
    spec("bulwark-reduction", "bulwark", "Iron Aegis", "Base block reduction rises to 85%, guard lasts 2 seconds. Every additional rank extends the guard; block reduction caps at 90%. Costs 35% more mana.", 1.35, 1, 1, change("guard", { reduction: 0.85, duration: 2 })),
    spec("bulwark-swift", "bulwark", "Ready Guard", "25% less mana and 25% shorter cooldown; guard lasts 2 seconds.", 0.75, 1, 0.75, change("guard", { duration: 2 })),
    spec("piercing-depth", "piercingShot", "Unbroken Flight", "Hits up to 8 enemies; 15% less damage. Costs 40% more mana.", 1.4, 0.85, 1, change("projectile", { effects: { ...SKILL_EXECUTION.piercingShot.effects, pierce: 7 } })),
    spec("piercing-force", "piercingShot", "Siegebreaker", "60% more damage, hits up to 2 enemies. Costs 40% more mana; 20% longer cooldown.", 1.4, 1.6, 1.2, change("projectile", { effects: { ...SKILL_EXECUTION.piercingShot.effects, pierce: 1 } })),
    spec("piercing-twin", "piercingShot", "Twin Needles", "Two piercing arrows at 65% damage each. Costs 50% more mana.", 1.5, 0.65, 1, change("projectile", { offsets: [-0.075, 0.075] })),
    spec("rain-wide", "rainOfArrows", "Blanket of Thorns", "50% larger radius; 25% less damage per wave. Costs 35% more mana.", 1.35, 0.75, 1, change("ground", { radius: 138 })),
    spec("rain-lasting", "rainOfArrows", "Relentless Rain", "Eight waves over 2.4 seconds, each at 75% damage. Costs 65% more mana; 25% longer cooldown.", 1.65, 0.75, 1.25, change("ground", { duration: 2.4 })),
    spec("rain-burst", "rainOfArrows", "Hail of Barbs", "Three rapid waves at 45% more damage. Costs 40% more mana.", 1.4, 1.45, 1, change("ground", { duration: 0.6, interval: 0.2, delay: 0.2 })),
    spec("lance-fan", "frostLance", "Glacial Trident", "Three lances at 55% damage each. Costs 70% more mana.", 1.7, 0.55, 1, change("projectile", { offsets: [-0.18, 0, 0.18] })),
    spec("lance-chill", "frostLance", "Permafrost Spear", "70% slow for 5 seconds, 20% less damage. Costs 30% more mana.", 1.3, 0.8, 1, change("projectile", { effects: { ...SKILL_EXECUTION.frostLance.effects, slowFactor: 0.3, slowDuration: 5 } })),
    spec("lance-force", "frostLance", "Diamond Lance", "60% more damage, hits up to 2 enemies. Costs 45% more mana; 20% longer cooldown.", 1.45, 1.6, 1.2, change("projectile", { effects: { ...SKILL_EXECUTION.frostLance.effects, pierce: 1 } })),
    spec("siphon-drain", "siphon", "Soul Feast", "Heals 60% of actual damage dealt, but deals 20% less damage. Costs 35% more mana.", 1.35, 0.8, 1, change("projectile", { effects: { ...SKILL_EXECUTION.siphon.effects, lifeSteal: 0.6 } })),
    spec("siphon-pierce", "siphon", "Hollow Passage", "Hits up to 3 enemies, 15% less damage. Costs 50% more mana.", 1.5, 0.85, 1, change("projectile", { effects: { ...SKILL_EXECUTION.siphon.effects, pierce: 2 } })),
    spec("siphon-force", "siphon", "Soul Rend", "60% more damage, healing reduced to 15%. Costs 40% more mana; 20% longer cooldown.", 1.4, 1.6, 1.2, change("projectile", { effects: { ...SKILL_EXECUTION.siphon.effects, lifeSteal: 0.15 } })),
    spec("cataclysm-many", "cataclysm", "Falling Stars", "Eleven impacts at 65% damage each. Costs 60% more mana; 20% longer cooldown.", 1.6, 0.65, 1.2, change("ground", { scatter: 11 })),
    spec("cataclysm-force", "cataclysm", "Extinction", "Three impacts with 100% more damage and 40% more radius. Costs 40% more mana; 25% longer cooldown.", 1.4, 2, 1.25, change("ground", { scatter: 3, radius: 147 })),
    spec("cataclysm-fire", "cataclysm", "Sea of Cinders", "Ground fire lasts 9 seconds at 20% impact damage per second; 15% less impact damage. Costs 50% more mana.", 1.5, 0.85, 1, change("ground", { scorch: { duration: 9, interval: 0.25, damageMultiplier: 0.2 } })),
    spec("tempest-wide", "tempest", "Stormfront", "40% larger storm, 25% less damage. Casting and upkeep cost 30% more mana.", 1.3, 0.75, 1, change("ground", { radius: 273 })),
    spec("tempest-fast", "tempest", "Thunderhead", "Strikes every 0.3 seconds at 80% damage. Casting and upkeep cost 70% more mana.", 1.7, 0.8, 1, change("ground", { interval: 0.3 })),
    spec("tempest-still", "tempest", "Storm Anchor", "Stationary storm lasts 9 seconds, deals 20% more damage. Casting and upkeep cost 35% more mana; 25% longer cooldown.", 1.35, 1.2, 1.25, change("ground", { follow: false, duration: 9 })),
    spec("zero-wide", "absoluteZero", "Polar Horizon", "40% larger waves, 25% less damage. Costs 35% more mana.", 1.35, 0.75, 1, change("ground", { radius: 336 })),
    spec("zero-freeze", "absoluteZero", "Frozen Eternity", "Freeze lasts 2.5 seconds; 80% slow for 6 seconds. Costs 50% more mana; 25% longer cooldown.", 1.5, 1, 1.25, change("ground", { stun: 2.5, slow: { factor: 0.2, duration: 6 } })),
    spec("zero-burst", "absoluteZero", "Shattering Winter", "One wave deals 140% more damage, 25% smaller radius. Costs 25% more mana.", 1.25, 2.4, 1, change("ground", { duration: 0, radius: 180 }))
  ]);

  // src/spell-school.ts
  function schoolOf(style) {
    switch (style) {
      case "holy":
        return "holy";
      case "shadow":
        return "shadow";
      case "fire":
        return "fire";
      case "frost":
        return "frost";
      case "lightning":
        return "lightning";
      case "nature":
      case "poison":
        return "nature";
      case "arcane":
        return "arcane";
      case "physical":
      case "bleed":
        return "physical";
      default:
        return null;
    }
  }

  // src/spell-school-art.ts
  var PALETTES = Object.freeze({
    holy: { core: "#ffd76e", hot: "#fff7d4", deep: "#c98f2e", glow: "#ffd76e" },
    shadow: { core: "#8a6fb8", hot: "#d9c6ff", deep: "#150b24", glow: "#7a5fb0" },
    fire: { core: "#ff803c", hot: "#ffe9b0", deep: "#3a1c10", glow: "#ff9a4e" },
    frost: { core: "#8ee7ff", hot: "#eaffff", deep: "#2a6a8a", glow: "#8ee7ff" },
    lightning: { core: "#b7afff", hot: "#f4f2ff", deep: "#4a3f9a", glow: "#b7afff" },
    nature: { core: "#7fd06a", hot: "#d8ffb0", deep: "#2e5a26", glow: "#7fd06a" },
    arcane: { core: "#a894ec", hot: "#e9ddff", deep: "#3a2a6e", glow: "#a894ec" },
    physical: { core: "#c8ccd4", hot: "#f4f7fb", deep: "#4a4f58", glow: "#d8dde6" }
  });
  var SCHOOL_IMPACT_DURATION = 0.5;
  var CAP = { rays: 10, tendrils: 6, wisps: 5, embers: 12, shards: 8, bolts: 4, sparks: 10, leaves: 8, runes: 6, missiles: 5, motes: 6, drops: 9 };
  function unit(index, salt) {
    return hash((index + 1) * 2654435761 + salt * 40503) / 4294967296;
  }
  function count(base, intensity, reducedMotion) {
    return Math.max(1, Math.round(base * Math.min(1.4, intensity) * (reducedMotion ? 0.5 : 1)));
  }
  function drawSchoolImpact(c2, x, y, style, time, intensity = 1, reducedMotion = false) {
    const school = schoolOf(style);
    if (!school) return false;
    const pal = PALETTES[school];
    const p = clamp(time / SCHOOL_IMPACT_DURATION);
    const pm = reducedMotion ? 0.45 : p;
    const fade = 1 - p;
    if (fade <= 0) return true;
    const k = clamp(intensity, 0.25, 2);
    const ease = 1 - (1 - pm) * (1 - pm);
    c2.save();
    c2.translate(x, y);
    switch (school) {
      case "holy": {
        c2.globalCompositeOperation = "lighter";
        drawGlow(c2, 0, 0, (30 + 26 * ease) * k, pal.glow, 0.5 * fade);
        c2.globalAlpha = fade;
        c2.fillStyle = pm < 0.3 ? pal.hot : pal.core;
        c2.beginPath();
        c2.arc(0, 0, (11 - 5 * pm) * k, 0, TAU);
        c2.fill();
        const rays = count(CAP.rays, intensity, reducedMotion);
        c2.fillStyle = pal.core;
        for (let i = 0; i < rays; i++) {
          const a = i * TAU / rays + pm * 0.5 + unit(i, 1) * 0.3;
          const len = (24 + unit(i, 2) * 24) * k * (0.3 + ease);
          const w = (2.6 + unit(i, 3) * 1.6) * fade;
          c2.save();
          c2.rotate(a);
          c2.globalAlpha = fade * (0.5 + unit(i, 4) * 0.5);
          polygon(c2, [[7, -w], [len, 0], [7, w]], i % 3 === 0 ? pal.hot : pal.core);
          c2.restore();
        }
        c2.globalAlpha = 0.7 * fade;
        c2.strokeStyle = pal.core;
        c2.lineWidth = 1.6 * fade + 0.4;
        c2.beginPath();
        c2.ellipse(0, 12, (14 + 46 * ease) * k, (6 + 19 * ease) * k, 0, 0, TAU);
        c2.stroke();
        const motes = count(CAP.motes, intensity, reducedMotion);
        for (let i = 0; i < motes; i++) {
          const mx = (unit(i, 5) - 0.5) * 44 * ease * k;
          const my = -pm * (26 + unit(i, 6) * 22) * k;
          c2.globalAlpha = fade * 0.8;
          c2.fillStyle = i % 2 ? pal.hot : pal.core;
          c2.fillRect(mx - 1, my - 1, 2, 2);
        }
        break;
      }
      case "shadow": {
        c2.globalAlpha = 0.55 * fade;
        c2.fillStyle = pal.deep;
        c2.beginPath();
        c2.arc(0, 0, (20 - 9 * pm) * k, 0, TAU);
        c2.fill();
        c2.globalCompositeOperation = "lighter";
        drawGlow(c2, 0, 0, (26 + 14 * ease) * k, pal.glow, 0.35 * fade);
        const tendrils = count(CAP.tendrils, intensity, reducedMotion);
        c2.strokeStyle = pal.core;
        c2.lineCap = "round";
        for (let i = 0; i < tendrils; i++) {
          const a = i * TAU / tendrils + unit(i, 7) * 0.7;
          const reach = (18 + unit(i, 8) * 22) * k * (0.25 + ease);
          const wob = Math.sin(pm * 9 + i * 2.1) * 0.5;
          const mx = Math.cos(a + wob * 0.6) * reach * 0.55, my = Math.sin(a + wob * 0.6) * reach * 0.55 - 4;
          const ex = Math.cos(a + wob) * reach, ey = Math.sin(a + wob) * reach - 8 * pm;
          c2.globalAlpha = fade * (0.45 + unit(i, 9) * 0.4);
          c2.lineWidth = (2.4 - pm * 1.4) * (0.8 + unit(i, 10) * 0.5);
          c2.beginPath();
          c2.moveTo(0, 0);
          c2.quadraticCurveTo(mx, my, ex, ey);
          c2.stroke();
        }
        const wisps = count(CAP.wisps, intensity, reducedMotion);
        for (let i = 0; i < wisps; i++) {
          const wx = (unit(i, 11) - 0.5) * 30 * k + Math.sin(pm * 6 + i * 2.4) * 5;
          const wy = -pm * (30 + unit(i, 12) * 26) * k - 6;
          const wr = (2.6 - pm * 1.2) * (0.7 + unit(i, 13) * 0.6);
          c2.globalAlpha = fade * 0.8;
          c2.fillStyle = i % 2 ? pal.hot : pal.core;
          c2.beginPath();
          c2.arc(wx, wy, Math.max(0.6, wr), 0, TAU);
          c2.fill();
          c2.globalAlpha = fade * 0.35;
          c2.beginPath();
          c2.arc(wx, wy + wr * 1.6, Math.max(0.4, wr * 0.5), 0, TAU);
          c2.fill();
        }
        c2.globalAlpha = 0.5 * fade;
        c2.strokeStyle = pal.core;
        c2.lineWidth = 1.4;
        c2.beginPath();
        c2.ellipse(0, 0, (34 - 20 * ease) * k, (34 - 20 * ease) * 0.7 * k, 0, 0, TAU);
        c2.stroke();
        break;
      }
      case "fire": {
        c2.globalAlpha = 0.5 * fade;
        c2.strokeStyle = pal.deep;
        c2.lineWidth = 3.2;
        c2.beginPath();
        c2.ellipse(0, 10, (8 + 40 * ease) * k, (3.5 + 17 * ease) * k, 0, 0, TAU);
        c2.stroke();
        c2.globalCompositeOperation = "lighter";
        drawGlow(c2, 0, 0, (34 + 24 * ease) * k, pal.glow, 0.6 * fade);
        c2.globalAlpha = fade;
        c2.fillStyle = pm < 0.25 ? pal.hot : pal.core;
        c2.beginPath();
        c2.arc(0, 0, (13 - 6 * pm) * k, 0, TAU);
        c2.fill();
        const embers = count(CAP.embers, intensity, reducedMotion);
        for (let i = 0; i < embers; i++) {
          const a = i * TAU / embers + unit(i, 14) * 0.6;
          const dist = (10 + unit(i, 15) * 34) * k * ease;
          const ex = Math.cos(a) * dist, ey = Math.sin(a) * dist * 0.8 - pm * (6 + unit(i, 16) * 10);
          const s = (2.6 * (1 - pm) + 0.8) * (0.7 + unit(i, 17) * 0.6);
          c2.globalAlpha = fade * (0.55 + unit(i, 18) * 0.45);
          c2.fillStyle = i % 3 === 0 ? "#ffd674" : i % 3 === 1 ? pal.hot : pal.core;
          c2.fillRect(ex - s / 2, ey - s / 2, s, s);
        }
        c2.globalAlpha = 0.65 * fade;
        c2.strokeStyle = pal.core;
        c2.lineWidth = 1.5 * fade + 0.4;
        c2.beginPath();
        c2.ellipse(0, 10, (8 + 40 * ease) * k, (3.5 + 17 * ease) * k, 0, 0, TAU);
        c2.stroke();
        break;
      }
      case "frost": {
        c2.globalCompositeOperation = "lighter";
        c2.globalAlpha = 0.2 * fade;
        c2.fillStyle = "#bff0ff";
        c2.beginPath();
        c2.ellipse(0, 10, 30 * k * ease + 6, 12 * k * ease + 3, 0, 0, TAU);
        c2.fill();
        drawGlow(c2, 0, 0, (26 + 20 * ease) * k, pal.glow, 0.5 * fade);
        c2.globalAlpha = 0.8 * fade;
        c2.strokeStyle = pal.core;
        c2.lineWidth = 2.4 * fade + 0.5;
        c2.beginPath();
        c2.ellipse(0, 8, (6 + 52 * ease) * k, (2.5 + 22 * ease) * k, 0, 0, TAU);
        c2.stroke();
        c2.globalAlpha = 0.55 * fade;
        c2.strokeStyle = pal.hot;
        c2.lineWidth = 1;
        c2.beginPath();
        c2.ellipse(0, 8, (4 + 40 * ease) * k, (2 + 17 * ease) * k, 0, 0, TAU);
        c2.stroke();
        const shards = count(CAP.shards, intensity, reducedMotion);
        for (let i = 0; i < shards; i++) {
          const a = i * TAU / shards + unit(i, 19) * 0.5;
          const dist = (8 + unit(i, 20) * 36) * k * ease;
          const sx = Math.cos(a) * dist, sy = Math.sin(a) * dist * 0.75 - pm * (4 + unit(i, 21) * 12);
          const s = (4.5 + unit(i, 22) * 4) * (1 - pm * 0.5) * k;
          const rot = a + pm * (2 + unit(i, 23) * 4);
          const ca = Math.cos(rot), sa = Math.sin(rot);
          c2.globalAlpha = fade * (0.6 + unit(i, 24) * 0.4);
          polygon(c2, [
            [sx + ca * s, sy + sa * s],
            [sx - sa * s * 0.4 - ca * s * 0.3, sy + ca * s * 0.4 - sa * s * 0.3],
            [sx - ca * s * 0.55, sy - sa * s * 0.55],
            [sx + sa * s * 0.4 - ca * s * 0.2, sy - ca * s * 0.4 - sa * s * 0.2]
          ], i % 3 === 0 ? pal.hot : i % 3 === 1 ? pal.core : "#5fb8e8");
        }
        for (let i = 0; i < 4; i++) {
          c2.globalAlpha = fade * 0.7;
          c2.fillStyle = pal.hot;
          c2.fillRect((unit(i, 25) - 0.5) * 40 * ease * k, -pm * (14 + unit(i, 26) * 18) * k, 1.4, 1.4);
        }
        break;
      }
      case "lightning": {
        c2.globalCompositeOperation = "lighter";
        drawGlow(c2, 0, 0, (30 + 18 * ease) * k, pal.glow, 0.55 * fade);
        c2.globalAlpha = fade;
        c2.fillStyle = pal.hot;
        c2.beginPath();
        c2.arc(0, 0, (8 * (1 - pm) + 3) * k, 0, TAU);
        c2.fill();
        const bolts = count(CAP.bolts, intensity, reducedMotion);
        for (let i = 0; i < bolts; i++) {
          const a = i * TAU / bolts + unit(i, 27) * 0.8;
          const len = (28 + unit(i, 28) * 26) * k * (0.3 + ease);
          const dx = Math.cos(a), dy = Math.sin(a);
          const px = -dy, py = dx;
          const j1 = (unit(i, 29) - 0.5) * 11, j2 = (unit(i, 30) - 0.5) * 11, j3 = (unit(i, 31) - 0.5) * 8;
          const m1x = dx * len * 0.33 + px * j1, m1y = dy * len * 0.33 + py * j1;
          const m2x = dx * len * 0.66 + px * j2, m2y = dy * len * 0.66 + py * j2;
          const ex = dx * len + px * j3, ey = dy * len + py * j3;
          for (const pass of [[pal.hot, 1.7], [pal.core, 0.8]]) {
            c2.globalAlpha = fade * (pass[1] > 1 ? 0.85 : 0.6);
            c2.strokeStyle = pass[0];
            c2.lineWidth = pass[1] * fade + 0.3;
            c2.beginPath();
            c2.moveTo(0, 0);
            c2.lineTo(m1x, m1y);
            c2.lineTo(m2x, m2y);
            c2.lineTo(ex, ey);
            c2.stroke();
          }
          const ba = a + (unit(i, 32) > 0.5 ? 0.7 : -0.7);
          c2.globalAlpha = fade * 0.5;
          c2.strokeStyle = pal.core;
          c2.lineWidth = 0.8;
          c2.beginPath();
          c2.moveTo(m2x, m2y);
          c2.lineTo(m2x + Math.cos(ba) * len * 0.3 + px * j1 * 0.4, m2y + Math.sin(ba) * len * 0.3 + py * j1 * 0.4);
          c2.stroke();
        }
        const sparks = count(CAP.sparks, intensity, reducedMotion);
        for (let i = 0; i < sparks; i++) {
          const sx = (unit(i, 33) - 0.5) * 52 * k * ease;
          const sy = -pm * (18 + unit(i, 34) * 14) * k + pm * pm * 34 * k;
          c2.globalAlpha = fade * (0.5 + unit(i, 35) * 0.5);
          c2.fillStyle = i % 2 ? pal.hot : pal.core;
          const s = 1.2 + unit(i, 36) * 1.2;
          c2.fillRect(sx - s / 2, sy - s / 2, s, s);
        }
        break;
      }
      case "nature": {
        c2.globalAlpha = 0.55 * fade;
        c2.strokeStyle = "#5d8a4a";
        c2.lineWidth = 2 * fade + 0.4;
        c2.beginPath();
        c2.ellipse(0, 10, (10 + 38 * ease) * k, (4 + 16 * ease) * k, 0, 0, TAU);
        c2.stroke();
        c2.strokeStyle = pal.deep;
        c2.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) {
          const a = i * TAU / 3 + 0.6;
          const r = (12 + 30 * ease) * k;
          c2.globalAlpha = fade * 0.45;
          c2.beginPath();
          c2.ellipse(0, 10, r, r * 0.42, 0, a, a + 0.9);
          c2.stroke();
        }
        c2.globalCompositeOperation = "lighter";
        drawGlow(c2, 0, 0, (24 + 16 * ease) * k, pal.glow, 0.4 * fade);
        const leaves = count(CAP.leaves, intensity, reducedMotion);
        for (let i = 0; i < leaves; i++) {
          const a = i * TAU / leaves + pm * 2.2 + unit(i, 37) * 0.4;
          const dist = (6 + unit(i, 38) * 28) * k * ease;
          const lx = Math.cos(a) * dist, ly = Math.sin(a) * dist * 0.8 - pm * (8 + unit(i, 39) * 14);
          const s = (3.4 + unit(i, 40) * 2.4) * (1 - pm * 0.4);
          const rot = a + pm * 5;
          const ca = Math.cos(rot), sa = Math.sin(rot);
          c2.globalAlpha = fade * (0.6 + unit(i, 41) * 0.4);
          polygon(c2, [
            [lx + ca * s, ly + sa * s],
            [lx - sa * s * 0.45, ly + ca * s * 0.45],
            [lx - ca * s, ly - sa * s],
            [lx + sa * s * 0.45, ly - ca * s * 0.45]
          ], i % 3 === 0 ? "#9fe870" : i % 3 === 1 ? pal.core : "#4e9a3f");
        }
        for (let i = 0; i < 5; i++) {
          c2.globalAlpha = fade * 0.7;
          c2.fillStyle = pal.hot;
          c2.fillRect((unit(i, 42) - 0.5) * 36 * ease * k, -pm * (20 + unit(i, 43) * 20) * k, 1.5, 1.5);
        }
        break;
      }
      case "arcane": {
        c2.globalCompositeOperation = "lighter";
        drawGlow(c2, 0, 0, (28 + 18 * ease) * k, pal.glow, 0.5 * fade);
        c2.globalAlpha = fade;
        c2.fillStyle = pal.hot;
        c2.beginPath();
        c2.arc(0, 0, (9 * (1 - pm) + 2) * k, 0, TAU);
        c2.fill();
        const rr = (12 + 30 * ease) * k;
        c2.globalAlpha = 0.75 * fade;
        c2.strokeStyle = pal.core;
        c2.lineWidth = 1.4 * fade + 0.3;
        c2.beginPath();
        c2.arc(0, 0, rr, 0, TAU);
        c2.stroke();
        c2.globalAlpha = 0.45 * fade;
        c2.lineWidth = 0.8;
        c2.beginPath();
        c2.arc(0, 0, rr * 0.55, 0, TAU);
        c2.stroke();
        const runes = count(CAP.runes, intensity, reducedMotion);
        c2.strokeStyle = pal.hot;
        c2.lineWidth = 1.1;
        for (let i = 0; i < runes; i++) {
          const a = i * TAU / runes + pm * 1.5;
          const rx = Math.cos(a) * rr, ry = Math.sin(a) * rr;
          const tx = Math.cos(a + 0.22) * rr, ty = Math.sin(a + 0.22) * rr;
          c2.globalAlpha = fade * 0.8;
          c2.beginPath();
          c2.moveTo(rx, ry);
          c2.lineTo(tx, ty);
          c2.stroke();
          c2.beginPath();
          c2.moveTo(rx * 0.82, ry * 0.82);
          c2.lineTo(rx, ry);
          c2.stroke();
        }
        const missiles = count(CAP.missiles, intensity, reducedMotion);
        for (let i = 0; i < missiles; i++) {
          const a = i * TAU / missiles + 0.4 + pm * 1.1;
          const dist = (4 + 34 * ease) * k;
          const mx = Math.cos(a) * dist, my = Math.sin(a) * dist * 0.85 - pm * 6;
          const tail = 9 * (1 - pm * 0.5);
          const tx = Math.cos(a) * (dist - tail), ty = Math.sin(a) * (dist - tail) * 0.85 - pm * 6;
          c2.globalAlpha = fade * 0.55;
          c2.strokeStyle = pal.core;
          c2.lineWidth = 1.3;
          c2.beginPath();
          c2.moveTo(tx, ty);
          c2.lineTo(mx, my);
          c2.stroke();
          c2.globalAlpha = fade * 0.9;
          const ha = a + Math.PI / 2;
          polygon(c2, [
            [mx + Math.cos(a) * 3.4, my + Math.sin(a) * 3.4],
            [mx + Math.cos(ha) * 1.8, my + Math.sin(ha) * 1.8],
            [mx - Math.cos(ha) * 1.8, my - Math.sin(ha) * 1.8]
          ], pal.hot);
        }
        break;
      }
      case "physical": {
        c2.globalCompositeOperation = "lighter";
        drawGlow(c2, 0, 0, (22 + 14 * ease) * k, pal.glow, 0.4 * fade);
        c2.globalAlpha = fade;
        c2.fillStyle = pm < 0.3 ? pal.hot : pal.core;
        c2.beginPath();
        c2.arc(0, 0, (9 - 4 * pm) * k, 0, TAU);
        c2.fill();
        for (let i = 0; i < 2; i++) {
          const a = i * Math.PI + unit(i, 49) * 0.7 + pm * 0.9;
          const r = (10 + 26 * ease) * k;
          c2.globalAlpha = fade * (0.65 - i * 0.2);
          c2.strokeStyle = i ? pal.core : pal.hot;
          c2.lineWidth = (2.2 - i * 0.8) * fade + 0.4;
          c2.beginPath();
          c2.ellipse(0, 0, r, r * 0.62, a, -0.5, 0.9);
          c2.stroke();
        }
        const drops = count(CAP.drops, intensity, reducedMotion);
        for (let i = 0; i < drops; i++) {
          const a = i * TAU / drops + unit(i, 50) * 0.8;
          const dist = (6 + unit(i, 51) * 30) * k * ease;
          const dx = Math.cos(a) * dist, dy = Math.sin(a) * dist * 0.7 - pm * (4 + unit(i, 52) * 10) + pm * pm * 16 * k;
          const s = (1.4 + unit(i, 53) * 1.6) * (1 - pm * 0.4);
          c2.globalAlpha = fade * (0.5 + unit(i, 54) * 0.4);
          c2.fillStyle = i % 3 === 0 ? "#e05a4a" : "#a8322e";
          c2.fillRect(dx - s / 2, dy - s / 2, s, s);
        }
        c2.globalCompositeOperation = "source-over";
        c2.globalAlpha = 0.4 * fade;
        c2.strokeStyle = pal.deep;
        c2.lineWidth = 1.6;
        c2.beginPath();
        c2.ellipse(0, 9, (6 + 22 * ease) * k, (2.5 + 9 * ease) * k, 0, 0, TAU);
        c2.stroke();
        break;
      }
    }
    c2.restore();
    return true;
  }
  function schoolCastAura(c2, x, y, style, time, scale = 1, reducedMotion = false) {
    const school = schoolOf(style);
    if (!school) return false;
    const pal = PALETTES[school];
    const t = reducedMotion ? 0 : time;
    const k = scale;
    c2.save();
    c2.translate(x, y);
    switch (school) {
      case "holy": {
        c2.globalCompositeOperation = "lighter";
        c2.globalAlpha = 0.22 + Math.sin(t * 3) * 0.08;
        c2.strokeStyle = pal.core;
        c2.lineWidth = 1.2;
        c2.beginPath();
        c2.ellipse(0, 8, 20 * k, 8 * k, 0, 0, TAU);
        c2.stroke();
        drawGlow(c2, 0, -6, 16 * k, pal.glow, 0.16 + Math.sin(t * 3.7) * 0.05);
        for (let i = 0; i < 4; i++) {
          const cy = (t * 0.35 + i * 0.25) % 1;
          c2.globalAlpha = Math.sin(cy * Math.PI) * 0.6;
          c2.fillStyle = i % 2 ? pal.hot : pal.core;
          c2.fillRect((unit(i, 44) - 0.5) * 22 * k, -cy * 34 * k - 4, 1.6, 1.6);
        }
        break;
      }
      case "shadow": {
        c2.globalAlpha = 0.2;
        c2.fillStyle = pal.deep;
        c2.beginPath();
        c2.ellipse(0, 8, 18 * k, 7 * k, 0, 0, TAU);
        c2.fill();
        c2.globalCompositeOperation = "lighter";
        for (let i = 0; i < 3; i++) {
          const a = t * 1.4 + i * TAU / 3;
          const r = (15 + Math.sin(t * 2 + i * 2.1) * 3) * k;
          const wx = Math.cos(a) * r, wy = Math.sin(a) * r * 0.5 - 8;
          c2.globalAlpha = 0.5;
          c2.fillStyle = pal.core;
          c2.beginPath();
          c2.arc(wx, wy, 2, 0, TAU);
          c2.fill();
          c2.globalAlpha = 0.3;
          c2.fillStyle = pal.hot;
          c2.beginPath();
          c2.arc(wx, wy - 2.4, 1.1, 0, TAU);
          c2.fill();
        }
        drawGlow(c2, 0, -6, 14 * k, pal.glow, 0.14);
        break;
      }
      case "fire": {
        c2.globalCompositeOperation = "lighter";
        drawGlow(c2, 0, -4, 17 * k, pal.glow, 0.18 + Math.sin(t * 7) * 0.06);
        for (let i = 0; i < 5; i++) {
          const cy = (t * 0.5 + i * 0.2) % 1;
          c2.globalAlpha = Math.sin(cy * Math.PI) * 0.65;
          c2.fillStyle = i % 3 === 0 ? "#ffd674" : pal.core;
          const s = 1.8 - cy;
          c2.fillRect((unit(i, 45) - 0.5) * 20 * k + Math.sin(t * 4 + i) * 2, -cy * 30 * k - 2, s, s);
        }
        break;
      }
      case "frost": {
        c2.globalCompositeOperation = "lighter";
        c2.globalAlpha = 0.2;
        c2.strokeStyle = pal.core;
        c2.lineWidth = 1;
        c2.beginPath();
        c2.ellipse(0, 8, 18 * k, 7 * k, 0, 0, TAU);
        c2.stroke();
        drawGlow(c2, 0, -4, 14 * k, pal.glow, 0.15);
        for (let i = 0; i < 4; i++) {
          const a = t * 0.9 + i * TAU / 4;
          const cx = Math.cos(a) * 17 * k, cy = Math.sin(a) * 8 * k - 6;
          const s = 2.2;
          c2.globalAlpha = 0.55;
          polygon(c2, [[cx, cy - s], [cx + s * 0.6, cy], [cx, cy + s], [cx - s * 0.6, cy]], i % 2 ? pal.hot : pal.core);
        }
        break;
      }
      case "lightning": {
        c2.globalCompositeOperation = "lighter";
        drawGlow(c2, 0, -4, 15 * k, pal.glow, 0.15);
        for (let i = 0; i < 2; i++) {
          const phase = (t * 2.4 + i * 0.5) % 1;
          if (phase >= 0.3) continue;
          const a = unit(i, 46) * TAU + i * 2.4;
          const len = 16 * k;
          const dx = Math.cos(a), dy = Math.sin(a);
          const j = (unit(i, 47) - 0.5) * 8;
          c2.globalAlpha = 0.55 * (1 - phase / 0.3);
          c2.strokeStyle = pal.hot;
          c2.lineWidth = 1;
          c2.beginPath();
          c2.moveTo(0, -4);
          c2.lineTo(dx * len * 0.5 - dy * j * 0.5, -4 + dy * len * 0.5 + dx * j * 0.5);
          c2.lineTo(dx * len - dy * j * 0.3, -4 + dy * len + dx * j * 0.3);
          c2.stroke();
        }
        for (let i = 0; i < 3; i++) {
          const a = t * 3 + i * TAU / 3;
          c2.globalAlpha = 0.5;
          c2.fillStyle = pal.core;
          c2.fillRect(Math.cos(a) * 15 * k - 0.8, Math.sin(a) * 7 * k - 6.8, 1.6, 1.6);
        }
        break;
      }
      case "nature": {
        c2.globalAlpha = 0.18;
        c2.fillStyle = pal.deep;
        c2.beginPath();
        c2.ellipse(0, 8, 17 * k, 7 * k, 0, 0, TAU);
        c2.fill();
        c2.globalCompositeOperation = "lighter";
        drawGlow(c2, 0, -4, 14 * k, pal.glow, 0.14);
        for (let i = 0; i < 3; i++) {
          const a = t * 1.1 + i * TAU / 3;
          const lx = Math.cos(a) * 15 * k, ly = Math.sin(a) * 7 * k - 7;
          const s = 2.6, rot = a + t;
          const ca = Math.cos(rot), sa = Math.sin(rot);
          c2.globalAlpha = 0.55;
          polygon(c2, [
            [lx + ca * s, ly + sa * s],
            [lx - sa * s * 0.45, ly + ca * s * 0.45],
            [lx - ca * s, ly - sa * s],
            [lx + sa * s * 0.45, ly - ca * s * 0.45]
          ], i % 2 ? "#9fe870" : pal.core);
        }
        for (let i = 0; i < 2; i++) {
          const cy = (t * 0.3 + i * 0.5) % 1;
          c2.globalAlpha = Math.sin(cy * Math.PI) * 0.5;
          c2.fillStyle = pal.hot;
          c2.fillRect((unit(i, 48) - 0.5) * 18 * k, -cy * 24 * k - 4, 1.4, 1.4);
        }
        break;
      }
      case "arcane": {
        c2.globalCompositeOperation = "lighter";
        drawGlow(c2, 0, -4, 16 * k, pal.glow, 0.16);
        const rr = 16 * k;
        c2.globalAlpha = 0.4;
        c2.strokeStyle = pal.core;
        c2.lineWidth = 1;
        c2.beginPath();
        c2.arc(0, -4, rr, 0, TAU);
        c2.stroke();
        for (let i = 0; i < 6; i++) {
          const a = t * 0.8 + i * TAU / 6;
          const rx = Math.cos(a) * rr, ry = Math.sin(a) * rr - 4;
          c2.globalAlpha = 0.6;
          c2.strokeStyle = pal.hot;
          c2.lineWidth = 0.9;
          c2.beginPath();
          c2.moveTo(rx * 0.8, (ry + 4) * 0.8 - 4);
          c2.lineTo(rx, ry);
          c2.stroke();
        }
        for (let i = 0; i < 3; i++) {
          const a = -t * 1.6 + i * TAU / 3;
          c2.globalAlpha = 0.55;
          c2.fillStyle = pal.hot;
          c2.fillRect(Math.cos(a) * rr * 0.6 - 0.8, Math.sin(a) * rr * 0.6 - 4.8, 1.6, 1.6);
        }
        break;
      }
      case "physical": {
        c2.globalCompositeOperation = "lighter";
        c2.globalAlpha = 0.14;
        c2.strokeStyle = pal.core;
        c2.lineWidth = 1;
        c2.beginPath();
        c2.ellipse(0, 6, 15 * k, 6 * k, 0, 0, TAU);
        c2.stroke();
        drawGlow(c2, 0, -4, 11 * k, pal.glow, 0.1);
        for (let i = 0; i < 2; i++) {
          const a = t * 2.6 + i * Math.PI;
          c2.globalAlpha = 0.5;
          c2.fillStyle = i ? pal.core : pal.hot;
          c2.fillRect(Math.cos(a) * 13 * k - 0.8, Math.sin(a) * 6 * k - 5.8, 1.6, 1.6);
        }
        break;
      }
    }
    c2.restore();
    return true;
  }

  // iconreview-tmp/school-entry.ts
  var schools = ["holy", "shadow", "fire", "frost", "lightning", "nature", "arcane", "physical"];
  var cv = document.getElementById("c");
  var c = cv.getContext("2d");
  c.fillStyle = "#0b1520";
  c.fillRect(0, 0, cv.width, cv.height);
  var cw = 130;
  var ch = 130;
  schools.forEach((s, i) => {
    const x = i * cw + cw / 2;
    for (const [row, t] of [[0, 0.18], [1, 0.35]]) {
      const y2 = row * ch + ch / 2;
      drawSchoolImpact(c, x, y2, s, t, 1, false);
    }
    const y = 2 * ch + ch / 2;
    schoolCastAura(c, x, y, s, 1.7, 1, false);
    c.fillStyle = "#9ab";
    c.font = "10px sans-serif";
    c.textAlign = "center";
    c.fillText(s, x, 2 * ch + ch - 8);
  });
})();
