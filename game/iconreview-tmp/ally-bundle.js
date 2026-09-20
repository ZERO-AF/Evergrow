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
  function taper(ctx, from, to, fromWidth, toWidth, fill) {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length / 2;
    const ny = dx / length / 2;
    polygon(ctx, [
      [from[0] + nx * fromWidth, from[1] + ny * fromWidth],
      [to[0] + nx * toWidth, to[1] + ny * toWidth],
      [to[0] - nx * toWidth, to[1] - ny * toWidth],
      [from[0] - nx * fromWidth, from[1] - ny * fromWidth]
    ], fill);
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

  // src/ally-art.ts
  var ALLY_ART = Object.freeze({
    imp: { shape: "imp", accent: "#ff9a4e", glow: 0.3 },
    felhunter: { shape: "quadruped", accent: "#b08ae0", glow: 0.18, quad: { tail: 6, ear: 0, snout: 1.1 }, spikes: true },
    felguard: { shape: "brute", accent: "#b08ae0", glow: 0.22, horns: true },
    voidwalker: { shape: "floater", accent: "#8a6fd0", glow: 0.28 },
    succubus: { shape: "humanoid", accent: "#e08ac0", glow: 0.2, wings: true },
    doomguard: { shape: "brute", accent: "#e05a6a", glow: 0.3, wings: true, horns: true },
    wolf: { shape: "quadruped", accent: "#8fd06a" },
    bear: { shape: "quadruped", accent: "#8fd06a", quad: { leg: 0.85, bulk: 1.4, tail: 1.5, ear: 1.4, snout: 0.85, head: 0.5 } },
    cat: { shape: "quadruped", accent: "#8fd06a", quad: { leg: 1.05, bulk: 0.75, tail: 7, ear: 2.8, snout: 0.8 } },
    boar: { shape: "boar", accent: "#8fd06a" },
    raptor: { shape: "raptor", accent: "#8fd06a" },
    spider: { shape: "spider", accent: "#8fd06a" },
    bird: { shape: "bird", accent: "#8fd06a" },
    windSerpent: { shape: "serpent", accent: "#8fd06a", glow: 0.18 },
    scorpid: { shape: "scorpid", accent: "#8fd06a" },
    turtle: { shape: "turtle", accent: "#8fd06a" },
    ghoul: { shape: "humanoid", accent: "#b08ae0", glow: 0.16, hunched: true },
    waterElemental: { shape: "elemental", accent: "#8ee7ff", glow: 0.3 },
    earthElemental: { shape: "brute", accent: "#c8b06a", glow: 0.2, plates: true },
    fireElemental: { shape: "elemental", accent: "#ff9a4e", glow: 0.34, flames: true },
    mirrorImage: { shape: "humanoid", accent: "#a894ec", glow: 0.24, spectral: true },
    treant: { shape: "treant", accent: "#8fd06a" },
    shadowfiend: { shape: "fiend", accent: "#a08ae0", glow: 0.24, spectral: true },
    gargoyle: { shape: "gargoyle", accent: "#9ab8d0", glow: 0.2 },
    searingTotem: { shape: "totem", accent: "#ff9a4e", glow: 0.3, crown: "flame" },
    healingTotem: { shape: "totem", accent: "#8ee7ff", glow: 0.26, crown: "drop" },
    earthbindTotem: { shape: "totem", accent: "#8fd06a", glow: 0.2, crown: "rock" },
    magmaTotem: { shape: "totem", accent: "#ff6a3a", glow: 0.3, crown: "ember" },
    manaSpringTotem: { shape: "totem", accent: "#6a9aff", glow: 0.26, crown: "wave" },
    totemOfWrath: { shape: "totem", accent: "#ffc76a", glow: 0.3, crown: "star" },
    wrathOfAirTotem: { shape: "totem", accent: "#b8e8ff", glow: 0.26, crown: "rune" },
    windfuryTotem: { shape: "totem", accent: "#8fe0b8", glow: 0.26, crown: "gust" },
    strengthOfEarthTotem: { shape: "totem", accent: "#d0a86a", glow: 0.2, crown: "orb" },
    stoneskinTotem: { shape: "totem", accent: "#b8b8a8", glow: 0.2, crown: "spire" },
    flametongueTotem: { shape: "totem", accent: "#ffaa5a", glow: 0.3, crown: "bolt" },
    tremorTotem: { shape: "totem", accent: "#d0b88a", glow: 0.2, crown: "quake" },
    cleansingTotem: { shape: "totem", accent: "#8ae0c8", glow: 0.26, crown: "shield" },
    groundingTotem: { shape: "totem", accent: "#8aa8e0", glow: 0.26, crown: "horn" },
    spiritWolf: { shape: "quadruped", accent: "#8ee7ff", glow: 0.26, spectral: true },
    infernal: { shape: "brute", accent: "#ff9a4e", glow: 0.34, flames: true }
  });
  function totemCrown(c2, crown, accent, dark) {
    switch (crown) {
      case "flame":
        polygon(c2, [[0, -5.5], [2.6, -1], [1.4, 2.4], [0, 4.5], [-1.4, 2.4], [-2.6, -1]], accent);
        polygon(c2, [[0, -2], [1.2, 0.6], [0, 2.6], [-1.2, 0.6]], dark);
        break;
      case "ember":
        for (const [x, y] of [[-2.6, 1], [0, -2.4], [2.6, 1]]) {
          c2.fillStyle = accent;
          c2.beginPath();
          c2.arc(x, y, 1.8, 0, TAU);
          c2.fill();
        }
        break;
      case "bolt":
        polygon(c2, [[1.4, -5.5], [-2.8, 0.4], [-0.6, 0.4], [-1.6, 5.5], [2.8, -1], [0.4, -1]], accent);
        break;
      case "star":
        polygon(c2, [[0, -5.5], [1.5, -1.5], [5.5, 0], [1.5, 1.5], [0, 5.5], [-1.5, 1.5], [-5.5, 0], [-1.5, -1.5]], accent);
        break;
      case "drop":
        polygon(c2, [[0, -5.5], [2.8, -1], [2.8, 1.6], [0, 4.6], [-2.8, 1.6], [-2.8, -1]], accent);
        break;
      case "wave":
        polygon(c2, [[-5, 0.5], [-2.5, -2], [0, 0.5], [2.5, -2], [5, 0.5], [5, 3], [2.5, 5], [0, 3], [-2.5, 5], [-5, 3]], accent);
        break;
      case "rock":
        polygon(c2, [[-4.5, 3.5], [-3, -2.5], [0, -4.5], [3.4, -2], [4.5, 3.5]], accent);
        polygon(c2, [[-1.5, 2.5], [-0.6, -1.6], [1.8, -1], [2.4, 2.5]], dark);
        break;
      case "spire":
        polygon(c2, [[0, -6.5], [2.8, 4], [-2.8, 4]], accent);
        break;
      case "orb":
        c2.fillStyle = accent;
        c2.beginPath();
        c2.arc(0, 0, 3.6, 0, TAU);
        c2.fill();
        c2.fillStyle = dark;
        c2.beginPath();
        c2.arc(0, 0, 1.6, 0, TAU);
        c2.fill();
        break;
      case "gust":
        c2.strokeStyle = accent;
        c2.lineWidth = 1.8;
        c2.lineCap = "round";
        c2.beginPath();
        c2.arc(0, 0, 4, -2.4, 1.8);
        c2.stroke();
        c2.beginPath();
        c2.arc(0, 0, 4, 0.7, 3.6);
        c2.stroke();
        break;
      case "rune":
        polygon(c2, [[0, -5], [3.4, 0], [0, 5], [-3.4, 0]], accent);
        polygon(c2, [[0, -2.6], [1.8, 0], [0, 2.6], [-1.8, 0]], dark);
        break;
      case "quake":
        polygon(c2, [[-5.5, 1.5], [-3, -2.5], [-0.5, 1.5], [2, -2.5], [4.5, 1.5], [5.5, 1.5], [5.5, 3.5], [-5.5, 3.5]], accent);
        break;
      case "shield":
        polygon(c2, [[-3.4, -4], [3.4, -4], [3.4, 0.5], [0, 5], [-3.4, 0.5]], accent);
        polygon(c2, [[-1.6, -2.4], [1.6, -2.4], [1.6, 0.2], [0, 2.6], [-1.6, 0.2]], dark);
        break;
      case "horn":
        polygon(c2, [[-4.5, 3.5], [-4, -1], [-1, -4.5], [2.5, -5.5], [1, -2], [3.5, -1], [1.5, 1.5], [-1, 3.5]], accent);
        break;
    }
  }
  function drawAlly(c2, ally, x, y, time, reducedMotion = false) {
    const art = ALLY_ART[ally.kind];
    const tint = ALLY_TEMPLATES[ally.kind].color;
    const dark = mixColor(tint, "#0a0d12", 0.55);
    const t = reducedMotion ? 0 : time;
    const fade = ally.remaining !== void 0 ? clamp(ally.remaining / 0.8) : 1;
    const moving = clamp(Math.hypot(ally.x - ally.prevX, ally.y - ally.prevY) / 3.2);
    const gait = t * 9 + ally.id * 1.7;
    const bob = Math.sin(t * 3 + ally.id) * 1.2;
    const forward = [Math.cos(ally.angle), Math.sin(ally.angle) * 0.55];
    const across = [-Math.sin(ally.angle), Math.cos(ally.angle) * 0.55];
    const at = (px, py, z) => [forward[0] * px + across[0] * py, forward[1] * px + across[1] * py - z];
    const poly = (points, fill) => polygon(c2, points.map((q) => at(...q)), fill);
    const lunge = clamp((ally.attackCooldown - (ALLY_TEMPLATES[ally.kind].attackInterval - 0.35)) / 0.35) * 0.8;
    c2.save();
    c2.translate(x, y);
    c2.globalAlpha = fade * (art.spectral ? 0.78 : 1);
    c2.fillStyle = "#02091180";
    c2.beginPath();
    c2.ellipse(0, 2, ally.radius * 0.9, ally.radius * 0.38, 0, 0, TAU);
    c2.fill();
    if (ally.aura) {
      c2.globalAlpha = fade * 0.12;
      c2.strokeStyle = art.accent;
      c2.lineWidth = 1.2;
      c2.beginPath();
      c2.ellipse(0, 0, ally.aura.radius, ally.aura.radius * 0.45, 0, 0, TAU);
      c2.stroke();
      c2.globalAlpha = fade * (art.spectral ? 0.78 : 1);
    }
    const s = ally.radius / 11;
    c2.scale(s, s);
    switch (art.shape) {
      case "quadruped": {
        const q = art.quad ?? {};
        const leg = q.leg ?? 1, bulk = q.bulk ?? 1, tail = q.tail ?? 5, ear = q.ear ?? 2.4, snout = q.snout ?? 1;
        const step = Math.sin(gait) * moving * 2.6;
        const lift = Math.abs(Math.cos(gait)) * moving * 1.4;
        const body = 9 * leg + bob * 0.4 + lunge * 2;
        for (const side of [-1, 1]) for (const end of [-1, 1]) {
          const stride = step * (end === side ? -1 : 1);
          taper(c2, at(end * 4.5, side * 2.4 * bulk, body), at(end * 5 + stride, side * 3 * bulk, lift * (end === side ? 1 : 0.4)), 2.4 * bulk, 1.4 * bulk, dark);
        }
        if (tail > 0)
          taper(c2, at(-7 * bulk, 0, body + 1), at(-7 * bulk - tail, 0.6, body + 4 + Math.sin(t * 4 + ally.id) * 1.2), 1.6, 0.7, dark);
        if (art.spikes) for (const sx of [-4, 0, 4])
          poly([[sx - 1.4, -1, body + 3.6], [sx, -1, body + 7], [sx + 1.4, -1, body + 3.4]], dark);
        poly([[-8 * bulk, -2.6 * bulk, body + 2.4], [5 * bulk, -2.6 * bulk, body + 3], [8 * bulk, 0, body + 1.6], [5 * bulk, 2.6 * bulk, body + 1], [-6 * bulk, 2.6 * bulk, body]], tint);
        poly([[-6 * bulk, -2 * bulk, body + 3.4], [4 * bulk, -2 * bulk, body + 4], [6.4 * bulk, 0, body + 2.6], [-4 * bulk, 1.6 * bulk, body + 1.6]], dark);
        const head = body + 2 + (q.head ?? 0) + lunge * 2;
        const nose = 6 + 6.6 * snout;
        poly([[6, -2.2, head + 1], [9, -1.6, head + 3.4], [nose, -1, head + 1.4], [nose, 1, head + 1], [9, 2.4, head - 0.4], [6.4, 1.8, head - 0.8]], tint);
        if (ear > 0) {
          poly([[7.4, -1.8, head + 3], [8.6, -2.2, head + 3 + ear], [9.8, -1.6, head + 3.2]], dark);
          poly([[7.4, 1.8, head + 3], [8.6, 2.2, head + 3 + ear], [9.8, 1.6, head + 3.2]], dark);
        }
        const eye = at(4 + 6.4 * snout, -1.2, head + 1.6);
        c2.fillStyle = art.accent;
        c2.fillRect(eye[0] - 0.7, eye[1] - 0.7, 1.4, 1.4);
        break;
      }
      case "boar": {
        const step = Math.sin(gait) * moving * 2.2;
        const lift = Math.abs(Math.cos(gait)) * moving * 1.2;
        const body = 7 + bob * 0.4 + lunge * 1.6;
        for (const side of [-1, 1]) for (const end of [-1, 1]) {
          const stride = step * (end === side ? -1 : 1);
          taper(c2, at(end * 4, side * 2.8, body), at(end * 4.4 + stride, side * 3.4, lift * (end === side ? 1 : 0.4)), 2.6, 1.6, dark);
        }
        taper(c2, at(-6.5, 0, body + 1), at(-8.5, 0.5, body + 2.5 + Math.sin(t * 5 + ally.id)), 1.4, 0.6, dark);
        poly([[-7.5, -3.4, body + 2.6], [4.5, -3.4, body + 3.4], [7.5, 0, body + 1.8], [4.5, 3.4, body + 1], [-6, 3.4, body]], tint);
        poly([[-6, -2.6, body + 3.8], [3.5, -2.6, body + 4.4], [6, 0, body + 3], [-4, 2, body + 1.8]], dark);
        const head = body + 0.5 + lunge * 1.6;
        poly([[5.5, -2.4, head + 1.4], [8.5, -2, head + 2.6], [12, -1.2, head + 0.8], [12, 1.2, head + 0.6], [8.5, 2.6, head - 0.6], [6, 2.2, head - 0.8]], tint);
        poly([[11.4, -1.4, head + 1], [13.2, 0, head + 0.8], [11.4, 1.4, head + 0.6]], dark);
        for (const side of [-1, 1])
          taper(c2, at(10.5, side * 1.8, head + 0.4), at(12.6, side * 2.7, head + 2.8), 1.1, 0.5, "#e8dcc0");
        const eye = at(9.5, -1.4, head + 1.8);
        c2.fillStyle = art.accent;
        c2.fillRect(eye[0] - 0.7, eye[1] - 0.7, 1.4, 1.4);
        break;
      }
      case "spider": {
        const body = 5 + bob * 0.3 + lunge;
        for (const side of [-1, 1]) for (let leg = 0; leg < 4; leg++) {
          const lx = -4 + leg * 2.8;
          const swing = Math.sin(gait * 1.6 + leg * 1.7 + side) * moving * 1.6;
          taper(c2, at(lx, side * 2.2, body + 1), at(lx + swing, side * (5.5 + leg % 2), 0.5), 0.9, 0.5, dark);
        }
        poly([[-9, -3.4, body + 2], [-4, -4, body + 3.4], [-1.5, 0, body + 2.4], [-4, 4, body + 1.4], [-9, 3.4, body + 1.2]], tint);
        poly([[0, -2.2, body + 1.8], [4.5, -1.6, body + 2.4], [6, 0, body + 1.4], [4.5, 1.6, body + 0.8], [0, 2.2, body + 0.8]], tint);
        c2.fillStyle = art.accent;
        for (const [ex, ey] of [[4.6, -1], [5.4, -0.2], [4.6, 0.8]]) {
          const e = at(ex, ey, body + 2);
          c2.fillRect(e[0] - 0.5, e[1] - 0.5, 1, 1);
        }
        break;
      }
      case "turtle": {
        const step = Math.sin(gait) * moving * 1.6;
        const body = 4.5 + bob * 0.2;
        for (const side of [-1, 1]) for (const end of [-1, 1])
          taper(c2, at(end * 4.5, side * 3, body), at(end * 4.8 + step * (end === side ? -1 : 1), side * 3.6, 0.4), 2.2, 1.6, dark);
        poly([[-8, -4.4, body + 1], [8, -4.4, body + 1.4], [9.5, 0, body + 0.8], [8, 4.4, body + 0.6], [-8, 4.4, body + 0.4], [-9.5, 0, body + 0.6]], dark);
        poly([[-6.5, -3.6, body + 3.4], [6.5, -3.6, body + 3.8], [8, 0, body + 2.6], [6.5, 3.6, body + 2], [-6.5, 3.6, body + 1.6], [-8, 0, body + 2.2]], tint);
        poly([[-4, -2.4, body + 5.4], [4, -2.4, body + 5.8], [5.5, 0, body + 4.4], [4, 2.4, body + 3.8], [-4, 2.4, body + 3.4], [-5.5, 0, body + 4]], dark);
        const head = body + 1 + lunge * 1.4;
        taper(c2, at(7.5, 0, body + 1.6), at(10.5 + lunge * 2, 0, head + 1), 2.2, 1.8, tint);
        poly([[10 + lunge * 2, -1.6, head + 1.6], [12.6 + lunge * 2, -1, head + 1.2], [12.6 + lunge * 2, 1, head + 0.8], [10 + lunge * 2, 1.6, head + 0.6]], tint);
        const eye = at(11.8 + lunge * 2, -0.8, head + 1.4);
        c2.fillStyle = art.accent;
        c2.fillRect(eye[0] - 0.6, eye[1] - 0.6, 1.2, 1.2);
        break;
      }
      case "scorpid": {
        const step = Math.sin(gait) * moving * 2;
        const body = 5.5 + bob * 0.3;
        for (const side of [-1, 1]) for (let leg = 0; leg < 3; leg++) {
          const lx = -3 + leg * 3;
          taper(c2, at(lx, side * 2.4, body), at(lx + Math.sin(gait + leg * 2 + side) * moving * 1.4, side * 4.6, 0.4), 1, 0.6, dark);
        }
        for (const side of [-1, 1]) {
          taper(c2, at(5, side * 2.2, body + 0.6), at(9 + lunge * 2, side * 4.2, body - 1), 1.8, 1.2, tint);
          poly([[9 + lunge * 2, side * 3.4, body - 1.4], [12 + lunge * 2, side * 4.6, body - 0.6], [10.5 + lunge * 2, side * 5.4, body - 2.2]], dark);
          poly([[9 + lunge * 2, side * 3.4, body - 1.4], [11.5 + lunge * 2, side * 2.6, body - 0.4], [10 + lunge * 2, side * 4.4, body - 2.4]], dark);
        }
        poly([[-7, -2.6, body + 1.4], [5, -2.6, body + 2], [7, 0, body + 1.2], [5, 2.6, body + 0.8], [-7, 2.6, body + 0.6]], tint);
        poly([[-5.5, -1.8, body + 2.6], [4, -1.8, body + 3], [5.6, 0, body + 2], [-4, 1.6, body + 1.4]], dark);
        const sway = Math.sin(t * 2.2 + ally.id) * 1.4;
        taper(c2, at(-6.5, 0, body + 1.6), at(-9, 0, body + 7), 1.6, 1.2, tint);
        taper(c2, at(-9, 0, body + 7), at(-6 + sway, 0, body + 12), 1.2, 0.9, tint);
        taper(c2, at(-6 + sway, 0, body + 12), at(-1 + sway, 0, body + 13.5), 0.9, 0.6, dark);
        poly([[-1 + sway, -1, body + 14.6], [1.5 + sway, 0, body + 13], [-1 + sway, 1, body + 12.6]], art.accent);
        const eye = at(5.6, -1, body + 2.4);
        c2.fillStyle = art.accent;
        c2.fillRect(eye[0] - 0.6, eye[1] - 0.6, 1.2, 1.2);
        break;
      }
      case "raptor": {
        const step = Math.sin(gait) * moving * 3;
        const lift = Math.abs(Math.cos(gait)) * moving * 1.6;
        const hip = 8 + bob * 0.5 + lunge * 2;
        for (const side of [-1, 1])
          taper(c2, at(-0.5, side * 1.8, hip), at(1 + step * (side > 0 ? 1 : -1), side * 2.4, lift * (side > 0 ? 1 : 0.3)), 2.2, 1.2, dark);
        taper(c2, at(-4, 0, hip + 1), at(-13, 0.5, hip + 3 + Math.sin(t * 3 + ally.id)), 1.8, 0.6, dark);
        poly([[-5, -2.4, hip + 2], [2, -2.6, hip + 5], [5.5, 0, hip + 4], [3, 2.4, hip + 1.6], [-3, 2.4, hip + 0.8]], tint);
        poly([[-3.5, -1.8, hip + 3.4], [1.5, -2, hip + 5.6], [4, 0, hip + 4.6], [-2, 1.4, hip + 2]], dark);
        for (const side of [-1, 1])
          taper(c2, at(3, side * 1.8, hip + 3.4), at(5.5 + lunge * 2, side * 2.6, hip + 1), 1, 0.6, dark);
        taper(c2, at(4, 0, hip + 4.4), at(7.5, 0, hip + 8 + lunge * 2), 1.8, 1.4, tint);
        poly([[7, -1.4, hip + 9 + lunge * 2], [11.5, -0.8, hip + 8.4 + lunge * 2], [11.5, 0.8, hip + 7.6 + lunge * 2], [7, 1.4, hip + 7.4 + lunge * 2]], tint);
        const eye = at(9.4, -0.9, hip + 8.6 + lunge * 2);
        c2.fillStyle = art.accent;
        c2.fillRect(eye[0] - 0.7, eye[1] - 0.7, 1.4, 1.4);
        break;
      }
      case "bird": {
        const hover = 8 + bob * 1.4;
        const flap = Math.sin(t * 10 + ally.id);
        taper(c2, at(-3.5, 0, hover + 0.8), at(-8, 0, hover + 2.4), 1.6, 0.8, dark);
        poly([[-4, -1.8, hover + 1], [3, -2, hover + 1.6], [5.5, 0, hover + 0.6], [3, 2, hover], [-4, 1.8, hover - 0.2]], tint);
        poly([[4, -1.4, hover + 2.6], [6.5, -1, hover + 3], [7, 1, hover + 2], [4, 1.4, hover + 1.6]], tint);
        poly([[6.8, -0.7, hover + 2.6], [9.2, 0, hover + 2.2], [6.8, 0.7, hover + 2]], "#e8c04a");
        for (const side of [-1, 1]) {
          const tipZ = hover + 3 + flap * 3.5;
          const tipY = side * (8 + Math.abs(flap) * 2);
          poly([[-1, side * 1.4, hover + 1.6], [2, side * 3, hover + 2], [-1 + flap, tipY, tipZ], [-4, side * 4.5, hover + 1]], dark);
        }
        const eye = at(5.6, -0.9, hover + 2.6);
        c2.fillStyle = "#0a0d12";
        c2.fillRect(eye[0] - 0.6, eye[1] - 0.6, 1.2, 1.2);
        break;
      }
      case "serpent": {
        const hover = 7 + bob;
        const wave = Math.sin(t * 3 + ally.id);
        const pts = [[-9, wave * 2.5, hover + 1], [-5, -wave * 2, hover + 2.4], [-1, wave * 1.6, hover + 2.8], [3, -wave, hover + 3.2]];
        for (let i2 = 0; i2 < 3; i2++)
          taper(c2, at(pts[i2][0], pts[i2][1], pts[i2][2]), at(pts[i2 + 1][0], pts[i2 + 1][1], pts[i2 + 1][2]), 2.4 - i2 * 0.4, 2 - i2 * 0.4, i2 % 2 ? dark : tint);
        for (const side of [-1, 1])
          poly([[1, side * 1.2, hover + 3.6], [-1.5, side * (5 + Math.abs(wave)), hover + 5.5], [3, side * 2.4, hover + 3]], dark);
        poly([[3, -1.6, hover + 4], [7, -1, hover + 4.4], [8, 1, hover + 3.4], [3.5, 1.6, hover + 3]], tint);
        const eye = at(6, -0.9, hover + 4);
        c2.fillStyle = art.accent;
        c2.fillRect(eye[0] - 0.6, eye[1] - 0.6, 1.2, 1.2);
        break;
      }
      case "imp": {
        const hop = Math.abs(Math.sin(gait)) * moving * 2 + lunge * 2;
        for (const side of [-1, 1])
          taper(c2, [side * 2.6, -5], [side * 3.4 + Math.sin(gait + side) * moving * 2, -1], 2.2, 1.4, dark);
        polygon(c2, [[-4.4, -12 - hop], [4.4, -12 - hop], [5.4, -4], [-5.4, -4]], tint);
        polygon(c2, [[-3, -11 - hop], [3, -11 - hop], [3.6, -5], [-3.6, -5]], dark);
        polygon(c2, [[-4.6, -20 - hop], [4.6, -20 - hop], [5.6, -13 - hop], [-5.6, -13 - hop]], tint);
        for (const side of [-1, 1])
          polygon(c2, [[side * 4, -19 - hop], [side * 7.4, -23 - hop], [side * 5.6, -17.4 - hop]], dark);
        c2.fillStyle = art.accent;
        c2.fillRect(-2.4, -17.4 - hop, 1.5, 1.5);
        c2.fillRect(1, -17.4 - hop, 1.5, 1.5);
        break;
      }
      case "brute": {
        const sway = Math.sin(gait * 0.5) * moving * 1.2;
        for (const side of [-1, 1])
          taper(c2, [side * 3.4, -8], [side * 4.4 + Math.sin(gait + side * Math.PI) * moving * 2.4, -1], 3.6, 2.4, dark);
        for (const side of [-1, 1])
          taper(c2, [side * 6.4 + sway, -20], [side * (8.4 + lunge * 3) + sway, -9 - lunge * 3], 3.4, 2.2, dark);
        if (art.wings) for (const side of [-1, 1])
          polygon(c2, [[side * 5 + sway, -22], [side * 15 + sway, -26 + Math.sin(t * 3 + ally.id) * 1.5], [side * 17 + sway, -16], [side * 9 + sway, -14]], dark);
        polygon(c2, [[-7 + sway, -24], [7 + sway, -24], [8.6 + sway, -8], [-8.6 + sway, -8]], tint);
        polygon(c2, [[-4.6 + sway, -23], [4.6 + sway, -23], [5.6 + sway, -10], [-5.6 + sway, -10]], dark);
        if (art.plates) for (const side of [-1, 1]) {
          polygon(c2, [[side * 4 + sway, -25], [side * 10 + sway, -26], [side * 11 + sway, -19], [side * 5 + sway, -18]], dark);
          polygon(c2, [[side * 5.5 + sway, -24], [side * 9 + sway, -24.6], [side * 9.6 + sway, -20], [side * 6 + sway, -19.6]], tint);
        }
        else for (const side of [-1, 1])
          polygon(c2, [[side * 4.4 + sway, -24], [side * 8.4 + sway, -28.4], [side * 7 + sway, -22.4]], dark);
        polygon(c2, [[-3 + sway, -30], [3 + sway, -30], [4 + sway, -23.4], [-4 + sway, -23.4]], tint);
        if (art.horns) for (const side of [-1, 1])
          polygon(c2, [[side * 2.4 + sway, -29], [side * 6.5 + sway, -34], [side * 4.6 + sway, -27.6]], dark);
        if (art.flames) for (const side of [-1, 1]) {
          const flick = Math.sin(t * 9 + ally.id + side) * 1.2;
          polygon(c2, [[side * 5 + sway, -24], [side * 7 + sway + flick, -31], [side * 8.6 + sway, -23]], art.accent);
        }
        c2.fillStyle = art.accent;
        c2.fillRect(-2 + sway, -27.4, 1.4, 1.4);
        c2.fillRect(0.8 + sway, -27.4, 1.4, 1.4);
        break;
      }
      case "floater": {
        const hover = 4 + bob;
        c2.globalAlpha *= 0.5;
        c2.fillStyle = dark;
        c2.beginPath();
        c2.ellipse(0, -10 - hover, 8.6, 6.4, 0, 0, TAU);
        c2.fill();
        c2.globalAlpha /= 0.5;
        c2.fillStyle = tint;
        c2.beginPath();
        c2.ellipse(0, -12 - hover, 7.4, 6, 0, 0, TAU);
        c2.fill();
        c2.fillStyle = dark;
        c2.beginPath();
        c2.ellipse(0, -9 - hover, 5.4, 3.6, 0, 0, TAU);
        c2.fill();
        for (const side of [-1, 1])
          taper(c2, [side * 6, -13 - hover], [side * 9, -8 - hover + Math.sin(t * 2.4 + side) * 1.4], 2.6, 1.4, dark);
        c2.fillStyle = art.accent;
        c2.fillRect(-2.4, -14.4 - hover, 1.6, 1.6);
        c2.fillRect(0.9, -14.4 - hover, 1.6, 1.6);
        for (let i2 = 0; i2 < 3; i2++) {
          const a = t * 1.6 + i2 * TAU / 3;
          c2.globalAlpha = fade * 0.5;
          c2.fillStyle = art.accent;
          c2.fillRect(Math.cos(a) * 10 - 0.7, -11 - hover + Math.sin(a) * 4 - 0.7, 1.4, 1.4);
        }
        break;
      }
      case "elemental": {
        const swirl = Math.sin(t * 2.6 + ally.id) * 1.4;
        for (let i2 = 0; i2 < 3; i2++) {
          const w = 7.4 - i2 * 1.8, ringY = -4 - i2 * 6 - bob * 0.5;
          c2.fillStyle = i2 % 2 ? tint : dark;
          c2.beginPath();
          c2.ellipse(swirl * (i2 % 2 ? -1 : 1) * 0.4, ringY, w, w * 0.55, 0, 0, TAU);
          c2.fill();
        }
        polygon(c2, [[-3.4, -22 - bob], [3.4, -22 - bob], [4.6, -16 - bob], [-4.6, -16 - bob]], tint);
        polygon(c2, [[-1.6, -25 - bob], [1.6, -25 - bob], [2.6, -21 - bob], [-2.6, -21 - bob]], dark);
        for (const side of [-1, 1])
          taper(c2, [side * 5, -15 - bob], [side * (8 + lunge * 3), -8 - bob - lunge * 2], 2.2, 1, tint);
        if (art.flames) for (let i2 = 0; i2 < 3; i2++) {
          const flick = Math.sin(t * 9 + ally.id + i2 * 2) * 1.4;
          polygon(c2, [[-4 + i2 * 4 - 1.2, -25 - bob], [-4 + i2 * 4 + flick, -31 - bob], [-4 + i2 * 4 + 1.2, -25 - bob]], art.accent);
        }
        c2.fillStyle = art.accent;
        c2.fillRect(-1.8, -23.4 - bob, 1.3, 1.3);
        c2.fillRect(0.7, -23.4 - bob, 1.3, 1.3);
        break;
      }
      case "humanoid": {
        const step = Math.sin(gait) * moving * 2.2;
        const hunch = art.hunched ? 3 : 0;
        for (const side of [-1, 1])
          taper(c2, [side * 2.4, -9], [side * 3 + step * side, -1], 2.6, 1.8, dark);
        for (const side of [-1, 1])
          taper(c2, [side * 4.6, -19 + hunch], [side * (6.4 + lunge * 3 + hunch), -10 - lunge * 2 + hunch * 0.6], 2.2, 1.4, tint);
        if (art.wings) for (const side of [-1, 1])
          polygon(c2, [[side * 3.5, -19], [side * 10, -23 + Math.sin(t * 3 + ally.id) * 1.2], [side * 11.5, -14], [side * 6, -12]], dark);
        polygon(c2, [[-4.6, -21 + hunch], [4.6, -21 + hunch], [5.6, -8], [-5.6, -8]], tint);
        polygon(c2, [[-3, -20 + hunch], [3, -20 + hunch], [3.8, -10], [-3.8, -10]], dark);
        polygon(c2, [[-3.2 + hunch, -27 + hunch], [3.2 + hunch, -27 + hunch], [3.8 + hunch, -20.4 + hunch], [-3.8 + hunch, -20.4 + hunch]], tint);
        c2.fillStyle = art.accent;
        c2.fillRect(-1.9 + hunch, -24.6 + hunch, 1.3, 1.3);
        c2.fillRect(0.7 + hunch, -24.6 + hunch, 1.3, 1.3);
        break;
      }
      case "treant": {
        const sway = Math.sin(gait * 0.5) * moving * 1;
        for (const side of [-1, 1])
          taper(c2, [side * 2.2, -6], [side * 3.4 + Math.sin(gait + side) * moving * 1.6, -1], 2.6, 1.8, dark);
        polygon(c2, [[-5 + sway, -20], [5 + sway, -20], [6.5, -5], [-6.5, -5]], tint);
        polygon(c2, [[-3 + sway, -19], [3 + sway, -19], [4, -7], [-4, -7]], dark);
        for (const side of [-1, 1]) {
          taper(c2, [side * 4.5 + sway, -17], [side * (8 + lunge * 3) + sway, -10 - lunge * 2], 2, 1.2, tint);
          taper(c2, [side * (8 + lunge * 3) + sway, -10 - lunge * 2], [side * (10 + lunge * 3) + sway, -13 - lunge * 2], 1, 0.5, dark);
        }
        polygon(c2, [[-2.5 + sway, -24], [2.5 + sway, -24], [3 + sway, -19.5], [-3 + sway, -19.5]], tint);
        for (const side of [-1, 0, 1])
          polygon(c2, [[side * 3 + sway, -23], [side * 5.5 + sway, -28 - (side === 0 ? 2 : 0)], [side * 1.5 + sway, -26]], art.accent);
        c2.fillStyle = "#ffe8a0";
        c2.fillRect(-1.7 + sway, -22.6, 1.2, 1.2);
        c2.fillRect(0.6 + sway, -22.6, 1.2, 1.2);
        break;
      }
      case "gargoyle": {
        const hover = 6 + bob * 1.2;
        const flap = Math.sin(t * 7 + ally.id);
        for (const side of [-1, 1])
          taper(c2, [side * 1.8, -6 - hover * 0.3], [side * 2.4, -1 - hover * 0.3], 2, 1.4, dark);
        for (const side of [-1, 1]) {
          const lift = flap * 3;
          polygon(c2, [[side * 3.5, -15 - hover], [side * 11, -18 - hover + lift], [side * 14, -12 - hover + lift * 0.6], [side * 9, -10 - hover], [side * 6, -8 - hover]], dark);
        }
        polygon(c2, [[-4, -16 - hover], [4, -16 - hover], [5, -6 - hover], [-5, -6 - hover]], tint);
        polygon(c2, [[-3, -22 - hover], [3, -22 - hover], [3.6, -15.4 - hover], [-3.6, -15.4 - hover]], tint);
        for (const side of [-1, 1])
          polygon(c2, [[side * 2.6, -21.4 - hover], [side * 5.4, -25 - hover], [side * 4, -20 - hover]], dark);
        c2.fillStyle = art.accent;
        c2.fillRect(-1.8, -19.6 - hover, 1.3, 1.3);
        c2.fillRect(0.6, -19.6 - hover, 1.3, 1.3);
        break;
      }
      case "fiend": {
        const step = Math.sin(gait) * moving * 2.4;
        const lift = Math.abs(Math.cos(gait)) * moving * 1.2;
        const body = 6.5 + bob * 0.5 + lunge * 1.6;
        for (const side of [-1, 1]) for (const end of [-1, 1])
          taper(c2, at(end * 3.6, side * 2, body), at(end * 4 + step * (end === side ? -1 : 1), side * 2.6, lift * (end === side ? 1 : 0.4)), 2, 1.2, dark);
        taper(c2, at(-6, 0, body + 1), at(-11, 0.5, body + 3 + Math.sin(t * 5 + ally.id) * 1.4), 1.4, 0.3, art.accent);
        poly([[-6.5, -2.4, body + 0.6], [3, -2.8, body + 3.6], [7, 0, body + 2.6], [4, 2.8, body + 1], [-5, 2.4, body]], tint);
        for (const side of [-1, 1])
          taper(c2, at(4, side * 2.4, body + 2.4), at(8 + lunge * 3, side * 3.6, body - 2), 1.6, 0.8, dark);
        poly([[6, -1.8, body + 3.4], [9.5, -1.2, body + 4], [10.5, 1, body + 3], [6.5, 1.8, body + 2.2]], tint);
        const eye = at(8.6, -1, body + 3.6);
        c2.fillStyle = art.accent;
        c2.fillRect(eye[0] - 0.7, eye[1] - 0.7, 1.4, 1.4);
        break;
      }
      case "totem": {
        taper(c2, [0, -1], [0, -17], 4.6, 3.2, dark);
        taper(c2, [0, -3], [0, -15], 2.6, 1.6, tint);
        taper(c2, [-5, -12], [5, -12], 1.6, 1.6, tint);
        const pulse = 1 + Math.sin(t * 4 + ally.id) * 0.15;
        c2.save();
        c2.translate(0, -21);
        c2.scale(pulse, pulse);
        totemCrown(c2, art.crown ?? "orb", art.accent, dark);
        c2.restore();
        break;
      }
    }
    if (art.glow) drawGlow(c2, 0, -12, 15 * art.glow * 3, art.accent, art.glow * 0.5);
    c2.restore();
  }

  // iconreview-tmp/ally-entry.ts
  var kinds = Object.keys(ALLY_TEMPLATES);
  var cv = document.getElementById("c");
  var cols = 8;
  var cw = 110;
  var ch = 110;
  cv.width = cols * cw;
  cv.height = Math.ceil(kinds.length / cols) * ch;
  var c = cv.getContext("2d");
  c.fillStyle = "#0b1520";
  c.fillRect(0, 0, cv.width, cv.height);
  var i = 0;
  for (const kind of kinds) {
    const t = ALLY_TEMPLATES[kind];
    const x = i % cols * cw + cw / 2, y = Math.floor(i / cols) * ch + ch - 26;
    const ally = {
      id: i + 1,
      kind,
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      angle: -Math.PI / 2 + Math.PI / 2,
      hp: 10,
      maxHp: 10,
      radius: t.radius,
      attackCooldown: 0,
      remaining: void 0,
      ...t.aura ? { aura: { ...t.aura } } : {}
    };
    ally.angle = 0;
    drawAlly(c, ally, x, y, 1.3, false);
    c.fillStyle = "#9ab";
    c.font = "9px sans-serif";
    c.textAlign = "center";
    c.fillText(kind, x, y + 14);
    i++;
  }
  document.done = true;
})();
