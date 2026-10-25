// Developer log: a panel docked on the right with the app's log lines (backend, console, uncaught errors).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Trash, X } from '@phosphor-icons/react';
import type { LogLevel } from '@/backend';
import { t, tCount } from '@/i18n';
import { useDevLog, type DevLogEntry } from '@/state/devLog';
import { toast } from '@/state/toasts';
import { IconButton, Select, TextInput, writeClipboardText } from '@/ui';
import './devlog.css';

type LevelFilter = 'all' | 'warn' | 'error';

const RANK: Record<LogLevel, number> = { info: 0, warn: 1, error: 2 };
const MIN_RANK: Record<LevelFilter, number> = { all: 0, warn: 1, error: 2 };

/** Lines at or above the level whose source or message contains the text (case-insensitive). */
export function filterEntries(entries: DevLogEntry[], level: LevelFilter, text: string): DevLogEntry[] {
  const q = text.trim().toLowerCase();
  return entries.filter((e) => RANK[e.level] >= MIN_RANK[level] && (!q || e.source.toLowerCase().includes(q) || e.message.toLowerCase().includes(q)));
}

/** One line as plain text, for copying. */
export function entryText(e: DevLogEntry): string {
  return `${new Date(e.at).toISOString()} ${e.level.toUpperCase()} [${e.source}] ${e.message}`;
}

function time(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function DevLogPanel() {
  const entries = useDevLog((s) => s.entries);
  const setOpen = useDevLog((s) => s.setOpen);
  const clear = useDevLog((s) => s.clear);
  const [level, setLevel] = useState<LevelFilter>('all');
  const [text, setText] = useState('');
  const shown = useMemo(() => filterEntries(entries, level, text), [entries, level, text]);
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [shown]);
  const copy = async () => {
    try {
      await writeClipboardText(shown.map(entryText).join('\n'));
      toast({ status: 'success', title: t('app.devlog.copied') });
    } catch {
      toast({ status: 'error', title: t('gallery.toast.copyFailed') });
    }
  };
  return (
    <aside className="devlog" aria-label={t('app.devlog.title')} data-testid="devlog">
      <div className="devlog__head">
        <span className="devlog__title">{t('app.devlog.title')}</span>
        <span className="devlog__count">{tCount('app.devlog.count', shown.length)}</span>
        <span className="devlog__spacer" />
        <IconButton size="sm" label={t('app.devlog.copy')} icon={<Copy />} onClick={() => void copy()} disabled={!shown.length} />
        <IconButton size="sm" label={t('app.devlog.clear')} icon={<Trash />} onClick={clear} disabled={!entries.length} />
        <IconButton size="sm" label={t('app.devlog.close')} icon={<X />} onClick={() => setOpen(false)} />
      </div>
      <div className="devlog__filters">
        <Select
          value={level}
          onChange={(v) => setLevel(v)}
          aria-label={t('app.devlog.filter')}
          options={[
            { value: 'all', label: t('app.devlog.level.all') },
            { value: 'warn', label: t('app.devlog.level.warn') },
            { value: 'error', label: t('app.devlog.level.error') },
          ]}
        />
        <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder={t('app.devlog.filter')} aria-label={t('app.devlog.filter')} />
      </div>
      <div
        className="devlog__list"
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {shown.length === 0 ? (
          <p className="devlog__empty">{t('app.devlog.empty')}</p>
        ) : (
          shown.map((e) => (
            <div key={e.id} className={`devlog__row is-${e.level}`} data-testid="devlog-row">
              <span className="devlog__time">{time(e.at)}</span>
              <span className="devlog__source">{e.source}</span>
              <span className="devlog__msg">{e.message}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
