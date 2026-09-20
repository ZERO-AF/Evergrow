import { polygon, line } from './art-primitives.ts';
import type { Room, DungeonFloor } from './dungeon.ts';
import { cryptHash } from './dungeon-contours.ts';
import { drawGlow } from './lighting.ts';
import { BLACKROCK_DEPTHS } from './dungeon2-content.ts';

/**
 * Blackrock Depths theme art (docs/wow-deepening.md §16). Each function is a
 * drop-in branch for an existing theme switch — the integrator calls them only
 * when the floor's theme is BLACKROCK_THEME_ID, so nothing here runs for other
 * themes or before registration. Colors come from BLACKROCK_DEPTHS directly
 * (never dungeonTheme(), which only resolves after registration).
 */

/**
 * Dark Iron forge-mouth: a squat basalt arch with a magma throat, rune-lit
 * pillars and a hanging chain. Drawn inside drawCryptGate's theme branch — the
 * context is already translated to the gate origin; steps, torches and the
 * threshold glow stay shared.
 */
export function drawBlackrockGate(c: CanvasRenderingContext2D) {
    const poly = (pts: number[][], fill: string) => polygon(c, pts as [number, number][], fill);
    const stone = `rgb(${BLACKROCK_DEPTHS.stone.map(v => v + 35).join(',')})`;
    // Slag-crusted arch, wider and lower than the crypt silhouette.
    poly([[-72, 8], [-70, -62], [-46, -96], [46, -96], [70, -62], [72, 8]], '#2c2224');
    poly([[-56, 6], [-54, -56], [-36, -80], [36, -80], [54, -56], [56, 6]], stone);
    // The throat: a forge mouth with a magma lip instead of a dark doorway.
    poly([[-38, 6], [-37, -50], [-20, -66], [20, -66], [37, -50], [38, 6]], '#0a0708');
    poly([[-30, 6], [-29, -14], [29, -14], [30, 6]], '#571d0c');
    poly([[-24, 6], [-23, -8], [23, -8], [24, 6]], '#a33d12');
    for (let i = 0; i < 5; i++)
        poly([[-20 + i * 9, 5], [-17 + i * 9, -6 - (i % 2) * 3], [-13 + i * 9, 5]], '#ff9a3e');
    // Rune-lit basalt pillars and bolted plates.
    for (const side of [-1, 1]) {
        poly([[side * 50 - 8, 6], [side * 50 - 7, -74], [side * 50 + 7, -74], [side * 50 + 8, 6]], '#3a2c2c');
        line(c, [[side * 50 - 6, -70], [side * 50 + 6, -70]], '#6b4a34', 2);
        for (let y = -62; y < -4; y += 14) {
            c.fillStyle = '#ff8a4a';
            c.fillRect(side * 50 - 1.5, y, 3, 5);
        }
        poly([[side * 62 - 5, -34], [side * 62 + 5, -30], [side * 62 + 6, -12], [side * 62 - 6, -14]], '#4a3a33');
    }
    // Hanging chain and the Black Anvil lintel.
    line(c, [[-26, -88], [26, -88]], '#8a5a38', 4);
    poly([[-18, -88], [-8, -102], [8, -102], [18, -88], [8, -84], [-8, -84]], '#57443c');
    for (let i = 0; i < 4; i++) {
        c.strokeStyle = '#241c1c';
        c.lineWidth = 3;
        c.beginPath();
        c.ellipse(0, -80 + i * 9, 3.5, 5, i % 2 ? 1.57 : 0, 0, 7);
        c.stroke();
    }
    poly([[-5, -46], [0, -52], [5, -46], [4, -38], [-4, -38]], '#3a2c2c');
}

/**
 * Per-room floor dressing, drawn inside drawCryptDecor's clipped room pass
 * (same slot as the rootbound drag marks): slag channels with charred lips,
 * ember seams and scorch rings. Boss rooms get the Black Forge arena ring.
 */
export function drawBlackrockFloorDecor(c: CanvasRenderingContext2D, r: Room, seed: number) {
    if (r.kind === 'boss') {
        // The Black Forge: a broken magma ring around the arena center.
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        c.save();
        c.translate(cx, cy);
        for (const [radius, width, color] of [[150, 7, '#2a1512'], [150, 3, '#ff7a34'], [205, 5, '#24100e'], [205, 2, '#c9501f']] as const) {
            c.strokeStyle = color;
            c.lineWidth = width;
            for (let i = 0; i < 6; i++) {
                const a = i * Math.PI / 3 + .22;
                c.beginPath();
                c.arc(0, 0, radius, a, a + .82);
                c.stroke();
            }
        }
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            line(c, [[Math.cos(a) * 168, Math.sin(a) * 168], [Math.cos(a) * 190, Math.sin(a) * 190]], '#ff8a4a66', 2);
        }
        c.restore();
        return;
    }
    // Slag channels: jagged runs with a charred lip, a hot core and ember seams.
    const count = 2 + cryptHash(r.id, 17, seed) % 2;
    for (let i = 0; i < count; i++) {
        const h = cryptHash(r.id, i * 31 + 5, seed);
        const x0 = r.x + 40 + h % Math.max(60, r.width - 140), y0 = r.y + 40 + (h >>> 9) % Math.max(60, r.height - 140);
        const pts: [number, number][] = [[x0, y0]];
        let x = x0, y = y0;
        const dir = (h >>> 16) % 4, steps = 3 + (h >>> 20) % 3;
        for (let s = 0; s < steps; s++) {
            const j = cryptHash(r.id, i * 7 + s, seed);
            x += (dir === 1 ? -1 : 1) * (26 + j % 42) * (dir === 2 ? .35 : 1);
            y += (dir === 3 ? -1 : 1) * (20 + (j >>> 8) % 34) * (dir === 0 ? .35 : 1);
            pts.push([x, y]);
        }
        line(c, pts, '#160b0a', 9);
        line(c, pts, '#4a1608', 5);
        line(c, pts, '#ff7a34', 2);
        for (const [px, py] of pts) {
            const e = cryptHash(px | 0, py | 0, seed);
            c.fillStyle = '#ffb066';
            c.fillRect(px - 1 + e % 5 - 2, py - 1 + (e >>> 8) % 5 - 2, 2, 2);
        }
    }
    // Scorch rings where the forge breathed on the flagstones.
    for (let i = 0; i < 3; i++) {
        const h = cryptHash(r.id, i * 53 + 11, seed);
        const x = r.x + 50 + h % Math.max(60, r.width - 100), y = r.y + 50 + (h >>> 10) % Math.max(60, r.height - 100);
        c.strokeStyle = '#120a0955';
        c.lineWidth = 3 + h % 4;
        c.beginPath();
        c.ellipse(x, y, 14 + (h >>> 6) % 22, 9 + (h >>> 12) % 14, (h % 10) * .3, 0, 7);
        c.stroke();
    }
}

/**
 * Basalt tile grid and magma seams for the clipped floor pass in
 * drawCryptSurface — same world-space overlay slot as the foundry/drowned
 * branches. (ox, oy, size) are the tile crop's world coordinates.
 */
export function drawBlackrockSurface(c: CanvasRenderingContext2D, f: DungeonFloor, ox: number, oy: number, size: number) {
    // Dark Iron pavers: large basalt slabs with hot seams between courses.
    for (let y = Math.floor(oy / 96) * 96; y < oy + size; y += 96)
        for (let x = Math.floor(ox / 112) * 112; x < ox + size; x += 112) {
            const h = cryptHash(x, y, f.seed);
            if (h % 3)
                continue;
            c.fillStyle = '#241d1df0';
            c.fillRect(x + 4, y + 4, 100, 84);
            c.strokeStyle = '#8a5a3844';
            c.lineWidth = 2;
            c.strokeRect(x + 5, y + 5, 99, 83);
            if (h % 7 === 0) {
                c.strokeStyle = '#ff7a3455';
                c.lineWidth = 1.5;
                c.beginPath();
                c.moveTo(x + 12, y + 46);
                c.lineTo(x + 44, y + 40 + (h >>> 8) % 16);
                c.lineTo(x + 92, y + 48);
                c.stroke();
            }
        }
    // Magma seams bleeding through the flagstones.
    for (let y = Math.floor(oy / 176) * 176; y < oy + size; y += 176)
        for (let x = Math.floor(ox / 208) * 208; x < ox + size; x += 208) {
            const h = cryptHash(x, y, f.seed);
            if (h % 4)
                continue;
            const pts: [number, number][] = [[x + 20, y + 60], [x + 70, y + 52 + (h >>> 7) % 26], [x + 130, y + 66], [x + 180, y + 50 + (h >>> 11) % 30]];
            line(c, pts, '#1a0c0a', 8);
            line(c, pts, '#571d0c', 4);
            line(c, pts, '#ff8a3e', 1.5);
        }
    // Ash drifts settling in the corners.
    for (let y = Math.floor(oy / 224) * 224; y < oy + size; y += 224)
        for (let x = Math.floor(ox / 224) * 224; x < ox + size; x += 224) {
            const h = cryptHash(x, y, f.seed);
            if (h % 3)
                continue;
            c.fillStyle = '#0d080730';
            c.beginPath();
            c.ellipse(x + 90, y + 110, 70, 22, .3, 0, 7);
            c.fill();
        }
}

/**
 * Emission pass: slag glows and drifting ember motes, called after
 * drawCryptEmission for blackrock floors (same view-culling contract).
 */
export function drawBlackrockEmission(c: CanvasRenderingContext2D, f: DungeonFloor, time: number, view: { left: number; top: number; width: number; height: number }) {
    for (const r of f.rooms) {
        if (r.x > view.left + view.width + 60 || r.x + r.width < view.left - 60 || r.y > view.top + view.height + 60 || r.y + r.height < view.top - 60)
            continue;
        // Low breathing glow over each slag channel.
        for (let i = 0; i < 3; i++) {
            const h = cryptHash(r.id, i * 31 + 5, f.seed);
            const x = r.x + 40 + h % Math.max(60, r.width - 140), y = r.y + 40 + (h >>> 9) % Math.max(60, r.height - 140);
            drawGlow(c, x, y, 46, '#ff6a28', .16 + Math.sin(time * 1.7 + i * 2.1 + r.id) * .06);
        }
        // Ember motes rising off the hot floor.
        for (let i = 0; i < 6; i++) {
            const h = cryptHash(r.id, i * 97 + 3, f.seed);
            const life = (time * (.18 + (h % 5) * .03) + i / 6 + (h >>> 12) % 1) % 1;
            const x = r.x + 30 + (h >>> 4) % Math.max(60, r.width - 60) + Math.sin(life * 9 + i) * 8;
            const y = r.y + 30 + (h >>> 14) % Math.max(60, r.height - 60) - life * 64;
            c.globalAlpha = (1 - life) * .75;
            c.fillStyle = i % 2 ? '#ffb066' : '#ff7a34';
            c.fillRect(x, y, 1.6, 2.6 * (1 - life) + .6);
        }
        c.globalAlpha = 1;
    }
}
