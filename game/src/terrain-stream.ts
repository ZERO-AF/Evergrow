export interface TerrainCoordinate { x: number; y: number; }
interface Tile { bitmap: ImageBitmap; ready: number; }
interface Port { postMessage(value: unknown): void; terminate(): void; onmessage: ((event: MessageEvent<{ id: number; bitmap?: ImageBitmap; error?: boolean }>) => void) | null; onerror: ((event: ErrorEvent) => void) | null; }
/** Numeric tile identity: matches ground-layer's tileKey, no string per tile per frame. */
const tileKey = (x: number, y: number) => x * 1048576 + (y + 524288);
/** One in-flight job, nearest visible tiles first, bounded ownership of transferable bitmaps. */
export class TerrainStream {
  private port: Port;
  private tiles = new Map<number, Tile>();
  private wanted = new Map<number, TerrainCoordinate>();
  private pending: { id: number; key: number } | null = null;
  private serial = 0;
  private seed = 0;
  private wildernessOnly = false;
  private centerX = 0;
  private centerY = 0;
  private riftTerrain = false;
  private authored = false;
  failed = false;
  constructor(create: () => Port = () => new Worker(new URL('./terrain-worker.ts', import.meta.url), { type: 'module' })) {
    this.port = create();
    this.port.onmessage = ({ data }) => {
      if (!this.pending || data.id !== this.pending.id) { data.bitmap?.close(); return; }
      const { key } = this.pending; this.pending = null;
      if (data.error || !data.bitmap) { this.failed = true; this.dispose(); return; }
      if (this.wanted.has(key)) {
        this.tiles.get(key)?.bitmap.close(); this.tiles.set(key, { bitmap: data.bitmap, ready: performance.now() });
      } else data.bitmap.close();
      this.pump();
    };
    this.port.onerror = () => { this.failed = true; this.dispose(); };
  }
  get size() { return this.tiles.size; }
  get queued() { return this.wanted.size - this.tiles.size; }
  update(seed: number, coordinates: readonly TerrainCoordinate[], wildernessOnly = false, riftTerrain = false, authored = false) {
    // World parameters are part of tile identity; a change invalidates every
    // cached bitmap at once instead of churning string keys per tile.
    if (seed !== this.seed || wildernessOnly !== this.wildernessOnly
      || riftTerrain !== this.riftTerrain || authored !== this.authored) {
      for (const tile of this.tiles.values()) tile.bitmap.close();
      this.tiles.clear();
      // The in-flight job was issued under the old parameters; drop it so its
      // reply is discarded rather than adopted under the new mode.
      this.pending = null;
      this.seed = seed; this.wildernessOnly = wildernessOnly;
      this.riftTerrain = riftTerrain; this.authored = authored;
    }
    this.wanted.clear();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of coordinates.slice(0, 256)) {
      this.wanted.set(tileKey(p.x, p.y), p);
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    this.centerX = (minX + maxX) / 2; this.centerY = (minY + maxY) / 2;
    for (const [key, tile] of this.tiles) if (!this.wanted.has(key)) { tile.bitmap.close(); this.tiles.delete(key); }
    this.pump();
  }
  get(x: number, y: number) { return this.tiles.get(tileKey(x, y)); }
  private pump() {
    if (this.failed || this.pending) return;
    // Nearest to the view center first; `wanted` insertion order is scan order, not priority.
    let next: { key: number; p: TerrainCoordinate } | null = null, best = Infinity;
    for (const [key, p] of this.wanted) if (!this.tiles.has(key)) {
      const d = (p.x - this.centerX) ** 2 + (p.y - this.centerY) ** 2;
      if (d < best) { best = d; next = { key, p }; }
    }
    if (!next) return;
    this.pending = { id: ++this.serial, key: next.key }; this.port.postMessage({ id: this.serial, seed: this.seed, wildernessOnly: this.wildernessOnly, riftTerrain: this.riftTerrain, authored: this.authored, ...next.p });
  }
  dispose() { this.port.terminate(); for (const tile of this.tiles.values()) tile.bitmap.close(); this.tiles.clear(); this.wanted.clear(); this.pending = null; }
}
