/**
 * Mail content (WotLK-style post): immutable rules, the message shape shared by
 * the sheet ledger and the panel, and the settlement mailbox prop. Mailboxes
 * are standalone fixtures beside the town stash — every settlement raises one,
 * the same way every settlement has a storage chest and a stable master.
 * COD is intentionally not modeled: attachments are prepaid by the sender.
 */
import type { Item } from './character-types.ts';
import type { Building } from './settlements.ts';
import type { WorldQuery } from './model.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { GAME_FEATURES } from './game-features.ts';
import { cloneData } from './data-clone.ts';
/** WotLK-flavored limits; every persisted inbox stays bounded by these. */
export const MAIL_RULES = Object.freeze({
  /** Messages kept per character inbox (WoW shows ~50). */
  maxMessages: 50,
  /** Days before an unclaimed message expires (WoW: 30). */
  expiryDays: 30,
  /** Flat postage in copper, charged to the sender per message (WoW: 30c). */
  postage: 30,
  maxSubject: 60,
  maxBody: 500,
  /** Copper ceiling for a gold attachment (matches MAX_BUYOUT). */
  maxGold: 1_000_000_000,
  /** Interaction reach of a mailbox prop, matching NPC service reach. */
  mailboxReach: 70,
} as const);

export const MAIL_EXPIRY_MS = MAIL_RULES.expiryDays * 86_400_000;

/**
 * One letter in a character's inbox. `item` is a snapshot: the mail owns it
 * until collected, expired or returned — the same escrow model as an auction
 * listing. `item.id` is namespaced per message (mailItemCopy) so it can never
 * collide with an item the recipient already owns.
 */
export interface MailMessage {
  id: string;
  /** Sender display name; system mail uses a label like 'Auction House'. */
  from: string;
  /** Recipient display name, kept so an expired letter can return addressed. */
  to?: string;
  /** Sender's character slot; absent on system mail. Drives expiry returns. */
  fromSlot?: number;
  subject: string;
  body: string;
  /** Attached item in escrow (renamed id); absent once collected. */
  item?: Item;
  /** Attached copper; absent once collected. */
  gold?: number;
  sentAt: number;
  expiresAt: number;
  read: boolean;
  /** True on a letter that already bounced back once; it expires for good. */
  returned?: boolean;
  /** True on system-generated mail (auction proceeds, refunds). */
  system?: boolean;
}

/** Compose form payload: `to` is one of the eight local character slots. */
export interface MailDraft {
  to: number;
  subject: string;
  body: string;
  /** Bag (inventory) index of the item to attach. */
  itemRef?: number;
  /** Copper to attach. */
  gold?: number;
}

/** A deliverable slot on the compose form. */
export interface MailRecipient {
  slot: number;
  name: string;
  level: number;
}

/** Feature flag read through a tolerant lens until GAME_FEATURES.mail lands. */
export const mailEnabled = (): boolean =>
  (GAME_FEATURES as Record<string, boolean | undefined>).mail ?? true;

/** Message id: unique per sender slot and send sequence, stable in saves. */
export const mailMessageId = (senderSlot: number, seq: number, sentAt: number): string =>
  `m${senderSlot.toString(36)}-${sentAt.toString(36)}-${seq.toString(36)}`;

/**
 * Clone an attachment for escrow with a per-message id namespace. Two
 * characters can legitimately own identical item ids (generation is seeded),
 * so the mailed copy is renamed; weapon/shield/focus mirror ids follow.
 */
export function mailItemCopy(item: Item, messageId: string): Item {
  const copy = cloneData(item);
  copy.id = `mail:${messageId}:${item.id}`.slice(0, 160);
  if (copy.weapon) copy.weapon.id = copy.id;
  if (copy.shield) copy.shield.id = copy.id;
  if (copy.focus) copy.focus.id = copy.id;
  return copy;
}

/** A mailbox prop: a neutral interactable anchored to the settlement stash. */
export interface Mailbox {
  readonly id: string;
  readonly name: 'Mailbox';
  readonly buildingId: string;
  readonly x: number;
  readonly y: number;
}

/** Every settlement has a stash fixture; the mailbox stands on its far side. */
export function mailboxFor(building: Building): Mailbox | null {
  if (building.kind !== 'stash') return null;
  return { id: `${building.id}:mailbox`, name: 'Mailbox', buildingId: building.id,
    x: building.door.x + 52, y: building.door.y - 2 };
}

export function mailboxesNear(world: WorldQuery, x: number, y: number, width: number, height: number): Mailbox[] {
  return (world.getBuildings?.(x, y, width, height) ?? [])
    .map(mailboxFor).filter((box): box is Mailbox => box !== null);
}

export function canUseMailbox(box: Mailbox, player: { x: number; y: number; dead?: boolean }, world: WorldQuery): boolean {
  return !player.dead && !world.blocked(box.x, box.y, 0) && !world.blocked(player.x, player.y, 0)
    && Math.hypot(player.x - box.x, player.y - box.y) <= MAIL_RULES.mailboxReach
    && hasLineOfSight(world, player.x, player.y, box.x, box.y);
}

export function focusedMailbox(boxes: readonly Mailbox[], player: { x: number; y: number; dead?: boolean }, world: WorldQuery,
  pointer?: { x: number; y: number }): Mailbox | null {
  return boxes.filter(box => canUseMailbox(box, player, world) && (!pointer || Math.hypot(pointer.x - box.x, pointer.y - (box.y - 12)) <= 30))
    .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0] ?? null;
}
