// Ready-made requests for the assistant, called up by typing "/" in the chat box. Each one fills the box with a sentence
// to finish and send. What follows the slash narrows the list: a template stays when its command, its name or its
// sentence contains the typed words (in any letter case).
import { t, type MessageKey } from '@/i18n';

export interface SlashTemplate {
  /** The command after the slash, in English (the same in every language). */
  id: string;
  label: MessageKey;
  text: MessageKey;
}

export const SLASH_TEMPLATES: readonly SlashTemplate[] = [
  { id: 'image', label: 'agent.template.image.label', text: 'agent.template.image.text' },
  { id: 'improve', label: 'agent.template.improve.label', text: 'agent.template.improve.text' },
  { id: 'comic-layout', label: 'agent.template.comicLayout.label', text: 'agent.template.comicLayout.text' },
  { id: 'comic-story', label: 'agent.template.comicStory.label', text: 'agent.template.comicStory.text' },
  { id: 'comic-dialogue', label: 'agent.template.comicDialogue.label', text: 'agent.template.comicDialogue.text' },
  { id: 'pose', label: 'agent.template.pose.label', text: 'agent.template.pose.text' },
  { id: 'workflow', label: 'agent.template.workflow.label', text: 'agent.template.workflow.text' },
  { id: 'extension', label: 'agent.template.extension.label', text: 'agent.template.extension.text' },
  { id: 'howto', label: 'agent.template.howto.label', text: 'agent.template.howto.text' },
  { id: 'music', label: 'agent.template.music.label', text: 'agent.template.music.text' },
];

/**
 * The words typed after a slash at the start of the box, or null when the box is not a slash command (it does not start
 * with "/", or the command already has a line break after it).
 */
export function slashQuery(text: string): string | null {
  if (!text.startsWith('/') || text.includes('\n')) return null;
  return text.slice(1);
}

/** The templates that match the words after the slash: every word must be found in the command, the name or the sentence. */
export function matchTemplates(query: string, templates: readonly SlashTemplate[] = SLASH_TEMPLATES): SlashTemplate[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...templates];
  return templates.filter((tpl) => {
    const haystack = `${tpl.id} ${t(tpl.label)} ${t(tpl.text)}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}
