// Hotkeys modal: searchable list of shortcuts grouped by category.
import { MagnifyingGlass } from '@phosphor-icons/react';
import { Fragment, useMemo, useState } from 'react';
import { t } from '@/i18n';
import { useUi } from '@/state/ui';
import { EmptyState, Kbd, Modal, TextInput, chordLabel } from '@/ui';
import { HOTKEY_CATEGORIES, type HotkeyDef } from './hotkeyCatalog';

const ARROWS: Record<string, string> = { arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓' };

function displayChord(chord: string): string[] {
  return chord.split('+').map((part) => ARROWS[part] ?? chordLabel(part));
}

function ChordView({ chord }: { chord: string }) {
  const parts = displayChord(chord);
  return (
    <span className="hk-chord">
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="hk-plus">+</span>}
          <Kbd>{p}</Kbd>
        </Fragment>
      ))}
    </span>
  );
}

function Chords({ def }: { def: HotkeyDef }) {
  return (
    <span className="hk-chords">
      {def.chords.map((c, i) => (
        <Fragment key={c}>
          {i > 0 && <span className="hk-sep">{def.range ? '–' : t('settings.hotkeys.or')}</span>}
          <ChordView chord={c} />
        </Fragment>
      ))}
    </span>
  );
}

export function HotkeysModal(_props: { tab?: unknown }) {
  const open = useUi((s) => s.modal === 'hotkeys');
  const openModal = useUi((s) => s.openModal);
  if (!open) return null;
  return (
    <Modal open onOpenChange={(o) => !o && openModal(null)} title={t('settings.hotkeys.title')} size="lg" closeLabel={t('common.close')}>
      <HotkeysBody />
    </Modal>
  );
}

function HotkeysBody() {
  const [search, setSearch] = useState('');
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return HOTKEY_CATEGORIES.map((c) => ({
      id: c.id,
      title: t(c.title),
      hotkeys: c.hotkeys.filter(
        (h) => !q || t(h.title).toLowerCase().includes(q) || t(h.desc).toLowerCase().includes(q) || h.chords.some((ch) => chordLabel(ch).toLowerCase().includes(q)),
      ),
    })).filter((g) => g.hotkeys.length > 0);
  }, [search]);

  return (
    <div className="hk" data-testid="hotkeys-modal">
      <div className="hk-search">
        <MagnifyingGlass size={14} className="hk-search__icon" />
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('settings.hotkeys.search')} aria-label={t('settings.hotkeys.search')} autoFocus />
      </div>
      <div className="hk-list" tabIndex={0} role="region" aria-label={t('settings.hotkeys.title')}>
        {groups.length === 0 && <EmptyState title={t('settings.hotkeys.noMatch')} />}
        {groups.map((g) => (
          <section key={g.id} className="hk-group">
            <h3 className="hk-group__title">{g.title}</h3>
            {g.hotkeys.map((h) => (
              <div key={h.id} className="hk-row">
                <div className="hk-row__text">
                  <span className="hk-row__title">{t(h.title)}</span>
                  <span className="hk-row__desc">{t(h.desc)}</span>
                </div>
                <Chords def={h} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
