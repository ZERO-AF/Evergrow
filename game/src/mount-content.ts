/** Mount definitions (docs/wow-deepening.md §2). */
export type MountId = 'horse' | 'wolf' | 'ram' | 'drake';
export interface MountDef {
  readonly id: MountId;
  readonly name: string;
  /** Movement speed multiplier while mounted. */
  readonly speed: number;
  /** Saddle/body tint for the procedural mount art. */
  readonly tint: string;
  readonly accent: string;
}
export const MOUNTS: Readonly<Record<MountId, MountDef>> = Object.freeze({
  horse: Object.freeze({ id: 'horse', name: 'Brown Horse', speed: 1.6, tint: '#6b4a33', accent: '#3a2a20' }),
  wolf: Object.freeze({ id: 'wolf', name: 'Dire Wolf', speed: 1.6, tint: '#5a5f66', accent: '#2e3238' }),
  ram: Object.freeze({ id: 'ram', name: 'Gray Ram', speed: 1.6, tint: '#7d7a72', accent: '#45423c' }),
  drake: Object.freeze({ id: 'drake', name: 'Nether Drake', speed: 2.0, tint: '#5a4a7a', accent: '#2e2444' }),
});
export const MOUNT_IDS: readonly MountId[] = Object.freeze(Object.keys(MOUNTS) as MountId[]);
export function isMountId(v: unknown): v is MountId { return typeof v === 'string' && v in MOUNTS; }
