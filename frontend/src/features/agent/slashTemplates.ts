// Ready-made requests for the assistant, called up by typing "/" in the chat box and grouped by the feature they are for.
// Taking one leaves its command in the box ("/pose "), the user writes the rest after it, and sending replaces the
// command with the template's sentence. What follows the slash narrows the list: the commands that start with the typed
// word when there are any, else every template whose command, name or sentence contains the typed words (in any letter
// case). A template of a screen this build hides is not offered at all.
import { t, type MessageKey } from '@/i18n';
import { isScreenShown, type MediaKind, type TabName } from '@/state/ui';

export interface SlashTemplate {
  /** The command after the slash, in English (the same in every language). */
  id: string;
  label: MessageKey;
  /** The sentence that goes to the assistant; absent for `/help`, which the box answers by itself. */
  text?: MessageKey;
}

export interface SlashGroup {
  id: string;
  name: MessageKey;
  /** The screen the group's templates work on: while this build hides it, the group is left out. */
  screen?: MediaKind | TabName;
  templates: readonly SlashTemplate[];
}

export const HELP_COMMAND = 'help';

const SLASH_GROUPS: readonly SlashGroup[] = [
  {
    id: 'image',
    name: 'media.tab.image',
    templates: [
      { id: 'image', label: 'agent.template.image.label', text: 'agent.template.image.text' },
      { id: 'improve', label: 'agent.template.improve.label', text: 'agent.template.improve.text' },
      { id: 'pose', label: 'agent.template.pose.label', text: 'agent.template.pose.text' },
    ],
  },
  {
    id: 'comic',
    name: 'app.tabs.comic',
    screen: 'comic',
    templates: [
      { id: 'comic-layout', label: 'agent.template.comicLayout.label', text: 'agent.template.comicLayout.text' },
      { id: 'comic-story', label: 'agent.template.comicStory.label', text: 'agent.template.comicStory.text' },
      { id: 'comic-dialogue', label: 'agent.template.comicDialogue.label', text: 'agent.template.comicDialogue.text' },
    ],
  },
  {
    id: 'music',
    name: 'media.tab.music',
    screen: 'music',
    templates: [{ id: 'music', label: 'agent.template.music.label', text: 'agent.template.music.text' }],
  },
  {
    id: 'workflow',
    name: 'app.tabs.workflows',
    screen: 'workflows',
    templates: [{ id: 'workflow', label: 'agent.template.workflow.label', text: 'agent.template.workflow.text' }],
  },
  {
    id: 'extensions',
    name: 'agent.template.group.extensions',
    screen: 'extensions',
    templates: [{ id: 'extension', label: 'agent.template.extension.label', text: 'agent.template.extension.text' }],
  },
  {
    id: 'help',
    name: 'agent.template.group.help',
    templates: [
      { id: 'howto', label: 'agent.template.howto.label', text: 'agent.template.howto.text' },
      { id: HELP_COMMAND, label: 'agent.template.help.label' },
    ],
  },
];

/** The groups this build offers. */
export function visibleGroups(): SlashGroup[] {
  return SLASH_GROUPS.filter((group) => !group.screen || isScreenShown(group.screen));
}

/** Every template this build offers, in the order of the list. */
export function visibleTemplates(): SlashTemplate[] {
  return visibleGroups().flatMap((group) => group.templates);
}

/** `items` under their groups' headings; a group with none of them is left out. */
export function groupTemplates(items: readonly SlashTemplate[]): SlashGroup[] {
  return SLASH_GROUPS.map((group) => ({ ...group, templates: group.templates.filter((tpl) => items.includes(tpl)) })).filter((group) => group.templates.length);
}

/** The command a box's text starts with and what was written after it, or null when it names no command of this build. */
export function parseCommand(text: string): { template: SlashTemplate; rest: string } | null {
  const match = /^\/(\S+)(\s[\s\S]*)?$/.exec(text);
  if (!match) return null;
  const id = match[1]!.toLowerCase();
  const template = visibleTemplates().find((tpl) => tpl.id === id);
  return template ? { template, rest: (match[2] ?? '').trim() } : null;
}

/**
 * The words typed after a slash at the start of the box, or null when the list has nothing to offer: the box does not
 * start with "/", the text has a line break, or a whole command is followed by a space and the rest is being written.
 */
export function slashQuery(text: string): string | null {
  if (!text.startsWith('/') || text.includes('\n')) return null;
  if (/^\/\S+\s/.test(text) && parseCommand(text)) return null;
  return text.slice(1);
}

/** The templates that match the words after the slash (see the top of this file). */
export function matchTemplates(query: string, templates: readonly SlashTemplate[] = visibleTemplates()): SlashTemplate[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...templates];
  // A sentence can hold the word by chance ("help" in the sentence of /extension): the command itself comes first.
  const commands = words.length === 1 ? templates.filter((tpl) => tpl.id.startsWith(words[0]!)) : [];
  if (commands.length) return commands;
  return templates.filter((tpl) => {
    const haystack = `${tpl.id} ${t(tpl.label)} ${tpl.text ? t(tpl.text) : ''}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

/** What goes to the assistant for a box holding this text: a command becomes its sentence with the rest after it. */
export function expandCommand(text: string): string {
  const command = parseCommand(text);
  if (!command?.template.text) return text;
  const sentence = t(command.template.text);
  if (!command.rest) return sentence;
  // A sentence ending in a space or in full-width punctuation takes the rest directly; one ending in a Latin mark needs a space.
  return `${sentence}${/[!-~]$/.test(sentence) ? ' ' : ''}${command.rest}`;
}
