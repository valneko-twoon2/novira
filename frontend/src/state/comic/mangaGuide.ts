// The comic-making know-how the assistant can look up one topic at a time (story, direction, layout, lettering,
// prompting, fixing, and the supervision of kinds of scenes). The texts are Markdown files in ./knowledge, bundled with the
// app; the first line of each is its title. The tool description in the backend lists the topics, a test keeps the two equal.

const FILES = import.meta.glob('./knowledge/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const GUIDE = new Map(
  Object.entries(FILES).map(([path, body]) => {
    const text = body.replace(/\r\n/g, '\n').trim();
    return [path.replace(/^.*\/(.+)\.md$/, '$1'), { title: text.split('\n', 1)[0]!.replace(/^#\s*/, ''), text }] as const;
  }),
);

/** The ids of all topics, sorted. */
export const MANGA_GUIDE_TOPICS = [...GUIDE.keys()].sort();

/** The topic's text, or the list of topics (id and title) when none is asked for or the id is unknown. */
export function mangaGuide(topic: string | undefined): { ok: true; content: unknown } | { ok: false; content: string } {
  const entry = topic ? GUIDE.get(topic) : undefined;
  if (entry) return { ok: true, content: entry.text };
  const topics = MANGA_GUIDE_TOPICS.map((id) => ({ id, title: GUIDE.get(id)!.title }));
  return topic ? { ok: false, content: `No topic named ${JSON.stringify(topic.slice(0, 40))}. Topics: ${JSON.stringify(topics)}` } : { ok: true, content: { topics } };
}
