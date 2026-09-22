/**
 * Dungeon party content (WotLK RDF): the AI group that fills a "Find Group"
 * queue — one tank, one healer, two damage dealers. Members are ordinary
 * `Ally` actors (partyTank/partyHealer/partyDps kinds in wow-allies.ts) so the
 * existing ally movement/combat path, threat tables and enemy targeting all
 * apply; this module only decides WHO joins and how strong they are.
 *
 * Composition is deterministic per dungeon entrance seed: the same queue finds
 * the same adventurers. Stats scale off the player's sheet like summonAlly, so
 * members track the dungeon's level band (the finder pins the floor to the
 * player's level).
 */
import type { AllyKind, WowClassId } from './wow-types.ts';
import { WOW_CLASSES } from './wow-classes.ts';
import { hash } from './world-landscape.ts';

export type PartyRole = 'tank' | 'healer' | 'dps';

/** One generated party member: role, class identity and the ally kind it spawns as. */
export interface PartyMemberSpec {
  readonly role: PartyRole;
  readonly classId: WowClassId;
  readonly name: string;
  readonly kind: AllyKind;
  /** WoW class color; tints the world sprite and the party frame. */
  readonly color: string;
}

export const PARTY_RULES = Object.freeze({
  /** Player + tank + healer + 2 dps. */
  size: 5,
  /** Members persist for the run; a huge duration keeps them out of the pet
   * frame (which only frames permanent allies) without ever expiring. */
  duration: 86400,
  /** Tank taunt compel, seconds (WoW Taunt is 3s; slightly longer reads better at this scale). */
  tauntDuration: 4,
  tauntCooldown: 8,
  /** Defensive-stance threat: extra threat per tick while engaged. */
  threatTickSeconds: 0.5,
  threatMultiplier: 1.2,
  /** Heal cadence and potency (fraction of the target's max hp). */
  healCooldown: 2.5,
  healFraction: 0.3,
  healRange: 320,
  /** Heal when a party member drops below this hp fraction. */
  healBelow: 0.85,
  /** The tank only body-pulls enemies inside this radius of the player;
   * engaged enemies are always fair game. */
  engageRadius: 240,
});

/** Role → ally kind. The kinds carry the movement/attack envelope (melee tank,
 * ranged healer/dps) through ALLY_TEMPLATES. */
export const PARTY_ROLE_KIND: Readonly<Record<PartyRole, AllyKind>> = Object.freeze({
  tank: 'partyTank',
  healer: 'partyHealer',
  dps: 'partyDps',
});

const TANK_CLASSES: readonly WowClassId[] = ['warrior', 'paladin', 'deathKnight', 'druid'];
const HEALER_CLASSES: readonly WowClassId[] = ['priest', 'paladin', 'shaman', 'druid'];
const DPS_CLASSES: readonly WowClassId[] = ['mage', 'warlock', 'hunter', 'rogue', 'shaman', 'druid', 'warrior', 'deathKnight', 'paladin', 'priest'];

/** Adventurer names; index is hashed per member so a party never repeats one. */
const PARTY_NAMES = [
  'Brann', 'Sylvanas', 'Garona', 'Kael', 'Tirion', 'Jaina', 'Rexxar', 'Valeera',
  'Darion', 'Lorthemar', 'Velen', 'Gelbin', 'Aysa', 'Taran', 'Nazgrim', 'Lilian',
] as const;

const pick = <T>(pool: readonly T[], roll: number): T => pool[roll % pool.length]!;

/** The four AI members for one dungeon run, deterministic on the entrance seed. */
export function partyComposition(seed: number): readonly PartyMemberSpec[] {
  const tankClass = pick(TANK_CLASSES, hash(1, 0, seed, 0x9a17));
  const healerClass = pick(HEALER_CLASSES, hash(2, 0, seed, 0x9a17));
  const dpsA = pick(DPS_CLASSES, hash(3, 0, seed, 0x9a17));
  // Second dps re-rolls until it differs from the first — two mages is legal in
  // WoW but reads as a bug in a five-man.
  let dpsB = pick(DPS_CLASSES, hash(4, 0, seed, 0x9a17));
  if (dpsB === dpsA) dpsB = pick(DPS_CLASSES, hash(4, 1, seed, 0x9a17));
  const usedNames = new Set<string>();
  const member = (role: PartyRole, classId: WowClassId, index: number): PartyMemberSpec => {
    // Hash the first pick, then walk forward until free — always terminates.
    let nameIndex = hash(10 + index, 0, seed, 0x5eED) % PARTY_NAMES.length;
    while (usedNames.has(PARTY_NAMES[nameIndex]!)) nameIndex = (nameIndex + 1) % PARTY_NAMES.length;
    const name = PARTY_NAMES[nameIndex]!;
    usedNames.add(name);
    return { role, classId, name, kind: PARTY_ROLE_KIND[role], color: WOW_CLASSES[classId].color };
  };
  return Object.freeze([
    member('tank', tankClass, 0),
    member('healer', healerClass, 1),
    member('dps', dpsA, 2),
    member('dps', dpsB, 3),
  ]);
}
