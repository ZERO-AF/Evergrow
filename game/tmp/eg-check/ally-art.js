"use strict";
import { drawGlow } from "./lighting.ts";
import { clamp, mixColor, polygon, taper, TAU } from "./art-primitives.ts";
import { ALLY_TEMPLATES } from "./wow-allies.ts";
const ALLY_ART = Object.freeze({
  imp: { shape: "imp", accent: "#ff9a4e", glow: 0.3 },
  felhunter: { shape: "quadruped", accent: "#b08ae0", glow: 0.18 },
  felguard: { shape: "brute", accent: "#b08ae0", glow: 0.22 },
  voidwalker: { shape: "floater", accent: "#8a6fd0", glow: 0.28 },
  wolf: { shape: "quadruped", accent: "#8fd06a" },
  bear: { shape: "quadruped", accent: "#8fd06a" },
  cat: { shape: "quadruped", accent: "#8fd06a" },
  ghoul: { shape: "humanoid", accent: "#b08ae0", glow: 0.16 },
  waterElemental: { shape: "elemental", accent: "#8ee7ff", glow: 0.3 },
  mirrorImage: { shape: "humanoid", accent: "#a894ec", glow: 0.24, spectral: true },
  searingTotem: { shape: "totem", accent: "#ff9a4e", glow: 0.3 },
  healingTotem: { shape: "totem", accent: "#8ee7ff", glow: 0.26 },
  earthbindTotem: { shape: "totem", accent: "#8fd06a", glow: 0.2 },
  spiritWolf: { shape: "quadruped", accent: "#8ee7ff", glow: 0.26, spectral: true },
  infernal: { shape: "brute", accent: "#ff9a4e", glow: 0.34 }
});
export function drawAlly(c, ally, x, y, time, reducedMotion = false) {
  const art = ALLY_ART[ally.kind];
  const tint = ALLY_TEMPLATES[ally.kind].color;
  const dark = mixColor(tint, "#0a0d12", 0.55);
  const t = reducedMotion ? 0 : time;
  const fade = ally.remaining !== void 0 ? clamp(ally.remaining / 0.8) : 1;
  const moving = clamp(Math.hypot(ally.x - ally.prevX, ally.y - ally.prevY) / 3.2);
  const gait = t * 9 + ally.id * 1.7;
  const bob = Math.sin(t * 3 + ally.id) * 1.2;
  const lunge = clamp(ally.attackCooldown * 2.4) * 0.8;
  const forward = [Math.cos(ally.angle), Math.sin(ally.angle) * 0.55];
  const across = [-Math.sin(ally.angle), Math.cos(ally.angle) * 0.55];
  const at = (px, py, z) => [forward[0] * px + across[0] * py, forward[1] * px + across[1] * py - z];
  const poly = (points, fill) => polygon(c, points.map((q) => at(...q)), fill);
  c.save();
  c.translate(x, y);
  c.globalAlpha = fade * (art.spectral ? 0.78 : 1);
  c.fillStyle = "#02091180";
  c.beginPath();
  c.ellipse(0, 2, ally.radius * 0.9, ally.radius * 0.38, 0, 0, TAU);
  c.fill();
  if (ally.aura) {
    c.globalAlpha = fade * 0.12;
    c.strokeStyle = art.accent;
    c.lineWidth = 1.2;
    c.beginPath();
    c.ellipse(0, 0, ally.aura.radius, ally.aura.radius * 0.45, 0, 0, TAU);
    c.stroke();
    c.globalAlpha = fade * (art.spectral ? 0.78 : 1);
  }
  const s = ally.radius / 11;
  c.scale(s, s);
  switch (art.shape) {
    case "quadruped": {
      const step = Math.sin(gait) * moving * 2.6;
      const lift = Math.abs(Math.cos(gait)) * moving * 1.4;
      const body = 9 + bob * 0.4 + lunge * 2;
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        const stride = step * (end === side ? -1 : 1);
        taper(c, at(end * 4.5, side * 2.4, body), at(end * 5 + stride, side * 3, lift * (end === side ? 1 : 0.4)), 2.4, 1.4, dark);
      }
      taper(c, at(-7, 0, body + 1), at(-12, 0.6, body + 4 + Math.sin(t * 4 + ally.id) * 1.2), 1.6, 0.7, dark);
      poly([[-8, -2.6, body + 2.4], [5, -2.6, body + 3], [8, 0, body + 1.6], [5, 2.6, body + 1], [-6, 2.6, body]], tint);
      poly([[-6, -2, body + 3.4], [4, -2, body + 4], [6.4, 0, body + 2.6], [-4, 1.6, body + 1.6]], dark);
      const head = body + 2 + lunge * 2;
      poly([[6, -2.2, head + 1], [9, -1.6, head + 3.4], [12.6, -1, head + 1.4], [12.6, 1, head + 1], [9, 2.4, head - 0.4], [6.4, 1.8, head - 0.8]], tint);
      poly([[7.4, -1.8, head + 3], [8.6, -2.2, head + 5.6], [9.8, -1.6, head + 3.2]], dark);
      poly([[7.4, 1.8, head + 3], [8.6, 2.2, head + 5.6], [9.8, 1.6, head + 3.2]], dark);
      const eye = at(10.4, -1.2, head + 1.6);
      c.fillStyle = art.accent;
      c.fillRect(eye[0] - 0.7, eye[1] - 0.7, 1.4, 1.4);
      break;
    }
    case "imp": {
      const hop = Math.abs(Math.sin(gait)) * moving * 2 + lunge * 2;
      for (const side of [-1, 1])
        taper(c, [side * 2.6, -5], [side * 3.4 + Math.sin(gait + side) * moving * 2, -1], 2.2, 1.4, dark);
      polygon(c, [[-4.4, -12 - hop], [4.4, -12 - hop], [5.4, -4], [-5.4, -4]], tint);
      polygon(c, [[-3, -11 - hop], [3, -11 - hop], [3.6, -5], [-3.6, -5]], dark);
      polygon(c, [[-4.6, -20 - hop], [4.6, -20 - hop], [5.6, -13 - hop], [-5.6, -13 - hop]], tint);
      for (const side of [-1, 1])
        polygon(c, [[side * 4, -19 - hop], [side * 7.4, -23 - hop], [side * 5.6, -17.4 - hop]], dark);
      c.fillStyle = art.accent;
      c.fillRect(-2.4, -17.4 - hop, 1.5, 1.5);
      c.fillRect(1, -17.4 - hop, 1.5, 1.5);
      break;
    }
    case "brute": {
      const sway = Math.sin(gait * 0.5) * moving * 1.2;
      for (const side of [-1, 1])
        taper(c, [side * 3.4, -8], [side * 4.4 + Math.sin(gait + side * Math.PI) * moving * 2.4, -1], 3.6, 2.4, dark);
      for (const side of [-1, 1])
        taper(c, [side * 6.4 + sway, -20], [side * (8.4 + lunge * 3) + sway, -9 - lunge * 3], 3.4, 2.2, dark);
      polygon(c, [[-7 + sway, -24], [7 + sway, -24], [8.6 + sway, -8], [-8.6 + sway, -8]], tint);
      polygon(c, [[-4.6 + sway, -23], [4.6 + sway, -23], [5.6 + sway, -10], [-5.6 + sway, -10]], dark);
      for (const side of [-1, 1])
        polygon(c, [[side * 4.4 + sway, -24], [side * 8.4 + sway, -28.4], [side * 7 + sway, -22.4]], dark);
      polygon(c, [[-3 + sway, -30], [3 + sway, -30], [4 + sway, -23.4], [-4 + sway, -23.4]], tint);
      c.fillStyle = art.accent;
      c.fillRect(-2 + sway, -27.4, 1.4, 1.4);
      c.fillRect(0.8 + sway, -27.4, 1.4, 1.4);
      break;
    }
    case "floater": {
      const hover = 4 + bob;
      c.globalAlpha *= 0.5;
      c.fillStyle = dark;
      c.beginPath();
      c.ellipse(0, -10 - hover, 8.6, 6.4, 0, 0, TAU);
      c.fill();
      c.globalAlpha /= 0.5;
      c.fillStyle = tint;
      c.beginPath();
      c.ellipse(0, -12 - hover, 7.4, 6, 0, 0, TAU);
      c.fill();
      c.fillStyle = dark;
      c.beginPath();
      c.ellipse(0, -9 - hover, 5.4, 3.6, 0, 0, TAU);
      c.fill();
      for (const side of [-1, 1])
        taper(c, [side * 6, -13 - hover], [side * 9, -8 - hover + Math.sin(t * 2.4 + side) * 1.4], 2.6, 1.4, dark);
      c.fillStyle = art.accent;
      c.fillRect(-2.4, -14.4 - hover, 1.6, 1.6);
      c.fillRect(0.9, -14.4 - hover, 1.6, 1.6);
      for (let i = 0; i < 3; i++) {
        const a = t * 1.6 + i * TAU / 3;
        c.globalAlpha = fade * 0.5;
        c.fillStyle = art.accent;
        c.fillRect(Math.cos(a) * 10 - 0.7, -11 - hover + Math.sin(a) * 4 - 0.7, 1.4, 1.4);
      }
      break;
    }
    case "elemental": {
      const swirl = Math.sin(t * 2.6 + ally.id) * 1.4;
      for (let i = 0; i < 3; i++) {
        const w = 7.4 - i * 1.8, ringY = -4 - i * 6 - bob * 0.5;
        c.fillStyle = i % 2 ? tint : dark;
        c.beginPath();
        c.ellipse(swirl * (i % 2 ? -1 : 1) * 0.4, ringY, w, w * 0.55, 0, 0, TAU);
        c.fill();
      }
      polygon(c, [[-3.4, -22 - bob], [3.4, -22 - bob], [4.6, -16 - bob], [-4.6, -16 - bob]], tint);
      polygon(c, [[-1.6, -25 - bob], [1.6, -25 - bob], [2.6, -21 - bob], [-2.6, -21 - bob]], dark);
      for (const side of [-1, 1])
        taper(c, [side * 5, -15 - bob], [side * (8 + lunge * 3), -8 - bob - lunge * 2], 2.2, 1, tint);
      c.fillStyle = art.accent;
      c.fillRect(-1.8, -23.4 - bob, 1.3, 1.3);
      c.fillRect(0.7, -23.4 - bob, 1.3, 1.3);
      break;
    }
    case "humanoid": {
      const step = Math.sin(gait) * moving * 2.2;
      for (const side of [-1, 1])
        taper(c, [side * 2.4, -9], [side * 3 + step * side, -1], 2.6, 1.8, dark);
      for (const side of [-1, 1])
        taper(c, [side * 4.6, -19], [side * (6.4 + lunge * 3), -10 - lunge * 2], 2.2, 1.4, tint);
      polygon(c, [[-4.6, -21], [4.6, -21], [5.6, -8], [-5.6, -8]], tint);
      polygon(c, [[-3, -20], [3, -20], [3.8, -10], [-3.8, -10]], dark);
      polygon(c, [[-3.2, -27], [3.2, -27], [3.8, -20.4], [-3.8, -20.4]], tint);
      c.fillStyle = art.accent;
      c.fillRect(-1.9, -24.6, 1.3, 1.3);
      c.fillRect(0.7, -24.6, 1.3, 1.3);
      break;
    }
    case "totem": {
      taper(c, [0, -1], [0, -17], 4.6, 3.2, dark);
      taper(c, [0, -3], [0, -15], 2.6, 1.6, tint);
      taper(c, [-5, -12], [5, -12], 1.6, 1.6, tint);
      const pulse = 1 + Math.sin(t * 4 + ally.id) * 0.15;
      polygon(c, [[0, -20 * pulse], [2.6 * pulse, -17], [0, -14], [-2.6 * pulse, -17]], art.accent);
      c.fillStyle = art.accent;
      c.fillRect(-0.8, -18.4 * pulse, 1.6, 1.6);
      break;
    }
  }
  if (art.glow) drawGlow(c, 0, -12, 15 * art.glow * 3, art.accent, art.glow * 0.5);
  c.restore();
}
