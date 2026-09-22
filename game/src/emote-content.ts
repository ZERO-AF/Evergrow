/** WotLK-style slash emotes (docs/wow-deepening.md §8): immutable presentation
 * content only. An emote prints a chat line and raises a brief overhead bubble;
 * it never touches gameplay, AI, or saves. Line phrasing follows real WotLK
 * emote strings ("You burst into dance."). */

export interface EmoteDefinition {
  readonly id: string;
  /** Slash names without the leading '/'; the first is canonical. */
  readonly commands: readonly string[];
  /** Chat line with no target ("You dance."). */
  readonly text: string;
  /** Chat line with a target; '%s' is replaced by the target's name. */
  readonly targetText?: string;
  /** Short overhead bubble label; absent falls back to `text`. */
  readonly overhead?: string;
}

export const EMOTES: readonly EmoteDefinition[] = Object.freeze([
  { id: 'dance', commands: ['dance'], text: 'You burst into dance.', targetText: 'You dance with %s.', overhead: 'Dance!' },
  { id: 'wave', commands: ['wave'], text: 'You wave.', targetText: 'You wave at %s.', overhead: 'Wave' },
  { id: 'hello', commands: ['hello', 'hi'], text: 'You greet everyone.', targetText: 'You greet %s.', overhead: 'Hello!' },
  { id: 'salute', commands: ['salute'], text: 'You stand at attention and salute.', targetText: 'You salute %s with respect.', overhead: 'Salute' },
  { id: 'bow', commands: ['bow'], text: 'You bow.', targetText: 'You bow before %s.', overhead: 'Bow' },
  { id: 'cheer', commands: ['cheer'], text: 'You cheer!', targetText: 'You cheer at %s.', overhead: 'Cheer!' },
  { id: 'applaud', commands: ['applaud', 'clap'], text: 'You clap excitedly.', targetText: 'You clap for %s.', overhead: 'Clap!' },
  { id: 'laugh', commands: ['laugh', 'lol'], text: 'You laugh.', targetText: 'You laugh at %s.', overhead: 'Ha ha!' },
  { id: 'cry', commands: ['cry', 'weep'], text: 'You cry.', targetText: "You cry on %s's shoulder.", overhead: 'Sob…' },
  { id: 'sit', commands: ['sit'], text: 'You sit down.', overhead: 'Sit' },
  { id: 'sleep', commands: ['sleep'], text: 'You fall asleep. Zzzzzzz.', overhead: 'Zzz…' },
  { id: 'point', commands: ['point'], text: 'You point.', targetText: 'You point at %s.', overhead: 'Point' },
  { id: 'roar', commands: ['roar'], text: 'You roar!', targetText: 'You roar at %s.', overhead: 'Roar!' },
  { id: 'flex', commands: ['flex'], text: 'You flex your muscles.', targetText: 'You flex at %s.', overhead: 'Flex!' },
  { id: 'kiss', commands: ['kiss'], text: 'You blow a kiss.', targetText: 'You blow a kiss to %s.', overhead: 'Kiss' },
  { id: 'beg', commands: ['beg'], text: 'You beg.', targetText: 'You beg %s.', overhead: 'Beg' },
  { id: 'no', commands: ['no'], text: 'You say no.', targetText: 'You shake your head at %s.', overhead: 'No.' },
  { id: 'yes', commands: ['yes', 'nod'], text: 'You nod.', targetText: 'You nod at %s.', overhead: 'Yes.' },
  { id: 'train', commands: ['train'], text: 'You make train noises.', targetText: 'You make train noises at %s.', overhead: 'Choo choo!' },
]);

const EMOTE_LOOKUP: Readonly<Record<string, EmoteDefinition>> = Object.freeze(
  Object.fromEntries(EMOTES.flatMap(def => def.commands.map(command => [command, def]))));

/** Case-insensitive slash lookup; 'command' arrives without the leading '/'. */
export function emoteForCommand(command: string): EmoteDefinition | undefined {
  return EMOTE_LOOKUP[command.toLowerCase()];
}

/** The chat line for one emote; falls back to the untargeted phrasing. */
export function emoteLine(def: EmoteDefinition, targetName?: string): string {
  return targetName && def.targetText ? def.targetText.replace('%s', targetName) : def.text;
}
