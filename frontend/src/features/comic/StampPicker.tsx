// The picker of a stamp balloon: the sound-effect pictures (see state/comic/stamps.ts), searched by the word, its reading or
// what it is for, narrowed to one of the three hands, each shown as its picture. A press chooses it for the balloon.
import { useState } from 'react';
import { t } from '@/i18n';
import { searchStamps, STAMP_STYLES, stampUrl, type StampStyle } from '@/state/comic/stamps';
import { Button, cx, TextInput } from '@/ui';

export function StampPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [style, setStyle] = useState<StampStyle | null>(null);
  const found = searchStamps(query, style ?? undefined);
  return (
    <div className="comic-stamp-picker" data-testid="comic-stamp-picker">
      <TextInput value={query} placeholder={t('comic.stamp.search')} aria-label={t('comic.stamp.search')} onChange={(e) => setQuery(e.target.value)} />
      <div className="comic-detail__row" role="group" aria-label={t('comic.stamp.styleLabel')}>
        <Button variant="outline" size="sm" aria-pressed={style === null} onClick={() => setStyle(null)}>
          {t('comic.stamp.styleAll')}
        </Button>
        {STAMP_STYLES.map((s) => (
          <Button key={s} variant="outline" size="sm" aria-pressed={style === s} onClick={() => setStyle(s)} data-testid={`comic-stamp-style-${s}`}>
            {t(`comic.stamp.style.${s}`)}
          </Button>
        ))}
      </div>
      <div className="comic-stamp-grid" role="listbox" aria-label={t('comic.stamp.list')}>
        {found.map((s) => (
          <button
            key={s.id}
            type="button"
            role="option"
            aria-selected={s.id === value}
            className={cx('comic-stamp-tile', s.id === value && 'is-selected')}
            title={`${s.text} (${s.reading})`}
            onClick={() => onChange(s.id)}
            data-testid="comic-stamp-tile"
          >
            <img src={stampUrl(s.id)} alt={s.text} loading="lazy" draggable={false} />
          </button>
        ))}
        {found.length === 0 && <p className="comic-hint">{t('comic.stamp.none')}</p>}
      </div>
    </div>
  );
}
