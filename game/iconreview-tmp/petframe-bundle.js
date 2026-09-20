"use strict";
(() => {
  // src/control-bindings.ts
  var CONTROL_ACTIONS = [
    { id: "up", label: "Move up", group: "Movement", defaults: ["KeyW", "ArrowUp"], pad: "Left stick" },
    { id: "left", label: "Move left", group: "Movement", defaults: ["KeyA", "ArrowLeft"], pad: "Left stick" },
    { id: "down", label: "Move down", group: "Movement", defaults: ["KeyS", "ArrowDown"], pad: "Left stick" },
    { id: "right", label: "Move right", group: "Movement", defaults: ["KeyD", "ArrowRight"], pad: "Left stick" },
    { id: "attack", label: "Basic attack", group: "Combat", defaults: ["Mouse0", null], pad: "RT" },
    { id: "cycleTarget", label: "Target next enemy", group: "Combat", defaults: ["Tab", null], pad: "\u2014" },
    { id: "skill0", label: "Skill slot 1", group: "Combat", defaults: ["Digit1", "Mouse2"], pad: "LT" },
    { id: "skill1", label: "Skill slot 2", group: "Combat", defaults: ["Digit2", null], pad: "RB" },
    { id: "skill2", label: "Skill slot 3", group: "Combat", defaults: ["Digit3", null], pad: "X" },
    { id: "skill3", label: "Skill slot 4", group: "Combat", defaults: ["Digit4", null], pad: "Y" },
    { id: "skill4", label: "Skill slot 5", group: "Combat", defaults: ["Digit5", null], pad: "RS" },
    { id: "skill5", label: "Skill slot 6", group: "Combat", defaults: ["Digit6", null], pad: "\u2014" },
    { id: "skill6", label: "Skill slot 7", group: "Combat", defaults: ["Digit7", null], pad: "\u2014" },
    { id: "skill7", label: "Skill slot 8", group: "Combat", defaults: ["Digit8", null], pad: "\u2014" },
    { id: "skill8", label: "Skill slot 9", group: "Combat", defaults: ["Digit9", null], pad: "\u2014" },
    { id: "skill9", label: "Skill slot 10", group: "Combat", defaults: ["Digit0", null], pad: "\u2014" },
    { id: "skill10", label: "Skill slot 11", group: "Combat", defaults: ["Minus", null], pad: "\u2014" },
    { id: "skill11", label: "Skill slot 12", group: "Combat", defaults: ["Equal", null], pad: "\u2014" },
    { id: "racial", label: "Racial skill", group: "Combat", defaults: ["KeyR", null], pad: "\u2014" },
    { id: "dodge", label: "Dodge", group: "Combat", defaults: ["Space", null], pad: "B" },
    { id: "heal", label: "Potion", group: "Combat", defaults: ["KeyQ", null], pad: "LB" },
    { id: "revealLoot", label: "Reveal loot names", group: "Combat", defaults: ["ShiftLeft", "ShiftRight"], pad: "\u2014" },
    { id: "petCommand", label: "Pet command", group: "Combat", defaults: ["KeyF", null], pad: "\u2014" },
    { id: "interact", label: "Interact", group: "World & menus", defaults: ["KeyE", null], pad: "A" },
    { id: "portal", label: "Town portal", group: "World & menus", defaults: ["KeyP", null], pad: "D-pad \u2193" },
    { id: "character", label: "Character / inventory", group: "World & menus", defaults: ["KeyC", "KeyI"], pad: "D-pad \u2190 / \u2192" },
    { id: "skills", label: "Skill atlas", group: "World & menus", defaults: ["KeyT", null], pad: "D-pad \u2191" },
    { id: "journeys", label: "Journeys", group: "World & menus", defaults: ["KeyJ", null], pad: "Menu drawer" },
    { id: "map", label: "World map", group: "World & menus", defaults: ["KeyM", null], pad: "View" },
    { id: "sound", label: "Toggle sound", group: "World & menus", defaults: ["KeyN", null], pad: "Options" },
    { id: "debug", label: "Performance overlay", group: "World & menus", defaults: ["F3", null], pad: "\u2014" },
    { id: "mount", label: "Mount / dismount", group: "World & menus", defaults: ["KeyX", null], pad: "\u2014" },
    { id: "hearthstone", label: "Hearthstone", group: "World & menus", defaults: ["KeyH", null], pad: "\u2014" },
    { id: "questLog", label: "Quest log", group: "World & menus", defaults: ["KeyL", null], pad: "\u2014" },
    { id: "professions", label: "Professions", group: "World & menus", defaults: ["KeyK", null], pad: "\u2014" },
    { id: "achievements", label: "Achievements", group: "World & menus", defaults: ["KeyY", null], pad: "\u2014" },
    { id: "spellbook", label: "Spellbook", group: "World & menus", defaults: ["KeyB", null], pad: "\u2014" },
    { id: "stats", label: "Character stats", group: "World & menus", defaults: ["KeyZ", null], pad: "\u2014" },
    { id: "reputation", label: "Reputation", group: "World & menus", defaults: ["KeyO", null], pad: "\u2014" },
    { id: "editLayout", label: "Edit UI layout", group: "World & menus", defaults: ["KeyU", null], pad: "\u2014" },
    { id: "transmog", label: "Transmogrify", group: "World & menus", defaults: ["KeyG", null], pad: "\u2014" },
    { id: "nameplates", label: "Enemy nameplates", group: "World & menus", defaults: ["KeyV", null], pad: "\u2014" }
  ];
  var SKILL_ACTIONS = ["skill0", "skill1", "skill2", "skill3", "skill4", "skill5", "skill6", "skill7", "skill8", "skill9", "skill10", "skill11"];
  var CONTROL_STORAGE_KEY = "evergrow-controls-v2";
  function defaultControls() {
    return Object.fromEntries(CONTROL_ACTIONS.map((a) => [a.id, [...a.defaults]]));
  }
  function validControl(code) {
    return typeof code === "string" && /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Tab|Enter|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Shift(Left|Right)|F[1-9]|F10|Numpad([0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter)|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash|Mouse[0-4])$/.test(code) && code !== "F5";
  }
  var CONTROL_LABELS = { Mouse0: "LMB", Mouse1: "MMB", Mouse2: "RMB", Mouse3: "M4", Mouse4: "M5", Space: "Space", ArrowUp: "\u2191", ArrowDown: "\u2193", ArrowLeft: "\u2190", ArrowRight: "\u2192", ShiftLeft: "L Shift", ShiftRight: "R Shift", Backspace: "Bksp", Delete: "Del", Insert: "Ins", PageUp: "PgUp", PageDown: "PgDn", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'", Backquote: "`", Comma: ",", Period: ".", Slash: "/" };
  function controlLabel(code) {
    if (!code) return "\u2014";
    return CONTROL_LABELS[code] ?? code.replace(/^Key|^Digit/, "").replace(/^Numpad/, "Num ");
  }
  function parseControls(raw) {
    try {
      const saved = JSON.parse(raw ?? "null");
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return defaultControls();
      const map = saved, seen = /* @__PURE__ */ new Set();
      const parsed = {};
      for (const { id } of CONTROL_ACTIONS) {
        const pair = map[id];
        if (pair === void 0) {
          if (id === "revealLoot" || id === "petCommand") continue;
          return defaultControls();
        }
        if (!Array.isArray(pair) || pair.length !== 2) return defaultControls();
        for (const code of pair) {
          if (code === null) continue;
          if (!validControl(code) || seen.has(code)) return defaultControls();
          seen.add(code);
        }
        parsed[id] = [...pair];
      }
      for (const { id, defaults } of CONTROL_ACTIONS) {
        if (parsed[id]) continue;
        parsed[id] = defaults.map((code) => {
          if (code === null || seen.has(code)) return null;
          seen.add(code);
          return code;
        });
      }
      return parsed;
    } catch {
      return defaultControls();
    }
  }
  var ControlBindings = class {
    map;
    storage;
    listeners = /* @__PURE__ */ new Set();
    constructor(storage2) {
      this.storage = storage2;
      try {
        this.map = parseControls(storage2?.getItem(CONTROL_STORAGE_KEY) ?? null);
      } catch {
        this.map = defaultControls();
      }
    }
    get(action) {
      return [...this.map[action]];
    }
    has(action) {
      return this.map[action].some(Boolean);
    }
    label(action) {
      return controlLabel(this.map[action].find(Boolean));
    }
    action(code) {
      return CONTROL_ACTIONS.find((a) => this.map[a.id].includes(code))?.id;
    }
    subscribe(listener) {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }
    /** Explicit replacement removes the conflicting assignment before installing this binding. */
    bind(action, index, code, replace = false) {
      if (code !== null && !validControl(code)) return "invalid";
      const owner = code === null ? void 0 : this.action(code);
      if (owner && owner !== action && !replace) return "conflict";
      if (code) for (const { id } of CONTROL_ACTIONS) {
        const [first, second] = this.map[id];
        this.map[id] = [first === code ? null : first, second === code ? null : second];
      }
      const pair = [...this.map[action]];
      pair[index] = code;
      this.map[action] = pair;
      return this.commit();
    }
    reset() {
      this.map = defaultControls();
      return this.commit();
    }
    commit() {
      let result = "session";
      try {
        if (this.storage) {
          this.storage.setItem(CONTROL_STORAGE_KEY, JSON.stringify(this.map));
          result = "saved";
        }
      } catch {
      }
      this.listeners.forEach((listener) => listener());
      return result;
    }
  };

  // src/cursor-content.ts
  var CURSOR_STYLES = [
    {
      id: "crosshair",
      name: "Crosshair",
      description: "Bold ivory sight",
      color: "#fff3c4",
      path: "M-15 0H-6M6 0H15M0-15V-6M0 6V15"
    },
    {
      id: "halo",
      name: "Halo",
      description: "Cyan target ring",
      color: "#81f5ff",
      path: "M12 0A12 12 0 1 1-12 0A12 12 0 1 1 12 0M-17 0H-12M12 0H17M0-17V-12M0 12V17"
    },
    {
      id: "diamond",
      name: "Diamond",
      description: "Golden open center",
      color: "#ffdb69",
      path: "M0-16L16 0L0 16L-16 0Z"
    },
    {
      id: "arrow",
      name: "Arrow",
      description: "Ivory pointer \xB7 aim at tip",
      color: "#ffffff",
      path: "M0 0L3 28L10 21L17 32L23 28L16 17L26 15Z"
    }
  ];
  var DEFAULT_CURSOR = "crosshair";
  var CURSOR_STORAGE_KEY = "evergrow-cursor-v1";
  var CURSOR_SIZE_STORAGE_KEY = "evergrow-cursor-size-v1";
  var CURSOR_SIZE = Object.freeze({ min: 50, max: 250, step: 10, default: 100 });
  function validCursorSize(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= CURSOR_SIZE.min && value <= CURSOR_SIZE.max && value % CURSOR_SIZE.step === 0;
  }
  function isCursorStyle(value) {
    return CURSOR_STYLES.some((style) => style.id === value);
  }
  var CursorPreference = class {
    value = DEFAULT_CURSOR;
    sizeValue = CURSOR_SIZE.default;
    storage;
    constructor(storage2) {
      this.storage = storage2;
      try {
        const saved = storage2?.getItem(CURSOR_STORAGE_KEY);
        if (isCursorStyle(saved)) this.value = saved;
      } catch {
      }
      try {
        const saved = Number(storage2?.getItem(CURSOR_SIZE_STORAGE_KEY));
        if (validCursorSize(saved)) this.sizeValue = saved;
      } catch {
      }
    }
    get style() {
      return this.value;
    }
    get size() {
      return this.sizeValue;
    }
    select(value) {
      if (!isCursorStyle(value)) return "invalid";
      this.value = value;
      return this.persist(CURSOR_STORAGE_KEY, value);
    }
    setSize(value) {
      if (!validCursorSize(value)) return "invalid";
      this.sizeValue = value;
      return this.persist(CURSOR_SIZE_STORAGE_KEY, String(value));
    }
    reset() {
      const style = this.select(DEFAULT_CURSOR), size = this.setSize(CURSOR_SIZE.default);
      return style === "saved" && size === "saved" ? "saved" : "session";
    }
    persist(key, value) {
      try {
        if (this.storage) {
          this.storage.setItem(key, value);
          return "saved";
        }
      } catch {
      }
      return "session";
    }
  };

  // src/control-preferences.ts
  var storage;
  try {
    if (typeof window !== "undefined") storage = window.localStorage;
  } catch {
  }
  var controls = new ControlBindings(storage);
  var cursorPreference = new CursorPreference(storage);

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
  function isAura(id) {
    return !!id && Object.hasOwn(AURAS, id);
  }
  function resolveAura(id, rank = 1) {
    const r = Math.max(1, Math.min(AURA_RULES.maximumRank, rank)), base = AURAS[id];
    return { id, rank: r, reservation: base.reservation - (r - 1) * AURA_RULES.rankReservation, power: base.power * (1 + (r - 1) * AURA_RULES.rankPower) };
  }

  // src/resistance-content.ts
  var RESISTANCE_LABELS = Object.freeze({
    fireResistance: "Fire resistance",
    frostResistance: "Frost resistance",
    lightningResistance: "Lightning resistance",
    arcaneResistance: "Arcane resistance",
    holyResistance: "Holy resistance",
    shadowResistance: "Shadow resistance",
    natureResistance: "Nature resistance",
    allResistance: "All elemental resistances"
  });
  var RESISTANCE_RULES = Object.freeze({ cap: 0.75, singleAffixCap: 24, allAffixCap: 8 });
  var RESISTANCE_AFFIXES = Object.freeze([
    { name: "Cinderskin", stat: "fireResistance", base: 10, growth: 0.12, weight: 0.15 },
    { name: "Rimeward", stat: "frostResistance", base: 10, growth: 0.12, weight: 0.15 },
    { name: "Stormward", stat: "lightningResistance", base: 10, growth: 0.12, weight: 0.15 },
    { name: "Spellward", stat: "arcaneResistance", base: 10, growth: 0.12, weight: 0.15 },
    { name: "Lightward", stat: "holyResistance", base: 10, growth: 0.12, weight: 0.15 },
    { name: "Duskward", stat: "shadowResistance", base: 10, growth: 0.12, weight: 0.15 },
    { name: "Wildward", stat: "natureResistance", base: 10, growth: 0.12, weight: 0.15 },
    { name: "Sanctuary", stat: "allResistance", base: 3, growth: 0.035, weight: 0.1 }
  ].map((a) => Object.freeze(a)));
  var PROJECTILE_DAMAGE = Object.freeze({
    arrow: "physical",
    fire: "fire",
    frost: "frost",
    lightning: "lightning",
    arcane: "arcane",
    spirit: "arcane",
    radiant: "arcane",
    holy: "holy",
    shadow: "shadow",
    nature: "nature"
  });

  // src/wilderness-boss-content.ts
  var LAIR_RULES = Object.freeze({
    radius: 370,
    leash: 670,
    awareness: 430,
    sweepReach: 150,
    sweepArc: Math.PI * 1.2,
    rushLength: 330,
    rushWidth: 32,
    fractureLength: 410,
    fractureWidth: 24,
    eruptionRadius: 105,
    rallyRadius: 480,
    rallyDuration: 6
  });
  var BOSS_PALETTES = Object.freeze({ briarMatriarch: "#91c67f", ashColossus: "#ffac61", graveMarshal: "#b4a3eb" });
  var BOSS_NAMES = Object.freeze({ briarMatriarch: "Briar Matriarch", ashColossus: "Ashbound Colossus", graveMarshal: "Grave Marshal" });

  // src/rift-content.ts
  var RIFT_RULES = Object.freeze({ minimumLevel: 20, guardianArrival: 2.4, duration: 600, progress: 600, offset: 10, rewards: 8, keyUpgradeChance: 0.35, maximumKeyTier: 5, goldMultiplier: 6 });
  var NO_MODIFIERS = Object.freeze([]);

  // src/enemy-modifiers.ts
  var TRAITS = Object.freeze([
    Object.freeze({ id: "swift", color: "#7ce4ed", label: "Swift", name: "Swift", description: "+15% movement speed", speed: 1.15, recovery: 1, damage: 1, control: 1 }),
    Object.freeze({ id: "relentless", color: "#ffc774", label: "Relentless", name: "Relentless", description: "20% shorter attack recovery", speed: 1, recovery: 0.8, damage: 1, control: 1 }),
    Object.freeze({ id: "savage", color: "#f8799a", label: "Savage", name: "Savage", description: "+10% damage", speed: 1, recovery: 1, damage: 1.1, control: 1 }),
    Object.freeze({ id: "resolute", color: "#caa4fc", label: "Resolute", name: "Resolute", description: "25% shorter control effects", speed: 1, recovery: 1, damage: 1, control: 0.75 })
  ]);
  var EMPTY = Object.freeze([]);
  var SETS = Array.from({ length: 8 }, (_, i) => Object.freeze(i < 4 ? [TRAITS[i]] : [TRAITS[i - 4], TRAITS[(i - 4 + 1) % 4]]));

  // src/enemy-threat.ts
  var ENEMY_THREAT = Object.freeze({
    normal: Object.freeze({ damage: 1, recovery: 1, controlFactor: 1, controlMaximum: Infinity, controlRest: 0, knockback: 1 }),
    veteran: Object.freeze({ damage: 1, recovery: 1, controlFactor: 0.8, controlMaximum: 1, controlRest: 3.5, knockback: 0.65 }),
    elite: Object.freeze({ damage: 1.25, recovery: 0.65, controlFactor: 0.5, controlMaximum: 0.6, controlRest: 4, knockback: 0.35 }),
    boss: Object.freeze({ damage: 1.25, recovery: 0.65, controlFactor: 0.25, controlMaximum: 0.35, controlRest: 2.5, knockback: 0.15 })
  });

  // src/biomes.ts
  var BIOME_IDS = Object.freeze(["deadwood", "verdant", "swamp", "frostpine", "emberfall", "autumn", "highlands", "steppe", "sunscar"]);
  var BIOMES = Object.freeze({
    steppe: { id: "steppe", name: "Whispering Steppe", description: "Wind-combed grasslands, thorn thickets and solitary weathered stones.", color: "#85815a", ground: [76, 80, 45], moss: [19, 24, 7], ambient: [184, 188, 159] },
    sunscar: { id: "sunscar", name: "Sunscar Expanse", description: "Pale wind-carved sand, weathered sandstone and sheltered desert scrub.", color: "#b6956b", ground: [139, 108, 70], moss: [16, 11, 3], ambient: [210, 184, 150] },
    deadwood: {
      id: "deadwood",
      name: "Deadwood",
      description: "Ashen trunks, old shrines and pale fungi among the burial woods.",
      color: "#354a51",
      ground: [22, 40, 43],
      moss: [10, 35, 13],
      ambient: [131, 156, 174]
    },
    verdant: {
      id: "verdant",
      name: "Verdant Forest",
      description: "Deep green canopies, ferns and luminous woodland flowers.",
      color: "#396348",
      ground: [28, 57, 34],
      moss: [15, 39, 10],
      ambient: [121, 172, 153]
    },
    swamp: {
      id: "swamp",
      name: "The Mire",
      description: "Willows, reeds and pale lilies over shallow pools beneath cool mist.",
      color: "#315f64",
      ground: [21, 47, 50],
      moss: [8, 22, 17],
      ambient: [114, 160, 159]
    },
    frostpine: {
      id: "frostpine",
      name: "Frostpine Reach",
      description: "Frost-laden conifers, blue crystal outcrops and scattered snow.",
      color: "#879fa8",
      ground: [68, 86, 96],
      moss: [17, 24, 25],
      ambient: [143, 167, 192]
    },
    emberfall: {
      id: "emberfall",
      name: "Emberfall",
      description: "Blackened trees, split basalt and smouldering embers in ash.",
      color: "#70504d",
      ground: [47, 32, 34],
      moss: [23, 7, 2],
      ambient: [184, 139, 132]
    },
    autumn: {
      id: "autumn",
      name: "Amberwood",
      description: "Copper crowns, golden leaves and old roots beneath an amber canopy.",
      color: "#867547",
      ground: [45, 46, 29],
      moss: [26, 18, 4],
      ambient: [170, 163, 135]
    },
    highlands: {
      id: "highlands",
      name: "Hollow Highlands",
      description: "Wind-bent trees, pale limestone and heather on weathered moorland.",
      color: "#625c78",
      ground: [42, 42, 51],
      moss: [15, 12, 23],
      ambient: [145, 151, 179]
    }
  });
  for (const id of BIOME_IDS) {
    Object.freeze(BIOMES[id].ground);
    Object.freeze(BIOMES[id].moss);
    Object.freeze(BIOMES[id].ambient);
    Object.freeze(BIOMES[id]);
  }
  var BIOME_FIELD_RULES = Object.freeze({
    regionSize: 6400,
    influenceRadius: 1.18,
    startingCore: 1100,
    startingBlendEnd: 2600,
    cacheLimit: 512
  });
  var TAU = Math.PI * 2;
  var mapColors = Object.fromEntries(BIOME_IDS.map((id) => [id, [1, 3, 5].map((offset) => parseInt(BIOMES[id].color.slice(offset, offset + 2), 16))]));

  // src/world-query.ts
  var WORLD_QUERY_LIMITS = Object.freeze({
    span: 262144,
    propCells: 65536,
    movement: 4096,
    collisionRadius: 1024
  });

  // src/hydrology.ts
  var HYDROLOGY = Object.freeze({ spacing: 4800, bucket: 512, nodes: 4096, features: 1024, buckets: 512 });
  var DRY_WATER = Object.freeze({ coverage: 0, depth: 0, flowX: 0, flowY: 0, bank: 0, kind: "dry" });

  // src/world-geography.ts
  var GEOGRAPHY_RULES = Object.freeze({ settlementSpacing: 11e3, jitter: 0.22, cacheLimit: 512 });

  // src/progression-content.ts
  var MAX_CONTENT_LEVEL = 1e6;
  var normalizeLevel = (level) => Math.max(1, Math.min(
    MAX_CONTENT_LEVEL,
    Math.floor(Number.isFinite(level) ? level : 1)
  ));
  var ENEMY_RANKS = Object.freeze({
    normal: Object.freeze({ name: "Normal", color: "#c5ccc8", healthMultiplier: 1, damageMultiplier: 1, xpMultiplier: 1 }),
    veteran: Object.freeze({ name: "Champion", color: "#76b9ee", healthMultiplier: 1.8, damageMultiplier: 1.2, xpMultiplier: 2 }),
    elite: Object.freeze({ name: "Elite", color: "#e0c17a", healthMultiplier: 4, damageMultiplier: 1.5, xpMultiplier: 5 })
  });
  var monsterExperienceScale = (level) => 1 + 0.18 * (normalizeLevel(level) - 1);
  var ELITE_DURABILITY = Object.freeze({ startLevel: 14, fullLevel: 37, maximumBonus: 0.5 });

  // src/mana-content.ts
  var MANA_RULES = Object.freeze({
    perIntelligence: 2,
    regenerationPeriod: 5,
    costKnee: 20,
    maxCostReduction: 40,
    vialBase: 8,
    vialPerLevel: 0.35,
    vialMaxFraction: 0.16
  });

  // src/combat-content.ts
  var COMBAT_TIMING = Object.freeze({
    fixedStep: 1 / 120,
    hitFlashDuration: 0.16,
    inputBuffer: 0.11,
    attackBuffer: 0.22,
    hurtGuard: 0.3,
    knockbackDecay: 0.065,
    staggerDuration: 0.16,
    interruptedRecovery: 0.3
  });
  var PLAYER_DEFAULTS = Object.freeze({ maxHp: 100, maxMana: 100, manaRegeneration: 1, radius: 9 });
  var SKILL_CAST_MOTION = Object.freeze({ releaseRemainingFraction: 0.145 / 0.22 });
  var RANGED_BASIC_ATTACK_PHASES = Object.freeze({ activeStart: 0.42, activeEnd: 0.5 });
  var BASIC_ATTACK_PHASES = Object.freeze({ activeStart: 0.19, activeEnd: 0.45 });
  var PLAYER_ABILITIES = Object.freeze({
    basicAttack: Object.freeze({ ...BASIC_ATTACK_PHASES, bladeHalfAngle: 0.055 }),
    dodge: Object.freeze({
      charges: 2,
      recharge: 1.8,
      duration: 0.22,
      speed: 360,
      invulnerabilityStart: 0.02,
      invulnerabilityEnd: 0.18
    }),
    potion: Object.freeze({ charges: 2, lifeFraction: 0.42, manaFraction: 0.4, cooldown: 0.8, flashDuration: 0.5, killsPerCharge: 8 })
  });
  var PLAYER_MOVEMENT = Object.freeze({
    speed: 165,
    stopThreshold: 0.4,
    gaitDistance: 22,
    castMultiplier: 0.88,
    response: Object.freeze({ stop: 0.025, reverse: 0.028, accelerate: 0.045 }),
    attackMultiplier: Object.freeze({ windup: 0.92, active: 0.87, recovery: 0.96 })
  });
  var PROJECTILE_DEFINITIONS = Object.freeze({
    hex: Object.freeze({ owner: "enemy", speed: 145, life: 2.7, radius: 5, damage: 13 }),
    boneArrow: Object.freeze({ owner: "enemy", speed: 235, life: 2.3, radius: 3, damage: 11 })
  });
  var ENEMY_DEFINITIONS = Object.freeze({
    thornReaver: Object.freeze({
      name: "Thorn Reaver",
      hp: 76,
      xpReward: 32,
      radius: 13,
      speed: 93,
      windup: 0.45,
      active: 0.2,
      recovery: 0.66,
      range: 39,
      damage: 12,
      aimLock: 0.23,
      attack: "melee",
      arc: Math.PI * 0.7,
      lungeSpeed: 45,
      awarenessDistance: 370,
      preferredDistance: 35,
      role: "flanker",
      knockbackDistance: 10,
      interruptible: true,
      beast: "raptor"
    }),
    mireSpitter: Object.freeze({
      name: "Mire Spitter",
      hp: 61,
      xpReward: 31,
      radius: 13,
      speed: 67,
      windup: 0.7,
      active: 0.14,
      recovery: 0.8,
      range: 290,
      damage: 12,
      aimLock: 0.25,
      attack: "projectile",
      projectile: Object.freeze({ owner: "enemy", speed: 170, life: 2.1, radius: 5, damage: 12 }),
      projectileStyle: "spirit",
      shotOffsets: Object.freeze([0]),
      maxAttackDistance: 250,
      retreatDistance: 70,
      awarenessDistance: 390,
      preferredDistance: 180,
      role: "ranged",
      knockbackDistance: 12,
      interruptible: true,
      beast: "windSerpent"
    }),
    frostRevenant: Object.freeze({
      name: "Rime Revenant",
      hp: 115,
      xpReward: 43,
      radius: 15,
      speed: 74,
      windup: 0.72,
      active: 0.2,
      recovery: 0.86,
      range: 44,
      damage: 17,
      aimLock: 0.4,
      attack: "melee",
      arc: Math.PI * 0.85,
      lungeSpeed: 20,
      awarenessDistance: 370,
      preferredDistance: 40,
      role: "heavy",
      knockbackDistance: 7,
      interruptible: false
    }),
    emberAcolyte: Object.freeze({
      name: "Ember Acolyte",
      hp: 54,
      xpReward: 34,
      radius: 11,
      speed: 87,
      windup: 0.7,
      active: 0.14,
      recovery: 0.75,
      range: 315,
      damage: 14,
      aimLock: 0.25,
      attack: "projectile",
      projectile: Object.freeze({ owner: "enemy", speed: 190, life: 2, radius: 5, damage: 14 }),
      projectileStyle: "fire",
      shotOffsets: Object.freeze([0]),
      maxAttackDistance: 270,
      retreatDistance: 90,
      awarenessDistance: 410,
      preferredDistance: 220,
      role: "ranged",
      knockbackDistance: 16,
      interruptible: true
    }),
    duneScuttler: Object.freeze({
      name: "Dune Scuttler",
      hp: 43,
      xpReward: 25,
      radius: 10,
      speed: 120,
      windup: 0.44,
      active: 0.16,
      recovery: 0.64,
      range: 29,
      damage: 9,
      aimLock: 0.22,
      attack: "melee",
      arc: Math.PI * 0.65,
      lungeSpeed: 55,
      awarenessDistance: 370,
      preferredDistance: 24,
      role: "flanker",
      knockbackDistance: 15,
      interruptible: true,
      beast: "cat"
    }),
    stormSentinel: Object.freeze({
      name: "Storm Sentinel",
      hp: 82,
      xpReward: 39,
      radius: 13,
      speed: 72,
      windup: 0.75,
      active: 0.14,
      recovery: 0.85,
      range: 320,
      damage: 15,
      aimLock: 0.24,
      attack: "projectile",
      projectile: Object.freeze({ owner: "enemy", speed: 175, life: 2.2, radius: 4, damage: 15 }),
      projectileStyle: "lightning",
      shotOffsets: Object.freeze([0]),
      maxAttackDistance: 270,
      retreatDistance: 100,
      awarenessDistance: 420,
      preferredDistance: 225,
      role: "ranged",
      knockbackDistance: 8,
      interruptible: true
    }),
    briarMatriarch: Object.freeze({ name: "Briar Matriarch", hp: 1450, xpReward: 160, radius: 27, speed: 88, windup: 0.85, active: 0.28, recovery: 1.1, range: LAIR_RULES.sweepReach, damage: 21, aimLock: 0, attack: "melee", arc: LAIR_RULES.sweepArc, lungeSpeed: 0, awarenessDistance: 430, preferredDistance: 110, role: "heavy", knockbackDistance: 0, interruptible: false }),
    ashColossus: Object.freeze({ name: "Ashbound Colossus", hp: 1900, xpReward: 160, radius: 27, speed: 57, windup: 0.85, active: 0.28, recovery: 1.1, range: LAIR_RULES.sweepReach, damage: 26, aimLock: 0, attack: "melee", arc: LAIR_RULES.sweepArc, lungeSpeed: 0, awarenessDistance: 430, preferredDistance: 110, role: "heavy", knockbackDistance: 0, interruptible: false }),
    graveMarshal: Object.freeze({ name: "Grave Marshal", hp: 1650, xpReward: 160, radius: 27, speed: 75, windup: 0.85, active: 0.28, recovery: 1.1, range: LAIR_RULES.sweepReach, damage: 23, aimLock: 0, attack: "melee", arc: LAIR_RULES.sweepArc, lungeSpeed: 0, awarenessDistance: 430, preferredDistance: 110, role: "heavy", knockbackDistance: 0, interruptible: false }),
    warden: Object.freeze({ name: "The Hollow Warden", hp: 1800, xpReward: 120, radius: 24, speed: 66, windup: 0.9, active: 0.22, recovery: 0.8, range: 125, damage: 18, aimLock: 0.1, attack: "melee", arc: Math.PI * 1.3, lungeSpeed: 0, awarenessDistance: 700, preferredDistance: 100, role: "heavy", knockbackDistance: 0, interruptible: false }),
    goblin: Object.freeze({
      name: "Scrap Goblin",
      hp: 22,
      xpReward: 6,
      radius: 6,
      speed: 132,
      windup: 0.38,
      active: 0.15,
      recovery: 0.48,
      range: 22,
      damage: 5,
      aimLock: 0.18,
      attack: "melee",
      arc: Math.PI * 0.55,
      lungeSpeed: 70,
      awarenessDistance: 350,
      preferredDistance: 30,
      role: "flanker",
      knockbackDistance: 22,
      interruptible: true
    }),
    goblinChief: Object.freeze({
      name: "Goblin War Chief",
      hp: 170,
      xpReward: 65,
      radius: 13,
      speed: 86,
      windup: 0.78,
      active: 0.2,
      recovery: 0.72,
      range: 43,
      damage: 17,
      aimLock: 0.46,
      attack: "melee",
      arc: Math.PI * 0.95,
      lungeSpeed: 35,
      awarenessDistance: 410,
      preferredDistance: 55,
      role: "heavy",
      knockbackDistance: 7,
      interruptible: false
    }),
    stalker: Object.freeze({
      name: "Hollow Stalker",
      hp: 48,
      xpReward: 20,
      radius: 10,
      speed: 104,
      windup: 0.42,
      active: 0.18,
      recovery: 0.624,
      range: 28,
      damage: 8,
      aimLock: 0.2,
      attack: "melee",
      arc: Math.PI * 0.7,
      lungeSpeed: 48,
      awarenessDistance: 330,
      preferredDistance: 48,
      role: "flanker",
      knockbackDistance: 14,
      interruptible: true,
      beast: "cat"
    }),
    brute: Object.freeze({
      name: "Gravebound Brute",
      hp: 138,
      xpReward: 50,
      radius: 17,
      speed: 65,
      windup: 0.95,
      active: 0.18,
      recovery: 0.96,
      range: 53,
      damage: 22,
      aimLock: 0.6,
      attack: "melee",
      arc: Math.PI * 1.15,
      lungeSpeed: 0,
      awarenessDistance: 340,
      preferredDistance: 55,
      role: "heavy",
      knockbackDistance: 5,
      interruptible: false,
      beast: "bear"
    }),
    caster: Object.freeze({
      name: "Mire Hexer",
      hp: 56,
      xpReward: 30,
      radius: 11,
      speed: 76,
      windup: 0.75,
      active: 0.15,
      recovery: 0.8,
      range: 280,
      damage: PROJECTILE_DEFINITIONS.hex.damage,
      aimLock: 0.34,
      attack: "projectile",
      projectile: PROJECTILE_DEFINITIONS.hex,
      projectileStyle: "spirit",
      shotOffsets: Object.freeze([0, -0.22, 0.22]),
      maxAttackDistance: 255,
      retreatDistance: 130,
      awarenessDistance: 400,
      preferredDistance: 205,
      role: "ranged",
      knockbackDistance: 14,
      interruptible: true
    }),
    hound: Object.freeze({
      name: "Briar Hound",
      hp: 37,
      xpReward: 22,
      radius: 10,
      speed: 124,
      windup: 0.68,
      active: 0.28,
      recovery: 0.76,
      range: 23,
      damage: 10,
      aimLock: 0.22,
      attack: "melee",
      arc: Math.PI * 0.48,
      lungeSpeed: 320,
      engageDistance: 112,
      awarenessDistance: 370,
      preferredDistance: 105,
      role: "skirmisher",
      knockbackDistance: 17,
      interruptible: true,
      beast: "wolf"
    }),
    archer: Object.freeze({
      name: "Ashen Ranger",
      hp: 45,
      xpReward: 28,
      radius: 10,
      speed: 96,
      windup: 0.7,
      active: 0.12,
      recovery: 0.68,
      range: 335,
      damage: PROJECTILE_DEFINITIONS.boneArrow.damage,
      aimLock: 0.32,
      attack: "projectile",
      projectile: PROJECTILE_DEFINITIONS.boneArrow,
      projectileStyle: "arrow",
      shotOffsets: Object.freeze([0]),
      maxAttackDistance: 290,
      retreatDistance: 160,
      awarenessDistance: 430,
      preferredDistance: 245,
      role: "ranged",
      knockbackDistance: 15,
      interruptible: true
    }),
    wisp: Object.freeze({
      name: "Lantern Wisp",
      hp: 39,
      xpReward: 32,
      radius: 9,
      speed: 73,
      windup: 1.3,
      active: 0.15,
      recovery: 1.12,
      range: 275,
      damage: 17,
      aimLock: 0.22,
      attack: "ground",
      blastRadius: 52,
      maxAttackDistance: 245,
      retreatDistance: 115,
      awarenessDistance: 390,
      preferredDistance: 210,
      role: "ranged",
      knockbackDistance: 18,
      interruptible: true
    })
  });
  var REGIONAL_ENEMY_KINDS = Object.freeze(["thornReaver", "mireSpitter", "frostRevenant", "emberAcolyte", "duneScuttler", "stormSentinel"]);
  var ENEMY_SIGNATURE_ATTACKS = Object.freeze({
    thornReaver: Object.freeze({
      ...ENEMY_DEFINITIONS.thornReaver,
      attack: "melee",
      arc: Math.PI * 1.3,
      lungeSpeed: 0,
      range: 70,
      damage: 19,
      windup: 0.95,
      aimLock: 0.6,
      active: 0.24,
      recovery: 1.1
    }),
    mireSpitter: Object.freeze({
      ...ENEMY_DEFINITIONS.mireSpitter,
      attack: "ground",
      blastRadius: 60,
      blastStyle: "spirit",
      maxAttackDistance: 250,
      retreatDistance: 0,
      damage: 19,
      windup: 1.25,
      aimLock: 0.2,
      recovery: 1.1
    }),
    frostRevenant: Object.freeze({
      ...ENEMY_DEFINITIONS.frostRevenant,
      attack: "ground",
      blastRadius: 65,
      blastStyle: "frost",
      range: 180,
      maxAttackDistance: 180,
      retreatDistance: 0,
      damage: 25,
      windup: 1.25,
      aimLock: 0.25,
      recovery: 1.15
    }),
    emberAcolyte: Object.freeze({
      ...ENEMY_DEFINITIONS.emberAcolyte,
      attack: "ground",
      blastRadius: 76,
      blastStyle: "fire",
      maxAttackDistance: 270,
      retreatDistance: 0,
      damage: 23,
      windup: 1.4,
      aimLock: 0.25,
      recovery: 1.2
    }),
    duneScuttler: Object.freeze({
      ...ENEMY_DEFINITIONS.duneScuttler,
      attack: "melee",
      arc: Math.PI * 0.45,
      lungeSpeed: 340,
      engageDistance: 140,
      range: 30,
      damage: 16,
      windup: 0.85,
      aimLock: 0.2,
      active: 0.32,
      recovery: 0.95
    }),
    stormSentinel: Object.freeze({
      ...ENEMY_DEFINITIONS.stormSentinel,
      attack: "projectile",
      projectile: Object.freeze({ owner: "enemy", speed: 210, life: 1.7, radius: 5, damage: 11 }),
      projectileStyle: "lightning",
      shotOffsets: Object.freeze([-0.44, -0.22, 0, 0.22, 0.44]),
      warning: true,
      maxAttackDistance: 270,
      retreatDistance: 70,
      damage: 11,
      windup: 1.25,
      aimLock: 0.2,
      recovery: 1.3
    })
  });
  var ELITE_QUICK_ATTACKS = Object.freeze(
    Object.fromEntries(Object.entries(ENEMY_DEFINITIONS).filter(([kind, d]) => !["warden", "briarMatriarch", "ashColossus", "graveMarshal"].includes(kind) && d.attack !== "ground" && !(d.attack === "melee" && d.engageDistance)).map(([kind, d]) => {
      const windup = d.attack === "melee" ? Math.min(d.windup, 0.5) : 0.6;
      const quick = d.attack === "melee" ? {
        ...d,
        windup,
        aimLock: Math.max(0, windup - 0.22),
        active: Math.min(d.active, 0.18),
        recovery: Math.min(d.recovery, 0.6),
        damage: d.damage * 0.75,
        arc: Math.min(d.arc, Math.PI * 0.8)
      } : d.attack === "projectile" ? {
        ...d,
        windup,
        aimLock: 0.3,
        recovery: Math.min(d.recovery, 0.65),
        damage: d.damage * 0.75,
        projectile: Object.freeze({ ...d.projectile, damage: d.damage * 0.75 }),
        shotOffsets: Object.freeze([0])
      } : d;
      return [kind, Object.freeze(quick)];
    }))
  );
  var ENEMY_AI_RULES = Object.freeze({
    senseInterval: 0.12,
    awarenessSeconds: 0.16,
    hearingDistance: 72,
    loseSightAfter: 4.5,
    tetherDistance: 650,
    returnStopDistance: 12,
    patrolRadius: 36,
    patrolSpeed: 0.28,
    arrivalResponse: 3,
    locomotionTurnSpeed: 5,
    separationPadding: 9,
    flankAngle: 0.45,
    pursuitSpeedMultiplier: 1.15
  });
  var LOOT_RULES = Object.freeze({
    maxGroundItems: 1024,
    equipmentCollectDistance: 30,
    maxPickups: 32,
    life: 20,
    radius: 4,
    healthEveryKills: 3,
    healthFraction: 0.12,
    manaFraction: MANA_RULES.vialMaxFraction,
    collectDistance: 18,
    magnetDistance: 55,
    magnetSpeed: 100
  });

  // src/zone-progression.ts
  var ZONE_RULES = Object.freeze({ regionSize: 3600, travelPerLevel: 6e3 });

  // src/equipment.ts
  var STARTING_SWORD = Object.freeze({
    id: "weathered-sword",
    name: "Weathered Sword",
    family: "sword",
    hands: 2,
    attackKind: "melee",
    damageType: "physical",
    baseAttacksPerSecond: 2,
    damage: 24,
    reach: 60,
    arc: 135 * Math.PI / 180,
    visual: Object.freeze({ kind: "sword", length: 30, width: 3.4, metal: "#86b3a3", edge: "#f7e8b8", grip: "#715332", gripLength: 12, guard: "#dba25b" })
  });
  var WEAPON_ACTION_RULES = Object.freeze({ speedMultiplier: 0.8, staffBasicManaCost: 4, wandBasicManaCost: 2 });
  function basicAttackManaCost(weapon2, stats) {
    if (weapon2.attackKind !== "bolt") return 0;
    return Math.max(1, Math.round((weapon2.family === "wand" ? WEAPON_ACTION_RULES.wandBasicManaCost : WEAPON_ACTION_RULES.staffBasicManaCost) * stats.manaCostMultiplier * 10) / 10);
  }
  var UNARMED_WEAPON = {
    id: "unarmed",
    name: "Unarmed",
    family: "unarmed",
    hands: 1,
    attackKind: "melee",
    damageType: "physical",
    damage: 5,
    baseAttacksPerSecond: 1.8,
    reach: 24,
    arc: Math.PI / 2,
    visual: { ...STARTING_SWORD.visual, kind: "unarmed", length: 0, width: 0 }
  };
  function alternatesBasicAttacks(equipment) {
    return equipment.mainHand.hands === 1 && equipment.mainHand.family !== "unarmed" && equipment.offHand?.kind === "weapon" && equipment.offHand.weapon.hands === 1;
  }
  function basicAttackWeapon(player) {
    if (player.attack) return player.attack.weapon;
    const off = player.equipment.offHand;
    return alternatesBasicAttacks(player.equipment) && player.nextAttackHand === "off" && off?.kind === "weapon" ? off.weapon : player.equipment.mainHand;
  }

  // src/combat-status.ts
  var STATUS_RULES = Object.freeze({ burnInterval: 0.5 });
  var DIMINISHING_RULES = Object.freeze({ window: 15, minimum: 0.25, immuneAt: 3 });
  var ELEMENTAL_CONTACT = Object.freeze({ burnDuration: 2, burnFractionPerSecond: 0.15, chillDuration: 1.5, chillFactor: 0.8, lightningInterrupt: 0.12 });

  // src/auras.ts
  function auraPower(p2, id) {
    return p2.dead ? 0 : p2.auras?.powers[id] ?? 0;
  }
  function manaCapacity(p2) {
    return Math.max(1, Math.floor(p2.maxMana * (1 - (p2.auras?.reservation ?? 0) / 100) + 1e-9));
  }

  // src/skill-tree-balance.ts
  var BORROWED_FLAME = Object.freeze({ node: "keystone:borrowed-flame", empoweredMultiplier: 1.4, baselineMultiplier: 0.85 });

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
      execution: { kind: "strike", cc: { kind: "incapacitate", duration: 3 } }
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
      description: "Hurl a freezing trap at the target point, freezing the nearest enemy for 6 seconds.",
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
      targetMode: "point",
      range: 420,
      channel: { duration: 4, ticks: 8 },
      description: "Channel a rain of arrows over the target area for 4 seconds.",
      execution: { kind: "channel", school: "physical", ticks: 8, duration: 4, radius: 140, targetRange: 420 }
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
      damageMultiplier: 1.6,
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
      description: "Your pet intercepts half the damage you take for 30 seconds.",
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
      description: "A soothing shot that calms your target, slowing it by 50% for 4 seconds.",
      execution: { kind: "projectile", speed: 640, radius: 4, offsets: [0], effects: { style: "spirit", slowFactor: 0.5, slowDuration: 4 } }
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
      execution: { kind: "heal", amount: 0, maxHpFrac: 0.15, hotFrac: 0.03, hot: { duration: 15, interval: 1 }, pet: "mend" }
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
      description: "Command your pet to intimidate the target, incapacitating it for 3 seconds. Any damage breaks the effect.",
      execution: { kind: "cc", cc: "incapacitate", duration: 3 }
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
      description: "A stinging shot that freezes your target for 6 seconds while venom eats at it.",
      execution: { kind: "projectile", speed: 560, radius: 5, offsets: [0], effects: { style: "nature" }, cc: { kind: "freeze", duration: 6 }, dot: { school: "nature", dpsMultiplier: 0.2, duration: 6 } }
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
      execution: { kind: "summon", ally: "shadowfiend", count: 1, duration: 12 }
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
      execution: { kind: "buff", buff: { duration: 10, breakControl: true } }
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
      execution: { kind: "buff", buff: { duration: 10, stats: { maxHpPercent: 15 }, healPerSecond: 0.02, leech: 0.1 } }
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
      targetMode: "self",
      runeCost: { blood: 1 },
      runicPowerGain: 10,
      description: "Your blood marks your strikes: a portion of the damage you deal returns as healing for 20 seconds.",
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
      execution: { kind: "summon", ally: "gargoyle", count: 1, duration: 30 }
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
      execution: { kind: "buff", buff: { duration: 60, reduction: 0.2 } }
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
      requiresAlly: "ghoul",
      description: "Sacrifice an undead minion to restore 40% of your maximum health.",
      execution: { kind: "heal", amount: 0, maxHpFrac: 0.4, consumeAlly: "ghoul" }
    },
    {
      id: "hornOfWinter",
      name: "Horn of Winter",
      classId: "deathKnight",
      requirement: "any",
      domain: "Might",
      tier: "basic",
      manaCost: 0,
      cooldown: 20,
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
      execution: { kind: "summon", ally: "magmaTotem", count: 1, duration: 30 }
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
      execution: { kind: "summon", ally: "manaSpringTotem", count: 1, duration: 45 }
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
      execution: { kind: "summon", ally: "totemOfWrath", count: 1, duration: 45 }
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
      execution: { kind: "summon", ally: "wrathOfAirTotem", count: 1, duration: 45 }
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
      execution: { kind: "summon", ally: "windfuryTotem", count: 1, duration: 45 }
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
      execution: { kind: "summon", ally: "strengthOfEarthTotem", count: 1, duration: 45 }
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
      execution: { kind: "summon", ally: "stoneskinTotem", count: 1, duration: 45 }
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
      execution: { kind: "summon", ally: "flametongueTotem", count: 1, duration: 45 }
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
      execution: { kind: "summon", ally: "tremorTotem", count: 1, duration: 30 }
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
      execution: { kind: "summon", ally: "cleansingTotem", count: 1, duration: 30 }
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
      execution: { kind: "summon", ally: "groundingTotem", count: 1, duration: 30 }
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
      execution: { kind: "summon", ally: "earthElemental", count: 1, duration: 45 }
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
      execution: { kind: "summon", ally: "fireElemental", count: 1, duration: 45 }
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
      manaCost: 15,
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
      manaCost: 10,
      cooldown: 0,
      damageMultiplier: 1,
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
      manaCost: 35,
      cooldown: 0,
      damageMultiplier: 0.7,
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
      execution: { kind: "cleanse", hpCost: 0.2, resourceGainFrac: 0.3 }
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
      execution: { kind: "dot", dot: { school: "shadow", dpsMultiplier: 0.6, duration: 60, interval: 60, detonate: 0.5 } }
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
      cooldown: 30,
      damageMultiplier: 0,
      color: W2,
      targetMode: "self",
      requiresAlly: "demon",
      description: "Drain mana from your summoned demon, restoring 30% of your maximum mana.",
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
      execution: { kind: "summon", ally: "doomguard", count: 1, duration: 300 }
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
      execution: { kind: "summon", ally: "infernal", count: 1, duration: 60, stun: 2, radius: 90 }
    },
    {
      id: "banish",
      name: "Banish",
      classId: "warlock",
      requirement: "magic",
      domain: "Arcana",
      tier: "basic",
      manaCost: 30,
      cooldown: 30,
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
      cooldown: 30,
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
      manaCost: 15,
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
      manaCost: 55,
      cooldown: 0,
      damageMultiplier: 3.2,
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
      manaCost: 45,
      cooldown: 0,
      damageMultiplier: 0,
      color: D2,
      targetMode: "self",
      castTime: 2.5,
      description: "A slow, powerful heal that restores a large amount of health.",
      execution: { kind: "heal", amount: 3.4 }
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
      execution: { kind: "form", form: "bear", buff: { duration: 3600, exclusiveGroup: "form", form: "bear", stats: { armor: 80, maxHpPercent: 25 } } }
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
      description: "Restore 5% of your maximum mana per second for 10 seconds.",
      execution: { kind: "buff", buff: { duration: 10, manaPerSecond: 0.05 } }
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
      execution: { kind: "heal", amount: 1.4 }
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
      cooldown: 30,
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
      execution: { kind: "summon", ally: "treant", count: 3, duration: 30 }
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
      execution: { kind: "radial", radius: 140, melee: true, taunt: 3 }
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
      description: "Shapeshift into the Tree of Life, increasing healing done by 10% and regenerating health.",
      execution: { kind: "form", form: "moonkin", buff: { duration: 3600, exclusiveGroup: "form", form: "moonkin", healPerSecond: 0.02, stats: { spellDamagePercent: 10 } } }
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
  function skillWeapon(id, equipment) {
    const requirement = SKILL_DEFINITIONS[id].requirement;
    if (requirement === "shield") return equipment.offHand?.kind === "shield" && equipment.mainHand.hands === 1 ? equipment.mainHand : null;
    const eligible = (weapon2) => {
      const family = weapon2.family;
      switch (requirement) {
        case "any":
          return true;
        case "melee":
          return family === "sword" || family === "axe" || family === "mace" || family === "dagger";
        case "blade":
          return family === "sword" || family === "axe" || family === "dagger";
        case "heavy":
          return family === "axe" || family === "mace";
        case "dagger":
          return family === "dagger";
        case "bow":
          return family === "bow";
        case "magic":
          return weapon2.attackKind === "bolt";
      }
    };
    if (eligible(equipment.mainHand)) return equipment.mainHand;
    const off = equipment.offHand;
    return equipment.mainHand.hands === 1 && off?.kind === "weapon" && off.weapon.hands === 1 && eligible(off.weapon) ? off.weapon : null;
  }
  function canUseSkill(id, equipment) {
    return skillWeapon(id, equipment) !== null;
  }

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

  // src/affix-combat.ts
  var canSpellweave = (p2) => p2.derived.spellweavePercent > 0 || p2.character.allocatedNodes.includes(BORROWED_FLAME.node);

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
  function hasUnique(sheet, id) {
    return Object.values(sheet.equipped).some((item) => item?.tier === "unique" && item.recipe.uniqueId === id);
  }

  // src/unique-combat.ts
  function lungeReturn(p2) {
    const step = p2.skillEffects?.returnStep;
    return step && step.remaining > 0 && !p2.dead && !p2.dash && p2.character.allocatedNodes.includes("skill:lunge") && hasUnique(p2.character, "duelists-return") && canUseSkill("lunge", p2.equipment) ? step : void 0;
  }

  // src/skill-sustain.ts
  function skillSustain(skill, p2, effects) {
    if (p2.dead || !skill) return null;
    const shelter = p2.skillEffects?.shelters?.[skill];
    if (shelter) return { remaining: shelter.remaining, upkeep: 0 };
    if (skill === "runicWard" && p2.skillEffects?.ward) return { remaining: p2.skillEffects.ward.remaining, upkeep: 0 };
    if (skill === "brace" || skill === "rallyOfIron" || skill === "ghostHunt") {
      const b = p2.skillEffects?.[skill];
      if (b) return { remaining: b.remaining, upkeep: 0 };
    }
    if (skill === "bulwark" && p2.guardTime > 0 && p2.equipment.offHand?.kind === "shield")
      return { remaining: p2.guardTime, upkeep: 0 };
    if (skill === "tempest") {
      const storms = effects.filter((e) => e.kind === "storm");
      if (storms.length) return {
        remaining: Math.max(...storms.map((e) => Math.max(0, e.delay) + Math.max(0, e.duration))),
        upkeep: storms.reduce((sum, e) => sum + (e.upkeep ?? 0), 0)
      };
    }
    return null;
  }

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
  function isWowClassId(v) {
    return typeof v === "string" && WOW_CLASS_IDS.includes(v);
  }
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
  function isWowRaceId(v) {
    return typeof v === "string" && WOW_RACE_IDS.includes(v);
  }
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
    allyLeash: 140,
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
  function skillRankDamageMultiplier(rank, bonusRanks) {
    const r = SKILL_DAMAGE_RANK_RULES;
    return 1 + r.purchased * (rank - 1) + r.bonus * Math.min(bonusRanks, r.bonusKnee) + r.bonusTail * Math.max(0, bonusRanks - r.bonusKnee);
  }
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
  var OVERLOAD_NODE = "keystone:arcane-overload";
  var specializationNode = (id) => `specialization:${id}`;
  function sheetClassId(sheet) {
    const value = "classId" in sheet ? sheet.classId : void 0;
    return isWowClassId(value) ? value : void 0;
  }
  function sheetRaceId(sheet) {
    const value = "raceId" in sheet ? sheet.raceId : void 0;
    return isWowRaceId(value) ? value : void 0;
  }
  function knowsSkill(sheet, id) {
    const definition = SKILL_DEFINITIONS[id];
    if (!definition) return false;
    if (definition.raceId) return definition.raceId === sheetRaceId(sheet);
    if (definition.classId && definition.classId !== sheetClassId(sheet)) return false;
    return sheet.allocatedNodes.some((node) => node.endsWith(`:${id}`) || node === `wow-${definition.classId}-${id}`);
  }
  function learnedSkillRank(sheet, id) {
    return knowsSkill(sheet, id) ? sheet.skillRanks[id] ?? 1 : 0;
  }
  function activeSkillRank(sheet, id) {
    return Math.min(learnedSkillRank(sheet, id), sheet.activeSkillRanks[id] ?? learnedSkillRank(sheet, id));
  }
  function selectedSpecialization(sheet, id) {
    return SKILL_SPECIALIZATIONS.find((s) => s.id === sheet.skillSpecializations[id] && s.skill === id && sheet.allocatedNodes.includes(specializationNode(s.id)));
  }
  function resolveSkill(id, stats, sheet, rankOverride) {
    const base = SKILL_DEFINITIONS[id], rank = rankOverride ?? Math.max(1, sheet ? activeSkillRank(sheet, id) : 1);
    const bonusRanks = sheet && learnedSkillRank(sheet, id) ? Math.min(AFFIX_COMBAT_RULES.maxBonusRanks, stats.skillBonuses?.[id] ?? 0) : 0;
    const effectiveRank = rank + bonusRanks;
    const variant = sheet ? selectedSpecialization(sheet, id) : void 0;
    const overload = sheet?.arcaneOverload && sheet.allocatedNodes.includes(OVERLOAD_NODE) && base.domain === "Arcana";
    const manaGrowth = 1 + SKILL_RANK_RULES.mana * (rank - 1);
    const multiplier = manaGrowth * (variant?.mana ?? 1) * (overload ? 1.6 : 1);
    const cooldownFloor = id === "bulwark" ? 4 : base.tier === "ultimate" ? 12 : 0;
    const rankCooldown = 1;
    const cooldown = Math.max(cooldownFloor, base.cooldown * stats.cooldownMultiplier * rankCooldown * (variant?.cooldown ?? 1));
    const damageMultiplier = base.damageMultiplier * skillRankDamageMultiplier(rank, bonusRanks) * (variant?.damage ?? 1) * (overload ? 1.3 : 1);
    const recipe = { ...SKILL_EXECUTION[id] };
    if (recipe.kind === "aura") recipe.rank = rank;
    const v = variant?.id;
    if (recipe.kind === "sweep") {
      if (v === "cleave-reach") recipe.reachMultiplier *= 1.4;
      if (v === "cleave-force") recipe.reachMultiplier *= 0.8;
      if (v === "whirlwind-reach") recipe.reachMultiplier *= 1.45;
      if (v === "whirlwind-force") recipe.reachMultiplier *= 0.85;
    }
    if (recipe.kind === "cone") {
      if (v === "shield-wide") {
        recipe.arc = Math.PI * 1.25;
        recipe.radius *= 1.3;
      }
      if (v === "shield-force") recipe.stun = 1.5;
    }
    if (recipe.kind === "backstab") {
      if (v === "backstab-reach") {
        recipe.reachMultiplier *= 1.5;
        recipe.minRange *= 1.5;
      }
      if (v === "backstab-rear") recipe.rearMultiplier = 3 / 0.85;
    }
    if (recipe.kind === "projectile") {
      if (v === "volley-fan") recipe.offsets = [-0.4, -0.2, 0, 0.2, 0.4];
      if (v === "volley-pierce") recipe.effects = { ...recipe.effects, pierce: 1 };
      if (v === "ricochet-chain") recipe.effects = { ...recipe.effects, chain: 6 };
      if (v === "ricochet-force") recipe.effects = { ...recipe.effects, chain: 1 };
      if (v === "fireball-fork") recipe.offsets = [-0.24, 0, 0.24];
      if (v === "fireball-ember") recipe.effects = { ...recipe.effects, groundDuration: 3, groundDamageMultiplier: 0.24 };
    }
    if (recipe.kind === "chain") {
      if (v === "arc-circuit") {
        recipe.jumps = 8;
        recipe.revisit = true;
        recipe.falloff = 0.7;
      }
      if (v === "arc-focus") recipe.jumps = 3;
    }
    if (recipe.kind === "radial") {
      if (v === "nova-echo") recipe.echo = true;
      if (v === "nova-deep") {
        recipe.radius *= 1.3;
        recipe.slow = { factor: 0.3, duration: 4 };
      }
    }
    if (recipe.kind === "ground" && v === "meteor-shards") {
      recipe.scatter = 5;
      recipe.radius *= 0.65;
      recipe.scatterRadiusMultiplier = 1.6;
    }
    variant?.modify?.(recipe);
    const growth = effectiveRank - 1, rules = SKILL_RANK_RULES;
    if (recipe.kind === "guard") {
      recipe.duration += rules.duration * growth;
      recipe.reduction = Math.min(0.9, recipe.reduction + rules.protection * growth);
    }
    if (recipe.kind === "step") recipe.speed *= 1 + rules.stepSpeed * growth;
    if (recipe.kind === "ward") {
      recipe.fraction = Math.min(0.35, recipe.fraction + rules.wardCapacity * growth);
      recipe.duration += rules.duration * growth;
    }
    if (recipe.kind === "stance") {
      recipe.duration += rules.duration * growth;
      if (recipe.charges) recipe.bonus *= 1 + rules.empowerment * growth;
      if (recipe.reduction) recipe.reduction = Math.min(0.5, recipe.reduction + rules.protection * growth);
    }
    if (recipe.kind === "radial" && recipe.shelter) recipe.shelter = {
      duration: recipe.shelter.duration + rules.duration * growth,
      reduction: Math.min(0.75, recipe.shelter.reduction + rules.protection * growth)
    };
    if (recipe.kind === "step" && recipe.shot && stats.projectilePierce) recipe.pierce = Math.min(12, stats.projectilePierce);
    const area = stats.areaMultiplier ?? 1;
    if (recipe.kind === "sweep") recipe.reachMultiplier *= area;
    if (recipe.kind === "ground" || recipe.kind === "radial" || recipe.kind === "cone") recipe.radius *= area;
    if (recipe.kind === "projectile") recipe.effects = {
      ...recipe.effects,
      ...recipe.effects.blastRadius ? { blastRadius: recipe.effects.blastRadius * area } : {},
      ...!recipe.effects.blastRadius && stats.projectilePierce ? { pierce: Math.min(12, (recipe.effects.pierce ?? 0) + stats.projectilePierce) } : {}
    };
    if (id === "iceNova" && recipe.kind === "radial" && sheet && hasUnique(sheet, "winters-reach")) recipe.targetRange = UNIQUE_RULES.novaRange;
    return {
      rank,
      bonusRanks,
      effectiveRank,
      variant,
      damageMultiplier,
      recipe,
      reservation: isAura(id) ? resolveAura(id, rank).reservation : 0,
      // Zero-cost skills (rage builders, rune strikes) stay free; positive costs keep the 1-unit floor.
      mana: isAura(id) || base.manaCost <= 0 ? 0 : Math.max(1, Math.round(base.manaCost * stats.manaCostMultiplier * multiplier * 10) / 10),
      cooldown,
      upkeep: id === "tempest" ? Math.round(18 * stats.manaCostMultiplier * multiplier * 10) / 10 : 0,
      // WoW definition fields shared by combat activation and HUD (docs/wow-transformation.md §3-4).
      classId: base.classId,
      raceId: base.raceId,
      resource: base.resource,
      runeCost: base.runeCost,
      runicPowerGain: base.runicPowerGain,
      shardCost: base.shardCost,
      combo: base.combo,
      castTime: base.castTime,
      channel: base.channel,
      targetMode: base.targetMode,
      range: base.range,
      offGcd: base.offGcd,
      executeThreshold: base.executeThreshold,
      requiresStealth: base.requiresStealth,
      requiresForm: base.requiresForm,
      requiresBehind: base.requiresBehind,
      requiresFrozen: base.requiresFrozen,
      requiresAlly: base.requiresAlly
    };
  }

  // src/gamepad-input.ts
  var PAD = Object.freeze({
    interact: 0,
    dodge: 1,
    skill3: 2,
    skill4: 3,
    potion: 4,
    skill2: 5,
    skill1: 6,
    attack: 7,
    map: 8,
    pause: 9,
    skill5: 11,
    up: 12,
    down: 13,
    left: 14,
    right: 15
  });
  var PAD_SKILL_BUTTONS = [PAD.skill1, PAD.skill2, PAD.skill3, PAD.skill4, PAD.skill5];
  var PAD_SKILL_LABELS = ["RT", "LT", "RB", "X", "Y", "RS"];

  // src/skill-icon-content.ts
  var ICON_MATERIALS = Object.freeze({
    steel: { light: "#eeffff", face: "#9edfe5", shade: "#25466d", edge: "#d4e7e8" },
    gold: { light: "#fff3bd", face: "#efb939", shade: "#864021", edge: "#ffd982" },
    fire: { light: "#fff4c9", face: "#ff9a28", shade: "#a51e37", edge: "#ffc176" },
    ice: { light: "#dcffff", face: "#39dbf5", shade: "#2346a2", edge: "#95f4ff" },
    jade: { light: "#dcffd9", face: "#48dca3", shade: "#175762", edge: "#a1f5c5" },
    violet: { light: "#f4e3ff", face: "#bd83fb", shade: "#452282", edge: "#dec2ff" },
    rose: { light: "#ffe1f1", face: "#f781be", shade: "#752060", edge: "#ffbdda" },
    dark: { light: "#8cb0c2", face: "#294d64", shade: "#101c31", edge: "#637785" }
  });
  var body = (path2, material2 = "steel") => ({ path: path2, material: material2, kind: "body" });
  var facet = (path2, material2) => ({ path: path2, material: material2, kind: "facet" });
  var cut = (path2, material2 = "steel") => ({ path: path2, material: material2, kind: "cut", detail: true });
  function place(parts, x, y, angle = 0, scale = 1, opacity = 1) {
    const a = angle * Math.PI / 180, c2 = Math.cos(a) * scale, s = Math.sin(a) * scale;
    return parts.map((p2) => ({ ...p2, transform: [c2, s, -s, c2, x, y], opacity }));
  }
  function blade(material2 = "steel") {
    return [
      body("M-4 9V-15L0-25 4-15V9Z", material2),
      facet("M0-23 3-14V8H0Z", "dark"),
      body("M-10 8-8 5-3 7H3L8 5 10 8 7 11H-7Z", "gold"),
      body("M-2 11H2V21H-2Z", "dark"),
      body("M0 20 4 23 0 26-4 23Z", "gold"),
      cut("M-2-12V5", material2)
    ];
  }
  function shield(material2 = "steel") {
    return [
      body("M0-24 18-17 16 6Q12 17 0 25-12 17-16 6L-18-17Z", material2),
      body("M0-18 12-13 10 5Q7 13 0 18-7 13-10 5L-12-13Z", "dark"),
      facet("M0-17 4-10 3 8 0 16-3 8-4-10Z", material2),
      cut("M-14-12-12 4Q-9 12-3 17", material2)
    ];
  }
  function arrow(material2 = "jade") {
    return [
      body("M-2 20V-8H-7L0-24 7-8H2V20Z", material2),
      facet("M0-22 5-10H0Z", "steel"),
      body("M-2 12-7 7V16L-2 21ZM2 12 7 7V16L2 21Z", "gold")
    ];
  }
  function crystal(material2 = "ice") {
    return [
      body("M0-23 9-5 5 12 0 23-6 10-9-5Z", material2),
      facet("M0-21 0 21-5 8-7-5Z", material2),
      facet("M0-21 7-5 2 1Z", "steel"),
      facet("M2 1 7-5 4 11 0 21Z", "dark")
    ];
  }
  function bow(material2 = "gold") {
    return [
      body("M-9-25Q26 0-9 25L-5 18Q15 0-5-18Z", material2),
      body("M-8-22-5-22 2 0-5 22-8 22-1 0Z", "steel"),
      body("M4-5H10V5H4Z", "dark")
    ];
  }
  function boot() {
    return [
      body("M-10-22 8-20 5-4 9 4 21 10 24 16 20 20H-16L-18 12-11 3Z"),
      facet("M-7-17 3-16 0-4-6 4-12 9-9-1Z", "steel"),
      body("M-17 13-8 10 7 12 21 14 20 18H-15Z", "dark"),
      cut("M-8-13 2-12M-8-8 1-7M-5 5 5 7")
    ];
  }
  var ring = (material2, path2 = "M32 5A27 27 0 1 1 5 32L10 34A22 22 0 1 0 32 10Z") => body(path2, material2);
  var lightning = (material2 = "violet") => body("M38 3 12 35 29 31 23 61 52 24 35 29Z", material2);
  var flame = () => [
    body("M55 5C39 6 39 22 27 23L29 13C20 19 17 25 17 29L13 24C1 40 9 57 25 58 43 59 46 44 45 33L38 39C39 23 48 21 55 5Z", "fire"),
    facet("M43 17C31 28 39 31 29 40L28 30C14 39 15 51 26 53 38 54 39 44 37 37L32 43C32 31 40 27 43 17Z", "gold"),
    facet("M26 39C18 47 23 53 29 49L31 43 27 46Z", "steel"),
    cut("M12 38C8 48 17 57 28 55", "fire")
  ];
  var zap = (m = "violet") => [
    body("M7-24-9 3-1 1-7 24 11-5 3-2Z", m),
    facet("M5-19-4 2 0 0-4 17 6-4 1-1Z", m)
  ];
  var bolt = (m = "ice") => [
    body("M-2 18-5-6 0-24 5-6 2 14Z", m),
    facet("M0-20 3-7 1 10-1 4Z", m)
  ];
  var orb = (m) => [
    body("M0-15A15 15 0 1 0 0 15 15 15 0 1 0 0-15Z", m),
    facet("M-9-6A6 6 0 0 1 3-10L1-3A5 5 0 0 0-9-6Z", m)
  ];
  var drop = (m = "rose") => [
    body("M0-22C-4-12-12-4-12 6A12 12 0 0 0 12 6C12-4 4-12 0-22Z", m),
    facet("M-5 0A7 8 0 0 0 4 9L6 3C4-2 0-6-1-9Z", m)
  ];
  var heart = (m = "rose") => [
    body("M0 20C-16 8-22-2-16-10-10-16-2-13 0-6 2-13 10-16 16-10 22-2 16 8 0 20Z", m),
    facet("M-13-7C-9-12-3-11-2-7-6-6-9-4-10 0Z", m)
  ];
  var cross = (m = "gold") => [
    body("M-5-22H5V-5H22V5H5V22H-5V5H-22V-5H-5Z", m),
    facet("M-3-19H3V-3H19V3H3V19H-3V3H-19V-3H-3Z", "dark")
  ];
  var star = (m = "gold") => [
    body("M0-24 6-6 24 0 6 6 0 24-6 6-24 0-6-6Z", m),
    facet("M0-15 4-4 15 0 4 4 0 15-4 4-15 0-4-4Z", m)
  ];
  var moon = (m = "ice") => [
    body("M10-20A22 22 0 1 0 10 20 17 17 0 1 1 10-20Z", m),
    facet("M4-13A14 14 0 0 0 4 13 11 11 0 0 1 4-13Z", m)
  ];
  var skull = (m = "steel") => [
    body("M0-20C-13-20-18-10-18 0-18 7-14 11-10 13V20H-6V15H-2V20H2V15H6V20H10V13C14 11 18 7 18 0 18-10 13-20 0-20Z", m),
    body("M-11-2A5 5 0 1 0-1-2 5 5 0 1 0-11-2Z", "dark"),
    body("M1-2A5 5 0 1 0 11-2 5 5 0 1 0 1-2Z", "dark"),
    body("M-2 6 0 11 2 6Z", "dark")
  ];
  var paw = (m = "jade") => [
    body("M0-2C-9-2-15 4-15 11-15 18-8 22 0 22 8 22 15 18 15 11 15 4 9-2 0-2Z", m),
    body("M-18-14A5 6 0 1 0-8-14 5 6 0 1 0-18-14Z", m),
    body("M-9-19A5 6 0 1 0 1-19 5 6 0 1 0-9-19Z", m),
    body("M-1-19A5 6 0 1 0 9-19 5 6 0 1 0-1-19Z", m),
    body("M8-14A5 6 0 1 0 18-14 5 6 0 1 0 8-14Z", m)
  ];
  var clawMarks = (m = "rose") => [
    body("M-20-22-13-22-1 22-8 22Z", m),
    body("M-6-22 1-22 13 22 6 22Z", m),
    body("M8-22 15-22 24 6 20 12Z", m)
  ];
  var leaf = (m = "jade") => [
    body("M0-22C14-14 16 4 0 22-16 4-14-14 0-22Z", m),
    cut("M0-17V17M0-4-7-9M0 3 7-2", m)
  ];
  var vine = (m = "jade") => [
    body("M-3 22C-11 10 9 4 3-8-1-15-9-13-7-21L-1-19C-5-13 5-13 9-5 15 5-3 10 3 22Z", m),
    body("M3-8C9-12 15-10 17-4 11-2 5-4 3-8Z", m),
    body("M-1 8C-7 6-11 8-13 14-7 16-2 13-1 8Z", m)
  ];
  var halo = (m) => [
    body("M0-24A24 24 0 1 0 0 24 24 24 0 1 0 0-24ZM0-18A18 18 0 1 1 0 18 18 18 0 1 1 0-18Z", m)
  ];
  var swirl = (m = "violet") => [
    body("M0-22A22 22 0 1 0 22 0L14 0A14 14 0 1 1 0-14Z", m),
    body("M13-6 26 0 12 8Z", m)
  ];
  var wings = (m = "gold") => [
    body("M-2 10C-4-6-14-18-26-20-20-10-20-4-24 0-16 0-12 4-12 10Z", m),
    body("M2 10C4-6 14-18 26-20 20-10 20-4 24 0 16 0 12 4 12 10Z", m),
    body("M-3 6H3V18H-3Z", m)
  ];
  var horns = (m = "jade") => [
    body("M-3 10C-12 6-19-4-17-20-11-12-5-8 1-8-1-2-2 5-3 10Z", m),
    body("M3 10C12 6 19-4 17-20 11-12 5-8-1-8 1-2 2 5 3 10Z", m)
  ];
  var eye = (m = "gold") => [
    body("M-24 0Q0-18 24 0 0 18-24 0Z", m),
    body("M-8 0A8 8 0 1 0 8 0 8 8 0 1 0-8 0Z", "dark"),
    facet("M-5-5A4 4 0 0 1 2-6L0-2Z", m)
  ];
  var shout = (m = "gold") => [
    body("M-14-5A7 7 0 0 1-14 5L-17 8A11 11 0 0 0-17-8Z", m),
    body("M-6-10A14 14 0 0 1-6 10L-10 14A20 20 0 0 0-10-14Z", m),
    body("M2-15A21 21 0 0 1 2 15L-2 19A27 27 0 0 0-2-19Z", m)
  ];
  var trap = (m = "steel") => [
    body("M-20-3A20 20 0 0 1 20-3L15 2A15 15 0 0 0-15 2Z", m),
    body("M-20 3A20 20 0 0 0 20 3L15-2A15 15 0 0 1-15-2Z", m),
    body("M-14-9-10-2-6-9ZM-2-11 2-4 6-11ZM10-9 14-2 18-9Z", m),
    body("M-14 9-10 2-6 9ZM-2 11 2 4 6 11ZM10 9 14 2 18 9Z", m)
  ];
  var feather = (m = "jade") => [
    body("M-4 20C-14 4-8-14 12-22 16-8 10 8-4 20Z", m),
    cut("M-2 16 10-18M0 8-6 4M3 1 9-3", m)
  ];
  var rune = (m = "violet") => [
    body("M0-22 16 0 0 22-16 0Z", m),
    body("M0-15 10 0 0 15-10 0Z", "dark"),
    cut("M-4-6 1 0-4 6M1 0 7-7M1 0V9", m)
  ];
  var totem = (m = "jade") => [
    body("M-9-22H9L7-8H-7Z", m),
    body("M-7-7H7L9 6H-9Z", m),
    body("M-9 7H9L11 22H-11Z", m),
    cut("M-4-17H4M-3-1H3M-4 13H4", "dark")
  ];
  var wolfHead = (m = "steel") => [
    body("M-13-14-17-24-7-19 0-21 7-19 17-24 13-14 18-6 12 4 6 8 4 20-4 20-6 8-12 4-18-6Z", m),
    body("M-8-5-3-4-7 0Z", "dark"),
    body("M8-5 3-4 7 0Z", "dark"),
    body("M-3 12 0 16 3 12Z", "dark")
  ];
  var bearHead = (m = "jade") => [
    body("M-15-10A8 8 0 0 1-7-19 16 16 0 0 1 7-19 8 8 0 0 1 15-10C20-2 18 8 12 14 8 19-8 19-12 14-18 8-20-2-15-10Z", m),
    body("M-7 3A7 6 0 0 0 7 3 7 7 0 0 1 7 12 7 5 0 0 1-7 12 7 7 0 0 1-7 3Z", m),
    body("M-9-5-4-4-8 0Z", "dark"),
    body("M9-5 4-4 8 0Z", "dark"),
    body("M-3 5 0 8 3 5Z", "dark")
  ];
  var catHead = (m = "jade") => [
    body("M-15-3-17-22-6-12 0-14 6-12 17-22 15-3C19 8 12 18 0 18-12 18-19 8-15-3Z", m),
    body("M-10-2-4-1-9 3Z", "dark"),
    body("M10-2 4-1 9 3Z", "dark"),
    body("M-2 8 0 11 2 8Z", "dark")
  ];
  var owlHead = (m = "violet") => [
    body("M-15-11-19-22-9-16 0-18 9-16 19-22 15-11C21 2 14 18 0 18-14 18-21 2-15-11Z", m),
    body("M-12-4A6 6 0 1 0 0-4 6 6 0 1 0-12-4Z", "gold"),
    body("M0-4A6 6 0 1 0 12-4 6 6 0 1 0 0-4Z", "gold"),
    body("M-9-4A3 3 0 1 0-3-4 3 3 0 1 0-9-4Z", "dark"),
    body("M3-4A3 3 0 1 0 9-4 3 3 0 1 0 3-4Z", "dark"),
    body("M-2 3 0 8 2 3Z", "gold")
  ];
  var sheepHead = (m = "violet") => [
    body("M-14-8C-20-14-12-22-6-18-4-24 6-24 8-18 14-22 20-14 14-8 18-2 14 4 8 2 6 10-6 10-8 2-14 4-18-2-14-8Z", m),
    body("M-8 0C-10 8-6 16 0 16 6 16 10 8 8 0 4 4-4 4-8 0Z", "dark"),
    body("M-5 6-3 4-2 7ZM5 6 3 4 2 7Z", m)
  ];
  var impHead = (m = "jade") => [
    body("M-11-7-15-21-5-12 0-14 5-12 15-21 11-7C15 3 10 14 0 14-10 14-15 3-11-7Z", m),
    body("M-7-4-2-3-6 1Z", "dark"),
    body("M7-4 2-3 6 1Z", "dark"),
    body("M-4 8 0 5 4 8 0 10Z", "dark")
  ];
  var demonHead = (m = "jade") => [
    body("M-9-5C-17-9-21-17-19-25-13-17-9-15-5-15 0-17 0-17 5-15 9-15 13-17 19-25 21-17 17-9 9-5 13 3 9 14 0 16-9 14-13 3-9-5Z", m),
    body("M-6-3-1-2-5 2Z", "fire"),
    body("M6-3 1-2 5 2Z", "fire"),
    body("M-3 9 0 12 3 9Z", "dark")
  ];
  var snowflake = (m = "ice") => [
    body("M0-24 5-8 21-12 8 0 21 12 5 8 0 24-5 8-21 12-8 0-21-12-5-8Z", m),
    facet("M0-14 3-5 12-7 5 0 12 7 3 5 0 14-3 5-12 7-5 0-12-7-3-5Z", m)
  ];
  var crown = (m = "gold") => [
    body("M-18 12-20-10-10 2 0-16 10 2 20-10 18 12Z", m),
    body("M-18 14H18V20H-18Z", m),
    facet("M-4 4 0-3 4 4 0 10Z", "rose")
  ];
  var hood = (m = "dark") => [
    body("M0-22C-14-22-20-8-18 8L-13 22H13L18 8C20-8 14-22 0-22Z", m),
    body("M-8-3A8 9 0 1 0 8-3 8 9 0 1 0-8-3Z", "violet"),
    body("M-6-5-2-4-5-1Z", "gold"),
    body("M6-5 2-4 5-1Z", "gold")
  ];
  var ghost = (m = "violet") => [
    body("M0-20C-12-20-16-10-16 0V18L-10 14-5 20 0 15 5 20 10 14 16 18V0C16-10 12-20 0-20Z", m),
    body("M-9-6A3 4 0 1 0-3-6 3 4 0 1 0-9-6Z", "dark"),
    body("M3-6A3 4 0 1 0 9-6 3 4 0 1 0 9-6Z", "dark"),
    body("M-3 3A3 4 0 1 0 3 3 3 4 0 1 0-3 3Z", "dark")
  ];
  var beam = (m = "gold") => [
    body("M-6-24H6L3 24H-3Z", m),
    facet("M-2-22H2L1 22H-1Z", m)
  ];
  var tornado = (m = "ice") => [
    body("M-22-16A22 7 0 0 0 22-16L18-8A16 5 0 0 1-18-8Z", m),
    body("M-16-3A16 6 0 0 0 16-3L12 4A10 4 0 0 1-12 4Z", m),
    body("M-10 8A10 4 0 0 0 10 8L4 22A5 6 0 0 1-4 22Z", m)
  ];
  var serpent = (m = "jade") => [
    body("M-13 18C-19 8-7 4-5-2-3-8-11-10-7-18L-1-16C-7-12 3-8 1-1-1 8-11 8-7 18Z", m),
    body("M-7-18-13-24-3-22Z", m),
    body("M3 9C9 7 15 9 17 15 11 17 5 15 3 9Z", m)
  ];
  var target = (m = "rose") => [
    body("M-20 0A20 20 0 1 0 20 0 20 20 0 1 0-20 0ZM-14 0A14 14 0 1 1 14 0 14 14 0 1 1-14 0Z", m),
    body("M-7 0A7 7 0 1 0 7 0 7 7 0 1 0-7 0Z", m)
  ];
  var bomb = (m = "dark") => [
    body("M0-11A14 14 0 1 0 0 17 14 14 0 1 0 0-11Z", m),
    body("M-3-16H5V-11H-3Z", "steel"),
    body("M4-18 10-24 12-21 7-16Z", "gold"),
    body("M10-26 13-23 16-26 14-21Z", "fire")
  ];
  var hook = (m = "dark") => [
    body("M-2-24H3V6A9 9 0 0 1-15 6L-15 0-9 0-9 6A4 4 0 0 0-2 6Z", m),
    body("M-15-2-19 5-11 4Z", m)
  ];
  var grasp = (m = "dark") => [
    body("M-13 22C-15 8-11-2-3-6L-7-18-1-16 1-4 3-20 9-19 7-5 13-16 18-13 11-2C17 2 16 12 12 22Z", m)
  ];
  var handRise = (m = "jade") => [
    body("M-9 22V2C-9-4-5-6-3-2V-14C-3-18 1-18 1-14V-3 3-16 5-16 5-12V-2 7-11 9-11 9-7V3C9 12 6 20 2 22Z", m)
  ];
  var fangs = (m = "steel") => [
    body("M-15-8C-8-13 8-13 15-8 13 0 9 2 7-2 5 8 3 14 0 16-3 14-5 8-7-2-9 2-13 0-15-8Z", m),
    body("M-11-6-8 9-5-4ZM11-6 8 9 5-4Z", m)
  ];
  var seedPod = (m = "violet") => [
    body("M0-14C-10-10-14-1-10 8-6 18 6 18 10 8 14-1 10-10 0-14Z", m),
    body("M0-14C-2-21 2-25 8-25 8-19 4-15 0-14Z", "jade"),
    facet("M-5-3A5 6 0 0 0 3 7L5 1C3-3 0-5-1-7Z", m)
  ];
  var meteorRock = (m = "fire") => [
    body("M-14-6C-16-14-6-20 2-18 12-16 16-8 14 0 12 10 2 16-6 14-14 12-18 2-14-6Z", "dark"),
    facet("M-8-8C-6-13 0-15 5-13 0-9-2-6-3-2Z", m),
    facet("M2 2C6 0 9 2 10 6 6 8 2 7 0 5Z", m),
    body("M14-14 22-22 18-12Z", m),
    body("M16-4 26-8 18 2Z", m)
  ];
  var horn = (m = "gold") => [
    body("M-20 4C-12-2 2-8 20-14 18-4 10 4-2 8-10 10-16 10-20 4Z", m),
    body("M-22 2C-24 6-22 10-18 10-16 6-18 4-22 2Z", "dark"),
    facet("M-14 2C-6-2 4-6 14-9 8-3 0 2-8 5Z", m)
  ];
  var brokenChain = (m = "steel") => [
    body("M-20-7A8 8 0 0 1-4-7L-6-2A4 4 0 0 0-18-2Z", m),
    body("M-20 7A8 8 0 0 0-4 7L-6 2A4 4 0 0 1-18 2Z", m),
    body("M4-7A8 8 0 0 1 20-7L18-2A4 4 0 0 0 6-2Z", m),
    body("M4 7A8 8 0 0 0 20 7L18 2A4 4 0 0 1 6 2Z", m),
    body("M-2-11 3-4-2 0 3 5-2 11-7 3-2-1-7-5Z", "gold")
  ];
  var rock = (m = "steel") => [
    body("M-18 12-14-6-2-14 12-10 18 2 14 14-2 18Z", m),
    facet("M-12 8-9-4-1-9-4 2-8 10Z", m),
    facet("M2-8 10-6 13 2 6 0Z", "dark")
  ];
  var hoof = (m = "jade") => [
    body("M-10-14C-14-2-12 8-8 14L-2 12C-4 4-4-4-2-12Z", m),
    body("M10-14C14-2 12 8 8 14L2 12C4 4 4-4 2-12Z", m)
  ];
  var fist = (m = "steel") => [
    body("M-12-2C-12-10-6-14 0-14 8-14 12-8 12-2V8C12 16 6 20 0 20-8 20-12 14-12 8Z", m),
    cut("M-8-8-8 2M-3-11-3 1M2-11 2 1M7-8 7 2", "dark")
  ];
  var ember = (m = "fire") => [
    body("M4-20C-4-14-10-6-8 4-6 14 2 20 8 16 16 10 14 0 8-4 10 2 6 6 2 4-2 0-2-8 4-20Z", m),
    facet("M2-8C-2-4-4 2-2 8 0 12 4 14 7 11 10 7 8 1 5-1 6 3 4 5 2 4 0 1 0-3 2-8Z", "gold")
  ];
  var hands = (m = "gold") => [
    body("M-18 2C-16-6-8-10-2-8-8-2-10 4-8 12-14 12-18 8-18 2Z", m),
    body("M18 2C16-6 8-10 2-8 8-2 10 4 8 12 14 12 18 8 18 2Z", m),
    body("M-6 14H6V20H-6Z", m)
  ];
  var insect = (m = "jade") => [
    body("M0-6A6 8 0 1 0 0 10 6 8 0 1 0 0-6Z", m),
    body("M-3-12A3 4 0 1 0 3-12 3 4 0 1 0-3-12Z", m),
    body("M-5-5-13-11-11-7-4-2ZM5-5 13-11 11-7 4-2Z", m),
    cut("M-6 3-13 7M6 3 13 7M-5 9-10 15M5 9 10 15", m)
  ];
  var missile = (m = "violet") => [
    body("M0-20 5-6 2 14 0 20-2 14-5-6Z", m),
    facet("M0-16 3-6 0 10Z", m)
  ];
  var iceBlockShape = (m = "ice") => [
    body("M-14-18H14L18 14-14 18Z", m),
    facet("M-10-14H0L-4 12-12 10Z", m),
    facet("M2-14H10L14 10 0 12Z", "dark"),
    cut("M-6-8 4-2M-2 4 8-2", m)
  ];
  var sunburst = (m = "gold") => [
    body("M0-24 3-8 17-17 8-3 24 0 8 3 17 17 3 8 0 24-3 8-17 17-8 3-24 0-8-3-17-17-3-8Z", m),
    body("M-7 0A7 7 0 1 0 7 0 7 7 0 1 0-7 0Z", m)
  ];
  var wave = (m = "jade") => [
    body("M-22 2C-14-6-6-6 0 0 6 6 14 6 22 0L20 8C14 14 4 14-2 8-8 2-14 4-18 10Z", m)
  ];
  var link = (m = "jade") => [
    body("M-17-5A8 8 0 0 1-1-5L-3 0A4 4 0 0 0-15 0Z", m),
    body("M-17 5A8 8 0 0 0-1 5L-3 0A4 4 0 0 1-15 0Z", m),
    body("M1-5A8 8 0 0 1 17-5L15 0A4 4 0 0 0 3 0Z", m),
    body("M1 5A8 8 0 0 0 17 5L15 0A4 4 0 0 1 3 0Z", m)
  ];
  var speedLines = (m = "steel") => [
    body("M-24-11-6-13-8-8-24-6Z", m),
    body("M-24-1-10-3-8 2-24 4Z", m),
    body("M-24 9-14 7-12 12-24 14Z", m)
  ];
  var cloud = (m = "ice") => [
    body("M-18 6C-22-2-14-10-6-8-4-16 8-16 10-8 18-10 22-2 18 6 14 10-14 10-18 6Z", m)
  ];
  var bark = (m = "jade") => [
    body("M-14-20H14L10 20H-10Z", m),
    cut("M-8-14-6 14M0-16-2 16M7-12 5 12", "dark"),
    facet("M-11-16H-4L-6 14-10 12Z", m)
  ];
  var dagger = (m = "steel") => [
    body("M-3 8V-13L0-24 3-13V8Z", m),
    body("M-8 7-7 4H7L8 7 5 10H-5Z", "gold"),
    body("M-2 10H2V18H-2Z", "dark"),
    cut("M0-11V4", m)
  ];
  var axe = (m = "steel") => [
    body("M-2-24H2V24H-2Z", "dark"),
    body("M2-20C14-19 20-10 18 2 12-4 8-6 2-6Z", m),
    facet("M4-17C12-15 15-9 14-3 10-7 7-8 4-9Z", m),
    body("M-4-24H4V-20H-4Z", "gold")
  ];
  var hammer = (m = "gold") => [
    body("M-2-14H2V24H-2Z", "dark"),
    body("M-13-24H13V-8H-13Z", m),
    facet("M-10-21H0V-11H-10Z", m),
    facet("M2-21H10V-11H2Z", "dark")
  ];
  var dome = (m = "ice") => [
    body("M-20 12A20 20 0 0 1 20 12L16 17A16 16 0 0 0-16 17Z", m)
  ];
  var recipes = {
    ironroot: [...place(shield("jade"), 32, 27, 0, 0.8), body("M30 34H34V45L48 54 34 49 32 58 30 49 16 54 30 45Z", "gold")],
    bloodOath: [body("M32 5C29 18 16 27 16 37A16 16 0 0 0 48 37C48 26 36 17 32 5Z", "rose"), facet("M32 16 28 36 34 43 38 35Z", "gold")],
    hawkeye: [body("M4 31Q32 5 60 31Q32 55 4 31Z", "gold"), body("M21 31A11 11 0 1 0 43 31A11 11 0 1 0 21 31Z", "jade"), facet("M31 17 35 30 31 44 28 30Z", "steel")],
    thornbound: [body("M12 48 19 24 9 17 25 21 32 5 36 24 53 16 45 32 58 43 40 41 32 59 27 41 8 48Z", "jade"), body("M26 29 36 29 37 37 27 39Z", "dark")],
    elementalResonance: [body("M32 5 43 24 32 34 21 24Z", "fire"), body("M12 31 27 33 31 52 9 48Z", "ice"), body("M41 31 55 31 55 48 34 53Z", "violet")],
    stillwater: [body("M10 37Q32 29 54 37L49 44Q32 37 15 44ZM16 48Q32 42 48 48L44 54H20Z", "ice"), body("M32 6Q17 23 23 30Q32 38 41 30Q47 23 32 6Z", "steel")],
    elementalSpikes: [body("M8 49 14 15 24 46Z", "fire"), body("M23 51 32 5 41 51Z", "ice"), body("M40 46 51 15 57 49Z", "violet"), facet("M8 52H57V57H8Z", "gold")],
    fireball: flame(),
    shieldBash: [...place(shield(), 25, 30, -14, 0.88), body("M47 13 61 31 48 48 51 35 43 32 51 28Z", "gold")],
    bulwark: [
      body("M8 12 18 8V35L13 44 7 34ZM56 12 46 8V35L51 44 57 34Z", "steel"),
      ...place(shield(), 32, 31),
      facet("M32 14 37 22 35 40 32 48 29 40 27 22Z", "ice")
    ],
    repulse: [
      body("M7 13Q-2 32 7 51L11 46Q4 32 11 18ZM57 13Q66 32 57 51L53 46Q60 32 53 18Z", "gold"),
      ...place(shield("gold"), 32, 31, 0, 0.83),
      body("M27 29H37V34H27Z", "steel")
    ],
    ironCitadel: [
      body("M6 54V20L12 11 19 20 25 14 32 5 39 14 45 20 52 11 58 20V54Z", "steel"),
      body("M13 48V26H23V48ZM41 48V26H51V48Z", "dark"),
      ...place(shield("gold"), 32, 37, 0, 0.64),
      facet("M8 21 12 16 16 22V49H10ZM48 22 52 16 56 21 54 49H48Z", "steel")
    ],
    brace: [
      body("M8 49 12 17 23 12 26 22 20 42 29 48 26 55 15 54ZM56 49 52 17 41 12 38 22 44 42 35 48 38 55 49 54Z"),
      body("M18 9Q32 0 46 9L44 15Q32 9 20 15Z", "gold"),
      facet("M13 23 18 20 17 40 12 47ZM46 20 51 23 52 47 47 40Z", "steel"),
      body("M27 29 32 24 37 29 32 35Z", "gold")
    ],
    rallyOfIron: [
      body("M15 5H20V57H15Z"),
      body("M21 7H56L45 20 53 33H21Z", "gold"),
      facet("M23 10H48L38 19 45 27H23Z", "fire"),
      body("M9 55 18 48 27 55 25 59H11Z"),
      body("M31 16 37 12 40 17 34 23Z", "steel")
    ],
    cleave: [
      body("M19 6C52 0 65 27 48 49L44 45C57 23 42 10 19 6Z", "gold"),
      body("M33 8C49 13 55 27 48 39L46 34C49 21 42 15 33 8Z", "fire"),
      ...place(blade(), 27, 34, 40, 0.94)
    ],
    lunge: [body("M3 22 26 18 22 23 3 26ZM4 33 19 29 15 35 4 37ZM13 48 21 41 21 46 12 52Z", "jade"), ...place(blade(), 35, 31, 43, 1.08)],
    whirlwind: [ring("gold"), body("M7 12 8 30 23 21Z", "gold"), body("M57 52 56 34 41 43Z", "gold"), ...place(blade(), 32, 32, 38, 0.76)],
    earthshatter: [
      body("M4 54 18 46 27 55 34 40 41 51 59 45 48 60 33 55 22 62Z", "fire"),
      ...place([
        body("M-3-4H3V26H-3Z", "gold"),
        body("M-17-21H15L18-15 14-2H-17L-20-8Z"),
        facet("M-16-18H12L13-11H-17Z", "steel"),
        facet("M11-18 15-14 11-5 7-5Z", "dark")
      ], 31, 28, 35, 0.93)
    ],
    backstab: [
      body("M43 10C57 15 60 29 54 44L48 48 49 36C52 24 48 18 40 16Z", "rose"),
      ...place(blade(), 28, 32, 36, 0.95),
      body("M49 43 60 43 49 56 40 44Z", "rose")
    ],
    nightReaping: [
      body("M32 6C6 10-1 41 23 58L22 50C6 36 16 15 32 6Z", "violet"),
      ...place(blade("jade"), 23, 30, -29, 0.77),
      ...place(blade("steel"), 41, 30, 29, 0.77),
      body("M32 40 39 49 32 61 25 49Z", "rose")
    ],
    sidestep: [
      ...place(boot(), 40, 31, 8, 0.86, 0.3),
      body("M3 21 16 17 14 22 3 25ZM3 32 13 28 11 34 2 37Z", "jade"),
      ...place(boot(), 27, 33, 8, 0.9)
    ],
    smokeVeil: [
      body("M12 47C-1 42 0 27 13 24 7 8 29 2 36 14 49 4 60 18 53 29 67 37 54 54 43 49Z", "dark"),
      facet("M7 31C5 19 20 20 24 30 12 22 10 35 18 38 6 39 4 34 7 31ZM32 17C45 9 53 23 43 29 48 21 40 15 32 22Z", "steel"),
      body("M18 38Q32 23 48 38L43 47 22 47Z", "jade"),
      facet("M24 39 30 38 28 41ZM36 38 42 39 38 41Z", "dark"),
      cut("M12 54Q32 48 53 54", "steel")
    ],
    volley: [...place(arrow(), 17, 32, -27, 0.78), ...place(arrow(), 47, 32, 27, 0.78), ...place(arrow("steel"), 32, 31, 0, 1.02)],
    piercingShot: [
      body("M8 14 14 17 43 50 39 54ZM24 7 28 7 56 36 54 42Z", "dark"),
      ...place(arrow("gold"), 32, 31, 44, 1.16),
      facet("M8 48 16 44 20 49 11 55Z", "jade")
    ],
    ricochet: [
      body("M5 51 19 15 39 38 48 15 53 17 41 49 21 27 10 54Z", "jade"),
      body("M43 15 57 6 56 25 51 20Z", "gold"),
      body("M16 20 21 14 26 20 21 26ZM34 42 39 36 44 42 39 48Z", "steel")
    ],
    rainOfArrows: [
      body("M4 54Q32 40 60 54L55 59Q32 49 9 59Z", "jade"),
      ...place(arrow(), 13, 25, 180, 0.68),
      ...place(arrow("steel"), 32, 30, 180, 0.86),
      ...place(arrow(), 51, 24, 180, 0.68)
    ],
    vaultingShot: [
      body("M26 48Q10 49 9 31L4 35 7 17 19 31 13 30Q14 42 29 42Z", "jade"),
      ...place(bow(), 35, 29, 0, 0.92),
      ...place(arrow("steel"), 39, 29, 90, 0.67)
    ],
    ghostHunt: [
      ...place(bow("jade"), 45, 30, 0, 0.96, 0.32),
      ...place(bow("jade"), 22, 30, 0, 0.96),
      ...place(arrow("steel"), 33, 30, 90, 1.04),
      cut("M44 9 50 14M44 53 50 48", "jade")
    ],
    arcLightning: [
      lightning(),
      facet("M37 8 19 31 31 27 28 44 44 28 32 33Z", "steel"),
      body("M8 11 19 18 14 21ZM49 43 59 50 48 48Z", "gold")
    ],
    tempest: [
      ring("violet"),
      body("M6 21 7 7 22 10ZM58 43 57 57 42 54Z", "ice"),
      ...place([lightning(), facet("M38 6 18 32 31 28 28 47 43 30 32 34Z", "steel")], 9, 8, 0, 0.74)
    ],
    iceNova: Array.from({ length: 6 }, (_, i) => {
      const a = i * Math.PI / 3;
      return place(crystal(), 32 + Math.sin(a) * 18, 32 - Math.cos(a) * 18, i * 60, 0.49);
    }).flat(),
    frostLance: [body("M2 35 18 29 12 37ZM27 54 32 45 35 49 30 60Z", "ice"), ...place(crystal(), 32, 31, 42, 1.19)],
    absoluteZero: [
      body("M6 34Q16 52 32 49 48 52 58 34L53 53 32 62 11 53Z", "steel"),
      ...place(crystal(), 15, 35, -16, 0.56),
      ...place(crystal(), 49, 35, 16, 0.56),
      ...place(crystal(), 32, 28, 0, 1.06)
    ],
    runicWard: [
      body("M32 3 56 16V45L32 61 8 45V16Z", "jade"),
      body("M32 9 50 20V41L32 54 14 41V20Z", "dark"),
      ...place(crystal("jade"), 32, 31, 0, 0.66),
      facet("M11 18 16 16 16 38 11 42ZM48 16 53 18V42L48 38Z", "steel"),
      cut("M24 14 32 10 40 14M24 50 32 55 40 50", "jade")
    ],
    meteor: [
      body("M60 4 49 32 36 43 20 25Z", "fire"),
      facet("M50 12 43 31 30 38 25 29Z", "gold"),
      body("M21 24 36 28 42 42 34 55 20 58 8 49 6 35Z", "dark"),
      facet("M21 27 31 31 28 39 14 41 10 35Z", "fire"),
      facet("M30 41 37 35 38 44 30 52 21 54Z", "gold"),
      body("M3 57 12 54 17 60 7 62ZM46 49 56 48 60 53 47 55Z", "fire")
    ],
    cataclysm: [
      body("M4 55 12 44 20 51 31 40 44 52 53 43 61 57 46 61 29 53 16 60Z", "fire"),
      body("M37 2 36 22 28 38 18 29Z", "fire"),
      body("M13 8 19 22 15 34 8 28Z", "gold"),
      body("M61 9 53 34 45 40 39 29Z", "gold"),
      body("M27 23 35 28 35 37 26 43 17 37 18 29Z", "dark"),
      facet("M26 26 32 29 28 36 20 35Z", "fire")
    ],
    siphon: [
      body("M49 10C19-8-3 26 11 46 22 64 53 59 58 35 46 47 25 44 25 30 25 19 36 15 43 20L36 26 59 20 50 3Z", "rose"),
      facet("M43 12C21 8 8 27 17 42 27 54 44 49 50 43 29 47 19 32 28 20Z", "violet"),
      body("M36 36C29 26 21 35 27 42L36 50 45 42C51 35 43 26 36 36Z", "gold")
    ],
    // ---- Warrior ----
    heroicStrike: [...place(blade("gold"), 32, 32, 38, 0.95), ...place(star("gold"), 46, 18, 0, 0.5)],
    charge: [...place(blade("gold"), 38, 32, 90, 0.95), ...place(speedLines("gold"), 26, 32, 0, 0.9)],
    thunderClap: [...place(zap("gold"), 32, 30, 0, 0.9), ...place(halo("gold"), 32, 32, 0, 0.85)],
    hamstring: [...place(blade(), 30, 28, 40, 0.85), ...place(boot(), 40, 44, 15, 0.55)],
    overpower: [body("M10 12Q32 2 54 12L50 20Q32 12 14 20Z", "gold"), ...place(blade("gold"), 32, 36, 0, 0.8)],
    execute: [...place(blade("rose"), 32, 34, 180, 1.05), body("M14 12 24 18 20 24 10 18ZM50 12 40 18 44 24 54 18Z", "rose")],
    pummel: [...place(fist("gold"), 32, 32, 0, 0.95), ...place(star("gold"), 46, 16, 0, 0.45)],
    sunderArmor: [...place(shield("steel"), 30, 32, 0, 0.8), body("M40 8 36 22 44 30 38 44 48 38 44 26 50 18Z", "gold")],
    battleShout: [...place(horn("gold"), 28, 34, 0, 0.9), ...place(shout("gold"), 44, 30, 0, 0.8)],
    berserkerRage: [...place(fist("rose"), 32, 34, 0, 0.9), ...place(shout("rose"), 32, 14, 90, 0.55)],
    shieldSlam: [...place(shield("gold"), 28, 32, -10, 0.85), ...place(star("gold"), 46, 30, 0, 0.6)],
    shieldBlock: [...place(shield("steel"), 32, 32, 0, 0.95), ...place(halo("gold"), 32, 32, 0, 0.9)],
    revenge: [...place(shield("steel"), 24, 34, -12, 0.7), ...place(blade("gold"), 42, 30, 40, 0.85)],
    shieldWall: [...place(shield("steel"), 32, 32, 0, 1.05), ...place(shield("gold"), 32, 32, 0, 0.7)],
    mortalStrike: [...place(blade("rose"), 32, 32, 40, 0.95), ...place(clawMarks("rose"), 32, 32, 0, 0.5)],
    bloodthirst: [...place(fangs("rose"), 32, 30, 0, 0.9), ...place(drop("rose"), 32, 46, 0, 0.5)],
    bladestorm: [0, 90, 180, 270].flatMap((a) => place(blade("gold"), 32 + Math.sin(a * Math.PI / 180) * 13, 32 - Math.cos(a * Math.PI / 180) * 13, a + 45, 0.62)),
    heroicLeap: [body("M8 46Q32 16 56 46L50 52Q32 30 14 52Z", "gold"), ...place(boot(), 32, 30, 0, 0.8)],
    intimidatingShout: [...place(skull("gold"), 26, 32, 0, 0.7), ...place(shout("gold"), 44, 32, 0, 0.8)],
    sweepingStrikes: [...place(blade("gold"), 24, 32, 55, 0.8), ...place(blade("gold"), 40, 32, 15, 0.8)],
    // ---- Paladin ----
    crusaderStrike: [...place(blade("gold"), 32, 32, 38, 0.9), ...place(cross("gold"), 32, 32, 0, 0.45)],
    judgement: [...place(hammer("gold"), 32, 30, 30, 0.9), ...place(star("gold"), 46, 16, 0, 0.45)],
    sealOfCommand: [...place(rune("gold"), 32, 30, 0, 0.85), ...place(blade("gold"), 32, 36, 0, 0.6)],
    consecration: [...place(halo("gold"), 32, 36, 0, 0.95), ...place(cross("gold"), 32, 26, 0, 0.55), body("M12 50 22 44 32 52 42 44 52 50 48 56 32 58 16 56Z", "gold")],
    hammerOfJustice: [...place(hammer("gold"), 32, 32, 0, 0.95), ...place(star("gold"), 32, 10, 0, 0.4)],
    holyLight: [...place(beam("gold"), 32, 32, 0, 0.95), ...place(cross("gold"), 32, 32, 0, 0.5)],
    flashOfLight: [...place(star("gold"), 32, 32, 0, 0.85), ...place(halo("gold"), 32, 32, 0, 0.6)],
    divineShield: [...place(halo("gold"), 32, 32, 0, 1), ...place(shield("gold"), 32, 32, 0, 0.75)],
    divineProtection: [...place(shield("gold"), 32, 34, 0, 0.8), ...place(wings("gold"), 32, 26, 0, 0.7)],
    layOnHands: [...place(hands("gold"), 32, 34, 0, 0.9), ...place(cross("gold"), 32, 14, 0, 0.5)],
    avengingWrath: [...place(wings("gold"), 32, 30, 0, 1), ...place(eye("gold"), 32, 34, 0, 0.5)],
    hammerOfWrath: [...place(hammer("gold"), 32, 32, 140, 0.95), ...place(halo("gold"), 32, 32, 0, 0.8)],
    exorcism: [...place(cross("gold"), 30, 32, 0, 0.8), ...place(zap("gold"), 42, 30, 0, 0.6)],
    holyShock: [...place(zap("gold"), 32, 30, 0, 0.9), ...place(orb("gold"), 32, 44, 0, 0.5)],
    repentance: [...place(eye("gold"), 32, 30, 0, 0.9), ...place(halo("gold"), 32, 30, 0, 0.8)],
    blessingOfKings: [...place(crown("gold"), 32, 32, 0, 0.95)],
    divineStorm: [0, 120, 240].flatMap((a) => place(hammer("gold"), 32 + Math.sin(a * Math.PI / 180) * 11, 32 - Math.cos(a * Math.PI / 180) * 11, a + 30, 0.55)),
    holyShield: [...place(shield("gold"), 32, 32, 0, 0.9), ...place(cross("gold"), 32, 32, 0, 0.5)],
    // ---- Hunter ----
    arcaneShot: [...place(arrow("violet"), 32, 32, 45, 1)],
    aimedShot: [...place(target("rose"), 32, 32, 0, 0.9), ...place(arrow("jade"), 32, 32, 45, 0.9)],
    multiShot: [...place(arrow("jade"), 20, 34, 65, 0.8), ...place(arrow("jade"), 32, 30, 90, 0.8), ...place(arrow("jade"), 44, 34, 115, 0.8)],
    serpentSting: [...place(serpent("jade"), 32, 32, 0, 0.95)],
    concussiveShot: [...place(arrow("jade"), 32, 32, 45, 0.95), ...place(star("gold"), 44, 20, 0, 0.45)],
    scatterShot: [...place(arrow("jade"), 32, 34, 90, 0.7), ...place(sunburst("jade"), 32, 30, 0, 0.6)],
    freezingTrap: [...place(trap("ice"), 32, 34, 0, 0.9), ...place(snowflake("ice"), 32, 14, 0, 0.4)],
    disengage: [body("M10 44Q32 14 54 44L48 50Q32 28 16 50Z", "jade"), ...place(boot(), 32, 30, 180, 0.75)],
    aspectHawk: [...place(feather("jade"), 30, 32, 20, 0.95), ...place(eye("jade"), 42, 24, 0, 0.45)],
    feignDeath: [...place(eye("jade"), 32, 34, 0, 0.9), cut("M12 20 52 48", "dark")],
    callPet: [...place(paw("jade"), 32, 34, 0, 0.85), ...place(shout("jade"), 32, 16, 90, 0.5)],
    killCommand: [...place(paw("jade"), 26, 32, 0, 0.7), ...place(arrow("rose"), 42, 32, 90, 0.7)],
    bestialWrath: [...place(wolfHead("rose"), 32, 32, 0, 0.95)],
    huntersVolley: [...place(arrow("jade"), 16, 24, 160, 0.6), ...place(arrow("jade"), 32, 28, 180, 0.7), ...place(arrow("jade"), 48, 24, 200, 0.6), body("M10 52Q32 44 54 52L50 58Q32 52 14 58Z", "jade")],
    explosiveShot: [...place(bomb("dark"), 32, 34, 0, 0.9), ...place(arrow("jade"), 40, 26, 45, 0.6)],
    steadyShot: [...place(bow("jade"), 30, 32, 0, 0.85), ...place(arrow("steel"), 38, 32, 90, 0.7)],
    killShot: [...place(skull("rose"), 32, 30, 0, 0.7), ...place(arrow("steel"), 32, 36, 90, 0.75)],
    chimeraShot: [...place(serpent("jade"), 26, 32, 0, 0.7), ...place(ember("fire"), 44, 30, 0, 0.55)],
    // ---- Rogue ----
    sinisterStrike: [...place(dagger("jade"), 32, 32, 40, 0.95)],
    eviscerate: [...place(dagger("jade"), 26, 30, 55, 0.8), ...place(dagger("jade"), 38, 34, 25, 0.8), ...place(drop("rose"), 32, 48, 0, 0.45)],
    ambush: [...place(hood("dark"), 30, 30, 0, 0.8), ...place(dagger("jade"), 42, 38, 40, 0.7)],
    garrote: [...place(swirl("rose"), 32, 32, 0, 0.8), ...place(dagger("jade"), 32, 30, 90, 0.6)],
    rupture: [...place(clawMarks("rose"), 32, 32, 0, 0.8), ...place(drop("rose"), 44, 44, 0, 0.5)],
    kidneyShot: [...place(dagger("jade"), 30, 34, 40, 0.85), ...place(star("gold"), 44, 18, 0, 0.45)],
    sliceAndDice: [...place(dagger("jade"), 26, 32, 60, 0.75), ...place(dagger("jade"), 38, 32, 30, 0.75), cut("M14 50 50 14", "rose")],
    stealth: [...place(hood("dark"), 32, 32, 0, 1)],
    vanish: [...place(hood("dark"), 32, 32, 0, 0.95), ...place(cloud("dark"), 32, 44, 0, 0.7)],
    sap: [...place(fist("jade"), 30, 34, 0, 0.8), ...place(star("gold"), 44, 18, 0, 0.4), ...place(star("gold"), 50, 28, 0, 0.3)],
    gouge: [...place(eye("jade"), 32, 30, 0, 0.9), ...place(dagger("jade"), 32, 40, 90, 0.55)],
    kick: [...place(boot(), 32, 32, -30, 0.9)],
    sprint: [...place(boot(), 34, 32, 0, 0.85), ...place(speedLines("jade"), 24, 32, 0, 0.85)],
    evasion: [...place(dagger("jade"), 40, 30, 40, 0.7), ...place(boot(), 26, 38, 15, 0.7)],
    blind: [...place(eye("jade"), 32, 32, 0, 0.95), cut("M16 16 48 48", "rose")],
    fanOfKnives: [0, 72, 144, 216, 288].flatMap((a) => place(dagger("jade"), 32 + Math.sin(a * Math.PI / 180) * 12, 32 - Math.cos(a * Math.PI / 180) * 12, a, 0.5)),
    adrenalineRush: [...place(zap("gold"), 32, 32, 0, 0.95), ...place(heart("rose"), 32, 34, 0, 0.5)],
    cheapShot: [...place(hood("dark"), 30, 30, 0, 0.7), ...place(fist("jade"), 40, 38, 0, 0.6)],
    hemorrhage: [...place(dagger("rose"), 32, 30, 40, 0.8), ...place(drop("rose"), 26, 46, 0, 0.5), ...place(drop("rose"), 40, 48, 0, 0.4)],
    cloakOfShadows: [...place(hood("violet"), 32, 32, 0, 0.95), ...place(halo("violet"), 32, 32, 0, 0.8)],
    // ---- Priest ----
    smite: [...place(bolt("gold"), 32, 32, 30, 0.9), ...place(halo("gold"), 32, 32, 0, 0.7)],
    shadowWordPain: [...place(rune("violet"), 32, 30, 0, 0.85), ...place(drop("violet"), 32, 46, 0, 0.5)],
    mindBlast: [...place(orb("violet"), 32, 32, 0, 0.9), ...place(zap("violet"), 32, 32, 0, 0.6)],
    mindFlay: [...place(beam("violet"), 30, 32, 25, 0.9), ...place(orb("violet"), 44, 40, 0, 0.4)],
    powerWordShield: [...place(dome("gold"), 32, 30, 0, 0.95), ...place(orb("gold"), 32, 34, 0, 0.5)],
    renew: [...place(cross("jade"), 32, 32, 0, 0.8), ...place(halo("jade"), 32, 32, 0, 0.75)],
    flashHeal: [...place(star("gold"), 32, 32, 0, 0.7), ...place(cross("gold"), 32, 32, 0, 0.5)],
    greaterHeal: [...place(cross("gold"), 32, 32, 0, 0.95), ...place(halo("gold"), 32, 32, 0, 0.85)],
    psychicScream: [...place(skull("violet"), 26, 32, 0, 0.7), ...place(shout("violet"), 44, 32, 0, 0.8)],
    dispelMagic: [...place(rune("violet"), 32, 32, 0, 0.85), cut("M18 18 46 46", "rose")],
    shadowform: [...place(ghost("violet"), 32, 32, 0, 0.95), ...place(halo("violet"), 32, 32, 0, 0.85)],
    holyNova: [...place(sunburst("gold"), 32, 32, 0, 0.95)],
    prayerOfHealing: [...place(halo("gold"), 32, 32, 0, 0.9), ...place(cross("gold"), 32, 32, 0, 0.55), ...place(heart("rose"), 32, 46, 0, 0.35)],
    innerFire: [...place(ember("gold"), 32, 32, 0, 0.9), ...place(halo("gold"), 32, 32, 0, 0.8)],
    shadowWordDeath: [...place(skull("violet"), 32, 30, 0, 0.8), ...place(bolt("violet"), 32, 44, 0, 0.5)],
    silence: [...place(shout("violet"), 30, 32, 0, 0.9), cut("M40 14 56 46M56 14 40 46", "rose")],
    vampiricEmbrace: [...place(fangs("violet"), 32, 28, 0, 0.85), ...place(heart("rose"), 32, 44, 0, 0.55)],
    // ---- Death Knight ----
    icyTouch: [...place(grasp("ice"), 32, 32, 0, 0.85), ...place(snowflake("ice"), 40, 18, 0, 0.4)],
    plagueStrike: [...place(blade("jade"), 30, 32, 40, 0.85), ...place(insect("jade"), 44, 44, 0, 0.45)],
    bloodStrike: [...place(blade("rose"), 32, 32, 40, 0.9), ...place(drop("rose"), 44, 44, 0, 0.5)],
    deathStrike: [...place(blade("dark"), 30, 32, 40, 0.9), ...place(heart("rose"), 44, 22, 0, 0.45)],
    obliterate: [...place(blade("ice"), 26, 32, 55, 0.8), ...place(blade("ice"), 38, 32, 25, 0.8), ...place(snowflake("ice"), 32, 32, 0, 0.4)],
    scourgeStrike: [...place(blade("jade"), 30, 32, 40, 0.85), ...place(skull("jade"), 44, 20, 0, 0.4)],
    deathCoil: [...place(swirl("jade"), 32, 32, 0, 0.9), ...place(skull("jade"), 32, 32, 0, 0.45)],
    deathGrip: [...place(hook("dark"), 40, 26, 135, 0.95), ...place(link("dark"), 24, 44, 45, 0.7)],
    chainsOfIce: [...place(link("ice"), 32, 32, 0, 0.95), ...place(snowflake("ice"), 32, 32, 0, 0.5)],
    mindFreeze: [...place(snowflake("ice"), 32, 32, 0, 0.9), ...place(rune("ice"), 32, 32, 0, 0.5)],
    bloodBoil: [...place(drop("rose"), 32, 30, 0, 0.9), ...place(halo("rose"), 32, 34, 0, 0.75)],
    deathAndDecay: [...place(skull("jade"), 32, 28, 0, 0.7), ...place(halo("jade"), 32, 38, 0, 0.85)],
    frostPresence: [...place(shield("ice"), 32, 32, 0, 0.9), ...place(snowflake("ice"), 32, 32, 0, 0.45)],
    bloodPresence: [...place(shield("rose"), 32, 32, 0, 0.9), ...place(drop("rose"), 32, 32, 0, 0.5)],
    unholyPresence: [...place(shield("jade"), 32, 32, 0, 0.9), ...place(skull("jade"), 32, 32, 0, 0.45)],
    iceboundFortitude: [...place(iceBlockShape("ice"), 32, 32, 0, 0.9), ...place(shield("ice"), 32, 32, 0, 0.55)],
    antiMagicShell: [...place(dome("jade"), 32, 30, 0, 0.95), ...place(rune("jade"), 32, 34, 0, 0.5)],
    raiseDead: [...place(handRise("jade"), 32, 30, 0, 0.9), body("M10 50 22 44 32 52 42 44 54 50 50 56 32 58 14 56Z", "dark")],
    armyOfDead: [...place(skull("jade"), 20, 36, 0, 0.5), ...place(skull("jade"), 44, 36, 0, 0.5), ...place(handRise("jade"), 32, 26, 0, 0.7)],
    strangulate: [...place(grasp("rose"), 32, 32, 0, 0.9), cut("M22 20 42 44M42 20 22 44", "rose")],
    // ---- Shaman ----
    lightningBolt: [...place(zap("violet"), 32, 32, 0, 1)],
    chainLightning: [...place(zap("violet"), 28, 32, 0, 0.85), ...place(link("violet"), 42, 34, 0, 0.6)],
    earthShock: [...place(rock("jade"), 32, 32, 0, 0.9), ...place(star("jade"), 44, 18, 0, 0.4)],
    flameShock: [...place(ember("fire"), 32, 32, 0, 0.95)],
    frostShock: [...place(snowflake("ice"), 32, 32, 0, 0.9)],
    lavaBurst: [...place(ember("fire"), 32, 30, 0, 0.85), ...place(rock("fire"), 32, 40, 0, 0.55)],
    stormstrike: [...place(axe("violet"), 30, 32, 40, 0.85), ...place(zap("violet"), 42, 26, 0, 0.55)],
    windShear: [...place(tornado("jade"), 32, 32, 0, 0.8), cut("M18 46 46 18", "jade")],
    healingWave: [...place(wave("jade"), 32, 30, 0, 0.95), ...place(cross("jade"), 32, 40, 0, 0.5)],
    lesserHealingWave: [...place(wave("jade"), 32, 34, 0, 0.75), ...place(cross("jade"), 32, 40, 0, 0.4)],
    chainHeal: [...place(link("jade"), 32, 30, 0, 0.9), ...place(cross("jade"), 32, 42, 0, 0.5)],
    searingTotem: [...place(totem("fire"), 32, 32, 0, 0.9), ...place(ember("fire"), 32, 12, 0, 0.4)],
    healingStreamTotem: [...place(totem("jade"), 32, 32, 0, 0.9), ...place(drop("ice"), 32, 12, 0, 0.4)],
    earthbindTotem: [...place(totem("jade"), 32, 30, 0, 0.85), ...place(vine("jade"), 32, 44, 0, 0.5)],
    ghostWolf: [...place(wolfHead("ice"), 32, 32, 0, 0.95), ...place(halo("ice"), 32, 32, 0, 0.8)],
    bloodlust: [...place(heart("rose"), 32, 32, 0, 0.95), ...place(shout("rose"), 32, 32, 0, 0.8)],
    feralSpirit: [...place(wolfHead("jade"), 24, 32, 0, 0.6), ...place(wolfHead("jade"), 42, 32, 0, 0.6)],
    thunderstorm: [...place(cloud("ice"), 32, 24, 0, 0.9), ...place(zap("violet"), 32, 40, 0, 0.7)],
    lightningShield: [...place(shield("violet"), 32, 32, 0, 0.85), ...place(zap("violet"), 32, 32, 0, 0.55)],
    // ---- Mage ----
    frostbolt: [...place(crystal("ice"), 32, 32, 40, 0.9), ...place(bolt("ice"), 32, 32, 40, 0.6)],
    pyroblast: [...place(orb("fire"), 32, 34, 0, 0.95), ...place(ember("fire"), 32, 20, 0, 0.55)],
    fireBlast: [...place(ember("fire"), 32, 32, 0, 0.9), ...place(halo("fire"), 32, 32, 0, 0.8)],
    scorch: [...place(ember("fire"), 34, 32, 0, 0.8), ...place(speedLines("fire"), 24, 32, 0, 0.8)],
    arcaneMissiles: [...place(missile("violet"), 22, 32, 30, 0.7), ...place(missile("violet"), 32, 30, 0, 0.7), ...place(missile("violet"), 42, 32, -30, 0.7)],
    arcaneExplosion: [...place(sunburst("violet"), 32, 32, 0, 0.9)],
    frostNova: [...place(snowflake("ice"), 32, 32, 0, 0.9), ...place(halo("ice"), 32, 32, 0, 0.85)],
    iceLance: [...place(crystal("ice"), 32, 32, 40, 1.2)],
    coneOfCold: [...place(crystal("ice"), 22, 34, 65, 0.6), ...place(crystal("ice"), 32, 30, 90, 0.6), ...place(crystal("ice"), 42, 34, 115, 0.6)],
    blizzard: [...place(cloud("ice"), 32, 22, 0, 0.9), ...place(snowflake("ice"), 24, 42, 0, 0.45), ...place(snowflake("ice"), 40, 46, 0, 0.45)],
    blink: [...place(speedLines("violet"), 24, 32, 0, 0.9), ...place(star("violet"), 44, 32, 0, 0.7)],
    polymorph: [...place(sheepHead("violet"), 32, 32, 0, 0.95)],
    counterspell: [...place(rune("violet"), 32, 32, 0, 0.9), cut("M20 20 44 44M44 20 20 44", "rose")],
    iceBlock: [...place(iceBlockShape("ice"), 32, 32, 0, 1)],
    iceBarrier: [...place(dome("ice"), 32, 30, 0, 0.95), ...place(snowflake("ice"), 32, 34, 0, 0.45)],
    evocation: [...place(orb("violet"), 32, 32, 0, 0.8), ...place(halo("violet"), 32, 32, 0, 0.7), ...place(star("violet"), 32, 32, 0, 0.4)],
    mirrorImage: [...place(hood("violet"), 24, 32, 0, 0.7, 0.45), ...place(hood("violet"), 40, 32, 0, 0.7, 0.45), ...place(hood("violet"), 32, 30, 0, 0.8)],
    combustion: [...place(ember("fire"), 32, 32, 0, 0.9), ...place(rune("fire"), 32, 32, 0, 0.5)],
    dragonsBreath: [...place(ember("fire"), 24, 36, 0, 0.6), ...place(ember("fire"), 34, 32, 0, 0.75), ...place(ember("fire"), 44, 28, 0, 0.6)],
    deepFreeze: [...place(iceBlockShape("ice"), 32, 32, 0, 0.85), ...place(snowflake("ice"), 32, 32, 0, 0.5)],
    // ---- Warlock ----
    shadowBolt: [...place(bolt("violet"), 32, 32, 30, 1)],
    immolate: [...place(ember("fire"), 32, 30, 0, 0.9), ...place(drop("fire"), 32, 46, 0, 0.5)],
    corruption: [...place(swirl("violet"), 32, 32, 0, 0.95), ...place(drop("violet"), 32, 44, 0, 0.45)],
    curseOfAgony: [...place(skull("violet"), 32, 30, 0, 0.8), ...place(rune("violet"), 32, 44, 0, 0.45)],
    unstableAffliction: [...place(orb("violet"), 32, 32, 0, 0.9), ...place(swirl("violet"), 32, 32, 0, 0.65)],
    drainLife: [...place(beam("jade"), 28, 32, 25, 0.85), ...place(heart("rose"), 44, 40, 0, 0.45)],
    drainSoul: [...place(beam("violet"), 28, 32, 25, 0.85), ...place(ghost("violet"), 44, 38, 0, 0.45)],
    searingPain: [...place(bolt("fire"), 32, 32, 30, 0.95)],
    shadowburn: [...place(ember("violet"), 32, 32, 0, 0.95)],
    chaosBolt: [...place(ember("jade"), 32, 32, 0, 0.9), ...place(bolt("jade"), 32, 32, 30, 0.6)],
    conflagrate: [...place(ember("fire"), 32, 32, 0, 0.85), ...place(halo("fire"), 32, 32, 0, 0.8)],
    fear: [...place(ghost("violet"), 32, 32, 0, 0.95)],
    howlOfTerror: [...place(ghost("violet"), 26, 32, 0, 0.7), ...place(shout("violet"), 44, 32, 0, 0.8)],
    warlockDeathCoil: [...place(swirl("violet"), 32, 32, 0, 0.9), ...place(skull("violet"), 32, 32, 0, 0.45)],
    lifeTap: [...place(drop("rose"), 32, 30, 0, 0.85), ...place(orb("violet"), 32, 44, 0, 0.45)],
    felArmor: [...place(shield("jade"), 32, 32, 0, 0.9), ...place(horns("jade"), 32, 26, 0, 0.55)],
    summonImp: [...place(impHead("jade"), 32, 32, 0, 0.95)],
    summonFelguard: [...place(demonHead("jade"), 32, 32, 0, 0.95)],
    metamorphosis: [...place(demonHead("jade"), 32, 34, 0, 0.8), ...place(wings("jade"), 32, 24, 0, 0.8)],
    seedOfCorruption: [...place(seedPod("violet"), 32, 32, 0, 0.95)],
    rainOfFire: [...place(meteorRock("fire"), 24, 40, 0, 0.5), ...place(meteorRock("fire"), 42, 44, 0, 0.45), ...place(ember("fire"), 34, 20, 0, 0.5)],
    shadowfury: [...place(meteorRock("violet"), 32, 32, 0, 0.95)],
    // ---- Druid ----
    wrath: [...place(bolt("jade"), 32, 32, 30, 0.9), ...place(leaf("jade"), 32, 32, 0, 0.45)],
    starfire: [...place(star("violet"), 32, 32, 0, 0.9), ...place(bolt("violet"), 32, 36, 0, 0.5)],
    moonfire: [...place(moon("violet"), 32, 32, 0, 0.9), ...place(ember("violet"), 40, 40, 0, 0.4)],
    insectSwarm: [...place(insect("jade"), 24, 30, 0, 0.6), ...place(insect("jade"), 40, 26, 30, 0.55), ...place(insect("jade"), 34, 42, -20, 0.55)],
    entanglingRoots: [...place(vine("jade"), 26, 32, 0, 0.85), ...place(vine("jade"), 40, 34, 15, 0.7)],
    hurricane: [...place(tornado("ice"), 32, 32, 0, 0.95)],
    starfall: [...place(star("violet"), 32, 20, 0, 0.6), ...place(star("violet"), 20, 38, 0, 0.45), ...place(star("violet"), 44, 38, 0, 0.45), ...place(star("violet"), 32, 48, 0, 0.35)],
    healingTouch: [...place(leaf("jade"), 32, 32, 0, 0.9), ...place(cross("jade"), 32, 32, 0, 0.45)],
    regrowth: [...place(vine("jade"), 32, 32, 0, 0.9), ...place(cross("jade"), 32, 16, 0, 0.4)],
    rejuvenation: [...place(leaf("jade"), 32, 32, 0, 0.85), ...place(halo("jade"), 32, 32, 0, 0.75)],
    swiftmend: [...place(cross("jade"), 32, 32, 0, 0.8), ...place(star("jade"), 32, 32, 0, 0.5)],
    barkskin: [...place(bark("jade"), 32, 32, 0, 0.95)],
    bearForm: [...place(bearHead("jade"), 32, 32, 0, 1)],
    catForm: [...place(catHead("jade"), 32, 32, 0, 1)],
    moonkinForm: [...place(owlHead("violet"), 32, 32, 0, 1)],
    travelForm: [...place(hoof("jade"), 34, 32, 0, 0.9), ...place(speedLines("jade"), 24, 32, 0, 0.8)],
    maul: [...place(paw("jade"), 32, 32, 0, 0.95)],
    swipe: [...place(clawMarks("jade"), 32, 32, 0, 0.9), ...place(halo("jade"), 32, 32, 0, 0.7)],
    bash: [...place(paw("jade"), 32, 34, 0, 0.85), ...place(star("gold"), 32, 14, 0, 0.4)],
    feralCharge: [...place(paw("jade"), 38, 32, 0, 0.85), ...place(speedLines("jade"), 24, 32, 0, 0.85)],
    mangle: [...place(clawMarks("rose"), 32, 32, 0, 0.9), ...place(paw("jade"), 32, 36, 0, 0.5)],
    claw: [...place(clawMarks("jade"), 32, 32, 0, 0.95)],
    rake: [...place(clawMarks("jade"), 32, 32, 0, 0.85), ...place(drop("rose"), 44, 44, 0, 0.45)],
    rip: [...place(clawMarks("rose"), 32, 32, 0, 0.9), ...place(drop("rose"), 26, 46, 0, 0.5), ...place(drop("rose"), 40, 48, 0, 0.4)],
    ferociousBite: [...place(fangs("jade"), 32, 32, 0, 0.95)],
    prowl: [...place(catHead("dark"), 32, 32, 0, 0.95), ...place(halo("violet"), 32, 32, 0, 0.8)],
    pounce: [...place(catHead("jade"), 30, 28, 0, 0.6), ...place(paw("jade"), 38, 42, 0, 0.55)],
    faerieFire: [...place(star("jade"), 32, 32, 0, 0.85), ...place(swirl("jade"), 32, 32, 0, 0.6)],
    innervate: [...place(orb("jade"), 32, 32, 0, 0.85), ...place(leaf("jade"), 32, 32, 0, 0.5)],
    // ---- Racial actives ----
    everyMan: [...place(brokenChain("gold"), 32, 32, 0, 0.95)],
    stoneform: [...place(rock("steel"), 32, 32, 0, 0.95), ...place(shield("steel"), 32, 32, 0, 0.6)],
    shadowmeld: [...place(hood("violet"), 32, 32, 0, 0.9), ...place(moon("violet"), 44, 18, 0, 0.4)],
    escapeArtist: [...place(boot(), 34, 32, 0, 0.85), ...place(brokenChain("gold"), 26, 40, 0, 0.5)],
    giftNaaru: [...place(rune("gold"), 32, 32, 0, 0.9), ...place(halo("gold"), 32, 32, 0, 0.8)],
    bloodFury: [...place(fist("rose"), 32, 32, 0, 0.9), ...place(drop("rose"), 32, 14, 0, 0.45)],
    willForsaken: [...place(skull("dark"), 32, 32, 0, 0.9), ...place(halo("violet"), 32, 32, 0, 0.8)],
    warStomp: [...place(hoof("jade"), 32, 28, 0, 0.9), ...place(halo("jade"), 32, 42, 0, 0.7)],
    berserking: [...place(zap("fire"), 32, 32, 0, 0.9), ...place(fangs("rose"), 32, 40, 0, 0.5)],
    arcaneTorrent: [...place(swirl("violet"), 32, 32, 0, 0.9), ...place(star("violet"), 32, 32, 0, 0.5)]
  };
  var authored = Object.freeze(
    Object.fromEntries(Object.entries(recipes).map(([id, parts]) => [id, Object.freeze(parts.map((p2) => Object.freeze({
      ...p2,
      ...p2.transform ? { transform: Object.freeze(p2.transform) } : {}
    })))]))
  );
  function recipeSchool(id) {
    const r = SKILL_EXECUTION[id];
    if (!r) return null;
    if (r.kind === "projectile") return r.effects.style ?? null;
    if ("style" in r && r.style) return r.style;
    if ("school" in r && r.school) return r.school;
    if (r.kind === "dot") return r.dot.school;
    return null;
  }
  var SCHOOL_MATERIALS = Object.freeze({
    fire: "fire",
    frost: "ice",
    lightning: "ice",
    nature: "jade",
    poison: "jade",
    holy: "gold",
    radiant: "gold",
    shadow: "violet",
    arcane: "violet",
    spirit: "violet",
    physical: "steel",
    bleed: "rose",
    arrow: "jade"
  });
  function nearestMaterial(color) {
    const hex = color && /^#[0-9a-f]{6}$/i.exec(color);
    if (!hex) return null;
    const r = parseInt(hex[0].slice(1, 3), 16), g = parseInt(hex[0].slice(3, 5), 16), b = parseInt(hex[0].slice(5, 7), 16);
    let best = null, dist = Infinity;
    for (const [key, mat] of Object.entries(ICON_MATERIALS)) {
      const dr = r - parseInt(mat.face.slice(1, 3), 16), dg = g - parseInt(mat.face.slice(3, 5), 16), db = b - parseInt(mat.face.slice(5, 7), 16);
      const d = dr * dr + dg * dg + db * db;
      if (d < dist) {
        dist = d;
        best = key;
      }
    }
    return best;
  }
  var KEYWORD_MOTIFS = [
    ["searing totem", (m) => totem(m), "fire"],
    ["magma totem", (m) => totem(m), "fire"],
    ["flametongue totem", (m) => totem(m), "fire"],
    ["totem of wrath", (m) => totem(m), "fire"],
    ["fire elemental totem", (m) => totem(m), "fire"],
    ["healing stream totem", (m) => totem(m), "ice"],
    ["mana spring totem", (m) => totem(m), "ice"],
    ["wrath of air totem", (m) => totem(m), "ice"],
    ["windfury totem", (m) => totem(m), "ice"],
    ["cleansing totem", (m) => totem(m), "ice"],
    ["grounding totem", (m) => totem(m), "violet"],
    ["earthbind totem", (m) => totem(m), "jade"],
    ["strength of earth totem", (m) => totem(m), "jade"],
    ["stoneskin totem", (m) => totem(m), "jade"],
    ["tremor totem", (m) => totem(m), "jade"],
    ["earth elemental totem", (m) => totem(m), "jade"],
    ["totem", (m) => totem(m)],
    ["force of nature", (m) => leaf(m), "jade"],
    ["treant", (m) => leaf(m), "jade"],
    ["feral spirit", (m) => wolfHead(m)],
    ["spirit wolf", (m) => wolfHead(m)],
    ["ghost wolf", (m) => wolfHead(m)],
    ["dire bear", (m) => bearHead(m)],
    ["bear form", (m) => bearHead(m)],
    ["cat form", (m) => catHead(m)],
    ["moonkin", (m) => owlHead(m)],
    ["polymorph", (m) => sheepHead(m)],
    ["sheep", (m) => sheepHead(m)],
    ["metamorph", (m) => demonHead(m)],
    ["transform", (m) => demonHead(m)],
    ["doomguard", (m) => demonHead(m), "jade"],
    ["felguard", (m) => demonHead(m), "jade"],
    ["demon", (m) => demonHead(m)],
    ["voidwalker", (m) => hood(m), "violet"],
    ["succubus", (m) => heart(m), "violet"],
    ["seduc", (m) => heart(m), "violet"],
    ["felhunter", (m) => wolfHead(m), "jade"],
    ["gargoyle", (m) => wings(m), "violet"],
    ["summonimp", (m) => impHead(m)],
    ["imp", (m) => impHead(m)],
    ["water elemental", (m) => wave(m), "ice"],
    ["earth elemental", (m) => rock(m), "jade"],
    ["fire elemental", (m) => ember(m), "fire"],
    ["elemental", (m) => crystal(m)],
    ["army of the dead", (m) => handRise(m)],
    ["raise dead", (m) => handRise(m)],
    ["ghoul", (m) => skull(m)],
    ["mirror image", (m) => crystal(m)],
    ["dancing rune", (m) => blade(m)],
    ["shout", (m) => shout(m)],
    ["roar", (m) => shout(m)],
    ["howl", (m) => shout(m)],
    ["intimidat", (m) => shout(m)],
    ["demoraliz", (m) => shout(m)],
    ["challenging", (m) => shout(m)],
    ["command", (m) => shout(m)],
    ["bloodlust", (m) => shout(m)],
    ["heroism", (m) => shout(m)],
    ["rallying", (m) => shout(m)],
    ["growl", (m) => shout(m)],
    ["scream", (m) => shout(m)],
    ["berserk", (m) => fist(m)],
    ["enrage", (m) => fist(m)],
    ["rampage", (m) => fist(m)],
    ["frenzy", (m) => fist(m)],
    ["recklessness", (m) => fist(m)],
    ["hysteria", (m) => fist(m)],
    ["fury", (m) => fist(m)],
    ["bash", (m) => hammer(m)],
    ["curse", (m) => skull(m)],
    ["agony", (m) => skull(m)],
    ["affliction", (m) => skull(m)],
    ["corpse", (m) => skull(m)],
    ["decay", (m) => skull(m)],
    ["scourge", (m) => skull(m)],
    ["lich", (m) => skull(m), "violet"],
    ["desecr", (m) => skull(m), "violet"],
    ["skull", (m) => skull(m)],
    ["death", (m) => skull(m), "violet"],
    ["unholy", (m) => skull(m), "violet"],
    ["festering", (m) => insect(m)],
    ["outbreak", (m) => insect(m)],
    ["poison", (m) => drop(m), "jade"],
    ["venom", (m) => drop(m), "jade"],
    ["envenom", (m) => drop(m), "jade"],
    ["scorpid", (m) => insect(m), "jade"],
    ["serpent", (m) => serpent(m), "jade"],
    ["viper", (m) => serpent(m), "jade"],
    ["wyvern", (m) => serpent(m), "jade"],
    ["sting", (m) => serpent(m), "jade"],
    ["bleed", (m) => clawMarks(m), "rose"],
    ["rend", (m) => clawMarks(m), "rose"],
    ["garrote", (m) => clawMarks(m), "rose"],
    ["rupture", (m) => clawMarks(m), "rose"],
    ["lacerat", (m) => clawMarks(m), "rose"],
    ["gore", (m) => clawMarks(m), "rose"],
    ["claw", (m) => clawMarks(m)],
    ["swipe", (m) => clawMarks(m)],
    ["rake", (m) => clawMarks(m)],
    ["maul", (m) => clawMarks(m)],
    ["mangle", (m) => clawMarks(m)],
    ["shred", (m) => clawMarks(m)],
    ["ravage", (m) => clawMarks(m)],
    ["pounce", (m) => clawMarks(m)],
    ["thrash", (m) => clawMarks(m)],
    ["hamstring", (m) => clawMarks(m)],
    ["clip", (m) => clawMarks(m)],
    ["bite", (m) => fangs(m)],
    ["fang", (m) => fangs(m)],
    ["cannibal", (m) => fangs(m)],
    ["bloodthirst", (m) => fangs(m)],
    ["blood", (m) => drop(m), "rose"],
    ["grip", (m) => hook(m)],
    ["hook", (m) => hook(m)],
    ["strangulate", (m) => grasp(m)],
    ["drain", (m) => grasp(m)],
    ["siphon", (m) => grasp(m)],
    ["leech", (m) => grasp(m)],
    ["vampiric", (m) => grasp(m)],
    ["tap", (m) => grasp(m)],
    ["pact", (m) => grasp(m)],
    ["harvest", (m) => grasp(m)],
    ["pickpocket", (m) => grasp(m)],
    ["heal", (m) => cross(m)],
    ["mend", (m) => cross(m)],
    ["renew", (m) => cross(m)],
    ["regen", (m) => cross(m)],
    ["rejuven", (m) => cross(m)],
    ["revive", (m) => cross(m)],
    ["resurrect", (m) => cross(m)],
    ["redemption", (m) => cross(m)],
    ["rebirth", (m) => cross(m)],
    ["reincarnation", (m) => cross(m)],
    ["nourish", (m) => cross(m)],
    ["growth", (m) => cross(m)],
    ["lifebloom", (m) => cross(m)],
    ["prayer", (m) => hands(m)],
    ["glory", (m) => cross(m)],
    ["guardian spirit", (m) => wings(m)],
    ["archangel", (m) => wings(m)],
    ["avenging", (m) => wings(m)],
    ["cleanse", (m) => swirl(m)],
    ["cleansing", (m) => swirl(m)],
    ["purif", (m) => swirl(m)],
    ["dispel", (m) => swirl(m)],
    ["purge", (m) => swirl(m)],
    ["abolish", (m) => swirl(m)],
    ["remove", (m) => swirl(m)],
    ["spellsteal", (m) => swirl(m)],
    ["counterspell", (m) => swirl(m)],
    ["silence", (m) => swirl(m)],
    ["shear", (m) => swirl(m)],
    ["banish", (m) => swirl(m)],
    ["spell lock", (m) => swirl(m)],
    ["slow", (m) => swirl(m)],
    ["ice block", (m) => iceBlockShape(m), "ice"],
    ["icebound", (m) => iceBlockShape(m), "ice"],
    ["frost", (m) => snowflake(m), "ice"],
    ["ice", (m) => snowflake(m), "ice"],
    ["blizzard", (m) => snowflake(m), "ice"],
    ["freeze", (m) => snowflake(m), "ice"],
    ["chill", (m) => snowflake(m), "ice"],
    ["winter", (m) => snowflake(m), "ice"],
    ["cold", (m) => snowflake(m), "ice"],
    ["icy", (m) => snowflake(m), "ice"],
    ["meteor", (m) => meteorRock(m), "fire"],
    ["inferno", (m) => meteorRock(m), "fire"],
    ["rain of fire", (m) => meteorRock(m), "fire"],
    ["cataclysm", (m) => meteorRock(m)],
    ["fire", (m) => ember(m), "fire"],
    ["flame", (m) => ember(m), "fire"],
    ["immolate", (m) => ember(m), "fire"],
    ["incinerate", (m) => ember(m), "fire"],
    ["pyro", (m) => ember(m), "fire"],
    ["scorch", (m) => ember(m), "fire"],
    ["conflag", (m) => ember(m), "fire"],
    ["ignite", (m) => ember(m), "fire"],
    ["combust", (m) => ember(m), "fire"],
    ["lava", (m) => ember(m), "fire"],
    ["magma", (m) => ember(m), "fire"],
    ["searing", (m) => ember(m), "fire"],
    ["hellfire", (m) => ember(m), "fire"],
    ["burn", (m) => ember(m), "fire"],
    ["dragon", (m) => ember(m), "fire"],
    ["stormstrike", (m) => [...blade(m), ...zap("violet")]],
    ["lightning", (m) => zap(m), "ice"],
    ["thunder", (m) => zap(m), "ice"],
    ["shock", (m) => zap(m), "ice"],
    ["storm", (m) => tornado(m)],
    ["tempest", (m) => tornado(m)],
    ["hurricane", (m) => tornado(m)],
    ["cyclone", (m) => tornado(m)],
    ["tornado", (m) => tornado(m)],
    ["typhoon", (m) => tornado(m)],
    ["wind", (m) => speedLines(m)],
    ["gust", (m) => speedLines(m)],
    ["shadow", (m) => ghost(m), "violet"],
    ["void", (m) => hood(m), "violet"],
    ["terror", (m) => ghost(m), "violet"],
    ["horror", (m) => ghost(m)],
    ["despair", (m) => ghost(m)],
    ["fear", (m) => ghost(m)],
    ["scare", (m) => ghost(m)],
    ["nightmare", (m) => ghost(m)],
    ["dispers", (m) => ghost(m)],
    ["spirit", (m) => ghost(m)],
    ["soul", (m) => ghost(m)],
    ["forsaken", (m) => ghost(m)],
    ["spectral", (m) => ghost(m)],
    ["wraith", (m) => ghost(m)],
    ["mind", (m) => eye(m)],
    ["psychic", (m) => eye(m)],
    ["vision", (m) => eye(m)],
    ["holy", (m) => sunburst(m), "gold"],
    ["divine storm", (m) => sunburst(m), "gold"],
    ["smite", (m) => sunburst(m), "gold"],
    ["consecr", (m) => sunburst(m)],
    ["righteous", (m) => sunburst(m)],
    ["sanctity", (m) => sunburst(m)],
    ["retribution", (m) => sunburst(m), "gold"],
    ["light", (m) => sunburst(m), "gold"],
    ["judg", (m) => hammer(m)],
    ["hammer", (m) => hammer(m)],
    ["exorcis", (m) => beam(m)],
    ["penance", (m) => beam(m)],
    ["beacon", (m) => beam(m)],
    ["beam", (m) => beam(m)],
    ["ray", (m) => beam(m)],
    ["illumination", (m) => beam(m)],
    ["blessing", (m) => hands(m)],
    ["hand of", (m) => hands(m)],
    ["hands", (m) => hands(m)],
    ["missile", (m) => missile(m)],
    ["barrage", (m) => missile(m)],
    ["arcane", (m) => rune(m)],
    ["evocat", (m) => orb(m)],
    ["conjur", (m) => orb(m)],
    ["brilliance", (m) => rune(m)],
    ["intellect", (m) => rune(m)],
    ["mana", (m) => orb(m)],
    ["innervate", (m) => orb(m)],
    ["healthstone", (m) => heart(m)],
    ["soulstone", (m) => ghost(m)],
    ["spellstone", (m) => orb(m)],
    ["firestone", (m) => orb(m)],
    ["starfall", (m) => star(m)],
    ["starfire", (m) => star(m)],
    ["starsurge", (m) => star(m)],
    ["star", (m) => star(m)],
    ["sunfire", (m) => sunburst(m)],
    ["solar", (m) => sunburst(m)],
    ["moon", (m) => moon(m)],
    ["lunar", (m) => moon(m)],
    ["eclipse", (m) => moon(m)],
    ["hibernate", (m) => moon(m)],
    ["faerie", (m) => star(m)],
    ["insect", (m) => insect(m)],
    ["swarm", (m) => insect(m)],
    ["root", (m) => vine(m), "jade"],
    ["entangl", (m) => vine(m), "jade"],
    ["vine", (m) => vine(m), "jade"],
    ["web", (m) => vine(m), "jade"],
    ["bark", (m) => bark(m), "jade"],
    ["thorn", (m) => leaf(m), "jade"],
    ["wild", (m) => leaf(m), "jade"],
    ["nature", (m) => leaf(m), "jade"],
    ["leaf", (m) => leaf(m), "jade"],
    ["bloom", (m) => leaf(m), "jade"],
    ["living", (m) => leaf(m)],
    ["wrath", (m) => bolt(m)],
    ["seed", (m) => seedPod(m)],
    ["divine shield", (m) => dome(m)],
    ["deterrence", (m) => dome(m)],
    ["anti-magic", (m) => dome(m)],
    ["antimagic", (m) => dome(m)],
    ["grounding", (m) => dome(m)],
    ["resistance", (m) => dome(m)],
    ["absorb", (m) => dome(m)],
    ["shield", (m) => shield(m)],
    ["block", (m) => shield(m)],
    ["barrier", (m) => shield(m)],
    ["ward", (m) => shield(m)],
    ["aegis", (m) => shield(m)],
    ["bulwark", (m) => shield(m)],
    ["defen", (m) => shield(m)],
    ["guard", (m) => shield(m)],
    ["protect", (m) => shield(m)],
    ["sanctuar", (m) => shield(m)],
    ["sacrifice", (m) => shield(m)],
    ["wall", (m) => shield(m)],
    ["shell", (m) => shield(m)],
    ["carapace", (m) => shield(m)],
    ["fortif", (m) => shield(m)],
    ["unbreakable", (m) => shield(m)],
    ["stoneskin", (m) => shield(m)],
    ["armor", (m) => shield(m)],
    ["survival", (m) => shield(m)],
    ["stand", (m) => shield(m)],
    ["vigil", (m) => eye(m)],
    ["whirlwind", (m) => [...blade(m), ...swirl(m)]],
    ["bladestorm", (m) => [...blade(m), ...swirl(m)]],
    ["sinister", (m) => dagger(m)],
    ["dagger", (m) => dagger(m)],
    ["knife", (m) => dagger(m)],
    ["knives", (m) => dagger(m)],
    ["shiv", (m) => dagger(m)],
    ["ambush", (m) => dagger(m)],
    ["gouge", (m) => dagger(m)],
    ["eviscerate", (m) => dagger(m)],
    ["mutilate", (m) => dagger(m)],
    ["backstab", (m) => dagger(m)],
    ["throw", (m) => dagger(m)],
    ["execute", (m) => axe(m)],
    ["axe", (m) => axe(m)],
    ["slam", (m) => hammer(m)],
    ["smash", (m) => hammer(m)],
    ["crush", (m) => hammer(m)],
    ["devastate", (m) => hammer(m)],
    ["concussion", (m) => hammer(m)],
    ["pulverize", (m) => hammer(m)],
    ["sunder", (m) => brokenChain(m)],
    ["expose", (m) => brokenChain(m)],
    ["shatter", (m) => brokenChain(m)],
    ["disarm", (m) => brokenChain(m)],
    ["chains", (m) => link(m)],
    ["sword", (m) => blade(m)],
    ["slash", (m) => blade(m)],
    ["cleave", (m) => blade(m)],
    ["strike", (m) => blade(m)],
    ["mortal", (m) => blade(m)],
    ["overpower", (m) => blade(m)],
    ["heroic", (m) => blade(m)],
    ["sweep", (m) => blade(m)],
    ["blade", (m) => blade(m)],
    ["riposte", (m) => blade(m)],
    ["carve", (m) => blade(m)],
    ["slice", (m) => blade(m)],
    ["dice", (m) => blade(m)],
    ["revenge", (m) => blade(m)],
    ["retaliation", (m) => blade(m)],
    ["spree", (m) => blade(m)],
    ["flurry", (m) => blade(m)],
    ["counterattack", (m) => blade(m)],
    ["aimed", (m) => target(m)],
    ["kill shot", (m) => target(m)],
    ["deadly", (m) => target(m)],
    ["snipe", (m) => target(m)],
    ["trueshot", (m) => target(m)],
    ["misdirection", (m) => target(m)],
    ["focus", (m) => target(m)],
    ["mark", (m) => target(m)],
    ["precision", (m) => target(m)],
    ["shot", (m) => arrow(m)],
    ["shoot", (m) => arrow(m)],
    ["arrow", (m) => arrow(m)],
    ["volley", (m) => arrow(m)],
    ["scatter", (m) => arrow(m)],
    ["multi", (m) => arrow(m)],
    ["chimera", (m) => arrow(m)],
    ["bolt", (m) => bolt(m)],
    ["trap", (m) => trap(m)],
    ["snare", (m) => trap(m)],
    ["stealth", (m) => hood(m), "dark"],
    ["vanish", (m) => hood(m), "dark"],
    ["prowl", (m) => hood(m), "dark"],
    ["shadowmeld", (m) => hood(m), "dark"],
    ["sneak", (m) => hood(m), "dark"],
    ["cloak", (m) => hood(m), "dark"],
    ["sap", (m) => hood(m), "dark"],
    ["feign", (m) => hood(m), "dark"],
    ["camouflage", (m) => hood(m), "dark"],
    ["invisibility", (m) => hood(m)],
    ["fade", (m) => hood(m)],
    ["evasion", () => boot()],
    ["blind", (m) => eye(m)],
    ["distract", (m) => eye(m)],
    ["blink", (m) => swirl(m)],
    ["teleport", (m) => swirl(m)],
    ["charge", (m) => speedLines(m)],
    ["dash", (m) => speedLines(m)],
    ["sprint", (m) => speedLines(m)],
    ["rush", (m) => speedLines(m)],
    ["intercept", (m) => speedLines(m)],
    ["intervene", (m) => speedLines(m)],
    ["leap", (m) => speedLines(m)],
    ["disengage", (m) => speedLines(m)],
    ["pursuit", (m) => speedLines(m)],
    ["swiftness", (m) => speedLines(m)],
    ["rapid", (m) => speedLines(m)],
    ["fervor", (m) => speedLines(m)],
    ["cheetah", (m) => speedLines(m)],
    ["step", () => boot()],
    ["escape", () => boot()],
    ["link", (m) => link(m)],
    ["chain", (m) => link(m)],
    ["nova", (m) => sunburst(m)],
    ["burst", (m) => sunburst(m)],
    ["explosion", (m) => sunburst(m)],
    ["shockwave", (m) => sunburst(m)],
    ["clap", (m) => sunburst(m)],
    ["explosive", (m) => bomb(m)],
    ["bomb", (m) => bomb(m)],
    ["detonate", (m) => bomb(m)],
    ["track", (m) => eye(m)],
    ["eye", (m) => eye(m)],
    ["lore", (m) => eye(m)],
    ["sense", (m) => eye(m)],
    ["detect", (m) => eye(m)],
    ["flare", (m) => eye(m)],
    ["sight", (m) => eye(m)],
    ["watch", (m) => eye(m)],
    ["horn", (m) => horn(m)],
    ["hymn", (m) => horn(m)],
    ["song", (m) => horn(m)],
    ["stomp", (m) => hoof(m)],
    ["earth", (m) => rock(m), "jade"],
    ["stone", (m) => rock(m), "jade"],
    ["rock", (m) => rock(m), "jade"],
    ["quake", (m) => rock(m)],
    ["tremor", (m) => rock(m)],
    ["water", (m) => wave(m), "ice"],
    ["tidal", (m) => wave(m), "ice"],
    ["riptide", (m) => wave(m), "ice"],
    ["rain", (m) => wave(m), "ice"],
    ["spring", (m) => wave(m), "ice"],
    ["wave", (m) => wave(m), "ice"],
    ["tranquil", (m) => wave(m), "ice"],
    ["feather", (m) => feather(m)],
    ["wing", (m) => feather(m)],
    ["flight", (m) => feather(m)],
    ["soar", (m) => feather(m)],
    ["swoop", (m) => feather(m)],
    ["hawk", (m) => feather(m)],
    ["levitate", (m) => feather(m)],
    ["hoof", (m) => hoof(m)],
    ["stag", (m) => hoof(m)],
    ["travel", (m) => hoof(m)],
    ["hawk", (m) => feather(m)],
    ["pack", (m) => paw(m)],
    ["monkey", (m) => paw(m)],
    ["fox", (m) => paw(m)],
    ["aspect", (m) => paw(m)],
    ["beast", (m) => paw(m)],
    ["pet", (m) => paw(m)],
    ["tame", (m) => paw(m)],
    ["companion", (m) => paw(m)],
    ["raise", (m) => handRise(m)],
    ["summon", (m) => paw(m)],
    ["call", (m) => paw(m)],
    ["invoke", (m) => paw(m)],
    ["ritual", (m) => rune(m)],
    ["rune", (m) => rune(m)],
    ["runic", (m) => rune(m)],
    ["sigil", (m) => rune(m)],
    ["glyph", (m) => rune(m)],
    ["hex", (m) => rune(m)],
    ["shackle", (m) => brokenChain(m)],
    ["circle", (m) => rune(m)],
    ["mirror", (m) => crystal(m)],
    ["image", (m) => crystal(m)],
    ["echo", (m) => crystal(m)],
    ["reflect", (m) => crystal(m)],
    ["simulacrum", (m) => eye(m)],
    ["weapon", (m) => blade(m)],
    ["imbue", (m) => blade(m)],
    ["brand", (m) => blade(m)],
    ["kick", (m) => fist(m)],
    ["pummel", (m) => fist(m)],
    ["fist", (m) => fist(m)],
    ["punch", (m) => fist(m)],
    ["jab", (m) => fist(m)],
    ["crown", (m) => crown(m)],
    ["banner", (m) => crown(m)],
    ["seal", (m) => crown(m)],
    ["cloud", (m) => cloud(m)],
    ["mist", (m) => cloud(m)],
    ["fog", (m) => cloud(m)],
    ["smoke", (m) => cloud(m)],
    ["veil", (m) => cloud(m)],
    ["heart", (m) => heart(m)],
    ["courage", (m) => heart(m)],
    ["valor", (m) => heart(m)],
    ["aura", (m) => halo(m)],
    ["chakra", (m) => halo(m)],
    ["repent", (m) => halo(m)],
    ["presence", (m) => halo(m)],
    ["naaru", (m) => halo(m)],
    ["gift", (m) => halo(m)],
    ["readiness", (m) => star(m)],
    ["astral", (m) => star(m)]
  ];
  function keywordMotif(id) {
    const key = `${id} ${SKILL_DEFINITIONS[id]?.name ?? ""}`.toLowerCase();
    for (const [word, make, material2] of KEYWORD_MOTIFS) if (key.includes(word)) return { make, material: material2 };
    return null;
  }
  function kindMotif(kind, m) {
    switch (kind) {
      case "projectile":
      case "channel":
        return bolt(m);
      case "ground":
        return [...place(star(m), 32, 30, 0, 0.9), ...place(dome(m), 32, 30, 0, 0.9)];
      case "chain":
        return zap(m);
      case "radial":
      case "cone":
        return [...place(swirl(m), 32, 32, 0, 0.9), ...place(halo(m), 32, 32, 0, 0.6)];
      case "sweep":
      case "strike":
      case "backstab":
      case "comboStrike":
      case "runeStrike":
        return blade(m);
      case "dash":
      case "step":
        return boot();
      case "buff":
      case "stance":
      case "form":
      case "aura":
        return [...place(halo(m), 32, 32, 0, 0.95), ...place(star(m), 32, 32, 0, 0.7)];
      case "guard":
      case "ward":
        return shield(m);
      case "heal":
      case "hot":
      case "cleanse":
        return cross(m);
      case "dot":
        return drop(m);
      case "cc":
      case "interrupt":
      case "taunt":
      case "pull":
        return [...place(moon(m), 32, 32, 0, 0.9), ...place(halo(m), 32, 32, 0, 0.6)];
      case "summon":
        return paw(m);
      case "stealth":
        return [...place(moon("dark"), 32, 32, 0, 0.9), ...place(swirl(m), 32, 32, 0, 0.5)];
      default:
        return crystal(m);
    }
  }
  function genericSkillIconParts(kind, id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = h * 31 + id.charCodeAt(i) | 0;
    const mats = ["gold", "jade", "violet", "ice", "fire", "rose", "steel"];
    const hit = keywordMotif(id);
    const m = SCHOOL_MATERIALS[recipeSchool(id) ?? ""] ?? hit?.material ?? nearestMaterial(SKILL_DEFINITIONS[id]?.color) ?? mats[Math.abs(h) % mats.length];
    const rot = h % 360, sc = 0.72 + (Math.abs(h) >> 8) % 5 * 0.07;
    const motif = hit ? hit.make(m) : kindMotif(kind, m);
    const ax = 32 + Math.cos(h) * 20, ay = 32 + Math.sin(h) * 20;
    return [...place(motif, 32, 32, rot, sc), facet(`M${ax - 3} ${ay}L${ax} ${ay - 4}L${ax + 3} ${ay}L${ax} ${ay + 4}Z`, m)];
  }
  var SKILL_ICON_RECIPES = Object.freeze(
    Object.fromEntries(Object.keys(SKILL_DEFINITIONS).map((id) => [
      id,
      authored[id] ?? genericSkillIconParts(SKILL_EXECUTION[id].kind, id)
    ]))
  );

  // src/skill-icon.ts
  var identity = [1, 0, 0, 1, 0, 0];
  var scenes = /* @__PURE__ */ new Map();
  var themes = {
    fireball: "fire",
    meteor: "fire",
    cataclysm: "fire",
    iceNova: "ice",
    frostLance: "ice",
    absoluteZero: "ice",
    bulwark: "ice",
    runicWard: "jade",
    siphon: "rose",
    backstab: "rose",
    nightReaping: "violet",
    lunge: "jade",
    // WoW kits: theme tints steel/dark parts, so each school keeps its color.
    crusaderStrike: "gold",
    judgement: "gold",
    sealOfCommand: "gold",
    consecration: "gold",
    hammerOfJustice: "gold",
    holyLight: "gold",
    flashOfLight: "gold",
    divineShield: "gold",
    divineProtection: "gold",
    layOnHands: "gold",
    avengingWrath: "gold",
    hammerOfWrath: "gold",
    exorcism: "gold",
    holyShock: "gold",
    repentance: "gold",
    blessingOfKings: "gold",
    divineStorm: "gold",
    holyShield: "gold",
    smite: "gold",
    powerWordShield: "gold",
    renew: "jade",
    flashHeal: "gold",
    greaterHeal: "gold",
    dispelMagic: "gold",
    holyNova: "gold",
    prayerOfHealing: "gold",
    innerFire: "gold",
    icyTouch: "ice",
    obliterate: "ice",
    chainsOfIce: "ice",
    mindFreeze: "ice",
    frostPresence: "ice",
    iceboundFortitude: "ice",
    bloodStrike: "rose",
    bloodBoil: "rose",
    bloodPresence: "rose",
    strangulate: "rose",
    plagueStrike: "jade",
    scourgeStrike: "jade",
    deathCoil: "jade",
    deathAndDecay: "jade",
    unholyPresence: "jade",
    antiMagicShell: "jade",
    raiseDead: "jade",
    armyOfDead: "jade",
    deathStrike: "dark",
    deathGrip: "dark",
    frostbolt: "ice",
    frostNova: "ice",
    iceLance: "ice",
    coneOfCold: "ice",
    blizzard: "ice",
    iceBlock: "ice",
    iceBarrier: "ice",
    deepFreeze: "ice",
    pyroblast: "fire",
    fireBlast: "fire",
    scorch: "fire",
    combustion: "fire",
    dragonsBreath: "fire",
    immolate: "fire",
    searingPain: "fire",
    conflagrate: "fire",
    rainOfFire: "fire",
    drainLife: "jade",
    chaosBolt: "jade",
    felArmor: "jade",
    summonImp: "jade",
    summonFelguard: "jade",
    metamorphosis: "jade",
    wrath: "jade",
    insectSwarm: "jade",
    entanglingRoots: "jade",
    healingTouch: "jade",
    regrowth: "jade",
    rejuvenation: "jade",
    swiftmend: "jade",
    barkskin: "jade",
    innervate: "jade",
    maul: "jade",
    swipe: "jade",
    bash: "jade",
    feralCharge: "jade",
    mangle: "jade",
    earthShock: "jade",
    flameShock: "fire",
    lavaBurst: "fire",
    frostShock: "ice",
    stormstrike: "violet",
    healingWave: "jade",
    lesserHealingWave: "jade",
    chainHeal: "jade",
    healingStreamTotem: "jade",
    earthbindTotem: "jade",
    ghostWolf: "ice",
    bloodlust: "rose",
    feralSpirit: "jade",
    thunderstorm: "ice",
    arcaneShot: "violet",
    freezingTrap: "ice",
    explosiveShot: "fire",
    bestialWrath: "rose",
    killShot: "rose",
    stealth: "violet",
    vanish: "violet",
    cloakOfShadows: "violet",
    adrenalineRush: "gold",
    prowl: "violet",
    shadowmeld: "violet",
    willForsaken: "dark",
    arcaneTorrent: "violet",
    warStomp: "jade",
    berserking: "fire",
    bloodFury: "rose"
  };
  function glassTheme(id) {
    return themes[id] ?? { Might: "gold", Cunning: "jade", Arcana: "violet" }[SKILL_DEFINITIONS[id].domain];
  }
  var panes = [
    [[0, 0], [27, 0], [30, 24], [0, 39]],
    [[27, 0], [64, 0], [46, 22], [30, 24]],
    [[64, 0], [64, 44], [46, 22]],
    [[64, 44], [64, 64], [29, 64], [35, 43], [46, 22]],
    [[29, 64], [0, 64], [0, 39], [30, 24], [35, 43]],
    [[30, 24], [46, 22], [35, 43]]
  ];
  var broadPanes = [
    [[0, 0], [64, 0], [36, 31], [0, 48]],
    [[64, 0], [64, 64], [36, 31]],
    [[64, 64], [0, 64], [0, 48], [36, 31]]
  ];
  function panePaths(local, detail) {
    const offset = local ? 32 : 0;
    return (detail ? panes : broadPanes).map((points) => points.map(([x, y], i) => `${i ? "L" : "M"}${x - offset} ${y - offset}`).join("") + "Z");
  }
  function skillIconDrawing(id, detail) {
    const key = `${id}:${detail}`;
    const cached = scenes.get(key);
    if (cached) return cached;
    const result = glassIconDrawing(SKILL_ICON_RECIPES[id], glassTheme(id), detail);
    scenes.set(key, result);
    return result;
  }
  function glassIconDrawing(parts, theme, detail) {
    const drawing = [{ path: "M32 1A31 31 0 1 1 32 63 31 31 0 1 1 32 1Z", transform: identity, opacity: 0.65, localGradient: false, halo: theme }];
    for (const part of parts) if (part.kind === "body") {
      const material2 = ICON_MATERIALS[part.material === "steel" || part.material === "dark" ? theme : part.material];
      drawing.push({ path: part.path, transform: part.transform ?? identity, opacity: 0.13 * (part.opacity ?? 1), localGradient: !!part.transform, stroke: material2.face, width: 5 });
    }
    for (const part of parts) {
      if (part.detail && !detail) continue;
      const transform = part.transform ?? identity, opacity = part.opacity ?? 1;
      const base = { path: part.path, transform, opacity, localGradient: !!part.transform };
      const tint = part.material === "steel" || part.material === "dark" ? theme : part.material;
      const material2 = ICON_MATERIALS[tint];
      if (part.kind === "cut") drawing.push({ ...base, stroke: material2.light, width: 0.65, opacity: opacity * 0.6 });
      else if (part.kind === "facet") drawing.push({ ...base, fill: part.material === "dark" ? material2.shade : material2.light, opacity: opacity * (part.material === "dark" ? 0.65 : 0.48) });
      else {
        drawing.push({ ...base, fill: "#0a1726", stroke: "#101b29", width: 2.4 });
        drawing.push({ ...base, surface: tint });
        for (const [i, path2] of panePaths(base.localGradient, detail).entries()) {
          drawing.push({
            ...base,
            path: path2,
            clip: part.path,
            fill: i % 3 === 0 ? material2.light : i % 3 === 1 ? material2.shade : material2.face,
            stroke: "#071a2c",
            width: detail ? 0.85 : 1.05,
            opacity: opacity * (i % 3 === 0 ? 0.38 : 0.52)
          });
        }
        drawing.push({ ...base, stroke: "#142332", width: 1.35 });
        drawing.push({ ...base, stroke: material2.edge, width: 0.45, opacity: opacity * 0.85 });
      }
    }
    const result = Object.freeze(drawing.map((op) => Object.freeze({ ...op, transform: Object.freeze(op.transform) })));
    return result;
  }
  function skillIconLight(local) {
    return local ? [-3, -5, 34] : [28, 27, 43];
  }
  var SKILL_ICON_STOPS = [0, 0.2, 0.58, 1];
  function skillIconSurface(material2) {
    const p2 = ICON_MATERIALS[material2];
    return [p2.light, p2.face, p2.face, p2.shade];
  }
  var SKILL_ICON_HALO_STOPS = [0, 0.45, 1];
  function skillIconHalo(material2) {
    const p2 = ICON_MATERIALS[material2];
    return [p2.face + "55", p2.face + "24", p2.face + "00"];
  }

  // src/skill-icon-canvas.ts
  var paths = /* @__PURE__ */ new Map();
  var stamps = /* @__PURE__ */ new Map();
  function paintSkillIcon(c2, id, x, y, size, detail = size >= 40) {
    paintGlassIcon(c2, skillIconDrawing(id, detail), x, y, size);
  }
  function paintGlassIcon(c2, drawing, x, y, size) {
    if (![x, y, size].every(Number.isFinite) || size <= 0) return;
    c2.save();
    c2.translate(x - size / 2, y - size / 2);
    c2.scale(size / 64, size / 64);
    c2.lineCap = "round";
    c2.lineJoin = "round";
    for (const op of drawing) {
      let path2 = paths.get(op.path);
      if (!path2) {
        path2 = new Path2D(op.path);
        paths.set(op.path, path2);
      }
      c2.save();
      c2.transform(...op.transform);
      c2.globalAlpha *= op.opacity;
      if (op.clip) {
        let clip = paths.get(op.clip);
        if (!clip) {
          clip = new Path2D(op.clip);
          paths.set(op.clip, clip);
        }
        c2.clip(clip);
      }
      const material2 = op.surface ?? op.halo;
      if (material2) {
        const [cx, cy, radius] = op.halo ? [32, 32, 31] : skillIconLight(op.localGradient);
        const gradient = c2.createRadialGradient(cx, cy, 0, cx, cy, radius);
        const colors = op.halo ? skillIconHalo(material2) : skillIconSurface(material2);
        const stops = op.halo ? SKILL_ICON_HALO_STOPS : SKILL_ICON_STOPS;
        colors.forEach((color, i) => gradient.addColorStop(stops[i], color));
        c2.fillStyle = gradient;
        c2.fill(path2);
      } else if (op.fill) {
        c2.fillStyle = op.fill;
        c2.fill(path2);
      }
      if (op.stroke) {
        c2.strokeStyle = op.stroke;
        c2.lineWidth = op.width;
        c2.stroke(path2);
      }
      c2.restore();
    }
    c2.restore();
  }
  function drawSkillIcon(c2, id, x, y, size) {
    if (![x, y, size].every(Number.isFinite) || size <= 0) return;
    if (size > 72) {
      paintSkillIcon(c2, id, x, y, size);
      return;
    }
    const detail = size >= 40, key = `${id}:${detail}`;
    let stamp = stamps.get(key);
    if (!stamp) {
      stamp = document.createElement("canvas");
      stamp.width = stamp.height = 144;
      const context = stamp.getContext("2d");
      if (!context) {
        paintSkillIcon(c2, id, x, y, size);
        return;
      }
      paintSkillIcon(context, id, 72, 72, 144, detail);
      stamps.set(key, stamp);
    }
    c2.drawImage(stamp, x - size / 2, y - size / 2, size, size);
  }

  // src/focus-content.ts
  var focus = (id, name, kind, motif, glow, implicit) => Object.freeze({
    id,
    name,
    implicit: Object.freeze(implicit),
    visual: Object.freeze({ kind, motif, glow, base: "#566775", edge: "#dad3b1", trim: "#c8a56b", shadow: "#252b3a" })
  });
  var FOCUS_PROFILES = Object.freeze([
    focus("ember-codex", "Ember Codex", "grimoire", "ember", "#f5ad71", { maxMana: 14, manaRegen: 2 }),
    focus("rime-folio", "Rime Folio", "grimoire", "rime", "#a5e0ec", { maxMana: 18, manaCostPercent: 3 }),
    focus("astral-grimoire", "Astral Grimoire", "grimoire", "astral", "#c9b8f2", { maxMana: 12, cooldownPercent: 3 }),
    focus("cinder-orb", "Cinder Reliquary", "orb", "ember", "#ffad73", { spellDamagePercent: 7, critDamage: 5 }),
    focus("rime-orb", "Rimeglass Orb", "orb", "rime", "#a3e7ed", { spellDamagePercent: 5, castSpeedPercent: 3 }),
    focus("astral-orb", "Astral Sphere", "orb", "astral", "#c4b5ff", { spellDamagePercent: 6, critChance: 1.5 })
  ]);

  // src/radiant-content.ts
  var astralGlow = FOCUS_PROFILES.find((profile) => profile.id === "astral-grimoire").visual.glow;
  var RADIANT_COLORS = Object.freeze({ core: "#fff6d9", light: "#e8d69d", gold: "#b6a16c", shadow: "#6c735e" });
  var isRadiantWand = (v) => v.kind === "wand" && v.element === "arcane";
  var weaponGlowColor = (v) => isRadiantWand(v) ? RADIANT_COLORS.light : v.glow;

  // src/art-primitives.ts
  var TAU2 = Math.PI * 2;
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
  function line(ctx, points, color, width) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index][0], points[index][1]);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "bevel";
    ctx.lineCap = "butt";
    ctx.stroke();
  }
  function mixColor(from, to, amount) {
    const packed = (value) => {
      if (value[0] === "#") return Number.parseInt(value.slice(1), 16);
      const channels = value.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/);
      return channels ? Number(channels[1]) << 16 | Number(channels[2]) << 8 | Number(channels[3]) : 0;
    };
    const a = packed(from);
    const b = packed(to);
    const red = Math.round((a >>> 16 & 255) * (1 - amount) + (b >>> 16 & 255) * amount);
    const green = Math.round((a >>> 8 & 255) * (1 - amount) + (b >>> 8 & 255) * amount);
    const blue = Math.round((a & 255) * (1 - amount) + (b & 255) * amount);
    return `rgb(${red},${green},${blue})`;
  }

  // src/gear-material-content.ts
  var GEAR_MATERIALS = Object.freeze({
    iron: Object.freeze({ roughness: 0.46, metalness: 0.88, light: "#d4dce0", shade: "#202b34" }),
    silver: Object.freeze({ roughness: 0.18, metalness: 0.98, light: "#f4fcff", shade: "#30415a" }),
    gold: Object.freeze({ roughness: 0.23, metalness: 0.98, light: "#ffe6a0", shade: "#5b381d" }),
    glass: Object.freeze({ roughness: 0.08, metalness: 0, light: "#e2faff", shade: "#223f4c" }),
    steel: Object.freeze({ roughness: 0.27, metalness: 0.92, light: "#e5eef0", shade: "#101d2b" }),
    brass: Object.freeze({ roughness: 0.34, metalness: 0.85, light: "#fff1c0", shade: "#33231c" }),
    leather: Object.freeze({ roughness: 0.72, metalness: 0, light: "#dabd94", shade: "#18191d" }),
    wood: Object.freeze({ roughness: 0.8, metalness: 0, light: "#e4c295", shade: "#192023" }),
    velvet: Object.freeze({ roughness: 0.88, metalness: 0, light: "#e4bdcf", shade: "#291627" }),
    starweave: Object.freeze({ roughness: 0.36, metalness: 0, light: "#e0edff", shade: "#202f50" }),
    silk: Object.freeze({ roughness: 0.48, metalness: 0, light: "#eee5ff", shade: "#302f46" }),
    cloth: Object.freeze({ roughness: 0.96, metalness: 0, light: "#d5d3bd", shade: "#101923" }),
    gem: Object.freeze({ roughness: 0.13, metalness: 0, light: "#f1ffff", shade: "#152239" })
  });

  // src/gear-material.ts
  var DEFAULT_GEAR_LIGHT = Object.freeze({ direction: [-0.45, -0.6, 0.66], color: "#e9f1ff", power: 1 });
  function gearSurface(material2, seed = 0, normal = [-0.24, -0.32, 0.916]) {
    const length = Math.hypot(...normal) || 1;
    return { material: material2, seed, normal: normal.map((n) => n / length) };
  }
  function materializeGear(shapes, material2, seed, accents = /* @__PURE__ */ new Map()) {
    return shapes.map((shape, i) => !shape.surface ? {
      ...shape,
      surface: gearSurface(accents.get(shape.fill ?? shape.stroke ?? "") ?? material2, seed + i * 37)
    } : shape);
  }
  function gearLightResponse(surface, light = DEFAULT_GEAR_LIGHT, facing = 0) {
    const m = GEAR_MATERIALS[surface.material], [nx, ny, nz] = surface.normal;
    const [x, y, z] = light.direction, length = Math.hypot(x, y, z) || 1;
    const lx = (x * Math.cos(facing) + y * Math.sin(facing)) / length, ly = (-x * Math.sin(facing) + y * Math.cos(facing)) / length, lz = z / length;
    const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz), hlen = Math.hypot(lx, ly, lz + 1);
    const halfDot = Math.max(0, (nx * lx + ny * ly + nz * (lz + 1)) / hlen);
    const specular = Math.pow(halfDot, 6 + (1 - m.roughness) * 90) * (1 - m.roughness) * (m.metalness * 0.56 + 0.12) * Math.min(1.5, Math.max(0, light.power));
    return { diffuse, specular, metalness: m.metalness };
  }
  function gearMaterialStops(base, surface, facing = 0, light = DEFAULT_GEAR_LIGHT) {
    base = surface.albedo ?? base;
    const m = GEAR_MATERIALS[surface.material], response = gearLightResponse(surface, light, facing);
    const power = Math.min(1.5, Math.max(0, light.power));
    const highlight = mixColor(m.light, light.color, 0.45);
    const shade2 = (1 - response.diffuse) * 0.38;
    let pigment = mixColor(base, m.shade, shade2);
    pigment = mixColor(pigment, highlight, Math.min(0.62, response.diffuse * 0.14 * power + response.specular * 1.2));
    if (surface.facet) return [[0, pigment], [1, pigment]];
    const angle = Math.atan2(light.direction[1], light.direction[0]) - facing;
    const reflection = 0.42 + Math.cos(angle + surface.normal[0] * 1.7) * 0.19;
    const sheen = (1 - m.roughness) * (0.08 + response.specular * 0.8) * power;
    return [
      [0, mixColor(pigment, highlight, 0.04)],
      [reflection, mixColor(pigment, highlight, Math.min(0.4, sheen))],
      [Math.min(0.82, reflection + 0.22), pigment],
      [1, mixColor(pigment, m.shade, 0.1 + m.metalness * 0.04)]
    ];
  }
  var canvasLights = /* @__PURE__ */ new WeakMap();
  var gearCanvasLight = (ctx) => canvasLights.get(ctx) ?? DEFAULT_GEAR_LIGHT;
  function gearMaterialMarks(surface, bounds) {
    const [x, y, w, h] = bounds;
    if (w < 1 || h < 1 || surface.facet || surface.material === "gem" || surface.material === "cloth" || surface.material === "silk" || surface.material === "velvet" || surface.material === "starweave") return [];
    const out = [];
    for (let i = 0; i < 3; i++) {
      const u = ((surface.seed * 13 + i * 47) % 97 + 97) % 97 / 97;
      const v = ((surface.seed * 7 + i * 31) % 89 + 89) % 89 / 89;
      const px = x + w * (0.13 + u * 0.74), py = y + h * (0.12 + v * 0.76);
      const wood = surface.material === "wood", leather = surface.material === "leather";
      out.push([[px, py], [px + w * (wood ? 0.22 : leather ? 0.035 : 0.09), py + h * (wood ? 0.015 : leather ? 0.025 : -0.04)]]);
    }
    return out;
  }

  // src/weapon-shapes.ts
  var clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  var poly = (points, fill) => ({ points, fill });
  var stroke = (points, color, width = 0.7) => ({ points, stroke: color, width });
  var gem = (x, y, rx, ry) => [[x - rx, y], [x, y - ry], [x + rx, y], [x, y + ry]];
  var weaponArtLength = (visual) => clamp(visual.length, 8, 60) * (visual.kind === "staff" ? 0.73 : 1);
  var bowStringOffset = (draw) => -5 - clamp(draw, 0, 1) * 11;
  var weaponCache = /* @__PURE__ */ new WeakMap();
  function weaponShapes(visual, draw = 0) {
    if (draw === 0) {
      const cached = weaponCache.get(visual);
      if (cached) return cached;
    }
    const shapes = buildWeaponShapes(visual, draw);
    const accents = /* @__PURE__ */ new Map([[visual.guard, "brass"], [visual.grip, ["bow", "staff", "wand", "axe", "mace"].includes(visual.kind) ? "wood" : "leather"]]);
    if (visual.glow) accents.set(visual.glow, "gem");
    accents.set(visual.metal, "steel");
    accents.set(mixColor(visual.metal, "#121c28", 0.72), "steel");
    accents.set(mixColor(visual.metal, "#bdc7cc", 0.25), "steel");
    const result = materializeGear(shapes, visual.kind === "wand" || visual.kind === "staff" || visual.kind === "bow" ? "wood" : "steel", Math.round(visual.length * 13 + visual.width * 71), accents).map((shape) => shape.surface && visual.material && (shape.surface.material === "steel" || ["staff", "wand", "bow"].includes(visual.kind) && shape.surface.material === "wood") ? { ...shape, surface: { ...shape.surface, material: visual.material } } : shape);
    if (draw === 0) weaponCache.set(visual, result);
    return result;
  }
  function buildWeaponShapes(visual, draw) {
    if (visual.kind === "unarmed") return [];
    const length = weaponArtLength(visual), half = Math.max(0.7, visual.width * 0.5);
    const grip = clamp(visual.gripLength ?? 12, 6, visual.kind === "staff" ? 13 : 22), shapes = [];
    if (visual.kind === "bow") {
      const span = length * 0.64, tipX = -3 - clamp(draw, 0, 1) * 2, curve = [], edge = [];
      for (let i = 0; i <= 20; i++) {
        const t = -1 + i / 10, y = span * t;
        const x = tipX * t * t + Math.sin(Math.abs(t) * Math.PI) * 3 + Math.sin(Math.abs(t) * Math.PI * 2) * (visual.width >= 15 ? 2.2 : 0.6);
        curve.push([x, y]);
        edge.push([x + 1.2, y]);
      }
      const limbWidth = clamp(visual.width * 0.19, 2, 3.4);
      shapes.push(stroke(curve, "#192830", limbWidth + 1.1), stroke(curve, visual.grip, limbWidth), stroke(edge, visual.edge, 0.7));
      shapes.push(stroke([[tipX, -span], [bowStringOffset(draw), 0], [tipX, span]], "#d4d8c4", 0.45));
      shapes.push(poly([[-1.2, -3.2], [2.8, -3], [3.1, 0], [2.8, 3], [-1.2, 3.2]], visual.grip));
      for (let i = -2.5; i <= 2.5; i += 1.25) shapes.push(stroke([[-0.6, i], [2.6, i + 0.3]], mixColor(visual.grip, visual.guard, 0.5), 0.4));
      shapes.push(poly(gem(tipX + 0.5, -span + 1, 0.7, 1.2), visual.guard), poly(gem(tipX + 0.5, span - 1, 0.7, 1.2), visual.guard));
      shapes.push(stroke(curve.map(([x, y]) => [x - 0.8, y]), mixColor(visual.grip, "#080f16", 0.5), 0.65));
      if (draw > 0.05) {
        const nock = bowStringOffset(draw), tip = nock + 30;
        shapes.push(stroke([[nock, 0], [tip, 0]], "#bdab7d", 1));
        shapes.push(poly([[tip - 1, -2], [tip + 6, 0], [tip - 1, 2]], visual.edge));
        shapes.push(poly([[nock, 0], [nock - 3, -3], [nock + 2, -2], [nock + 5, 0]], "#a7c6b7"));
        shapes.push(poly([[nock, 0], [nock - 3, 3], [nock + 2, 2], [nock + 5, 0]], "#627f7d"));
      }
      return shapes;
    }
    if (visual.kind !== "wand") {
      shapes.push(poly([[-grip, -1.35], [length * 0.8, -1.35], [length * 0.8, 1.35], [-grip, 1.35]], visual.grip));
      const wrappedEnd = visual.kind === "sword" || visual.kind === "dagger" ? 1 : 0;
      for (let wrap = -grip + 1; wrap < wrappedEnd; wrap += 2) shapes.push(stroke([[wrap, -1.2], [wrap + 0.8, 1.2]], visual.guard, 0.45));
    }
    if (visual.kind === "sword" || visual.kind === "dagger") {
      const broad = visual.kind === "dagger" ? half * 1.4 : half * 0.88;
      shapes.push(poly([[3, -broad], [length * 0.77, -broad * 0.66], [length, 0], [length * 0.77, broad * 0.68], [3, broad]], "#233b43"));
      shapes.push(poly([[3.5, -broad * 0.73], [length * 0.77, -broad * 0.43], [length, 0], [length * 0.77, broad * 0.48], [3.5, broad * 0.8]], visual.metal));
      shapes.push(poly([[3, -broad], [length * 0.77, -broad * 0.66], [length, 0], [length * 0.76, -broad * 0.34], [4, -0.15]], visual.edge));
      shapes.push({ ...poly([[5, 0.05], [length * 0.77, -0.1], [length * 0.69, broad * 0.33], [5, broad * 0.48]], mixColor(visual.metal, "#152533", 0.55)), surface: gearSurface("steel", 3, [0.65, 0.4, 0.65]) });
      shapes.push({ ...poly([[5, -0.13], [length * 0.73, -0.2], [length * 0.84, 0], [length * 0.73, 0.12], [5, 0.1]], visual.metal), surface: gearSurface("steel", 7, [-0.4, -0.7, 0.6]) });
      shapes.push(stroke([[6, -0.1], [length * 0.7, -0.1]], visual.edge, 0.35));
      const guard = Math.max(3.6, broad * 2.1);
      const dagger2 = visual.kind === "dagger";
      shapes.push(poly(dagger2 ? [[0.1, -guard + 1], [1.5, -guard], [3.5, -guard + 1], [3.5, guard - 1], [1.5, guard], [0.1, guard - 1]] : [[-0.5, -guard], [1.4, -guard - 0.8], [3.1, -guard + 0.4], [3.3, -1.6], [4.7, 0], [3.3, 1.6], [3.1, guard - 0.4], [1.4, guard + 0.8], [-0.5, guard], [1, guard - 1.4], [1, -guard + 1.4]], visual.guard));
      shapes.push(stroke([[0.1, -guard + 0.2], [1.5, -guard + 0.1], [2.1, -2.2], [3.8, 0], [2.1, 2.2]], visual.edge, 0.55));
      shapes.push(poly(gem(1.8, 0, 1.6, 1.3), "#344e56"), poly(gem(1.5, -0.2, 0.65, 0.6), visual.edge));
      if (!dagger2) shapes.push(stroke([[5.5, -broad * 0.55], [8, -0.25], [5.5, broad * 0.55]], visual.guard, 0.45));
    } else if (visual.kind === "axe") {
      const head = length * 0.68, blade2 = 5.8 + half * 0.85;
      shapes.push(poly([[head - 3, -3], [head - 7, -blade2], [length - 1, -blade2 + 1], [length + 2, -blade2 * 0.25], [length - 2, -1], [head + 2, 2]], visual.metal));
      shapes.push(poly([[head - 7, -blade2], [length - 1, -blade2 + 1], [length + 2, -blade2 * 0.25], [length - 2, -1], [length - 1, -blade2 + 3], [head - 5, -blade2 + 2]], visual.edge));
      shapes.push(stroke([[head - 2, -3], [length - 4, -blade2 + 4]], visual.guard, 0.8));
      shapes.push(poly([[head - 3, -4], [head - 4, -blade2 + 3], [length - 5, -blade2 + 4], [length - 3, -4], [head + 1, -2]], "#39515a"));
      shapes.push(stroke([[head - 1, -5], [head - 2, -blade2 + 5], [length - 6, -blade2 + 5]], visual.metal, 1.1));
      shapes.push({ ...poly([[head - 2, -2], [head + 2, -2], [head + 2, 2], [head - 2, 2]], visual.metal), surface: gearSurface("steel", 8, [-0.5, -0.2, 0.84]) });
      shapes.push({ ...poly([[head - 6, -blade2 + 0.8], [head - 4, -blade2 + 2.5], [length - 3, -blade2 + 3], [length + 0.5, -blade2 * 0.25], [length - 2, -1], [length - 1, -blade2 + 1.8]], mixColor(visual.metal, visual.edge, 0.48)), surface: { ...gearSurface("steel", 9, [-0.3, -0.75, 0.58]), facet: true } });
      shapes.push({ ...stroke([[head - 2, -4], [head - 1, -5], [head, -4]], visual.guard, 0.22), fine: true });
      if (length > 31) {
        shapes.push(poly([[head - 3, 3], [head - 6, blade2 * 0.7], [length - 1, blade2 * 0.75], [length + 1, blade2 * 0.2], [length - 2, 1]], visual.metal));
        shapes.push(stroke([[head - 6, blade2 * 0.7], [length - 1, blade2 * 0.75], [length + 1, blade2 * 0.2]], visual.edge, 1));
      } else shapes.push(poly([[head, 0], [head - 1, 5], [length - 2, 2], [length - 3, 0]], visual.guard));
      shapes.push(poly(gem(head, 0, 2.5, 2), visual.guard));
    } else if (visual.kind === "mace") {
      const head = length - 7, radius = length > 30 ? 5.8 : 3.9;
      shapes.push(poly([[head - 2, -1.8], [head + 0.7, -2], [head + 0.7, 2], [head - 2, 1.8]], visual.guard));
      shapes.push(poly([[head, -radius * 0.6], [length - 1, -radius], [length + 1, 0], [length - 1, radius], [head, radius * 0.6]], mixColor(visual.metal, "#15232b", 0.42)));
      for (const side of [-1, 0, 1]) {
        const y = side * radius * 0.67;
        shapes.push({ ...poly([[head - 0.4, y], [head + 1.3, y - 1], [length - 1.3, y - 1.15], [length + 0.7, y - 0.25], [length - 0.8, y + 1], [head + 1, y + 0.8]], visual.metal), surface: gearSurface("steel", 11 + side, [0, side * 0.55, 0.84]) });
        shapes.push({ ...poly([[head + 1.3, y - 1], [length - 1.3, y - 1.15], [length + 0.7, y - 0.25], [length - 1, y - 0.52], [head + 1.5, y - 0.55]], mixColor(visual.metal, visual.edge, 0.4)), surface: { ...gearSurface("steel", 12, [0, -0.8, 0.6]), facet: true } });
      }
      shapes.push(poly([[head + 1, -0.7], [head + 2, -0.7], [head + 2, 0.7], [head + 1, 0.7]], visual.guard));
    } else if (visual.kind === "wand") {
      const glow = weaponGlowColor(visual) ?? "#b4a5ef", tip = length - 1.6;
      const wood = mixColor(visual.grip, "#283034", 0.2), grain = mixColor(visual.grip, visual.edge, 0.24);
      shapes.push(poly([[-grip, -0.64], [-2, -0.76], [2, -0.58], [tip - 2.6, -0.27], [tip - 1.3, 0], [tip - 2.6, 0.27], [2, 0.58], [-2, 0.76], [-grip, 0.64]], wood));
      shapes.push(stroke([[-grip + 0.4, -0.38], [-1, -0.48], [6, -0.26], [tip - 2.5, -0.12]], grain, 0.22));
      shapes.push(poly([[-grip - 0.35, -0.5], [-grip, -0.67], [-grip + 0.6, -0.62], [-grip + 0.6, 0.62], [-grip, 0.67], [-grip - 0.35, 0.5]], visual.guard));
      shapes.push(poly([[-0.4, -0.75], [0.35, -0.72], [0.35, 0.72], [-0.4, 0.75]], visual.guard));
      for (let x = -grip + 1.1; x < -1; x += 1.1) shapes.push({ ...stroke([[x, -0.52], [x + 0.25, 0.52]], mixColor(wood, "#202329", 0.25), 0.15), fine: true });
      shapes.push(poly([[tip - 3.1, -0.38], [tip - 1.8, -0.62], [tip - 0.8, 0], [tip - 1.8, 0.62], [tip - 3.1, 0.38]], visual.guard));
      const radius = visual.element === "frost" ? 0.82 : visual.element === "arcane" ? 0.72 : 0.62;
      const crystal2 = [[tip - 1.5, 0], [tip - 0.5, -radius], [tip + 0.8, -radius * 0.45], [tip + 1.6, 0], [tip + 0.5, radius], [tip - 0.5, radius * 0.8]];
      shapes.push({ ...poly(crystal2, glow), surface: gearSurface("gem", 19) });
      shapes.push({ ...poly([[tip - 1.5, 0], [tip - 0.5, -radius], [tip + 0.8, -radius * 0.45], [tip + 1.6, 0], [tip - 0.1, -0.1]], mixColor(glow, "#efffff", 0.55)), surface: { ...gearSurface("gem", 20, [-0.1, -0.6, 0.8]), facet: true } });
      if (visual.element === "lightning") shapes.push({ ...stroke([[6, -0.2], [8, 0.2], [9, -0.2], [11, 0]], glow, 0.2), fine: true });
      if (visual.element === "arcane") shapes.push({ ...stroke([[tip - 4.6, -0.35], [tip - 4.2, 0], [tip - 4.6, 0.35]], visual.guard, 0.2), fine: true });
      return shapes;
    } else if (visual.kind === "staff") {
      const head = length - 4, glow = visual.glow ?? "#a99acf";
      const iron = mixColor(visual.metal, "#121c28", 0.72), lit = mixColor(visual.metal, "#bdc7cc", 0.25);
      shapes.push(poly([[-grip, -0.9], [head - 6, -1.6], [head - 6, 1.4], [-grip, 1]], visual.grip));
      shapes.push(stroke([[-grip, -0.8], [head - 7, -1.1]], mixColor(visual.grip, "#e2d2af", 0.3), 0.45));
      shapes.push(stroke([[-grip + 2, 0.6], [head - 6, 0.8]], mixColor(visual.grip, "#0a1217", 0.5), 0.5));
      for (const x of [-grip + 1, -5, 1, head - 8]) {
        shapes.push(
          poly([[x, -1.7], [x + 1.3, -1.7], [x + 1.3, 1.7], [x, 1.7]], iron),
          stroke([[x, -1.7], [x + 1.3, -1.7]], lit, 0.4)
        );
      }
      shapes.push(poly([
        [head - 9, -2],
        [head - 5, -3],
        [head + 1, -6],
        [length + 3, -3.8],
        [head + 1, -4.2],
        [head - 3, -1.5],
        [head - 3, 1.5],
        [head + 1, 4.2],
        [length + 3, 3.8],
        [head + 1, 6],
        [head - 5, 3],
        [head - 9, 2]
      ], iron));
      shapes.push(stroke([[head - 8, -1.8], [head - 4, -2.2], [head + 1, -5], [length + 2, -3.8]], lit, 0.65));
      shapes.push(stroke([[head - 5, 2.8], [head + 1, 5.4], [length + 2, 4.1]], visual.guard, 0.45));
      if (visual.element === "fire") {
        shapes.push(
          poly([[head - 2, 0], [head + 1, -2.8], [length + 2, -0.8], [length + 1, 1.6], [head + 1, 2.8]], "#783d38"),
          poly([[head - 1, 0], [head + 1, -2], [length + 1, -0.7], [head + 2, 1.6]], glow),
          poly([[head + 1, -0.8], [length, -0.4], [head + 2, 0.8]], "#ffe0a0")
        );
      } else if (visual.element === "frost") {
        shapes.push(
          poly([[head - 2, 0], [head + 2, -3.2], [length + 4, 0], [head + 2, 3.2]], glow),
          poly([[head - 2, 0], [head + 2, -3.2], [length + 4, 0], [head + 2, -0.4]], "#d9eff0"),
          poly([[head + 2, -0.4], [length + 4, 0], [head + 2, 3.2]], "#5989b0")
        );
      } else {
        shapes.push(
          poly(gem(head + 3, 0, 4, 3), glow),
          poly([[head - 1, 0], [head + 3, -3], [head + 2, 0.2]], "#ddd6f5"),
          poly([[head + 2, 0.2], [head + 3, 3], [head + 7, 0]], "#6863ab")
        );
      }
      shapes.push(poly(gem(head - 6, 0, 1.3, 1.7), visual.guard));
      for (let mark = 6; mark < head - 10; mark += 8) shapes.push({ ...stroke([[mark, -0.6], [mark + 1.1, 0], [mark, 0.6]], lit, 0.28), fine: true });
    }
    const pommel = [[-2, -0.7], [-1.1, -1.7], [0.2, -1.4], [0.8, -0.6], [0.8, 0.6], [0.2, 1.4], [-1.1, 1.7], [-2, 0.7]];
    shapes.push(poly(pommel.map(([x, y]) => [x - grip, y]), mixColor(visual.guard, "#23313a", 0.25)));
    shapes.push(stroke([[-grip - 1.6, -0.5], [-grip - 1, -1.2], [-grip + 0.1, -0.9]], visual.edge, 0.35));
    if (visual.glow && visual.kind !== "staff") shapes.push(stroke([[Math.max(5, length * 0.35), -half], [length * 0.8, -half * 0.6], [length, 0]], visual.glow, 0.6));
    if (visual.kind !== "staff") {
      const dark = mixColor(visual.metal, "#101b24", 0.65);
      for (let i = 0; i < 3; i++) {
        const x = length * (0.32 + i * 0.16);
        shapes.push({ ...stroke([[x, -0.2], [x + 0.9, -0.55]], dark, 0.25), fine: true });
      }
      for (let wrap = -grip + 1; wrap < -1; wrap += 2) {
        shapes.push(stroke([[wrap, -0.9], [wrap + 0.5, 0.8]], mixColor(visual.grip, "#172027", 0.55), 0.35));
      }
    }
    if (visual.kind === "staff") return shapes.map((shape) => ({
      ...shape,
      points: shape.points.map(([x, y]) => [x, y * 0.62]),
      ...shape.width !== void 0 ? { width: shape.width * 0.8 } : {}
    }));
    if (["sword", "axe", "mace", "dagger"].includes(visual.kind) && visual.element && visual.element !== "physical" && visual.glow) {
      const start = length * (visual.kind === "axe" || visual.kind === "mace" ? 0.65 : 0.25);
      shapes.push(stroke([[start, 0], [length * 0.9, 0]], visual.glow, 0.65));
      for (let i = 0; i < 3; i++) {
        const x = start + (length * 0.87 - start) * i / 2;
        shapes.push(stroke([[x - 0.8, -0.9], [x + 0.5, 0], [x - 0.8, 0.9]], visual.glow, 0.45));
      }
    }
    return shapes;
  }

  // src/focus-shapes.ts
  var TAU3 = Math.PI * 2;

  // src/appearance-content.ts
  var DEFAULT_APPEARANCE = Object.freeze({
    skin: "warm",
    hairColor: "chestnut",
    hair: "swept",
    facialHair: "none",
    accessory: "none"
  });
  var RACE_FEATURE_OPTIONS = Object.freeze({
    dwarf: ["beard-ringed"],
    nightElf: ["markings", "markings-none"],
    draenei: ["crest", "horns-back", "tendrils"],
    orc: ["tusks-small", "tusks-large"],
    undead: ["bone-bare", "bone-covered"],
    tauren: ["horns-curved", "horns-swept", "horns-grand"],
    troll: ["tusks-long", "tusks-upcurved", "tusks-small"]
  });

  // src/wow-races.ts
  var ALL_DK = Object.freeze([
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
  var WOW_RACES = Object.freeze({
    human: Object.freeze({
      id: "human",
      name: "Human",
      classes: Object.freeze(["warrior", "paladin", "rogue", "priest", "deathKnight", "mage", "warlock"]),
      racial: "everyMan",
      racialName: "Every Man for Himself",
      racialDescription: "Break all stuns, roots and control effects, and take 30% less damage for 2 sec. 2 min cooldown.",
      passives: Object.freeze({ xpGainPercent: 5, manaRegen: 1.5 }),
      passiveDescription: "+5% experience gained \xB7 +1.5 mana per 5 sec",
      skinTones: Object.freeze(["porcelain", "sand", "warm", "rose"]),
      visual: Object.freeze({ hairColor: "chestnut", height: 1, width: 1 })
    }),
    dwarf: Object.freeze({
      id: "dwarf",
      name: "Dwarf",
      classes: Object.freeze(["warrior", "paladin", "hunter", "rogue", "priest", "deathKnight"]),
      racial: "stoneform",
      racialName: "Stoneform",
      racialDescription: "Harden skin: +25% armor and bleed/poison cleanse for 8 sec. 2 min cooldown.",
      passives: Object.freeze({ frostResistance: 5, critDamage: 3 }),
      passiveDescription: "+5 frost resistance \xB7 +3% critical damage",
      skinTones: Object.freeze(["sand", "copper", "umber", "rose"]),
      visual: Object.freeze({ hairColor: "copper", facialHair: "fullbeard", feature: "beard-ringed", height: 0.8, width: 1.22, nose: "broad" })
    }),
    nightElf: Object.freeze({
      id: "nightElf",
      name: "Night Elf",
      classes: Object.freeze(["warrior", "hunter", "rogue", "priest", "deathKnight", "mage", "druid"]),
      racial: "shadowmeld",
      racialName: "Shadowmeld",
      racialDescription: "Fade into shadow for 6 sec, hidden from distant enemies. 2 min cooldown.",
      passives: Object.freeze({ moveSpeedPercent: 2, lightningResistance: 3 }),
      passiveDescription: "+2% movement speed \xB7 +3 lightning resistance",
      skinTones: Object.freeze(["violet", "lavender", "moonblue", "duskwine", "ashen"]),
      visual: Object.freeze({ hairColor: "silver", feature: "markings", height: 1.07, width: 0.94, ears: "elf", eyeGlow: "#f4d97b", markings: true })
    }),
    gnome: Object.freeze({
      id: "gnome",
      name: "Gnome",
      classes: Object.freeze(["warrior", "rogue", "priest", "deathKnight", "mage", "warlock"]),
      racial: "escapeArtist",
      racialName: "Escape Artist",
      racialDescription: "Slip free of roots and slows, moving 30% faster for 3 sec. 1.75 min cooldown.",
      passives: Object.freeze({ intelligence: 5, arcaneResistance: 3 }),
      passiveDescription: "+5 intellect \xB7 +3 arcane resistance",
      skinTones: Object.freeze(["porcelain", "sand", "rose", "warm"]),
      visual: Object.freeze({ hairColor: "golden", height: 0.66, width: 0.88, headScale: 1.3, eyeScale: 1.35 })
    }),
    draenei: Object.freeze({
      id: "draenei",
      name: "Draenei",
      classes: Object.freeze(["warrior", "paladin", "hunter", "priest", "deathKnight", "shaman", "mage"]),
      racial: "giftNaaru",
      racialName: "Gift of the Naaru",
      racialDescription: "Blessed light restores 20% of maximum life over 5 sec. 3 min cooldown.",
      passives: Object.freeze({ arcaneResistance: 5, critChance: 1 }),
      passiveDescription: "+5 arcane resistance \xB7 +1% critical chance",
      skinTones: Object.freeze(["azure", "indigohide", "moonblue", "lavender", "ashen"]),
      visual: Object.freeze({ hairColor: "silver", feature: "crest", height: 1.05, width: 1, horns: "draenei", tendrils: true, hooves: true, tail: "smooth", eyeGlow: "#bfe3ff" })
    }),
    orc: Object.freeze({
      id: "orc",
      name: "Orc",
      classes: Object.freeze(["warrior", "hunter", "rogue", "deathKnight", "shaman", "warlock"]),
      racial: "bloodFury",
      racialName: "Blood Fury",
      racialDescription: "Unleash fury: +15% damage for 15 sec. 2 min cooldown.",
      passives: Object.freeze({ damagePercent: 2 }),
      passiveDescription: "+2% damage",
      skinTones: Object.freeze(["fel", "swamp", "moss", "olive"]),
      visual: Object.freeze({ hairColor: "raven", feature: "tusks-small", height: 1.03, width: 1.16, tusks: "short", jaw: "wide", hunch: 0.5 })
    }),
    undead: Object.freeze({
      id: "undead",
      name: "Undead",
      classes: Object.freeze(["warrior", "rogue", "priest", "deathKnight", "mage", "warlock"]),
      racial: "willForsaken",
      racialName: "Will of the Forsaken",
      racialDescription: "Shake off fear and all control effects, taking 30% less damage for 2 sec. 2 min cooldown.",
      passives: Object.freeze({ arcaneResistance: 5 }),
      passiveDescription: "+5 arcane resistance",
      skinTones: Object.freeze(["grave", "pale", "ashen", "moonblue"]),
      visual: Object.freeze({ hairColor: "espresso", feature: "bone-bare", height: 0.97, width: 0.9, decay: true, jaw: "bone", hunch: 0.65, eyeGlow: "#e8d44d" })
    }),
    tauren: Object.freeze({
      id: "tauren",
      name: "Tauren",
      classes: Object.freeze(["warrior", "hunter", "deathKnight", "shaman", "druid"]),
      racial: "warStomp",
      racialName: "War Stomp",
      racialDescription: "Stomp the ground, stunning nearby enemies for 1.5 sec. 2 min cooldown.",
      passives: Object.freeze({ maxHp: 25, lightningResistance: 3 }),
      passiveDescription: "+25 maximum life \xB7 +3 lightning resistance",
      skinTones: Object.freeze(["pelt", "umber", "mahogany", "stonepelt", "ebony"]),
      visual: Object.freeze({ hairColor: "walnut", feature: "horns-curved", height: 1.15, width: 1.3, horns: "tauren", ears: "bovine", muzzle: true, hooves: true, tail: "tuft", hunch: 0.7 })
    }),
    troll: Object.freeze({
      id: "troll",
      name: "Troll",
      classes: ALL_DK,
      racial: "berserking",
      racialName: "Berserking",
      racialDescription: "Enter a frenzy: +20% attack and cast speed for 10 sec. 3 min cooldown.",
      passives: Object.freeze({ lifeRegen: 0.5 }),
      passiveDescription: "+0.5 life per second",
      skinTones: Object.freeze(["cerulean", "deepsea", "moonblue", "moss"]),
      visual: Object.freeze({ hairColor: "raven", feature: "tusks-long", height: 1.09, width: 0.88, ears: "long", tusks: "long", nose: "hooked", hunch: 0.55 })
    }),
    bloodElf: Object.freeze({
      id: "bloodElf",
      name: "Blood Elf",
      classes: Object.freeze(["paladin", "hunter", "rogue", "priest", "deathKnight", "mage"]),
      racial: "arcaneTorrent",
      racialName: "Arcane Torrent",
      racialDescription: "Silence nearby enemies for 2 sec and restore 15 resource. 2 min cooldown.",
      passives: Object.freeze({ arcaneResistance: 5, critChance: 2 }),
      passiveDescription: "+5 arcane resistance \xB7 +2% critical chance",
      skinTones: Object.freeze(["porcelain", "rose", "sand", "honey"]),
      visual: Object.freeze({ hairColor: "golden", height: 1, width: 0.92, ears: "elf", eyeGlow: "#7ce87c" })
    })
  });

  // src/equipment-art.ts
  var shadingCache = /* @__PURE__ */ new WeakMap();
  function drawGearShapes(ctx, shapes, color) {
    const matrix = ctx.getTransform(), fine = Math.hypot(matrix.a, matrix.b) >= 2.4;
    const lighting = gearCanvasLight(ctx), facing = Math.round(Math.atan2(matrix.b, matrix.a) * 128) / 128;
    const lightKey = `${facing}:${lighting.direction.map((v) => Math.round(v * 64)).join(",")}:${lighting.color}:${Math.round(lighting.power * 64)}`;
    for (const shape of shapes) {
      if (shape.fine && !fine) continue;
      let stops;
      if (shape.surface) {
        const cached = shadingCache.get(shape);
        if (cached?.key === lightKey) stops = cached.stops;
        else {
          stops = gearMaterialStops(shape.fill ?? shape.stroke ?? "#808080", shape.surface, facing, lighting);
          shadingCache.set(shape, { key: lightKey, stops });
        }
      }
      if (shape.fill) {
        polygon(ctx, shape.points, color(!fine && stops ? stops[1][1] : shape.fill));
        if (fine && shape.surface && !shape.fine) {
          const xs = shape.points.map((p2) => p2[0]), ys = shape.points.map((p2) => p2[1]);
          const left = Math.min(...xs), top = Math.min(...ys), w = Math.max(...xs) - left, h = Math.max(...ys) - top;
          if (w * h > 1) {
            ctx.save();
            ctx.clip();
            const light = ctx.createLinearGradient(left, top, left + w * 0.8, top + h);
            for (const [at, value] of stops) light.addColorStop(at, color(value));
            ctx.fillStyle = light;
            ctx.fillRect(left, top, w, h);
            if (w * h > 5) {
              ctx.globalAlpha *= 0.13;
              for (const mark of gearMaterialMarks(shape.surface, [left, top, w, h])) line(ctx, mark, color(shape.fill), 0.1);
            }
            ctx.restore();
          }
        }
      }
      if (shape.stroke) line(ctx, shape.points, color(stops ? stops[1][1] : shape.stroke), shape.width ?? 0.7);
    }
  }

  // src/hud-weapon-icon.ts
  var ANGLE = -Math.PI / 4;
  var fits = /* @__PURE__ */ new WeakMap();
  function weaponIconFit(visual) {
    const cached = fits.get(visual);
    if (cached) return cached;
    const points = weaponShapes(visual).flatMap((shape) => shape.points.map(([x, y]) => [x * Math.cos(ANGLE) - y * Math.sin(ANGLE), x * Math.sin(ANGLE) + y * Math.cos(ANGLE)]));
    const xs = points.map((p2) => p2[0]), ys = points.map((p2) => p2[1]);
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    const fit = { x: (left + right) / 2, y: (top + bottom) / 2, span: Math.max(right - left, bottom - top, 1) };
    fits.set(visual, fit);
    return fit;
  }
  function drawHUDWeapon(c2, visual, size) {
    const fit = weaponIconFit(visual), scale = size / fit.span;
    c2.save();
    c2.scale(scale, scale);
    c2.translate(-fit.x, -fit.y);
    c2.rotate(ANGLE);
    drawGearShapes(c2, weaponShapes(visual), (color) => color);
    c2.restore();
  }

  // src/hud-utility-art.ts
  var body2 = (path2, material2) => ({ path: path2, material: material2, kind: "body" });
  var facet2 = (path2, material2) => ({ path: path2, material: material2, kind: "facet" });
  var recipes2 = {
    potion: [
      body2("M24 9H40V22C40 27 51 30 51 42V50Q50 59 40 60H24Q14 59 13 50V42C13 30 24 27 24 22Z", "ice"),
      body2("M17 37Q24 34 31 39V56H24Q18 55 17 49Z", "rose"),
      body2("M33 39Q40 43 47 37V49Q46 55 40 56H33Z", "violet"),
      facet2("M20 38 29 41 23 53 19 49Z", "rose"),
      body2("M22 6H42V14H22Z", "gold"),
      body2("M23 17H41V21H23Z", "gold"),
      facet2("M27 23H30Q31 29 23 34L20 35Q28 29 27 23Z", "steel"),
      facet2("M20 38 22 38 21 47 19 44Z", "steel")
    ],
    dodge: [
      body2("M5 18 21 13 19 19 4 23ZM2 31 16 26 15 32 3 36ZM7 44 17 37 17 42 7 48Z", "jade"),
      body2("M27 6 45 9 41 28 44 36 56 43 59 49 55 54H23L20 48 25 36 29 28Z", "jade"),
      body2("M26 6 46 9 45 17 28 14Z", "gold"),
      facet2("M30 18 39 20 35 31 29 39 25 42 30 28Z", "steel"),
      body2("M22 46 30 43 43 46 57 48 55 54H24Z", "gold"),
      facet2("M35 36 41 33 43 38 49 42 42 44 29 42Z", "jade")
    ],
    menu: [
      // Three broad silver bars stay recognizable inside the small round control.
      body2("M16 15H48L50 17V21L48 23H16L14 21V17Z", "steel"),
      body2("M16 28H48L50 30V34L48 36H16L14 34V30Z", "steel"),
      body2("M16 41H48L50 43V47L48 49H16L14 47V43Z", "steel")
    ]
  };
  var stamps2 = /* @__PURE__ */ new Map();
  function drawHUDUtility(c2, kind, x, y, size) {
    let stamp = stamps2.get(kind);
    if (!stamp) {
      stamp = document.createElement("canvas");
      stamp.width = stamp.height = 144;
      const context = stamp.getContext("2d");
      paintGlassIcon(context, glassIconDrawing(recipes2[kind], kind === "potion" ? "rose" : kind === "dodge" ? "jade" : "steel", false), 72, 72, 144);
      stamps2.set(kind, stamp);
    }
    c2.drawImage(stamp, x - size / 2, y - size / 2, size, size);
  }

  // src/font.ts
  var import_meta = {};
  var GAME_FONT_FAMILY = "Pixelify Sans";
  var NUMERIC_FONT_FAMILY = "Evergrow Numerals";
  var GAME_FONT_STACK = `"${NUMERIC_FONT_FAMILY}", "${GAME_FONT_FAMILY}", ui-monospace, monospace`;
  var INTERFACE_FONT_STACK = `"${NUMERIC_FONT_FAMILY}", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  var GAME_FONT_EM = 11;
  var FONT_WEIGHT = 400;
  var FONT_URL = new URL("./assets/fonts/PixelifySans-Variable.ttf", document.baseURI).href;
  var NUMERIC_FONT_URL = new URL("./assets/fonts/Barlow-Medium.ttf", document.baseURI).href;
  var measuring = null;
  function font(pixelSize, face = "display") {
    if (face === "interface") return `600 ${pixelSize}px ${INTERFACE_FONT_STACK}`;
    return `${FONT_WEIGHT} ${pixelSize}px ${GAME_FONT_STACK}`;
  }
  function textWidth(value, size = 1, face = "display") {
    if (!value || size <= 0 || !Number.isFinite(size)) return 0;
    measuring ??= document.createElement("canvas").getContext("2d");
    if (!measuring) return 0;
    measuring.font = font(GAME_FONT_EM * size, face);
    measuring.fontKerning = "normal";
    return measuring.measureText(value.toUpperCase()).width;
  }
  function text(ctx, value, x, y, size = 1, color = "#d4c8a4", align = "left", face = "display") {
    if (!value || size <= 0 || ![x, y, size].every(Number.isFinite)) return;
    const transform = ctx.getTransform();
    const physicalScale = Math.hypot(transform.c, transform.d);
    if (!Number.isFinite(physicalScale) || physicalScale < 1e-5) return;
    const pixels = GAME_FONT_EM * size * physicalScale;
    const valueToDraw = value.toUpperCase();
    ctx.save();
    ctx.font = font(pixels, face);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.direction = "ltr";
    ctx.fontKerning = "normal";
    const width = ctx.measureText(valueToDraw).width;
    const caps = ctx.measureText("H");
    const ascent = caps.actualBoundingBoxAscent || pixels * 0.7;
    const offset = align === "center" ? -width / 2 : align === "right" ? -width : 0;
    const a = transform.a / physicalScale, b = transform.b / physicalScale;
    const c2 = transform.c / physicalScale, d = transform.d / physicalScale;
    const physicalX = transform.a * x + transform.c * y + transform.e + a * offset + c2 * ascent;
    const physicalY = transform.b * x + transform.d * y + transform.f + b * offset + d * ascent;
    ctx.setTransform(a, b, c2, d, Math.round(physicalX), Math.round(physicalY));
    ctx.fillStyle = color;
    ctx.fillText(valueToDraw, 0, 0);
    ctx.restore();
  }

  // src/ui-tooltip-motion.ts
  var TOOLTIP_MOTION = Object.freeze({ enter: 160, exit: 120, lift: 4 });

  // src/ui-theme.ts
  var UI_THEME = Object.freeze({
    palette: Object.freeze({
      ink: "#070d12",
      panel: "#111b22",
      panelRaised: "#1a2830",
      well: "#0a131a",
      line: "#354641",
      lineStrong: "#746d55",
      brass: "#b09a72",
      brassDim: "#77694f",
      silver: "#b5d0d7",
      silverDim: "#6d828a",
      steel: "#142129",
      steelDeep: "#080f16",
      jade: "#a7c0ae",
      jadeDark: "#2e4b41",
      ivory: "#e9e4d3",
      text: "#c7cec3",
      muted: "#9baa9e",
      faint: "#73857c",
      danger: "#d9948d",
      focus: "#c5d7b8"
    }),
    typography: Object.freeze({
      font: GAME_FONT_STACK,
      body: "16px",
      small: "14px",
      kicker: "12px",
      title: "20px"
    }),
    geometry: Object.freeze({ control: "44px", slot: "56px", radius: "3px" }),
    motion: Object.freeze({ quick: "140ms", gentle: "220ms" })
  });

  // src/hud-icons.ts
  var INK = "#080d10";
  var EDGE = "#bec4ac";
  var BRONZE = "#8e774c";
  function polygon2(c2, points) {
    c2.beginPath();
    c2.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c2.lineTo(points[i], points[i + 1]);
    c2.closePath();
  }
  function sword(c2, active) {
    c2.rotate(0.67);
    const blade2 = c2.createLinearGradient(-2.5, 0, 2.5, 0);
    blade2.addColorStop(0, "#475651");
    blade2.addColorStop(0.48, "#8b9990");
    blade2.addColorStop(0.51, active ? "#eee3b2" : "#c7cbb0");
    blade2.addColorStop(1, "#6d7875");
    polygon2(c2, [-2.1, 3.5, -2.1, -8.5, 0, -13, 2.1, -8.5, 2.1, 3.5]);
    c2.fillStyle = blade2;
    c2.fill();
    c2.strokeStyle = INK;
    c2.lineWidth = 1.5;
    c2.stroke();
    c2.strokeStyle = EDGE;
    c2.lineWidth = 0.75;
    c2.beginPath();
    c2.moveTo(0, -11);
    c2.lineTo(0, 2.5);
    c2.stroke();
    c2.strokeStyle = "#35433f";
    c2.lineWidth = 0.6;
    c2.beginPath();
    c2.moveTo(-1.1, -7);
    c2.lineTo(-1.1, 1.5);
    c2.stroke();
    polygon2(c2, [
      -5.3,
      3.5,
      -4.6,
      2.6,
      -1.6,
      3.6,
      1.6,
      3.6,
      4.6,
      2.6,
      5.3,
      3.5,
      4.7,
      5.1,
      1.4,
      4.8,
      -1.4,
      4.8,
      -4.7,
      5.1
    ]);
    c2.fillStyle = BRONZE;
    c2.fill();
    c2.strokeStyle = INK;
    c2.lineWidth = 1;
    c2.stroke();
    c2.strokeStyle = "#baaa7b";
    c2.lineWidth = 0.7;
    c2.beginPath();
    c2.moveTo(-4.4, 3.5);
    c2.lineTo(-1.5, 4);
    c2.lineTo(1.5, 4);
    c2.lineTo(4.4, 3.5);
    c2.stroke();
    c2.fillStyle = "#473e33";
    c2.fillRect(-1.3, 5, 2.6, 5);
    c2.strokeStyle = "#9b8c64";
    c2.lineWidth = 0.6;
    for (const y of [5.7, 7.3, 8.9]) {
      c2.beginPath();
      c2.moveTo(-1, y);
      c2.lineTo(1, y + 0.5);
      c2.stroke();
    }
    polygon2(c2, [-1.2, 9.5, 1.2, 9.5, 1.7, 11, 0, 12, -1.7, 11]);
    c2.fillStyle = BRONZE;
    c2.fill();
    c2.strokeStyle = INK;
    c2.lineWidth = 0.8;
    c2.stroke();
    c2.fillStyle = "#c3b486";
    c2.fillRect(-0.6, 10, 1, 1);
  }
  function ember2(c2, time, active) {
    const flicker = active ? Math.sin(time * 8) * 0.6 : 0;
    const outer = c2.createLinearGradient(-4, -12, 4, 10);
    outer.addColorStop(0, "#b18b4e");
    outer.addColorStop(0.4, "#a15d32");
    outer.addColorStop(0.76, "#643627");
    outer.addColorStop(1, "#352827");
    c2.beginPath();
    c2.moveTo(-1.4, -12 - flicker);
    c2.bezierCurveTo(1.9, -8.3, 4.9, -7.4, 3.8, -3.1);
    c2.bezierCurveTo(5.2, -4.1, 5.8, -5.9, 5.7, -7);
    c2.bezierCurveTo(8.4, -2.6, 7.9, 3.5, 5.5, 6.9);
    c2.bezierCurveTo(2.9, 10.7, -2.6, 11, -5.5, 7);
    c2.bezierCurveTo(-8.9, 3, -8, -1.4, -5.1, -4.3);
    c2.bezierCurveTo(-5.5, -1.5, -4.3, -0.5, -3.4, 0.1);
    c2.bezierCurveTo(-4.4, -5, -0.2, -6.7, -1.4, -12 - flicker);
    c2.closePath();
    c2.fillStyle = outer;
    c2.fill();
    c2.strokeStyle = INK;
    c2.lineWidth = 1.3;
    c2.stroke();
    const heat = c2.createLinearGradient(0, -5, 0, 8);
    heat.addColorStop(0, "#c09b5c");
    heat.addColorStop(0.6, active ? "#edb564" : "#cf9650");
    heat.addColorStop(1, "#a56b3d");
    c2.beginPath();
    c2.moveTo(-0.1, -5.8);
    c2.bezierCurveTo(3.1, -3, 1, -0.7, 3, 1.3);
    c2.bezierCurveTo(4.3, 0.5, 4.5, -0.1, 4.5, -0.9);
    c2.bezierCurveTo(5.4, 3.8, 2.7, 8, -0.2, 8.1);
    c2.bezierCurveTo(-3.8, 8.1, -5.2, 4.4, -3.6, 1);
    c2.bezierCurveTo(-2.2, 3, -0.4, 2.4, -1.3, 0.7);
    c2.bezierCurveTo(-2.5, -1.5, -0.4, -3.4, -0.1, -5.8);
    c2.closePath();
    c2.fillStyle = heat;
    c2.fill();
    c2.beginPath();
    c2.moveTo(0.2, 0.1);
    c2.bezierCurveTo(1.6, 2.1, -0.1, 3, 1.8, 4.4);
    c2.bezierCurveTo(2.8, 6.5, 0.6, 7.5, -0.7, 6.9);
    c2.bezierCurveTo(-2.6, 6, -1.7, 3.7, 0.2, 0.1);
    c2.closePath();
    c2.fillStyle = active ? "#f1ddb1" : "#dcc18c";
    c2.fill();
    c2.strokeStyle = "#c89a5d";
    c2.lineWidth = 0.7;
    c2.beginPath();
    c2.moveTo(-5.6, 2);
    c2.quadraticCurveTo(-6.5, 4.2, -4.8, 6.2);
    c2.stroke();
    c2.fillStyle = active ? "#b58c54" : "#776146";
    c2.fillRect(5.4, -10, 0.8, 1.5);
    c2.fillRect(-5.5, -8.2, 0.8, 0.8);
  }
  function greave(c2, active) {
    c2.strokeStyle = "#535f58";
    c2.lineWidth = 0.8;
    c2.beginPath();
    c2.moveTo(-11.5, -5);
    c2.lineTo(-6.5, -6);
    c2.moveTo(-12, 0);
    c2.lineTo(-7.5, -0.8);
    c2.stroke();
    const plate = c2.createLinearGradient(-4, 0, 8, 0);
    plate.addColorStop(0, "#35413f");
    plate.addColorStop(0.45, "#7e8d83");
    plate.addColorStop(0.58, active ? "#bdc6a7" : "#a0ab96");
    plate.addColorStop(1, "#4b5953");
    polygon2(c2, [
      -3.3,
      -11,
      3.8,
      -12,
      5.6,
      -8.4,
      3.2,
      -0.2,
      6.5,
      3,
      9.8,
      4.2,
      11.4,
      7.3,
      8.8,
      9.1,
      -4.5,
      9.1,
      -5.5,
      6.5,
      -0.8,
      1.9,
      -1.8,
      -2.2
    ]);
    c2.fillStyle = plate;
    c2.fill();
    c2.strokeStyle = INK;
    c2.lineWidth = 1.4;
    c2.stroke();
    polygon2(c2, [-2.3, -10.2, 3.4, -11, 4.4, -8.8, -1.5, -8]);
    c2.fillStyle = "#695f47";
    c2.fill();
    c2.strokeStyle = "#b8b49a";
    c2.lineWidth = 0.75;
    c2.beginPath();
    c2.moveTo(-1.9, -9.9);
    c2.lineTo(3.3, -10.6);
    c2.stroke();
    c2.strokeStyle = EDGE;
    c2.beginPath();
    c2.moveTo(1, -7.1);
    c2.lineTo(0.2, -0.7);
    c2.lineTo(2.2, 2.1);
    c2.stroke();
    polygon2(c2, [-0.8, 1.5, 2.2, 0.8, 4.4, 3.3, 1.6, 4.6, -2, 4.3]);
    c2.fillStyle = "#49544d";
    c2.fill();
    c2.strokeStyle = "#94977e";
    c2.lineWidth = 0.65;
    c2.stroke();
    c2.strokeStyle = "#bac0a4";
    c2.lineWidth = 0.75;
    c2.beginPath();
    c2.moveTo(4.5, 4.6);
    c2.lineTo(8.1, 5.3);
    c2.lineTo(9.2, 6.6);
    c2.stroke();
    polygon2(c2, [-4.8, 7.4, -0.8, 8, 8.3, 7.7, 10.5, 6.9, 10.6, 8.3, 8.3, 10, -4.2, 10]);
    c2.fillStyle = "#2c3030";
    c2.fill();
    c2.strokeStyle = INK;
    c2.lineWidth = 0.8;
    c2.stroke();
    c2.strokeStyle = "#727164";
    c2.beginPath();
    c2.moveTo(-3.6, 8.6);
    c2.lineTo(7.9, 8.6);
    c2.stroke();
  }
  function flask(c2, time, active) {
    const glass = c2.createLinearGradient(-6, 0, 6, 0);
    glass.addColorStop(0, "#273c35");
    glass.addColorStop(0.3, "#516350");
    glass.addColorStop(0.55, "#2f4339");
    glass.addColorStop(1, "#182a27");
    polygon2(c2, [
      -2.8,
      -9.2,
      2.8,
      -9.2,
      2.8,
      -4.6,
      5.8,
      -0.7,
      5.5,
      8.3,
      3.3,
      10.7,
      -3.3,
      10.7,
      -5.5,
      8.3,
      -5.8,
      -0.7,
      -2.8,
      -4.6
    ]);
    c2.fillStyle = glass;
    c2.fill();
    c2.strokeStyle = INK;
    c2.lineWidth = 1.4;
    c2.stroke();
    c2.strokeStyle = "#758575";
    c2.lineWidth = 0.7;
    c2.stroke();
    const surface = 0.9 + (active ? Math.sin(time * 6) * 0.35 : 0);
    const life = c2.createLinearGradient(-4, 0, 0, 10);
    life.addColorStop(0, active ? "#ed9295" : "#c66c78");
    life.addColorStop(1, "#653c57");
    const mana = c2.createLinearGradient(0, 0, 4, 10);
    mana.addColorStop(0, active ? "#9bcaff" : "#6d9ed4");
    mana.addColorStop(1, "#354e80");
    polygon2(c2, [-4.5, surface, 0, surface + 0.3, 0, 9.2, -2.5, 9.2, -4.2, 7.7]);
    c2.fillStyle = life;
    c2.fill();
    polygon2(c2, [0, surface + 0.3, 4.5, surface, 4.2, 7.7, 2.5, 9.2, 0, 9.2]);
    c2.fillStyle = mana;
    c2.fill();
    c2.strokeStyle = "#c8bbdf";
    c2.lineWidth = 0.7;
    c2.beginPath();
    c2.moveTo(-4.1, surface + 0.2);
    c2.lineTo(0, surface + 0.5);
    c2.lineTo(4.1, surface + 0.2);
    c2.stroke();
    c2.strokeStyle = "#c4cfb19e";
    c2.lineWidth = 1;
    c2.beginPath();
    c2.moveTo(-1.5, -7.5);
    c2.lineTo(-1.5, -4.8);
    c2.moveTo(-3.7, -0.4);
    c2.lineTo(-3.5, 4.7);
    c2.stroke();
    c2.strokeStyle = "#89a17f";
    c2.lineWidth = 0.7;
    c2.beginPath();
    c2.moveTo(3.5, 6.1);
    c2.lineTo(3.3, 7.5);
    c2.lineTo(2, 8.7);
    c2.stroke();
    polygon2(c2, [-3.8, -11.7, 3.8, -11.7, 3.4, -8.8, -3.4, -8.8]);
    c2.fillStyle = "#77705a";
    c2.fill();
    c2.strokeStyle = INK;
    c2.lineWidth = 1;
    c2.stroke();
    c2.strokeStyle = "#b6ad86";
    c2.lineWidth = 0.75;
    c2.beginPath();
    c2.moveTo(-2.8, -10.7);
    c2.lineTo(2.8, -10.7);
    c2.stroke();
    c2.fillStyle = "#c1cf966e";
    c2.fillRect(0.6, 3.5, 1, 1);
  }
  function drawHUDSkillIcon(c2, index, x, y, time, active) {
    c2.save();
    c2.translate(x, y);
    c2.lineJoin = "round";
    c2.lineCap = "round";
    c2.shadowBlur = 0;
    c2.shadowColor = "transparent";
    if (index === 0) sword(c2, active);
    else if (index === 1) ember2(c2, time, active);
    else if (index === 2) greave(c2, active);
    else if (index === 3) flask(c2, time, active);
    c2.restore();
  }

  // src/hud-orb.ts
  var TAU4 = Math.PI * 2;
  var GLASS_RADIUS = 25;
  var clamp3 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const target2 = amount < 0 ? 0 : 255, a = Math.abs(amount);
    const mix = (v) => Math.round(v + (target2 - v) * a);
    return `#${(1 << 24 | mix(n >> 16 & 255) << 16 | mix(n >> 8 & 255) << 8 | mix(n & 255)).toString(16).slice(1)}`;
  }
  var MANA_PALETTE = {
    empty0: "#142131",
    empty1: "#0b1321",
    liquid: ["#619fe9", "#327bd8", "#2048a3", "#0a1c50"],
    glow0: "#448ded55",
    glow1: "#2a62be24",
    meniscus: "#b3d7f7",
    moteA: "#b9b6ff",
    moteB: "#a6dfff",
    rim: "#80a8d653"
  };
  function resourcePalette(tint) {
    if (!tint) return MANA_PALETTE;
    return {
      empty0: shade(tint, -0.78),
      empty1: shade(tint, -0.88),
      liquid: [shade(tint, 0.45), shade(tint, 0.15), shade(tint, -0.25), shade(tint, -0.65)],
      glow0: `${tint}55`,
      glow1: `${shade(tint, -0.2)}24`,
      meniscus: shade(tint, 0.6),
      moteA: shade(tint, 0.55),
      moteB: shade(tint, 0.35),
      rim: `${tint}53`
    };
  }
  function circle(c2, x, y, radius) {
    c2.beginPath();
    c2.arc(x, y, radius, 0, TAU4);
  }
  function liquidLevel(ratio) {
    if (ratio <= 0) return GLASS_RADIUS;
    if (ratio >= 1) return -GLASS_RADIUS;
    let low = -1, high = 1;
    for (let i = 0; i < 18; i++) {
      const position = (low + high) / 2;
      const area = (Math.acos(position) - position * Math.sqrt(1 - position * position)) / Math.PI;
      if (area > ratio) low = position;
      else high = position;
    }
    return (low + high) * GLASS_RADIUS / 2;
  }
  function manaEnergy(c2, time, level, moteA = "#b9b6ff", moteB = "#a6dfff") {
    for (let i = 0; i < 9; i++) {
      const phase = (time * (0.07 + i % 3 * 0.012) + i * 0.381966) % 1;
      const x = Math.sin(i * 2.4) * 16 + Math.sin(time * 0.75 + i * 1.7) * 1.2;
      const y = 25 - phase * 53;
      const radius = 0.5 + i % 3 * 0.18;
      const submerged = Math.min(1, Math.max(0, (y - level) / 3));
      const fade = Math.min(1, phase * 9) * submerged * (0.75 + Math.sin(time * 1.5 + i) * 0.15);
      if (fade <= 0) continue;
      const tint = i % 3 === 0 ? moteA : moteB;
      const halo2 = c2.createRadialGradient(x, y, 0, x, y, radius * 2.7);
      halo2.addColorStop(0, tint + "60");
      halo2.addColorStop(0.4, tint + "24");
      halo2.addColorStop(1, tint + "00");
      c2.globalAlpha = fade * 0.65;
      c2.fillStyle = halo2;
      c2.fillRect(x - 3, y - 3, 6, 6);
      c2.globalAlpha = fade * 0.46;
      c2.fillStyle = tint;
      circle(c2, x, y, radius);
      c2.fill();
      c2.globalAlpha = fade * 0.16;
      c2.strokeStyle = tint;
      c2.lineWidth = 0.45;
      c2.beginPath();
      c2.moveTo(x, y + radius);
      c2.lineTo(x - 0.25, y + radius + 1.4);
      c2.stroke();
    }
  }
  function drawHUDOrb(c2, x, y, ratio, time, mana, trail = ratio, hit = 0, reserved = 0, tint) {
    const palette = mana ? resourcePalette(tint) : MANA_PALETTE;
    const r = GLASS_RADIUS;
    ratio = clamp3(ratio);
    trail = clamp3(trail);
    hit = clamp3(hit);
    const lowPulse = !mana && ratio > 0 && ratio < 0.3 ? 0.5 + Math.sin(time * 4.5) * 0.5 : 0;
    c2.save();
    c2.translate(x, y);
    circle(c2, 0, 0, 31);
    c2.clip();
    circle(c2, 0, 0, 30.8);
    c2.fillStyle = "#04070b";
    c2.fill();
    const metal2 = c2.createLinearGradient(-23, -29, 18, 30);
    metal2.addColorStop(0, "#77776a");
    metal2.addColorStop(0.15, "#40474a");
    metal2.addColorStop(0.4, "#20282d");
    metal2.addColorStop(0.66, "#10171d");
    metal2.addColorStop(0.85, "#4c4537");
    metal2.addColorStop(1, "#272b2b");
    circle(c2, 0, 0, 28.4);
    c2.lineWidth = 4.4;
    c2.strokeStyle = metal2;
    c2.stroke();
    circle(c2, 0, 0, 30.3);
    c2.lineWidth = 0.65;
    c2.strokeStyle = "#8d816150";
    c2.stroke();
    circle(c2, 0, 0, 26.25);
    c2.lineWidth = 1.3;
    c2.strokeStyle = "#050b12";
    c2.stroke();
    circle(c2, 0, 0, 25.5);
    c2.lineWidth = 0.65;
    c2.strokeStyle = "#a99a6d75";
    c2.stroke();
    c2.beginPath();
    c2.arc(0, 0, 28.6, 3.55, 4.95);
    c2.lineWidth = 0.6;
    c2.strokeStyle = "#d6cba172";
    c2.stroke();
    c2.beginPath();
    c2.arc(0, 0, 28.6, 0.55, 1.9);
    c2.strokeStyle = "#8b785347";
    c2.stroke();
    c2.save();
    circle(c2, 0, 0, r);
    c2.clip();
    const empty = c2.createRadialGradient(-7, -9, 1, 0, 0, r * 1.25);
    empty.addColorStop(0, mana ? palette.empty0 : "#271722");
    empty.addColorStop(0.6, mana ? palette.empty1 : "#160e19");
    empty.addColorStop(1, "#03060c");
    c2.fillStyle = empty;
    c2.fillRect(-r, -r, r * 2, r * 2);
    if (!mana && trail > ratio + 1e-3) {
      const level = liquidLevel(trail);
      const lag = c2.createLinearGradient(0, level, 0, r);
      lag.addColorStop(0, "#e78c9480");
      lag.addColorStop(1, "#78384b60");
      c2.fillStyle = lag;
      c2.fillRect(-r, level, r * 2, r - level);
    }
    if (ratio > 0) {
      const level = liquidLevel(ratio);
      c2.save();
      c2.beginPath();
      c2.rect(-r, level, r * 2, r - level);
      c2.clip();
      const liquid = c2.createLinearGradient(-8, -r, 9, r);
      liquid.addColorStop(0, mana ? palette.liquid[0] : "#ee4863");
      liquid.addColorStop(0.24, mana ? palette.liquid[1] : "#cd2249");
      liquid.addColorStop(0.59, mana ? palette.liquid[2] : "#991334");
      liquid.addColorStop(1, mana ? palette.liquid[3] : "#45091f");
      c2.fillStyle = liquid;
      c2.fillRect(-r, -r, r * 2, r * 2);
      c2.globalCompositeOperation = "screen";
      const glowX = -7 + Math.sin(time * 0.31) * 2;
      const glowY = 9 + Math.cos(time * 0.27) * 2;
      const glow = c2.createRadialGradient(glowX, glowY, 0, glowX, glowY, 24);
      glow.addColorStop(0, mana ? palette.glow0 : "#f34b5559");
      glow.addColorStop(0.55, mana ? palette.glow1 : "#bf28472b");
      glow.addColorStop(1, "#00000000");
      c2.fillStyle = glow;
      c2.fillRect(-r, -r, r * 2, r * 2);
      if (ratio < 1) {
        const halfWidth = Math.sqrt(Math.max(0, r * r - level * level));
        c2.globalAlpha = 0.6;
        c2.lineWidth = 0.75;
        c2.strokeStyle = mana ? palette.meniscus : "#f38b99";
        c2.beginPath();
        c2.moveTo(-halfWidth, level + 0.4);
        c2.lineTo(halfWidth, level + 0.4);
        c2.stroke();
        for (let i = 0; !mana && i < 2; i++) {
          const travel = (time * 0.14 + i * 0.5) % 1;
          const width = halfWidth * (0.25 + travel * 0.6);
          c2.globalAlpha = Math.sin(travel * Math.PI) * 0.2;
          c2.lineWidth = 0.55;
          c2.beginPath();
          c2.ellipse(
            Math.sin(time * 0.47 + i) * halfWidth * 0.12,
            level + 0.9 + travel * 1.8,
            Math.max(0.1, width),
            0.3 + travel * 0.35,
            0,
            0.12,
            Math.PI - 0.12
          );
          c2.stroke();
        }
      }
      if (mana) manaEnergy(c2, time, level, palette.moteA, palette.moteB);
      for (let i = 0; !mana && i < 11; i++) {
        const phase = (time * (0.09 + i % 4 * 0.017) + i * 0.381966) % 1;
        const bx = Math.sin(i * 2.4) * 16 + Math.sin(time * 1.2 + i * 1.7) * 1.5;
        const by = 25 - phase * 53;
        const radius = 0.7 + i % 4 * 0.36;
        const submerged = Math.min(1, Math.max(0, (by - level) / (radius * 2.5)));
        const fade = Math.min(1, phase * 9) * submerged;
        if (fade <= 0) continue;
        c2.globalAlpha = fade * 0.55;
        c2.fillStyle = "#ff9caa28";
        circle(c2, bx, by, radius);
        c2.fill();
        c2.strokeStyle = "#ffb8bd";
        c2.lineWidth = 0.42;
        c2.stroke();
        c2.globalAlpha = fade * 0.85;
        c2.beginPath();
        c2.arc(bx, by, radius * 0.76, 3.5, 4.8);
        c2.strokeStyle = "#ffe1d3";
        c2.lineWidth = 0.5;
        c2.stroke();
      }
      c2.restore();
    }
    const glass = c2.createRadialGradient(-2, -3, 10, 0, 0, r);
    glass.addColorStop(0, "#01061000");
    glass.addColorStop(0.45, "#0106100c");
    glass.addColorStop(0.8, "#01051048");
    glass.addColorStop(1, "#01040ac7");
    c2.fillStyle = glass;
    c2.fillRect(-r, -r, r * 2, r * 2);
    const reflection = c2.createLinearGradient(-15, -24, 7, 7);
    reflection.addColorStop(0, "#dcebf51f");
    reflection.addColorStop(0.7, "#dcebf500");
    c2.fillStyle = reflection;
    c2.fillRect(-r, -r, r * 2, r * 2);
    c2.beginPath();
    c2.arc(0, 0, 23.4, 3.65, 4.28);
    c2.lineWidth = 0.95;
    c2.strokeStyle = "#e1e9e376";
    c2.stroke();
    c2.beginPath();
    c2.arc(0, 0, 23.7, 0.53, 1.15);
    c2.lineWidth = 0.55;
    c2.strokeStyle = mana ? palette.rim : "#af626453";
    c2.stroke();
    c2.restore();
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI * (0.25 + i * 0.5);
      const px = Math.cos(angle) * 28.45, py = Math.sin(angle) * 28.45;
      circle(c2, px, py, 1.2);
      c2.fillStyle = "#05090d";
      c2.fill();
      circle(c2, px, py - 0.2, 0.65);
      c2.fillStyle = "#70716a";
      c2.fill();
      c2.beginPath();
      c2.moveTo(px - 0.4, py + 0.1);
      c2.lineTo(px + 0.4, py - 0.1);
      c2.strokeStyle = "#252b2e";
      c2.lineWidth = 0.45;
      c2.stroke();
    }
    if (!mana && (hit > 0 || lowPulse > 0)) {
      c2.globalCompositeOperation = "screen";
      circle(c2, 0, 0, 25.8);
      c2.lineWidth = 0.9;
      c2.strokeStyle = hit > 0 ? "#ffc7a6" : "#d84c56";
      c2.globalAlpha = Math.max(hit * 0.8, lowPulse * 0.28);
      c2.stroke();
      if (hit > 0) {
        circle(c2, 0, 0, 29.1);
        c2.lineWidth = 1.35;
        c2.globalAlpha = hit * 0.48;
        c2.strokeStyle = "#df7c6b";
        c2.stroke();
      }
    }
    if (mana && reserved > 0) {
      c2.save();
      circle(c2, 0, 0, r);
      c2.clip();
      const boundary = liquidLevel(1 - clamp3(reserved));
      c2.fillStyle = "#10101edf";
      c2.fillRect(-r, -r, r * 2, boundary + r);
      c2.save();
      c2.beginPath();
      c2.rect(-r, -r, r * 2, boundary + r);
      c2.clip();
      c2.strokeStyle = "#a394bd35";
      c2.lineWidth = 0.65;
      for (let i = -65; i < 65; i += 7) {
        c2.beginPath();
        c2.moveTo(i, -r);
        c2.lineTo(i + 36, r);
        c2.stroke();
      }
      c2.restore();
      c2.strokeStyle = "#c4b6d999";
      c2.lineWidth = 0.8;
      c2.beginPath();
      c2.moveTo(-r, boundary);
      c2.lineTo(r, boundary);
      c2.stroke();
      c2.restore();
    }
    c2.restore();
  }

  // src/hud-layout.ts
  var HUD_ART = Object.freeze({
    width: 520,
    height: 150,
    maxScale: 0.82,
    menu: Object.freeze({ x: 246, y: 31, width: 28, height: 28 }),
    skill: Object.freeze({ x: 134, y: 65, width: 40, height: 40, step: 42, count: 6 }),
    utility: Object.freeze({ left: 113, right: 379, y: 27, width: 28, height: 28 }),
    /** Racial active medallion (R key) seated in the right utility gap. */
    racial: Object.freeze({ x: 345, y: 27, width: 28, height: 28 }),
    orb: Object.freeze({ left: 74, right: 446, y: 70, scale: 1.18, readoutY: 122 }),
    inventory: Object.freeze({ skillY: 51, experienceY: 99, height: 136 }),
    experience: Object.freeze({ x: 133, y: 117, width: 254, height: 28, railHeight: 7 })
  });
  var HUD_SKILL_SLOTS = [
    { id: "basic", key: "LMB", action: "attack" },
    { id: "skill-1", key: "RMB", action: null },
    { id: "skill-2", key: "1", action: null },
    { id: "skill-3", key: "2", action: null },
    { id: "skill-4", key: "3", action: null },
    { id: "skill-5", key: "4", action: null }
  ];
  function getHUDLayout(width, height) {
    const scale = Math.max(0, Math.min(
      HUD_ART.maxScale,
      (width - 20) / HUD_ART.width,
      (height - 28) / HUD_ART.height
    ));
    const hudWidth = HUD_ART.width * scale, hudHeight = HUD_ART.height * scale;
    const x = (width - hudWidth) / 2, y = height - hudHeight - 14;
    const menu = HUD_ART.menu;
    return {
      x,
      y,
      width: hudWidth,
      height: hudHeight,
      scale,
      shortcuts: [{
        id: "menu",
        label: "Character menus",
        key: "",
        x: x + menu.x * scale,
        y: y + menu.y * scale,
        width: menu.width * scale,
        height: menu.height * scale
      }]
    };
  }

  // src/ui-art-cache.ts
  var caches = /* @__PURE__ */ new WeakMap();
  function drawCachedUIArt(c2, id, x, y, width, height, draw) {
    const transform = c2.getTransform();
    const density = Math.max(1, Math.ceil(Math.max(Math.hypot(transform.a, transform.b), Math.hypot(transform.c, transform.d)) * 4) / 4);
    let cache = caches.get(c2);
    if (!cache) {
      cache = /* @__PURE__ */ new Map();
      caches.set(c2, cache);
    }
    const key = `${id}:${density}`;
    let canvas = cache.get(key);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width * density);
      canvas.height = Math.ceil(height * density);
      const art = canvas.getContext("2d");
      art.setTransform(density, 0, 0, density, -x * density, -y * density);
      art.lineCap = c2.lineCap;
      art.lineJoin = c2.lineJoin;
      draw(art);
      if (cache.size >= 4) cache.delete(cache.keys().next().value);
      cache.set(key, canvas);
    }
    c2.drawImage(canvas, 0, 0, width * density, height * density, x, y, width, height);
  }

  // src/hud-energy.ts
  function drawHUDEnergy(c2, time) {
    for (const mana of [false, true]) {
      c2.save();
      c2.translate(mana ? HUD_ART.orb.right : HUD_ART.orb.left, HUD_ART.orb.y);
      c2.scale(mana ? -1 : 1, 1);
      c2.globalCompositeOperation = "screen";
      const color = mana ? "#58adff" : "#f05c7f";
      const core = mana ? "#9fddff" : "#ff9daa";
      const phase = time * 0.65 + (mana ? 2 : 0);
      const breath = 0.82 + Math.sin(phase) * 0.12;
      const halo2 = c2.createRadialGradient(32, 11, 3, 32, 11, 37);
      halo2.addColorStop(0, color + "60");
      halo2.addColorStop(0.5, color + "23");
      halo2.addColorStop(1, color + "00");
      c2.globalAlpha = breath;
      c2.fillStyle = halo2;
      c2.fillRect(-5, -26, 74, 74);
      for (const [width, alpha] of [[10, 0.065], [5, 0.2], [2, 0.78], [0.65, 0.95]]) {
        c2.beginPath();
        c2.arc(0, 0, 45.7, -0.87, 1.02);
        c2.lineWidth = width;
        c2.strokeStyle = width < 1 ? core : color;
        c2.globalAlpha = alpha * breath;
        c2.stroke();
      }
      for (let strand = 0; strand < 2; strand++) {
        const point = (t) => {
          const u = 1 - t;
          return {
            x: u ** 3 * 29 + 3 * u * u * t * 54 + 3 * u * t * t * 37 + t ** 3 * 102,
            y: u ** 3 * 35 + 3 * u * u * t * 39 + 3 * u * t * t * 63 + t ** 3 * 57 + Math.sin(t * Math.PI) * (Math.sin(phase + t * 5 + strand * 2) * 2.2 + strand * 4)
          };
        };
        const points = Array.from({ length: 19 }, (_, i) => point(i / 18));
        for (const [width, alpha] of [[8, 0.1], [3.1, 0.35], [0.85, 0.8]]) {
          c2.beginPath();
          for (const side of [1, -1]) for (let j = 0; j < points.length; j++) {
            const i = side === 1 ? j : points.length - 1 - j;
            const p2 = points[i], before = points[Math.max(0, i - 1)], after = points[Math.min(18, i + 1)];
            const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy);
            const taper2 = Math.sin((0.15 + i / 18 * 0.85) * Math.PI) * width * 0.5 * side;
            const x2 = p2.x - dy / length * taper2, y2 = p2.y + dx / length * taper2;
            if (side === 1 && j === 0) c2.moveTo(x2, y2);
            else c2.lineTo(x2, y2);
          }
          c2.closePath();
          c2.fillStyle = width < 1 ? core : color;
          c2.globalAlpha = alpha * breath * (strand ? 0.55 : 1);
          c2.fill();
        }
        for (let i = 0; i < 3; i++) {
          const t = (time * 0.22 + i / 3 + strand * 0.17) % 1, p2 = point(t);
          c2.globalAlpha = Math.sin(t * Math.PI) * 0.85;
          c2.fillStyle = core;
          c2.beginPath();
          c2.arc(p2.x, p2.y, 0.8 - t * 0.35, 0, Math.PI * 2);
          c2.fill();
        }
      }
      const angle = -0.83 + (time * 0.16 + (mana ? 0.45 : 0)) % 1 * 1.8;
      const x = Math.cos(angle) * 45.7, y = Math.sin(angle) * 45.7;
      const pulse = c2.createRadialGradient(x, y, 0, x, y, 5);
      pulse.addColorStop(0, core + "bb");
      pulse.addColorStop(0.25, color + "66");
      pulse.addColorStop(1, color + "00");
      c2.globalAlpha = breath;
      c2.fillStyle = pulse;
      c2.fillRect(x - 5, y - 5, 10, 10);
      c2.restore();
    }
  }

  // src/hud-frame.ts
  var TAU5 = Math.PI * 2;
  function path(c2, points) {
    c2.beginPath();
    c2.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c2.lineTo(points[i], points[i + 1]);
    c2.closePath();
  }
  function star2(c2, x, y, radius, silver = "#a8bfc5") {
    c2.beginPath();
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8 - Math.PI / 2;
      const r = i % 2 ? radius * 0.17 : i % 4 ? radius * 0.45 : radius;
      const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
      if (i === 0) c2.moveTo(px, py);
      else c2.lineTo(px, py);
    }
    c2.closePath();
    c2.fillStyle = silver;
    c2.fill();
  }
  function arc(c2, radius, start, end, color, width = 1) {
    c2.beginPath();
    c2.arc(0, 0, radius, start, end);
    c2.strokeStyle = color;
    c2.lineWidth = width;
    c2.stroke();
  }
  function metal(c2, top, bottom) {
    const gradient = c2.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, "#80969f");
    gradient.addColorStop(0.045, "#3b4f5b");
    gradient.addColorStop(0.13, "#233039");
    gradient.addColorStop(0.53, "#101b23");
    gradient.addColorStop(0.91, "#0a131b");
    gradient.addColorStop(1, "#344852");
    return gradient;
  }
  function orbMetal(c2, side) {
    c2.beginPath();
    c2.arc(0, 0, 43.5, 0, TAU5);
    c2.arc(0, 0, 37.5, 0, TAU5, true);
    c2.fillStyle = metal(c2, -44, 44);
    c2.fill("evenodd");
    arc(c2, 43.5, 0, TAU5, "#0a1119", 1.5);
    arc(c2, 42.7, Math.PI * 1.05, Math.PI * 1.95, "#a1b7be", 0.8);
    arc(c2, 42.6, 0.02, Math.PI * 0.98, "#405660", 0.7);
    arc(c2, 38.2, 0, TAU5, "#b4c8cc", 0.7);
    arc(c2, 39.3, 0, TAU5, "#07121b", 1);
    arc(c2, 40.8, 0, TAU5, "#425c68", 0.5);
    arc(c2, 49.7, Math.PI * 0.72, Math.PI * 2.28, "#12212c", 3.4);
    arc(c2, 50.8, Math.PI * 0.72, Math.PI * 2.28, "#627e89", 0.7);
    arc(c2, 47.8, Math.PI * 0.72, Math.PI * 2.28, "#283f4b", 0.7);
    for (let i = 0; i <= 40; i++) {
      const angle = Math.PI * (0.73 + i / 40 * 1.54);
      const major = i % 5 === 0, r = major ? 45.5 : 47.8;
      c2.beginPath();
      c2.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      c2.lineTo(Math.cos(angle) * 50.2, Math.sin(angle) * 50.2);
      c2.strokeStyle = major ? "#91aab1" : "#4f6977";
      c2.lineWidth = major ? 0.8 : 0.55;
      c2.stroke();
    }
    c2.beginPath();
    c2.ellipse(0, 0, 55.4, 41.9, side * -0.43, 0, TAU5);
    c2.strokeStyle = "#030a12";
    c2.lineWidth = 2.9;
    c2.stroke();
    c2.strokeStyle = "#66858f";
    c2.lineWidth = 0.85;
    c2.stroke();
    c2.beginPath();
    c2.ellipse(0, 0, 55.4, 41.9, side * -0.43, Math.PI * 1.06, Math.PI * 1.78);
    c2.strokeStyle = "#c1d2d4";
    c2.lineWidth = 0.85;
    c2.stroke();
    for (const angle of [Math.PI * 1.08, Math.PI * 1.83]) {
      const dx = Math.cos(angle) * 48.8, dy = Math.sin(angle) * 48.8;
      c2.beginPath();
      c2.arc(dx, dy, 2.5, 0, TAU5);
      c2.fillStyle = "#0c1721";
      c2.fill();
      c2.strokeStyle = "#809ba4";
      c2.lineWidth = 0.7;
      c2.stroke();
      c2.beginPath();
      c2.arc(dx, dy, 0.8, 0, TAU5);
      c2.fillStyle = "#c6d5d4";
      c2.fill();
    }
    path(c2, [-4, -52, 0, -58, 4, -52, 2.5, -45, -2.5, -45]);
    c2.fillStyle = "#101d2a";
    c2.fill();
    c2.strokeStyle = "#8ca8b2";
    c2.lineWidth = 0.8;
    c2.stroke();
    path(c2, [-1.7, -52, 0, -55.2, 1.7, -52, 0, -48]);
    c2.fillStyle = side < 0 ? "#6c9aaa" : "#82b0ac";
    c2.fill();
    const moonX = side * 25, moonY = -37.3;
    c2.beginPath();
    c2.arc(moonX, moonY, 3.6, -0.9, Math.PI * 1.1);
    c2.bezierCurveTo(moonX - 1.8, moonY + 2, moonX - 1, moonY - 2.4, moonX + 2.2, moonY - 2.8);
    c2.closePath();
    c2.fillStyle = "#afc4ca";
    c2.fill();
  }
  function orbGlint(c2, side, time) {
    const angle = Math.PI * (1.18 + 0.46 * (0.5 + 0.5 * Math.sin(time * 0.16 + side)));
    const glintX = Math.cos(angle) * 49.6, glintY = Math.sin(angle) * 49.6;
    const glow = c2.createRadialGradient(glintX, glintY, 0, glintX, glintY, 5);
    glow.addColorStop(0, "#a7d5d264");
    glow.addColorStop(1, "#79b8c000");
    c2.fillStyle = glow;
    c2.fillRect(glintX - 5, glintY - 5, 10, 10);
    star2(c2, glintX, glintY, 2.2, "#bdd8d9");
  }
  function drawHUDOrbFrame(c2, x, y, side, time) {
    c2.save();
    c2.translate(x, y);
    drawCachedUIArt(c2, `orb:${side}`, -60, -62, 120, 124, (art) => orbMetal(art, side));
    orbGlint(c2, side, time);
    c2.restore();
  }
  function actionTray(c2, inventory = false) {
    const skill = HUD_ART.skill, y = inventory ? HUD_ART.inventory.skillY : skill.y;
    const width = (skill.count - 1) * skill.step + skill.width;
    c2.fillStyle = "#0a121bea";
    c2.fillRect(skill.x - 3, y - 3, width + 6, skill.height + 6);
    c2.strokeStyle = "#52646c";
    c2.lineWidth = 0.7;
    c2.strokeRect(skill.x - 2.5, y - 2.5, width + 5, skill.height + 5);
  }
  function resourceShelf(c2, x) {
    c2.save();
    c2.translate(0, HUD_ART.orb.readoutY - 131);
    c2.beginPath();
    c2.moveTo(x - 34, 122);
    c2.quadraticCurveTo(x, 121, x + 34, 122);
    c2.lineTo(x + 30, 141);
    c2.quadraticCurveTo(x, 143, x - 30, 141);
    c2.closePath();
    c2.fillStyle = metal(c2, 121, 141);
    c2.fill();
    c2.strokeStyle = "#4a6573";
    c2.lineWidth = 0.8;
    c2.stroke();
    c2.beginPath();
    c2.moveTo(x - 25, 122);
    c2.quadraticCurveTo(x, 120.4, x + 25, 122);
    c2.strokeStyle = "#90aab3";
    c2.lineWidth = 0.65;
    c2.stroke();
    c2.beginPath();
    c2.moveTo(x - 20, 140);
    c2.quadraticCurveTo(x, 141.5, x + 20, 140);
    c2.strokeStyle = "#718e99";
    c2.lineWidth = 0.6;
    c2.stroke();
    c2.restore();
  }
  function drawHUDFrame(c2, time, inventory = false) {
    c2.save();
    c2.lineCap = "round";
    c2.lineJoin = "round";
    const t = Number.isFinite(time) ? time : 0;
    drawHUDEnergy(c2, t);
    drawCachedUIArt(c2, inventory ? "frame:inventory" : "frame", 0, 0, HUD_ART.width, HUD_ART.height, (art) => {
      art.lineCap = "round";
      art.lineJoin = "round";
      actionTray(art, inventory);
      for (const side of [-1, 1]) {
        art.save();
        art.translate(side < 0 ? HUD_ART.orb.left : HUD_ART.orb.right, HUD_ART.orb.y);
        orbMetal(art, side);
        art.restore();
      }
      resourceShelf(art, HUD_ART.orb.left);
      resourceShelf(art, HUD_ART.orb.right);
    });
    for (const side of [-1, 1]) {
      c2.save();
      c2.translate(side < 0 ? HUD_ART.orb.left : HUD_ART.orb.right, HUD_ART.orb.y);
      orbGlint(c2, side, t);
      c2.restore();
    }
    c2.restore();
  }

  // src/progression.ts
  function xpForNextLevel(level) {
    const current = normalizeLevel(level), n = current - 1;
    const stalkerReward = Math.round(20 * monsterExperienceScale(current));
    const afterIntro = Math.max(0, current - 4);
    const pacing = 1 + 2 * afterIntro / (afterIntro + 3);
    return Math.round(stalkerReward * (5 + 2 * n ** 0.8) * pacing / 5) * 5;
  }

  // src/rested.ts
  var RESTED_RULES = Object.freeze({
    /** One level of rested pool per five minutes inside a sanctuary (WoW accrues 5% of a level per 8h offline/resting). */
    levelsPerSecond: 1 / 300,
    capLevels: 1.5
  });
  var RESTED_RAIL_COLOR = "#7fb0e8";
  function restedDisplay(player) {
    const needed = xpForNextLevel(player.level);
    const pool2 = Math.max(0, player.restedXp ?? 0);
    return { fill: Math.min(1, (Math.max(0, player.xp) + pool2) / needed), xp: pool2 };
  }

  // src/game-features.ts
  var GAME_FEATURES = {
    battleBarks: true,
    // WoW deepening (docs/wow-deepening.md)
    quests: true,
    mounts: true,
    professions: true,
    lootBeams: true,
    actionBars: true,
    hearthstone: true,
    currency: true,
    combatLog: true,
    minimapTracking: true,
    bossWarnings: true,
    achievements: true,
    durability: true,
    fishing: true,
    glyphs: true,
    raidBoss: true,
    dungeon2: true,
    // Wave C (docs/wow-deepening.md, second pass)
    spellbook: true,
    itemSets: true,
    reputation: true,
    castBars: true,
    bags: true,
    spellVfx: true,
    // Wave D (docs/wow-deepening.md, third pass)
    transmog: true,
    worldEvents: true,
    nameplates: true,
    dualSpec: true
  };

  // src/hud-experience.ts
  function railPath(c2, x, y, w, h, cut2) {
    c2.beginPath();
    c2.moveTo(x + cut2, y);
    c2.lineTo(x + w - cut2, y);
    c2.lineTo(x + w, y + cut2);
    c2.lineTo(x + w, y + h - cut2);
    c2.lineTo(x + w - cut2, y + h);
    c2.lineTo(x + cut2, y + h);
    c2.lineTo(x, y + h - cut2);
    c2.lineTo(x, y + cut2);
    c2.closePath();
  }
  function drawHUDExperience(c2, player, time, display, y = HUD_ART.experience.y) {
    const { x, width: w, height: h, railHeight: rh } = HUD_ART.experience;
    const needed = xpForNextLevel(display?.level ?? player.level);
    const fill = Math.max(0, Math.min(1, display?.fill ?? player.xp / needed));
    const pulse = Math.max(0, Math.min(1, display?.pulse ?? 0));
    const ui = UI_THEME.palette;
    c2.save();
    const top = y - 0.5, height = rh + 2, corner = 2.6, inset = 1.35;
    const bx = x + inset, by = top + inset, bw = w - inset * 2, bh = height - inset * 2;
    const innerCorner = corner - inset * (2 - Math.SQRT2);
    c2.lineJoin = "round";
    railPath(c2, x, top + 1, w, height, corner);
    c2.fillStyle = "#03081090";
    c2.fill();
    railPath(c2, x, top, w, height, corner);
    const metal2 = c2.createLinearGradient(0, top, 0, top + height);
    metal2.addColorStop(0, "#637985");
    metal2.addColorStop(0.25, "#344954");
    metal2.addColorStop(1, "#1a2a35");
    c2.fillStyle = metal2;
    c2.fill();
    c2.strokeStyle = "#748894";
    c2.lineWidth = 0.5;
    c2.stroke();
    railPath(c2, bx, by, bw, bh, innerCorner);
    c2.fillStyle = "#060c15";
    c2.fill();
    c2.save();
    c2.clip();
    if (fill > 0) {
      const enamel = c2.createLinearGradient(0, by, 0, by + bh);
      enamel.addColorStop(0, "#d3c5f4");
      enamel.addColorStop(0.2, "#a798d6");
      enamel.addColorStop(0.6, "#7767a7");
      enamel.addColorStop(1, "#3c355c");
      c2.fillStyle = enamel;
      c2.fillRect(bx, by, bw * fill, bh);
      c2.save();
      c2.beginPath();
      c2.rect(bx, by, bw * fill, bh);
      c2.clip();
      const gleamX = bx + bw * fill - 2;
      const gleam = c2.createRadialGradient(gleamX, by + 2, 0, gleamX, by + 2, 8);
      gleam.addColorStop(0, "#efe3ff" + Math.round(90 + pulse * 120).toString(16).padStart(2, "0"));
      gleam.addColorStop(1, "#d2bfff00");
      c2.fillStyle = gleam;
      c2.fillRect(gleamX - 8, by, 16, bh);
      c2.fillStyle = "#eee4ff";
      c2.globalAlpha = 0.25 + Math.sin(time * 1.5) * 0.08;
      c2.fillRect(bx, by, bw * fill, 0.6);
      c2.restore();
    }
    const pendingFill = Math.max(fill, Math.min(1, display?.pendingFill ?? fill));
    if (pendingFill > fill) {
      const pending = c2.createLinearGradient(bx, by, bx, by + bh);
      pending.addColorStop(0, "#ead8ffbf");
      pending.addColorStop(0.5, "#ba93ef80");
      pending.addColorStop(1, "#8063b944");
      c2.fillStyle = pending;
      c2.fillRect(bx + bw * fill, by, bw * (pendingFill - fill), bh);
      c2.fillStyle = "#f5e7ff";
      c2.globalAlpha = 0.65;
      c2.fillRect(bx + bw * pendingFill - 0.7, by, 0.7, bh);
      c2.globalAlpha = 1;
    }
    const rested = GAME_FEATURES.hearthstone ? restedDisplay(player) : { fill: 0, xp: 0 };
    if (rested.xp > 0 && rested.fill > Math.max(fill, pendingFill)) {
      const restedFill = Math.min(1, rested.fill);
      c2.fillStyle = RESTED_RAIL_COLOR + "55";
      c2.fillRect(bx + bw * Math.max(fill, pendingFill), by, bw * (restedFill - Math.max(fill, pendingFill)), bh);
      c2.fillStyle = RESTED_RAIL_COLOR;
      c2.globalAlpha = 0.8;
      c2.fillRect(bx + bw * restedFill - 0.7, by, 0.7, bh);
      c2.globalAlpha = 1;
    }
    for (let i = 1; i < 4; i++) {
      c2.fillStyle = "#b3bdce50";
      c2.fillRect(bx + bw * i / 4, by + bh - 1.2, 0.5, 1.2);
    }
    c2.restore();
    railPath(c2, bx, by, bw, bh, innerCorner);
    c2.strokeStyle = "#020710b8";
    c2.lineWidth = 0.55;
    c2.stroke();
    c2.beginPath();
    c2.moveTo(x + corner + 1, top + 0.4);
    c2.lineTo(x + w - corner - 1, top + 0.4);
    c2.strokeStyle = "#c4d2d747";
    c2.lineWidth = 0.4;
    c2.stroke();
    if (pulse > 0) {
      c2.globalAlpha = pulse * 0.55;
      railPath(c2, bx, by, bw, bh, innerCorner);
      c2.strokeStyle = "#dcd0ff";
      c2.lineWidth = 0.65;
      c2.stroke();
      c2.globalAlpha = 1;
    }
    const cy = y + h - 10;
    c2.beginPath();
    c2.moveTo(x + 5, cy - 3);
    c2.lineTo(x + 8, cy);
    c2.lineTo(x + 5, cy + 3);
    c2.lineTo(x + 2, cy);
    c2.closePath();
    c2.fillStyle = "#13202c";
    c2.fill();
    c2.strokeStyle = "#9c9ebc";
    c2.lineWidth = 0.65;
    c2.stroke();
    const level = `LV ${display?.level ?? player.level}`, amount = `${display?.xp ?? player.xp} / ${needed} XP`;
    const size = Math.min(1.04, (w - 24) / Math.max(1, textWidth(level) + textWidth(amount)));
    text(c2, level, x + 13, cy - 3.85 * size, size, pulse > 0.6 ? "#e9ddff" : ui.silver);
    text(c2, amount, x + w - 2, cy - 3.85 * size, size, "#b5accb", "right");
    if (display && display.pending > 0) text(c2, `+${display.pending} XP`, x + w / 2, y - 8, 0.8, "#e2caff", "center");
    c2.restore();
  }

  // src/wow-classes.ts
  var WOW_CLASSES = Object.freeze({
    warrior: Object.freeze({
      id: "warrior",
      name: "Warrior",
      color: "#C79C6E",
      resource: "rage",
      resourceLabel: "Rage",
      resourceCap: 100,
      resourceRegen: 0,
      resourceDecay: 3,
      gainOnDeal: 3,
      gainOnHit: 2,
      gcd: 1.5,
      armorStyle: "plate",
      starter: { weapon: "weathered-sword" },
      starterSkill: "heroicStrike",
      description: "A master of arms who turns rage into devastating blows. Stalwart in plate, deadly with any weapon.",
      roles: ["Melee damage", "Tank"]
    }),
    paladin: Object.freeze({
      id: "paladin",
      name: "Paladin",
      color: "#F58CBA",
      resource: "mana",
      resourceLabel: "Mana",
      resourceCap: 0,
      resourceRegen: 0,
      resourceDecay: 0,
      gainOnDeal: 0,
      gainOnHit: 0,
      gcd: 1.5,
      armorStyle: "plate",
      starter: { weapon: "longsword", offhand: "iron-buckler" },
      starterSkill: "crusaderStrike",
      description: "A holy knight wielding the Light to smite foes and mend wounds. Blessed plate and righteous fury.",
      roles: ["Melee damage", "Healing", "Tank"]
    }),
    hunter: Object.freeze({
      id: "hunter",
      name: "Hunter",
      color: "#ABD473",
      resource: "mana",
      resourceLabel: "Mana",
      resourceCap: 0,
      resourceRegen: 0,
      resourceDecay: 0,
      gainOnDeal: 0,
      gainOnHit: 0,
      gcd: 1.5,
      armorStyle: "leather",
      starter: { weapon: "thorn-shortbow" },
      starterSkill: "arcaneShot",
      description: "A master of the wild who strikes from afar beside a loyal beast. Tracks, traps and deadly aim.",
      roles: ["Ranged damage", "Pet"]
    }),
    rogue: Object.freeze({
      id: "rogue",
      name: "Rogue",
      color: "#FFF569",
      resource: "energy",
      resourceLabel: "Energy",
      resourceCap: 100,
      resourceRegen: 10,
      resourceDecay: 0,
      gainOnDeal: 0,
      gainOnHit: 0,
      gcd: 1,
      armorStyle: "leather",
      starter: { weapon: "rondel-dagger" },
      starterSkill: "sinisterStrike",
      description: "A shadow striking from stealth. Builds combo points, then finishes with lethal precision.",
      roles: ["Melee damage", "Stealth"]
    }),
    priest: Object.freeze({
      id: "priest",
      name: "Priest",
      color: "#FFFFFF",
      resource: "mana",
      resourceLabel: "Mana",
      resourceCap: 0,
      resourceRegen: 0,
      resourceDecay: 0,
      gainOnDeal: 0,
      gainOnHit: 0,
      gcd: 1.5,
      armorStyle: "cloth",
      starter: { weapon: "star-wand", offhand: "astral-grimoire" },
      starterSkill: "smite",
      description: "A wielder of holy and shadow magic. Mends allies, shields the faithful, and unmakes minds.",
      roles: ["Healing", "Spell damage"]
    }),
    deathKnight: Object.freeze({
      id: "deathKnight",
      name: "Death Knight",
      color: "#C41F3B",
      resource: "runicPower",
      resourceLabel: "Runic Power",
      resourceCap: 100,
      resourceRegen: 0,
      resourceDecay: 3,
      gainOnDeal: 0,
      gainOnHit: 0,
      gcd: 1.5,
      armorStyle: "plate",
      starter: { weapon: "greatblade" },
      starterSkill: "icyTouch",
      description: "A fallen champion commanding runes of blood, frost and unholy power. Death follows in their wake.",
      roles: ["Melee damage", "Tank"]
    }),
    shaman: Object.freeze({
      id: "shaman",
      name: "Shaman",
      color: "#0070DE",
      resource: "mana",
      resourceLabel: "Mana",
      resourceCap: 0,
      resourceRegen: 0,
      resourceDecay: 0,
      gainOnDeal: 0,
      gainOnHit: 0,
      gcd: 1.5,
      armorStyle: "leather",
      starter: { weapon: "flanged-mace" },
      starterSkill: "lightningBolt",
      description: "A conduit of the elements. Calls lightning, fire and totems, and mends with ancestral waters.",
      roles: ["Spell damage", "Melee damage", "Healing"]
    }),
    mage: Object.freeze({
      id: "mage",
      name: "Mage",
      color: "#69CCF0",
      resource: "mana",
      resourceLabel: "Mana",
      resourceCap: 0,
      resourceRegen: 0,
      resourceDecay: 0,
      gainOnDeal: 0,
      gainOnHit: 0,
      gcd: 1.5,
      armorStyle: "cloth",
      starter: { weapon: "ember-staff" },
      starterSkill: "frostbolt",
      description: "A scholar of the arcane. Burns, freezes and blasts enemies apart before they ever reach melee.",
      roles: ["Spell damage", "Control"]
    }),
    warlock: Object.freeze({
      id: "warlock",
      name: "Warlock",
      color: "#9482C9",
      resource: "mana",
      resourceLabel: "Mana",
      resourceCap: 0,
      resourceRegen: 0,
      resourceDecay: 0,
      gainOnDeal: 0,
      gainOnHit: 0,
      gcd: 1.5,
      armorStyle: "cloth",
      starter: { weapon: "cinder-wand", offhand: "cinder-orb" },
      starterSkill: "shadowBolt",
      description: "A channeler of fel and shadow. Corrupts enemies with curses while demons do their bidding.",
      roles: ["Spell damage", "Pet"]
    }),
    druid: Object.freeze({
      id: "druid",
      name: "Druid",
      color: "#FF7D0A",
      resource: "mana",
      resourceLabel: "Mana",
      resourceCap: 0,
      resourceRegen: 0,
      resourceDecay: 0,
      gainOnDeal: 0,
      gainOnHit: 0,
      gcd: 1.5,
      armorStyle: "leather",
      starter: { weapon: "rime-staff" },
      starterSkill: "wrath",
      description: "A shapeshifting guardian of nature. Casts wrath and starfire, heals, or fights as bear and cat \u2014 Bear Form swaps mana for rage, Cat Form for energy and combo points.",
      roles: ["Spell damage", "Healing", "Tank", "Melee damage"]
    })
  });
  var RESOURCE_COLORS = Object.freeze({
    mana: "#3d6fd1",
    rage: "#c0392b",
    energy: "#e8c93a",
    runicPower: "#5aa7d6"
  });

  // src/wow-allies.ts
  var ALLY_TEMPLATES = Object.freeze({
    imp: Object.freeze({ kind: "imp", name: "Imp", hpFraction: 0.25, damageFraction: 0.35, stationary: false, radius: 10, attackInterval: 1.8, attackRange: 280, color: "#e05a3a", ability: "Firebolt \xB7 Blood Pact" }),
    felhunter: Object.freeze({ kind: "felhunter", name: "Felhunter", hpFraction: 0.4, damageFraction: 0.45, stationary: false, radius: 12, attackInterval: 1.5, attackRange: 0, color: "#7a4fd0", ability: "Shadow Bite \xB7 Spell Lock" }),
    felguard: Object.freeze({ kind: "felguard", name: "Felguard", hpFraction: 0.6, damageFraction: 0.7, stationary: false, radius: 14, attackInterval: 1.6, attackRange: 0, color: "#5a3fb0", ability: "Cleave \xB7 Intercept" }),
    voidwalker: Object.freeze({ kind: "voidwalker", name: "Voidwalker", hpFraction: 0.8, damageFraction: 0.3, stationary: false, radius: 14, attackInterval: 2, attackRange: 0, color: "#3a2f80", ability: "Torment \xB7 Consume Shadows" }),
    doomguard: Object.freeze({ kind: "doomguard", name: "Doomguard", hpFraction: 0.9, damageFraction: 0.75, stationary: false, radius: 15, attackInterval: 1.7, attackRange: 0, color: "#7a3a4a", ability: "War Stomp \xB7 Rain of Fire" }),
    succubus: Object.freeze({ kind: "succubus", name: "Succubus", hpFraction: 0.4, damageFraction: 0.55, stationary: false, radius: 11, attackInterval: 1.6, attackRange: 0, color: "#c05a8a", ability: "Lash of Pain \xB7 Seduction" }),
    wolf: Object.freeze({ kind: "wolf", name: "Wolf", hpFraction: 0.5, damageFraction: 0.5, stationary: false, radius: 11, attackInterval: 1.4, attackRange: 0, color: "#8a7a5a" }),
    bear: Object.freeze({ kind: "bear", name: "Bear", hpFraction: 0.8, damageFraction: 0.4, stationary: false, radius: 14, attackInterval: 1.8, attackRange: 0, color: "#6a5a42" }),
    cat: Object.freeze({ kind: "cat", name: "Cat", hpFraction: 0.4, damageFraction: 0.6, stationary: false, radius: 10, attackInterval: 1.2, attackRange: 0, color: "#a08a5a" }),
    boar: Object.freeze({ kind: "boar", name: "Boar", hpFraction: 0.7, damageFraction: 0.4, stationary: false, radius: 12, attackInterval: 1.6, attackRange: 0, color: "#7a6248" }),
    raptor: Object.freeze({ kind: "raptor", name: "Raptor", hpFraction: 0.45, damageFraction: 0.55, stationary: false, radius: 11, attackInterval: 1.3, attackRange: 0, color: "#5a7a4a" }),
    spider: Object.freeze({ kind: "spider", name: "Spider", hpFraction: 0.4, damageFraction: 0.45, stationary: false, radius: 10, attackInterval: 1.4, attackRange: 0, color: "#4a4a52" }),
    bird: Object.freeze({ kind: "bird", name: "Carrion Bird", hpFraction: 0.35, damageFraction: 0.5, stationary: false, radius: 9, attackInterval: 1.3, attackRange: 0, color: "#8a94a0" }),
    windSerpent: Object.freeze({ kind: "windSerpent", name: "Wind Serpent", hpFraction: 0.35, damageFraction: 0.5, stationary: false, radius: 10, attackInterval: 1.7, attackRange: 240, color: "#5aa08a" }),
    scorpid: Object.freeze({ kind: "scorpid", name: "Scorpid", hpFraction: 0.55, damageFraction: 0.45, stationary: false, radius: 11, attackInterval: 1.6, attackRange: 0, color: "#8a5a3a" }),
    turtle: Object.freeze({ kind: "turtle", name: "Turtle", hpFraction: 0.85, damageFraction: 0.3, stationary: false, radius: 12, attackInterval: 2, attackRange: 0, color: "#4a7a5a" }),
    ghoul: Object.freeze({ kind: "ghoul", name: "Ghoul", hpFraction: 0.35, damageFraction: 0.4, stationary: false, radius: 11, attackInterval: 1.5, attackRange: 0, color: "#7a8a6a" }),
    waterElemental: Object.freeze({ kind: "waterElemental", name: "Water Elemental", hpFraction: 0.4, damageFraction: 0.45, stationary: false, radius: 12, attackInterval: 1.7, attackRange: 260, color: "#4a9ad0" }),
    earthElemental: Object.freeze({ kind: "earthElemental", name: "Earth Elemental", hpFraction: 1, damageFraction: 0.5, stationary: false, radius: 15, attackInterval: 1.8, attackRange: 0, color: "#8a7a52", ability: "Taunt \xB7 Hardened Skin" }),
    fireElemental: Object.freeze({ kind: "fireElemental", name: "Fire Elemental", hpFraction: 0.6, damageFraction: 0.7, stationary: false, radius: 13, attackInterval: 1.6, attackRange: 260, color: "#e06a3a", ability: "Fire Nova \xB7 Fire Blast" }),
    treant: Object.freeze({ kind: "treant", name: "Treant", hpFraction: 0.5, damageFraction: 0.4, stationary: false, radius: 12, attackInterval: 1.7, attackRange: 0, color: "#5a8a4a" }),
    shadowfiend: Object.freeze({ kind: "shadowfiend", name: "Shadowfiend", hpFraction: 0.3, damageFraction: 0.45, stationary: false, radius: 10, attackInterval: 1.4, attackRange: 0, color: "#4a3a70", ability: "Mana return on hit" }),
    gargoyle: Object.freeze({ kind: "gargoyle", name: "Gargoyle", hpFraction: 0.4, damageFraction: 0.6, stationary: false, radius: 11, attackInterval: 1.5, attackRange: 280, color: "#6a7a8a", ability: "Gargoyle Strike" }),
    mirrorImage: Object.freeze({ kind: "mirrorImage", name: "Mirror Image", hpFraction: 0.15, damageFraction: 0.25, stationary: false, radius: 10, attackInterval: 2, attackRange: 300, color: "#9ab8e0" }),
    searingTotem: Object.freeze({ kind: "searingTotem", name: "Searing Totem", hpFraction: 0.1, damageFraction: 0.3, stationary: true, radius: 8, attackInterval: 2, attackRange: 260, color: "#e07a3a" }),
    healingTotem: Object.freeze({ kind: "healingTotem", name: "Healing Stream Totem", hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: "#4ac0a0", aura: { kind: "heal", amount: 0.02, radius: 140 } }),
    earthbindTotem: Object.freeze({ kind: "earthbindTotem", name: "Earthbind Totem", hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: "#a08a4a", aura: { kind: "slow", amount: 0.5, radius: 140 } }),
    magmaTotem: Object.freeze({ kind: "magmaTotem", name: "Magma Totem", hpFraction: 0.1, damageFraction: 0.35, stationary: true, radius: 8, attackInterval: 2.2, attackRange: 120, color: "#e04a2a" }),
    manaSpringTotem: Object.freeze({ kind: "manaSpringTotem", name: "Mana Spring Totem", hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: "#4a7ad0", aura: { kind: "mana", amount: 0.015, radius: 140 } }),
    totemOfWrath: Object.freeze({ kind: "totemOfWrath", name: "Totem of Wrath", hpFraction: 0.1, damageFraction: 0.3, stationary: true, radius: 8, attackInterval: 2, attackRange: 260, color: "#e0a03a", aura: { kind: "buff", amount: 0, radius: 140, stats: { spellDamagePercent: 6 } } }),
    wrathOfAirTotem: Object.freeze({ kind: "wrathOfAirTotem", name: "Wrath of Air Totem", hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: "#9ad0e0", aura: { kind: "buff", amount: 0, radius: 140, stats: { castSpeedPercent: 5 } } }),
    windfuryTotem: Object.freeze({ kind: "windfuryTotem", name: "Windfury Totem", hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: "#7ac0a0", aura: { kind: "buff", amount: 0, radius: 140, stats: { attackSpeedPercent: 8 } } }),
    strengthOfEarthTotem: Object.freeze({ kind: "strengthOfEarthTotem", name: "Strength of Earth Totem", hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: "#a0784a", aura: { kind: "buff", amount: 0, radius: 140, stats: { strength: 6 } } }),
    stoneskinTotem: Object.freeze({ kind: "stoneskinTotem", name: "Stoneskin Totem", hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: "#8a8a7a", aura: { kind: "buff", amount: 0, radius: 140, stats: { armor: 8 } } }),
    flametongueTotem: Object.freeze({ kind: "flametongueTotem", name: "Flametongue Totem", hpFraction: 0.1, damageFraction: 0.3, stationary: true, radius: 8, attackInterval: 2, attackRange: 260, color: "#e08a3a" }),
    tremorTotem: Object.freeze({ kind: "tremorTotem", name: "Tremor Totem", hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: "#b09a6a", aura: { kind: "ccBreak", amount: 1.5, radius: 140 } }),
    cleansingTotem: Object.freeze({ kind: "cleansingTotem", name: "Cleansing Totem", hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: "#6ac0b0", aura: { kind: "cleanse", amount: 0, radius: 140 } }),
    groundingTotem: Object.freeze({ kind: "groundingTotem", name: "Grounding Totem", hpFraction: 0.1, damageFraction: 0, stationary: true, radius: 8, attackInterval: 99, attackRange: 0, color: "#7a9ad0", aura: { kind: "absorb", amount: 0.06, radius: 140 } }),
    spiritWolf: Object.freeze({ kind: "spiritWolf", name: "Spirit Wolf", hpFraction: 0.45, damageFraction: 0.55, stationary: false, radius: 11, attackInterval: 1.3, attackRange: 0, color: "#7ab8e0" }),
    infernal: Object.freeze({ kind: "infernal", name: "Infernal", hpFraction: 0.9, damageFraction: 0.8, stationary: false, radius: 16, attackInterval: 1.8, attackRange: 0, color: "#4ae07a" })
  });

  // src/hud.ts
  var UI = UI_THEME.palette;
  var TAU6 = Math.PI * 2;
  var clamp4 = (n) => Math.max(0, Math.min(1, n));
  function mixHex(a, b, amount) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), t = clamp4(amount);
    const mix = (shift) => Math.round((pa >> shift & 255) + ((pb >> shift & 255) - (pa >> shift & 255)) * t);
    return `#${(1 << 24 | mix(16) << 16 | mix(8) << 8 | mix(0)).toString(16).slice(1)}`;
  }
  function healthColor(ratio) {
    const r = clamp4(ratio);
    return r < 0.5 ? mixHex("#c0392b", "#e8c93a", r * 2) : mixHex("#e8c93a", "#7fd06a", (r - 0.5) * 2);
  }
  function wowClass(p2) {
    const id = "classId" in p2.character ? p2.character.classId : void 0;
    return isWowClassId(id) ? WOW_CLASSES[id] : null;
  }
  function racialSkill(p2) {
    const id = "raceId" in p2.character ? p2.character.raceId : void 0;
    return isWowRaceId(id) ? WOW_RACES[id].racial : null;
  }
  function skillIconSafe(c2, id, x, y, size) {
    if (SKILL_ICON_RECIPES[id]) {
      drawSkillIcon(c2, id, x, y, size);
      return;
    }
    const color = SKILL_DEFINITIONS[id]?.color ?? "#9db8c7";
    c2.fillStyle = shade(color, -0.55);
    c2.fillRect(x - size / 2, y - size / 2, size, size);
    c2.strokeStyle = color;
    c2.lineWidth = 0.8;
    c2.strokeRect(x - size / 2 + 0.5, y - size / 2 + 0.5, size - 1, size - 1);
    text(c2, (SKILL_DEFINITIONS[id]?.name ?? "?")[0], x, y - size * 0.26, size / 11 * 0.9, shade(color, 0.45), "center");
  }
  function polygon3(c2, points) {
    c2.beginPath();
    c2.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c2.lineTo(points[i], points[i + 1]);
    c2.closePath();
  }
  function chamfer(c2, x, y, w, h, cut2 = 3) {
    polygon3(c2, [
      x + cut2,
      y,
      x + w - cut2,
      y,
      x + w,
      y + cut2,
      x + w,
      y + h - cut2,
      x + w - cut2,
      y + h,
      x + cut2,
      y + h,
      x,
      y + h - cut2,
      x,
      y + cut2
    ]);
  }
  function skills(c2, p2, time, gamepad = false, groundEffects = [], inventory = false, simTime) {
    const field = HUD_ART.skill;
    const cls = wowClass(p2), costColor = cls ? shade(RESOURCE_COLORS[cls.resource], 0.35) : "#91bddd";
    const gcd = simTime !== void 0 ? Math.max(0, (p2.gcdReady ?? 0) - simTime) : 0;
    const gcdDuration = cls?.gcd ?? WOW_COMBAT.gcdDefault;
    for (const [i] of HUD_SKILL_SLOTS.entries()) {
      const x = field.x + i * field.step, y = inventory ? HUD_ART.inventory.skillY : field.y, w = field.width, h = field.height;
      const skill = i > 0 ? p2.character.skillSlots[i - 1] : null;
      const definition = skill ? SKILL_DEFINITIONS[skill] : null;
      const returning = skill === "lunge" ? lungeReturn(p2) : void 0;
      const cooldown = skill && !returning ? p2.skillCooldowns[skill] ?? 0 : 0;
      const sustain = skillSustain(skill, p2, groundEffects);
      const occupied = i === 0 || !!skill, active = i === 0 ? !!p2.attack : !!skill && (p2.activeSkill === skill || !!sustain || isAura(skill) && auraPower(p2, skill) > 0);
      const compatible = !skill || canUseSkill(skill, p2.equipment);
      const resolved = skill ? resolveSkill(skill, p2.derived, p2.character) : null;
      const manaCost = returning ? 0 : resolved?.mana ?? (i === 0 ? basicAttackManaCost(basicAttackWeapon(p2), p2.derived) : 0);
      const weaveWeapon = skill ? skillWeapon(skill, p2.equipment) : basicAttackWeapon(p2);
      const weaveKind = definition?.requirement === "magic" || weaveWeapon?.attackKind === "bolt" ? "spell" : weaveWeapon?.attackKind === "melee" ? "melee" : null;
      const weaveReady = occupied && !returning && canSpellweave(p2) && weaveKind && (p2.affixBuffs?.[weaveKind] ?? 0) > 0 && (!definition || definition.damageMultiplier > 0);
      const usable = !p2.dead && compatible && cooldown <= 0 && p2.mana >= manaCost;
      c2.save();
      chamfer(c2, x, y, w, h, 1);
      const well = c2.createLinearGradient(x, y, x, y + h);
      well.addColorStop(0, occupied ? UI.steel : "#101a23");
      well.addColorStop(1, UI.steelDeep);
      c2.fillStyle = well;
      c2.fill();
      c2.strokeStyle = active ? "#c4ad7a" : occupied ? UI.silverDim : "#415763";
      c2.lineWidth = 0.8;
      c2.stroke();
      c2.strokeStyle = occupied ? UI.silver + "60" : "#52697670";
      c2.beginPath();
      c2.moveTo(x + 4, y + 1.5);
      c2.lineTo(x + w - 4, y + 1.5);
      c2.stroke();
      if (occupied) {
        const glow = c2.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 20);
        glow.addColorStop(0, active ? "#d3ba8035" : "#d3ba8015");
        glow.addColorStop(1, "#d3ba8000");
        c2.fillStyle = glow;
        c2.fillRect(x + 1, y + 2, w - 2, h - 4);
        c2.globalAlpha = usable ? 1 : 0.42;
        c2.save();
        c2.beginPath();
        c2.rect(x + 2, y + 2, w - 4, h - 4);
        c2.clip();
        c2.translate(x + w / 2, y + h / 2);
        if (skill) skillIconSafe(c2, skill, 0, 0, w - 2);
        else if (basicAttackWeapon(p2).family === "unarmed") drawHUDSkillIcon(c2, 0, 0, 0, time, active);
        else drawHUDWeapon(c2, basicAttackWeapon(p2).visual, w - 7);
        c2.restore();
        c2.globalAlpha = 1;
        if (!compatible) {
          c2.fillStyle = "#dc9a87";
          c2.beginPath();
          c2.moveTo(x + 3, y + 3);
          c2.lineTo(x + 9, y + 3);
          c2.lineTo(x + 3, y + 9);
          c2.closePath();
          c2.fill();
        } else if (resolved?.reservation) {
          text(c2, `${Number(resolved.reservation.toFixed(1))}%`, x + w - 4, y + 3, 0.65, "#c6bbdd", "right");
        } else if (skill === "piercingShot" && p2.skillEffects?.draw) {
          const draw = p2.skillEffects.draw;
          text(c2, draw.elapsed >= UNIQUE_RULES.drawTime ? "READY" : `${Math.round(draw.elapsed / UNIQUE_RULES.drawTime * 100)}%`, x + w / 2, y + h / 2 - 4, 0.75, "#d4e7ba", "center");
        } else if (returning) {
          text(c2, "RETURN", x + w / 2, y + h / 2 - 9, 0.65, "#d2bee6", "center");
          text(c2, `${returning.remaining.toFixed(1)}s`, x + w / 2, y + h / 2 + 1, 0.7, "#d2bee6", "center");
        } else if (definition && cooldown > 0) {
          c2.fillStyle = "#030a10a8";
          c2.fillRect(x + 2, y + 2, w - 4, (h - 4) * clamp4(cooldown / Math.max(1e-3, resolved.cooldown)));
          text(c2, cooldown.toFixed(1), x + w / 2, y + h / 2 - 4, 1.3, UI.ivory, "center");
        } else if (manaCost > 0) text(c2, String(manaCost), x + w - 5, y + 3, 0.8, costColor, "right");
        if (gcd > 0 && !definition?.offGcd) {
          const sweep = -Math.PI / 2 + TAU6 * clamp4(gcd / gcdDuration);
          c2.save();
          c2.beginPath();
          c2.rect(x + 2, y + 2, w - 4, h - 4);
          c2.clip();
          c2.fillStyle = "#030a1090";
          c2.beginPath();
          c2.moveTo(x + w / 2, y + h / 2);
          c2.arc(x + w / 2, y + h / 2, w * 0.72, -Math.PI / 2, sweep);
          c2.closePath();
          c2.fill();
          c2.strokeStyle = "#e8f0f4b8";
          c2.lineWidth = 1.3;
          c2.beginPath();
          c2.moveTo(x + w / 2, y + h / 2);
          c2.lineTo(x + w / 2 + Math.cos(sweep) * w * 0.72, y + h / 2 + Math.sin(sweep) * w * 0.72);
          c2.stroke();
          c2.restore();
        }
      }
      if (sustain) {
        if (sustain.upkeep) text(c2, `${sustain.upkeep}/s`, x + w - 4, y + 3, 0.65, "#91bddd", "right");
        text(c2, `${sustain.remaining.toFixed(1)}s`, x + w / 2, y + h / 2 - 3, 0.76, "#adead2", "center");
      }
      const binding = gamepad ? PAD_SKILL_LABELS[i] : controls.label(i === 0 ? "attack" : SKILL_ACTIONS[i - 1]);
      const keyScale = Math.min(0.82, 31 / Math.max(1, textWidth(binding)));
      const badgeWidth = textWidth(binding) * keyScale + 5;
      c2.fillStyle = "#07111de8";
      c2.fillRect(x + w - badgeWidth - 1, y + h - 10, badgeWidth, 9);
      text(
        c2,
        binding,
        x + w - 3,
        y + h - 9,
        keyScale,
        occupied && !p2.dead ? UI.text : "#718490",
        "right"
      );
      if (weaveReady && usable) {
        c2.strokeStyle = weaveKind === "spell" ? "#d8b4ff" : "#f4d69a";
        c2.lineWidth = 1.5;
        c2.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
        c2.fillStyle = c2.strokeStyle;
        c2.beginPath();
        c2.arc(x + 5, y + 5, 2, 0, TAU6);
        c2.fill();
      }
      if (active) {
        c2.fillStyle = "#c4ad7a";
        c2.fillRect(x + 8, y + h - 1, w - 16, 0.8);
      }
      c2.restore();
    }
  }
  function medallion(c2, x, y, size, active = false) {
    c2.beginPath();
    c2.arc(x + size / 2, y + size / 2, size / 2, 0, TAU6);
    c2.fillStyle = "#0a141cf5";
    c2.fill();
    c2.strokeStyle = active ? "#ceb986" : "#546873";
    c2.lineWidth = 0.85;
    c2.stroke();
    c2.beginPath();
    c2.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, TAU6);
    c2.strokeStyle = "#8f9b8155";
    c2.lineWidth = 0.45;
    c2.stroke();
  }
  function utilities(c2, p2, gamepad = false) {
    const field = HUD_ART.utility, dodge = PLAYER_ABILITIES.dodge, potion = PLAYER_ABILITIES.potion;
    const slots = [
      {
        x: field.left,
        key: gamepad ? "LB" : controls.label("heal"),
        icon: "potion",
        charges: p2.flasks,
        capacity: potion.charges,
        cooldown: p2.healCooldown,
        duration: potion.cooldown,
        active: p2.healFlash > 0,
        color: "#d5a4bf"
      },
      {
        x: field.right,
        key: gamepad ? "B" : controls.label("dodge"),
        icon: "dodge",
        charges: p2.dodgeCharges,
        capacity: dodge.charges,
        cooldown: p2.dodgeCharges > 0 ? 0 : Math.max(0, dodge.recharge - p2.dodgeRecharge),
        duration: dodge.recharge,
        active: p2.dodgeTime > 0,
        color: "#8ac9b4"
      }
    ];
    for (const slot of slots) {
      const { x } = slot, y = field.y, w = field.width, cx = x + w / 2, cy = y + w / 2;
      c2.save();
      medallion(c2, x, y, w, slot.active);
      c2.globalAlpha = slot.charges > 0 && !p2.dead ? 1 : 0.45;
      drawHUDUtility(c2, slot.icon, cx, cy, w - 3);
      c2.globalAlpha = 1;
      if (slot.cooldown > 0) {
        c2.strokeStyle = slot.color;
        c2.lineWidth = 1.4;
        c2.beginPath();
        c2.arc(cx, cy, w / 2 - 1, -Math.PI / 2, -Math.PI / 2 + TAU6 * (1 - clamp4(slot.cooldown / slot.duration)));
        c2.stroke();
        text(c2, slot.cooldown.toFixed(1), cx, cy - 3, 0.9, UI.ivory, "center");
      }
      const left = slot.icon === "potion", bx = left ? x + w + 2 : x - 2;
      const keyScale = Math.min(0.8, 23 / Math.max(1, textWidth(slot.key, 1, "interface")));
      const keyWidth = Math.max(13, textWidth(slot.key, 1, "interface") * keyScale + 4);
      c2.fillStyle = "#b7b9a4";
      c2.fillRect(left ? bx : bx - keyWidth, y + 4, keyWidth, 12);
      text(c2, slot.key, left ? bx + keyWidth / 2 : bx - keyWidth / 2, y + 6, keyScale, "#162129", "center", "interface");
      for (let charge = 0; charge < slot.capacity; charge++) {
        c2.beginPath();
        c2.arc(cx - (slot.capacity - 1) * 2.5 + charge * 5, y + w + 3, 1.2, 0, TAU6);
        c2.fillStyle = charge < slot.charges ? slot.color : "#1a242c";
        c2.fill();
      }
      c2.restore();
    }
    racial(c2, p2, gamepad);
  }
  function racial(c2, p2, gamepad = false) {
    const skill = racialSkill(p2);
    if (!skill) return;
    const field = HUD_ART.racial, x = field.x, y = field.y, w = field.width;
    const cx = x + w / 2, cy = y + w / 2;
    const definition = SKILL_DEFINITIONS[skill];
    const cooldown = p2.skillCooldowns[skill] ?? 0;
    const resolved = definition ? resolveSkill(skill, p2.derived, p2.character) : null;
    const usable = !p2.dead && cooldown <= 0 && p2.mana >= (resolved?.mana ?? 0);
    c2.save();
    medallion(c2, x, y, w, p2.activeSkill === skill);
    c2.globalAlpha = usable ? 1 : 0.45;
    c2.save();
    c2.beginPath();
    c2.arc(cx, cy, w / 2 - 2, 0, TAU6);
    c2.clip();
    skillIconSafe(c2, skill, cx, cy, w - 3);
    c2.restore();
    c2.globalAlpha = 1;
    if (cooldown > 0) {
      c2.strokeStyle = definition?.color ?? "#c9a86a";
      c2.lineWidth = 1.4;
      c2.beginPath();
      c2.arc(cx, cy, w / 2 - 1, -Math.PI / 2, -Math.PI / 2 + TAU6 * (1 - clamp4(cooldown / Math.max(1e-3, resolved?.cooldown ?? 1))));
      c2.stroke();
    }
    const binding = gamepad ? "\u2014" : controls.label("skill5");
    const keyScale = Math.min(0.8, 23 / Math.max(1, textWidth(binding, 1, "interface")));
    const keyWidth = Math.max(13, textWidth(binding, 1, "interface") * keyScale + 4);
    c2.fillStyle = "#b7b9a4";
    c2.fillRect(x - 2 - keyWidth, y + 4, keyWidth, 12);
    text(c2, binding, x - 2 - keyWidth / 2, y + 6, keyScale, "#162129", "center", "interface");
    c2.restore();
  }
  function shortcuts(c2, p2) {
    const { x, y, width: w } = HUD_ART.menu;
    c2.strokeStyle = "#596974";
    c2.lineWidth = 0.7;
    c2.beginPath();
    c2.moveTo(x + w / 2, y + w);
    c2.lineTo(x + w / 2, HUD_ART.skill.y - 3);
    c2.stroke();
    medallion(c2, x, y, w);
    drawHUDUtility(c2, "menu", x + w / 2, y + w / 2, w - 4);
    if (p2.character.statPoints + p2.character.skillPoints > 0) {
      c2.beginPath();
      c2.arc(x + w - 2, y + 2, 3, 0, TAU6);
      c2.fillStyle = "#e1bd79";
      c2.fill();
      c2.strokeStyle = "#101c24";
      c2.lineWidth = 1;
      c2.stroke();
    }
  }
  function readout(c2, x, current, max, mana, label, labelColor) {
    const value = `${current} / ${max}`;
    const size = Math.min(1.13, 58 / Math.max(1, textWidth(value)));
    text(c2, value, x, HUD_ART.orb.readoutY - size * 3.85, size, mana ? "#b9cee0" : "#dfb9af", "center");
    if (label) text(c2, label, x, 143, 0.62, labelColor ?? "#8fa8b5", "center");
  }
  function resourcePips(c2, p2, cls, simTime) {
    const cx = HUD_ART.orb.right;
    if (cls?.id === "deathKnight" && p2.runes) {
      const kinds = ["blood", "blood", "frost", "frost", "unholy", "unholy"];
      const colors = { blood: "#c0392b", frost: "#5aa7d6", unholy: "#6fae4e" };
      for (const [i, kind] of kinds.entries()) {
        const x = cx - 22.5 + i * 9, y = 133;
        const readyAt = p2.runes[i] ?? 0;
        const remaining = simTime === void 0 ? 0 : Math.max(0, readyAt - simTime);
        c2.beginPath();
        c2.moveTo(x, y - 3.4);
        c2.lineTo(x + 3.4, y);
        c2.lineTo(x, y + 3.4);
        c2.lineTo(x - 3.4, y);
        c2.closePath();
        c2.fillStyle = remaining > 0 ? "#101a22" : colors[kind];
        c2.fill();
        c2.strokeStyle = shade(colors[kind], 0.3);
        c2.lineWidth = 0.55;
        c2.stroke();
        if (remaining > 0) {
          c2.save();
          c2.beginPath();
          c2.moveTo(x, y - 3.4);
          c2.lineTo(x + 3.4, y);
          c2.lineTo(x, y + 3.4);
          c2.lineTo(x - 3.4, y);
          c2.closePath();
          c2.clip();
          c2.fillStyle = colors[kind];
          const fill = 1 - clamp4(remaining / WOW_COMBAT.runeRecharge);
          c2.fillRect(x - 3.4, y + 3.4 - 6.8 * fill, 6.8, 6.8 * fill);
          c2.restore();
        }
      }
    } else if (cls?.id === "warlock" && p2.soulShards !== void 0) {
      for (let i = 0; i < WOW_COMBAT.maxSoulShards; i++) {
        const x = cx - 13.5 + i * 9, y = 133, filled = i < p2.soulShards;
        c2.beginPath();
        c2.moveTo(x, y - 3.4);
        c2.lineTo(x + 3.4, y);
        c2.lineTo(x, y + 3.4);
        c2.lineTo(x - 3.4, y);
        c2.closePath();
        c2.fillStyle = filled ? "#9482C9" : "#101a22";
        c2.fill();
        c2.strokeStyle = filled ? "#c4b6e6" : "#4a5a64";
        c2.lineWidth = 0.55;
        c2.stroke();
      }
    }
  }
  function drawHUDContents(c2, p2, time, options = {}) {
    const t = options.reducedMotion ? 0 : time;
    const orb2 = HUD_ART.orb, cls = wowClass(p2);
    const resourceTint = cls ? RESOURCE_COLORS[cls.resource] : void 0;
    for (const mana of [false, true]) {
      c2.save();
      c2.translate(mana ? orb2.right : orb2.left, orb2.y);
      c2.scale(orb2.scale, orb2.scale);
      drawHUDOrb(
        c2,
        0,
        0,
        mana ? p2.mana / Math.max(1, p2.maxMana) : p2.hp / Math.max(1, p2.maxHp),
        t + (mana && !options.reducedMotion ? 7 : 0),
        mana,
        mana ? void 0 : options.healthTrail,
        mana ? 0 : (options.hitPulse ?? 0) * (options.reducedMotion ? 0.4 : 1),
        mana ? (p2.auras?.reservation ?? 0) / 100 : 0,
        mana ? resourceTint : void 0
      );
      c2.restore();
    }
    skills(c2, p2, t, options.gamepad, options.groundEffects, options.inventory, options.simTime);
    if (!options.inventory) {
      utilities(c2, p2, options.gamepad);
      shortcuts(c2, p2);
      resourcePips(c2, p2, cls, options.simTime);
    }
    readout(c2, orb2.left, Math.ceil(Math.max(0, p2.hp)), p2.maxHp, false);
    readout(
      c2,
      orb2.right,
      Math.floor(Math.max(0, p2.mana)),
      manaCapacity(p2),
      true,
      cls?.resourceLabel,
      resourceTint ? shade(resourceTint, 0.35) : void 0
    );
    drawHUDExperience(c2, p2, t, options.experience, options.inventory ? HUD_ART.inventory.experienceY : HUD_ART.experience.y);
  }
  function drawTouchResources(c2, p2, time, options) {
    const t = options.reducedMotion ? 0 : time;
    const cls = wowClass(p2);
    for (const mana of [false, true]) {
      const x = mana ? 436 : 84;
      c2.save();
      c2.translate(x, 96);
      c2.scale(0.72, 0.72);
      c2.lineCap = "round";
      c2.lineJoin = "round";
      drawHUDOrbFrame(c2, 0, 0, mana ? 1 : -1, t);
      c2.scale(HUD_ART.orb.scale, HUD_ART.orb.scale);
      drawHUDOrb(
        c2,
        0,
        0,
        mana ? p2.mana / Math.max(1, p2.maxMana) : p2.hp / Math.max(1, p2.maxHp),
        t + (mana && !options.reducedMotion ? 7 : 0),
        mana,
        mana ? void 0 : options.healthTrail,
        mana ? 0 : (options.hitPulse ?? 0) * (options.reducedMotion ? 0.4 : 1),
        mana ? (p2.auras?.reservation ?? 0) / 100 : 0,
        mana && cls ? RESOURCE_COLORS[cls.resource] : void 0
      );
      c2.restore();
      chamfer(c2, x - 44, 129, 88, 18, 4);
      const metal2 = c2.createLinearGradient(0, 129, 0, 147);
      metal2.addColorStop(0, "#263943");
      metal2.addColorStop(1, "#0a141c");
      c2.fillStyle = metal2;
      c2.fill();
      c2.strokeStyle = "#77929c";
      c2.lineWidth = 0.8;
      c2.stroke();
      const current = mana ? Math.floor(Math.max(0, p2.mana)) : Math.ceil(Math.max(0, p2.hp));
      const value = `${current} / ${mana ? manaCapacity(p2) : p2.maxHp}`;
      const size = Math.min(1.6, 78 / Math.max(1, textWidth(value)));
      text(c2, value, x, 138 - size * 3.85, size, mana ? "#b9cee0" : "#dfb9af", "center");
    }
  }
  function drawFloatingHUD(c2, p2, width, height, time, options = {}) {
    const layout = options.layout ?? getHUDLayout(width, height);
    if (!layout.scale) return;
    c2.save();
    c2.translate(layout.x, layout.y);
    c2.scale(layout.scale, layout.scale);
    if (options.touch) {
      drawTouchResources(c2, p2, time, options);
      drawHUDExperience(c2, p2, options.reducedMotion ? 0 : time, options.experience);
    } else {
      drawHUDFrame(c2, options.reducedMotion ? 0 : time, options.inventory);
      drawHUDContents(c2, p2, time, options);
    }
    c2.restore();
    drawPlayerFrame(c2, p2, options.topInset ?? 0);
    const pet2 = drawPetFrame(c2, p2, options.topInset ?? 0);
    drawWowBuffs(c2, p2, (options.topInset ?? 0) + (pet2 ? PET_FRAME.height + 4 : 0));
    drawCastBar(c2, p2, layout);
  }
  var PLAYER_FRAME = Object.freeze({ x: 12, y: 8, height: 36, barX: 52, barWidth: 148 });
  function frameBar(c2, x, y, w, h, ratio, color) {
    c2.fillStyle = "#060d13";
    c2.fillRect(x, y, w, h);
    const fill = c2.createLinearGradient(x, y, x, y + h);
    fill.addColorStop(0, shade(color, 0.3));
    fill.addColorStop(0.45, color);
    fill.addColorStop(1, shade(color, -0.45));
    c2.fillStyle = fill;
    c2.fillRect(x, y, w * clamp4(ratio), h);
    c2.fillStyle = "#ffffff22";
    c2.fillRect(x, y, w * clamp4(ratio), 0.7);
    c2.strokeStyle = "#5a707c";
    c2.lineWidth = 0.7;
    c2.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  }
  function drawPlayerFrame(c2, p2, topInset) {
    const cls = wowClass(p2), classColor = cls?.color ?? UI.silver;
    const x = PLAYER_FRAME.x, y = PLAYER_FRAME.y + Math.max(0, topInset);
    const crest = 36, barX = PLAYER_FRAME.barX, barWidth = PLAYER_FRAME.barWidth;
    c2.save();
    const shadow = c2.createRadialGradient(x + 96, y + 18, 4, x + 96, y + 18, 112);
    shadow.addColorStop(0, "#02050a9c");
    shadow.addColorStop(1, "#02050a00");
    c2.fillStyle = shadow;
    c2.fillRect(x - 16, y - 10, 224, 60);
    chamfer(c2, x, y, crest, crest, 4);
    const metal2 = c2.createLinearGradient(x, y, x, y + crest);
    metal2.addColorStop(0, "#2c3e49");
    metal2.addColorStop(1, "#0a141c");
    c2.fillStyle = metal2;
    c2.fill();
    c2.strokeStyle = p2.stealthed ? "#e8c93a" : classColor;
    c2.lineWidth = 1;
    c2.stroke();
    const glow = c2.createRadialGradient(x + crest / 2, y + crest / 2, 1, x + crest / 2, y + crest / 2, crest * 0.7);
    glow.addColorStop(0, `${classColor}30`);
    glow.addColorStop(1, `${classColor}00`);
    c2.fillStyle = glow;
    c2.fillRect(x, y, crest, crest);
    text(c2, (cls?.name ?? "Wayfarer")[0], x + crest / 2, y + 13.5, 1.15, shade(classColor, 0.35), "center");
    c2.beginPath();
    c2.arc(x + crest - 1, y + crest - 1, 6, 0, TAU6);
    c2.fillStyle = "#0a141c";
    c2.fill();
    c2.strokeStyle = UI.brass;
    c2.lineWidth = 0.8;
    c2.stroke();
    text(c2, String(p2.level), x + crest - 1, y + crest - 3.9, 0.62, UI.ivory, "center");
    chamfer(c2, barX, y, barWidth, 12, 3);
    const plate = c2.createLinearGradient(barX, y, barX, y + 12);
    plate.addColorStop(0, "#1b2830");
    plate.addColorStop(1, "#0a141c");
    c2.fillStyle = plate;
    c2.fill();
    c2.strokeStyle = "#5a707c";
    c2.lineWidth = 0.7;
    c2.stroke();
    c2.fillStyle = classColor;
    c2.fillRect(barX + 1, y + 1, 2, 10);
    c2.fillStyle = `${classColor}55`;
    c2.fillRect(barX + 1, y + 11, barWidth - 2, 0.8);
    const name = p2.name ?? "Wayfarer";
    text(
      c2,
      name,
      barX + 6,
      y + 2.6,
      Math.min(0.95, (barWidth - 12) / Math.max(1, textWidth(name, 0.95))),
      p2.dead ? UI.faint : classColor
    );
    frameBar(c2, barX, y + 14, barWidth, 9, p2.hp / Math.max(1, p2.maxHp), healthColor(p2.hp / Math.max(1, p2.maxHp)));
    frameBar(c2, barX, y + 25, barWidth, 7, p2.mana / Math.max(1, p2.maxMana), cls ? RESOURCE_COLORS[cls.resource] : RESOURCE_COLORS.mana);
    c2.restore();
  }
  var PET_FRAME = Object.freeze({ x: 12, height: 26, barX: 34, barWidth: 110 });
  var PET_COMMANDS = { attack: "ATK", follow: "FLW", stay: "STY", passive: "PSV" };
  function petFrameAlly(p2) {
    const pet2 = p2.character.pets?.active;
    const allies = p2.allies?.filter((a) => a.hp > 0 && !a.stationary);
    return (pet2 ? allies?.find((a) => a.petId === pet2.id) : void 0) ?? allies?.find((a) => a.remaining === void 0);
  }
  function drawPetFrame(c2, p2, topInset) {
    const ally2 = petFrameAlly(p2);
    if (!ally2) return false;
    const template = ALLY_TEMPLATES[ally2.kind];
    const pet2 = p2.character.pets?.active;
    const name = pet2 && ally2.petId === pet2.id ? pet2.name : template.name;
    const x = PET_FRAME.x, y = PLAYER_FRAME.y + PLAYER_FRAME.height + 6 + Math.max(0, topInset);
    const crest = 22, barX = x + PET_FRAME.barX - PET_FRAME.x, barWidth = PET_FRAME.barWidth;
    c2.save();
    const shadow = c2.createRadialGradient(x + 60, y + 13, 4, x + 60, y + 13, 80);
    shadow.addColorStop(0, "#02050a80");
    shadow.addColorStop(1, "#02050a00");
    c2.fillStyle = shadow;
    c2.fillRect(x - 10, y - 6, 160, 40);
    chamfer(c2, x, y, crest, crest, 3);
    const metal2 = c2.createLinearGradient(x, y, x, y + crest);
    metal2.addColorStop(0, "#2c3e49");
    metal2.addColorStop(1, "#0a141c");
    c2.fillStyle = metal2;
    c2.fill();
    c2.strokeStyle = template.color;
    c2.lineWidth = 0.8;
    c2.stroke();
    text(c2, template.name[0] ?? "?", x + crest / 2, y + 8.5, 0.8, shade(template.color, 0.35), "center");
    chamfer(c2, barX, y, barWidth, 10, 3);
    const plate = c2.createLinearGradient(barX, y, barX, y + 10);
    plate.addColorStop(0, "#1b2830");
    plate.addColorStop(1, "#0a141c");
    c2.fillStyle = plate;
    c2.fill();
    c2.strokeStyle = "#5a707c";
    c2.lineWidth = 0.7;
    c2.stroke();
    c2.fillStyle = template.color;
    c2.fillRect(barX + 1, y + 1, 2, 8);
    text(c2, name, barX + 5, y + 2.2, Math.min(0.8, (barWidth - 34) / Math.max(1, textWidth(name, 0.8))), UI.ivory);
    const command = ally2.petId !== void 0 ? PET_COMMANDS[p2.petCommand ?? "attack"] : null;
    if (command) text(c2, command, barX + barWidth - 3, y + 2.4, 0.6, shade(template.color, 0.4), "right");
    frameBar(c2, barX, y + 12, barWidth, 8, ally2.hp / Math.max(1, ally2.maxHp), healthColor(ally2.hp / Math.max(1, ally2.maxHp)));
    c2.restore();
    return true;
  }
  function drawWowBuffs(c2, p2, topInset) {
    const buffs = p2.buffs;
    if (!buffs?.length) return;
    const size = 18, gap = 3, x0 = PLAYER_FRAME.x, y0 = PLAYER_FRAME.y + PLAYER_FRAME.height + 6 + Math.max(0, topInset);
    for (const [i, buff] of buffs.entries()) {
      const x = x0 + i * (size + gap), y = y0;
      const highlight = !!(buff.stealth || buff.form);
      c2.save();
      c2.fillStyle = "#0a141cf0";
      c2.fillRect(x, y, size, size);
      c2.strokeStyle = highlight ? "#e8c93a" : buff.color;
      c2.lineWidth = highlight ? 1.2 : 0.8;
      c2.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
      if (highlight) {
        const glow = c2.createRadialGradient(x + size / 2, y + size / 2, 1, x + size / 2, y + size / 2, size);
        glow.addColorStop(0, "#e8c93a22");
        glow.addColorStop(1, "#e8c93a00");
        c2.fillStyle = glow;
        c2.fillRect(x - 3, y - 3, size + 6, size + 6);
      }
      const icon = buff.id;
      if (SKILL_ICON_RECIPES[icon]) skillIconSafe(c2, icon, x + size / 2, y + size / 2, size - 3);
      else {
        c2.fillStyle = shade(buff.color, -0.5);
        c2.fillRect(x + 2, y + 2, size - 4, size - 4);
        text(c2, buff.name[0] ?? "?", x + size / 2, y + 4, 0.8, shade(buff.color, 0.5), "center");
      }
      if (buff.duration > 0) {
        const spent = 1 - clamp4(buff.remaining / Math.max(1e-3, buff.duration));
        c2.fillStyle = "#030a10a0";
        c2.fillRect(x + 1, y + 1, size - 2, (size - 2) * spent);
        const label = buff.remaining >= 60 ? `${Math.floor(buff.remaining / 60)}m` : `${Math.ceil(buff.remaining)}`;
        text(c2, label, x + size / 2, y + size - 7, 0.62, UI.ivory, "center");
      }
      c2.restore();
    }
  }
  function drawCastBar(c2, p2, layout) {
    const cast = p2.cast;
    if (!cast || cast.duration <= 0) return;
    const w = 180, h = 12, x = layout.x + layout.scale * (HUD_ART.width - w) / 2, y = layout.y - 20;
    const progress = clamp4(1 - cast.remaining / cast.duration);
    const channel = !!cast.channel;
    c2.save();
    c2.fillStyle = "#050a10e0";
    c2.fillRect(x - 1, y - 1, w + 2, h + 2);
    c2.strokeStyle = "#4a6573";
    c2.lineWidth = 0.8;
    c2.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    const fill = c2.createLinearGradient(x, y, x, y + h);
    if (channel) {
      fill.addColorStop(0, "#7fb8e8");
      fill.addColorStop(1, "#2b5f9e");
    } else {
      fill.addColorStop(0, "#f2d68a");
      fill.addColorStop(1, "#b07f3c");
    }
    c2.fillStyle = fill;
    if (channel) c2.fillRect(x + w * (1 - progress), y, w * progress, h);
    else c2.fillRect(x, y, w * progress, h);
    const definition = SKILL_DEFINITIONS[cast.skill];
    const ticks = definition?.channel?.ticks ?? 0;
    if (channel && ticks > 1) {
      c2.strokeStyle = "#dcebf5aa";
      c2.lineWidth = 0.7;
      for (let i = 1; i < ticks; i++) {
        const tx = x + w * (1 - i / ticks);
        c2.beginPath();
        c2.moveTo(tx, y + 1);
        c2.lineTo(tx, y + h - 1);
        c2.stroke();
      }
    }
    const name = definition?.name ?? String(cast.skill);
    text(c2, name, x + w / 2, y + 2, 0.72, "#f4f0e2", "center");
    text(c2, cast.remaining.toFixed(1), x + w - 4, y + 2, 0.62, "#d8e4ea", "right");
    c2.restore();
  }

  // src/elemental-weapon.ts
  var ELEMENT_COLORS = Object.freeze({
    fire: "#f7995c",
    frost: "#91d4ee",
    lightning: "#bcb0ff",
    arcane: "#a5b9ff"
  });
  var ELEMENTAL_AFFIXES = Object.freeze([
    Object.freeze({ name: "Kindling", stat: "fireDamage", element: "fire", base: 4, growth: 0.52 }),
    Object.freeze({ name: "Rime", stat: "frostDamage", element: "frost", base: 4, growth: 0.52 }),
    Object.freeze({ name: "Stormbound", stat: "lightningDamage", element: "lightning", base: 4, growth: 0.52 })
  ]);

  // src/weapon-content.ts
  function weapon(recipe) {
    const damageType = recipe.damageType ?? "physical";
    return Object.freeze({
      id: recipe.id,
      name: recipe.name,
      family: recipe.family,
      hands: recipe.hands,
      attackKind: recipe.family === "bow" ? "arrow" : recipe.family === "staff" || recipe.family === "wand" ? "bolt" : "melee",
      damageType,
      damage: recipe.damage,
      baseAttacksPerSecond: recipe.speed,
      reach: recipe.reach,
      arc: recipe.arc * Math.PI / 180,
      visual: Object.freeze({
        kind: recipe.family,
        element: damageType,
        length: recipe.length,
        width: recipe.width,
        gripLength: recipe.gripLength,
        metal: "#86b3a3",
        edge: "#f7e8b8",
        grip: "#715332",
        guard: "#dba25b",
        ...ELEMENT_COLORS[damageType] ? { glow: ELEMENT_COLORS[damageType] } : {}
      })
    });
  }
  var WEAPON_PROFILES = Object.freeze([
    weapon({ id: "longsword", name: "Longsword", family: "sword", hands: 1, damage: 19, speed: 2.2, reach: 54, arc: 128, length: 27, width: 3, gripLength: 8 }),
    weapon({ id: "hand-axe", name: "Warden Axe", family: "axe", hands: 1, damage: 24, speed: 1.8, reach: 52, arc: 145, length: 24, width: 9, gripLength: 8 }),
    weapon({ id: "flanged-mace", name: "Flanged Mace", family: "mace", hands: 1, damage: 26, speed: 1.65, reach: 48, arc: 122, length: 23, width: 7, gripLength: 8 }),
    weapon({ id: "rondel-dagger", name: "Rondel Dagger", family: "dagger", hands: 1, damage: 13, speed: 3, reach: 40, arc: 110, length: 18, width: 2.5, gripLength: 8 }),
    weapon({ id: "greatblade", name: "Greatblade", family: "sword", hands: 2, damage: 33, speed: 1.5, reach: 69, arc: 145, length: 37, width: 4.5, gripLength: 15 }),
    weapon({ id: "greataxe", name: "Greataxe", family: "axe", hands: 2, damage: 39, speed: 1.3, reach: 67, arc: 160, length: 35, width: 13, gripLength: 16 }),
    weapon({ id: "grave-maul", name: "Grave Maul", family: "mace", hands: 2, damage: 44, speed: 1.1, reach: 61, arc: 130, length: 33, width: 12, gripLength: 16 }),
    weapon({ id: "thorn-shortbow", name: "Thorn Shortbow", family: "bow", hands: 2, damage: 18, speed: 2.2, reach: 420, arc: 12, length: 30, width: 12, gripLength: 9 }),
    weapon({ id: "crescent-recurve", name: "Crescent Recurve", family: "bow", hands: 2, damage: 24, speed: 1.8, reach: 520, arc: 10, length: 35, width: 15, gripLength: 10 }),
    weapon({ id: "warden-longbow", name: "Warden Longbow", family: "bow", hands: 2, damage: 31, speed: 1.4, reach: 600, arc: 8, length: 40, width: 14, gripLength: 11 }),
    weapon({ id: "ember-staff", name: "Ember Staff", family: "staff", hands: 2, damageType: "fire", damage: 28, speed: 1.5, reach: 480, arc: 12, length: 40, width: 7, gripLength: 18 }),
    weapon({ id: "rime-staff", name: "Rime Staff", family: "staff", hands: 2, damageType: "frost", damage: 24, speed: 1.65, reach: 440, arc: 12, length: 39, width: 8, gripLength: 18 }),
    weapon({ id: "storm-staff", name: "Storm Staff", family: "staff", hands: 2, damageType: "lightning", damage: 17, speed: 2.3, reach: 500, arc: 10, length: 41, width: 7, gripLength: 18 }),
    weapon({ id: "cinder-wand", name: "Cinder Wand", family: "wand", hands: 1, damageType: "fire", damage: 16, speed: 2.4, reach: 440, arc: 12, length: 19, width: 4, gripLength: 6 }),
    weapon({ id: "hoarfrost-wand", name: "Hoarfrost Wand", family: "wand", hands: 1, damageType: "frost", damage: 14, speed: 2.6, reach: 420, arc: 12, length: 20, width: 4.5, gripLength: 6 }),
    weapon({ id: "spark-wand", name: "Spark Wand", family: "wand", hands: 1, damageType: "lightning", damage: 11, speed: 3.1, reach: 460, arc: 10, length: 18, width: 4, gripLength: 6 }),
    weapon({ id: "star-wand", name: "Star Wand", family: "wand", hands: 1, damageType: "arcane", damage: 17, speed: 2.3, reach: 450, arc: 10, length: 21, width: 4.5, gripLength: 6 })
  ]);
  var SHIELD_PROFILES = Object.freeze([
    Object.freeze({
      id: "iron-buckler",
      name: "Iron Buckler",
      blockChance: 20,
      blockReduction: 55,
      visual: Object.freeze({ kind: "buckler", base: "#7a8f92", edge: "#d3d6bb", trim: "#c5a96e", shadow: "#34464c" })
    }),
    Object.freeze({
      id: "vigil-kite",
      name: "Vigil Kite Shield",
      blockChance: 28,
      blockReduction: 65,
      visual: Object.freeze({ kind: "kite", base: "#667a91", edge: "#cad6dc", trim: "#d0b47b", shadow: "#2d3e50" })
    }),
    Object.freeze({
      id: "bastion-tower",
      name: "Bastion Tower Shield",
      blockChance: 36,
      blockReduction: 75,
      visual: Object.freeze({ kind: "tower", base: "#837b70", edge: "#ded4b5", trim: "#ba9762", shadow: "#403d3e" })
    })
  ]);

  // iconreview-tmp/petframe-entry.ts
  var cv = document.getElementById("c");
  var c = cv.getContext("2d");
  c.fillStyle = "#0b1520";
  c.fillRect(0, 0, cv.width, cv.height);
  var pet = { id: 7, name: "Clawjaw", family: "wolf", species: "wolf", level: 12, experience: 0, command: "attack" };
  var ally = {
    id: 3,
    kind: "wolf",
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    angle: 0,
    hp: 34,
    maxHp: 60,
    radius: 8,
    attackCooldown: 0,
    stationary: false,
    targetId: null,
    petId: 7
  };
  var p = {
    hp: 210,
    maxHp: 260,
    mana: 80,
    maxMana: 120,
    level: 12,
    name: "Huntress",
    character: {
      name: "Huntress",
      classId: "hunter",
      raceId: "nightElf",
      level: 12,
      pets: { active: pet, stable: [pet] },
      skillSlots: [],
      allocatedNodes: [],
      actionBars: [],
      learnedSkills: {},
      skillRanks: {},
      activeSkillRanks: {},
      skillSpecializations: {}
    },
    allies: [ally],
    petCommand: "follow",
    buffs: [],
    castTime: 0,
    skillCooldowns: {},
    derived: {},
    attack: null,
    dead: false,
    affixBuffs: {},
    auras: { reservation: 0 },
    equipment: { mainHand: WEAPON_PROFILES.find((w) => w.id === "thorn-shortbow") ?? null, offHand: null }
  };
  try {
    drawFloatingHUD(c, p, cv.width, cv.height, 1.2, {});
  } catch (e) {
    document.title = "ERR " + (e instanceof Error ? (e.stack ?? e.message).split("\n").slice(0, 6).join(" << ") : String(e));
  }
  document.done = true;
})();
