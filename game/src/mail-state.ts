/**
 * Mail ledger (WotLK-style post): the per-character inbox lives on the
 * character sheet so it rides the ordinary checkpoint save. Pure state
 * helpers — no persistence here; commands stage a sheet and persist it.
 */
import type { CharacterSheet } from './character-types.ts';
import { integer, object, text, validItem, type ObjectValue } from './item-validation.ts';
import { MAIL_EXPIRY_MS, MAIL_RULES, type MailMessage } from './mail-content.ts';
export interface MailState {
  /** Inbox, oldest first; bounded by MAIL_RULES.maxMessages. */
  messages: MailMessage[];
  /** Message id counter; survives reloads so ids never repeat. */
  seq: number;
}

/** CharacterSheet carrying the mail ledger until the field lands on the interface. */
export type MailSheet = CharacterSheet & { mail?: MailState };

/** The sheet's inbox; undefined until the first letter arrives. */
export const mailOf = (sheet: CharacterSheet): MailState | undefined =>
  (sheet as MailSheet).mail;

/** The sheet's inbox, created on first use. */
export function ensureMail(sheet: CharacterSheet): MailState {
  const carrier = sheet as MailSheet;
  return carrier.mail ??= { messages: [], seq: 0 };
}

export const unreadMailCount = (sheet: CharacterSheet): number =>
  mailOf(sheet)?.messages.reduce((n, m) => n + (m.read ? 0 : 1), 0) ?? 0;

export const findMail = (sheet: CharacterSheet, id: string): MailMessage | undefined =>
  mailOf(sheet)?.messages.find(m => m.id === id);

/** True when the letter still carries something worth collecting. */
export const mailHasAttachment = (message: MailMessage): boolean =>
  message.item !== undefined || (message.gold ?? 0) > 0;

/**
 * Append a letter to a sheet's inbox. Fails when the inbox is full or the id
 * collides — the caller decides whether to reject the send or drop the letter.
 * `seq` advances on every accepted letter so generated ids never repeat.
 */
export function appendMail(sheet: CharacterSheet, message: MailMessage): boolean {
  const state = ensureMail(sheet);
  if (state.messages.length >= MAIL_RULES.maxMessages) return false;
  if (state.messages.some(m => m.id === message.id)) return false;
  state.messages.push(message);
  state.seq++;
  return true;
}

/** Remove a letter by id; returns it so callers can inspect what was dropped. */
export function removeMail(sheet: CharacterSheet, id: string): MailMessage | undefined {
  const state = mailOf(sheet);
  const index = state?.messages.findIndex(m => m.id === id) ?? -1;
  if (!state || index < 0) return undefined;
  return state.messages.splice(index, 1)[0];
}

/**
 * Detach the item and gold from a letter, leaving the (now plain) message in
 * the inbox. Returns the payload; undefined when the letter is unknown or
 * already stripped.
 */
export function takeMailAttachment(sheet: CharacterSheet, id: string): { item?: MailMessage['item']; gold: number } | undefined {
  const message = findMail(sheet, id);
  if (!message || !mailHasAttachment(message)) return undefined;
  const payload = { item: message.item, gold: message.gold ?? 0 };
  delete message.item;
  delete message.gold;
  return payload;
}

export interface MailSweep {
  /** Expired letters with no attachment (or already returned once): deleted. */
  deleted: MailMessage[];
  /** Expired letters whose attachments bounce back to the sender's slot. */
  returns: Array<{ slot: number; message: MailMessage }>;
}

/**
 * Expiry sweep: strip expired letters from the inbox. Attachment-bearing mail
 * returns to its sender (WoW's 30-day bounce) unless it already bounced once —
 * then it is destroyed. Mutates `sheet`; the caller stages and persists it.
 */
export function sweepExpiredMail(sheet: CharacterSheet, now: number): MailSweep {
  const state = mailOf(sheet);
  const sweep: MailSweep = { deleted: [], returns: [] };
  if (!state) return sweep;
  const keep: MailMessage[] = [];
  for (const message of state.messages) {
    if (message.expiresAt > now) { keep.push(message); continue; }
    if (mailHasAttachment(message) && !message.returned && message.fromSlot !== undefined) {
      // Re-address the same letter back to its sender; a second expiry destroys it.
      const bounced: MailMessage = {
        ...message, from: message.to ?? message.from, to: message.from,
        subject: `Returned: ${message.subject}`, sentAt: now,
        expiresAt: now + MAIL_EXPIRY_MS, read: false, returned: true,
      };
      delete bounced.fromSlot;
      sweep.returns.push({ slot: message.fromSlot, message: bounced });
    } else {
      sweep.deleted.push(message);
    }
  }
  if (sweep.deleted.length || sweep.returns.length) state.messages = keep;
  return sweep;
}

/** Save validation for `character.mail`; wired into validSheet. */
export function validMailState(v: unknown): v is MailState {
  if (!object(v)) return false;
  const s = v as ObjectValue;
  return Array.isArray(s.messages) && s.messages.length <= MAIL_RULES.maxMessages
    && s.messages.every(validMailMessage) && integer(s.seq);
}

function validMailMessage(v: unknown): v is MailMessage {
  if (!object(v)) return false;
  const m = v as ObjectValue;
  if (!text(m.id, 96) || !text(m.from, 60) || !text(m.subject, MAIL_RULES.maxSubject + 12)
    || typeof m.body !== 'string' || m.body.length > MAIL_RULES.maxBody
    || !integer(m.sentAt) || !integer(m.expiresAt) || typeof m.read !== 'boolean') return false;
  if (m.to !== undefined && !text(m.to, 60)) return false;
  if (m.fromSlot !== undefined && !integer(m.fromSlot, 0, 7)) return false; // 7 = CHARACTER_SLOT_COUNT - 1; inlined to keep the save-validation graph acyclic
  if (m.returned !== undefined && m.returned !== true) return false;
  if (m.system !== undefined && m.system !== true) return false;
  if (m.item !== undefined && !validItem(m.item)) return false;
  return m.gold === undefined || integer(m.gold, 1, MAIL_RULES.maxGold);
}
