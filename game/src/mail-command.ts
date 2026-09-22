/**
 * Mail commands: every mutation stages a checkpoint of the character sheet and
 * persists it before the live player commits — the same durable pattern as the
 * auction house. Sending is a two-slot transaction: the sender's sheet is
 * persisted first (item + postage + gold debited), then the letter is appended
 * to the recipient slot through the repository with a compare-and-swap write.
 * If delivery fails after the sender saved, the untouched live sheet is
 * persisted back so postage, gold and item are restored.
 */
import type { Player } from './model.ts';
import type { CharacterSheet } from './character-types.ts';
import { CHARACTER_SLOT_COUNT, type CharacterSave } from './character-save.ts';
import { cloneData } from './data-clone.ts';
import { refreshCharacter } from './character.ts';
import { spendGold, creditGold } from './wallet.ts';
import { addInventoryItem, canPackItem, packSpaceProblem, normalizePackLayout } from './inventory-grid.ts';
import { itemDisplayName } from './items.ts';
import { formatWalletCompact } from './currency.ts';
import {
  MAIL_RULES, MAIL_EXPIRY_MS, mailEnabled, mailItemCopy, mailMessageId,
  type MailDraft, type MailMessage, type MailRecipient,
} from './mail-content.ts';
import {
  appendMail, ensureMail, findMail, mailHasAttachment, mailOf, removeMail,
  sweepExpiredMail, takeMailAttachment,
} from './mail-state.ts';

type Persist = (character: CharacterSheet, hp: number, mana: number) => { ok: boolean; message?: string } | Promise<{ ok: boolean; message?: string }>;
type Result = { ok: boolean; message: string };
const fail = (message: string): Result => ({ ok: false, message });

/** The repository subset mail needs: read a slot, CAS-write it back, list slots. */
export interface MailRepository {
  read(index: number): { record: CharacterSave | null; token: string | null; state: string } | Promise<{ record: CharacterSave | null; token: string | null; state: string }>;
  write(index: number, record: CharacterSave, expected: string | null): { ok: boolean; message?: string } | Promise<{ ok: boolean; message?: string }>;
  list(): Array<{ index: number; state: string; record: CharacterSave | null }> | Promise<Array<{ index: number; state: string; record: CharacterSave | null }>>;
}

/** Persist the staged sheet, then commit it to the live player. */
async function commit(player: Player, character: CharacterSheet, persist: Persist, message: string): Promise<Result> {
  const candidate = { ...player, character };
  refreshCharacter(candidate);
  const saved = await persist(character, candidate.hp, candidate.mana);
  if (!saved.ok) return fail(saved.message ?? 'Could not save. No gold or items changed.');
  player.character = character;
  refreshCharacter(player);
  return { ok: true, message };
}

/**
 * Append a letter to another character slot. One CAS retry covers a concurrent
 * write in a second tab; a full inbox or a vanished character fails cleanly.
 */
async function deliverMail(repository: MailRepository, slot: number, message: MailMessage): Promise<Result> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const target = await repository.read(slot);
    if (target.state !== 'saved' || !target.record) return fail('That character no longer exists.');
    const character = cloneData(target.record.checkpoint.character);
    if (!appendMail(character, message)) return fail(`${target.record.name}'s mailbox is full.`);
    const record: CharacterSave = { ...target.record, updatedAt: Math.max(target.record.updatedAt + 1, Date.now()),
      checkpoint: { ...target.record.checkpoint, character } };
    const written = await repository.write(slot, record, target.token);
    if (written.ok) return { ok: true, message: '' };
    if (attempt === 1) return fail(written.message ?? 'The letter could not be delivered.');
  }
  return fail('The letter could not be delivered.');
}

/** Compose-tab read model: every other saved character slot. */
export async function mailRecipients(repository: MailRepository, selfSlot: number): Promise<MailRecipient[]> {
  const slots = await repository.list();
  return slots.filter(s => s.index !== selfSlot && s.state === 'saved' && s.record)
    .map(s => ({ slot: s.index, name: s.record!.name, level: s.record!.checkpoint.level }));
}

/**
 * Send a letter: validate the draft, debit postage + attached gold, escrow the
 * attached item, persist the sender, then deliver to the recipient slot.
 */
export async function sendMail(player: Player, draft: MailDraft, sender: { slot: number; name: string },
  repository: MailRepository, persist: Persist, now = Date.now()): Promise<Result> {
  if (!mailEnabled()) return fail('The mail service is unavailable.');
  if (!Number.isInteger(draft.to) || draft.to < 0 || draft.to >= CHARACTER_SLOT_COUNT) return fail('Choose a recipient.');
  if (draft.to === sender.slot) return fail('You cannot mail yourself.');
  const subject = draft.subject.trim().slice(0, MAIL_RULES.maxSubject);
  const body = draft.body.trim().slice(0, MAIL_RULES.maxBody);
  const gold = draft.gold ?? 0;
  if (!Number.isSafeInteger(gold) || gold < 0 || gold > MAIL_RULES.maxGold) return fail('Enter a valid gold amount.');
  const itemRef = draft.itemRef;
  if (itemRef !== undefined && (!Number.isInteger(itemRef) || itemRef < 0 || itemRef >= player.character.inventory.length))
    return fail('Choose an item in your pack.');
  const item = itemRef === undefined ? null : player.character.inventory[itemRef];
  if (itemRef !== undefined && !item) return fail('Choose an item in your pack.');
  if (item?.locked) return fail('Unlock the item before mailing it.');
  if (!subject && !body && !item && !gold) return fail('Write a message or attach something.');

  const target = await repository.read(draft.to);
  if (target.state !== 'saved' || !target.record) return fail('That character no longer exists.');
  const recipientMail = mailOf(target.record.checkpoint.character);
  if ((recipientMail?.messages.length ?? 0) >= MAIL_RULES.maxMessages) return fail(`${target.record.name}'s mailbox is full.`);

  const character = cloneData(player.character);
  const state = ensureMail(character);
  const message: MailMessage = {
    id: mailMessageId(sender.slot, state.seq++, now), from: sender.name, to: target.record.name,
    fromSlot: sender.slot, subject: subject || '(no subject)', body,
    sentAt: now, expiresAt: now + MAIL_EXPIRY_MS, read: false,
  };
  if (item) {
    message.item = mailItemCopy(item, message.id);
    character.inventory[itemRef!] = null;
    normalizePackLayout(character);
  }
  if (gold) message.gold = gold;
  if (!spendGold(character, gold + MAIL_RULES.postage)) {
    return fail(`Postage is ${formatWalletCompact(MAIL_RULES.postage)}${gold ? ` plus ${formatWalletCompact(gold)} attached` : ''}.`);
  }

  const candidate = { ...player, character };
  refreshCharacter(candidate);
  const saved = await persist(character, candidate.hp, candidate.mana);
  if (!saved.ok) return fail(saved.message ?? 'Could not save. Nothing was sent.');
  const delivered = await deliverMail(repository, draft.to, message);
  if (!delivered.ok) {
    // Compensate: the live sheet is untouched, so persisting it restores the save.
    const restored = await persist(player.character, player.hp, player.mana);
    return fail(restored.ok ? `${delivered.message} Nothing was sent.`
      : `${delivered.message} The save could not be restored — your items return on the next save.`);
  }
  player.character = character;
  refreshCharacter(player);
  const parts = [item ? itemDisplayName(item) : '', gold ? formatWalletCompact(gold) : ''].filter(Boolean).join(' and ');
  return { ok: true, message: `Mail sent to ${target.record.name}${parts ? ` — ${parts} attached` : ''}.` };
}

/**
 * Collect a letter's attachments: the item lands in the pack and the gold in
 * the wallet, atomically — a full pack leaves the whole letter untouched.
 */
export async function collectMail(player: Player, id: string, persist: Persist): Promise<Result> {
  const source = findMail(player.character, id);
  if (!source) return fail('That letter is gone.');
  if (!mailHasAttachment(source)) return fail('There is nothing to collect.');
  const character = cloneData(player.character);
  const staged = findMail(character, id)!;
  if (staged.item) {
    if (character.inventory.some(i => i?.id === staged.item!.id)) return fail('That item is already in your pack.');
    if (!canPackItem(character, staged.item)) return fail(packSpaceProblem(character, staged.item));
  }
  const payload = takeMailAttachment(character, id)!;
  if (payload.item && !addInventoryItem(character, payload.item)) return fail('Your pack is full.');
  if (payload.gold && !creditGold(character, payload.gold)) return fail('You cannot carry that much gold.');
  staged.read = true;
  const parts = [payload.item ? itemDisplayName(payload.item) : '', payload.gold ? formatWalletCompact(payload.gold) : ''].filter(Boolean).join(' and ');
  return commit(player, character, persist, `Collected ${parts}.`);
}

/** Mark a letter read; persists only when the flag actually changes. */
export async function readMail(player: Player, id: string, persist: Persist): Promise<Result> {
  const source = findMail(player.character, id);
  if (!source) return fail('That letter is gone.');
  if (source.read) return { ok: true, message: '' };
  const character = cloneData(player.character);
  findMail(character, id)!.read = true;
  return commit(player, character, persist, '');
}

/** Delete a letter; WoW-style, a letter still holding attachments stays. */
export async function deleteMail(player: Player, id: string, persist: Persist): Promise<Result> {
  const source = findMail(player.character, id);
  if (!source) return fail('That letter is gone.');
  if (mailHasAttachment(source)) return fail('Collect the attachments first.');
  const character = cloneData(player.character);
  removeMail(character, id);
  return commit(player, character, persist, 'Letter deleted.');
}

/**
 * Game-loop tick: sweep expired mail. Plain letters are deleted; letters still
 * holding attachments bounce back to the sender's slot through the repository.
 * Returns silently when nothing expired so no persist is staged.
 */
export async function tickMail(player: Player, repository: MailRepository, persist: Persist, now = Date.now()): Promise<Result> {
  const inbox = mailOf(player.character);
  if (!inbox || !inbox.messages.some(m => m.expiresAt <= now)) return { ok: true, message: '' };
  const character = cloneData(player.character);
  const sweep = sweepExpiredMail(character, now);
  for (const bounced of sweep.returns) await deliverMail(repository, bounced.slot, bounced.message);
  const count = sweep.deleted.length + sweep.returns.length;
  return commit(player, character, persist,
    `${count} expired letter${count === 1 ? '' : 's'} ${sweep.returns.length ? 'returned or ' : ''}removed.`);
}

/**
 * System mail (auction proceeds, vendor refunds, event rewards): append a
 * letter to any slot without a live player. Used by systems that settle while
 * the recipient is offline or on another character.
 */
export async function deliverSystemMail(repository: MailRepository, slot: number,
  letter: { from: string; subject: string; body?: string; item?: MailMessage['item']; gold?: number }, now = Date.now()): Promise<Result> {
  if (!Number.isInteger(slot) || slot < 0 || slot >= CHARACTER_SLOT_COUNT) return fail('Invalid character slot.');
  const target = await repository.read(slot);
  if (target.state !== 'saved' || !target.record) return fail('That character no longer exists.');
  const seq = mailOf(target.record.checkpoint.character)?.seq ?? 0;
  const id = mailMessageId(slot, seq, now);
  const message: MailMessage = {
    id, from: letter.from.slice(0, 60), to: target.record.name,
    subject: letter.subject.trim().slice(0, MAIL_RULES.maxSubject) || '(no subject)',
    body: (letter.body ?? '').slice(0, MAIL_RULES.maxBody),
    item: letter.item ? mailItemCopy(letter.item, id) : undefined,
    gold: letter.gold && letter.gold > 0 ? Math.min(letter.gold, MAIL_RULES.maxGold) : undefined,
    sentAt: now, expiresAt: now + MAIL_EXPIRY_MS, read: false, system: true,
  };
  return deliverMail(repository, slot, message);
}
