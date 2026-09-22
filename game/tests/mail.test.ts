import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItem } from '../src/items.ts';
import { Simulation } from '../src/simulation.ts';
import { addInventoryItem } from '../src/inventory-grid.ts';
import { CharacterSession } from '../src/character-session.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { decodeCharacterSave } from '../src/character-save.ts';
import { refreshCharacter } from '../src/character.ts';
import { MAIL_RULES, MAIL_EXPIRY_MS, mailboxFor, mailboxesNear, focusedMailbox } from '../src/mail-content.ts';
import { mailOf, ensureMail, validMailState, sweepExpiredMail, unreadMailCount } from '../src/mail-state.ts';
import { sendMail, collectMail, readMail, deleteMail, tickMail, mailRecipients, deliverSystemMail } from '../src/mail-command.ts';
import type { CharacterSheet } from '../src/character-types.ts';
import type { Building } from '../src/settlements.ts';

const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const NOW = 1_800_000_000_000; // fixed wall-clock so expiry is deterministic

/** In-memory repository + two saved characters in slots 0 and 1. */
async function rig() {
  const data = new Map<string, string>();
  const repository = new CharacterRepository({ getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } });
  const simA = new Simulation(world, { spawn: false });
  const simB = new Simulation(world, { spawn: false });
  const sessionA = new CharacterSession(repository, 4);
  const sessionB = new CharacterSession(repository, 4);
  assert.ok(await sessionA.create(0, 'Sender', 7319, simA.captureCheckpoint(), 'sender-id', 1), sessionA.error);
  assert.ok(await sessionB.create(1, 'Receiver', 7319, simB.captureCheckpoint(), 'receiver-id', 1), sessionB.error);
  simA.player.character.gold = 100_000;
  const persistA = async (character: CharacterSheet, hp: number, mana: number) => {
    const ok = await sessionA.save({ ...simA.captureCheckpoint(), character, hp, mana }, NOW);
    return { ok, message: sessionA.error };
  };
  const persistB = async (character: CharacterSheet, hp: number, mana: number) => {
    const ok = await sessionB.save({ ...simB.captureCheckpoint(), character, hp, mana }, NOW);
    return { ok, message: sessionB.error };
  };
  return { repository, simA, simB, sessionA, sessionB, persistA, persistB, p: simA.player, q: simB.player };
}

function bagItem(sheet: CharacterSheet, seed = 42, level = 10) {
  const item = generateItem(seed, level, 'weapon', undefined, 'rare');
  assert.ok(addInventoryItem(sheet, item));
  return item;
}

const readMailAt = async (repository: CharacterRepository, slot: number) =>
  mailOf((await repository.read(slot)).record!.checkpoint.character);

test('sendMail debits postage + gold, escrows the item and delivers cross-slot', async () => {
  const { repository, p, persistA } = await rig();
  const item = bagItem(p.character);
  const index = p.character.inventory.indexOf(item);
  const before = p.character.gold!;
  const result = await sendMail(p, { to: 1, subject: 'For you', body: 'Enjoy.', itemRef: index, gold: 500 },
    { slot: 0, name: 'Sender' }, repository, persistA, NOW);
  assert.ok(result.ok, result.message);
  // Sender: item escrowed, postage + attached gold gone.
  assert.equal(p.character.inventory[index], null);
  assert.equal(p.character.gold, before - 500 - MAIL_RULES.postage);
  // Recipient slot: the letter landed in the persisted save.
  const inbox = readMailAt(repository, 1);
  assert.equal((await inbox)?.messages.length, 1);
  const letter = (await inbox)!.messages[0];
  assert.equal(letter.from, 'Sender');
  assert.equal(letter.to, 'Receiver');
  assert.equal(letter.fromSlot, 0);
  assert.equal(letter.subject, 'For you');
  assert.equal(letter.gold, 500);
  assert.equal(letter.read, false);
  assert.equal(letter.expiresAt, NOW + MAIL_EXPIRY_MS);
  // The escrowed copy is namespaced so it can never collide with recipient items.
  assert.ok(letter.item!.id.startsWith(`mail:${letter.id}:`));
  assert.notEqual(letter.item!.id, item.id);
});

test('sendMail validation: self-mail, bad slot, missing item, locked item, empty letter, insufficient gold', async () => {
  const { repository, p, persistA } = await rig();
  const sender = { slot: 0, name: 'Sender' };
  assert.equal((await sendMail(p, { to: 0, subject: 'x', body: '' }, sender, repository, persistA, NOW)).ok, false);
  assert.equal((await sendMail(p, { to: 7, subject: 'x', body: '' }, sender, repository, persistA, NOW)).ok, false);
  assert.equal((await sendMail(p, { to: 1, subject: '', body: '' }, sender, repository, persistA, NOW)).ok, false);
  assert.equal((await sendMail(p, { to: 1, subject: 'x', body: '', itemRef: 63 }, sender, repository, persistA, NOW)).ok, false);
  const locked = bagItem(p.character, 77);
  locked.locked = true;
  assert.equal((await sendMail(p, { to: 1, subject: 'x', body: '', itemRef: p.character.inventory.indexOf(locked) }, sender, repository, persistA, NOW)).ok, false);
  p.character.gold = 10;
  assert.equal((await sendMail(p, { to: 1, subject: 'x', body: '', gold: 50 }, sender, repository, persistA, NOW)).ok, false);
  // Nothing was debited or delivered by the failures.
  assert.equal(p.character.gold, 10);
  assert.equal((await readMailAt(repository, 1))?.messages.length ?? 0, 0);
});

test('collectMail credits item + gold atomically and marks the letter read', async () => {
  const { repository, sessionB, p, q, persistA, persistB } = await rig();
  const item = bagItem(p.character);
  const sent = await sendMail(p, { to: 1, subject: 'Gear', body: '', itemRef: p.character.inventory.indexOf(item), gold: 250 },
    { slot: 0, name: 'Sender' }, repository, persistA, NOW);
  assert.ok(sent.ok, sent.message);
  // The recipient session reloads its slot: the delivery write rotated the CAS token.
  const loaded = await sessionB.load(1);
  assert.ok(loaded, sessionB.error);
  q.character = structuredClone(loaded.checkpoint.character);
  refreshCharacter(q);
  const letter = mailOf(q.character)!.messages[0];
  const goldBefore = q.character.gold ?? 0;
  const collected = await collectMail(q, letter.id, persistB);
  assert.ok(collected.ok, collected.message);
  assert.equal(q.character.gold, goldBefore + 250);
  const mailed = q.character.inventory.find(i => i?.id === letter.item!.id);
  assert.ok(mailed, 'mailed item lands in the pack');
  assert.equal(mailOf(q.character)!.messages[0].item, undefined);
  assert.equal(mailOf(q.character)!.messages[0].gold, undefined);
  assert.equal(mailOf(q.character)!.messages[0].read, true);
  // The collection persisted into slot 1.
  const saved = mailOf((await repository.read(1)).record!.checkpoint.character)!;
  assert.equal(saved.messages[0].item, undefined);
  assert.equal(saved.messages[0].read, true);
});

test('collectMail refuses a full pack without stripping the letter', async () => {
  const { repository, sessionB, p, q, persistA, persistB } = await rig();
  const item = bagItem(p.character);
  assert.ok((await sendMail(p, { to: 1, subject: 'Gear', body: '', itemRef: p.character.inventory.indexOf(item) },
    { slot: 0, name: 'Sender' }, repository, persistA, NOW)).ok);
  const loaded = await sessionB.load(1);
  assert.ok(loaded, sessionB.error);
  q.character = structuredClone(loaded.checkpoint.character);
  // Fill every pack cell so the attachment cannot land.
  for (let i = 0; i < q.character.inventory.length; i++)
    if (!q.character.inventory[i]) q.character.inventory[i] = generateItem(9000 + i, 1, 'ring');
  refreshCharacter(q);
  const letter = mailOf(q.character)!.messages[0];
  const result = await collectMail(q, letter.id, persistB);
  assert.equal(result.ok, false);
  assert.equal(mailOf(q.character)!.messages[0].item!.id, letter.item!.id);
});

test('readMail and deleteMail: read persists, attachment-bearing letters cannot be deleted', async () => {
  const { repository, sessionB, p, q, persistA, persistB } = await rig();
  assert.ok((await sendMail(p, { to: 1, subject: 'Hello', body: 'hi', gold: 5 },
    { slot: 0, name: 'Sender' }, repository, persistA, NOW)).ok);
  const loaded = await sessionB.load(1);
  assert.ok(loaded, sessionB.error);
  q.character = structuredClone(loaded.checkpoint.character);
  const letter = mailOf(q.character)!.messages[0];
  assert.equal(unreadMailCount(q.character), 1);
  assert.equal((await deleteMail(q, letter.id, persistB)).ok, false); // still holds 5 copper
  assert.ok((await readMail(q, letter.id, persistB)).ok);
  assert.equal(unreadMailCount(q.character), 0);
  assert.ok((await collectMail(q, letter.id, persistB)).ok);
  assert.ok((await deleteMail(q, letter.id, persistB)).ok);
  assert.equal(mailOf(q.character)!.messages.length, 0);
  assert.equal((await readMailAt(repository, 1))!.messages.length, 0);
});

test('expiry sweep deletes plain letters and returns attachments to the sender slot', async () => {
  const { repository, sessionB, p, q, persistA, persistB } = await rig();
  const item = bagItem(p.character);
  assert.ok((await sendMail(p, { to: 1, subject: 'Gear', body: '', itemRef: p.character.inventory.indexOf(item) },
    { slot: 0, name: 'Sender' }, repository, persistA, NOW)).ok);
  assert.ok((await sendMail(p, { to: 1, subject: 'Note', body: 'no attachments' },
    { slot: 0, name: 'Sender' }, repository, persistA, NOW)).ok);
  const loaded = await sessionB.load(1);
  assert.ok(loaded, sessionB.error);
  q.character = structuredClone(loaded.checkpoint.character);
  refreshCharacter(q);
  const after = NOW + MAIL_EXPIRY_MS + 1;
  const swept = await tickMail(q, repository, persistB, after);
  assert.ok(swept.ok, swept.message);
  assert.equal(mailOf(q.character)!.messages.length, 0);
  // The attachment bounced back to slot 0; the plain letter is gone.
  const returned = (await readMailAt(repository, 0))!.messages;
  assert.equal(returned.length, 1);
  assert.equal(returned[0].returned, true);
  assert.equal(returned[0].subject, 'Returned: Gear');
  assert.equal(returned[0].from, 'Receiver');
  assert.equal(returned[0].to, 'Sender');
  assert.equal(returned[0].item!.id.startsWith('mail:'), true);
  assert.equal(returned[0].expiresAt, after + MAIL_EXPIRY_MS);
  // A returned letter that expires again is destroyed, not bounced.
  const second = sweepExpiredMail((await repository.read(0)).record!.checkpoint.character, after + MAIL_EXPIRY_MS + 1);
  assert.equal(second.returns.length, 0);
  assert.equal(second.deleted.length, 1);
});

test('a full recipient mailbox rejects the send before anything is debited', async () => {
  const { repository, p, persistA } = await rig();
  const character = structuredClone((await repository.read(1)).record!.checkpoint.character);
  const state = ensureMail(character);
  for (let i = 0; i < MAIL_RULES.maxMessages; i++)
    state.messages.push({ id: `fill-${i}`, from: 'System', subject: 'x', body: '', sentAt: NOW, expiresAt: NOW + MAIL_EXPIRY_MS, read: false });
  const slot = (await repository.read(1));
  assert.ok((await repository.write(1, { ...slot.record!, checkpoint: { ...slot.record!.checkpoint, character } }, slot.token)).ok);
  const goldBefore = p.character.gold!;
  const result = await sendMail(p, { to: 1, subject: 'x', body: '', gold: 100 }, { slot: 0, name: 'Sender' }, repository, persistA, NOW);
  assert.equal(result.ok, false);
  assert.match(result.message, /mailbox is full/);
  assert.equal(p.character.gold, goldBefore);
});

test('mailRecipients lists the other saved slots and mail state survives decode validation', async () => {
  const { repository, p, persistA } = await rig();
  const recipients = await mailRecipients(repository, 0);
  assert.deepEqual(recipients.map(r => r.name), ['Receiver']);
  assert.equal((await mailRecipients(repository, 1))[0].name, 'Sender');
  assert.ok((await sendMail(p, { to: 1, subject: 'Round-trip', body: '', gold: 10 },
    { slot: 0, name: 'Sender' }, repository, persistA, NOW)).ok);
  const raw = JSON.stringify((await repository.read(1)).record);
  const decoded = decodeCharacterSave(raw);
  assert.ok(decoded, 'mail ledger survives the checkpoint validator');
  assert.equal(mailOf(decoded!.checkpoint.character)!.messages[0].subject, 'Round-trip');
  // The dedicated validator still rejects malformed ledgers.
  assert.equal(validMailState({ messages: [{ id: 'x' }], seq: 0 }), false);
  assert.equal(validMailState({ messages: [], seq: -1 }), false);
  assert.equal(validMailState(mailOf(decoded!.checkpoint.character)), true);
});

test('deliverSystemMail posts auction-style letters to an offline slot', async () => {
  const { repository } = await rig();
  const item = generateItem(5150, 20, 'amulet', undefined, 'epic');
  const result = await deliverSystemMail(repository, 1,
    { from: 'Auction House', subject: 'Auction won', body: 'Your auction sold.', item, gold: 900 }, NOW);
  assert.ok(result.ok, result.message);
  const letter = (await readMailAt(repository, 1))!.messages[0];
  assert.equal(letter.system, true);
  assert.equal(letter.from, 'Auction House');
  assert.equal(letter.gold, 900);
  assert.ok(letter.item!.id.startsWith('mail:'));
  assert.equal((await deliverSystemMail(repository, 6, { from: 'x', subject: 'y' }, NOW)).ok, false);
});

test('mailbox props anchor to the settlement stash fixture and focus like NPCs', () => {
  const stash: Building = { id: 'town:1:building:3', seed: 7, name: 'Storage', kind: 'stash', form: 'fixture',
    x: 80, y: 180, width: 34, height: 22, door: { x: 100, y: 200, width: 42 }, walls: [], furniture: [] };
  const box = mailboxFor(stash)!;
  assert.ok(box);
  assert.equal(box.id, 'town:1:building:3:mailbox');
  assert.equal(box.x, 152);
  assert.equal(mailboxFor({ ...stash, kind: 'inn' }), null);
  const query = { ...world, getBuildings: () => [stash] };
  assert.deepEqual(mailboxesNear(query, 0, 0, 400, 400), [box]);
  const player = { x: 152, y: 210, dead: false };
  assert.equal(focusedMailbox([box], player, query)?.id, box.id);
  assert.equal(focusedMailbox([box], { ...player, x: 900 }, query), null); // out of reach
  assert.equal(focusedMailbox([box], { ...player, dead: true }, query), null);
});
