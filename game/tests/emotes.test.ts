import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChatInput, Emotes } from '../src/emote.ts';
import { EMOTES, emoteForCommand, emoteLine } from '../src/emote-content.ts';
import { createWowSim } from './fixtures/wow-sim.ts';

test('emote table is complete and slash lookup is case-insensitive', () => {
  assert.ok(EMOTES.length >= 15 && EMOTES.length <= 20);
  for (const def of EMOTES) {
    assert.ok(def.id && def.commands.length && def.text.startsWith('You'));
    for (const command of def.commands) assert.equal(emoteForCommand(command), def);
  }
  assert.equal(emoteForCommand('DANCE')!.id, 'dance');
  assert.equal(emoteForCommand('clap')!.id, 'applaud');
  assert.equal(emoteForCommand('fly'), undefined);
  assert.equal(emoteLine(emoteForCommand('dance')!), 'You burst into dance.');
  assert.equal(emoteLine(emoteForCommand('dance')!, 'Hogger'), 'You dance with Hogger.');
  assert.equal(emoteLine(emoteForCommand('sit')!, 'Hogger'), 'You sit down.');
});

test('parseChatInput routes say, emotes, custom text and unknown commands', () => {
  assert.deepEqual(parseChatInput('   '), { kind: 'empty' });
  assert.deepEqual(parseChatInput('hello there'), { kind: 'say', text: 'hello there' });
  assert.deepEqual(parseChatInput('/s hi'), { kind: 'say', text: 'hi' });
  assert.deepEqual(parseChatInput('/say'), { kind: 'empty' });
  assert.deepEqual(parseChatInput('/dance'), { kind: 'emote', command: 'dance' });
  assert.deepEqual(parseChatInput('/DANCE extra words'), { kind: 'emote', command: 'dance' });
  assert.deepEqual(parseChatInput('/me waves happily'), { kind: 'custom', text: 'waves happily' });
  assert.deepEqual(parseChatInput('/emote'), { kind: 'empty' });
  assert.deepEqual(parseChatInput('/backflip'), { kind: 'unknown', command: 'backflip' });
});

test('submit pushes chat lines and raises a bounded overhead bubble', () => {
  const sim = createWowSim('warrior');
  sim.player.name = 'Test';
  const emotes = new Emotes();
  emotes.submit(sim, '/dance');
  assert.equal(sim.player.combatLog!.at(-1)!.text, 'You burst into dance.');
  assert.equal(emotes.active(sim.time)!.text, 'Dance!');
  emotes.submit(sim, 'well met');
  assert.equal(sim.player.combatLog!.at(-1)!.text, 'Test says: well met');
  assert.equal(emotes.active(sim.time)!.text, 'well met');
  emotes.submit(sim, '/me bows deeply');
  assert.equal(sim.player.combatLog!.at(-1)!.text, 'Test bows deeply');
  emotes.submit(sim, '/bogus');
  assert.equal(sim.player.combatLog!.at(-1)!.text, 'Unknown command: /bogus.');
  emotes.submit(sim, '   ');
  assert.equal(sim.player.combatLog!.at(-1)!.text, 'Unknown command: /bogus.');
  // The bubble expires on the simulation clock.
  assert.equal(emotes.active(sim.time + 10), null);
});

test('emotes name the current target when one is selected', () => {
  const sim = createWowSim('warrior');
  const emotes = new Emotes();
  sim.enemies.push({ id: 7, kind: 'stalker', state: 'idle', x: 0, y: 0 } as never);
  sim.player.targetId = 7;
  emotes.submit(sim, '/wave');
  const line = sim.player.combatLog!.at(-1)!.text;
  assert.match(line, /^You wave at .+\.$/);
  sim.player.targetId = null;
  emotes.submit(sim, '/wave');
  assert.equal(sim.player.combatLog!.at(-1)!.text, 'You wave.');
});
