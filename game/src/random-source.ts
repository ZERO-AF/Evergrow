/** Deterministic RNG and hash stack. Every stream is a pure function of its
 * seed so rolled equipment, world generation and encounter rolls stay
 * independent of each other and of combat randomness. */
import { smoothstep } from './art-primitives.ts';

const UINT_RANGE = 0x100000000;

/** mulberry32: the default seeded stream for loot, layout and art variation. */
export function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let n = Math.imul(state ^ state >>> 15, state | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

/** Numerical Recipes LCG: the dungeon/rift layout stream. */
export function lcgRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Single-value integer hash (two-round xorshift multiply). */
export function hash1(seed: number): number {
  let n = seed | 0;
  n = Math.imul(n ^ n >>> 16, 0x45d9f3b);
  n = Math.imul(n ^ n >>> 16, 0x45d9f3b);
  return (n ^ n >>> 16) >>> 0;
}

/** 2D integer hash; the high coordinate bits are mixed in so the field does
 * not repeat every 2^32 cells. */
export function hash2(x: number, y: number, seed: number, salt = 0): number {
  let value = (seed ^ salt ^ Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x27d4eb2d)
    ^ Math.imul(Math.floor(x / UINT_RANGE), 0x165667b1)
    ^ Math.imul(Math.floor(y / UINT_RANGE), 0x85ebca77)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

/** hash2 normalized to [0, 1). */
export function random2(x: number, y: number, seed: number, salt = 0): number {
  return hash2(x, y, seed, salt) / UINT_RANGE;
}

/** Smoothstep-interpolated 2D value noise over the hash2 lattice. */
export function noise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const tx = smoothstep(0, 1, x - ix);
  const ty = smoothstep(0, 1, y - iy);
  const a = random2(ix, iy, seed);
  const b = random2(ix + 1, iy, seed);
  const c = random2(ix, iy + 1, seed);
  const d = random2(ix + 1, iy + 1, seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
