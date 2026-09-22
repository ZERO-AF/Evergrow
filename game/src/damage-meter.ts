/**
 * Recount-style damage meter: a bounded ring of recent CombatEvents aggregated
 * into per-source, per-skill rows (total, per-second rate, share, hit/crit
 * counts, max hit) over an explicit segment or a rolling window.
 *
 * Headless and deterministic: callers stamp each pushed event with the sim
 * clock in milliseconds (`sim.time * 1000`); the meter never reads a clock.
 * Only meter-relevant events are stored — 'hit' (damage done, `allyId` splits
 * pets from the player), 'heal' and 'potion' life (healing done). 'hurt',
 * 'kill', 'avoid', 'block' and 'engagement' still count as combat activity so
 * the current-fight boundary tracks the real engagement, not just landed hits.
 */
import type { CombatEvent } from './model.ts';
import type { SkillId } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';

export type MeterMode = 'damage' | 'healing';
/** 'player' for the character; `ally:<entityId>` for pets, totems and summons. */
export type MeterSource = 'player' | `ally:${number}`;

export interface MeterSkillRow {
  /** SkillId, or a fallback key: 'melee' | 'attack' | 'dot' | 'heal' | 'potion' | 'reaction:<name>'. */
  readonly key: string;
  readonly label: string;
  readonly total: number;
  readonly hits: number;
  readonly crits: number;
  readonly maxHit: number;
  /** Fraction of the source's own total (0..1). */
  readonly share: number;
}

export interface MeterRow {
  readonly source: MeterSource;
  readonly name: string;
  readonly total: number;
  /** Total per second of in-combat time inside the queried window. */
  readonly perSecond: number;
  /** Fraction of the window's grand total (0..1). */
  readonly share: number;
  readonly hits: number;
  readonly crits: number;
  readonly maxHit: number;
  /** Per-skill breakdown, sorted by total descending. */
  readonly skills: readonly MeterSkillRow[];
}

export interface MeterSegment {
  readonly startMs: number;
  readonly endMs: number;
  /** In-combat span inside the window (>=1000 once any event matches). */
  readonly durationMs: number;
  readonly damage: readonly MeterRow[];
  readonly healing: readonly MeterRow[];
}

export interface DamageMeterOptions {
  /** Ring capacity in stored events. Default 2000. */
  readonly capacity?: number;
  /** Silence longer than this ends the current fight. Default 5000ms. */
  readonly fightGapMs?: number;
  /** Resolve a pet/ally source to a display name (e.g. from player.allies). */
  readonly sourceName?: (source: MeterSource) => string | undefined;
}

interface MeterEvent {
  readonly t: number;
  readonly mode: MeterMode;
  readonly source: MeterSource;
  readonly skill: string;
  readonly amount: number;
  readonly crit: boolean;
}

const DEFAULT_CAPACITY = 2000;
const DEFAULT_FIGHT_GAP_MS = 5000;
/** DPS/HPS denominator floor so a single instant hit doesn't read as infinite. */
const MIN_DURATION_MS = 1000;

const FALLBACK_LABELS: Record<string, string> = {
  melee: 'Melee',
  attack: 'Attack',
  dot: 'Periodic damage',
  heal: 'Healing',
  potion: 'Health Potion',
};

/** Events that keep a fight segment alive even though they store no row data. */
const ACTIVITY_TYPES: Record<string, true> = {
  hit: true, hurt: true, heal: true, potion: true,
  kill: true, engagement: true, avoid: true, block: true,
};

function skillLabel(key: string): string {
  const fallback = FALLBACK_LABELS[key];
  if (fallback) return fallback;
  if (key.startsWith('reaction:'))
    return key.slice(9).replace(/^./, c => c.toUpperCase());
  return SKILL_DEFINITIONS[key as SkillId]?.name ?? key;
}

interface SourceAgg {
  total: number; hits: number; crits: number; maxHit: number;
  skills: Map<string, { total: number; hits: number; crits: number; maxHit: number }>;
}


export class DamageMeter {
  private events: MeterEvent[] = [];
  private lastActivityMs: number | undefined;
  private fightStart: number | undefined;
  private last: number | undefined;
  private readonly capacity: number;
  private readonly fightGapMs: number;
  private readonly sourceName?: (source: MeterSource) => string | undefined;

  constructor(options: DamageMeterOptions = {}) {
    this.capacity = Math.max(1, Math.floor(options.capacity ?? DEFAULT_CAPACITY));
    this.fightGapMs = Math.max(1, options.fightGapMs ?? DEFAULT_FIGHT_GAP_MS);
    this.sourceName = options.sourceName;
  }

  /** Stored meter events (<= capacity). */
  get size(): number { return this.events.length; }
  /** Latest pushed timestamp in ms; undefined before the first push. */
  get lastMs(): number | undefined { return this.last; }
  /** Start of the current fight in ms; undefined before the first activity. */
  get fightStartMs(): number | undefined { return this.fightStart; }
  /** True while activity is fresher than fightGapMs. */
  get fightActive(): boolean {
    return this.lastActivityMs !== undefined && this.last !== undefined
      && this.last - this.lastActivityMs <= this.fightGapMs;
  }

  /** Feed one drained CombatEvent stamped with the sim clock in milliseconds. */
  push(event: CombatEvent, nowMs: number): void {
    if (!Number.isFinite(nowMs)) return;
    this.last = this.last === undefined ? nowMs : Math.max(this.last, nowMs);
    if (ACTIVITY_TYPES[event.type]) {
      if (this.lastActivityMs === undefined || nowMs - this.lastActivityMs > this.fightGapMs)
        this.fightStart = nowMs;
      this.lastActivityMs = nowMs;
    }
    switch (event.type) {
      case 'hit': {
        const amount = event.actualValue ?? event.value;
        if (!(amount > 0)) return;
        const skill = event.skill ?? (event.reaction ? `reaction:${event.reaction}`
          : event.periodic ? 'dot' : event.melee ? 'melee' : 'attack');
        this.record({
          t: nowMs, mode: 'damage',
          source: event.allyId !== undefined ? `ally:${event.allyId}` : 'player',
          skill, amount, crit: event.heavy === true,
        });
        return;
      }
      case 'heal':
        if (!(event.value > 0)) return;
        this.record({ t: nowMs, mode: 'healing', source: 'player', skill: event.skill ?? 'heal', amount: event.value, crit: false });
        return;
      case 'potion':
        if (!(event.life > 0)) return;
        this.record({ t: nowMs, mode: 'healing', source: 'player', skill: 'potion', amount: event.life, crit: false });
        return;
    }
  }

  /** Feed a drained batch; every event shares the same drain timestamp. */
  pushAll(events: readonly CombatEvent[], nowMs: number): void {
    for (const event of events) this.push(event, nowMs);
  }

  /** Drop every stored event and forget the current fight boundary. */
  reset(): void {
    this.events = [];
    this.lastActivityMs = this.fightStart = this.last = undefined;
  }

  /**
   * Sorted rows for one mode. With `windowMs`, only events inside the rolling
   * `[lastMs - windowMs, lastMs]` window count; without it, everything stored.
   */
  rows(mode: MeterMode, windowMs?: number): readonly MeterRow[] {
    if (this.last === undefined) return [];
    const start = windowMs === undefined ? -Infinity : this.last - Math.max(0, windowMs);
    return this.aggregate(start, this.last)[mode];
  }

  /** Aggregate both modes over an explicit `[startMs, endMs]` segment. */
  segment(startMs: number, endMs: number): MeterSegment {
    const rows = this.aggregate(startMs, endMs);
    return { startMs, endMs, durationMs: rows.durationMs, damage: rows.damage, healing: rows.healing };
  }

  private record(event: MeterEvent): void {
    this.events.push(event);
    const overflow = this.events.length - this.capacity;
    if (overflow > 0) this.events.splice(0, overflow);
  }

  private aggregate(startMs: number, endMs: number): { durationMs: number; damage: MeterRow[]; healing: MeterRow[] } {
    const sources: Record<MeterMode, Map<MeterSource, SourceAgg>> = { damage: new Map(), healing: new Map() };
    let first = Infinity, latest = -Infinity;
    for (const event of this.events) {
      if (event.t < startMs || event.t > endMs) continue;
      if (event.t < first) first = event.t;
      if (event.t > latest) latest = event.t;
      const bucket = sources[event.mode];
      let agg = bucket.get(event.source);
      if (!agg) bucket.set(event.source, agg = { total: 0, hits: 0, crits: 0, maxHit: 0, skills: new Map() });
      agg.total += event.amount;
      agg.hits += 1;
      if (event.crit) agg.crits += 1;
      if (event.amount > agg.maxHit) agg.maxHit = event.amount;
      let skill = agg.skills.get(event.skill);
      if (!skill) agg.skills.set(event.skill, skill = { total: 0, hits: 0, crits: 0, maxHit: 0 });
      skill.total += event.amount;
      skill.hits += 1;
      if (event.crit) skill.crits += 1;
      if (event.amount > skill.maxHit) skill.maxHit = event.amount;
    }
    const durationMs = first === Infinity ? 0 : Math.max(MIN_DURATION_MS, latest - first);
    const seconds = durationMs / 1000;
    const build = (mode: MeterMode): MeterRow[] => {
      const bucket = sources[mode];
      let grand = 0;
      for (const agg of bucket.values()) grand += agg.total;
      const rows: MeterRow[] = [];
      for (const [source, agg] of bucket) {
        const skills: MeterSkillRow[] = [];
        for (const [key, s] of agg.skills)
          skills.push({ key, label: skillLabel(key), total: s.total, hits: s.hits, crits: s.crits, maxHit: s.maxHit, share: agg.total > 0 ? s.total / agg.total : 0 });
        skills.sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
        rows.push({
          source,
          name: source === 'player' ? 'You' : this.sourceName?.(source) ?? `Ally ${source.slice(5)}`,
          total: agg.total, perSecond: seconds > 0 ? agg.total / seconds : 0,
          share: grand > 0 ? agg.total / grand : 0,
          hits: agg.hits, crits: agg.crits, maxHit: agg.maxHit, skills,
        });
      }
      rows.sort((a, b) => b.total - a.total || a.source.localeCompare(b.source));
      return rows;
    };
    return { durationMs, damage: build('damage'), healing: build('healing') };
  }
}
