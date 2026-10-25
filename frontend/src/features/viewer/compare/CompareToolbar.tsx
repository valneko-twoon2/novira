// Compare mode switch, swap and exit buttons.
import { ArrowsLeftRight, Columns, CursorClick, SlidersHorizontal, X } from '@phosphor-icons/react';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { Button, cx, IconButton, TOOLBAR_BUTTON_SIZE } from '@/ui';

const MODES = [
  { mode: 'slider', icon: <SlidersHorizontal />, label: 'gallery.compare.slider' },
  { mode: 'side-by-side', icon: <Columns />, label: 'gallery.compare.sideBySide' },
  { mode: 'hover', icon: <CursorClick />, label: 'gallery.compare.hover' },
] as const;

export function CompareToolbar({ first, second }: { first: ImageDTO; second: ImageDTO }) {
  const mode = useGallery((s) => s.compareMode);
  const g = useGallery.getState;
  return (
    <div className="vcompare__toolbar">
      <div className="vseg" role="radiogroup" aria-label={t('gallery.compare.mode')}>
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            role="radio"
            aria-checked={mode === m.mode}
            className={cx('vseg__btn', mode === m.mode && 'is-active')}
            onClick={() => g().setCompareMode(m.mode)}
          >
            {m.icon}
            <span>{t(m.label)}</span>
          </button>
        ))}
      </div>
      <IconButton size={TOOLBAR_BUTTON_SIZE}
        label={t('gallery.compare.swap')}
        icon={<ArrowsLeftRight />}
        onClick={() => {
          g().setViewerImage(second.name);
          g().setCompareImage(first.name);
        }}
      />
      <Button size={TOOLBAR_BUTTON_SIZE} variant="outline" leftIcon={<X />} onClick={() => g().setCompareImage(null)} data-testid="compare-exit">
        {t('gallery.compare.exit')}
      </Button>
    </div>
  );
}
